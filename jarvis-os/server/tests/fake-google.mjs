/* Faux Google pour le banc : jetons OAuth, Sheets, Agenda, Gmail. Aucune donnée réelle, aucun réseau. */
import http from 'node:http';

const b64u = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function startFakeGoogle() {
  const F = {calls: [], valid: new Set(), refreshOk: true, client: {id: 'test-123.apps.googleusercontent.com', secret: 'secret-de-test-0123'}, seq: 0,
    sheet: {"'À toi'!A3:D300": [['Sujet', 'Bot'], ['Relance syndic', 'Iris']]},
    events: {primary: [{id: 'ev1', summary: 'Rendez-vous', status: 'confirmed', colorId: '11', start: {dateTime: '2026-11-20T14:30:00+01:00'}, end: {dateTime: '2026-11-20T15:30:00+01:00'}}]}};
  /* Drive : un petit arbre fictif (Papiers dans RD Assistant, Papiers privés à la racine, un dossier étranger), pages de 2 pour exercer la pagination */
  const DF = 'application/vnd.google-apps.folder', dn = (id, name, parent, mimeType) => ({id, name, parents: [parent], mimeType: mimeType || DF, modifiedTime: '2025-01-02T10:00:00Z', size: mimeType === DF || !mimeType ? undefined : '1234'});
  F.drive = [dn('rda', 'RD Assistant', 'root'), dn('pap', 'Papiers', 'rda'), dn('f-lui', 'Lui', 'pap'), dn('f-id', 'Identité et séjour', 'f-lui'), dn('f-log', 'Logement', 'pap'), dn('f-loc', 'Locations', 'f-log'),
    dn('d1', 'Passeport - Identité.pdf', 'f-id', 'application/pdf'), dn('d2', "Titre de séjour l'ancien.jpg", 'f-id', 'image/jpeg'), dn('d3', 'Quittance 2019.pdf', 'f-loc', 'application/pdf'), dn('d4', 'Note en vrac.pdf', 'pap', 'application/pdf'),
    dn('priv', 'Papiers privés', 'root'), dn('f-imp', 'Impôts', 'priv'), dn('d5', 'Avis 2025.pdf', 'f-imp', 'application/pdf'),
    dn('autre', 'Autre dossier', 'root'), dn('d6', 'Ne doit pas sortir.pdf', 'autre', 'application/pdf'), {...dn('d7', 'Supprimé.pdf', 'f-id', 'application/pdf'), trashed: true}];
  F.drive.find((f) => f.id === 'd3').text = 'Quittance de loyer, résidence Les Tilleuls, période de mai';
  F.drive.find((f) => f.id === 'd6').text = 'quittance de loyer hors du dossier Papiers';
  F.drive.find((f) => f.id === 'd5').text = 'avis d’imposition, quittance';
  F.drivePage = 2;
  /* 0.37.0 : son Profil (Google Doc dans RD Assistant), exporté en HTML ; la partie Finances ne doit jamais partir à Claude */
  F.drive.push({id: 'profil1', name: 'Profil', mimeType: 'application/vnd.google-apps.document', parents: ['rda'], modifiedTime: '2026-11-20T09:00:00.000Z',
    html: '<html><head><style>p { color: #000 }</style></head><body><h1>Profil</h1><h2>Voyages</h2><p>Préfère les vols directs et le hublot.</p><h2>Finances</h2><p>Banque principale et plafond de dépenses.</p><h2>Repas</h2><ul><li>Végétarien le lundi</li></ul></body></html>'});
  const msgMeta = (id, th) => ({id, threadId: th, labelIds: ['INBOX', 'CATEGORY_PERSONAL'], snippet: 'L&#39;expert passera mardi', internalDate: '1763290000000',
    payload: {headers: [{name: 'From', value: '"Syndic Dupont" <gestion@syndic.example>'}, {name: 'To', value: 'moi@example.org'}, {name: 'Subject', value: 'RE: Dégât des eaux'}, {name: 'Date', value: 'Sun, 16 Nov 2026 10:00:00 +0100'}, {name: 'Message-ID', value: '<m1@syndic.example>'}]}});
  const full = (m, text) => ({...m, payload: {...m.payload, mimeType: 'multipart/alternative', parts: [{mimeType: 'text/plain', body: {data: b64u(text)}}, {mimeType: 'text/html', body: {data: b64u('<p>html</p>')}}]}});
  /* Radar (21/11/2026) : trois factures mensuelles inventées (les deux mois d'avant et celui-ci), pour la lecture de départ des mails */
  F.radar = {};
  { const n = new Date(); for (const k of [2, 1, 0]) { const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - k, 1, 8)), mm = String(d.getUTCMonth() + 1).padStart(2, '0'), id = 'rd' + k;
      F.radar['t' + id] = {id: 't' + id, threadId: 't' + id, labelIds: ['INBOX', 'CATEGORY_UPDATES'], snippet: 'Votre facture', internalDate: String(d.getTime()), text: 'Bonjour,\nVotre facture est disponible.\nMontant TTC : 48,20 €\nIl sera prélevé le 12/' + mm + '/' + d.getUTCFullYear() + '.',
        payload: {headers: [{name: 'From', value: '"Énergie Exemple" <facturation@energie-exemple.fr>'}, {name: 'To', value: 'moi@example.org'}, {name: 'Subject', value: 'Votre facture du mois'}, {name: 'Date', value: d.toUTCString()}]}}; } }
  /* 0.68.0 : un paiement en 4 fois inventé (4 × 20 € : il y a 10 jours, puis tous les 30 jours), pour le panneau « En plusieurs fois » */
  { const j = (k) => new Date(Date.now() + k * 864e5), fr = (x) => String(x.getUTCDate()).padStart(2, '0') + '/' + String(x.getUTCMonth() + 1).padStart(2, '0') + '/' + x.getUTCFullYear(), d0 = j(-10);
    F.radar.tpl4 = {id: 'tpl4', threadId: 'tpl4', labelIds: ['INBOX', 'CATEGORY_UPDATES'], snippet: 'Votre plan de paiements', internalDate: String(d0.getTime()),
      text: 'Voici votre nouveau plan de paiements Paiement en 4X.\nVotre achat de 80,00 € EUR auprès de BOUTIQUE EXEMPLE a été divisé en 4 paiements plus petits.\n' + [-10, 20, 50, 80].map((k) => '* 20,00 € EUR le ' + fr(j(k))).join(' ') + '\n',
      payload: {headers: [{name: 'From', value: '"PayPal" <service@paypal.fr>'}, {name: 'To', value: 'moi@example.org'}, {name: 'Subject', value: 'Votre plan de paiements Paiement en 4X est prêt'}, {name: 'Date', value: d0.toUTCString()}]}}; }
  /* 0.71.0 (exécutants reliés) : des onglets de Pilotage vivants, quand le banc les pose dans F.onglets ({nom: [lignes]}) : une plage
     « 'Onglet'!A1:Z50 » y est lue, une ligne ajoutée s'y ajoute, une case écrite s'y écrit. Sans F.onglets : les plages figées de F.sheet. */
  F.onglets = null;
  const colN = (c) => [...c].reduce((n, x) => n * 26 + x.charCodeAt(0) - 64, 0) - 1;
  const plage = (r) => { if (!String(r).includes('!')) return {nom: String(r).replace(/^'(.*)'$/, '$1').replace(/''/g, "'"), c1: 0, l1: 1, c2: 1e6, l2: 1e6};   /* 0.88.0 : un onglet entier (import de Pilotage) */
    const m = String(r).match(/^'?(.+?)'?!([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/); return m ? {nom: m[1].replace(/''/g, "'"), c1: colN(m[2]), l1: +(m[3] || 1), c2: m[4] ? colN(m[4]) : colN(m[2]), l2: m[5] ? +m[5] : m[4] ? 1e6 : +(m[3] || 1)} : null; };
  /* ses agendas (0.71.0) : le principal porte son adresse, comme chez Google */
  F.calendriers = [{id: 'proprietaire@example.org', summary: 'proprietaire@example.org', primary: true, accessRole: 'owner'}, {id: 'ech@group.calendar.example', summary: 'Échéances', accessRole: 'owner'},
    {id: 'pres@group.calendar.example', summary: 'Présence', accessRole: 'owner'}, {id: 'fr.french#holiday@group.v.calendar.example', summary: 'Holidays in France', accessRole: 'reader'}];
  /* 0.88.0 : les fichiers créés par JARVIS dans Drive (copies chiffrées de Pilotage) ; refusDriveFile : la portée drive.file pas accordée ;
     refusParent : le dossier RD Assistant hors de portée (le dossier des copies va à la racine) ; F.formules : les formules du classeur */
  F.sav = []; F.savSeq = 0; F.refusDriveFile = false; F.refusParent = false; F.formules = {};
  F.brouillons = []; F.fils = {};   /* brouillons créés (jamais envoyés) ; fils Gmail posés par le banc, au format de l'API */
  const send = (res, st, body) => { res.writeHead(st, {'content-type': 'application/json'}); res.end(st === 204 ? '' : JSON.stringify(body)); };
  const server = http.createServer((req, res) => {
    let raw = ''; req.on('data', (d) => { raw += d; }); req.on('end', () => {
      const u = new URL(req.url, 'http://x'), p = decodeURIComponent(u.pathname), q = Object.fromEntries(u.searchParams), auth = (req.headers.authorization || '').replace('Bearer ', '');
      let body = {}; try { body = raw ? (req.headers['content-type'] || '').includes('json') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw)) : {}; } catch { body = {}; }
      F.calls.push({method: req.method, path: p, q, body, auth});
      if (p === '/token') {
        if (body.client_id !== F.client.id || body.client_secret !== F.client.secret) return send(res, 401, {error: 'invalid_client'});
        if (body.grant_type === 'authorization_code') { if (body.code !== 'CODE-OK' || !/\/api\/google\/callback$/.test(body.redirect_uri)) return send(res, 400, {error: 'invalid_grant', error_description: 'mauvais code'}); const t = 'AT' + (++F.seq); F.valid.add(t); return send(res, 200, {access_token: t, expires_in: 3599, refresh_token: 'RT1', scope: F.scope || 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/drive.readonly', token_type: 'Bearer'}); }
        if (body.grant_type === 'refresh_token') { if (!F.refreshOk || body.refresh_token !== 'RT1') return send(res, 400, {error: 'invalid_grant', error_description: 'Token has been expired or revoked.'}); const t = 'AT' + (++F.seq); F.valid.add(t); return send(res, 200, {access_token: t, expires_in: 3599, ...(F.scopeRefresh ? {scope: F.scopeRefresh} : {})}); }
        return send(res, 400, {error: 'unsupported_grant_type'});
      }
      if (p === '/revoke') { F.revoked = body.token; return send(res, 200, {}); }
      if (!F.valid.has(auth)) return send(res, 401, {error: {code: 401, message: 'Request had invalid authentication credentials.'}});
      let m;
      if (p === '/gmail/users/me/profile') return send(res, 200, {emailAddress: 'proprietaire@example.org'});
      /* 0.88.0 : le classeur lui-même (import de Pilotage) : ses onglets (ceux de F.onglets), et ses formules avec includeGridData */
      if ((m = p.match(/^\/sheets\/v4\/spreadsheets\/([^/]+)$/)) && req.method === 'GET') {
        const noms = Object.keys(F.onglets || {});
        if (!q.includeGridData) return send(res, 200, {sheets: noms.map((n) => ({properties: {title: n}}))});
        return send(res, 200, {sheets: noms.map((n) => { const rowData = [];
          for (const [a1, f] of (F.formules || {})[n] || []) { const x = a1.match(/^([A-Z]+)(\d+)$/), r = +x[2] - 1, c = colN(x[1]); while (rowData.length <= r) rowData.push({}); const rd = rowData[r]; rd.values = rd.values || []; while (rd.values.length <= c) rd.values.push({}); rd.values[c] = {userEnteredValue: {formulaValue: f}}; }
          return {properties: {title: n}, data: [{rowData}]}; })});
      }
      /* 0.88.0 : les copies chiffrées de Pilotage (fichiers créés par JARVIS, marqués appProperties « jarvis ») */
      if (p === '/drive/files' && req.method === 'GET' && /appProperties has/.test(q.q || '')) {
        const v = (q.q.match(/value='([^']+)'/) || [])[1], par = (q.q.match(/'([^']+)' in parents/) || [])[1];
        const files = F.sav.filter((f) => !f.trashed && (f.appProperties || {}).jarvis === v && (!par || f.parents.includes(par))).sort((a, b) => a.name.localeCompare(b.name));
        return send(res, 200, {files: files.map((f) => ({id: f.id, name: f.name, parents: f.parents, createdTime: f.createdTime, size: String(f.octets ? f.octets.length : 0)}))});
      }
      if (p === '/drive/files' && req.method === 'POST') {
        if (F.refusDriveFile) return send(res, 403, {error: {code: 403, message: 'Request had insufficient authentication scopes.'}});
        if (F.refusParent && (body.parents || []).length) return send(res, 404, {error: {code: 404, message: 'File not found: ' + body.parents[0]}});
        const f = {id: 'sav' + (++F.savSeq) + 'x', name: body.name, mimeType: body.mimeType, parents: body.parents || ['root'], appProperties: body.appProperties || {}, createdTime: new Date().toISOString()}; F.sav.push(f);
        return send(res, 200, {id: f.id, parents: f.parents});
      }
      if (p === '/upload/drive/files' && req.method === 'POST') {
        if (F.refusDriveFile) return send(res, 403, {error: {code: 403, message: 'Request had insufficient authentication scopes.'}});
        const b = ((req.headers['content-type'] || '').match(/boundary=(.+)$/) || [])[1] || '', parts = raw.split('--' + b).slice(1, -1).map((x) => x.replace(/^\r\n/, '').replace(/\r\n$/, '')), corps = (x) => x.slice(x.indexOf('\r\n\r\n') + 4);
        const meta = JSON.parse(corps(parts[0])), f = {id: 'sav' + (++F.savSeq) + 'x', name: meta.name, mimeType: meta.mimeType, parents: meta.parents, appProperties: meta.appProperties, createdTime: new Date().toISOString(), octets: Buffer.from(corps(parts[1]), 'utf8'), type: req.headers['content-type']};
        F.sav.push(f); return send(res, 200, {id: f.id, name: f.name});
      }
      if ((m = p.match(/^\/drive\/files\/([^/]+)$/)) && F.sav.some((f) => f.id === m[1])) {
        const f = F.sav.find((x) => x.id === m[1]);
        if (req.method === 'PATCH') { Object.assign(f, body); return send(res, 200, {id: f.id, trashed: !!f.trashed}); }
        if (q.alt === 'media') { res.writeHead(200, {'content-type': 'application/octet-stream'}); return res.end(f.octets || Buffer.alloc(0)); }
        return send(res, 200, {id: f.id, name: f.name});
      }
      if ((m = p.match(/^\/sheets\/v4\/spreadsheets\/([^/]+)\/values\/(.+?)(:append)?$/)) && F.onglets && plage(m[2]) && F.onglets[plage(m[2]).nom]) {
        const g = plage(m[2]), T = F.onglets[g.nom];
        if (req.method === 'GET') { const v = T.slice(g.l1 - 1, g.l2).map((r) => (r || []).slice(g.c1, g.c2 + 1)); while (v.length && !v[v.length - 1].some((x) => String(x ?? '') !== '')) v.pop(); return send(res, 200, {range: m[2], majorDimension: 'ROWS', values: v}); }
        if (m[3]) { for (const r of body.values || []) T.push(r); return send(res, 200, {updates: {updatedRange: g.nom + '!A' + T.length + ':H' + T.length, updatedRows: (body.values || []).length}}); }
        (body.values || []).forEach((r, i) => { const l = g.l1 - 1 + i; while (T.length <= l) T.push([]); r.forEach((x, k) => { while (T[l].length < g.c1 + k) T[l].push(''); T[l][g.c1 + k] = x; }); });
        return send(res, 200, {updatedRange: m[2], updatedCells: 1});
      }
      if ((m = p.match(/^\/sheets\/v4\/spreadsheets\/([^/]+)\/values\/(.+?)(:append)?$/))) {
        if (req.method === 'GET') return send(res, 200, {range: m[2], majorDimension: 'ROWS', values: F.sheet[m[2]] || []});
        if (m[3]) { F.appends = F.appends || []; F.appends.push({range: m[2], values: body.values || []}); const row = 100 + F.appends.length; return send(res, 200, {updates: {updatedRange: m[2].split('!')[0] + '!A' + row + ':H' + row, updatedRows: (body.values || []).length}}); }
        return send(res, 200, {updatedRange: m[2], updatedCells: 1});
      }
      if (p === '/calendar/users/me/calendarList') return send(res, 200, {items: F.calendriers});
      if ((m = p.match(/^\/calendar\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/))) {
        const list = (F.events[m[1]] = F.events[m[1]] || []);
        if (!m[2] && req.method === 'GET') return send(res, 200, {items: list, summary: m[1], timeZone: 'Europe/Paris'});
        if (!m[2] && req.method === 'POST') { if ((body.reminders && body.reminders.overrides || []).some((r) => r.minutes < 0)) return send(res, 400, {error: {code: 400, message: 'Invalid reminder minutes'}}); const ev = {id: 'new' + (++F.seq), status: 'confirmed', ...body}; list.push(ev); return send(res, 200, ev); }
        const ev = list.find((e) => e.id === m[2]); if (!ev) return send(res, 404, {error: {code: 404, message: 'Not Found'}});
        if (req.method === 'GET') return send(res, 200, ev);
        if (req.method === 'PATCH') { Object.assign(ev, body); return send(res, 200, ev); }
        if (req.method === 'DELETE') { list.splice(list.indexOf(ev), 1); return send(res, 204); }
      }
      if (p === '/gmail/users/me/threads' && /\(facture OR /.test(q.q || '')) return send(res, 200, {threads: Object.keys(F.radar).map((id) => ({id})), resultSizeEstimate: Object.keys(F.radar).length});   /* la requête du Radar */
      if (p === '/gmail/users/me/threads' && /"JARVIS Voix" OR \(subject:\(budget OR budgétaire\) Cloud\)/.test(q.q || '')) return send(res, 200, (F.budget || []).length ? {threads: F.budget.map((id) => ({id})), resultSizeEstimate: F.budget.length} : {resultSizeEstimate: 0});   /* 0.48.0 : alertes de budget de Google Cloud */
      if (p === '/gmail/users/me/threads') return send(res, 200, /in:sent/.test(q.q || '') ? {resultSizeEstimate: 0} : {threads: [{id: 'th1'}], resultSizeEstimate: 1});
      if ((m = p.match(/^\/gmail\/users\/me\/threads\/([^/]+)$/)) && F.fils[m[1]]) return send(res, 200, {id: m[1], messages: F.fils[m[1]]});
      if ((m = p.match(/^\/gmail\/users\/me\/threads\/([^/]+)$/)) && F.radar[m[1]]) { const r = F.radar[m[1]], {text, ...meta} = r, msg = {...meta, id: 'm' + m[1]}; return send(res, 200, {id: m[1], messages: [q.format === 'full' ? full(msg, text) : msg]}); }
      if ((m = p.match(/^\/gmail\/users\/me\/threads\/([^/]+)$/))) return send(res, 200, {id: m[1], messages: [q.format === 'full' ? full(msgMeta('m1', m[1]), "Bonjour,\nL'expert passera mardi à 10h. Merci de confirmer.") : msgMeta('m1', m[1])]});
      if ((m = p.match(/^\/gmail\/users\/me\/threads\/([^/]+)\/modify$/))) return send(res, 200, {id: m[1]});
      if (p === '/gmail/users/me/drafts' && req.method === 'POST') { const n = F.brouillons.push({raw: (body.message || {}).raw || '', threadId: (body.message || {}).threadId || ''}); return send(res, 200, {id: 'r-neuf' + n, message: {id: 'mb' + n, threadId: (body.message || {}).threadId || 'tb' + n, labelIds: ['DRAFT']}}); }
      if (p === '/gmail/users/me/drafts' && req.method === 'GET') return send(res, 200, {drafts: [{id: 'r-1', message: {id: 'm9', threadId: 'th9'}}]});
      if ((m = p.match(/^\/gmail\/users\/me\/drafts\/([^/]+)$/))) {
        if (req.method === 'DELETE') return send(res, 204);
        if (req.method === 'PUT') { F.brouillonsMaj = (F.brouillonsMaj || []).concat([{id: m[1], raw: (body.message || {}).raw || '', threadId: (body.message || {}).threadId || ''}]); return send(res, 200, {id: m[1], message: {id: 'mb-maj', threadId: (body.message || {}).threadId || '', labelIds: ['DRAFT']}}); }
        if (m[1] === 'r-pj') return send(res, 200, {id: m[1], message: {id: 'm8', threadId: 'th8', internalDate: '1763290000000', payload: {mimeType: 'multipart/mixed', headers: [{name: 'To', value: 'x@example.org'}, {name: 'Subject', value: 'Avec pièce'}], parts: [{mimeType: 'text/plain', body: {data: b64u('Texte')}}, {mimeType: 'application/pdf', filename: 'devis.pdf', body: {attachmentId: 'a1', size: 1000}}]}}});
        return send(res, 200, {id: m[1], message: full({id: 'm9', threadId: 'th9', internalDate: '1763290000000', payload: {headers: [{name: 'To', value: 'Syndic <gestion@syndic.example>, autre@example.org'}, {name: 'Cc', value: 'copie@example.org'}, {name: 'Subject', value: 'Relance syndic'}, {name: 'In-Reply-To', value: '<prec@syndic.example>'}, {name: 'References', value: '<debut@syndic.example> <prec@syndic.example>'}]}}, 'Bonjour,\nJe me permets de vous relancer.')});
      }
      if (p === '/gmail/users/me/drafts/send') return send(res, 200, {id: 'sent1', threadId: 'th9', labelIds: ['SENT']});
      if (p === '/gmail/users/me/messages/send') return send(res, 200, {id: 'sent2', threadId: 'th10', labelIds: ['SENT']});
      if ((m = p.match(/^\/drive\/files\/([^/]+)\/export$/)) && req.method === 'GET') { const f = F.drive.find((x) => x.id === m[1]); if (!f || !f.html) return send(res, 404, {error: {code: 404, message: 'pas de document'}}); res.writeHead(200, {'content-type': 'text/html'}); return res.end(f.html); }
      /* 0.85.0 : un PDF du Drive par son identifiant (métadonnées, puis contenu avec alt=media) */
      if ((m = p.match(/^\/drive\/files\/([^/]+)$/)) && req.method === 'GET') {
        const PDFS = {'pdf-taxe-0001': {name: 'Avis inventé.pdf', mimeType: 'application/pdf', buf: Buffer.from('%PDF-1.4\n% avis inventé du banc\n%%EOF\n')}, 'texte-00001': {name: 'note.txt', mimeType: 'text/plain', buf: Buffer.from('pas un pdf')}};
        const f = PDFS[m[1]]; if (!f) return send(res, 404, {error: {code: 404, message: 'File not found'}});
        if (q.alt === 'media') { res.writeHead(200, {'content-type': f.mimeType}); return res.end(f.buf); }
        return send(res, 200, {id: m[1], name: f.name, mimeType: f.mimeType, size: String(f.buf.length), modifiedTime: '2026-11-25T20:45:05Z', trashed: false});
      }
      if (p === '/drive/files' && req.method === 'GET') {
        /* sous-ensemble de la syntaxe q de Drive : name = '…', '…' in parents (plusieurs, ou), mimeType = / != '…', trashed = false */
        const qq = q.q || '', un = (s) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
        const parents = [...qq.matchAll(/'((?:[^'\\]|\\.)*)' in parents/g)].map((x) => un(x[1])), nm = qq.match(/name = '((?:[^'\\]|\\.)*)'/), mt = qq.match(/mimeType (!?=) '([^']+)'/);
        const ft = qq.match(/fullText contains '((?:[^'\\]|\\.)*)'/), norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        let rows = F.drive.filter((f) => !f.trashed && (!ft || norm(f.name + ' ' + (f.text || '')).includes(norm(un(ft[1])))) && (!parents.length || f.parents.some((x) => parents.includes(x))) && (!nm || f.name === un(nm[1])) && (!mt || (mt[1] === '=' ? f.mimeType === mt[2] : f.mimeType !== mt[2])));
        const start = +(q.pageToken || 0), n = Math.min(+q.pageSize || 100, F.drivePage);
        const files = rows.slice(start, start + n).map((f) => ({id: f.id, name: f.name, mimeType: f.mimeType, parents: f.parents, modifiedTime: f.modifiedTime, size: f.size, webViewLink: 'https://drive.example/' + f.id}));
        return send(res, 200, start + n < rows.length ? {files, nextPageToken: String(start + n)} : {files});
      }
      send(res, 404, {error: {code: 404, message: 'inconnu ' + p}});
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => { F.url = 'http://127.0.0.1:' + server.address().port; F.close = () => server.close(); resolve(F); }));
}
