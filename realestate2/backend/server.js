const express = require('express');
const cors = require('cors');
const { getContract } = require('./fabric');

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Register a person on blockchain
 */
app.post('/register', async (req, res) => {
  try {
    const { name } = req.body;
    const { contract, gateway } = await getContract('admin');

    const result = await contract.submitTransaction(
  'RegisterPerson',
  name
);

app.post('/citizen/register', async (req, res) => {
  try {
    const { name } = req.body;

    const { contract, gateway } = await getContract('citizen1');
    const result = await contract.submitTransaction('RegisterPerson', name);

    await gateway.disconnect();
    res.json(JSON.parse(result.toString()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/citizen/apply-land', async (req, res) => {
  try {
    const { appId, docHash } = req.body;

    const { contract, gateway } = await getContract('citizen1');
    await contract.submitTransaction('SubmitLandApplication', appId, docHash);

    await gateway.disconnect();
    res.json({ message: 'Land application submitted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/tahsildar/approve', async (req, res) => {
  try {
    const { appId } = req.body;

    const { contract, gateway } = await getContract('tahsildar1');
    await contract.submitTransaction('ApproveByTahsildar', appId);

    await gateway.disconnect();
    res.json({ message: 'Approved by Tahsildar' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/registrar/mint', async (req, res) => {
  try {
    const { tokenId, ownerId } = req.body;

    const { contract, gateway } = await getContract('registrar1');
    await contract.submitTransaction('MintLandToken', tokenId, ownerId);

    await gateway.disconnect();
    res.json({ message: 'Land token minted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function getContract(identityName) {
  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity: identityName,
    discovery: { enabled: false }
  });

  const network = await gateway.getNetwork('mychannel');
  const contract = network.getContract('landregistry');

  return { contract, gateway };
}



    await gateway.disconnect();
    res.json(JSON.parse(result.toString()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Submit land application (document hash)
 */
app.post('/land/apply', async (req, res) => {
  try {
    const { appId, docHash } = req.body;
    const { contract, gateway } = await getContract('admin');

    await contract.submitTransaction(
      'SubmitLandApplication',
      appId,
      docHash
    );

    await gateway.disconnect();
    res.json({ message: 'Land application submitted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Mint land token (Registrar only)
 */
app.post('/land/mint', async (req, res) => {
  try {
    const { tokenId, ownerId } = req.body;
    const { contract, gateway } = await getContract('admin');

    await contract.submitTransaction(
      'MintLandToken',
      tokenId,
      ownerId
    );

    await gateway.disconnect();
    res.json({ message: 'Land token minted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(4000, () => {
  console.log('Backend running on port 4000');
});

