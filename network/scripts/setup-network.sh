#!/bin/bash
# Complete Fabric Network Setup Script
# Generates crypto materials, genesis block, and channel artifacts

set -e

echo "========================================"
echo "Land Registry Fabric Network Setup"
echo "========================================"
echo ""

# Set Fabric binaries path
export PATH=$PATH:$(pwd)/../fabric-samples/bin
export FABRIC_CFG_PATH=$(pwd)

# Verify binaries
echo "[1/6] Verifying Fabric binaries..."
if ! command -v cryptogen &> /dev/null; then
    echo "  ✗ cryptogen not found"
    echo "  Please add fabric-samples/bin to PATH"
    exit 1
fi
echo "  ✓ cryptogen found"

if ! command -v configtxgen &> /dev/null; then
    echo "  ✗ configtxgen not found"
    exit 1
fi
echo "  ✓ configtxgen found"

# Create directories
echo ""
echo "[2/6] Creating directory structure..."
mkdir -p channel-artifacts
echo "  ✓ Created channel-artifacts/"

# Generate crypto materials
echo ""
echo "[3/6] Generating cryptographic materials..."
if [ -d "crypto-config" ]; then
    echo "  ! crypto-config exists (skipping)"
else
    cryptogen generate --config=cryptogen.yaml --output=crypto-config
    echo "  ✓ Crypto materials generated"
    echo "    - Orderer certificates"
    echo "    - CCLB peer certificates"
    echo "    - StateOrgTS peer certificates"
fi

# Generate genesis block
echo ""
echo "[4/6] Generating genesis block..."
configtxgen -profile LandRegistryOrdererGenesis \
    -channelID system-channel \
    -outputBlock channel-artifacts/orderer.genesis.block

if [ $? -eq 0 ]; then
    echo "  ✓ Genesis block created"
else
    echo "  ✗ Failed to create genesis block"
    exit 1
fi

# Generate channel configuration transactions
echo ""
echo "[5/6] Generating channel configuration transactions..."

# CCLB Global Channel
configtxgen -profile CCLBGlobalChannel \
    -outputCreateChannelTx channel-artifacts/cclb-global.tx \
    -channelID cclb-global
echo "  ✓ cclb-global channel tx created"

# State-TS Channel
configtxgen -profile StateTSChannel \
    -outputCreateChannelTx channel-artifacts/state-ts.tx \
    -channelID state-ts
echo "  ✓ state-ts channel tx created"

# Generate anchor peer updates
echo ""
echo "[6/6] Generating anchor peer updates..."

# CCLB anchor peer for cclb-global
configtxgen -profile CCLBGlobalChannel \
    -outputAnchorPeersUpdate channel-artifacts/CCLBMSPanchors-cclb-global.tx \
    -channelID cclb-global \
    -asOrg CCLB
echo "  ✓ CCLB anchor peer update created"

# StateOrgTS anchor peer for state-ts
configtxgen -profile StateTSChannel \
    -outputAnchorPeersUpdate channel-artifacts/StateOrgTSMSPanchors-state-ts.tx \
    -channelID state-ts \
    -asOrg StateOrgTS
echo "  ✓ StateOrgTS anchor peer update created"

# Summary
echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Generated artifacts:"
echo "  ✓ crypto-config/ - Certificates and keys"
echo "  ✓ channel-artifacts/orderer.genesis.block"
echo "  ✓ channel-artifacts/cclb-global.tx"
echo "  ✓ channel-artifacts/state-ts.tx"
echo ""
echo "Next steps:"
echo "  1. Start the network:"
echo "     docker-compose up -d"
echo ""
echo "  2. Create channels and join peers:"
echo "     bash scripts/create-channels.sh"
echo ""
echo "  3. Deploy chaincode:"
echo "     bash scripts/deploy-chaincode.sh"
echo ""
