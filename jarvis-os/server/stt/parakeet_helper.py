"""JARVIS OS 0.32.0 : l'écoute du serveur par Parakeet TDT 0.6B v3 (NVIDIA, 25 langues dont le français), gratuite, sur le serveur.
Mesuré le 21/11/2026 (20 phrases françaises lues du jeu MLS, 291 s, 2 cœurs ; plus 17 phrases de 17 autres voix) :
- Whisper small (avant) : 15,6 % et 15,0 % de mots faux ; une phrase de 3 s écrite en 1,6 s ; 0,9 Go ;
- Parakeet int8 publié (sherpa-onnx), variante « int8 », pour un serveur de 4 Go : 11,7 % et 12,2 % ; 0,32 s ; 1,1 Go ;
- Parakeet à encodeur requantifié par canal (onnx-asr), variante « fine », pour 8 Go et plus : 5,9 % et 7,6 % ; 0,2 s ; 1,5 Go.
(Processeur de la mesure avec AVX-512 VNNI : sur un processeur sans VNNI, l'int8 est plus lent ; à remesurer sur le VPS.)
Même protocole que whisper_helper.py : entrée {"id", "wav", "prompt"} une par ligne, sortie {"id", "ok", "text"}.
Parakeet n'a pas d'amorce de mots : les noms de l'amorce (les bots, JARVIS…) reprennent après coup leur forme exacte."""
import json, os, re, sys, unicodedata, wave
import numpy as np

engine, model_dir = sys.argv[1], sys.argv[2]   # engine : « sherpa » (variante int8) ou « onnxasr » (variante fine)
threads = int(os.environ.get("JARVIS_WHISPER_THREADS", "2"))

if engine == "sherpa":
    import sherpa_onnx
    _rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=os.path.join(model_dir, "encoder.int8.onnx"), decoder=os.path.join(model_dir, "decoder.int8.onnx"),
        joiner=os.path.join(model_dir, "joiner.int8.onnx"), tokens=os.path.join(model_dir, "tokens.txt"),
        num_threads=threads, sample_rate=16000, feature_dim=128, decoding_method="greedy_search", model_type="nemo_transducer")

    def transcribe(x):
        st = _rec.create_stream()
        st.accept_waveform(16000, x)
        _rec.decode_stream(st)
        return st.result.text.strip()
else:
    import onnx_asr
    import onnxruntime as ort
    so = ort.SessionOptions()
    so.intra_op_num_threads = threads
    so.inter_op_num_threads = 1
    so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    _model = onnx_asr.load_model("nemo-parakeet-tdt-0.6b-v3", path=model_dir, quantization="int8", sess_options=so, providers=["CPUExecutionProvider"])

    def transcribe(x):
        return str(_model.recognize(x, sample_rate=16000) or "").strip()


def load(path):
    """WAV PCM 16 bits (mono ou stéréo, toute fréquence) → float32 mono à 16 kHz (comme whisper_helper.py)"""
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


def _plain(s):
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")


# Mots que Parakeet peut écrire à la place d'un nom de bot (sans accents) ; pas de rapprochement approximatif : « Argue », « Plutôt »
# ou « Athènes » sont de vrais mots et deviendraient un bot (essai du 21/11/2026). Claude comprend de toute façon le reste par le contexte.
ALIAS = {"keros": "Kairos", "kairos": "Kairos", "cairos": "Kairos", "kaïros": "Kairos", "ulisse": "Ulysse", "plutos": "Plutus",
         "chronose": "Chronos", "jarvisse": "JARVIS", "djarvis": "JARVIS"}


def corrige(text, prompt):
    """un nom de l'amorce (les bots, JARVIS) écrit sans ses accents ou sa casse reprend sa forme (« Athena » → « Athéna »,
    « Jarvis » → « JARVIS ») ; quelques erreurs connues aussi (« Kéros » → « Kairos ») ; rien d'autre n'est touché"""
    noms = {_plain(w): w for w in re.findall(r"[A-Za-zÀ-ÿ]+", prompt or "") if len(w) >= 4 and w[0].isupper()}

    def fix(m):
        w = m.group(0)
        if len(w) < 4 or not w[0].isupper():
            return w
        pw = _plain(w)
        return noms.get(pw) or ALIAS.get(pw) or w
    return re.sub(r"[A-Za-zÀ-ÿ]+", fix, text)


# 0.45.0 (capture du 21/11/2026 : son « oui » écrit « Yeah. ») : Parakeet devine la langue de chaque phrase ; un mot court sort parfois
# en anglais. Une phrase faite seulement de ces mots-là est remise en français ; rien d'autre n'est touché.
ANGLAIS = {"yeah": "Oui", "yes": "Oui", "yep": "Oui", "yup": "Oui", "no": "Non", "nope": "Non", "okay": "D'accord", "ok": "D'accord",
           "thanks": "Merci", "thank you": "Merci", "hello": "Bonjour", "hi": "Salut", "bye": "Au revoir", "goodbye": "Au revoir", "sorry": "Pardon"}


def en_francais(text):
    k = re.sub(r"[^a-z ]", " ", (text or "").lower())
    k = re.sub(r"\s+", " ", k).strip()
    if not k:
        return text
    if k in ANGLAIS:
        return ANGLAIS[k] + "."
    mots = k.split(" ")
    if len(mots) <= 3 and all(m in ("yeah", "yes", "yep", "yup") for m in mots):
        return "Oui."
    return text


print(json.dumps({"ready": True}), flush=True)
for line in sys.stdin:
    req = None
    try:
        req = json.loads(line)
        x = load(req["wav"])
        text = transcribe(x) if len(x) >= 1600 else ""   # moins de 0,1 s : rien à écrire
        print(json.dumps({"id": req["id"], "ok": True, "text": en_francais(corrige(text, req.get("prompt") or ""))}), flush=True)
    except Exception as e:  # une phrase ratée ne doit pas arrêter l'écoute
        print(json.dumps({"id": req.get("id") if isinstance(req, dict) else None, "ok": False, "error": str(e)[:200]}), flush=True)
