package main

import (
	"encoding/json"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// PropertyIDRequestedEvent emitted when a state requests a CCLB Property ID
type PropertyIDRequestedEvent struct {
	RequestID  string `json:"requestId"`
	StateCode  string `json:"stateCode"`
	SurveyNo   string `json:"surveyNo"`
	District   string `json:"district"`
	Mandal     string `json:"mandal"`
	Village    string `json:"village"`
	Timestamp  string `json:"timestamp"`
}

// StateRecordCreatedEvent emitted when a state binds a Property ID to full record
type StateRecordCreatedEvent struct {
	PropertyID string `json:"propertyId"`
	StateCode  string `json:"stateCode"`
	SurveyNo   string `json:"surveyNo"`
	District   string `json:"district"`
	Mandal     string `json:"mandal"`
	Village    string `json:"village"`
	Timestamp  string `json:"timestamp"`
}

// emitPropertyIDRequestedEvent emits an event when state requests Property ID from CCLB
func (c *LandRegistryContract) emitPropertyIDRequestedEvent(
	ctx contractapi.TransactionContextInterface,
	requestID string,
	stateCode string,
	surveyNo string,
	district string,
	mandal string,
	village string,
) error {
	event := PropertyIDRequestedEvent{
		RequestID: requestID,
		StateCode: stateCode,
		SurveyNo:  surveyNo,
		District:  district,
		Mandal:    mandal,
		Village:   village,
		Timestamp: "2026-01-26T00:00:00Z", // TODO: real timestamp
	}

	eventJSON, _ := json.Marshal(event)
	return ctx.GetStub().SetEvent("PropertyIDRequested", eventJSON)
}

// emitStateRecordCreatedEvent emits an event when state creates record with CCLB Property ID
func (c *LandRegistryContract) emitStateRecordCreatedEvent(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
	stateCode string,
	surveyNo string,
	district string,
	mandal string,
	village string,
) error {
	event := StateRecordCreatedEvent{
		PropertyID: propertyID,
		StateCode:  stateCode,
		SurveyNo:   surveyNo,
		District:   district,
		Mandal:     mandal,
		Village:    village,
		Timestamp:  "2026-01-26T00:00:00Z", // TODO: real timestamp
	}

	eventJSON, _ := json.Marshal(event)
	return ctx.GetStub().SetEvent("StateRecordCreated", eventJSON)
}
