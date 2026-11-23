#!/bin/bash
# JARVIS OS — Hermes Agent en essai sur le serveur (décidé le 23/11/2026 ; docs/hermes.md).
#
#   sudo bash /opt/rd/jarvis-os/hermes/install.sh
#
# Relançable sans risque : il remet la politique, le service et les règles réseau à jour, et change de
# version seulement si HERMES_COMMIT a changé ici. Il ne touche ni à JARVIS, ni à Panier, ni à Caddy,
# ni à ufw, et n'ouvre aucun port. Il ne démarre pas Hermes : c'est telegram.sh qui le fait, une fois
# Claude relié (connexion-claude.sh) et le bot Telegram créé.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# ---- versions figées (relues avant chaque changement : journal des versions d'Hermes, du plugin, de Claude Code)
HERMES_VERSION=v0.23.3
HERMES_COMMIT=caafe5389ae585ef77387a962aee05b1bcf17029            # tag v0.23.3 (19/11/2026)
HERMES_INSTALLEUR_SHA256=c73dad4dcf7c9ecadb98578e28cc763d23d7be3fa1b513545319038795493214   # scripts/install.sh à ce commit
PLUGIN_CATALOGUE=claude-subscription-directsdk                     # catalogue d'Hermes v0.23.3 : commit 72eb3b8, v0.4.0
PLUGIN_ID=claude-subscription-directsdk-experimental
CLAUDE_CODE_VERSION=2.1.330
SEUIL_FORFAIT=85                                                   # garde du forfait partagé (son choix du 23/11/2026)
GARDE_CINQ_HEURES=0        # 0 : le garde ne regarde que la semaine (sa demande du 23/11/2026 : il remplit la fenêtre de 5 heures en testant) ; 1 : elle compte aussi

ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
U=hermes
H=/home/$U
HH=$H/.hermes
CC=$H/.local/lib/claude-code
BANC=${HERMES_BANC:-0}   # 1 = banc d'essai (conteneur sans systemd) : ni service ni règles réseau chargés

dire() { printf '\n== %s\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "À lancer en root : sudo bash $0"; exit 1; }

# Ce qui est transmis à l'utilisateur hermes : un environnement propre (jamais celui de root), plus le
# proxy et les certificats s'il y en a (banc d'essai seulement ; le serveur n'en a pas).
NPM_DIR=$(dirname "$(command -v npm 2>/dev/null || echo /usr/bin/npm)")
passe=()
for v in HTTPS_PROXY https_proxy NO_PROXY no_proxy SSL_CERT_FILE REQUESTS_CA_BUNDLE CURL_CA_BUNDLE NODE_EXTRA_CA_CERTS GIT_SSL_CAINFO UV_NATIVE_TLS npm_config_cafile; do
  [ -n "${!v:-}" ] && passe+=("$v=${!v}")
done
comme_hermes() {   # runuser plutôt que sudo : même comportement avec le sudo-rs d'Ubuntu 26.04
  (cd "$H" && runuser -u "$U" -- env -i HOME="$H" USER="$U" LOGNAME="$U" LANG=C.UTF-8 \
    PATH="$H/.local/bin:$NPM_DIR:/usr/local/bin:/usr/bin:/bin" HERMES_HOME="$HH" HERMES_MANAGED_DIR=/etc/hermes \
    "${passe[@]}" "$@")
}

dire "Vérifications"
libre=$(df -BG --output=avail /home | tail -1 | tr -dc 0-9)
[ "$libre" -ge 5 ] || { echo "Il faut 5 Go libres sur /home pour Hermes (il y en a $libre)."; exit 1; }
echo "Disque libre : $libre Go (Hermes en prend environ 3)."
echo "Mémoire disponible maintenant : $(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo) Mo (Hermes : environ 350 Mo, plus 250 Mo pendant une réponse)."
command -v npm >/dev/null || { echo "npm introuvable (installé par setup.sh de JARVIS)."; exit 1; }

dire "Paquets du système"
if [ "$BANC" != 1 ]; then apt-get update -q; fi
apt-get install -y -q git curl tar coreutils ca-certificates libatomic1 nftables >/dev/null

dire "Utilisateur $U (sans mot de passe, sans shell, sans sudo)"
id "$U" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$H" --shell /usr/sbin/nologin "$U"
chmod 700 "$H"
for g in sudo adm docker lxd wheel jarvis; do
  if id -nG "$U" | tr ' ' '\n' | grep -qx "$g"; then echo "Refus : $U ne doit pas être dans le groupe $g."; exit 1; fi
done
if [ -d /home/jarvis ] && [ "$(stat -c %a /home/jarvis | cut -c3)" != 0 ]; then
  echo "Attention : /home/jarvis est lisible par les autres utilisateurs ($(stat -c %a /home/jarvis)). Le service d'Hermes ne le voit pas (ProtectHome), mais mieux vaut : chmod 750 /home/jarvis"
fi

dire "Hermes $HERMES_VERSION (installeur officiel vérifié par son empreinte, lancé en tant que $U)"
deja=""
[ -d "$HH/hermes-agent/.git" ] && deja=$(comme_hermes git -C "$HH/hermes-agent" rev-parse HEAD 2>/dev/null || true)
if [ "$deja" != "$HERMES_COMMIT" ]; then
  tmp=$(mktemp)
  curl -fsSL -o "$tmp" "https://raw.githubusercontent.com/NousResearch/hermes-agent/$HERMES_COMMIT/scripts/install.sh"
  echo "$HERMES_INSTALLEUR_SHA256  $tmp" | sha256sum -c --quiet - || { echo "Empreinte de l'installeur différente : arrêt."; rm -f "$tmp"; exit 1; }
  install -o "$U" -g "$U" -m 0644 "$tmp" "$H/.installeur-hermes.sh"; rm -f "$tmp"
  comme_hermes bash "$H/.installeur-hermes.sh" --commit "$HERMES_COMMIT" --non-interactive --skip-browser --skip-computer-use --hermes-home "$HH"
else
  echo "Déjà à $HERMES_VERSION."
fi
comme_hermes hermes --version | head -1

dire "Telegram (installé maintenant : rien ne s'installe ensuite pendant que le service tourne)"
comme_hermes hermes pm install --extra messaging | tail -1

dire "Plugin de l'abonnement Claude ($PLUGIN_CATALOGUE, épinglé par le catalogue d'Hermes)"
[ -d "$HH/plugins/$PLUGIN_ID" ] || comme_hermes hermes plugins install "$PLUGIN_CATALOGUE" | tail -2
comme_hermes hermes plugins enable "$PLUGIN_ID" | tail -1

dire "Claude Code $CLAUDE_CODE_VERSION pour $U (séparé de celui de JARVIS)"
if [ "$(comme_hermes "$CC/node_modules/.bin/claude" --version 2>/dev/null | cut -d' ' -f1)" != "$CLAUDE_CODE_VERSION" ]; then
  comme_hermes mkdir -p "$CC"
  comme_hermes npm install --prefix "$CC" --no-fund --no-audit --omit=dev "@anthropic-ai/claude-code@$CLAUDE_CODE_VERSION" | tail -1
fi
comme_hermes "$CC/node_modules/.bin/claude" --version
comme_hermes ln -sfn "$CC/node_modules/.bin/claude" "$H/.local/bin/claude"   # trouvé par tout appel d'Hermes (PATH)

dire "Politique (root) : /etc/hermes"
install -d -o root -g root -m 0755 /etc/hermes
install -o root -g root -m 0644 "$ICI/politique.yaml" /etc/hermes/config.yaml
touch /etc/hermes/.env && chown root:root /etc/hermes/.env && chmod 0644 /etc/hermes/.env
autorises=$(sed -n 's/^TELEGRAM_ALLOWED_USERS=//p' /etc/hermes/.env | tail -1)   # posé par telegram.sh ; gardé ici
{
  echo "# JARVIS OS — valeurs imposées à Hermes (root ; lisible par tous : aucun secret ici)."
  echo "GATEWAY_ALLOW_ALL_USERS=false"
  echo "TELEGRAM_ALLOW_ALL_USERS=false"
  echo "HERMES_MEDIA_DELIVERY_STRICT=true"
  echo "HERMES_TELEGRAM_DISABLE_FALLBACK_IPS=true"
  [ -n "$autorises" ] && echo "TELEGRAM_ALLOWED_USERS=$autorises"
} > /etc/hermes/.env.nouveau
mv /etc/hermes/.env.nouveau /etc/hermes/.env && chmod 0644 /etc/hermes/.env
install -o "$U" -g "$U" -m 0600 "$ICI/SOUL.md" "$HH/SOUL.md"
# model.base_url reste au niveau de l'utilisateur (voir politique.yaml) : vidé, jamais OpenRouter
comme_hermes hermes config set model.base_url "" >/dev/null
comme_hermes hermes config check >/dev/null 2>&1 || echo "(hermes config check signale des avertissements : voir diagnostic.sh)"

dire "Service et règles réseau"
uid=$(id -u "$U")
sed "s/@UID@/$uid/g" "$ICI/sortie.nft" > /etc/hermes/sortie.nft
chmod 0644 /etc/hermes/sortie.nft
install -o root -g root -m 0644 "$ICI/hermes-sortie.service" /etc/systemd/system/hermes-sortie.service
# même PATH que l'unité officielle d'Hermes : son Node et son npm à lui (versions de son gestionnaire de paquets)
node_bin=$(ls -d "$HH"/tools/node-*/bin 2>/dev/null | sort -V | tail -1)
npm_bin=$(ls -d "$HH"/tools/npm-*/bin 2>/dev/null | sort -V | tail -1)
chemin="${node_bin:+$node_bin:}${npm_bin:+$npm_bin:}$HH/hermes-agent/node_modules/.bin:$H/.local/bin:/usr/local/bin:/usr/bin:/bin"
sed "s#@PATH@#$chemin#" "$ICI/hermes-gateway.service" > /etc/systemd/system/hermes-gateway.service
chmod 0644 /etc/systemd/system/hermes-gateway.service
# le garde du forfait : une copie root du script (la minuterie n'exécute jamais un fichier du dépôt)
install -o root -g root -m 0755 "$ICI/garde-forfait.sh" /usr/local/sbin/hermes-garde-forfait
printf 'HERMES_SEUIL_FORFAIT=%s\nHERMES_GARDE_CINQ_HEURES=%s\n' "$SEUIL_FORFAIT" "$GARDE_CINQ_HEURES" > /etc/hermes/garde.conf && chmod 0644 /etc/hermes/garde.conf
install -o root -g root -m 0644 "$ICI/hermes-garde.service" /etc/systemd/system/hermes-garde.service
install -o root -g root -m 0644 "$ICI/hermes-garde.timer" /etc/systemd/system/hermes-garde.timer
nft -c -f /etc/hermes/sortie.nft 2>/dev/null && echo "Règles réseau : syntaxe vérifiée." || [ "$BANC" = 1 ] || { echo "Règles réseau refusées par nft : arrêt."; exit 1; }
if [ "$BANC" != 1 ]; then
  systemctl daemon-reload
  systemctl enable --now hermes-sortie.service
  systemctl enable hermes-gateway.service
  systemctl enable --now hermes-garde.timer   # toutes les 10 min : Hermes s'arrête au-delà de $SEUIL_FORFAIT % de la semaine
  if [ -f /var/lib/hermes-garde/arret ]; then
    # en pause par le garde : c'est lui qui décide, avec ses nouvelles règles (il relance Hermes si le forfait le permet)
    echo "Hermes est en pause par le garde du forfait : je relance le garde, qui le redémarre si le forfait le permet."
    systemctl start hermes-garde.service || true
    journalctl -u hermes-garde -n 1 --no-pager -o cat 2>/dev/null | sed 's/^/  garde : /'
  elif grep -q '^TELEGRAM_BOT_TOKEN=.' "$HH/.env" 2>/dev/null && [ -n "$autorises" ]; then
    systemctl restart hermes-gateway.service && echo "Hermes relancé avec la nouvelle version ou la nouvelle politique."
  else
    echo "Hermes n'est pas démarré : Telegram n'est pas encore configuré (telegram.sh)."
  fi
fi

dire "Fini"
cat <<FIN
Étapes suivantes (dans Termius, en SSH ; elles demandent une saisie) :
  1. sudo bash /opt/rd/jarvis-os/hermes/connexion-claude.sh   (relier Claude Code d'Hermes à ton abonnement)
  2. sudo bash /opt/rd/jarvis-os/hermes/telegram.sh           (jeton du bot et ton identifiant Telegram, puis démarrage)
Contrôle : sudo bash /opt/rd/jarvis-os/hermes/diagnostic.sh
FIN
