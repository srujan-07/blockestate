package main

import (
	"fmt"

	"github.com/hyperledger/fabric-chaincode-go/pkg/cid"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

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

