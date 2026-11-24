#!/bin/bash
# JARVIS OS — arrêt d'urgence (docs/hermes-deroule.md, « La passkey, le verrou de l'app et l'arrêt d'urgence »).
# Sa demande du 24/11/2026 : pouvoir à tout moment tout déconnecter, JARVIS devient « une coquille vide ».
#
#   sudo bash /opt/rd/jarvis-os/server/install/urgence.sh etat               (lecture seule : ne change rien)
#   sudo bash /opt/rd/jarvis-os/server/install/urgence.sh verrouiller        (niveau 1, réversible)
#   sudo bash /opt/rd/jarvis-os/server/install/urgence.sh coquille [--oui]   (niveau 2 : tout est déconnecté)
#   sudo bash /opt/rd/jarvis-os/server/install/urgence.sh installer          (copie à root : sudo jarvis-urgence …)
#
# À lancer par lui dans un terminal (Termius, console de l'hébergeur), ou par la session d'administration du serveur
# à sa demande (« coquille --oui » : sans terminal, pas de question). Aucun secret n'est saisi ni affiché.
#
# Niveau 1, dans l'ordre : coffre fermé (clé effacée de la mémoire) ; service jarvis relancé (rien de déverrouillé ne
# reste dans sa mémoire) ; Hermes arrêté. La garde du forfait (hermes-garde-forfait) ne relance qu'un Hermes qu'elle
# a arrêté elle-même, ce qu'elle reconnaît à sa marque /var/lib/hermes-garde/arret : si Hermes était déjà en pause
# pour le forfait, elle le relancerait à la remise à zéro. La marque est donc retirée, la garde suspendue le temps
# de l'arrêt (un passage en cours ne peut pas la reposer), puis remise : elle voit un Hermes arrêté à la main.
# Niveau 2 : le niveau 1 (jarvis arrêté au lieu de relancé : un serveur en marche réécrirait son état), puis Hermes
# retiré du démarrage ; appareils reliés, sessions de l'app, clé du Raccourci, code d'appairage et assistants MCP
# retirés, avec l'accès Google gardé par le serveur et les invitations (`node server.mjs urgence --vider`, sous
# l'utilisateur jarvis, qui relit l'état écrit et le recompte : 0 attendu) ; Claude Code déconnecté pour jarvis et
# pour hermes ; jetons d'Hermes vers JARVIS effacés ; jarvis relancé, vide.
# Une étape qui échoue n'arrête pas les suivantes : elle est redite à la fin, et le code de sortie est 1.
#
# Ce fichier du dépôt appartient à l'utilisateur jarvis : « installer » en pose une copie à root dans
# /usr/local/sbin/jarvis-urgence, que jarvis ne peut pas modifier ; c'est elle qu'il faut lancer ensuite.
# Remplaçables par l'environnement, pour le banc (tests/urgence.test.sh) : URGENCE_SYSTEMCTL, URGENCE_COFFRE,
# URGENCE_EN (« <utilisateur> commande… »), URGENCE_NODE, URGENCE_SERVEUR, URGENCE_DONNEES, URGENCE_CLAUDE_JARVIS,
# URGENCE_CLAUDE_HERMES, URGENCE_HOMES, URGENCE_JETONS_HERMES, URGENCE_MARQUE_GARDE, URGENCE_CIBLE, URGENCE_BANC=1.
set -uo pipefail
PATH=/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin

COFFRE=${URGENCE_COFFRE:-/usr/local/sbin/jarvis-coffre}
NODE=${URGENCE_NODE:-/usr/bin/node}
SERVEUR=${URGENCE_SERVEUR:-/opt/rd/jarvis-os/server/server.mjs}
HOMES=${URGENCE_HOMES:-/home}
CLAUDE_JARVIS=${URGENCE_CLAUDE_JARVIS:-claude}
CLAUDE_HERMES=${URGENCE_CLAUDE_HERMES:-$HOMES/hermes/.local/lib/claude-code/node_modules/.bin/claude}
JETONS_HERMES=${URGENCE_JETONS_HERMES:-/etc/hermes/jarvis.env}
MARQUE_GARDE=${URGENCE_MARQUE_GARDE:-/var/lib/hermes-garde/arret}
CIBLE=${URGENCE_CIBLE:-/usr/local/sbin/jarvis-urgence}

usage() { sed -n '5,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,3\}//'; exit 2; }
sctl() { if [ -n "${URGENCE_SYSTEMCTL:-}" ]; then "$URGENCE_SYSTEMCTL" "$@"; else systemctl "$@"; fi; }
unite() { sctl cat "$1" > /dev/null 2>&1; }   # l'unité existe
en() {   # en <utilisateur> commande… : sous cet utilisateur, dans un environnement neuf (ni variable ni jeton hérités)
  local u=$1; shift
  if [ -n "${URGENCE_EN:-}" ]; then "$URGENCE_EN" "$u" "$@"; return; fi
  (cd "$HOMES/$u" && runuser -u "$u" -- env -i HOME="$HOMES/$u" USER="$u" LOGNAME="$u" LANG=C.UTF-8 PATH=/usr/local/bin:/usr/bin:/bin DISABLE_AUTOUPDATER=1 "$@")
}
donnees() {   # le dossier de données du service jarvis (JARVIS_DATA de son unité ; à défaut celui de setup.sh)
  local d=${URGENCE_DONNEES:-}
  [ -n "$d" ] || d=$(sctl show jarvis -p Environment --value 2> /dev/null | tr ' ' '\n' | sed -n 's/^JARVIS_DATA=//p' | head -1)
  printf '%s' "${d:-$HOMES/jarvis/.jarvis}"
}
etat_jarvis() { en jarvis env JARVIS_DATA="$(donnees)" "$NODE" "$SERVEUR" urgence "$1"; }   # --etat ou --vider : une ligne JSON de comptes
compte() { printf '%s' "$1" | sed -n "s/.*\"$2\":\([0-9][0-9]*\).*/\1/p" | head -1; }
comptes() {   # comptes <ligne JSON> : en clair, sans jamais un jeton (la ligne n'en porte pas)
  local j=$1
  echo "      appareils reliés : $(compte "$j" appareils) ; abonnements aux notifications : $(compte "$j" notifications) ; clé du Raccourci : $(compte "$j" raccourci) ; code d'appairage en attente : $(compte "$j" appairage)"
  echo "      MCP : $(compte "$j" mcp_clients) assistant(s) inscrit(s), $(compte "$j" mcp_jetons) jeton(s) d'accès ou de renouvellement, $(compte "$j" mcp_fixes) jeton(s) fixe(s)"
  echo "      accès Google gardé par le serveur : $([ "$(compte "$j" google)" = 1 ] && echo oui || echo non) ; invitations : $(compte "$j" invitations)"
}
deconnecter() {   # deconnecter <utilisateur> <claude> : « déjà déconnecté » n'est pas un échec, c'est l'état relu qui compte
  local u=$1 c=$2 acces="$HOMES/$1/.claude/.credentials.json"
  en "$u" "$c" auth logout > /dev/null 2>&1
  [ ! -e "$acces" ] || en "$u" rm -f -- "$acces"   # s'il reste (logout en échec, Claude Code absent) : le fichier des accès est effacé
  ! en "$u" "$c" auth status 2> /dev/null | grep -q '"loggedIn": *true'
}

RATES=(); SORTIE=""
etape() {   # etape <ce qui est fait> commande… : dit le résultat, garde la sortie dans SORTIE, ne s'arrête jamais
  local nom=$1 rc; shift
  SORTIE=$("$@" 2>&1); rc=$?
  if [ $rc = 0 ]; then echo "  ✓ $nom"; else echo "  ✗ ÉCHEC : $nom (code $rc)"; RATES+=("$nom"); fi
}
niveau1() {   # niveau1 <restart|stop> : ce que subit le service jarvis (relancé au niveau 1, arrêté le temps du niveau 2)
  local garde=0
  if [ -x "$COFFRE" ]; then etape "coffre fermé : sa clé est effacée de la mémoire" "$COFFRE" fermer
  else echo "  – coffre : jarvis-coffre n'est pas installé, rien à fermer"; fi
  if [ "$1" = restart ]; then etape "JARVIS relancé : rien de déverrouillé ne reste dans sa mémoire" sctl restart jarvis
  else etape "JARVIS arrêté" sctl stop jarvis; fi
  if unite hermes-gateway.service; then
    [ "$(sctl is-active hermes-garde.timer 2> /dev/null)" = active ] && garde=1
    [ $garde = 0 ] || etape "garde du forfait suspendue le temps de l'arrêt" sctl stop hermes-garde.timer hermes-garde.service
    etape "Hermes arrêté" sctl stop hermes-gateway.service
    etape "marque de pause de la garde du forfait retirée : elle ne relancera pas Hermes" rm -f -- "$MARQUE_GARDE"
    [ $garde = 0 ] || etape "garde du forfait remise en marche (Hermes arrêté à la main : elle n'y touche plus)" sctl start hermes-garde.timer
  else echo "  – Hermes : pas installé, rien à arrêter"; fi
}
bilan() {
  [ ${#RATES[@]} = 0 ] && return 0
  echo; echo "ÉCHECS (${#RATES[@]}) : à refaire à la main, ou relance cette commande :"
  local r; for r in "${RATES[@]}"; do echo "  - $r"; done
  return 1
}

commande=${1:-}; [ $# -gt 0 ] && shift
OUI=0
case "$commande" in
  coquille) [ $# = 0 ] || { [ $# = 1 ] && [ "$1" = --oui ] && OUI=1; } || usage ;;
  etat|verrouiller|installer) [ $# = 0 ] || usage ;;
  *) usage ;;
esac
[ "$(id -u)" = 0 ] || [ "${URGENCE_BANC:-0}" = 1 ] || { echo "À lancer en root : sudo bash $0 $commande"; exit 1; }

case "$commande" in
  installer)
    install -o "$(id -u)" -g "$(id -g)" -m 0755 "${BASH_SOURCE[0]}" "$CIBLE" || { echo "Copie impossible vers $CIBLE."; exit 1; }
    echo "Posé : $CIBLE (à root). Désormais : sudo jarvis-urgence etat | verrouiller | coquille" ;;
  etat)
    echo "État (lecture seule, rien n'est changé) :"
    if [ -x "$COFFRE" ]; then echo "  $("$COFFRE" etat 2>&1 | head -1)"; else echo "  Coffre : jarvis-coffre n'est pas installé."; fi
    echo "  JARVIS (service jarvis) : $(sctl is-active jarvis 2> /dev/null || true)"
    if unite hermes-gateway.service; then
      echo "  Hermes (hermes-gateway) : $(sctl is-active hermes-gateway.service 2> /dev/null || true), au démarrage : $(sctl is-enabled hermes-gateway.service 2> /dev/null || true)$([ -e "$MARQUE_GARDE" ] && echo " ; en pause par la garde du forfait")"
    else echo "  Hermes : pas installé."; fi
    if j=$(etat_jarvis --etat 2> /dev/null) && [ -n "$(compte "$j" appareils)" ]; then
      echo "  Ce qui ouvre JARVIS de l'extérieur :"; comptes "$j"
    else echo "  Appareils et assistants MCP : illisibles (node $SERVEUR urgence --etat, sous l'utilisateur jarvis)."; fi
    echo "  Jetons d'Hermes vers JARVIS ($JETONS_HERMES) : $([ -e "$JETONS_HERMES" ] && echo présents || echo absents)" ;;
  verrouiller)
    echo "Arrêt d'urgence, niveau 1 (verrouiller) :"
    niveau1 restart
    cat <<FIN

Pour revenir :
  1. Ouvrir le coffre : depuis l'app JARVIS, ou dans Termius : sudo jarvis-coffre ouvrir
  2. Relancer Hermes : sudo systemctl start hermes-gateway
Rien d'autre n'a été touché : appareils, assistants MCP et connexions de Claude Code sont intacts.
Pour tout déconnecter : sudo bash $0 coquille
FIN
    bilan ;;
  coquille)
    if [ $OUI = 0 ]; then
      [ -t 0 ] || { echo "Niveau 2 : à confirmer dans un terminal (le mot COQUILLE), ou à lancer avec --oui. Rien n'a été fait."; exit 1; }
      echo "Niveau 2, « coquille vide » : coffre fermé, Hermes arrêté et retiré du démarrage, tous les appareils et"
      echo "assistants MCP retirés, accès Google du serveur et invitations effacés, Claude Code déconnecté pour JARVIS et"
      echo "pour Hermes. Il faudra tout relier à nouveau."
      mot=""; read -r -p "Tape COQUILLE pour confirmer : " mot || mot=""
      [ "$mot" = COQUILLE ] || { echo "Mot différent : rien n'a été fait."; exit 1; }
    fi
    echo "Arrêt d'urgence, niveau 2 (coquille vide) :"
    niveau1 stop
    if unite hermes-gateway.service; then etape "Hermes retiré du démarrage" sctl disable hermes-gateway.service; fi
    etape "appareils, sessions de l'app, clé du Raccourci, code d'appairage, assistants MCP, accès Google et invitations retirés de JARVIS (état relu : il ne reste rien)" etat_jarvis --vider
    [ -z "$(compte "$SORTIE" appareils)" ] || { echo "    retirés :"; comptes "$SORTIE"; }
    for u in jarvis hermes; do
      c=$CLAUDE_JARVIS; [ $u = jarvis ] || c=$CLAUDE_HERMES
      if [ -d "$HOMES/$u" ]; then etape "Claude Code déconnecté pour $u" deconnecter "$u" "$c"
      else echo "  – Claude Code de $u : pas d'utilisateur $u ici"; fi
    done
    etape "jetons d'Hermes vers JARVIS effacés ($JETONS_HERMES)" rm -f -- "$JETONS_HERMES"
    etape "JARVIS relancé, vide : plus aucun appareil ni assistant n'y entre" sctl start jarvis
    cat <<FIN

Reste à faire à la main, ce script ne le peut pas :
  - Google : le jeton gardé par le serveur est effacé, mais une copie prise avant resterait valable. Retire l'accès
    de JARVIS dans ton compte Google (myaccount.google.com, Sécurité, accès des applications tierces : nom deviné),
    et, si le disque a pu être lu, change le secret du client dans la console Google (Clients).
  - Telegram : révoque le jeton du bot d'Hermes chez @BotFather (/revoke, puis le bot).
  - Phrase du coffre : si elle a pu être vue, change-la : sudo jarvis-coffre changer-phrase
  - Clé de la voix Google (synthèse vocale seulement) : elle reste sur le serveur ; si le disque a pu être lu,
    supprime-la dans la console Google (Identifiants).
Pour revenir ensuite : ouvrir le coffre (sudo jarvis-coffre ouvrir) ; relier l'iPhone avec le code neuf
(sudo -iu jarvis node $SERVEUR pair) ; dans Réglages, « Reconnecter » Google et recréer les invitations ;
reconnecter Claude Code (sudo -iu jarvis claude auth login ; pour Hermes : connexion-claude.sh) ; recréer les
jetons MCP (relier-jarvis.sh) ; sudo systemctl enable --now hermes-gateway
FIN
    bilan ;;
esac
