---
name: bilan-hebdo
description: Routine « Bilan de la semaine » d'Hermes (remplace la Supervision et le Bilan du lundi d'Argus, et Plutus, sa décision du 26/11/2026) - les passages de ses routines, leurs échecs et l'usage du forfait, en un compte rendu dans JARVIS.
version: 1.0.0
metadata:
  hermes:
    tags: [jarvis, routine, bilan]
    category: jarvis
---
# Bilan de la semaine (lundi à 8h50)

But : qu'il sache en dix secondes si ses routines d'Hermes ont tourné la semaine passée, ce qui a échoué et où en
est son forfait Claude. Charge d'abord la skill `pilotage` (règles de chaque passage, modes).
Tu ne surveilles pas les bots de Grok Bot (sa décision du 24/11/2026) et tu ne cherches pas de revenus (Plutus
s'arrête) : seulement tes propres routines.

## Marche à suivre

1. `pilotage_lire` Journal (`dernieres` 200) : tes lignes (Bot = Hermes) des 7 derniers jours. `pilotage_lire`
   État : ta ligne. `pilotage_lire` Routines : tes routines (Bot = Hermes) et leur moment.
2. Pour chaque routine : passages attendus (d'après son moment), passages vus au Journal, échecs (ALERTE, « un
   outil a refusé », « non contrôlé »), dernière date. Une routine attendue et muette est un échec.
3. `hermes_usage` : le pourcentage de la semaine et sa remise à zéro. Illisible : dis-le en une phrase (le garde
   peut être coupé à sa demande).
4. `pilotage_lire` Canal (`dernieres` 60) : les lignes « À faire » pour Hermes depuis plus de 3 jours (un oubli).
5. Compte rendu, six lignes au plus :
   - ✅ ou ⚠️ et une phrase : tout a tourné, ou ce qui manque ;
   - une ligne par routine en échec ou muette : la routine, ce qui s'est passé, ce que tu proposes ;
   - 🔋 Forfait : le pourcentage, la remise à zéro ;
   - 🧭 Une amélioration au plus, si elle évite un échec qui revient.

## Fin de passage

- **en double** : Journal (`Type` PASSAGE, `Sujet` « En double : Bilan de la semaine », `Détail` : le compte
  rendu entier), `pilotage_etat`, puis `[SILENT]`.
- **en réel** : Journal (`Type` ETAT, `Sujet` « Bilan de la semaine », `Détail` : le compte rendu entier),
  `jarvis_notifier` toujours (c'est un bilan : titre « Bilan de la semaine », texte : la première ligne et le
  forfait), `pilotage_etat`, puis `[SILENT]`. Première exécution réelle : la notification le dit (skill `pilotage`).
