// import React from 'react'
// import { useState } from 'react';
// import axios from 'axios';
// import './Enrollment.css'
// const Enrollment = () => {
//     const [message, setMessage] = useState("");
//     const ESP32_IP = "http://192.168.218.23";   // ESP32 fingerprint scanner
//     const BACKEND_URL = "http://localhost:3000"; // Node.js backend + blockchain

//     const handleEnroll = async () => {
//         const id = prompt("Enter your Voter ID to enroll:");
//         if (!id) return;
    
//         try {
//           setMessage("📝 Enrolling fingerprint...");
//           const res = await axios.get(`${ESP32_IP}/enroll?voter_id=${id}`);
//           setMessage("✅ Enrolled successfully with Fingerprint ID");
//         } catch (error) {
//           console.log(error.response?.data || error.message);
//           setMessage("⚠️ Enrollment failed. Maybe duplicate fingerprint?");
//         }
//       };

//       const handleReset = async () => {
//           try {
//             const res = await axios.post(`${ESP32_IP}/reset`);
//             alert(res.data.status); // "All fingerprints and voter data deleted"
//           } catch (err) {
//             alert("Failed to reset ESP32 data");
//           }
//         };
//   return (
//     <div className='enroll-wrapper'>
//         <div className='enroll-box'>
//             <button onClick={handleEnroll} style={{ marginLeft: "10px" }}>Enroll Fingerprint</button>
//             <button onClick={handleReset} style={{ marginLeft: "10px" }}>Reset All Data</button>
//         </div>
//         <div className='enroll-box'>
//             <button>Facial Recognition</button>
//             <button onClick={handleReset} style={{ marginLeft: "10px" }}>Reset All Data</button>
//         </div>
//         <div className='enroll-box'>
//             <button>Voice Recognition</button>
//             <button onClick={handleReset} style={{ marginLeft: "10px" }}>Reset All Data</button>
//         </div>
//     </div>
//   )
// }

// export default Enrollment


import React, { useState, useRef } from 'react';
import axios from 'axios';
import * as faceapi from 'face-api.js';
import './Enrollment.css';
const MODEL_URL = process.env.PUBLIC_URL + '/models';

const Enrollment = () => {
  const [message, setMessage] = useState("");
  const videoRef = useRef(null);

  const ESP32_IP = "http://192.168.218.23";   // ESP32 fingerprint scanner
  const BACKEND_URL = "http://localhost:3000"; // Node.js backend

  // ------------------ Fingerprint Enrollment ------------------
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

  const handleReset = async () => {
    try {
      const res = await axios.post(`${ESP32_IP}/reset`);
      alert(res.data.status); 
    } catch (err) {
      alert("Failed to reset ESP32 data");
    }
  };

  // ------------------ Facial Enrollment ------------------
const handleFaceEnroll = async () => {
  const id = prompt("Enter your Voter ID to enroll for Face:");
  if (!id) return;

  try {
    setMessage("📸 Loading face-api models...");
    await faceapi.nets.tinyFaceDetector.loadFromUri(`${MODEL_URL}/tiny_face_detector`);
    await faceapi.nets.faceLandmark68Net.loadFromUri(`${MODEL_URL}/face_landmark_68`);
    await faceapi.nets.faceRecognitionNet.loadFromUri(`${MODEL_URL}/face_recognition`);

    setMessage("📸 Starting camera...");
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;

    let enrollmentSent = false;

    const checkFace = async () => {
      if (enrollmentSent) return;

      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection && detection.descriptor.length === 128) {
        enrollmentSent = true; // ✅ prevent multiple requests
        videoRef.current.srcObject.getTracks().forEach(track => track.stop()); // stop webcam
        setMessage("😀 Face detected! Sending enrollment...");

        const descriptorArray = Array.from(detection.descriptor).map(Number);

        try {
          const res = await axios.post(`${BACKEND_URL}/enroll-face`, {
            voterId: String(id),
            descriptor: descriptorArray,
          });
          console.log(res.data);
          setMessage("✅ Face enrolled successfully!");
        } catch (err) {
          if (err.response?.data?.message === "Voter already enrolled") {
            setMessage("⚠️ This voter is already enrolled!");
          } else {
            console.error("Enrollment error:", err.response?.data || err.message);
            setMessage("⚠️ Face enrollment failed. Check console.");
          }
        }
      } else {
        requestAnimationFrame(checkFace); // keep checking until a face is detected
      }
    };

    videoRef.current.onloadedmetadata = () => {
      videoRef.current.play();
      setMessage("😀 Look at the camera...");
      requestAnimationFrame(checkFace); // start detection loop
    };
  } catch (err) {
    console.error("Face enrollment failed:", err);
    setMessage("⚠️ Could not start face enrollment. Check console.");
  }
};

const handleFaceReset = async () => {
  try {
    const res = await axios.post(`${BACKEND_URL}/reset-faces`);
    alert(res.data.status); // e.g., "All face data cleared"
  } catch (err) {
    alert("Failed to reset face data");
  }
};


  return (
    <div className='enroll-wrapper'>
      <div className='enroll-box'>
        <button onClick={handleEnroll}>Enroll Fingerprint</button>
        <button onClick={handleReset} style={{ marginLeft: "10px" }}>Reset All Data</button>
      </div>

      <div className='enroll-box'>
        <button onClick={handleFaceEnroll}>Enroll Face</button>
        <button onClick={handleFaceReset} style={{ marginLeft: "10px" }}>Reset All Data</button>
        <div>
          <video ref={videoRef} autoPlay muted width="300" height="200" />
        </div>
      </div>

      <div className='enroll-box'>
        <button>Voice Recognition</button>
        <button  style={{ marginLeft: "10px" }}>Reset All Data</button>
      </div>
    </div>
  );
};

export default Enrollment;
