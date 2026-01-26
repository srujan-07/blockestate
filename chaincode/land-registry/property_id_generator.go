package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// PropertyIDGenerator handles atomic Property ID generation
// Format: LRI-IND-<STATE>-<YEAR>-<SEQUENCE>
// Example: LRI-IND-TS-2026-000124

// PropertyIDCounter tracks sequence numbers per state per year (for atomicity)
type PropertyIDCounter struct {
	State    string `json:"state"`
	Year     int    `json:"year"`
	Sequence int    `json:"sequence"`
}

const (
	counterKeyPrefix = "COUNTER_"
)

// GeneratePropertyID creates an atomic, globally unique Property ID
func (c *LandRegistryContract) GeneratePropertyID(
	ctx contractapi.TransactionContextInterface,
	state string,
) (string, error) {

	// Normalize state code (e.g., "Telangana" -> "TS")
	stateCode := normalizeStateCode(state)
	if stateCode == "" {
		return "", fmt.Errorf("invalid or unsupported state: %s", state)
	}

	currentYear := time.Now().Year()
	counterKey := fmt.Sprintf("%s%s_%d", counterKeyPrefix, stateCode, currentYear)

	// Read current counter (atomically within transaction)
	counterJSON, err := ctx.GetStub().GetState(counterKey)
	if err != nil {
		return "", fmt.Errorf("failed to read counter: %v", err)
	}

	var counter PropertyIDCounter
	if counterJSON == nil {
		// First Property ID for this state/year
		counter = PropertyIDCounter{
			State:    stateCode,
			Year:     currentYear,
			Sequence: 0,
		}
	} else {
		err = json.Unmarshal(counterJSON, &counter)
		if err != nil {
			return "", fmt.Errorf("failed to parse counter: %v", err)
		}
	}

	// Increment sequence atomically
	counter.Sequence++

	// Persist updated counter
	updatedCounterJSON, err := json.Marshal(counter)
	if err != nil {
		return "", fmt.Errorf("failed to marshal counter: %v", err)
	}
	err = ctx.GetStub().PutState(counterKey, updatedCounterJSON)
	if err != nil {
		return "", fmt.Errorf("failed to update counter: %v", err)
	}

	// Generate Property ID
	propertyID := fmt.Sprintf("LRI-IND-%s-%d-%06d", stateCode, currentYear, counter.Sequence)
	return propertyID, nil
}

// GetPropertyIDCounter retrieves the current sequence for a state/year (read-only)
func (c *LandRegistryContract) GetPropertyIDCounter(
	ctx contractapi.TransactionContextInterface,
	state string,
) (*PropertyIDCounter, error) {

	stateCode := normalizeStateCode(state)
	if stateCode == "" {
		return nil, fmt.Errorf("invalid state: %s", state)
	}

	currentYear := time.Now().Year()
	counterKey := fmt.Sprintf("%s%s_%d", counterKeyPrefix, stateCode, currentYear)

	counterJSON, err := ctx.GetStub().GetState(counterKey)
	if err != nil {
		return nil, err
	}

	if counterJSON == nil {
		return &PropertyIDCounter{
			State:    stateCode,
			Year:     currentYear,
			Sequence: 0,
		}, nil
	}

	var counter PropertyIDCounter
	err = json.Unmarshal(counterJSON, &counter)
	if err != nil {
		return nil, err
	}

	return &counter, nil
}

// normalizeStateCode converts full state name to two-letter code
// Supports Indian states
func normalizeStateCode(state string) string {
	stateMappings := map[string]string{
		"telangana":         "TS",
		"andhra pradesh":    "AP",
		"karnataka":         "KA",
		"tamil nadu":        "TN",
		"maharashtra":       "MH",
		"uttar pradesh":     "UP",
		"uttarakhand":       "UK",
		"himachal pradesh":  "HP",
		"punjab":            "PB",
		"haryana":           "HR",
		"delhi":             "DL",
		"rajasthan":         "RJ",
		"goa":               "GA",
		"west bengal":       "WB",
		"odisha":            "OD",
		"jharkhand":         "JH",
		"bihar":             "BR",
		"madhya pradesh":    "MP",
		"chhattisgarh":      "CT",
		"assam":             "AS",
		"manipur":           "MN",
		"meghalaya":         "ML",
		"mizoram":           "MZ",
		"nagaland":          "NL",
		"tripura":           "TR",
		"arunachal pradesh": "AR",
		"sikkim":            "SK",
		"kerala":            "KL",
		"puducherry":        "PY",
		"ladakh":            "LA",
		"jammu & kashmir":   "JK",
		"jammu and kashmir": "JK",
	}

	normalized := strings.ToLower(strings.TrimSpace(state))
	if code, exists := stateMappings[normalized]; exists {
		return code
	}

	// If already a two-letter code, validate and return
	if len(state) == 2 {
		upperCode := strings.ToUpper(state)
		for _, v := range stateMappings {
			if v == upperCode {
				return upperCode
			}
		}
	}

	return ""
}
