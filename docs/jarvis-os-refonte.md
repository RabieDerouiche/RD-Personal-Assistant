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

## Maquette : méthode et base (16/11/2026)

- **Base posée** : `essais/jarvis-os-maquette/` = la page Jarvis v17.15 telle quelle (`index.html`) + le faux `window.claude` du banc (`donnees-fictives.js`, données fictives, vrais en-têtes de Pilotage), injecté en tête de page. Vérifié dans Chromium (iPhone 390 px) : 7 onglets (Accueil, Demandes, Agenda, Achats, Voyages, Sorties, Suivi), « En direct · Pilotage lu », aucune erreur. Adresse une fois fusionnée : `https://rabiederouiche.github.io/RD-Personal-Assistant/essais/jarvis-os-maquette/`.
- La page passe par `window.claude.use('mcp' | 'sample' | …)` → `callTool`, `watchTool`, `listTools`, `sample`, voix. **Version réelle** : même page, avec un `window.claude` qui appelle le serveur (`POST /api/tool`, accès Google direct) ; **maquette** : le faux. Le code de la page est dans une fonction englobante : les nouveaux écrans s'ajoutent en modifiant sa source (`TABS`, `TITLES`, `VIEWS`).

## Conception de la nouvelle disposition (à montrer en maquette, puis à valider écran par écran)

- **Navigation** : barre du bas à 5 entrées : Accueil, Demandes (pastille), **Parler** (bouton central, grand, ouvre la conversation vocale plein écran), Agenda, **Menu**. Le Menu ouvre une grille complète : Achats, Voyages, Sorties, Papiers, Automatisations, Équipe, Suivi (dossiers, tâches, coût de la semaine), Conversations (historique écrit), Missions, Réglages. Plus de barre de saisie flottante sur le contenu.
- **Saisie** : un bouton clavier dans l'en-tête et dans la page vocale ouvre un panneau du bas (champ, envoi, micro) qui se referme après l'envoi.
- **Accueil** : Claude chef d'équipe et le point du jour (la carte de la page), « À faire maintenant » (demandes, oui à donner, brouillons), la journée en frise (agenda d'aujourd'hui et demain), mails importants, état de l'équipe ; tout cliquable vers l'écran détaillé.
- **Page vocale** : orbe et voile, sous-titres complets, indicateur clair (écoute, réflexion, parole), boutons Clavier, Couper, Terminer ; l'historique de la conversation accessible d'un geste.
- **Automatisations** : une carte par routine, en frise de suivi de livraison (programmée → lancée → terminée ou en erreur), dernier passage, prochain passage calculé depuis l'horaire (onglet Routines), dernier résultat (État, Journal).
- **Achats** : liste avec mini-courbe et dernier prix, fiche avec la courbe complète (Relevés), seuil, vendeurs ; « + Suivre un produit » (écrit dans Prix) et « Ne plus suivre » (statut « Plus suivi »).
- **Papiers** : recherche plein texte, puces de catégories (Voiture, Moi, Épouse, Fille, Appartement et immobilier, Entourage de la fille, Autres), groupes par catégorie puis année, ouverture du fichier Drive ; « Déposer un document » (Iris range).
- **Voyages** et **Sorties** : la présentation de la page (projets, plan, fil, options ; ce week-end, envies, déjà faites), mise en valeur.
- **16/11/2026, maquette, première vague** (`essais/jarvis-os-maquette/index.html`, modifications repérées par le commentaire « JARVIS OS ») : barre à 5 entrées (Accueil, Demandes, **Parler** au centre qui ouvre le mode conversation de la page `convOpen()`, Agenda, **Menu**) ; écran Menu (Achats, Voyages, Sorties, Papiers, Automatisations, Équipe, Suivi, Demandes) ; **Automatisations** en frise de suivi de livraison (onglet Routines, prochain passage calculé depuis l'horaire, dernier passage d'après le Journal) ; **Papiers** avec recherche, puces de catégories et de personnes, groupes, lien Drive ; ancien micro flottant masqué. Vérifié dans Chromium (390 px) : aucune erreur. Reste : accueil et page vocale repensés, panneau de saisie, achats (courbe, ajout, retrait), voyages et sorties mis en valeur, réglages et serveur dans le menu.
- **16/11/2026, retour sur la première vague** : « le bouton Parler est moche et ça te ramène sur l'ancien truc avec le clavier » (régression par rapport à la page vocale de la PWA) ; « sorties, achats : 2 clics » ; déçu de la qualité. **Navigation choisie (QCM avec schémas) : bandeau du haut.** Deuxième vague : toutes les rubriques en pastilles dans l'en-tête (Accueil, Demandes, Agenda, Achats, Sorties, Voyages, Papiers, Automatisations, Équipe, Suivi), la pastille active se centre ; en bas, seulement le **grand bouton orbe** (orbe WebGL de la PWA) qui ouvre la **page vocale de la PWA** (orbe, voile, conversation continue, panneau clavier, fermer) : module autonome `jarvis-os/app/src/voice-overlay.ts`, compilé par `vite.voice.config.ts` en `essais/jarvis-os-maquette/jarvis-voix.js` (serveur relié : Claude en flux et voix Pierre ; sinon réponses locales). Écran Menu retiré du parcours. Vérifié : aucune erreur.
- **16/11/2026, retour sur la deuxième vague** (capture iPhone) : l'orbe du bas débordait de son bouton (taille du canevas non fixée ; invisible au banc en densité 1, visible sur iPhone en densité 3) — corrigé dans `voice-overlay.ts` ; « le bandeau défilant n'est pas top, trouve mieux ». Deux dispositions sans défilement à comparer, vérifiées en émulation iPhone 15 Pro Max : `?nav=grille` (les 10 rubriques en deux rangées sous l'en-tête) et `?nav=dock` (deux rangées en bas, l'orbe au-dessus). Sans paramètre : le bandeau défilant.
- **16/11/2026, navigation choisie (QCM) : « Barre à tes favoris »** (grille et dock refusés). En bas : ses 4 rubriques favorites (par défaut Demandes, Achats, Agenda, Sorties) et l'orbe au centre, qui ouvre la page vocale de la PWA. « Tout » (poignée) ou un glissé vers le haut ouvre « Toutes les rubriques » (les 10, en un appui) ; « Modifier mes favoris » (étoiles, 4 au plus, gardé dans le téléphone). Le logo JARVIS ramène à l'Accueil. Barre opaque (le contenu ne transparaît plus). Vérifié en émulation iPhone 15 Pro Max : aucune erreur.
