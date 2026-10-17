const express = require('express');
const router = express.Router();
const { validateSchema, projectSchema } = require('../validation/schemas');
const { getDatabase, runAsync, getAsync, allAsync, runInTransaction } = require('../database/init');

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



// Normalize incoming project id (numeric or string) to DB key format like "P02"
function normalizeProjectId(input) {
  if (input == null) return input;
  const s = String(input).trim();
  if (s.toUpperCase().startsWith('P')) return s;
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) return s;
  return `P${String(n).padStart(2, '0')}`;
}

// Apply validation middleware only to POST routes
router.post('/', validateSchema(projectSchema));



// POST /api/projects - Create a new project
router.post('/', async (req, res) => {
  const db = getDatabase();
  const projectData = req.body;

  console.log('Received new project form');
  console.log('Request received at:', new Date().toISOString());
  console.log('Received project data:', JSON.stringify(projectData, null, 2));
  console.log('  - resourcesProvided:', projectData.resourcesProvided);
  console.log('  - tags:', projectData.tags);
  console.log('  - generalFields:', projectData.generalFields);

  try {
    // Check if allocation algorithm has been run
    const allocationRun = await checkAllocationStatus(db);
    if (allocationRun) {
      return res.status(409).json({
        status: 'error',
        message: 'Allocation results has generated, can\'t manage project',
        error: {
          code: 'ALLOCATION_RESULTS_GENERATED',
          message: 'Allocation results has generated, can\'t manage project'
        }
      });
    }
    // Use provided projectId (numeric or string), normalize to DB key; fallback to generated if missing
    const providedRaw = projectData.projectId || projectData.projectid || `P${Date.now()}`;
    const providedId = normalizeProjectId(providedRaw);

    await runInTransaction(async (txDb) => {
      // 1) Check duplicate ID
      const existing = await new Promise((resolve, reject) => {
        txDb.get('SELECT 1 FROM projects WHERE ProjectID = ?', [providedId], (err, row) => {
          if (err) reject(err); else resolve(row);
        });
      });
      if (existing) {
        const e = new Error(`PROJECT_ID_CONFLICT: ${providedId}`);
        e.statusCode = 409;
        throw e;
      }

      // 2) Check duplicate Name
      const nameExists = await new Promise((resolve, reject) => {
        txDb.get('SELECT 1 FROM projects WHERE ProjectName = ?', [projectData.projectName], (err, row) => {
          if (err) reject(err); else resolve(row);
        });
      });
      if (nameExists) {
        const e = new Error(`PROJECT_NAME_CONFLICT: ${projectData.projectName}`);
        e.statusCode = 409;
        throw e;
      }

      // 3) Insert after all validations
      const values = [
        providedId,
        projectData.projectName,
        projectData.client || '',
        parseInt(String(projectData.maxGroups)) || 1,
        projectData.description || '',
        projectData.deliverables || '',
        projectData.specificSkills || '',
        projectData.generalFields || '',
        projectData.resourcesProvided || '',
        JSON.stringify(projectData.tags || []),
        projectData.startTime || '',
        projectData.finishTime || ''
      ];

      await new Promise((resolve, reject) => {
        txDb.run(
          `INSERT INTO projects 
           (ProjectID, ProjectName, ProjectClient, ProjectCapacity, 
            ProjectDescription, ExpectedOutcomes, RequiredSkills, RelatedFields, 
            ProvidedResources, Tags, StartTime, FinishTime) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values,
          function (err) { if (err) reject(err); else resolve(this.lastID); }
        );
      });
    });

    console.log(`Project "${projectData.projectName}" created successfully`);

    // Return numeric projectID only, matching frontend expectation
    const numericMatch = /^P(\d+)/i.exec(providedId);
    const projectID = numericMatch ? parseInt(numericMatch[1], 10) : undefined;

    res.status(201).json({
      status: 'success',
      message: `Project "${projectData.projectName}" created successfully`,
      projectID: projectID,
      savedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error creating project:', error);
    const status = error.statusCode || 500;
    const code = status === 409 ? 'CONFLICT' : 'INTERNAL_SERVER_ERROR';
    res.status(status).json({
      status: 'error',
      message: 'Failed to create project - internal server error',
      error: {
        code: code,
        message: error.message || 'Failed to create project'
      }
    });
  }
});



// GET /api/projects - Get all projects
router.get('/', async (req, res) => {
  const db = getDatabase();

  try {
    const projects = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM projects ORDER BY CreatedAt DESC',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Format each project
    const formattedProjects = await Promise.all(projects.map(async (project) => {
      const {
        ProjectID,
        ProjectName,
        ProjectClient,
        ProjectCapacity,
        ProjectDescription,
        ExpectedOutcomes,
        RequiredSkills,
        RelatedFields,
        ProvidedResources,
        Tags,
        StartTime,
        FinishTime,
        CreatedAt,
        UpdatedAt
      } = project;

      // Fetch allocated groups for this project from results table
      const allocatedGroups = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            g.GroupID,
            g.GroupName,
            r.Score,
            r.PreferenceRank
           FROM results r
           JOIN groups g ON r.GroupID = g.GroupID
           WHERE r.ProjectID = ?
           ORDER BY r.PreferenceRank ASC`,
          [ProjectID],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      // Also check groups table for any direct allocations (backward compatibility)
      const directAllocatedGroups = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            GroupID,
            GroupName
           FROM groups 
           WHERE allocated_project = ?`,
          [ProjectID],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      // Combine both allocation methods and remove duplicates
      const allAllocatedGroups = [...allocatedGroups];
      directAllocatedGroups.forEach(directGroup => {
        if (!allAllocatedGroups.some(group => group.GroupID === directGroup.GroupID)) {
          allAllocatedGroups.push({
            GroupID: directGroup.GroupID,
            GroupName: directGroup.GroupName,
            Score: null,
            PreferenceRank: null
          });
        }
      });

      // Extract just group names for the response
      const groupNames = allAllocatedGroups.map(group => group.GroupName);

      return {
        projectId: ProjectID,
        projectName: ProjectName,
        client: ProjectClient,
        maxGroups: ProjectCapacity,
        description: ProjectDescription,
        deliverables: ExpectedOutcomes,
        specificSkills: RequiredSkills,
        generalFields: RelatedFields || '',
        resourcesProvided: ProvidedResources,
        tags: Tags ? JSON.parse(Tags) : [],
        startTime: StartTime || '',
        finishTime: FinishTime || '',
        groupname: groupNames,
        allocatedGroups: allAllocatedGroups,
        allocationCount: allAllocatedGroups.length,
        remainingCapacity: Math.max(0, ProjectCapacity - allAllocatedGroups.length)
      };
    }));

    // Add debug logging
    console.log('Projects API - Returning projects with allocation data:');
    console.log('Total projects:', formattedProjects.length);
    formattedProjects.forEach(project => {
      console.log(`Project: ${project.projectName}, Allocated groups: ${project.groupname.join(', ') || 'None'}`);
    });

    res.json(formattedProjects);

  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch projects'
      }
    });
  }
});



// GET /api/projects/:projectId - Get a specific project by ID
router.get('/:projectId', async (req, res) => {
  const db = getDatabase();
  const projectId = normalizeProjectId(req.params.projectId);

  if (!projectId || projectId.trim() === '') {
    return res.status(400).json({
      error: {
        code: 'INVALID_PROJECT_ID',
        message: 'Project ID cannot be empty'
      }
    });
  }

  try {
    const project = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM projects WHERE ProjectID = ?',
        [projectId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!project) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: `Project with ID "${projectId}" not found`
        }
      });
    }

    // Fetch allocated groups for this project from results table
    const allocatedGroups = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          g.GroupID,
          g.GroupName,
          r.Score,
          r.PreferenceRank
         FROM results r
         JOIN groups g ON r.GroupID = g.GroupID
         WHERE r.ProjectID = ?
         ORDER BY r.PreferenceRank ASC`,
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Also check groups table for any direct allocations
    const directAllocatedGroups = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          GroupID,
          GroupName
         FROM groups 
         WHERE allocated_project = ?`,
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Combine both allocation methods and remove duplicates
    const allAllocatedGroups = [...allocatedGroups];
    directAllocatedGroups.forEach(directGroup => {
      if (!allAllocatedGroups.some(group => group.GroupID === directGroup.GroupID)) {
        allAllocatedGroups.push({
          GroupID: directGroup.GroupID,
          GroupName: directGroup.GroupName,
          Score: null,
          PreferenceRank: null
        });
      }
    });

    // Extract just group names for the groupname field
    const groupNames = allAllocatedGroups.map(group => group.GroupName);

    // Map DB fields → frontend fields
    const responseData = {
      projectId: project.ProjectID,
      projectName: project.ProjectName,
      client: project.ProjectClient,
      maxGroups: project.ProjectCapacity,
      description: project.ProjectDescription,
      deliverables: project.ExpectedOutcomes,
      specificSkills: project.RequiredSkills,
      generalFields: project.RelatedFields || '',
      resourcesProvided: project.ProvidedResources,
      tags: project.Tags ? JSON.parse(project.Tags) : [],
      startTime: project.StartTime || '',
      finishTime: project.FinishTime || '',
      createdAt: project.CreatedAt,
      updatedAt: project.UpdatedAt,
      groupname: groupNames,
      allocatedGroups: allAllocatedGroups,
      allocationCount: allAllocatedGroups.length,
      remainingCapacity: Math.max(0, project.ProjectCapacity - allAllocatedGroups.length)
    };

    console.log(`Fetched project: ${project.ProjectName}`);
    console.log(`   - Allocated groups: ${groupNames.join(', ') || 'None'}`);
    console.log(`   - Capacity: ${allAllocatedGroups.length}/${project.ProjectCapacity}`);

    res.json(responseData);

  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch project'
      }
    });
  }
});



// PUT /api/projects/:projectId - Update a project by ID
router.put('/:projectId', async (req, res) => {
  const db = getDatabase();
  const projectId = normalizeProjectId(req.params.projectId);
  const projectData = req.body;

  console.log('Edit project request received for ID:', projectId);

  if (!projectId || projectId.trim() === '') {
    return res.status(400).json({
      error: {
        code: 'INVALID_PROJECT_ID',
        message: 'Project ID cannot be empty'
      }
    });
  }

  try {
    // Check if allocation algorithm has been run
    const allocationRun = await checkAllocationStatus(db);
    if (allocationRun) {
      return res.status(409).json({
        status: 'error',
        message: 'Allocation results has generated, can\'t manage project',
        error: {
          code: 'ALLOCATION_RESULTS_GENERATED',
          message: 'Allocation results has generated, can\'t manage project'
        }
      });
    }

    // Check if project exists
    const existingProject = await new Promise((resolve, reject) => {
      db.get('SELECT ProjectID FROM projects WHERE ProjectID = ?', [projectId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!existingProject) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    // Check for name conflict if renaming
    if (projectData.projectName) {
      const nameConflict = await new Promise((resolve, reject) => {
        db.get('SELECT ProjectID FROM projects WHERE ProjectName = ? AND ProjectID != ?', [projectData.projectName, projectId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (nameConflict) {
        return res.status(409).json({
          error: {
            code: 'PROJECT_NAME_CONFLICT',
            message: 'Project name already exists'
          }
        });
      }
    }

    // Update in transaction with validation (e.g., unique name)
    const result = await runInTransaction(async (txDb) => {
      if (projectData.projectName) {
        const nameConflict = await new Promise((resolve, reject) => {
          txDb.get('SELECT ProjectID FROM projects WHERE ProjectName = ? AND ProjectID != ?', [projectData.projectName, projectId], (err, row) => {
            if (err) reject(err); else resolve(row);
          });
        });
        if (nameConflict) {
          const e = new Error('PROJECT_NAME_CONFLICT');
          e.statusCode = 409;
          throw e;
        }
      }

      const updateQuery = `
        UPDATE projects SET
          ProjectName = ?,
          ProjectClient = ?,
          ProjectCapacity = ?,
          ProjectDescription = ?,
          ExpectedOutcomes = ?,
          RequiredSkills = ?,
          RelatedFields = ?,
          ProvidedResources = ?,
          Tags = ?,
          StartTime = ?,
          FinishTime = ?,
          UpdatedAt = CURRENT_TIMESTAMP
        WHERE ProjectID = ?
      `;

      const values = [
        projectData.projectName || null,
        projectData.client || null,
        parseInt(String(projectData.maxGroups)) || null,
        projectData.description || null,
        projectData.deliverables || null,
        projectData.specificSkills || null,
        projectData.generalFields || null,
        projectData.resourcesProvided || null,
        JSON.stringify(projectData.tags || []),
        projectData.startTime || null,
        projectData.finishTime || null,
        projectId
      ];

      return await new Promise((resolve, reject) => {
        txDb.run(updateQuery, values, function(err) {
          if (err) reject(err); else resolve({ changes: this.changes });
        });
      });
    });

    if (result.changes === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    // Fetch updated project
    const updatedProject = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM projects WHERE ProjectID = ?', [projectId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Fetch allocated groups (same logic as GET route)
    const allocatedGroups = await new Promise((resolve, reject) => {
      db.all(
        `SELECT g.GroupName
        FROM results r
        JOIN groups g ON r.GroupID = g.GroupID
        WHERE r.ProjectID = ?
        UNION
        SELECT GroupName
        FROM groups 
        WHERE allocated_project = ?`,
        [projectId, projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.GroupName));
        }
      );
    });

    const responseData = {
      projectId: updatedProject.ProjectID,
      projectName: updatedProject.ProjectName,
      client: updatedProject.ProjectClient,
      maxGroups: updatedProject.ProjectCapacity,
      description: updatedProject.ProjectDescription,
      deliverables: updatedProject.ExpectedOutcomes,
      specificSkills: updatedProject.RequiredSkills,
      generalFields: updatedProject.RelatedFields || '',
      resourcesProvided: updatedProject.ProvidedResources,
      tags: updatedProject.Tags ? JSON.parse(updatedProject.Tags) : [],
      startTime: updatedProject.StartTime || '',
      finishTime: updatedProject.FinishTime || '',
      projectId: updatedProject.ProjectID
    };

    res.json({
      status: 'success',
      projectId: updatedProject.ProjectID,
      data: responseData,
      savedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating project:', error);
    const status = error.statusCode || 500;
    const code = status === 409 ? 'CONFLICT' : 'INTERNAL_SERVER_ERROR';
    res.status(status).json({
      error: {
        code: code,
        message: error.message || 'Failed to update project'
      }
    });
  }
});



// DELETE /api/projects/:projectId - Delete a project by ID
router.delete('/:projectId', async (req, res) => {
  const db = getDatabase();
  const projectId = normalizeProjectId(req.params.projectId);

  console.log('Delete request received at:', new Date().toISOString());
  console.log('Project ID to delete:', projectId);

  if (!projectId || projectId.trim() === '') {
    return res.status(400).json({
      status: 'error',
      message: 'Project ID is required',
      error: {
        code: 'INVALID_PROJECT_ID',
        message: 'Project ID cannot be empty'
      }
    });
  }

  try {
    // Check if allocation algorithm has been run
    const allocationRun = await checkAllocationStatus(db);
    if (allocationRun) {
      return res.status(409).json({
        status: 'error',
        message: 'Allocation results has generated, can\'t manage project',
        error: {
          code: 'ALLOCATION_RESULTS_GENERATED',
          message: 'Allocation results has generated, can\'t manage project'
        }
      });
    }
    const existingProject = await new Promise((resolve, reject) => {
      db.get('SELECT ProjectID, ProjectName FROM projects WHERE ProjectID = ?', [projectId], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });

    if (!existingProject) {
      return res.status(404).json({
        status: 'error',
        message: `Project with ID "${projectId}" not found`,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: `Project with ID "${projectId}" not found`
        }
      });
    }

    await runInTransaction(async (txDb) => {
      // Example: also clean up any direct allocations (optional policy)
      await new Promise((resolve, reject) => {
        txDb.run('UPDATE groups SET allocated_project = NULL WHERE allocated_project = ?', [projectId], function(err) {
          if (err) reject(err); else resolve(this);
        });
      });

      await new Promise((resolve, reject) => {
        txDb.run('DELETE FROM projects WHERE ProjectID = ?', [projectId], function(err) {
          if (err) reject(err); else resolve({ changes: this.changes });
        });
      });
    });

    console.log(`Project "${existingProject.ProjectName}" deleted successfully (ID: ${existingProject.ProjectID})`);

    res.status(200).json({
      status: 'success',
      message: `Project "${existingProject.ProjectName}" deleted successfully`,
      deletedProject: {
        projectId: existingProject.ProjectID,
        projectName: existingProject.ProjectName
      },
      deletedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete project - internal server error',
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete project'
      }
    });
  }
});



// POST /api/projects/assign-group - Assign a group to a project
router.post('/assign-group', async (req, res) => {
  const db = getDatabase();
  const { projectId: projectIdRaw, groupName } = req.body;
  const projectId = normalizeProjectId(projectIdRaw);

  console.log('Received assign group request:', { projectId, groupName });

  // Basic parameter validation
  if (!projectId || !groupName) {
    return res.status(400).json({
      status: 'error',
      message: 'Both projectId and groupName are required',
      error: {
        code: 'MISSING_PARAMETERS',
        message: 'Both projectId and groupName are required'
      }
    });
  }

  try {
    // 1. Verify project exists
    const project = await new Promise((resolve, reject) => {
      db.get('SELECT ProjectID, ProjectName FROM projects WHERE ProjectID = ?', [projectId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: `Project with ID "${projectId}" not found`,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: `Project with ID "${projectId}" not found`
        }
      });
    }

    // 2. Verify group exists
    const group = await new Promise((resolve, reject) => {
      db.get('SELECT GroupID, GroupName FROM groups WHERE GroupName = ?', [groupName], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!group) {
      return res.status(404).json({
        status: 'error',
        message: `Group "${groupName}" not found`,
        error: {
          code: 'GROUP_NOT_FOUND',
          message: `Group "${groupName}" not found`
        }
      });
    }

    // 3. Check if group is already assigned to a project
    const currentAssignment = await new Promise((resolve, reject) => {
      db.get('SELECT allocated_project FROM groups WHERE GroupID = ?', [group.GroupID], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (currentAssignment && currentAssignment.allocated_project) {
      return res.status(409).json({
        status: 'error',
        message: `Group "${groupName}" is already assigned to project ${currentAssignment.allocated_project}`,
        error: {
          code: 'GROUP_ALREADY_ASSIGNED',
          message: `Group is already assigned to another project`
        }
      });
    }

    // 4. Check project capacity (optional - if you want to enforce limits)
    const assignedGroupsCount = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM groups WHERE allocated_project = ?',
        [projectId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    const projectCapacity = await new Promise((resolve, reject) => {
      db.get(
        'SELECT ProjectCapacity FROM projects WHERE ProjectID = ?',
        [projectId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.ProjectCapacity : 1);
        }
      );
    });

    if (assignedGroupsCount >= projectCapacity) {
      return res.status(409).json({
        status: 'error',
        message: `Project "${project.ProjectName}" has reached its maximum capacity of ${projectCapacity} groups`,
        error: {
          code: 'PROJECT_CAPACITY_FULL',
          message: 'Project has reached maximum group capacity'
        }
      });
    }

    // 5. Assign group to project (update both groups and results tables)
    await runInTransaction(async (txDb) => {
      // Update groups table with project name
      await new Promise((resolve, reject) => {
        txDb.run(
          'UPDATE groups SET allocated_project = ? WHERE GroupID = ?',
          [project.ProjectName, group.GroupID],
          function(err) {
            if (err) reject(err);
            else resolve(this);
          }
        );
      });

      // Insert into results table
      await new Promise((resolve, reject) => {
        txDb.run(
          'INSERT OR REPLACE INTO results (GroupID, ProjectID, Score, PreferenceRank) VALUES (?, ?, NULL, NULL)',
          [group.GroupID, projectId],
          function(err) {
            if (err) reject(err);
            else resolve(this);
          }
        );
      });
    });

    console.log(`Successfully assigned group "${groupName}" to project ${projectId}`);

    res.status(200).json({
      status: 'success',
      message: `Group "${groupName}" assigned to project "${project.ProjectName}" successfully`,
      projectId: projectId,
      projectName: project.ProjectName,
      groupName: groupName,
      groupId: group.GroupID,
      savedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error assigning group to project:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to assign group to project - internal server error',
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message
      }
    });
  }
});

// POST /api/projects/remove-group - Remove a group from a project
router.post('/remove-group', async (req, res) => {
  const db = getDatabase();
  const { projectId: projectIdRaw, groupName } = req.body;
  const projectId = normalizeProjectId(projectIdRaw);

  console.log('Received remove group request:', { projectId, groupName });

  // Basic parameter validation
  if (!projectId || !groupName) {
    return res.status(400).json({
      status: 'error',
      message: 'Both projectId and groupName are required',
      error: {
        code: 'MISSING_PARAMETERS',
        message: 'Both projectId and groupName are required'
      }
    });
  }

  try {
    // 1. Verify project exists
    const project = await new Promise((resolve, reject) => {
      db.get('SELECT ProjectID, ProjectName FROM projects WHERE ProjectID = ?', [projectId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: `Project with ID "${projectId}" not found`,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: `Project with ID "${projectId}" not found`
        }
      });
    }

    // 2. Verify group exists
    const group = await new Promise((resolve, reject) => {
      db.get('SELECT GroupID, GroupName FROM groups WHERE GroupName = ?', [groupName], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!group) {
      return res.status(404).json({
        status: 'error',
        message: `Group "${groupName}" not found`,
        error: {
          code: 'GROUP_NOT_FOUND',
          message: `Group "${groupName}" not found`
        }
      });
    }

    // 3. Check if group is actually assigned to this project
    const currentAssignment = await new Promise((resolve, reject) => {
      db.get('SELECT allocated_project FROM groups WHERE GroupID = ?', [group.GroupID], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!currentAssignment || currentAssignment.allocated_project !== project.ProjectName) {
      return res.status(409).json({
        status: 'error',
        message: `Group "${groupName}" is not assigned to project "${project.ProjectName}"`,
        error: {
          code: 'GROUP_NOT_ASSIGNED',
          message: `Group is not assigned to this project`
        }
      });
    }

    // 4. Remove group from project (update both groups and results tables)
    await runInTransaction(async (txDb) => {
      // Clear allocated_project in groups table
      await new Promise((resolve, reject) => {
        txDb.run(
          'UPDATE groups SET allocated_project = NULL WHERE GroupID = ?',
          [group.GroupID],
          function(err) {
            if (err) reject(err);
            else resolve(this);
          }
        );
      });

      // Remove from results table
      await new Promise((resolve, reject) => {
        txDb.run(
          'DELETE FROM results WHERE GroupID = ? AND ProjectID = ?',
          [group.GroupID, projectId],
          function(err) {
            if (err) reject(err);
            else resolve(this);
          }
        );
      });
    });

    console.log(`Successfully removed group "${groupName}" from project ${projectId}`);

    res.status(200).json({
      status: 'success',
      message: `Group "${groupName}" removed from project "${project.ProjectName}" successfully`,
      projectId: projectId,
      projectName: project.ProjectName,
      groupName: groupName,
      groupId: group.GroupID,
      savedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error removing group from project:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to remove group from project - internal server error',
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message
      }
    });
  }
});

module.exports = router;
