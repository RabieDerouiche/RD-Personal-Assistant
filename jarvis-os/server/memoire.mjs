/* JARVIS OS 0.37.0 : la mémoire durable (choix du propriétaire, QCM du 21/11/2026, « Mémoire durable », après le rapport
   « Ce qui manque à JARVIS OS » : toutes les plateformes mûres gardent un MEMORY.md et un USER.md ; JARVIS oubliait tout).
   1. Ce que Claude doit retenir de lui d'une discussion à l'autre (préférences, habitudes, personnes, lieux) : ajouté par lui seul,
      d'un appui sur « Retenir » sous une proposition de Claude, ou à la main dans Réglages ; gardé sur le serveur (DATA/memoire.json,
      jamais dans le dépôt, qui est public) ; rien de bancaire, aucun mot de passe ni code (refusé à l'entrée).
   2. Son Profil (Google Doc « Profil » du dossier RD Assistant), lu par l'accès Google du serveur (Drive en lecture), sans ses parties
      finances, relu toutes les 6 heures.
   Les deux vont dans la consigne de chaque Claude (discussion, missions, Siri, tour). Pilotage reste la source de vérité pour les faits,
   les seuils et les échéances (CLAUDE.md). */
import fs from 'node:fs';
import crypto from 'node:crypto';

/* rien de bancaire, aucun secret : mots du domaine, IBAN, et toute suite de 12 chiffres ou plus (carte, compte ; un téléphone en a 10) */
const MOTS = /\b(iban|bic|rib|cvv|cryptogramme|carte bancaire|carte bleue|num[ée]ro de (carte|compte)|identifiant bancaire|code (pin|secret|confidentiel|d'acc[eè]s)|mot de passe|mdp|password|solde (du|de mon|de son|bancaire)|(à|en) d[ée]couvert|d[ée]couvert (bancaire|autoris[ée]))\b/i;
/* 21/11/2026 (Radar) : les chiffres d'un crédit (mensualité, restant dû, taux) ne vont pas en mémoire : elle est lue par le serveur MCP,
   que Grok Bot peut joindre (règle du 12/11/2026 : ces chiffres jamais chez les bots). Le Radar les garde à part, sur le serveur seulement. */
const CREDIT = '(?:cr[ée]dit|pr[eê]t (?:immobilier|personnel|auto|travaux|[àa] la consommation)|emprunt|mensualit[ée]s?|restant d[uû]|reste [àa] rembourser|assurance (?:de pr[eê]t|emprunteur)|taux)';
const CREDIT_CHIFFRE = new RegExp('\\b' + CREDIT + '\\b[^\\n]{0,60}\\d|\\d[^\\n]{0,60}\\b' + CREDIT + '\\b', 'i');
export function interdit(t) {
  const s = String(t || '');
  return MOTS.test(s) || /\bFR\d{2}\s?\d{4}/i.test(s) || /\d{12,}/.test(s.replace(/[\s.\-]/g, '')) || CREDIT_CHIFFRE.test(s);
}

export function createMemoire({file, max = 200, maxLen = 300, now = Date.now}) {
  let M = null;
  const load = () => {
    if (M) return M;
    try { M = JSON.parse(fs.readFileSync(file, 'utf8')); if (!M || !Array.isArray(M.items)) M = {items: []}; } catch { M = {items: []}; }
    return M;
  };
  const save = () => { const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(M), {mode: 0o600}); fs.renameSync(tmp, file); };
  const net = (t) => String(t || '').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  function ajouter(texte, source) {
    const t = net(texte).slice(0, maxLen);
    if (t.length < 3) return {ok: false, error: 'Rien à retenir.'};
    if (interdit(t)) return {ok: false, error: 'Rien de bancaire, aucun mot de passe ni code : JARVIS ne retient pas cela.'};
    const m = load(), k = t.toLowerCase(), deja = m.items.find((x) => x.texte.toLowerCase() === k);
    if (deja) return {ok: true, item: deja, deja: true};
    const item = {id: crypto.randomUUID().slice(0, 8), texte: t, at: now(), source: ['discussion', 'rangement'].includes(source) ? source : 'reglages'};
    m.items.push(item); if (m.items.length > max) m.items.splice(0, m.items.length - max);
    save();
    return {ok: true, item};
  }
  function effacer(id) { const m = load(), i = m.items.findIndex((x) => x.id === String(id || '')); if (i < 0) return false; m.items.splice(i, 1); save(); return true; }
  const liste = () => load().items.slice();
  /* une ligne par souvenir, du plus ancien au plus récent */
  const bloc = () => { const it = load().items; return it.length ? it.map((x) => '- ' + x.texte).join('\n') : ''; };
  return {ajouter, effacer, liste, bloc};
}

/* 0.42.0 (choix du 21/11/2026, « Mémoire qui se range seule ») : le journal des discussions avec Claude, gardé sur le serveur
   (DATA/discussions.json, 400 échanges et 30 jours au plus) ; chaque semaine, Claude le relit et propose des choses à retenir */
export function createJournal({file, max = 400, jours = 30, now = Date.now}) {
  let J = null;
  const load = () => { if (J) return J; try { J = JSON.parse(fs.readFileSync(file, 'utf8')); if (!Array.isArray(J)) J = []; } catch { J = []; } return J; };
  const save = () => { const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(J), {mode: 0o600}); fs.renameSync(tmp, file); };
  function noter(q, r) {
    const question = String(q || '').replace(/\s+/g, ' ').trim().slice(0, 600), reponse = String(r || '').replace(/\s+/g, ' ').trim().slice(0, 800);
    if (question.length < 2) return;
    const j = load(), lim = now() - jours * 864e5;
    j.push({at: now(), q: question, r: reponse});
    J = j.filter((x) => x.at >= lim).slice(-max); save();
  }
  const depuis = (t) => load().filter((x) => x.at > (t || 0));
  return {noter, depuis, taille: () => load().length};
}

/* le Profil, en HTML exporté par Drive → texte, sans les parties dont le titre parle d'argent (finances, budget, banque, crédit, épargne) */
const ARGENT = /financ|budget|banqu|bancaire|cr[ée]dit|[ée]pargne|argent|imp[oô]t|salaire|revenu|patrimoine/i;
export function profilTexte(html, maxLen = 6000) {
  const h = String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<head[\s\S]*?<\/head>/i, ' ');
  const parts = h.split(/(?=<h[1-4][^>]*>)/i);
  const texte = (x) => x.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h[1-6]|tr|div)>/gi, '\n').replace(/<li[^>]*>/gi, '- ').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, '’').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  let out = '', retire = 0;
  for (const p of parts) {
    const m = /^<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i.exec(p), titre = m ? texte(m[1]) : '';
    if (titre && ARGENT.test(titre)) { retire++; continue; }
    const t = texte(p); if (t) out += (out ? '\n' : '') + t;
  }
  out = out.split('\n').filter((l) => !interdit(l)).join('\n');   /* une ligne bancaire égarée ailleurs : retirée aussi */
  return {texte: out.length > maxLen ? out.slice(0, maxLen - 1) + '…' : out, retire};
}
