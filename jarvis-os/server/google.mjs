/* JARVIS OS — accès Google direct (décidé le 16/11/2026) : le serveur lit et écrit Pilotage, l'agenda et Gmail
   avec les API officielles de Google, sans Claude et sans consommer l'abonnement.
   L'accès est créé une fois par le propriétaire (projet Google Cloud, identifiant OAuth « Application Web ») et collé
   par lui dans JARVIS : l'identifiant et le secret restent sur son serveur (fichier d'état, droits 600), jamais renvoyés.
   `tool(server, tool, input)` reçoit exactement les appels de la page Jarvis (outils des connecteurs claude.ai)
   et rend des réponses de la même forme, pour que la page fonctionne sans changement. */
import crypto from 'node:crypto';

const FAKE = process.env.JARVIS_GOOGLE_FAKE || '';   /* banc d'essai : toutes les adresses Google vers un faux serveur */
const URLS = FAKE ? {auth: FAKE + '/auth', token: FAKE + '/token', revoke: FAKE + '/revoke', sheets: FAKE + '/sheets', cal: FAKE + '/calendar', gmail: FAKE + '/gmail', drive: FAKE + '/drive'}
  : {auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', revoke: 'https://oauth2.googleapis.com/revoke',
    sheets: 'https://sheets.googleapis.com', cal: 'https://www.googleapis.com/calendar/v3', gmail: 'https://gmail.googleapis.com/gmail/v1', drive: 'https://www.googleapis.com/drive/v3'};
export const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/drive.readonly'];
const TZ = 'Europe/Paris';

class ToolError extends Error { constructor(code, message, status) { super(message); this.code = code; this.status = status || 0; } }

/* ---------- heures : la page envoie des heures locales sans décalage (« 2026-11-16T00:00:00 ») ---------- */
function parisOffset(y, mo, d, h, mi) {
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi) - 3600e3);
  const z = new Intl.DateTimeFormat('en-GB', {timeZone: TZ, timeZoneName: 'longOffset'}).formatToParts(guess).find((x) => x.type === 'timeZoneName');
  const v = z ? z.value.replace('GMT', '') : '';
  return v || '+00:00';
}
export function rfc(local) {
  const s = String(local || '');
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) throw new ToolError('tool_error', 'heure illisible : ' + s);
  const [y, mo, d, h, mi, se] = [+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)];
  return `${m[1]}-${m[2]}-${m[3]}T${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(se).padStart(2, '0')}${parisOffset(y, mo, d, h, mi)}`;
}

/* ---------- Gmail : en-têtes, corps, forme des connecteurs claude.ai ---------- */
const hdr = (m, name) => { const x = ((m.payload && m.payload.headers) || []).find((h) => h.name.toLowerCase() === name.toLowerCase()); return x ? x.value : ''; };
function addrs(v) {
  return String(v || '').split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = x.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    return m ? {displayName: m[1].trim(), emailAddress: m[2].trim()} : {displayName: '', emailAddress: x.replace(/[<>]/g, '')};
  });
}
const b64d = (s) => Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const b64u = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/* 0.51.0 : le texte d'un mail. La partie texte d'abord ; mais quand elle ne fait que renvoyer au HTML (« votre messagerie ne prend pas en
   charge le format HTML »), le HTML, sans ses styles, avec ses entités (« &euro; ») et une case de tableau par « | » (un échéancier reste lisible) */
const ENT = {nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", euro: '€', rsquo: '’', lsquo: '‘', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', deg: '°',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â', ccedil: 'ç', ocirc: 'ô', ucirc: 'û', ugrave: 'ù', icirc: 'î', iuml: 'ï', Eacute: 'É', Egrave: 'È', Agrave: 'À'};
const point = (n) => { try { return String.fromCodePoint(n); } catch { return ' '; } };
export const sansBalises = (html) => String(html || '').replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, '\n').replace(/<\/t[dh]>/gi, ' | ').replace(/<[^>]+>/g, '')
  .replace(/&#x([0-9a-f]+);/gi, (_, x) => point(parseInt(x, 16))).replace(/&#(\d+);/g, (_, d) => point(+d)).replace(/&([a-z]+);/gi, (m, n) => ENT[n] || ENT[n.toLowerCase()] || m)
  .replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n[ \n]*/g, '\n').trim();
function partOf(part, type) {
  if (!part) return '';
  if (part.mimeType === type && part.body && part.body.data) return b64d(part.body.data);
  for (const p of part.parts || []) { const t = partOf(p, type); if (t) return t; }
  return '';
}
/* 0.52.0 : les pièces jointes d'un mail (nom, type, taille, identifiant pour les lire) ; le Radar lit les PDF des factures sans montant */
function piecesDe(part, out = []) {
  if (!part || out.length >= 10) return out;
  if (part.filename && part.body && (part.body.attachmentId || part.body.data)) out.push({filename: String(part.filename).slice(0, 200), mimeType: part.mimeType || '', size: +part.body.size || 0, ...(part.body.attachmentId ? {attachmentId: part.body.attachmentId} : {data: part.body.data})});
  for (const p of part.parts || []) piecesDe(p, out);
  return out;
}
export function textOf(part) {
  const t = partOf(part, 'text/plain');
  const bouchon = t.trim().length < 400 && /ne (prend|supporte) pas (en charge )?(le format |les messages |les e-?mails |l.affichage )?html|n.affiche pas (le format|les messages) html|(does not|doesn.t|cannot|can.t) (support|display) html|(view|voir|afficher|consulter|lire) (this|ce|le|cet) (e-?mail|message|courriel|mail) (in|dans) (your|votre|un) (web )?(browser|navigateur)/i.test(t);
  if (t && !bouchon) return t;
  const h = partOf(part, 'text/html');
  return h ? sansBalises(h) : t;
}
function mailMsg(m, withBody) {
  const from = addrs(hdr(m, 'From'))[0] || {displayName: '', emailAddress: ''};
  const at = +m.internalDate || Date.parse(hdr(m, 'Date')) || 0;
  const o = {id: m.id, threadId: m.threadId, sender: from.emailAddress, addressDisplayNames: [from], toRecipients: addrs(hdr(m, 'To')).map((a) => a.emailAddress),
    subject: hdr(m, 'Subject'), snippet: m.snippet || '', date: new Date(at).toISOString(), internalDate: String(at), labelIds: m.labelIds || [], viewUrl: 'https://mail.google.com/mail/#all/' + m.threadId};
  if (withBody) { o.plaintextBody = textOf(m.payload); o.attachments = piecesDe(m.payload); }
  return o;
}
const encWord = (s) => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?=';
function rawMail({to, cc, subject, body}) {
  const L = ['To: ' + [].concat(to || []).join(', ')];
  if (cc && [].concat(cc).length) L.push('Cc: ' + [].concat(cc).join(', '));
  L.push('Subject: ' + encWord(String(subject || '')), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', Buffer.from(String(body || ''), 'utf8').toString('base64'));
  return b64u(L.join('\r\n'));
}
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({length: Math.min(n, items.length)}, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; }

export function createGoogle({S, save, log = () => {}}) {
  S.google = S.google || {};
  const G = S.google;
  const pending = new Map();   /* state OAuth → {redirect, at} : 10 minutes, usage unique */
  let access = {token: '', exp: 0};

  const status = (redirect) => ({configured: !!(G.clientId && G.clientSecret), linked: !!G.refresh, account: G.account || '', linkedAt: G.linkedAt || 0,
    clientId: G.clientId ? G.clientId.slice(0, 12) + '…' : '', redirect, scopes: SCOPES});
  function configure(b) {
    const id = String(b.clientId || '').trim(), sec = String(b.clientSecret || '').trim();
    if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(id)) return {ok: false, error: "L'identifiant client doit finir par .apps.googleusercontent.com."};
    if (sec.length < 10 || /\s/.test(sec)) return {ok: false, error: 'Le code secret du client semble incomplet.'};
    if (G.clientId !== id) { G.refresh = ''; G.account = ''; access = {token: '', exp: 0}; }
    G.clientId = id; G.clientSecret = sec; save();
    return {ok: true};
  }
  function link(redirect) {
    if (!G.clientId || !G.clientSecret) return {ok: false, error: "Colle d'abord l'identifiant et le code secret du client."};
    const state = crypto.randomBytes(24).toString('hex');
    for (const [k, v] of pending) if (Date.now() - v.at > 600e3) pending.delete(k);
    pending.set(state, {redirect, at: Date.now()});
    const q = new URLSearchParams({client_id: G.clientId, redirect_uri: redirect, response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state});
    return {ok: true, url: URLS.auth + '?' + q};
  }
  async function tokenCall(params) {
    const r = await fetch(URLS.token, {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams(params)});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new ToolError(j.error === 'invalid_grant' ? 'needs_reauth' : 'tool_error', j.error_description || j.error || 'HTTP ' + r.status, r.status);
    return j;
  }
  async function callback(q) {
    const st = pending.get(q.get('state') || '');
    if (!st || Date.now() - st.at > 600e3) return {ok: false, error: 'Lien expiré ou déjà utilisé : recommence « Connecter Google » dans JARVIS.'};
    pending.delete(q.get('state'));
    if (q.get('error')) return {ok: false, error: q.get('error') === 'access_denied' ? 'Accès refusé dans Google.' : 'Google a répondu : ' + q.get('error')};
    try {
      const j = await tokenCall({code: q.get('code') || '', client_id: G.clientId, client_secret: G.clientSecret, redirect_uri: st.redirect, grant_type: 'authorization_code'});
      if (!j.refresh_token) return {ok: false, error: "Google n'a pas donné d'accès durable : retire JARVIS dans ton compte Google (Sécurité, accès tiers), puis recommence."};
      const granted = String(j.scope || '').split(/\s+/), missing = SCOPES.filter((s) => !granted.includes(s));
      G.refresh = j.refresh_token; G.linkedAt = Date.now(); access = {token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60e3};
      try { const p = await api('GET', URLS.gmail + '/users/me/profile'); G.account = p.emailAddress || ''; } catch { G.account = ''; }
      G.missing = missing; save();
      return {ok: true, account: G.account, missing};
    } catch (e) { return {ok: false, error: 'Échange avec Google refusé : ' + e.message}; }
  }
  async function unlink() {
    const t = G.refresh;
    G.refresh = ''; G.account = ''; G.linkedAt = 0; access = {token: '', exp: 0}; save();
    if (t) { try { await fetch(URLS.revoke, {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({token: t})}); } catch { /* rien */ } }
    return {ok: true};
  }
  async function token() {
    if (!G.refresh) throw new ToolError('server_not_connected', 'Google n’est pas relié à JARVIS (Réglages, Connecter Google).');
    if (access.token && Date.now() < access.exp) return access.token;
    try {
      const j = await tokenCall({client_id: G.clientId, client_secret: G.clientSecret, refresh_token: G.refresh, grant_type: 'refresh_token'});
      access = {token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60e3};
      return access.token;
    } catch (e) { if (e.code === 'needs_reauth') { G.refresh = ''; save(); } throw e; }
  }
  async function api(method, url, body, retry = true) {
    const t = await token();
    const r = await fetch(url, {method, headers: {authorization: 'Bearer ' + t, ...(body ? {'content-type': 'application/json'} : {})}, body: body ? JSON.stringify(body) : undefined});
    if (r.status === 401 && retry) { access = {token: '', exp: 0}; return api(method, url, body, false); }
    if (r.status === 204) return {};
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (j.error && (j.error.message || j.error)) || 'HTTP ' + r.status;
      const code = r.status === 401 ? 'needs_reauth' : r.status === 403 && /scope|insufficient/i.test(JSON.stringify(j)) ? 'not_granted' : 'tool_error';
      throw new ToolError(code, String(msg), r.status);
    }
    return j;
  }
  const enc = encodeURIComponent;
  /* 0.37.0 : une réponse en texte (l'export d'un Google Doc) */
  async function apiText(url, retry = true) {
    const t = await token();
    const r = await fetch(url, {headers: {authorization: 'Bearer ' + t}});
    if (r.status === 401 && retry) { access = {token: '', exp: 0}; return apiText(url, false); }
    const tx = await r.text();
    if (!r.ok) throw new ToolError(r.status === 401 ? 'needs_reauth' : 'tool_error', 'HTTP ' + r.status, r.status);
    return tx;
  }

  /* ---------- les outils de la page, un par un ---------- */
  const SEARCH_CACHE = new Map();
  const T = {
    'Google Sheets': {
      get_values: async (i) => { const j = await api('GET', `${URLS.sheets}/v4/spreadsheets/${enc(i.spreadsheetId)}/values/${enc(i.range)}?valueRenderOption=FORMATTED_VALUE`); return {range: j.range || i.range, values: j.values || []}; },
      append_values: (i) => api('POST', `${URLS.sheets}/v4/spreadsheets/${enc(i.spreadsheetId)}/values/${enc(i.range)}:append?valueInputOption=${enc(i.valueInputOption || 'USER_ENTERED')}&insertDataOption=INSERT_ROWS`, {values: i.values}),
      update_values: (i) => api('PUT', `${URLS.sheets}/v4/spreadsheets/${enc(i.spreadsheetId)}/values/${enc(i.range)}?valueInputOption=${enc(i.valueInputOption || 'USER_ENTERED')}`, {range: i.range, values: i.values})
    },
    'Google Calendar': {
      list_events: async (i) => {
        const q = new URLSearchParams({singleEvents: 'true', orderBy: i.orderBy === 'updated' ? 'updated' : 'startTime', maxResults: String(Math.min(+i.pageSize || 250, 2500)), timeZone: TZ});
        if (i.startTime) q.set('timeMin', rfc(i.startTime)); if (i.endTime) q.set('timeMax', rfc(i.endTime)); if (i.query) q.set('q', i.query);
        const j = await api('GET', `${URLS.cal}/calendars/${enc(i.calendarId || 'primary')}/events?${q}`);
        return {events: j.items || [], summary: j.summary || '', timeZone: j.timeZone || TZ};
      },
      create_event: (i) => {
        const when = (t) => i.allDay ? {date: String(t).slice(0, 10)} : {dateTime: rfc(t), timeZone: TZ};
        const b = {summary: i.summary, start: when(i.startTime), end: when(i.endTime || i.startTime)};
        if (i.description) b.description = i.description; if (i.location) b.location = i.location; if (i.colorId) b.colorId = String(i.colorId);
        if (i.recurrenceData) b.recurrence = [].concat(i.recurrenceData);
        if (i.availability === 'AVAILABILITY_FREE') b.transparency = 'transparent';
        if (i.overrideReminders || i.useDefaultReminders === false) b.reminders = {useDefault: false, overrides: (i.overrideReminders || []).map((r) => ({method: r.method || 'popup', minutes: r.minutes}))};
        if ((b.reminders && b.reminders.overrides || []).some((r) => r.minutes < 0)) throw new ToolError('tool_error', 'Google refuse un rappel après le début (minutes négatives).');
        return api('POST', `${URLS.cal}/calendars/${enc(i.calendarId || 'primary')}/events?sendUpdates=none`, b);
      },
      update_event: async (i) => {
        const base = `${URLS.cal}/calendars/${enc(i.calendarId || 'primary')}/events/${enc(i.eventId)}`, b = {};
        if (i.summary) b.summary = i.summary; if (i.location) b.location = i.location; if (i.description) b.description = i.description;
        if (i.startTime) {
          if (i.allDay) { b.start = {date: String(i.startTime).slice(0, 10)}; b.end = {date: String(i.endTime || i.startTime).slice(0, 10)}; }
          else {
            b.start = {dateTime: rfc(i.startTime), timeZone: TZ};
            if (i.endTime) b.end = {dateTime: rfc(i.endTime), timeZone: TZ};
            else { const ev = await api('GET', base), s = Date.parse(ev.start && ev.start.dateTime), e = Date.parse(ev.end && ev.end.dateTime); const dur = s && e ? e - s : 3600e3; b.end = {dateTime: new Date(Date.parse(b.start.dateTime) + dur).toISOString(), timeZone: TZ}; }
          }
        }
        return api('PATCH', base + '?sendUpdates=none', b);
      },
      delete_event: (i) => api('DELETE', `${URLS.cal}/calendars/${enc(i.calendarId || 'primary')}/events/${enc(i.eventId)}?sendUpdates=none`)
    },
    Gmail: {
      search_threads: async (i) => {
        const q = new URLSearchParams({q: i.query || '', maxResults: String(Math.min(+i.pageSize || 20, 100))});
        const j = await api('GET', `${URLS.gmail}/users/me/threads?${q}`);
        if (!(j.threads || []).length) return {};
        if (i.idsOnly) return {threads: j.threads.map((t) => ({id: t.id, historyId: t.historyId}))};   /* 0.46.0 (Radar) : sans les en-têtes, 10 unités au lieu de 10 par fil */
        const meta = ['From', 'To', 'Subject', 'Date'].map((h) => 'metadataHeaders=' + h).join('&');
        const threads = await pool(j.threads, 8, async (t) => { const x = await api('GET', `${URLS.gmail}/users/me/threads/${enc(t.id)}?format=metadata&${meta}`); const ms = (x.messages || []).map((m) => mailMsg(m, false)); return {id: x.id, messageCount: ms.length, messages: ms, viewUrl: 'https://mail.google.com/mail/#all/' + x.id}; });
        return {threads};
      },
      get_attachment: async (i) => { const x = await api('GET', `${URLS.gmail}/users/me/messages/${enc(i.messageId)}/attachments/${enc(i.attachmentId)}`); return {size: x.size || 0, data: x.data || ''}; },
      get_thread: async (i) => { const x = await api('GET', `${URLS.gmail}/users/me/threads/${enc(i.threadId)}?format=full`); return {id: x.id, messages: (x.messages || []).map((m) => mailMsg(m, true))}; },
      list_drafts: async (i) => {
        const q = new URLSearchParams({maxResults: String(Math.min(+i.pageSize || 20, 100))}); if (i.query) q.set('q', i.query);
        const j = await api('GET', `${URLS.gmail}/users/me/drafts?${q}`);
        if (!(j.drafts || []).length) return {};
        const drafts = await pool(j.drafts, 8, async (d) => { const x = await api('GET', `${URLS.gmail}/users/me/drafts/${enc(d.id)}?format=full`), m = x.message || {}; const o = mailMsg(m, true);
          return {id: x.id, threadId: m.threadId, toRecipients: o.toRecipients, ccRecipients: addrs(hdr(m, 'Cc')).map((a) => a.emailAddress), date: o.date, subject: o.subject, plaintextBody: o.plaintextBody, viewUrl: 'https://mail.google.com/mail/#drafts?compose=' + m.id}; });
        return {drafts};
      },
      send_message: (i) => i.draftId ? api('POST', `${URLS.gmail}/users/me/drafts/send`, {id: i.draftId}) : api('POST', `${URLS.gmail}/users/me/messages/send`, {raw: rawMail(i)}),
      delete_draft: (i) => api('DELETE', `${URLS.gmail}/users/me/drafts/${enc(i.draftId)}`),
      unlabel_thread: (i) => api('POST', `${URLS.gmail}/users/me/threads/${enc(i.threadId)}/modify`, {removeLabelIds: [].concat(i.labelIds || [])})
    },
    'Google Drive': {
      /* 0.37.0 : un Google Doc par son nom dans un dossier (le Profil), en lecture seule : le plus récent de ce nom, exporté en HTML */
      doc_html: async (i) => {
        const qs = (v) => "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
        const p = new URLSearchParams({q: `name = ${qs(i.name)} and ${qs(i.parent)} in parents and trashed = false and mimeType = 'application/vnd.google-apps.document'`, orderBy: 'modifiedTime desc', pageSize: '5', fields: 'files(id,name,modifiedTime)'});
        const j = await api('GET', `${URLS.drive}/files?${p}`), docs = j.files || [];
        if (!docs.length) return {found: false};
        const f = docs.slice().sort((a, b) => String(b.modifiedTime || '').localeCompare(String(a.modifiedTime || '')))[0];
        return {found: true, id: f.id, modifiedTime: f.modifiedTime || '', doublons: docs.length - 1, html: await apiText(`${URLS.drive}/files/${enc(f.id)}/export?mimeType=text%2Fhtml`)};
      },
      /* JARVIS OS (16/11/2026) : l'arborescence complète de dossiers (Papiers), en lecture seule et en peu d'appels :
         les dossiers niveau par niveau, puis les fichiers par lots de 40 dossiers parents. Une racine se donne par id, ou par nom et parent ('root' = Mon Drive). */
      /* JARVIS OS (17/11/2026) : chercher dans le TEXTE des documents (Google lit le texte des PDF et des photos), limité à l'arborescence des racines
         données (le dossier Papiers ; Papiers privés seulement si la page l'a demandé). Lecture seule ; dossiers mis en cache 10 minutes. */
      search_text: async (i) => {
        const term = String(i.query || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80);
        if (term.length < 3) return {files: []};
        const key = JSON.stringify(i.roots || []), c = SEARCH_CACHE.get(key);
        const tree = c && Date.now() - c.at < 600000 ? c.tree : await T['Google Drive'].folder_tree({roots: i.roots, foldersOnly: true});
        SEARCH_CACHE.set(key, {at: Date.now(), tree});
        const inTree = new Set([...tree.roots.map((r) => r.id), ...tree.folders.map((f) => f.id)].filter(Boolean));
        const qs = (v) => "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
        /* la requête porte sur les seuls dossiers demandés (par lots de 30), pages suivies : un mot fréquent ailleurs dans le Drive ne cache pas les papiers */
        const ids = [...inTree], found = [];
        for (let k = 0; k < ids.length && found.length < 40; k += 30) {
          const par = '(' + ids.slice(k, k + 30).map((x) => qs(x) + ' in parents').join(' or ') + ')';
          let page = '', n = 0;
          do {
            const p = new URLSearchParams({q: `fullText contains ${qs(term)} and ${par} and trashed = false and mimeType != 'application/vnd.google-apps.folder'`, pageSize: '100', fields: 'nextPageToken,files(id,name,mimeType,parents,modifiedTime,size,webViewLink)'});
            if (page) p.set('pageToken', page);
            const j = await api('GET', `${URLS.drive}/files?${p}`); found.push(...(j.files || [])); page = j.nextPageToken || '';
          } while (page && ++n < 5 && found.length < 40);
        }
        const files = found.filter((f) => (f.parents || []).some((x) => inTree.has(x))).slice(0, 40)
          .map((f) => ({id: f.id, name: f.name, mimeType: f.mimeType || '', parent: (f.parents || []).find((x) => inTree.has(x)) || '', modifiedTime: f.modifiedTime || '', size: f.size ? +f.size : null, viewUrl: f.webViewLink || 'https://drive.google.com/file/d/' + f.id + '/view'}));
        return {files};
      },
      folder_tree: async (i) => {
        const FOLDER = 'application/vnd.google-apps.folder', qs = (v) => "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
        const chunks = (a, n) => { const o = []; for (let k = 0; k < a.length; k += n) o.push(a.slice(k, k + n)); return o; };
        const inParents = (ids) => '(' + ids.map((x) => qs(x) + ' in parents').join(' or ') + ')';
        const list = async (q, fields) => {
          const out = []; let page = '';
          do {
            const p = new URLSearchParams({q, pageSize: '1000', fields: 'nextPageToken,files(' + fields + ')'}); if (page) p.set('pageToken', page);
            const j = await api('GET', `${URLS.drive}/files?${p}`); out.push(...(j.files || [])); page = j.nextPageToken || '';
          } while (page && out.length < 20000);
          return out;
        };
        const roots = [];
        for (const r of [].concat(i.roots || []).slice(0, 5)) {
          if (r.id) { roots.push({key: r.key || r.id, id: String(r.id), name: r.name || '', found: true}); continue; }
          const f = r.name ? (await list(`name = ${qs(r.name)} and ${qs(r.parent || 'root')} in parents and mimeType = '${FOLDER}' and trashed = false`, 'id,name'))[0] : null;
          roots.push({key: r.key || r.name || '', id: f ? f.id : '', name: r.name || '', found: !!f});
        }
        const seen = new Set(roots.map((r) => r.id).filter(Boolean)), folders = []; let level = [...seen];
        for (let depth = 0; level.length && depth < 8; depth++) {
          const next = [];
          for (const c of chunks(level, 40)) for (const f of await list(`mimeType = '${FOLDER}' and trashed = false and ${inParents(c)}`, 'id,name,parents')) {
            if (seen.has(f.id)) continue;
            seen.add(f.id); next.push(f.id); folders.push({id: f.id, name: f.name, parent: (f.parents || []).find((p) => c.includes(p)) || (f.parents || [])[0] || ''});
          }
          level = next;
        }
        const files = [];
        if (i.foldersOnly) return {roots, folders, files};
        for (const c of chunks([...seen], 40)) for (const f of await list(`mimeType != '${FOLDER}' and trashed = false and ${inParents(c)}`, 'id,name,mimeType,parents,modifiedTime,size,webViewLink')) {
          files.push({id: f.id, name: f.name, mimeType: f.mimeType || '', parent: (f.parents || []).find((p) => seen.has(p)) || (f.parents || [])[0] || '', modifiedTime: f.modifiedTime || '', size: f.size ? +f.size : null, viewUrl: f.webViewLink || 'https://drive.google.com/file/d/' + f.id + '/view'});
        }
        return {roots, folders, files};
      }
    }
  };
  async function tool(server, name, input) {
    const fn = T[server] && T[server][name];
    if (!fn) throw new ToolError('not_in_manifest', `${server} · ${name} : pas encore relié à l'accès Google direct.`);
    try { return await fn(input || {}); }
    catch (e) { if (e instanceof ToolError) throw e; throw new ToolError('tool_error', e.message || String(e)); }
  }
  const tools = () => Object.entries(T).map(([name, t]) => ({name, tools: Object.keys(t)}));
  return {status, configure, link, callback, unlink, tool, tools, ToolError};
}
