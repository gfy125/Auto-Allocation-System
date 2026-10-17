import re
import sqlite3
import pandas as pd
from docx import Document


# Define file paths
DB_PATH = "student_project.db"
DOCX_PATH = "Database/dataset/Projectlist.docx"
EXCEL_PATH = "Database/dataset/allocation.xlsx"


def insert_projects_from_docx():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    doc = Document(DOCX_PATH)
    lines = [para.text.strip() for para in doc.paragraphs if para.text.strip()]

    projects = []
    current_project = []

    # --- detect new project by regex Pxx – ProjectName
    for line in lines:
        if re.match(r"^P\d+\s*–", line):
            if current_project:
                projects.append(current_project)
            current_project = [line]
        else:
            current_project.append(line)
    if current_project:
        projects.append(current_project)

    print(f"Found {len(projects)} projects in document")

    for project_lines in projects:
        header = project_lines[0]
        if "–" not in header:
            continue
        project_id, project_name = [p.strip() for p in header.split("–", 1)]

        # Initialise fields
        client = desc = outcomes = skills = related = resources = ""
        current_field = None
        buffer = []

        def flush():
            nonlocal buffer
            text = " ".join(buffer).strip()
            buffer = []
            return text

        for line in project_lines[1:]:
            if line.startswith("Client:"):
                if current_field == "desc": desc = flush()
                elif current_field == "outcomes": outcomes = flush()
                elif current_field == "skills": skills = flush()
                elif current_field == "related": related = flush()
                elif current_field == "resources": resources = flush()
                client = line.replace("Client:", "").strip()
                current_field = None

            elif line.startswith("Project Description and Scope:"):
                if current_field == "desc": desc = flush()
                current_field = "desc"

            elif line.startswith("Expected outcomes/deliverables:"):
                if current_field == "desc": desc = flush()
                current_field = "outcomes"

            elif line.startswith("Specific required knowledge, skills, and/or technology:"):
                if current_field == "outcomes": outcomes = flush()
                current_field = "skills"

            elif line.startswith("Related general fields/disciplines:"):
                if current_field == "skills": skills = flush()
                current_field = "related"

            elif line.startswith("Resources provided by the client:"):
                if current_field == "related": related = flush()
                current_field = "resources"

            else:
                buffer.append(line)

        # flush last
        if current_field == "desc": desc = flush()
        elif current_field == "outcomes": outcomes = flush()
        elif current_field == "skills": skills = flush()
        elif current_field == "related": related = flush()
        elif current_field == "resources": resources = flush()

        # Insert into projects (capacity updated later from Excel)
        cursor.execute("""
            INSERT OR REPLACE INTO projects
            (ProjectID, ProjectName, ProjectClient, ProjectDescription, ExpectedOutcomes, RequiredSkills, RelatedFields, ProvidedResources)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (project_id, project_name, client, desc, outcomes, skills, related, resources))

        # Insert related fields into project_skills
        if related:
            fields = [f.strip() for f in related.split(",") if f.strip()]
            for f in fields:
                cursor.execute("""
                    INSERT OR IGNORE INTO project_skills (ProjectID, SkillName)
                    VALUES (?, ?)
                """, (project_id, f))

    conn.commit()
    conn.close()
    print("All projects inserted successfully")


def update_project_capacity_from_excel():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Load Excel
    df = pd.read_excel(EXCEL_PATH)

    # Replace "no" and empty with NaN
    df = df.replace("no", pd.NA)

    for col in df.columns:
        # Count valid group names
        groups = df[col].dropna().tolist()
        capacity = len(groups)

        cursor.execute("""
            UPDATE projects
            SET ProjectCapacity = ?
            WHERE ProjectID = ?
        """, (capacity, col))

        print(f"Updated {col} capacity = {capacity}")

    conn.commit()
    conn.close()
    print("All project capacities updated successfully")
