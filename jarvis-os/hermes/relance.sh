#!/bin/bash
# JARVIS OS — la relance automatique après la limite du forfait Claude (26/11/2026, sa demande : « Fais en sorte que la
# relance soit automatique » ; docs/hermes.md). Posée par install.sh dans /usr/local/sbin/hermes-relance (root), lancée
# toutes les 10 minutes par hermes-relance.timer ; exécute la copie root de limite.py, jamais un fichier du dépôt.
#
#   sudo hermes-relance             relance UNE fois, après la levée de la limite, ce qu'elle a coupé : routines jarvis-… d'Hermes,
#                                   tâches d'hermes-portail coupées avant tout contact avec le portail ; redémarre une passerelle plantée
#   sudo hermes-relance --a-blanc   dit ce qu'il ferait, sans rien toucher (ni état, ni service, ni notification)
#
# 0.92.0 : à chaque passage (pas à blanc), même sans rien à relancer, il écrit aussi pour JARVIS un résumé assaini du cron d'Hermes
# (/var/lib/hermes-relance-etat/routines.json, root et groupe de JARVIS, 750 et 640) : l'app montre « Hermes et ses routines » en direct.
# Aucune lecture d'usage en plus, Hermes n'est pas lancé ; une erreur de ce résumé ne change jamais le résultat de la relance.
set -uo pipefail
[ "$(id -u)" = 0 ] || { echo "À lancer en root : sudo hermes-relance"; exit 1; }
case "${1:-}" in ""|--a-blanc) ;; *) sed -n '5,7p' "$0" | sed 's/^# \{0,3\}//'; exit 1 ;; esac
lib=${HERMES_RELANCE_LIB:-/usr/local/lib/hermes-relance}
python3 -I "$lib/limite.py" relancer "$@"; code=$?
# 0.96.0 (administrer les routines depuis JARVIS) : après la relance, l'historique des passages, les pauses posées depuis JARVIS tenues,
# un ordre que la surveillance du dossier aurait manqué, puis le résumé récrit. Jamais à blanc ; son échec ne change pas le code de la relance.
if [ "${1:-}" != --a-blanc ] && [ -f "$lib/ordres.py" ]; then
  python3 -I "$lib/ordres.py" suivre || echo "Suivi des routines pour JARVIS : en échec (sans effet sur la relance)."
fi
exit $code
