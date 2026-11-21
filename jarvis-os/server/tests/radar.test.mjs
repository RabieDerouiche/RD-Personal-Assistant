/* Banc du Radar : node tests/radar.test.mjs (aucun vrai Google, aucun vrai Claude, aucun coût). Mails et montants inventés. */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {J, ymd, feries, occurrences, paies, resteA, trouverMontant, trouverDate, genre, avantApres, lireMail, regrouper, nomService, categorie, montantDe, createRadar} from '../radar.mjs';
import {interdit} from '../memoire.mjs';
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-'));
try {
  /* ---------- calendrier : le même que la page (lundi 23/11/2026, paie le 28 = un samedi) ---------- */
  const F = [['Crédit immobilier', 1150, 5], ['Assurance emprunteur', 38.4, 5], ['Assurance habitation', 16.9, 10], ['Électricité', 48.2, 12], ['Box internet', 29.99, 8], ['Forfait mobile', 9.99, 3],
    ['Navigo Liberté+', 36.72, 10], ['Assurance auto', 52.3, 15], ['Complémentaire santé', 24.5, 25], ['Plateforme vidéo', 9.99, 15], ['Musique en famille', 17.99, 20], ['Livraison de repas, abonnement', 5.99, 22],
    ['Assistant IA', 21.6, 29], ['Stockage photos', 2.99, 5]].map(([service, montant, jour], i) => ({id: 'f' + i, service, montant, jour, rythme: 'mensuel'}))
    .concat([{id: 'fa', service: 'Console de jeux, abonnement en ligne', montant: 79.99, jour: 26, mois: 11, rythme: 'annuel'}, {id: 'fb', service: 'Plateforme d’animation', montant: 69.99, jour: 3, mois: 1, rythme: 'annuel'}]);
  const lundi = J(2026, 10, 23), rev = {jour: 28, avance: true};
  ok('Radar : jours fériés 2026 (Pâques le 5 avril : lundi 6, Ascension 14 mai, Pentecôte 25 mai, 11 novembre)', ['2026-04-06', '2026-05-14', '2026-05-25', '2026-11-11', '2026-12-25'].every((d) => feries(2026).has(d)) && !feries(2026).has('2026-04-05'));
  const P = paies(rev, lundi);
  ok('Radar : la paie du samedi 28 novembre arrive le vendredi 27 ; la précédente, le mercredi 28 octobre', ymd(P.apres) === '2026-11-27' && ymd(P.avant) === '2026-10-28', ymd(P.avant) + ' ' + ymd(P.apres));
  const r1 = resteA(F, rev, lundi, 'paie'), r2 = resteA(F, rev, lundi, 'mois');
  ok('Radar : reste à payer 110,48 € d’ici la paie (le dimanche 22 passe au lundi 23) et 132,08 € d’ici la fin du mois, comme la page', r1.total === 110.48 && r2.total === 132.08 && ymd(r1.liste[0].le) === '2026-11-23' && ymd(r1.liste[0].brut) === '2026-11-22', r1.total + ' / ' + r2.total);
  ok('Radar : un prélèvement prévu un 11 novembre (férié) part le 12', ymd(occurrences({jour: 11, montant: 1}, J(2026, 10, 1), J(2026, 10, 30))[0].le) === '2026-11-12');
  ok('Radar : une dépense du 31 tombe le 30 en novembre (et celle du samedi 31 octobre part le lundi 2) ; une trimestrielle de janvier revient en avril, juillet, octobre', occurrences({jour: 31, montant: 1}, J(2026, 10, 1), J(2026, 10, 30)).map((o) => ymd(o.le)).join() === '2026-11-02,2026-11-30'
    && occurrences({jour: 15, montant: 1, rythme: 'trimestriel', mois: 1}, J(2026, 0, 1), J(2026, 11, 31)).map((o) => o.le.getUTCMonth()).join() === '0,3,6,9');
  ok('Radar : paie au dernier jour du mois (31 janvier 2027, un dimanche) avancée au vendredi 29', ymd(paies({jour: 'dernier', avance: true}, J(2027, 0, 10)).apres) === '2027-01-29');
  /* ---------- lecture d'un mail sans IA (textes inventés) ---------- */
  const m1 = lireMail({id: 'a', sender: 'facturation@energie-exemple.fr', nom: 'Énergie Exemple', objet: 'Votre facture de décembre', texte: "Bonjour,\nVotre facture est disponible.\nMontant TTC : 48,20 €\nIl sera prélevé le 12/12/2026 sur votre compte.", date: '2026-12-02T08:00:00Z'});
  ok('Radar : une facture lue sans IA (montant 48,20 €, prélèvement le 12/12/2026, service et domaine)', m1.genre === 'facture' && m1.montant === 48.2 && m1.datePrel === '2026-12-12' && m1.dom === 'energie-exemple.fr' && m1.service === 'Énergie Exemple' && m1.sur, JSON.stringify(m1));
  const m2 = lireMail({id: 'b', sender: 'info@account.video-exemple.com', nom: 'Video Exemple', objet: 'Your payment failed', texte: "We couldn't process your payment of €9.99. Please update your payment method to keep watching.", date: '2026-11-17T08:00:00Z'});
  ok('Radar : un paiement échoué en anglais (« payment failed », 9,99 €)', m2.genre === 'echec' && m2.montant === 9.99 && m2.sur, JSON.stringify(m2));
  const m3 = lireMail({id: 'c', sender: 'no-reply@notes-exemple.app', nom: '', objet: 'Votre essai gratuit', texte: 'Votre essai gratuit se termine le 15 décembre. Vous serez ensuite facturé 7,99 € par mois.', date: '2026-11-20T08:00:00Z'});
  ok('Radar : une fin d’essai (15 décembre, année déduite du mail ; nom tiré du domaine quand l’expéditeur est générique)', m3.genre === 'essai' && m3.datePrel === '2026-12-15' && m3.montant === 7.99 && m3.service === 'Notes Exemple', JSON.stringify(m3));
  const m4 = lireMail({id: 'd', sender: 'club@anim-exemple.com', nom: 'Anim Exemple', objet: 'Évolution de votre tarif', texte: "Le prix de votre abonnement passera de 59,99 € à 69,99 € à partir du 3 janvier 2027.", date: '2026-11-01T08:00:00Z'});
  ok('Radar : une hausse (de 59,99 € à 69,99 €, à partir du 3 janvier 2027)', m4.genre === 'hausse' && m4.avant === 59.99 && m4.montant === 69.99 && m4.datePrel === '2027-01-03', JSON.stringify(m4));
  const m5 = lireMail({id: 'e', sender: 'store@jeux-exemple.com', nom: 'Jeux Exemple', objet: 'Renouvellement de votre abonnement', texte: 'Votre abonnement sera renouvelé automatiquement le 26/11/2026 pour 79,99 €.', date: '2026-11-19T08:00:00Z'});
  ok('Radar : un renouvellement annoncé (26/11/2026, 79,99 €)', m5.genre === 'renouvellement' && m5.datePrel === '2026-11-26' && m5.montant === 79.99, JSON.stringify(m5));
  const m6 = lireMail({id: 'f', sender: 'news@boutique-exemple.fr', nom: 'Boutique', objet: 'Nos offres de la semaine', texte: 'Découvrez nos offres à partir de 9,99 €. Gérer mon abonnement à la lettre.', date: '2026-11-19T08:00:00Z'});
  ok('Radar : une lettre d’information (prix et « abonnement » à la lettre) n’est pas une facture', m6.genre === 'autre' && !m6.sur, JSON.stringify(m6));
  ok('Radar : montants écrits de toutes les façons (1 150,00 € ; €1,234.56 ; EUR 12.50 ; 1.150,00 EUR)', trouverMontant('Mensualité : 1 150,00 €') === 1150 && trouverMontant('Total charged: €1,234.56') === 1234.56 && trouverMontant('Amount EUR 12.50') === 12.5 && trouverMontant('Total : 1.150,00 EUR') === 1150 && montantDe('9.99') === 9.99);
  ok('Radar : pas de date prise au hasard (une référence « 12/2024 » ou un montant « 15.11 € » loin d’un mot de prélèvement)', trouverDate('Facture n° 12/2024, total 15.11 €', J(2026, 10, 1)) === null && trouverDate('Votre prélèvement aura lieu le 5 décembre 2026', J(2026, 10, 1)) === '2026-12-05');
  ok('Radar : catégories (énergie, téléphone, assurance, abonnement) et nom d’un expéditeur « no-reply »', categorie('edf.fr', 'EDF') === 'Logement' && categorie('free-mobile.fr', 'Free Mobile') === 'Télécoms' && categorie('macif.fr', '') === 'Assurances' && categorie('netflix.com', 'Netflix') === 'Abonnements'
    && nomService('no-reply', 'no-reply@mon-operateur.fr') === 'Mon Operateur');
  const m7 = lireMail({id: 'g', sender: 'service@paypal.fr', nom: 'PayPal', objet: "L'échéance de votre Paiement en 4X approche", texte: '| Votre prochaine échéance de 29,55 € EUR sera due le 24 octobre 2026. |\n| Marchand |\n| BOUTIQUE EXEMPLE |', date: '2026-10-20T08:00:00Z'});
  ok('Radar : l’échéance d’un paiement en 4 fois (29,55 € le 24 octobre, marchand lu dans le mail) est un prélèvement ponctuel', m7.genre === 'echeance' && m7.montant === 29.55 && m7.datePrel === '2026-10-24' && m7.service === 'BOUTIQUE EXEMPLE' && m7.cle === 'paypal.fr:boutiqueexemple', JSON.stringify(m7));
  ok('Radar : de l’argent reçu (virement, paiement reçu, remboursement) n’est pas une dépense', ['Vous avez reçu un virement de 1 000,00 €', 'Vous avez reçu un paiement de 3 200,00 EUR', 'Votre remboursement a été effectué : 19,90 €'].every((x) => genre('Notification', x) === 'autre'));
  const ms = lireMail({id: 'h', sender: 'receipts+acct_1@stripe.com', nom: 'Service A', objet: 'Your Service A receipt [#1]', texte: 'Receipt from Service A\nAmount paid\n€16.00\n', date: '2026-11-03T08:00:00Z'});
  ok('Radar : un reçu d’intermédiaire de paiement est rangé au nom du marchand (pas « Stripe »)', ms.genre === 'facture' && ms.montant === 16 && ms.service === 'Service A' && ms.cle === 'stripe.com:servicea', JSON.stringify(ms));
  /* ---------- les dépenses récurrentes trouvées dans les factures ---------- */
  const rel = (dom, service, montant, date, datePrel) => ({id: dom + date, dom, service, montant, date, datePrel: datePrel || null, genre: 'facture'});
  const props = regrouper([rel('energie-exemple.fr', 'Énergie Exemple', 48.2, '2026-08-02', '2026-08-12'), rel('energie-exemple.fr', 'Énergie Exemple', 48.2, '2026-09-02', '2026-09-12'), rel('energie-exemple.fr', 'Énergie Exemple', 48.2, '2026-10-02', '2026-10-12'), rel('energie-exemple.fr', 'Énergie Exemple', 48.2, '2026-11-02', '2026-11-12'),
    rel('jeux-exemple.com', 'Jeux Exemple', 59.99, '2025-11-26'), rel('jeux-exemple.com', 'Jeux Exemple', 79.99, '2026-11-19', '2026-11-26'),
    rel('boutique-exemple.fr', 'Boutique', 12.5, '2026-09-03'), rel('boutique-exemple.fr', 'Boutique', 89.9, '2026-10-03'), rel('boutique-exemple.fr', 'Boutique', 34, '2026-11-03'),
    rel('ancien-exemple.fr', 'Ancien', 9.99, '2026-01-05'), rel('ancien-exemple.fr', 'Ancien', 9.99, '2026-02-05'), rel('ancien-exemple.fr', 'Ancien', 9.99, '2026-03-05')], lundi);
  const relc = (cle, dom, service, montant, date) => ({id: cle + date, dom, cle, service, montant, date, datePrel: null, genre: 'facture'});
  const props2 = regrouper([...['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].map((m) => relc('stripe.com:servicea', 'stripe.com', 'Service A', 16, m + '-03')), ...['2026-08', '2026-09', '2026-10', '2026-11'].map((m) => relc('stripe.com:serviceb', 'stripe.com', 'Service B', 5, m + '-15')),
    ...['2026-06', '2026-07', '2026-08', '2026-09', '2026-11'].map((m) => relc('tel-exemple.fr', 'tel-exemple.fr', 'Tel Exemple', 15.99, m + '-08')), relc('tel-exemple.fr', 'tel-exemple.fr', 'Tel Exemple', 120, '2026-10-08')], lundi);
  ok('Radar : deux marchands payés par le même intermédiaire font deux dépenses ; un mois exceptionnel (120 € au lieu de 15,99 €) ne change pas le montant habituel',
    props2.filter((p) => p.dom === 'stripe.com').map((p) => p.service + ' ' + p.montant).sort().join() === 'Service A 16,Service B 5' && props2.find((p) => p.service === 'Tel Exemple').montant === 15.99 && !props2.find((p) => p.service === 'Tel Exemple').estime, JSON.stringify(props2.map((p) => [p.service, p.montant, p.estime])));
  const pe = props.find((p) => p.dom === 'energie-exemple.fr'), pj = props.find((p) => p.dom === 'jeux-exemple.com');
  ok('Radar : 4 factures mensuelles → une dépense proposée (le 12 de chaque mois, 48,20 €, depuis 08/2026)', !!pe && pe.rythme === 'mensuel' && pe.jour === 12 && pe.montant === 48.2 && pe.cat === 'Autres' && pe.depuis === '08/2026', JSON.stringify(pe));
  ok('Radar : un abonnement annuel repéré (dernier montant, mois de novembre) ; des achats variables et un service arrêté ne sont pas proposés', !!pj && pj.rythme === 'annuel' && pj.mois === 11 && pj.montant === 79.99 && !props.some((p) => /boutique|ancien/.test(p.dom)), JSON.stringify(props.map((p) => p.dom)));
  /* ---------- le serveur : lecture de départ, Claude pour l'illisible, propositions, réglages, notifications ---------- */
  const FIL = {}, mail = (id, from, nom, objet, texte, date) => { FIL['t' + id] = {id: 't' + id, messages: [{id, threadId: 't' + id, sender: from, addressDisplayNames: [{displayName: nom, emailAddress: from}], subject: objet, plaintextBody: texte, date, labelIds: ['INBOX']}]}; };
  ['2026-08', '2026-09', '2026-10', '2026-11'].forEach((m, i) => mail('ef' + i, 'facturation@energie-exemple.fr', 'Énergie Exemple', 'Votre facture', 'Montant TTC : 48,20 €. Il sera prélevé le 12/' + m.slice(5) + '/' + m.slice(0, 4) + '.', m + '-02T08:00:00Z'));
  ['2026-09', '2026-10', '2026-11'].forEach((m, i) => mail('ob' + i, 'compte@obscur-exemple.fr', 'Obscur', 'Votre document du mois', 'Votre facture est disponible dans votre espace client (pièce jointe).', m + '-07T08:00:00Z'));
  mail('ec', 'info@video-exemple.com', 'Video Exemple', 'Your payment failed', "We couldn't process your payment of €9.99.", '2026-11-20T08:00:00Z');
  const appels = {chercher: [], claude: [], push: []};
  const gmail = {lie: () => true, chercher: async (q) => { appels.chercher.push(q); const m = q.match(/after:(\d{4})\/(\d{2})/); const ids = Object.keys(FIL).filter((k) => (m ? FIL[k].messages[0].date.startsWith(m[1] + '-' + m[2]) : /newer_than/.test(q))); return {threads: ids.map((k) => ({id: k, messages: FIL[k].messages.map((x) => ({id: x.id}))}))}; },
    fil: async (id) => FIL[id]};
  const claude = async (prompt) => { appels.claude.push(prompt); const ids = [...prompt.matchAll(/\[mail (\w+)\]/g)].map((x) => x[1]); return {ok: true, text: 'Voici : ' + JSON.stringify(ids.map((id) => ({id, genre: 'facture', service: 'Obscur', montant: 24.5, date_prelevement: null})))}; };
  let maintenant = Date.parse('2026-11-23T09:00:00Z');
  const push = async (m) => { appels.push.push(m); return [{ok: true}]; };
  const file = path.join(DIR, 'radar.json'), RD = createRadar({file, gmail, claude, push, now: () => maintenant, moisDepart: 4});
  const e0 = (await RD.traiter('GET', '/api/radar', null)).body; await RD.attendre();
  const e1 = RD.etat();
  ok('Radar : la première ouverture lance la lecture de ses mois (un mois à la fois, catégories promotions et réseaux sociaux écartées)', e0.scan && e0.scan.enCours && e1.scan.fini && e1.scan.mois === 4 && appels.chercher.length === 4 && appels.chercher.every((q) => /-category:promotions/.test(q) && /after:\d{4}\/\d{2}\/01 before:/.test(q)), JSON.stringify(e1.scan));
  ok('Radar : les factures lisibles par les règles → proposition « Énergie Exemple », 48,20 € le 12 ; l’illisible part à Claude, sans pièce jointe, et donne « Obscur » 24,50 €', e1.propositions.some((p) => p.service === 'Énergie Exemple' && p.montant === 48.2 && p.jour === 12) && e1.propositions.some((p) => p.service === 'Obscur' && p.montant === 24.5)
    && appels.claude.length >= 1 && appels.claude.every((pr) => !/energie-exemple/.test(pr) && /espace client/.test(pr)), JSON.stringify(e1.propositions.map((p) => p.service + ' ' + p.montant)));
  ok('Radar : un paiement échoué de l’historique devient une alerte, sans notification (seulement pour les nouveaux mails)', e1.alertes.some((a) => a.type === 'echec' && a.service === 'Video Exemple' && /mail\.google\.com/.test(a.url)) && appels.push.length === 0);
  const pid = e1.propositions.find((p) => p.service === 'Énergie Exemple').id, pob = e1.propositions.find((p) => p.service === 'Obscur').id;
  let r = await RD.traiter('POST', '/api/radar/proposition', async () => ({id: pid, oui: true, modif: {service: 'Électricité', cat: 'Logement'}}));
  r = await RD.traiter('POST', '/api/radar/proposition', async () => ({id: pob, oui: false}));
  const e2 = r.body;
  ok('Radar : « Ajouter » en fait une dépense fixe (renommée par lui) ; « Pas une dépense fixe » l’écarte pour de bon', e2.fixes.length === 1 && e2.fixes[0].service === 'Électricité' && e2.fixes[0].source === 'mail' && e2.fixes[0].dom === 'energie-exemple.fr' && !e2.propositions.length && RD.brut().refus.includes('obscur-exemple.fr'), JSON.stringify(e2.fixes));
  const bad = await RD.traiter('POST', '/api/radar/set', async () => ({cle: 'fixes', valeur: [{service: '', montant: 'x', jour: 40}]}));
  r = await RD.traiter('POST', '/api/radar/set', async () => ({cle: 'fixes', valeur: e2.fixes.concat([{service: 'Crédit immobilier', cat: 'Logement', montant: '1150', jour: 24, rythme: 'mensuel'}])}));
  await RD.traiter('POST', '/api/radar/set', async () => ({cle: 'revenus', valeur: {jour: 28, avance: true}}));
  ok('Radar : réglages vérifiés (une dépense incomplète est refusée) ; sa mensualité ajoutée par lui est gardée', bad.status === 400 && r.status === 200 && r.body.fixes.length === 2 && r.body.fixes[1].montant === 1150 && r.body.fixes[1].source === 'toi' && r.body.revenus.defaut && !RD.etat().revenus.defaut && RD.etat().revenus.jour === 28, JSON.stringify(bad.body));
  ok('Radar : le fichier est sur le serveur seulement, lisible par lui seul (600)', (fs.statSync(file).mode & 0o777) === 0o600);
  /* la veille à 19 h : lundi 23/11, le crédit part le mardi 24 */
  maintenant = Date.parse('2026-11-23T18:05:00Z'); RD.tic(); await new Promise((z) => setTimeout(z, 50));
  const v = appels.push.find((m) => /^Demain/.test(m.title));
  ok('Radar : à 19 h, la notification de la veille (« Demain : Crédit immobilier, 1 150,00 € », reste à payer d’ici la paie du ven. 27/11)', !!v && v.title === 'Demain : Crédit immobilier' && /Crédit immobilier : 1\s150,00 €/.test(v.body) && /Reste à payer d’ici ta paie du ven\. 27\/11 : 1\s150,00 €\./.test(v.body) && v.url === '/#argent', JSON.stringify(v));
  RD.tic(); await new Promise((z) => setTimeout(z, 50));
  ok('Radar : une seule notification de la veille par jour', appels.push.filter((m) => /^Demain/.test(m.title)).length === 1);
  await RD.traiter('POST', '/api/radar/set', async () => ({cle: 'notif', valeur: {veille: true, seuil: 2000, echec: true}}));
  ok('Radar : sous le seuil choisi (2 000 €), pas de notification', (await RD.veille()) === null);
  /* chaque matin : un nouveau paiement échoué notifie tout de suite */
  mail('ec2', 'info@video-exemple.com', 'Video Exemple', 'Payment declined', 'Your payment of €9.99 was declined. Update your payment method.', '2026-11-24T05:00:00Z');
  maintenant = Date.parse('2026-11-24T06:00:00Z'); RD.tic(); await RD.attendre(); await new Promise((z) => setTimeout(z, 50));
  ok('Radar : à 6 h 50, un nouveau paiement échoué → notification tout de suite', appels.push.some((m) => m.title === 'Paiement échoué : Video Exemple' && m.url === '/#argent'), JSON.stringify(appels.push.map((m) => m.title)));
  mail('ech', 'service@paypal.fr', 'PayPal', "L'échéance de votre Paiement en 4X approche", '| Votre prochaine échéance de 29,55 € EUR sera due le 25/11/2026. |\n| Marchand |\n| BOUTIQUE EXEMPLE |', '2026-11-24T05:10:00Z');
  maintenant = Date.parse('2026-11-24T07:00:00Z'); await RD.lireMaintenant(); await RD.traiter('POST', '/api/radar/set', async () => ({cle: 'notif', valeur: {veille: true, seuil: 20, echec: true}}));
  const e3 = RD.etat();
  maintenant = Date.parse('2026-11-24T18:10:00Z'); const v2 = await RD.veille();
  ok('Radar : une échéance de paiement en 4 fois devient un prélèvement ponctuel (À venir), annoncé la veille avec le reste à payer qui le compte', e3.ponctuels.length === 1 && e3.ponctuels[0].montant === 29.55 && e3.avenir.some((v) => v.type === 'echeance' && v.date === '2026-11-25')
    && !!v2 && /BOUTIQUE EXEMPLE : 29,55 €/.test(v2.body) && /d’ici ta paie du ven\. 27\/11 : 29,55 €/.test(v2.body), JSON.stringify([e3.ponctuels, v2 && v2.body]));
  const RD2 = createRadar({file, gmail, claude, push, now: () => maintenant, moisDepart: 4});
  ok('Radar : tout est relu après un redémarrage (dépenses, paie, réglages)', RD2.etat().fixes.length === 2 && RD2.etat().revenus.jour === 28 && RD2.etat().notif.seuil === 20 && RD2.etat().ponctuels.length === 1);
  /* 0.46.0 : Google limitait la lecture (« Quota exceeded … Units per minute per user ») et la lecture de départ s'arrêtait */
  { let horloge = 0; const attentes = [], vu = {pause: ''}, appelsT = [];
    const FIL2 = {}; ['2026-08', '2026-09', '2026-10', '2026-11'].forEach((m, i) => { FIL2['q' + i] = {id: 'q' + i, messages: [{id: 'qm' + i, threadId: 'q' + i, sender: 'facturation@eau-exemple.fr', addressDisplayNames: [{displayName: 'Eau Exemple', emailAddress: 'facturation@eau-exemple.fr'}], subject: 'Votre facture', plaintextBody: 'Montant TTC : 21,30 €. Il sera prélevé le 6/' + m.slice(5) + '/' + m.slice(0, 4) + '.', date: m + '-02T08:00:00Z', labelIds: ['INBOX']}]}; });
    let refus = 1;
    const g2 = {lie: () => true,
      chercher: async (q) => { appelsT.push(horloge); if (refus-- > 0) throw new Error("Quota exceeded for quota metric 'Total Query Cost' and limit 'Units per minute per user' of service 'gmail.googleapis.com'");
        const m = q.match(/after:(\d{4})\/(\d{2})/); return {threads: Object.keys(FIL2).filter((k) => FIL2[k].messages[0].date.startsWith(m[1] + '-' + m[2])).map((k) => ({id: k, historyId: 'h' + k}))}; },
      fil: async (id) => { appelsT.push(horloge); return FIL2[id]; }};
    const f2 = path.join(DIR, 'radar2.json');
    const RQ = createRadar({file: f2, gmail: g2, now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 4, budget: 30, horloge: () => horloge, pauseQuota: 65000,
      attente: async (ms) => { attentes.push(ms); if (ms === 65000) vu.pause = RQ.brut().scan.pause; horloge += ms; }});
    await RQ.traiter('GET', '/api/radar', null); await RQ.attendre();
    const e = RQ.etat(), fenetre = appelsT.every((t) => appelsT.filter((u) => u > t - 60000 && u <= t).length * 10 <= 30);
    ok('Radar : une limite de Google atteinte → une minute de pause annoncée en français, puis la lecture reprend et finit', attentes.includes(65000) && /Google limite les lectures par minute/.test(vu.pause) && !!e.scan.fini && !e.scan.erreur && e.propositions.some((x) => x.service === 'Eau Exemple' && x.montant === 21.3), JSON.stringify([attentes, vu, e.scan]));
    ok('Radar : jamais plus que le budget de Gmail sur une minute glissante (30 unités ici, 4 000 en service)', fenetre && attentes.filter((ms) => ms !== 65000).length >= 1, JSON.stringify(appelsT));
    const n0 = appelsT.length; await RQ.lireMaintenant();
    ok('Radar : un fil déjà lu et inchangé n’est pas relu (seule la liste du jour est demandée)', appelsT.length - n0 === 1, (appelsT.length - n0) + ' appels');
    /* une lecture interrompue reprend au mois où elle s'était arrêtée ; un ancien message anglais de Google est montré en français */
    fs.writeFileSync(path.join(DIR, 'radar3.json'), JSON.stringify({version: 2, scan: {enCours: false, debut: 0, mois: 2, total: 4, lus: 5, fini: null, erreur: "Quota exceeded for quota metric 'Total Query Cost'"}}));
    const qs = [], RR = createRadar({file: path.join(DIR, 'radar3.json'), gmail: {lie: () => true, chercher: async (q) => { qs.push(q); return {threads: []}; }, fil: async () => ({messages: []})}, now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 4});
    const msg = RR.etat().scan.erreur; await RR.traiter('GET', '/api/radar', null); await RR.attendre();
    ok('Radar : la lecture interrompue reprend au mois suivant (2 mois restants sur 4) ; l’ancien message de Google est traduit', qs.length === 2 && /after:2026\/10\/01/.test(qs[0]) && RR.etat().scan.fini && /Google a limité la lecture de tes mails/.test(msg), JSON.stringify([qs, msg])); }
  /* 0.49.0 (« les dépenses relevées n'ont pas de sens ») : des achats fréquents n'en sont pas ; une facture sans montant compte ; le jour annoncé d'abord */
  { const rr = (cle, service, montant, date, datePrel) => ({id: cle + date + Math.random(), dom: cle, cle, service, montant, date, datePrel: datePrel || null, genre: 'facture'});
    const pp = regrouper([...['2026-08', '2026-09', '2026-10', '2026-11'].map((m) => rr('creche-exemple.fr', 'Crèche Exemple', null, m + '-01')),
      ...['2026-08', '2026-09', '2026-10', '2026-11'].flatMap((m) => ['-03', '-12', '-21'].map((d) => rr('jeu-exemple.com', 'Jeu Exemple', 9.99, m + d))),
      ...['2026-08', '2026-09', '2026-10', '2026-11'].map((m) => rr('tel2-exemple.fr', 'Tel Deux', 23.99, m + '-29', (m === '2026-11' ? '2026-12' : m.slice(0, 5) + String(+m.slice(5) + 1).padStart(2, '0')) + '-09')),
      ...['2026-08', '2026-09', '2026-10', '2026-11'].map((m) => rr('energie2-exemple.fr', 'Énergie Deux', 62.88, m + '-09'))], lundi);
    const pc = pp.find((x) => x.service === 'Crèche Exemple'), pt = pp.find((x) => x.service === 'Tel Deux'), pn = pp.find((x) => x.service === 'Énergie Deux');
    ok('Radar : une facture dont le montant n’est que dans la pièce jointe → dépense proposée « montant à compléter » (vers le 1er)', !!pc && pc.montant === null && pc.jour === 1 && pc.jourApprox === true, JSON.stringify(pc));
    ok('Radar : des achats plusieurs fois par mois (3 reçus de jeu par mois) ne font pas une dépense fixe', !pp.some((x) => x.service === 'Jeu Exemple'), JSON.stringify(pp.map((x) => x.service)));
    ok('Radar : le jour annoncé (« prélevé le 9 ») passe avant le jour d’arrivée du mail (le 29) ; sans jour annoncé, « vers le 9 »', !!pt && pt.jour === 9 && !pt.jourApprox && !!pn && pn.jour === 9 && pn.jourApprox === true, JSON.stringify([pt, pn]));
    const pn2 = regrouper([rr('communication-navigo.fr', 'Navigo Liberté + sur passe', 64.88, '2026-09-08', '2026-09-15'), rr('communication-navigo.fr', 'Navigo Liberté + sur passe', 58.10, '2026-10-08', '2026-10-15'), rr('iledefrance-mobilites.fr', 'Navigo Liberté + sur passe', 61.20, '2026-11-08', '2026-11-15')], lundi);
    ok('Radar : un même service qui écrit depuis deux adresses reste une seule dépense (le 15, 3 mois)', pn2.length === 1 && pn2[0].jour === 15 && pn2[0].preuves === 3, JSON.stringify(pn2));
    ok('Radar : un achat, une livraison ou une notification (« vous avez reçu un message ») n’est pas une facture ; une facture de commande, si', genre('Votre commande n° 123 est expédiée', 'Total : 39,90 €') === 'autre' && genre('Vous avez reçu un message', 'Votre conseiller vous a écrit.') === 'autre' && genre('Votre facture pour la commande 123', 'Montant : 39,90 €') === 'facture');
    /* une facture que ni les règles ni Claude ne chiffrent reste comptée */
    const F3 = {}; ['2026-09', '2026-10', '2026-11'].forEach((m, i) => { F3['c' + i] = {id: 'c' + i, messages: [{id: 'cm' + i, threadId: 'c' + i, sender: 'noreply@creche-exemple.fr', addressDisplayNames: [{displayName: 'Crèche Exemple', emailAddress: 'noreply@creche-exemple.fr'}], subject: 'Votre FACTURE n° 4311-' + i, plaintextBody: 'Bonjour,\nVeuillez trouver ci-joint votre facture.', date: m + '-01T11:00:00Z', labelIds: ['INBOX']}]}; });
    const RC = createRadar({file: path.join(DIR, 'radar4.json'), gmail: {lie: () => true, chercher: async (q) => { const m = q.match(/after:(\d{4})\/(\d{2})/); return {threads: Object.keys(F3).filter((k) => m && F3[k].messages[0].date.startsWith(m[1] + '-' + m[2])).map((k) => ({id: k}))}; }, fil: async (id) => F3[id]},
      claude: async (prompt) => ({ok: true, text: JSON.stringify([...prompt.matchAll(/\[mail (\w+)\]/g)].map((x) => ({id: x[1], genre: 'facture', service: 'Crèche Exemple', montant: null})))}), now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 4});
    await RC.traiter('GET', '/api/radar', null); await RC.attendre();
    const ec = RC.etat().propositions.find((x) => x.service === 'Crèche Exemple');
    ok('Radar : une facture sans montant, ni pour les règles ni pour Claude, est gardée et proposée « à compléter »', !!ec && ec.montant === null, JSON.stringify(RC.etat().propositions));
    /* la lecture d'avant 0.49.0 est oubliée (relevés, propositions), ses dépenses validées, sa paie et ses refus restent */
    fs.writeFileSync(path.join(DIR, 'radar5.json'), JSON.stringify({fixes: [{id: 'f1', service: 'Crédit', montant: 900, jour: 5, rythme: 'mensuel', source: 'toi'}], revenus: {jour: 27, avance: true}, refus: ['x.fr'], releves: [{id: 'r', dom: 'x.fr', montant: 1, date: '2026-11-01', genre: 'facture'}], propositions: [{id: 'p1', service: 'Bruit'}], scan: {fini: 1}}));
    const RV = createRadar({file: path.join(DIR, 'radar5.json'), gmail: {lie: () => false}, now: () => Date.parse('2026-11-23T09:00:00Z')}), bv = RV.brut();
    ok('Radar : la lecture faite avec les anciennes règles est refaite (relevés et propositions oubliés) ; dépenses, paie et refus gardés', !bv.releves.length && !bv.propositions.length && !bv.scan && bv.fixes.length === 1 && bv.revenus.jour === 27 && bv.refus.includes('x.fr') && bv.version === 2); }
  /* la mémoire de JARVIS (lue par le serveur MCP, que Grok Bot peut joindre) refuse les chiffres d'un crédit */
  ok('Mémoire : refuse les chiffres d’un crédit (règle du 12/11/2026), garde le reste', interdit('Ma mensualité de crédit immobilier est de 1150 €') && interdit('Il reste 180 000 € à rembourser sur le prêt immobilier') && !interdit("J'ai un crédit immobilier à la banque") && !interdit('Je suis prêt à 8h'));
} catch (e) { ok('exception', false, e.stack); }
fs.rmSync(DIR, {recursive: true, force: true});
console.log(results.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + results.length + ' vérifications).');
process.exit(fails ? 1 : 0);
