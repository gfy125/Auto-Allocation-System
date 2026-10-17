# Allocation Backend API

This is the backend API server for the project allocation system, providing RESTful API interfaces for the frontend.

## Features

- ✅ Group management API (create, read, update, delete)
- ✅ Project management API (create, read, update, delete)
- ✅ Data validation and error handling
- ✅ SQLite database storage
- ✅ CORS support for frontend cross-origin requests
- ✅ Security middleware (Helmet, Rate Limiting)
- ✅ Request logging

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The server will start at `http://localhost:3001`.

### 3. Production Environment

```bash
npm start
```

## API Endpoints

### Health Check
- `GET /health` - Check server status

### Group Management
- `POST /api/groups` - Create new group
- `GET /api/groups` - Get all groups
- `GET /api/groups/:id` - Get specific group
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group

### Project Management
- `POST /api/projects` - Create new project
- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get specific project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

## Database

Uses SQLite database, the database file will be automatically created at `data/allocation.db`.

### Table Structure

#### groups table
- `id` - Primary key
- `groupName` - Group name (unique)
- `student1` ~ `student7` - Student information
- `preference1` ~ `preference5` - Project preferences
- `wamHD`, `wamD`, `wamCR`, `wamP` - WAM grades (0-7)
- `dualEnrollment` - Dual degree ('yes'/'no')
- `skills` - Skills list (JSON)
- `description` - Group description
- `startTime`, `finishTime` - Timestamps
- `createdAt`, `updatedAt` - Creation/update time

#### projects table
- `id` - Primary key
- `projectName` - Project name
- `maxGroups` - Maximum number of groups
- `client` - Client
- `description` - Project description
- `deliverables` - Deliverables
- `specificSkills` - Specific skill requirements
- `generalFields` - General fields
- `tags` - Tags (JSON)
- `courseCode`, `semester`, `projectType` - Course information
- `deadline` - Deadline
- `startTime`, `finishTime` - Timestamps
- `createdAt`, `updatedAt` - Creation/update time

## Request/Response Format

### Create Group Example

**Request:**
```bash
curl -X POST http://localhost:3001/api/groups \
  -H 'Content-Type: application/json' \
  -d '{
    "groupName":"COMP3888_M10_03",
    "student1":"Alice, 5200000, aabc1234, COMP3888",
    "preference1":"P01",
    "wamHD":1, "wamD":2, "wamCR":3, "wamP":1,
    "dualEnrollment":"no",
    "skills":["Web Development","Machine Learning"],
    "description":"We are a strong web+ML team",
    "startTime":"2025/03/01 10:00:00",
    "finishTime":"2025/03/01 10:30:00"
  }'
```

**Response:**
```json
{
  "id": 1,
  "savedAt": "2025-03-01T12:34:56Z",
  "data": {
    "id": 1,
    "groupName": "COMP3888_M10_03",
    "skills": ["Web Development", "Machine Learning"],
    ...
  }
}
```

### Create Project Example

**Request:**
```bash
curl -X POST http://localhost:3001/api/projects \
  -H 'Content-Type: application/json' \
  -d '{
    "projectName":"Scene Graph Generation",
    "maxGroups":10,
    "client":"SCS academic",
    "description":"...",
    "deliverables":"Web app + graphs",
    "specificSkills":"JS/Python, Web dev, grades > 85",
    "tags":["Data Science","Web Development"],
    "startTime":"2025/03/01 11:00:00",
    "finishTime":"2025/03/01 11:20:00"
  }'
```

## Error Handling

All APIs return a unified error format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "field": "specific field error"
    }
  }
}
```

Common error codes:
- `VALIDATION_FAILED` - Request data validation failed
- `GROUP_NAME_CONFLICT` - Group name conflict
- `GROUP_NOT_FOUND` - Group not found
- `PROJECT_NOT_FOUND` - Project not found
- `INVALID_ID` - Invalid ID format
- `RATE_LIMIT_EXCEEDED` - Request rate limit exceeded
- `INTERNAL_SERVER_ERROR` - Internal server error

## Environment Variables

- `PORT` - Server port (default: 3001)

## Development

### Project Structure
```
backend/
├── src/
│   ├── app.js              # Main application file
│   ├── database/
│   │   └── init.js         # Database initialization
│   ├── routes/
│   │   ├── groups.js       # Group routes
│   │   └── projects.js     # Project routes
│   └── validation/
│       └── schemas.js      # Data validation schemas
├── data/
│   └── allocation.db      # SQLite database file (auto-created)
├── package.json
└── README.md
```

### Testing

```bash
npm test
```

## Frontend Integration

The frontend uses `fetch` API to call these interfaces. Ensure the frontend development server runs on `http://localhost:5173` (Vite default port) or `http://localhost:3000`, and the backend has configured CORS support for these domains.

The frontend can call the API like this:

```javascript
// Create group
const response = await fetch('http://localhost:3001/api/groups', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(groupData)
});

const result = await response.json();
```

## License

MIT License