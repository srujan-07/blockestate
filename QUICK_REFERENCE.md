# Developer Quick Reference

## Quick Commands

### Start System
```bash
# 1. Start Fabric network
cd fabric-samples/test-network
./network.sh up createChannel -c mychannel

# 2. Deploy chaincode
./network.sh deployCC -ccn landregistry -ccv 1.0 \
  -ccp ../../chaincode/land-registry -ccl go

# 3. Create identities
cd realestate2/backend
node addAdminToWallet.js
node addUserToWallet.js registrar1 registrar

# 4. Start backend
node api-server.js
```

### Check Health
```bash
# API health
curl http://localhost:4000/api/v1/health

# Fabric status
docker logs peer0.org1.example.com | tail -20

# Supabase
curl http://localhost:4000/api/v1/health | jq .supabase
```

## API Quick Reference

### Create Property
```bash
curl -X POST http://localhost:4000/api/v1/property/create \
  -H "Authorization: Bearer registrar1" \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "Name",
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

### Get Property
```bash
curl http://localhost:4000/api/v1/property/LRI-IND-TS-2026-000001
```

### Search
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

## Chaincode Functions

| Function | Role | Input | Output |
|----------|------|-------|--------|
| CreateLandRecord | registrar | owner, surveyNo, district, mandal, village, area, landType, marketValue, state, ipfsCID | LandRecord |
| ReadLandRecord | any | propertyId | LandRecord |
| TransferLandRecord | registrar | propertyId, newOwner, approvalStatus | LandRecord |
| LinkDocumentHash | registrar | propertyId, documentHash, documentType | error |
| GetTransactionHistory | any | propertyId | Transaction[] |
| GeneratePropertyID | internal | state | propertyId |
| GetPropertyIDCounter | any | state | PropertyIDCounter |

## Service Layer API

### FabricService
```javascript
const fabric = new FabricService();
await fabric.connect('registrar1');
await fabric.submitTransaction('CreateLandRecord', ...args);
await fabric.evaluateTransaction('ReadLandRecord', id);
await fabric.switchIdentity('citizen1');
await fabric.disconnect();
```

### SupabaseService
```javascript
const supabase = new SupabaseService();
await supabase.queryByPropertyId('LRI-IND-TS-2026-000001');
await supabase.queryByAttributes({ district, mandal, village });
await supabase.searchByText('Hyderabad');
await supabase.insertRecord(data);
await supabase.updateRecord(propertyId, updates);
```

### LandRegistryAPI
```javascript
const api = new LandRegistryAPI();
await api.initialize('registrar1');
await api.getPropertyById(id, { verifyOnChain: true });
await api.searchByAttributes({ district, surveyNo });
await api.createProperty(data, identity);
await api.transferProperty(data, identity);
await api.linkDocument(data, identity);
```

## Property ID Format

```
LRI-IND-TS-2026-000001
│   │   │   │    │
│   │   │   │    └─ Sequence (6 digits, left-padded)
│   │   │   └────── Year
│   │   └────────── State code (2 letters)
│   └──────────────  Country (IND)
└────────────────── Land Registry Identifier
```

### Supported States
- TS = Telangana
- AP = Andhra Pradesh
- KA = Karnataka
- TN = Tamil Nadu
- MH = Maharashtra
- UP = Uttar Pradesh
- And 20+ others (see property_id_generator.go)

## Environment Variables

```bash
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_KEY=your-anon-key
FABRIC_WALLET_PATH=./wallet
FABRIC_CCP_PATH=./config/connection-org1.yaml
PORT=4000
NODE_ENV=production
```

## Debugging

### View Chaincode Logs
```bash
docker logs peer0.org1.example.com | grep landregistry
```

### Check Fabric State
```bash
# List all properties
curl http://localhost:4000/api/v1/property/LRI-IND-TS-2026-000001

# View transaction history
curl "http://localhost:4000/api/v1/property/LRI-IND-TS-2026-000001/overview"
```

### Supabase Query
```sql
SELECT property_id, owner, verification_status 
FROM land_records 
ORDER BY created_at DESC 
LIMIT 10;
```

### Test Service Layer Directly
```javascript
const FabricService = require('./services/FabricService');
const fabric = new FabricService();
await fabric.connect('admin');
const health = await fabric.healthCheck();
console.log(health);
```

## Response Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | GET property succeeded |
| 201 | Created | POST create property succeeded |
| 400 | Bad Request | Missing required fields |
| 401 | Unauthorized | Invalid identity |
| 404 | Not Found | Property doesn't exist |
| 500 | Server Error | Fabric/Supabase failure |
| 503 | Unavailable | Fabric or Supabase down |

## Common Errors & Solutions

| Error | Cause | Fix |
|-------|-------|-----|
| Identity not found | Wallet missing | Run addUserToWallet.js |
| Connection failed | Fabric down | Start ./network.sh up |
| Role attribute missing | No role in cert | Enroll with role |
| SUPABASE_URL missing | No env var | Add to .env |
| Property not found | Never created | POST /create first |
| Duplicate property_id | Already exists | Use different state/year |

## File Locations

| What | Where |
|------|-------|
| Chaincode | chaincode/land-registry/*.go |
| Backend services | realestate2/backend/services/*.js |
| API server | realestate2/backend/api-server.js |
| Fabric config | realestate2/backend/config/*.yaml |
| Wallet | realestate2/backend/wallet/ |
| Architecture docs | ARCHITECTURE.md |
| Setup guide | GETTING_STARTED.md |
| Migration guide | MIGRATION_GUIDE.md |

## Key Concepts

**Property ID**: Unique immutable identifier generated in chaincode
- Format: LRI-IND-<STATE>-<YEAR>-<SEQUENCE>
- Example: LRI-IND-TS-2026-000001

**System of Record**: Hyperledger Fabric blockchain
- Immutable ownership
- Event audit trail
- Transaction history

**Fast Retrieval**: Supabase PostgreSQL (off-chain)
- Indexed searches
- Document metadata
- Verification status

**Data Merge**: API combines blockchain + off-chain
- Blockchain data marked ✅
- Off-chain marked separately
- Clear provenance

**Async Updates**: Non-blocking operations
- Fabric returns immediately
- Supabase indexes background
- Eventual consistency

## Testing Patterns

### Unit Test
```javascript
const api = new LandRegistryAPI();
await api.initialize('registrar1');
const result = await api.createProperty({...});
assert(result.propertyId.startsWith('LRI-IND'));
```

### Integration Test
```javascript
// 1. Create
const created = await api.createProperty({...});
// 2. Wait
await new Promise(r => setTimeout(r, 1000));
// 3. Retrieve
const retrieved = await api.getPropertyById(created.propertyId);
assert(retrieved.mergedView.owner === created.data.owner);
```

### API Test
```bash
curl -X POST /api/v1/property/create \
  -H "Authorization: Bearer registrar1" \
  -d {...} | jq '.propertyId'
```

## Performance Tips

1. **Use indexed queries**: district, survey_no, property_id
2. **Batch operations**: Create multiple properties in sequence
3. **Connection pooling**: Reuse Fabric connections
4. **Caching**: Cache Supabase reads if appropriate
5. **Monitoring**: Track API latency and blockchain time

## Security Checklist

- [ ] TLS enabled for Fabric
- [ ] Fabric discovery disabled (production)
- [ ] JWT tokens for API (implement in validateIdentity)
- [ ] Rate limiting enabled
- [ ] Secrets in .env (not in code)
- [ ] No hardcoded identities
- [ ] Regular backups
- [ ] Audit logging enabled

## Links & Resources

- **Hyperledger Fabric**: https://hyperledger-fabric.readthedocs.io/
- **Supabase**: https://supabase.com/docs
- **Express.js**: https://expressjs.com/
- **Fabric Gateway SDK**: https://github.com/hyperledger/fabric-sdk-node/wiki/Gateway

## Contact & Support

For issues:
1. Check GETTING_STARTED.md troubleshooting section
2. Review logs: `docker logs <container>`
3. Test health: `curl /api/v1/health`
4. Check ARCHITECTURE.md error handling guide

---

**Last Updated**: January 16, 2026  
**Quick Reference v1.0**
