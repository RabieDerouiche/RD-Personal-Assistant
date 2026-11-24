/* Banc de jarvis-coffre : node jarvis-os/coffre/tests/coffre.test.mjs
 * Lance le vrai service (coffre.mjs) dans un dossier temporaire, avec ses deux prises, et un coffre « dans le
 * processus » pour l'horloge, les fichiers trafiqués et avecSecret. Données inventées, aucun réseau, scrypt
 * raccourci (COFFRE_SCRYPT_N). Environ 20 secondes : le frein de 2 secondes est mesuré pour de vrai.
 * L'ouverture scellée est jouée avec le module de la page (sceller.mjs, WebCrypto) et, à part, avec node:crypto.
 * En root, il vérifie en plus qui peut joindre quelle prise (utilisateur « nobody »). */
import fs from 'node:fs'; import net from 'node:net'; import os from 'node:os'; import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process'; import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {creerCoffre, Refus} from '../coffre.mjs';
import {scellerPhrase} from '../sceller.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url)), DEMON = path.join(ICI, '..', 'coffre.mjs');
let ok = 0, ko = 0;
const verif = (nom, cond, info) => { if (cond) ok++; else ko++; console.log((cond ? '  ✓ ' : '  ✗ ') + nom + (!cond && info !== undefined ? ' :: ' + info : '')); };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/* tout ce qui ne doit jamais apparaître hors d'une réponse « lire » */
const PHRASE = 'girafe-violette-mange-7-nuages', PHRASE2 = 'tortue-orange-compte-12-étoiles', FAUSSE = 'hibou-distrait-oublie-3-parapluies';
const V_SERVICE = 'jeton-service-INVENTÉ-4f9a"\\$x y', V_GUICHET = 'mot-de-passe-guichet-INVENTÉ-77', V_ECRIT = 'acces-ecrit-par-jarvis-INVENTÉ-0c1', V_CONS = 'valeur-du-nom-constructor-INVENTÉ';
const SECRETS = [PHRASE, PHRASE2, FAUSSE, V_SERVICE, V_GUICHET, V_ECRIT, V_CONS];
const formes = (s) => [s, Buffer.from(s).toString('base64'), Buffer.from(s).toString('hex'), JSON.stringify(s).slice(1, -1)];
const contient = (texte, liste = SECRETS) => liste.filter((s) => formes(s).some((f) => texte.includes(f)));

let T = fs.mkdtempSync(path.join(os.tmpdir(), 'coffre-'));
if (T.length > 60) T = fs.mkdtempSync('/tmp/coffre-');   // un chemin de prise unix tient en 107 octets
fs.chmodSync(T, 0o755);
const demons = [], echanges = [];

function lancer(nom, env = {}, identite = {}) {   // un service dans T/<nom>/ ; résout quand les deux prises répondent
  const dossier = path.join(T, nom), prises = path.join(dossier, 'p');
  if (!fs.existsSync(dossier)) { fs.mkdirSync(path.join(dossier, 'etat'), {recursive: true, mode: 0o700}); fs.mkdirSync(prises, {mode: 0o755}); fs.chmodSync(dossier, 0o755); }
  const d = {nom, fichier: path.join(dossier, 'etat', 'coffre.json'), admin: path.join(prises, 'admin.sock'), service: path.join(prises, 'service.sock'), sortie: '', fini: null};
  d.proc = spawn(process.execPath, [DEMON], {stdio: ['ignore', 'pipe', 'pipe'], ...identite,
    env: {PATH: process.env.PATH, COFFRE_FICHIER: d.fichier, COFFRE_PRISES: prises, COFFRE_SCRYPT_N: '4096', ...env}});
  d.proc.stdout.on('data', (b) => { d.sortie += b; }); d.proc.stderr.on('data', (b) => { d.sortie += b; });
  d.fini = new Promise((r) => d.proc.on('exit', (code, signal) => r({code, signal})));
  d.arreter = async (signal = 'SIGTERM') => { d.proc.kill(signal); return d.fini; };
  demons.push(d);
  return (async () => {
    for (let i = 0; i < 100; i++) {
      if (d.proc.exitCode !== null) throw new Error('le service ' + nom + ' s’est arrêté : ' + d.sortie);
      if (fs.existsSync(d.admin) && fs.existsSync(d.service) && /démarré/.test(d.sortie)) return d;
      await pause(50);
    }
    throw new Error('le service ' + nom + ' ne démarre pas : ' + d.sortie);
  })();
}
/* une demande (objet → une ligne JSON ; chaîne ou tampon → tel quel) ; rend la ou les réponses lues jusqu'à la fermeture ou n lignes */
function brut(prise, envoi, {lignes = 1, delai = 20000} = {}) {
  return new Promise((r) => {
    const c = net.createConnection(prise); let recu = '', rendu = false; const t0 = Date.now();
    const rendre = (erreur) => { if (rendu) return; rendu = true; c.destroy(); r({texte: recu, erreur, ms: Date.now() - t0}); };
    c.on('connect', () => c.write(envoi)); c.on('error', (e) => rendre(e.code || 'erreur'));
    c.on('data', (b) => { recu += b; if (recu.split('\n').length > lignes) rendre(); }); c.on('close', () => rendre()); setTimeout(() => rendre('délai'), delai);
  });
}
async function appel(prise, demande) {
  const r = await brut(prise, JSON.stringify(demande) + '\n');
  echanges.push({prise: path.basename(prise), commande: demande && demande.commande, texte: r.texte});
  let rep; try { rep = JSON.parse(r.texte); } catch { rep = {ok: false, code: 'illisible', erreur: r.erreur || r.texte}; }
  rep.ms = r.ms; return rep;
}
const mode = (f) => (fs.statSync(f).mode & 0o777).toString(8);
const refuse = (r, code) => r && r.ok === false && r.code === code;

try {
  /* ---------- 1. Le service : création, ouverture, portées ---------- */
  console.log('Service A (frein réel de 2 s) :');
  const A = await lancer('a');
  let r = await appel(A.admin, {commande: 'etat'});
  verif('avant tout : aucun coffre, verrouillé', r.ok && r.existe === false && r.ouvert === false && r.secrets.length === 0, JSON.stringify(r));
  verif('prises : admin.sock en 0600, service.sock en 0660', mode(A.admin) === '600' && mode(A.service) === '660', mode(A.admin) + ' ' + mode(A.service));
  r = await appel(A.admin, {commande: 'creer', phrase: 'trop-courte-19-carac'.slice(0, 19)});
  verif('creer : une phrase de 19 caractères est refusée', refuse(r, 'phrase-courte') && !fs.existsSync(A.fichier), JSON.stringify(r));
  r = await appel(A.admin, {commande: 'creer', phrase: ' ' + PHRASE});
  const r2 = await appel(A.admin, {commande: 'creer', phrase: 'aaaaaaaaaaaaaaaaaaaaaaaa'});
  verif('creer : espace au bord ou phrase répétitive refusées', refuse(r, 'phrase-forme') && refuse(r2, 'phrase-forme') && !fs.existsSync(A.fichier));
  r = await appel(A.service, {commande: 'creer', phrase: PHRASE});
  verif('creer est refusé sur service.sock', refuse(r, 'interdit') && !fs.existsSync(A.fichier), JSON.stringify(r));
  r = await appel(A.admin, {commande: 'creer', phrase: PHRASE});
  verif('creer : coffre créé, ouvert', r.ok === true && (await appel(A.admin, {commande: 'etat'})).ouvert === true, JSON.stringify(r));
  const f0 = fs.readFileSync(A.fichier, 'utf8'), j0 = JSON.parse(f0);
  verif('fichier du coffre : 0600, forme v1 (scrypt, sel de 32 octets, clé enveloppée), aucun fichier voisin oublié', mode(A.fichier) === '600' && j0.v === 1 && j0.kdf.algo === 'scrypt' && j0.kdf.N === 4096 && j0.kdf.r === 8 && j0.kdf.p === 1
    && Buffer.from(j0.kdf.sel, 'base64').length === 32 && Buffer.from(j0.cle.ct, 'base64').length === 32 && Buffer.from(j0.cle.iv, 'base64').length === 12 && Buffer.from(j0.cle.tag, 'base64').length === 16
    && fs.readdirSync(path.dirname(A.fichier)).join() === 'coffre.json', fs.readdirSync(path.dirname(A.fichier)).join());
  verif('fichier du coffre : la phrase n’y est pas', contient(f0).length === 0);
  r = await appel(A.admin, {commande: 'creer', phrase: PHRASE2});
  verif('creer une seconde fois : refusé, fichier intact', refuse(r, 'existe') && fs.readFileSync(A.fichier, 'utf8') === f0, JSON.stringify(r));

  r = await appel(A.admin, {commande: 'mettre', nom: 'jarvis-google', portee: 'service', valeur: V_SERVICE});
  const m2 = await appel(A.admin, {commande: 'mettre', nom: 'couches', portee: 'guichet', valeur: V_GUICHET});
  const m3 = await appel(A.admin, {commande: 'mettre', nom: 'constructor', portee: 'service', valeur: V_CONS});
  verif('mettre : un secret « service », un secret « guichet », un nom piège (« constructor »)', r.ok && r.remplace === false && m2.ok && m3.ok, JSON.stringify([r, m2, m3]));
  r = await appel(A.admin, {commande: 'mettre', nom: 'x', portee: 'service', valeur: 'v'});
  const n2 = await appel(A.admin, {commande: 'mettre', nom: '__proto__', portee: 'service', valeur: 'v'});
  const n3 = await appel(A.admin, {commande: 'mettre', nom: 'Majuscule', portee: 'service', valeur: 'v'});
  const n4 = await appel(A.admin, {commande: 'mettre', nom: 'bon-nom', portee: 'public', valeur: 'v'});
  const n5 = await appel(A.admin, {commande: 'mettre', nom: 'bon-nom', portee: 'service', valeur: {a: 1}});
  verif('mettre : noms hors règle, portée inconnue, valeur non textuelle refusés', refuse(r, 'nom') && refuse(n2, 'nom') && refuse(n3, 'nom') && refuse(n4, 'portee') && refuse(n5, 'valeur'), JSON.stringify([r, n2, n3, n4, n5]));
  r = await appel(A.service, {commande: 'lire', nom: 'jarvis-google'});
  const lc = await appel(A.service, {commande: 'lire', nom: 'constructor'});
  verif('lire (service.sock) rend le secret « service », à l’identique', r.ok && r.valeur === V_SERVICE && lc.ok && lc.valeur === V_CONS, JSON.stringify(r).replace(V_SERVICE, '…'));
  r = await appel(A.service, {commande: 'lire', nom: 'couches'});
  verif('lire REFUSE le secret « guichet » (erreur claire, aucune valeur)', refuse(r, 'portee') && /guichet/.test(r.erreur) && !('valeur' in r), JSON.stringify(r));
  r = await appel(A.admin, {commande: 'lire', nom: 'couches'});
  const la = await appel(A.admin, {commande: 'lire', nom: 'jarvis-google'});
  verif('admin.sock n’a aucune commande qui rende une valeur', refuse(r, 'inconnue') && refuse(la, 'inconnue'));
  r = await appel(A.service, {commande: 'lire', nom: 'inconnu-au-bataillon'});
  verif('lire un nom inconnu : refus propre', refuse(r, 'inconnu'));
  r = await appel(A.service, {commande: 'ecrire', nom: 'google', valeur: V_ECRIT});
  verif('ecrire : refusé pour un nom qui ne commence pas par « jarvis- »', refuse(r, 'nom'), JSON.stringify(r));
  r = await appel(A.service, {commande: 'ecrire', nom: 'jarvis-acces', valeur: V_ECRIT, portee: 'guichet'});
  const le = await appel(A.service, {commande: 'lire', nom: 'jarvis-acces'});
  verif('ecrire « jarvis-… » : accepté, portée imposée « service », relu à l’identique', r.ok && r.portee === 'service' && le.valeur === V_ECRIT, JSON.stringify(r));
  await appel(A.admin, {commande: 'mettre', nom: 'jarvis-guichet', portee: 'guichet', valeur: V_GUICHET});
  r = await appel(A.service, {commande: 'ecrire', nom: 'jarvis-guichet', valeur: 'ecrasement'});
  verif('ecrire ne peut pas écraser un secret « guichet » nommé « jarvis-… »', refuse(r, 'portee') && refuse(await appel(A.service, {commande: 'lire', nom: 'jarvis-guichet'}), 'portee'));
  const eA = await appel(A.admin, {commande: 'etat'}), eS = await appel(A.service, {commande: 'etat'});
  verif('etat (les deux prises) : ouvert, 5 secrets {nom, portee, maj}, aucune valeur', eA.ouvert && eS.ouvert && eS.secrets.length === 5
    && eS.secrets.every((s) => Object.keys(s).sort().join() === 'maj,nom,portee') && eS.secrets.find((s) => s.nom === 'couches').portee === 'guichet'
    && contient(JSON.stringify(eA) + JSON.stringify(eS)).length === 0, JSON.stringify(eS));
  for (const c of [{commande: 'ouvrir', phrase: PHRASE}, {commande: 'mettre', nom: 'jarvis-x', portee: 'service', valeur: 'v'}, {commande: 'retirer', nom: 'couches'}, {commande: 'changer-phrase', ancienne: PHRASE, nouvelle: PHRASE2}]) {
    r = await appel(A.service, c);
    verif('service.sock refuse « ' + c.commande + ' »', refuse(r, 'interdit'), JSON.stringify(r));
  }
  verif('… et rien n’a bougé (5 secrets, même enveloppe de clé)', (await appel(A.admin, {commande: 'etat'})).secrets.length === 5 && JSON.parse(fs.readFileSync(A.fichier, 'utf8')).cle.ct === j0.cle.ct);
  const f1 = fs.readFileSync(A.fichier, 'utf8');
  verif('fichier du coffre après les ajouts : aucune valeur ni phrase, sous aucune forme (clair, base64, hexa)', contient(f1).length === 0 && mode(A.fichier) === '600', contient(f1).length);
  verif('la longueur d’une valeur ne se lit pas dans le fichier (chiffrés complétés à 64 octets)', Object.values(JSON.parse(f1).secrets).every((s) => Buffer.from(s.ct, 'base64').length % 64 === 0));

  /* ---------- 2. Demandes mal formées ---------- */
  const mauvaises = ['pas du json\n', '[1,2,3]\n', '"chaine"\n', 'null\n', '{}\n', '{"commande":42}\n', '{"commande":"lire","nom":{"a":1}}\n', '{"commande":"lire","nom":["jarvis-google"]}\n',
    '{"commande":"__proto__"}\n', '{"commande":"constructor"}\n', '{"commande":"toString"}\n', '{"commande":"lire"', Buffer.from([0, 255, 254, 10, 123, 10]), '['.repeat(60000) + '\n', '{"a":'.repeat(10000) + '\n', '{"commande":"ecrire","nom":"jarvis-a","valeur":""}\n'];
  let propres = 0;
  for (const m of mauvaises) for (const p of [A.admin, A.service]) {
    const x = await brut(p, m, {delai: 600});
    const lignes = x.texte.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } });
    if (lignes.every((l) => l && l.ok === false) && (lignes.length > 0 || !String(m).endsWith('\n'))) propres++;
  }
  verif('demandes mal formées (' + mauvaises.length + ' sortes, deux prises) : une erreur à chaque fois, jamais un arrêt', propres === mauvaises.length * 2 && A.proc.exitCode === null, propres);
  const grosse = '{"commande":"ecrire","nom":"jarvis-gros","valeur":"' + 'a'.repeat(70 * 1024) + '"}\n';
  let x = await brut(A.service, grosse, {delai: 4000});
  const sansFin = await brut(A.admin, 'b'.repeat(200 * 1024), {delai: 4000});
  verif('demande de plus de 64 Kio (avec ou sans fin de ligne) : refusée, connexion coupée, service debout', /trop longue/.test(x.texte) && /trop longue/.test(sansFin.texte)
    && A.proc.exitCode === null && !(await appel(A.admin, {commande: 'etat'})).secrets.some((s) => s.nom === 'jarvis-gros'), x.texte.slice(0, 80) + ' / ' + sansFin.texte.slice(0, 80));
  r = await appel(A.service, {commande: 'ecrire', nom: 'jarvis-long', valeur: 'é'.repeat(20000)});
  verif('valeur de plus de 32 Kio : refusée', refuse(r, 'valeur'), JSON.stringify(r).slice(0, 80));
  x = await brut(A.service, '{"commande":"etat"}\n\n  \n{"commande":"lire","nom":"couches"}\n{"commande":"etat"}\n', {lignes: 3});
  const trois = x.texte.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  verif('plusieurs demandes sur une connexion : une réponse par ligne, dans l’ordre', trois.length === 3 && trois[0].ok && refuse(trois[1], 'portee') && trois[2].ok, x.texte.slice(0, 120));

  /* ---------- 3. Fermer, redémarrer ---------- */
  r = await appel(A.service, {commande: 'fermer'});
  const lf = await appel(A.service, {commande: 'lire', nom: 'jarvis-google'});
  const ef = await appel(A.service, {commande: 'ecrire', nom: 'jarvis-acces', valeur: 'v'}), mf = await appel(A.admin, {commande: 'mettre', nom: 'jarvis-z', portee: 'service', valeur: 'v'});
  verif('fermer (permis depuis service.sock) → lire, ecrire, mettre refusés : « coffre verrouillé »', r.ok && r.etait === true && refuse(lf, 'verrouille') && /verrouillé/.test(lf.erreur) && refuse(ef, 'verrouille') && refuse(mf, 'verrouille'), JSON.stringify([r, lf]));
  r = await appel(A.service, {commande: 'etat'});
  verif('verrouillé : etat liste encore les noms, sans valeur', r.ok && r.ouvert === false && r.existe === true && r.secrets.length === 5);
  r = await appel(A.admin, {commande: 'ouvrir', phrase: FAUSSE});
  verif('mauvaise phrase : refusée, et la réponse attend 2 secondes', refuse(r, 'phrase') && r.ms >= 1900 && (await appel(A.admin, {commande: 'etat'})).ouvert === false, r.ms + ' ms ' + JSON.stringify(r));
  r = await appel(A.admin, {commande: 'ouvrir', phrase: PHRASE});
  verif('bonne phrase : ouvert, sans attente', r.ok && r.ms < 1500 && (await appel(A.service, {commande: 'lire', nom: 'jarvis-google'})).valeur === V_SERVICE, r.ms + ' ms');
  let fin = await A.arreter('SIGTERM');
  verif('arrêt demandé (SIGTERM) : fin propre, prises retirées', fin.code === 0 && !fs.existsSync(A.admin) && !fs.existsSync(A.service), JSON.stringify(fin));
  const A2 = await lancer('a');
  r = await appel(A2.service, {commande: 'etat'});
  verif('redémarrage du service : verrouillé, les 5 secrets sont toujours là', r.ouvert === false && r.secrets.length === 5 && refuse(await appel(A2.service, {commande: 'lire', nom: 'jarvis-google'}), 'verrouille'), JSON.stringify(r));
  await appel(A2.admin, {commande: 'ouvrir', phrase: PHRASE});
  verif('… rouvert avec la phrase : mêmes valeurs', (await appel(A2.service, {commande: 'lire', nom: 'jarvis-google'})).valeur === V_SERVICE && (await appel(A2.service, {commande: 'lire', nom: 'jarvis-acces'})).valeur === V_ECRIT);
  fin = await A2.arreter('SIGKILL');
  const A3 = await lancer('a');
  verif('arrêt brutal (SIGKILL) : les prises orphelines sont remplacées, coffre verrouillé', fin.signal === 'SIGKILL' && (await appel(A3.admin, {commande: 'etat'})).ouvert === false && mode(A3.admin) === '600' && mode(A3.service) === '660');
  const double = spawnSync(process.execPath, [DEMON], {env: {PATH: process.env.PATH, COFFRE_FICHIER: A3.fichier, COFFRE_PRISES: path.dirname(A3.admin), COFFRE_SCRYPT_N: '4096'}, encoding: 'utf8', timeout: 10000});
  verif('un second service sur les mêmes prises refuse de démarrer et laisse le premier en place', double.status === 1 && (await appel(A3.admin, {commande: 'etat'})).ok === true, double.status + ' ' + double.stderr);

  /* ---------- 4. Changer de phrase ---------- */
  await appel(A3.admin, {commande: 'ouvrir', phrase: PHRASE});
  const avant = JSON.parse(fs.readFileSync(A3.fichier, 'utf8'));
  r = await appel(A3.admin, {commande: 'changer-phrase', ancienne: PHRASE, nouvelle: 'trop courte'});
  verif('changer-phrase : nouvelle phrase trop courte refusée', refuse(r, 'phrase-courte'));
  r = await appel(A3.admin, {commande: 'changer-phrase', ancienne: PHRASE, nouvelle: PHRASE2});
  const apres = JSON.parse(fs.readFileSync(A3.fichier, 'utf8'));
  verif('changer-phrase : accepté, sel, enveloppe et chiffrés tous renouvelés (nouvelle clé)', r.ok && r.secrets === 5 && apres.kdf.sel !== avant.kdf.sel && apres.cle.ct !== avant.cle.ct
    && Object.keys(apres.secrets).every((n) => apres.secrets[n].ct !== avant.secrets[n].ct && apres.secrets[n].maj === avant.secrets[n].maj), JSON.stringify(r));
  verif('… le coffre est resté ouvert, valeurs intactes', (await appel(A3.service, {commande: 'lire', nom: 'jarvis-google'})).valeur === V_SERVICE);
  await A3.arreter('SIGTERM');
  const A4 = await lancer('a');
  r = await appel(A4.admin, {commande: 'ouvrir', phrase: PHRASE});
  verif('après changement et redémarrage : l’ancienne phrase est refusée', refuse(r, 'phrase') && (await appel(A4.admin, {commande: 'etat'})).ouvert === false);
  r = await appel(A4.admin, {commande: 'ouvrir', phrase: PHRASE2});
  verif('… la nouvelle ouvre, secrets intacts', r.ok && (await appel(A4.service, {commande: 'lire', nom: 'jarvis-google'})).valeur === V_SERVICE
    && (await appel(A4.service, {commande: 'lire', nom: 'jarvis-acces'})).valeur === V_ECRIT && (await appel(A4.service, {commande: 'lire', nom: 'constructor'})).valeur === V_CONS);
  r = await appel(A4.admin, {commande: 'retirer', nom: 'constructor'});
  verif('retirer : le secret disparaît du fichier', r.ok && !Object.hasOwn(JSON.parse(fs.readFileSync(A4.fichier, 'utf8')).secrets, 'constructor') && refuse(await appel(A4.service, {commande: 'lire', nom: 'constructor'}), 'inconnu'));

  /* ---------- 5. Fichier trafiqué, par le vrai service ---------- */
  await A4.arreter('SIGTERM');
  const sain = fs.readFileSync(A4.fichier, 'utf8');
  const trafique = JSON.parse(sain), octetsCt = Buffer.from(trafique.secrets['jarvis-google'].ct, 'base64'); octetsCt[5] ^= 1;
  trafique.secrets['jarvis-google'].ct = octetsCt.toString('base64');
  fs.writeFileSync(A4.fichier, JSON.stringify(trafique));
  const A5 = await lancer('a');
  await appel(A5.admin, {commande: 'ouvrir', phrase: PHRASE2});
  r = await appel(A5.service, {commande: 'lire', nom: 'jarvis-google'});
  verif('un octet du chiffré changé dans le fichier : lire refuse proprement, les autres secrets restent lisibles, service debout', refuse(r, 'abime') && !('valeur' in r)
    && (await appel(A5.service, {commande: 'lire', nom: 'jarvis-acces'})).valeur === V_ECRIT && A5.proc.exitCode === null, JSON.stringify(r));
  r = await appel(A5.admin, {commande: 'changer-phrase', ancienne: PHRASE2, nouvelle: PHRASE});
  verif('… et changer-phrase refuse tant qu’un secret est illisible (rien n’est rechiffré à moitié)', refuse(r, 'abime') && JSON.parse(fs.readFileSync(A5.fichier, 'utf8')).cle.ct === trafique.cle.ct, JSON.stringify(r));
  await A5.arreter('SIGTERM'); fs.writeFileSync(A5.fichier, sain);

  /* ---------- 6. Qui peut joindre quelle prise (root seulement) ---------- */
  if (process.getuid && process.getuid() === 0) {
    const G = await lancer('g', {COFFRE_GROUPE: '1'});   // service.sock au groupe 1 (« daemon », présent partout)
    const st = fs.statSync(G.service);
    const sonde = 'const c=require("net").createConnection(process.argv[1]);c.on("connect",()=>c.write(JSON.stringify({commande:"etat"})+"\\n"));c.on("data",(b)=>{console.log(String(b).trim());c.destroy()});c.on("error",(e)=>{console.log(e.code);})';
    const en = (uid, gid, prise) => spawnSync(process.execPath, ['-e', sonde, prise], {uid, gid, encoding: 'utf8', timeout: 5000, env: {}}).stdout.trim();
    const membre = en(65534, 1, G.service), etranger = en(65534, 65534, G.service), membreAdmin = en(65534, 1, G.admin);
    if (membre === '' && etranger === '') console.log('  – (Node inaccessible à « nobody » ici : contrôle des droits sauté)');
    else {
      verif('service.sock : au groupe demandé (COFFRE_GROUPE), 0660', st.gid === 1 && mode(G.service) === '660', st.gid + ' ' + mode(G.service));
      verif('un membre du groupe joint service.sock ; un autre utilisateur non (EACCES)', /"ok":true/.test(membre) && etranger === 'EACCES', membre.slice(0, 60) + ' / ' + etranger);
      verif('admin.sock : fermée même à un membre du groupe (EACCES)', membreAdmin === 'EACCES', membreAdmin);
    }
    await G.arreter('SIGTERM');
    /* comme sous systemd : utilisateur sans droit, groupe du processus = groupe des clients, dossier des prises en 0750 */
    const du = path.join(T, 'u'); fs.mkdirSync(path.join(du, 'etat'), {recursive: true}); fs.mkdirSync(path.join(du, 'p'));
    for (const [d, m] of [[du, 0o755], [path.join(du, 'etat'), 0o700], [path.join(du, 'p'), 0o750]]) { fs.chownSync(d, 65534, 1); fs.chmodSync(d, m); }
    let U = null; try { U = await lancer('u', {}, {uid: 65534, gid: 1}); } catch { console.log('  – (service sous « nobody » impossible ici : contrôle sauté)'); }
    if (U) {
      r = await appel(U.admin, {commande: 'creer', phrase: PHRASE});
      const sa = fs.statSync(U.admin), ss = fs.statSync(U.service), sf = fs.statSync(U.fichier);
      verif('service lancé sans droit (uid 65534, groupe 1), comme sous systemd : root crée le coffre par admin.sock ; prises et fichier à lui, 0600 / 0660 (groupe 1) / 0600', r.ok && sa.uid === 65534 && mode(U.admin) === '600'
        && ss.uid === 65534 && ss.gid === 1 && mode(U.service) === '660' && sf.uid === 65534 && mode(U.fichier) === '600' && !/lancé en root/.test(U.sortie), JSON.stringify([r, sa.uid, ss.gid, sf.uid]));
      const m = en(2, 1, U.service), e = en(2, 2, U.service), ma = en(2, 1, U.admin);
      verif('… un membre du groupe joint service.sock mais pas admin.sock ; un autre utilisateur ne joint rien', /"ok":true/.test(m) && ma === 'EACCES' && e === 'EACCES' && en(2, 2, U.admin) === 'EACCES', [m.slice(0, 40), ma, e].join(' / '));
      await U.arreter('SIGTERM');
    }
  } else console.log('  – (pas root : contrôle des droits par utilisateur sauté)');

  /* ---------- 7. Blocage après 5 essais (service B, frein raccourci) ---------- */
  console.log('Service B (frein raccourci) :');
  const B = await lancer('b', {COFFRE_FREIN_MS: '40'});
  await appel(B.admin, {commande: 'creer', phrase: PHRASE}); await appel(B.admin, {commande: 'fermer'});
  const essais = [];
  for (let i = 0; i < 5; i++) essais.push(await appel(B.admin, {commande: 'ouvrir', phrase: FAUSSE + i}));
  r = await appel(B.admin, {commande: 'ouvrir', phrase: PHRASE});
  const cp = await appel(B.admin, {commande: 'changer-phrase', ancienne: PHRASE, nouvelle: PHRASE2});
  verif('5 mauvaises phrases : toutes refusées, puis même la bonne est refusée (bloqué 10 minutes)', essais.every((e) => refuse(e, 'phrase')) && /bloqué/.test(essais[4].erreur) && refuse(r, 'bloque') && r.ms < 1000, JSON.stringify(r));
  verif('… changer-phrase est bloqué de la même façon, etat l’annonce', refuse(cp, 'bloque') && (await appel(B.admin, {commande: 'etat'})).bloque > 590);
  verif('le journal du service signale le réglage de banc', /ATTENTION : frein raccourci/.test(B.sortie) && /ATTENTION : scrypt affaibli/.test(B.sortie));
  await B.arreter('SIGTERM');

  /* ---------- 8. Dans le processus : horloge, avecSecret, fichiers trafiqués ---------- */
  console.log('Dans le processus :');
  let t = 1_800_000_000_000; const lignes = [];
  const dossier = path.join(T, 'p'); fs.mkdirSync(dossier, {mode: 0o700});
  const neuf = (fichier) => creerCoffre({fichier, N: 1024, frein: 0, maintenant: () => t, attendre: async () => {}, journal: (m) => lignes.push(m)});
  const F = path.join(dossier, 'coffre.json'), C = neuf(F);
  const code = async (p) => { try { await p; return 'ok'; } catch (e) { return e instanceof Refus ? e.code : 'exception ' + e.message; } };
  await C.creer(PHRASE); C.mettre('couches', 'guichet', V_GUICHET); C.mettre('jarvis-a', 'service', V_SERVICE); C.mettre('jarvis-b', 'service', V_ECRIT);
  let vu = null, garde = null;
  const rendu = await C.avecSecret('couches', (b) => { vu = b.toString('utf8'); garde = b; return 'fait'; });
  verif('avecSecret : prête la valeur « guichet » à la fonction, dans un tampon effacé au retour', rendu === 'fait' && vu === V_GUICHET && Buffer.isBuffer(garde) && garde.every((o) => o === 0));
  verif('avecSecret : refuse un secret « service » et un nom inconnu', await code(C.avecSecret('jarvis-a', () => 1)) === 'portee' && await code(C.avecSecret('absent', () => 1)) === 'inconnu');
  C.fermer(); let appele = false;
  verif('avecSecret : verrouillé → refus, la fonction n’est pas appelée', await code(C.avecSecret('couches', () => { appele = true; })) === 'verrouille' && !appele);
  const pOuvre = C.ouvrir(PHRASE); C.fermer();
  verif('un « fermer » arrivé pendant une ouverture l’emporte : coffre resté verrouillé', await code(pOuvre) === 'ferme' && C.etat().ouvert === false);
  for (let i = 0; i < 4; i++) await code(C.ouvrir(FAUSSE));
  t += 9 * 60_000;
  verif('4 échecs puis la bonne phrase : ouvert, compteur remis à zéro', await code(C.ouvrir(PHRASE)) === 'ok' && C.blocage() === 0); C.fermer();
  for (let i = 0; i < 4; i++) await code(C.ouvrir(FAUSSE));
  t += 11 * 60_000;
  verif('des échecs vieux de plus de 10 minutes ne comptent plus', await code(C.ouvrir(FAUSSE)) === 'phrase' && C.blocage() === 0 && await code(C.ouvrir(PHRASE)) === 'ok'); C.fermer();
  for (let i = 0; i < 5; i++) await code(C.ouvrir(FAUSSE));
  t += 9 * 60_000 + 59_000;
  const encore = await code(C.ouvrir(PHRASE));
  t += 2000;
  verif('blocage : refus pendant 10 minutes pleines après le 5e échec, puis la bonne phrase ouvre', encore === 'bloque' && await code(C.ouvrir(PHRASE)) === 'ok');
  verif('le journal ne porte ni phrase ni valeur', contient(lignes.join('\n')).length === 0 && lignes.length > 5, lignes.length);
  C.fermer();

  const base = fs.readFileSync(F, 'utf8'); let numero = 0;
  async function trafic(modifier) {   // un coffre neuf sur une copie modifiée du fichier
    const f = path.join(dossier, 'trafic-' + (++numero) + '.json'), j = JSON.parse(base);
    const texte = modifier(j); fs.writeFileSync(f, typeof texte === 'string' ? texte : JSON.stringify(j), {mode: 0o600});
    const c = neuf(f); return {c, f, ouverture: await code(c.ouvrir(PHRASE))};
  }
  const lire = async (c, nom) => { const x = await c.traiter('service', {commande: 'lire', nom}); return x.ok ? 'ok' : x.code; };
  const bascule = (s, i = 3) => { const b = Buffer.from(s, 'base64'); b[i % b.length] ^= 0x80; return b.toString('base64'); };
  let x1 = await trafic((j) => { j.secrets['jarvis-a'].tag = bascule(j.secrets['jarvis-a'].tag); });
  let x2 = await trafic((j) => { j.secrets['jarvis-a'].iv = bascule(j.secrets['jarvis-a'].iv); });
  verif('étiquette ou vecteur d’un secret modifié : déchiffrement refusé, l’autre secret reste lisible', await lire(x1.c, 'jarvis-a') === 'abime' && await lire(x2.c, 'jarvis-a') === 'abime' && await lire(x1.c, 'jarvis-b') === 'ok');
  x1 = await trafic((j) => { const a = j.secrets['jarvis-a']; j.secrets['jarvis-a'] = {...j.secrets['jarvis-b'], maj: a.maj}; j.secrets['jarvis-b'] = {...a, maj: j.secrets['jarvis-b'].maj}; });
  verif('chiffrés de deux secrets échangés dans le fichier : les deux sont refusés', x1.ouverture === 'ok' && await lire(x1.c, 'jarvis-a') === 'abime' && await lire(x1.c, 'jarvis-b') === 'abime');
  x1 = await trafic((j) => { j.secrets.couches.portee = 'service'; });
  x2 = await trafic((j) => { j.secrets['jarvis-vol'] = {...j.secrets.couches, portee: 'service'}; });
  const x3 = await trafic((j) => { j.secrets['jarvis-a'] = {...j.secrets.couches, portee: 'service'}; });
  const fuite = [await x1.c.traiter('service', {commande: 'lire', nom: 'couches'}), await x2.c.traiter('service', {commande: 'lire', nom: 'jarvis-vol'}), await x3.c.traiter('service', {commande: 'lire', nom: 'jarvis-a'})];
  verif('secret « guichet » rebaptisé « service », ou copié sous un nom « service » : jamais rendu', fuite.every((f) => refuse(f, 'abime')) && contient(JSON.stringify(fuite)).length === 0, JSON.stringify(fuite));
  verif('avecSecret sur un secret trafiqué : refus propre', await code(x1.c.avecSecret('couches', () => 1)) === 'portee' && await code((await trafic((j) => { j.secrets.couches.ct = bascule(j.secrets.couches.ct, 9); })).c.avecSecret('couches', () => 1)) === 'abime');
  x1 = await trafic((j) => { j.cle.ct = bascule(j.cle.ct); }); x2 = await trafic((j) => { j.kdf.sel = bascule(j.kdf.sel); });
  const x4 = await trafic((j) => { j.kdf.N = 2048; });
  verif('enveloppe de la clé, sel ou coût modifiés : ouverture refusée', x1.ouverture === 'phrase' && x2.ouverture === 'phrase' && x4.ouverture === 'phrase' && x1.c.etat().ouvert === false);
  const casses = [() => 'pas du json', () => '{"v":1}', (j) => { j.v = 2; }, (j) => { j.kdf.N = 2 ** 24; }, (j) => { j.kdf.N = 1000; }, (j) => { j.secrets = []; }, (j) => { j.secrets['Nom Interdit'] = j.secrets.couches; },
    (j) => { j.secrets.couches.portee = 'public'; }, (j) => { j.cle.iv = 'AAAA'; }, (j) => { delete j.secrets.couches.tag; }, (j) => JSON.stringify(j).replace('"secrets":{', '"secrets":{"__proto__":{"portee":"service","iv":"","ct":"","tag":"","maj":""},')];
  let nets = 0;
  for (const cas of casses) {
    const y = await trafic(cas), e = await y.c.traiter('admin', {commande: 'etat'}), avantCreer = fs.readFileSync(y.f, 'utf8'), cr = await y.c.traiter('admin', {commande: 'creer', phrase: PHRASE2});
    if (y.ouverture === 'illisible' && refuse(e, 'illisible') && refuse(cr, 'existe') && fs.readFileSync(y.f, 'utf8') === avantCreer) nets++;
  }
  verif('fichier abîmé ou hors forme (' + casses.length + ' sortes) : tout est refusé proprement, et « creer » ne l’écrase jamais', nets === casses.length, nets);

  /* coût réel, une fois : c'est celui du serveur (N=2^17, 128 Mo le temps du calcul) */
  const R = creerCoffre({fichier: path.join(dossier, 'reel.json'), frein: 0}), tr = Date.now();
  await R.creer(PHRASE); R.fermer(); const faux = await code(R.ouvrir(FAUSSE)), vrai = await code(R.ouvrir(PHRASE)), duree = Math.round((Date.now() - tr) / 3);
  verif('scrypt au coût réel (N=2^17 par défaut, écrit dans le fichier) : crée, refuse la mauvaise phrase, ouvre (' + duree + ' ms par dérivation ici)', JSON.parse(fs.readFileSync(path.join(dossier, 'reel.json'), 'utf8')).kdf.N === 131072 && faux === 'phrase' && vrai === 'ok' && duree > 20, [faux, vrai, duree].join());
  R.fermer();

  /* ---------- 9. Ouverture scellée par la prise de service ---------- */
  console.log('Ouverture scellée (service S, frein réel de 2 s) :');
  const INFO = 'jarvis-coffre ouverture v1', deU = (x) => Buffer.from(x, 'base64url');
  /* le même paquet, écrit avec node:crypto d'après le protocole (sans les espaces de fin) ; les options le faussent */
  function scellerNode(phrase, cle, defi, {dedans = defi, aad = INFO, info = INFO} = {}) {
    const e = crypto.createECDH('prime256v1'); e.generateKeys();
    const k = Buffer.from(crypto.hkdfSync('sha256', e.computeSecret(deU(cle)), deU(defi), Buffer.from(info), 32));
    const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', k, iv); c.setAAD(Buffer.from(aad));
    const ct = Buffer.concat([c.update(JSON.stringify({phrase, defi: dedans})), c.final(), c.getAuthTag()]);
    return {epk: e.getPublicKey().toString('base64url'), iv: iv.toString('base64url'), ct: ct.toString('base64url')};
  }
  const tordre = (x, i = 5) => { const b = deU(x); b[i % b.length] ^= 1; return b.toString('base64url'); };
  const refusOuverture = [];   // toutes les réponses de refus d'ouvrir-scelle : elles doivent être identiques
  const scelle = async (d, paquet) => { const x = await appel(d.service, {commande: 'ouvrir-scelle', ...paquet}); if (!x.ok) refusOuverture.push(x.code + '|' + x.erreur); return x; };
  const defiDe = async (d) => appel(d.service, {commande: 'cle-ouverture'});
  const ouvertS = async (d) => (await appel(d.service, {commande: 'etat'})).ouvert;
  const S1 = await lancer('s');
  await appel(S1.admin, {commande: 'creer', phrase: PHRASE}); await appel(S1.admin, {commande: 'mettre', nom: 'jarvis-google', portee: 'service', valeur: V_SERVICE});
  await appel(S1.admin, {commande: 'mettre', nom: 'couches', portee: 'guichet', valeur: V_GUICHET}); await appel(S1.admin, {commande: 'fermer'});
  const kA = await appel(S1.admin, {commande: 'cle-ouverture'}); let k = await defiDe(S1);
  verif('cle-ouverture : publique, permise sur les deux prises ; clé P-256 brute (65 octets, non compressée), défi de 32 octets valable 2 minutes ; même clé, défis différents',
    kA.ok && k.ok && k.cle === kA.cle && k.defi !== kA.defi && deU(k.cle).length === 65 && deU(k.cle)[0] === 4 && deU(k.defi).length === 32 && /^[A-Za-z0-9_-]+$/.test(k.cle + k.defi)
    && k.expire - Date.now() > 110_000 && k.expire - Date.now() <= 120_000 && Object.keys(k).sort().join() === 'cle,defi,expire,ms,ok', JSON.stringify(k));
  const p1 = await scellerPhrase(PHRASE, k.cle, k.defi);
  verif('sceller.mjs (WebCrypto) : paquet {epk, iv, ct} en base64url, clair complété à 256 octets ; la phrase n’y est sous aucune forme', Object.keys(p1).sort().join() === 'ct,epk,iv'
    && deU(p1.epk).length === 65 && deU(p1.iv).length === 12 && deU(p1.ct).length === 256 + 16 && /^[A-Za-z0-9_-]+$/.test(p1.epk + p1.iv + p1.ct) && contient(JSON.stringify(p1)).length === 0, JSON.stringify(p1).length);
  r = await appel(S1.admin, {commande: 'ouvrir-scelle', ...p1});
  verif('ouvrir-scelle n’existe pas sur admin.sock (et n’y consomme rien)', refuse(r, 'inconnue') && !(await ouvertS(S1)), JSON.stringify(r));
  r = await scelle(S1, p1);
  const ls = await appel(S1.service, {commande: 'lire', nom: 'jarvis-google'});
  verif('ouvrir-scelle : le paquet de la page ouvre le coffre, sans attente ; lire rend le secret « service », jamais le « guichet »', r.ok === true && r.ms < 1500 && (await ouvertS(S1)) && ls.valeur === V_SERVICE
    && refuse(await appel(S1.service, {commande: 'lire', nom: 'couches'}), 'portee'), JSON.stringify(r));
  await appel(S1.service, {commande: 'fermer'});
  r = await scelle(S1, p1);
  verif('le même paquet rejoué : refusé (défi à usage unique), coffre resté verrouillé', refuse(r, 'ouverture') && r.ms < 1000 && !(await ouvertS(S1)), JSON.stringify(r));
  const tordus = [];
  for (const champ of ['epk', 'iv', 'ct']) { k = await defiDe(S1); const p = await scellerPhrase(PHRASE, k.cle, k.defi); tordus.push(await scelle(S1, {...p, [champ]: tordre(p[champ])})); }
  k = await defiDe(S1); const autreCle = crypto.createECDH('prime256v1'); autreCle.generateKeys();
  tordus.push(await scelle(S1, {...(await scellerPhrase(PHRASE, k.cle, k.defi)), epk: autreCle.getPublicKey().toString('base64url')}));   // un autre point, valide
  k = await defiDe(S1); const pBon = await scellerPhrase(PHRASE, k.cle, k.defi);
  for (const faux of [{...pBon, epk: Buffer.concat([Buffer.from([4]), Buffer.alloc(64)]).toString('base64url')}, {...pBon, epk: autreCle.getPublicKey('base64url', 'compressed')}, {...pBon, ct: pBon.ct + '='},
    {...pBon, ct: 'A'.repeat(8000)}, {...pBon, ct: Buffer.alloc(16).toString('base64url')}]) tordus.push(await scelle(S1, faux));
  const etudies = (S1.sortie.match(/sceau invalide/g) || []).length;   // un paquet étudié puis refusé laisse une ligne ; un paquet non étudié, aucune
  verif('epk, iv ou ct modifiés d’un bit, autre clé, point hors courbe ou compressé, ct trop long, trop court ou hors alphabet (' + tordus.length + ' paquets) : tous étudiés et refusés, service debout, coffre verrouillé',
    tordus.length === 9 && etudies === 10 && tordus.every((x) => refuse(x, 'ouverture') && x.ms < 1000) && S1.proc.exitCode === null && !(await ouvertS(S1)), etudies + ' ' + JSON.stringify(tordus.filter((x) => !refuse(x, 'ouverture'))));
  /* 10 sceaux invalides en quelques secondes (le rejeu et ces 9) : ce service n'étudie plus rien pendant une minute */
  k = await defiDe(S1); r = await scelle(S1, await scellerPhrase(PHRASE, k.cle, k.defi));
  verif('après 10 sceaux invalides en une minute : même un bon paquet n’est plus étudié (et le secours par admin.sock ouvre toujours)', refuse(r, 'ouverture') && !(await ouvertS(S1)) && (S1.sortie.match(/sceau invalide/g) || []).length === 10
    && (await appel(S1.admin, {commande: 'ouvrir', phrase: PHRASE})).ok === true && /plus aucun paquet étudié/.test(S1.sortie), JSON.stringify(r));
  /* redémarrage : paire de clés neuve ; un paquet scellé pour l'ancien processus ne vaut plus rien */
  k = await defiDe(S1); const pVieux = await scellerPhrase(PHRASE, k.cle, k.defi), cleS1 = k.cle;
  await S1.arreter('SIGTERM');
  const S2 = await lancer('s');
  k = await defiDe(S2); r = await scelle(S2, pVieux);
  const pCroise = await scellerPhrase(PHRASE, cleS1, k.defi), r2s = await scelle(S2, pCroise);   // l'ancienne clé, un défi du nouveau processus
  verif('après un redémarrage : clé publique neuve ; un paquet scellé pour l’autre processus est refusé, même avec un défi courant', k.cle !== cleS1 && refuse(r, 'ouverture') && refuse(r2s, 'ouverture') && !(await ouvertS(S2)), JSON.stringify([r, r2s]));
  k = await defiDe(S2); r = await scelle(S2, await scellerPhrase(FAUSSE, k.cle, k.defi));
  verif('mauvaise phrase bien scellée : refusée, freinée 2 secondes comme sur admin.sock, même réponse qu’un sceau invalide', refuse(r, 'ouverture') && r.ms >= 1900 && !(await ouvertS(S2)) && /phrase refusée \(1 essai/.test(S2.sortie), r.ms + ' ms ' + JSON.stringify(r));
  k = await defiDe(S2); const k2 = await defiDe(S2);
  const rD = await scelle(S2, scellerNode(PHRASE, k.cle, k.defi, {dedans: k2.defi})), rA = await scelle(S2, scellerNode(PHRASE, k2.cle, k2.defi, {aad: 'autre usage'}));
  k = await defiDe(S2); const rI = await scelle(S2, scellerNode(PHRASE, k.cle, k.defi, {info: 'jarvis-coffre ouverture v2'}));
  verif('paquet écrit avec node:crypto : défi du clair différent de celui de la clé, autre AAD ou autre info de HKDF → refusés', refuse(rD, 'ouverture') && refuse(rA, 'ouverture') && refuse(rI, 'ouverture') && !(await ouvertS(S2)));
  k = await defiDe(S2); r = await scelle(S2, scellerNode(PHRASE, k.cle, k.defi));
  verif('paquet écrit avec node:crypto d’après le protocole (sans espaces de fin) : ouvre aussi ; le compteur d’échecs repart de zéro', r.ok === true && (await ouvertS(S2)) && (await appel(S2.service, {commande: 'lire', nom: 'jarvis-google'})).valeur === V_SERVICE, JSON.stringify(r));
  k = await defiDe(S2); r = await scelle(S2, await scellerPhrase(FAUSSE, k.cle, k.defi));
  verif('coffre déjà ouvert : un paquet valide répond « déjà » sans étudier la phrase (comme ouvrir), et ne ferme rien', r.ok === true && r.deja === true && r.ms < 1000 && (await ouvertS(S2)), JSON.stringify(r));
  for (const c of [{commande: 'creer', phrase: PHRASE2}, {commande: 'ouvrir', phrase: PHRASE}, {commande: 'mettre', nom: 'jarvis-x', portee: 'service', valeur: 'v'}, {commande: 'changer-phrase', ancienne: PHRASE, nouvelle: PHRASE2}, {commande: 'retirer', nom: 'couches'}])
    refusOuverture.push(refuse(await appel(S2.service, c), 'interdit') ? 'ouverture|ouverture refusée' : 'service.sock a accepté ' + c.commande);
  verif('service.sock n’a gagné que cle-ouverture et ouvrir-scelle : creer, ouvrir, mettre, changer-phrase, retirer toujours refusés', refusOuverture.slice(-5).every((x) => x === 'ouverture|ouverture refusée'), refusOuverture.slice(-5).join());
  await S2.arreter('SIGTERM');

  console.log('Ouverture scellée (service C, frein raccourci) :');
  const Cs = await lancer('c', {COFFRE_FREIN_MS: '40'});
  await appel(Cs.admin, {commande: 'creer', phrase: PHRASE}); await appel(Cs.admin, {commande: 'fermer'});
  const mixtes = [];
  for (let i = 0; i < 3; i++) { k = await defiDe(Cs); mixtes.push(await scelle(Cs, await scellerPhrase(FAUSSE + i, k.cle, k.defi))); }
  for (let i = 0; i < 2; i++) mixtes.push(await appel(Cs.admin, {commande: 'ouvrir', phrase: FAUSSE + i}));
  k = await defiDe(Cs); r = await scelle(Cs, await scellerPhrase(PHRASE, k.cle, k.defi));
  const rAdm = await appel(Cs.admin, {commande: 'ouvrir', phrase: PHRASE});
  verif('frein commun aux deux chemins : 3 mauvaises phrases scellées + 2 par admin.sock → coffre bloqué 10 minutes, la bonne phrase est refusée des deux côtés',
    mixtes.slice(0, 3).every((x) => refuse(x, 'ouverture')) && mixtes.slice(3).every((x) => refuse(x, 'phrase')) && refuse(r, 'ouverture') && refuse(rAdm, 'bloque')
    && (await appel(Cs.admin, {commande: 'etat'})).bloque > 590 && !(await ouvertS(Cs)) && /coffre bloqué 10 minutes/.test(Cs.sortie), JSON.stringify([r, rAdm]));
  verif('tous les refus d’ouvrir-scelle (' + refusOuverture.length + ') portent la même réponse : sceau, rejeu, phrase et blocage ne se distinguent pas', refusOuverture.length >= 25 && new Set(refusOuverture).size === 1, [...new Set(refusOuverture)].join(' / '));
  await Cs.arreter('SIGTERM');

  console.log('Ouverture scellée, dans le processus (horloge du banc) :');
  { const O = neuf(path.join(dossier, 'ouverture.json')), avantO = lignes.length;
    const cleO = async () => O.traiter('service', {commande: 'cle-ouverture'}), ouvreO = async (p) => { const x = await O.traiter('service', {commande: 'ouvrir-scelle', ...p}); return x.ok ? 'ok' : x.code; };
    let kO = await cleO(); const pSans = await scellerPhrase(PHRASE, kO.cle, kO.defi);
    verif('aucun coffre encore : ouvrir-scelle refuse comme le reste', await ouvreO(pSans) === 'ouverture' && O.etat().existe === false);
    await O.creer(PHRASE); O.fermer();
    kO = await cleO(); const pTard = await scellerPhrase(PHRASE, kO.cle, kO.defi), fin = kO.expire;
    t = fin;   // à l'instant de l'expiration, le défi n'existe plus
    const tard = await ouvreO(pTard);
    t += 61_000; kO = await cleO(); const pJuste = await scellerPhrase(PHRASE, kO.cle, kO.defi); t = kO.expire - 1;
    verif('défi expiré (2 minutes) : refusé ; à une milliseconde de la fin : accepté', kO.expire - (fin + 61_000) === 120_000 && tard === 'ouverture' && await ouvreO(pJuste) === 'ok' && O.etat().ouvert === true, tard); O.fermer();
    t += 61_000; const neufDefis = []; for (let i = 0; i < 9; i++) neufDefis.push(await cleO());
    const p0 = await scellerPhrase(PHRASE, neufDefis[0].cle, neufDefis[0].defi), pb = await scellerPhrase(PHRASE, neufDefis[1].cle, neufDefis[1].defi), p8 = await scellerPhrase(PHRASE, neufDefis[8].cle, neufDefis[8].defi);
    const d0 = await ouvreO(p0), d1 = await ouvreO(pb), d8 = await ouvreO(p8);
    verif('8 défis en attente au plus : le 9e fait tomber le 1er ; un sceau invalide coûte le plus ancien défi restant (le 2e) ; le 9e ouvre', new Set(neufDefis.map((x) => x.defi)).size === 9 && d0 === 'ouverture' && d1 === 'ouverture' && d8 === 'ok', [d0, d1, d8].join()); O.fermer();
    t += 61_000; const dix = []; for (let i = 0; i < 10; i++) dix.push(await ouvreO({epk: 'AAAA', iv: 'AAAA', ct: 'AAAA'}));
    kO = await cleO(); const pLimite = await scellerPhrase(PHRASE, kO.cle, kO.defi), pendant = await ouvreO(pLimite);
    t += 60_001;
    verif('10 sceaux invalides en une minute : le 11e paquet, bon, n’est pas étudié (ni son défi consommé) ; une minute plus tard il ouvre', dix.every((x) => x === 'ouverture') && pendant === 'ouverture' && O.etat().ouvert === false && await ouvreO(pLimite) === 'ok', pendant); O.fermer();
    t += 61_000; kO = await cleO();
    const longue = await ouvreO(scellerNode('é'.repeat(600), kO.cle, kO.defi)), enorme = await ouvreO(scellerNode('x'.repeat(5000), kO.cle, kO.defi));
    verif('phrase scellée de plus de 1024 octets, ou paquet de plus de 4 Kio : refusés sans exception', longue === 'ouverture' && enorme === 'ouverture' && O.etat().ouvert === false, longue + ' ' + enorme);
    t += 61_000; kO = await cleO(); const pForme = await scellerPhrase(PHRASE, kO.cle, kO.defi), avantF = lignes.filter((l) => /sceau invalide/.test(l)).length, formes5 = [];
    for (const faux of [{}, {epk: pForme.epk, iv: pForme.iv}, {...pForme, ct: 42}, {...pForme, epk: ['a']}, {...pForme, iv: ''}]) formes5.push(await ouvreO(faux));
    verif('champs absents, vides ou d’un autre type : étudiés, refusés, sans exception', formes5.every((x) => x === 'ouverture') && lignes.filter((l) => /sceau invalide/.test(l)).length - avantF === 5 && O.etat().ouvert === false, formes5.join());
    const journalO = lignes.slice(avantO).join('\n');
    verif('journal de l’ouverture scellée : il dit « sceau invalide » ou « phrase refusée », jamais une phrase, un défi ni un paquet', /sceau invalide/.test(journalO) && /coffre ouvert/.test(journalO) && contient(journalO).length === 0
      && ![...neufDefis.map((x) => x.defi), p8.ct, p8.epk, pLimite.ct].some((x) => journalO.includes(x)));
  }

  /* ---------- 10. Rien de secret nulle part ---------- */
  console.log('Fuites :');
  const sorties = demons.map((d) => d.sortie).join('\n');
  verif('sorties des services (' + demons.length + ' lancements) : ni phrase ni valeur, sous aucune forme', contient(sorties).length === 0 && /coffre ouvert/.test(sorties), contient(sorties).length);
  verif('services : aucune erreur interne ni imprévue au journal', !/erreur interne|erreur imprévue/.test(sorties) && !/erreur interne/.test(lignes.join('\n')), sorties.split('\n').filter((l) => /erreur/.test(l)).join(' | '));
  const fichiers = []; (function tous(d) { for (const e of fs.readdirSync(d, {withFileTypes: true})) { const p = path.join(d, e.name); if (e.isDirectory()) tous(p); else if (e.isFile()) fichiers.push(p); } })(T);
  const sales = fichiers.filter((f) => contient(fs.readFileSync(f, 'latin1') + fs.readFileSync(f, 'utf8')).length);
  verif('tous les fichiers écrits (' + fichiers.length + ') : ni phrase ni valeur ; tous en 0600', sales.length === 0 && fichiers.length >= 15 && fichiers.every((f) => mode(f) === '600'), sales.join(' ') + ' ' + fichiers.filter((f) => mode(f) !== '600').join(' '));
  const guichet = echanges.filter((e) => contient(e.texte, [V_GUICHET, PHRASE, PHRASE2, FAUSSE]).length);
  const rendus = echanges.filter((e) => contient(e.texte, [V_SERVICE, V_ECRIT, V_CONS]).length);
  verif('sur ' + echanges.length + ' réponses des prises : aucune ne porte une phrase ou la valeur « guichet »', guichet.length === 0 && echanges.length > 60, guichet.map((e) => e.commande).join());
  verif('… et une valeur « service » ne sort que par « lire » sur service.sock', rendus.length >= 8 && rendus.every((e) => e.commande === 'lire' && e.prise === 'service.sock'), rendus.map((e) => e.prise + ':' + e.commande).join());
} catch (e) { verif('exception du banc', false, e.stack); }
for (const d of demons) if (d.proc.exitCode === null && d.proc.signalCode === null) d.proc.kill('SIGKILL');
fs.rmSync(T, {recursive: true, force: true});
console.log('\nCoffre en mémoire : ' + ok + ' vérifications réussies, ' + ko + ' en échec.');
process.exit(ko ? 1 : 0);
