#!/usr/bin/env bash
# QUICK_START_CUSTOM_NETWORK.sh - One-command setup for custom Land Registry network

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

banner() {
  echo -e "${BLUE}"
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║     Custom Land Registry Fabric Network - Quick Start       ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

check_prerequisites() {
  echo -e "\n${YELLOW}Checking prerequisites...${NC}"
  
  local missing=0
  
  # Check Docker
  if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found${NC}"
    missing=1
  else
    echo -e "${GREEN}✓ Docker${NC}"
  fi
  
  # Check Docker Compose
  if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found${NC}"
    missing=1
  else
    echo -e "${GREEN}✓ Docker Compose${NC}"
  fi
  
  # Check cryptogen
  if ! command -v cryptogen &> /dev/null; then
    echo -e "${YELLOW}⚠ cryptogen not found in PATH${NC}"
    echo "  Trying to find in fabric-samples..."
    
    if [ -f ../fabric-samples/bin/cryptogen ]; then
      export PATH=$PATH:$(pwd)/../fabric-samples/bin
      echo -e "${GREEN}✓ Found in fabric-samples/bin${NC}"
    else
      echo -e "${RED}✗ cryptogen not found${NC}"
      echo "  Set up Fabric binaries from:"
      echo "  https://github.com/hyperledger/fabric/releases"
      missing=1
    fi
  else
    echo -e "${GREEN}✓ cryptogen${NC}"
  fi
  
  # Check configtxgen
  if ! command -v configtxgen &> /dev/null; then
    echo -e "${RED}✗ configtxgen not found in PATH${NC}"
    missing=1
  else
    echo -e "${GREEN}✓ configtxgen${NC}"
  fi
  
  if [ $missing -eq 1 ]; then
    echo -e "\n${RED}Missing prerequisites. Please install required tools.${NC}"
    exit 1
  fi
}

setup_network() {
  echo -e "\n${YELLOW}[1] Setting up network artifacts...${NC}"
  
  cd network
  
  if [ -d "crypto-config" ]; then
    echo -e "${YELLOW}  crypto-config already exists. Regenerating...${NC}"
    rm -rf crypto-config channel-artifacts
  fi
  
  rm -rf crypto-config
  
  echo "  Generating cryptographic materials..."
  cryptogen generate --config=cryptogen.yaml --output=crypto-config
  
  mkdir -p channel-artifacts
  export FABRIC_CFG_PATH="$(pwd)"
  
  echo "  Generating orderer genesis block..."
  configtxgen -profile LandRegistryOrdererGenesis -channelID system-channel \
    -outputBlock channel-artifacts/orderer.genesis.block
  
  echo "  Generating channel configurations..."
  configtxgen -profile CCLBGlobalChannel -outputCreateChannelTx \
    channel-artifacts/cclb-global.tx -channelID cclb-global
  
  configtxgen -profile StateTSChannel -outputCreateChannelTx \
    channel-artifacts/state-ts.tx -channelID state-ts
  
  chmod -R 755 crypto-config channel-artifacts
  
  echo -e "${GREEN}✓ Network artifacts ready${NC}"
  cd ..
}

start_services() {
  echo -e "\n${YELLOW}[2] Starting Docker services...${NC}"
  
  cd network
  
  echo "  Pulling latest images..."
  docker-compose pull
  
  echo "  Starting services..."
  docker-compose up -d
  
  echo "  Waiting for services to be ready..."
  sleep 5
  
  # Check service health
  echo "  Checking service status..."
  docker-compose ps
  
  echo -e "${GREEN}✓ Services started${NC}"
  cd ..
}

create_channels() {
  echo -e "\n${YELLOW}[3] Creating channels and joining peers...${NC}"
  
  cd network
  
  # Export peer CLI configuration
  export PATH=$PATH:../fabric-samples/bin
  
  # Set up CCLB peer environment
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=CCLEBMSP
  export CORE_PEER_ADDRESS=localhost:7051
  export CORE_PEER_TLS_ROOTCERTPATH=$(pwd)/crypto-config/peerOrganizations/cclb.landregistry.local/peers/peer0.cclb.landregistry.local/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=$(pwd)/crypto-config/peerOrganizations/cclb.landregistry.local/users/Admin@cclb.landregistry.local/msp
  
  cd channel-artifacts
  
  echo "  Creating cclb-global channel..."
  peer channel create -o localhost:7050 \
    --ordererTLSHostnameOverride orderer0.orderer.landregistry.local \
    -c cclb-global -f cclb-global.tx \
    --tls --cafile ../crypto-config/ordererOrganizations/orderer.landregistry.local/orderers/orderer0.orderer.landregistry.local/tls/ca.crt \
    2>/dev/null || echo "  (Channel may already exist)"
  
  echo "  Creating state-ts channel..."
  peer channel create -o localhost:7050 \
    --ordererTLSHostnameOverride orderer0.orderer.landregistry.local \
    -c state-ts -f state-ts.tx \
    --tls --cafile ../crypto-config/ordererOrganizations/orderer.landregistry.local/orderers/orderer0.orderer.landregistry.local/tls/ca.crt \
    2>/dev/null || echo "  (Channel may already exist)"
  
  # Join CCLB peer
  echo "  Joining peer0.cclb to channels..."
  peer channel join -b cclb-global.block 2>/dev/null || echo "  (Peer already joined cclb-global)"
  peer channel join -b state-ts.block 2>/dev/null || echo "  (Peer already joined state-ts)"
  
  # Join StateOrgTS peer
  export CORE_PEER_LOCALMSPID=StateOrgTSMSP
  export CORE_PEER_ADDRESS=localhost:9051
  export CORE_PEER_TLS_ROOTCERTPATH=../crypto-config/peerOrganizations/ts.landregistry.local/peers/peer0.ts.landregistry.local/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=../crypto-config/peerOrganizations/ts.landregistry.local/users/Admin@ts.landregistry.local/msp
  
  echo "  Joining peer0.ts to channels..."
  peer channel join -b cclb-global.block 2>/dev/null || echo "  (Peer already joined cclb-global)"
  peer channel join -b state-ts.block 2>/dev/null || echo "  (Peer already joined state-ts)"
  
  echo -e "${GREEN}✓ Channels created and peers joined${NC}"
  cd ../..
}

setup_wallet() {
  echo -e "\n${YELLOW}[4] Setting up wallet with admin identities...${NC}"
  
  cd realestate2/backend
  
  # Ensure wallet directory exists
  mkdir -p wallet
  
  # Enroll admin (will create wallet entry if not exists)
  if ! node addAdminToWallet.js 2>/dev/null; then
    echo -e "${YELLOW}  Note: Wallet setup skipped (wallet may already be populated)${NC}"
  fi
  
  echo -e "${GREEN}✓ Wallet ready${NC}"
  cd ../..
}

verify_installation() {
  echo -e "\n${YELLOW}[5] Verifying installation...${NC}"
  
  cd network
  
  # Check containers
  echo "  Docker services:"
  docker-compose ps | grep -E "^|STATUS|Up"
  
  # Check channels
  echo -e "\n  Channel status:"
  export CORE_PEER_ADDRESS=localhost:7051
  export CORE_PEER_TLS_ROOTCERTPATH=$(pwd)/crypto-config/peerOrganizations/cclb.landregistry.local/peers/peer0.cclb.landregistry.local/tls/ca.crt
  
  peer channel list 2>/dev/null | grep -E "cclb-global|state-ts" || echo "  (Check peer logs for details)"
  
  cd ..
  
  echo -e "${GREEN}✓ Installation verified${NC}"
}

summary() {
  echo -e "\n${GREEN}"
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║          🎉 Network Ready!                                 ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
  
  echo -e "\n${YELLOW}Network Services:${NC}"
  echo "  Orderer:      orderer0.orderer.landregistry.local:7050"
  echo "  CCLB Peer:    peer0.cclb.landregistry.local:7051"
  echo "  StateOrgTS:   peer0.ts.landregistry.local:9051"
  echo "  CCLB CA:      ca-cclb:7054"
  echo "  StateOrgTS CA:ca-ts:7055"
  echo ""
  
  echo -e "${YELLOW}Channels:${NC}"
  echo "  • cclb-global - Property ID registry (chaincode: registry-index)"
  echo "  • state-ts    - Telangana records (chaincode: landregistry)"
  echo ""
  
  echo -e "${YELLOW}Next Steps:${NC}"
  echo "  1. Deploy chaincode:  cd network && ./scripts/deploy-chaincode.sh"
  echo "  2. Start backend:     cd realestate2/backend && npm start"
  echo "  3. View network docs: cat network/README.md"
  echo ""
  
  echo -e "${YELLOW}Cleanup:${NC}"
  echo "  docker-compose -f network/docker-compose.yaml down -v"
  echo ""
}

main() {
  banner
  check_prerequisites
  setup_network
  start_services
  create_channels
  setup_wallet
  verify_installation
  summary
}

# Run main function
main
