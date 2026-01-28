# Backend Configuration for Custom Land Registry Network

This directory contains connection profiles and configuration for the Node.js backend to connect to the custom Land Registry Fabric network.

## Files

### Connection Profiles

#### `connection-cclb.yaml`
Connects as CCLB (Central Land Ledger Board) organization.

- **Organization**: CCLB
- **MSP ID**: CCLEBMSP
- **Peer**: peer0.cclb.landregistry.local:7051
- **CA**: ca-cclb:7054
- **Channels**: cclb-global, state-ts
- **Use Case**: National registry operations, system administration

#### `connection-state-ts.yaml`
Connects as StateOrgTS (Telangana State Organization).

- **Organization**: StateOrgTS
- **MSP ID**: StateOrgTSMSP
- **Peer**: peer0.ts.landregistry.local:9051
- **CA**: ca-ts:7055
- **Channels**: cclb-global, state-ts
- **Use Case**: State-specific operations, state administration

#### `connection-org1.yaml` (Legacy - fabric-samples)
Connects to the test-network from fabric-samples.

- **Organization**: Org1
- **MSP ID**: Org1MSP
- **Peer**: peer0.org1.example.com:7051
- **Channel**: mychannel
- **Note**: For backward compatibility only. Use custom network profiles for new deployments.

## Usage

### Select Network in Backend Code

#### Option 1: Use Defaults (Recommended for State TS)
```javascript
const { getContract } = require('./fabric');

// Uses custom-network, cclb org, state-ts channel by default
const { contract, gateway } = await getContract();
```

#### Option 2: Specify Network Parameters
```javascript
const { getContract } = require('./fabric');

// Connect as CCLB to cclb-global channel
const { contract, gateway } = await getContract({
  network: 'custom-network',
  org: 'cclb',
  channel: 'cclb-global',
  chaincode: 'registry-index',
  identity: 'admin'
});

// Or connect as StateOrgTS to state-ts channel
const { contract, gateway } = await getContract({
  network: 'custom-network',
  org: 'state-ts',
  channel: 'state-ts',
  chaincode: 'landregistry',
  identity: 'admin'
});
```

#### Option 3: Use Legacy Test Network
```javascript
const { getContract } = require('./fabric');

const { contract, gateway } = await getContract({
  network: 'test-network',
  org: 'org1'
});
```

### Environment-Based Configuration

Set network context via environment variables:

```bash
# Use custom network (CCLB organization)
FABRIC_NETWORK=custom-network
FABRIC_ORG=cclb
FABRIC_CHANNEL=state-ts

# Or use test network
FABRIC_NETWORK=test-network
```

Update your Node.js code:
```javascript
const networkConfig = {
  network: process.env.FABRIC_NETWORK || 'custom-network',
  org: process.env.FABRIC_ORG || 'cclb',
  channel: process.env.FABRIC_CHANNEL || 'state-ts'
};

const { contract, gateway } = await getContract(networkConfig);
```

## Path Resolution

### Automatic Path Resolution

Connection profiles use `${FABRIC_CFG_PATH}` which is automatically resolved to the backend's directory. This allows:

1. **Portable paths**: Works whether backend runs in Docker or locally
2. **Relative crypto paths**: All certificate paths are relative to `network/crypto-config/`

Example path resolution:
```yaml
# In connection-cclb.yaml
tlsCACerts:
  path: ${FABRIC_CFG_PATH}/../network/crypto-config/peerOrganizations/...

# Resolves to (at runtime):
# /path/to/backend/../network/crypto-config/...
```

### Manual Override

If paths don't resolve correctly:

```javascript
const path = require('path');
const ccpPath = path.resolve(__dirname, '../config/connection-cclb.yaml');
const ccp = yaml.load(fs.readFileSync(ccpPath, 'utf8'));

// Manually resolve paths
for (const peerName in ccp.peers) {
  const tlsPath = ccp.peers[peerName].tlsCACerts.path;
  ccp.peers[peerName].tlsCACerts.path = path.resolve(
    __dirname, 
    '../network/crypto-config/...'
  );
}
```

## Network Context Selection

### By Scope

Different API endpoints can connect to different channels:

```javascript
app.get('/api/national/property/:id', async (req, res) => {
  // National registry - CCLB global channel
  const { contract } = await getContract({
    network: 'custom-network',
    org: 'cclb',
    channel: 'cclb-global',
    chaincode: 'registry-index'
  });
  // ...
});

app.get('/api/state/property/:id', async (req, res) => {
  // State registry - state-specific channel
  const { contract } = await getContract({
    network: 'custom-network',
    org: 'cclb',
    channel: 'state-ts',
    chaincode: 'landregistry'
  });
  // ...
});
```

### By Organization (for Multi-Org Scenarios)

Different backend services can connect as different organizations:

```javascript
// Backend service for CCLB operations
const cclebService = await getContract({
  network: 'custom-network',
  org: 'cclb',
  channel: 'cclb-global'
});

// Backend service for State operations
const stateService = await getContract({
  network: 'custom-network',
  org: 'state-ts',
  channel: 'state-ts'
});
```

## Wallet Configuration

### Wallet Location
```
realestate2/backend/wallet/
├── admin.id
├── user1.id
└── registrar.id
```

### Adding Identities

```javascript
// Add admin identity
const adminMSPPath = path.join(
  __dirname,
  '../network/crypto-config/peerOrganizations/cclb.landregistry.local/users/Admin@cclb.landregistry.local/msp'
);

const { X509Identity, Wallets } = require('fabric-network');
const cert = fs.readFileSync(path.join(adminMSPPath, 'signcerts/Admin@cclb.landregistry.local-cert.pem'), 'utf8');
const key = fs.readFileSync(path.join(adminMSPPath, 'keystore/...'), 'utf8');

const identity = {
  credentials: {
    certificate: cert,
    privateKey: key
  },
  mspId: 'CCLEBMSP',
  type: 'X.509'
};

const wallet = await Wallets.newFileSystemWallet(walletPath);
await wallet.put('admin', identity);
```

## TLS Configuration

All connections use TLS with certificate verification:

```yaml
peers:
  peer0.cclb.landregistry.local:
    url: grpcs://localhost:7051  # gRPC over TLS
    tlsCACerts:
      path: crypto-config/.../ca.crt  # CA certificate for verification
    grpcOptions:
      ssl-target-name-override: peer0.cclb.landregistry.local
```

### Disable TLS (Development Only)

```javascript
const gateway = new Gateway();
await gateway.connect(ccp, {
  wallet,
  identity: 'admin',
  tlsClientCertHash: undefined,  // Skip client cert verification
  // ... other options
});
```

## Discovery Mode

### Production Mode (Recommended)
```javascript
// Explicitly specify channels and peers
await gateway.connect(ccp, {
  discovery: {
    enabled: false  // Use connection profile exactly
  }
});
```

### Development Mode
```javascript
// Let Fabric discover network topology
await gateway.connect(ccp, {
  discovery: {
    enabled: true,
    asLocalhost: true
  }
});
```

## Troubleshooting

### Connection Timeout
```
Error: ECONNREFUSED localhost:7051
```

**Solution**: Ensure network is running
```bash
docker-compose -f network/docker-compose.yaml ps
docker-compose -f network/docker-compose.yaml up -d
```

### TLS Certificate Error
```
Error: certificate verify failed
```

**Solution**: Verify paths in connection profile:
```bash
ls -la network/crypto-config/peerOrganizations/cclb.landregistry.local/peers/peer0.cclb.landregistry.local/tls/
```

### Identity Not Found
```
Error: Identity admin not found in wallet
```

**Solution**: Enroll admin:
```bash
node addAdminToWallet.js
```

### Channel Not Found
```
Error: Channel not found
```

**Solution**: Verify peer is joined to channel:
```bash
export CORE_PEER_ADDRESS=localhost:7051
peer channel list
```

## API Server Examples

### Get Contract and Submit Transaction
```javascript
const { getContract } = require('./fabric');

app.post('/api/property/register', async (req, res) => {
  try {
    const { contract, gateway } = await getContract({
      network: 'custom-network',
      org: 'cclb',
      channel: 'state-ts',
      chaincode: 'landregistry'
    });

    // Submit transaction
    const result = await contract.submitTransaction(
      'RegisterProperty',
      req.body.propertyId,
      req.body.owner,
      JSON.stringify(req.body.details)
    );

    // Close gateway
    await gateway.disconnect();

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Query Transaction
```javascript
app.get('/api/property/:id', async (req, res) => {
  const { contract, gateway } = await getContract();

  try {
    const result = await contract.evaluateTransaction(
      'GetPropertyRecord',
      req.params.id
    );

    await gateway.disconnect();
    res.json(JSON.parse(result.toString()));
  } catch (error) {
    res.status(404).json({ error: 'Property not found' });
  }
});
```

## Security Best Practices

1. **Never commit private keys**: Add `wallet/` to `.gitignore`
2. **Use strong CA passwords**: Rotate admin credentials
3. **Enable TLS everywhere**: No unencrypted connections
4. **Restrict certificate access**: Set proper file permissions
5. **Use separate identities**: Different roles/applications use different identities
6. **Audit logging**: Log all transaction submissions

## References

- [Fabric Network Configuration](https://hyperledger-fabric.readthedocs.io/en/latest/discovery-cli.html)
- [Fabric Node SDK](https://github.com/hyperledger/fabric-sdk-node)
- [Connection Profile Specification](https://github.com/hyperledger/fabric-sdk-js/wiki/Connection-Profile-Specification)
- [Custom Network README](../network/README.md)
