#!/bin/bash
# Banc du coffre des identifiants d'un espace client (install/portail-couches.sh) : chiffrement par systemd-creds,
# rien en clair sur le disque, sonde lancée avec le coffre ouvert devant un faux site (tests/fake-portail.py).
# Données inventées. En root, dans un conteneur de banc seulement (il crée l'utilisateur jarvis-portail et efface
# /etc/jarvis-portail à la fin) : sudo bash jarvis-os/server/tests/portail-coffre.test.sh
set -uo pipefail
[ "$(id -u)" = 0 ] || { echo "En root."; exit 1; }
[ -e /run/systemd/system ] && { echo "Systemd tourne ici : ce n'est pas un conteneur de banc. Arrêt."; exit 1; }
ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); OUTIL=$ICI/../install/portail-couches.sh; PORT=40091
T=$(mktemp -d); trap 'kill $PID 2>/dev/null; bash "$OUTIL" --retirer >/dev/null 2>&1; rm -rf "$T"' EXIT
ok=0; ko=0
verif() { local nom=$1; shift; if "$@"; then ok=$((ok + 1)); echo "  ✓ $nom"; else ko=$((ko + 1)); echo "  ✗ $nom"; fi; }
python3 -I "$ICI/fake-portail.py" $PORT & PID=$!
for i in $(seq 1 30); do curl -s -o /dev/null "http://127.0.0.1:$PORT/login" && break; sleep 0.2; done
saisir() { printf '%s\n%s\n' "jean.exemple@exemple.fr" "$1" | JARVIS_SONDE_BASE="http://127.0.0.1:$PORT" script -qec "bash '$OUTIL'" /dev/null > "$T/saisie.log" 2>&1; }
bash "$OUTIL" --essai > "$T/essai.log" 2>&1; rc=$?
verif "essai du coffre sans vrai secret : chiffré, ouvert pour le seul programme, fermé à jarvis" bash -c "[ $rc = 0 ] && [ \$(grep -c '✓' '$T/essai.log') = 3 ] && grep -q 'Coffre vérifié' '$T/essai.log'"
verif "hors d'un terminal : refuse la saisie" bash -c "bash '$OUTIL' < /dev/null 2>&1 | grep -q 'vrai terminal'"
saisir "bon-mot-de-passe"
verif "saisie : identifiants au coffre, sonde réussie" bash -c "grep -q 'Identifiants au coffre' '$T/saisie.log' && grep -q 'sonde faite' '$T/saisie.log'"
verif "le coffre : root, 0600, et ni le mot de passe ni l'adresse n'y sont lisibles" bash -c "[ \"\$(stat -c '%U %a' /etc/jarvis-portail/couches.cred)\" = 'root 600' ] && ! grep -q 'bon-mot-de-passe\|jean.exemple' /etc/jarvis-portail/couches.cred"
verif "le mot de passe n'est écrit nulle part ailleurs (coffre, sonde, copies, dossier de jarvis, journal de la saisie)" bash -c "! grep -rqs 'bon-mot-de-passe' /etc/jarvis-portail /var/lib/jarvis-portail /usr/local/lib/jarvis-portail /home/jarvis '$T/essai.log'"
verif "la sonde exécutée est la copie root, pas le fichier du dépôt" bash -c "[ \"\$(stat -c '%U %a' /usr/local/lib/jarvis-portail/portail_sonde.py)\" = 'root 644' ]"
verif "le squelette est écrit, sans secret" bash -c "grep -q 'Connexion : réussie' /var/lib/jarvis-portail/couches-sonde.txt && grep -q '^FORMULAIRE' /var/lib/jarvis-portail/couches-sonde.txt && ! grep -q 'bon-mot-de-passe\|jean.exemple' /var/lib/jarvis-portail/couches-sonde.txt"
verif "le dossier du coffre est fermé à tout autre que root" bash -c "[ \"\$(stat -c '%U %a' /etc/jarvis-portail)\" = 'root 700' ] && ! runuser -u jarvis-portail -- ls /etc/jarvis-portail >/dev/null 2>&1"
saisir "mauvais"
verif "mauvais mot de passe : le site refuse, le coffre est vidé" bash -c "grep -q 'coffre vidé' '$T/saisie.log' && [ ! -e /etc/jarvis-portail/couches.cred ]"
bash "$OUTIL" --retirer > /dev/null 2>&1
verif "--retirer : plus de coffre, de sonde ni de copie" bash -c "[ ! -e /etc/jarvis-portail ] && [ ! -e /var/lib/jarvis-portail ] && [ ! -e /usr/local/lib/jarvis-portail ]"
echo; echo "Coffre d'espace client : $ok vérifications réussies, $ko en échec."
[ $ko = 0 ]
