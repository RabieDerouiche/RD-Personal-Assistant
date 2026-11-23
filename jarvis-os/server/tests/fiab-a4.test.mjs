/* Banc 0.70.0 — lot A4 (PDF, accès Google, comparatifs et idées) : node tests/fiab-a4.test.mjs
   Aucun vrai Google, aucun vrai Claude, aucun réseau : faux serveur local, faux Claude, faux téléchargements. Données inventées. */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http'; import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {texteDePdf} from '../pdf.mjs';
import {createComparatifs, adresseSure, ipPrivee, lireCorps} from '../comparatif.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fiab-a4-'));
const attends = (ms) => new Promise((z) => setTimeout(z, ms));
const chrono = (f) => { const t = Date.now(), r = f(); return {r, ms: Date.now() - t}; };

/* ---------- un petit PDF : [numéro, dictionnaire (LEN = longueur du flux), flux ou rien] ---------- */
const doc = (objs) => { const parts = [Buffer.from('%PDF-1.4\n', 'latin1')]; for (const [n, d, flux] of objs) { if (flux == null) parts.push(Buffer.from(`${n} 0 obj ${d} endobj\n`, 'latin1')); else { const f = Buffer.isBuffer(flux) ? flux : Buffer.from(flux, 'latin1'); parts.push(Buffer.from(`${n} 0 obj ${d.replace('LEN', f.length)}\nstream\n`, 'latin1'), f, Buffer.from('\nendstream\nendobj\n', 'latin1')); } } parts.push(Buffer.from('trailer << /Root 1 0 R >>\n%%EOF', 'latin1')); return Buffer.concat(parts); };
const page = (contenu, extra = [], res = '/Font << /F1 5 0 R >>') => doc([[1, '<< /Type /Catalog /Pages 2 0 R >>'], [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'], [3, `<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << ${res} >> >>`], [4, '<< /Length LEN >>', contenu], [5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'], ...extra]);
const type0 = (contenu, objs) => doc([[1, '<< /Type /Catalog /Pages 2 0 R >>'], [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'], [3, '<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>'], [4, '<< /Length LEN >>', contenu], ...objs]);

try {
  /* ====================== pdf-google#1 : chaîne hexadécimale sans « > » ====================== */
  { const a = chrono(() => texteDePdf(page('BT /F1 12 Tf 10 10 Td (Montant 45,00) Tj ET <48656c'))), b = chrono(() => texteDePdf(page('<48656c'))), c = texteDePdf(page('BT /F1 12 Tf 10 10 Td <48656c6c6f> Tj ET'));
    ok('PDF : une chaîne hexadécimale sans « > » ne gèle plus le serveur (avant : boucle sans fin) ; le texte lu avant reste', a.r === 'Montant 45,00' && a.ms < 500 && b.r === '' && b.ms < 500, JSON.stringify([a, b]));
    ok('PDF : une chaîne hexadécimale normale se lit toujours (« Hello »)', c === 'Hello', JSON.stringify(c)); }
  { const f = fs.readFileSync(path.join(HERE, 'fixtures', 'facture-exemple.pdf')), t = texteDePdf(f);
    ok('PDF : la facture d’exemple (Chromium, polices incluses) rend le même texte qu’avant', /^Crèche Les Lutins\nFacture n° 2026-11 du 05\/11\/2026\n/.test(t) && /Total à payer : 412,50 €\nPrélèvement le 10\/11\/2026 sur votre compte\.$/.test(t), JSON.stringify(t)); }

  /* ====================== pdf-google#2 : budget de travail et de taille ====================== */
  { const z = zlib.deflateSync(Buffer.alloc(100e6, 32), {level: 9});
    const a = chrono(() => texteDePdf(doc([[1, '<< /Type /Catalog /Pages 2 0 R >>'], [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'], [3, '<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>'], [4, '<< /Length LEN /Filter /FlateDecode >>', z]])));
    ok('PDF : bombe de décompression (97 Ko qui donnent 100 Mo) écartée vite, sans erreur (avant : 2,4 s et 350 Mo)', typeof a.r === 'string' && a.ms < 1000, a.ms + ' ms'); }
  { const z = zlib.deflateSync(Buffer.alloc(17e6, 32), {level: 9}), l = []; for (let k = 0; k < 120; k++) l.push([10 + k, '<< /Length LEN /Filter /FlateDecode >>', z]);
    const rss0 = process.memoryUsage().rss;
    const a = chrono(() => texteDePdf(doc([[1, '<< /Type /Catalog /Pages 2 0 R >>'], [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'], [3, '<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>'], [4, '<< /Length LEN >>', 'BT (Montant 12,00) Tj ET'], ...l])));
    const pris = Math.round((process.memoryUsage().rss - rss0) / 1e6);
    ok('PDF : 120 flux qui gonflent chacun à 17 Mo : budget total de 32 Mo, le texte de la page est lu (avant : 3,5 Go de mémoire)', a.r === 'Montant 12,00' && a.ms < 1500 && pris < 600, a.ms + ' ms, +' + pris + ' Mo'); }
  { const n = 30, form = 'BT /F1 12 Tf (x) Tj ET ' + Array(n).fill('/Fm0 Do').join(' ');
    const a = chrono(() => texteDePdf(page(Array(n).fill('/Fm0 Do').join(' '), [[6, '<< /Type /XObject /Subtype /Form /Length LEN >>', form]], '/XObject << /Fm0 6 0 R >> /Font << /F1 5 0 R >>')));
    ok('PDF : un formulaire qui s’appelle lui-même 30 fois passe vite (300 formulaires au plus ; avant : 12 s, et N⁴)', /^x\n/.test(a.r) && a.ms < 500, a.ms + ' ms'); }
  { const ok3 = page('/Fm0 Do', [[6, '<< /Type /XObject /Subtype /Form /Length LEN /Resources << /Font << /F1 5 0 R >> >> >>', 'BT /F1 12 Tf 10 10 Td (Total 89,90) Tj ET']], '/XObject << /Fm0 6 0 R >> /Font << /F1 5 0 R >>');
    ok('PDF : un formulaire normal porte toujours le texte de la page', texteDePdf(ok3) === 'Total 89,90', JSON.stringify(texteDePdf(ok3))); }
  { const l = Array(1000).fill('<0000> <FFFF> <0041>').join('\n');
    const a = chrono(() => texteDePdf(type0('BT /F1 12 Tf <00410042> Tj ET', [[5, '<< /Type /Font /Subtype /Type0 /ToUnicode 6 0 R >>'], [6, '<< /Length LEN >>', 'beginbfrange\n' + l + '\nendbfrange']])));
    const w = Array(1000).fill('0 65535 500').join(' '), b = chrono(() => texteDePdf(type0('BT /F1 12 Tf <00410042> Tj ET', [[5, '<< /Type /Font /Subtype /Type0 /DescendantFonts [7 0 R] >>'], [7, `<< /Type /Font /Subtype /CIDFontType2 /W [ ${w} ] >>`]])));
    ok('PDF : tables de police gonflées (1 000 plages de 65 536 codes, en ToUnicode et en largeurs) : bornées, rapides (avant : 3 s chacune)', typeof a.r === 'string' && a.ms < 1000 && typeof b.r === 'string' && b.ms < 1000, a.ms + ' / ' + b.ms + ' ms'); }
  { const cm = 'beginbfchar\n<0041> <0045>\nendbfchar\nbeginbfrange\n<0042> <0043> <0046>\n<0044> <0044> [<0049>]\nendbfrange';
    const t = texteDePdf(type0('BT /F1 12 Tf <0041004200430044> Tj ET', [[5, '<< /Type /Font /Subtype /Type0 /ToUnicode 6 0 R >>'], [6, '<< /Length LEN >>', cm]]));
    ok('PDF : une table ToUnicode normale (code seul, plage, plage en tableau) se lit toujours', t === 'EFGI', JSON.stringify(t)); }
  { const cas = {
      'suite de chiffres': Buffer.from('%PDF-1.4\n' + '1'.repeat(200000), 'latin1'),
      'débuts de table sans fin': type0('BT /F1 12 Tf <0041> Tj ET', [[5, '<< /Type /Font /Subtype /Type0 /ToUnicode 6 0 R >>'], [6, '<< /Length LEN >>', 'beginbfchar '.repeat(20000)]]),
      '« ] » sans « [ »': page('1 '.repeat(200000) + '] '.repeat(200000) + 'BT /F1 12 Tf (fin) Tj ET'),
      '« /Contents [ » sans fin': doc([[1, '<< /Type /Catalog >>'], [3, '<< /Type /Page ' + '/Contents ['.repeat(50000) + ' >>']]),
      '« /Filter [ » sans fin': doc([[4, '<< ' + '/Filter ['.repeat(50000) + ' /Length LEN >>', 'x']]),
      'polices descendantes en chiffres': type0('BT /F1 12 Tf <0041> Tj ET', [[5, '<< /Type /Font /Subtype /Type0 /DescendantFonts [' + '1'.repeat(100000) + '] >>']]),
      'largeurs en « [ » imbriqués': type0('BT /F1 12 Tf <0041> Tj ET', [[5, '<< /Type /Font /Subtype /Type0 /DescendantFonts [7 0 R] >>'], [7, '<< /W [' + '['.repeat(100000) + ' >>']]),
      'plages en tableau ouvert': type0('BT /F1 12 Tf <0041> Tj ET', [[5, '<< /Type /Font /Subtype /Type0 /ToUnicode 6 0 R >>'], [6, '<< /Length LEN >>', 'beginbfrange ' + '<0><0>['.repeat(100000) + ' endbfrange']])};
    const lents = []; for (const [k, b] of Object.entries(cas)) { const a = chrono(() => texteDePdf(b)); if (a.ms > 800 || typeof a.r !== 'string') lents.push(k + ' ' + a.ms + ' ms'); }
    const crochets = texteDePdf(cas['« ] » sans « [ »']);
    ok('PDF : huit autres pièges qui gelaient le serveur (expressions qui repartaient en arrière, recherche dans toute la pile) rendent en moins de 0,8 s', !lents.length && crochets === 'fin', lents.join(', ') + ' ' + JSON.stringify(crochets)); }
  { const n = 20000, l = [[1, '<< /Type /Catalog >>'], [5, '<< /Font << ' + Array.from({length: n}, (_, k) => '/F' + k + ' 9 0 R').join(' ') + ' >> >>']]; for (let k = 0; k < n; k++) l.push([100 + k, '<< /Type /Page /Contents 4 0 R >>']); l.push([4, '<< /Length LEN >>', 'BT (a) Tj ET']);
    const a = chrono(() => texteDePdf(doc(l), 100000, {ms: 300}));
    ok('PDF : au bout du temps permis (ici 0,3 s ; 2,5 s en service), la lecture s’arrête et rend le texte déjà lu', /^a\na\n/.test(a.r) && a.ms < 900, a.ms + ' ms, ' + a.r.length + ' car.'); }

  /* ====================== Google : faux serveur local ====================== */
  const FG = {calls: [], tokenMs: 0, nTok: 0};
  const enc = (s, cs) => Buffer.from(s, cs).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  const w1252 = Buffer.from([...Buffer.from('Votre pr', 'latin1'), 0xe9, ...Buffer.from('l', 'latin1'), 0xe8, ...Buffer.from('vement de 45,00 ', 'latin1'), 0x80, ...Buffer.from(' aura lieu le 5 d', 'latin1'), 0xe9, ...Buffer.from('cembre.', 'latin1')]).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  const part = (data, ct) => ({mimeType: 'text/plain', headers: ct ? [{name: 'Content-Type', value: ct}] : [], body: {data}});
  const FIL = {id: 'th1', messages: [{id: 'm1', threadId: 'th1', internalDate: '1763290000000', payload: {headers: [{name: 'From', value: 'Facturation <factures@energie.example>'}, {name: 'Subject', value: 'Votre échéance'}], mimeType: 'multipart/mixed', parts: [part(w1252, 'text/plain; charset="windows-1252"')]}},
    {id: 'm2', threadId: 'th1', internalDate: '1763290000000', payload: {headers: [], mimeType: 'multipart/mixed', parts: [part(enc('Déjà en UTF-8 : 12,00 €', 'utf8'), 'text/plain; charset=ISO-8859-1')]}},
    {id: 'm3', threadId: 'th1', internalDate: '1763290000000', payload: {headers: [], mimeType: 'multipart/mixed', parts: [part(enc('Sans en-tête : été', 'utf8'))]}},
    {id: 'm4', threadId: 'th1', internalDate: '1763290000000', payload: {headers: [{name: 'Content-Type', value: 'text/plain; charset=iso-8859-15'}], mimeType: 'text/plain', body: {data: Buffer.from([0x50, 0x72, 0x69, 0x78, 0x20, 0x39, 0x20, 0xa4]).toString('base64')}}}]};
  const srv = http.createServer((q, r) => { let raw = ''; q.on('data', (d) => { raw += d; }); q.on('end', async () => {
    const u = new URL(q.url, 'http://x'), p = decodeURIComponent(u.pathname), auth = (q.headers.authorization || '').replace('Bearer ', '');
    FG.calls.push({path: p, q: Object.fromEntries(u.searchParams), auth});
    const send = (st, o) => { r.writeHead(st, {'content-type': 'application/json'}); r.end(JSON.stringify(o)); };
    if (p === '/token') { const b = Object.fromEntries(new URLSearchParams(raw)); FG.nTok++; if (FG.tokenMs) await attends(FG.tokenMs);
      if (b.refresh_token === 'RT1') return send(200, {access_token: 'A' + FG.nTok, expires_in: 3600});
      if (b.refresh_token === 'RT2') return send(200, {access_token: 'B' + FG.nTok, expires_in: 3600});
      return send(400, {error: 'invalid_grant', error_description: 'Token has been expired or revoked.'}); }
    if (p.includes('/values/Lent')) return;   /* ne répond jamais */
    if (p.includes('/values/CorpsLent')) { r.writeHead(200, {'content-type': 'application/json'}); r.write('{"values": [["a"'); return; }   /* corps jamais fini */
    if (p.startsWith('/sheets/')) return send(200, {range: 'Faits!A1', values: [['x', auth]]});
    if (p === '/calendar/calendars/primary/events') { const pg = u.searchParams.get('pageToken');
      if (!pg) return send(200, {summary: 'Agenda principal', timeZone: 'Europe/Paris', items: [{id: 'e1'}, {id: 'e2'}], nextPageToken: 'p2'});
      if (pg === 'p2') return send(200, {summary: 'Agenda principal', items: [], nextPageToken: 'p3'});   /* une page vide, mais il en reste */
      return send(200, {summary: 'Agenda principal', items: [{id: 'e3'}]}); }
    if (p === '/gmail/users/me/threads/th1') return send(200, FIL);
    if (p === '/drive/files') { const qq = u.searchParams.get('q') || ''; return send(200, {files: /mimeType = 'application\/vnd\.google-apps\.folder'/.test(qq) ? [] : [{id: 'doc1', name: 'Quittance.pdf', parents: ['pap']}]}); }
    send(404, {error: {message: 'inconnu'}}); }); });
  await new Promise((z) => srv.listen(0, '127.0.0.1', z));
  process.env.JARVIS_GOOGLE_FAKE = 'http://127.0.0.1:' + srv.address().port;
  process.env.JARVIS_GOOGLE_DELAI_MS = '400';
  const {createGoogle} = await import('../google.mjs');   /* après JARVIS_GOOGLE_FAKE : les adresses de Google vers le faux serveur */
  const nouveau = (refresh = 'RT1') => { const S = {google: {clientId: 'essai.apps.googleusercontent.com', clientSecret: 'secret-d-essai-123', refresh}}; return {S, GG: createGoogle({S, save: () => {}})}; };

  /* pdf-google#5 : jeu de caractères des mails */
  { const {GG} = nouveau(), t = await GG.tool('Gmail', 'get_thread', {threadId: 'th1'}), b = t.messages.map((m) => m.plaintextBody);
    ok('Gmail : un mail en windows-1252 se lit avec ses accents et son « € » (avant : « pr�l�vement de 45,00 � »)', b[0] === 'Votre prélèvement de 45,00 € aura lieu le 5 décembre.', JSON.stringify(b[0]));
    ok('Gmail : un corps déjà en UTF-8 (même annoncé ISO-8859-1), ou sans en-tête, reste lu en UTF-8 ; ISO-8859-15 rend son « € »', b[1] === 'Déjà en UTF-8 : 12,00 €' && b[2] === 'Sans en-tête : été' && b[3] === 'Prix 9 €', JSON.stringify(b.slice(1))); }

  /* pdf-google#6 : pages suivantes de l'agenda */
  { const {GG} = nouveau(); FG.calls.length = 0; const r = await GG.tool('Google Calendar', 'list_events', {startTime: '2026-11-01T00:00:00', endTime: '2027-07-01T00:00:00', pageSize: 250});
    const n = FG.calls.filter((c) => c.path === '/calendar/calendars/primary/events').length;
    ok('Agenda : les pages suivantes sont lues aussi, même après une page vide (avant : seulement la première)', r.events.map((e) => e.id).join() === 'e1,e2,e3' && n === 3 && r.summary === 'Agenda principal' && r.timeZone === 'Europe/Paris', JSON.stringify([r, n])); }

  /* pdf-google#7 : délai des appels à Google */
  { const {GG} = nouveau(); await GG.tool('Google Sheets', 'get_values', {spreadsheetId: 's', range: 'Faits!A1'});
    const t0 = Date.now(); let e1 = null; try { await GG.tool('Google Sheets', 'get_values', {spreadsheetId: 's', range: 'Lent!A1'}); } catch (e) { e1 = e; } const ms1 = Date.now() - t0;
    let e2 = null, v2 = null; try { v2 = await GG.tool('Google Sheets', 'get_values', {spreadsheetId: 's', range: 'CorpsLent!A1'}); } catch (e) { e2 = e; }
    ok('Google : un appel sans réponse échoue au bout du délai (ici 0,4 s ; 30 s en service), avec un message en français (avant : 5 min au moins)', !!e1 && /^Google ne répond pas/.test(e1.message) && e1.code === 'tool_error' && ms1 < 2000, (e1 && e1.message) + ' ' + ms1 + ' ms');
    ok('Google : une réponse dont le corps n’arrive pas est une erreur, pas une lecture vide de Pilotage', !!e2 && /^Google ne répond pas/.test(e2.message) && v2 === null, JSON.stringify([e2 && e2.message, v2])); }

  /* pdf-google#9 : dossiers relus au bout de 10 minutes */
  { const {GG} = nouveau(), vrai = Date.now; let decal = 0; Date.now = () => vrai() + decal;
    try {
      const nbArbre = () => FG.calls.filter((c) => c.path === '/drive/files' && /mimeType = 'application\/vnd\.google-apps\.folder'/.test(c.q.q || '')).length;
      FG.calls.length = 0; const roots = [{id: 'pap', key: 'papiers'}];
      await GG.tool('Google Drive', 'search_text', {query: 'quittance', roots}); decal = 6 * 60000;
      await GG.tool('Google Drive', 'search_text', {query: 'quittance', roots}); const a = nbArbre(); decal = 11 * 60000;
      await GG.tool('Google Drive', 'search_text', {query: 'quittance', roots}); const b = nbArbre();
      ok('Drive : les dossiers gardés 10 minutes sont relus au bout de 10 minutes, même si les recherches se suivent (avant : jamais)', a === 1 && b === 2, a + ' puis ' + b);
    } finally { Date.now = vrai; } }

  /* pdf-google#11 : un seul renouvellement du jeton à la fois */
  { const {GG} = nouveau(); FG.nTok = 0; FG.tokenMs = 150;
    const r = await Promise.all([1, 2, 3, 4, 5].map(() => GG.tool('Google Sheets', 'get_values', {spreadsheetId: 's', range: 'Faits!A1'})));
    ok('Google : 5 lectures qui tombent ensemble avec un jeton à renouveler ne font qu’un seul renouvellement (avant : 5)', FG.nTok === 1 && r.every((x) => x.values[0][1] === 'A1'), FG.nTok + ' ' + JSON.stringify(r.map((x) => x.values[0][1])));
    const n2 = nouveau(); FG.nTok = 0; const p = n2.GG.tool('Google Sheets', 'get_values', {spreadsheetId: 's', range: 'Faits!A1'}); await attends(40); n2.S.google.refresh = 'RT2';
    const v = await p;
    ok('Google : un renouvellement lancé avec l’ancien compte n’écrase pas le nouveau (l’appel part avec le jeton du compte relié)', /^B/.test(v.values[0][1]) && FG.nTok === 2, JSON.stringify([v.values[0][1], FG.nTok]));
    const n3 = nouveau('RT-perime'); const p3 = n3.GG.tool('Google Sheets', 'get_values', {spreadsheetId: 's', range: 'Faits!A1'}).catch((e) => e); await attends(40); n3.S.google.refresh = 'RT2';
    const v3 = await p3;
    ok('Google : un refus de l’ancien accès n’efface pas l’accès relié entre-temps', n3.S.google.refresh === 'RT2' && /^B/.test((v3 && v3.values && v3.values[0][1]) || ''), JSON.stringify([n3.S.google.refresh, v3 && (v3.values || v3.message)]));
    FG.tokenMs = 0; }
  srv.closeAllConnections(); srv.close();

  /* ====================== comparatifs et idées ====================== */
  const png = (w, h, mark) => { const hd = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(hd, 0); hd.writeUInt32BE(13, 8); hd.write('IHDR', 12); hd.writeUInt32BE(w, 16); hd.writeUInt32BE(h, 20); return Buffer.concat([hd, Buffer.from(mark.repeat(400))]); };
  const rep = (status, body, headers = {}) => ({ok: status >= 200 && status < 300, status, url: '', headers: new Headers(headers), body: body == null ? null : new Blob([body]).stream()});
  const publique = async (h) => [{address: /interne/.test(h) ? '10.1.2.3' : '93.184.215.14', family: 4}];
  const quand = () => { let ouvre; const p = new Promise((z) => { ouvre = z; }); return {p, ouvre}; };
  const fabrique = (o) => { const D = fs.mkdtempSync(path.join(DIR, 'c-')); const S = o.S || {}; const C = createComparatifs({S, save: () => {}, DATA: D, settings: null, model: 'm', lookup: publique, fetchImpl: o.fetchImpl || (async () => rep(404, '')), now: o.now, onIdee: o.onIdee, runClaude: o.runClaude}); return {C, S, D}; };
  const comp = (arr) => JSON.stringify({resume: 'r', difference_cle: 'd', criteres: [], variantes: arr.map((p) => ({nom: p.nom, page: p.page || '', images: p.images || []})), conseil: 'c', certitude: 'likely', sources: []});

  /* pdf-google#3 : comparatif en file pas relancé */
  { const portes = [], appels = [];
    const {C, S} = fabrique({runClaude: async (a) => { appels.push(a.kind); const g = quand(); portes.push(g); await g.p; const arr = JSON.parse(a.prompt.split('données) :\n')[1].split('\n')[0]); return {ok: true, text: comp(arr)}; }});
    const A = {famille: 'Robot Alpha', produits: [{nom: 'Robot Alpha 1', prix: 100}]}, B = {famille: 'Robot Beta', produits: [{nom: 'Robot Beta 2', prix: 200}]};
    C.demander(A); const kB = C.demander(B).comparatif.key; C.demander(B); C.demander(B); C.demander({...B, refaire: true});
    for (let i = 0; i < 40 && portes.length < 2; i++) { portes.forEach((g) => g.ouvre()); await attends(20); }
    portes.forEach((g) => g.ouvre()); for (let i = 0; i < 40 && S.comparatifs[kB].statut !== 'pret'; i++) await attends(20);
    ok('Comparatifs : un comparatif encore en file n’est pas remis en file à chaque ouverture d’Achats (2 passages de Claude pour 2 produits, pas 5)', appels.filter((k) => k === 'comparatif').length === 2 && S.comparatifs[kB].statut === 'pret', JSON.stringify([appels, S.comparatifs[kB].statut])); }

  /* pdf-google#4 : idées en attente, effacées, interrompues */
  { let t = Date.parse('2026-11-23T10:00:00Z'); const portes = [], appels = [], notifs = [];
    const {C, S} = fabrique({now: () => t, onIdee: (x) => notifs.push(x.idee), runClaude: async (a) => { appels.push(a.idee || a.prompt.slice(0, 40)); const g = quand(); portes.push(g); await g.p; return {ok: true, text: JSON.stringify({comprehension: 'ok', propositions: [{nom: 'Produit ' + appels.length, prix: 20}], certitude: 'likely'})}; }});
    const a = C.chercher({idee: 'maison de poupée', max: 60, n: 1}).recherche, b = C.chercher({idee: 'trottinette', max: 60, n: 1}).recherche, c = C.chercher({idee: 'puzzle', max: 30, n: 1}).recherche;
    await attends(20); t += 41 * 60000;
    const vb = C.idees().find((x) => x.id === b.id), rb = C.chercher({idee: 'trottinette', max: 60, n: 1, refaire: true}).recherche;
    ok('Idées : une recherche qui attend son tour depuis 41 min reste « en cours » (avant : « interrompue : relance-la »), et une relance la rend telle quelle', vb.statut === 'en_cours' && !vb.erreur && rb.id === b.id, JSON.stringify([vb.statut, vb.erreur, rb.id === b.id]));
    C.effaceIdee(c.id);
    for (let i = 0; i < 60 && !(notifs.length >= 2 && portes.length >= 2 && C.idees().every((x) => x.statut !== 'en_cours')); i++) { portes.forEach((g) => g.ouvre()); await attends(25); }
    await attends(50);
    ok('Idées : une recherche effacée avant son tour ne passe pas chez Claude et ne notifie pas ; les autres finissent (2 passages, 2 notifications)', appels.length === 2 && notifs.join() === 'maison de poupée,trottinette' && C.idees().map((x) => x.statut).join() === 'pret,pret', JSON.stringify([appels.length, notifs, C.idees().map((x) => x.statut)]));
    /* serveur redémarré : une recherche « en cours » de l'état sauvé est interrompue tout de suite */
    S.idees[0].statut = 'en_cours'; S.idees[0].data = null; const C2 = createComparatifs({S, save: () => {}, DATA: fs.mkdtempSync(path.join(DIR, 'r-')), runClaude: async () => ({ok: false}), now: () => t});
    const v2 = C2.idees()[0];
    ok('Idées : après un redémarrage, une recherche restée « en cours » est dite interrompue tout de suite (avant : au bout de 40 min)', v2.statut === 'echec' && /interrompue/.test(v2.erreur), JSON.stringify(v2)); }

  /* pdf-google#8 : ménage des photos et des comparatifs */
  { const D = fs.mkdtempSync(path.join(DIR, 'm-')), IMG = path.join(D, 'images'); fs.mkdirSync(IMG, {recursive: true}); fs.mkdirSync(path.join(D, 'work', 'photos-0123456789'), {recursive: true});
    const nom = (k) => String(k).repeat(24).slice(0, 24) + '.png', vieux = (Date.now() - 3 * 864e5) / 1000;
    for (const k of [1, 2, 3, 4, 5, 6, 7]) { fs.writeFileSync(path.join(IMG, nom(k)), 'x'); fs.utimesSync(path.join(IMG, nom(k)), vieux, vieux); }
    fs.writeFileSync(path.join(IMG, nom(8)), 'x');   /* récente, pas encore rangée dans une fiche */
    const cp = (k, at, photo, data = true) => ({key: 'k' + k, famille: 'Robot Gamma', produits: ['v' + k], at, statut: data ? 'pret' : 'echec', data: data ? {variantes: [{nom: 'v' + k, photo}]} : null});
    const S = {comparatifs: {k1: cp(1, 100, nom(1)), k2: cp(2, 200, nom(2)), k3: cp(3, 300, '', false), k4: cp(4, 400, '', false), k5: cp(5, 500, '', false), k6: cp(6, 600, '', false), k7: cp(7, 700, '', false), k8: {key: 'k8', famille: 'Autre', at: 1, statut: 'pret', data: {variantes: [{photo: nom(6)}]}}},
      idees: [{id: 'i1', statut: 'pret', data: {propositions: [{photo: nom(7)}], presque: []}}]};
    createComparatifs({S, save: () => {}, DATA: D, runClaude: async () => ({ok: false})});
    await attends(50);
    const restent = fs.readdirSync(IMG).sort().map((f) => f[0]).join(''), cles = Object.keys(S.comparatifs).sort().join();
    ok('Ménage : les photos qu’aucun comparatif ni aucune recherche ne montre sont effacées (sauf celles du jour) ; 5 comparatifs par produit, plus le dernier qui a un contenu', restent === '2678' && cles === 'k2,k3,k4,k5,k6,k7,k8' && !fs.existsSync(path.join(D, 'work', 'photos-0123456789')), restent + ' / ' + cles); }

  /* pdf-google#10 : adresses du réseau local, redirections, corps énormes */
  { const non = ['http://127.0.0.1:2019/config/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://2130706433/', 'http://localhost:8080/', 'http://panier:3000/courses', 'http://10.0.0.5/x.png', 'http://192.168.1.1/', 'http://service.internal/', 'http://intranet.interne.example/', 'ftp://exemple.fr/x.png', 'file:///etc/passwd', 'pas une adresse'];
    const r = await Promise.all(non.map((u) => adresseSure(u, '', publique))), oui = await adresseSure('https://www.vendeur.example/fiche', '', publique), conf = await adresseSure('http://127.0.0.1:4567/x', 'http://127.0.0.1:4567', publique);
    ok('Téléchargements : le serveur lui-même, le réseau local et les noms locaux sont refusés ; une adresse publique et l’adresse de Steam réglée par le propriétaire passent', r.every((x) => x === false) && oui && conf && ipPrivee('fd00::1') && ipPrivee('100.64.0.1') && !ipPrivee('8.8.8.8') && !ipPrivee('2001:4860::8888'), JSON.stringify(non.filter((u, k) => r[k])) + ' ' + oui + ' ' + conf); }
  { let tire = 0; const corps = (taille) => ({ok: true, status: 200, headers: new Headers(taille ? {'content-length': String(taille)} : {}), body: new ReadableStream({pull(c) { tire++; c.enqueue(new Uint8Array(65536)); }})});
    const a = await lireCorps(corps(5e7), 6e6), tA = tire; tire = 0; const b = await lireCorps(corps(0), 6e6), tB = tire; tire = 0; const c = await lireCorps(corps(0), 800000, true);
    ok('Téléchargements : une image annoncée à 50 Mo n’est pas lue ; un corps sans taille est coupé à 6 Mo ; une page est tronquée à 800 Ko', a === null && tA <= 2 && b === null && tB <= 100 && c.length === 800000, JSON.stringify([tA, tB, c && c.length])); }
  { const vus = []; let photoDemandee = 0;
    const fetchImpl = async (u, o) => { vus.push(u);
      if (u === 'https://fabricant.example/tm7') return rep(200, '<script type="application/ld+json">{"image":["https://cdn.example/tm7.png","http://127.0.0.1:2019/config/"]}</script>', {'content-type': 'text/html'});
      if (u === 'https://cdn.example/tm7.png') return rep(200, png(800, 800, 'BON-PHOTO'), {'content-type': 'image/png'});
      if (u === 'https://cdn.example/redirige.png') return rep(302, '', {location: 'http://169.254.169.254/latest/'});
      return rep(404, ''); };
    const {C, S, D} = fabrique({fetchImpl, runClaude: async (a) => {
      if (a.kind === 'comparatif') return {ok: true, text: comp([{nom: 'Thermomix® TM7 Noir', page: 'https://fabricant.example/tm7', images: ['https://cdn.example/redirige.png']}, {nom: 'Robot Exemple Blanc', page: 'https://fabricant.example/tm7'}, {nom: 'Robot Exemple Gris', page: 'https://fabricant.example/tm7'}])};
      photoDemandee++; const l = JSON.parse(a.prompt.slice(a.prompt.indexOf('['), a.prompt.lastIndexOf(']') + 1));
      return {ok: true, text: JSON.stringify({choix: [{variante: 'Thermomix TM7 Noir', fichier: l[0].fichiers[0]}, {variante: 'Le robot blanc', fichier: l[1].fichiers[0]}, {variante: 'Robot Exemple Gris', fichier: null}]})}; }});
    const k = C.demander({famille: 'Robot cuiseur', produits: [{nom: 'Thermomix® TM7 Noir', prix: 1499}, {nom: 'Robot Exemple Blanc', prix: 300}, {nom: 'Robot Exemple Gris', prix: 300}]}).comparatif.key;
    for (let i = 0; i < 100 && S.comparatifs[k].statut !== 'pret'; i++) await attends(20);
    const v = (S.comparatifs[k].data || {variantes: []}).variantes, ph = v.map((x) => x.photo);
    ok('Comparatifs : aucune adresse du réseau local demandée, même au bout d’une redirection ou dans la fiche d’un vendeur', vus.length > 0 && !vus.some((u) => /127\.0\.0\.1|169\.254/.test(u)), JSON.stringify(vus));
    ok('Photos : le choix de Claude est retrouvé quand il retouche le nom (« ® » en moins) ou en donne un autre (par le fichier choisi) ; son « null » reste un refus', photoDemandee === 1 && !!ph[0] && !!ph[1] && ph[2] === '' && fs.existsSync(path.join(D, 'images', ph[0])), JSON.stringify(ph));
    await attends(80);
    ok('Photos : le dossier de travail des photos est effacé après le choix', !fs.readdirSync(path.join(D, 'work')).some((d) => /^photos-/.test(d)), JSON.stringify(fs.readdirSync(path.join(D, 'work')))); }
} catch (e) { ok('exception', false, e && e.stack); }
fs.rmSync(DIR, {recursive: true, force: true});
console.log(results.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + results.length + ' vérifications).');
process.exit(fails ? 1 : 0);
