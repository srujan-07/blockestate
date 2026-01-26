import React, { useState } from "react";
import './App.css';

export default function LandSearch() {
  const [searchType, setSearchType] = useState("survey");
  const [landData, setLandData] = useState(null);
  const [allProperties, setAllProperties] = useState([]);
  const [showAllProperties, setShowAllProperties] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Form inputs
  const [district, setDistrict] = useState("");
  const [mandal, setMandal] = useState("");
  const [village, setVillage] = useState("");
  const [surveyNo, setSurveyNo] = useState("");
  const [uniqueId, setUniqueId] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captcha, setCaptcha] = useState("ZXA24");

  // Hyperledger Fabric Configuration
  const HYPERLEDGER_API = "http://localhost:4000"; // Your backend API endpoint

  const refreshCaptcha = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let newCaptcha = "";
    for (let i = 0; i < 5; i++) {
      newCaptcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptcha(newCaptcha);
    setCaptchaInput("");
  };

  // Query Hyperledger Fabric for land record
  const queryHyperledger = async (queryKey, queryType) => {
    try {
      let endpoint = "";
      let body = {};

      if (queryType === "survey") {
        endpoint = `${HYPERLEDGER_API}/land/query-by-survey`;
        body = {
          district,
          mandal,
          village,
          surveyNo: queryKey
        };
      } else {
        endpoint = `${HYPERLEDGER_API}/land/query-by-id`;
        body = {
          propertyId: queryKey
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Land record not found");
        }
        throw new Error("Error fetching land record");
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error("Hyperledger query error:", err);
      throw err;
    }
  };

  // Fetch all properties
  const fetchAllProperties = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${HYPERLEDGER_API}/land/all`);
      if (!response.ok) {
        throw new Error("Failed to fetch all properties");
      }
      const data = await response.json();
      setAllProperties(data.records || []);
      setShowAllProperties(true);
      setLandData(null); // Clear single search result
    } catch (err) {
      setError(err.message || "Error fetching all properties");
      console.error("Error fetching all properties:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = async () => {
    setError(null);
    setLandData(null);
    setLoading(true);

    try {
      // Validate captcha
      if (captchaInput.toUpperCase() !== captcha) {
        setError("Invalid captcha. Please try again.");
        refreshCaptcha();
        setLoading(false);
        return;
      }

      if (searchType === "survey") {
        // Validate survey search
        if (!district || !mandal || !village) {
          setError("Please select District, Mandal, and Village.");
          setLoading(false);
          return;
        }
        if (!surveyNo) {
          setError("Please enter Survey Number.");
          setLoading(false);
          return;
        }

        // Query Hyperledger Fabric
        const blockchainData = await queryHyperledger(surveyNo, "survey");
        
        // Validate all fields match (case-insensitive)
        const eq = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
        if (!eq(blockchainData.district, district) || 
            !eq(blockchainData.mandal, mandal) || 
            !eq(blockchainData.village, village) || 
            !eq(blockchainData.surveyNo, surveyNo)) {
          throw new Error("Record not found");
        }
        
        // Blockchain returns land record
        const onChainData = {
          owner: blockchainData.owner,
          surveyNo: blockchainData.surveyNo,
          mandal: blockchainData.mandal,
          district: blockchainData.district,
          village: blockchainData.village,
          area: blockchainData.area,
          landType: blockchainData.landType,
          marketValue: blockchainData.marketValue,
          lastUpdated: blockchainData.lastUpdated,
          txId: blockchainData.transactionId,
          blockNumber: blockchainData.blockNumber
        };

        setLandData(onChainData);

      } else {
        // Validate unique ID search
        if (!uniqueId.trim()) {
          setError("Please enter Unique Property ID.");
          setLoading(false);
          return;
        }

        // Query Hyperledger Fabric by unique ID
        const blockchainData = await queryHyperledger(uniqueId.toUpperCase(), "unique");
        
        // Validate Property ID matches (case-insensitive)
        const eq = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
        if (!eq(blockchainData.propertyId, uniqueId)) {
          throw new Error("Record not found");
        }
        
        const onChainData = {
          owner: blockchainData.owner,
          surveyNo: blockchainData.surveyNo,
          mandal: blockchainData.mandal,
          district: blockchainData.district,
          village: blockchainData.village,
          area: blockchainData.area,
          landType: blockchainData.landType,
          marketValue: blockchainData.marketValue,
          lastUpdated: blockchainData.lastUpdated,
          uniqueId: blockchainData.propertyId,
          txId: blockchainData.transactionId,
          blockNumber: blockchainData.blockNumber
        };

        setLandData(onChainData);
      }

      setCaptchaInput("");
    } catch (err) {
      setError(err.message || "An error occurred while fetching data.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setLandData(null);
    setAllProperties([]);
    setShowAllProperties(false);
    setError(null);
    setDistrict("");
    setMandal("");
    setVillage("");
    setSurveyNo("");
    setUniqueId("");
    setCaptchaInput("");
    refreshCaptcha();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-blue-100 to-purple-100 p-10 flex justify-center">
      <div className="max-w-5xl w-full mt-10 backdrop-blur-xl bg-white/40 shadow-2xl border border-white/30 rounded-3xl p-10">
        <h2 className="text-4xl font-extrabold text-green-800 mb-4 text-center">
          🏞️ Land Registry System
        </h2>

        {/* View All Properties Button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={fetchAllProperties}
            disabled={loading}
            className="px-6 py-2 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            📋 View All Properties
          </button>
        </div>

        {/* Radio Buttons */}
        <div className="flex justify-center gap-12 mb-10">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              checked={searchType === "survey"}
              onChange={() => {
                setSearchType("survey");
                handleReset();
              }}
              className="h-5 w-5 accent-green-700"
            />
            <span className="text-lg font-semibold text-gray-700">
              Survey No. / Sub Division No.
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              checked={searchType === "unique"}
              onChange={() => {
                setSearchType("unique");
                handleReset();
              }}
              className="h-5 w-5 accent-green-700"
            />
            <span className="text-lg font-semibold text-gray-700">
              Unique Property ID
            </span>
          </label>
        </div>

        {/* Survey Section */}
        {searchType === "survey" && (
          <>
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  District *
                </label>
                <select 
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full p-3 rounded-xl bg-white/60 border border-gray-300"
                >
                  <option value="">Please Select</option>
                  <option value="Medchal">Medchal</option>
                  <option value="Rangareddy">Rangareddy</option>
                  <option value="Hyderabad">Hyderabad</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  Mandal *
                </label>
                <select 
                  value={mandal}
                  onChange={(e) => setMandal(e.target.value)}
                  className="w-full p-3 rounded-xl bg-white/60 border border-gray-300"
                >
                  <option value="">Please Select</option>
                  <option value="Ghatkesar">Ghatkesar</option>
                  <option value="Shamshabad">Shamshabad</option>
                  <option value="Shamirpet">Shamirpet</option>
                  <option value="Serilingampally">Serilingampally</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  Village *
                </label>
                <select 
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="w-full p-3 rounded-xl bg-white/60 border border-gray-300"
                >
                  <option value="">Please Select</option>
                  <option value="Edulabad">Edulabad</option>
                  <option value="Kothur">Kothur</option>
                  <option value="Turkapally">Turkapally</option>
                  <option value="Madhapur">Madhapur</option>
                  <option value="Boduppal">Boduppal</option>
                </select>
              </div>
            </div>

            <div className="mb-10">
              <label className="block text-sm font-bold mb-2 text-gray-700">
                Survey Number *
              </label>
              <input
                type="text"
                value={surveyNo}
                onChange={(e) => setSurveyNo(e.target.value)}
                placeholder="Ex: 123/A"
                className="p-3 w-1/2 rounded-xl bg-white/60 border border-gray-300"
              />
            </div>

            {/* Captcha */}
            <div className="flex items-center gap-4 mb-10">
              <div className="h-14 w-32 bg-white/60 border border-gray-300 rounded-xl grid place-items-center font-extrabold text-xl text-gray-700 select-none">
                {captcha}
              </div>

              <button 
                onClick={refreshCaptcha}
                className="p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                ⟳
              </button>

              <input
                type="text"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                placeholder="ENTER CAPTCHA"
                className="flex-1 p-3 rounded-xl bg-white/60 border border-gray-300"
              />
            </div>

            <div className="flex gap-6">
              <button
                onClick={handleFetch}
                disabled={loading}
                className="px-8 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? "Fetching..." : "Fetch from Blockchain"}
              </button>

              <button
                onClick={handleReset}
                disabled={loading}
                className="px-8 py-3 rounded-xl bg-gray-500 text-white font-semibold hover:bg-gray-600 transition-colors disabled:bg-gray-300"
              >
                Reset
              </button>
            </div>
          </>
        )}

        {/* Unique ID */}
        {searchType === "unique" && (
          <div className="mt-6">
            <label className="block text-sm font-bold mb-3 text-gray-700">
              Enter Unique Property ID *
            </label>

            <input
              type="text"
              value={uniqueId}
              onChange={(e) => setUniqueId(e.target.value)}
              placeholder="Ex: PROP-987654"
              className="p-3 w-1/2 rounded-xl bg-white/60 border border-gray-300 uppercase"
            />

            {/* Captcha */}
            <div className="flex items-center gap-4 mt-10 mb-10">
              <div className="h-14 w-32 bg-white/60 border border-gray-300 rounded-xl grid place-items-center font-extrabold text-xl text-gray-700 select-none">
                {captcha}
              </div>

              <button 
                onClick={refreshCaptcha}
                className="p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                ⟳
              </button>

              <input
                type="text"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                placeholder="ENTER CAPTCHA"
                className="flex-1 p-3 rounded-xl bg-white/60 border border-gray-300"
              />
            </div>

            <div className="flex gap-6">
              <button
                onClick={handleFetch}
                disabled={loading}
                className="px-8 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? "Fetching..." : "Fetch from Blockchain"}
              </button>

              <button
                onClick={handleReset}
                disabled={loading}
                className="px-8 py-3 rounded-xl bg-gray-500 text-white font-semibold hover:bg-gray-600 transition-colors disabled:bg-gray-300"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* ERROR MESSAGE */}
        {error && (
          <div className="mt-8 p-4 rounded-xl bg-red-100 border border-red-300 text-red-700 font-semibold">
            {error}
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div className="mt-8 p-4 rounded-xl bg-blue-100 border border-blue-300 text-blue-700 font-semibold flex items-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-700 border-t-transparent rounded-full"></div>
            loading...
          </div>
        )}

        {/* RESULT SECTION */}
        {landData && (
          <div className="mt-12 space-y-6">
            {/* Main Land Details */}
            <div className="p-8 rounded-3xl bg-white/60 shadow-xl border border-gray-300">
              <h3 className="text-2xl font-bold text-green-700 mb-6 flex items-center gap-2">
                🌍 Land Details (On-Chain)
              </h3>

              <div className="grid grid-cols-2 gap-6 text-gray-700">
                <p><strong>Owner: </strong>{landData.owner}</p>
                <p><strong>Survey No: </strong>{landData.surveyNo}</p>
                <p><strong>Mandal: </strong>{landData.mandal}</p>
                <p><strong>District: </strong>{landData.district}</p>
                <p><strong>Village: </strong>{landData.village}</p>
                <p><strong>Area: </strong>{landData.area}</p>
                <p><strong>Land Type: </strong>{landData.landType}</p>
                <p><strong>Market Value: </strong>{landData.marketValue}</p>
                <p><strong>Last Updated: </strong>{landData.lastUpdated}</p>
                {landData.uniqueId && (
                  <p><strong>Unique ID: </strong>{landData.uniqueId}</p>
                )}
              </div>

              
            </div>
          </div>
        )}

        {/* ALL PROPERTIES VIEW */}
        {showAllProperties && allProperties.length > 0 && (
          <div className="mt-12">
            <div className="p-8 rounded-3xl bg-white/60 shadow-xl border border-gray-300">
              <h3 className="text-2xl font-bold text-green-700 mb-6 flex items-center gap-2">
                📋 All Properties ({allProperties.length})
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-green-200 text-green-900">
                      <th className="p-3 border">Property ID</th>
                      <th className="p-3 border">Owner</th>
                      <th className="p-3 border">District</th>
                      <th className="p-3 border">Mandal</th>
                      <th className="p-3 border">Village</th>
                      <th className="p-3 border">Survey No</th>
                      <th className="p-3 border">Area</th>
                      <th className="p-3 border">Land Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allProperties.map((property, index) => (
                      <tr key={index} className="hover:bg-green-50">
                        <td className="p-3 border text-sm">{property.propertyId}</td>
                        <td className="p-3 border">{property.owner}</td>
                        <td className="p-3 border">{property.district}</td>
                        <td className="p-3 border">{property.mandal}</td>
                        <td className="p-3 border">{property.village}</td>
                        <td className="p-3 border">{property.surveyNo}</td>
                        <td className="p-3 border">{property.area}</td>
                        <td className="p-3 border">{property.landType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {showAllProperties && allProperties.length === 0 && !loading && (
          <div className="mt-8 p-4 rounded-xl bg-yellow-100 border border-yellow-300 text-yellow-700 font-semibold">
            No properties found in the system.
          </div>
        )}
      </div>
    </div>
  );
}