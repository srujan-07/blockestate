# Step-by-step startup guide for Land Registry System

## Step 1: Start Fabric Network (Run ONCE, in separate terminal)

```bash
cd fabric-samples/test-network

# Bring up network with channel
bash ./network.sh up createChannel -ca

# This takes 2-3 minutes. Wait for "Channel 'mychannel' joined" message
```

## Step 2: Deploy Chaincode (After Step 1 completes)

```bash
# Still in fabric-samples/test-network directory
bash ./network.sh deployCC -ccn landregistry -ccp ../../chaincode/land-registry -ccl go -ccv 1.3 -ccs 2

# This takes 1-2 minutes. Wait for "Chaincode definition committed" message
```

## Step 3: Load Admin & Sample Data (After Step 2 completes)

```bash
cd realestate2/backend

# Load admin identity
node addAdminToWallet.js

# Load 3 sample land records
node addSampleData.js
```

## Step 4: Start Backend Server

### Option A: Windows (Run from realestate2/backend)
```cmd
start.bat
```
or
```powershell
$env:USE_FABRIC="true"
node server.js
```

### Option B: Bash
```bash
cd realestate2/backend
export USE_FABRIC="true"
node server.js
```

Backend will start on `http://localhost:4000`

## Step 5 (Optional): Start Frontend

In a new terminal:
```bash
cd land-registry-frontend
npm start
```

Frontend will start on `http://localhost:3000`

---

## Quick Test

Once backend is running, test the API:

```powershell
$body = @{district='Hyderabad'; mandal='Ghatkesar'; village='Boduppal'; surveyNo='123/A'} | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:4000/land/query-by-survey -Method POST -Body $body -ContentType 'application/json'
```

Expected response:
```json
{
  "propertyId": "PROP-1001",
  "owner": "Ravi Kumar",
  "surveyNo": "123/A",
  "district": "Hyderabad",
  "mandal": "Ghatkesar",
  "village": "Boduppal",
  ...
}
```

---

## Stopping Everything

1. **Stop Backend**: Press `Ctrl+C` in backend terminal
2. **Stop Frontend**: Press `Ctrl+C` in frontend terminal
3. **Stop Fabric Network**: Run in `fabric-samples/test-network`
   ```bash
   bash ./network.sh down
   ```
