"""JARVIS OS : la voix du serveur (Piper, gratuite, sur le serveur). Garde la voix en mémoire et répond ligne à ligne :
entrée {"id": ..., "text": ..., "out": chemin.wav}, sortie {"id": ..., "ok": true}. Lancé et gardé par server.mjs."""
import json, sys, wave
from piper import PiperVoice, SynthesisConfig

model, speaker = sys.argv[1], (int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2] != "" else None)
voice = PiperVoice.load(model)
cfg = SynthesisConfig(speaker_id=speaker, length_scale=1.0)
print(json.dumps({"ready": True}), flush=True)
for line in sys.stdin:
    try:
        req = json.loads(line)
        with wave.open(req["out"], "wb") as w:
            voice.synthesize_wav(req["text"], w, syn_config=cfg)
        print(json.dumps({"id": req["id"], "ok": True}), flush=True)
    except Exception as e:  # une phrase ratée ne doit pas arrêter la voix
        print(json.dumps({"id": req.get("id") if isinstance(req, dict) else None, "ok": False, "error": str(e)[:200]}), flush=True)
