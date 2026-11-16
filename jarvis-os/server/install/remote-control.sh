#!/bin/bash
# JARVIS OS — Remote Control : le serveur apparaît dans l'app Claude (onglet Code) ; Claude Code peut l'administrer,
# chaque commande demandant ton accord dans l'app. À lancer en root, après « sudo claude auth login » (connexion de root)
# et un premier essai à la main de « sudo claude remote-control » (accepter ce qu'il demande, puis Ctrl+C).
set -euo pipefail
mkdir -p /root/serveur
cat > /root/serveur/CLAUDE.md <<'NOTE'
# Serveur JARVIS OS (OVHcloud VPS-1, Ubuntu)
- Services : `jarvis` (serveur Node, utilisateur jarvis, /opt/rd/jarvis-os/server, port 8787), `caddy` (HTTPS, /etc/caddy/Caddyfile), `jarvis-rc` (ce Remote Control, root).
- Dépôt : /opt/rd (public, appartient à jarvis). Données : /home/jarvis/.jarvis (state.json : mémoire, missions, jetons en empreinte).
- Mise à jour : bouton « Mettre à jour le serveur » de l'app, ou `sudo -u jarvis git -C /opt/rd pull --ff-only && systemctl restart jarvis`.
- Règles : ne jamais définir ANTHROPIC_API_KEY ni ANTHROPIC_AUTH_TOKEN (facturation de l'API) ; aucune donnée personnelle dans le dépôt ;
  demander avant un redémarrage, une suppression ou un changement de pare-feu.
NOTE
cat > /etc/systemd/system/jarvis-rc.service <<'UNIT'
[Unit]
Description=JARVIS OS : Remote Control de Claude Code (administration du serveur)
After=network-online.target
[Service]
User=root
WorkingDirectory=/root/serveur
ExecStart=/usr/bin/claude remote-control --name "Serveur JARVIS" --permission-mode default
UnsetEnvironment=ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL
Restart=on-failure
RestartSec=10
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now jarvis-rc
sleep 5
systemctl --no-pager status jarvis-rc | head -12
echo "Si le service est « active (running) », le serveur apparaît dans l'app Claude, onglet Code, sous « Serveur JARVIS »."
