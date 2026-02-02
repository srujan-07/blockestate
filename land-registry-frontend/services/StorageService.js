// StorageService.js - Secondary Storage Layer
// Database is ONLY for metadata, caching, and search indexes
// NEVER authoritative - ledger is the source of truth

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class StorageService {
    constructor() {
        this.dbPath = path.join(__dirname, '../land_registry.db');
        this.db = null;
    }

    // Initialize database connection
    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    // Create tables with ledger reference constraints
    async createTables() {
        const createPropertyCache = `
      CREATE TABLE IF NOT EXISTS property_cache (
        property_id TEXT PRIMARY KEY,
        ledger_tx_id TEXT NOT NULL,
        block_number INTEGER NOT NULL DEFAULT 0,
        last_ledger_sync DATETIME NOT NULL,
        cached_data TEXT,
        CHECK (ledger_tx_id IS NOT NULL AND ledger_tx_id != '')
      )
    `;

        const createPropertyDocuments = `
      CREATE TABLE IF NOT EXISTS property_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id TEXT NOT NULL,
        document_hash TEXT NOT NULL,
        document_type TEXT,
        file_url TEXT,
        linked_at_tx_id TEXT NOT NULL,
        linked_at_block INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES property_cache(property_id),
        CHECK (linked_at_tx_id IS NOT NULL AND linked_at_tx_id != '')
      )
    `;

        const createLedgerSyncLog = `
      CREATE TABLE IF NOT EXISTS ledger_sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id TEXT NOT NULL,
        sync_type TEXT NOT NULL,
        ledger_tx_id TEXT NOT NULL,
        block_number INTEGER NOT NULL DEFAULT 0,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(createPropertyCache);
                this.db.run(createPropertyDocuments);
                this.db.run(createLedgerSyncLog, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    /**
     * Cache property data from ledger
     * CRITICAL: Requires ledger txId and blockNumber
     * Database record CANNOT exist without ledger reference
     */
    async cachePropertyData(propertyId, ledgerData, txId, blockNumber) {
        if (!txId || txId === '') {
            throw new Error('Cannot cache property without ledger txId');
        }

        const query = `
      INSERT OR REPLACE INTO property_cache 
      (property_id, ledger_tx_id, block_number, last_ledger_sync, cached_data)
      VALUES (?, ?, ?, datetime('now'), ?)
    `;

        return new Promise((resolve, reject) => {
            this.db.run(
                query,
                [propertyId, txId, blockNumber, JSON.stringify(ledgerData)],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        // Log the sync
                        this.logLedgerSync(propertyId, 'CACHE_UPDATE', txId, blockNumber)
                            .then(() => resolve({ cached: true, propertyId }))
                            .catch(reject);
                    }
                }.bind(this)
            );
        });
    }

    /**
     * Get cached property data
     * ALWAYS returns ledger reference metadata
     */
    async getCachedProperty(propertyId) {
        const query = `
      SELECT property_id, ledger_tx_id, block_number, last_ledger_sync, cached_data
      FROM property_cache
      WHERE property_id = ?
    `;

        return new Promise((resolve, reject) => {
            this.db.get(query, [propertyId], (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    resolve({
                        propertyId: row.property_id,
                        ledgerTxId: row.ledger_tx_id,
                        blockNumber: row.block_number,
                        lastSync: row.last_ledger_sync,
                        data: JSON.parse(row.cached_data)
                    });
                }
            });
        });
    }

    /**
     * Get document metadata for a property
     * Returns file URLs, document hashes (supporting data only)
     */
    async getDocumentMetadata(propertyId) {
        const query = `
      SELECT document_hash, document_type, file_url, linked_at_tx_id, linked_at_block
      FROM property_documents
      WHERE property_id = ?
    `;

        return new Promise((resolve, reject) => {
            this.db.all(query, [propertyId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        documentHash: row.document_hash,
                        documentType: row.document_type,
                        fileUrl: row.file_url,
                        linkedAtTxId: row.linked_at_tx_id,
                        linkedAtBlock: row.linked_at_block
                    })));
                }
            });
        });
    }

    /**
     * Add document metadata
     * CRITICAL: Requires ledger txId reference
     */
    async addDocumentMetadata(propertyId, documentHash, documentType, fileUrl, txId, blockNumber) {
        if (!txId || txId === '') {
            throw new Error('Cannot add document without ledger txId');
        }

        const query = `
      INSERT INTO property_documents 
      (property_id, document_hash, document_type, file_url, linked_at_tx_id, linked_at_block)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

        return new Promise((resolve, reject) => {
            this.db.run(
                query,
                [propertyId, documentHash, documentType, fileUrl, txId, blockNumber],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ added: true, documentId: this.lastID });
                    }
                }
            );
        });
    }

    /**
     * Search properties using cached index
     * Returns property IDs only - caller must verify with ledger
     */
    async searchPropertiesIndex(criteria) {
        let query = 'SELECT property_id, ledger_tx_id, block_number FROM property_cache WHERE 1=1';
        const params = [];

        if (criteria.district) {
            query += ` AND json_extract(cached_data, '$.district') LIKE ?`;
            params.push(`%${criteria.district}%`);
        }

        if (criteria.mandal) {
            query += ` AND json_extract(cached_data, '$.mandal') LIKE ?`;
            params.push(`%${criteria.mandal}%`);
        }

        if (criteria.owner) {
            query += ` AND json_extract(cached_data, '$.owner') LIKE ?`;
            params.push(`%${criteria.owner}%`);
        }

        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        propertyId: row.property_id,
                        ledgerTxId: row.ledger_tx_id,
                        blockNumber: row.block_number,
                        note: 'Verify with ledger before using'
                    })));
                }
            });
        });
    }

    /**
     * Sync property from ledger to cache
     * Called after ledger query to update cache
     */
    async syncLedgerToCache(propertyId, ledgerData, txId, blockNumber) {
        return this.cachePropertyData(propertyId, ledgerData, txId, blockNumber);
    }

    /**
     * Log ledger synchronization
     * Audit trail of cache updates
     */
    async logLedgerSync(propertyId, syncType, txId, blockNumber) {
        const query = `
      INSERT INTO ledger_sync_log (property_id, sync_type, ledger_tx_id, block_number)
      VALUES (?, ?, ?, ?)
    `;

        return new Promise((resolve, reject) => {
            this.db.run(query, [propertyId, syncType, txId, blockNumber], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Get sync history for a property
     * Shows when cache was updated from ledger
     */
    async getSyncHistory(propertyId) {
        const query = `
      SELECT sync_type, ledger_tx_id, block_number, synced_at
      FROM ledger_sync_log
      WHERE property_id = ?
      ORDER BY synced_at DESC
      LIMIT 10
    `;

        return new Promise((resolve, reject) => {
            this.db.all(query, [propertyId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Close database connection
    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = new StorageService();
