/* 0.85.0 — l'espace « Travail » (sa demande du 26/11/2026 : « repense comment visualiser ses routines dans JARVIS : les étapes faites,
   l'avancement, les dates d'exécution, les données prévues d'un coup d'œil ; séparer le CRA des tâches normales » ; maquette validée le
   26/11 avec une remarque : « des titres précis, pas des titres de catégories »).
   Une carte par routine : qui la fait (Chronos, Hermes à blanc, Hermes en réel, JARVIS), ses étapes et leur état, la prochaine date, les
   données prévues, la dernière exécution. Rien n'est inventé : les jours et le CRA de la semaine viennent de `jours.mjs`, le CRA du mois du
   compte rendu d'Hermes (dossier de root), les mails de Gmail (envoyés, reçus), les passages de Chronos de l'onglet Journal de Pilotage.
   Les titres précis (nom du client, du portail, du fournisseur) ne sont pas dans ce dépôt public : ils sont dans `travail.json` sur son
   serveur, et il les renomme lui-même dans l'app (« Renommer »). Ce fichier garde aussi les modèles des mails (destinataire, texte). */
import fs from 'node:fs';
import path from 'node:path';
import {MOIS} from './jours.mjs';

const TITRES = {semaine: 'CRA de la semaine', mois: 'CRA du mois', jours: 'Jours du mois', claude: 'Abonnement Claude', box: 'Box internet', teletravail: 'Télétravail', grok: 'Grok Bot'};
/* l'avancement du remplacement de Chronos par Hermes, note par note (état du chantier au 26/11/2026 ; `travail.json` peut le remplacer) */
const NOTES = [
  /* 0.86.0 (sa décision du 26/11/2026 : « tout arrêter ce soir » chez Chronos ; « valide avec moi la première fois, c'est tout ») : Hermes
     fait ces trois notes ; ses étapes viennent de la note posée par root (jours.mjs, notes[sorte:mois]) */
  {id: 'claude', jour: 21, qui: 'reel', quiDit: 'Hermes', journal: 'claude|anthropic', piece: 'Facture lue'},
  {id: 'box', jour: 15, qui: 'reel', quiDit: 'Hermes', journal: 'box|internet|fibre', piece: 'Facture téléchargée'},
  {id: 'teletravail', jour: 'dernier', qui: 'reel', quiDit: 'Hermes', journal: 't[ée]l[ée]travail', piece: 'Pièces et calcul'},
  {id: 'grok', jour: 4, qui: 'reel', quiDit: 'Hermes', journal: 'grok|xai', piece: 'Facture lue'}
];
const SEM = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const pad = (n) => String(n).padStart(2, '0');
const ymdDe = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);
const dernierJour = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const dowDe = (s) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))).getUTCDay();
const plusJour = (s, n) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10) + n)).toISOString().slice(0, 10);
const court = (s) => SEM[dowDe(s)] + ' ' + s.slice(8, 10) + '/' + s.slice(5, 7);
const jjmm = (s) => s.slice(8, 10) + '/' + s.slice(5, 7);
const moisMaj = (m) => MOIS[m - 1].charAt(0).toUpperCase() + MOIS[m - 1].slice(1);
const TXT = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const paris = (d) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}).formatToParts(d).map((x) => [x.type, x.value])); return {ymd: p.year + '-' + p.month + '-' + p.day, hm: (p.hour === '24' ? '00' : p.hour) + ':' + p.minute}; };

export function createTravail({file, jours, retours = '/var/lib/hermes-portail-retours', journal = async () => [], now = Date.now, log = () => {}}) {
  const lireConf = () => { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; } };
  const ecrireConf = (c) => { const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(c, null, 2), {mode: 0o600}); fs.renameSync(tmp, file); };
  const titre = (C, id) => TXT((C.titres || {})[id], 60) || TITRES[id];
  /* le compte rendu du CRA du mois, posé par root (`hermes-portail cra-mois`) : résultat, fin de mission */
  const retourMois = (ym) => { try { const f = path.join(retours, 'mois-' + ym + '.json'); if (!fs.lstatSync(f).isFile()) return null; const r = JSON.parse(fs.readFileSync(f, 'utf8')); return r && typeof r === 'object' ? r : null; } catch { return null; } };
  /* le Journal et le suivi des mails : relus au plus toutes les 10 minutes (le tableau s'ouvre souvent, ces lectures coûtent) */
  const cache = new Map();
  const memo = async (cle, fn) => { const c = cache.get(cle); if (c && now() - c.at < 600000) return c.v; let v = null; try { v = await fn(); } catch (e) { log('travail : ' + cle + ' : ' + ((e && e.message) || e)); v = c ? c.v : null; } cache.set(cle, {at: now(), v}); return v; };
  /* 0.94.0 : les mails du mois ne sont plus cherchés ici (un fil réduit à son dernier message donnait au mail envoyé l'heure de la
     réponse : « reçu après l'envoi » n'était jamais vrai). Leur état est tenu par `jours.mjs` (suivi message par message, toutes les
     5 minutes, notifié) et lu ici tel quel ; à l'ouverture, le mois affiché est seulement relu si ce n'est pas déjà fait. */
  const suiviDe = async (mois, relire) => { if (relire && jours.suivre) await memo('suivi:' + mois, () => jours.suivre(mois)); return (jours.suivi && jours.suivi(mois)) || {}; };
  const filUrl = (fil) => (/^[\w-]{6,64}$/.test(String(fil || '')) ? 'https://mail.google.com/mail/#all/' + fil : '');
  const quandH = (at) => { const p = paris(new Date(at)); return jjmm(p.ymd) + ' à ' + p.hm.replace(':', ' h '); };
  const passages = () => memo('journal', journal);

  async function etat() {
    /* 0.97.0 : les comptes rendus de root (CRA signé vérifié à blanc, déposé ; notes) sont lus dès qu'il ouvre Travail, sans attendre la minute */
    if (jours.lireRetours) await jours.lireRetours().catch((e) => log('travail : comptes rendus : ' + ((e && e.message) || e)));
    const C = lireConf(), t = paris(new Date(now())), auj = t.ymd, y = +auj.slice(0, 4), m = +auj.slice(5, 7), ym = auj.slice(0, 7), dern = ymdDe(y, m, dernierJour(y, m));
    const J = (await passages()) || [];
    const derChronos = (re) => { const rx = new RegExp(re, 'i'); const l = J.filter((x) => /chronos|medusa/i.test(x.bot) && rx.test(x.sujet + ' ' + x.detail)).sort((a, b) => b.at - a.at)[0]; return l ? {quand: jjmm(l.ymd), quoi: TXT(l.sujet || l.detail, 60), par: 'Chronos', ok: !/échec|bloqu|ko\b|erreur/i.test(l.sujet + ' ' + l.detail)} : null; };
    const routines = [], frise = [];
    const ev = (date, quoi, qui, toi) => { if (date >= auj && date <= plusJour(auj, 14)) frise.push({date, quand: court(date), quoi, qui, toi: !!toi}); };

    /* les jours du mois (JARVIS) */
    const E = jours.etat(ym), b = E.bilan, T = b ? b.totaux : null, le24 = ymdDe(y, m, 24);
    const ouiJours = E.etat === 'valide';
    routines.push({id: 'jours', bloc: 'jours', titre: TXT((C.titres || {}).jours, 60) || 'Jours de ' + MOIS[m - 1], qui: 'reel', quiDit: 'JARVIS',
      prochaine: auj < le24 ? court(le24) + ' · bilan' : auj < dern ? court(dern) + ' · relu' : 'mois prochain',
      etapes: [['Bilan (24)', b && auj >= le24 ? 'fait' : ''], ['Ton oui', ouiJours ? 'fait' : auj >= le24 ? 'encours' : ''], ['Lieux notés', T && !T.aVenir && !T.aConfirmer ? 'fait' : ouiJours ? 'encours' : ''], ['Relu (' + dern.slice(8) + ')', auj >= dern && ouiJours ? 'fait' : '']],
      prevu: T ? {texte: moisMaj(m), puces: [[T.travailles + ' jours travaillés', ''], [T.teletravail + ' en télétravail', ''], [T.conges + (T.conges > 1 ? ' congés' : ' congé'), 'non'], [T.feries + (T.feries > 1 ? ' fériés' : ' férié'), 'non']].concat(T.aVenir ? [[T.aVenir + ' lieu' + (T.aVenir > 1 ? 'x' : '') + ' à venir', 'amb']] : [])} : null,
      derniere: E.valide ? {quand: jjmm(new Date(E.valide.at).toISOString().slice(0, 10)), quoi: 'congés validés', par: 'toi', ok: true} : null,
      toi: E.demande ? 'Ton oui sur tes congés : il sert au CRA du mois.' : '', ouvrir: 'jours'});
    ev(le24, 'Jours de ' + MOIS[m - 1] + ' : bilan', 'JARVIS, puis ton oui', true);

    /* le CRA de la semaine : la semaine en cours (ou la dernière, le week-end) */
    const lundi = plusJour(auj, -((dowDe(auj) + 6) % 7)), vendredi = plusJour(lundi, 4), S = jours.etatSemaine(lundi);
    const st = S ? S.etat : 'a_valider', fait = (x) => (x ? 'fait' : '');
    const semPasse = Object.keys(jours.brut().semaines || {}).filter((l) => l < lundi).sort().reverse().map((l) => ({l, s: jours.etatSemaine(l)})).find((x) => x.s && x.s.retour);
    routines.push({id: 'semaine', bloc: 'cra', titre: titre(C, 'semaine'), qui: 'reel', quiDit: 'Hermes · réel',
      prochaine: auj < vendredi || (auj === vendredi && t.hm < '12:00') ? court(vendredi) + ' · 12 h' : court(plusJour(vendredi, 7)) + ' · 12 h',
      etapes: [['Bilan du vendredi', fait(S && S.jours && S.jours.length)], ['Ton oui', ['valide', 'soumise', 'deja'].includes(st) ? 'fait' : S && S.demande ? 'encours' : ''], ['Saisie et Submit', st === 'soumise' || st === 'deja' ? 'fait' : st === 'a_la_main' ? 'bloque' : st === 'valide' ? 'encours' : ''], ['Compte rendu', S && S.retour ? (['soumise', 'deja'].includes(S.retour.resultat) ? 'fait' : 'bloque') : '']],
      prevu: S && S.jours && S.jours.length ? {texte: 'Semaine du ' + jjmm(lundi) + ' au ' + jjmm(vendredi), jours: S.jours.map((d) => [SEM[dowDe(d.date)].replace('.', ''), d.q === 1 ? '1' : d.q === 0 ? 'rien' : '?', d.q === 1 ? '' : d.q === 0 ? 'non' : 'amb'])} : {texte: 'Semaine du ' + jjmm(lundi) + ' au ' + jjmm(vendredi), puces: [['bilan le vendredi à midi', 'non']]},
      derniere: S && S.retour ? {quand: jjmm(new Date(S.retour.at).toISOString().slice(0, 10)), quoi: {soumise: 'soumise', deja: 'déjà soumise', rien: 'rien saisi', echec: 'pas soumise'}[S.retour.resultat] || S.retour.resultat, par: 'Hermes', ok: ['soumise', 'deja'].includes(S.retour.resultat)}
        : semPasse ? {quand: jjmm(new Date(semPasse.s.retour.at).toISOString().slice(0, 10)), quoi: semPasse.s.retour.resultat === 'soumise' ? 'soumise' : semPasse.s.retour.resultat, par: 'Hermes', ok: ['soumise', 'deja'].includes(semPasse.s.retour.resultat)} : derChronos(C.journalSemaine || 'cra.*(semaine|hebdo)|timesheet'),
      toi: S && S.demande ? 'Ton oui attend : confirme la semaine, Hermes saisit et soumet.' : st === 'a_la_main' ? 'Hermes n’a pas pu soumettre : à faire à la main, ou « Relancer Hermes ».' : '', ouvrir: 'semaine', lundi});
    ev(auj <= vendredi ? vendredi : plusJour(vendredi, 7), titre(C, 'semaine'), 'ton oui, puis Hermes', true);

    /* le CRA du mois : jours validés (24), mail au client, CRA validé par Hermes (26), CRA du client reçu, rattaché.
       0.94.0 : les deux mails et leurs réponses viennent du suivi de `jours.mjs`. Le CRA signé arrive souvent au début du mois suivant :
       jusqu'au 24, la carte reste sur le mois d'avant tant que son mail est parti et que son CRA n'est pas rattaché. */
    const SV = await suiviDe(ym, true), prec = plusJour(ym + '-01', -1).slice(0, 7), SVp = await suiviDe(prec, false);
    const rattacheDe = (mois, sv) => !!((retourMois(mois) || {}).rattache || (sv.cra || {}).rattache);
    const cm = auj < le24 && (SVp.cra || {}).envoi && !rattacheDe(prec, SVp) ? prec : ym, cy = +cm.slice(0, 4), cmo = +cm.slice(5, 7), cDern = ymdDe(cy, cmo, dernierJour(cy, cmo));
    const Ec = cm === ym ? E : jours.etat(cm), Tc = Ec.bilan ? Ec.bilan.totaux : null, ouiC = Ec.etat === 'valide', c24 = ymdDe(cy, cmo, 24), le26 = ymdDe(y, m, 26);
    const R = retourMois(cm), S2 = cm === ym ? SV : SVp, sc = S2.cra || {}, sp = S2.prolongation || {};
    const mailCra = sc.envoi || null, repCra = sc.reponses || [], recu = repCra.find((x) => x.pdf) || null, sansCra = !recu && repCra.length ? repCra[repCra.length - 1] : null;
    const fin = R && /^\d{4}-\d{2}-\d{2}$/.test(String(R.fin || '')) ? R.fin : '', finDit = fin.split('-').reverse().join('/');
    const prolong = fin && fin <= cDern ? sp.envoi || null : null, repPro = prolong ? sp.reponses || [] : [], rp = repPro[repPro.length - 1] || null;
    const valideMois = R && ['validee', 'deja'].includes(R.resultat), rattache = rattacheDe(cm, S2);
    const unMail = (sorte, s, reps, etat) => ({sorte, quoi: 'Mail « ' + TXT(s.objet, 80) + ' »', quand: jjmm(paris(new Date(s.envoi.at)).ymd), etat, envoye: 'envoyé le ' + quandH(s.envoi.at), url: filUrl(s.envoi.fil),
      reponses: reps.map((x) => ({de: TXT(x.nom, 60) || 'ton contact', quand: 'le ' + quandH(x.at), extrait: TXT(x.extrait, 160), pdf: !!x.pdf, lu: !!x.lu, url: filUrl(x.fil)}))});
    /* 0.97.0 : le CRA signé déposé par Hermes après son oui (son QCM du 26/11/2026). `jours.signe` dit où on en est : PDF gardé, portail
       vérifié à blanc par Hermes, son oui, dépôt. `attend` et `toi` ne portent que ce qui l'attend, lui ; ce qui est en cours chez JARVIS
       ou Hermes est dit à part (`signe.dit`). Sans accès aux pièces jointes (ou avant la 0.97.0) : l'ancien chemin, « à rattacher ». */
    const SG0 = recu && jours.signe ? jours.signe(cm) : null, SG = SG0 && !rattache ? SG0 : null, sgE = SG ? SG.etat : '';
    const sgFichier = SG && SG.nom ? '« ' + TXT(SG.nom, 80) + ' »' + (SG.tailleDite ? ', ' + SG.tailleDite : '') : '', sgRaison = SG && SG.raison ? ' ' + TXT(SG.raison, 200).replace(/[.\s]*$/, '.') : '';
    /* 0.98.0 : le PDF comparé à la saisie (mois, total, détail) : le verdict est dit dès qu'il est connu ; un écart change la question */
    const sgC = SG && SG.controle ? SG.controle : null, sgCdit = sgC ? ' ' + TXT(sgC.dit, 220).replace(/[.\s]*$/, '.') : '', sgEcart = !!(sgC && sgC.etat === 'ecart'),
      /* 0.102.0 : venu d'une adresse qui n'est pas un destinataire du mail du mois : dit en premier, et jamais déposé sans son oui */
      sgQui = SG && SG.inconnu ? 'Attention : il vient ' + (SG.de ? 'de ' + TXT(SG.de, 80) : 'd’une adresse') + ', qui n’est pas un destinataire de ton mail : vérifie avant de le déposer. ' : '',
      sgTete = sgQui ? 'CRA signé reçu. ' + sgQui + sgCdit.trim() + (sgCdit ? ' ' : '') : sgCdit ? 'CRA signé reçu.' + sgCdit + ' ' : 'CRA signé reçu : ';
    const sgAttend = {pret: sgQui ? 'CRA signé reçu d’une adresse inconnue : à vérifier' : sgEcart ? 'CRA signé reçu : il ne correspond pas à la saisie' : 'CRA signé reçu : Hermes le dépose sur le portail ?', introuvable: 'CRA signé reçu : Hermes n’a pas trouvé où le déposer : à faire à la main', echec_blanc: 'CRA signé reçu : Hermes n’a pas pu vérifier le portail : à faire à la main',
      echec: 'CRA signé pas déposé : à faire à la main', refuse: 'CRA signé reçu : PDF pas récupéré, à rattacher à la main'}[sgE] || '';
    const sgToi = {pret: sgQui + (sgEcart ? 'CRA signé reçu, mais il ne correspond pas à la saisie : ' + sgFichier + '.' + sgCdit + ' Hermes a trouvé où le déposer (rien n’est déposé) : « Déposer quand même », ou « Je le fais moi-même ».'
      : 'CRA signé reçu : Hermes le dépose sur le portail ? ' + sgFichier + '.' + sgCdit + ' Il a trouvé où le déposer (essai à blanc : rien n’est déposé).') + (SG && SG.autres ? ' La réponse portait ' + (SG.autres + 1) + ' PDF : le plus gros est retenu.' : ''),
      introuvable: 'CRA signé reçu : Hermes n’a pas trouvé où le déposer : à faire à la main.' + sgRaison, echec_blanc: 'CRA signé reçu : Hermes n’a pas pu vérifier le portail : à faire à la main.' + sgRaison,
      echec: 'CRA signé pas déposé : à faire à la main.' + sgRaison + ' Le PDF reste gardé.', refuse: 'CRA signé reçu, mais le PDF n’a pas pu être gardé : à rattacher à la main.' + sgRaison}[sgE] || '';
    const sgDit = {recupere: 'CRA signé reçu : JARVIS récupère le PDF…' + (SG && SG.raison ? ' (' + TXT(SG.raison, 120) + ' : nouvel essai dans le quart d’heure)' : ''), attend_cra: sgTete + 'Hermes vérifiera le portail une fois le CRA du mois validé.',
      verifie: sgTete + 'Hermes vérifie le portail…', oui: SG && SG.auto ? 'CRA signé conforme à la saisie : Hermes le dépose sur le portail (dans le quart d’heure), sans attendre ton oui.' : 'Ton oui est noté : Hermes dépose le CRA signé sur le portail (dans le quart d’heure).'}[sgE] || '';
    const sgAttente = !!sgDit;   /* en cours chez JARVIS ou Hermes : rien ne l'attend, lui */
    const rattDit = !rattache || !SG0 ? '' : 'CRA signé ' + (SG0.par === 'hermes' ? 'déposé sur le portail par Hermes' : SG0.par === 'portail' ? 'déjà sur le portail (vu par Hermes)' : 'rattaché (dit par toi)') + (SG0.le ? ' le ' + quandH(SG0.le) : '') + '.';
    const signe = SG ? {etat: sgE, mois: cm, dit: sgDit, nom: TXT(SG.nom, 80), taille: SG.tailleDite, autres: SG.autres, raison: TXT(SG.raison, 200), url: filUrl(SG.fil), controle: sgC ? sgC.etat : '', controleDit: sgC ? TXT(sgC.dit, 300) : '', ...(SG.inconnu ? {inconnu: true} : {}), ...(sgE === 'pret' || sgE === 'echec' ? {empreinte: SG.empreinte} : {})}
      : rattDit ? {etat: 'fait', mois: cm, dit: rattDit, par: SG0.par} : null;
    /* ce qui l'attend, en clair : le CRA signé à rattacher (ou son oui pour qu'Hermes le dépose), une réponse pas encore lue dans Gmail */
    const attend = [recu && !rattache ? (sgAttente ? '' : sgAttend || 'CRA signé reçu : à rattacher') : sansCra && !sansCra.lu ? 'Réponse à ton mail du CRA, sans le CRA : à lire' : '', rp && !rp.lu ? 'Réponse à ton mail de prolongation : à lire' : ''].filter(Boolean);
    routines.push({id: 'mois', bloc: 'cra', titre: titre(C, 'mois'), mois: cm, qui: R ? 'reel' : 'blanc', quiDit: R ? 'Hermes · réel' : 'Hermes',
      prochaine: cm !== ym ? court(le26) + ' · 12 h' : valideMois ? '26/' + pad(m === 12 ? 1 : m + 1) : court(le26) + ' · 12 h',
      etapes: [['Congés validés', ouiC ? 'fait' : auj >= c24 ? 'encours' : ''], ['Mail au client', mailCra ? 'fait' : ouiC ? 'encours' : ''], ['CRA validé', valideMois ? 'fait' : R && R.resultat !== 'blanc' ? 'bloque' : ''], ['CRA du client reçu', recu ? 'fait' : mailCra ? 'encours' : ''], ['Rattaché', rattache ? 'fait' : sgE === 'echec' ? 'bloque' : recu ? 'encours' : '']],
      prevu: Tc ? {texte: moisMaj(cmo), puces: [[Tc.travailles + ' jours de mission', ''], [Tc.conges + (Tc.conges > 1 ? ' congés' : ' congé'), 'non'], [Tc.feries + (Tc.feries > 1 ? ' fériés' : ' férié'), 'non']]} : null,
      alerte: fin && fin <= cDern ? 'Fin de mission le ' + finDit + '. ' + (rp ? 'Réponse à ton mail de prolongation reçue le ' + quandH(rp.at) + (rp.lu ? ' (lue dans Gmail).' : ' : à lire.') : prolong ? 'Mail de prolongation envoyé le ' + jjmm(paris(new Date(prolong.at)).ymd) + ' : pas encore de réponse.' : 'Pas encore de mail de prolongation.') : '',
      derniere: R ? {quand: jjmm(new Date(+R.at || now()).toISOString().slice(0, 10)), quoi: {validee: 'validé', deja: 'déjà validé', rien: 'rien saisi', enregistree: 'complété, pas validé', blanc: 'à blanc', echec: 'échec'}[R.resultat] || R.resultat, par: 'Hermes', ok: valideMois} : derChronos(C.journalMois || 'cra.*mois|compte rendu d.activit'),
      mails: [mailCra ? unMail('cra', sc, repCra, recu ? 'CRA signé reçu' : sansCra ? 'réponse reçue, sans le CRA' : 'envoyé') : null, prolong ? unMail('prolongation', sp, repPro, rp ? 'réponse reçue' : 'envoyé') : null].filter(Boolean),
      attend, rattachable: !!recu && !rattache && sgE !== 'pret' && sgE !== 'oui', ...(signe ? {signe} : {}),
      toi: [recu && !rattache ? (sgAttente ? '' : sgToi || 'CRA signé reçu : à rattacher sur le portail (onglet du haut de la page du CRA).') : sansCra && !sansCra.lu ? 'Réponse à ton mail du CRA, sans le CRA : à lire.' : '', rp && !rp.lu ? 'Réponse à ton mail de prolongation : à lire.' : ''].filter(Boolean).join(' '), ouvrir: 'mois'});
    { const Rm = cm === ym ? R : retourMois(ym); if (!(Rm && ['validee', 'deja'].includes(Rm.resultat))) ev(le26, titre(C, 'mois'), 'Hermes saisit et valide'); }

    /* les notes de frais */
    for (const N0 of NOTES) {
      const N = Object.assign({}, N0, ((C.notes || {})[N0.id]) || {}), jr = N.jour === 'dernier' ? dernierJour(y, m) : +N.jour;
      const ce = ymdDe(y, m, Math.min(jr, dernierJour(y, m))), suiv = auj <= ce ? ce : (() => { const y2 = m === 12 ? y + 1 : y, m2 = m === 12 ? 1 : m + 1; return ymdDe(y2, m2, N.jour === 'dernier' ? dernierJour(y2, m2) : Math.min(jr, dernierJour(y2, m2))); })();
      let etapes = N.etapes, derniere = derChronos(N.journal), toi = '', note = null;
      if (N.piece) {   /* une note d'Hermes : la plus récente posée par root (jusqu'au mois en cours) */
        const NS = (jours.brut() || {}).notes || {}, k = Object.keys(NS).filter((x) => x.startsWith(N.id + ':') && x.slice(-7) <= ym).sort().pop(), n = k ? NS[k] : null;
        const deja = Object.keys(NS).some((x) => x.startsWith(N.id + ':') && ['creee', 'deja'].includes(NS[x].etat) && NS[x].oui);
        const cree = n && ['creee', 'deja'].includes(n.etat), oui = n && n.oui && n.oui.empreinte === n.empreinte;
        etapes = [[N.piece, n ? (n.etat === 'arret' ? 'bloque' : 'fait') : ''], ['Vérifiée à blanc', n && n.etat !== 'arret' ? 'fait' : ''],
          [deja ? 'Validée une fois : part seule' : 'Ta validation (1re fois)', cree || oui || n && n.etat === 'auto' || deja ? 'fait' : n && n.etat === 'a_valider' ? 'encours' : ''],
          ['Créée dans le portail', cree ? 'fait' : n && n.etat === 'echec' ? 'bloque' : oui ? 'encours' : '']];
        if (n) {
          const qd = jjmm(new Date(n.at).toISOString().slice(0, 10)), mo = MOIS[+n.mois.slice(5, 7) - 1];
          derniere = {quand: qd, quoi: mo + ' : ' + ({a_valider: oui ? 'validée, en cours de création' : 'préparée, à valider', auto: 'préparée, part seule', creee: 'créée', deja: 'déjà présente', echec: 'pas créée', arret: 'arrêtée'}[n.etat] || n.etat), par: 'Hermes', ok: !['echec', 'arret'].includes(n.etat)};
          if (n.etat === 'a_valider' && !oui) toi = 'Note de ' + mo + ' à valider : relis-la, puis « Valider et créer ».';
          else if (['echec', 'arret'].includes(n.etat)) toi = 'Note de ' + mo + ' pas créée : ' + n.texte;
          note = {cle: k, etat: n.etat, valide: !!oui};
        } else if (N.id === 'teletravail') {   /* le passage du dernier jour arrêté avant d'avoir une note (pièce manquante, jour sans lieu) */
          const TT = (jours.brut() || {}).teletravail || {}, kt = Object.keys(TT).filter((x) => x <= ym).sort().pop(), tt = kt ? TT[kt] : null;
          if (tt) {
            const okT = ['blanc', 'prete'].includes(tt.resultat);
            etapes[0][1] = okT ? 'fait' : 'bloque';
            derniere = {quand: jjmm(new Date(tt.at).toISOString().slice(0, 10)), quoi: (okT ? 'à blanc' : 'arrêtée') + (tt.jours != null ? ', ' + String(tt.jours).replace('.', ',') + ' j' : ''), par: 'Hermes', ok: okT};
            if (!okT) toi = 'Hermes s’est arrêté : ' + tt.texte;
          }
        }
      }
      routines.push({id: N.id, bloc: 'frais', titre: titre(C, N.id), qui: N.qui, quiDit: N.quiDit, prochaine: court(suiv), etapes, derniere, toi, ouvrir: 'note', ...(note ? {note} : {})});
      ev(suiv, titre(C, N.id), N.quiDit);
    }
    frise.sort((x, z) => (x.date < z.date ? -1 : 1));
    return {maj: now(), aujourdhui: auj, routines, frise};
  }
  function renommer(id, nom) {
    if (!Object.prototype.hasOwnProperty.call(TITRES, id)) return {ok: false, error: 'Routine inconnue.'};
    const t = TXT(nom, 60); const C = lireConf(); C.titres = C.titres || {};
    if (t) C.titres[id] = t; else delete C.titres[id];
    ecrireConf(C); return {ok: true, titre: t || TITRES[id]};
  }
  async function traiter(method, p, lireCorps) {
    if (p === '/api/travail' && method === 'GET') return {status: 200, body: await etat()};
    if (p === '/api/travail/titre' && method === 'POST') { const b = await lireCorps(); const r = renommer(String(b.id || ''), b.titre); return {status: r.ok ? 200 : 400, body: r}; }
    /* 0.94.0 : « C’est rattaché » (le compte rendu du portail ne le dit pas encore : il le dit lui-même) */
    if (p === '/api/travail/rattache' && method === 'POST') { const b = await lireCorps(); const r = jours.rattacher ? jours.rattacher(String((b && b.mois) || '')) : {ok: false, error: 'Indisponible.'}; return {status: r.ok ? 200 : 409, body: r}; }
    return {status: 404, body: {error: 'introuvable'}};
  }
  /* après un envoi depuis JARVIS : le mois est relu à la prochaine ouverture, sans attendre les 10 minutes */
  const invalider = () => { for (const k of [...cache.keys()]) if (k.startsWith('suivi:')) cache.delete(k); };
  return {etat, renommer, traiter, conf: lireConf, invalider};
}
