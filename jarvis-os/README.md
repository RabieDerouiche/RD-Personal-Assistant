# JARVIS OS

PWA vocale pour iPhone, sans frais d'API. Projet et décisions : `docs/jarvis-os.md`.

- `app/` : sources (Vite + TypeScript ; three.js retiré le 15/11/2026). `npm install`, puis `npm run build` écrit la version construite dans `web/`.
- `web/` : la version construite de l'ancienne PWA, servie par le serveur à `/ancienne/`. La nouvelle app, servie à la racine, est `essais/jarvis-os-maquette/`.
- Banc d'essai : `cd app && NODE_PATH=/opt/node-tools/node_modules node tests/e2e.cjs` (faux micro, fausse voix, écran d'iPhone ; `SHOTS=<dossier>` pour les captures).

Historique (phase 2, prototype du 15/11/2026) : tout tournait sur l'iPhone, rien n'était relié. Chaque agent, service ou automatisation non relié l'affichait. Depuis la phase 3, le serveur (`server/`) relie l'app.
