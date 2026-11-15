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
    [fr(D(-2)), 'Chronos', 'CRA Allegis semaine du ' + fr(D(-5)).slice(0, 5), 'Oui/Non : Je soumets le CRA de la semaine du ' + fr(D(-5)).slice(0, 5) + ' (4 jours) ? | Pourquoi : il part vendredi à midi | Si oui : il est envoyé au portail | Si non : je te redemande lundi | Conseil : Oui | Temps : 1 min'],
    [fr(D(-2)), 'Kairos', 'Robot cuiseur', 'Choix : Quel vendeur pour le robot cuiseur ? | Options : Vendeur officiel / Grande enseigne / Attendre | Pourquoi : même prix chez deux vendeurs'],
    [fr(D(-1)), 'Iris', 'Relance syndic', 'Brouillon : La relance au syndic est prête | Lien : https://mail.google.com/mail/#drafts?compose=DRAFT1 | Pourquoi : sans réponse depuis 10 jours'],
    [fr(D(-1)), 'Iris', 'Attestation', "Brouillon : Demande d'attestation prête | À : agence@example.org | Objet : Demande d'attestation | Texte : Bonjour, pouvez-vous m'envoyer l'attestation ? Merci."],
    [fr(D(-2)), 'Argus', 'Installation', 'Ton oui dans le chat de Argus : appliquer les 3 routines. Phrase : Oui, applique les routines.'],
    [fr(D(-2)), 'Argus', 'Skill registre', 'Ton oui dans le chat de Argus : mettre le skill à jour. Phrase : Oui, mets le skill à jour.'],
    [fr(D(-3)), 'Ulysse', 'Dates du voyage', 'Quelles dates préfères-tu pour le voyage ?']
  ];
  G['Échéances'] = [
    ['Date', 'Sujet', 'Domaine', 'Rappels', 'Statut', 'Bot', 'Remarque', 'Nature'],
    [fr(D(-2)), "Envoyer l'attestation à l'école", 'Famille', '', 'À venir', 'Iris', 'Demandée par la directrice', 'À faire par moi'],
    [fr(D(6)), 'Rendez-vous notaire (14h30)', 'Famille', '', 'À venir', 'Iris', 'Événement important ajouté depuis la page', 'Date à retenir'],
    [fr(D(0)), 'Rendez-vous médecin', 'Famille', '', 'À venir', 'Iris', 'Cabinet du centre', 'Date à retenir'],
    [fr(D(2)), 'CRA Allegis de la semaine', 'Travail', '', 'À venir', 'Chronos', 'Saisie sur le portail', "Un bot s'en occupe"],
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
    ['Relance syndic', 'En attente', 'Envoyer la relance', fr(D(5)), 'Rabie', fr(D(-10)), '', 'Iris', fr(D(-1)), 'Pourquoi : sans réponse | Si oui : la relance part']
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
    [stamp(at(-8, 17, 0)), 'Robot Alpha X7', 'Marque Alpha', '1 599,00', '', 'Kairos', ''],
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
    ['Chronos', 'CRA Allegis', 'Horaire', 'Ven 12h', 'x', 'x', 'En place'],
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
    ['Chronos', stamp(at(-1, 12, 0)), 'CRA préparé', nextP(6, 12, 0, 'CRA Allegis')],
    ['Kairos', stamp(at(-1, 17, 0)), 'Prix relevés', nextP(1, 17, 0, 'Prix suivis')],
    ['Ulysse', stamp(at(-2, 19, 0)), 'Idées', nextP(5, 19, 0, 'Sorties')],
    ['Athéna', stamp(at(-5, 9, 0)), 'Digest', nextP(2, 9, 0, 'Digest')],
    ['Argus', stamp(at(-1, 8, 44)), 'Supervision', nextP(2, 8, 44, 'Supervision')]
  ] : [
    ['Bot', 'Dernier passage', "Ce que j'ai fait", 'Prochain passage', 'Dernier tour de Gmail'],
    ['Iris', stamp(at(-1, 0, 15)), 'Doublon repéré', nextP(-1, 7, 30, 'Veille du matin')],
    ['Chronos', fr(D(-2)) + ' 18:53', 'Renommage', fr(D(-1)) + ' 11:43 (CRA Allegis)'],
    ['Kairos', fr(D(-1)) + ' 00:15', 'Relevé Jeu Gamma', fr(D(1)) + ' 16:57 (Prix suivis)'],
    ['Ulysse', fr(D(-2)) + ' 19:45', 'Bloc Voyages', fr(D(5)) + ' 19:13 (Sorties du week-end)'],
    ['Athéna', fr(D(-2)) + ' 18:52', 'Renommée', fr(D(2)) + ' 08:54 (Digest IA du lundi)'],
    ['Argus', stamp(at(-1, 0, 20)), 'Skill à jour', nextP(-1, 8, 44, 'Supervision')]
  ];
  G['Faits'] = [
    ['Domaine', 'Fait', 'Valeur', 'Mis à jour le', 'Source'],
    ['Foyer', 'Fille', 'Maya, née le 03/02/2023', fr(D(-9)), ''],
    ['Voyages', 'Vols', 'Directs de préférence', fr(D(-9)), ''],
    ['Voyages', 'Destinations envisagées', 'Japon (printemps), Sicile, Maroc (Marrakech, Essaouira)', fr(D(-9)), ''],
    ['Assistants', 'Sonnette Jarvis', 'bots+jarvis@mail.grokbot.com', fr(D(-3)), ''],
    ['Foyer', 'Père', 'Prénom Nom, anniversaire le ' + fr(D(4)).slice(0, 5) + ' (année non connue).', fr(D(-2)), '']
  ];
  if (SCEN.bells) G['Faits'].push(['Assistants', 'Sonnette Kairos', 'bots+kairos@mail.grokbot.com', '', ''], ['Assistants', 'Lien Grok Argus', 'https://grok.com/bots/abc123', '', ''], ['Assistants', 'Sonnette Pirate', 'x@evil.example', '', '']);
  if (SCEN.pauseUntil) G['Faits'].push(['Grok Bot', "Grok en pause jusqu'au", SCEN.pauseUntil, '', 'Jarvis']);
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
  const wk = (() => { const d = new Date().getDay(); return d === 0 ? [-1, 0] : d === 6 ? [0, 1] : [6 - d, 7 - d]; })();
  G['Sorties'] = [
    ['Sortie', 'Où', 'Début', 'Fin', 'Prix total TTC (2 adultes et Maya)', 'Trajet', 'Âge conseillé', 'Lien', 'Statut', 'Proposée le', 'Bot', 'Remarque'],
    ["Boucle d'or (spectacle)", 'La Clef', fr(D(wk[0])), fr(D(wk[1])), '', '', '', '', 'Proposée', fr(D(-2)), 'Ulysse', 'À compléter'],
    ['Ferme pédagogique', 'Gally', fr(D(wk[0])), fr(D(wk[1])), '24', '25 min en voiture', 'dès 2 ans', 'https://example.org/ferme', 'Proposée', fr(D(-2)), 'Ulysse', ''],
    ['Marché de Noël', 'La Défense', fr(D(12)), fr(D(40)), '0', '30 min', 'tous', '', 'Proposée', fr(D(-2)), 'Ulysse', ''],
    ['Exposition finie', 'Paris', fr(D(-20)), fr(D(-3)), '12', '', '', '', 'Proposée', fr(D(-25)), 'Ulysse', ''],
    ['Aquarium', 'Paris', '', '', '45', '40 min', 'dès 1 an', '', 'Faite', fr(D(-30)), 'Ulysse', ''],
    ['Idée refusée', 'x', '', '', '', '', '', '', 'Supprimée', '', 'Ulysse', '']
  ];

  /* agendas */
  const PRES = 'presence'; /* tout agenda secondaire (…@group.calendar.google.com) est pris pour l'agenda Présence */
  let evSeq = 0;
  const allDay = (n, summary, len) => ({id: 'pe' + (++evSeq), summary, status: 'confirmed', start: {date: isoD(D(n))}, end: {date: isoD(D(n + (len || 1)))}});
  const CAL = {};
  CAL[PRES] = [allDay(-5, 'Congé', 2), allDay(-2, 'Hors Domicile'), allDay(-1, 'Télétravail'), allDay(3, 'Télétravail')];
  CAL.primary = [
    {id: 'imp1', summary: 'Rendez-vous notaire', status: 'confirmed', colorId: '11', start: {dateTime: isoD(D(6)) + 'T14:30:00+01:00'}, end: {dateTime: isoD(D(6)) + 'T15:30:00+01:00'}, location: 'Étude'},
    {id: 'imp2', summary: 'Anniversaire', status: 'confirmed', colorId: '11', start: {date: isoD(D(30))}, end: {date: isoD(D(31))}, recurrence: ['RRULE:FREQ=YEARLY']},
    {id: 'imp3', summary: 'Visite médicale', status: 'confirmed', colorId: '11', start: {date: isoD(D(9))}, end: {date: isoD(D(10))}},
    {id: 'n1', summary: 'Réunion banale', status: 'confirmed', start: {date: isoD(D(1))}, end: {date: isoD(D(2))}}
  ];

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
      {id: 'DRAFT2', threadId: 'dth2', toRecipients: [], date: new Date(now - 3600000 * 40).toISOString(), subject: '', plaintextBody: 'Texte sans destinataire'}
    ]
  };

  /* plages A1 */
  const colN = (s) => s.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
  function parseRange(r) {
    const m = String(r).match(/^'?([^'!]+)'?!([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/);
    if (!m) throw {code: 'tool_error', message: 'plage illisible : ' + r};
    return {sheet: m[1], c1: colN(m[2]), r1: +(m[3] || 1), c2: m[4] ? colN(m[4]) : colN(m[2]), r2: m[5] ? +m[5] : (m[4] ? 1e6 : +(m[3] || 1))};
  }
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
      if (tool === 'delete_draft') { const i = MAIL.drafts.findIndex((d) => d.id === input.draftId); if (i < 0) throw {code: 'tool_error', server, message: 'brouillon introuvable'}; MAIL.drafts.splice(i, 1); return {}; }
      if (tool === 'unlabel_thread') { if (!input.threadId || !Array.isArray(input.labelIds)) throw {code: 'tool_error', server, message: 'arguments'}; const i = MAIL.inbox.findIndex((t) => t.id === input.threadId); if (i >= 0) MAIL.inbox.splice(i, 1); return {}; }
    }
    if (server === 'Claude Code Remote' && tool === 'fire_trigger') { /* scénario tasks : les seules tâches que ce compte possède */ if (SCEN.tasks && !SCEN.tasks.includes(input.trigger_id)) { const e = new Error('trigger not found'); e.code = 'tool_error'; throw e; } return {ok: true}; }
    throw {code: 'not_in_manifest', server, message: tool};
  }
  const mcp = {
    callTool: (server, tool, input) => delay(null).then(() => ({payload: exec(server, tool, input), content: []})),
    watchTool: (server, tool, input, handler) => {
      let stop = false;
      delay(null, 30).then(() => { if (stop) return; try { handler({type: 'data', result: {payload: exec(server, tool, input), content: [], cache: {storedAt: Date.now(), revalidating: false}}}); } catch (e) { handler({type: 'error', error: e}); } });
      return () => { stop = true; };
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
    samples.push({first: first.slice(0, 200), last: last.slice(0, 300), tools: (opts.tools || []).map((t) => t.name), tier: opts.modelTier});
    await delay(null, 40);
    let text;
    if (/en_clair/.test(first)) text = '{"en_clair": "On te demande un oui.", "si_oui": "Ça part.", "si_non": "Rien.", "conseil": "oui", "pourquoi_conseil": "simple", "temps": "1 min", "certitude": "Likely"}';
    else if (/"reponse"/.test(first)) text = '{"reponse": "La colonne Nature accepte six valeurs.", "faisable_ici": true, "pourquoi": ""}';
    else if (/reponse_utile/.test(first)) text = '{"resume": "L\'expert passe mardi à 10h.", "statut": "En cours", "prochaine_etape": "Confirmer la présence mardi", "pour_rabie": "Être présent mardi", "reponse_utile": true}';
    else {
      if (opts.tools && /ordre|relance|prépare/i.test(last)) { const t = opts.tools.find((x) => x.name === 'preparer_ordre'); if (t) await t.execute({bot: 'Iris', message: 'Prépare la relance du syndic.'}); }
      if (opts.tools && /tâche/i.test(last)) { const t = opts.tools.find((x) => x.name === 'ajouter_tache'); if (t) await t.execute({titre: 'Appeler le syndic', date: isoD(D(2))}); }
      if (opts.tools && /mise à jour/i.test(last)) { const t = opts.tools.find((x) => x.name === 'mettre_a_jour_dossier'); if (t) await t.execute({statut: 'En cours', prochaine_etape: 'Confirmer mardi', resume: 'Expert mardi', consigne_iris: 'Prépare la confirmation'}); }
      text = 'Voici ma réponse (certain).\n- Point un\n- Point deux\nSuite : Prépare l\'ordre pour Iris | Ça peut attendre ? | Quels papiers ?';
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
  window.claude = {use: async (name) => { await delay(null, 10); if (SCEN.offline) return null; return name === 'mcp' ? mcp : name === 'sample' ? (SCEN.noSample ? null : sample) : name === 'tts' ? tts : null; }};
  /* scénario pending : n ordres du propriétaire encore « À faire », datés d'aujourd'hui */
  if (SCEN.pending) for (let i = 1; i <= SCEN.pending; i++) G['Canal'].push([fr(D(0)), 'Rabie', 'Iris', 'Ordre', 'Ordre numéro ' + i, 'À faire', '', '']);
  window.__G = G; window.__MAIL = MAIL; window.__CAL = CAL;
})();
