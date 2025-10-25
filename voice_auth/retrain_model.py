import sys, os, glob, joblib
import numpy as np
from resemblyzer import VoiceEncoder, preprocess_wav
from sklearn.svm import SVC

ENCODER = VoiceEncoder()
DESIRED_DIM = 256

data_dir = sys.argv[1]           # e.g., "uploads"
model_file = sys.argv[2]         # e.g., "models/spk_clf_resemblyzer.joblib"

X, y = [], []

for voter_folder in os.listdir(data_dir):
    voter_path = os.path.join(data_dir, voter_folder)
    if not os.path.isdir(voter_path): continue
    for wav_file in glob.glob(os.path.join(voter_path, "*.wav")):
        wav = preprocess_wav(wav_file)
        emb = ENCODER.embed_utterance(wav)
        # Pad/truncate embedding
        if emb.shape[0] < DESIRED_DIM: emb = np.pad(emb, (0, DESIRED_DIM - emb.shape[0]))
        elif emb.shape[0] > DESIRED_DIM: emb = emb[:DESIRED_DIM]
        X.append(emb)
        y.append(voter_folder.replace("voter_", ""))  # use voterId as label

X = np.vstack(X)
y = np.array(y)

if len(set(y)) < 2:
    # Only one speaker, save embeddings for later
    joblib.dump((X, y), model_file)
else:
    clf = SVC(kernel='linear', probability=True)
    clf.fit(X, y)
    joblib.dump(clf, model_file)

print("✅ Model retrained successfully")
