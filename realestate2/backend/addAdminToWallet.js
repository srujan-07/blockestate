const fs = require('fs');
const path = require('path');
const { Wallets } = require('fabric-network');

async function main() {
  const walletPath = path.join(__dirname, 'wallet');
  const wallet = await Wallets.newFileSystemWallet(walletPath);

  const mspPath = path.resolve(
    __dirname,
    '..',
    '..',
    'fabric-samples',
    'test-network',
    'organizations',
    'peerOrganizations',
    'org1.example.com',
    'users',
    'Admin@org1.example.com',
    'msp'
  );

  const signcertsPath = path.join(mspPath, 'signcerts');
  const keystorePath = path.join(mspPath, 'keystore');

  const certFile = fs.readdirSync(signcertsPath)[0];
  const keyFile = fs.readdirSync(keystorePath)[0];

  const cert = fs.readFileSync(path.join(signcertsPath, certFile)).toString();
  const key = fs.readFileSync(path.join(keystorePath, keyFile)).toString();

  const identity = {
    credentials: {
      certificate: cert,
      privateKey: key,
    },
    mspId: 'Org1MSP',
    type: 'X.509',
  };

  await wallet.put('admin', identity);
  console.log('✅ Admin identity imported into wallet');
}

main();

