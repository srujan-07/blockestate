const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Gateway, Wallets } = require('fabric-network');

/**
 * Custom Fabric network support
 * Connects to production-grade Land Registry network
 */

// Network configurations for custom network
const NETWORKS = {
  'custom-network': {
    cclb: {
      connectionProfile: 'connection-cclb.yaml',
      organization: 'CCLB',
      identity: 'admin',
      channels: {
        'cclb-global': { chaincode: 'registry-index' },
        'state-ts': { chaincode: 'landregistry' }
      }
    },
    'state-ts': {
      connectionProfile: 'connection-state-ts.yaml',
      organization: 'StateOrgTS',
      identity: 'admin',
      channels: {
        'cclb-global': { chaincode: 'registry-index' },
        'state-ts': { chaincode: 'landregistry' }
      }
    }
  },
  'test-network': {
    org1: {
      connectionProfile: 'connection-org1.yaml',
      organization: 'Org1',
      identity: 'admin',
      channels: {
        'mychannel': { chaincode: 'landregistry' }
      }
    }
  }
};

// Default configuration
let currentNetwork = 'custom-network';
let currentOrg = 'cclb';

/**
 * Load connection profile and resolve paths
 */
function loadConnectionProfile(filename) {
  const ccpPath = path.resolve(__dirname, 'config', filename);
  if (!fs.existsSync(ccpPath)) {
    throw new Error(`Connection profile not found: ${ccpPath}`);
  }
  
  let ccp = yaml.load(fs.readFileSync(ccpPath, 'utf8'));
  
  // Resolve environment variables in paths
  if (ccp.peers) {
    for (const peerName in ccp.peers) {
      if (ccp.peers[peerName].tlsCACerts && ccp.peers[peerName].tlsCACerts.path) {
        ccp.peers[peerName].tlsCACerts.path = resolvePath(ccp.peers[peerName].tlsCACerts.path);
      }
    }
  }
  
  if (ccp.certificateAuthorities) {
    for (const caName in ccp.certificateAuthorities) {
      if (ccp.certificateAuthorities[caName].tlsCACerts && ccp.certificateAuthorities[caName].tlsCACerts.path) {
        ccp.certificateAuthorities[caName].tlsCACerts.path = resolvePath(ccp.certificateAuthorities[caName].tlsCACerts.path);
      }
    }
  }
  
  if (ccp.orderers) {
    for (const ordererName in ccp.orderers) {
      if (ccp.orderers[ordererName].tlsCACerts && ccp.orderers[ordererName].tlsCACerts.path) {
        ccp.orderers[ordererName].tlsCACerts.path = resolvePath(ccp.orderers[ordererName].tlsCACerts.path);
      }
    }
  }
  
  return ccp;
}

/**
 * Resolve paths with environment variables
 */
function resolvePath(filePath) {
  if (filePath.includes('${FABRIC_CFG_PATH}')) {
    return filePath.replace('${FABRIC_CFG_PATH}', __dirname);
  }
  return filePath;
}

/**
 * Get contract for specified network, organization, and channel
 * 
 * @param {Object} options
 * @param {string} options.network - Network name ('custom-network' or 'test-network')
 * @param {string} options.org - Organization ('cclb', 'state-ts', etc.)
 * @param {string} options.channel - Channel name
 * @param {string} options.chaincode - Chaincode name (optional, uses default)
 * @param {string} options.identity - Identity name (default: 'admin')
 * @returns {Promise<{contract, gateway, network}>}
 */
async function getContract(options = {}) {
  const {
    network = currentNetwork,
    org = currentOrg,
    channel = undefined,
    chaincode = undefined,
    identity = 'admin'
  } = options;
  
  // Validate network and org
  if (!NETWORKS[network]) {
    throw new Error(`Unknown network: ${network}. Available: ${Object.keys(NETWORKS).join(', ')}`);
  }
  
  if (!NETWORKS[network][org]) {
    throw new Error(`Unknown org: ${org} in network ${network}`);
  }
  
  const orgConfig = NETWORKS[network][org];
  const walletPath = path.join(__dirname, 'wallet');
  const wallet = await Wallets.newFileSystemWallet(walletPath);
  
  const walletIdentity = await wallet.get(identity);
  if (!walletIdentity) {
    throw new Error(`Identity ${identity} not found in wallet at ${walletPath}`);
  }
  
  // Load connection profile
  const ccp = loadConnectionProfile(orgConfig.connectionProfile);
  
  // Connect to gateway
  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity: identity,
    // Production mode: discovery disabled, explicit configuration
    discovery: {
      enabled: false
    }
  });
  
  // Determine channel and chaincode
  let selectedChannel = channel;
  let selectedChaincode = chaincode;
  
  if (!selectedChannel) {
    // Default to first available channel for this org
    const availableChannels = Object.keys(orgConfig.channels);
    if (availableChannels.length === 0) {
      throw new Error(`No channels available for org ${org}`);
    }
    selectedChannel = availableChannels[0];
  }
  
  if (!selectedChaincode) {
    // Use chaincode from channel config
    if (!orgConfig.channels[selectedChannel]) {
      throw new Error(`Org ${org} not member of channel ${selectedChannel}`);
    }
    selectedChaincode = orgConfig.channels[selectedChannel].chaincode;
  }
  
  const fabricNetwork = await gateway.getNetwork(selectedChannel);
  const contract = fabricNetwork.getContract(selectedChaincode);
  
  return { contract, gateway, network: fabricNetwork, channel: selectedChannel, org };
}

/**
 * Set default network context
 */
function setDefaultNetwork(networkName, orgName) {
  if (!NETWORKS[networkName] || !NETWORKS[networkName][orgName]) {
    throw new Error(`Invalid network/org: ${networkName}/${orgName}`);
  }
  currentNetwork = networkName;
  currentOrg = orgName;
}

/**
 * Get available networks and organizations
 */
function getAvailableNetworks() {
  return NETWORKS;
}

module.exports = {
  getContract,
  setDefaultNetwork,
  getAvailableNetworks,
  NETWORKS
};

