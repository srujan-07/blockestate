# Land Registry Backend - Startup Guide

## Quick Start with Fabric Network

### Option 1: PowerShell (Windows)
```powershell
cd C:\Users\sruja\OneDrive\Desktop\Project\realestate2\backend
.\startWithFabric.ps1
```

### Option 2: Bash (Linux/WSL)
```bash
cd C:\Users\sruja\OneDrive\Desktop\Project\realestate2\backend
bash start-with-fabric.sh
```

### Manual Steps (If Scripts Don't Work)

1. **Start Fabric Network**
```bash
cd fabric-samples/test-network
bash ./network.sh up createChannel -ca
bash ./network.sh deployCC -ccn landregistry -ccp ../../chaincode/land-registry -ccl go -ccv 1.3 -ccs 2
```

2. **Load Admin Identity**
```powershell
cd realestate2/backend
node addAdminToWallet.js
```

3. **Load Sample Data**
```powershell
node addSampleData.js
```

4. **Start Backend Server**
```powershell
$env:USE_FABRIC="true"
node .\server.js
```

## Backend Endpoints

- `GET http://localhost:4000/health` - Health check
- `POST http://localhost:4000/land/query-by-survey` - Query by survey details
- `POST http://localhost:4000/land/query-by-id` - Query by property ID

## Sample Test Data

Three records are loaded by default:

1. **PROP-1001**
   - District: Hyderabad
   - Mandal: Ghatkesar
   - Village: Boduppal
   - Survey No: 123/A

2. **PROP-2002**
   - District: Nalgonda
   - Mandal: Choutuppal
   - Village: Chityal
   - Survey No: 45/B

3. **PROP-3003**
   - District: Warangal
   - Mandal: Kazipet
   - Village: Fathima Nagar
   - Survey No: 78/C

## Field Validation

All queries require **exact matching** on all fields (case-insensitive):
- District
- Mandal
- Village
- Survey Number (for survey queries)

If any field doesn't match, the system returns "Record not found".

## Stopping the System

1. **Stop Backend**: Press `Ctrl+C` in the backend terminal
2. **Stop Fabric Network**: Run in fabric-samples/test-network directory:
   ```bash
   bash ./network.sh down
   ```
