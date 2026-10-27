# RD-Personal-Assistant

Assistant personnel basé sur Claude Code, piloté depuis l'app Claude sur iPhone.

- **Cerveau** : ce dépôt (`CLAUDE.md` + `.claude/skills/`). Aucune donnée personnelle ici : le dépôt est public.
- **Mémoire et livrables** : dossier Google Drive privé `RD Assistant` (Profil, Voyages, Finances, CV).
- **Accès** : connecteurs Gmail, Google Agenda et Google Drive du compte Claude.

## Utilisation depuis l'iPhone

1. App Claude → onglet **Code** → nouvelle session sur `RD-Personal-Assistant`.
2. Écris ta demande normalement :
   - « Brief »
   - « Prépare un week-end à Lisbonne mi-décembre, 2 personnes, 600 € »
   - « Trouve un aspirateur robot à moins de 300 €, vérifie que la promo est réelle »
   - « Trie mes mails de la semaine et prépare les réponses urgentes »
   - « Adapte mon CV à cette offre : <lien> »
   - « Analyse mon relevé d'octobre »
3. Les livrables arrivent dans Google Drive → `RD Assistant`, consultables dans l'app Google Docs.

## Ce que l'assistant ne fait jamais

- Envoyer un mail, supprimer, partager ou modifier l'agenda sans ta confirmation.
- Payer, réserver, saisir une carte ou demander un mot de passe.
- Écrire tes données personnelles dans ce dépôt.

## Compétences

| Skill | Rôle |
|---|---|
| `brief` | Brief quotidien : agenda, mails à traiter, alertes de prix |
| `voyage` | Voyage de A à Z livré en Google Doc |
| `bons-plans` | Recherche, vérification des promos, surveillance de prix |
| `mails` | Tri, résumés, brouillons de réponse |
| `cv` | CV maître, adaptation aux offres, lettres |
| `finances` | Bilan mensuel à partir des relevés déposés dans Drive |
| `profil` | Préférences mémorisées dans Drive |
