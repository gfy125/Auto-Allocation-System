const express = require('express');
const router = express.Router();
const { validateSchema, groupSchema } = require('../validation/schemas');
const { getDatabase, runInTransaction } = require('../database/init');

// Helper function to check if allocation algorithm has been run
async function checkAllocationStatus(db) {
  try {
    const result = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM results WHERE Score IS NOT NULL OR PreferenceRank IS NOT NULL',
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    return result.count > 0;
  } catch (error) {
    console.error('Error checking allocation status:', error);
    return false;
  }
}

// GET /api/groups/scores - Get group scores from results table
router.get('/scores', async (req, res) => {
  const db = getDatabase();
  
  try {
    const query = `
      SELECT 
        g.GroupID,
        g.GroupName,
        r.Score,
        r.PreferenceRank,
        r.ProjectID
      FROM groups g
      LEFT JOIN results r ON g.GroupID = r.GroupID
      WHERE r.ProjectID IS NOT NULL
    `;
    
    const results = await new Promise((resolve, reject) => {
      db.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error fetching group scores:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group scores',
      error: error.message
    });
  }
});



// POST /api/groups - Create a new group
router.post('/', validateSchema(groupSchema), async (req, res) => {
  // Set request timeout (30 seconds)
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Request timeout',
          details: 'The request took too long to process. Please try again.'
        }
      });
    }
  }, 30000);

  const db = getDatabase();
  const data = req.body;

  console.log('Received new group submission');

  // Parse members from student1..student7
  const members = [];
  for (let i = 1; i <= 7; i++) {
    const studentStr = data[`student${i}`];
    if (studentStr && studentStr.trim() !== "") {
      const [StudentName, StudentID, UniKey, UnitOfStudy] = studentStr.split(',').map(s => s.trim());
      members.push({ StudentName, StudentID, UniKey, UnitOfStudy });
    }
  }

  // Parse preferences from preference1..preference5
  const preferences = [];
  for (let i = 1; i <= 5; i++) {
    const pref = data[`preference${i}`];
    if (pref && pref.trim() !== "") {
      preferences.push({ ProjectID: pref });
    }
  }

  try {
    // Check if allocation algorithm has been run
    const allocationRun = await checkAllocationStatus(db);
    if (allocationRun) {
      return res.status(409).json({
        status: 'error',
        message: 'Allocation results has generated, can\'t manage group',
        error: {
          code: 'ALLOCATION_RESULTS_GENERATED',
          message: 'Allocation results has generated, can\'t manage group'
        }
      });
    }

    const groupId = await new Promise((resolve, reject) => {
      db.serialize(async () => {
        db.run("BEGIN TRANSACTION");

        // 1. Insert main group
        db.run(
          `INSERT INTO groups (
            GroupName, GroupDescription,
            NumStudentsHD, NumStudentsD, NumStudentsCR, NumStudentsP, NumStudentsTwoUnitsEnrolled,
            allocated_project
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.groupName,
            data.description || null,
            data.wamHD || 0,
            data.wamD || 0,
            data.wamCR || 0,
            data.wamP || 0,
            data.dualEnrollment || 0,
            data.allocated_project || null
          ],
          async function(err) {
            if (err) return reject(err);
            const groupId = this.lastID;

            // 2. Insert members
            if (members.length > 0) {
              const stmtMembers = db.prepare(`
                INSERT INTO group_members
                (GroupID, StudentName, StudentID, UniKey, UnitOfStudy, MemberOrder)
                VALUES (?, ?, ?, ?, ?, ?)
              `);
              for (let idx = 0; idx < members.length; idx++) {
                const m = members[idx];
                stmtMembers.run([groupId, m.StudentName, m.StudentID, m.UniKey, m.UnitOfStudy, idx + 1]);
              }
              stmtMembers.finalize();
            }

            // 3. Insert preferences
            if (preferences.length > 0) {
              const stmtPrefs = db.prepare(`
                INSERT INTO group_preferences (GroupID, PreferenceNumber, ProjectID)
                VALUES (?, ?, ?)
              `);
              for (let idx = 0; idx < preferences.length; idx++) {
                const p = preferences[idx];
                stmtPrefs.run([groupId, idx + 1, p.ProjectID]);
              }
              stmtPrefs.finalize();
            }

            // 4. Insert skills (auto-create if missing)
            if (data.skills && data.skills.length > 0) {
              const stmtSkills = db.prepare(`
                INSERT INTO group_skills (GroupID, SkillID)
                VALUES (?, ?)
              `);

              for (const skillName of data.skills) {
                await new Promise((resolveSkill, rejectSkill) => {
                  db.get(`SELECT SkillID FROM skills WHERE SkillName = ?`, [skillName], (err, row) => {
                    if (err) return rejectSkill(err);

                    if (row) {
                      // Skill exists
                      stmtSkills.run([groupId, row.SkillID], resolveSkill);
                    } else {
                      // Skill does not exist, insert it
                      db.run(`INSERT INTO skills (SkillName) VALUES (?)`, [skillName], function(err) {
                        if (err) return rejectSkill(err);
                        stmtSkills.run([groupId, this.lastID], resolveSkill);
                      });
                    }
                  });
                });
              }

              stmtSkills.finalize();
            }

            // 5. Commit transaction
            db.run("COMMIT", (err) => {
              if (err) return reject(err);
              resolve(groupId);
            });
          }
        );
      });
    });

    // Return both groupId and the created group data for frontend
    const createdGroup = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM groups WHERE GroupID = ?', [groupId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.status(201).json({
      status: 'ok',
      groupId: groupId,
      group: createdGroup,
      savedAt: new Date().toISOString()
    });

  } catch (error) {
    db.run("ROLLBACK", (err) => {
      if (err) console.error('Rollback error:', err);
    });
    console.error('Error creating group:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create group',
      error: error.message
    });
  }
});



// GET /api/groups - Get all groups
router.get('/', async (req, res) => {
  const db = getDatabase();

  try {
    // 1. Get all groups
    const groups = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM groups ORDER BY GroupID DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // 2. For each group, fetch members, preferences, skills, and allocation info (including Score/PreferenceRank)
    const groupsWithDetails = await Promise.all(groups.map(async group => {
      const GroupID = group.GroupID;

      // Fetch members
      const members = await new Promise((resolve, reject) => {
        db.all(
          'SELECT StudentName, StudentID, UniKey, UnitOfStudy, MemberOrder FROM group_members WHERE GroupID = ? ORDER BY MemberOrder',
          [GroupID],
          (err, rows) => (err ? reject(err) : resolve(rows))
        );
      });

      // Fetch preferences
      const preferences = await new Promise((resolve, reject) => {
        db.all(
          'SELECT PreferenceNumber, ProjectID FROM group_preferences WHERE GroupID = ? ORDER BY PreferenceNumber',
          [GroupID],
          (err, rows) => (err ? reject(err) : resolve(rows))
        );
      });

      // Fetch skills
      const skills = await new Promise((resolve, reject) => {
        db.all(
          `SELECT s.SkillName 
           FROM skills s 
           JOIN group_skills gs ON s.SkillID = gs.SkillID 
           WHERE gs.GroupID = ?`,
          [GroupID],
          (err, rows) => (err ? reject(err) : resolve(rows.map(r => r.SkillName)))
        );
      });

      // Fetch allocation result from results table (single row per group if exists)
      const allocationResult = await new Promise((resolve, reject) => {
        db.get(
          `SELECT 
              r.ProjectID,
              r.Score,
              r.PreferenceRank,
              r.SubOptionProjectID,
              p.ProjectName,
              p2.ProjectName AS SubOptionProjectName
           FROM results r
           LEFT JOIN projects p ON r.ProjectID = p.ProjectID
           LEFT JOIN projects p2 ON r.SubOptionProjectID = p2.ProjectID
           WHERE r.GroupID = ?`,
          [GroupID],
          (err, row) => (err ? reject(err) : resolve(row || null))
        );
      });

      return {
        ...group,
        members,
        preferences: preferences.map(p => p.ProjectID),
        skills,
        allocated_project: group.allocated_project || null,
        // expose flattened fields for frontend convenience
        Score: allocationResult ? allocationResult.Score : null,
        SubOptionProjectID: allocationResult ? allocationResult.SubOptionProjectID : null,
        SubOptionProjectName: allocationResult ? allocationResult.SubOptionProjectName : null,
        allocationResult: allocationResult || null
      };
    }));

    console.log('Groups API - Returning groups data with allocation info:');
    console.log('Total groups:', groupsWithDetails.length);
    
    res.json(groupsWithDetails);

  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch groups'
      }
    });
  }
});



// GET /api/groups/by-name/:groupName - Get a specific group by name
router.get('/by-name/:groupName', async (req, res) => {
  const db = getDatabase();
  const groupName = decodeURIComponent(req.params.groupName);

  if (!groupName || groupName.trim() === '') {
    return res.status(400).json({
      error: {
        code: 'INVALID_GROUP_NAME',
        message: 'Group name cannot be empty'
      }
    });
  }

  try {
    // Fetch group
    const group = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM groups WHERE GroupName = ?', [groupName], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!group) {
      return res.status(404).json({
        error: {
          code: 'GROUP_NOT_FOUND',
          message: 'Group not found'
        }
      });
    }

    const GroupID = group.GroupID;

    // Fetch members
    const members = await new Promise((resolve, reject) => {
      db.all(
        'SELECT StudentName, StudentID, UniKey, UnitOfStudy, MemberOrder FROM group_members WHERE GroupID = ? ORDER BY MemberOrder',
        [GroupID],
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });

    // Fetch preferences
    const preferences = await new Promise((resolve, reject) => {
      db.all(
        'SELECT PreferenceNumber, ProjectID FROM group_preferences WHERE GroupID = ? ORDER BY PreferenceNumber',
        [GroupID],
        (err, rows) => (err ? reject(err) : resolve(rows.map(r => r.ProjectID)))
      );
    });

    // Fetch skills
    const skills = await new Promise((resolve, reject) => {
      db.all(
        `SELECT s.SkillName 
         FROM skills s 
         JOIN group_skills gs ON s.SkillID = gs.SkillID 
         WHERE gs.GroupID = ?`,
        [GroupID],
        (err, rows) => (err ? reject(err) : resolve(rows.map(r => r.SkillName)))
      );
    });

    // Fetch allocation result from results table
    const allocationResult = await new Promise((resolve, reject) => {
      db.get(
        `SELECT r.ProjectID, r.Score, r.PreferenceRank, p.ProjectName
         FROM results r
         LEFT JOIN projects p ON r.ProjectID = p.ProjectID
         WHERE r.GroupID = ?`,
        [GroupID],
        (err, row) => (err ? reject(err) : resolve(row || null))
      );
    });

    res.json({
      ...group,
      members,
      preferences,
      skills,
      allocated_project: group.allocated_project || null,
      // expose flattened score field
      Score: allocationResult ? allocationResult.Score : null,
      allocationResult: allocationResult || null
    });

  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch group'
      }
    });
  }
});



// PUT /api/groups/by-name/:groupName - Update a group by name
router.put('/by-name/:groupName', validateSchema(groupSchema), async (req, res) => {
  const db = getDatabase();
  const groupName = decodeURIComponent(req.params.groupName);
  const data = req.body;

  if (!groupName || groupName.trim() === '') {
    return res.status(400).json({
      error: { code: 'INVALID_GROUP_NAME', message: 'Group name cannot be empty' }
    });
  }

  try {
    // Rebuild members and preferences from flattened fields (align with POST logic)
    const members = [];
    for (let i = 1; i <= 7; i++) {
      const studentStr = data[`student${i}`];
      if (studentStr && studentStr.trim() !== "") {
        const [StudentName, StudentID, UniKey, UnitOfStudy] = studentStr.split(',').map(s => s.trim());
        members.push({ StudentName, StudentID, UniKey, UnitOfStudy });
      }
    }

    const preferences = [];
    for (let i = 1; i <= 5; i++) {
      const pref = data[`preference${i}`];
      if (pref && pref.trim() !== "") {
        preferences.push({ ProjectID: pref });
      }
    }
    // Check if allocation algorithm has been run
    const allocationRun = await checkAllocationStatus(db);
    if (allocationRun) {
      return res.status(409).json({
        status: 'error',
        message: 'Allocation results has generated, can\'t manage group',
        error: {
          code: 'ALLOCATION_RESULTS_GENERATED',
          message: 'Allocation results has generated, can\'t manage group'
        }
      });
    }

    // First find the group by name to get the ID
    const group = await new Promise((resolve, reject) => {
      db.get('SELECT GroupID FROM groups WHERE GroupName = ?', [groupName], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!group) {
      return res.status(404).json({
        error: { code: 'GROUP_NOT_FOUND', message: 'Group not found' }
      });
    }

    const groupId = group.GroupID;

    await new Promise((resolve, reject) => {
      db.serialize(async () => {
        db.run("BEGIN TRANSACTION");

        // 1. Update main group
        db.run(
          `UPDATE groups SET 
             GroupName = ?, GroupDescription = ?,
             NumStudentsHD = ?, NumStudentsD = ?, NumStudentsCR = ?, NumStudentsP = ?, NumStudentsTwoUnitsEnrolled = ?,
             allocated_project = ?
           WHERE GroupID = ?`,
          [
            data.groupName,
            data.description || null,
            data.wamHD || 0,
            data.wamD || 0,
            data.wamCR || 0,
            data.wamP || 0,
            data.dualEnrollment || 0,
            data.allocated_project || null,
            groupId
          ],
          async function(err) {
            if (err) return reject(err);

            try {
              // 2. Update members
              await new Promise((resM, rejM) => {
                db.run(`DELETE FROM group_members WHERE GroupID = ?`, [groupId], (err) => {
                  if (err) return rejM(err);
                  if (members.length > 0) {
                    const stmt = db.prepare(`
                      INSERT INTO group_members
                      (GroupID, StudentName, StudentID, UniKey, UnitOfStudy, MemberOrder)
                      VALUES (?, ?, ?, ?, ?, ?)
                    `);
                    members.forEach((m, idx) => stmt.run([groupId, m.StudentName, m.StudentID, m.UniKey, m.UnitOfStudy, idx + 1]));
                    stmt.finalize(resM);
                  } else {
                    resM();
                  }
                });
              });

              // 3. Update preferences
              await new Promise((resP, rejP) => {
                db.run(`DELETE FROM group_preferences WHERE GroupID = ?`, [groupId], (err) => {
                  if (err) return rejP(err);
                  if (preferences.length > 0) {
                    const stmt = db.prepare(`
                      INSERT INTO group_preferences (GroupID, PreferenceNumber, ProjectID)
                      VALUES (?, ?, ?)
                    `);
                    preferences.forEach((p, idx) => stmt.run([groupId, idx + 1, p.ProjectID]));
                    stmt.finalize(resP);
                  } else {
                    resP();
                  }
                });
              });

              // 4. Update skills
              await new Promise(async (resS, rejS) => {
                db.run(`DELETE FROM group_skills WHERE GroupID = ?`, [groupId], async (err) => {
                  if (err) return rejS(err);

                  if (data.skills && data.skills.length > 0) {
                    const stmt = db.prepare(`INSERT INTO group_skills (GroupID, SkillID) VALUES (?, ?)`);
                    for (const skillName of data.skills) {
                      await new Promise((resSkill, rejSkill) => {
                        db.get(`SELECT SkillID FROM skills WHERE SkillName = ?`, [skillName], (err, row) => {
                          if (err) return rejSkill(err);

                          if (row) {
                            stmt.run([groupId, row.SkillID], resSkill);
                          } else {
                            db.run(`INSERT INTO skills (SkillName) VALUES (?)`, [skillName], function(err) {
                              if (err) return rejSkill(err);
                              stmt.run([groupId, this.lastID], resSkill);
                            });
                          }
                        });
                      });
                    }
                    stmt.finalize(resS);
                  } else {
                    resS();
                  }
                });
              });

              // 5. Commit transaction
              db.run("COMMIT", (err) => {
                if (err) return reject(err);
                resolve();
              });

            } catch (innerErr) {
              db.run("ROLLBACK");
              reject(innerErr);
            }
          }
        );
      });
    });

    // Fetch the complete updated group data
    const updatedGroup = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM groups WHERE GroupID = ?', [groupId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.status(200).json({
      status: 'ok',
      groupId: groupId,
      group: updatedGroup,
      savedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update group',
      error: error.message
    });
  }
});



// DELETE /api/groups/:groupName - Delete a group by groupName
router.delete('/:groupName', async (req, res) => {
  const db = getDatabase();
  const groupName = decodeURIComponent(req.params.groupName);

  console.log('Received delete group request:', groupName);

  if (!groupName || groupName.trim() === '') {
    return res.status(400).json({
      status: 'error',
      message: 'Group name is required',
      error: { code: 'INVALID_GROUP_NAME', message: 'Group name cannot be empty' }
    });
  }

  try {
    // Check if allocation algorithm has been run
    const allocationRun = await checkAllocationStatus(db);
    if (allocationRun) {
      return res.status(409).json({
        status: 'error',
        message: 'Allocation results has generated, can\'t manage group',
        error: {
          code: 'ALLOCATION_RESULTS_GENERATED',
          message: 'Allocation results has generated, can\'t manage group'
        }
      });
    }
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // 1. Find the group first
        db.get('SELECT GroupID FROM groups WHERE GroupName = ?', [groupName], (err, row) => {
          if (err) {
            db.run("ROLLBACK");
            return reject(err);
          }

          if (!row) {
            db.run("ROLLBACK");
            return reject({ code: 'GROUP_NOT_FOUND', message: `Group "${groupName}" not found` });
          }

          const groupId = row.GroupID;

          // 2. Delete associated rows
          const deleteStatements = [
            `DELETE FROM group_members WHERE GroupID = ?`,
            `DELETE FROM group_preferences WHERE GroupID = ?`,
            `DELETE FROM group_skills WHERE GroupID = ?`,
            `DELETE FROM groups WHERE GroupID = ?`
          ];

          // Execute deletions sequentially
          (async () => {
            try {
              for (const stmt of deleteStatements) {
                await new Promise((resDel, rejDel) => {
                  db.run(stmt, [groupId], (err) => {
                    if (err) return rejDel(err);
                    resDel();
                  });
                });
              }

              // Commit transaction
              db.run("COMMIT", (err) => {
                if (err) return reject(err);
                resolve(groupId);
              });

            } catch (deleteErr) {
              db.run("ROLLBACK");
              reject(deleteErr);
            }
          })();
        });
      });
    });

    console.log(`Group "${groupName}" deleted successfully`);
    res.status(200).json({
      status: 'success',
      message: `Group "${groupName}" deleted successfully`,
      deletedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error deleting group:', error);
    if (error.code === 'GROUP_NOT_FOUND') {
      return res.status(404).json({
        status: 'error',
        message: error.message,
        error: { code: 'GROUP_NOT_FOUND', message: error.message }
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to delete group',
      error: { code: 'INTERNAL_SERVER_ERROR', message: error.message }
    });
  }
});

// POST /api/groups/by-name/:groupName/members - Add a member to group
router.post('/by-name/:groupName/members', async (req, res) => {
  const db = getDatabase();
  const groupName = decodeURIComponent(req.params.groupName);
  const memberData = req.body;

  try {
    // Check if allocation algorithm has been run
    const allocationRun = await checkAllocationStatus(db);
    if (allocationRun) {
      return res.status(409).json({
        status: 'error',
        message: 'Allocation results has generated, can\'t manage group',
        error: {
          code: 'ALLOCATION_RESULTS_GENERATED',
          message: 'Allocation results has generated, can\'t manage group'
        }
      });
    }

    // First find the group by name to get the ID
    const group = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM groups WHERE GroupName = ?', [groupName], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!group) {
      return res.status(404).json({
        error: { code: 'GROUP_NOT_FOUND', message: 'Group not found' }
      });
    }

    // Start transaction
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // 1. Update the grade count in groups table
        let updateField;
        switch(memberData.Grade) {
          case 'HD': updateField = 'NumStudentsHD'; break;
          case 'D': updateField = 'NumStudentsD'; break;
          case 'CR': updateField = 'NumStudentsCR'; break;
          case 'PS': updateField = 'NumStudentsP'; break;
          default:
            db.run("ROLLBACK");
            return reject(new Error('Invalid grade'));
        }

        db.run(
          `UPDATE groups SET ${updateField} = ${updateField} + 1 WHERE GroupID = ?`,
          [group.GroupID],
          function(err) {
            if (err) {
              db.run("ROLLBACK");
              return reject(err);
            }

            // 2. Get next available MemberOrder and reorder existing members if needed
            db.all(
              'SELECT MemberOrder FROM group_members WHERE GroupID = ? ORDER BY MemberOrder',
              [group.GroupID],
              (err, rows) => {
                if (err) {
                  db.run("ROLLBACK");
                  return reject(err);
                }

                // Find the first gap in the sequence or use next number
                let nextOrder = 1;
                const orders = rows.map(r => r.MemberOrder);
                for (let i = 0; i < orders.length; i++) {
                  if (orders[i] !== i + 1) {
                    nextOrder = i + 1;
                    break;
                  }
                }
                if (nextOrder === 1 && orders.length > 0) {
                  nextOrder = orders.length + 1;
                }

                // 3. Insert into group_members
                db.run(
                  `INSERT INTO group_members (
                    GroupID, StudentName, StudentID, UniKey, UnitOfStudy, MemberOrder, CreatedAt
                  ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [
                    group.GroupID,
                    memberData.StudentName,
                    memberData.StudentID,
                    memberData.UniKey,
                    memberData.UnitOfStudy,
                    nextOrder,
                    memberData.CreatedAt
                  ],
                  (err) => {
                    if (err) {
                      db.run("ROLLBACK");
                      return reject(err);
                    }

                    db.run("COMMIT", (err) => {
                      if (err) {
                        db.run("ROLLBACK");
                        return reject(err);
                      }
                      resolve();
                    });
                  }
                );
              }
            );
          }
        );
      });
    });

    res.status(200).json({
      status: 'success',
      message: 'Member added successfully',
      savedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add member',
      error: error.message
    });
  }
});

// DELETE /api/groups/by-name/:groupName/members - Delete a member from group
router.delete('/by-name/:groupName/members', async (req, res) => {
  const db = getDatabase();
  const groupName = decodeURIComponent(req.params.groupName);
  const memberData = req.body;

  try {
    // Check if allocation algorithm has been run
    const allocationRun = await checkAllocationStatus(db);
    if (allocationRun) {
      return res.status(409).json({
        status: 'error',
        message: 'Allocation results has generated, can\'t manage group',
        error: {
          code: 'ALLOCATION_RESULTS_GENERATED',
          message: 'Allocation results has generated, can\'t manage group'
        }
      });
    }

    // First find the group by name to get the ID and current counts
    const group = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM groups WHERE GroupName = ?', [groupName], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!group) {
      return res.status(404).json({
        error: { code: 'GROUP_NOT_FOUND', message: 'Group not found' }
      });
    }

    // Check if the member exists
    const member = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM group_members WHERE GroupID = ? AND StudentID = ?',
        [group.GroupID, memberData.StudentID],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!member) {
      return res.status(404).json({
        error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found in group' }
      });
    }

    // Start transaction
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // 1. Check and update the grade count in groups table
        let updateField;
        switch(memberData.Grade) {
          case 'HD': updateField = 'NumStudentsHD'; break;
          case 'D': updateField = 'NumStudentsD'; break;
          case 'CR': updateField = 'NumStudentsCR'; break;
          case 'PS': updateField = 'NumStudentsP'; break;
          default:
            db.run("ROLLBACK");
            return reject(new Error('Invalid grade'));
        }

        // Check if count is already 0
        if (group[updateField] <= 0) {
          db.run("ROLLBACK");
          return reject(new Error(`Cannot decrease ${updateField}, count is already 0`));
        }

        db.run(
          `UPDATE groups SET ${updateField} = ${updateField} - 1 WHERE GroupID = ?`,
          [group.GroupID],
          function(err) {
            if (err) {
              db.run("ROLLBACK");
              return reject(err);
            }

            // 2. Delete from group_members
            db.run(
              'DELETE FROM group_members WHERE GroupID = ? AND StudentID = ?',
              [group.GroupID, memberData.StudentID],
              (err) => {
                if (err) {
                  db.run("ROLLBACK");
                  return reject(err);
                }

                // 3. Reorder remaining members to ensure sequential order
                db.all(
                  'SELECT GroupID, MemberOrder FROM group_members WHERE GroupID = ? ORDER BY MemberOrder',
                  [group.GroupID],
                  (err, rows) => {
                    if (err) {
                      db.run("ROLLBACK");
                      return reject(err);
                    }

                    // Update all member orders to be sequential
                    const updatePromises = rows.map((row, index) => {
                      return new Promise((resolveUpdate, rejectUpdate) => {
                        db.run(
                          'UPDATE group_members SET MemberOrder = ? WHERE GroupID = ? AND MemberOrder = ?',
                          [index + 1, group.GroupID, row.MemberOrder],
                          (err) => {
                            if (err) rejectUpdate(err);
                            else resolveUpdate();
                          }
                        );
                      });
                    });

                    Promise.all(updatePromises)
                      .then(() => {
                        db.run("COMMIT", (err) => {
                          if (err) {
                            db.run("ROLLBACK");
                            return reject(err);
                          }
                          resolve();
                        });
                      })
                      .catch(err => {
                        db.run("ROLLBACK");
                        reject(err);
                      });
                  }
                );
              }
            );
          }
        );
      });
    });

    res.status(200).json({
      status: 'success',
      message: 'Member deleted successfully',
      savedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error deleting member:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete member',
      error: error.message
    });
  }
});

module.exports = router;