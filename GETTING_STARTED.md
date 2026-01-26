# Production Land Registry System - Getting Started

## System Requirements

- Node.js 16+ 
- Docker & Docker Compose
- Hyperledger Fabric 2.x with test-network running
- Supabase account with PostgreSQL database
- Git

## Quick Start

### 1. Configure Environment

Create `.env` file in project root:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-anon-public-key

# Fabric Configuration  
FABRIC_WALLET_PATH=./realestate2/backend/wallet
FABRIC_CCP_PATH=./realestate2/backend/config/connection-org1.yaml

# Backend
PORT=4000
NODE_ENV=production
```

### 2. Start Fabric Network

```bash
cd fabric-samples/test-network

# Start network
./network.sh up createChannel -c mychannel

# Deploy chaincode
./network.sh deployCC -ccn landregistry -ccv 1.0 \
  -ccp ../../chaincode/land-registry \
  -ccl go
```

### 3. Create Fabric Identities

```bash
cd realestate2/backend

# Enroll admin
node addAdminToWallet.js

# Enroll registrar
node addUserToWallet.js registrar1 registrar

# Enroll citizen  
node addUserToWallet.js citizen1 citizen
```

### 4. Setup Supabase Database

```sql
-- Run these queries in Supabase SQL Editor

-- Create land_records table
CREATE TABLE land_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id VARCHAR(50) UNIQUE NOT NULL,
  survey_no VARCHAR(50),
  district VARCHAR(100),
  mandal VARCHAR(100),
  village VARCHAR(100),
  owner VARCHAR(200),
  area VARCHAR(50),
  land_type VARCHAR(50),
  market_value VARCHAR(100),
  transaction_id VARCHAR(100),
  block_number INTEGER,
  ipfs_cid VARCHAR(100),
  verification_status VARCHAR(20) DEFAULT 'pending',
  last_updated TIMESTAMP,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX idx_property_id ON land_records(property_id);
CREATE INDEX idx_district_mandal_village ON land_records(district, mandal, village);
CREATE INDEX idx_survey_no ON land_records(survey_no);
CREATE INDEX idx_verification_status ON land_records(verification_status);

-- Create document_metadata table
CREATE TABLE document_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id VARCHAR(50) NOT NULL,
  document_hash VARCHAR(100) NOT NULL,
  document_type VARCHAR(50),
  file_url TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  verified_on_chain BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (property_id) REFERENCES land_records(property_id)
);

CREATE INDEX idx_doc_property_id ON document_metadata(property_id);
```

### 5. Build Chaincode

```bash
cd chaincode/land-registry

# Verify files exist
ls -la property_id_generator.go events.go land_record.go

# Build
go mod tidy
go build -o landregistry

# Verify build succeeded
echo $?  # Should output: 0
```

### 6. Start Backend Server

```bash
cd realestate2/backend

# Install dependencies
npm install

# Start production server
node api-server.js
```

**Expected output**:
```
============================================================
✅ Land Registry Backend Server started on port 4000
============================================================

📡 DATA LAYERS:
  🔗 Blockchain: Hyperledger Fabric (System of Record)
  ☁️  Off-chain: Supabase PostgreSQL (Fast Retrieval)
  🔍 Search: Full-text + Attribute-based

🔌 API ENDPOINTS:
  RETRIEVAL:
    GET  /api/v1/property/:propertyId
    ...

🌐 Visit http://localhost:4000/api/v1/health to check status
```

### 7. Verify System Health

```bash
# Check health
curl http://localhost:4000/api/v1/health

# Expected response:
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

## API Usage Examples

### Create Property

```bash
curl -X POST http://localhost:4000/api/v1/property/create \
  -H "Authorization: Bearer registrar1" \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "Ravi Kumar",
    "surveyNo": "123/A",
    "district": "Hyderabad",
    "mandal": "Ghatkesar",
    "village": "Boduppal",
    "area": "240 sq.yds",
    "landType": "Residential",
    "marketValue": "45,00,000",
    "state": "Telangana"
  }'
```

**Response**:
```json
{
  "success": true,
  "propertyId": "LRI-IND-TS-2026-000001",
  "transactionId": "abc123...",
  "data": {
    "propertyId": "LRI-IND-TS-2026-000001",
    "owner": "Ravi Kumar",
    "surveyNo": "123/A",
    ...
  }
}
```

### Retrieve Property

```bash
curl -X GET "http://localhost:4000/api/v1/property/LRI-IND-TS-2026-000001?verifyOnChain=true&includeHistory=true"
```

### Search by Attributes

```bash
curl -X POST http://localhost:4000/api/v1/search/by-attributes \
  -H "Content-Type: application/json" \
  -d '{
    "district": "Hyderabad",
    "surveyNo": "123/A"
  }'
```

### Transfer Property

```bash
curl -X POST http://localhost:4000/api/v1/property/transfer \
  -H "Authorization: Bearer registrar1" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "LRI-IND-TS-2026-000001",
    "newOwner": "Suma Reddy",
    "approvalStatus": "approved"
  }'
```

### Link Document

```bash
curl -X POST http://localhost:4000/api/v1/document/link \
  -H "Authorization: Bearer registrar1" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "LRI-IND-TS-2026-000001",
    "documentHash": "sha256abcd1234...",
    "documentType": "title_deed",
    "fileUrl": "https://storage.supabase.co/..."
  }'
```

## Configuration

### Switch Network/Channel

```bash
# View current config
curl http://localhost:4000/api/v1/config

# Switch to audit network
curl -X POST http://localhost:4000/api/v1/config/switch-network \
  -H "Content-Type: application/json" \
  -d '{
    "networkName": "audit-network",
    "channelName": "audit-channel"
  }'
```

### Supported Networks (in NetworkConfig.js)

1. **test-network** (default)
   - Channel: `mychannel`
   - Chaincode: `landregistry`

2. **multi-org-network**
   - Channel: `land-registry-channel`
   - Chaincode: `land-registry-chaincode`

3. **audit-network**
   - Channel: `audit-channel`
   - Chaincode: `audit-ledger`

## Monitoring

### View Logs

```bash
# Fabric chaincode logs
docker logs peer0.org1.example.com

# Backend server logs
# (Check terminal where api-server.js is running)

# Watch Supabase logs
# (Visit Supabase dashboard)
```

### Database Queries

```javascript
// Check land records
SELECT property_id, owner, verification_status 
FROM land_records 
ORDER BY created_at DESC 
LIMIT 10;

// Check documents
SELECT property_id, document_type, uploaded_at 
FROM document_metadata 
ORDER BY uploaded_at DESC;
```

## Troubleshooting

### Issue: Connection Failed

```
❌ Connection failed: Identity 'registrar1' not found
```

**Solution**:
```bash
# Enroll identity
node addUserToWallet.js registrar1 registrar

# Verify wallet
ls -la wallet/  # Should contain registrar1
```

### Issue: Property ID Not Generated

```
Error: failed to generate Property ID
```

**Solution**:
1. Check Fabric network is running
2. Verify chaincode has property_id_generator.go
3. Check state parameter is valid state name

### Issue: Supabase Connection Error

```
❌ SupabaseService: Missing SUPABASE_URL or SUPABASE_KEY
```

**Solution**:
```bash
# Set environment variables
export SUPABASE_URL="https://..."
export SUPABASE_KEY="..."

# Or add to .env
echo "SUPABASE_URL=..." >> .env
echo "SUPABASE_KEY=..." >> .env
```

### Issue: Blockchain Property Not Found

```
Error: property LRI-IND-TS-2026-000001 does not exist
```

**Solution**:
1. Create property first: `POST /api/v1/property/create`
2. Wait a moment for blockchain confirmation
3. Then retrieve: `GET /api/v1/property/LRI-IND-TS-2026-000001`

## Testing

### Test with JavaScript (Node.js)

```javascript
const fetch = require('node-fetch');

async function testAPI() {
  // 1. Create property
  const createRes = await fetch('http://localhost:4000/api/v1/property/create', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer registrar1',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      owner: 'Test Owner',
      surveyNo: '999/Z',
      district: 'Hyderabad',
      mandal: 'Test',
      village: 'TestVillage',
      area: '100 sq.yds',
      landType: 'Residential',
      marketValue: '10,00,000',
      state: 'Telangana'
    })
  });
  
  const created = await createRes.json();
  console.log('Created:', created);
  
  // 2. Retrieve property
  const getRes = await fetch(
    `http://localhost:4000/api/v1/property/${created.propertyId}`
  );
  
  const retrieved = await getRes.json();
  console.log('Retrieved:', retrieved);
  
  // 3. Search
  const searchRes = await fetch(
    'http://localhost:4000/api/v1/search/by-attributes',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        district: 'Hyderabad',
        surveyNo: '999/Z'
      })
    }
  );
  
  const results = await searchRes.json();
  console.log('Search results:', results);
}

testAPI().catch(console.error);
```

### Test with Postman

1. Import the API endpoints into Postman collection
2. Create environment with:
   - `base_url`: http://localhost:4000
   - `identity`: registrar1
3. Run requests in order: Create → Search → Retrieve → Transfer

## Production Deployment

### Docker Container

```dockerfile
FROM node:16-alpine

WORKDIR /app
COPY . .

RUN npm ci --only=production

EXPOSE 4000

ENV NODE_ENV=production

CMD ["node", "api-server.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "4000:4000"
    environment:
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_KEY: ${SUPABASE_KEY}
      PORT: 4000
      NODE_ENV: production
    volumes:
      - ./wallet:/app/wallet
      - ./config:/app/config
    depends_on:
      - fabric-network

  fabric-network:
    image: hyperledger/fabric-peer:latest
    # ... fabric configuration
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: land-registry-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: land-registry-backend
  template:
    metadata:
      labels:
        app: land-registry-backend
    spec:
      containers:
      - name: backend
        image: land-registry:latest
        ports:
        - containerPort: 4000
        env:
        - name: SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: supabase-creds
              key: url
        - name: SUPABASE_KEY
          valueFrom:
            secretKeyRef:
              name: supabase-creds
              key: key
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
```

## Performance Tuning

### Supabase Indexing

```sql
-- Already created, but verify:
CREATE INDEX idx_property_id ON land_records(property_id);
CREATE INDEX idx_district_mandal_village ON land_records(district, mandal, village);
CREATE INDEX idx_verification_status ON land_records(verification_status);

-- Analyze query plans
EXPLAIN ANALYZE
SELECT * FROM land_records 
WHERE district = 'Hyderabad' AND survey_no = '123/A';
```

### Fabric Performance

- Use batch transactions when creating multiple properties
- Enable caching for repeated reads
- Consider connection pooling for high throughput

### Backend Optimization

```javascript
// Connection pooling
const fabricPool = new FabricServicePool({
  min: 5,
  max: 20
});

// Caching (optional)
const cache = new LRU({ max: 1000 });
```

## Security Considerations

- [ ] Enable TLS for Fabric connections
- [ ] Use JWT tokens for API authentication
- [ ] Implement rate limiting
- [ ] Encrypt sensitive data in transit
- [ ] Regular security audits
- [ ] Backup and disaster recovery
- [ ] GDPR compliance for personal data
- [ ] Access control via Fabric X.509 certs

## Next Steps

1. **Read ARCHITECTURE.md** - Deep dive into system design
2. **Review MIGRATION_GUIDE.md** - If upgrading from legacy system
3. **Check chaincode/land-registry/*.go** - Smart contract implementation
4. **Review services/** - Service layer implementation
5. **Explore api-server.js** - REST API implementation

## Support

For issues or questions:

1. Check logs: `docker logs <container>`
2. Verify health: `curl /api/v1/health`
3. Test chaincode: Use Fabric test networks
4. Check Supabase dashboard
5. Review error messages in API responses

---

**Last Updated**: January 16, 2026  
**Version**: 1.0.0 Production  
**Status**: Ready for deployment
