# Production Deployment Guide

## Overview

This guide provides step-by-step instructions to deploy the production-grade Hyperledger Fabric land registry system.

## Architecture

- **Ledger**: Hyperledger Fabric (Source of Truth)
- **Organizations**: CCLB (Central Authority) + State Organizations (TS, KA, AP)
- **Endorsement**: CCLB + State must endorse all transactions
- **Database**: Secondary storage (indexing, documents only)
- **Backend**: Node.js (Ledger-first queries)
- **Frontend**: React (Displays ledger-verified data)

## Prerequisites

1. Docker and Docker Compose installed
2. Node.js 16+ and npm
3. Hyperledger Fabric binaries (peer, orderer, configtxgen, cryptogen)
4. Go 1.19+ (for chaincode)
5. Network configuration files generated

## Step 1: Generate Network Artifacts

```bash
cd network

# Generate crypto material
cryptogen generate --config=./cryptogen.yaml --output=./crypto-config

# Generate genesis block
configtxgen -profile LandRegistryOrdererGenesis -channelID system-channel -outputBlock ./channel-artifacts/orderer.genesis.block

# Generate channel artifacts
configtxgen -profile CCLBGlobalChannel -outputCreateChannelTx ./channel-artifacts/cclb-global.tx -channelID cclb-global
configtxgen -profile StateTSChannel -outputCreateChannelTx ./channel-artifacts/state-ts.tx -channelID state-ts

# Generate anchor peer updates
configtxgen -profile CCLBGlobalChannel -outputAnchorPeersUpdate ./channel-artifacts/CCLBAnchors.tx -channelID cclb-global -asOrg CCLB
configtxgen -profile StateTSChannel -outputAnchorPeersUpdate ./channel-artifacts/StateOrgTSAnchors.tx -channelID state-ts -asOrg StateOrgTS
```

## Step 2: Start Fabric Network

```bash
cd network
docker-compose up -d
```

Wait for all containers to be healthy:
```bash
docker ps
```

## Step 3: Create Channels

```bash
# Create cclb-global channel
docker exec -e CORE_PEER_LOCALMSPID=CCLEBMSP -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp -e CORE_PEER_ADDRESS=peer0.cclb.landregistry.local:7051 peer0.cclb.landregistry.local peer channel create -o orderer0.orderer.landregistry.local:7050 -c cclb-global -f /etc/hyperledger/fabric/channel-artifacts/cclb-global.tx --tls --cafile /etc/hyperledger/fabric/tls/ca.crt

# Create state-ts channel
docker exec -e CORE_PEER_LOCALMSPID=CCLEBMSP -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp -e CORE_PEER_ADDRESS=peer0.cclb.landregistry.local:7051 peer0.cclb.landregistry.local peer channel create -o orderer0.orderer.landregistry.local:7050 -c state-ts -f /etc/hyperledger/fabric/channel-artifacts/state-ts.tx --tls --cafile /etc/hyperledger/fabric/tls/ca.crt
```

## Step 4: Join Channels

```bash
# CCLB peer joins cclb-global
docker exec -e CORE_PEER_LOCALMSPID=CCLEBMSP -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp -e CORE_PEER_ADDRESS=peer0.cclb.landregistry.local:7051 peer0.cclb.landregistry.local peer channel join -b cclb-global.block

# CCLB peer joins state-ts
docker exec -e CORE_PEER_LOCALMSPID=CCLEBMSP -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp -e CORE_PEER_ADDRESS=peer0.cclb.landregistry.local:7051 peer0.cclb.landregistry.local peer channel join -b state-ts.block

# StateOrgTS peer joins cclb-global
docker exec -e CORE_PEER_LOCALMSPID=StateOrgTSMSP -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp -e CORE_PEER_ADDRESS=peer0.ts.landregistry.local:7051 peer0.ts.landregistry.local peer channel join -b cclb-global.block

# StateOrgTS peer joins state-ts
docker exec -e CORE_PEER_LOCALMSPID=StateOrgTSMSP -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp -e CORE_PEER_ADDRESS=peer0.ts.landregistry.local:7051 peer0.ts.landregistry.local peer channel join -b state-ts.block
```

## Step 5: Update Anchor Peers

```bash
# Update CCLB anchor peer on cclb-global
docker exec -e CORE_PEER_LOCALMSPID=CCLEBMSP -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp -e CORE_PEER_ADDRESS=peer0.cclb.landregistry.local:7051 peer0.cclb.landregistry.local peer channel update -o orderer0.orderer.landregistry.local:7050 -c cclb-global -f /etc/hyperledger/fabric/channel-artifacts/CCLBAnchors.tx --tls --cafile /etc/hyperledger/fabric/tls/ca.crt

# Update StateOrgTS anchor peer on state-ts
docker exec -e CORE_PEER_LOCALMSPID=StateOrgTSMSP -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp -e CORE_PEER_ADDRESS=peer0.ts.landregistry.local:7051 peer0.ts.landregistry.local peer channel update -o orderer0.orderer.landregistry.local:7050 -c state-ts -f /etc/hyperledger/fabric/channel-artifacts/StateOrgTSAnchors.tx --tls --cafile /etc/hyperledger/fabric/tls/ca.crt
```

## Step 6: Package and Install Chaincode

```bash
# Package CCLB chaincode
cd chaincode/cclb-registry
go mod vendor
cd ../..

# Package Land Registry chaincode
cd chaincode/land-registry
go mod vendor
cd ../..

# Install CCLB chaincode on CCLB peer (cclb-global channel)
docker exec -e CORE_PEER_LOCALMSPID=CCLEBMSP -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp -e CORE_PEER_ADDRESS=peer0.cclb.landregistry.local:7051 peer0.cclb.landregistry.local peer lifecycle chaincode package cclb-registry.tar.gz --path /opt/gopath/src/github.com/chaincode/cclb-registry --lang golang --label cclb-registry_1.0

# Install Land Registry chaincode on both peers (state-ts channel)
docker exec -e CORE_PEER_LOCALMSPID=CCLEBMSP -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp -e CORE_PEER_ADDRESS=peer0.cclb.landregistry.local:7051 peer0.cclb.landregistry.local peer lifecycle chaincode package land-registry.tar.gz --path /opt/gopath/src/github.com/chaincode/land-registry --lang golang --label land-registry_1.0

docker exec -e CORE_PEER_LOCALMSPID=StateOrgTSMSP -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp -e CORE_PEER_ADDRESS=peer0.ts.landregistry.local:7051 peer0.ts.landregistry.local peer lifecycle chaincode package land-registry.tar.gz --path /opt/gopath/src/github.com/chaincode/land-registry --lang golang --label land-registry_1.0
```

## Step 7: Approve and Commit Chaincode

```bash
# Approve CCLB chaincode (CCLB peer)
docker exec -e CORE_PEER_LOCALMSPID=CCLEBMSP peer0.cclb.landregistry.local peer lifecycle chaincode approveformyorg -o orderer0.orderer.landregistry.local:7050 --channelID cclb-global --name cclb-registry --version 1.0 --package-id <PACKAGE_ID> --sequence 1 --tls --cafile /etc/hyperledger/fabric/tls/ca.crt --signature-policy "AND('CCLEBMSP.peer', 'StateOrgTSMSP.peer')"

# Approve Land Registry chaincode (both peers)
docker exec -e CORE_PEER_LOCALMSPID=CCLEBMSP peer0.cclb.landregistry.local peer lifecycle chaincode approveformyorg -o orderer0.orderer.landregistry.local:7050 --channelID state-ts --name landregistry --version 1.0 --package-id <PACKAGE_ID> --sequence 1 --tls --cafile /etc/hyperledger/fabric/tls/ca.crt --signature-policy "AND('CCLEBMSP.peer', 'StateOrgTSMSP.peer')"

docker exec -e CORE_PEER_LOCALMSPID=StateOrgTSMSP peer0.ts.landregistry.local peer lifecycle chaincode approveformyorg -o orderer0.orderer.landregistry.local:7050 --channelID state-ts --name landregistry --version 1.0 --package-id <PACKAGE_ID> --sequence 1 --tls --cafile /etc/hyperledger/fabric/tls/ca.crt --signature-policy "AND('CCLEBMSP.peer', 'StateOrgTSMSP.peer')"

# Commit chaincode
docker exec -e CORE_PEER_LOCALMSPID=CCLEBMSP peer0.cclb.landregistry.local peer lifecycle chaincode commit -o orderer0.orderer.landregistry.local:7050 --channelID cclb-global --name cclb-registry --version 1.0 --sequence 1 --tls --cafile /etc/hyperledger/fabric/tls/ca.crt --peerAddresses peer0.cclb.landregistry.local:7051 --tlsRootCertFiles /etc/hyperledger/fabric/tls/ca.crt --peerAddresses peer0.ts.landregistry.local:7051 --tlsRootCertFiles /etc/hyperledger/fabric/tls/ca.crt

docker exec -e CORE_PEER_LOCALMSPID=CCLEBMSP peer0.cclb.landregistry.local peer lifecycle chaincode commit -o orderer0.orderer.landregistry.local:7050 --channelID state-ts --name landregistry --version 1.0 --sequence 1 --tls --cafile /etc/hyperledger/fabric/tls/ca.crt --peerAddresses peer0.cclb.landregistry.local:7051 --tlsRootCertFiles /etc/hyperledger/fabric/tls/ca.crt --peerAddresses peer0.ts.landregistry.local:7051 --tlsRootCertFiles /etc/hyperledger/fabric/tls/ca.crt
```

## Step 8: Enroll Admin Identities

```bash
cd realestate2/backend

# Enroll CCLB admin
node enrollAdmin.js cclb

# Enroll StateOrgTS admin
node enrollAdmin.js state-ts
```

## Step 9: Start Backend

```bash
cd realestate2/backend
npm install
npm start
```

Backend will run on `http://localhost:4000`

## Step 10: Start Frontend

```bash
cd land-registry-frontend
npm install
npm start
```

Frontend will run on `http://localhost:3000`

## Verification

1. **Check Network Health**:
   ```bash
   curl http://localhost:4000/health
   ```

2. **Query Property**:
   ```bash
   curl -X POST http://localhost:4000/land/query-by-survey \
     -H "Content-Type: application/json" \
     -d '{"district":"Hyderabad","mandal":"Secunderabad","village":"Test","surveyNo":"123"}'
   ```

3. **Verify Ledger Data**:
   - All responses should include `ledgerVerified: true`
   - Transaction IDs should be present
   - Endorsement information should be displayed

## Troubleshooting

1. **Chaincode not found**: Ensure chaincode is packaged and installed correctly
2. **Endorsement policy failure**: Verify both CCLB and State peers are endorsing
3. **Connection errors**: Check connection profiles in `backend/config/`
4. **Wallet errors**: Ensure admin identities are enrolled

## Production Considerations

1. **TLS**: All communication uses TLS
2. **Discovery**: Disabled for production (explicit peer configuration)
3. **Endorsement**: CCLB + State must endorse (no single-node trust)
4. **Ledger Authority**: All reads query ledger first
5. **Database**: Secondary only (indexing, documents)
