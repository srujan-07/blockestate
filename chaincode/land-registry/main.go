package main

import (
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	// Initialize chaincode with all contract implementations
	chaincode, err := contractapi.NewChaincode(
		new(LandRegistryContract),
		new(StateChaincode),
	)
	if err != nil {
		log.Panicf("Error creating land registry chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting land registry chaincode: %v", err)
	}
}
