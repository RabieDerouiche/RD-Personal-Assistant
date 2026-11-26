#!/bin/bash
# Banc de la relance après la limite du forfait Claude (jarvis-os/hermes/limite.py, 26/11/2026) : faux usage, faux jobs.json
# d'Hermes, faux systemctl, faux « hermes cron run », dossiers inventés. Aucun réseau, aucun service touché.
# Lancer : bash essais/hermes/relance.test.sh
set -uo pipefail
ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); KIT=$ICI/../../jarvis-os/hermes; L=$KIT/limite.py
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
ok=0; ko=0
verif() { local nom=$1; shift; if "$@"; then ok=$((ok + 1)); echo "  ✓ $nom"; else ko=$((ko + 1)); echo "  ✗ $nom"; fi; }
py() { python3 -I -c "$@"; }

echo "== Reconnaître la limite et son heure de reprise"
Q=$(py 'import datetime; print(int(datetime.datetime(2026,11,26,9,20,tzinfo=datetime.timezone.utc).timestamp()))')   # 26/11, 10 h 20 à Paris
texte() { printf '%s' "$1" > "$T/t.txt"; python3 -I "$L" texte "$T/t.txt" --quand "$Q"; }
attendu() { py "import json,sys; d=json.loads(sys.argv[1]); sys.exit(0 if d['limite'] is $2 and d['reprise'] == $3 else 1)" "$(texte "$1")"; }
verif "« You've hit your 5-hour limit · resets 10:40am (UTC) » : la limite, reprise à 10 h 40 UTC le jour même" attendu "You've hit your 5-hour limit · resets 10:40am (UTC)" True $((Q + 4800))
verif "« resets 8am (UTC) » déjà passé ce jour-là : le lendemain" attendu "Error: You've hit your limit · resets 8am (UTC)" True $((Q + 81600))
verif "« resets 3pm (Europe/Paris) » : 14 h UTC en hiver" attendu "You've hit your limit · resets 3pm (Europe/Paris)" True $((Q + 16800))
verif "limite de la semaine « resets Dec 2, 7pm (Europe/Paris) » : le 2/12 à 18 h UTC" attendu "Opus weekly limit reached ∙ resets Dec 2, 7pm (Europe/Paris)" True $((Q + 6 * 86400 + 31200))
verif "ancien format « usage limit reached|<époque> »" attendu "Claude AI usage limit reached|$((Q + 3600))" True $((Q + 3600))
verif "429 avec « retry-after: 120s »" attendu "HTTP 429 Too Many Requests, retry-after: 120s" True $((Q + 120))
verif "« rate limit » sans heure : la limite, heure inconnue (le défaut de 30 minutes vient après)" attendu "RateLimitError: rate limit exceeded" True None
verif "une panne ordinaire n'est pas la limite" attendu "ConnectionError: Timeout talking to provider" False None
verif "une heure lue absurde (dans 3 semaines, pas une date) est écartée" attendu "Claude AI usage limit reached|$((Q + 21 * 86400))" True None

echo "== hermes-portail : la preuve qu'un passage coupé n'a pas joint le portail (relais filtrant)"
printf 'api.anthropic.com\nplatform.claude.com\n# commentaire\nclaude.ai\n' > "$T/defaut"
printf "Résultat : rien\nYou've hit your 5-hour limit · resets 10:40am (UTC)\n" > "$T/sortie-limite"; printf 'Résultat : soumise\n' > "$T/sortie-ok"
printf '2026-11-26 10:41:00 filtre prêt\n2026-11-26 10:41:03 permis api.anthropic.com\n2026-11-26 10:41:04 permis claude.ai\n' > "$T/j-claude"
printf '2026-11-26 10:41:03 permis api.anthropic.com\n2026-11-26 10:41:09 permis portail.exemple.invalid\n' > "$T/j-portail"
echo ERREUR > "$T/j-illisible"
passage() { python3 -I "$L" passage --sortie "$T/$1" --debut 100 --fin 200 --code 1 --journal "$T/$2" --claude "$T/defaut" --vers "$T/lim/derniere.json" > /dev/null; python3 -I "$L" verdict --fichier "$T/lim/derniere.json" --debut "${3:-100}"; }
verif "limite, seuls les hôtes de Claude joints : « avant » (relançable)" [ "$(passage sortie-limite j-claude)" = avant ]
verif "… derniere.json : root 600, sans aucune adresse d'hôte" bash -c "[ \"\$(stat -c %a '$T/lim/derniere.json')\" = 600 ] && ! grep -q 'exemple\|anthropic' '$T/lim/derniere.json'"
verif "limite, le portail joint avant la coupure : « apres » (jamais relancé)" [ "$(passage sortie-limite j-portail)" = apres ]
verif "limite, relais illisible : « apres » (pas de preuve, pas de relance)" [ "$(passage sortie-limite j-illisible)" = apres ]
verif "passage abouti (pas la limite) : « non »" [ "$(passage sortie-ok j-claude)" = non ]
passage sortie-limite j-claude > /dev/null
verif "… vérifié : verdict « non » pour une tâche commencée après ce passage" [ "$(python3 -I "$L" verdict --fichier "$T/lim/derniere.json" --debut 300)" = non ]
planif() { python3 -I "$L" planifier --dossier "$T/lim" --tache "$1" --cle "$2" --unite "$3" --depuis "$T/lim/derniere.json" > /dev/null; echo $?; }
c1=$(planif cra 2026-11-30:1 hermes-portail-cra.service)
verif "planifier : la première fois, relance prévue (code 0), demande posée pour la minuterie (root 600)" bash -c "[ '$c1' = 0 ] && [ -f '$T/lim/relance-cra.json' ] && [ \"\$(stat -c %a '$T/lim/relance-cra.json')\" = 600 ]"
verif "… une seconde coupure pour la même clé : plus de relance (code 3)" [ "$(planif cra 2026-11-30:1 hermes-portail-cra.service)" = 3 ]
verif "… une unité inconnue : refusée (code 2)" [ "$(planif cra autre-cle hermes-gateway.service)" = 2 ]
verif "attente : tant que la reprise annoncée n'est pas passée, les minuteries ne tentent rien" bash -c "python3 -I '$L' attente --dossier '$T/lim' --maintenant 0 > /dev/null"
verif "… et après la reprise, elles reprennent" bash -c "! python3 -I '$L' attente --dossier '$T/lim' --maintenant 9999999999 > /dev/null"

echo "== La relance (minuterie de 10 minutes)"
N=$((Q + 3 * 3600))   # 13 h 20 à Paris : la limite annoncée pour 11 h 40 est passée
iso() { py "import datetime,sys; print(datetime.datetime.fromtimestamp(int(sys.argv[1]), datetime.timezone.utc).isoformat())" "$1"; }
FAILED=$(iso $((Q))); NEXT=$(iso $((Q + 86400)))
cat > "$T/systemctl" <<'EOF'
#!/bin/bash
echo "$*" >> "$(dirname "$0")/appels"
case "$1" in
  is-active) cat "$(dirname "$0")/etat-passerelle" 2>/dev/null || echo active ;;
  is-failed) cat "$(dirname "$0")/echec-passerelle" 2>/dev/null || echo active ;;
  restart|start) exit 0 ;;
esac
EOF
printf '#!/bin/bash\necho "$1" >> "$(dirname "$0")/lances"\n' > "$T/lancer"; chmod +x "$T/systemctl" "$T/lancer"
printf 'model:\n  provider: "claude-subscription-directsdk-experimental"\n  default: "opus"\n' > "$T/politique.yaml"
usage() {   # usage <5 heures %> <semaine %>
  printf '{"windows": [{"label": "Current session", "used_percent": %s, "resets_at": "2026-11-26T10:40:00+00:00"}, {"label": "Current week", "used_percent": %s}, {"label": "Sonnet week", "used_percent": 100}]}' "$1" "$2" > "$T/usage.json"
}
jobs() {   # jobs <fichier> : trois routines coupées par la limite, une par une vraie panne, une saine, une en pause
  py "
import json, sys
f, failed, nxt = sys.argv[1:4]
lim = \"RuntimeError: You've hit your 5-hour limit · resets 10:40am (UTC)\"
J = [dict(id='a1', name='jarvis-veille-du-matin', enabled=True, state='scheduled', last_status='error', last_run_at=failed, last_error=lim, next_run_at=nxt),
     dict(id='b2', name='jarvis-prix-suivis', enabled=True, state='scheduled', last_status='error', last_run_at=failed, last_error=None,
          last_failure=dict(at=failed, detail='usage limit reached'), next_run_at=nxt),
     dict(id='c3', name='jarvis-digest-ia', enabled=True, state='scheduled', last_status='error', last_run_at=failed, last_error='ConnectionError: DNS', next_run_at=nxt),
     dict(id='d4', name='jarvis-bilan-hebdo', enabled=True, state='scheduled', last_status='ok', last_run_at=failed, next_run_at=nxt),
     dict(id='e5', name='jarvis-sorties-du-week-end', enabled=True, state='paused', last_status='error', last_run_at=failed, last_error=lim, next_run_at=nxt),
     dict(id='f6', name='autre-chose', enabled=True, state='scheduled', last_status='error', last_run_at=failed, last_error=lim, next_run_at=nxt)]
json.dump({'jobs': J}, open(f, 'w'))" "$1" "$FAILED" "$NEXT"
}
mkdir -p "$T/portail"; jobs "$T/jobs.json"; usage 100 40
relancer() { : > "$T/appels"; env HERMES_RELANCE_JOBS="$T/jobs.json" HERMES_RELANCE_ETAT="$T/etat" HERMES_RELANCE_AVIS="$T/avis" HERMES_RELANCE_PORTAIL="$T/portail" \
  HERMES_GARDE_ETAT="$T/garde-arret" HERMES_RELANCE_GARDE_COUPE="$T/garde-coupe" HERMES_GARDE_POLITIQUE="$T/politique.yaml" HERMES_RELANCE_SYSTEMCTL="$T/systemctl" HERMES_RELANCE_LANCER="$T/lancer" \
  HERMES_RELANCE_USAGE_CMD="${CMD:-touch $T/lu; cat $T/usage.json}" HERMES_RELANCE_MAINTENANT="${QUAND:-$N}" HERMES_RELANCE_JARVIS_U=nobody HERMES_RELANCE_PLAFOND="${PLAF:-12}" \
  python3 -I "$L" relancer "$@" > "$T/sortie" 2>&1; }
lances() { cat "$T/lances" 2>/dev/null | wc -l; }
QUAND=$((Q + 600)) relancer
verif "avant l'heure de reprise annoncée : rien de relancé, en attente" bash -c "[ $(lances) = 0 ] && grep -q 'en attente de la levée' '$T/sortie'"
relancer
verif "heure passée mais la fenêtre de 5 heures encore à 100 % : rien de relancé" bash -c "[ \"\$(cat '$T/lances' 2>/dev/null | wc -l)\" = 0 ] && grep -q 'limite toujours atteinte' '$T/sortie'"
verif "… la semaine Sonnet à 100 % ne compte pas (Hermes est sur Opus)" bash -c "! grep -q 'sonnet week' '$T/sortie'"
usage 3 40; avant=$(md5sum < "$T/etat/etat.json"); relancer --a-blanc
verif "à blanc, limite levée : dit ce qu'il relancerait, ne lance rien, n'écrit aucun état" bash -c "[ \"\$(cat '$T/lances' 2>/dev/null | wc -l)\" = 0 ] && grep -q 'À blanc : je relancerais la routine « veille-du-matin »' '$T/sortie' && [ \"\$(md5sum < '$T/etat/etat.json')\" = '$avant' ]"
relancer
verif "limite levée : les deux routines coupées par la limite relancées une fois (last_error, et last_failure du même passage)" bash -c "[ \"\$(sort '$T/lances' | paste -sd,)\" = 'a1,b2' ]"
verif "… une vraie panne (DNS), une routine saine, une routine en pause, une routine hors « jarvis- » : jamais relancées" bash -c "! grep -qE 'c3|d4|e5|f6' '$T/lances'"
verif "… état de root (700 et 600)" bash -c "[ \"\$(stat -c %a '$T/etat')\" = 700 ] && [ \"\$(stat -c %a '$T/etat/etat.json')\" = 600 ]"
verif "… une relance réussie ne dérange pas : aucun avis pour JARVIS" bash -c "! ls '$T/avis'/avis-*.json >/dev/null 2>&1"
verif "… le résumé pour JARVIS (etat.json, 640) : noms et heures, aucune erreur recopiée" bash -c "[ \"\$(stat -c %a '$T/avis/etat.json')\" = 640 ] && ! grep -qi 'hit your\|usage limit' '$T/avis/etat.json'"
relancer
verif "second passage de la minuterie : plus rien de relancé (une relance par échec)" bash -c "[ \"\$(wc -l < '$T/lances')\" = 2 ]"
# le passage relancé : veille-du-matin réussit, prix-suivis échoue de nouveau
py "
import json, sys
f, t = sys.argv[1], sys.argv[2]
d = json.load(open(f))
for j in d['jobs']:
    if j['name'] == 'jarvis-veille-du-matin': j.update(last_status='ok', last_run_at=t, last_error=None)
    if j['name'] == 'jarvis-prix-suivis': j.update(last_status='error', last_run_at=t, last_error=\"You've hit your 5-hour limit · resets 6pm (UTC)\", last_failure=dict(at=t, detail='usage limit'))
json.dump(d, open(f, 'w'))" "$T/jobs.json" "$(iso $((N + 300)))"
QUAND=$((N + 600)) relancer
verif "après la relance : la routine réussie est notée « réussie », sans avis" bash -c "grep -q 'veille-du-matin : le passage relancé a abouti' '$T/sortie' && grep -q '\"résultat\"\|réussie' '$T/avis/etat.json'"
verif "… celle qui échoue encore : un avis pour JARVIS (nom de la routine, quoi faire), et pas de seconde relance" bash -c "ls '$T/avis'/avis-*prix-suivis*.json >/dev/null 2>&1 && grep -q 'prix-suivis.*en échec après la relance' '$T/avis'/avis-*prix-suivis*.json && grep -q 'routines.sh --lancer prix-suivis' '$T/avis'/avis-*prix-suivis*.json && [ \"\$(wc -l < '$T/lances')\" = 2 ]"
verif "… l'avis : root et groupe de JARVIS, 640" bash -c "[ \"\$(stat -c %a \"\$(ls '$T/avis'/avis-*.json | head -1)\")\" = 640 ]"
QUAND=$((N + 7200)) relancer
verif "… même plus tard : jamais de seconde relance pour ce même échec" bash -c "[ \"\$(wc -l < '$T/lances')\" = 2 ]"

echo "== Rien à relancer : aucune lecture d'usage (pas de sonde inutile)"
rm -f "$T/lu"; QUAND=$((N + 7800)) relancer
verif "rien de coupé : l'usage du forfait n'est même pas lu" bash -c "[ ! -f '$T/lu' ] && grep -q 'Rien à relancer' '$T/sortie'"

echo "== Prochain passage proche, Hermes qui se reprend lui-même, Hermes arrêté"
rm -rf "$T/etat" "$T/avis" "$T/lances"; jobs "$T/jobs.json"; usage 3 40
py "
import json, sys
f, nxt = sys.argv[1], sys.argv[2]
d = json.load(open(f))
for j in d['jobs']:
    if j['name'] == 'jarvis-veille-du-matin': j['next_run_at'] = nxt
    if j['name'] == 'jarvis-prix-suivis': j['quota_hold_until'] = nxt
json.dump(d, open(f, 'w'))" "$T/jobs.json" "$(iso $((N + 1800)))"
relancer
verif "prochain passage dans moins d'une heure après la reprise : pas de relance en plus" bash -c "! grep -q a1 '$T/lances' 2>/dev/null && grep -q 'veille-du-matin : son prochain passage' '$T/sortie'"
verif "Hermes a déjà parqué la routine jusqu'à la réouverture (quota_hold_until) : il la reprend lui-même" bash -c "! grep -q b2 '$T/lances' 2>/dev/null && grep -q 'prix-suivis : Hermes la reprend lui-même' '$T/sortie'"
rm -rf "$T/etat" "$T/lances"; jobs "$T/jobs.json"; echo inactive > "$T/etat-passerelle"; relancer
verif "Hermes arrêté (à la main ou par le garde) : aucune routine lancée, la relance attend" bash -c "[ ! -s '$T/lances' ] && grep -q \"Hermes n'est pas en marche\" '$T/sortie'"
rm -f "$T/etat-passerelle"; relancer
verif "… Hermes revenu : les routines repartent" bash -c "[ \"\$(sort '$T/lances' | paste -sd,)\" = 'a1,b2' ]"

echo "== Plafond par jour"
rm -rf "$T/etat" "$T/avis" "$T/lances"; jobs "$T/jobs.json"; PLAF=1 relancer
verif "plafond d'une relance par jour : la seconde attend, un seul avis « plafond »" bash -c "[ \"\$(wc -l < '$T/lances')\" = 1 ] && [ \"\$(ls '$T/avis'/avis-*plafond*.json | wc -l)\" = 1 ]"
PLAF=1 relancer
verif "… second passage : toujours une seule relance, pas de second avis le même jour" bash -c "[ \"\$(wc -l < '$T/lances')\" = 1 ] && [ \"\$(ls '$T/avis'/avis-*plafond*.json | wc -l)\" = 1 ]"

echo "== La passerelle d'Hermes"
rm -rf "$T/etat" "$T/avis" "$T/lances"; printf '{"jobs": []}' > "$T/jobs.json"
echo failed > "$T/echec-passerelle"; relancer --a-blanc
verif "passerelle « failed », à blanc : rien redémarré" bash -c "! grep -q '^restart' '$T/appels' && grep -q 'je redémarrerais la passerelle' '$T/sortie'"
relancer
verif "passerelle « failed » (plantée) : redémarrée" grep -q '^restart hermes-gateway.service' "$T/appels"
relancer; relancer
verif "… au plus deux redémarrages par jour" bash -c "[ \"\$(grep -c '^restart' '$T/appels')\" = 0 ] && grep -q 'déjà redémarrée 2 fois' '$T/sortie'"
rm -rf "$T/etat"; touch "$T/garde-arret"; relancer
verif "arrêtée par le garde du forfait : jamais redémarrée ici (le garde décide)" bash -c "! grep -q '^restart' '$T/appels' && grep -q 'arrêtée par le garde' '$T/sortie'"
rm -rf "$T/etat" "$T/avis"; rm -f "$T/garde-arret"; touch "$T/garde-coupe"; relancer; relancer
verif "pendant la coupure du garde (garde.coupe) : pas redémarrée seule ; JARVIS prévenu une fois par jour" bash -c "! grep -q '^restart' '$T/appels' && [ \"\$(ls '$T/avis'/avis-*passerelle*.json 2>/dev/null | wc -l)\" = 1 ]"
rm -f "$T/garde-coupe"; echo inactive > "$T/echec-passerelle"; relancer
verif "arrêtée exprès (inactive, pas « failed ») : jamais redémarrée" bash -c "! grep -q '^restart' '$T/appels'"
rm -f "$T/echec-passerelle"

echo "== Les tâches d'hermes-portail coupées avant tout contact avec le portail"
rm -rf "$T/etat" "$T/avis" "$T/lances" "$T/portail"; mkdir -p "$T/portail"
py "import json,sys; json.dump({'unite': 'hermes-portail-cra.service', 'tache': 'cra', 'cle': '2026-11-30:1', 'reprise': int(sys.argv[2]), 'at': 1}, open(sys.argv[1] + '/relance-cra.json', 'w'))" "$T/portail" "$((Q + 4800))"
py "import json,sys; json.dump({'unite': 'hermes-gateway.service', 'tache': 'ndf', 'cle': 'x', 'reprise': 1}, open(sys.argv[1] + '/relance-ndf.json', 'w'))" "$T/portail"
usage 100 40; relancer
verif "limite pas levée : l'unité n'est pas relancée, la demande reste" bash -c "! grep -q '^start' '$T/appels' && [ -f '$T/portail/relance-cra.json' ]"
usage 3 40; relancer
verif "limite levée : l'unité relancée une fois (systemctl start --no-block), la demande retirée" bash -c "grep -q '^start --no-block hermes-portail-cra.service' '$T/appels' && [ ! -f '$T/portail/relance-cra.json' ]"
verif "… une demande pour une unité hors liste (la passerelle) : ignorée" bash -c "! grep -q 'start --no-block hermes-gateway' '$T/appels' && grep -q 'unité inconnue' '$T/sortie'"
rm -f "$T/portail/relance-ndf.json"; relancer
verif "… second passage : rien de relancé de nouveau" bash -c "! grep -q '^start' '$T/appels'"

echo "== Le kit"
verif "relance.sh : syntaxe, et refuse une option inconnue" bash -c "bash -n '$KIT/relance.sh' && grep -q 'limite.py\" relancer' '$KIT/relance.sh'"
verif "install.sh pose la copie root, la minuterie (toutes les 10 minutes, rattrapée) et les dossiers (700, avis 750)" bash -c "grep -q 'hermes-relance/limite.py' '$KIT/install.sh' && grep -q 'enable --now hermes-relance.timer' '$KIT/install.sh' && grep -q 'OnCalendar=\*-\*-\* \*:02/10:00' '$KIT/hermes-relance.timer' && grep -q 'Persistent=true' '$KIT/hermes-relance.timer' && grep -q 'hermes-relance-avis' '$KIT/install.sh'"
verif "l'unité n'exécute que la copie root (jamais le dépôt), sans variable du banc" bash -c "grep -q '^ExecStart=/usr/local/sbin/hermes-relance$' '$KIT/hermes-relance.service' && ! grep -q 'HERMES_RELANCE' '$KIT/hermes-relance.service'"
verif "le kit portail installe le même limite.py et les hôtes de Claude" bash -c "grep -q '../limite.py\" \"\$LIB/limite.py\"' '$KIT/portail/install.sh' && grep -q 'domaines.defaut\" \"\$LIB/domaines.defaut\"' '$KIT/portail/install.sh'"
verif "desinstaller.sh retire la relance" grep -q 'hermes-relance.timer' "$KIT/desinstaller.sh"

echo
echo "Relance après la limite : $ok vérifications réussies, $ko en échec."
[ "$ko" = 0 ]
