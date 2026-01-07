#!/bin/bash

echo "🚀 Starting Land Registry System..."
echo "============================================"

# Step 1: Start Fabric Network
echo ""
echo "📦 Starting Fabric Network..."
cd "$(dirname "$0")/../../fabric-samples/test-network"

echo "   - Bringing up network, creating channel, deploying chaincode..."
bash ./network.sh up createChannel -ca > /dev/null 2>&1

echo "   ✅ Network started"

# Wait for network to stabilize
echo "   - Waiting for network to stabilize..."
sleep 5

# Step 2: Deploy Chaincode
echo ""
echo "📝 Deploying Chaincode..."
bash ./network.sh deployCC -ccn landregistry -ccp ../../chaincode/land-registry -ccl go -ccv 1.3 -ccs 2 > /dev/null 2>&1
echo "   ✅ Chaincode deployed (v1.3, seq 2)"

# Wait for chaincode to be ready
sleep 3

# Step 3: Load Admin to Wallet
echo ""
echo "🔑 Loading Admin Identity..."
cd "$(dirname "$0")"
node addAdminToWallet.js > /dev/null 2>&1
echo "   ✅ Admin identity loaded"

# Step 4: Add Sample Data
echo ""
echo "📊 Loading Sample Data..."
node addSampleData.js > /dev/null 2>&1
echo "   ✅ Sample data loaded"

# Step 5: Start Backend Server
echo ""
echo "🔧 Starting Backend Server..."
echo "============================================"
export USE_FABRIC="true"
node ./server.js
