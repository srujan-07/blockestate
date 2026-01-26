# ⚡ Quick Deploy - Land Registry App

## 🎯 5-Minute Complete Setup

### Step 1: Start Fabric Network
```bash
cd ~/OneDrive/Desktop/Project/fabric-samples/test-network
./network.sh down
./network.sh up createChannel -ca -c mychannel
```

### Step 2: Deploy Chaincode
```bash
export PATH=/tmp/go/bin:$PATH
./network.sh deployCC -ccn landregistry -ccp ../../chaincode/land-registry -ccl go -ccv 1.3 -ccs 1
```

### Step 3: Load Sample Data
```bash
cd ~/OneDrive/Desktop/Project/realestate2/backend
node addSampleData.js
```

### Step 4: Start Backend
```bash
# Same window
$env:USE_FABRIC="true"
node server.js
```
**Expected**: `Land Registry API Server running on http://localhost:4000`

### Step 5: Start Frontend
```bash
# NEW PowerShell window
cd ~/OneDrive/Desktop/Project/land-registry-frontend
npm start
```
**Expected**: Browser opens to `http://localhost:3000`

---

## ✅ Verify It Works

### Test 1: Health Check
```powershell
curl http://localhost:4000/health
```
Expected: `{"ok": true, "database": "connected", "fabric": "single-channel (mychannel)"}`

### Test 2: Search on Frontend
1. Open http://localhost:3000
2. Select: District=**Medchal**, Mandal=**Ghatkesar**, Village=**Edulabad**
3. Survey Number: **101**
4. Enter captcha
5. Click **"Fetch from Blockchain"**

**Expected**: Shows Ramesh Kumar's property details

### Test 3: View All Properties
1. Click **"📋 View All Properties"** button
2. See table with 3 properties

---

## 🎨 Features Available

✅ **Search by Survey Details** (District, Mandal, Village, Survey No)  
✅ **Search by Property ID** (Unique ID like LRI-IND-TS-2026-000001)  
✅ **View All Properties** (Table with all records)  
✅ **Captcha Security**  
✅ **Error Handling**  
✅ **Loading States**

---

## 🐛 Common Issues

**Frontend shows "Failed to fetch"**  
→ Backend not running. Check Step 4.

**"Land record not found"**  
→ Sample data not loaded. Re-run Step 3.

**Port already in use**  
→ Kill existing process:
```powershell
$processId = (Get-NetTCPConnection -LocalPort 4000).OwningProcess
Stop-Process -Id $processId -Force
```

---

## 📚 More Info

- **Full Guide**: See [FULL_APP_DEPLOYMENT.md](FULL_APP_DEPLOYMENT.md)
- **API Docs**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Architecture**: [FEDERATED_ARCHITECTURE.md](FEDERATED_ARCHITECTURE.md)

---

## 🎉 Done!

Your fully functional land registry app is now running at:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:4000

**Try It**: Search for property with Survey No **101** in **Edulabad**!
