package main

type Land struct {
    LandID       string  `json:"landID"`
    SurveyNo     string  `json:"surveyNo"`
    State        string  `json:"state"`
    District     string  `json:"district"`
    OwnerID      string  `json:"ownerID"`
    Area         float64 `json:"area"`
    GeoHash      string  `json:"geoHash"`
    Status       string  `json:"status"`
    RegisteredBy string  `json:"registeredBy"`
    ApprovedBy   string  `json:"approvedBy"`
}

