#!/bin/bash
# Banc des ordres de JARVIS pour les routines d'Hermes (jarvis-os/hermes/ordres.py, 0.96.0, 27/11/2026) : faux jobs.json, faux
# « hermes cron … », faux systemctl, faux registre d'exécutions, dossiers inventés. Aucun réseau, aucun service touché, Hermes
# jamais lancé. Lancer : bash essais/hermes/ordres.test.sh
set -uo pipefail
ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); KIT=$ICI/../../jarvis-os/hermes; O=$KIT/ordres.py
T=$(mktemp -d); trap '[ -n "${GARDER:-}" ] && echo "gardé : $T" || rm -rf "$T"' EXIT
ok=0; ko=0
verif() { local nom=$1; shift; if "$@"; then ok=$((ok + 1)); echo "  ✓ $nom"; else ko=$((ko + 1)); echo "  ✗ $nom"; fi; }
py() { python3 -I -c "$@"; }
mod() { py "
import importlib.util, sys
s = importlib.util.spec_from_file_location('ordres', sys.argv[1]); m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
n, h = m.nettoyer_erreur, m.horaire_de
$1" "$O"; }

echo "== L'erreur en détail : le nettoyage (textes piégés)"
verif "jetons et clés masqués : « sk-… », « Bearer … », « token=… », « api_key: … », mot de passe" mod "
r = n('RuntimeError: 401 Authorization: Bearer abcDEF123456ghi puis sk-ant-api03-JETONPIEGE et token=SECRETPIEGE1 api_key: \"CLEPIEGE\" password = hunter2PIEGE')
assert 'PIEGE' not in r and 'abcDEF' not in r and r.startswith('RuntimeError: 401'), r"
verif "préfixes connus : jeton GitHub, Slack, Google, AWS, JWT, jeton de bot Telegram" mod "
r = n('échec ghp_ABCDEFGHIJKLMNOP1234 xoxb-123456789-PIEGE AIzaSyA1234567890abcdefghijk AKIAABCDEFGHIJKLMNOP eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.PIEGEsignature 123456789:AAEabcdefghijklmnopqrstuvwxyz012345')
assert not any(x in r for x in ('ghp_', 'xoxb', 'AIza', 'AKIA', 'eyJ', 'AAE', 'PIEGE')), r"
verif "longues chaînes hexadécimales et base64, identifiant universel : masqués ; un mot ordinaire long reste" mod "
r = n('clé 0123456789abcdef0123456789abcdef et QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo0MTIzNDU2Nzg5 et 6f1c2d3e-0a1b-4c2d-8e3f-0123456789ab dans anticonstitutionnellement')
assert r == 'clé [masqué] et [masqué] et [masqué] dans anticonstitutionnellement', r"
verif "adresses mail masquées" mod "
r = n('SMTP 550 pour jean.dupont+test@exemple.fr et <marie@sous.exemple.com>')
assert '@' not in r and 'dupont' not in r and 'marie' not in r and r.count('[adresse mail]') == 2, r"
verif "chemins sous /home et /etc (et les autres dossiers du système) réduits au nom du fichier" mod "
r = n('File \"/home/hermes/.hermes/hermes-agent/cron/jobs.py\", line 12 ; lu /etc/hermes/jarvis.env et ~/.hermes/secret-chemin/notes.txt puis /var/lib/hermes-garde/usage.json')
assert r == 'File \"jobs.py\", line 12 ; lu jarvis.env et notes.txt puis usage.json', r"
verif "URL réduites à leur hôte (identifiants, port, chemin et paramètres retirés)" mod "
r = n('ConnectError: https://utilisateur:motdepassePIEGE@api.exemple.invalid:8443/v1/messages?cle=PIEGE&x=1 et http://autre.exemple.invalid/chemin/PIEGE')
assert r == 'ConnectError: api.exemple.invalid et autre.exemple.invalid', r"
verif "600 caractères au plus, 8 lignes au plus, une ligne rendue par ligne d'origine (160 caractères au plus)" mod "
r = n('\n'.join('ligne %d ' % i + 'mot ' * 80 for i in range(20)))
l = r.split('\n')
assert len(r) <= 600 and len(l) <= 8 and all(len(x) <= 160 for x in l) and l[0].startswith('ligne 0 ') and l[1].startswith('ligne 1 '), (len(r), len(l))
assert n('a\n\n\nb\r\nc\x00d\x1b[31m') == 'a\nb\nc d [31m' and n('') is None and n('   \n ') is None"
verif "un corps de mail cité (en-têtes De, Objet, lignes « > ») : seule la première ligne est gardée" mod "
r = n('ValueError: envoi impossible\nDe : Jean Exemple <jean@exemple.fr>\nObjet : relance de la facture PIEGE\n> Bonjour, voici le texte PIEGE du mail')
assert r == 'ValueError: envoi impossible', r
r = n('Erreur de remise\nLe 26 nov. 2026 à 10:02, Jean Exemple a écrit :\ntexte PIEGE')
assert r == 'Erreur de remise', r
r = n('From: jean@exemple.fr\nSubject: PIEGE\ncorps PIEGE')
assert r == '[contenu d\'un mail retiré]', r"
verif "un « Objet : … » en milieu de ligne coupe la ligne ; un long passage entre guillemets devient « […] »" mod "
r = n('Erreur en lisant le mail, Objet du mail : facture PIEGE de novembre')
assert 'PIEGE' not in r and r.startswith('Erreur en lisant le mail,'), r
r = n('le message « Bonjour, voici le texte PIEGE d\'un message assez long pour être un contenu cité et non un mot » a échoué')
assert r == 'le message « […] » a échoué', r"
verif "numéros longs (téléphone, carte, compte) et IBAN masqués ; une date et un code d'erreur restent" mod "
r = n('HTTP 503 le 2026-11-27T06:40:12 pour 06 12 34 56 78, carte 4970101234567890, FR76 3000 6000 0112 3456 7890 189')
assert r == 'HTTP 503 le 2026-11-27T06:40:12 pour [numéro], carte [numéro], [IBAN]', r"
verif "la commande « nettoyer » rend le même texte (entrée standard)" bash -c "[ \"\$(printf 'KeyError: /home/hermes/x.py sk-PIEGE123456' | python3 -I '$O' nettoyer)\" = 'KeyError: x.py [clé masquée]' ]"

echo "== L'horaire : de la forme fermée à l'expression (jamais un cron fourni par JARVIS)"
verif "du lundi au vendredi à 7 h 40 ; tous les jours à trois heures ; des jours choisis" mod "
assert h('ouvres', ['07:40']) == ('40 7 * * 1-5', None)
assert h('tous', ['09:15', '18:15', '13:15']) == ('15 9,13,18 * * *', None)
assert h(['sam', 'lun', 'dim'], ['08:30']) == ('30 8 * * 1,6,0', None)
assert h(['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'], ['08:00']) == ('0 8 * * *', None)"
verif "deux heures rapprochées acceptées (9 h 00 et 9 h 15) ; quatre passages en produit (9 h et 14 h, à 00 et à 30)" mod "
assert h('tous', ['09:00', '09:15']) == ('0,15 9 * * *', None)
assert h('tous', ['09:00', '09:30', '14:00', '14:30']) == ('0,30 9,14 * * *', None)"
verif "deux heures identiques n'en font qu'une" mod "
assert h('tous', ['09:00', '09:00']) == ('0 9 * * *', None) and h('ouvres', ['07:40', '07:40', '12:40']) == ('40 7,12 * * 1-5', None)"
verif "heure hors du pas de 5 minutes, heure impossible, forme illisible : refusées" mod "
assert h('tous', ['09:07']) == (None, 'pas') and h('tous', ['24:00']) == (None, 'heures') and h('tous', ['9:00']) == (None, 'heures')
assert h('tous', []) == (None, 'heures') and h('tous', '09:00') == (None, 'heures') and h('tous', [900]) == (None, 'heures')"
verif "cinq heures : refusé (quatre passages par jour au plus)" mod "
assert h('tous', ['06:00', '09:00', '12:00', '15:00', '18:00']) == (None, 'trop')"
verif "jour inconnu, liste vide, autre forme : refusés" mod "
assert h(['lundi'], ['09:00']) == (None, 'jours') and h([], ['09:00']) == (None, 'jours') and h('week-end', ['09:00']) == (None, 'jours') and h('1-5', ['09:00']) == (None, 'jours') and h(None, ['09:00']) == (None, 'jours')"
verif "des heures qui ne tiennent pas dans un seul horaire (7 h 40 et 13 h 15) : refusées, avec leur raison" mod "
assert h('tous', ['07:40', '13:15']) == (None, 'forme') and h('tous', ['09:00', '09:30', '14:00']) == (None, 'forme') and 'seul horaire' in m.RAISONS['forme']"
verif "l'aller-retour : la forme relue d'une expression construite (pour préremplir l'app)" mod "
f = m.L.forme_de
assert f('40 7 * * 1-5') == dict(jours='ouvres', heures=['07:40']) and f('0,15 9 * * *') == dict(jours='tous', heures=['09:00', '09:15'])
assert f('30 8 * * 1,6,0') == dict(jours=['lun', 'sam', 'dim'], heures=['08:30']) and f('*/10 * * * *') is None and f('0 9 1 * *') is None
assert m.L.moment_lisible('0,15 9 * * *') == 'chaque jour à 9 h et 9 h 15' and m.L.moment_lisible('0,30 9,14 * * 1-5') == 'du lundi au vendredi à 9 h, 9 h 30, 14 h et 14 h 30'"

echo "== Les ordres"
N=$(py 'import datetime; print(int(datetime.datetime(2026,11,27,13,2,tzinfo=datetime.timezone.utc).timestamp()))')   # 27/11, 14 h 02 à Paris
iso() { py "import datetime,sys; print(datetime.datetime.fromtimestamp(int(sys.argv[1]), datetime.timezone.utc).isoformat())" "$1"; }
cat > "$T/systemctl" <<'EOF'
#!/bin/bash
echo "$*" >> "$(dirname "$0")/appels"
case "$1" in
  is-active) cat "$(dirname "$0")/etat-passerelle" 2>/dev/null || echo active ;;
  is-failed) echo active ;;
esac
EOF
# le faux « hermes » : note l'appel et fait dans jobs.json ce que ferait la vraie commande
cat > "$T/hermes" <<'EOF'
#!/bin/bash
D=$(dirname "$0"); echo "$*" >> "$D/hermes-appels"
[ -f "$D/hermes-panne" ] && exit 1
python3 -I - "$D/jobs.json" "$@" <<'PY'
import json, sys
f, _, action, ident = sys.argv[1:5]
d = json.load(open(f))
for j in d["jobs"]:
    if j.get("id") != ident:
        continue
    if action == "pause": j.update(enabled=False, state="paused", paused_at="2026-11-27T14:02:00+01:00")
    if action == "resume": j.update(enabled=True, state="scheduled", paused_at=None)
    if action == "edit": j["schedule"] = dict(kind="cron", expr=sys.argv[6], display=sys.argv[6]); j["next_run_at"] = "2026-11-28T08:00:00+01:00"
json.dump(d, open(f, "w"))
PY
case "$2" in run) cat "$D/hermes-run" 2>/dev/null || echo "  It will run on the next scheduler tick." ;; esac
EOF
printf '#!/bin/bash\necho "$*" >> "$(dirname "$0")/systemd-run-appels"\n[ ! -f "$(dirname "$0")/systemd-run-refus" ]\n' > "$T/systemd-run"
chmod +x "$T/systemctl" "$T/hermes" "$T/systemd-run"
cp "$KIT/routines.conf" "$T/routines.conf"
jobs() {   # cinq routines posées (sorties-du-week-end ne l'est pas), saines, dernier passage hier
  py "
import json, sys
f, hier, demain = sys.argv[1:4]
J = [dict(id='id-' + n, name='jarvis-' + n, enabled=True, state='scheduled', schedule=dict(kind='cron', expr=e, display=e), last_status='ok', last_run_at=hier, last_error=None, next_run_at=demain)
     for n, e in (('veille-du-matin', '40 7 * * 1-5'), ('bilan-hebdo', '50 8 * * 1'), ('reveil', '15 9,13,18 * * *'), ('digest-ia', '10 9 * * 1'), ('prix-suivis', '0 9 * * *'))]
J.append(dict(id='id-pirate', name='jarvis-pirate', enabled=True, state='scheduled', last_status='ok', last_run_at=hier))
json.dump({'jobs': J}, open(f, 'w'))" "$T/jobs.json" "$(iso $((N - 86400)))" "$(iso $((N + 86400)))"
}
job() { py "
import json, sys
d = json.load(open(sys.argv[1])); j = {x['name'][7:]: x for x in d['jobs']}
exec(sys.argv[2]); json.dump(d, open(sys.argv[1], 'w'))" "$T/jobs.json" "$1"; }
jq() { py "
import json, sys
d = json.load(open(sys.argv[1])); j = {x['name'][7:]: x for x in d['jobs']}
sys.exit(0 if eval(sys.argv[2]) else 1)" "$T/jobs.json" "$1"; }
ordres() { : > "$T/appels"; env HERMES_RELANCE_JOBS="$T/jobs.json" HERMES_RELANCE_ETAT="$T/etat" HERMES_RELANCE_AVIS="$T/avis" HERMES_RELANCE_RESUME="$T/resume" HERMES_RELANCE_CONF="$T/routines.conf" \
  HERMES_RELANCE_MODES="$T/routines.mode" HERMES_GARDE_ETAT="$T/garde-arret" HERMES_RELANCE_GARDE_COUPE="$T/garde-coupe" HERMES_RELANCE_SYSTEMCTL="$T/systemctl" HERMES_RELANCE_JARVIS_U=nobody \
  HERMES_RELANCE_MAINTENANT="${QUAND:-$N}" HERMES_ROUTINES_PAUSES="$T/etat/routines.pause" HERMES_ROUTINES_HORAIRES="$T/etat/routines.horaire" HERMES_ORDRES_DOSSIER="${DOSSIER:-$T/ordres}" \
  HERMES_ORDRES_HERMES="$T/hermes" HERMES_ORDRES_EXEC_CMD="${EXEC-}" HERMES_ORDRES_ATTENTE=0 HERMES_ORDRES_SUR_PLACE="${SUR_PLACE-1}" HERMES_ORDRES_SYSTEMD_RUN="${SYSTEMD_RUN-}" HERMES_REVEIL_DERNIER="$T/reveil-dernier" \
  HERMES_ORDRES_LANCERS="${LANCERS:-12}" HERMES_ORDRES_HORAIRES="${HORAIRES:-6}" python3 -I "$O" "${@:-traiter}" > "$T/sortie" 2>&1; }
n=0
poser() {   # poser <routine> <action> [âge en secondes] [JSON en plus] : pose un ordre comme JARVIS, rend son identifiant
  n=$((n + 1)); ID=$(printf '%016x' $n)
  py "
import json, sys
ident, routine, action, at, plus, d = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), json.loads(sys.argv[5] or '{}'), sys.argv[6]
json.dump(dict(id=ident, routine=routine, action=action, at=at, **plus), open(d + '/ordre-' + ident + '.json', 'w'))" "$ID" "$1" "$2" "$(( ${QUAND:-$N} - ${3:-5} ))" "${4:-}" "$T/ordres"
}
res() {   # res <expression> : o = le résultat de l'ordre $ID, r = le résumé par routine, h = l'historique par routine
  py "
import json, os, sys
T, ident = sys.argv[1], sys.argv[2]
lire = lambda f: json.load(open(T + '/resume/' + f)) if os.path.exists(T + '/resume/' + f) else {}
O = {x['id']: x for x in lire('ordres.json').get('ordres', [])}; o = O.get(ident, {})
r = {x['nom']: x for x in lire('routines.json').get('routines', [])}; h = lire('historique.json').get('routines', {})
sys.exit(0 if eval(sys.argv[3]) else 1)" "$T" "$ID" "$1"; }
appels() { grep -c "$1" "$T/hermes-appels" 2>/dev/null || true; }
mkdir -p "$T/ordres"; jobs

poser veille-du-matin pause; ordres
verif "ordre valide « pause » : exécuté (hermes cron pause sur la bonne routine), la routine est en pause chez Hermes" bash -c "grep -qx 'cron pause id-veille-du-matin' '$T/hermes-appels' && [ \"\$(wc -l < '$T/hermes-appels')\" = 1 ]"
verif "… son nom et l'heure dans le fichier des pauses de root (600, dossier de root 700)" bash -c "[ \"\$(cat '$T/etat/routines.pause')\" = 'veille-du-matin $N' ] && [ \"\$(stat -c %a '$T/etat/routines.pause')\" = 600 ] && [ \"\$(stat -c %a '$T/etat')\" = 700 ]"
verif "… le résultat pour JARVIS : « fait », à quelle heure, sans raison (dossier 750, fichier 640)" res "o == dict(id='$ID', routine='veille-du-matin', action='pause', at=$N - 5, traite=$N, etat='fait', raison=None, reprise=None, fin=None, resultat=None, cause=None)"
verif "… droits du résultat" bash -c "[ \"\$(stat -c %a '$T/resume')\" = 750 ] && [ \"\$(stat -c %a '$T/resume/ordres.json')\" = 640 ]"
verif "… le résumé est récrit tout de suite : « en pause depuis le …, depuis JARVIS », plus de prochain passage" res "r['veille-du-matin']['active'] is False and r['veille-du-matin']['pause'] == dict(depuis='$(py "import datetime,sys; print(datetime.datetime.fromtimestamp($N, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))")', par='jarvis') and r['veille-du-matin']['prochain'] is None and r['prix-suivis']['pause'] is None"
verif "… le fichier d'ordre est retiré (dossier vide)" bash -c "[ -z \"\$(ls -A '$T/ordres')\" ]"
PAUSE_ID=$ID; cp "$T/resume/ordres.json" "$T/avant.json"
py "import json,sys; json.dump(dict(id=sys.argv[1], routine='veille-du-matin', action='reprendre', at=int(sys.argv[2])), open(sys.argv[3] + '/ordre-' + sys.argv[1] + '.json', 'w'))" "$PAUSE_ID" "$N" "$T/ordres"; ordres
verif "identifiant rejoué (le même, pour reprendre) : ignoré, rien n'est fait, le premier résultat reste" bash -c "[ \"\$(wc -l < '$T/hermes-appels')\" = 1 ] && grep -q 'déjà traité' '$T/sortie' && cmp -s '$T/avant.json' '$T/resume/ordres.json' && [ -z \"\$(ls -A '$T/ordres')\" ]"
poser veille-du-matin pause; ordres
verif "« pause » sur une routine déjà en pause : « fait », la date de la première pause reste, Hermes n'est pas rappelé" bash -c "[ \"\$(cat '$T/etat/routines.pause')\" = 'veille-du-matin $N' ] && [ \"\$(wc -l < '$T/hermes-appels')\" = 1 ]"
poser veille-du-matin lancer; ordres
verif "« lancer » une routine en pause : refusé (la reprendre d'abord), aucun passage" res "o['etat'] == 'refusé' and o['raison'] == 'pause'"
QUAND=$((N + 60)) poser veille-du-matin reprendre; QUAND=$((N + 60)) ordres
verif "« reprendre » : hermes cron resume, le fichier des pauses est vidé, le résumé la dit active" bash -c "grep -qx 'cron resume id-veille-du-matin' '$T/hermes-appels' && [ ! -s '$T/etat/routines.pause' ]"
verif "… (résumé)" res "o['etat'] == 'fait' and r['veille-du-matin']['active'] is True and r['veille-du-matin']['pause'] is None and r['veille-du-matin']['prochain'] is not None"
: > "$T/hermes-appels"
poser pirate pause; ordres
verif "routine hors de la liste fermée (jarvis-pirate existe chez Hermes, pas dans routines.conf) : refusé, Hermes jamais appelé" res "o['etat'] == 'refusé' and o['raison'] == 'routine' and o['routine'] is None"
poser '../../etc/passwd' pause; ordres
verif "nom de routine piégé : refusé, jamais recopié dans le résultat" bash -c "! grep -q passwd '$T/resume/ordres.json' && [ ! -s '$T/hermes-appels' ]"
poser prix-suivis supprimer; ordres
verif "action inconnue : refusée" res "o['etat'] == 'refusé' and o['raison'] == 'action' and o['action'] is None"
poser prix-suivis pause 700; ordres
verif "ordre vieux de plus de 10 minutes : refusé" res "o['etat'] == 'refusé' and o['raison'] == 'vieux'"
poser prix-suivis pause -300; ordres
verif "ordre daté dans le futur (plus de 2 minutes) : refusé" res "o['etat'] == 'refusé' and o['raison'] == 'vieux'"
poser prix-suivis pause 5 '{"commande": "rm -rf /"}'; ordres
verif "une clé en trop dans l'ordre : refusé (rien n'est lu comme une consigne)" res "o['etat'] == 'refusé' and o['raison'] == 'illisible'"
n=$((n + 1)); ID=$(printf '%016x' $n); printf '{"id": "%s", "routine": "prix-suivis", "action": "pause", "at": %s, "note": "%s"}' "$ID" "$N" "$(head -c 600 /dev/zero | tr '\0' x)" > "$T/ordres/ordre-$ID.json"; ordres
verif "ordre trop gros (plus de 512 octets) : refusé sans être lu" res "o['etat'] == 'refusé' and o['raison'] == 'illisible'"
n=$((n + 1)); ID=$(printf '%016x' $n); printf '{"id": "0000000000000000", "routine": "prix-suivis", "action": "pause", "at": %s}' "$N" > "$T/ordres/ordre-$ID.json"; ordres
verif "identifiant du contenu différent de celui du nom du fichier : refusé" res "o['etat'] == 'refusé' and o['raison'] == 'illisible'"
n=$((n + 1)); ID=$(printf '%016x' $n); printf '[1, 2' > "$T/ordres/ordre-$ID.json"; ordres
verif "JSON illisible : refusé" res "o['etat'] == 'refusé' and o['raison'] == 'illisible'"
n=$((n + 1)); ID=$(printf '%016x' $n); printf '{"id": "%s", "routine": "prix-suivis", "action": "pause", "at": %s}' "$ID" "$N" > "$T/cible.json"; ln -s "$T/cible.json" "$T/ordres/ordre-$ID.json"; ordres
verif "ordre posé comme un lien vers un ordre valide : refusé, jamais lu à travers ; le lien est retiré, sa cible intacte" bash -c "[ -f '$T/cible.json' ] && [ ! -e '$T/ordres/ordre-$ID.json' ] && [ ! -L '$T/ordres/ordre-$ID.json' ] && [ ! -s '$T/hermes-appels' ]"
verif "… (résultat : illisible)" res "o['etat'] == 'refusé' and o['raison'] == 'illisible'"
n=$((n + 1)); ID=$(printf '%016x' $n); printf '{"id": "%s", "routine": "prix-suivis", "action": "pause", "at": %s}' "$ID" "$N" > "$T/ordres/ordre-$ID.json"; ln "$T/ordres/ordre-$ID.json" "$T/second-nom.json"; ordres
verif "ordre à deux noms (lien dur) : refusé" res "o['etat'] == 'refusé' and o['raison'] == 'illisible'"
echo "note" > "$T/ordres/lisez-moi.txt"; mkdir "$T/ordres/dossier"; echo x > "$T/ordres/dossier/f"; echo "à garder" > "$T/garde.txt"; ln -s "$T/garde.txt" "$T/ordres/lien"; echo '{}' > "$T/ordres/ordre-XYZ.json"; ordres
verif "entrées inattendues (fichier, dossier, lien, nom mal formé) : retirées sans être lues, la cible du lien intacte ; le dossier finit vide" bash -c "[ -z \"\$(ls -A '$T/ordres')\" ] && [ \"\$(cat '$T/garde.txt')\" = 'à garder' ] && [ ! -s '$T/hermes-appels' ] && [ \"\$(grep -c 'Entrée inattendue' '$T/sortie')\" = 4 ]"
mkdir "$T/ailleurs"; echo "à garder" > "$T/ailleurs/precieux"; n=$((n + 1)); ID=$(printf '%016x' $n); printf '{"id": "%s", "routine": "prix-suivis", "action": "pause", "at": %s}' "$ID" "$N" > "$T/ailleurs/ordre-$ID.json"
ln -s "$T/ailleurs" "$T/lien-dossier"; DOSSIER="$T/lien-dossier" ordres
verif "dossier des ordres remplacé par un lien vers un autre dossier : rien n'y est lu ni retiré" bash -c "[ -f '$T/ailleurs/precieux' ] && [ -f '$T/ailleurs/ordre-$ID.json' ] && [ ! -s '$T/hermes-appels' ] && grep -q 'pas un vrai dossier' '$T/sortie'"
DOSSIER="$T/absent" ordres
verif "dossier des ordres absent : rien à faire, pas d'erreur" grep -q 'rien n.est lu' "$T/sortie"
touch "$T/hermes-panne"; poser prix-suivis pause; ordres; rm -f "$T/hermes-panne"
verif "Hermes refuse la commande : « refusé » (raison : Hermes), et la pause n'est pas notée chez root" bash -c "[ ! -s '$T/etat/routines.pause' ]"
verif "… (résultat)" res "o['etat'] == 'refusé' and o['raison'] == 'hermes'"
poser sorties-du-week-end pause; ordres
verif "routine de la liste pas posée chez Hermes : refusé (pas posée)" res "o['etat'] == 'refusé' and o['raison'] == 'pas-posee'"

echo "== Lancer maintenant"
rm -rf "$T/etat" "$T/resume"; : > "$T/hermes-appels"; jobs
poser prix-suivis lancer; ordres; L1=$ID
verif "ordre valide « lancer » : un passage dans le mode actuel (hermes cron run, le chemin de routines.sh --lancer), une seule fois" bash -c "[ \"\$(cat '$T/hermes-appels')\" = 'cron run id-prix-suivis' ] && grep -q 'prix-suivis : passage lancé depuis JARVIS (mode double)' '$T/sortie'"
verif "… le résultat : « en cours », demandé à 14 h 02" res "o['etat'] == 'en cours' and o['raison'] is None and o['traite'] == $N"
poser prix-suivis lancer; ordres
verif "second « lancer » pendant que le premier court : refusé (un passage est déjà en cours)" res "o['etat'] == 'refusé' and o['raison'] == 'en-cours'"
job "j['prix-suivis'].update(last_run_at='$(iso $((N + 240)))', last_status='delivery_queued')"
QUAND=$((N + 250)) ordres suivre; ID=$L1
verif "le passage vient de finir, son résultat est encore en cours d'envoi (« delivery_queued ») : l'ordre reste « en cours », le passage est déjà dans l'historique" res "o['etat'] == 'en cours' and h['prix-suivis'][-1]['ordre'] == '$L1' and h['prix-suivis'][-1]['resultat'] == 'ok'"
job "j['prix-suivis'].update(last_status='ok')"
EXEC="echo '[[\"id-prix-suivis\", \"completed\", \"$(iso $((N + 20)))\", \"$(iso $((N + 21)))\", \"$(iso $((N + 240)))\", null, null]]'" QUAND=$((N + 300)) ordres suivre
ID=$L1
verif "le passage fini : l'ordre passe à « terminé », avec l'heure de fin et le résultat" res "o['etat'] == 'terminé' and o['fin'] == '$(py "import datetime; print(datetime.datetime.fromtimestamp($N + 240, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))")' and o['resultat'] == 'ok' and o['cause'] is None"
verif "… l'historique : ce passage, « lancé à la main depuis JARVIS », son ordre, début, fin et durée (registre d'Hermes), le mode" res "h['prix-suivis'][-1]['lance'] == 'jarvis' and h['prix-suivis'][-1]['ordre'] == '$L1' and h['prix-suivis'][-1]['duree'] == 219 and h['prix-suivis'][-1]['mode'] == 'double' and h['prix-suivis'][-1]['resultat'] == 'ok' and h['prix-suivis'][-1]['erreur'] is None and len(h['prix-suivis']) == 2"
verif "… le passage d'hier, connu par jobs.json seulement : « programmé », sans durée" res "h['prix-suivis'][0]['lance'] == 'programme' and h['prix-suivis'][0]['duree'] is None and h['prix-suivis'][0]['debut'] is None"
QUAND=$((N + 200)) poser prix-suivis lancer; QUAND=$((N + 280)) ordres
verif "relancer la même routine moins de 5 minutes après : refusé, avec l'heure à partir de laquelle c'est possible" res "o['etat'] == 'refusé' and o['raison'] == 'trop-tot' and o['reprise'] == '$(py "import datetime; print(datetime.datetime.fromtimestamp($N + 300, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))")'"
echo inactive > "$T/etat-passerelle"; poser digest-ia lancer; ordres
verif "passerelle d'Hermes arrêtée : refusé (Hermes est arrêté)" res "o['etat'] == 'refusé' and o['raison'] == 'passerelle'"
rm -f "$T/etat-passerelle"; touch "$T/garde-arret"; poser digest-ia lancer; ordres; rm -f "$T/garde-arret"
verif "Hermes arrêté par le garde du forfait : refusé (le garde)" res "o['etat'] == 'refusé' and o['raison'] == 'garde'"
job "j['bilan-hebdo'].update(last_status='error', last_run_at='$(iso $((N - 600)))', last_error=\"RuntimeError: You've hit your 5-hour limit · resets 4:40pm (UTC)\")"
poser digest-ia lancer; ordres
verif "limite du forfait connue comme atteinte (un passage coupé, reprise annoncée pas passée) : refusé, avec l'heure de reprise ; l'usage n'est pas lu" res "o['etat'] == 'refusé' and o['raison'] == 'limite' and o['reprise'] == '2026-11-27T16:40:00Z'"
QUAND=$((N + 4 * 3600)) poser digest-ia lancer; job "j['digest-ia']['fire_claim'] = dict(at='$(iso $((N + 4 * 3600 - 90)))', by='machine:abc')"; QUAND=$((N + 4 * 3600)) ordres
verif "… l'heure de reprise passée : la limite ne bloque plus ; mais un passage de cette routine est en cours chez Hermes : refusé" res "o['etat'] == 'refusé' and o['raison'] == 'en-cours'"
job "j['digest-ia']['fire_claim'] = None"
echo "  Already being fired by the scheduler; not run again." > "$T/hermes-run"; QUAND=$((N + 4 * 3600)) poser digest-ia lancer; QUAND=$((N + 4 * 3600)) ordres; rm -f "$T/hermes-run"
verif "Hermes ne lance pas le passage (déjà pris par la passerelle) : « refusé » (Hermes), plus rien « en cours »" res "o['etat'] == 'refusé' and o['raison'] == 'hermes' and r['digest-ia']['en_cours'] is False"
rm -rf "$T/etat"; : > "$T/hermes-appels"
LANCERS=2 QUAND=$((N + 5 * 3600)) poser veille-du-matin lancer; LANCERS=2 QUAND=$((N + 5 * 3600)) poser reveil lancer; LANCERS=2 QUAND=$((N + 5 * 3600)) poser digest-ia lancer; LANCERS=2 QUAND=$((N + 5 * 3600)) ordres
verif "plafond du jour (ici 2 ; 12 en vrai) : le troisième lancement est refusé, deux passages seulement" bash -c "[ \"\$(grep -c '^cron run ' '$T/hermes-appels')\" = 2 ]"
verif "… (raison : plafond)" res "o['etat'] == 'refusé' and o['raison'] == 'plafond'"
job "j['veille-du-matin'].update(last_run_at='$(iso $((N + 5 * 3600 + 100)))', last_status='delivery_queued')"; QUAND=$((N + 5 * 3600 + 400)) ordres suivre
verif "… un envoi resté « en file » plus de 3 minutes n'empêche pas de solder l'ordre (terminé, réussi)" py "
import json, sys
o = [x for x in json.load(open(sys.argv[1]))['ordres'] if x['routine'] == 'veille-du-matin' and x['action'] == 'lancer'][-1]
sys.exit(0 if o['etat'] == 'terminé' and o['resultat'] == 'ok' else 1)" "$T/resume/ordres.json"
QUAND=$((N + 5 * 3600 + 3700)) ordres suivre
verif "un passage lancé à la main dont rien ne revient au bout d'une heure : « sans suite »" py "
import json, sys
o = [x for x in json.load(open(sys.argv[1]))['ordres'] if x['routine'] == 'reveil' and x['action'] == 'lancer'][-1]
sys.exit(0 if o['etat'] == 'sans suite' else 1)" "$T/resume/ordres.json"
rm -rf "$T/etat"; : > "$T/hermes-appels"; rm -f "$T/systemd-run-appels"
SUR_PLACE= SYSTEMD_RUN="$T/systemd-run" QUAND=$((N + 9 * 3600)) poser prix-suivis lancer; SUR_PLACE= SYSTEMD_RUN="$T/systemd-run" QUAND=$((N + 9 * 3600)) ordres
verif "sous systemd : le passage part dans une unité à part (hermes-ordre-<routine>), qui exécute la copie d'ordres.py, jamais un chemin du contenu de l'ordre" bash -c "grep -q -- '--unit=hermes-ordre-prix-suivis .* -- /usr/bin/python3 -I $(cd "$KIT" && pwd)/ordres.py passage prix-suivis $ID\$' '$T/systemd-run-appels' && [ ! -s '$T/hermes-appels' ]"
verif "… l'ordre est « en cours »" res "o['etat'] == 'en cours'"
ordres passage prix-suivis "$ID"
verif "… « passage » : seulement pour l'ordre en cours de cette routine (hermes cron run)" bash -c "[ \"\$(cat '$T/hermes-appels')\" = 'cron run id-prix-suivis' ]"
ordres passage prix-suivis 00000000000000ff; c1=$?; ordres passage pirate "$ID"; c2=$?
verif "… « passage » pour un autre ordre ou une routine hors liste : refusé, rien n'est lancé" bash -c "[ $c1 != 0 ] && [ $c2 != 0 ] && [ \"\$(wc -l < '$T/hermes-appels')\" = 1 ]"
rm -rf "$T/etat"; touch "$T/systemd-run-refus"; SUR_PLACE= SYSTEMD_RUN="$T/systemd-run" QUAND=$((N + 10 * 3600)) poser prix-suivis lancer; SUR_PLACE= SYSTEMD_RUN="$T/systemd-run" QUAND=$((N + 10 * 3600)) ordres; rm -f "$T/systemd-run-refus"
verif "… l'unité existe déjà (systemd-run refuse) : « refusé », un passage lancé à la main tourne déjà" res "o['etat'] == 'refusé' and o['raison'] == 'en-cours'"

echo "== Changer l'horaire"
rm -rf "$T/etat" "$T/resume"; : > "$T/hermes-appels"; jobs
poser veille-du-matin horaire 5 '{"jours": "tous", "heures": ["08:00", "08:15"]}'; ordres
verif "forme valide appliquée : root construit l'expression et la pose (hermes cron edit --schedule)" bash -c "[ \"\$(cat '$T/hermes-appels')\" = 'cron edit id-veille-du-matin --schedule 0,15 8 * * *' ]"
verif "… gardée dans le fichier des horaires de root (600)" bash -c "[ \"\$(cat '$T/etat/routines.horaire')\" = 'veille-du-matin|0,15 8 * * *' ] && [ \"\$(stat -c %a '$T/etat/routines.horaire')\" = 600 ]"
verif "… le résumé : horaire en vigueur en clair, « modifié », l'horaire d'origine en clair, la forme pour l'app, le prochain passage recalculé" res "o['etat'] == 'fait' and r['veille-du-matin']['moment'] == 'chaque jour à 8 h et 8 h 15' and r['veille-du-matin']['modifie'] is True and r['veille-du-matin']['origine'] == 'du lundi au vendredi à 7 h 40' and r['veille-du-matin']['forme'] == dict(jours='tous', heures=['08:00', '08:15']) and r['veille-du-matin']['prochain'] == '2026-11-28T07:00:00Z' and r['prix-suivis']['modifie'] is False and r['prix-suivis']['origine'] == 'chaque jour à 9 h'"
verif "… la routine lancée aussi par un événement est signalée (le réveil), pas les autres" res "r['reveil']['evenement'] is True and r['veille-du-matin']['evenement'] is False"
poser veille-du-matin horaire 5 '{"origine": true}'; ordres
verif "retour à l'horaire d'origine : la surcharge est retirée, l'horaire de routines.conf est reposé" bash -c "[ ! -s '$T/etat/routines.horaire' ] && tail -1 '$T/hermes-appels' | grep -qx 'cron edit id-veille-du-matin --schedule 40 7 \* \* 1-5'"
verif "… (résumé : plus « modifié »)" res "o['etat'] == 'fait' and r['veille-du-matin']['modifie'] is False and r['veille-du-matin']['moment'] == 'du lundi au vendredi à 7 h 40'"
: > "$T/hermes-appels"
poser prix-suivis horaire 5 '{"cron": "* * * * *"}'; ordres
verif "cron libre refusé (clé « cron ») : JARVIS n'envoie jamais une expression" res "o['etat'] == 'refusé' and o['raison'] == 'libre'"
poser prix-suivis horaire 5 '{"jours": "tous", "heures": ["* * * * *"]}'; ordres
verif "… ni glissée dans les heures" res "o['etat'] == 'refusé' and o['raison'] == 'heures'"
poser prix-suivis horaire 5 '{"jours": "tous", "heures": ["09:07"]}'; ordres
verif "heure hors du pas de 5 minutes : refusée" res "o['etat'] == 'refusé' and o['raison'] == 'pas'"
poser prix-suivis horaire 5 '{"jours": "tous", "heures": ["06:00", "09:00", "12:00", "15:00", "18:00"]}'; ordres
verif "cinq heures : refusé" res "o['etat'] == 'refusé' and o['raison'] == 'trop'"
poser prix-suivis horaire 5 '{"jours": ["lundi"], "heures": ["09:00"]}'; ordres
verif "jour inconnu : refusé" res "o['etat'] == 'refusé' and o['raison'] == 'jours'"
poser prix-suivis horaire 5 '{"jours": "tous", "heures": ["09:00"], "origine": true}'; ordres
verif "« origine » avec des heures, ou sans rien : refusé" res "o['etat'] == 'refusé' and o['raison'] == 'illisible'"
poser prix-suivis pause 5 '{"jours": "tous"}'; ordres
verif "des jours dans un ordre qui n'est pas « horaire » : refusé" res "o['etat'] == 'refusé' and o['raison'] == 'illisible'"
verif "… aucun de ces refus n'a touché Hermes ni le fichier des horaires" bash -c "[ ! -s '$T/hermes-appels' ] && [ ! -s '$T/etat/routines.horaire' ]"
poser prix-suivis horaire 5 '{"jours": "ouvres", "heures": ["09:00", "09:15"]}'; ordres
verif "deux heures rapprochées acceptées (9 h 00 et 9 h 15, du lundi au vendredi)" bash -c "grep -qx 'prix-suivis|0,15 9 \* \* 1-5' '$T/etat/routines.horaire'"
poser prix-suivis horaire 5 '{"jours": "ouvres", "heures": ["09:00", "09:00"]}'; ordres
verif "deux heures identiques : une seule gardée" bash -c "grep -qx 'prix-suivis|0 9 \* \* 1-5' '$T/etat/routines.horaire'"
verif "… (résumé : du lundi au vendredi à 9 h, modifié)" res "o['etat'] == 'fait' and r['prix-suivis']['moment'] == 'du lundi au vendredi à 9 h' and r['prix-suivis']['modifie'] is True"
touch "$T/hermes-panne"; poser digest-ia horaire 5 '{"jours": "tous", "heures": ["10:00"]}'; ordres; rm -f "$T/hermes-panne"
verif "Hermes refuse le changement : « refusé », le fichier des horaires revient à ce qu'il était" bash -c "! grep -q digest-ia '$T/etat/routines.horaire'"
HORAIRES=3 poser digest-ia horaire 5 '{"jours": "tous", "heures": ["10:00"]}'; HORAIRES=3 ordres
verif "plafond des changements d'horaire par jour (ici 3, quatrième refusé ; 6 en vrai)" res "o['etat'] == 'refusé' and o['raison'] == 'plafond'"

echo "== L'historique des passages"
rm -rf "$T/etat" "$T/resume" "$T/avis"; jobs; EXEC= ordres suivre
verif "premier passage : le dernier passage connu de chaque routine posée (5), droits 640, sans fichier temporaire laissé" res "sorted(h) == ['bilan-hebdo', 'digest-ia', 'prix-suivis', 'reveil', 'veille-du-matin'] and all(len(v) == 1 and v[0]['resultat'] == 'ok' and v[0]['lance'] == 'programme' for v in h.values())"
verif "… (droits)" bash -c "[ \"\$(stat -c %a '$T/resume/historique.json')\" = 640 ] && ! ls '$T/resume' | grep -q tmp"
ordres suivre
verif "second passage sans rien de neuf : l'historique ne change pas (jobs.json comparé au passage précédent)" res "all(len(v) == 1 for v in h.values())"
PIEGE="/home/hermes/.hermes/secret-chemin sk-ant-JETONPIEGE123 jean.dupont@exemple.fr https://portail.exemple.invalid/x?jeton=PIEGE"
job "j['digest-ia'].update(last_status='error', last_run_at='$(iso $((N + 60)))', last_error='ValueError: lecture impossible $PIEGE')
j['reveil'].update(last_status='error', last_run_at='$(iso $((N + 90)))', last_error='ConnectionError: DNS')
j['veille-du-matin'].update(last_status='delivery_failed', last_run_at='$(iso $((N + 120)))')"
echo "$((N + 75))" > "$T/reveil-dernier"; QUAND=$((N + 600)) ordres suivre
verif "un passage en erreur : sa catégorie et son texte NETTOYÉ (ni chemin, ni jeton, ni adresse, ni URL entière)" res "h['digest-ia'][-1]['resultat'] == 'erreur' and h['digest-ia'][-1]['cause'] == 'erreur' and h['digest-ia'][-1]['erreur'] == 'ValueError: lecture impossible secret-chemin [clé masquée] [adresse mail] portail.exemple.invalid'"
verif "… rien de brut dans les fichiers lus par JARVIS" bash -c "! grep -rqE 'JETONPIEGE|sk-ant|/home|dupont|jeton=' '$T/resume'"
verif "… le résumé des routines, lui, ne porte toujours que la catégorie (jamais le texte)" bash -c "! grep -q 'lecture impossible' '$T/resume/routines.json'"
verif "… réseau, résultat non envoyé : leurs catégories ; le réveil lancé par JARVIS est reconnu" res "h['reveil'][-1]['cause'] == 'réseau' and h['reveil'][-1]['lance'] == 'reveil' and h['veille-du-matin'][-1]['cause'] == 'résultat non envoyé' and h['veille-du-matin'][-1]['erreur'] is None"
# le registre d'exécutions d'Hermes : durées, passages manqués entre deux minuteries, lancés hors horaire ; la relance après la limite
mkdir -p "$T/etat"; py "import json,sys; json.dump({'historique': [{'nom': 'bilan-hebdo', 'at': int(sys.argv[2]), 'resultat': 'réussie'}]}, open(sys.argv[1], 'w'))" "$T/etat/etat.json" "$((N + 1000))"
job "j['bilan-hebdo'].update(last_status='ok', last_run_at='$(iso $((N + 1300)))', last_error=None)
j['prix-suivis'].update(last_status='ok', last_run_at='$(iso $((N + 1500)))')"
EXEC="echo '[[\"id-bilan-hebdo\", \"completed\", \"$(iso $((N + 1010)))\", \"$(iso $((N + 1012)))\", \"$(iso $((N + 1300)))\", null, null], [\"id-prix-suivis\", \"failed\", \"$(iso $((N + 1100)))\", \"$(iso $((N + 1101)))\", \"$(iso $((N + 1160)))\", \"$(iso $((N + 1100)))\", \"RuntimeError: sk-PIEGEPIEGE usage limit reached\"], [\"id-prix-suivis\", \"completed\", \"$(iso $((N + 1400)))\", null, \"$(iso $((N + 1500)))\", null, null], [\"id-pirate\", \"completed\", \"$(iso $((N + 1400)))\", null, \"$(iso $((N + 1500)))\", null, null], [\"id-reveil\", \"pirate\", 5, 6, 7, 8, 9], \"PIEGE\"]'" QUAND=$((N + 1800)) ordres suivre
verif "registre d'Hermes : un passage relancé après la limite est dit tel, avec sa durée" res "h['bilan-hebdo'][-1]['lance'] == 'limite' and h['bilan-hebdo'][-1]['duree'] == 288"
verif "… deux passages entre deux minuteries : les deux sont dans l'historique (l'un programmé et coupé par la limite, l'autre hors horaire)" res "[(p['resultat'], p['cause'], p['lance'], p['duree']) for p in h['prix-suivis'][-2:]] == [('erreur', 'limite du forfait', 'programme', 59), ('ok', None, 'main', 100)] and h['prix-suivis'][-2]['erreur'] == 'RuntimeError: [clé masquée] usage limit reached'"
verif "… lignes du registre piégées (routine hors liste, statut inconnu, forme fausse) : ignorées" bash -c "! grep -q 'pirate\|PIEGE' '$T/resume/historique.json'"
EXEC="echo 'pas du json'" QUAND=$((N + 1900)) ordres suivre; c=$?
verif "registre illisible : l'historique reste, sans erreur" bash -c "[ $c = 0 ]"
py "
import json, sys
f, n0 = sys.argv[1], int(sys.argv[2])
import datetime
iso = lambda t: datetime.datetime.fromtimestamp(t, datetime.timezone.utc).isoformat()
print(json.dumps([['id-reveil', 'completed', iso(n0 + 2000 + 80 * i), iso(n0 + 2001 + 80 * i), iso(n0 + 2030 + 80 * i), iso(n0 + 2000 + 80 * i), None] for i in range(45)]))" x "$N" > "$T/exec45.json"
EXEC="cat '$T/exec45.json'" QUAND=$((N + 6000)) ordres suivre
verif "30 passages gardés par routine, les plus récents" res "len(h['reveil']) == 30 and h['reveil'][-1]['fin'] == '$(py "import datetime; print(datetime.datetime.fromtimestamp($N + 2030 + 80 * 44, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))")'"
EXEC="cat '$T/exec45.json'" QUAND=$((N + 6600)) ordres suivre
verif "… et les passages plus anciens que l'historique gardé ne reviennent pas au passage suivant" res "len(h['reveil']) == 30 and h['reveil'][0]['fin'] == '$(py "import datetime; print(datetime.datetime.fromtimestamp($N + 2030 + 80 * 15, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))")'"
echo "contenu à ne pas toucher" > "$T/cible"; rm -f "$T/resume/historique.json"; ln -s "$T/cible" "$T/resume/historique.json"; ordres suivre
verif "l'historique remplacé par un lien : jamais écrit à travers" bash -c "[ \"\$(cat '$T/cible')\" = 'contenu à ne pas toucher' ] && [ ! -L '$T/resume/historique.json' ]"

echo "== La pause tient"
rm -rf "$T/etat" "$T/resume"; : > "$T/hermes-appels"; jobs
poser prix-suivis pause; ordres
job "j['prix-suivis'].update(enabled=True, state='scheduled', paused_at=None)"   # comme après une recréation ou un lancement à la main
QUAND=$((N + 600)) ordres suivre
verif "une routine en pause depuis JARVIS redevenue active chez Hermes : la pause est remise au passage de la minuterie" bash -c "[ \"\$(grep -c '^cron pause id-prix-suivis' '$T/hermes-appels')\" = 2 ] && grep -q 'prix-suivis : en pause depuis JARVIS mais active chez Hermes : pause remise' '$T/sortie'"
verif "… (elle l'est de nouveau)" jq "j['prix-suivis']['enabled'] is False"
QUAND=$((N + 1200)) ordres suivre
verif "… et rien de plus quand elle l'est déjà" bash -c "[ \"\$(grep -c '^cron pause id-prix-suivis' '$T/hermes-appels')\" = 2 ]"
poser prix-suivis pause; ordres suivre
verif "la minuterie rattrape un ordre que la surveillance du dossier aurait manqué" bash -c "[ -z \"\$(ls -A '$T/ordres')\" ]"
verif "… (traité)" res "o['etat'] == 'fait'"

echo "== Le kit"
verif "syntaxe : ordres.sh, relance.sh, routines.sh, install.sh" bash -c "bash -n '$KIT/ordres.sh' && bash -n '$KIT/relance.sh' && bash -n '$KIT/routines.sh' && bash -n '$KIT/install.sh'"
verif "install.sh pose la copie root d'ordres.py, le lanceur, les deux unités, le dossier des ordres (à jarvis, 700) et active la surveillance" bash -c "grep -q 'ordres.py\" /usr/local/lib/hermes-relance/ordres.py' '$KIT/install.sh' && grep -q 'ordres.sh\" /usr/local/sbin/hermes-ordres' '$KIT/install.sh' && grep -q 'install -d -o jarvis -g jarvis -m 0700 /var/lib/jarvis-reveil/ordres' '$KIT/install.sh' && grep -q 'enable --now hermes-ordres.path' '$KIT/install.sh'"
verif "le dossier des ordres est sous /var/lib/jarvis-reveil : aucun autre dossier d'écriture pour JARVIS" bash -c "grep -q '^DirectoryNotEmpty=/var/lib/jarvis-reveil/ordres$' '$KIT/hermes-ordres.path' && [ \"\$(grep -c 'install -d -o jarvis' '$KIT/install.sh')\" = 2 ]"
verif "l'unité n'exécute que la copie root (jamais le dépôt), sans variable du banc" bash -c "grep -q '^ExecStart=/usr/local/sbin/hermes-ordres$' '$KIT/hermes-ordres.service' && ! grep -q 'HERMES_ORDRES\|/opt/rd' '$KIT/hermes-ordres.service' && grep -q 'hermes-relance}/ordres.py' '$KIT/ordres.sh'"
verif "relance.sh : le suivi après la relance, jamais à blanc, sans changer son code de sortie" bash -c "grep -q 'ordres.py\" suivre' '$KIT/relance.sh' && grep -q 'exit \$code' '$KIT/relance.sh' && grep -q '!= --a-blanc' '$KIT/relance.sh'"
verif "routines.sh --pause et --reprendre : la même pause que celle de JARVIS, à la main sur le serveur" bash -c "grep -q -- '--pause|--reprendre)' '$KIT/routines.sh' && grep -q 'hermes cron pause \"\$ident\"' '$KIT/routines.sh' && grep -q 'hermes cron resume \"\$ident\"' '$KIT/routines.sh'"
verif "routines.sh respecte les pauses et les horaires de root (recréation, routine inchangée, --lancer refusé en pause)" bash -c "grep -q 'en pause depuis JARVIS\")' '$KIT/routines.sh' && grep -q 'horaire=\$hj' '$KIT/routines.sh' && grep -q 'cron edit \"\$ident\" --schedule' '$KIT/routines.sh' && grep -q 'la reprendre là-bas' '$KIT/routines.sh'"
verif "desinstaller.sh retire la surveillance des ordres" grep -q 'hermes-ordres.path' "$KIT/desinstaller.sh"
verif "ordres.py ne lit jamais l'usage du forfait et n'appelle d'Hermes que cron pause, resume, edit et run" py "
import re, sys
t = open(sys.argv[1], encoding='utf-8').read()
assert 'lire_usage' not in t and 'usage' not in t.split('def hermes(')[1].split('def jobs_connus')[0]
assert set(re.findall(r'hermes\(\"cron\", \"([a-z]+)\"', t)) == {'pause', 'resume', 'edit', 'run'}" "$O"

echo
echo "Ordres de JARVIS : $ok vérifications réussies, $ko en échec."
[ "$ko" = 0 ]
