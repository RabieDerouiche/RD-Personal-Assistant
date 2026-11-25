#!/bin/bash
# Banc du Hermes « portail » (JARVIS OS ; docs/hermes-portail.md) : installe le kit jarvis-os/hermes/portail et
# jarvis-coffre dans le conteneur d'une session cloud (root, sans systemd), puis vérifie avec un faux portail et
# un faux modèle : la clé du coffre d'Hermes seulement en mémoire vive, l'enregistrement d'un identifiant, la
# connexion par le coffre, la lecture seule, la session gardée, le coffre verrouillé, un redémarrage simulé, le
# relais filtrant et les règles réseau. Données inventées seulement.
#
#   sudo bash essais/hermes/portail.test.sh          (réutilise une installation déjà faite par ce banc)
#   sudo bash essais/hermes/portail.test.sh --neuf   (efface l'utilisateur hermes-portail du conteneur et réinstalle)
#
# Ne jamais lancer sur le serveur : il crée un faux coffre et efface /home/hermes-portail avec --neuf.
set -uo pipefail
[ "$(id -u)" = 0 ] || { echo "En root."; exit 1; }
[ -e /run/systemd/system ] && { echo "Systemd tourne ici : ce n'est pas un conteneur de banc. Arrêt."; exit 1; }
ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); RACINE=$(cd "$ICI/../.." && pwd); KIT=$RACINE/jarvis-os/hermes/portail
T=/tmp/hermes-portail-banc; U=hermes-portail; H=/home/$U; HH=$H/hermes; RAM=/run/hermes-portail-cle
PM=40080; PP=40090; PC=40443; RELAIS=8891   # faux modèle, faux portail, cible du relais ; ports éphémères permis par sortie.nft
MDP='Banc-essai-0000'; PHRASE='phrase-du-banc-inventee-0123456789'
ok=0; ko=0
verif() { local nom=$1; shift; if "$@"; then ok=$((ok + 1)); echo "  ✓ $nom"; else ko=$((ko + 1)); echo "  ✗ $nom"; fi; }
propre() { sed 's/\x1b\[[0-9;?]*[A-Za-z]//g'; }
hp() { (cd $H && runuser -u $U -- env -i HOME=$H USER=$U LOGNAME=$U LANG=C.UTF-8 PATH=$H/.local/bin:/usr/bin:/bin HERMES_HOME=$HH \
  HERMES_MANAGED_DIR=/etc/hermes-portail NO_PROXY=localhost,127.0.0.1,::1 no_proxy=localhost,127.0.0.1,::1 "$@"); }
saisir() { local f=$T/rep.$RANDOM; printf '%b' "$1" > "$f"; shift; python3 -I "$ICI/pty_saisie.py" "$f" -- "$@" 2>&1 | propre; local rc=${PIPESTATUS[0]}; rm -f "$f"; return $rc; }
arreter() { pkill -f "faux_services.py $PM" 2>/dev/null; pkill -f "faux_portail.py --port $PP" 2>/dev/null; pkill -f "filtre.py --port $RELAIS" 2>/dev/null
  pkill -f "coffre.mjs" 2>/dev/null; pkill -f "http.server 8787" 2>/dev/null; pkill -f "http.server $PC" 2>/dev/null; pkill -u $U 2>/dev/null; true; }
coffre_lancer() { (cd / && COFFRE_SCRYPT_N=4096 COFFRE_FREIN_MS=200 nohup node /usr/local/lib/jarvis-coffre/coffre.mjs > $T/coffre.log 2>&1 &)
  for i in $(seq 1 50); do [ -S /run/jarvis-coffre/service.sock ] && break; sleep 0.1; done; }

arreter; sleep 0.5
if [ "${1:-}" = "--neuf" ]; then
  echo "== Remise à zéro du conteneur"
  umount $RAM 2>/dev/null; userdel -r $U 2>/dev/null; rm -rf $H /etc/hermes-portail /var/lib/hermes-portail /usr/local/lib/hermes-portail /usr/local/sbin/hermes-portail
fi
nft delete table inet hermes_portail_sortie 2>/dev/null
rm -rf $T /var/lib/jarvis-coffre /run/jarvis-coffre; mkdir -p $T/traces; chmod 755 $T; chmod 777 $T/traces
umount $RAM 2>/dev/null; rm -f $HH/vault/vault.json.enc 2>/dev/null; rm -rf $HH/navigateur 2>/dev/null   # le banc part d'un coffre d'Hermes vide

echo "== Installation (jarvis-coffre puis le kit portail, en mode banc)"
CA=/etc/ssl/certs/ca-certificates.crt
export SSL_CERT_FILE=$CA REQUESTS_CA_BUNDLE=$CA CURL_CA_BUNDLE=$CA NODE_EXTRA_CA_CERTS=$CA GIT_SSL_CAINFO=$CA npm_config_cafile=$CA
[ -x /usr/bin/node ] || ln -sf "$(command -v node)" /usr/bin/node
COFFRE_BANC=1 bash "$RACINE/jarvis-os/coffre/install.sh" > $T/coffre-install.log 2>&1; verif "jarvis-coffre installé (banc)" [ $? = 0 ]
install -d -m 0700 /var/lib/jarvis-coffre; install -d -m 0750 /run/jarvis-coffre
debut=$(date +%s)
HERMES_BANC=1 bash "$KIT/install.sh" > $T/install.log 2>&1; rc=$?
echo "  durée : $(( $(date +%s) - debut )) s, code $rc (journal : $T/install.log)"
verif "install.sh du kit portail se termine sans erreur" [ $rc = 0 ]
[ $rc = 0 ] || { tail -15 $T/install.log; echo "Banc arrêté : installation en échec."; exit 1; }
verif "Hermes v0.23.3 au commit figé, pour $U" bash -c "$(declare -f hp); H=$H; HH=$HH; U=$U; hp hermes --version 2>/dev/null | grep -q 'v0.23.3.*caafe5389ae5'"
verif "plugin de l'abonnement à la version figée (72eb3b8), comme le Hermes principal" grep -q 72eb3b87215e98d11cecfb26ca95b86be73b32de $HH/plugins/.install-metadata.json
verif "l'installeur contrôle les bibliothèques du navigateur (aucune absente)" grep -q 'Navigateur : toutes ses bibliothèques sont là' $T/install.log
verif "navigateur d'Hermes installé" bash -c "ls -d $HH/tools/chromium-* >/dev/null 2>&1"
verif "utilisateur sans shell, hors des groupes sudo, hermes, jarvis et du coffre" bash -c "[ \"\$(getent passwd $U | cut -d: -f7)\" = /usr/sbin/nologin ] && ! id -nG $U | tr ' ' '\\n' | grep -qxE 'sudo|adm|docker|lxd|hermes|jarvis|jarvis-coffre-clients'"
verif "politique root 0644, commande et relais en copies root" bash -c "[ \"\$(stat -c '%U %a' /etc/hermes-portail/config.yaml)\" = 'root 644' ] && [ \"\$(stat -c '%U %a' /usr/local/sbin/hermes-portail)\" = 'root 755' ] && [ \"\$(stat -c '%U' /usr/local/lib/hermes-portail/filtre.py)\" = root ]"
outils=$(hp hermes tools list --platform cli 2>/dev/null | propre | grep '✓ enabled' | awk '{print $3}' | sort | tr '\n' ' ')
verif "outils : seulement browser skills terminal ($outils)" [ "$outils" = "browser skills terminal " ]
verif "il ne peut pas changer ses outils (refusé)" bash -c "$(declare -f hp); H=$H; HH=$HH; U=$U; hp hermes config set agent.disabled_toolsets '[]' 2>&1 | grep -q 'managed by your administrator'"
verif "skill « portail » du dépôt active, à root" bash -c "$(declare -f hp); H=$H; HH=$HH; U=$U; hp hermes skills list 2>/dev/null | grep -q 'portail' && [ \"\$(stat -c %U /etc/hermes-portail/skills/portail/portail/SKILL.md)\" = root ]"
verif "unités valides (systemd-analyze verify)" bash -c "cd /etc/systemd/system && systemd-analyze verify --man=no ./hermes-portail-essai.service ./hermes-portail-filtre.service ./hermes-portail-sortie.service 2>&1 | grep -v 'hermes-portail-\(sortie\|filtre\).service.*not found\|Failed to prepare filename' | grep -c . | grep -qx 0"
verif "une commande aux espaces insécables (recopiée de l'iPhone) est comprise" bash -c "bash /usr/local/sbin/hermes-portail \$'domaines\xc2\xa0ajouter\xc2\xa0insecable.exemple.test' | grep -q 'Permis : insecable.exemple.test' && bash /usr/local/sbin/hermes-portail domaines retirer insecable.exemple.test >/dev/null"
verif "etat rend le code 0 sur une installation neuve (ni coffre, ni essai)" bash -c "bash /usr/local/sbin/hermes-portail etat >/dev/null 2>&1"
verif "la clé du coffre d'Hermes est un lien vers la mémoire vive, aucun fichier" bash -c "[ -L $HH/vault/vault.key ] && [ \"\$(readlink $HH/vault/vault.key)\" = $RAM/vault.key ]"

echo "== Faux modèle, faux portail, relais filtrant, règles réseau"
sed -e 's/^  provider: "claude-subscription-directsdk-experimental"/  provider: "custom"/' -e 's/^  default: "sonnet".*/  default: "faux-modele"/' /etc/hermes-portail/config.yaml > $T/config.yaml
cat $T/config.yaml > /etc/hermes-portail/config.yaml
hp hermes config set model.base_url "http://127.0.0.1:$PM/v1" >/dev/null
(cd /tmp && nohup python3 -I "$ICI/faux_services.py" $PM 40081 $T/traces > $T/faux.log 2>&1 &)
(cd /tmp && nohup python3 -I "$ICI/faux_portail.py" --port $PP --journal $T/traces/portail.jsonl --mot-de-passe "$MDP" > $T/portail.log 2>&1 &)
printf 'localhost\npermis.exemple.test\n' >> /etc/hermes-portail/domaines
(cd /tmp && nohup python3 -I /usr/local/lib/hermes-portail/filtre.py --port $RELAIS --domaines /etc/hermes-portail/domaines --ports 443,$PC --prives > $T/filtre.log 2>&1 &)
(cd /tmp && nohup python3 -I -m http.server $PC --bind 127.0.0.1 > /dev/null 2>&1 &)
(cd /tmp && nohup python3 -I -m http.server 8787 --bind 127.0.0.1 > /dev/null 2>&1 &)
for i in $(seq 1 50); do curl -s -o /dev/null --noproxy '*' http://127.0.0.1:$PP/sante && grep -q 'filtre prêt' $T/filtre.log 2>/dev/null && break; sleep 0.2; done
nft -f /etc/hermes-portail/sortie.nft
verif "règles réseau chargées" nft list table inet hermes_portail_sortie
verif "$U ne joint pas le faux JARVIS (127.0.0.1:8787)" bash -c "! runuser -u $U -- curl -s -m 3 -o /dev/null --noproxy '*' http://127.0.0.1:8787/"
verif "$U ne joint pas Internet en direct" bash -c "! runuser -u $U -- curl -s -m 4 -o /dev/null --noproxy '*' https://1.1.1.1/"
verif "$U n'a pas de DNS" bash -c "! runuser -u $U -- python3 -I -c 'import socket; socket.setdefaulttimeout(3); socket.getaddrinfo(\"exemple.org\", 443)' 2>/dev/null"
verif "$U joint le faux portail (port éphémère local)" runuser -u $U -- curl -s -m 3 -o /dev/null --noproxy '*' http://127.0.0.1:$PP/sante
verif "relais : hôte hors liste refusé (403)" bash -c "runuser -u $U -- env -i PATH=/usr/bin:/bin curl -s -m 5 -o /dev/null -w '%{http_connect}' --noproxy '' -x http://127.0.0.1:$RELAIS https://exemple.org/ | grep -q 403"
verif "relais : port hors liste refusé (403)" bash -c "runuser -u $U -- env -i PATH=/usr/bin:/bin curl -s -m 5 -o /dev/null -w '%{http_connect}' --noproxy '' -x http://127.0.0.1:$RELAIS https://localhost:8787/ | grep -q 403"
verif "relais : requête en clair refusée (seul CONNECT)" bash -c "runuser -u $U -- env -i PATH=/usr/bin:/bin curl -s -m 5 -o /dev/null -w '%{http_code}' --noproxy '' -x http://127.0.0.1:$RELAIS http://localhost:$PC/ | grep -q 405"
verif "relais : hôte de la liste permis (tunnel ouvert)" bash -c "runuser -u $U -- env -i PATH=/usr/bin:/bin curl -s -m 5 -o /dev/null -w '%{http_connect}' --noproxy '' -x http://127.0.0.1:$RELAIS https://localhost:$PC/ | grep -q 200; grep -q 'permis localhost' $T/filtre.log"
verif "relais : les refus sont notés avec l'hôte" grep -q 'refusé exemple.org (hôte absent de la liste)' $T/filtre.log
bash /usr/local/sbin/hermes-portail domaines ajouter https://Portail.Exemple.test/accueil > $T/dom.log 2>&1
verif "domaines ajouter : l'adresse est ramenée à son hôte" grep -qx 'portail.exemple.test' /etc/hermes-portail/domaines
verif "domaines ajouter : un texte qui n'est pas un hôte est refusé" bash -c "! bash /usr/local/sbin/hermes-portail domaines ajouter 'a b; rm' >/dev/null 2>&1"
bash /usr/local/sbin/hermes-portail domaines retirer portail.exemple.test >/dev/null 2>&1
verif "domaines retirer" bash -c "! grep -qx 'portail.exemple.test' /etc/hermes-portail/domaines"

echo "== Coffre en mémoire (jarvis-coffre) et enregistrement de l'identifiant"
coffre_lancer
verif "avant la création du coffre : enregistrer refuse et le dit" bash -c "$(declare -f saisir propre); T=$T; ICI=$ICI; saisir '' bash /usr/local/sbin/hermes-portail enregistrer | grep -q 'pas encore été créé'"
saisir "$PHRASE\n$PHRASE\n" /usr/local/sbin/jarvis-coffre creer > $T/creer.log 2>&1
verif "jarvis-coffre créé et ouvert" bash -c "/usr/local/sbin/jarvis-coffre etat | grep -qi 'ouvert'"
verif "enregistrer refuse hors d'un terminal" bash -c "bash /usr/local/sbin/hermes-portail enregistrer < /dev/null 2>&1 | grep -q 'vrai terminal'"
saisir "Faux portail du banc\nhttp://127.0.0.1:$PP\nemail\nbanc@exemple.test\n$MDP\n\n" bash /usr/local/sbin/hermes-portail enregistrer > $T/enregistrer.log 2>&1
verif "identifiant enregistré par Hermes" grep -q 'Stored. handle=vault_' $T/enregistrer.log
HANDLE=$(sed -n 's/.*handle=\(vault_[a-f0-9]*\).*/\1/p' $T/enregistrer.log | head -1)
verif "le mot de passe n'apparaît pas dans ce que le terminal a affiché" bash -c "! grep -q '$MDP' $T/enregistrer.log"
verif "la clé est en mémoire vive (ramfs), à $U seul" bash -c "[ \"\$(stat -f -c %T $RAM)\" = ramfs ] && [ \"\$(stat -c '%U %a' $RAM/vault.key)\" = '$U 600' ]"
verif "aucun fichier de clé sur le disque (toujours un lien)" bash -c "[ -L $HH/vault/vault.key ] && [ -z \"\$(find $H /etc/hermes-portail /var/lib/hermes-portail -type f -name 'vault.key' 2>/dev/null)\" ]"
CLE=$(cat $RAM/vault.key)
verif "la clé n'est écrite en clair nulle part sur le disque" bash -c "! grep -rqF -- '$CLE' $H /etc/hermes-portail /var/lib/hermes-portail /var/lib/jarvis-coffre $T 2>/dev/null"
verif "jarvis-coffre garde la clé (secret « hermes-portail-cle », portée service)" bash -c "/usr/local/sbin/jarvis-coffre etat | grep -q 'hermes-portail-cle'"
verif "etat : coffre ouvert, clé en mémoire, identifiant listé sans mot de passe" bash -c "bash /usr/local/sbin/hermes-portail etat > $T/etat.log 2>&1; grep -q 'jarvis-coffre : ouvert' $T/etat.log && grep -q 'en mémoire vive' $T/etat.log && grep -q 'vault_' $T/etat.log && ! grep -q '$MDP' $T/etat.log"

echo "== Essai : connexion au faux portail par le coffre, en lecture seule"
# Comme sur le serveur : l'unité du Hermes principal existe sur la machine. Le Hermes portail ne doit ni la chercher
# ni s'y accrocher (son dossier n'est pas ~/.hermes : docs/hermes-portail.md).
[ -e /etc/systemd/system/hermes-gateway.service ] || { printf '[Unit]\nDescription=faux Hermes principal (banc)\n' > /etc/systemd/system/hermes-gateway.service; FAUSSE_UNITE=1; }
suite() { cat > $T/consigne.txt <<FIN
Essai du banc. SUITE: [
 {"nom": "browser_exec", "args": {"code": "# Ouverture du faux portail\nnew_tab('http://127.0.0.1:$PP/tableau')\nwait_for_load()\nprint(page_info())"}},
 {"nom": "tool_call", "args": {"calls": [{"name": "browser_vault", "arguments": {"action": "list"}}]}},
 {"nom": "browser_exec", "args": {"code": "# Saisie de l'identifiant\nfill_input('#identifiant', 'banc@exemple.test')\nprint(js(\"document.querySelector('#identifiant') ? 'champ rempli' : 'pas de page de connexion'\"))"}},
 {"nom": "tool_call", "args": {"calls": [{"name": "browser_vault", "arguments": {"action": "fill", "handle": "$HANDLE"}}]}},
 {"nom": "browser_exec", "args": {"code": "# Connexion\njs(\"document.querySelector('#entrer') && document.querySelector('#entrer').click()\")\nwait_for_load()\nprint(page_info())"}},
 {"nom": "browser_exec", "args": {"code": "# Formulaire de dépense, sans soumettre\ngoto_url('http://127.0.0.1:$PP/depense/nouvelle')\nwait_for_load()\nprint(js(\"Array.from(document.querySelectorAll('input,button')).map(e => e.id).join(',')\"))"}},
 {"nom": "browser_exec", "args": {"code": "# Enregistrement de la session\nimport time\ntime.sleep(32)\nprint('session enregistrée')", "timeout_s": 90}}
]
FIN
}
suite; : > $T/traces/portail.jsonl
bash /usr/local/sbin/hermes-portail essai "http://127.0.0.1:$PP/tableau" --consigne-fichier $T/consigne.txt > $T/essai1.log 2>&1; rc=$?
verif "essai : code 0, alors que l'unité du Hermes principal est présente sur la machine" bash -c "[ $rc = 0 ] && [ -e /etc/systemd/system/hermes-gateway.service ]"
verif "le faux portail a reçu une connexion réussie (bon identifiant, mot de passe de la bonne longueur)" grep -q '"evenement": "connexion", "reussie": true, "identifiant_recu": "banc@exemple.test", "longueur_mot_de_passe": '${#MDP} $T/traces/portail.jsonl
verif "Hermes a lu le tableau de bord et ouvert le formulaire" bash -c "grep -q '\"evenement\": \"tableau\"' $T/traces/portail.jsonl && grep -q '\"evenement\": \"formulaire\"' $T/traces/portail.jsonl && grep -q 'libelle,montant,date,soumettre' $T/essai1.log"
verif "rien n'a été soumis" bash -c "! grep -q SOUMISSION $T/traces/portail.jsonl"
verif "le mot de passe n'est jamais parti vers le modèle" bash -c "! grep -q '$MDP' $T/traces/modele.jsonl"
verif "la clé du coffre n'est jamais partie vers le modèle" bash -c "! grep -qF -- '$CLE' $T/traces/modele.jsonl"
verif "le modèle n'a reçu que les outils du navigateur, du terminal et des skills" bash -c "python3 -I - $T/traces/modele.jsonl <<'PY'
import json, sys
c = [json.loads(l) for l in open(sys.argv[1])][-1]['corps']
noms = sorted(t['function']['name'] for t in c.get('tools') or [])
sys.exit(0 if 'browser_exec' in noms and not [n for n in noms if n.startswith(('web_', 'read_file', 'write_file', 'memory', 'cronjob', 'delegate'))] else 1)
PY"
verif "le résultat de l'essai est gardé pour root seul" bash -c "f=\$(ls -1t /var/lib/hermes-portail/essais/*.txt | head -1) && [ \"\$(stat -c '%U %a' \$f)\" = 'root 600' ] || [ \"\$(stat -c '%a' /var/lib/hermes-portail/essais)\" = 700 ]"

echo "== Second essai : la session du portail est gardée par le navigateur"
: > $T/traces/portail.jsonl
bash /usr/local/sbin/hermes-portail essai "http://127.0.0.1:$PP/tableau" --consigne-fichier $T/consigne.txt > $T/essai2.log 2>&1
verif "le portail n'a pas redemandé de connexion (session encore ouverte)" bash -c "grep -q '\"evenement\": \"tableau\"' $T/traces/portail.jsonl && ! grep -q '\"evenement\": \"connexion\"' $T/traces/portail.jsonl && ! grep -q 'sans-session' $T/traces/portail.jsonl"
verif "toujours rien de soumis" bash -c "! grep -q SOUMISSION $T/traces/portail.jsonl"

echo "== Coffre verrouillé, puis rouvert"
bash /usr/local/sbin/hermes-portail fermer >/dev/null
verif "fermer : la clé quitte la mémoire vive" [ ! -e $RAM/vault.key ]
bash /usr/local/sbin/hermes-portail cle > $T/cle1.log 2>&1
verif "coffre ouvert : « cle » remet la même clé en mémoire, depuis jarvis-coffre" bash -c "[ \"\$(cat $RAM/vault.key)\" = '$CLE' ] && [ \"\$(stat -c '%U %a' $RAM/vault.key)\" = '$U 600' ]"
bash /usr/local/sbin/hermes-portail fermer >/dev/null; /usr/local/sbin/jarvis-coffre fermer >/dev/null 2>&1
bash /usr/local/sbin/hermes-portail cle > $T/cle2.log 2>&1; rc=$?
verif "jarvis-coffre verrouillé : « cle » rend le code 3 et dit de l'ouvrir" bash -c "[ $rc = 3 ] && grep -q 'verrouillé' $T/cle2.log && [ ! -e $RAM/vault.key ]"
bash /usr/local/sbin/hermes-portail essai "http://127.0.0.1:$PP/tableau" --consigne-fichier $T/consigne.txt > $T/essai3.log 2>&1; rc=$?
verif "jarvis-coffre verrouillé : l'essai ne part pas (code 3)" bash -c "[ $rc = 3 ] && grep -q 'verrouillé' $T/essai3.log"
verif "sans la clé, Hermes refuse d'ouvrir son coffre et ne l'écrase pas" bash -c "$(declare -f hp propre); H=$H; HH=$HH; U=$U; avant=\$(sha256sum < $HH/vault/vault.json.enc); hp hermes vault list 2>&1 | propre | grep -q 'vault key could not be found' && [ \"\$avant\" = \"\$(sha256sum < $HH/vault/vault.json.enc)\" ] && [ -L $HH/vault/vault.key ]"

echo "== Redémarrage simulé du serveur (mémoire vive vidée, coffre relancé verrouillé)"
pkill -f coffre.mjs; sleep 0.5; umount $RAM; rm -rf /run/jarvis-coffre; install -d -m 0750 /run/jarvis-coffre; coffre_lancer
verif "après le redémarrage : plus de clé nulle part hors du coffre chiffré" bash -c "[ ! -e $RAM/vault.key ] && ! grep -rqF -- '$CLE' $H /var/lib/jarvis-coffre /etc/hermes-portail 2>/dev/null"
bash /usr/local/sbin/hermes-portail etat > $T/etat2.log 2>&1
verif "etat le dit : coffre verrouillé, clé absente, identifiants toujours là" bash -c "grep -q 'jarvis-coffre : verrouillé' $T/etat2.log && grep -q 'absente de la mémoire' $T/etat2.log && grep -q 'Identifiants enregistrés : oui' $T/etat2.log"
saisir "$PHRASE\n" /usr/local/sbin/jarvis-coffre ouvrir > $T/ouvrir.log 2>&1
: > $T/traces/portail.jsonl; rm -rf $HH/navigateur   # session perdue aussi : il doit se reconnecter par le coffre
bash /usr/local/sbin/hermes-portail essai "http://127.0.0.1:$PP/tableau" --consigne-fichier $T/consigne.txt > $T/essai4.log 2>&1; rc=$?
verif "coffre rouvert par la phrase : l'essai repart seul et se reconnecte" bash -c "[ $rc = 0 ] && grep -q '\"evenement\": \"connexion\", \"reussie\": true' $T/traces/portail.jsonl && [ \"\$(cat $RAM/vault.key)\" = '$CLE' ]"
verif "la mémoire vive est bien un ramfs remonté par la commande" bash -c "[ \"\$(stat -f -c %T $RAM)\" = ramfs ]"

echo "== Garde-fous de la commande"
runuser -u $U -- bash -c "printf 'x' > $HH/vault/.essai" 2>/dev/null; rm -f $HH/vault/.essai
rm -f $HH/vault/vault.key; printf 'fausse-cle' > $HH/vault/vault.key; chown $U: $HH/vault/vault.key
bash /usr/local/sbin/hermes-portail cle > $T/cle3.log 2>&1; rc=$?
verif "une clé posée en vrai fichier sur le disque : refus, et il le dit" bash -c "[ $rc != 0 ] && grep -q 'vrai fichier sur le disque' $T/cle3.log"
rm -f $HH/vault/vault.key; runuser -u $U -- ln -sfn $RAM/vault.key $HH/vault/vault.key
verif "essai : une adresse qui n'en est pas une est refusée" bash -c "! bash /usr/local/sbin/hermes-portail essai 'javascript:alert(1)' >/dev/null 2>&1"
bash /usr/local/sbin/hermes-portail oublier --tout > $T/oublier.log 2>&1
verif "oublier --tout : identifiants, clé, session et secret de jarvis-coffre effacés" bash -c "[ ! -e $HH/vault/vault.json.enc ] && [ ! -e $RAM/vault.key ] && [ ! -d $HH/navigateur ] && ! /usr/local/sbin/jarvis-coffre etat | grep -q 'hermes-portail-cle'"

arreter; nft delete table inet hermes_portail_sortie 2>/dev/null
[ "${FAUSSE_UNITE:-0}" = 1 ] && rm -f /etc/systemd/system/hermes-gateway.service
echo
echo "Banc du Hermes portail : $ok vérifications passées, $ko en échec."
[ $ko = 0 ]
