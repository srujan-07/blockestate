# Custom Land Registry Network - Quick Navigation Guide

## 🎯 Start Here

**New to this project?** Start with the [30-second overview](#30-second-overview), then pick your role below.

### 30-Second Overview

You have a **production-grade custom Hyperledger Fabric network** for Land Registry that:
- ✅ Runs independently (no fabric-samples)
- ✅ Uses persistent storage (ledger survives restart)
- ✅ Supports multiple organizations (CCLB, StateOrgTS)
- ✅ Has multiple channels (cclb-global, state-ts)
- ✅ Is TLS-enabled everywhere (secure by default)

---

## 📋 Pick Your Role

### 👨‍💻 I'm a Developer - I want to run the network locally

**Time to running**: ~15 minutes

1. Read: [network/README.md](network/README.md)
2. Run: `cd network && ./scripts/quick-start.sh`
3. Start backend: `cd realestate2/backend && npm start`
4. Test: Open http://localhost:3000

**Files you'll care about:**
- `network/docker-compose.yaml` - See what's running
- `realestate2/backend/fabric.js` - How to connect
- `realestate2/backend/config/README.md` - Connection profiles

---

### 🔧 I'm migrating from fabric-samples

**Time required**: ~30 minutes including testing

1. Read: [MIGRATION_CUSTOM_NETWORK.md](MIGRATION_CUSTOM_NETWORK.md)
2. Follow: Step-by-step migration (8 steps)
3. Verify: Run test transactions
4. Update: Backend code (mostly done already)

**Key files:**
- `MIGRATION_CUSTOM_NETWORK.md` - Complete migration guide
- `CUSTOM_NETWORK_REFERENCE.md` - Technical details

---

### 🏗️ I'm an Architect/DevOps - I want to understand the design

**Start with:**
1. [CUSTOM_NETWORK_DELIVERY_SUMMARY.md](CUSTOM_NETWORK_DELIVERY_SUMMARY.md) - High-level overview
2. [CUSTOM_NETWORK_REFERENCE.md](CUSTOM_NETWORK_REFERENCE.md) - Complete technical reference
3. [network/README.md](network/README.md) - Operational guide

**Study these files:**
- `network/cryptogen.yaml` - Organization definitions
- `network/configtx.yaml` - Channel policies and consortiums
- `network/docker-compose.yaml` - Network topology

---

### 🔐 I need to understand the security model

**Read:**
1. [CUSTOM_NETWORK_REFERENCE.md](CUSTOM_NETWORK_REFERENCE.md#security-model) - Security section
2. [network/README.md](network/README.md#security-considerations) - Security considerations
3. Files:
   - `network/cryptogen.yaml` - Certificate definitions
   - `network/configtx.yaml` - Access control policies

**Key concepts:**
- TLS everywhere (enabled in docker-compose.yaml)
- Organization MSPs (CCLEBMSP, StateOrgTSMSP, OrdererMSP)
- Endorsement policies (MAJORITY)
- NodeOUs for role-based access

---

### 📊 I'm operating the network in production

**Setup:**
1. Follow [network/README.md](network/README.md#deployment-checklist) - Deployment section
2. Configure monitoring (see production enhancements below)
3. Setup backups for Docker volumes

**Daily operations:**
- Check logs: `docker-compose logs -f <service>`
- Monitor ledger: Query CouchDB at http://localhost:5984
- Monitor peers: Check peer logs for errors

**References:**
- [CUSTOM_NETWORK_REFERENCE.md](CUSTOM_NETWORK_REFERENCE.md#database-configuration) - Database section
- [network/README.md](network/README.md#troubleshooting) - Troubleshooting guide

---

### 📚 I want to learn how the backend connects

**Start with:**
1. [realestate2/backend/config/README.md](realestate2/backend/config/README.md)
2. Study `realestate2/backend/fabric.js` - Connection logic
3. Review `realestate2/backend/config/connection-cclb.yaml` - Connection profile

**Key concepts:**
- Connection profiles (YAML files describing network)
- Wallet (stores identities)
- Gateway pattern (JavaScript SDK)
- Contract objects (interact with chaincode)

**Example usage:**
```javascript
// Connect to custom network as CCLB
const { contract } = await getContract({
  network: 'custom-network',
  org: 'cclb',
  channel: 'state-ts'
});

// Query chaincode
const result = await contract.evaluateTransaction('GetPropertyRecord', propertyId);
```

---

## 📁 File Organization

```
Project Root/
│
├── network/                           ← CUSTOM FABRIC NETWORK
│   ├── docker-compose.yaml            ← Services & containers
│   ├── cryptogen.yaml                 ← Organization definitions
│   ├── configtx.yaml                  ← Channel & policy definitions
│   ├── README.md                      ← Network operations guide
│   ├── scripts/
│   │   ├── setup-network.sh          ← Generate crypto (Linux/macOS)
│   │   ├── setup-network.ps1         ← Generate crypto (Windows)
│   │   ├── create-channels.sh        ← Create channels
│   │   ├── deploy-chaincode.sh       ← Deploy chaincode
│   │   └── quick-start.sh            ← One-command setup
│   ├── ca-config/                    ← CA configuration templates
│   ├── crypto-config/                ← Generated certificates (after setup)
│   └── channel-artifacts/            ← Generated configs (after setup)
│
├── chaincode/land-registry/           ← BUSINESS LOGIC (UNCHANGED)
│   └── ... contract.go, land_record.go, etc.
│
├── realestate2/backend/               ← NODE.JS BACKEND (UPDATED)
│   ├── fabric.js                      ← Enhanced with network selection
│   ├── config/
│   │   ├── connection-cclb.yaml       ← CCLB connection profile
│   │   ├── connection-state-ts.yaml   ← StateOrgTS connection profile
│   │   ├── connection-org1.yaml       ← Legacy (test-network)
│   │   └── README.md                  ← Backend config guide
│   ├── services/
│   │   └── NetworkConfig.js           ← Updated with custom-network
│   └── ... other backend files
│
├── land-registry-frontend/            ← FRONTEND (UNCHANGED)
│   └── ... web UI
│
├── CUSTOM_NETWORK_DELIVERY_SUMMARY.md ← Delivery overview
├── MIGRATION_CUSTOM_NETWORK.md        ← Migration guide (fabric-samples → custom)
├── CUSTOM_NETWORK_REFERENCE.md        ← Technical deep-dive
└── ... other docs
```

---

## 🚀 Common Tasks

### I want to start the network

```bash
cd network
./scripts/quick-start.sh  # or .ps1 on Windows
```

### I want to deploy chaincode

```bash
cd network
./scripts/deploy-chaincode.sh
```

### I want to query the ledger

```bash
# Option 1: Use Node.js SDK
cd realestate2/backend
node -e "
  const { getContract } = require('./fabric');
  getContract().then(async ({ contract, gateway }) => {
    const result = await contract.evaluateTransaction('GetPropertyRecord', 'LRI-123');
    console.log(result.toString());
    await gateway.disconnect();
  });
"

# Option 2: Query CouchDB directly
curl http://admin:adminpw@localhost:5984/cclb-global/_design/registry/_view/all_properties
```

### I want to check what's running

```bash
docker-compose -f network/docker-compose.yaml ps
```

### I want to see logs

```bash
# Orderer logs
docker-compose -f network/docker-compose.yaml logs -f orderer0.orderer.landregistry.local

# Peer logs
docker-compose -f network/docker-compose.yaml logs -f peer0.cclb.landregistry.local

# All logs
docker-compose -f network/docker-compose.yaml logs -f
```

### I want to restart the network

```bash
cd network
docker-compose down
docker-compose up -d
```

### I want to reset everything (careful!)

```bash
cd network
docker-compose down -v  # -v removes volumes (deletes ledger data!)
rm -rf crypto-config channel-artifacts
./scripts/setup-network.sh
docker-compose up -d
```

---

## 📖 Documentation Map

| Document | Best For | Read Time |
|----------|----------|-----------|
| **[CUSTOM_NETWORK_DELIVERY_SUMMARY.md](CUSTOM_NETWORK_DELIVERY_SUMMARY.md)** | High-level overview of what was built | 5 min |
| **[network/README.md](network/README.md)** | Operating the network, Docker services | 10 min |
| **[CUSTOM_NETWORK_REFERENCE.md](CUSTOM_NETWORK_REFERENCE.md)** | Technical deep-dive (crypto, policies, config) | 20 min |
| **[MIGRATION_CUSTOM_NETWORK.md](MIGRATION_CUSTOM_NETWORK.md)** | Migrating from fabric-samples | 15 min |
| **[realestate2/backend/config/README.md](realestate2/backend/config/README.md)** | Backend connection & configuration | 10 min |

---

## 🔗 External Resources

- **Hyperledger Fabric Docs**: https://hyperledger-fabric.readthedocs.io/
- **Fabric Network Architecture**: https://hyperledger-fabric.readthedocs.io/en/latest/network_component.html
- **Fabric CA**: https://hyperledger-fabric-ca.readthedocs.io/
- **Configtx Reference**: https://hyperledger-fabric.readthedocs.io/en/latest/configtx.html
- **Node.js SDK**: https://github.com/hyperledger/fabric-sdk-node

---

## 🆘 Troubleshooting Quick Links

**Container won't start?**
- Check: `docker-compose logs <container_name>`
- Fix: [network/README.md#troubleshooting](network/README.md#troubleshooting)

**Connection timeout?**
- Check: Are all containers running? `docker-compose ps`
- Fix: [CUSTOM_NETWORK_REFERENCE.md#troubleshooting](CUSTOM_NETWORK_REFERENCE.md#troubleshooting)

**Identity not found?**
- Fix: Run `cd realestate2/backend && node addAdminToWallet.js`

**Chaincode not working?**
- Check peer logs: `docker-compose logs peer0.cclb.landregistry.local`
- Verify deployed: `peer lifecycle chaincode queryinstalled`

**Port already in use?**
- Change ports in `network/docker-compose.yaml`

**More issues?** See [CUSTOM_NETWORK_REFERENCE.md#troubleshooting](CUSTOM_NETWORK_REFERENCE.md#troubleshooting)

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] All containers running: `docker-compose ps`
- [ ] Channels exist: `peer channel list`
- [ ] Chaincode installed: `peer lifecycle chaincode queryinstalled`
- [ ] Backend connects: `cd realestate2/backend && npm start`
- [ ] Can submit transaction: POST /api/property/create
- [ ] Can query ledger: GET /api/property/123
- [ ] CouchDB accessible: http://localhost:5984

---

## 🎓 Learning Path

### Beginner
1. Run quick-start: `./scripts/quick-start.sh`
2. Read: [network/README.md](network/README.md)
3. Try: Submit a transaction via API

### Intermediate
1. Read: [CUSTOM_NETWORK_DELIVERY_SUMMARY.md](CUSTOM_NETWORK_DELIVERY_SUMMARY.md)
2. Study: `network/docker-compose.yaml` architecture
3. Review: `realestate2/backend/fabric.js` connection logic
4. Modify: Change default channel in fabric.js

### Advanced
1. Study: [CUSTOM_NETWORK_REFERENCE.md](CUSTOM_NETWORK_REFERENCE.md)
2. Deep-dive: `network/configtx.yaml` policies
3. Explore: Add new organization to cryptogen.yaml
4. Extend: Add new channel to configtx.yaml

---

## 🎯 Success Criteria

You've successfully set up the custom network when:

✅ All Docker containers are running
✅ Both channels (cclb-global, state-ts) are created
✅ Both peers are joined to both channels
✅ Chaincode is deployed to both channels
✅ Backend can connect and submit transactions
✅ CouchDB is queryable
✅ You can retrieve property records

**Time to success**: ~20 minutes from zero

---

## 📞 Summary

This custom network replaces fabric-samples with a **production-ready, scalable, secure Land Registry Fabric network**.

**Next Step**: Open [network/README.md](network/README.md) and start the network!

```bash
cd network
./scripts/quick-start.sh
# ... wait ~2 minutes ...
docker-compose ps  # Should show all services running
```

Good luck! 🚀
