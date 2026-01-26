# 🏛️ Federated Government Ledger - API Guide

## Overview

The backend now supports a **federated architecture** with:
- **CCLB (Central Land Ledger Board)** on `cclb-global` channel
- **State Registries** on `state-<code>` channels (e.g., `state-TS`, `state-KA`)
- **Supabase** for fast citizen queries (unchanged)

---

## Architecture Flow

```
1. PROPERTY REQUEST (State Citizen)
   POST /state/:stateCode/property/request
   → RequestPropertyID on state-<code>
   → Stores draft, returns requestID
   → CCLB polls event to issue Property ID

2. PROPERTY ID ISSUANCE (CCLB Admin)
   POST /national/property/request
   → IssuePropertyID on cclb-global
   → Returns CCLB-YEAR-STATE-SEQUENCE format ID
   → Stores in national registry

3. STATE RECORD CREATION (State Registrar)
   POST /state/:stateCode/property/create
   → CreateStateRecord on state-<code>
   → Binds CCLB Property ID to state record
   → Stores authoritative record locally

4. CROSS-REGISTRY VERIFICATION (CCLB)
   GET /property/:propertyID/federated
   → Queries both cclb-global and state-<code>
   → Verifies record integrity
   → Returns combined view with verification badge
```

---

## Endpoints

### 🏛️ NATIONAL REGISTRY (CCLB)

#### POST /national/property/request
**Request a Property ID from CCLB**

```json
{
  "stateCode": "TS",
  "owner": "John Doe",
  "district": "Hyderabad",
  "mandal": "Rangareddy",
  "village": "Shameerpet",
  "surveyNo": "123-A",
  "area": "5 acres",
  "landType": "Agricultural"
}
```

**Response:**
```json
{
  "status": "success",
  "propertyID": "CCLB-2026-TS-000001",
  "stateCode": "TS",
  "message": "Property ID issued by CCLB. Use this ID to create state records."
}
```

---

#### GET /national/property/:propertyID
**Query Property ID from CCLB National Registry**

```
GET /national/property/CCLB-2026-TS-000001
```

**Response:**
```json
{
  "source": "CCLB National Registry",
  "propertyID": "CCLB-2026-TS-000001",
  "data": {
    "stateCode": "TS",
    "issuedAt": "2026-01-15T10:30:00Z",
    "issuer": "CCLB"
  },
  "verified": true
}
```

---

#### GET /national/properties
**List all properties in CCLB (National Index)**

```
GET /national/properties
```

**Response:**
```json
{
  "source": "CCLB National Registry",
  "totalRecords": 1250,
  "records": [
    {
      "propertyID": "CCLB-2026-TS-000001",
      "stateCode": "TS",
      "owner": "John Doe"
    },
    ...
  ]
}
```

---

### 🏢 STATE REGISTRIES

#### POST /state/:stateCode/property/create
**Create a Land Record on State Ledger (Federated)**

```json
{
  "propertyID": "CCLB-2026-TS-000001",
  "requestID": "REQ-2026-TS-000001",
  "ipfsCID": "QmXxxx...",
  "owner": "John Doe",
  "district": "Hyderabad",
  "mandal": "Rangareddy",
  "village": "Shameerpet",
  "surveyNo": "123-A"
}
```

**Response:**
```json
{
  "status": "success",
  "propertyID": "CCLB-2026-TS-000001",
  "channel": "state-TS",
  "transactionID": "tx123...",
  "message": "Land record created on state ledger (state-TS)"
}
```

---

#### GET /state/:stateCode/property/:propertyID
**Query Land Record from State Ledger**

```
GET /state/TS/property/CCLB-2026-TS-000001
```

**Response:**
```json
{
  "source": "State Registry (state-TS)",
  "propertyID": "CCLB-2026-TS-000001",
  "stateCode": "TS",
  "record": {
    "owner": "John Doe",
    "district": "Hyderabad",
    "surveyNo": "123-A",
    "area": "5 acres",
    "VerifiedByCCLB": true,
    "CCLBVerifyTx": "tx456..."
  },
  "cclfVerification": {
    "verified": true,
    "verifiedAt": "2026-01-15T10:35:00Z"
  },
  "verified": true
}
```

---

#### GET /state/:stateCode/properties
**List all properties on State Ledger**

```
GET /state/TS/properties
```

**Response:**
```json
{
  "source": "State Registry (state-TS)",
  "stateCode": "TS",
  "totalRecords": 450,
  "records": [
    {
      "propertyID": "CCLB-2026-TS-000001",
      "owner": "John Doe",
      "district": "Hyderabad"
    },
    ...
  ]
}
```

---

### 🔗 CROSS-REGISTRY QUERIES

#### GET /property/:propertyID/federated
**Multi-Channel Query: CCLB + State Registry**

```
GET /property/CCLB-2026-TS-000001/federated
```

**Response:**
```json
{
  "propertyID": "CCLB-2026-TS-000001",
  "stateCode": "TS",
  "nationalRegistry": {
    "propertyID": "CCLB-2026-TS-000001",
    "stateCode": "TS",
    "issuedAt": "2026-01-15T10:30:00Z"
  },
  "stateRegistry": {
    "propertyID": "CCLB-2026-TS-000001",
    "owner": "John Doe",
    "district": "Hyderabad",
    "VerifiedByCCLB": true
  },
  "verified": true,
  "architecture": "federated",
  "channels": ["cclb-global", "state-TS"]
}
```

---

### ☁️ CITIZEN QUERIES (Supabase - Unchanged)

#### POST /land/query-by-survey
**Query by Survey Details**

```json
{
  "district": "Hyderabad",
  "mandal": "Rangareddy",
  "village": "Shameerpet",
  "surveyNo": "123-A"
}
```

---

#### POST /land/query-by-id
**Query by Property ID**

```json
{
  "propertyId": "LRI-IND-TS-2026-000001"
}
```

---

#### GET /land/all
**List all properties**

---

### 🏥 Health Check

#### GET /health
**Check system status**

**Response:**
```json
{
  "ok": true,
  "source": "Supabase + Fabric",
  "database": "connected",
  "fabric": "connected",
  "architecture": "federated"
}
```

---

## Error Codes

| HTTP Code | Meaning | Cause |
|-----------|---------|-------|
| 200 | Success | Operation completed |
| 400 | Bad Request | Missing required parameter |
| 404 | Not Found | Property ID not found in registry |
| 500 | Server Error | Fabric network or database error |

---

## Key Design Principles

### ✅ CCLB Issues Property IDs Only
- States cannot generate Property IDs independently
- CCLB maintains national index on `cclb-global`
- Ensures globally unique identifiers

### ✅ Multi-Channel Enforcement
- State records stored on state-specific channels
- CCLB verifies cross-channel before marking `VerifiedByCCLB=true`
- No centralized database required

### ✅ Event-Driven Verification
- State record creation triggers StateRecordCreatedEvent
- CCLB polls and verifies asynchronously
- Prevents tight coupling between channels

### ✅ Backward Compatible Citizen View
- Supabase queries unchanged (fast, indexed)
- New Fabric endpoints for ledger access
- Citizens can use either interface

---

## Migration from Old System

### Old Endpoints (Still Supported)
```
POST /land/query-by-survey
POST /land/query-by-id
GET /land/all
```

### New Federated Endpoints
```
POST /national/property/request          # Issue Property ID
GET  /national/property/:propertyID      # Query National Registry
GET  /state/:stateCode/property/:id      # Query State Registry
GET  /property/:propertyID/federated     # Cross-channel verification
```

---

## Testing Workflow

### 1. Request Property ID (CCLB)
```bash
curl -X POST http://localhost:4000/national/property/request \
  -H "Content-Type: application/json" \
  -d '{
    "stateCode": "TS",
    "owner": "Test User",
    "district": "Hyderabad",
    "mandal": "Rangareddy",
    "village": "Test",
    "surveyNo": "TEST-001",
    "area": "1 acre",
    "landType": "Residential"
  }'
```

### 2. Get Property ID
```bash
curl -X GET http://localhost:4000/national/property/CCLB-2026-TS-000001
```

### 3. Create State Record
```bash
curl -X POST http://localhost:4000/state/TS/property/create \
  -H "Content-Type: application/json" \
  -d '{
    "propertyID": "CCLB-2026-TS-000001",
    "requestID": "REQ-2026-TS-000001",
    "ipfsCID": "QmTest...",
    "owner": "Test User",
    "district": "Hyderabad",
    "mandal": "Rangareddy",
    "village": "Test",
    "surveyNo": "TEST-001"
  }'
```

### 4. Query State Record
```bash
curl -X GET http://localhost:4000/state/TS/property/CCLB-2026-TS-000001
```

### 5. Federated Query (Multi-Channel)
```bash
curl -X GET http://localhost:4000/property/CCLB-2026-TS-000001/federated
```

---

## Environment Setup

Requires `fabric_federated.js` helpers:
- `getContract(identity, scope, orgName)` - Generic multi-channel contract
- `getCCLBContract(identity)` - CCLB shortcut
- `getStateContract(stateCode, identity)` - State shortcut

Connection profiles:
- `config/connection-org1.yaml` - Org1 (default Telangana)
- `config/connection-org2.yaml` - Org2 (Karnataka)
- `config/connection-cclb.yaml` - CCLB (new)

Wallet identities required:
- `wallet/registrar` - Can submit transactions (role=registrar:ecert)
- `wallet/admin` - Admin operations

---

## Next Steps

1. **Deploy channels** on Fabric network:
   - Create `cclb-global` channel
   - Create state-specific channels (`state-TS`, `state-KA`, etc.)

2. **Deploy chaincodes**:
   - Deploy `cclb-registry` on `cclb-global`
   - Deploy `land-registry` (state mode) on state-<code> channels

3. **Enroll identities**:
   - CCLB admin and registrar users
   - State registrars for each state org

4. **Configure connection profiles**:
   - Generate organization-specific CCPs
   - Update `ccpMap` in `fabric_federated.js`

5. **Update frontend**:
   - Add registry scope selector (National vs. State)
   - Display CCLB verification badge
   - Implement multi-state search

---

## Support

For architecture details, see `FEDERATED_ARCHITECTURE.md`
For chaincode implementation, see `chaincode/cclb-registry/` and `chaincode/land-registry/`
