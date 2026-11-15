# Journal des modifications de la page Jarvis

Tenu à la demande du propriétaire (15/11/2026) : **chaque modification de la page y est notée avant la fin de la session**, pour qu'une autre session ou l'autre compte reprenne là où l'on s'est arrêté, même si l'usage hebdomadaire est épuisé en cours de route. Ce journal, les instructions et le banc d'essai sont fusionnés dans `main` à chaque étape. Le code de la page n'est pas dans le dépôt (dépôt public) : la page publiée fait foi.

## Les pages

| Page | Lien | État |
|---|---|---|
| En service (v16), premier compte | `https://claude.ai/artifact/QwLf64Ggstzu4p3uznZrr8` | Ne pas toucher : aucun report dessus (décision du 15/11/2026) |
| Essai (v17.5), premier compte, partagée | `https://claude.ai/artifact/UDFVL3TQ2RUeYMq1JBtT4m` | Identique à la copie du 15/11 (au titre près), sans les modifications notées « copie seulement » |
| Copie de travail, second compte | `https://claude.ai/artifact/NMAqUak7A5JYsLsc12VyaZ` | C'est ici que l'on modifie et que le propriétaire valide |

## Comment travailler

1. Modifier la copie de travail : petite retouche par `edits` sur la publication (aucune relecture si la session l'a publiée) ; sinon `Artifact` action `read`, puis republier avec `url`.
2. Tester soi-même avant de publier : `essais/jarvis/` (voir son README) sur le fichier modifié. Ajouter un scénario pour chaque fonction nouvelle.
3. Noter la modification ci-dessous (date, quoi, pourquoi, testé comment, reporté ou non sur la page d'essai).
4. Questions au propriétaire : toujours en QCM.
5. Report sur la page d'essai du premier compte : une seule fois, quand le propriétaire a validé la copie ; le moins coûteux est de le faire depuis le premier compte.

## Modifications

### 15/11/2026 : v17.5 (page d'essai et copie)
Vérification complète, quatorze défauts corrigés, aucune fonction nouvelle. Détail dans `docs/systeme-grok-bot.md` (entrée v17.5). Testé au banc : tous les onglets, toutes les écritures, pause et reprise de Grok, sonnettes, hors liaison, écriture refusée. Publié sur la page d'essai (version 7) et sur la copie (version 1, titre « Jarvis v17 copie »).

### À venir
Rien d'engagé. Améliorations proposées au propriétaire le 15/11/2026, en attente de son choix : voir la fin de l'entrée v17.5 de `docs/systeme-grok-bot.md`.
