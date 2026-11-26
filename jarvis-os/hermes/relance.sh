#!/bin/bash
# JARVIS OS — la relance automatique après la limite du forfait Claude (26/11/2026, sa demande : « Fais en sorte que la
# relance soit automatique » ; docs/hermes.md). Posée par install.sh dans /usr/local/sbin/hermes-relance (root), lancée
# toutes les 10 minutes par hermes-relance.timer ; exécute la copie root de limite.py, jamais un fichier du dépôt.
#
#   sudo hermes-relance             relance UNE fois, après la levée de la limite, ce qu'elle a coupé : routines jarvis-… d'Hermes,
#                                   tâches d'hermes-portail coupées avant tout contact avec le portail ; redémarre une passerelle plantée
#   sudo hermes-relance --a-blanc   dit ce qu'il ferait, sans rien toucher (ni état, ni service, ni notification)
set -uo pipefail
[ "$(id -u)" = 0 ] || { echo "À lancer en root : sudo hermes-relance"; exit 1; }
case "${1:-}" in ""|--a-blanc) ;; *) sed -n '5,7p' "$0" | sed 's/^# \{0,3\}//'; exit 1 ;; esac
exec python3 -I "${HERMES_RELANCE_LIB:-/usr/local/lib/hermes-relance}/limite.py" relancer "$@"
