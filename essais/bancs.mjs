#!/usr/bin/env node
/* Les bancs d'essai, lancés intelligemment (28/11/2026 ; sa demande : « refais une passe sur comment les bancs sont lancés et gérés, ça devient
   beaucoup trop lent ; je ne veux pas qu'on fasse moins de bancs, mais de façon plus intelligente et optimisée »).

     node essais/bancs.mjs              ce qui a besoin de tourner (les bancs dont les fichiers ont changé depuis leur dernier passage vert)
     node essais/bancs.mjs --tout       tous, sans tenir compte du dernier passage
     node essais/bancs.mjs --quoi       dit seulement ce qui tournerait, et pourquoi
     node essais/bancs.mjs app radar    ceux-là seulement (noms : app, portail, ordres, relance, garde, routines-conf, note, et chaque
                                        banc du serveur par son nom de fichier sans « .test.mjs » : server, jours, travail, radar…)
     node essais/bancs.mjs app --seg "0\.101"    le banc de l'app, seulement les segments dont le code contient cette expression (essai rapide
                                                 pendant qu'on écrit ; ne compte pas comme un passage vert)

   Ce qui le rend rapide, sans une vérification de moins :
   1. chaque banc connaît ses fichiers : il ne retourne que s'ils ont changé depuis son dernier passage vert (empreinte gardée dans
      essais/.bancs-verts.json, hors dépôt) ; un texte de documentation ou une skill ne relance pas le banc de l'app ;
   2. le banc de l'app (19 minutes d'attente sur 26 quand il tourne en file) est découpé en segments indépendants, lancés à quatre navigateurs
      en même temps, répartis d'après leur durée ; un segment en échec est relancé seul, une fois, pour séparer l'instable du vrai défaut ;
   3. les bancs du serveur tournent à plusieurs en même temps ; le banc du portail (le plus long) tourne à côté ;
   4. un passage n'est compté vert que si ses fichiers n'ont pas bougé pendant qu'il tournait.
   Sortie : une ligne par banc (vert, rouge, sauté et depuis quand), les échecs mot pour mot, la durée totale ; code 0 si tout est vert. */
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), VERTS = path.join(RACINE, 'essais', '.bancs-verts.json');
const args = process.argv.slice(2), opt = (n) => args.includes(n), iSeg = args.indexOf('--seg'), SEG = iSeg >= 0 ? args[iSeg + 1] : '';
const noms = args.filter((a, i) => !a.startsWith('--') && !(iSeg >= 0 && i === iSeg + 1));
const JOURNAUX = fs.mkdtempSync(path.join(os.tmpdir(), 'bancs-')), COEURS = Math.max(2, Math.min(4, os.cpus().length));
const APP = 'essais/jarvis-os-maquette', SERVEUR = 'jarvis-os/server', HERMES = 'jarvis-os/hermes';

/* ---------- les bancs et leurs fichiers ---------- */
const bancs = [{nom: 'app', sorte: 'app', cmd: ['node', APP + '/banc/banc.cjs'], entrees: [APP]}];
for (const f of fs.readdirSync(path.join(RACINE, SERVEUR, 'tests')).filter((x) => x.endsWith('.test.mjs')).sort()) {
  const src = fs.readFileSync(path.join(RACINE, SERVEUR, 'tests', f), 'utf8');
  bancs.push({nom: f.replace('.test.mjs', ''), sorte: 'serveur', cmd: ['node', SERVEUR + '/tests/' + f], entrees: [SERVEUR].concat(/jarvis-os-maquette|essais\//.test(src) ? [APP] : [], /hermes/.test(src) ? [HERMES] : [])});
}
const copies = ['jours', 'reponses', 'signe', 'signe-controle', 'radar', 'notify', 'pdf', 'bots', 'google'].map((m) => SERVEUR + '/' + m + '.mjs');
bancs.push({nom: 'portail', sorte: 'hermes', long: true, cmd: ['bash', 'essais/hermes/portail.test.sh'], entrees: [HERMES + '/portail', HERMES + '/limite.py', 'essais/hermes'].concat(copies)});
for (const n of ['ordres', 'relance', 'garde', 'routines-conf', 'note']) bancs.push({nom: n, sorte: 'hermes', cmd: ['bash', 'essais/hermes/' + n + '.test.sh'], entrees: [HERMES, 'essais/hermes'].concat(n === 'ordres' ? [SERVEUR + '/hermes-admin.mjs', SERVEUR + '/hermes-routines.mjs'] : [])});

/* ---------- l'empreinte des fichiers d'un banc ---------- */
const fichiers = (rel, acc = []) => { const abs = path.join(RACINE, rel); let st; try { st = fs.statSync(abs); } catch { return acc; }
  if (st.isFile()) { acc.push(rel); return acc; }
  for (const n of fs.readdirSync(abs).sort()) { if (n === 'node_modules' || n === '__pycache__' || n.startsWith('.bancs')) continue; fichiers(path.join(rel, n), acc); }
  return acc; };
const empreinte = (b) => { const h = crypto.createHash('sha256'); for (const f of [...new Set(b.entrees.flatMap((e) => fichiers(e)))].sort()) { h.update(f + '\0'); h.update(fs.readFileSync(path.join(RACINE, f))); h.update('\0'); } return h.digest('hex').slice(0, 24); };
let verts = {}; try { verts = JSON.parse(fs.readFileSync(VERTS, 'utf8')); } catch { verts = {}; }
const garder = () => { try { fs.writeFileSync(VERTS, JSON.stringify(verts, null, 1)); } catch { /* le passage suivant refera le banc */ } };

/* ---------- lancer une commande, garder sa sortie ---------- */
const lancer = (cmd, env, journal) => new Promise((res) => { const t0 = Date.now(), sortie = fs.createWriteStream(journal); let tout = '';
  const p = spawn(cmd[0], cmd.slice(1), {cwd: RACINE, env: {...process.env, ...env}});
  const lire = (d) => { tout += d; sortie.write(d); }; p.stdout.on('data', lire); p.stderr.on('data', lire);
  p.on('close', (code) => { sortie.end(); res({code, tout, ms: Date.now() - t0}); }); p.on('error', (e) => { sortie.end(); res({code: 127, tout: tout + String(e), ms: Date.now() - t0}); }); });
const file = async (taches, n) => { const res = []; let i = 0; await Promise.all(Array.from({length: Math.min(n, taches.length)}, async () => { while (i < taches.length) { const k = i++; res[k] = await taches[k](); } })); return res; };
const duree = (ms) => (ms >= 60000 ? Math.floor(ms / 60000) + ' min ' + String(Math.round(ms % 60000 / 1000)).padStart(2, '0') + ' s' : Math.round(ms / 1000) + ' s');
const compte = (t) => { const ok = (t.match(/^OK /gm) || []).length + (t.match(/^\s*✓/gm) || []).length, ko = (t.match(/^ÉCHEC /gm) || []).length + (t.match(/^\s*✗/gm) || []).length; return {ok, ko}; };
const echecs = (t) => t.split('\n').filter((l) => /^ÉCHEC |^\s*✗/.test(l)).map((l) => l.slice(0, 400));

/* ---------- le banc de l'app : segments répartis sur plusieurs navigateurs ---------- */
async function app(b, parts) {
  if (SEG) { const r = await lancer(b.cmd, {BANC_FILTRE: SEG}, path.join(JOURNAUX, 'app-filtre.log')); return {...r, ...compte(r.tout), echecs: echecs(r.tout), partiel: true}; }
  const l = await lancer(b.cmd, {BANC_LISTE: '1'}, path.join(JOURNAUX, 'app-liste.log')); let durees = {};
  try { durees = JSON.parse(l.tout.trim().split('\n').pop()); } catch { const r = await lancer(b.cmd, {}, path.join(JOURNAUX, 'app.log')); return {...r, ...compte(r.tout), echecs: echecs(r.tout)}; }
  const lots = Array.from({length: parts}, () => ({segs: [], ms: 0}));   /* les plus longs d'abord, chacun dans le lot le moins chargé */
  for (const [id, ms] of Object.entries(durees).sort((x, y) => y[1] - x[1])) { const m = lots.reduce((a, c) => (c.ms < a.ms ? c : a)); m.segs.push(id); m.ms += ms + 1500; }
  const t0 = Date.now(), res = await Promise.all(lots.filter((x) => x.segs.length).map((x, i) => lancer(b.cmd, {BANC_SEGS: x.segs.join(',')}, path.join(JOURNAUX, 'app-' + (i + 1) + '.log'))));
  let tout = res.map((r) => r.tout).join('\n'), rates = [...new Set(res.flatMap((r) => ((r.tout.match(/^SEGMENTS EN ÉCHEC : (.+)$/m) || [])[1] || '').split(',').filter(Boolean)))], instables = [];
  if (rates.length) {   /* un segment en échec repasse seul : l'instable (machine chargée) se sépare du vrai défaut */
    const seul = await lancer(b.cmd, {BANC_SEGS: rates.join(',')}, path.join(JOURNAUX, 'app-reprise.log')), encore = new Set(((seul.tout.match(/^SEGMENTS EN ÉCHEC : (.+)$/m) || [])[1] || '').split(',').filter(Boolean));
    instables = echecs(tout).filter((x) => !echecs(seul.tout).some((y) => y.split(' :: ')[0] === x.split(' :: ')[0]));
    tout = tout.split('\n').filter((x) => !/^ÉCHEC /.test(x)).join('\n') + '\n' + seul.tout.split('\n').filter((x) => /^ÉCHEC /.test(x)).join('\n'); rates = [...encore];
  }
  const c = compte(tout); return {code: c.ko ? 1 : 0, tout, ms: Date.now() - t0, ...c, echecs: echecs(tout), instables, lots: lots.map((x) => Math.round(x.ms / 1000))};
}

/* ---------- le passage ---------- */
const choisis = bancs.filter((b) => !noms.length || noms.includes(b.nom));
const inconnus = noms.filter((n) => !bancs.some((b) => b.nom === n)); if (inconnus.length) { console.log('Banc inconnu : ' + inconnus.join(', ') + '. Connus : ' + bancs.map((b) => b.nom).join(', ')); process.exit(2); }
const plan = choisis.map((b) => { const e = empreinte(b), v = verts[b.nom]; return {b, e, saute: !opt('--tout') && !SEG && v && v.e === e ? v : null}; });
const aFaire = plan.filter((x) => !x.saute);
for (const x of plan.filter((y) => y.saute)) console.log('sauté  ' + x.b.nom.padEnd(16) + 'inchangé depuis son passage vert du ' + x.saute.quand + ' (' + x.saute.ok + ' vérifications)');
if (opt('--quoi')) { for (const x of aFaire) console.log('à faire ' + x.b.nom.padEnd(15) + (verts[x.b.nom] ? 'ses fichiers ont changé' : 'jamais passé vert ici')); process.exit(0); }
if (!aFaire.length) { console.log('Rien à relancer : tout est vert et inchangé.'); process.exit(0); }
const T0 = Date.now(), resultats = [];
const finir = (x, r) => { const c = r.ok === undefined ? compte(r.tout) : r, vert = r.code === 0 && !c.ko, stable = empreinte(x.b) === x.e;
  if (vert && stable && !r.partiel) { verts[x.b.nom] = {e: x.e, quand: new Date().toLocaleString('fr-FR', {timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}), ok: c.ok}; garder(); }
  resultats.push({nom: x.b.nom, vert, ...c, ms: r.ms, echecs: r.echecs || echecs(r.tout), instables: r.instables || [], bouge: !stable, partiel: !!r.partiel, lots: r.lots, fin: vert ? '' : r.tout.trim().split('\n').slice(-3).join(' | ').slice(0, 300)});
  console.log((vert ? 'vert   ' : 'ROUGE  ') + x.b.nom.padEnd(16) + c.ok + ' passées' + (c.ko ? ', ' + c.ko + ' en échec' : '') + ' · ' + duree(r.ms) + (r.lots ? ' · ' + r.lots.length + ' navigateurs' : '') + (r.partiel ? ' · partiel (--seg)' : '') + (!stable ? ' · ses fichiers ont changé pendant le passage : pas compté vert' : '')); };
const un = (x) => async () => { const r = await lancer(x.b.cmd, {}, path.join(JOURNAUX, x.b.nom + '.log')); if (r.code !== 0 || compte(r.tout).ko) { const r2 = await lancer(x.b.cmd, {}, path.join(JOURNAUX, x.b.nom + '-reprise.log')); if (r2.code === 0 && !compte(r2.tout).ko) { r2.instables = echecs(r.tout); finir(x, r2); return; } } finir(x, r); };
const long = aFaire.filter((x) => x.b.long), serveur = aFaire.filter((x) => x.b.sorte === 'serveur'), hermes = aFaire.filter((x) => x.b.sorte === 'hermes' && !x.b.long), lApp = aFaire.find((x) => x.b.sorte === 'app');
/* le banc du portail (long) tourne à côté de tout le reste ; les bancs du serveur à trois en même temps, les petits bancs d'Hermes l'un après
   l'autre (ils partagent des dossiers du système) ; puis l'app, à quatre navigateurs (trois si le portail tourne encore) */
const pLong = file(long.map(un), 1);
await Promise.all([file(serveur.map(un), 3), file(hermes.map(un), 1)]);
if (lApp) { let fini = false; pLong.then(() => { fini = true; }); const parts = long.length && !fini ? COEURS - 1 : COEURS; finir(lApp, await app(lApp.b, parts)); }
await pLong;
const rouges = resultats.filter((r) => !r.vert);
for (const r of resultats) { for (const e of r.echecs) console.log('  ' + r.nom + ' : ' + e); for (const e of r.instables) console.log('  ' + r.nom + ' (instable : a passé seul) : ' + e.slice(0, 200)); if (!r.vert && !r.echecs.length) console.log('  ' + r.nom + ' : ' + r.fin); }
console.log((rouges.length ? rouges.length + ' banc(s) en échec' : 'Tout est vert') + ' · ' + resultats.reduce((t, r) => t + r.ok, 0) + ' vérifications passées · ' + duree(Date.now() - T0) + ' · journaux : ' + JOURNAUX);
process.exit(rouges.length ? 1 : 0);
