# Hermes Agent sur le serveur de JARVIS OS (essai)

Kit d'installation d'Hermes Agent (Nous Research) sur le VPS de JARVIS OS, décidé le 23/11/2026.
Pourquoi, décisions, garde-fous, mesures et étapes : `docs/hermes.md`. Bancs : `essais/hermes/banc.sh` (tout), `essais/hermes/garde.test.sh` (le garde seul).

| Fichier | Rôle |
|---|---|
| `install.sh` | Installation et mise à jour, en root, relançable. Crée l'utilisateur `hermes` (sans shell, sans sudo), installe Hermes à la version figée (installeur officiel vérifié par empreinte, lancé en tant que `hermes`), Telegram, le plugin de l'abonnement Claude et un Claude Code à part ; pose la politique, le service et les règles réseau. Ne démarre pas Hermes. |
| `politique.yaml` | Copiée dans `/etc/hermes/config.yaml` (root) : ce qu'Hermes a le droit de faire. Hermes ne peut pas la changer. |
| `politique-jarvis.yaml` | Le serveur MCP de JARVIS (adresse et jeton pris dans l'environnement du service), ajouté à la politique seulement quand la liaison est posée. Liste fermée des outils de JARVIS qu'Hermes voit. |
| `relier-jarvis.sh` | Étape 3 (Termius : saisie). Demande le jeton « Exécutant » créé dans JARVIS (Réglages, « Assistants reliés (MCP) »), le vérifie depuis l'utilisateur `hermes`, pose `/etc/hermes/jarvis.env` (root, 0600) et relance `install.sh`. |
| `skills/` | Les skills du dépôt, copiées dans `/etc/hermes/skills` (root : Hermes les lit, ne les modifie pas) : `pilotage` (outils de JARVIS, règles de chaque passage, mode « en double »), une par routine (`veille-du-matin`, `semaine-a-venir`). |
| `routines.conf`, `routines.sh` | Étape 4 (sans saisie). La liste des routines d'Hermes, une par ligne, et le script qui les pose chez lui (`hermes cron`), recrée ce qui a changé et retire ce qui n'y est plus. `--liste` ne change rien. |
| `SOUL.md` | Sa consigne permanente : façon de répondre, ce qu'il fait seul ou après un oui, règles qui ne changent jamais. Sans aucune donnée personnelle. |
| `hermes-gateway.service` | Le service, enfermé (score d'exposition systemd 1,4 au banc), sous JARVIS en priorité mémoire et processeur. |
| `hermes-sortie.service`, `sortie.nft` | Ce que l'utilisateur `hermes` peut joindre : Internet, oui ; JARVIS, Panier, Caddy, SSH, réseau privé, métadonnées du fournisseur, non. |
| `garde-forfait.sh`, `hermes-garde.service`, `hermes-garde.timer` | Garde du forfait Claude partagé : toutes les 10 minutes, Hermes s'arrête au-delà de 85 % de la semaine (semaine, semaine Opus ; la fenêtre de 5 heures ne compte pas, sa demande du 23/11/2026), prévient sur Telegram et repart sous 75 %. Root en garde une copie (`/usr/local/sbin/hermes-garde-forfait`) : la minuterie n'exécute jamais un fichier du dépôt. |
| `connexion-claude.sh` | Relie le Claude Code d'Hermes à l'abonnement (Termius : saisie). |
| `telegram.sh` | Jeton du bot (saisi sans affichage) et identifiant autorisé, puis démarrage (Termius : saisie). |
| `diagnostic.sh` | Lecture seule : mémoire, pics, ports, versions, garde-fous, verdict « VPS-1 suffisant ? ». Sortie sans secret. |
| `desinstaller.sh` | Retire Hermes (`--tout` : efface aussi ses données). |

Ordre : `diagnostic.sh` → `install.sh` → `connexion-claude.sh` → `telegram.sh` → `relier-jarvis.sh` → `routines.sh`. Le déroulé (qui fait quoi entre JARVIS, Hermes, Grok Bot et Claude ; droits ; routines) : `docs/hermes-deroule.md`. Toutes : `sudo bash /opt/rd/jarvis-os/hermes/<script>`.
