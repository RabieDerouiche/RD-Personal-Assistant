#!/bin/bash
# JARVIS OS — installe l'écoute du serveur (Parakeet de NVIDIA depuis 0.32.0, Whisper en secours ; gratuites) pour l'utilisateur du service, sans droits root.
# Lancé par le bouton « Installer l'écoute » de Réglages (ou à la main : sudo -iu jarvis bash /opt/rd/jarvis-os/server/install/ecoute.sh).
# Modèle « small » par défaut (environ 500 Mo de mémoire) ; JARVIS_WHISPER_MODEL=base pour plus rapide, moins juste.
set -euo pipefail
D="${JARVIS_WHISPER_DIR:-$HOME/whisper}"
M="${JARVIS_WHISPER_MODEL:-small}"
mkdir -p "$D/models"
rm -f "$D/ok"
export PATH="$HOME/.local/bin:$PATH"
if ! command -v uv >/dev/null; then curl -LsSf https://astral.sh/uv/install.sh | sh; fi
V="$D/venv"
if [ ! -x "$V/bin/python" ]; then rm -rf "$V"; uv venv --python 3.12 "$V"; fi
uv pip install --python "$V/bin/python" faster-whisper
"$V/bin/python" - "$M" "$D/models" <<'PY'
import sys
from faster_whisper import WhisperModel
WhisperModel(sys.argv[1], device="cpu", compute_type="int8", download_root=sys.argv[2])
print("modèle " + sys.argv[1] + " prêt")
PY
touch "$D/ok"
echo "Whisper installé (secours)."

# 0.32.0 : Parakeet TDT 0.6B v3 (NVIDIA, 25 langues dont le français), plus juste et plus rapide que Whisper small
# (mesure du 21/11/2026 : docs/jarvis-os.md, 0.32.0). Variante choisie selon la mémoire du serveur :
# 7 Go et plus (VPS-2) : encodeur requantifié par canal, la plus juste (« fine ») ; sinon l'int8 publié de sherpa-onnx (« int8 »).
# JARVIS_ECOUTE_MOTEUR=whisper : Whisper seul ; JARVIS_PARAKEET_VARIANTE=int8 ou fine : variante imposée.
if [ "${JARVIS_ECOUTE_MOTEUR:-parakeet}" != "whisper" ]; then
  P="$D/parakeet"; mkdir -p "$P"; rm -f "$P/ok"
  MEM=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
  VAR="${JARVIS_PARAKEET_VARIANTE:-}"
  if [ -z "$VAR" ]; then if [ "$MEM" -ge 7000 ]; then VAR=fine; else VAR=int8; fi; fi
  uv pip install --python "$V/bin/python" "huggingface_hub>=0.24" numpy
  if [ "$VAR" = "fine" ]; then
    uv pip install --python "$V/bin/python" "onnx-asr==0.12.0" "onnxruntime==1.32.0" onnx
    "$V/bin/python" - "$P/fine" <<'PY'
import os, shutil, sys
from huggingface_hub import snapshot_download
d = sys.argv[1]; src = os.path.join(d, "fp32"); os.makedirs(d, exist_ok=True)
snapshot_download("istupakov/parakeet-tdt-0.6b-v3-onnx", local_dir=src,
                  allow_patterns=["encoder-model.onnx", "encoder-model.onnx.data", "decoder_joint-model.int8.onnx", "vocab.txt", "config.json"])
from onnxruntime.quantization import QuantType, quantize_dynamic
# per_channel + poids signés + reduce_range (7 bits, sûr sur un processeur AVX2 sans VNNI) : 5,9 % de mots faux, contre 11,7 % en int8 publié
quantize_dynamic(os.path.join(src, "encoder-model.onnx"), os.path.join(d, "encoder-model.int8.onnx"), per_channel=True, reduce_range=True,
                 weight_type=QuantType.QInt8, op_types_to_quantize=["MatMul"])
for f in ("decoder_joint-model.int8.onnx", "vocab.txt", "config.json"):
    os.replace(os.path.join(src, f), os.path.join(d, f))
shutil.rmtree(src)
print("Parakeet (encodeur requantifié) prêt")
PY
    echo '{"engine": "onnxasr", "variante": "fine"}' > "$P/variante.json"
  else
    uv pip install --python "$V/bin/python" "sherpa-onnx==2.0.2"
    "$V/bin/python" - "$P/int8" <<'PY'
import sys
from huggingface_hub import snapshot_download
snapshot_download("csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8", local_dir=sys.argv[1],
                  allow_patterns=["encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt"])
print("Parakeet (int8) prêt")
PY
    echo '{"engine": "sherpa", "variante": "int8"}' > "$P/variante.json"
  fi
  # essai réel : le modèle se charge et répond à une seconde de silence (sinon Whisper reste l'écoute)
  T="$P/essai.wav"
  "$V/bin/python" - "$T" <<'PY'
import sys, wave
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(b"\0\0" * 16000)
PY
  ENG=$(grep -o '"engine": "[a-z]*"' "$P/variante.json" | cut -d'"' -f4)
  OUT=$(printf '{"id":"essai","wav":"%s","prompt":""}\n' "$T" | "$V/bin/python" "$(dirname "$0")/../stt/parakeet_helper.py" "$ENG" "$P/$VAR" 2>&1 || true)
  if printf '%s' "$OUT" | grep -q '"ok": true'; then
    touch "$P/ok"; echo "Parakeet installé (variante $VAR, mémoire $MEM Mo) : c'est lui qui écoute."
  else
    echo "Parakeet ne répond pas : Whisper reste l'écoute."
  fi
  rm -f "$T"
fi

# 0.36.0 : la fin de phrase reconnue à la voix (Smart Turn v3.2 de Pipecat, BSD-2, 8,7 Mo, un cœur, environ 55 ms par phrase).
# Version figée (révision et empreinte du fichier) ; un essai réel avant de l'utiliser (sinon : 0,7 s de silence, comme avant).
if [ "${JARVIS_FIN_DE_PHRASE:-oui}" != "non" ]; then
  R="$D/tour"; mkdir -p "$R"; rm -f "$R/ok"
  uv pip install --python "$V/bin/python" "huggingface_hub>=0.24" numpy "onnxruntime==1.32.0"
  "$V/bin/python" - "$R" <<'PY'
import hashlib, os, shutil, sys
from huggingface_hub import hf_hub_download
d = sys.argv[1]
f = hf_hub_download("pipecat-ai/smart-turn-v3", "smart-turn-v3.2-cpu.onnx", revision="f766f81d3cfdf7737ac64aad813d91bbfd56bf93")
h = hashlib.sha256(open(f, "rb").read()).hexdigest()
if h != "2bb026316b14a660486a75b1733cd3fbab8c2fd0314dc9af7be49f8cca967e4f":
    sys.exit("Smart Turn : fichier inattendu (" + h + ")")
shutil.copyfile(f, os.path.join(d, "smart-turn-v3.2-cpu.onnx"))
print("Smart Turn prêt")
PY
  T="$R/essai.wav"
  "$V/bin/python" - "$T" <<'PY'
import sys, wave
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(b"\0\0" * 16000)
PY
  OUT=$(printf '{"id":"essai","wav":"%s"}\n' "$T" | "$V/bin/python" "$(dirname "$0")/../stt/tour_helper.py" "$R/smart-turn-v3.2-cpu.onnx" 2>&1 || true)
  if printf '%s' "$OUT" | grep -q '"ok": true'; then
    touch "$R/ok"; echo "Fin de phrase installée (Smart Turn v3.2) : une pause de 0,25 s suffit quand ta phrase est finie."
  else
    echo "Smart Turn ne répond pas : la phrase finit après 0,7 s de silence, comme avant."
  fi
  rm -f "$T"
fi
echo "Écoute installée."
