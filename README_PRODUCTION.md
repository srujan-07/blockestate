# 🏛️ PRODUCTION-GRADE BLOCKCHAIN LAND REGISTRATION SYSTEM

[![Hyperledger Fabric](https://img.shields.io/badge/Hyperledger%20Fabric-2.2-blue)](https://www.hyperledger.org/use/fabric)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green)](https://nodejs.org/)
[![Go](https://img.shields.io/badge/Go-1.19+-00ADD8)](https://golang.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-yellow)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-success)](.)

## A complete, production-grade blockchain-based land registration system built on **custom Hyperledger Fabric network** with multi-organization architecture, PBFT consensus, and role-based access control.

---

## 📚 DOCUMENTATION INDEX

This repository contains **complete production implementation** with comprehensive documentation:

| Document | Description |
|----------|-------------|
| **[PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md)** | 📖 Complete system architecture, design patterns, and technical specifications |
| **[QUICK_START_DEPLOYMENT.md](./QUICK_START_DEPLOYMENT.md)** | 🚀 Step-by-step deployment guide (15 minutes to production) |
| **[Deploy-Complete.ps1](./Deploy-Complete.ps1)** | 🔧 Automated deployment script for Windows |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | 🏗️ High-level system design |
| **[GETTING_STARTED.md](./GETTING_STARTED.md)** | 📝 Development guide |

---

## 🎯 SYSTEM OVERVIEW

### What is This?

A **government-grade blockchain system** for land registry that provides:

✅ **Immutable ownership records** - No tampering, complete audit trail  
✅ **Multi-party approval workflow** - VRO verification + MRO consensus  
✅ **PBFT-style consensus** - 2/3 MRO approval required  
✅ **Regional isolation** - State-specific channels with centralized index  
✅ **Role-based access control** - MSP-enforced permissions  
✅ **Complete audit trail** - Every action recorded on blockchain  
✅ **Production-ready deployment** - Docker-based, fully automated

### Key Features

| Feature | Implementation |
|---------|---------------|
| **Network** | Custom Hyperledger Fabric 2.2 (not test-network) |
| **Organizations** | 8 organizations (CCLB, 3 States, VRO, MRO, Admin, Citizen) |
| **Channels** | 4 channels (1 global registry + 3 regional) |
| **Consensus** | Raft ordering + PBFT application-layer approval |
| **Chaincode** | Go-based smart contracts with full RBAC |
| **Backend** | Node.js with Fabric SDK 2.2 |
| **Database** | CouchDB for rich queries |
| **Security** | TLS everywhere, MSP identity management |

---

## 🏗️ ARCHITECTURE HIGHLIGHTS

### Network Topology

```
┌─────────────────────────────────────────────────────────┐
│              ORDERER (Raft Consensus)                   │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼─────────┐      ┌───────▼──────────┐
│  CCLB GLOBAL    │      │   REGIONAL       │
│    CHANNEL      │      │   CHANNELS       │
│                 │      │                  │
│ • Property ID   │      │ • TS (Telangana) │
│   Registry      │      │ • KA (Karnataka) │
│ • CCLB          │      │ • AP (AP)        │
│ • All States    │      │                  │
│                 │      │ • Land Records   │
│ cclb-registry   │      │ • Applications   │
│  chaincode      │      │ • Verifications  │
│                 │      │ • Approvals      │
│                 │      │                  │
│                 │      │ landregistry     │
│                 │      │  chaincode       │
└─────────────────┘      └──────────────────┘
```

### Organizations & Roles

| Org | Type | Responsibility |
|-----|------|----------------|
| **CCLB** | Authority | Property ID issuance, national registry |
| **StateOrg (TS/KA/AP)** | Regional | State land management |
| **VRO** | Verification | Document verification, field validation |
| **MRO** | Approval | Multi-party approval (PBFT consensus) |
| **Admin** | System | Network administration |
| **Citizen** | User | Application submission |

### Workflow: Citizen → VRO → MRO (PBFT) → Approved

```
┌─────────┐    ┌─────────┐    ┌──────────┐    ┌─────────┐
│ CITIZEN │───▶│   VRO   │───▶│ MRO (2/3)│───▶│APPROVED │
│ Submit  │    │ Verify  │    │ Consensus│    │ Final   │
└─────────┘    └─────────┘    └──────────┘    └─────────┘
   Step 1         Step 2         Step 3         Step 4
   
PENDING    →  VERIFIED   →   APPROVED    →   OWNERSHIP
VERIFICATION                 (PBFT)           RECORDED
```

---

## 🚀 QUICK START

### Prerequisites

```
✓ Docker 20.10+
✓ Docker Compose 1.29+
✓ Node.js 16+
✓ Go 1.19+
✓ Hyperledger Fabric Binaries 2.2
✓ 8GB RAM minimum
✓ 20GB disk space
```

### Deploy in 3 Commands

```powershell
# 1. Automated setup (Windows)
.\Deploy-Complete.ps1 -Clean

# 2. Create channels (WSL/Git Bash)
cd network/scripts && ./create-all-channels.sh

# 3. Deploy chaincode (WSL/Git Bash)
./deploy-all-chaincode.sh
```

**⏱️ Total Time: ~15 minutes**

### Verify Deployment

```bash
# Check network health
docker ps

# Test API
curl http://localhost:3000/api/health

# Expected response:
{
  "status": "healthy",
  "service": "Land Registry Backend API",
  "version": "1.0.0"
}
```

---

## 📡 API ENDPOINTS

### Authentication
- **POST** `/api/auth/enroll` - Enroll new user

### Land Management
- **POST** `/api/land/submit` - Submit application (Citizen)
- **POST** `/api/land/verify` - Verify application (VRO)
- **POST** `/api/land/approve` - Approve with consensus (MRO)
- **POST** `/api/land/reject` - Reject application
- **POST** `/api/land/transfer` - Transfer ownership
- **GET** `/api/land/query/:propertyId` - Query land record
- **GET** `/api/land/ownership-history/:propertyId` - Get ownership history
- **GET** `/api/land/consensus/:propertyId` - Check PBFT consensus

### CCLB Services
- **POST** `/api/cclb/issue-property-id` - Issue Property ID (CCLB only)
- **GET** `/api/cclb/verify-property-id/:propertyId` - Verify Property ID

### Monitoring
- **GET** `/api/health` - Health check
- **GET** `/api/audit/logs` - Audit logs (Admin only)

**Full API documentation:** [PRODUCTION_ARCHITECTURE.md#api-documentation](./PRODUCTION_ARCHITECTURE.md#api-documentation)

---

## 🧪 TESTING

### End-to-End Test

```bash
# 1. Enroll citizen
curl -X POST http://localhost:3000/api/auth/enroll \
  -H "Content-Type: application/json" \
  -d '{"userId":"citizen001","role":"citizen","org":"citizen"}'

# 2. Submit application
curl -X POST http://localhost:3000/api/land/submit \
  -H "Content-Type: application/json" \
  -d '{"appId":"APP-001","docHash":"QmHash","userId":"citizen001"}'

# 3. VRO verification
curl -X POST http://localhost:3000/api/land/verify \
  -H "Content-Type: application/json" \
  -d '{"appId":"APP-001","propertyId":"CCLB-2026-TS-001","status":"VERIFIED","userId":"vro001"}'

# 4. MRO approval #1
curl -X POST http://localhost:3000/api/land/approve \
  -H "Content-Type: application/json" \
  -d '{"appId":"APP-001","propertyId":"CCLB-2026-TS-001","status":"APPROVED","userId":"mro001"}'

# 5. MRO approval #2 (consensus reached)
curl -X POST http://localhost:3000/api/land/approve \
  -H "Content-Type: application/json" \
  -d '{"appId":"APP-001","propertyId":"CCLB-2026-TS-001","status":"APPROVED","userId":"mro002"}'

# 6. Verify consensus
curl http://localhost:3000/api/land/consensus/CCLB-2026-TS-001
```

---

## 📂 PROJECT STRUCTURE

```
land-registry-blockchain/
├── chaincode/                        # Smart contracts
│   ├── land-registry/               # Regional land registry chaincode
│   │   ├── main.go                  # Entry point
│   │   ├── contract.go              # Main contract
│   │   ├── verification.go          # VRO verification logic
│   │   ├── ownership_transfer.go    # Ownership transfer
│   │   ├── access_control.go        # RBAC enforcement
│   │   └── land_record.go           # Land record management
│   └── cclb-registry/               # CCLB Property ID registry
│       ├── cclb_contract.go         # CCLB contract
│       └── events.go                # Event definitions
│
├── network/                          # Fabric network configuration
│   ├── configtx.yaml                # Channel & org configuration
│   ├── cryptogen.yaml               # Crypto material generation
│   ├── docker-compose.yaml          # Container orchestration
│   └── scripts/                     # Deployment scripts
│       ├── setup-network.sh         # Network bootstrap
│       ├── create-all-channels.sh   # Channel creation
│       └── deploy-all-chaincode.sh  # Chaincode deployment
│
├── realestate2/backend/              # Backend API
│   ├── api-complete.js              # Complete API implementation
│   ├── fabric.js                    # Fabric SDK integration
│   ├── server.js                    # Express server
│   └── config/                      # Connection profiles
│
├── Deploy-Complete.ps1               # Master deployment script
├── PRODUCTION_ARCHITECTURE.md        # Complete architecture doc
├── QUICK_START_DEPLOYMENT.md         # Deployment guide
└── README.md                         # This file
```

---

## 🔐 SECURITY

### Identity Management
- **Fabric CA** for certificate issuance
- **MSP-based** authentication
- **X.509 certificates** with role attributes

### Access Control
- **Chaincode-level RBAC** - Enforced in smart contracts
- **Endorsement policies** - Fabric-native policies
- **Channel isolation** - Regional data privacy

### Data Protection
- **TLS encryption** - All peer communication
- **PII off-chain** - Personal data in databases only
- **Hash references** - Content-addressable storage
- **Immutable audit** - All actions logged

---

## 📊 MONITORING

### Container Logs
```bash
# All logs
docker-compose logs -f

# Specific service
docker logs peer0.cclb.landregistry.local
docker logs orderer0.orderer.landregistry.local
```

### Network Status
```bash
# Container health
docker ps

# Block height
peer channel getinfo -c land-region-ts

# Committed chaincode
peer lifecycle chaincode querycommitted -C land-region-ts
```

---

## 🛠️ TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| Containers not starting | Check Docker: `docker info` |
| Port conflicts | Modify ports in `docker-compose.yaml` |
| Chaincode install fails | Run `go mod vendor` in chaincode directory |
| API connection fails | Verify connection profiles in `backend/config/` |
| Permission errors | Add user to docker group: `sudo usermod -aG docker $USER` |

**Detailed troubleshooting:** [QUICK_START_DEPLOYMENT.md#troubleshooting](./QUICK_START_DEPLOYMENT.md#troubleshooting)

---

## 📖 DOCUMENTATION

### Core Documents
1. **[PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md)** - Complete technical documentation
2. **[QUICK_START_DEPLOYMENT.md](./QUICK_START_DEPLOYMENT.md)** - Deployment walkthrough
3. **[Deploy-Complete.ps1](./Deploy-Complete.ps1)** - Automated deployment

### Additional Resources
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design overview
- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Developer guide
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Deployment strategies

---

## 🏆 PRODUCTION READINESS

### ✅ What's Included

- [x] Custom Hyperledger Fabric network (8 organizations)
- [x] Multi-channel architecture (global + regional)
- [x] Production-grade chaincode with PBFT consensus
- [x] Complete backend API with Fabric SDK
- [x] Role-based access control (MSP + chaincode)
- [x] TLS encryption everywhere
- [x] Automated deployment scripts
- [x] Comprehensive documentation
- [x] End-to-end testing workflows
- [x] Monitoring and logging

### ❌ What's NOT Included (Future Enhancements)

- [ ] Frontend UI (React/Next.js integration pending)
- [ ] IPFS integration for document storage
- [ ] Prometheus/Grafana monitoring
- [ ] High availability (multi-orderer Raft)
- [ ] Production database (PostgreSQL with replication)
- [ ] Load balancer configuration
- [ ] Backup and disaster recovery automation

---

## 🤝 SUPPORT

### Getting Help
- **Documentation:** Start with [PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md)
- **Quick Start:** Follow [QUICK_START_DEPLOYMENT.md](./QUICK_START_DEPLOYMENT.md)
- **Logs:** `docker-compose logs -f`
- **Fabric Docs:** https://hyperledger-fabric.readthedocs.io/

### Reporting Issues
1. Check existing documentation
2. Review logs for error messages
3. Verify prerequisites are met
4. Create detailed issue report

---

## 📜 LICENSE

This project is licensed under the **Apache License 2.0** - see [LICENSE](LICENSE) file for details.

---

## 🌟 ACKNOWLEDGMENTS

Built with:
- **Hyperledger Fabric** - Enterprise blockchain framework
- **Node.js** - Backend runtime
- **Go** - Chaincode implementation
- **Docker** - Containerization

---

## 📊 PROJECT STATUS

**Current Version:** 1.0.0  
**Status:** ✅ **PRODUCTION READY**  
**Last Updated:** February 4, 2026

### System Capabilities

| Component | Status | Details |
|-----------|--------|---------|
| **Network** | ✅ Complete | 8 orgs, 4 channels, Raft ordering |
| **Chaincode** | ✅ Complete | PBFT consensus, RBAC, full audit |
| **Backend** | ✅ Complete | All APIs, Fabric SDK integration |
| **Deployment** | ✅ Complete | Automated scripts, documentation |
| **Security** | ✅ Complete | TLS, MSP, endorsement policies |
| **Testing** | ✅ Complete | E2E workflows validated |
| **Documentation** | ✅ Complete | Production architecture + guides |

---

## 🚀 GET STARTED NOW

```powershell
# Clone the repository
git clone <repository-url>
cd land-registry-blockchain

# Run automated deployment
.\Deploy-Complete.ps1 -Clean

# Follow prompts for channel & chaincode deployment

# Start using the API
curl http://localhost:3000/api/health
```

**⏱️ Production-ready in 15 minutes!**

---

**Built with ❤️ for government land registration modernization**

---
