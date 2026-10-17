# Manual Allocation Implementation

## Feature Description

The allocation algorithm now supports **manual allocation** functionality. If records exist in the `results` table where both `Score` and `PreferenceRank` are `NULL`, these groups will be identified as manually allocated and will be excluded when the automatic allocation algorithm runs.

## Implementation Details

### 1. Identifying Manually Allocated Groups

In the `gale_shapley_allocation` method in `allocation.py`:

```python
# Check for manual allocations (Score and PreferenceRank both NULL in results)
cursor.execute("""
    SELECT GroupID, ProjectID FROM results 
    WHERE Score IS NULL AND PreferenceRank IS NULL
""")
manual_allocs = cursor.fetchall()
```

### 2. Excluding Manually Allocated Groups

Manually allocated groups are excluded from automatic allocation along with priority allocated groups:

```python
# Exclude both priority and manual allocated groups from free groups
priority_group_ids = {row[0] for row in priority_allocs}
manual_group_ids = {row[0] for row in manual_allocs}
excluded_group_ids = priority_group_ids | manual_group_ids
free_groups_list = [g for g in all_groups if g not in excluded_group_ids]
```

### 3. Occupying Project Capacity

Manually allocated groups occupy project capacity:

```python
# Add manual allocations to project matches
for group_id, project_id in manual_allocs:
    if project_id in project_current_matches:
        project_current_matches[project_id].append(group_id)
```

### 4. Protecting Manual Allocation Results

When saving automatic allocation results, only automatic allocation records are deleted, while manual allocations are preserved:

```python
# Delete only automatic allocation results (where Score or PreferenceRank is NOT NULL)
# Keep manual allocations (where both Score and PreferenceRank are NULL)
cursor.execute("DELETE FROM results WHERE Score IS NOT NULL OR PreferenceRank IS NOT NULL")
```

### 5. Remaining Group Allocation Considering Manual Allocations

When allocating remaining unallocated groups, consider the capacity occupied by manual allocations:

```python
# Get manually allocated groups (both Score and PreferenceRank are NULL)
cursor.execute("""
    SELECT GroupID FROM results 
    WHERE Score IS NULL AND PreferenceRank IS NULL
""")
manual_allocated_groups = {row[0] for row in cursor.fetchall()}

# Combine automatic and manual allocations
allocated_groups = set(group_allocation.keys()) | manual_allocated_groups
```

## Use Cases

### Scenario 1: Manually Pre-allocate Certain Groups

Administrators can manually assign certain groups to specific projects before running the automatic allocation algorithm:

```sql
-- Manually allocate Group 5 to Project P10 (both Score and PreferenceRank are NULL)
INSERT INTO results (GroupID, ProjectID, Score, PreferenceRank)
VALUES (5, 'P10', NULL, NULL);

-- Also update groups table
UPDATE groups SET allocated_project = 'P10' WHERE GroupID = 5;
```

When running the automatic allocation algorithm:
- Group 5 will **not participate** in automatic allocation
- Project P10's available capacity will **decrease by 1**
- Manual allocation results will **be preserved**

### Scenario 2: Manual Adjustment After Running Algorithm

After running the automatic allocation algorithm, administrators can:

1. **View Results**:
```sql
-- Automatic allocation results (Score or PreferenceRank is NOT NULL)
SELECT * FROM results WHERE Score IS NOT NULL OR PreferenceRank IS NOT NULL;

-- Manual allocation results (both Score and PreferenceRank are NULL)
SELECT * FROM results WHERE Score IS NULL AND PreferenceRank IS NULL;
```

2. **Manual Adjustment**: Use `manager_operations.py` functionality to manually modify allocations

3. **Re-run Algorithm**:
   - Manually allocated groups will not be re-allocated
   - Automatically allocated groups will be recalculated

## Data Structure

### Database Schema (`student_project.db`)

#### results Table Structure
```sql
CREATE TABLE results (
    GroupID INTEGER PRIMARY KEY,
    ProjectID TEXT,
    Score REAL,
    PreferenceRank INTEGER,
    SubOptionProjectID TEXT,
    FOREIGN KEY (ProjectID) REFERENCES projects (ProjectID) ON DELETE CASCADE,
    FOREIGN KEY (GroupID) REFERENCES groups (GroupID) ON DELETE CASCADE,
    FOREIGN KEY (SubOptionProjectID) REFERENCES projects (ProjectID) ON DELETE CASCADE
);
```

#### Example Data

| GroupID | ProjectID | Score | PreferenceRank | SubOptionProjectID | Description |
|---------|-----------|-------|----------------|-------------------|-------------|
| 1 | P01 | 85.5 | 1 | NULL | Automatic allocation - First preference |
| 2 | P02 | 72.3 | 3 | NULL | Automatic allocation - Third preference |
| 3 | P03 | NULL | 0 | NULL | Priority allocation (PreferenceRank = 0) |
| 4 | P04 | NULL | NULL | NULL | **Manual allocation** ⭐ |
| 5 | P05 | 90.1 | NULL | NULL | Automatic allocation - Remaining group allocation |

#### Related Tables

**groups Table**:
```sql
CREATE TABLE groups (
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
);
```

**priority_allocations Table**:
```sql
CREATE TABLE priority_allocations (
    GroupID INTEGER PRIMARY KEY,
    ProjectID TEXT NOT NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Identification Rules**:
- `Score IS NULL AND PreferenceRank IS NULL` → Manual allocation
- `Score IS NOT NULL OR PreferenceRank IS NOT NULL` → Automatic allocation
- `PreferenceRank = 0` → Priority allocation (special manual allocation)
- `SubOptionProjectID IS NOT NULL` → Sub-option allocation (future feature)

## Workflow Example

### Complete Allocation Process

```
1. Initial State
   ├─ 60 groups need allocation
   ├─ 52 projects available
   └─ results table is empty

2. Administrator Manual Pre-allocation (Optional)
   ├─ Manually allocate 3 groups to specific projects
   └─ results table has 3 records (Score=NULL, PreferenceRank=NULL)

3. Run Automatic Allocation Algorithm
   ├─ Identify 3 manually allocated groups → Exclude
   ├─ Remaining 57 groups participate in automatic allocation
   ├─ Gale-Shapley algorithm allocates 52 groups
   └─ Remaining group allocation attempts to allocate 5 groups

4. Automatic Allocation Complete
   ├─ Save automatic allocation results (don't delete manual allocations)
   ├─ results table has 60 records
   │  ├─ 3 manual allocations (Score=NULL, PreferenceRank=NULL)
   │  └─ 57 automatic allocations (Score≠NULL OR PreferenceRank≠NULL)
   └─ Statistics: All 60 groups allocated

5. Administrator Review and Adjustment (Optional)
   ├─ Find some allocations unsatisfactory
   ├─ Use manager_operations to manually adjust
   └─ Adjusted results remain automatic allocations (with Score)

6. Re-run Algorithm (Optional)
   ├─ Identify 3 manually allocated groups → Preserve
   ├─ Delete 57 automatic allocation records
   ├─ Recalculate allocation for 57 groups
   └─ 3 manually allocated groups unaffected
```

## API Behavior

### Reset Allocation

**Backend API**: `POST /api/allocation/reset`

**Frontend API**: `resetAllocationResults()` in `allocationApi.ts`

```javascript
// Backend implementation (allocation.js)
DELETE FROM results WHERE Score IS NOT NULL OR PreferenceRank IS NOT NULL
```

**Response Format**:
```json
{
  "success": true,
  "message": "Successfully reset X automatic allocation results and cleared description data",
  "resetCount": 15
}
```

**Results**:
- ✅ Delete all automatic allocation records (Score ≠ NULL OR PreferenceRank ≠ NULL)
- ✅ **Preserve** all manual allocation records (Score = NULL AND PreferenceRank = NULL)
- ✅ Reset corresponding groups' `allocated_project` field (except manual allocations)
- ✅ Clear description similarity data

### Execute Allocation

**Backend API**: `POST /api/allocation/execute`

**Frontend API**: `executeAllocation()` in `allocationApi.ts`

**Process**:
1. Read manually allocated groups from `results` table
2. Exclude these groups, only run algorithm on remaining groups
3. When saving results, preserve manual allocation records
4. Stream progress updates to frontend

**Response Format** (Streaming):
```json
{
  "success": true,
  "message": "Starting allocation algorithm",
  "progress": {
    "stage": "Initialization",
    "progress": 0,
    "message": "Loading data...",
    "details": "Total groups: 60",
    "timestamp": "2025-01-09T10:30:00.000Z"
  }
}
```

### Check Allocation Status

**Backend API**: `GET /api/allocation/status`

**Frontend API**: `checkAllocationStatus()` in `allocationApi.ts`

**Response Format**:
```json
{
  "success": true,
  "hasAllocationData": true,
  "message": "Allocation data found"
}
```

### Generate Report

**Backend API**: `GET /api/allocation/report`

**Frontend API**: `generateReport()` in `allocationApi.ts`

**Response Format**:
```json
{
  "success": true,
  "generatedAt": "2025-01-09T10:30:00.000Z",
  "resultsCount": 58,
  "unallocatedCount": 2,
  "results": [...],
  "unallocated": [...],
  "availableProjects": [...],
  "groupMembers": {...},
  "analytics": {
    "score": {...},
    "capacityUtilization": [...],
    "skillCoverage": [...],
    "riskFlags": {
      "undersizedGroups": [...],
      "unusedProjectCapacity": [...]
    }
  }
}
```

### Manager Operations

**Python API**: `manager_operations.py`

```python
# Set priority allocation (PreferenceRank = 0)
manager.set_priority(group_id, project_id)

# Change allocation (will calculate new Score)
manager.change_allocation(group_id, new_project_id)

# Swap allocations (will calculate new Score)
manager.swap_groups(group1_id, group2_id)
```

**Note**: Operations in `manager_operations` produce records with Score, not manual allocations.

## How to Create Manual Allocations

### Method 1: Direct SQL Insert

```sql
-- 1. Insert into results table (both Score and PreferenceRank are NULL)
INSERT INTO results (GroupID, ProjectID, Score, PreferenceRank, SubOptionProjectID)
VALUES (10, 'P15', NULL, NULL, NULL);

-- 2. Update groups table with project name (not ID)
UPDATE groups SET allocated_project = 'Project Name' WHERE GroupID = 10;
```

**Important Notes**:
- The `allocated_project` field in `groups` table stores the **project name**, not the project ID
- Both `Score` and `PreferenceRank` must be `NULL` for manual allocation
- `SubOptionProjectID` should also be `NULL` for standard manual allocations

### Method 2: Using Manager Operations (Python)

```python
# Using manager_operations.py
from manager_operations import ManagerOperations

manager = ManagerOperations('student_project.db')

# This creates a priority allocation (PreferenceRank = 0), not manual allocation
manager.set_priority(group_id=10, project_id='P15')
```

**Note**: `manager_operations.py` creates priority allocations (PreferenceRank = 0), not manual allocations (both NULL).

### Method 3: Using Backend API (Future Implementation)

A dedicated manual allocation API could be added:

```javascript
// POST /api/allocation/manual-assign
router.post('/manual-assign', async (req, res) => {
  const { groupId, projectId } = req.body;
  
  // Validate inputs
  // Check project capacity
  // Insert NULL, NULL record into results
  // Update groups.allocated_project with project name
  
  res.json({ success: true });
});
```

### Method 4: Database Management Tools

Using SQLite browser or command line:

```bash
# Connect to database
sqlite3 student_project.db

# Insert manual allocation
INSERT INTO results (GroupID, ProjectID, Score, PreferenceRank, SubOptionProjectID)
VALUES (10, 'P15', NULL, NULL, NULL);

# Update groups table
UPDATE groups SET allocated_project = 'Project Name' WHERE GroupID = 10;
```

## Test Scenarios

### Test 1: Basic Manual Allocation

```sql
-- Clear all results
DELETE FROM results;
UPDATE groups SET allocated_project = NULL;

-- Manually allocate 2 groups
INSERT INTO results (GroupID, ProjectID, Score, PreferenceRank, SubOptionProjectID)
VALUES (1, 'P01', NULL, NULL, NULL);
INSERT INTO results (GroupID, ProjectID, Score, PreferenceRank, SubOptionProjectID)
VALUES (2, 'P02', NULL, NULL, NULL);

-- Update groups table with project names
UPDATE groups SET allocated_project = 'Project One' WHERE GroupID = 1;
UPDATE groups SET allocated_project = 'Project Two' WHERE GroupID = 2;

-- Run automatic allocation
-- Expected: Groups 1 and 2 don't participate, remain in P01 and P02
```

### Test 2: Mixed Allocation Types

```sql
-- 1 priority allocation + 2 manual allocations + automatic allocation
INSERT INTO priority_allocations VALUES (3, 'P03');
INSERT INTO results (GroupID, ProjectID, Score, PreferenceRank, SubOptionProjectID)
VALUES (4, 'P04', NULL, NULL, NULL);
INSERT INTO results (GroupID, ProjectID, Score, PreferenceRank, SubOptionProjectID)
VALUES (5, 'P05', NULL, NULL, NULL);

-- Update groups table
UPDATE groups SET allocated_project = 'Project Three' WHERE GroupID = 3;
UPDATE groups SET allocated_project = 'Project Four' WHERE GroupID = 4;
UPDATE groups SET allocated_project = 'Project Five' WHERE GroupID = 5;

-- Run automatic allocation
-- Expected: Groups 3, 4, 5 all don't participate in automatic allocation
```

### Test 3: Reset Preserves Manual Allocations

```sql
-- Run automatic allocation first
-- Then call reset API
POST /api/allocation/reset

-- Expected: Only delete automatic allocations, preserve manual allocation records
-- Manual allocations (Score=NULL AND PreferenceRank=NULL) remain intact
```

### Test 4: Verify API Endpoints

```bash
# Check allocation status
curl -X GET http://localhost:3002/api/allocation/status

# Reset allocations (preserves manual)
curl -X POST http://localhost:3002/api/allocation/reset

# Execute allocation (excludes manual)
curl -X POST http://localhost:3002/api/allocation/execute

# Generate report (includes manual in analytics)
curl -X GET http://localhost:3002/api/allocation/report
```

## Statistics and Reporting

### Allocation Statistics

**API Endpoint**: `GET /api/allocation/report`

**Response Structure**:
```json
{
  "success": true,
  "generatedAt": "2025-01-09T10:30:00.000Z",
  "resultsCount": 58,        // Total allocated groups (manual + automatic)
  "unallocatedCount": 2,     // Unallocated groups
  "results": [...],          // All allocation results
  "unallocated": [...],      // Unallocated groups with scores
  "availableProjects": [...], // Projects with remaining capacity
  "groupMembers": {...},     // Group member details
  "analytics": {
    "score": {
      "average": 78.5,
      "histogram": [...]
    },
    "capacityUtilization": [
      {
        "projectId": 1,
        "projectName": "Project One",
        "capacity": 3,
        "used": 2,
        "remaining": 1
      }
    ],
    "skillCoverage": [...],
    "riskFlags": {
      "undersizedGroups": [...],
      "unusedProjectCapacity": [...]
    }
  }
}
```

### Manual Allocation Identification

Manual allocations are identified in the system by:
- **Database**: `Score IS NULL AND PreferenceRank IS NULL` in `results` table
- **API Response**: Manual allocations appear in `results` array with `score: null` and `preferenceRank: null`
- **Frontend**: Can be distinguished by checking for null values in allocation results

### Python Allocation Results

**File**: `allocation.py` → `final_allocation()` method

```python
# Statistics returned by final_allocation include manually allocated groups
{
    'totalGroups': 60,        # All groups in database
    'allocatedGroups': 58,    # Including manual + automatic allocations
    'unallocatedGroups': 2,   # Groups not allocated to any project
    'executionTime': 1500     # Algorithm execution time in milliseconds
}
```

## Advantages

1. ✅ **Flexibility**: Allows administrator manual intervention
2. ✅ **Protection**: Manual allocation results won't be overwritten by algorithm
3. ✅ **Traceability**: Can distinguish between manual and automatic allocations
4. ✅ **Capacity Management**: Manual allocations correctly occupy project capacity
5. ✅ **Repeatable**: Can run algorithm multiple times without affecting manual allocations

## Important Notes

1. **Data Consistency**: When manually allocating, must update both `results` and `groups` tables
2. **Capacity Check**: Should check project capacity before manual allocation
3. **Conflict Handling**: If a group exists in both `priority_allocations` and manual allocation, priority allocation takes precedence
4. **Reset Operation**: Reset operation only deletes automatic allocations, preserves manual allocations

---

## Implementation Details

### Backend Implementation

**File**: `backend/src/routes/allocation.js`

**Key Endpoints**:
- `POST /api/allocation/reset` - Resets automatic allocations, preserves manual
- `POST /api/allocation/execute` - Executes allocation algorithm with progress streaming
- `GET /api/allocation/status` - Checks allocation status
- `GET /api/allocation/report` - Generates comprehensive analytics report

**Database Operations**:
- Manual allocation detection: `WHERE Score IS NULL AND PreferenceRank IS NULL`
- Automatic allocation deletion: `WHERE Score IS NOT NULL OR PreferenceRank IS NOT NULL`
- Transaction-based operations ensure data consistency

### Frontend Implementation

**File**: `allocation_web/src/api/allocationApi.ts`

**Key Functions**:
- `resetAllocationResults()` - Calls reset API
- `executeAllocation()` - Handles streaming allocation execution
- `checkAllocationStatus()` - Checks current allocation state
- `generateReport()` - Fetches comprehensive analytics

### Python Implementation

**File**: `allocation.py`

**Key Methods**:
- `gale_shapley_allocation()` - Detects and excludes manual allocations
- `final_allocation()` - Returns statistics including manual allocations
- Manual allocation identification in multiple algorithm stages

### Database Schema

**File**: `student_project.db`

**Tables**:
- `results` - Main allocation results with manual allocation support
- `groups` - Group information with `allocated_project` field
- `priority_allocations` - Priority allocations (PreferenceRank = 0)
- `projects` - Project information and capacity

---

**Last Updated**: January 9, 2025
**Implementation Status**: ✅ Completed and Tested
**Database**: `student_project.db`
**Backend Port**: 3002 (configurable)
**Frontend API**: `allocationApi.ts`
**Modified Files**: 
- `allocation.py` (manual allocation detection and exclusion)
- `backend/src/routes/allocation.js` (API endpoints and database operations)
- `allocation_web/src/api/allocationApi.ts` (frontend API integration)

