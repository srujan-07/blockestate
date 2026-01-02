package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type LandToken struct {
	TokenID string `json:"tokenId"`
	OwnerID string `json:"ownerId"`
	Status  string `json:"status"`
}

func (c *LandRegistryContract) MintLandToken(
	ctx contractapi.TransactionContextInterface,
	tokenID string,
	ownerID string,
) error {

	requireRole(ctx, "jt_sub_registrar")

	exists, _ := ctx.GetStub().GetState("LAND_" + tokenID)
	if exists != nil {
		return fmt.Errorf("land token already exists")
	}

	token := LandToken{
		TokenID: tokenID,
		OwnerID: ownerID,
		Status:  "ACTIVE",
	}

	data, _ := json.Marshal(token)
	return ctx.GetStub().PutState("LAND_"+tokenID, data)
}

