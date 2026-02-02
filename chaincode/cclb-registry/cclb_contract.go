package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// CCLBRegistryContract is the canonical authority for Property IDs
// Deployed on cclb-global channel
// Only CCLB organization can issue Property IDs
type CCLBRegistryContract struct {
	contractapi.Contract
}

// InitLedger initializes the CCLB registry
func (c *CCLBRegistryContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	// Initialize sequence counter for Property IDs
	initialCounter := map[string]int{
		"TS": 0,
		"KA": 0,
		"AP": 0,
	}

	for stateCode, count := range initialCounter {
		counterKey := fmt.Sprintf("COUNTER:%s:%d", stateCode, time.Now().Year())
		counterJSON, _ := json.Marshal(count)
		ctx.GetStub().PutState(counterKey, counterJSON)
	}

	fmt.Println("✅ CCLB Registry initialized on cclb-global channel")
	return nil
}

// PropertyID represents a centrally-issued globally unique identifier
type PropertyID struct {
	ID              string `json:"id"`              // Format: CCLB-YEAR-STATE-SEQUENCE
	StateCode       string `json:"stateCode"`       // TS, KA, AP, etc.
	SubmittedBy     string `json:"submittedBy"`     // State organization MSP ID
	CreatedAt       string `json:"createdAt"`       // Timestamp
	VerificationSig string `json:"verificationSig"` // CCLB signature/attestation
	TxID            string `json:"txId"`            // Transaction ID
}

// StateRegistry maps state codes to organization MSPs and channels
type StateRegistry struct {
	StateCode      string `json:"stateCode"`      // TS, KA, AP
	StateName      string `json:"stateName"`      // Telangana, Karnataka
	OrgMSPID       string `json:"orgMSPID"`       // StateOrgTSMSP
	StateChannelID string `json:"stateChannelID"` // state-ts
	InitializedAt  string `json:"initializedAt"`
	RegisteredBy   string `json:"registeredBy"` // CCLB admin MSP ID
}

// IssuePropertyID issues a globally unique Property ID
// CRITICAL: Only CCLB can call this (enforced by endorsement policy)
// Generates atomic sequence: CCLB-YEAR-STATE-SEQUENCE
func (c *CCLBRegistryContract) IssuePropertyID(
	ctx contractapi.TransactionContextInterface,
	stateCode string,
) (*PropertyID, error) {

	// Validate caller is from CCLB organization
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return nil, fmt.Errorf("failed to get MSP ID: %v", err)
	}

	// In production, enforce CCLB-only access
	// For now, we'll log a warning if not CCLB
	if mspID != "CCLEBMSP" {
		fmt.Printf("⚠️  WARNING: Property ID issued by non-CCLB org: %s\n", mspID)
	}

	// Validate state code is registered
	stateRegistryKey := fmt.Sprintf("STATE:%s", stateCode)
	stateJSON, err := ctx.GetStub().GetState(stateRegistryKey)
	if err != nil {
		return nil, fmt.Errorf("failed to verify state registration: %v", err)
	}
	if stateJSON == nil {
		return nil, fmt.Errorf("state %s is not registered with CCLB", stateCode)
	}

	// Get and increment sequence counter atomically
	currentYear := time.Now().Year()
	counterKey := fmt.Sprintf("COUNTER:%s:%d", stateCode, currentYear)

	counterJSON, err := ctx.GetStub().GetState(counterKey)
	if err != nil {
		return nil, fmt.Errorf("failed to get counter: %v", err)
	}

	var counter int
	if counterJSON == nil {
		counter = 0
	} else {
		json.Unmarshal(counterJSON, &counter)
	}

	// Increment counter
	counter++
	newCounterJSON, _ := json.Marshal(counter)
	ctx.GetStub().PutState(counterKey, newCounterJSON)

	// Generate Property ID: CCLB-YEAR-STATE-SEQUENCE (6 digits)
	propertyID := fmt.Sprintf("CCLB-%d-%s-%06d", currentYear, stateCode, counter)

	// Get transaction ID for verification
	txID := ctx.GetStub().GetTxID()

	// Create PropertyID record
	propIDRecord := &PropertyID{
		ID:              propertyID,
		StateCode:       stateCode,
		SubmittedBy:     mspID,
		CreatedAt:       time.Now().Format("2006-01-02T15:04:05Z"),
		VerificationSig: fmt.Sprintf("CCLB-VERIFIED-%s", txID),
		TxID:            txID,
	}

	// Store PropertyID on ledger
	propIDJSON, err := json.Marshal(propIDRecord)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal Property ID: %v", err)
	}

	if err := ctx.GetStub().PutState(propertyID, propIDJSON); err != nil {
		return nil, fmt.Errorf("failed to store Property ID: %v", err)
	}

	// Emit PropertyIDIssuedEvent
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"propertyId": propertyID,
		"stateCode":  stateCode,
		"issuedBy":   mspID,
		"txId":       txID,
	})
	ctx.GetStub().SetEvent("PropertyIDIssued", eventPayload)

	return propIDRecord, nil
}

// QueryPropertyID retrieves a Property ID from the national registry
// Accessible by all state organizations
func (c *CCLBRegistryContract) QueryPropertyID(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
) (*PropertyID, error) {

	propJSON, err := ctx.GetStub().GetState(propertyID)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if propJSON == nil {
		return nil, fmt.Errorf("property ID %s does not exist in national registry", propertyID)
	}

	var propID PropertyID
	err = json.Unmarshal(propJSON, &propID)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal Property ID: %v", err)
	}

	return &propID, nil
}

// RegisterState registers a state organization with CCLB
// CRITICAL: Only CCLB can call this
func (c *CCLBRegistryContract) RegisterState(
	ctx contractapi.TransactionContextInterface,
	stateCode string,
	stateName string,
	orgMSPID string,
	stateChannelID string,
) (*StateRegistry, error) {

	// Validate caller is CCLB
	callerMSP, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return nil, fmt.Errorf("failed to get caller MSP: %v", err)
	}

	if callerMSP != "CCLEBMSP" {
		return nil, fmt.Errorf("only CCLB can register states, caller: %s", callerMSP)
	}

	// Validate state code format (2-3 uppercase letters)
	if len(stateCode) < 2 || len(stateCode) > 3 {
		return nil, fmt.Errorf("invalid state code format: %s", stateCode)
	}

	// Check if state already registered
	registryKey := fmt.Sprintf("STATE:%s", stateCode)
	existing, err := ctx.GetStub().GetState(registryKey)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing registration: %v", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("state %s is already registered", stateCode)
	}

	// Create StateRegistry record
	registry := &StateRegistry{
		StateCode:      stateCode,
		StateName:      stateName,
		OrgMSPID:       orgMSPID,
		StateChannelID: stateChannelID,
		InitializedAt:  time.Now().Format("2006-01-02T15:04:05Z"),
		RegisteredBy:   callerMSP,
	}

	registryJSON, err := json.Marshal(registry)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal state registry: %v", err)
	}

	if err := ctx.GetStub().PutState(registryKey, registryJSON); err != nil {
		return nil, fmt.Errorf("failed to store state registry: %v", err)
	}

	// Emit StateRegisteredEvent
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"stateCode":    stateCode,
		"stateName":    stateName,
		"orgMSPID":     orgMSPID,
		"channelId":    stateChannelID,
		"registeredBy": callerMSP,
	})
	ctx.GetStub().SetEvent("StateRegistered", eventPayload)

	return registry, nil
}

// QueryStateRegistry retrieves a state's channel and org information
func (c *CCLBRegistryContract) QueryStateRegistry(
	ctx contractapi.TransactionContextInterface,
	stateCode string,
) (*StateRegistry, error) {

	registryKey := fmt.Sprintf("STATE:%s", stateCode)
	registryJSON, err := ctx.GetStub().GetState(registryKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read state registry: %v", err)
	}
	if registryJSON == nil {
		return nil, fmt.Errorf("state %s is not registered", stateCode)
	}

	var registry StateRegistry
	err = json.Unmarshal(registryJSON, &registry)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal state registry: %v", err)
	}

	return &registry, nil
}

// VerifyStateRecord verifies a property record references a valid CCLB Property ID
// Called by state organizations to validate their records
func (c *CCLBRegistryContract) VerifyStateRecord(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
	stateCode string,
) (map[string]interface{}, error) {

	// Query Property ID from CCLB registry
	propID, err := c.QueryPropertyID(ctx, propertyID)
	if err != nil {
		return map[string]interface{}{
			"verified":   false,
			"propertyId": propertyID,
			"error":      err.Error(),
		}, nil
	}

	// Verify state code matches
	if propID.StateCode != stateCode {
		return map[string]interface{}{
			"verified":      false,
			"propertyId":    propertyID,
			"error":         "State code mismatch",
			"expectedState": propID.StateCode,
			"providedState": stateCode,
		}, nil
	}

	// Record verification timestamp
	verificationKey := fmt.Sprintf("VERIFY:%s:%s", propertyID, ctx.GetStub().GetTxID())
	verificationRecord := map[string]interface{}{
		"propertyId": propertyID,
		"stateCode":  stateCode,
		"verifiedAt": time.Now().Format("2006-01-02T15:04:05Z"),
		"verifiedBy": ctx.GetStub().GetTxID(),
	}
	verificationJSON, _ := json.Marshal(verificationRecord)
	ctx.GetStub().PutState(verificationKey, verificationJSON)

	// Emit VerificationCompletedEvent
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"propertyId": propertyID,
		"stateCode":  stateCode,
		"verified":   true,
		"txId":       ctx.GetStub().GetTxID(),
	})
	ctx.GetStub().SetEvent("VerificationCompleted", eventPayload)

	return map[string]interface{}{
		"verified":        true,
		"propertyId":      propertyID,
		"stateCode":       stateCode,
		"issuedBy":        propID.SubmittedBy,
		"createdAt":       propID.CreatedAt,
		"verificationSig": propID.VerificationSig,
	}, nil
}

// GetPropertyIDSequence returns the current sequence number for a state
// Used for monitoring and auditing
func (c *CCLBRegistryContract) GetPropertyIDSequence(
	ctx contractapi.TransactionContextInterface,
	stateCode string,
	year int,
) (int, error) {

	if year == 0 {
		year = time.Now().Year()
	}

	counterKey := fmt.Sprintf("COUNTER:%s:%d", stateCode, year)
	counterJSON, err := ctx.GetStub().GetState(counterKey)
	if err != nil {
		return 0, fmt.Errorf("failed to get counter: %v", err)
	}

	if counterJSON == nil {
		return 0, nil
	}

	var counter int
	json.Unmarshal(counterJSON, &counter)
	return counter, nil
}

func main() {
	contract := new(CCLBRegistryContract)

	cc, err := contractapi.NewChaincode(contract)
	if err != nil {
		panic(fmt.Sprintf("error creating chaincode: %s", err.Error()))
	}

	if err := cc.Start(); err != nil {
		panic(fmt.Sprintf("error starting chaincode: %s", err.Error()))
	}
}
