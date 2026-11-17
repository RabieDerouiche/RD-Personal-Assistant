/* JARVIS OS : la page Jarvis branchée sur le serveur du propriétaire, à la place des données d'exemple.
   Elle garde l'interface `window.claude.use(...)` de la page claude.ai :
   - « mcp » : chaque outil (Google Sheets, Google Calendar, Gmail) part vers POST /api/tool, que le serveur traduit
     en appel direct aux API Google (accès créé et collé par le propriétaire, jamais vu par Claude) ;
   - « sample » : Claude de l'abonnement, par POST /api/sample (un appel ponctuel). Claude n'y a aucun outil : ses propositions
     (ordre à un bot, tâche, échéance, mise à jour d'un dossier, tâche Claude) arrivent en fin de réponse sous la forme
     ⟦outil nom {json}⟧ ; le pont les retire du texte et les passe aux outils de la page, qui les affichent avec leur bouton.
     Rien ne part sans son appui, et une seule question = un seul appel (16/11/2026) ;
   - « Confier à la tâche Claude » (fire_trigger) : fait par le serveur lui-même (POST /api/tool), sans clé ;
   - « tts » et « dictation » : absents ici, la voix passe par l'orbe (page vocale JARVIS).
   L'appairage est celui de l'app JARVIS sur le même serveur (localStorage « jarvis.settings »). */
(function () {
  'use strict';
  const KEY = 'jarvis.settings';
  const settings = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const BASE = location.origin;
  const token = () => settings().serverToken || '';
  const req = async (p, body, method) => {
    const r = await fetch(BASE + p, {method: method || (body ? 'POST' : 'GET'), headers: {'content-type': 'application/json', authorization: 'Bearer ' + token()}, body: body ? JSON.stringify(body) : undefined});
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
    return {status: r.status, j};
  };
  const fail = (code, server, message) => { throw {code, server, message: message || code}; };

  async function callTool(server, tool, input) {
    if (!token()) fail('server_not_connected', server, 'Cet iPhone n’est pas relié au serveur JARVIS (Réglages).');
    let r;
    try { r = await req('/api/tool', {server, tool, input: input || {}}); } catch (e) { fail('tool_error', server, 'Serveur JARVIS injoignable.'); }
    if (r.status === 401) fail('server_not_connected', server, 'Cet iPhone n’est plus relié au serveur JARVIS (Réglages).');
    if (r.j && r.j.error) fail(r.j.error.code || 'tool_error', server, r.j.error.message);
    return {payload: r.j.payload, content: []};
  }
  const mcp = {
    callTool,
    watchTool(server, tool, input, handler, opts) {
      let stop = false, timer = 0;
      const run = async () => {
        if (stop) return;
        try { const res = await callTool(server, tool, input); if (!stop) handler({type: 'data', result: Object.assign(res, {cache: {storedAt: Date.now(), revalidating: false}})}); }
        catch (e) { if (!stop) handler({type: 'error', error: e}); }
      };
      run();
      if (opts && opts.refetchInterval) timer = setInterval(run, Math.max(15000, opts.refetchInterval));
      return () => { stop = true; clearInterval(timer); };
    },
    describeTool: async (server, tool) => (tool === 'unlabel_thread' ? {name: tool, description: '', inputSchema: {type: 'object', properties: {threadId: {type: 'string'}, labelIds: {type: 'array', items: {type: 'string'}}}}} : {name: tool, description: '', inputSchema: {type: 'object', properties: {}}}),
    listTools: async () => ({servers: [
      {name: 'Google Sheets', tools: ['get_values', 'append_values', 'update_values']},
      {name: 'Google Calendar', tools: ['list_events', 'create_event', 'update_event', 'delete_event']},
      {name: 'Gmail', tools: ['search_threads', 'get_thread', 'list_drafts', 'send_message', 'delete_draft', 'unlabel_thread']},
      {name: 'Claude Code Remote', tools: ['fire_trigger']}]})
  };
  /* outils de la page pour Claude : décrits dans la consigne, appelés depuis le texte de sa réponse */
  const BASE_SYS = 'Tu réponds au propriétaire dans sa page Jarvis (JARVIS OS), en français, en le tutoyant. Réponds exactement au format demandé.';
  const OUTIL = /⟦\s*outil\s+([a-z_]+)\s*(\{[\s\S]*?\})\s*⟧/g;
  const toolsSys = (tools) => 'Outils (des propositions seulement : la page les affiche avec un bouton, rien ne part sans son appui). Pour en utiliser un, termine ta réponse par une ligne par proposition, exactement de cette forme, avec un JSON valide sur une seule ligne :\n'
    + '⟦outil preparer_ordre {"bot":"Iris","message":"…"}⟧\n'
    + "N'écris jamais qu'une proposition est envoyée, ajoutée ou faite : dis qu'elle attend son bouton. N'utilise un outil que si c'est utile.\nOutils disponibles :\n"
    + tools.map((t) => { const sc = t.inputSchema || t.input_schema || {}, req = sc.required || [], pr = sc.properties || {};
      return '- ' + t.name + ' : ' + String(t.description || '') + (Object.keys(pr).length ? ' Champs : ' + Object.keys(pr).map((k) => k + (req.includes(k) ? '' : ' (facultatif)') + (pr[k].description ? ' = ' + pr[k].description : '')).join(' ; ') + '.' : ''); }).join('\n');
  const sansOutils = (t) => t.replace(OUTIL, '').replace(/```\s*```/g, '').replace(/\n{3,}/g, '\n\n').trim();
  const sample = async (input, opts) => {
    opts = opts || {};
    if (!token()) throw {code: 'server_not_connected', message: 'Cet iPhone n’est pas relié au serveur JARVIS (Réglages).'};
    const tools = Array.isArray(opts.tools) ? opts.tools.filter((t) => t && t.name && typeof t.execute === 'function') : [];
    const r = await req('/api/sample', {input, tier: opts.modelTier || 'default', system: (opts.system || BASE_SYS) + (tools.length ? '\n\n' + toolsSys(tools) : '')});
    if (r.status !== 200) throw {code: r.status === 401 ? 'server_not_connected' : 'tool_error', message: (r.j && r.j.error) || 'Claude indisponible sur le serveur.'};
    let text = String(r.j.text || '');
    if (tools.length) {
      const calls = [...text.matchAll(OUTIL)]; text = sansOutils(text);
      for (const m of calls) {
        const t = tools.find((x) => x.name === m[1]); if (!t) continue;
        let inp; try { inp = JSON.parse(m[2]); } catch (e) { continue; }
        try { await t.execute(inp); } catch (e) { /* proposition incomplète : ignorée */ }
      }
    }
    if (opts.onText) try { opts.onText({text, delta: text}); } catch (e) { /* rien */ }
    return {text, truncated: false};
  };
  sample.limits = async () => ({tools: true, images: false});
  sample.json = async () => ({});
  window.claude = {use: async (name) => (name === 'mcp' ? mcp : name === 'sample' ? sample : null)};

  /* pour l'écran Réglages de la page : appairage et accès Google */
  window.JarvisServeur = {
    base: BASE,
    linked: () => !!token(),
    async pair(code) {
      const r = await fetch(BASE + '/api/pair', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({code: String(code || '').trim(), device: 'JARVIS OS'})});
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.token) return {ok: false, error: j.error || 'Code refusé.'};
      const s = settings(); s.serverUrl = BASE; s.serverToken = j.token;
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { return {ok: false, error: 'Stockage du téléphone indisponible.'}; }
      return {ok: true};
    },
    unpair() { const s = settings(); s.serverToken = ''; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* rien */ } },
    google: () => req('/api/google').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    googleConfig: (clientId, clientSecret) => req('/api/google/config', {clientId, clientSecret}).then((r) => r.j),
    googleLink: () => req('/api/google/link', {}).then((r) => r.j),
    googleUnlink: () => req('/api/google/unlink', {}).then((r) => r.j),
    status: () => req('/api/status').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    update: () => req('/api/update', {}).then((r) => r.j).catch(() => ({ok: false, message: 'Serveur injoignable.'})),
    voiceInstall: () => req('/api/voice/install', {}).then((r) => r.j).catch(() => null),
    /* Raccourcis de l'iPhone (0.13.0) : clé à part pour « Dis Siri, Jarvis » et le bouton Action */
    raccourci: {
      etat: () => req('/api/raccourci/etat').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      cle: () => req('/api/raccourci/cle', {}).then((r) => r.j).catch(() => null),
      retirer: () => req('/api/raccourci/retirer', {}).then((r) => r.j).catch(() => null),
      essai: (texte) => fetch(BASE + '/api/raccourci', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + token()}, body: JSON.stringify({texte})}).then((r) => r.text()).catch(() => 'Serveur injoignable.')
    },
    /* sauvegarde de Pilotage (0.14.0) : état, ce qui a changé, copie immédiate */
    sauvegarde: {
      etat: () => req('/api/sauvegarde').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      maintenant: () => req('/api/sauvegarde/maintenant', {}).then((r) => r.j).catch(() => ({ok: false, error: 'Serveur injoignable.'}))
    },
    /* veilleur de santé du serveur (0.16.0) : accès Google, Claude, sauvegarde, lecture de Pilotage, notifications */
    sante: () => req('/api/sante').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    santeMaintenant: () => req('/api/sante/maintenant', {}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    /* missions de Claude (0.15.0) : lancer une mission longue, suivre les dernières ; notification à la fin */
    mission: (texte, parent) => req('/api/mission', parent ? {texte, parent} : {texte}).then((r) => r.j).catch(() => ({ok: false, error: 'Serveur injoignable.'})),
    /* relances (0.18.0) et consommation de Claude (0.18.0) */
    relances: () => req('/api/relances').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    relance: (o) => req('/api/relance', o).then((r) => r.j).catch(() => ({ok: false, error: 'Serveur injoignable.'})),
    relanceAnnuler: (id) => req('/api/relance/annuler', {id}).then((r) => r.j).catch(() => null),
    conso: () => req('/api/conso').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    missions: () => req('/api/missions').then((r) => (r.status === 200 ? r.j.missions : null)).catch(() => null),
    /* tour de Claude (0.15.0) : réglage, dernier tour, tour immédiat */
    tour: {
      etat: () => req('/api/tour').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      regler: (every) => req('/api/tour', {every}).then((r) => r.j).catch(() => null),
      maintenant: () => req('/api/tour/maintenant', {}).then((r) => r.j).catch(() => ({ok: false, texte: 'Serveur injoignable.'}))
    },
    /* notifications (0.12.0) : abonnement de cet appareil, essai, préférences */
    push: {
      status: () => req('/api/push').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      subscribe: (subscription) => req('/api/push/subscribe', {subscription}).then((r) => r.j).catch(() => ({ok: false, error: 'Serveur injoignable.'})),
      unsubscribe: (endpoint) => req('/api/push/unsubscribe', {endpoint}).then((r) => r.j).catch(() => null),
      test: () => req('/api/push/test', {}).then((r) => r.j).catch(() => ({ok: false})),
      prefs: (p) => req('/api/push/prefs', p).then((r) => r.j).catch(() => null)
    },
    /* réglages de la voix, partagés avec la page vocale (même stockage que l'app JARVIS) */
    setting: (k) => settings()[k],
    set(k, v) { const s = settings(); s[k] = v; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* rien */ } }
  };
})();
