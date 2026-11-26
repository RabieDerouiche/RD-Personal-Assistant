#!/usr/bin/env node
/* Hermes « portail » — la note de télétravail : ce que seul JARVIS sait lire (docs/hermes-portail.md, « La note de frais de télétravail »).

   Lancé par « hermes-portail teletravail » (root) sous l'utilisateur jarvis, avec l'accès Google de JARVIS (son state.json, lu ici sans
   jamais être réécrit) et son code (google.mjs, jours.mjs, pdf.mjs). Lecture seule : rien n'est écrit dans Google ni dans l'état de JARVIS.

     node teletravail.mjs --jours AAAA-MM [--aujourdhui AAAA-MM-JJ] [--serveur <dossier du serveur JARVIS>]
       → les jours du mois selon les règles de JARVIS (agenda « Présence », jours fériés de France, ses corrections gardées dans
         jours.json) : une ligne JSON {mois, etat, complet, ouvres, tt: [{date, q}], joursTT, aConfirmer, aResoudre, texte}.
         Le bilan est refait sur une copie de jours.json, dans un dossier temporaire effacé ensuite.

     node teletravail.mjs --drive <identifiant> [--serveur …]
       → UN PDF du Drive par son identifiant : une ligne JSON {nom, taille, pdf (base64), texte}.

   Codes : 3 Google pas relié ou état illisible ; 4 introuvable ; 5 pas un PDF ; 2 usage ; 1 autre erreur. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const arg = (n, d = '') => { const i = process.argv.indexOf('--' + n); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const fin = (code, msg) => { console.error(msg); process.exit(code); };
const serveur = arg('serveur', '/opt/rd/jarvis-os/server'), ym = arg('jours'), fileId = arg('drive');
if (!ym && !fileId) fin(2, 'Usage : node teletravail.mjs --jours AAAA-MM | --drive <identifiant>');
if (ym && !/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) fin(2, 'Mois attendu : AAAA-MM.');
if (fileId && !/^[A-Za-z0-9_-]{10,120}$/.test(fileId)) fin(2, 'Identifiant de fichier invalide.');
const auj = arg('aujourdhui');
if (auj && !/^\d{4}-\d{2}-\d{2}$/.test(auj)) fin(2, 'Date attendue : AAAA-MM-JJ.');

const DATA = process.env.JARVIS_DATA || path.join(os.homedir(), '.jarvis');
let etat; try { etat = JSON.parse(fs.readFileSync(path.join(DATA, 'state.json'), 'utf8')); } catch { fin(3, "L'état de JARVIS est illisible pour cet utilisateur : à lancer sous l'utilisateur jarvis."); }
if (!(etat.google && etat.google.refresh)) fin(3, "Google n'est pas relié à JARVIS (Réglages, Connecter Google).");
const {createGoogle} = await import(pathToFileURL(path.join(serveur, 'google.mjs')).href);
/* une copie de l'accès, et un « enregistrer » qui ne fait rien : ce programme ne réécrit jamais l'état de JARVIS */
const G = createGoogle({S: {google: structuredClone(etat.google || {})}, save: () => {}});

if (fileId) {
  const {texteDePdf} = await import(pathToFileURL(path.join(serveur, 'pdf.mjs')).href);
  let r; try { r = await G.tool('Google Drive', 'file_pdf', {fileId}); } catch (e) { fin(/introuvable|not found|404/i.test(String(e && e.message)) ? 4 : /pas un PDF/i.test(String(e && e.message)) ? 5 : 1, 'Drive : ' + ((e && e.message) || String(e))); }
  const buf = Buffer.from(String(r.data || ''), 'base64');
  if (buf.length > 10e6 || buf.subarray(0, 5).toString('latin1') !== '%PDF-') fin(5, "Le fichier du Drive n'est pas un PDF de 10 Mo au plus.");
  let texte = ''; try { texte = texteDePdf(buf, 40000); } catch { /* PDF sans texte */ }
  process.stdout.write(JSON.stringify({nom: r.name || '', taille: buf.length, pdf: buf.toString('base64'), texte}) + '\n');
  process.exit(0);
}

/* les jours : le module de JARVIS lui-même (mêmes règles, mêmes agendas reconnus, ses corrections), sur une copie de jours.json */
const {createJours} = await import(pathToFileURL(path.join(serveur, 'jours.mjs')).href);
const boite = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-tt-'));
let code = 0, sortie = '', erreur = '';
try {
  const copie = path.join(boite, 'jours.json');
  try { fs.copyFileSync(path.join(DATA, 'jours.json'), copie); } catch { /* pas encore de jours.json : un bilan sans correction */ }
  const now = auj ? () => Date.parse(auj + 'T13:00:00+01:00') : Date.now;
  const agenda = {lie: () => true, calendriers: async () => ((await G.tool('Google Calendar', 'list_calendars', {})) || {}).calendars || [],
    evenements: async (calendarId, debut, finDate) => ((await G.tool('Google Calendar', 'list_events', {calendarId, startTime: debut + 'T00:00:00', endTime: finDate + 'T00:00:00', pageSize: 250})) || {}).events || []};
  const J = createJours({file: copie, agenda, now});
  const x = await J.lire(ym), e = J.etat(ym), b = x.bilan;
  if (!b) { code = x.erreur && /pas relié|introuvable|agenda/i.test(x.erreur) ? 3 : 1; erreur = 'Jours : ' + (x.erreur || 'bilan impossible.'); }
  else {
    const tt = b.jours.filter((d) => d.ouvre && !d.ferie).map((d) => ({date: d.date, q: (d.M === 'T' ? 0.5 : 0) + (d.A === 'T' ? 0.5 : 0)})).filter((d) => d.q > 0);
    sortie = JSON.stringify({mois: ym, etat: e.etat, complet: !!b.complet, ouvres: b.totaux.ouvres, tt, joursTT: tt.reduce((s, d) => s + d.q, 0),
      aConfirmer: b.aConfirmer, aResoudre: b.aResoudre.map((r) => r.date), texte: e.texte}) + '\n';
  }
} catch (err) {
  code = 1; erreur = 'Jours : ' + ((err && err.message) || String(err));
}
fs.rmSync(boite, {recursive: true, force: true});   /* la copie de jours.json ne reste jamais */
if (code) fin(code, erreur);
process.stdout.write(sortie);
process.exit(0);
