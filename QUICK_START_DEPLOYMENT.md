# 🚀 QUICK START DEPLOYMENT GUIDE
## Land Registry Blockchain System - Production Deployment

---

## ⚡ RAPID DEPLOYMENT (5 Steps)

This guide will get your production-grade blockchain network running in **under 15 minutes**.

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### System Requirements
```
✓ OS: Ubuntu 20.04+ / macOS 11+ / Windows 10+ (WSL2)
✓ RAM: 8GB minimum, 16GB recommended
✓ Disk: 20GB free space
✓ CPU: 4 cores minimum
✓ Network: Stable internet connection
```

### Software Installation

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 2. Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Install Go
wget https://go.dev/dl/go1.19.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.19.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# 5. Install Fabric Binaries
cd fabric-samples
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.2.0 1.4.9
export PATH=${PWD}/bin:$PATH
```

---

## 🎯 STEP 1: NETWORK BOOTSTRAP

### Generate Crypto Material & Start Network

```bash
cd network/scripts
chmod +x *.sh

# Setup network (generates MSP, TLS, genesis block)
./setup-network.sh
```

**What this does:**
- ✅ Generates certificates for 8 organizations
- ✅ Creates genesis block for orderer
- ✅ Generates channel transaction files
- ✅ Starts all Docker containers

**Expected Output:**
```
========================================
Network Setup Complete
========================================
✓ All prerequisites met
✓ Cleanup complete
✓ Crypto material generated successfully
✓ Channel artifacts generated successfully
✓ Network started successfully
```

**Verification:**
```bash
# Check running containers
docker ps

# Should see 16+ containers:
# - 1 orderer
# - 8 peers (one per organization)
# - 8 CouchDB instances
```

---

## 🔗 STEP 2: CREATE CHANNELS

### Create All Channels

```bash
# Still in network/scripts
./create-all-channels.sh
```

**What this does:**
- ✅ Creates `cclb-global` channel (Property ID registry)
- ✅ Creates `land-region-ts` channel (Telangana)
- ✅ Creates `land-region-ka` channel (Karnataka)
- ✅ Creates `land-region-ap` channel (Andhra Pradesh)
- ✅ Joins all organizations to their respective channels
- ✅ Updates anchor peers

**Expected Output:**
```
========================================
All Channels Created Successfully
========================================
✓ CCLB Global Channel setup complete
✓ Telangana Regional Channel setup complete
✓ Karnataka Regional Channel setup complete
✓ Andhra Pradesh Regional Channel setup complete
```

**Verification:**
```bash
# Check channel creation
docker exec peer0.cclb.landregistry.local peer channel list

# Should show:
# Channels peers has joined:
# cclb-global
# land-region-ts
```

---

## 📦 STEP 3: DEPLOY CHAINCODE

### Package, Install, and Commit Chaincode

```bash
# Still in network/scripts
./deploy-all-chaincode.sh
```

**What this does:**
- ✅ Packages `cclb-registry` chaincode
- ✅ Packages `landregistry` chaincode
- ✅ Installs on all required peers
- ✅ Approves for each organization
- ✅ Commits to channels (Fabric 2.x lifecycle)

**Expected Duration:** 3-5 minutes

**Expected Output:**
```
========================================
All Chaincodes Deployed Successfully
========================================
✓ CCLB chaincode deployed to cclb-global
✓ Land Registry chaincode deployed to land-region-ts
✓ Land Registry chaincode deployed to land-region-ka
✓ Land Registry chaincode deployed to land-region-ap
Network is ready for transactions!
```

**Verification:**
```bash
# Query committed chaincode
peer lifecycle chaincode querycommitted \
  -C land-region-ts \
  -n landregistry

# Should show version 1.0 committed
```

---

## 🖥️ STEP 4: START BACKEND API

### Launch Node.js Backend

```bash
cd ../../realestate2/backend

# Install dependencies
npm install

# Start API server
node api-complete.js
```

**Expected Output:**
```
========================================
Land Registry Backend API Server
========================================
✓ Server running on port 3000
✓ Channel: land-region-ts
✓ Chaincode: landregistry
========================================
Available Endpoints:
  POST   /api/auth/enroll
  POST   /api/land/submit
  POST   /api/land/verify
  POST   /api/land/approve
  ... (more endpoints)
```

**Verification:**
```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-02-04T...",
  "service": "Land Registry Backend API",
  "version": "1.0.0"
}
```

---

## ✅ STEP 5: VALIDATE DEPLOYMENT

### Run System Tests

```bash
# Test 1: Enroll a citizen
curl -X POST http://localhost:3000/api/auth/enroll \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "citizen001",
    "role": "citizen",
    "org": "citizen"
  }'

# Test 2: Issue Property ID (CCLB only)
curl -X POST http://localhost:3000/api/cclb/issue-property-id \
  -H "Content-Type: application/json" \
  -d '{
    "stateCode": "TS",
    "userId": "admin"
  }'

# Test 3: Submit Land Application
curl -X POST http://localhost:3000/api/land/submit \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "APP-2026-TS-001",
    "docHash": "QmTestHash123",
    "userId": "citizen001",
    "org": "citizen"
  }'
```

**Expected Responses:**
```json
// Test 1
{"success":true,"userId":"citizen001","role":"citizen","org":"citizen"}

// Test 2
{"success":true,"propertyID":{"id":"CCLB-2026-TS-000001",...}}

// Test 3
{"success":true,"appId":"APP-2026-TS-001","status":"PENDING_VERIFICATION"}
```

---

## 🎯 COMPLETE WORKFLOW TEST

### End-to-End Transaction Flow

```bash
# 1. Citizen submits application
curl -X POST http://localhost:3000/api/land/submit \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "APP-001",
    "docHash": "QmHash1",
    "userId": "citizen001",
    "org": "citizen"
  }'

# 2. VRO verifies application
curl -X POST http://localhost:3000/api/land/verify \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "APP-001",
    "propertyId": "CCLB-2026-TS-000001",
    "status": "VERIFIED",
    "comments": "Documents validated",
    "documentHash": "QmHash2",
    "userId": "vro001"
  }'

# 3. MRO #1 approves
curl -X POST http://localhost:3000/api/land/approve \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "APP-001",
    "propertyId": "CCLB-2026-TS-000001",
    "status": "APPROVED",
    "comments": "Approved by MRO 1",
    "userId": "mro001"
  }'

# 4. MRO #2 approves (PBFT consensus reached)
curl -X POST http://localhost:3000/api/land/approve \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "APP-001",
    "propertyId": "CCLB-2026-TS-000001",
    "status": "APPROVED",
    "comments": "Approved by MRO 2",
    "userId": "mro002"
  }'

# 5. Query final status
curl http://localhost:3000/api/land/consensus/CCLB-2026-TS-000001?userId=admin&org=admin
```

**Final Consensus Response:**
```json
{
  "success": true,
  "consensus": {
    "status": "APPROVED",
    "currentApprovals": 2,
    "requiredApprovals": 2,
    "approversList": ["mro001", "mro002"],
    "finalizedAt": "2026-02-04T..."
  }
}
```

---

## 🛠️ TROUBLESHOOTING

### Network Not Starting

```bash
# Check Docker
docker info

# Restart Docker
sudo systemctl restart docker

# Clean and restart network
cd network/scripts
./setup-network.sh clean
./setup-network.sh
```

### Chaincode Installation Fails

```bash
# Check Go modules
cd chaincode/land-registry
go mod vendor

# Rebuild package
cd ../../network/scripts
rm -f *.tar.gz
./deploy-all-chaincode.sh
```

### Backend Can't Connect

```bash
# Check connection profiles exist
ls -la realestate2/backend/config/

# Check wallet directory
ls -la realestate2/backend/wallet/

# Verify network is running
docker ps | grep peer
```

### View Container Logs

```bash
# Orderer logs
docker logs orderer0.orderer.landregistry.local

# Peer logs
docker logs peer0.cclb.landregistry.local

# Chaincode logs
docker logs dev-peer0.ts.landregistry.local-landregistry-1.0

# All logs
docker-compose logs -f
```

---

## 📊 MONITORING

### Check Network Health

```bash
# Container status
docker-compose ps

# Disk usage
docker system df

# Network stats
docker stats
```

### Blockchain Metrics

```bash
# Block height
peer channel getinfo -c land-region-ts

# Chaincode list
peer lifecycle chaincode querycommitted -C land-region-ts

# Peer list
peer channel list
```

---

## 🔄 STOPPING & RESTARTING

### Stop Network

```bash
cd network
docker-compose down
```

### Restart Network (Without Losing Data)

```bash
cd network
docker-compose up -d
```

### Complete Teardown (Deletes All Data)

```bash
cd network
docker-compose down --volumes
rm -rf crypto-config channel-artifacts
```

---

## 📚 NEXT STEPS

After successful deployment:

1. **Review Architecture:** [PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md)
2. **API Documentation:** See API section in architecture doc
3. **Frontend Integration:** Connect React/Next.js frontend
4. **Production Hardening:** Review security checklist
5. **Monitoring Setup:** Configure Prometheus/Grafana
6. **Backup Strategy:** Implement ledger backup

---

## 🆘 SUPPORT

### Common Issues

| Issue | Solution |
|-------|----------|
| Port conflicts | Change ports in docker-compose.yaml |
| Permission denied | Run with sudo or add user to docker group |
| Out of disk space | Run `docker system prune -a` |
| Chaincode timeout | Increase `CORE_CHAINCODE_EXECUTETIMEOUT` |

### Get Help

- **Logs:** `docker-compose logs -f`
- **Documentation:** [Full Architecture Doc](./PRODUCTION_ARCHITECTURE.md)
- **Fabric Docs:** https://hyperledger-fabric.readthedocs.io/

---

## ✅ DEPLOYMENT CHECKLIST

- [ ] Docker installed and running
- [ ] Fabric binaries in PATH
- [ ] Network started successfully
- [ ] All channels created
- [ ] Chaincode deployed to all channels
- [ ] Backend API running
- [ ] Health check passes
- [ ] Test transaction successful
- [ ] End-to-end workflow tested
- [ ] Logs reviewed for errors

---

**🎉 Congratulations!**  
Your production-grade Land Registry Blockchain is now **LIVE** and ready for transactions!

**Total Deployment Time:** ~15 minutes  
**Status:** Production-Ready ✅

---

**Document Version:** 1.0.0  
**Last Updated:** February 4, 2026
