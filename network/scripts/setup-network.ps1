# PowerShell version of setup-network.sh for Windows

param(
    [string]$FabricBinPath = "",
    [switch]$Help
)

if ($Help) {
    Write-Host "setup-network.ps1 - Bootstrap Land Registry Fabric Network"
    Write-Host ""
    Write-Host "Usage: .\setup-network.ps1 [-FabricBinPath <path>]"
    Write-Host ""
    Write-Host "Parameters:"
    Write-Host "  -FabricBinPath : Path to fabric-samples/bin directory"
    Write-Host "                   Default: looks in PATH"
    exit 0
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NetworkDir = $ScriptDir

Write-Host "========================================"
Write-Host "Land Registry Network Setup (Windows)" -ForegroundColor Yellow
Write-Host "========================================"

# Step 1: Check prerequisites
Write-Host "`n[1/5] Checking prerequisites..." -ForegroundColor Yellow

$cryptogen = if ($FabricBinPath) { 
    Join-Path $FabricBinPath "cryptogen.exe"
} else { 
    "cryptogen.exe"
}

$configtxgen = if ($FabricBinPath) { 
    Join-Path $FabricBinPath "configtxgen.exe"
} else { 
    "configtxgen.exe"
}

try {
    & $cryptogen --version | Out-Null
} catch {
    Write-Host "Error: cryptogen not found" -ForegroundColor Red
    Write-Host "Download from: https://github.com/hyperledger/fabric/releases"
    exit 1
}

Write-Host "✓ Prerequisites OK" -ForegroundColor Green

# Step 2: Generate cryptographic materials
Write-Host "`n[2/5] Generating cryptographic materials..." -ForegroundColor Yellow
Push-Location $NetworkDir
Remove-Item -Recurse -Force crypto-config -ErrorAction SilentlyContinue

& $cryptogen generate --config=cryptogen.yaml --output=crypto-config

Write-Host "✓ Crypto materials generated" -ForegroundColor Green

# Step 3: Generate genesis block
Write-Host "`n[3/5] Generating orderer genesis block..." -ForegroundColor Yellow
$channelArtifacts = Join-Path $NetworkDir "channel-artifacts"
New-Item -ItemType Directory -Path $channelArtifacts -Force | Out-Null

$env:FABRIC_CFG_PATH = $NetworkDir

& $configtxgen -profile LandRegistryOrdererGenesis -channelID system-channel `
    -outputBlock "$channelArtifacts\orderer.genesis.block"

Write-Host "✓ Genesis block generated" -ForegroundColor Green

# Step 4: Generate channel configuration transactions
Write-Host "`n[4/5] Generating channel configuration transactions..." -ForegroundColor Yellow

& $configtxgen -profile CCLBGlobalChannel -outputCreateChannelTx `
    "$channelArtifacts\cclb-global.tx" -channelID cclb-global

Write-Host "✓ cclb-global.tx created" -ForegroundColor Green

& $configtxgen -profile StateTSChannel -outputCreateChannelTx `
    "$channelArtifacts\state-ts.tx" -channelID state-ts

Write-Host "✓ state-ts.tx created" -ForegroundColor Green

Write-Host "`n========================================"
Write-Host "✓ Network setup complete!" -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Write-Host "Generated artifacts:"
Write-Host "  - crypto-config/       Certificates and keys for all orgs"
Write-Host "  - channel-artifacts/   Genesis block and channel configs"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Start the network:    docker-compose up -d"
Write-Host "  2. Setup channels:       .\scripts\create-channels.ps1"
Write-Host "  3. Deploy chaincode:     .\scripts\deploy-chaincode.ps1"
Write-Host ""

Pop-Location
