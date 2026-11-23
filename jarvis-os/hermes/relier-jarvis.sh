#!/bin/bash
# JARVIS OS — relier Hermes au serveur MCP de JARVIS (étape 3 ; docs/hermes.md, docs/hermes-deroule.md).
#
#   sudo bash /opt/rd/jarvis-os/hermes/relier-jarvis.sh         (jeton « Hermes », profil « Exécutant »)
#   sudo bash /opt/rd/jarvis-os/hermes/relier-jarvis.sh --web   (second jeton « Hermes Web », profil « Veilleur »,
#                                                                pour la seule routine qui lit le web)
#
# À lancer dans Termius (il demande une saisie). Avant : dans JARVIS, Réglages, « Assistants reliés (MCP) »,
# créer le jeton fixe ; il n'est montré qu'une fois. Le jeton se colle ici, jamais dans une conversation.
# Le script vérifie, depuis l'utilisateur hermes (donc à travers ses règles réseau), que JARVIS répond et que le
# jeton a le bon profil, puis le pose dans /etc/hermes/jarvis.env (root, 0600 : lu par systemd seulement) et
# relance install.sh, qui ouvre les outils de JARVIS dans la politique.
# Retirer la liaison : sudo rm /etc/hermes/jarvis.env && sudo bash /opt/rd/jarvis-os/hermes/install.sh
# (et « Retirer » les jetons dans JARVIS).
set -uo pipefail
[ "$(id -u)" = 0 ] || { echo "À lancer en root : sudo bash $0"; exit 1; }
[ -t 0 ] || { echo "À lancer dans un vrai terminal (Termius) : il demande une saisie."; exit 1; }
ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
WEB=0; [ "${1:-}" = "--web" ] && WEB=1
id hermes >/dev/null 2>&1 || { echo "Hermes n'est pas installé : sudo bash $ICI/install.sh"; exit 1; }
grep -q '@MCP@' "$ICI/politique.yaml" || { echo "Ce dépôt n'a pas la politique de l'étape 3 : mets-le à jour (git pull)."; exit 1; }

if [ "$WEB" = 1 ]; then
  # le second jeton va à la même adresse que le premier
  url=$(sed -n 's/^JARVIS_MCP_URL=//p' /etc/hermes/jarvis.env 2>/dev/null | tail -1)
  [ -n "$url" ] || { echo "Hermes n'est pas encore relié à JARVIS : lance d'abord ce script sans --web."; exit 1; }
  adresse=${url%/mcp}
  echo "Dans JARVIS : Réglages, « Assistants reliés (MCP) », jeton fixe, nom « Hermes Web », profil « Veilleur », signe comme « Hermes »."
else
  # L'adresse publique de JARVIS : celle que Caddy sert (jamais 127.0.0.1 : les règles réseau d'Hermes le lui interdisent)
  adresse=$(systemctl show jarvis -p Environment --value 2>/dev/null | tr ' ' '\n' | sed -n 's/^JARVIS_PUBLIC_URL=//p' | head -1)
  [ -n "$adresse" ] || adresse=$(sed -n 's/^\([A-Za-z0-9.-]*\.sslip\.io\).*/https:\/\/\1/p' /etc/caddy/Caddyfile 2>/dev/null | head -1)
  adresse=${adresse%/}
  echo "Adresse de JARVIS : ${adresse:-introuvable}"
  read -r -p "Entrée pour la garder, ou tape la bonne (https://…) : " saisie
  [ -n "$saisie" ] && adresse=${saisie%/}
  if [ "${HERMES_BANC:-0}" = 1 ]; then [[ "$adresse" =~ ^http://127\.0\.0\.1:[0-9]+$ ]] || { echo "Banc : adresse http://127.0.0.1:<port> attendue."; exit 1; }   # faux JARVIS du banc
  else [[ "$adresse" =~ ^https://[A-Za-z0-9.-]+$ ]] || { echo "Adresse refusée : il faut https:// suivi du nom du serveur, sans chemin."; exit 1; }; fi
  url="$adresse/mcp"
  echo
  echo "Dans JARVIS : Réglages, « Assistants reliés (MCP) », jeton fixe, nom « Hermes », profil « Exécutant »."
fi
read -r -s -p "Colle le jeton (rien ne s'affiche) : " jeton; echo
[[ "$jeton" =~ ^jvf_[A-Za-z0-9_-]{20,}$ ]] || { echo "Ce n'est pas un jeton fixe de JARVIS (il commence par jvf_). Rien n'a été changé."; exit 1; }

# Vérification depuis l'utilisateur hermes ; le jeton passe par l'entrée de curl, jamais sur une ligne de commande
reponse=$(printf 'url = "%s"\nsilent\nmax-time = 25\nrequest = "POST"\nheader = "content-type: application/json"\nheader = "authorization: Bearer %s"\ndata = "{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1,\\"method\\":\\"tools/list\\"}"\nwrite-out = "\\n%%{http_code}"\n' "$url" "$jeton" \
  | (cd /home/hermes && runuser -u hermes -- env -i HOME=/home/hermes PATH=/usr/bin:/bin curl -K -) 2>/dev/null)
code=$(printf '%s' "$reponse" | tail -1)
case "$code" in
  200) ;;
  401) echo "JARVIS refuse ce jeton (401) : recrée-le dans Réglages et recommence. Rien n'a été changé."; exit 1 ;;
  403) echo "Ce jeton est suspendu dans JARVIS (403) : Réglages, « Reprendre ». Rien n'a été changé."; exit 1 ;;
  000|"") echo "Hermes ne joint pas $adresse (règles réseau, Caddy ou adresse). Contrôle : sudo bash $ICI/diagnostic.sh. Rien n'a été changé."; exit 1 ;;
  *) echo "Réponse inattendue de JARVIS (code $code) : est-il à jour (0.72.0 au moins) ? Rien n'a été changé."; exit 1 ;;
esac
a() { printf '%s' "$reponse" | grep -q "\"$1\""; }
if [ "$WEB" = 1 ]; then
  if ! a pilotage_lire; then echo "Ce jeton n'a que le profil « Lecture et propositions » : crée-le avec le profil « Veilleur ». Rien n'a été changé."; exit 1; fi
  if a gmail_chercher || a jarvis_maintenant; then echo "Ce jeton a le profil « Exécutant » : il voit tes mails. Pour la routine du web il faut le profil « Veilleur ». Rien n'a été changé."; exit 1; fi
  profil="Veilleur"
else
  if ! a pilotage_lire; then echo "Ce jeton n'a que le profil « Lecture et propositions » : crée-le avec le profil « Exécutant ». Rien n'a été changé."; exit 1; fi
  if ! a gmail_chercher; then echo "Ce jeton a le profil « Veilleur » : c'est celui de la routine du web (--web). Ici il faut le profil « Exécutant ». Rien n'a été changé."; exit 1; fi
  profil="Exécutant"
fi
echo "JARVIS répond à Hermes : $(printf '%s' "$reponse" | grep -o '"name": *"[a-z_]*"' | wc -l) outils, profil « $profil »."

umask 077
if [ "$WEB" = 1 ]; then
  { grep -v '^JARVIS_MCP_TOKEN_WEB=' /etc/hermes/jarvis.env; printf 'JARVIS_MCP_TOKEN_WEB=%s\n' "$jeton"; } > /etc/hermes/jarvis.env.nouveau && mv /etc/hermes/jarvis.env.nouveau /etc/hermes/jarvis.env
else
  web=$(sed -n 's/^JARVIS_MCP_TOKEN_WEB=//p' /etc/hermes/jarvis.env 2>/dev/null | tail -1)   # gardé si la liaison est refaite
  { printf 'JARVIS_MCP_URL=%s\nJARVIS_MCP_TOKEN=%s\n' "$url" "$jeton"; [ -n "$web" ] && printf 'JARVIS_MCP_TOKEN_WEB=%s\n' "$web"; } > /etc/hermes/jarvis.env
fi
chown root:root /etc/hermes/jarvis.env; chmod 0600 /etc/hermes/jarvis.env
unset jeton reponse web

echo; echo "Politique et service (install.sh)…"
JOURNAL=/home/hermes/.hermes/logs/agent.log; avant=$(stat -c %s "$JOURNAL" 2>/dev/null || echo 0)
serveur=jarvis; [ "$WEB" = 1 ] && serveur=jarvis-web
bash "$ICI/install.sh" > /var/log/hermes-relier.log 2>&1 || { echo "install.sh a échoué : sudo tail -30 /var/log/hermes-relier.log"; exit 1; }
if [ "${HERMES_BANC:-0}" = 1 ] || [ "$(systemctl is-active hermes-gateway 2>/dev/null)" != active ]; then
  echo "Liaison posée. Hermes n'est pas en marche (Telegram pas configuré, ou en pause par le garde) : elle servira à son démarrage."; exit 0
fi
for i in $(seq 1 90); do
  tail -c +"$((avant + 1))" "$JOURNAL" 2>/dev/null | grep -q "MCP server '$serveur'.*registered" && break; sleep 1
done
if tail -c +"$((avant + 1))" "$JOURNAL" 2>/dev/null | grep -q "MCP server '$serveur'.*registered"; then
  echo "Hermes est relié à JARVIS ($serveur) : $(tail -c +"$((avant + 1))" "$JOURNAL" | grep "MCP server '$serveur'" | grep -o "registered [0-9]* tool" | tail -1 | tr -dc 0-9) outils."
  if [ "$WEB" = 1 ]; then echo "Ensuite : sudo bash $ICI/routines.sh (la routine du web sera posée)."
  else
    echo "Essai, dans Telegram : envoie d'abord /new (une conversation commencée avant garde l'ancienne consigne et n'a pas les outils),"
    echo "puis « Qu'est-ce qui m'attend aujourd'hui ? ». Ensuite : sudo bash $ICI/routines.sh"
  fi
else
  echo "Hermes a redémarré mais n'a pas encore annoncé la liaison. Contrôle : sudo bash $ICI/diagnostic.sh"
fi
