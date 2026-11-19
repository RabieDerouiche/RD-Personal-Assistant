# Panier — la liste de courses du foyer (19/11/2026)

Deuxième app du propriétaire sur son serveur, à côté de JARVIS OS : une liste de courses partagée avec sa femme (courses ménagères d'abord : Grand Frais, Fresh, boucherie, Auchan, Carrefour, Intermarché…), appelée à s'étendre (achats hors ménagers, tâches). Demande du 19/11/2026 : belle, avec de vraies photos, gratuite, autonome, **sans Claude ni Grok Bot**, qui s'alimente seule quand un article ou une marque manque. Le nom « Panier » est un choix de Claude : à changer s'il le demande (manifeste, `index.html`, accueil).

Tout est dans `courses/`. Aucune donnée personnelle dans le dépôt : la liste, les prénoms et les photos apprises vivent sur le serveur (`~/.jarvis/courses/`).

## Où est quoi

| Pièce | Où | Rôle |
|---|---|---|
| App (PWA, sans bibliothèque, sans compilation) | `courses/web/` : `index.html`, `app.js`, `app.css`, `sw.js`, `manifest.webmanifest`, icônes | Liste, recherche, fiche d'un article, menu ; marche hors connexion (file d'opérations rejouées) |
| Catalogue de base | `courses/catalogue/catalogue.txt` (source lisible, 310 articles, 17 rayons) → `courses/web/catalogue.json` par `node courses/catalogue/construire.mjs` | Nom, rayon, unité, quantité par défaut, prix estimé, mots-clés, marques proposées |
| Photos du catalogue | `courses/web/img/<id>.webp` (400 px, environ 21 Ko), crédits dans `courses/web/credits.json`, choix dans `courses/catalogue/choix-photos.json` | Wikimedia Commons, licences libres ; crédits affichés dans l'app (Menu, Crédits des photos) : **obligatoires**, ne pas les retirer |
| Serveur | `courses/server/courses.mjs` (Node 22, aucune dépendance), `enrichir.mjs` | Foyer et appareils, listes, direct (SSE), alimentation automatique |
| Bancs | `courses/server/tests/courses.test.mjs`, `courses/banc/banc.cjs` | Voir « Tester » |

## Comment c'est servi

- Le serveur JARVIS (`jarvis-os/server/server.mjs`) charge `courses/server/courses.mjs` après son démarrage et lui passe tout ce qui commence par `/courses` (avant même ses règles d'origine). Si Panier ne se charge pas, JARVIS tourne sans lui. Adresse : `https://<serveur>/courses/`.
- **Mise en ligne** : fusion dans `main`, puis « Mettre à jour le serveur » dans JARVIS (rien à installer, pas de réglage Caddy : même service, même port).
- Seul, hors de JARVIS : `node courses/server/courses.mjs` (PORT, défaut 8790 ; `PANIER_DATA`).
- Données : `~/.jarvis/courses/etat.json` (droits 600, jetons en empreinte), photos apprises dans `img/`, une copie par jour dans `copies/` (7 gardées). Un fichier d'état abîmé est mis de côté, jamais écrasé.
- Sans serveur (GitHub Pages, `…/courses/web/`) : l'app passe en démonstration, liste gardée sur l'appareil.
- Le service worker de JARVIS ne touche pas à `/courses` (exclu dans `essais/jarvis-os-maquette/sw.js`).

## Foyer et appareils (aucun compte, aucun mot de passe)

- **Le premier qui ouvre l'adresse crée le foyer** (son prénom). Ensuite, on n'entre qu'avec un **code d'invitation à 6 chiffres** (Menu, « Inviter quelqu'un » : une heure, 4 appareils, lien `#inviter=<code>` à partager). 12 codes faux en une heure : plus aucun essai pendant une heure.
- Chaque appareil garde un jeton (cookie HttpOnly limité à `/courses`, et mémoire de l'app). Même prénom depuis un autre appareil = même personne.
- **iPhone** : l'app posée sur l'écran d'accueil a sa propre mémoire. Si elle demande un code après l'installation, en créer un depuis Safari et le saisir avec le même prénom (non vérifiable depuis une session cloud).
- Plus aucun appareil relié : `sudo -iu jarvis node /opt/rd/courses/server/courses.mjs code` (session « Serveur JARVIS ») donne un code de secours de 30 minutes. Repartir de zéro : arrêter le service, retirer `~/.jarvis/courses/etat.json`.

## Ce que fait l'app

- Liste rangée par rayon (ordre du magasin) ou par magasin ; total estimé, « reste à prendre » pendant les courses ; cocher, « Terminer » (vide le panier, note les habitudes : « Souvent achetés » suit ce que le foyer achète).
- Ajouter : recherche tolérante (accents, pluriels, une faute), quantité et marque dans la phrase (« 2 kg pommes de terre », « lait lactel », « baguette x3 »), rayons en photos.
- Fiche : quantité et unité (kg, g, pièce avec conversion), marque (proposées ou libre), précision, magasin, prix corrigé par le foyer, photo.
- Plusieurs listes (Courses, Achats, et celles qu'ils créent). Clair ou sombre selon le téléphone.
- En direct entre les téléphones ; hors connexion, les gestes sont gardés et partent au retour du réseau.

## Alimentation automatique (sans Claude, sans bot)

`enrichir.mjs`, à chaque article ou marque inconnus : Open Food Facts (`search.openfoodfacts.org`, produit de la marque le mieux assorti : photo d'emballage, rayon d'après ses catégories), Open Prices (prix médian des derniers relevés en euros, promotions écartées), Wikipédia (photo de l'article du même nom), Wikimedia Commons (autres photos, pour « Changer la photo »). Un essai par article ou marque tous les 7 jours. Le serveur ne télécharge que depuis ces sites (liste fermée, pas de redirection). Le foyer peut toujours choisir une autre photo, la prendre avec le téléphone, corriger un prix ou un rayon : son choix passe devant.

Limites connues : un produit frais sans marque a rarement un prix relevé (le prix estimé du catalogue sert) ; Open Food Facts ne connaît presque pas les produits ménagers (photo Commons ou photo prise par le foyer).

## Tester (toujours avant de montrer)

| Banc | Commande (racine du dépôt) |
|---|---|
| Serveur (39 vérifications : foyer, invitations, opérations rejouées, photo et prix trouvés seuls avec de fausses sources, sites autorisés, redémarrage, montage dans JARVIS) | `node courses/server/tests/courses.test.mjs` |
| Deux iPhone simulés (46 vérifications : ajout, quantités, direct, hors connexion, article inconnu, photo, terminer, listes, sombre, démonstration ; captures dans le dossier temporaire `panier-banc`) | `NODE_PATH=/opt/node-tools/node_modules node courses/banc/banc.cjs` |
| Non-régression JARVIS | `node jarvis-os/server/tests/server.test.mjs` (son banc tient pour « prêt » la première ligne de journal du serveur : Panier se charge après) |

## Ajouter des articles ou refaire des photos

1. Ajouter la ligne dans `catalogue.txt` (dernière colonne : mots de recherche en anglais pour la photo).
2. `node courses/catalogue/photos.mjs cherche <id>` (candidates par la page de recherche d'images de Commons : son API est bridée depuis les sessions cloud), `python3 courses/catalogue/planches.py` (planches contact à **regarder**), noter le choix dans `choix-photos.json`.
3. `node courses/catalogue/photos.mjs applique <id>`, `python3 courses/catalogue/planches.py finales`, `node courses/catalogue/construire.mjs`.
4. Changer `v=` dans `index.html` et `sw.js` si `app.js` ou `app.css` changent.

## Journal

- **1.0.0 (19/11/2026)** : première version. Choix faits sans QCM (il a demandé d'être surpris) : nom « Panier », thème clair et sombre aux couleurs d'un marché (pas l'Hologramme de JARVIS, l'app étant aussi pour sa femme), service monté dans le serveur JARVIS plutôt qu'un second service (aucune manipulation sur le serveur), listes « Courses » et « Achats » au départ. JARVIS serveur 0.24.1 (seul changement : Panier servi sous `/courses/`).
- Photos à améliorer quand l'occasion se présente (jugées moyennes) : agneau à mijoter, lapin, truite, thon frais, cabillaud, céréales bébé, liniment.

## Reste à faire, idées d'évolution

- À vérifier sur leurs iPhone : installation sur l'écran d'accueil (code redemandé ou non), direct entre les deux téléphones, photo prise avec l'appareil, vraies recherches Open Food Facts depuis le serveur.
- Pas encore fait : notifications (« Sam a ajouté… » quand l'app est fermée), listes de tâches (cases sans prix), prix par magasin, lecture de code-barres, tri des rayons selon le magasin.
