# Start Fabric Network with Correct Paths
# This script sets up the PATH and starts the Fabric network

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Land Registry Network Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set Fabric binaries path
$FABRIC_BIN = "C:\Users\sruja\OneDrive\Desktop\Project\fabric-samples\bin"
$env:PATH = "$FABRIC_BIN;$env:PATH"

Write-Host "[1/4] Setting up Fabric binaries path..." -ForegroundColor Yellow
Write-Host "Fabric binaries: $FABRIC_BIN" -ForegroundColor Gray

# Verify binaries exist
if (Test-Path "$FABRIC_BIN\cryptogen") {
    Write-Host "✓ cryptogen found" -ForegroundColor Green
} else {
    Write-Host "✗ cryptogen not found" -ForegroundColor Red
    exit 1
}

if (Test-Path "$FABRIC_BIN\configtxgen") {
    Write-Host "✓ configtxgen found" -ForegroundColor Green
} else {
    Write-Host "✗ configtxgen not found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/4] Cleaning up old network..." -ForegroundColor Yellow

# Stop any running containers
docker-compose -f docker-compose.yaml down -v 2>$null

# Clean up crypto material
if (Test-Path "crypto-config") {
    Remove-Item -Recurse -Force crypto-config
    Write-Host "✓ Removed old crypto-config" -ForegroundColor Green
}

if (Test-Path "channel-artifacts") {
    Remove-Item -Recurse -Force channel-artifacts
    New-Item -ItemType Directory -Path channel-artifacts | Out-Null
    Write-Host "✓ Cleaned channel-artifacts" -ForegroundColor Green
} else {
    New-Item -ItemType Directory -Path channel-artifacts | Out-Null
}

Write-Host ""
Write-Host "[3/4] Generating crypto material..." -ForegroundColor Yellow

# Generate crypto material
& "$FABRIC_BIN\cryptogen" generate --config=cryptogen.yaml --output=crypto-config

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Crypto material generated" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to generate crypto material" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[4/4] Starting Docker containers..." -ForegroundColor Yellow

# Start the network
docker-compose -f docker-compose.yaml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Network started successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to start network" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Network Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Show running containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host ""
Write-Host "✅ Fabric network is running!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Create channels: bash scripts/create-channels.sh" -ForegroundColor Gray
Write-Host "2. Deploy chaincode: bash scripts/deploy-chaincode.sh" -ForegroundColor Gray
Write-Host "3. Generate connection profile for backend" -ForegroundColor Gray
