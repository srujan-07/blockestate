# 🚀 Deployment Guide: Federated Government Ledger

**Status:** Phase 5 Complete - Ready for Phase 6-8 Deployment  
**Date:** January 26, 2026  
**Target:** Production deployment

---

## 📍 Current Deployment Status

| Component | Status | Mode | Port |
|-----------|--------|------|------|
| **Frontend** | ✅ Ready | React (land-registry-frontend) | 3000 |
| **Backend** | ✅ Running | Node.js/Express | 4000 |
| **Database** | ✅ Connected | Supabase (PostgreSQL) | Cloud |
| **Blockchain** | ⏳ Single-Channel | Hyperledger Fabric (mychannel) | Docker |
| **Chaincode** | ⏳ Partial | Go (land-registry v1.3) | Deployed |

---

## 🎯 What Works NOW (Phase 5 Complete)

### ✅ Citizen Query Layer (Supabase)
```bash
# Query by survey details
POST /land/query-by-survey
{
  "district": "Hyderabad",
  "mandal": "Rangareddy",
  "village": "Shameerpet",
  "surveyNo": "123-A"
}

# Query by property ID
POST /land/query-by-id
{ "propertyId": "LRI-IND-TS-2026-000001" }

# List all properties
GET /land/all
```

### ✅ Sample Data Loaded
- 3 properties in Supabase
- 3 properties on Fabric blockchain (mychannel)
- Full audit trail available

### ✅ Frontend Operational
- Land search interface
- Record display
- Supabase integration

### ✅ Backend Server
- Running on port 4000
- Hybrid architecture (Supabase + single-channel Fabric)
- Error handling comprehensive
- Health check available

---

## ⏳ What Requires Phase 6-8

### Phase 6: Frontend Modifications
- [ ] Add registry scope selector (National vs. State)
- [ ] Display CCLB verification badges
- [ ] Multi-state property search
- [ ] Update API integration for federated endpoints

### Phase 7: Fabric Multi-Channel Deployment
- [ ] Create `cclb-global` channel
- [ ] Create `state-TS`, `state-KA` channels
- [ ] Deploy CCLB chaincode
- [ ] Deploy state chaincodes
- [ ] Enroll CCLB organization
- [ ] Generate connection profiles

### Phase 8: Integration Testing
- [ ] End-to-end workflow testing
- [ ] Cross-channel verification testing
- [ ] Error scenario testing
- [ ] Performance testing

---

## 🚀 Deploy Current State

### 1. **Start Fabric Network** (if not running)

```powershell
cd "C:\Users\sruja\OneDrive\Desktop\Project\fabric-samples\test-network"

# Start network
./network.sh up createChannel -c mychannel

# Deploy chaincode
./network.sh deployCC -ccn landregistry -ccv 1.3 \
  -ccp ../../chaincode/land-registry -ccl go
```

### 2. **Load Sample Data**

```powershell
cd "C:\Users\sruja\OneDrive\Desktop\Project\realestate2\backend"

# Set registrar identity
$env:IDENTITY="registrar"

# Load sample data
node addSampleData.js
```

### 3. **Start Backend Server**

```powershell
cd "C:\Users\sruja\OneDrive\Desktop\Project\realestate2\backend"

# Set Fabric mode
$env:USE_FABRIC="true"

# Start server
npm start
# Or: node server.js
```

**Expected Output:**
```
✅ Backend running on port 4000
📊 Architecture: 🏛️  HYBRID (Supabase + Fabric Single-Channel)
🔍 ACTIVE ENDPOINTS:
   - POST /land/query-by-survey
   - POST /land/query-by-id
   - GET /land/all
```

### 4. **Start Frontend Server**

```powershell
cd "C:\Users\sruja\OneDrive\Desktop\Project\land-registry-frontend"

# Install dependencies (if needed)
npm install

# Start frontend
npm start
```

**Expected Output:**
```
Compiled successfully!

You can now view the frontend in the browser.
Local: http://localhost:3000
```

### 5. **Test System**

```powershell
# Check backend health
curl http://localhost:4000/health

# Expected response:
# {
#   "ok": true,
#   "source": "Supabase + Fabric",
#   "database": "connected",
#   "fabric": "single-channel (mychannel)",
#   "architecture": "hybrid"
# }

# Test citizen query
curl -X POST http://localhost:4000/land/query-by-survey `
  -H "Content-Type: application/json" `
  -d '{"district":"Hyderabad","mandal":"Rangareddy","village":"Shameerpet","surveyNo":"123-A"}'
```

---

## 📊 System Architecture (Current)

```
┌─────────────────────────────────────────┐
│   FRONTEND (React)                       │
│   http://localhost:3000                  │
│   - Land search                          │
│   - Record display                       │
│   - Supabase integration                 │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│   BACKEND (Node.js/Express)             │
│   http://localhost:4000                  │
│   - Citizen query routes                 │
│   - Supabase adapter                     │
│   - Fabric integration                   │
└────────────────────┬────────────────────┘
                     │
        ┌────────────┴──────────┐
        │                       │
┌───────▼──────────┐   ┌──────▼─────────┐
│   Supabase       │   │  Fabric Network │
│   (PostgreSQL)   │   │  (Hyperledger)  │
│                  │   │                 │
│   - Fast queries │   │  - mychannel    │
│   - Citizen data │   │  - landregistry │
└──────────────────┘   │    v1.3         │
                       └─────────────────┘
```

---

## 🔄 Deployment Workflow

### Step 1: Infrastructure Check
```bash
# Verify Docker running
docker --version

# Verify Node.js
node --version
npm --version

# Verify Python (for scripts)
python --version
```

### Step 2: Fabric Network
```bash
cd fabric-samples/test-network
./network.sh up createChannel -c mychannel
./network.sh deployCC -ccn landregistry -ccv 1.3 -ccp ../../chaincode/land-registry -ccl go
```

### Step 3: Backend
```bash
cd realestate2/backend
npm install
$env:USE_FABRIC="true"
node server.js
# Open new terminal for next step
```

### Step 4: Sample Data
```bash
cd realestate2/backend
$env:IDENTITY="registrar"
node addSampleData.js
```

### Step 5: Frontend
```bash
cd land-registry-frontend
npm install
npm start
# Open http://localhost:3000
```

### Step 6: Verify
```bash
# In browser or curl
http://localhost:3000  # Frontend
http://localhost:4000/health  # Backend health
```

---

## ✅ Verification Checklist

- [ ] Docker containers running (Fabric network)
  ```powershell
  docker ps | grep -E "(peer|orderer|ca)"
  ```

- [ ] Backend started successfully
  ```powershell
  curl http://localhost:4000/health
  # Should return: { "ok": true, "database": "connected" }
  ```

- [ ] Frontend accessible
  ```
  http://localhost:3000
  # Should show land search interface
  ```

- [ ] Sample data loaded
  ```powershell
  curl -X POST http://localhost:4000/land/query-by-id `
    -H "Content-Type: application/json" `
    -d '{"propertyId":"LRI-IND-TS-2026-000001"}'
  # Should return property details
  ```

- [ ] Queries working
  ```powershell
  # Citizen query
  curl -X POST http://localhost:4000/land/query-by-survey `
    -H "Content-Type: application/json" `
    -d '{
      "district":"Hyderabad",
      "mandal":"Rangareddy",
      "village":"Shameerpet",
      "surveyNo":"123-A"
    }'
  # Should return matching properties
  ```

---

## 🚨 Troubleshooting

### Backend Won't Start

**Error:** `Cannot find module 'fabric_federated'`
- **Cause:** Server trying to load federated code (Phase 7 only)
- **Fix:** Already corrected - server now uses single-channel `fabric.js`

**Error:** `Connection refused`
- **Cause:** Fabric network not running
- **Fix:** 
  ```powershell
  cd fabric-samples/test-network
  ./network.sh up createChannel -c mychannel
  ```

**Error:** `Identity registrar not found in wallet`
- **Cause:** Identities not enrolled
- **Fix:**
  ```powershell
  cd realestate2/backend
  node addAdminToWallet.js
  node addUserToWallet.js registrar1 registrar
  ```

### Frontend Won't Connect

**Error:** `Failed to connect to backend`
- **Cause:** Backend not running or CORS issue
- **Fix:**
  ```powershell
  # Check backend is running
  curl http://localhost:4000/health
  # Check CORS is enabled (it is by default)
  ```

**Error:** `API call failed`
- **Cause:** Supabase not connected
- **Fix:** Check `db.js` connection string

### No Data Showing

**Error:** `Property not found`
- **Cause:** Sample data not loaded
- **Fix:**
  ```powershell
  cd realestate2/backend
  $env:IDENTITY="registrar"
  node addSampleData.js
  ```

---

## 📈 Performance Monitoring

### Check Fabric Network Health
```powershell
# List running containers
docker ps

# Check logs
docker logs <container-id>

# Check peer status
docker exec peer0.org1.example.com peer channel list
```

### Check Backend Performance
```powershell
# Monitor server logs
# Terminal running backend shows all requests
```

### Check Database Connection
```powershell
# Supabase status dashboard
# https://supabase.com/dashboard
```

---

## 🔐 Security Notes (Current Deployment)

✅ **Implemented:**
- Role-based access control (registrar role)
- Identity-based chaincode execution
- Input validation on all endpoints
- CORS enabled for frontend

⚠️ **For Production:**
- [ ] Enable HTTPS/TLS
- [ ] Add authentication layer (JWT)
- [ ] Restrict CORS to specific origins
- [ ] Enable database encryption
- [ ] Set up audit logging
- [ ] Configure firewall rules
- [ ] Regular backups

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] System requirements met (Docker, Node.js, Python)
- [ ] Fabric network running
- [ ] Sample data loaded
- [ ] Backend and frontend tested

### Deployment
- [ ] Fabric network started
- [ ] Backend server running on port 4000
- [ ] Frontend running on port 3000
- [ ] All endpoints responding

### Post-Deployment
- [ ] Health check passed
- [ ] Sample queries working
- [ ] Frontend accessible
- [ ] Logs monitored

---

## 🎯 Next Steps (Phase 6-8)

### Immediate (Phase 6: Frontend)
1. Examine current frontend components
2. Add registry scope selector
3. Update API calls to new endpoints
4. Add verification badge display

### Short-term (Phase 7: Fabric Deployment)
1. Create multi-channel network (cclb-global, state-*)
2. Deploy CCLB and state chaincodes
3. Enroll additional identities
4. Generate connection profiles

### Medium-term (Phase 8: Testing)
1. End-to-end workflow testing
2. Cross-channel verification testing
3. Performance testing
4. Security audit

---

## 📞 Support Resources

**Documentation:**
- [FEDERATED_ARCHITECTURE.md](../FEDERATED_ARCHITECTURE.md) — System design
- [FEDERATED_API_GUIDE.md](../FEDERATED_API_GUIDE.md) — API reference
- [PROJECT_STATUS_REPORT.md](../PROJECT_STATUS_REPORT.md) — Project status
- [DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md) — Documentation hub

**Code References:**
- `realestate2/backend/server.js` — Backend implementation
- `realestate2/backend/fabric.js` — Fabric integration
- `land-registry-frontend/` — Frontend code

**Logs:**
- Backend terminal: All requests and errors
- Fabric network: Check with `docker logs <container>`
- Frontend console: Browser DevTools

---

## ✅ Current Deployment Status

**System Status: OPERATIONAL ✅**

- ✅ Backend running on port 4000
- ✅ Frontend running on port 3000
- ✅ Single-channel Fabric network operational
- ✅ Sample data loaded and searchable
- ✅ Citizen queries working
- ✅ Hybrid architecture stable

**Next Milestone: Phase 6 (Frontend Modifications)**

---

## 🚀 Quick Deploy Commands

```powershell
# All-in-one quick deploy:

# Terminal 1: Start Fabric
cd fabric-samples\test-network
.\network.sh up createChannel -c mychannel
.\network.sh deployCC -ccn landregistry -ccv 1.3 -ccp ..\..\chaincode\land-registry -ccl go

# Terminal 2: Load Data
cd realestate2\backend
$env:IDENTITY="registrar"
node addSampleData.js

# Terminal 3: Backend
cd realestate2\backend
$env:USE_FABRIC="true"
npm start

# Terminal 4: Frontend
cd land-registry-frontend
npm start

# Terminal 5: Test
curl http://localhost:4000/health
# Visit http://localhost:3000 in browser
```

---

**Deployment Complete** ✅

The Federated Government Ledger is now operational in Phase 5 configuration (single-channel hybrid mode). Ready to proceed to Phase 6 (frontend modifications) or Phase 7 (multi-channel deployment).
