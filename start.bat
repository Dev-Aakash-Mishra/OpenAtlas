@echo off
setlocal

echo [1/4] Installing Python Dependencies...
call pip install -r requirements.txt --quiet

echo [2/4] Cleaning up previous processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /f /pid %%a >nul 2>&1

echo [3/4] Starting Backend (Python/FastAPI)...
start /B python -B backend/server.py

echo [4/4] Checking Frontend Build...
if exist frontend\dist\index.html goto skip_build

echo Building Frontend (This may take a minute)...
cd frontend
call npm install --quiet
call npm run build
cd ..
goto launch

:skip_build
echo Frontend already built. Skipping build step.

:launch
echo [5/5] Launching OpenAtlas...
timeout /t 5 /nobreak > nul
start http://localhost:8000

echo.
echo ==========================================
echo OpenAtlas is running at http://localhost:8000
echo Backend PID is backgrounded. 
echo To stop, close this terminal and kill python processes.
echo ==========================================
echo.
pause
