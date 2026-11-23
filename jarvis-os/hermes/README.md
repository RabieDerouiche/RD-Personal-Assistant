# Hermes Agent sur le serveur de JARVIS OS (essai)

Kit d'installation d'Hermes Agent (Nous Research) sur le VPS de JARVIS OS, décidé le 23/11/2026.
Pourquoi, décisions, garde-fous, mesures et étapes : `docs/hermes.md`. Banc : `essais/hermes/banc.sh`.

| Fichier | Rôle |
|---|---|
| `install.sh` | Installation et mise à jour, en root, relançable. Crée l'utilisateur `hermes` (sans shell, sans sudo), installe Hermes à la version figée (installeur officiel vérifié par empreinte, lancé en tant que `hermes`), Telegram, le plugin de l'abonnement Claude et un Claude Code à part ; pose la politique, le service et les règles réseau. Ne démarre pas Hermes. |
| `politique.yaml` | Copiée dans `/etc/hermes/config.yaml` (root) : ce qu'Hermes a le droit de faire. Hermes ne peut pas la changer. |
| `SOUL.md` | Sa façon de répondre (français, court, certitude), sans aucune donnée personnelle. |
| `hermes-gateway.service` | Le service, enfermé (score d'exposition systemd 1,4 au banc), sous JARVIS en priorité mémoire et processeur. |
| `hermes-sortie.service`, `sortie.nft` | Ce que l'utilisateur `hermes` peut joindre : Internet, oui ; JARVIS, Panier, Caddy, SSH, réseau privé, métadonnées du fournisseur, non. |
| `connexion-claude.sh` | Relie le Claude Code d'Hermes à l'abonnement (Termius : saisie). |
| `telegram.sh` | Jeton du bot (saisi sans affichage) et identifiant autorisé, puis démarrage (Termius : saisie). |
| `diagnostic.sh` | Lecture seule : mémoire, pics, ports, versions, garde-fous, verdict « VPS-1 suffisant ? ». Sortie sans secret. |
| `desinstaller.sh` | Retire Hermes (`--tout` : efface aussi ses données). |

Ordre : `diagnostic.sh` → `install.sh` → `connexion-claude.sh` → `telegram.sh`. Toutes : `sudo bash /opt/rd/jarvis-os/hermes/<script>`.
