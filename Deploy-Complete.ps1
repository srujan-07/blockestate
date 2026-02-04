# ============================================================================
# MASTER DEPLOYMENT SCRIPT - Windows PowerShell
# Land Registry Blockchain System
# ============================================================================
# This script automates the complete deployment process:
# 1. Network setup (crypto + genesis)
# 2. Channel creation
# 3. Chaincode deployment
# 4. Backend API start
# 5. System validation
# ============================================================================

param(
    [switch]$Clean,
    [switch]$SkipValidation,
    [string]$LogFile = "deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
)

# Configuration
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Colors
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }

function Write-Banner {
    param([string]$Message)
    Write-Host "========================================" -ForegroundColor Green
    Write-Host $Message -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
}

# Logging
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -Append -FilePath $LogFile
    Write-Info $Message
}

# Check prerequisites
function Test-Prerequisites {
    Write-Banner "Checking Prerequisites"
    
    $missing = @()
    
    # Docker
    if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
        $missing += "Docker"
    } else {
        $dockerVersion = docker --version
        Write-Log "??? Docker found: $dockerVersion"
    }
    
    # Docker Compose
    if (!(Get-Command docker-compose -ErrorAction SilentlyContinue)) {
        $missing += "Docker Compose"
    } else {
        $composeVersion = docker-compose --version
        Write-Log "??? Docker Compose found: $composeVersion"
    }
    
    # Node.js
    if (!(Get-Command node -ErrorAction SilentlyContinue)) {
        $missing += "Node.js"
    } else {
        $nodeVersion = node --version
        Write-Log "??? Node.js found: $nodeVersion"
    }
    
    # Check if Fabric binaries exist
    if (!(Test-Path "fabric-samples\bin")) {
        Write-Warning "Fabric binaries not found in fabric-samples/bin"
        $missing += "Fabric Binaries"
    } else {
        Write-Log "??? Fabric binaries found"
    }
    
    if ($missing.Count -gt 0) {
        Write-Error "Missing prerequisites: $($missing -join ', ')"
        Write-Error "Please install missing components and try again"
        exit 1
    }
    
    Write-Success "??? All prerequisites met"
}

# Clean previous deployment
function Remove-PreviousDeployment {
    Write-Banner "Cleaning Previous Deployment"
    
    # Stop containers
    Write-Log "Stopping Docker containers..."
    Push-Location network
    try {
        docker-compose down --volumes --remove-orphans 2>&1 | Out-Null
    } catch {
        Write-Warning "Docker cleanup had warnings (this is normal if no containers are running)"
    }
    Pop-Location
    
    # Remove crypto material
    Write-Log "Removing crypto material..."
    if (Test-Path "network\crypto-config") {
        Remove-Item -Recurse -Force "network\crypto-config"
    }
    
    # Remove channel artifacts
    Write-Log "Removing channel artifacts..."
    if (Test-Path "network\channel-artifacts") {
        Remove-Item -Recurse -Force "network\channel-artifacts"
    }
    New-Item -ItemType Directory -Force -Path "network\channel-artifacts" | Out-Null
    
    # Remove chaincode packages
    Write-Log "Removing chaincode packages..."
    Get-ChildItem -Path "network\scripts" -Filter "*.tar.gz" | Remove-Item -Force
    
    # Remove docker containers and images
    Write-Log "Cleaning Docker artifacts..."
    docker ps -a --filter "name=landregistry" --format "{{.ID}}" | ForEach-Object { docker rm -f $_ 2>$null }
    docker images --filter "reference=*landregistry*" --format "{{.ID}}" | ForEach-Object { docker rmi -f $_ 2>$null }
    
    Write-Success "??? Cleanup complete"
}

# Setup network
function Initialize-Network {
    Write-Banner "Setting Up Network"
    
    Push-Location network\scripts
    
    # Generate crypto material
    Write-Log "Fabric binaries are Linux ELF binaries - WSL required"
    Write-Warning ""
    Write-Warning "To complete deployment, please run these commands in WSL or Git Bash:"
    Write-Warning ""
    Write-Warning "1. Setup network (crypto + genesis + start containers):"
    Write-Warning "   cd network/scripts"
    Write-Warning "   ./setup-network.sh"
    Write-Warning ""
    Write-Warning "2. Create all channels:"
    Write-Warning "   ./create-all-channels.sh"
    Write-Warning ""
    Write-Warning "3. Deploy all chaincode:"
    Write-Warning "   ./deploy-all-chaincode.sh"
    Write-Warning ""
    Write-Warning "4. Start backend (from project root):"
    Write-Warning "   cd realestate2/backend"
    Write-Warning "   npm install"
    Write-Warning "   node api-complete.js"
    Write-Warning ""
    Write-Error "PowerShell deployment halted - please use bash/WSL for Hyperledger Fabric"
    Pop-Location
    exit 1
    
    Write-Success "??? Crypto material generated"
    
    # Generate channel artifacts
    Write-Log "Generating channel artifacts..."
    $configtxgenPath = "..\..\fabric-samples\bin\configtxgen"
    
    if (!(Test-Path $configtxgenPath)) {
        Write-Error "configtxgen not found at $configtxgenPath"
        Pop-Location
        exit 1
    }
    
    # Genesis block
    Write-Log "Creating genesis block..."
    & $configtxgenPath -profile LandRegistryOrdererGenesis `
        -channelID system-channel `
        -outputBlock ..\channel-artifacts\genesis.block `
        -configPath ..
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to generate genesis block"
        Pop-Location
        exit 1
    }
    
    if (!(Test-Path ..\channel-artifacts\genesis.block)) {
        Write-Error "Genesis block file was not created"
        Pop-Location
        exit 1
    }
    
    Copy-Item ..\channel-artifacts\genesis.block ..\channel-artifacts\orderer.genesis.block
    
    # CCLB Global Channel
    Write-Log "Creating CCLB global channel transaction..."
    & $configtxgenPath -profile CCLBGlobalChannel `
        -outputCreateChannelTx ..\channel-artifacts\cclb-global.tx `
        -channelID cclb-global `
        -configPath ..
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to generate CCLB channel transaction"
        Pop-Location
        exit 1
    }
    
    # Regional Channels
    Write-Log "Creating regional channel transactions..."
    @("TS", "KA", "AP") | ForEach-Object {
        $state = $_
        $channel = "land-region-$($state.ToLower())"
        & $configtxgenPath -profile "LandRegion$state" `
            -outputCreateChannelTx "..\channel-artifacts\$channel.tx" `
            -channelID $channel `
            -configPath ..
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to generate $channel transaction"
            Pop-Location
            exit 1
        }
    }
    
    Write-Success "??? Channel artifacts generated"
    
    Pop-Location
    
    # Start network
    Write-Log "Starting Docker containers..."
    Push-Location network
    docker-compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start network"
        Pop-Location
        exit 1
    }
    Pop-Location
    
    Write-Log "Waiting for network to stabilize..."
    Start-Sleep -Seconds 15
    
    # Verify orderer is running
    $ordererRunning = docker ps --filter "name=orderer0.orderer.landregistry.local" --format "{{.Names}}"
    if (!$ordererRunning) {
        Write-Error "Orderer failed to start"
        docker logs orderer0.orderer.landregistry.local
        exit 1
    }
    
    Write-Success "??? Network started successfully"
}

# Create channels
function New-Channels {
    Write-Banner "Creating Channels"
    
    Write-Log "Note: Channel creation requires bash environment"
    Write-Warning "Please run the following in WSL or Git Bash:"
    Write-Warning "  cd network/scripts"
    Write-Warning "  ./create-all-channels.sh"
    Write-Warning ""
    Write-Warning "Press any key after channels are created..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Deploy chaincode
function Deploy-Chaincode {
    Write-Banner "Deploying Chaincode"
    
    Write-Log "Note: Chaincode deployment requires bash environment"
    Write-Warning "Please run the following in WSL or Git Bash:"
    Write-Warning "  cd network/scripts"
    Write-Warning "  ./deploy-all-chaincode.sh"
    Write-Warning ""
    Write-Warning "Press any key after chaincode is deployed..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Start backend
function Start-Backend {
    Write-Banner "Starting Backend API"
    
    Push-Location realestate2\backend
    
    # Install dependencies if needed
    if (!(Test-Path "node_modules")) {
        Write-Log "Installing npm dependencies..."
        npm install
    }
    
    Write-Log "Starting backend API..."
    Write-Info "Backend will run in a new window"
    Write-Info "Press Ctrl+C in that window to stop the backend"
    
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "node api-complete.js"
    
    Pop-Location
    
    Start-Sleep -Seconds 5
    Write-Success "??? Backend started"
}

# Validate deployment
function Test-Deployment {
    Write-Banner "Validating Deployment"
    
    # Check containers
    Write-Log "Checking Docker containers..."
    $containers = docker ps --format "{{.Names}}"
    $requiredContainers = @(
        "orderer0.orderer.landregistry.local",
        "peer0.cclb.landregistry.local",
        "peer0.ts.landregistry.local"
    )
    
    $missing = @()
    foreach ($container in $requiredContainers) {
        if ($containers -notcontains $container) {
            $missing += $container
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Error "Missing containers: $($missing -join ', ')"
        return $false
    }
    
    Write-Success "??? All containers running"
    
    # Check API health
    Write-Log "Checking API health..."
    Start-Sleep -Seconds 3
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 5
        if ($response.status -eq "healthy") {
            Write-Success "API is healthy"
        } else {
            Write-Warning "API health check returned unexpected status"
        }
    } catch {
        Write-Warning "API health check failed: $_"
        Write-Warning "Backend may still be starting..."
    }
    
    return $true
}

# Display summary
function Show-DeploymentSummary {
    Write-Banner "Deployment Summary"
    
    Write-Host ""
    Write-Success "[SUCCESS] DEPLOYMENT COMPLETE!"
    Write-Host ""
    
    Write-Info "Network Status:"
    Write-Host "  * Orderer: orderer0.orderer.landregistry.local:7050"
    Write-Host "  * CCLB Peer: peer0.cclb.landregistry.local:7051"
    Write-Host "  * TS Peer: peer0.ts.landregistry.local:7051"
    Write-Host "  * Backend API: http://localhost:3000"
    Write-Host ""
    
    Write-Info "Available Channels:"
    Write-Host "  * cclb-global (Property ID registry)"
    Write-Host "  * land-region-ts (Telangana)"
    Write-Host "  * land-region-ka (Karnataka)"
    Write-Host "  * land-region-ap (Andhra Pradesh)"
    Write-Host ""
    
    Write-Info "API Endpoints:"
    Write-Host "  * Health: http://localhost:3000/api/health"
    Write-Host "  * Enroll: POST http://localhost:3000/api/auth/enroll"
    Write-Host "  * Submit: POST http://localhost:3000/api/land/submit"
    Write-Host "  * Verify: POST http://localhost:3000/api/land/verify"
    Write-Host "  * Approve: POST http://localhost:3000/api/land/approve"
    Write-Host ""
    
    Write-Info "Next Steps:"
    Write-Host "  1. Test API: curl http://localhost:3000/api/health"
    Write-Host "  2. Review logs: docker-compose logs -f"
    Write-Host "  3. See documentation: PRODUCTION_ARCHITECTURE.md"
    Write-Host ""
    
    Write-Info "Management Commands:"
    Write-Host "  * View logs: docker-compose logs -f"
    Write-Host "  * Stop network: docker-compose down"
    Write-Host "  * Restart: docker-compose up -d"
    Write-Host ""
    
    Write-Success "Log file saved: $LogFile"
}

# Main execution
function Main {
    Write-Banner "Land Registry Blockchain - Master Deployment"
    
    Write-Log "Deployment started"
    Write-Log "PowerShell version: $($PSVersionTable.PSVersion)"
    
    try {
        # Step 1: Prerequisites
        Test-Prerequisites
        
        # Step 2: Clean if requested
        if ($Clean) {
            Remove-PreviousDeployment
        }
        
        # Step 3: Initialize network
        Initialize-Network
        
        # Step 4: Create channels (manual step)
        New-Channels
        
        # Step 5: Deploy chaincode (manual step)
        Deploy-Chaincode
        
        # Step 6: Start backend
        Start-Backend
        
        # Step 7: Validate
        if (!$SkipValidation) {
            $validationResult = Test-Deployment
            if (!$validationResult) {
                Write-Warning "Validation completed with warnings"
            }
        }
        
        # Step 8: Summary
        Show-DeploymentSummary
        
        Write-Log "Deployment completed successfully"
        
    } catch {
        Write-Error "Deployment failed: $_"
        Write-Error $_.ScriptStackTrace
        Write-Log "Deployment failed: $_"
        exit 1
    }
}

# Run main
Main


