#!/usr/bin/env node
/* jarvis-coffre — un coffre dont la clé n'est jamais sur le disque (docs/hermes-deroule.md, « Le coffre en mémoire »).
 *
 * Sur le disque (coffre.json, 0600) : la clé du coffre K (256 bits, tirée au hasard) enveloppée en AES-256-GCM par une
 * clé dérivée de sa phrase (scrypt N=2^17, r=8, p=1, sel de 32 octets), et chaque secret chiffré en AES-256-GCM avec K,
 * son nom et sa portée liés au chiffré (AAD) : un chiffré déplacé sous un autre nom ou une autre portée ne s'ouvre pas.
 * En mémoire, après `ouvrir` seulement : K. `fermer` (ou tout arrêt du processus) l'efface. Une copie du disque ou
 * d'une sauvegarde ne donne rien sans la phrase. Limite connue et acceptée : root sur le serveur allumé lit la mémoire.
 *
 * Deux prises unix, une demande JSON par ligne, une réponse JSON par ligne ({ok:true,…} / {ok:false, erreur, code}) :
 *   admin.sock   (0600, l'utilisateur du service ; root passe toujours) : creer, ouvrir, fermer, mettre, retirer,
 *                changer-phrase, etat. Aucune commande ne rend une valeur.
 *   service.sock (0660, groupe des clients : le serveur de JARVIS) : etat, lire (portée « service » seulement),
 *                ecrire (noms « jarvis-… », portée « service » imposée), fermer. Rien d'autre.
 * Un secret de portée « guichet » n'est rendu par aucune commande : seul avecSecret(), dans ce processus, le prête
 * le temps d'un appel (pour les futurs « gestes » d'une liste fermée ; aucun n'existe ici).
 *
 * Jamais écrit ni affiché, nulle part : la phrase, K, une valeur. Le journal ne porte que des noms et des états.
 * Ce que le langage ne permet pas d'effacer : les chaînes (la phrase et les valeurs le temps d'une demande JSON)
 * restent en mémoire jusqu'au passage du ramasse-miettes ; les tampons (K, clés dérivées, lignes reçues) sont remis
 * à zéro. D'où l'unité systemd : ni échange (MemorySwapMax=0), ni image mémoire (LimitCORE=0).
 * Aucune dépendance : node:crypto, node:net, node:fs. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';

export const NOM = /^[a-z0-9][a-z0-9-]{1,40}$/;
export const PORTEES = ['service', 'guichet'];
export const MAX_DEMANDE = 64 * 1024;      // octets, par ligne
const MAX_VALEUR = 32 * 1024;              // octets (UTF-8) : tient dans une demande, même échappée
const PHRASE_MIN = 20, PHRASE_MAX = 1024;
const N_DEFAUT = 2 ** 17, N_MIN = 2 ** 10, N_MAX = 2 ** 18;   // au-delà : 256 Mo et plus par essai, refusé (fichier trafiqué ?)
const ESSAIS_MAX = 5, FENETRE = 10 * 60_000, FREIN_DEFAUT = 2000;
const BLOC = 64;                           // une valeur est complétée à un multiple de 64 octets : le fichier ne dit pas sa longueur
const AAD_CLE = Buffer.from('jarvis-coffre:v1:cle');
const aadSecret = (nom, portee) => Buffer.from('jarvis-coffre:v1:secret\0' + nom + '\0' + portee);
const b64 = (b) => b.toString('base64');
const octets = (s, n) => typeof s === 'string' && s.length < 4 * MAX_DEMANDE && /^[A-Za-z0-9+/]*={0,2}$/.test(s)
  && (n == null ? s.length > 0 : Buffer.from(s, 'base64').length === n);
const puissanceDe2 = (n) => Number.isInteger(n) && n >= N_MIN && n <= N_MAX && (n & (n - 1)) === 0;

/* Un refus est une réponse normale ({ok:false}) ; toute autre erreur devient « erreur interne », sans son message. */
export class Refus extends Error { constructor(code, message) { super(message); this.code = code; } }
const refus = (code, message) => { throw new Refus(code, message); };

function sceller(cle, clair, aad) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', cle, iv);
  c.setAAD(aad);
  const ct = Buffer.concat([c.update(clair), c.final()]);
  return {iv: b64(iv), ct: b64(ct), tag: b64(c.getAuthTag())};
}
function desceller(cle, boite, aad) {   // lève si un seul bit du chiffré, de l'étiquette, du nom ou de la portée a changé
  const d = crypto.createDecipheriv('aes-256-gcm', cle, Buffer.from(boite.iv, 'base64'), {authTagLength: 16});
  d.setAAD(aad); d.setAuthTag(Buffer.from(boite.tag, 'base64'));
  const a = d.update(Buffer.from(boite.ct, 'base64'));   // clair non encore vérifié : effacé si final() refuse
  try { const b = d.final(), clair = Buffer.concat([a, b]); b.fill(0); return clair; } finally { a.fill(0); }
}
function rembourrer(valeur) {
  const b = Buffer.alloc(Math.max(BLOC, Math.ceil((valeur.length + 4) / BLOC) * BLOC));
  b.writeUInt32BE(valeur.length, 0); valeur.copy(b, 4); return b;
}
function derembourrer(b) {
  try {
    if (b.length < 4 || b.readUInt32BE(0) > b.length - 4) throw new Error('longueur');
    return Buffer.from(b.subarray(4, 4 + b.readUInt32BE(0)));
  } finally { b.fill(0); }
}
function deriver(phrase, kdf) {   // scrypt hors du fil principal ; 128·N·r octets le temps du calcul (128 Mo à N=2^17)
  return new Promise((oui, non) => {
    const p = Buffer.from(phrase.normalize('NFKC'), 'utf8');
    crypto.scrypt(p, Buffer.from(kdf.sel, 'base64'), 32, {N: kdf.N, r: kdf.r, p: kdf.p, maxmem: 256 * kdf.N * kdf.r + (1 << 20)},
      (e, cle) => { p.fill(0); if (e) non(e); else oui(cle); });
  });
}

/* Le coffre, sans les prises : c'est aussi le point d'entrée « dans le processus » (avecSecret).
 * fichier : coffre.json ; N : coût de scrypt à la création (le fichier porte ensuite le sien) ; frein : attente après
 * une phrase refusée ; maintenant, attendre, journal : remplaçables au banc. */
export function creerCoffre({fichier, N = N_DEFAUT, frein = FREIN_DEFAUT, maintenant = Date.now,
  attendre = (ms) => new Promise((r) => setTimeout(r, ms)), journal = () => {}} = {}) {
  if (typeof fichier !== 'string' || !fichier) throw new Error('fichier du coffre manquant');
  if (!puissanceDe2(N)) throw new Error('N de scrypt invalide (puissance de 2, de 2^10 à 2^18)');
  let K = null, doc = null, depuis = null;     // K et doc : en mémoire seulement, entre ouvrir et fermer
  let echecs = [], bloqueJusqu = 0, generation = 0;
  let file = Promise.resolve();                // creer, ouvrir, changer-phrase : un seul à la fois, frein compris
  const enFile = (f) => { const p = file.then(f, f); file = p.then(() => {}, () => {}); return p; };
  const horodate = () => new Date(maintenant()).toISOString().slice(0, 19) + 'Z';

  function charger() {   // null s'il n'y a pas de coffre ; refus si le fichier n'a pas exactement la forme attendue
    let brut, d;
    try { if (fs.statSync(fichier).size > 8 << 20) throw Object.assign(new Error(), {code: 'TROP_GROS'}); brut = fs.readFileSync(fichier, 'utf8'); }
    catch (e) { if (e.code === 'ENOENT') return null; refus('illisible', 'fichier du coffre illisible (' + (e.code || 'erreur') + ')'); }
    try { d = JSON.parse(brut); } catch { refus('illisible', 'fichier du coffre abîmé (ce n’est plus du JSON)'); }
    const forme = d && typeof d === 'object' && d.v === 1 && d.kdf && d.kdf.algo === 'scrypt' && puissanceDe2(d.kdf.N)
      && Number.isInteger(d.kdf.r) && d.kdf.r >= 1 && d.kdf.r <= 16 && Number.isInteger(d.kdf.p) && d.kdf.p >= 1 && d.kdf.p <= 4
      && octets(d.kdf.sel, 32) && d.cle && octets(d.cle.iv, 12) && octets(d.cle.ct, 32) && octets(d.cle.tag, 16)
      && d.secrets && typeof d.secrets === 'object' && !Array.isArray(d.secrets);
    if (!forme) refus('illisible', 'fichier du coffre abîmé (forme inattendue)');
    const secrets = new Map();   // une Map : un nom comme « constructor » reste un nom
    for (const [nom, s] of Object.entries(d.secrets)) {
      if (!NOM.test(nom) || !s || typeof s !== 'object' || !PORTEES.includes(s.portee) || !octets(s.iv, 12) || !octets(s.ct)
        || !octets(s.tag, 16) || typeof s.maj !== 'string' || s.maj.length > 40) refus('illisible', 'fichier du coffre abîmé (secret mal formé)');
      secrets.set(nom, {portee: s.portee, iv: s.iv, ct: s.ct, tag: s.tag, maj: s.maj});
    }
    return {kdf: {algo: 'scrypt', N: d.kdf.N, r: d.kdf.r, p: d.kdf.p, sel: d.kdf.sel}, cle: {iv: d.cle.iv, ct: d.cle.ct, tag: d.cle.tag}, secrets};
  }
  function enregistrer(d, nouveau = false) {   // atomique : fichier voisin en 0600, synchronisé, puis mis à la place
    const noms = [...d.secrets.keys()].sort();
    const texte = JSON.stringify({v: 1, kdf: d.kdf, cle: d.cle, secrets: Object.fromEntries(noms.map((n) => [n, d.secrets.get(n)]))}, null, 1) + '\n';
    const tmp = fichier + '.tmp-' + process.pid;
    try { fs.unlinkSync(tmp); } catch {}
    const fd = fs.openSync(tmp, 'wx', 0o600);
    try {
      try { fs.fchmodSync(fd, 0o600); fs.writeSync(fd, texte); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      if (nouveau) fs.linkSync(tmp, fichier); else fs.renameSync(tmp, fichier);   // link : n'écrase jamais un coffre existant
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch {}
      if (nouveau && e.code === 'EEXIST') refus('existe', 'un coffre existe déjà : rien n’a été changé');
      throw e;
    }
    if (nouveau) fs.unlinkSync(tmp);
    try { const dfd = fs.openSync(fichier.slice(0, fichier.lastIndexOf('/')) || '/', 'r'); try { fs.fsyncSync(dfd); } finally { fs.closeSync(dfd); } } catch {}
  }
  const courant = () => (K ? doc : charger());   // ouvert : la mémoire fait foi ; verrouillé : le disque, relu à chaque fois
  const ouvertOuRefus = () => { if (!K) refus('verrouille', 'coffre verrouillé'); };
  const nomOuRefus = (nom) => { if (typeof nom !== 'string' || !NOM.test(nom)) refus('nom', 'nom refusé : minuscules, chiffres et tirets, 2 à 41 caractères'); };
  function valeurOuRefus(v) {
    if (typeof v !== 'string' || !v) refus('valeur', 'valeur manquante');
    if (Buffer.byteLength(v, 'utf8') > MAX_VALEUR) refus('valeur', 'valeur trop longue (32 Kio au plus)');
  }
  function phraseNeuveOuRefus(p) {
    if (typeof p !== 'string') refus('demande', 'phrase manquante');
    const lettres = [...p.normalize('NFKC')];
    if (lettres.length < PHRASE_MIN) refus('phrase-courte', 'phrase trop courte : ' + PHRASE_MIN + ' caractères au moins');
    if (Buffer.byteLength(p, 'utf8') > PHRASE_MAX) refus('phrase-forme', 'phrase trop longue');
    if (p !== p.trim() || /[\u0000-\u001f\u007f]/.test(p)) refus('phrase-forme', 'phrase refusée : espace au début ou à la fin, ou caractère invisible (collage ?)');
    if (new Set(lettres).size < 8) refus('phrase-forme', 'phrase refusée : trop répétitive');
  }
  const phraseOuRefus = (p) => { if (typeof p !== 'string' || !p || Buffer.byteLength(p, 'utf8') > PHRASE_MAX) refus('demande', 'phrase manquante'); };

  function blocageOuRefus() {
    const reste = bloqueJusqu - maintenant();
    if (reste > 0) refus('bloque', 'trop d’essais ratés : réessaie dans ' + Math.ceil(reste / 60_000) + ' min');
  }
  /* Rend K si la phrase ouvre l'enveloppe ; sinon compte l'échec, attend (frein), puis refuse. Au 5e échec en
   * 10 minutes : plus aucun essai n'est étudié pendant 10 minutes (compte en mémoire : un redémarrage le remet à zéro,
   * mais qui peut redémarrer le service peut aussi lire le fichier). */
  async function essayer(phrase, d) {
    blocageOuRefus();
    const kek = await deriver(phrase, d.kdf);
    let k = null;
    try { k = desceller(kek, d.cle, AAD_CLE); } catch {} finally { kek.fill(0); }
    if (k && k.length === 32) { echecs = []; return k; }
    const t = maintenant();
    echecs = echecs.filter((e) => t - e < FENETRE); echecs.push(t);
    const bloque = echecs.length >= ESSAIS_MAX;
    if (bloque) { bloqueJusqu = t + FENETRE; echecs = []; }
    journal(bloque ? 'phrase refusée : ' + ESSAIS_MAX + ' essais ratés en 10 minutes, coffre bloqué 10 minutes' : 'phrase refusée (' + echecs.length + ' essai(s) raté(s) en 10 minutes)');
    await attendre(frein);
    refus('phrase', bloque ? 'phrase refusée ; trop d’essais ratés : coffre bloqué 10 minutes' : 'phrase refusée');
  }
  function dechiffrer(nom, s) {   // → tampon du clair, à effacer par l'appelant
    try { return derembourrer(desceller(K, s, aadSecret(nom, s.portee))); }
    catch { refus('abime', 'secret « ' + nom + ' » illisible : son chiffré, son nom ou sa portée a été modifié dans le fichier'); }
  }
  function poser(nom, portee, valeur) {
    const v = Buffer.from(valeur, 'utf8'), clair = rembourrer(v); v.fill(0);
    let s;
    try { s = {portee, ...sceller(K, clair, aadSecret(nom, portee)), maj: horodate()}; } finally { clair.fill(0); }
    const secrets = new Map(doc.secrets), remplace = secrets.has(nom);
    secrets.set(nom, s);
    enregistrer({...doc, secrets});   // le disque d'abord : la mémoire ne change que si l'écriture a tenu
    doc = {...doc, secrets};
    return remplace;
  }

  const coffre = {
    etat() {
      const d = courant();
      return {existe: !!d, ouvert: !!K, depuis: K ? depuis : null,
        secrets: d ? [...d.secrets.keys()].sort().map((nom) => ({nom, portee: d.secrets.get(nom).portee, maj: d.secrets.get(nom).maj})) : []};
    },
    blocage: () => Math.max(0, Math.ceil((bloqueJusqu - maintenant()) / 1000)),   // secondes restantes
    creer(phrase) {
      return enFile(async () => {
        phraseNeuveOuRefus(phrase);
        if (fs.existsSync(fichier)) refus('existe', 'un coffre existe déjà : rien n’a été changé');
        const kdf = {algo: 'scrypt', N, r: 8, p: 1, sel: b64(crypto.randomBytes(32))};
        const kek = await deriver(phrase, kdf), k = crypto.randomBytes(32);
        const d = {kdf, cle: sceller(kek, k, AAD_CLE), secrets: new Map()};
        kek.fill(0);
        try { enregistrer(d, true); } catch (e) { k.fill(0); throw e; }
        if (K) K.fill(0);
        K = k; doc = d; depuis = horodate();
        journal('coffre créé et ouvert');
        return {};
      });
    },
    ouvrir(phrase) {
      const gen = generation;   // un « fermer » arrivé après cette demande l'emporte, même si scrypt finit plus tard
      return enFile(async () => {
        phraseOuRefus(phrase);
        if (K) return {deja: true};
        const d = charger();
        if (!d) refus('absent', 'aucun coffre : jarvis-coffre creer');
        const k = await essayer(phrase, d);
        if (gen !== generation) { k.fill(0); refus('ferme', 'fermé pendant l’ouverture : coffre resté verrouillé'); }
        let frais = null;   // le disque relu après l'attente de scrypt (un « retirer » a pu passer) : c'est lui qu'on garde
        try { frais = charger(); } finally { if (!frais || frais.cle.ct !== d.cle.ct || frais.kdf.sel !== d.kdf.sel) k.fill(0); }
        if (!frais || frais.cle.ct !== d.cle.ct || frais.kdf.sel !== d.kdf.sel) refus('change', 'le coffre a changé pendant l’ouverture : recommence');
        K = k; doc = frais; depuis = horodate();
        journal('coffre ouvert (' + frais.secrets.size + ' secret(s))');
        return {};
      });
    },
    fermer() {   // toujours permis, des deux prises
      generation++;
      const etait = !!K;
      if (K) K.fill(0);
      K = null; doc = null; depuis = null;
      if (etait) journal('coffre fermé : clé effacée de la mémoire');
      return {etait};
    },
    mettre(nom, portee, valeur) {
      nomOuRefus(nom);
      if (!PORTEES.includes(portee)) refus('portee', 'portée inconnue : service ou guichet');
      valeurOuRefus(valeur); ouvertOuRefus();
      const remplace = poser(nom, portee, valeur);
      journal('secret « ' + nom + ' » ' + (remplace ? 'remplacé' : 'ajouté') + ' (portée ' + portee + ')');
      return {nom, portee, remplace};
    },
    retirer(nom) {   // sans la clé : ouvert ou verrouillé (c'est aussi la sortie quand un secret est devenu illisible)
      nomOuRefus(nom);
      const d = courant();
      if (!d) refus('absent', 'aucun coffre');
      if (!d.secrets.has(nom)) refus('inconnu', 'secret inconnu');
      const secrets = new Map(d.secrets); secrets.delete(nom);
      enregistrer({...d, secrets});
      if (K) doc = {...doc, secrets};
      journal('secret « ' + nom + ' » retiré');
      return {nom};
    },
    /* Nouvelle phrase ET nouvelle clé : tous les secrets sont rechiffrés. Une ancienne copie du disque avec
     * l'ancienne phrase n'ouvre donc rien de ce qui sera écrit ensuite. L'état (ouvert ou verrouillé) ne change pas. */
    changerPhrase(ancienne, nouvelle) {
      return enFile(async () => {
        phraseOuRefus(ancienne); phraseNeuveOuRefus(nouvelle);
        const avant = courant();
        if (!avant) refus('absent', 'aucun coffre');
        const k = await essayer(ancienne, avant);
        const kdf = {algo: 'scrypt', N, r: 8, p: 1, sel: b64(crypto.randomBytes(32))};
        let kek;
        try { kek = await deriver(nouvelle, kdf); } catch (e) { k.fill(0); throw e; }
        /* à partir d'ici, plus aucune attente : l'état relu est celui qui sera remplacé */
        const d = courant(), k2 = crypto.randomBytes(32), secrets = new Map();
        try {
          if (!d) refus('absent', 'aucun coffre');
          for (const [nom, s] of d.secrets) {
            let clair;
            try { clair = desceller(k, s, aadSecret(nom, s.portee)); }
            catch { refus('abime', 'secret « ' + nom + ' » illisible : retire-le (jarvis-coffre retirer ' + nom + ') puis recommence'); }
            try { secrets.set(nom, {portee: s.portee, ...sceller(k2, clair, aadSecret(nom, s.portee)), maj: s.maj}); } finally { clair.fill(0); }
          }
          const neuf = {kdf, cle: sceller(kek, k2, AAD_CLE), secrets};
          enregistrer(neuf);
          if (K) { K.fill(0); K = k2; doc = neuf; } else k2.fill(0);
        } catch (e) { k2.fill(0); throw e; } finally { k.fill(0); kek.fill(0); }
        journal('phrase changée, clé renouvelée, ' + secrets.size + ' secret(s) rechiffré(s)');
        return {secrets: secrets.size};
      });
    },
    lire(nom) {   // prise service : jamais un secret de portée « guichet »
      nomOuRefus(nom); ouvertOuRefus();
      const s = doc.secrets.get(nom);
      if (!s) refus('inconnu', 'secret inconnu');
      if (s.portee !== 'service') refus('portee', 'secret de portée « guichet » : jamais rendu, par aucune prise');
      const v = dechiffrer(nom, s);
      try { return {nom, valeur: v.toString('utf8'), maj: s.maj}; } finally { v.fill(0); }
    },
    ecrire(nom, valeur) {   // prise service : ses propres secrets seulement
      nomOuRefus(nom);
      if (!nom.startsWith('jarvis-')) refus('nom', 'nom refusé : cette prise n’écrit que des secrets « jarvis-… »');
      valeurOuRefus(valeur); ouvertOuRefus();
      const s = doc.secrets.get(nom);
      if (s && s.portee !== 'service') refus('portee', 'nom déjà pris par un secret de portée « guichet » : rien n’a été changé');
      const remplace = poser(nom, 'service', valeur);
      journal('secret « ' + nom + ' » ' + (remplace ? 'remplacé' : 'ajouté') + ' par la prise service');
      return {nom, portee: 'service', remplace};
    },
    /* Dans ce processus seulement : prête la valeur d'un secret « guichet » à fn, dans un tampon effacé au retour.
     * fn ne doit ni le garder, ni le convertir en chaîne plus longtemps que nécessaire, ni l'écrire. */
    async avecSecret(nom, fn) {
      nomOuRefus(nom);
      if (typeof fn !== 'function') refus('demande', 'fonction manquante');
      ouvertOuRefus();
      const s = doc.secrets.get(nom);
      if (!s) refus('inconnu', 'secret inconnu');
      if (s.portee !== 'guichet') refus('portee', 'avecSecret ne prête que les secrets de portée « guichet »');
      const v = dechiffrer(nom, s);
      try { return await fn(v); } finally { v.fill(0); }
    },
    /* Une demande d'une prise → une réponse. Ne lève jamais ; le message d'une erreur imprévue n'est ni rendu ni journalisé. */
    async traiter(prise, d) {
      try {
        if (!d || typeof d !== 'object' || Array.isArray(d) || typeof d.commande !== 'string') refus('demande', 'demande invalide : {"commande":"…"} attendu');
        const table = prise === 'admin' ? ADMIN : SERVICE, f = table.get(d.commande);
        if (!f) refus(ADMIN.has(d.commande) ? 'interdit' : 'inconnue', ADMIN.has(d.commande) ? 'commande refusée sur cette prise' : 'commande inconnue');
        return {ok: true, ...(await f(d))};
      } catch (e) {
        if (e instanceof Refus) return {ok: false, erreur: e.message, code: e.code};
        journal('erreur interne (' + ((e && e.name) || 'Error') + (e && e.code ? ' ' + String(e.code).slice(0, 40) : '') + ')');
        return {ok: false, erreur: 'erreur interne', code: 'interne'};
      }
    },
  };
  const ADMIN = new Map([
    ['etat', () => ({...coffre.etat(), bloque: coffre.blocage()})],
    ['creer', (d) => coffre.creer(d.phrase)],
    ['ouvrir', (d) => coffre.ouvrir(d.phrase)],
    ['fermer', () => coffre.fermer()],
    ['mettre', (d) => coffre.mettre(d.nom, d.portee, d.valeur)],
    ['retirer', (d) => coffre.retirer(d.nom)],
    ['changer-phrase', (d) => coffre.changerPhrase(d.ancienne, d.nouvelle)],
  ]);
  const SERVICE = new Map([
    ['etat', () => coffre.etat()],
    ['lire', (d) => coffre.lire(d.nom)],
    ['ecrire', (d) => coffre.ecrire(d.nom, d.valeur)],
    ['fermer', () => coffre.fermer()],
  ]);
  return coffre;
}

/* Les deux prises. admin : chemin de admin.sock ; service : chemin de service.sock ; groupe : gid à donner à
 * service.sock (sinon le groupe du processus : c'est le cas sous systemd, Group=jarvis-coffre-clients). */
export async function servir(coffre, {admin, service, groupe = null, journal = () => {}}) {
  const repond = (chemin) => new Promise((r) => {
    const c = net.createConnection(chemin);
    c.once('connect', () => { c.destroy(); r(true); }); c.once('error', () => r(false));
  });
  function surConnexion(prise) {
    return (c) => {
      let reste = Buffer.alloc(0), suite = Promise.resolve(), rejete = false;
      c.setTimeout(60_000, () => c.destroy());
      c.on('error', () => {});
      const trop = () => {   // on répond, puis on laisse l'autre bout finir d'envoyer (sans rien garder) avant de couper
        rejete = true; reste.fill(0); reste = Buffer.alloc(0);
        c.end(JSON.stringify({ok: false, erreur: 'demande trop longue (64 Kio au plus)', code: 'demande'}) + '\n');
        setTimeout(() => c.destroy(), 2000).unref();
      };
      async function repondre(ligne) {
        let d, json = true;
        try { d = JSON.parse(ligne.toString('utf8')); } catch { json = false; } finally { ligne.fill(0); }
        const r = json ? await coffre.traiter(prise, d) : {ok: false, erreur: 'demande invalide : une ligne JSON attendue', code: 'demande'};
        if (!c.destroyed && c.writable) c.write(JSON.stringify(r) + '\n');
      }
      async function morceau(b) {
        if (rejete) { b.fill(0); return; }
        const tout = reste.length ? Buffer.concat([reste, b]) : b;
        if (tout !== b) { reste.fill(0); b.fill(0); }
        let debut = 0, i;
        while (!rejete && (i = tout.indexOf(10, debut)) >= 0) {
          const ligne = Buffer.from(tout.subarray(debut, i)); debut = i + 1;
          if (ligne.length > MAX_DEMANDE) { ligne.fill(0); trop(); break; }
          if (!ligne.every((o) => o === 32 || o === 9 || o === 13)) await repondre(ligne);   // ligne vide : ignorée
        }
        if (!rejete) { reste = Buffer.from(tout.subarray(debut)); if (reste.length > MAX_DEMANDE) trop(); }
        tout.fill(0);
      }
      /* une demande à la fois par connexion : la lecture s'arrête pendant qu'on répond */
      c.on('data', (b) => { c.pause(); suite = suite.then(() => morceau(b)).catch(() => c.destroy()).then(() => { if (!c.destroyed) c.resume(); }); });
      c.on('end', () => { suite = suite.then(() => { if (!c.destroyed) c.end(); }); });
      c.on('close', () => { reste.fill(0); });
    };
  }
  async function ecouter(chemin, mode, prise, gid) {
    if (fs.existsSync(chemin)) {   // prise restée d'un arrêt brutal : retirée si personne n'y répond
      if (await repond(chemin)) throw new Error('un jarvis-coffre répond déjà sur ' + chemin);
      fs.unlinkSync(chemin);
    }
    const s = net.createServer({allowHalfOpen: true}, surConnexion(prise));
    s.maxConnections = 64;   // par prise : la prise service ne peut pas affamer la prise admin
    const masque = process.umask(0o177);   // née fermée à tous sauf au propriétaire ; ouverte au groupe ensuite seulement
    try { await new Promise((oui, non) => { s.once('error', non); s.listen(chemin, () => { s.off('error', non); oui(); }); }); }
    finally { process.umask(masque); }
    s.on('error', () => {});
    if (gid != null) fs.chownSync(chemin, fs.statSync(chemin).uid, gid);
    fs.chmodSync(chemin, mode);
    return s;
  }
  const serveurs = [await ecouter(admin, 0o600, 'admin', null)];
  try { serveurs.push(await ecouter(service, 0o660, 'service', groupe)); }
  catch (e) { serveurs[0].close(); try { fs.unlinkSync(admin); } catch {} throw e; }
  journal('prises ouvertes : ' + admin + ' (0600), ' + service + ' (0660)');
  return {
    fermer() {
      for (const s of serveurs) s.close();
      for (const p of [admin, service]) { try { fs.unlinkSync(p); } catch {} }
    },
  };
}

/* ---- Le service (lancé par systemd : jarvis-coffre.service). Réglages par options ou par l'environnement :
 *   --fichier / COFFRE_FICHIER   (défaut /var/lib/jarvis-coffre/coffre.json)
 *   --prises  / COFFRE_PRISES    (dossier des deux prises, défaut /run/jarvis-coffre)
 *   --groupe  / COFFRE_GROUPE    (nom ou gid du groupe de service.sock ; inutile sous systemd)
 *   COFFRE_SCRYPT_N, COFFRE_FREIN_MS : pour les bancs seulement (dérivation et frein raccourcis). */
function gidDe(g) {
  if (/^\d+$/.test(g)) return Number(g);
  for (const l of fs.readFileSync('/etc/group', 'utf8').split('\n')) { const c = l.split(':'); if (c[0] === g && /^\d+$/.test(c[2] || '')) return Number(c[2]); }
  throw new Error('groupe inconnu : ' + g);
}
async function principal(argv, env) {
  const journal = (m) => console.log('[jarvis-coffre] ' + m);
  const o = {fichier: env.COFFRE_FICHIER || '/var/lib/jarvis-coffre/coffre.json', prises: env.COFFRE_PRISES || '/run/jarvis-coffre', groupe: env.COFFRE_GROUPE || ''};
  for (let i = 0; i < argv.length; i += 2) {
    const cle = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !Object.hasOwn(o, cle) || argv[i + 1] == null) { console.error('Usage : coffre.mjs [--fichier <coffre.json>] [--prises <dossier>] [--groupe <nom|gid>]'); process.exit(2); }
    o[cle] = argv[i + 1];
  }
  const N = env.COFFRE_SCRYPT_N ? Number(env.COFFRE_SCRYPT_N) : N_DEFAUT;
  const frein = env.COFFRE_FREIN_MS ? Number(env.COFFRE_FREIN_MS) : FREIN_DEFAUT;
  if (!puissanceDe2(N) || !Number.isInteger(frein) || frein < 0) { console.error('COFFRE_SCRYPT_N ou COFFRE_FREIN_MS invalide.'); process.exit(2); }
  process.umask(0o077);
  const coffre = creerCoffre({fichier: o.fichier, N, frein, journal});
  let prises = null, fin = false;
  const finir = (code) => {
    if (fin) return; fin = true;
    coffre.fermer(); if (prises) prises.fermer();
    process.exit(code);
  };
  for (const s of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(s, () => { journal('arrêt demandé (' + s + ')'); finir(0); });
  const imprevu = (e) => { journal('erreur imprévue (' + ((e && e.name) || 'Error') + (e && e.code ? ' ' + String(e.code).slice(0, 40) : '') + ') : arrêt, coffre verrouillé'); finir(1); };
  process.on('uncaughtException', imprevu); process.on('unhandledRejection', imprevu);
  try {
    fs.mkdirSync(o.prises, {recursive: true, mode: 0o750});
    prises = await servir(coffre, {admin: o.prises + '/admin.sock', service: o.prises + '/service.sock', groupe: o.groupe ? gidDe(o.groupe) : null, journal});
  } catch (e) { console.error('[jarvis-coffre] démarrage impossible : ' + (e.code || e.message)); finir(1); return; }
  if (N < N_DEFAUT) journal('ATTENTION : scrypt affaibli (N=' + N + ') : réglage de banc, jamais sur le serveur');
  if (frein < FREIN_DEFAUT) journal('ATTENTION : frein raccourci (' + frein + ' ms) : réglage de banc, jamais sur le serveur');
  if (typeof process.getuid === 'function' && process.getuid() === 0) journal('lancé en root : prévu pour l’utilisateur jarvis-coffre (banc ?)');
  let e0; try { e0 = coffre.etat(); } catch { e0 = null; }
  journal(e0 ? (e0.existe ? 'démarré : coffre verrouillé, ' + e0.secrets.length + ' secret(s) ; en attente de « sudo jarvis-coffre ouvrir »' : 'démarré : aucun coffre encore (sudo jarvis-coffre creer)')
    : 'démarré : fichier du coffre illisible (' + o.fichier + ')');
}
let lanceDirectement = false;
try { lanceDirectement = !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(import.meta.filename); } catch {}
if (lanceDirectement) principal(process.argv.slice(2), process.env);
