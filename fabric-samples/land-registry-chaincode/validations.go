package main

import (
    "encoding/json"
    "fmt"

    "github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func (lc *LandContract) RegisterLand(
    ctx contractapi.TransactionContextInterface,
    landID string,
    surveyNo string,
    state string,
    district string,
    ownerID string,
    area float64,
    geoHash string,
) error {

    if err := requireRole(ctx, "sub_registrar"); err != nil {
        return err
    }

    if exists, _ := ctx.GetStub().GetState("LAND_" + landID); exists != nil {
        return fmt.Errorf("land already exists")
    }

    surveyKey := "SURVEY_" + state + "_" + district + "_" + surveyNo
    if exists, _ := ctx.GetStub().GetState(surveyKey); exists != nil {
        return fmt.Errorf("survey number already registered")
    }

    geoKey := "GEO_" + geoHash
    if exists, _ := ctx.GetStub().GetState(geoKey); exists != nil {
        return fmt.Errorf("land overlap detected")
    }

    land := Land{
        LandID:       landID,
        SurveyNo:     surveyNo,
        State:        state,
        District:     district,
        OwnerID:      ownerID,
        Area:         area,
        GeoHash:      geoHash,
        Status:       "CREATED",
        RegisteredBy: ctx.GetClientIdentity().GetID(),
    }

    landBytes, _ := json.Marshal(land)

    ctx.GetStub().PutState("LAND_"+landID, landBytes)
    ctx.GetStub().PutState(surveyKey, []byte{0})
    ctx.GetStub().PutState(geoKey, []byte{0})

    return nil
}

