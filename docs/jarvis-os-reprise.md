# JARVIS OS — document de reprise

But : qu'une autre session Claude (l'autre compte du propriétaire, ou une session neuve) reprenne JARVIS OS sans rien perdre. À lire avec `CLAUDE.md` (règles permanentes), `docs/jarvis-os-refonte.md` (demandes et décisions, au fil de l'eau), `docs/jarvis-os.md` (journal des versions), `docs/jarvis-os-parite.md` (parité avec la page Jarvis). Tout le code est dans ce dépôt (branche `main`). **Les détails privés** (adresse exacte du serveur, nom du VPS, projet Google) sont dans le Google Doc « JARVIS OS — reprise (privé) » du dossier Drive `RD Assistant/Jarvis (sources de la page)/` (ID dans `CLAUDE.md`), jamais ici : le dépôt est public.

## Ce qu'est JARVIS OS (16/11/2026)

L'assistant personnel du propriétaire sur iPhone : une app web (installable sur l'écran d'accueil) servie par **son propre serveur**, qui remplace la page Jarvis de claude.ai. Pas de frais d'API : Claude passe par son abonnement (Claude Code sur le serveur), les données Google par un accès Google direct qu'il a créé lui-même.

| Pièce | Où | Rôle |
|---|---|---|
| Nouvelle app (la page Jarvis refondue) | `essais/jarvis-os-maquette/index.html` | Tout l'affichage : accueil « Fil du jour », barre à favoris, rubriques, Réglages. C'est la page Jarvis v17.15 (zéro régression par construction) + les ajouts JARVIS OS, repérés par le commentaire « JARVIS OS » |
| Données d'exemple | `essais/jarvis-os-maquette/donnees-fictives.js` | Faux `window.claude` (maquette publiée sur GitHub Pages et bancs) |
| Pont vers le serveur | `essais/jarvis-os-maquette/jarvis-serveur.js` | Vrai `window.claude` sur le serveur : outils → `POST /api/tool`, Claude → `POST /api/sample` ; appairage et Google pour l'écran Réglages |
| Page vocale et globe | `jarvis-os/app/src/voice-overlay.ts`, `holo.ts`, `orb.ts`, `voice.ts` → compilés en `essais/jarvis-os-maquette/jarvis-voix.js` (`npx vite build -c vite.voice.config.ts` dans `jarvis-os/app`) | L'orbe de la barre, la conversation continue, la voix Pierre du serveur |
| Ancienne app (PWA 0.9) | `jarvis-os/app` → compilée dans `jarvis-os/web` (`npx vite build`) | À remplacer par la nouvelle (voir « État ») ; sa page Réglages sert encore (mise à jour du serveur, voix) |
| Serveur | `jarvis-os/server/server.mjs` (Node 22, sans dépendance), `google.mjs`, `hooks/guard.mjs`, `tts/` | Claude Code de l'abonnement, missions, ordres aux bots (Canal), voix Piper, accès Google direct, sert les apps |
| Installation | `jarvis-os/server/install/setup.sh` (Ubuntu), `voice.sh`, `remote-control.sh`, `cloud-config.yaml` | Node 22, Claude Code, service `jarvis`, Caddy HTTPS sur `<ip-avec-tirets>.sslip.io`, pare-feu |

## Le serveur

- VPS OVH (VPS-1, Ubuntu 26.04), adresse `https://<ip-avec-tirets>.sslip.io` (exacte : Google Doc privé, ou le mail OVH « Installation de votre VPS »).
- Service systemd `jarvis` (utilisateur `jarvis`), dépôt cloné dans `/opt/rd`, données dans `/home/jarvis/.jarvis/state.json` (droits 600 : jetons des appareils en empreinte, identifiant et secret Google, jeton Google, mémoire, missions). Caddy en façade (HTTPS automatique).
- **Mettre en ligne une modification** : fusionner dans `main`, puis le propriétaire touche « Mettre à jour le serveur » (Réglages ; le serveur fait `git pull --ff-only` puis redémarre). En SSH : `sudo -u jarvis git -C /opt/rd pull --ff-only && sudo systemctl restart jarvis`.
- **Administration du serveur** (depuis le 16/11/2026) : session « Serveur JARVIS » de l'app Claude (onglet Code ; Remote Control, service `jarvis-rc`, root, accord demandé à chaque commande). Une session de développement tourne dans le cloud sur le dépôt, jamais dans l'environnement « Serveur JARVIS » : elle ne touche pas au serveur, elle fusionne dans `main`, puis le propriétaire met le serveur à jour.
- **Relier un téléphone** : `sudo -iu jarvis node /opt/rd/jarvis-os/server/server.mjs pair` affiche un code (30 min, usage unique), à saisir dans Réglages.
- Claude Code sur le serveur est connecté à l'abonnement du propriétaire (`sudo -iu jarvis claude auth login` si besoin). Aucune clé d'API : les variables payantes sont retirées à chaque appel.
- Adresses servies : `/` app (voir État), `/os/` nouvelle app (essai), `/api/*` (voir `jarvis-os/server/README.md`), `/confidentialite.html` (déclarée à Google, à ne pas déplacer).

## L'accès Google direct (créé par le propriétaire le 16/11/2026)

- Projet Google Cloud « JARVIS » du compte de Pilotage ; Google Auth Platform : type Externe, **publiée** en production (sinon le jeton expire en 7 jours), Branding sans logo (un logo impose une vérification), page d'accueil `https://<serveur>/`, confidentialité `https://<serveur>/confidentialite.html`, domaine autorisé `sslip.io`. Client OAuth « Application Web », redirection `https://<serveur>/api/google/callback`.
- L'identifiant et le secret ont été collés par lui dans Réglages : ils ne sont que sur le serveur. **Ne jamais les demander.** S'il faut reconnecter : Réglages, « Reconnecter ».
- Outils traduits (`google.mjs`) : Sheets `get_values`, `append_values`, `update_values` ; Calendar `list_events`, `create_event`, `update_event`, `delete_event` ; Gmail `search_threads`, `get_thread`, `list_drafts`, `send_message`, `delete_draft`, `unlabel_thread`. Pas encore : `fire_trigger` (« Confier à la tâche Claude »), les outils que Claude utilise dans la discussion de la page (`preparer_ordre`, `ajouter_tache`, `mettre_a_jour_dossier`).

## Tester (toujours avant de montrer)

| Banc | Commande (depuis la racine du dépôt) |
|---|---|
| Serveur (79 vérifications, faux Claude, faux Google) | `node jarvis-os/server/tests/server.test.mjs` |
| Nouvelle app, maquette (iPhone simulé) | `NODE_PATH=/opt/node-tools/node_modules node essais/jarvis-os-maquette/banc/banc.cjs` |
| Nouvelle app sur le vrai serveur (faux Google), de bout en bout | `NODE_PATH=/opt/node-tools/node_modules node essais/jarvis-os-maquette/banc/banc-serveur.mjs` |
| Ancienne app avec le serveur | `node jarvis-os/app/tests/e2e-server.cjs` (dans `jarvis-os/app`) |

Playwright et Chromium sont préinstallés dans les sessions cloud (`NODE_PATH=/opt/node-tools/node_modules`). Captures dans le dossier temporaire `jarvis-os-banc`.

## Méthode de travail (décidée avec le propriétaire)

- Il pilote depuis l'iPhone. Questions en **QCM** uniquement ; maquette ou captures avant de changer ce qui est en service ; zéro régression avec la page Jarvis (liste de parité).
- Thème : **Hologramme** (son image de charte : nuit bleue, néons cyan et violet, globe de réseau), polices Oxanium (titres, chiffres), Exo 2 (texte), Orbitron (logo) ; cartes « néon arrondi » ; l'ambre seulement pour « attend ta réponse ».
- Navigation : **barre à ses 4 favoris** + orbe au centre (page vocale), « Tout » ou glissé vers le haut pour les autres rubriques. Accueil : **Fil du jour**. Icône : **globe réseau**.
- Chaque étape : noter dans `docs/jarvis-os-refonte.md`, tester, fusionner dans `main` (accord permanent pour `essais/`, `docs/`, instructions ; le code de l'app et du serveur est fusionné dans le cadre de la refonte qu'il a demandée), puis lui envoyer captures et lien.

## État et reste à faire

Voir la fin de `docs/jarvis-os-refonte.md` (toujours à jour). Au 16/11/2026 : maquette complète et branchée ; accès Google relié par le propriétaire. Retours du 16/11 en cours de traitement : nouvelle app à l'adresse principale, menu du bas (fluidité, Accueil, « Pour moi », ordre), baisse de volume de la voix après 5 s, raccourcis par bot dans Automatisations, Agenda plus vivant, Équipe harmonisée, Voyages plus riches, Papiers par catégorie (aussi rangés dans le Drive, avec changement de la fiche d'Iris).
