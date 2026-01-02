'use strict';

const fs = require('fs');
const path = require('path');
const { Wallets } = require('fabric-network');

async function addUserToWallet(username) {
  try {
    const walletPath = path.join(__dirname, 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    const mspPath = `/mnt/c/Users/sruja/OneDrive/Desktop/Project/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/${username}/msp`;

    if (!fs.existsSync(mspPath)) {
      throw new Error(`MSP path does not exist for user ${username}`);
    }

    const certPath = path.join(mspPath, 'signcerts');
    const keyPath = path.join(mspPath, 'keystore');

    const certFile = fs.readdirSync(certPath)[0];
    const keyFile = fs.readdirSync(keyPath)[0];

    const certificate = fs.readFileSync(path.join(certPath, certFile)).toString();
    const privateKey = fs.readFileSync(path.join(keyPath, keyFile)).toString();

    const identity = {
      credentials: {
        certificate,
        privateKey,
      },
      mspId: 'Org1MSP',
      type: 'X.509',
    };

    await wallet.put(username, identity);
    console.log(`✅ ${username} added to wallet`);
  } catch (error) {
    console.error(`❌ Failed to add ${username}:`, error.message);
  }
}

const username = process.argv[2];
if (!username) {
  console.error('❌ Please provide a username');
  process.exit(1);
}

addUserToWallet(username);

