/* JARVIS OS 0.33.0 : l'activité de Claude en direct (choix du propriétaire, 21/11/2026 : « Activité en direct »).
   Chaque Claude lancé par le serveur (mission, Siri, tour, ordre à un bot, tâche Claude, revérification, comparatif, idées,
   discussion de la page) s'inscrit ici avec ce qu'il fait à l'instant : l'outil qu'il utilise (« Recherche web : … »,
   « Agenda : lecture ») et, pour une mission, son plan en étapes (outil TodoWrite de Claude Code). La page le lit
   (GET /api/activite) pour l'accueil, l'orbe et les missions. Rien n'est écrit sur disque : c'est l'instant présent. */
const GENRES = {mission: 'Mission', siri: 'Siri', tour: 'Tour de Claude', bot: 'Ordre à un bot', tache: 'Tâche Claude', verif: 'Revérification',
  comparatif: 'Comparatif d’achats', idees: 'Recherche d’idées', page: 'Discussion', test: 'Essai des données', preparation: 'Discussion (préparation)'};
const court = (s, n = 90) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const hote = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ''); } catch { return 'une page'; } };

/* l'outil de Claude en mots simples (les connecteurs claude.ai s'appellent mcp__claude_ai_<Service>__<outil>) */
export function outilNom(name, input = {}) {
  const n = String(name || ''), i = input || {};
  if (n === 'WebSearch') return 'Recherche web : « ' + court(i.query, 60) + ' »';
  if (n === 'WebFetch') return 'Lecture de ' + hote(i.url);
  if (n === 'TodoWrite') return 'Plan : ' + (Array.isArray(i.todos) ? i.todos.length : 0) + ' étapes';
  if (n === 'Skill') return 'Skill : ' + court(i.skill || i.command || i.name || '', 40);   /* 0.38.0 : une skill relue chargée */
  if (n === 'Read') return 'Lecture d’un document';
  if (n === 'Write' || n === 'Edit' || n === 'MultiEdit') return 'Rédaction';
  if (n === 'Glob' || n === 'Grep') return 'Recherche dans ses fichiers de travail';
  const m = /^mcp__claude_ai_(.+?)__(.+)$/.exec(n);
  if (m) {
    const svc = m[1].replace(/_/g, ' ').replace(/^Google /, ''), op = m[2];
    const quoi = /draft/.test(op) ? 'brouillon' : /search|list|get|read|values|tree/.test(op) ? 'lecture' : 'écriture';
    return ({Gmail: 'Gmail', Calendar: 'Agenda', Sheets: 'Pilotage', Drive: 'Drive', Docs: 'Docs'}[svc] || svc) + ' : ' + quoi;
  }
  return n;
}

export function createActivite({now = Date.now, garde = 20} = {}) {
  const enCours = new Map(); const recent = [];
  let seq = 0;
  function debut({genre, titre, agent = 'claude', modele}) {
    const id = 'a' + (++seq).toString(36) + now().toString(36);
    const a = {id, agent, genre: genre || 'autre', nom: GENRES[genre] || 'Claude', titre: court(titre, 120), modele: modele || '', depuis: now(), etape: '', etapeAt: 0, etapes: null, outils: 0};
    enCours.set(id, a);
    return {
      id,
      etape(texte) { a.etape = court(texte, 100); a.etapeAt = now(); a.outils++; },
      outil(name, input) {
        if (name === 'TodoWrite' && input && Array.isArray(input.todos)) a.etapes = input.todos.slice(0, 12).map((x) => ({t: court(x.content || x.activeForm, 100), s: x.status === 'completed' ? 'fait' : x.status === 'in_progress' ? 'en cours' : 'à faire'}));
        this.etape(outilNom(name, input));
      },
      titre(t) { a.titre = court(t, 120); },
      fin(ok = true) {
        if (!enCours.has(id)) return; enCours.delete(id);
        recent.unshift({...a, fin: now(), ok: !!ok}); recent.splice(garde);
      }
    };
  }
  const etat = () => ({at: now(), enCours: [...enCours.values()].sort((x, y) => x.depuis - y.depuis), recent: recent.slice(0, 8)});
  return {debut, etat};
}
