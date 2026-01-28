package main

import (
    "fmt"

    "github.com/hyperledger/fabric-chaincode-go/pkg/cid"
    "github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func requireRole(ctx contractapi.TransactionContextInterface, role string) error {
    val, ok, err := cid.GetAttributeValue(ctx.GetStub(), "role")
    if err != nil {
        return err
    }
    if !ok || val != role {
        return fmt.Errorf("access denied: requires role %s", role)
    }
    return nil
}

