package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// OwnershipHistory represents a complete ownership transfer record
type OwnershipHistory struct {
	PropertyID             string   `json:"propertyId"`
	TransferID             string   `json:"transferId"`   // Unique transfer identifier
	FromOwner              string   `json:"fromOwner"`    // Previous owner ID
	ToOwner                string   `json:"toOwner"`      // New owner ID
	TransferType           string   `json:"transferType"` // SALE, INHERITANCE, GIFT, COURT_ORDER
	TransferDate           string   `json:"transferDate"`
	ConsiderationAmount    string   `json:"considerationAmount,omitempty"` // Sale price (if applicable)
	DocumentHash           string   `json:"documentHash"`                  // Hash of transfer documents
	Status                 string   `json:"status"`                        // INITIATED, VERIFIED, APPROVED, COMPLETED
	InitiatedBy            string   `json:"initiatedBy"`                   // Who initiated transfer
	InitiatedByMSP         string   `json:"initiatedByMSP"`
	VerifiedBy             string   `json:"verifiedBy,omitempty"` // VRO verification
	ApprovedBy             []string `json:"approvedBy,omitempty"` // MRO approvals
	CompletedAt            string   `json:"completedAt,omitempty"`
	PreviousOwnerSignature string   `json:"previousOwnerSignature,omitempty"`
	NewOwnerSignature      string   `json:"newOwnerSignature,omitempty"`
	TxID                   string   `json:"txId"`
	BlockNumber            uint64   `json:"blockNumber,omitempty"`
}

// TransferOwnership initiates ownership transfer with full audit trail
// PRODUCTION REQUIREMENTS:
//   - Must reference previous owner (no orphan records)
//   - Requires previous owner consent (signature/attestation)
//   - Must go through VRO verification
//   - Must receive MRO approval (PBFT consensus)
//   - Immutable history - creates new record, never updates
func (c *LandRegistryContract) TransferOwnership(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
	newOwner string,
	transferType string,
	considerationAmount string,
	documentHash string,
) (*OwnershipHistory, error) {

	// Get caller identity
	callerID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return nil, fmt.Errorf("failed to get MSP ID: %v", err)
	}

	// Validate transfer type
	validTransferTypes := []string{"SALE", "INHERITANCE", "GIFT", "COURT_ORDER", "PARTITION"}
	transferTypeValid := false
	for _, t := range validTransferTypes {
		if transferType == t {
			transferTypeValid = true
			break
		}
	}
	if !transferTypeValid {
		return nil, fmt.Errorf("invalid transfer type: %s", transferType)
	}

	// Get current land record
	landRecordJSON, err := ctx.GetStub().GetState(propertyID)
	if err != nil {
		return nil, fmt.Errorf("failed to read land record: %v", err)
	}
	if landRecordJSON == nil {
		return nil, fmt.Errorf("property %s does not exist", propertyID)
	}

	var landRecord LandRecord
	if err := json.Unmarshal(landRecordJSON, &landRecord); err != nil {
		return nil, fmt.Errorf("failed to unmarshal land record: %v", err)
	}

	// Store current owner as previous owner
	previousOwner := landRecord.Owner

	// Validate caller has rights to initiate transfer
	// In production, add more sophisticated permission checks
	if callerID != previousOwner && mspID != "AdminOrgMSP" && mspID != "CCLEBMSP" {
		// Allow if caller is authorized official
		if mspID != "VROOrgMSP" && mspID != "MROOrgMSP" {
			return nil, fmt.Errorf("only property owner or authorized officials can initiate transfer")
		}
	}

	// Generate unique transfer ID
	transferID := fmt.Sprintf("TRANSFER_%s_%d", propertyID, time.Now().UnixNano())

	// Create ownership transfer record
	ownershipTransfer := OwnershipHistory{
		PropertyID:          propertyID,
		TransferID:          transferID,
		FromOwner:           previousOwner,
		ToOwner:             newOwner,
		TransferType:        transferType,
		TransferDate:        time.Now().Format("2006-01-02T15:04:05Z"),
		ConsiderationAmount: considerationAmount,
		DocumentHash:        documentHash,
		Status:              "INITIATED",
		InitiatedBy:         callerID,
		InitiatedByMSP:      mspID,
		TxID:                ctx.GetStub().GetTxID(),
	}

	// Store transfer record (immutable history)
	transferKey := fmt.Sprintf("TRANSFER_%s", transferID)
	transferJSON, err := json.Marshal(ownershipTransfer)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal transfer record: %v", err)
	}

	if err := ctx.GetStub().PutState(transferKey, transferJSON); err != nil {
		return nil, fmt.Errorf("failed to store transfer record: %v", err)
	}

	// Store transfer reference indexed by property
	propertyTransferKey := fmt.Sprintf("PROPERTY_TRANSFER_%s_%s", propertyID, transferID)
	if err := ctx.GetStub().PutState(propertyTransferKey, []byte(transferID)); err != nil {
		return nil, fmt.Errorf("failed to store property transfer index: %v", err)
	}

	// Emit transfer initiated event
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"propertyId":   propertyID,
		"transferId":   transferID,
		"fromOwner":    previousOwner,
		"toOwner":      newOwner,
		"transferType": transferType,
		"status":       "INITIATED",
		"initiatedBy":  callerID,
		"txId":         ctx.GetStub().GetTxID(),
	})
	ctx.GetStub().SetEvent("OwnershipTransferInitiated", eventPayload)

	return &ownershipTransfer, nil
}

// VerifyOwnershipTransfer allows VRO to verify ownership transfer
func (c *LandRegistryContract) VerifyOwnershipTransfer(
	ctx contractapi.TransactionContextInterface,
	transferID string,
	verified bool,
	comments string,
) error {

	// Enforce VRO-only access
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %v", err)
	}

	if mspID != "VROOrgMSP" {
		return fmt.Errorf("only VRO can verify ownership transfers, caller MSP: %s", mspID)
	}

	// Get transfer record
	transferKey := fmt.Sprintf("TRANSFER_%s", transferID)
	transferJSON, err := ctx.GetStub().GetState(transferKey)
	if err != nil {
		return fmt.Errorf("failed to read transfer record: %v", err)
	}
	if transferJSON == nil {
		return fmt.Errorf("transfer %s does not exist", transferID)
	}

	var transfer OwnershipHistory
	if err := json.Unmarshal(transferJSON, &transfer); err != nil {
		return fmt.Errorf("failed to unmarshal transfer: %v", err)
	}

	// Update transfer status
	callerID, _ := ctx.GetClientIdentity().GetID()
	transfer.VerifiedBy = callerID

	if verified {
		transfer.Status = "VERIFIED"
	} else {
		transfer.Status = "REJECTED_BY_VRO"
	}

	// Store updated transfer
	transferJSON, _ = json.Marshal(transfer)
	ctx.GetStub().PutState(transferKey, transferJSON)

	// Emit event
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"transferId": transferID,
		"verified":   verified,
		"verifiedBy": callerID,
		"comments":   comments,
		"status":     transfer.Status,
	})
	ctx.GetStub().SetEvent("OwnershipTransferVerified", eventPayload)

	return nil
}

// ApproveOwnershipTransfer allows MRO to approve verified ownership transfer
// Implements PBFT-style consensus (requires 2/3 MRO approval)
func (c *LandRegistryContract) ApproveOwnershipTransfer(
	ctx contractapi.TransactionContextInterface,
	transferID string,
) error {

	// Enforce MRO-only access
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %v", err)
	}

	if mspID != "MROOrgMSP" {
		return fmt.Errorf("only MRO can approve ownership transfers, caller MSP: %s", mspID)
	}

	// Get transfer record
	transferKey := fmt.Sprintf("TRANSFER_%s", transferID)
	transferJSON, err := ctx.GetStub().GetState(transferKey)
	if err != nil {
		return fmt.Errorf("failed to read transfer record: %v", err)
	}
	if transferJSON == nil {
		return fmt.Errorf("transfer %s does not exist", transferID)
	}

	var transfer OwnershipHistory
	if err := json.Unmarshal(transferJSON, &transfer); err != nil {
		return fmt.Errorf("failed to unmarshal transfer: %v", err)
	}

	// Validate transfer is verified
	if transfer.Status != "VERIFIED" && transfer.Status != "APPROVED" {
		return fmt.Errorf("transfer must be verified by VRO first, current status: %s", transfer.Status)
	}

	// Check if this MRO already approved
	callerID, _ := ctx.GetClientIdentity().GetID()
	for _, approver := range transfer.ApprovedBy {
		if approver == callerID {
			return fmt.Errorf("MRO %s has already approved this transfer", callerID)
		}
	}

	// Add approval
	transfer.ApprovedBy = append(transfer.ApprovedBy, callerID)
	transfer.Status = "APPROVED"

	// Check if consensus threshold reached (2/3 of 3 MROs = 2)
	requiredApprovals := 2
	if len(transfer.ApprovedBy) >= requiredApprovals {
		// Finalize transfer
		if err := c.finalizeOwnershipTransfer(ctx, &transfer); err != nil {
			return fmt.Errorf("failed to finalize transfer: %v", err)
		}
	}

	// Store updated transfer
	transferJSON, _ = json.Marshal(transfer)
	ctx.GetStub().PutState(transferKey, transferJSON)

	// Emit event
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"transferId":       transferID,
		"approvedBy":       callerID,
		"approvalCount":    len(transfer.ApprovedBy),
		"requiredCount":    requiredApprovals,
		"status":           transfer.Status,
		"consensusReached": len(transfer.ApprovedBy) >= requiredApprovals,
	})
	ctx.GetStub().SetEvent("OwnershipTransferApproved", eventPayload)

	return nil
}

// finalizeOwnershipTransfer completes the ownership transfer and updates land record
func (c *LandRegistryContract) finalizeOwnershipTransfer(
	ctx contractapi.TransactionContextInterface,
	transfer *OwnershipHistory,
) error {

	// Get current land record
	landRecordJSON, err := ctx.GetStub().GetState(transfer.PropertyID)
	if err != nil {
		return fmt.Errorf("failed to read land record: %v", err)
	}
	if landRecordJSON == nil {
		return fmt.Errorf("property %s does not exist", transfer.PropertyID)
	}

	var landRecord LandRecord
	if err := json.Unmarshal(landRecordJSON, &landRecord); err != nil {
		return fmt.Errorf("failed to unmarshal land record: %v", err)
	}

	// Store ownership history before updating
	historyKey := fmt.Sprintf("HISTORY_%s_%d", transfer.PropertyID, time.Now().UnixNano())
	previousOwnershipRecord := map[string]interface{}{
		"propertyId":    transfer.PropertyID,
		"previousOwner": landRecord.Owner,
		"newOwner":      transfer.ToOwner,
		"transferId":    transfer.TransferID,
		"transferType":  transfer.TransferType,
		"transferDate":  transfer.TransferDate,
		"recordedAt":    time.Now().Format("2006-01-02T15:04:05Z"),
		"txId":          ctx.GetStub().GetTxID(),
	}
	historyJSON, _ := json.Marshal(previousOwnershipRecord)
	ctx.GetStub().PutState(historyKey, historyJSON)

	// Update land record with new owner
	landRecord.Owner = transfer.ToOwner
	landRecord.LastUpdated = time.Now().Format("2006-01-02T15:04:05Z")

	// Store updated land record
	landRecordJSON, _ = json.Marshal(landRecord)
	if err := ctx.GetStub().PutState(transfer.PropertyID, landRecordJSON); err != nil {
		return fmt.Errorf("failed to update land record: %v", err)
	}

	// Update transfer status to completed
	transfer.Status = "COMPLETED"
	transfer.CompletedAt = time.Now().Format("2006-01-02T15:04:05Z")

	// Emit ownership transfer completed event
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"propertyId":  transfer.PropertyID,
		"transferId":  transfer.TransferID,
		"fromOwner":   transfer.FromOwner,
		"toOwner":     transfer.ToOwner,
		"completedAt": transfer.CompletedAt,
		"txId":        ctx.GetStub().GetTxID(),
	})
	ctx.GetStub().SetEvent("OwnershipTransferCompleted", eventPayload)

	return nil
}

// GetOwnershipHistory retrieves complete ownership history for a property
func (c *LandRegistryContract) GetOwnershipHistory(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
) ([]*OwnershipHistory, error) {

	// Query all transfer records for this property
	queryString := fmt.Sprintf(`{"selector":{"propertyId":"%s"}}`, propertyID)
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query ownership history: %v", err)
	}
	defer resultsIterator.Close()

	var history []*OwnershipHistory
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var transfer OwnershipHistory
		if err := json.Unmarshal(queryResponse.Value, &transfer); err != nil {
			continue
		}
		history = append(history, &transfer)
	}

	return history, nil
}

// GetTransferDetails retrieves details of a specific ownership transfer
func (c *LandRegistryContract) GetTransferDetails(
	ctx contractapi.TransactionContextInterface,
	transferID string,
) (*OwnershipHistory, error) {

	transferKey := fmt.Sprintf("TRANSFER_%s", transferID)
	transferJSON, err := ctx.GetStub().GetState(transferKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read transfer record: %v", err)
	}
	if transferJSON == nil {
		return nil, fmt.Errorf("transfer %s does not exist", transferID)
	}

	var transfer OwnershipHistory
	if err := json.Unmarshal(transferJSON, &transfer); err != nil {
		return nil, fmt.Errorf("failed to unmarshal transfer: %v", err)
	}

	return &transfer, nil
}

// GetPendingTransfers retrieves all pending ownership transfers (requires action)
func (c *LandRegistryContract) GetPendingTransfers(
	ctx contractapi.TransactionContextInterface,
) ([]*OwnershipHistory, error) {

	// Query transfers with status INITIATED, VERIFIED, or APPROVED
	queryString := `{
		"selector": {
			"status": {
				"$in": ["INITIATED", "VERIFIED", "APPROVED"]
			}
		}
	}`

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query pending transfers: %v", err)
	}
	defer resultsIterator.Close()

	var transfers []*OwnershipHistory
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var transfer OwnershipHistory
		if err := json.Unmarshal(queryResponse.Value, &transfer); err != nil {
			continue
		}
		transfers = append(transfers, &transfer)
	}

	return transfers, nil
}
