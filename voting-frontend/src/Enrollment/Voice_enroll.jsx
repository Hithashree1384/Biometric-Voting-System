// VoiceEnroll.js
import React, { useRef, useState, useEffect } from "react";
import Meyda from "meyda";
import axios from "axios";

const PASSPHRASE = "secure vote";
const SAMPLE_RATE = 16000;
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

  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const meydaAnalyzerRef = useRef(null);
  const framesRef = useRef([]);

  useEffect(() => {
    return () => stopAudioGraph();
  }, []);

  async function initAudio() {
    if (audioCtxRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const ctx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: SAMPLE_RATE,
    });
    audioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;

    const bufferSize = 1024;
    const processor = ctx.createScriptProcessor(bufferSize, 1, 1);
    processorRef.current = processor;

    source.connect(processor);
    processor.connect(ctx.destination);

    meydaAnalyzerRef.current = Meyda.createMeydaAnalyzer({
      audioContext: ctx,
      source,
      bufferSize,
      featureExtractors: ["mfcc", "rms", "zcr"],
      callback: (features) => {
        if (features && features.rms > 0.01) {
          framesRef.current.push(features.mfcc);
        }
      },
    });
  }

  function startCapture() {
    framesRef.current = [];
    meydaAnalyzerRef.current?.start();
    setRecording(true);
  }

  function stopCapture() {
    meydaAnalyzerRef.current?.stop();
    setRecording(false);
  }

  function stopAudioGraph() {
    try {
      meydaAnalyzerRef.current?.stop();
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      audioCtxRef.current?.close();
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch {}
  }

  async function handleEnroll() {
    if (!voterId) return setMessage("⚠️ Enter voter ID first.");
    setMessage(`🎙️ Enrollment ${enrollCount + 1}/${ENROLL_REQUIRED}: Say “${PASSPHRASE}”`);
    await initAudio();
    startCapture();

    setTimeout(async () => {
      stopCapture();
      const mfccFrames = framesRef.current.slice();
      if (mfccFrames.length < 5) {
        setMessage("⚠️ Too little speech detected. Try again.");
        return;
      }

      try {
        await axios.post(`${BACKEND}/voice/enroll`, {
          voterId,
          name,
          age,
          gender,
          address,
          passphrase: PASSPHRASE,
          mfccFrames,
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
        setMessage("❌ Enroll failed. Check backend.");
      }
    }, 2000);
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
      <div
        style={{
          maxWidth: 500,
          width: "100%",
          background: "#8198e2ff",
          padding: "30px",
          borderRadius: "16px",
          boxShadow: "0 6px 16px rgba(0,0,0,0.1)",
          textAlign: "center",
        }}
      >
        <h2 style={{ marginBottom: "10px", color: "#333" }}>Voice Enrollment</h2>
        <p style={{ opacity: 0.7 }}>Passphrase: <strong>“{PASSPHRASE}”</strong></p>

        {/* Progress */}
        <div style={{ margin: "16px 0" }}>
          <div
            style={{
              height: "10px",
              borderRadius: "8px",
              background: "#eee",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(enrollCount / ENROLL_REQUIRED) * 100}%`,
                background: "#4caf50",
                height: "100%",
              }}
            />
          </div>
          <p style={{ marginTop: 6, fontSize: "14px", color: "#555" }}>
            {enrollCount}/{ENROLL_REQUIRED} samples collected
          </p>
        </div>

        {/* Inputs */}
        <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
          <input
            placeholder="Voter ID"
            value={voterId}
            onChange={(e) => setVoterId(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Enroll Button */}
        <button
          onClick={handleEnroll}
          disabled={recording}
          style={{
            padding: "12px 18px",
            borderRadius: "10px",
            border: "none",
            background: recording ? "#aaa" : "#1976d2",
            color: "#fff",
            fontSize: "16px",
            cursor: recording ? "not-allowed" : "pointer",
            transition: "0.3s",
          }}
        >
          {recording ? "🎤 Listening..." : `Enroll (${enrollCount}/${ENROLL_REQUIRED})`}
        </button>

        {/* Message */}
        <p
          style={{
            marginTop: "16px",
            fontFamily: "monospace",
            color: message.startsWith("✅")
              ? "green"
              : message.startsWith("❌") || message.startsWith("⚠️")
              ? "red"
              : "#333",
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
};

const inputStyle = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  fontSize: "14px",
  outline: "none",
};

export default VoiceEnroll;
