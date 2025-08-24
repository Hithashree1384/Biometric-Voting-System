import React, { useState } from "react";
import axios from "axios";

const Fingerprint = () => {
  const [step, setStep] = useState(1);
  const [voterId, setVoterId] = useState("");
  const [message, setMessage] = useState("");

  const ESP32_IP = "http://192.168.218.23";   // ESP32 fingerprint scanner
  const BACKEND_URL = "http://localhost:3000"; // Node.js backend + blockchain

  // Step 0 - Enroll fingerprint
  const handleEnroll = async () => {
    const id = prompt("Enter your Voter ID to enroll:");
    if (!id) return;

    try {
      setMessage("📝 Enrolling fingerprint...");
      await axios.get(`${ESP32_IP}/enroll?voter_id=${id}`);
      setMessage("✅ Enrolled successfully with Fingerprint ID");
    } catch (error) {
      console.log(error.response?.data || error.message);
      setMessage("⚠️ Enrollment failed. Maybe duplicate fingerprint?");
    }
  };

  // Step 1 - Match fingerprint
  const handleMatchFingerprint = async () => {
    try {
      setMessage("🔍 Checking fingerprint...");
      const res = await axios.get(`${ESP32_IP}/match`);
      const data = res.data;

      if (data && data.voterId) {
        setVoterId(data.voterId);
        setStep(2);
        setMessage("");
      } else {
        setMessage("❌ Fingerprint not recognized. ");

      }
    } catch (error) {
      console.log(error.response?.data || error.message);
      setMessage("⚠️ Error connecting to fingerprint scanner.");
    }
  };

  // Step 2 - Confirm vote via blockchain
  const handleConfirmVote = async () => {
    try {
      setMessage("🗳 Casting vote via blockchain...");
      const res = await axios.post(`${BACKEND_URL}/vote`, { voterId });

      setMessage(`✅ Vote successfully cast! TX: ${res.data.tx}`);
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

  // Reset ESP32 data
  const handleReset = async () => {
    try {
      const res = await axios.post(`${ESP32_IP}/reset`);
      alert(res.data.status); 
    } catch (err) {
      alert("Failed to reset ESP32 data");
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "30px" }}>
      {step === 1 && (
        <>
          <h1>Place your finger on the scanner</h1>
          <button onClick={handleMatchFingerprint}>Scan Fingerprint</button>
          <button onClick={handleEnroll} style={{ marginLeft: "10px" }}>Enroll Fingerprint</button>
          <button onClick={handleReset} style={{ marginLeft: "10px" }}>Reset All Data</button>
        </>
      )}

      {step === 2 && (
        <>
          <h1>Voter ID Found: {voterId}</h1>
          <p>Is this your voter ID?</p>
          <button onClick={() => setStep(4)}>No</button>
          <button onClick={handleConfirmVote}>Yes, Next</button>
        </>
      )}

      {step === 3 && <h1>✅ Your vote has been recorded.</h1>}

      {step === 4 && (
        <h1>❌ Voter ID mismatch. Please contact the officer.</h1>
      )}

      {message && <p>{message}</p>}
    </div>
  );
};

export default Fingerprint;
