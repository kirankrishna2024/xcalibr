#!/bin/bash
# XCalibr Backend Startup Script
# Run this from the /backend directory

echo "🚀 Starting XCalibr Backend..."

# Check .env exists
if [ ! -f ".env" ]; then
  echo "❌ ERROR: .env file not found!"
  echo "   Copy .env.example to .env and fill in your database URL and secret key."
  exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Start server
echo "✅ Starting FastAPI server on http://127.0.0.1:8000"
uvicorn main:app --reload --host 127.0.0.1 --port 8000
