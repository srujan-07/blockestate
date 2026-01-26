/**
 * Production-Grade Backend API Server
 * 
 * Endpoints:
 * - Retrieval: GET /api/v1/property/{id}, GET /api/v1/search
 * - Transaction: POST /api/v1/property/create, POST /api/v1/property/transfer
 * - Document: POST /api/v1/document/link, GET /api/v1/property/{id}/documents
 * - Admin: GET /api/v1/config, POST /api/v1/config/switch-network
 * - Health: GET /api/v1/health
 * 
 * Authentication: Assumes Fabric wallet identities are pre-configured
 */

const express = require('express');
const cors = require('cors');
const LandRegistryAPI = require('./services/LandRegistryAPI');
const { getNetworkConfig } = require('./services/NetworkConfig');

const app = express();
app.use(cors());
app.use(express.json());

// Global API instance
let landRegistryAPI = null;

/**
 * Middleware: Error handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Middleware: Validate identity (can be enhanced with JWT)
 */
function validateIdentity(req, res, next) {
  // Extract from header: Authorization: Bearer <identity>
  const authHeader = req.headers.authorization || '';
  const identity = authHeader.replace('Bearer ', '').trim() || 'registrar1';

  req.identity = identity;
  next();
}

app.use(validateIdentity);

// ============================================================================
// RETRIEVAL ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/property/:propertyId
 * Retrieve property by Property ID
 * Query params: ?verifyOnChain=true&includeHistory=true
 */
app.get(
  '/api/v1/property/:propertyId',
  asyncHandler(async (req, res) => {
    const { propertyId } = req.params;
    const verifyOnChain = req.query.verifyOnChain !== 'false';
    const includeHistory = req.query.includeHistory === 'true';

    const result = await landRegistryAPI.getPropertyById(propertyId, {
      verifyOnChain,
      includeHistory,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /api/v1/property/:propertyId/overview
 * Get comprehensive property view (property + documents + history)
 */
app.get(
  '/api/v1/property/:propertyId/overview',
  asyncHandler(async (req, res) => {
    const { propertyId } = req.params;
    const result = await landRegistryAPI.getPropertyOverview(propertyId);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/search/by-attributes
 * Search by land attributes (district, mandal, village, surveyNo)
 * Body: { district, mandal, village, surveyNo }
 */
app.post(
  '/api/v1/search/by-attributes',
  asyncHandler(async (req, res) => {
    const { district, mandal, village, surveyNo } = req.body;

    if (!district || !surveyNo) {
      return res.status(400).json({
        success: false,
        error: 'district and surveyNo are required',
      });
    }

    const results = await landRegistryAPI.searchByAttributes({
      district,
      mandal,
      village,
      surveyNo,
    });

    res.json({
      success: true,
      count: results.length,
      data: results,
    });
  })
);

/**
 * POST /api/v1/search/by-text
 * Full-text search on location/address
 * Body: { searchTerm }
 */
app.post(
  '/api/v1/search/by-text',
  asyncHandler(async (req, res) => {
    const { searchTerm } = req.body;

    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'searchTerm must be at least 2 characters',
      });
    }

    const results = await landRegistryAPI.searchByText(searchTerm);

    res.json({
      success: true,
      count: results.length,
      data: results,
    });
  })
);

// ============================================================================
// TRANSACTION ENDPOINTS
// ============================================================================

/**
 * POST /api/v1/property/create
 * Create new land property
 * 
 * Body: {
 *   owner,
 *   surveyNo,
 *   district,
 *   mandal,
 *   village,
 *   area,
 *   landType,
 *   marketValue,
 *   state,
 *   ipfsCID (optional)
 * }
 * 
 * Header: Authorization: Bearer registrar1
 */
app.post(
  '/api/v1/property/create',
  asyncHandler(async (req, res) => {
    const data = req.body;

    // Validate required fields
    const required = ['owner', 'surveyNo', 'district', 'mandal', 'village', 'area', 'landType', 'marketValue', 'state'];
    const missing = required.filter((field) => !data[field]);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    const result = await landRegistryAPI.createProperty(data, req.identity);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.status(201).json({
      success: true,
      propertyId: result.propertyId,
      transactionId: result.transactionId,
      data: result.blockchainData,
    });
  })
);

/**
 * POST /api/v1/property/transfer
 * Transfer property ownership
 * 
 * Body: {
 *   propertyId,
 *   newOwner,
 *   approvalStatus (approved|rejected|pending)
 * }
 * 
 * Header: Authorization: Bearer registrar1
 */
app.post(
  '/api/v1/property/transfer',
  asyncHandler(async (req, res) => {
    const { propertyId, newOwner, approvalStatus } = req.body;

    if (!propertyId || !newOwner || !approvalStatus) {
      return res.status(400).json({
        success: false,
        error: 'propertyId, newOwner, and approvalStatus are required',
      });
    }

    const result = await landRegistryAPI.transferProperty(
      { propertyId, newOwner, approvalStatus },
      req.identity
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      propertyId: result.propertyId,
      transactionId: result.transactionId,
      data: result.blockchainData,
    });
  })
);

// ============================================================================
// DOCUMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/v1/document/link
 * Link document to property
 * 
 * Body: {
 *   propertyId,
 *   documentHash,
 *   documentType (e.g., "title_deed", "survey_report"),
 *   fileUrl (optional)
 * }
 */
app.post(
  '/api/v1/document/link',
  asyncHandler(async (req, res) => {
    const { propertyId, documentHash, documentType, fileUrl } = req.body;

    if (!propertyId || !documentHash || !documentType) {
      return res.status(400).json({
        success: false,
        error: 'propertyId, documentHash, and documentType are required',
      });
    }

    const result = await landRegistryAPI.linkDocument(
      { propertyId, documentHash, documentType, fileUrl },
      req.identity
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      propertyId: result.propertyId,
    });
  })
);

/**
 * GET /api/v1/property/:propertyId/documents
 * Get documents linked to property
 */
app.get(
  '/api/v1/property/:propertyId/documents',
  asyncHandler(async (req, res) => {
    const { propertyId } = req.params;

    // This would require Supabase integration
    // For now, return from property overview
    const overview = await landRegistryAPI.getPropertyOverview(propertyId);

    res.json({
      success: true,
      propertyId,
      documents: overview.documents,
    });
  })
);

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/config
 * Get current network/channel configuration
 */
app.get('/api/v1/config', (req, res) => {
  const networkConfig = getNetworkConfig();
  const config = networkConfig.exportConfig();

  res.json({
    success: true,
    data: config,
  });
});

/**
 * POST /api/v1/config/switch-network
 * Switch to different network
 * 
 * Body: { networkName, channelName (optional) }
 */
app.post('/api/v1/config/switch-network', (req, res) => {
  try {
    const { networkName, channelName } = req.body;

    if (!networkName) {
      return res.status(400).json({
        success: false,
        error: 'networkName is required',
      });
    }

    const networkConfig = getNetworkConfig();
    networkConfig.switchNetwork(networkName, channelName);

    res.json({
      success: true,
      active: networkConfig.getActiveConfig(),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/health
 * Health check endpoint
 */
app.get('/api/v1/health', asyncHandler(async (req, res) => {
  const health = await landRegistryAPI.healthCheck();

  const status = health.healthy ? 200 : 503;
  res.status(status).json({
    healthy: health.healthy,
    fabric: health.fabric,
    supabase: health.supabase,
  });
}));

// ============================================================================
// ERROR HANDLER
// ============================================================================

app.use((err, req, res, next) => {
  console.error('❌ API Error:', err.message);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// ============================================================================
// INITIALIZATION AND SERVER START
// ============================================================================

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    // Initialize Land Registry API
    landRegistryAPI = new LandRegistryAPI();
    await landRegistryAPI.initialize('registrar1'); // Default identity

    // Start server
    app.listen(PORT, () => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ Land Registry Backend Server started on port ${PORT}`);
      console.log(`${'='.repeat(60)}\n`);

      console.log('📡 DATA LAYERS:');
      console.log('  🔗 Blockchain: Hyperledger Fabric (System of Record)');
      console.log('  ☁️  Off-chain: Supabase PostgreSQL (Fast Retrieval)');
      console.log('  🔍 Search: Full-text + Attribute-based\n');

      console.log('🔌 API ENDPOINTS:');
      console.log('  RETRIEVAL:');
      console.log('    GET  /api/v1/property/:propertyId');
      console.log('    GET  /api/v1/property/:propertyId/overview');
      console.log('    POST /api/v1/search/by-attributes');
      console.log('    POST /api/v1/search/by-text\n');

      console.log('  TRANSACTION:');
      console.log('    POST /api/v1/property/create');
      console.log('    POST /api/v1/property/transfer\n');

      console.log('  DOCUMENT:');
      console.log('    POST /api/v1/document/link');
      console.log('    GET  /api/v1/property/:propertyId/documents\n');

      console.log('  ADMIN:');
      console.log('    GET  /api/v1/config');
      console.log('    POST /api/v1/config/switch-network');
      console.log('    GET  /api/v1/health\n');

      console.log(`🌐 Visit http://localhost:${PORT}/api/v1/health to check status\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down gracefully...');
  if (landRegistryAPI) {
    await landRegistryAPI.shutdown();
  }
  process.exit(0);
});

module.exports = app;
