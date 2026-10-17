import sqlite3
import os


# Use an absolute path so backend Node and this script operate on the same DB file
# Repo layout: <repo_root>/Database/database.py and <repo_root>/student_project.db
db_file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'student_project.db'))


def create_groups_table():
    """
    Create groups table
    """
    conn = sqlite3.connect(db_file_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()
    
    print("Creating database schema...")
    
    # Create groups table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS groups (
        GroupID INTEGER PRIMARY KEY AUTOINCREMENT,
        GroupName TEXT NOT NULL UNIQUE,
        GroupDescription TEXT,
        NumStudentsHD INTEGER DEFAULT 0,
        NumStudentsD INTEGER DEFAULT 0,
        NumStudentsCR INTEGER DEFAULT 0,
        NumStudentsP INTEGER DEFAULT 0,
        NumStudentsTwoUnitsEnrolled INTEGER DEFAULT 0,
        allocated_project TEXT,
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    print("Created 'groups' table...")

    # Create skills table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS skills (
        SkillID INTEGER PRIMARY KEY AUTOINCREMENT,
        SkillName TEXT NOT NULL UNIQUE
    )
    """)
    print("Created 'skills' table...")

    # Create group_members table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS group_members (
        MemberID INTEGER PRIMARY KEY AUTOINCREMENT,
        GroupID INTEGER,
        StudentName TEXT NOT NULL,
        StudentID TEXT,
        UniKey TEXT,
        UnitOfStudy TEXT,
        MemberOrder INTEGER,
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (GroupID) REFERENCES groups (GroupID) ON DELETE CASCADE,
        UNIQUE(GroupID, MemberOrder)
    )
    """)
    print("Created 'group_members' table...")
    
    # Create group_preferences table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS group_preferences (
        PreferenceID INTEGER PRIMARY KEY AUTOINCREMENT,
        GroupID INTEGER,
        PreferenceNumber INTEGER CHECK (PreferenceNumber BETWEEN 1 AND 5),
        ProjectID TEXT,
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (GroupID) REFERENCES groups (GroupID) ON DELETE CASCADE,
        FOREIGN KEY (ProjectID) REFERENCES projects (ProjectID),
        UNIQUE(GroupID, PreferenceNumber)
    )
    """)
    print("Created 'group_preferences' table...")

    # Create group_skills table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS group_skills (
        GroupSkillID INTEGER PRIMARY KEY AUTOINCREMENT,
        GroupID INTEGER NOT NULL,
        SkillID INTEGER NOT NULL,
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (GroupID) REFERENCES groups (GroupID) ON DELETE CASCADE,
        FOREIGN KEY (SkillID) REFERENCES skills (SkillID) ON DELETE CASCADE,
        UNIQUE(GroupID, SkillID)
    )
    """)
    print("Created 'group_skills' table...")

    #Automatic update time trigger.
    cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS trg_groups_touch_updated_at
    AFTER UPDATE ON groups
    FOR EACH ROW
    BEGIN
        UPDATE groups
        SET UpdatedAt = CURRENT_TIMESTAMP
        WHERE GroupID = NEW.GroupID;
    END;
    """)
    print("Created trigger 'trg_groups_touch_updated_at'...")

    conn.commit()
    conn.close()
    print(f"\nDatabase schema created successfully in: {db_file_path}")

    return True


def create_projects_table():
    """
    Create the projects table
    """
    conn = sqlite3.connect(db_file_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()
    
    print("Creating projects table...")
    
    # Create projects table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        ProjectID TEXT PRIMARY KEY,
        ProjectName TEXT NOT NULL,
        ProjectClient TEXT NOT NULL,
        ProjectCapacity INTEGER DEFAULT 1,
        ProjectDescription TEXT,
        ExpectedOutcomes TEXT,
        RequiredSkills TEXT,
        RelatedFields TEXT,
        ProvidedResources TEXT,
        Tags TEXT,
        StartTime TEXT,
        FinishTime TEXT,
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    print("Created 'projects' table")

    #If there is no UpdatedAt column, add it.
    try:
        cursor.execute("ALTER TABLE projects ADD COLUMN UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
        print("Added 'UpdatedAt' column to 'projects' (migration).")
    except sqlite3.OperationalError:
        pass
    
    #Automatic update time trigger.
    cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS trg_projects_touch_updated_at
    AFTER UPDATE ON projects
    FOR EACH ROW
    BEGIN
        UPDATE projects
        SET UpdatedAt = CURRENT_TIMESTAMP
        WHERE ProjectID = NEW.ProjectID;
    END;
    """)
    print("Created trigger 'trg_projects_touch_updated_at'...")
    
    # Create project_skills table for normalized skills (optional)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS project_skills (
        ProjectSkillID INTEGER PRIMARY KEY AUTOINCREMENT,
        ProjectID TEXT,
        SkillName TEXT NOT NULL,
        FOREIGN KEY (ProjectID) REFERENCES projects (ProjectID) ON DELETE CASCADE,
        UNIQUE(ProjectID, SkillName)
    )
    """)
    print("Created 'project_skills' table")
    
    conn.commit()
    conn.close()
    print(f"\nProjects table created successfully in: {db_file_path}")

    return True


def create_result_table():
    """
    Create the results table
    """
    conn = sqlite3.connect(db_file_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()
    
    print("Creating results table...")
    
    # Create results table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS results (
            GroupID INTEGER PRIMARY KEY,
            ProjectID TEXT,
            Score REAL,
            PreferenceRank INTEGER,
            SubOptionProjectID TEXT,
            FOREIGN KEY (ProjectID) REFERENCES projects (ProjectID) ON DELETE CASCADE,
            FOREIGN KEY (GroupID) REFERENCES groups (GroupID) ON DELETE CASCADE,
            FOREIGN KEY (SubOptionProjectID) REFERENCES projects (ProjectID) ON DELETE CASCADE
        )
        """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS priority_allocations (
            GroupID INTEGER PRIMARY KEY,
            ProjectID TEXT NOT NULL,
            CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    print("Created 'results' table")
    
    conn.commit()
    conn.close()
    print(f"\nResults table created successfully in: {db_file_path}")

    return True


def create_user_table():
    """
    Create the user table
    """
    conn = sqlite3.connect(db_file_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    print("Creating user table...")
    
    # Create projects table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        UserID INTEGER PRIMARY KEY AUTOINCREMENT,
        Username TEXT,
        Password TEXT,
        UserType INTEGER
    )
    """)
    print("Created 'user' table")

    conn.commit()
    conn.close()
    print(f"\nUser table created successfully in: {db_file_path}")

    return True


if __name__ == "__main__":
    # Ensure all required tables are created when this script is executed directly
    # The order ensures referenced tables exist before foreign keys are applied
    create_groups_table()
    create_projects_table()
    create_result_table()
    create_user_table()
    print("\nAll tables ensured. Database initialization complete.")
