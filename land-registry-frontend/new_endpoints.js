// 6. Verify Property State on Ledger
app.post('/api/land/verify', async (req, res) => {
    try {
        const { propertyId, expectedOwner } = req.body;

        console.log(`🔍 Verifying property state: ${propertyId}`);

        const verification = await LedgerService.verifyPropertyState(propertyId, expectedOwner);

        res.json(verification);
    } catch (error) {
        console.error('❌ Verification error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 7. Get Transaction History from Ledger
app.get('/api/land/history/:propertyId', async (req, res) => {
    try {
        const { propertyId } = req.params;

        console.log(`🔍 Fetching transaction history for: ${propertyId}`);

        const history = await LedgerService.getPropertyHistory(propertyId);

        res.json(history);
    } catch (error) {
        console.error('❌ History error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 8. Get All Properties with Ledger Metadata
app.get('/api/land/all', async (req, res) => {
    try {
        console.log('🔍 Fetching all properties from ledger');

        const properties = await LedgerService.getAllPropertiesWithMetadata();

        // Format for frontend
        const formattedProperties = properties.map(p => ({
            propertyId: p.property.propertyId,
            owner: p.property.owner,
            district: p.property.district,
            mandal: p.property.mandal,
            village: p.property.village,
            surveyNo: p.property.surveyNo,
            area: p.property.area,
            landType: p.property.landType,
            marketValue: p.property.marketValue,
            transactionId: p.ledgerMetadata.txId,
            blockNumber: p.ledgerMetadata.blockNumber,
            ledgerVerified: true
        }));

        res.json({
            records: formattedProperties,
            count: formattedProperties.length,
            ledgerVerified: true
        });
    } catch (error) {
        console.error('❌ Error fetching all properties:', error);
        res.status(500).json({ error: error.message });
    }
});

// 9. Get Endorsement Details for Transaction
app.get('/api/land/endorsements/:txId', async (req, res) => {
    try {
        const { txId } = req.params;

        console.log(`🔍 Validating endorsements for txId: ${txId}`);

        const endorsementInfo = await LedgerService.validateEndorsement(txId);

        res.json(endorsementInfo);
    } catch (error) {
        console.error('❌ Endorsement validation error:', error);
        res.status(500).json({ error: error.message });
    }
});
