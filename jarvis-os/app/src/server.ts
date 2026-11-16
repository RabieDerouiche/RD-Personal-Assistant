/* Le lien avec le serveur JARVIS (phase 3) : appairage, discussion en flux, missions et mémoire.
   Sans serveur relié, l'app garde le cerveau local de la phase 2. */
import {store, type Mission, type Msg} from './store';

const base = () => store.settings.serverUrl.replace(/\/+$/, '');
export const linked = () => !!(store.settings.serverUrl && store.settings.serverToken);
const headers = () => ({'content-type': 'application/json', authorization: 'Bearer ' + store.settings.serverToken});
async function call(path: string, init: RequestInit = {}, ms = 15000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(base() + path, {...init, headers: {...headers(), ...(init.headers || {})}, signal: ctl.signal}); }
  finally { clearTimeout(t); }
}

/* l'adresse du serveur : une IP (celle du mail OVH) devient https://a-b-c-d.sslip.io ; le port interne est retiré */
export function normalizeUrl(u: string) {
  let s = u.trim().replace(/\s+/g, ''); if (!s) return '';
  s = s.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (ip) s = ip.slice(1).join('-') + '.sslip.io';
  return 'https://' + s.toLowerCase();
}
const isLocal = (u: string) => /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(u.trim().replace(/\/+$/, ''));

export async function pair(url: string, code: string): Promise<string | null> {
  const u = isLocal(url) ? url.trim().replace(/\/+$/, '') : normalizeUrl(url);
  if (!u) return 'Indique l\'adresse du serveur (ou son adresse IP, reçue par mail d\'OVH).';
  if (!code.trim()) return 'Indique le code d\'appairage affiché sur le serveur.';
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
    const hr = await fetch(u + '/api/health', {signal: ctl.signal}).finally(() => clearTimeout(t));
    if (!hr.ok) return 'Un serveur répond à ' + u + ', mais pas JARVIS (' + hr.status + ').';
  } catch {
    return 'Aucun serveur JARVIS ne répond à ' + u + '. Vérifie que l\'installation est finie (« Installation terminée » dans Termius) et que l\'adresse est celle affichée par le serveur.';
  }
  try {
    const r = await fetch(u + '/api/pair', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({code, device: 'iPhone'})});
    const b = await r.json().catch(() => ({}));
    if (!r.ok || !b.token) return b.error || 'Le serveur a refusé (' + r.status + ').';
    store.settings.serverUrl = u; store.settings.serverToken = b.token; store.save();
    await call('/api/import', {method: 'POST', body: JSON.stringify({msgs: store.msgs.slice(-200), missions: store.missions})}).catch(() => null);
    await sync();
    return null;
  } catch { return 'Le serveur ' + u + ' n\'a pas répondu à l\'appairage. Réessaie dans une minute.'; }
}
export function unpair() { store.settings.serverToken = ''; store.save(); }

export interface Conn { checked: boolean; gmail: boolean; calendar: boolean; sheets: boolean; drive: boolean; read: number }
export interface Status { ok: boolean; claude?: {installed: boolean; loggedIn: boolean; method: string}; version?: string; commit?: string; connectors?: Conn; grokPauseUntil?: string; error?: string }
let last: Status = {ok: false};
export const lastStatus = () => last;
export async function status(): Promise<Status> {
  if (!linked()) return (last = {ok: false, error: 'non relié'});
  try {
    const r = await call('/api/status');
    if (r.status === 401) return (last = {ok: false, error: 'appareil plus reconnu : relie-le de nouveau'});
    const b = await r.json(); return (last = {ok: true, claude: b.claude, version: b.version, commit: b.commit, connectors: b.connectors, grokPauseUntil: b.grokPauseUntil});
  } catch { return (last = {ok: false, error: 'serveur injoignable'}); }
}

/* le serveur fait foi pour la mémoire et les missions */
export async function sync(): Promise<boolean> {
  if (!linked()) return false;
  try {
    const r = await call('/api/state'); if (!r.ok) return false;
    const b = await r.json() as {msgs: Msg[]; missions: Mission[]};
    store.msgs = b.msgs; store.missions = b.missions; store.save(); return true;
  } catch { return false; }
}

export interface ChatOut { reply: string; missions: Mission[]; agent?: string }
/* la réponse arrive en flux (SSE) : onDelta reçoit le texte déjà écrit */
export async function chat(text: string, opts: {newSession?: boolean; model: string}, onDelta: (t: string) => void): Promise<ChatOut> {
  const r = await call('/api/chat', {method: 'POST', body: JSON.stringify({text, newSession: opts.newSession, model: opts.model})}, 150000);
  if (r.status === 401) throw new Error('Cet iPhone n\'est plus reconnu par le serveur : relie-le de nouveau dans Réglages.');
  if (!r.ok || !r.body) throw new Error('Le serveur a répondu ' + r.status + '.');
  const rd = r.body.getReader(), dec = new TextDecoder();
  let buf = '', out: ChatOut | null = null, err = '';
  for (;;) {
    const {value, done} = await rd.read(); if (done) break;
    buf += dec.decode(value, {stream: true});
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const m = /^event: (\w+)\ndata: (.*)$/s.exec(block.trim()); if (!m) continue;
      const d = JSON.parse(m[2]);
      if (m[1] === 'delta') onDelta(d.text);
      else if (m[1] === 'done') out = d;
      else if (m[1] === 'error') err = d.message;
    }
  }
  if (err) throw new Error(err);
  if (!out) throw new Error('Réponse interrompue.');
  return out;
}

export async function missionUpdate(id: string, patch: {status?: string; priority?: string}) {
  const r = await call('/api/missions/' + encodeURIComponent(id), {method: 'POST', body: JSON.stringify(patch)});
  if (!r.ok) throw new Error('Le serveur a refusé.');
  return (await r.json()).mission as Mission;
}
export async function missionDelete(id: string) { await call('/api/missions/' + encodeURIComponent(id), {method: 'DELETE'}); }
export async function memoryClear() { await call('/api/memory', {method: 'DELETE'}); }

/* l'app servie par le serveur lui-même : son adresse est déjà connue */
export const servedByServer = () => location.protocol === 'https:' && !/github\.io$/i.test(location.hostname);
export async function updateServer(): Promise<string> {
  try { const r = await call('/api/update', {method: 'POST'}, 90000); const b = await r.json(); return b.message || 'Réponse inattendue.'; }
  catch { return 'Le serveur n\'a pas répondu.'; }
}
export async function setGrokPause(until: string) { try { await call('/api/config', {method: 'POST', body: JSON.stringify({grokPauseUntil: until})}); } catch { /* rien */ } await status(); }
export const grokPaused = () => { const u = last.grokPauseUntil; return !!u && Date.parse(u) > Date.now(); };
