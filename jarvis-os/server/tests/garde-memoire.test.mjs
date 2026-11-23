/* Banc de la garde de la mémoire (0.70.1) : node tests/garde-memoire.test.mjs (aucun Claude, aucun coût). */
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {createGardeMemoire} from '../garde-memoire.mjs';
import {createFlux} from '../flux.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
try {
  let t = 1_000_000; const lignes = [];
  const g = createGardeMemoire({now: () => t, libre: () => 812e6, ecrire: (x) => lignes.push(x)});
  ok('Garde mémoire : la première retenue est écrite, avec la mémoire libre et le seuil en Mo', g.noter('seconde mission retardée', 600e6) === true
    && lignes[0] === '[jarvis] mémoire basse : seconde mission retardée (libre 812 Mo, seuil 600 Mo)', lignes[0]);
  t += 5 * 60000;
  ok('Garde mémoire : la même retenue dans les 10 minutes n’est pas réécrite (journal sans rafale)', g.noter('seconde mission retardée', 600e6) === false && lignes.length === 1);
  ok('Garde mémoire : un autre genre est écrit à part', g.noter('Siri passe par la file commune', 400e6) === true && lignes.length === 2);
  t += 6 * 60000;
  ok('Garde mémoire : passé 10 minutes, la même retenue est réécrite', g.noter('seconde mission retardée', 600e6) === true && lignes.length === 3);
  ok('Garde mémoire : toutes les retenues sont comptées, même celles non écrites', g.retenues() === 4, String(g.retenues()));

  /* le flux de la discussion : en « Auto », Sonnet n'est pas préparé faute de mémoire, et c'est signalé */
  const vus = [];
  const f = createFlux({bin: path.join(HERE, 'fake-claude.mjs'), env: () => ({...process.env}), settings: () => ({}), cwd: '/tmp', conso: () => {}, friendly: (e) => String(e), dateLigne: () => '',
    activite: {debut: () => {}, fin: () => {}, etape: () => {}}, models: {quick: 'haiku', default: 'sonnet'}, memLibre: () => 100e6, prepMem: 900e6,
    auBord: (genre, seuil) => vus.push([genre, seuil])});
  const r = f.preparer({tier: 'auto', system: 'consigne', input: [{role: 'user', content: 'bonjour'}]});
  ok('Garde mémoire : « Auto » sans mémoire libre signale « Sonnet pas préparé » au seuil de 900 Mo', r && r.aussi && r.aussi.error === 'mémoire' && vus.length === 1 && vus[0][0] === 'Sonnet pas préparé' && vus[0][1] === 900e6, JSON.stringify([r && r.aussi, vus]));
  f.fermerTout();

  const srv = fs.readFileSync(path.join(HERE, '..', 'server.mjs'), 'utf8');
  ok('Garde mémoire : le serveur la branche sur Siri, la seconde mission et le flux', /GARDE_MEM\.noter\('Siri passe par la file commune'/.test(srv)
    && /GARDE_MEM\.noter\('seconde mission retardée'/.test(srv) && /auBord: \(genre, seuil\) => GARDE_MEM\.noter\(genre, seuil\)/.test(srv));
  const diag = fs.readFileSync(path.join(HERE, '..', '..', 'hermes', 'diagnostic.sh'), 'utf8');
  ok('Garde mémoire : diagnostic.sh d’Hermes compte ces lignes', diag.includes('mémoire basse'));
} catch (e) { ok('exception', false, e.stack); }
console.log(results.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + results.length + ' vérifications).');
process.exit(fails ? 1 : 0);
