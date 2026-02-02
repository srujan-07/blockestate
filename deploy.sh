#!/bin/bash

# Production Deployment Script for Hyperledger Fabric Land Registry
# This script automates the deployment process

set -e

echo "🚀 Starting Production Deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Generate Network Artifacts
echo -e "${YELLOW}Step 1: Generating network artifacts...${NC}"
cd network

if [ ! -d "crypto-config" ]; then
    echo "Generating crypto material..."
    cryptogen generate --config=./cryptogen.yaml --output=./crypto-config
fi

if [ ! -f "channel-artifacts/orderer.genesis.block" ]; then
    echo "Generating genesis block..."
    configtxgen -profile LandRegistryOrdererGenesis -channelID system-channel -outputBlock ./channel-artifacts/orderer.genesis.block
fi

if [ ! -f "channel-artifacts/cclb-global.tx" ]; then
    echo "Generating channel artifacts..."
    configtxgen -profile CCLBGlobalChannel -outputCreateChannelTx ./channel-artifacts/cclb-global.tx -channelID cclb-global
    configtxgen -profile StateTSChannel -outputCreateChannelTx ./channel-artifacts/state-ts.tx -channelID state-ts
    
    echo "Generating anchor peer updates..."
    configtxgen -profile CCLBGlobalChannel -outputAnchorPeersUpdate ./channel-artifacts/CCLBAnchors.tx -channelID cclb-global -asOrg CCLB
    configtxgen -profile StateTSChannel -outputAnchorPeersUpdate ./channel-artifacts/StateOrgTSAnchors.tx -channelID state-ts -asOrg StateOrgTS
fi

# Step 2: Start Fabric Network
echo -e "${YELLOW}Step 2: Starting Fabric network...${NC}"
docker-compose up -d

echo "Waiting for containers to be healthy..."
sleep 10

# Step 3: Check container health
echo -e "${YELLOW}Step 3: Checking container health...${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}"

# Step 4: Install backend dependencies
echo -e "${YELLOW}Step 4: Installing backend dependencies...${NC}"
cd ../realestate2/backend
if [ ! -d "node_modules" ]; then
    npm install
fi

# Step 5: Install frontend dependencies
echo -e "${YELLOW}Step 5: Installing frontend dependencies...${NC}"
cd ../../land-registry-frontend
if [ ! -d "node_modules" ]; then
    npm install
fi

echo -e "${GREEN}✅ Deployment preparation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Create channels and join peers (see DEPLOYMENT_PRODUCTION.md)"
echo "2. Deploy chaincode (see DEPLOYMENT_PRODUCTION.md)"
echo "3. Enroll admin identities: cd realestate2/backend && node enrollAdmin.js"
echo "4. Start backend: cd realestate2/backend && npm start"
echo "5. Start frontend: cd land-registry-frontend && npm start"
echo ""
echo "For detailed instructions, see DEPLOYMENT_PRODUCTION.md"
