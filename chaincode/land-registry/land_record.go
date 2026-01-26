package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// LandRecord represents a land property record stored on state-specific channels
// In federated architecture:
//   - PropertyID is issued ONLY by CCLB via IssuePropertyID on cclb-global
//   - StateRecord holds full details and local state transactions
//   - Each PropertyID appears on exactly one state channel (state-<code>)
type LandRecord struct {
	PropertyID      string `json:"propertyId"`      // CCLB-2026-TS-000001 (from cclb-global)
	StateCode       string `json:"stateCode"`       // TS, KA, AP (for routing)
	Owner           string `json:"owner"`
	SurveyNo        string `json:"surveyNo"`
	District        string `json:"district"`
	Mandal          string `json:"mandal"`
	Village         string `json:"village"`
	Area            string `json:"area"`
	LandType        string `json:"landType"`
	MarketValue     string `json:"marketValue"`
	LastUpdated     string `json:"lastUpdated"`
	IPFSCID         string `json:"ipfsCID,omitempty"`
	VerifiedByCCLB  bool   `json:"verifiedByCCLB"`  // Cross-chain verification status
	CCLBVerifyTx    string `json:"ccLbVerifyTx"`    // Reference to CCLB verification tx
}

// CreateLandRecord creates a new land record on the state channel
// FEDERATED ARCHITECTURE CHANGE:
//   - PropertyID is NO LONGER auto-generated here
//   - Instead: Use RequestPropertyID() first to get CCLB-issued ID
//   - Then call CreateStateRecord() to bind details to that ID
// This ensures CCLB is canonical authority for Property IDs
// 
// Deprecated in favor of: RequestPropertyID + CreateStateRecord flow
// Kept for backward compatibility only
func (c *LandRegistryContract) CreateLandRecord(
	ctx contractapi.TransactionContextInterface,
	owner string,
	surveyNo string,
	district string,
	mandal string,
	village string,
	area string,
	landType string,
	marketValue string,
	state string,
	ipfsCID string,
) (*LandRecord, error) {

	// Validate caller role
	if err := requireRole(ctx, "registrar"); err != nil {
		return nil, fmt.Errorf("only registrars can create land records: %v", err)
	}

	// DEPRECATED: Auto-generation removed. Return error directing to new flow.
	return nil, fmt.Errorf(
		"❌ Legacy CreateLandRecord is deprecated in federated architecture\n" +
		"Use federated flow: RequestPropertyID() → GetPropertyID() → CreateStateRecord()\n" +
		"This ensures Property IDs are issued ONLY by CCLB",
	)
}

// ReadLandRecord retrieves a land record by property ID
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

// QueryLandBySurvey queries land records by district, mandal, village, and survey number
func (c *LandRegistryContract) QueryLandBySurvey(
	ctx contractapi.TransactionContextInterface,
	district string,
	mandal string,
	village string,
	surveyNo string,
) (*LandRecord, error) {

	// In a real implementation, you'd use a rich query with CouchDB
	// For now, we'll iterate through all records (not efficient for production)

	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	// Helper function for case-insensitive string comparison
	eq := func(a, b string) bool {
		return strings.ToLower(strings.TrimSpace(a)) == strings.ToLower(strings.TrimSpace(b))
	}

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var landRecord LandRecord
		err = json.Unmarshal(queryResponse.Value, &landRecord)
		if err != nil {
			continue // Skip non-land records
		}

		// Check if all fields match (case-insensitive)
		if eq(landRecord.District, district) &&
			eq(landRecord.Mandal, mandal) &&
			eq(landRecord.Village, village) &&
			eq(landRecord.SurveyNo, surveyNo) {
			return &landRecord, nil
		}
	}

	return nil, fmt.Errorf("land record not found for the given survey details")
}

// GetAllLandRecords returns all land records
func (c *LandRegistryContract) GetAllLandRecords(
	ctx contractapi.TransactionContextInterface,
) ([]*LandRecord, error) {

	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var landRecords []*LandRecord
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var landRecord LandRecord
		err = json.Unmarshal(queryResponse.Value, &landRecord)
		if err != nil {
			continue // Skip invalid records
		}

		landRecords = append(landRecords, &landRecord)
	}

	return landRecords, nil
}

// TransferLandRecord transfers property ownership
// Requires 'registrar' role for approval
func (c *LandRegistryContract) TransferLandRecord(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
	newOwner string,
	approvalStatus string,
) (*LandRecord, error) {

	// Validate caller role
	if err := requireRole(ctx, "registrar"); err != nil {
		return nil, fmt.Errorf("only registrars can approve transfers: %v", err)
	}

	// Validate approval status
	validStatuses := map[string]bool{
		"approved": true,
		"rejected": true,
		"pending":  true,
	}
	if !validStatuses[strings.ToLower(approvalStatus)] {
		return nil, fmt.Errorf("invalid approval status: %s", approvalStatus)
	}

	// Read existing land record
	landRecordJSON, err := ctx.GetStub().GetState(propertyID)
	if err != nil {
		return nil, fmt.Errorf("failed to read land record: %v", err)
	}
	if landRecordJSON == nil {
		return nil, fmt.Errorf("land record %s does not exist", propertyID)
	}

	var landRecord LandRecord
	err = json.Unmarshal(landRecordJSON, &landRecord)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal land record: %v", err)
	}

	oldOwner := landRecord.Owner

	// Update owner
	landRecord.Owner = newOwner
	landRecord.LastUpdated = time.Now().Format("2006-01-02")

	// Store updated record
	updatedRecordJSON, err := json.Marshal(landRecord)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal updated record: %v", err)
	}

	if err := ctx.GetStub().PutState(propertyID, updatedRecordJSON); err != nil {
		return nil, fmt.Errorf("failed to update land record: %v", err)
	}

	// Emit PropertyTransferredEvent
	if err := c.emitPropertyTransferredEvent(
		ctx,
		propertyID,
		oldOwner,
		newOwner,
		approvalStatus,
	); err != nil {
		fmt.Printf("warning: failed to emit PropertyTransferredEvent: %v\n", err)
	}

	// Emit PropertyApprovedEvent if approved
	if strings.ToLower(approvalStatus) == "approved" {
		clientID, err := ctx.GetClientIdentity().GetID()
		if err != nil {
			fmt.Printf("warning: failed to get client identity: %v\n", err)
		}
		if err := c.emitPropertyApprovedEvent(
			ctx,
			propertyID,
			clientID,
			"transfer_approved",
		); err != nil {
			fmt.Printf("warning: failed to emit PropertyApprovedEvent: %v\n", err)
		}
	}

	return &landRecord, nil
}

// LinkDocumentHash links an off-chain document hash to a property
// Used for audit trail and document verification
// Requires 'registrar' role
func (c *LandRegistryContract) LinkDocumentHash(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
	documentHash string,
	documentType string,
) error {

	// Validate caller role
	if err := requireRole(ctx, "registrar"); err != nil {
		return fmt.Errorf("only registrars can link documents: %v", err)
	}

	// Validate document hash (should be a valid hex string)
	if documentHash == "" || len(documentHash) < 32 {
		return fmt.Errorf("invalid document hash format")
	}

	// Verify property exists
	landRecordJSON, err := ctx.GetStub().GetState(propertyID)
	if err != nil {
		return fmt.Errorf("failed to verify property: %v", err)
	}
	if landRecordJSON == nil {
		return fmt.Errorf("property %s does not exist", propertyID)
	}

	// Store document hash reference in ledger
	docRefKey := fmt.Sprintf("DOC_%s_%s", propertyID, documentHash)
	docRef := map[string]string{
		"propertyId":   propertyID,
		"documentHash": documentHash,
		"documentType": documentType,
		"linkedAt":     time.Now().Format("2006-01-02T15:04:05Z"),
	}

	docRefJSON, err := json.Marshal(docRef)
	if err != nil {
		return fmt.Errorf("failed to marshal document reference: %v", err)
	}

	if err := ctx.GetStub().PutState(docRefKey, docRefJSON); err != nil {
		return fmt.Errorf("failed to store document reference: %v", err)
	}

	// Emit DocumentLinkedEvent
	if err := c.emitDocumentLinkedEvent(
		ctx,
		propertyID,
		documentHash,
		documentType,
	); err != nil {
		fmt.Printf("warning: failed to emit DocumentLinkedEvent: %v\n", err)
	}

	return nil
}

// GetTransactionHistory retrieves all transactions for a property
// Returns events in chronological order
func (c *LandRegistryContract) GetTransactionHistory(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
) (interface{}, error) {

	// Verify property exists
	landRecordJSON, err := ctx.GetStub().GetState(propertyID)
	if err != nil {
		return nil, fmt.Errorf("failed to verify property: %v", err)
	}
	if landRecordJSON == nil {
		return nil, fmt.Errorf("property %s does not exist", propertyID)
	}

	// Get historical state versions
	historyIterator, err := ctx.GetStub().GetHistoryForKey(propertyID)
	if err != nil {
		return nil, fmt.Errorf("failed to get history: %v", err)
	}
	defer historyIterator.Close()

	var history []interface{}
	for historyIterator.HasNext() {
		entry, err := historyIterator.Next()
		if err != nil {
			return nil, err
		}

		historyEntry := map[string]interface{}{
			"txId":      entry.TxId,
			"value":     string(entry.Value),
			"timestamp": entry.Timestamp.AsTime().Unix(),
		}
		history = append(history, historyEntry)
	}

	return map[string]interface{}{
		"propertyId":       propertyID,
		"transactionCount": len(history),
		"transactions":     history,
	}, nil
}
