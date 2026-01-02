package main

import (
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "fmt"

    "github.com/hyperledger/fabric-contract-api-go/contractapi"
)
	

func (c *LandRegistryContract) RegisterPerson(
	ctx contractapi.TransactionContextInterface,
	name string,
) (*Person, error) {

	clientID, err := ctx.GetClientIdentity().GetID()
if err != nil {
    return nil, err
}

// 🔑 make clientID ledger-safe
hash := sha256.Sum256([]byte(clientID))
personKey := "PERSON_" + hex.EncodeToString(hash[:])
	
	existing, _ := ctx.GetStub().GetState(personKey)
	if existing != nil {
		return nil, fmt.Errorf("person already registered")
	}

	role, _, _ := ctx.GetClientIdentity().GetAttributeValue("role")

	person := Person{
		PersonID: personKey,
		Name:     name,
		Role:     role,
	}

	data, _ := json.Marshal(person)
	ctx.GetStub().PutState(personKey, data)

	return &person, nil
}

