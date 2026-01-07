#!/bin/bash

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║   Land Registry System - Complete Startup          ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_step() {
    echo -e "${YELLOW}[→]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Step 1: Reset and Start Fabric Network
print_step "Resetting any existing network (safe cleanup)..."
cd "$PROJECT_ROOT/fabric-samples/test-network"
bash ./network.sh down > /tmp/fabric_network_down.log 2>&1 || true
print_status "Cleanup done"

print_step "Starting Fabric Network and creating channel..."
if ! bash ./network.sh up createChannel -ca > /tmp/fabric_network.log 2>&1; then
    print_error "Failed to start Fabric network"
    cat /tmp/fabric_network.log
    exit 1
fi
print_status "Fabric network started and channel created"

# Wait for network to stabilize
print_step "Waiting for network to stabilize (5 seconds)..."
sleep 5

# Step 2: Deploy Chaincode
print_step "Deploying chaincode (landregistry v1.3, sequence 1)..."
if ! bash ./network.sh deployCC -ccn landregistry -ccp ../../chaincode/land-registry -ccl go -ccv 1.3 -ccs 1 > /tmp/fabric_chaincode.log 2>&1; then
    print_error "Failed to deploy chaincode"
    cat /tmp/fabric_chaincode.log
    exit 1
fi
print_status "Chaincode deployed successfully"

# Wait for chaincode to be ready
sleep 3

# Step 3: Load Admin Identity
print_step "Loading admin identity to wallet..."
cd "$PROJECT_ROOT/realestate2/backend"

if ! node addAdminToWallet.js > /tmp/admin_wallet.log 2>&1; then
    print_error "Failed to load admin identity"
    cat /tmp/admin_wallet.log
    exit 1
fi
print_status "Admin identity loaded"

# Step 4: Load Sample Data
print_step "Loading sample land records..."
if ! node addSampleData.js > /tmp/sample_data.log 2>&1; then
    print_error "Failed to load sample data"
    cat /tmp/sample_data.log
    exit 1
fi
print_status "Sample data loaded (3 properties)"

# Step 5: Start Backend Server
print_step "Starting backend server on http://localhost:4000..."
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║   System Ready!                                    ║"
echo "║   Backend: http://localhost:4000                   ║"
echo "║   Blockchain Mode: ENABLED                         ║"
echo "║   Press Ctrl+C to stop                             ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

export USE_FABRIC="true"
exec node ./server.js
