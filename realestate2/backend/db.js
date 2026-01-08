const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// SQLite database connection
const dbPath = path.join(__dirname, '..', 'land_registry.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

// Promisify database operations
const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Initialize database tables
async function initializeDatabase() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS land_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id TEXT UNIQUE NOT NULL,
        survey_no TEXT NOT NULL,
        district TEXT NOT NULL,
        mandal TEXT NOT NULL,
        village TEXT NOT NULL,
        owner TEXT NOT NULL,
        area TEXT NOT NULL,
        land_type TEXT NOT NULL,
        market_value TEXT NOT NULL,
        last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
        transaction_id TEXT,
        block_number INTEGER,
        ipfs_cid TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await runQuery(createTableQuery);
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
  }
}

// Add sample data if table is empty
async function seedDatabase() {
  try {
    const countResult = await getQuery('SELECT COUNT(*) as count FROM land_records');
    
    if (countResult.count === 0) {
      const sampleRecords = [
        {
          property_id: 'PROP-1001',
          survey_no: '123/A',
          district: 'Hyderabad',
          mandal: 'Ghatkesar',
          village: 'Boduppal',
          owner: 'Ravi Kumar',
          area: '240 sq.yds',
          land_type: 'Residential',
          market_value: '₹ 45,00,000',
          transaction_id: 'tx-abc-001',
          block_number: 11,
          ipfs_cid: 'bafybeigdyrmockcid0001'
        },
        {
          property_id: 'PROP-2002',
          survey_no: '45/B',
          district: 'Nalgonda',
          mandal: 'Choutuppal',
          village: 'Chityal',
          owner: 'Suma Reddy',
          area: '1.5 acres',
          land_type: 'Agricultural',
          market_value: '₹ 62,00,000',
          transaction_id: 'tx-abc-002',
          block_number: 19,
          ipfs_cid: 'bafybeigdyrmockcid0002'
        },
        {
          property_id: 'PROP-3003',
          survey_no: '78/C',
          district: 'Warangal',
          mandal: 'Kazipet',
          village: 'Fathima Nagar',
          owner: 'Arjun Varma',
          area: '360 sq.yds',
          land_type: 'Residential',
          market_value: '₹ 55,00,000',
          transaction_id: 'tx-abc-003',
          block_number: 24,
          ipfs_cid: 'bafybeigdyrmockcid0003'
        },
        {
          property_id: 'PROP-4004',
          survey_no: '12/D',
          district: 'Karimnagar',
          mandal: 'Huzurabad',
          village: 'Kamalapur',
          owner: 'Meena Chowdary',
          area: '600 sq.yds',
          land_type: 'Residential',
          market_value: '₹ 68,00,000',
          transaction_id: 'tx-abc-004',
          block_number: 31,
          ipfs_cid: 'bafybeigdyrmockcid0004'
        }
      ];

      for (const record of sampleRecords) {
        await runQuery(
          `INSERT INTO land_records (property_id, survey_no, district, mandal, village, owner, area, land_type, market_value, transaction_id, block_number, ipfs_cid)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.property_id,
            record.survey_no,
            record.district,
            record.mandal,
            record.village,
            record.owner,
            record.area,
            record.land_type,
            record.market_value,
            record.transaction_id,
            record.block_number,
            record.ipfs_cid
          ]
        );
      }
      console.log('✅ Sample data seeded to database');
    }
  } catch (error) {
    console.error('❌ Database seeding error:', error.message);
  }
}

module.exports = {
  db,
  runQuery,
  allQuery,
  getQuery,
  initializeDatabase,
  seedDatabase
};
