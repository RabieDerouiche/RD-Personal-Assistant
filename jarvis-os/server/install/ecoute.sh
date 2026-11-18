#!/bin/bash
# JARVIS OS — installe l'écoute du serveur (Whisper par faster-whisper, gratuite) pour l'utilisateur du service, sans droits root.
# Lancé par le bouton « Installer l'écoute Whisper » de Réglages (ou à la main : sudo -iu jarvis bash /opt/rd/jarvis-os/server/install/ecoute.sh).
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
echo "Écoute installée."
