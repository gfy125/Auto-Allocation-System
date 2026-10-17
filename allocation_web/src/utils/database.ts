// database connection and table structure
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const DB_PATH = './student_project.db';

export interface GroupData {
  startTime: string;
  finishTime: string;
  groupName: string;
  student1: string;
  student2: string;
  student3: string;
  student4: string;
  student5: string;
  student6: string;
  student7: string;
  preference1: string;
  preference2: string;
  preference3: string;
  preference4: string;
  preference5: string;
  wamHD: string;
  wamD: string;
  wamCR: string;
  wamP: string;
  dualEnrollment: 'yes' | 'no';
  skills: string[];
  description: string;
}

export class DatabaseManager {
  private db: any;

  async init() {
    this.db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });
    
    await this.createTables();
  }

  private async createTables() {
    // create groups table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        GroupID INTEGER PRIMARY KEY AUTOINCREMENT,
        GroupName TEXT UNIQUE NOT NULL,
        GroupDescription TEXT,
        StartTime TEXT,
        FinishTime TEXT,
        NumStudentsHD INTEGER DEFAULT 0,
        NumStudentsD INTEGER DEFAULT 0,
        NumStudentsCR INTEGER DEFAULT 0,
        NumStudentsP INTEGER DEFAULT 0,
        NumStudentsTwoUnitsEnrolled INTEGER DEFAULT 0,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // create group_members table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS group_members (
        MemberID INTEGER PRIMARY KEY AUTOINCREMENT,
        GroupID INTEGER,
        StudentName TEXT,
        StudentID TEXT,
        UniKey TEXT,
        UnitOfStudy TEXT,
        MemberOrder INTEGER,
        FOREIGN KEY (GroupID) REFERENCES groups(GroupID)
      )
    `);

    // create group_preferences table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS group_preferences (
        PreferenceID INTEGER PRIMARY KEY AUTOINCREMENT,
        GroupID INTEGER,
        PreferenceNumber INTEGER,
        ProjectID TEXT,
        FOREIGN KEY (GroupID) REFERENCES groups(GroupID)
      )
    `);

    // create skills table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        SkillID INTEGER PRIMARY KEY AUTOINCREMENT,
        SkillName TEXT UNIQUE NOT NULL
      )
    `);

    // create group_skills table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS group_skills (
        GroupSkillID INTEGER PRIMARY KEY AUTOINCREMENT,
        GroupID INTEGER,
        SkillID INTEGER,
        FOREIGN KEY (GroupID) REFERENCES groups(GroupID),
        FOREIGN KEY (SkillID) REFERENCES skills(SkillID)
      )
    `);
  }

  async insertGroupData(data: GroupData): Promise<boolean> {
    try {
      // start transaction
      await this.db.run('BEGIN TRANSACTION');

      // insert groups table
      const result = await this.db.run(`
        INSERT INTO groups (
          GroupName, GroupDescription, StartTime, FinishTime,
          NumStudentsHD, NumStudentsD, NumStudentsCR, NumStudentsP,
          NumStudentsTwoUnitsEnrolled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.groupName,
        data.description,
        data.startTime,
        data.finishTime,
        parseInt(data.wamHD) || 0,
        parseInt(data.wamD) || 0,
        parseInt(data.wamCR) || 0,
        parseInt(data.wamP) || 0,
        data.dualEnrollment === 'yes' ? 1 : 0
      ]);

      const groupId = result.lastID;

      // insert student information
      for (let i = 1; i <= 7; i++) {
        const studentData = data[`student${i}` as keyof GroupData] as string;
        if (studentData && studentData.trim()) {
          const parts = studentData.split(',').map(p => p.trim());
          if (parts.length === 4) {
            await this.db.run(`
              INSERT INTO group_members (GroupID, StudentName, StudentID, UniKey, UnitOfStudy, MemberOrder)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [groupId, parts[0], parts[1], parts[2], parts[3], i]);
          }
        }
      }

      // insert project preferences
      for (let i = 1; i <= 5; i++) {
        const preference = data[`preference${i}` as keyof GroupData] as string;
        if (preference && preference.trim()) {
          await this.db.run(`
            INSERT INTO group_preferences (GroupID, PreferenceNumber, ProjectID)
            VALUES (?, ?, ?)
          `, [groupId, i, preference]);
        }
      }

      // insert skills
      for (const skill of data.skills) {
        if (skill.trim()) {
          // ensure skill exists
          await this.db.run('INSERT OR IGNORE INTO skills (SkillName) VALUES (?)', [skill]);
          
          // get skill ID
          const skillResult = await this.db.get('SELECT SkillID FROM skills WHERE SkillName = ?', [skill]);
          
          // link group and skill
          await this.db.run(`
            INSERT OR IGNORE INTO group_skills (GroupID, SkillID)
            VALUES (?, ?)
          `, [groupId, skillResult.SkillID]);
        }
      }

      // commit transaction
      await this.db.run('COMMIT');
      return true;

    } catch (error) {
      // rollback transaction
      await this.db.run('ROLLBACK');
      console.error('Error inserting group data:', error);
      return false;
    }
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

// create singleton instance
export const dbManager = new DatabaseManager();
