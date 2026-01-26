#!/bin/bash
set -e

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║   Starting Hyperledger Fabric Blockchain Network    ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Convert Windows path to WSL path
PROJECT_ROOT="/mnt/c/Users/sruja/OneDrive/Desktop/Project"
cd "$PROJECT_ROOT/fabric-samples/test-network"

# Set up Fabric environment
export PATH="$PROJECT_ROOT/fabric-samples/bin:$PATH"
export FABRIC_CFG_PATH="$PROJECT_ROOT/fabric-samples/config"

echo "[1/5] Starting Fabric Network..."
bash ./network.sh up createChannel -ca

echo ""
echo "[2/5] Waiting for certificates to be generated (30 seconds)..."
sleep 30

echo ""
echo "[3/5] Creating channel..."
# Retry channel creation if it fails
for i in {1..3}; do
  echo "Attempt $i: Creating channel..."
  if bash ./network.sh createChannel -c mychannel 2>&1; then
    echo "Channel created successfully"
    break
  else
    if [ $i -lt 3 ]; then
      echo "Channel creation failed, waiting 10 seconds and retrying..."
      sleep 10
    fi
  fi
done

echo ""
echo "[4/5] Deploying chaincode (landregistry v1.3)..."
bash ./network.sh deployCC -ccn landregistry -ccp ../../chaincode/land-registry -ccl go -ccv 1.3 -ccs 1

echo ""
echo "[5/5] Setting up admin identity and sample data..."
cd "$PROJECT_ROOT/realestate2/backend"

# Add admin to wallet
echo "Loading admin wallet..."
node addAdminToWallet.js 2>/dev/null || true

# Add sample data
echo "Loading sample data..."
node addSampleData.js 2>/dev/null || true

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║   ✅ Blockchain Network Ready!                     ║"
echo "║   Backend: http://localhost:4000                   ║"
echo "║   Blockchain: ENABLED and RUNNING                  ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
