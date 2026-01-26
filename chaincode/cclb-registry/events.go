package main

import "github.com/hyperledger/fabric-contract-api-go/contractapi"

// PropertyIDIssuedEvent emitted when CCLB issues a new Property ID
type PropertyIDIssuedEvent struct {
	PropertyID   string `json:"propertyId"`
	StateCode    string `json:"stateCode"`
	SubmittedBy  string `json:"submittedBy"`
	Timestamp    string `json:"timestamp"`
	VerifiedBy   string `json:"verifiedBy"`
}

// StateRegisteredEvent emitted when CCLB registers a new state
type StateRegisteredEvent struct {
	StateCode    string `json:"stateCode"`
	StateName    string `json:"stateName"`
	ChannelID    string `json:"channelId"`
	Timestamp    string `json:"timestamp"`
}

// VerificationCompletedEvent emitted when CCLB verifies a state record
type VerificationCompletedEvent struct {
	PropertyID  string `json:"propertyId"`
	StateCode   string `json:"stateCode"`
	Status      string `json:"status"` // VERIFIED, REJECTED, PENDING
	Reason      string `json:"reason"`
	Timestamp   string `json:"timestamp"`
}

// emitPropertyIDIssuedEvent emits an event when a Property ID is issued
func (c *CCLBRegistryContract) emitPropertyIDIssuedEvent(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
	stateCode string,
	submittedBy string,
) error {
	event := PropertyIDIssuedEvent{
		PropertyID:   propertyID,
		StateCode:    stateCode,
		SubmittedBy:  submittedBy,
		Timestamp:    "2026-01-26T00:00:00Z", // TODO: use real timestamp
		VerifiedBy:   "CCLB-ADMIN",
	}

	return ctx.GetStub().SetEvent("PropertyIDIssued", marshalEvent(event))
}

// emitStateRegisteredEvent emits an event when a state is registered
func (c *CCLBRegistryContract) emitStateRegisteredEvent(
	ctx contractapi.TransactionContextInterface,
	stateCode string,
	stateName string,
	channelID string,
) error {
	event := StateRegisteredEvent{
		StateCode:  stateCode,
		StateName:  stateName,
		ChannelID:  channelID,
		Timestamp:  "2026-01-26T00:00:00Z", // TODO: use real timestamp
	}

	return ctx.GetStub().SetEvent("StateRegistered", marshalEvent(event))
}

// emitVerificationCompletedEvent emits verification result
func (c *CCLBRegistryContract) emitVerificationCompletedEvent(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
	stateCode string,
	status string,
	reason string,
) error {
	event := VerificationCompletedEvent{
		PropertyID: propertyID,
		StateCode:  stateCode,
		Status:     status,
		Reason:     reason,
		Timestamp:  "2026-01-26T00:00:00Z", // TODO: use real timestamp
	}

	return ctx.GetStub().SetEvent("VerificationCompleted", marshalEvent(event))
}

// Helper to marshal events to JSON bytes
func marshalEvent(event interface{}) []byte {
	// TODO: Implement JSON marshaling
	return []byte{}
}
