const express = require("express");
const Web3 = require("web3").default;
const cors = require("cors");
require("dotenv").config();
const bodyParser = require("body-parser");

const fs = require("fs");
const path = require("path");
const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json({ limit: "5mb" }));

// At the top of server.js
const enrollBuffer = new Map();  // for voice enrollment
const voiceprints = new Map();


const web3 = new Web3("http://localhost:9545"); // Ganache
const FACES_FILE = path.join(__dirname, "faces.json");
let faces = [];
// Load existing faces
function loadFaces() { 
  try {
    const data = fs.readFileSync(FACES_FILE, "utf-8");
    faces = JSON.parse(data); // reload from file
  } catch (err) {
    faces = [];
  }
}
app.post("/reset-faces", (req, res) => {
  faces = [];
  try {
    fs.writeFileSync(FACES_FILE, JSON.stringify(faces, null, 2));
    res.json({ status: "All face data cleared" });
  } catch (err) {
    res.status(500).json({ status: "Failed to reset face data" });
  }
});


const contractABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "voterId",
        "type": "uint256"
      }
    ],
    "name": "VoteCast",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "admin",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "hasVoted",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "voterId",
        "type": "uint256"
      }
    ],
    "name": "vote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "voterId",
        "type": "uint256"
      }
    ],
    "name": "checkVoted",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
const contractAddress = "0x60f206D56F71214ecACe2af5b83AbE440116454e"; // Deployed contract address

const contract = new web3.eth.Contract(contractABI, contractAddress);
const senderAddress = "0x51BBF04739Af2d3F516323B46E9E32e2b22b56FA"; // First account from Ganache
app.post("/vote", async (req, res) => {
    console.log("🔔 Vote received at backend");
  console.log("Request body:", req.body);
  const  voterId  = req.body.voterId;

  if (!voterId) {
    return res.status(400).json({ error: "voterId is required" });
  }
  try {
    const alreadyVoted = await contract.methods.checkVoted(voterId).call();
    if (alreadyVoted) {
      return res.status(400).json({ error: "This voter has already voted." });
    }

    const receipt = await contract.methods.vote(voterId).send({
      from: senderAddress,
      gas: 200000,
    });

    res.status(200).json({ message: "Vote cast successfully!", tx: receipt.transactionHash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// -------------------- FACE ENROLLMENT --------------------


// Helper: Check if voter already enrolled
function voterExists(voterId) {
  return faces.some(f => String(f.voterId) === String(voterId));
}
// 🟢 Enroll new face
app.post("/enroll-face", (req, res) => {
  loadFaces();
    console.log("Enroll-face request body:", req.body);
    let { voterId, descriptor,name, age, gender, address  } = req.body;

    if (!voterId || !descriptor) 
        return res.status(400).json({ message: "voter_id and descriptor are required" });

    // Normalize voter_id to string
    voterId = String(voterId);

    // Validate descriptor
    if (!Array.isArray(descriptor) || descriptor.length !== 128 || descriptor.some(d => typeof d !== "number")) {
        return res.status(400).json({ message: "descriptor must be an array of 128 numbers" });
    }
    

   if (voterExists(voterId)) {
        console.log("Duplicate voter:", voterId);
        return res.status(400).json({ message: "Voter already enrolled" });
    }

  // Save new face
  faces.push({ voterId, descriptor, name, age, gender, address });
    try {
        fs.writeFileSync(FACES_FILE, JSON.stringify(faces, null, 2));
    } catch (err) {
        console.error("Failed to write faces.json:", err);
        return res.status(500).json({ message: "Failed to save face data" });
    }

    res.status(200).json({ message: "Face enrolled successfully", voterId });
});

// 🟢 Verify face
// app.post("/verify-face", (req, res) => {
//   console.log("Received body for verify-face:", req.body);
//   loadFaces(); // reload from file

//   const { descriptor } = req.body;
//   if (!descriptor) {
//     return res.status(400).json({ message: "descriptor is required" });
//   }

//   let bestMatch = null;
//   let minDistance = 1.0;

//   faces.forEach(face => {
//     const dist = euclideanDistance(descriptor, face.descriptor);
//     if (dist < minDistance) {
//       minDistance = dist;
//       bestMatch = face;
//     }
//   });

//   if (bestMatch && minDistance < 0.6) {
//     res.json({
//       message: "Face verified",
//       voterId: bestMatch.voterId,
//       distance: minDistance,
//     });
//   } else {
//     res.status(401).json({ message: "Face not recognized" });
//   }
// });
app.post("/verify-face", (req, res) => {
  loadFaces();
  console.log("Received body for verify-face:", req.body);

  let { descriptor } = req.body;
  if (!descriptor) return res.status(400).json({ message: "descriptor is required" });

  descriptor = descriptor.map(d => Number(d));

  let bestMatch = null;
  let minDistance = Infinity;

  faces.forEach(face => {
    const dist = euclideanDistance(descriptor, face.descriptor);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = face;
    }
  });

  if (bestMatch && minDistance < 0.55) {  // 🔑 adjust if needed
    return res.json({
      message: "Face verified",
      voterId: bestMatch.voterId,
      name: bestMatch.name,
      age: bestMatch.age,
      gender: bestMatch.gender,
      address: bestMatch.address,
      distance: minDistance,
    });
  }

  res.status(401).json({ message: "Face not recognized" });
});


function euclideanDistance(vecA, vecB) {
  let sum = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    sum += (vecA[i] - vecB[i]) ** 2;
  }
  return Math.sqrt(sum);
}

//Face verify blochain
app.post("/vote/face", async (req, res) => {
  let { voterId } = req.body;
  voterId=Number(voterId);
  if (!voterId) return res.status(400).json({ error: "voterId is required" });
  console.log("🔔 Vote received at backend");
  console.log("Request body:", req.body);
  try {
    const alreadyVoted = await contract.methods.checkVoted(voterId).call();
    console.log(`Voter ${voterId} already voted?`, alreadyVoted);
   if (alreadyVoted) {
      return res.status(200).json({ message: "This voter has already voted.", alreadyVoted: true });
    }

    const receipt = await contract.methods.vote(voterId).send({
      from: senderAddress,
      gas: 200000,
    });
    loadFaces();
    const voter = faces.find(f => String(f.voterId) === String(voterId));
    const voterName = voter ? voter.name : "Voter";

   
    res.json({
      message: `Vote cast successfully! Voter ID: ${voterId}. Thank you for voting, ${voterName}!`,
      tx: receipt.transactionHash
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
//voice
// --- helpers ---


 

// Collapse an utterance (many frames) into an "average frame" for template building
function collapseUtterances(utterances) {
  // flatten utterances: [[frames],[frames],[frames]]
  const allFrames = utterances.flat();
  // average across frames
  return allFrames[0].map((_, col) =>
    allFrames.reduce((sum, row) => sum + row[col], 0) / allFrames.length
  );
}

// --- routes ---


app.post("/voice/enroll", (req, res) => {
  const { voterId,name,age ,gender,address, mfccFrames } = req.body;

  if (!voterId || !mfccFrames?.length) {
    return res.status(400).json({ error: "Missing voterId or mfccFrames" });
  }
   let enrollment;

  // Initialize voter if not exists
  if (!voiceprints.has(voterId)) {
       enrollment = { voterId, name, age, gender, address, utterances: [], template: null };
    voiceprints.set(voterId, enrollment);
  } else {
    // Update extra details even if voter already exists
    enrollment = voiceprints.get(voterId);
    enrollment.name = name;
    enrollment.age = age;
    enrollment.gender = gender;
    enrollment.address = address;
  }


  // Store utterance
  enrollment.utterances.push(mfccFrames);
  console.log(`✅ Stored utterance #${enrollment.utterances.length} for ${voterId}`);

  // If we now have 3 utterances, create final template
  if (enrollment.utterances.length >= 3) {
    const merged = collapseUtterances(enrollment.utterances);

    // Save the stable template
    enrollment.template = merged;

    // Clear raw utterances if you only want to keep final template
    // enrollment.utterances = [];

    console.log(`🎉 Final template created for voter ${voterId}`);
    return res.json({
      enrolled: true,
      voterId,
      name: enrollment.name,
      age: enrollment.age,
      gender:enrollment.gender,
      address:enrollment.address,
      status: "complete",
      message: "Enrollment finished with stable template"
    });
  }

  // Still waiting for more utterances
  return res.json({
    enrolled: true,
    voterId,
     name: enrollment.name,
      age: enrollment.age,
      gender:enrollment.gender,
      address:enrollment.address,
    status: `waiting_for_${3 - enrollment.utterances.length}_more`,
    message: "Please record again"
  });
 });



function cosineSim(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return 0;
  }
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
function dtwDistance(seqA, seqB) {
  const n = seqA.length, m = seqB.length;
  if (n === 0 || m === 0) return Infinity;

  const cost = (a, b) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      s += d * d;
    }
    return Math.sqrt(s);
  };

  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
  dp[0][0] = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const c = cost(seqA[i - 1], seqB[j - 1]);
      dp[i][j] = c + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[n][m] / (n + m); // normalized by length
}

app.post("/voice/verify", (req, res) => {
  const { mfccFrames } = req.body;

  if (!mfccFrames || mfccFrames.length === 0) {
    return res.status(400).json({ error: "no_voice_data" });
  }

  let bestVoterId = null;
  let bestScore = Infinity;
  let matchedEnrollment = null;


  // Compare against all enrolled templates (sequences)
  for (const [id, enrollment] of voiceprints.entries()) {
    if (!enrollment.utterances || enrollment.utterances.length === 0) continue;

    for (const utterance of enrollment.utterances) {
      const dist = dtwDistance(mfccFrames, utterance);
      if (dist < bestScore) {
        bestScore = dist;
        bestVoterId = id;
        matchedEnrollment = enrollment;
      }
    }
  }

  const THRESHOLD = 25; // adjust based on testing

  if (bestScore < THRESHOLD) {
    console.log(`✅ Voice matched with ${bestVoterId} (DTW distance ${bestScore})`);
    return res.json({ verified: true, 
      voterId: bestVoterId, 
     name: matchedEnrollment.name,
    age: matchedEnrollment.age,
    gender: matchedEnrollment.gender,
    address: matchedEnrollment.address,
       similarity: 1 - bestScore / THRESHOLD });
  } else {
    console.log(`❌ No strong match found (best distance ${bestScore})`);
    return res.json({ verified: false, similarity: 0 });
  }
});

app.post("/vote/voice", async (req, res) => {
  let { voterId } = req.body;
  voterId = Number(voterId);

  if (!voterId) {
    return res.status(400).json({ error: "voterId is required" });
  }

  console.log("🎤 Voice vote received");
  console.log("Request body:", req.body);

  try {
    // 🔎 Check if voter has already voted on blockchain
    const alreadyVoted = await contract.methods.checkVoted(voterId).call();
    console.log(`Voter ${voterId} already voted?`, alreadyVoted);

    if (alreadyVoted) {
      return res.status(200).json({
        message: "⚠️ This voter has already voted.",
        alreadyVoted: true,
      });
    }

    // 🗳️ Cast the vote on blockchain
    const receipt = await contract.methods.vote(voterId).send({
      from: senderAddress,
      gas: 200000,
    });

    res.json({
      message: `🗳️ Voice vote cast successfully! Voter ID: ${voterId}.`,
      tx: receipt.transactionHash,
    });
  } catch (err) {
    console.error("❌ Voice vote error:", err);
    res.status(500).json({ error: err.message });
  }
});


app.get("/", (req, res) => {
  res.send("🚀 Biometric Voting Backend is up and running!"+faces[0]);
});

app.listen(3000, () => {
  
  console.log("🔌 Server running at http://localhost:3000");
});