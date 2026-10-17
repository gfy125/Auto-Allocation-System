const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const Joi = require('joi');

const router = express.Router();

// Database path
const DB_PATH = path.join(__dirname, '../../../student_project.db');
const CONFIG_PATH = path.join(__dirname, '../../../config.yml');

// Weight validation schema
const weightSchema = Joi.object({
  weight: Joi.number().min(0.0).max(1.0).required()
});

// Global weight state (in real applications should be stored in database or config file)
let currentWeights = {
  skillWeight: 0.4,
  scoreWeight: 0.4,
  descriptionWeight: 0.2
};

// Python environment detection and caching
let detectedPythonCommand = null;

/**
 * Adaptive detection of available Python command
 * Priority: virtual environment > python > python3
 */
function detectPythonCommand() {
  if (detectedPythonCommand) {
    return detectedPythonCommand;
  }

  const projectRoot = path.join(__dirname, '../../../');
  const possibleCommands = [
    // 1. Check virtual environment (common virtual environment paths)
    path.join(projectRoot, 'venv/bin/python'),
    path.join(projectRoot, '.venv/bin/python'),
    path.join(projectRoot, 'env/bin/python'),

    path.join(projectRoot, 'venv/Scripts/python.exe'),
    path.join(projectRoot, '.venv/Scripts/python.exe'),
    path.join(projectRoot, 'env/Scripts/python.exe'),

    'python',

    'python3',
    'py'
  ];

  for (const cmd of possibleCommands) {
    try {
      // Test if command is available
      const isAbs = path.isAbsolute(cmd) && fs.existsSync(cmd);
      const testCommand = isAbs ? `"${cmd}"` : cmd;
      execSync(`${testCommand} --version`, { 
        stdio: 'pipe',
        timeout: 2000
      });
      console.log(`✅ Detected Python command: ${cmd}`);
      detectedPythonCommand = isAbs ? cmd : testCommand;
      return detectedPythonCommand;
    } catch (err) {
      // Continue trying next command
      continue;
    }
  }

  // If all failed, default to python3 and log warning
  console.warn('⚠️  No Python command detected, defaulting to python3');
  detectedPythonCommand = 'python3';
  return detectedPythonCommand;
}

/**
 * Reset Python command cache (for environment changes)
 */
function resetPythonCommand() {
  detectedPythonCommand = null;
}

// 0. Get Python environment information
router.get('/python-info', (req, res) => {
  try {
    const pythonCmd = detectPythonCommand();
    let version = 'Unknown';
    
    try {
      version = execSync(`${pythonCmd} --version`, { 
        encoding: 'utf8',
        timeout: 2000 
      }).trim();
    } catch (err) {
      version = 'Unable to detect version';
    }

    res.json({
      success: true,
      pythonCommand: pythonCmd,
      pythonVersion: version,
      isVirtualEnv: pythonCmd.includes('venv') || pythonCmd.includes('env'),
      projectRoot: path.join(__dirname, '../../../')
    });
  } catch (err) {
    console.error('Error getting Python info:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get Python environment information'
    });
  }
});

// 0b. Reset Python environment detection
router.post('/python-reset', (req, res) => {
  try {
    resetPythonCommand();
    const newPythonCmd = detectPythonCommand();
    
    res.json({
      success: true,
      message: 'Python environment detection reset successfully',
      newPythonCommand: newPythonCmd
    });
  } catch (err) {
    console.error('Error resetting Python detection:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to reset Python detection'
    });
  }
});

// 1. Update skill weight
router.post('/weights/skill', async (req, res) => {
  try {
    const { error, value } = weightSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Weight must be between 0.0 and 1.0'
      });
    }

    currentWeights.skillWeight = value.weight;
    
    res.json({
      success: true,
      message: 'Skill weight updated successfully',
      currentWeights: currentWeights
    });
  } catch (err) {
    console.error('Error updating skill weight:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update skill weight'
    });
  }
});

// 2. Update score weight
router.post('/weights/score', async (req, res) => {
  try {
    const { error, value } = weightSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Weight must be between 0.0 and 1.0'
      });
    }

    currentWeights.scoreWeight = value.weight;
    
    res.json({
      success: true,
      message: 'Score weight updated successfully',
      currentWeights: currentWeights
    });
  } catch (err) {
    console.error('Error updating score weight:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update score weight'
    });
  }
});

// 3. Update description weight
router.post('/weights/description', async (req, res) => {
  try {
    const { error, value } = weightSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Weight must be between 0.0 and 1.0'
      });
    }

    currentWeights.descriptionWeight = value.weight;
    
    res.json({
      success: true,
      message: 'Description weight updated successfully',
      currentWeights: currentWeights
    });
  } catch (err) {
    console.error('Error updating description weight:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update description weight'
    });
  }
});

// 3.1 Get current weights (read from config.yml)
router.get('/weights', async (req, res) => {
  try {
    ensureDefaultConfig();
    const content = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config = parseSimpleYaml(content);
    
    // Read weights from config file
    const weights = {
      skillWeight: config.skillWeight || 0.4,
      scoreWeight: config.scoreWeight || 0.4,
      descriptionWeight: config.descriptionWeight || 0.2
    };

    // Update in-memory weights
    currentWeights = weights;

    res.json({
      success: true,
      message: 'Current weights retrieved successfully',
      currentWeights: weights
    });
  } catch (err) {
    console.error('Error getting weights:', err);
    res.status(500).json({ success: false, message: 'Failed to get weights' });
  }
});

// ===== Config.yml read/write =====

function ensureDefaultConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const defaultConfig = `# Application base configuration\n` +
`secretKey: dev-secret-key-change-in-production\n` +
`databaseUri: sqlite:///allocation.db\n` +
`rateLimitMax: 100\n` +
`maxContentLength: 16777216\n` +
`uploadFolder: uploads\n` +
`sessionLifetime: 2\n` +
`itemsPerPage: 10\n` +
`# Allocation engine weights (hot-reload via API)\n` +
`skillWeight: ${currentWeights.skillWeight}\n` +
`scoreWeight: ${currentWeights.scoreWeight}\n` +
`descriptionWeight: ${currentWeights.descriptionWeight}\n` +
`minGroupSize: 3\n` +
`maxGroupSize: 7\n` +
`debug: true\n` +
`sqlalchemyEcho: true\n` +
`# Ports\n` +
`frontendPort: 5175\n` +
`backendPort: 3001\n`;
    fs.writeFileSync(CONFIG_PATH, defaultConfig, 'utf8');
  }
}

function parseSimpleYaml(content) {
  const lines = content.split(/\r?\n/);
  const obj = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (value === '') { obj[key] = ''; continue; }
    // convert number / boolean
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      obj[key] = Number(value);
    } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
      obj[key] = value.toLowerCase() === 'true';
    } else {
      // strip quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
        value = value.slice(1, -1);
      }
      obj[key] = value;
    }
  }
  return obj;
}

function stringifySimpleYaml(obj) {
  const order = [
    'secretKey','databaseUri','rateLimitMax','maxContentLength','uploadFolder','sessionLifetime','itemsPerPage',
    'skillWeight','scoreWeight','descriptionWeight','minGroupSize','maxGroupSize','debug','sqlalchemyEcho',
    'frontendPort','backendPort'
  ];
  const lines = ['# Application base configuration'];
  for (const key of order) {
    if (obj[key] === undefined) continue;
    let value = obj[key];
    if (typeof value === 'string') {
      // quote if contains spaces or special chars
      if (/[^A-Za-z0-9_\-./:@]/.test(value)) {
        value = '"' + value.replace(/"/g, '\\"') + '"';
      }
    }
    lines.push(`${key}: ${value}`);
  }
  return lines.join('\n') + '\n';
}

// GET /api/allocation/config - read config.yml
router.get('/config', async (req, res) => {
  try {
    ensureDefaultConfig();
    const content = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config = parseSimpleYaml(content);
    res.json({ success: true, message: 'Configuration retrieved successfully', config });
  } catch (err) {
    console.error('Error reading config.yml:', err);
    res.status(500).json({ success: false, message: 'Failed to read configuration' });
  }
});

// POST /api/allocation/config - write config.yml (partial or all fields)
router.post('/config', async (req, res) => {
  try {
    ensureDefaultConfig();
    const current = parseSimpleYaml(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const next = { ...current, ...(req.body || {}) };

    // Update in-memory weights if provided for hot reload
    if (typeof next.skillWeight === 'number') currentWeights.skillWeight = next.skillWeight;
    if (typeof next.scoreWeight === 'number') currentWeights.scoreWeight = next.scoreWeight;
    if (typeof next.descriptionWeight === 'number') currentWeights.descriptionWeight = next.descriptionWeight;

    const yaml = stringifySimpleYaml(next);
    fs.writeFileSync(CONFIG_PATH, yaml, 'utf8');

    const portHints = {
      frontendPortChanged: current.frontendPort !== next.frontendPort,
      backendPortChanged: current.backendPort !== next.backendPort
    };

    res.json({ success: true, message: 'Configuration saved', ...portHints, config: next });
  } catch (err) {
    console.error('Error writing config.yml:', err);
    res.status(500).json({ success: false, message: 'Failed to save configuration' });
  }
});


// Helper function to get reset count
async function getResetCount() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    db.get("SELECT COUNT(*) as count FROM groups", (err, row) => {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve(row.count);
      }
    });
  });
}

// NOTE: legacy '/results' and '/unallocated' endpoints have been superseded by '/report'.

// 7. Generate comprehensive report (combines results with unallocated and provides analytics)
router.get('/report', async (req, res) => {
  try {
    const db = new sqlite3.Database(DB_PATH);

    // 1) Basic allocation results (extended with more fields)
    const results = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          r.GroupID as groupId,
          r.ProjectID as projectId,
          r.Score as score,
          r.PreferenceRank as preferenceRank,
          g.GroupName as groupName,
          g.NumStudentsHD as numStudentsHD,
          g.NumStudentsD as numStudentsD,
          g.NumStudentsCR as numStudentsCR,
          g.NumStudentsP as numStudentsP,
          g.GroupDescription as groupDescription,
          p.ProjectName as projectName,
          p.ProjectDescription as projectDescription,
          p.ExpectedOutcomes as expectedOutcomes,
          p.RequiredSkills as requiredSkills,
          ds.DescSim as descSim
        FROM results r
        JOIN groups g ON r.GroupID = g.GroupID
        JOIN projects p ON r.ProjectID = p.ProjectID
        LEFT JOIN description_similarities ds ON r.GroupID = ds.GroupID AND r.ProjectID = ds.ProjectID
        ORDER BY r.GroupID
      `, (err, rows) => err ? reject(err) : resolve(rows));
    });

    // 1.5) Get all group member information
    const groupMembersRows = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          gm.GroupID as groupId,
          gm.StudentName as studentName,
          gm.StudentID as studentId,
          gm.UniKey as uniKey,
          gm.UnitOfStudy as unitOfStudy,
          gm.MemberOrder as memberOrder
        FROM group_members gm
        ORDER BY gm.GroupID, gm.MemberOrder
      `, (err, rows) => err ? reject(err) : resolve(rows));
    });

    // Organize member data by GroupID
    const groupMembersMap = {};
    for (const member of groupMembersRows) {
      if (!groupMembersMap[member.groupId]) {
        groupMembersMap[member.groupId] = [];
      }
      groupMembersMap[member.groupId].push({
        studentName: member.studentName,
        studentId: member.studentId,
        uniKey: member.uniKey,
        unitOfStudy: member.unitOfStudy,
        memberOrder: member.memberOrder
      });
    }

    // Get group skills (needed before calculating skill matching)
    const groupSkillsRows = await new Promise((resolve, reject) => {
      db.all(`
        SELECT gs.GroupID, s.SkillName
        FROM group_skills gs
        JOIN skills s ON gs.SkillID = s.SkillID
      `, (err, rows) => err ? reject(err) : resolve(rows));
    });
    const groupSkillsMap = {};
    for (const r of groupSkillsRows) {
      if (!groupSkillsMap[r.GroupID]) groupSkillsMap[r.GroupID] = new Set();
      groupSkillsMap[r.GroupID].add(r.SkillName);
    }

    // 计算每个结果的 skill matching (需要先获取 project tags map)
    const projectTagsForResults = await new Promise((resolve, reject) => {
      db.all(`SELECT ProjectID, COALESCE(Tags, '[]') AS tags FROM projects`, (err, rows) => err ? reject(err) : resolve(rows));
    });
    const projectTagsMap = {};
    for (const r of projectTagsForResults) {
      let arr = [];
      try { arr = JSON.parse(r.tags || '[]'); } catch (_) { arr = []; }
      projectTagsMap[r.ProjectID] = new Set(arr.map(t => String(t || '').trim()).filter(Boolean));
    }

    // 将成员信息、skill matching、以及skills/tags数组附加到每个结果中
    const resultsWithMembers = results.map(r => {
      const groupSkills = groupSkillsMap[r.groupId] || new Set();
      const projectTags = projectTagsMap[r.projectId] || new Set();
      
      let skillMatch = null;
      if (groupSkills.size > 0 && projectTags.size > 0) {
        const intersection = new Set([...groupSkills].filter(x => projectTags.has(x)));
        const union = new Set([...groupSkills, ...projectTags]);
        skillMatch = union.size > 0 ? (intersection.size / union.size) * 100 : 0;
      }
      
      return {
        ...r,
        members: groupMembersMap[r.groupId] || [],
        skillMatch: skillMatch,
        groupSkills: Array.from(groupSkills),
        projectTags: Array.from(projectTags)
      };
    });

    // 2) 未分配结果与可用项目（与 /unallocated 类似，但不调用Python评分以加速；可按需启用）
    const unallocatedGroups = await new Promise((resolve, reject) => {
      db.all(`
        SELECT g.GroupID, g.GroupName
        FROM groups g
        LEFT JOIN results r ON g.GroupID = r.GroupID
        WHERE r.GroupID IS NULL
        ORDER BY g.GroupID
      `, (err, rows) => err ? reject(err) : resolve(rows));
    });

    const availableProjects = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          p.ProjectID,
          p.ProjectName,
          p.ProjectCapacity - COALESCE(COUNT(r.GroupID), 0) AS remaining_capacity,
          p.ProjectCapacity AS capacity
        FROM projects p
        LEFT JOIN results r ON p.ProjectID = r.ProjectID
        GROUP BY p.ProjectID, p.ProjectName, p.ProjectCapacity
        ORDER BY p.ProjectID
      `, (err, rows) => err ? reject(err) : resolve(rows));
    });

    // 3) 组成员数量、技能，以及项目要求技能
    const groupSizesById = await new Promise((resolve, reject) => {
      db.all(`
        SELECT GroupID, COUNT(*) AS size
        FROM group_members
        GROUP BY GroupID
      `, (err, rows) => err ? reject(err) : resolve(rows));
    });
    const groupSizeMap = {};
    for (const r of groupSizesById) groupSizeMap[r.GroupID] = r.size;

    // groupSkillsMap already defined above before skill matching calculation

    const projectRequiredRows = await new Promise((resolve, reject) => {
      db.all(`
        SELECT ProjectID, COALESCE(RequiredSkills, '') AS requiredSkills, ProjectCapacity AS capacity
        FROM projects
      `, (err, rows) => err ? reject(err) : resolve(rows));
    });
    const projectReqMap = {};
    for (const r of projectRequiredRows) {
      const req = (r.requiredSkills || '').split(',').map(s => s.trim()).filter(Boolean);
      projectReqMap[r.ProjectID] = { required: new Set(req), capacity: r.capacity };
    }

    // 4) 计算分析指标
    // Score 分布与均值（动态五分位区间）
    const scores = (results || []).map(r => Number(r.score)).filter(v => !isNaN(v));
    const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    let histogram = [];
    if (scores.length === 0) {
      histogram = [];
    } else {
      const sorted = scores.slice().sort((a, b) => a - b);
      const q = (p) => {
        if (sorted.length === 1) return sorted[0];
        const idx = (sorted.length - 1) * p;
        const lower = Math.floor(idx);
        const upper = Math.ceil(idx);
        if (lower === upper) return sorted[lower];
        const w = idx - lower;
        return sorted[lower] * (1 - w) + sorted[upper] * w;
      };
      const min = sorted[0];
      const q1 = q(0.2);
      const q2 = q(0.4);
      const q3 = q(0.6);
      const q4 = q(0.8);
      const max = sorted[sorted.length - 1];

      const bins = [
        { from: min, to: q1 },
        { from: q1, to: q2 },
        { from: q2, to: q3 },
        { from: q3, to: q4 },
        { from: q4, to: max },
      ];
      const counts = bins.map((b, i) => sorted.filter(s => {
        if (i < bins.length - 1) {
          return s >= b.from && s < b.to;
        }
        return s >= b.from && s <= b.to; // include max in last bin
      }).length);
      histogram = bins.map((b, i) => ({
        bucket: `${Math.round(b.from)}-${Math.round(b.to)}`,
        label: `${Math.round(b.from)}–${Math.round(b.to)}`,
        from: b.from,
        to: b.to,
        count: counts[i]
      }));
    }

    // 项目容量利用 - 添加enrolled groups
    const usedByProject = {};
    const enrolledGroupsByProject = {};
    for (const r of results) {
      usedByProject[r.projectId] = (usedByProject[r.projectId] || 0) + 1;
      if (!enrolledGroupsByProject[r.projectId]) {
        enrolledGroupsByProject[r.projectId] = [];
      }
      enrolledGroupsByProject[r.projectId].push(r.groupName);
    }
    const capacityUtilization = availableProjects.map(p => ({
      projectId: p.ProjectID,
      projectName: p.ProjectName,
      capacity: p.capacity,
      used: usedByProject[p.ProjectID] || 0,
      remaining: p.remaining_capacity,
      enrolledGroups: enrolledGroupsByProject[p.ProjectID] || []
    }));

    // 技能覆盖（按已分配组相对于项目必需技能）
    const skillCoverage = results.map(r => {
      const req = projectReqMap[r.projectId]?.required || new Set();
      const groupSkills = groupSkillsMap[r.groupId] || new Set();
      const requiredList = Array.from(req);
      const achieved = requiredList.filter(s => groupSkills.has(s));
      const coverage = requiredList.length ? achieved.length / requiredList.length : null;
      return {
        groupId: r.groupId,
        groupName: r.groupName,
        projectId: r.projectId,
        projectName: r.projectName,
        requiredSkills: requiredList,
        achievedSkills: Array.from(achieved),
        coverage
      };
    });

    // 风险标记
    const MIN_GROUP_SIZE = 3; // 可根据需要调整或从配置读取
    const riskFlags = {
      undersizedGroups: results
        .filter(r => (groupSizeMap[r.groupId] || 0) < MIN_GROUP_SIZE)
        .map(r => ({ groupId: r.groupId, groupName: r.groupName, size: groupSizeMap[r.groupId] || 0, projectId: r.projectId, projectName: r.projectName })),
      unusedProjectCapacity: capacityUtilization
        .filter(p => (p.remaining || 0) > 0)
        .map(p => ({ projectId: p.projectId, projectName: p.projectName, remaining: p.remaining })),
      manualAllocations: []
    };

    // 手动分配（Score 和 PreferenceRank 同时为 NULL）
    const manualRows = await new Promise((resolve, reject) => {
      db.all(`
        SELECT r.GroupID as groupId, r.ProjectID as projectId, g.GroupName as groupName, p.ProjectName as projectName
        FROM results r
        JOIN groups g ON r.GroupID = g.GroupID
        JOIN projects p ON r.ProjectID = p.ProjectID
        WHERE r.Score IS NULL AND r.PreferenceRank IS NULL
      `, (err, rows) => err ? reject(err) : resolve(rows));
    });
    riskFlags.manualAllocations = manualRows || [];

    // 5) 额外的雷达图数据 - 包含详细的group/project映射
    // 项目 Tags 频次 - 添加project ID和name
    const projectTagsWithDetailsRows = await new Promise((resolve, reject) => {
      db.all(`SELECT ProjectID, ProjectName, COALESCE(Tags, '[]') AS tags FROM projects`, (err, rows) => err ? reject(err) : resolve(rows));
    });
    const projectTagsFreq = {};
    const projectTagsDetails = {}; // tag -> [{projectId, projectName}]
    for (const r of projectTagsWithDetailsRows) {
      let arr = [];
      try { arr = JSON.parse(r.tags || '[]'); } catch (_) { arr = []; }
      if (Array.isArray(arr)) {
        for (const t of arr) {
          const key = String(t || '').trim();
          if (!key) continue;
          projectTagsFreq[key] = (projectTagsFreq[key] || 0) + 1;
          if (!projectTagsDetails[key]) projectTagsDetails[key] = [];
          projectTagsDetails[key].push({ projectId: r.ProjectID, projectName: r.ProjectName });
        }
      }
    }
    const projectTags = Object.entries(projectTagsFreq).map(([label, count]) => ({ 
      label, 
      count,
      projects: projectTagsDetails[label] || []
    })).sort((a,b)=>b.count-a.count);

    // 小组技能频次 - 添加group ID和name
    const groupSkillsWithDetailsRows = await new Promise((resolve, reject) => {
      db.all(`
        SELECT gs.GroupID, g.GroupName, s.SkillName
        FROM group_skills gs 
        JOIN skills s ON gs.SkillID = s.SkillID
        JOIN groups g ON gs.GroupID = g.GroupID
      `, (err, rows) => err ? reject(err) : resolve(rows));
    });
    const groupSkillsFreq = {};
    const groupSkillsDetails = {}; // skill -> [{groupId, groupName}]
    for (const r of groupSkillsWithDetailsRows) {
      const skill = r.SkillName;
      groupSkillsFreq[skill] = (groupSkillsFreq[skill] || 0) + 1;
      if (!groupSkillsDetails[skill]) groupSkillsDetails[skill] = [];
      groupSkillsDetails[skill].push({ groupId: r.GroupID, groupName: r.GroupName });
    }
    const groupSkills = Object.entries(groupSkillsFreq).map(([label, count]) => ({ 
      label, 
      count,
      groups: groupSkillsDetails[label] || []
    })).sort((a,b)=>b.count-a.count);

    // Description Similarity 分布
    const descSimScores = (results || []).map(r => Number(r.descSim)).filter(v => !isNaN(v) && v !== null);
    const avgDescSim = descSimScores.length ? (descSimScores.reduce((a, b) => a + b, 0) / descSimScores.length) : null;
    let descSimHistogram = [];
    if (descSimScores.length > 0) {
      const sorted = descSimScores.slice().sort((a, b) => a - b);
      const q = (p) => {
        if (sorted.length === 1) return sorted[0];
        const idx = (sorted.length - 1) * p;
        const lower = Math.floor(idx);
        const upper = Math.ceil(idx);
        if (lower === upper) return sorted[lower];
        const w = idx - lower;
        return sorted[lower] * (1 - w) + sorted[upper] * w;
      };
      const min = sorted[0];
      const q1 = q(0.2);
      const q2 = q(0.4);
      const q3 = q(0.6);
      const q4 = q(0.8);
      const max = sorted[sorted.length - 1];

      const bins = [
        { from: min, to: q1 },
        { from: q1, to: q2 },
        { from: q2, to: q3 },
        { from: q3, to: q4 },
        { from: q4, to: max },
      ];
      const counts = bins.map((b, i) => sorted.filter(s => {
        if (i < bins.length - 1) {
          return s >= b.from && s < b.to;
        }
        return s >= b.from && s <= b.to;
      }).length);
      descSimHistogram = bins.map((b, i) => ({
        bucket: `${Math.round(b.from)}-${Math.round(b.to)}`,
        label: `${Math.round(b.from)}–${Math.round(b.to)}`,
        from: b.from,
        to: b.to,
        count: counts[i]
      }));
    }

    // Skill Matching 分布（基于 group_skills 和 project tags 的匹配度）
    // 已经有 groupSkillsMap (从 group_skills 表)
    // 获取 project tags
    const projectTagsWithIdRows = await new Promise((resolve, reject) => {
      db.all(`SELECT ProjectID, COALESCE(Tags, '[]') AS tags FROM projects`, (err, rows) => err ? reject(err) : resolve(rows));
    });
    const projectTagsMapForSkillMatch = {};
    for (const r of projectTagsWithIdRows) {
      let arr = [];
      try { arr = JSON.parse(r.tags || '[]'); } catch (_) { arr = []; }
      projectTagsMapForSkillMatch[r.ProjectID] = new Set(arr.map(t => String(t || '').trim()).filter(Boolean));
    }

    // Calculate skill matching for each allocated result
    const skillMatchScores = results.map(r => {
      const groupSkills = groupSkillsMap[r.groupId] || new Set(); // 使用已有的 groupSkillsMap
      const projectTags = projectTagsMapForSkillMatch[r.projectId] || new Set();
      
      if (groupSkills.size === 0 || projectTags.size === 0) return null;
      
      // Calculate Jaccard similarity: intersection / union
      const intersection = new Set([...groupSkills].filter(x => projectTags.has(x)));
      const union = new Set([...groupSkills, ...projectTags]);
      const similarity = union.size > 0 ? (intersection.size / union.size) * 100 : 0;
      
      return similarity;
    }).filter(v => v !== null && !isNaN(v));

    const avgSkillMatch = skillMatchScores.length ? (skillMatchScores.reduce((a, b) => a + b, 0) / skillMatchScores.length) : null;
    let skillMatchHistogram = [];
    if (skillMatchScores.length > 0) {
      const sorted = skillMatchScores.slice().sort((a, b) => a - b);
      const q = (p) => {
        if (sorted.length === 1) return sorted[0];
        const idx = (sorted.length - 1) * p;
        const lower = Math.floor(idx);
        const upper = Math.ceil(idx);
        if (lower === upper) return sorted[lower];
        const w = idx - lower;
        return sorted[lower] * (1 - w) + sorted[upper] * w;
      };
      const min = sorted[0];
      const q1 = q(0.2);
      const q2 = q(0.4);
      const q3 = q(0.6);
      const q4 = q(0.8);
      const max = sorted[sorted.length - 1];

      const bins = [
        { from: min, to: q1 },
        { from: q1, to: q2 },
        { from: q2, to: q3 },
        { from: q3, to: q4 },
        { from: q4, to: max },
      ];
      const counts = bins.map((b, i) => sorted.filter(s => {
        if (i < bins.length - 1) {
          return s >= b.from && s < b.to;
        }
        return s >= b.from && s <= b.to;
      }).length);
      skillMatchHistogram = bins.map((b, i) => ({
        bucket: `${Math.round(b.from)}-${Math.round(b.to)}`,
        label: `${Math.round(b.from)}–${Math.round(b.to)}`,
        from: b.from,
        to: b.to,
        count: counts[i]
      }));
    }

    // 6) 当前配置（权重 + min/max group size），用于报告归档
    let minGroupSizeCfg = MIN_GROUP_SIZE;
    let maxGroupSizeCfg = null;
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        const m1 = raw.match(/minGroupSize:\s*(\d+)/i);
        const m2 = raw.match(/maxGroupSize:\s*(\d+)/i);
        if (m1) minGroupSizeCfg = Number(m1[1]);
        if (m2) maxGroupSizeCfg = Number(m2[1]);
      }
    } catch (_) {}

    // Compute unallocated groups strictly by groups.allocated_project IS NULL (pool-only rows should still count as unallocated)
    const db2 = new sqlite3.Database(DB_PATH);
    const totalGroupsRow = await new Promise((resolve, reject) => {
      db2.get('SELECT COUNT(*) as c FROM groups', (err, row) => err ? reject(err) : resolve(row));
    });
    const unallocGroups = await new Promise((resolve, reject) => {
      db2.all('SELECT GroupID, GroupName FROM groups WHERE allocated_project IS NULL', (err, rows) => err ? reject(err) : resolve(rows));
    });
    db2.close();

    // 返回报告
    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      resultsCount: (resultsWithMembers || []).length,
      unallocatedCount: (unallocGroups || []).length,
      totalGroups: Number(totalGroupsRow?.c || 0),
      results: resultsWithMembers,
      unallocated: unallocGroups,
      availableProjects,
      groupMembers: groupMembersMap,
      analytics: {
        score: { average: avgScore, histogram },
        descriptionSimilarity: { average: avgDescSim, histogram: descSimHistogram },
        skillMatching: { average: avgSkillMatch, histogram: skillMatchHistogram },
        capacityUtilization,
        skillCoverage,
        riskFlags,
        radars: { projectTags, groupSkills },
        settings: {
          weights: currentWeights,
          minGroupSize: minGroupSizeCfg,
          maxGroupSize: maxGroupSizeCfg
        }
      }
    });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// 8. 获取导出所需的完整数据
router.get('/export-data', async (req, res) => {
  try {
    const db = new sqlite3.Database(DB_PATH);
    
    // 1. 获取所有groups的详细信息 (HD, D, CR, PS, GroupDescription)
    const groupsData = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          GroupID,
          GroupName,
          NumStudentsHD,
          NumStudentsD,
          NumStudentsCR,
          NumStudentsP,
          GroupDescription,
          allocated_project
        FROM groups
      `, (err, rows) => err ? reject(err) : resolve(rows));
    });
    
    const groupsMap = {};
    for (const g of groupsData) {
      groupsMap[g.GroupID] = {
        groupId: g.GroupID,
        groupName: g.GroupName,
        numStudentsHD: g.NumStudentsHD,
        numStudentsD: g.NumStudentsD,
        numStudentsCR: g.NumStudentsCR,
        numStudentsP: g.NumStudentsP,
        groupDescription: g.GroupDescription,
        allocatedProject: g.allocated_project
      };
    }
    
    // 2. 获取所有projects的详细信息 (ProjectDescription, ExpectedOutcomes, RequiredSkills, Tags)
    const projectsData = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          ProjectID,
          ProjectName,
          ProjectDescription,
          ExpectedOutcomes,
          RequiredSkills,
          COALESCE(Tags, '[]') AS tags
        FROM projects
      `, (err, rows) => err ? reject(err) : resolve(rows));
    });
    
    const projectsMap = {};
    for (const p of projectsData) {
      let tags = [];
      try { tags = JSON.parse(p.tags || '[]'); } catch (_) { tags = []; }
      projectsMap[p.ProjectID] = {
        projectId: p.ProjectID,
        projectName: p.ProjectName,
        projectDescription: p.ProjectDescription,
        expectedOutcomes: p.ExpectedOutcomes,
        requiredSkills: p.RequiredSkills,
        tags: tags
      };
    }
    
    // 3. 获取所有group_skills
    const groupSkillsRows = await new Promise((resolve, reject) => {
      db.all(`
        SELECT gs.GroupID, g.GroupName, s.SkillName
        FROM group_skills gs
        JOIN skills s ON gs.SkillID = s.SkillID
        JOIN groups g ON gs.GroupID = g.GroupID
      `, (err, rows) => err ? reject(err) : resolve(rows));
    });
    
    const groupSkillsMap = {};
    const skillToGroupsMap = {};
    for (const r of groupSkillsRows) {
      if (!groupSkillsMap[r.GroupID]) {
        groupSkillsMap[r.GroupID] = [];
      }
      groupSkillsMap[r.GroupID].push(r.SkillName);
      
      if (!skillToGroupsMap[r.SkillName]) {
        skillToGroupsMap[r.SkillName] = [];
      }
      skillToGroupsMap[r.SkillName].push({
        groupId: r.GroupID,
        groupName: r.GroupName
      });
    }
    
    // 4. 获取project tags到projects的映射
    const tagToProjectsMap = {};
    for (const [projectId, projectData] of Object.entries(projectsMap)) {
      for (const tag of projectData.tags) {
        const tagStr = String(tag || '').trim();
        if (!tagStr) continue;
        if (!tagToProjectsMap[tagStr]) {
          tagToProjectsMap[tagStr] = [];
        }
        tagToProjectsMap[tagStr].push({
          projectId: parseInt(projectId),
          projectName: projectData.projectName
        });
      }
    }
    
    // 5. 获取enrolled groups by project (直接从results表查询)
    const enrolledGroupsRows = await new Promise((resolve, reject) => {
      db.all(`
        SELECT r.ProjectID, r.GroupID, g.GroupName
        FROM results r
        JOIN groups g ON r.GroupID = g.GroupID
        ORDER BY r.ProjectID, r.GroupID
      `, (err, rows) => err ? reject(err) : resolve(rows));
    });
    
    const enrolledGroupsByProject = {};
    for (const row of enrolledGroupsRows) {
      if (!enrolledGroupsByProject[row.ProjectID]) {
        enrolledGroupsByProject[row.ProjectID] = [];
      }
      enrolledGroupsByProject[row.ProjectID].push({
        groupId: row.GroupID,
        groupName: row.GroupName
      });
    }
    
    db.close();
    
    res.json({
      success: true,
      data: {
        groups: groupsMap,
        projects: projectsMap,
        groupSkills: groupSkillsMap,
        skillToGroups: skillToGroupsMap,
        tagToProjects: tagToProjectsMap,
        enrolledGroupsByProject: enrolledGroupsByProject
      }
    });
  } catch (err) {
    console.error('Error fetching export data:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch export data' });
  }
});

// 计算匹配分数的辅助函数
async function calculateMatchScore(groupId, projectId) {
  return new Promise((resolve, reject) => {
    const pythonCmd = detectPythonCommand();
    const projectRoot = path.resolve(path.join(__dirname, '../../../'));
    const dbPath = path.resolve(DB_PATH);

    const pyCode = `
import sys, json, sqlite3
sys.path.append(sys.argv[1])  # project_root
from allocation import ProjectAllocator

project_root = sys.argv[1]
db_path = sys.argv[2]
group_id = int(sys.argv[3])
project_id = int(sys.argv[4])

try:
    allocator = ProjectAllocator(db_path)

    # === 这里是你问的那段：显式打开连接，获取 cursor 传给 calculate_final_score ===
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    try:
        score = allocator.calculate_final_score(cur, group_id, project_id)
    finally:
        conn.close()
    # === 以上就是“在哪里改”的位置：就在内联的 Python 代码里 ===

    # 兜底：非数值转 0
    try:
        print(float(score))
    except:
        print(0)
except Exception as e:
    print(0)
`.trim();

    const args = ['-c', pyCode, projectRoot, dbPath, String(groupId), String(projectId)];

    const pythonProcess = spawn(pythonCmd, args, { cwd: projectRoot });

    let output = '';
    let error = '';

    pythonProcess.stdout.on('data', d => (output += d.toString()));
    pythonProcess.stderr.on('data', d => (error += d.toString()));

    pythonProcess.on('close', () => {
      const score = parseFloat(String(output).trim());
      resolve(Number.isFinite(score) ? score : 0);
    });

    pythonProcess.on('error', reject);
  });
}

// 6. 检查分配状态
router.get('/status', async (req, res) => {
  try {
    const db = new sqlite3.Database(DB_PATH);
    
    // 检查results表中是否有score或preference数据
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM results 
      WHERE Score IS NOT NULL OR PreferenceRank IS NOT NULL
    `;
    
    db.get(checkQuery, [], (err, row) => {
      if (err) {
        console.error('Error checking allocation status:', err);
        res.status(500).json({
          success: false,
          message: '检查分配状态失败'
        });
        return;
      }
      
      const hasAllocationData = row.count > 0;
      
      res.json({
        success: true,
        hasAllocationData: hasAllocationData,
        message: hasAllocationData ? '已存在分配结果' : '无分配结果'
      });
      
      db.close();
    });
  } catch (err) {
    console.error('Error checking allocation status:', err);
    res.status(500).json({
      success: false,
      message: '检查分配状态失败'
    });
  }
});

// 7. 重置分配结果（仅删除自动分配的结果）
router.post('/reset', async (req, res) => {
  try {
    const db = new sqlite3.Database(DB_PATH);
    
    // 查找所有自动分配的结果（Score或PreferenceRank不为NULL）
    const findQuery = `
      SELECT GroupID, ProjectID 
      FROM results 
      WHERE Score IS NOT NULL OR PreferenceRank IS NOT NULL
    `;
    
    db.all(findQuery, [], async (err, rows) => {
      if (err) {
        console.error('Error finding allocation results to reset:', err);
        res.status(500).json({
          success: false,
          message: 'Failed to find allocation results to reset'
        });
        return;
      }
      
      try {
        // 使用事务确保数据一致性
        await new Promise((resolve, reject) => {
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        // 先找出所有手动分配的组（Score和PreferenceRank都为NULL）
        const manualAllocations = await new Promise((resolve, reject) => {
          db.all(
            `SELECT r.GroupID, p.ProjectName 
             FROM results r 
             JOIN projects p ON r.ProjectID = p.ProjectID 
             WHERE r.Score IS NULL AND r.PreferenceRank IS NULL`,
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            }
          );
        });

        // 保存手动分配的组和项目名称的映射
        const manualAllocationMap = {};
        for (const row of manualAllocations) {
          manualAllocationMap[row.GroupID] = row.ProjectName;
        }

        // 删除results表中的自动分配记录（Score或PreferenceRank不为NULL）
        await new Promise((resolve, reject) => {
          db.run(
            'DELETE FROM results WHERE Score IS NOT NULL OR PreferenceRank IS NOT NULL',
            function(err) {
              if (err) reject(err);
              else resolve(this);
            }
          );
        });

        // 重置groups表中的allocated_project，但保留手动分配的组
        if (Object.keys(manualAllocationMap).length > 0) {
          // 先重置所有不在手动分配中的组
          await new Promise((resolve, reject) => {
            db.run(
              `UPDATE groups SET allocated_project = NULL WHERE GroupID NOT IN (${Object.keys(manualAllocationMap).join(',')})`,
              function(err) {
                if (err) reject(err);
                else resolve(this);
              }
            );
          });

          // 然后为每个手动分配的组设置正确的项目名称
          for (const [groupId, projectName] of Object.entries(manualAllocationMap)) {
            await new Promise((resolve, reject) => {
              db.run(
                'UPDATE groups SET allocated_project = ? WHERE GroupID = ?',
                [projectName, groupId],
                function(err) {
                  if (err) reject(err);
                  else resolve(this);
                }
              );
            });
          }
        } else {
          // 如果没有手动分配，直接重置所有组
          await new Promise((resolve, reject) => {
            db.run(
              'UPDATE groups SET allocated_project = NULL',
              function(err) {
                if (err) reject(err);
                else resolve(this);
              }
            );
          });
        }

        // 确保description_meta表存在
        await new Promise((resolve, reject) => {
          db.run(`
            CREATE TABLE IF NOT EXISTS description_meta(
              Key TEXT PRIMARY KEY,
              Value TEXT
            )
          `, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // 清空description_meta表中的值
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE description_meta SET Value = NULL',
            function(err) {
              if (err) reject(err);
              else resolve(this);
            }
          );
        });

        // 确保description_similarities表存在
        await new Promise((resolve, reject) => {
          db.run(`
            CREATE TABLE IF NOT EXISTS description_similarities (
              GroupID INTEGER,
              ProjectID TEXT,
              DescSim REAL,
              PRIMARY KEY (GroupID, ProjectID),
              FOREIGN KEY (GroupID) REFERENCES groups (GroupID) ON DELETE CASCADE,
              FOREIGN KEY (ProjectID) REFERENCES projects (ProjectID) ON DELETE CASCADE
            )
          `, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // 清空description_similarities表
        await new Promise((resolve, reject) => {
          db.run(
            'DELETE FROM description_similarities',
            function(err) {
              if (err) reject(err);
              else resolve(this);
            }
          );
        });

        // 清空 results 表中的 SubOptionProjectID（池子建议项目），确保重置后不残留
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE results SET SubOptionProjectID = NULL',
            function(err) {
              if (err) reject(err);
              else resolve(this);
            }
          );
        });
        
        // 提交事务
        await new Promise((resolve, reject) => {
          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        res.json({
          success: true,
          message: `Successfully reset ${rows.length} automatic allocation results and cleared description data`,
          resetCount: rows.length
        });
        
      } catch (transactionErr) {
        // 回滚事务
        await new Promise((resolve) => {
          db.run('ROLLBACK', () => resolve());
        });
        
        console.error('Error during reset transaction:', transactionErr);
        res.status(500).json({
          success: false,
          message: 'Failed to reset allocation results'
        });
      }
      
      db.close();
    });
    
  } catch (err) {
    console.error('Error resetting allocation results:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to reset allocation results'
    });
  }
});

// 8. 执行分配算法（流式响应）
router.post('/execute', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // 设置流式响应头
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // 获取实际的组数量
    const db = require('sqlite3').verbose().Database;
    const dbInstance = new db(DB_PATH);
    
    let totalGroups = 0;
    await new Promise((resolve, reject) => {
      dbInstance.get('SELECT COUNT(*) as count FROM groups', (err, row) => {
        if (err) reject(err);
        else {
          totalGroups = row.count;
          resolve();
        }
      });
    });
    dbInstance.close();
    
    // Send initial message
    const initialMessage = {
      success: true,
      message: 'Starting allocation algorithm',
      progress: {
        stage: 'Initialization',
        progress: 0,
        message: 'Loading data...',
        details: `Total groups: ${totalGroups}`,
        timestamp: new Date().toISOString()
      }
    };
    res.write(JSON.stringify(initialMessage) + '\n');
    
    // Send progress update
    await new Promise(resolve => setTimeout(resolve, 500));
    const progressUpdate1 = {
      success: true,
      message: 'Progress update',
      progress: {
        stage: 'Gale-Shapley Algorithm and description matching',
        progress: 25,
        message: 'Executing Gale-Shapley algorithm and description matching...',
        details: `Processing (${totalGroups} groups)`,
        timestamp: new Date().toISOString()
      }
    };
    res.write(JSON.stringify(progressUpdate1) + '\n');
    
    // Send second progress update
    await new Promise(resolve => setTimeout(resolve, 500));
    const progressUpdate2 = {
      success: true,
      message: 'Progress update',
      progress: {
        stage: 'Remaining Groups Allocation',
        progress: 75,
        message: 'Allocating remaining groups...',
        details: 'Allocating...',
        timestamp: new Date().toISOString()
      }
    };
    res.write(JSON.stringify(progressUpdate2) + '\n');
    
    // Execute Python allocation algorithm
    const pythonResult = await executePythonAllocation();
    const executionTime = Date.now() - startTime;
    
    // Use real data from Python
    const finalResult = {
      success: true,
      message: 'Allocation completed',
      results: {
        totalGroups: pythonResult.totalGroups || totalGroups,
        allocatedGroups: pythonResult.allocatedGroups || 0,
        unallocatedGroups: pythonResult.unallocatedGroups || totalGroups,
        executionTime: executionTime
      }
    };
    res.write(JSON.stringify(finalResult) + '\n');
    
    res.end();
  } catch (err) {
    console.error('Error executing allocation:', err);
    const errorMessage = {
      success: false,
      message: `Allocation algorithm execution failed: ${err.message}`
    };
    res.write(JSON.stringify(errorMessage) + '\n');
    res.end();
  }
});

// 执行Python分配算法的辅助函数
async function executePythonAllocation() {
  return new Promise((resolve, reject) => {
    const pythonCmd = detectPythonCommand();
    const projectRoot = path.resolve(path.join(__dirname, '../../../'));
    const dbPath = path.resolve(DB_PATH);

    console.log(`🐍 Using Python command: ${pythonCmd}`);

    const pyCode = `
import sys, json
sys.path.append(sys.argv[1])  # project_root
from allocation import ProjectAllocator

project_root = sys.argv[1]
db_path = sys.argv[2]

try:
    allocator = ProjectAllocator(db_path)
    result = allocator.final_allocation()
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"success": False, "message": str(e)}))
`.trim();

    const args = ['-c', pyCode, projectRoot, dbPath];
    const pythonProcess = spawn(pythonCmd, args, { cwd: projectRoot });

    let output = '';
    let error = '';

    pythonProcess.stdout.on('data', (d) => (output += d.toString()));
    pythonProcess.stderr.on('data', (d) => (error += d.toString()));

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(error || 'Python script execution failed'));
      }
      try {
        // 只解析最后一行 JSON
        const lines = output.trim().split('\n');
        const jsonLine = lines[lines.length - 1];
        const result = JSON.parse(jsonLine);
        console.log('📊 Python allocation result:', result);
        resolve(result);
      } catch (e) {
        console.error('❌ Failed to parse Python output:', output);
        resolve({
          success: false,
          message: 'Failed to parse allocation result',
          totalGroups: 0,
          allocatedGroups: 0,
          unallocatedGroups: 0,
          executionTime: 0
        });
      }
    });

    pythonProcess.on('error', reject);
  });
}

module.exports = router;
