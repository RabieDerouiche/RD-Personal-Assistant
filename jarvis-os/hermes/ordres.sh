#!/bin/bash
# JARVIS OS — les ordres de JARVIS pour les routines d'Hermes (0.96.0, sa demande du 27/11/2026 : « les routines, on doit être capable
# de les relancer depuis JARVIS […] arrêter une routine jusqu'à nouvel ordre, la relancer, avoir l'historique » ; docs/hermes.md).
# Posé par install.sh dans /usr/local/sbin/hermes-ordres (root), lancé par hermes-ordres.path dès que JARVIS pose un ordre dans
# /var/lib/jarvis-reveil/ordres ; exécute la copie root d'ordres.py, jamais un fichier du dépôt.
#
#   sudo hermes-ordres            lit, valide et exécute les ordres posés (lancer, pause, reprendre, horaire), puis vide le dossier
#   sudo hermes-ordres suivre     met à jour l'historique des passages et le résumé pour JARVIS (fait aussi toutes les 10 minutes)
set -uo pipefail
[ "$(id -u)" = 0 ] || { echo "À lancer en root : sudo hermes-ordres"; exit 1; }
case "${1:-traiter}" in traiter|suivre) ;; *) sed -n '7,8p' "$0" | sed 's/^# \{0,3\}//'; exit 1 ;; esac
exec python3 -I "${HERMES_RELANCE_LIB:-/usr/local/lib/hermes-relance}/ordres.py" "${1:-traiter}"
