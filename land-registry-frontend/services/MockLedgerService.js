// MockLedgerService.js - Development Mode (No Blockchain Required)
// Use this when Fabric network is not running
// Returns simulated ledger metadata for testing

class MockLedgerService {
    constructor() {
        this.mockData = new Map();
        this.initializeMockData();
    }

    initializeMockData() {
        // Sample property data
        this.mockData.set('PROP-1001', {
            propertyId: 'PROP-1001',
            owner: 'Rajesh Kumar',
            surveyNo: '123/A',
            district: 'Hyderabad',
            mandal: 'Serilingampally',
            village: 'Gachibowli',
            area: '500 sq yards',
            landType: 'Residential',
            marketValue: '₹50,00,000',
            lastUpdated: '2024-01-15',
            verifiedByCCLB: true
        });

        this.mockData.set('PROP-1002', {
            propertyId: 'PROP-1002',
            owner: 'Priya Sharma',
            surveyNo: '456/B',
            district: 'Hyderabad',
            mandal: 'Kukatpally',
            village: 'Miyapur',
            area: '300 sq yards',
            landType: 'Residential',
            marketValue: '₹35,00,000',
            lastUpdated: '2024-02-01',
            verifiedByCCLB: true
        });
    }

    async getGateway() {
        console.log('⚠️  MOCK MODE: Using simulated ledger data');
        return null;
    }

    async getContract() {
        return { contract: null, gateway: null };
    }

    async queryPropertyFromLedger(propertyId) {
        console.log(`🔍 MOCK: Querying property ${propertyId}`);

        const property = this.mockData.get(propertyId);
        if (!property) {
            throw new Error(`Property ${propertyId} not found`);
        }

        // Simulate real ledger metadata
        return {
            property: property,
            ledgerMetadata: {
                txId: `mock-tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                blockNumber: Math.floor(Math.random() * 1000) + 100,
                timestamp: new Date().toISOString(),
                endorsements: ['CCLEBMSP', 'StateOrgTSMSP'],
                channelId: 'mychannel',
                isVerified: true
            }
        };
    }

    async queryPropertyBySurvey(district, mandal, village, surveyNo) {
        console.log(`🔍 MOCK: Querying by survey ${district}/${mandal}/${village}/${surveyNo}`);

        // Find property by survey details
        for (const [id, property] of this.mockData.entries()) {
            if (property.district.toLowerCase().includes(district.toLowerCase()) &&
                property.mandal.toLowerCase().includes(mandal.toLowerCase()) &&
                property.village.toLowerCase().includes(village.toLowerCase()) &&
                property.surveyNo === surveyNo) {

                return {
                    property: property,
                    ledgerMetadata: {
                        txId: `mock-tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        blockNumber: Math.floor(Math.random() * 1000) + 100,
                        timestamp: new Date().toISOString(),
                        endorsements: ['CCLEBMSP', 'StateOrgTSMSP'],
                        channelId: 'mychannel',
                        isVerified: true
                    }
                };
            }
        }

        throw new Error('Property not found');
    }

    async verifyPropertyState(propertyId, expectedOwner) {
        console.log(`🔍 MOCK: Verifying property ${propertyId}`);

        const property = this.mockData.get(propertyId);
        if (!property) {
            return {
                exists: false,
                verified: false,
                message: 'Property not found'
            };
        }

        const ownerMatch = property.owner === expectedOwner;
        return {
            exists: true,
            verified: ownerMatch,
            currentOwner: property.owner,
            expectedOwner: expectedOwner,
            message: ownerMatch ? 'Ownership verified' : 'Owner mismatch'
        };
    }

    async getPropertyHistory(propertyId) {
        console.log(`🔍 MOCK: Getting history for ${propertyId}`);

        // Simulate transaction history
        return [
            {
                txId: `mock-tx-${Date.now()}-1`,
                timestamp: '2024-01-15T10:30:00Z',
                isDelete: false,
                value: this.mockData.get(propertyId)
            },
            {
                txId: `mock-tx-${Date.now()}-2`,
                timestamp: '2024-01-10T14:20:00Z',
                isDelete: false,
                value: { ...this.mockData.get(propertyId), marketValue: '₹45,00,000' }
            }
        ];
    }

    async getAllPropertiesWithMetadata() {
        console.log('🔍 MOCK: Getting all properties');

        const results = [];
        for (const [id, property] of this.mockData.entries()) {
            results.push({
                property: property,
                ledgerMetadata: {
                    txId: `mock-tx-${id}-${Date.now()}`,
                    blockNumber: Math.floor(Math.random() * 1000) + 100,
                    timestamp: new Date().toISOString(),
                    endorsements: ['CCLEBMSP', 'StateOrgTSMSP'],
                    channelId: 'mychannel',
                    isVerified: true
                }
            });
        }
        return results;
    }

    async submitTransaction(functionName, ...args) {
        console.log(`🔍 MOCK: Submitting transaction ${functionName}`);

        return {
            success: true,
            result: 'Mock transaction submitted',
            txId: `mock-tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message: 'Transaction submitted (MOCK MODE)'
        };
    }

    async validateEndorsement(txId) {
        console.log(`🔍 MOCK: Validating endorsement for ${txId}`);

        return {
            validated: true,
            txId: txId,
            endorsers: ['CCLEBMSP', 'StateOrgTSMSP'],
            note: 'MOCK MODE - Simulated endorsement validation'
        };
    }
}

module.exports = new MockLedgerService();
