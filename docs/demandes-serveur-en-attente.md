# Demandes au serveur en attente

Aucune (28/11/2026, 14 h 30). La dernière, la 0.102.0 (`9c80758`), est passée le 28/11 : compte rendu dans `docs/jarvis-os.md`, « Déploiement du 28/11/2026 (0.102.0) ».

Rappels pour la prochaine :
- un seul plan, un seul oui, dans un seul message à « Serveur JARVIS 2 » (`session_01JvDfwzJbpLqSKJPKSk65Mq`) ; aucun secret, ni nom de portail, ni adresse, ni hôte, ni nom de personne, ni montant ;
- **les kits root se lancent depuis `/root/rd`** (`git -C /root/rd fetch && git -C /root/rd checkout <commit>` d'abord), jamais depuis `/opt/rd` ;
- **le dossier de l'Hermes du portail est `/home/hermes-portail/hermes/`** (pas `.hermes`) : coffre `hermes/vault`, outils `hermes/tools` ; celui de l'Hermes principal est `/home/hermes/.hermes/` ;
- un plan qui touche à `routines.conf` recrée les routines changées : leur « dernier passage » repart de « jamais passée » chez Hermes (les modes, pauses et horaires du serveur sont gardés).
