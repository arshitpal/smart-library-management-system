@echo off
rem Opens one window for each service, then the app in your browser.
set ROOT=%~dp0
start "Smart Library ML" cmd /k "cd /d "%ROOT%ml-service" && .venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001"
start "Smart Library API" cmd /k "cd /d "%ROOT%backend" && node server.js"
start "Smart Library Web" cmd /k "cd /d "%ROOT%frontend" && npm run dev"
timeout /t 6 /nobreak >nul
start "" http://localhost:5180
