# Land Registry System - Quick Start Guide

## Single Command Startup

### On Windows (PowerShell):
```powershell
cd realestate2\backend
.\Run-Complete.ps1
```

### On Linux/Mac (Bash):
```bash
cd realestate2/backend
bash run-complete.sh
```

## What Happens:
1. ✓ Fabric network starts
2. ✓ Blockchain channel created
3. ✓ Chaincode deployed (landregistry v1.3)
4. ✓ Admin identity registered
5. ✓ 3 sample properties loaded
6. ✓ Backend server runs on http://localhost:4000

## Sample Data Available:
- **PROP-1001**: Hyderabad / Ghatkesar / Boduppal / 123 / A
- **PROP-2002**: Nalgonda / Choutuppal / Chityal / 45 / B  
- **PROP-3003**: Warangal / Kazipet / Fathima Nagar / 78 / C

## Verify Backend is Running:

### Linux/Mac:
```bash
curl http://localhost:4000/health
```

### PowerShell:
```powershell
Invoke-WebRequest -Uri http://localhost:4000/health
```

## Run Tests:

### Query by Survey Number:
```bash
curl -X POST http://localhost:4000/land/query-by-survey \
  -H "Content-Type: application/json" \
  -d '{
    "district": "Hyderabad",
    "mandal": "Ghatkesar", 
    "village": "Boduppal",
    "surveyNo": "123"
  }'
```

### Query by Property ID:
```bash
curl -X POST http://localhost:4000/land/query-by-id \
  -H "Content-Type: application/json" \
  -d '{"propertyId": "PROP-1001"}'
```

## Stop All Services:

### PowerShell:
```powershell
Stop-Process -Name node -Force
cd fabric-samples/test-network
bash ./network.sh down
```

### Bash:
```bash
pkill -f "node server.js"
cd fabric-samples/test-network
bash ./network.sh down
```

---

For detailed information, see STARTUP_GUIDE.md
