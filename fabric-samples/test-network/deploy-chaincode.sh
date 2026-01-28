#!/bin/bash
cd /mnt/c/Users/sruja/OneDrive/Desktop/Project/fabric-samples/test-network
export PATH=/mnt/c/Users/sruja/OneDrive/Desktop/Project/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=/mnt/c/Users/sruja/OneDrive/Desktop/Project/fabric-samples/config
./network.sh deployCC -ccn landregistry -ccp ../../chaincode/land-registry -ccl go -ccv 1.3 -ccs 1
