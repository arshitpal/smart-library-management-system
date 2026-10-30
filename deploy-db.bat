@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-db.ps1"
pause
