/* Banc de l'espace « Travail » (0.85.0) : node jarvis-os/server/tests/travail.test.mjs — données inventées */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {createTravail} from '../travail.mjs';
import {lireEchange, objetNu} from '../reponses.mjs';
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'travail-')), RET = path.join(DIR, 'retours'); fs.mkdirSync(RET);
try {
  const T = Date.parse('2026-11-26T09:00:00Z');   /* jeudi 26, 10 h à Paris */
  const bilan = {totaux: {travailles: 15, teletravail: 8, surSite: 5, aVenir: 2, conges: 5, feries: 1, aConfirmer: 0}};
  /* 0.94.0 : des fils entiers inventés (comme get_thread les rend), lus message par message */
  const MOI = 'moi@exemple.invalid', PDF = {filename: 'CRA signé.pdf', mimeType: 'application/pdf', size: 48213, attachmentId: 'ANGjdJ-piece-inventee'}, IMG = {filename: 'image.png', mimeType: 'image/png', size: 900, attachmentId: 'ANGjdJ-image'};
  const msg = (id, de, nom, objet, quand, labelIds, attachments = [], snippet = '') => ({id, sender: de, addressDisplayNames: [{displayName: nom, emailAddress: de}], subject: objet, internalDate: String(Date.parse(quand)), labelIds, snippet, attachments});
  const FIL_CRA = {id: 'fil-cra-0001', messages: [
    msg('m1', MOI, 'Moi', 'CRA Novembre 2026', '2026-11-26T06:00:00Z', ['SENT']),
    msg('m2', 'contact@exemple.invalid', 'Contact Client', 'Re: CRA Novembre 2026', '2026-11-26T07:35:00Z', ['INBOX', 'UNREAD'], [IMG, PDF], 'Bonjour, ci-joint le CRA sign&amp;é : c&#39;est bon pour moi.'),
    msg('m3', MOI, 'Moi', 'Re: CRA Novembre 2026', '2026-11-26T07:50:00Z', ['SENT'], [], 'Merci !'),              /* sa propre réponse : le DERNIER message envoyé du fil */
    msg('m4', MOI, 'Moi', 'Re: CRA Novembre 2026', '2026-11-26T07:55:00Z', ['DRAFT'])]};                           /* un brouillon dans le fil */
  const FIL_PRO = {id: 'fil-pro-0001', messages: [msg('p1', MOI, 'Moi', 'Prolongation mission', '2026-11-26T06:01:00Z', ['SENT'])]};
  const FIL_PRO2 = {id: 'fil-pro-0002', messages: [msg('p2', 'equipe@exemple.invalid', 'Équipe Missions', 'Re :Prolongation mission', '2026-11-26T08:20:00Z', ['INBOX', 'UNREAD'], [IMG], 'Bonjour, nous revenons vers vous ' + 'très vite '.repeat(30))]};
  const FIL_VIEUX = {id: 'fil-pro-0000', messages: [msg('p0', 'equipe@exemple.invalid', 'Équipe Missions', 'RE: Prolongation mission', '2026-11-20T10:00:00Z', ['INBOX'], [PDF])]};
  const FIL_OCT = {id: 'fil-pro-oct1', messages: [msg('o1', MOI, 'Moi', 'Prolongation mission', '2026-10-26T06:00:00Z', ['SENT']), msg('o2', 'chargee@exemple.invalid', 'Chargée', 'Re: Prolongation mission', '2026-10-27T09:00:00Z', ['INBOX'])]};
  const NOV = {depuis: Date.UTC(2026, 10, 1) - 864e5, jusqua: Date.UTC(2026, 11, 21)};
  { const a = lireEchange({...NOV, fils: [FIL_CRA], objet: 'CRA Novembre 2026'}), r = a.reponses[0] || {};
    ok('réponse dans le même fil avec PDF : le mail envoyé est son message (date de l’envoi, pas celle du dernier message du fil), la réponse porte le PDF', a.envoi && a.envoi.id === 'm1' && a.envoi.at === Date.parse('2026-11-26T06:00:00Z') && a.reponses.length === 1 && r.id === 'm2' && r.pdf === true && r.pieces === 2 && r.voie === 'fil' && r.nom === 'Contact Client' && r.lu === false && r.at === Date.parse('2026-11-26T07:35:00Z'), JSON.stringify(a));
    ok('le PDF de la réponse : de quoi le retrouver sans le télécharger (message, pièce jointe, nom, taille, type) ; l’image de signature n’y est pas', r.pdfs.length === 1 && JSON.stringify(r.pdfs[0]) === JSON.stringify({message: 'm2', piece: 'ANGjdJ-piece-inventee', nom: 'CRA signé.pdf', taille: 48213, type: 'application/pdf'}), JSON.stringify(r.pdfs));
    ok('son propre message et son brouillon dans le fil ne sont jamais une réponse ; l’extrait est décodé, sur une ligne', !a.reponses.some((x) => x.id === 'm3' || x.id === 'm4') && r.extrait === 'Bonjour, ci-joint le CRA sign&é : c\'est bon pour moi.', r.extrait);
    const b = lireEchange({...NOV, fils: [FIL_OCT, FIL_VIEUX, FIL_PRO2, FIL_PRO], objet: 'Prolongation mission'}), q = b.reponses[0] || {};
    ok('réponse dans un autre fil, d’une autre adresse, objet « Re :objet » : reconnue par l’objet nettoyé, quel que soit l’expéditeur', b.envoi && b.envoi.id === 'p1' && b.envoi.fil === 'fil-pro-0001' && b.reponses.length === 1 && q.id === 'p2' && q.fil === 'fil-pro-0002' && q.voie === 'objet' && q.de === 'equipe@exemple.invalid', JSON.stringify(b));
    ok('une image de signature seule n’est pas un PDF ; l’extrait fait 160 caractères au plus', q.pdf === false && q.pieces === 1 && q.extrait.length === 160 && q.extrait.endsWith('…'), JSON.stringify([q.pdf, (q.extrait || '').length]));
    ok('une réponse plus ancienne que l’envoi est ignorée (même avec un PDF) ; le mail du même objet du mois d’avant n’est pas pris pour l’envoi', !b.reponses.some((x) => x.id === 'p0' || x.id === 'o2') && b.envoi.at === Date.parse('2026-11-26T06:01:00Z'));
    ok('objet nettoyé : « RE : », « Re: », « Re : », « TR: », « Fwd: » répétés, espaces et casse', objetNu('RE : Re: TR:  CRA  Novembre 2026 ') === 'cra novembre 2026' && objetNu('Re :Prolongation mission') === objetNu('Prolongation mission') && objetNu('Fwd: RE\u00a0: Réf: x') === 'x' && objetNu('Re: CRA Octobre 2026') !== objetNu('CRA Novembre 2026') && objetNu('Rendez-vous : CRA') === 'rendez-vous : cra');
    const AUTRE = {id: 'fil-autre-001', messages: [msg('a1', 'contact@exemple.invalid', 'Contact Client', 'Document du mois', '2026-11-26T09:00:00Z', ['INBOX'], [PDF]), msg('a2', 'inconnu@exemple.invalid', 'Inconnu', 'Publicité', '2026-11-26T09:10:00Z', ['INBOX'], [PDF]), msg('a3', 'contact@exemple.invalid', 'Contact Client', 'Autre sujet', '2026-11-26T09:20:00Z', ['INBOX'], [IMG]), msg('a4', 'contact@exemple.invalid', 'Contact Client', 'Ancien', '2026-11-25T09:20:00Z', ['INBOX'], [PDF])]};
    const SANS = {id: 'fil-cra-0002', messages: [msg('s1', 'moi@exemple.invalid', 'Moi', 'CRA Novembre 2026', '2026-11-26T06:00:00Z', ['INBOX'])]};
    const c = lireEchange({...NOV, fils: [SANS], objet: 'CRA Novembre 2026', moi: 'Moi@Exemple.invalid', destinataires: ['Contact@exemple.invalid'], autres: [AUTRE]});
    ok('l’ancienne voie, corrigée : un mail d’un destinataire du modèle, avec un PDF, après l’envoi (autre objet) ; ni un inconnu, ni sans PDF, ni avant l’envoi ; son adresse suffit sans l’étiquette SENT', c.envoi && c.envoi.id === 's1' && c.reponses.length === 1 && c.reponses[0].id === 'a1' && c.reponses[0].voie === 'destinataire' && c.reponses[0].pdf, JSON.stringify(c));
    ok('sans mail envoyé : ni envoi ni réponse (jamais deviné)', lireEchange({...NOV, fils: [FIL_PRO2, FIL_VIEUX], objet: 'Prolongation mission'}).envoi === null && lireEchange({...NOV, fils: [FIL_PRO2], objet: 'Prolongation mission'}).reponses.length === 0); }
  /* le suivi tel que `jours.mjs` le garde (jours.json), ici rempli avec ces fils */
  const suiviDe = (objet, fils) => { const a = lireEchange({...NOV, fils, objet}); return {objet, envoi: a.envoi && {id: a.envoi.id, fil: a.envoi.fil, at: a.envoi.at}, reponses: a.reponses, lu: T}; };
  const SUIVI = {'2026-11': {cra: suiviDe('CRA Novembre 2026', [FIL_CRA]), prolongation: suiviDe('Prolongation mission', [FIL_PRO])}};
  const jours = {suivre: async (ym) => { appels.suivre.push(ym); return SUIVI[ym] || {}; }, suivi: (ym) => SUIVI[ym] || {},
    rattacher: (ym) => { const c = (SUIVI[ym] || {}).cra; if (!c || !c.reponses.some((x) => x.pdf)) return {ok: false, error: 'Aucun CRA signé reçu pour ce mois.'}; c.rattache = T; return {ok: true}; },
    etat: () => ({mois: '2026-11', etat: 'valide', demande: false, bilan, valide: {at: Date.parse('2026-11-24T11:05:00Z')}}),
    etatSemaine: (l) => (l === '2026-11-23' ? {lundi: l, etat: 'a_valider', demande: false, jours: []} : l === '2026-11-16' ? {lundi: l, etat: 'soumise', retour: {resultat: 'soumise', at: Date.parse('2026-11-20T11:20:00Z'), premiere: true}} : null),
    brut: () => ({semaines: {'2026-11-16': {}, '2026-11-23': {}}, teletravail: {'2026-10': {resultat: 'blanc', jours: 9, texte: 'Note préparée.', at: Date.parse('2026-10-30T11:30:00Z')}},
      /* 0.86.0 : les notes d'Hermes posées par root (montants inventés) */
      notes: NOTES_BANC})};
  const NOTES_BANC = {'box:2026-11': {sorte: 'box', mois: '2026-11', etat: 'a_valider', montant: 39, empreinte: 'abcdef0123456789', champs: [['Vendeur', 'Fournisseur inventé']], texte: 'Préparée.', at: Date.parse('2026-11-15T09:30:00Z')},
    'claude:2026-10': {sorte: 'claude', mois: '2026-10', etat: 'creee', montant: 90, empreinte: '0123456789abcdef', oui: {empreinte: '0123456789abcdef', at: 1}, champs: [], texte: 'Créée.', at: Date.parse('2026-10-21T09:30:00Z')},
    'claude:2026-11': {sorte: 'claude', mois: '2026-11', etat: 'creee', montant: 90, empreinte: 'fedcba9876543210', champs: [], texte: 'Créée.', at: Date.parse('2026-11-21T09:30:00Z')}};
  const appels = {suivre: [], journal: 0};
  const journal = async () => { appels.journal++; return [
    {bot: 'Chronos', ymd: '2026-11-21', at: Date.parse('2026-11-21T09:10:00Z'), sujet: 'Note de frais Claude', detail: 'Dépense créée, conforme.'},
    {bot: 'Chronos', ymd: '2026-11-15', at: Date.parse('2026-11-15T09:10:00Z'), sujet: 'Note de frais box internet', detail: 'Créée.'},
    {bot: 'Iris', ymd: '2026-11-25', at: Date.parse('2026-11-25T09:10:00Z'), sujet: 'Note de frais Claude', detail: 'pas Chronos'},
    {bot: 'Chronos', ymd: '2026-11-01', at: Date.parse('2026-11-01T08:10:00Z'), sujet: 'Télétravail octobre', detail: 'Échec : facture manquante.'}]; };
  const file = path.join(DIR, 'travail.json');
  fs.writeFileSync(file, JSON.stringify({mails: {cra_client: {a: ['contact@exemple.invalid'], objet: 'CRA {MOIS} {ANNEE}', corps: '…'}}}));
  const TR = createTravail({file, jours, retours: RET, journal, now: () => T});
  let e = await TR.etat();
  const r = (id) => e.routines.find((x) => x.id === id);
  ok('routines : jours, semaine, mois et quatre notes, titres précis par défaut sans nom de client', ['jours', 'semaine', 'mois', 'claude', 'box', 'teletravail', 'grok'].every((id) => r(id)) && r('claude').titre === 'Abonnement Claude' && r('jours').titre === 'Jours de novembre', e.routines.map((x) => x.titre).join(' | '));
  ok('jours : congés validés, lieux à venir, chiffres du bilan', r('jours').etapes[1][1] === 'fait' && r('jours').etapes[2][1] === 'encours' && r('jours').prevu.puces.some((p) => p[0] === '2 lieux à venir') && r('jours').derniere.par === 'toi', JSON.stringify(r('jours').etapes));
  ok('semaine : bilan vendredi à venir, prochaine « ven. 27/11 · 12 h », dernière exécution = la semaine d’avant soumise par Hermes', r('semaine').prochaine === 'ven. 27/11 · 12 h' && r('semaine').etapes[0][1] === '' && r('semaine').derniere.par === 'Hermes' && r('semaine').derniere.quoi === 'soumise', JSON.stringify([r('semaine').prochaine, r('semaine').derniere]));
  { const mo = r('mois'), ml = mo.mails[0] || {}, rp = (ml.reponses || [])[0] || {};
    ok('mois sans compte rendu d’Hermes : mail au client envoyé, CRA du client reçu (réponse dans le même fil, avec PDF), rattachement à faire (« À toi »)', mo.etapes[1][1] === 'fait' && mo.etapes[2][1] === '' && mo.etapes[3][1] === 'fait' && mo.etapes[4][1] === 'encours' && /^CRA signé reçu : à rattacher sur le portail/.test(mo.toi) && mo.attend.join() === 'CRA signé reçu : à rattacher' && mo.rattachable === true && mo.mois === '2026-11', JSON.stringify([mo.etapes, mo.toi, mo.attend]));
    ok('le mail du CRA : « envoyé le » à la vraie date de l’envoi, puis la réponse (qui, quand, extrait, PDF) et le lien du fil (https seulement)', mo.mails.length === 1 && ml.sorte === 'cra' && ml.envoye === 'envoyé le 26/11 à 07 h 00' && ml.quand === '26/11' && ml.etat === 'CRA signé reçu' && ml.url === 'https://mail.google.com/mail/#all/fil-cra-0001' && ml.reponses.length === 1 && rp.de === 'Contact Client' && rp.quand === 'le 26/11 à 08 h 35' && rp.pdf === true && rp.lu === false && /^Bonjour, ci-joint le CRA/.test(rp.extrait) && rp.url === ml.url, JSON.stringify(ml)); }
  fs.writeFileSync(path.join(RET, 'mois-2026-11.json'), JSON.stringify({resultat: 'validee', fin: '2026-11-30', at: Date.parse('2026-11-26T05:30:00Z')}));
  e = await TR.etat();
  ok('mois avec le compte rendu d’Hermes : CRA validé, Hermes en réel, fin de mission dite avec la date du mail de prolongation, sans réponse encore', r('mois').etapes[2][1] === 'fait' && r('mois').quiDit === 'Hermes · réel' && r('mois').alerte === 'Fin de mission le 30/11/2026. Mail de prolongation envoyé le 26/11 : pas encore de réponse.' && r('mois').derniere.quoi === 'validé' && r('mois').mails.length === 2 && r('mois').mails[1].etat === 'envoyé' && r('mois').mails[1].reponses.length === 0, r('mois').alerte);
  /* la réponse au mail de prolongation arrive : autre adresse, autre fil ; le suivi de jours.mjs la garde, Travail la lit aussitôt (aucun cache) */
  SUIVI['2026-11'].prolongation = suiviDe('Prolongation mission', [FIL_PRO, FIL_PRO2, FIL_VIEUX]);
  e = await TR.etat();
  { const mo = r('mois'), mp = mo.mails[1] || {}, rp = (mp.reponses || [])[0] || {};
    ok('prolongation : la réponse d’un autre fil est dite dans l’alerte (« à lire », sans conclure à sa place), avec son extrait et son lien ; elle compte dans ce qui attend', mo.alerte === 'Fin de mission le 30/11/2026. Réponse à ton mail de prolongation reçue le 26/11 à 09 h 20 : à lire.' && mp.etat === 'réponse reçue' && rp.de === 'Équipe Missions' && rp.pdf === false && rp.extrait.length <= 160 && rp.url === 'https://mail.google.com/mail/#all/fil-pro-0002' && mo.attend.join(' | ') === 'CRA signé reçu : à rattacher | Réponse à ton mail de prolongation : à lire' && /à rattacher sur le portail.*Réponse à ton mail de prolongation : à lire\.$/.test(mo.toi), JSON.stringify([mo.alerte, mp, mo.attend])); }
  SUIVI['2026-11'].prolongation.reponses[0].lu = true;
  e = await TR.etat();
  ok('prolongation : une réponse lue dans Gmail n’attend plus (« lue dans Gmail »), l’alerte de fin de mission reste', /reçue le 26\/11 à 09 h 20 \(lue dans Gmail\)\.$/.test(r('mois').alerte) && r('mois').attend.join() === 'CRA signé reçu : à rattacher', r('mois').alerte);
  { const sauve = SUIVI['2026-11'].cra;   /* une réponse au mail du CRA sans PDF (image de signature seule) : dite, l'étape reste en cours */
    SUIVI['2026-11'].cra = suiviDe('CRA Novembre 2026', [{id: 'fil-cra-0001', messages: [FIL_CRA.messages[0], {...FIL_CRA.messages[1], attachments: [IMG]}]}]);
    e = await TR.etat();
    ok('mail du CRA : une réponse sans PDF est dite « réponse reçue, sans le CRA », l’étape « CRA du client reçu » reste en cours, rien à rattacher', r('mois').etapes[3][1] === 'encours' && r('mois').etapes[4][1] === '' && r('mois').mails[0].etat === 'réponse reçue, sans le CRA' && r('mois').attend[0] === 'Réponse à ton mail du CRA, sans le CRA : à lire' && r('mois').rattachable === false, JSON.stringify([r('mois').etapes, r('mois').attend]));
    SUIVI['2026-11'].cra = sauve; }
  { const refus = await TR.traiter('POST', '/api/travail/rattache', async () => ({mois: '2026-10'})), oui = await TR.traiter('POST', '/api/travail/rattache', async () => ({mois: '2026-11'}));
    e = await TR.etat();
    ok('« C’est rattaché » : refusé sans CRA signé reçu ; dit par lui : étape « Rattaché » faite, plus rien à rattacher', refus.status === 409 && oui.status === 200 && r('mois').etapes[4][1] === 'fait' && !/rattacher/.test(r('mois').toi) && !r('mois').attend.includes('CRA signé reçu : à rattacher') && r('mois').rattachable === false, JSON.stringify([refus, oui, r('mois').etapes]));
    delete SUIVI['2026-11'].cra.rattache; }
  ok('notes : dernière exécution de Chronos lue dans le Journal (pas celle d’un autre bot), échec signalé ; prochaines dates', r('claude').derniere.quand === '21/11' && r('claude').derniere.ok && r('box').derniere.quand === '15/11' && r('box').prochaine === 'mar. 15/12' && r('teletravail').prochaine === 'lun. 30/11' && r('grok').prochaine === 'ven. 04/12', JSON.stringify([r('claude').derniere, r('teletravail').derniere, r('box').prochaine]));
  ok('note de télétravail : sans note posée, le dernier passage d’Hermes (« à blanc, 9 j »)', r('teletravail').etapes[0][1] === 'fait' && r('teletravail').derniere.par === 'Hermes' && r('teletravail').derniere.quoi === 'à blanc, 9 j' && r('teletravail').quiDit === 'Hermes', JSON.stringify([r('teletravail').etapes, r('teletravail').derniere]));
  ok('note de la box à valider (la première) : « À toi », étape de validation en cours, la clé de la note pour l’app', r('box').toi.startsWith('Note de novembre à valider') && r('box').etapes[2][0] === 'Ta validation (1re fois)' && r('box').etapes[2][1] === 'encours' && r('box').note.cle === 'box:2026-11' && r('box').derniere.quoi === 'novembre : préparée, à valider', JSON.stringify([r('box').etapes, r('box').note, r('box').toi]));
  ok('note Claude : déjà validée une fois, celle du mois créée seule (« Validée une fois : part seule », créée)', r('claude').etapes[2][0] === 'Validée une fois : part seule' && r('claude').etapes[3][1] === 'fait' && !r('claude').toi && r('claude').derniere.quoi === 'novembre : créée', JSON.stringify(r('claude').etapes));
  ok('frise : les 14 prochains jours, dans l’ordre, le CRA de la semaine marqué « à toi »', e.frise.length >= 3 && e.frise.every((x, i, a) => !i || a[i - 1].date <= x.date) && e.frise.some((x) => x.toi && x.date === '2026-11-27') && !e.frise.some((x) => x.date > '2026-12-10'), JSON.stringify(e.frise.map((x) => x.date + ' ' + x.quoi)));
  ok('le Journal relu au plus toutes les 10 minutes ; le suivi des mails demandé une fois pour le mois affiché, aucune recherche Gmail faite ici', appels.journal === 1 && appels.suivre.join() === '2026-11', JSON.stringify(appels));
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
  /* le CRA signé arrive souvent au début du mois suivant : jusqu'au 24, la carte reste sur le mois d'avant tant qu'il n'est pas rattaché */
  { let T2 = Date.parse('2026-12-02T09:00:00Z'); fs.rmSync(path.join(RET, 'mois-2026-11.json'));
    const TR2 = createTravail({file, jours, retours: RET, journal, now: () => T2});
    let e2 = await TR2.etat(); const mo = e2.routines.find((x) => x.id === 'mois');
    ok('le 2 du mois suivant, CRA de novembre reçu mais pas rattaché : la carte reste sur novembre (ses mails, « à rattacher »), le CRA de décembre dans « Ce qui vient »', mo.mois === '2026-11' && mo.etapes[3][1] === 'fait' && mo.attend[0] === 'CRA signé reçu : à rattacher' && mo.mails[0].quoi === 'Mail « CRA Novembre 2026 »' && mo.prevu.texte === 'Novembre' && mo.prochaine === 'sam. 26/12 · 12 h', JSON.stringify([mo.mois, mo.etapes, mo.prochaine]));
    SUIVI['2026-11'].cra.rattache = T2; e2 = await TR2.etat();
    ok('une fois rattaché, la carte passe au mois en cours', e2.routines.find((x) => x.id === 'mois').mois === '2026-12' && !e2.routines.find((x) => x.id === 'mois').mails.length && !e2.routines.find((x) => x.id === 'mois').toi);
    delete SUIVI['2026-11'].cra.rattache; T2 = Date.parse('2026-12-24T09:00:00Z'); e2 = await TR2.etat();
    ok('à partir du 24, la carte est celle du mois en cours, même si le CRA d’avant n’est pas rattaché', e2.routines.find((x) => x.id === 'mois').mois === '2026-12'); }
} catch (err) { ok('exception', false, (err && err.stack) || String(err)); }
fs.rmSync(DIR, {recursive: true, force: true});
console.log(results.join('\n'));
console.log((fails ? 'ÉCHECS : ' + fails : 'Tout est bon') + ' (' + results.length + ' vérifications)');
process.exit(fails ? 1 : 0);
