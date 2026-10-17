# Python Environment Configuration Guide

The backend of this project will **automatically detect** available Python environments in the following priority order:

1. **Virtual Environment** (Recommended): `venv/bin/python`, `.venv/bin/python`, `env/bin/python`
2. **System Python3**: `python3`
3. **System Python**: `python`

## Method 1: Using Virtual Environment (Recommended)

### Automatic Setup
Run the provided setup script:

```bash
# Add execute permission to the script
chmod +x setup_venv.sh

# Run the script
./setup_venv.sh
```

### Manual Setup
If you want to set up manually:

```bash
# 1. Create virtual environment
python3 -m venv venv

# 2. Activate virtual environment
source venv/bin/activate

# 3. Install dependencies (if requirements.txt exists)
pip install -r requirements.txt

# Or install basic packages
pip install numpy pandas scikit-learn
```

### Using Virtual Environment
```bash
# Activate
source venv/bin/activate

# Your Python commands...
python allocation.py

# Deactivate when done
deactivate
```

## Method 2: Using System Python

If you don't want to use a virtual environment, the system will automatically detect and use system Python3 or Python.

### Confirm Python Availability
```bash
# Check Python3
python3 --version

# Or check Python
python --version
```

### Install Required Packages
```bash
# Using pip3
pip3 install numpy pandas scikit-learn

# Or using pip
pip install numpy pandas scikit-learn
```

## Verify Python Environment

The backend provides API endpoints to check the currently used Python environment:

```bash
# Get Python environment information
curl http://localhost:3002/api/allocation/python-info
```

Example response:
```json
{
  "success": true,
  "pythonCommand": "/home/jing/COMP3888/COMP3888_TU15_02_p42/venv/bin/python",
  "pythonVersion": "Python 3.12.3",
  "isVirtualEnv": true,
  "projectRoot": "/home/jing/COMP3888/COMP3888_TU15_02_p42/"
}
```

## Re-detect Python Environment

If you change the Python environment (e.g., create a new virtual environment), you can trigger re-detection:

```bash
# Reset Python detection
curl -X POST http://localhost:3002/api/allocation/python-reset
```

## Common Issues

### Q: Seeing "spawn python EACCES" error
**A:** This usually means the Python command is not available or doesn't have execute permissions. The system now automatically tries different Python commands.

### Q: How to confirm which Python is being used?
**A:** Check the backend logs, which will show: `🐍 Using Python command: /path/to/python`

### Q: Want to force using virtual environment
**A:** After creating a virtual environment, restart the backend server. The system will prioritize detecting and using the virtual environment.

### Q: What's the difference between virtual environment and system Python?
**A:** 
- **Virtual Environment**: Isolated Python environment, package dependencies don't interfere with each other, recommended for development
- **System Python**: Global Python environment, shared by all projects

## Directory Structure

```
COMP3888_TU15_02_p42/
├── venv/                    # Virtual environment (recommended to create)
│   └── bin/python          # Virtual environment's Python
├── allocation.py           # Allocation algorithm
├── setup_venv.sh          # Virtual environment setup script
├── requirements.txt       # Python dependencies (if exists)
└── backend/
    └── src/
        └── routes/
            └── allocation.js  # Backend code with automatic Python detection
```

## Execution Flow

1. **When starting backend**: Automatically detect available Python commands
2. **When running allocation**: Use detected Python command to execute
3. **Check logs**: Confirm Python version and path being used

## Additional Help

If you encounter issues, please check:
- Backend console logs for `✅ Detected Python command` messages
- Call `/api/allocation/python-info` API for detailed information

