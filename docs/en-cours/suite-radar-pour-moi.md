# Suite du chantier 0.93.0 (Radar, Agenda, « Pour moi ») : ce qu'il verra, bancs, ce qui n'est pas testé, risques

## 3. Ce qu'il verra

- **Argent** : dans la grande carte, sous « Déjà prélevé depuis… », « Déjà dépensé en novembre : … › » ; dans « Le mois », une carte
  « Déjà dépensé en novembre » (le total, « soit … de dépenses fixes déjà passées (N) … et … de dépenses courantes notées (M) », « Le
  détail »), puis « Historique » : novembre « en cours », et les cinq mois d'avant marqués « ≈ » (estimés) ; à partir du 1er décembre,
  novembre apparaît « gardé » (« Bilan gardé le 01/12/2026 : il ne change plus »), et ainsi de suite chaque mois.
- **Agenda** (Grok arrêté) : en touchant un jour, l'avatar de JARVIS, « Écrire à Hermes », « Voir Travail » ; plus de Chronos ni de Kairos
  (« Hermes suit », « Hermes · voir Travail ») ; la légende dit « Fait par Hermes ».
- **Pour moi** : une carte par sujet, au nom du dossier, avec « Aussi dans ce sujet · N » ; la pastille de l'onglet baisse d'autant.
  Sur ses données du jour, voir le point 5 : l'effet dépend de ce qui fait aujourd'hui ses cartes en double.

## 4. Bancs, avant et après

| Banc | Avant | Après |
|---|---|---|
| `radar.test.mjs` | 144 (la consigne disait 131) | 158 |
| `radar-courantes.test.mjs` (Chromium, vrai serveur) | 18 | 21 |
| `fiab-a3.test.mjs` | 28 | 28 |
| `server.test.mjs` | 404 (référence) | non lancé : `server.mjs` n'est pas touché |
| `essais/jarvis-os-maquette/banc/banc.cjs` | 361 OK, 3 échecs liés à la date du jour (référence du 27/11 sur la branche) | 391 OK, les 3 mêmes échecs liés à la date. Mesuré le 27/11 : 392 OK et 2 échecs, avec une correction du rendez-vous à J+6 que j'ai retirée ensuite (consigne : ne pas corriger) ; cette vérification, relancée seule sur le fichier commité, échoue comme sur la branche |
| `banc-serveur.mjs` | non lancé (au coordinateur) | relu : il ne s'appuie sur aucun affichage changé (`.rad-big` de la grande carte, pas de compte de cartes de Pour moi, pas de « six mois ») |

## 5. Ce qui n'a pas pu être testé, et les risques

- **La règle de rapprochement sur ses vraies données** (deviné à probable). Pour lui donner sa forme, la structure de Pilotage a été lue
  une fois, en lecture seule, par `jarvis_pilotage_lire` (À toi, Dossiers, Échéances, Canal) ; rien n'en est recopié ici ni dans les
  bancs. Ce que cette lecture montre, en termes généraux : (certain) ses dossiers qui attendent sa réponse ont chacun une seule ligne
  « À toi » ; les échéances citent souvent le dossier par un nom raccourci entre parenthèses, d'où le niveau 2 de la règle ; plusieurs
  dossiers partagent leur mot principal (même nom à une parenthèse près, plusieurs « fermeture de… ») : ils restent séparés (vérifié au
  banc sur des noms inventés de même forme). (Probable) ses cartes en double viennent surtout des brouillons Gmail sans carte et des
  réponses reçues sur un dossier, que l'app ne peut pas montrer ici : c'est pourquoi le bloc range dans le sujet ces cartes qui
  existent déjà dans « Pour moi » (il n'en crée aucune ; les brouillons des mails du mois pour le travail, CRA et prolongation, sont
  laissés à leur carte de Travail). (Deviné) un
  brouillon n'est rattaché que si son objet, ou son objet et les 300 premiers caractères de son texte, portent tous les mots du nom du
  dossier : un brouillon dont l'objet ne dit pas le sujet restera une carte à part ; à l'inverse, un brouillon sur un autre sujet qui
  cite tous les mots d'un dossier irait dans sa carte (il y reste visible, en ligne, avec sa feuille).
- **Un mauvais rapprochement** (risque faible, certain dans son effet) : l'élément n'est pas perdu, il devient une ligne dans la carte
  d'un autre sujet et le compte baisse de un. Pour le défaire : changer le libellé dans Pilotage, ou retirer le mot en cause de la règle.
- **Les comptes du serveur** (certain) : le brief du matin, la voix (« Pour moi ») et tout ce que `server.mjs` compte lui-même comptent
  encore les éléments, pas les sujets : ils peuvent dire un nombre plus grand que la pastille de l'app. `server.mjs` était hors périmètre.
- **« Traiter une par une »** (certain, voulu) : chaque élément y passe ; son « 1 sur N » est plus grand que la pastille.
- **Accueil** (certain) : l'ordre « l'urgent d'abord » de « À faire maintenant » suit l'échéance de la demande en tête, pas celle d'une
  échéance rangée dans la carte.
- **Clôture d'un vrai mois** (probable) : testée avec une horloge simulée (tic de minuit, rattrapage, horloge qui recule, 40 mois), pas
  sur un vrai passage de mois du serveur. Le premier bilan réel sera celui de novembre, le 1er décembre : il compte tout novembre d'après
  sa liste du jour (une dépense fixe ajoutée le 25 compte pour son jour de novembre), et le reste à vivre prend la paie connue ce jour-là.
- **« Plus à payer »** (choix à confirmer) : un paiement en plusieurs fois dit « plus à payer » ne compte pas du tout dans « déjà
  dépensé », même ses échéances passées (la page dit « achat annulé, remboursé »). S'il s'en sert pour un achat soldé d'avance, ses
  échéances déjà payées manqueront au total.
- **iPhone réel** (non testé) : rendu dans Chromium en émulation iPhone seulement (les lignes de l'historique sont des `<details>` en grille).
- **Autres agents** : le bloc enveloppe `SHEETCFG.*` (sauf `ordre`, `bot`, `demande`, `note`, `travail`, `draft`), `finish`, `applySmart`,
  `dayItems`, `dayExtra`, `calendar`, `grokPause`, `radMois`, `radHero`, `pmCard`, `dosReplyCard`, `draftCard`, `voirLigne`, `pourMoiN`,
  `VIEWS.demandes`, `VIEWS.accueil`. Il est le dernier bloc avant `boot()`, après le bloc 0.94.0 : un bloc posé après lui qui remplacerait
  `VIEWS.demandes` sans passer par la version enveloppée ferait revenir les cartes en double. Il ne touche ni la page « Hermes et ses
  routines » (0.92.0), ni la ligne de Travail (0.94.0, vérifiée intacte au banc avec les sujets regroupés), ni Papiers › Déposer. `ecrireHermes` (0.86.0) est dans la portée de son bloc : le bloc 0.93.0 a sa
  propre copie (`ecrireHermes93`, avec le sujet de la fiche), sans toucher au bloc 0.86.0.
- **Preuve « ni MCP ni mémoire »** (certain pour ce qui est testé) : deux vérifications. Dans `radar.test.mjs`, le câblage : aucun autre
  module du serveur ne lit le Radar (seul son calendrier peut être importé), et `server.mjs` ne s'en sert que pour `/api/radar` et son
  minuteur ; elle échouera, à dessein, si quelqu'un branche le Radar ailleurs. Dans `radar-courantes.test.mjs`, de bout en bout sur le vrai
  serveur : un mois gardé et une paie « sentinelles », tous les outils MCP du profil exécutant appelés, la mémoire et l'état lus, les
  autres fichiers du dossier de données relus. Limite : les outils sont appelés sans argument (un outil qui ne répondrait qu'avec des
  arguments précis n'est couvert que par la vérification du câblage).

