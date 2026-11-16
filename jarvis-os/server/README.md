# Serveur JARVIS OS (phase 3)

Fait tourner Claude Code (`claude -p`, programme officiel) avec l'abonnement Claude du propriétaire, sur son propre serveur, pour lui seul. Aucune clé d'API : `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL` et les variables Bedrock / Vertex / Foundry sont retirées avant chaque appel (elles feraient payer l'API).

- `server.mjs` : Node 22, sans dépendance. API : `/api/health`, `/api/pair` (code à usage unique, 30 min), puis avec le jeton : `/api/status`, `/api/state`, `/api/chat` (flux SSE), `/api/missions/:id`, `/api/import`, `/api/memory`. Sert aussi l'app (`../web`).
- Discussion : Claude avec le web seulement (WebSearch, WebFetch), sans commande système ni écriture. Une demande pour un agent devient une mission « à approuver » (ligne `MISSIONS:` retirée de la réponse lue).
- Missions approuvées pour Claude : faites sur le serveur (web, lecture et écriture dans un dossier de travail par mission, sans commande système), compte rendu dans la mission. Bots Grok : phase 4.
- Données : `~/.jarvis/state.json` (droits 600 ; jetons stockés en empreinte SHA-256, jamais en clair).
- Installation : `install/setup.sh` (Ubuntu 26.04 ou 24.04 LTS : Node 22, Claude Code, service `jarvis`, Caddy en HTTPS sur `<ip>.sslip.io`, pare-feu). `install/cloud-config.yaml` le lance à la création du serveur.
- Bancs : `node tests/server.test.mjs` (faux Claude `tests/fake-claude.mjs`) ; de bout en bout avec l'app : `jarvis-os/app/tests/e2e-server.cjs`.

Guide pas à pas pour l'iPhone : `docs/jarvis-os.md`, section « Phase 3 ».
