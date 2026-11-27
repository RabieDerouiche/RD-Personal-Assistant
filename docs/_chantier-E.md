# Chantier E : « 0.93.0 : trois retours de l'app »

Note de passage pour le coordinateur (26 et 27/11/2026). Rien ici n'est encore dans `docs/jarvis-os.md` ni dans la constante `VERSION`
(la branche est à `0.94.0` ; ce chantier s'appelle « 0.93.0 » dans le code et les bancs : le numéro de la mise à jour qui le porte est à
choisir à la fusion). Aucune donnée personnelle ni montant réel dans ce chantier (exemples inventés).

## 1. Entrée de journal pour `docs/jarvis-os.md`

- **0.93.0 (26/11/2026) : trois retours de l'app** (ses remarques du 26/11/2026 ; bloc « 0.93.0 : trois retours de l'app » en fin de script de l'app, le dernier avant `boot()`, après le bloc 0.94.0 ; rien n'est réécrit, le bloc range ce qui existe). *Argent, « Déjà dépensé ce mois »* : à côté du reste à payer (une ligne sous « Déjà prélevé » dans la grande carte, qui ouvre « Le mois ») et du reste à vivre (une carte dans « Le mois »), le total de ce qui est déjà parti ce mois-ci, avec le détail : ses dépenses fixes dont le jour est passé (jusqu'à hier : celles d'aujourd'hui sont encore dans le reste à payer, les deux font le mois entier ; une dépense qui commence plus tard, finie ou retirée de sa liste ne compte pas ; la facture du mois et le montant du mois d'un contrat sont pris), les échéances passées de ses paiements en plusieurs fois (ou qu'un mail dit payées ; un paiement « plus à payer » ne compte pas du tout), et ce qu'il a noté de ses dépenses courantes (une dépense « une fois par mois » cochée « Fait ce mois-ci » sans note compte pour son montant prévu) ; « Le détail (N) » donne une ligne par dépense. *Historique mois par mois* : à la fin de chaque mois (le premier tic du mois suivant, à minuit de Paris ; sinon le premier calcul si le serveur était arrêté), le Radar garde le bilan du mois clos dans `radar.json` (`historique.mois`, 36 mois, donc 24 au moins) : dépenses fixes payées, échéances, dépenses courantes notées, par poste, le budget des dépenses courantes retenu au fil de l'eau (0.81.0), le reste à vivre s'il avait donné sa paie, la date de clôture ; un mois clos ne bouge plus quand ses dépenses fixes ou sa paie changent ; un mois rattrapé après un arrêt de plusieurs mois est dit « reconstitué ». Dans « Le mois », « Historique » remplace « Six derniers mois » (qui n'est pas doublé : les six mois lisent le bilan gardé quand il existe) : le mois en cours en tête (en direct), puis les mois du plus récent au plus ancien (12 affichés, « Tous les mois » pour le reste), un mois s'ouvre sur son détail ; tant qu'ils ne sont pas gardés, les cinq mois d'avant restent estimés d'après ses dépenses fixes d'aujourd'hui (« ≈ »), comme avant. **Données** : sur son serveur seulement (`radar.json`, 600) ; jamais dans Pilotage, la mémoire, le serveur MCP, le Journal ni la copie chiffrée de Pilotage ; la clôture n'envoie aucune notification et n'écrit rien au journal ; la notification de la veille ne porte ni « déjà dépensé » ni un montant de l'historique. Un fichier d'avant est relu tel quel : l'historique s'ajoute seul, rien n'est perdu ; un mois dont le budget avait déjà été retenu est clos « reconstitué ». Code : `depenseEntre`, `HISTO_MOIS`, `bilanDe`, `cloturer`, `moisDe` (`radar.mjs` ; la page reçoit `mois.depense` et `mois.historique`) ; `radDepense`, `radHisto`, `radHistDetail` (page). *Agenda, Grok arrêté* (interrupteur `GOFF.on` ; avant, rien ne change) : la feuille d'un jour montre l'avatar de JARVIS (plus Chronos), « Écrire à Hermes » (une ligne `Pour = Hermes` dans le Canal, le sujet de la fiche dans le message et dans l'Objet, sans sonnette ; plus « Écrire à Chronos par le Canal ») et « Voir Travail » pour le CRA et les notes de frais ; à côté de chaque ligne, « Hermes », « Hermes suit » (ce que suivait Kairos), « Hermes · voir Travail » (ce que faisait Chronos) ; la fiche d'une échéance prend l'avatar d'Hermes, « Suivi par : Hermes » (« Hermes suit », « Hermes, sur le portail (espace Travail) »), perd « Confier à un autre bot », et pour le CRA met « Voir Travail » en action principale ; la fiche d'un événement ou d'un anniversaire prend l'avatar de JARVIS ; « Un bot s'en occupe » et « Un bot suit » deviennent « Hermes s'en occupe » et « Hermes suit » ; la légende dit « Fait par Hermes » avec une seule ligne à la place des sept bots (son filtre surligne les jours) ; une action sans ordre ne fait plus parler le bot d'avant (« Chronos en tient compte » devient « Hermes en tient compte pour le CRA (espace Travail) », les rappels sont ceux de JARVIS) ; l'historique garde le nom d'origine (« Fait par Chronos »). Les autres fiches qui proposaient « Écrire à <bot> par le Canal » (dossier, papier, prix, tâche, voyage, sortie) proposent aussi « Écrire à Hermes ». Constat : dans 0.87.0, « Écrire à <bot> » n'était jamais remplacé (la règle commence par « É », que `\b` ne voit pas comme une lettre) ; ce bloc le fait à la source. *Pour moi, une seule carte par sujet* : un sujet = un dossier encore ouvert de Pilotage (qu'il attende sa réponse ou celle de quelqu'un d'autre) ; sa carte porte le nom du dossier, montre l'élément le plus urgent (avec ses réponses) et range dessous, sous « Aussi dans ce sujet », la demande du dossier, les demandes venues du Canal, un brouillon Gmail sans carte, la réponse reçue et les échéances ; la plus urgente décide de la place (« À décider » ou « À faire ») et de la couleur (la pastille dit l'échéance la plus proche) ; chaque ligne ouvre la feuille de l'élément, avec ses actions ; la feuille d'une demande liste aussi le reste du sujet ; une notification `#voir-<ligne>` ouvre toujours le bon élément (la demande que porte la ligne, avant celle du dossier nommé dans son Objet : `voirLigne`) ; « Traiter une par une » passe chaque élément un à un ; la ligne de Travail du bloc 0.94.0 (« CRA signé reçu : à rattacher · … ») reste une ligne à part. Le compte « pour toi » (en-tête, pastille, accueil) compte les sujets ; un filtre compte ce qu'il montre (règle 0.73.0, inchangée). **La règle**, dans cet ordre, deux dossiers possibles = aucun : (1) lien explicite : l'Objet de la ligne du Canal, le libellé, ou un nom entre « » ou entre parenthèses est le nom d'un dossier (sans casse, accents ni ponctuation ; avec ou sans la parenthèse du dossier ; dans un message, seulement entre « ») ; (2) un nom raccourci entre parenthèses dont tous les mots significatifs sont dans le nom d'un seul dossier (deux mots, ou un seul d'au moins 6 lettres) ; (3) rapprochement prudent : tous les mots significatifs du nom du dossier (sans sa parenthèse) sont dans le libellé, deux mots au moins dont un d'au moins 5 lettres ; aux niveaux 2 et 3, si les deux portent des nombres (des dates), ceux de l'un doivent tous être dans l'autre. Mot significatif : 3 lettres au moins, pas un nombre, ni un mot vide, ni un mot trop commun des suivis (dossier, relance, rappel, demande, réponse…). Sans dossier, deux demandes ne se réunissent que par le même Objet ou le même libellé. Jamais réunis : un « oui » dans le chat d'un bot, les cartes du CRA et des notes de frais, les brouillons des mails du mois pour le travail. Rien n'est retiré des données : pendant l'affichage de « Pour moi » et de l'accueil, la liste ne garde qu'un élément par sujet. Maquette : `__SCEN.sujets`. Bancs : `radar.test.mjs` 158 (14 nouvelles), `radar-courantes.test.mjs` 21 (3 nouvelles, dont la preuve de bout en bout : tous les outils du serveur MCP en profil exécutant, la mémoire, l'état de l'app et les autres fichiers du serveur ne portent aucun montant du Radar), `fiab-a3.test.mjs` 28 (inchangé), maquette 391 OK (30 nouvelles) et les 3 échecs liés à la date du jour, inchangés.

## 2. Sur le serveur après déploiement

Rien d'autre que `git pull` et le redémarrage du service. Pas de migration à lancer : au premier calcul, `radar.json` reçoit seul la clé
`historique` (`{mois: {}, suivi: "AAAA-MM"}`) ; toutes les autres clés sont relues telles quelles (vérifié au banc : dépenses fixes, dépenses
courantes et leurs notes, paie, budgets retenus, paiements en plusieurs fois, refus, alertes vues). Aucun hôte, aucune variable, aucun droit
nouveau.

Contrôles en lecture seule (aucun n'affiche un montant : ne pas faire afficher le contenu de `radar.json` dans la session du serveur) :

- droits du fichier : `stat -c '%a' ~/.jarvis/radar.json` → `600` ;
- l'historique est en place, sans montant à l'écran :
  `python3 -c "import json,os;h=json.load(open(os.path.expanduser('~/.jarvis/radar.json'))).get('historique') or {};print(h.get('suivi'), sorted((h.get('mois') or {}).keys()))"`
  → le mois en cours, puis la liste des mois gardés (vide jusqu'au 1er décembre, ou les mois d'avant dont le budget avait été retenu) ;
  (le chemin du dossier de données est celui de `JARVIS_DATA` s'il est défini) ;
- journal du service depuis le redémarrage : aucune ligne « radar : radar.json illisible », « radar.json non enregistré » ni « tic impossible » ;
- le 1er décembre après minuit (heure de Paris) : la même commande montre `2026-11` dans les mois gardés, et aucune notification n'est partie pour cela.

Retour arrière : revenir au commit d'avant et redémarrer. Le serveur d'avant ignore la clé `historique` (il la garde dans le fichier sans
la lire) et reprend ses « six mois » ; rien à défaire dans `radar.json`. L'app d'avant ne lit ni `mois.depense` ni `mois.historique`.
Dans l'autre sens, l'app 0.93.0 devant un serveur d'avant garde « Six derniers mois » et ne montre pas « Déjà dépensé ».

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
