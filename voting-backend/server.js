const express = require("express");
const Web3 = require("web3").default;
const cors = require("cors");
require("dotenv").config();
const bodyParser = require("body-parser");
const axios = require("axios");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const app = express();
app.use(cors());

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

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


// ------------------- CAST VOTE WITH VOICE -------------------

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    // Force .wav extension for consistency
    const name = path.parse(file.originalname).name + ".wav";
    cb(null, name);
  },
});
const upload = multer({ storage });
const convertToWav = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(["-ac 1", "-ar 16000", "-f wav"])
      .save(outputPath)
      .on("end", resolve)
      .on("error", reject);
  });
};



app.post("/voice/enroll", upload.single("audio"), async (req, res) => {
  const { voterId, name, age, gender, address } = req.body;
  if (!voterId || !req.file)
    return res.status(400).json({ error: "Voter ID and audio required" });

  const audioPath = path.resolve(req.file.path);
  const convertedPath = audioPath.replace(
  ".wav",
  `_v${voterId}_${Date.now()}_converted.wav`
);
await convertToWav(audioPath, convertedPath);
  try {

    console.log("🎙️ Enrolling voice for Voter ID:", voterId);
    console.log("Converted file:", convertedPath);

    // --- Call Python script for enrollment ---
    const pythonProcess = spawn("python", [
  path.resolve(__dirname, "../voice_auth/main.py"),
  "enroll",         // or "verify"
  convertedPath,
  voterId            // only needed for enrollment
]);

    let output = "";
    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error("Python error:", data.toString());
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0)
        return res.status(500).json({ error: "Python enrollment failed" });

      try {
        const votersFile = path.resolve(__dirname, "voters.json");
        let voters = {};
        if (fs.existsSync(votersFile)) {
          voters = JSON.parse(fs.readFileSync(votersFile, "utf-8"));
        }
          voters[voterId] = { name, age, gender, address };
        fs.writeFileSync(votersFile, JSON.stringify(voters, null, 2));


        // Parse only JSON part of Python output
        const lines = output.trim().split("\n");
        const jsonOutput = lines[lines.length - 1];
        const result = JSON.parse(jsonOutput);


        
        res.json(result);
      } catch (err) {
        console.error("JSON parse error:", err, "Output:", output);
        res.status(500).json({ error: "Invalid Python output" });
      }
    });
  } catch (err) {
    console.error("Audio conversion error:", err);
    res.status(500).json({ error: "Audio processing failed" });
  }
});

// ------------------- VOICE VERIFICATION -------------------

app.post("/verify-voice", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Audio file required" });

  const audioPath = path.resolve(req.file.path);
  const convertedPath = audioPath.replace(".wav", `_converted_${Date.now()}.wav`);

  try {
    // Convert audio to 16kHz mono WAV
    await convertToWav(audioPath, convertedPath);

    // Log file info for debugging
    const stats = fs.statSync(convertedPath);
    console.log("🎧 Verifying voice:", convertedPath);
    console.log("🗂️ Converted file size:", stats.size, "bytes");
    if (stats.size === 0) {
      return res.status(400).json({ error: "Converted audio is empty!" });
    }

    // Spawn Python process
    const pythonProcess = spawn("python", [
      path.resolve(__dirname, "../voice_auth/main.py"),
      "verify",
      convertedPath
    ]);

    let output = "";
    pythonProcess.stdout.on("data", (data) => (output += data.toString()));
    pythonProcess.stderr.on("data", (data) => console.error("Python error:", data.toString()));

    pythonProcess.on("close", (code) => {
      if (code !== 0) return res.status(500).json({ error: "Python script failed" });

      try {
        const lines = output.trim().split("\n");
        const jsonOutput = lines[lines.length - 1];
        const result = JSON.parse(jsonOutput);


        const votersFile = path.resolve(__dirname, "voters.json");
        let voterDetails = { name: "Unknown", age: "Unknown", gender: "Unknown", address: "Unknown" };
        if (fs.existsSync(votersFile)) {
          const voters = JSON.parse(fs.readFileSync(votersFile, "utf-8"));
          const key = result.match?.toString();
          if (key && voters[key]) {
              voterDetails = voters[key];
          }
          console.log("Resolved voters file:", votersFile);
          console.log("Loaded voters:", voters);
          console.log("Looking for key:", key);

    }

        // Log prediction probabilities for debugging
          if (result.probabilities) {
          console.log("📊 Probabilities:", result.probabilities);
          console.log("Best match:", result.match, "Confidence:", result.confidence);
          console.log("Voter details:", voterDetails);
          }
        

        res.json({ ...result, voterDetails });
      } catch (err) {
        console.error("JSON parse error:", err, "Output:", output);
        res.status(500).json({ error: "Invalid Python output" });
      }
    });
  } catch (err) {
    console.error("Audio conversion error:", err);
    res.status(500).json({ error: "Audio processing failed" });
  }
});

// Voice vote with blockchain
app.post("/vote/voice", async (req, res) => {
  const { voterId } = req.body;

  if (!voterId) {
    return res.status(400).json({ error: "voterId is required" });
  }

  console.log("🔔 Voice vote received at backend for voterId:", voterId);

  try {
    // Check if voter already voted on blockchain
    const alreadyVoted = await contract.methods.checkVoted(voterId).call();
    console.log(`Voter ${voterId} already voted?`, alreadyVoted);

    if (alreadyVoted) {
      return res.status(400).json({ error: "This voter has already voted." });
    }

    // Cast the vote on blockchain
    const receipt = await contract.methods.vote(voterId).send({
      from: senderAddress,
      gas: 200000,
    });

    res.status(200).json({
      message: `Vote cast successfully! Voter ID: ${voterId}. Thank you for voting!`,
      tx: receipt.transactionHash
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
const X_FILE = "X.npy";
const Y_FILE = "y.npy";
const MODEL_FILE = "spk_clf_resemblyzer.joblib";
const VOTERS_FILE = path.join(__dirname, "voters.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

app.post("/reset-voice", async (req, res) => {
  try {
    // Delete embeddings files if exist
    if (fs.existsSync(X_FILE)) fs.unlinkSync(X_FILE);
    if (fs.existsSync(Y_FILE)) fs.unlinkSync(Y_FILE);
    // Delete classifier if exists
    if (fs.existsSync(MODEL_FILE)) fs.unlinkSync(MODEL_FILE);
    if (fs.existsSync(VOTERS_FILE)) fs.writeFileSync(VOTERS_FILE, JSON.stringify({}));
    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(UPLOADS_DIR, file));
      }
    }

    res.json({ status: "✅ All voice data has been reset." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "⚠️ Failed to reset voice data." });
  }
});








app.get("/", (req, res) => {
  res.send("🚀 Biometric Voting Backend is up and running!"+faces[0]);
});

app.listen(3000, () => {
  
  console.log("🔌 Server running at http://localhost:3000");
});