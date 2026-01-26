#!/usr/bin/env pwsh
# Complete Blockchain Startup Script

$ErrorActionPreference = "Stop"
$ProjectRoot = "C:\Users\sruja\OneDrive\Desktop\Project"

function Print-Status { Write-Host "[✓] $args" -ForegroundColor Green }
function Print-Step { Write-Host "[→] $args" -ForegroundColor Yellow }
function Print-Error { Write-Host "[✗] $args" -ForegroundColor Red }

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Starting Hyperledger Fabric Blockchain          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Start Fabric Network
Print-Step "Starting Fabric Network (this takes 2-3 minutes)..."
Set-Location "$ProjectRoot\fabric-samples\test-network"

$env:PATH = "$ProjectRoot\fabric-samples\bin;$env:PATH"

# Start network and create channel
$output = bash -c "cd /mnt/c/Users/sruja/OneDrive/Desktop/Project/fabric-samples/test-network && export PATH=/mnt/c/Users/sruja/OneDrive/Desktop/Project/fabric-samples/bin:`$PATH && export FABRIC_CFG_PATH=/mnt/c/Users/sruja/OneDrive/Desktop/Project/fabric-samples/config && ./network.sh up createChannel -ca" 2>&1

if ($LASTEXITCODE -ne 0) {
    Print-Error "Failed to start network"
    Write-Host $output
    exit 1
}

Print-Status "Fabric network started and channel created"
Start-Sleep -Seconds 5

# Step 2: Deploy Chaincode
Print-Step "Deploying land registry chaincode (this takes 3-5 minutes)..."
$output = bash -c "cd /mnt/c/Users/sruja/OneDrive/Desktop/Project/fabric-samples/test-network && export PATH=/mnt/c/Users/sruja/OneDrive/Desktop/Project/fabric-samples/bin:`$PATH && export FABRIC_CFG_PATH=/mnt/c/Users/sruja/OneDrive/Desktop/Project/fabric-samples/config && ./network.sh deployCC -ccn landregistry -ccp ../../chaincode/land-registry -ccl go -ccv 1.3 -ccs 1" 2>&1

if ($LASTEXITCODE -ne 0) {
    Print-Error "Failed to deploy chaincode"
    Write-Host $output
    exit 1
}

Print-Status "Chaincode deployed successfully"
Start-Sleep -Seconds 3

# Step 3: Load Admin Identity
Print-Step "Loading admin identity to wallet..."
Set-Location "$ProjectRoot\realestate2\backend"

$output = node addAdminToWallet.js 2>&1
if ($LASTEXITCODE -ne 0) {
    Print-Error "Failed to load admin identity"
    Write-Host $output
    exit 1
}
Print-Status "Admin identity loaded"

# Step 4: Load Sample Data
Print-Step "Loading sample land records to blockchain..."
$output = node addSampleData.js 2>&1
if ($LASTEXITCODE -ne 0) {
    Print-Error "Failed to load sample data"
    Write-Host $output
    exit 1
}
Print-Status "Sample data loaded to blockchain"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   Blockchain Ready!                                ║" -ForegroundColor Green
Write-Host "║   ✓ Network running                                ║" -ForegroundColor Green
Write-Host "║   ✓ Chaincode deployed                             ║" -ForegroundColor Green
Write-Host "║   ✓ Sample data loaded                             ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Print-Step "You can now restart the backend server with blockchain enabled"


