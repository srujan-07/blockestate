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

