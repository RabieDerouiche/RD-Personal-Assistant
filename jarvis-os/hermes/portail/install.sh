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
HH=$H/hermes               # pas ~/.hermes : Hermes cherche alors une unité « hermes-gateway » au nom nu, celle du Hermes principal
CC=$H/.local/lib/claude-code
ETC=/etc/hermes-portail
LIB=/usr/local/lib/hermes-portail
VAR=/var/lib/hermes-portail
RELAIS=8891
BANC=${HERMES_BANC:-0}   # 1 = banc d'essai (conteneur sans systemd) : ni service ni règles réseau chargés

dire() { printf '\n== %s\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "À lancer en root : sudo bash $0"; exit 1; }
for f in politique.yaml hermes-portail filtre.py sortie.nft hermes-portail-sortie.service hermes-portail-filtre.service hermes-portail-essai.service hermes-portail-cra.service hermes-portail-cra.timer hermes-portail-cra-mois.service hermes-portail-cra-mois.timer hermes-portail-cra-signe.service hermes-portail-cra-signe.timer hermes-portail-teletravail.service hermes-portail-teletravail.timer hermes-portail-ndf.service hermes-portail-ndf.timer domaines.defaut navigateur-regles.json justificatif-essai.pdf facture.mjs teletravail.mjs teletravail.py note.py skills/portail/portail/SKILL.md; do
  [ -f "$ICI/$f" ] || { echo "Fichier manquant : $ICI/$f"; exit 1; }
done
[ -f "$ICI/../limite.py" ] && python3 -I -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" "$ICI/../limite.py" || { echo "Fichier manquant ou illisible : $ICI/../limite.py"; exit 1; }
bash -n "$ICI/hermes-portail" && python3 -I -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" "$ICI/filtre.py" && python3 -I -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" "$ICI/teletravail.py" && python3 -I -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" "$ICI/note.py" &&python3 -I -c "import json,sys; json.load(open(sys.argv[1]))" "$ICI/navigateur-regles.json" || { echo "Le code du dépôt ne passe pas le contrôle de syntaxe : rien n'a été posé."; exit 1; }

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
apt-get install -y -q git curl tar coreutils ca-certificates libatomic1 nftables python3 poppler-utils >/dev/null   # poppler-utils : pdfunite, qui assemble le justificatif de la note de télétravail (26/11/2026)

dire "Utilisateur $U (sans mot de passe, sans shell, sans sudo)"
id "$U" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$H" --shell /usr/sbin/nologin "$U"
chmod 700 "$H"
for g in sudo adm docker lxd wheel jarvis hermes jarvis-coffre-clients; do
  if id -nG "$U" | tr ' ' '\n' | grep -qx "$g"; then echo "Refus : $U ne doit pas être dans le groupe $g."; exit 1; fi
done

dire "Hermes $HERMES_VERSION avec son navigateur (installeur officiel vérifié par son empreinte, lancé en tant que $U)"
deja=""
[ -d "$HH/hermes-agent/.git" ] && deja=$(comme git -C "$HH/hermes-agent" rev-parse HEAD 2>/dev/null || true)
# Installé pour de bon = au bon commit ET la commande présente : un installeur coupé en route (longue construction sur
# un petit serveur) laisse le bon commit sans la commande, et une relance doit alors le refaire.
if [ "$deja" != "$HERMES_COMMIT" ] || [ ! -x "$H/.local/bin/hermes" ]; then
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

dire "Bibliothèques du navigateur (paquets du système)"
# L'installeur d'Hermes tourne sans droits : il pose Chromium mais pas les bibliothèques du système dont il a besoin.
# Au premier passage sur le serveur (25/11/2026), Chromium ne démarrait pas (libatk et onze autres absentes).
# Les noms changent d'une version d'Ubuntu à l'autre (suffixe « t64 ») : le premier nom connu d'apt est pris.
if [ "$BANC" != 1 ]; then
  paquets=""
  for groupe in "libatk1.0-0t64 libatk1.0-0" "libatk-bridge2.0-0t64 libatk-bridge2.0-0" "libatspi2.0-0t64 libatspi2.0-0" \
      "libcups2t64 libcups2" "libasound2t64 libasound2" "libglib2.0-0t64 libglib2.0-0" libgbm1 libdrm2 libpango-1.0-0 libcairo2 \
      libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxkbcommon0 libxext6 libx11-6 libxcb1 libdbus-1-3 libnss3 libnspr4 fonts-liberation; do
    trouve=""
    for p in $groupe; do apt-cache show "$p" >/dev/null 2>&1 && { trouve=$p; break; }; done
    [ -n "$trouve" ] && paquets="$paquets $trouve" || echo "Paquet introuvable chez apt pour : $groupe"
  done
  # shellcheck disable=SC2086
  apt-get install -y -q --no-install-recommends $paquets >/dev/null
fi
chrome=$(ls "$HH"/tools/chromium-*/chrome-linux*/chrome 2>/dev/null | tail -1)
[ -n "$chrome" ] || { echo "Chromium d'Hermes introuvable sous $HH/tools : arrêt."; exit 1; }
manque=$(ldd "$chrome" 2>/dev/null | awk '/not found/{print $1}' | sort -u | paste -sd' ' -)
if [ -z "$manque" ]; then echo "Navigateur : toutes ses bibliothèques sont là."
else echo "Navigateur : bibliothèques encore absentes : $manque"; echo "Il ne démarrerait pas : arrêt."; exit 1; fi

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

dire "Règles du navigateur (root)"
# Chrome for Testing (celui qu'Hermes installe) lit ses règles d'administrateur ici ; l'utilisateur hermes-portail ne
# peut pas les changer. Elles valent pour tout Chrome for Testing de la machine : il n'y a que celui-là.
REGLES=/etc/opt/chrome_for_testing/policies/managed
install -d -o root -g root -m 0755 /etc/opt/chrome_for_testing /etc/opt/chrome_for_testing/policies "$REGLES"
install -o root -g root -m 0644 "$ICI/navigateur-regles.json" "$REGLES/hermes-portail.json"
echo "$REGLES/hermes-portail.json : gestionnaire de mots de passe, vérification de fuite, remplissage, compte Google, mises à jour et mesures coupés."

dire "Commande et relais (copies root)"
install -o root -g root -m 0755 "$ICI/hermes-portail" /usr/local/sbin/hermes-portail
install -o root -g root -m 0644 "$ICI/filtre.py" "$LIB/filtre.py"
install -o root -g root -m 0644 "$ICI/facture.mjs" "$LIB/facture.mjs"   # lancé sous l'utilisateur jarvis par « hermes-portail facture »
install -o root -g root -m 0644 "$ICI/teletravail.mjs" "$LIB/teletravail.mjs"   # note de télétravail : jours et Drive, sous l'utilisateur jarvis
install -o root -g root -m 0644 "$ICI/teletravail.py" "$LIB/teletravail.py"     # note de télétravail : calcul, garde-fous, synthèse (root, sans réseau)
install -o root -g root -m 0644 "$ICI/note.py" "$LIB/note.py"                   # notes à facture (box, Claude) : montant et date par règles, champs (root, sans réseau)
# 26/11/2026 : la limite du forfait Claude (le même fichier que le kit d'Hermes) et les hôtes de Claude : un passage coupé par la limite
# n'est relancé que si le relais prouve qu'aucun autre hôte (le portail) n'a été joint
install -o root -g root -m 0644 "$ICI/../limite.py" "$LIB/limite.py"
install -o root -g root -m 0644 "$ICI/domaines.defaut" "$LIB/domaines.defaut"
install -d -o root -g root -m 0700 "$VAR/limite"
install -d -o root -g root -m 0700 "$VAR/ndf"                                   # les notes préparées, le registre des notes créées (jamais dans le dépôt)
install -d -o root -g root -m 0700 "$VAR/teletravail"              # ses dossiers par mois et l'historique des montants (jamais dans le dépôt)
install -o root -g root -m 0644 "$ICI/justificatif-essai.pdf" "$LIB/justificatif-essai.pdf"   # facture inventée, pour un brouillon d'essai
install -d -o root -g root -m 0700 "$VAR/notes"                    # ce qu'Hermes apprend de chaque portail (jamais dans le dépôt)
install -d -o root -g "$U" -m 0750 /var/lib/hermes-portail-depot   # le fichier remis à Hermes le temps d'un passage
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
# l'unité d'un passage : même PATH que le Hermes principal (son Node et son npm à lui)
node_bin=$(ls -d "$HH"/tools/node-*/bin 2>/dev/null | sort -V | tail -1)
npm_bin=$(ls -d "$HH"/tools/npm-*/bin 2>/dev/null | sort -V | tail -1)
chemin="${node_bin:+$node_bin:}${npm_bin:+$npm_bin:}$HH/hermes-agent/node_modules/.bin:$H/.local/bin:/usr/local/bin:/usr/bin:/bin"
sed -e "s#@PATH@#$chemin#" -e "s/@RELAIS@/$RELAIS/g" "$ICI/hermes-portail-essai.service" > /etc/systemd/system/hermes-portail-essai.service
chmod 0644 /etc/systemd/system/hermes-portail-essai.service
install -d -o root -g root -m 0700 "$VAR/essais"
# le CRA de la semaine (25/11/2026) : la minuterie ne fait rien sans /etc/hermes-portail/cra.conf (posé sur le serveur, jamais dans le dépôt)
install -o root -g root -m 0644 "$ICI/hermes-portail-cra.service" /etc/systemd/system/hermes-portail-cra.service
install -o root -g root -m 0644 "$ICI/hermes-portail-cra.timer" /etc/systemd/system/hermes-portail-cra.timer
# le CRA du mois (26/11/2026, son QCM « CRA du mois seul ») : la minuterie ne fait rien sans « adresse_mois= » dans cra.conf
install -o root -g root -m 0644 "$ICI/hermes-portail-cra-mois.service" /etc/systemd/system/hermes-portail-cra-mois.service
install -o root -g root -m 0644 "$ICI/hermes-portail-cra-mois.timer" /etc/systemd/system/hermes-portail-cra-mois.timer
# le CRA signé du client (0.97.0) : la minuterie ne fait rien sans « adresse_mois= » dans cra.conf, ni sans PDF gardé par JARVIS
install -o root -g root -m 0644 "$ICI/hermes-portail-cra-signe.service" /etc/systemd/system/hermes-portail-cra-signe.service
install -o root -g root -m 0644 "$ICI/hermes-portail-cra-signe.timer" /etc/systemd/system/hermes-portail-cra-signe.timer
install -o root -g root -m 0644 "$ICI/hermes-portail-teletravail.service" /etc/systemd/system/hermes-portail-teletravail.service
install -o root -g root -m 0644 "$ICI/hermes-portail-teletravail.timer" /etc/systemd/system/hermes-portail-teletravail.timer
install -o root -g root -m 0644 "$ICI/hermes-portail-ndf.service" /etc/systemd/system/hermes-portail-ndf.service
install -o root -g root -m 0644 "$ICI/hermes-portail-ndf.timer" /etc/systemd/system/hermes-portail-ndf.timer
install -d -o root -g root -m 0700 "$VAR/cra"
nft -c -f "$ETC/sortie.nft" 2>/dev/null && echo "Règles réseau : syntaxe vérifiée." || [ "$BANC" = 1 ] || { echo "Règles réseau refusées par nft : arrêt."; exit 1; }
if [ "$BANC" != 1 ]; then
  systemctl daemon-reload
  systemctl enable --now hermes-portail-filtre.service
  systemctl enable --now hermes-portail-sortie.service
  systemctl restart hermes-portail-sortie.service
  systemctl enable --now hermes-portail-cra.timer
  systemctl enable --now hermes-portail-cra-mois.timer
  systemctl enable --now hermes-portail-cra-signe.timer
  systemctl enable --now hermes-portail-teletravail.timer
  systemctl enable --now hermes-portail-ndf.timer
  echo "Relais : $(systemctl is-active hermes-portail-filtre) ; règles réseau : $(systemctl is-active hermes-portail-sortie) ; CRA de la semaine : $(systemctl is-active hermes-portail-cra.timer)$([ -f "$ETC/cra.conf" ] || echo ' (sans cra.conf : ne fait rien)') ; CRA du mois : $(systemctl is-active hermes-portail-cra-mois.timer)$(grep -q '^adresse_mois=.' "$ETC/cra.conf" 2>/dev/null || echo ' (sans adresse_mois dans cra.conf : ne fait rien)') ; notes de frais du jour : $(systemctl is-active hermes-portail-teletravail.timer) ; notes validées : $(systemctl is-active hermes-portail-ndf.timer)$([ -f "$ETC/teletravail.conf" ] || echo ' (sans teletravail.conf : ne fait rien)')."
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
