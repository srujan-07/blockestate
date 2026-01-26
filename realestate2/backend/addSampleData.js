const { getContract } = require('./fabric');

async function addSampleRecords() {
  try {
    const identity = process.env.IDENTITY || 'admin';
    const { contract, gateway } = await getContract(identity);

    // Add multiple sample records
    const records = [
      {
        owner: 'Ravi Kumar',
        surveyNo: '123/A',
        district: 'Hyderabad',
        mandal: 'Ghatkesar',
        village: 'Boduppal',
        area: '240 sq.yds',
        landType: 'Residential',
        marketValue: '₹ 45,00,000',
        state: 'Telangana'
      },
      {
        owner: 'Suma Reddy',
        surveyNo: '45/B',
        district: 'Nalgonda',
        mandal: 'Choutuppal',
        village: 'Chityal',
        area: '1.5 acres',
        landType: 'Agricultural',
        marketValue: '₹ 62,00,000',
        state: 'Telangana'
      },
      {
        owner: 'Arjun Varma',
        surveyNo: '78/C',
        district: 'Warangal',
        mandal: 'Kazipet',
        village: 'Fathima Nagar',
        area: '360 sq.yds',
        landType: 'Residential',
        marketValue: '₹ 55,00,000',
        state: 'Telangana'
      }
    ];

    for (const record of records) {
      try {
        const result = await contract.submitTransaction(
          'CreateLandRecord',
          record.owner,
          record.surveyNo,
          record.district,
          record.mandal,
          record.village,
          record.area,
          record.landType,
          record.marketValue,
          record.state || 'Telangana',
          record.ipfsCID || 'N/A'
        );

        const created = JSON.parse(result.toString());
        console.log(`✅ Created: ${created.propertyId} - ${record.district}/${record.mandal}/${record.village}/${record.surveyNo}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  Skipped: ${record.propertyId} (already exists)`);
        } else {
          console.error(`❌ Error creating ${record.propertyId}:`, error.message);
        }
      }
    }

    await gateway.disconnect();
    console.log('\n✅ Sample data loading complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

addSampleRecords();
