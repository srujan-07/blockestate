package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// Event types for blockchain audit trail
const (
	EventPropertyCreated     = "PropertyCreated"
	EventPropertyTransferred = "PropertyTransferred"
	EventPropertyApproved    = "PropertyApproved"
	EventPropertyUpdated     = "PropertyUpdated"
	EventDocumentLinked      = "DocumentLinked"
)

// PropertyCreatedEvent emitted when a new property is registered
type PropertyCreatedEvent struct {
	PropertyID    string `json:"propertyId"`
	Owner         string `json:"owner"`
	District      string `json:"district"`
	Mandal        string `json:"mandal"`
	Village       string `json:"village"`
	SurveyNo      string `json:"surveyNo"`
	Area          string `json:"area"`
	Timestamp     int64  `json:"timestamp"`
	TransactionID string `json:"transactionId"`
}

// PropertyTransferredEvent emitted when ownership changes
type PropertyTransferredEvent struct {
	PropertyID     string `json:"propertyId"`
	FromOwner      string `json:"fromOwner"`
	ToOwner        string `json:"toOwner"`
	ApprovalStatus string `json:"approvalStatus"`
	Timestamp      int64  `json:"timestamp"`
	TransactionID  string `json:"transactionId"`
}

// PropertyApprovedEvent emitted when registrar approves a transaction
type PropertyApprovedEvent struct {
	PropertyID    string `json:"propertyId"`
	ApprovedBy    string `json:"approvedBy"`
	Status        string `json:"status"`
	Timestamp     int64  `json:"timestamp"`
	TransactionID string `json:"transactionId"`
}

// PropertyUpdatedEvent emitted when property details change
type PropertyUpdatedEvent struct {
	PropertyID    string            `json:"propertyId"`
	UpdatedFields map[string]string `json:"updatedFields"`
	UpdatedBy     string            `json:"updatedBy"`
	Timestamp     int64             `json:"timestamp"`
	TransactionID string            `json:"transactionId"`
}

// DocumentLinkedEvent emitted when document is linked to property
type DocumentLinkedEvent struct {
	PropertyID    string `json:"propertyId"`
	DocumentHash  string `json:"documentHash"`
	DocumentType  string `json:"documentType"`
	Timestamp     int64  `json:"timestamp"`
	TransactionID string `json:"transactionId"`
}

// EmitPropertyCreatedEvent publishes property creation event
func (c *LandRegistryContract) emitPropertyCreatedEvent(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
	owner string,
	district string,
	mandal string,
	village string,
	surveyNo string,
	area string,
) error {

	txID := ctx.GetStub().GetTxID()
	event := PropertyCreatedEvent{
		PropertyID:    propertyID,
		Owner:         owner,
		District:      district,
		Mandal:        mandal,
		Village:       village,
		SurveyNo:      surveyNo,
		Area:          area,
		Timestamp:     time.Now().Unix(),
		TransactionID: txID,
	}

	eventJSON, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal PropertyCreatedEvent: %v", err)
	}

	return ctx.GetStub().SetEvent(EventPropertyCreated, eventJSON)
}

// EmitPropertyTransferredEvent publishes ownership transfer event
func (c *LandRegistryContract) emitPropertyTransferredEvent(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
	fromOwner string,
	toOwner string,
	approvalStatus string,
) error {

	txID := ctx.GetStub().GetTxID()
	event := PropertyTransferredEvent{
		PropertyID:     propertyID,
		FromOwner:      fromOwner,
		ToOwner:        toOwner,
		ApprovalStatus: approvalStatus,
		Timestamp:      time.Now().Unix(),
		TransactionID:  txID,
	}

	eventJSON, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal PropertyTransferredEvent: %v", err)
	}

	return ctx.GetStub().SetEvent(EventPropertyTransferred, eventJSON)
}

// EmitPropertyApprovedEvent publishes approval event
func (c *LandRegistryContract) emitPropertyApprovedEvent(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
	approvedBy string,
	status string,
) error {

	txID := ctx.GetStub().GetTxID()
	event := PropertyApprovedEvent{
		PropertyID:    propertyID,
		ApprovedBy:    approvedBy,
		Status:        status,
		Timestamp:     time.Now().Unix(),
		TransactionID: txID,
	}

	eventJSON, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal PropertyApprovedEvent: %v", err)
	}

	return ctx.GetStub().SetEvent(EventPropertyApproved, eventJSON)
}

// EmitPropertyUpdatedEvent publishes property update event
func (c *LandRegistryContract) emitPropertyUpdatedEvent(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
	updatedFields map[string]string,
	updatedBy string,
) error {

	txID := ctx.GetStub().GetTxID()
	event := PropertyUpdatedEvent{
		PropertyID:    propertyID,
		UpdatedFields: updatedFields,
		UpdatedBy:     updatedBy,
		Timestamp:     time.Now().Unix(),
		TransactionID: txID,
	}

	eventJSON, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal PropertyUpdatedEvent: %v", err)
	}

	return ctx.GetStub().SetEvent(EventPropertyUpdated, eventJSON)
}

// EmitDocumentLinkedEvent publishes document linking event
func (c *LandRegistryContract) emitDocumentLinkedEvent(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
	documentHash string,
	documentType string,
) error {

	txID := ctx.GetStub().GetTxID()
	event := DocumentLinkedEvent{
		PropertyID:    propertyID,
		DocumentHash:  documentHash,
		DocumentType:  documentType,
		Timestamp:     time.Now().Unix(),
		TransactionID: txID,
	}

	eventJSON, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal DocumentLinkedEvent: %v", err)
	}

	return ctx.GetStub().SetEvent(EventDocumentLinked, eventJSON)
}
