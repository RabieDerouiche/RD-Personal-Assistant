/* JARVIS OS — veilleur de santé du serveur (0.16.0), sans Claude : ce qui casse sans bruit est dit une fois.
   Accès Google retiré ou expiré, Claude Code déconnecté sur le serveur, sauvegarde de Pilotage en panne, Pilotage illisible
   plusieurs fois de suite, notifications refusées par le service de l'appareil. Une notification à l'apparition d'un problème,
   un rappel au plus par 24 heures tant qu'il dure ; le retour à la normale est noté (Suivi), sans notification. */
const DAY = 24 * 3600000;

export function createSante({S, save, push, checks, now = () => Date.now()}) {
  S.sante = Object.assign({items: {}, at: 0}, S.sante || {});
  /* checks : {cle: async () => ({nom, ok, detail, pousser})} ; pousser = false pour ce qui ne peut pas passer par une notification */
  async function tick() {
    const t = now(), found = [];
    for (const [cle, fn] of Object.entries(checks)) {
      let r; try { r = await fn(); } catch (e) { r = null; }
      if (!r) continue;   /* rien à vérifier pour le moment (ex. Google jamais relié) */
      const it = S.sante.items[cle] || {ok: true, since: t};
      if (r.ok !== it.ok) { it.ok = r.ok; it.since = t; it.notifiedAt = 0; }
      it.nom = r.nom; it.detail = r.detail || ''; it.pousser = r.pousser !== false; it.vu = t;
      S.sante.items[cle] = it;
      if (!it.ok && it.pousser && (!it.notifiedAt || t - it.notifiedAt >= DAY)) found.push([cle, it]);
    }
    S.sante.at = t; save();
    if (found.length && S.push && S.push.subs.length) {
      const body = found.map(([, it]) => it.nom + ' : ' + it.detail).join('\n');
      /* 0.70.0 : seule la première lettre passe en minuscule (« JARVIS : accès Google », pas « accès google ») */
      const n0 = String(found[0][1].nom || '');
      await push.send({title: found.length === 1 ? 'JARVIS : ' + n0.charAt(0).toLowerCase() + n0.slice(1) : 'JARVIS : ' + found.length + ' choses à réparer', body, url: '/#voir-sante', tag: 'sante'}, {urgency: 'high'});
      found.forEach(([, it]) => { it.notifiedAt = t; }); save();
    }
    return {problemes: Object.values(S.sante.items).filter((x) => !x.ok).length, notifies: found.length};
  }
  const status = () => ({at: S.sante.at, items: Object.entries(S.sante.items).map(([cle, it]) => ({cle, nom: it.nom, ok: it.ok, detail: it.detail, depuis: it.since}))});
  return {tick, status};
}
