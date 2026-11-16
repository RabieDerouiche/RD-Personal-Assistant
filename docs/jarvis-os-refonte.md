# JARVIS OS — refonte complète (décidée le 16/11/2026)

## Pourquoi

Retour du propriétaire sur la 0.9.0 : « Ça craint énormément… la page Jarvis Claude était meilleure… 0 expérience utilisateur, repense tout franchement, from scratch ». Il veut **zéro compromis et zéro régression** par rapport à la page Jarvis (copie de travail v17.15), plus ce qui lui manquait.

Ses demandes, dans ses mots (résumées) :
- une disposition optimale et un **menu complet** ;
- un onglet de ses **automatisations, avec les dates, comme un suivi de livraison** ;
- ses **projets de voyage** bien affichés, ses **propositions de sorties** ;
- ses **achats suivis**, avec la possibilité d'**en ajouter et d'en enlever**, et des **graphes de suivi des prix** ;
- ses **suivis**, et **ce qui est en attente chez les bots avec le contexte**, comme sur la page ;
- la **gestion des documents papiers**, avec une **recherche facile, groupée et catégorisée** : voiture, lui, sa femme, sa fille, l'appartement et l'immobilier, l'entourage de sa fille ;
- la **première page** et la **page de conversation vocale** à améliorer ; le **champ de saisie et le bouton pour parler** sont « moches », mal placés quand ils flottent sur la page, ni pratiques ni intuitifs.

## Décisions (QCM du 16/11/2026)

| Question | Choix |
|---|---|
| Rôle de JARVIS OS | **L'app complète** : elle remplace la page Jarvis, en mieux |
| Accès aux données | **Accès Google direct** depuis le serveur (lecture et écriture instantanées, sans Claude, sans consommation d'abonnement) ; créé une fois par le propriétaire, collé par lui dans JARVIS, jamais vu par Claude |
| Méthode | **Maquette d'abord** (données d'exemple), validation écran par écran, puis branchement ; liste de parité avec la page cochée au fur et à mesure |

## Architecture retenue

1. **Base : la page Jarvis elle-même.** Tout son affichage passe par `callTool(serveur, outil, entrée)` (Google Sheets `get_values` / `append_values` / `update_values`, Google Calendar `list_events` / `create_event` / `update_event` / `delete_event`, Gmail `search_threads` / `get_thread` / `list_drafts` / `send_message` / `unlabel_thread` / `delete_draft`) et `sample` (Claude). La refonte reprend son code (onglets Accueil, Demandes, Agenda, Achats, Voyages, Suivi ; Équipe ; Sorties ; Coût de la semaine ; brouillons ; tri des mails ; oui groupés ; présence ; personnages) : **zéro régression par construction**.
2. **Couche de données sur le serveur** : `POST /api/tool {server, tool, input}` traduit ces appels en appels directs aux API Google (Sheets v4, Calendar v3, Gmail v1, Drive v3), avec un jeton OAuth du propriétaire stocké sur son serveur (droits 600). `sample` → la conversation Claude du serveur.
3. **Accès Google** (à guider, depuis l'iPhone) : projet Google Cloud gratuit, API Sheets, Calendar, Gmail et Drive activées, écran de consentement « Externe » publié en production (sinon le jeton expire au bout de 7 jours ; avertissement « application non validée » accepté par lui), identifiant OAuth « Application Web » avec l'adresse de retour `https://<serveur>/api/google/callback`. Il colle l'identifiant et le secret dans JARVIS (Réglages), puis « Connecter Google ». Portées : `spreadsheets`, `calendar.events` et `calendar.readonly`, `gmail.modify`, `drive.readonly`. Gratuit (quotas Google largement suffisants).
4. **Ajouts au-dessus de la page** :
   - **Automatisations** : onglet en frise de suivi de livraison (onglets Routines, État, Journal, Déploiement de Pilotage : dernier passage, prochain passage, statut, étapes) ;
   - **Achats** : ajouter et retirer un prix suivi (écriture dans Prix), **courbe des prix** par objet (onglet Relevés) ;
   - **Papiers** : recherche plein texte, regroupement et catégories (voiture, lui, épouse, fille, appartement et immobilier, entourage de la fille…), à partir de l'onglet Papiers et du dossier Drive `RD Assistant/Papiers/` rangé par Iris ;
   - **Voix** : page de conversation repensée ; champ de saisie et bouton micro intégrés proprement (pas de barre flottante sur le contenu) ;
   - ce qui marche déjà dans JARVIS OS : serveur Claude Code, missions, garde-fou, ordres aux bots par le Canal, voix Pierre, personnalité.
5. **Données personnelles** : le dépôt est public. Le code de la page ne contient ni mail ni donnée réelle (son mode « Maquette » utilise des exemples fictifs) ; « Rabie » n'y sert que d'identifiant du Canal (déjà public). Toute donnée réelle reste dans Google et sur son serveur.

## Étapes

1. Liste de parité (`docs/jarvis-os-parite.md`, écrite le 16/11/2026) : chaque fonction de la page v17.15 (onglets, panneaux, boutons, écritures), à cocher dans JARVIS OS. Source : code de la page (Drive, `jarvis-page-v17.15.html`), `docs/systeme-grok-bot.md` (section « La page Jarvis »), `docs/journal-jarvis.md`.
2. Maquette : la page dans la coquille JARVIS OS (mode Maquette, données fictives) + les écrans nouveaux dans le même style ; publiée pour validation ; corrections.
3. Couche `POST /api/tool` + accès Google (guide), essais au banc avec de fausses API Google.
4. Branchement, essais réels, mise en ligne avec son accord.

## État

- 16/11/2026 : décisions prises, plan écrit. Panneaux relevés dans le code de la page (extrait) : Ce qui demande ton attention, Les 7 prochains jours, Journal, Ton équipe, À décider maintenant, Tes oui à donner dans Grok, Brouillons prêts à partir, Arrivés depuis le dernier tour d'Iris, En cours chez tes bots, Réponses reçues sur tes dossiers, Dossiers en attente, Mes tâches, Mes événements importants, Dates clés, Ajouter une échéance, Tous mes achats, Autres veilles de Kairos, Tes projets, Le plan, Le fil du voyage, Les options, Tes règles de voyage, Ce week-end, Tes envies, Déjà faites, Papiers, Déposer un document, Coût de la semaine, Commandes rapides, Pour Claude, Tes ordres, Échanges récents dans le Canal, Temps forts, Expirées, Reportées, Plus tard, Maintenant, En ce moment.
