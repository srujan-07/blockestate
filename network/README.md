# Custom Land Registry Fabric Network

This directory contains the complete production-grade Hyperledger Fabric network for the Land Registry system. It is completely independent of fabric-samples and designed for scalable, government-grade deployments.

## Architecture

### Organizations

| Organization | Role | MSPID | Domain |
|---|---|---|---|
| **CCLB** | Central Land Ledger Board (root authority) | CCLEBMSP | cclb.landregistry.local |
| **StateOrgTS** | Telangana State Organization | StateOrgTSMSP | ts.landregistry.local |
| **Orderer** | Orderer Organization (consensus) | OrdererMSP | orderer.landregistry.local |

### Channels

| Channel | Purpose | Members | Chaincode |
|---|---|---|---|
| **cclb-global** | Property ID registry across all states | CCLB, StateOrgTS | registry-index |
| **state-ts** | Telangana state-specific land records | CCLB, StateOrgTS | landregistry |

### Infrastructure

- **Orderer**: etcd-based raft consensus (1 node, 3 nodes disabled for demo)
- **Peers**: CouchDB for state database, persistent volumes
- **CAs**: Fabric CA per organization with persistent database
- **TLS**: Enabled everywhere (all peers, orderer, client communication)
- **Docker**: Isolated network bridge, persistent volumes for production data

## Quick Start

### Prerequisites

1. **Fabric binaries** in PATH:
   ```bash
   export PATH=$PATH:$(pwd)/../fabric-samples/bin
   ```

2. **Docker** and **Docker Compose**:
   ```bash
   docker --version
   docker-compose --version
   ```

### Setup Network (One-time)

```bash
# Linux/macOS
./scripts/setup-network.sh

# Windows PowerShell
.\scripts\setup-network.ps1
```

This generates:
- Cryptographic materials (certificates, keys, MSPs)
- Genesis block for the orderer
- Channel configuration transactions

### Start Network

```bash
docker-compose up -d
```

Verify services are running:
```bash
docker-compose ps
```

Expected output:
```
NAME                                    STATUS
orderer0.orderer.landregistry.local     Up
peer0.cclb.landregistry.local           Up
peer0.ts.landregistry.local             Up
ca-cclb                                 Up
ca-ts                                   Up
couchdb-cclb                            Up
couchdb-ts                              Up
```

### Create Channels and Join Peers

```bash
# Linux/macOS
./scripts/create-channels.sh

# Windows: Manually run peer channel commands (peer CLI not available in standard Windows Docker)
```

### Deploy Chaincode

```bash
# Linux/macOS
./scripts/deploy-chaincode.sh
```

## Directory Structure

```
network/
├── docker-compose.yaml        # Docker services (orderer, peers, CAs, CouchDB)
├── cryptogen.yaml             # Organization and certificate configuration
├── configtx.yaml              # Channel and consortium definitions
├── README.md                  # This file
│
├── crypto-config/             # Generated cryptographic materials (after setup-network.sh)
│   ├── ordererOrganizations/  # Orderer certs and keys
│   └── peerOrganizations/     # Peer org certs, keys, and MSPs
│
├── channel-artifacts/         # Generated channel configurations (after setup-network.sh)
│   ├── orderer.genesis.block  # Orderer genesis block
│   ├── cclb-global.tx         # cclb-global channel config
│   └── state-ts.tx            # state-ts channel config
│
└── scripts/
    ├── setup-network.sh       # Generate crypto materials
    ├── setup-network.ps1      # Windows version
    ├── create-channels.sh     # Create channels and join peers
    └── deploy-chaincode.sh    # Deploy chaincode
```

## Configuration Details

### Orderer Configuration

- **Type**: etcd-based Raft (crash fault tolerant)
- **Address**: orderer0.orderer.landregistry.local:7050
- **TLS**: Enabled, mutual TLS for cluster communication
- **Port**: 7050 (consensus), 7051 (cluster), 9443 (operations)

### Peer Configuration

**CCLB Peer:**
- ID: peer0.cclb.landregistry.local
- Port: 7051 (peer), 7052 (chaincode), 9440 (operations)
- State DB: CouchDB (localhost:5984)
- Channels: cclb-global, state-ts

**StateOrgTS Peer:**
- ID: peer0.ts.landregistry.local
- Port: 9051 (peer), 7052 (chaincode), 9440 (operations)
- State DB: CouchDB (localhost:6984)
- Channels: cclb-global, state-ts

### Certificate Authorities

**CCLB CA:**
- URL: https://localhost:7054
- Admin: admin / adminpw
- Database: SQLite (persistent volume: ca-cclb)

**StateOrgTS CA:**
- URL: https://localhost:7055
- Admin: admin / adminpw
- Database: SQLite (persistent volume: ca-ts)

## Backend Integration

The Node.js backend connects to this network using connection profiles:

- `connection-cclb.yaml`: Connects as CCLB admin
- `connection-state-ts.yaml`: Connects as StateOrgTS admin

See [realestate2/backend/config/README.md](../../realestate2/backend/config/README.md) for backend configuration.

## Network Lifecycle

### Cleanup

Remove all containers and volumes:
```bash
docker-compose down -v
```

This will:
- Stop and remove all containers
- Remove named volumes
- Keep the directory structure intact

### Restart

```bash
docker-compose down
docker-compose up -d
```

Note: After restart, you must rejoin peers to channels and reinstall chaincode.

### Persistent Data

Data persists in Docker volumes:
- `peer0.cclb.landregistry.local`: Ledger and state DB
- `peer0.ts.landregistry.local`: Ledger and state DB
- `orderer0.orderer.landregistry.local`: Blockchain
- `ca-cclb`: CA database
- `ca-ts`: CA database
- `couchdb-cclb`: State database
- `couchdb-ts`: State database

These volumes survive `docker-compose down` and are reused on restart (useful for testing ledger persistence).

## Troubleshooting

### Container logs
```bash
docker-compose logs -f <service_name>
# Examples:
docker-compose logs -f orderer0.orderer.landregistry.local
docker-compose logs -f peer0.cclb.landregistry.local
docker-compose logs -f ca-cclb
```

### Peer CLI issues
Ensure Fabric peer CLI is installed and in PATH:
```bash
which peer
```

### Channel already exists
If you re-run create-channels.sh, it will fail on existing channels. Either:
1. Start fresh: `docker-compose down -v && ./scripts/setup-network.sh && docker-compose up -d`
2. Or skip existing channels in the script

### Chaincode not installing
- Ensure peer is healthy: `docker-compose logs peer0.cclb.landregistry.local`
- Check that the chaincode path exists: `ls ../../chaincode/land-registry`
- Verify Go modules: `cd ../../chaincode/land-registry && go mod tidy`

## Migration from fabric-samples

This custom network replaces the fabric-samples test-network. Key differences:

| Aspect | fabric-samples | custom network |
|---|---|---|
| Location | fabric-samples/test-network | network/ |
| Config | Reused test configs | Custom production configs |
| Organizations | Org1, Org2 | CCLB, StateOrgTS, etc. |
| Channels | mychannel | cclb-global, state-ts, ... |
| CAs | ca.org1, ca.org2 | ca-cclb, ca-ts, ... |
| Crypto | Generated by test-network scripts | Generated by setup-network.sh |

Backend changes:
1. Connection profiles: New connection-cclb.yaml and connection-state-ts.yaml
2. Channel selection: Backend now routes to specific channels
3. Organization context: All paths use custom org domains

See [MIGRATION_GUIDE.md](../../MIGRATION_GUIDE.md) for detailed migration steps.

## Security Considerations

1. **TLS**: All communication encrypted (client, peer-to-peer, orderer cluster)
2. **MSP**: Strict identity verification and role-based access control
3. **CAs**: Persistent databases for identity management
4. **Ledger**: Immutable transaction history with audit trail

For production:
- Use Fabric CA for dynamic identity enrollment
- Implement RBAC with attributes (role=citizen, registrar, etc.)
- Use external ordering service for HA (multiple orderer nodes)
- Setup Fabric API Gateway for higher-level abstractions
- Enable monitoring and audit logging

## References

- [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/)
- [Fabric Network Architecture](https://hyperledger-fabric.readthedocs.io/en/latest/network_component.html)
- [Fabric CA User's Guide](https://hyperledger-fabric-ca.readthedocs.io/)
