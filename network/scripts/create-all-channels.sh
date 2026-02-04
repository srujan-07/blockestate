#!/bin/bash

# ============================================================================
# CREATE CHANNELS - Land Registry Blockchain Network
# ============================================================================
# This script creates all required channels by running peer commands
# inside the peer containers via docker exec
# ============================================================================

set -e

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Print functions
print_msg() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}========================================${NC}"
}

print_error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

print_info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Configuration
ORDERER_ENDPOINT="orderer0.orderer.landregistry.local:7050"
ORDERER_CA="crypto-config/ordererOrganizations/orderer.landregistry.local/orderers/orderer0.orderer.landregistry.local/msp/tlscacerts/tlsca.orderer.landregistry.local-cert.pem"
DELAY=3
MAX_RETRY=5

# Create channel
createChannel() {
    local CHANNEL_NAME=$1
    local CHANNEL_TX=$2
    local PEER_CONTAINER=$3
    
    print_info "Creating channel: $CHANNEL_NAME on $PEER_CONTAINER"
    
    docker exec $PEER_CONTAINER bash -c "
        export FABRIC_CFG_PATH=/etc/hyperledger/peercfg
        export CORE_PEER_LOCALMSPID=CCLBMSP
        export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto-config/peerOrganizations/cclb.landregistry.local/users/Admin@cclb.landregistry.local/msp
        export CORE_PEER_TLS_ENABLED=false
        
        peer channel create \
            -o ${ORDERER_ENDPOINT} \
            -c ${CHANNEL_NAME} \
            -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_TX} \
            --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block 2>&1
    "
    
    if [ $? -eq 0 ]; then
        print_info "✓ Channel $CHANNEL_NAME created"
        return 0
    else
        print_error "Failed to create channel $CHANNEL_NAME"
        return 1
    fi
}

# Join peer to channel
joinChannel() {
    local CHANNEL_NAME=$1
    local PEER_CONTAINER=$2
    local RETRY=0
    
    print_info "Joining $PEER_CONTAINER to channel $CHANNEL_NAME"
    
    while [ $RETRY -lt $MAX_RETRY ]; do
        docker exec $PEER_CONTAINER bash -c "
            export FABRIC_CFG_PATH=/etc/hyperledger/peercfg
            peer channel join \
                -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block
        "
        
        if [ $? -eq 0 ]; then
            print_info "✓ $PEER_CONTAINER joined $CHANNEL_NAME"
            return 0
        fi
        
        RETRY=$((RETRY + 1))
        print_info "Retry $RETRY/$MAX_RETRY..."
        sleep $DELAY
    done
    
    print_error "Failed to join $PEER_CONTAINER to $CHANNEL_NAME"
    return 1
}

# Update anchor peers
updateAnchorPeers() {
    local CHANNEL_NAME=$1
    local PEER_CONTAINER=$2
    local ANCHOR_TX=$3
    
    print_info "Updating anchor peers for $PEER_CONTAINER on $CHANNEL_NAME"
    
    docker exec $PEER_CONTAINER bash -c "
        export FABRIC_CFG_PATH=/etc/hyperledger/peercfg
        peer channel update \
            -o ${ORDERER_ENDPOINT} \
            -c ${CHANNEL_NAME} \
            -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${ANCHOR_TX}
    "
    
    if [ $? -eq 0 ]; then
        print_info "✓ Anchor peers updated for $PEER_CONTAINER"
        return 0
    else
        print_error "Failed to update anchor peers"
        return 1
    fi
}

# Create CCLB Global Channel
create_cclb_global_channel() {
    print_msg "Creating CCLB Global Channel"
    
    createChannel "cclb-global" "cclb-global.tx" "peer0.cclb.landregistry.local"
    sleep 3
    
    # Join organizations
    joinChannel "cclb-global" "peer0.cclb.landregistry.local"
    joinChannel "cclb-global" "peer0.ts.landregistry.local"
    
    print_info "✓ CCLB Global Channel setup complete"
}

# Create Regional Channel - Telangana
create_regional_channel_ts() {
    print_msg "Creating Telangana Regional Channel"
    
    createChannel "land-region-ts" "land-region-ts.tx" "peer0.ts.landregistry.local"
    sleep 3
    
    # Join organizations
    joinChannel "land-region-ts" "peer0.cclb.landregistry.local"
    joinChannel "land-region-ts" "peer0.ts.landregistry.local"
    
    print_info "✓ Telangana Regional Channel setup complete"
}

# Create Regional Channel - Karnataka
create_regional_channel_ka() {
    print_msg "Creating Karnataka Regional Channel"
    
    createChannel "land-region-ka" "land-region-ka.tx" "peer0.cclb.landregistry.local"
    sleep 3
    
    joinChannel "land-region-ka" "peer0.cclb.landregistry.local"
    joinChannel "land-region-ka" "peer0.ts.landregistry.local"
    
    print_info "✓ Karnataka Regional Channel setup complete"
}

# Create Regional Channel - Andhra Pradesh
create_regional_channel_ap() {
    print_msg "Creating Andhra Pradesh Regional Channel"
    
    createChannel "land-region-ap" "land-region-ap.tx" "peer0.cclb.landregistry.local"
    sleep 3
    
    joinChannel "land-region-ap" "peer0.cclb.landregistry.local"
    joinChannel "land-region-ap" "peer0.ts.landregistry.local"
    
    print_info "✓ Andhra Pradesh Regional Channel setup complete"
}

# Main execution
main() {
    print_msg "Creating All Channels"
    
    # Check if network is running
    echo "Checking for orderer container..."
    ORDERER_CHECK=$(docker ps --format "{{.Names}}" 2>&1 | grep -i "orderer0" || echo "NOT_FOUND")
    echo "Orderer check result: $ORDERER_CHECK"
    
    if [ "$ORDERER_CHECK" = "NOT_FOUND" ]; then
        print_error "Network is not running. Running containers:"
        docker ps --format "table {{.Names}}\t{{.Status}}"
        print_error "Start network with: cd ../.. && docker-compose -f network/docker-compose.yaml up -d"
        exit 1
    fi
    
    echo "Network check passed, proceeding with channel creation..."
    
    # Create all channels
    create_cclb_global_channel
    sleep 5
    
    create_regional_channel_ts
    sleep 5
    
    create_regional_channel_ka
    sleep 5
    
    create_regional_channel_ap
    
    print_msg "All Channels Created Successfully"
    print_info "Next step: Deploy chaincode with ./deploy-all-chaincode.sh"
}

# Run main
main "$@"

# Print functions
print_msg() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}========================================${NC}"
}

print_error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

print_info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Orderer connection parameters
ORDERER_CA=../crypto-config/ordererOrganizations/orderer.landregistry.local/orderers/orderer0.orderer.landregistry.local/msp/tlscacerts/tlsca.orderer.landregistry.local-cert.pem
ORDERER_ENDPOINT=orderer0.orderer.landregistry.local:7050

# Set environment for organization
setGlobals() {
    local ORG=$1
    
    case $ORG in
        "CCLB")
            export CORE_PEER_LOCALMSPID="CCLEBMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/../crypto-config/peerOrganizations/cclb.landregistry.local/peers/peer0.cclb.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/../crypto-config/peerOrganizations/cclb.landregistry.local/users/Admin@cclb.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.cclb.landregistry.local:7051
            ;;
        "StateOrgTS")
            export CORE_PEER_LOCALMSPID="StateOrgTSMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/../crypto-config/peerOrganizations/ts.landregistry.local/peers/peer0.ts.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/../crypto-config/peerOrganizations/ts.landregistry.local/users/Admin@ts.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.ts.landregistry.local:7051
            ;;
        "StateOrgKA")
            export CORE_PEER_LOCALMSPID="StateOrgKAMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/../crypto-config/peerOrganizations/ka.landregistry.local/peers/peer0.ka.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/../crypto-config/peerOrganizations/ka.landregistry.local/users/Admin@ka.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.ka.landregistry.local:8051
            ;;
        "StateOrgAP")
            export CORE_PEER_LOCALMSPID="StateOrgAPMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/../crypto-config/peerOrganizations/ap.landregistry.local/peers/peer0.ap.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/../crypto-config/peerOrganizations/ap.landregistry.local/users/Admin@ap.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.ap.landregistry.local:9051
            ;;
        "VROOrg")
            export CORE_PEER_LOCALMSPID="VROOrgMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/../crypto-config/peerOrganizations/vro.landregistry.local/peers/peer0.vro.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/../crypto-config/peerOrganizations/vro.landregistry.local/users/Admin@vro.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.vro.landregistry.local:10051
            ;;
        "MROOrg")
            export CORE_PEER_LOCALMSPID="MROOrgMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/../crypto-config/peerOrganizations/mro.landregistry.local/peers/peer0.mro.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/../crypto-config/peerOrganizations/mro.landregistry.local/users/Admin@mro.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.mro.landregistry.local:11051
            ;;
        "AdminOrg")
            export CORE_PEER_LOCALMSPID="AdminOrgMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/../crypto-config/peerOrganizations/admin.landregistry.local/peers/peer0.admin.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/../crypto-config/peerOrganizations/admin.landregistry.local/users/Admin@admin.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.admin.landregistry.local:12051
            ;;
        "CitizenOrg")
            export CORE_PEER_LOCALMSPID="CitizenOrgMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/../crypto-config/peerOrganizations/citizen.landregistry.local/peers/peer0.citizen.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/../crypto-config/peerOrganizations/citizen.landregistry.local/users/Admin@citizen.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.citizen.landregistry.local:13051
            ;;
        *)
            print_error "Unknown organization: $ORG"
            exit 1
            ;;
    esac
    
    export CORE_PEER_TLS_ENABLED=true
}

# Create channel
createChannel() {
    local CHANNEL_NAME=$1
    local CHANNEL_TX=$2
    local ORG=$3
    
    print_info "Creating channel: $CHANNEL_NAME"
    setGlobals $ORG
    
    peer channel create \
        -o ${ORDERER_ENDPOINT} \
        -c ${CHANNEL_NAME} \
        -f ./channel-artifacts/${CHANNEL_TX} \
        --outputBlock ./channel-artifacts/${CHANNEL_NAME}.block \
        --tls --cafile $(pwd)/${ORDERER_CA} \
        --timeout 30s
    
    if [ $? -ne 0 ]; then
        print_error "Failed to create channel $CHANNEL_NAME"
        return 1
    fi
    
    print_info "✓ Channel $CHANNEL_NAME created"
    return 0
}

# Join peer to channel
joinChannel() {
    local CHANNEL_NAME=$1
    local ORG=$2
    local RETRY=0
    
    print_info "Joining $ORG to channel $CHANNEL_NAME"
    setGlobals $ORG
    
    while [ $RETRY -lt $MAX_RETRY ]; do
        peer channel join \
            -b ./channel-artifacts/${CHANNEL_NAME}.block \
            --tls --cafile $(pwd)/${ORDERER_CA}
        
        if [ $? -eq 0 ]; then
            print_info "✓ $ORG joined $CHANNEL_NAME"
            return 0
        fi
        
        RETRY=$((RETRY + 1))
        print_info "Retry $RETRY/$MAX_RETRY..."
        sleep $DELAY
    done
    
    print_error "Failed to join $ORG to $CHANNEL_NAME"
    return 1
}

# Update anchor peers
updateAnchorPeers() {
    local CHANNEL_NAME=$1
    local ORG=$2
    local ANCHOR_TX=$3
    
    print_info "Updating anchor peers for $ORG on $CHANNEL_NAME"
    setGlobals $ORG
    
    peer channel update \
        -o ${ORDERER_ENDPOINT} \
        -c ${CHANNEL_NAME} \
        -f ./channel-artifacts/${ANCHOR_TX} \
        --tls --cafile $(pwd)/${ORDERER_CA}
    
    if [ $? -ne 0 ]; then
        print_error "Failed to update anchor peers"
        return 1
    fi
    
    print_info "✓ Anchor peers updated for $ORG"
    return 0
}

# Create CCLB Global Channel
create_cclb_global_channel() {
    print_msg "Creating CCLB Global Channel"
    
    createChannel "cclb-global" "cclb-global.tx" "CCLB"
    sleep 3
    
    # Join organizations to channel
    joinChannel "cclb-global" "CCLB"
    joinChannel "cclb-global" "StateOrgTS"
    joinChannel "cclb-global" "StateOrgKA"
    joinChannel "cclb-global" "StateOrgAP"
    joinChannel "cclb-global" "AdminOrg"
    
    # Update anchor peers
    updateAnchorPeers "cclb-global" "CCLB" "CCLEBAnchorsCCLB.tx"
    
    print_info "✓ CCLB Global Channel setup complete"
}

# Create Regional Channel - Telangana
create_regional_channel_ts() {
    print_msg "Creating Telangana Regional Channel"
    
    createChannel "land-region-ts" "land-region-ts.tx" "StateOrgTS"
    sleep 3
    
    # Join organizations
    joinChannel "land-region-ts" "CCLB"
    joinChannel "land-region-ts" "StateOrgTS"
    joinChannel "land-region-ts" "VROOrg"
    joinChannel "land-region-ts" "MROOrg"
    joinChannel "land-region-ts" "AdminOrg"
    joinChannel "land-region-ts" "CitizenOrg"
    
    # Update anchor peers
    updateAnchorPeers "land-region-ts" "StateOrgTS" "StateOrgTSAnchorsRegionTS.tx"
    
    print_info "✓ Telangana Regional Channel setup complete"
}

# Create Regional Channel - Karnataka
create_regional_channel_ka() {
    print_msg "Creating Karnataka Regional Channel"
    
    createChannel "land-region-ka" "land-region-ka.tx" "StateOrgKA"
    sleep 3
    
    joinChannel "land-region-ka" "CCLB"
    joinChannel "land-region-ka" "StateOrgKA"
    joinChannel "land-region-ka" "VROOrg"
    joinChannel "land-region-ka" "MROOrg"
    joinChannel "land-region-ka" "AdminOrg"
    joinChannel "land-region-ka" "CitizenOrg"
    
    updateAnchorPeers "land-region-ka" "StateOrgKA" "StateOrgKAAnchorsRegionKA.tx"
    
    print_info "✓ Karnataka Regional Channel setup complete"
}

# Create Regional Channel - Andhra Pradesh
create_regional_channel_ap() {
    print_msg "Creating Andhra Pradesh Regional Channel"
    
    createChannel "land-region-ap" "land-region-ap.tx" "StateOrgAP"
    sleep 3
    
    joinChannel "land-region-ap" "CCLB"
    joinChannel "land-region-ap" "StateOrgAP"
    joinChannel "land-region-ap" "VROOrg"
    joinChannel "land-region-ap" "MROOrg"
    joinChannel "land-region-ap" "AdminOrg"
    joinChannel "land-region-ap" "CitizenOrg"
    
    updateAnchorPeers "land-region-ap" "StateOrgAP" "StateOrgAPAnchorsRegionAP.tx"
    
    print_info "✓ Andhra Pradesh Regional Channel setup complete"
}

# Main execution
main() {
    print_msg "Creating All Channels"
    
    # Check if network is running
    echo "Checking for orderer container..."
    ORDERER_CHECK=$(docker ps --format "{{.Names}}" 2>&1 | grep -i "orderer0" || echo "NOT_FOUND")
    echo "Orderer check result: $ORDERER_CHECK"
    
    if [ "$ORDERER_CHECK" = "NOT_FOUND" ]; then
        print_error "Network is not running. Running containers:"
        docker ps --format "table {{.Names}}\t{{.Status}}"
        print_error "Start network with: cd ../.. && docker-compose -f network/docker-compose.yaml up -d"
        exit 1
    fi
    
    echo "Network check passed, proceeding with channel creation..."
    
    # Create all channels
    create_cclb_global_channel
    sleep 5
    
    create_regional_channel_ts
    sleep 5
    
    create_regional_channel_ka
    sleep 5
    
    create_regional_channel_ap
    
    print_msg "All Channels Created Successfully"
    print_info "Next step: Deploy chaincode with ./deploy-chaincode.sh"
}

# Run main
main "$@"
