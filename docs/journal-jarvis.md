# Journal des modifications de la page Jarvis

Tenu à la demande du propriétaire (15/11/2026) : **chaque modification de la page y est notée avant la fin de la session**, pour qu'une autre session ou l'autre compte reprenne là où l'on s'est arrêté, même si l'usage hebdomadaire est épuisé en cours de route. Ce journal, les instructions et le banc d'essai sont fusionnés dans `main` à chaque étape. Le code de la page n'est pas dans le dépôt (dépôt public) : la page publiée fait foi.

## Les pages

| Page | Lien | État |
|---|---|---|
| En service (v16), premier compte | `https://claude.ai/artifact/QwLf64Ggstzu4p3uznZrr8` | Ne pas toucher : aucun report dessus (décision du 15/11/2026) |
| Essai (v17.5), premier compte, partagée | `https://claude.ai/artifact/UDFVL3TQ2RUeYMq1JBtT4m` | En retard sur la copie : il lui manque les modifications notées « copie seulement » |
| Copie de travail (v17.7), second compte | `https://claude.ai/artifact/NMAqUak7A5JYsLsc12VyaZ` | C'est ici que l'on modifie et que le propriétaire valide |

## Comment travailler

1. Modifier la copie de travail : petite retouche par `edits` sur la publication (aucune relecture si la session l'a publiée) ; sinon `Artifact` action `read`, puis republier avec `url`.
2. Tester soi-même avant de publier : `essais/jarvis/` (voir son README) sur le fichier modifié. Ajouter un scénario pour chaque fonction nouvelle.
3. Noter la modification ci-dessous (date, quoi, pourquoi, testé comment, reporté ou non sur la page d'essai).
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

### À venir
**Allègement de la page** (choisi par le propriétaire le 15/11/2026, en cours) : retirer le code de l'ancienne maquette qui ne sert plus en direct (470 Ko aujourd'hui), sans changer ce que la page fait. À faire par petites étapes, tout le banc relancé à chaque étape ; noter ici ce qui a été retiré.
