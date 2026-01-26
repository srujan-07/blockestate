# Production-Grade Land Registry System

## Architecture Overview

This is a production-ready **blockchain-backed land registry system** combining:

- **Hyperledger Fabric**: System of record (blockchain layer)
  - Immutable ownership records
  - Atomic Property ID generation
  - Transaction history
  - Event emission for audit trail
  
- **Supabase (PostgreSQL)**: Fast retrieval layer (off-chain)
  - Document metadata and file URLs
  - Human-readable land details
  - Indexed searches (district, survey number)
  - Verification status tracking

- **REST API**: Orchestration layer
  - Transparent merging of blockchain + off-chain data
  - Role-based transaction validation
  - Clear data source attribution

---

## Data Model

### Property ID Format (Blockchain-Generated)

```
LRI-IND-<STATE>-<YEAR>-<SEQUENCE>

Examples:
  LRI-IND-TS-2026-000001  (Telangana, 2026, 1st property)
  LRI-IND-AP-2026-000234  (Andhra Pradesh, 2026, 234th property)
```

**Generated atomically inside chaincode** — no duplicates possible, globally unique.

### Chaincode Data Structures

#### LandRecord (Blockchain State)

```go
type LandRecord struct {
    PropertyID   string  // LRI-IND-<STATE>-<YEAR>-<SEQUENCE>
    Owner        string  // Current owner name
    SurveyNo     string  // Unique survey number
    District     string  // Administrative district
    Mandal       string  // Sub-district
    Village      string  // Village name
    Area         string  // Land area (e.g., "240 sq.yds")
    LandType     string  // "Residential", "Agricultural", etc.
    MarketValue  string  // Current market value
    LastUpdated  string  // ISO date of last change
    IPFSCID      string  // IPFS CID for document hash (optional)
}
```

**On Blockchain**: These are immutable once committed. State changes create new transaction history entries.

#### Land Record (Supabase)

```sql
CREATE TABLE land_records (
    id UUID PRIMARY KEY,
    property_id VARCHAR UNIQUE,           -- LRI-IND-...
    survey_no VARCHAR,
    district VARCHAR,
    mandal VARCHAR,
    village VARCHAR,
    owner VARCHAR,
    area VARCHAR,
    land_type VARCHAR,
    market_value VARCHAR,
    transaction_id VARCHAR,               -- Fabric TX ID
    block_number INTEGER,
    ipfs_cid VARCHAR,
    verification_status VARCHAR,          -- "pending", "verified", "failed"
    last_updated TIMESTAMP,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_property_id ON land_records(property_id);
CREATE INDEX idx_district_mandal_village ON land_records(district, mandal, village);
CREATE INDEX idx_survey_no ON land_records(survey_no);
```

**Off-Chain**: Metadata for fast search and indexing. Supabase is NEVER the source of truth.

---

## API Specification

### Initialization

All operations require backend initialization:

```javascript
const LandRegistryAPI = require('./services/LandRegistryAPI');

const api = new LandRegistryAPI();
await api.initialize('registrar1');  // Use specified Fabric identity
```

### RETRIEVAL ENDPOINTS

#### 1. Get Property by Property ID

**Endpoint**: `GET /api/v1/property/:propertyId`

**Query Parameters**:
- `verifyOnChain=true` (default): Verify data on Fabric blockchain
- `includeHistory=true`: Include transaction history

**Example Request**:
```bash
curl -X GET "http://localhost:4000/api/v1/property/LRI-IND-TS-2026-000001?verifyOnChain=true&includeHistory=true"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "propertyId": "LRI-IND-TS-2026-000001",
    "source": {
      "blockchain": "verified",
      "offchain": "available"
    },
    "blockchain": {
      "owner": "Ravi Kumar",
      "surveyNo": "123/A",
      "district": "Hyderabad",
      "mandal": "Ghatkesar",
      "village": "Boduppal",
      "area": "240 sq.yds",
      "landType": "Residential",
      "marketValue": "45,00,000",
      "lastUpdated": "2026-01-15",
      "verificationBadge": "✅ BLOCKCHAIN-VERIFIED"
    },
    "offchain": {
      "id": "uuid-123",
      "transactionId": "fabric-tx-abc",
      "blockNumber": 42,
      "verificationStatus": "verified"
    },
    "mergedView": {
      "propertyId": "LRI-IND-TS-2026-000001",
      "owner": "Ravi Kumar",
      "surveyNo": "123/A",
      "isBlockchainVerified": true
    },
    "transactionHistory": [
      {
        "txId": "fabric-tx-abc",
        "value": "{...}", 
        "timestamp": 1673876400
      }
    ]
  }
}
```

#### 2. Search by Land Attributes

**Endpoint**: `POST /api/v1/search/by-attributes`

**Request Body**:
```json
{
  "district": "Hyderabad",
  "mandal": "Ghatkesar",
  "village": "Boduppal",
  "surveyNo": "123/A"
}
```

**Response**:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "propertyId": "LRI-IND-TS-2026-000001",
      "surveyNo": "123/A",
      "district": "Hyderabad",
      "owner": "Ravi Kumar",
      "isBlockchainVerified": true,
      "verificationBadge": "✅"
    }
  ]
}
```

**Flow**:
1. Query Supabase (fast, indexed)
2. Verify each result on Fabric blockchain
3. Merge and return

#### 3. Full-Text Search

**Endpoint**: `POST /api/v1/search/by-text`

**Request Body**:
```json
{
  "searchTerm": "Hyderabad"
}
```

**Response**: Same as attribute search

### TRANSACTION ENDPOINTS

#### 1. Create Property

**Endpoint**: `POST /api/v1/property/create`

**Headers**:
```
Authorization: Bearer registrar1  # Fabric identity
```

**Request Body**:
```json
{
  "owner": "Ravi Kumar",
  "surveyNo": "123/A",
  "district": "Hyderabad",
  "mandal": "Ghatkesar",
  "village": "Boduppal",
  "area": "240 sq.yds",
  "landType": "Residential",
  "marketValue": "45,00,000",
  "state": "Telangana",
  "ipfsCID": "QmXx..." (optional)
}
```

**Response**:
```json
{
  "success": true,
  "propertyId": "LRI-IND-TS-2026-000001",
  "transactionId": "fabric-tx-abc123",
  "data": {
    "propertyId": "LRI-IND-TS-2026-000001",
    "owner": "Ravi Kumar",
    ...
  }
}
```

**Flow**:
1. Validate caller role (registrar)
2. Generate atomic Property ID in Fabric
3. Create property in blockchain
4. Emit PropertyCreatedEvent
5. **Asynchronously** index in Supabase

#### 2. Transfer Property

**Endpoint**: `POST /api/v1/property/transfer`

**Request Body**:
```json
{
  "propertyId": "LRI-IND-TS-2026-000001",
  "newOwner": "Suma Reddy",
  "approvalStatus": "approved"  // or "rejected", "pending"
}
```

**Response**:
```json
{
  "success": true,
  "propertyId": "LRI-IND-TS-2026-000001",
  "transactionId": "fabric-tx-def456"
}
```

**Flow**:
1. Validate registrar role
2. Update property owner in Fabric
3. Emit PropertyTransferredEvent + PropertyApprovedEvent
4. **Asynchronously** update Supabase

### DOCUMENT ENDPOINTS

#### 1. Link Document to Property

**Endpoint**: `POST /api/v1/document/link`

**Request Body**:
```json
{
  "propertyId": "LRI-IND-TS-2026-000001",
  "documentHash": "sha256_hash_of_document",
  "documentType": "title_deed",
  "fileUrl": "https://storage.supabase.co/..."
}
```

**Response**:
```json
{
  "success": true,
  "propertyId": "LRI-IND-TS-2026-000001"
}
```

**Flow**:
1. Store document hash reference on Fabric blockchain
2. Emit DocumentLinkedEvent
3. **Asynchronously** store metadata in Supabase

#### 2. Get Property Documents

**Endpoint**: `GET /api/v1/property/:propertyId/documents`

**Response**:
```json
{
  "success": true,
  "propertyId": "LRI-IND-TS-2026-000001",
  "documents": [
    {
      "hash": "sha256_hash",
      "type": "title_deed",
      "fileUrl": "https://...",
      "uploadedAt": "2026-01-15T10:00:00Z",
      "verifiedOnChain": true
    }
  ]
}
```

### ADMIN ENDPOINTS

#### 1. Get Configuration

**Endpoint**: `GET /api/v1/config`

**Response**:
```json
{
  "success": true,
  "data": {
    "activeNetwork": "test-network",
    "activeChannel": "mychannel",
    "availableNetworks": ["test-network", "multi-org-network", "audit-network"],
    "availableChannels": ["mychannel", "land-registry-channel", "audit-channel"],
    "currentConfig": {
      "network": { ... },
      "channel": { ... }
    }
  }
}
```

#### 2. Switch Network

**Endpoint**: `POST /api/v1/config/switch-network`

**Request Body**:
```json
{
  "networkName": "audit-network",
  "channelName": "audit-channel"  // optional
}
```

**Response**:
```json
{
  "success": true,
  "active": { ... }
}
```

#### 3. Health Check

**Endpoint**: `GET /api/v1/health`

**Response**:
```json
{
  "healthy": true,
  "fabric": {
    "healthy": true,
    "identity": "registrar1",
    "channel": "mychannel",
    "connected": true
  },
  "supabase": {
    "healthy": true
  }
}
```

---

## Service Layer Architecture

### 1. FabricService

**File**: `services/FabricService.js`

Handles:
- Fabric connection & identity management
- Transaction submission (submitTransaction)
- Read operations (evaluateTransaction)
- Production configuration (discovery disabled)

**Usage**:
```javascript
const fabric = new FabricService({
  chaincodeName: 'landregistry',
  channelName: 'mychannel',
  discoveryEnabled: false,  // Production mode
});

await fabric.connect('registrar1');

// Submit transaction
const result = await fabric.submitTransaction('CreateLandRecord', ...args);

// Query read-only
const record = await fabric.evaluateTransaction('ReadLandRecord', propertyId);
```

### 2. SupabaseService

**File**: `services/SupabaseService.js`

Handles:
- Fast retrieval (indexed PostgreSQL queries)
- Document metadata storage
- Async updates after Fabric commits
- Verification status tracking

**Usage**:
```javascript
const supabase = new SupabaseService();

// Fast lookup
const record = await supabase.queryByPropertyId('LRI-IND-TS-2026-000001');

// Indexed search
const results = await supabase.queryByAttributes({
  district: 'Hyderabad',
  surveyNo: '123/A'
});

// Async indexing after Fabric commit
await supabase.insertRecord({
  propertyId,
  owner,
  surveyNo,
  ...
});
```

### 3. NetworkConfig

**File**: `services/NetworkConfig.js`

Manages:
- Multiple network configurations
- Channel switching
- Network/channel profiles

**Usage**:
```javascript
const { getNetworkConfig } = require('./services/NetworkConfig');
const config = getNetworkConfig();

// Switch network
config.switchNetwork('audit-network', 'audit-channel');

// Get current
const active = config.getActiveConfig();
```

### 4. LandRegistryAPI

**File**: `services/LandRegistryAPI.js`

Orchestrates:
- Data retrieval (Supabase + Fabric merge)
- Transactions (Fabric + async Supabase)
- Document linking
- Comprehensive error handling

**Usage**:
```javascript
const api = new LandRegistryAPI();
await api.initialize('registrar1');

// Retrieve with verification
const result = await api.getPropertyById('LRI-IND-TS-2026-000001', {
  verifyOnChain: true,
  includeHistory: true
});

// Create property
const created = await api.createProperty({
  owner: 'Ravi Kumar',
  surveyNo: '123/A',
  ...
});
```

---

## Chaincode Functions

### 1. GeneratePropertyID
- Generates atomic, globally unique Property IDs
- Format: `LRI-IND-<STATE>-<YEAR>-<SEQUENCE>`
- Increments sequence per state/year

### 2. CreateLandRecord
- **Role required**: `registrar`
- Auto-generates Property ID
- Validates caller role via X.509 attributes
- Emits `PropertyCreatedEvent`
- Returns new LandRecord

### 3. ReadLandRecord
- Query property by Property ID
- Read-only operation
- No role required for citizens

### 4. TransferLandRecord
- **Role required**: `registrar`
- Updates owner
- Emits `PropertyTransferredEvent` + `PropertyApprovedEvent`
- Returns updated record

### 5. LinkDocumentHash
- **Role required**: `registrar`
- Stores document hash reference
- Emits `DocumentLinkedEvent`
- Audit trail for all documents

### 6. GetTransactionHistory
- Query historical state changes
- Returns all transaction versions
- Immutable audit trail

---

## Data Flow Diagrams

### Retrieval Flow

```
Frontend Request
    |
    v
Backend API (GET /property/:id)
    |
    +--- Query Supabase (fast indexed lookup)
    |         |
    |         v
    |    Document metadata
    |
    +--- Verify on Blockchain (if enabled)
    |         |
    |         v
    |    Fabric ledger (immutable source)
    |
    +--- Merge & Attribute
    |         |
    |         v Response:
    |    - Blockchain-verified fields ✅
    |    - Off-chain fields
    |    - Transaction history
    |    - Verification badge
    v
Frontend
```

### Transaction Flow

```
Frontend Request (POST /property/create)
    |
    v
Backend API validates role
    |
    v
Fabric Submit Transaction
    |
    +--- Atomic Property ID generation
    +--- Create property record
    +--- Emit event
    +--- Return transactionId ✅
    |
    v
Respond to frontend immediately (fast)
    |
    v (Asynchronous background)
Supabase Update (index for search)
    |
    v
Event Listener (optional)
    |
    v
Audit Trail logging
```

---

## Configuration & Deployment

### Environment Variables

```bash
# Supabase
export SUPABASE_URL="https://xyz.supabase.co"
export SUPABASE_KEY="your-api-key"

# Fabric
export FABRIC_WALLET_PATH="./wallet"
export FABRIC_CCP_PATH="./config/connection-org1.yaml"

# Backend
export PORT=4000
export NODE_ENV=production
```

### Network Configurations

**Supported Networks** (configured in `NetworkConfig.js`):

1. **test-network** (default)
   - Single org (Org1)
   - Channel: `mychannel`
   - Chaincode: `landregistry`

2. **multi-org-network**
   - Multiple organizations
   - Channel: `land-registry-channel`
   - Endorsement: MAJORITY

3. **audit-network**
   - Separate channel for analytics
   - Channel: `audit-channel`
   - Endorsement: ALL

**Switch at runtime**:
```bash
curl -X POST http://localhost:4000/api/v1/config/switch-network \
  -H "Content-Type: application/json" \
  -d '{"networkName":"audit-network", "channelName":"audit-channel"}'
```

---

## Error Handling

### Fabric Errors

| Error | Cause | Resolution |
|-------|-------|-----------|
| Identity not found | Wallet missing identity | Run `node addUserToWallet.js` |
| Connection failed | Network unreachable | Check Fabric network status |
| Role attribute missing | No role in X.509 cert | Enroll with proper attributes |
| Record exists | Duplicate Property ID | Property already registered |

### Supabase Errors

| Error | Cause | Resolution |
|-------|-------|-----------|
| SUPABASE_URL not set | Env var missing | Configure `.env` |
| Connection failed | Database down | Check Supabase status |
| Unique constraint | Duplicate property_id | Check blockchain first |

### API Errors

| Status | Error | Solution |
|--------|-------|----------|
| 400 | Missing required fields | Check request body |
| 401 | Invalid identity | Check Authorization header |
| 404 | Property not found | Verify Property ID format |
| 500 | Fabric/Supabase error | Check logs, retry |

---

## Testing

### Unit Tests (Suggested)

```javascript
// Test property retrieval
test('Get property by ID with blockchain verification', async () => {
  const api = new LandRegistryAPI();
  await api.initialize('registrar1');
  
  const result = await api.getPropertyById('LRI-IND-TS-2026-000001', {
    verifyOnChain: true
  });
  
  expect(result.blockchain).toBeDefined();
  expect(result.mergedView.isBlockchainVerified).toBe(true);
});

// Test property creation
test('Create property generates unique ID', async () => {
  const api = new LandRegistryAPI();
  await api.initialize('registrar1');
  
  const result1 = await api.createProperty({...});
  const result2 = await api.createProperty({...});
  
  expect(result1.propertyId).not.toEqual(result2.propertyId);
});
```

### Integration Tests

- End-to-end property creation + retrieval
- Ownership transfer + verification
- Document linking + audit trail
- Network switching

---

## Production Checklist

- [x] Property ID generation is atomic (no duplicates)
- [x] Supabase never source of truth (Fabric is)
- [x] Discovery disabled (production mode)
- [x] Role validation via X.509 attributes
- [x] Events emitted for all state changes
- [x] Async Supabase updates (don't block transactions)
- [x] Clear error handling & logging
- [x] Network/channel configuration is flexible
- [x] API responses mark blockchain-verified fields
- [x] Transaction history immutable on ledger
- [ ] TLS enabled for Fabric connections
- [ ] JWT authentication for API (extend validateIdentity middleware)
- [ ] Rate limiting on endpoints
- [ ] Audit logging to persistent store
- [ ] Backup strategy for Supabase
- [ ] Monitoring & alerting setup

---

## Future Enhancements

1. **Multi-signature approval**: Require 2/3 registrars for major transfers
2. **Smart contract upgrades**: Versioned chaincode with migration logic
3. **Zero-knowledge proofs**: Verify ownership without revealing details
4. **Cross-chain interop**: Link land registries across states
5. **Mobile app**: React Native with offline-first capability
6. **AI-based fraud detection**: Anomaly detection on transfers
7. **Integrations**: Bank APIs for mortgage verification

---

## Support & Debugging

### View Blockchain Transactions
```bash
# Using Fabric Explorer or logs
docker logs peer0.org1.example.com | grep "land registry"
```

### Debug Supabase Queries
```javascript
const { data, error } = await supabase
  .from('land_records')
  .select('*')
  .eq('property_id', propertyId);

if (error) console.error('Supabase error:', error);
```

### Check Configuration
```bash
curl http://localhost:4000/api/v1/config | jq .
```

---

**Created**: January 2026  
**Status**: Production-Ready  
**Last Updated**: January 16, 2026
