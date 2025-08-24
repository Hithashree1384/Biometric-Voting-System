const express = require("express");
const Web3 = require("web3").default;
const cors = require("cors");
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const app = express();
app.use(cors());
app.use(express.json());


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
    let { voterId, descriptor } = req.body;

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
  faces.push({ voterId, descriptor });
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

    res.json({ message: "Vote cast via face recognition!", tx: receipt.transactionHash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get("/", (req, res) => {
  res.send("🚀 Biometric Voting Backend is up and running!"+faces[0]);
});

app.listen(3000, () => {
  
  console.log("🔌 Server running at http://localhost:3000");
});