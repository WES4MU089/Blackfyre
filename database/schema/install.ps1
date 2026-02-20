<# 
Dragon's Dominion Database Installation Script
Run this from PowerShell to install the complete database schema
#>

param(
    [string]$MariaDBPath = "C:\Program Files\MariaDB 12.1\bin",
    [string]$User = "root",
    [string]$Database = "blackfyre_hud"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Dragon's Dominion Database Installation ===" -ForegroundColor Cyan
Write-Host ""

# Check MariaDB path
$mysqlPath = Join-Path $MariaDBPath "mysql.exe"
if (-not (Test-Path $mysqlPath)) {
    Write-Host "Error: mysql.exe not found at $mysqlPath" -ForegroundColor Red
    Write-Host "Please update the MariaDBPath parameter" -ForegroundColor Yellow
    exit 1
}

# Get password
$password = Read-Host "Enter MariaDB password for $User" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
$plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Schema directory
$schemaDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# SQL files in order
$sqlFiles = @(
    "01_accounts.sql",
    "02_characters.sql",
    "03_npcs.sql",
    "04_retainers.sql",
    "05_holdings.sql",
    "06_resources.sql",
    "07_military.sql",
    "08_diplomacy.sql",
    "09_world_map.sql",
    "10_equipment.sql",
    "11_audit.sql"
)

# Create database if not exists
Write-Host "Creating database $Database..." -ForegroundColor Yellow
$createDbSql = "CREATE DATABASE IF NOT EXISTS $Database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
& $mysqlPath -u $User -p"$plainPassword" -e $createDbSql
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create database" -ForegroundColor Red
    exit 1
}
Write-Host "Database ready." -ForegroundColor Green

# Disable foreign key checks
Write-Host "Disabling foreign key checks..." -ForegroundColor Yellow
& $mysqlPath -u $User -p"$plainPassword" $Database -e "SET FOREIGN_KEY_CHECKS = 0;"

# Run each SQL file
foreach ($file in $sqlFiles) {
    $filePath = Join-Path $schemaDir $file
    if (-not (Test-Path $filePath)) {
        Write-Host "Warning: $file not found, skipping..." -ForegroundColor Yellow
        continue
    }
    
    Write-Host "Installing $file..." -ForegroundColor Cyan
    Get-Content $filePath | & $mysqlPath -u $User -p"$plainPassword" $Database
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error installing $file" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Done." -ForegroundColor Green
}

# Re-enable foreign key checks
Write-Host "Re-enabling foreign key checks..." -ForegroundColor Yellow
& $mysqlPath -u $User -p"$plainPassword" $Database -e "SET FOREIGN_KEY_CHECKS = 1;"

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Green
Write-Host ""

# Show summary
Write-Host "Database Summary:" -ForegroundColor Cyan
$summary = @"
SELECT 
    'Tables' AS Type, COUNT(*) AS Count 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = '$Database'
UNION ALL
SELECT 
    'Procedures' AS Type, COUNT(*) AS Count 
FROM information_schema.ROUTINES 
WHERE ROUTINE_SCHEMA = '$Database' AND ROUTINE_TYPE = 'PROCEDURE'
UNION ALL
SELECT 
    'Views' AS Type, COUNT(*) AS Count 
FROM information_schema.VIEWS 
WHERE TABLE_SCHEMA = '$Database'
UNION ALL
SELECT 
    'Triggers' AS Type, COUNT(*) AS Count 
FROM information_schema.TRIGGERS 
WHERE TRIGGER_SCHEMA = '$Database';
"@

& $mysqlPath -u $User -p"$plainPassword" -e $summary

Write-Host ""
Write-Host "To connect to your database:" -ForegroundColor Yellow
Write-Host "  & '$mysqlPath' -u $User -p $Database" -ForegroundColor White
