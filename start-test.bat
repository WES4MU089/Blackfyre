@echo off
title Blackfyre - Test Client
echo ========================================
echo       Blackfyre Test Client
echo ========================================
echo.

echo Starting test client (Electron #2)...
cd /d d:\Blackfyre\frontend
set BLACKFYRE_TEST_CLIENT=1
npm run dev:test
