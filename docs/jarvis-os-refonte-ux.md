# JARVIS OS — refonte UX : application de la maquette à l'app (décidée le 22/11/2026)

À lire avec `docs/jarvis-os-refonte.md` (entrées du 21 et du 22/11/2026 : diagnostic, maquette, retouches) et `docs/jarvis-os-parite.md` (rien ne doit se perdre).

## Décisions (QCM)

| Question | Choix |
|---|---|
| Maquette | **Version 3 validée** (`essais/jarvis-os-ux/`, servie par le serveur à `/maquettes/ux/` depuis la 0.53.0) |
| Barre du bas | **5 portes fixes** : Aujourd'hui, Pour moi, orbe (Claude), Agenda, Espaces. Plus de favoris ni de menu « Tout » |
| Ordre | **Tout d'un coup** (recommandation « navigation d'abord » refusée) |
| Méthode | **Remplacer directement** : l'app (`essais/jarvis-os-maquette/index.html`) est modifiée en place (recommandation « construire à côté » refusée) |

Conséquence retenue (historique : fusionnée en 0.54.0 ; depuis, chaque version est fusionnée seule) : le travail se fait sur une branche, poussée régulièrement, et n'est **fusionné dans `main` qu'une fois, quand toute la refonte passe les bancs** (maquette, bout en bout, serveur, check-up). Fusionner avant mettrait une app à moitié refaite sur son iPhone (la mise à jour est proposée à chaque fusion, 0.27.0). D'autres sessions modifient la même page (Radar, voix) : fusionner `main` dans la branche souvent, et lire leurs entrées dans `docs/jarvis-os.md`.

## Cible (ce que la maquette fixe)

- **Navigation** : 5 portes ; chaque onglet a sa pile (Espaces → Achats → fiche) ; « ‹ Retour » dans l'en-tête et glisser depuis le bord gauche ; second appui sur l'onglet : retour à sa racine, en haut. Aucun geste sur la barre (appui seulement). La pastille de Grok de l'en-tête ouvre Équipe. Les anciennes adresses (`#demandes`, `#achats`, `#voir-<ligne>`…) et les liens des notifications ouvrent toujours la bonne page.
- **Un seul modèle d'écran** : grand titre (qui passe dans l'en-tête au défilement), une carte phare, un seul filtre segmenté collé sous l'en-tête, des lignes identiques ; le secondaire replié en bas.
- **Une seule couche** : tout détail dans la feuille du bas (moitié, tirée vers le haut : plein écran ; fermée d'un glissé, d'un appui sur le fond ou de ✕) ; Claude dans la même feuille, en plein écran, avec le grand globe et son état (à l'écoute, réfléchit, répond).
- **Aujourd'hui** : écran de JARVIS (heure et secondes, globe à anneaux, 4 relevés reliés : Agenda, Météo, Décisions, Argent ; la phrase du jour dite à l'ouverture), puis Maintenant (3 décisions), Ta journée (frise), Cette semaine, À surveiller (cartes en photo).
- **Personnages des bots** partout où un bot est nommé ; **photos** dans Achats, Voyages, Sorties, Espaces.

## Où va chaque bloc d'aujourd'hui (parité)

| Aujourd'hui | Après la refonte |
|---|---|
| Accueil : En un coup d'œil (pour toi, mails, bons prix), météo | Relevés de l'écran de JARVIS ; la météo dans le relevé Météo |
| Accueil : À faire maintenant, Aujourd'hui (frise), Les 14 prochains jours, À surveiller, Voyage en préparation | Maintenant, Ta journée, Cette semaine, À surveiller (cartes en photo) |
| Accueil : En ce moment (activité en direct, 0.33.0) | Une ligne d'activité sous l'heure quand Claude ou une mission travaille ; le fil complet dans Équipe |
| Pour moi : toutes ses sections | Filtres Tout, Décider (à décider, oui à donner), À faire (à faire, brouillons, courrier à trier, arrivés depuis le tour d'Iris, mes tâches), Infos (réponses des bots, réponses reçues sur tes dossiers) ; plus tard, de côté, reportées, expirées repliées en bas ; « Traiter une par une » gardé |
| Suivi : En cours chez tes bots, Tes ordres, Historique de tes demandes, Pour Claude, Missions de Claude, Relances | Équipe, filtre Demandes |
| Suivi : Dossiers en attente d'un tiers | Équipe, filtre Demandes (section Dossiers) |
| Suivi : Coût de la semaine, Claude cette semaine, File d'attente des bots | Équipe, filtre Coût ; la file dans la carte phare (pause de Grok) |
| Suivi : Mes tâches | Pour moi, À faire |
| Suivi : ligne Papiers | Papiers (Espaces) |
| Suivi : État des systèmes | Réglages |
| Équipe : Ton équipe, page d'un bot, En ce moment, Journal | Équipe, filtre Bots (constellation, lignes, fiche du bot) |
| Automatisations (frise de suivi de livraison, routines de Claude, brief du matin) | Équipe, filtre Routines |
| Achats, Voyages, Sorties, Papiers, Argent | Espaces, une tuile vivante chacun, puis leur page sur le même modèle |
| Réglages | Espaces, « Coulisses », Réglages (+ État des systèmes) |

## Étapes (une seule fusion à la fin ; historique : fusionnée en 0.54.0, depuis chaque version est fusionnée seule)

1. Coquille : barre à 5 portes, piles par onglet, en-tête avec retour, glisser depuis le bord, Espaces, adresses anciennes ; bancs mis à jour.
2. Globe : barre, écran de JARVIS de l'accueil, feuille de Claude ; ses états branchés sur la vraie discussion (réflexion, réponse mot par mot).
3. Aujourd'hui avec les vraies données.
4. Pour moi en filtres.
5. Équipe qui absorbe Suivi et Automatisations.
6. Domaines sur le même modèle : Achats, Voyages, Sorties (photos à trouver : nouveau), Argent, Papiers.
7. Une seule couche : les rubriques par-dessus (`#app`) deviennent des pages de la pile ; la discussion devient la feuille plein écran.
8. Bancs (maquette, bout en bout, serveur, check-up), liste de parité, captures, puis fusion et entrée dans `docs/jarvis-os.md`.

## Carte du code (par nom : les numéros de ligne bougent)

- Page : `essais/jarvis-os-maquette/index.html`, un seul script (IIFE) ; les couches « JARVIS OS » réassignent les fonctions plus haut (la dernière gagne). Défilement dans `#scroller`, pas `window`.
- Coquille : `boot()` (barre à 5 portes `PORTES`, orbe dans `.talk-slot`, `drawBar`, `placeInd`), `VIEWS`, `TITLES`, `VIEWTITLE`, `TAB`, `NAV`/`navTrack`/`navBack`, `renderView`, `go` (réassignée pour le mode « une par une »), `hashchange`, `voirUrl` (`#voir-…` → Pour moi). Le serveur envoie des liens vers `/#suivi` et `/#demandes` (`server.mjs`, `sante.mjs`, `notify.mjs`) : **`#suivi` doit rester une adresse valide**.
- Couches : `#sheet` (`openSheet(cfg)`/`closeSheet`), `#app` (`openApp`, `SCREEN.*` : taches, papiers, depot réutilisés ailleurs), `#chat` (`openChat`/`closeChat`/`renderChat`, `window.JarvisAsk` = `askOpen`), `swipeToClose()`.
- Vues effectives : accueil = `homeDash` (récolte `ACC_ORIG` dans un bloc hors écran) ; Pour moi = sections `#pm-dec`, `#pm-todo`, `#pm-proj`, `#pm-rep`, `#pm-wait`, `#pm-mail` ; suivi = 13 panneaux (`pendPanel`, réponses reçues, `costPanel`, `queuePanel`, `claudePanel`, dossiers, ligne Papiers, `SCREEN.taches`, `missionsPanel`, relances, `consoPanel`, `sysBox`+`santeBox`, `histPanel`) ; equipe = `agentPage` si `AGENT`, sinon héros de Claude, `mateCard`, `teamStats`, `liveFil`, « Tes ordres » ; automatisations = `routinesPanel` + une frise par bot.
- À réutiliser : `C(bot, taille)` (personnages, ids internes hydra, medusa…), `JarvisVoice.holo(o)` (globe, états idle, listening, thinking, speaking ; `mountButton` ne rend pas l'objet du globe), `voyPhoto`, `compImg`, `priceChart`, `radLoad`/`radReste`/`radEur`, `metLoad`/`metLine`, `pourMoiN()`, `homeData()`, `dayItems()`.
- Claude : `sendChat` (attente, flux `onText`, fin) ; `mainsBusy(b)` reçoit déjà idle, thinking, speaking : c'est là que le globe doit être piloté.
- Bancs liés à la navigation : `banc.cjs` (barre à 5 portes : il vérifie l'absence de `.fav-handle` et de `.all-sheet` ; `.talk-slot .jv-btn`, `#voir-…`, routes, Équipe `.team .mate`, `.lf`, Suivi `.pend-x .track`, Automatisations `.auto.card`), `banc-serveur.mjs` (`#missions`, `.mis-panel`, `.rel-panel`, `.conso-panel`, `.sante-box`, `#routines`, routes `#suivi` et `#automatisations`), `audit.cjs` (liste des routes ; depuis la 0.73.0, il ne cite plus `.all-sheet`). Depuis la 0.73.0 : Équipe › Coût construit directement `costPanel`, `queuePanel` et `consoPanel` (plus de récolte des 13 panneaux de Suivi) ; Réglages › État des systèmes est construit directement (`SANTE_DER`, relu au plus toutes les 30 s) ; la carte « Serveur JARVIS » de Réglages a la liste des appareils reliés (`.app-list`, `.app-it`, `data-appareil`).

## État

- 22/11/2026 : décisions prises, plan écrit, code cartographié.
- 22/11/2026 : **appliquée en 0.54.0** (une seule fusion). Fait : étapes 1 (coquille, Espaces, retour par le bord), 2 (Équipe absorbe Suivi et Automatisations par récolte des panneaux d'origine ; Pour moi en filtres), 3 (globe vivant dans `holo.ts`, écran de JARVIS sur l'accueil, états du globe pendant la discussion), une partie de 4 (grands titres, photos des sorties, photo du prochain voyage dans Espaces) et 8 (bancs maquette, bout en bout, check-up adaptés). Reste, à proposer au propriétaire : 7 (discussion et rubriques par-dessus en feuille du bas) et le reste de 6 (Achats, Voyages, Argent, Papiers sur le modèle de la maquette : carte phare, un filtre, lignes illustrées), le nettoyage du CSS du menu « Tout ».
- Où est quoi dans le code (couches ajoutées en fin de script, repérées « refonte UX ») : `rootOf()` et `NAVLBL` près de `TAB` ; `navTrack`/`navBack` (retour vers Espaces) ; `boot()` (barre, bord gauche) ; `VIEWS.espaces` avant `boot()` ; `hudScreen()`/`hudLines()` avant `homeDash()` ; en fin de script : Équipe et Pour moi (`EQF`, `PMF`, `EQHASH`), états du globe (`uxState`, enveloppes de `renderChat`, `mainsBusy`, `closeChat`), grands titres et `sorCard` avec photo.
- 22/11/2026 : **0.55.0, l'app vivante et fluide** (sa demande après la 0.54.0) : transitions de page dans le sens du geste avec l'ancienne page qui part pendant que la nouvelle arrive, filtres en fondu, fenêtres qui montent et redescendent, chiffres qui comptent, ciel animé ; détail dans `docs/jarvis-os.md` (0.55.0). Code : fin du script, bloc « l'app vivante et fluide » (`UXM`, `kindOf`, `cloneVisual`, `ghostOut`, `countUp`, enveloppes de `renderView`, `closeChat`, `closeApp`).
- 22/11/2026 : **0.57.0, l'effet « waouh », la vitesse, l'abonnement refusé en clair** (son retour sur la 0.55.0 ; appliqué sans question, à sa demande) ; détail et mesures dans `docs/jarvis-os.md` (0.57.0). Code : `holo.ts` (globe en calques), bloc « l'effet waouh » en fin de script (`decorate`, `reveal`, inclinaison sous le doigt, zoom depuis l'élément touché, cercle de l'orbe, sol et parallaxe), `mailPanelBox`.
- 22/11/2026 : **0.58.0, fini les blocs bleus** (QCM : « A + bord irisé phare ») ; détail dans `docs/jarvis-os.md` (0.58.0). Code : bloc « 0.58.0 : fini les blocs bleus » en fin de script (`PGC`, `setPg`, style `#ux-cartes`). **Prochaine étape choisie (QCM)** : le reste de l'étape 6, Achats, Voyages, Argent, Papiers sur le modèle de la maquette (carte phare en photo, un seul filtre, lignes illustrées) ; puis l'étape 7 (feuille du bas).
- 22/11/2026 : **0.59.0**, chargement de l'accueil, brief en rubriques, barre qui répond ; détail dans `docs/jarvis-os.md` (0.59.0).
- 23/11/2026 (0.69.0) : restent l'étape 6 (Achats, Voyages, Argent, Papiers sur le modèle de la maquette), l'étape 7 (rubriques par-dessus et discussion en feuille du bas : `openApp()` existe toujours) et le nettoyage du CSS `.fav-handle` / `.all-sheet` (début de `index.html`). Aucune version de 0.60.0 à 0.69.0 ne les traite.
- 24/11/2026 (0.73.0, passe « fiabilité + petits conforts ») : le CSS du menu « Tout » et des favoris (`.fav-handle`, `.all-sheet`) est retiré. Restent l'étape 6 et l'étape 7, sans changement de mise en page dans cette version.
- 26/11/2026 : **refonte UX du 26/11** (sa demande : « encombré, pas super simple ni intuitif »), désencombrement et interrupteur « Grok Bot arrêté le » (Faits) ; bloc « 0.86.0 : refonte UX du 26/11 » en fin de script, avant « 0.58.0 ». Détail : `docs/jarvis-os.md`. Restaient l'étape 6 et l'étape 7 (faites en 0.87.0).
- 26/11/2026 : **0.87.0, étapes 6 et 7 appliquées** (son choix au QCM : « Maintenant »). Étape 6 : Achats (À décider · Suivis · Idées · Achetés), Voyages (Projets · Envies), Argent (filtre du Radar collé), Papiers (recherche en carte phare ; Personnes · Thèmes · Validité · Déposer) ; secondaire replié en bas (`details.dm-plus`). Étape 7 : `openApp('agenda')` ouvre l'Agenda, `openApp('depot')` Papiers › Déposer (plus de couche `#app` ; le code d'`openApp` reste pour un appel oublié) ; la discussion `#chat` est une feuille du bas plein écran. Code : bloc « 0.87.0 : suite de la refonte UX » en fin de script, avant « 0.58.0 » (`DMF` : le filtre de chaque page ; `dmSeg`, `dmShow` (attribut `data-dmh`), `dmPlus`, `PAP_K`). Les panneaux d'origine sont gardés (cachés par le filtre, pas retirés) : les bancs qui les lisent tiennent. Détail : `docs/jarvis-os.md` (0.87.0). La refonte de la maquette est entièrement appliquée.
