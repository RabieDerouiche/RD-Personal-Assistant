"""JARVIS OS : l'écoute du serveur (Whisper par faster-whisper, gratuite, sur le serveur). Garde le modèle en mémoire et répond ligne à ligne :
entrée {"id": ..., "wav": chemin.wav, "prompt": "mots à reconnaître"}, sortie {"id": ..., "ok": true, "text": "..."}. Lancé et gardé par server.mjs.
Le WAV est lu ici (module wave + numpy), sans PyAV : faster-whisper 1.2 appelle PyAV avec une option que PyAV 19 n'a plus (essai du 18/11/2026)."""
import json, os, sys, wave
import numpy as np
from faster_whisper import WhisperModel

model_name, root = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else None)
threads = int(os.environ.get("JARVIS_WHISPER_THREADS", "2"))
beam = max(1, int(os.environ.get("JARVIS_WHISPER_BEAM", "5")))
model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=threads, download_root=root)


def load(path):
    """WAV PCM 16 bits (mono ou stéréo, toute fréquence) → float32 mono à 16 kHz"""
    with wave.open(path, "rb") as w:
        ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(n)
    if sw != 2:
        raise ValueError("WAV 16 bits attendu")
    x = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    if sr != 16000 and len(x):
        t = np.arange(0, len(x) / sr, 1 / 16000)
        x = np.interp(t, np.arange(len(x)) / sr, x).astype(np.float32)
    return x


print(json.dumps({"ready": True}), flush=True)
for line in sys.stdin:
    req = None
    try:
        req = json.loads(line)
        # 0.25.0 : la phrase dictée est relue avant l'envoi, la justesse passe avant la vitesse : recherche en faisceau (5) au lieu du premier choix
        segs, info = model.transcribe(load(req["wav"]), language="fr", beam_size=beam, best_of=1, temperature=0.0,
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
