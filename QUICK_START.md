# Quick Start Guide - Running the Land Registry Project

## Prerequisites

Before starting, ensure you have:

1. **Docker & Docker Compose** installed and running
2. **Node.js 16+** and npm installed
3. **Hyperledger Fabric binaries** (peer, orderer, configtxgen, cryptogen)
4. **Go 1.19+** (for chaincode compilation)
5. **Git** (to clone/download the project)

## Step-by-Step Instructions

### Step 1: Prepare the Project

```bash
# Navigate to project root
cd /path/to/Project

# Ensure all dependencies are installed
cd realestate2/backend
npm install

cd ../../land-registry-frontend
npm install
```

### Step 2: Generate Network Artifacts

```bash
cd network

# Generate crypto material (certificates, keys)
cryptogen generate --config=./cryptogen.yaml --output=./crypto-config

# Generate genesis block for orderer
configtxgen -profile LandRegistryOrdererGenesis -channelID system-channel -outputBlock ./channel-artifacts/orderer.genesis.block

# Generate channel configuration transactions
configtxgen -profile CCLBGlobalChannel -outputCreateChannelTx ./channel-artifacts/cclb-global.tx -channelID cclb-global
configtxgen -profile StateTSChannel -outputCreateChannelTx ./channel-artifacts/state-ts.tx -channelID state-ts

# Generate anchor peer updates
configtxgen -profile CCLBGlobalChannel -outputAnchorPeersUpdate ./channel-artifacts/CCLBAnchors.tx -channelID cclb-global -asOrg CCLB
configtxgen -profile StateTSChannel -outputAnchorPeersUpdate ./channel-artifacts/StateOrgTSAnchors.tx -channelID state-ts -asOrg StateOrgTS
```

### Step 3: Start Fabric Network

```bash
# Start all Fabric containers (orderer, peers, CAs, CouchDB)
docker-compose up -d

# Wait for containers to be healthy (check status)
docker ps

# View logs if needed
docker-compose logs -f
```

### Step 4: Create and Join Channels

```bash
# Create cclb-global channel
docker exec -e CORE_PEER_LOCALMSPID=CCLEBMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp \
  -e CORE_PEER_ADDRESS=peer0.cclb.landregistry.local:7051 \
  peer0.cclb.landregistry.local peer channel create \
  -o orderer0.orderer.landregistry.local:7050 \
  -c cclb-global \
  -f /etc/hyperledger/fabric/channel-artifacts/cclb-global.tx \
  --tls --cafile /etc/hyperledger/fabric/tls/ca.crt

# Create state-ts channel
docker exec -e CORE_PEER_LOCALMSPID=CCLEBMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp \
  -e CORE_PEER_ADDRESS=peer0.cclb.landregistry.local:7051 \
  peer0.cclb.landregistry.local peer channel create \
  -o orderer0.orderer.landregistry.local:7050 \
  -c state-ts \
  -f /etc/hyperledger/fabric/channel-artifacts/state-ts.tx \
  --tls --cafile /etc/hyperledger/fabric/tls/ca.crt

# CCLB peer joins cclb-global
docker exec -e CORE_PEER_LOCALMSPID=CCLEBMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp \
  -e CORE_PEER_ADDRESS=peer0.cclb.landregistry.local:7051 \
  peer0.cclb.landregistry.local peer channel join \
  -b cclb-global.block

# CCLB peer joins state-ts
docker exec -e CORE_PEER_LOCALMSPID=CCLEBMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp \
  -e CORE_PEER_ADDRESS=peer0.cclb.landregistry.local:7051 \
  peer0.cclb.landregistry.local peer channel join \
  -b state-ts.block

# StateOrgTS peer joins cclb-global
docker exec -e CORE_PEER_LOCALMSPID=StateOrgTSMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp \
  -e CORE_PEER_ADDRESS=peer0.ts.landregistry.local:7051 \
  peer0.ts.landregistry.local peer channel join \
  -b cclb-global.block

# StateOrgTS peer joins state-ts
docker exec -e CORE_PEER_LOCALMSPID=StateOrgTSMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp \
  -e CORE_PEER_ADDRESS=peer0.ts.landregistry.local:7051 \
  peer0.ts.landregistry.local peer channel join \
  -b state-ts.block
```

### Step 5: Deploy Chaincode

**Note**: For a simplified first run, you can use the existing chaincode. For production deployment with proper lifecycle, see `DEPLOYMENT_PRODUCTION.md`.

```bash
# Package chaincode (if needed)
cd chaincode/land-registry
go mod vendor
cd ../..

# Install chaincode on peers (simplified - use lifecycle for production)
# See DEPLOYMENT_PRODUCTION.md for full lifecycle deployment
```

### Step 6: Enroll Admin Identities

```bash
cd realestate2/backend

# Enroll CCLB admin
node enrollAdmin.js cclb

# Enroll StateOrgTS admin  
node enrollAdmin.js state-ts
```

**Note**: If `enrollAdmin.js` doesn't exist, you may need to create it or use Fabric CA client directly.

### Step 7: Start Backend Server

```bash
cd realestate2/backend

# Set environment variables (if needed)
export PORT=4000
export FABRIC_NETWORK=custom-network

# Start the backend
npm start
# or
node server.js
```

Backend will start on `http://localhost:4000`

**Verify backend is running**:
```bash
curl http://localhost:4000/health
```

### Step 8: Start Frontend

Open a new terminal:

```bash
cd land-registry-frontend

# Start React development server
npm start
```

Frontend will start on `http://localhost:3000`

### Step 9: Verify Everything Works

1. **Check Backend Health**:
   ```bash
   curl http://localhost:4000/health
   ```
   Should return:
   ```json
   {
     "ok": true,
     "architecture": "ledger-first",
     "ledger": { "healthy": true, ... },
     "storage": { "available": true }
   }
   ```

2. **Test Query** (if you have sample data):
   ```bash
   curl -X POST http://localhost:4000/land/query-by-survey \
     -H "Content-Type: application/json" \
     -d '{
       "district": "Hyderabad",
       "mandal": "Secunderabad", 
       "village": "Test",
       "surveyNo": "123"
     }'
   ```

3. **Open Frontend**:
   - Navigate to `http://localhost:3000`
   - Try searching for a property
   - Verify ledger verification badge appears

## Troubleshooting

### Issue: Docker containers not starting

```bash
# Check Docker is running
docker ps

# Check logs
docker-compose logs

# Restart containers
docker-compose restart
```

### Issue: Backend can't connect to Fabric

1. Check connection profile exists: `realestate2/backend/config/connection-cclb.yaml`
2. Verify wallet has admin identity: `realestate2/backend/wallet/`
3. Check network is running: `docker ps`

### Issue: Chaincode errors

1. Verify chaincode is installed on all peers
2. Check chaincode logs: `docker logs <chaincode-container>`
3. Ensure Go modules are vendored: `go mod vendor`

### Issue: Frontend can't connect to backend

1. Verify backend is running on port 4000
2. Check CORS settings in `server.js`
3. Verify API endpoint in frontend: `land-registry-frontend/src/App.js` (line 23)

## Quick Commands Reference

```bash
# Start everything
cd network && docker-compose up -d
cd ../realestate2/backend && npm start &
cd ../../land-registry-frontend && npm start

# Stop everything
docker-compose down
# Stop backend/frontend: Ctrl+C in respective terminals

# View logs
docker-compose logs -f
docker logs <container-name>

# Reset everything (WARNING: deletes all data)
docker-compose down -v
rm -rf network/crypto-config
rm -rf network/channel-artifacts/*
```

## Using the Automated Script

For faster setup, use the deployment script:

```bash
# Make script executable
chmod +x deploy.sh

# Run script
./deploy.sh
```

This will:
- Generate network artifacts
- Start Fabric network
- Install dependencies

You'll still need to:
- Create/join channels (Step 4)
- Deploy chaincode (Step 5)
- Enroll identities (Step 6)
- Start backend/frontend (Steps 7-8)

## Next Steps

- See `DEPLOYMENT_PRODUCTION.md` for detailed production deployment
- See `PRODUCTION_FIXES_SUMMARY.md` for architecture details
- Check `network/README.md` for network-specific information

## Support

If you encounter issues:
1. Check logs: `docker-compose logs`
2. Verify prerequisites are installed
3. Ensure ports 3000, 4000, 7050-7055, 5984, 6984 are available
4. Review `DEPLOYMENT_PRODUCTION.md` for detailed troubleshooting
