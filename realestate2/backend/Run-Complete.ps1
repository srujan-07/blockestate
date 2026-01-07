# Complete Land Registry System Startup Script
# Starts Fabric network + chaincode + backend in one command

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)

function Print-Status { Write-Host "[OK] $args" -ForegroundColor Green }
function Print-Step { Write-Host "[>>] $args" -ForegroundColor Yellow }
function Print-Error { Write-Host "[ER] $args" -ForegroundColor Red }

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Land Registry System - Complete Startup          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

try {
    # Step 1: Reset and Start Fabric Network
    Print-Step "Resetting any existing network (safe cleanup)..."
    Set-Location "$ProjectRoot\fabric-samples\test-network"
    $null = bash ./network.sh down 2>&1
    Print-Status "Cleanup done"

    Print-Step "Starting Fabric Network and creating channel..."
    $output = bash ./network.sh up createChannel -ca 2>&1
    if ($LASTEXITCODE -ne 0) {
        Print-Error "Failed to start Fabric network"
        Write-Host $output
        exit 1
    }
    Print-Status "Fabric network started and channel created"
    
    # Wait for stabilization
    Print-Step "Waiting for network to stabilize (5 seconds)..."
    Start-Sleep -Seconds 5
    
    # Step 2: Deploy Chaincode
    Print-Step "Deploying chaincode (landregistry v1.3, sequence 1)..."
    $output = bash ./network.sh deployCC -ccn landregistry -ccp ../../chaincode/land-registry -ccl go -ccv 1.3 -ccs 1 2>&1
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
    Print-Step "Loading sample land records..."
    $output = node addSampleData.js 2>&1
    if ($LASTEXITCODE -ne 0) {
        Print-Error "Failed to load sample data"
        Write-Host $output
        exit 1
    }
    Print-Status "Sample data loaded (3 properties)"
    
    # Step 5: Start Backend
    Print-Step "Starting backend server on http://localhost:4000..."
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║   System Ready!                                    ║" -ForegroundColor Cyan
    Write-Host "║   Backend: http://localhost:4000                   ║" -ForegroundColor Cyan
    Write-Host "║   Blockchain Mode: ENABLED                         ║" -ForegroundColor Cyan
    Write-Host "║   Press Ctrl+C to stop                             ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    $env:USE_FABRIC = "true"
    & node .\server.js
}
catch {
    Print-Error $_.Exception.Message
    exit 1
}
