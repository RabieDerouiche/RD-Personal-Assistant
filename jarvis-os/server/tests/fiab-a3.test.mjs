/* Banc 0.70.0 — A3-radar (fiabilité du Radar) : node tests/fiab-a3.test.mjs (aucun vrai Google, aucun vrai Claude, aucun coût).
   Mails, services et montants inventés. */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import zlib from 'node:zlib';
import {J, ymd, occurrences, resteA, lireMail, montantClaude, montantDe, createRadar} from '../radar.mjs';
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-a3-'));
const pause = (ms) => new Promise((z) => setTimeout(z, ms));
const jusqua = async (cond) => { for (let i = 0; i < 600 && !cond(); i++) await pause(5); };   /* attend un état, sans dépendre de la vitesse de la machine */
const M = (id, from, nom, objet, texte, date, extra) => ({id, threadId: 't' + id, sender: from, addressDisplayNames: [{displayName: nom, emailAddress: from}], subject: objet, plaintextBody: texte, date, labelIds: ['INBOX'], ...(extra || {})});
const T = (...msgs) => ({id: msgs[0].threadId, messages: msgs});
/* un faux Gmail : chaque fil a son historyId ; `choisir(q)` dit quels fils une recherche renvoie */
const fauxGmail = (F, choisir, plus) => ({lie: () => true, chercher: async (q) => ({threads: choisir(q).filter((k) => F[k]).map((k) => ({id: k, historyId: 'h' + k}))}), fil: async (id) => F[id], ...(plus || {})});
const SUJET = (q) => /^subject:/.test(q), MOIS = (q, ym) => new RegExp('after:' + ym.replace('-', '/') + '/01 ').test(q);
try {
  /* ---------- radar#1 : une lecture coupée ne perd plus les mails déjà listés ---------- */
  { const F = {ta1: T(M('ma1', 'facturation@eau-exemple.fr', 'Eau Exemple', 'Votre facture', 'Montant TTC : 21,30 €. Il sera prélevé le 06/10/2026.', '2026-10-02T08:00:00Z')),
      ta2: T(M('ma2', 'facturation@gaz-exemple.fr', 'Gaz Exemple', 'Votre facture', 'Montant TTC : 33,10 €. Il sera prélevé le 08/10/2026.', '2026-10-03T08:00:00Z'))};
    let panne = 6, maintenant = Date.parse('2026-11-23T09:00:00Z');
    const gmail = fauxGmail(F, (q) => (SUJET(q) && MOIS(q, '2026-10') ? ['ta1', 'ta2'] : []));
    const fil0 = gmail.fil; gmail.fil = async (id) => { if (id === 'ta2' && panne-- > 0) throw new Error('Quota exceeded for quota metric Units per minute per user'); return fil0(id); };
    const RD = createRadar({file: path.join(DIR, 'r1.json'), gmail, now: () => maintenant, moisDepart: 2, attente: async () => {}, pauseQuota: 1});
    await RD.traiter('GET', '/api/radar', null); await RD.attendre();
    const coupe = {erreur: RD.brut().scan.erreur, fils: Object.keys(RD.brut().fils), vus: RD.brut().vus.slice(), releves: RD.brut().releves.length};
    maintenant += 11 * 60e3;   /* il rouvre le Radar 11 minutes plus tard */
    await RD.traiter('GET', '/api/radar', null); await RD.attendre();
    const ids = RD.brut().releves.map((r) => r.id).sort().join();
    ok('A3 radar#1 : une limite de Google qui dure coupe la lecture sans marquer « déjà lu » le fil lu juste avant', /Google a limité/.test(coupe.erreur) && !coupe.fils.includes('ta1') && !coupe.vus.includes('ma1') && coupe.releves === 0, JSON.stringify(coupe));
    ok('A3 radar#1 : à la reprise, les deux factures du mois coupé sont comptées (avant : celle du fil lu avant la panne était perdue pour de bon)', !!RD.brut().scan.fini && ids === 'ma1,ma2', ids); }
  { const F = {tb1: T(M('mb1', 'noreply@obscur-exemple.fr', 'Obscur', 'Votre facture', 'Bonjour, votre facture est disponible dans votre espace client.', '2026-10-02T08:00:00Z'))};
    let maintenant = Date.parse('2026-11-23T09:00:00Z'), libere = null, nClaude = 0;
    const claude = (prompt) => { nClaude++; const ids = [...prompt.matchAll(/\[mail (\w+)\]/g)].map((x) => x[1]); const rep = {ok: true, text: JSON.stringify(ids.map((id) => ({id, genre: 'facture', service: 'Obscur', montant: 24.5})))};
      return nClaude === 1 ? new Promise((z) => { libere = () => z(rep); }) : Promise.resolve(rep); };
    const RD = createRadar({file: path.join(DIR, 'r2.json'), gmail: fauxGmail(F, (q) => (SUJET(q) && MOIS(q, '2026-10') ? ['tb1'] : [])), claude, now: () => maintenant, moisDepart: 2});
    RD.traiter('GET', '/api/radar', null); await jusqua(() => !!libere);   /* la lecture attend Claude, très lent */
    maintenant += 16 * 60e3;   /* 16 minutes sans réponse de Gmail : la lecture est figée, la page en relance une */
    await RD.traiter('GET', '/api/radar', null); await jusqua(() => nClaude >= 2);
    if (libere) libere(); await pause(20); await RD.attendre();
    const l = RD.brut().releves.filter((r) => r.id === 'mb1');
    ok('A3 radar#1 : une lecture figée remplacée pendant que Claude lit : la nouvelle relit le mail et le compte, une seule fois (avant : perdu)', !!RD.brut().scan.fini && nClaude === 2 && l.length === 1 && l[0].montant === 24.5, JSON.stringify([nClaude, RD.brut().releves])); }
  { const F = {tc1: T(M('mc1', 'facturation@eau-exemple.fr', 'Eau Exemple', 'Votre facture', 'Montant TTC : 21,30 €. Il sera prélevé le 06/11/2026.', '2026-11-02T08:00:00Z'))}, lus = [];
    const gmail = fauxGmail(F, (q) => (MOIS(q, '2026-11') ? ['tc1'] : [])); const fil0 = gmail.fil; gmail.fil = async (id) => { lus.push(id); return fil0(id); };
    const RD = createRadar({file: path.join(DIR, 'r3.json'), gmail, now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 1});
    await RD.traiter('GET', '/api/radar', null); await RD.attendre();
    ok('A3 radar#1 : un fil renvoyé par les deux recherches du mois (objet, phrases de prélèvement) n’est lu et compté qu’une fois', lus.length === 1 && RD.brut().releves.length === 1 && RD.brut().fils.tc1 === 'htc1', JSON.stringify([lus, RD.brut().releves.length])); }

  /* ---------- radar#2 : la facture du mois ne remplace qu'un prélèvement ---------- */
  { const box = {service: 'Box Exemple', jour: 31, montant: 40, rythme: 'mensuel', prochain: {date: '2026-11-02', montant: 52}};
    const vu = (f, a, b) => occurrences(f, a, b).map((o) => ymd(o.le) + ' ' + o.f.montant).join(' | ');
    const nov = vu(box, J(2026, 10, 1), J(2026, 10, 30)), r = resteA([box], {jour: 28, avance: true}, J(2026, 10, 10), 'mois');
    ok('A3 radar#2 : le 31 octobre (samedi) reporté au lundi 2 novembre, facture « 52 € le 02/11 » : novembre compte 52 € le 2 et 40 € le 30 (avant : 52 € deux fois le 2)', nov === '2026-11-02 52 | 2026-11-30 40', nov);
    ok('A3 radar#2 : vu du 10 novembre, le reste à payer du mois compte encore le prélèvement du 30 (40 €)', r.total === 40 && r.liste.length === 1 && ymd(r.liste[0].le) === '2026-11-30', JSON.stringify([r.total, r.liste.map((o) => ymd(o.le))]));
    const nov30 = vu({...box, prochain: {date: '2026-11-30', montant: 45}}, J(2026, 10, 1), J(2026, 10, 30));
    ok('A3 radar#2 : la facture « 45 € le 30/11 » remplace celle du 30, pas celle du 2', nov30 === '2026-11-02 40 | 2026-11-30 45', nov30); }

  /* ---------- radar#3 : le montant rendu par Claude ---------- */
  { const cas = [['49,90 €', 49.9], ['49,90€', 49.9], ['49.90 €', 49.9], [49.9, 49.9], ['1 234,56 €', 1234.56], ['€1,234.56', 1234.56], ['12,5 EUR', 12.5], [12000, 12000], ['12000', 12000], ['environ 30 €', 30], [null, null], [0, null], ['', null], ['-12,00 €', null], [25000, null]];
    const faux = cas.filter(([v, att]) => montantClaude(v) !== att);
    ok('A3 radar#3 : un montant de Claude écrit « 49,90 € », « 1 234,56 € », « 12,5 EUR » ou 12000 est lu tel quel (avant : 4 990 €, 125 €, 120 €)', !faux.length && montantDe('15359') === 153.59, JSON.stringify(faux.map(([v]) => [v, montantClaude(v)])));
    const F = {}, rep = {mx1: '49,90 €', mx2: 49.9, mx3: 12000};
    ['1', '2', '3'].forEach((n) => { F['tmx' + n] = T(M('mx' + n, 'noreply@obscur' + n + '-exemple.fr', 'Obscur ' + n, 'Votre facture', 'Votre facture est disponible dans votre espace client.', '2026-11-0' + n + 'T08:00:00Z')); });
    const claude = async (prompt) => ({ok: true, text: JSON.stringify([...prompt.matchAll(/\[mail (\w+)\]/g)].map((x) => ({id: x[1], genre: 'facture', service: 'Obscur', montant: rep[x[1]], date_prelevement: null})))});
    const RD = createRadar({file: path.join(DIR, 'r4.json'), gmail: fauxGmail(F, (q) => (SUJET(q) && MOIS(q, '2026-11') ? Object.keys(F) : [])), claude, now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 1});
    await RD.traiter('GET', '/api/radar', null); await RD.attendre();
    const mt = ['mx1', 'mx2', 'mx3'].map((id) => (RD.brut().releves.find((r) => r.id === id) || {}).montant);
    ok('A3 radar#3 (serveur) : Claude répond « 49,90 € », 49.9 et 12000 : relevés de 49,90 €, 49,90 € et 12 000 €', mt.join() === '49.9,49.9,12000', mt.join()); }

  /* ---------- radar#4 : alertes « Montants de ton contrat » et « Résiliation » sur une dépense qui a une fin ---------- */
  { const pdfMain = (lignes) => {   /* même construction que le banc du Radar (police Courier, une lettre à la fois) */
      let c = 'BT /F1 12 Tf ET\n', y = 700;
      for (const [f, z, tx] of lignes) { c += 'BT /' + f + ' ' + z + ' Tf ET\nBT 60 ' + y + ' Td '; for (const ch of tx) c += '(' + (ch === '(' || ch === ')' || ch === '\\' ? '\\' + ch : ch) + ")' " + (600 * z / 1000).toFixed(2) + ' 0 Td '; c += 'ET\n'; y -= 20; }
      const flux = zlib.deflateSync(Buffer.from(c, 'latin1')), o = ['1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj', '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj', '3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj'];
      const debut = '%PDF-1.4\n' + o.join('\n') + '\n4 0 obj << /Length ' + flux.length + ' /Filter /FlateDecode >>\nstream\n';
      const fin = '\nendstream\nendobj\n5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n';
      return Buffer.concat([Buffer.from(debut, 'latin1'), flux, Buffer.from(fin, 'latin1')]);
    };
    /* un contrat d'assurance de prêt : 24 mois de cotisations, 3 paliers, de janvier 2026 à décembre 2027 */
    const lignes = []; for (let i = 0; i < 24; i++) { const y = 2026 + Math.floor(i / 12), m = (i % 12) + 1; lignes.push([y + '-' + String(m).padStart(2, '0'), i < 12 ? 31.2 : i < 18 ? 30.9 : 29.5]); }
    const l = [['F1', 9, 'Certificat d\'adh\xe9sion - Assurance de pr\xeat'], ['F1', 9, 'Cotisation qui sera pr\xe9lev\xe9e le 05/01/2026'], ['F1', 9, 'Nom du cr\xe9ancier : EXEMPLE ASSUR']];
    for (const [k, v] of lignes) l.push(['F1', 9, '02/' + k.slice(5) + '/' + k.slice(0, 4) + ' 01/' + String(+k.slice(5) % 12 + 1).padStart(2, '0') + '/' + (+k.slice(5) === 12 ? +k.slice(0, 4) + 1 : k.slice(0, 4)) + ' ' + k.slice(5) + '/' + k.slice(0, 4) + ' ' + String(v.toFixed(2)).replace('.', ',') + ' \x80']);
    const data = pdfMain(l).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    const F = {tct: T(M('mct', 'gestion@courtier-exemple.fr', '', 'Votre contrat d\'assurance de prêt', 'Vous trouverez ci-joint votre certificat d\'adhésion.', '2025-12-15T09:00:00Z', {attachments: [{filename: 'Certificat d\'adhésion.pdf', mimeType: 'application/pdf', data}]}))};
    const res = M('mrs', 'gestion@courtier-exemple.fr', '', 'Confirmation de résiliation', 'Nous avons bien pris en compte votre demande de résiliation. Votre contrat prendra fin le 15/12/2026.', '2026-11-20T09:00:00Z');
    const gmail = fauxGmail(F, (q) => (/^has:attachment/.test(q) ? ['tct'] : SUJET(q) && (/newer_than:3d/.test(q) || MOIS(q, '2026-11')) ? ['trs'] : []));
    const RD = createRadar({file: path.join(DIR, 'r5.json'), gmail, now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 1});
    /* son assurance de prêt saisie à la main, avec la fin de son prêt (2045) */
    RD.regler('fixes', [{id: 'fas', service: 'Assurance de prêt', cat: 'Assurances', montant: 31.2, jour: 5, rythme: 'mensuel', fin: '2045-05-05', cle: 'courtier-exemple.fr', dom: 'courtier-exemple.fr'}]);
    await RD.traiter('GET', '/api/radar', null); await RD.attendre();
    const al = RD.etat().alertes.find((a) => a.type === 'calendrier');
    ok('A3 radar#4 : le tableau de son contrat donne l’alerte « Montants de ton contrat » sur sa dépense qui finit en 2045, et elle reste (avant : effacée aussitôt)', !!al && al.fixe === 'fas' && al.calendrier.paliers.length === 3 && al.calendrier.fin === '2027-12-05', JSON.stringify(RD.etat().alertes));
    const ap = al ? (await RD.traiter('POST', '/api/radar/alerte', async () => ({id: al.id, action: 'appliquer'}))).status : 0, fx = RD.brut().fixes[0];
    ok('A3 radar#4 : « Appliquer » : sa dépense suit le tableau (3 paliers, fin le 05/12/2027)', ap === 200 && fx.paliers.length === 3 && fx.fin === '2027-12-05' && fx.montant === 31.2, JSON.stringify(fx));
    F.trs = T(res); await RD.lireMaintenant();   /* la lecture du matin trouve la confirmation de résiliation */
    const ar = RD.etat().alertes.find((a) => a.type === 'resiliation');
    ok('A3 radar#4 : une résiliation confirmée pour cette dépense (fin annoncée le 15/12/2026, avant celle du contrat) fait l’alerte « Résiliation » (avant : jamais, la dépense ayant une fin)', !!ar && ar.fixe === 'fas' && ar.fin === '2026-12-15', JSON.stringify(RD.etat().alertes));
    const rt = ar ? (await RD.traiter('POST', '/api/radar/alerte', async () => ({id: ar.id, action: 'retirer'}))).status : 0;
    await RD.traiter('POST', '/api/radar/lire', async () => ({})); await RD.attendre();   /* « Tout relire » : la résiliation et le contrat sont relus */
    const e = RD.etat(), fx2 = RD.brut().fixes[0];
    ok('A3 radar#4 : après « Retirer » (fin le 15/12/2026) puis « Tout relire » : ni la résiliation ni « Appliquer » ne reviennent, la fin avancée reste', rt === 200 && !!e.scan.fini && fx2.fin === '2026-12-15' && fx2.paliers.length === 3
      && !e.alertes.some((a) => a.type === 'resiliation' || a.type === 'calendrier'), JSON.stringify([fx2.fin, e.alertes]));
    /* une mensualisation acceptée (fin en août 2027) : la résiliation fait aussi l'alerte */
    const R2 = createRadar({file: path.join(DIR, 'r6.json'), gmail: fauxGmail({trs: T({...res, sender: 'clients@energie-exemple.fr', addressDisplayNames: [{displayName: 'Énergie Exemple'}]})}, (q) => (SUJET(q) && MOIS(q, '2026-11') ? ['trs'] : [])), now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 1});
    R2.regler('fixes', [{id: 'fe', service: 'Énergie Exemple', cat: 'Logement', montant: 85, jour: 15, rythme: 'mensuel', source: 'mail', dom: 'energie-exemple.fr', cle: 'energie-exemple.fr', debut: '2026-09-15', fin: '2027-08-15'}]);
    await R2.traiter('GET', '/api/radar', null); await R2.attendre();
    const ae = R2.etat().alertes.find((a) => a.type === 'resiliation');
    ok('A3 radar#4 : une mensualisation d’énergie acceptée (fin en août 2027) et sa résiliation au 15/12/2026 : alerte « Résiliation » avec « Retirer »', !!ae && ae.fixe === 'fe' && ae.fin === '2026-12-15', JSON.stringify(R2.etat().alertes));
    /* la même assurance saisie à la main, tableau jamais appliqué : il change d'assureur, « Retirer » sur la résiliation (fin le 15/12/2026) */
    const resilie = async (nom) => {
      const F3 = {tct: F.tct}, R3 = createRadar({file: path.join(DIR, nom), gmail: fauxGmail(F3, (q) => (/^has:attachment/.test(q) ? ['tct'] : SUJET(q) && (/newer_than:3d/.test(q) || MOIS(q, '2026-11')) ? ['trs'] : [])), now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 1});
      R3.regler('fixes', [{id: 'fas', service: 'Assurance de prêt', cat: 'Assurances', montant: 31.2, jour: 5, rythme: 'mensuel', fin: '2045-05-05', cle: 'courtier-exemple.fr', dom: 'courtier-exemple.fr'}]);
      await R3.traiter('GET', '/api/radar', null); await R3.attendre();
      F3.trs = T(res); await R3.lireMaintenant();
      const ac = R3.etat().alertes.find((a) => a.type === 'calendrier'), arz = R3.etat().alertes.find((a) => a.type === 'resiliation');
      const st = arz ? (await R3.traiter('POST', '/api/radar/alerte', async () => ({id: arz.id, action: 'retirer'}))).status : 0;
      return {R3, ac, st};
    };
    { const {R3, ac, st} = await resilie('r6b.json');
      await R3.lireMaintenant(); const matin = R3.etat().alertes.filter((a) => a.type === 'calendrier').length;
      await R3.traiter('POST', '/api/radar/lire', async () => ({})); await R3.attendre();
      const e3 = R3.etat(), f3 = R3.brut().fixes[0];
      ok('A3 radar#4 : tableau jamais appliqué, puis « Retirer » sur la résiliation : « Montants de ton contrat » disparaît à la lecture du matin et après « Tout relire », la fin reste au 15/12/2026 (avant : l’alerte restait, « Appliquer » remettait la dépense jusqu’au bout du contrat)',
        !!ac && st === 200 && matin === 0 && !!e3.scan.fini && !e3.alertes.some((a) => a.type === 'calendrier') && f3.fin === '2026-12-15', JSON.stringify([!!ac, st, matin, f3.fin, e3.alertes.map((a) => a.type)])); }
    { const {R3, ac, st} = await resilie('r6c.json');
      const ap3 = ac ? (await R3.traiter('POST', '/api/radar/alerte', async () => ({id: ac.id, action: 'appliquer'}))).status : 0, f3 = R3.brut().fixes[0];
      ok('A3 radar#4 : « Appliquer » touché juste après ce « Retirer » (avant la relecture suivante) : les montants du tableau, mais la fin reste au 15/12/2026 (avant : repoussée au 05/12/2027)',
        !!ac && st === 200 && ap3 === 200 && f3.fin === '2026-12-15' && (f3.paliers || []).length === 3, JSON.stringify([!!ac, st, ap3, f3])); } }

  /* ---------- radar#5 : « Tout relire » ne défait pas sa correction d'une mensualité ---------- */
  { const F = {tk1: T(M('mk1', 'credit@banque-exemple.fr', 'Banque Exemple', 'Évolution de votre prêt', 'Bonjour, votre nouvelle mensualité s’élèvera à 812,34 € à partir du mois prochain.', '2026-10-01T08:00:00Z'))};
    const RD = createRadar({file: path.join(DIR, 'r7.json'), gmail: fauxGmail(F, (q) => (SUJET(q) && MOIS(q, '2026-10') ? ['tk1'] : [])), now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 3});
    RD.regler('fixes', [{id: 'fk', service: 'Prêt Exemple', montant: 850, jour: 5, rythme: 'mensuel', cle: 'banque-exemple.fr', dom: 'banque-exemple.fr', source: 'mail'}]);
    await RD.traiter('GET', '/api/radar', null); await RD.attendre();
    const m1 = RD.etat().fixes[0].montant, a1 = RD.etat().alertes.filter((a) => a.type === 'mensualite').length;
    RD.regler('fixes', [{...RD.etat().fixes[0], montant: 821.34}]);   /* il corrige à la main */
    const r = await RD.traiter('POST', '/api/radar/lire', async () => ({})); await RD.attendre();
    const m2 = RD.etat().fixes[0].montant, a2 = RD.etat().alertes.filter((a) => a.type === 'mensualite').length;
    ok('A3 radar#5 : la nouvelle mensualité lue (812,34 €) s’applique une fois ; corrigée à la main (821,34 €), elle le reste après « Tout relire », sans alerte en double', m1 === 812.34 && a1 === 1 && r.status === 202 && m2 === 821.34 && a2 <= 1 && !!RD.etat().scan.fini, JSON.stringify([m1, a1, m2, a2]));
    fs.writeFileSync(path.join(DIR, 'r8.json'), JSON.stringify({version: 7, fixes: [], alertes: [{id: 'amk9', date: '2026-11-01', type: 'mensualite', service: 'Prêt Exemple', montant: 812.34}], scan: {fini: 1}, jours: {}}));
    const R9 = createRadar({file: path.join(DIR, 'r8.json'), gmail: {lie: () => false}, now: () => Date.parse('2026-11-23T09:00:00Z')});
    ok('A3 radar#5 : un radar.json d’avant retrouve, dans ses alertes, les mensualités déjà appliquées', JSON.stringify(R9.brut().mensAppliquees) === '["mk9"]', JSON.stringify(R9.brut().mensAppliquees)); }

  /* ---------- radar#6 : le jour d'un mail est celui de Paris ---------- */
  { const d = (iso) => lireMail({id: 'x', sender: 'a@b-exemple.fr', objet: 'Votre facture', texte: 'Montant : 10,00 €', date: iso}).date;
    ok('A3 radar#6 : un mail de 0 h 40 à Paris le 1er août est daté du 1er (Google donne 22 h 40 UTC la veille) ; de même au changement d’heure ; une date sans heure reste', d('2026-07-31T22:40:00Z') === '2026-08-01' && d('2026-10-24T22:30:00Z') === '2026-10-25'
      && d('2026-11-02T23:30:00Z') === '2026-11-03' && d('2026-11-02T08:00:00Z') === '2026-11-02' && d('2026-11-02') === '2026-11-02', [d('2026-07-31T22:40:00Z'), d('2026-10-24T22:30:00Z'), d('2026-11-02T23:30:00Z')].join());
    const F = {}; ['2026-07-31T22:40:00Z', '2026-08-31T22:40:00Z', '2026-09-30T22:40:00Z', '2026-10-31T23:40:00Z'].forEach((iso, i) => { F['tn' + i] = T(M('mn' + i, 'facturation@box-exemple.fr', 'Box Exemple', 'Votre facture', 'Votre facture est disponible. Montant TTC : 29,99 €.', iso)); });
    const RD = createRadar({file: path.join(DIR, 'r9.json'), gmail: fauxGmail(F, (q) => (SUJET(q) ? Object.keys(F) : [])), now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 4});
    await RD.traiter('GET', '/api/radar', null); await RD.attendre();
    const p = RD.etat().propositions.find((x) => x.service === 'Box Exemple');
    ok('A3 radar#6 (serveur) : quatre factures arrivées le 1er vers 0 h 40 → proposée « vers le 1er » (avant : vers le 31), historique daté du 1er', !!p && p.jour === 1 && p.historique.map((h) => h.date).join() === '2026-11-01,2026-10-01,2026-09-01,2026-08-01', JSON.stringify(p && [p.jour, p.historique])); }

  /* ---------- radar#7 : un radar.json abîmé est mis de côté, une écriture impossible n'arrête plus le serveur ---------- */
  { const sous = path.join(DIR, 'abime'); fs.mkdirSync(sous); const file = path.join(sous, 'radar.json'), txt = '{"fixes":[{"id":"f1","service":"Loyer","montant":700,"jour":3},';
    fs.writeFileSync(file, txt, {mode: 0o600}); const journal = [];
    const RD = createRadar({file, gmail: {lie: () => false}, now: () => Date.parse('2026-11-23T18:30:00Z'), log: (s) => journal.push(s)});
    const cote = fs.readdirSync(sous).filter((n) => /^radar-illisible-.*\.json$/.test(n));
    let leve = null; try { RD.tic(); } catch (e) { leve = e; }
    const garde = cote.length === 1 ? fs.readFileSync(path.join(sous, cote[0]), 'utf8') : '', droits = cote.length === 1 ? (fs.statSync(path.join(sous, cote[0])).mode & 0o777) : 0;
    ok('A3 radar#7 : un radar.json illisible est mis de côté tel quel (radar-illisible-….json, droits 600) et le journal le dit ; le Radar repart de zéro sans l’écraser', cote.length === 1 && garde === txt && droits === 0o600 && journal.some((s) => /illisible, mis de côté/.test(s)) && RD.brut().fixes.length === 0, JSON.stringify([cote, journal]));
    const lire = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }, neuf = (() => { try { return JSON.parse(lire(file)); } catch { return null; } })();
    ok('A3 radar#7 : le tic de 19 h écrit ensuite un radar.json neuf, sans toucher la copie', !leve && !!neuf && neuf.jours.soir === '2026-11-23' && cote.length === 1 && lire(path.join(sous, cote[0])) === txt);
    const sous2 = path.join(DIR, 'plein'); fs.mkdirSync(sous2); const f2 = path.join(sous2, 'radar.json'); fs.mkdirSync(f2 + '.tmp');   /* écriture impossible, comme un disque plein */
    const j2 = [], R2 = createRadar({file: f2, gmail: {lie: () => false}, now: () => Date.parse('2026-11-23T18:30:00Z'), log: (s) => j2.push(s)});
    let leve2 = null; try { R2.tic(); } catch (e) { leve2 = e; }
    ok('A3 radar#7 : une écriture impossible au tic de 19 h est notée au journal, sans erreur qui arrêterait le serveur', !leve2 && j2.some((s) => /radar\.json non enregistré/.test(s)), JSON.stringify([leve2 && leve2.message, j2]));
    fs.writeFileSync(path.join(DIR, 'vide.json'), '');
    const j3 = []; createRadar({file: path.join(DIR, 'absent.json'), gmail: {lie: () => false}, log: (s) => j3.push(s)});
    ok('A3 radar#7 : pas de fichier du tout : un Radar neuf, sans rien mettre de côté ni écrire au journal', !j3.length && !fs.readdirSync(DIR).some((n) => /^absent-illisible/.test(n))); }

  /* ---------- radar#9 : un seul « À venir » par renouvellement ---------- */
  { const F = {}; [['mv1', '2026-11-10T08:00:00Z'], ['mv2', '2026-11-20T08:00:00Z']].forEach(([id, iso]) => { F['t' + id] = T(M(id, 'info@video-exemple.com', 'Video Exemple', 'Renouvellement de votre abonnement', 'Votre abonnement annuel sera renouvelé automatiquement le 15/12/2026 pour 69,90 €.', iso)); });
    const RD = createRadar({file: path.join(DIR, 'r10.json'), gmail: fauxGmail(F, (q) => (SUJET(q) && MOIS(q, '2026-11') ? Object.keys(F) : [])), now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 1});
    await RD.traiter('GET', '/api/radar', null); await RD.attendre();
    const av = RD.etat().avenir.filter((v) => v.service === 'Video Exemple');
    ok('A3 radar#9 : deux rappels du même renouvellement (le 15/12, 69,90 €) font une seule ligne « À venir » (avant : deux)', av.length === 1 && av[0].date === '2026-12-15' && av[0].montant === 69.9, JSON.stringify(av)); }

  /* ---------- radar#10 : une saisie refusée laisse la proposition dans « À valider » ---------- */
  { fs.writeFileSync(path.join(DIR, 'r11.json'), JSON.stringify({version: 7, fixes: [], scan: {fini: 1}, jours: {}, propositions: [{id: 'pcr', cle: 'creche-exemple.fr', dom: 'creche-exemple.fr', service: 'Crèche Exemple', cat: 'Enfants', montant: null, jour: 5, rythme: 'mensuel', source: 'mail'}]}));
    const RD = createRadar({file: path.join(DIR, 'r11.json'), gmail: {lie: () => false}, now: () => Date.parse('2026-11-23T09:00:00Z')});
    const r1 = await RD.traiter('POST', '/api/radar/proposition', async () => ({id: 'pcr', oui: true, modif: {montant: 115000}}));
    const encore = RD.etat().propositions.some((p) => p.id === 'pcr');
    const r2 = await RD.traiter('POST', '/api/radar/proposition', async () => ({id: 'pcr', oui: true, modif: {montant: 1150}}));
    ok('A3 radar#10 : un montant refusé (115 000 €) répond en français ce qui manque, et la proposition reste à valider ; corrigé (1 150 €), elle est ajoutée', r1.status === 404 && /montant de moins de 100 000 €/.test(r1.body.error) && encore
      && r2.status === 200 && RD.brut().fixes.some((f) => f.service === 'Crèche Exemple' && f.montant === 1150) && !RD.etat().propositions.length, JSON.stringify([r1, encore, r2.status])); }

  /* ---------- radar#11 : pendant une relecture, « plus à payer » vaut aussi pour la notification de la veille ---------- */
  { const plan = {id: 'plx', cle: 'paypal.fr:boutique', dom: 'paypal.fr', service: 'Boutique', via: 'PayPal', fois: 4, total: 80, echeances: [{date: '2026-10-24', montant: 20, payee: true}, {date: '2026-11-24', montant: 20}, {date: '2026-12-24', montant: 20}, {date: '2027-01-24', montant: 20}], date: '2026-10-24', maj: '2026-10-24'};
    fs.writeFileSync(path.join(DIR, 'r12.json'), JSON.stringify({version: 7, fixes: [], revenus: {jour: 28, avance: true}, plans: {plx: plan}, scan: {fini: 1}, jours: {}}));
    let libere = null; const gmail = {lie: () => true, chercher: () => new Promise((z) => { libere = () => z({threads: []}); }), fil: async () => ({})};
    const RD = createRadar({file: path.join(DIR, 'r12.json'), gmail, now: () => Date.parse('2026-11-23T09:00:00Z')});
    RD.plan('plx', 'remettre');   /* range une fois : ses 3 échéances à venir */
    const v0 = await RD.veille();
    RD.relireTout(); await pause(20);
    const pendant = RD.etat().relecture, rp = RD.plan('plx', 'retirer'), v1 = await RD.veille(), e = RD.etat();
    ok('A3 radar#11 : relecture en cours, paiement dit « plus à payer » : plus de notification « Demain : Paiement en 4 fois : Boutique », ni d’échéance comptée ou « À venir »', !!v0 && /Boutique/.test(v0.title) && pendant && rp.ok && v1 === null
      && !e.ponctuels.some((x) => x.plan === 'plx') && !e.avenir.some((x) => x.plan === 'plx') && e.plans.find((p) => p.id === 'plx').retire, JSON.stringify([v0 && v0.title, v1, e.ponctuels.length, e.avenir.length]));
    if (libere) libere(); }

  /* ---------- radar#12 : « Tout relire » pendant la lecture du matin ---------- */
  { const F = {tq1: T(M('mq1', 'facturation@eau-exemple.fr', 'Eau Exemple', 'Votre facture', 'Montant TTC : 21,30 €. Il sera prélevé le 06/11/2026.', '2026-11-02T08:00:00Z'))};
    const qs = []; let bloque = null;
    const gmail = fauxGmail(F, (q) => (SUJET(q) && (MOIS(q, '2026-11') || /newer_than:3d/.test(q)) ? ['tq1'] : []));
    const ch0 = gmail.chercher; gmail.chercher = async (q) => { qs.push(q); if (/newer_than:3d/.test(q) && !bloque) await new Promise((z) => { bloque = z; }); return ch0(q); };
    const RD = createRadar({file: path.join(DIR, 'r13.json'), gmail, now: () => Date.parse('2026-11-23T09:00:00Z'), moisDepart: 1});
    await RD.traiter('GET', '/api/radar', null); await RD.attendre();
    const fini0 = RD.brut().scan.fini, n0 = qs.length;
    RD.lireMaintenant(); await jusqua(() => !!bloque);   /* la lecture du matin attend Google */
    const r = await RD.traiter('POST', '/api/radar/lire', async () => ({}));
    const r2 = await RD.traiter('POST', '/api/radar/lire', async () => ({}));   /* un second appui */
    if (bloque) bloque(); await RD.attendre(); await RD.attendre(); await RD.attendre();
    const apres = qs.slice(n0), relus = apres.filter((q) => /after:2026\/11\/01 /.test(q) && SUJET(q)).length;
    ok('A3 radar#12 : « Tout relire » pendant la lecture du matin : la relecture complète part dès qu’elle finit, une seule fois (avant : rien n’était relu)', r.status === 202 && r2.status === 202 && relus === 1 && !!RD.brut().scan.complet && RD.brut().scan.fini >= fini0 && !RD.brut().avant && !RD.etat().relecture && RD.brut().releves.length === 1,
      JSON.stringify([r.status, relus, RD.brut().scan])); }
} catch (e) { ok('exception', false, e.stack); }
fs.rmSync(DIR, {recursive: true, force: true});
console.log(results.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + results.length + ' vérifications).');
process.exit(fails ? 1 : 0);
