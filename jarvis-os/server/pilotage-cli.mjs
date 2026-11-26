/* JARVIS OS — Pilotage hébergé par JARVIS : la commande du serveur (0.88.0). Sous l'utilisateur jarvis (sudo -iu jarvis) :
     node server.mjs pilotage etat                      où en est le magasin, la phrase des copies, Google
     node server.mjs pilotage importer [--a-blanc]      relit tout le classeur Google et remplit le magasin (pilotage.json, 600)
                                       [--forcer]       … même s'il a déjà servi (service arrêté : sinon refusé)
     node server.mjs pilotage verifier                  compare le magasin au classeur, onglet par onglet, et « À toi »
     node server.mjs pilotage exporter [--a-blanc] [--tout]   retour arrière : réécrit dans le classeur les onglets changés depuis l'import
     node server.mjs pilotage cle                       sa phrase de passe des copies chiffrées (à taper lui-même, rien ne s'affiche)
     node server.mjs pilotage restaurer <fichier> | --drive [AAAA-MM-JJ] [--forcer]   une copie chiffrée, avec sa phrase (service arrêté)
     node server.mjs pilotage copie                     envoie tout de suite la copie chiffrée du jour dans Drive
   L'état du serveur (state.json) n'est que lu : l'accès Google sert sans rien y réécrire. Ce qui s'affiche : des comptes, des noms
   d'onglets et des dates, jamais le contenu d'une case ni un secret. */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {createGoogle} from './google.mjs';
import {A_TOI, construireMagasin, construireAtoi, createCopieDrive, creerCle, dechiffrer, ecrireFichierSur, ecrireMagasin, empreinte, grille, lireFichierSur, lireMagasin, nomPlage} from './pilotage-local.mjs';

const quand = (ms) => (ms ? new Intl.DateTimeFormat('fr-FR', {timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}).format(new Date(ms)) : '?');
const pleines = (rows) => (rows || []).filter((r) => (r || []).some((x) => String(x ?? '') !== '')).length;
/* deux grilles comparées comme Google les rend : cases vides de fin et lignes vides de fin retirées */
const normal = (rows) => { const o = (rows || []).map((r) => { const x = (r || []).map((v) => String(v ?? '')); while (x.length && x[x.length - 1] === '') x.pop(); return x; }); while (o.length && !o[o.length - 1].length) o.pop(); return o; };
/* la ligne « Grok Bot arrêté le » de l'onglet Faits (la condition de la bascule) : sa date, « (sans date) », ou '' si elle manque */
const sansAccent = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const grokArret = (faits) => { const hd = ((faits || [])[0] || []).map(sansAccent), iF = hd.indexOf('fait'), iV = hd.indexOf('valeur');
  const r = iF < 0 ? null : (faits || []).find((x, i) => i > 0 && sansAccent((x || [])[iF]) === 'grok bot arrete le'); return r ? (String(r[iV] ?? '').trim().match(/^\d{1,2}\/\d{1,2}\/\d{4}$/) || ['(sans date lisible)'])[0] : ''; };
/* une valeur réécrite dans le classeur (retour arrière) : saisie comme à la main, mais jamais une formule */
const texteSur = (v) => { const s = String(v ?? ''); return /^[=+\-@']/.test(s) ? "'" + s : s; };

/* « À toi » du classeur et celui du magasin : les mêmes lignes (dans n'importe quel ordre) et le même compte */
export function comparerAtoi(classeur, store) {
  const loc = construireAtoi(store), cle = (r) => r.join('\u0001'), pleine = (k) => k.replace(/\u0001/g, '') !== '';
  const a = normal(classeur).slice(3).map(cle).filter(pleine), b = normal(loc).slice(3).map(cle).filter(pleine), reste = new Map();
  for (const k of a) reste.set(k, (reste.get(k) || 0) + 1);
  let enTrop = 0; for (const k of b) { const n = reste.get(k) || 0; if (n) reste.set(k, n - 1); else enTrop++; }
  const manquent = [...reste.values()].reduce((s, n) => s + n, 0), c1 = String(((classeur || [])[0] || [])[1] ?? ''), c2 = String((loc[0] || [])[1] ?? '');
  return {identique: !manquent && !enTrop && c1 === c2, lignes: b.length, manquent, enTrop, compteClasseur: c1, compteJarvis: c2};
}

export async function cliPilotage({args, DATA, FILE, PILOTAGE, RD_RACINE, PORT, entree = process.stdin, sortie = process.stdout, now = Date.now}) {
  const dit = (t) => sortie.write(t + '\n');
  const [cmd, ...reste] = args || [], opt = new Set(reste.filter((x) => x.startsWith('--'))), pos = reste.filter((x) => !x.startsWith('--'));
  const MAG = path.join(DATA, 'pilotage.json'), CLE = path.join(DATA, 'pilotage-cle.json');
  const google = () => {
    let S; try { S = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { throw new Error('état du serveur illisible (' + (e.code || 'JSON') + ') : lance la commande sous l’utilisateur jarvis (sudo -iu jarvis).'); }
    const G = createGoogle({S, save: () => {}});   /* rien n'est réécrit dans state.json */
    if (!G.status('').linked) throw new Error('Google n’est pas relié à JARVIS (Réglages, Connecter Google).');
    return G;
  };
  const enMarche = async () => { try { await fetch('http://127.0.0.1:' + PORT + '/api/status', {signal: AbortSignal.timeout(1500)}); return true; } catch { return false; } };
  const lireMag = () => { try { return lireMagasin(MAG); } catch (e) { if (e.code === 'ENOENT') return null; throw new Error('pilotage.json illisible (' + (e.code || e.message) + ').'); } };
  const garderAncien = () => { if (!fs.existsSync(MAG)) return ''; const f = MAG + '.avant-' + new Date(now()).toISOString().replace(/[-:]/g, '').slice(0, 13); ecrireFichierSur(f, lireFichierSur(MAG)); return path.basename(f); };
  async function lireClasseur(G) {
    const titres = await G.interne.titres(PILOTAGE); if (!titres.length) throw new Error('Classeur Pilotage sans onglet lisible.');
    const onglets = {};
    for (const t of titres) onglets[t] = ((await G.tool('Google Sheets', 'get_values', {spreadsheetId: PILOTAGE, range: nomPlage(t)})) || {}).values || [];
    return {titres, onglets, formules: await G.interne.formules(PILOTAGE)};
  }
  const direAtoi = (c) => dit('« À toi » : ' + (c.identique ? 'identique au classeur' : 'DIFFÉRENT du classeur') + ' (' + c.lignes + ' lignes ; compte « ' + c.compteJarvis + ' »' + (c.identique ? '' : ', classeur « ' + c.compteClasseur + ' », ' + c.manquent + ' ligne(s) manquante(s), ' + c.enTrop + ' en trop') + ').');
  /* lecture masquée, comme le coffre d'Hermes : un vrai terminal seulement (jamais un tube ni une autre session) */
  const masque = (q) => new Promise((resolve, reject) => {
    sortie.write(q); let v = '';
    const on = (d) => { for (const c of String(d)) {
      if (c === '\r' || c === '\n') return fin(v);
      if (c === '\u0003' || c === '\u0004') return fin(null, new Error('Annulé.'));
      if (c === '\u007f' || c === '\b') { v = v.slice(0, -1); continue; }
      if (c >= ' ') v += c;
    } };
    const fin = (x, e) => { entree.removeListener('data', on); try { entree.setRawMode(false); } catch { /* rien */ } entree.pause(); sortie.write('\n'); if (e) reject(e); else resolve(x); };
    entree.setRawMode(true); entree.setEncoding('utf8'); entree.resume(); entree.on('data', on);
  });
  const question = (q) => new Promise((resolve) => { const rl = readline.createInterface({input: entree, output: sortie}); rl.question(q, (r) => { rl.close(); resolve(String(r || '').trim().toLowerCase()); }); });
  const terminal = () => { if (entree.isTTY && typeof entree.setRawMode === 'function') return true; dit('Refusé : la phrase de passe se tape soi-même dans un terminal (Termius), jamais par un tube ni par une autre session.'); return false; };

  try {
    if (cmd === 'etat') {
      const st = lireMag();
      dit('Magasin : ' + (st ? 'importé le ' + quand(st.importe.at) + (st.local ? ', hébergé par JARVIS depuis le ' + quand(st.local.depuis) : ', pas encore servi par JARVIS') : 'absent (pas encore importé)'));
      if (st) for (const n of st.ordre) dit('  ' + n + ' : ' + pleines(grille(st, n)) + ' lignes' + (n === A_TOI ? ' (calculé)' : n === 'Prix' && st.calcules.Prix ? ' (colonne D calculée)' : '') + (st.importe.empreintes[n] && empreinte(st.onglets[n]) !== st.importe.empreintes[n] ? ', changé depuis l’import' : ''));
      if (st) dit('Faits, « Grok Bot arrêté le » : ' + (grokArret(st.onglets.Faits) || 'absente') + '.');
      dit('Phrase des copies chiffrées : ' + (fs.existsSync(CLE) ? 'posée' : 'à poser (pilotage cle)'));
      try { const G = google(); dit('Google : relié ; écriture des copies dans Drive : ' + ({oui: 'accordée', non: 'non accordée (Réglages, Google, « Reconnecter »)', inconnue: 'pas encore vue (lien d’avant la 0.88.0)'}[G.drive.portee()] || '?') + '.'); }
      catch (e) { dit('Google : ' + e.message); }
      return 0;
    }
    if (cmd === 'importer') {
      const G = google(), c = await lireClasseur(G), st = construireMagasin({onglets: c.onglets, ordre: c.titres, formules: c.formules, source: 'Google Sheets', at: now()});
      dit('Classeur lu : ' + c.titres.length + ' onglets.');
      for (const n of st.ordre) dit('  ' + n + ' : ' + (n === A_TOI ? 'calculé' : st.importe.comptes[n] + ' lignes'));
      dit('Formules refaites par JARVIS : « À toi » (tout l’onglet)' + (st.calcules.Prix ? ', Prix colonne D (' + st.calcules.Prix.lignes.length + ' cases)' : '') + '. Gardées en valeur : ' + (st.importe.figees.length ? st.importe.figees.join(', ') : 'aucune') + '.');
      const cmp = comparerAtoi(c.onglets[A_TOI], st); direAtoi(cmp);
      dit('Faits, « Grok Bot arrêté le » : ' + (grokArret(c.onglets.Faits) || 'absente') + '.');
      const ancien = lireMag(); if (ancien) dit('Magasin actuel : importé le ' + quand(ancien.importe.at) + (ancien.local ? ', hébergé par JARVIS depuis le ' + quand(ancien.local.depuis) : ''));
      if (opt.has('--a-blanc')) { dit('À blanc : rien n’est écrit.'); return cmp.identique ? 0 : 3; }
      if (ancien && ancien.local && !opt.has('--forcer')) { dit('Refusé : JARVIS héberge déjà Pilotage (depuis le ' + quand(ancien.local.depuis) + ') ; un nouvel import écraserait ce qui y a été écrit depuis. Pour le faire quand même : service arrêté, --forcer.'); return 1; }
      if (opt.has('--forcer') && await enMarche()) { dit('Refusé : arrête d’abord JARVIS (sudo systemctl stop jarvis), il écrirait pendant l’import.'); return 1; }
      const garde = garderAncien(); ecrireMagasin(MAG, st);
      dit('Importé : ' + st.ordre.length + ' onglets dans pilotage.json (600)' + (garde ? ' ; l’ancien est gardé (' + garde + ')' : '') + '.');
      return cmp.identique ? 0 : 3;
    }
    if (cmd === 'verifier') {
      const st = lireMag(); if (!st) { dit('Magasin absent : rien à vérifier.'); return 1; }
      const c = await lireClasseur(google()); let ecarts = 0;
      for (const n of [...new Set([...st.ordre, ...c.titres])]) {
        if (n === A_TOI) continue;
        const a = Object.hasOwn(st.onglets, n) ? pleines(grille(st, n)) : null, b = Object.hasOwn(c.onglets, n) ? pleines(c.onglets[n]) : null;
        const pareil = a !== null && b !== null && JSON.stringify(normal(grille(st, n))) === JSON.stringify(normal(c.onglets[n]));
        if (!pareil) ecarts++;
        dit('  ' + n + ' : ' + (a === null ? 'absent de JARVIS' : b === null ? 'absent du classeur' : pareil ? a + ' lignes, identique' : 'JARVIS ' + a + ' lignes, classeur ' + b + ' lignes, différent'));
      }
      const cmp = comparerAtoi(c.onglets[A_TOI], st); direAtoi(cmp);
      dit(ecarts ? ecarts + ' onglet(s) différent(s) du classeur (normal une fois que JARVIS écrit : le classeur ne bouge plus).' : 'Tous les onglets sont identiques au classeur.');
      return ecarts || !cmp.identique ? 3 : 0;
    }
    if (cmd === 'exporter') {
      const st = lireMag(); if (!st) { dit('Magasin absent : rien à exporter.'); return 1; }
      const G = google(), aBlanc = opt.has('--a-blanc');
      const liste = st.ordre.filter((n) => n !== A_TOI && (opt.has('--tout') || empreinte(st.onglets[n]) !== st.importe.empreintes[n]));
      if (!liste.length) { dit('Rien à exporter : aucun onglet n’a changé depuis l’import.'); return 0; }
      for (const nom of liste) {
        const actuel = ((await G.tool('Google Sheets', 'get_values', {spreadsheetId: PILOTAGE, range: nomPlage(nom)})) || {}).values || [];
        const rows = st.onglets[nom], h = actuel.length, w = Math.max(1, ...rows.map((r) => r.length), ...actuel.map((r) => r.length));
        const sautes = new Set(nom === 'Prix' && st.calcules.Prix ? st.calcules.Prix.lignes : []);   /* les formules du classeur restent */
        const ligne = (l) => { const r = rows[l] || [], x = []; for (let k = 0; k < w; k++) x.push(nom === 'Prix' && k === 3 && sautes.has(l + 1) ? null : texteSur(r[k] ?? '')); return x; };
        const dessus = [...Array(h)].map((_, l) => ligne(l)), apres = rows.slice(h).map((_, k) => ligne(h + k));   /* par-dessus ce que le classeur a (vidé au besoin), puis ajouté après */
        dit('  ' + nom + ' : ' + (dessus.length ? dessus.length + ' lignes réécrites' : '') + (apres.length ? (dessus.length ? ', ' : '') + apres.length + ' ajoutées' : '') + ' (' + w + ' colonnes).');
        if (aBlanc) continue;
        if (dessus.length) await G.tool('Google Sheets', 'update_values', {spreadsheetId: PILOTAGE, range: nomPlage(nom) + '!A1', values: dessus, valueInputOption: 'USER_ENTERED'});
        if (apres.length) await G.tool('Google Sheets', 'append_values', {spreadsheetId: PILOTAGE, range: nomPlage(nom) + '!A1', values: apres, valueInputOption: 'USER_ENTERED'});
      }
      dit(aBlanc ? 'À blanc : rien n’est écrit dans le classeur.' : 'Exporté : ' + liste.length + ' onglet(s) réécrit(s) dans le classeur.');
      return 0;
    }
    if (cmd === 'cle') {
      if (!terminal()) return 2;
      if (fs.existsSync(CLE) && (await question('Une phrase est déjà posée ; les copies déjà faites resteront lisibles avec l’ancienne seulement. La remplacer ? (oui/non) ')) !== 'oui') { dit('Rien n’est changé.'); return 1; }
      const p1 = await masque('Phrase de passe des copies (12 caractères au moins ; rien ne s’affiche) : '), p2 = await masque('La même, encore une fois : ');
      if (p1 !== p2) { dit('Les deux phrases diffèrent : rien n’est posé.'); return 1; }
      ecrireFichierSur(CLE, JSON.stringify(creerCle(p1)));
      dit('Phrase posée (clé tirée par scrypt, gardée sur le serveur en 600 ; la phrase n’est écrite nulle part). Range-la maintenant dans ton gestionnaire de mots de passe : sans elle, les copies de Drive sont illisibles, même pour toi.');
      return 0;
    }
    if (cmd === 'restaurer') {
      if (!opt.has('--drive') && !pos[0]) { dit('Usage : pilotage restaurer <fichier> | --drive [AAAA-MM-JJ] [--forcer]'); return 2; }
      if (!terminal()) return 2;
      let octets, quoi;
      if (opt.has('--drive')) {
        const G = google(), d = await G.drive.dossier('Sauvegardes JARVIS', RD_RACINE), l = await G.drive.lister(d.id);
        const voulu = pos[0] ? 'pilotage-' + pos[0] + '.jarvis' : l.map((f) => f.name).sort().pop(), f = l.find((x) => x.name === voulu);
        if (!f) { dit('Aucune copie ' + (pos[0] ? 'du ' + pos[0] : '') + ' dans « Sauvegardes JARVIS » (' + l.length + ' copies).'); return 1; }
        octets = await G.drive.lire(f.id); quoi = f.name;
      } else { octets = lireFichierSur(path.resolve(pos[0]), 64 * 1024 * 1024); quoi = path.basename(pos[0]); }
      const r = dechiffrer(octets, {phrase: await masque('Phrase de passe des copies : ')});
      dit('Copie ' + quoi + ' du ' + quand(r.at) + ' : ' + Object.keys(r.store.onglets).length + ' onglets, déchiffrée.');
      if (await enMarche()) { dit('Refusé : arrête d’abord JARVIS (sudo systemctl stop jarvis), il réécrirait par-dessus.'); return 1; }
      if (fs.existsSync(MAG) && !opt.has('--forcer')) { dit('Un magasin existe déjà : --forcer pour le remplacer (il sera gardé à côté).'); return 1; }
      const garde = garderAncien(); ecrireMagasin(MAG, r.store);
      dit('Restauré dans pilotage.json' + (garde ? ' ; l’ancien est gardé (' + garde + ')' : '') + '. Relance JARVIS : sudo systemctl start jarvis.');
      return 0;
    }
    if (cmd === 'copie') {
      const G = google(), st = lireMag(); if (!st) { dit('Magasin absent : rien à copier.'); return 1; }
      const r = await createCopieDrive({pl: {mode: () => 'local', instantane: () => lireMagasin(MAG)}, drive: G.drive, cleFichier: CLE, parent: RD_RACINE, S: {sauvegarde: {}}, save: () => {}, now}).envoyer();
      dit(r.ok ? 'Copie chiffrée dans Drive : ' + r.nom + ' (' + r.copies + ' gardée(s), dossier « Sauvegardes JARVIS »' + (r.racine ? ' à la racine de ton Drive' : ' dans RD Assistant') + ').' : 'Copie non envoyée : ' + r.error);
      return r.ok ? 0 : 1;
    }
    dit('Usage : node server.mjs pilotage etat | importer [--a-blanc] [--forcer] | verifier | exporter [--a-blanc] [--tout] | cle | restaurer <fichier> | --drive [AAAA-MM-JJ] [--forcer] | copie');
    return 2;
  } catch (e) { dit('Erreur : ' + String(e && e.message || e).slice(0, 300)); return 1; }
}
