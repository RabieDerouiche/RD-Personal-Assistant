/* sceller.mjs — scelle la phrase du coffre pour jarvis-coffre SEUL (ouverture depuis l'app JARVIS, coffre.mjs).
 *
 * Module pour le navigateur (Safari, WebCrypto seulement : crypto.subtle, donc une page en https) ; il tourne tel
 * quel sous Node 22, où le banc s'en sert. Aucune dépendance, aucun réseau, aucun journal, rien de gardé.
 *
 *   import {scellerPhrase} from './sceller.mjs';
 *   const {cle, defi} = …réponse de « cle-ouverture », passée par le serveur de JARVIS… ;
 *   const paquet = await scellerPhrase(phrase, cle, defi);     // {epk, iv, ct}, base64url sans « = »
 *   …le serveur de JARVIS passe {commande: 'ouvrir-scelle', ...paquet} à service.sock, sans pouvoir l'ouvrir…
 *
 * Le paquet : epk = clé publique P-256 éphémère de la page (point brut non compressé, 65 octets) ; secret =
 * ECDH(epk, clé du coffre) ; clé = HKDF-SHA256(secret, sel = les 32 octets du défi, info = « jarvis-coffre ouverture
 * v1 », 32 octets) ; ct = AES-256-GCM (iv de 12 octets tiré au hasard, étiquette de 16 octets à la fin, AAD = la même
 * info) du JSON UTF-8 {"phrase":"…","defi":"…"}, complété par des espaces à un multiple de 256 octets pour que le
 * relais ne lise pas la longueur de la phrase. Un défi ne sert qu'une fois et vit 2 minutes : une clé et un défi
 * neufs à chaque essai. La phrase est scellée telle quelle (à la page de retirer une espace collée aux bords).
 * Effacé ici : le clair et le secret partagé (tampons) ; la clé éphémère et la clé AES ne sont pas exportables.
 * Ce que le langage ne permet pas d'effacer : la chaîne `phrase` elle-même (à la page de vider son champ). */
const INFO = 'jarvis-coffre ouverture v1', BLOC = 256;

function deB64u(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('clé ou défi du coffre mal formé');
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')), o = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i);
  return o;
}
function enB64u(o) {
  let s = '';
  for (let i = 0; i < o.length; i++) s += String.fromCharCode(o[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function scellerPhrase(phrase, cleB64, defiB64) {
  if (typeof phrase !== 'string' || !phrase) throw new Error('phrase manquante');
  const C = globalThis.crypto, enc = new TextEncoder(), info = enc.encode(INFO);
  const cle = deB64u(cleB64), defi = deB64u(defiB64);
  if (cle.length !== 65 || cle[0] !== 4 || defi.length !== 32) throw new Error('clé ou défi du coffre mal formé');
  const json = enc.encode(JSON.stringify({phrase, defi: defiB64}));
  const clair = new Uint8Array(Math.ceil(json.length / BLOC) * BLOC).fill(32);   // des espaces après le JSON : toujours du JSON
  clair.set(json); json.fill(0);
  let secret = null;
  try {
    const coffre = await C.subtle.importKey('raw', cle, {name: 'ECDH', namedCurve: 'P-256'}, false, []);
    const paire = await C.subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, false, ['deriveBits']);
    secret = new Uint8Array(await C.subtle.deriveBits({name: 'ECDH', public: coffre}, paire.privateKey, 256));
    const base = await C.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
    const k = await C.subtle.deriveKey({name: 'HKDF', hash: 'SHA-256', salt: defi, info}, base, {name: 'AES-GCM', length: 256}, false, ['encrypt']);
    const iv = C.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await C.subtle.encrypt({name: 'AES-GCM', iv, additionalData: info, tagLength: 128}, k, clair));
    const epk = new Uint8Array(await C.subtle.exportKey('raw', paire.publicKey));
    return {epk: enB64u(epk), iv: enB64u(iv), ct: enB64u(ct)};
  } finally { clair.fill(0); if (secret) secret.fill(0); }
}
