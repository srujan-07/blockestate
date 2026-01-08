const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'land_registry'
});

// Initialize database tables
async function initializeDatabase() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS land_records (
        id SERIAL PRIMARY KEY,
        property_id VARCHAR(50) UNIQUE NOT NULL,
        survey_no VARCHAR(50) NOT NULL,
        district VARCHAR(100) NOT NULL,
        mandal VARCHAR(100) NOT NULL,
        village VARCHAR(100) NOT NULL,
        owner VARCHAR(100) NOT NULL,
        area VARCHAR(100) NOT NULL,
        land_type VARCHAR(50) NOT NULL,
        market_value VARCHAR(100) NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        transaction_id VARCHAR(100),
        block_number INTEGER,
        ipfs_cid VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(createTableQuery);
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
  }
}

// Add sample data if table is empty
async function seedDatabase() {
  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM land_records');
    
    if (parseInt(countResult.rows[0].count) === 0) {
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
        await pool.query(
          `INSERT INTO land_records (property_id, survey_no, district, mandal, village, owner, area, land_type, market_value, transaction_id, block_number, ipfs_cid)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
  pool,
  initializeDatabase,
  seedDatabase
};
