package main

import (
	"fmt"

	"github.com/hyperledger/fabric-chaincode-go/pkg/cid"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// requireRole checks if the caller has one of the allowed roles
// Roles are stored in X.509 certificate attributes
func requireRole(ctx contractapi.TransactionContextInterface, allowed ...string) error {
	role, found, err := cid.GetAttributeValue(ctx.GetStub(), "role")
	if err != nil || !found {
		return fmt.Errorf("role attribute missing")
	}

	for _, r := range allowed {
		if role == r {
			return nil
		}
	}

	return fmt.Errorf("access denied for role: %s", role)
}

// requireCCLB checks if the caller is from CCLB organization
// Used for CCLB-only operations (e.g., CreateProperty)
func requireCCLB(ctx contractapi.TransactionContextInterface) error {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %v", err)
	}

	if mspID != "CCLEBMSP" {
		return fmt.Errorf("only CCLB organization can perform this operation, caller MSP: %s", mspID)
	}

	return nil
}

// requireCCLBOrState checks if the caller is from CCLB or State organization
// Used for operations that require CCLB or State endorsement
func requireCCLBOrState(ctx contractapi.TransactionContextInterface) error {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %v", err)
	}

	allowedMSPs := []string{"CCLEBMSP", "StateOrgTSMSP", "StateOrgKAMSP", "StateOrgAPMSP"}
	for _, allowed := range allowedMSPs {
		if mspID == allowed {
			return nil
		}
	}

	return fmt.Errorf("access denied: caller MSP %s is not authorized", mspID)
}
