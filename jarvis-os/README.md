# JARVIS OS

PWA vocale pour iPhone, sans frais d'API. Projet et décisions : `docs/jarvis-os.md`.

- `app/` : sources (Vite + TypeScript + three.js). `npm install`, puis `npm run build` écrit la version construite dans `web/`.
- `web/` : la version construite, servie telle quelle (GitHub Pages).
- Banc d'essai : `cd app && NODE_PATH=/opt/node-tools/node_modules node tests/e2e.cjs` (faux micro, fausse voix, écran d'iPhone ; `SHOTS=<dossier>` pour les captures).

Phase 2 (prototype) : tout tourne sur l'iPhone, rien n'est relié. Chaque agent, service ou automatisation non relié l'affiche.
