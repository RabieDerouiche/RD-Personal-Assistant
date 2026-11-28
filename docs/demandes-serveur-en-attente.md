# Demandes au serveur en attente (28/11/2026, midi) : la 0.102.0 (durcissements, écran de connexion, accueil)

À exécuter par la session « Serveur JARVIS 2 » (`session_01JvDfwzJbpLqSKJPKSk65Mq`). Un seul plan, un seul oui. `<COMMIT>` = le commit de main donné dans le message de la demande. Aucun secret ici ni dans la réponse : pas de nom de portail, pas d'adresse, pas d'hôte, pas de nom de personne, pas de montant, pas de nombre de jours, pas de valeur de variable.

Pourquoi : la passe générale du 28/11 (sa demande : « que tout soit blindé, sans perdre en usage ni en rapidité »). Le serveur de JARVIS change (garde-fou, CRA signé, MCP, en-têtes) et les kits root d'Hermes aussi (unités, coffre, consigne, routines) : il faut donc le pull, le redémarrage, les deux `install.sh` et `routines.sh`. Nouveauté de méthode : **root installe désormais les kits depuis son propre clone (`/root/rd`)**, plus depuis `/opt/rd` (qui appartient à `jarvis`, le service exposé à Internet).

## Plan

```text
LECTURES DE DÉPART (sans demander)
- git -C /opt/rd log --oneline -1 ; curl -s http://127.0.0.1:8787/api/health            (attendu : e5c5857, 0.101.0)
- aucun passage du portail en cours, aucune routine d'Hermes dans les 5 minutes :
  systemctl is-active hermes-portail-essai.service hermes-portail-cra-signe.service hermes-portail-cra.service   → inactive
  systemctl list-timers 'hermes*' --no-pager | head -14
- rien de posé là où Claude Code relit des consignes ou des réglages (attendu : AUCUNE ligne ; s'il y en a : ne supprime rien, donne
  les chemins et les dates, sans le contenu, et arrête-toi avant le déploiement) :
  sudo find /home/jarvis/.jarvis/work /home/jarvis/.jarvis/tache /home/jarvis/.jarvis/raccourci /home/jarvis/.jarvis/sample /home/jarvis/.jarvis/tour -maxdepth 3 \( -iname 'claude*.md' -o -name '.mcp.json' -o -iname 'agents.md' -o \( -name 'settings*.json' -path '*/.claude/*' \) \) -printf '%p %TY-%Tm-%Td %u\n' 2>/dev/null
- les dossiers des deux Hermes que root lisait (attendu : des noms simples node-… et npm-…, aucun lien) :
  sudo ls -la /home/hermes/.hermes/tools /home/hermes-portail/.hermes/tools 2>/dev/null | cut -c1-120
  for d in /home/hermes-portail/.hermes/vault /home/hermes/.hermes/cron /home/hermes-portail/.consigne; do sudo test -L "$d" && echo "LIEN : $d (arrête-toi)" || echo "pas un lien : $d"; done
- les modes, pauses et horaires réglés sur le serveur (pour vérifier après qu'ils n'ont pas bougé) :
  sudo cat /etc/hermes/routines.mode ; sudo cat /var/lib/hermes-relance/routines.pause /var/lib/hermes-relance/routines.horaire 2>/dev/null ; sudo bash /opt/rd/jarvis-os/hermes/routines.sh --liste
- une origine ouverte à d'autres sites est-elle fixée pour le service (un nombre, jamais la valeur) :
  sudo systemctl show jarvis -p Environment --value | tr ' ' '\n' | grep -c '^JARVIS_ORIGINS='
- l'origine du dépôt (https ou ssh ; sans l'afficher si elle porte un jeton : dis seulement « https », « ssh » ou « avec jeton ») :
  git -C /opt/rd remote get-url origin | sed -E 's#//[^@/]+@#//(jeton)@#'

DÉPLOIEMENT (un seul oui)
1. sudo -u jarvis git -C /opt/rd pull --ff-only                         (attendu : <COMMIT>)
2. sudo systemctl restart jarvis                                         (version attendue : 0.102.0, sans erreur au démarrage)
3. Le clone de root, une fois (dépôt public : en https, sans jeton ; si l'origine est en ssh, prends son adresse https) :
   sudo test -d /root/rd/.git || sudo git clone -q <adresse https du dépôt> /root/rd
   sudo chown -R root:root /root/rd && sudo chmod 700 /root/rd
   sudo git -C /root/rd fetch -q origin && sudo git -C /root/rd checkout -q <COMMIT> && sudo git -C /root/rd log --oneline -1      (le même commit que /opt/rd)
4. sudo bash /root/rd/jarvis-os/hermes/install.sh                        (kit d'Hermes : unité, réveil, garde, copies root ; sortie 0)
5. sudo bash /root/rd/jarvis-os/hermes/portail/install.sh                (kit du portail ; jamais pendant un passage : revérifie juste avant)
6. sudo bash /root/rd/jarvis-os/hermes/routines.sh                       (repose les trois routines du web sans « memory » ; modes, pauses et horaires du serveur gardés)

CONTRÔLES (lecture seule)
7. Santé : curl -s http://127.0.0.1:8787/api/health (0.102.0, avec le commit : la machine elle-même le voit) ;
   curl -s -H 'X-Forwarded-For: 203.0.113.7' http://127.0.0.1:8787/api/health        → ni « version » ni « commit »
   journalctl -u jarvis --since "-5 min" --no-pager | grep -ciE "erreur|error" ; systemctl is-active jarvis hermes-gateway hermes-ordres.path hermes-reveil.path hermes-relance.timer hermes-portail-cra-signe.timer
8. Pages : curl -sI http://127.0.0.1:8787/ | grep -iE 'content-security-policy|x-content-type-options|referrer-policy'    → les trois
9. Garde-fou : sudo -u jarvis grep -c 'WebFetch' /home/jarvis/.jarvis/guard-chat.json /home/jarvis/.jarvis/guard-mission.json 2>/dev/null
   (0 tant qu'aucune conversation n'a eu lieu depuis le redémarrage : le fichier est réécrit au premier Claude lancé ; dis ce que tu vois)
   sudo grep -c 'adresse-inconnue\|transcription-illisible' /home/jarvis/.jarvis/garde-refus.log 2>/dev/null        (absent ou 0 : normal)
10. Unités écrites par root : sudo grep -c '^Environment=.*PATH=' /etc/systemd/system/hermes-gateway.service /etc/systemd/system/hermes-portail-essai.service   → 1 et 1 ;
    sudo grep -cE '^(User=root|ExecStartPre=\+)' /etc/systemd/system/hermes-gateway.service /etc/systemd/system/hermes-portail-essai.service                  → 0 et 0 ;
    sudo systemd-analyze verify /etc/systemd/system/hermes-gateway.service /etc/systemd/system/hermes-portail-essai.service 2>&1 | tail -4
11. Routines : sudo bash /root/rd/jarvis-os/hermes/routines.sh --liste      (les mêmes routines, les mêmes états qu'au départ) ;
    sudo cat /etc/hermes/routines.mode                                     (inchangé) ;
    sudo -u hermes python3 -I -c "import json; J=json.load(open('/home/hermes/.hermes/cron/jobs.json'))['jobs']; print({j['name']: j.get('enabled_toolsets') for j in J if j.get('enabled_toolsets')})"
    → pour jarvis-digest-ia, jarvis-prix-suivis, jarvis-sorties-du-week-end : ['web', 'skills', 'jarvis-web'] (plus de « memory ») ; le fichier appartient toujours à hermes (stat -c '%U %a')
12. Portail : sudo hermes-portail etat | head -12                           (coffre, identifiants, Claude relié, relais : comme avant) ;
    sudo grep -c 'verrou_passage\|poser_consigne' /usr/local/sbin/hermes-portail      → 10 ou plus ;
    sudo stat -c '%U %a' /home/hermes-portail/.hermes/vault                 → hermes-portail 700
13. Skill du Digest : sudo grep -c 'digest_deja_dit' /etc/hermes/skills/jarvis/digest-ia/SKILL.md      → 3 ou plus
    (chemin des skills d'Hermes : celui qu'install.sh a posé ; dis-le s'il est ailleurs)
14. Un passage du portail en lecture seule, pour voir la consigne posée sous le nom de l'agent et le verrou (comme d'habitude, sans demander) :
    sudo hermes-portail essai <l'adresse d'essai habituelle>   → il se connecte et dit ce qu'il voit ; après : /home/hermes-portail/.consigne n'existe plus ;
    sudo ls -la /var/lib/hermes-portail/essais/.verrou-passage              (à root, créé par ce passage)

RETOUR ARRIÈRE
- sudo -u jarvis git -C /opt/rd checkout e5c5857 && sudo systemctl restart jarvis
  && sudo git -C /root/rd checkout -q e5c5857 && sudo bash /root/rd/jarvis-os/hermes/install.sh && sudo bash /root/rd/jarvis-os/hermes/portail/install.sh && sudo bash /root/rd/jarvis-os/hermes/routines.sh
  (pour revenir ensuite : git checkout main dans les deux clones)

CE QUE J'ATTENDS EN RETOUR (court, en tableau)
Commit et version avant/après ; les lectures de départ (surtout : le « find » des consignes, les liens, l'origine) ; chaque étape : fait ou erreur mot pour mot ;
les contrôles 7 à 14 ; ce qui a surpris ; l'heure de fin.
Ne relance aucune routine d'Hermes, ne pose aucun oui, ne touche ni à jours.json ni aux registres de root.
À partir de maintenant, pour toi aussi : les kits root se lancent depuis /root/rd (git fetch + checkout du commit demandé d'abord), jamais depuis /opt/rd.
```
