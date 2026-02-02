// Environment configuration
// Set USE_MOCK_LEDGER=true to run without Fabric network

module.exports = {
    // Toggle between real Fabric and mock mode
    USE_MOCK_LEDGER: process.env.USE_MOCK_LEDGER === 'true' || false,

    // Fabric network settings
    FABRIC_NETWORK: {
        ccpPath: './connection-org1.json',
        walletPath: './wallet',
        channelName: 'mychannel',
        contractName: 'landregistry'
    },

    // Server settings
    SERVER: {
        port: process.env.PORT || 3001,
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'
    },

    // Database settings
    DATABASE: {
        path: './land_registry.db'
    }
};
