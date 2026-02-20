# Blackfyre HUD - Start Services Script
# Run with: .\start.ps1

$ErrorActionPreference = "Stop"

# Add MariaDB to PATH
$env:Path += ";C:\Program Files\MariaDB 12.1\bin"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Blackfyre HUD - Service Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if MariaDB is running
Write-Host "`n[1/3] Checking MariaDB..." -ForegroundColor Yellow
try {
    $result = & mariadb -u root -e "SELECT 1;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ MariaDB is running" -ForegroundColor Green
    } else {
        throw "MariaDB not responding"
    }
} catch {
    Write-Host "  ✗ MariaDB is not running. Starting..." -ForegroundColor Red
    Start-Process -FilePath "C:\Program Files\MariaDB 12.1\bin\mariadbd.exe" -ArgumentList "--console" -WindowStyle Minimized
    Start-Sleep -Seconds 3
    Write-Host "  ✓ MariaDB started" -ForegroundColor Green
}

# Check database exists
Write-Host "`n[2/3] Checking database..." -ForegroundColor Yellow
$dbCheck = & mariadb -u root -e "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'blackfyre_hud';" 2>&1
if ($dbCheck -match "blackfyre_hud") {
    Write-Host "  ✓ Database 'blackfyre_hud' exists" -ForegroundColor Green
} else {
    Write-Host "  ✗ Database not found. Creating..." -ForegroundColor Red
    Get-Content "$PSScriptRoot\database\schema.sql" -Raw | & mariadb -u root
    Write-Host "  ✓ Database created" -ForegroundColor Green
}

# Start Backend Server
Write-Host "`n[3/3] Starting Backend Server..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\backend"
$backendProcess = Start-Process -FilePath "npx" -ArgumentList "tsx", "src/index.ts" -PassThru -WindowStyle Normal
Start-Sleep -Seconds 2

# Verify server started
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method GET -TimeoutSec 5
    Write-Host "  ✓ Backend server running at http://localhost:3000" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Backend server failed to start" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Services Started Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  API:        http://localhost:3000/api"
Write-Host "  Health:     http://localhost:3000/health"
Write-Host "  WebSocket:  ws://localhost:3000"
Write-Host ""
Write-Host "  CLI Tools:  cd backend && npm run db:cli"
Write-Host ""

Set-Location $PSScriptRoot
