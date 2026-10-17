# Automated Project Allocation System - Complete User Manual

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Installation Guide](#installation-guide)
4. [Quick Start](#quick-start)
5. [User Interface Guide](#user-interface-guide)
6. [API Documentation](#api-documentation)
7. [Allocation Algorithm](#allocation-algorithm)
8. [Configuration](#configuration)
9. [Troubleshooting](#troubleshooting)
10. [Development Guide](#development-guide)
11. [Testing](#testing)
12. [Deployment](#deployment)
13. [Contributing](#contributing)

---

## 🎯 System Overview

The **Automated Project Allocation System** is a comprehensive web-based platform designed to streamline the process of allocating academic projects to student groups based on predefined criteria such as skills, preferences, academic performance, and project requirements.

### Key Features

- **🎨 Modern Web Interface**: Responsive React-based frontend with intuitive user experience
- **🔧 RESTful API**: Robust Node.js backend with comprehensive data validation
- **🤖 Intelligent Allocation**: AI-enhanced matching algorithm using machine learning
- **📊 Real-time Analytics**: Dashboard with allocation statistics and reporting
- **🔐 Secure Authentication**: Role-based access control for administrators and students
- **📱 Mobile Responsive**: Works seamlessly across desktop, tablet, and mobile devices
- **🧪 Comprehensive Testing**: Full test coverage with automated testing suite

### Target Users

- **Administrators**: Manage projects, groups, and allocation settings
- **Students**: Submit group information and project preferences
- **Academic Staff**: Monitor allocation results and generate reports

---

## 🏗️ Architecture

The system follows a modern three-tier architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (React/Vite)  │◄──►│   (Node.js)     │◄──►│   (SQLite)      │
│                 │    │                 │    │                 │
│ • User Interface│    │ • RESTful APIs  │    │ • Groups Data   │
│ • State Mgmt    │    │ • Authentication│    │ • Projects Data │
│ • Components    │    │ • Validation    │    │ • Allocations   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Radix UI for components
- Zustand for state management

**Backend:**
- Node.js with Express.js
- SQLite3 for database
- Joi for data validation
- Helmet for security
- Morgan for logging

**Allocation Engine:**
- Python with scikit-learn
- FAISS for vector similarity
- Sentence Transformers for NLP
- Pandas for data processing

---

## 🚀 Installation Guide

### Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.8 or higher)
- **npm** or **yarn**
- **Git**

### System Requirements

- **RAM**: Minimum 4GB, Recommended 8GB
- **Storage**: 2GB free space
- **OS**: Windows 10+, macOS 10.15+, or Linux (Best on Linux, not tested on other operating systems)

> Note: For best reliability and compatibility, we strongly recommend installing and deploying on Ubuntu/Linux (e.g., Ubuntu 20.04+).

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd COMP3888_TU15_02_p42
```

### Step 2: Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Start the backend server
npm run dev
```

The backend will start at `http://localhost:3001`

### Step 3: Frontend Setup

```bash
# Navigate to frontend directory (in a new terminal)
cd allocation_web

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will start at `http://localhost:5175`

### Step 4: Python Environment Setup

```bash
# Navigate to project root
cd ..

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### Step 5: Database Initialization

The SQLite database will be automatically created when you first start the backend server. The database file will be located at `backend/data/allocation.db`.

---

## ⚡ Quick Start

### For Administrators

1. **Access the System**
   - Open your browser and navigate to `http://localhost:5175`
   - Login with administrator credentials

2. **Create Projects**
   - Navigate to "Admin" → "Manage Projects"
   - Click "Add New Project"
   - Fill in project details (name, description, skills required, max groups)
   - Save the project

3. **Review Groups**
   - Navigate to "Admin" → "Manage Groups"
   - View submitted student groups
   - Edit group information if needed

4. **Run Allocation**
   - Navigate to "Admin" → "Allocation System"
   - Configure allocation weights
   - Click "Run Allocation" to execute the algorithm
   - Review and approve results

### For Students

1. **Access the System**
   - Navigate to `http://localhost:5175`
   - Login with student credentials

2. **Create Group**
   - Navigate to "Groups" → "Create New Group"
   - Fill in group information (members, skills, preferences)
   - Submit the group

3. **View Projects**
   - Navigate to "Projects" to browse available projects
   - Review project descriptions and requirements

4. **Check Allocation Results**
   - After allocation is complete, view your assigned project
   - Access project details and deliverables

---

## 🖥️ User Interface Guide

### Main Navigation

The system features a clean, intuitive interface with the following main sections:

#### 🏠 Dashboard
- **Overview**: System statistics and recent activity
- **Quick Actions**: Shortcuts to common tasks
- **Notifications**: Important updates and alerts

#### 👥 Groups Management
- **Create Group**: Form for submitting new student groups
- **View Groups**: List of all submitted groups
- **Edit Group**: Modify existing group information

#### 📋 Projects Management
- **Browse Projects**: Available projects with descriptions
- **Project Details**: Comprehensive project information
- **Requirements**: Skills and prerequisites

#### ⚙️ Admin Panel (Administrators Only)
- **Manage Groups**: Review and edit student groups
- **Manage Projects**: Create and update projects
- **Allocation System**: Configure and run allocation algorithm
- **Reports & Analytics**: Generate allocation reports
- **Settings**: System configuration options

#### 🔐 Authentication
- **Login**: Secure user authentication
- **Role Management**: Different access levels for users
- **Session Management**: Automatic logout for security

### Responsive Design

The interface automatically adapts to different screen sizes:
- **Desktop**: Full sidebar navigation with detailed views
- **Tablet**: Collapsible sidebar with optimized layouts
- **Mobile**: Bottom navigation with touch-friendly controls

---

## 📚 API Documentation

### Base URL
```
http://localhost:3001
```

### Authentication
All API endpoints require authentication except for health checks.

### Endpoints

#### Health Check
```http
GET /health
```
Returns server status and basic information.

#### Groups API

**Create Group**
```http
POST /api/groups
Content-Type: application/json

{
  "groupName": "COMP3888_M10_03",
  "student1": "Alice, 5200000, aabc1234, COMP3888",
  "student2": "Bob, 5200001, bdef5678, COMP3888",
  "preference1": "P01",
  "preference2": "P02",
  "wamHD": 1,
  "wamD": 2,
  "wamCR": 3,
  "wamP": 1,
  "dualEnrollment": "no",
  "skills": ["Web Development", "Machine Learning"],
  "description": "We are a strong web+ML team"
}
```

**Get All Groups**
```http
GET /api/groups
```

**Get Specific Group**
```http
GET /api/groups/:id
```

**Update Group**
```http
PUT /api/groups/:id
Content-Type: application/json

{
  "groupName": "Updated Group Name",
  "skills": ["Updated Skills"]
}
```

**Delete Group**
```http
DELETE /api/groups/:id
```

#### Projects API

**Create Project**
```http
POST /api/projects
Content-Type: application/json

{
  "projectName": "Scene Graph Generation",
  "maxGroups": 10,
  "client": "SCS academic",
  "description": "Develop a web application for scene graph generation",
  "deliverables": "Web app + documentation",
  "specificSkills": "JavaScript, Python, Web Development",
  "generalFields": "Computer Science",
  "tags": ["Data Science", "Web Development"],
  "courseCode": "COMP3888",
  "semester": "2025S1",
  "projectType": "Capstone",
  "deadline": "2025-06-30"
}
```

**Get All Projects**
```http
GET /api/projects
```

**Get Specific Project**
```http
GET /api/projects/:id
```

**Update Project**
```http
PUT /api/projects/:id
Content-Type: application/json

{
  "projectName": "Updated Project Name",
  "maxGroups": 15
}
```

**Delete Project**
```http
DELETE /api/projects/:id
```

#### Allocation API

**Run Allocation**
```http
POST /api/allocation/run
Content-Type: application/json

{
  "skillWeight": 0.4,
  "scoreWeight": 0.4,
  "descriptionWeight": 0.2
}
```

**Get Allocation Results**
```http
GET /api/allocation/results
```

**Update Allocation Weights**
```http
PUT /api/allocation/weights
Content-Type: application/json

{
  "skillWeight": 0.5,
  "scoreWeight": 0.3,
  "descriptionWeight": 0.2
}
```

### Response Format

All API responses follow a consistent format:

**Success Response**
```json
{
  "id": 1,
  "savedAt": "2025-03-01T12:34:56Z",
  "data": {
    "id": 1,
    "groupName": "COMP3888_M10_03",
    "skills": ["Web Development", "Machine Learning"]
  }
}
```

**Error Response**
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Group name is required",
    "details": {
      "groupName": "This field cannot be empty"
    }
  }
}
```

### Error Codes

- `VALIDATION_FAILED` - Request data validation failed
- `GROUP_NAME_CONFLICT` - Group name already exists
- `GROUP_NOT_FOUND` - Group with specified ID not found
- `PROJECT_NOT_FOUND` - Project with specified ID not found
- `INVALID_ID` - Invalid ID format provided
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `INTERNAL_SERVER_ERROR` - Server error

---

## 🤖 Allocation Algorithm

The system uses a sophisticated multi-factor allocation algorithm that considers multiple criteria to ensure optimal project-group matching.

### Algorithm Components

#### 1. Skill Matching (40% weight)
- **Semantic Analysis**: Uses sentence transformers to analyze project descriptions and group skills
- **Vector Similarity**: FAISS-based similarity matching between project requirements and group capabilities
- **Skill Categories**: Maps technical skills to project domains

#### 2. Academic Performance (40% weight)
- **WAM Calculation**: Weighted Average Mark analysis
- **Grade Distribution**: Considers HD, D, CR, P grade distributions
- **Performance Scoring**: Normalized scoring based on academic achievements

#### 3. Preference Matching (20% weight)
- **Preference Ranking**: Considers group's project preferences (1-5 ranking)
- **Preference Satisfaction**: Optimizes for higher preference satisfaction
- **Fallback Logic**: Automatic fallback to next preferences if primary choice unavailable

### Algorithm Process

1. **Data Preprocessing**
   - Normalize group and project data
   - Calculate skill vectors using NLP
   - Generate performance scores

2. **Similarity Calculation**
   - Compute skill similarity matrices
   - Calculate preference satisfaction scores
   - Generate performance-based rankings

3. **Optimization**
   - Use weighted scoring to rank all possible matches
   - Apply capacity constraints
   - Optimize for maximum satisfaction

4. **Result Generation**
   - Generate allocation results
   - Provide confidence scores
   - Enable manual override capabilities

### Configuration

The algorithm can be configured through the `config.yml` file:

```yaml
# Allocation weights (must sum to 1.0)
skillWeight: 0.4
scoreWeight: 0.4
descriptionWeight: 0.2

# Algorithm settings
maxIterations: 1000
convergenceThreshold: 0.001
enableFallback: true
```

---

## ⚙️ Configuration

### Backend Configuration

#### Environment Variables
```bash
# Server configuration
PORT=3001
NODE_ENV=development

# Database configuration
DB_PATH=./data/allocation.db

# Security configuration
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret

# CORS configuration
CORS_ORIGIN=http://localhost:5175
```

#### Database Configuration
The system uses SQLite for simplicity and portability. Database configuration is handled automatically, but you can customize:

- **Database Path**: Modify `DB_PATH` in environment variables
- **Connection Pooling**: Configured automatically
- **Backup Strategy**: Implement regular backups for production

### Frontend Configuration

#### Vite Configuration
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
```

#### API Configuration
```typescript
// src/api/config.ts
export const API_CONFIG = {
  BASE_URL: 'http://localhost:3001',
  ENDPOINTS: {
    GROUPS: '/api/groups',
    PROJECTS: '/api/projects',
    ALLOCATION: '/api/allocation'
  },
  TIMEOUT: 10000
}
```

### Python Configuration

#### Allocation Engine Settings
```python
# config.yml
skillWeight: 0.4
scoreWeight: 0.4
descriptionWeight: 0.2

# Model settings
modelName: "all-MiniLM-L6-v2"
similarityThreshold: 0.7
maxGroupsPerProject: 10
```

---

## 🔧 Troubleshooting

### Common Issues

#### Backend Issues

**Problem**: Server won't start
```bash
Error: Port 3001 is already in use
```
**Solution**:
```bash
# Kill process using port 3001
lsof -ti:3001 | xargs kill -9
# Or change port in package.json
```

**Problem**: Database connection error
```bash
Error: SQLITE_CANTOPEN: unable to open database file
```
**Solution**:
```bash
# Ensure data directory exists
mkdir -p backend/data
# Check file permissions
chmod 755 backend/data
```

#### Frontend Issues

**Problem**: Build fails with TypeScript errors
```bash
Type error: Property 'x' does not exist on type 'y'
```
**Solution**:
```bash
# Check TypeScript configuration
npm run lint
# Fix type definitions
# Update component props interfaces
```

**Problem**: API calls failing
```bash
CORS error: Access to fetch blocked
```
**Solution**:
```bash
# Ensure backend CORS is configured
# Check API base URL in frontend config
# Verify backend server is running
```

#### Python Issues

**Problem**: Import errors
```bash
ModuleNotFoundError: No module named 'faiss'
```
**Solution**:
```bash
# Ensure virtual environment is activated
source venv/bin/activate
# Reinstall requirements
pip install -r requirements.txt
```

**Problem**: Memory issues with large datasets
```bash
MemoryError: Unable to allocate array
```
**Solution**:
```bash
# Reduce batch size in processing
# Use chunked processing for large datasets
# Increase system memory or use cloud processing
```

### Performance Optimization

#### Database Optimization
- **Indexing**: Ensure proper indexes on frequently queried fields
- **Query Optimization**: Use efficient SQL queries
- **Connection Pooling**: Configure appropriate connection limits

#### Frontend Optimization
- **Code Splitting**: Implement lazy loading for components
- **Bundle Optimization**: Use Vite's built-in optimizations
- **Caching**: Implement appropriate caching strategies

#### Backend Optimization
- **Caching**: Implement Redis for session and data caching
- **Compression**: Enable gzip compression
- **Rate Limiting**: Configure appropriate rate limits

### Logging and Monitoring

#### Backend Logging
```javascript
// Morgan logging configuration
app.use(morgan('combined', {
  stream: fs.createWriteStream('./logs/access.log', { flags: 'a' })
}));
```

#### Error Tracking
```javascript
// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});
```

---

## 👨‍💻 Development Guide

### Project Structure

```
COMP3888_TU15_02_p42/
├── allocation_web/          # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── api/            # API client code
│   │   ├── hooks/          # Custom React hooks
│   │   ├── utils/          # Utility functions
│   │   └── test/           # Test files
│   ├── public/             # Static assets
│   └── package.json
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── database/       # Database initialization
│   │   ├── middleware/     # Express middleware
│   │   └── validation/     # Data validation schemas
│   ├── __tests__/          # Backend tests
│   └── package.json
├── allocation.py           # Python allocation engine
├── description_matcher.py  # NLP matching component
├── manager_operations.py   # Management operations
├── requirements.txt        # Python dependencies
└── config.yml             # Configuration file
```

### Development Workflow

#### 1. Setting Up Development Environment

```bash
# Clone repository
git clone <repository-url>
cd COMP3888_TU15_02_p42

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd allocation_web
npm install
cd ..

# Setup Python environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

#### 2. Running Development Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd allocation_web
npm run dev

# Terminal 3: Python allocation engine (when needed)
python allocation.py
```

#### 3. Code Standards

**Frontend (TypeScript/React)**
- Use TypeScript for type safety
- Follow React best practices
- Use functional components with hooks
- Implement proper error boundaries
- Write unit tests for components

**Backend (Node.js/Express)**
- Use async/await for asynchronous operations
- Implement proper error handling
- Validate all input data
- Write comprehensive API tests
- Follow RESTful API conventions

**Python (Allocation Engine)**
- Follow PEP 8 style guidelines
- Use type hints for better code clarity
- Implement comprehensive error handling
- Write unit tests for algorithms
- Document complex algorithms

### API Development

#### Adding New Endpoints

1. **Define Route**
```javascript
// backend/src/routes/newRoute.js
const express = require('express');
const router = express.Router();

router.get('/new-endpoint', async (req, res) => {
  try {
    // Implementation
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

2. **Add to Main App**
```javascript
// backend/src/app.js
const newRoute = require('./routes/newRoute');
app.use('/api/new', newRoute);
```

3. **Create Frontend API Client**
```typescript
// allocation_web/src/api/newApi.ts
export const getNewData = async () => {
  const response = await fetch('/api/new/new-endpoint');
  return response.json();
};
```

### Database Schema Changes

#### Adding New Tables
```sql
-- Create migration file
-- backend/migrations/001_add_new_table.sql
CREATE TABLE new_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Updating Existing Tables
```sql
-- Add new column
ALTER TABLE groups ADD COLUMN new_field TEXT;

-- Update indexes
CREATE INDEX idx_groups_new_field ON groups(new_field);
```

---

## 🧪 Testing

### Testing Strategy

The system implements comprehensive testing across all layers:

#### Frontend Testing
- **Unit Tests**: Component testing with React Testing Library
- **Integration Tests**: API integration testing
- **E2E Tests**: End-to-end user workflow testing
- **Visual Tests**: UI component visual regression testing

#### Backend Testing
- **Unit Tests**: Individual function testing
- **Integration Tests**: API endpoint testing
- **Database Tests**: Database operation testing
- **Performance Tests**: Load and stress testing

#### Python Testing
- **Algorithm Tests**: Allocation algorithm validation
- **Data Processing Tests**: Data transformation testing
- **ML Model Tests**: Machine learning model validation

### Running Tests

#### Frontend Tests
```bash
cd allocation_web

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in UI mode
npm run test:ui

# Generate test report
npm run test:report
```

#### Backend Tests
```bash
cd backend

# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- groups.test.js
```

#### Python Tests
```bash
# Activate virtual environment
source venv/bin/activate

# Run all tests
python -m pytest testcase/

# Run specific test file
python -m pytest testcase/test_allocation.py

# Run with coverage
python -m pytest --cov=allocation testcase/
```

### Test Data Management

#### Test Database
```bash
# Create test database
cp backend/data/allocation.db backend/data/test.db

# Reset test data
npm run test:reset-db
```

#### Mock Data
```javascript
// Frontend test mocks
const mockGroupData = {
  groupName: "Test Group",
  student1: "Test Student",
  skills: ["Testing"]
};

// Backend test fixtures
const testGroups = [
  { id: 1, groupName: "Group 1" },
  { id: 2, groupName: "Group 2" }
];
```

### Continuous Integration

#### GitHub Actions Workflow
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on: [push, pull_request]

jobs:
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd allocation_web && npm install
      - name: Run tests
        run: cd allocation_web && npm test

  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd backend && npm install
      - name: Run tests
        run: cd backend && npm test

  python-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.8'
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run tests
        run: python -m pytest testcase/
```

---

## 🚀 Deployment

### Production Deployment

#### Environment Setup

**Server Requirements:**
- Ubuntu 20.04+ or CentOS 8+
- Node.js 18+
- Python 3.8+
- Nginx (for reverse proxy)
- SSL certificate

#### Backend Deployment

1. **Prepare Production Build**
```bash
cd backend
npm install --production
npm run build
```

2. **Configure Environment**
```bash
# Create production environment file
cat > .env.production << EOF
NODE_ENV=production
PORT=3001
DB_PATH=/var/lib/allocation/data.db
JWT_SECRET=your-production-secret
CORS_ORIGIN=https://yourdomain.com
EOF
```

3. **Setup Process Manager**
```bash
# Install PM2
npm install -g pm2

# Create PM2 configuration
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'allocation-backend',
    script: 'src/app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Frontend Deployment

1. **Build Production Bundle**
```bash
cd allocation_web
npm run build
```

2. **Deploy Static Files**
```bash
# Copy build files to web server
cp -r dist/* /var/www/html/
```

3. **Configure Nginx**
```nginx
# /etc/nginx/sites-available/allocation
server {
    listen 80;
    server_name yourdomain.com;
    
    # Frontend
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Python Allocation Engine Deployment

1. **Setup Python Environment**
```bash
# Create production virtual environment
python3 -m venv /opt/allocation/venv
source /opt/allocation/venv/bin/activate
pip install -r requirements.txt
```

2. **Configure System Service**
```bash
# Create systemd service
cat > /etc/systemd/system/allocation-engine.service << EOF
[Unit]
Description=Allocation Engine Service
After=network.target

[Service]
Type=simple
User=allocation
WorkingDirectory=/opt/allocation
Environment=PATH=/opt/allocation/venv/bin
ExecStart=/opt/allocation/venv/bin/python allocation.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl enable allocation-engine
systemctl start allocation-engine
```

### Docker Deployment

#### Docker Compose Setup
```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DB_PATH=/data/allocation.db
    volumes:
      - ./data:/data
    depends_on:
      - db

  frontend:
    build: ./allocation_web
    ports:
      - "80:80"
    depends_on:
      - backend

  allocation-engine:
    build: .
    volumes:
      - ./data:/data
      - ./config.yml:/app/config.yml
    depends_on:
      - db

  db:
    image: sqlite:latest
    volumes:
      - ./data:/data
```

#### Dockerfile Examples

**Backend Dockerfile**
```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
EXPOSE 3001

CMD ["npm", "start"]
```

**Frontend Dockerfile**
```dockerfile
# allocation_web/Dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Monitoring and Maintenance

#### Health Checks
```bash
# Backend health check
curl http://localhost:3001/health

# Frontend health check
curl http://localhost:5175/

# Database health check
sqlite3 /data/allocation.db "SELECT COUNT(*) FROM groups;"
```

#### Log Management
```bash
# Setup log rotation
cat > /etc/logrotate.d/allocation << EOF
/var/log/allocation/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 allocation allocation
}
EOF
```

#### Backup Strategy
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/allocation"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
cp /data/allocation.db $BACKUP_DIR/allocation_$DATE.db

# Backup configuration
cp config.yml $BACKUP_DIR/config_$DATE.yml

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
find $BACKUP_DIR -name "*.yml" -mtime +30 -delete
```

---

## 🤝 Contributing

### Development Guidelines

#### Code Style
- **Frontend**: Follow ESLint configuration and Prettier formatting
- **Backend**: Use ESLint with Node.js best practices
- **Python**: Follow PEP 8 with Black formatting

#### Git Workflow
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create pull request
git push origin feature/new-feature
```

#### Commit Message Convention
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Build process or auxiliary tool changes

### Pull Request Process

1. **Fork the repository**
2. **Create feature branch**
3. **Make changes with tests**
4. **Update documentation**
5. **Submit pull request**
6. **Address review feedback**
7. **Merge after approval**

### Issue Reporting

When reporting issues, please include:
- **Environment**: OS, Node.js version, Python version
- **Steps to reproduce**: Detailed steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Screenshots**: If applicable
- **Logs**: Relevant error logs

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📞 Support

For support and questions:
- **Documentation**: Check this user manual
- **Issues**: Create GitHub issues for bugs
- **Discussions**: Use GitHub discussions for questions
- **Email**: Contact the development team

---

## 🏆 Acknowledgments

- **University of Sydney**: School of Computer Science
- **COMP3888 Course**: Capstone Project Course
- **Development Team**: John Guo, Mike Liu, Xu Wang, Jing Fang, Yuxiang Zhang
- **Open Source Libraries**: React, Node.js, Express, SQLite, Python ecosystem

---

*Last updated: March 2025*
*Version: 1.0.0*
