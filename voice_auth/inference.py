# inference.py
import sys, json, joblib, numpy as np, os
from resemblyzer import VoiceEncoder, preprocess_wav
import warnings
warnings.filterwarnings("ignore")

def log(msg):
    print(msg, file=sys.stderr)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "spk_clf_resemblyzer.joblib")

# --- ADD THESE LOGS ---
log(f"📁 Looking for model at: {MODEL_PATH}")
if not os.path.exists(MODEL_PATH):
    log("❌ Model file not found! Please enroll at least 2 users first.")
    print(json.dumps({"error": "Model file not found"}))
    sys.exit(1)

log("🔊 Loading voice encoder model and classifier...")
clf = joblib.load(MODEL_PATH)
log(f"✅ Model loaded successfully. Classes: {clf.classes_.tolist()}")
encoder = VoiceEncoder()
