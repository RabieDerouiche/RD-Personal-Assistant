# Demandes au serveur en attente (28/11/2026, 0 h) : JARVIS 0.99.0

À exécuter par la session « Serveur JARVIS 2 » (`session_01JvDfwzJbpLqSKJPKSk65Mq`). Un seul plan, un seul oui. `<COMMIT>` = le commit de main donné dans le message de la demande. Aucun secret ici ni dans la réponse : pas de nom de portail, pas d'adresse, pas d'hôte, pas de nom de personne, pas de montant, pas de nombre de jours.

La 0.98.0 est déployée et vérifiée depuis le 27/11 à 22 h 52 (compte rendu : `docs/jarvis-os.md`). Ce plan apporte la 0.99.0 : Radar (un paiement « plus à payer » garde ses échéances déjà payées), la skill du dépôt du CRA signé (le bouton d'import vu à l'essai à blanc), le texte des comptes rendus plus jamais coupé au milieu d'un mot, les trois maquettes de refonte retirées, un essai d'affichage de « Pour moi » derrière `?pile=1`. Rien ne change côté Hermes (pas d'`install.sh` d'Hermes) : seulement JARVIS et le kit du portail.

## Plan

```text
LECTURES DE DÉPART (sans demander)
- git -C /opt/rd log --oneline -1 (attendu : 011b06c) ; systemctl is-active jarvis hermes-gateway ; curl -s http://127.0.0.1:8787/api/health
- aucun passage du portail en cours : systemctl is-active hermes-portail-essai.service hermes-portail-cra-signe.service hermes-portail-cra.service → inactive
- où en sont ses deux gestes, sans contenu :
  sudo python3 -I -c "import json; D=json.load(open('/home/jarvis/.jarvis/jours.json')); g=D['mois'].get('2026-11',{}).get('suivi',{}).get('cra',{}); s=g.get('signe',{}); print('semaine :', D.get('semaines',{}).get('2026-11-23',{}).get('etat'), '| signé : oui =', bool(s.get('oui')), ', retour =', (s.get('retour') or {}).get('etat'), ', réel =', (s.get('retour') or {}).get('reel'), ', rattaché =', bool(g.get('rattache')))"
  sudo tail -2 /var/lib/hermes-portail/cra/soumises.txt ; sudo tail -2 /var/lib/hermes-portail/cra-signe/deposes.txt 2>/dev/null
  (s'il a déjà touché « Relancer Hermes » ou « Oui, déposer » : dis le résultat de chaque passage, et pour un dépôt du CRA signé : ce que le
   formulaire d'import a demandé d'après /var/lib/hermes-portail/essais/*-cra-signe.txt, en mots à toi, et les refus du relais pendant le passage :
   journalctl -u hermes-portail-filtre --since '-3 h' --no-pager -o cat | grep -c refus — combien d'hôtes différents, lié ou non au portail, sans les nommer)

DÉPLOIEMENT (un seul oui)
1. sudo -u jarvis git -C /opt/rd pull --ff-only                    (attendu : <COMMIT>)
2. sudo systemctl restart jarvis                                    (version attendue : 0.99.0, sans erreur au démarrage)
2c. sudo bash /opt/rd/jarvis-os/hermes/portail/install.sh           (commande hermes-portail et skill ; pas pendant un passage du portail)

CONTRÔLES (lecture seule)
3. curl -s http://127.0.0.1:8787/api/health (0.99.0) ; journalctl -u jarvis --since "-5 min" --no-pager | grep -ciE "erreur|error" ; systemctl is-active jarvis hermes-gateway hermes-ordres.path hermes-portail-cra-signe.timer
4. Les maquettes retirées : for m in refonte-a refonte-b refonte-c ipad; do curl -s -o /dev/null -w "$m %{http_code}\n" http://127.0.0.1:8787/maquettes/$m/; done   → 404, 404, 404, et 200 pour ipad
5. La skill : sudo grep -c 'vu à blanc le 27/11/2026' /etc/hermes-portail/skills/portail/portail/SKILL.md → 1 ; sudo grep -c 'Ne te fie jamais au texte' /etc/hermes-portail/skills/portail/portail/SKILL.md → 1
6. Radar, sans montant : sudo -iu jarvis python3 -I -c "import json,os; R=json.load(open(os.path.expanduser('~/.jarvis/radar.json'))); print('retirés :', len(R.get('plansRetires') or []), '| jours notés :', len(R.get('plansRetiresLe') or {}))" ; stat -c '%a' /home/jarvis/.jarvis/radar.json → 600
7. L'app répond avec et sans l'essai : curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:8787/' ; curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:8787/?pile=1'   → 200 et 200 (ou le code habituel de la page d'accueil sans appareil relié, le même pour les deux)

RETOUR ARRIÈRE
- sudo -u jarvis git -C /opt/rd checkout 011b06c && sudo systemctl restart jarvis && sudo bash /opt/rd/jarvis-os/hermes/portail/install.sh   (pour revenir ensuite : git checkout main)

CE QUE J'ATTENDS EN RETOUR (court, en tableau)
Commit et version avant/après ; les lectures de départ (ses deux gestes : faits ou non, et leur résultat) ; chaque étape : fait ou erreur mot pour mot ; les contrôles 3 à 7 ; l'heure de fin ; ce qui a surpris.
Ne relance rien à sa place, ne pose aucun oui, ne touche ni à jours.json ni aux registres de root.
```
