@echo off
REM Simple batch file to start backend server with Fabric mode

echo.
echo ===============================================
echo Starting Land Registry Backend (Fabric Mode)
echo ===============================================
echo.

cd /d "%~dp0"
set USE_FABRIC=true

echo [INFO] Starting backend server on port 4000...
echo [INFO] Make sure Fabric network is running first!
echo [INFO] To start Fabric, run in fabric-samples/test-network:
echo        bash ./network.sh up createChannel -ca
echo        bash ./network.sh deployCC -ccn landregistry -ccp ../../chaincode/land-registry -ccl go -ccv 1.3 -ccs 2
echo.

node server.js

pause
