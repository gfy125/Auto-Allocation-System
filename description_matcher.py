#Requirements:
#   pip install sentence-transformers faiss-cpu

from __future__ import annotations
import os
import sqlite3
import hashlib

import numpy as np

#install the necessary libraries.
try:
    import faiss
    FAISS_AVAILABLE = True
except Exception as e:
    FAISS_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except Exception as e:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

def check_dependencies():
    """Check if all required dependencies are available for description matching"""
    if not FAISS_AVAILABLE:
        raise RuntimeError("Missing faiss-cpu, please install with: 'pip install faiss-cpu' before running this program.")
    if not SENTENCE_TRANSFORMERS_AVAILABLE:
        raise RuntimeError("Missing sentence-transformers, please install with: 'pip install sentence-transformers' before running this program.")
    return True

DB = "student_project.db"
# Multilingual small model
MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
# Directory to persist index and mappings
INDEX_DIR = "description_index"
os.makedirs(INDEX_DIR, exist_ok=True)

#Safely concatenate fields into one text, skipping None or empty values.
def concatenate_fields(*values):
    parts = []
    for value in values:
        if value is not None and str(value).strip():
            parts.append(str(value).strip())
    return " \n ".join(parts)

#Normalize embeddings to unit length (for cosine similarity).
def normalize_rows_as_unit(vectors: np.ndarray):
    if vectors.ndim != 2:
        raise ValueError("vectors must be 2-D")
    norms = np.linalg.norm(vectors, axis=1, keepdims=True) + 1e-12
    return vectors / norms

class DescriptionMatcher:
    """
    Perform semantic similarity between GroupDescription and Project descriptions
    using local embeddings + FAISS.
    """

    def __init__(self, db_path=DB, model_name=MODEL_NAME, index_dir=INDEX_DIR, device=None,):
        self.db_path = db_path
        self.model_name = model_name
        self.index_dir = index_dir
        self.device = device

        #lazy load
        self.model=None
        self.index=None
        self.project_IDs=[]
        self.project_embedding_dimension=None

        #paths for persistence
        self.index_path = os.path.join(index_dir, "projects.index")
        self.mapping_path = os.path.join(index_dir, "project_IDs.txt")
        self.embedding_dimension_path = os.path.join(index_dir, "embedding_dimension.txt")

    def get_model(self):
        if self.model is None:
            self.model = SentenceTransformer(self.model_name, device=self.device)
        return self.model
    
    def conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA recursive_triggers = OFF")
        return conn
    
    def ensure_meta_table(self, conn):
        conn.execute("""
        CREATE TABLE IF NOT EXISTS description_meta(
            Key TEXT PRIMARY KEY,
            Value TEXT
        )
        """)
    
    def project_signature(self):
        with self.conn() as conn:
            sql = """
            SELECT ProjectID, COALESCE(UpdatedAt, '')
            FROM projects
            ORDER BY ProjectID
            """
            rows = conn.execute(sql).fetchall()
            
            sql = """
            SELECT COALESCE(MAX(UpdatedAt), '') FROM projects
            """
            max_ts = conn.execute(sql).fetchone()[0] or ""

            ids = []
            for row in rows:
                ids.append(row[0])
            ids = ",".join(ids)

            src = ids + "|" + (max_ts or "")
        return hashlib.sha1(src.encode("utf-8")).hexdigest()
    
    def get_meta(self, key):
        with self.conn() as conn:
            self.ensure_meta_table(conn)
            row = conn.execute("SELECT Value FROM description_meta WHERE Key=?", (key,)).fetchone()

            if row:
                return row[0]
            else:
                return None
    
    def set_meta(self, key, value):
        with self.conn() as conn:
            self.ensure_meta_table(conn)
            sql = """
            INSERT INTO description_meta(Key, Value) VALUES(?,?)
            ON CONFLICT(Key) DO UPDATE SET Value=excluded.Value
            """
            conn.execute(sql, (key, value))

    def groups_needing_refresh(self):
        with self.conn() as conn:
            self.ensure_description_table(conn)
            last_ts = self.get_meta("groups_last_processed_at")

            if last_ts:
                updated = conn.execute("""
                    SELECT g.GroupID
                    FROM groups g
                    WHERE g.UpdatedAt > ?
                    ORDER BY g.GroupID
                """, (last_ts,)).fetchall()
            else:
                updated = []

            new_groups = conn.execute("""
                SELECT g.GroupID
                FROM groups g
                LEFT JOIN (
                    SELECT DISTINCT GroupID FROM description_similarities
                ) ds ON ds.GroupID = g.GroupID
                WHERE ds.GroupID IS NULL
                ORDER BY g.GroupID
            """).fetchall()

        ids = {row[0] for row in updated} | {row[0] for row in new_groups}
        return sorted(ids)

    def recompute_for_groups(self, group_ids, topk=None, batch_size=64):
        if not group_ids:
            return
        
        self.ensure_project_index()

        if self.index is None or not self.project_IDs:
            raise RuntimeError("Project index is not ready (empty).")

        with self.conn() as conn:
            placeholders = ",".join(["?"] * len(group_ids))
            rows = conn.execute(f"""
                SELECT GroupID, GroupDescription
                FROM groups
                WHERE GroupID IN ({placeholders})
                ORDER BY GroupID
            """, group_ids).fetchall()

        if not rows:
            return

        gids = []
        for row in rows:
            gids.append(row[0])

        gtexts = []
        for row in rows:
            gtexts.append(concatenate_fields(row[1]))

        gemb = self.encode_texts(gtexts, batch_size=batch_size).astype("float32")

        if topk is not None:
            k = topk
        else:
            k = len(self.project_IDs)

        sims, idxs = self.index.search(gemb, k)

        with self.conn() as conn:
            self.ensure_description_table(conn)

            conn.executemany("DELETE FROM description_similarities WHERE GroupID=?", [(gid,) for gid in gids])

            rows_to_upsert = []
            for i, gid in enumerate(gids):
                for j in range(k):
                    pj = int(idxs[i, j])
                    pid = self.project_IDs[pj]
                    sim = float(max(0.0, min(1.0, sims[i, j])))
                    rows_to_upsert.append((gid, pid, sim * 100.0))
            self.upsert_batch(conn, rows_to_upsert)

        with self.conn() as conn:
            max_ts = conn.execute("SELECT COALESCE(MAX(UpdatedAt), '') FROM groups").fetchone()[0] or ""
        self.set_meta("groups_last_processed_at", max_ts)


    #Read projects and concatenate text fields.
    #Returns: e.g., [(ProjectID, text), ...]
    def fetch_projects(self):
        sql = """
        SELECT ProjectID, ProjectName, ProjectDescription, ExpectedOutcomes, RequiredSkills
        FROM projects
        ORDER BY ProjectID
        """

        with self.conn() as conn:
            rows = conn.execute(sql).fetchall()

        items = []
        for pid, name, description, outcomes, requirements in rows:
            text = concatenate_fields(name, description, outcomes, requirements)
            items.append((pid, text))
        return items
    
    def encode_texts(self, texts, batch_size = 64):
        model = self.get_model()
        emb = model.encode(texts, batch_size=batch_size, show_progress_bar=True, normalize_embeddings=False)
        emb = emb.astype("float32")
        emb = normalize_rows_as_unit(emb)
        return emb
    
    #Encode projects and build FAISS index(in memory; persist=True will save to disk).
    def build_project_index(self, persist=True):
        self.project_IDs = []
        projects = self.fetch_projects()
        project_texts = []
        for pid, text in projects:
            self.project_IDs.append(pid)
            project_texts.append(text)

        if len(project_texts) == 0:
            raise RuntimeError("Projects list is empty, cannot build index.")
        
        project_embedding = self.encode_texts(project_texts)
        dimension = project_embedding.shape[1]
        self.project_embedding_dimension = dimension

        #cosine similarity via dot product
        index = faiss.IndexFlatIP(dimension)
        index.add(project_embedding)
        self.index = index

        if persist:
            faiss.write_index(index, self.index_path)

            with open(self.mapping_path, "w", encoding="utf-8") as f:
                for pid in self.project_IDs:
                    f.write(pid + "\n")
            
            with open(self.embedding_dimension_path, "w", encoding="utf-8") as f:
                f.write(str(dimension))
    
    #If disk index and mapping exist, load them into memory. Return True if loaded.
    def load_project_index_if_exists(self):
        if not (os.path.exists(self.index_path) and os.path.exists(self.mapping_path) and os.path.exists(self.embedding_dimension_path)):
            return False
        
        #read mapping
        with open(self.mapping_path, "r", encoding="utf-8") as f:
            new_pids = []
            for line in f:
                if line.strip():
                    new_pids.append(line.strip())
            self.project_IDs = new_pids
        with open(self.embedding_dimension_path, "r", encoding="utf-8") as f:
            self.project_embedding_dimension = int(f.read().strip())
        
        #read index
        self.index = faiss.read_index(self.index_path)
        return True
    
    #Ensure project index is available: 1).load from disk if exists, 2)otherwise rebuild.
    def ensure_project_index(self):
        signature = self.project_signature()
        current = self.get_meta("project_signature")
        loaded = self.load_project_index_if_exists()

        #check if the project/group information is changed or not loaded;
        #if so, re-loaded.
        if (not loaded) or (current != signature):
            self.build_project_index(persist=True)
            self.set_meta("project_signature", signature)
        
            with self.conn() as conn:
                self.ensure_description_table(conn)
                conn.execute("DELETE FROM description_similarities")

    #Read groups and concatenate text fields.
    #Returns: List[Tuple[int, str]]
    def fetch_groups(self):
        sql = """
        SELECT GroupID, GroupDescription
        FROM groups
        ORDER BY GroupID
        """
        
        with self.conn() as conn:
            rows = conn.execute(sql).fetchall()
        items = []
        for gid, description in rows:
            text = concatenate_fields(description)
            items.append((gid, text))

        return items
    
    def ensure_description_table(self, conn):
        sql = """
        CREATE TABLE IF NOT EXISTS description_similarities (
            GroupID INTEGER,
            ProjectID TEXT,
            DescSim REAL,           -- normalized cosine similarity, [0,100]
            PRIMARY KEY (GroupID, ProjectID),
            FOREIGN KEY (GroupID) REFERENCES groups (GroupID) ON DELETE CASCADE,
            FOREIGN KEY (ProjectID) REFERENCES projects (ProjectID) ON DELETE CASCADE
        )
        """
        conn.execute(sql)

    def upsert_batch(self, conn, rows):
        sql = """
        INSERT INTO description_similarities(GroupID, ProjectID, DescSim)
        VALUES(?,?,?)
        ON CONFLICT(GroupID, ProjectID) DO UPDATE SET DescSim=excluded.DescSim
        """

        conn.executemany(sql, rows)

    #Compute similarities between all groups and all projects and write into description_similarities table.
    #If topk is given, only store the topk most similar projects per group.
    def compute_and_cache_all(self, topk=None, batch_size=64):
        self.ensure_project_index()
        if self.index is None or not self.project_IDs:
            raise RuntimeError("Project index is not ready(empty).")
        
        groups = self.fetch_groups()
        if len(groups) == 0:
            print("Groups table is empty, skipping computation. Please import group info.")
            return
        
        #encode group texts
        group_IDs = []
        group_texts = []
        for gid, gtext in groups:
            group_IDs.append(gid)
            group_texts.append(gtext)
        group_embedding = self.encode_texts(group_texts, batch_size=batch_size).astype("float32")

        #search
        number_of_project = len(self.project_IDs)
        if topk is not None:
            k = topk
        else:
            k = number_of_project

        similarities = []
        indexs = []
        step = 512 #batch size for search
        for start in range(0, len(group_embedding), step):
            end = min(start+step, len(group_embedding))
            similarity, idx = self.index.search(group_embedding[start:end], k)
            similarities.append(similarity)
            indexs.append(idx)
        similarities = np.vstack(similarities) #[G, k]
        indexs = np.vstack(indexs) #[G, k]

        #write to DB
        with self.conn() as conn:
            self.ensure_description_table(conn)
            rows = []
            for gidx, gid in enumerate(group_IDs):
                for j in range(k):
                    pj = int(indexs[gidx, j])
                    pid = self.project_IDs[pj]
                    similarity = float(max(0.0, min(1.0, similarities[gidx, j])))  #clamp to [0,1]
                    similarity_100 = similarity * 100.0
                    rows.append((gid, pid, similarity_100))

            #batch insert
            chunk = 5000
            for s in range(0, len(rows), chunk):
                self.upsert_batch(conn, rows[s:s+chunk])
        
        print(f"[description_similarities] completed: groups={len(group_IDs)}, per-group topk={k}")

        with self.conn() as conn:
            max_ts = conn.execute("SELECT COALESCE(MAX(UpdatedAt), '') FROM groups").fetchone()[0] or ""
        self.set_meta("groups_last_processed_at", max_ts)

    #Read (or compute on the fly) similarity between a group and a project.
    #Returns range is [0,100].
    def get_description_similarity(self, group_ID, project_ID):
        with self.conn() as conn:
            self.ensure_description_table(conn)
            sql = """
                SELECT DescSim FROM description_similarities
                WHERE GroupID=? AND ProjectID=?
            """
            row = conn.execute(sql, (group_ID, project_ID)).fetchone()
            if row:
                return float(row[0])
            
        #if not cached: compute
        self.ensure_project_index()
        with self.conn() as conn:
            sql = """
                SELECT GroupDescription
                FROM groups WHERE GroupID=?
            """
            group = conn.execute(sql, (group_ID,)).fetchone()
            if not group:
                return 0.0
            g_text = concatenate_fields(group[0])

            sql = """
                SELECT ProjectName, ProjectDescription, ExpectedOutcomes, RequiredSkills
                FROM projects WHERE ProjectID=?            
            """
            project = conn.execute(sql, (project_ID,)).fetchone()
            if not project:
                return 0.0
            p_text = concatenate_fields(*project)

            g_embedding = self.encode_texts([g_text])
            p_embedding = self.encode_texts([p_text])

            similarity = float(np.dot(g_embedding[0], p_embedding[0]))
            similarity = max(0.0, min(1.0, similarity))
            similarity_100 = similarity * 100.0

            with self.conn() as conn:
                self.ensure_description_table(conn)
                sql = """
                INSERT INTO description_similarities(GroupID, ProjectID, DescSim)
                VALUES(?,?,?)
                ON CONFLICT(GroupID, ProjectID) DO UPDATE SET DescSim=excluded.DescSim
                """
                conn.execute(sql, (group_ID, project_ID, similarity_100))

            return similarity_100
    
    #Only execute once to clean the duty cache!!!!!!!!!!!!!!!!!!!!!
    def cleanup_orphans(self):
        with self.conn() as conn:
            # ensure table exists
            self.ensure_description_table(conn)

            conn.execute("""
            DELETE FROM description_similarities
            WHERE ProjectID NOT IN (SELECT ProjectID FROM projects)
            """)

            conn.execute("""
            DELETE FROM description_similarities
            WHERE GroupID NOT IN (SELECT GroupID FROM groups)
            """)

def get_description_score(db_path, group_ID, project_ID, description_weight=0.2):
    """
    Get description similarity score between group and project.
    
    Args:
        db_path: Path to the database
        group_ID: Group ID
        project_ID: Project ID  
        description_weight: Weight for description matching (0.0 to 1.0)
    
    Returns:
        float: Description similarity score (0-100)
    """
    # If description weight is 0, return default score without checking dependencies
    if description_weight == 0.0:
        return 50.0  # Default middle score when description matching is disabled
    
    # If description weight > 0, check dependencies
    check_dependencies()
    
    matcher = DescriptionMatcher(db_path=db_path)
    matcher.ensure_project_index() 
    changed = matcher.groups_needing_refresh()

    if changed:
        matcher.recompute_for_groups(changed)
    return matcher.get_description_similarity(group_ID, project_ID)
