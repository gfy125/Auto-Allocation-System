import pandas as pd
import sqlite3
import re


# Define file paths
DB_PATH = "student_project.db"
EXCEL_PATH = "Database/dataset/data.xlsx"


def safe_int(value, default=0):
    """Convert value to int safely, handling empty string, NaN and >7."""
    if pd.isna(value) or value == "":
        return default
    try:
        val = int(value)
        return val if 0 <= val <= 7 else 0
    except ValueError:
        return default


def insert_data_from_excel():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Read Excel
    df = pd.read_excel(EXCEL_PATH)

    # Clean column names
    df.columns = (
        df.columns
        .str.strip()
        .str.replace('\n', ' ', regex=False)
        .str.replace('\xa0', ' ', regex=False)
    )

    # Drop rows with no group name
    group_col = "Your Group Name (TutorialCode_TutorialDayTime_GroupNumber, e.g.: COMP3888_M10_03)"
    df = df.dropna(subset=[group_col], how="all")

    # Ensure sorted by finish time (latest last)
    if "Finish time" in df.columns:
        df = df.sort_values(by="Finish time")

    # Regex for group name validation
    group_name_pattern = re.compile(r"^[A-Z]{4}\d{4}_[A-Z]\d{2}_\d{2}$")

    for _, row in df.iterrows():
        group_name = str(row[group_col]).strip()
        if not group_name:
            continue

        # Validate group name format
        if not group_name_pattern.match(group_name):
            print(f"Skipping invalid group name: {group_name}")
            continue

        group_desc = row.get("Briefly describe on why your group is most suitable to undertake the project preference", "")

        # Delete old record for same group_name
        cursor.execute("DELETE FROM groups WHERE GroupName = ?", (group_name,))

        # Insert into groups
        cursor.execute("""
            INSERT OR REPLACE INTO groups 
            (GroupName, GroupDescription, NumStudentsHD, NumStudentsD, NumStudentsCR, NumStudentsP, NumStudentsTwoUnitsEnrolled) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            group_name,
            group_desc,
            safe_int(row.get("How many students in your group have WAM of HD (>=85) in the prerequisite units? (Numbers only)", 0)),
            safe_int(row.get("How many students in your group have WAM of D (>=75 and <85) in the prerequisite units? (Numbers only)", 0)),
            safe_int(row.get("How many students in your group have WAM of CR (>=65 and <75) in the prerequisite units? (Numbers only)", 0)),
            safe_int(row.get("How many students in your group have WAM of P (>=50 and <65) in the prerequisite units? (Numbers only)", 0)),
            1 if str(row.get("Is there any student enrolled in two different project units in your group?", "")).strip().lower() in ["yes", "y", "1"] else 0
        ))
        conn.commit()

        # Get GroupID
        cursor.execute("SELECT GroupID FROM groups WHERE GroupName = ?", (group_name,))
        group_id = cursor.fetchone()[0]

        # Insert group members (up to 7)
        for i in range(1, 8):
            col = f"Student {i} (name, student ID, unikey, UoS code (e.g.: COMP3888))"
            if pd.notna(row.get(col)):
                parts = [p.strip() for p in str(row[col]).split(",")]
                if len(parts) == 4:
                    cursor.execute("""
                        INSERT OR IGNORE INTO group_members (GroupID, StudentName, StudentID, UniKey, UnitOfStudy, MemberOrder)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (group_id, parts[0], parts[1], parts[2], parts[3], i))

        # Insert preferences (validate with regex)
        for pref_num in range(1, 6):
            col = f"Your group's {pref_num}st preference (Project code only, e.g.: P01)" if pref_num == 1 else \
                  f"Your group's {pref_num}nd preference (Project code only, e.g.: P01)" if pref_num == 2 else \
                  f"Your group's {pref_num}rd preference (Project code only, e.g.: P01)" if pref_num == 3 else \
                  f"Your group's {pref_num}th preference (Project code only, e.g.: P01)"
            if pd.notna(row.get(col)):
                project_id = str(row[col]).strip()
                # project ID only accept format in P+number
                if re.match(r"^P\d+$", project_id):
                    cursor.execute("""
                        INSERT OR IGNORE INTO group_preferences (GroupID, PreferenceNumber, ProjectID)
                        VALUES (?, ?, ?)
                    """, (group_id, pref_num, project_id))

        # Insert skills
        if pd.notna(row.get("Your skills")):
            skills = [s.strip() for s in str(row["Your skills"]).split(";") if s.strip()]
            for skill in skills:
                cursor.execute("INSERT OR IGNORE INTO skills (SkillName) VALUES (?)", (skill,))
                conn.commit()
                cursor.execute("SELECT SkillID FROM skills WHERE SkillName = ?", (skill,))
                skill_id = cursor.fetchone()[0]
                cursor.execute("""
                    INSERT OR IGNORE INTO group_skills (GroupID, SkillID)
                    VALUES (?, ?)
                """, (group_id, skill_id))

        conn.commit()

    conn.close()
    print("Data inserted successfully with restrictions!")
