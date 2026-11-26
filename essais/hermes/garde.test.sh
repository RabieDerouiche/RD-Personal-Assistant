#!/bin/bash
# Banc du garde du forfait d'Hermes (jarvis-os/hermes/garde-forfait.sh) : faux usage, faux systemctl,
# faux Telegram. Aucun réseau, aucun service touché. Lancer : bash essais/hermes/garde.test.sh
set -uo pipefail
ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); GARDE=$ICI/../../jarvis-os/hermes/garde-forfait.sh
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
ok=0; ko=0
verif() { local nom=$1; shift; if "$@"; then ok=$((ok + 1)); echo "  ✓ $nom"; else ko=$((ko + 1)); echo "  ✗ $nom"; fi; }

cat > "$T/systemctl" <<'EOF'
#!/bin/bash
echo "$*" >> "$(dirname "$0")/appels"
case "$1" in
  is-active) cat "$(dirname "$0")/etat-service" ;;
  stop) echo inactive > "$(dirname "$0")/etat-service" ;;
  start) echo active > "$(dirname "$0")/etat-service" ;;
esac
EOF
printf '#!/bin/bash\necho "$1" >> "$(dirname "$0")/messages"\n' > "$T/notifier"
chmod +x "$T/systemctl" "$T/notifier"
printf 'model:\n  provider: "claude-subscription-directsdk-experimental"\n  default: "opus"            # commentaire\n' > "$T/politique.yaml"
usage() {   # usage <session %> <semaine %> <opus %> <sonnet %>
  cat > "$T/usage.json" <<EOF
{"provider": "claude-subscription-directsdk-experimental", "source": "claude_code_get_usage", "windows": [
  {"label": "Current session", "used_percent": $1, "resets_at": "2026-11-23T18:00:00+00:00", "detail": null},
  {"label": "Current week", "used_percent": $2, "resets_at": "2026-11-26T10:00:00+00:00", "detail": null},
  {"label": "Opus week", "used_percent": $3, "resets_at": "2026-11-26T10:00:00+00:00", "detail": null},
  {"label": "Sonnet week", "used_percent": $4, "resets_at": "2026-11-26T10:00:00+00:00", "detail": null},
  {"label": "Extra", "used_percent": null, "resets_at": null, "detail": "coupé"}]}
EOF
}
lancer() { : > "$T/appels"; env HERMES_SEUIL_FORFAIT="${SEUIL:-85}" HERMES_GARDE_CINQ_HEURES="${CINQ:-}" HERMES_GARDE_USAGE_CMD="${CMD:-cat $T/usage.json}" \
  HERMES_GARDE_SYSTEMCTL="$T/systemctl" HERMES_GARDE_NOTIFIER="$T/notifier" HERMES_GARDE_ETAT="$T/etat/arret" HERMES_GARDE_POLITIQUE="$T/politique.yaml" \
  bash "$GARDE" > "$T/sortie" 2>&1; }
messages() { cat "$T/messages" 2>/dev/null | wc -l; }

echo "== Garde du forfait (semaine seulement : son choix du 23/11/2026)"
echo active > "$T/etat-service"; usage 40 30 35 20; lancer
verif "40 % : rien ne change" bash -c "! grep -q 'stop\|start' '$T/appels' && [ ! -f '$T/etat/arret' ] && [ $(messages) = 0 ] && grep -q 'fenêtre de 5 heures ignorée' '$T/sortie'"
usage 99 40 50 20; lancer
verif "fenêtre de 5 heures à 99 %, semaine à 40 % : Hermes continue (il la remplit lui-même en testant)" bash -c "! grep -q 'stop\|start' '$T/appels' && [ ! -f '$T/etat/arret' ] && [ $(messages) = 0 ]"
usage 20 86 50 20; lancer
verif "semaine à 86 % : Hermes arrêté" grep -q '^stop hermes-gateway.service' "$T/appels"
verif "… marqué comme arrêté par le garde" [ -f "$T/etat/arret" ]
verif "… le dernier usage lu est écrit pour le bilan d'Hermes (usage.json : chiffres seulement, lisible par JARVIS)" python3 -I -c "
import json, os, sys; p = sys.argv[1]; d = json.load(open(p))
sys.exit(0 if d['pct'] == 86 and d['fenetre'] == 'semaine' and d['remise'] == 'le 26/11 à 11:00' and d['arret'] is True and d['at'] > 0 and oct(os.stat(p).st_mode)[-3:] == '644' else 1)" "$T/etat/usage.json"
verif "… et le propriétaire prévenu (pourcentage, fenêtre, heure de Paris)" grep -q "à 86 % (semaine).*le 26/11 à 11:00" "$T/messages"
usage 20 90 50 20; lancer
verif "90 % ensuite : pas de second arrêt ni de second message" bash -c "! grep -q stop '$T/appels' && [ $(messages) = 1 ]"
usage 20 80 50 20; lancer
verif "80 % (au-dessus de 75 %) : Hermes reste en pause" bash -c "! grep -q start '$T/appels' && [ -f '$T/etat/arret' ]"
usage 99 20 15 20; lancer
verif "semaine à 20 % après la remise à zéro (5 heures à 99 %, ignorée) : Hermes relancé, marque retirée, message de reprise" bash -c "grep -q '^start hermes-gateway.service' '$T/appels' && [ ! -f '$T/etat/arret' ] && tail -1 '$T/messages' | grep -q 'Hermes reprend : ton forfait Claude est à 20 % (semaine), sous mon seuil de reprise de 75 %'"
echo inactive > "$T/etat-service"; usage 20 40 50 20; rm -f "$T/lu"; CMD="touch $T/lu; cat $T/usage.json" lancer
verif "Hermes arrêté à la main : le garde ne le relance jamais" bash -c "! grep -q start '$T/appels'"
verif "… et ne lit même pas l'usage (pas de sonde inutile)" bash -c "[ ! -f '$T/lu' ] && grep -q 'rien à surveiller' '$T/sortie'"
usage 20 90 50 20; rm -f "$T/lu"; CMD="touch $T/lu; cat $T/usage.json" lancer
verif "Hermes arrêté à la main, semaine à 90 % : aucune lecture ni message" bash -c "[ ! -f '$T/lu' ] && [ $(messages) = 2 ]"
echo active > "$T/etat-service"; usage 10 30 88 20; lancer
verif "semaine Opus à 88 % (le modèle d'Hermes) : arrêt, message « semaine Opus »" bash -c "grep -q '^stop' '$T/appels' && tail -1 '$T/messages' | grep -q 'à 88 % (semaine Opus)'"
rm -f "$T/etat/arret"; echo active > "$T/etat-service"; usage 10 30 40 95; lancer
verif "semaine Sonnet à 95 % (la voix de JARVIS, pas Hermes) : pas d'arrêt" bash -c "! grep -q stop '$T/appels'"
CMD=false lancer
verif "usage illisible (Claude pas relié, réseau coupé) : aucune décision" bash -c "! grep -q 'stop\|start' '$T/appels' && grep -q 'aucune décision' '$T/sortie'"
CMD='echo "{\"windows\": []}"' lancer
verif "aucune fenêtre chiffrée : aucune décision" grep -q "aucune décision" "$T/sortie"
CMD='echo "{\"windows\": [{\"label\": \"Current session\", \"used_percent\": 99, \"resets_at\": null}, {\"label\": \"Current week\", \"used_percent\": null}]}"' lancer
verif "seule la fenêtre de 5 heures est chiffrée : aucune décision" bash -c "! grep -q 'stop\|start' '$T/appels' && grep -q 'aucune décision' '$T/sortie'"
usage 86 40 50 20; CINQ=1 lancer
verif "HERMES_GARDE_CINQ_HEURES=1 : la fenêtre de 5 heures compte de nouveau (arrêt à 86 %)" bash -c "grep -q '^stop' '$T/appels' && tail -1 '$T/messages' | grep -q '(fenêtre de 5 heures)'"
rm -f "$T/etat/arret"; echo active > "$T/etat-service"; usage 86 40 50 20; CINQ=oui lancer
verif "valeur illisible (oui) : semaine seulement, pas d'arrêt" bash -c "! grep -q stop '$T/appels'"
SEUIL=abc; usage 20 86 50 20; lancer; SEUIL=85
verif "seuil illisible : 85 % par défaut" grep -q '^stop' "$T/appels"
verif "le message ne contient ni guillemet ni jeton" bash -c "! grep -q '\"' '$T/messages'"

echo; echo "Garde du forfait : $ok vérifications réussies, $ko en échec."
[ $ko = 0 ]
