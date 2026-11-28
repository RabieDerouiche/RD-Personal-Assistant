#!/bin/bash
# JARVIS OS — le réveil d'Hermes (routines de Grok Bot reprises, 26/11/2026 ; posé par install.sh en
# /usr/local/sbin/hermes-reveil, lancé par hermes-reveil.path quand JARVIS touche /var/lib/jarvis-reveil/sonnette).
# JARVIS le touche quand il repère un courrier d'un expéditeur « Immédiat » ou qu'une ligne du Canal attend Hermes.
# Ce script lance un passage de la routine « reveil » d'Hermes (hermes cron run), au plus une fois toutes les
# 2 minutes (un réveil trop proche est reporté de 2 minutes et demie). Le contenu du fichier de JARVIS n'est
# jamais lu : un réveil ne porte aucune consigne, Hermes lit lui-même le courrier et le Canal par JARVIS.
set -uo pipefail
H=/home/hermes; HH=$H/.hermes
DER=${HERMES_REVEIL_DERNIER:-/run/hermes-reveil.dernier}
ECART=120
hx() { (cd "$H" && runuser -u hermes -- env -i HOME="$H" USER=hermes LOGNAME=hermes LANG=C.UTF-8 PATH="$H/.local/bin:/usr/bin:/bin" \
  HERMES_HOME="$HH" HERMES_MANAGED_DIR=/etc/hermes "$@"); }
id hermes >/dev/null 2>&1 || { echo "Hermes n'est pas installé : réveil ignoré."; exit 0; }
[ "$(systemctl is-active hermes-gateway 2>/dev/null)" = active ] || { echo "Hermes est arrêté (garde du forfait ou à la main) : réveil ignoré."; exit 0; }
maint=$(date +%s); avant=$(cat "$DER" 2>/dev/null || echo 0); [[ "$avant" =~ ^[0-9]+$ ]] || avant=0
if [ $((maint - avant)) -lt "$ECART" ]; then
  systemd-run --quiet --collect --unit=hermes-reveil-suite --on-active=150 /usr/local/sbin/hermes-reveil >/dev/null 2>&1 || true
  echo "Réveil trop proche du précédent : reporté de 2 minutes et demie."; exit 0
fi
ident=$(python3 -I -c '
import json, os, stat, sys
def lire(chemin):   # 0.102.0 : le fichier est à hermes, lu par root : jamais un lien, un fichier ordinaire, 2 Mo au plus
    try:
        fd = os.open(chemin, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        try:
            st = os.fstat(fd)
            if not stat.S_ISREG(st.st_mode) or st.st_size > 2000000: return []
            return json.loads(os.read(fd, 2000001).decode("utf-8", "replace")).get("jobs") or []
        finally: os.close(fd)
    except (OSError, ValueError, AttributeError): return []
jobs = lire(sys.argv[1])
for j in jobs:
    if j.get("name") == "jarvis-reveil" and j.get("enabled", True) and j.get("state") != "paused":
        print(j.get("id")); break
' "$HH/cron/jobs.json")
[ -n "$ident" ] || { echo "Routine « reveil » absente ou en pause : rien à lancer."; exit 0; }
echo "$maint" > "$DER"
if hx hermes cron run "$ident" >/dev/null 2>&1; then echo "Routine « reveil » lancée."; else echo "Hermes a refusé le passage de « reveil »."; fi
exit 0
