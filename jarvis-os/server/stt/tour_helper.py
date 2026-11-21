"""JARVIS OS 0.36.0 : la fin de phrase reconnue à la voix (Smart Turn v3.2 de Pipecat, licence BSD-2, 23 langues dont le français).
Choix du propriétaire (QCM du 21/11/2026, « Voix plus vive », après le rapport « Ce qui manque à JARVIS OS ») : au lieu de couper
après 0,7 s de silence, l'iPhone demande dès 0,25 s de pause si la phrase est finie ; ce petit modèle (8,7 Mo) répond d'après
l'intonation et le rythme des 8 dernières secondes (« et puis… » : pas fini ; « quelle est la météo ? » : fini).
Banc de Pipecat (smart-turn-v3.2-cpu) : 94,1 % de bonnes réponses en français (1 252 phrases).
Même protocole que whisper_helper.py : entrée {"id", "wav"} une par ligne, sortie {"id", "ok", "p", "ms"} (p : probabilité que ce soit fini).
Les traits sont ceux de Whisper (WhisperFeatureExtractor, chunk_length=8), recalculés ici avec numpy seul (pas de transformers :
moins de mémoire) ; écart mesuré contre transformers 5.23 : docs/jarvis-os.md (0.36.0)."""
import json, os, sys, time, wave
import numpy as np
import onnxruntime as ort

SR, N_FFT, HOP, N_MELS, SECONDS = 16000, 400, 160, 80, 8
N_SAMPLES = SR * SECONDS


def _mel_filters():
    """banc de filtres mel « slaney » (80 bandes, 0 à 8 000 Hz), comme transformers.audio_utils.mel_filter_bank (norm et échelle slaney)"""
    def hz_to_mel(f):
        f = np.asarray(f, dtype=np.float64)
        mel = 3.0 * f / 200.0
        log = f >= 1000.0
        return np.where(log, 15.0 + np.log(np.maximum(f, 1e-10) / 1000.0) * (27.0 / np.log(6.4)), mel)

    def mel_to_hz(m):
        m = np.asarray(m, dtype=np.float64)
        f = 200.0 * m / 3.0
        log = m >= 15.0
        return np.where(log, 1000.0 * np.exp(np.log(6.4) / 27.0 * (m - 15.0)), f)

    fft_freqs = np.linspace(0, SR // 2, 1 + N_FFT // 2)
    mels = np.linspace(hz_to_mel(0.0), hz_to_mel(8000.0), N_MELS + 2)
    filt = mel_to_hz(mels)
    fdiff = np.diff(filt)
    slopes = np.expand_dims(filt, 0) - np.expand_dims(fft_freqs, 1)
    down = -slopes[:, :-2] / fdiff[:-1]
    up = slopes[:, 2:] / fdiff[1:]
    fb = np.maximum(np.zeros(1), np.minimum(down, up))
    enorm = 2.0 / (filt[2:N_MELS + 2] - filt[:N_MELS])
    return fb * np.expand_dims(enorm, 0)   # (201, 80)


MEL = _mel_filters()
WIN = np.hanning(N_FFT + 1)[:-1]   # Hann périodique (float64), comme transformers.audio_utils.window_function


def features(x):
    """8 dernières secondes (zéros devant si plus court), normalisées, puis log-mel de Whisper : (1, 80, 800) en float32.
    Mêmes types que transformers à chaque étape (le modèle int8 réagit à des écarts de 1e-5 : la moindre différence d'arrondi
    change sa réponse près de 0,5) : normalisation en float32, transformée en float64 rangée en complex64, log10 en float64."""
    x = np.asarray(x, dtype=np.float32)
    x = x[-N_SAMPLES:] if len(x) > N_SAMPLES else np.pad(x, (N_SAMPLES - len(x), 0))
    x = (x - x.mean()) / np.sqrt(x.var() + 1e-7)
    p = np.pad(x, (N_FFT // 2, N_FFT // 2), mode="reflect").astype(np.float64)
    n = 1 + (len(p) - N_FFT) // HOP
    idx = np.arange(N_FFT)[None, :] + HOP * np.arange(n)[:, None]
    spec = np.fft.rfft(p[idx] * WIN, n=N_FFT).astype(np.complex64)   # (801, 201)
    spec = np.abs(spec, dtype=np.float64) ** 2
    mel = np.maximum(1e-10, np.dot(MEL.T, spec.T))   # (80, 801)
    log = np.log10(mel).astype(np.float32)[:, :-1]   # (80, 800)
    log = np.maximum(log, log.max() - 8.0)
    return ((log + 4.0) / 4.0)[None, :, :]


def load(path):
    """WAV PCM 16 bits (mono ou stéréo, toute fréquence) → float32 mono à 16 kHz (comme parakeet_helper.py)"""
    with wave.open(path, "rb") as w:
        ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(n)
    if sw != 2:
        raise ValueError("WAV 16 bits attendu")
    x = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    if sr != SR and len(x):
        t = np.arange(0, len(x) / sr, 1 / SR)
        x = np.interp(t, np.arange(len(x)) / sr, x).astype(np.float32)
    return x


def session(model):
    so = ort.SessionOptions()
    so.intra_op_num_threads = int(os.environ.get("JARVIS_TOUR_THREADS", "1"))   # un seul cœur : l'écoute et Claude gardent l'autre
    so.inter_op_num_threads = 1
    so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    return ort.InferenceSession(model, sess_options=so, providers=["CPUExecutionProvider"])


def proba(sess, x):
    return float(sess.run(None, {"input_features": features(x)})[0].reshape(-1)[0])


if __name__ == "__main__":
    S = session(sys.argv[1])
    proba(S, np.zeros(SR, dtype=np.float32))   # premier passage (préparation du graphe) avant d'annoncer « prêt »
    print(json.dumps({"ready": True}), flush=True)
    for line in sys.stdin:
        try:
            m = json.loads(line)
        except Exception:
            continue
        t0 = time.time()
        try:
            p = proba(S, load(m["wav"]))
            out = {"id": m.get("id"), "ok": True, "p": round(p, 4), "ms": int((time.time() - t0) * 1000)}
        except Exception as e:
            out = {"id": m.get("id"), "ok": False, "error": str(e)[:200]}
        print(json.dumps(out), flush=True)
