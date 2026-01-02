const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Gateway, Wallets } = require('fabric-network');

const ccpPath = path.resolve(
  __dirname,
  'config',
  'connection-org1.yaml'
);

const ccp = yaml.load(fs.readFileSync(ccpPath, 'utf8'));

async function getContract(identityName = 'admin') {
  const walletPath = path.join(__dirname, 'wallet');
  const wallet = await Wallets.newFileSystemWallet(walletPath);

  const identity = await wallet.get(identityName);
  if (!identity) {
    throw new Error(`Identity ${identityName} not found in wallet`);
  }

  const gateway = new Gateway();
  await gateway.connect(ccp, {
  wallet,
  identity: identityName,
  discovery: {
    enabled: true
  }
});



  const network = await gateway.getNetwork('mychannel');

  // 🔑 THIS IS YOUR DEPLOYED CHAINCODE
  const contract = network.getContract('landregistry');

  return { contract, gateway };
}

module.exports = { getContract };

