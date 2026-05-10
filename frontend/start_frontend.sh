#!/bin/bash
# XCalibr Frontend Startup Script
# Run this from the /frontend directory

echo "🚀 Starting XCalibr Frontend..."

# Install node modules if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing npm packages..."
  npm install
fi

echo "✅ Starting Vite dev server on http://localhost:5173"
npm run dev
