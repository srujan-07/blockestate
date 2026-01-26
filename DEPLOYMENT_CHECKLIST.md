# ✅ Deployment Checklist & Quick Start

## 🚀 30-Second Quick Start

```powershell
# Terminal 1: Fabric Network (WSL/Bash)
cd fabric-samples/test-network
./network.sh up createChannel -c mychannel
./network.sh deployCC -ccn landregistry -ccv 1.3 -ccp ../../chaincode/land-registry -ccl go

# Terminal 2: Backend
cd realestate2/backend
$env:IDENTITY="registrar"
node addSampleData.js
# Then in same terminal:
$env:USE_FABRIC="true"
npm start

# Terminal 3: Frontend
cd land-registry-frontend
npm start

# Browser: http://localhost:3000
```

---

## 📋 Pre-Deployment Checklist

### System Requirements
- [ ] Docker Desktop running
- [ ] WSL2 / Git Bash available (for Fabric network)
- [ ] Node.js v22+ installed
- [ ] npm installed
- [ ] Python installed (for Fabric scripts)

### Code Requirements
- [ ] Backend refactored ✅ (DONE)
- [ ] Frontend code present ✅ (DONE)
- [ ] Fabric network scripts present ✅ (DONE)
- [ ] Chaincode present ✅ (DONE)

### Database Requirements
- [ ] Supabase credentials configured ✅ (in db.js)
- [ ] Connection string valid ✅ (from Phase 1)
- [ ] Schema exists ✅ (from Phase 1)

---

## 🔄 Deployment Steps

### Step 1: Start Fabric Network (5 min)
```powershell
cd "C:\Users\sruja\OneDrive\Desktop\Project\fabric-samples\test-network"
./network.sh up createChannel -c mychannel
./network.sh deployCC -ccn landregistry -ccv 1.3 `
  -ccp ../../chaincode/land-registry -ccl go
```
✅ **Expected:** Network running, chaincode deployed

### Step 2: Enroll Identities (2 min)
```powershell
cd "C:\Users\sruja\OneDrive\Desktop\Project\realestate2\backend"
node addAdminToWallet.js
node addUserToWallet.js registrar1 registrar
```
✅ **Expected:** Identities in wallet/

### Step 3: Load Sample Data (1 min)
```powershell
cd "C:\Users\sruja\OneDrive\Desktop\Project\realestate2\backend"
$env:IDENTITY="registrar"
node addSampleData.js
```
✅ **Expected:** 3 properties loaded

### Step 4: Start Backend (30 sec)
```powershell
cd "C:\Users\sruja\OneDrive\Desktop\Project\realestate2\backend"
$env:USE_FABRIC="true"
npm start
```
✅ **Expected:** Server running on port 4000

### Step 5: Start Frontend (1 min)
```powershell
cd "C:\Users\sruja\OneDrive\Desktop\Project\land-registry-frontend"
npm install  # if needed
npm start
```
✅ **Expected:** Frontend on port 3000

### Step 6: Verify System (1 min)
```powershell
# Test backend health
curl http://localhost:4000/health

# Test query
curl -X POST http://localhost:4000/land/query-by-id `
  -H "Content-Type: application/json" `
  -d '{"propertyId":"LRI-IND-TS-2026-000001"}'

# Open frontend
Start-Process "http://localhost:3000"
```
✅ **Expected:** All working

---

## 🔍 Verification Checklist

### Fabric Network
- [ ] Containers running: `docker ps | grep -E "(peer|orderer)"`
- [ ] Channel exists: `./network.sh status`
- [ ] Chaincode deployed: `docker logs peer0.org1.example.com`

### Database
- [ ] Supabase connected: `curl http://localhost:4000/health`
- [ ] Sample data exists: Check in Supabase dashboard

### Backend
- [ ] Server starts: `npm start` shows no errors
- [ ] Port 4000: `curl http://localhost:4000/health` returns JSON
- [ ] Queries work: Test endpoints with curl

### Frontend
- [ ] Server starts: `npm start` shows compiled successfully
- [ ] Port 3000: Browser shows land search interface
- [ ] API connects: Search returns results

---

## 📊 System Status Points

| Component | Check | Expected |
|-----------|-------|----------|
| **Fabric** | `docker ps` | 5+ containers running |
| **Network** | `peer channel list` | mychannel present |
| **Chaincode** | `docker logs` | landregistry deployed |
| **Database** | POST /health | `"database": "connected"` |
| **Backend** | http://localhost:4000 | Server responds |
| **Frontend** | http://localhost:3000 | React app loads |

---

## ✅ Full Verification

```powershell
# 1. Check Fabric
docker ps

# 2. Check backend health
curl http://localhost:4000/health

# 3. Test sample data
curl -X POST http://localhost:4000/land/query-by-survey `
  -H "Content-Type: application/json" `
  -d '{
    "district":"Hyderabad",
    "mandal":"Rangareddy",
    "village":"Shameerpet",
    "surveyNo":"123-A"
  }'

# 4. Check frontend
Start-Process "http://localhost:3000"

# 5. Try search
# Enter same data as curl above, should see results
```

---

## 🚨 Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| `network.sh: command not found` | Use WSL/Git Bash, not PowerShell for Fabric |
| `Connection refused on 4000` | Start backend: `npm start` |
| `Cannot find module` | Run `npm install` in that directory |
| `Identity not found` | Run `node addAdminToWallet.js` first |
| `No data showing` | Run `node addSampleData.js` |
| `Port 3000 in use` | Kill process: `npx kill-port 3000` |
| `Port 4000 in use` | Kill process: `npx kill-port 4000` |

---

## 📈 After Deployment

### Monitor Logs
- **Backend:** Check running terminal for requests
- **Fabric:** `docker logs <container-id>`
- **Frontend:** Browser console (F12)

### Test Coverage
- ✅ Citizen queries (Supabase)
- ✅ Single-channel blockchain (Fabric)
- ✅ Hybrid architecture
- ⏳ Federated endpoints (Phase 7)

### Performance Baseline
- Query response: < 500ms
- Blockchain operations: < 2s
- Frontend load: < 3s

---

## 🎯 What's Working

✅ Land search (by survey)  
✅ Property lookup (by ID)  
✅ List all properties  
✅ Blockchain recording  
✅ Audit trail  
✅ Hybrid queries  

---

## ⏳ What's Not Yet Available

❌ Multi-channel CCLB  
❌ State-specific registries  
❌ Registry scope selector  
❌ Cross-channel verification  
❌ Federated workflows  

(Available in Phase 7 deployment)

---

## 📝 Deployment Record

**Date:** January 26, 2026  
**Status:** READY FOR DEPLOYMENT ✅  
**Mode:** Single-Channel Hybrid (Phase 5)  
**Next:** Phase 6-8 (Multi-Channel Federated)

---

**Ready to deploy?** Follow the 30-second quick start above! 🚀
