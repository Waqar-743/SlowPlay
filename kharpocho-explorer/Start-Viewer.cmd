@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer, then open this file again.
  pause
  exit /b 1
)
if not exist "node_modules\vite" (
  echo Preparing the viewer dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependencies could not be installed. Check your connection and try again.
    pause
    exit /b 1
  )
)
echo.
echo Open http://127.0.0.1:5173 in your browser.
echo Keep this window open while exploring. Press Ctrl+C to stop.
echo.
call npm run dev
