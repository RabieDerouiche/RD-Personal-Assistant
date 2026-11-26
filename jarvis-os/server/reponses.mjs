/* 0.94.0 — les réponses aux mails du mois, lues message par message (son constat du 26/11/2026 : « mes deux contacts ont répondu à nos
   mails et je ne vois aucun impact, aucune trace »).
   Avant, l'espace Travail réduisait chaque fil à son DERNIER message : une réponse dans le fil du mail envoyé donnait au mail envoyé
   l'heure de la réponse, et « reçu après l'envoi » n'était donc jamais vrai ; une réponse venue d'une autre adresse, dans un nouveau fil
   (« Re :objet »), n'était cherchée nulle part.
   Ici, rien que des fonctions pures, sans réseau : on leur donne des fils entiers (get_thread : tous les messages, leurs étiquettes, leurs
   pièces jointes) et elles rendent le mail envoyé (son message à lui, avec sa vraie date) et les réponses (les messages d'un autre, plus
   récents que l'envoi : dans le même fil, ou dans un autre fil dont l'objet nettoyé est le même, quel que soit l'expéditeur).
   Le contenu d'un mail est une donnée : rien n'en est lu comme une consigne, seul un extrait court est gardé pour l'afficher. */

const sansAccent = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/* l'objet débarrassé de ses « Re: », « RE : », « Re : », « TR: », « Fwd: »… répétés, des accents, de la casse et des espaces en trop */
export const objetNu = (s) => sansAccent(s).replace(/[\u00a0\u202f\u2007]/g, ' ').replace(/^(?:\s*(?:re|rep|tr|fw|fwd|aw|wg|ref)\s*(?:\[\d+\])?\s*:\s*)+/, '').replace(/\s+/g, ' ').trim();
/* un objet de réponse ou de transfert (il commence par un de ces préfixes) */
export const estSuite = (s) => /^\s*(?:re|rep|tr|fw|fwd|aw|wg|ref)\s*(?:\[\d+\])?\s*:/.test(sansAccent(s).replace(/[\u00a0\u202f\u2007]/g, ' '));
const ENT = {amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' '};
/* l'extrait de Gmail (entités HTML décodées), sur une ligne, 160 caractères au plus */
export const extraitDe = (s, n = 160) => {
  const t = String(s ?? '').replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(Math.min(+c, 0x10ffff))).replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCodePoint(Math.min(parseInt(c, 16), 0x10ffff)))
    .replace(/&([a-z]+);/gi, (m, k) => ENT[k.toLowerCase()] ?? m).replace(/[\u0000-\u001f\u200b-\u200f\u2028\u2029\ufeff]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
};
const quand = (m) => +m.internalDate || Date.parse(m.date || '') || 0;
const etiq = (m) => (Array.isArray(m.labelIds) ? m.labelIds : []);
export const estBrouillon = (m) => etiq(m).includes('DRAFT');
/* son message à lui : l'étiquette SENT (posée par Gmail sur tout ce qu'il envoie, JARVIS compris), ou son adresse en expéditeur */
export const estDeLui = (m, moi = '') => etiq(m).includes('SENT') || (!!moi && sansAccent(m.sender).trim() === sansAccent(moi).trim());
/* une pièce jointe PDF (le CRA signé) ; une image de signature (« image.png ») n'en est pas une */
export const aPdf = (m) => (m.attachments || []).some((p) => /^application\/(x-)?pdf$/i.test(String(p.mimeType || '')) || /\.pdf$/i.test(String(p.filename || '').trim()));
const nomDe = (m) => { const d = (m.addressDisplayNames || [])[0] || {}; return extraitDe(d.displayName || '', 60).replace(/^["'«\s]+|["'»\s]+$/g, '') || String(m.sender || '').split('@')[0].slice(0, 60); };
const reponseDe = (m, fil, voie) => ({id: String(m.id || ''), fil: String(fil || m.threadId || ''), at: quand(m), de: String(m.sender || '').toLowerCase().slice(0, 120), nom: nomDe(m),
  pdf: aPdf(m), pieces: (m.attachments || []).length, extrait: extraitDe(m.snippet), lu: !etiq(m).includes('UNREAD'), voie});

/* Le mail envoyé et ses réponses.
   - fils : les fils trouvés par l'objet (get_thread : [{id, messages}]) ;
   - objet : l'objet du mail envoyé ; moi : son adresse (facultatif : l'étiquette SENT suffit) ;
   - depuis, jusqua : la fenêtre où chercher l'envoi (le mois du mail : un objet qui revient chaque mois n'est pas pris pour celui d'avant) ;
   - destinataires et autres : l'ancienne voie, gardée : un mail d'un destinataire du modèle, avec un PDF, arrivé après l'envoi, quel que
     soit son objet (« autres » : les fils de cette seconde recherche).
   Rend {envoi: {id, fil, at, objet} | null, reponses: [{id, fil, at, de, nom, pdf, pieces, extrait, lu, voie}]}, des plus anciennes aux plus récentes. */
export function lireEchange({fils = [], objet = '', moi = '', depuis = 0, jusqua = Infinity, destinataires = [], autres = []}) {
  const nu = objetNu(objet), tous = [];
  for (const f of fils || []) for (const m of (f && f.messages) || []) if (m && !estBrouillon(m)) tous.push({m, fil: String(f.id || m.threadId || '')});
  /* l'envoi : son message à lui, du même objet, dans la fenêtre ; le premier mail « neuf » (pas une réponse de sa part dans le fil), sinon le plus ancien */
  const siens = tous.filter((x) => estDeLui(x.m, moi) && nu && objetNu(x.m.subject) === nu && quand(x.m) >= depuis && quand(x.m) < jusqua).sort((a, z) => quand(a.m) - quand(z.m));
  const e = siens.find((x) => !estSuite(x.m.subject)) || siens[0] || null;
  if (!e) return {envoi: null, reponses: []};
  const envoi = {id: String(e.m.id || ''), fil: e.fil, at: quand(e.m), objet: extraitDe(e.m.subject, 200)}, vus = new Set(), reponses = [];
  const garder = (m, fil, voie) => { const id = String(m.id || ''); if (!id || vus.has(id) || estBrouillon(m) || estDeLui(m, moi) || !(quand(m) > envoi.at)) return; vus.add(id); reponses.push(reponseDe(m, fil, voie)); };
  for (const x of tous) {
    if (x.fil === envoi.fil) garder(x.m, x.fil, 'fil');                         /* dans le fil du mail envoyé : tout message d'un autre, plus récent */
    else if (objetNu(x.m.subject) === nu) garder(x.m, x.fil, 'objet');          /* dans un autre fil : le même objet, « Re : » ôtés, quel que soit l'expéditeur */
  }
  const dest = new Set([].concat(destinataires || []).map((a) => sansAccent(a).trim()).filter(Boolean));
  if (dest.size) for (const f of autres || []) for (const m of (f && f.messages) || []) if (m && dest.has(sansAccent(m.sender).trim()) && aPdf(m)) garder(m, String(f.id || m.threadId || ''), 'destinataire');
  reponses.sort((a, z) => a.at - z.at);
  return {envoi, reponses};
}
