"""JARVIS OS : l'écoute du serveur (Whisper par faster-whisper, gratuite, sur le serveur). Garde le modèle en mémoire et répond ligne à ligne :
entrée {"id": ..., "wav": chemin.wav, "prompt": "mots à reconnaître"}, sortie {"id": ..., "ok": true, "text": "..."}. Lancé et gardé par server.mjs."""
import json, os, sys
from faster_whisper import WhisperModel

model_name, root = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else None)
threads = int(os.environ.get("JARVIS_WHISPER_THREADS", "2"))
model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=threads, download_root=root)
print(json.dumps({"ready": True}), flush=True)
for line in sys.stdin:
    req = None
    try:
        req = json.loads(line)
        segs, info = model.transcribe(req["wav"], language="fr", beam_size=1, best_of=1, temperature=0.0,
                                      condition_on_previous_text=False, initial_prompt=req.get("prompt") or None,
                                      without_timestamps=True, vad_filter=False)
        keep = []
        for s in segs:
            # un segment sans parole (bruit, silence) : Whisper y invente des phrases ; on le laisse de côté
            if s.no_speech_prob > 0.6 and s.avg_logprob < -1.0:
                continue
            keep.append(s.text.strip())
        print(json.dumps({"id": req["id"], "ok": True, "text": " ".join(keep).strip()}), flush=True)
    except Exception as e:  # une phrase ratée ne doit pas arrêter l'écoute
        print(json.dumps({"id": req.get("id") if isinstance(req, dict) else None, "ok": False, "error": str(e)[:200]}), flush=True)
