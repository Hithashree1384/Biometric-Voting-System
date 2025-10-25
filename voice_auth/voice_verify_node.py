# # voice_verify_node.py
# import joblib, os, traceback, numpy as np
# from resemblyzer import VoiceEncoder, preprocess_wav

# ENCODER = VoiceEncoder()
# MODEL_FILE = "spk_clf_resemblyzer.joblib"
# DESIRED_DIM = 256

# def verify_voice(audio_path):
#     try:
#         if not os.path.exists(audio_path):
#             raise FileNotFoundError(f"Audio file not found: {audio_path}")
#         if not os.path.exists(MODEL_FILE):
#             raise FileNotFoundError(f"{MODEL_FILE} not found")

#         # Load SVC model
#         clf = joblib.load(MODEL_FILE)

#         # Preprocess audio
#         wav = preprocess_wav(audio_path)
#         emb = ENCODER.embed_utterance(wav)

#         # Pad or truncate embedding
#         if emb.shape[0] < DESIRED_DIM:
#             emb = np.pad(emb, (0, DESIRED_DIM - emb.shape[0]))
#         elif emb.shape[0] > DESIRED_DIM:
#             emb = emb[:DESIRED_DIM]

#         emb = emb.reshape(1, -1)

#         # Predict speaker
#         pred = clf.predict(emb)[0]
#         probs = clf.predict_proba(emb)[0]
#         prob_dict = {cls: round(p, 3) for cls, p in zip(clf.classes_, probs)}

#         return {"success": True, "predicted": pred, "probabilities": prob_dict}

#     except Exception as e:
#         traceback.print_exc()
#         return {"success": False, "error": str(e)}


# voice_verify_node_fixed.pyimport joblib, os, tracebackimport joblib, os, traceback, json
import joblib, os, traceback
import numpy as np
from resemblyzer import VoiceEncoder, preprocess_wav

ENCODER = VoiceEncoder()
MODEL_FILE = "spk_clf_resemblyzer.joblib"

def verify_voice(audio_path):
    try:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        if not os.path.exists(MODEL_FILE):
            raise FileNotFoundError(f"{MODEL_FILE} not found")

        # Load trained model
        model = joblib.load(MODEL_FILE)
        print("Classes in model:", model.classes_)

        # Preprocess audio and extract embedding
        wav = preprocess_wav(audio_path)
        emb = ENCODER.embed_utterance(wav).reshape(1, -1)

        # Predict probabilities
        probs = model.predict_proba(emb)[0]
        prob_dict = {cls: round(p, 3) for cls, p in zip(model.classes_, probs)}

        # Get highest probability voter
        best_voter = max(prob_dict, key=prob_dict.get)
        best_prob = prob_dict[best_voter]

        print(f"Best match: {best_voter} (prob={best_prob})")

        return {
            "success": True,
            "match": best_voter,
            "confidence": best_prob,
            "probabilities": prob_dict
        }

    except Exception as e:
        traceback.print_exc()
        return {"success": False, "error": str(e)}

# Example usage
if __name__ == "__main__":
    test_audio_path = "uploads/sample_converted.wav"
    result = verify_voice(test_audio_path)
    print(result)