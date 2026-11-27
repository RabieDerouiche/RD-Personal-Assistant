# Suite du chantier 0.92.0 (Hermes et ses routines en direct) : ce qui n'a pas pu être testé, risques

## 5. Ce qui n'a pas pu être testé, et les risques

- **Format réel de `jobs.json` (certain)** : relu dans le code d'Hermes au commit figé (`cron/jobs.py`, v0.23.3) et vérifié au banc
  d'Hermes avec un vrai `hermes cron create` et un vrai passage (statut `ok`, dates avec fuseau, routine en pause, `schedule.expr`).
  **Pas vu en vrai (probable)** : un `last_status = error` produit par la vraie limite du plugin ; la catégorie « limite du
  forfait » repose sur la même reconnaissance que la relance de la 0.89.0 (`est_limite`), les autres erreurs tombent dans
  « réseau » ou « erreur ».
- **Sous le vrai systemd (probable)** : `hermes-relance.service` a `ProtectSystem=full` (`/var` reste inscriptible, comme pour
  les avis de la 0.89.0) ; le dossier est créé par `install.sh` et recréé au besoin par le script. Non vérifiable au banc (pas
  de systemd) : c'est l'étape 4 et le contrôle 5 de la demande.
- **Groupe de JARVIS (probable)** : même montage que `/var/lib/hermes-relance-avis` (déjà en service). Si `id -gn jarvis` n'était
  pas `jarvis`, les droits attendus au contrôle 5 changeraient de nom, pas de principe.
- **Heure des horaires (probable)** : le « moment » est dit à l'heure de Paris, comme `routines.conf` ; au banc, Hermes a bien
  compté « 15 9 * * 1 » à 9 h 15 de Paris (08:15 UTC). Sur le serveur, à confirmer par la comparaison avec `routines.sh --liste`.
- **L'app reliée au vrai serveur (probable)** : la page est testée sur la maquette (données inventées) et la route à part
  (`server.test.mjs`) ; le bout en bout (`banc-serveur.mjs`) n'a pas été lancé ici. Rien n'a été vu sur un vrai iPhone.
- **Fraîcheur** : le résumé a jusqu'à 10 minutes (la minuterie). Un passage juste lancé peut donc encore être dit « prochain »
  pendant quelques minutes ; l'heure « à jour à … » est affichée pour ça.
- **Conteneur de banc** : `install.sh` crée `/var/lib/hermes-relance-etat` ; `banc.sh` le retire à la fin, sinon un serveur
  JARVIS lancé par un autre banc dans le même conteneur y verrait « un Hermes installé sans résumé » (une ligne de santé en plus).
- **Ligne de santé gardée** : comme les autres lignes, celle des routines reste dans son dernier état si Hermes est désinstallé
  (le veilleur ne retire pas une ligne dont le contrôle ne dit plus rien). Deviné sans gravité.
- **Conflits de fusion possibles** : `index.html` (mon bloc est inséré entre le bloc 0.86.0 et le bloc 0.87.0, pas en fin de
  script, pour ne pas toucher la même ligne que les autres chantiers), `server.mjs` (4 ajouts : import, constante après les avis
  de root, ligne de santé, route), `server.test.mjs` (une variable d'environnement et un bloc après « santé : retour à la
  normale »), `banc.cjs` (deux vérifications 0.86 adaptées, deux blocs avant la fin), `jarvis-os/hermes/limite.py` (ajouts
  seulement, plus `"relancer": cmd_minuterie` dans `main`).

