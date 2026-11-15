# Journal des modifications de la page Jarvis

Tenu à la demande du propriétaire (15/11/2026) : **chaque modification de la page y est notée avant la fin de la session**, pour qu'une autre session ou l'autre compte reprenne là où l'on s'est arrêté, même si l'usage hebdomadaire est épuisé en cours de route. Ce journal, les instructions et le banc d'essai sont fusionnés dans `main` à chaque étape. Le code de la page n'est pas dans le dépôt (dépôt public) : la page publiée fait foi.

## Les pages

| Page | Lien | État |
|---|---|---|
| En service (v16), premier compte | `https://claude.ai/artifact/QwLf64Ggstzu4p3uznZrr8` | Ne pas toucher : aucun report dessus (décision du 15/11/2026) |
| Essai (v17.5), premier compte, partagée | `https://claude.ai/artifact/UDFVL3TQ2RUeYMq1JBtT4m` | En retard sur la copie : il lui manque les modifications notées « copie seulement » |
| Copie de travail (v17.8), second compte | `https://claude.ai/artifact/NMAqUak7A5JYsLsc12VyaZ` | C'est ici que l'on modifie et que le propriétaire valide |

## Où est le code de la page

- **Google Drive** (à la demande du propriétaire, 15/11/2026) : dossier `RD Assistant/Jarvis (sources de la page)` (`1LO_y3DbvXjQQtuSQPlQfbnMU5Mlyzz3X`), fichier `jarvis-page.html` (`1KM4NISDFckz0BVprZRNeRMvjbtQhwTcd`). C'est la source complète de la dernière version publiée sur la copie de travail. **Après chaque publication, remplace ce fichier** (outil Drive `update_file` ou, à défaut, `create_file` dans le même dossier ; contenu passé par référence de fichier `sha256:<empreinte>:<chemin absolu>`, sans recopier le texte) et note la version ici.
- Version déposée dans Drive : **v17.8** (15/11/2026, 477 617 octets).
- Pour reprendre depuis l'autre compte, du moins coûteux au plus coûteux : (1) le propriétaire partage la copie de travail avec ce compte, droit de modification, puis `Artifact` action `read` ; (2) télécharger `jarvis-page.html` depuis Drive dans un fichier local, sans l'afficher, puis le publier.
- Capacités à déclarer pour publier la page sur un compte qui ne l'a pas encore : `{"mcp": {"servers": [{"server": "Google Sheets", "tools": ["get_values", "append_values", "update_values"]}, {"server": "Google Calendar", "tools": ["list_events", "create_event", "update_event", "delete_event"]}, {"server": "Gmail", "tools": ["search_threads", "get_thread", "list_drafts", "send_message", "unlabel_thread", "delete_draft"]}, {"server": "Claude Code Remote", "tools": ["fire_trigger"]}]}, "sample": {}}`.
- Le reste (instructions, ce journal, banc d'essai) est dans `main`.

## Comment travailler

1. Modifier la copie de travail : petite retouche par `edits` sur la publication (aucune relecture si la session l'a publiée) ; sinon `Artifact` action `read`, puis republier avec `url`.
2. Tester soi-même avant de publier : `essais/jarvis/` (voir son README) sur le fichier modifié. Ajouter un scénario pour chaque fonction nouvelle.
3. Noter la modification ci-dessous (date, quoi, pourquoi, testé comment, reporté ou non sur la page d'essai), déposer la source dans Drive, fusionner dans `main`.
4. Questions au propriétaire : toujours en QCM.
5. Report sur la page d'essai du premier compte : une seule fois, quand le propriétaire a validé la copie ; le moins coûteux est de le faire depuis le premier compte.

## Modifications

### 15/11/2026 : v17.5 (page d'essai et copie)
Vérification complète, quatorze défauts corrigés, aucune fonction nouvelle. Détail dans `docs/systeme-grok-bot.md` (entrée v17.5). Testé au banc : tous les onglets, toutes les écritures, pause et reprise de Grok, sonnettes, hors liaison, écriture refusée. Publié sur la page d'essai (version 7) et sur la copie (version 1, titre « Jarvis v17 copie »).

### 15/11/2026 : v17.6, tâche Claude des deux comptes (copie seulement, à reporter)
- Pourquoi : la tâche « Ordres Jarvis » n'existait que sur le premier compte ; sur la copie, « Confier à la tâche Claude » échouait.
- Tâche créée sur le second compte à la demande du propriétaire : `trig_01T263zKge8mnGiu4vs2DGwL` (« Ordres Jarvis », sans horaire, une session neuve à chaque lancement). Son texte : lire les lignes `Pour = Claude` « À faire » du Canal, écrire seulement Réponse et Statut de ces lignes (et « Vérifié par Claude » de Déploiement), « En cours » si la demande exige une session complète, aucune action sortante. **Elle a été créée sans connecteur** (l'outil ne peut pas lui en donner sur ce compte) : le propriétaire doit lui ajouter Google Sheets dans les réglages de la tâche, sinon elle ne lit rien et le dit dans son compte rendu.
- Dans la page, trois retouches :
  1. dans `LV` : `TASK: 'trig_012M…'` devient `TASKS: ['trig_012M51J8A3NmbFgE36av8PR3', 'trig_01T263zKge8mnGiu4vs2DGwL']` ;
  2. dans `lvRing` : `await lvCall(LV.REMOTE, 'fire_trigger', {trigger_id: LV.TASK})` devient `await lvFireTask()` ;
  3. avant le bloc « démarrage », la fonction `lvFireTask()` : elle essaie chaque identifiant de `LV.TASKS` (d'abord celui de `localStorage['jarvis.tache']`), retient celui qui a marché, et relance la dernière erreur si aucun ne marche.
- Le même code sert donc sur les deux comptes : rien à changer au moment du report.
- Testé au banc : scénarios T1 (second compte : premier lancement essaie les deux, le suivant va droit au bon), T2 (premier compte), T3 (aucune tâche : « Claude non réveillé », dit clairement), puis tout le banc sans erreur. Non testé : un vrai lancement depuis l'iPhone.
- Publié sur la copie (version 2). Pas encore reporté sur la page d'essai.

### 15/11/2026 : v17.7, version visible et événement rouge direct (copie seulement, à reporter)
Choisies par le propriétaire en QCM (avec l'allègement, voir « À venir »).

**Version et état visibles**
- `const VERSION = '17.7'` juste avant `const LV = {` : à changer à chaque publication.
- Au bas de l'accueil (dans le `VIEWS.accueil` du module v17) : un paragraphe `.ver-foot` « Jarvis v17.7 · <titre de la page> · en direct | hors liaison » ; style `.ver-foot` ajouté après `.demo.is-bad`.
- Sans connecteurs (`LV.gave && !LV.mcp`) : bandeau `noLinkBanner()` en tête de l'accueil (« Pas de liaison avec tes données », les deux causes : hors de l'app Claude, ou autre compte que le propriétaire de la page ; bouton « Recharger la page ») ; la ligne d'état dit « Hors liaison : connecteurs non reçus » ; le bloc « démarrage » redessine la vue quand `mcp` est nul.
- Testé : scénarios E (hors liaison : bandeau, pied de page, aucun débordement) et V (en direct : pied de page, pas de bandeau).

**Événement rouge déplacé ou retiré directement dans l'agenda**
- Avant : « Déplacer » et « Retirer de mon agenda » écrivaient une ligne pour Iris (un passage de Grok).
- Les événements lus dans l'agenda gardent leur début et leur fin (`_s`, `_e`).
- `opEvMove(v, n)` : `update_event` avec `eventId`, `notificationLevel: 'NONE'` et, pour un événement avec heure, `startTime` en heure locale sans décalage (la durée est conservée par l'agenda) ; pour une journée, `allDay: true`, `startTime` et `endTime` à minuit, même nombre de jours.
- `opEvDrop(v)` : `delete_event` avec `eventId` et `notificationLevel: 'NONE'`, après la confirmation qui existait déjà.
- Dans `lvPlan`, juste après `const old = …` : pour `type === 'evenement'` avec `_id` et non annuel, « Événement déplacé » pousse `opEvMove` et change la date de la ligne Échéances liée (même titre, ou titre suivi de l'heure entre parenthèses, même date) ; « Événement retiré » pousse `opEvDrop` et passe cette ligne à « Annulé ».
- Un événement **annuel** reste confié à Iris (ligne du Canal) : y toucher depuis la page ne changerait qu'une seule année.
- Arguments vérifiés sur le schéma du connecteur Google Agenda (`update_event`, `delete_event`).
- Testé : scénario R (déplacer avec heure, déplacer une journée, retirer avec confirmation, annuel vers Iris), puis tout le banc sans erreur. Non testé : sur le vrai agenda.

Publié sur la copie (version 3). Pas encore reporté sur la page d'essai.

### 15/11/2026 : v17.8, liste « En cours chez tes bots » complète (copie seulement, à reporter)
- Signalé par le propriétaire : le bloc de l'accueil annonçait « 7 demandes » et n'en montrait que 5 (la liste était coupée à cinq sans le dire).
- Retouche dans le `VIEWS.accueil` du module v17 : la liste montre cinq lignes, puis un bouton « Voir les N autres » / « Réduire la liste » (`SEL.pendAll`, classe `.pend-more`).
- `VERSION` passe à `'17.8'`.
- Testé : scénario P (onze demandes : cinq lignes et « Voir les 6 autres », puis onze lignes), puis tout le banc sans erreur.
- Publié sur la copie (version 4) et déposé dans Drive.

### À venir

**Allègement de la page** (choisi par le propriétaire le 15/11/2026) : mesuré avant d'y toucher, rien n'a été retiré.
- Mesure (`COV=<dossier>` sur tout le banc, v17.7) : 26 % du script ne tourne jamais pendant les essais (104 Ko sur 403), mais l'essentiel est du code vivant que les essais ne parcourent pas (actions selon la nature d'une échéance, parcours de voyage, outils de la discussion). Le code vraiment mort, hérité de la maquette (rubriques « communes aux cinq maquettes », réponses simulées, `liveTick`), ne dépasse pas 15 à 25 Ko, soit 3 à 5 % de la page.
- Conclusion : retirer le code mort ne change presque rien au coût d'une session. Ce qui le changerait : découper la page en plusieurs fichiers publiés ensemble (styles, socle, écrans, liaison, v17), pour qu'une session ne lise que le fichier qu'elle modifie. Gros chantier (le script est une seule fonction : il faut en sortir les déclarations communes et vérifier les noms réservés du navigateur). Décision demandée au propriétaire en QCM le 15/11/2026.

**Voix** (demandée par le propriétaire le 15/11/2026 : poser une question à la voix, entendre la réponse, voir l'agent parler, discussion en direct). Ce que la plateforme permet :
- Capacités `tts` (voix de Claude) et `dictation` (parole vers texte) des pages : offertes sur ordinateur (app Claude, Chrome), **pas dans l'app iPhone ni Safari**. Sur iPhone : la dictée du clavier marche dans tout champ de texte ; la lecture à voix haute par la voix du téléphone (synthèse vocale du navigateur) est à essayer sur son iPhone, non vérifiée.
- Seul Claude répond en direct dans la page ; un bot Grok répond à son passage. « Parler à un bot » en direct = Claude qui répond à sa place d'après Pilotage, en le disant, et qui propose l'ordre pour le vrai bot.
- Pistes proposées en QCM : un essai de la voix sur iPhone d'abord ; bouton « Écouter » sur les réponses ; mode conversation plein écran (hologramme du bot animé pendant qu'il parle, sous-titres en direct, question dictée, réponse lue seule). Pas d'androïde 3D (déjà rejeté par le propriétaire).
