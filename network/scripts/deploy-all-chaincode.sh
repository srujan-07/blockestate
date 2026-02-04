#!/bin/bash

# ============================================================================
# DEPLOY CHAINCODE - Land Registry Blockchain Network
# ============================================================================
# This script deploys chaincode to all channels using Fabric 2.x lifecycle:
# 1. Package chaincode
# 2. Install on peers
# 3. Approve for organizations
# 4. Commit to channels
# ============================================================================

set -e

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
CC_NAME="landregistry"
CC_VERSION="1.0"
CC_SEQUENCE="1"
CC_SRC_PATH="../../chaincode/land-registry"
CC_RUNTIME_LANGUAGE="golang"
CC_INIT_FCN="InitLedger"

CCLB_CC_NAME="cclb-registry"
CCLB_CC_VERSION="1.0"
CCLB_CC_SEQUENCE="1"
CCLB_CC_SRC_PATH="../../chaincode/cclb-registry"

DELAY=3
MAX_RETRY=5

# Set fabric config path
export FABRIC_CFG_PATH=$(pwd)
export PATH=${PWD}/../../fabric-samples/bin:$PATH
export GOPATH=$HOME/go
export GO111MODULE=on

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

# Set environment for organization
setGlobals() {
    local ORG=$1
    
    case $ORG in
        "CCLB")
            export CORE_PEER_LOCALMSPID="CCLEBMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/crypto-config/peerOrganizations/cclb.landregistry.local/peers/peer0.cclb.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/crypto-config/peerOrganizations/cclb.landregistry.local/users/Admin@cclb.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.cclb.landregistry.local:7051
            ;;
        "StateOrgTS")
            export CORE_PEER_LOCALMSPID="StateOrgTSMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/crypto-config/peerOrganizations/ts.landregistry.local/peers/peer0.ts.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/crypto-config/peerOrganizations/ts.landregistry.local/users/Admin@ts.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.ts.landregistry.local:7051
            ;;
        "StateOrgKA")
            export CORE_PEER_LOCALMSPID="StateOrgKAMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/crypto-config/peerOrganizations/ka.landregistry.local/peers/peer0.ka.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/crypto-config/peerOrganizations/ka.landregistry.local/users/Admin@ka.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.ka.landregistry.local:8051
            ;;
        "StateOrgAP")
            export CORE_PEER_LOCALMSPID="StateOrgAPMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/crypto-config/peerOrganizations/ap.landregistry.local/peers/peer0.ap.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/crypto-config/peerOrganizations/ap.landregistry.local/users/Admin@ap.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.ap.landregistry.local:9051
            ;;
        "VROOrg")
            export CORE_PEER_LOCALMSPID="VROOrgMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/crypto-config/peerOrganizations/vro.landregistry.local/peers/peer0.vro.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/crypto-config/peerOrganizations/vro.landregistry.local/users/Admin@vro.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.vro.landregistry.local:10051
            ;;
        "MROOrg")
            export CORE_PEER_LOCALMSPID="MROOrgMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/crypto-config/peerOrganizations/mro.landregistry.local/peers/peer0.mro.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/crypto-config/peerOrganizations/mro.landregistry.local/users/Admin@mro.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.mro.landregistry.local:11051
            ;;
        "AdminOrg")
            export CORE_PEER_LOCALMSPID="AdminOrgMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/crypto-config/peerOrganizations/admin.landregistry.local/peers/peer0.admin.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/crypto-config/peerOrganizations/admin.landregistry.local/users/Admin@admin.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.admin.landregistry.local:12051
            ;;
        "CitizenOrg")
            export CORE_PEER_LOCALMSPID="CitizenOrgMSP"
            export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/crypto-config/peerOrganizations/citizen.landregistry.local/peers/peer0.citizen.landregistry.local/tls/ca.crt
            export CORE_PEER_MSPCONFIGPATH=$(pwd)/crypto-config/peerOrganizations/citizen.landregistry.local/users/Admin@citizen.landregistry.local/msp
            export CORE_PEER_ADDRESS=peer0.citizen.landregistry.local:13051
            ;;
    esac
    
    export CORE_PEER_TLS_ENABLED=true
}

# Package chaincode
packageChaincode() {
    local CC_NAME=$1
    local CC_SRC_PATH=$2
    local CC_PACKAGE_FILE="${CC_NAME}.tar.gz"
    
    print_info "Packaging chaincode: $CC_NAME"
    
    # Remove old package if exists
    rm -f ${CC_PACKAGE_FILE}
    
    # Ensure go dependencies are present
    cd ${CC_SRC_PATH}
    go mod vendor
    cd -
    
    # Package chaincode
    peer lifecycle chaincode package ${CC_PACKAGE_FILE} \
        --path ${CC_SRC_PATH} \
        --lang ${CC_RUNTIME_LANGUAGE} \
        --label ${CC_NAME}_${CC_VERSION}
    
    if [ $? -ne 0 ]; then
        print_error "Failed to package chaincode"
        exit 1
    fi
    
    print_info "✓ Chaincode packaged: ${CC_PACKAGE_FILE}"
}

# Install chaincode on peer
installChaincode() {
    local ORG=$1
    local CC_PACKAGE_FILE=$2
    
    print_info "Installing chaincode on $ORG"
    setGlobals $ORG
    
    peer lifecycle chaincode install ${CC_PACKAGE_FILE} \
        --peerAddresses ${CORE_PEER_ADDRESS} \
        --tlsRootCertFiles ${CORE_PEER_TLS_ROOTCERT_FILE}
    
    if [ $? -ne 0 ]; then
        print_error "Failed to install chaincode on $ORG"
        return 1
    fi
    
    print_info "✓ Chaincode installed on $ORG"
}

# Query installed chaincode to get package ID
queryInstalled() {
    local ORG=$1
    local CC_NAME=$2
    
    setGlobals $ORG
    peer lifecycle chaincode queryinstalled --peerAddresses ${CORE_PEER_ADDRESS} \
        --tlsRootCertFiles ${CORE_PEER_TLS_ROOTCERT_FILE} >&log.txt
    
    PACKAGE_ID=$(sed -n "/${CC_NAME}_${CC_VERSION}/{s/^Package ID: //; s/, Label:.*$//; p;}" log.txt)
    echo $PACKAGE_ID
}

# Approve chaincode for organization
approveForOrg() {
    local ORG=$1
    local CHANNEL_NAME=$2
    local CC_NAME=$3
    local PACKAGE_ID=$4
    local CC_SEQUENCE=$5
    
    print_info "Approving chaincode for $ORG on $CHANNEL_NAME"
    setGlobals $ORG
    
    peer lifecycle chaincode approveformyorg \
        -o orderer0.orderer.landregistry.local:7050 \
        --channelID ${CHANNEL_NAME} \
        --name ${CC_NAME} \
        --version ${CC_VERSION} \
        --package-id ${PACKAGE_ID} \
        --sequence ${CC_SEQUENCE} \
        --tls --cafile $(pwd)/crypto-config/ordererOrganizations/orderer.landregistry.local/orderers/orderer0.orderer.landregistry.local/msp/tlscacerts/tlsca.orderer.landregistry.local-cert.pem \
        --signature-policy "OR('StateOrgTSMSP.peer','StateOrgKAMSP.peer','StateOrgAPMSP.peer','VROOrgMSP.peer','MROOrgMSP.peer','CCLEBMSP.peer')"
    
    if [ $? -ne 0 ]; then
        print_error "Failed to approve chaincode for $ORG"
        return 1
    fi
    
    print_info "✓ Chaincode approved for $ORG"
}

# Check commit readiness
checkCommitReadiness() {
    local CHANNEL_NAME=$1
    local CC_NAME=$2
    local CC_SEQUENCE=$3
    
    print_info "Checking commit readiness on $CHANNEL_NAME"
    setGlobals "CCLB"
    
    peer lifecycle chaincode checkcommitreadiness \
        --channelID ${CHANNEL_NAME} \
        --name ${CC_NAME} \
        --version ${CC_VERSION} \
        --sequence ${CC_SEQUENCE} \
        --output json \
        --tls --cafile $(pwd)/crypto-config/ordererOrganizations/orderer.landregistry.local/orderers/orderer0.orderer.landregistry.local/msp/tlscacerts/tlsca.orderer.landregistry.local-cert.pem
}

# Commit chaincode to channel
commitChaincode() {
    local CHANNEL_NAME=$1
    local CC_NAME=$2
    local CC_SEQUENCE=$3
    shift 3
    local ORGS=("$@")
    
    print_info "Committing chaincode to $CHANNEL_NAME"
    setGlobals "${ORGS[0]}"
    
    # Build peer addresses and TLS certs
    local PEER_CONN_PARAMS=""
    for ORG in "${ORGS[@]}"; do
        setGlobals $ORG
        PEER_CONN_PARAMS="$PEER_CONN_PARAMS --peerAddresses $CORE_PEER_ADDRESS --tlsRootCertFiles $CORE_PEER_TLS_ROOTCERT_FILE"
    done
    
    # Commit chaincode
    peer lifecycle chaincode commit \
        -o orderer0.orderer.landregistry.local:7050 \
        --channelID ${CHANNEL_NAME} \
        --name ${CC_NAME} \
        --version ${CC_VERSION} \
        --sequence ${CC_SEQUENCE} \
        ${PEER_CONN_PARAMS} \
        --tls --cafile $(pwd)/crypto-config/ordererOrganizations/orderer.landregistry.local/orderers/orderer0.orderer.landregistry.local/msp/tlscacerts/tlsca.orderer.landregistry.local-cert.pem \
        --signature-policy "OR('StateOrgTSMSP.peer','StateOrgKAMSP.peer','StateOrgAPMSP.peer','VROOrgMSP.peer','MROOrgMSP.peer','CCLEBMSP.peer')"
    
    if [ $? -ne 0 ]; then
        print_error "Failed to commit chaincode"
        return 1
    fi
    
    print_info "✓ Chaincode committed to $CHANNEL_NAME"
}

# Deploy CCLB Registry chaincode to cclb-global channel
deploy_cclb_chaincode() {
    print_msg "Deploying CCLB Registry Chaincode"
    
    # Package chaincode
    packageChaincode ${CCLB_CC_NAME} ${CCLB_CC_SRC_PATH}
    
    # Install on all organizations in cclb-global channel
    installChaincode "CCLB" "${CCLB_CC_NAME}.tar.gz"
    installChaincode "StateOrgTS" "${CCLB_CC_NAME}.tar.gz"
    installChaincode "StateOrgKA" "${CCLB_CC_NAME}.tar.gz"
    installChaincode "StateOrgAP" "${CCLB_CC_NAME}.tar.gz"
    installChaincode "AdminOrg" "${CCLB_CC_NAME}.tar.gz"
    
    # Get package ID
    PACKAGE_ID=$(queryInstalled "CCLB" ${CCLB_CC_NAME})
    print_info "Package ID: $PACKAGE_ID"
    
    # Approve for all orgs
    approveForOrg "CCLB" "cclb-global" ${CCLB_CC_NAME} ${PACKAGE_ID} ${CCLB_CC_SEQUENCE}
    approveForOrg "StateOrgTS" "cclb-global" ${CCLB_CC_NAME} ${PACKAGE_ID} ${CCLB_CC_SEQUENCE}
    approveForOrg "StateOrgKA" "cclb-global" ${CCLB_CC_NAME} ${PACKAGE_ID} ${CCLB_CC_SEQUENCE}
    approveForOrg "StateOrgAP" "cclb-global" ${CCLB_CC_NAME} ${PACKAGE_ID} ${CCLB_CC_SEQUENCE}
    approveForOrg "AdminOrg" "cclb-global" ${CCLB_CC_NAME} ${PACKAGE_ID} ${CCLB_CC_SEQUENCE}
    
    # Check commit readiness
    checkCommitReadiness "cclb-global" ${CCLB_CC_NAME} ${CCLB_CC_SEQUENCE}
    
    # Commit
    commitChaincode "cclb-global" ${CCLB_CC_NAME} ${CCLB_CC_SEQUENCE} "CCLB" "StateOrgTS" "StateOrgKA" "StateOrgAP" "AdminOrg"
    
    print_info "✓ CCLB chaincode deployed to cclb-global"
}

# Deploy Land Registry chaincode to regional channels
deploy_landregistry_chaincode() {
    local CHANNEL_NAME=$1
    shift
    local ORGS=("$@")
    
    print_msg "Deploying Land Registry Chaincode to $CHANNEL_NAME"
    
    # Package chaincode (once)
    if [ ! -f "${CC_NAME}.tar.gz" ]; then
        packageChaincode ${CC_NAME} ${CC_SRC_PATH}
    fi
    
    # Install on all orgs in this channel
    for ORG in "${ORGS[@]}"; do
        installChaincode $ORG "${CC_NAME}.tar.gz"
    done
    
    # Get package ID
    PACKAGE_ID=$(queryInstalled "${ORGS[0]}" ${CC_NAME})
    print_info "Package ID: $PACKAGE_ID"
    
    # Approve for all orgs
    for ORG in "${ORGS[@]}"; do
        approveForOrg $ORG ${CHANNEL_NAME} ${CC_NAME} ${PACKAGE_ID} ${CC_SEQUENCE}
    done
    
    # Check commit readiness
    checkCommitReadiness ${CHANNEL_NAME} ${CC_NAME} ${CC_SEQUENCE}
    
    # Commit
    commitChaincode ${CHANNEL_NAME} ${CC_NAME} ${CC_SEQUENCE} "${ORGS[@]}"
    
    print_info "✓ Land Registry chaincode deployed to $CHANNEL_NAME"
}

# Main execution
main() {
    print_msg "Deploying All Chaincodes"
    
    # Check if channels are created
    docker ps | grep -q peer0.cclb.landregistry.local
    if [ $? -ne 0 ]; then
        print_error "Network is not running. Start it first."
        exit 1
    fi
    
    # Deploy CCLB Registry to cclb-global channel
    deploy_cclb_chaincode
    sleep 5
    
    # Deploy Land Registry to regional channels
    deploy_landregistry_chaincode "land-region-ts" "CCLB" "StateOrgTS" "VROOrg" "MROOrg" "AdminOrg" "CitizenOrg"
    sleep 5
    
    deploy_landregistry_chaincode "land-region-ka" "CCLB" "StateOrgKA" "VROOrg" "MROOrg" "AdminOrg" "CitizenOrg"
    sleep 5
    
    deploy_landregistry_chaincode "land-region-ap" "CCLB" "StateOrgAP" "VROOrg" "MROOrg" "AdminOrg" "CitizenOrg"
    
    print_msg "All Chaincodes Deployed Successfully"
    print_info "Network is ready for transactions!"
}

# Run main
main "$@"
