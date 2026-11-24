#!/bin/bash
# JARVIS OS — poser les routines d'Hermes décrites dans routines.conf (étape 4 ; docs/hermes-deroule.md).
#
#   sudo bash /opt/rd/jarvis-os/hermes/routines.sh            (pose, recrée ce qui a changé, retire ce qui n'y est plus)
#   sudo bash /opt/rd/jarvis-os/hermes/routines.sh --liste    (ne change rien : montre ce qui est posé)
#
# Sans saisie : peut être confié à la session « Serveur JARVIS ». Les routines sont créées par la commande
# d'Hermes (`hermes cron`), en tant qu'utilisateur hermes ; Hermes lui-même ne peut ni en créer ni en changer
# (outil cronjob coupé dans la politique). Seules les routines nommées « jarvis-… » sont gérées ici.
# Le résultat de chaque passage part sur le Telegram du propriétaire ; une routine manquée (Hermes arrêté par le
# garde du forfait, serveur redémarré) est rejouée une fois au retour.
set -uo pipefail
[ "$(id -u)" = 0 ] || { echo "À lancer en root : sudo bash $0"; exit 1; }
ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
H=/home/hermes; HH=$H/.hermes
GERE=${HERMES_MANAGED_DIR:-/etc/hermes}                 # le banc en donne un autre
CONF=${HERMES_ROUTINES_CONF:-$ICI/routines.conf}
ETAT=${HERMES_ROUTINES_ETAT:-/etc/hermes/routines.etat}  # nom et empreinte de chaque ligne posée
SKILLS=/etc/hermes/skills
id hermes >/dev/null 2>&1 || { echo "Hermes n'est pas installé : sudo bash $ICI/install.sh"; exit 1; }
hx() { (cd "$H" && runuser -u hermes -- env -i HOME="$H" USER=hermes LOGNAME=hermes LANG=C.UTF-8 PATH="$H/.local/bin:/usr/bin:/bin" \
  HERMES_HOME="$HH" HERMES_MANAGED_DIR="$GERE" "$@"); }
poses() {   # « identifiant<TAB>nom<TAB>état<TAB>prochain passage » de chaque routine jarvis-… posée
  python3 -I -c '
import json, sys
try: jobs = json.load(open(sys.argv[1])).get("jobs") or []
except (OSError, ValueError): jobs = []
for j in jobs:
    n = str(j.get("name") or "")
    if n.startswith("jarvis-"):
        etat = "pause" if (j.get("state") == "paused" or not j.get("enabled", True)) else "actif"
        print("\t".join((str(j.get("id")), n, etat, str(j.get("next_run_at") or "-")[:16].replace("T", " "), str(j.get("last_status") or "jamais passée"))))
' "$HH/cron/jobs.json"
}
outils_de() {   # la liste exacte des outils d'une routine (enabled_toolsets) : `hermes cron create` n'a pas d'option pour elle
  python3 -I -c '
import json, os, sys
chemin, nom, outils = sys.argv[1], sys.argv[2], [x for x in sys.argv[3].split(",") if x]
d = json.load(open(chemin)); vus = [j for j in d.get("jobs") or [] if j.get("name") == nom]
if len(vus) != 1: sys.exit(1)
vus[0]["enabled_toolsets"] = outils
st = os.stat(chemin); tmp = chemin + ".jarvis"
with open(tmp, "w") as f: json.dump(d, f, ensure_ascii=False, indent=2)
os.chown(tmp, st.st_uid, st.st_gid); os.chmod(tmp, 0o600); os.replace(tmp, chemin)
' "$HH/cron/jobs.json" "$1" "$2"
}
lister() {
  local n=0
  while IFS=$'\t' read -r _ nom etat prochain dernier; do
    n=$((n + 1)); printf '  %-26s %-6s prochain passage : %s ; dernier : %s\n' "${nom#jarvis-}" "$etat" "$prochain" "$dernier"
  done < <(poses)
  [ "$n" -gt 0 ] || echo "  aucune routine posée"
}
if [ "${1:-}" = "--liste" ]; then lister; exit 0; fi

[ -f "$CONF" ] || { echo "Liste des routines introuvable : $CONF"; exit 1; }
[ -d "$SKILLS" ] || { echo "Skills du dépôt absentes ($SKILLS) : relance d'abord install.sh."; exit 1; }
if [ ! -s /etc/hermes/jarvis.env ] && [ "${HERMES_BANC:-0}" != 1 ]; then
  echo "Hermes n'est pas relié à JARVIS : ses routines n'auraient aucun outil. D'abord : sudo bash $ICI/relier-jarvis.sh"; exit 1
fi
qui=$(sed -n 's/^TELEGRAM_ALLOWED_USERS=//p' "$GERE/.env" 2>/dev/null | tail -1 | cut -d, -f1)
[[ "$qui" =~ ^[0-9]+$ ]] || { echo "Telegram n'est pas configuré (telegram.sh) : nulle part où envoyer le résultat des routines."; exit 1; }

touch "$ETAT" && chmod 0644 "$ETAT"
voulues=""; erreurs=0; nouvel_etat=$(mktemp)
while IFS= read -r ligne || [ -n "$ligne" ]; do
  case "$ligne" in ''|'#'*) continue ;; esac
  IFS='|' read -r nom etat horaire skills outils consigne <<< "$ligne"
  nom=$(echo $nom); etat=$(echo $etat); horaire=$(echo "$horaire" | sed 's/^ *//; s/ *$//'); skills=$(echo $skills | tr -d ' '); outils=$(echo $outils | tr -d ' ')
  consigne=$(printf '%s' "$consigne" | sed 's/^ *//; s/ *$//')
  if ! [[ "$nom" =~ ^[a-z0-9-]{2,40}$ ]] || ! [[ "$etat" =~ ^(actif|pause)$ ]] || [ "$(echo "$horaire" | wc -w)" != 5 ] \
     || ! [[ "$horaire" =~ ^[0-9*,/\ -]+$ ]] || ! [[ "$outils" =~ ^(-|[a-z0-9_,-]{2,120})$ ]] || [ "${#consigne}" -lt 10 ]; then
    echo "  ✗ ligne refusée (nom | actif ou pause | cron à 5 champs | skills | outils | consigne) : ${ligne:0:70}"; erreurs=$((erreurs + 1)); continue
  fi
  # une routine qui lit le web n'a jamais le serveur « jarvis » (mails, agenda, dossiers), et attend le jeton « Veilleur »
  case ",$outils," in
    *,web,*|*,search,*|*,browser,*)
      case ",$outils," in *,jarvis,*) echo "  ✗ $nom : le web et le serveur « jarvis » ne vont pas ensemble (prends « jarvis-web »)"; erreurs=$((erreurs + 1)); continue ;; esac ;;
  esac
  case ",$outils," in *,jarvis-web,*)
    if [ "${HERMES_BANC:-0}" != 1 ] && ! grep -q '^JARVIS_MCP_TOKEN_WEB=.' /etc/hermes/jarvis.env 2>/dev/null; then
      echo "  … $nom : en attente du jeton « Veilleur » (sudo bash $ICI/relier-jarvis.sh --web) ; pas posée"; continue
    fi ;;
  esac
  options=()
  for s in ${skills//,/ }; do
    [ -n "$(find "$SKILLS" -mindepth 2 -maxdepth 2 -type d -name "$s" 2>/dev/null)" ] || { echo "  ✗ $nom : skill « $s » absente de $SKILLS"; erreurs=$((erreurs + 1)); continue 2; }
    options+=(--skill "$s")
  done
  voulues="$voulues jarvis-$nom "
  empreinte=$(printf '%s|%s' "$ligne" "$qui" | sha256sum | cut -c1-16)
  ident=$(poses | awk -F'\t' -v n="jarvis-$nom" '$2 == n {print $1}' | head -1)
  if [ -n "$ident" ] && grep -qx "jarvis-$nom $empreinte" "$ETAT"; then
    echo "  = $nom : inchangée"; echo "jarvis-$nom $empreinte" >> "$nouvel_etat"; continue
  fi
  [ -n "$ident" ] && hx hermes cron remove "$ident" >/dev/null 2>&1
  [ "$etat" = pause ] && options+=(--paused --paused-reason "en pause dans routines.conf")
  if hx hermes cron create "$horaire" "$consigne" --name "jarvis-$nom" --deliver "telegram:$qui" --catch-up on --no-wrap-response "${options[@]}" >/dev/null 2>&1; then
    if [ "$outils" != "-" ] && ! outils_de "jarvis-$nom" "$outils"; then
      ident=$(poses | awk -F'\t' -v n="jarvis-$nom" '$2 == n {print $1}' | head -1); [ -n "$ident" ] && hx hermes cron remove "$ident" >/dev/null 2>&1
      echo "  ✗ $nom : sa liste d'outils n'a pas pu être écrite ; routine retirée plutôt que laissée avec les outils par défaut"; erreurs=$((erreurs + 1)); continue
    fi
    echo "  ✓ $nom : $([ -n "$ident" ] && echo recréée || echo posée) ($etat, $horaire$([ "$outils" != "-" ] && echo ", outils : $outils"))"; echo "jarvis-$nom $empreinte" >> "$nouvel_etat"
  else
    echo "  ✗ $nom : Hermes a refusé la routine (sudo -u hermes hermes cron create …)"; erreurs=$((erreurs + 1))
  fi
done < "$CONF"
# ce qui n'est plus dans la liste est retiré
while IFS=$'\t' read -r ident nom _; do
  case "$voulues" in *" $nom "*) ;; *) hx hermes cron remove "$ident" >/dev/null 2>&1 && echo "  − ${nom#jarvis-} : retirée (plus dans routines.conf)" ;; esac
done < <(poses)
mv "$nouvel_etat" "$ETAT" && chmod 0644 "$ETAT"

echo; echo "Routines d'Hermes :"; lister
[ "$(systemctl is-active hermes-gateway 2>/dev/null)" = active ] || [ "${HERMES_BANC:-0}" = 1 ] || echo "Attention : Hermes n'est pas en marche, aucune routine ne passera (sudo systemctl status hermes-gateway)."
[ "$erreurs" = 0 ] || { echo "$erreurs ligne(s) en erreur."; exit 1; }
