# Demandes au serveur en attente

**Aucune (28/11/2026, 17 h).** La 0.104.0 est déployée (compte rendu : `docs/jarvis-os.md`, « Déploiement du 28/11/2026 (0.104.0) »). La 0.105.0 ne touche que l'app : il la prend par « Mettre à jour ».

À garder en tête pour la prochaine demande (session « Serveur JARVIS 2 », `session_01JvDfwzJbpLqSKJPKSk65Mq`) :

- un seul plan, un seul oui : lectures, modification, contrôles, retour arrière, ce qui est attendu en retour ; aucun secret (ni nom de portail, ni adresse, ni hôte, ni nom de personne, ni montant, ni valeur de variable) ;
- root lance les kits depuis `/root/rd` (mis au commit voulu juste avant), jamais depuis `/opt/rd` ;
- le dossier de l'Hermes du portail est `/home/hermes-portail/hermes/` (pas `.hermes`) ;
- `routines.sh` recrée les trois routines du web : leur « dernier passage » repart à « jamais passée » ;
- le dossier `jarvis.service.d/` contient `hardening.conf`, `pilotage.conf` et `sources.conf` : ne pas les écraser ;
- le fichier temporaire `/root/essai-14.out` attend son oui pour être supprimé.
