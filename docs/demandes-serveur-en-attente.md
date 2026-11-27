# Demandes au serveur en attente (27/11/2026, soir) : JARVIS 0.98.0 — CRA signé déposé par Hermes, contrôle du PDF, CRA de la semaine

À exécuter par la session « Serveur JARVIS 2 » (`session_01JvDfwzJbpLqSKJPKSk65Mq`). Un seul plan, un seul oui. `<COMMIT>` = le commit de main donné dans le message de la demande. Aucun secret ici ni dans la réponse : pas de nom de portail, pas d'adresse, pas d'hôte, pas de nom de personne, pas de nom de fichier venu d'un mail, pas de contenu de `jours.json`.

La 0.95.0 et la 0.96.0 sont déployées et vérifiées depuis le 27/11 à 16 h 45 (compte rendu : `docs/jarvis-os.md`). Ce plan apporte la 0.97.0 (CRA signé déposé par Hermes après son oui), la 0.98.0 (le PDF comparé à la saisie, dépôt sans attendre s'il correspond, après un premier dépôt réussi) et la correction de la skill pour le CRA de la semaine (le code de temps choisi dans la liste : cause trouvée par le passage en lecture seule du 27/11 au soir).

## Plan

```text
LECTURES DE DÉPART (sans demander)
- git -C /opt/rd log --oneline -1 (attendu : 6722569) ; systemctl is-active jarvis hermes-gateway ; curl -s http://127.0.0.1:8787/api/health
- les lectures 1 à 5 de la section « CRA signé » ci-dessous
- aucune routine d'Hermes dans les 5 minutes avant l'étape 2b, aucun passage du portail en cours (systemctl is-active hermes-portail-essai.service → inactive)

DÉPLOIEMENT (un seul oui)
0. sudo rm -f /root/consigne-lecture.* /root/lecture-cra.out       (les deux fichiers temporaires du passage en lecture seule du 27/11 ; l'un contient l'adresse)
1. sudo -u jarvis git -C /opt/rd pull --ff-only                    (attendu : <COMMIT>)
2. sudo systemctl restart jarvis                                    (version attendue : 0.98.0, sans erreur au démarrage)
2b. sudo bash /opt/rd/jarvis-os/hermes/install.sh                   (limite.py : une unité de plus dans la liste fermée des relances)
2c. sudo bash /opt/rd/jarvis-os/hermes/portail/install.sh           (commande hermes-portail, skill corrigée, hermes-portail-cra-signe.service et .timer, activés)

CONTRÔLES (lecture seule) : les contrôles 1 à 4 de la section « CRA signé », puis
5. journalctl -u jarvis --since "-10 min" --no-pager | grep -ciE "erreur|error" (et les lignes, s'il y en a) ; systemctl is-active jarvis hermes-gateway hermes-ordres.path
6. 0.98.0, le PDF comparé à la saisie (dans les 6 minutes après le redémarrage ; un nombre et un mot, jamais un nom) :
   sudo python3 -I -c "import json; D=json.load(open('/home/jarvis/.jarvis/jours.json')); c=D['mois'].get('2026-11',{}).get('suivi',{}).get('cra',{}).get('signe',{}).get('controle',{}); print(c.get('etat'), c.get('total'), c.get('attendu'), c.get('detail'), '| premier dépôt déjà fait :', bool(D.get('signePremier')))"
   → attendu : « conforme N N True | premier dépôt déjà fait : False » (le même nombre deux fois ; vérifié à la main sur le vrai PDF, hors dépôt). Dans ta réponse : seulement le mot, si les deux nombres sont égaux, et les deux booléens.
7. La skill corrigée du CRA de la semaine : sudo grep -c 'Ne te fie jamais au texte' /etc/hermes-portail/skills/portail/portail/SKILL.md → 1
   L'état de la semaine, sans contenu : sudo python3 -I -c "import json; s=json.load(open('/home/jarvis/.jarvis/jours.json')).get('semaines',{}).get('2026-11-23',{}); print(s.get('etat'))"   → a_la_main (il touchera « Relancer Hermes » dans JARVIS ; NE PAS relancer à sa place, ne pas toucher à tentees.txt)
8. « L'ESSAI À BLANC RÉEL POUR NOVEMBRE 2026 » de la section : il part seul ; relevés a à g.
9. S'il a touché « Relancer Hermes » pendant que tu es là (sinon ne l'attends pas) : journalctl -u hermes-portail-cra --since '-20 min' --no-pager -o cat | tail -15 ; sudo tail -2 /var/lib/hermes-portail/cra/soumises.txt → le résultat (« soumise » attendu), et si Hermes dit avoir choisi le code dans la liste et relu sa valeur.

RETOUR ARRIÈRE
- sudo systemctl disable --now hermes-portail-cra-signe.timer
- sudo -u jarvis git -C /opt/rd checkout 6722569 && sudo systemctl restart jarvis && sudo bash /opt/rd/jarvis-os/hermes/install.sh && sudo bash /opt/rd/jarvis-os/hermes/portail/install.sh   (pour revenir ensuite : git checkout main)
- voir aussi le retour arrière de la section.

CE QUE J'ATTENDS EN RETOUR (court, en tableau)
Commit et version avant/après ; chaque étape : fait ou erreur mot pour mot ; les lectures et contrôles de la section (des nombres, des oui/non) ; les lignes des contrôles 6 et 7 ;
l'essai à blanc : a à g ; le contrôle 9 s'il a eu lieu ; la durée du passage ; l'heure de fin ; ce qui a surpris.
```

## Section « CRA signé » (0.97.0 et 0.98.0)

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
