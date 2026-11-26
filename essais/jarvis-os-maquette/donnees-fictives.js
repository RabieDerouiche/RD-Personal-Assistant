/* Faux connecteurs pour tester la page hors de Claude : données d'exemple, en-têtes réels de Pilotage. */
(() => {
  const SCEN = window.__SCEN || {};
  const calls = (window.__calls = []);
  const p2 = (n) => String(n).padStart(2, '0');
  const fr = (d) => p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear();
  const isoD = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const D = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
  const at = (n, h, m) => { const d = D(n); d.setHours(h, m || 0, 0, 0); return d; };
  const stamp = (d) => fr(d) + ' ' + p2(d.getHours()) + 'h' + p2(d.getMinutes());

  const G = {};
  G['À toi'] = [
    ['Ce qui attend ta réponse', '8 en attente'], ['Calculé : ne rien saisir ici.'],
    ['Depuis le', 'Bot', 'Sujet', "Ce qu'on attend de toi"],
    [fr(D(-4)), 'Iris', 'Passeport', 'À faire : Prendre rendez-vous au consulat | Pourquoi : il expire dans 7 mois | Si non : pas de voyage en mars | Temps : 10 min | Avant le : ' + fr(D(16)) + ' | Lien : https://example.org/rdv'],
    [fr(D(-2)), 'Chronos', 'CRA client semaine du ' + fr(D(-5)).slice(0, 5), 'Oui/Non : Je soumets le CRA de la semaine du ' + fr(D(-5)).slice(0, 5) + ' (4 jours) ? | Pourquoi : il part vendredi à midi | Si oui : il est envoyé au portail | Si non : je te redemande lundi | Conseil : Oui | Temps : 1 min'],
    [fr(D(-2)), 'Kairos', 'Robot cuiseur', 'Choix : Quel vendeur pour le robot cuiseur ? | Options : Vendeur officiel / Grande enseigne / Attendre | Pourquoi : même prix chez deux vendeurs'],
    [fr(D(-1)), 'Iris', 'Relance syndic', 'Brouillon : La relance au syndic est prête | Lien : https://mail.google.com/mail/#drafts?compose=DRAFT1 | Pourquoi : sans réponse depuis 10 jours'],
    [fr(D(-1)), 'Iris', 'Attestation', "Brouillon : Demande d'attestation prête | À : agence@example.org | Objet : Demande d'attestation | Texte : Bonjour, pouvez-vous m'envoyer l'attestation ? Merci."],
    [fr(D(-2)), 'Argus', 'Installation', 'Ton oui dans le chat de Argus : appliquer les 3 routines. Phrase : Oui, applique les routines.'],
    [fr(D(-2)), 'Argus', 'Skill registre', 'Ton oui dans le chat de Argus : mettre le skill à jour. Phrase : Oui, mets le skill à jour.'],
    [fr(D(-1)), 'Ulysse', 'Routines d\'Ulysse', 'Ton oui dans le chat de Ulysse : ma description dit « une seule routine ». Phrase : Oui, crée ta routine Sonnette Ulysse sur l\'alias ulysse.'],
    [fr(D(-3)), 'Ulysse', 'Dates du voyage', 'Quelles dates préfères-tu pour le voyage ?'],
    [fr(D(-1)), 'Iris', 'Date du bail', "À faire : Retrouve la date de début du bail pour l'assureur | Pourquoi : il la demande pour le contrat habitation | Conseil : retrouver cette date sur l'un de ces deux documents | Temps : 5 min"],
    /* 18/11/2026 : brouillon lié à son dossier (une seule carte), demande dépassée, offre terminée dans le texte, décision liée à une fermeture de crèche */
    [fr(D(0)), 'Iris', 'Résiliation StreamPlus', 'Envoyer la relance préparée dans tes brouillons Gmail (fil StreamPlus)'],
    [fr(D(-6)), 'Iris', 'Offre de bienvenue', "À faire : Activer l'offre de bienvenue | Avant le : " + fr(D(-2))],
    [fr(D(-5)), 'Iris', 'Formulaire de la mutuelle', 'À faire : Renvoyer le formulaire signé | Avant le : ' + fr(D(-1))],
    [fr(D(0)), 'Chronos', 'CRA client', 'Ton oui dans le chat de Chronos : '],
    [fr(D(-1)), 'Iris', "Rachat de l'abonnement", "À faire : Offre Alpha terminée le " + fr(D(-3)) + " (simulation non connue). Simuler chez Beta (offre jusqu'au " + fr(D(12)) + ')'],
    [fr(D(0)), 'Iris', 'Garde pendant la fermeture de la crèche le ' + fr(D(60)), "Choix : Qui garde l'enfant ? | Options : Toi / Ton épouse / Partage | Avant le : " + fr(D(45))]
  ];
  G['Échéances'] = [
    ['Date', 'Sujet', 'Domaine', 'Rappels', 'Statut', 'Bot', 'Remarque', 'Nature'],
    [fr(D(60)), "Fermeture de la crèche (vacances d'hiver)", 'Famille', "3 mois, 1 mois, 1 semaine avant, vendredi d'avant", 'À venir', 'Iris', 'Source : mail de la crèche', 'Date à retenir'],
    [fr(D(-3)), "Fin de l'offre de lancement", 'Achats', '3 jours avant', 'À venir', 'Kairos', 'Offre vue chez le fabricant', 'Offre'],
    [fr(D(-2)), "Envoyer l'attestation à l'école", 'Famille', '', 'À venir', 'Iris', 'Demandée par la directrice', 'À faire par moi'],
    [fr(D(6)), 'Rendez-vous notaire (14h30)', 'Famille', '', 'À venir', 'Iris', 'Événement important ajouté depuis la page', 'Date à retenir'],
    [fr(D(0)), 'Rendez-vous médecin', 'Famille', '', 'À venir', 'Iris', 'Cabinet du centre', 'Date à retenir'],
    [fr(D(2)), 'CRA client de la semaine', 'Travail', '', 'À venir', 'Chronos', 'Saisie sur le portail', "Un bot s'en occupe"],
    [fr(D(3)), 'Relancer la résiliation', 'Contrats', '', 'À venir', 'Iris', 'Si rien reçu', 'Un bot suit'],
    [fr(D(13)), 'Black Friday', 'Achats', '', 'À venir', 'Kairos', 'Offres à surveiller', 'Offre'],
    [fr(D(13)), 'Robot Alpha : offre de lancement', 'Achats', '', 'À venir', 'Kairos', 'cadeau officiel', 'Offre'],
    [fr(D(40)), "Fin de validité de l'attestation d'assurance", 'Papiers', '', 'À venir', 'Iris', 'À renouveler', 'Fin de validité'],
    [fr(D(20)), 'Veille prêt personnel', 'Achats', '', 'À venir', 'Kairos', 'Fourchette arrondie seulement.', ''],
    [fr(D(-10)), 'Ancienne échéance', 'Famille', '', 'Fait', 'Iris', 'x', 'À faire par moi'],
    ['', 'Sans date', 'Famille', '', 'À venir', 'Iris', 'x', '']
  ];
  G['Dossiers'] = [
    ['Dossier', 'Statut', 'Prochaine étape', 'Échéance', 'En attente de', 'Dernier contact', 'Références et contexte', 'Bot', 'Mis à jour le', 'Pour Rabie'],
    ['Dégât des eaux', 'En attente', 'Attendre la réponse du syndic', '', 'Syndic Dupont', fr(D(-12)), 'Contact : gestion@syndic-dupont.example ; réf 123', 'Iris', fr(D(-12)), ''],
    ['Facture sans TVA', 'En attente', 'Recevoir la facture corrigée', fr(D(6)), 'le support', fr(D(-4)), '', 'Iris', fr(D(-4)), ''],
    ['Ancien dossier', 'Clos', 'x', '', 'la mairie', fr(D(-30)), '', 'Iris', fr(D(-30)), ''],
    ['Relance syndic', 'En attente', 'Envoyer la relance', fr(D(5)), 'Rabie', fr(D(-10)), '', 'Iris', fr(D(-1)), 'Pourquoi : sans réponse | Si oui : la relance part'],
    ['Résiliation StreamPlus', 'En attente', 'Envoyer la relance préparée dans tes brouillons Gmail (fil StreamPlus)', fr(D(0)), 'Rabie', fr(D(-19)), 'Ticket #4521 ; résiliation demandée ; aucune confirmation écrite depuis l\'accusé de réception ; brouillon de relance créé dans le fil Gmail.', 'Iris', fr(D(0)),
      "Brouillon. Pourquoi : StreamPlus n'a envoyé que l'accusé de réception automatique | Si oui : StreamPlus confirme la résiliation | Si non : pas de preuve écrite | Déjà prêt : brouillon de relance dans le fil « Votre demande a bien été reçue » de StreamPlus, dans tes brouillons Gmail | Conseil : l'envoyer aujourd'hui | Temps : 1 minute"]
  ];
  G['Prix'] = [
    ["Remise qui déclenche l'alerte Bon prix", '10%', 'Source'], [],
    ['Produit', 'Prix de référence (€)', 'Seuil Achat (€)', 'Seuil Bon prix (€)', "Autre condition d'achat", 'Vendeurs autorisés', 'Remarque', 'Dernier prix TTC (€)', 'Relevé le', 'Où (vendeur et lien)', 'Statut', 'Prix payé TTC (€)', 'Acheté le'],
    ['Robot Alpha X7', '1 599,00', '1 449,00', '1 439,10', "cadeau officiel d'au moins 100 €", 'Marque Alpha', 'Priorité', '1 449,00', stamp(at(-1, 17, 2)), 'Marque Alpha https://example.org/x7', 'Suivi', '', ''],
    ['Aspirateur Beta V9 Absolute', '749', '599', '674', '', 'Marque Beta, Darty, Boulanger', '', '', '', '', 'Suivi', '', ''],
    ['Aspirateur Beta V9 Submarine', '849', '679', '764', '', 'Marque Beta, Darty', '', '799', stamp(at(-1, 17, 5)), 'Darty', 'Suivi', '', ''],
    ['Jeu Gamma PS5 Standard', '79,99', '60', '72', '', 'Boulanger, Leclerc', '', '79,99', stamp(at(-1, 0, 15)), 'Boulanger', 'Suivi', '', ''],
    ['Casque audio', '399', '299', '359', '', 'Fnac', '', '289', stamp(at(-20, 10, 0)), 'Fnac', 'Acheté', '289', fr(D(-19))],
    ['Lecteur enfant', '99', '79', '89', '', 'Fnac', '', '', '', '', "En pause jusqu'au 23/11", '', '']
  ];
  G['Relevés'] = [
    ['Date et heure', "Produit (nom exact de l'onglet Prix)", 'Vendeur', 'Prix total TTC livré (€)', 'Lien', 'Bot', 'Remarque (offre, cadeau, paiement en plusieurs fois, rupture)'],
    [stamp(at(-58, 17, 0)), 'Robot Alpha X7', 'Marque Alpha', '1 599,00', '', 'Kairos', ''],
    [stamp(at(-50, 17, 0)), 'Robot Alpha X7', 'Marque Alpha', '1 599,00', '', 'Kairos', ''],
    [stamp(at(-43, 17, 0)), 'Robot Alpha X7', 'Boutique Alpha Paris', '1 549,00', '', 'Kairos', ''],
    [stamp(at(-36, 17, 0)), 'Robot Alpha X7', 'Marque Alpha', '1 599,00', '', 'Kairos', ''],
    [stamp(at(-29, 17, 0)), 'Robot Alpha X7', 'Marque Alpha', '1 529,00', '', 'Kairos', 'offre de rentrée'],
    [stamp(at(-22, 17, 0)), 'Robot Alpha X7', 'Marque Alpha', '1 499,00', '', 'Kairos', ''],
    [stamp(at(-15, 17, 0)), 'Robot Alpha X7', 'Marque Alpha', '1 549,00', '', 'Kairos', ''],
    [stamp(at(-8, 17, 0)), 'Robot Alpha X7', 'Marque Alpha', '1 599,00', '', 'Kairos', ''],
    [stamp(at(-40, 17, 6)), 'Aspirateur Beta V9 Absolute', 'Darty', '749', '', 'Kairos', ''],
    [stamp(at(-26, 17, 6)), 'Aspirateur Beta V9 Absolute', 'Boulanger', '729', '', 'Kairos', ''],
    [stamp(at(-12, 17, 6)), 'Aspirateur Beta V9 Absolute', 'Darty', '719', '', 'Kairos', ''],
    [stamp(at(-33, 17, 5)), 'Aspirateur Beta V9 Submarine', 'Darty', '849', '', 'Kairos', ''],
    [stamp(at(-19, 17, 5)), 'Aspirateur Beta V9 Submarine', 'Marque Beta', '829', '', 'Kairos', ''],
    [stamp(at(-30, 0, 15)), 'Jeu Gamma PS5 Standard', 'Leclerc', '69,99', '', 'Kairos', ''],
    [stamp(at(-16, 0, 15)), 'Jeu Gamma PS5 Standard', 'Boulanger', '74,99', '', 'Kairos', ''],
    [stamp(at(-1, 17, 2)), 'Robot Alpha X7', 'Marque Alpha', '1 449,00', '', 'Kairos', 'cadeau'],
    [stamp(at(-1, 17, 6)), 'Aspirateur Beta V9 Absolute', 'Darty', '699', '', 'Kairos', '']
  ];
  G['Voyages'] = [
    ['Projet', 'Statut', 'Qui part', 'Dates', 'Trajets', 'Budget maximum TTC (€)', 'Ce qui attend', 'En attente de', 'Bot', 'Récap (lien Drive)', 'Mis à jour le'],
    ['Tunisie Aïd 2027', 'Dates', 'Toute la famille', 'Autour de l\'Aïd. Proposition de Claude : aller le 05/03/2027, retour le 20/03/2027', 'Rabie : Paris - Tunis (aller-retour) ; Famille : Paris - Tunis (aller simple)', '2 500', 'Rabie valide les dates ; Vérifier les passeports. Poser les congés', 'Rabie', 'Ulysse', '', fr(D(-2))],
    ['Lisbonne', 'Options', 'En couple', 'du 10/04/2027 au 13/04/2027', '', '900', 'Choisir le vol', 'Rabie', 'Ulysse', '', fr(D(-2))],
    ['Vieux projet', 'Abandonné', 'x', '', '', '', '', '', 'Ulysse', '', '']
  ];
  G['Options voyage'] = [
    ["Projet (nom exact de l'onglet Voyages)", 'Type', 'Option (détail exact : compagnie, horaires, bagages ; hôtel, note, chambre)', 'Prix total TTC (€)', 'Relevé le', 'Source (lien)', 'Statut', 'Raison ou remarque', 'Bot'],
    ['Lisbonne', 'Vol', 'TAP 10h05-11h40, bagage cabine', '310', fr(D(-2)), 'https://example.org/v1', 'Proposée', 'Direct, horaires pratiques', 'Ulysse'],
    ['Lisbonne', 'Vol', 'Transavia 6h10-7h45, bagage cabine', '240', fr(D(-2)), 'https://example.org/v2', 'Proposée', 'Moins cher, très tôt', 'Ulysse'],
    ['Lisbonne', 'Hébergement', 'Hôtel Baixa 4 étoiles, 8,9/10', '420', fr(D(-2)), 'https://example.org/h1', 'Proposée', 'Centre', 'Ulysse']
  ];
  G['Canal'] = [
    ['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet'],
    [fr(D(-4)), 'Claude', 'Argus', 'Installation', 'Installe le socle.', 'Fait', 'Fait.', ''],
    [fr(D(-4)), 'Argus', 'Claude', 'Question technique', 'Peux-tu confirmer le format de la colonne Nature ?', 'À faire', '', ''],
    [fr(D(-3)), 'Rabie', 'Iris', 'Info', 'Le syndic a appelé.', 'Fait', 'Dossier mis à jour.', ''],
    [fr(D(-2)), 'Argus', 'Rabie', 'Installation', 'Appliquer les 3 routines.', 'Attend ton oui', 'Il reste 3 routines. Phrase : Oui, applique les routines.', ''],
    [fr(D(-2)), 'Argus', 'Rabie', 'Skill registre', 'Mettre le skill à jour.', 'Attend ton oui', 'Phrase : Oui, mets le skill à jour.', ''],
    [fr(D(-1)), 'Claude', 'Ulysse', 'Routines d\'Ulysse', 'Crée ta routine Sonnette Ulysse (oui d\'avance, routine conforme à ta fiche).', 'Attend ton oui', 'Ma description dit « une seule routine ». Phrase : Oui, crée ta routine Sonnette Ulysse sur l\'alias ulysse.', ''],
    [fr(D(-2)), 'Claude', 'Iris', 'Routine', 'Applique la section L de ta fiche.', 'À faire', '', ''],
    [fr(D(-2)), 'Claude', 'Ulysse', 'Routine', 'Applique le paragraphe Onglet Sorties.', 'À faire', '', ''],
    [fr(D(-1)), 'Rabie', 'Kairos', 'Ordre à Kairos', 'Vérifie maintenant le prix du Robot Alpha X7.', 'À faire', '', 'Prix : Robot Alpha X7'],
    [fr(D(-1)), 'Rabie', 'Kairos', 'Ordre à Kairos', 'Relève Jeu Gamma.', 'Fait', 'Jeu Gamma : 79,99 € chez Boulanger.', 'Prix : Jeu Gamma PS5 Standard'],
    [fr(D(-1)), 'Rabie', 'Ulysse', 'Ordre à Ulysse', 'Propose des périodes.', 'À faire', '', 'Voyage : Tunisie Aïd 2027'],
    [fr(D(-1)), 'Rabie', 'Chronos', 'Via chat', 'Où en est le CRA ?', 'Fait', 'Préparé.', ''],
    [fr(D(-1)), 'Iris', 'Rabie', 'Relance syndic', 'Brouillon prêt.', 'À faire', '', ''],
    [fr(D(-1)), 'Rabie', 'Chronos', 'Rattrapage', 'CRA de la semaine, transmise par Claude.', 'À faire', '', ''],
    [fr(D(-1)), 'Rabie', 'Athéna', 'Rattrapage', 'Veille du lundi.', 'À faire', '', '']
  ];
  G['Routines'] = [
    ['Bot', 'Routine', 'Déclencheur', 'Moment', 'But', 'Message à Rabie', 'État'],
    ['Iris', 'Veille du matin', 'Horaire', 'Lun-ven 7h30', 'x', 'x', 'En place'],
    ['Iris', 'Sonnette Jarvis', 'Mail', "À l'arrivée", 'x', 'x', 'En place'],
    ['Chronos', 'CRA client', 'Horaire', 'Ven 12h', 'x', 'x', 'En place'],
    ['Kairos', 'Prix suivis', 'Horaire', 'Dim 17h', 'x', 'x', 'En place'],
    ['Ulysse', 'Sorties du week-end', 'Horaire', 'Jeu 19h', 'x', 'x', 'À créer'],
    ['Athéna', 'Digest IA du lundi', 'Horaire', 'Lun 9h', 'x', 'x', 'En place'],
    ['Argus', 'Supervision', 'Horaire', 'Lun, mer, ven 8h44', 'x', 'x', 'En place']
  ];
  const lastSign = SCEN.active ? at(0, new Date().getHours(), Math.max(0, new Date().getMinutes() - 20)) : at(-1, 0, 20);
  const nextP = (n, h, m, lab) => stamp(at(n, h, m)) + ' (' + lab + ')';
  G['État'] = SCEN.active ? [
    ['Bot', 'Dernier passage', "Ce que j'ai fait", 'Prochain passage', 'Dernier tour de Gmail'],
    ['Iris', stamp(lastSign), 'Veille faite', nextP(2, 7, 30, 'Veille du matin'), stamp(lastSign)],
    ['Chronos', stamp(at(-1, 12, 0)), 'CRA préparé', nextP(6, 12, 0, 'CRA client')],
    ['Kairos', stamp(at(-1, 17, 0)), 'Prix relevés', nextP(1, 17, 0, 'Prix suivis')],
    ['Ulysse', stamp(at(-2, 19, 0)), 'Idées', nextP(5, 19, 0, 'Sorties')],
    ['Athéna', stamp(at(-5, 9, 0)), 'Digest', nextP(2, 9, 0, 'Digest')],
    ['Argus', stamp(at(-1, 8, 44)), 'Supervision', nextP(2, 8, 44, 'Supervision')]
  ] : [
    ['Bot', 'Dernier passage', "Ce que j'ai fait", 'Prochain passage', 'Dernier tour de Gmail'],
    ['Iris', stamp(at(-1, 0, 15)), 'Doublon repéré', nextP(-1, 7, 30, 'Veille du matin')],
    ['Chronos', fr(D(-2)) + ' 18:53', 'Renommage', fr(D(-1)) + ' 11:43 (CRA client)'],
    ['Kairos', fr(D(-1)) + ' 00:15', 'Relevé Jeu Gamma', fr(D(1)) + ' 16:57 (Prix suivis)'],
    ['Ulysse', fr(D(-2)) + ' 19:45', 'Bloc Voyages', fr(D(5)) + ' 19:13 (Sorties du week-end)'],
    ['Athéna', fr(D(-2)) + ' 18:52', 'Renommée', fr(D(2)) + ' 08:54 (Digest IA du lundi)'],
    ['Argus', stamp(at(-1, 0, 20)), 'Skill à jour', nextP(-1, 8, 44, 'Supervision')]
  ];
  G['Faits'] = [
    ['Domaine', 'Fait', 'Valeur', 'Mis à jour le', 'Source'],
    ['Foyer', 'Fille', 'Léa, née le 03/02/2023', fr(D(-9)), ''],
    ['Voyages', 'Vols', 'Directs de préférence', fr(D(-9)), ''],
    ['Voyages', 'Destinations envisagées', 'Japon (printemps), Sicile, Maroc (Marrakech, Essaouira)', fr(D(-9)), ''],
    ['Assistants', 'Sonnette Jarvis', 'bots+jarvis@mail.grokbot.com', fr(D(-3)), ''],
    ['Foyer', 'Père', 'Prénom Nom, anniversaire le ' + fr(D(4)).slice(0, 5) + ' (année non connue).', fr(D(-2)), '']
  ];
  if (SCEN.bells) G['Faits'].push(['Assistants', 'Sonnette Kairos', 'bots+kairos@mail.grokbot.com', '', ''], ['Assistants', 'Lien Grok Argus', 'https://grok.com/bots/abc123', '', ''], ['Assistants', 'Sonnette Pirate', 'x@evil.example', '', '']);
  if (SCEN.pauseUntil) G['Faits'].push(['Grok Bot', "Grok en pause jusqu'au", SCEN.pauseUntil, '', 'Jarvis']);
  /* 0.86.0 : Grok Bot arrêté (l'interrupteur de l'app) ; Hermes a ses routines et sa ligne d'État (données inventées) */
  if (SCEN.grokOff) {
    G['Faits'].push(['Grok Bot', 'Grok Bot arrêté le', fr(D(-1)), fr(D(-1)), 'Claude']);
    G['Routines'].push(['Hermes', 'Veille du matin', 'Horaire (serveur de JARVIS)', 'Lun-ven 7h40', 'x', 'x', 'En place'], ['Hermes', 'Semaine à venir', 'Horaire (serveur de JARVIS)', 'Dim 18h10', 'x', 'x', 'En place'], ['Hermes', 'Prix suivis', 'Horaire (serveur de JARVIS)', 'Dim 17h', 'x', 'x', 'En place']);
    G['État'].push(['Hermes', fr(D(0)) + ' 07:42', 'Veille du matin faite', fr(D(1)) + ' 07:40 (Veille du matin)', '']);
  }
  G['Papiers'] = [
    ['Document', 'Personne', 'Où il est (lien Drive, ou « papier »)', "Valable jusqu'au", 'Sert pour', 'Mis à jour le', 'Remarque'],
    ['Passeport', 'Rabie', 'papier, tiroir', fr(D(210)), 'voyage', '', ''],
    ['Attestation assurance', 'Foyer', 'https://drive.google.com/file/d/abc/view', fr(D(40)), 'école, bail', '', 'x'],
    ['Livret de famille', 'Foyer', 'papier', '', 'démarches', '', '']
  ];
  G['Tâches'] = [
    ['Ajoutée le', 'Tâche', 'Pour le', 'Statut', 'Remarque'],
    [fr(D(-3)), 'Appeler le plombier', fr(D(1)), 'À faire', ''],
    [fr(D(-3)), "Commander les photos d'identité", '', 'À faire', ''],
    [fr(D(-6)), 'Vieille tâche', '', 'Fait', '']
  ];
  G['Journal'] = [
    ['Date et heure', 'Bot', 'Type', 'Sujet', 'Détail'],
    [stamp(at(-9, 9, 0)), 'Athéna', 'ETAT', 'Digest', 'Envoyé.'],
    [stamp(at(-3, 18, 53)), 'Chronos', 'ETAT', 'Horaires', 'Passages à midi.'],
    [stamp(at(-3, 18, 52)), 'Athéna', 'ETAT', 'Renommage', 'Fait.'],
    [stamp(at(-2, 19, 45)), 'Ulysse', 'DECISION', 'Voyages', 'Bloc ajouté.'],
    [stamp(at(-1, 0, 15)), 'Kairos', 'ETAT', 'Relevé', 'Jeu Gamma relevé.'],
    [stamp(SCEN.active ? lastSign : at(-1, 0, 20)), 'Argus', 'ETAT', 'Skill', 'À jour.']
  ];
  /* 0.26.0 : scénario « newBots » — Plutus s'est inscrit dans Pilotage, et un bot que la page ne connaît pas (« Midas ») y a aussi ses lignes ;
     un nom qui n'est que dans le Canal (« Pegasus », bot supprimé) ne doit pas devenir un bot */
  if (SCEN.newBots) {
    G['État'].push(['Plutus', stamp(at(0, 8, 5)), 'Trois pistes de revenus étudiées', nextP(1, 8, 0, 'Point du matin')], ['Midas', stamp(at(-1, 21, 10)), 'Veille des appels d’offres', nextP(2, 21, 0, 'Veille')]);
    G['Routines'].push(['Plutus', 'Point du matin', 'Horaire', 'Lun-ven 8h', 'x', 'x', 'En place'], ['Plutus', 'Sonnette Plutus', 'Mail', "À l'arrivée", 'x', 'x', 'En place'], ['Midas', 'Veille', 'Horaire', 'Mar 21h', 'x', 'x', 'En place']);
    G['Canal'].push([fr(D(0)), 'Rabie', 'Plutus', 'Via chat', 'Cherche trois idées de revenus complémentaires compatibles avec mon emploi.', 'Fait', 'Trois pistes notées : le détail est dans mon chat.', ''],
      [fr(D(0)), 'Plutus', 'Rabie', 'Piste freelance', 'Oui/Non : Je prépare une offre de mission courte en .NET ? | Pourquoi : la piste la plus rapide à tester | Si oui : brouillon prêt demain | Si non : je passe à la suivante', 'À faire', '', ''],
      [fr(D(-1)), 'Rabie', 'Midas', 'Via chat', 'Surveille les appels d’offres de ma région.', 'En cours', 'Veille lancée.', ''],
      [fr(D(-9)), 'Claude', 'Pegasus', 'Premier export', 'Vieille ligne d’un bot supprimé.', 'Annulé', '', '']);
    G['Journal'].push([stamp(at(0, 8, 5)), 'Plutus', 'ETAT', 'Pistes de revenus', 'Trois pistes étudiées, une question posée dans le Canal.'], [stamp(at(-1, 21, 10)), 'Midas', 'ETAT', 'Veille', 'Deux appels d’offres repérés.']);
    G['Faits'].push(['Assistants', 'Sonnette Plutus', 'bots+plutus@mail.grokbot.com', '', '']);
    G['À toi'].push([fr(D(0)), 'Plutus', 'Piste freelance', 'Oui/Non : Je prépare une offre de mission courte en .NET ? | Pourquoi : la piste la plus rapide à tester | Si oui : brouillon prêt demain | Si non : je passe à la suivante']);
  }
  const wk = (() => { const d = new Date().getDay(); return d === 0 ? [-1, 0] : d === 6 ? [0, 1] : [6 - d, 7 - d]; })();
  G['Sorties'] = [
    ['Sortie', 'Où', 'Début', 'Fin', 'Prix total TTC (2 adultes et Léa)', 'Trajet', 'Âge conseillé', 'Lien', 'Statut', 'Proposée le', 'Bot', 'Remarque'],
    ["Boucle d'or (spectacle)", 'La Clef', fr(D(wk[0])), fr(D(wk[1])), '', '', '', '', 'Proposée', fr(D(-2)), 'Ulysse', 'À compléter'],
    ['Ferme pédagogique', 'Gally', fr(D(wk[0])), fr(D(wk[1])), '24', '25 min en voiture par la nationale, parking gratuit devant l’entrée', 'dès 2 ans, poussette possible sur tout le parcours', 'https://example.org/ferme', 'Proposée', fr(D(-2)), 'Ulysse', ''],
    ['Marché de Noël', 'La Défense', fr(D(12)), fr(D(40)), '0', '30 min', 'tous', '', 'Proposée', fr(D(-2)), 'Ulysse', ''],
    ['Exposition finie', 'Paris', fr(D(-20)), fr(D(-3)), '12', '', '', '', 'Proposée', fr(D(-25)), 'Ulysse', ''],
    ['Atelier citrouilles', 'Versailles', fr(D(-10)), fr(D(-10)), '18', '35 min', 'dès 4 ans', '', 'Proposée', fr(D(-15)), 'Ulysse', ''],
    ['Aquarium', 'Paris', '', '', '45', '40 min', 'dès 1 an', '', 'Faite', fr(D(-30)), 'Ulysse', ''],
    ['Idée refusée', 'x', '', '', '', '', '', '', 'Supprimée', '', 'Ulysse', '']
  ];

  /* agendas */
  const PRES = 'presence'; /* tout agenda secondaire (…@group.calendar.google.com) est pris pour l'agenda Présence */
  let evSeq = 0;
  const allDay = (n, summary, len) => ({id: 'pe' + (++evSeq), summary, status: 'confirmed', start: {date: isoD(D(n))}, end: {date: isoD(D(n + (len || 1)))}});
  const CAL = {};
  CAL[PRES] = [allDay(-5, 'Congé', 2), allDay(-2, 'Hors Domicile'), allDay(-1, 'Télétravail'), allDay(0, 'Télétravail'), allDay(3, 'Télétravail'), allDay(9, 'Congé', 2)];
  CAL.primary = [
    {id: 'imp6', summary: 'Dentiste', status: 'confirmed', colorId: '11', start: {dateTime: isoD(D(0)) + 'T09:00:00+01:00'}, end: {dateTime: isoD(D(0)) + 'T09:45:00+01:00'}, location: 'Cabinet'},
    {id: 'imp7', summary: 'Réunion parents', status: 'confirmed', colorId: '11', start: {dateTime: isoD(D(0)) + 'T18:00:00+01:00'}, end: {dateTime: isoD(D(0)) + 'T19:00:00+01:00'}, location: 'École'},
    {id: 'imp1', summary: 'Rendez-vous notaire', status: 'confirmed', colorId: '11', start: {dateTime: isoD(D(6)) + 'T14:30:00+01:00'}, end: {dateTime: isoD(D(6)) + 'T15:30:00+01:00'}, location: 'Étude'},
    {id: 'imp2', summary: 'Anniversaire', status: 'confirmed', colorId: '11', start: {date: isoD(D(30))}, end: {date: isoD(D(31))}, recurrence: ['RRULE:FREQ=YEARLY']},
    {id: 'imp3', summary: 'Visite médicale', status: 'confirmed', colorId: '11', start: {date: isoD(D(9))}, end: {date: isoD(D(10))}},
    {id: 'n1', summary: 'Réunion banale', status: 'confirmed', start: {date: isoD(D(1))}, end: {date: isoD(D(2))}}
  ];
  /* 0.28.0 : scénario « multi » — des événements de plusieurs jours déjà dans l'agenda Google : journées entières (la fin de Google est le lendemain
     du dernier jour), avec des heures sur deux jours, et un événement d'un soir qui finit à minuit (un seul jour) */
  if (SCEN.multi) CAL.primary.push({id: 'impM1', summary: 'Vacances chez les cousins', status: 'confirmed', colorId: '11', start: {date: isoD(D(1))}, end: {date: isoD(D(4))}},
    {id: 'impM2', summary: 'Salon professionnel', status: 'confirmed', colorId: '11', start: {dateTime: isoD(D(10)) + 'T09:00:00+01:00'}, end: {dateTime: isoD(D(11)) + 'T17:00:00+01:00'}},
    {id: 'impM3', summary: 'Soirée théâtre', status: 'confirmed', colorId: '11', start: {dateTime: isoD(D(12)) + 'T20:00:00+01:00'}, end: {dateTime: isoD(D(13)) + 'T00:00:00+01:00'}},
    {id: 'impM4', summary: 'Stage déjà commencé', status: 'confirmed', colorId: '11', start: {date: isoD(D(-2))}, end: {date: isoD(D(2))}});

  /* Gmail */
  const msg = (id, th, from, name, subject, when, labels, snippet) => ({id, threadId: th, sender: from, addressDisplayNames: [{displayName: name, emailAddress: from}], subject, snippet: snippet || 'Extrait du mail', date: when.toISOString(), internalDate: String(when.getTime()), labelIds: labels || ['INBOX'], viewUrl: 'https://mail.google.com/mail/#all/' + th});
  const thr = (th, m) => ({id: th, messageCount: 1, messages: [m], viewUrl: 'https://mail.google.com/mail/#all/' + th});
  const now = new Date();
  const MAIL = {
    inbox: [
      thr('t1', msg('m1', 't1', 'gestion@syndic-dupont.example', 'Syndic Dupont', 'RE: Dégât des eaux', new Date(now - 3600000 * 5), ['INBOX'], 'Bonjour, l&#39;expert passera mardi.')),
      thr('t2', msg('m2', 't2', 'news@boutique.example', 'Boutique', 'Votre commande', new Date(now - 3600000 * 8))),
      thr('t3', msg('m3', 't3', 'ecole@example.org', 'École', 'Réunion parents', new Date(now - 3600000 * 30))),
      thr('t4', msg('m4', 't4', 'vieux@example.org', 'Vieux', 'Ancien mail', new Date(now - 86400000 * 9)))
    ],
    sent: [thr('s1', msg('ms1', 's1', 'moi@example.org', 'Moi', 'Relance syndic', new Date(now - 3600000 * 2), ['SENT']))],
    drafts: [
      {id: 'DRAFT1', threadId: 'dth1', toRecipients: ['gestion@syndic-dupont.example'], ccRecipients: [], date: new Date(now - 3600000 * 20).toISOString(), subject: 'Relance syndic', plaintextBody: 'Bonjour,\nJe me permets de vous relancer.\nCordialement', viewUrl: 'https://mail.google.com/mail/#drafts?compose=DRAFT1'},
      {id: 'DRAFT2', threadId: 'dth2', toRecipients: [], date: new Date(now - 3600000 * 40).toISOString(), subject: '', plaintextBody: 'Texte sans destinataire'},
      {id: 'DRAFT3', threadId: 'dth3', toRecipients: ['contact@streamplus.example'], ccRecipients: [], date: new Date(now - 3600000 * 3).toISOString(), subject: 'Re: Votre demande a bien été reçue (#4521)', plaintextBody: "Bonjour,\nJ'ai demandé la résiliation de mon abonnement (requête #4521) et je n'ai reçu qu'un accusé de réception. Pouvez-vous me confirmer la résiliation et sa date d'effet ?\nCordialement", viewUrl: 'https://mail.google.com/mail/#drafts?compose=DRAFT3'}
    ]
  };

  if (SCEN.draftPj) MAIL.drafts.push({id: 'DRAFT9', threadId: 'dth9', toRecipients: ['agence@example.org'], ccRecipients: [], date: new Date(now - 3600000).toISOString(), subject: 'Dossier location', plaintextBody: 'Bonjour,\nVoici le dossier.', pieces: ['dossier.pdf']});   /* 0.85.0 : un brouillon avec pièce jointe */

  /* plages A1 */
  const colN = (s) => s.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
  function parseRange(r) {
    const m = String(r).match(/^'?([^'!]+)'?!([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/);
    if (!m) throw {code: 'tool_error', message: 'plage illisible : ' + r};
    return {sheet: m[1], c1: colN(m[2]), r1: +(m[3] || 1), c2: m[4] ? colN(m[4]) : colN(m[2]), r2: m[5] ? +m[5] : (m[4] ? 1e6 : +(m[3] || 1))};
  }
  /* faux Drive de Papiers (JARVIS OS, 16/11/2026) : noms fictifs, rangement par personne et par thème */
  const DRIVE = (() => {
    const folders = [], files = [], byName = {}; let n = 0;
    const dir = (name, parent) => { const id = 'fd' + (++n); folders.push({id, name, parent}); return id; };
    const put = (parent, names, mod) => names.forEach((nm, i) => files.push({id: 'ff' + (++n), name: nm, parent, mimeType: /\.(jpe?g|png)$/i.test(nm) ? 'image/jpeg' : /\.docx?$/i.test(nm) ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf', modifiedTime: (mod || '2023') + '-0' + (1 + i % 9) + '-12T10:00:00Z', size: 120000, viewUrl: 'https://drive.google.com/file/d/exemple-' + n + '/view'}));
    const P = '1huMsPD8I81buG4GWhuoGmsOafvy4HrE4';
    const lui = dir('Lui', P), id = dir('Identité et séjour', lui), sa = dir('Santé', lui), cv = dir('Diplômes et CV', lui), tr = dir('Travail', lui);
    put(id, ['Passeport - Identité.pdf', 'Passeport - Pages 4-5 - 2024.pdf', 'Carte Résident - Recto.png', 'Carte Résident - Verso.png', 'Récépissé de demande de carte de séjour 01-2024.pdf', 'Extrait de naissance - 10 novembre 2022.pdf', 'Vignette OFII.jpg'], '2024');
    put(sa, ['Carte Vitale - Recto.png', 'Attestation de droits Ameli.pdf', 'Carnet de santé.pdf'], '2025');
    put(cv, ['Diplômes.pdf', 'CV 2024.pdf'], '2024'); put(tr, ['Contrat de travail.pdf', 'Attestation employeur 2025.pdf', 'Lettre de déontologie.pdf'], '2025');
    const ep = dir('Sarah', P), eps = dir('Santé et grossesse', ep), epr = dir('Résident', ep);
    put(ep, ['Passeport - Sarah - 2023.pdf', 'Diplôme Master.pdf', 'Attestation Navigo 2025.pdf'], '2023'); put(eps, ['Échographie - 15-11-2023.pdf', 'Carte mutualiste 2024.pdf'], '2024'); put(epr, ['Carte Résident - Sarah.png', 'Titre de séjour - Recto.pdf'], '2025');
    const fi = dir('Léa', P), cr = dir('Crèche', fi);
    put(fi, ['Acte de naissance - 31-08-2024.pdf', 'Passeport - Léa.pdf', 'Attestation scolaire 2025.pdf', 'Attestation de responsabilité civile.pdf'], '2025'); put(cr, ['Contrat de garde.pdf', 'Bulletin de présence - septembre 2024.pdf'], '2024');
    const fa = dir('Famille et proches', P); put(fa, ['Livret de famille.pdf', 'Acte de mariage.pdf', 'Attestation de quotient familial - CAF.pdf'], '2024');
    const lo = dir('Logement', P), ach = dir("Achat de l'appartement (2022)", lo), loc = dir('Locations 2018-2022', lo), fac = dir('Factures et abonnements', lo);
    put(lo, ['Attestation - Appartement - 2025.pdf'], '2025'); put(ach, ['Offre d’achat.pdf', 'Attestation de vente.pdf', 'Plan de l’appartement.pdf'], '2022'); put(loc, ['Contrat de location 2019.pdf', 'Quittance 2019-05.pdf', 'Quittance 2019-06.pdf', 'Attestation d’assurance habitation 2019.pdf'], '2019'); put(fac, ['Facture internet 09-2018.pdf', 'Justificatif de domicile - énergie.pdf', 'Garantie robot de cuisine.pdf'], '2020');
    const vo = dir('Voiture', P); put(vo, ['Permis de conduire - Recto.png', 'Certificat d’immatriculation.pdf', 'Attestation d’assurance auto.pdf'], '2024');
    const vy = dir('Voyages', P), b23 = dir('Bali 2023', vy); put(vy, ['Billet Paris - Tunis 2019.pdf', 'Réservation hôtel Hurghada 2026.pdf'], '2026'); put(b23, ['Itinéraire Bali.pdf', 'Billets Bali.pdf'], '2023');
    const at = dir('À trier', P); put(at, ['Scan sans nom.pdf'], '2019');
    put(P, ['Document déposé ce matin.pdf'], '2026');
    const pr = dir('Papiers privés', 'root'); byName['Papiers privés'] = pr;
    const im = dir('Impôts', pr), sl = dir('Salaires et revenus', pr), bq = dir('Banque et crédit', pr);
    put(im, ['Avis d’impôt 2025.pdf', 'Avis d’impôt 2024.pdf'], '2025'); put(sl, ['Bulletin de salaire 2025-09.pdf', 'Bulletin de salaire 2025-10.pdf'], '2025'); put(bq, ['RIB.pdf', 'Offre de prêt.pdf'], '2022');
    return {folders, files, byName};
  })();
  const delay = (v, ms) => new Promise((res) => setTimeout(() => res(v), ms == null ? 20 : ms));
  const FAIL = SCEN.fail || {};
  function exec(server, tool, input) {
    calls.push({server, tool, input: JSON.parse(JSON.stringify(input || {})), t: Date.now()});
    if (FAIL[tool]) throw {code: FAIL[tool], server, message: 'refus simulé'};
    if (server === 'Google Sheets') {
      const R = parseRange(input.range), g = G[R.sheet];
      if (!g) throw {code: 'tool_error', server, message: 'onglet inconnu ' + R.sheet};
      if (tool === 'get_values') {
        const out = [];
        for (let i = R.r1; i <= Math.min(R.r2, g.length); i++) out.push((g[i - 1] || []).slice(R.c1 - 1, R.c2));
        while (out.length && !out[out.length - 1].some((c) => c !== '' && c != null)) out.pop();
        return {range: input.range, values: out};
      }
      if (tool === 'append_values') { input.values.forEach((row) => g.push(row.slice())); return {updates: {updatedRows: input.values.length}}; }
      if (tool === 'update_values') { input.values.forEach((row, i) => { const rr = R.r1 - 1 + i; g[rr] = g[rr] || []; row.forEach((v, j) => { while (g[rr].length < R.c1 - 1 + j) g[rr].push(''); g[rr][R.c1 - 1 + j] = String(v); }); }); return {updatedCells: 1}; }
    }
    if (server === 'Google Calendar') {
      const cal = /@group\.calendar\.google\.com$/.test(input.calendarId || '') ? PRES : (input.calendarId || 'primary'), list = (CAL[cal] = CAL[cal] || []);
      if (tool === 'list_events') return {events: list.slice(), summary: 'x', timeZone: 'Europe/Paris'};
      if (tool === 'create_event') { if ((input.overrideReminders || []).some((r) => r.minutes < 0) && SCEN.noNegative) throw {code: 'tool_error', server, message: 'minutes négatives refusées'}; const ev = {id: 'new' + (++evSeq), summary: input.summary, status: 'confirmed', colorId: input.colorId, location: input.location}; if (input.allDay) { ev.start = {date: input.startTime.slice(0, 10)}; ev.end = {date: input.endTime.slice(0, 10)}; } else { ev.start = {dateTime: input.startTime + '+01:00'}; ev.end = {dateTime: input.endTime + '+01:00'}; } list.push(ev); return ev; }
      if (tool === 'update_event') { const ev = list.find((e) => e.id === input.eventId); if (!ev) throw {code: 'tool_error', server, message: 'introuvable'}; if (input.summary) ev.summary = input.summary; if (input.startTime) { if (input.allDay) { if (!input.endTime) throw {code: 'tool_error', server, message: 'allDay sans endTime'}; ev.start = {date: input.startTime.slice(0, 10)}; ev.end = {date: input.endTime.slice(0, 10)}; } else { if (/Z$|[+-]\d\d:\d\d$/.test(input.startTime)) throw {code: 'tool_error', server, message: 'heure locale attendue, sans décalage'}; const len = new Date(ev.end.dateTime) - new Date(ev.start.dateTime); const s0 = new Date(input.startTime + '+01:00'); const f = (d) => new Date(d.getTime() + 3600000).toISOString().slice(0, 19) + '+01:00'; ev.start = {dateTime: f(s0)}; ev.end = {dateTime: f(new Date(s0.getTime() + len))}; } } return ev; }
      if (tool === 'delete_event') { const i = list.findIndex((e) => e.id === input.eventId); if (i < 0) throw {code: 'tool_error', server, message: 'introuvable'}; list.splice(i, 1); return {}; }
    }
    if (server === 'Gmail') {
      if (tool === 'search_threads') { const q = input.query || ''; if (/in:sent/.test(q)) return {threads: MAIL.sent}; const days = +(q.match(/newer_than:(\d+)d/) || [0, 30])[1]; const th = MAIL.inbox.filter((t) => now - +t.messages[0].internalDate < days * 86400000); return th.length ? {threads: th} : {}; }
      if (tool === 'list_drafts') return MAIL.drafts.length ? {drafts: MAIL.drafts.slice()} : {};
      if (tool === 'get_thread') { const t = MAIL.inbox.find((x) => x.id === input.threadId); if (!t) throw {code: 'tool_error', server, message: 'fil introuvable'}; return {id: t.id, messages: t.messages.map((m) => Object.assign({}, m, {plaintextBody: "Bonjour,\nL'expert passera mardi à 10h. Merci de confirmer votre présence.\n\nLe 02/11 a écrit :\n> ancien texte"}))}; }
      if (tool === 'send_message') { if (input.draftId) { const i = MAIL.drafts.findIndex((d) => d.id === input.draftId); if (i < 0) throw {code: 'tool_error', server, message: 'brouillon introuvable'}; MAIL.drafts.splice(i, 1); } return {id: 'sent' + Date.now(), threadId: 'x'}; }
      if (tool === 'update_draft') { const d = MAIL.drafts.find((x) => x.id === input.draftId); if (!d) throw {code: 'tool_error', server, message: 'brouillon introuvable'}; if ((d.pieces || []).length) throw {code: 'pieces_jointes', server, message: 'Ce brouillon a une pièce jointe : modifie-le dans Gmail, pour ne pas la perdre.'}; const bad = [].concat(input.to || [], input.cc || []).find((x) => !/^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i.test(x)); if (bad) throw {code: 'adresse', server, message: 'Adresse invalide : ' + bad}; if (input.to) d.toRecipients = input.to.slice(); if (input.cc) d.ccRecipients = input.cc.slice(); if (input.subject != null) d.subject = String(input.subject).replace(/[\r\n]+/g, ' ').trim(); if (input.body != null) d.plaintextBody = String(input.body); MAIL.majs = (MAIL.majs || []).concat([JSON.parse(JSON.stringify(input))]); return {id: d.id, threadId: d.threadId, toRecipients: d.toRecipients, subject: d.subject, plaintextBody: d.plaintextBody}; }
      if (tool === 'delete_draft') { const i = MAIL.drafts.findIndex((d) => d.id === input.draftId); if (i < 0) throw {code: 'tool_error', server, message: 'brouillon introuvable'}; MAIL.drafts.splice(i, 1); return {}; }
      if (tool === 'unlabel_thread') { if (!input.threadId || !Array.isArray(input.labelIds)) throw {code: 'tool_error', server, message: 'arguments'}; const i = MAIL.inbox.findIndex((t) => t.id === input.threadId); if (i >= 0) MAIL.inbox.splice(i, 1); return {}; }
    }
    if (server === 'Claude Code Remote' && tool === 'fire_trigger') { /* scénario tasks : les seules tâches que ce compte possède */ if (SCEN.tasks && !SCEN.tasks.includes(input.trigger_id)) { const e = new Error('trigger not found'); e.code = 'tool_error'; throw e; } return {ok: true}; }
    if (server === 'Google Drive' && tool === 'search_text') {
      /* JARVIS OS : texte « lu » par Google dans quelques faux documents, limité aux racines demandées */
      const TEXT = (f) => /quittance/i.test(f.name) ? 'quittance de loyer, résidence, période mensuelle' : /assurance/i.test(f.name) ? 'attestation d’assurance habitation, garantie' : '';
      const ids = new Set((input.roots || []).map((r) => r.id || DRIVE.byName[r.name]).filter(Boolean)); let grew = true;
      while (grew) { grew = false; DRIVE.folders.forEach((f) => { if (ids.has(f.parent) && !ids.has(f.id)) { ids.add(f.id); grew = true; } }); }
      const n = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), q = n(input.query);
      return {files: q.length < 3 ? [] : DRIVE.files.filter((f) => ids.has(f.parent) && n(f.name + ' ' + TEXT(f)).includes(q)).slice(0, 40)};
    }
    if (server === 'Google Drive' && tool === 'folder_tree') {
      /* JARVIS OS : faux Drive de Papiers (noms fictifs), même forme que le serveur */
      const roots = (input.roots || []).map((r) => r.id ? {key: r.key || r.id, id: r.id, name: r.name || '', found: true} : (DRIVE.byName[r.name] ? {key: r.key || r.name, id: DRIVE.byName[r.name], name: r.name, found: true} : {key: r.key || r.name, id: '', name: r.name, found: false}));
      const seen = new Set(roots.map((r) => r.id).filter(Boolean)); let grew = true;
      while (grew) { grew = false; DRIVE.folders.forEach((f) => { if (seen.has(f.parent) && !seen.has(f.id)) { seen.add(f.id); grew = true; } }); }
      return {roots, folders: DRIVE.folders.filter((f) => seen.has(f.id) && !roots.some((r) => r.id === f.id)), files: DRIVE.files.filter((f) => seen.has(f.parent))};
    }
    throw {code: 'not_in_manifest', server, message: tool};
  }
  const mcp = {
    callTool: (server, tool, input) => delay(null).then(() => ({payload: exec(server, tool, input), content: []})),
    watchTool: (server, tool, input, handler, opts) => {
      let stop = false, timer = 0;
      const send = () => { if (stop) return; try { handler({type: 'data', result: {payload: exec(server, tool, input), content: [], cache: {storedAt: Date.now(), revalidating: false}}}); } catch (e) { handler({type: 'error', error: e}); } };
      delay(null, 30).then(send);
      /* comme la plateforme : relecture périodique quand la page la demande */
      if (opts && opts.refetchInterval) timer = setInterval(send, opts.refetchInterval);
      return () => { stop = true; clearInterval(timer); };
    },
    describeTool: SCEN.noDescribe ? undefined : (server, tool) => delay({name: tool, description: '', inputSchema: {type: 'object', properties: {threadId: {type: 'string'}, labelIds: {type: 'array', items: {type: 'string'}}}}}),
    listTools: () => delay({servers: []})
  };
  /* Claude dans la page */
  const samples = (window.__samples = []);
  const sample = async (input, opts) => {
    opts = opts || {};
    const last = Array.isArray(input) ? input[input.length - 1].content : String(input);
    const first = Array.isArray(input) ? input[0].content : String(input);
    samples.push({first: first.slice(0, 200), last: last.slice(0, 300), tools: (opts.tools || []).map((t) => t.name), tier: opts.modelTier,
      ctx: ['maintenant', 'meteo', 'agenda_7_jours', 'mes_taches', 'sorties_proposees', 'voyages'].filter((k) => first.indexOf('"' + k + '"') >= 0)});   /* 0.25.0 : ce que Claude reçoit en plus (heure, météo, agenda, tâches, sorties, voyages) */
    await delay(null, 40);
    let text;
    if (/en_clair/.test(first)) text = '{"en_clair": "On te demande un oui.", "si_oui": "Ça part.", "si_non": "Rien.", "conseil": "oui", "pourquoi_conseil": "simple", "temps": "1 min", "certitude": "Likely"}';
    else if (/"temps_forts"/.test(first)) text = "{\"accroche\": \"Deux semaines entre la mer et la médina, au rythme de l'Aïd.\", \"temps_forts\": [{\"titre\": \"La médina de Tunis\", \"detail\": \"Souks couverts et ruelles blanches, à faire le matin avant la foule.\", \"icone\": \"medina\"}, {\"titre\": \"Sidi Bou Saïd\", \"detail\": \"Le village bleu et blanc au-dessus de la mer, idéal en fin de journée.\", \"icone\": \"monument\"}, {\"titre\": \"Le matin de l'Aïd\", \"detail\": \"Visites en famille et pâtisseries maison : la journée la plus animée (date à confirmer, probable).\", \"icone\": \"fete\"}, {\"titre\": \"Plage de Gammarth\", \"detail\": \"Sable fin et eau calme, pratique avec un jeune enfant.\", \"icone\": \"plage\"}, {\"titre\": \"Le marché central\", \"detail\": \"Fruits, épices et poissons du jour, à dix minutes de la médina.\", \"icone\": \"marche\"}, {\"titre\": \"Musée du Bardo\", \"detail\": \"Les plus belles mosaïques romaines du pays (horaires à vérifier).\", \"icone\": \"musee\"}], \"itineraire\": [{\"quand\": \"Ven 05/03\", \"titre\": \"Arrivée à Tunis\", \"etapes\": [\"Vol Paris → Tunis\", \"Installation chez la famille\", \"Dîner tranquille\"]}, {\"quand\": \"Jours 2 à 4\", \"titre\": \"Tunis et Sidi Bou Saïd\", \"etapes\": [\"Médina le matin\", \"Sieste pour la petite\", \"Sidi Bou Saïd au coucher du soleil\"]}, {\"quand\": \"Jours 5 à 9\", \"titre\": \"Préparatifs de la fête\", \"etapes\": [\"Courses au marché central\", \"Pâtisseries en famille\", \"Journée à la plage de Gammarth\"]}, {\"quand\": \"Aïd, vers le 10/03 (probable)\", \"titre\": \"La fête\", \"etapes\": [\"Visites en famille\", \"Repas de fête\"]}, {\"quand\": \"Sam 20/03\", \"titre\": \"Retour à Paris\", \"etapes\": [\"Vol Tunis → Paris\"]}], \"a_savoir\": [\"Passeports valides au moins jusqu'au retour, à vérifier pour chaque voyageur.\", \"Dinar tunisien : change sur place, la sortie de devises est limitée (probable).\", \"Pendant le ramadan, beaucoup de restaurants ferment en journée.\", \"En mars : 12 à 20 °C, prévoir une veste pour le soir (probable).\"]}"; /* JARVIS OS : carnet de voyage d'exemple */
    else if (/"reponse"/.test(first)) text = '{"reponse": "La colonne Nature accepte six valeurs.", "faisable_ici": true, "pourquoi": ""}';
    else if (/reponse_utile/.test(first)) text = '{"resume": "L\'expert passe mardi à 10h.", "statut": "En cours", "prochaine_etape": "Confirmer la présence mardi", "pour_rabie": "Être présent mardi", "reponse_utile": true}';
    else {
      if (opts.tools && /ordre|relance|prépare/i.test(last)) { const t = opts.tools.find((x) => x.name === 'preparer_ordre'); if (t) await t.execute({bot: 'Iris', message: 'Prépare la relance du syndic.'}); }
      if (opts.tools && /tâche/i.test(last)) { const t = opts.tools.find((x) => x.name === 'ajouter_tache'); if (t) await t.execute({titre: 'Appeler le syndic', date: isoD(D(2))}); }
      if (opts.tools && /mise à jour/i.test(last)) { const t = opts.tools.find((x) => x.name === 'mettre_a_jour_dossier'); if (t) await t.execute({statut: 'En cours', prochaine_etape: 'Confirmer mardi', resume: 'Expert mardi', consigne_iris: 'Prépare la confirmation'}); }
      text = 'Voici ma réponse (certain).\n- Point un\n- Point deux\nSuite : Prépare l\'ordre pour Iris | Ça peut attendre ? | Quels papiers ?';
    }
    /* scénario stream : la réponse arrive mot à mot, comme en vrai */
    if (SCEN.stream && /^Voici ma réponse/.test(text)) {
      text = "Première phrase de la réponse, assez longue pour être lue seule. Deuxième phrase, elle aussi complète et lisible. Troisième et dernière phrase.\nSuite : Et ensuite | Merci";
      const words = text.split(' ');
      for (let i = 1; i <= words.length; i++) { if (opts.onText) opts.onText({text: words.slice(0, i).join(' '), delta: words[i - 1]}); await delay(null, 60); }
      (window.__voice || []).push('fin de la réponse');
      return {text, truncated: false};
    }
    if (opts.onText) opts.onText({text, delta: text});
    return {text, truncated: false};
  };
  sample.limits = async () => ({tools: true, images: false});
  sample.json = async () => ({});
  /* voix : scénario tts ('ok' ou 'refuse') pour la voix de Claude, synth ('ok', 'muet' ou 'absent') pour celle du téléphone */
  window.__voice = [];
  const tts = SCEN.tts ? {speak: async (text, o) => { window.__voice.push('claude:' + (o && o.language) + ':' + text.slice(0, 60)); await delay(null, 300); if (SCEN.tts === 'refuse') throw {code: 'not_granted'}; }, stop: () => { window.__voice.push('claude:stop'); }, onState: () => {}} : null;
  if (SCEN.synth) {
    const fake = SCEN.synth === 'absent' ? undefined : {getVoices: () => [{lang: 'en-US', name: 'x', voiceURI: 'com.apple.voice.compact.en-US.Samantha'}, {lang: 'fr-FR', name: 'Thomas', voiceURI: 'com.apple.voice.compact.fr-FR.Thomas'}, {lang: 'fr-CA', name: 'Amélie (premium)', voiceURI: 'com.apple.voice.premium.fr-CA.Amelie'}, {lang: 'fr-FR', name: 'Audrey (améliorée)', voiceURI: 'com.apple.voice.enhanced.fr-FR.Audrey'}].concat(SCEN.voices === 'base' ? [] : []).filter((v) => SCEN.voices !== 'base' || /compact/.test(v.voiceURI)), cancel: () => { window.__voice.push('tel:cancel'); }, speak: (u) => { window.__voice.push('tel:' + u.lang + ':' + (u.voice && u.voice.name) + ':' + u.text.slice(0, 40)); if (SCEN.synth === 'ok') setTimeout(() => { if (u.onstart) u.onstart({}); setTimeout(() => { if (u.onend) u.onend({}); }, 200); }, 100); }};
    try { Object.defineProperty(window, 'speechSynthesis', {value: fake, configurable: true}); } catch (e) { /* rien */ }
    window.SpeechSynthesisUtterance = SCEN.synth === 'absent' ? undefined : function (t) { this.text = t; };
  }
  /* écoute : scénario ear ('ok' ou 'refuse') pour la reconnaissance vocale du téléphone, dict ('ok') pour la dictée de Claude.
     Les phrases « dites » se mettent dans window.__say ; sans scénario, la page n'a aucun micro. */
  window.__say = []; window.__ear = [];
  const noRec = () => { ['SpeechRecognition', 'webkitSpeechRecognition'].forEach((k) => { try { Object.defineProperty(window, k, {value: undefined, configurable: true, writable: true}); } catch (e) { /* rien */ } }); };
  noRec();
  if (SCEN.ear) {
    const Rec = function () { this._t = []; };
    Rec.prototype.start = function () {
      const r = this; window.__ear.push('start');
      if (SCEN.ear === 'refuse') { r._t.push(setTimeout(() => { if (r.onerror) r.onerror({error: 'not-allowed'}); if (r.onend) r.onend(); }, 20)); return; }
      if (SCEN.ear === 'muet') return; /* l'app ne répond jamais : ni début, ni erreur, ni fin */
      if (SCEN.ear === 'reseau') { r._t.push(setTimeout(() => { if (r.onerror) r.onerror({error: 'network'}); if (r.onend) r.onend(); }, 40)); return; }
      if (SCEN.ear === 'jette') throw new Error('NotAllowedError');
      r._t.push(setTimeout(() => { if (r.onstart) r.onstart(); }, 50));
      let n = 0;
      const turn = () => {
        const p = window.__say.shift();
        if (!p) { if (++n > 10) { if (r.onerror) r.onerror({error: 'no-speech'}); if (r.onend) r.onend(); return; } r._t.push(setTimeout(turn, 250)); return; }
        if (r.onresult) r.onresult({resultIndex: 0, results: [Object.assign([{transcript: p.slice(0, Math.ceil(p.length / 2))}], {isFinal: false})]});
        r._t.push(setTimeout(() => { if (r.onresult) r.onresult({resultIndex: 0, results: [Object.assign([{transcript: p}], {isFinal: true})]}); r._t.push(setTimeout(() => { if (r.onend) r.onend(); }, 50)); }, 200));
      };
      r._t.push(setTimeout(turn, 150));
    };
    Rec.prototype.abort = function () { this._t.forEach(clearTimeout); window.__ear.push('abort'); };
    Rec.prototype.stop = Rec.prototype.abort;
    Object.defineProperty(window, 'webkitSpeechRecognition', {value: Rec, configurable: true, writable: true});
  }
  let dict = null;
  if (SCEN.dict) {
    const hs = {p: [], f: [], s: []}; let live = false, poll = 0;
    const st = (state, reason) => hs.s.forEach((fn) => fn({state, reason}));
    dict = {active: () => live, onPartial: (fn) => { hs.p.push(fn); return () => {}; }, onFinal: (fn) => { hs.f.push(fn); return () => {}; }, onState: (fn) => { hs.s.push(fn); return () => {}; },
      start: async (o) => { window.__ear.push('dict:start:' + (o && o.language)); await delay(null, 30); live = true; st('listening'); clearInterval(poll); poll = setInterval(() => { const p = live && window.__say.shift(); if (!p) return; hs.p.forEach((fn) => fn({text: p.slice(0, 8)})); setTimeout(() => { hs.p.forEach((fn) => fn({text: ''})); hs.f.forEach((fn) => fn({text: p})); }, 150); }, 250); },
      stop: async () => { window.__ear.push('dict:stop'); live = false; clearInterval(poll); st('idle', 'stopped'); }};
  }
  window.claude = {use: async (name) => { await delay(null, 10); if (SCEN.offline) return null; return name === 'mcp' ? mcp : name === 'sample' ? (SCEN.noSample ? null : sample) : name === 'tts' ? tts : name === 'dictation' ? dict : null; }};
  G['Canal'].push([fr(D(0)), 'Chronos', 'Rabie', 'CRA client', 'Oui/Non : Soumettre le CRA client de la semaine du ' + fr(D(-2)).slice(0, 5) + ' | Jours : télétravail et congés selon Présence | Pourquoi : congés confirmés dans Présence ; aucun férié | Avant le : ' + fr(D(2)), 'Attend ton oui', '', '']);
  /* scénario pending : n ordres du propriétaire encore « À faire », datés d'aujourd'hui */
  if (SCEN.pending) for (let i = 1; i <= SCEN.pending; i++) G['Canal'].push([fr(D(0)), 'Rabie', 'Iris', 'Ordre', 'Ordre numéro ' + i, 'À faire', '', '']);
  /* 0.23.0 : un comparatif déjà préparé par Claude (en vrai : sur le serveur, avec le web) pour le produit à deux variantes */
  const pic = (c) => 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect x="53" y="8" width="14" height="74" rx="7" fill="' + c + '"/><circle cx="60" cy="20" r="13" fill="#94a3b8"/><rect x="28" y="80" width="64" height="20" rx="9" fill="#334155"/></svg>');
  window.__COMPARATIFS = [{key: 'demo-beta', famille: 'Aspirateur Beta V9', produits: ['Aspirateur Beta V9 Absolute', 'Aspirateur Beta V9 Submarine'], at: Date.now() - 864e5, statut: 'pret', prix: {},
    data: {resume: 'Le même aspirateur sans fil ; le Submarine ajoute une brosse qui lave les sols durs.', difference_cle: 'Le Submarine lave en plus d’aspirer : utile seulement avec beaucoup de carrelage ou de parquet vitrifié.',
      criteres: [{nom: 'Aspiration', unite: 'AW', plus_haut_mieux: true}, {nom: 'Autonomie', unite: 'min', plus_haut_mieux: true}, {nom: 'Poids', unite: 'kg', plus_haut_mieux: false}],
      variantes: [
        {nom: 'Aspirateur Beta V9 Absolute', pour_qui: 'Un logement avec tapis et sols mixtes.', utilite: 'Aspiration quotidienne, poils et miettes.', points_forts: ['Léger', 'Très bonne aspiration'], limites: ['Ne lave pas'], valeurs: {Aspiration: 230, Autonomie: 60, Poids: 2.9}, qualite: 8, rqp: 8, verdict: 'Le bon choix si tu n’as pas besoin de laver.', prix: 749, photo: pic('#a78bfa')},
        {nom: 'Aspirateur Beta V9 Submarine', pour_qui: 'Beaucoup de sols durs à laver.', utilite: 'Aspire puis lave les sols durs.', points_forts: ['Brosse de lavage', 'Même moteur'], limites: ['Plus lourd', '100 € de plus'], valeurs: {Aspiration: 230, Autonomie: 60, Poids: 3.2}, qualite: 8.5, rqp: 7, verdict: 'À prendre seulement pour le lavage.', prix: 849, photo: pic('#38bdf8')}],
      conseil: 'Prends l’Absolute, sauf si tu laves souvent des sols durs.', certitude: 'likely', sources: ['https://example.org/test-beta']}}];
  /* 0.24.0 : une recherche d'idées d'exemple (produits fictifs) */
  const house = (c, r) => 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="M20 58L60 22l40 36" fill="none" stroke="' + r + '" stroke-width="8" stroke-linejoin="round"/><rect x="28" y="56" width="64" height="48" rx="3" fill="' + c + '"/><rect x="38" y="66" width="16" height="14" fill="#fff"/><rect x="66" y="66" width="16" height="14" fill="#fff"/><rect x="52" y="84" width="16" height="20" fill="#7c4a1e"/></svg>');
  const PROP = (nom, marque, prix, vendeur, age, why, plus, moins, q, r, photo, page) => ({nom, marque, prix, prix_detail: prix >= 49 ? 'livraison offerte' : 'livraison 4,99 € comprise', vendeur, lien: 'https://example.org/' + encodeURIComponent(nom.toLowerCase().replace(/\s+/g, '-')), date_prix: fr(D(0)), age, pourquoi: why, points_forts: plus, limites: moins, qualite: q, rqp: r, photo, page: page || {ok: true, prix: null}});
  window.__IDEES = [{id: 'demo-maison', idee: 'Maison de poupée', pour: 'fille de 3 ans', min: 30, max: 60, n: 6, at: Date.now() - 36e5, statut: 'pret', erreur: '',
    data: {comprehension: 'Une maison de poupée solide pour une petite fille de 3 ans, entre 30 et 60 € livrée.', conseils: 'À 3 ans : bois ou plastique épais, pas de petites pièces ni d’aimants, des personnages assez grands pour ses mains. Une maison ouverte (sans façade) se joue plus facilement.',
      propositions: [
        PROP('Maison des Lutins en bois', 'Atelier Pin', 54.9, 'Jouets du Coin', 'dès 3 ans', 'En bois massif, ouverte sur l’avant, avec 4 personnages assez gros pour 3 ans.', ['Très solide', '14 meubles inclus'], ['Montage 20 min'], 8.6, 8.2, house('#f9a8d4', '#be185d'), {ok: true, prix: 54.9}),
        PROP('Maison pliante Mini Cocon', 'Lumibois', 39.9, 'Grande Enseigne', 'dès 3 ans', 'Se referme comme une valise : pratique à ranger et à emporter.', ['Se transporte', 'Pas de montage'], ['Peu de meubles'], 7.4, 8.4, house('#a5b4fc', '#4338ca')),
        PROP('Grande villa Arc-en-ciel', 'Kidoria', 59.5, 'Site du fabricant', 'dès 3 ans', 'La plus grande : trois étages et un ascenseur à manivelle.', ['Trois étages', 'Ascenseur'], ['Encombrante (80 cm)'], 8.1, 7.1, house('#fde68a', '#b45309'), {ok: true, prix: 64.9}),
        PROP('Maison sonore Petit Nid', 'Hopla', 44.0, 'Jouets du Coin', 'dès 2 ans', 'Des sons (sonnette, chasse d’eau) qui plaisent beaucoup à cet âge.', ['Sons amusants', 'Plastique épais'], ['Piles fournies, mais à changer'], 7, 7.6, house('#99f6e4', '#0f766e')),
        PROP('Cottage en tissu Doudou', 'Filou', 34.9, 'Boutique en ligne', 'dès 18 mois', 'Tout doux, sans aucune pièce dure : idéal si elle joue encore beaucoup par terre.', ['Lavable', 'Très léger'], ['Moins de jeu d’imitation'], 6.8, 7.4, '', {ok: false, prix: null}),
        PROP('Ferme-maison 2 en 1', 'Atelier Pin', 49.0, 'Grande Enseigne', 'dès 3 ans', 'Maison d’un côté, ferme de l’autre : deux jeux en un.', ['Deux jeux', 'Bois certifié'], ['Animaux vendus à part'], 7.8, 7.7, house('#bbf7d0', '#15803d'))],
      /* 0.29.0 : ce qui manque de peu, et les pistes de Claude pour relancer */
      presque: [Object.assign(PROP('Maison lumineuse Étoile', 'Kidoria', 69.9, 'Grande Enseigne', 'dès 3 ans', 'Éclairage LED dans chaque pièce, très demandé à cet âge.', ['Lumières LED', 'Bois solide'], ['Piles non fournies'], 8.3, 7.4, house('#fbcfe8', '#be185d')), {ecart: '10 € au-dessus'})],
      pistes: [{texte: 'Monte le maximum à 70 € : la maison lumineuse Étoile entre', idee: '', min: null, max: 70}, {texte: 'Cherche plutôt une maison en tissu, plus légère', idee: 'maison de poupée en tissu', min: null, max: null}],
      hors_budget: 1, certitude: 'likely', sources: ['https://example.org/guide-jouets-3-ans', 'https://example.org/tests-maisons']}}];
  /* Radar (maquette du 21/11/2026) : ce que le serveur tirera des mails (prélèvements à venir, alertes, abonnements, total du mois,
     conseil Navigo). Tout est inventé : aucun service ni montant réel du propriétaire (dépôt public). */
  const rIso = (n) => { const d = D(n); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  const rMoisL = (k) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + k); return d.toLocaleDateString('fr-FR', {month: 'long', year: 'numeric'}); };
  window.__RADAR = {maj: (() => { const d = new Date(); d.setHours(6, 50, 0, 0); return d.toISOString(); })(),
    mois: {libelle: rMoisL(0), precedentLibelle: rMoisL(-1), total: 641.37, precedent: 598.20, postes: [
      {id: 'contrats', label: 'Contrats : box, mobile, énergie, assurance', montant: 251.43, n: 5},
      {id: 'repas', label: 'Repas livrés', montant: 211.60, n: 10, note: '10 commandes, 21,16 € en moyenne'},
      {id: 'achats', label: 'Achats en ligne', montant: 62.75, n: 4},
      {id: 'abonnements', label: 'Abonnements', montant: 61.47, n: 6},
      {id: 'transport', label: 'Transport', montant: 54.12, n: 1}]},
    avenir: [
      {date: rIso(41), service: 'Plateforme d’animation', montant: 69.99, avant: 59.99, type: 'hausse', rythme: 'annuel', note: 'Hausse annoncée par mail ; elle s’applique au renouvellement.'},
      {date: rIso(3), service: 'Console de jeux, abonnement en ligne', montant: 79.99, avant: 59.99, type: 'renouvellement', rythme: 'annuel', note: 'Payé 59,99 € l’an dernier en promotion : le prix normal revient.'},
      {date: rIso(6), service: 'Assistant IA', montant: 21.60, type: 'renouvellement', rythme: 'mensuel', note: 'Passé en note de frais chaque mois.'},
      {date: rIso(24), service: 'Appli de notes', montant: 7.99, type: 'essai', rythme: 'mensuel', note: 'Fin de l’essai gratuit : premier prélèvement si rien n’est fait.'},
      {date: rIso(12), service: 'Stockage photos', montant: 2.99, type: 'renouvellement', rythme: 'mensuel'},
      {date: rIso(55), service: 'Assurance auto', montant: null, type: 'fin', rythme: 'annuel', note: 'Échéance du contrat : un comparatif peut être prêt un mois avant.'},
      {date: rIso(32), service: 'Paiement en 4 fois : Boutique', montant: 29.55, type: 'echeance', plan: 'pl1', note: 'Échéance 4 sur 4.'}],
    alertes: [
      {id: 'ra1', date: rIso(-6), type: 'echec', titre: 'Paiement échoué', service: 'Plateforme vidéo', montant: 9.99, texte: '3 tentatives : l’abonnement s’arrête si le moyen de paiement n’est pas mis à jour.'},
      {id: 'ra2', date: rIso(-9), type: 'essai', titre: 'Essai gratuit qui devient payant', service: 'Appli de notes', montant: 7.99, texte: 'Premier prélèvement dans 24 jours.'},
      {id: 'ra3', date: rIso(-21), type: 'hausse', titre: 'Hausse de prix', service: 'Plateforme d’animation', montant: 69.99, avant: 59.99, texte: 'À partir du prochain renouvellement.'},
      {id: 'ra4', date: rIso(-33), type: 'inhabituel', titre: 'Facture deux fois plus haute que d’habitude', service: 'Électricité', montant: 96.40, avant: 48.20, texte: 'Habituellement 48,20 € par mois.'}],
    abonnements: [
      {service: 'Plateforme vidéo', cat: 'Vidéo et musique', prix: 9.99, rythme: 'mensuel', depuis: '03/2023'},
      {service: 'Plateforme d’animation', cat: 'Vidéo et musique', prix: 59.99, rythme: 'annuel', depuis: '01/2022', hausse: 'passe à 69,99 €'},
      {service: 'Musique en famille', cat: 'Vidéo et musique', prix: 17.99, rythme: 'mensuel', depuis: '05/2025'},
      {service: 'Console de jeux, abonnement en ligne', cat: 'Jeux', prix: 79.99, rythme: 'annuel', depuis: '11/2025'},
      {service: 'Stockage photos', cat: 'Services en ligne', prix: 2.99, rythme: 'mensuel', depuis: '02/2022'},
      {service: 'Assistant IA', cat: 'Services en ligne', prix: 21.60, rythme: 'mensuel', depuis: '02/2026'},
      {service: 'VPN', cat: 'Services en ligne', prix: 89.00, rythme: 'annuel', depuis: '08/2021', hausse: '2 ans prépayés'},
      {service: 'Livraison de repas, abonnement', cat: 'Livraison', prix: 5.99, rythme: 'mensuel', depuis: '05/2023'},
      {service: 'Achats en ligne, livraison rapide', cat: 'Livraison', prix: 59.90, rythme: 'annuel', depuis: '2018'}],
    /* Reste à payer (21/11/2026) : ses dépenses fixes, chacune avec son jour de prélèvement, et le jour de sa paie (le 28, avancée si
       week-end ou férié). Les abonnements reprennent les dates de « À venir ». Tout est inventé. */
    fixes: [
      {id: 'f1', service: 'Crédit immobilier', cat: 'Logement', montant: 1150.00, jour: 5, rythme: 'mensuel', source: 'toi'},
      {id: 'f2', service: 'Assurance emprunteur', cat: 'Logement', montant: 38.40, jour: 5, rythme: 'mensuel', source: 'toi'},
      {id: 'f3', service: 'Assurance habitation', cat: 'Logement', montant: 16.90, jour: 10, rythme: 'mensuel', source: 'mail'},
      {id: 'f4', service: 'Électricité', cat: 'Logement', montant: 48.20, jour: 12, rythme: 'mensuel', source: 'mail'},
      {id: 'f5', service: 'Box internet', cat: 'Télécoms', montant: 29.99, jour: 8, rythme: 'mensuel', source: 'mail'},
      {id: 'f6', service: 'Forfait mobile', cat: 'Télécoms', montant: 9.99, jour: 3, rythme: 'mensuel', source: 'mail'},
      {id: 'f7', service: 'Navigo Liberté+', cat: 'Transport', montant: 36.72, jour: 10, rythme: 'mensuel', estime: true, source: 'mail'},
      {id: 'f8', service: 'Assurance auto', cat: 'Transport', montant: 52.30, jour: 15, rythme: 'mensuel', source: 'mail'},
      {id: 'f9', service: 'Complémentaire santé', cat: 'Santé', montant: 24.50, jour: 25, rythme: 'mensuel', source: 'toi'},
      {id: 'f10', service: 'Plateforme vidéo', cat: 'Abonnements', montant: 9.99, jour: 15, rythme: 'mensuel', source: 'mail'},
      {id: 'f11', service: 'Musique en famille', cat: 'Abonnements', montant: 17.99, jour: 20, rythme: 'mensuel', source: 'mail'},
      {id: 'f12', service: 'Livraison de repas, abonnement', cat: 'Abonnements', montant: 5.99, jour: 22, rythme: 'mensuel', source: 'mail'},
      {id: 'f13', service: 'Assistant IA', cat: 'Abonnements', montant: 21.60, jour: D(6).getDate(), rythme: 'mensuel', source: 'mail'},
      {id: 'f14', service: 'Stockage photos', cat: 'Abonnements', montant: 2.99, jour: D(12).getDate(), rythme: 'mensuel', source: 'mail'},
      {id: 'f15', service: 'Console de jeux, abonnement en ligne', cat: 'Abonnements', montant: 79.99, jour: D(3).getDate(), mois: D(3).getMonth() + 1, rythme: 'annuel', source: 'mail'},
      {id: 'f16', service: 'Plateforme d’animation', cat: 'Abonnements', montant: 69.99, jour: D(41).getDate(), mois: D(41).getMonth() + 1, rythme: 'annuel', source: 'mail'}],
    revenus: {jour: 28, avance: true},
    notif: {veille: true, seuil: 20, echec: true},
    /* ce que le serveur trouve dans les mails : un paiement en 4 fois en cours et un autre fini (0.68.0 : un plan par achat), leurs échéances à venir,
       et des dépenses récurrentes à valider (inventés) */
    plans: [{id: 'pl1', nom: 'Paiement en 4 fois : Boutique', service: 'Boutique', via: 'PayPal', fois: 4, total: 118.2, payees: 2, reste: 59.1, prochaine: {date: rIso(2), montant: 29.55}, fin: rIso(32), objet: 'Votre plan de paiements Paiement en 4X est prêt',
      echeances: [{date: rIso(-58), montant: 29.55, payee: true}, {date: rIso(-28), montant: 29.55, payee: true}, {date: rIso(2), montant: 29.55}, {date: rIso(32), montant: 29.55}]},
      {id: 'pl2', nom: 'Paiement en 3 fois : Magasin de sport', service: 'Magasin de sport', via: 'Cofidis', fois: 3, total: 89.97, payees: 3, reste: 0, prochaine: null, fin: rIso(-15), objet: 'Consultez l’échéancier de vos achats financés',
        echeances: [{date: rIso(-75), montant: 29.99, payee: true}, {date: rIso(-45), montant: 29.99, payee: true}, {date: rIso(-15), montant: 29.99, payee: true}]}],
    ponctuels: [{id: 'pl1-2', plan: 'pl1', date: rIso(2), service: 'Paiement en 4 fois : Boutique', montant: 29.55}, {id: 'pl1-3', plan: 'pl1', date: rIso(32), service: 'Paiement en 4 fois : Boutique', montant: 29.55}],
    propositions: [{id: 'pa', service: 'Club de sport', cat: 'Autres', montant: 29.90, jour: 26, rythme: 'mensuel', source: 'mail', preuves: 6, dernier: rIso(-28), depuis: '05/2026', exemple: {objet: 'Votre facture du mois', date: rIso(-28)}},
      {id: 'pb', service: 'Stockage en ligne', cat: 'Abonnements', montant: 1.99, jour: 14, rythme: 'mensuel', source: 'mail', preuves: 12, dernier: rIso(-9), depuis: '11/2025', exemple: {objet: 'Reçu de votre paiement mensuel', date: rIso(-9)}},
      {id: 'pc', service: 'Garde d’enfant (exemple)', cat: 'Autres', montant: null, jour: 5, jourApprox: true, rythme: 'mensuel', source: 'mail', preuves: 13, dernier: rIso(-18), depuis: '11/2025', exemple: {objet: 'Votre facture du mois (en pièce jointe)', date: rIso(-18)}}],
    scan: {enCours: false, mois: 13, total: 13, lus: 412, fini: Date.now(), erreur: ''}, google: true,
    navigo: {mois: rMoisL(1), conseil: 'liberte', joursSite: 9, liberte: 36.72, moisNet: 45.40, texte: '9 jours sur site prévus, avec une semaine de congés : reste en Liberté+ (environ 36,72 €). Le Navigo Mois coûterait 45,40 € après le remboursement de 50 %.'}};
  /* 0.23.0 : la météo de l'accueil (en vrai : Open-Meteo, à la position de l'iPhone) */
  window.__METEO = {current: {temperature_2m: 9.4, apparent_temperature: 6.2, weather_code: 3}, daily: {time: [fr(D(0)), fr(D(1))], weather_code: [3, 61], temperature_2m_min: [4, 2], temperature_2m_max: [11, 7], precipitation_probability_max: [10, 70]}};
  window.__G = G; window.__MAIL = MAIL; window.__CAL = CAL;
  /* 0.85.0 : l'espace « Travail » de la maquette (données inventées, même forme que GET /api/travail) */
  /* 0.86.0 : une note de frais d'Hermes à valider (données inventées, même forme que GET /api/jours/notes) */
  if (SCEN.notes) window.__NOTES = {notes: [{cle: 'box:2026-11', sorte: 'box', mois: '2026-11', nom: 'Note de la box', etat: 'a_valider', valide: false, montant: 39, date: '2026-11-05', jours: null,
    champs: [['Date', '05/11/2026'], ['Vendeur', 'Fournisseur inventé'], ['Catégorie', 'Internet'], ['Montant TTC', '39,00'], ['Commentaire', 'Box novembre 2026']], justificatif: 'facture.pdf', taille: 48213,
    empreinte: 'abcdef0123456789abcdef0123456789', texte: 'Préparée et vérifiée à blanc sur le portail.', at: now - 3600000}]};
  window.__TRAVAIL = {maj: now, aujourdhui: '2026-11-26', frise: [{date: '2026-11-27', quand: 'ven. 27/11', quoi: 'CRA du client (hebdo)', qui: 'ton oui, puis Hermes', toi: true}, {date: '2026-11-30', quand: 'lun. 30/11', quoi: 'Télétravail', qui: 'Hermes à blanc', toi: false}, {date: '2026-12-04', quand: 'ven. 04/12', quoi: 'Grok Bot', qui: 'Chronos', toi: false}],
    routines: [
      {id: 'jours', bloc: 'jours', titre: 'Jours de novembre', qui: 'reel', quiDit: 'JARVIS', prochaine: 'lun. 30/11 · relu', etapes: [['Bilan (24)', 'fait'], ['Ton oui', 'fait'], ['Lieux notés', 'encours'], ['Relu (30)', '']], prevu: {texte: 'Novembre', puces: [['17 jours travaillés', ''], ['3 congés', 'non'], ['1 férié', 'non'], ['2 lieux à venir', 'amb']]}, derniere: {quand: '24/11', quoi: 'congés validés', par: 'toi', ok: true}, toi: '', ouvrir: 'jours'},
      {id: 'semaine', bloc: 'cra', titre: 'CRA du client (hebdo)', qui: 'reel', quiDit: 'Hermes · réel', prochaine: 'ven. 27/11 · 12 h', lundi: '2026-11-23', etapes: [['Bilan du vendredi', ''], ['Ton oui', ''], ['Saisie et Submit', ''], ['Compte rendu', '']], prevu: {texte: 'Semaine du 23/11 au 27/11', puces: [['bilan le vendredi à midi', 'non']]}, derniere: {quand: '20/11', quoi: 'soumise', par: 'Chronos', ok: true}, toi: '', ouvrir: 'semaine'},
      {id: 'mois', bloc: 'cra', titre: 'CRA de la société de portage', qui: 'reel', quiDit: 'Hermes · réel', prochaine: '26/12', etapes: [['Congés validés', 'fait'], ['Mail au client', 'fait'], ['CRA validé', 'fait'], ['CRA du client reçu', 'encours'], ['Rattaché', '']], prevu: {texte: 'Novembre', puces: [['17 jours de mission', ''], ['3 congés', 'non'], ['1 férié', 'non']]}, alerte: 'Fin de mission le 30/11/2026. Mail de prolongation envoyé le 26/11.', mails: [{quoi: 'Mail « CRA Novembre 2026 »', quand: '26/11', etat: 'envoyé'}], derniere: {quand: '26/11', quoi: 'validé', par: 'Hermes', ok: true}, toi: '', ouvrir: 'mois'},
      {id: 'claude', bloc: 'frais', titre: 'Abonnement Claude', qui: 'chronos', quiDit: 'Chronos', prochaine: 'lun. 21/12', etapes: [['Facture lue', 'fait'], ['Dépense à blanc', 'fait'], ['Identique à Chronos', 'fait'], ['Part seule', ''], ['Bascule', '']], derniere: {quand: '21/11', quoi: 'dépense créée', par: 'Chronos', ok: true}, ouvrir: 'note'},
      {id: 'box', bloc: 'frais', titre: 'Box internet', qui: 'chronos', quiDit: 'Chronos', prochaine: 'mar. 15/12', etapes: [['Facture téléchargée', 'fait'], ['Dépense à blanc', 'fait'], ['Identique à Chronos', 'fait'], ['Part seule', ''], ['Bascule', '']], derniere: {quand: '15/11', quoi: 'dépense créée', par: 'Chronos', ok: true}, ouvrir: 'note'},
      {id: 'teletravail', bloc: 'frais', titre: 'Télétravail', qui: 'chronos', quiDit: 'Chronos le 1er · Hermes à blanc le dernier jour', prochaine: 'lun. 30/11', etapes: [['Jours (JARVIS)', 'fait'], ['Électricité', ''], ['Charges et pièces', ''], ['PDF', ''], ['À blanc', '']], derniere: {quand: '01/11', quoi: 'octobre, remboursée', par: 'Chronos', ok: true}, ouvrir: 'note'},
      {id: 'grok', bloc: 'frais', titre: 'Grok Bot', qui: 'chronos', quiDit: 'Chronos', prochaine: 'ven. 04/12', etapes: [['Chronos jusqu’à l’arrêt de Grok', 'fait']], derniere: {quand: '04/11', quoi: 'dépense créée', par: 'Chronos', ok: true}, ouvrir: 'note'}]};
  /* 0.94.0 : les réponses aux deux mails du mois sont arrivées (données inventées, même forme que GET /api/travail) */
  if (SCEN.reponses) Object.assign(window.__TRAVAIL.routines.find((r) => r.id === 'mois'), {mois: '2026-11', etapes: [['Congés validés', 'fait'], ['Mail au client', 'fait'], ['CRA validé', 'fait'], ['CRA du client reçu', 'fait'], ['Rattaché', 'encours']],
    alerte: 'Fin de mission le 30/11/2026. Réponse à ton mail de prolongation reçue le 26/11 à 16 h 20 : à lire.', attend: ['CRA signé reçu : à rattacher', 'Réponse à ton mail de prolongation : à lire'], rattachable: true,
    toi: 'CRA signé reçu : à rattacher sur le portail (onglet du haut de la page du CRA). Réponse à ton mail de prolongation : à lire.',
    mails: [{sorte: 'cra', quoi: 'Mail « CRA Novembre 2026 »', quand: '26/11', etat: 'CRA signé reçu', envoye: 'envoyé le 26/11 à 09 h 02', url: 'https://mail.google.com/mail/#all/filcra0001',
      reponses: [{de: 'Contact Client', quand: 'le 26/11 à 14 h 05', extrait: 'Bonjour, ci-joint le CRA signé. Bonne journée.', pdf: true, lu: true, url: 'https://mail.google.com/mail/#all/filcra0001'}]},
    {sorte: 'prolongation', quoi: 'Mail « Prolongation de mission »', quand: '26/11', etat: 'réponse reçue', envoye: 'envoyé le 26/11 à 09 h 03', url: 'https://mail.google.com/mail/#all/filpro0001',
      reponses: [{de: 'Équipe Missions', quand: 'le 26/11 à 16 h 20', extrait: 'Bonjour, nous avons bien reçu ta demande et revenons vers toi. ' + 'x'.repeat(200), pdf: false, lu: false, url: 'javascript:alert(1)'}]}]});
})();
