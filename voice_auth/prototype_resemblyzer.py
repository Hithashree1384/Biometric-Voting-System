from resemblyzer import VoiceEncoder, preprocess_wav
import numpy as np
from sklearn.svm import SVC
import os, glob, joblib

encoder = VoiceEncoder()

def load_embeddings(data_dir):
    X, y = [], []
    # Loop through speaker folders
    for speaker in os.listdir(data_dir):
        spath = os.path.join(data_dir, speaker)
        if not os.path.isdir(spath):
            continue
        # Loop through wav files inside the speaker folder
        for wavfile in glob.glob(os.path.join(spath, "*.wav")):
            wav = preprocess_wav(wavfile)  # preprocess (resample, normalize, etc.)
            emb = encoder.embed_utterance(wav)  # extract embedding
            X.append(emb)
            y.append(speaker)  # label is folder name
    return np.vstack(X), np.array(y)

if __name__ == "__main__":
    X, y = load_embeddings("voting-backend/uploads")

    if len(set(y)) < 2:
        raise ValueError("❌ Need at least 2 different speakers to train the model!")

    clf = SVC(kernel='linear', probability=True)
    clf.fit(X, y)
    joblib.dump(clf, "spk_clf_resemblyzer.joblib")
    print("✅ Model trained and saved as spk_clf_resemblyzer.joblib")
