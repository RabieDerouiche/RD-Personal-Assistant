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
lancer() { : > "$T/appels"; env HERMES_SEUIL_FORFAIT="${SEUIL:-85}" HERMES_GARDE_USAGE_CMD="${CMD:-cat $T/usage.json}" HERMES_GARDE_SYSTEMCTL="$T/systemctl" \
  HERMES_GARDE_NOTIFIER="$T/notifier" HERMES_GARDE_ETAT="$T/etat/arret" HERMES_GARDE_POLITIQUE="$T/politique.yaml" bash "$GARDE" > "$T/sortie" 2>&1; }
messages() { cat "$T/messages" 2>/dev/null | wc -l; }

echo "== Garde du forfait"
echo active > "$T/etat-service"; usage 40 30 35 20; lancer
verif "40 % : rien ne change" bash -c "! grep -q 'stop\|start' '$T/appels' && [ ! -f '$T/etat/arret' ] && [ $(messages) = 0 ]"
usage 86 40 50 20; lancer
verif "86 % sur la fenêtre de 5 heures : Hermes arrêté" grep -q '^stop hermes-gateway.service' "$T/appels"
verif "… marqué comme arrêté par le garde" [ -f "$T/etat/arret" ]
verif "… et le propriétaire prévenu (pourcentage, fenêtre, heure de Paris)" grep -q "à 86 % (fenêtre de 5 heures).*le 23/11 à 19:00" "$T/messages"
usage 90 40 50 20; lancer
verif "90 % ensuite : pas de second arrêt ni de second message" bash -c "! grep -q stop '$T/appels' && [ $(messages) = 1 ]"
usage 80 40 50 20; lancer
verif "80 % (au-dessus de 75 %) : Hermes reste en pause" bash -c "! grep -q start '$T/appels' && [ -f '$T/etat/arret' ]"
usage 20 40 50 20; lancer
verif "20 % après la remise à zéro : Hermes relancé, marque retirée, message de reprise" bash -c "grep -q '^start hermes-gateway.service' '$T/appels' && [ ! -f '$T/etat/arret' ] && tail -1 '$T/messages' | grep -q 'Hermes reprend'"
echo inactive > "$T/etat-service"; usage 20 40 50 20; lancer
verif "Hermes arrêté à la main : le garde ne le relance jamais" bash -c "! grep -q start '$T/appels'"
echo active > "$T/etat-service"; usage 10 30 88 20; lancer
verif "semaine Opus à 88 % (le modèle d'Hermes) : arrêt" grep -q '^stop' "$T/appels"
rm -f "$T/etat/arret"; echo active > "$T/etat-service"; usage 10 30 40 95; lancer
verif "semaine Sonnet à 95 % (la voix de JARVIS, pas Hermes) : pas d'arrêt" bash -c "! grep -q stop '$T/appels'"
CMD=false lancer
verif "usage illisible (Claude pas relié, réseau coupé) : aucune décision" bash -c "! grep -q 'stop\|start' '$T/appels' && grep -q 'aucune décision' '$T/sortie'"
CMD='echo "{\"windows\": []}"' lancer
verif "aucune fenêtre chiffrée : aucune décision" grep -q "aucune décision" "$T/sortie"
SEUIL=abc; usage 86 40 50 20; lancer; SEUIL=85
verif "seuil illisible : 85 % par défaut" grep -q '^stop' "$T/appels"
verif "le message ne contient ni guillemet ni jeton" bash -c "! grep -q '\"' '$T/messages'"

echo; echo "Garde du forfait : $ok vérifications réussies, $ko en échec."
[ $ko = 0 ]
