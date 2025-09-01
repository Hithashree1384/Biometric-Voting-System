import React, { useState, useRef } from 'react';
import axios from 'axios';
import * as faceapi from 'face-api.js';
import './Enrollment.css';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
const MODEL_URL = process.env.PUBLIC_URL + '/models';

const Enrollment = () => {
  const [message, setMessage] = useState("");
  const videoRef = useRef(null);

  const ESP32_IP = "http://192.168.170.23";   // ESP32 fingerprint scanner
  const BACKEND_URL = "http://localhost:3000"; // Node.js backend

  // ------------------ Fingerprint Enrollment ------------------
  const handleEnroll = async () => {
    const id = prompt("Enter your Voter ID to enroll:");
    if (!id) return;
    const name = prompt("Enter your Name:");
    if (!name) return;

    const age = prompt("Enter your Age:");
    if (!age) return;

    const gender = prompt("Enter your Gender (M/F/O):");
    if (!gender) return;

    const address = prompt("Enter your Address:");
    if (!address) return;

    try {
      setMessage("📝 Enrolling fingerprint...");
      await axios.get(
        `${ESP32_IP}/enroll?voter_id=${encodeURIComponent(id)}&name=${encodeURIComponent(
          name
        )}&age=${encodeURIComponent(age)}&gender=${encodeURIComponent(gender)}&address=${encodeURIComponent(address)}`
      );
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
    const name = prompt("Enter your Name:");
    if (!name) return;

    const age = prompt("Enter your Age:");
    if (!age) return;

    const gender = prompt("Enter your Gender (M/F/O):");
    if (!gender) return;

    const address = prompt("Enter your Address:");
    if (!address) return;

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
              name: String(name),
              age: Number(age),
              gender: String(gender),
              address: String(address),
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
      <div className='heading'>
        <h1>Register To DigiVote</h1>
      </div>
      <div className='three-boxes'>
        <div className='enroll-box'>
          <h1 className='enroll-box-heading'>Enroll Fingerprint</h1>
          <FingerprintIcon style={{ fontSize: '100px', color: 'white' }} />
          <button onClick={handleEnroll}>Enroll Fingerprint</button>
          <button onClick={handleReset}>Reset All Data</button>
        </div>

        <div className='enroll-box'>
          <h1 className='enroll-box-heading'>Enroll Face</h1>
          <PersonOutlineIcon style={{ fontSize: '100px', color: 'white' }} />
          <button onClick={handleFaceEnroll}>Enroll Face</button>
          <button onClick={handleFaceReset}>Reset All Data</button>
          <div>
            <video ref={videoRef} autoPlay muted width="300" height="200" />
          </div>
        </div>

        <div className='enroll-box'>
          <h1 className='enroll-box-heading'>Enroll Voice</h1>
          <RecordVoiceOverIcon style={{ fontSize: '100px', color: 'white' }} />
          <button>Voice Recognition</button>
          <button style={{ marginLeft: "10px" }}>Reset All Data</button>
        </div>
      </div>
    </div>
  );
};

export default Enrollment;
