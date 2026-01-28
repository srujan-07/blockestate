#!/bin/bash
# create-channels.sh - Create channels on the custom Land Registry network
# Prerequisites: Network must be running (docker-compose up -d)

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NETWORK_DIR="$( dirname "$SCRIPT_DIR" )"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Creating Channels${NC}"
echo -e "${YELLOW}========================================${NC}"

# Ensure we have the tools
if ! command -v peer &> /dev/null; then
    echo -e "${RED}Error: peer CLI not found in PATH${NC}"
    exit 1
fi

# Function to create channel
create_channel() {
    local CHANNEL_NAME=$1
    local CHANNEL_TX=$2
    local ORG_NAME=$3
    local ORG_DOMAIN=$4
    local PEER_HOST=$5
    local PEER_PORT=${6:-7051}
    
    echo -e "\n${YELLOW}Creating channel: $CHANNEL_NAME${NC}"
    
    # Set peer environment
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=$ORG_NAME
    export CORE_PEER_ADDRESS=$PEER_HOST:$PEER_PORT
    export CORE_PEER_TLS_ROOTCERTPATH=$NETWORK_DIR/crypto-config/peerOrganizations/$ORG_DOMAIN/peers/$PEER_HOST/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/crypto-config/peerOrganizations/$ORG_DOMAIN/users/Admin@$ORG_DOMAIN/msp
    
    peer channel create -o localhost:7050 \
        --ordererTLSHostnameOverride orderer0.orderer.landregistry.local \
        -c $CHANNEL_NAME -f $CHANNEL_TX \
        --tls --cafile $NETWORK_DIR/crypto-config/ordererOrganizations/orderer.landregistry.local/orderers/orderer0.orderer.landregistry.local/tls/ca.crt
    
    echo -e "${GREEN}✓ Channel $CHANNEL_NAME created${NC}"
}

# Function to join peer to channel
join_channel() {
    local CHANNEL_NAME=$1
    local ORG_NAME=$2
    local ORG_DOMAIN=$3
    local PEER_HOST=$4
    local PEER_PORT=${5:-7051}
    
    echo -e "\n${YELLOW}Joining $PEER_HOST to channel: $CHANNEL_NAME${NC}"
    
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=$ORG_NAME
    export CORE_PEER_ADDRESS=$PEER_HOST:$PEER_PORT
    export CORE_PEER_TLS_ROOTCERTPATH=$NETWORK_DIR/crypto-config/peerOrganizations/$ORG_DOMAIN/peers/$PEER_HOST/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/crypto-config/peerOrganizations/$ORG_DOMAIN/users/Admin@$ORG_DOMAIN/msp
    
    peer channel join -b ${CHANNEL_NAME}.block
    
    echo -e "${GREEN}✓ $PEER_HOST joined $CHANNEL_NAME${NC}"
}

cd "$NETWORK_DIR/channel-artifacts"

# Create cclb-global channel
create_channel "cclb-global" "$NETWORK_DIR/channel-artifacts/cclb-global.tx" \
    "CCLEBMSP" "cclb.landregistry.local" "peer0.cclb.landregistry.local" "7051"

# Join CCLB peer to cclb-global
join_channel "cclb-global" "CCLEBMSP" "cclb.landregistry.local" \
    "peer0.cclb.landregistry.local" "7051"

# Join StateOrgTS peer to cclb-global
join_channel "cclb-global" "StateOrgTSMSP" "ts.landregistry.local" \
    "peer0.ts.landregistry.local" "7051"

# Create state-ts channel
create_channel "state-ts" "$NETWORK_DIR/channel-artifacts/state-ts.tx" \
    "CCLEBMSP" "cclb.landregistry.local" "peer0.cclb.landregistry.local" "7051"

# Join CCLB peer to state-ts
join_channel "state-ts" "CCLEBMSP" "cclb.landregistry.local" \
    "peer0.cclb.landregistry.local" "7051"

# Join StateOrgTS peer to state-ts
join_channel "state-ts" "StateOrgTSMSP" "ts.landregistry.local" \
    "peer0.ts.landregistry.local" "7051"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✓ All channels created and peers joined!${NC}"
echo -e "${GREEN}========================================${NC}"
