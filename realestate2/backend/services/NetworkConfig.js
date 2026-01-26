/**
 * NetworkConfig: Configuration management for Fabric networks and channels
 * 
 * Supports:
 * - Multiple network configurations (dev, staging, production)
 * - Channel switching
 * - Network/channel combination profiles
 */

class NetworkConfig {
  constructor() {
    // Pre-defined network configurations
    this.networks = {
      'test-network': {
        name: 'test-network',
        channel: 'mychannel',
        chaincode: 'landregistry',
        mspId: 'Org1MSP',
        discoveryEnabled: false, // Production mode
        asLocalhost: false,
        connectionProfile: './config/connection-org1.yaml',
        description: 'Standard test network (single org)',
      },
      'multi-org-network': {
        name: 'multi-org-network',
        channel: 'land-registry-channel',
        chaincode: 'land-registry-chaincode',
        mspId: 'Org1MSP',
        discoveryEnabled: false,
        asLocalhost: false,
        connectionProfile: './config/connection-multi-org.yaml',
        description: 'Multi-organization network',
      },
      'audit-network': {
        name: 'audit-network',
        channel: 'audit-channel',
        chaincode: 'audit-ledger',
        mspId: 'Org1MSP',
        discoveryEnabled: false,
        asLocalhost: false,
        connectionProfile: './config/connection-audit.yaml',
        description: 'Separate network for audit/analytics',
      },
    };

    // Pre-defined channel configurations
    this.channels = {
      'mychannel': {
        name: 'mychannel',
        chaincode: 'landregistry',
        endorsementPolicy: 'ANY', // Can be extended
      },
      'land-registry-channel': {
        name: 'land-registry-channel',
        chaincode: 'land-registry-chaincode',
        endorsementPolicy: 'MAJORITY',
      },
      'audit-channel': {
        name: 'audit-channel',
        chaincode: 'audit-ledger',
        endorsementPolicy: 'ALL',
      },
    };

    // Current active configuration
    this.activeNetwork = 'test-network';
    this.activeChannel = 'mychannel';
  }

  /**
   * Get available networks
   * @returns {Array} List of network names
   */
  getAvailableNetworks() {
    return Object.keys(this.networks);
  }

  /**
   * Get available channels
   * @returns {Array} List of channel names
   */
  getAvailableChannels() {
    return Object.keys(this.channels);
  }

  /**
   * Get network configuration
   * @param {string} networkName - Network identifier
   * @returns {Object} Network config
   */
  getNetworkConfig(networkName) {
    const config = this.networks[networkName];
    if (!config) {
      throw new Error(`Network '${networkName}' not found`);
    }
    return { ...config };
  }

  /**
   * Get channel configuration
   * @param {string} channelName - Channel identifier
   * @returns {Object} Channel config
   */
  getChannelConfig(channelName) {
    const config = this.channels[channelName];
    if (!config) {
      throw new Error(`Channel '${channelName}' not found`);
    }
    return { ...config };
  }

  /**
   * Get current active configuration
   * @returns {Object} Merged network + channel config
   */
  getActiveConfig() {
    const networkConfig = this.getNetworkConfig(this.activeNetwork);
    const channelConfig = this.getChannelConfig(this.activeChannel);

    return {
      network: networkConfig,
      channel: channelConfig,
      active: {
        networkName: this.activeNetwork,
        channelName: this.activeChannel,
      },
    };
  }

  /**
   * Switch to different network
   * @param {string} networkName - Network to switch to
   * @param {string} channelName - Optional channel name (defaults to network's default)
   */
  switchNetwork(networkName, channelName) {
    if (!this.networks[networkName]) {
      throw new Error(`Network '${networkName}' not found`);
    }

    this.activeNetwork = networkName;

    // Use provided channel or default from network
    if (channelName) {
      if (!this.channels[channelName]) {
        throw new Error(`Channel '${channelName}' not found`);
      }
      this.activeChannel = channelName;
    } else {
      this.activeChannel = this.networks[networkName].channel;
    }

    console.log(
      `✅ Switched to network '${this.activeNetwork}' on channel '${this.activeChannel}'`
    );
  }

  /**
   * Add custom network configuration (for new networks)
   * @param {string} name - Network identifier
   * @param {Object} config - Network configuration
   */
  addNetwork(name, config) {
    if (this.networks[name]) {
      throw new Error(`Network '${name}' already exists`);
    }

    this.networks[name] = {
      name,
      channel: config.channel || 'default-channel',
      chaincode: config.chaincode || 'default-chaincode',
      mspId: config.mspId || 'Org1MSP',
      discoveryEnabled: config.discoveryEnabled || false,
      asLocalhost: config.asLocalhost || false,
      connectionProfile: config.connectionProfile,
      description: config.description || `Custom network: ${name}`,
    };

    console.log(`✅ Added new network configuration: ${name}`);
  }

  /**
   * Add custom channel configuration
   * @param {string} name - Channel identifier
   * @param {Object} config - Channel configuration
   */
  addChannel(name, config) {
    if (this.channels[name]) {
      throw new Error(`Channel '${name}' already exists`);
    }

    this.channels[name] = {
      name,
      chaincode: config.chaincode || 'default-chaincode',
      endorsementPolicy: config.endorsementPolicy || 'ANY',
    };

    console.log(`✅ Added new channel configuration: ${name}`);
  }

  /**
   * Export current configuration as JSON (for logging/debugging)
   * @returns {Object} Full configuration state
   */
  exportConfig() {
    return {
      activeNetwork: this.activeNetwork,
      activeChannel: this.activeChannel,
      currentConfig: this.getActiveConfig(),
      availableNetworks: this.getAvailableNetworks(),
      availableChannels: this.getAvailableChannels(),
    };
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create NetworkConfig singleton
 * @returns {NetworkConfig}
 */
function getNetworkConfig() {
  if (!instance) {
    instance = new NetworkConfig();
  }
  return instance;
}

module.exports = {
  getNetworkConfig,
  NetworkConfig,
};
