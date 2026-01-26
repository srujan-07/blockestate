/**
 * LandRegistryAPI: Production-grade API orchestrator
 * 
 * Implements:
 * - Retrieval flow: Supabase (fast) + Fabric (authoritative)
 * - Transaction flow: Fabric first, then async Supabase update
 * - Role-based access control via X.509 attributes
 * - Clear separation of blockchain-verified vs off-chain data
 * - Comprehensive error handling and logging
 */

const FabricService = require('./FabricService');
const SupabaseService = require('./SupabaseService');
const { getNetworkConfig } = require('./NetworkConfig');

class LandRegistryAPI {
  constructor(fabricConfig = {}, supabaseConfig = {}) {
    this.fabric = new FabricService(fabricConfig);
    this.supabase = new SupabaseService(supabaseConfig);
    this.logger = {
      log: (msg) => console.log(`[LandRegistryAPI] ${msg}`),
      error: (msg) => console.error(`[LandRegistryAPI] ❌ ${msg}`),
      warn: (msg) => console.warn(`[LandRegistryAPI] ⚠️ ${msg}`),
      info: (msg) => console.log(`[LandRegistryAPI] ℹ️ ${msg}`),
    };
  }

  /**
   * Initialize API (must be called before any operation)
   * @param {string} identityName - Identity to use for Fabric transactions
   */
  async initialize(identityName = 'admin') {
    try {
      await this.fabric.connect(identityName);
      const supabaseOk = this.supabase.isAvailable();
      this.logger.log(`Initialized with Fabric (connected) and Supabase (${supabaseOk ? 'ready' : 'unavailable'})`);
    } catch (error) {
      this.logger.error(`Initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Shutdown API gracefully
   */
  async shutdown() {
    await this.fabric.disconnect();
    this.logger.log('Shutdown complete');
  }

  /**
   * RETRIEVAL: Get property by Property ID
   * Flow: Supabase (fast) → Fabric (verify) → Merge
   * 
   * @param {string} propertyId - LRI-IND-<STATE>-<YEAR>-<SEQUENCE> format
   * @param {Object} options - { verifyOnChain: bool, includeHistory: bool }
   * @returns {Object} Merged property data with verification status
   */
  async getPropertyById(propertyId, options = {}) {
    const verifyOnChain = options.verifyOnChain !== false; // Default: true
    const includeHistory = options.includeHistory === true;

    this.logger.log(`getPropertyById: ${propertyId}`);

    try {
      // Step 1: Fast lookup in Supabase
      let supabaseData = null;
      if (this.supabase.isAvailable()) {
        try {
          supabaseData = await this.supabase.queryByPropertyId(propertyId);
        } catch (error) {
          this.logger.warn(`Supabase lookup failed: ${error.message}`);
        }
      }

      // Step 2: Verify on blockchain (if available)
      let fabricData = null;
      let fabricHistory = null;
      if (verifyOnChain) {
        try {
          fabricData = await this.fabric.evaluateTransaction('ReadLandRecord', propertyId);

          if (includeHistory) {
            fabricHistory = await this.fabric.evaluateTransaction('GetTransactionHistory', propertyId);
          }
        } catch (error) {
          // Property not on blockchain yet
          if (!error.message.includes('does not exist')) {
            this.logger.warn(`Fabric lookup failed: ${error.message}`);
          }
        }
      }

      // Step 3: Merge results
      const response = {
        propertyId,
        source: {
          blockchain: fabricData ? 'verified' : 'not-found',
          offchain: supabaseData ? 'available' : 'not-found',
        },
        blockchain: null,
        offchain: null,
        mergedView: null,
      };

      // Blockchain-verified fields
      if (fabricData) {
        response.blockchain = {
          owner: fabricData.owner,
          surveyNo: fabricData.surveyNo,
          district: fabricData.district,
          mandal: fabricData.mandal,
          village: fabricData.village,
          area: fabricData.area,
          landType: fabricData.landType,
          marketValue: fabricData.marketValue,
          lastUpdated: fabricData.lastUpdated,
          ipfsCID: fabricData.ipfsCID,
          verificationBadge: '✅ BLOCKCHAIN-VERIFIED',
        };
      }

      // Off-chain data
      if (supabaseData) {
        response.offchain = {
          id: supabaseData.id,
          surveyNo: supabaseData.survey_no,
          district: supabaseData.district,
          mandal: supabaseData.mandal,
          village: supabaseData.village,
          owner: supabaseData.owner,
          area: supabaseData.area,
          landType: supabaseData.land_type,
          marketValue: supabaseData.market_value,
          lastUpdated: supabaseData.last_updated,
          verificationStatus: supabaseData.verification_status,
          transactionId: supabaseData.transaction_id,
          blockNumber: supabaseData.block_number,
        };
      }

      // Merged view (prefer blockchain for critical fields)
      if (fabricData || supabaseData) {
        response.mergedView = {
          propertyId,
          owner: fabricData?.owner || supabaseData?.owner,
          surveyNo: fabricData?.surveyNo || supabaseData?.survey_no,
          district: fabricData?.district || supabaseData?.district,
          mandal: fabricData?.mandal || supabaseData?.mandal,
          village: fabricData?.village || supabaseData?.village,
          area: fabricData?.area || supabaseData?.area,
          landType: fabricData?.landType || supabaseData?.land_type,
          marketValue: fabricData?.marketValue || supabaseData?.market_value,
          lastUpdated: fabricData?.lastUpdated || supabaseData?.last_updated,
          isBlockchainVerified: !!fabricData,
        };
      }

      // Add transaction history if requested
      if (includeHistory && fabricHistory) {
        response.transactionHistory = fabricHistory;
      }

      if (!response.mergedView) {
        throw new Error(`Property ${propertyId} not found on blockchain or in database`);
      }

      this.logger.log(`✅ Retrieved property ${propertyId}`);
      return response;
    } catch (error) {
      this.logger.error(`getPropertyById failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * RETRIEVAL: Search by land attributes
   * Flow: Supabase (indexed search) → Fabric (verify each result)
   * 
   * @param {Object} criteria - { district, mandal, village, surveyNo }
   * @param {Object} options - { verifyOnChain: bool }
   * @returns {Array} Array of properties with verification status
   */
  async searchByAttributes(criteria = {}, options = {}) {
    const verifyOnChain = options.verifyOnChain !== false;

    this.logger.log(`searchByAttributes: ${JSON.stringify(criteria)}`);

    try {
      // Step 1: Fast search in Supabase
      let results = [];
      if (this.supabase.isAvailable()) {
        try {
          results = await this.supabase.queryByAttributes(criteria);
        } catch (error) {
          this.logger.warn(`Supabase search failed: ${error.message}`);
        }
      }

      if (results.length === 0) {
        throw new Error(`No properties found matching criteria: ${JSON.stringify(criteria)}`);
      }

      // Step 2: Verify each result on blockchain
      const verified = [];
      for (const result of results) {
        let fabricData = null;
        try {
          if (verifyOnChain && result.property_id) {
            fabricData = await this.fabric.evaluateTransaction('ReadLandRecord', result.property_id);
          }
        } catch (error) {
          // Log but continue - blockchain verification is optional
          this.logger.warn(`Failed to verify ${result.property_id} on blockchain: ${error.message}`);
        }

        verified.push({
          propertyId: result.property_id,
          surveyNo: result.survey_no,
          district: result.district,
          mandal: result.mandal,
          village: result.village,
          owner: result.owner,
          area: result.area,
          landType: result.land_type,
          marketValue: result.market_value,
          isBlockchainVerified: !!fabricData,
          verificationBadge: fabricData ? '✅' : '⏳',
        });
      }

      this.logger.log(`✅ Found ${verified.length} properties matching criteria`);
      return verified;
    } catch (error) {
      this.logger.error(`searchByAttributes failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * RETRIEVAL: Search by text (full-text search on address/location)
   * 
   * @param {string} searchTerm - Search query
   * @param {Object} options - { verifyOnChain: bool }
   * @returns {Array} Matching properties
   */
  async searchByText(searchTerm, options = {}) {
    const verifyOnChain = options.verifyOnChain !== false;

    this.logger.log(`searchByText: "${searchTerm}"`);

    try {
      if (!this.supabase.isAvailable()) {
        throw new Error('Supabase required for text search');
      }

      const results = await this.supabase.searchByText(searchTerm);

      if (results.length === 0) {
        throw new Error(`No properties found matching: "${searchTerm}"`);
      }

      // Verify on blockchain
      const verified = [];
      for (const result of results) {
        let fabricData = null;
        try {
          if (verifyOnChain && result.property_id) {
            fabricData = await this.fabric.evaluateTransaction('ReadLandRecord', result.property_id);
          }
        } catch (error) {
          this.logger.warn(`Failed to verify ${result.property_id} on blockchain`);
        }

        verified.push({
          propertyId: result.property_id,
          surveyNo: result.survey_no,
          district: result.district,
          mandal: result.mandal,
          village: result.village,
          owner: result.owner,
          isBlockchainVerified: !!fabricData,
        });
      }

      this.logger.log(`✅ Found ${verified.length} properties matching "${searchTerm}"`);
      return verified;
    } catch (error) {
      this.logger.error(`searchByText failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * TRANSACTION: Create new land property
   * Flow: Fabric (generate ID + persist) → Supabase (async index)
   * 
   * @param {Object} data - { owner, surveyNo, district, mandal, village, area, landType, marketValue, state, ipfsCID }
   * @param {string} identity - Identity to use for transaction
   * @returns {Object} { success, propertyId, transactionId, error? }
   */
  async createProperty(data, identity = 'registrar1') {
    this.logger.log(`createProperty: ${data.surveyNo} in ${data.district}`);

    try {
      // Switch identity if needed
      if (this.fabric.currentIdentity !== identity) {
        await this.fabric.switchIdentity(identity);
      }

      // Submit transaction to Fabric
      const result = await this.fabric.submitTransaction(
        'CreateLandRecord',
        data.owner,
        data.surveyNo,
        data.district,
        data.mandal,
        data.village,
        data.area,
        data.landType,
        data.marketValue,
        data.state,
        data.ipfsCID || ''
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      const landRecord = result.data;
      const propertyId = landRecord.propertyId;

      // Async: Update Supabase
      setImmediate(async () => {
        try {
          if (this.supabase.isAvailable()) {
            await this.supabase.insertRecord({
              propertyId,
              surveyNo: data.surveyNo,
              district: data.district,
              mandal: data.mandal,
              village: data.village,
              owner: data.owner,
              area: data.area,
              landType: data.landType,
              marketValue: data.marketValue,
              transactionId: result.txId,
              ipfsCID: data.ipfsCID,
            });
            this.logger.log(`✅ Indexed property ${propertyId} in Supabase`);
          }
        } catch (error) {
          this.logger.warn(`Failed to index property ${propertyId} in Supabase: ${error.message}`);
        }
      });

      this.logger.log(`✅ Created property ${propertyId}`);
      return {
        success: true,
        propertyId,
        transactionId: result.txId,
        blockchainData: landRecord,
      };
    } catch (error) {
      this.logger.error(`createProperty failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * TRANSACTION: Transfer property ownership
   * Flow: Fabric (approve + persist) → Supabase (async update)
   * 
   * @param {Object} data - { propertyId, newOwner, approvalStatus }
   * @param {string} identity - Registrar identity
   * @returns {Object} { success, propertyId, transactionId, error? }
   */
  async transferProperty(data, identity = 'registrar1') {
    this.logger.log(`transferProperty: ${data.propertyId} to ${data.newOwner}`);

    try {
      // Switch identity
      if (this.fabric.currentIdentity !== identity) {
        await this.fabric.switchIdentity(identity);
      }

      // Submit transaction to Fabric
      const result = await this.fabric.submitTransaction(
        'TransferLandRecord',
        data.propertyId,
        data.newOwner,
        data.approvalStatus
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // Async: Update Supabase
      setImmediate(async () => {
        try {
          if (this.supabase.isAvailable()) {
            await this.supabase.updateRecord(data.propertyId, {
              owner: data.newOwner,
              transaction_id: result.txId,
              verification_status: data.approvalStatus,
            });
            this.logger.log(`✅ Updated property ${data.propertyId} in Supabase`);
          }
        } catch (error) {
          this.logger.warn(`Failed to update property ${data.propertyId} in Supabase: ${error.message}`);
        }
      });

      this.logger.log(`✅ Transferred property ${data.propertyId}`);
      return {
        success: true,
        propertyId: data.propertyId,
        transactionId: result.txId,
        blockchainData: result.data,
      };
    } catch (error) {
      this.logger.error(`transferProperty failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * TRANSACTION: Link document to property (audit trail)
   * 
   * @param {Object} data - { propertyId, documentHash, documentType, fileUrl }
   * @param {string} identity - Registrar identity
   * @returns {Object} { success, propertyId, error? }
   */
  async linkDocument(data, identity = 'registrar1') {
    this.logger.log(`linkDocument: ${data.documentType} for ${data.propertyId}`);

    try {
      // Switch identity
      if (this.fabric.currentIdentity !== identity) {
        await this.fabric.switchIdentity(identity);
      }

      // Submit to Fabric
      const result = await this.fabric.submitTransaction(
        'LinkDocumentHash',
        data.propertyId,
        data.documentHash,
        data.documentType
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // Async: Store metadata in Supabase
      setImmediate(async () => {
        try {
          if (this.supabase.isAvailable()) {
            await this.supabase.storeDocumentMetadata({
              propertyId: data.propertyId,
              documentHash: data.documentHash,
              documentType: data.documentType,
              fileUrl: data.fileUrl,
            });
            this.logger.log(`✅ Stored document metadata in Supabase`);
          }
        } catch (error) {
          this.logger.warn(`Failed to store document metadata: ${error.message}`);
        }
      });

      this.logger.log(`✅ Linked document to property ${data.propertyId}`);
      return {
        success: true,
        propertyId: data.propertyId,
      };
    } catch (error) {
      this.logger.error(`linkDocument failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get comprehensive property overview (blockchain + off-chain)
   * Includes transaction history and linked documents
   * 
   * @param {string} propertyId - Property ID
   * @returns {Object} Complete property view
   */
  async getPropertyOverview(propertyId) {
    this.logger.log(`getPropertyOverview: ${propertyId}`);

    try {
      // Get property with history
      const propertyData = await this.getPropertyById(propertyId, {
        verifyOnChain: true,
        includeHistory: true,
      });

      // Get linked documents
      let documents = [];
      if (this.supabase.isAvailable()) {
        try {
          documents = await this.supabase.getDocumentsForProperty(propertyId);
        } catch (error) {
          this.logger.warn(`Failed to fetch documents: ${error.message}`);
        }
      }

      return {
        property: propertyData,
        documents: documents.map((doc) => ({
          hash: doc.document_hash,
          type: doc.document_type,
          fileUrl: doc.file_url,
          uploadedAt: doc.uploaded_at,
          verifiedOnChain: doc.verified_on_chain,
        })),
      };
    } catch (error) {
      this.logger.error(`getPropertyOverview failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Health check: Fabric + Supabase status
   * @returns {Object} Status of both systems
   */
  async healthCheck() {
    const fabricHealth = await this.fabric.healthCheck();
    const supabaseHealth = await this.supabase.healthCheck();

    return {
      fabric: fabricHealth,
      supabase: supabaseHealth,
      healthy: fabricHealth.healthy && supabaseHealth,
    };
  }
}

module.exports = LandRegistryAPI;
