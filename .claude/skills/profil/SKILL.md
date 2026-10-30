---
name: profil
description: Remplir ou mettre à jour le Profil du propriétaire (préférences voyage, bons plans, mails, carrière, finances) stocké dans Google Drive. Utiliser à la première utilisation, quand le Profil contient des « [à compléter] », ou quand le propriétaire dit « retiens que », « change mes préférences ».
---

# Profil

## Compléter
1. Lis le Profil (retrouvé par titre dans le dossier racine, voir `CLAUDE.md`).
2. Pose les questions manquantes **par section, 3 à la fois maximum**, en commençant par celle utile à la demande en cours. Propose des valeurs par défaut quand c'est possible.
3. Ne demande jamais d'identifiant, numéro de carte, numéro de passeport ou mot de passe.

## Enregistrer
1. Montre le Profil complet mis à jour et demande « J'enregistre ? ».
2. Après accord : relis le Profil actuel (le propriétaire a pu le modifier entre-temps) et intègre ses changements.
3. Modifie le Profil **sur place** avec le connecteur Google Docs : `read_doc`, puis `update_doc` sur les seuls passages qui changent (suis le skill `google-workspace` s'il est disponible, pour les positions et la garde de révision). Relis le Doc pour vérifier, puis donne son lien, qui ne change pas.
   - Sans connecteur Google Docs : `create_file` dans le dossier racine `RD Assistant` (titre `Profil`, `contentMimeType: text/markdown`), relis le nouveau Doc, puis seulement mets l'ancien à la corbeille (`trash_file`).
4. Ajoute une ligne datée dans « Historique des décisions ».
5. Garde le titre exact `Profil` : Hermes le retrouve par ce titre chaque matin. Si la modification le concerne (nouveau seuil, nouvelle échéance, nouveau contrat), dépose aussi une note dans `Notes de Claude/` (voir `CLAUDE.md`).

Les « Propositions pour le Profil » de `État Hermes` passent par la même procédure : les montrer au propriétaire, puis enregistrer après accord.

Astuce à rappeler : le propriétaire peut aussi modifier le Profil directement dans l'app Google Docs, sans passer par toi.
