#!/bin/bash
# Python virtual environment setup script

echo "🐍 Setting up Python virtual environment..."

# Check if Python3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Please install Python3 first."
    exit 1
fi

echo "✅ Python3 found: $(python3 --version)"

# Create virtual environment
if [ -d "venv" ]; then
    echo "⚠️  Virtual environment already exists. Removing old one..."
    rm -rf venv
fi

echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment and install dependencies
echo "🔧 Installing dependencies..."
source venv/bin/activate

# Check if requirements.txt exists
if [ -f "requirements.txt" ]; then
    echo "📋 Installing packages from requirements.txt..."
    pip install --upgrade pip
    pip install -r requirements.txt
else
    echo "⚠️  No requirements.txt found. Installing basic packages..."
    pip install --upgrade pip
    pip install numpy pandas scikit-learn
fi

echo ""
echo "✅ Virtual environment setup complete!"
echo ""
echo "📌 To activate the virtual environment, run:"
echo "   source venv/bin/activate"
echo ""
echo "📌 To deactivate, run:"
echo "   deactivate"
echo ""
echo "🚀 The backend will automatically detect and use this virtual environment!"

