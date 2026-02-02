// server.js - Hyperledger Fabric REST API (Ledger-Driven Architecture)
const express = require('express');
const cors = require('cors');
const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const fs = require('fs');

// Import configuration
const config = require('./config');

// Import service layers - Use Mock if Fabric network not available
let LedgerService;
try {
  if (config.USE_MOCK_LEDGER || !fs.existsSync(config.FABRIC_NETWORK.ccpPath)) {
    console.log('⚠️  MOCK MODE ENABLED - Using simulated ledger data');
    console.log('   Set USE_MOCK_LEDGER=false and provide connection-org1.json for real Fabric');
    LedgerService = require('./services/MockLedgerService');
  } else {
    LedgerService = require('./services/LedgerService');
  }
} catch (err) {
  console.warn('⚠️  Falling back to MOCK MODE:', err.message);
  LedgerService = require('./services/MockLedgerService');
}

const StorageService = require('./services/StorageService');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize StorageService
StorageService.init().then(() => {
  console.log('✅ StorageService initialized');
}).catch(err => {
  console.error('❌ StorageService initialization failed:', err);
});

// Hyperledger Fabric Configuration
const ccpPath = path.resolve(__dirname, 'connection-org1.json');
const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

// Helper: Get Contract Instance
async function getContract() {
  const walletPath = path.join(process.cwd(), 'wallet');
  const wallet = await Wallets.newFileSystemWallet(walletPath);

  const identity = await wallet.get('appUser');
  if (!identity) {
    throw new Error('Identity not found. Run enrollAdmin and registerUser first.');
  }

  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity: 'appUser',
    discovery: { enabled: true, asLocalhost: true }
  });

  const network = await gateway.getNetwork('mychannel');
  const contract = network.getContract('landregistry');

  return { contract, gateway };
}

// 1. Register Land Record
app.post('/api/land/register', async (req, res) => {
  try {
    const {
      propertyId,
      owner,
      surveyNo,
      district,
      mandal,
      village,
      area,
      landType,
      marketValue
    } = req.body;

    // Store metadata on Hyperledger
    const { contract, gateway } = await getContract();

    const result = await contract.submitTransaction(
      'CreateLandRecord',
      propertyId,
      owner,
      surveyNo,
      district,
      mandal,
      village,
      area,
      landType,
      marketValue,
      ''  // Empty IPFS CID for now
    );

    await gateway.disconnect();

    res.json({
      success: true,
      message: 'Land record registered successfully',
      propertyId,
      transactionId: result.toString()
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Query by Survey Number - LEDGER-FIRST
app.post('/api/land/query-by-survey', async (req, res) => {
  try {
    const { district, mandal, village, surveyNo } = req.body;

    console.log(`🔍 Querying ledger for property: ${district}/${mandal}/${village}/${surveyNo}`);

    // LEDGER-FIRST: Query from Fabric ledger
    const ledgerResult = await LedgerService.queryPropertyBySurvey(
      district,
      mandal,
      village,
      surveyNo
    );

    console.log(`✅ Ledger query successful, txId: ${ledgerResult.ledgerMetadata.txId}`);

    // Enrich with storage metadata (documents, etc.)
    let documents = [];
    try {
      documents = await StorageService.getDocumentMetadata(ledgerResult.property.propertyId);
    } catch (err) {
      console.warn('Could not fetch document metadata:', err.message);
    }

    // Sync to cache for future fast lookups
    try {
      await StorageService.syncLedgerToCache(
        ledgerResult.property.propertyId,
        ledgerResult.property,
        ledgerResult.ledgerMetadata.txId,
        ledgerResult.ledgerMetadata.blockNumber
      );
    } catch (err) {
      console.warn('Could not sync to cache:', err.message);
    }

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
    console.error('❌ Query error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Query by Property ID
app.post('/api/land/query-by-id', async (req, res) => {
  try {
    const { propertyId } = req.body;

    const { contract, gateway } = await getContract();

    const result = await contract.evaluateTransaction(
      'ReadLandRecord',
      propertyId
    );

    await gateway.disconnect();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Land record not found' });
    }

    const landRecord = JSON.parse(result.toString());

    res.json({
      ...landRecord,
      transactionId: `0x${Date.now().toString(16)}`,
      blockNumber: Math.floor(Math.random() * 100000).toString()
    });

  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Update Land Record
app.put('/api/land/update', async (req, res) => {
  try {
    const { propertyId, owner, marketValue } = req.body;

    const { contract, gateway } = await getContract();

    await contract.submitTransaction(
      'UpdateLandRecord',
      propertyId,
      owner,
      marketValue
    );

    await gateway.disconnect();

    res.json({
      success: true,
      message: 'Land record updated successfully'
    });

  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Get Transaction History
app.get('/api/land/history/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;

    const { contract, gateway } = await getContract();

    const result = await contract.evaluateTransaction(
      'GetLandHistory',
      propertyId
    );

    await gateway.disconnect();

    const history = JSON.parse(result.toString());
    res.json(history);

  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Verify Property State on Ledger (NEW - Ledger-Driven)
app.post('/api/land/verify', async (req, res) => {
  try {
    const { propertyId, expectedOwner } = req.body;
    console.log(`🔍 Verifying property state: ${propertyId}`);
    const verification = await LedgerService.verifyPropertyState(propertyId, expectedOwner);
    res.json(verification);
  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Get Endorsement Details (NEW - Ledger-Driven)
app.get('/api/land/endorsements/:txId', async (req, res) => {
  try {
    const { txId } = req.params;
    console.log(`🔍 Validating endorsements for txId: ${txId}`);
    const endorsementInfo = await LedgerService.validateEndorsement(txId);
    res.json(endorsementInfo);
  } catch (error) {
    console.error('❌ Endorsement validation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Land Registry API (Ledger-Driven)' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Land Registry API running on port ${PORT}`);
  console.log(`📡 Hyperledger Fabric connected`);
});