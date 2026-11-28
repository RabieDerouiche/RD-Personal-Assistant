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

## État au 27/11/2026, 10 h 40

- **main = `6b118fe` (demande 252) : JARVIS 0.95.0**, avec les quatre chantiers (0.91.0 papiers, 0.92.0 routines en direct, 0.93.0 Radar/Agenda/« Pour moi », 0.94.0 réponses aux mails). Les sauvegardes `chantier-*.patch` sont retirées (tout est fusionné). Suites et risques : `suite-mails.md`, `suite-routines.md`, `suite-papiers.md`, `suite-radar-pour-moi.md`.
- **Serveur** : il est en 0.94.0 (déployé le 27/11 à 8 h 22). La 0.95.0 n'y est pas encore : elle n'a besoin que de la mise à jour et du redémarrage (le bouton « Mettre à jour » de l'app suffit) ; le plan de contrôle est dans `docs/demandes-serveur-en-attente.md`. **Ne pas l'envoyer seul** : sa consigne du 27/11 est de tout finir puis de lui donner UNE fois ce qu'il a à faire ; la demande au serveur partira avec le chantier 0.96.0 (qui a besoin de `install.sh` d'Hermes), à « Serveur JARVIS 2 » (`session_01JvDfwzJbpLqSKJPKSk65Mq`).
- **En cours : 0.96.0, administrer les routines d'Hermes depuis JARVIS** (sa demande du 27/11 : lancer maintenant, pause jusqu'à nouvel ordre, reprendre, changer l'horaire — jours et 1 à 4 heures, sans espacement minimal —, historique, erreur en détail). Un agent en worktree, lancé à 10 h 25 ; à son retour : relire (validation des ordres, nettoyage de l'erreur), fusionner, bancs, pousser.
- **Ordre de la suite (ses consignes du 27/11)** : 1. 0.96.0 ; 2. les trois maquettes de refonte, avec toutes les nouveautés dedans (dépôt des papiers, réponses aux mails et CRA signé, routines en direct et leur administration, Radar, « Pour moi » par sujet) ; 3. dépôt du CRA signé par Hermes ; 4. un seul récapitulatif final : ce qui a changé, les nouveautés, ce qu'il doit faire.
- **Reprise automatique (sa demande du 27/11)** : garder un réveil programmé (`send_later`) cinq minutes après la prochaine levée probable de la fenêtre de 5 heures tant qu'il reste du travail ; au réveil, reprendre sans lui demander.
- Banc connu : `fiab-a6.test.mjs` a 2 échecs déjà présents avant ces chantiers (rappels du matin) : à regarder, sans rapport avec eux.

## État au 27/11/2026, 13 h

- **Branche à `0d240e3` : JARVIS 0.96.0** (administrer les routines d'Hermes, fusionné, docs rangées, plan du serveur à jour dans `docs/demandes-serveur-en-attente.md`). Pas encore dans main : ses bancs sur l'ensemble repassent (journaux : `scratchpad/h/`, résultat dans `scratchpad/h/resultat.txt`). main est à `6b118fe` (0.95.0). Le serveur est en 0.94.0.
- **Maquettes de refonte : finies** (A « Orbite », B « Poste de contrôle », C « Le fil »), commitées, servies à `/maquettes/refonte-a|b|c/` après la prochaine mise à jour du serveur. 21 captures finales : `scratchpad/refonte/final/`. Elles ne lui sont pas encore envoyées : il veut tout à la fin.
- **En cours : 0.97.0, dépôt du CRA signé sur le portail par Hermes après son oui** (un agent en worktree, lancé à 12 h 55 ; note attendue : `docs/_chantier-G.md`). Limite : ne sera « fini » qu'après un essai à blanc sur le vrai portail (par la session du serveur) et sa validation la première fois.
- **Ensuite** : fusionner 0.97.0, bancs, PR vers main, UNE demande à « Serveur JARVIS 2 » (0.95.0, 0.96.0, 0.97.0 : mise à jour, redémarrage, les deux `install.sh`, contrôles, essai pause/reprise d'une routine, essai à blanc du dépôt), lire son compte rendu, puis le récapitulatif final unique avec les captures et un QCM de choix de maquette.
- Limite de la 0.96.0 à lui dire : une routine n'a qu'un horaire technique (passages à la même minute ou à la même heure) ; la lever = plusieurs tâches par routine côté Hermes.

## État au 27/11/2026, 16 h 45

- **main = `6722569` (demande 253) : JARVIS 0.96.0.** Bancs passés seuls après fusion : serveur 427, administration 46, ordres 117, relance 88, verrou 45, dépôt 42, pont 24, garde 25, routines 6, bout en bout 136, app 430 (et les 3 échecs liés à la date).
- **Demande de déploiement envoyée à « Serveur JARVIS 2 » à 16 h 40** (0.95.0 et 0.96.0 ; le plan est `docs/demandes-serveur-en-attente.md`, lu là-bas par `git show origin/main:…`). Le serveur était en 0.94.0. Lire son compte rendu par `list_events` (kinds `result`) avant de dire que c'est déployé. Cette session attend son oui là-bas (mode par défaut : il doit approuver).
- **0.97.0 (dépôt du CRA signé par Hermes)** : coupé par la limite à 15 h, relancé à 16 h 35 ; côté JARVIS écrit (`signe.mjs`, tests en cours), root, app et bancs à faire. Sauvegarde : `chantier-G.patch` (s'applique sur `0d240e3`). Une seconde demande au serveur suivra pour lui (avec l'essai à blanc réel du dépôt pour novembre).
- Réveil programmé à 21 h 15.

## État au 27/11/2026, 18 h 50

- **0.96.0 (avec la 0.95.0) : déployée et vérifiée sur le serveur à 16 h 45** par « Serveur JARVIS 2 » (compte rendu recopié dans `docs/jarvis-os.md`). Essai réel pause puis reprise d'une routine : conforme.
- **0.97.0 (CRA signé déposé par Hermes après son oui)** : l'agent a rendu, relu par la session principale (une garde ajoutée : « déposé » compté seulement sans négation ; une course du banc de l'app corrigée), fusionné dans la branche avec `VERSION` 0.97.0, docs rangées par script, plan du serveur réécrit (`docs/demandes-serveur-en-attente.md` : 0.97.0 seule, avec l'essai à blanc réel de novembre). Bancs en cours au moment de ce commit : résultat dans `scratchpad/g/resultat.txt` (jours, travail, serveur déjà passés sans échec ; portail, relance, app à lire).
- **Ensuite** : bancs verts → demande de fusion vers main → message à « Serveur JARVIS 2 » (un seul oui là-bas) → récapitulatif final unique avec les 21 captures (`scratchpad/refonte/final/`) et un QCM de choix de maquette.
- Risques et ce qu'il verra : `suite-cra-signe.md`.

## État au 27/11/2026, 20 h

- **Deux demandes de lui dans la soirée, traitées** : (1) le CRA signé doit être comparé à la saisie puis déposé sans attendre s'il correspond → **0.98.0** (`signe-controle.mjs`, sans IA ; vérifié sur le vrai PDF de novembre, hors dépôt : conforme ; oui automatique seulement après un premier dépôt réussi par Hermes) ; (2) le CRA de la semaine du 23/11 : « enregistrée, pas soumise » → cause lue sur la page par « Serveur JARVIS 2 » en lecture seule (le code de temps, une liste déroulante, n'était pas réellement choisi), **skill corrigée**.
- Branche : `VERSION` 0.98.0, docs et plan du serveur à jour (`docs/demandes-serveur-en-attente.md` : 0.97.0 + 0.98.0 + skill, avec l'essai à blanc réel du dépôt pour novembre). Bancs : jours 143, travail 40, app 442 OK (les 3 échecs liés à la date) ; serveur, portail et relance repassent (`scratchpad/g/resultat3.txt`).
- **Ensuite** : bancs verts → demande de fusion vers main → UN message à « Serveur JARVIS 2 » (il donne son oui là-bas) → il touche « Relancer Hermes » sur la carte du CRA de la semaine → lire le compte rendu → récapitulatif final unique avec les 21 captures et le QCM de choix de maquette.
- Pas fait : le faux portail du banc n'a pas de liste de code de temps (la correction de la skill n'est pas prouvée au banc) ; les maquettes ne montrent pas le verdict « conforme à la saisie » (elles montrent « Oui, déposer »).

## État au 27/11/2026, 22 h 45

- **main = `011b06c` (demande 254) : JARVIS 0.98.0.** Bancs : jours 143, travail 40, serveur 434 (seul), portail 214, relance 88, app 442 OK et les 3 échecs liés à la date.
- **Demande envoyée à « Serveur JARVIS 2 » à 22 h 45** (plan : `docs/demandes-serveur-en-attente.md`, lu là-bas par `git show origin/main:…`) : elle attend son oui. Le serveur est en 0.96.0 tant que son compte rendu n'est pas lu (`list_events`, kinds `result`).
- **À lui** : son oui dans « Serveur JARVIS 2 » ; puis « Relancer Hermes » sur la carte du CRA de la semaine ; puis « Oui, déposer » quand JARVIS annonce le CRA signé prêt (premier dépôt : il vérifie sur le portail) ; le choix d'une maquette (QCM posé avec le récapitulatif final).
- **Ensuite, pour la session** : lire le compte rendu du serveur (essai à blanc du dépôt : relevés d et e — où se dépose le fichier, autre hôte ou non), ajuster la skill si besoin, mettre `CLAUDE.md` et `docs/jarvis-os.md` à jour (« déployé »), vider `docs/demandes-serveur-en-attente.md`, fusion dans main. Puis appliquer la maquette choisie.

## État au 27/11/2026, 23 h 15

- **Son QCM du soir** : aucune maquette (« je préfère l'IHM actuelle » ; seule la pile de cartes « Attend ton oui » de la maquette A l'intéresse pour « Pour moi ») ; horaires des routines : laisser ; Radar : « Compter le déjà payé ».
- **0.99.0 sur la branche, PAS dans main** : Radar (un paiement « plus à payer » garde ses échéances déjà payées ; `plansRetiresLe`), `VERSION` 0.99.0, docs. **Ne pas fusionner dans main avant le compte rendu de « Serveur JARVIS 2 »** : son plan attend le commit `011b06c` et la version 0.98.0 ; une fusion avant fausserait ses contrôles. Après son compte rendu : demande de fusion, puis il touche « Mettre à jour » dans JARVIS (rien d'autre : pas de changement côté root).
- Question posée par QCM : porter la pile « Attend ton oui » de A dans « Pour moi » de l'app actuelle ? retirer les trois maquettes du serveur ?

## État au 27/11/2026, 23 h 45

- Son second QCM : « Montre-moi d'abord » (la pile) et « Tout retirer » (les maquettes). Fait sur la branche (toujours 0.99.0, pas dans main) : maquettes `refonte-a|b|c` retirées de `MAQUETTES` ; **essai de la pile dans l'app derrière `?pile=1`** (bloc « ESSAI pile », fin du script de `essais/jarvis-os-maquette/index.html`) ; trois captures envoyées (`scratchpad/pile/`, script `cap.cjs`). Après « Mettre à jour », il peut l'essayer sur ses vraies données : adresse du serveur + `/?pile=1`.
- En attente de lui : son avis sur la pile (l'activer pour de bon = retirer la condition `?pile=1` et ajouter des vérifications au banc ; l'abandonner = retirer le bloc).
- **Travailler dans la copie principale** (`/home/user/RD-Personal-Assistant`) : la copie de travail de l'agent (`.claude/worktrees/agent-a87e…`) est dépassée, ne plus s'en servir.
- Bancs repassés avant la fusion de la 0.99.0 : voir `scratchpad/g/resultat4.txt` (serveur, Radar, app).

## État au 28/11/2026, 0 h

- **0.98.0 déployée et vérifiée à 22 h 52** (compte rendu de « Serveur JARVIS 2 » recopié dans `docs/jarvis-os.md`). Essai à blanc réel du dépôt du CRA signé : « pret », PDF conforme à la saisie. Il a donc reçu « CRA signé prêt à déposer : ton oui ».
- Vu à l'essai : le champ de fichier n'apparaît qu'après un bouton d'import → skill ajustée (étape 5 du dépôt) ; texte du compte rendu coupé au milieu d'un mot → corrigé. Les deux sont sur la branche (0.99.0), pas encore sur le serveur.
- **Suite** : bancs (`scratchpad/g/resultat4.txt`, puis le banc du portail) → demande de fusion de la 0.99.0 → UN message à « Serveur JARVIS 2 » (plan : `docs/demandes-serveur-en-attente.md`, pull + redémarrage + `install.sh` du portail) → lire son compte rendu, dont ses deux gestes (« Relancer Hermes » pour la semaine, « Oui, déposer » pour le CRA signé).

## État au 28/11/2026, 0 h 30

- **Radar** (sa remarque : « déjà dépensé » ne prenait pas les dépenses courantes dépensées chaque semaine) : corrigé sur la branche (un budget pas noté compte pour ce qui est écoulé, d'après le budget ; `courantesBudget`), banc du Radar 158.
- **Essai « accès »** (sa demande : plus de tuiles vers Travail, Routines, Papiers…, sobre, et Réglages) : bloc derrière `?acces=1`, capture envoyée (`scratchpad/pile/4-acces-tuiles.png`). Avec la pile (`?pile=1`), deux essais attendent son avis (QCM posé).
- **CRA de la semaine** : il voit encore l'erreur parce qu'il n'a pas touché « Relancer Hermes » (rien ne repart seul) : redit. À regarder au prochain compte rendu du serveur.
- Bancs de la 0.99.0 en cours : `scratchpad/g/resultat5.txt` (serveur 434 passé ; portail, app). Ensuite : fusion dans main, message à « Serveur JARVIS 2 » (plan déjà écrit : `docs/demandes-serveur-en-attente.md`).

## État au 28/11/2026, 1 h

- **Pile « Attend ton oui » : dans l'app** (son oui au QCM), avec cinq vérifications au banc ; banc complet de l'app en cours (`scratchpad/g/resultat6.txt`).
- **Accueil** : trois essais refusés (icônes ; tuiles sous le globe en argent ; tuiles autour d'un globe recoloré : « du recoloriage, ce que je déteste le plus »), retirés du code. **À faire, sans se presser** : plusieurs propositions qui repensent l'ORGANISATION de l'accueil, dans la charte actuelle (aucune teinte changée) : maquettes et captures d'abord. Ce qu'il veut : des tuiles qui disent quelque chose et mènent aux blocs (Travail, Routines, Papiers…), autour du globe ; Réglages accessible ; un globe qui évolue (par exemple : ce qu'il représente, pas sa couleur).
- **Ordre** : 1. banc de l'app vert → demande de fusion de la 0.99.0 → message à « Serveur JARVIS 2 » (plan déjà écrit) ; 2. les propositions d'accueil.

## État au 28/11/2026, 2 h

- **main = `710f1f0` (demande 255) : JARVIS 0.99.0** (Radar : « déjà dépensé » avec les dépenses courantes pas notées, « plus à payer » garde le déjà payé ; pile « Attend ton oui » dans l'app ; skill du dépôt du CRA signé ; maquettes de refonte retirées). Bancs : Radar 158, serveur 434, portail 214, relance 88, app 447 OK (3 échecs liés à la date).
- **Demande envoyée à « Serveur JARVIS 2 »** (plan : `docs/demandes-serveur-en-attente.md` ; pull, redémarrage, `install.sh` du portail) : elle attend son oui. Lire son compte rendu (`list_events`, kinds `result`), dont ses deux gestes (« Relancer Hermes » pour la semaine, « Oui, déposer » pour le CRA signé) ; puis vider le plan et noter « déployé » dans `CLAUDE.md`.
- **Accueil** : essai « les portes autour du globe » derrière `?accueil=1` (dernier bloc du script) ; il a choisi cette direction et la fait peaufiner (détail et ses mots : `docs/journal-jarvis.md`, dernière entrée). Méthode : une capture (`scratchpad/pile/cap.cjs`), son avis par QCM, on recommence. Quand il dit oui : retirer la condition, vérifications au banc.
- À lui : son oui sur le serveur ; « Relancer Hermes » ; puis « Oui, déposer » après la mise à jour.

## État au 28/11/2026, 3 h

- **Accueil** : il a validé la piste « orbite » (« tu y es presque ») : six hologrammes qui tournent autour du globe, qu'on fait tourner du doigt (`?accueil=1`). Reste **le globe lui-même** : quatre essais (`&globe=a|b|c|d` : Particules, Méridiens, Iris, Plasma), film comparatif envoyé, QCM posé. Quand il a choisi : retirer les conditions `?accueil=1` et `globe=`, garder un seul globe, vérifications au banc (orbite : rotation, glisser, appui ; « réduire les animations »), journal, fusion, « Mettre à jour ».
- **Serveur** : la demande de la 0.99.0 (`710f1f0`) attend son oui dans « Serveur JARVIS 2 » ; lire le compte rendu (`list_events`, kinds `result`) avant d'en parler comme d'un fait ; puis vider `docs/demandes-serveur-en-attente.md`.
- Outils des captures et des films : `scratchpad/pile/cap.cjs`, `film.cjs`, `film2.cjs` (à réécrire si le dossier temporaire a disparu : un serveur de fichiers local, Playwright en iPhone 15 Pro Max, `recordVideo`, puis `ffmpeg` vers MP4).

## État au 28/11/2026, 4 h 30

- **0.99.0 déployée et vérifiée (1 h 03)**. `docs/demandes-serveur-en-attente.md` est vide.
- **CRA signé de novembre : premier dépôt réel en échec** (il a touché « Oui, déposer » le 27/11 vers 23 h 10) : fichier joint, « Enregistrer » cliqué sans erreur, ligne restée « non signé ». À lui de regarder le portail ; puis « C'est rattaché » (s'il y est) ou « Réessayer avec Hermes » (un nouveau oui = une nouvelle tentative). Selon ce qu'il voit : ajuster la skill du dépôt (attendre la fermeture de la fenêtre ou un message avant de relire), ce qui demandera un plan pour « Serveur JARVIS 2 ».
- **CRA de la semaine du 23/11 : toujours pas relancé par lui** (« Relancer Hermes » dans Pour moi). La skill corrigée est en place depuis le 27/11 à 22 h 52.
- **0.100.0 sur la branche** : l'accueil en orbite et le globe de particules, actifs par défaut ; l'accueil d'avant gardé (`?accueil=ancien`). Banc de l'app et du serveur en cours (`scratchpad/g/resultat7.txt`). Ensuite : demande de fusion, fusion, puis il touche « Mettre à jour » (rien côté root).

