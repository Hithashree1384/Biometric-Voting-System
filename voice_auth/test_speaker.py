# test_speaker.py
import joblib
import numpy as np
from resemblyzer import VoiceEncoder, preprocess_wav
import sounddevice as sd
import soundfile as sf

# Load trained model
clf = joblib.load("spk_clf_resemblyzer.joblib")
encoder = VoiceEncoder()

def record_test_audio(filename="test.wav", duration=7, fs=16000):
    print(f"🎙️ Recording {duration} seconds... Speak now!")
    audio = sd.rec(int(duration * fs), samplerate=fs, channels=1, dtype="float32")
    sd.wait()
    sf.write(filename, audio, fs)
    print(f"✅ Saved test audio: {filename}")
    return filename

def test_audio(filename="test.wav"):
    wav = preprocess_wav(filename)
    emb = encoder.embed_utterance(wav).reshape(1, -1)

    pred = clf.predict(emb)[0]
    probs = clf.predict_proba(emb)[0]

    prob_dict = {cls: round(p, 3) for cls, p in zip(clf.classes_, probs)}

    print(f"\n🔊 Predicted Speaker: {pred}")
    print(f"📊 Probabilities: {prob_dict}")

if __name__ == "__main__":
    # Step 1: Record automatically
    test_file = record_test_audio()

    # Step 2: Predict speaker
    test_audio(test_file)
