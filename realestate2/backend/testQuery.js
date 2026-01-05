const { getContract } = require('./fabric');

async function testQuery() {
  try {
    console.log('Testing ReadLandRecord...');
    const { contract, gateway } = await getContract('admin');
    
    const result = await contract.evaluateTransaction('ReadLandRecord', 'PROP-2002');
    console.log('✅ Query result:', JSON.parse(result.toString()));
    
    await gateway.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testQuery();
