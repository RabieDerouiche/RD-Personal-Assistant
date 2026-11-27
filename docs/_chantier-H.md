# Chantier H — 0.96.0 : administrer les routines d'Hermes depuis JARVIS (note de passage, 27/11/2026)

Sa demande (27/11/2026) : « Les routines, on doit être capable de les relancer depuis JARVIS, soit car elles sont en erreur, ou car on a
modifié quelque chose, ou tout simplement pour avoir une nouvelle recherche ; ça doit donner vraiment l'air d'un espace
d'administration : pour chaque routine je dois avoir une popup ou un truc du genre où je peux arrêter une routine jusqu'à nouvel ordre,
la relancer, avoir l'historique, et si jamais il y a une erreur voir l'erreur en détail ; et rajoute ce qui y serait pertinent. » Ajout
du même jour : pouvoir **changer l'horaire** d'une routine depuis sa feuille (quatre passages par jour au plus ; deux passages rapprochés
sont permis).

Non touchés, comme demandé : `jarvis-os/hermes/portail/`, `CLAUDE.md`, `docs/jarvis-os.md`, `docs/hermes.md`, `docs/journal-jarvis.md`,
`docs/jarvis-os-reprise.md`, `docs/demandes-serveur-en-attente.md`, la constante `VERSION` (et donc le cache du service worker).

## 1. Textes à reporter

### Entrée pour `docs/jarvis-os.md`

- **0.96.0 (27/11/2026) : administrer les routines d'Hermes depuis JARVIS** (sa demande : « les routines, on doit être capable de les relancer depuis JARVIS […] pour chaque routine je dois avoir une popup où je peux arrêter une routine jusqu'à nouvel ordre, la relancer, avoir l'historique, et si jamais il y a une erreur voir l'erreur en détail », puis : changer son horaire). **JARVIS n'exécute rien** : il pose un petit fichier d'ordre, root le lit. *Les ordres* : `hermes-admin.mjs` écrit `ordre-<16 hexadécimaux>.json` (`{id, routine, action, at}` ; action dans `lancer`, `pause`, `reprendre`, `horaire` ; moins de 512 octets, 600, écrit dans `/var/lib/jarvis-reveil/ordres.tmp` puis glissé d'un coup dans `/var/lib/jarvis-reveil/ordres`, sous-dossiers du seul dossier hors de chez lui où son service écrit déjà : **aucun nouveau `ReadWritePaths`**). Pour `horaire`, une **forme fermée**, jamais une expression cron : des jours (`tous`, `ouvres` du lundi au vendredi, ou une liste `lun`…`dim`) et une à quatre heures `HH:MM` (minutes par pas de 5 ; deux heures identiques n'en font qu'une ; deux heures rapprochées sont permises), ou `origine: true`. *Root* (kit d'Hermes, `ordres.py`, copie root à côté de `limite.py` ; `hermes-ordres.path` surveille le dossier, `DirectoryNotEmpty`, prise en compte en une à trois secondes ; `hermes-relance` rattrape toutes les 10 minutes) : dossier ouvert sans suivre de lien puis tout par rapport à lui, fichier ordinaire à un seul nom, liste blanche des clés (une clé en trop = refusé ; `cron`, `expr` = « expression libre refusée »), routine dans la liste fermée (copie root de `routines.conf`), ordre de moins de 10 minutes, identifiant jamais rejoué, fichier retiré **avant** d'agir. `lancer` = un passage dans le mode actuel (`hermes cron run`, le chemin de `routines.sh --lancer`), dans une unité à part (`hermes-ordre-<routine>`, `systemd-run`) suivie jusqu'à sa fin ; au plus 1 par routine toutes les 5 minutes et 12 par jour ; refusé, avec la raison rendue à JARVIS, si la passerelle est arrêtée, si le garde du forfait a arrêté Hermes, si la limite du forfait est connue comme atteinte (heure de reprise donnée, sans lire l'usage), si un passage de la routine est en cours, si elle est en pause. `pause` = `hermes cron pause` et le nom dans `/var/lib/hermes-relance/routines.pause` (root) ; `horaire` = root construit l'expression (heure de Paris, comme `routines.conf`), `hermes cron edit --schedule`, gardée dans `/var/lib/hermes-relance/routines.horaire` (6 changements par jour) ; `routines.sh` respecte les deux fichiers (recréation, routine inchangée, `--lancer` refusé en pause) et `install.sh` n'y touche pas : pause et horaire **survivent** à une réinstallation, à `routines.sh` et à un redémarrage ; `hermes-relance` remet une pause qui aurait sauté. Root écrit dans le dossier du résumé (`root:jarvis` 750, fichiers 640) : `ordres.json` (résultat de chaque ordre : fait, refusé et pourquoi, en cours, terminé, sans suite ; codes et dates seulement), `historique.json` (les 30 derniers passages par routine : début, fin, durée, mode, résultat, catégorie, lancé « programmé », « à la main depuis JARVIS », « relancé après la limite », « réveil par JARVIS », « à la main sur le serveur » ; tenu en comparant `jobs.json` au passage précédent, complété par le registre d'exécutions d'Hermes, `cron/executions.db`, lu en tant qu'utilisateur `hermes`), et `routines.json` enrichi (pause et qui l'a posée, passage en cours, horaire d'origine en clair et « modifié », forme fermée de l'horaire en vigueur, « se lance aussi sur un événement » pour `reveil`), récrit tout de suite après chaque ordre. *L'erreur en détail* : pour un passage en erreur, root garde le texte de l'erreur **nettoyé** (jetons et clés masqués : `sk-…`, `Bearer …`, `token=…`, préfixes connus, longues chaînes hexadécimales ou base64 ; adresses mail ; chemins réduits au nom du fichier ; URL réduites à l'hôte ; corps de mail cité : première ligne seulement ; numéros longs et IBAN ; 8 lignes, 160 caractères par ligne, 600 en tout) ; JARVIS le reborde et le remasque, et ne le sert **que** par la route de la feuille : jamais dans une notification, la santé, la liste, un outil MCP ni le Journal de Pilotage (l'avis de la relance 0.89.0 « de nouveau en échec (…) » porte désormais la catégorie, plus le texte). *Serveur* : `GET /api/hermes/routine?nom=` (état, dernier ordre, « peut lancer » et pourquoi non, historique fusionné, taux de réussite et durée moyenne, erreur en détail avec quoi faire), `POST /api/hermes/routine/ordre`, `POST /api/hermes/routines/ordre` (« tout mettre en pause », « tout reprendre » : un ordre par routine, jamais « tout lancer »), toutes derrière l'appareil relié (401 pour un invité, un jeton MCP, la clé du Raccourci ; 423 sous verrou) ; mêmes plafonds que root pour répondre tout de suite (409 et la raison) ; tout ce qui vient de root est revalidé (liste blanche de formes, 64 Ko et 512 Ko au plus, jamais un lien) ; `routine_fin` garde désormais le résumé de chaque passage réel (30 par routine, déjà filtrés : rien de bancaire) : « ce qu'elle a fait », rattaché à son passage ; une notification quand un passage lancé à la main se termine (« Hermes : « Veille du matin » terminée », ou « en erreur (réseau). Le détail est dans sa feuille »), qui ouvre la feuille (`#voir-routine-<nom>`). **Aucun outil MCP ne pose d'ordre** (Hermes ne peut pas se relancer lui-même) : le banc le prouve (liste des outils, outils inventés, code du serveur). Chemins du banc : `JARVIS_HERMES_ORDRES`, `JARVIS_HERMES_ORDRES_TICK_MS`. *App* (bloc « 0.96.0 » après le bloc 0.92.0 ; rien n'est réécrit) : dans « Hermes et ses routines » et Équipe › Routines, toucher une routine ouvre **sa feuille** (la feuille du bas) : état en clair (active, en pause depuis le … depuis JARVIS, en erreur et sa cause, passage en cours), quand, mode, dernier et prochain passage ; **« Lancer maintenant »** (un appui de confirmation, puis « Demandé à 14 h 02 — en cours… », puis « Lancée à …, terminée à … : réussie. »), **« Mettre en pause »** (second appui) ou **« Reprendre »** ; **« L'erreur en détail »** quand le dernier passage a échoué (cause, quoi faire : « reprise vers 17 h 40, elle repartira seule », texte nettoyé) ; **« Ce qu'elle a fait »** ; **« Changer l'horaire »** (Tous les jours · Du lundi au vendredi · Jours choisis ; une à quatre heures, pas de 5 minutes ; aperçu en clair ; confirmation ; « Revenir à l'horaire d'origine » ; pour le réveil : « l'horaire ne change que ses passages programmés ») ; **« Historique »** (30 passages, taux de réussite, durée moyenne ; toucher un passage montre son compte rendu ou son erreur). Dans la liste, une pastille « En pause », « En erreur », « En cours », « Ordre en route ». Sur la carte d'Hermes : « Tout mettre en pause » / « Tout reprendre » (confirmation avec le nombre). Un refus est dit avec sa raison ; un ordre sans réponse au bout de 90 secondes : « pas pris en compte : le serveur ne répond pas ». Pas ici : le mode réel ou double, la consigne. *Trouvé au banc sur le vrai Hermes et corrigé* : juste après un passage réussi, `last_status` vaut `delivery_queued` une ou deux secondes (le résultat attend d'être envoyé par la passerelle) ; le résumé de la 0.92.0 le montrait « en erreur » et la relance après la limite l'aurait dit « de nouveau en échec » : c'est désormais un passage réussi. *À la main sur le serveur* : `routines.sh --pause <nom>` et `--reprendre <nom>` (la même pause que dans l'app). Bancs : `bash essais/hermes/ordres.test.sh` (117), `bash essais/hermes/relance.test.sh` (88), `sudo bash essais/hermes/banc.sh --neuf` (104, pause et horaire sur le vrai Hermes), `node jarvis-os/server/tests/hermes-admin.test.mjs` (46), `server.test.mjs` (427), `verrou.test.mjs` (45), banc de l'app (433, dont 27 pour ce chantier).

### Paragraphe pour `docs/hermes.md` (après « Les routines en direct dans JARVIS (0.92.0) »)

### Administrer les routines depuis JARVIS (0.96.0, 27/11/2026)

Sa demande : relancer une routine depuis JARVIS, l'arrêter jusqu'à nouvel ordre, voir son historique et le détail d'une erreur, changer son
horaire. JARVIS n'exécute rien : il pose un ordre, root agit (`ordres.py`, copie root `/usr/local/lib/hermes-relance/ordres.py`, lancé par
`hermes-ordres.path` → `hermes-ordres.service` → `/usr/local/sbin/hermes-ordres`).

- **Un ordre** = `/var/lib/jarvis-reveil/ordres/ordre-<16 hexadécimaux>.json` (dossier à `jarvis`, 700) : `{id, routine, action, at}`,
  action dans `lancer`, `pause`, `reprendre`, `horaire` ; pour `horaire`, `{jours, heures}` (forme fermée) ou `{origine: true}`. Son contenu
  n'est jamais une consigne : liste blanche des clés et des valeurs, rien d'autre ne sert.
- **Validation** : dossier ouvert sans suivre de lien (il appartient à `jarvis`) puis tout par rapport à ce descripteur ; fichier
  ordinaire, un seul nom, 512 octets au plus ; routine dans la copie root de `routines.conf` ; ordre de moins de 10 minutes (2 minutes
  d'avance au plus) ; identifiant jamais rejoué (gardé un jour) ; le fichier est retiré avant d'agir ; toute autre entrée du dossier est
  retirée sans être lue. Le dossier finit toujours vide (`DirectoryNotEmpty` repart sinon ; 30 départs par minute au plus).
- **`lancer`** : `hermes cron run <id>` dans une unité à part (`systemd-run --unit=hermes-ordre-<routine>`, une heure au plus), qui attend
  la fin du passage (45 minutes au plus, relu toutes les 10 secondes) puis écrit le résultat. Refus : `garde`, `passerelle`, `pause`,
  `en-cours` (marque `fire_claim` de moins de 5 minutes dans `jobs.json`, ou un lancement de moins d'une heure pas encore revenu),
  `limite` (un passage de moins de 24 heures coupé par la limite dont la reprise n'est pas passée, ou une relance en attente ; l'usage
  n'est pas lu), `trop-tot` (5 minutes), `plafond` (12 par jour), `hermes` (la commande a échoué ou n'a rien lancé).
  - (certain, code d'Hermes v0.23.3, `tools/cronjob_tools.py`) `hermes cron run` : avec la passerelle en marche et un résultat envoyé par
    elle (Telegram), le passage est confié à son prochain tic (« It will run on the next scheduler tick ») ; sinon il se fait dans la
    commande, jusqu'au bout (« Ran now »). Un passage déjà pris est dit sans erreur (« Already being fired ») : compté comme un refus.
  - (certain, même code, `cron/jobs.py`) `trigger_job` remet `enabled` à vrai : lancer une routine en pause la reprendrait. D'où le refus
    `pause`, ici et dans `routines.sh --lancer`.
  - (certain, code `cron/delivery_outcome.py` et banc du 27/11/2026 sur le vrai Hermes) juste après un passage réussi, `last_status`
    vaut **`delivery_queued`** une ou deux secondes, le temps que la passerelle envoie le résultat ; il devient ensuite `ok` ou
    `delivery_failed`. Le résumé de la 0.92.0 le lisait comme une erreur, et la relance comme « de nouveau en échec » : corrigé
    (`resultat_de` et la relance le comptent comme réussi). L'ordre d'un passage lancé à la main n'est soldé qu'une fois ce statut
    tranché (3 minutes d'attente au plus).
- **`pause` / `reprendre`** : `hermes cron pause|resume <id>` (certain, `cron/jobs.py` : `enabled` faux, `state` « paused », `paused_at` ;
  la reprise recalcule `next_run_at`), et le nom dans `/var/lib/hermes-relance/routines.pause` (« nom époque », root 600). `routines.sh`
  recrée une routine en pause avec `--paused`, remet la pause d'une routine inchangée, refuse `--lancer` ; `hermes-relance` remet la
  pause si elle a sauté. Possible Hermes arrêté. À la main sur le serveur, la même pause : `routines.sh --pause <nom>` et
  `routines.sh --reprendre <nom>`.
- **`horaire`** : root construit l'expression (`minutes heures * * jours`, heure de Paris : `timezone: "Europe/Paris"` de la politique)
  et la pose par `hermes cron edit <id> --schedule`. Une expression n'a qu'une liste de minutes et une liste d'heures : les passages
  partagent la même minute (9 h 15 et 13 h 15) ou la même heure (9 h 00 et 9 h 15) ; sinon refus `forme`, dit en clair. Gardée dans
  `/var/lib/hermes-relance/routines.horaire` (« nom|cron ») ; `routines.conf` reste l'horaire d'origine ; `origine: true` retire la
  surcharge. `routines.sh` pose l'horaire choisi à la création et le remet sur une routine inchangée. 6 changements par jour.
- **Ce que root écrit pour JARVIS** (`/var/lib/hermes-relance-etat`, 750 et 640) : `ordres.json` (40 derniers résultats),
  `historique.json` (30 passages par routine), `routines.json` (récrit après chaque ordre et toutes les 10 secondes pendant un passage
  lancé à la main).
- **L'historique** : à chaque passage de `hermes-relance` (`ordres.py suivre`, après la relance, code de sortie de la relance gardé), le
  dernier passage de `jobs.json` est comparé au précédent ; le registre d'exécutions d'Hermes (`~/.hermes/cron/executions.db`, table
  `executions` : `claimed_at`, `started_at`, `finished_at`, `status`, `scheduled_instant`, `error`) donne le début, la durée, les passages
  manqués entre deux minuteries et « hors horaire » (`scheduled_instant` vide = passage lancé à la main). Il est lu par un petit
  programme lancé **en tant qu'utilisateur `hermes`** : root n'ouvre jamais lui-même cette base.
- **Le nettoyage de l'erreur** (`nettoyer_erreur`, règles en tête de la fonction) : seconde couche après celle d'Hermes
  (`redact_sensitive_text`). `sudo python3 -I /usr/local/lib/hermes-relance/ordres.py nettoyer < fichier` montre ce qu'il rend.
- `diagnostic.sh` : la surveillance des ordres, le dossier, les derniers ordres du journal, les pauses et les horaires posés depuis JARVIS.

Bancs : `bash essais/hermes/ordres.test.sh` (117 vérifications), `bash essais/hermes/relance.test.sh` (88),
`sudo bash essais/hermes/banc.sh --neuf` (104).

## 2. Demande à la session « Serveur JARVIS » (à joindre à la demande commune)

`git pull`, le redémarrage de `jarvis` et `sudo bash /opt/rd/jarvis-os/hermes/install.sh` sont faits une fois par la demande commune. Ce
chantier n'ajoute **aucun** `ReadWritePaths` (les ordres vont dans `/var/lib/jarvis-reveil`, déjà permis), aucun hôte, aucun secret.

**LECTURES (avant, en lecture seule)**
1. `systemctl show jarvis -p ReadWritePaths` : `/var/lib/jarvis-reveil` doit y être (corrigé le 27/11).
2. `sudo bash /opt/rd/jarvis-os/hermes/routines.sh --liste` : l'état des routines avant (à garder pour comparer).
3. `ls -la /var/lib/jarvis-reveil /var/lib/hermes-relance-etat` et `sudo ls -la /var/lib/hermes-relance`.

**DÉPLOIEMENT (rien de plus que la demande commune)**
- `install.sh` pose `ordres.py`, `/usr/local/sbin/hermes-ordres`, `hermes-ordres.path` et `.service`, crée `/var/lib/jarvis-reveil/ordres`
  (à `jarvis`, 700) et active la surveillance. `routines.sh` n'a pas à être relancé (aucune routine ne change).

**CONTRÔLES (lecture seule)**
1. `systemctl is-active hermes-ordres.path` → `active` ; `systemctl status hermes-ordres.path --no-pager | head -5`.
2. `stat -c '%U:%G %a' /var/lib/jarvis-reveil/ordres` → `jarvis:jarvis 700` ; `stat -c '%U %a' /usr/local/lib/hermes-relance/ordres.py
   /usr/local/sbin/hermes-ordres` → `root 644`, `root 755`.
3. `sudo systemctl start hermes-relance.service` puis `ls -la /var/lib/hermes-relance-etat` : `routines.json` et `historique.json`
   (`root jarvis`, 640). `sudo python3 -I -c "import json; d=json.load(open('/var/lib/hermes-relance-etat/historique.json'));
   print({k: len(v) for k, v in d['routines'].items()})"` : un nombre de passages par routine (la durée vient du registre d'Hermes).
4. **L'horaire en vigueur et celui d'origine** : `sudo python3 -I -c "import json; [print(r['nom'], '|', r['moment'], '| modifié' if
   r['modifie'] else '| origine', '|', r['origine'], '| prochain', r['prochain']) for r in
   json.load(open('/var/lib/hermes-relance-etat/routines.json'))['routines']]"` : pour chaque routine, « modifié » doit être faux et les
   deux horaires identiques ; à comparer avec `routines.sh --liste` (heures de Paris).
5. `journalctl -u hermes-relance -n 15 --no-pager -o cat` : pas de « Suivi des routines pour JARVIS : en échec ».
6. `sudo bash /opt/rd/jarvis-os/hermes/diagnostic.sh | sed -n '/ordres de JARVIS/,/historique pour JARVIS/p'`.
7. `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/api/hermes/routine?nom=reveil` → `401` (sans appareil relié).

**UN ESSAI RÉEL SANS RISQUE (mettre en pause puis reprendre une routine, sans lancer de passage)** — routine : `sorties-du-week-end`
(prochain passage jeudi 19 h : rien ne tombe pendant l'essai) :
```
ID=$(openssl rand -hex 8); printf '{"id":"%s","routine":"sorties-du-week-end","action":"pause","at":%s}' "$ID" "$(date +%s)" | sudo -u jarvis tee /var/lib/jarvis-reveil/ordre-essai.tmp >/dev/null
sudo -u jarvis mv /var/lib/jarvis-reveil/ordre-essai.tmp /var/lib/jarvis-reveil/ordres/ordre-$ID.json
sleep 8; journalctl -u hermes-ordres -n 5 --no-pager -o cat; sudo ls -A /var/lib/jarvis-reveil/ordres | wc -l
sudo cat /var/lib/hermes-relance/routines.pause; sudo bash /opt/rd/jarvis-os/hermes/routines.sh --liste | grep sorties
```
Attendu : « Ordre … (pause sorties-du-week-end) : fait. », dossier vide (0), `sorties-du-week-end <époque>` dans `routines.pause`, la
liste dit `pause … ; en pause depuis JARVIS`. Puis la reprise (même chose avec `"action":"reprendre"` et un nouvel `ID`) : « fait »,
`routines.pause` vide, la liste dit `actif` avec un prochain passage jeudi 19 h. Vérifier aussi que le réveil n'a pas été lancé par
l'essai : `journalctl -u hermes-reveil --since -5min --no-pager -o cat` (rien de neuf).

**RETOUR ARRIÈRE**
- Couper seulement les ordres : `sudo systemctl disable --now hermes-ordres.path` (l'app dira « pas pris en compte : le serveur ne répond
  pas » ; le reste de la 0.92.0 continue ; attention, `hermes-relance` rattrape encore un ordre posé toutes les 10 minutes : pour tout
  couper, aussi `sudo rmdir /var/lib/jarvis-reveil/ordres` : l'app répond alors « le dossier des ordres n'existe pas sur ce serveur » ;
  `install.sh` le recrée).
- Défaire à la main, sans l'app, ce qui a été réglé depuis JARVIS : une pause, `sudo bash /opt/rd/jarvis-os/hermes/routines.sh
  --reprendre <nom>` (et `--pause <nom>` pour la poser) ; un horaire, retirer sa ligne de `/var/lib/hermes-relance/routines.horaire`
  puis `sudo bash /opt/rd/jarvis-os/hermes/routines.sh` (il repose l'horaire de `routines.conf` sur la routine).
- Revenir à la version d'avant : `git checkout` du commit précédent, `install.sh`, redémarrage de `jarvis` (comme la demande commune) ;
  les fichiers `/var/lib/hermes-relance-etat/historique.json` et `ordres.json` peuvent rester (l'ancienne version ne les lit pas).

**CE QUE J'ATTENDS EN RETOUR**
- Les sorties des contrôles 1 à 7 ; les quatre lignes de l'essai (pause puis reprise) ; la ligne `routines.sh --liste` de
  `sorties-du-week-end` avant et après ; s'il y en a une, toute ligne « Entrée inattendue », « refusé » ou « Traceback » du journal
  `hermes-ordres`.
- Après son premier « Lancer maintenant » depuis l'app (à lui de le faire) : `journalctl -u hermes-ordres -u 'hermes-ordre-*' --since
  -15min --no-pager -o cat` (on y lit si Hermes a confié le passage à la passerelle ou l'a fait sur place).

## 3. Ce qu'il verra, écran par écran

1. **Espaces › Hermes et ses routines** (ou Équipe) : la liste des six routines, comme avant, mais chaque ligne se touche. Une pastille
   à côté du nom quand elle n'est pas simplement active : « En pause », « En erreur », « En cours », « Ordre en route »,
   « Lancement demandé ». Un horaire changé est dit « (horaire modifié) ». Sur la carte d'Hermes : **« Tout mettre en pause »** et
   **« Tout reprendre »** (un appui, puis « Confirmer : 5 routines » ; un message dit combien d'ordres sont partis et lesquels ont été
   refusés).
2. **Toucher une routine : sa feuille** (elle monte du bas).
   - En tête : « Routine d'Hermes », son nom, puis son état en clair avec une pastille de couleur : « Active », « En pause depuis
     aujourd'hui à 10:02, depuis JARVIS — jusqu'à nouvel ordre », « En erreur au dernier passage : limite du forfait », « Un passage est
     en cours », « Pas posée chez Hermes ».
   - Un cadre : **Quand** (« Du lundi au vendredi à 7 h 40 », avec « horaire modifié ; à l'origine : … » s'il l'a changé), **Mode**
     (en réel, ou en double), **Dernier** passage et son résultat, **Prochain** passage. Pour le réveil : « Se lance aussi sur un
     événement : un courrier qui arrive, une ligne du Canal. »
   - **Les gestes** : « Lancer maintenant » → le bouton devient « Confirmer : lancer maintenant » + « Annuler » → « Demandé à 14 h 02 —
     en attente du serveur… » → « Demandé à 14 h 02 — en cours… » → « Lancée à 14 h 02, terminée à 14 h 06 : réussie. » (ou « en erreur
     (réseau). »). À la fin, une **notification** arrive aussi (« Hermes : « Veille du matin » terminée »), qui rouvre la feuille.
     « Mettre en pause » → « Confirmer la pause, jusqu'à nouvel ordre » → « En pause depuis 14 h 02, jusqu'à nouvel ordre. » ; le
     bouton devient « Reprendre » (un seul appui). Quand un geste n'est pas possible, le bouton est grisé et une ligne dit pourquoi
     (« « Lancer maintenant » : la routine est en pause : reprends-la d'abord. », « … déjà lancée il y a moins de 5 minutes : possible à
     14 h 07. », « … Hermes est arrêté. »). Un refus du serveur est écrit en ambre (« Refusé à 14 h 02 : la limite du forfait Claude est
     atteinte : reprise vers 17 h 40, elle repartira seule. »).
   - **L'erreur en détail** (seulement si le dernier passage a échoué) : la cause, ce qu'il peut faire, puis le texte de l'erreur
     nettoyé, dans un cadre.
   - **Ce qu'elle a fait** : le compte rendu du dernier passage réel (celui que la routine donne à JARVIS à la fin), daté.
   - **Changer l'horaire** (replié) : « Tous les jours · Du lundi au vendredi · Jours choisis » (puis sept jours à cocher), une à
     quatre heures (heure et minutes par pas de 5, « + Ajouter un passage », « Retirer »), un **aperçu** (« Aperçu : chaque jour à
     7 h 40 et 7 h 55. »), « Demander ce changement » → « Confirmer : … » → « Horaire changé — pris en compte à 14 h 02 : … » et le
     prochain passage recalculé ; « Revenir à l'horaire d'origine » quand il est modifié. Si les heures ne tiennent pas dans un seul
     horaire (7 h 40 et 13 h 15), l'aperçu le dit et propose la règle (même minute, ou même heure).
   - **Historique** : « 28 passages · 93 % réussis · durée moyenne 3 min 40 », puis les passages du plus récent au plus ancien (date,
     résultat, durée, comment il a été lancé) ; toucher un passage montre son compte rendu ou son erreur.
3. **Équipe › Routines** : les cartes d'Hermes s'ouvrent de la même façon.
4. **Ce qu'il ne peut pas faire ici** (décisions à part) : passer une routine de « double » à « réel », changer sa consigne.

## 4. Bancs, avant et après

| Banc | Avant | Après |
|---|---|---|
| `bash essais/hermes/ordres.test.sh` (nouveau) | — | 117 OK |
| `bash essais/hermes/relance.test.sh` | 80 | 88 OK |
| `sudo bash essais/hermes/banc.sh --neuf` | 88 | 103 OK, 1 échec : « mémoire pendant une routine sous 550 Mo » (554 Mo) |
| `bash essais/hermes/routines-conf.test.sh` | 6 | 6 |
| `bash essais/hermes/garde.test.sh` | 25 | 25 OK |
| `node jarvis-os/server/tests/server.test.mjs` | 413 | 427 OK |
| `node jarvis-os/server/tests/hermes-admin.test.mjs` (nouveau) | — | 46 OK |
| `node jarvis-os/server/tests/verrou.test.mjs` | 44 | 45 OK |
| `node jarvis-os/server/tests/depot.test.mjs`, `limite.test.mjs` (voisins, inchangés) | 42, 14 | 42, 14 |
| Banc de l'app, `banc.cjs` | 403 OK, 3 échecs (date du jour) | 429 OK, 4 échecs (les 3 de la date du jour, et « notification de la page : croix « Fermer », fermée tout de suite ») |

`banc-serveur.mjs` n'a pas été lancé (consigne).

Les échecs, mot pour mot :
- Banc d'Hermes : « ✗ mémoire pendant une routine sous 550 Mo » (« mémoire d'Hermes pendant une routine : 554 Mo au plus »). Sans rapport
  avec ce chantier : le **même banc sur le kit d'avant** (commit `35f7d12`, lancé le même jour dans le même conteneur) échoue de la même
  façon, à 553 Mo (87 réussies, 1 en échec). La mesure est prise à la seconde pendant le lancement que le banc fait lui-même (392 à
  397 Mo au repos, plus la commande `hermes cron run`) ; deux des quatre passages du jour l'ont passée. Le bloc 0.96.0 du banc est placé
  après cette mesure. À voir à part : le seuil (la doc du 23/11 notait 360 Mo au repos et 500 au plus), ou ce qui a fait monter le repos.
- Banc de l'app : « plusieurs jours : l'événement est listé avec sa période et apparaît sur chacun de ses trois jours dans le mois »,
  « plusieurs jours : écrit dans l'agenda en journées entières, fin au lendemain du dernier jour (règle de Google), et relu sur ses trois
  jours », « agenda : le rendez-vous écrit aussi dans Échéances n'est listé qu'une fois dans le mois, avec le bot qui le suit » (les trois
  de la date du jour, connus), et « notification de la page : croix « Fermer », fermée tout de suite :: toast vu : true ». Ce dernier
  n'échouait pas dans la référence : rejoué seul deux fois de suite, il passe (page `?theme=holo#equipe`, où le bloc 0.96.0 ne fait
  rien : Grok n'y est pas arrêté). (probable) Une course de ce banc sous charge, pas un défaut du chantier.
- Premier passage du banc d'Hermes du jour : un vrai défaut trouvé et corrigé (`delivery_queued`, voir plus haut) ; un défaut du banc
  lui-même corrigé (une fonction du banc appelée dans un sous-shell).

## 5. Ce qui n'a pas pu être testé, et les risques

- **La pause dans le vrai Hermes** — (certain, banc sur Hermes v0.23.3 installé par `install.sh`) `hermes cron pause`, `resume` et
  `edit --schedule` font ce qui est attendu dans `jobs.json`, et la pause comme l'horaire survivent à `routines.sh` (routine inchangée
  et recréée). (probable) La passerelle en marche relit `jobs.json` à chaque tic : une pause posée par la commande est donc vue en une
  minute au plus ; le banc ne fait pas tourner l'horloge d'Hermes jusqu'à l'heure d'une routine en pause pour prouver qu'elle ne part pas.
  (deviné) Un passage **déjà en cours** au moment de la pause va à son terme.
- **`hermes cron run` sur le serveur** — (certain, code) deux chemins : confié à la passerelle (file d'attente, une minute au plus) ou
  fait sur place. (probable) Sur le serveur, résultat par Telegram et passerelle en marche : le premier. L'unité à part couvre les deux,
  mais seul le journal du premier « Lancer maintenant » réel le dira. (deviné) Si la passerelle met plus de 45 minutes à finir, l'ordre
  reste « en cours » puis passe à « sans suite » au bout d'une heure, alors que le passage peut réussir plus tard (il sera dans
  l'historique, « programmé » ou « à la main sur le serveur »).
- **Un point trouvé en lisant le code d'Hermes, hors de ce chantier** — (certain, code) quand `hermes cron run` fait le passage sur place
  au lieu de le confier à la passerelle, il dure le temps du passage. Or `hermes-reveil.service` a 60 secondes (`TimeoutStartSec`) et la
  relance après la limite 120 secondes pour cette commande. (probable) Sur le serveur le passage est confié à la passerelle, et ces délais
  n'ont jamais gêné (les six routines sont passées en réel le 26/11) ; à vérifier dans le journal du premier « Lancer maintenant » : s'il
  dit « Ran now », ces deux délais sont à allonger. Les ordres de JARVIS, eux, partent dans une unité à part d'une heure.
- **systemd** — non testable au banc (conteneur sans systemd) : `hermes-ordres.path` (`DirectoryNotEmpty`, limite de 30 départs par
  minute), `systemd-run` (vérifié par une fausse commande : nom d'unité, programme lancé), `NoNewPrivileges` avec `runuser`,
  `hermes-relance.service` (`ProtectSystem=full`) qui lance le suivi : il n'écrit que sous `/var/lib` et chez `hermes` (probable).
  D'où l'essai réel de la section 2.
- **Le dossier temporaire à côté** (`/var/lib/jarvis-reveil/ordres.tmp`, créé par JARVIS) : (probable) sa création ne déclenche pas
  `hermes-reveil.path` (qui surveille le seul fichier `sonnette`) ; l'essai réel le vérifie.
- **Qui peut poser un ordre** — tout ce qui tourne sous l'utilisateur `jarvis` peut écrire dans le dossier (comme pour la sonnette du
  réveil) : le serveur, mais aussi une mission de Claude lancée par JARVIS. Les routes sont réservées à un appareil relié et aucun outil
  MCP n'y mène, mais ce n'est pas une barrière du système. Portée d'un ordre forgé : lancer, mettre en pause, reprendre ou décaler une
  routine de la liste fermée, sous les plafonds. `hermes` ne peut ni lire ni écrire ce dossier.
- **Le nettoyage de l'erreur : ce qu'il peut laisser passer** — (certain) un secret court sans mot-clé ni préfixe (un mot de passe de dix
  lettres écrit en clair), un nom de personne, un nom d'hôte seul (celui d'un service appelé), un montant, un court texte cité (moins de
  60 caractères entre guillemets), un numéro de moins de 9 chiffres. Ce qui le borne : Hermes masque déjà ce qu'il écrit ; le détail
  n'est servi que par la feuille, sur un appareil relié et déverrouillé ; les routines d'Hermes ne connaissent ni le portail ni ses
  identifiants (hermes-portail est à part) ; le filtre « rien de bancaire » de JARVIS remplace le texte entier par « détail masqué ».
  (deviné) La forme réelle des erreurs du plugin de l'abonnement n'a pas été vue : le banc emploie des textes inventés.
- **Fuseau et changement d'heure** — (certain) l'expression est en heure de Paris (`timezone: "Europe/Paris"` de la politique) ; le banc
  vérifie que le prochain passage calculé par Hermes tombe à l'heure demandée, heure de Paris. (probable) Au passage à l'heure d'été ou
  d'hiver, c'est la bibliothèque de cron d'Hermes qui décide : un passage entre 2 h et 3 h peut sauter ou doubler ce jour-là (éviter
  cette heure). (certain) L'app affiche les heures dans le fuseau du téléphone : hors de France, « Prochain » et l'aperçu (heure de
  Paris) ne se liront pas dans le même fuseau.
- **Un horaire à plusieurs heures de minutes différentes** (7 h 40 et 13 h 15) est refusé : Hermes n'a qu'une expression par routine.
  Le lever demanderait deux routines pour une seule ligne : décision à part.
- **L'historique** — (probable) la fin d'un passage dans `jobs.json` et dans le registre d'Hermes diffèrent de moins de 30 secondes
  (sinon le passage apparaîtrait deux fois). (certain) Les passages d'avant la mise à jour n'ont de durée que s'ils sont encore dans le
  registre d'Hermes. (deviné) Un `routines.sh` qui recrée une routine change son identifiant chez Hermes : ses anciens passages restent
  dans l'historique de root, mais ne sont plus complétés par le registre.
- **Non fait** : « Voir sa ligne dans le Journal » (le Journal de Pilotage est tenu par bot, pas par routine : il aurait fallu deviner
  la ligne) ; un bouton « Arrêter le passage en cours » (Hermes a `cron cancel` : décision à part) ; le journal `README.md` du kit.
- **Version** : la constante `VERSION` et le cache du service worker ne sont pas montés : à faire à la fusion, sinon l'iPhone garde
  l'ancienne app.
