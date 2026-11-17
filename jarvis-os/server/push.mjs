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

export function createPush({S, save, log = () => {}, allowHttp = false}) {
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
  /* message : {title, body, url, badge, tag}. Envoyé à chaque appareil abonné ; un abonnement expiré (404, 410) est retiré. */
  async function send(msg, opts = {}) {
    const subs = S.push.subs.slice(), out = [];
    /* format « déclaratif » de Safari (18.4 et plus), lu aussi par notre service worker sur les autres navigateurs */
    const payload = JSON.stringify({web_push: 8030, notification: {title: String(msg.title || 'JARVIS').slice(0, 120), body: String(msg.body || '').slice(0, 600), navigate: msg.url || '/', lang: 'fr-FR', tag: msg.tag || undefined, app_badge: msg.badge != null ? String(msg.badge) : undefined}});
    for (const s of subs) {
      try {
        const body = encrypt({payload, p256dh: s.keys.p256dh, auth: s.keys.auth});
        const r = await fetch(s.endpoint, {method: 'POST', body, headers: {'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: String(opts.ttl || 86400), urgency: opts.urgency || 'normal',
          ...(msg.tag ? {topic: String(msg.tag).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'jarvis'} : {}), authorization: vapidAuth({endpoint: s.endpoint, vapid: S.push.vapid, subject: S.push.subject || 'https://jarvis.invalid'})}});
        if (r.status === 404 || r.status === 410) unsubscribe(s.endpoint);
        out.push({status: r.status, ok: r.status >= 200 && r.status < 300});
      } catch (e) { out.push({status: 0, ok: false, error: String(e && e.message || e).slice(0, 120)}); }
    }
    S.push.sent = (S.push.sent || 0) + out.filter((x) => x.ok).length; S.push.last = {at: Date.now(), title: msg.title, ok: out.filter((x) => x.ok).length, total: out.length}; save();
    log('notification « ' + msg.title + ' » : ' + out.filter((x) => x.ok).length + '/' + out.length);
    return out;
  }
  return {publicKey, subscribe, unsubscribe, send, status: () => ({publicKey: publicKey(), count: S.push.subs.length, prefs: S.push.prefs, last: S.push.last || null})};
}
