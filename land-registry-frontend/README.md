# Land Registry System

A blockchain-based Land Registry System built with React, Express.js, Hyperledger Fabric, and IPFS.

## Features

- 🔍 Search land records by Survey Number or Unique Property ID
- ⛓️ Blockchain-based data storage using Hyperledger Fabric
- 📁 IPFS integration for document and media storage
- 🔒 Secure and immutable land records
- 🎨 Modern, responsive UI

## Prerequisites

Before running this application, you need to install:

1. **Node.js** (v16 or later)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version` and `npm --version`

2. **IPFS Node**
   - Download from [ipfs.io/install](https://ipfs.io/install/)
   - After installation:
     ```bash
     ipfs init
     ipfs daemon
     ```
   - Must run on `localhost:5001` (default port)

3. **Hyperledger Fabric Network**
   - Set up a Hyperledger Fabric test network
   - Deploy the `landregistry.js` smart contract
   - Create `connection-org1.json` configuration file in the root directory
   - Set up wallet with `appUser` identity

## Installation

1. **Clone the repository** (if not already done)
   ```bash
   cd realestate2
   ```

2. **Install npm packages**
   ```bash
   npm install
   ```

   This will install:
   - React and React DOM
   - Express.js backend
   - Hyperledger Fabric SDK
   - IPFS client
   - Build tools and dependencies

## Configuration

### Hyperledger Fabric Setup

1. You need a `connection-org1.json` file in the root directory with your Fabric network configuration.

2. Set up wallet with user identity:
   - Create a `wallet` directory (will be created automatically)
   - Ensure `appUser` identity exists in the wallet
   - Run enrollment scripts if needed

### IPFS Configuration

The application expects IPFS to be running on `localhost:5001`. If your IPFS node runs on a different port, update the configuration in `server.js`:

```javascript
const ipfs = create({
  host: 'localhost',
  port: 5001,  // Change if needed
  protocol: 'http'
});
```

## Running the Application

### Option 1: Run Frontend and Backend Separately

**Terminal 1 - Start Backend Server:**
```bash
npm run server
```
Backend runs on `http://localhost:3001`

**Terminal 2 - Start React Frontend:**
```bash
npm start
```
Frontend runs on `http://localhost:3000`

### Option 2: Run Both Together (Recommended)

```bash
npm run dev
```

This starts both the backend server and React frontend simultaneously using `concurrently`.

## Project Structure

```
realestate2/
├── public/
│   ├── index.html          # HTML entry point
│   └── manifest.json       # PWA manifest
├── src/                    # (Will be created on build)
├── App.js                  # Main React component
├── App.css                 # App styles
├── index.js                # React entry point
├── index.css               # Global styles
├── server.js               # Express backend server
├── landregistry.js         # Hyperledger Fabric smart contract
├── package.json            # Dependencies and scripts
└── README.md               # This file
```

## Available Scripts

- `npm start` - Start React development server (port 3000)
- `npm run server` - Start Express backend server (port 3001)
- `npm run dev` - Start both frontend and backend simultaneously
- `npm run build` - Build React app for production
- `npm test` - Run tests

## API Endpoints

The backend server provides the following endpoints:

- `POST /api/land/register` - Register a new land record
- `POST /api/land/query-by-survey` - Query land by survey number
- `POST /api/land/query-by-id` - Query land by property ID
- `PUT /api/land/update` - Update land record
- `GET /api/land/history/:propertyId` - Get transaction history
- `GET /api/ipfs/:cid` - Fetch data from IPFS
- `GET /health` - Health check endpoint

## Troubleshooting

### Port Already in Use

If port 3000 or 3001 is already in use:
- Change the port in `server.js` (backend)
- React will automatically suggest using a different port (frontend)

### IPFS Connection Error

- Ensure IPFS daemon is running: `ipfs daemon`
- Check if IPFS is accessible on port 5001
- Verify firewall settings

### Hyperledger Fabric Errors

- Ensure Fabric network is running
- Verify `connection-org1.json` exists and is correctly configured
- Check wallet directory and user identity setup
- Ensure smart contract is deployed on the network

### Missing Dependencies

If you encounter module errors:
```bash
npm install
```

## Technology Stack

- **Frontend**: React 18, CSS3
- **Backend**: Express.js, Node.js
- **Blockchain**: Hyperledger Fabric 2.2
- **Storage**: IPFS (InterPlanetary File System)
- **Build Tool**: Create React App (react-scripts)

## License

ISC

## Notes

- This application requires a running Hyperledger Fabric network and IPFS node
- For development/testing, you may need to set up a local Fabric test network
- The application includes mock data fallback for demonstration purposes

