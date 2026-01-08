const express = require('express');
const cors = require('cors');
const { getContract } = require('./fabric');
const { db, allQuery, getQuery, initializeDatabase, seedDatabase } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Enable Fabric blockchain mode via env (fallback to false)
const USE_FABRIC = String(process.env.USE_FABRIC || '').toLowerCase() === 'true' || process.env.USE_FABRIC === '1';

// Static sample land records for fallback only
const staticLands = [
  {
    propertyId: 'PROP-1001',
    surveyNo: '123/A',
    district: 'Hyderabad',
    mandal: 'Ghatkesar',
    village: 'Boduppal',
    owner: 'Ravi Kumar',
    area: '240 sq.yds',
    landType: 'Residential',
    marketValue: '₹ 45,00,000',
    lastUpdated: '2026-01-02',
    transactionId: 'tx-abc-001',
    blockNumber: 11,
    ipfsCID: 'bafybeigdyrmockcid0001'
  },
  {
    propertyId: 'PROP-2002',
    surveyNo: '45/B',
    district: 'Nalgonda',
    mandal: 'Choutuppal',
    village: 'Chityal',
    owner: 'Suma Reddy',
    area: '1.5 acres',
    landType: 'Agricultural',
    marketValue: '₹ 62,00,000',
    lastUpdated: '2025-12-28',
    transactionId: 'tx-abc-002',
    blockNumber: 19,
    ipfsCID: 'bafybeigdyrmockcid0002'
  },
  {
    propertyId: 'PROP-3003',
    surveyNo: '78/C',
    district: 'Warangal',
    mandal: 'Kazipet',
    village: 'Fathima Nagar',
    owner: 'Arjun Varma',
    area: '360 sq.yds',
    landType: 'Residential',
    marketValue: '₹ 55,00,000',
    lastUpdated: '2025-12-15',
    transactionId: 'tx-abc-003',
    blockNumber: 24,
    ipfsCID: 'bafybeigdyrmockcid0003'
  },
  {
    propertyId: 'PROP-4004',
    surveyNo: '12/D',
    district: 'Karimnagar',
    mandal: 'Huzurabad',
    village: 'Kamalapur',
    owner: 'Meena Chowdary',
    area: '600 sq.yds',
    landType: 'Residential',
    marketValue: '₹ 68,00,000',
    lastUpdated: '2025-11-05',
    transactionId: 'tx-abc-004',
    blockNumber: 31,
    ipfsCID: 'bafybeigdyrmockcid0004'
  }
];

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
    // Query from SQLite
    try {
      const query = `
        SELECT id, property_id as propertyId, survey_no as surveyNo, district, mandal, village, 
               owner, area, land_type as landType, market_value as marketValue, 
               last_updated as lastUpdated, transaction_id as transactionId, 
               block_number as blockNumber, ipfs_cid as ipfsCID
        FROM land_records
        WHERE LOWER(district) = LOWER(?) 
        AND LOWER(mandal) = LOWER(?) 
        AND LOWER(village) = LOWER(?) 
        AND LOWER(survey_no) = LOWER(?)
      `;
      
      const result = await getQuery(query, [district, mandal, village, surveyNo]);
      
      if (!result) {
        console.log(`[NOT FOUND] No matching record in database`);
        return res.status(404).json({ error: 'Land record not found. Please verify all details.' });
      }
      
      console.log(`[FOUND] Database record: ${result.propertyId}`);
      res.json(result);
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
    // Query from SQLite
    try {
      const query = `
        SELECT id, property_id as propertyId, survey_no as surveyNo, district, mandal, village,
               owner, area, land_type as landType, market_value as marketValue,
               last_updated as lastUpdated, transaction_id as transactionId,
               block_number as blockNumber, ipfs_cid as ipfsCID
        FROM land_records
        WHERE LOWER(property_id) = LOWER(?)
      `;
      
      const result = await getQuery(query, [propertyId]);
      
      if (!result) {
        console.log(`[NOT FOUND] No matching record for propertyId=${propertyId}`);
        return res.status(404).json({ error: 'Land record not found. Please verify the Property ID.' });
      }
      
      console.log(`[FOUND] Database record: ${result.propertyId}`);
      res.json(result);
    } catch (error) {
      console.error('[ERROR] Database query failed:', error.message);
      return res.status(500).json({ error: 'Database error: ' + error.message });
    }
  }
});

// Debug endpoint: Get all available records from SQLite
app.get('/land/all', async (req, res) => {
  try {
    const query = `
      SELECT id, property_id as propertyId, survey_no as surveyNo, district, mandal, village,
             owner, area, land_type as landType, market_value as marketValue
      FROM land_records
      ORDER BY property_id
    `;
    
    const result = await allQuery(query);
    
    res.json({
      mode: USE_FABRIC ? 'blockchain' : 'SQLite',
      totalRecords: result.length,
      records: result
    });
  } catch (error) {
    console.error('[ERROR] Failed to fetch all records:', error.message);
    res.status(500).json({ error: 'Database error: ' + error.message });
  }
});

app.get('/health', async (_req, res) => {
  try {
    await getQuery('SELECT 1');
    res.json({ ok: true, mode: USE_FABRIC ? 'blockchain' : 'SQLite', database: 'connected' });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Database connection failed', mode: USE_FABRIC ? 'blockchain' : 'SQLite' });
  }
});

const PORT = process.env.PORT || 4000;

// Initialize database and start server
(async () => {
  try {
    await initializeDatabase();
    await seedDatabase();
    
    app.listen(PORT, () => {
      console.log(`✅ Backend running on port ${PORT}`);
      console.log(`📊 Storage: ${USE_FABRIC ? '🔗 Hyperledger Fabric Blockchain' : '🗄️  SQLite Database'}`);
      console.log(`🔗 Visit http://localhost:${PORT}/land/all to see all records`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
})();

