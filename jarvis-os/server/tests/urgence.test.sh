#!/bin/bash
# Banc de l'arrêt d'urgence (install/urgence.sh) : faux systemctl, faux jarvis-coffre, faux Claude Code, faux
# `node server.mjs urgence`, dans un dossier temporaire (un sous-dossier neuf par cas). Aucun service touché, aucun
# réseau, rien d'installé, pas besoin d'être root. La vraie garde du forfait d'Hermes (jarvis-os/hermes/
# garde-forfait.sh) est jouée après un verrouillage, pour prouver qu'elle ne relance pas Hermes.
# Lancer : bash jarvis-os/server/tests/urgence.test.sh
set -uo pipefail
ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); OUTIL=$ICI/../install/urgence.sh; GARDE=$ICI/../../hermes/garde-forfait.sh
T=$(mktemp -d /tmp/urgence-banc-XXXXXX) && [ -d "$T" ] || { echo "Dossier temporaire impossible."; exit 1; }
trap 'rm -rf "$T"' EXIT
ok=0; ko=0; cas=0
verif() { local nom=$1; shift; if "$@"; then ok=$((ok + 1)); echo "  ✓ $nom"; else ko=$((ko + 1)); echo "  ✗ $nom"; fi; }
tous() { local c; for c in "$@"; do eval "$c" || return 1; done; }   # toutes les conditions, évaluées ici

# Les faux, dans $T/faux : chacun note son appel dans $CAS/appels ; une ligne de $CAS/echecs (motif) fait échouer
# l'appel qui la contient. L'état de chaque cas (services actifs, connexions, fichiers) vit dans $CAS.
F=$T/faux; mkdir "$F"
cat > "$F/commun" <<'EOF'
echo "$MOI $*" >> "$CAS/appels"
rate() { [ -s "$CAS/echecs" ] && printf '%s\n' "$MOI $*" | grep -qf "$CAS/echecs"; }
EOF
cat > "$F/systemctl" <<'EOF'
#!/bin/bash
MOI=systemctl; . "$(dirname "$0")/commun"
rate "$@" && { echo "Failed: faux échec" >&2; exit 1; }
case "$1" in
  cat) grep -qx "$2" "$CAS/unites" ;;
  is-active) cat "$CAS/actif-${2%.service}" 2>/dev/null || { echo inactive; exit 3; } ;;
  is-enabled) cat "$CAS/demarrage" 2>/dev/null || echo disabled ;;
  show) echo "PORT=8787 HOST=127.0.0.1 JARVIS_DATA=$CAS/donnees JARVIS_PUBLIC_URL=https://exemple.invalid" ;;
  stop) shift; for u in "$@"; do echo inactive > "$CAS/actif-${u%.service}"; done ;;
  start|restart) shift; for u in "$@"; do echo active > "$CAS/actif-${u%.service}"; done ;;
  disable) echo disabled > "$CAS/demarrage" ;;
esac
EOF
cat > "$F/jarvis-coffre" <<'EOF'
#!/bin/bash
MOI=jarvis-coffre; . "$(dirname "$0")/commun"
rate "$@" && exit 1
case "$1" in
  etat) echo "Coffre : ouvert depuis 2026-11-24T08:00:00Z (clé en mémoire seulement)." ;;
  fermer) echo "Coffre fermé : la clé est effacée de la mémoire." ;;
esac
EOF
cat > "$F/en" <<'EOF'
#!/bin/bash
MOI=en; . "$(dirname "$0")/commun"
shift; exec "$@"
EOF
for u in jarvis hermes; do
  cat > "$F/claude-$u" <<EOF
#!/bin/bash
MOI=claude-$u; . "\$(dirname "\$0")/commun"
case "\$1 \$2" in
  "auth status") if [ -e "\$CAS/connecte-$u" ]; then echo '{"loggedIn": true, "authMethod": "claude.ai"}'; else echo '{"loggedIn": false}'; exit 1; fi ;;
  "auth logout") rate "\$@" && exit 1
    [ -e "\$CAS/connecte-$u" ] || { echo "Not logged in."; exit 1; }
    rm -f "\$CAS/connecte-$u" "\$CAS/home/$u/.claude/.credentials.json"; echo "Logged out." ;;
esac
EOF
done
cat > "$F/node" <<'EOF'
#!/bin/bash
MOI="node[JARVIS_DATA=${JARVIS_DATA:-}]"; . "$(dirname "$0")/commun"
rate "$@" && { echo "state.json illisible" >&2; exit 1; }
COMPTES='"appareils":2,"notifications":1,"raccourci":1,"appairage":0,"google":1,"invitations":4,"mcp_clients":1,"mcp_jetons":2,"mcp_fixes":3'
case "$3" in
  --etat) echo '{"mode":"etat",'"$COMPTES"'}' ;;
  --vider) touch "$CAS/vide"; echo '{"mode":"vider",'"$COMPTES"',"reste":0}' ;;
esac
EOF
chmod +x "$F/systemctl" "$F/jarvis-coffre" "$F/en" "$F/claude-jarvis" "$F/claude-hermes" "$F/node"
export URGENCE_BANC=1 URGENCE_SYSTEMCTL="$F/systemctl" URGENCE_COFFRE="$F/jarvis-coffre" URGENCE_EN="$F/en" URGENCE_NODE="$F/node" URGENCE_SERVEUR=/faux/server.mjs \
  URGENCE_CLAUDE_JARVIS="$F/claude-jarvis" URGENCE_CLAUDE_HERMES="$F/claude-hermes"

# depart [pause] : un cas neuf où tout est en marche et relié ; « pause » : Hermes déjà arrêté par la garde du forfait
depart() {
  cas=$((cas + 1)); export CAS="$T/cas$cas"
  mkdir -p "$CAS/home/jarvis/.claude" "$CAS/home/hermes/.claude" "$CAS/etc" "$CAS/garde" "$CAS/sbin"; : > "$CAS/appels"; : > "$CAS/echecs"
  export URGENCE_HOMES="$CAS/home" URGENCE_JETONS_HERMES="$CAS/etc/jarvis.env" URGENCE_MARQUE_GARDE="$CAS/garde/arret" URGENCE_CIBLE="$CAS/sbin/jarvis-urgence"
  printf 'hermes-gateway.service\nhermes-garde.timer\njarvis.service\n' > "$CAS/unites"
  echo active > "$CAS/actif-jarvis"; echo active > "$CAS/actif-hermes-gateway"; echo active > "$CAS/actif-hermes-garde.timer"; echo enabled > "$CAS/demarrage"
  touch "$CAS/connecte-jarvis" "$CAS/connecte-hermes"
  echo '{"acces":"INVENTE"}' > "$CAS/home/jarvis/.claude/.credentials.json"; echo '{"acces":"INVENTE"}' > "$CAS/home/hermes/.claude/.credentials.json"
  printf 'JARVIS_MCP_URL=https://exemple.invalid/mcp\nJARVIS_MCP_TOKEN=jvf_INVENTE_pour_le_banc_0000000\n' > "$CAS/etc/jarvis.env"
  if [ "${1:-}" = pause ]; then echo inactive > "$CAS/actif-hermes-gateway"; echo "90 2026-11-26T10:00:00+00:00 semaine" > "$CAS/garde/arret"; fi
}
lancer() { bash "$OUTIL" "$@" > "$CAS/sortie" 2>&1 < /dev/null; RC=$?; }
terminal() { local mot=$1; shift; (sleep 0.6; printf '%s\n' "$mot") | script -qec "bash '$OUTIL' $*" /dev/null > "$CAS/sortie" 2>&1; RC=$?; }   # dans un faux terminal
actes() { grep -v '^en ' "$CAS/appels" | grep -Ev '^systemctl (cat|is-active|is-enabled|show) |^jarvis-coffre etat$|auth status$|--etat$'; }   # ce qui change quelque chose, sans les lectures
ordre() { local attendu; attendu=$(printf '%s\n' "$@"); [ "$(actes)" = "$attendu" ] || { echo "    obtenu :"; actes | sed 's/^/      /'; return 1; }; }
vu() { grep -q -- "$1" "$CAS/sortie"; }
intact() { [ -e "$CAS/etc/jarvis.env" ] && [ -e "$CAS/connecte-jarvis" ] && [ -e "$CAS/connecte-hermes" ] && [ ! -e "$CAS/vide" ] && [ "$(cat "$CAS/demarrage")" = enabled ]; }   # rien du niveau 2
HERMES_N1=("systemctl stop hermes-garde.timer hermes-garde.service" "systemctl stop hermes-gateway.service" "systemctl start hermes-garde.timer")
coquille_faite() {
  ordre "jarvis-coffre fermer" "systemctl stop jarvis" "${HERMES_N1[@]}" "systemctl disable hermes-gateway.service" "node[JARVIS_DATA=$CAS/donnees] /faux/server.mjs urgence --vider" \
    "claude-jarvis auth logout" "claude-hermes auth logout" "systemctl start jarvis" \
    && [ ! -e "$CAS/etc/jarvis.env" ] && [ ! -e "$CAS/connecte-jarvis" ] && [ ! -e "$CAS/connecte-hermes" ] && [ -e "$CAS/vide" ] && [ "$(cat "$CAS/demarrage")" = disabled ] && [ ! -e "$CAS/garde/arret" ]
}

echo "== etat"
depart pause; mkdir "$CAS/avant"; cp -a "$CAS/garde" "$CAS/etc" "$CAS/home" "$CAS/avant/"
lancer etat
verif "etat : coffre, JARVIS, Hermes (pause de la garde vue), comptes des appareils et des jetons MCP, invitations, Google, jetons d'Hermes" tous '[ $RC = 0 ]' 'vu "Coffre : ouvert depuis"' 'vu "JARVIS (service jarvis) : active"' \
  'vu "Hermes (hermes-gateway) : inactive, au démarrage : enabled ; en pause par la garde"' 'vu "appareils reliés : 2 ; abonnements aux notifications : 1 ; clé du Raccourci : 1"' \
  'vu "MCP : 1 assistant(s) inscrit(s), 2 jeton(s) d.accès ou de renouvellement, 3 jeton(s) fixe(s)"' 'vu "accès Google gardé par le serveur : oui ; invitations : 4"' 'vu "jarvis.env) : présents"'
verif "etat ne change rien : ni arrêt, ni fermeture, ni retrait, fichiers identiques" tous '[ -z "$(actes)" ]' intact '[ -e "$CAS/garde/arret" ]' \
  'diff -r "$CAS/avant/garde" "$CAS/garde" > /dev/null' 'diff -r "$CAS/avant/etc" "$CAS/etc" > /dev/null' 'diff -r "$CAS/avant/home" "$CAS/home" > /dev/null'
verif "… le serveur est lu en --etat, sous l'utilisateur jarvis, avec le dossier de données de son unité" grep -qx "en jarvis env JARVIS_DATA=$CAS/donnees $F/node /faux/server.mjs urgence --etat" "$CAS/appels"

echo "== niveau 1 : verrouiller"
depart; lancer verrouiller
verif "verrouiller : coffre fermé, JARVIS relancé, garde suspendue, Hermes arrêté, garde remise, dans cet ordre" ordre "jarvis-coffre fermer" "systemctl restart jarvis" "${HERMES_N1[@]}"
verif "… et rien du niveau 2 : Hermes reste au démarrage, appareils, jetons et Claude Code intacts ; code 0" tous '[ $RC = 0 ]' intact '! grep -q "disable\|--vider\|logout" "$CAS/appels"'
verif "… chaque étape est dite, et comment revenir" tous '[ "$(grep -c "^  ✓" "$CAS/sortie")" = 6 ]' 'vu "Pour revenir"' 'vu "sudo jarvis-coffre ouvrir"' 'vu "systemctl start hermes-gateway"' '! vu "ÉCHEC"'
# la vraie garde du forfait, Hermes étant déjà en pause pour le forfait au moment de l'urgence
garde() {
  : > "$CAS/appels"
  env HERMES_GARDE_SYSTEMCTL="$F/systemctl" HERMES_GARDE_ETAT="$CAS/garde/arret" HERMES_GARDE_NOTIFIER=true HERMES_GARDE_POLITIQUE=/dev/null \
    HERMES_GARDE_USAGE_CMD="echo '{\"windows\": [{\"label\": \"Current week\", \"used_percent\": 20, \"resets_at\": \"2026-11-26T10:00:00+00:00\"}]}'" bash "$GARDE" > "$CAS/garde.sortie" 2>&1
}
depart pause; garde
verif "témoin : sans urgence, la garde relance bien un Hermes qu'elle avait mis en pause (forfait redescendu à 20 %)" tous 'grep -q "^systemctl start hermes-gateway.service" "$CAS/appels"' '[ "$(cat "$CAS/actif-hermes-gateway")" = active ]'
depart pause; lancer verrouiller; garde
verif "après verrouiller : marque de pause retirée, la vraie garde ne relance pas Hermes (« rien à surveiller »)" tous '[ ! -e "$CAS/garde/arret" ]' '! grep -q " start " "$CAS/appels"' 'grep -q "rien à surveiller" "$CAS/garde.sortie"' '[ "$(cat "$CAS/actif-hermes-gateway")" = inactive ]'

echo "== niveau 2 : coquille"
depart pause; lancer coquille --oui
verif "coquille --oui : tout le niveau 1 (JARVIS arrêté), Hermes retiré du démarrage, serveur vidé, Claude Code déconnecté (jarvis, hermes), jetons d'Hermes effacés, JARVIS relancé en dernier" coquille_faite
verif "… sans question ; vidage et déconnexions sous le bon utilisateur ; comptes retirés affichés" tous '[ $RC = 0 ]' '! vu "Tape COQUILLE"' 'grep -qx "en jarvis env JARVIS_DATA=$CAS/donnees $F/node /faux/server.mjs urgence --vider" "$CAS/appels"' \
  'grep -qx "en jarvis $F/claude-jarvis auth logout" "$CAS/appels"' 'grep -qx "en hermes $F/claude-hermes auth logout" "$CAS/appels"' 'vu "appareils reliés : 2"' '[ "$(grep -c "^  ✓" "$CAS/sortie")" = 12 ]'
verif "… et ce qui reste à faire à la main : Google, @BotFather, phrase du coffre, clé de la voix ; le retour passe par « Reconnecter » et les invitations" tous 'vu "Reste à faire à la main"' 'vu "compte Google"' 'vu "une copie prise avant resterait valable"' 'vu "@BotFather"' 'vu "jarvis-coffre changer-phrase"' 'vu "Clé de la voix Google"' 'vu "recréer les invitations"' 'vu "accès Google gardé par le serveur : oui ; invitations : 4"'
verif "… aucun jeton dans ce qui est affiché" tous '! vu "jvf_"' '! vu "INVENTE"'
depart; lancer coquille
verif "coquille sans terminal ni --oui : refus, rien n'est fait" tous '[ $RC = 1 ]' 'vu "Rien n.a été fait"' '[ -z "$(actes)" ]' intact
depart; terminal coquille coquille
verif "coquille dans un terminal, mauvais mot (« coquille ») : la question est posée, refus, rien n'est fait" tous '[ $RC = 1 ]' 'vu "Tape COQUILLE pour confirmer"' 'vu "Mot différent : rien n.a été fait"' '[ -z "$(actes)" ]' intact
depart; terminal COQUILLE coquille
verif "coquille dans un terminal, le mot COQUILLE : tout est fait" tous '[ $RC = 0 ]' 'vu "Tape COQUILLE pour confirmer"' coquille_faite
depart; rm -f "$CAS/connecte-jarvis" "$CAS/connecte-hermes" "$CAS/home/jarvis/.claude/.credentials.json" "$CAS/home/hermes/.claude/.credentials.json"; lancer coquille --oui
verif "Claude Code déjà déconnecté (logout répond « Not logged in », code 1) : ce n'est pas un échec" tous '[ $RC = 0 ]' '! vu "ÉCHEC"' 'vu "✓ Claude Code déconnecté pour jarvis"' 'vu "✓ Claude Code déconnecté pour hermes"'
depart; printf 'jarvis-coffre fermer\nstop hermes-gateway\nclaude-jarvis auth logout\n' > "$CAS/echecs"; lancer coquille --oui
verif "trois étapes en échec (coffre, arrêt d'Hermes, logout de jarvis) : les suivantes sont faites quand même, jusqu'à la relance de JARVIS" tous 'grep -q -- "--vider" "$CAS/appels"' '[ -e "$CAS/vide" ]' '[ ! -e "$CAS/etc/jarvis.env" ]' \
  '[ ! -e "$CAS/connecte-hermes" ]' '[ "$(cat "$CAS/demarrage")" = disabled ]' '[ "$(actes | tail -1)" = "systemctl start jarvis" ]'
verif "… logout de jarvis en échec : son fichier des accès est effacé, mais Claude se dit encore connecté, donc l'échec est dit" tous '[ ! -e "$CAS/home/jarvis/.claude/.credentials.json" ]' 'vu "ÉCHEC : Claude Code déconnecté pour jarvis"'
verif "… les trois échecs sont redits à la fin, code de sortie 1" tous '[ $RC = 1 ]' 'vu "^ÉCHECS (3)"' '[ "$(sed -n "/^ÉCHECS/,\$p" "$CAS/sortie" | grep -c "^  - ")" = 3 ]' 'sed -n "/^ÉCHECS/,\$p" "$CAS/sortie" | grep -q "  - Hermes arrêté"'
depart; echo 'restart jarvis' > "$CAS/echecs"; lancer verrouiller
verif "verrouiller, relance de JARVIS en échec : Hermes est arrêté quand même, code 1" tous '[ $RC = 1 ]' '[ "$(cat "$CAS/actif-hermes-gateway")" = inactive ]' 'vu "^ÉCHECS (1)"'
depart; echo 'urgence --vider' > "$CAS/echecs"; lancer coquille --oui
verif "vidage du serveur en échec (state.json illisible) : dit, le reste est fait, code 1" tous '[ $RC = 1 ]' 'vu "ÉCHEC : appareils"' '[ ! -e "$CAS/etc/jarvis.env" ]' '[ ! -e "$CAS/connecte-hermes" ]'

echo "== autour"
depart; printf 'jarvis.service\n' > "$CAS/unites"; rm -f "$CAS/home/hermes/.claude/.credentials.json"; rmdir "$CAS/home/hermes/.claude" "$CAS/home/hermes"
URGENCE_COFFRE="$F/absent" lancer coquille --oui
verif "ni coffre ni Hermes installés : dit, sans échec ; JARVIS est vidé et relancé" tous '[ $RC = 0 ]' 'vu "jarvis-coffre n.est pas installé"' 'vu "Hermes : pas installé"' 'vu "pas d.utilisateur hermes"' \
  'ordre "systemctl stop jarvis" "node[JARVIS_DATA=$CAS/donnees] /faux/server.mjs urgence --vider" "claude-jarvis auth logout" "systemctl start jarvis"'
depart; echo inactive > "$CAS/actif-hermes-garde.timer"; lancer verrouiller
verif "garde du forfait pas en marche : elle n'est ni arrêtée ni lancée" ordre "jarvis-coffre fermer" "systemctl restart jarvis" "systemctl stop hermes-gateway.service"
mauvais() { local a; depart; for a in "" "tout" "etat --oui" "verrouiller --oui" "coquille --non" "coquille --oui encore"; do lancer $a; [ $RC = 2 ] && vu "urgence.sh coquille" && [ ! -s "$CAS/appels" ] || return 1; done; }
verif "commande absente, inconnue ou option en trop : mode d'emploi, code 2, rien n'est appelé" mauvais
depart; lancer installer
verif "installer : une copie exécutable (0755), identique, à l'endroit prévu" tous '[ $RC = 0 ]' 'cmp -s "$OUTIL" "$CAS/sbin/jarvis-urgence"' '[ "$(stat -c %a "$CAS/sbin/jarvis-urgence")" = 755 ]'
depart; URGENCE_BANC=0 lancer etat
if [ "$(id -u)" = 0 ]; then echo "  – (banc lancé en root : le refus hors root n'est pas vérifiable ici)"
else verif "hors root (sans URGENCE_BANC) : refus avant tout appel" tous '[ $RC = 1 ]' 'vu "À lancer en root"' '[ ! -s "$CAS/appels" ]'; fi
verif "code du script : aucun secret saisi (pas de read -s, aucun jeton lu), pas d'arrêt au premier échec (pas de set -e)" tous '! grep -q "read -r -s\|TOKEN=\|set -e" "$OUTIL"' 'grep -q "^set -uo pipefail" "$OUTIL"'

echo; echo "Arrêt d'urgence : $ok vérifications réussies, $ko en échec."
[ $ko = 0 ]
