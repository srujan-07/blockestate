#!/bin/bash
# setup-network.sh - Bootstrap custom Land Registry Fabric network
# This script generates all cryptographic materials and channel configurations
# Run this ONCE before starting the network with docker-compose

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/.."
NETWORK_DIR="$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Land Registry Network Setup${NC}"
echo -e "${YELLOW}========================================${NC}"

# Step 1: Check prerequisites
echo -e "\n${YELLOW}[1/5] Checking prerequisites...${NC}"
if ! command -v cryptogen &> /dev/null; then
    echo -e "${RED}Error: cryptogen not found in PATH${NC}"
    echo "Install cryptogen from fabric-samples/bin/"
    exit 1
fi

if ! command -v configtxgen &> /dev/null; then
    echo -e "${RED}Error: configtxgen not found in PATH${NC}"
    echo "Install configtxgen from fabric-samples/bin/"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}"

# Step 2: Generate cryptographic materials
echo -e "\n${YELLOW}[2/5] Generating cryptographic materials...${NC}"
cd "$NETWORK_DIR"
rm -rf crypto-config

cryptogen generate --config=cryptogen.yaml --output=crypto-config

echo -e "${GREEN}✓ Crypto materials generated${NC}"
ls -la crypto-config/

# Step 3: Generate genesis block
echo -e "\n${YELLOW}[3/5] Generating orderer genesis block...${NC}"
mkdir -p channel-artifacts

export FABRIC_CFG_PATH="$NETWORK_DIR"

configtxgen -profile LandRegistryOrdererGenesis -channelID system-channel \
    -outputBlock channel-artifacts/orderer.genesis.block

echo -e "${GREEN}✓ Genesis block generated${NC}"

# Step 4: Generate channel configuration transactions
echo -e "\n${YELLOW}[4/5] Generating channel configuration transactions...${NC}"

# cclb-global channel
configtxgen -profile CCLBGlobalChannel -outputCreateChannelTx \
    channel-artifacts/cclb-global.tx -channelID cclb-global

echo -e "${GREEN}✓ cclb-global.tx created${NC}"

# state-ts channel
configtxgen -profile StateTSChannel -outputCreateChannelTx \
    channel-artifacts/state-ts.tx -channelID state-ts

echo -e "${GREEN}✓ state-ts.tx created${NC}"

# Step 5: Set correct permissions
echo -e "\n${YELLOW}[5/5] Setting file permissions...${NC}"
chmod -R 755 crypto-config/
chmod -R 755 channel-artifacts/

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Network setup complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Generated artifacts:"
echo "  - crypto-config/       Certificates and keys for all orgs"
echo "  - channel-artifacts/   Genesis block and channel configs"
echo ""
echo "Next steps:"
echo "  1. Start the network:    docker-compose up -d"
echo "  2. Setup channels:       ./scripts/create-channels.sh"
echo "  3. Deploy chaincode:     ./scripts/deploy-chaincode.sh"
echo ""
