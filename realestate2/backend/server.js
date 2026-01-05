const express = require('express');
const cors = require('cors');
const { getContract } = require('./fabric');

const app = express();
app.use(cors());
app.use(express.json());

// Enable Fabric blockchain mode (set to false to use static data)
const USE_FABRIC = true;

// Static sample land records for demo/fallback
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
        return res.status(404).json({ error: 'Land record not found. Please verify all details.' });
      }

      const landRecord = JSON.parse(result.toString());
      console.log(`[FOUND] Record from blockchain:`, landRecord);
      res.json(landRecord);
    } catch (error) {
      console.error('[ERROR] Blockchain query failed:', error);
      return res.status(500).json({ error: error.message || 'Blockchain query failed' });
    }
  } else {
    // Fallback to static data
    const match = staticLands.find(
      (r) => eq(r.district, district) && eq(r.mandal, mandal) && eq(r.village, village) && eq(r.surveyNo, surveyNo)
    );
    
    if (!match) {
      console.log(`[NOT FOUND] No matching static record`);
      return res.status(404).json({ error: 'Land record not found. Please verify all details.' });
    }
    
    console.log(`[FOUND] Static record: ${match.propertyId}`);
    res.json(match);
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
        return res.status(404).json({ error: 'Land record not found. Please verify the Property ID.' });
      }

      const landRecord = JSON.parse(result.toString());
      console.log(`[FOUND] Record from blockchain:`, landRecord);
      res.json(landRecord);
    } catch (error) {
      console.error('[ERROR] Blockchain query failed:', error);
      return res.status(500).json({ error: error.message || 'Blockchain query failed' });
    }
  } else {
    // Fallback to static data
    const match = staticLands.find((r) => eq(r.propertyId, propertyId));
    
    if (!match) {
      console.log(`[NOT FOUND] No matching static record for propertyId=${propertyId}`);
      return res.status(404).json({ error: 'Land record not found. Please verify the Property ID.' });
    }
    
    console.log(`[FOUND] Static record: ${match.propertyId}`);
    res.json(match);
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, mode: USE_FABRIC ? 'blockchain' : 'static' }));

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`Mode: ${USE_FABRIC ? '🔗 Hyperledger Fabric Blockchain' : '📁 Static Data'}`);
});

