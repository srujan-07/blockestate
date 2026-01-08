const express = require('express');
const cors = require('cors');
const { getContract } = require('./fabric');
const { allQuery, initializeDatabase, seedDatabase } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Enable Fabric blockchain mode via env (fallback to false)
const USE_FABRIC = String(process.env.USE_FABRIC || '').toLowerCase() === 'true' || process.env.USE_FABRIC === '1';

const eq = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

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
  
  console.log(`[QUERY] Searching: district=${district}, mandal=${mandal}, village=${village}, surveyNo=${surveyNo}`);
  
  if (USE_FABRIC) {
    try {
      const { contract, gateway } = await getContract('admin');
      const result = await contract.evaluateTransaction(
        'QueryLandBySurvey',
        district,
        mandal,
        village,
        surveyNo
      );
      await gateway.disconnect();

      if (!result || result.length === 0) {
        console.log(`[NOT FOUND] No record from blockchain`);
        return res.status(404).json({ error: 'Record not found' });
      }

      const landRecord = JSON.parse(result.toString());
      
      // Validate all fields match (case-insensitive)
      if (!eq(landRecord.district, district) || !eq(landRecord.mandal, mandal) || 
          !eq(landRecord.village, village) || !eq(landRecord.surveyNo, surveyNo)) {
        console.log(`[MISMATCH] Fields do not match.`);
        return res.status(404).json({ error: 'Record not found' });
      }
      
      console.log(`[FOUND] Record from blockchain:`, landRecord);
      res.json(landRecord);
    } catch (error) {
      console.error('[ERROR] Blockchain query failed:', error.message);
      return res.status(404).json({ error: 'Record not found' });
    }
  } else {
    // Query from Supabase
    try {
      const records = await allQuery({});
      
      const result = records.find(record => 
        eq(record.district, district) && 
        eq(record.mandal, mandal) && 
        eq(record.village, village) && 
        eq(record.survey_no, surveyNo)
      );
      
      if (!result) {
        console.log(`[NOT FOUND] No matching record in database`);
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
      
      console.log(`[FOUND] Database record: ${response.propertyId}`);
      res.json(response);
    } catch (error) {
      console.error('[ERROR] Database query failed:', error.message);
      return res.status(500).json({ error: 'Database error: ' + error.message });
    }
  }
});

app.post('/land/query-by-id', async (req, res) => {
  const { propertyId } = req.body || {};
  
  // Validate required field
  if (!propertyId || !propertyId.trim()) {
    return res.status(400).json({ error: 'Property ID is required' });
  }
  
  console.log(`[QUERY] Searching by ID: propertyId=${propertyId}`);
  
  if (USE_FABRIC) {
    try {
      const { contract, gateway } = await getContract('admin');
      const result = await contract.evaluateTransaction(
        'ReadLandRecord',
        propertyId
      );
      await gateway.disconnect();

      if (!result || result.length === 0) {
        console.log(`[NOT FOUND] No record from blockchain`);
        return res.status(404).json({ error: 'Record not found' });
      }

      const landRecord = JSON.parse(result.toString());
      
      // Validate Property ID matches (case-insensitive)
      if (!eq(landRecord.propertyId, propertyId)) {
        console.log(`[MISMATCH] Property ID does not match`);
        return res.status(404).json({ error: 'Record not found' });
      }
      
      console.log(`[FOUND] Record from blockchain:`, landRecord);
      res.json(landRecord);
    } catch (error) {
      console.error('[ERROR] Blockchain query failed:', error.message);
      return res.status(404).json({ error: 'Record not found' });
    }
  } else {
    // Query from Supabase
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
        blockNumber: result.block_number,
        ipfsCID: result.ipfs_cid
      };
      
      console.log(`[FOUND] Database record: ${response.propertyId}`);
      res.json(response);
    } catch (error) {
      console.error('[ERROR] Database query failed:', error.message);
      return res.status(500).json({ error: 'Database error: ' + error.message });
    }
  }
});

// Debug endpoint: Get all available records from Supabase
app.get('/land/all', async (req, res) => {
  if (USE_FABRIC) {
    return res.status(501).json({ error: 'Listing all records is disabled in Fabric mode. Query by survey or property ID instead.' });
  }
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
      mode: USE_FABRIC ? 'blockchain' : 'Supabase',
      totalRecords: transformedRecords.length,
      records: transformedRecords
    });
  } catch (error) {
    console.error('[ERROR] Failed to fetch all records:', error.message);
    res.status(500).json({ error: 'Database error: ' + error.message });
  }
});

app.get('/health', async (_req, res) => {
  if (USE_FABRIC) {
    return res.json({ ok: true, mode: 'blockchain', database: 'skipped (Fabric mode)' });
  }
  try {
    await allQuery({});
    res.json({ ok: true, mode: 'Supabase', database: 'connected' });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Database connection failed', mode: 'Supabase' });
  }
});

const PORT = process.env.PORT || 4000;

// Initialize database and start server
(async () => {
  try {
    if (USE_FABRIC) {
      console.log('⏭️  Supabase initialization skipped (Fabric mode enabled)');
    } else {
      await initializeDatabase();
      await seedDatabase();
    }
    
    app.listen(PORT, () => {
      console.log(`✅ Backend running on port ${PORT}`);
      console.log(`📊 Storage: ${USE_FABRIC ? '🔗 Hyperledger Fabric Blockchain' : '☁️  Supabase (PostgreSQL)'}`);
      if (USE_FABRIC) {
        console.log(`🔍 Query endpoints: POST /land/query-by-survey, POST /land/query-by-id`);
      } else {
        console.log(`🔗 Visit http://localhost:${PORT}/land/all to see all records`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
})();

