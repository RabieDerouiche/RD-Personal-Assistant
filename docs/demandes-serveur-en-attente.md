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
