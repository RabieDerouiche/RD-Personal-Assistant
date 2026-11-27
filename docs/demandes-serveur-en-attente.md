# Demandes au serveur en attente (27/11/2026) : JARVIS 0.95.0

À exécuter par la session « Serveur JARVIS 2 » (`session_01JvDfwzJbpLqSKJPKSk65Mq`). Un seul plan, un seul oui. `<COMMIT>` = le commit de main donné dans le message de la demande. Aucun secret ici ni dans la réponse ; ne recopie aucun nom de fichier du dossier `depot/`, aucun montant, et n'affiche pas le contenu de `radar.json`.

## Plan

```text
LECTURES DE DÉPART (sans demander)
- git -C /opt/rd log --oneline -1 ; systemctl is-active jarvis hermes-gateway ; curl -s http://127.0.0.1:8787/api/health
- les lectures de la section « Rangement des papiers » ci-dessous (Caddy, place libre, copie de nuit)
- ls -l /root/serveur/CLAUDE.md ; grep -c 'Règle du propriétaire' /root/serveur/CLAUDE.md   (avant : 0)

DÉPLOIEMENT (un seul oui)
1. sudo -u jarvis git -C /opt/rd pull --ff-only          (attendu : <COMMIT>)
2. sudo systemctl restart jarvis                          (version attendue : 0.95.0, sans erreur au démarrage)
3. Sa règle du 25/11/2026 pour la session du serveur, écrite une fois pour toutes dans le fichier que chaque session neuve relit
   (copie de l'ancien fichier gardée) :
   sudo cp -p /root/serveur/CLAUDE.md /root/serveur/CLAUDE.md.avant-regle && sudo tee -a /root/serveur/CLAUDE.md >/dev/null <<'REGLE'

## Règle du propriétaire pour cette session (25/11/2026, recopiée le 27/11/2026)
- Lecture seule : sans demander (un passage « hermes-portail essai » en lecture seule compris).
- Une modification : une seule question pour tout le plan, retour arrière compris.
- Redemander pour : un secret, une suppression, un nouvel hôte ouvert, un redémarrage hors plan, ou ce qui sort du plan.
- Une demande de la session de développement arrive en un seul plan ; le compte rendu est court, sans secret, sans contenu de mail, sans montant.
- Si un défaut est trouvé hors du plan : le dire et proposer la correction, ne pas la faire sans son oui.
REGLE

CONTRÔLES (lecture seule)
4. Section « Rangement des papiers », ses étapes 3 à 5 (santé et version, 401, 401, 303, journal).
5. Section « Radar », ses contrôles (droits 600, clé historique sans montant à l'écran, journal sans erreur du Radar), lancés sous
   l'utilisateur jarvis (sudo -iu jarvis …).
6. journalctl -u jarvis --since "-10 min" --no-pager | grep -ciE "erreur|error" (et les lignes, s'il y en a) ; systemctl is-active jarvis hermes-gateway
7. Suivi de la 0.94.0, sans contenu : journalctl -u jarvis --since "2026-11-27 07:20" --no-pager | grep -ciE "suivi des réponses|réveil d.Hermes impossible"   (attendu : 0)

RETOUR ARRIÈRE
- Le code : sudo -u jarvis git -C /opt/rd checkout 0007ecd && sudo systemctl restart jarvis   (pour revenir ensuite : git checkout main)
- La règle : sudo cp -p /root/serveur/CLAUDE.md.avant-regle /root/serveur/CLAUDE.md
- Les fichiers en attente du dépôt et radar.json : rien à défaire (voir les deux sections).

CE QUE J'ATTENDS EN RETOUR (court, en tableau)
Commit et version avant/après ; les lectures de Caddy, la place libre, si la copie de nuit prend depot/ ; chaque étape : fait ou erreur
mot pour mot ; les codes de l'étape 4 ; les sorties de l'étape 5 (le mois suivi et la liste des mois, jamais un montant) ; les comptes
des étapes 6 et 7 ; l'heure de fin.
```

## Section « Rangement des papiers » (0.91.0)

Rien à faire sur le serveur au-delà de `git pull` et du redémarrage de jarvis : le dossier `depot/` et `depot.json` sont créés par le serveur au premier dépôt, **sous son dossier de données** (`/home/jarvis/.jarvis`, déjà permis en écriture par le durcissement du service : aucun dossier nouveau à autoriser) ; aucune variable, aucune unité, aucun hôte nouveau (Drive passe par l'accès Google déjà en place). Section à fondre dans la demande commune, pour les contrôles en lecture seule :

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

## Section « Radar » (0.93.0)

Rien d'autre que `git pull` et le redémarrage du service. Pas de migration à lancer : au premier calcul, `radar.json` reçoit seul la clé
`historique` (`{mois: {}, suivi: "AAAA-MM"}`) ; toutes les autres clés sont relues telles quelles (vérifié au banc : dépenses fixes, dépenses
courantes et leurs notes, paie, budgets retenus, paiements en plusieurs fois, refus, alertes vues). Aucun hôte, aucune variable, aucun droit
nouveau.

Contrôles en lecture seule (aucun n'affiche un montant : ne pas faire afficher le contenu de `radar.json` dans la session du serveur) :

- droits du fichier : `stat -c '%a' ~/.jarvis/radar.json` → `600` ;
- l'historique est en place, sans montant à l'écran :
  `python3 -c "import json,os;h=json.load(open(os.path.expanduser('~/.jarvis/radar.json'))).get('historique') or {};print(h.get('suivi'), sorted((h.get('mois') or {}).keys()))"`
  → le mois en cours, puis la liste des mois gardés (vide jusqu'au 1er décembre, ou les mois d'avant dont le budget avait été retenu) ;
  (le chemin du dossier de données est celui de `JARVIS_DATA` s'il est défini) ;
- journal du service depuis le redémarrage : aucune ligne « radar : radar.json illisible », « radar.json non enregistré » ni « tic impossible » ;
- le 1er décembre après minuit (heure de Paris) : la même commande montre `2026-11` dans les mois gardés, et aucune notification n'est partie pour cela.

Retour arrière : revenir au commit d'avant et redémarrer. Le serveur d'avant ignore la clé `historique` (il la garde dans le fichier sans
la lire) et reprend ses « six mois » ; rien à défaire dans `radar.json`. L'app d'avant ne lit ni `mois.depense` ni `mois.historique`.
Dans l'autre sens, l'app 0.93.0 devant un serveur d'avant garde « Six derniers mois » et ne montre pas « Déjà dépensé ».
