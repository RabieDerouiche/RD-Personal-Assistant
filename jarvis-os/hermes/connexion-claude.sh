#!/bin/bash
# JARVIS OS — relier le Claude Code d'Hermes à l'abonnement Claude du propriétaire (étape 1b, docs/hermes.md).
#
#   sudo bash /opt/rd/jarvis-os/hermes/connexion-claude.sh
#
# À lancer dans Termius (SSH) : la connexion affiche une adresse à ouvrir sur l'iPhone, puis demande de
# coller le code obtenu. La connexion est celle de l'utilisateur hermes (/home/hermes/.claude), jamais
# celle de JARVIS (on ne copie pas l'une dans l'autre : les jetons tournants se casseraient l'un l'autre).
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "À lancer en root : sudo bash $0"; exit 1; }
CLAUDE=/home/hermes/.local/lib/claude-code/node_modules/.bin/claude
[ -x "$CLAUDE" ] || { echo "Claude Code d'Hermes absent : lance d'abord install.sh."; exit 1; }
[ -t 0 ] || { echo "Il faut un vrai terminal (Termius), pas une commande lancée par une autre session."; exit 1; }
lancer() { (cd /home/hermes && runuser -u hermes -- env -i HOME=/home/hermes USER=hermes LOGNAME=hermes LANG=C.UTF-8 TERM="${TERM:-xterm}" PATH=/usr/bin:/bin DISABLE_AUTOUPDATER=1 "$CLAUDE" "$@"); }

if lancer auth status 2>/dev/null | grep -qi '"loggedIn": *true\|logged in'; then
  echo "Le Claude Code d'Hermes est déjà relié :"; lancer auth status || true
  read -r -p "Le relier à nouveau ? (o/N) " r; [ "${r:-n}" = o ] || exit 0
fi
echo "Connexion avec ton abonnement Claude (le compte de ton forfait Max)."
lancer auth login --claudeai
echo; lancer auth status || true
cat <<FIN

Rappel (une fois) : dans claude.ai, Réglages, Facturation (« Settings », « Billing » : noms devinés),
vérifie que l'usage supplémentaire payant (« extra usage ») est coupé. Hermes s'arrête de toute façon à la
limite du forfait (extra_usage: stop), mais c'est le réglage du compte qui fait foi.
Étape suivante : sudo bash /opt/rd/jarvis-os/hermes/telegram.sh
FIN
