import React, { useEffect, useRef, useState } from "react";
import Meyda from "meyda";
import axios from "axios";

const PASSPHRASE = "secure vote"; // fixed phrase for auth
const SAMPLE_RATE = 16000;
const BACKEND = "http://localhost:3000"; // backend API

const VoiceAuth = () => {
  const [mode, setMode] = useState("idle"); // idle | verifying
  const [message, setMessage] = useState("Ready.");
  const [voterId, setVoterId] = useState("");

  const [recording, setRecording] = useState(false);
  const [matched, setMatched] = useState(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const meydaAnalyzerRef = useRef(null);

  const framesRef = useRef([]); // holds MFCC frames

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
    } catch { }
  }

  async function handleVerify() {
    setMatched(null);
    setMode("verifying");
    setMessage(`Verification: Say “${PASSPHRASE}”`);
    await initAudio();
    startCapture();

    setTimeout(async () => {
      stopCapture();
      const mfccFrames = framesRef.current.slice();
      if (mfccFrames.length < 5) {
        setMessage("Too little speech detected. Try again.");
        setMode("idle");
        return;
      }
      try {
        const { data } = await axios.post(`${BACKEND}/voice/verify`, {
          passphrase: PASSPHRASE,
          mfccFrames,
        });
        if (data?.verified === true) {
          setMatched({
            voterId: data.voterId,
            name: data.name,
            age: data.age,
            gender: data.gender,
            address: data.address,
            similarity: data.similarity,
          });
          setMessage(`✅ Verified voter: ${data.voterId}`);
        } else {
          setMatched(null);
          setMessage(`❌ No match. ${data?.reason ?? ""}`);
        }
      } catch (e) {
        console.error(e);
        setMessage("Verification failed. Check backend.");
      } finally {
        setMode("idle");
      }
    }, 2000);
  }

const castVote = async (voterId, name) => {
  try {
    const res = await axios.post(`${BACKEND}/vote/voice`, { voterId });
    setMessage(`✅ Vote cast successfully! Voter ID: ${voterId}. Thank you for voting, ${name}!`);
    setMatched(null);
  } catch (err) {
    if (err.response) {
      if (err.response.status === 403) {
        // Already voted
        setMessage(err.response.data.message || "⚠️ You have already voted.");
      } else {
        setMessage("❌ Error: " + (err.response.data?.error || err.message));
      }
    } else {
      setMessage("❌ Network error. Please try again.");
    }
    console.error("❌ Vote error:", err);
  }
};


  return (
    <div style={{ maxWidth: 560, margin: "24px auto", padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
      <h2>Voice Authentication</h2>
      

      <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
      

        <button
          onClick={handleVerify}
          disabled={mode !== "idle" || recording}
          style={{ padding: 10, borderRadius: 8 }}
        >
          {recording && mode === "verifying" ? "Listening..." : "Verify & Match"}
        </button>

        <div style={{ marginTop: 8, fontFamily: "monospace" }}>{message}</div>

        {matched && (
          <div style={{ marginTop: 16, padding: 56, border: "1px solid #ccc", borderRadius: 12, textAlign: "left",  }}>
            <div>Matched voter ID: <strong>{matched.voterId}</strong></div>
            <div>Name: {matched.name}</div>
            <div>Age: {matched.age}</div>
            <div>Gender: {matched.gender}</div>
            <div>Address: {matched.address}</div>

            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => castVote(matched.voterId, matched.name)}
                style={{ padding: 10, borderRadius: 8 }}
              >
                🗳️ Cast Vote
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceAuth;
