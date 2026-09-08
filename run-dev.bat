@echo off
setlocal
cd /d "%~dp0"

set "ROOT=%CD%"
set "VENV_PYTHON=%ROOT%\.venv\Scripts\python.exe"
set "FRONTEND_ROOT=%ROOT%\frontend"

if not exist "%VENV_PYTHON%" (
    echo Virtual environment Python not found at:
    echo %VENV_PYTHON%
    echo Run: python -m venv .venv
    pause
    exit /b 1
)

if not exist "%FRONTEND_ROOT%\package.json" (
    echo Frontend package.json not found at:
    echo %FRONTEND_ROOT%\package.json
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo Node/npm not found in PATH.
    pause
    exit /b 1
)

if not exist "%FRONTEND_ROOT%\node_modules" (
    echo Frontend dependencies not found.
    echo Run: cd frontend ^&^& npm install
    pause
    exit /b 1
)

set "DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/inkknits"
set "JWT_SECRET_KEY=67ygHSIK347R91MkSd0F51G6skKfI63CrPoLB7oE8Mz"

start "InkKnits Backend" cmd /k "cd /d "%ROOT%" && set "DATABASE_URL=%DATABASE_URL%" && set "JWT_SECRET_KEY=%JWT_SECRET_KEY%" && "%VENV_PYTHON%" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"
start "InkKnits Frontend" cmd /k "cd /d "%FRONTEND_ROOT%" && npm run dev -- --host 127.0.0.1 --port 5173"

echo InkKnits backend and frontend started in separate terminals.
echo Backend: http://127.0.0.1:8000
echo Frontend: http://127.0.0.1:5173
endlocal
