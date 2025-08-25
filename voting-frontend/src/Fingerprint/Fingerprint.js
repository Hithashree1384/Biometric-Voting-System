// import React, { useState } from "react";
// import axios from "axios";

// const Fingerprint = () => {
//   const [step, setStep] = useState(1);
//   const [voterId, setVoterId] = useState("");
//   const [message, setMessage] = useState("");

//   const ESP32_IP = "http://192.168.218.23";   // ESP32 fingerprint scanner
//   const BACKEND_URL = "http://localhost:3000"; // Node.js backend + blockchain

  
//   // Step 1 - Match fingerprint
//   const handleMatchFingerprint = async () => {
//     try {
//       setMessage("🔍 Checking fingerprint...");
//       const res = await axios.get(`${ESP32_IP}/match`);
//       const data = res.data;

//       if (data && data.voterId) {
//         setVoterId(data.voterId);
//         setStep(2);
//         setMessage("");
//       } else {
//         setMessage("❌ Fingerprint not recognized. ");

//       }
//     } catch (error) {
//       console.log(error.response?.data || error.message);
//       setMessage("⚠️ Error connecting to fingerprint scanner.");
//     }
//   };

//   // Step 2 - Confirm vote via blockchain
//   const handleConfirmVote = async () => {
//     try {
//       setMessage("🗳 Casting vote via blockchain...");
//       const res = await axios.post(`${BACKEND_URL}/vote`, { voterId });

//       setMessage(`✅ Vote successfully cast! TX: ${res.data.tx}`);
//       setStep(3);
//     } catch (error) {
//       console.log(error.response?.data || error.message);
//       if (error.response?.data?.error) {
//         setMessage(`⚠️ ${error.response.data.error}`);
//       } else {
//         setMessage("⚠️ Error casting vote via blockchain.");
//       }
//     }
//   };

  

//   return (
//     <div style={{ textAlign: "center", marginTop: "30px" }}>
//       {step === 1 && (
//         <>
//           <h1>Place your finger on the scanner</h1>
//           <button onClick={handleMatchFingerprint}>Scan Fingerprint</button>
//         </>
//       )}

//       {step === 2 && (
//         <>
//           <h1>Voter ID Found: {voterId}</h1>
//           <p>Is this your voter ID?</p>
//           <button onClick={() => setStep(4)}>No</button>
//           <button onClick={handleConfirmVote}>Yes, Next</button>
//         </>
//       )}

//       {step === 3 && <h1>✅ Your vote has been recorded.</h1>}

//       {step === 4 && (
//         <h1>❌ Voter ID mismatch. Please contact the officer.</h1>
//       )}

//       {message && <p>{message}</p>}
//     </div>
//   );
// };

// export default Fingerprint;
import React, { useState } from "react";
import axios from "axios";
import "./Fingerprint.css";   // ✅ import the CSS file

const Fingerprint = () => {
  const [step, setStep] = useState(1);
  const [voterId, setVoterId] = useState("");
  const [message, setMessage] = useState("");

  const ESP32_IP = "http://192.168.218.23";   // ESP32 fingerprint scanner
  const BACKEND_URL = "http://localhost:3000"; // Node.js backend + blockchain

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
        setMessage("❌ Fingerprint not recognized.");
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

  return (
    <div className="fp-container">
      {step === 1 && (
        <div className="fp-step">
          <h1>Place your finger on the scanner</h1>
          <button className="btn" onClick={handleMatchFingerprint}>
            Scan Fingerprint
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="fp-step">
          <h1>Voter ID Found: {voterId}</h1>
          <p>Is this your voter ID?</p>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={() => setStep(4)}>
              No
            </button>
            <button className="btn btn-primary" onClick={handleConfirmVote}>
              Yes, Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="fp-step">
          <h1 className="success">✅ Your vote has been recorded.</h1>
        </div>
      )}

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
