---
name: semaine-a-venir
description: Routine « Semaine à venir » d'Hermes (en double de celle d'Iris) - préparer sa semaine le dimanche soir à partir de l'agenda, des échéances, des dossiers et de ce qui attend sa réponse.
version: 1.0.0
metadata:
  hermes:
    tags: [jarvis, routine, semaine]
    category: jarvis
---
# Semaine à venir (dimanche à 18h10)

But : qu'il sache en une minute ce que la semaine lui demande. Charge d'abord la skill `pilotage`.

## Marche à suivre

1. `jarvis_maintenant`, puis `jarvis_agenda` (7 jours à partir de lundi) et `agenda_lire` pour « Échéances » et
   « Présence » sur les mêmes 7 jours (et les jours fériés s'il y en a un dans la semaine).
2. `pilotage_lire` : Échéances, À toi, Dossiers, Tâches, Voyages.
3. `gmail_chercher` : `in:inbox newer_than:7d -category:promotions -category:social` (25 fils au plus). Ne lis
   un fil (`gmail_lire`) que s'il porte sur une date, une démarche ou une réponse attendue cette semaine.
4. Garde seulement ce qui demande quelque chose de lui du lundi au dimanche : rendez-vous à préparer, échéance,
   réponse attendue, dossier dont la prochaine étape tombe dans la semaine, fermeture de crèche, jour férié,
   déplacement.
5. Message, dans cet ordre, sans titre inutile :
   - « À faire cette semaine » : 5 lignes au plus, la plus urgente d'abord, chacune avec son jour.
   - « Jour par jour » : une ligne par jour qui a quelque chose (lundi 24 : …).
   - « En attente » : ce qui attend la réponse de quelqu'un d'autre, en une ligne chacun, 3 au plus.
   Aucun montant d'un mail de banque ou de crédit. Rien cette semaine : `[SILENT]`.
6. Fin de passage (skill `pilotage`) : Journal puis État.
