# PRODUCTION-GRADE LAND REGISTRY BLOCKCHAIN SYSTEM
## Complete Architecture & Deployment Documentation

---

## 📋 TABLE OF CONTENTS

1. [System Overview](#system-overview)
2. [Network Architecture](#network-architecture)
3. [Organizations & Roles](#organizations--roles)
4. [Channel Strategy](#channel-strategy)
5. [Smart Contract Design](#smart-contract-design)
6. [PBFT Consensus Implementation](#pbft-consensus-implementation)
7. [Security Model](#security-model)
8. [API Documentation](#api-documentation)
9. [Deployment Guide](#deployment-guide)
10. [Testing & Validation](#testing--validation)

---

## 🎯 SYSTEM OVERVIEW

### Purpose
A production-grade blockchain-based land registration system built on **Hyperledger Fabric** that provides:
- **Immutable** land ownership records
- **PBFT-style consensus** for multi-party approvals
- **Role-based access control** using Fabric MSP
- **Regional isolation** with centralized indexing
- **Complete audit trail** for all transactions

### Key Features
✅ Custom Hyperledger Fabric network (not test-network)  
✅ Multi-organization setup (8 organizations)  
✅ Regional channels + CCLB global registry  
✅ VRO verification + MRO approval workflow  
✅ PBFT-style consensus at application layer  
✅ Ownership transfer with full history  
✅ Production-ready deployment scripts  
✅ Complete backend API with Fabric SDK

---

## 🏗️ NETWORK ARCHITECTURE

### Network Components

```
┌──────────────────────────────────────────────────────────────┐
│                    ORDERER SERVICE (Raft)                    │
│              orderer0.orderer.landregistry.local             │
└──────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
        ┌───────▼─────────┐        ┌───────▼─────────┐
        │  CCLB GLOBAL    │        │ REGIONAL        │
        │    CHANNEL      │        │  CHANNELS       │
        │                 │        │                 │
        │ - Property ID   │        │ - Land Records  │
        │   Registry      │        │ - Applications  │
        │ - State Mapping │        │ - Verifications │
        └─────────────────┘        │ - Approvals     │
                                   └─────────────────┘
```

### Organizations

| Organization | MSP ID | Role | Peers | Purpose |
|-------------|--------|------|-------|---------|
| **CCLB** | CCLEBMSP | Root Authority | 1 | Property ID issuance, verification |
| **StateOrgTS** | StateOrgTSMSP | State Authority (Telangana) | 1 | State-level land management |
| **StateOrgKA** | StateOrgKAMSP | State Authority (Karnataka) | 1 | State-level land management |
| **StateOrgAP** | StateOrgAPMSP | State Authority (AP) | 1 | State-level land management |
| **VROOrg** | VROOrgMSP | Verification Authority | 1 | Land record verification |
| **MROOrg** | MROOrgMSP | Approval Authority | 2 | Multi-party approvals (PBFT) |
| **AdminOrg** | AdminOrgMSP | System Administration | 1 | Network management |
| **CitizenOrg** | CitizenOrgMSP | Citizen Services | 1 | Application submission |

### Peer Ports

```
CCLB:      peer0.cclb.landregistry.local:7051
StateTS:   peer0.ts.landregistry.local:7051
StateKA:   peer0.ka.landregistry.local:8051
StateAP:   peer0.ap.landregistry.local:9051
VRO:       peer0.vro.landregistry.local:10051
MRO:       peer0.mro.landregistry.local:11051
Admin:     peer0.admin.landregistry.local:12051
Citizen:   peer0.citizen.landregistry.local:13051
```

---

## 🔐 ORGANIZATIONS & ROLES

### CCLB (Central Common Land Base)
**Responsibilities:**
- Issue unique Property IDs across all states
- Maintain national property registry
- Verify state records
- Cross-state coordination

**Permissions:**
- **Write:** Property ID issuance on `cclb-global`
- **Read:** All channels
- **Endorse:** Property creation transactions

### State Organizations (TS, KA, AP)
**Responsibilities:**
- Manage land records within their region
- Interface with regional officials (VRO, MRO)
- Maintain state-specific land data

**Permissions:**
- **Write:** Own regional channel
- **Read:** CCLB global channel, own regional channel
- **Endorse:** Land record transactions in their region

### VRO (Village Revenue Officer)
**Responsibilities:**
- Verify land applications
- Validate documents and surveys
- Approve/reject verification requests

**Permissions:**
- **Write:** Verification records on regional channels
- **Read:** Applications, land records
- **Invoke:** `VerifyLandByVRO`

### MRO (Mandal Revenue Officer)
**Responsibilities:**
- Multi-party approval using PBFT consensus
- Final approval after VRO verification
- Ownership transfer authorization

**Permissions:**
- **Write:** Approval records on regional channels
- **Read:** Verification records, applications
- **Invoke:** `ApproveLandByMRO`, `ApproveOwnershipTransfer`
- **Consensus:** Requires 2/3 MRO approval (PBFT)

### Admin Organization
**Responsibilities:**
- Network maintenance
- Emergency operations
- Audit log access

### Citizen Organization
**Responsibilities:**
- Submit land applications
- Initiate ownership transfers (with authorization)

---

## 📡 CHANNEL STRATEGY

### Channel Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CCLB GLOBAL CHANNEL                     │
│   cclb-global (Property ID Registry - Cross-State Index)    │
│                                                             │
│   Organizations: CCLB, StateOrgTS, StateOrgKA, StateOrgAP  │
│   Chaincode: cclb-registry                                  │
│   Purpose: Issue & verify Property IDs                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              REGIONAL CHANNEL - TELANGANA (TS)              │
│              land-region-ts (State-Specific Data)           │
│                                                             │
│   Organizations: CCLB, StateOrgTS, VRO, MRO, Admin, Citizen│
│   Chaincode: landregistry                                   │
│   Purpose: Telangana land records & workflows               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              REGIONAL CHANNEL - KARNATAKA (KA)              │
│              land-region-ka (State-Specific Data)           │
│                                                             │
│   Organizations: CCLB, StateOrgKA, VRO, MRO, Admin, Citizen│
│   Chaincode: landregistry                                   │
│   Purpose: Karnataka land records & workflows               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│           REGIONAL CHANNEL - ANDHRA PRADESH (AP)            │
│              land-region-ap (State-Specific Data)           │
│                                                             │
│   Organizations: CCLB, StateOrgAP, VRO, MRO, Admin, Citizen│
│   Chaincode: landregistry                                   │
│   Purpose: Andhra Pradesh land records & workflows          │
└─────────────────────────────────────────────────────────────┘
```

### Channel Policies

#### CCLB Global Channel
- **Readers:** Any member
- **Writers:** CCLB, AdminOrg only
- **Endorsement:** AND('CCLEBMSP.peer')
- **Consensus:** Solo CCLB authority

#### Regional Channels
- **Readers:** All channel members
- **Writers:** All channel members
- **Endorsement:** OR(State, VRO, MRO peers)
- **Consensus:** Application-layer PBFT for MRO approvals

---

## 📜 SMART CONTRACT DESIGN

### Chaincode: `landregistry` (Regional Channels)

#### Core Data Structures

```go
type LandRecord struct {
    PropertyID     string
    StateCode      string
    Owner          string
    SurveyNo       string
    District       string
    Mandal         string
    Village        string
    Area           string
    LandType       string
    MarketValue    string
    LastUpdated    string
    IPFSCID        string
    VerifiedByCCLB bool
    CCLBVerifyTx   string
}

type VerificationRecord struct {
    AppID        string
    PropertyID   string
    VerifiedBy   string
    VerifierMSP  string
    Status       string
    Comments     string
    VerifiedAt   string
    DocumentHash string
    TxID         string
}

type ApprovalRecord struct {
    PropertyID     string
    AppID          string
    ApprovedBy     string
    ApproverMSP    string
    Status         string
    ApprovedAt     string
    ApprovalNumber int
}

type ConsensusStatus struct {
    PropertyID        string
    AppID             string
    RequiredApprovals int
    CurrentApprovals  int
    ApproversList     []string
    Status            string
    FinalizedAt       string
}

type OwnershipHistory struct {
    PropertyID     string
    TransferID     string
    FromOwner      string
    ToOwner        string
    TransferType   string
    TransferDate   string
    DocumentHash   string
    Status         string
    ApprovedBy     []string
    CompletedAt    string
}
```

#### Functions

**Citizen Functions:**
- `SubmitLandApplication(appId, docHash)` → Submit new application

**VRO Functions:**
- `VerifyLandByVRO(appId, propertyId, status, comments, docHash)` → Verify application
- `VerifyOwnershipTransfer(transferId, verified, comments)` → Verify transfer

**MRO Functions:**
- `ApproveLandByMRO(appId, propertyId, status, comments)` → Approve with consensus
- `ApproveOwnershipTransfer(transferId)` → Approve transfer with consensus
- `GetConsensusStatus(propertyId)` → Check PBFT consensus status

**State/CCLB Functions:**
- `CreateProperty(propertyId, owner, surveyNo, ...)` → Create land record
- `TransferOwnership(propertyId, newOwner, transferType, ...)` → Initiate transfer

**Query Functions:**
- `ReadLandRecord(propertyId)` → Get land details
- `GetOwnershipHistory(propertyId)` → Get transfer history
- `GetVerificationHistory(appId)` → Get verification records
- `GetApprovalHistory(propertyId)` → Get approval records

### Chaincode: `cclb-registry` (CCLB Global Channel)

#### Core Data Structures

```go
type PropertyID struct {
    ID              string // Format: CCLB-2026-TS-000001
    StateCode       string
    SubmittedBy     string
    CreatedAt       string
    VerificationSig string
    TxID            string
}

type StateRegistry struct {
    StateCode      string
    StateName      string
    OrgMSPID       string
    StateChannelID string
    InitializedAt  string
    RegisteredBy   string
}
```

#### Functions

**CCLB Functions:**
- `IssuePropertyID(stateCode)` → Issue unique Property ID
- `RegisterState(stateCode, stateName, orgMSPID, channelID)` → Register state

**Query Functions:**
- `QueryPropertyID(propertyId)` → Verify Property ID
- `QueryStateRegistry(stateCode)` → Get state info
- `VerifyStateRecord(propertyId, stateCode)` → Cross-verify

---

## ⚖️ PBFT CONSENSUS IMPLEMENTATION

### Business-Layer Consensus (Not Fabric Ordering)

Hyperledger Fabric uses **Raft** for ordering, but our **MRO approvals** require **business-layer consensus** using PBFT principles.

### PBFT Algorithm

```
Number of MROs: n = 3
Byzantine Fault Tolerance: f = (n-1)/3 = 0
Required Approvals: 2f + 1 = 2
```

### Consensus Flow

```
1. Application State: VERIFIED (after VRO verification)
2. MRO #1 submits approval → ApproveLandByMRO()
   - Status: APPROVED
   - Consensus: 1/2
3. MRO #2 submits approval → ApproveLandByMRO()
   - Status: APPROVED
   - Consensus: 2/2 ✅ THRESHOLD REACHED
4. Application State: APPROVED (Final)
5. Ownership finalized on blockchain
```

### Consensus Logic (Chaincode)

```go
// Check if consensus threshold reached
requiredApprovals := 2 // 2/3 of 3 MROs
if len(approval.ApprovedBy) >= requiredApprovals {
    // Finalize approval
    consensus.Status = "APPROVED"
    consensus.FinalizedAt = timestamp
    app.Status = "APPROVED"
    
    // Emit ConsensusReached event
}
```

### Anti-Patterns Prevented

❌ **No double approval:** Each MRO can approve only once  
❌ **No bypass:** VRO verification required before MRO approval  
❌ **No replay:** Each approval has unique transaction ID  
❌ **No deletion:** All records immutable

---

## 🔒 SECURITY MODEL

### MSP-Based Identity

All users authenticated via **Fabric MSP**:
- X.509 certificates issued by Fabric CA
- Role attributes embedded in certificates
- MSP ID validates organization membership

### Access Control Enforcement

```go
// Chaincode-level RBAC
func requireVRO(ctx) error {
    mspID := ctx.GetClientIdentity().GetMSPID()
    if mspID != "VROOrgMSP" {
        return error("Only VRO can verify")
    }
}
```

### TLS Everywhere

- Peer-to-peer communication: **TLS enabled**
- Client-to-peer: **Mutual TLS**
- Orderer communication: **TLS enabled**

### Endorsement Policies

```yaml
CCLB Global:
  Endorsement: AND('CCLEBMSP.peer')
  
Regional Channels:
  Endorsement: OR('StateOrgTSMSP.peer', 'VROOrgMSP.peer', 'MROOrgMSP.peer')
```

### Data Privacy

- **On-chain:** Hashes, references, metadata
- **Off-chain:** PII, documents, images
- **IPFS:** Document storage with content hashes

---

## 🚀 API DOCUMENTATION

### Base URL
```
http://localhost:3000/api
```

### Authentication

**POST** `/auth/enroll`
```json
Request:
{
  "userId": "citizen001",
  "role": "citizen",
  "org": "citizen"
}

Response:
{
  "success": true,
  "userId": "citizen001",
  "role": "citizen",
  "org": "citizen"
}
```

### Land Application

**POST** `/land/submit`
```json
Request:
{
  "appId": "APP-2026-TS-001",
  "docHash": "QmXYZ...",
  "userId": "citizen001",
  "org": "citizen"
}

Response:
{
  "success": true,
  "appId": "APP-2026-TS-001",
  "status": "PENDING_VERIFICATION"
}
```

### VRO Verification

**POST** `/land/verify`
```json
Request:
{
  "appId": "APP-2026-TS-001",
  "propertyId": "CCLB-2026-TS-000001",
  "status": "VERIFIED",
  "comments": "All documents validated",
  "documentHash": "QmABC...",
  "userId": "vro001"
}

Response:
{
  "success": true,
  "verification": {
    "appId": "APP-2026-TS-001",
    "status": "VERIFIED",
    "verifiedBy": "vro001",
    "verifiedAt": "2026-02-04T12:00:00Z"
  }
}
```

### MRO Approval

**POST** `/land/approve`
```json
Request:
{
  "appId": "APP-2026-TS-001",
  "propertyId": "CCLB-2026-TS-000001",
  "status": "APPROVED",
  "comments": "Approved",
  "userId": "mro001"
}

Response:
{
  "success": true,
  "approval": {
    "approvalNumber": 1,
    "status": "APPROVED"
  },
  "consensus": {
    "status": "PENDING",
    "currentApprovals": 1,
    "requiredApprovals": 2,
    "consensusReached": false
  }
}
```

### Ownership Transfer

**POST** `/land/transfer`
```json
Request:
{
  "propertyId": "CCLB-2026-TS-000001",
  "newOwner": "Rajesh Kumar",
  "transferType": "SALE",
  "considerationAmount": "5000000",
  "documentHash": "QmDEF...",
  "userId": "admin001",
  "org": "admin"
}

Response:
{
  "success": true,
  "transfer": {
    "transferId": "TRANSFER_CCLB-2026-TS-000001_...",
    "fromOwner": "Ramesh Reddy",
    "toOwner": "Rajesh Kumar",
    "status": "INITIATED"
  }
}
```

### Query APIs

**GET** `/land/query/:propertyId?userId=admin&org=cclb`

**GET** `/land/ownership-history/:propertyId`

**GET** `/land/consensus/:propertyId`

**GET** `/cclb/verify-property-id/:propertyId`

---

## 📦 DEPLOYMENT GUIDE

### Prerequisites

```bash
# Required Software
- Docker 20.10+
- Docker Compose 1.29+
- Node.js 14+
- Go 1.16+
- Fabric Binaries 2.2+
```

### Step 1: Setup Network

```bash
cd network/scripts
./setup-network.sh
```

This will:
1. Generate crypto material (MSPs, TLS certs)
2. Generate genesis block and channel transactions
3. Start all Docker containers
4. Verify network health

### Step 2: Create Channels

```bash
./create-all-channels.sh
```

Creates:
- `cclb-global` channel
- `land-region-ts` channel
- `land-region-ka` channel
- `land-region-ap` channel

### Step 3: Deploy Chaincode

```bash
./deploy-all-chaincode.sh
```

Deploys:
- `cclb-registry` to `cclb-global`
- `landregistry` to all regional channels

### Step 4: Start Backend

```bash
cd ../../realestate2/backend
npm install
node api-complete.js
```

### Step 5: Verify Deployment

```bash
# Check containers
docker ps

# Check chaincode
peer chaincode query -C land-region-ts -n landregistry -c '{"Args":["InitLedger"]}'

# Test API
curl http://localhost:3000/api/health
```

---

## ✅ TESTING & VALIDATION

### Network Health Checks

```bash
# Container status
docker-compose ps

# Peer logs
docker logs peer0.cclb.landregistry.local

# Orderer logs
docker logs orderer0.orderer.landregistry.local
```

### API Testing

Use `curl` or Postman:

```bash
# Health check
curl http://localhost:3000/api/health

# Enroll user
curl -X POST http://localhost:3000/api/auth/enroll \
  -H "Content-Type: application/json" \
  -d '{"userId":"test001","role":"citizen","org":"citizen"}'
```

### Chaincode Testing

```bash
# Invoke from CLI
peer chaincode invoke \
  -C land-region-ts \
  -n landregistry \
  -c '{"Args":["SubmitLandApplication","APP001","QmHash"]}'
```

---

## 📞 SUPPORT & CONTACT

For issues or questions:
- Check logs: `docker-compose logs -f`
- Review [troubleshooting guide](#)
- Contact: admin@landregistry.local

---

**Document Version:** 1.0.0  
**Last Updated:** February 4, 2026  
**Status:** Production-Ready ✅
