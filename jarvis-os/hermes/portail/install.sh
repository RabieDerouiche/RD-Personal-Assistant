#!/bin/bash
# JARVIS OS — le Hermes « portail » : un second Hermes, à part, pour se connecter à un portail (essai décidé le
# 24/11/2026 ; docs/hermes-portail.md).
#
#   sudo bash /opt/rd/jarvis-os/hermes/portail/install.sh
#
# Relançable sans risque. Il ne touche ni au Hermes de Telegram (utilisateur hermes), ni à JARVIS, ni à Panier,
# ni à Caddy, ni à ufw, et n'ouvre aucun port vers Internet. Il ne démarre aucun agent : un essai se lance par
# « sudo hermes-portail essai <adresse> ». Versions : les mêmes que le Hermes principal (lues dans ../install.sh).
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
eval "$(grep -E '^(HERMES_VERSION|HERMES_COMMIT|HERMES_INSTALLEUR_SHA256|PLUGIN_CATALOGUE|PLUGIN_COMMIT|PLUGIN_ID|CLAUDE_CODE_VERSION)=[A-Za-z0-9._-]+( |$)' "$ICI/../install.sh" | sed 's/ .*//')"
: "${HERMES_COMMIT:?versions illisibles dans ../install.sh}" "${HERMES_INSTALLEUR_SHA256:?}" "${PLUGIN_ID:?}" "${PLUGIN_COMMIT:?}" "${CLAUDE_CODE_VERSION:?}"
U=hermes-portail
H=/home/$U
HH=$H/.hermes
CC=$H/.local/lib/claude-code
ETC=/etc/hermes-portail
LIB=/usr/local/lib/hermes-portail
VAR=/var/lib/hermes-portail
RELAIS=8891
BANC=${HERMES_BANC:-0}   # 1 = banc d'essai (conteneur sans systemd) : ni service ni règles réseau chargés

dire() { printf '\n== %s\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "À lancer en root : sudo bash $0"; exit 1; }
for f in politique.yaml hermes-portail filtre.py sortie.nft hermes-portail-sortie.service hermes-portail-filtre.service domaines.defaut skills/portail/portail/SKILL.md; do
  [ -f "$ICI/$f" ] || { echo "Fichier manquant : $ICI/$f"; exit 1; }
done
bash -n "$ICI/hermes-portail" && python3 -I -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" "$ICI/filtre.py" || { echo "Le code du dépôt ne passe pas le contrôle de syntaxe : rien n'a été posé."; exit 1; }

NPM_DIR=$(dirname "$(command -v npm 2>/dev/null || echo /usr/bin/npm)")
passe=()
for v in HTTPS_PROXY https_proxy NO_PROXY no_proxy SSL_CERT_FILE REQUESTS_CA_BUNDLE CURL_CA_BUNDLE NODE_EXTRA_CA_CERTS GIT_SSL_CAINFO UV_NATIVE_TLS npm_config_cafile; do
  [ -n "${!v:-}" ] && passe+=("$v=${!v}")
done
comme() {   # pendant l'installation seulement : accès direct aux dépôts de paquets (les règles réseau ne sont chargées qu'à la fin)
  (cd "$H" && runuser -u "$U" -- env -i HOME="$H" USER="$U" LOGNAME="$U" LANG=C.UTF-8 \
    PATH="$H/.local/bin:$NPM_DIR:/usr/local/bin:/usr/bin:/bin" HERMES_HOME="$HH" HERMES_MANAGED_DIR="$ETC" "${passe[@]}" "$@")
}

dire "Vérifications"
libre=$(df -BG --output=avail /home | tail -1 | tr -dc 0-9)
echo "Disque libre : $libre Go (ce second Hermes en prend environ 3, navigateur compris)."
[ -d "$HH/hermes-agent/.git" ] || [ "$libre" -ge 5 ] || { echo "Il faut 5 Go libres sur /home."; exit 1; }
echo "Mémoire disponible maintenant : $(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo) Mo (il ne consomme rien au repos ; environ 1 Go pendant un essai, navigateur et Claude Code compris)."
command -v npm >/dev/null || { echo "npm introuvable (installé par setup.sh de JARVIS)."; exit 1; }
[ -x /usr/local/sbin/jarvis-coffre ] && echo "jarvis-coffre : installé." || echo "jarvis-coffre : pas encore installé (sudo bash /opt/rd/jarvis-os/coffre/install.sh). Il le faudra avant « enregistrer »."

dire "Paquets du système"
if [ "$BANC" != 1 ]; then systemctl stop hermes-portail-sortie.service 2>/dev/null || true; apt-get update -q; fi   # règles levées le temps d'installer
apt-get install -y -q git curl tar coreutils ca-certificates libatomic1 nftables python3 >/dev/null

dire "Utilisateur $U (sans mot de passe, sans shell, sans sudo)"
id "$U" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$H" --shell /usr/sbin/nologin "$U"
chmod 700 "$H"
for g in sudo adm docker lxd wheel jarvis hermes jarvis-coffre-clients; do
  if id -nG "$U" | tr ' ' '\n' | grep -qx "$g"; then echo "Refus : $U ne doit pas être dans le groupe $g."; exit 1; fi
done

dire "Hermes $HERMES_VERSION avec son navigateur (installeur officiel vérifié par son empreinte, lancé en tant que $U)"
deja=""
[ -d "$HH/hermes-agent/.git" ] && deja=$(comme git -C "$HH/hermes-agent" rev-parse HEAD 2>/dev/null || true)
if [ "$deja" != "$HERMES_COMMIT" ]; then
  tmp=$(mktemp)
  curl -fsSL -o "$tmp" "https://raw.githubusercontent.com/NousResearch/hermes-agent/$HERMES_COMMIT/scripts/install.sh"
  echo "$HERMES_INSTALLEUR_SHA256  $tmp" | sha256sum -c --quiet - || { echo "Empreinte de l'installeur différente : arrêt."; rm -f "$tmp"; exit 1; }
  install -o "$U" -g "$U" -m 0644 "$tmp" "$H/.installeur-hermes.sh"; rm -f "$tmp"
  comme bash "$H/.installeur-hermes.sh" --commit "$HERMES_COMMIT" --non-interactive --skip-computer-use --hermes-home "$HH" | tail -3
else
  echo "Déjà à $HERMES_VERSION."
fi
comme hermes --version | head -1
ls -d "$HH"/tools/chromium-* >/dev/null 2>&1 || comme hermes pm install chromium | tail -1
ls -d "$HH"/tools/chromium-* >/dev/null 2>&1 && echo "Navigateur : $(basename "$(ls -d "$HH"/tools/chromium-* | tail -1)")" || { echo "Navigateur d'Hermes absent : arrêt."; exit 1; }

dire "Plugin de l'abonnement Claude et Claude Code $CLAUDE_CODE_VERSION (les siens, séparés des autres)"
[ -d "$HH/plugins/$PLUGIN_ID" ] || comme hermes plugins install "$PLUGIN_CATALOGUE" --ref "$PLUGIN_COMMIT" | tail -2
comme hermes plugins enable "$PLUGIN_ID" | tail -1
if [ "$(comme "$CC/node_modules/.bin/claude" --version 2>/dev/null | cut -d' ' -f1)" != "$CLAUDE_CODE_VERSION" ]; then
  comme mkdir -p "$CC"
  comme npm install --prefix "$CC" --no-fund --no-audit --omit=dev "@anthropic-ai/claude-code@$CLAUDE_CODE_VERSION" | tail -1
fi
comme "$CC/node_modules/.bin/claude" --version
comme ln -sfn "$CC/node_modules/.bin/claude" "$H/.local/bin/claude"

dire "Politique (root) : $ETC"
install -d -o root -g root -m 0755 "$ETC" "$LIB"
install -d -o root -g root -m 0700 "$VAR"
sed "s/@RELAIS@/$RELAIS/g" "$ICI/politique.yaml" > "$ETC/config.yaml.nouveau"
chown root:root "$ETC/config.yaml.nouveau" && chmod 0644 "$ETC/config.yaml.nouveau" && mv "$ETC/config.yaml.nouveau" "$ETC/config.yaml"
printf '%s\n' "# JARVIS OS — valeurs imposées au Hermes portail (root ; aucun secret ici)." "GATEWAY_ALLOW_ALL_USERS=false" > "$ETC/.env"; chmod 0644 "$ETC/.env"
[ -f "$ETC/domaines" ] || install -o root -g root -m 0644 "$ICI/domaines.defaut" "$ETC/domaines"
rm -rf "$ETC/skills.nouveau" && cp -r "$ICI/skills" "$ETC/skills.nouveau"
chown -R root:root "$ETC/skills.nouveau" && chmod -R u=rwX,go=rX "$ETC/skills.nouveau"
rm -rf "$ETC/skills" && mv "$ETC/skills.nouveau" "$ETC/skills"
comme hermes config set model.base_url "" >/dev/null
comme hermes config set skills.external_dirs "[\"$ETC/skills\"]" >/dev/null
fournies=$(find "$HH/hermes-agent/skills" -name SKILL.md -exec sed -n 's/^name: *//p' {} \; 2>/dev/null | tr -d "\"'" | sort -u | paste -sd, -)
[ -n "$fournies" ] && comme hermes config set skills.disabled "[$fournies]" >/dev/null
echo "Skill du dépôt : $(find "$ETC/skills" -name SKILL.md | wc -l) ; skills livrées avec Hermes coupées : $(printf '%s' "$fournies" | tr ',' '\n' | grep -c .)."

dire "Commande et relais (copies root)"
install -o root -g root -m 0755 "$ICI/hermes-portail" /usr/local/sbin/hermes-portail
install -o root -g root -m 0644 "$ICI/filtre.py" "$LIB/filtre.py"
echo "/usr/local/sbin/hermes-portail, $LIB/filtre.py"

dire "Coffre d'Hermes : sa clé ne vivra qu'en mémoire vive"
install -d -o "$U" -g "$U" -m 0700 "$HH/vault"
if [ -e "$HH/vault/vault.key" ] && [ ! -L "$HH/vault/vault.key" ]; then
  echo "ATTENTION : une clé existe sur le disque ($HH/vault/vault.key). Je n'y touche pas : sudo hermes-portail oublier --tout"
else
  runuser -u "$U" -- ln -sfn /run/hermes-portail-cle/vault.key "$HH/vault/vault.key"
  echo "Lien posé : $HH/vault/vault.key -> /run/hermes-portail-cle/vault.key (mémoire vive, créée à la demande)."
fi

dire "Relais filtrant et règles réseau"
uid=$(id -u "$U")
sed -e "s/@UID@/$uid/g" -e "s/@RELAIS@/$RELAIS/g" "$ICI/sortie.nft" > "$ETC/sortie.nft"; chmod 0644 "$ETC/sortie.nft"
install -o root -g root -m 0644 "$ICI/hermes-portail-sortie.service" /etc/systemd/system/hermes-portail-sortie.service
sed "s/@RELAIS@/$RELAIS/g" "$ICI/hermes-portail-filtre.service" > /etc/systemd/system/hermes-portail-filtre.service; chmod 0644 /etc/systemd/system/hermes-portail-filtre.service
nft -c -f "$ETC/sortie.nft" 2>/dev/null && echo "Règles réseau : syntaxe vérifiée." || [ "$BANC" = 1 ] || { echo "Règles réseau refusées par nft : arrêt."; exit 1; }
if [ "$BANC" != 1 ]; then
  systemctl daemon-reload
  systemctl enable --now hermes-portail-filtre.service
  systemctl enable --now hermes-portail-sortie.service
  systemctl restart hermes-portail-sortie.service
  echo "Relais : $(systemctl is-active hermes-portail-filtre) ; règles réseau : $(systemctl is-active hermes-portail-sortie)."
fi

dire "Fini"
cat <<FIN
Étapes suivantes (dans Termius, en SSH ; elles demandent une saisie) :
  1. sudo jarvis-coffre creer                 (une seule fois, si le coffre n'existe pas encore : la phrase, gardée dans NordPass)
  2. sudo hermes-portail connexion-claude     (relie son Claude Code à ton abonnement)
  3. sudo hermes-portail enregistrer          (identifiant et mot de passe du portail, sans affichage)
Puis, sans saisie :
  sudo hermes-portail domaines ajouter <hôte du portail>
  sudo hermes-portail essai https://<adresse du portail>
Contrôle : sudo hermes-portail etat
FIN
