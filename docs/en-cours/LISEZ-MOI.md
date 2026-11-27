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
| D, 0.92.0 : Hermes et ses routines en direct (résumé root assaini, route, santé, app) | dans la branche | **fini et fusionné dans la branche le 27/11 au matin** ; bancs repassés après fusion (voir le dernier commit « bancs ») ; risques : `suite-routines.md` |
| E, 0.93.0 : Radar (« déjà dépensé ce mois », historique), feuille d'un jour de l'Agenda sans bots, « Pour moi » : une carte par sujet | `chantier-E.patch` | Radar fini et testé ; bloc de l'app en cours (« Pour moi », Agenda) ; restaient les bancs de l'app et la note |
| F, 0.94.0 : réponses aux mails du mois suivies (même fil ou nouveau fil, détection toutes les 5 minutes, une notification, carte de Travail) | dans la branche | **fini, fusionné dans la branche et poussé le 26/11 au soir** (travail 31, jours 106, courrier 10, serveur 391) ; sa note : `docs/_chantier-F.md` (entrée de journal, contrôles du serveur, points à décider) |

## Ordre

1. F et D : faits. 2. Fusion dans main et **première demande** à la session « Serveur JARVIS » avec ce qui est prêt
(A, B, D, F ; sections dans `docs/demandes-serveur-en-attente.md` ; VERSION 0.94.0). 3. E, 4. C, puis une seconde demande. 5. les trois maquettes de refonte
(`essais/jarvis-refonte-b/` et `-c/` : premier jet écrit, pas encore relu ni capturé ; `-a/` « Orbite » :
pas commencé), 6. le dépôt du CRA signé sur le portail par Hermes après son oui (son choix au QCM du 26/11).

## Décisions du 26/11/2026 au soir (QCM)

- Refonte : repenser toute l'app, maquette d'abord ; ce qui le gêne : trop d'écrans et de tuiles, il ne voit
  pas ce qui tourne ; il aime l'hologramme mais veut 2 ou 3 propositions qui ne soient pas des recoloriages
  (A « Orbite » : le globe devient la navigation ; B « Poste de contrôle » : trois files et des rails
  d'étapes ; C « Le fil » : une conversation qui tient lieu d'app).
- CRA signé reçu du client : Hermes le dépose sur le portail après son oui dans JARVIS (à blanc d'abord, sa
  validation la première fois).
- Méthode : séquentiel, plus d'agents en parallèle (ils ont vidé le forfait partagé le 26/11 et coupé Hermes).

## Méthode pour ne rien reperdre (sa demande du 27/11/2026)

- Chaque étape finie est commitée et poussée ; cette note est mise à jour dans le même commit.
- Un agent coupé par la limite n'est pas relancé pour finir un reste : la session principale finit à partir du travail sauvegardé (fusion, bancs, notes). Un agent neuf reçoit une consigne courte qui pointe ici.
- Bancs et rangement de la documentation : par script ou en arrière-plan, sans consommer le forfait.
- Pas de travail lourd dans l'heure qui précède ses routines (Veille 7 h 40, CRA de la semaine le vendredi à midi).
- À décider et risques du chantier F : `suite-mails.md` (dont la structure de `jours.json` pour le dépôt du CRA signé par Hermes).

## État au 27/11/2026, 8 h 30 (heure de Paris)

- main = `95c500d` (demande de fusion 250) : A, B, D (0.92.0) et F (0.94.0) y sont ; tous les bancs verts (serveur 404, jours 106, travail 31, courrier 10, relance 80, garde 25, Hermes 88, portail 188, bout en bout 136, app 361 et 3 échecs liés à la date, identiques sur main avant la fusion).
- **Demande de déploiement envoyée** à la session « Serveur JARVIS » le 27/11 à 8 h 25 (un seul oui : étapes communes, puis les sections 1 à 4 de `docs/demandes-serveur-en-attente.md`, plus deux relevés : appels d'outil mal formés d'Hermes, retard du réveil du 26/11). Son compte rendu se lit par `list_events` (kinds `result`). Tant qu'il n'est pas arrivé : ne rien renvoyer à cette session, ne pas lancer de travail lourd (le forfait est partagé ; CRA de la semaine à midi).
- Ensuite, dans l'ordre : lire le compte rendu, mettre `CLAUDE.md` et les docs à jour ; reprendre E (`chantier-E.patch`, ou l'agent a93cbe731fb974b72 s'il existe encore dans la session), puis C (`chantier-C.patch`, agent a7f6dfadf7db8f13d) ; seconde demande au serveur ; maquettes ; dépôt du CRA signé par Hermes.

## État au 27/11/2026, 8 h 45

- **Déployé et vérifié sur le serveur à 8 h 22** (0.94.0) : compte rendu dans `docs/jarvis-os.md`, « Déploiement du 27/11/2026 ». Plus rien en attente côté serveur.
- Session du serveur : désormais « Serveur JARVIS 2 » (`session_01JvDfwzJbpLqSKJPKSk65Mq`).
- **Limite de la semaine en alerte** (remise à zéro lundi 30/11 à 12 h, heure de Paris) : avant de lancer E, C, les maquettes ou le dépôt du CRA signé, lui demander par QCM ce qui passe d'abord et ce qui attend lundi.
