# Travail en cours (26/11/2026, soir) : à reprendre, pas à refaire

Ce dossier est provisoire : il disparaît quand tout est fusionné. Il sert à ce qu'une autre session reprenne
sans rien recommencer (sa remarque du 26/11/2026 : « tu recommences à chaque session, fais les choses
séquentiellement »). **Règle : un chantier à la fois ; chaque chantier fini est fusionné dans la branche et
poussé avant de commencer le suivant.**

Branche : `claude/grok-hermes-jarvis-reprise-i864jv`. Base de tous les chantiers : commit `375cd15`
(A « CRA du mois seul » et B « routine_fin » y sont, prêts ; leurs demandes au serveur :
`docs/demandes-serveur-en-attente.md`).

## Reprendre un chantier

`git checkout -b reprise-X 375cd15 && git apply docs/en-cours/chantier-X.patch` (vérifié : chaque fichier
s'applique sur `375cd15`), terminer, passer ses bancs, fusionner dans la branche, pousser, puis retirer le
fichier d'ici.

| Chantier | Fichier | État au moment de l'arrêt |
|---|---|---|
| C, 0.91.0 : rangement des papiers par JARVIS (dépôt depuis l'app, proposition du dossier et du nom, écriture dans Drive après son oui) | `chantier-C.patch` | serveur (`depot.mjs`), Drive, app et bancs écrits ; restaient le service worker, le manifeste (menu Partager), les bancs à repasser, la note |
| D, 0.92.0 : Hermes et ses routines en direct (résumé root assaini, route, santé, app) | `chantier-D.patch` | presque fini : restaient les ajouts du banc de la relance et la note |
| E, 0.93.0 : Radar (« déjà dépensé ce mois », historique), feuille d'un jour de l'Agenda sans bots, « Pour moi » : une carte par sujet | `chantier-E.patch` | Radar fini et testé ; bloc de l'app en cours (« Pour moi », Agenda) ; restaient les bancs de l'app et la note |
| F, 0.94.0 : réponses aux mails du mois suivies (même fil ou nouveau fil, détection toutes les 5 minutes, une notification, carte de Travail) | dans la branche | **fini, fusionné dans la branche et poussé le 26/11 au soir** (travail 31, jours 106, courrier 10, serveur 391) ; sa note : `docs/_chantier-F.md` (entrée de journal, contrôles du serveur, points à décider) |

## Ordre

1. F (les réponses aux mails : sa priorité), 2. D, 3. E, 4. C, 5. tous les bancs, fusion dans main, **une**
demande commune à la session « Serveur JARVIS » (A, B, C, D, E, F), 6. les trois maquettes de refonte
(`essais/jarvis-refonte-b/` et `-c/` : premier jet écrit, pas encore relu ni capturé ; `-a/` « Orbite » :
pas commencé), 7. le dépôt du CRA signé sur le portail par Hermes après son oui (son choix au QCM du 26/11).

## Décisions du 26/11/2026 au soir (QCM)

- Refonte : repenser toute l'app, maquette d'abord ; ce qui le gêne : trop d'écrans et de tuiles, il ne voit
  pas ce qui tourne ; il aime l'hologramme mais veut 2 ou 3 propositions qui ne soient pas des recoloriages
  (A « Orbite » : le globe devient la navigation ; B « Poste de contrôle » : trois files et des rails
  d'étapes ; C « Le fil » : une conversation qui tient lieu d'app).
- CRA signé reçu du client : Hermes le dépose sur le portail après son oui dans JARVIS (à blanc d'abord, sa
  validation la première fois).
- Méthode : séquentiel, plus d'agents en parallèle (ils ont vidé le forfait partagé le 26/11 et coupé Hermes).
