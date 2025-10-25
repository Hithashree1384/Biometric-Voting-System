import React, { useRef, useState, useEffect } from "react";
import axios from "axios";
import Recorder from "recorder-js";

const PASSPHRASE = "Your name";
const ENROLL_REQUIRED = 3;
const BACKEND = "http://localhost:3000";

const VoiceEnroll = () => {
  const [enrollCount, setEnrollCount] = useState(0);
  const [message, setMessage] = useState("Ready to enroll.");
  const [voterId, setVoterId] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [recording, setRecording] = useState(false);

  const recorderRef = useRef(null);
  const audioContextRef = useRef(null);

  // Initialize AudioContext on mount
useEffect(() => {
  const init = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      recorderRef.current = new Recorder(audioContextRef.current);
      await recorderRef.current.init(stream);
      console.log("Recorder initialized ✅");
    } catch (err) {
      console.error("Microphone init failed:", err);
    }
  };
  init();
  return () => audioContextRef.current?.close();
}, []);

  // Initialize Recorder
  const initRecorder = async () => {
    if (recorderRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorderRef.current = new Recorder(audioContextRef.current);
    await recorderRef.current.init(stream);
  };
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  // Handle voice enrollment
//   const handleEnroll = async () => {
//     if (!voterId.trim()) return setMessage("⚠️ Enter voter ID first.");
//     setMessage(`🎙️ Enrollment ${enrollCount + 1}/${ENROLL_REQUIRED}: Say “${PASSPHRASE}”`);
//     await initRecorder();
//     setRecording(true);
//     try {

//       await recorderRef.current.start();

//       const { blob } = await recorderRef.current.stop();
//       setRecording(false);

//       if (blob.size === 0) {
//         setMessage("❌ Recording failed: no audio captured.");
//         return;
//       }

//       // Prepare FormData
//       const formData = new FormData();
//       formData.append("voterId", voterId);
//       formData.append("name", name);
//       formData.append("age", age);
//       formData.append("gender", gender);
//       formData.append("address", address);
//       formData.append("passphrase", PASSPHRASE);
//       formData.append("audio", blob, `sample_${enrollCount + 1}.wav`);

//       try {
//         await axios.post(`${BACKEND}/voice/enroll`, formData, {
//           headers: { "Content-Type": "multipart/form-data" },
//         });

//         const next = enrollCount + 1;
//         setEnrollCount(next);

//         if (next >= ENROLL_REQUIRED) {
//           setMessage("✅ Enrollment complete!");
//           setEnrollCount(0);
//         } else {
//           setMessage(`✅ Sample ${next} saved. Click again for next sample.`);
//         }
//       } catch (err) {
//         console.error(err);
//         setMessage("❌ Enrollment failed. Check backend.");
//       }
//     }, 3000);
//   } catch (err) {
//     console.error(err);
//     setRecording(false);
//     setMessage("❌ Cannot access microphone or start recording.");
//   }
// };



const handleEnroll = async () => {
  if (!voterId.trim()) return setMessage("⚠️ Enter voter ID first.");
  setMessage(`🎙️ Enrollment ${enrollCount + 1}/${ENROLL_REQUIRED}: Say “${PASSPHRASE}”`);

  await initRecorder();
  setRecording(true);

  try {
    await recorderRef.current.start();

    // Wait 3 seconds while recording
    await new Promise((res) => setTimeout(res, 3000));

    // Stop recording
    const { blob } = await recorderRef.current.stop();
    setRecording(false);

    if (blob.size === 0) {
      setMessage("❌ Recording failed: no audio captured.");
      return;
    }

    // Send audio to backend
    const formData = new FormData();
    formData.append("voterId", voterId);
    formData.append("name", name);
    formData.append("age", age);
    formData.append("gender", gender);
    formData.append("address", address);
    formData.append("passphrase", PASSPHRASE);
    formData.append("audio", blob, `sample_${enrollCount + 1}.wav`);

    await axios.post(`${BACKEND}/voice/enroll`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const next = enrollCount + 1;
    setEnrollCount(next);

    if (next >= ENROLL_REQUIRED) {
      setMessage("✅ Enrollment complete!");
      setEnrollCount(0);
    } else {
      setMessage(`✅ Sample ${next} saved. Click again for next sample.`);
    }

  } catch (err) {
    console.error(err);
    setRecording(false);
    setMessage("❌ Cannot access microphone or start recording.");
  }
};




return (
  <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
    <div style={{ maxWidth: 500, width: "100%", padding: "30px", borderRadius: "16px", background: "#8198e2ff", textAlign: "center" }}>
      <h2>Voice Enrollment</h2>
      <p>Passphrase: <strong>“{PASSPHRASE}”</strong></p>

      <input placeholder="Voter ID" value={voterId} onChange={e => setVoterId(e.target.value)} style={inputStyle} />
      <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
      <input placeholder="Age" value={age} onChange={e => setAge(e.target.value)} style={inputStyle} />
      <input placeholder="Gender" value={gender} onChange={e => setGender(e.target.value)} style={inputStyle} />
      <input placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} />

      <button onClick={handleEnroll} disabled={recording} style={{ padding: "12px 18px", borderRadius: "10px", marginTop: 16 }}>
        {recording ? "🎤 Listening..." : `Enroll (${enrollCount}/${ENROLL_REQUIRED})`}
      </button>

      <p style={{ marginTop: 16, color: message.startsWith("✅") ? "green" : "red" }}>{message}</p>
    </div>
  </div>
);
};

const inputStyle = { padding: 10, marginBottom: 8, width: "100%", borderRadius: 8, border: "1px solid #ccc" };

export default VoiceEnroll;
