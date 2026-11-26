# Chantier C — 0.91.0 : rangement des papiers par JARVIS (26/11/2026)

Note de passage pour le coordinateur : ce qui va dans `docs/jarvis-os.md`, ce qui est à demander à la session « Serveur JARVIS », ce que le propriétaire doit faire, les bancs, ce qui n'a pas pu être testé. Aucun secret, aucune donnée personnelle, exemples inventés.

## 1. Entrée de journal pour `docs/jarvis-os.md`

- **0.91.0 (26/11/2026) : rangement des papiers par JARVIS** (avant, Iris rangeait ce qu'il déposait ; Grok Bot est arrêté, et depuis la 0.87.0 Papiers › Déposer disait seulement « le fichier va dans À trier, range-le toi-même »). *Le parcours* : il dépose un PDF ou une image (Papiers › Déposer : un vrai champ fichier, plusieurs à la fois ; ou le menu Partager, voir plus bas) ; le serveur garde le fichier, JARVIS propose le dossier de « RD Assistant/Papiers » et le nom ; il valide ou corrige (dossier choisi dans l'arbre, nom modifiable, extension fixe) ; **seulement après son oui** (« Oui, ranger ici »), le serveur écrit dans Drive ; « Retirer » (deux appuis) efface le fichier du serveur ; « Rangés récemment » garde le lien. *Le module* (`depot.mjs`, branché dans `server.mjs`) : le fichier est gardé dans `depot/` du dossier de données (dossier 700, fichier 600, écrit neuf et relu sans suivre de lien, nom tiré au sort : jamais un nom ni un chemin du client), l'état dans `depot.json` (600 ; ni le texte du document ni le chemin du client) ; 25 Mo au plus ; PDF, JPEG, PNG, HEIC ou HEIF reconnus à leurs premiers octets (le type annoncé ne compte pas) ; nom assaini (pas de chemin, de caractère caché ni de sens d'écriture forcé, extension du type lu, 100 caractères) ; 40 fichiers et 300 Mo en attente au plus ; le même fichier déposé deux fois n'est gardé qu'une fois ; pas validé au bout de **30 jours** : effacé (ménage au tic de la santé, toutes les 10 minutes, et à chaque lecture). *La proposition* : des règles d'abord (une trentaine de genres : passeport, titre de séjour, carte Vitale, quittance, bail, carte grise, billet, crèche… ; dans le nom du fichier, puis dans le texte du PDF lu par `pdf.mjs` ; la personne par le nom de son dossier ; un sous-dossier par ses mots ; le nom « Genre Personne AAAA-MM ») ; Claude du serveur (rapide, **sans aucun outil**, un seul à la fois) seulement quand les règles n'ont rien reconnu et que le PDF a du texte, sa réponse vérifiée (le dossier doit être un de la liste) ; une image n'est pas lue : « À trier » et un nom daté ; un papier de banque, d'impôts ou de salaire est signalé, jamais donné à Claude, jamais proposé ailleurs que dans « À trier ». *Les garde-fous de l'écriture* : à la validation l'arbre de Papiers est relu et le dossier doit en faire partie ; « Papiers privés » est refusé par son identifiant et par son nom, lui et ce qu'il contient ; le fichier relu doit avoir l'empreinte du dépôt ; un fichier du même nom déjà dans le dossier : « … (2) », jamais par-dessus ; envoi en deux temps de Google (métadonnées, puis octets, à une adresse qui doit être chez Google) ; **jamais de partage** (aucun appel « permissions »). *Qui y a droit* : les routes `/api/depot` (lire, déposer, corriger, valider, retirer) sont derrière `authed` : un appareil relié, verrou passé (423 sinon) ; un invité, un jeton MCP et la clé du Raccourci sont refusés (401) ; **aucun outil MCP n'écrit dans Drive** (rien d'ajouté à `mcp.mjs` ; l'envoi, `GOOGLE.papiers`, n'est donné qu'au dépôt, hors des outils de `/api/tool`), ni une mission ni Claude ; le dossier `depot/` est aussi interdit aux outils de fichiers de Claude Code. *Google* : portée `drive` (complète), **facultative** comme `drive.file` (`SCOPES_OPTION`) : sans elle tout le reste marche, le dépôt et la proposition aussi, la validation répond « Reconnecte Google une fois (Réglages, Google, Reconnecter) » et la santé dit « Rangement des papiers : à relier » (sans notification) ; `drive.file` ne suffisait pas (les dossiers de Papiers n'ont pas été créés par JARVIS) ; la copie chiffrée de Pilotage marche avec l'une ou l'autre (`driveCopies`), `driveDepot` dit la nouvelle. *Le menu Partager* : sur iPhone, Safari n'offre pas le partage vers une app de l'écran d'accueil ; un Raccourci « Partager » poste le fichier à `POST /api/raccourci/depot` avec la clé de son Raccourci (corps « Formulaire » ou « Fichier ») : le fichier est seulement gardé en attente, une notification « Papier reçu » ouvre Papiers › Déposer (`/#voir-papiers-depot`), l'écran explique le Raccourci ; ailleurs (Android), `share_target` du manifeste : le service worker reçoit le POST (il arrive sans le jeton de l'appareil, le serveur ne peut pas le recevoir lui-même), garde les fichiers dans le cache « jarvis-os-partage », rouvre l'app, qui les envoie avec son jeton puis vide le cache ; ses règles sont gardées (pas de `skipWaiting` à l'installation, exclusions `/api/`, `/courses`, `/invite`, `/maquettes`). *L'app* (bloc « 0.91.0 : rangement des papiers par JARVIS », avant « 0.86.0 ») : `SCREEN.depot` enveloppé ; le filtre « Déposer » porte le nombre en attente ; plus aucun chemin par Iris ni par le Canal : serveur pas encore à jour, c'est la carte « À trier » de la 0.87.0 qui reste, que Grok soit arrêté ou non ; pont `JarvisServeur.depot` ; exemples dans `window.__DEPOT`. Bancs : `depot.test.mjs` 42 (nouveau), `depot-app.test.mjs` 6 (nouveau : vrai serveur, faux Google, Chromium), `server.test.mjs` 385 → 394, `verrou.test.mjs` +1, maquette +12 ; le faux Google sait recevoir un fichier (envoi en deux temps, octets intacts).

À reporter aussi (je n'y ai pas touché) :
- `docs/jarvis-os-reprise.md`, « L'accès Google direct » : portée `drive` facultative (rangement des papiers), `google.mjs` → `papiers` (hors des outils de la page). « Tester » : deux lignes, `node jarvis-os/server/tests/depot.test.mjs` (42 : types aux premiers octets, nom assaini, multipart, arbre sans « Papiers privés », règles, réponse de Claude vérifiée, dépôt 600/700, refus hors arbre, son oui en deux écritures sans partage, « (2) », corriger, retirer, liens, empreinte, portée absente, Google qui refuse, adresse d'envoi ailleurs, Claude seulement si utile, plafond, 30 jours, portées demandées, aucun outil MCP) et `NODE_PATH=/opt/node-tools/node_modules node jarvis-os/server/tests/depot-app.test.mjs` (6 : de bout en bout dans Chromium ; `DEPOT_APP_CAPTURE=<fichier.png>`).
- `CLAUDE.md` : la ligne du tableau « Papiers » dit encore « Iris y range ce qu'il dépose » ; depuis la 0.91.0, c'est JARVIS, sur son oui.
- La constante `VERSION` de `server.mjs` (laissée à 0.89.0).

## 2. Session « Serveur JARVIS »

Rien à faire sur le serveur au-delà de `git pull` et du redémarrage de jarvis : le dossier `depot/` et `depot.json` sont créés par le serveur au premier dépôt ; aucune variable, aucune unité, aucun hôte nouveau (Drive passe par l'accès Google déjà en place). Section à fondre dans la demande commune, pour les contrôles en lecture seule :

```text
SECTION « RANGEMENT DES PAPIERS » (0.91.0 ; à fondre dans la demande commune ; <COMMIT> = le commit de main qui contient la fusion).
Aucun secret dans cette section ni dans ta réponse. Ne recopie aucun nom de fichier du dossier depot/ (des comptes seulement).

LECTURES (sans demander)
- git -C /opt/rd log --oneline -1 ; systemctl is-active jarvis
- sudo grep -n -i 'request_body\|max_size' /etc/caddy/Caddyfile   (attendu : rien ; une limite sous 26 Mo couperait un dépôt de 25 Mo)
- sudo grep -n -i 'courses\|invite\|partage' /etc/caddy/Caddyfile   (attendu : rien sur « partage » ; /partage doit arriver à jarvis comme le reste)
- df -h /home/jarvis | tail -1   (le dépôt garde au plus 300 Mo en attente)
- La copie du serveur de chaque nuit, si elle existe : dis seulement si elle prend tout /home/jarvis/.jarvis (le dossier depot/ en ferait
  alors partie : des papiers en attente, 30 jours au plus). Ne change rien.

DÉPLOIEMENT (un seul oui ; sauter ce que la demande commune a déjà fait)
1. sudo -u jarvis git -C /opt/rd pull --ff-only   (attendu : <COMMIT>)
2. sudo systemctl restart jarvis

CONTRÔLES (lecture seule)
3. curl -s http://127.0.0.1:8787/api/health   (version attendue : celle de <COMMIT>)
4. curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/api/depot   (→ 401 : réservé à un appareil relié)
   curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8787/api/raccourci/depot   (→ 401 : sans la clé du Raccourci)
   curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -X POST http://127.0.0.1:8787/partage   (→ 303, vers /#voir-papiers-partage-vide)
5. journalctl -u jarvis -n 30 --no-pager -o cat | grep -c 'dépôt'   (attendu : 0 ; une ligne « [jarvis] dépôt : … » dirait une erreur, recopie-la)
6. Après son premier dépôt seulement (sinon le dossier n'existe pas encore, c'est normal) :
   sudo stat -c '%U %a' /home/jarvis/.jarvis/depot /home/jarvis/.jarvis/depot.json   (→ jarvis 700, jarvis 600)
   sudo find /home/jarvis/.jarvis/depot -type f ! -perm 600 | wc -l   (→ 0) ; sudo find /home/jarvis/.jarvis/depot -type f | wc -l   (le nombre en attente)

RETOUR ARRIÈRE
- Le code : sudo -u jarvis git -C /opt/rd checkout <commit d'avant> && sudo systemctl restart jarvis
  (l'app revient à la carte « À trier » ; la portée Google « drive », si elle a été accordée, ne sert plus à rien et ne gêne pas).
- Les fichiers en attente restent dans /home/jarvis/.jarvis/depot : il les retire lui-même dans JARVIS avant le retour arrière, ou bien,
  sur son oui (c'est une suppression) : sudo -u jarvis rm -r /home/jarvis/.jarvis/depot /home/jarvis/.jarvis/depot.json
- Rien de ce qui est déjà rangé dans Drive n'est touché par un retour arrière.

CE QUE J'ATTENDS EN RETOUR
Commit déployé et version ; les deux lectures de Caddy (rien, ou les lignes trouvées) ; la place libre ; si la copie de nuit prend depot/ ;
les trois codes de l'étape 4 ; le compte de l'étape 5 (et la ligne s'il n'est pas 0) ; à l'étape 6, les droits et les deux comptes, ou
« pas encore de dépôt » ; toute erreur mot pour mot.
```

## 3. Ce que le propriétaire doit faire

1. **Reconnecter Google une fois** (après la mise à jour du serveur). Dans JARVIS : Espaces, Réglages, carte Google, bouton « Reconnecter » (le bouton existe ; l'onglet de Réglages où se trouve la carte n'est pas vérifié). Sur l'écran de Google : passer l'avertissement « Google n'a pas validé cette application » comme les autres fois (libellés devinés : « Paramètres avancés », puis « Accéder à … »), puis **tout cocher**, dont la nouvelle ligne de Drive (libellé deviné : « Consulter, modifier, créer et supprimer tous vos fichiers Google Drive »). Sans cela, rien d'autre ne casse : le dépôt garde les fichiers et la validation répond « Reconnecte Google une fois ».
2. **Déposer** : Espaces, Papiers, filtre « Déposer », champ « Le fichier » (PDF ou photo, plusieurs possibles). La carte du fichier montre le dossier proposé et le nom : changer l'un ou l'autre si besoin, puis « Oui, ranger ici ». « Retirer » demande un second appui.
3. **Menu Partager de l'iPhone (facultatif)** : le Raccourci décrit dans l'écran, sous « Depuis le menu Partager de l'iPhone » (dupliquer son Raccourci « Jarvis », qui garde la clé ; « Afficher dans la feuille de partage » ; une seule action « Obtenir le contenu de l'URL » en POST vers l'adresse affichée, même en-tête Authorization, corps « Formulaire » avec un champ « fichier » de type Fichier = l'entrée du raccourci ; « Afficher le résultat »). Noms de menus devinés (ils changent selon la version d'iOS). S'il n'a plus de Raccourci « Jarvis » : Réglages, carte « Siri et bouton Action », qui donne une clé neuve (l'ancienne cesse de marcher).
4. Si l'écran montre encore « Le fichier va dans « À trier » » : l'app ou le serveur n'est pas à jour (fermer JARVIS et le rouvrir ; le service worker ne prend la relève qu'app à l'arrière-plan).

## 4. Bancs, avant et après

| Banc | Avant | Après |
|---|---|---|
| `depot.test.mjs` (nouveau) | — | 42 OK |
| `depot-app.test.mjs` (nouveau, Chromium) | — | 6 OK |
| `server.test.mjs` | 385 OK (relancé ici avant tout changement) | 394 OK (9 nouvelles) |
| `pilotage-local.test.mjs` | 51 | 51 OK |
| `banc.cjs` (maquette) | 349 OK, 1 échec connu (référence du coordinateur ; pas relancé jusqu'au bout ici, machine trop chargée) | BANC_APRES |
| `verrou.test.mjs` | 43 | VERROU_APRES |
| `fiab-b3` 24, `fiab-b1` 13, `fiab-a4` 30, `fiab-a2` 32, `fiab-a1` 35, `fiab-a5` 24, `fiab-c` 12, `limite` 14 | — | tous OK |
| `fiab-a6.test.mjs` | 2 échecs sur 2 | 2 échecs sur 2, identiques sur le code d'avant (HEAD 375cd15) : « rappels du matin : une lecture ratée à 8 h 01 (Google 503)… » puis « exception :: TypeError: Cannot read properties of undefined (reading 'body') » ; sans rapport avec ce chantier |

Vérifications existantes retouchées (trois, dites ici) : `banc.cjs`, la page « Grok arrêté » de la 0.87.0 est ouverte avec `depot: false` (serveur pas encore à jour), pour que sa vérification de la carte « À trier » reste vraie ; `server.test.mjs`, « local : la copie de la nuit… rien ne part dans Drive » ne compte plus les envois du dépôt faits plus haut dans le même banc ; `fake-google.mjs` garde le corps d'une requête en octets (même texte qu'avant).

`banc-serveur.mjs` et `audit.cjs` n'ont pas été lancés : ni le démarrage de l'app ni le contrôle d'accès de `jarvis-serveur.js` ne changent (le pont gagne seulement `JarvisServeur.depot`), et `banc-serveur.mjs` ne passe pas par Papiers › Déposer.

## 5. Pas testé, et risques

| Point | Certitude | Détail |
|---|---|---|
| Le menu Partager de l'iPhone ne propose pas une app web installée (pas de Web Share Target dans Safari) | certain jusqu'à iOS 18, probable ensuite | WebKit ne l'a pas mis en œuvre à ma connaissance ; se vérifie en dix secondes : Photos, Partager, chercher « J.A.R.V.I.S ». S'il apparaissait un jour, le `share_target` du manifeste et le service worker sont déjà là. |
| Le Raccourci « Partager » sur un vrai iPhone | probable (corps « Formulaire ») ; deviné (noms des menus, corps « Fichier ») | Testé seulement par le banc : un POST multipart avec la clé du Raccourci, et un corps brut. Avec « Fichier », le nom du fichier n'est pas transmis (nom daté par défaut). Un fichier à la fois (le serveur prend le premier d'un formulaire). |
| Le partage sur Android (service worker) | probable | Testé hors navigateur (faux `self`) et, pour la suite, dans Chromium (fichier posé dans le cache puis envoyé par l'app) ; jamais sur un vrai Android. |
| Le vrai Google Drive | probable | Tout est testé contre le faux Google. L'envoi en deux temps suit la documentation de Drive (adresse de session sur `www.googleapis.com`) ; si Google rendait une adresse d'une autre origine, rien ne partirait et l'écran le dirait. |
| L'écran d'accord de Google avec la portée `drive` | probable | Portée « restreinte », comme `gmail.modify` et `drive.readonly` qu'il a déjà accordées dans ce projet non validé : même avertissement attendu, aucun réglage à changer dans Google Auth Platform (deviné : je n'ai pas vu sa console). Si Google refusait la portée, tout le reste continuerait de marcher (elle est facultative). |
| 25 Mo sur le réseau mobile, à travers Caddy | probable | Pas testé hors boucle locale ; une limite de corps dans Caddy se verrait à la lecture demandée plus haut ; un envoi de plus de 5 minutes serait coupé par le serveur Node. |
| La qualité des propositions sur ses vrais papiers | probable pour les genres listés, deviné pour le reste | Les règles s'appuient sur le nom du fichier et le texte du PDF ; un scan (PDF sans texte) ou une photo n'ont que leur nom : « À trier » par défaut. La personne n'est trouvée que si le nom de son dossier est dans le nom du fichier ou le texte. |
| Claude pour proposer | probable | Testé avec un faux Claude (réponse reprise, dossier hors liste écarté, pas de réponse). Le texte d'un PDF non reconnu (2 500 caractères au plus) part au Claude de son forfait, sans outil ; les papiers de banque, d'impôts et de salaire reconnus par les règles n'y partent pas, mais un document financier que les règles ne reconnaissent pas y partirait (Claude a consigne de répondre « privé »). |
| HEIC | probable | Reconnu à ses octets ; le champ fichier de Safari peut convertir une photo en JPEG (les deux sont acceptés). |
| La copie de nuit du serveur | à vérifier (lecture demandée) | Si elle prend tout le dossier de données, les papiers en attente y sont, 30 jours au plus. |

Points ouverts, hors de mon périmètre :
- L'ancien écran « Iris range » (`SCREEN.depot` d'origine) n'est plus atteignable ; son code reste dans `index.html` (rien n'est réécrit). D'autres ordres « Iris : mon Drive » (`LV_DRIVE_ORDER`, écran de vérification du courrier) demandent encore à Iris de ranger le Drive : pas un dépôt, donc laissés ; Grok arrêté, ils partent à Hermes par le Canal.
- La carte « À trier » de repli dit encore « le rangement par JARVIS viendra plus tard » : elle ne se voit plus qu'avec un serveur pas à jour.
- Caddy : `/partage` et `/api/raccourci/depot` supposent que Caddy envoie tout sauf `/courses…` à jarvis (lecture demandée).
- Fusion : `index.html` (bloc inséré avant le commentaire « 0.86.0 »), `banc.cjs` (une ligne de la 0.87 et un bloc avant le `catch` final), `server.test.mjs` (bloc dans la section MCP, avant `google/unlink`), `server.mjs` (import, santé, `DEPOT` avant `COMP`, deux routes avant `/api/raccourci`, une route avant `/api/travail`, une entrée dans `guardSettings`).
