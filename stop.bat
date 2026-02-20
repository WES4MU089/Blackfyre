@echo off
title Blackfyre - Shutdown
echo ========================================
echo       Blackfyre Dev Shutdown
echo ========================================
echo.

:: Kill ngrok
echo [1/4] Stopping ngrok...
taskkill /f /im ngrok.exe >nul 2>&1
if %errorlevel% equ 0 (echo       ngrok stopped.) else (echo       ngrok was not running.)

:: Kill node (backend + any tsx watchers)
echo [2/4] Stopping backend (node/tsx)...
taskkill /f /im node.exe >nul 2>&1
if %errorlevel% equ 0 (echo       Node processes stopped.) else (echo       No node processes found.)

:: Kill Electron (frontend)
echo [3/4] Stopping frontend (Electron)...
taskkill /f /im electron.exe >nul 2>&1
if %errorlevel% equ 0 (echo       Electron stopped.) else (echo       Electron was not running.)

:: Stop MariaDB service
echo [4/4] Stopping MariaDB...
net stop MariaDB >nul 2>&1
if %errorlevel% equ 0 (echo       MariaDB service stopped.) else (echo       MariaDB was not running.)

echo.
echo ========================================
echo  All Blackfyre services stopped.
echo ========================================
pause
