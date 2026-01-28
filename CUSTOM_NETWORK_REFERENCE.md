# Custom Network Configuration Reference

Complete reference for custom Fabric network configuration, cryptography, and architecture.

## Network Topology

### Organizations

```
┌─────────────────────────────────────────────────────────────┐
│                    Land Registry Network                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  CCLB                  StateOrgTS            Orderer         │
│  (Root Authority)      (State)               (Consensus)     │
│                                                              │
│  ├─ Peer0              ├─ Peer0              ├─ Orderer0     │
│  │  ├─ CouchDB         │  ├─ CouchDB         │  ├─ RocksDB   │
│  │  └─ Ledger          │  └─ Ledger          │  └─ Ledger    │
│  │                     │                     │               │
│  ├─ CA (7054)          ├─ CA (7055)          └─ (Port 7050)  │
│  │  └─ Enroll          │  └─ Enroll                          │
│  │     Admin           │     Admin                           │
│  │     Users           │     Users                           │
│  │     Registrars      │     Registrars                      │
│  │                                                           │
│  └─ MSP (CCLEBMSP)     └─ MSP (StateOrgTSMSP)                │
│                                                              │
└─────────────────────────────────────────────────────────────┘

        ↓              ↓              ↓
        
┌─────────────────────────────────────────────────────────────┐
│                          Channels                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  cclb-global              │    state-ts                      │
│  (Property ID Registry)   │    (State Records)               │
│  Members:                 │    Members:                      │
│  • CCLB                   │    • CCLB                        │
│  • StateOrgTS             │    • StateOrgTS                  │
│                           │                                  │
│  Chaincode:               │    Chaincode:                    │
│  • registry-index         │    • landregistry               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Cryptographic Material Structure

### Directory Layout

```
crypto-config/
├── ordererOrganizations/
│   └── orderer.landregistry.local/
│       ├── ca/
│       │   ├── ca.orderer.landregistry.local-cert.pem
│       │   └── private.key
│       ├── msp/
│       │   ├── admincerts/
│       │   ├── cacerts/
│       │   └── tlscacerts/
│       └── orderers/
│           └── orderer0.orderer.landregistry.local/
│               ├── msp/
│               │   ├── admincerts/
│               │   ├── cacerts/
│               │   └── signcerts/
│               │       └── cert.pem
│               └── tls/
│                   ├── ca.crt
│                   ├── server.crt
│                   └── server.key
│
└── peerOrganizations/
    ├── cclb.landregistry.local/
    │   ├── ca/
    │   │   ├── ca.cclb.landregistry.local-cert.pem
    │   │   └── private.key
    │   ├── msp/
    │   │   ├── admincerts/
    │   │   ├── cacerts/
    │   │   ├── config.yaml
    │   │   └── tlscacerts/
    │   ├── peers/
    │   │   └── peer0.cclb.landregistry.local/
    │   │       ├── msp/
    │   │       └── tls/
    │   │           ├── ca.crt
    │   │           ├── server.crt
    │   │           └── server.key
    │   └── users/
    │       ├── Admin@cclb.landregistry.local/
    │       │   └── msp/
    │       └── User1@cclb.landregistry.local/
    │           └── msp/
    │
    └── ts.landregistry.local/
        └── [Same structure as CCLB]
```

### Certificate Types

| Certificate | Purpose | Location | Validity |
|---|---|---|---|
| **CA Root** | Organization root certificate | ca/ | 10 years |
| **Peer TLS** | Peer-to-peer communication | peers/.../tls/ | 1 year |
| **Admin Cert** | User identity for admin operations | users/Admin@.../msp/signcerts/ | 1 year |
| **User Cert** | Regular user identity | users/User@.../msp/signcerts/ | 1 year |
| **Orderer TLS** | Orderer service authentication | orderers/.../tls/ | 1 year |

## MSP Configuration

### MSP Directory (msp/)

Each organization has an MSP directory with:

```
msp/
├── cacerts/                 # CA certificates
│   └── ca.{domain}-cert.pem
├── tlscacerts/              # TLS CA certificates
│   └── tlsca.{domain}-cert.pem
├── admincerts/              # Admin certificates (for peer channel operations)
│   └── Admin@{domain}-cert.pem
├── keystore/                # Private keys
│   └── {key_id}_sk
├── signcerts/               # Signing certificates
│   └── {user}-cert.pem
└── config.yaml              # MSP configuration (NodeOUs)
```

### NodeOUs Configuration

The network uses NodeOUs to distinguish user roles:

```yaml
# config.yaml
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/ca.cclb.landregistry.local-cert.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/ca.cclb.landregistry.local-cert.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/ca.cclb.landregistry.local-cert.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/ca.orderer.landregistry.local-cert.pem
    OrganizationalUnitIdentifier: orderer
```

This enforces role-based access control:
- **Peer OU**: Identifies peer nodes
- **Client OU**: Identifies client applications
- **Admin OU**: Identifies administrators
- **Orderer OU**: Identifies orderer nodes

## Channel Configuration

### Genesis Block (orderer.genesis.block)

Contains:
- Orderer organization MSP
- Orderer configuration
- System channel policy
- Consortium definitions

### Channel Configuration Transactions

#### cclb-global.tx
- Members: CCLB, StateOrgTS
- Policies: Majority approval required
- Chaincode: registry-index

#### state-ts.tx
- Members: CCLB, StateOrgTS
- Policies: Majority approval required
- Chaincode: landregistry

### Policy Model

```
Channel Policy
├── Readers: ANY Members (can read ledger)
├── Writers: ANY Members (can submit transactions)
└── Admins: MAJORITY Admins (can modify channel config)

Application Policy
├── LifecycleEndorsement: MAJORITY Members (approve chaincode)
├── Endorsement: MAJORITY Members (execute chaincode)
└── Admin: MAJORITY Admins

Orderer Policy
├── Readers: ANY Members
├── Writers: ANY Members
└── BlockValidation: ANY Members
```

## TLS Configuration

### TLS Certificates

Every component has TLS certificates:

```
Orderer TLS
├── ca.crt           # CA certificate
├── server.crt       # Server certificate (public)
└── server.key       # Server private key (secret)

Peer TLS
├── ca.crt           # CA certificate
├── server.crt       # Server certificate
└── server.key       # Server private key
```

### TLS Mutual Authentication (mTLS)

Used for:
- Peer-to-peer gossip
- Peer-to-orderer communication
- Client-to-peer connections
- Orderer cluster communication

Configuration:
```yaml
tls:
  enabled: true
  privateKey: tls/server.key
  certificate: tls/server.crt
  rootCert: tls/ca.crt
```

## Connection Profile Reference

### connection-cclb.yaml

```yaml
client:
  organization: CCLB

organizations:
  CCLB:
    mspid: CCLEBMSP
    peers: [peer0.cclb.landregistry.local]
    certificateAuthorities: [ca-cclb]

peers:
  peer0.cclb.landregistry.local:
    url: grpcs://localhost:7051
    tlsCACerts:
      path: crypto-config/.../tls/ca.crt

certificateAuthorities:
  ca-cclb:
    url: https://localhost:7054
    tlsCACerts:
      path: crypto-config/.../ca/ca.cclb.landregistry.local-cert.pem

channels:
  cclb-global:
    peers: {peer0.cclb.landregistry.local: {endorsingPeer: true}}
  state-ts:
    peers: {peer0.cclb.landregistry.local: {endorsingPeer: true}}
```

### Peer Roles

- **endorsingPeer**: Can endorse transactions
- **chaincodeQuery**: Can query chaincode
- **ledgerQuery**: Can query ledger
- **eventSource**: Can listen to block events

## Database Configuration

### CouchDB

Each peer uses CouchDB for state database:

```
CouchDB Instance
├── Admin credentials
├── Per-channel database
│   ├── cclb-global (JSON documents)
│   └── state-ts (JSON documents)
└── System databases
    ├── _users
    ├── _replicator
    └── _design
```

Query example:
```javascript
// Rich queries enabled by CouchDB
const query = {
  selector: {
    propertyType: "residential",
    owner: "citizen_id_123"
  }
};
```

## Docker Compose Services

### Service Definitions

| Service | Image | Port | Purpose |
|---|---|---|---|
| orderer0 | fabric-orderer:latest | 7050 | Consensus service |
| peer0.cclb | fabric-peer:latest | 7051 | CCLB peer |
| peer0.ts | fabric-peer:latest | 9051 | StateOrgTS peer |
| ca-cclb | fabric-ca:latest | 7054 | CCLB CA |
| ca-ts | fabric-ca:latest | 7055 | StateOrgTS CA |
| couchdb-cclb | couchdb:3.3.2 | 5984 | CCLB state DB |
| couchdb-ts | couchdb:3.3.2 | 6984 | StateOrgTS state DB |

### Environment Variables

**Peer:**
```env
CORE_PEER_ID=peer0.cclb.landregistry.local
CORE_PEER_ADDRESS=peer0.cclb.landregistry.local:7051
CORE_PEER_LOCALMSPID=CCLEBMSP
CORE_PEER_TLS_ENABLED=true
CORE_LEDGER_STATE_STATEDATABASE=CouchDB
```

**Orderer:**
```env
ORDERER_GENERAL_LISTENPORT=7050
ORDERER_GENERAL_LOCALMSPID=OrdererMSP
ORDERER_GENERAL_TLS_ENABLED=true
ORDERER_GENERAL_GENESISMETHOD=file
```

## Scaling Considerations

### Adding More Peers per Org

1. Update cryptogen.yaml:
   ```yaml
   Template:
     Count: 2  # Instead of 1
   ```

2. Regenerate: `./scripts/setup-network.sh`

3. Update docker-compose.yaml with additional peer services

4. Peers will gossip and sync ledger automatically

### Adding More Organizations

1. Update cryptogen.yaml:
   ```yaml
   - Name: StateOrgKA
     Domain: ka.landregistry.local
   ```

2. Update configtx.yaml with new org definition

3. Update consortium and channels

4. Regenerate all configurations

## Orderer Raft Configuration

### etcd-raft Parameters

```yaml
EtcdRaftOptions:
  TickInterval: 100ms          # Heartbeat interval
  ElectionTick: 10             # Election timeout
  HeartbeatTick: 1             # Heartbeat tick
  MaxInflightBlocks: 5         # In-flight messages
  SnapshotIntervalSize: 16MB   # Snapshot frequency
```

### Cluster Addresses

```yaml
Addresses:
  - orderer0.orderer.landregistry.local:7050
  - orderer1.orderer.landregistry.local:7050
  - orderer2.orderer.landregistry.local:7050
```

## Network Policies

### Channel Creation Policy

- Only consortium admins can create channels
- Requires MAJORITY approval

### Chaincode Lifecycle

1. **Package**: Create chaincode package
2. **Install**: Install on peer
3. **Approve**: Each org approves chaincode definition
4. **Commit**: Majority orgs commit to channel
5. **Invoke**: Anyone can invoke

## Backup & Recovery

### Critical Files to Backup

```
crypto-config/              # Certificates and keys
channel-artifacts/          # Genesis and channel configs
Docker volumes:
  - peer0.cclb.landregistry.local/
  - peer0.ts.landregistry.local/
  - orderer0.orderer.landregistry.local/
  - ca-cclb/
  - ca-ts/
  - couchdb-cclb/
  - couchdb-ts/
```

### Recovery Procedure

1. Stop network: `docker-compose down`
2. Restore volumes from backup
3. Restart: `docker-compose up -d`
4. Ledger state is restored automatically

## Security Hardening

For production deployments:

1. **Private CA**: Run your own Fabric CA
2. **LDAP Integration**: Connect to enterprise directory
3. **Hardware Security Module**: Store keys in HSM
4. **Network Policies**: Restrict inter-container traffic
5. **TLS Mutual Auth**: Enforce mTLS everywhere
6. **Audit Logging**: Log all administrative operations
7. **Secret Management**: Use Vault for key storage

## Additional References

- [Fabric cryptogen tool](https://hyperledger-fabric.readthedocs.io/en/latest/identity/identity.html)
- [Configtx documentation](https://hyperledger-fabric.readthedocs.io/en/latest/configtx.html)
- [Fabric MSP](https://hyperledger-fabric.readthedocs.io/en/latest/msp.html)
- [TLS in Fabric](https://hyperledger-fabric.readthedocs.io/en/latest/enable_tls.html)
