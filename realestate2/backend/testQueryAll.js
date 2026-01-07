const { getContract } = require('./fabric');

async function testQueryAll() {
  try {
    console.log('Testing GetAllLandRecords...');
    const { contract, gateway } = await getContract('admin');

    const result = await contract.evaluateTransaction('GetAllLandRecords');
    const records = JSON.parse(result.toString());
    
    console.log(`\nFound ${records.length} records in blockchain:\n`);
    records.forEach((record, index) => {
      console.log(`Record ${index + 1}:`);
      console.log(`  PropertyID: ${record.propertyId || record.PropertyID}`);
      console.log(`  Owner: ${record.owner || record.Owner}`);
      console.log(`  District: ${record.district || record.District}`);
      console.log(`  Mandal: ${record.mandal || record.Mandal}`);
      console.log(`  Village: ${record.village || record.Village}`);
      console.log(`  SurveyNo: ${record.surveyNo || record.SurveyNo}`);
      console.log('');
    });

    await gateway.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testQueryAll();
