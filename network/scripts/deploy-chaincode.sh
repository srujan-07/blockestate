#!/bin/bash
# deploy-chaincode.sh - Deploy land-registry chaincode to channels
# Prerequisites: Channels must be created and peers joined

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NETWORK_DIR="$( dirname "$SCRIPT_DIR" )"
PROJECT_ROOT="$( dirname "$NETWORK_DIR" )"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Deploying Chaincode${NC}"
echo -e "${YELLOW}========================================${NC}"

# Ensure we have the peer CLI
if ! command -v peer &> /dev/null; then
    echo -e "${RED}Error: peer CLI not found in PATH${NC}"
    exit 1
fi

# Function to deploy chaincode
deploy_chaincode() {
    local CHANNEL_NAME=$1
    local CHAINCODE_NAME=$2
    local CHAINCODE_LABEL=$3
    local ORG_NAME=$4
    local ORG_DOMAIN=$5
    local PEER_HOST=$6
    local PEER_PORT=${7:-7051}
    
    echo -e "\n${YELLOW}Deploying $CHAINCODE_NAME to $CHANNEL_NAME${NC}"
    
    # Set peer environment for CCLB (initiator)
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=$ORG_NAME
    export CORE_PEER_ADDRESS=$PEER_HOST:$PEER_PORT
    export CORE_PEER_TLS_ROOTCERTPATH=$NETWORK_DIR/crypto-config/peerOrganizations/$ORG_DOMAIN/peers/$PEER_HOST/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/crypto-config/peerOrganizations/$ORG_DOMAIN/users/Admin@$ORG_DOMAIN/msp
    
    # 1. Package chaincode
    echo "  [1] Packaging chaincode..."
    peer lifecycle chaincode package \
        ${CHAINCODE_NAME}.tar.gz \
        --path $PROJECT_ROOT/chaincode/land-registry \
        --lang golang \
        --label ${CHAINCODE_LABEL}
    
    # 2. Install on peer
    echo "  [2] Installing on peer..."
    peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz
    
    echo -e "${GREEN}✓ Chaincode deployment complete for $CHANNEL_NAME${NC}"
}

# Function to approve and commit chaincode
approve_and_commit() {
    local CHANNEL_NAME=$1
    local CHAINCODE_NAME=$2
    local CHAINCODE_VERSION=$3
    local ORG_NAME=$4
    local ORG_DOMAIN=$5
    local PEER_HOST=$6
    local PEER_PORT=${7:-7051}
    local INIT_REQUIRED=${8:-false}
    
    echo -e "\n${YELLOW}Approving and committing $CHAINCODE_NAME on $CHANNEL_NAME${NC}"
    
    # Set peer environment
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=$ORG_NAME
    export CORE_PEER_ADDRESS=$PEER_HOST:$PEER_PORT
    export CORE_PEER_TLS_ROOTCERTPATH=$NETWORK_DIR/crypto-config/peerOrganizations/$ORG_DOMAIN/peers/$PEER_HOST/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/crypto-config/peerOrganizations/$ORG_DOMAIN/users/Admin@$ORG_DOMAIN/msp
    
    # Get package ID
    PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep ${CHAINCODE_LABEL} | awk '{print $3}' | sed 's/,$//')
    
    echo "  Package ID: $PACKAGE_ID"
    
    # 3. Approve chaincode definition
    echo "  [3] Approving chaincode definition..."
    peer lifecycle chaincode approveformyorg \
        --channelID $CHANNEL_NAME \
        --name $CHAINCODE_NAME \
        --version $CHAINCODE_VERSION \
        --package-id $PACKAGE_ID \
        --sequence 1 \
        --tls --cafile $NETWORK_DIR/crypto-config/ordererOrganizations/orderer.landregistry.local/orderers/orderer0.orderer.landregistry.local/tls/ca.crt \
        --ordererTLSHostnameOverride orderer0.orderer.landregistry.local \
        -o localhost:7050
    
    echo -e "${GREEN}✓ Chaincode approved on $CHANNEL_NAME${NC}"
}

cd "$NETWORK_DIR"

# Deploy to cclb-global channel
echo -e "\n${YELLOW}--- CCLB Global Channel ---${NC}"
deploy_chaincode "cclb-global" "registry-index" "registry-index-v1.0" \
    "CCLEBMSP" "cclb.landregistry.local" "peer0.cclb.landregistry.local" "7051"

# Deploy to state-ts channel
echo -e "\n${YELLOW}--- State TS Channel ---${NC}"
deploy_chaincode "state-ts" "landregistry" "landregistry-v1.0" \
    "CCLEBMSP" "cclb.landregistry.local" "peer0.cclb.landregistry.local" "7051"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Chaincode packages prepared!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Note: This script packages and installs chaincode."
echo "For production deployments, use Fabric lifecycle commands to:"
echo "  1. Have each org approve the chaincode definition"
echo "  2. Commit the definition to the channel"
echo "  3. Invoke Init transaction if needed"
echo ""
