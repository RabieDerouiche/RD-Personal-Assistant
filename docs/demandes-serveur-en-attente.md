# Demandes au serveur en attente (28/11/2026, 6 h 30) : la skill du dépôt du CRA signé

À exécuter par la session « Serveur JARVIS 2 » (`session_01JvDfwzJbpLqSKJPKSk65Mq`). Un seul plan, un seul oui. `<COMMIT>` = le commit de main donné dans le message de la demande. Aucun secret ici ni dans la réponse : pas de nom de portail, pas d'adresse, pas d'hôte, pas de nom de personne, pas de montant, pas de nombre de jours.

Pourquoi : le premier dépôt réel du CRA signé (27/11) est resté à moitié fait (fichier joint, pas envoyé en validation) ; le propriétaire l'a refait lui-même. La skill est réécrite : le statut de la ligne fait foi, le dépôt se fait en deux temps. Ce plan pose la nouvelle skill, et met JARVIS à jour si ce n'est pas déjà fait (0.100.0 : l'accueil en orbite, app seulement).

## Plan

```text
LECTURES DE DÉPART (sans demander)
- git -C /opt/rd log --oneline -1 ; curl -s http://127.0.0.1:8787/api/health        (0.99.0, ou 0.100.0 s'il a déjà touché « Mettre à jour »)
- aucun passage du portail en cours : systemctl is-active hermes-portail-essai.service hermes-portail-cra-signe.service hermes-portail-cra.service → inactive
- où en sont ses gestes, sans contenu :
  sudo python3 -I -c "import json; D=json.load(open('/home/jarvis/.jarvis/jours.json')); g=D['mois'].get('2026-11',{}).get('suivi',{}).get('cra',{}); s=g.get('signe',{}); print('semaine :', D.get('semaines',{}).get('2026-11-23',{}).get('etat'), '| signé : rattaché =', bool(g.get('rattache')), ', par =', g.get('rattachePar'), ', PDF encore gardé =', bool(s.get('fichier')))"
  sudo tail -2 /var/lib/hermes-portail/cra/soumises.txt
  (si la semaine a été relancée : le résultat du passage, et si Hermes dit avoir choisi le code de temps dans la liste et relu sa valeur :
   journalctl -u hermes-portail-cra --since '-12 h' --no-pager -o cat | tail -15)

DÉPLOIEMENT (un seul oui)
1. sudo -u jarvis git -C /opt/rd pull --ff-only                    (attendu : <COMMIT>)
2. sudo systemctl restart jarvis                                    (version attendue : 0.100.0, sans erreur au démarrage)
2c. sudo bash /opt/rd/jarvis-os/hermes/portail/install.sh           (la skill ; pas pendant un passage du portail)

CONTRÔLES (lecture seule)
3. curl -s http://127.0.0.1:8787/api/health (0.100.0) ; journalctl -u jarvis --since "-5 min" --no-pager | grep -ciE "erreur|error" ; systemctl is-active jarvis hermes-gateway hermes-ordres.path hermes-portail-cra-signe.timer
4. La skill : sudo grep -c 'DEUX temps' /etc/hermes-portail/skills/portail/portail/SKILL.md → 1 ; sudo grep -c 'CRA signé du client' /etc/hermes-portail/skills/portail/portail/SKILL.md → 4
5. L'app répond, avec et sans l'accueil d'avant : curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:8787/' ; curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:8787/?accueil=ancien'   → le même code pour les deux

RETOUR ARRIÈRE
- sudo -u jarvis git -C /opt/rd checkout 710f1f0 && sudo systemctl restart jarvis && sudo bash /opt/rd/jarvis-os/hermes/portail/install.sh   (pour revenir ensuite : git checkout main)

CE QUE J'ATTENDS EN RETOUR (court, en tableau)
Commit et version avant/après ; ses gestes (semaine relancée ou non et son résultat ; CRA signé rattaché ou non) ; chaque étape : fait ou erreur mot pour mot ; les contrôles 3 à 5 ; l'heure de fin.
Ne relance rien à sa place, ne pose aucun oui, ne touche ni à jours.json ni aux registres de root.
```
