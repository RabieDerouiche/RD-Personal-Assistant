#!/bin/bash
# JARVIS OS — installe la voix du serveur (Piper, gratuite, voix « Pierre ») pour l'utilisateur du service, sans droits root.
# Lancé par le bouton « Installer la voix Pierre » de l'app (ou à la main : sudo -iu jarvis bash /opt/rd/jarvis-os/server/install/voice.sh).
set -euo pipefail
D="${JARVIS_PIPER_DIR:-$HOME/piper}"
mkdir -p "$D/voices"
export PATH="$HOME/.local/bin:$PATH"
if ! command -v uv >/dev/null; then curl -LsSf https://astral.sh/uv/install.sh | sh; fi
if [ ! -x "$D/bin/python" ]; then uv venv --python 3.12 "$D"; fi
uv pip install --python "$D/bin/python" piper-tts
B=https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/upmc/medium
for f in fr_FR-upmc-medium.onnx.json fr_FR-upmc-medium.onnx; do
  if [ ! -s "$D/voices/$f" ]; then curl -fsSL -o "$D/voices/$f.part" "$B/$f"; mv "$D/voices/$f.part" "$D/voices/$f"; fi
done
"$D/bin/python" -c "import piper; print('piper prêt')"
echo "Voix installée."
