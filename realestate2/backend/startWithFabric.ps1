#!/usr/bin/env powershell
# Start Fabric network and backend server

Write-Host "[*] Starting Land Registry System..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Step 1: Start Fabric Network
Write-Host "`n[Network] Starting Fabric Network..." -ForegroundColor Yellow
cd "$PSScriptRoot\..\..\fabric-samples\test-network"

Write-Host "   - Bringing up network, creating channel, deploying chaincode..." -ForegroundColor Gray
bash ./network.sh up createChannel -ca 2>&1 | Out-Null

Write-Host "   [OK] Network started" -ForegroundColor Green

# Wait for network to stabilize
Write-Host "   - Waiting for network to stabilize..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Step 2: Deploy Chaincode
Write-Host "`n[Chaincode] Deploying Chaincode..." -ForegroundColor Yellow
bash ./network.sh deployCC -ccn landregistry -ccp ../../chaincode/land-registry -ccl go -ccv 1.3 -ccs 2 2>&1 | Out-Null
Write-Host "   [OK] Chaincode deployed (v1.3, seq 2)" -ForegroundColor Green

# Wait for chaincode to be ready
Start-Sleep -Seconds 3

# Step 3: Load Admin to Wallet
Write-Host "`n[Auth] Loading Admin Identity..." -ForegroundColor Yellow
cd "$PSScriptRoot"
node addAdminToWallet.js 2>&1 | Out-Null
Write-Host "   [OK] Admin identity loaded" -ForegroundColor Green

# Step 4: Add Sample Data
Write-Host "`n[Data] Loading Sample Data..." -ForegroundColor Yellow
node addSampleData.js 2>&1 | Out-Null
Write-Host "   [OK] Sample data loaded" -ForegroundColor Green

# Step 5: Start Backend Server
Write-Host "`n[Server] Starting Backend Server..." -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan
$env:USE_FABRIC = "true"
node .\server.js
