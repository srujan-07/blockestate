/**
 * SupabaseService: Off-chain data storage and fast retrieval layer
 * 
 * Responsibilities:
 * - Metadata storage (document references, human-readable details)
 * - Fast filtering and search (indexed PostgreSQL queries)
 * - Transaction reference tracking (txId, blockNumber)
 * - Asynchronous updates after Fabric commits
 * 
 * IMPORTANT: Supabase is NEVER the source of truth
 * Blockchain (Fabric) is the system of record
 */

const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
  constructor(config = {}) {
    this.config = {
      url: config.url || process.env.SUPABASE_URL,
      key: config.key || process.env.SUPABASE_KEY,
      tableName: config.tableName || 'land_records',
    };

    this.client = null;
    this.initialized = false;

    if (this.config.url && this.config.key) {
      try {
        this.client = createClient(this.config.url, this.config.key);
        this.initialized = true;
        console.log('✅ SupabaseService initialized');
      } catch (error) {
        console.error('❌ SupabaseService initialization failed:', error.message);
      }
    } else {
      console.warn('⚠️ SupabaseService: Missing SUPABASE_URL or SUPABASE_KEY');
    }
  }

  /**
   * Check if Supabase is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.initialized && this.client !== null;
  }

  /**
   * Query by Property ID (fast lookup)
   * @param {string} propertyId - LRI-IND-<STATE>-<YEAR>-<SEQUENCE> format
   * @returns {Object|null} Land record metadata or null if not found
   */
  async queryByPropertyId(propertyId) {
    if (!this.client) {
      throw new Error('SupabaseService not initialized');
    }

    try {
      const { data, error } = await this.client
        .from(this.config.tableName)
        .select('*')
        .eq('property_id', propertyId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is ok
        throw error;
      }

      return data || null;
    } catch (error) {
      throw new Error(`[queryByPropertyId] ${error.message}`);
    }
  }

  /**
   * Query by land attributes (survey number, location)
   * Fast indexed search
   * @param {Object} filters - { district, mandal, village, surveyNo }
   * @returns {Array} Matching land records
   */
  async queryByAttributes(filters = {}) {
    if (!this.client) {
      throw new Error('SupabaseService not initialized');
    }

    try {
      let query = this.client.from(this.config.tableName).select('*');

      // Add equality filters
      if (filters.district) query = query.eq('district', filters.district);
      if (filters.mandal) query = query.eq('mandal', filters.mandal);
      if (filters.village) query = query.eq('village', filters.village);
      if (filters.surveyNo) query = query.eq('survey_no', filters.surveyNo);

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`[queryByAttributes] ${error.message}`);
    }
  }

  /**
   * Full-text search on address or description
   * @param {string} searchTerm - Search query
   * @returns {Array} Matching records
   */
  async searchByText(searchTerm) {
    if (!this.client) {
      throw new Error('SupabaseService not initialized');
    }

    try {
      const { data, error } = await this.client
        .from(this.config.tableName)
        .select('*')
        .or(`district.ilike.%${searchTerm}%,mandal.ilike.%${searchTerm}%,village.ilike.%${searchTerm}%`);

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`[searchByText] ${error.message}`);
    }
  }

  /**
   * Get all records (with optional pagination)
   * @param {number} limit - Max records to return (default 100)
   * @param {number} offset - Pagination offset (default 0)
   * @returns {Array} Land records
   */
  async getAll(limit = 100, offset = 0) {
    if (!this.client) {
      throw new Error('SupabaseService not initialized');
    }

    try {
      const { data, error } = await this.client
        .from(this.config.tableName)
        .select('*')
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`[getAll] ${error.message}`);
    }
  }

  /**
   * Insert a new land record (called after Fabric transaction success)
   * @param {Object} data - Land record metadata from blockchain
   * @returns {Object} Inserted record
   */
  async insertRecord(data) {
    if (!this.client) {
      throw new Error('SupabaseService not initialized');
    }

    try {
      const recordData = {
        property_id: data.propertyId,
        survey_no: data.surveyNo,
        district: data.district,
        mandal: data.mandal,
        village: data.village,
        owner: data.owner,
        area: data.area,
        land_type: data.landType,
        market_value: data.marketValue,
        transaction_id: data.transactionId,
        block_number: data.blockNumber,
        ipfs_cid: data.ipfsCID || null,
        last_updated: new Date().toISOString(),
        verification_status: 'pending', // Will be updated after Fabric confirmation
      };

      const { data: result, error } = await this.client
        .from(this.config.tableName)
        .insert([recordData])
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      throw new Error(`[insertRecord] ${error.message}`);
    }
  }

  /**
   * Update land record after blockchain transaction
   * @param {string} propertyId - Property ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated record
   */
  async updateRecord(propertyId, updates) {
    if (!this.client) {
      throw new Error('SupabaseService not initialized');
    }

    try {
      const updateData = {
        ...updates,
        last_updated: new Date().toISOString(),
      };

      const { data: result, error } = await this.client
        .from(this.config.tableName)
        .update(updateData)
        .eq('property_id', propertyId)
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      throw new Error(`[updateRecord] ${error.message}`);
    }
  }

  /**
   * Update verification status after blockchain confirmation
   * @param {string} propertyId - Property ID
   * @param {string} status - 'verified', 'pending', 'failed'
   * @param {Object} blockchainData - From blockchain transaction
   */
  async updateVerificationStatus(propertyId, status, blockchainData = {}) {
    if (!this.client) {
      throw new Error('SupabaseService not initialized');
    }

    try {
      const { data: result, error } = await this.client
        .from(this.config.tableName)
        .update({
          verification_status: status,
          transaction_id: blockchainData.txId || null,
          block_number: blockchainData.blockNumber || null,
          verified_at: status === 'verified' ? new Date().toISOString() : null,
          last_updated: new Date().toISOString(),
        })
        .eq('property_id', propertyId)
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      throw new Error(`[updateVerificationStatus] ${error.message}`);
    }
  }

  /**
   * Store document metadata
   * @param {Object} docData - { propertyId, documentHash, documentType, fileUrl }
   * @returns {Object} Stored document metadata
   */
  async storeDocumentMetadata(docData) {
    if (!this.client) {
      throw new Error('SupabaseService not initialized');
    }

    try {
      const documentData = {
        property_id: docData.propertyId,
        document_hash: docData.documentHash,
        document_type: docData.documentType,
        file_url: docData.fileUrl || null,
        uploaded_at: new Date().toISOString(),
        verified_on_chain: false,
      };

      const { data: result, error } = await this.client
        .from('document_metadata')
        .insert([documentData])
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      throw new Error(`[storeDocumentMetadata] ${error.message}`);
    }
  }

  /**
   * Get documents for a property
   * @param {string} propertyId - Property ID
   * @returns {Array} Document metadata
   */
  async getDocumentsForProperty(propertyId) {
    if (!this.client) {
      throw new Error('SupabaseService not initialized');
    }

    try {
      const { data, error } = await this.client
        .from('document_metadata')
        .select('*')
        .eq('property_id', propertyId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`[getDocumentsForProperty] ${error.message}`);
    }
  }

  /**
   * Health check - test database connection
   * @returns {boolean} True if connected and healthy
   */
  async healthCheck() {
    if (!this.client) {
      return false;
    }

    try {
      const { error } = await this.client
        .from(this.config.tableName)
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      console.error('SupabaseService health check failed:', error.message);
      return false;
    }
  }
}

module.exports = SupabaseService;
