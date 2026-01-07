package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// LandRecord represents a land property record
type LandRecord struct {
	PropertyID  string `json:"propertyId"`
	Owner       string `json:"owner"`
	SurveyNo    string `json:"surveyNo"`
	District    string `json:"district"`
	Mandal      string `json:"mandal"`
	Village     string `json:"village"`
	Area        string `json:"area"`
	LandType    string `json:"landType"`
	MarketValue string `json:"marketValue"`
	LastUpdated string `json:"lastUpdated"`
	IPFSCID     string `json:"ipfsCID,omitempty"`
}

// CreateLandRecord creates a new land record on the blockchain
func (c *LandRegistryContract) CreateLandRecord(
	ctx contractapi.TransactionContextInterface,
	propertyID string,
	owner string,
	surveyNo string,
	district string,
	mandal string,
	village string,
	area string,
	landType string,
	marketValue string,
	ipfsCID string,
) error {

	// Check if land record already exists
	exists, _ := ctx.GetStub().GetState(propertyID)
	if exists != nil {
		return fmt.Errorf("land record %s already exists", propertyID)
	}

	// Create the land record
	landRecord := LandRecord{
		PropertyID:  propertyID,
		Owner:       owner,
		SurveyNo:    surveyNo,
		District:    district,
		Mandal:      mandal,
		Village:     village,
		Area:        area,
		LandType:    landType,
		MarketValue: marketValue,
		LastUpdated: "2026-01-04",
		IPFSCID:     ipfsCID,
	}

	// Marshal to JSON
	landRecordJSON, err := json.Marshal(landRecord)
	if err != nil {
		return err
	}

	// Store in the ledger
	return ctx.GetStub().PutState(propertyID, landRecordJSON)
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
