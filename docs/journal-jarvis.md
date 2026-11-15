# Journal des modifications de la page Jarvis

Tenu à la demande du propriétaire (15/11/2026) : **chaque modification de la page y est notée avant la fin de la session**, pour qu'une autre session ou l'autre compte reprenne là où l'on s'est arrêté, même si l'usage hebdomadaire est épuisé en cours de route. Ce journal, les instructions et le banc d'essai sont fusionnés dans `main` à chaque étape. Le code de la page n'est pas dans le dépôt (dépôt public) : la page publiée fait foi.

## Les pages

| Page | Lien | État |
|---|---|---|
| En service (v16), premier compte | `https://claude.ai/artifact/QwLf64Ggstzu4p3uznZrr8` | Ne pas toucher : aucun report dessus (décision du 15/11/2026) |
| Essai (v17.5), premier compte, partagée | `https://claude.ai/artifact/UDFVL3TQ2RUeYMq1JBtT4m` | En retard sur la copie : il lui manque les modifications notées « copie seulement » |
| Copie de travail (v17.11), second compte | `https://claude.ai/artifact/NMAqUak7A5JYsLsc12VyaZ` | C'est ici que l'on modifie et que le propriétaire valide |

## Où est le code de la page

- **Google Drive** (à la demande du propriétaire, 15/11/2026) : dossier `RD Assistant/Jarvis (sources de la page)` (`1LO_y3DbvXjQQtuSQPlQfbnMU5Mlyzz3X`). **Un fichier par version publiée**, nommé `jarvis-page-v<version>.html` : la source complète de la copie de travail. L'outil Drive ne sait pas remplacer le contenu d'un fichier : après chaque publication, crée un fichier neuf (`create_file`, `contentMimeType: text/html`, `disableConversionToGoogleType: true`, contenu passé par référence `sha256:<empreinte>:<chemin absolu>` dans `base64Content`, sans recopier le texte). Ne supprime pas les anciens sans le oui du propriétaire.
- Dernière version déposée : **v17.11** (`1x6BECa6OubYyU5DMJmkypbIh-3cm7TFZ`, 486 534 octets). Avant : v17.10 (`11FJKUO7xl_Tm-9wbhD_3S27tpgTrWtHD`), v17.9 (`14iF99wD98LHWIPpnXTznZaQgbfnpG8dY`), v17.8 (`1KM4NISDFckz0BVprZRNeRMvjbtQhwTcd`).
- Pour reprendre depuis l'autre compte, du moins coûteux au plus coûteux : (1) le propriétaire partage la copie de travail avec ce compte, droit de modification, puis `Artifact` action `read` ; (2) télécharger `jarvis-page.html` depuis Drive dans un fichier local, sans l'afficher, puis le publier.
- Capacités à déclarer pour publier la page sur un compte qui ne l'a pas encore : `{"mcp": {"servers": [{"server": "Google Sheets", "tools": ["get_values", "append_values", "update_values"]}, {"server": "Google Calendar", "tools": ["list_events", "create_event", "update_event", "delete_event"]}, {"server": "Gmail", "tools": ["search_threads", "get_thread", "list_drafts", "send_message", "unlabel_thread", "delete_draft"]}, {"server": "Claude Code Remote", "tools": ["fire_trigger"]}]}, "sample": {}, "tts": {}}`.
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

### 15/11/2026 : v17.9, essai de la voix (copie seulement, à reporter)
Choix du propriétaire en QCM : « essai sur iPhone d'abord » ; allègement : « laisser tel quel » ; report sur la page d'essai : « plus tard, après validation ».
- Bouton « Écouter » / « Arrêter » (`.vox-btn`, icône `sound`) sous chaque message de Claude dans la discussion, y compris son message d'accueil (l'essai ne coûte donc aucune question).
- Module `VOX` avant la fonction `lvFireTask` : `voxSpeak(m)` lit le texte nettoyé. D'abord la voix de Claude (capacité `tts`, ajoutée à la déclaration ; `speak(texte, {language: 'fr'})`, 2 000 caractères au plus) ; si elle est absente ou refusée, la voix du téléphone ou du navigateur (`speechSynthesis`, phrases regroupées par blocs de 220 caractères, voix française si elle existe). Un message dit quelle voix a servi, ou pourquoi rien ne sort (« Aucun son n'a démarré… » après 5 s, « Pas de voix disponible dans cette vue »). L'hologramme de la discussion s'anime pendant la lecture. Fermer la discussion coupe la voix.
- `VERSION` passe à `'17.9'`.
- Testé : scénarios X1 à X5 (voix de Claude, voix du téléphone, repli quand celle de Claude est refusée, voix muette, aucune voix), puis tout le banc sans erreur. **Non testé : le son réel**, ni sur iPhone ni sur ordinateur. La suite dépend de ce que le propriétaire entend sur son iPhone.
- Publié sur la copie (version 5), source déposée dans Drive.

### 15/11/2026 : v17.10, choix de la voix du téléphone (copie seulement, à reporter)
- **Résultat de l'essai v17.9 sur l'iPhone du propriétaire** : la voix sort bien (voix du téléphone), mais il la trouve « robotisée, sans personnalité ». La voix de Claude n'est pas offerte dans l'app iPhone. Une voix naturelle sur iPhone demanderait un service extérieur, que la page ne peut pas appeler.
- Son choix (QCM) : « choisir une meilleure voix ».
- Dans le module `VOX` : `voxList()` (voix françaises du téléphone, triées par qualité d'après `voiceURI` et le nom : premium, améliorée, standard, de base ; `fr-FR` avant les autres), `voxPick()` (la voix retenue dans `localStorage['jarvis.voix']`, sinon la meilleure), `voxPanel()` (sous « Rapide / Approfondi » dans la discussion avec Claude : bouton « Voix : <nom> · <qualité> » qui ouvre la liste ; toucher une voix la retient et lit une phrase d'essai ; rappel du chemin dans les réglages de l'iPhone pour télécharger une voix « améliorée » ou « premium »). Le panneau n'apparaît pas quand la voix de Claude est disponible. `voxPhone` lit avec la voix retenue et sa langue. Écoute de `voiceschanged` pour redessiner la discussion.
- `VERSION` passe à `'17.10'`.
- Testé : scénarios Y1 (trois voix : la premium par défaut, en choisir une autre, « Écouter » s'en sert), Y2 (seulement la voix de base), Y3 (voix de Claude : pas de panneau), capture d'écran à 390 px, puis tout le banc sans erreur. **Non vérifié** : que l'app iPhone montre à la page les voix « améliorées » ou « premium » téléchargées ; c'est l'essai suivant du propriétaire.
- Publié sur la copie (version 6), source déposée dans Drive.

### 15/11/2026 : v17.11, voix des réglages de l'iPhone par défaut (copie seulement, à reporter)
- **Retour du propriétaire sur la v17.10** : (1) les voix « premium » et « améliorée » qu'il a téléchargées n'apparaissent pas dans la liste : l'app iPhone ne montre à la page que les voix de base ; (2) il a entendu la voix avec un appareil audio Bluetooth, mais plus rien sur le haut-parleur du téléphone. Cause la plus probable du (2), non confirmée : le mode silencieux de l'iPhone coupe la lecture vocale d'une page sur le haut-parleur, pas sur un casque ou une enceinte.
- Retouches du module `VOX` :
  1. `voxPick()` ne choisit plus une voix d'office : sans choix fait dans la page (ou avec `jarvis.voix = 'reglages'`), aucune voix n'est imposée et la lecture part avec la seule langue `fr-FR`. Le téléphone prend alors la voix cochée dans Réglages, Accessibilité, Contenu énoncé, Voix, Français, qui peut être une voix « premium » invisible pour la page. Probable, non vérifié.
  2. `voxPanel()` : première ligne « Voix des réglages de l'iPhone » (par défaut), puis les voix que la page voit ; texte d'aide réécrit (télécharger **et cocher** la voix, couper le mode silencieux, monter le volume).
  3. `voxPhone()` : avant de lire, `navigator.audioSession.type = 'playback'` quand l'appareil le propose, pour tenter de jouer le son même en mode silencieux. Sans garantie.
- `VERSION` passe à `'17.11'`.
- Testé : scénarios Y1 à Y3 et X1 à X5 (par défaut la lecture part sans voix imposée ; un choix fait dans la liste est respecté), puis tout le banc sans erreur. **Non vérifié** : le son réel sur iPhone. Guide pas à pas donné au propriétaire dans la conversation (mode silencieux, volume, voix cochée dans les réglages).
- Publié sur la copie (version 7), source déposée dans Drive.

### 15/11/2026 : résultat de l'essai v17.11 (rien de modifié dans la page)
- Sur l'iPhone du propriétaire (iOS en anglais, voix par défaut anglaise « enhanced ») : la voix reste robotique. La page ne voit que deux voix françaises de base, et « Voix des réglages de l'iPhone » donne la même chose. Il ne trouve pas le menu « Contenu énoncé » (nom différent selon la version d'iOS : « Spoken Content » ou « Read & Speak » en anglais) ; ses voix téléchargées l'ont peut-être été dans le menu VoiceOver, qui ne sert qu'à VoiceOver.
- Conclusion : sur iPhone, la page ne peut pas offrir une voix naturelle avec les voix du téléphone. Ne plus y passer de temps.
- Pistes présentées au propriétaire, à lui de choisir (QCM) : (1) le mode vocal de l'app Claude, dans une conversation qui a ses connecteurs Google : aucune modification de la page, à essayer (on ne sait pas si le mode vocal lit Pilotage) ; (2) le mode conversation de Jarvis sur ordinateur, où la voix de Claude (`tts`) et la dictée (`dictation`) sont offertes à la page ; (3) un moteur de voix embarqué dans la page (modèle de plusieurs dizaines de Mo à charger, autorisation de la plateforme inconnue, coûteux à essayer).

### À venir

**Allègement de la page** (choisi par le propriétaire le 15/11/2026) : mesuré avant d'y toucher, rien n'a été retiré.
- Mesure (`COV=<dossier>` sur tout le banc, v17.7) : 26 % du script ne tourne jamais pendant les essais (104 Ko sur 403), mais l'essentiel est du code vivant que les essais ne parcourent pas (actions selon la nature d'une échéance, parcours de voyage, outils de la discussion). Le code vraiment mort, hérité de la maquette (rubriques « communes aux cinq maquettes », réponses simulées, `liveTick`), ne dépasse pas 15 à 25 Ko, soit 3 à 5 % de la page.
- **Décision du propriétaire (QCM du 15/11/2026) : laisser la page telle quelle.** Ne pas relancer ce chantier sans sa demande.
- Conclusion : retirer le code mort ne change presque rien au coût d'une session. Ce qui le changerait : découper la page en plusieurs fichiers publiés ensemble (styles, socle, écrans, liaison, v17), pour qu'une session ne lise que le fichier qu'elle modifie. Gros chantier (le script est une seule fonction : il faut en sortir les déclarations communes et vérifier les noms réservés du navigateur).

**Voix** (demandée par le propriétaire le 15/11/2026 : poser une question à la voix, entendre la réponse, voir l'agent parler, discussion en direct). Ce que la plateforme permet :
- Capacités `tts` (voix de Claude) et `dictation` (parole vers texte) des pages : offertes sur ordinateur (app Claude, Chrome), **pas dans l'app iPhone ni Safari**. Sur iPhone : la dictée du clavier marche dans tout champ de texte ; la lecture à voix haute par la voix du téléphone (synthèse vocale du navigateur) est à essayer sur son iPhone, non vérifiée.
- Seul Claude répond en direct dans la page ; un bot Grok répond à son passage. « Parler à un bot » en direct = Claude qui répond à sa place d'après Pilotage, en le disant, et qui propose l'ordre pour le vrai bot.
- Essais en cours (v17.9 puis v17.10, voir plus haut). Si une voix du téléphone lui convient, la suite envisagée : bouton « Écouter » sur les réponses ; mode conversation plein écran (hologramme du bot animé pendant qu'il parle, sous-titres en direct, question dictée, réponse lue seule). Pas d'androïde 3D (déjà rejeté par le propriétaire).
