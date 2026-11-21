/* JARVIS OS 0.40.0 : la voix Google Chirp 3 HD, plus naturelle que Pierre (Piper). Choix du propriétaire (QCM du 21/11/2026) :
   l'essayer « tant que je suis notifié avant de passer sur du payant ». Gratuite jusqu'à 1 million de caractères par mois (puis 30 $
   le million : tarif Google relevé le 21/11/2026 par la recherche) : JARVIS compte ce qu'il envoie, prévient à 80 % et à 95 % de son
   plafond (990 000 par défaut depuis 0.45.0, juste sous la part gratuite) et repasse sur Pierre au plafond jusqu'au mois suivant.
   0.47.0 (sa demande du 21/11/2026 : « qu'il ne commence pas à facturer et qu'on fasse le switch avant, c'est primordial, pas le droit
   à l'erreur ») : au moindre doute, Pierre parle.
   - On compte les octets du texte (« é » en vaut 2) : jamais moins que les caractères que Google facture.
   - On compte avant d'appeler Google, et rien n'est rendu si l'appel échoue (Google a pu le facturer quand même).
   - La place est prise d'un seul tenant (aucune attente entre le contrôle et l'écriture) : deux phrases en même temps ne passent pas le plafond.
   - Le compteur est gardé en double (son fichier, et une copie dans l'état du serveur) ; la plus haute des deux fait foi ;
     un compteur présent mais illisible, sans copie lisible : Google est coupé jusqu'au mois suivant.
   - Un plafond du jour (100 000 par défaut) arrête une boucle qui viderait le mois en quelques heures.
   - Après une erreur de Google, Pierre parle un moment (1, 2, 4… jusqu'à 30 minutes) : pas d'attente à chaque phrase pendant une panne.
   Rien ne part chez Google tant que le propriétaire n'a pas posé lui-même un accès sur le serveur (JARVIS ne le demande jamais) :
   fichier DATA/voix-google.json (mode 600) : {"cle": "<clé d'API limitée à Text-to-Speech>"} (collée dans Réglages) ou le JSON
   d'un compte de service Google Cloud (type « service_account »). Synthèse : POST /v1/text:synthesize (synchrone), LINEAR16 à 24 kHz
   (WAV, comme Pierre : rien ne change côté iPhone). */
import crypto from 'node:crypto';
import fs from 'node:fs';

const LANGUE = 'fr-FR';
/* les voix Chirp 3 HD documentées par Google (30 noms ; leur présence en fr-FR est vérifiée par la liste des voix) */
export const VOIX_CHIRP = {Charon: 'homme', Orus: 'homme', Puck: 'homme', Fenrir: 'homme', Iapetus: 'homme', Algieba: 'homme', Alnilam: 'homme', Achird: 'homme', Algenib: 'homme', Enceladus: 'homme', Rasalgethi: 'homme', Sadachbia: 'homme', Sadaltager: 'homme', Schedar: 'homme', Umbriel: 'homme', Zubenelgenubi: 'homme',
  Aoede: 'femme', Kore: 'femme', Leda: 'femme', Zephyr: 'femme', Achernar: 'femme', Autonoe: 'femme', Callirrhoe: 'femme', Despina: 'femme', Erinome: 'femme', Gacrux: 'femme', Laomedeia: 'femme', Pulcherrima: 'femme', Sulafat: 'femme', Vindemiatrix: 'femme'};
export const VOIX_DEFAUT = 'fr-FR-Chirp3-HD-Charon';
/* 0.47.0 : les voix d'homme posées à comparer d'abord pour JARVIS (le choix se fait à l'oreille ; Charon reste celle par défaut) */
export const VOIX_CONSEILLEES = ['Charon', 'Iapetus', 'Algieba', 'Orus'];
export const nomOk = (n) => /^fr-FR-Chirp3-HD-[A-Z][a-z]+$/.test(String(n || ''));
/* ce que l'on compte : les octets UTF-8, toujours au moins le nombre de caractères (espaces compris) que Google facture */
export const longueur = (t) => Buffer.byteLength(String(t || ''), 'utf8');
const MAX_APPEL = 4800;   /* Google refuse plus de 5 000 octets par demande ; JARVIS lui envoie une phrase à la fois */

export function createVoixGoogle({fichier, compteurFichier, base = 'https://texttospeech.googleapis.com', plafond = 990000, plafondJour = 100000, now = Date.now, alerte = () => {}, log = () => {},
  miroir = {lire: () => null, ecrire: () => {}}}) {
  let jet = {t: '', exp: 0}, LISTE = {at: 0, voix: null};
  let ERR = {n: 0, jusqu: 0, dernier: null}, OK = null, REFUS = '';
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
    const ctl = new AbortController(), minuteur = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await fetch(base + chemin, {method: corps ? 'POST' : 'GET', headers: h, body: corps ? JSON.stringify(corps) : undefined, signal: ctl.signal});
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error('Google ' + r.status + (j.error && j.error.message ? ' : ' + String(j.error.message).slice(0, 160) : ''));
      return j;
    } finally { clearTimeout(minuteur); }
  }
  /* le mois et le jour de facturation de Google : heure du Pacifique (0.44.0 : le compteur repartait sinon 8 à 9 heures trop tôt) */
  const jourP = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(now()));
  const mois = () => jourP().slice(0, 7);
  const neuf = () => ({mois: mois(), caracteres: 0, appels: 0, jour: jourP(), jourOctets: 0, alerte80: false, alerte95: false, alerteMax: false, alerteJour: '', alerteIllisible: false});
  /* une copie lue : {etat: 'absent' | 'illisible' | 'ok', c} */
  const lu = (f) => { try { const c = JSON.parse(fs.readFileSync(f, 'utf8')); return c && typeof c === 'object' && typeof c.mois === 'string' ? {etat: 'ok', c} : {etat: 'illisible'}; } catch (e) { return {etat: e && e.code === 'ENOENT' ? 'absent' : 'illisible'}; } };
  /* le compteur du mois : la plus haute des copies lisibles ; un fichier illisible sans autre copie lisible du mois : bloqué (Pierre) */
  function compteur() {
    const f = lu(compteurFichier); let m; try { m = miroir.lire(); } catch { m = null; }
    const c = neuf(), copies = [f.etat === 'ok' ? f.c : null, m && typeof m === 'object' && typeof m.mois === 'string' ? m : null].filter((x) => x && x.mois === c.mois);
    for (const x of copies) {
      c.caracteres = Math.max(c.caracteres, +x.caracteres || 0); c.appels = Math.max(c.appels, +x.appels || 0);
      if (x.jour === c.jour) c.jourOctets = Math.max(c.jourOctets, +x.jourOctets || 0);
      for (const k of ['alerte80', 'alerte95', 'alerteMax', 'alerteIllisible']) c[k] = c[k] || !!x[k];
      if (x.alerteJour === c.jour) c.alerteJour = c.jour;
    }
    if (f.etat === 'illisible' && !copies.length) c.bloque = true;
    return c;
  }
  const garder = (c) => {
    const {bloque, ...k} = c, tmp = compteurFichier + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(k), {mode: 0o600}); fs.renameSync(tmp, compteurFichier);
    try { miroir.ecrire({...k}); } catch { /* la copie de l'état du serveur : au mieux */ }
  };
  const nbFr = (n) => Number(n || 0).toLocaleString('fr-FR');
  /* peut-on envoyer n octets maintenant ? (seules les alertes sont écrites ici) */
  function verdict(n, force) {
    const c = compteur();
    if (c.bloque || c.alerteIllisible) {
      if (!c.alerteIllisible) { c.alerteIllisible = true; c.alerteMax = true; c.caracteres = Math.max(c.caracteres, plafond); try { garder(c); } catch { /* rien */ }
        alerte({titre: 'Voix Google coupée', texte: 'Son compteur est illisible : par prudence, Pierre parle jusqu’au 1er du mois.'}); }
      return {ok: false, raison: 'compteur illisible : Pierre jusqu’au 1er du mois, par prudence', c};
    }
    if (c.alerteMax) return {ok: false, raison: 'plafond du mois atteint : Pierre jusqu’au 1er', c};
    if (n > MAX_APPEL) return {ok: false, raison: 'texte trop long pour une seule demande', c};
    if (c.caracteres + n > plafond) {
      c.alerteMax = true; garder(c);
      alerte({titre: 'Voix Google en pause', texte: 'Plafond de ' + nbFr(plafond) + ' atteint ce mois-ci (part gratuite : 1 million). Pierre reprend jusqu’au 1er : rien de payant.'});
      return {ok: false, raison: 'plafond du mois atteint : Pierre jusqu’au 1er', c};
    }
    if (c.jourOctets + n > plafondJour) {
      if (c.alerteJour !== c.jour) { c.alerteJour = c.jour; garder(c); alerte({titre: 'Voix Google : plafond du jour', texte: nbFr(plafondJour) + ' aujourd’hui : Pierre parle jusqu’à demain, par prudence.'}); }
      return {ok: false, raison: 'plafond du jour atteint : Pierre jusqu’à demain', c};
    }
    if (!force && ERR.jusqu > now()) return {ok: false, raison: 'Google en erreur (' + (ERR.dernier ? ERR.dernier.message : '?') + ') : Pierre parle un moment', c};
    return {ok: true, c};
  }
  /* l'état (sans rien écrire) : compteurs, plafonds, pauses, dernière erreur, dernière phrase dite par Google */
  function etat() {
    const c = compteur();
    return {pret: !!acces(), mois: c.mois, caracteres: c.caracteres, appels: c.appels, plafond, gratuit: 1000000, comptage: 'octets',
      aujourdhui: c.jourOctets, plafondJour, pause: !!(c.alerteMax || c.caracteres >= plafond || c.bloque || c.alerteIllisible), pauseJour: c.alerteJour === c.jour || c.jourOctets >= plafondJour,
      bloque: !!(c.bloque || c.alerteIllisible), erreur: ERR.dernier, horsErreurJusqu: ERR.jusqu > now() ? ERR.jusqu : 0, dernierSucces: OK, refus: REFUS};
  }
  /* la synthèse : le fichier écrit, ou null (pas d'accès, plafond, panne, erreur : l'appelant reprend Pierre) ; info.raison dit pourquoi.
     force (boutons « Vérifier » et « Écouter ») : essaie même juste après une erreur ; jamais au-delà d'un plafond. */
  async function dire(texte, nom, sortie, {force = false, info = {}} = {}) {
    const t = String(texte || '').trim(); REFUS = info.raison = '';
    if (!t) return null;
    if (!acces()) { REFUS = info.raison = 'aucune clé Google posée'; return null; }
    const n = longueur(t), v = verdict(n, force);
    if (!v.ok) { REFUS = info.raison = v.raison; return null; }
    /* la place est prise avant l'appel, sans attente entre le contrôle et l'écriture ; rien n'est rendu ensuite */
    const c = v.c; c.caracteres += n; c.appels++; c.jourOctets += n;
    const a95 = !c.alerte95 && c.caracteres >= plafond * 0.95, a80 = !a95 && !c.alerte80 && c.caracteres >= plafond * 0.8;
    if (a95) c.alerte95 = c.alerte80 = true; else if (a80) c.alerte80 = true;
    garder(c);
    if (a95) alerte({titre: 'Voix Google : 95 % du plafond', texte: 'Plus que ' + nbFr(plafond - c.caracteres) + ' ce mois-ci ; ensuite Pierre, jusqu’au 1er. Rien de payant.'});
    else if (a80) alerte({titre: 'Voix Google : 80 % du plafond', texte: nbFr(c.caracteres) + ' sur ' + nbFr(plafond) + ' ce mois-ci. Au plafond, Pierre reprend tout seul : rien de payant.'});
    let j;
    try { j = await appel('/v1/text:synthesize', {input: {text: t}, voice: {languageCode: LANGUE, name: nomOk(nom) ? nom : VOIX_DEFAUT}, audioConfig: {audioEncoding: 'LINEAR16', sampleRateHertz: 24000}}); }
    catch (e) { erreur(e, info); return null; }
    if (!j.audioContent) { erreur(new Error('réponse de Google sans son'), info); return null; }
    fs.writeFileSync(sortie, Buffer.from(j.audioContent, 'base64'));
    ERR = {n: 0, jusqu: 0, dernier: ERR.dernier}; OK = {at: now(), nom: nomOk(nom) ? nom : VOIX_DEFAUT, octets: n};
    return sortie;
  }
  /* une erreur de Google : Pierre parle 1, 2, 4… minutes (30 au plus), pour ne pas attendre Google à chaque phrase pendant une panne */
  function erreur(e, info) {
    const msg = String((e && e.name === 'AbortError' ? 'Google n’a pas répondu en 15 s' : e && e.message) || e).slice(0, 220);
    ERR = {n: ERR.n + 1, jusqu: now() + Math.min(30, 2 ** ERR.n) * 60e3, dernier: {at: now(), message: msg}};
    REFUS = info.raison = 'erreur de Google : ' + msg;
    log('voix Google : ' + msg);
  }
  /* les voix Chirp 3 HD disponibles en français (liste de Google, gardée un jour ; cette liste n'est pas facturée) */
  async function voix() {
    if (LISTE.voix && now() - LISTE.at < 864e5) return LISTE.voix;
    const j = await appel('/v1/voices?languageCode=' + LANGUE);
    const v = (j.voices || []).map((x) => x.name).filter(nomOk).sort().map((n) => { const court = n.split('-').pop(); return {nom: n, court, genre: VOIX_CHIRP[court] || '', conseillee: VOIX_CONSEILLEES.includes(court)}; });
    LISTE = {at: now(), voix: v};
    return v;
  }
  return {etat, dire, voix, pret: () => !!acces(), raison: () => REFUS};
}
