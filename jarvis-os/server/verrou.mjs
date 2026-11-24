/* verrou.mjs — le verrou de l'app par passkey (0.75.0, ses choix du 24/11/2026 : « Face ID à chaque ouverture », « Tout dans NordPass »).
 *
 * Un iPhone volé déjà déverrouillé ne doit plus ouvrir JARVIS : le jeton de l'appareil (gardé par l'app) ne suffit plus. Verrou actif,
 * chaque appareil relié doit prouver une passkey (Face ID, WebAuthn) pour obtenir une « ouverture », gardée ICI, en mémoire seulement,
 * liée à cet appareil : rien de plus n'est confié à l'app, donc rien de plus ne peut lui être volé. L'ouverture tombe après `inactif`
 * (5 min sans aucune demande : l'app passée à l'arrière-plan), après `duree` (12 h), quand l'app se relance (elle demande elle-même à
 * être verrouillée) et à chaque redémarrage du serveur.
 *
 * La passkey n'est ici qu'une preuve d'identité (aucun secret n'en sort : NordPass ne rend pas de clé « prf », son essai du 24/11/2026).
 * Vérifié à chaque preuve : le défi (à usage unique, 2 minutes, lié à l'appareil et au geste), l'origine de la page, l'empreinte du
 * domaine (rpId), « utilisateur présent » ET « utilisateur vérifié » (Face ID), la signature (ES256 ou RS256) avec la clé publique
 * reçue à la création, et le compteur quand la passkey en tient un. Les clés publiques vont dans state.json : elles ne sont pas secrètes.
 * Le verrou ne s'active qu'après une preuve réussie depuis l'app même (l'activation est l'essai) ; le désactiver, ajouter ou retirer une
 * passkey demande une preuve de moins de 2 minutes. Secours, sans passkey : `node server.mjs verrou --retirer`, service arrêté.
 * Hors du verrou, à savoir : le Raccourci Siri (sa propre clé), les invitations et les assistants MCP (leurs propres jetons). */
import crypto from 'node:crypto';

const b64u = (b) => Buffer.from(b).toString('base64url');
const deB64u = (s, max) => (typeof s === 'string' && s.length > 0 && s.length <= max && /^[A-Za-z0-9_-]+$/.test(s) ? Buffer.from(s, 'base64url') : null);
const sha256 = (b) => crypto.createHash('sha256').update(b).digest();

/* CBOR, le strict nécessaire pour un objet d'attestation et une clé COSE : entiers, octets, texte, tableaux, tables ; longueurs définies.
   Rend [valeur, position suivante] ; lève sur tout le reste (la création est alors refusée). */
export function cbor(b, i = 0, fond = 0) {
  if (fond > 8 || i >= b.length) throw new Error('cbor');
  const t = b[i] >> 5, a = b[i] & 31; i++;
  let n;
  if (a < 24) n = a; else if (a === 24) { n = b[i]; i += 1; } else if (a === 25) { n = b.readUInt16BE(i); i += 2; } else if (a === 26) { n = b.readUInt32BE(i); i += 4; } else throw new Error('cbor');
  if (n === undefined || i > b.length) throw new Error('cbor');
  if (t === 0) return [n, i];
  if (t === 1) return [-1 - n, i];
  if (t === 2 || t === 3) { if (i + n > b.length) throw new Error('cbor'); const v = b.subarray(i, i + n); return [t === 3 ? v.toString('utf8') : v, i + n]; }
  if (t === 4) { if (n > 64) throw new Error('cbor'); const l = []; for (let k = 0; k < n; k++) { let v; [v, i] = cbor(b, i, fond + 1); l.push(v); } return [l, i]; }
  if (t === 5) { if (n > 64) throw new Error('cbor'); const m = new Map(); for (let k = 0; k < n; k++) { let c, v; [c, i] = cbor(b, i, fond + 1); [v, i] = cbor(b, i, fond + 1); m.set(c, v); } return [m, i]; }
  throw new Error('cbor');
}
/* la clé publique COSE d'une passkey → une clé de Node ; ES256 (P-256) ou RS256, rien d'autre */
function cleDeCose(m) {
  const kty = m.get(1), alg = m.get(3);
  if (kty === 2 && alg === -7 && m.get(-1) === 1 && Buffer.isBuffer(m.get(-2)) && m.get(-2).length === 32 && Buffer.isBuffer(m.get(-3)) && m.get(-3).length === 32)
    return {alg, jwk: {kty: 'EC', crv: 'P-256', x: b64u(m.get(-2)), y: b64u(m.get(-3))}};
  if (kty === 3 && alg === -257 && Buffer.isBuffer(m.get(-1)) && m.get(-1).length >= 256 && m.get(-1).length <= 1024 && Buffer.isBuffer(m.get(-2)) && m.get(-2).length <= 8)
    return {alg, jwk: {kty: 'RSA', n: b64u(m.get(-1)), e: b64u(m.get(-2))}};
  return null;
}

export function createVerrou({S, save, now, journal = () => {}, inactif = 5 * 60e3, duree = 12 * 3600e3, frais = 2 * 60e3}) {
  if (!S.verrou || typeof S.verrou !== 'object' || Array.isArray(S.verrou)) S.verrou = {actif: false, cles: []};
  const V = S.verrou; if (!Array.isArray(V.cles)) V.cles = []; V.actif = V.actif === true;
  const DEFI_VIE = 2 * 60e3, DEFIS_MAX = 16, CLES_MAX = 8, ATTENTE = 10 * 60e3;
  const defis = new Map();        /* défi → {exp, geste, appareil} */
  const ouvertures = new Map();   /* appareil (empreinte de son jeton) → {depuis, vu, preuve} ; jamais sur le disque */
  const confirmees = () => V.cles.filter((k) => k.confirmee);
  const menage = () => {
    const t = now();
    for (const [d, x] of defis) if (x.exp <= t) defis.delete(d);
    const n = V.cles.length; V.cles = V.cles.filter((k) => k.confirmee || t - k.at < ATTENTE); if (V.cles.length !== n) save();   /* une passkey créée mais jamais prouvée ne reste pas */
  };
  const defi = (geste, appareil) => { menage(); while (defis.size >= DEFIS_MAX) defis.delete(defis.keys().next().value); const d = b64u(crypto.randomBytes(32)); defis.set(d, {exp: now() + DEFI_VIE, geste, appareil}); return d; };
  const client = (cdj, geste, appareil, origine) => {
    let c; try { c = JSON.parse(cdj.toString('utf8')); } catch { return false; }
    if (!c || c.type !== geste || typeof c.challenge !== 'string' || c.origin !== origine || c.crossOrigin === true) return false;
    const x = defis.get(c.challenge); if (!x) return false;
    defis.delete(c.challenge);   /* usage unique, que la suite réussisse ou non */
    return x.exp > now() && x.geste === geste && x.appareil === appareil;
  };
  /* données de l'authentificateur : empreinte du domaine, « présent » (0x01) et « vérifié » (0x04, Face ID) */
  const authOk = (ad, rpId) => ad.length >= 37 && crypto.timingSafeEqual(ad.subarray(0, 32), sha256(rpId)) && (ad[32] & 0x05) === 0x05;
  const o = (appareil) => {
    const x = ouvertures.get(appareil); if (!x) return null;
    const t = now(); if (t - x.vu > inactif || t - x.depuis > duree) { ouvertures.delete(appareil); return null; }
    return x;
  };
  const recente = (appareil) => { const x = o(appareil); return !!x && now() - x.preuve <= frais; };
  const court = (id) => sha256(id).toString('hex').slice(0, 12);

  return {
    /* cet appareil passe-t-il ? Verrou éteint : oui. Sinon il lui faut une ouverture vivante, que chaque demande prolonge. */
    passe(appareil) { if (!V.actif) return true; const x = o(appareil); if (!x) return false; x.vu = now(); return true; },
    etat(appareil) {
      const x = o(appareil);
      return {actif: V.actif, ouvert: !V.actif || !!x, recente: recente(appareil), inactif: Math.round(inactif / 60e3),
        cles: confirmees().map((k) => ({id: court(k.id), nom: k.nom, at: k.at, vu: k.vu || 0}))};
    },
    verrouiller(appareil) { ouvertures.delete(appareil); },
    /* créer une passkey : les options pour navigator.credentials.create */
    optionsCreer(appareil, rpId) {
      if (V.cles.length >= CLES_MAX) return null;
      return {challenge: defi('webauthn.create', appareil), rp: {id: rpId, name: 'JARVIS'}, user: {id: b64u(crypto.randomBytes(16)), name: 'JARVIS', displayName: 'JARVIS'},
        pubKeyCredParams: [{type: 'public-key', alg: -7}, {type: 'public-key', alg: -257}], authenticatorSelection: {residentKey: 'preferred', userVerification: 'required'},
        attestation: 'none', excludeCredentials: V.cles.map((k) => ({type: 'public-key', id: k.id})), timeout: 120000};
    },
    creer(appareil, b, origine, rpId) {
      const cdj = deB64u(b && b.clientData, 4096), att = deB64u(b && b.attestation, 16384);
      if (!cdj || !att || !client(cdj, 'webauthn.create', appareil, origine)) return null;
      try {
        const ad = cbor(att)[0].get('authData');
        if (!Buffer.isBuffer(ad) || !authOk(ad, rpId) || !(ad[32] & 0x40) || ad.length < 55) return null;   /* 0x40 : la clé créée est jointe */
        const n = ad.readUInt16BE(53), id = ad.subarray(55, 55 + n); if (n < 1 || n > 1023 || ad.length < 55 + n + 10) return null;
        const cle = cleDeCose(cbor(ad, 55 + n)[0]); if (!cle) return null;
        crypto.createPublicKey({key: cle.jwk, format: 'jwk'});   /* lève si le point n'est pas sur la courbe */
        const idb = b64u(id); if (V.cles.some((k) => k.id === idb) || V.cles.length >= CLES_MAX) return null;
        const nom = String((b && b.nom) || '').replace(/[<>"\u0000-\u001f]/g, '').trim().slice(0, 40) || 'Passkey';
        V.cles.push({id: idb, alg: cle.alg, jwk: cle.jwk, compteur: ad.readUInt32BE(33), nom, at: now(), confirmee: false}); save();
        journal('verrou : passkey « ' + nom + ' » créée, en attente de sa première preuve');
        return {id: court(idb)};
      } catch { return null; }
    },
    /* prouver une passkey : les options pour navigator.credentials.get (permis à un appareil verrouillé : c'est ce qui l'ouvre) */
    optionsOuvrir(appareil, rpId) {
      menage(); if (!V.cles.length) return null;
      return {challenge: defi('webauthn.get', appareil), rpId, allowCredentials: V.cles.map((k) => ({type: 'public-key', id: k.id})), userVerification: 'required', timeout: 120000};
    },
    ouvrir(appareil, b, origine, rpId) {
      const cdj = deB64u(b && b.clientData, 4096), ad = deB64u(b && b.authData, 2048), sig = deB64u(b && b.signature, 2048), k = V.cles.find((x) => x.id === (b && b.id));
      if (!cdj || !ad || !sig || !client(cdj, 'webauthn.get', appareil, origine) || !k || !authOk(ad, rpId)) return false;
      let bon = false; try { bon = crypto.verify('sha256', Buffer.concat([ad, sha256(cdj)]), crypto.createPublicKey({key: k.jwk, format: 'jwk'}), sig); } catch { bon = false; }
      if (!bon) return false;
      const n = ad.readUInt32BE(33);
      if ((n || k.compteur) && n <= k.compteur) { journal('verrou : preuve refusée, le compteur de la passkey « ' + k.nom + ' » a reculé (copie ?)'); return false; }
      const t = now(), premiere = !k.confirmee; k.compteur = n; k.confirmee = true; k.vu = t; save();
      ouvertures.set(appareil, {depuis: t, vu: t, preuve: t});
      if (premiere) journal('verrou : passkey « ' + k.nom + ' » prouvée');
      return true;
    },
    /* les trois gestes qui changent le verrou : une preuve de moins de 2 minutes, depuis cet appareil */
    activer(appareil) { if (!recente(appareil) || !confirmees().length) return false; if (!V.actif) { V.actif = true; save(); journal('verrou de l’app activé'); } return true; },
    desactiver(appareil) { if (!recente(appareil)) return false; if (V.actif) { V.actif = false; save(); journal('verrou de l’app désactivé'); } return true; },
    retirer(appareil, id) {
      if (!recente(appareil)) return false;
      const k = V.cles.find((x) => court(x.id) === id); if (!k) return false;
      if (V.actif && k.confirmee && confirmees().length <= 1) return false;   /* jamais la dernière passkey d'un verrou actif : il s'enfermerait dehors */
      V.cles = V.cles.filter((x) => x !== k); save(); journal('verrou : passkey « ' + k.nom + ' » retirée');
      return true;
    },
  };
}
