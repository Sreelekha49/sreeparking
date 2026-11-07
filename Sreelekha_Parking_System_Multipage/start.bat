@echo off
title Sreelekha Parking Management System
echo ====================================================================
echo Starting Sreelekha Parking Lot Management System...
echo ====================================================================

:: Navigate to backend
cd /d "%~dp0backend"

:: Launch browser in background after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000"

:: Start Node Express server
npm start

pause
