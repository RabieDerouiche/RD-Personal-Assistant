# Chantier D — 0.92.0 : Hermes et ses routines, en direct (26/11/2026)

Note de passage pour le coordinateur : à fondre dans `docs/jarvis-os.md`, `docs/hermes.md`, `docs/jarvis-os-reprise.md` et la demande
commune à la session « Serveur JARVIS », puis à retirer. Aucun secret, aucune donnée personnelle, aucun nom de portail ici.

## 1. Textes à reprendre

### Entrée pour `docs/jarvis-os.md`

- **0.92.0 (26/11/2026) : Hermes et ses routines, en direct** (sa remarque : dans l'app, Espaces › « Hermes et ses routines » ne montrait qu'une ligne périmée de l'onglet Routines de Pilotage ; les vraies routines sont dans le cron d'Hermes, `jobs.json`, chez l'utilisateur `hermes`, que JARVIS ne peut pas lire). *Root écrit un résumé assaini* : à chaque passage de `hermes-relance` (toutes les 10 minutes), même sans rien à relancer et sans lire l'usage en plus, `limite.py` écrit `/var/lib/hermes-relance-etat/routines.json` (dossier `root:jarvis` 750, fichier 640, fichier temporaire puis renommage, jamais à travers un lien) : pour chaque routine de la liste fermée (`routines.conf`, copie root posée par `install.sh` et rafraîchie par `routines.sh`), nom, libellé, moment (« du lundi au vendredi à 7 h 40 », d'après l'horaire vraiment posé chez Hermes), mode (réel ou double, `routines.mode` l'emporte), posée ou non, active ou non, dernier passage, résultat (ok, erreur, jamais ; une erreur réduite à une catégorie : limite du forfait, réseau, résultat non envoyé, arrêtée à la main, erreur), prochain passage ; plus la passerelle (active, arrêtée, plantée, démarre, inconnue), le garde du forfait (actif, coupé et jusqu'à quand, a arrêté Hermes, arrêté) et l'heure d'écriture. Rien n'est recopié de `jobs.json` : les dates sont refaites, jamais le texte d'une erreur, un chemin, un jeton, un nom de portail ou un contenu de mail ; une routine `jarvis-…` hors de la liste est seulement comptée. Une erreur d'écriture du résumé est avalée et dite dans le journal (son genre seulement) : elle ne change ni la relance ni son code de sortie. *JARVIS le sert* : `hermes-routines.mjs`, `GET /api/hermes/routines` (appareil relié), fichier et dossier lus sans suivre de lien, 32 Ko au plus, JSON revalidé champ par champ (liste blanche de formes, mots connus) ; résumé absent, illisible, d'une autre version, daté dans le futur ou **de plus de 30 minutes** : `{disponible: false, code, raison}`, sans aucune routine ; JARVIS n'écrit jamais dans ce dossier. Chemin réglable pour le banc : `JARVIS_HERMES_ROUTINES`. *Santé* : une ligne d'information « Routines d'Hermes » (« 6 routines en direct ; dernière écriture à 14 h 02 ; en erreur au dernier passage : … », ou « résumé indisponible : … »), jamais une notification ; rien là où Hermes n'est pas installé (dossier absent). *App* (bloc « 0.92.0 : Hermes et ses routines en direct », juste après le bloc 0.86.0 ; il range ce qui existe) : Grok arrêté, la page « Hermes et ses routines » montre sa carte (passerelle, garde du forfait, dernier et prochain passage ; de Pilotage il ne reste que sa dernière note, datée) et ses routines (libellé, mode, moment, dernier passage et résultat, prochain passage, « à jour à HH:MM ») ; la tuile d'Espaces dit le nombre de routines et ce qui cloche d'abord (passerelle, routine en erreur), sinon la prochaine ; Équipe › Routines a un panneau « Hermes » en direct et ne lit plus les lignes `Bot = Hermes` de l'onglet Routines ; les « Routines de JARVIS » (celles du serveur) ne changent pas. Résumé indisponible : « indisponible » avec la raison partout, **jamais une liste périmée** (plus de repli sur Pilotage). Relu au plus toutes les 30 secondes, chaque minute tant que la page est à l'écran, redessiné seulement si le résumé a changé et jamais pendant une saisie. Pont : `JarvisServeur.hermesRoutines()` (un serveur pas encore à jour : « indisponible », « le serveur de JARVIS n'est pas encore à jour »). Maquette sans serveur : `window.__HERMES_ROUTINES` (données inventées ; scénario `hermesIndispo`). Aucun outil MCP nouveau, rien de bancaire. Variables du banc côté root : `HERMES_RELANCE_RESUME`, `HERMES_RELANCE_CONF`, `HERMES_RELANCE_MODES`. Bancs : relance 80 (56 avant), Hermes 88 (84), serveur 398 (385), maquette 356 OK et le même échec connu de l'agenda (349).

### Paragraphe pour `docs/hermes.md`

Ligne à ajouter au tableau « Ce qui est installé et où » :

| Routines en direct dans JARVIS (0.92.0) | résumé écrit par `hermes-relance` à chaque passage : `/var/lib/hermes-relance-etat/routines.json` (root et groupe de JARVIS, 750 et 640) ; liste fermée : `/usr/local/lib/hermes-relance/routines.conf` (copie root de `routines.conf`, posée par `install.sh`, rafraîchie par `routines.sh`) |

Section à ajouter après « Relance automatique après la limite du forfait » :

### Les routines en direct dans JARVIS (0.92.0, 26/11/2026)

Sa remarque : dans l'app, « Hermes et ses routines » ne montrait qu'une ligne périmée de l'onglet Routines de Pilotage. JARVIS ne
peut pas lire le cron d'Hermes (`/home/hermes` en 0700) : c'est root qui lui en écrit un résumé, à chaque passage de
`hermes-relance.timer` (toutes les 10 minutes), après la relance, même quand il n'y a rien à relancer.

- **Ce qu'il contient** (`/var/lib/hermes-relance-etat/routines.json`, version 1) : l'heure d'écriture, la passerelle
  (`systemctl is-active hermes-gateway`), le garde du forfait (coupé et jusqu'à quand, a arrêté Hermes, actif ou arrêté d'après
  sa minuterie), et pour chaque routine de `routines.conf` : nom, libellé (« Routine « … » » de sa consigne), moment lisible
  (d'après `schedule.expr` de `jobs.json`, sinon l'horaire de `routines.conf` ; un horaire tordu reste « cron … »), mode (réel ou
  double : `/etc/hermes/routines.mode` l'emporte), posée ou non, active ou non, dernier passage, résultat, prochain passage.
- **Assaini** : liste fermée (une routine `jarvis-…` absente de `routines.conf` est comptée, jamais décrite) ; les dates sont
  refaites (UTC), jamais recopiées ; une erreur devient une catégorie (limite du forfait, réseau, résultat non envoyé, arrêtée à
  la main, erreur), jamais son texte ; ni chemin, ni jeton, ni nom de portail, ni contenu de mail.
- **Sans coût** : `jobs.json`, deux fichiers de root et `systemctl is-active` seulement. Aucune lecture d'usage en plus (la règle
  « sans rien de coupé, le script ne lit même pas l'usage » reste vraie), Hermes n'est jamais lancé pour ça.
- **Sans risque pour la relance** : écrit après elle, dans un `try` à part ; une erreur est dite dans le journal par son genre
  seulement (« Résumé des routines pour JARVIS : pas écrit (…) ») et ne change pas le code de sortie. `--a-blanc` n'écrit rien.
- **Droits** : dossier `root:jarvis` 750, fichier 640 (comme `/var/lib/hermes-relance-avis`), fichier temporaire puis
  renommage, jamais à travers un lien. Un dossier à part, et pas celui des avis : les avis sont des notifications que JARVIS
  marque « vues » et que root efface au bout de 14 jours, le résumé est un état remplacé toutes les 10 minutes ; les mêler
  aurait obligé à toucher le lecteur d'avis de la 0.89.0. `hermes` n'est pas dans le groupe : il ne le lit pas.
- **(certain, code d'Hermes v0.23.3, `cron/jobs.py`, et banc)** `jobs.json` = `{jobs: [...], updated_at}` ; par routine :
  `name`, `enabled`, `state` (`scheduled`, `paused`, `completed`, `error`), `paused_at`, `schedule` `{kind, expr, display}`,
  `next_run_at`, `last_run_at`, `last_status` (`ok`, `error`, `delivery_failed`, `cancelled`, ou un statut imposé),
  `last_error`, `last_delivery_error`, `last_failure` `{at, detail}`. Le banc d'Hermes écrit le résumé à partir d'un vrai
  `jobs.json` (une routine passée, une en pause).
- JARVIS le relit et le revalide (`jarvis-os/server/hermes-routines.mjs`, `docs/jarvis-os.md`, 0.92.0) : au-delà de 30 minutes
  sans écriture, il dit « indisponible ». `diagnostic.sh` montre les droits, l'âge et le nombre de routines du résumé.

Bancs : `bash essais/hermes/relance.test.sh` (80 vérifications), `sudo bash essais/hermes/banc.sh --neuf` (88).

### Lignes pour `docs/jarvis-os-reprise.md` (« Tester »)

- Serveur : 398 vérifications (dont 0.92.0 : route `GET /api/hermes/routines`, refus sans appareil relié, résumé absent, vieux,
  en lien, piégé, illisible, ligne « Routines d'Hermes » de la santé, aucune écriture de JARVIS).
- Maquette : 356 OK et l'échec connu de l'agenda (dont 0.92.0 : page Hermes en direct, tuile, Équipe › Routines, indisponible).
- Relance après la limite : 80. Hermes (`banc.sh --neuf`) : 88.

## 2. Section pour la demande commune à la session « Serveur JARVIS »

```text
SECTION « HERMES ET SES ROUTINES EN DIRECT » (0.92.0 ; à fondre dans la demande commune ; <COMMIT> = le commit de main qui contient
la fusion). Dans l'app, « Hermes et ses routines » ne montrait qu'une ligne périmée de Pilotage : désormais hermes-relance écrit à
chaque passage un résumé assaini du cron d'Hermes, que JARVIS lit (groupe en lecture seule) et que l'app affiche.
Aucun secret dans cette section ni dans ta réponse. Ne recopie jamais le contenu de /home/hermes/.hermes/cron/jobs.json
(les consignes et les erreurs y sont en clair) : le résumé, lui, peut être recopié (noms, dates, mots connus).

LECTURES (sans demander)
- git -C /opt/rd log --oneline -1 ; systemctl is-active jarvis hermes-gateway hermes-relance.timer
- ls -ld /var/lib/hermes-relance-etat 2>&1   (avant : « No such file or directory »)
- id -gn jarvis ; id -nG hermes   (attendus : jarvis ; hermes sans le groupe jarvis)

DÉPLOIEMENT (dans le même oui que la demande commune ; rien de plus à approuver si elle a déjà fait 1 à 3)
1. sudo -u jarvis git -C /opt/rd pull --ff-only   (attendu : <COMMIT> ; sauter si déjà fait)
2. sudo systemctl restart jarvis                    (sauter si déjà fait : la route GET /api/hermes/routines et la ligne de santé)
3. sudo bash /opt/rd/jarvis-os/hermes/install.sh    (sauter si déjà fait). Pour ce chantier il pose : la nouvelle copie root de
   limite.py et de hermes-relance, la copie root de routines.conf (/usr/local/lib/hermes-relance/routines.conf, 644) et le
   dossier /var/lib/hermes-relance-etat (root:jarvis, 750). Les unités ne changent pas.
4. Le premier résumé, sans attendre la minuterie (un passage normal de la relance, celui que la minuterie fait toutes les
   10 minutes ; il ne lit l'usage et ne relance quelque chose que si une routine est coupée par la limite) :
   sudo systemctl start hermes-relance.service ; systemctl show -p Result hermes-relance.service   (→ Result=success)

CONTRÔLES (lecture seule)
5. Droits : sudo stat -c '%U:%G %a %n' /var/lib/hermes-relance-etat /var/lib/hermes-relance-etat/routines.json /usr/local/lib/hermes-relance/routines.conf
   → root:jarvis 750 … ; root:jarvis 640 … ; root:root 644 …
   sudo ls -A /var/lib/hermes-relance-etat   (→ routines.json seul, pas de .tmp)
   sudo cmp /opt/rd/jarvis-os/hermes/routines.conf /usr/local/lib/hermes-relance/routines.conf && echo identiques
6. Le résumé (il peut être recopié en entier) :
   sudo python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); print(len(d["routines"]), "routines ; liste", d["liste"], "; cron", d["cron"], "; passerelle", d["passerelle"], "; garde", d["garde"], "; hors liste", d["inconnues"]); [print(" ", r["nom"], "|", r["moment"], "|", r["mode"], "|", "active" if r["active"] else "pas active", "|", r["dernier"], r["resultat"], r["cause"] or "", "|", r["prochain"]) for r in d["routines"]]' /var/lib/hermes-relance-etat/routines.json
   Attendu : « 6 routines ; liste True ; cron True ; passerelle active ; garde {'etat': 'coupé', 'jusqua': '2026-12-03'} ; hors liste 0 »,
   puis veille-du-matin, bilan-hebdo, reveil, digest-ia, prix-suivis, sorties-du-week-end, chacune en mode « réel », « active »,
   avec un prochain passage ; aucune ligne ne doit contenir un texte d'erreur, un chemin ou une adresse.
   Compare les prochains passages avec : sudo bash /opt/rd/jarvis-os/hermes/routines.sh --liste   (mêmes routines, mêmes heures à l'heure de Paris).
7. JARVIS le lit avec ses seuls droits (le même code que la route) :
   sudo -u jarvis node -e "import('/opt/rd/jarvis-os/server/hermes-routines.mjs').then((m) => { const r = m.createHermesRoutines({fichier: '/var/lib/hermes-relance-etat/routines.json'}).lire(); console.log(r.disponible ? 'disponible' : 'indisponible : ' + r.raison, r.passerelle || '', r.garde ? r.garde.etat : '', (r.routines || []).map((x) => x.nom + ':' + x.mode + ':' + x.resultat).join(' ')); })"
   → « disponible active coupé veille-du-matin:réel:… bilan-hebdo:réel:… reveil:réel:… digest-ia:réel:… prix-suivis:réel:… sorties-du-week-end:réel:… »
   Hermes ne le lit pas : sudo -u hermes cat /var/lib/hermes-relance-etat/routines.json 2>&1 | tail -1   (→ Permission denied ;
   si sudo refuse l'utilisateur sans shell : sudo runuser -u hermes -- cat … ; même attendu)
8. La route existe et reste fermée sans appareil relié (aucun jeton ici) :
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/api/hermes/routines   (→ 401)
9. Dix minutes plus tard (la minuterie seule) : sudo stat -c '%y' /var/lib/hermes-relance-etat/routines.json (heure du dernier
   passage à :02, :12, …) ; journalctl -u hermes-relance --since -15min --no-pager -o cat | tail -3
   (→ « Rien à relancer. » ; jamais « Résumé des routines pour JARVIS : pas écrit »)
   sudo bash /opt/rd/jarvis-os/hermes/diagnostic.sh | grep -A1 'relance après la limite'   (la ligne « résumé pour JARVIS : … »)

RETOUR ARRIÈRE
- Le code : sudo -u jarvis git -C /opt/rd checkout <commit d'avant> && sudo systemctl restart jarvis && sudo bash /opt/rd/jarvis-os/hermes/install.sh
  (l'ancienne copie de limite.py n'écrit plus de résumé ; l'app d'avant relit Pilotage). Puis, facultatif :
  sudo rm -rf /var/lib/hermes-relance-etat ; sudo rm -f /usr/local/lib/hermes-relance/routines.conf
- Le résumé seul, sans toucher au reste : rien à arrêter (il ne lance rien) ; le supprimer rend la page « indisponible »
  jusqu'au passage suivant de la minuterie.

CE QUE J'ATTENDS EN RETOUR
Commit déployé ; le Result de l'étape 4 ; les trois lignes de droits et « identiques » (étape 5) ; la sortie complète de l'étape 6
(le nombre de routines et les lignes) et ce que dit routines.sh --liste ; la ligne de l'étape 7 et le refus pour hermes ;
le code de l'étape 8 ; les trois lignes du journal et la ligne du diagnostic (étape 9) ; toute erreur mot pour mot.
```

## 3. Ce que le propriétaire verra, et ce qu'il a à faire

Ce qu'il verra, une fois le serveur à jour (et l'app rechargée) :

- **Espaces**, tuile « Hermes » : « 6 routines », et dessous ce qui cloche d'abord (« passerelle arrêtée », « en erreur : Prix suivis »)
  ou, quand tout va bien, la prochaine (« prochaine : Réveil, aujourd'hui à 18:15 »).
- **Hermes et ses routines** : sa carte (Passerelle « en marche », Garde du forfait « coupé jusqu'au 3 décembre », Dernier passage,
  Prochain, Sa dernière note, celle de Pilotage, datée) ; puis « Ses routines », six lignes : libellé, pastille « réel » ou
  « en double », moment, « Dernier passage : aujourd'hui à 07:42 · réussi » (ou « en erreur : limite du forfait », « jamais
  passée »), « Prochain passage : demain à 07:40 » (ou « en pause ») ; en haut du panneau « 6 · à jour à 14:02 ».
- **Équipe › Routines** : un panneau « Hermes » (en direct) avec les mêmes routines suivies comme une livraison (Programmée,
  Dernier passage, Prochain passage) ; les « Routines de JARVIS » restent telles quelles.
- **Si le résumé manque ou a plus de 30 minutes** : « Indisponible » sur la tuile, « Routines d'Hermes indisponibles : … » avec
  la raison sur la page et dans Équipe › Routines ; plus jamais l'ancienne ligne de Pilotage.
- **Santé du serveur** : une ligne « Routines d'Hermes » (nombre, dernière écriture, routine en erreur), sans notification.

De son côté : rien d'autre que le oui unique à la demande commune dans la session « Serveur JARVIS » (elle relance `install.sh`
d'Hermes : l'étape 4 de ma section écrit le premier résumé tout de suite). Ensuite, ouvrir JARVIS, Espaces, « Hermes » : les six
routines doivent y être en moins de 10 minutes. L'heure des prochains passages se compare à celle qu'il connaît (veille à 7 h 40,
réveil à 9 h 15, 13 h 15 et 18 h 15, prix suivis à 9 h, sorties le jeudi à 19 h, bilan et digest le lundi).

## 4. Bancs, avant et après

| Banc | Avant | Après |
|---|---|---|
| `bash essais/hermes/relance.test.sh` | 56 | 80, 0 échec |
| `sudo bash essais/hermes/banc.sh --neuf` | 84 | 88, 0 échec |
| `node jarvis-os/server/tests/server.test.mjs` | 385 | 398, 0 échec |
| `essais/jarvis-os-maquette/banc/banc.cjs` | 349 OK, 1 échec connu (agenda, date) | À COMPLÉTER |
| `bash essais/hermes/routines-conf.test.sh` | 6 lignes | 6 lignes, 0 erreur |
| `bash essais/hermes/garde.test.sh` | 25 | 25 |
| `fiab-b1` et `fiab-b3` (page et pont hors navigateur) | 13 et 24 | 13 et 24 |

Pas lancé : `banc-serveur.mjs` (laissé au coordinateur), les autres `fiab-*` (zone non touchée).

Précisions : `banc.sh --neuf` a été passé une fois (88, installation en 154 s) ; la seule retouche faite après ce passage est la
ligne de rangement `rm -rf /var/lib/hermes-relance-etat` à la fin du banc (aucune vérification changée, syntaxe contrôlée par
`bash -n`), pas relancé pour elle. `server.test.mjs` (398) et `relance.test.sh` (80) ont été passés sur le code tel qu'il est
commité. Les vérifications 0.92 de la maquette ont aussi été passées à part (les deux vérifications 0.86 adaptées et les sept
nouvelles : 10 sur 10 avec « aucune erreur de page »).

## 5. Ce qui n'a pas pu être testé, et les risques

- **Format réel de `jobs.json` (certain)** : relu dans le code d'Hermes au commit figé (`cron/jobs.py`, v0.23.3) et vérifié au banc
  d'Hermes avec un vrai `hermes cron create` et un vrai passage (statut `ok`, dates avec fuseau, routine en pause, `schedule.expr`).
  **Pas vu en vrai (probable)** : un `last_status = error` produit par la vraie limite du plugin ; la catégorie « limite du
  forfait » repose sur la même reconnaissance que la relance de la 0.89.0 (`est_limite`), les autres erreurs tombent dans
  « réseau » ou « erreur ».
- **Sous le vrai systemd (probable)** : `hermes-relance.service` a `ProtectSystem=full` (`/var` reste inscriptible, comme pour
  les avis de la 0.89.0) ; le dossier est créé par `install.sh` et recréé au besoin par le script. Non vérifiable au banc (pas
  de systemd) : c'est l'étape 4 et le contrôle 5 de la demande.
- **Groupe de JARVIS (probable)** : même montage que `/var/lib/hermes-relance-avis` (déjà en service). Si `id -gn jarvis` n'était
  pas `jarvis`, les droits attendus au contrôle 5 changeraient de nom, pas de principe.
- **Heure des horaires (probable)** : le « moment » est dit à l'heure de Paris, comme `routines.conf` ; au banc, Hermes a bien
  compté « 15 9 * * 1 » à 9 h 15 de Paris (08:15 UTC). Sur le serveur, à confirmer par la comparaison avec `routines.sh --liste`.
- **L'app reliée au vrai serveur (probable)** : la page est testée sur la maquette (données inventées) et la route à part
  (`server.test.mjs`) ; le bout en bout (`banc-serveur.mjs`) n'a pas été lancé ici. Rien n'a été vu sur un vrai iPhone.
- **Fraîcheur** : le résumé a jusqu'à 10 minutes (la minuterie). Un passage juste lancé peut donc encore être dit « prochain »
  pendant quelques minutes ; l'heure « à jour à … » est affichée pour ça.
- **Conteneur de banc** : `install.sh` crée `/var/lib/hermes-relance-etat` ; `banc.sh` le retire à la fin, sinon un serveur
  JARVIS lancé par un autre banc dans le même conteneur y verrait « un Hermes installé sans résumé » (une ligne de santé en plus).
- **Ligne de santé gardée** : comme les autres lignes, celle des routines reste dans son dernier état si Hermes est désinstallé
  (le veilleur ne retire pas une ligne dont le contrôle ne dit plus rien). Deviné sans gravité.
- **Conflits de fusion possibles** : `index.html` (mon bloc est inséré entre le bloc 0.86.0 et le bloc 0.87.0, pas en fin de
  script, pour ne pas toucher la même ligne que les autres chantiers), `server.mjs` (4 ajouts : import, constante après les avis
  de root, ligne de santé, route), `server.test.mjs` (une variable d'environnement et un bloc après « santé : retour à la
  normale »), `banc.cjs` (deux vérifications 0.86 adaptées, deux blocs avant la fin), `jarvis-os/hermes/limite.py` (ajouts
  seulement, plus `"relancer": cmd_minuterie` dans `main`).
