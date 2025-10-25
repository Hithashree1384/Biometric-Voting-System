# main.py
import sys
import json
from voice_enroll_node import enroll_voice
from voice_verify_node import verify_voice

# Expect args: <action> <audio_path> [voterId]
# action: "enroll" or "verify"

def log(msg):
    print(msg, file=sys.stderr) 

if len(sys.argv) < 3:
    print(json.dumps({"success": False, "error": "Usage: python main.py <action> <audio_path> [voterId]"}))
    sys.exit(1)

action = sys.argv[1]
audio_path = sys.argv[2]
voterId = sys.argv[3] if len(sys.argv) > 3 else None

try:
    if action == "enroll":
        if not voterId:
            raise ValueError("Voter ID required for enrollment")
        result = enroll_voice(audio_path, voterId)  # wrap existing function in voice_enroll_node.py
    elif action == "verify":
        result = verify_voice(audio_path)          # wrap existing function in voice_verify_node.py
    else:
        raise ValueError("Unknown action. Must be 'enroll' or 'verify'")
except Exception as e:
    result = {"success": False, "error": str(e)}

print(json.dumps(result))
