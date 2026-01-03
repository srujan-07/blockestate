const fs = require('fs');
const path = require('path');
const { Wallets } = require('fabric-network');

async function addUser(username) {
  const wallet = await Wallets.newFileSystemWallet(path.join(__dirname, 'wallet'));

  const mspPath = `/mnt/c/Users/sruja/OneDrive/Desktop/Project/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/${username}@org1.example.com/msp`;

  const certPath = path.join(mspPath, 'signcerts');
  const keyPath = path.join(mspPath, 'keystore');

  const certFile = fs.readdirSync(certPath)[0];
  const keyFile = fs.readdirSync(keyPath)[0];

  const identity = {
    credentials: {
      certificate: fs.readFileSync(path.join(certPath, certFile)).toString(),
      privateKey: fs.readFileSync(path.join(keyPath, keyFile)).toString(),
    },
    mspId: 'Org1MSP',
    type: 'X.509',
  };

  await wallet.put(username, identity);
  console.log(`✅ ${username} imported to wallet`);
}

const user = process.argv[2];
addUser(user);

