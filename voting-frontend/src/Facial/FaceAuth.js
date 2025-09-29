import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import axios from "axios";

const FaceAuth = () => {
  const [message, setMessage] = useState("Loading models...");
  const [voterId, setVoterId] = useState(null); 
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
        console.error("Model loading error:", err);
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
      console.error("Camera error:", err);
      setMessage("❌ Camera not accessible");
    }
  };

  // Step 1: Verify face
  const handleVerify = async () => {
    setMessage("🔍 Scanning face...");
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
        setVoterId({
          voterId: verifyRes.data.voterId,
          name: verifyRes.data.name,
          age: verifyRes.data.age,
          gender: verifyRes.data.gender,
          address: verifyRes.data.address,
        });
        setMessage(`✅ Face recognized! Voter ID: ${verifyRes.data.voterId}`);
      } else {
        setMessage("❌ Face not recognized. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setMessage("⚠️ Error during face verification");
      setVoterId(null);
    }
  };

  // Step 2: Cast vote
  const handleVote = async () => {
    if (!voterId?.voterId) {
      setMessage("❌ Please verify your face first!");
      return;
    }

    setMessage("🗳️ Casting vote...");
    try {
      const voteRes = await axios.post(`${BACKEND_URL}/vote/face`, {voterId: voterId.voterId,});

      if (voteRes.data?.tx) {
        setTxHash(voteRes.data.tx);
        setMessage(`✅ Vote cast successfully! TX: ${voteRes.data.tx} Thank you for voting, ${voterId.name}!`);
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
      <video ref={videoRef} autoPlay muted width="300" height="200" />
      <div style={{ marginTop: "10px" }}>
        <button onClick={handleVerify} style={{ marginRight: "10px" }}>
          Verify Face
        </button>
        <button onClick={handleVote} disabled={!voterId}>
          Cast Vote
        </button>
      </div>
      <div style={{ marginTop: 16,marginLeft:500,marginRight:400, padding: 56, border: "1px solid #ccc", borderRadius: 12, textAlign: "left",  }}>
      <p>{message}</p>
          {voterId && !txHash && (
        <div style={{ marginTop: "10px" }}>
          <p>Voter ID: {voterId.voterId}</p>
          <p> Name: {voterId.name}</p>
          <p> Age: {voterId.age}</p>
          <p> Gender: {voterId.gender}</p>
          <p> Address: {voterId.address}</p>
        </div>
        
      )}
      </div>
    </div>
  );
};

export default FaceAuth;
