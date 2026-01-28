package main

import (
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// CCLBRegistryContract is the main contract for CCLB (Central Land Ledger Board)
// Responsibilities:
// - Issue globally unique Property IDs
// - Maintain national property registry
// - Verify state submissions
// - Act as canonical authority for property metadata
type CCLBRegistryContract struct {
	contractapi.Contract
}

// InitLedger initializes the ledger (called on channel initialization)
func (c *CCLBRegistryContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
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
}

// StateRegistry maps state codes to organization MSPs and channels
type StateRegistry struct {
	StateCode      string `json:"stateCode"`      // TS, KA, AP
	StateName      string `json:"stateName"`      // Telangana, Karnataka
	OrgMSPID       string `json:"orgMSPID"`       // StateTS-MSP
	StateChannelID string `json:"stateChannelID"` // state-ts
	InitializedAt  string `json:"initializedAt"`
}

// IssuePropertyID is called by state ledgers to request a globally unique Property ID
// CCLB endorsement policy ensures this transaction is signed by CCLB admin
// Parameters:
//   - stateCode: State code (TS, KA, AP)
//   - requesterMSP: MSP ID of the requesting state org
//
// Returns: PropertyID with CCLB-generated ID
func (c *CCLBRegistryContract) IssuePropertyID(
	ctx contractapi.TransactionContextInterface,
	stateCode string,
) (*PropertyID, error) {
	// TODO: Implement role validation (CCLB admin only)
	// TODO: Validate stateCode against registered states
	// TODO: Generate atomic sequence number per state per year
	// TODO: Create composite ID: CCLB-<YEAR>-<STATE>-<SEQ>
	// TODO: Persist to state on cclb-global channel
	// TODO: Emit PropertyIDIssuedEvent

	return &PropertyID{
		ID:              fmt.Sprintf("CCLB-2026-%s-000001", stateCode),
		StateCode:       stateCode,
		SubmittedBy:     "TS-MSP",
		CreatedAt:       "2026-01-26T00:00:00Z",
		VerificationSig: "CCLB-VERIFIED",
	}, nil
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

	// TODO: Parse and return PropertyID
	return nil, nil
}

// RegisterState is called once per state to establish the state-<code> channel relationship
// Only CCLB can call this
func (c *CCLBRegistryContract) RegisterState(
	ctx contractapi.TransactionContextInterface,
	stateCode string,
	stateName string,
	orgMSPID string,
	stateChannelID string,
) (*StateRegistry, error) {
	// TODO: Validate caller is CCLB
	// TODO: Validate stateCode format
	// TODO: Store StateRegistry record
	// TODO: Emit StateRegisteredEvent

	return &StateRegistry{
		StateCode:      stateCode,
		StateName:      stateName,
		OrgMSPID:       orgMSPID,
		StateChannelID: stateChannelID,
		InitializedAt:  "2026-01-26T00:00:00Z",
	}, nil
}

// QueryStateRegistry retrieves a state's channel and org information
// Useful for backend routing logic
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

	// TODO: Parse and return StateRegistry
	return nil, nil
}

// VerifyStateRecord is called after a state creates a land record
// CCLB verifies the record references a valid CCLB Property ID
// Cross-channel verification via channel events
func (c *CCLBRegistryContract) VerifyStateRecord(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
	stateCode string,
) (bool, error) {
	// TODO: Query cclb-global ledger for propertyID
	// TODO: Verify ownership matches CCLB registry
	// TODO: Record verification timestamp
	// TODO: Emit VerificationCompletedEvent

	return true, nil
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
