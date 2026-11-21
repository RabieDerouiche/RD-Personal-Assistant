/* JARVIS OS 0.40.0 : la voix Google Chirp 3 HD, plus naturelle que Pierre (Piper). Choix du propriétaire (QCM du 21/11/2026) :
   l'essayer « tant que je suis notifié avant de passer sur du payant ». Gratuite jusqu'à 1 million de caractères par mois (puis 30 $
   le million : tarif Google relevé le 21/11/2026 par la recherche) : JARVIS compte les caractères envoyés, prévient à 80 % de son
   plafond (900 000 par défaut, sous la part gratuite) et repasse sur Pierre au plafond jusqu'au mois suivant.
   Rien ne part chez Google tant que le propriétaire n'a pas posé lui-même un accès sur le serveur (JARVIS ne le demande jamais) :
   fichier DATA/voix-google.json (mode 600), écrit par la session « Serveur JARVIS » : {"cle": "<clé d'API limitée à Text-to-Speech>"}
   ou le JSON d'un compte de service Google Cloud (type « service_account »). Synthèse : POST /v1/text:synthesize (synchrone),
   LINEAR16 à 24 kHz (WAV, comme Pierre : rien ne change côté iPhone). */
import crypto from 'node:crypto';
import fs from 'node:fs';

const LANGUE = 'fr-FR';
/* les voix Chirp 3 HD documentées par Google (30 noms ; leur présence en fr-FR est vérifiée par la liste des voix) */
export const VOIX_CHIRP = {Charon: 'homme', Orus: 'homme', Puck: 'homme', Fenrir: 'homme', Iapetus: 'homme', Algieba: 'homme', Alnilam: 'homme', Achird: 'homme', Algenib: 'homme', Enceladus: 'homme', Rasalgethi: 'homme', Sadachbia: 'homme', Sadaltager: 'homme', Schedar: 'homme', Umbriel: 'homme', Zubenelgenubi: 'homme',
  Aoede: 'femme', Kore: 'femme', Leda: 'femme', Zephyr: 'femme', Achernar: 'femme', Autonoe: 'femme', Callirrhoe: 'femme', Despina: 'femme', Erinome: 'femme', Gacrux: 'femme', Laomedeia: 'femme', Pulcherrima: 'femme', Sulafat: 'femme', Vindemiatrix: 'femme'};
export const VOIX_DEFAUT = 'fr-FR-Chirp3-HD-Charon';
export const nomOk = (n) => /^fr-FR-Chirp3-HD-[A-Z][a-z]+$/.test(String(n || ''));

export function createVoixGoogle({fichier, compteurFichier, base = 'https://texttospeech.googleapis.com', plafond = 900000, now = Date.now, alerte = () => {}, log = () => {}}) {
  let jet = {t: '', exp: 0}, LISTE = {at: 0, voix: null};
  /* l'accès posé par lui : une clé d'API, ou un compte de service ; null sinon */
  function acces() {
    let j; try { j = JSON.parse(fs.readFileSync(fichier, 'utf8')); } catch { return null; }
    if (j && typeof j.cle === 'string' && j.cle.length > 10) return {cle: j.cle};
    if (j && j.type === 'service_account' && j.client_email && j.private_key) return {sa: {email: j.client_email, cle: j.private_key, uri: j.token_uri || 'https://oauth2.googleapis.com/token'}};
    return null;
  }
  /* compte de service : un jeton OAuth signé par sa clé (JWT RS256), gardé jusqu'à une minute avant sa fin */
  async function jeton(sa) {
    if (jet.t && jet.exp > now() + 60e3) return jet.t;
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'), iat = Math.floor(now() / 1000);
    const corps = b64({alg: 'RS256', typ: 'JWT'}) + '.' + b64({iss: sa.email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: sa.uri, iat, exp: iat + 3600});
    const sig = crypto.createSign('RSA-SHA256').update(corps).sign(sa.cle, 'base64url');
    const r = await fetch(sa.uri, {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: corps + '.' + sig}).toString()});
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error('jeton Google refusé (' + r.status + ')');
    jet = {t: j.access_token, exp: now() + (j.expires_in || 3600) * 1000};
    return jet.t;
  }
  async function appel(chemin, corps) {
    const a = acces(); if (!a) throw new Error('aucun accès Google posé sur le serveur');
    const h = {'content-type': 'application/json'};
    if (a.cle) h['x-goog-api-key'] = a.cle; else h.authorization = 'Bearer ' + await jeton(a.sa);
    const r = await fetch(base + chemin, {method: corps ? 'POST' : 'GET', headers: h, body: corps ? JSON.stringify(corps) : undefined});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Google ' + r.status + (j.error && j.error.message ? ' : ' + String(j.error.message).slice(0, 160) : ''));
    return j;
  }
  /* le compteur du mois (UTC) : caractères envoyés, alertes déjà données */
  const mois = () => new Date(now()).toISOString().slice(0, 7);
  function compteur() {
    let c; try { c = JSON.parse(fs.readFileSync(compteurFichier, 'utf8')); } catch { c = null; }
    if (!c || c.mois !== mois()) c = {mois: mois(), caracteres: 0, appels: 0, alerte80: false, alerteMax: false};
    return c;
  }
  const garder = (c) => { const tmp = compteurFichier + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(c), {mode: 0o600}); fs.renameSync(tmp, compteurFichier); };
  const longueur = (t) => [...String(t)].length;   /* Google compte les caractères, espaces compris */
  function etat() {
    const c = compteur();
    return {pret: !!acces(), mois: c.mois, caracteres: c.caracteres, appels: c.appels, plafond, pause: c.caracteres >= plafond || !!c.alerteMax, gratuit: 1000000};
  }
  /* la synthèse : null si pas d'accès, au plafond ou en erreur (l'appelant reprend Pierre) */
  async function dire(texte, nom, sortie) {
    const t = String(texte || '').trim(); if (!t || !acces()) return null;
    const c = compteur(), n = longueur(t);
    if (c.alerteMax) return null;   /* plafond atteint ce mois-ci : Pierre jusqu'au 1er (pas d'alternance d'une phrase à l'autre) */
    if (c.caracteres + n > plafond) {
      if (!c.alerteMax) { c.alerteMax = true; garder(c); alerte({titre: 'Voix Google en pause', texte: 'Plafond de ' + plafond.toLocaleString('fr-FR') + ' caractères atteint ce mois-ci (part gratuite : 1 million). Pierre reprend jusqu’au 1er.'}); }
      return null;
    }
    let j;
    try { j = await appel('/v1/text:synthesize', {input: {text: t}, voice: {languageCode: LANGUE, name: nomOk(nom) ? nom : VOIX_DEFAUT}, audioConfig: {audioEncoding: 'LINEAR16', sampleRateHertz: 24000}}); }
    catch (e) { log('voix Google : ' + (e && e.message || e)); return null; }
    if (!j.audioContent) return null;
    fs.writeFileSync(sortie, Buffer.from(j.audioContent, 'base64'));
    const c2 = compteur(); c2.caracteres += n; c2.appels++;
    if (!c2.alerte80 && c2.caracteres >= plafond * 0.8) { c2.alerte80 = true; alerte({titre: 'Voix Google : 80 % du plafond', texte: c2.caracteres.toLocaleString('fr-FR') + ' caractères sur ' + plafond.toLocaleString('fr-FR') + ' ce mois-ci. Au plafond, Pierre reprend tout seul : rien de payant.'}); }
    garder(c2);
    return sortie;
  }
  /* les voix Chirp 3 HD disponibles en français (liste de Google, gardée un jour) */
  async function voix() {
    if (LISTE.voix && now() - LISTE.at < 864e5) return LISTE.voix;
    const j = await appel('/v1/voices?languageCode=' + LANGUE);
    const v = (j.voices || []).map((x) => x.name).filter(nomOk).sort().map((n) => ({nom: n, court: n.split('-').pop(), genre: VOIX_CHIRP[n.split('-').pop()] || ''}));
    LISTE = {at: now(), voix: v};
    return v;
  }
  return {etat, dire, voix, pret: () => !!acces()};
}
