# Chantier G — 0.97.0 : le CRA signé déposé sur le portail par Hermes, après son oui

Note de passage (27/11/2026). Rien n'est poussé ni fusionné ; `VERSION` n'est pas touchée (elle reste à la session principale), ni
`CLAUDE.md`, ni les docs listées dans la consigne. Sa décision (QCM du 26/11/2026) : « Hermes, après mon oui » ; un essai à blanc sur
le portail d'abord, sa validation la première fois.

Fichiers : `jarvis-os/server/signe.mjs` (nouveau), `jours.mjs`, `travail.mjs`, `server.mjs` ; `jarvis-os/hermes/portail/hermes-portail`
(`cra-signe`, `cra-signe-auto`), `hermes-portail-cra-signe.service` et `.timer` (nouveaux), `install.sh`, `skills/portail/portail/SKILL.md` ;
`jarvis-os/hermes/limite.py` (une unité de plus dans la liste fermée) ; l'app (`essais/jarvis-os-maquette/index.html`,
`jarvis-serveur.js`, `donnees-fictives.js`) ; bancs (`jours.test.mjs`, `travail.test.mjs`, `server.test.mjs`, `fake-google.mjs`,
`essais/hermes/faux_portail.py`, `essais/hermes/portail.test.sh`, `banc/banc.cjs`).

## 1. Textes à recopier

### Entrée pour `docs/jarvis-os.md`

- **0.97.0 (27/11/2026) : le CRA signé déposé sur le portail par Hermes, après son oui** (son QCM du 26/11/2026 : « Quand ton client
  renvoie le CRA signé en PDF, qui le rattache sur le portail ? » → « Hermes, après mon oui »). *JARVIS garde le PDF* (`signe.mjs`,
  `jours.mjs`) : dès qu'une réponse au mail du CRA porte un PDF (et au rattrapage, pour une réponse déjà notée : le mois en cours et
  les deux d'avant, toutes les 5 minutes), le message est relu (l'identifiant de pièce jointe gardé à la détection est périmé), un
  seul PDF est retenu (le plus gros qui n'est pas une image ; les autres sont comptés et dits), téléchargé une fois (`get_attachment`,
  lecture seule), vérifié (« %PDF- », 15 Mo au plus) et gardé sous le dossier de données (`cra-signe/`, 700 ; fichier 600 au nom tiré
  au sort ; jamais à travers un lien) avec son empreinte SHA-256 (`jours.json`, `mois[AAAA-MM].suivi.cra.signe`). Il est effacé dès
  que le dépôt est fait (par Hermes, ou dit par lui avec « C'est rattaché »), ou 45 jours après. Un téléchargement en échec est
  réessayé au quart d'heure (6 fois au plus) ; une pièce qui n'est pas un PDF est dite, et l'ancien chemin reste. *Root vérifie à
  blanc* (`hermes-portail cra-signe-auto`, minuterie de 15 minutes) et pose un compte rendu (`signe-<AAAA-MM>.json`, dossier de root) :
  `pret`, `deja`, `introuvable` ou `echec`, lu par JARVIS à la minute et à l'ouverture de Travail. *Son oui* : la carte « CRA du
  mois » et la ligne de Travail de « Pour moi » disent « CRA signé reçu : Hermes le dépose sur le portail ? », avec le nom du
  fichier, sa taille et « Ouvrir le mail » ; « Oui, déposer » (confirmé d'un appui) garde son oui sur l'empreinte du PDF et le mois
  (`POST /api/jours/signe/valider`, un appareil relié ; le fichier est relu et son empreinte recalculée à cet instant) ; « Je le fais
  moi-même » (`POST /api/jours/signe/moi`) rend l'ancien chemin (« C'est rattaché »). Une notification, une fois : « CRA signé prêt à
  déposer : ton oui ». Tant que root n'a pas rendu `pret`, la carte dit où on en est (« JARVIS récupère le PDF… », « Hermes
  vérifiera le portail une fois le CRA du mois validé », « Hermes vérifie le portail… », « Hermes n'a pas trouvé où le déposer : à
  faire à la main », avec la raison), sans « À toi ». *Le dépôt* : root lit le oui et fait déposer le fichier une seule fois ;
  JARVIS passe l'étape « Rattaché » à faite (« déposé sur le portail par Hermes le … »), notifie « Première exécution d'Hermes : CRA
  signé de <mois> déposé — vérifie sur le portail » la première fois, « CRA signé de <mois> déposé » ensuite, « déjà sur le
  portail » si Hermes l'y trouve, « pas déposé : à faire à la main » en échec (le PDF reste gardé ; « Réessayer avec Hermes » = un
  nouveau oui, donc une nouvelle tentative, une seule). Aucune route ne rend le PDF, aucun outil MCP ne le lit ni ne pose le oui ;
  rien de ce chantier n'écrit dans Gmail. L'app : le rendu de la carte dans le bloc 0.85.0 (`trvSigne`, les deux boutons dans
  `SHEETCFG.travail`) et deux champs facultatifs pour l'écran de confirmation (`ask`, `yes`). Détail côté root :
  `docs/hermes-portail.md`. Bancs : `jours.test.mjs` 134, `travail.test.mjs` 37, `server.test.mjs` 434, maquette (carte, feuille,
  confirmation, « Pour moi »).

### Paragraphe pour `docs/hermes-portail.md` (après « Le CRA du mois, seul »)

**Le CRA signé du client, déposé après son oui (27/11/2026, son QCM du 26/11 : « Hermes, après mon oui »)** :
`hermes-portail cra-signe-auto`, lancé toutes les 15 minutes par `hermes-portail-cra-signe.timer` (posé et activé par `install.sh`).
Il ne fait rien sans `adresse_mois=` dans `cra.conf`, ni tant que le CRA du mois n'est pas validé par Hermes (`mois-valides.txt`, ou
le compte rendu `mois-<AAAA-MM>.json` : `validee` ou `deja`), ni sans PDF gardé par JARVIS pour le mois (`jours.json`,
`mois[AAAA-MM].suivi.cra.signe` : `fichier`, `empreinte` ; le mois en cours et les deux d'avant), ni si JARVIS dit « rattaché » ou
« je le fais moi-même ». Un passage au plus par lancement, jamais en même temps que `cra-mois-auto` (son verrou) ni pendant un
autre passage d'Hermes :
- *la copie* : le PDF est lu sans suivre de lien (ni le dossier `cra-signe`, ni le fichier ; un fichier ordinaire, sans lien
  physique, 15 Mo au plus), « %PDF- » et empreinte SHA-256 revérifiés, puis recopié chez root
  (`/var/lib/hermes-portail/cra-signe/<mois>/signe.pdf`, 700/600). Refusé : compte rendu `echec`, une fois par empreinte ;
- *à blanc* (`cra-signe <adresse> --mois <AAAA-MM> --a-blanc`, « MODE DÉPÔT À BLANC ») : **aucun fichier n'est remis à Hermes** ; il
  ouvre la page du mois, trouve où se dépose le CRA signé, dit ce que la page montre et si un document y est déjà. Un essai par
  fichier (`tentes.txt`, `blanc <mois> <empreinte>`). Compte rendu `signe-<AAAA-MM>.json` (root 640, ni nom de portail, ni adresse,
  ni hôte : le texte est nettoyé) : `pret`, `deja` (rien à faire), `introuvable`, `echec` ;
- *le dépôt* (`cra-signe … --fichier <copie de root>`, « MODE DÉPÔT ») : seulement si `signe.oui` porte la même empreinte et le même
  mois, et si la copie de root a toujours cette empreinte ; le fichier est remis sous un nom fixe (`CRA-signe-<AAAA-MM>.pdf`, jamais
  le nom venu du mail), retiré après le passage. Une tentative par oui (`reel <mois> <empreinte> <heure du oui>`) ; un mois déposé
  (`deposes.txt`) ne repart jamais. Compte rendu `reel: true` : `depose` (`premiere` au premier dépôt fait par Hermes), `deja`,
  `echec` avec une raison courte ;
- *la limite du forfait* : coupé avant tout contact avec le portail, l'essai (ou le oui) n'est pas compté et repart une fois
  (`hermes-portail-cra-signe.service`, connue de `limite.py`) ; après contact, ou deux fois : compté, « à faire à la main ».
  *Le coffre verrouillé* : rien n'est compté ni dit, nouvel essai au quart d'heure suivant.
La skill a une section « CRA signé du client ». À la main : `sudo hermes-portail cra-signe-auto` dit pourquoi il ne fait rien.
Banc : section « CRA signé du client » de `portail.test.sh`.

## 2. Demande à la session du serveur — section « CRA signé » (0.97.0)

`git pull`, le redémarrage de `jarvis`, `sudo bash /opt/rd/jarvis-os/hermes/install.sh` et
`sudo bash /opt/rd/jarvis-os/hermes/portail/install.sh` sont faits une fois par la demande commune. Ce chantier n'ajoute **aucun**
`ReadWritePaths` (JARVIS écrit sous son dossier de données, `/home/jarvis/.jarvis/cra-signe`), aucun hôte, aucun secret, aucun
réglage : `adresse_mois=` est déjà dans `/etc/hermes-portail/cra.conf` depuis le CRA du mois. Ce qu'il ajoute : une minuterie
(`hermes-portail-cra-signe.timer`, activée par `install.sh` du portail) et un dossier de root (`/var/lib/hermes-portail/cra-signe`).

```text
LECTURES (avant, en lecture seule)
1. grep -c '^adresse_mois=.' /etc/hermes-portail/cra.conf            (attendu : 1 ; ne pas afficher la ligne)
2. sudo grep -c '^2026-11 ' /var/lib/hermes-portail/cra/mois-valides.txt ; sudo python3 -I -c "import json; print(json.load(open('/var/lib/hermes-portail-retours/mois-2026-11.json')).get('resultat'))"
   (au moins l'un des deux doit dire que novembre est validé par Hermes : 1, ou « validee » / « deja »)
3. L'état du CRA signé de novembre chez JARVIS, sans donnée personnelle :
   sudo python3 -I -c "import json; c=json.load(open('/home/jarvis/.jarvis/jours.json'))['mois'].get('2026-11',{}).get('suivi',{}).get('cra',{}); print('reponses avec PDF :', sum(1 for r in c.get('reponses',[]) if r.get('pdf')), '| rattache :', bool(c.get('rattache')), '| signe :', sorted((c.get('signe') or {}).keys()))"
   (attendu avant le déploiement : 1 réponse avec PDF ; « signe : [] ». Si « rattache : True » : il l'a déjà déposé lui-même, l'essai
   à blanc ne partira pas — le dire, ne rien forcer.)
4. systemctl show jarvis -p ReadWritePaths ; stat -c '%U %a' /home/jarvis/.jarvis      (JARVIS écrit bien sous /home/jarvis)
5. systemctl list-timers 'hermes-portail-*' --no-pager                 (les heures des autres minuteries, pour ne pas lancer l'essai sur un autre passage)

DÉPLOIEMENT (rien de plus que la demande commune)
- install.sh du portail pose hermes-portail-cra-signe.service et .timer, les active, recopie la commande, limite.py et la skill.

CONTRÔLES (lecture seule)
1. systemctl is-active hermes-portail-cra-signe.timer → active ; grep -c hermes-portail-cra-signe.service /usr/local/lib/hermes-portail/limite.py /usr/local/lib/hermes-relance/limite.py → 1 et 1
2. sudo grep -c 'CRA signé du client' /etc/hermes-portail/skills/portail/portail/SKILL.md → 4 ; sudo hermes-portail etat | head -20 (rien de changé pour le coffre et les identifiants)
3. Dans les deux minutes après le redémarrage de jarvis (son premier passage) :
   sudo stat -c '%U %a' /home/jarvis/.jarvis/cra-signe ; sudo ls -la /home/jarvis/.jarvis/cra-signe
   → jarvis 700 ; un seul fichier <32 caractères>.pdf, 600. Puis la lecture 3 de nouveau : « signe » doit contenir
   fichier, empreinte, taille, nom, garde (et pas « erreur » ni « refus » ; s'il y en a : relever leur texte).
   journalctl -u jarvis --since '-5 min' --no-pager -o cat | grep -i 'CRA signé'      (rien = bon signe)
4. curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'content-type: application/json' -d '{"mois":"2026-11"}' http://127.0.0.1:8787/api/jours/signe/valider → 401 (sans appareil relié)

L'ESSAI À BLANC RÉEL POUR NOVEMBRE 2026 (il doit partir SEUL : ne pas le lancer à la main avant 20 minutes)
Le CRA signé de novembre est déjà reçu : une fois le PDF gardé (contrôle 3), la minuterie fait la copie puis le passage à blanc à son
premier passage (au plus 15 minutes). Aucun fichier n'est remis à Hermes pendant ce passage : rien ne peut être déposé.
À relever, SANS nom de portail, SANS adresse, SANS hôte, SANS nom de personne :
 a. journalctl -u hermes-portail-cra-signe --since '-25 min' --no-pager -o cat | tail -40    (la ligne « Résultat CRA signé : … » et
    « Compte rendu pour JARVIS : … »)
 b. sudo python3 -I -c "import json; r=json.load(open('/var/lib/hermes-portail-retours/signe-2026-11.json')); print(r['etat'], r['reel'], r['premiere'], '|', r['texte'])"
    → attendu : « pret False False | … ». Vérifier à l'œil que le texte ne contient ni nom du portail ni adresse ; s'il en
    contient un : le dire (c'est un défaut du nettoyage), sans le recopier.
 c. sudo ls -la /var/lib/hermes-portail/cra-signe /var/lib/hermes-portail/cra-signe/2026-11 ; sudo cat /var/lib/hermes-portail/cra-signe/2026-11/etat ; sudo cut -c1-30 /var/lib/hermes-portail/cra-signe/tentes.txt
    → root 700 ; signe.pdf et prepare.json en 600 ; etat = pret ; une ligne « blanc 2026-11 … ».
 d. Dans le dernier fichier /var/lib/hermes-portail/essais/*-cra-signe.txt (root seul), ce qu'Hermes a vu, en clair et en mots
    à toi : comment s'appelle l'onglet ou la zone du dépôt ; y a-t-il un vrai champ de fichier, ou une zone « glisser-déposer »,
    une fenêtre, un type de document à choisir, une case à cocher, un bouton de confirmation ; ce que la page dit du mois
    (statut) ; un document y est-il déjà ; les lignes « Appris : » gardées.
 e. journalctl -u hermes-portail-filtre --since '-25 min' --no-pager -o cat | grep -c refus    (et, s'il y en a, combien d'hôtes
    différents, sans les nommer : un dépôt de fichier peut passer par un autre hôte que celui du portail — à savoir avant le vrai dépôt)
 f. sudo ls -la /var/lib/hermes-portail-depot                         (aucun CRA-signe-*.pdf ne doit y rester)
 g. Côté JARVIS : journalctl -u jarvis --since '-25 min' --no-pager -o cat | grep -ci 'signé'    et la lecture 3 : « signe » doit
    contenir « retour » et « notifiePret ».
Si rien n'est parti après 20 minutes : sudo hermes-portail cra-signe-auto (à la main, il dit pourquoi il ne fait rien, ou fait le
passage à blanc) ; rapporter sa phrase. Si le résultat est « introuvable » ou « echec » : ne PAS relancer (un essai par fichier) ;
rapporter d et e. NE PAS toucher à jours.json, ne pas poser de oui à sa place : le dépôt réel n'a lieu qu'après son oui dans l'app.

RETOUR ARRIÈRE
- Tout arrêter côté portail (ni essai, ni dépôt) : sudo systemctl disable --now hermes-portail-cra-signe.timer
- Revenir à l'ancien chemin dans JARVIS (« à rattacher », « C'est rattaché ») : revenir au commit d'avant et redémarrer jarvis ; le
  dossier /home/jarvis/.jarvis/cra-signe et la clé « signe » de jours.json sont alors ignorés (les effacer seulement sur sa demande).
- Rien à défaire sur le portail : l'essai à blanc ne dépose rien.

CE QUE J'ATTENDS EN RETOUR
- les lectures 1 à 3 (des nombres et des oui/non) ; les contrôles 1 à 4 ;
- l'essai à blanc : a, b (l'état et le texte tel qu'écrit), c, d (en mots à toi), e (un nombre), f, g ;
- la durée du passage, et tout ce qui a surpris. Pas de nom de portail, pas d'adresse, pas de nom de personne.
```

Après son premier oui dans l'app (pas dans cette demande) : le dépôt part au quart d'heure suivant ; à relever alors, de la même
façon : `signe-2026-11.json` (`depose True True`), `deposes.txt`, les refus du relais pendant le passage, et sa vérification à lui
sur le portail.

## 3. Ce qu'il verra, et ce qu'il aura à faire

| Moment | Ce qu'il voit | Ce qu'il fait |
|---|---|---|
| Le client répond avec le PDF | Notification « CRA signé reçu de ton client » (« Hermes vérifie le portail, puis te demande ton oui pour le déposer »). Travail › carte « CRA du mois » : étape « CRA du client reçu » faite ; une ligne « CRA signé reçu : Hermes vérifie le portail… » (ou « …une fois le CRA du mois validé ») | Rien |
| Hermes a trouvé où le déposer (dans le quart d'heure) | Notification « CRA signé prêt à déposer : ton oui ». « Pour moi » : la ligne de Travail dit « CRA signé reçu : Hermes le dépose sur le portail ? ». La carte : « À toi : … ? « nom du fichier », taille. Il a trouvé où le déposer (essai à blanc : rien n'est déposé) » | Toucher la carte |
| La feuille de la carte | Le fichier, sa taille, « Ouvrir le mail » ; deux boutons : « Oui, déposer » et « Je le fais moi-même » | « Oui, déposer », puis confirmer (« Hermes dépose « … » sur le portail ? » → « Oui, déposer ») |
| Après son oui | La carte : « Ton oui est noté : Hermes dépose le CRA signé sur le portail (dans le quart d'heure) » | Rien |
| Déposé | Notification « Première exécution d'Hermes : CRA signé de novembre déposé — vérifie sur le portail » (ensuite : « CRA signé de <mois> déposé »). Carte : 5 étapes sur 5, « CRA signé déposé sur le portail par Hermes le … » | La première fois : vérifier sur le portail |
| Hermes n'a pas trouvé, ou n'a pas pu | Notification « CRA signé de <mois> : à déposer à la main » ; la carte le dit avec la raison | Le déposer lui-même, puis « C'est rattaché » |
| Le dépôt a échoué | Notification « CRA signé de <mois> pas déposé : à faire à la main » ; étape « Rattaché » en rouge ; boutons « Réessayer avec Hermes » et « C'est rattaché » | L'un ou l'autre (vérifier le portail avant de réessayer) |
| « Je le fais moi-même » | L'ancien chemin : « à rattacher sur le portail », bouton « C'est rattaché » | Le déposer, puis « C'est rattaché » |

Pour novembre 2026 : après le déploiement, sans rien faire, il doit recevoir « CRA signé prêt à déposer : ton oui » dans le quart
d'heure (sauf s'il a déjà touché « C'est rattaché »).

## 4. Bancs, avant et après

| Banc | Avant | Après | Échecs |
|---|---|---|---|
| `jarvis-os/server/tests/jours.test.mjs` | 106 | 134 | 0 |
| `jarvis-os/server/tests/travail.test.mjs` | 31 | 37 | 0 |
| `jarvis-os/server/tests/server.test.mjs` | 427 | 434 | 0 |
| `essais/hermes/portail.test.sh` | 188 | 214 | 0 |
| `essais/jarvis-os-maquette/banc/banc.cjs` | 430 OK, 3 échecs connus (repassé ce jour sur l'app d'avant ; la consigne disait 429) | 438 OK | 4 : les 3 connus, et 1 instable (voir dessous) |
| `essais/hermes/relance.test.sh` (`limite.py` : une unité de plus) | 88 | 88 | 0 |

Le banc de l'app, mot pour mot (second passage, seul sur la machine, 27/11/2026 vers 16 h 30 UTC) :
- `ÉCHEC plusieurs jours : l'événement est listé avec sa période et apparaît sur chacun de ses trois jours dans le mois` (connu, lié à la date) ;
- `ÉCHEC plusieurs jours : écrit dans l'agenda en journées entières, fin au lendemain du dernier jour (règle de Google), et relu sur ses trois jours` (connu) ;
- `ÉCHEC agenda : le rendez-vous écrit aussi dans Échéances n'est listé qu'une fois dans le mois, avec le bot qui le suit` (connu) ;
- `ÉCHEC notification de la page : croix « Fermer », fermée tout de suite :: toast vu : true` : **pas dans la liste connue**. Il a
  échoué aux deux passages complets de la nouvelle app et à un passage du seul début du banc ; il a réussi sur l'app d'avant (un passage
  complet, un début de banc), et sur la nouvelle app à un autre début de banc et seul. Relevé pas à pas : le clic de Playwright sur
  la croix prend 2,6 s et plus quand la machine est chargée (il attend la fin de l'animation de la notification) ; or la maquette
  affiche « Écrit dans Pilotage » 5 secondes après l'action : dès que le clic tarde un peu plus, cette seconde notification est là
  au moment du contrôle. C'est une course du banc, pas une régression vue à l'écran (probable, pas certain : 3 échecs sur 5 avec la
  nouvelle app, 0 sur 3 avec l'ancienne ; rien de ce chantier ne touche aux notifications de la page). Le test n'est pas modifié :
  à décider (par exemple attendre la fin de l'animation avant de cliquer, ou contrôler la notification cliquée plutôt que toutes).
Les 9 vérifications « 0.97 » de l'app passent (carte, feuille, confirmation, « Je le fais moi-même », « Pour moi », les états
« vérifie », « échec », « fait »). Le premier passage complet avait trouvé deux défauts à moi, corrigés depuis : « Je le fais
moi-même » n'était pas à côté de « Oui, déposer », et le banc lisait la question de confirmation avant qu'elle soit écrite.

Dans `server.test.mjs`, une vérification existante a changé de texte : la carte ne dit plus « CRA signé reçu : à rattacher » dès la
détection (elle attend qu'Hermes ait regardé le portail) ; les 7 nouvelles couvrent le PDF gardé, l'absence de route qui le rend,
les états, son oui (refus et accord), le compte rendu « depose », et les refus (401) sans appareil relié, pour un invité, un jeton
MCP (lecture, exécutant), la clé du Raccourci.

## 5. Ce qui n'a pas pu être testé, et les risques

- **Le vrai portail n'a jamais été vu pour ce dépôt** (certain). Tout ce que la skill dit de l'endroit du dépôt vient d'une phrase
  du propriétaire : « l'onglet du haut de la page du CRA ». Deviné : qu'il y a un champ de fichier ordinaire (et pas seulement une
  zone « glisser-déposer », une fenêtre, un type de document à choisir) ; que le dépôt se fait sur le même hôte (sinon le relais le
  refuse : « rien déposé ») ; que choisir le fichier ne suffit pas à l'envoyer (si c'est le cas, le dépôt réel marche quand même, et
  l'essai à blanc ne risque rien puisqu'aucun fichier n'est remis) ; que le portail accepte un PDF de cette taille ; qu'un document
  déjà déposé se voit sur la même page. L'essai à blanc réel de novembre est là pour lever ces points : c'est le relevé « d » et « e »
  de la demande. **Le premier vrai dépôt reste un essai** : il le vérifie sur le portail (notification « Première exécution »).
- **`upload_file` sur un formulaire « multipart »** : prouvé au banc avec le vrai navigateur d'Hermes et le faux portail (le fichier
  arrive entier, même empreinte) — certain au banc, probable sur le portail.
- **Le texte du compte rendu sans nom de portail** (probable) : adresses, hôtes, adresses mail et mots tirés de l'hôte sont retirés
  par root, puis de nouveau par JARVIS ; les lignes « Connexion » et « Page d'arrivée » d'Hermes ne sont jamais recopiées. Un nom de
  portail écrit en toutes lettres par le modèle, différent de l'hôte, passerait : contrôle « b » de la demande.
- **« Déjà déposé » et « introuvable » reposent sur la lecture d'Hermes** (probable) : au banc, ces deux réponses sont simulées
  (sans passage du navigateur) ; seuls l'essai à blanc et le dépôt réel passent par le navigateur.
- **Deux minuteries du portail en même temps** (probable, existait déjà) : `cra-signe-auto` ne part pas si un passage d'Hermes
  tourne ni pendant `cra-mois-auto`, mais `cra-auto`, `ndf-auto` et `notes-auto` ne regardent pas la sienne ; deux passages lancés
  dans la même minute se marcheraient dessus (même fichier de consigne). Pas corrigé ici (il faudrait un verrou commun à tous les
  passages) : à décider.
- **Un oui puis « C'est rattaché » dans la même minute** : root relit `jours.json` au début de son passage ; s'il a déjà commencé,
  le dépôt se fait quand même (deviné : rare ; le portail aurait alors deux documents).
- **Après un dépôt en échec, « Réessayer avec Hermes »** refait une tentative sans nouvel essai à blanc ; la skill regarde d'abord
  si un document est déjà là (« déjà déposé »), mais c'est le modèle qui le lit (probable).
- **Le coffre verrouillé** (après un redémarrage du serveur) : ni l'essai ni le oui ne sont comptés, tout repart quand il rouvre le
  coffre — écrit, pas passé au banc (probable).
- **JARVIS sur son téléphone** : l'app n'a été vue qu'au banc (émulation iPhone 15 Pro Max, données d'exemple), pas sur l'iPhone.
- **Le quota de Gmail** : un téléchargement par CRA signé, une relecture du fil ; un quota atteint repousse au quart d'heure
  (certain au banc pour l'échec réseau, probable pour le quota).
- **Novembre 2026** : l'essai à blanc ne part que si novembre est noté validé par Hermes chez root (lecture 2) et si
  `suivi.cra.rattache` est absent (lecture 3) — probable, à confirmer par la session.
- **Fusion** : `index.html` est changé dans le bloc 0.85.0 (carte et feuille de Travail) et en deux endroits du cœur (`pickAsk`,
  bouton de confirmation : `ask`, `yes`) ; aucun bloc 0.91 à 0.96 n'est touché. `server.mjs` : une ligne (`piece`).
  `travail.mjs` lit désormais les comptes rendus de root à chaque ouverture de Travail (`jours.lireRetours`) : les notes de frais
  en profitent aussi.
