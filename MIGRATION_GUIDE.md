# Migration Guide: Legacy to Production-Grade System

## Overview

This guide helps you migrate from the existing demo implementation to the production-grade system.

## Key Changes

### 1. Chaincode Updates

#### Old Property Creation
```go
// ❌ OLD: Property ID was passed in
CreateLandRecord(ctx, propertyID, owner, surveyNo, ...)
```

#### New Property Creation
```go
// ✅ NEW: Property ID auto-generated atomically
CreateLandRecord(ctx, owner, surveyNo, district, mandal, village, area, landType, marketValue, state, ipfsCID)
// Returns: *LandRecord with auto-generated propertyId
```

**Action Required**:
- Remove `propertyID` parameter from all caller code
- Provide `state` parameter (Telangana, Andhra Pradesh, etc.)
- Expect Property ID in response

#### New Chaincode Functions
```go
// Atomic ID generation
GeneratePropertyID(ctx, state) // Returns: "LRI-IND-TS-2026-000001"

// Ownership transfer with events
TransferLandRecord(ctx, propertyId, newOwner, approvalStatus)

// Document linking
LinkDocumentHash(ctx, propertyId, documentHash, documentType)

// Transaction history
GetTransactionHistory(ctx, propertyId)
```

### 2. Backend Service Layer

#### Old Approach
```javascript
// ❌ OLD: Direct Fabric calls mixed with Supabase
const { getContract } = require('./fabric');
const contract = await getContract('registrar1');
const result = await contract.submitTransaction('CreateLandRecord', ...);
```

#### New Approach
```javascript
// ✅ NEW: Use service layer
const LandRegistryAPI = require('./services/LandRegistryAPI');

const api = new LandRegistryAPI();
await api.initialize('registrar1');

// Handles all orchestration
const result = await api.createProperty({
  owner,
  surveyNo,
  district,
  mandal,
  village,
  area,
  landType,
  marketValue,
  state,
  ipfsCID
});
```

### 3. API Endpoints

#### Old Endpoints (in server.js)
```javascript
// ❌ OLD: Mixed and unclear data sources
POST /land/query-by-survey
POST /land/query-by-id
GET /land/all
```

#### New Endpoints
```javascript
// ✅ NEW: Clear, versioned API with proper structure
GET /api/v1/property/:propertyId
GET /api/v1/property/:propertyId/overview
POST /api/v1/search/by-attributes
POST /api/v1/search/by-text
POST /api/v1/property/create
POST /api/v1/property/transfer
POST /api/v1/document/link
GET /api/v1/property/:propertyId/documents
GET /api/v1/config
POST /api/v1/config/switch-network
GET /api/v1/health
```

#### Response Format

Old response:
```json
{
  "id": 123,
  "propertyId": "PROP-1001",
  "surveyNo": "123/A",
  "source": "Supabase (Citizen Space)"
}
```

New response:
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
      "verificationBadge": "✅ BLOCKCHAIN-VERIFIED"
    },
    "offchain": {
      "transactionId": "fabric-tx-abc",
      "verificationStatus": "verified"
    },
    "mergedView": {
      "propertyId": "LRI-IND-TS-2026-000001",
      "isBlockchainVerified": true
    }
  }
}
```

## Step-by-Step Migration

### Phase 1: Deploy New Chaincode

1. **Backup current chaincode**
   ```bash
   cp -r chaincode/land-registry chaincode/land-registry.bak
   ```

2. **Update chaincode with new files**
   - Add `property_id_generator.go`
   - Add `events.go`
   - Update `land_record.go` with new CreateLandRecord signature
   - Add TransferLandRecord, LinkDocumentHash, GetTransactionHistory

3. **Test locally**
   ```bash
   cd chaincode/land-registry
   go mod tidy
   go build
   ```

4. **Deploy to Fabric**
   ```bash
   # Package and install new chaincode version
   # (Follow your deployment process)
   ```

### Phase 2: Deploy New Backend Services

1. **Create services directory**
   ```bash
   mkdir -p realestate2/backend/services
   ```

2. **Add service files**
   - `services/FabricService.js`
   - `services/SupabaseService.js`
   - `services/NetworkConfig.js`
   - `services/LandRegistryAPI.js`

3. **Create new API server**
   - `api-server.js` (new production server)
   - Keep old `server.js` for gradual migration

4. **Test services individually**
   ```javascript
   // Test FabricService
   const FabricService = require('./services/FabricService');
   const fabric = new FabricService();
   await fabric.connect('registrar1');
   const health = await fabric.healthCheck();
   console.log(health);
   ```

### Phase 3: Migrate Frontend

#### Old Frontend Code
```javascript
// ❌ OLD: Direct Supabase calls
fetch('/land/query-by-survey', {
  method: 'POST',
  body: JSON.stringify({ district, mandal, village, surveyNo })
})
```

#### New Frontend Code
```javascript
// ✅ NEW: Use new API with proper authentication
const response = await fetch('/api/v1/search/by-attributes', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer registrar1',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ district, mandal, village, surveyNo })
});

const { success, data } = await response.json();
if (success) {
  // data contains verified + off-chain information
  properties.forEach(prop => {
    console.log(`${prop.propertyId}: ✅` if prop.isBlockchainVerified);
  });
}
```

#### Display Verification Badges
```jsx
// React Component
export function PropertyCard({ property }) {
  return (
    <div className="property">
      <h2>
        {property.propertyId}
        {property.isBlockchainVerified ? (
          <span title="Verified on Blockchain">✅</span>
        ) : (
          <span title="Pending Blockchain Confirmation">⏳</span>
        )}
      </h2>
      <p>Owner: {property.owner}</p>
      <p>Survey No: {property.surveyNo}</p>
      
      {/* Show blockchain-verified data */}
      {property.blockchain && (
        <section className="verified-data">
          <h3>Blockchain-Verified</h3>
          <p>Last Updated: {property.blockchain.lastUpdated}</p>
        </section>
      )}
      
      {/* Show off-chain metadata */}
      {property.offchain && (
        <section className="off-chain-data">
          <h3>Document Metadata</h3>
          <p>Transaction ID: {property.offchain.transactionId}</p>
        </section>
      )}
    </div>
  );
}
```

### Phase 4: Database Migration

#### Update Supabase Schema

```sql
-- Update existing table
ALTER TABLE land_records
ADD COLUMN verification_status VARCHAR DEFAULT 'pending',
ADD COLUMN transaction_id VARCHAR,
ADD COLUMN block_number INTEGER,
ADD COLUMN verified_at TIMESTAMP,
ADD UNIQUE(property_id);

CREATE INDEX idx_property_id ON land_records(property_id);
CREATE INDEX idx_verification_status ON land_records(verification_status);

-- Create document metadata table
CREATE TABLE document_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id VARCHAR NOT NULL,
  document_hash VARCHAR NOT NULL,
  document_type VARCHAR,
  file_url TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  verified_on_chain BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (property_id) REFERENCES land_records(property_id)
);

CREATE INDEX idx_doc_property_id ON document_metadata(property_id);
```

#### Migrate Existing Data

```sql
-- Map old format to new format
UPDATE land_records
SET property_id = 'LRI-IND-TS-2026-' || LPAD(CAST(id AS VARCHAR), 6, '0')
WHERE property_id LIKE 'PROP-%';

-- Mark existing records as verified (they're already in blockchain)
UPDATE land_records
SET verification_status = 'verified'
WHERE transaction_id IS NOT NULL;
```

### Phase 5: Parallel Running (Optional)

Run both servers simultaneously for testing:

```bash
# Terminal 1: Old server (for backward compatibility)
node server.js

# Terminal 2: New production server
node api-server.js
```

This allows:
- Gradual frontend migration
- Parallel testing
- Quick rollback if needed

### Phase 6: Monitoring & Validation

1. **Check new API health**
   ```bash
   curl http://localhost:4000/api/v1/health
   ```

2. **Validate data consistency**
   ```javascript
   // Compare blockchain vs Supabase
   const blockchainRecord = await api.fabric.evaluateTransaction('ReadLandRecord', id);
   const supabaseRecord = await api.supabase.queryByPropertyId(id);
   
   console.assert(
     blockchainRecord.owner === supabaseRecord.owner,
     'Owner mismatch!'
   );
   ```

3. **Verify event emission**
   ```bash
   # Check Fabric logs for events
   docker logs peer0.org1.example.com | grep "PropertyCreatedEvent"
   ```

---

## Backward Compatibility

### Wrapper for Old Endpoints

If you need to maintain old endpoints temporarily:

```javascript
// Backward compatibility layer
app.post('/land/query-by-survey', async (req, res) => {
  // Convert old request to new
  const response = await fetch('/api/v1/search/by-attributes', {
    method: 'POST',
    body: JSON.stringify(req.body)
  });
  
  const { data } = await response.json();
  
  // Convert new response to old format
  const oldFormat = {
    id: data[0].id,
    propertyId: data[0].propertyId,
    surveyNo: data[0].surveyNo,
    source: 'Supabase'
  };
  
  res.json(oldFormat);
});
```

---

## Verification Checklist

After migration:

- [ ] All chaincode functions work with new signatures
- [ ] Property IDs auto-generate correctly (LRI-IND-TS-2026-XXXXXX)
- [ ] Events are emitted for all state changes
- [ ] Supabase indexes new records asynchronously
- [ ] API merges blockchain + off-chain data correctly
- [ ] Verification badges display on frontend
- [ ] Ownership transfers update both systems
- [ ] Document linking works end-to-end
- [ ] Network switching works via admin API
- [ ] Error messages are clear and actionable
- [ ] Logs show proper flow (Fabric → Async Supabase)

---

## Rollback Plan

If issues occur:

1. **Keep old chaincode image**
   ```bash
   docker tag hyperledger/fabric-chaincode:latest old-lregistry:v1
   ```

2. **Revert to old API**
   ```bash
   # Kill new server
   kill %2  # if running in background
   
   # Use old server
   node server.js
   ```

3. **Restore database**
   ```bash
   # From backup
   psql -h supabase.co -d postgres -f backup.sql
   ```

---

## Support

For issues during migration:

1. Check logs: `docker logs <container>`
2. Verify configuration: `curl /api/v1/config`
3. Test services individually
4. Check Fabric network status: `docker ps`
5. Validate Supabase connection: `curl /api/v1/health`

