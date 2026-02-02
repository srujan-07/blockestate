# How to Run the Project

## Quick Start (5 Minutes)

### Option 1: Automated Script

```bash
# 1. Run deployment script
chmod +x deploy.sh
./deploy.sh

# 2. Follow the instructions shown by the script
# 3. Start backend and frontend manually (see below)
```

### Option 2: Manual Setup

```bash
# 1. Start Fabric Network
cd network
docker-compose up -d

# 2. Start Backend (Terminal 1)
cd ../realestate2/backend
npm install
npm start

# 3. Start Frontend (Terminal 2)
cd ../../land-registry-frontend
npm install
npm start

# 4. Open browser
# Frontend: http://localhost:3000
# Backend API: http://localhost:4000
```

## Detailed Steps

### Prerequisites Check

```bash
# Check Docker
docker --version
docker-compose --version

# Check Node.js
node --version  # Should be 16+
npm --version

# Check Go (for chaincode)
go version  # Should be 1.19+
```

### Step 1: Network Setup

```bash
cd network

# Generate crypto material (first time only)
if [ ! -d "crypto-config" ]; then
  cryptogen generate --config=./cryptogen.yaml --output=./crypto-config
fi

# Generate genesis block (first time only)
if [ ! -f "channel-artifacts/orderer.genesis.block" ]; then
  configtxgen -profile LandRegistryOrdererGenesis \
    -channelID system-channel \
    -outputBlock ./channel-artifacts/orderer.genesis.block
fi

# Start network
docker-compose up -d

# Wait for containers (10-15 seconds)
sleep 15

# Verify containers are running
docker ps
```

### Step 2: Backend Setup

```bash
cd realestate2/backend

# Install dependencies (first time only)
npm install

# Check configuration
# Ensure connection profiles exist in: config/
# Ensure wallet directory exists: wallet/

# Start backend
npm start
```

**Backend will run on**: `http://localhost:4000`

**Test backend**:
```bash
curl http://localhost:4000/health
```

### Step 3: Frontend Setup

Open a **new terminal**:

```bash
cd land-registry-frontend

# Install dependencies (first time only)
npm install

# Start frontend
npm start
```

**Frontend will open automatically** at: `http://localhost:3000`

## Verification

### 1. Check Backend Health

```bash
curl http://localhost:4000/health
```

Expected response:
```json
{
  "ok": true,
  "architecture": "ledger-first",
  "ledger": {
    "healthy": true,
    "connected": true,
    "channel": "state-ts"
  }
}
```

### 2. Test API Endpoint

```bash
# Query by survey number
curl -X POST http://localhost:4000/land/query-by-survey \
  -H "Content-Type: application/json" \
  -d '{
    "district": "Hyderabad",
    "mandal": "Secunderabad",
    "village": "Test",
    "surveyNo": "123"
  }'
```

### 3. Open Frontend

Navigate to `http://localhost:3000` and:
- Enter search criteria
- Click "Search"
- Verify ledger verification badge appears

## Common Issues & Solutions

### Problem: "Cannot connect to Fabric network"

**Solution**:
```bash
# 1. Check network is running
cd network
docker ps

# 2. Check connection profile exists
ls realestate2/backend/config/connection-cclb.yaml

# 3. Check wallet has identity
ls realestate2/backend/wallet/

# 4. Restart backend
cd realestate2/backend
npm start
```

### Problem: "Port already in use"

**Solution**:
```bash
# Backend (port 4000)
lsof -ti:4000 | xargs kill -9

# Frontend (port 3000)
lsof -ti:3000 | xargs kill -9

# Or change ports in:
# - Backend: realestate2/backend/server.js (line 205)
# - Frontend: package.json scripts
```

### Problem: "Chaincode not found"

**Solution**:
```bash
# For development, you may need to deploy chaincode first
# See DEPLOYMENT_PRODUCTION.md for full chaincode deployment
# Or use test-network for initial testing
```

### Problem: "Wallet identity not found"

**Solution**:
```bash
# Enroll admin identity
cd realestate2/backend

# If enrollAdmin.js exists:
node enrollAdmin.js cclb

# Or use Fabric CA client directly:
fabric-ca-client enroll -u https://admin:adminpw@localhost:7054 \
  --caname ca-cclb \
  -M ./wallet/admin
```

## Development vs Production

### Development Mode (Simplified)

For quick testing, you can use:
- Single channel setup
- Simplified chaincode deployment
- Test identities

### Production Mode

For production deployment:
- Follow `DEPLOYMENT_PRODUCTION.md`
- Use proper lifecycle chaincode deployment
- Set up proper TLS certificates
- Configure endorsement policies

## Stopping the Project

```bash
# Stop frontend: Ctrl+C in frontend terminal
# Stop backend: Ctrl+C in backend terminal

# Stop Fabric network
cd network
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

## File Structure

```
Project/
├── network/              # Fabric network configuration
│   ├── docker-compose.yaml
│   ├── configtx.yaml
│   └── channel-artifacts/
├── chaincode/            # Go chaincode
│   ├── land-registry/
│   └── cclb-registry/
├── realestate2/backend/   # Node.js backend
│   ├── server.js
│   ├── services/
│   │   ├── LedgerService.js
│   │   └── StorageService.js
│   └── config/           # Connection profiles
├── land-registry-frontend/ # React frontend
│   └── src/
└── deploy.sh             # Deployment script
```

## Next Steps

1. **Add Sample Data**: Create properties via API or chaincode
2. **Test Queries**: Verify ledger-first queries work
3. **Monitor Logs**: Check backend and Fabric logs
4. **Read Documentation**: 
   - `PRODUCTION_FIXES_SUMMARY.md` - Architecture details
   - `DEPLOYMENT_PRODUCTION.md` - Full deployment guide

## Quick Reference

| Component | Port | URL |
|-----------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend API | 4000 | http://localhost:4000 |
| Orderer | 7050 | orderer0.orderer.landregistry.local:7050 |
| CCLB Peer | 7051 | peer0.cclb.landregistry.local:7051 |
| StateOrgTS Peer | 9051 | peer0.ts.landregistry.local:7051 |
| CCLB CA | 7054 | ca-cclb:7054 |
| StateOrgTS CA | 7055 | ca-ts:7055 |
| CCLB CouchDB | 5984 | couchdb-cclb:5984 |
| StateOrgTS CouchDB | 6984 | couchdb-ts:5984 |

## Need Help?

- Check logs: `docker-compose logs`
- Review `DEPLOYMENT_PRODUCTION.md` for detailed steps
- Verify all prerequisites are installed
- Ensure ports are not in use
