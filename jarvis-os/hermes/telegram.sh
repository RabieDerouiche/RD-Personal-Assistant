#!/bin/bash
# JARVIS OS — brancher Hermes sur le bot Telegram du propriétaire, puis le démarrer (étape 2, docs/hermes.md).
#
#   sudo bash /opt/rd/jarvis-os/hermes/telegram.sh
#
# À lancer dans Termius (SSH) : le jeton du bot se tape (ou se colle) sans s'afficher et ne passe par
# aucune conversation. Il reste dans /home/hermes/.hermes/.env (0600, utilisateur hermes). Ton
# identifiant Telegram (un nombre, pas un secret) est imposé par root dans /etc/hermes/.env : Hermes ne
# répond qu'à lui et ignore tous les autres, sans même leur envoyer de code.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "À lancer en root : sudo bash $0"; exit 1; }
[ -t 0 ] || { echo "Il faut un vrai terminal (Termius) : le jeton se tape ici, jamais dans une conversation."; exit 1; }
ENV_H=/home/hermes/.hermes/.env
[ -f /etc/hermes/config.yaml ] && [ -f "$ENV_H" ] || { echo "Hermes n'est pas installé : lance d'abord install.sh."; exit 1; }
CLAUDE=/home/hermes/.local/lib/claude-code/node_modules/.bin/claude
if ! (cd /home/hermes && runuser -u hermes -- env -i HOME=/home/hermes USER=hermes PATH=/usr/bin:/bin "$CLAUDE" auth status 2>/dev/null) | grep -q '"loggedIn": *true'; then
  echo "Le Claude Code d'Hermes n'est pas relié à ton abonnement : lance d'abord connexion-claude.sh."; exit 1
fi

cat <<'AIDE'
Dans Telegram, sur ton iPhone :
  1. @BotFather : /newbot, un nom, puis un identifiant qui finit par « bot ». Il te donne un jeton.
  2. Toujours chez @BotFather : /setjoingroups, ton bot, « Disable » (personne ne pourra l'ajouter à un groupe).
  3. @userinfobot : il te répond avec ton identifiant (un nombre, par exemple 123456789).
AIDE
read -r -s -p "Jeton du bot (il ne s'affiche pas) : " JETON; echo
[[ "$JETON" =~ ^[0-9]{6,12}:[A-Za-z0-9_-]{30,}$ ]] || { echo "Ce n'est pas un jeton de bot Telegram."; exit 1; }
read -r -p "Ton identifiant Telegram (le nombre de @userinfobot) : " MOI
[[ "$MOI" =~ ^[0-9]{5,15}$ ]] || { echo "L'identifiant est un nombre (5 à 15 chiffres)."; exit 1; }

# Vérifie le jeton auprès de Telegram, sans le mettre sur une ligne de commande (lisible par tous dans ps)
reponse=$(printf 'url = "https://api.telegram.org/bot%s/getMe"\nsilent\nmax-time = 20\n' "$JETON" | curl -K - || true)
nom=$(printf '%s' "$reponse" | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')
[ -n "$nom" ] || { echo "Telegram refuse ce jeton (ou n'est pas joignable). Rien n'a été changé."; exit 1; }
echo "Bot reconnu : @$nom"

# Le jeton : écrit par des commandes internes du shell (jamais en argument d'un programme)
tmp=$(mktemp); chmod 600 "$tmp"
grep -v '^TELEGRAM_BOT_TOKEN=' "$ENV_H" > "$tmp" || true
printf 'TELEGRAM_BOT_TOKEN=%s\n' "$JETON" >> "$tmp"
install -o hermes -g hermes -m 0600 "$tmp" "$ENV_H"; rm -f "$tmp"; unset JETON reponse

# L'identifiant autorisé : imposé par root
grep -v '^TELEGRAM_ALLOWED_USERS=' /etc/hermes/.env > /etc/hermes/.env.nouveau || true
echo "TELEGRAM_ALLOWED_USERS=$MOI" >> /etc/hermes/.env.nouveau
mv /etc/hermes/.env.nouveau /etc/hermes/.env && chown root:root /etc/hermes/.env && chmod 0644 /etc/hermes/.env

systemctl enable --now hermes-sortie.service >/dev/null
systemctl enable hermes-gateway.service >/dev/null 2>&1
LOG=/home/hermes/.hermes/logs/gateway.log
avant=$(stat -c %s "$LOG" 2>/dev/null || echo 0)
systemctl restart hermes-gateway.service
connecte() { tail -c +"$((avant + 1))" "$LOG" 2>/dev/null | grep -q "telegram connected"; }
for i in $(seq 1 60); do connecte && break; sleep 1; done
if connecte; then
  echo "Hermes est en ligne. Écris « bonjour » à @$nom dans Telegram."
else
  echo "Hermes ne s'est pas encore connecté. Regarde : sudo journalctl -u hermes-gateway -n 50 --no-pager"
fi
echo "Contrôle complet : sudo bash /opt/rd/jarvis-os/hermes/diagnostic.sh"
