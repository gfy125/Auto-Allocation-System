import os
import sqlite3
import tempfile
import shutil
import unittest
from unittest import mock
import numpy as np

from description_matcher import (
    DescriptionMatcher, concatenate_fields, normalize_rows_as_unit, get_description_score
)

# --------- helpers ---------
def make_tmp_db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    conn = sqlite3.connect(path)
    c = conn.cursor()
    c.execute("""CREATE TABLE projects(
        ProjectID TEXT PRIMARY KEY,
        ProjectName TEXT,
        ProjectDescription TEXT,
        ExpectedOutcomes TEXT,
        RequiredSkills TEXT,
        UpdatedAt TEXT
    )""")
    c.execute("""CREATE TABLE groups(
        GroupID INTEGER PRIMARY KEY,
        GroupDescription TEXT,
        UpdatedAt TEXT
    )""")
    conn.commit()
    conn.close()
    return path

def seed_small_data(db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.executemany("""INSERT INTO projects(ProjectID, ProjectName, ProjectDescription, ExpectedOutcomes, RequiredSkills, UpdatedAt)
                     VALUES(?,?,?,?,?,?)""", [
        ("P1", "Proj One", "desc one", "out one", "skill A; skill B", "2025-01-01"),
        ("P2", "Proj Two", "desc two", "out two", "skill X/skill Y", "2025-01-02"),
    ])
    c.executemany("""INSERT INTO groups(GroupID, GroupDescription, UpdatedAt)
                     VALUES(?,?,?)""", [
        (1, "group one text", "2025-01-01"),
        (2, "group two text", "2025-01-01"),
        (3, "group three text", "2025-01-01"),
    ])
    conn.commit()
    conn.close()

class DummyModelA:
    """Deterministic fake SentenceTransformer for most tests."""
    def __init__(self, *a, **k): pass
    def encode(self, texts, batch_size=64, show_progress_bar=True, normalize_embeddings=False):
        arr = []
        for t in texts:
            n = len(t or "")
            arr.append([n, (n % 7), 1.0])
        return np.array(arr, dtype="float32")

class DummyModelB:
    """Alternative dummy used in entry-point test to ensure independence."""
    def __init__(self, *a, **k): pass
    def encode(self, texts, batch_size=64, show_progress_bar=True, normalize_embeddings=False):
        return np.array([[len(t or ""), 1.0, 2.0] for t in texts], dtype="float32")


# ========= Test Case =========

class TestDescriptionMatcher(unittest.TestCase):
    def setUp(self):
        # tmp db + seed
        self.db_path = make_tmp_db()
        seed_small_data(self.db_path)
        # tmp index dir
        self.index_dir = tempfile.mkdtemp(prefix="dm_index_")
        # patch SentenceTransformer with dummy
        self.st_patch = mock.patch("description_matcher.SentenceTransformer", return_value=DummyModelA())
        self.st_patch.start()
        # instance under test
        self.dm = DescriptionMatcher(
            db_path=self.db_path,
            index_dir=self.index_dir,
            model_name="stubbed-model",
            device=None
        )

    def tearDown(self):
        self.st_patch.stop()
        try:
            os.remove(self.db_path)
        except Exception:
            pass
        shutil.rmtree(self.index_dir, ignore_errors=True)

    # ---- A. Basic ----
    def test_concatenate_fields_basic(self):
        self.assertEqual(concatenate_fields(None, "", "  ", "a", "b"), "a \n b")

    def test_normalize_rows_shape_and_error(self):
        x = np.array([[3.0, 4.0]], dtype="float32")
        y = normalize_rows_as_unit(x)
        self.assertEqual(y.shape, (1, 2))
        self.assertAlmostEqual(float(np.linalg.norm(y[0])), 1.0, places=6)
        with self.assertRaises(ValueError):
            normalize_rows_as_unit(np.array([1, 2, 3], dtype="float32"))

            # ---- B. Index lifecycle ----
            def test_build_project_index_and_persist(self):
                self.dm.build_project_index(persist=True)
                self.assertTrue(os.path.exists(self.dm.index_path))
                self.assertTrue(os.path.exists(self.dm.mapping_path))
                self.assertTrue(os.path.exists(self.dm.embedding_dimension_path))

            def test_build_index_empty_projects_raises(self):
                dm = DescriptionMatcher(db_path=self.db_path, index_dir=self.index_dir)
                with mock.patch.object(dm, "fetch_projects", return_value=[]):
                    with self.assertRaises(RuntimeError):
                        dm.build_project_index()

            def test_load_project_index_if_exists_flags(self):
                # not exists
                self.assertFalse(self.dm.load_project_index_if_exists())
                # build then load
                self.dm.build_project_index(persist=True)
                self.assertTrue(self.dm.load_project_index_if_exists())
                # remove one file => False
                os.remove(self.dm.mapping_path)
                self.assertFalse(self.dm.load_project_index_if_exists())

            def test_ensure_project_index_rebuild_and_reload_and_rebuild_on_change(self):
                # first: rebuild & write signature
                self.dm.ensure_project_index()
                sig1 = self.dm.get_meta("project_signature")
                # second: unchanged => load only
                self.dm.ensure_project_index()
                sig2 = self.dm.get_meta("project_signature")
                self.assertEqual(sig1, sig2)
                # change projects.UpdatedAt => rebuild & clear table
                with self.dm.conn() as conn:
                    conn.execute("UPDATE projects SET UpdatedAt='2099-01-01' WHERE ProjectID='P1'")
                self.dm.ensure_project_index()
                sig3 = self.dm.get_meta("project_signature")
                self.assertNotEqual(sig2, sig3)

            # ---- C. Batch computation ----
            def test_compute_and_cache_all_full_and_topk(self):
                self.dm.ensure_project_index()
                # full
                self.dm.compute_and_cache_all(topk=None)
                with self.dm.conn() as conn:
                    n = conn.execute("SELECT COUNT(*) FROM description_similarities").fetchone()[0]
                self.assertEqual(n, 3 * 2)
                # topk=1 override
                self.dm.compute_and_cache_all(topk=1)
                with self.dm.conn() as conn:
                    rows = conn.execute("""SELECT GroupID, COUNT(*) FROM description_similarities GROUP BY GroupID""").fetchall()
                self.assertTrue(all(cnt == 1 for _, cnt in rows))

            # ---- D. Incremental refresh and single point ----
            def test_groups_needing_refresh_and_recompute(self):
                self.dm.ensure_project_index()
                changed = self.dm.groups_needing_refresh()
                self.assertEqual(changed, [1, 2, 3])
                self.dm.recompute_for_groups(changed, topk=2)
                with self.dm.conn() as conn:
                    cnt = conn.execute("SELECT COUNT(*) FROM description_similarities").fetchone()[0]
                self.assertEqual(cnt, 3 * 2)
                # update one group => only that group needs refresh
                with self.dm.conn() as conn:
                    conn.execute("UPDATE groups SET UpdatedAt='2099-02-02' WHERE GroupID=2")
                changed2 = self.dm.groups_needing_refresh()
                self.assertEqual(changed2, [2])

    def test_get_description_similarity_cache_and_miss(self):
        self.dm.ensure_project_index()
        self.dm.compute_and_cache_all(topk=None)
        # cache hit
        v1 = self.dm.get_description_similarity(1, "P1")
        self.assertTrue(0.0 <= v1 <= 100.0)
        # delete cached row => miss path (encode on the fly) and write back
        with self.dm.conn() as conn:
            conn.execute("DELETE FROM description_similarities WHERE GroupID=1 AND ProjectID='P1'")
        v2 = self.dm.get_description_similarity(1, "P1")
        self.assertTrue(0.0 <= v2 <= 100.0)
        with self.dm.conn() as conn:
            row = conn.execute("SELECT DescSim FROM description_similarities WHERE GroupID=1 AND ProjectID='P1'").fetchone()
        self.assertIsNotNone(row)

    def test_cleanup_orphans(self):
        self.dm.ensure_project_index()
        self.dm.compute_and_cache_all(topk=1)
        with self.dm.conn() as conn:
            conn.execute("INSERT OR IGNORE INTO description_similarities(GroupID, ProjectID, DescSim) VALUES(999, 'P1', 12.3)")
            conn.execute("INSERT OR IGNORE INTO description_similarities(GroupID, ProjectID, DescSim) VALUES(1, 'ZZZ', 45.6)")
        self.dm.cleanup_orphans()
        with self.dm.conn() as conn:
            bad = conn.execute("""SELECT COUNT(*) FROM description_similarities
                                  WHERE GroupID=999 OR ProjectID='ZZZ'""").fetchone()[0]
        self.assertEqual(bad, 0)

class TestEntryFunction(unittest.TestCase):
    def setUp(self):
        self.db_path = make_tmp_db()
        seed_small_data(self.db_path)
        self.index_dir = tempfile.mkdtemp(prefix="dm_index_")
        # 独立 mock：避免与上一个测试类的 patch 互相影响
        self.st_patch = mock.patch("description_matcher.SentenceTransformer", return_value=DummyModelB())
        self.st_patch.start()

    def tearDown(self):
        self.st_patch.stop()
        try: os.remove(self.db_path)
        except Exception: pass
        shutil.rmtree(self.index_dir, ignore_errors=True)

    def test_get_description_score_entry(self):
        # 首次会构建索引与写 meta；第二次命中缓存
        s1 = get_description_score(self.db_path, 1, "P1")
        self.assertTrue(0.0 <= s1 <= 100.0)
        s2 = get_description_score(self.db_path, 1, "P1")
        self.assertTrue(0.0 <= s2 <= 100.0)

if __name__ == "__main__":
    unittest.main(verbosity=2)
