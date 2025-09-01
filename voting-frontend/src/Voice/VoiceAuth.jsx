import React, { useEffect, useRef, useState } from "react";
import Meyda from "meyda";
import axios from "axios";

const PASSPHRASE = "secure vote"; // keep it short & clear for MVP
const SAMPLE_RATE = 16000;        // enforce downstream
const ENROLL_REQUIRED = 3;
const BACKEND = "http://localhost:3000"; // change in prod

const VoiceAuth = () => {
  const [mode, setMode] = useState("idle"); // idle | enrolling | verifying
  const [enrollCount, setEnrollCount] = useState(0);
  const [message, setMessage] = useState("Ready.");
  const [voterId, setVoterId] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");

  const [recording, setRecording] = useState(false);
  const [matched, setMatched] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const meydaAnalyzerRef = useRef(null);

  const framesRef = useRef([]); // each frame = MFCC array

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

    // ScriptProcessor is deprecated but simplest cross-browser;
    // for production, use AudioWorkletNode
    const bufferSize = 1024;
    const processor = ctx.createScriptProcessor(bufferSize, 1, 1);
    processorRef.current = processor;

    source.connect(processor);
    processor.connect(ctx.destination);

    // Meyda
    meydaAnalyzerRef.current = Meyda.createMeydaAnalyzer({
      audioContext: ctx,
      source,
      bufferSize,
      featureExtractors: ["mfcc", "rms", "zcr"],
      callback: (features) => {
        // basic VAD-ish filter: only keep frames with energy
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

  async function handleEnroll() {
    if (!voterId) return setMessage("Enter voter ID first.");
    setMode("enrolling");
    setMessage(`Enrollment ${enrollCount + 1}/${ENROLL_REQUIRED}: Say “${PASSPHRASE}”`);
    await initAudio();
    startCapture();

    // Record ~2 seconds; adjust if needed
    setTimeout(async () => {
      stopCapture();

      const mfccFrames = framesRef.current.slice();
      if (mfccFrames.length < 5) {
        setMessage("Too little speech detected. Try again closer to the mic.");
        setMode("idle");
        return;
      }

      // send to backend; backend will aggregate after 3
      try {
        await axios.post(`${BACKEND}/voice/enroll`, {
          voterId,
          name,
          age,
          gender,
          address,
          passphrase: PASSPHRASE,
          mfccFrames, // Array<number[13]> per frame by default
        });
        const next = enrollCount + 1;
        setEnrollCount(next);
        if (next >= ENROLL_REQUIRED) {
          setMessage("Enrollment complete ✅");
          setMode("idle");
          setEnrollCount(0);
        } else {
          setMessage(`Saved sample ${next}. Click Enroll again for next sample.`);
          setMode("idle");
        }
      } catch (e) {
        console.error(e);
        setMessage("Enroll failed. Check backend.");
        setMode("idle");
      }
    }, 2000);
  }

  async function handleVerify() {
    setMatched(null);
    setTxHash(null);
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
            voterId: data.voterId, name: data.name,
            age: data.age,
            gender: data.gender,
            address: data.address,
            similarity: data.similarity
          });
          setMessage(`✅ Matched voterId: ${data.voterId}`);
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

  const castVote = async (voterId,name) => {
    try {
      const res = await axios.post("http://localhost:3000/vote/voice", {
        voterId: voterId,
      });
      console.log("✅ Vote response:", res.data);
      setMessage(res.data.message);
        setMessage(`✅ Vote cast successfully! Voter ID: ${voterId}. Thank you for voting, ${name}!`);
        setMatched(null);
    } catch (err) {
      console.error("❌ Vote error:", err);
      setMessage("Vote failed: " + err.message);
    }
  };


  return (
    <div style={{ maxWidth: 560, margin: "24px auto", padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
      <h2>Voice Authentication</h2>
      <p style={{ opacity: 0.7, marginTop: -8 }}>Fixed passphrase: “{PASSPHRASE}”</p>

      <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
        <input
          placeholder="Enter Voter ID"
          value={voterId}
          onChange={(e) => setVoterId(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <input
          placeholder="Age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <input
          placeholder="Gender"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <input
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
        />


        <button
          onClick={handleEnroll}
          disabled={mode !== "idle" || recording}
          style={{ padding: 10, borderRadius: 8 }}
        >
          {recording && mode === "enrolling" ? "Listening..." : `Enroll (${enrollCount}/${ENROLL_REQUIRED})`}
        </button>


        <button onClick={handleVerify} disabled={mode !== "idle" || recording} style={{ padding: 10, borderRadius: 8 }}>
          {recording && mode === "verifying" ? "Listening..." : "Verify & Match"}
        </button>

        <div style={{ marginTop: 8, fontFamily: "monospace" }}>{message}</div>

        {matched && !txHash && (
          <div style={{ marginTop: 8 }}>
            <div>Matched voter ID: <strong>{matched.voterId}</strong></div>
            <div>Name: {matched.name}</div>
            <div>Age: {matched.age}</div>
            <div>Gender: {matched.gender}</div>
            <div>Address: {matched.address}</div>

            <div style={{ marginTop: 8 }}>
              <button onClick={() => castVote(matched.voterId,matched.name)} style={{ padding: 10, borderRadius: 8 }}>🗳️ Cast Vote</button>
            </div>
          </div>
        )}

     
      </div>
    </div>
  );
};

export default VoiceAuth;
