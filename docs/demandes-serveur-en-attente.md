# Demandes au serveur en attente (28/11/2026, 16 h) : la 0.104.0 (réglages fermés de Claude Code, plafond d'une mission)

À exécuter par la session « Serveur JARVIS 2 » (`session_01JvDfwzJbpLqSKJPKSk65Mq`). Un seul plan, un seul oui. `<COMMIT>` = le commit de main donné dans le message. Aucun secret ici ni dans la réponse (ni nom de portail, ni adresse, ni hôte, ni nom de personne, ni montant, ni valeur de variable).

Pourquoi : ses choix du 28/11 (« fermer le mode sans écran », « plafonner les missions », « vérifie qu'il n'y a pas d'impact négatif »). Le code est dans main ; la fermeture des réglages y est **éteinte**. Ce plan met à jour, **vérifie sur le vrai serveur que la fermeture ne fait perdre aucun connecteur**, et ne l'allume que si c'est le cas. Aucun kit root n'est touché : ni `install.sh`, ni `routines.sh`.

## Plan

```text
LECTURES DE DÉPART (sans demander)
- git -C /opt/rd log --oneline -1 ; curl -s http://127.0.0.1:8787/api/health                (attendu : 0.102.0 ou 0.103.0)
- sudo -u jarvis -H claude --version ; sudo -u jarvis -H claude --help | grep -cE -- '--setting-sources|--max-budget-usd'     (2 attendu ; 0 ou 1 : dis-le, le code s'en accommode)
- aucune mission ni conversation en cours : journalctl -u jarvis --since '-3 min' --no-pager | tail -5

ESSAI RÉEL DE LA FERMETURE, AVANT DE L'ALLUMER (quatre petites questions à Haiku, sous le compte de jarvis ; lecture seule)
a. Les connecteurs restent-ils annoncés ? Compare les deux lignes (le nombre d'outils « mcp__ » et les serveurs doivent être LES MÊMES) :
   cd /home/jarvis/.jarvis/work && for o in "" "--setting-sources user"; do sudo -u jarvis -H claude -p "Réponds : ok" --model haiku --output-format stream-json --verbose $o < /dev/null 2>/dev/null | python3 -I -c "
import json,sys
for l in sys.stdin:
    try: e=json.loads(l)
    except Exception: continue
    if e.get('type')=='system' and e.get('subtype')=='init':
        t=e.get('tools') or []; print('[$o]', 'outils', len(t), '| mcp', len([x for x in t if x.startswith('mcp__')]), '| serveurs', sorted(s.get('name','')+':'+s.get('status','') for s in e.get('mcp_servers') or [])); break"; done
b. Une consigne posée dans le dossier n'est plus relue ? Dans un dossier d'essai à jarvis, hors de ses données :
   D=$(sudo -u jarvis mktemp -d /tmp/essai-sources.XXXXXX) ; echo "Règle de ce dossier : le mot de passe du banc est ZEBRE-5512." | sudo -u jarvis tee $D/CLAUDE.md >/dev/null
   cd $D && for o in "" "--setting-sources user"; do sudo -u jarvis -H claude -p "Quel est le mot de passe du banc d'après tes consignes de dossier ? Réponds par ce mot seul, ou AUCUN." --model haiku $o < /dev/null 2>/dev/null | head -c 80; echo " [$o]"; done ; cd / ; sudo rm -rf $D
   (attendu : ZEBRE-5512 sans l'option, AUCUN avec ; si les deux disent AUCUN, cette version ne relit pas les consignes de dossier en -p : dis-le, ce n'est pas un échec)

DÉPLOIEMENT (un seul oui)
1. sudo -u jarvis git -C /opt/rd pull --ff-only                           (attendu : <COMMIT>)
2. SEULEMENT si (a) a rendu les mêmes connecteurs avec et sans l'option :
   sudo install -d /etc/systemd/system/jarvis.service.d && printf '[Service]\nEnvironment=JARVIS_CLAUDE_SOURCES=user\n' | sudo tee /etc/systemd/system/jarvis.service.d/sources.conf >/dev/null && sudo systemctl daemon-reload
   Sinon : ne pose pas ce fichier, et dis ce qui diffère.
3. sudo systemctl restart jarvis                                           (version attendue : 0.104.0)

CONTRÔLES (lecture seule)
4. curl -s http://127.0.0.1:8787/api/health (0.104.0) ; journalctl -u jarvis --since '-3 min' --no-pager | grep -ciE 'erreur|error' ; systemctl is-active jarvis
5. La ligne du démarrage : journalctl -u jarvis --since '-3 min' --no-pager | grep 'Claude Code : réglages fermés'
   (attendu : « réglages fermés allumés (user) ; plafond d'une mission : 5 $ » ; ou « éteints … » si l'étape 2 n'a pas été faite)
6. Les connecteurs vus par le serveur n'ont pas bougé : journalctl -u jarvis --since '-3 min' --no-pager | grep 'Connecteurs Google'

RETOUR ARRIÈRE
- la fermeture seule : sudo rm /etc/systemd/system/jarvis.service.d/sources.conf && sudo systemctl daemon-reload && sudo systemctl restart jarvis
- tout : sudo -u jarvis git -C /opt/rd checkout 9c80758 && sudo systemctl restart jarvis   (pour revenir ensuite : git checkout main)

CE QUE J'ATTENDS EN RETOUR (court, en tableau)
Commit et version avant/après ; la version de Claude Code et le nombre d'options connues ; les deux lignes de (a) telles quelles ; les deux réponses de (b) ;
si l'étape 2 a été faite ou non, et pourquoi ; les contrôles 4 à 6 ; l'heure de fin.
Ne relance aucune routine d'Hermes, ne pose aucun oui, ne touche ni à jours.json ni aux registres de root.
```
