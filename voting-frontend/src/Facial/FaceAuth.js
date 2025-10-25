import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import axios from "axios";

const FaceAuth = () => {
  const [message, setMessage] = useState("Loading models...");
  const [voterDetails, setVoterDetails] = useState(null);
  const [step, setStep] = useState(1); // 1 = face scan, 2 = voter details, 3 = party selection, 4 = success
  const [selectedParty, setSelectedParty] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const videoRef = useRef(null);
  const BACKEND_URL = "http://localhost:3000";

  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri("/models/ssd_mobilenetv1");
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models/face_landmark_68");
        await faceapi.nets.faceRecognitionNet.loadFromUri("/models/face_recognition");
        startVideo();
        setMessage("Models loaded. Look at the camera...");
      } catch (err) {
        console.error(err);
        setMessage("❌ Failed to load face models");
      }
    };
    loadModels();
  }, []);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
      videoRef.current.srcObject = stream;
    } catch (err) {
      console.error(err);
      setMessage("❌ Camera not accessible");
    }
  };

  // Step 1: Verify face
  const handleVerify = async () => {
    setMessage("🔍 Scanning face...");
    setSelectedParty(null); // reset selected party on re-verify
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setMessage("⚠️ No face detected. Try again!");
        return;
      }

      const faceDescriptor = Array.from(detection.descriptor);

      const verifyRes = await axios.post(`${BACKEND_URL}/verify-face`, {
        descriptor: faceDescriptor,
      });

      if (verifyRes.data?.voterId) {
        setVoterDetails({
          voterId: verifyRes.data.voterId,
          name: verifyRes.data.name,
          age: verifyRes.data.age,
          gender: verifyRes.data.gender,
          address: verifyRes.data.address,
        });
        setMessage("");
        setStep(2); // Move to voter details display
      } else {
        setMessage("❌ Face not recognized. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setMessage("⚠️ Error during face verification");
      setVoterDetails(null);
    }
  };

  // Step 2: Cast vote
  const handleVote = async () => {
    if (!selectedParty) {
      setMessage("⚠️ Please select a party before casting your vote.");
      return;
    }

    setMessage("🗳️ Casting vote...");
    try {
      const voteRes = await axios.post(`${BACKEND_URL}/vote/face`, {
        voterId: voterDetails.voterId,
        party: selectedParty,
      });

      if (voteRes.data?.tx) {
        setTxHash(voteRes.data.tx);
        setStep(4); // success page
        setMessage("");
      } else if (voteRes.data?.alreadyVoted) {
        setMessage("⚠️ You have already voted!");
      } else {
        setMessage("⚠️ Vote could not be cast. Try again.");
      }
    } catch (err) {
      console.error(err);
      setMessage("⚠️ Error while casting vote");
    }
  };

  return (
    <div className="vote-wrapper">
      <h2>Face Authentication</h2>

      {/* STEP 1: Face Scan */}
      {step === 1 && (
        <>
          <video ref={videoRef} autoPlay muted width="300" height="200" />
          <div style={{ marginTop: "10px" }}>
            <button onClick={handleVerify}>Verify Face</button>
          </div>
        </>
      )}

      {/* STEP 2: Display Voter Details */}
      {step === 2 && voterDetails && (
        <>
          <div style={{  marginTop: 16, padding: 16, border: "1px solid #ccc", borderRadius: 8 ,marginLeft:"550px",width: "400px", }}>
            <p><strong>Voter ID:</strong> {voterDetails.voterId}</p>
            <p><strong>Name:</strong> {voterDetails.name}</p>
            <p><strong>Age:</strong> {voterDetails.age}</p>
            <p><strong>Gender:</strong> {voterDetails.gender}</p>
            <p><strong>Address:</strong> {voterDetails.address}</p>
          </div>
          <button style={{ marginTop: 16 }} onClick={() => setStep(3)}>
            Next
          </button>
        </>
      )}

      {/* STEP 3: Party Selection */}
      {step === 3 && (
        <>
          <div>Select Party:</div>
          <button
            onClick={() => setSelectedParty("A")}
            style={{ background: selectedParty === "A" ? "#4CAF50" : "", margin: 4, padding: 8 }}
          >
            🟢 Party A
          </button>
          <button
            onClick={() => setSelectedParty("B")}
            style={{ background: selectedParty === "B" ? "#4CAF50" : "", margin: 4, padding: 8 }}
          >
            🔵 Party B
          </button>
          <div>
            <button
              onClick={handleVote}
              disabled={!selectedParty}
              style={{ marginTop: 16 }}
            >
              🗳️ Cast Vote
            </button>
          </div>
        </>
      )}

      {/* STEP 4: Success */}
      {step === 4 && (
        <div style={{ marginTop: 16 }}>
          <h3>✅ Vote cast for Party {selectedParty}!</h3>
          <p>Transaction: {txHash}</p>
          <p>Thank you for voting, {voterDetails.name}!</p>
        </div>
      )}

      
{message && (
  <div
    style={{
      marginTop: 16,
      padding: 16,
      border: "1px solid #ccc",
      borderRadius: 8,
      marginLeft: "550px",
      width: "400px",
    }}
  >
    <p>{message}</p>
  </div>
)}
    </div>
  );
};

export default FaceAuth;
