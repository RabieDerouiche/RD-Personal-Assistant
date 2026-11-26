/* Banc de l'espace « Travail » (0.85.0) : node jarvis-os/server/tests/travail.test.mjs — données inventées */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {createTravail} from '../travail.mjs';
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'travail-')), RET = path.join(DIR, 'retours'); fs.mkdirSync(RET);
try {
  const T = Date.parse('2026-11-26T09:00:00Z');   /* jeudi 26, 10 h à Paris */
  const bilan = {totaux: {travailles: 15, teletravail: 8, surSite: 5, aVenir: 2, conges: 5, feries: 1, aConfirmer: 0}};
  const jours = {etat: () => ({mois: '2026-11', etat: 'valide', demande: false, bilan, valide: {at: Date.parse('2026-11-24T11:05:00Z')}}),
    etatSemaine: (l) => (l === '2026-11-23' ? {lundi: l, etat: 'a_valider', demande: false, jours: []} : l === '2026-11-16' ? {lundi: l, etat: 'soumise', retour: {resultat: 'soumise', at: Date.parse('2026-11-20T11:20:00Z'), premiere: true}} : null),
    brut: () => ({semaines: {'2026-11-16': {}, '2026-11-23': {}}, teletravail: {'2026-10': {resultat: 'blanc', jours: 9, texte: 'Note préparée.', at: Date.parse('2026-10-30T11:30:00Z')}},
      /* 0.86.0 : les notes d'Hermes posées par root (montants inventés) */
      notes: NOTES_BANC})};
  const NOTES_BANC = {'box:2026-11': {sorte: 'box', mois: '2026-11', etat: 'a_valider', montant: 39, empreinte: 'abcdef0123456789', champs: [['Vendeur', 'Fournisseur inventé']], texte: 'Préparée.', at: Date.parse('2026-11-15T09:30:00Z')},
    'claude:2026-10': {sorte: 'claude', mois: '2026-10', etat: 'creee', montant: 90, empreinte: '0123456789abcdef', oui: {empreinte: '0123456789abcdef', at: 1}, champs: [], texte: 'Créée.', at: Date.parse('2026-10-21T09:30:00Z')},
    'claude:2026-11': {sorte: 'claude', mois: '2026-11', etat: 'creee', montant: 90, empreinte: 'fedcba9876543210', champs: [], texte: 'Créée.', at: Date.parse('2026-11-21T09:30:00Z')}};
  const appels = {gmail: [], journal: 0};
  const gmail = async (q) => { appels.gmail.push(q);
    if (/in:sent subject:"CRA Novembre 2026"/.test(q)) return {threads: [{id: 't1', messages: [{subject: 'CRA Novembre 2026', internalDate: String(Date.parse('2026-11-26T08:00:00Z'))}]}]};
    if (/^from:\(contact@exemple\.invalid\) has:attachment/.test(q)) return {threads: [{id: 't2', messages: [{subject: 'Re: CRA Novembre 2026', internalDate: String(Date.parse('2026-11-26T08:40:00Z'))}]}]};
    if (/in:sent subject:"Prolongation mission"/.test(q)) return {threads: [{id: 't3', messages: [{subject: 'Prolongation mission (inventé)', internalDate: String(Date.parse('2026-11-26T08:01:00Z'))}]}]};
    return {}; };
  const journal = async () => { appels.journal++; return [
    {bot: 'Chronos', ymd: '2026-11-21', at: Date.parse('2026-11-21T09:10:00Z'), sujet: 'Note de frais Claude', detail: 'Dépense créée, conforme.'},
    {bot: 'Chronos', ymd: '2026-11-15', at: Date.parse('2026-11-15T09:10:00Z'), sujet: 'Note de frais box internet', detail: 'Créée.'},
    {bot: 'Iris', ymd: '2026-11-25', at: Date.parse('2026-11-25T09:10:00Z'), sujet: 'Note de frais Claude', detail: 'pas Chronos'},
    {bot: 'Chronos', ymd: '2026-11-01', at: Date.parse('2026-11-01T08:10:00Z'), sujet: 'Télétravail octobre', detail: 'Échec : facture manquante.'}]; };
  const file = path.join(DIR, 'travail.json');
  fs.writeFileSync(file, JSON.stringify({mails: {cra_client: {a: ['contact@exemple.invalid'], objet: 'CRA {MOIS} {ANNEE}', corps: '…'}}}));
  const TR = createTravail({file, jours, retours: RET, gmail, journal, now: () => T});
  let e = await TR.etat();
  const r = (id) => e.routines.find((x) => x.id === id);
  ok('routines : jours, semaine, mois et quatre notes, titres précis par défaut sans nom de client', ['jours', 'semaine', 'mois', 'claude', 'box', 'teletravail', 'grok'].every((id) => r(id)) && r('claude').titre === 'Abonnement Claude' && r('jours').titre === 'Jours de novembre', e.routines.map((x) => x.titre).join(' | '));
  ok('jours : congés validés, lieux à venir, chiffres du bilan', r('jours').etapes[1][1] === 'fait' && r('jours').etapes[2][1] === 'encours' && r('jours').prevu.puces.some((p) => p[0] === '2 lieux à venir') && r('jours').derniere.par === 'toi', JSON.stringify(r('jours').etapes));
  ok('semaine : bilan vendredi à venir, prochaine « ven. 27/11 · 12 h », dernière exécution = la semaine d’avant soumise par Hermes', r('semaine').prochaine === 'ven. 27/11 · 12 h' && r('semaine').etapes[0][1] === '' && r('semaine').derniere.par === 'Hermes' && r('semaine').derniere.quoi === 'soumise', JSON.stringify([r('semaine').prochaine, r('semaine').derniere]));
  ok('mois sans compte rendu d’Hermes : mail au client envoyé (Gmail), CRA du client reçu, rattachement à faire (« À toi »)', r('mois').etapes[1][1] === 'fait' && r('mois').etapes[2][1] === '' && r('mois').etapes[3][1] === 'fait' && /rattacher/.test(r('mois').toi) && r('mois').mails.length === 2, JSON.stringify(r('mois').etapes));
  fs.writeFileSync(path.join(RET, 'mois-2026-11.json'), JSON.stringify({resultat: 'validee', fin: '2026-11-30', at: Date.parse('2026-11-26T05:30:00Z')}));
  e = await TR.etat();
  ok('mois avec le compte rendu d’Hermes : CRA validé, Hermes en réel, fin de mission dite avec la date du mail de prolongation', r('mois').etapes[2][1] === 'fait' && r('mois').quiDit === 'Hermes · réel' && /Fin de mission le 30\/11\/2026\. Mail de prolongation envoyé le 26\/11/.test(r('mois').alerte) && r('mois').derniere.quoi === 'validé', r('mois').alerte);
  ok('notes : dernière exécution de Chronos lue dans le Journal (pas celle d’un autre bot), échec signalé ; prochaines dates', r('claude').derniere.quand === '21/11' && r('claude').derniere.ok && r('box').derniere.quand === '15/11' && r('box').prochaine === 'mar. 15/12' && r('teletravail').prochaine === 'lun. 30/11' && r('grok').prochaine === 'ven. 04/12', JSON.stringify([r('claude').derniere, r('teletravail').derniere, r('box').prochaine]));
  ok('note de télétravail : sans note posée, le dernier passage d’Hermes (« à blanc, 9 j »)', r('teletravail').etapes[0][1] === 'fait' && r('teletravail').derniere.par === 'Hermes' && r('teletravail').derniere.quoi === 'à blanc, 9 j' && r('teletravail').quiDit === 'Hermes', JSON.stringify([r('teletravail').etapes, r('teletravail').derniere]));
  ok('note de la box à valider (la première) : « À toi », étape de validation en cours, la clé de la note pour l’app', r('box').toi.startsWith('Note de novembre à valider') && r('box').etapes[2][0] === 'Ta validation (1re fois)' && r('box').etapes[2][1] === 'encours' && r('box').note.cle === 'box:2026-11' && r('box').derniere.quoi === 'novembre : préparée, à valider', JSON.stringify([r('box').etapes, r('box').note, r('box').toi]));
  ok('note Claude : déjà validée une fois, celle du mois créée seule (« Validée une fois : part seule », créée)', r('claude').etapes[2][0] === 'Validée une fois : part seule' && r('claude').etapes[3][1] === 'fait' && !r('claude').toi && r('claude').derniere.quoi === 'novembre : créée', JSON.stringify(r('claude').etapes));
  ok('frise : les 14 prochains jours, dans l’ordre, le CRA de la semaine marqué « à toi »', e.frise.length >= 3 && e.frise.every((x, i, a) => !i || a[i - 1].date <= x.date) && e.frise.some((x) => x.toi && x.date === '2026-11-27') && !e.frise.some((x) => x.date > '2026-12-10'), JSON.stringify(e.frise.map((x) => x.date + ' ' + x.quoi)));
  ok('Gmail et le Journal relus au plus toutes les 10 minutes', appels.journal === 1 && appels.gmail.filter((q) => /CRA Novembre/.test(q)).length === 1, JSON.stringify(appels));
  let x = await TR.traiter('POST', '/api/travail/titre', async () => ({id: 'semaine', titre: 'CRA du client (hebdo)'}));
  e = (await TR.traiter('GET', '/api/travail', async () => ({}))).body;
  ok('renommer : le titre précis gardé sur le serveur (travail.json, 600), le modèle de mail intact', x.status === 200 && r('semaine').titre === 'CRA du client (hebdo)' && (fs.statSync(file).mode & 0o777) === 0o600 && JSON.parse(fs.readFileSync(file, 'utf8')).mails.cra_client.a[0] === 'contact@exemple.invalid');
  x = await TR.traiter('POST', '/api/travail/titre', async () => ({id: '__proto__', titre: 'x'}));
  const y = await TR.traiter('POST', '/api/travail/titre', async () => ({id: 'semaine', titre: ''}));
  e = await TR.etat();
  ok('renommer : une routine inconnue refusée ; un titre vide remet le titre par défaut', x.status === 400 && y.status === 200 && r('semaine').titre === 'CRA de la semaine');
  fs.rmSync(path.join(RET, 'mois-2026-11.json')); fs.symlinkSync('/etc/hostname', path.join(RET, 'mois-2026-11.json'));
  e = await TR.etat();
  ok('un compte rendu en lien n’est pas suivi', r('mois').etapes[2][1] === '' && !r('mois').alerte);
} catch (err) { ok('exception', false, (err && err.stack) || String(err)); }
fs.rmSync(DIR, {recursive: true, force: true});
console.log(results.join('\n'));
console.log((fails ? 'ÉCHECS : ' + fails : 'Tout est bon') + ' (' + results.length + ' vérifications)');
process.exit(fails ? 1 : 0);
