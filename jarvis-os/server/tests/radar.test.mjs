/* Banc du Radar : node tests/radar.test.mjs (aucun vrai Google, aucun vrai Claude, aucun coût). Mails et montants inventés. */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {J, ymd, feries, occurrences, paies, resteA, trouverMontant, trouverDate, genre, avantApres, lireMail, regrouper, nomService, categorie, montantDe, createRadar, domaine, montantPdf, rythmeDe, sansPub, prelevementsPdf, calendrierPdf, montantPalier, courantes} from '../radar.mjs';
import {textOf} from '../google.mjs';
import {texteDePdf} from '../pdf.mjs';
import zlib from 'node:zlib';
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
  ok('Radar : la première ouverture lance la lecture de ses mois (un mois à la fois, catégories promotions et réseaux sociaux écartées)', e0.scan && e0.scan.enCours && e1.scan.fini && e1.scan.mois === 4 && appels.chercher.filter((q) => /after:\d{4}\/\d{2}\/01 before:/.test(q)).length === 8 && appels.chercher.every((q) => /-category:promotions/.test(q))
    && appels.chercher.some((q) => /^from:\(energie-exemple\.fr/.test(q) && /newer_than:4m/.test(q)), JSON.stringify([e1.scan, appels.chercher.length]));
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
  ok('Radar : à 19 h, la notification de la veille (« Demain : Crédit immobilier, 1 150,00 € », reste à payer d’ici la paie du ven. 27/11), qui ouvre les prélèvements de demain (0.69.0)', !!v && v.title === 'Demain : Crédit immobilier' && /Crédit immobilier : 1\s150,00 €/.test(v.body) && /Reste à payer d’ici ta paie du ven\. 27\/11 : 1\s150,00 €\./.test(v.body) && v.url === '/#voir-radar-veille', JSON.stringify(v));
  RD.tic(); await new Promise((z) => setTimeout(z, 50));
  ok('Radar : une seule notification de la veille par jour', appels.push.filter((m) => /^Demain/.test(m.title)).length === 1);
  await RD.traiter('POST', '/api/radar/set', async () => ({cle: 'notif', valeur: {veille: true, seuil: 2000, echec: true}}));
  ok('Radar : sous le seuil choisi (2 000 €), pas de notification', (await RD.veille()) === null);
  /* chaque matin : un nouveau paiement échoué notifie tout de suite */
  mail('ec2', 'info@video-exemple.com', 'Video Exemple', 'Payment declined', 'Your payment of €9.99 was declined. Update your payment method.', '2026-11-24T05:00:00Z');
  maintenant = Date.parse('2026-11-24T06:00:00Z'); RD.tic(); await RD.attendre(); await new Promise((z) => setTimeout(z, 50));
  ok('Radar : à 6 h 50, un nouveau paiement échoué → notification tout de suite, qui ouvre son alerte (0.69.0)', appels.push.some((m) => m.title === 'Paiement échoué : Video Exemple' && /^\/#voir-radar-a\w+$/.test(m.url) && RD.etat().alertes.some((a) => '/#voir-radar-' + a.id === m.url)), JSON.stringify(appels.push.map((m) => m.title)));
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
        const m = q.match(/after:(\d{4})\/(\d{2})/); if (!m) return {threads: []}; return {threads: Object.keys(FIL2).filter((k) => FIL2[k].messages[0].date.startsWith(m[1] + '-' + m[2])).map((k) => ({id: k, historyId: 'h' + k}))}; },
      fil: async (id) => { appelsT.push(horloge); return FIL2[id]; }};
    const f2 = path.join(DIR, 'radar2.json');
    const RQ = createRadar({file: f2, gmail: g2, now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 4, budget: 30, horloge: () => horloge, pauseQuota: 65000,
      attente: async (ms) => { attentes.push(ms); if (ms === 65000) vu.pause = RQ.brut().scan.pause; horloge += ms; }});
    await RQ.traiter('GET', '/api/radar', null); await RQ.attendre();
    const e = RQ.etat(), fenetre = appelsT.every((t) => appelsT.filter((u) => u > t - 60000 && u <= t).length * 10 <= 30);
    ok('Radar : une limite de Google atteinte → une minute de pause annoncée en français, puis la lecture reprend et finit', attentes.includes(65000) && /Google limite les lectures par minute/.test(vu.pause) && !!e.scan.fini && !e.scan.erreur && e.propositions.some((x) => x.service === 'Eau Exemple' && x.montant === 21.3), JSON.stringify([attentes, vu, e.scan]));
    ok('Radar : jamais plus que le budget de Gmail sur une minute glissante (30 unités ici, 4 000 en service)', fenetre && attentes.filter((ms) => ms !== 65000).length >= 1, JSON.stringify(appelsT));
    const n0 = appelsT.length; await RQ.lireMaintenant();
    ok('Radar : un fil déjà lu et inchangé n’est pas relu (seules les listes du jour sont demandées : objet, phrases de prélèvement, fournisseurs connus)', appelsT.length - n0 === 3, (appelsT.length - n0) + ' appels');
    /* une lecture interrompue reprend au mois où elle s'était arrêtée ; un ancien message anglais de Google est montré en français */
    fs.writeFileSync(path.join(DIR, 'radar3.json'), JSON.stringify({version: 7, scan: {enCours: false, debut: 0, mois: 2, total: 4, lus: 5, fini: null, erreur: "Quota exceeded for quota metric 'Total Query Cost'"}}));
    const qs = [], RR = createRadar({file: path.join(DIR, 'radar3.json'), gmail: {lie: () => true, chercher: async (q) => { qs.push(q); return {threads: []}; }, fil: async () => ({messages: []})}, now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 4});
    const msg = RR.etat().scan.erreur; await RR.traiter('GET', '/api/radar', null); await RR.attendre();
    ok('Radar : la lecture interrompue reprend au mois suivant (2 mois restants sur 4), puis cherche ses contrats (0.66.0) ; l’ancien message de Google est traduit', qs.length === 5 && /after:2026\/10\/01/.test(qs[0]) && /^has:attachment filename:pdf .*newer_than:4y$/.test(qs[4]) && RR.etat().scan.fini && /Google a limité la lecture de tes mails/.test(msg), JSON.stringify([qs, msg])); }
  /* 0.49.0 (« les dépenses relevées n'ont pas de sens ») : des achats fréquents n'en sont pas ; une facture sans montant compte ; le jour annoncé d'abord */
  { const rr = (cle, service, montant, date, datePrel) => ({id: cle + date + Math.random(), dom: cle, cle, service, montant, date, datePrel: datePrel || null, genre: 'facture'});
    const pp = regrouper([...['2026-08', '2026-09', '2026-10', '2026-11'].map((m) => rr('creche-exemple.fr', 'Crèche Exemple', null, m + '-01')),
      ...['2026-08', '2026-09', '2026-10', '2026-11'].flatMap((m) => ['-03', '-12', '-21'].map((d) => rr('jeu-exemple.com', 'Jeu Exemple', 9.99, m + d))),
      ...['2026-08', '2026-09', '2026-10', '2026-11'].map((m) => rr('tel2-exemple.fr', 'Tel Deux', 23.99, m + '-29', (m === '2026-11' ? '2026-12' : m.slice(0, 5) + String(+m.slice(5) + 1).padStart(2, '0')) + '-09')),
      ...['2026-08', '2026-09', '2026-10', '2026-11'].map((m) => rr('energie2-exemple.fr', 'Énergie Deux', 62.88, m + '-09'))], lundi);
    const pc = pp.find((x) => x.service === 'Crèche Exemple'), pt = pp.find((x) => x.service === 'Tel Deux'), pn = pp.find((x) => x.service === 'Énergie Deux');
    ok('Radar : une facture dont le montant n’est que dans la pièce jointe → dépense proposée « montant à compléter », vers le 11 (facture du 1er + 10 jours, le délai habituel de ses autres factures, 0.56.0)', !!pc && pc.montant === null && pc.jour === 11 && pc.jourApprox === true && pc.decalage === 10, JSON.stringify(pc));
    const seule = regrouper(['2026-08', '2026-09', '2026-10', '2026-11'].map((m) => rr('creche-exemple.fr', 'Crèche Exemple', null, m + '-01')), lundi)[0];
    ok('Radar 0.56 : sans au moins 3 factures datées pour apprendre le délai, le jour reste celui du mail (vers le 1er)', !!seule && seule.jour === 1 && seule.jourApprox === true && !seule.decalage, JSON.stringify(seule));
    ok('Radar : des achats plusieurs fois par mois (3 reçus de jeu par mois) ne font pas une dépense fixe', !pp.some((x) => x.service === 'Jeu Exemple'), JSON.stringify(pp.map((x) => x.service)));
    ok('Radar : le jour annoncé (« prélevé le 9 ») passe avant le jour d’arrivée du mail (le 29) ; sans jour annoncé, « vers le 19 » (facture du 9 + le délai habituel de 10 jours)', !!pt && pt.jour === 9 && !pt.jourApprox && !!pn && pn.jour === 19 && pn.jourApprox === true, JSON.stringify([pt, pn]));
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
    ok('Radar : la lecture faite avec les anciennes règles est refaite (relevés et propositions oubliés) ; dépenses, paie et refus gardés', !bv.releves.length && !bv.propositions.length && !bv.scan && bv.fixes.length === 1 && bv.revenus.jour === 27 && bv.refus.includes('x.fr') && bv.version === 7); }
  /* 0.50.0 : catégories enfants et impôts ; la proposition montre son dernier mail */
  ok('Radar : catégories « Enfants » (crèche, couches) et « Impôts » (DGFiP)', categorie('creche-exemple.fr', 'Crèche Les Lutins') === 'Enfants' && categorie('couches-exemple.fr', 'Couches Exemple') === 'Enfants' && categorie('dgfip.finances.gouv.fr', '') === 'Impôts');
  { const px = regrouper(['2026-09', '2026-10', '2026-11'].map((m) => ({id: 'x' + m, fil: 'f' + m, objet: 'Votre facture de ' + m, dom: 'tel3-exemple.fr', cle: 'tel3-exemple.fr', service: 'Tel Trois', montant: 9.99, date: m + '-05', datePrel: null, genre: 'facture'})), lundi)[0];
    ok('Radar : une dépense proposée garde son dernier mail (objet, date, lien vers Gmail)', !!px && px.exemple.objet === 'Votre facture de 2026-11' && px.exemple.date === '2026-11-05' && /#all\/f2026-11$/.test(px.exemple.url), JSON.stringify(px && px.exemple)); }
  /* 0.51.0 : règles revues sur une vraie boîte (mails réécrits ici, noms et montants inventés) */
  { ok('Radar 0.51 : « n’a pas fonctionné » (apostrophe typographique) et « erreur de paiement » = paiement échoué', genre('Oups : erreur de paiement', 'Le renouvellement de votre abonnement n’a pas fonctionné en raison d’une protection de votre carte.') === 'echec');
    ok('Radar 0.51 : « modification de votre abonnement » (la date d’une livraison) n’est pas une hausse ; un reçu fiscal de dons n’est pas une facture', genre('Modification de votre abonnement - la date de votre prochain départ', 'Nouveau départ prévu le : 12/12/2026') === 'autre' && genre('Téléchargez le reçu fiscal de vos dons 2025', 'Merci pour votre soutien régulier') === 'autre');
    ok('Radar 0.51 : un essai sans moyen de paiement enregistré se termine sans rien prélever (pas d’alerte) ; avec carte, il reste une alerte', genre('Your Pro free trial is ending soon', 'Your free trial will end on Friday, December 4th. Add a payment method now.') === 'autre' && genre('Votre essai gratuit se termine', 'Votre essai gratuit se termine le 30/11 : votre carte sera débitée de 9,99 €.') === 'essai');
    ok('Radar 0.51 : dates anglaises « will end on Friday, December 4th » et « 5 December 2026 »', trouverDate('Your free trial will end on Friday, December 4th.', J(2026, 11, 1)) === '2026-12-04' && trouverDate('Your plan renews on 5 December 2026.', J(2026, 10, 20)) === '2026-12-05');
    ok('Radar 0.51 : « Espace Client Opérateur » devient « Opérateur » ; un expéditeur des impôts garde son service (finances.gouv.fr, pas gouv.fr)', nomService('Espace Client Opérateur Exemple', 'x@op-exemple.fr') === 'Opérateur Exemple' && domaine('a@dgfip.finances.gouv.fr') === 'finances.gouv.fr' && domaine('b@info.swile.co') === 'swile.co' && domaine('c@mail.exemple.co.uk') === 'exemple.co.uk');
    const tab = lireMail({id: 'k1', sender: 'conseiller@paiement-exemple.fr', nom: 'Paiement Exemple', objet: 'Consultez l’échéancier de vos achats financés', date: '2026-11-03',
      texte: "Suite à votre achat en 4 fois par carte bancaire sur le site BOUTIQUE réalisé le 02/11/2026 d'un montant de 120,00 €, nous vous informons du prélèvement de votre 1ère échéance :\n| MONTANT | DATE DE PRÉLÈVEMENT(1) |\n| 30,00 € | 05/11/2026 |\n| 30,00 € | 05/12/2026 |\n| 30,00 € | 05/01/2027 |\n| 30,00 € | 05/02/2027 |\nTOTAL À PAYER : 120,00 € dont 0,00 € de frais\n(2) Le saviez-vous : tout impayé peut engendrer une indemnité de retard de 8 % ?"});
    ok('Radar 0.51 : un échéancier en tableau (4 × 30 €) est lu en entier ; la mention « tout impayé peut engendrer… » n’en fait pas un paiement échoué', tab.genre === 'echeance' && tab.fois === 4 && JSON.stringify(tab.echeances) === JSON.stringify(['2026-11-05', '2026-12-05', '2027-01-05', '2027-02-05'].map((date) => ({date, montant: 30}))), JSON.stringify(tab));
    const pp4 = lireMail({id: 'k2', sender: 'service@paypal.fr', nom: 'PayPal', objet: 'Votre Paiement en 4X est prêt', date: '2026-11-03',
      texte: "| Votre achat de 80,00 € EUR auprès de BOUTIQUE EXEMPLE a été divisé en 4 échéances. |\n| * 20,00 € EUR dus aujourd'hui * 20,00 € EUR le 3 décembre 2026 * 20,00 € EUR le 2 janvier 2027 * 20,00 € EUR le 1 février 2027 |"});
    const fe = lireMail({id: 'k5', sender: 'factures@energie-exemple.fr', nom: 'Énergie Exemple', objet: 'Votre facture', date: '2026-11-20', texte: 'Montant : 45,00 € à régler le 15/12/2026. Rappel : 12,00 € réglés le 15/11/2026. Date d’échéance indiquée sur la facture.'});
    ok('Radar 0.51 : une facture qui cite deux montants datés et sa « date d’échéance » reste une facture (pas un échéancier)', fe.genre === 'facture' && !fe.echeances && fe.montant === 45, JSON.stringify(fe));
    ok('Radar 0.51 : « divisé en 4 échéances » (aujourd’hui, puis 3 dates) : 4 échéances de 20 €, chez le marchand nommé (pas « PayPal »)', pp4.genre === 'echeance' && pp4.fois === 4 && pp4.service === 'BOUTIQUE EXEMPLE' && pp4.echeances.length === 4 && pp4.echeances[0].date === '2026-11-03' && pp4.echeances[3].date === '2027-02-01', JSON.stringify(pp4));
    ok('Radar 0.51 : une facture « dont 144,00 € de supplément ponctuel » garde sa part habituelle ; un refus de titres-restaurant n’est pas un abonnement en échec',
      lireMail({id: 'k3', sender: 'noreply@tel-exemple.fr', objet: 'Comprendre votre supplément', texte: 'Montant total de votre facture : 160,00 € Dont 144,00 € de supplément ponctuel', date: '2026-10-08'}).hors === 144
      && lireMail({id: 'k4', sender: 'hello@info.swile.co', nom: 'Swile', objet: 'Votre paiement a échoué', texte: 'Votre paiement de 8 € a échoué car il ne reste que 0 € sur votre compte.', date: '2026-11-20'}).genre === 'autre');
    /* une facture prélevée chaque mois au montant qui change (transports au trajet) : proposée, estimée ; des achats sans prélèvement annoncé : non */
    const rv = (cle, montant, date, datePrel, hors) => ({id: cle + date, dom: cle, cle, service: cle.split('.')[0], montant, date, datePrel, genre: 'facture', ...(hors ? {hors} : {})});
    const pv = regrouper([rv('transport-exemple.fr', 21.1, '2026-09-08', '2026-09-15'), rv('transport-exemple.fr', 63.4, '2026-10-08', '2026-10-15'), rv('transport-exemple.fr', 47.8, '2026-11-08', '2026-11-16'),
      rv('achats-exemple.fr', 21.1, '2026-09-08', null), rv('achats-exemple.fr', 63.4, '2026-10-09', null), rv('achats-exemple.fr', 47.8, '2026-11-07', null),
      rv('tel-exemple.fr', 160, '2026-09-08', null, 144), rv('tel-exemple.fr', 160, '2026-09-12', '2026-09-18'), rv('tel-exemple.fr', 16, '2026-10-12', '2026-10-18'), rv('tel-exemple.fr', 16.2, '2026-11-12', '2026-11-18')], J(2026, 10, 23));
    const vt = pv.find((x) => x.cle === 'transport-exemple.fr'), vtel = pv.find((x) => x.cle === 'tel-exemple.fr');
    ok('Radar 0.51 : transports au trajet (21,10 / 63,40 / 47,80 €, prélevés le 15) proposés « environ 47,80 € », variables ; les mêmes montants sans prélèvement annoncé, non', !!vt && vt.montant === 47.8 && vt.variable && vt.estime && vt.jour === 15 && !pv.some((x) => x.cle === 'achats-exemple.fr'), JSON.stringify(pv));
    ok('Radar 0.51 : un mois gonflé par un supplément expliqué (160 € dont 144 €) compte pour sa part habituelle : téléphone proposé à 16,20 €, non variable', !!vtel && vtel.montant === 16.2 && !vtel.variable, JSON.stringify(vtel));
    /* le calendrier : une dépense qui commence plus tard ; la facture du mois connue */
    const oc = occurrences({service: 'Impôts exemple', montant: 100, jour: 15, rythme: 'mensuel', debut: '2027-01-15'}, J(2026, 10, 23), J(2027, 1, 28)).map((o) => ymd(o.le));
    const rp = resteA([{service: 'Tel', montant: 16, jour: 26, rythme: 'mensuel', prochain: {date: '2026-11-26', montant: 160}}], {jour: 28, avance: true}, J(2026, 10, 23), 'mois');
    ok('Radar 0.51 : une dépense qui commence en janvier ne compte pas avant (15/01 et 15/02 seulement) ; la facture du mois annoncée (160 €) remplace l’habituel (16 €)', JSON.stringify(oc) === '["2027-01-15","2027-02-15"]' && rp.total === 160 && rp.liste[0].f.exact === true, JSON.stringify([oc, rp.total]));
    /* de bout en bout, dans le serveur : échéancier, rappel et échéance déjà payée ; impôts mensualisés ; facture du mois d'une dépense connue ; faux échecs */
    const F5 = {}, m5 = (id, from, nom, objet, texte, date) => { F5['t' + id] = {id: 't' + id, messages: [{id, threadId: 't' + id, sender: from, addressDisplayNames: [{displayName: nom, emailAddress: from}], subject: objet, plaintextBody: texte, date: date + 'T08:00:00Z', labelIds: []}]}; };
    m5('a1', 'service@paypal.fr', 'PayPal', 'Votre Paiement en 4X est prêt', "Votre achat de 80,00 € EUR auprès de BOUTIQUE EXEMPLE a été divisé en 4 échéances. * 20,00 € EUR dus aujourd'hui * 20,00 € EUR le 3 décembre 2026 * 20,00 € EUR le 2 janvier 2027 * 20,00 € EUR le 1 février 2027", '2026-11-03');
    m5('a2', 'service@paypal.fr', 'PayPal', 'L’échéance de votre Paiement en 4X approche', 'Votre prochaine échéance de 20,00 € EUR sera due le 3 décembre 2026, auprès de BOUTIQUE EXEMPLE.', '2026-11-22');
    m5('a3', 'service@paypal.fr', 'PayPal', 'Confirmation de votre Paiement en 4X', 'Vous avez effectué un paiement de 15,00 € EUR pour votre Paiement en 4X auprès de MAGASIN. Le paiement a été débité de votre carte le 23 novembre 2026.', '2026-11-23');
    m5('a4', 'ne-pas-repondre@dgfip.finances.gouv.fr', 'Direction générale des Finances publiques', 'ADHÉSION AU PRÉLÈVEMENT MENSUEL : TAXES FONCIÈRES', "Type de prélèvement | Prélèvement mensuel\nType d'impôt | Taxes foncières\nDate de premier prélèvement | 15 janvier 2027", '2026-11-02');
    m5('a5', 'noreply@tel-exemple.fr', 'Tel Exemple', 'Votre facture est arrivée', "Votre facture du 20/11/2026 d'un montant de 160,00 € est arrivée. Ce montant sera prélevé le 28/11/2026.", '2026-11-20');
    m5('a6', 'conseiller@paiement-exemple.fr', 'Paiement Exemple', 'Consultez l’échéancier de vos achats', 'Votre achat en 4 fois : | 30,00 € | 05/11/2026 | | 30,00 € | 05/12/2026 | (2) Tout impayé peut engendrer une indemnité de retard.', '2026-11-04');
    m5('a7', 'hello@info.swile.co', 'Swile', 'Échec de paiement chez Boulangerie', 'Vos titres-resto ne fonctionnent pas les dimanches. Votre paiement a échoué.', '2026-11-22');
    const pushs5 = [], R5 = createRadar({file: path.join(DIR, 'radar7.json'), gmail: {lie: () => true, chercher: async () => ({threads: Object.values(F5).map((x) => ({id: x.id}))}), fil: async (id) => F5[id]},
      now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 1, push: async (m) => { pushs5.push(m); return []; }});
    R5.regler('fixes', [{id: 'f1', service: 'Tel Exemple', cat: 'Télécoms', montant: 16, jour: 28, rythme: 'mensuel', source: 'mail', dom: 'tel-exemple.fr', cle: 'tel-exemple.fr'}]);
    await R5.traiter('GET', '/api/radar', null); await R5.attendre();
    const e5 = R5.etat(), pc5 = e5.ponctuels.map((x) => x.date + ' ' + x.service + ' ' + x.montant), tf = e5.propositions.find((x) => x.service === 'Taxe foncière');
    ok('Radar 0.51 (serveur) : l’échéancier donne ses 3 échéances à venir, le rappel n’en ajoute pas, l’échéance déjà débitée aujourd’hui ne compte pas ; plus 30 € le 05/12 de l’autre échéancier',
      JSON.stringify(pc5) === JSON.stringify(['2026-12-03 Paiement en 4 fois : BOUTIQUE EXEMPLE 20', '2026-12-05 Paiement en 4 fois : Paiement Exemple 30', '2027-01-02 Paiement en 4 fois : BOUTIQUE EXEMPLE 20', '2027-02-01 Paiement en 4 fois : BOUTIQUE EXEMPLE 20']), JSON.stringify(pc5));
    ok('Radar 0.51 (serveur) : l’adhésion au prélèvement mensuel des impôts est proposée tout de suite : Taxe foncière, le 15, à partir du 15/01/2027, montant à compléter, catégorie Impôts', !!tf && tf.debut === '2027-01-15' && tf.jour === 15 && tf.montant === null && tf.cat === 'Impôts' && /échéancier/.test(tf.aide), JSON.stringify(tf));
    ok('Radar 0.51 (serveur) : la facture du mois d’une dépense fixe (160 € le 28/11) remplace l’habituel dans le reste à payer', JSON.stringify(R5.brut().fixes[0].prochain) === '{"date":"2026-11-28","montant":160}' && resteA(R5.brut().fixes, {jour: 28, avance: true}, J(2026, 10, 23), 'mois').total === 160, JSON.stringify(R5.brut().fixes[0]));
    ok('Radar 0.51 (serveur) : aucune alerte « paiement échoué » (ni la mention légale, ni les titres-restaurant), aucune notification', !e5.alertes.some((a) => a.type === 'echec') && !pushs5.length, JSON.stringify(e5.alertes));
    R5.regler('fixes', R5.brut().fixes.concat([{service: 'Impôts', montant: 90, jour: 15, rythme: 'mensuel', debut: '2027-01-15'}]));
    ok('Radar 0.51 (serveur) : la page renvoie les dépenses : la facture du mois et le début sont gardés', !!R5.brut().fixes[0].prochain && R5.brut().fixes[1].debut === '2027-01-15'); }
  { const b = (s) => Buffer.from(s, 'utf8').toString('base64');
    const tx = textOf({mimeType: 'multipart/alternative', parts: [{mimeType: 'text/plain', body: {data: b('Votre client de messagerie ne prend pas en charge le format HTML.')}}, {mimeType: 'text/html', body: {data: b('<html><head><style>td{color:red}</style></head><body><table><tr><td>Montant</td><td>4,50&nbsp;&euro;</td></tr></table><p>Merci &amp; &#224; bient&ocirc;t</p></body></html>')}}]});
    ok('Mails 0.51 : une partie texte qui renvoie au HTML est remplacée par le HTML lu (sans styles, entités traduites, cases séparées)', /Montant \| 4,50 € \|/.test(tx) && /Merci & à bientôt/.test(tx) && !/color/.test(tx), JSON.stringify(tx));
    const tx2 = textOf({mimeType: 'multipart/alternative', parts: [{mimeType: 'text/plain', body: {data: b('Bonjour, votre facture de 12,00 € est disponible. Version HTML : voir en ligne.')}}, {mimeType: 'text/html', body: {data: b('<p>autre</p>')}}]});
    ok('Mails 0.51 : une vraie partie texte reste la partie texte', /12,00 €/.test(tx2), tx2); }
  /* 0.52.0 : les PDF des factures lus sur le serveur, sans IA (factures inventées : l'une produite par Chromium, l'autre écrite lettre par lettre
     comme le logiciel d'une crèche, en Courier et en Helvetica sans largeurs) ; la paie « entre le 5 et le 10 » */
  { const chrome = texteDePdf(fs.readFileSync(new URL('./fixtures/facture-exemple.pdf', import.meta.url)));
    ok('PDF 0.52 : une facture produite par Chromium (police composée, table ToUnicode) se lit, lignes et montants intacts', /Total à payer : 412,50 €/.test(chrome) && /Facture n° 2026-11 du 05\/11\/2026/.test(chrome) && /Prélèvement le 10\/11\/2026/.test(chrome), JSON.stringify(chrome));
    ok('PDF 0.52 : le montant retenu est celui « à payer » (pas une ligne de la facture), la date celle du prélèvement', montantPdf(chrome) === 412.5 && trouverDate(chrome, J(2026, 10, 5)) === '2026-11-10');
    const HV = {M: 833, o: 556, n: 556, t: 278, a: 556, ' ': 278, '\xe0': 556, r: 333, '\xe9': 556, g: 556, l: 222, e: 556, ':': 278, '2': 556, '6': 556, '8': 556, ',': 278, '4': 556, '0': 556, '\x80': 556};
    const pdfMain = (lignes) => {   /* lignes : [police, taille, texte (octets WinAnsi)] ; chaque lettre placée par « (x)' avance 0 Td » */
      let c = 'BT /F1 12 Tf ET\n', y = 700;
      for (const [f, z, tx] of lignes) { c += 'BT /' + f + ' ' + z + ' Tf ET\nBT 60 ' + y + ' Td '; for (const ch of tx) c += '(' + (ch === '(' || ch === ')' || ch === '\\' ? '\\' + ch : ch) + ")' " + ((f === 'F1' ? 600 : HV[ch] || 556) * z / 1000).toFixed(2) + ' 0 Td '; c += 'ET\n'; y -= 20; }
      const flux = zlib.deflateSync(Buffer.from(c, 'latin1')), o = [];
      o.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj', '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
        '3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >> endobj');
      const debut = '%PDF-1.4\n' + o.join('\n') + '\n4 0 obj << /Length ' + flux.length + ' /Filter /FlateDecode >>\nstream\n';
      const fin = '\nendstream\nendobj\n5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >> endobj\n6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n';
      return Buffer.concat([Buffer.from(debut, 'latin1'), flux, Buffer.from(fin, 'latin1')]);
    };
    const main = texteDePdf(pdfMain([['F1', 12, 'Facture de novembre'], ['F2', 12, 'Montant \xe0 r\xe9gler : 268,40 \x80'], ['F1', 10, 'Ech\xe9ance : 15/12/2026']]));
    ok('PDF 0.52 : une facture écrite lettre par lettre (polices standard sans largeurs) se lit sans blancs inventés (« Montant », pas « M ontant »)', /Montant à régler : 268,40 €/.test(main) && /Echéance : 15\/12\/2026/.test(main) && montantPdf(main) === 268.4, JSON.stringify(main));
    ok('PDF 0.52 : un fichier qui n’est pas un PDF, ou un PDF chiffré, ne donne rien (pas d’erreur)', texteDePdf(Buffer.from('bonjour')) === '' && texteDePdf(Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << /Encrypt 9 0 R >>\n%%EOF')) === '');
    /* de bout en bout : 3 factures mensuelles de crèche, montant seulement dans le PDF → proposées avec leur montant et leur jour, sans Claude */
    const F6 = {}, pjs = {};
    ['09', '10', '11'].forEach((mm, i) => { const id = 'pf' + i; pjs[id] = pdfMain([['F2', 12, 'Montant \xe0 r\xe9gler : 268,40 \x80'], ['F1', 10, 'Ech\xe9ance : 05/' + mm + '/2026']]).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
      F6['t' + id] = {id: 't' + id, messages: [{id, threadId: 't' + id, sender: 'noreply@creche-exemple.fr', addressDisplayNames: [{displayName: 'Crèche Exemple', emailAddress: 'noreply@creche-exemple.fr'}], subject: 'Votre facture', plaintextBody: 'Veuillez trouver ci-joint votre facture.', date: '2026-' + mm + '-01T08:00:00Z', labelIds: [], attachments: [{filename: 'facture.pdf', mimeType: 'application/pdf', size: 900, attachmentId: 'a' + id}]}]}; });
    let appelsClaude = 0; const appelsPj = [];
    const R6 = createRadar({file: path.join(DIR, 'radar8.json'), gmail: {lie: () => true, chercher: async () => ({threads: Object.values(F6).map((x) => ({id: x.id}))}), fil: async (id) => F6[id], pj: async (mid, aid) => { appelsPj.push(mid + '/' + aid); return {data: pjs[mid]}; }},
      claude: async () => { appelsClaude++; return {ok: false, error: 'non'}; }, now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 1});
    await R6.traiter('GET', '/api/radar', null); await R6.attendre();
    const p6 = R6.etat().propositions.find((x) => x.cle === 'creche-exemple.fr');
    ok('Radar 0.52 (serveur) : 3 factures dont le montant n’est que dans le PDF → proposée à 268,40 € le 5, lue dans les PDF, sans Claude', !!p6 && p6.montant === 268.4 && p6.jour === 5 && !p6.jourApprox && appelsPj.length === 3 && appelsClaude === 0 && R6.brut().scan.pdf === 3, JSON.stringify([p6, appelsPj.length, appelsClaude]));
    /* 0.66.0 (sa remarque du 22/11/2026, données inventées) : ce qui est vraiment prélevé, écrit dans l'échéancier d'un appel de charges,
       l'emporte sur « montant de l'appel » ; un relevé annuel « reporté sur votre appel » n'est pas un prélèvement ; le tableau des cotisations
       d'un contrat donne le montant de chaque mois */
    { const appel = 'APPEL PREVISIONNEL Période du 01/01/2027 au 31/03/2027 Montant de l\'appel de fonds400,00€ ALUR31,93 ECHEANCIER DES PRELEVEMENTS Id. Créancier SEPA FR00ZZZ000000 Votre RUM 2023000LeMONTANTLeMONTANTPAR PRELEVEMENT10/01/2027431.93Sur votre compte BANQUE EXEMPLE Solde au 01/12/2026546.22';
      ok('Radar 0.66 : l’échéancier des prélèvements d’un appel de charges donne la date et le montant prélevés (431,93 €, pas l’appel de 400,00 € ni le solde)', JSON.stringify(prelevementsPdf(appel)) === JSON.stringify([{date: '2027-01-10', montant: 431.93}]) && montantPdf(appel) !== 431.93, JSON.stringify(prelevementsPdf(appel)));
      ok('Radar 0.66 : prélevé en trois fois (« 10/01/2027 143,98 10/02/2027 143,98 10/03/2027 143,97 ») : trois prélèvements ; un solde daté sans « prélèvement » : rien',
        prelevementsPdf('PAR PRELEVEMENT 10/01/2027 143,98 10/02/2027 143,98 10/03/2027 143,97 Sur votre compte').length === 3 && prelevementsPdf('Solde au 01/12/2026 546,22 € Appel 400,00 €').length === 0);
      ok('Radar 0.66 : un relevé de charges annuel dont le solde « sera reporté sur votre appel de fonds » n’est pas un prélèvement ; l’appel l’est',
        genre('Votre relevé de charges annuel', 'Il fait suite à l\'approbation des comptes. Ce montant sera reporté sur votre appel de fonds du 3ème trimestre.') === 'autre' && genre('Votre appel de charges du 1er trimestre', 'Nous vous prions de trouver votre appel de charges du trimestre.') === 'facture');
      /* un contrat : 15 mois de cotisations (frais de dossier le premier mois, cotisation d'association en septembre, baisse en octobre) */
      const lignes = [['2025-09', 61.2], ...['10', '11', '12'].map((m) => ['2025-' + m, 31.2]), ...['01', '02', '03', '04', '05', '06', '07'].map((m) => ['2026-' + m, 31.2]), ['2026-08', 32.5], ['2026-09', 35.9], ['2026-10', 30.9], ['2026-11', 30.9]];
      const tableau = 'Cotisations\nPériodes\nDate Paiement\nTotal\nDébut\nFin\n' + lignes.map(([k, v]) => '02/' + k.slice(5) + '/' + k.slice(0, 4) + '\n01/' + String(+k.slice(5) % 12 + 1).padStart(2, '0') + '/' + (+k.slice(5) === 12 ? +k.slice(0, 4) + 1 : k.slice(0, 4)) + '\n' + k.slice(5) + '/' + k.slice(0, 4) + '\n' + String(v.toFixed(2)).replace('.', ',') + ' €').join('\n');
      const cal = calendrierPdf('Contrat EXEMPLE EMPRUNTEUR. Assurance de prêt. Cotisation qui sera prélevée le 05/09/2025.\n' + tableau);
      ok('Radar 0.66 : le tableau des cotisations d’un contrat → un montant par mois, en paliers (15 mois, 5 paliers, total juste)', !!cal && cal.debut === '2025-09' && cal.fin === '2026-11' && cal.mois === 15 && cal.paliers.length === 5 && cal.total === 503.4
        && montantPalier(cal.paliers, '2026-03') === 31.2 && montantPalier(cal.paliers, '2026-09') === 35.9 && montantPalier(cal.paliers, '2025-08') === null, JSON.stringify(cal));
      ok('Radar 0.66 : des dates éparses (moins de 12 mois, ou qui ne se suivent pas) ne font pas un tableau de cotisations', calendrierPdf(tableau.split('\n').slice(0, 30).join('\n')) === null);
      const fPal = {jour: 5, montant: 31.2, rythme: 'mensuel', paliers: cal.paliers, fin: '2026-11-05'};
      ok('Radar 0.66 : une dépense à paliers compte le montant de chaque mois (août 32,50 €, septembre 35,90 €, octobre 30,90 €), rien après la fin',
        occurrences(fPal, J(2026, 7, 1), J(2026, 11, 31)).map((o) => o.f.montant).join() === '32.5,35.9,30.9,30.9');
      /* de bout en bout : appels de charges trimestriels (PDF), un relevé annuel reporté, un certificat d'adhésion ; une assurance saisie à la main */
      const AP = (q, d, v) => pdfMain([['F1', 10, 'APPEL PREVISIONNEL ' + q], ['F1', 10, 'Montant de l\'appel de fonds 400,00 \x80'], ['F1', 10, 'ECHEANCIER DES PRELEVEMENTS'], ['F1', 10, 'PAR PRELEVEMENT ' + d + ' ' + v]]).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
      const CE = (() => { const l = [['F1', 9, 'Certificat d\'adh\xe9sion - Assurance de pr\xeat'], ['F1', 9, 'Cotisation qui sera pr\xe9lev\xe9e le 05/09/2025'], ['F1', 9, 'Nom du cr\xe9ancier : EXEMPLE ASSUR']];
        for (const [k, v] of lignes) l.push(['F1', 9, '02/' + k.slice(5) + '/' + k.slice(0, 4) + ' 01/' + String(+k.slice(5) % 12 + 1).padStart(2, '0') + '/' + (+k.slice(5) === 12 ? +k.slice(0, 4) + 1 : k.slice(0, 4)) + ' ' + k.slice(5) + '/' + k.slice(0, 4) + ' ' + String(v.toFixed(2)).replace('.', ',') + ' \x80']);
        return pdfMain(l).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'); })();
      const M = (id, sujet, d, texte, pj, nom) => ({id: 't' + id, messages: [{id, threadId: 't' + id, sender: id.startsWith('c') ? 'gestion@courtier-exemple.fr' : 'comptabilite@syndic-exemple.fr', addressDisplayNames: [{displayName: '', emailAddress: ''}], subject: sujet, plaintextBody: texte, date: d + 'T09:00:00Z',
        attachments: pj ? [{filename: 'CG-exemple.pdf', mimeType: 'application/pdf', attachmentId: 'cg'}, {filename: nom || 'appel.pdf', mimeType: 'application/octet-stream', attachmentId: 'a' + id}] : []}]});
      const PJ = {s1: AP('2T 2026', '10/04/2026', '431.93'), s2: AP('3T 2026', '10/07/2026', '512.50'), s3: AP('4T 2026', '10/10/2026', '431.93'), c1: CE};
      const F9 = {ts1: M('s1', 'Votre appel de charges du 2E TRIMESTRE 2026', '2026-03-16', 'Veuillez trouver votre appel de charges du trimestre.', true), ts2: M('s2', 'Votre appel de charges du 3E TRIMESTRE 2026', '2026-06-25', 'Veuillez trouver votre appel de charges du trimestre.', true),
        tr: M('r1', 'Votre releve de charges annuel', '2026-06-25', 'Votre relevé de charges annuel. Ce montant sera reporté sur votre appel de fonds du 3ème trimestre 2026.', false), ts3: M('s3', 'Votre appel de charges du 4E TRIMESTRE 2026', '2026-09-15', 'Veuillez trouver votre appel de charges du trimestre.', true),
        tc1: M('c1', 'Votre contrat pour votre changement d\'assurance', '2025-07-30', 'Vous trouverez ci-joint votre contrat d\'assurance de prêt.', true, 'Certificat d\'adhésion.pdf')};
      const pjLus = [], R10 = createRadar({file: path.join(DIR, 'radar20.json'), gmail: {lie: () => true, chercher: async (q) => ({threads: Object.values(F9).filter((t) => /has:attachment/.test(q) || t.messages[0].date >= '2025-09').map((x) => ({id: x.id}))}), fil: async (id) => F9[id],
        pj: async (mid, aid) => { pjLus.push(aid); return {data: PJ[mid]}; }}, now: () => Date.parse('2026-11-04T09:00:00Z'), moisDepart: 13});
      R10.regler('fixes', [{service: 'Mon assurance de prêt', montant: 31.2, jour: 5, rythme: 'mensuel'}]);
      await R10.traiter('GET', '/api/radar', null); await R10.attendre();
      const e10 = R10.etat(), sy = e10.propositions.find((x) => x.cle === 'syndic-exemple.fr'), al = e10.alertes.find((a) => a.type === 'calendrier');
      ok('Radar 0.66 (serveur) : appels de charges → le montant prélevé (431,93 €, le 10, trimestriel), l’historique des vrais prélèvements (431,93 / 512,50 / 431,93), sans le relevé annuel',
        !!sy && sy.montant === 431.93 && sy.jour === 10 && sy.rythme === 'trimestriel' && sy.historique.map((h) => h.montant).join() === '431.93,512.5,431.93' && sy.historique.every((h) => /-10$/.test(h.datePrel)), JSON.stringify(sy));
      ok('Radar 0.66 (serveur) : le certificat d’adhésion (son PDF, pas les conditions générales) → une alerte sur l’assurance saisie à la main : 30,90 € ce mois-ci, « Appliquer ces montants ? »',
        !!al && al.fixe && al.montant === 30.9 && /30,90 € ce mois-ci/.test(al.texte) && /Appliquer/.test(al.texte) && al.calendrier.jour === 5 && al.calendrier.paliers.length === 5 && pjLus.includes('ac1') && !pjLus.includes('cg') && !e10.propositions.some((p) => p.paliers), JSON.stringify(al));
      R10.alerte(al.id, 'appliquer'); const fx10 = R10.brut().fixes[0], r10 = resteA(R10.brut().fixes, {jour: 28, avance: true}, J(2026, 10, 4), 'mois');
      ok('Radar 0.66 : « Appliquer » : sa dépense suit le tableau du contrat (paliers, fin en novembre 2026, le 5), le reste à payer compte 30,90 €',
        fx10.paliers.length === 5 && fx10.fin === '2026-11-05' && fx10.jour === 5 && fx10.montant === 30.9 && r10.liste.some((o) => o.f.service === 'Mon assurance de prêt' && o.f.montant === 30.9), JSON.stringify([fx10, r10.liste.map((o) => [o.f.service, o.f.montant])]));
      const garde = R10.regler('fixes', R10.brut().fixes.concat([{service: 'Autre', montant: 1, jour: 2, rythme: 'mensuel', paliers: [{du: '2026-13', montant: 1}, {du: 'x', montant: 2}]}]));
      ok('Radar 0.66 : les paliers d’une dépense restent quand la page renvoie la liste ; des paliers illisibles sont écartés', garde.ok && R10.brut().fixes[0].paliers.length === 5 && !('paliers' in R10.brut().fixes[1]));
      /* une dépense du syndic déjà acceptée avec l'ancien montant (celui de l'appel) : relue, elle prend le montant prélevé, et le dit */
      fs.writeFileSync(path.join(DIR, 'radar23.json'), JSON.stringify({version: 5, fixes: [{id: 'fsy', service: 'Syndic Exemple', cat: 'Logement', montant: 400, jour: 10, rythme: 'trimestriel', mois: 1, source: 'mail', dom: 'syndic-exemple.fr', cle: 'syndic-exemple.fr'},
        {id: 'fmain', service: 'Loyer à la main', montant: 700, jour: 3, rythme: 'mensuel', source: 'toi'}]}));
      const R13 = createRadar({file: path.join(DIR, 'radar23.json'), gmail: {lie: () => true, chercher: async (q) => ({threads: /has:attachment/.test(q) ? [] : Object.values(F9).filter((t) => t.messages[0].date >= '2025-09' && !t.id.startsWith('tc')).map((x) => ({id: x.id}))}), fil: async (id) => F9[id], pj: async (mid) => ({data: PJ[mid]})},
        now: () => Date.parse('2026-11-04T09:00:00Z'), moisDepart: 13});
      await R13.traiter('GET', '/api/radar', null); await R13.attendre();
      const fs13 = R13.brut().fixes, ac = R13.etat().alertes.find((a) => a.type === 'corrige');
      ok('Radar 0.66 : relue avec les nouvelles règles, la dépense du syndic déjà acceptée passe de 400,00 € (l’appel) à 431,93 € (le prélèvement), avec l’alerte « Montant corrigé » ; une dépense saisie à la main n’est pas touchée',
        fs13[0].montant === 431.93 && !!ac && ac.avant === 400 && ac.montant === 431.93 && fs13[1].montant === 700 && !R13.brut().revise, JSON.stringify([fs13, ac]));
      /* sans dépense à la main : proposée, avec ses paliers ; « Garder mon montant » : plus de question */
      const R11 = createRadar({file: path.join(DIR, 'radar21.json'), gmail: {lie: () => true, chercher: async (q) => ({threads: /has:attachment/.test(q) ? [{id: 'tc1'}] : []}), fil: async (id) => F9[id], pj: async (mid) => ({data: PJ[mid]})}, now: () => Date.parse('2026-11-04T09:00:00Z'), moisDepart: 2});
      await R11.traiter('GET', '/api/radar', null); await R11.attendre();
      const p11 = R11.etat().propositions.find((x) => x.paliers);
      ok('Radar 0.66 : sans dépense saisie, l’assurance est proposée : « Assurance de prêt (Exemple Assur) », 30,90 €, le 5, catégorie Assurances, avec ses paliers et sa fin',
        !!p11 && p11.service === 'Assurance de prêt (Exemple Assur)' && p11.montant === 30.9 && p11.jour === 5 && p11.cat === 'Assurances' && p11.paliers.length === 5 && p11.fin === '2026-11-05', JSON.stringify(p11));
      const R12 = createRadar({file: path.join(DIR, 'radar22.json'), gmail: {lie: () => true, chercher: async (q) => ({threads: /has:attachment/.test(q) ? [{id: 'tc1'}] : []}), fil: async (id) => F9[id], pj: async (mid) => ({data: PJ[mid]})}, now: () => Date.parse('2026-11-04T09:00:00Z'), moisDepart: 2});
      R12.regler('fixes', [{service: 'Assurance emprunteur', montant: 40, jour: 5, rythme: 'mensuel'}]); await R12.traiter('GET', '/api/radar', null); await R12.attendre();
      const a12 = R12.etat().alertes.find((a) => a.type === 'calendrier'); R12.alerte(a12.id, 'garder');
      R12.brut().fils = {}; R12.brut().vus = []; R12.brut().scan = null; await R12.traiter('GET', '/api/radar', null); await R12.attendre();
      ok('Radar 0.66 : « Garder mon montant » : sa dépense garde 40 €, et la question ne revient pas à la relecture', R12.brut().fixes[0].montant === 40 && !R12.brut().fixes[0].paliers && !R12.etat().alertes.some((a) => a.type === 'calendrier'), JSON.stringify(R12.etat().alertes)); }
    /* la paie « entre le 5 et le 10 » : le reste à payer court jusqu'au 10 ; la notification de la veille le dit */
    const R7 = createRadar({file: path.join(DIR, 'radar9.json'), gmail: {lie: () => false}, now: () => Date.parse('2026-12-03T18:00:00Z'), push: async (m) => { R7m.push(m); return []; }}), R7m = [];
    const ok1 = R7.regler('revenus', {jour: 10, des: 5, avance: true}).ok, ok2 = R7.regler('fixes', [{service: 'Loyer exemple', montant: 50, jour: 4, rythme: 'mensuel'}]).ok;
    const msg7 = await R7.veille();
    ok('Radar 0.52 : la paie « entre le 5 et le 10 » est gardée ; la veille dit « d’ici ta paie (au plus tard le jeu. 10/12) »', ok1 && ok2 && R7.brut().revenus.des === 5 && R7.brut().revenus.jour === 10 && !!msg7 && /au plus tard le jeu\. 10\/12/.test(msg7.body), JSON.stringify([R7.brut().revenus, msg7]));
    R7.regler('revenus', {jour: 10, des: 12});
    ok('Radar 0.52 : une fenêtre à l’envers (dès le 12, au plus tard le 10) est ignorée', R7.brut().revenus.des === undefined, JSON.stringify(R7.brut().revenus)); }
  /* 0.56.0 : détection plus fine (sa demande : « il manque des dépenses », « montants ou jours faux ») ; noms et montants inventés */
  { ok('Radar 0.56 : une résiliation confirmée est reconnue ; « pour résilier, rendez-vous… » ne l’est pas', genre('Confirmation de résiliation', 'Nous avons bien pris en compte votre demande de résiliation. Votre abonnement prendra fin le 30/11/2026.') === 'resiliation'
      && genre('Your subscription has been canceled', 'We’re sorry to see you go.') === 'resiliation' && genre('Votre facture', 'Montant : 20,00 €. Pour résilier, rendez-vous dans votre espace client.') === 'facture'
      && genre('Your new subscription', 'You will continue to get deliveries until your subscription is cancelled. Cancel anytime.') !== 'resiliation' && genre('Votre abonnement', 'Si votre abonnement est résilié, vos données sont gardées 30 jours.') !== 'resiliation');
    ok('Radar 0.56 : le rythme d’un prix est celui écrit près du montant (« 59,88 € par an, soit 4,99 € par mois » = annuel ; « 9,99 €/mois » = mensuel)', rythmeDe('Votre abonnement : 59,88 € par an, soit 4,99 € par mois.', 59.88) === 'annuel' && rythmeDe('Votre abonnement : 9,99 €/mois, sans engagement.', 9.99) === 'mensuel');
    const av = lireMail({id: 'c1', sender: 'contrats@assur-exemple.fr', nom: 'Assur Exemple', objet: 'Votre avis d’échéance 2027', date: '2026-11-20', texte: 'Avis d’échéance de votre assurance habitation. Cotisation annuelle : 312,00 €, payable en 12 mensualités de 26,00 €. Premier prélèvement le 05/01/2027.'});
    ok('Radar 0.56 : un avis d’échéance d’assurance (312 € par an, 12 mensualités de 26 €) devient un contrat mensuel de 26 €, dès janvier', av.genre === 'contrat' && av.montant === 26 && av.rythme === 'mensuel' && av.datePrel === '2027-01-05', JSON.stringify(av));
    const ab = lireMail({id: 'c2', sender: 'hello@stream-exemple.com', nom: 'Stream Exemple', objet: 'Bienvenue chez Stream Exemple', date: '2026-11-18', texte: 'Merci pour votre abonnement : 13,49 € par mois, prélevé chaque mois à partir du 18/12/2026.'});
    ok('Radar 0.56 : une souscription (« 13,49 € par mois ») devient un contrat mensuel proposé tout de suite', ab.genre === 'contrat' && ab.montant === 13.49 && ab.rythme === 'mensuel', JSON.stringify(ab));
    const ec = lireMail({id: 'c3', sender: 'clients@energie-exemple.fr', nom: 'Énergie Exemple', objet: 'Votre échéancier 2027', date: '2026-12-20', texte: "Voici l'échéancier de votre mensualisation : | 85,00 € | 15/01/2027 | | 85,00 € | 15/02/2027 | | 85,00 € | 15/03/2027 | | 85,00 € | 15/04/2027 | | 85,00 € | 15/05/2027 | | 85,00 € | 15/06/2027 |"});
    ok('Radar 0.56 : un échéancier de mensualisation (6 × 85 €, chaque mois) devient une dépense fixe du 15/01 au 15/06/2027, pas 6 prélèvements isolés', ec.genre === 'mensualisation' && ec.montant === 85 && ec.debut === '2027-01-15' && ec.fin === '2027-06-15', JSON.stringify(ec));
    const oc = occurrences({service: 'Fin exemple', montant: 10, jour: 10, rythme: 'mensuel', fin: '2026-12-31'}, J(2026, 10, 23), J(2027, 2, 31)).map((o) => ymd(o.le));
    ok('Radar 0.56 : une dépense qui s’arrête ne compte plus après sa fin (10/12 seulement)', JSON.stringify(oc) === '["2026-12-10"]', JSON.stringify(oc));
    /* de bout en bout : contrats d'un seul mail, renouvellement annuel, mensualisation, résiliation d'une dépense fixe (il répond Retirer), factures qui ont cessé (il répond Garder) */
    const F8 = {}, m8 = (id, from, nom, objet, texte, date) => { F8['t' + id] = {id: 't' + id, messages: [{id, threadId: 't' + id, sender: from, addressDisplayNames: [{displayName: nom, emailAddress: from}], subject: objet, plaintextBody: texte, date: date + 'T08:00:00Z', labelIds: []}]}; };
    m8('b1', 'contrats@assur-exemple.fr', 'Assur Exemple', 'Votre avis d’échéance 2027', 'Avis d’échéance. Cotisation annuelle : 312,00 €, payable en 12 mensualités de 26,00 €. Premier prélèvement le 05/01/2027.', '2026-11-20');
    m8('b2', 'no-reply@cloud-exemple.com', 'Cloud Exemple', 'Votre abonnement sera renouvelé le 14 mars 2027', 'Votre abonnement annuel de 19,99 € par an sera automatiquement renouvelé le 14 mars 2027.', '2026-11-15');
    m8('b3', 'clients@energie-exemple.fr', 'Énergie Exemple', 'Votre échéancier 2027', "Échéancier de votre mensualisation : | 85,00 € | 15/01/2027 | | 85,00 € | 15/02/2027 | | 85,00 € | 15/03/2027 | | 85,00 € | 15/04/2027 | | 85,00 € | 15/05/2027 |", '2026-11-21');
    m8('b4', 'service@box-exemple.fr', 'Box Exemple', 'Confirmation de résiliation', 'Nous avons bien pris en compte votre demande de résiliation. Votre contrat prendra fin le 30/11/2026.', '2026-11-19');
    ['2026-06', '2026-07', '2026-08'].forEach((mm, i) => m8('g' + i, 'factures@gym-exemple.fr', 'Gym Exemple', 'Votre facture', 'Montant : 29,90 €. Il sera prélevé le 05/' + mm.slice(5) + '/2026.', mm + '-01'));
    const R8 = createRadar({file: path.join(DIR, 'radar10.json'), gmail: {lie: () => true, chercher: async (q) => ({threads: /from:\(|newer_than/.test(q) ? [] : Object.values(F8).map((x) => ({id: x.id}))}), fil: async (id) => F8[id]},
      now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 6});
    R8.regler('fixes', [{id: 'fb', service: 'Box Exemple', cat: 'Télécoms', montant: 30, jour: 28, rythme: 'mensuel', source: 'mail', dom: 'box-exemple.fr', cle: 'box-exemple.fr'},
      {id: 'fg', service: 'Gym Exemple', cat: 'Autres', montant: 29.9, jour: 5, rythme: 'mensuel', source: 'mail', dom: 'gym-exemple.fr', cle: 'gym-exemple.fr'}]);
    await R8.traiter('GET', '/api/radar', null); await R8.attendre();
    const e8 = R8.etat(), pa = e8.propositions.find((x) => x.cle === 'assur-exemple.fr'), pc = e8.propositions.find((x) => x.cle === 'cloud-exemple.com'), pm = e8.propositions.find((x) => x.cle === 'energie-exemple.fr');
    ok('Radar 0.56 (serveur) : proposées dès un seul mail : l’assurance (26 € le 5, dès janvier), l’abonnement annuel (19,99 €, le 14 mars), la mensualisation (85 € le 15, de janvier à mai)',
      !!pa && pa.montant === 26 && pa.jour === 5 && pa.rythme === 'mensuel' && pa.debut === '2027-01-05' && !!pc && pc.montant === 19.99 && pc.rythme === 'annuel' && pc.mois === 3 && pc.jour === 14
      && !!pm && pm.montant === 85 && pm.jour === 15 && pm.debut === '2027-01-15' && pm.fin === '2027-05-15' && !e8.ponctuels.some((x) => x.montant === 85), JSON.stringify([pa, pc, pm]));
    const ar = e8.alertes.find((a) => a.type === 'resiliation'), as = e8.alertes.find((a) => a.type === 'silence');
    ok('Radar 0.56 (serveur) : la résiliation de la box (fin le 30/11) et le silence de la salle de sport (plus de facture depuis août) font chacune une alerte, sans rien changer seules',
      !!ar && ar.fixe === 'fb' && ar.fin === '2026-11-30' && !!as && as.fixe === 'fg' && as.dernier === '2026-08-05' && R8.brut().fixes.length === 2 && !R8.brut().fixes[0].fin, JSON.stringify(e8.alertes));
    const r1 = await R8.traiter('POST', '/api/radar/alerte', async () => ({id: ar.id, action: 'retirer'})), r2 = await R8.traiter('POST', '/api/radar/alerte', async () => ({id: as.id, action: 'garder'}));
    const fb = R8.brut().fixes.find((f) => f.id === 'fb');
    ok('Radar 0.56 (serveur) : « Retirer » arrête la box à sa date de fin (30/11, encore comptée d’ici là) ; « Garder » garde la salle de sport et plus d’alerte pour ce silence', r1.status === 200 && r2.status === 200 && !!fb && fb.fin === '2026-11-30'
      && R8.brut().fixes.some((f) => f.id === 'fg' && !f.fin) && !R8.etat().alertes.some((a) => a.type === 'silence' || a.type === 'resiliation') && resteA(R8.brut().fixes, {jour: 28, avance: true}, J(2026, 10, 23), 'mois').liste.some((o) => o.f.service === 'Box Exemple'), JSON.stringify(R8.brut().fixes));
    await R8.lireMaintenant();
    ok('Radar 0.56 (serveur) : après « Garder », une nouvelle lecture ne refait pas l’alerte du même silence', !R8.etat().alertes.some((a) => a.type === 'silence'), JSON.stringify(R8.etat().alertes));
    R8.regler('fixes', R8.brut().fixes.filter((f) => f.id !== 'fg'));
    ok('Radar 0.56 (serveur) : une dépense lue dans les mails qu’il retire ne lui est plus proposée', R8.brut().refus.includes('gym-exemple.fr'));
    const q8 = []; const R9 = createRadar({file: path.join(DIR, 'radar11.json'), gmail: {lie: () => true, chercher: async (q) => { q8.push(q); return {threads: []}; }, fil: async () => ({messages: []})}, now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 1});
    R9.regler('fixes', [{id: 'f1', service: 'Box', montant: 30, jour: 28, rythme: 'mensuel', source: 'mail', dom: 'box-exemple.fr', cle: 'box-exemple.fr'}, {id: 'f2', service: 'Ami', montant: 5, jour: 2, rythme: 'mensuel', source: 'mail', dom: 'gmail.com', cle: 'gmail.com'},
      {id: 'f3', service: 'Paiement', montant: 5, jour: 2, rythme: 'mensuel', source: 'mail', dom: 'paypal.fr', cle: 'paypal.fr:boutique'}]);
    await R9.traiter('GET', '/api/radar', null); await R9.attendre();
    ok('Radar 0.56 : la lecture cherche aussi les phrases d’un prélèvement et tout ce qu’envoient ses fournisseurs connus (jamais une messagerie personnelle ni un intermédiaire)', q8.some((q) => /"sera prélevé"/.test(q) && /after:/.test(q)) && q8.some((q) => /^from:\(box-exemple\.fr\)/.test(q)) && !q8.some((q) => /from:\([^)]*(gmail\.com|paypal\.fr)/.test(q)), JSON.stringify(q8)); }
  /* 0.56.0, suite : formats relevés sur une vraie boîte (exemples réécrits, noms et montants inventés) */
  { ok('Radar 0.56 : « 15359€ » collé (virgule perdue) = 153,59 € ; « SAS au capital de 56 800 € » n’est pas un prix', montantDe('15359') === 153.59 && trouverMontant(sansPub('Votre facture est disponible.\nSAS au capital de 56 800 € - RCS Paris')) === null);
    ok('Radar 0.56 : un montant « en votre faveur » (régularisation) n’est pas une dépense ; « paiement réussi » est un paiement', genre('Votre facture de régularisation', 'D’un montant de 167,60 € en votre faveur. Cette somme sera créditée sur votre compte.') === 'autre' && genre('Paiement réussi', 'Votre paiement de 16,50 € a bien été reçu.') === 'facture');
    const mz = lireMail({id: 'm1', sender: 'hello@gaz-exemple.fr', nom: 'Gaz Exemple', objet: 'Vos mensualités évoluent', date: '2026-06-01', texte: 'Votre mensualité s’élèvera désormais à 12204€ par mois, jusqu’à votre prochaine facture.'});
    ok('Radar 0.56 : « Votre mensualité s’élèvera désormais à 12204€ par mois » : une nouvelle mensualité de 122,04 €', mz.genre === 'mensualite' && mz.montant === 122.04, JSON.stringify(mz));
    const pubm = lireMail({id: 'm2', sender: 'contact@assur2-exemple.fr', nom: 'Assur Deux', objet: 'Un nouveau document est disponible', date: '2026-11-20', texte: 'Votre avis d’échéance est disponible dans votre espace. Regroupez vos contrats et recevez en moyenne 108 €. ET SI VOUS REGROUPIEZ ? 12,39 € par mois, c’est notre estimation.'});
    ok('Radar 0.56 : les montants publicitaires (« recevez en moyenne 108 € », « 12,39 € par mois, c’est notre estimation ») ne font ni un prix ni un contrat', pubm.genre !== 'contrat' && !pubm.montant, JSON.stringify(pubm));
    const sous = lireMail({id: 'm3', sender: 'clients@elec-exemple.fr', nom: 'Élec Exemple', objet: 'Confirmation de votre souscription chez Élec Exemple', date: '2025-11-24', texte: 'Prix garanti jusqu’au 30/11/2027. Mensualité : non applicable. Votre date de prélèvement : le 20 de chaque mois.'});
    ok('Radar 0.56 : une souscription sans prix n’est pas une facture ; elle donne le jour de prélèvement (le 20) ; une date à 2 ans n’est pas un prélèvement', sous.genre === 'autre' && sous.jourMois === 20 && !sous.datePrel, JSON.stringify(sous));
    ok('Radar 0.56 : « Maya from Exemple » devient « Exemple » ; un syndic va dans Logement, un assureur en ligne dans Assurances', nomService('Léa from Luko', 'hello@luko.eu') === 'Luko' && categorie('foncia.fr', 'Foncia') === 'Logement' && categorie('luko.eu', 'Luko') === 'Assurances');
    /* une facture d'énergie au montant qui change, sans jour écrit : proposée, au jour donné par sa souscription ; un achat qui varie, non */
    const rv = (cle, service, montant, date, datePrel) => ({id: cle + date, dom: cle, cle, service, montant, date, datePrel: datePrel || null, genre: 'facture'});
    const pe = regrouper(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].map((m, i) => rv('elec-exemple.fr', 'Élec Exemple', [52.8, 63.56, 58.1, 61.2, 62.88][i], m + '-07')), J(2026, 10, 23), {'elec-exemple.fr': 20})[0];
    ok('Radar 0.56 : électricité au montant qui change, sans jour écrit dans les factures : proposée « environ », le 20 (jour écrit à la souscription)', !!pe && pe.rythme === 'mensuel' && pe.estime && pe.jour === 20 && !pe.jourApprox, JSON.stringify(pe));
    /* de bout en bout : mensualité qui change (dépense fixe mise à jour), renouvellements, mensualisation qui remplace l'annuel, commande + rappel du même mois */
    const F9 = {}, m9 = (id, from, nom, objet, texte, date, pj) => { F9['t' + id] = {id: 't' + id, messages: [{id, threadId: 't' + id, sender: from, addressDisplayNames: [{displayName: nom, emailAddress: from}], subject: objet, plaintextBody: texte, date: date + 'T08:00:00Z', labelIds: [], ...(pj ? {attachments: [{filename: 'f.pdf', mimeType: 'application/pdf', size: 900, data: pj}]} : {})}]}; };
    m9('n1', 'hello@gaz-exemple.fr', 'Gaz Exemple', 'Vos mensualités évoluent', 'Votre mensualité s’élèvera désormais à 13360€ par mois, jusqu’à votre prochaine facture.', '2026-11-05');
    m9('n2', 'no-reply@assur3-exemple.com', 'Lea from Assur3', 'Votre police est sur le point de se renouveler', 'Votre police sera renouvelée le 28/12/2026. Prix : 15,17 € par mois.', '2026-11-10');
    m9('n3', 'no-reply@shop-exemple.fr', 'Shop Exemple', 'Your membership renews soon', 'Your annual membership will renew automatically on 19 August 2027.', '2026-11-12');
    m9('n4', 'ne-pas-repondre@dgfip.finances.gouv.fr', 'Finances publiques', 'ADHÉSION AU PRÉLÈVEMENT MENSUEL : TAXES FONCIÈRES', "Type d'impôt | Taxes foncières\nDate de premier prélèvement | 15 janvier 2027", '2026-11-02');
    ['2025-10-27', '2026-10-26'].forEach((d, i) => m9('tf' + i, 'ne-pas-repondre@dgfip.finances.gouv.fr', 'Finances publiques', 'Votre avis de taxes foncières', 'Taxes foncières : montant 980,00 €, prélevé le ' + d.slice(8) + '/10/' + d.slice(0, 4) + '.', d.slice(0, 8) + '05'));
    const R9 = createRadar({file: path.join(DIR, 'radar12.json'), gmail: {lie: () => true, chercher: async (q) => ({threads: /from:\(|newer_than/.test(q) ? [] : Object.values(F9).map((x) => ({id: x.id}))}), fil: async (id) => F9[id]}, now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 14});
    R9.regler('fixes', [{id: 'fz', service: 'Gaz Exemple', cat: 'Logement', montant: 122.04, jour: 13, rythme: 'mensuel', source: 'mail', dom: 'gaz-exemple.fr', cle: 'gaz-exemple.fr'}]);
    await R9.traiter('GET', '/api/radar', null); await R9.attendre();
    const e9 = R9.etat(), am = e9.alertes.find((a) => a.type === 'mensualite'), pl = e9.propositions.find((x) => x.cle === 'assur3-exemple.com'), ps = e9.propositions.find((x) => x.cle === 'shop-exemple.fr'), pt = e9.propositions.filter((x) => /Taxe foncière/.test(x.service));
    ok('Radar 0.56 (serveur) : la nouvelle mensualité (133,60 €) met à jour la dépense fixe et le dit (avant : 122,04 €)', !!am && am.montant === 133.6 && am.avant === 122.04 && R9.brut().fixes[0].montant === 133.6, JSON.stringify([am, R9.brut().fixes[0]]));
    ok('Radar 0.56 (serveur) : un renouvellement chiffré (15,17 € par mois, le 28) est proposé ; un abonnement annuel sans prix (le 19 août) aussi, « montant à compléter »', !!pl && pl.montant === 15.17 && pl.rythme === 'mensuel' && pl.jour === 28 && pl.service === 'Assur3' && !!ps && ps.montant === null && ps.rythme === 'annuel' && ps.mois === 8 && ps.jour === 19, JSON.stringify([pl, ps]));
    ok('Radar 0.56 (serveur) : la mensualisation d’un impôt remplace son paiement annuel (une seule proposition : le 15, dès janvier)', pt.length === 1 && pt[0].rythme === 'mensuel' && pt[0].debut === '2027-01-15', JSON.stringify(pt)); }
  { const b = (s) => Buffer.from(s, 'utf8').toString('base64');
    const tx = textOf({mimeType: 'multipart/alternative', parts: [{mimeType: 'text/plain', body: {data: b('Votre assurance de prêt : prélèvement')}}, {mimeType: 'text/html', body: {data: b('<p>Votre assurance de prêt : prélèvement</p><p>Votre cotisation de 31,20 € sera prélevée le 05 de chaque mois.</p><p>Merci de votre confiance, à bientôt sur votre espace.</p>')}}]});
    ok('Mails 0.56 : une partie texte qui n’a que l’objet cède la place au HTML (le montant et le jour y sont)', /31,20 € sera prélevée le 05 de chaque mois/.test(tx), tx);
    /* PDF : flux en ASCII85 puis compressé (générateur courant), texte dans un formulaire interne, longueur indirecte ; « Total » et son montant sur deux lignes */
    const a85 = (buf) => { let o = '<~'; for (let i = 0; i < buf.length; i += 4) { const c = [0, 1, 2, 3].map((k) => buf[i + k] || 0), n = Math.min(4, buf.length - i); let v = ((c[0] * 256 + c[1]) * 256 + c[2]) * 256 + c[3]; if (v === 0 && n === 4) { o += 'z'; continue; } const d = []; for (let k = 0; k < 5; k++) { d.unshift(String.fromCharCode(33 + (v % 85))); v = Math.floor(v / 85); } o += d.join('').slice(0, n + 1); } return o + '~>'; };
    const forme = zlib.deflateSync(Buffer.from('BT /F1 10 Tf 60 700 Td (Total) Tj ET BT /F1 10 Tf 60 680 Td (412,50 \x80) Tj ET', 'latin1')), page = Buffer.from(a85(zlib.deflateSync(Buffer.from('q /Fm1 Do Q', 'latin1'))), 'latin1');
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /Resources << /XObject << /Fm1 5 0 R >> >> /Contents 4 0 R >> endobj\n4 0 obj << /Length 9 0 R /Filter [/ASCII85Decode /FlateDecode] >>\nstream\n', 'latin1'), page,
      Buffer.from('\nendstream\nendobj\n5 0 obj << /Type /XObject /Subtype /Form /BBox [0 0 600 800] /Resources << /Font << /F1 6 0 R >> >> /Length ' + forme.length + ' /Filter /FlateDecode >>\nstream\n', 'latin1'), forme,
      Buffer.from('\nendstream\nendobj\n6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj\n9 0 obj ' + page.length + ' endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n', 'latin1')]);
    const tp = texteDePdf(pdf);
    ok('PDF 0.56 : ASCII85 + compression, texte dans un formulaire interne, longueur indirecte : lu ; « Total » puis « 412,50 € » donne 412,50 €', /Total\n412,50 €/.test(tp) && montantPdf(tp) === 412.5, JSON.stringify(tp)); }
  /* ---------- 0.68.0 (ses retours du 23/11/2026, exemples inventés) : la relecture qui se relance, des alertes sans doublon et récupérables,
     les paiements en plusieurs fois suivis par achat ---------- */
  { const th = (id, sender, nom, objet, texte, date) => ({id, messages: [{id: 'm' + id, threadId: id, sender, addressDisplayNames: [{displayName: nom, emailAddress: sender}], subject: objet, plaintextBody: texte, date, labelIds: ['INBOX']}]});
    const lien = (pid) => '\n| Se connecter[](https://www.paypal.com/myaccount/paylater/planDetails?cpi=PAY_LATER_FR&plan_id=' + pid + '&paylater_source=email) |';
    const PID = '11111111-2222-3333-4444-555555555555';
    const planB = th('pb', 'service@paypal.fr', 'PayPal', 'Votre plan de paiements Paiement en 4X est prêt', '| Voici votre nouveau plan de paiements Paiement en 4X. |\n| Votre achat de 80,00 € EUR auprès de BOUTIQUE EXEMPLE a été divisé en 4 paiements plus petits. |\n| Mensualité |\n| 20,00 € EUR/mois |\n| Montant de la transaction |\n| 80,00 € EUR |\n| * 20,00 € EUR à régler aujourd\'hui * 20,00 € EUR le 3 novembre 2026 * 20,00 € EUR le 3 décembre 2026 * 20,00 € EUR le 2 janvier 2027 * 20,00 € EUR le 1 février 2027 |' + lien(PID), '2026-11-02T23:40:00Z');
    const confB = th('cb', 'service@paypal.fr', 'PayPal', 'Confirmation de votre Paiement en 4X', '| Le remboursement de votre échéance Paiement en 4X a été reçu. |\n| Vous avez effectué un paiement de 20,00 € EUR pour votre Paiement en 4X auprès de BOUTIQUE EXEMPLE. Le paiement a été débité de votre carte le 3 novembre 2026. |\n| Montant du paiement |\n| 20,00 € EUR |\n| Marchand |\n| BOUTIQUE EXEMPLE |\n| Montant restant |\n| 60,00 € EUR |' + lien(PID), '2026-11-03T08:10:00Z');
    const retB = th('rb', 'service@paypal.fr', 'PayPal', 'Paiement en 4X : Concernant votre droit de rétractation', '| Votre délai de rétractation a commencé |\n| Le 3 novembre 2026, vous avez accepté un prêt de 80,00 € EUR pour votre achat chez BOUTIQUE EXEMPLE en utilisant Paiement en 4X. Vous pouvez vous rétracter jusqu\'au 1 décembre 2026. |', '2026-11-20T08:00:00Z');
    const planM = th('pm', 'conseiller@cofidis.fr', 'Conseiller', 'Consultez l’échéancier de vos achats financés', 'Suite à votre achat en 4 fois par carte bancaire sur le site MAGASIN EXEMPLE réalisé le 02/11/2026 d\'un montant de 80,00 €, nous vous informons du prélèvement de votre 1ère échéance :\n| MONTANT | DATE DE PRÉLÈVEMENT |\n| 20,00 € | 03/11/2026 |\n| 20,00 € | 03/12/2026 |\n| 20,00 € | 03/01/2027 |\n| 20,00 € | 03/02/2027 |\n| TOTAL À PAYER : 80,00 € |', '2026-11-03T09:00:00Z');
    const dix = ['10/12/2026', '10/01/2027', '10/02/2027', '10/03/2027', '10/04/2027', '10/05/2027', '10/06/2027', '10/07/2027', '10/08/2027', '10/09/2027'].map((d) => '| 30,00 € | ' + d + ' |').join('\n');
    const plan10 = th('p10', 'service@oney.fr', 'Oney', 'Votre paiement en 10 fois est accepté', 'Votre achat de 300,00 € auprès de MEUBLE EXEMPLE en 10 fois :\n' + dix, '2026-11-05T09:00:00Z');
    const rapL = th('rl', 'service@paypal.fr', 'PayPal', 'L\'échéance de votre Paiement en 4X approche', '| Votre prochaine échéance de 15,00 € EUR sera due le 28 novembre 2026. |\n| Marchand |\n| LIBRAIRIE EXEMPLE |', '2026-11-21T08:00:00Z');
    const facts = ['2026-08', '2026-09', '2026-10', '2026-11'].flatMap((m, i) => [th('fe' + i, 'factures@eau-exemple.fr', 'Eau Exemple', 'Votre facture', 'Montant TTC : 21,30 €. Il sera prélevé le 6/' + m.slice(5) + '/' + m.slice(0, 4) + '.', m + '-01T08:00:00Z'),
      th('fc' + i, 'factures@club-exemple.fr', 'Club Exemple', 'Votre facture', 'Montant : 29,90 €. Prélèvement le 10/' + m.slice(5) + '/' + m.slice(0, 4) + '.', m + '-02T08:00:00Z')]).filter((t) => !/^fc[23]$/.test(t.id));   /* le club : plus de facture depuis septembre */
    const echecs = ['2026-11-10', '2026-11-14', '2026-11-18'].map((d, i) => th('ev' + i, 'info@video-exemple.com', 'Video Exemple', 'Payment failed', 'We couldn\'t process your payment of €9.99. Please update your payment method.', d + 'T08:00:00Z'));
    const obscur = th('fo', 'factures@obscur-exemple.fr', 'Obscur Exemple', 'Votre facture', 'Votre facture est disponible dans votre espace client.', '2026-10-05T08:00:00Z');   /* illisible par les règles : pour Claude */
    const F = Object.fromEntries([planB, confB, retB, planM, plan10, rapL, ...facts, ...echecs, obscur].map((t) => [t.id, t]));
    let porte = null; const fichier = path.join(DIR, 'radar68.json'), appelsC = [];
    const gmail68 = {lie: () => true, chercher: async (q) => { if (porte) await porte.p; const m = q.match(/after:(\d{4})\/(\d{2})/); if (!m) return {threads: []};
      return {threads: Object.values(F).filter((t) => t.messages[0].date.startsWith(m[1] + '-' + m[2])).map((t) => ({id: t.id}))}; }, fil: async (id) => F[id]};
    const claude68 = async (prompt) => { appelsC.push(prompt); const ids = [...prompt.matchAll(/\[mail (\w+)\]/g)].map((x) => x[1]); return {ok: true, text: JSON.stringify(ids.map((id) => ({id, genre: 'facture', service: 'Obscur', montant: 12.5, date_prelevement: null})))}; };
    /* le club et l'eau sont déjà des dépenses fixes lues dans ses mails (avant la relecture) */
    fs.writeFileSync(fichier, JSON.stringify({version: 7, fixes: [{id: 'fclub', service: 'Club Exemple', cat: 'Autres', montant: 29.9, jour: 10, rythme: 'mensuel', source: 'mail', dom: 'club-exemple.fr', cle: 'club-exemple.fr'}], revenus: {jour: 5, avance: true}}));
    let maintenant68 = Date.parse('2026-11-23T09:00:00Z');
    const R68 = createRadar({file: fichier, gmail: gmail68, claude: claude68, now: () => maintenant68, moisDepart: 4});
    await R68.traiter('GET', '/api/radar', null); await R68.attendre();
    let e = R68.etat();
    const pB = e.plans.find((p) => p.service === 'BOUTIQUE EXEMPLE'), pM = e.plans.find((p) => p.service === 'MAGASIN EXEMPLE'), p10 = e.plans.find((p) => p.service === 'MEUBLE EXEMPLE'), pL = e.plans.find((p) => p.service === 'LIBRAIRIE EXEMPLE');
    ok('Radar 0.68 : un plan par achat : 4 échéances (« aujourd’hui » écrit deux fois par un mail de 0 h 40 ne fait pas une cinquième), la première payée d’après sa confirmation, 60 € restants comme écrit dans le mail',
      !!pB && pB.via === 'PayPal' && pB.fois === 4 && pB.total === 80 && pB.echeances.length === 4 && pB.payees === 1 && pB.reste === 60 && pB.restant === 60 && pB.prochaine.date === '2026-12-03' && !pB.partiel, JSON.stringify(pB));
    ok('Radar 0.68 : l’avis de rétractation (« un prêt de 80,00 € … jusqu’au 1 décembre ») ne compte pas l’achat entier comme un prélèvement ; ni comme une échéance', !e.ponctuels.some((x) => x.montant === 80) && e.plans.filter((p) => p.service === 'BOUTIQUE EXEMPLE').length === 1, JSON.stringify(e.ponctuels));
    ok('Radar 0.68 : deux achats différents avec une échéance de 20 € le même jour comptent tous les deux (avant : la seconde était effacée)', !!pM && pM.via === 'Cofidis' && e.ponctuels.filter((x) => x.date === '2026-12-03' && x.montant === 20).length === 2
      && resteA([], {jour: 5, avance: true}, J(2026, 10, 23), 'paie', e.ponctuels).total === 55, JSON.stringify(e.ponctuels.filter((x) => x.date <= '2026-12-04')));
    ok('Radar 0.68 : un paiement en 10 fois reste un paiement en plusieurs fois (ses 10 échéances), pas une « dépense fixe » à valider', !!p10 && p10.fois === 10 && p10.reste === 300 && p10.echeances.length === 10 && !e.propositions.some((x) => /meuble/i.test(x.service)), JSON.stringify(p10));
    ok('Radar 0.68 : un rappel seul (sans le mail du plan) donne un plan partiel avec son échéance', !!pL && pL.partiel && pL.reste === 15 && pL.prochaine.date === '2026-11-28', JSON.stringify(pL));
    ok('Radar 0.68 : « À venir » range les échéances par plan (« Échéance 2 sur 4 »)', e.avenir.some((v) => v.type === 'echeance' && v.plan === pB.id && v.date === '2026-12-03' && /Échéance 2 sur 4/.test(v.note)), JSON.stringify(e.avenir.filter((v) => v.type === 'echeance').slice(0, 3)));
    /* « Plus de facture » : une seule alerte, après la lecture (avant : une par mois relu et par dépense, toutes fausses) */
    const sil = e.alertes.filter((a) => a.type === 'silence');
    ok('Radar 0.68 : « Plus de facture » : une seule alerte pour le club (plus de facture depuis septembre), aucune pour ce qui est facturé chaque mois', sil.length === 1 && sil[0].fixe === 'fclub' && sil[0].dernier === '2026-09-10', JSON.stringify(e.alertes.map((a) => [a.type, a.service, a.dernier])));
    const ech = e.alertes.filter((a) => a.type === 'echec');
    ok('Radar 0.68 : trois mails pour le même paiement échoué font une seule alerte, la plus récente, « 3 mails »', ech.length === 1 && ech[0].n === 3 && ech[0].date === '2026-11-18', JSON.stringify(ech));
    /* « Vu » gardé sur le serveur, et « Remettre » */
    let r = await R68.traiter('POST', '/api/radar/alerte', async () => ({id: ech[0].id, action: 'vu'}));
    const vuOk = r.status === 200 && !!r.body.alertes.find((a) => a.id === ech[0].id).vu;
    r = await R68.traiter('POST', '/api/radar/alerte', async () => ({id: ech[0].id, action: 'revoir'}));
    ok('Radar 0.68 : « Vu » est gardé sur le serveur (plus seulement dans un iPhone) ; « Remettre » le défait', vuOk && !r.body.alertes.find((a) => a.id === ech[0].id).vu);
    await R68.traiter('POST', '/api/radar/alerte', async () => ({id: ech[0].id, action: 'vu'}));
    /* « Retirer » par erreur, puis « Annuler » : la dépense revient, elle n'est plus écartée */
    r = await R68.traiter('POST', '/api/radar/alerte', async () => ({id: sil[0].id, action: 'retirer'}));
    const apres = r.body, ecOk = apres.ecartees.some((x) => x.cle === 'club-exemple.fr' && x.service === 'Club Exemple') && apres.traitees.some((x) => x.id === sil[0].id && x.action === 'retirer') && !apres.fixes.some((f) => f.id === 'fclub');
    r = await R68.traiter('POST', '/api/radar/alerte', async () => ({id: sil[0].id, action: 'annuler'}));
    ok('Radar 0.68 : « Retirer » est noté (« Écartées », réponse gardée) ; « Annuler » remet la dépense, la retire des écartées et l’alerte revient', ecOk && r.status === 200 && r.body.fixes.some((f) => f.id === 'fclub' && f.montant === 29.9) && !r.body.ecartees.length && !r.body.traitees.length && r.body.alertes.some((a) => a.id === sil[0].id), JSON.stringify(apres.ecartees));
    /* « Pas une dépense fixe » par erreur, puis « Reproposer » */
    const eau = r.body.propositions.find((p) => p.service === 'Eau Exemple');
    r = await R68.traiter('POST', '/api/radar/proposition', async () => ({id: eau.id, oui: false}));
    const ecarteeEau = r.body.ecartees.find((x) => x.service === 'Eau Exemple');
    r = await R68.traiter('POST', '/api/radar/reproposer', async () => ({cle: ecarteeEau.cle}));
    ok('Radar 0.68 : une dépense écartée garde son nom et revient dans « À valider » avec « Reproposer »', !!ecarteeEau && r.status === 200 && r.body.revenue === true && r.body.propositions.some((p) => p.service === 'Eau Exemple') && !r.body.ecartees.length);
    /* un plan « plus à payer » (achat annulé, remboursé) et « Remettre » */
    r = await R68.traiter('POST', '/api/radar/plan', async () => ({id: p10.id, action: 'retirer'}));
    const sans10 = r.body.ponctuels.length, retireOk = r.body.plans.find((p) => p.id === p10.id).retire;
    r = await R68.traiter('POST', '/api/radar/plan', async () => ({id: p10.id, action: 'remettre'}));
    ok('Radar 0.68 : « Plus à payer » sort les échéances d’un plan du reste à payer ; « Remettre » les rend', retireOk && sans10 === r.body.ponctuels.length - 10 && !r.body.plans.find((p) => p.id === p10.id).retire, sans10 + ' / ' + r.body.ponctuels.length);
    /* un rappel qui décale une échéance : la date change, rien n'est compté deux fois */
    F.rb2 = th('rb2', 'service@paypal.fr', 'PayPal', 'L\'échéance de votre Paiement en 4X approche', '| Votre prochaine échéance de 20,00 € EUR sera due le 5 décembre 2026. |\n| Marchand |\n| BOUTIQUE EXEMPLE |' + lien(PID), '2026-11-28T08:00:00Z');
    gmail68.chercher = async (q) => (/newer_than:3d/.test(q) && /subject:/.test(q) ? {threads: [{id: 'rb2'}]} : {threads: []});
    maintenant68 = Date.parse('2026-11-28T09:00:00Z'); await R68.traiter('POST', '/api/radar/lire', async () => ({tout: false})); await R68.attendre();
    e = R68.etat(); const pB2 = e.plans.find((p) => p.id === pB.id);
    ok('Radar 0.68 : un rappel qui décale une échéance (3 → 5 décembre) la déplace, sans la compter deux fois', pB2.prochaine.date === '2026-12-05' && e.ponctuels.filter((x) => x.plan === pB.id).length === 3 && !e.ponctuels.some((x) => x.plan === pB.id && x.date === '2026-12-03'), JSON.stringify(pB2.echeances));
    /* « Tout relire » : relit ses mois avec les règles du jour, montre ce qu'il voyait pendant ce temps, garde ses réponses ; Claude ne relit pas les mêmes mails */
    gmail68.chercher = async (q) => { if (porte) await porte.p; const m = q.match(/after:(\d{4})\/(\d{2})/); if (!m) return {threads: []}; return {threads: Object.values(F).filter((t) => t.id !== 'rb2' && t.messages[0].date.startsWith(m[1] + '-' + m[2])).map((t) => ({id: t.id}))}; };
    maintenant68 = Date.parse('2026-11-23T09:00:00Z');
    const nAlertes = R68.etat().alertes.length, nC = appelsC.length; let ouvrir; porte = {p: new Promise((z) => { ouvrir = z; })};
    r = await R68.traiter('POST', '/api/radar/lire', async () => ({}));
    const pendant = R68.etat();
    ok('Radar 0.68 : « Tout relire » démarre aussitôt (202), lecture complète en cours ; ce qu’il voyait reste affiché pendant ce temps', r.status === 202 && pendant.scan.enCours && pendant.scan.complet && pendant.relecture && pendant.alertes.length === nAlertes && pendant.plans.length === 4, JSON.stringify(pendant.scan));
    const debut0 = R68.brut().scan.debut, deux = await R68.traiter('POST', '/api/radar/lire', async () => ({}));
    ok('Radar 0.68 : un second appui pendant la lecture ne la relance pas (la même lecture continue)', deux.status === 202 && R68.brut().scan.enCours && R68.brut().scan.debut === debut0);
    porte = null; ouvrir(); await R68.attendre();
    e = R68.etat();
    ok('Radar 0.68 : relu jusqu’au bout : la nouvelle lecture remplace l’ancienne, un bilan est donné ; ses dépenses, sa paie, ses refus et son « Vu » restent ; Claude ne relit pas les mêmes mails',
      !e.relecture && !R68.brut().avant && e.scan.fini && e.scan.bilan && e.scan.bilan.plans === 4 && e.fixes.some((f) => f.id === 'fclub') && e.revenus.jour === 5 && !!e.alertes.find((a) => a.type === 'echec').vu && nC >= 1 && appelsC.length === nC, JSON.stringify([e.scan.bilan, nC, appelsC.length - nC]));
    /* le même paiement échoué, deux mails le même matin : une seule notification */
    const pushs = []; F.ex1 = th('ex1', 'billing@jeu-exemple.com', 'Jeu Exemple', 'Payment declined', 'Your payment of €4.99 was declined. Update your payment method.', '2026-11-29T05:00:00Z'); F.ex2 = th('ex2', 'billing@jeu-exemple.com', 'Jeu Exemple', 'Payment failed', 'We could not process your payment of €4.99.', '2026-11-29T05:30:00Z');
    const Rn = createRadar({file: path.join(DIR, 'radar68n.json'), gmail: {lie: () => true, chercher: async (q) => (/newer_than:3d/.test(q) && /subject:/.test(q) ? {threads: [{id: 'ex1'}, {id: 'ex2'}]} : {threads: []}), fil: async (id) => F[id]}, push: async (m) => { pushs.push(m); return []; }, now: () => Date.parse('2026-11-29T06:00:00Z')});
    Rn.brut().scan = {fini: 1}; await Rn.lireMaintenant();
    ok('Radar 0.68 : deux mails le même matin pour le même paiement échoué : une alerte, une seule notification', pushs.filter((m) => /Paiement échoué/.test(m.title)).length === 1 && Rn.etat().alertes.filter((a) => a.type === 'echec').length === 1, JSON.stringify(pushs.map((m) => m.title))); }
  /* 0.68.0 : une lecture qui ne répond plus ne bloque plus rien ; une version d'avant (6) est relue sans perdre ce qu'il voyait */
  { const lents = [], F2 = {ok1: {id: 'ok1', messages: [{id: 'mo1', threadId: 'ok1', sender: 'factures@eau-exemple.fr', addressDisplayNames: [{displayName: 'Eau Exemple'}], subject: 'Votre facture', plaintextBody: 'Montant TTC : 21,30 €.', date: '2026-11-02T08:00:00Z'}]}};
    const Rb = createRadar({file: path.join(DIR, 'radar68b.json'), gmail: {lie: () => true, chercher: async (q) => (/after:2026\/11/.test(q) && /subject:/.test(q) ? {threads: [{id: 'bloque'}, {id: 'ok1'}]} : {threads: []}), fil: (id) => (id === 'bloque' ? (lents.push(id), new Promise(() => {})) : Promise.resolve(F2[id]))},
      now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 1, delaiGmail: 40});
    await Rb.lireMaintenant();
    ok('Radar 0.68 : un fil que Gmail ne rend jamais est abandonné au bout du délai (90 s en service) : la lecture continue et finit', lents.length === 1 && !!Rb.etat().scan.fini && !Rb.etat().scan.erreur && Rb.brut().releves.length === 1, JSON.stringify(Rb.etat().scan));
    let horloge = Date.parse('2026-11-23T09:00:00Z'), bloquer = true; const qs = [];
    const Rf = createRadar({file: path.join(DIR, 'radar68f.json'), gmail: {lie: () => true, chercher: (q) => { qs.push(q); return bloquer ? new Promise(() => {}) : Promise.resolve({threads: []}); }, fil: async () => ({messages: []})},
      now: () => horloge, moisDepart: 2, delaiGmail: 3600e3, bloquee: 15 * 60e3});
    Rf.traiter('GET', '/api/radar', null); await new Promise((z) => setTimeout(z, 20));
    const avantFig = Rf.etat().scan.enCours; horloge += 20 * 60e3; bloquer = false;
    const rf = await Rf.traiter('POST', '/api/radar/lire', async () => ({})); await Rf.attendre();
    ok('Radar 0.68 : une lecture figée (rien de Gmail depuis 20 min) est abandonnée et « Relire » en lance une nouvelle, qui finit (avant : le bouton renvoyait la lecture bloquée)', avantFig && rf.status === 202 && !!Rf.etat().scan.fini && !Rf.etat().scan.erreur && qs.length > 1, JSON.stringify([Rf.etat().scan, qs.length]));
    /* version 6 (0.66.0/0.67.0) : relue avec les règles de 0.68.0 ; ce qu'il voyait reste affiché, sans les « Plus de facture » répétées (fausses) */
    const f6 = path.join(DIR, 'radar68v6.json'), sil6 = [1, 2, 3].map((i) => ({id: 'zf1202608' + i, date: '2026-11-22', type: 'silence', titre: 'Plus de facture', service: 'Club Exemple', fixe: 'f1', dernier: '2026-0' + (5 + i) + '-10'}));
    fs.writeFileSync(f6, JSON.stringify({version: 6, fixes: [{id: 'f1', service: 'Club Exemple', montant: 29.9, jour: 10, rythme: 'mensuel', source: 'mail', cle: 'club-exemple.fr'}], scan: {fini: 1, mois: 13, total: 13},
      alertes: sil6.concat([{id: 'ax', date: '2026-11-20', type: 'echec', titre: 'Paiement échoué', service: 'Video Exemple'}]), propositions: [{id: 'pz', service: 'Eau Exemple', montant: 21.3, jour: 6, rythme: 'mensuel', cle: 'eau-exemple.fr'}], ponctuels: [{id: 'e1', date: '2026-12-03', service: 'Paiement en 4 fois : BOUTIQUE EXEMPLE', montant: 20}]}));
    let ouvre6; const porte6 = new Promise((z) => { ouvre6 = z; });
    const R6b = createRadar({file: f6, gmail: {lie: () => true, chercher: async () => { await porte6; return {threads: []}; }, fil: async () => ({messages: []})}, now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 2});
    const v0 = R6b.etat();
    R6b.traiter('GET', '/api/radar', null); await new Promise((z) => setTimeout(z, 10)); const v1 = R6b.etat(); ouvre6(); await R6b.attendre(); const v2 = R6b.etat();
    ok('Radar 0.68 : une lecture de 0.66/0.67 est refaite avec les nouvelles règles ; pendant ce temps, ses propositions et ses échéances restent affichées, sans les 3 « Plus de facture » fausses', R6b.brut().version === 7 && v0.relecture && v0.propositions.length === 1 && v0.ponctuels.length === 1
      && v0.alertes.length === 1 && v0.alertes[0].type === 'echec' && v1.scan.enCours && v1.scan.complet && !v2.relecture && v2.scan.fini && v2.fixes.length === 1, JSON.stringify([v0.alertes, v1.scan, v2.scan])); }
  /* 0.77.0 : le rappel de PayPal redonne « votre prochain échéancier » (les échéances restantes) : ce n'est pas un autre achat. Montants inventés. */
  { const fil = (id, objet, texte, date) => ({id, messages: [{id: 'm' + id, threadId: id, sender: 'service@paypal.fr', addressDisplayNames: [{displayName: 'PayPal', emailAddress: 'service@paypal.fr'}], subject: objet, plaintextBody: texte, date, labelIds: []}]});
    const rappel = (id, prochaine, solde, suite, date) => fil(id, "L'échéance de votre Paiement en 4X approche", '| Votre prochaine échéance de 25,00 € EUR sera due le ' + prochaine + '. Nous débiterons automatiquement votre carte. |\n| Montant du paiement |\n| 25,00 € EUR |\n| Date d\'échéance |\n| ' + prochaine + ' |\n| Marchand |\n| ATELIER EXEMPLE |\n| Solde actuel |\n| ' + solde + ' € EUR |\n' + (suite ? '| Pour rappel, voici votre prochain échéancier de paiement. |\n| ' + suite + ' |\n' : '') + '| Ces montants n\'incluent pas les paiements manqués. |', date);
    const plan = fil('pa', 'Votre Paiement en 4X est prêt', "| Votre achat de 100,00 € EUR auprès de ATELIER EXEMPLE a été divisé en 4 échéances. |\n| * 25,00 € EUR dus aujourd'hui * 25,00 € EUR le 26 août 2026 * 25,00 € EUR le 25 septembre 2026 * 25,00 € EUR le 24 octobre 2026 |", '2026-07-27T09:05:00Z');
    const r1 = rappel('ra', '26 août 2026', '75,00', '* 25,00 € EUR le 25 septembre 2026 * 25,00 € EUR le 24 octobre 2026', '2026-08-22T23:34:00Z'), r2 = rappel('rb', '25 septembre 2026', '50,00', '* 25,00 € EUR le 24 octobre 2026', '2026-09-21T23:30:00Z'), r3 = rappel('rc', '24 octobre 2026', '25,00', '', '2026-10-20T23:30:00Z');
    const boite = (liste) => { const F = Object.fromEntries(liste.map((t) => [t.id, t])); return {lie: () => true, chercher: async (q) => { const m = q.match(/after:(\d{4})\/(\d{2})/); return {threads: m ? Object.values(F).filter((t) => t.messages[0].date.startsWith(m[1] + '-' + m[2])).map((t) => ({id: t.id})) : []}; }, fil: async (id) => F[id]}; };
    const muet = async () => ({ok: true, text: '[]'});
    const f1 = path.join(DIR, 'radar77a.json'), Ra = createRadar({file: f1, gmail: boite([plan, r1, r2, r3]), claude: muet, now: () => Date.parse('2026-11-24T09:00:00Z'), moisDepart: 5});
    await Ra.traiter('GET', '/api/radar', null); await Ra.attendre();
    const pa = Ra.etat().plans.filter((p) => p.service === 'ATELIER EXEMPLE');
    ok('Radar 0.77 : un achat en 4 fois et ses trois rappels (qui redonnent les 3, puis 2 échéances restantes) font UN plan de 100 €, 4 échéances, pas trois achats de 100, 75 et 50 €',
      pa.length === 1 && pa[0].total === 100 && pa[0].echeances.length === 4 && pa[0].fois === 4, JSON.stringify(pa.map((p) => [p.total, p.echeances.length])));
    /* les rappels lus avant le plan (le plan arrive en dernier) : même résultat */
    const f2 = path.join(DIR, 'radar77b.json'), tard = {...plan, messages: [{...plan.messages[0], date: '2026-11-20T09:05:00Z', plaintextBody: plan.messages[0].plaintextBody.replace("dus aujourd'hui", 'le 27 juillet 2026')}]};
    const Rb = createRadar({file: f2, gmail: boite([r1, r2, tard]), claude: muet, now: () => Date.parse('2026-11-24T09:00:00Z'), moisDepart: 5});
    await Rb.traiter('GET', '/api/radar', null); await Rb.attendre();
    const pb = Rb.etat().plans.filter((p) => p.service === 'ATELIER EXEMPLE');
    ok('Radar 0.77 : les rappels lus avant le mail du plan le rejoignent quand il arrive (un seul plan de 4 échéances)', pb.length === 1 && pb[0].echeances.length === 4 && pb[0].total === 100, JSON.stringify(pb.map((p) => [p.total, p.echeances.length, p.partiel])));
    /* les doublons déjà enregistrés par une version d'avant s'en vont au démarrage ; deux vrais achats chez le même marchand restent deux */
    const e4 = [['2026-07-27', true], ['2026-08-26', true], ['2026-09-25', true], ['2026-10-24', true]].map(([date, payee]) => ({date, montant: 25, payee})), p0 = {cle: 'paypal:atelier exemple', dom: 'paypal.fr', service: 'ATELIER EXEMPLE', via: 'PayPal', fil: '', objet: '', fois: 4, date: '2026-07-27', maj: '2026-10-24'};
    const f3 = path.join(DIR, 'radar77c.json');
    fs.writeFileSync(f3, JSON.stringify({version: 7, scan: {fini: true}, plans: {plA: {...p0, id: 'plA', total: 100, echeances: e4}, plB: {...p0, id: 'plB', total: 75, echeances: e4.slice(1).map((e) => ({...e, payee: false}))}, plC: {...p0, id: 'plC', total: 50, echeances: e4.slice(2).map((e) => ({date: e.date, montant: 25}))},
      plD: {...p0, id: 'plD', total: 180, echeances: [['2026-08-02'], ['2026-09-02'], ['2026-10-02'], ['2026-11-02']].map(([date]) => ({date, montant: 45}))}}}));
    const Rc = createRadar({file: f3, gmail: boite([]), claude: muet, now: () => Date.parse('2026-11-24T09:00:00Z'), moisDepart: 1});
    const brut = JSON.parse(fs.readFileSync(f3, 'utf8')).plans;
    ok('Radar 0.77 : au démarrage, trois plans enregistrés pour un seul achat (100, 75 et 50 €) n\'en font plus qu\'un, ses échéances payées gardées ; un autre achat chez le même marchand (4 × 45 €) reste',
      Object.keys(brut).sort().join() === 'plA,plD' && brut.plA.echeances.length === 4 && brut.plA.echeances.every((e) => e.payee) && Rc.etat().plans.filter((p) => p.service === 'ATELIER EXEMPLE').length === 2, JSON.stringify(Object.keys(brut)));
  }
  /* 0.80.0 : les dépenses courantes (montants inventés) : ce qui reste à dépenser selon la façon de compter */
  { const D = (j, m = 10) => J(2026, m, j), fin = J(2026, 10, 30), de = (c, a, b = fin) => courantes([c], a, b)[0];
    const env = {service: 'Courses', mode: 'enveloppe', montant: 400}, r = [1, 7, 8, 14, 15, 16, 21, 22, 30].map((j) => de(env, D(j)).montant);
    ok('Radar 0.80 : un budget de 400 € par mois, un quart par semaine : tout le 1er et le 7, les trois quarts du 8 au 14, la moitié du 15 au 21 (« il reste deux semaines »), un quart du 22 à la fin',
      r.join() === '400,400,300,300,200,200,200,100,100', r.join());
    const p1 = de(env, D(16), D(28)).montant, p2 = de(env, D(25), J(2026, 11, 5)).montant, p3 = de({...env, montant: 100.03}, D(1)).montant;
    ok('Radar 0.80 : jusqu\'à une paie le 28 : la moitié (la dernière semaine a commencé avant) ; du 25 novembre au 5 décembre : le dernier quart et le premier du mois suivant ; les centimes ne se perdent pas',
      p1 === 200 && p2 === 200 && p3 === 100.03, [p1, p2, p3].join());
    const men = {service: 'Ménage', mode: 'semaine', montant: 50, jour: 4}, s1 = de(men, D(1)), s2 = de(men, D(20)), s3 = de(men, D(27));
    ok('Radar 0.80 : 50 € chaque jeudi : 4 passages du 1er au 30 novembre 2026, 1 seul à partir du 20 (le 26), plus aucun le 27', s1.n === 4 && s1.montant === 200 && s2.n === 1 && s2.montant === 50 && s3.n === 0 && s3.montant === 0, JSON.stringify([s1.n, s2.n, s3.n]));
    const coif = {service: 'Coiffeur', mode: 'mois', montant: 30, jour: 12}, bou = {service: 'Boucherie', mode: 'mois', montant: 120, faits: []};
    const m = [de(coif, D(10)).montant, de(coif, D(13)).montant, de(coif, D(13), J(2026, 11, 15)).montant, de(bou, D(29)).montant, de({...bou, faits: ['2026-11']}, D(3)).montant, de(bou, D(29), J(2026, 11, 5)).montant];
    ok('Radar 0.80 : une fois par mois : avec un jour, elle compte jusqu\'à ce jour (puis au mois suivant si la période y va) ; sans jour, elle compte ce mois-ci jusqu\'au bout, plus du tout une fois dite faite, et pas pour le mois d\'après',
      m.join() === '30,0,30,120,0,120', m.join());
    const fc = path.join(DIR, 'radar80.json'), Rc = createRadar({file: fc, gmail: {lie: () => true, chercher: async () => ({threads: []}), fil: async () => ({messages: []})}, claude: async () => ({ok: true, text: '[]'}), now: () => Date.parse('2026-11-16T09:00:00Z'), moisDepart: 1});
    const set = (valeur) => Rc.traiter('POST', '/api/radar/set', async () => ({cle: 'courantes', valeur}));
    const bon = await set([{service: 'Courses', type: 'courses', mode: 'enveloppe', montant: '400'}, {service: 'Ménage', type: 'menage', mode: 'semaine', montant: 50, jour: 4}, {service: 'Boucherie', type: 'boucherie', mode: 'mois', montant: 120, faits: ['2026-11', 'n\'importe quoi']}]);
    const mauvais = [await set([{service: '', mode: 'enveloppe', montant: 10}]), await set([{service: 'X', mode: 'autre', montant: 10}]), await set([{service: 'X', mode: 'semaine', montant: 10}]), await set([{service: 'X', mode: 'mois', montant: 0}]), await set('rien')].map((x) => x.status);
    const lu = JSON.parse(fs.readFileSync(fc, 'utf8')).courantes;
    ok('Radar 0.80 : la liste s\'enregistre (identifiant donné, jour et « fait ce mois-ci » nettoyés), une ligne incomplète est refusée sans rien changer (nom vide, façon inconnue, jour manquant, montant nul)',
      bon.status === 200 && bon.body.courantes.length === 3 && bon.body.courantes.every((c) => /^dc/.test(c.id)) && bon.body.courantes[2].faits.join() === '2026-11' && mauvais.join() === '400,400,400,400,400' && lu.length === 3 && lu[1].jour === 4, JSON.stringify([bon.status, mauvais]));
  }
  /* la mémoire de JARVIS (lue par le serveur MCP, que Grok Bot peut joindre) refuse les chiffres d'un crédit */
  ok('Mémoire : refuse les chiffres d’un crédit (règle du 12/11/2026), garde le reste', interdit('Ma mensualité de crédit immobilier est de 1150 €') && interdit('Il reste 180 000 € à rembourser sur le prêt immobilier') && !interdit("J'ai un crédit immobilier à la banque") && !interdit('Je suis prêt à 8h'));
} catch (e) { ok('exception', false, e.stack); }
fs.rmSync(DIR, {recursive: true, force: true});
console.log(results.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + results.length + ' vérifications).');
process.exit(fails ? 1 : 0);
