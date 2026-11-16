#!/bin/bash
# JARVIS OS — installation du serveur (Ubuntu 26.04 ou 24.04 LTS). À lancer en root ; relançable sans risque (mise à jour).
# Installe Node 22, Claude Code (programme officiel), le serveur JARVIS (service « jarvis »), Caddy pour le HTTPS
# avec une adresse <ip>.sslip.io, et un pare-feu (SSH, 80, 443). Aucune clé d'API n'est installée ni demandée.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
REPO=https://github.com/RabieDerouiche/RD-Personal-Assistant.git
apt-get update -y
apt-get install -y curl git ca-certificates gnupg ufw
if ! command -v node >/dev/null || ! node -v | grep -qE '^v(2[2-9]|[3-9][0-9])'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
npm install -g @anthropic-ai/claude-code
id jarvis >/dev/null 2>&1 || useradd -m -s /bin/bash jarvis
# le service (utilisateur jarvis) doit pouvoir se mettre à jour lui-même : le dépôt lui appartient
if [ -d /opt/rd/.git ]; then chown -R jarvis:jarvis /opt/rd; sudo -u jarvis git -C /opt/rd pull --ff-only; else git clone --depth 1 "$REPO" /opt/rd; chown -R jarvis:jarvis /opt/rd; fi
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi
IP=$(curl -fsS4 https://api.ipify.org || hostname -I | awk '{print $1}')
HOST="$(echo "$IP" | tr . -).sslip.io"
cat > /etc/caddy/Caddyfile <<CADDY
$HOST {
	encode gzip
	reverse_proxy 127.0.0.1:8787 {
		flush_interval -1
	}
}
CADDY
systemctl restart caddy
cat > /etc/systemd/system/jarvis.service <<UNIT
[Unit]
Description=JARVIS OS (serveur)
After=network-online.target
[Service]
User=jarvis
WorkingDirectory=/opt/rd/jarvis-os/server
ExecStart=/usr/bin/node server.mjs
Environment=PORT=8787 HOST=127.0.0.1 JARVIS_DATA=/home/jarvis/.jarvis JARVIS_PUBLIC_URL=https://$HOST
UnsetEnvironment=ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL
Restart=always
RestartSec=3
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable jarvis
systemctl restart jarvis
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
sudo -u jarvis env HOME=/home/jarvis JARVIS_DATA=/home/jarvis/.jarvis JARVIS_PUBLIC_URL="https://$HOST" node /opt/rd/jarvis-os/server/server.mjs pair > /root/jarvis-code.txt
cat > /etc/motd <<MOTD

  JARVIS OS — adresse du serveur : https://$HOST
  1. Connecter Claude à ton abonnement :   sudo -iu jarvis claude auth login
  2. Code pour relier l'iPhone :            cat /root/jarvis-code.txt
     (nouveau code : sudo -iu jarvis node /opt/rd/jarvis-os/server/server.mjs pair)
  Mise à jour : bouton « Mettre à jour le serveur » dans l'app (Réglages)

MOTD
echo "Installation terminée : https://$HOST"
