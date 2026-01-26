package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// RequestPropertyID is called by State registrars to request a CCLB-issued Property ID
// FEDERATED FLOW STEP 1/3:
//   1. RequestPropertyID() — state submits request with draft record details
//   2. GetPropertyID() — state polls CCLB via cclb-global channel
//   3. CreateStateRecord() — state binds full details to the Property ID
//
// This function:
//   - Stores draft record locally (no Property ID yet)
//   - Triggers CCLB to generate ID via cross-chain event/invoke
//   - Returns temporary request ID for polling
func (c *LandRegistryContract) RequestPropertyID(
	ctx contractapi.TransactionContextInterface,
	stateCode string,
	owner string,
	surveyNo string,
	district string,
	mandal string,
	village string,
	area string,
	landType string,
	marketValue string,
	ipfsCID string,
) (string, error) {
	// Validate caller role
	if err := requireRole(ctx, "registrar"); err != nil {
		return "", fmt.Errorf("only registrars can request Property IDs: %v", err)
	}

	// Create draft record (no Property ID yet)
	draftRecord := LandRecord{
		PropertyID:     "", // Pending CCLB assignment
		StateCode:      stateCode,
		Owner:          owner,
		SurveyNo:       surveyNo,
		District:       district,
		Mandal:         mandal,
		Village:        village,
		Area:           area,
		LandType:       landType,
		MarketValue:    marketValue,
		LastUpdated:    time.Now().Format("2006-01-02"),
		IPFSCID:        ipfsCID,
		VerifiedByCCLB: false,
	}

	// Generate temporary request ID
	requestID := fmt.Sprintf("REQ-%s-%d", stateCode, time.Now().Unix())

	// Store draft under request ID
	draftJSON, err := json.Marshal(draftRecord)
	if err != nil {
		return "", fmt.Errorf("failed to marshal draft record: %v", err)
	}

	if err := ctx.GetStub().PutState(requestID, draftJSON); err != nil {
		return "", fmt.Errorf("failed to store draft record: %v", err)
	}

	// Emit PropertyIDRequestedEvent (consumed by CCLB or polling backend)
	if err := c.emitPropertyIDRequestedEvent(
		ctx,
		requestID,
		stateCode,
		surveyNo,
		district,
		mandal,
		village,
	); err != nil {
		fmt.Printf("warning: failed to emit PropertyIDRequestedEvent: %v\n", err)
	}

	return requestID, nil
}

// CreateStateRecord binds a CCLB-issued Property ID to full state record
// FEDERATED FLOW STEP 3/3:
//   Prerequisites:
//     - Property ID already issued by CCLB on cclb-global channel
//     - Backend verified the ID exists via QueryPropertyID (CCLB)
//
// This function:
//   - Looks up draft record by request ID (from RequestPropertyID)
//   - Associates CCLB Property ID with state-level details
//   - Stores as authoritative record keyed by Property ID
//   - Emits StateRecordCreatedEvent (consumed by CCLB verification)
func (c *LandRegistryContract) CreateStateRecord(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
	requestID string,
	ipfsCID string,
) (*LandRecord, error) {
	// Validate caller role
	if err := requireRole(ctx, "registrar"); err != nil {
		return nil, fmt.Errorf("only registrars can create state records: %v", err)
	}

	// Retrieve draft record from RequestPropertyID
	draftJSON, err := ctx.GetStub().GetState(requestID)
	if err != nil {
		return nil, fmt.Errorf("failed to read draft record: %v", err)
	}
	if draftJSON == nil {
		return nil, fmt.Errorf("draft record %s not found (did you call RequestPropertyID first?)", requestID)
	}

	var landRecord LandRecord
	if err := json.Unmarshal(draftJSON, &landRecord); err != nil {
		return nil, fmt.Errorf("failed to parse draft record: %v", err)
	}

	// Bind Property ID from CCLB
	landRecord.PropertyID = propertyID
	landRecord.LastUpdated = time.Now().Format("2006-01-02")
	if ipfsCID != "" {
		landRecord.IPFSCID = ipfsCID
	}

	// Store as authoritative record keyed by Property ID
	landRecordJSON, err := json.Marshal(landRecord)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal land record: %v", err)
	}

	if err := ctx.GetStub().PutState(propertyID, landRecordJSON); err != nil {
		return nil, fmt.Errorf("failed to store state record: %v", err)
	}

	// Emit StateRecordCreatedEvent (CCLB will verify and update VerifiedByCCLB flag)
	if err := c.emitStateRecordCreatedEvent(
		ctx,
		propertyID,
		landRecord.StateCode,
		landRecord.SurveyNo,
		landRecord.District,
		landRecord.Mandal,
		landRecord.Village,
	); err != nil {
		fmt.Printf("warning: failed to emit StateRecordCreatedEvent: %v\n", err)
	}

	return &landRecord, nil
}

// ReadLandRecord retrieves a land record by property ID
// Works on both cclb-global (partial data) and state-<code> (full data)
func (c *LandRegistryContract) ReadLandRecord(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
) (*LandRecord, error) {

	landRecordJSON, err := ctx.GetStub().GetState(propertyID)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if landRecordJSON == nil {
		return nil, fmt.Errorf("land record %s does not exist", propertyID)
	}

	var landRecord LandRecord
	err = json.Unmarshal(landRecordJSON, &landRecord)
	if err != nil {
		return nil, err
	}

	return &landRecord, nil
}
