#!/usr/bin/env node
/* Client de la prise d'administration de jarvis-coffre, appelé par la commande `jarvis-coffre` (root).
 *
 *   node client.mjs --prise <admin.sock> <commande> [nom] [portée]
 *
 * Ce qui est secret (phrase, valeur) n'arrive JAMAIS par la ligne de commande ni par l'environnement (lisibles dans
 * /proc par d'autres) : seulement par l'entrée standard, un tube en mémoire.
 *   creer, ouvrir      : la phrase sur l'entrée
 *   changer-phrase     : l'ancienne phrase, un retour à la ligne, la nouvelle
 *   mettre <nom> <portée> : la valeur sur l'entrée (toute l'entrée ; un seul retour à la ligne final est retiré)
 *   etat, fermer, retirer <nom> : rien sur l'entrée
 *   sonde              : muet ; code 0 = ouvert, 3 = verrouillé, 4 = pas encore créé
 * Codes : 0 fait, 1 refusé, 2 service injoignable. Rien de secret n'est affiché (la prise ne rend aucune valeur). */
import fs from 'node:fs';
import net from 'node:net';

const MAX = 64 * 1024;
const dire = (m) => process.stdout.write(m + '\n');
const sortir = (code, m) => { if (m) process.stderr.write(m + '\n'); process.exit(code); };

const args = process.argv.slice(2);
if (args[0] !== '--prise' || !args[1]) sortir(1, 'Usage : client.mjs --prise <admin.sock> <commande> [nom] [portée]');
const prise = args[1], commande = args[2], reste = args.slice(3);
const ATTENDUS = {etat: 0, sonde: 0, fermer: 0, creer: 0, ouvrir: 0, 'changer-phrase': 0, retirer: 1, mettre: 2};
if (!Object.hasOwn(ATTENDUS, commande) || reste.length !== ATTENDUS[commande]) sortir(1, 'Commande ou arguments refusés (aucun secret ne se passe en argument).');

function lireEntree() {   // tout ce qui arrive sur l'entrée, en un tampon (effacé par l'appelant)
  const morceaux = []; let taille = 0;
  for (;;) {
    const b = Buffer.alloc(8192); let n;
    try { n = fs.readSync(0, b, 0, b.length, null); } catch (e) { if (e.code === 'EAGAIN') continue; if (e.code === 'EOF') n = 0; else throw e; }
    if (!n) break;
    morceaux.push(b.subarray(0, n)); taille += n;
    if (taille > MAX) { for (const m of morceaux) m.fill(0); sortir(1, 'Entrée trop longue (64 Kio au plus).'); }
  }
  const tout = Buffer.concat(morceaux); for (const m of morceaux) m.fill(0);
  return tout;
}
function sansFinDeLigne(b) { let n = b.length; if (n && b[n - 1] === 10) { n--; if (n && b[n - 1] === 13) n--; } return b.subarray(0, n); }

let demande;
if (commande === 'etat' || commande === 'sonde') demande = {commande: 'etat'};
else if (commande === 'fermer') demande = {commande};
else if (commande === 'retirer') demande = {commande, nom: reste[0]};
else {
  const entree = lireEntree(), utile = sansFinDeLigne(entree);
  if (commande === 'changer-phrase') {
    const coupe = utile.indexOf(10);
    if (coupe < 0) { entree.fill(0); sortir(1, 'Deux lignes attendues : l’ancienne phrase, puis la nouvelle.'); }
    demande = {commande, ancienne: sansFinDeLigne(utile.subarray(0, coupe + 1)).toString('utf8'), nouvelle: utile.subarray(coupe + 1).toString('utf8')};
  } else if (commande === 'mettre') demande = {commande, nom: reste[0], portee: reste[1], valeur: utile.toString('utf8')};
  else demande = {commande, phrase: utile.toString('utf8')};
  entree.fill(0);
}

const injoignable = () => sortir(2, 'Le service jarvis-coffre ne répond pas (' + prise + '). Vérifie : sudo systemctl status jarvis-coffre');
const c = net.createConnection(prise);
let recu = Buffer.alloc(0), repondu = false;
c.setTimeout(60_000, () => { c.destroy(); injoignable(); });
c.on('error', injoignable);
c.on('connect', () => { const ligne = Buffer.from(JSON.stringify(demande) + '\n', 'utf8'); demande = null; c.write(ligne, () => ligne.fill(0)); });
c.on('data', (b) => {
  recu = Buffer.concat([recu, b]);
  const i = recu.indexOf(10);
  if (i < 0) { if (recu.length > 4 * MAX) { c.destroy(); injoignable(); } return; }
  repondu = true; c.destroy();
  let r; try { r = JSON.parse(recu.subarray(0, i).toString('utf8')); } catch { return sortir(2, 'Réponse illisible du service.'); }
  afficher(r);
});
c.on('close', () => { if (!repondu) injoignable(); });

function afficher(r) {
  if (!r || r.ok !== true) {
    if (commande === 'sonde') process.exit(1);
    sortir(1, 'Refusé : ' + (r && typeof r.erreur === 'string' ? r.erreur : 'réponse inattendue') + '.');
  }
  if (commande === 'sonde') process.exit(r.ouvert ? 0 : r.existe ? 3 : 4);
  if (commande === 'etat') {
    if (!r.existe) dire('Coffre : pas encore créé (sudo jarvis-coffre creer).');
    else if (r.ouvert) dire('Coffre : ouvert depuis ' + r.depuis + ' (clé en mémoire seulement).');
    else dire('Coffre : verrouillé' + (r.bloque ? ' ; trop d’essais ratés, bloqué encore ' + Math.ceil(r.bloque / 60) + ' min' : '') + ' (sudo jarvis-coffre ouvrir).');
    const s = Array.isArray(r.secrets) ? r.secrets : [];
    if (r.existe) dire(s.length ? 'Secrets (' + s.length + '), jamais leur valeur :' : 'Aucun secret.');
    const l = Math.max(0, ...s.map((x) => String(x.nom).length));
    for (const x of s) dire('  ' + String(x.nom).padEnd(l) + '  ' + String(x.portee).padEnd(7) + '  ' + x.maj);
  } else if (commande === 'creer') dire('Coffre créé et ouvert.');
  else if (commande === 'ouvrir') dire(r.deja ? 'Coffre déjà ouvert.' : 'Coffre ouvert : les agents du serveur sont autonomes jusqu’au prochain redémarrage ou « fermer ».');
  else if (commande === 'fermer') dire(r.etait ? 'Coffre fermé : la clé est effacée de la mémoire.' : 'Coffre déjà verrouillé.');
  else if (commande === 'mettre') dire('Secret « ' + r.nom + ' » ' + (r.remplace ? 'remplacé' : 'ajouté') + ' (portée ' + r.portee + ').');
  else if (commande === 'retirer') dire('Secret « ' + r.nom + ' » retiré.');
  else if (commande === 'changer-phrase') dire('Phrase changée ; clé renouvelée, ' + r.secrets + ' secret(s) rechiffré(s). L’ancienne phrase n’ouvre plus rien.');
  process.exit(0);
}
