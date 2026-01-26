const express = require('express');
const cors = require('cors');
// Note: fabric_federated.js requires multi-channel setup (Phase 7)
// For current deployment, using single-channel fabric.js
const { getContract } = require('./fabric');
const { allQuery, initializeDatabase, seedDatabase } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Citizen queries always use Supabase (fast, indexed lookups)
// 🔗 Ledger writes go through Fabric (blockchain audit trail)
// 🏛️  FEDERATED ARCHITECTURE: Multi-channel support with CCLB and State registries

const eq = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// Note: Helper functions for federated architecture (removed for Phase 5->6 transition)
// extractStateCodeFromPropertyID() - See fabric_federated.js
// getOrgForState() - See fabric_federated.js
// These are available in Phase 5 design, awaiting Phase 7 deployment

// Query by Survey Number - Citizen API (Supabase)
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
  
  console.log(`[CITIZEN QUERY] Searching Supabase: district=${district}, mandal=${mandal}, village=${village}, surveyNo=${surveyNo}`);
  
  try {
    const records = await allQuery({});
    
    const result = records.find(record => 
      eq(record.district, district) && 
      eq(record.mandal, mandal) && 
      eq(record.village, village) && 
      eq(record.survey_no, surveyNo)
    );
    
    if (!result) {
      console.log(`[NOT FOUND] No matching record in Supabase`);
      return res.status(404).json({ error: 'Land record not found. Please verify all details.' });
    }
    
    // Transform to camelCase for API response
    const response = {
      id: result.id,
      propertyId: result.property_id,
      surveyNo: result.survey_no,
      district: result.district,
      mandal: result.mandal,
      village: result.village,
      owner: result.owner,
      area: result.area,
      landType: result.land_type,
      marketValue: result.market_value,
      lastUpdated: result.last_updated,
      transactionId: result.transaction_id,
      blockNumber: result.block_number,
      ipfsCID: result.ipfs_cid
    };
    
    console.log(`[FOUND] Supabase record: ${response.propertyId}`);
    res.json(response);
  } catch (error) {
    console.error('[ERROR] Database query failed:', error.message);
    return res.status(500).json({ error: 'Database error: ' + error.message });
  }
});

// Query by Property ID - Citizen API (Supabase)
app.post('/land/query-by-id', async (req, res) => {
  const { propertyId } = req.body || {};
  
  // Validate required field
  if (!propertyId || !propertyId.trim()) {
    return res.status(400).json({ error: 'Property ID is required' });
  }
  
  console.log(`[CITIZEN QUERY] Searching Supabase by ID: propertyId=${propertyId}`);
  
  try {
    const records = await allQuery({});
    
    const result = records.find(record => 
      eq(record.property_id, propertyId)
    );
    
    if (!result) {
      console.log(`[NOT FOUND] No matching record for propertyId=${propertyId}`);
      return res.status(404).json({ error: 'Land record not found. Please verify the Property ID.' });
    }
    
    // Transform to camelCase for API response
    const response = {
      id: result.id,
      propertyId: result.property_id,
      surveyNo: result.survey_no,
      district: result.district,
      mandal: result.mandal,
      village: result.village,
      owner: result.owner,
      area: result.area,
      landType: result.land_type,
      marketValue: result.market_value,
      lastUpdated: result.last_updated,
      transactionId: result.transaction_id,
      blockNumber: result.block_number
    };
    
    console.log(`[FOUND] Supabase record: ${response.propertyId}`);
    res.json(response);
  } catch (error) {
    console.error('[ERROR] Database query failed:', error.message);
    return res.status(500).json({ error: 'Database error: ' + error.message });
  }
});

// Get all records - Citizen API (Supabase)
app.get('/land/all', async (req, res) => {
  try {
    const records = await allQuery({});
    
    // Transform to camelCase
    const transformedRecords = records.map(record => ({
      id: record.id,
      propertyId: record.property_id,
      surveyNo: record.survey_no,
      district: record.district,
      mandal: record.mandal,
      village: record.village,
      owner: record.owner,
      area: record.area,
      landType: record.land_type,
      marketValue: record.market_value
    }));
    
    res.json({
      source: 'Supabase (Citizen Space)',
      totalRecords: transformedRecords.length,
      records: transformedRecords
    });
  } catch (error) {
    console.error('[ERROR] Failed to fetch all records:', error.message);
    res.status(500).json({ error: 'Database error: ' + error.message });
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
    await allQuery({});
    res.json({
      ok: true,
      source: 'Supabase + Fabric',
      database: 'connected',
      fabric: 'single-channel (mychannel)',
      architecture: 'hybrid',
      roadmap: 'See FEDERATED_ARCHITECTURE.md for multi-channel deployment'
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Database connection failed' });
  }
});

const PORT = process.env.PORT || 4000;

// Initialize database and start server
(async () => {
  try {
    // Always initialize Supabase for citizen queries
    await initializeDatabase();
    await seedDatabase();
    
    app.listen(PORT, () => {
      console.log(`✅ Backend running on port ${PORT}`);
      console.log(`📊 Architecture: 🏛️  HYBRID (Supabase + Fabric Single-Channel)`);
      console.log(``);
      console.log(`📊 Citizen Data Layer: ☁️  Supabase (PostgreSQL)`);
      console.log(`🔗 Ledger: 🔐 Hyperledger Fabric (Single-Channel: mychannel)`);
      console.log(`🏛️  Deployment Status: PHASE 5 COMPLETE - PHASE 7 PENDING (Multi-Channel Setup)`);
      console.log(``);
      console.log(`🔍 ACTIVE ENDPOINTS:`);
      console.log(`   - POST /land/query-by-survey (district, mandal, village, surveyNo)`);
      console.log(`   - POST /land/query-by-id (propertyId)`);
      console.log(`   - GET /land/all`);
      console.log(``);
      console.log(`🚀 FEDERATED ENDPOINTS (Phase 7 - Deployment in Progress):`);
      console.log(`   - Currently DISABLED - Requires multi-channel Fabric network`);
      console.log(`   - See: FEDERATED_API_GUIDE.md for full specification`);
      console.log(``);
      console.log(`🔗 Visit http://localhost:${PORT}/health to check status`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
})();

