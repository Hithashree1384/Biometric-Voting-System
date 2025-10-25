import React, { useState, useRef } from "react";
import axios from "axios";

const PASSPHRASE = "Your name";
const BACKEND = "http://localhost:3000";
const MIN_BLOB_SIZE = 2000;

const VoiceAuth = () => {
  const [step, setStep] = useState(1); // 1=verify, 2=voter details, 3=party selection, 4=success
  const [message, setMessage] = useState("Passphrase: Your name");
  const [recording, setRecording] = useState(false);
  const [matched, setMatched] = useState(null);
  const [selectedParty, setSelectedParty] = useState(null);
  const [txHash, setTxHash] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleVerify = async () => {
    setMessage(`🎙️ Verification: Say "${PASSPHRASE}"`);
    setRecording(true);
    setMatched(null);
    setSelectedParty(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current);
        if (blob.size < MIN_BLOB_SIZE) {
          setMessage("❌ Audio too short. Please speak louder or longer.");
          setRecording(false);
          return;
        }

        const formData = new FormData();
        formData.append("audio", blob, "sample.webm");

        try {
          const { data } = await axios.post(`${BACKEND}/verify-voice`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });

          if (data?.success) {
            setMatched({
              voterId: data.match,
              name: data.voterDetails?.name ?? "Unknown",
              age: data.voterDetails?.age ?? "Unknown",
              gender: data.voterDetails?.gender ?? "Unknown",
              address: data.voterDetails?.address ?? "Unknown",
            });
            setMessage(`✅ Verified speaker: ${data.match}`);
            setStep(2); // go to voter details
          } else {
            setMatched(null);
            setMessage(`❌ No match. ${data?.message ?? ""}`);
          }
        } catch (err) {
          console.error(err);
          setMessage("❌ Verification failed. Check backend.");
        } finally {
          setRecording(false);
        }
      };

      mediaRecorderRef.current.start();
      setTimeout(() => mediaRecorderRef.current.stop(), 7000);
    } catch (err) {
      console.error(err);
      setMessage("❌ Cannot access microphone.");
      setRecording(false);
    }
  };

  const handleNext = () => {
    setStep(3); // go to party selection
  };

  const castVote = async () => {
    if (!matched?.voterId || !selectedParty) {
      setMessage("⚠️ Please select a party before casting vote.");
      return;
    }

    setMessage("🗳️ Casting vote...");

    try {
      const res = await axios.post(`${BACKEND}/vote/voice`, {
        voterId: matched.voterId,
        party: selectedParty,
      });
      setTxHash(res.data?.tx ?? "N/A");
      setStep(4); // success page
      setMessage("");
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.error || "❌ Error casting vote.");
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "24px auto", padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
      <h2>Voice Authentication</h2>

      {step === 1 && (
        <button onClick={handleVerify} disabled={recording} style={{ padding: 10, borderRadius: 8 }}>
          {recording ? "🎧 Listening..." : "Verify & Match"}
        </button>
      )}

      {/* STEP 2: Display Voter Details */}
      {step === 2 && matched && (
        <div style={{ marginTop: 16, padding: 16, border: "1px solid #ccc", borderRadius: 8 }}>
          <div><strong>Voter ID:</strong> {matched.voterId}</div>
          <div><strong>Name:</strong> {matched.name}</div>
          <div><strong>Age:</strong> {matched.age}</div>
          <div><strong>Gender:</strong> {matched.gender}</div>
          <div><strong>Address:</strong> {matched.address}</div>
          <button style={{ marginTop: 12 }} onClick={handleNext}>Next</button>
        </div>
      )}

      {/* STEP 3: Party Selection */}
      {step === 3 && (
        <div style={{ marginTop: 16, padding: 16, border: "1px solid #ccc", borderRadius: 8 }}>
          <div>Select Party:</div>
          <button
            onClick={() => setSelectedParty("A")}
            style={{ padding: 8, margin: 4, background: selectedParty === "A" ? "#4CAF50" : "" }}
          >
            🟢 Party A
          </button>
          <button
            onClick={() => setSelectedParty("B")}
            style={{ padding: 8, margin: 4, background: selectedParty === "B" ? "#4CAF50" : "" }}
          >
            🔵 Party B
          </button>
          <div>
            <button onClick={castVote} disabled={!selectedParty} style={{ marginTop: 12, padding: 10, borderRadius: 8 }}>
              🗳️ Cast Vote
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Success */}
      {step === 4 && (
        <div style={{ marginTop: 16 }}>
          <h3>✅ Vote cast for Party {selectedParty}!</h3>
          <p>Transaction: {txHash}</p>
          <p>Thank you for voting, {matched?.name}!</p>
        </div>
      )}

      {/* Message Box */}
      {message && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
          <p>{message}</p>
        </div>
      )}
    </div>
  );
};

export default VoiceAuth;
