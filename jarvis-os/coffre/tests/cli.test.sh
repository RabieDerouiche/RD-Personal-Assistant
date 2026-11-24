#!/bin/bash
# Banc de la commande jarvis-coffre (la vraie, saisies comprises) devant un vrai service, dans un dossier temporaire.
# Données inventées, aucun réseau, rien d'installé : la commande est copiée avec ses trois chemins fixes réécrits
# (LIB, PRISE, NODE), rien d'autre. Un faux terminal (script -qec) reçoit chaque saisie seulement quand l'invite
# est affichée, comme une personne : ce qui est saisi ne doit apparaître ni à l'écran, ni dans un fichier, ni dans
# la liste des processus. En root (la commande l'exige) : sudo bash jarvis-os/coffre/tests/cli.test.sh
set -uo pipefail
[ "$(id -u)" = 0 ] || { echo "En root."; exit 1; }
ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); SRC=$ICI/..
NODE=$(command -v node) || { echo "Node introuvable."; exit 1; }
T=$(mktemp -d /tmp/coffre-cli-XXXXXX); PID=""
trap '[ -n "$PID" ] && kill "$PID" 2>/dev/null; rm -rf "$T"' EXIT
ok=0; ko=0
verif() { local nom=$1; shift; if "$@"; then ok=$((ok + 1)); echo "  ✓ $nom"; else ko=$((ko + 1)); echo "  ✗ $nom"; fi; }

PHRASE='castor-patient-range-9-galets-bleus'; PHRASE2='loutre-rieuse-garde-4-lanternes-vertes'; FAUSSE='pingouin-presse-perd-6-boutons'
V_GUICHET='mot-de-passe-de-site-INVENTE-51'; V_SERVICE='jeton "service" INVENTE $HOME \n é 100%'; V_TUBE='valeur-par-tube-INVENTEE-8d2'
mkdir -p "$T/lib" "$T/etat" "$T/p"; chmod 700 "$T/etat"
install -m 0644 "$SRC/coffre.mjs" "$SRC/client.mjs" "$T/lib/"
CLI=$T/jarvis-coffre
sed -e "s#^LIB=.*#LIB=$T/lib#" -e "s#^PRISE=.*#PRISE=$T/p/admin.sock#" -e "s#^NODE=.*#NODE=$NODE#" "$SRC/jarvis-coffre" > "$CLI"; chmod 755 "$CLI"
env -i PATH="$PATH" COFFRE_FICHIER="$T/etat/coffre.json" COFFRE_PRISES="$T/p" COFFRE_SCRYPT_N=4096 COFFRE_FREIN_MS=1500 "$NODE" "$T/lib/coffre.mjs" > "$T/service.log" 2>&1 & PID=$!
for i in $(seq 1 50); do [ -S "$T/p/admin.sock" ] && [ -S "$T/p/service.sock" ] && break; sleep 0.1; done

# nourrir <écran> <saisie>… : envoie chaque saisie quand une invite de plus est à l'écran (jamais avant : un terminal
# afficherait ce qui arrive avant que l'affichage soit coupé)
nourrir() {
  local ecran=$1 n=0 i s; shift
  for s in "$@"; do
    n=$((n + 1))
    for i in $(seq 1 100); do [ "$(grep -o 'rien ne s.affiche' "$ecran" 2>/dev/null | wc -l)" -ge "$n" ] && break; sleep 0.1; done
    sleep 0.3; printf '%s\n' "$s"
  done
  sleep 0.3
}
# saisie <étiquette> <arguments de la commande> -- <saisies…> : la commande dans un faux terminal ; écran dans $T/<étiquette>.ecran
saisie() {
  local e=$T/$1.ecran args=""; shift
  while [ "$1" != -- ]; do args="$args '$1'"; shift; done; shift
  : > "$e"; nourrir "$e" "$@" | script -qec "bash '$CLI'$args" /dev/null > "$e" 2>&1
}
service() {   # service <commande> [nom] : une demande à service.sock, réponse brute
  "$NODE" -e 'const c=require("net").createConnection(process.argv[1]);c.on("connect",()=>c.write(JSON.stringify({commande:process.argv[2],nom:process.argv[3]})+"\n"));c.on("data",(b)=>{process.stdout.write(b);c.destroy()})' "$T/p/service.sock" "$@"
}
lu() { service lire "$1" | "$NODE" -e 'let s="";process.stdin.on("data",(b)=>s+=b).on("end",()=>{try{const v=JSON.parse(s).valeur;if(typeof v==="string")process.stdout.write(v)}catch{}})'; }   # la valeur rendue par service.sock
vu() { grep -q -- "$2" "$T/$1.ecran"; }
sans_invite() { ! grep -q 'rien ne s.affiche' "$T/$1.ecran"; }
tous() { local c; for c in "$@"; do eval "$c" || return 1; done; }   # toutes les conditions, évaluées ici
# motifs par un descripteur, jamais par un argument : la recherche elle-même ne doit pas mettre un secret dans /proc
secrets() { printf '%s\n' "$PHRASE" "$PHRASE2" "$FAUSSE" "$V_GUICHET" "$V_SERVICE" "$V_TUBE" 'jeton \"service\" INVENTE'; }
nulle_part() { ! grep -rqaF -f <(secrets) "$@" 2>/dev/null; }
coffre_absent() { [ ! -e "$T/etat/coffre.json" ]; }

echo "Commande jarvis-coffre :"
bash "$CLI" etat > "$T/etat0.ecran" 2>&1
verif "etat avant tout : pas encore créé" vu etat0 'pas encore créé'
hors_terminal() { local c; for c in creer ouvrir "mettre abc" changer-phrase; do bash "$CLI" $c < /dev/null > "$T/hors.ecran" 2>&1; vu hors 'vrai terminal' || return 1; done; }
verif "hors d'un terminal : creer, ouvrir, mettre et changer-phrase refusent la saisie" hors_terminal
bash "$CLI" mettre abc valeur-en-argument > "$T/argument.ecran" 2>&1
verif "une valeur en argument est refusée" vu argument 'jamais la valeur en argument'
saisie creer1 creer -- "$PHRASE" "$PHRASE-autre"
verif "creer : deux saisies différentes → rien n'est fait" tous 'vu creer1 "saisies diffèrent"' coffre_absent
saisie creer2 creer -- 'trop-courte' 'trop-courte'
verif "creer : phrase trop courte → rien n'est fait" tous 'vu creer2 "trop courte"' coffre_absent
saisie creer3 creer -- "$PHRASE" "$PHRASE"
verif "creer : coffre créé et ouvert, rappel du gestionnaire de mots de passe, fichier en 0600" tous 'vu creer3 "Coffre créé et ouvert"' 'vu creer3 "Garde cette phrase dans ton gestionnaire de mots de passe"' '[ "$(stat -c %a "$T/etat/coffre.json")" = 600 ]'
saisie creer4 creer --
verif "creer une seconde fois : refusé avant toute saisie" tous 'vu creer4 "existe déjà"' 'sans_invite creer4'
saisie mettre1 mettre couches -- "$V_GUICHET" "$V_GUICHET"
verif "mettre <nom> : portée « guichet » par défaut" vu mettre1 'Secret « couches » ajouté (portée guichet)'
saisie mettre2 mettre jarvis-essai --portee service -- "$V_SERVICE" "$V_SERVICE"
verif "mettre --portee service : valeur à caractères spéciaux rendue à l'identique par service.sock" tous 'vu mettre2 "ajouté (portée service)"' '[ "$(lu jarvis-essai)" = "$V_SERVICE" ]'
saisie mettre3 mettre jarvis-autre --portee service -- "$V_SERVICE" "autre-chose"
verif "mettre : deux saisies différentes → rien n'est fait" tous 'vu mettre3 "saisies diffèrent"' '! grep -q jarvis-autre "$T/etat/coffre.json"'
printf '%s\n' "$V_TUBE" | bash "$CLI" mettre jarvis-tube --portee service --depuis-entree > "$T/tube.ecran" 2>&1
verif "mettre --depuis-entree (sans terminal, pour un script) : valeur prise sur l'entrée, sans son retour à la ligne" tous 'vu tube "jarvis-tube » ajouté"' '[ "$(lu jarvis-tube)" = "$V_TUBE" ]'
bash "$CLI" etat > "$T/etat1.ecran" 2>&1
verif "etat : ouvert, les trois secrets avec leur portée" tous 'vu etat1 "ouvert depuis"' 'grep -Eq "couches +guichet" "$T/etat1.ecran"' 'grep -Eq "jarvis-essai +service" "$T/etat1.ecran"' 'grep -Eq "jarvis-tube +service" "$T/etat1.ecran"'
service lire couches > "$T/guichet.ecran" 2>&1
verif "le secret « guichet » saisi ici n'est rendu à personne" tous 'vu guichet "\"ok\":false"' '[ -z "$(lu couches)" ]'
bash "$CLI" fermer > "$T/fermer.ecran" 2>&1; bash "$CLI" etat > "$T/etat2.ecran" 2>&1
verif "fermer : clé effacée, etat verrouillé" tous 'vu fermer "clé est effacée"' 'vu etat2 "verrouillé"'
saisie mettre4 mettre jarvis-tard --portee service --
verif "mettre, coffre verrouillé : refusé avant toute saisie" tous 'vu mettre4 "verrouillé"' 'sans_invite mettre4'
# mauvaise phrase : pendant que le service fait attendre sa réponse (frein), on fouille les lignes de commande et les environnements
saisie ouvrir1 ouvrir -- "$FAUSSE" & S=$!
for i in $(seq 1 200); do grep -q 'phrase refusée' "$T/service.log" && break; sleep 0.05; done
traces=$(grep -laF -f <(secrets) /proc/[0-9]*/cmdline /proc/[0-9]*/environ 2>/dev/null | wc -l)
vivants=$(pgrep -f "$T/lib/client.mjs" | wc -l)
wait $S
verif "pendant une ouverture en cours (client encore vivant après la fouille : $vivants) : la phrase n'est dans aucune ligne de commande ni aucun environnement" tous '[ "$vivants" -ge 1 ]' '[ "$traces" = 0 ]'
bash "$CLI" etat > "$T/etat3.ecran" 2>&1
verif "ouvrir, mauvaise phrase : refusé, coffre resté verrouillé" tous 'vu ouvrir1 "Refusé : phrase refusée"' 'vu etat3 "verrouillé"'
saisie ouvrir2 ouvrir -- "  $PHRASE "
bash "$CLI" etat > "$T/etat4.ecran" 2>&1
verif "ouvrir, bonne phrase (collée avec des espaces aux bords) : ouvert" tous 'vu ouvrir2 "Coffre ouvert"' 'vu etat4 "ouvert depuis"'
saisie ouvrir3 ouvrir --
verif "ouvrir, déjà ouvert : rien n'est demandé" tous 'vu ouvrir3 "déjà ouvert"' 'sans_invite ouvrir3'
bash "$CLI" retirer jarvis-tube > "$T/retirer.ecran" 2>&1; bash "$CLI" etat > "$T/etat5.ecran" 2>&1
verif "retirer : le secret n'est plus listé" tous 'vu retirer "retiré"' '! vu etat5 jarvis-tube' 'vu etat5 jarvis-essai'
saisie changer changer-phrase -- "$PHRASE" "$PHRASE2" "$PHRASE2"
bash "$CLI" fermer > /dev/null 2>&1
saisie ouvrir4 ouvrir -- "$PHRASE"
saisie ouvrir5 ouvrir -- "$PHRASE2"
verif "changer-phrase : l'ancienne phrase est refusée, la nouvelle ouvre, les secrets sont intacts" tous 'vu changer "Phrase changée"' 'vu changer "Mets la nouvelle phrase"' 'vu ouvrir4 "phrase refusée"' 'vu ouvrir5 "Coffre ouvert"' '[ "$(lu jarvis-essai)" = "$V_SERVICE" ]'
bash "$CLI" ouvre > "$T/inconnue.ecran" 2>&1; bash "$CLI" --help > "$T/aide.ecran" 2>&1
verif "commande inconnue ou aide : mode d'emploi, sans rien faire" tous 'vu inconnue "sudo jarvis-coffre ouvrir"' 'vu aide "changer-phrase"'

echo "Fuites :"
verif "écrans de toutes les saisies : ni phrase ni valeur (rien ne s'affiche, rien n'est répété)" nulle_part "$T"/*.ecran
verif "… et les invites y sont bien (les écrans ne sont pas vides)" tous '[ "$(cat "$T"/*.ecran | grep -o "rien ne s.affiche" | wc -l)" -ge 18 ]'
verif "journal du service et fichier du coffre : ni phrase ni valeur" nulle_part "$T/service.log" "$T/etat"
verif "journal du service : ouvertures, refus et fermetures y sont, sans erreur interne" tous 'grep -q "coffre ouvert" "$T/service.log"' 'grep -q "phrase refusée" "$T/service.log"' 'grep -q "clé effacée" "$T/service.log"' '! grep -q "erreur interne\|imprévue" "$T/service.log"'
# Lecture du code : une variable secrète (toutes nommées S_…) ne sert qu'à une commande interne de bash (printf, [ ],
# affectation), n'est jamais placée après un tube (donc jamais dans les arguments du client), ni dans $(…).
arguments_sans_secret() {
  local l apres n=0
  while IFS= read -r l; do
    n=$((n + 1))
    case "$l" in *'$('*|*'`'*) return 1 ;; esac
    apres=""; [[ "$l" == *'|'* ]] && apres=${l#*|}
    [[ "$apres" == *S_* ]] && return 1
    [[ "$l" =~ ^[[:space:]]*(printf\ |\[\ |S_[A-Z_]+=) ]] || return 1
  done < <(grep -E '\$\{?#?S_' "$SRC/jarvis-coffre")
  [ "$n" -ge 10 ]
}
verif "code de la commande : un secret ne sert qu'à des commandes internes de bash, jamais en argument d'un programme" arguments_sans_secret
verif "code de la commande : aucun réglage par l'environnement, trace d'exécution coupée (set +x)" tous '! grep -Eq "\\$\\{?(COFFRE|JARVIS)_" "$SRC/jarvis-coffre"' 'grep -q "^set +x" "$SRC/jarvis-coffre"'
client_strict() { ! "$NODE" "$T/lib/client.mjs" --prise "$T/p/admin.sock" ouvrir une-phrase-en-argument 2>/dev/null && ! "$NODE" "$T/lib/client.mjs" --prise "$T/p/admin.sock" mettre nom service valeur 2>/dev/null; }
verif "client : refuse tout argument en trop (aucune place pour un secret)" client_strict
chmod 666 "$T/lib/client.mjs"; bash "$CLI" etat > "$T/droits.ecran" 2>&1
verif "client modifiable par un autre que root : la commande refuse de lui confier une saisie" vu droits 'modifiable par un autre que root'
echo; echo "Commande jarvis-coffre : $ok vérifications réussies, $ko en échec."
[ $ko = 0 ]
