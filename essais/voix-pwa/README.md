# Page d'essai : conversation vocale en continu dans une PWA iPhone

But : savoir si une PWA ouverte au premier plan sur iPhone peut tenir une conversation à la voix sans toucher l'écran (écoute, réponse lue, écoute qui repart seule). C'est la condition pour que le projet JARVIS OS (`docs/jarvis-os.md`) ait sa propre app vocale.

La page n'a ni cerveau ni donnée : elle répète ce qu'on lui dit (« Tu as dit : … »). Elle n'envoie rien nulle part ; seule la voix part chez Apple, qui la transcrit. Un journal technique et « Copier le rapport » donnent le résultat à recoller à Claude.

- `index.html` : la page (reconnaissance vocale `webkitSpeechRecognition`, voix du téléphone `speechSynthesis`, modes « phrase par phrase » et « écoute continue », verdict, journal).
- `manifest.webmanifest`, `sw.js`, `icon-*.png` : pour l'installer sur l'écran d'accueil (mode PWA).
- `_headers` : en-têtes Cloudflare Pages (micro autorisé pour la page elle-même).
- `test.js` : banc avec faux micro et fausse voix (boucle réussie, écoute continue, micro refusé, relance refusée depuis l'écran d'accueil, micro qui ne répond jamais, démarrage refusé, pas de reconnaissance, silence). `NODE_PATH=/opt/node-tools/node_modules node essais/voix-pwa/test.js`.

## Mise en ligne sur GitHub Pages (gratuit, choix du 15/11/2026)

Le déploiement Cloudflare (Workers) a échoué sur « Connection blocked » le 15/11/2026 ; le propriétaire a choisi GitHub Pages. Réglages du dépôt : Pages, source « Deploy from a branch », branche `main`, dossier `/ (root)`. Le fichier `.nojekyll` à la racine coupe Jekyll (les fichiers sont servis tels quels). Adresse : `https://rabiederouiche.github.io/RD-Personal-Assistant/essais/voix-pwa/`.

## Mise en ligne sur Cloudflare Pages (gratuit)

Le dossier se publie tel quel, sans étape de construction : projet Pages relié au dépôt, branche `main`, commande de build vide, dossier de sortie `essais/voix-pwa`. Adresse : `https://<nom du projet>.pages.dev`.

## Lire le résultat

- Réussi dans Safari **et** depuis l'écran d'accueil : la PWA vocale est possible ; reste le cerveau (voir `docs/jarvis-os.md`).
- `service-not-allowed` ou « relance refusée » depuis l'écran d'accueil : la conversation continue ne marche que dans Safari, pas en app.
- « ne démarre pas », `not-allowed` : micro refusé ; vérifier Réglages, Safari, Micro, et Réglages, Confidentialité, Reconnaissance vocale.
