# Migration Guide: From fabric-samples to Custom Network

This guide explains how to migrate the Land Registry project from the fabric-samples test-network to the custom production-grade Hyperledger Fabric network.

## Overview

### What Changed

| Aspect | fabric-samples | Custom Network |
|--------|---|---|
| **Location** | `fabric-samples/test-network/` | `network/` |
| **Organizations** | Org1, Org2 (generic) | CCLB, StateOrgTS (domain-specific) |
| **Channels** | mychannel | cclb-global, state-ts |
| **Chaincodes** | landregistry | registry-index, landregistry |
| **Configuration** | Reused test templates | Custom production configs |
| **Cryptography** | Ephemeral (regenerated each run) | Persistent, versioned |
| **Backend Profiles** | connection-org1.yaml | connection-cclb.yaml, connection-state-ts.yaml |
| **Orderer** | Solo (single node) | Raft (consensus-based) |
| **Database** | LevelDB | CouchDB (queryable) |
| **TLS** | test-network TLS | Custom TLS certificates |

## Step 1: Clean Up fabric-samples Dependencies

### Stop fabric-samples network
```bash
cd fabric-samples/test-network
./network.sh down
```

### Remove hardcoded references in code
The following files previously referenced fabric-samples paths. They have been updated:

- ✅ `realestate2/backend/fabric.js` - Now supports dynamic network/org/channel selection
- ✅ `realestate2/backend/config/connection-cclb.yaml` - New custom network profile
- ✅ `realestate2/backend/config/connection-state-ts.yaml` - New custom network profile

## Step 2: Initialize Custom Network

### 1. Generate cryptographic materials (one-time)

```bash
cd network

# On Linux/macOS
./scripts/setup-network.sh

# On Windows
.\scripts\setup-network.ps1 -FabricBinPath "path/to/fabric-samples/bin"
```

This generates:
- `crypto-config/` - Certificates, keys, and MSPs for all organizations
- `channel-artifacts/` - Genesis block and channel configurations

### 2. Start the network

```bash
docker-compose up -d
```

Verify services:
```bash
docker-compose ps
```

### 3. Create channels and join peers

```bash
# Linux/macOS
./scripts/create-channels.sh

# Windows: Manually run commands or use Git Bash
```

### 4. Deploy chaincode

```bash
# Linux/macOS
./scripts/deploy-chaincode.sh
```

## Step 3: Update Backend Configuration

### Update environment variables (if used)

In `.env` or environment configuration:

```bash
# OLD (fabric-samples)
# NETWORK_NAME=test-network
# CHANNEL_NAME=mychannel
# ORG_NAME=org1

# NEW (custom network)
NETWORK_NAME=custom-network
CHANNEL_NAME=state-ts
ORG_NAME=cclb
```

### Update Node.js backend initialization

**Old code (fabric-samples):**
```javascript
const { getContract } = require('./fabric');
const contract = await getContract('admin');
```

**New code (custom network):**
```javascript
const { getContract } = require('./fabric');
const contract = await getContract({
  network: 'custom-network',
  org: 'cclb',
  channel: 'state-ts',
  identity: 'admin'
});
```

Or use default:
```javascript
const contract = await getContract(); // Uses custom-network, cclb, state-ts by default
```

### Wallet Management

**Old behavior:** Single wallet for Org1MSP

**New behavior:** Wallet supports multiple organizations

```bash
# Enroll CCLB admin
node realestate2/backend/addAdminToWallet.js

# Enroll StateOrgTS admin (if needed for multi-org operations)
# node realestate2/backend/addAdminToWallet.js --org state-ts
```

## Step 4: Update Chaincode Paths

The chaincode is still located at:
```
chaincode/land-registry/
```

No changes needed to chaincode itself. However:

1. **Package name changes** (if needed):
   - Old: `landregistry` deployed to `mychannel`
   - New: `registry-index` to `cclb-global`, `landregistry` to `state-ts`

2. **Channel-specific logic**: The chaincode can now differentiate channels:
   ```go
   // In contract.go
   if ctx.GetChannelID() == "cclb-global" {
     // Handle registry-index logic
   } else if ctx.GetChannelID() == "state-ts" {
     // Handle state-specific logic
   }
   ```

## Step 5: Verify Data Migration (if needed)

### Backup old data (optional)
```bash
# CouchDB for fabric-samples (if using)
curl -X GET http://admin:adminpw@localhost:5984/_all_dbs
```

### Populate new network with test data
```bash
cd realestate2/backend

# Use new network context
node addSampleData.js
```

## Step 6: Update API Server

### Connection Profile Selection

The API server now supports network selection:

```javascript
// Set default network context
setDefaultNetwork('custom-network', 'cclb');

// Or let requests specify network
app.get('/api/property/:id', async (req, res) => {
  const contract = await getContract({
    network: req.query.network || 'custom-network',
    org: req.query.org || 'cclb',
    channel: req.query.channel || 'state-ts'
  });
  // ...
});
```

### Update API endpoints (if needed)

Old endpoint:
```
GET /api/property/123
```

New endpoint (with network context):
```
GET /api/property/123?network=custom-network&org=cclb&channel=state-ts
```

Or simply use defaults without query params.

## Step 7: Update Frontend (if needed)

The frontend doesn't change architecture but can add UI hints:

### Network Scope Selector

Add to UI:
```javascript
// Components/NetworkSelector.jsx
const scopes = [
  { value: 'cclb-global', label: 'National Registry' },
  { value: 'state-ts', label: 'Telangana Registry' }
];

// Backend routes to appropriate channel
```

### Configuration Updates

```javascript
// config.js (frontend)
export const FABRIC_NETWORK = {
  DEFAULT: 'custom-network',
  ORGANIZATIONS: {
    'cclb': 'Central Land Ledger Board',
    'state-ts': 'Telangana'
  },
  CHANNELS: {
    'cclb-global': 'National Registry',
    'state-ts': 'State Registry'
  }
};
```

## Rollback Plan

### If you need to revert to fabric-samples

1. Stop custom network:
   ```bash
   cd network
   docker-compose down
   ```

2. Revert backend configuration:
   ```bash
   git checkout realestate2/backend/fabric.js
   git checkout realestate2/backend/config/connection-org1.yaml
   ```

3. Restart fabric-samples:
   ```bash
   cd fabric-samples/test-network
   ./network.sh up createChannel -ca
   ```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs -f <container_name>

# Rebuild images
docker-compose down
docker-compose pull
docker-compose up -d
```

### Wallet error: "Identity not found"
Ensure admin is enrolled:
```bash
cd realestate2/backend
node addAdminToWallet.js
```

### Channel doesn't exist
Rerun channel creation:
```bash
cd network
./scripts/create-channels.sh
```

### Chaincode errors
Check peer logs and ensure:
1. Chaincode is installed: `peer lifecycle chaincode queryinstalled`
2. Chaincode is approved: `peer lifecycle chaincode queryapproved`
3. Chaincode is committed: `peer lifecycle chaincode querycommitted`

### Connection timeout
Verify orderer and peer addresses in connection profiles match docker-compose.

## Performance Comparison

### fabric-samples test-network
- Single peer per org
- Single-node Solo orderer
- Ephemeral storage
- Test mode (discovery enabled)

### Custom network
- Single peer per org (scale to multiple)
- Raft consensus orderer (crash fault tolerant)
- Persistent volumes (ledger survives restarts)
- Production mode (discovery disabled)
- CouchDB for advanced queries

## Next Steps

1. **Multi-region scaling**: Add more peers per organization
2. **External CA**: Use Fabric CA with LDAP/AD integration
3. **Monitoring**: Add Prometheus + Grafana for metrics
4. **Audit logging**: Setup ELK stack for transaction audit trail
5. **Backup/Restore**: Implement ledger backup procedures
6. **High availability**: Configure multiple orderers in raft cluster

## Additional Resources

- [Custom Network README](./network/README.md)
- [Fabric Architecture Guide](https://hyperledger-fabric.readthedocs.io/en/latest/network_component.html)
- [Fabric Channel Configuration](https://hyperledger-fabric.readthedocs.io/en/latest/configtx.html)
