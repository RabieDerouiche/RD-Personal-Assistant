---
name: veille-du-matin
description: Routine « Veille du matin » d'Hermes (en double de celle d'Iris) - ce qui demande une action du propriétaire aujourd'hui, à partir du Journal, des dossiers, des échéances, de l'agenda et des mails arrivés depuis la veille.
version: 1.0.0
metadata:
  hermes:
    tags: [jarvis, routine, veille]
    category: jarvis
---
# Veille du matin (lundi à vendredi à 7h40)

But : qu'il sache en un message ce qui l'attend chez tous les bots, et ce qui demande une action aujourd'hui.
Charge d'abord la skill `pilotage` (règles de chaque passage, mode « en double »).

## Marche à suivre

1. Lis dans cet ordre :
   - `pilotage_lire` Journal (`dernieres` 60) : ce que les bots ont fait depuis ta dernière Veille ;
   - `pilotage_lire` Dossiers, Échéances, À toi, Tâches ;
   - `jarvis_agenda` d'aujourd'hui à 14 jours, et `agenda_lire` « Échéances » et « Présence » sur 7 jours ;
   - `gmail_chercher` `in:inbox newer_than:1d -category:promotions -category:social` (le lundi : `newer_than:3d`),
     25 fils au plus.
2. Dans les mails, écarte ce qui est déjà traité : fil où il a répondu, mail déjà noté au Journal par un bot
   (Courrier prioritaire d'Iris, Signal prix de Kairos, Facture reçue de Chronos). Ne lis un fil (`gmail_lire`) que
   s'il demande une action et qu'il ne l'a pas traité. 6 fils lus au plus.
3. Message, huit lignes au plus :
   - 🎯 Priorité du jour : une seule, avec ce qui est prêt et la décision attendue.
   - 📌 Autres actions : deux au plus.
   - 🕓 En attente de toi, tous bots confondus : les lignes de « À toi » et celles de Dossiers où il est attendu.
     Pour chacune : le bot, le sujet, ce qu'il doit répondre et où. La plus ancienne d'abord, trois lignes au
     plus, puis « et N autres ».
   - ⏳ Bientôt : échéances des 7 jours, seulement si elles sont nouvelles ou ont changé depuis ta dernière
     Veille ; les tâches de l'onglet Tâches dont la date tombe dans les 2 jours ou est dépassée.
   - 🌦️ Contexte : `jarvis_meteo`, seulement si un message part.
4. Silence (`[SILENT]`) s'il n'y a ni action, ni échéance sous 2 jours ouvrés, ni retard. Si « En attente de
   toi » est ta seule raison d'écrire et que rien n'a changé : n'écris que le lundi et le jeudi.
5. Tu ne rappelles ni les CRA ni les notes de frais (Chronos pose la question) : seulement si un mail demande
   une action de sa part.
6. Fin de passage (skill `pilotage`) : Journal puis État.

## En double : ce que tu ne fais pas

Iris note chaque décision demandée dans l'onglet Dossiers, prépare des brouillons et ajoute des échéances. Toi,
pendant l'essai, tu n'écris rien de cela : dis dans ta ligne du Journal ce que tu aurais écrit (« aurait ajouté
au dossier … », « aurait préparé un brouillon pour … »), en une phrase, sans montant bancaire.
