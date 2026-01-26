/**
 * Federated Network Configuration
 * 
 * Supports multi-channel architecture:
 *   - cclb-global: CCLB + all State orgs
 *   - state-<code>: CCLB + specific State org
 * 
 * Each state can connect to either channel based on query scope
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Gateway, Wallets } = require('fabric-network');

// Connection profile paths (one per org)
const ccpMap = {
  CCLB: path.resolve(__dirname, 'config', 'connection-cclb.yaml'),
  Telangana: path.resolve(__dirname, 'config', 'connection-org1.yaml'), // TS
  Karnataka: path.resolve(__dirname, 'config', 'connection-org2.yaml'), // KA
  // Add more states as needed
};

// Channel and chaincode mapping
const channelMap = {
  'national': {
    channelID: 'cclb-global',
    chaincodeName: 'cclb-registry',
  },
  'TS': {
    channelID: 'state-ts',
    chaincodeName: 'landregistry',
  },
  'KA': {
    channelID: 'state-ka',
    chaincodeName: 'landregistry',
  },
  // Add more state mappings
};

/**
 * Multi-channel contract getter
 * 
 * @param {string} identityName - Wallet identity (e.g., 'registrar', 'admin')
 * @param {string} scope - 'national' or state code (e.g., 'TS', 'KA')
 * @param {string} orgName - Organization name for CCP (e.g., 'Telangana', 'CCLB')
 * @returns {Object} { contract, gateway, channelID, chaincodeName }
 */
async function getContract(identityName = 'admin', scope = 'national', orgName = 'Telangana') {
  // Validate scope
  if (!channelMap[scope]) {
    throw new Error(`Invalid scope: ${scope}. Use 'national' or state code (TS, KA, etc.)`);
  }

  const { channelID, chaincodeName } = channelMap[scope];

  // Get CCP for organization
  const ccpPath = ccpMap[orgName];
  if (!ccpPath || !fs.existsSync(ccpPath)) {
    throw new Error(
      `CCP not found for org: ${orgName}\n` +
      `Configure connection profiles in config/ directory:\n` +
      `  - connection-cclb.yaml\n` +
      `  - connection-org1.yaml (Telangana)\n` +
      `  - connection-org2.yaml (Karnataka)\n` +
      `  etc.`
    );
  }

  const ccp = yaml.load(fs.readFileSync(ccpPath, 'utf8'));

  // Get wallet identity
  const walletPath = path.join(__dirname, 'wallet');
  const wallet = await Wallets.newFileSystemWallet(walletPath);

  const identity = await wallet.get(identityName);
  if (!identity) {
    throw new Error(
      `Identity '${identityName}' not found in wallet at ${walletPath}\n` +
      `Available identities: admin, registrar, citizen (if enrolled)`
    );
  }

  // Connect to appropriate channel
  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity: identityName,
    discovery: {
      enabled: true,
      asLocalhost: true,
    },
  });

  const network = await gateway.getNetwork(channelID);
  const contract = network.getContract(chaincodeName);

  return {
    contract,
    gateway,
    channelID,
    chaincodeName,
    scope,
    orgName,
  };
}

/**
 * Helper to get CCLB contract for Property ID operations
 * Always uses cclb-global channel
 */
async function getCCLBContract(identityName = 'admin') {
  return getContract(identityName, 'national', 'CCLB');
}

/**
 * Helper to get State contract for state-level records
 */
async function getStateContract(stateCode, identityName = 'admin') {
  // Map state code to organization name
  const stateOrgMap = {
    'TS': 'Telangana',
    'KA': 'Karnataka',
    'AP': 'AndhraPradesh',
    // Add more mappings
  };

  const orgName = stateOrgMap[stateCode];
  if (!orgName) {
    throw new Error(`State ${stateCode} not configured. Add to stateOrgMap in fabric.js`);
  }

  return getContract(identityName, stateCode, orgName);
}

module.exports = {
  getContract,
  getCCLBContract,
  getStateContract,
  channelMap,
  ccpMap,
};
