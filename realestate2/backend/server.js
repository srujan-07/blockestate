const express = require('express');
const cors = require('cors');
const LedgerService = require('./services/LedgerService');
const StorageService = require('./services/StorageService');
const { initializeDatabase, seedDatabase } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// PRODUCTION ARCHITECTURE:
// - Ledger is SOURCE OF TRUTH (Fabric blockchain)
// - All queries MUST query ledger first
// - Database is secondary (indexing, documents only)
// - Database NEVER overrides ledger state

// Initialize services
const ledgerService = new LedgerService();
const storageService = new StorageService();

// Initialize ledger connection on startup
(async () => {
  try {
    await ledgerService.initialize('admin');
    console.log('✅ LedgerService initialized');
  } catch (error) {
    console.error('❌ LedgerService initialization failed:', error.message);
    console.error('⚠️  Backend will continue but ledger queries will fail');
  }
})();

// Query by Survey Number - LEDGER-FIRST
app.post('/land/query-by-survey', async (req, res) => {
  const { district, mandal, village, surveyNo } = req.body || {};
  
  // Validate all required fields
  if (!district || !district.trim()) {
    return res.status(400).json({ error: 'District is required' });
  }
  if (!mandal || !mandal.trim()) {
    return res.status(400).json({ error: 'Mandal is required' });
  }
  if (!village || !village.trim()) {
    return res.status(400).json({ error: 'Village is required' });
  }
  if (!surveyNo || !surveyNo.trim()) {
    return res.status(400).json({ error: 'Survey Number is required' });
  }
  
  console.log(`[LEDGER QUERY] Querying ledger: district=${district}, mandal=${mandal}, village=${village}, surveyNo=${surveyNo}`);
  
  try {
    // LEDGER-FIRST: Query from Fabric ledger
    const ledgerResult = await ledgerService.queryPropertyBySurvey(
      district,
      mandal,
      village,
      surveyNo
    );

    console.log(`✅ Ledger query successful, txId: ${ledgerResult.ledgerMetadata.txId}`);

    // Enrich with storage metadata (documents, etc.)
    let documents = [];
    try {
      documents = await storageService.getDocumentMetadata(ledgerResult.property.propertyId);
    } catch (err) {
      console.warn('Could not fetch document metadata:', err.message);
    }

    // Sync to cache for future fast lookups (async, non-blocking)
    setImmediate(async () => {
      try {
        await storageService.syncLedgerToCache(
          ledgerResult.property.propertyId,
          ledgerResult.property,
          ledgerResult.ledgerMetadata.txId,
          ledgerResult.ledgerMetadata.blockNumber
        );
      } catch (err) {
        console.warn('Could not sync to cache:', err.message);
      }
    });

    // Return property with REAL ledger metadata
    res.json({
      ...ledgerResult.property,
      // REAL ledger metadata (not mocked)
      transactionId: ledgerResult.ledgerMetadata.txId,
      blockNumber: ledgerResult.ledgerMetadata.blockNumber,
      timestamp: ledgerResult.ledgerMetadata.timestamp,
      endorsements: ledgerResult.ledgerMetadata.endorsements,
      channelId: ledgerResult.ledgerMetadata.channelId,
      ledgerVerified: true,
      // Supporting metadata from storage
      documents: documents
    });
  } catch (error) {
    console.error('[ERROR] Ledger query failed:', error.message);
    return res.status(404).json({ 
      error: 'Land record not found on ledger. Please verify all details.',
      details: error.message
    });
  }
});

// Query by Property ID - LEDGER-FIRST
app.post('/land/query-by-id', async (req, res) => {
  const { propertyId } = req.body || {};
  
  // Validate required field
  if (!propertyId || !propertyId.trim()) {
    return res.status(400).json({ error: 'Property ID is required' });
  }
  
  console.log(`[LEDGER QUERY] Querying ledger by ID: propertyId=${propertyId}`);
  
  try {
    // LEDGER-FIRST: Query from Fabric ledger
    const ledgerResult = await ledgerService.queryPropertyById(propertyId);

    console.log(`✅ Ledger query successful, txId: ${ledgerResult.ledgerMetadata.txId}`);

    // Enrich with storage metadata
    let documents = [];
    try {
      documents = await storageService.getDocumentMetadata(propertyId);
    } catch (err) {
      console.warn('Could not fetch document metadata:', err.message);
    }

    // Sync to cache (async, non-blocking)
    setImmediate(async () => {
      try {
        await storageService.syncLedgerToCache(
          propertyId,
          ledgerResult.property,
          ledgerResult.ledgerMetadata.txId,
          ledgerResult.ledgerMetadata.blockNumber
        );
      } catch (err) {
        console.warn('Could not sync to cache:', err.message);
      }
    });

    // Return property with REAL ledger metadata
    res.json({
      ...ledgerResult.property,
      transactionId: ledgerResult.ledgerMetadata.txId,
      blockNumber: ledgerResult.ledgerMetadata.blockNumber,
      timestamp: ledgerResult.ledgerMetadata.timestamp,
      endorsements: ledgerResult.ledgerMetadata.endorsements,
      channelId: ledgerResult.ledgerMetadata.channelId,
      ledgerVerified: true,
      documents: documents
    });
  } catch (error) {
    console.error('[ERROR] Ledger query failed:', error.message);
    return res.status(404).json({ 
      error: 'Land record not found on ledger. Please verify the Property ID.',
      details: error.message
    });
  }
});

// Get all records - LEDGER-FIRST
app.get('/land/all', async (req, res) => {
  try {
    // LEDGER-FIRST: Query all properties from ledger
    const allProperties = await ledgerService.fabricService.evaluateTransaction('GetAllLandRecords');
    
    // Transform to response format
    const transformedRecords = (allProperties || []).map(property => ({
      propertyId: property.propertyId,
      surveyNo: property.surveyNo,
      district: property.district,
      mandal: property.mandal,
      village: property.village,
      owner: property.owner,
      area: property.area,
      landType: property.landType,
      marketValue: property.marketValue,
      ledgerVerified: true
    }));
    
    res.json({
      source: 'Hyperledger Fabric Ledger',
      totalRecords: transformedRecords.length,
      records: transformedRecords,
      ledgerVerified: true
    });
  } catch (error) {
    console.error('[ERROR] Failed to fetch all records from ledger:', error.message);
    res.status(500).json({ error: 'Ledger query error: ' + error.message });
  }
});

// ============================================================================
// 🏛️  FEDERATED ARCHITECTURE ENDPOINTS (Phase 7 - Multi-Channel Deployment)
// Currently disabled - requires Fabric multi-channel network setup
// See: FEDERATED_API_GUIDE.md for full specification
// See: PHASE_6_PREVIEW.md for deployment roadmap
// ============================================================================

// Note: Federated endpoints require:
// - cclb-global and state-<code> channels (not yet created)
// - CCLB and state chaincodes (not yet deployed)  
// - fabric_federated.js helpers (available in Phase 5)
// - Connection profiles for CCLB (not yet generated)
//
// For current deployment, these endpoints are disabled.
// Uncomment after Phase 7 (Fabric Network Deployment) is complete.

/*
app.post('/national/property/request', async (req, res) => { ... });
app.get('/national/property/:propertyID', async (req, res) => { ... });
app.get('/national/properties', async (req, res) => { ... });
app.post('/state/:stateCode/property/create', async (req, res) => { ... });
app.get('/state/:stateCode/property/:propertyID', async (req, res) => { ... });
app.get('/state/:stateCode/properties', async (req, res) => { ... });
app.get('/property/:propertyID/federated', async (req, res) => { ... });
*/

// Health check
app.get('/health', async (_req, res) => {
  try {
    const ledgerHealth = await ledgerService.healthCheck();
    const storageHealth = await storageService.healthCheck();
    
    res.json({
      ok: ledgerHealth.healthy && storageHealth,
      architecture: 'ledger-first',
      ledger: {
        healthy: ledgerHealth.healthy,
        connected: ledgerHealth.connected,
        identity: ledgerHealth.identity,
        channel: ledgerHealth.channel
      },
      storage: {
        available: storageHealth
      },
      source: 'Hyperledger Fabric Ledger (authoritative) + Database (indexing)'
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Health check failed: ' + error.message });
  }
});

const PORT = process.env.PORT || 4000;

// Initialize database and start server
(async () => {
  try {
    // Initialize database for indexing (secondary storage)
    await initializeDatabase();
    await seedDatabase();
    
    app.listen(PORT, () => {
      console.log(`✅ Backend running on port ${PORT}`);
      console.log(`📊 Architecture: 🔐 LEDGER-FIRST (Hyperledger Fabric as Source of Truth)`);
      console.log(``);
      console.log(`🔗 Ledger: Hyperledger Fabric (Authoritative Source)`);
      console.log(`📊 Storage: Database (Indexing & Documents Only)`);
      console.log(`🏛️  Network: Custom Fabric Network (CCLB + State Organizations)`);
      console.log(``);
      console.log(`🔍 ACTIVE ENDPOINTS (LEDGER-FIRST):`);
      console.log(`   - POST /land/query-by-survey (district, mandal, village, surveyNo)`);
      console.log(`   - POST /land/query-by-id (propertyId)`);
      console.log(`   - GET /land/all`);
      console.log(``);
      console.log(`✅ All queries query Fabric ledger FIRST`);
      console.log(`✅ Database is secondary (indexing, documents)`);
      console.log(`✅ Database NEVER overrides ledger state`);
      console.log(``);
      console.log(`🔗 Visit http://localhost:${PORT}/health to check status`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
})();

