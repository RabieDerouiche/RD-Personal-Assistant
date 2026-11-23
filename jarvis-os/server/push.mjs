/* JARVIS OS — notifications sur l'iPhone (Web Push), sans dépendance ni service extérieur payant.
   Le serveur chiffre chaque message pour l'appareil (RFC 8291, aes128gcm) et signe sa demande (VAPID, RFC 8292) ;
   le service de notifications de l'appareil (Apple pour l'iPhone) ne voit qu'un message chiffré.
   Clés VAPID créées une fois et gardées dans l'état du serveur (droits 600). Abonnements : un par appareil relié. */
import crypto from 'node:crypto';

export const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

/* une paire de clés P-256 pour signer les demandes (VAPID) ; la clé publique (65 octets) est donnée à l'appareil */
export function newVapid() {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const pub = ecdh.getPublicKey();
  return {publicKey: b64u(pub), jwk: {kty: 'EC', crv: 'P-256', d: b64u(ecdh.getPrivateKey()), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65))}};
}

/* RFC 8291 : chiffrement d'un message pour un appareil (clé publique p256dh et secret auth de son abonnement).
   asPrivate et salt ne servent qu'au banc (vecteur de test du RFC) : sinon tirés au hasard à chaque message. */
export function encrypt({payload, p256dh, auth, asPrivate, salt}) {
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4 || authSecret.length !== 16) throw new Error('abonnement invalide');
  const ecdh = crypto.createECDH('prime256v1');
  if (asPrivate) ecdh.setPrivateKey(unb64u(asPrivate)); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(), ecdhSecret = ecdh.computeSecret(uaPublic);
  const prkKey = hmac(authSecret, ecdhSecret);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const s = salt ? unb64u(salt) : crypto.randomBytes(16);
  const prk = hmac(s, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([s, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/* RFC 8292 : en-tête d'autorisation signé (ES256), valable 12 heures, pour le service de notifications de l'abonnement */
export function vapidAuth({endpoint, vapid, subject, nowSec}) {
  const aud = new URL(endpoint).origin, exp = (nowSec || Math.floor(Date.now() / 1000)) + 12 * 3600;
  const part = (o) => b64u(Buffer.from(JSON.stringify(o)));
  const data = part({typ: 'JWT', alg: 'ES256'}) + '.' + part({aud, exp, sub: subject});
  const key = crypto.createPrivateKey({key: vapid.jwk, format: 'jwk'});
  const sig = crypto.sign('sha256', Buffer.from(data), {key, dsaEncoding: 'ieee-p1363'});
  return 'vapid t=' + data + '.' + b64u(sig) + ', k=' + vapid.publicKey;
}

/* services de notifications acceptés (évite qu'un abonnement fasse appeler n'importe quelle adresse par le serveur) */
const PUSH_HOSTS = [/(^|\.)push\.apple\.com$/, /(^|\.)googleapis\.com$/, /(^|\.)mozilla\.com$/, /(^|\.)mozaws\.net$/, /(^|\.)notify\.windows\.com$/];
export function validSubscription(sub, allowHttp) {
  try {
    const u = new URL(String(sub && sub.endpoint || ''));
    const local = allowHttp && u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname);
    if (!local && (u.protocol !== 'https:' || !PUSH_HOSTS.some((re) => re.test(u.hostname)))) return false;
    return unb64u(sub.keys.p256dh).length === 65 && unb64u(sub.keys.auth).length === 16;
  } catch { return false; }
}

/* 0.70.0 : délai max d'un envoi (10 s) : un service de notifications qui ne répond pas ne bloque plus le serveur 5 minutes par appareil */
export function createPush({S, save, log = () => {}, allowHttp = false, delaiMs = 10000}) {
  S.push = Object.assign({subs: [], prefs: {bots: true, rappels: true, heure: '08:00'}, sent: 0}, S.push || {});
  if (!S.push.vapid) { S.push.vapid = newVapid(); save(); }
  const publicKey = () => S.push.vapid.publicKey;
  function subscribe(sub, device, subject) {
    if (!validSubscription(sub, allowHttp)) return {ok: false, error: 'Abonnement refusé (service de notifications inconnu ou clés invalides).'};
    S.push.subs = S.push.subs.filter((x) => x.endpoint !== sub.endpoint);
    S.push.subs.push({endpoint: sub.endpoint, keys: {p256dh: sub.keys.p256dh, auth: sub.keys.auth}, device: device || '', at: Date.now()});
    if (subject) S.push.subject = subject;
    save(); return {ok: true, count: S.push.subs.length};
  }
  function unsubscribe(endpoint) { const n = S.push.subs.length; S.push.subs = S.push.subs.filter((x) => x.endpoint !== endpoint); save(); return {ok: true, removed: n - S.push.subs.length}; }
  /* 0.69.0 (son retour du 23/11/2026 : « quand on clique sur une notification, elle rouvre Jarvis sur la page déjà ouverte, pas sur l'alerte ») :
     avec le format déclaratif, l'iPhone ouvre lui-même l'adresse de la notification, sans passer par le service worker ; l'app déjà ouverte revient
     au premier plan sans changer d'adresse. Chaque notification a donc un identifiant, mis dans son adresse (« /?n=<id>#voir-… ») et gardé dans la
     liste des dernières (S.notifs, 40 au plus ; une notification de même « tag » remplace la précédente, comme sur l'iPhone) : l'app ouverte par
     elle la retrouve par l'adresse, l'app ramenée au premier plan la retrouve dans la liste (envoyée pendant son absence, pas encore vue). */
  if (!Array.isArray(S.notifs)) S.notifs = [];
  const avecId = (url, id) => { const s = String(url || '/'), i = s.indexOf('#'), base = i >= 0 ? s.slice(0, i) : s, hash = i >= 0 ? s.slice(i) : ''; return (base || '/') + (base.includes('?') ? '&' : '?') + 'n=' + id + hash; };
  function vues(ids) { const l = new Set((Array.isArray(ids) ? ids : [ids]).map(String)); let n = 0; for (const x of S.notifs) if (l.has(x.id) && !x.vue) { x.vue = Date.now(); n++; } if (n) save(); return {ok: true, vues: n}; }
  /* message : {title, body, url, badge, tag}. Envoyé à chaque appareil abonné ; un abonnement expiré (404, 410) est retiré. */
  async function send(msg, opts = {}) {
    const subs = S.push.subs.slice(), out = [], id = crypto.randomBytes(6).toString('hex'), cible = String(msg.url || '/');
    S.notifs = [{id, at: Date.now(), title: String(msg.title || 'JARVIS').slice(0, 120), body: String(msg.body || '').slice(0, 300), url: cible, ...(msg.tag ? {tag: String(msg.tag).slice(0, 80)} : {})}]
      .concat(S.notifs.filter((x) => !(msg.tag && x.tag === msg.tag))).slice(0, 40);
    /* format « déclaratif » de Safari (18.4 et plus), lu aussi par notre service worker sur les autres navigateurs */
    const payload = JSON.stringify({web_push: 8030, notification: {title: String(msg.title || 'JARVIS').slice(0, 120), body: String(msg.body || '').slice(0, 600), navigate: avecId(cible, id), lang: 'fr-FR', tag: msg.tag || undefined, app_badge: msg.badge != null ? String(msg.badge) : undefined}});
    for (const s of subs) {
      try {
        const body = encrypt({payload, p256dh: s.keys.p256dh, auth: s.keys.auth});
        /* 17/11/2026 : Apple refusait chaque envoi (400 BadWebPushTopic) à cause de l'en-tête Topic : il n'est plus envoyé (facultatif ; le « tag » de la notification
           suffit à remplacer la précédente). « Urgency: normal » est la valeur par défaut et a déjà été refusé par Apple (WebKit 247128) : seule « high » est envoyée. */
        const r = await fetch(s.endpoint, {method: 'POST', body, signal: AbortSignal.timeout(delaiMs), headers: {'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: String(opts.ttl || 86400),
          ...(opts.urgency && opts.urgency !== 'normal' ? {urgency: opts.urgency} : {}), authorization: vapidAuth({endpoint: s.endpoint, vapid: S.push.vapid, subject: S.push.subject || 'https://jarvis.invalid'})}});
        if (r.status === 404 || r.status === 410) unsubscribe(s.endpoint);
        const ok = r.status >= 200 && r.status < 300;
        /* raison donnée par le service (Apple : {"reason":"BadJwtToken"} …), gardée pour la montrer dans Réglages */
        let reason = ''; if (!ok) { try { const t = (await r.text()).slice(0, 300); try { reason = String(JSON.parse(t).reason || t); } catch { reason = t; } } catch { reason = ''; } }
        out.push({status: r.status, ok, service: new URL(s.endpoint).hostname, ...(reason ? {reason: reason.replace(/\s+/g, ' ').trim().slice(0, 160)} : {})});
      } catch (e) { out.push({status: 0, ok: false, service: (() => { try { return new URL(s.endpoint).hostname; } catch { return ''; } })(), error: (e && (e.name === 'TimeoutError' || e.name === 'AbortError') ? 'pas de réponse en ' + String(delaiMs / 1000).replace('.', ',') + ' s' : String(e && e.message || e) + (e && e.cause ? ' (' + (e.cause.code || e.cause.message || e.cause) + ')' : '')).slice(0, 160)}); }
    }
    const bad = out.find((x) => !x.ok), detail = bad ? (bad.status ? bad.status + (bad.reason ? ' ' + bad.reason : '') : 'réseau : ' + (bad.error || '?')) + (bad.service ? ' (' + bad.service + ')' : '') : '';
    S.push.sent = (S.push.sent || 0) + out.filter((x) => x.ok).length; S.push.last = {at: Date.now(), title: msg.title, ok: out.filter((x) => x.ok).length, total: out.length, ...(detail ? {detail} : {})}; save();
    log('notification « ' + msg.title + ' » : ' + out.filter((x) => x.ok).length + '/' + out.length + (detail ? ' · refus : ' + detail : ''));
    return out;
  }
  return {publicKey, subscribe, unsubscribe, send, vues, notifs: () => S.notifs, status: () => ({publicKey: publicKey(), count: S.push.subs.length, prefs: S.push.prefs, last: S.push.last || null})};
}
