#!/bin/bash

echo "[1/4] Installing Python Dependencies..."
pip3 install -r requirements.txt --quiet

echo "[2/4] Starting Backend (Python/FastAPI)..."
python3 -B backend/server.py &
BACKEND_PID=$!

echo "[3/4] Checking Frontend Build..."
if [ -f "frontend/dist/index.html" ]; then
    echo "Frontend already built. Skipping build step."
else
    echo "Building Frontend..."
    cd frontend
    npm install --quiet
    npm run build
    cd ..
fi

echo "[4/4] Launching OpenAtlas..."
sleep 5
if command -v xdg-open > /dev/null; then
  xdg-open http://localhost:8000
elif command -v open > /dev/null; then
  open http://localhost:8000
fi

echo ""
echo "OpenAtlas is running at http://localhost:8000"
echo "Press Ctrl+C to stop."
echo ""

# Wait for backend
wait $BACKEND_PID
