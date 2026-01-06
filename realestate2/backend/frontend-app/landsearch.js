import React, { useState } from "react";

export default function LandSearch() {
  const [searchType, setSearchType] = useState("survey");
  const [landData, setLandData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [district, setDistrict] = useState("");
  const [mandal, setMandal] = useState("");
  const [village, setVillage] = useState("");
  const [surveyNo, setSurveyNo] = useState("");
  const [uniqueId, setUniqueId] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captcha, setCaptcha] = useState("ZXA24");

  const HYPERLEDGER_API = "http://localhost:3001/api";
  const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

  const refreshCaptcha = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let newCaptcha = "";
    for (let i = 0; i < 5; i++) {
      newCaptcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptcha(newCaptcha);
    setCaptchaInput("");
  };

  const fetchFromIPFS = async (ipfsCID) => {
    try {
      const response = await fetch(`${IPFS_GATEWAY}${ipfsCID}`);
      if (!response.ok) throw new Error("Failed to fetch from IPFS");
      return await response.json();
    } catch (err) {
      console.error(err);
      throw new Error("Unable to retrieve document from IPFS");
    }
  };

  const queryHyperledger = async (queryKey, queryType) => {
    try {
      let endpoint = "";
      let body = {};

      if (queryType === "survey") {
        endpoint = `${HYPERLEDGER_API}/land/query-by-survey`;
        body = { district, mandal, village, surveyNo: queryKey };
      } else {
        endpoint = `${HYPERLEDGER_API}/land/query-by-id`;
        body = { propertyId: queryKey };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Land record not found");

      return await response.json();
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleFetch = async () => {
    setError(null);
    setLandData(null);
    setLoading(true);

    try {
      if (captchaInput.toUpperCase() !== captcha) {
        setError("Invalid captcha. Please try again.");
        refreshCaptcha();
        setLoading(false);
        return;
      }

      if (searchType === "survey") {
        if (!district || !mandal || !village || !surveyNo) {
          setError("Please fill all required fields.");
          setLoading(false);
          return;
        }

        const blockchainData = await queryHyperledger(surveyNo, "survey");
        let offChainData = {};

        if (blockchainData.ipfsCID) {
          offChainData = await fetchFromIPFS(blockchainData.ipfsCID);
        }

        setLandData({ ...blockchainData, ...offChainData });
      } else {
        if (!uniqueId.trim()) {
          setError("Please enter Unique Property ID.");
          setLoading(false);
          return;
        }

        const blockchainData = await queryHyperledger(uniqueId, "unique");
        let offChainData = {};

        if (blockchainData.ipfsCID) {
          offChainData = await fetchFromIPFS(blockchainData.ipfsCID);
        }

        setLandData({ ...blockchainData, ...offChainData });
      }
    } catch (err) {
      setError(err.message || "Error occurred");
    }

    setLoading(false);
  };

  const handleReset = () => {
    setLandData(null);
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
    <div className="min-h-screen bg-gray-100 flex justify-center items-start py-10">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl p-10">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-green-800">
            Land Registry System
          </h1>
          <p className="text-gray-500 mt-2">
            Powered by Hyperledger Fabric + IPFS
          </p>
        </div>

        {/* Search Type */}
        <div className="flex justify-center gap-12 mb-10">
          <label className="flex items-center gap-3 text-lg cursor-pointer">
            <input
              type="radio"
              checked={searchType === "survey"}
              onChange={() => setSearchType("survey")}
              className="h-5 w-5 accent-green-700"
            />
            Survey No. / Sub Division No.
          </label>

          <label className="flex items-center gap-3 text-lg cursor-pointer">
            <input
              type="radio"
              checked={searchType === "unique"}
              onChange={() => setSearchType("unique")}
              className="h-5 w-5 accent-green-700"
            />
            Unique Property ID
          </label>
        </div>

        {/* Survey Search */}
        {searchType === "survey" && (
          <>
            <div className="grid grid-cols-3 gap-6 mb-6">
              {/* District */}
              <div>
                <label className="font-semibold text-gray-700">
                  District *
                </label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full mt-2 p-3 border rounded-xl bg-gray-50"
                >
                  <option value="">Please Select</option>
                  <option value="Medchal">Medchal</option>
                  <option value="Rangareddy">Rangareddy</option>
                  <option value="Hyderabad">Hyderabad</option>
                </select>
              </div>

              {/* Mandal */}
              <div>
                <label className="font-semibold text-gray-700">
                  Mandal *
                </label>
                <select
                  value={mandal}
                  onChange={(e) => setMandal(e.target.value)}
                  className="w-full mt-2 p-3 border rounded-xl bg-gray-50"
                >
                  <option value="">Please Select</option>
                  <option value="Ghatkesar">Ghatkesar</option>
                  <option value="Shamirpet">Shamirpet</option>
                  <option value="Serilingampally">Serilingampally</option>
                </select>
              </div>

              {/* Village */}
              <div>
                <label className="font-semibold text-gray-700">
                  Village *
                </label>
                <select
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="w-full mt-2 p-3 border rounded-xl bg-gray-50"
                >
                  <option value="">Please Select</option>
                  <option value="Edulabad">Edulabad</option>
                  <option value="Turkapally">Turkapally</option>
                  <option value="Madhapur">Madhapur</option>
                </select>
              </div>
            </div>

            {/* Survey No */}
            <div className="mb-8">
              <label className="font-semibold text-gray-700">
                Survey Number *
              </label>
              <input
                value={surveyNo}
                onChange={(e) => setSurveyNo(e.target.value)}
                placeholder="Ex: 123/A"
                className="w-1/2 mt-2 p-3 border rounded-xl bg-gray-50"
              />
            </div>
          </>
        )}

        {/* Unique ID Search */}
        {searchType === "unique" && (
          <div className="mb-8">
            <label className="font-semibold text-gray-700">
              Unique Property ID *
            </label>
            <input
              value={uniqueId}
              onChange={(e) => setUniqueId(e.target.value)}
              placeholder="Ex: PROP-987654"
              className="w-1/2 mt-2 p-3 border rounded-xl bg-gray-50 uppercase"
            />
          </div>
        )}

        {/* CAPTCHA */}
        <div className="flex items-center gap-4 mb-10">
          <div className="bg-gray-200 h-14 w-32 rounded-xl flex justify-center items-center text-xl font-bold tracking-wider">
            {captcha}
          </div>

          <button
            onClick={refreshCaptcha}
            className="p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
          >
            ⟳
          </button>

          <input
            value={captchaInput}
            onChange={(e) => setCaptchaInput(e.target.value)}
            placeholder="ENTER CAPTCHA"
            className="flex-1 p-3 border rounded-xl bg-gray-50"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-6">
          <button
            onClick={handleFetch}
            disabled={loading}
            className="px-8 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? "Fetching..." : "Fetch from Blockchain"}
          </button>

          <button
            onClick={handleReset}
            className="px-8 py-3 rounded-xl bg-gray-500 text-white font-semibold hover:bg-gray-600"
          >
            Reset
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mt-8 p-4 rounded-xl bg-red-100 text-red-700 border border-red-300">
            ⚠️ {error}
          </div>
        )}

        {/* RESULTS */}
        {landData && (
          <div className="mt-10 p-6 bg-gray-50 rounded-xl border">
            <h2 className="text-xl font-semibold text-green-700 mb-4">
              Land Details
            </h2>

            <pre className="text-gray-700">
              {JSON.stringify(landData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
