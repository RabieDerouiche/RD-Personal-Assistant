# JARVIS OS — parité avec la page Jarvis v17.15

Règle (16/11/2026) : **aucune régression**. Chaque fonction de la page (copie de travail v17.15) doit exister dans JARVIS OS, au moins aussi bien. Case cochée = vérifiée dans JARVIS OS (maquette, puis vraies données). Relevé dans le code de la page le 16/11/2026 (`jarvis-page-v17.15.html`, Drive) et dans `docs/systeme-grok-bot.md`.

## Données lues dans Pilotage (plages exactes de la page)

- [ ] Canal `A1:H3000` · Dossiers `A1:J500` · Faits `A1:D300` · Journal `A1:E5000` · Papiers `A1:G300` · Prix `A3:M300` · Relevés `A1:G3000` · Routines `A1:G300` · Sorties `A1:L500` · Tâches `A1:E500` · Voyages `A1:K200` · Échéances `A1:H1000` · État `A1:E30` · À toi (formule) · Options voyage
- [ ] Agenda : principal, Présence, événements rouges (importants) ; Gmail : boîte principale, brouillons des 30 derniers jours
- [ ] Relecture : à l'ouverture, toutes les 4 min, toutes les 30 s pendant 20 min après un ordre (« attend <bot> » dans l'en-tête)

## Écrans et panneaux

Refonte UX (0.54.0, 22/11/2026) : navigation à 5 portes ; Suivi et Automatisations sont dans Équipe (filtres Demandes, Routines, Coût ; adresses `#suivi` et `#automatisations` gardées), « État des systèmes » dans Réglages, « Mes tâches » dans Pour moi ; correspondance complète bloc par bloc dans `docs/jarvis-os-refonte-ux.md`.

**Accueil (« Vue d'ensemble »)**
- [ ] Claude chef d'équipe (grande sphère) : appui = discussion avec Claude ; « Bonjour / Bon après-midi / Bonsoir, <prénom> »
- [ ] Carte de briefing (chiffres clés), barre Claude, pastilles de statistiques
- [ ] Ton équipe (organigramme), Ce qui demande ton attention (3 demandes), Les 7 prochains jours, Journal (6 derniers)
- [ ] En-tête : heure, date, état de chaque bot (travaille, attend ta réponse), bandeau « Grok en pause »
- Accueil JARVIS OS (« Fil du jour », 16/11/2026) : les panneaux de l'ancien accueil ont changé de place, sans perte : « Réponses reçues sur tes dossiers » et « Arrivés depuis le dernier tour d'Iris » → Demandes ; Journal et pastilles de chiffres → Équipe ; « En cours chez tes bots » et coût de la semaine → Suivi ; bloc « Grok en pause » → pastille qui l'ouvre ; point de Claude → discussion (globe) ; « Ce qui demande ton attention » et « Les 7 prochains jours » → « À faire maintenant », « Aujourd'hui », « Cette semaine ».

**Demandes (« Ce qui attend ta réponse »)**
- [ ] À décider maintenant, Tes oui à donner dans Grok (oui groupés : une phrase par bot), Brouillons prêts à partir (relus, envoyés tels quels, avertissement si déjà répondu), Arrivés depuis le dernier tour d'Iris (« Pour Iris » / « Rien à faire »), En cours chez tes bots (avec le contexte), Réponses reçues sur tes dossiers, Pour Claude (« Claude répond ici », « Confier à la tâche Claude »), Tes ordres, Échanges récents dans le Canal, Expirées, Reportées, Plus tard
- [ ] Boutons selon le genre (info, à faire, à choisir, à valider, à confirmer) ; « Donner mon oui » (copie la phrase, lien `grokbot://`) ; aide à la décision et « En discuter avec Claude » ; présence de la semaine à côté d'une demande de CRA

**Agenda (« Agenda et dates clés »)**
- [ ] Les 7 prochains jours, Mes événements importants (rouges, création directe), Dates clés, Échéances (Fait, Annulé, nouvelle date), Ajouter une échéance, Présence (télétravail, hors domicile, congé)

**Achats (« Achats et prix suivis »)**
- [ ] Tous mes achats, Autres veilles de Kairos, « + Suivre un produit » / « Suivre ce produit » / « Demander à Kairos », statut (Suivi, En pause jusqu'au, Acheté avec prix et date, Plus suivi), seuil d'achat, vendeurs, historique (Relevés)

**Voyages (« Projets de voyage »)**
- [ ] Tes projets, « + Nouveau projet » / « Créer le projet », Le plan, Le fil du voyage, Les options (Choisie, Écartée et raison), Tes règles de voyage, statut du projet

**Sorties**
- [ ] Ce week-end, Tes envies, Déjà faites ; statuts Proposée, Faite, Supprimée (ne lui plaît pas), Retirée

**Suivi (« Dossiers, papiers, tâches »)**
- [ ] Dossiers en attente (sans les références), Mes tâches, Papiers, Déposer un document, Coût de la semaine (passages, ordres, demandes via chat, consignes ; semaine courante et précédente, remise à zéro le mardi à 12h47 : ligne « Reset Grok » de Faits, sinon 12h47 par défaut, `resetRule`)

**Équipe (« Les bots »)**
- [ ] Chaque bot : sphère, silhouette, emblème, routines, Ses passages, Fil avec le bot, Temps forts, commandes rapides (exemples par bot), ordres

## Écritures (5 s pour annuler, aucune sans vérifier que la ligne n'a pas bougé)

- [ ] Pilotage : `append_values` (Canal, Échéances, Tâches, Sorties…), `update_values` (statuts : sortie, échéance, prix, voyage, option, tâche)
- [ ] Agenda : `create_event`, `update_event`, `delete_event` (événements importants, présence)
- [ ] Gmail : `send_message` (brouillon envoyé tel quel, sonnette), `unlabel_thread` (« Rien à faire »), `delete_draft`
- [x] Claude Code : `fire_trigger` (tâche « Ordres Jarvis ») : fait par le serveur depuis 0.11.0 (choix du 16/11/2026), vérifié au banc de bout en bout
- [ ] Ordres groupés : un mail par bot (10 s après le dernier ordre, 45 s au plus), double appui écrit une fois (90 s), mode Grok en pause (pas de sonnette, reprise sonnée)

## Autres

- [ ] Coût affiché sur chaque bouton (gratuit, 1 passage, chat Grok, Claude…)
- [ ] Confirmation avant « Grok est reparti », « Iris les traite tous », « Confier à la tâche Claude », envoi et suppression d'un brouillon
- [ ] Claude dans la page : discussion en direct (modèle « Rapide » par défaut), contexte allégé ; ses propositions (ordre, tâche, échéance, dossier, tâche Claude) marchent sur le serveur depuis 0.11.0 (banc de bout en bout), à essayer en vrai ; depuis 0.30.0, la réponse s'écrit mot par mot et le Claude de la discussion reste ouvert (banc de bout en bout)
- [ ] Bouton retour avec position gardée ; version visible

## Nouveautés à ajouter (demandes du 16/11/2026)

- [x] Après le comparatif avec les AI OS (21/11/2026) : Claude instantané (0.30.0), mains libres et lecture au fil de la réponse (0.31.0), écoute Parakeet (0.32.0), activité en direct, routeur et secours, missions en parallèle (0.33.0), réponses illustrées (0.34.0) ; bancs maquette et bout en bout

- [x] Automatisations en suivi de livraison (dates, étapes, prochain passage) : 16/11/2026 ; depuis la 0.54.0 dans Équipe, filtre Routines ; banc maquette : `#automatisations` (frises de suivi de livraison), « automatisations : frise »
- [x] Achats : ajout et retrait faciles, courbe des prix par objet : 16/11/2026 ; banc maquette : mini-courbes, « Suivre un produit », « Ne plus suivre », courbe complète de la fiche
- [x] Papiers : recherche, regroupement, catégories (voiture, lui, épouse, fille, appartement et immobilier, entourage de la fille) : 16/11/2026 ; banc maquette : tuiles par personne et par thème, recherche instantanée et dans le texte des documents
- [x] Voix (0.25.0, choix QCM du 19/11/2026) : la conversation continue est retirée ; l'orbe ouvre la discussion avec Claude, le micro dicte une question dans le champ, « Lecture » lit les réponses (banc maquette et bout en bout) ; 0.31.0 (choix du 21/11/2026) : mains libres sur ce même Claude (micro ouvert, réponse lue dès sa première phrase, coupure à la voix, « c'est tout »), la dictée restant au choix
- [x] Recherche partout (loupe de l'en-tête) et « Pour moi » une par une (0.25.0)
- [x] Agenda : événement sur plusieurs jours (« Jusqu'au », affiché sur chaque jour ; 0.28.0)
