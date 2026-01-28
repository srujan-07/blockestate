package main

import (
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// StateChaincode context for the land registry running on a state-specific channel
// Each state (TS, KA, AP) has its own instance on state-<code> channel
// Collaborates with CCLB on cclb-global channel for Property ID verification
type StateChaincode struct {
	contractapi.Contract
}

// InitLedger initializes the state ledger on state-<code> channel
// Called once per state organization
func (s *StateChaincode) InitLedger(ctx contractapi.TransactionContextInterface) error {
	fmt.Println("✅ State Ledger initialized (inherited from LandRegistryContract)")
	return nil
}

// LandRegistryContract is retained for backward compatibility
// Moved core functionality to StateChaincode above
// All new methods are added to StateChaincode
type LandRegistryContract struct {
	contractapi.Contract
}
