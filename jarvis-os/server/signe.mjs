/* 0.97.0 — le CRA signé du client, gardé par JARVIS pour qu'Hermes le dépose sur le portail après son oui (son choix au QCM du
   26/11/2026 : « Hermes, après mon oui »).
   Ici, seulement de quoi choisir, vérifier et garder UN fichier, sans réseau :
   - le PDF retenu parmi les pièces jointes de la réponse (un seul : le plus gros qui n'est pas une image) ;
   - sa vérification (il commence par « %PDF- », 15 Mo au plus) ;
   - sa garde sous le dossier de données de JARVIS : un sous-dossier 700 qui n'est jamais un lien, un fichier 600 au nom tiré au sort,
     créé sans suivre de lien, avec son empreinte SHA-256. Root (`hermes-portail cra-signe-auto`) le recopie chez lui en revérifiant
     l'empreinte ; aucune route ni aucun outil MCP ne rend ce fichier.
   Le nom du fichier vient d'un mail : c'est une donnée, affichée seulement ; il ne sert jamais de chemin. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const SIGNE_MAX = 15 * 1024 * 1024;
const NOM_GARDE = /^[0-9a-f]{32}\.pdf$/;
const estImage = (p) => /^image\//i.test(String((p && p.mimeType) || ''));
const estPdf = (p) => /^application\/(x-)?pdf$/i.test(String((p && p.mimeType) || '')) || /\.pdf$/i.test(String((p && p.filename) || '').trim());

/* Le PDF retenu parmi les pièces jointes d'un message (get_thread : filename, mimeType, size, attachmentId) : une image nommée
   « .pdf » n'en est pas un ; s'il y en a plusieurs, le plus gros. Rend {piece, autres} (autres : les PDF laissés de côté), ou null. */
export function choisirPdf(pieces) {
  const l = (Array.isArray(pieces) ? pieces : []).filter((p) => p && p.attachmentId && estPdf(p) && !estImage(p));
  if (!l.length) return null;
  const tri = l.slice().sort((a, z) => (+z.size || 0) - (+a.size || 0));
  return {piece: tri[0], autres: tri.length - 1};
}
/* la pièce jointe telle que Gmail la rend (base64 « url ») */
export const octetsDe = (data) => Buffer.from(String(data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
/* '' si c'est un PDF acceptable, sinon la raison, en clair */
export function verifierPdf(buf) {
  if (!Buffer.isBuffer(buf) || !buf.length) return 'la pièce jointe est vide';
  if (buf.length > SIGNE_MAX) return 'le PDF dépasse 15 Mo';
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') return 'la pièce jointe n’est pas un PDF';
  return '';
}
export const empreinteDe = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
export const tailleDite = (n) => { const v = +n || 0; return v >= 1048576 ? (v / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(v / 1024)) + ' Ko'; };
/* un texte venu de root (ce qu'Hermes dit de la page) : ni adresse, ni hôte, ni adresse mail ; une ligne, n caractères au plus */
export const sansAdresse = (s, n = 300) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\bhttps?:\/\/\S+/gi, '(adresse)').replace(/\S+@\S+\.\S+/g, '(adresse)')
  .replace(/\b(?:[a-z0-9-]+\.)+(?:[a-z]{2,})\b(?:\/\S*)?/gi, (m) => (/^\d+([.,]\d+)*$/.test(m) ? m : '(adresse)')).replace(/\s+/g, ' ').trim().slice(0, n);

/* Le dossier de garde. Rien n'y est écrit ni lu à travers un lien : le dossier lui-même est contrôlé (un vrai dossier, à nous), le
   fichier est créé avec O_EXCL et O_NOFOLLOW, relu avec O_NOFOLLOW. */
export function creerGarde(dossier) {
  const C = fs.constants;
  function pret() {
    try { fs.mkdirSync(dossier, {mode: 0o700}); } catch (e) { if (!e || e.code !== 'EEXIST') throw e; }
    const st = fs.lstatSync(dossier);
    if (!st.isDirectory() || st.isSymbolicLink()) throw new Error('le dossier de garde du CRA signé n’est pas un vrai dossier');
    if (typeof process.getuid === 'function' && st.uid !== process.getuid()) throw new Error('le dossier de garde du CRA signé n’est pas à JARVIS');
    if ((st.mode & 0o777) !== 0o700) fs.chmodSync(dossier, 0o700);
  }
  /* garde les octets (déjà vérifiés) ; rend {fichier, empreinte, taille} */
  function garder(buf) {
    const raison = verifierPdf(buf); if (raison) throw new Error(raison);
    pret();
    const fichier = crypto.randomBytes(16).toString('hex') + '.pdf', f = path.join(dossier, fichier);
    const fd = fs.openSync(f, C.O_WRONLY | C.O_CREAT | C.O_EXCL | C.O_NOFOLLOW, 0o600);
    try { fs.writeSync(fd, buf); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    return {fichier, empreinte: empreinteDe(buf), taille: buf.length};
  }
  /* relit un fichier gardé (un vrai fichier, 15 Mo au plus) ; null s'il n'est plus là ou n'est pas ce qu'on attend */
  function lire(fichier) {
    if (!NOM_GARDE.test(String(fichier || ''))) return null;
    let fd = -1;
    try {
      pret(); fd = fs.openSync(path.join(dossier, fichier), C.O_RDONLY | C.O_NOFOLLOW);
      const st = fs.fstatSync(fd); if (!st.isFile() || st.size > SIGNE_MAX) return null;
      return fs.readFileSync(fd);
    } catch { return null; } finally { if (fd >= 0) { try { fs.closeSync(fd); } catch { /* rien */ } } }
  }
  function effacer(fichier) {
    if (!NOM_GARDE.test(String(fichier || ''))) return false;
    try { pret(); fs.unlinkSync(path.join(dossier, fichier)); return true; } catch { return false; }
  }
  /* ce qui traîne dans le dossier sans être gardé pour un mois (un téléchargement interrompu, un mois purgé) : effacé */
  function menage(gardes) {
    let n = 0;
    try { pret(); for (const nom of fs.readdirSync(dossier)) if (NOM_GARDE.test(nom) && !gardes.has(nom)) { try { fs.unlinkSync(path.join(dossier, nom)); n++; } catch { /* rien */ } } } catch { /* pas de dossier : rien à ranger */ }
    return n;
  }
  return {garder, lire, effacer, menage, dossier};
}
