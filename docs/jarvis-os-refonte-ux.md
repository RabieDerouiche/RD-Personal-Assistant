# JARVIS OS — refonte UX : application de la maquette à l'app (décidée le 22/11/2026)

À lire avec `docs/jarvis-os-refonte.md` (entrées du 21 et du 22/11/2026 : diagnostic, maquette, retouches) et `docs/jarvis-os-parite.md` (rien ne doit se perdre).

## Décisions (QCM)

| Question | Choix |
|---|---|
| Maquette | **Version 3 validée** (`essais/jarvis-os-ux/`, en ligne sur GitHub Pages) |
| Barre du bas | **5 portes fixes** : Aujourd'hui, Pour moi, orbe (Claude), Agenda, Espaces. Plus de favoris ni de menu « Tout » |
| Ordre | **Tout d'un coup** (recommandation « navigation d'abord » refusée) |
| Méthode | **Remplacer directement** : l'app (`essais/jarvis-os-maquette/index.html`) est modifiée en place (recommandation « construire à côté » refusée) |

Conséquence retenue : le travail se fait sur une branche, poussée régulièrement, et n'est **fusionné dans `main` qu'une fois, quand toute la refonte passe les bancs** (maquette, bout en bout, serveur, check-up). Fusionner avant mettrait une app à moitié refaite sur son iPhone (la mise à jour est proposée à chaque fusion, 0.27.0). D'autres sessions modifient la même page (Radar, voix) : fusionner `main` dans la branche souvent, et lire leurs entrées dans `docs/jarvis-os.md`.

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

## Étapes (une seule fusion à la fin)

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
- Coquille : `boot()` (barre à favoris, feuille « Tout », `drawBar`, `placeInd`), `VIEWS`, `TITLES`, `VIEWTITLE`, `TAB`, `NAV`/`navTrack`/`navBack`, `renderView`, `go` (réassignée pour le mode « une par une »), `hashchange`, `voirUrl` (`#voir-…` → Pour moi). Le serveur envoie des liens vers `/#suivi` et `/#demandes` (`server.mjs`, `sante.mjs`, `notify.mjs`) : **`#suivi` doit rester une adresse valide**.
- Couches : `#sheet` (`openSheet(cfg)`/`closeSheet`), `#app` (`openApp`, `SCREEN.*` : taches, papiers, depot réutilisés ailleurs), `#chat` (`openChat`/`closeChat`/`renderChat`, `window.JarvisAsk` = `askOpen`), `swipeToClose()`.
- Vues effectives : accueil = `homeDash` (récolte `ACC_ORIG` dans un bloc hors écran) ; Pour moi = sections `#pm-dec`, `#pm-todo`, `#pm-proj`, `#pm-rep`, `#pm-wait`, `#pm-mail` ; suivi = 13 panneaux (`pendPanel`, réponses reçues, `costPanel`, `queuePanel`, `claudePanel`, dossiers, ligne Papiers, `SCREEN.taches`, `missionsPanel`, relances, `consoPanel`, `sysBox`+`santeBox`, `histPanel`) ; equipe = `agentPage` si `AGENT`, sinon héros de Claude, `mateCard`, `teamStats`, `liveFil`, « Tes ordres » ; automatisations = `routinesPanel` + une frise par bot.
- À réutiliser : `C(bot, taille)` (personnages, ids internes hydra, medusa…), `JarvisVoice.holo(o)` (globe, états idle, listening, thinking, speaking ; `mountButton` ne rend pas l'objet du globe), `voyPhoto`, `compImg`, `priceChart`, `radLoad`/`radReste`/`radEur`, `metLoad`/`metLine`, `pourMoiN()`, `homeData()`, `dayItems()`.
- Claude : `sendChat` (attente, flux `onText`, fin) ; `mainsBusy(b)` reçoit déjà idle, thinking, speaking : c'est là que le globe doit être piloté.
- Bancs liés à la navigation : `banc.cjs` (favoris, « Tout », `.talk-slot .jv-btn`, `#voir-…`, routes, Équipe `.team .mate`, `.lf`, Suivi `.pend-x .track`, Automatisations `.auto.card`), `banc-serveur.mjs` (`.fav-handle`, `#missions`, `.mis-panel`, `.rel-panel`, `.conso-panel`, `.sante-box`, `#routines`, routes `#suivi` et `#automatisations`), `audit.cjs` (liste des routes, `.all-sheet`).

## État

- 22/11/2026 : décisions prises, plan écrit ; cartographie du code en cours.
