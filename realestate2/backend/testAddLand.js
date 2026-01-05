const { getContract } = require('./fabric');

async function addTestLandRecord() {
  try {
    const { contract, gateway } = await getContract('admin');
    
    // Add PROP-1001 to blockchain
    const result = await contract.submitTransaction(
      'CreateLandRecord',
      'PROP-2002',          // propertyId
      'Suma Reddy',         // owner
      '45/B',              // surveyNo
      'Nalgonda',          // district
      'Choutuppal',          // mandal
      'Chityal',           // village
      '1.5 acres',         // area
      'Agricultural',        // landType
      '₹ 62,00,000',       // marketValue
      'bafybeigdyrmockcid0002'  // ipfsCID
    );
    
    console.log('✅ Land record created:', result.toString());
    await gateway.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addTestLandRecord();
