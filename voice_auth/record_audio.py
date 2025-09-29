# record_speaker.py
import os
import sounddevice as sd
import soundfile as sf

def record_audio(filename, duration=5, fs=16000):
    """Record audio and save to filename"""
    print(f"🎙️ Recording {duration}s... Speak now!")
    audio = sd.rec(int(duration * fs), samplerate=fs, channels=1, dtype="float32")
    sd.wait()
    sf.write(filename, audio, fs)
    print(f"✅ Saved {filename}")

def create_speaker_samples(speaker_name, num_samples=3, duration=5):
    """Create folder for speaker and record multiple samples"""
    folder = os.path.join("data", speaker_name)
    os.makedirs(folder, exist_ok=True)

    for i in range(1, num_samples + 1):
        filename = os.path.join(folder, f"sample{i}.wav")
        input(f"\n👉 Press ENTER to record sample {i}/{num_samples} for {speaker_name}...")
        record_audio(filename, duration=duration)

if __name__ == "__main__":
    speaker = input("Enter speaker name: ").strip()
    create_speaker_samples(speaker, num_samples=3, duration=7)  # 3 samples, 7s each
