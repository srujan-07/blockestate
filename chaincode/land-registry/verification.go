package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// VerificationRecord tracks VRO verification of land applications
type VerificationRecord struct {
	AppID        string `json:"appId"`
	PropertyID   string `json:"propertyId"`
	VerifiedBy   string `json:"verifiedBy"`  // VRO identity
	VerifierMSP  string `json:"verifierMSP"` // VRO organization MSP
	Status       string `json:"status"`      // VERIFIED, REJECTED, PENDING_CORRECTION
	Comments     string `json:"comments"`
	VerifiedAt   string `json:"verifiedAt"`
	DocumentHash string `json:"documentHash"` // Hash of verification documents
	TxID         string `json:"txId"`
}

// ApprovalRecord tracks MRO approvals with PBFT-style consensus
type ApprovalRecord struct {
	PropertyID     string            `json:"propertyId"`
	AppID          string            `json:"appId"`
	ApprovedBy     string            `json:"approvedBy"` // MRO identity
	ApproverMSP    string            `json:"approverMSP"`
	Status         string            `json:"status"` // APPROVED, REJECTED, PENDING
	ApprovedAt     string            `json:"approvedAt"`
	Comments       string            `json:"comments"`
	TxID           string            `json:"txId"`
	ApprovalNumber int               `json:"approvalNumber"` // Sequence in consensus
	Metadata       map[string]string `json:"metadata,omitempty"`
}

// ConsensusStatus tracks PBFT-style approval consensus for MRO
type ConsensusStatus struct {
	PropertyID        string   `json:"propertyId"`
	AppID             string   `json:"appId"`
	RequiredApprovals int      `json:"requiredApprovals"` // 2/3 threshold
	CurrentApprovals  int      `json:"currentApprovals"`
	ApproversList     []string `json:"approversList"` // MSP IDs of approvers
	Status            string   `json:"status"`        // PENDING, APPROVED, REJECTED
	FinalizedAt       string   `json:"finalizedAt,omitempty"`
	CreatedAt         string   `json:"createdAt"`
	LastUpdated       string   `json:"lastUpdated"`
}

// VerifyLandByVRO allows VRO to verify land application
// RBAC: Only VRO organization members can call this
// Prerequisites: Land application must exist and be in PENDING_VERIFICATION status
func (c *LandRegistryContract) VerifyLandByVRO(
	ctx contractapi.TransactionContextInterface,
	appID string,
	propertyID string,
	status string,
	comments string,
	documentHash string,
) (*VerificationRecord, error) {

	// Enforce VRO-only access
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return nil, fmt.Errorf("failed to get MSP ID: %v", err)
	}

	// Check if caller is from VRO organization
	if mspID != "VROOrgMSP" {
		return nil, fmt.Errorf("only VRO organization can verify land applications, caller MSP: %s", mspID)
	}

	// Validate status
	validStatuses := []string{"VERIFIED", "REJECTED", "PENDING_CORRECTION"}
	statusValid := false
	for _, s := range validStatuses {
		if status == s {
			statusValid = true
			break
		}
	}
	if !statusValid {
		return nil, fmt.Errorf("invalid status: %s. Must be VERIFIED, REJECTED, or PENDING_CORRECTION", status)
	}

	// Get application record
	appKey := "APP_" + appID
	appJSON, err := ctx.GetStub().GetState(appKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read application: %v", err)
	}
	if appJSON == nil {
		return nil, fmt.Errorf("application %s does not exist", appID)
	}

	var app LandApplication
	if err := json.Unmarshal(appJSON, &app); err != nil {
		return nil, fmt.Errorf("failed to unmarshal application: %v", err)
	}

	// Validate application is in correct state for verification
	if app.Status != "PENDING_VERIFICATION" && app.Status != "PENDING_CORRECTION" {
		return nil, fmt.Errorf("application %s is not in PENDING_VERIFICATION or PENDING_CORRECTION status, current: %s", appID, app.Status)
	}

	// Get caller identity
	callerID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Create verification record
	verification := VerificationRecord{
		AppID:        appID,
		PropertyID:   propertyID,
		VerifiedBy:   callerID,
		VerifierMSP:  mspID,
		Status:       status,
		Comments:     comments,
		VerifiedAt:   time.Now().Format("2006-01-02T15:04:05Z"),
		DocumentHash: documentHash,
		TxID:         ctx.GetStub().GetTxID(),
	}

	// Store verification record
	verificationKey := fmt.Sprintf("VERIFY_%s_%s", appID, ctx.GetStub().GetTxID())
	verificationJSON, err := json.Marshal(verification)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal verification: %v", err)
	}

	if err := ctx.GetStub().PutState(verificationKey, verificationJSON); err != nil {
		return nil, fmt.Errorf("failed to store verification record: %v", err)
	}

	// Update application status
	if status == "VERIFIED" {
		app.Status = "VERIFIED_PENDING_APPROVAL"
	} else if status == "REJECTED" {
		app.Status = "REJECTED_BY_VRO"
	} else {
		app.Status = "PENDING_CORRECTION"
	}

	appJSON, _ = json.Marshal(app)
	if err := ctx.GetStub().PutState(appKey, appJSON); err != nil {
		return nil, fmt.Errorf("failed to update application status: %v", err)
	}

	// Emit verification event
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"appId":       appID,
		"propertyId":  propertyID,
		"status":      status,
		"verifiedBy":  callerID,
		"verifierMSP": mspID,
		"txId":        ctx.GetStub().GetTxID(),
	})
	ctx.GetStub().SetEvent("LandVerified", eventPayload)

	return &verification, nil
}

// ApproveLandByMRO allows MRO to approve verified land with PBFT-style consensus
// RBAC: Only MRO organization members can call this
// Prerequisites: Must have VRO verification first
// Consensus: Requires 2/3 MROs approval before finalizing
func (c *LandRegistryContract) ApproveLandByMRO(
	ctx contractapi.TransactionContextInterface,
	appID string,
	propertyID string,
	status string,
	comments string,
) (*ApprovalRecord, error) {

	// Enforce MRO-only access
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return nil, fmt.Errorf("failed to get MSP ID: %v", err)
	}

	// Check if caller is from MRO organization
	if mspID != "MROOrgMSP" {
		return nil, fmt.Errorf("only MRO organization can approve land applications, caller MSP: %s", mspID)
	}

	// Validate status
	validStatuses := []string{"APPROVED", "REJECTED"}
	statusValid := false
	for _, s := range validStatuses {
		if status == s {
			statusValid = true
			break
		}
	}
	if !statusValid {
		return nil, fmt.Errorf("invalid status: %s. Must be APPROVED or REJECTED", status)
	}

	// Get application record
	appKey := "APP_" + appID
	appJSON, err := ctx.GetStub().GetState(appKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read application: %v", err)
	}
	if appJSON == nil {
		return nil, fmt.Errorf("application %s does not exist", appID)
	}

	var app LandApplication
	if err := json.Unmarshal(appJSON, &app); err != nil {
		return nil, fmt.Errorf("failed to unmarshal application: %v", err)
	}

	// Validate application has VRO verification
	if app.Status != "VERIFIED_PENDING_APPROVAL" {
		return nil, fmt.Errorf("application %s must be verified by VRO first, current status: %s", appID, app.Status)
	}

	// Get caller identity
	callerID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Check if this MRO has already approved (prevent double approval)
	existingApprovalKey := fmt.Sprintf("APPROVAL_%s_%s", propertyID, mspID)
	existingApproval, err := ctx.GetStub().GetState(existingApprovalKey)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing approval: %v", err)
	}
	if existingApproval != nil {
		return nil, fmt.Errorf("MRO %s has already submitted approval for property %s", mspID, propertyID)
	}

	// Get or initialize consensus status
	consensusKey := fmt.Sprintf("CONSENSUS_%s", propertyID)
	consensusJSON, err := ctx.GetStub().GetState(consensusKey)

	var consensus ConsensusStatus
	if consensusJSON == nil {
		// Initialize consensus tracking
		consensus = ConsensusStatus{
			PropertyID:        propertyID,
			AppID:             appID,
			RequiredApprovals: 2, // 2/3 of 3 MROs = 2
			CurrentApprovals:  0,
			ApproversList:     []string{},
			Status:            "PENDING",
			CreatedAt:         time.Now().Format("2006-01-02T15:04:05Z"),
			LastUpdated:       time.Now().Format("2006-01-02T15:04:05Z"),
		}
	} else {
		if err := json.Unmarshal(consensusJSON, &consensus); err != nil {
			return nil, fmt.Errorf("failed to unmarshal consensus: %v", err)
		}
	}

	// Create approval record
	approval := ApprovalRecord{
		PropertyID:     propertyID,
		AppID:          appID,
		ApprovedBy:     callerID,
		ApproverMSP:    mspID,
		Status:         status,
		ApprovedAt:     time.Now().Format("2006-01-02T15:04:05Z"),
		Comments:       comments,
		TxID:           ctx.GetStub().GetTxID(),
		ApprovalNumber: consensus.CurrentApprovals + 1,
	}

	// Store individual approval record
	approvalKey := fmt.Sprintf("APPROVAL_%s_%d", propertyID, approval.ApprovalNumber)
	approvalJSON, err := json.Marshal(approval)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal approval: %v", err)
	}

	if err := ctx.GetStub().PutState(approvalKey, approvalJSON); err != nil {
		return nil, fmt.Errorf("failed to store approval record: %v", err)
	}

	// Store MRO-specific approval marker
	if err := ctx.GetStub().PutState(existingApprovalKey, []byte(ctx.GetStub().GetTxID())); err != nil {
		return nil, fmt.Errorf("failed to store approval marker: %v", err)
	}

	// Update consensus status
	if status == "APPROVED" {
		consensus.CurrentApprovals++
		consensus.ApproversList = append(consensus.ApproversList, mspID)
	}
	consensus.LastUpdated = time.Now().Format("2006-01-02T15:04:05Z")

	// Check if consensus threshold reached (PBFT-style)
	if consensus.CurrentApprovals >= consensus.RequiredApprovals {
		consensus.Status = "APPROVED"
		consensus.FinalizedAt = time.Now().Format("2006-01-02T15:04:05Z")

		// Update application to final approved status
		app.Status = "APPROVED"
		appJSON, _ = json.Marshal(app)
		if err := ctx.GetStub().PutState(appKey, appJSON); err != nil {
			return nil, fmt.Errorf("failed to finalize application approval: %v", err)
		}

		// Emit consensus reached event
		consensusEventPayload, _ := json.Marshal(map[string]interface{}{
			"propertyId":       propertyID,
			"appId":            appID,
			"consensusReached": true,
			"approvalCount":    consensus.CurrentApprovals,
			"threshold":        consensus.RequiredApprovals,
			"approvers":        consensus.ApproversList,
			"finalizedAt":      consensus.FinalizedAt,
		})
		ctx.GetStub().SetEvent("ConsensusReached", consensusEventPayload)
	}

	// Store updated consensus status
	consensusJSON, _ = json.Marshal(consensus)
	if err := ctx.GetStub().PutState(consensusKey, consensusJSON); err != nil {
		return nil, fmt.Errorf("failed to update consensus status: %v", err)
	}

	// Emit approval event
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"propertyId":      propertyID,
		"appId":           appID,
		"approvedBy":      callerID,
		"approverMSP":     mspID,
		"status":          status,
		"approvalNumber":  approval.ApprovalNumber,
		"currentCount":    consensus.CurrentApprovals,
		"requiredCount":   consensus.RequiredApprovals,
		"consensusStatus": consensus.Status,
		"txId":            ctx.GetStub().GetTxID(),
	})
	ctx.GetStub().SetEvent("LandApproved", eventPayload)

	return &approval, nil
}

// GetConsensusStatus retrieves the current PBFT consensus status for a property
func (c *LandRegistryContract) GetConsensusStatus(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
) (*ConsensusStatus, error) {

	consensusKey := fmt.Sprintf("CONSENSUS_%s", propertyID)
	consensusJSON, err := ctx.GetStub().GetState(consensusKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read consensus status: %v", err)
	}
	if consensusJSON == nil {
		return nil, fmt.Errorf("consensus status for property %s does not exist", propertyID)
	}

	var consensus ConsensusStatus
	if err := json.Unmarshal(consensusJSON, &consensus); err != nil {
		return nil, fmt.Errorf("failed to unmarshal consensus: %v", err)
	}

	return &consensus, nil
}

// GetVerificationHistory retrieves all VRO verifications for an application
func (c *LandRegistryContract) GetVerificationHistory(
	ctx contractapi.TransactionContextInterface,
	appID string,
) ([]*VerificationRecord, error) {

	// Query all verification records for this application
	queryString := fmt.Sprintf(`{"selector":{"appId":"%s"}}`, appID)
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query verifications: %v", err)
	}
	defer resultsIterator.Close()

	var verifications []*VerificationRecord
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var verification VerificationRecord
		if err := json.Unmarshal(queryResponse.Value, &verification); err != nil {
			continue // Skip malformed records
		}
		verifications = append(verifications, &verification)
	}

	return verifications, nil
}

// GetApprovalHistory retrieves all MRO approvals for a property
func (c *LandRegistryContract) GetApprovalHistory(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
) ([]*ApprovalRecord, error) {

	// Query all approval records for this property
	queryString := fmt.Sprintf(`{"selector":{"propertyId":"%s"}}`, propertyID)
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query approvals: %v", err)
	}
	defer resultsIterator.Close()

	var approvals []*ApprovalRecord
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var approval ApprovalRecord
		if err := json.Unmarshal(queryResponse.Value, &approval); err != nil {
			continue
		}
		approvals = append(approvals, &approval)
	}

	return approvals, nil
}

// RejectLandApplication allows VRO or MRO to reject an application with reason
func (c *LandRegistryContract) RejectLandApplication(
	ctx contractapi.TransactionContextInterface,
	appID string,
	reason string,
) error {

	// Check caller role (VRO or MRO)
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %v", err)
	}

	if mspID != "VROOrgMSP" && mspID != "MROOrgMSP" {
		return fmt.Errorf("only VRO or MRO can reject applications, caller MSP: %s", mspID)
	}

	// Get application
	appKey := "APP_" + appID
	appJSON, err := ctx.GetStub().GetState(appKey)
	if err != nil {
		return fmt.Errorf("failed to read application: %v", err)
	}
	if appJSON == nil {
		return fmt.Errorf("application %s does not exist", appID)
	}

	var app LandApplication
	if err := json.Unmarshal(appJSON, &app); err != nil {
		return fmt.Errorf("failed to unmarshal application: %v", err)
	}

	// Update status
	if mspID == "VROOrgMSP" {
		app.Status = "REJECTED_BY_VRO"
	} else {
		app.Status = "REJECTED_BY_MRO"
	}

	// Store rejection record
	rejectionKey := fmt.Sprintf("REJECTION_%s_%s", appID, ctx.GetStub().GetTxID())
	rejectionRecord := map[string]interface{}{
		"appId":      appID,
		"rejectedBy": mspID,
		"reason":     reason,
		"rejectedAt": time.Now().Format("2006-01-02T15:04:05Z"),
		"txId":       ctx.GetStub().GetTxID(),
	}
	rejectionJSON, _ := json.Marshal(rejectionRecord)
	ctx.GetStub().PutState(rejectionKey, rejectionJSON)

	// Update application
	appJSON, _ = json.Marshal(app)
	ctx.GetStub().PutState(appKey, appJSON)

	// Emit rejection event
	eventPayload, _ := json.Marshal(rejectionRecord)
	ctx.GetStub().SetEvent("ApplicationRejected", eventPayload)

	return nil
}
