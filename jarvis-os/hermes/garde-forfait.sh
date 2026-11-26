#!/bin/bash
# JARVIS OS — garde du forfait Claude partagé (choix du propriétaire du 23/11/2026 : seuil de 85 %, sur la
# semaine seulement).
#
# Hermes, JARVIS et les sessions de développement puisent dans le même forfait Max. Toutes les 10 minutes
# (hermes-garde.timer), ce script lit l'usage du forfait sans appel au modèle (`hermes usage --json`, la même
# lecture que /usage) : au-delà du seuil sur une fenêtre de la semaine (semaine, semaine Opus…), il arrête
# Hermes et prévient le propriétaire sur Telegram ; il le relance quand l'usage est redescendu sous le seuil
# moins 10 points (après la remise à zéro). Il ne relance jamais un Hermes qu'il n'a pas arrêté lui-même.
# La fenêtre de 5 heures (« Current session ») ne compte pas : le propriétaire la remplit lui-même en testant
# JARVIS OS (sa demande du 23/11/2026) ; HERMES_GARDE_CINQ_HEURES=1 dans /etc/hermes/garde.conf la remet.
#
# install.sh copie ce fichier dans /usr/local/sbin/hermes-garde-forfait (root) : la minuterie n'exécute
# jamais un fichier du dépôt, qui appartient à l'utilisateur jarvis.
set -uo pipefail

SEUIL=${HERMES_SEUIL_FORFAIT:-85}
[[ "$SEUIL" =~ ^[0-9]{1,3}$ ]] && [ "$SEUIL" -ge 10 ] && [ "$SEUIL" -le 100 ] || SEUIL=85
REPRISE=$((SEUIL - 10))
CINQ_HEURES=${HERMES_GARDE_CINQ_HEURES:-0}; [ "$CINQ_HEURES" = 1 ] || CINQ_HEURES=0   # 1 = la fenêtre de 5 heures compte aussi
ETAT=${HERMES_GARDE_ETAT:-/var/lib/hermes-garde/arret}     # présent = Hermes arrêté par ce garde
SERVICE=hermes-gateway.service

lire_usage() {
  if [ -n "${HERMES_GARDE_USAGE_CMD:-}" ]; then bash -c "$HERMES_GARDE_USAGE_CMD"; return; fi   # banc
  (cd /home/hermes && timeout 90 runuser -u hermes -- env -i HOME=/home/hermes USER=hermes LOGNAME=hermes LANG=C.UTF-8 \
    PATH=/home/hermes/.local/bin:/usr/bin:/bin HERMES_HOME=/home/hermes/.hermes HERMES_MANAGED_DIR=/etc/hermes \
    CLAUDE_SUBSCRIPTION_DIRECTSDK_COMMAND=/home/hermes/.local/lib/claude-code/node_modules/.bin/claude DISABLE_AUTOUPDATER=1 \
    hermes usage --json 2>/dev/null)
}
sctl() { if [ -n "${HERMES_GARDE_SYSTEMCTL:-}" ]; then "$HERMES_GARDE_SYSTEMCTL" "$@"; else systemctl "$@"; fi; }
prevenir() {   # un message Telegram au propriétaire ; le jeton ne passe jamais en argument d'un programme
  local texte=${1//\"/}; texte=${texte//\\/}
  if [ -n "${HERMES_GARDE_NOTIFIER:-}" ]; then "$HERMES_GARDE_NOTIFIER" "$texte"; return; fi
  local jeton qui
  jeton=$(sed -n 's/^TELEGRAM_BOT_TOKEN=//p' /home/hermes/.hermes/.env 2>/dev/null | tail -1)
  qui=$(sed -n 's/^TELEGRAM_ALLOWED_USERS=//p' /etc/hermes/.env 2>/dev/null | tail -1 | cut -d, -f1)
  [ -n "$jeton" ] && [ -n "$qui" ] || return 0
  printf 'url = "https://api.telegram.org/bot%s/sendMessage"\nsilent\nmax-time = 20\ndata-urlencode = "chat_id=%s"\ndata-urlencode = "text=%s"\n' \
    "$jeton" "$qui" "$texte" | curl -K - -o /dev/null || true
}

# Hermes arrêté (pas encore configuré, ou à la main) et pas par ce garde : rien à surveiller, aucune lecture
# (une lecture lance Hermes et la sonde de Claude Code : environ 0,2 à 0,45 Go pendant quelques secondes)
actif=$(sctl is-active "$SERVICE" 2>/dev/null || true)
if [ "$actif" != active ] && [ ! -f "$ETAT" ]; then echo "Hermes arrêté : rien à surveiller."; exit 0; fi

json=$(lire_usage) || { echo "Usage du forfait illisible : aucune décision."; exit 0; }
# le modèle d'Hermes (politique) : une fenêtre propre à un autre modèle (la semaine Sonnet de la voix de JARVIS) ne l'arrête pas
modele=$(sed -n 's/^  default: "\([a-z]*\)".*/\1/p' "${HERMES_GARDE_POLITIQUE:-/etc/hermes/config.yaml}" 2>/dev/null | head -1)
# Libellés du greffon : « Current session » (5 heures), « Current week », « <Modèle> week » ; une limite
# inconnue garde son nom brut et compte, par prudence.
lu=$(printf '%s' "$json" | MODELE="${modele:-opus}" CINQ="$CINQ_HEURES" python3 -I -c '
import json, os, sys
d = json.load(sys.stdin)
familles, modele = ("opus", "sonnet", "haiku", "fable", "mythos"), os.environ["MODELE"]
noms = {"current session": "fenêtre de 5 heures", "current week": "semaine"}
fen = []
for w in d.get("windows") or []:
    if not isinstance(w, dict) or not isinstance(w.get("used_percent"), (int, float)) or isinstance(w.get("used_percent"), bool):
        continue
    nom = str(w.get("label") or "forfait").lower()
    if any(f in nom for f in familles) and modele not in nom:
        continue
    if nom == "current session" and os.environ["CINQ"] != "1":
        continue
    n = noms.get(nom) or ("semaine " + nom[:-5].strip().capitalize() if nom.endswith(" week") else nom.strip())
    fen.append((w["used_percent"], w.get("resets_at") or "-", n))
if not fen:
    sys.exit(1)
p, r, n = max(fen, key=lambda x: x[0])
print(int(p), r.replace(" ", ""), n.replace(" ", "_"))
' 2>/dev/null) || { echo "Usage du forfait sans fenêtre chiffrée : aucune décision."; exit 0; }
read -r pct remise fenetre <<< "$lu"
fenetre=${fenetre//_/ }
heure=$(TZ=Europe/Paris date -d "$remise" '+le %d/%m à %H:%M' 2>/dev/null || echo "à la remise à zéro")

if [ "$pct" -ge "$SEUIL" ]; then
  if [ "$actif" = active ]; then
    sctl stop "$SERVICE"
    mkdir -p "$(dirname "$ETAT")"; printf '%s %s %s\n' "$pct" "$remise" "$fenetre" > "$ETAT"
    echo "Forfait à $pct % ($fenetre) : Hermes arrêté (seuil $SEUIL %)."
    prevenir "Hermes en pause : ton forfait Claude est à $pct % ($fenetre), au-delà de mon seuil de $SEUIL %. Je laisse le reste à JARVIS et je reprends après la remise à zéro, $heure."
  else
    echo "Forfait à $pct % ($fenetre) : Hermes déjà arrêté."
  fi
elif [ -f "$ETAT" ]; then
  if [ "$pct" -lt "$REPRISE" ]; then
    rm -f "$ETAT"
    sctl start "$SERVICE"
    echo "Forfait à $pct % ($fenetre) : Hermes relancé."
    prevenir "Hermes reprend : ton forfait Claude est à $pct % ($fenetre), sous mon seuil de reprise de $REPRISE %."
  else
    echo "Forfait à $pct % ($fenetre) : Hermes reste en pause jusqu'à moins de $REPRISE %."
  fi
else
  echo "Forfait à $pct % ($fenetre) : rien à faire (seuil $SEUIL %$([ "$CINQ_HEURES" = 1 ] || echo ', fenêtre de 5 heures ignorée'))."
fi
# le dernier usage lu, pour le bilan de la semaine d'Hermes (outil hermes_usage de JARVIS) : chiffres seulement, lisible par JARVIS
USAGE_JSON=${HERMES_GARDE_USAGE_JSON:-$(dirname "$ETAT")/usage.json}
mkdir -p "$(dirname "$USAGE_JSON")" 2>/dev/null && PCT="$pct" REMISE="$heure" FEN="$fenetre" ARRET="$([ -f "$ETAT" ] && echo 1 || echo 0)" python3 -I -c '
import json, os, sys, time
d = {"pct": int(os.environ["PCT"]), "remise": os.environ["REMISE"][:40], "fenetre": os.environ["FEN"][:40], "at": int(time.time()), "arret": os.environ["ARRET"] == "1"}
t = sys.argv[1] + ".tmp"; open(t, "w").write(json.dumps(d, ensure_ascii=False) + "\n"); os.chmod(t, 0o644); os.replace(t, sys.argv[1])
' "$USAGE_JSON" 2>/dev/null || true
exit 0
