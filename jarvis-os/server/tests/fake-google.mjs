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
  const msgMeta = (id, th) => ({id, threadId: th, labelIds: ['INBOX', 'CATEGORY_PERSONAL'], snippet: 'L&#39;expert passera mardi', internalDate: '1763290000000',
    payload: {headers: [{name: 'From', value: '"Syndic Dupont" <gestion@syndic.example>'}, {name: 'To', value: 'moi@example.org'}, {name: 'Subject', value: 'RE: Dégât des eaux'}, {name: 'Date', value: 'Sun, 16 Nov 2026 10:00:00 +0100'}]}});
  const full = (m, text) => ({...m, payload: {...m.payload, mimeType: 'multipart/alternative', parts: [{mimeType: 'text/plain', body: {data: b64u(text)}}, {mimeType: 'text/html', body: {data: b64u('<p>html</p>')}}]}});
  const send = (res, st, body) => { res.writeHead(st, {'content-type': 'application/json'}); res.end(st === 204 ? '' : JSON.stringify(body)); };
  const server = http.createServer((req, res) => {
    let raw = ''; req.on('data', (d) => { raw += d; }); req.on('end', () => {
      const u = new URL(req.url, 'http://x'), p = decodeURIComponent(u.pathname), q = Object.fromEntries(u.searchParams), auth = (req.headers.authorization || '').replace('Bearer ', '');
      let body = {}; try { body = raw ? (req.headers['content-type'] || '').includes('json') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw)) : {}; } catch { body = {}; }
      F.calls.push({method: req.method, path: p, q, body, auth});
      if (p === '/token') {
        if (body.client_id !== F.client.id || body.client_secret !== F.client.secret) return send(res, 401, {error: 'invalid_client'});
        if (body.grant_type === 'authorization_code') { if (body.code !== 'CODE-OK' || !/\/api\/google\/callback$/.test(body.redirect_uri)) return send(res, 400, {error: 'invalid_grant', error_description: 'mauvais code'}); const t = 'AT' + (++F.seq); F.valid.add(t); return send(res, 200, {access_token: t, expires_in: 3599, refresh_token: 'RT1', scope: F.scope || 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/drive.readonly', token_type: 'Bearer'}); }
        if (body.grant_type === 'refresh_token') { if (!F.refreshOk || body.refresh_token !== 'RT1') return send(res, 400, {error: 'invalid_grant', error_description: 'Token has been expired or revoked.'}); const t = 'AT' + (++F.seq); F.valid.add(t); return send(res, 200, {access_token: t, expires_in: 3599}); }
        return send(res, 400, {error: 'unsupported_grant_type'});
      }
      if (p === '/revoke') { F.revoked = body.token; return send(res, 200, {}); }
      if (!F.valid.has(auth)) return send(res, 401, {error: {code: 401, message: 'Request had invalid authentication credentials.'}});
      let m;
      if (p === '/gmail/users/me/profile') return send(res, 200, {emailAddress: 'proprietaire@example.org'});
      if ((m = p.match(/^\/sheets\/v4\/spreadsheets\/([^/]+)\/values\/(.+?)(:append)?$/))) {
        if (req.method === 'GET') return send(res, 200, {range: m[2], majorDimension: 'ROWS', values: F.sheet[m[2]] || []});
        if (m[3]) { F.appends = F.appends || []; F.appends.push({range: m[2], values: body.values || []}); const row = 100 + F.appends.length; return send(res, 200, {updates: {updatedRange: m[2].split('!')[0] + '!A' + row + ':H' + row, updatedRows: (body.values || []).length}}); }
        return send(res, 200, {updatedRange: m[2], updatedCells: 1});
      }
      if ((m = p.match(/^\/calendar\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/))) {
        const list = (F.events[m[1]] = F.events[m[1]] || []);
        if (!m[2] && req.method === 'GET') return send(res, 200, {items: list, summary: m[1], timeZone: 'Europe/Paris'});
        if (!m[2] && req.method === 'POST') { if ((body.reminders && body.reminders.overrides || []).some((r) => r.minutes < 0)) return send(res, 400, {error: {code: 400, message: 'Invalid reminder minutes'}}); const ev = {id: 'new' + (++F.seq), status: 'confirmed', ...body}; list.push(ev); return send(res, 200, ev); }
        const ev = list.find((e) => e.id === m[2]); if (!ev) return send(res, 404, {error: {code: 404, message: 'Not Found'}});
        if (req.method === 'GET') return send(res, 200, ev);
        if (req.method === 'PATCH') { Object.assign(ev, body); return send(res, 200, ev); }
        if (req.method === 'DELETE') { list.splice(list.indexOf(ev), 1); return send(res, 204); }
      }
      if (p === '/gmail/users/me/threads') return send(res, 200, /in:sent/.test(q.q || '') ? {resultSizeEstimate: 0} : {threads: [{id: 'th1'}], resultSizeEstimate: 1});
      if ((m = p.match(/^\/gmail\/users\/me\/threads\/([^/]+)$/))) return send(res, 200, {id: m[1], messages: [q.format === 'full' ? full(msgMeta('m1', m[1]), "Bonjour,\nL'expert passera mardi à 10h. Merci de confirmer.") : msgMeta('m1', m[1])]});
      if ((m = p.match(/^\/gmail\/users\/me\/threads\/([^/]+)\/modify$/))) return send(res, 200, {id: m[1]});
      if (p === '/gmail/users/me/drafts' && req.method === 'GET') return send(res, 200, {drafts: [{id: 'r-1', message: {id: 'm9', threadId: 'th9'}}]});
      if ((m = p.match(/^\/gmail\/users\/me\/drafts\/([^/]+)$/))) {
        if (req.method === 'DELETE') return send(res, 204);
        return send(res, 200, {id: m[1], message: full({id: 'm9', threadId: 'th9', internalDate: '1763290000000', payload: {headers: [{name: 'To', value: 'Syndic <gestion@syndic.example>, autre@example.org'}, {name: 'Cc', value: 'copie@example.org'}, {name: 'Subject', value: 'Relance syndic'}]}}, 'Bonjour,\nJe me permets de vous relancer.')});
      }
      if (p === '/gmail/users/me/drafts/send') return send(res, 200, {id: 'sent1', threadId: 'th9', labelIds: ['SENT']});
      if (p === '/gmail/users/me/messages/send') return send(res, 200, {id: 'sent2', threadId: 'th10', labelIds: ['SENT']});
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
