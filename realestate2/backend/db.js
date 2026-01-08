const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (error) {
    console.warn('⚠️ Supabase initialization failed:', error.message);
  }
}

// Query helpers for Supabase
const getQuery = async (filters = {}) => {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }
  let query = supabase.from('land_records').select('*');
  
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  
  const { data, error } = await query.single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

const allQuery = async (filters = {}) => {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }
  let query = supabase.from('land_records').select('*');
  
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data || [];
};

const insertQuery = async (data) => {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }
  const { data: result, error } = await supabase
    .from('land_records')
    .insert([data])
    .select();
  
  if (error) throw error;
  return result?.[0];
};

const updateQuery = async (id, data) => {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }
  const { data: result, error } = await supabase
    .from('land_records')
    .update(data)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return result?.[0];
};

// Initialize database (test connection)
async function initializeDatabase() {
  try {
    if (!supabase) {
      console.log('⚠️ Supabase not configured, skipping initialization');
      return false;
    }
    // Test connection
    const { data, error } = await supabase.from('land_records').select('*').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    console.log('✅ Connected to Supabase');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error.message);
    return false;
  }
}

// Seed database with sample data if empty
async function seedDatabase() {
  try {
    if (!supabase) {
      console.log('⚠️ Supabase not configured, skipping seeding');
      return false;
    }
    const { count, error: countError } = await supabase
      .from('land_records')
      .select('id', { count: 'exact' });
    
    if (countError) throw countError;
    
    if (count === 0) {
      const sampleData = [
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
          block_number: 11
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
          block_number: 19
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
          block_number: 24
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
          block_number: 31
        }
      ];
      
      const { error: insertError } = await supabase
        .from('land_records')
        .insert(sampleData);
      
      if (insertError) throw insertError;
      console.log('✅ Sample data seeded to database');
    }
  } catch (error) {
    console.error('❌ Seeding error:', error.message);
  }
}

module.exports = {
  supabase,
  getQuery,
  allQuery,
  insertQuery,
  updateQuery,
  initializeDatabase,
  seedDatabase
};
