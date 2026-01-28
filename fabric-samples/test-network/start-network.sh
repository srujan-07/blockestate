#!/bin/bash
cd /mnt/c/Users/sruja/OneDrive/Desktop/Project/fabric-samples/test-network
export PATH=/mnt/c/Users/sruja/OneDrive/Desktop/Project/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=/mnt/c/Users/sruja/OneDrive/Desktop/Project/fabric-samples/config
./network.sh up createChannel -ca
