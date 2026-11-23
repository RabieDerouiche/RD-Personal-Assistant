#!/bin/bash
# JARVIS OS — état du serveur et d'Hermes, en lecture seule (rien n'est modifié). docs/hermes.md.
#
#   sudo bash /opt/rd/jarvis-os/hermes/diagnostic.sh
#
# Sortie à recopier telle quelle dans une session Claude : elle ne contient ni jeton, ni identifiant
# Telegram, ni adresse du serveur, ni contenu de conversation.
set -uo pipefail
[ "$(id -u)" = 0 ] || { echo "À lancer en root : sudo bash $0"; exit 1; }
t() { printf '\n== %s\n' "$*"; }
mo() { awk -v k="$1" '$1==k":"{print int($2/1024)}' /proc/meminfo; }

t "Machine"
echo "Cœurs : $(nproc) · charge : $(cut -d' ' -f1-3 /proc/loadavg) · démarré depuis : $(uptime -p 2>/dev/null || true)"
echo "Mémoire : $(mo MemTotal) Mo au total, $(mo MemAvailable) Mo disponibles maintenant · échange : $(mo SwapTotal) Mo (libre $(mo SwapFree) Mo)"
echo "Disque : $(df -h --output=avail,size / | tail -1 | awk '{print $1" libres sur "$2}')"
echo "Pression mémoire depuis le démarrage :"; sed 's/^/  /' /proc/pressure/memory 2>/dev/null || echo "  (non disponible)"
oom=$(journalctl -k -b --no-pager 2>/dev/null | grep -ciE 'out of memory|oom-kill' || true)
echo "Processus tués faute de mémoire depuis le démarrage : ${oom:-0}"

t "Services (mémoire maintenant / pic depuis leur dernier démarrage ; cache des fichiers compris, donc à ne pas additionner)"
somme_pics=0
for s in jarvis panier caddy jarvis-rc hermes-gateway; do
  etat=$(systemctl is-active "$s" 2>/dev/null || true)
  [ "$etat" = active ] || { printf '  %-15s %s\n' "$s" "${etat:-absent}"; continue; }
  cur=$(systemctl show "$s" -p MemoryCurrent --value 2>/dev/null); pic=$(systemctl show "$s" -p MemoryPeak --value 2>/dev/null)
  depuis=$(systemctl show "$s" -p ActiveEnterTimestamp --value 2>/dev/null)
  [[ "$cur" =~ ^[0-9]+$ ]] && cur=$((cur / 1048576)) || cur="?"
  if [[ "$pic" =~ ^[0-9]+$ ]]; then pic=$((pic / 1048576)); somme_pics=$((somme_pics + pic)); else pic="?"; fi
  printf '  %-15s %5s Mo  (pic %5s Mo, depuis %s)\n' "$s" "$cur" "$pic" "$depuis"
done

t "Plus gros processus (nom, Mo)"
ps -eo rss=,comm= --sort=-rss | head -12 | awk '{printf "  %-20s %6.0f\n", $2, $1/1024}'

t "Ports en écoute (TCP)"
if command -v ss >/dev/null; then ss -ltnH | awk '{print "  " $4}' | sort -u; else echo "  (ss absent)"; fi

t "Résolution DNS"
grep -E '^nameserver' /etc/resolv.conf 2>/dev/null | sed 's/^/  /'

t "Versions"
command -v claude >/dev/null && echo "Claude Code de JARVIS : $(runuser -u jarvis -- claude --version 2>/dev/null || claude --version 2>/dev/null)"
if id hermes >/dev/null 2>&1; then
  hx() { (cd /home/hermes && runuser -u hermes -- env -i HOME=/home/hermes USER=hermes LOGNAME=hermes LANG=C.UTF-8 PATH=/home/hermes/.local/bin:/usr/bin:/bin HERMES_HOME=/home/hermes/.hermes HERMES_MANAGED_DIR=/etc/hermes "$@"); }
  echo "Hermes : $(hx hermes --version 2>/dev/null | grep -m1 'Hermes Agent' || echo 'non installé')"
  echo "Claude Code d'Hermes : $(hx /home/hermes/.local/lib/claude-code/node_modules/.bin/claude --version 2>/dev/null || echo absent)"
  echo "Relié à l'abonnement : $(hx /home/hermes/.local/lib/claude-code/node_modules/.bin/claude auth status 2>/dev/null | grep -q '"loggedIn": *true' && echo oui || echo non)"

  t "Garde-fous d'Hermes"
  [ "$(stat -c '%U %a' /etc/hermes/config.yaml 2>/dev/null)" = "root 644" ] && echo "  politique /etc/hermes/config.yaml : root, 0644 (Hermes ne peut pas la changer)" || echo "  ATTENTION : politique absente ou modifiable"
  [ "$(stat -c '%U %a' /home/hermes/.hermes/.env 2>/dev/null)" = "hermes 600" ] && echo "  secrets ~/.hermes/.env : 0600" || echo "  ATTENTION : droits de ~/.hermes/.env"
  n=$(sed -n 's/^TELEGRAM_ALLOWED_USERS=//p' /etc/hermes/.env 2>/dev/null | tr ',' '\n' | grep -c '[0-9]' || true)
  echo "  identifiants Telegram autorisés (imposés par root) : ${n:-0}"
  grep -q '^TELEGRAM_BOT_TOKEN=.' /home/hermes/.hermes/.env 2>/dev/null && echo "  jeton du bot : posé" || echo "  jeton du bot : absent (telegram.sh)"
  nft list table inet hermes_sortie >/dev/null 2>&1 && echo "  règles réseau hermes_sortie : chargées" || echo "  ATTENTION : règles réseau hermes_sortie absentes"
  echo "  outils actifs sur Telegram : $(hx hermes tools list --platform telegram 2>/dev/null | grep -c '✓ enabled') (attendu : 4)"
  echo "  exposition systemd : $(systemd-analyze security --no-pager hermes-gateway.service 2>/dev/null | sed -n 's/.*Overall exposure level for hermes-gateway.service: //p')"
  seuil=$(sed -n 's/^HERMES_SEUIL_FORFAIT=//p' /etc/hermes/garde.conf 2>/dev/null)
  [ "$(sed -n 's/^HERMES_GARDE_CINQ_HEURES=//p' /etc/hermes/garde.conf 2>/dev/null)" = 1 ] && fenetres="semaine et fenêtre de 5 heures" || fenetres="semaine seulement"
  echo "  garde du forfait : $(systemctl is-active hermes-garde.timer 2>/dev/null || echo absent) (seuil ${seuil:-?} %, $fenetres)$([ -f /var/lib/hermes-garde/arret ] && echo ' ; HERMES EN PAUSE : forfait au-dessus du seuil')"
  journalctl -u hermes-garde -n 30 --utc --no-pager -o short-iso 2>/dev/null | grep -E ': (Forfait|Hermes|Usage) ' | tail -1 | sed -E 's/^([0-9T:-]+)[^ ]* [^ ]+ [^ ]+: /\1 UTC : /; s/T/ /; s/^/    dernier contrôle : /'
  echo "  dernières lignes utiles du journal :"
  grep -E "telegram connected|Connected to Telegram|ERROR|Traceback|plan limit|extra usage|denied" /home/hermes/.hermes/logs/gateway.log 2>/dev/null | tail -5 | cut -c1-160 | sed -E 's/[0-9]{6,}/<n>/g; s/^/    /'
fi

t "JARVIS s'est-il retenu faute de mémoire ? (7 derniers jours ; noté depuis JARVIS 0.70.1, une ligne par genre et par 10 min au plus)"
retenues=$(journalctl -u jarvis --since "7 days ago" --no-pager -o cat 2>/dev/null | grep -o "mémoire basse : [^(]*" | sed 's/ *$//' || true)
if [ -n "$retenues" ]; then printf '%s\n' "$retenues" | sort | uniq -c | sed 's/^ */  /'; else echo "  aucune retenue notée"; fi

t "Verdict mémoire (Likely)"
# Les pics par service comptent le cache des fichiers (récupérable) et ne tombent pas en même temps : ils ne
# s'additionnent pas (le 23/11, l'installation d'Hermes lancée depuis la session d'administration y avait mis
# 2,7 Go de cache). Le verdict part de la mémoire disponible maintenant et des retenues notées par JARVIS.
dispo=$(mo MemAvailable); echange=$(( $(mo SwapTotal) - $(mo SwapFree) ))
if [ "$(systemctl is-active hermes-gateway 2>/dev/null)" = active ]; then
  encore=250; quoi="pendant une réponse d'Hermes (son Claude Code, environ 250 Mo)"
  depuis=$(systemctl show hermes-gateway -p ActiveEnterTimestamp --value 2>/dev/null)
  depuis_s=$(date -d "$depuis" +%s 2>/dev/null || echo 0)
  apres=$(journalctl -u jarvis --since "@$depuis_s" --no-pager -o cat 2>/dev/null | grep -c "mémoire basse" || true)
else
  encore=600; quoi="avec Hermes démarré et en train de répondre (environ 600 Mo)"; apres=0
fi
marge=$((dispo - encore))
echo "  Disponible maintenant : $dispo Mo ; échange utilisé : $echange Mo."
echo "  JARVIS se retient sous 900 Mo libres (préparation de Sonnet), 600 Mo (seconde mission) et 400 Mo (Siri)."
echo "  Libre $quoi : environ $marge Mo."
if [ "${apres:-0}" -gt 0 ]; then echo "  → JARVIS s'est retenu $apres fois depuis le démarrage d'Hermes : passer au VPS-2 (8 Go) ou arrêter Hermes."
elif [ "$marge" -ge 1500 ]; then echo "  → Confortable : JARVIS ne devrait pas se brider à cause d'Hermes."
elif [ "$marge" -ge 900 ]; then echo "  → Suffisant : seuls des pics cumulés (session d'administration, mission, réponse d'Hermes) peuvent faire sauter la préparation de Sonnet."
else echo "  → Insuffisant maintenant : passer au VPS-2 (8 Go) ou arrêter Hermes."
fi
