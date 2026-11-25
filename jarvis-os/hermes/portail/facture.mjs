#!/usr/bin/env node
/* Hermes « portail » — aller chercher une facture reçue par mail (docs/hermes-portail.md).

   Le Hermes portail n'a ni mails ni fichiers. C'est la commande hermes-portail (root) qui lance ce programme, sous
   l'utilisateur jarvis, avec l'accès Google que JARVIS a déjà (son state.json, lu ici sans jamais être réécrit) et
   son code (google.mjs pour Gmail, pdf.mjs pour lire le texte du PDF). Lecture seule : une recherche, la lecture
   des fils trouvés, le téléchargement d'UNE pièce jointe. Rien n'est envoyé, marqué lu, étiqueté ni supprimé.

     node facture.mjs --requete '<recherche Gmail>' --nom '<expression sur le nom du fichier>' [--serveur <dossier du serveur JARVIS>]

     node facture.mjs --requete '<recherche Gmail>' --code-apres <instant en ms> [--motif '<expression du code>']
       → le code à usage unique du mail le plus récent reçu après cet instant (par défaut : 6 chiffres), seul sur
         la sortie ; code 4 s'il n'est pas encore arrivé. Pour un site qui envoie son code de connexion par mail.

   Sortie : une ligne JSON {nom, taille, dateMail, expediteur, pdf (base64), texte}. Le PDF le plus récent qui
   correspond. Code 3 : Google pas relié ; 4 : aucun PDF trouvé ; 5 : fichier trop gros ou qui n'est pas un PDF. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

/* node facture.mjs --texte-de-l-entree [--serveur …] : le texte du PDF reçu sur l'entrée standard, par pdf.mjs de JARVIS.
   Aucun accès à Google ni à l'état de JARVIS dans ce mode : il sert à lire un fichier que root a déjà (une facture
   rapportée d'un portail), sous un utilisateur sans droits plutôt qu'en root. */
if (process.argv.includes('--texte-de-l-entree')) {
  const i = process.argv.indexOf('--serveur'), srv = i > 0 && process.argv[i + 1] ? process.argv[i + 1] : '/opt/rd/jarvis-os/server';
  const {texteDePdf} = await import(pathToFileURL(path.join(srv, 'pdf.mjs')).href);
  const buf = fs.readFileSync(0);
  if (buf.length > 10e6 || buf.subarray(0, 5).toString('latin1') !== '%PDF-') { console.error("L'entrée n'est pas un PDF de 10 Mo au plus."); process.exit(5); }
  let texte = ''; try { texte = texteDePdf(buf, 40000); } catch { /* PDF sans texte */ }
  process.stdout.write(texte + '\n'); process.exit(0);
}
const arg = (n, d = '') => { const i = process.argv.indexOf('--' + n); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const requete = arg('requete'), nom = arg('nom', '\\.pdf$'), serveur = arg('serveur', '/opt/rd/jarvis-os/server');
const fin = (code, msg) => { console.error(msg); process.exit(code); };
if (!requete || requete.length > 500 || nom.length > 200) fin(2, "Usage : node facture.mjs --requete '<recherche Gmail>' --nom '<expression sur le nom du fichier>'");
let filtre; try { filtre = new RegExp(nom, 'i'); } catch { fin(2, 'Expression du nom de fichier invalide.'); }

const DATA = process.env.JARVIS_DATA || path.join(os.homedir(), '.jarvis');
let etat; try { etat = JSON.parse(fs.readFileSync(path.join(DATA, 'state.json'), 'utf8')); } catch { fin(3, "L'état de JARVIS est illisible pour cet utilisateur : à lancer sous l'utilisateur jarvis."); }
const {createGoogle} = await import(pathToFileURL(path.join(serveur, 'google.mjs')).href);
const {texteDePdf} = await import(pathToFileURL(path.join(serveur, 'pdf.mjs')).href);
/* une copie de l'accès, et un « enregistrer » qui ne fait rien : ce programme ne réécrit jamais l'état de JARVIS */
const G = createGoogle({S: {google: structuredClone(etat.google || {})}, save: () => {}});
if (!(etat.google && etat.google.refresh)) fin(3, "Google n'est pas relié à JARVIS (Réglages, Connecter Google).");

const codeApres = +arg('code-apres', '0');
if (codeApres) {
  let motif; try { motif = new RegExp(arg('motif', '(?<![0-9])([0-9]{6})(?![0-9])')); } catch { fin(2, 'Expression du code invalide.'); }
  try {
    const r = await G.tool('Gmail', 'search_threads', {query: requete, pageSize: 5, idsOnly: true});
    let meilleur = null;
    for (const t of (r.threads || [])) {
      const fil = await G.tool('Gmail', 'get_thread', {threadId: t.id});
      for (const m of (fil.messages || [])) {
        const quand = +m.internalDate || Date.parse(m.date) || 0;
        if (quand <= codeApres || (meilleur && quand <= meilleur.quand)) continue;
        const x = motif.exec(String(m.subject || '') + '\n' + String(m.plaintextBody || ''));
        if (x) meilleur = {quand, code: x[1] || x[0]};
      }
    }
    if (!meilleur) fin(4, 'Pas encore de code dans les mails.');
    process.stdout.write(meilleur.code + '\n'); process.exit(0);
  } catch (e) { fin(e && e.code === 'server_not_connected' ? 3 : 1, 'Gmail : ' + ((e && e.message) || String(e))); }
}

try {
  const r = await G.tool('Gmail', 'search_threads', {query: requete, pageSize: 10, idsOnly: true});
  for (const t of (r.threads || [])) {   /* Gmail rend les fils du plus récent au plus ancien */
    const fil = await G.tool('Gmail', 'get_thread', {threadId: t.id});
    for (const m of [...(fil.messages || [])].reverse()) {
      const pj = (m.attachments || []).find((a) => filtre.test(a.filename) && (/pdf/i.test(a.mimeType) || /\.pdf$/i.test(a.filename)) && a.attachmentId);
      if (!pj) continue;
      if (pj.size > 5e6) fin(5, 'La pièce jointe dépasse 5 Mo.');
      const x = await G.tool('Gmail', 'get_attachment', {messageId: m.id, attachmentId: pj.attachmentId});
      const buf = Buffer.from(String(x.data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      if (buf.length > 5e6 || buf.subarray(0, 5).toString('latin1') !== '%PDF-') fin(5, "La pièce jointe n'est pas un PDF lisible.");
      let texte = ''; try { texte = texteDePdf(buf, 20000); } catch { /* PDF sans texte (scan) : le portail le lira lui-même */ }
      process.stdout.write(JSON.stringify({nom: pj.filename, taille: buf.length, dateMail: m.date, expediteur: m.sender, pdf: buf.toString('base64'), texte}) + '\n');
      process.exit(0);
    }
  }
  fin(4, 'Aucun PDF ne correspond à cette recherche et à ce nom de fichier.');
} catch (e) {
  fin(e && e.code === 'server_not_connected' ? 3 : 1, 'Gmail : ' + ((e && e.message) || String(e)));
}
