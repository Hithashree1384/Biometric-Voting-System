# voice_enroll_node.py
import joblib, os, traceback, numpy as np
from resemblyzer import VoiceEncoder, preprocess_wav
from sklearn.svm import SVC

ENCODER = VoiceEncoder()
X_FILE = "X.npy"
Y_FILE = "y.npy"
MODEL_FILE = "spk_clf_resemblyzer.joblib"
DESIRED_DIM = 256
SILENCE_THRESHOLD = 1e-4  # minimum audio energy to consider valid

def enroll_voice(audio_path, voterId):
    result = {}
    try:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Load previous embeddings safely
        X, y = [], []
        if os.path.exists(X_FILE) and os.path.exists(Y_FILE):
            X_loaded = np.load(X_FILE, allow_pickle=True)
            y_loaded = np.load(Y_FILE, allow_pickle=True)
            for e, v in zip(X_loaded, y_loaded):
                e = np.array(e)
                if e.shape[0] == DESIRED_DIM:
                    X.append(e)
                    y.append(v)

        # Preprocess audio
        wav = preprocess_wav(audio_path)
        if wav.size == 0 or np.mean(np.abs(wav)) < SILENCE_THRESHOLD:
            raise ValueError("Audio is empty or too silent. Please record again.")

        # Compute embedding
        emb = ENCODER.embed_utterance(wav)
        if emb.size == 0:
            raise ValueError("Failed to compute embedding. Check audio quality.")

        # Pad or truncate embedding to DESIRED_DIM
        if emb.shape[0] < DESIRED_DIM:
            emb = np.pad(emb, (0, DESIRED_DIM - emb.shape[0]))
        elif emb.shape[0] > DESIRED_DIM:
            emb = emb[:DESIRED_DIM]

        X.append(emb)
        y.append(voterId)

        # Save embeddings
        np.save(X_FILE, np.array(X, dtype=object))
        np.save(Y_FILE, np.array(y, dtype=object))

        # Train classifier only if ≥2 speakers
        if len(set(y)) > 1:
            clf = SVC(probability=True)
            clf.fit(np.vstack(X), y)
            joblib.dump(clf, MODEL_FILE)
            result = {"success": True, "message": "Model trained and saved", "voterId": voterId}
        else:
            joblib.dump((X, y), MODEL_FILE)
            result = {"success": True, "message": "First voice enrolled (waiting for more speakers)", "voterId": voterId}

    except Exception as e:
        traceback.print_exc()
        result = {"success": False, "error": str(e)}

    return result
