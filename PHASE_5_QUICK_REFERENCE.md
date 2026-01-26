# 🎯 Phase 5 Quick Reference - Federated Architecture

## 📍 Status: Backend Refactoring Complete ✅

---

## 🚀 Quick Start

```bash
# Start Backend (requires Fabric network running)
cd realestate2/backend
USE_FABRIC=true npm start

# Check health
curl http://localhost:4000/health
```

---

## 🏛️ Federated Endpoints (NEW)

### Request Property ID from CCLB
```bash
curl -X POST http://localhost:4000/national/property/request \
  -H "Content-Type: application/json" \
  -d '{"stateCode":"TS","owner":"John","district":"Hyd","mandal":"Rang","village":"Sham","surveyNo":"123-A","area":"5 acres","landType":"Agri"}'
```

### Query National Registry
```bash
curl http://localhost:4000/national/property/CCLB-2026-TS-000001
```

### Create State Record
```bash
curl -X POST http://localhost:4000/state/TS/property/create \
  -H "Content-Type: application/json" \
  -d '{"propertyID":"CCLB-2026-TS-000001","requestID":"REQ-001","ipfsCID":"QmXxx","owner":"John","district":"Hyd","mandal":"Rang","village":"Sham","surveyNo":"123-A"}'
```

### Query State Ledger
```bash
curl http://localhost:4000/state/TS/property/CCLB-2026-TS-000001
```

### Federated Query (Multi-Channel)
```bash
curl http://localhost:4000/property/CCLB-2026-TS-000001/federated
```

---

## 📋 Property ID Format

```
CCLB-2026-TS-000001
```
- Issued by Central Land Ledger Board
- Year 2026
- State code TS (Telangana)
- Sequence 000001

---

## 🔄 Workflow

```
1. POST /national/property/request
   → Get propertyID: CCLB-2026-TS-000001
   
2. POST /state/TS/property/create
   → Link CCLB ID to state record
   → Get confirmation
   
3. GET /property/CCLB-2026-TS-000001/federated
   → Query both national + state
   → See verification badge
```

---

## 📁 Key Files

| File | Status | Purpose |
|------|--------|---------|
| `realestate2/backend/server.js` | ✅ Updated | 7 new endpoints |
| `realestate2/backend/fabric_federated.js` | ✅ Ready | Multi-channel routing |
| `FEDERATED_API_GUIDE.md` | ✅ Created | API documentation |
| `FEDERATED_ARCHITECTURE.md` | ✅ Created | Design specification |

---

## ⚠️ Blockers

- [ ] CCLB chaincode IssuePropertyID (needs atomic sequence)
- [ ] Fabric multi-channel network (channels don't exist yet)
- [ ] Connection profiles (connection-cclb.yaml not generated)
- [ ] Frontend (not updated for new endpoints)

---

## 🆘 Common Issues

| Error | Fix |
|-------|-----|
| "Cannot find module fabric_federated" | File created in Phase 3, should exist |
| "Failed to query CCLB registry" | Chaincode not deployed yet (normal before Phase 7) |
| "Connection refused" | Start Fabric network first |
| "Identity not found" | Enroll registrar user with role attribute |

---

## 📊 Progress

✅ Phase 1-3: Complete  
⏳ Phase 4: 40% (Chaincode)  
✅ Phase 5: 100% (Backend - THIS PHASE)  
❌ Phase 6: Pending (Frontend)  

**Overall: 60% Complete**

---

## 📞 Documentation

- `FEDERATED_API_GUIDE.md` — Complete endpoint reference
- `PHASE_5_COMPLETION_SUMMARY.md` — Implementation details
- `PROJECT_STATUS_REPORT.md` — Full project status
- `PHASE_6_PREVIEW.md` — Frontend next steps

---

## ✨ What's New in Phase 5

✅ Backend completely refactored for multi-channel support
✅ 7 new federated endpoints implemented
✅ Multi-channel routing logic ready
✅ Error handling comprehensive
✅ API fully documented
✅ Backward compatible with existing endpoints

---

**Phase 5 Complete ✅**  
Next: Phase 6 (Frontend) or Phase 7 (Fabric Deployment)
