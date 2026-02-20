@echo off
title Blackfyre - Startup
echo ========================================
echo        Blackfyre Dev Environment
echo ========================================
echo.

:: Kill any leftover processes from a previous session
echo Cleaning up stale processes...
taskkill /f /im ngrok.exe >nul 2>&1
taskkill /f /im electron.exe >nul 2>&1

:: Check if port 3000 is in use
powershell -Command "if (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }" >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Port 3000 is in use. Killing node processes...
    taskkill /f /im node.exe >nul 2>&1
    timeout /t 2 /nobreak >nul
)

echo.

:: Ensure MariaDB service is running
echo [1/4] Starting MariaDB...
sc query MariaDB | findstr "RUNNING" >nul 2>&1
if %errorlevel% equ 0 (
    echo        MariaDB service already running.
) else (
    net start MariaDB >nul 2>&1
    if %errorlevel% equ 0 (
        echo        MariaDB service started.
    ) else (
        echo        [!] Failed to start MariaDB. Try running start.bat as Administrator.
    )
    timeout /t 3 /nobreak >nul
)

:: Start ngrok tunnel in background
echo [2/4] Starting ngrok tunnel...
start "Blackfyre - ngrok" cmd /k "ngrok http 3000 --domain lastlight.ngrok.io"
timeout /t 3 /nobreak >nul

:: Start backend in background
echo [3/4] Starting backend server...
start "Blackfyre - Backend" cmd /k "cd /d d:\Blackfyre\backend && npm run dev"
timeout /t 5 /nobreak >nul

:: Start frontend in background
echo [4/4] Starting frontend (Electron)...
start "Blackfyre - Frontend" cmd /k "cd /d d:\Blackfyre\frontend && npm run dev"

echo.
echo ========================================
echo  All services launched!
echo  - MariaDB:    localhost:3306 (service)
echo  - ngrok:      lastlight.ngrok.io -^> :3000
echo  - Backend:    http://localhost:3000
echo  - Frontend:   Electron dev mode
echo ========================================
echo.
echo Use stop.bat to shut everything down.
