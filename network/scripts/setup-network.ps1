# Complete Fabric Network Setup Script for Windows
# This script sets up the entire custom Land Registry Fabric network

param(
    [switch]$Clean = $false
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Land Registry Fabric Network Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set Fabric binaries path
$FABRIC_BIN = "C:\Users\sruja\OneDrive\Desktop\Project\fabric-samples\bin"
$env:PATH = "$FABRIC_BIN;$env:PATH"

# Verify binaries
Write-Host "[1/7] Verifying Fabric binaries..." -ForegroundColor Yellow
$requiredBinaries = @("cryptogen", "configtxgen", "peer")
$allFound = $true

foreach ($binary in $requiredBinaries) {
    $binaryPath = Join-Path $FABRIC_BIN "$binary.exe"
    if (-not (Test-Path $binaryPath)) {
        $binaryPath = Join-Path $FABRIC_BIN $binary
    }
    
    if (Test-Path $binaryPath) {
        Write-Host "  ✓ $binary found" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $binary not found" -ForegroundColor Red
        $allFound = $false
    }
}

if (-not $allFound) {
    Write-Host ""
    Write-Host "Error: Required Fabric binaries not found in $FABRIC_BIN" -ForegroundColor Red
    Write-Host "Please ensure fabric-samples/bin contains the required tools" -ForegroundColor Yellow
    exit 1
}

# Clean up old network if requested
if ($Clean) {
    Write-Host ""
    Write-Host "[2/7] Cleaning up old network..." -ForegroundColor Yellow
    
    # Stop containers
    docker-compose -f docker-compose.yaml down -v 2>$null
    
    # Remove crypto materials
    if (Test-Path "crypto-config") {
        Remove-Item -Recurse -Force crypto-config
        Write-Host "  ✓ Removed crypto-config" -ForegroundColor Green
    }
    
    # Clean channel artifacts
    if (Test-Path "channel-artifacts") {
        Remove-Item -Recurse -Force channel-artifacts
        Write-Host "  ✓ Removed channel-artifacts" -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "[2/7] Checking existing setup..." -ForegroundColor Yellow
    if (Test-Path "crypto-config") {
        Write-Host "  ! crypto-config exists (use -Clean to regenerate)" -ForegroundColor Yellow
    }
}

# Create directories
Write-Host ""
Write-Host "[3/7] Creating directory structure..." -ForegroundColor Yellow

if (-not (Test-Path "channel-artifacts")) {
    New-Item -ItemType Directory -Path "channel-artifacts" | Out-Null
    Write-Host "  ✓ Created channel-artifacts/" -ForegroundColor Green
}

# Generate crypto materials
Write-Host ""
Write-Host "[4/7] Generating cryptographic materials..." -ForegroundColor Yellow

if (-not (Test-Path "crypto-config")) {
    & "$FABRIC_BIN\cryptogen" generate --config=cryptogen.yaml --output=crypto-config
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Crypto materials generated" -ForegroundColor Green
        Write-Host "    - Orderer certificates" -ForegroundColor Gray
        Write-Host "    - CCLB peer certificates" -ForegroundColor Gray
        Write-Host "    - StateOrgTS peer certificates" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ Failed to generate crypto materials" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ! Using existing crypto-config" -ForegroundColor Yellow
}

# Set environment for configtxgen
$env:FABRIC_CFG_PATH = $PWD

# Generate genesis block
Write-Host ""
Write-Host "[5/7] Generating genesis block..." -ForegroundColor Yellow

$genesisBlock = "channel-artifacts\orderer.genesis.block"
if (-not (Test-Path $genesisBlock)) {
    & "$FABRIC_BIN\configtxgen" -profile LandRegistryOrdererGenesis -channelID system-channel -outputBlock $genesisBlock
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Genesis block created: $genesisBlock" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to create genesis block" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ! Using existing genesis block" -ForegroundColor Yellow
}

# Generate channel configuration transactions
Write-Host ""
Write-Host "[6/7] Generating channel configuration transactions..." -ForegroundColor Yellow

# CCLB Global Channel
$cclbGlobalTx = "channel-artifacts\cclb-global.tx"
if (-not (Test-Path $cclbGlobalTx)) {
    & "$FABRIC_BIN\configtxgen" -profile CCLBGlobalChannel -outputCreateChannelTx $cclbGlobalTx -channelID cclb-global
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ cclb-global channel tx created" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to create cclb-global channel tx" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ! Using existing cclb-global.tx" -ForegroundColor Yellow
}

# State-TS Channel
$stateTSTx = "channel-artifacts\state-ts.tx"
if (-not (Test-Path $stateTSTx)) {
    & "$FABRIC_BIN\configtxgen" -profile StateTSChannel -outputCreateChannelTx $stateTSTx -channelID state-ts
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ state-ts channel tx created" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to create state-ts channel tx" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ! Using existing state-ts.tx" -ForegroundColor Yellow
}

# Generate anchor peer updates
Write-Host ""
Write-Host "[7/7] Generating anchor peer updates..." -ForegroundColor Yellow

# CCLB anchor peer for cclb-global
$cclbAnchor = "channel-artifacts\CCLBMSPanchors-cclb-global.tx"
if (-not (Test-Path $cclbAnchor)) {
    & "$FABRIC_BIN\configtxgen" -profile CCLBGlobalChannel -outputAnchorPeersUpdate $cclbAnchor -channelID cclb-global -asOrg CCLB
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ CCLB anchor peer update created" -ForegroundColor Green
    }
}

# StateOrgTS anchor peer for state-ts
$tsAnchor = "channel-artifacts\StateOrgTSMSPanchors-state-ts.tx"
if (-not (Test-Path $tsAnchor)) {
    & "$FABRIC_BIN\configtxgen" -profile StateTSChannel -outputAnchorPeersUpdate $tsAnchor -channelID state-ts -asOrg StateOrgTS
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ StateOrgTS anchor peer update created" -ForegroundColor Green
    }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Generated artifacts:" -ForegroundColor Green
Write-Host "  ✓ crypto-config/ - Certificates and keys" -ForegroundColor Gray
Write-Host "  ✓ channel-artifacts/orderer.genesis.block" -ForegroundColor Gray
Write-Host "  ✓ channel-artifacts/cclb-global.tx" -ForegroundColor Gray
Write-Host "  ✓ channel-artifacts/state-ts.tx" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start the network:" -ForegroundColor Gray
Write-Host "     docker-compose up -d" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Create channels and join peers:" -ForegroundColor Gray
Write-Host "     .\scripts\create-channels.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Deploy chaincode:" -ForegroundColor Gray
Write-Host "     .\scripts\deploy-chaincode.ps1" -ForegroundColor Cyan
Write-Host ""
