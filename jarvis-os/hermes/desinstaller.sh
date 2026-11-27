#!/bin/bash
# JARVIS OS — retirer Hermes du serveur (docs/hermes.md). Ne touche ni à JARVIS, ni à Panier, ni à Caddy, ni à ufw.
#
#   sudo bash /opt/rd/jarvis-os/hermes/desinstaller.sh            arrête Hermes et retire service, règles et politique
#   sudo bash /opt/rd/jarvis-os/hermes/desinstaller.sh --tout     et efface aussi l'utilisateur hermes et ses données
#                                                                 (mémoire, conversations, connexion Claude, jeton du bot)
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "À lancer en root : sudo bash $0"; exit 1; }
systemctl disable --now hermes-garde.timer 2>/dev/null || true
systemctl disable --now hermes-reveil.path 2>/dev/null || true
systemctl disable --now hermes-relance.timer 2>/dev/null || true
systemctl disable --now hermes-ordres.path 2>/dev/null || true
systemctl disable --now hermes-gateway.service 2>/dev/null || true
systemctl disable --now hermes-sortie.service 2>/dev/null || true
nft delete table inet hermes_sortie 2>/dev/null || true
rm -f /etc/systemd/system/hermes-gateway.service /etc/systemd/system/hermes-sortie.service /etc/systemd/system/hermes-garde.service /etc/systemd/system/hermes-garde.timer
rm -f /etc/systemd/system/hermes-reveil.service /etc/systemd/system/hermes-reveil.path /usr/local/sbin/hermes-reveil
rm -f /usr/local/sbin/hermes-garde-forfait; rm -rf /var/lib/hermes-garde
rm -f /etc/systemd/system/hermes-relance.service /etc/systemd/system/hermes-relance.timer /usr/local/sbin/hermes-relance; rm -rf /usr/local/lib/hermes-relance /var/lib/hermes-relance /var/lib/hermes-relance-avis /var/lib/hermes-relance-etat
rm -f /etc/systemd/system/hermes-ordres.service /etc/systemd/system/hermes-ordres.path /usr/local/sbin/hermes-ordres; rm -rf /var/lib/jarvis-reveil/ordres
systemctl daemon-reload
rm -rf /etc/hermes
echo "Hermes est arrêté ; service, garde du forfait, règles réseau et politique retirés."
if [ "${1:-}" = "--tout" ]; then
  read -r -p "Effacer aussi /home/hermes (mémoire, conversations, connexion Claude, jeton du bot) ? Taper EFFACER : " r
  if [ "$r" = EFFACER ]; then
    pkill -u hermes 2>/dev/null || true
    userdel -r hermes 2>/dev/null || { userdel hermes 2>/dev/null || true; rm -rf /home/hermes; }
    echo "Utilisateur hermes et ses données effacés. Pense à révoquer le bot chez @BotFather (/revoke) si tu ne le réutilises pas."
  else
    echo "Données gardées dans /home/hermes."
  fi
fi
