/* Banc de Pilotage hébergé par JARVIS (0.88.0) : node jarvis-os/server/tests/pilotage-local.test.mjs — données inventées, aucun réseau */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto';
import {spawn} from 'node:child_process'; import {fileURLToPath} from 'node:url';
import {startFakeGoogle} from './fake-google.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), SRV = path.join(HERE, '..', 'server.mjs');
const FG = await startFakeGoogle();
process.env.JARVIS_GOOGLE_FAKE = FG.url;   /* avant d'importer google.mjs : ses adresses vers le faux Google */
const {createGoogle} = await import('../google.mjs');
const P = await import('../pilotage-local.mjs');
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info && !cond ? ' :: ' + info : '')); if (!cond) fails++; };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pilotage-')), MAG = path.join(DIR, 'pilotage.json');
const NN = ' ', NB = ' ';   /* les espaces de Google en français : fine insécable (milliers), insécable (avant €) */
const KDF = {N: 1 << 14, r: 8, p: 1};   /* rapide au banc ; la vraie commande prend 2^17 */
const lance = (fn) => { try { return {v: fn()}; } catch (e) { return {e}; } };
/* un Pilotage inventé, à la forme du vrai (en-têtes, « À toi » en ligne 3, Prix en ligne 3 avec la remise en B1) */
const ONGLETS = () => ({
  'Lisez-moi': [['Classeur inventé pour le banc']],
  'À toi': [['Ce qui attend ta réponse', '9 en attente'], ['Calculé (texte du banc)'], ['Depuis le', 'Bot', 'Sujet', "Ce qu'on attend de toi"], ['ancien', 'déversement', 'de la', 'formule']],
  Canal: [['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet'],
    ['20/11/2026', 'Iris', 'Rabie', 'Question', 'As-tu le devis du plombier ?', 'À faire', '', ''],
    ['18/11/2026', 'Kairos', 'rabie', 'Alerte', 'Prix bas sur le robot inventé', 'à faire', '', ''],
    ['19/11/2026', 'Rabie', 'Ulysse', 'Ordre', 'Mets en pause la routine inventée', 'Attend ton oui', 'Phrase : « Oui Ulysse »', ''],
    ['21/11/2026', 'Argus', 'Rabie', '', 'Ligne sans type : écartée de la liste, comptée', 'À faire', '', ''],
    ['22/11/2026', 'Rabie', 'Iris', 'Ordre', 'Déjà faite', 'Fait', 'ok', '']],
  Dossiers: [['Dossier', 'Statut', 'Prochaine étape', 'Échéance', 'En attente de', 'Dernier contact', 'Références et contexte', 'Bot', 'Mis à jour le', 'Pour Rabie'],
    ['Dégât des eaux inventé', 'En attente', 'Rappeler l’assureur inventé', '', 'Rabie', '', '', 'Iris', '17/11/2026'],
    ['Dossier clos inventé', 'Fait', 'Rien', '', 'Rabie', '', '', 'Iris', '01/11/2026'],
    ['Devis inventé', 'En attente', 'Attendre', '', 'Artisan', '', '', 'Iris', '10/11/2026']],
  Prix: [["Remise qui déclenche l'alerte Bon prix", '10%'], [], ['Produit', 'Prix de référence (€)', 'Seuil Achat (€)', 'Seuil Bon prix (€)', 'Autre', 'Vendeurs', 'Remarque', 'Dernier prix TTC (€)', 'Relevé le', 'Où (vendeur et lien)', 'Statut'],
    ['Robot inventé', '1' + NN + '599,00' + NB + '€', '1' + NN + '598,99' + NB + '€', '1' + NN + '439,10' + NB + '€', '', 'Vendeur', '', '1599', '25/11/2026', 'Vendeur — https://vendeur.example/p/1', 'Suivi'],
    ['Lampe inventée', '129,99' + NB + '€', '99,00' + NB + '€', '116,99' + NB + '€', '', '', '', '', '', '', 'Suivi'],
    ['Jeu inventé', '79,99' + NB + '€', '67,99' + NB + '€', '71,99' + NB + '€', 'Saisi à la main', '', '', '', '', '', 'Plus suivi']],
  Journal: [['Date et heure', 'Bot', 'Type', 'Sujet', 'Détail'], ['25/11/2026 08:10', 'Iris', 'ETAT', 'Passage', 'Rien de neuf']],
  'Tâches': [['Ajoutée le', 'Tâche', 'Pour le', 'Statut', 'Remarque'], ['24/11/2026', 'Appeler le garage inventé', '', 'À faire', '']],
  Faits: [['Domaine', 'Fait', 'Valeur'], ['Grok Bot', "Grok en pause jusqu'au", '']],
  'Échéances': [['Date', 'Sujet', 'Domaine', 'Rappels', 'Statut', 'Bot', 'Remarque', 'Nature']]
});
const FORMULES = {Prix: [['D4', '=IF(B4="";"";ROUND(B4*(1-$B$1);2))'], ['D5', '=IF(B5="";"";ROUND(B5*(1-$B$1);2))']], 'À toi': [['B1', '=COUNTIFS(…)'], ['A4', '=LET(…)']], Journal: [['F2', '=NOW()']]};
try {
  /* ---------- plages A1 ---------- */
  const pl = (r) => { const x = P.lirePlage(r); return [x.nom, x.c1, x.l1, x.c2, x.l2].join(','); };
  ok('A1 : apostrophes (doublées), plage fermée, ouverte, colonne seule, case seule, onglet entier, lignes seules, ordre inversé',
    pl("'À toi'!A3:D300") === 'À toi,0,3,3,300' && pl("'L''onglet'!B2") === "L'onglet,1,2,1,2" && pl('Journal!A1:H') === 'Journal,0,1,7,Infinity' && pl('Canal!A:A') === 'Canal,0,1,0,Infinity'
    && pl('Faits') === 'Faits,0,1,Infinity,Infinity' && pl("'Échéances'") === 'Échéances,0,1,Infinity,Infinity' && pl('Canal!3:5') === 'Canal,0,3,Infinity,5' && pl('Canal!C5:A2') === 'Canal,0,2,2,5' && pl('Canal!aa10') === 'Canal,26,10,26,10',
    [pl("'À toi'!A3:D300"), pl('Journal!A1:H'), pl('Canal!3:5')].join(' / '));
  ok('A1 : plages illisibles refusées (apostrophe ouverte, « A » seul, « 5 » seul, vide)', ['\'Canal!A1', 'Canal!A', 'Canal!5', '', 'Canal!A1:'].every((r) => lance(() => P.lirePlage(r)).e instanceof P.PilotageErreur));
  ok('nom d’onglet dit comme Google : entre apostrophes dès qu’il a un accent, une espace ou une apostrophe', P.nomPlage('Canal') === 'Canal' && P.nomPlage('À toi') === "'À toi'" && P.nomPlage("L'x") === "'L''x'" && P.nomPlage('Options voyage') === "'Options voyage'");

  /* ---------- le magasin construit à l'import ---------- */
  const st0 = P.construireMagasin({onglets: ONGLETS(), ordre: Object.keys(ONGLETS()), formules: FORMULES, source: 'banc', at: 1000});
  ok('import : « À toi » ne garde que ses trois lignes fixes ; Prix D4 et D5 reconnues comme formules refaites, les autres formules gardées en valeur ; comptes et empreintes',
    st0.onglets['À toi'].length === 3 && JSON.stringify(st0.calcules.Prix) === JSON.stringify({colonne: 'D', lignes: [4, 5], jusqua: 6}) && st0.importe.figees.join() === 'Journal!F2' && st0.importe.comptes.Canal === 6 && st0.importe.comptes.Prix === 5 && /^[0-9a-f]{16}$/.test(st0.importe.empreintes.Canal),
    JSON.stringify([st0.calcules, st0.importe.figees, st0.importe.comptes]));
  /* « À toi » à la main, d'après la formule du classeur */
  const atoi = P.construireAtoi(st0);
  const attendu = [['Ce qui attend ta réponse', '5 en attente'], ['Calculé (texte du banc)'], ['Depuis le', 'Bot', 'Sujet', "Ce qu'on attend de toi"],
    ['17/11/2026', 'Iris', 'Dégât des eaux inventé', 'Rappeler l’assureur inventé'], ['18/11/2026', 'Kairos', 'Alerte', 'Prix bas sur le robot inventé'],
    ['19/11/2026', 'Ulysse', 'Ordre', 'Ton oui dans le chat de Ulysse : Phrase : « Oui Ulysse »'], ['20/11/2026', 'Iris', 'Question', 'As-tu le devis du plombier ?']];
  ok('« À toi » : Canal (Rabie, « À faire » sans la casse), Dossiers (« Rabie » en attente, pas Fait), « Attend ton oui » (le bot, sa phrase) ; ligne sans type écartée mais comptée ; trié par date ; compte comme B1',
    JSON.stringify(atoi) === JSON.stringify(attendu), JSON.stringify(atoi));
  const vide0 = P.construireAtoi({onglets: {Canal: [['Date']], Dossiers: [['Dossier']], 'À toi': []}});
  ok('« À toi » : rien en attente → « Rien ne t’attend. », textes fixes par défaut', vide0[3][0] === "Rien ne t'attend." && vide0[0][1] === '0 en attente' && vide0[2][3] === "Ce qu'on attend de toi" && vide0.length === 4, JSON.stringify(vide0));
  ok('nombres à la française : « 1 599,00 € », « 10% », « 0,1 » lus ; « abc » non', P.nombre('1' + NN + '599,00' + NB + '€') === 1599 && P.nombre('10%') === 0.1 && P.nombre('0,1') === 0.1 && P.nombre('abc') === null);

  /* ---------- l'outil, sur le fichier ---------- */
  P.ecrireMagasin(MAG, st0); fs.chmodSync(MAG, 0o644);
  let PL = P.createPilotageLocal({fichier: MAG, now: () => 5000});
  const e0 = PL.demarrer(true, null);
  const T = (name, input) => lance(() => PL.tool(name, {spreadsheetId: 'PIL', ...input}));
  ok('démarrage : mode local, la date de début notée dans le magasin (réécrit en 600), comptes par onglet', e0.mode === 'local' && e0.depuis === 5000 && P.lireMagasin(MAG).local.depuis === 5000 && (fs.statSync(MAG).mode & 0o777) === 0o600 && e0.onglets.Canal === 6, JSON.stringify(e0));
  let r = T('get_values', {range: "'À toi'!A3:D300"});
  ok('get_values « À toi » A3:D300 : calculé (en-têtes puis lignes), la plage dite comme Google', !r.e && JSON.stringify(r.v.values) === JSON.stringify(attendu.slice(2)) && r.v.range === "'À toi'!A3:D300" && r.v.majorDimension === 'ROWS', JSON.stringify(r.e ? r.e.message : r.v));
  r = T('get_values', {range: 'Prix!A3:M300'});
  ok('Prix : colonne D refaite (1 599,00 € − 10 % = 1 439,10 €, mêmes espaces), D6 saisie à la main gardée', !r.e && r.v.values[1][3] === '1' + NN + '439,10' + NB + '€' && r.v.values[2][3] === '116,99' + NB + '€' && r.v.values[3][3] === '71,99' + NB + '€' && r.v.values[1][0] === 'Robot inventé', JSON.stringify(r.v && r.v.values.map((x) => x[3])));
  r = T('get_values', {range: 'Prix!A1:C2'});
  ok('get_values : une ligne vide au milieu rendue [], cases vides de fin coupées', !r.e && JSON.stringify(r.v.values) === JSON.stringify([["Remise qui déclenche l'alerte Bon prix", '10%']]), JSON.stringify(r.v));
  r = T('get_values', {range: 'canal!A:A'});
  ok('get_values : onglet sans la casse, colonne entière (plage ouverte dite jusqu’à la dernière ligne)', !r.e && r.v.values.length === 6 && r.v.values[0][0] === 'Date' && r.v.range === 'Canal!A1:A6', JSON.stringify(r.v));
  r = T('get_values', {range: "'Échéances'!A1:H1000"});
  ok('get_values : nom accentué rendu entre apostrophes', !r.e && r.v.range === "'Échéances'!A1:H1000" && r.v.values.length === 1);
  /* écritures */
  const avant = fs.readFileSync(MAG, 'utf8');
  r = T('append_values', {range: 'Canal!A1', values: [['26/11/2026', 'Hermes', 'Iris', 'Question', '=IMPORTXML("https://piege.example";"//a")', 'À faire', '', '']], valueInputOption: 'RAW'});
  const can = P.lireMagasin(MAG).onglets.Canal;
  ok('append_values : après la dernière ligne, « =… » gardé en texte (jamais une formule), updatedRange au format de Google, fichier réécrit', !r.e && r.v.updates.updatedRange === 'Canal!A7:H7' && r.v.updates.updatedRows === 1 && can.length === 7 && can[6][4] === '=IMPORTXML("https://piege.example";"//a")', JSON.stringify(r.e ? r.e.message : r.v));
  r = T('append_values', {range: "'Tâches'!A1", values: [['26/11/2026', "'=2+2", '', 'À faire', 'De Invité']]});
  const tac = P.lireMagasin(MAG).onglets['Tâches'];
  ok('append_values USER_ENTERED : l’apostrophe de tête (forcer le texte chez Google) est retirée, le texte reste « =2+2 »', !r.e && tac[2][1] === '=2+2' && r.v.updates.updatedRange === "'Tâches'!A3:E3", JSON.stringify([r.v, tac[2]]));
  r = T('update_values', {range: "'Tâches'!D3", values: [['Fait']], valueInputOption: 'RAW'});
  ok('update_values : une case', !r.e && P.lireMagasin(MAG).onglets['Tâches'][2][3] === 'Fait' && r.v.updatedCells === 1 && r.v.updatedRange === "'Tâches'!D3:D3");
  r = T('update_values', {range: 'Prix!H4:J4', values: [[349.9, '26/11/2026', null]], valueInputOption: 'RAW'});
  const px = P.lireMagasin(MAG).onglets.Prix[3];
  ok('update_values : un nombre écrit à la française (349,9) ; null laisse la case telle quelle', !r.e && px[7] === '349,9' && px[8] === '26/11/2026' && px[9] === 'Vendeur — https://vendeur.example/p/1' && r.v.updatedCells === 2, JSON.stringify(px));
  r = T('update_values', {range: 'Prix!D5', values: [['100,00 €']], valueInputOption: 'RAW'});
  const pd = T('get_values', {range: 'Prix!D4:D5'}).v.values;
  ok('écrire sur une case calculée de Prix remplace la formule (comme chez Google) : D5 gardée telle quelle, D4 toujours calculée', !r.e && pd[1][0] === '100,00 €' && pd[0][0] === '1' + NN + '439,10' + NB + '€' && P.lireMagasin(MAG).calcules.Prix.lignes.join() === '4', JSON.stringify(pd));
  const f0 = fs.readFileSync(MAG, 'utf8');
  const refus = [T('update_values', {range: "'À toi'!A4", values: [['x']]}), T('get_values', {range: 'Inconnu!A1'}), T('append_values', {range: 'Canal!A1', values: [['x'.repeat(50001)]]}),
    T('update_values', {range: 'Canal!A2:B2', values: [['a', 'b', 'c']]}), T('update_values', {range: 'Canal!A2', values: [[{objet: 1}]]}), T('append_values', {range: 'Canal!A1', values: 'pas un tableau'}), T('delete_values', {range: 'Canal!A1'}),
    T('update_values', {range: 'Canal!A2', values: [['a', ...Array(60).fill('x')]]})];
  ok('refusés sans rien écrire : « À toi » (calculé), un onglet inconnu, une case de plus de 50 000 caractères, des valeurs plus larges que la plage, un objet, des valeurs illisibles, un outil inconnu, au-delà de la colonne AZ',
    refus.every((x) => x.e instanceof P.PilotageErreur) && /calculé/.test(refus[0].e.message) && /Onglet inconnu/.test(refus[1].e.message) && refus[6].e.code === 'not_in_manifest' && fs.readFileSync(MAG, 'utf8') === f0, refus.map((x) => x.e && x.e.message).join(' | '));
  /* relu par une autre instance (redémarrage) */
  const PL2 = P.createPilotageLocal({fichier: MAG, now: () => 9000}); const e2 = PL2.demarrer(true, {depuis: 5000});
  ok('redémarrage : tout est relu, la date de début gardée', e2.mode === 'local' && e2.depuis === 5000 && PL2.tool('get_values', {range: 'Canal!E7'}).values[0][0].startsWith('=IMPORTXML') && e2.onglets.Canal === 7);
  ok('l’instantané est une copie (le modifier ne touche pas au magasin)', (() => { const x = PL2.instantane(); x.onglets.Canal[0][0] = 'changé'; return PL2.tool('get_values', {range: 'Canal!A1'}).values[0][0] === 'Date'; })());
  /* lien, absence, fichier abîmé */
  const LIEN = path.join(DIR, 'lien.json'); fs.symlinkSync(MAG, LIEN);
  const PLl = P.createPilotageLocal({fichier: LIEN}), el = PLl.demarrer(true, {depuis: 1}), tl = lance(() => PLl.tool('get_values', {range: 'Canal!A1'}));
  ok('pilotage.json en lien : jamais suivi ; plus rien n’est lu ni écrit (503)', el.mode === 'erreur' && /lien/.test(el.probleme) && PLl.actif() && tl.e && tl.e.status === 503, JSON.stringify(el));
  const ABS = path.join(DIR, 'absent.json'), PLa = P.createPilotageLocal({fichier: ABS}), ea = PLa.demarrer(true, null), PLb = P.createPilotageLocal({fichier: ABS}), eb = PLb.demarrer(true, {depuis: 1});
  ok('pas encore importé : Google en attendant (avertissement) ; disparu après avoir servi : erreur, pas de retour muet vers Google', ea.mode === 'google' && !PLa.actif() && /pas encore importé/.test(ea.avertissement) && eb.mode === 'erreur' && PLb.actif() && /disparu/.test(eb.probleme), JSON.stringify([ea, eb]));
  const BAD = path.join(DIR, 'abime.json'); fs.writeFileSync(BAD, '{"format":"jarvis-pilotage","v":1,"onglets":', {mode: 0o600});
  const PLc = P.createPilotageLocal({fichier: BAD}), ec = PLc.demarrer(true, null);
  ok('pilotage.json abîmé : erreur, le fichier n’est pas touché', ec.mode === 'erreur' && /abîmé/.test(ec.probleme) && fs.readFileSync(BAD, 'utf8').endsWith('"onglets":'), JSON.stringify(ec));
  const PLg = P.createPilotageLocal({fichier: MAG}), eg = PLg.demarrer(false, {depuis: 5000});
  ok('sans JARVIS_PILOTAGE=local : rien ne change (mode Google)', eg.mode === 'google' && !PLg.actif());

  /* ---------- clé et copies chiffrées ---------- */
  const phrase = 'une phrase inventée pour le banc', CLE = path.join(DIR, 'pilotage-cle.json');
  const kc = P.creerCle(phrase, KDF); P.ecrireFichierSur(CLE, JSON.stringify(kc));
  const k = P.lireCle(CLE), snap = PL2.instantane(), chif = P.chiffrer(snap, k, 1234), txt = chif.toString('utf8');
  ok('clé : tirée par scrypt (sel de 16 octets), 600, la phrase écrite nulle part ; trop courte refusée', (fs.statSync(CLE).mode & 0o777) === 0o600 && !fs.readFileSync(CLE, 'utf8').includes(phrase) && k.cle.length === 32 && lance(() => P.creerCle('courte', KDF)).e && Buffer.from(kc.kdf.sel, 'base64').length === 16);
  const d1 = P.dechiffrer(chif, {phrase}), d2 = P.dechiffrer(chif, {cle: k.cle});
  ok('copie chiffrée : rien de lisible dedans (ni texte du Canal, ni nom d’onglet) ; relue avec la phrase et avec la clé', !txt.includes('IMPORTXML') && !txt.includes('Canal') && !txt.includes('plombier') && d1.at === 1234 && JSON.stringify(d1.store.onglets) === JSON.stringify(snap.onglets) && JSON.stringify(d2.store.onglets) === JSON.stringify(snap.onglets));
  const j = JSON.parse(txt), retouche = (f) => { const x = JSON.parse(txt); f(x); return Buffer.from(JSON.stringify(x)); };
  const faux = [lance(() => P.dechiffrer(chif, {phrase: 'une autre phrase inventée'})), lance(() => P.dechiffrer(retouche((x) => { const b = Buffer.from(x.donnees, 'base64'); b[5] ^= 1; x.donnees = b.toString('base64'); }), {phrase})),
    lance(() => P.dechiffrer(retouche((x) => { x.at = 99; }), {phrase})), lance(() => P.dechiffrer(retouche((x) => { x.kdf = {...x.kdf, N: 1 << 24}; }), {phrase})), lance(() => P.dechiffrer(Buffer.from('pas une copie'), {phrase}))];
  ok('refusés : phrase fausse, données retouchées, en-tête retouché (date), paramètres de clé démesurés (2^24), fichier quelconque', faux.every((x) => x.e instanceof P.PilotageErreur) && faux[0].e.code === 'phrase_fausse' && faux[1].e.code === 'phrase_fausse' && faux[2].e.code === 'phrase_fausse' && /pas une copie/.test(faux[3].e.message) && /pas une copie/.test(faux[4].e.message), faux.map((x) => x.e && x.e.code).join());
  ok('format de la copie : AES-256-GCM (iv 12 octets, étiquette 16), scrypt et sel dans l’en-tête', j.format === 'jarvis-pilotage-chiffre' && Buffer.from(j.iv, 'base64').length === 12 && Buffer.from(j.tag, 'base64').length === 16 && j.kdf.algo === 'scrypt' && j.kdf.N === KDF.N);

  /* ---------- la copie de la nuit dans Drive (faux Google) ---------- */
  const SG = {google: {clientId: FG.client.id, clientSecret: FG.client.secret, refresh: 'RT1', account: 'proprietaire@example.org'}};
  const G = createGoogle({S: SG, save: () => {}});
  const S1 = {}, J0 = Date.parse('2026-11-26T02:05:00Z');
  const C = P.createCopieDrive({pl: PL2, drive: G.drive, cleFichier: path.join(DIR, 'sans-cle.json'), parent: 'rda', S: S1, save: () => {}, now: () => J0});
  let c = await C.envoyer();
  ok('copie Drive sans phrase posée : rien ne part, la santé dit quoi faire dans Termius', !c.ok && c.code === 'sans_cle' && FG.sav.length === 0 && /phrase de passe à poser/.test(C.sante().detail) && /pilotage cle/.test(C.sante().detail), JSON.stringify([c, C.sante()]));
  FG.refusDriveFile = true;
  const C2 = P.createCopieDrive({pl: PL2, drive: G.drive, cleFichier: CLE, parent: 'rda', S: S1, save: () => {}, now: () => J0});
  c = await C2.envoyer();
  ok('drive.file pas accordée (Google refuse) : « à relier », Réglages, Google, Reconnecter ; rien de créé', !c.ok && c.code === 'portee' && /Reconnecter/.test(c.error) && FG.sav.length === 0 && /à relier/.test(C2.sante().detail), JSON.stringify([c, C2.sante()]));
  FG.refusDriveFile = false;
  c = await C2.envoyer();
  const dos = FG.sav.find((f) => f.mimeType === 'application/vnd.google-apps.folder'), cop = FG.sav.find((f) => f.name === 'pilotage-2026-11-26.jarvis');
  ok('copie Drive : dossier « Sauvegardes JARVIS » créé sous RD Assistant (marqué jarvis), copie du jour envoyée (multipart, marquée), relisible avec la phrase ; la santé dit « à jour »',
    c.ok && !c.racine && dos && dos.name === 'Sauvegardes JARVIS' && dos.parents[0] === 'rda' && dos.appProperties.jarvis === 'sauvegardes' && cop && cop.parents[0] === dos.id && cop.appProperties.jarvis === 'pilotage' && /^multipart\/related; boundary=/.test(cop.type)
    && JSON.stringify(P.dechiffrer(cop.octets, {phrase}).store.onglets) === JSON.stringify(PL2.instantane().onglets) && C2.sante().ok && /à jour/.test(C2.sante().detail), JSON.stringify([c, FG.sav.map((f) => f.name)]));
  const n1 = FG.sav.length; c = await C2.envoyer();
  ok('copie Drive : une seule par jour (relancée, rien de neuf)', c.ok && FG.sav.length === n1);
  for (let d = 1; d <= 31; d++) FG.sav.push({id: 'old' + d + 'x', name: 'pilotage-2026-10-' + String(d).padStart(2, '0') + '.jarvis', parents: [dos.id], appProperties: {jarvis: 'pilotage'}, createdTime: '', octets: Buffer.from('x')});
  c = await P.createCopieDrive({pl: PL2, drive: G.drive, cleFichier: CLE, parent: 'rda', S: S1, save: () => {}, now: () => J0 + 864e5}).envoyer();
  const gardees = FG.sav.filter((f) => f.appProperties && f.appProperties.jarvis === 'pilotage' && !f.trashed).map((f) => f.name).sort();
  ok('copie Drive : 30 copies gardées, les plus anciennes mises à la corbeille (jamais effacées d’un coup)', c.ok && gardees.length === 30 && gardees[29] === 'pilotage-2026-11-27.jarvis' && gardees[0] === 'pilotage-2026-10-04.jarvis' && FG.sav.filter((f) => f.trashed).length === 3 && !FG.calls.some((x) => x.method === 'DELETE' && /\/drive\//.test(x.path)), gardees.slice(0, 3).join());
  /* dossier hors de portée : à la racine ; portée vue au renouvellement du jeton */
  const F2 = {}; FG.sav = []; FG.refusParent = true;
  c = await P.createCopieDrive({pl: PL2, drive: G.drive, cleFichier: CLE, parent: 'rda', S: F2, save: () => {}, now: () => J0}).envoyer();
  ok('RD Assistant hors de portée de drive.file : le dossier des copies est créé à la racine de son Drive (et la santé le dit)', c.ok && c.racine && FG.sav.find((f) => f.name === 'Sauvegardes JARVIS').parents[0] === 'root', JSON.stringify(c));
  FG.refusParent = false;
  ok('portée drive.file : « inconnue » pour un lien d’avant la 0.88.0', G.drive.portee() === 'inconnue' && G.status('').driveCopies === 'inconnue');
  FG.scopeRefresh = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly'; FG.valid.clear();
  const SG2 = {google: {...SG.google}}, G2 = createGoogle({S: SG2, save: () => {}}); await G2.tool('Google Calendar', 'list_calendars', {});
  const C3 = P.createCopieDrive({pl: PL2, drive: G2.drive, cleFichier: CLE, parent: 'rda', S: {}, save: () => {}, now: () => J0}); c = await C3.envoyer();
  ok('portée redite par Google au renouvellement du jeton : sans drive.file, « à relier » sans rien tenter ; tout le reste marche', G2.drive.portee() === 'non' && !c.ok && c.code === 'portee' && /à relier/.test(C3.sante().detail), JSON.stringify([G2.drive.portee(), c]));
  FG.scopeRefresh = FG.scopeRefresh + ' ' + 'https://www.googleapis.com/auth/drive.file'; FG.valid.clear(); await G2.tool('Google Calendar', 'list_calendars', {});
  ok('portée accordée ensuite : vue au renouvellement suivant', G2.drive.portee() === 'oui');
  const lk = G.link('https://serveur.example/api/google/callback'), sc = new URL(lk.url).searchParams.get('scope').split(' ');
  ok('« Connecter Google » demande aussi drive.file, sans la compter parmi les droits obligatoires', sc.includes('https://www.googleapis.com/auth/drive.file') && sc.includes('https://www.googleapis.com/auth/spreadsheets') && (await import('../google.mjs')).SCOPES.every((s) => !/drive\.file/.test(s)));
  FG.scopeRefresh = '';

  /* ---------- la commande du serveur : node server.mjs pilotage … ---------- */
  const D = fs.mkdtempSync(path.join(os.tmpdir(), 'pilotage-cli-')), MC = path.join(D, 'pilotage.json');
  fs.writeFileSync(path.join(D, 'state.json'), JSON.stringify({google: {clientId: FG.client.id, clientSecret: FG.client.secret, refresh: 'RT1', account: 'proprietaire@example.org'}}), {mode: 0o600});
  const etat0 = fs.readFileSync(path.join(D, 'state.json'), 'utf8');
  FG.onglets = ONGLETS(); FG.formules = FORMULES;
  FG.onglets['À toi'] = P.construireAtoi(P.construireMagasin({onglets: ONGLETS(), formules: FORMULES}));   /* le classeur affiche le résultat de sa formule */
  const env = {...process.env, JARVIS_DATA: D, JARVIS_GOOGLE_FAKE: FG.url, JARVIS_PILOTAGE_ID: 'PIL', JARVIS_RD_RACINE: 'rda', PORT: String(19500 + Math.floor(Math.random() * 400))};
  /* lancée à part, sans bloquer ce processus : le faux Google y répond */
  const cli = (...a) => new Promise((z) => { const ch = spawn(process.execPath, [SRV, 'pilotage', ...a], {env, stdio: ['ignore', 'pipe', 'pipe']}); let out = ''; ch.stdout.on('data', (d) => { out += d; }); ch.stderr.on('data', (d) => { out += d; });
    const t = setTimeout(() => ch.kill('SIGKILL'), 30000); ch.on('close', (code) => { clearTimeout(t); z({code, out}); }); });
  let x = await cli('importer', '--a-blanc');
  ok('importer --a-blanc : chaque onglet compté, formules dites, « À toi » identique au classeur, rien d’écrit', x.code === 0 && /Classeur lu : 9 onglets/.test(x.out) && /Canal : 6 lignes/.test(x.out) && /Prix colonne D \(2 cases\)/.test(x.out) && /Gardées en valeur : Journal!F2\./.test(x.out) && /identique au classeur/.test(x.out) && /« Grok Bot arrêté le » : absente\./.test(x.out) && /À blanc/.test(x.out) && !fs.existsSync(MC), x.out);
  ok('rien du contenu des cases n’est affiché', !/plombier|inventé|piege/.test(x.out), x.out);
  x = await cli('importer');
  ok('importer : pilotage.json écrit (600) ; state.json jamais réécrit', x.code === 0 && /Importé : 9 onglets/.test(x.out) && (fs.statSync(MC).mode & 0o777) === 0o600 && P.lireMagasin(MC).onglets.Canal.length === 6 && fs.readFileSync(path.join(D, 'state.json'), 'utf8') === etat0, x.out);
  x = await cli('verifier');
  ok('verifier : tous les onglets identiques au classeur, « À toi » aussi', x.code === 0 && /Tous les onglets sont identiques/.test(x.out) && /identique au classeur/.test(x.out), x.out);
  /* JARVIS l'a servi et y a écrit : nouvel import refusé, export des seuls onglets changés */
  const PLd = P.createPilotageLocal({fichier: MC, now: () => 7000}); PLd.demarrer(true, null);
  PLd.tool('append_values', {range: 'Canal!A1', values: [['26/11/2026', 'Hermes', 'Rabie', 'Question', '-Une ligne qui commence par un tiret', 'À faire', '', '']], valueInputOption: 'RAW'});
  PLd.tool('update_values', {range: 'Prix!H5', values: [['110']], valueInputOption: 'RAW'});
  x = await cli('importer');
  ok('importer après que JARVIS a servi : refusé (il écraserait ses écritures)', x.code === 1 && /déjà Pilotage/.test(x.out) && P.lireMagasin(MC).onglets.Canal.length === 7, x.out);
  x = await cli('verifier');
  ok('verifier : les onglets écrits par JARVIS dits différents, « À toi » aussi (une ligne de plus)', x.code === 3 && /Canal : JARVIS 7 lignes, classeur 6 lignes, différent/.test(x.out) && /DIFFÉRENT du classeur/.test(x.out) && /Journal : 2 lignes, identique/.test(x.out), x.out);
  const nPut = FG.calls.filter((y) => y.method === 'PUT').length;
  x = await cli('exporter', '--a-blanc');
  ok('exporter --a-blanc : seuls Canal et Prix (changés depuis l’import), rien d’écrit', x.code === 0 && /Canal : 6 lignes réécrites, 1 ajoutées/.test(x.out) && /Prix : /.test(x.out) && !/Journal :/.test(x.out) && FG.calls.filter((y) => y.method === 'PUT').length === nPut, x.out);
  x = await cli('exporter');
  const puts = FG.calls.filter((y) => y.method === 'PUT').slice(nPut), putPrix = puts.find((y) => /Prix/.test(y.path)), app = FG.calls.filter((y) => /:append$/.test(y.path)).pop();
  ok('exporter : réécrit en saisie normale, un texte qui commence par « - » ou « = » protégé par une apostrophe, les cases à formule de Prix laissées (null), la ligne neuve ajoutée',
    x.code === 0 && puts.length === 2 && putPrix.q.valueInputOption === 'USER_ENTERED' && putPrix.body.values[3][3] === null && putPrix.body.values[4][3] === null && putPrix.body.values[5][3] === '71,99' + NB + '€' && putPrix.body.values[4][7] === '110'
    && app.body.values[0][4] === "'-Une ligne qui commence par un tiret" && FG.onglets.Canal.length === 7, x.out + JSON.stringify(putPrix && putPrix.body.values.map((r) => r[3])));
  x = await cli('cle');
  const xr = await cli('restaurer', '--drive');
  ok('cle et restaurer : refusés hors d’un vrai terminal (la phrase ne passe jamais par un tube ni par une autre session)', x.code === 2 && /Termius/.test(x.out) && !fs.existsSync(path.join(D, 'pilotage-cle.json')) && xr.code === 2 && /Termius/.test(xr.out), x.out + xr.out);
  P.ecrireFichierSur(path.join(D, 'pilotage-cle.json'), JSON.stringify(P.creerCle(phrase, KDF)));
  FG.sav = []; x = await cli('copie');
  const cc = FG.sav.find((f) => /^pilotage-\d{4}-\d{2}-\d{2}\.jarvis$/.test(f.name));
  ok('copie : la copie chiffrée du jour envoyée tout de suite dans Drive, relisible avec la phrase', x.code === 0 && /Copie chiffrée dans Drive : pilotage-/.test(x.out) && cc && P.dechiffrer(cc.octets, {phrase}).store.onglets.Canal.length === 7, x.out);
  x = await cli('etat');
  ok('etat : magasin, date de service, onglets changés, phrase posée, Google et la portée des copies', x.code === 0 && /hébergé par JARVIS depuis le/.test(x.out) && /Canal : 7 lignes, changé depuis l’import/.test(x.out) && /À toi : \d+ lignes \(calculé\)/.test(x.out) && /Phrase des copies chiffrées : posée/.test(x.out) && /Google : relié/.test(x.out), x.out);
  x = await cli('inconnu');
  ok('commande inconnue : mode d’emploi (code 2)', x.code === 2 && /Usage/.test(x.out));
  fs.rmSync(D, {recursive: true, force: true});
} catch (e) { ok('exception', false, (e && e.stack) || String(e)); }
FG.close(); fs.rmSync(DIR, {recursive: true, force: true});
console.log(results.join('\n'));
console.log((fails ? 'ÉCHECS : ' + fails : 'Tout est bon') + ' (' + results.length + ' vérifications)');
process.exit(fails ? 1 : 0);
