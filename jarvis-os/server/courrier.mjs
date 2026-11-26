/* Routines de Grok Bot reprises (26/11/2026, sa décision par QCM : « JARVIS surveille ») : le courrier traité à son arrivée.
   Grok Bot s'arrête le 3/12/2026 et ses adresses de bots avec lui : plus de filtre Gmail vers un alias. Toutes les 5 minutes, JARVIS
   cherche dans sa boîte, sans IA, les mails des expéditeurs de l'onglet Expéditeurs de Pilotage dont l'urgence est « Immédiat »
   (Iris : courrier prioritaire ; Kairos : alertes de prix ; les factures sont à la note de frais, ailleurs), les met dans une file
   et réveille Hermes, qui les lit (courrier_a_traiter), les traite selon ses skills puis les marque traités (courrier_traite).
   Le réveil est un fichier que JARVIS touche (`reveil`) ; root le surveille et lance la routine « reveil » d'Hermes : rien de ce
   fichier n'est lu comme une consigne. Rien n'est envoyé, archivé ni marqué dans Gmail. */
const BOTS_SURVEILLES = ['iris', 'kairos'];
const low = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const clip = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

/* les adresses et domaines d'une case « Adresse ou domaine » (« noreply@exemple.fr ; agence-exemple.com (filtre…) ») */
export function adressesDe(cellule) {
  const t = String(cellule || '').toLowerCase(), out = new Set();
  for (const m of t.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g)) out.add(m[0]);
  const sansMails = t.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g, ' ');
  for (const m of sansMails.matchAll(/(?<![\w@.-])([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:fr|com|net|org|eu|io|ai|co|be|ch|de|uk|it|es))(?![\w.-])/g)) out.add(m[1]);
  return [...out].slice(0, 12);
}
/* les lignes surveillées : bot Iris ou Kairos, urgence « Immédiat… » */
export function surveilles(rows) {
  const hd = (rows[0] || []).map(low), iA = hd.findIndex((x) => x.startsWith('adresse')), iB = hd.indexOf('bot'), iU = hd.indexOf('urgence'), iQ = hd.indexOf('qui');
  if (iA < 0 || iB < 0 || iU < 0) return [];
  return rows.slice(1).filter((r) => BOTS_SURVEILLES.includes(low(r[iB])) && /^immediat/.test(low(r[iU]))).map((r) => ({qui: clip(r[iQ], 60), bot: low(r[iB]) === 'kairos' ? 'Kairos' : 'Iris', adresses: adressesDe(r[iA])})).filter((x) => x.adresses.length);
}

export function createCourrier({S, save, now = Date.now, chercher, lireExpediteurs, reveiller = () => {}, actif = () => true, log = () => {}}) {
  const C = () => (S.courrier = S.courrier || {file: [], vus: [], depuis: 0, lu: 0, lignes: [], erreur: ''});
  let enCours = false;
  async function tic() {
    if (enCours || !actif()) return {nouveaux: 0};
    enCours = true;
    try {
      const c = C(), t = now();
      if (!c.depuis) { c.depuis = t; save(); }   /* premier passage : rien d'ancien, seulement ce qui arrive ensuite */
      if (!c.lignes.length || t - (c.lu || 0) > 30 * 60e3) { c.lignes = surveilles(await lireExpediteurs()); c.lu = t; }
      const toutes = c.lignes.flatMap((l) => l.adresses.map((a) => ({a, l}))).slice(0, 30);
      if (!toutes.length) { c.erreur = ''; save(); return {nouveaux: 0}; }
      const q = 'newer_than:2d {' + toutes.map((x) => 'from:' + x.a).join(' ') + '}';
      const threads = ((await chercher(q)) || {}).threads || [], vus = new Set(c.vus), nouveaux = [];
      for (const th of threads) {
        const ms = th.messages || [], m = ms[ms.length - 1] || {}, at = +m.internalDate || Date.parse(m.date || '') || 0, id = String(m.id || th.id || '');
        if (!id || vus.has(id) || at < c.depuis) continue;
        const de = low(m.sender || ''), x = toutes.find((y) => de === y.a || de.endsWith('@' + y.a) || de.endsWith('.' + y.a));
        if (!x) continue;   /* le dernier message du fil n'est pas de l'expéditeur surveillé (sa propre réponse, par exemple) */
        vus.add(id); nouveaux.push({id, fil: String(th.id || m.threadId || ''), at, de: clip(m.sender, 80), objet: clip(m.subject, 140), qui: x.l.qui, bot: x.l.bot, etat: 'a_traiter', recu: t});
      }
      c.vus = [...vus].slice(-600); c.file = c.file.concat(nouveaux).slice(-200); c.erreur = ''; save();
      if (nouveaux.length) reveiller('courrier');
      return {nouveaux: nouveaux.length};
    } catch (e) { const c = C(); c.erreur = clip((e && e.message) || e, 160); save(); log('courrier : ' + c.erreur); return {nouveaux: 0, erreur: c.erreur}; }
    finally { enCours = false; }
  }
  const aTraiter = () => C().file.filter((x) => x.etat === 'a_traiter');
  function traite(id, resume) {
    const x = C().file.find((y) => y.id === String(id || ''));
    if (!x) return null;
    x.etat = 'traite'; x.resume = clip(resume, 300); x.traiteLe = now(); save(); return x;
  }
  let timer = null;
  const demarrer = (ms) => { if (!timer) { timer = setInterval(() => { tic().catch(() => {}); }, ms || 300e3); if (timer.unref) timer.unref(); } };
  return {tic, aTraiter, traite, demarrer, etat: () => ({...C(), file: C().file.slice(-30)})};
}

/* le réveil d'Hermes : JARVIS touche un fichier (contenu : la raison et l'heure, jamais lu comme une consigne) ; une fois par minute au plus */
export function createReveil({fichier, fs, now = Date.now, log = () => {}}) {
  let dernier = -Infinity, prevenu = false;
  return function reveiller(raison) {
    const t = now(); if (t - dernier < 60e3) return false;
    try { fs.writeFileSync(fichier, JSON.stringify({raison: String(raison || '').slice(0, 20), at: t}) + '\n'); dernier = t; return true; }
    catch (e) { if (!prevenu) { prevenu = true; log('réveil d’Hermes impossible (' + ((e && e.code) || e) + ') : ' + fichier); } return false; }
  };
}
