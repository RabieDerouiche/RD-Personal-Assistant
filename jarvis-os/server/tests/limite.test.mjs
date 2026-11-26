/* Banc de la limite du forfait Claude (0.89.0) : node jarvis-os/server/tests/limite.test.mjs — mêmes exemples que essais/hermes/relance.test.sh */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {estLimite, repriseDe, limiteDe, heureParis, ecritureFaite, createAvisRelance} from '../limite.mjs';
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const Q = Date.UTC(2026, 10, 26, 9, 20), S1 = 1000;   /* le 26/11/2026, 10 h 20 à Paris */
const cas = [
  ["You've hit your 5-hour limit · resets 10:40am (UTC)", Q + 4800 * S1, 'reprise le jour même à 10 h 40 UTC'],
  ["Error: You've hit your limit · resets 8am (UTC)", Q + 81600 * S1, '8 h UTC déjà passé : le lendemain'],
  ["You've hit your limit · resets 3pm (Europe/Paris)", Q + 16800 * S1, '15 h à Paris = 14 h UTC en hiver'],
  ['Opus weekly limit reached ∙ resets Dec 2, 7pm (Europe/Paris)', Q + (6 * 86400 + 31200) * S1, 'limite de la semaine, avec sa date'],
  ['Claude AI usage limit reached|' + (Q / 1000 + 3600), Q + 3600 * S1, 'ancien format, époque'],
  ['HTTP 429 Too Many Requests, retry-after: 120s', Q + 120 * S1, '429 et retry-after'],
  ['RateLimitError: rate limit exceeded', null, 'la limite, sans heure'],
  ['Claude AI usage limit reached|' + (Q / 1000 + 21 * 86400), null, 'une heure absurde écartée']];
for (const [t, w, nom] of cas) ok('reprise : ' + nom, repriseDe(t, Q) === w && estLimite(t), String(repriseDe(t, Q)));
ok('une panne ordinaire n’est pas la limite', !estLimite('ConnectionError: Timeout talking to provider') && limiteDe('ConnectionError: DNS', Q) === null);
const l = limiteDe('RateLimitError: rate limit exceeded', Q);
ok('sans heure annoncée : 30 minutes après, « inconnue »', l && l.reprise === Q + 1800 * S1 && l.connue === false);
ok('heure de Paris : « 11 h 40 » le jour même, « le 02/12 à 19 h 00 » un autre jour', heureParis(Q + 4800 * S1, Q) === '11 h 40' && heureParis(Q + (6 * 86400 + 31200) * S1, Q) === 'le 02/12 à 19 h 00', heureParis(Q + 4800 * S1, Q) + ' / ' + heureParis(Q + (6 * 86400 + 31200) * S1, Q));
ok('écriture faite : un brouillon, une ligne de Pilotage, un mail ; pas TodoWrite ni une lecture', ecritureFaite(['mcp__claude_ai_Gmail__create_draft']) && ecritureFaite(['WebSearch', 'mcp__claude_ai_Google_Sheets__append_values']) && ecritureFaite(['mcp__claude_ai_Gmail__send_message']) && !ecritureFaite(['TodoWrite', 'WebSearch', 'mcp__claude_ai_Gmail__search_threads', 'mcp__claude_ai_Google_Sheets__get_values']) && !ecritureFaite(undefined));
/* les avis de root : poussés une fois, un lien jamais suivi, un nom inattendu ignoré */
const D = fs.mkdtempSync(path.join(os.tmpdir(), 'limite-')), AV = path.join(D, 'avis'); fs.mkdirSync(AV);
fs.writeFileSync(path.join(AV, 'avis-1796000000-routine-prix-suivis.json'), JSON.stringify({cle: 'routine-prix-suivis', titre: 'Hermes : « prix-suivis » en échec après la relance', texte: 'De nouveau en échec.'}));
fs.writeFileSync(path.join(D, 'secret.json'), JSON.stringify({titre: 'SECRET'})); fs.symlinkSync(path.join(D, 'secret.json'), path.join(AV, 'avis-1796000001-lien.json'));
fs.writeFileSync(path.join(AV, 'autre.json'), JSON.stringify({titre: 'AUTRE'}));
fs.writeFileSync(path.join(AV, 'etat.json'), JSON.stringify({at: 1, attente: [{nom: 'digest-ia', reprise: 2}], relances: []}));
const S = {push: {subs: [1]}}, envoyes = []; let saves = 0;
const A = createAvisRelance({dir: AV, S, save: () => { saves++; }, push: {send: async (n) => { envoyes.push(n); }}});
const n1 = await A.tick(), n2 = await A.tick();
ok('avis de root : poussé une fois (titre, vers la santé), un lien et un nom inattendu ignorés', n1 === 1 && n2 === 0 && envoyes.length === 1 && envoyes[0].title === 'Hermes : « prix-suivis » en échec après la relance' && envoyes[0].url === '/#voir-sante' && !envoyes.some((x) => /SECRET|AUTRE/.test(x.title)) && saves === 1, JSON.stringify(envoyes));
ok('résumé de root (etat.json) lu, et absent sans dossier', A.etat().attente[0].nom === 'digest-ia' && createAvisRelance({dir: path.join(D, 'rien'), S: {}, save() {}, push: {}}).etat() === null);
fs.rmSync(D, {recursive: true, force: true});
console.log(results.join('\n'));
console.log((fails ? 'ÉCHECS : ' + fails : 'Tout est bon') + ' (' + results.length + ' vérifications)');
process.exit(fails ? 1 : 0);
