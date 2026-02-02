/**
 * StorageService: Database-only operations
 * 
 * ARCHITECTURE:
 * - Database is SECONDARY (indexing, documents, fast lookups)
 * - Database NEVER overrides ledger state
 * - Used for: document storage, search indexing, caching
 * - All authoritative data comes from ledger
 */

const { allQuery, insertQuery, updateQuery } = require('../db');

class StorageService {
  constructor() {
    this.available = true; // Assume database is available
  }

  /**
   * Check if storage service is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.available;
  }

  /**
   * Sync ledger data to database cache
   * Used for fast lookups and indexing
   * NEVER overrides ledger state - only syncs for read optimization
   * 
   * @param {string} propertyId - Property ID
   * @param {Object} propertyData - Property data from ledger
   * @param {string} transactionId - Transaction ID from ledger
   * @param {number} blockNumber - Block number from ledger
   */
  async syncLedgerToCache(propertyId, propertyData, transactionId, blockNumber) {
    if (!this.isAvailable()) {
      return;
    }

    try {
      // Check if record exists
      const existing = await allQuery({ property_id: propertyId });

      const recordData = {
        property_id: propertyId,
        survey_no: propertyData.surveyNo || propertyData.survey_no,
        district: propertyData.district,
        mandal: propertyData.mandal,
        village: propertyData.village,
        owner: propertyData.owner,
        area: propertyData.area,
        land_type: propertyData.landType || propertyData.land_type,
        market_value: propertyData.marketValue || propertyData.market_value,
        transaction_id: transactionId,
        block_number: blockNumber || 0,
        ipfs_cid: propertyData.ipfsCID || propertyData.ipfs_cid || null,
        verification_status: propertyData.verifiedByCCLB ? 'verified' : 'pending',
        last_updated: propertyData.lastUpdated || propertyData.last_updated || new Date().toISOString(),
      };

      if (existing && existing.length > 0) {
        // Update existing record (sync from ledger)
        await updateQuery(propertyId, recordData);
      } else {
        // Insert new record (sync from ledger)
        await insertQuery(recordData);
      }
    } catch (error) {
      console.warn(`[StorageService] Failed to sync ledger to cache: ${error.message}`);
    }
  }

  /**
   * Get document metadata for a property
   * Documents are stored off-chain, metadata in database
   * 
   * @param {string} propertyId - Property ID
   * @returns {Array} Document metadata
   */
  async getDocumentMetadata(propertyId) {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      // In a real implementation, query document metadata table
      // For now, return empty array
      return [];
    } catch (error) {
      console.warn(`[StorageService] Failed to get document metadata: ${error.message}`);
      return [];
    }
  }

  /**
   * Store document metadata
   * Documents themselves are stored off-chain (IPFS, S3, etc.)
   * 
   * @param {Object} documentData - Document metadata
   */
  async storeDocumentMetadata(documentData) {
    if (!this.isAvailable()) {
      return;
    }

    try {
      // In a real implementation, insert into documents table
      // For now, just log
      console.log(`[StorageService] Document metadata stored: ${documentData.propertyId}`);
    } catch (error) {
      console.warn(`[StorageService] Failed to store document metadata: ${error.message}`);
    }
  }

  /**
   * Health check
   * @returns {Object} Health status
   */
  async healthCheck() {
    try {
      await allQuery({});
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = StorageService;
