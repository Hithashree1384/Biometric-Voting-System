import React, { useState } from "react";
import axios from "axios";
import "./Fingerprint.css";   // ✅ import the CSS file

const Fingerprint = () => {
  const [step, setStep] = useState(1);
  const [voterId, setVoterId] = useState("");
  const [voterDetails, setVoterDetails] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedParty, setSelectedParty] = useState(null); // 👈 NEW

  const ESP32_IP = "http://192.168.170.23";   // ESP32 fingerprint scanner
  const BACKEND_URL = "http://localhost:3000"; // Node.js backend + blockchain

  // Step 1 - Match fingerprint
  const handleMatchFingerprint = async () => {
    setLoading(true);
    setMessage("🔍 Scanning fingerprint...");
    try {
      const res = await axios.get(`${ESP32_IP}/match`);
      const data = res.data;

      if (data && data.voterId) {
        setVoterId(data.voterId);
        setVoterDetails(data);
        setStep(2);
        setMessage("");
      } else {
        setMessage("❌ Fingerprint not recognized.");
      }
    } catch (error) {
      console.log(error.response?.data || error.message);
      setMessage("⚠️ Error connecting to fingerprint scanner.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 - After user confirms voter details, show party selection
  const handleConfirmDetails = () => {
    setStep(5); // step for party selection
  };

  // Step 3 - Cast vote via blockchain with selected party
  const handleConfirmVote = async () => {
    if (!selectedParty) {
      setMessage("⚠️ Please select a party before casting your vote.");
      return;
    }

    try {
      setMessage("🗳 Casting vote via blockchain...");
      const res = await axios.post(`${BACKEND_URL}/vote`, {
        voterId,
        party: selectedParty, // 👈 pass party to backend
      });

      setMessage(`✅ Vote successfully cast for Party ${selectedParty}! TX: ${res.data.tx}`);
      setStep(3);
    } catch (error) {
      console.log(error.response?.data || error.message);
      if (error.response?.data?.error) {
        setMessage(`⚠️ ${error.response.data.error}`);
      } else {
        setMessage("⚠️ Error casting vote via blockchain.");
      }
    }
  };

  return (
    <div className="fp-container">
      {/* STEP 1: Fingerprint scan */}
      {step === 1 && (
        <div className="fp-step">
          <h1>Place your finger on the scanner</h1>
          <button className="btn" onClick={handleMatchFingerprint} disabled={loading}>
            {loading ? "Scanning..." : "Scan Fingerprint"}
          </button>
        </div>
      )}

      {/* STEP 2: Show voter details */}
      {step === 2 && voterDetails && (
        <div className="fp-step">
          <h1>Voter ID Found: {voterId}</h1>
          <div style={{ marginTop: 16, padding: 56, marginLeft: 500, marginRight: 500, border: "1px solid #ccc", borderRadius: 12, textAlign: "left" }}>
            <p><strong>Name:</strong> {voterDetails.name}</p>
            <p><strong>Age:</strong> {voterDetails.age}</p>
            <p><strong>Gender:</strong> {voterDetails.gender}</p>
            <p><strong>Address:</strong> {voterDetails.address}</p>
            <p>Is this your voter ID?</p>
          </div>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={() => setStep(4)}>
              No
            </button>
            <button className="btn btn-primary" onClick={handleConfirmDetails}>
              Yes, Next
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Party selection */}
      {step === 5 && (
        <div className="fp-step">
          <h1>Select Your Party</h1>
          <div className="btn-group">
            <button
              className={`btn ${selectedParty === "A" ? "btn-selected" : ""}`}
              onClick={() => setSelectedParty("A")}
            >
              🟢 Party A
            </button>
            <button
              className={`btn ${selectedParty === "B" ? "btn-selected" : ""}`}
              onClick={() => setSelectedParty("B")}
            >
              🔵 Party B
            </button>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleConfirmVote}
            disabled={!selectedParty}
            style={{ marginTop: 20 }}
          >
            Cast Vote
          </button>
        </div>
      )}

      {/* STEP 3: Success message */}
      {step === 3 && (
        <div className="fp-step">
          <h1 className="success">
            ✅ Your vote has been recorded for Party {selectedParty}.<br />
            Thank you for Voting {voterDetails?.name}!
          </h1>
        </div>
      )}

      {/* STEP 4: ID mismatch */}
      {step === 4 && (
        <div className="fp-step">
          <h1 className="error">❌ Voter ID mismatch. Please contact the officer.</h1>
        </div>
      )}

      {message && <p className="fp-message">{message}</p>}
    </div>
  );
};

export default Fingerprint;
