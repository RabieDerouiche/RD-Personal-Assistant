/* JARVIS OS — accès Google direct (décidé le 16/11/2026) : le serveur lit et écrit Pilotage, l'agenda et Gmail
   avec les API officielles de Google, sans Claude et sans consommer l'abonnement.
   L'accès est créé une fois par le propriétaire (projet Google Cloud, identifiant OAuth « Application Web ») et collé
   par lui dans JARVIS : l'identifiant et le secret restent sur son serveur (fichier d'état, droits 600), jamais renvoyés.
   `tool(server, tool, input)` reçoit exactement les appels de la page Jarvis (outils des connecteurs claude.ai)
   et rend des réponses de la même forme, pour que la page fonctionne sans changement. */
import crypto from 'node:crypto';

const FAKE = process.env.JARVIS_GOOGLE_FAKE || '';   /* banc d'essai : toutes les adresses Google vers un faux serveur */
const URLS = FAKE ? {auth: FAKE + '/auth', token: FAKE + '/token', revoke: FAKE + '/revoke', sheets: FAKE + '/sheets', cal: FAKE + '/calendar', gmail: FAKE + '/gmail', drive: FAKE + '/drive', upload: FAKE + '/upload/drive'}
  : {auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', revoke: 'https://oauth2.googleapis.com/revoke',
    sheets: 'https://sheets.googleapis.com', cal: 'https://www.googleapis.com/calendar/v3', gmail: 'https://gmail.googleapis.com/gmail/v1', drive: 'https://www.googleapis.com/drive/v3', upload: 'https://www.googleapis.com/upload/drive/v3'};
export const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/drive.readonly'];
/* 0.88.0 (Pilotage hébergé par JARVIS) : drive.file, la plus étroite des portées d'écriture (les seuls fichiers créés par JARVIS), pour la
   copie chiffrée de chaque nuit. Demandée à chaque « Connecter Google », mais FACULTATIVE : un lien qui ne l'a pas fait tout le reste ; seule
   la copie dans Drive attend, et la santé du serveur le dit (« à relier »). Elle ne compte pas dans les droits manquants. */
export const SCOPE_DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file';
/* 0.91.0 (rangement des papiers par JARVIS) : drive, la portée complète, FACULTATIVE elle aussi. drive.file ne suffit pas au rangement :
   les dossiers de « RD Assistant/Papiers » n'ont pas été créés par JARVIS. Sans elle tout le reste marche ; seul le rangement d'un papier
   attend, et l'écran du dépôt comme la santé le disent (« Reconnecte Google une fois »). Accordée, elle suffit aussi aux copies chiffrées.
   Rien de ce module ne partage un fichier (aucun appel « permissions »). */
export const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive';
export const SCOPES_OPTION = [SCOPE_DRIVE_FILE, SCOPE_DRIVE];
const portees = (s) => String(s || '').split(/\s+/).filter((x) => /^https:\/\/www\.googleapis\.com\/auth\//.test(x));
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
/* 0.73.0 : le corps d'une partie dans son jeu de caractères (en-tête Content-Type). Avant, tout était lu en UTF-8 : une facture en ISO-8859-1
   ou windows-1252 perdait ses « é » et ses « € » (le Radar n'y trouvait plus le montant). Un corps déjà en UTF-8 valide reste lu en UTF-8. */
function corpsDe(part) {
  const b = Buffer.from(String(part.body.data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const ct = ((part.headers || []).find((h) => h && /^content-type$/i.test(String(h.name || ''))) || {}).value || '';
  const cs = ((String(ct).match(/charset\s*=\s*["']?([\w.:-]+)/i) || [])[1] || '').toLowerCase();
  if (cs && !/^(utf-?8|us-ascii|ascii)$/.test(cs)) {
    let utf8 = false;
    if (b.some((x) => x > 127)) { try { new TextDecoder('utf-8', {fatal: true}).decode(b); utf8 = true; } catch { /* pas de l'UTF-8 */ } }
    if (!utf8) { try { return new TextDecoder(cs).decode(b); } catch { /* jeu inconnu : UTF-8, comme avant */ } }
  }
  return b.toString('utf8');
}
function partOf(part, type) {
  if (!part) return '';
  if (part.mimeType === type && part.body && part.body.data) return corpsDe(part);
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
  const h = partOf(part, 'text/html'), hx = h ? sansBalises(h) : '';
  if (t && !bouchon && !(t.trim().length < 150 && hx.length > t.trim().length * 3)) return t;   /* 0.56.0 : une partie texte qui n'a que l'objet */
  return hx || t;
}
function mailMsg(m, withBody) {
  const from = addrs(hdr(m, 'From'))[0] || {displayName: '', emailAddress: ''};
  const at = +m.internalDate || Date.parse(hdr(m, 'Date')) || 0;
  const o = {id: m.id, threadId: m.threadId, sender: from.emailAddress, addressDisplayNames: [from], toRecipients: addrs(hdr(m, 'To')).map((a) => a.emailAddress), ccRecipients: addrs(hdr(m, 'Cc')).map((a) => a.emailAddress),
    subject: hdr(m, 'Subject'), snippet: m.snippet || '', date: new Date(at).toISOString(), internalDate: String(at), labelIds: m.labelIds || [], viewUrl: 'https://mail.google.com/mail/#all/' + m.threadId};
  if (withBody) { o.plaintextBody = textOf(m.payload); o.attachments = piecesDe(m.payload); }
  return o;
}
/* un objet hors ASCII : mots encodés UTF-8 (RFC 2047). 0.71.0 : un objet long est coupé en mots de 45 octets au plus, jamais au milieu
   d'un caractère, chacun sur sa ligne repliée (un mot encodé ne dépasse pas 75 caractères) */
const encWord = (s) => {
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  const mots = []; let lot = '';
  for (const c of s) { if (lot && Buffer.byteLength(lot + c, 'utf8') > 45) { mots.push(lot); lot = ''; } lot += c; }
  if (lot) mots.push(lot);
  return mots.map((m) => '=?UTF-8?B?' + Buffer.from(m, 'utf8').toString('base64') + '?=').join('\r\n ');
};
const uneLigne = (v) => String(v || '').replace(/[\r\n]+/g, ' ').trim();
function rawMail({to, cc, subject, body, inReplyTo, references}) {
  const L = ['To: ' + [].concat(to || []).join(', ')];
  if (cc && [].concat(cc).length) L.push('Cc: ' + [].concat(cc).join(', '));
  if (inReplyTo) L.push('In-Reply-To: ' + uneLigne(inReplyTo), 'References: ' + uneLigne((references ? references + ' ' : '') + inReplyTo));   /* 0.71.0 : un brouillon de réponse reste dans son fil */
  L.push('Subject: ' + encWord(String(subject || '')), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', Buffer.from(String(body || ''), 'utf8').toString('base64'));
  return b64u(L.join('\r\n'));
}
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({length: Math.min(n, items.length)}, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; }

export function createGoogle({S, save, log = () => {}}) {
  S.google = S.google || {};
  const G = S.google;
  const pending = new Map();   /* state OAuth → {redirect, at} : 10 minutes, usage unique */
  let access = {token: '', exp: 0};
  /* 0.73.0 : chaque appel à Google a un délai (30 s) ; avant, une connexion muette figeait une lecture de Pilotage ou une action de la page
     au moins 5 minutes. La lecture du corps compte dans le délai : elle ne passe plus pour une réponse vide. */
  const DELAI = +process.env.JARVIS_GOOGLE_DELAI_MS || 30000;
  const estDelai = (e) => !!e && (e.name === 'TimeoutError' || e.name === 'AbortError');
  const errDelai = () => new ToolError('tool_error', 'Google ne répond pas (' + Math.round(DELAI / 1000) + ' s) : réessaie dans un moment.');
  const gfetch = async (url, o = {}, delai = DELAI) => {   /* 0.91.0 : un délai à part pour l'envoi d'un fichier (25 Mo) */
    try { return await fetch(url, {...o, signal: AbortSignal.timeout(delai)}); }
    catch (e) { if (estDelai(e)) throw errDelai(); if (e instanceof TypeError && /fetch failed/i.test(e.message)) throw new ToolError('tool_error', 'Google est injoignable pour l’instant (réseau) : réessaie dans un moment.'); throw e; }
  };
  const lireJson = async (r) => { try { return await r.json(); } catch (e) { if (estDelai(e)) throw errDelai(); return {}; } };

  const status = (redirect) => ({configured: !!(G.clientId && G.clientSecret), linked: !!G.refresh, account: G.account || '', linkedAt: G.linkedAt || 0,
    clientId: G.clientId ? G.clientId.slice(0, 12) + '…' : '', redirect, scopes: SCOPES, driveCopies: drivePortee(), driveDepot: depotPortee()});
  /* 0.88.0 : drive.file accordée ? « inconnue » pour un lien d'avant la 0.88.0, jusqu'au premier renouvellement du jeton (Google y redit les portées) */
  /* 0.91.0 : la portée complète « drive » suffit aussi aux copies (elle contient drive.file) */
  function drivePortee() { if (!G.refresh) return 'non'; return Array.isArray(G.portees) ? (G.portees.includes(SCOPE_DRIVE_FILE) || G.portees.includes(SCOPE_DRIVE) ? 'oui' : 'non') : 'inconnue'; }
  /* 0.91.0 : « drive » accordée (ranger un papier dans un dossier que JARVIS n'a pas créé) ? Mêmes réponses que drivePortee */
  function depotPortee() { if (!G.refresh) return 'non'; return Array.isArray(G.portees) ? (G.portees.includes(SCOPE_DRIVE) ? 'oui' : 'non') : 'inconnue'; }
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
    const q = new URLSearchParams({client_id: G.clientId, redirect_uri: redirect, response_type: 'code', scope: [...SCOPES, ...SCOPES_OPTION].join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state});
    return {ok: true, url: URLS.auth + '?' + q};
  }
  async function tokenCall(params) {
    const r = await gfetch(URLS.token, {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams(params)});
    const j = await lireJson(r);
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
      G.missing = missing; G.portees = portees(j.scope); save();
      return {ok: true, account: G.account, missing};
    } catch (e) { return {ok: false, error: 'Échange avec Google refusé : ' + e.message}; }
  }
  async function unlink() {
    const t = G.refresh;
    G.refresh = ''; G.account = ''; G.linkedAt = 0; delete G.portees; access = {token: '', exp: 0}; save();
    if (t) { try { await gfetch(URLS.revoke, {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({token: t})}); } catch { /* rien */ } }
    return {ok: true};
  }
  /* 0.73.0 : un seul renouvellement du jeton à la fois, partagé par les appels qui tombent ensemble (les tics de 60 s) ; un renouvellement
     lancé avec l'accès d'avant (compte changé ou délié entre-temps) n'écrase plus le nouveau, ni ne l'efface s'il est refusé */
  let enCours = null;
  async function token() {
    if (!G.refresh) throw new ToolError('server_not_connected', 'Google n’est pas relié à JARVIS (Réglages, Connecter Google).');
    if (access.token && Date.now() < access.exp) return access.token;
    const rt = G.refresh;
    if (!enCours || enCours.rt !== rt) {
      const p = tokenCall({client_id: G.clientId, client_secret: G.clientSecret, refresh_token: rt, grant_type: 'refresh_token'})
        .then((j) => {
          if (G.refresh === rt) {
            access = {token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60e3};
            if (j.scope) { const g = portees(j.scope); if (JSON.stringify(g) !== JSON.stringify(G.portees)) { G.portees = g; save(); } }   /* 0.88.0 : drive.file vue sans relier */
          }
          return j.access_token; },
          (e) => { if (e.code === 'needs_reauth' && G.refresh === rt) { G.refresh = ''; save(); } throw e; })
        .finally(() => { if (enCours && enCours.p === p) enCours = null; });
      enCours = {rt, p};
    }
    let t;
    try { t = await enCours.p; } catch (e) { if (G.refresh && G.refresh !== rt) return token(); throw e; }   /* compte changé entre-temps : avec le nouveau */
    return G.refresh === rt ? t : token();
  }
  /* 0.94.0 : un quota atteint (429 ; le 26/11/2026, « Queries per minute per user » sur Gmail) n'était géré nulle part : la lecture
     échouait telle quelle. Une LECTURE (GET, sans effet) est réessayée une fois, après une courte attente ; une écriture, jamais. */
  const REESSAI = process.env.JARVIS_GOOGLE_REESSAI_MS != null ? +process.env.JARVIS_GOOGLE_REESSAI_MS : 1500;
  async function api(method, url, body, retry = true, quota = true) {
    const t = await token();
    const r = await gfetch(url, {method, headers: {authorization: 'Bearer ' + t, ...(body ? {'content-type': 'application/json'} : {})}, body: body ? JSON.stringify(body) : undefined});
    if (r.status === 401 && retry) { if (access.token === t) access = {token: '', exp: 0}; return api(method, url, body, false, quota); }
    if (r.status === 429 && quota && method === 'GET') { try { await r.arrayBuffer(); } catch { /* corps déjà perdu */ } await new Promise((z) => setTimeout(z, REESSAI + Math.floor(Math.random() * 300))); return api(method, url, body, retry, false); }
    if (r.status === 204) return {};
    const j = await lireJson(r);
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
    const r = await gfetch(url, {headers: {authorization: 'Bearer ' + t}});
    if (r.status === 401 && retry) { if (access.token === t) access = {token: '', exp: 0}; return apiText(url, false); }
    let tx = ''; try { tx = await r.text(); } catch (e) { if (estDelai(e)) throw errDelai(); throw e; }
    if (!r.ok) throw new ToolError(r.status === 401 ? 'needs_reauth' : 'tool_error', 'HTTP ' + r.status, r.status);
    return tx;
  }
  /* 0.85.0 (note de télétravail d'Hermes) : une réponse binaire (le contenu d'un fichier du Drive), avec un plafond */
  async function apiOctets(url, max, retry = true) {
    const t = await token();
    const r = await gfetch(url, {headers: {authorization: 'Bearer ' + t}});
    if (r.status === 401 && retry) { if (access.token === t) access = {token: '', exp: 0}; return apiOctets(url, max, false); }
    if (!r.ok) throw new ToolError(r.status === 401 ? 'needs_reauth' : 'tool_error', 'HTTP ' + r.status, r.status);
    let b; try { b = Buffer.from(await r.arrayBuffer()); } catch (e) { if (estDelai(e)) throw errDelai(); throw e; }
    if (b.length > max) throw new ToolError('tool_error', 'Fichier trop gros.', 413);
    return b;
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
        /* 0.73.0 : les pages suivantes aussi (2 500 événements au plus) : au-delà d'une page, les derniers mois manquaient sans avertissement,
           et Google peut couper une page plus tôt */
        const items = []; let page = '', j0 = null;
        do {
          if (page) q.set('pageToken', page);
          const j = await api('GET', `${URLS.cal}/calendars/${enc(i.calendarId || 'primary')}/events?${q}`);
          j0 = j0 || j; items.push(...(j.items || [])); page = j.nextPageToken || '';
        } while (page && items.length < 2500);
        return {events: items, summary: j0.summary || '', timeZone: j0.timeZone || TZ};
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
      delete_event: (i) => api('DELETE', `${URLS.cal}/calendars/${enc(i.calendarId || 'primary')}/events/${enc(i.eventId)}?sendUpdates=none`),
      /* 0.71.0 : ses agendas (lecture seule), pour en choisir un par son nom */
      list_calendars: async () => { const j = await api('GET', `${URLS.cal}/users/me/calendarList?maxResults=250`); return {calendars: (j.items || []).map((c) => ({id: c.id, summary: c.summaryOverride || c.summary || '', primary: !!c.primary, accessRole: c.accessRole || ''}))}; }
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
          return {id: x.id, threadId: m.threadId, toRecipients: o.toRecipients, ccRecipients: addrs(hdr(m, 'Cc')).map((a) => a.emailAddress), date: o.date, subject: o.subject, plaintextBody: o.plaintextBody, pieces: (o.attachments || []).map((a) => a.filename), viewUrl: 'https://mail.google.com/mail/#drafts?compose=' + m.id}; });
        return {drafts};
      },
      send_message: (i) => i.draftId ? api('POST', `${URLS.gmail}/users/me/drafts/send`, {id: i.draftId}) : api('POST', `${URLS.gmail}/users/me/messages/send`, {raw: rawMail(i)}),
      /* 0.71.0 : un brouillon (jamais un envoi). Avec threadId, il répond dans ce fil : identifiant du dernier message lu pour In-Reply-To */
      create_draft: async (i) => {
        let suite = {};
        if (i.threadId) {
          try { const x = await api('GET', `${URLS.gmail}/users/me/threads/${enc(i.threadId)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`), d = (x.messages || []).slice(-1)[0];
            if (d && hdr(d, 'Message-ID')) suite = {inReplyTo: hdr(d, 'Message-ID'), references: hdr(d, 'References')}; } catch { /* sans ces en-têtes, Gmail range quand même le brouillon dans le fil */ }
        }
        const x = await api('POST', `${URLS.gmail}/users/me/drafts`, {message: {raw: rawMail({...i, ...suite}), ...(i.threadId ? {threadId: String(i.threadId)} : {})}}), m = x.message || {};
        return {id: x.id || '', messageId: m.id || '', threadId: m.threadId || '', viewUrl: m.id ? 'https://mail.google.com/mail/#drafts?compose=' + m.id : ''};
      },
      /* 0.85.0 (sa demande du 26/11/2026 : « modifier les brouillons dans JARVIS et les envoyer après ») : destinataires, objet et texte
         remplacés, le fil et ses en-têtes de réponse gardés. Un brouillon avec pièce jointe se modifie dans Gmail (le texte seul la perdrait) */
      update_draft: async (i) => {
        const adr = (v) => [].concat(v == null ? [] : v).map((x) => String(x).trim()).filter(Boolean);
        const x = await api('GET', `${URLS.gmail}/users/me/drafts/${enc(i.draftId)}?format=full`), m = x.message || {};
        if (piecesDe(m.payload).length) { const e = new Error('Ce brouillon a une pièce jointe : modifie-le dans Gmail, pour ne pas la perdre.'); e.code = 'pieces_jointes'; e.status = 409; throw e; }
        const o = mailMsg(m, true), to = i.to != null ? adr(i.to) : o.toRecipients, cc = i.cc != null ? adr(i.cc) : addrs(hdr(m, 'Cc')).map((a) => a.emailAddress);
        const mauvaise = [...to, ...cc].find((a) => !/^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[a-z]{2,}$/i.test(a));
        if (mauvaise) { const e = new Error('Adresse invalide : ' + mauvaise.slice(0, 80)); e.code = 'adresse'; e.status = 400; throw e; }
        if (to.length > 20 || cc.length > 20) { const e = new Error('Trop de destinataires (20 au plus).'); e.code = 'adresse'; e.status = 400; throw e; }
        const subject = uneLigne(i.subject != null ? String(i.subject) : o.subject).slice(0, 300), body = (i.body != null ? String(i.body) : o.plaintextBody || '').replace(/\r\n?/g, '\n').slice(0, 60000);
        const irt = hdr(m, 'In-Reply-To'), refs = String(hdr(m, 'References') || '').split(/\s+/).filter((r) => r && r !== irt).join(' ');
        const y = await api('PUT', `${URLS.gmail}/users/me/drafts/${enc(i.draftId)}`, {id: i.draftId, message: {raw: rawMail({to, cc, subject, body, inReplyTo: irt, references: refs}), ...(m.threadId ? {threadId: m.threadId} : {})}}), n = y.message || {};
        return {id: y.id || i.draftId, messageId: n.id || '', threadId: n.threadId || m.threadId || '', toRecipients: to, ccRecipients: cc, subject, plaintextBody: body};
      },
      delete_draft: (i) => api('DELETE', `${URLS.gmail}/users/me/drafts/${enc(i.draftId)}`),
      unlabel_thread: (i) => api('POST', `${URLS.gmail}/users/me/threads/${enc(i.threadId)}/modify`, {removeLabelIds: [].concat(i.labelIds || [])})
    },
    'Google Drive': {
      /* 0.85.0 (note de télétravail d'Hermes, 26/11/2026) : UN fichier PDF par son identifiant, en lecture seule (un justificatif fixe,
         l'avis de taxe foncière) ; 10 Mo au plus ; rendu en base64 avec son nom */
      file_pdf: async (i) => {
        const id = String(i.fileId || '');
        if (!/^[A-Za-z0-9_-]{10,120}$/.test(id)) throw new ToolError('tool_error', 'Identifiant de fichier invalide.', 400);
        const m = await api('GET', `${URLS.drive}/files/${enc(id)}?fields=id,name,mimeType,size,modifiedTime,trashed`);
        if (m.trashed) throw new ToolError('tool_error', 'Ce fichier est dans la corbeille.', 404);
        if (m.mimeType !== 'application/pdf') throw new ToolError('tool_error', 'Ce fichier n’est pas un PDF.', 415);
        if (+m.size > 10e6) throw new ToolError('tool_error', 'Fichier trop gros (10 Mo au plus).', 413);
        const b = await apiOctets(`${URLS.drive}/files/${enc(id)}?alt=media`, 10e6);
        if (b.subarray(0, 5).toString('latin1') !== '%PDF-') throw new ToolError('tool_error', 'Le contenu n’est pas un PDF.', 415);
        return {id: m.id, name: m.name || '', modifiedTime: m.modifiedTime || '', size: b.length, data: b.toString('base64')};
      },
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
        const key = JSON.stringify(i.roots || []), c = SEARCH_CACHE.get(key), frais = c && Date.now() - c.at < 600000;
        const tree = frais ? c.tree : await T['Google Drive'].folder_tree({roots: i.roots, foldersOnly: true});
        if (!frais) SEARCH_CACHE.set(key, {at: Date.now(), tree});   /* 0.73.0 : relue au bout de 10 minutes, même si les recherches se suivent */
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
  /* ---------- 0.88.0 : ce que seul le serveur appelle (hors de T, donc jamais par l'app ni par /api/tool) ----------
     Pour l'import de Pilotage : les noms d'onglets et les formules du classeur. Pour la copie chiffrée de chaque nuit : son dossier et ses
     fichiers dans Drive, créés par JARVIS (portée drive.file) et reconnus à leur marque appProperties « jarvis ». */
  async function apiBrut(method, url, body, type, retry = true) {
    const t = await token();
    const r = await gfetch(url, {method, headers: {authorization: 'Bearer ' + t, 'content-type': type}, body});
    if (r.status === 401 && retry) { if (access.token === t) access = {token: '', exp: 0}; return apiBrut(method, url, body, type, false); }
    const j = await lireJson(r);
    if (!r.ok) { const msg = (j.error && (j.error.message || j.error)) || 'HTTP ' + r.status; throw new ToolError(r.status === 401 ? 'needs_reauth' : r.status === 403 && /scope|insufficient/i.test(JSON.stringify(j)) ? 'not_granted' : 'tool_error', String(msg), r.status); }
    return j;
  }
  const DOSSIER = 'application/vnd.google-apps.folder', marque = (v) => `appProperties has { key='jarvis' and value='${v}' }`;
  const idSur = (id) => { if (!/^[A-Za-z0-9_-]{2,200}$/.test(String(id || ''))) throw new ToolError('tool_error', 'Identifiant Drive invalide.', 400); return String(id); };
  const lettre = (i) => { let s = ''; for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  const interne = {
    titres: async (id) => ((await api('GET', `${URLS.sheets}/v4/spreadsheets/${enc(id)}?fields=${enc('sheets.properties.title')}`)).sheets || []).map((x) => String((x.properties || {}).title || '')).filter(Boolean),
    /* {onglet: [[« D4 », « =IF(… »], …]} : les seules cases qui portent une formule */
    formules: async (id) => {
      const j = await api('GET', `${URLS.sheets}/v4/spreadsheets/${enc(id)}?includeGridData=true&fields=${enc('sheets(properties.title,data(startRow,startColumn,rowData.values.userEnteredValue.formulaValue))')}`), out = {};
      for (const sh of j.sheets || []) {
        const nom = String((sh.properties || {}).title || ''), l = [];
        for (const d of sh.data || []) (d.rowData || []).forEach((r, ri) => ((r && r.values) || []).forEach((v, ci) => { const f = v && v.userEnteredValue && v.userEnteredValue.formulaValue; if (f) l.push([lettre((d.startColumn || 0) + ci) + ((d.startRow || 0) + ri + 1), String(f)]); }));
        if (l.length) out[nom] = l;
      }
      return out;
    }
  };
  const drive = {
    portee: () => drivePortee(),
    /* le dossier des copies : celui que JARVIS a déjà créé ; sinon un neuf sous RD Assistant ; refusé là (drive.file n'y a pas accès), à la racine */
    dossier: async (nom, parent) => {
      const j = await api('GET', `${URLS.drive}/files?` + new URLSearchParams({q: `mimeType = '${DOSSIER}' and trashed = false and ${marque('sauvegardes')}`, fields: 'files(id,name,parents)', pageSize: '10', spaces: 'drive'}));
      const f = (j.files || [])[0]; if (f) return {id: idSur(f.id), racine: !(f.parents || []).includes(parent)};
      const meta = {name: String(nom).slice(0, 80), mimeType: DOSSIER, appProperties: {jarvis: 'sauvegardes'}};
      try { const c = await api('POST', `${URLS.drive}/files?fields=id,parents`, {...meta, parents: [idSur(parent)]}); return {id: idSur(c.id), racine: false}; }
      catch (e) { if (!(e instanceof ToolError) || e.code === 'not_granted' || ![403, 404].includes(e.status)) throw e; const c = await api('POST', `${URLS.drive}/files?fields=id,parents`, meta); return {id: idSur(c.id), racine: true}; }
    },
    lister: async (dossier) => ((await api('GET', `${URLS.drive}/files?` + new URLSearchParams({q: `'${idSur(dossier)}' in parents and trashed = false and ${marque('pilotage')}`, fields: 'files(id,name,createdTime,size)', pageSize: '200', orderBy: 'name', spaces: 'drive'}))).files || [])
      .map((x) => ({id: x.id, name: String(x.name || ''), createdTime: x.createdTime || '', size: +x.size || 0})),
    envoyer: async ({dossier, nom, octets}) => {
      const b = 'jarvis' + crypto.randomBytes(12).toString('hex'), meta = {name: String(nom).slice(0, 120), parents: [idSur(dossier)], mimeType: 'application/octet-stream', appProperties: {jarvis: 'pilotage'}};
      const body = Buffer.concat([Buffer.from('--' + b + '\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b + '\r\ncontent-type: application/octet-stream\r\n\r\n'), Buffer.from(octets), Buffer.from('\r\n--' + b + '--\r\n')]);
      return apiBrut('POST', `${URLS.upload}/files?uploadType=multipart&fields=id,name`, body, 'multipart/related; boundary=' + b);
    },
    jeter: (id) => api('PATCH', `${URLS.drive}/files/${enc(idSur(id))}`, {trashed: true}),   /* à la corbeille (vidée par Google au bout de 30 jours), jamais effacé d'un coup */
    lire: (id) => apiOctets(`${URLS.drive}/files/${enc(idSur(id))}?alt=media`, 64 * 1024 * 1024)
  };
  /* ---------- 0.91.0 : rangement des papiers par JARVIS (depot.mjs). Hors de T comme `drive` : jamais par l'app (/api/tool), jamais par un
     outil MCP ni par Claude ; seule la route du dépôt, validée par un appareil relié, appelle `envoyer`. Le dossier choisi est vérifié par
     depot.mjs (dans l'arbre de « RD Assistant/Papiers », jamais « Papiers privés »). Aucun partage : aucun appel « permissions ». ---------- */
  const DELAI_ENVOI = +process.env.JARVIS_GOOGLE_ENVOI_MS || 120000;
  const refusGoogle = async (r) => { const j = await lireJson(r), msg = (j.error && (j.error.message || j.error)) || 'HTTP ' + r.status;
    return new ToolError(r.status === 401 ? 'needs_reauth' : r.status === 403 && /scope|insufficient/i.test(JSON.stringify(j)) ? 'not_granted' : 'tool_error', String(msg), r.status); };
  const papiers = {
    portee: () => depotPortee(),
    lie: () => !!G.refresh,
    /* les dossiers de l'arbre, en lecture seule (le même outil que l'écran Papiers) */
    arbre: (racine) => T['Google Drive'].folder_tree({roots: [{id: idSur(racine), key: 'papiers'}], foldersOnly: true}),
    /* un fichier de ce nom est-il déjà dans ce dossier ? */
    existe: async (dossier, nom) => {
      const qs = (v) => "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
      const j = await api('GET', `${URLS.drive}/files?` + new URLSearchParams({q: `name = ${qs(nom)} and ${qs(idSur(dossier))} in parents and trashed = false`, fields: 'files(id)', pageSize: '1'}));
      return !!(j.files || []).length;
    },
    /* l'envoi en deux temps de Google (« resumable », fait pour un fichier de plus de 5 Mo) : les métadonnées, puis les octets à l'adresse
       rendue. Cette adresse doit être chez Google (même origine que l'adresse d'envoi) : sinon rien ne part. Le fichier créé est marqué « jarvis ». */
    envoyer: async ({dossier, nom, mime, octets}, retry = true) => {
      const t = await token(), meta = {name: String(nom).slice(0, 200), parents: [idSur(dossier)], mimeType: String(mime), appProperties: {jarvis: 'depot'}};
      const r = await gfetch(`${URLS.upload}/files?uploadType=resumable&fields=${enc('id,name,parents,webViewLink')}`, {method: 'POST', headers: {authorization: 'Bearer ' + t, 'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-type': String(mime), 'x-upload-content-length': String(octets.length)}, body: JSON.stringify(meta)});
      if (r.status === 401 && retry) { if (access.token === t) access = {token: '', exp: 0}; return papiers.envoyer({dossier, nom, mime, octets}, false); }
      if (!r.ok) throw await refusGoogle(r);
      const ou = r.headers.get('location') || ''; let chezGoogle = false;
      try { chezGoogle = new URL(ou).origin === new URL(URLS.upload).origin; } catch { chezGoogle = false; }
      if (!chezGoogle) throw new ToolError('tool_error', 'Google n’a pas donné d’adresse d’envoi : rien n’est parti.', 502);
      const r2 = await gfetch(ou, {method: 'PUT', headers: {authorization: 'Bearer ' + t, 'content-type': String(mime)}, body: octets}, DELAI_ENVOI);
      if (!r2.ok) throw await refusGoogle(r2);
      const j = await lireJson(r2);
      if (!j.id) throw new ToolError('tool_error', 'Google n’a pas confirmé le fichier : regarde dans le dossier avant de réessayer.', 502);
      return {id: String(j.id), name: String(j.name || nom), parents: Array.isArray(j.parents) ? j.parents.map(String) : [], lien: j.webViewLink || 'https://drive.google.com/file/d/' + j.id + '/view'};
    }
  };
  async function tool(server, name, input) {
    const fn = T[server] && T[server][name];
    if (!fn) throw new ToolError('not_in_manifest', `${server} · ${name} : pas encore relié à l'accès Google direct.`);
    try { return await fn(input || {}); }
    catch (e) { if (e instanceof ToolError) throw e; throw new ToolError('tool_error', e.message || String(e)); }
  }
  const tools = () => Object.entries(T).map(([name, t]) => ({name, tools: Object.keys(t)}));
  return {status, configure, link, callback, unlink, tool, tools, ToolError, interne, drive, papiers};
}
