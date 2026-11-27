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
  HERMES_RELANCE_RESUME="${RESUME:-$T/resume}" HERMES_RELANCE_CONF="${CONF:-$T/routines.conf}" HERMES_RELANCE_MODES="$T/routines.mode" \
  HERMES_ROUTINES_PAUSES="$T/routines.pause" HERMES_ROUTINES_HORAIRES="$T/routines.horaire" \
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
verif "… 0.96.0 : l'avis (une notification) porte la catégorie de l'erreur, jamais son texte" bash -c "grep -q 'de nouveau en échec (limite du forfait)' '$T/avis'/avis-*prix-suivis*.json && ! grep -qi 'hit your\|resets 6pm' '$T/avis'/avis-*prix-suivis*.json"
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

echo "== Le résumé des routines pour JARVIS (0.92.0 : « Hermes et ses routines » en direct)"
rm -rf "$T/etat" "$T/avis" "$T/lances" "$T/portail" "$T/resume"; mkdir -p "$T/portail"; rm -f "$T/garde-arret" "$T/garde-coupe" "$T/etat-passerelle" "$T/echec-passerelle" "$T/lu"
cp "$KIT/routines.conf" "$T/routines.conf"; printf 'veille-du-matin reel\nprix-suivis double\nprix-suivis reel\npirate reel\n' > "$T/routines.mode"
PIEGE="/home/hermes/.hermes/secret-chemin sk-ant-JETONPIEGE123 portail.exemple.invalid « Objet du mail : facture de novembre »"
resume_jobs() {   # resume_jobs <heure des erreurs> : une routine saine, trois en erreur (limite, réseau, autre), une en pause, une pas posée, des intrus
  py "
import json, sys
f, quand, piege = sys.argv[1:4]
J = [dict(id='a1', name='jarvis-veille-du-matin', enabled=True, state='scheduled', schedule=dict(kind='cron', expr='40 7 * * 1-5', display='40 7 * * 1-5'),
          last_status='ok', last_run_at='2026-11-26T07:40:12+01:00', last_error=None, next_run_at='2026-11-27T07:40:00+01:00'),
     dict(id='b2', name='jarvis-prix-suivis', enabled=True, state='scheduled', last_status='error', last_run_at=quand,
          last_error=\"RuntimeError: You've hit your 5-hour limit · resets 10:40am (UTC) \" + piege, next_run_at='2026-11-27T09:00:00+01:00'),
     dict(id='c3', name='jarvis-digest-ia', enabled=True, state='scheduled', last_status='error', last_run_at=quand, last_error='ValueError: ' + piege,
          last_failure=dict(at=quand, detail=piege), next_run_at='demain <script>alert(1)</script> /etc/passwd'),
     dict(id='d4', name='jarvis-reveil', enabled=True, state='scheduled', last_status='error', last_run_at=quand, last_error='ConnectionError: DNS ' + piege, next_run_at='2026-11-26T18:15:00+01:00'),
     dict(id='e5', name='jarvis-bilan-hebdo', enabled=False, state='paused', paused_at='2026-11-26T08:00:00+01:00', last_status=None, last_run_at=None, next_run_at=None),
     dict(id='p1', name='jarvis-pirate', enabled=True, state='scheduled', last_status='ok', last_run_at=quand, prompt=piege, next_run_at=quand),
     dict(id='p2', name='jarvis-veille-du-matin/../../etc', enabled=True, state='scheduled', last_status='ok', last_run_at=quand),
     dict(id='f6', name='autre-chose', enabled=True, state='scheduled', last_status='error', last_run_at=quand, last_error=piege)]
json.dump({'jobs': J, 'updated_at': quand}, open(f, 'w'))" "$T/jobs.json" "$1" "$PIEGE"
}
res() { py "
import json, sys
d = json.load(open(sys.argv[1])); r = {x['nom']: x for x in d['routines']}
sys.exit(0 if eval(sys.argv[2]) else 1)" "${RES:-$T/resume/routines.json}" "$1"; }
resume_jobs "$(iso $((N - 30 * 3600)))"; relancer; code=$?
verif "rien à relancer (erreurs de plus de 24 heures) : le résumé est écrit quand même, sans lire l'usage du forfait" bash -c "[ $code = 0 ] && grep -q 'Rien à relancer' '$T/sortie' && [ ! -f '$T/lu' ] && [ -f '$T/resume/routines.json' ]"
verif "… dossier 750, fichier 640 (root et groupe de JARVIS), écrit d'un coup (aucun fichier temporaire laissé)" bash -c "[ \"\$(stat -c %a '$T/resume')\" = 750 ] && [ \"\$(stat -c %a '$T/resume/routines.json')\" = 640 ] && [ \"\$(ls '$T/resume')\" = routines.json ]"
verif "… les six routines de routines.conf, dans l'ordre, avec leur libellé et leur horaire lisible" res "d['v'] == 1 and d['at'] == $N and d['liste'] is True and d['cron'] is True and list(r) == ['veille-du-matin', 'bilan-hebdo', 'reveil', 'digest-ia', 'prix-suivis', 'sorties-du-week-end'] and r['veille-du-matin']['libelle'] == 'Veille du matin' and r['digest-ia']['libelle'] == 'Digest IA et .NET' and r['veille-du-matin']['moment'] == 'du lundi au vendredi à 7 h 40' and r['reveil']['moment'] == 'chaque jour à 9 h 15, 13 h 15 et 18 h 15' and r['bilan-hebdo']['moment'] == 'le lundi à 8 h 50' and r['prix-suivis']['moment'] == 'chaque jour à 9 h' and r['sorties-du-week-end']['moment'] == 'le jeudi à 19 h'"
verif "… le mode noté sur le serveur l'emporte (routines.mode, la dernière ligne gagne) ; sinon celui de routines.conf" res "r['veille-du-matin']['mode'] == 'réel' and r['prix-suivis']['mode'] == 'réel' and r['digest-ia']['mode'] == 'double' and r['reveil']['mode'] == 'double'"
verif "… routine saine : ok, dernier et prochain passage en dates ISO refaites (UTC)" res "{k: r['veille-du-matin'][k] for k in ('nom', 'libelle', 'moment', 'mode', 'posee', 'active', 'dernier', 'resultat', 'cause', 'prochain')} == dict(nom='veille-du-matin', libelle='Veille du matin', moment='du lundi au vendredi à 7 h 40', mode='réel', posee=True, active=True, dernier='2026-11-26T06:40:12Z', resultat='ok', cause=None, prochain='2026-11-27T06:40:00Z')"
verif "… 0.96.0 : ce que la feuille de la routine affiche en plus (pas en pause, pas en cours, horaire d'origine en clair et non modifié, sa forme, pas d'événement)" res "{k: r['veille-du-matin'][k] for k in ('pause', 'en_cours', 'origine', 'modifie', 'forme', 'evenement')} == dict(pause=None, en_cours=False, origine='du lundi au vendredi à 7 h 40', modifie=False, forme=dict(jours='ouvres', heures=['07:40']), evenement=False) and sorted(r['veille-du-matin']) == sorted(['nom', 'libelle', 'moment', 'mode', 'posee', 'active', 'dernier', 'resultat', 'cause', 'prochain', 'pause', 'en_cours', 'origine', 'modifie', 'forme', 'evenement'])"
verif "… 0.96.0 : une routine en pause chez Hermes (pas depuis JARVIS) est dite « en pause depuis … » par Hermes ; le réveil se lance aussi sur un événement" res "r['bilan-hebdo']['pause'] == dict(depuis='2026-11-26T07:00:00Z', par='hermes') and r['reveil']['evenement'] is True and r['reveil']['forme'] == dict(jours='tous', heures=['09:15', '13:15', '18:15'])"
verif "… une erreur devient une catégorie courte : limite du forfait, réseau, ou « erreur »" res "[r[n]['resultat'] + ':' + str(r[n]['cause']) for n in ('prix-suivis', 'reveil', 'digest-ia')] == ['erreur:limite du forfait', 'erreur:réseau', 'erreur:erreur']"
verif "… assaini : ni le texte d'une erreur, ni un chemin, ni un jeton, ni un nom de portail, ni un contenu de mail, ni une date piégée" bash -c "! grep -qiE 'hit your|RuntimeError|ValueError|ConnectionError|/home|secret|JETONPIEGE|sk-ant|exemple|invalid|facture|Objet|script|passwd|demain' '$T/resume/routines.json'"
verif "… une date qui n'en est pas une : rien (jamais recopiée)" res "r['digest-ia']['prochain'] is None and r['digest-ia']['dernier'] == '$(py "import datetime,sys; print(datetime.datetime.fromtimestamp(int(sys.argv[1]), datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))" $((N - 30 * 3600)))'"
verif "… routine inconnue de routines.conf (jarvis-pirate, un nom piégé) ou hors « jarvis- » : ignorée, seulement comptée" bash -c "! grep -qE 'pirate|autre-chose|\\.\\./' '$T/resume/routines.json'"
verif "… (deux ignorées, six décrites)" res "d['inconnues'] == 2 and len(d['routines']) == 6"
verif "… en pause : pas active, jamais passée ; pas posée chez Hermes : dite « pas posée »" res "r['bilan-hebdo']['posee'] is True and r['bilan-hebdo']['active'] is False and r['bilan-hebdo']['resultat'] == 'jamais' and r['bilan-hebdo']['prochain'] is None and r['sorties-du-week-end']['posee'] is False and r['sorties-du-week-end']['resultat'] == 'jamais'"
py "
import json, sys
d = json.load(open(sys.argv[1]))
for j in d['jobs']:
    if j['name'] == 'jarvis-veille-du-matin': j['last_status'] = 'delivery_queued'
json.dump(d, open(sys.argv[1], 'w'))" "$T/jobs.json"; relancer
verif "0.96.0 : « delivery_queued » (passage réussi, résultat en cours d'envoi par la passerelle) est un passage réussi, pas une erreur" res "r['veille-du-matin']['resultat'] == 'ok' and r['veille-du-matin']['cause'] is None"
verif "… passerelle en marche, garde du forfait actif" res "d['passerelle'] == 'active' and d['garde'] == dict(etat='actif', jusqua=None)"
verif "… seuls des appels « is-active » et « is-failed » à systemd : rien n'est lancé ni redémarré" bash -c "! grep -qvE '^(is-active|is-failed) ' '$T/appels'"
echo failed > "$T/etat-passerelle"; echo "coupé jusqu'au 2026-12-03" > "$T/garde-coupe"; relancer
verif "passerelle plantée, garde coupé jusqu'à une date : dits tels quels" res "d['passerelle'] == 'plantée' and d['garde'] == dict(etat='coupé', jusqua='2026-12-03')"
echo inactive > "$T/etat-passerelle"; echo "coupé jusqu'au 2026-11-20" > "$T/garde-coupe"; touch "$T/garde-arret"; relancer
verif "passerelle arrêtée, coupure finie, Hermes arrêté par le garde : « a arrêté Hermes »" res "d['passerelle'] == 'arrêtée' and d['garde'] == dict(etat='a arrêté Hermes', jusqua=None)"
rm -f "$T/etat-passerelle" "$T/garde-coupe" "$T/garde-arret"
# 0.96.0 : ce qu'il a réglé depuis JARVIS (fichiers de root tenus par ordres.py) se lit dans le résumé ; un passage en cours aussi
printf 'veille-du-matin 1795000000\npirate 1795000000\nnom piégé 12\n' > "$T/routines.pause"; printf 'prix-suivis|0,15 9 * * 1-5\ndigest-ia|rm -rf /\npirate|0 9 * * *\nreveil|15 9,13,18 * * *\n' > "$T/routines.horaire"
py "
import json, sys
d = json.load(open(sys.argv[1]))
for j in d['jobs']:
    if j['name'] == 'jarvis-prix-suivis': j['schedule'] = dict(kind='cron', expr='0,15 9 * * 1-5'); j['fire_claim'] = dict(at=sys.argv[2], by='machine:abc')
    if j['name'] == 'jarvis-reveil': j['fire_claim'] = dict(at='2026-11-20T10:00:00+01:00', by='machine:vieux')
json.dump(d, open(sys.argv[1], 'w'))" "$T/jobs.json" "$(iso $((N - 100)))"
relancer
verif "0.96.0 : une pause posée depuis JARVIS est dite avec sa date, « par jarvis » (une ligne piégée ou hors liste du fichier de root est ignorée)" res "r['veille-du-matin']['pause'] == dict(depuis='2026-11-18T11:06:40Z', par='jarvis') and not any('pirate' in str(x) or 'piégé' in str(x) for x in d['routines'])"
verif "0.96.0 : un horaire changé depuis JARVIS : en vigueur en clair, « modifié », l'origine en clair ; une ligne piégée ou identique à l'origine ne compte pas" res "r['prix-suivis']['moment'] == 'du lundi au vendredi à 9 h et 9 h 15' and r['prix-suivis']['modifie'] is True and r['prix-suivis']['origine'] == 'chaque jour à 9 h' and r['prix-suivis']['forme'] == dict(jours='ouvres', heures=['09:00', '09:15']) and r['digest-ia']['modifie'] is False and r['reveil']['modifie'] is False"
verif "0.96.0 : un passage en cours (marque fraîche d'Hermes, moins de 5 minutes) est dit ; une vieille marque ne l'est pas" res "r['prix-suivis']['en_cours'] is True and r['reveil']['en_cours'] is False and r['veille-du-matin']['en_cours'] is False"
rm -f "$T/routines.pause" "$T/routines.horaire"
rm -rf "$T/resume"; relancer --a-blanc
verif "à blanc : aucun résumé écrit (rien n'est touché)" bash -c "[ ! -e '$T/resume' ] && grep -q 'Rien à relancer' '$T/sortie'"
echo "contenu à ne pas toucher" > "$T/cible"; mkdir -p "$T/resume"; ln -s "$T/cible" "$T/resume/routines.json"; ln -s "$T/cible" "$T/resume/routines.json.tmp"; relancer
verif "le résumé (ou son fichier temporaire) remplacé par un lien : jamais écrit à travers, le lien est remplacé par un vrai fichier" bash -c "[ \"\$(cat '$T/cible')\" = 'contenu à ne pas toucher' ] && [ ! -L '$T/resume/routines.json' ] && [ -f '$T/resume/routines.json' ] && [ ! -e '$T/resume/routines.json.tmp' ]"
CONF="$T/absente.conf" relancer
verif "copie root de routines.conf absente : résumé écrit sans aucune routine, et il le dit (« liste » fausse)" res "d['liste'] is False and d['routines'] == [] and d['inconnues'] == 7"
printf '{pas du json' > "$T/jobs.json"; relancer
verif "jobs.json illisible : le résumé le dit (« cron » faux), les routines connues restent « pas posées »" res "d['cron'] is False and len(d['routines']) == 6 and not any(x['posee'] for x in d['routines'])"
# l'écriture du résumé impossible ne change rien à la relance : mêmes relances, même code de sortie
rm -rf "$T/etat" "$T/avis" "$T/lances"; jobs "$T/jobs.json"; usage 3 40; echo "un fichier, pas un dossier" > "$T/bouche"
RESUME="$T/bouche/resume" relancer; code=$?
verif "résumé impossible à écrire : la relance se fait quand même (deux routines relancées, code 0), l'erreur est dite dans le journal sans détail" bash -c "[ $code = 0 ] && [ \"\$(sort '$T/lances' | paste -sd,)\" = 'a1,b2' ] && grep -q 'Résumé des routines pour JARVIS : pas écrit (NotADirectoryError)' '$T/sortie' && ! grep -q 'bouche' '$T/sortie'"
relancer
verif "… et avec une relance en cours, le résumé dit la routine en erreur par la limite (jamais son texte)" res "r['veille-du-matin']['resultat'] == 'erreur' and r['veille-du-matin']['cause'] == 'limite du forfait' and r['digest-ia']['cause'] == 'réseau' and r['bilan-hebdo']['resultat'] == 'ok'"
verif "horaires : cas simples lisibles, cas tordus rendus tels quels (« cron … »)" py "
import importlib.util, sys
s = importlib.util.spec_from_file_location('limite', sys.argv[1]); m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
f = m.moment_lisible
assert f('0 19 * * 4') == 'le jeudi à 19 h' and f('30 8 * * 6,0') == 'le samedi et le dimanche à 8 h 30' and f('5 6 * * 1-5') == 'du lundi au vendredi à 6 h 05'
assert f('*/10 * * * *') == 'cron */10 * * * *' and f('0 9 1 * *') == 'cron 0 9 1 * *' and f('0 9 * * 5-1') == 'cron 0 9 * * 5-1'" "$L"

echo "== Le kit"
verif "relance.sh : syntaxe, et refuse une option inconnue" bash -c "bash -n '$KIT/relance.sh' && grep -q 'limite.py\" relancer' '$KIT/relance.sh'"
verif "0.96.0 : relance.sh garde le code de sortie de la relance, puis lance le suivi des routines (ordres.py suivre), jamais à blanc" bash -c "grep -q 'relancer \"\$@\"; code=\$?' '$KIT/relance.sh' && grep -q 'ordres.py\" suivre' '$KIT/relance.sh' && tail -1 '$KIT/relance.sh' | grep -qx 'exit \$code'"
verif "install.sh pose la copie root, la minuterie (toutes les 10 minutes, rattrapée) et les dossiers (700, avis 750)" bash -c "grep -q 'hermes-relance/limite.py' '$KIT/install.sh' && grep -q 'enable --now hermes-relance.timer' '$KIT/install.sh' && grep -q 'OnCalendar=\*-\*-\* \*:02/10:00' '$KIT/hermes-relance.timer' && grep -q 'Persistent=true' '$KIT/hermes-relance.timer' && grep -q 'hermes-relance-avis' '$KIT/install.sh'"
verif "l'unité n'exécute que la copie root (jamais le dépôt), sans variable du banc" bash -c "grep -q '^ExecStart=/usr/local/sbin/hermes-relance$' '$KIT/hermes-relance.service' && ! grep -q 'HERMES_RELANCE' '$KIT/hermes-relance.service'"
verif "le kit portail installe le même limite.py et les hôtes de Claude" bash -c "grep -q '../limite.py\" \"\$LIB/limite.py\"' '$KIT/portail/install.sh' && grep -q 'domaines.defaut\" \"\$LIB/domaines.defaut\"' '$KIT/portail/install.sh'"
verif "desinstaller.sh retire la relance" grep -q 'hermes-relance.timer' "$KIT/desinstaller.sh"
verif "0.92.0 : install.sh pose la copie root de routines.conf et le dossier du résumé (root et groupe de JARVIS, 750) ; routines.sh rafraîchit la copie ; desinstaller.sh retire le dossier" bash -c "grep -q 'routines.conf\" /usr/local/lib/hermes-relance/routines.conf' '$KIT/install.sh' && grep -q 'id -gn jarvis)\" -m 0750 /var/lib/hermes-relance-etat' '$KIT/install.sh' && grep -q 'RELANCE_LIB/routines.conf' '$KIT/routines.sh' && grep -q '/var/lib/hermes-relance-etat' '$KIT/desinstaller.sh'"
verif "0.92.0 : le résumé n'ajoute ni lecture d'usage ni lancement d'Hermes (le code du résumé n'appelle que systemctl is-active)" py "
import re, sys
t = open(sys.argv[1], encoding='utf-8').read()
bloc = t[t.index('le résumé des routines, pour JARVIS'):t.index('def cmd_minuterie')]
assert 'lire_usage' not in bloc and 'lancer_routine' not in bloc and 'subprocess' not in bloc and 'HX' not in bloc
assert set(re.findall(r'sctl\(\"([a-z-]+)\"', bloc)) == {'is-active'}" "$L"

echo
echo "Relance après la limite : $ok vérifications réussies, $ko en échec."
[ "$ko" = 0 ]
