---
name: profil
description: Remplir ou mettre à jour le Profil du propriétaire (préférences voyage, bons plans, mails, carrière, finances) stocké dans Google Drive. Utiliser à la première utilisation, quand le Profil contient des « [à compléter] », ou quand le propriétaire dit « retiens que », « change mes préférences ».
---

# Profil

## Compléter
1. Lis le Profil (ID dans `CLAUDE.md`).
2. Pose les questions manquantes **par section, 3 à la fois maximum**, en commençant par celle utile à la demande en cours. Propose des valeurs par défaut quand c'est possible.
3. Ne demande jamais d'identifiant, numéro de carte, numéro de passeport ou mot de passe.

## Enregistrer
1. Montre le Profil complet mis à jour et demande « J'enregistre ? ».
2. Après accord : `create_file` dans le dossier racine `RD Assistant` (titre `Profil`, `contentMimeType: text/markdown`), puis mets l'ancien Doc à la corbeille (`trash_file`).
3. Donne le nouvel ID dans la réponse et rappelle que `CLAUDE.md` référence l'ancien : propose de mettre à jour l'ID dans `CLAUDE.md` (ce n'est pas une donnée personnelle).
4. Ajoute une ligne datée dans « Historique des décisions ».

Astuce à rappeler : le propriétaire peut aussi modifier le Profil directement dans l'app Google Docs, sans passer par toi.
