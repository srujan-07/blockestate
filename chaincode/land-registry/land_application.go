package main

import (
	"encoding/json"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type LandApplication struct {
	AppID   string `json:"appId"`
	OwnerID string `json:"ownerId"`
	DocHash string `json:"docHash"`
	Status  string `json:"status"`
}

func (c *LandRegistryContract) SubmitLandApplication(
	ctx contractapi.TransactionContextInterface,
	appID string,
	docHash string,
) error {

	requireRole(ctx, "citizen")

	clientID, _ := ctx.GetClientIdentity().GetID()

	app := LandApplication{
		AppID:   appID,
		OwnerID: clientID,
		DocHash: docHash,
		Status:  "PENDING_VERIFICATION",
	}

	data, _ := json.Marshal(app)
	return ctx.GetStub().PutState("APP_"+appID, data)
}

