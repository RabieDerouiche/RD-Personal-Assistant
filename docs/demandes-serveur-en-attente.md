# Demandes au serveur en attente (26/11/2026)

Sections prêtes, testées au banc, à fondre dans UNE demande commune à la session « Serveur JARVIS » (méthode : `docs/jarvis-os-reprise.md`). `<COMMIT>` = le commit de main qui contient la fusion. Aucun secret ; jamais d'adresse ni de nom de portail ici.

Code correspondant : branche `claude/practical-wright-8mlt6z` (commit 9244ec5 et suivants), pas encore dans main ni déployé.

## 1. CRA du mois seul (hermes-portail cra-mois-auto)

```text
SECTION « CRA DU MOIS SEUL » (à fondre dans la prochaine demande commune ; <COMMIT> = le commit de main qui contient la fusion ;
son QCM du 26/11/2026 : « CRA du mois seul »). Le serveur de JARVIS ne change pas (pas de redémarrage de jarvis ni d'Hermes).
Aucun secret dans cette section ni dans ta réponse. Ne recopie jamais l'adresse du compte rendu d'activité (dis <adresse>).

LECTURES (sans demander)
- git -C /opt/rd log --oneline -1 ; systemctl is-active hermes-portail-cra.timer
- sudo grep -c '^adresse=.' /etc/hermes-portail/cra.conf ; sudo grep -c '^adresse_mois=' /etc/hermes-portail/cra.conf ; sudo stat -c '%U %a' /etc/hermes-portail/cra.conf
  (attendus : 1, 0, root 600)
- sudo cut -d' ' -f1,4 /var/lib/hermes-portail/cra/mois-valides.txt   (attendu : « 2026-11 validee » ; le mois et le résultat seulement)
- sudo ls -l /var/lib/hermes-portail-retours/mois-2026-11.json
GARDE-FOU : si mois-valides.txt n'a pas la ligne de 2026-11, ARRÊTE-TOI ICI et dis-le (sinon la minuterie retenterait novembre).

DÉPLOIEMENT (un seul oui)
1. sudo -u jarvis git -C /opt/rd pull --ff-only   (attendu : <COMMIT> ; sauter si la demande commune l'a déjà fait)
2. L'adresse du compte rendu d'activité, celle que tu as donnée toi-même à « hermes-portail cra-mois » le 26/11 (ta commande de ce jour-là),
   ajoutée à cra.conf, root 600, sans l'afficher :
   sudo sh -c 'umask 077; printf "adresse_mois=%s\n" "<adresse>" >> /etc/hermes-portail/cra.conf'
3. sudo bash /opt/rd/jarvis-os/hermes/portail/install.sh
   (pose hermes-portail-cra-mois.service et .timer, active la minuterie de 15 minutes, recopie limite.py dans la bibliothèque du portail)
4. La relance après la limite doit connaître la nouvelle unité (copie root, comme install.sh d'Hermes, sans relancer Hermes) :
   sudo install -o root -g root -m 0644 /opt/rd/jarvis-os/hermes/limite.py /usr/local/lib/hermes-relance/limite.py

CONTRÔLES
5. systemctl is-enabled hermes-portail-cra-mois.timer (→ enabled) ; systemctl list-timers hermes-portail-cra-mois.timer --no-pager (prochain passage)
6. sudo grep -c '^adresse_mois=.' /etc/hermes-portail/cra.conf (→ 1) ; sudo stat -c '%U %a' /etc/hermes-portail/cra.conf (→ root 600)
7. À la main, aujourd'hui : sudo hermes-portail cra-mois-auto ; echo "code $?"
   Attendu, mot pour mot : « CRA du mois : rien à faire (novembre 2026 : déjà validé par Hermes.) » et code 0 (octobre n'est pas regardé après le 10).
   Rien n'est lancé sur le portail.
8. Par la minuterie : sudo systemctl start hermes-portail-cra-mois.service ; systemctl show -p Result hermes-portail-cra-mois.service (→ success) ;
   journalctl -u hermes-portail-cra-mois -n 5 --no-pager -o cat   (rien : la minuterie se tait quand il n'y a rien à faire)
9. grep -c 'hermes-portail-cra-mois.service' /usr/local/lib/hermes-relance/limite.py /usr/local/lib/hermes-portail/limite.py (→ 1 et 1) ;
   sudo hermes-relance --a-blanc (→ « Rien à relancer. »)

CE QUI SE PASSERA ENSUITE (pour le dire, rien à faire)
- Le 24/12 à midi, JARVIS lui présente ses jours de décembre ; son oui dans JARVIS ; le 26/12 ou après, au plus 15 minutes plus tard,
  Hermes complète et valide le CRA de décembre, puis un avis arrive sur ses appareils (« Première exécution d'Hermes : CRA de décembre 2026
  validé » : il le vérifie sur le portail). Le dépôt du CRA du client (le PDF de son contact) reste à sa charge.

RETOUR ARRIÈRE
- La minuterie seule : sudo systemctl disable --now hermes-portail-cra-mois.timer   (rien d'autre ne change)
- L'adresse : sudo sed -i '/^adresse_mois=/d' /etc/hermes-portail/cra.conf
- Le code : sudo -u jarvis git -C /opt/rd checkout <commit d'avant> && sudo bash /opt/rd/jarvis-os/hermes/portail/install.sh
  && sudo install -o root -g root -m 0644 /opt/rd/jarvis-os/hermes/limite.py /usr/local/lib/hermes-relance/limite.py ;
  puis sudo systemctl disable --now hermes-portail-cra-mois.timer ; sudo rm -f /etc/systemd/system/hermes-portail-cra-mois.* ; sudo systemctl daemon-reload

CE QUE J'ATTENDS EN RETOUR
Commit déployé ; les lectures (comptes de cra.conf, la ligne « 2026-11 validee », le compte rendu de novembre) ; la ligne « CRA du mois : … »
de la sortie d'install.sh ; is-enabled et prochain passage ; la sortie de l'étape 7 mot pour mot et son code ; le Result de l'étape 8 ;
les deux comptes de l'étape 9 et la sortie de hermes-relance --a-blanc ; toute erreur mot pour mot (sans l'adresse).
```

## 2. Première exécution réelle suivie par JARVIS (outil routine_fin)

```text
SECTION « PREMIÈRE EXÉCUTION RÉELLE SUIVIE PAR JARVIS » (skills et outil ; à fondre dans la demande commune ; <COMMIT> = le commit
de main qui contient la fusion). Constat de ta lecture du 26/11 : les 6 routines ont notifié, deux sans le préfixe, une seule
clé « en réel : … » dans la mémoire d'Hermes. Désormais JARVIS signale lui-même la première exécution réelle (outil routine_fin).
Aucun secret dans cette section ni dans ta réponse.

LECTURES (sans demander)
- git -C /opt/rd log --oneline -1 ; systemctl is-active jarvis hermes-gateway
- sudo grep -c 'routine_fin' /etc/hermes/config.yaml   (avant : 0)

DÉPLOIEMENT (dans le même oui que la demande commune)
1. Code : sudo -u jarvis git -C /opt/rd pull --ff-only (attendu : <COMMIT>), puis sudo systemctl restart jarvis
   (sauter si la demande commune l'a déjà fait).
2. Hermes : sudo bash /opt/rd/jarvis-os/hermes/install.sh   (recopie les 7 skills et la politique : routine_fin ajouté aux
   serveurs « jarvis » et « jarvis-web » ; relance Hermes comme d'habitude ; le garde reste coupé jusqu'au 2026-12-03).
   NE PAS toucher à la mémoire d'Hermes : la clé « en réel : veille-du-matin » qui y reste n'est plus lue.
   Rien n'est marqué « déjà signalé » : les notifications du 26/11 étaient parties vers un ancien abonnement de son téléphone ;
   chaque routine lui enverra donc une fois « Première exécution réelle » sur le nouvel abonnement, à son prochain passage réel.

CONTRÔLES
3. La politique :
   sudo sed -n '/^  jarvis:/,/resources:/p' /etc/hermes/config.yaml | grep -c '^        - '       (→ 22)
   sudo sed -n '/^  jarvis-web:/,/resources:/p' /etc/hermes/config.yaml | grep -c '^        - '   (→ 9)
   sudo grep -c 'routine_fin' /etc/hermes/config.yaml                                             (→ 2)
4. L'outil vu par les deux jetons d'Hermes (noms seulement) :
   sudo bash -c '. /etc/hermes/jarvis.env; for t in "$JARVIS_MCP_TOKEN" "$JARVIS_MCP_TOKEN_WEB"; do curl -s "$JARVIS_MCP_URL" -H "authorization: Bearer $t" -H "content-type: application/json" -H "accept: application/json, text/event-stream" -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{}}" | grep -o "\"name\":\"routine_fin\"" | head -1; done'
   → deux lignes « "name":"routine_fin" ».
5. Les skills recopiées (le dossier des skills d'Hermes, celui qu'install.sh remplit) :
   sudo grep -rl 'routine_fin' <dossier des skills>/jarvis/*/SKILL.md | wc -l      (→ 7)
   sudo grep -rl 'pas de clé « en réel' <dossier des skills>/jarvis/ | wc -l       (→ 0)
6. Aucun passage forcé : la prochaine exécution réelle de chaque routine (veille-du-matin et prix-suivis demain matin, reveil au
   prochain courrier ou à 9 h 15) appellera routine_fin ; JARVIS enverra la notification la première fois seulement.

RETOUR ARRIÈRE
- sudo -u jarvis git -C /opt/rd checkout <commit d'avant> && sudo systemctl restart jarvis && sudo bash /opt/rd/jarvis-os/hermes/install.sh
  (les skills et la politique d'avant reviennent ; la liste des routines signalées reste dans l'état de JARVIS, sans effet).

CE QUE J'ATTENDS EN RETOUR
Commit déployé ; les comptes des étapes 3 et 5 ; les deux lignes de l'étape 4 ; toute erreur mot pour mot.
```

## 3. Hermes et ses routines en direct (0.92.0)

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

## 4. Les réponses aux mails du mois (0.94.0)

**Rien d'autre que la mise à jour habituelle** (fusion dans `main`, « Nouvelle version disponible » dans l'app, ou `git pull` + redémarrage du
service) : aucun fichier de configuration, aucune variable, aucun droit Google nouveau (lecture de Gmail déjà accordée ; rien n'est
écrit dans Gmail). `travail.json` et `jours.json` gardent leur forme ; `jours.json` gagne des champs (`suivi`, `objet` et `envoye` sur
`mailCra` et `mailProlong`), lus sans migration.

**Le rattrapage des deux réponses du 26/11, garanti par construction** :
- le suivi ne dépend d'aucun état d'avant : au premier tic après le redémarrage (dans la minute ; `dernierSuivi` vaut 0 en mémoire, donc
  pas d'attente de 5 minutes), le mois en cours est suivi si `mailCra` existe **ou** si on est le 24 ou après (mail du CRA), et si
  `mailProlong` existe **ou** si le compte rendu du mois lit une fin de mission dans le mois (mail de prolongation) ; les deux conditions
  sont vraies sur son serveur depuis le 26/11 ;
- l'objet cherché est refait depuis le modèle de `travail.json` quand `mailCra.objet` n'existe pas (mails préparés avant la 0.94.0) ;
- toute réponse plus récente que l'envoi et pas encore dans `suivi.*.reponses` est notée puis notifiée, quel que soit son âge : les deux
  réponses déjà arrivées le sont donc au premier passage, une fois chacune ; déployé en décembre, le mois de novembre est encore suivi
  (45 jours après l'envoi) ;
- vérifié au banc (`jours.test.mjs`, « rattrapage : mails envoyés à la main … et réponses déjà là : détectées et notifiées une fois dès
  le premier passage », et « redémarrage … sans rien renotifier »).
Seule condition extérieure : que la recherche Gmail `subject:"<objet>"` rende bien les deux fils (voir § 6).

**Contrôles en lecture seule sur le serveur** (aucun nom, aucune adresse : des comptes et des dates), à joindre à une seule demande :

```
node -e '
const j = JSON.parse(require("fs").readFileSync(process.env.HOME + "/.jarvis/jours.json", "utf8"));
const ym = new Date().toISOString().slice(0, 7), x = j.mois[ym] || {}, s = x.suivi || {};
const d = (t) => (t ? new Date(t).toISOString().slice(0, 16) : "-");
for (const k of ["cra", "prolongation"]) { const v = s[k] || {}, r = v.reponses || [];
  console.log(k, "| envoi", d(v.envoi && v.envoi.at), "| réponses", r.length, "| avec PDF", r.filter((y) => y.pdf).length,
    "| non lues", r.filter((y) => !y.lu).length, "| notifiées", r.filter((y) => y.notifie).length, "| dernière", d(r.length && r[r.length - 1].at),
    "| lu", d(v.lu), "| clos", v.clos || "-", "| rattaché", d(v.rattache), "| erreur", v.erreur ? "oui" : "non"); }
console.log("historique :", (x.historique || []).filter((h) => /CRA signé|réponse au mail|envoyé le/.test(h.quoi)).length, "lignes de suivi");'
journalctl -u jarvis --since "-30 min" --no-pager | grep -c "suivi des réponses"
```

Attendu pour novembre 2026, quelques minutes après le redémarrage : `cra` : un envoi daté du jour de l'envoi (pas de l'heure de la
réponse), 1 réponse au moins, 1 avec PDF, `clos pdf` ; `prolongation` : un envoi, 1 réponse au moins, 0 avec PDF, `clos -` ; `notifiées`
égal à `réponses` ; `erreur non` ; la seconde commande rend 0 (aucune erreur de suivi au journal). Dans l'app : deux notifications
reçues, et la carte « CRA du mois ». Le Journal de Pilotage (`jarvis_pilotage_lire`, onglet Journal) porte deux lignes de Bot « JARVIS ».

**Retour arrière** : revenir au commit d'avant et redémarrer. Les champs ajoutés à `jours.json` sont ignorés par l'ancien code (rien à
nettoyer) ; seul effet : la carte de Travail retombe sur l'ancienne recherche (étape « CRA du client reçu » de nouveau fausse pour une
réponse dans le même fil). Les lignes déjà écrites dans le Journal de Pilotage restent (inoffensives). Couper le suivi sans revenir en
arrière n'a pas de réglage dédié : il s'arrête de lui-même (CRA reçu en PDF, ou 45 jours).
