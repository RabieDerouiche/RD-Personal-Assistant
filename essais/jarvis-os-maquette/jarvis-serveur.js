/* JARVIS OS : la page Jarvis branchée sur le serveur du propriétaire, à la place des données d'exemple.
   Elle garde l'interface `window.claude.use(...)` de la page claude.ai :
   - « mcp » : chaque outil (Google Sheets, Google Calendar, Gmail) part vers POST /api/tool, que le serveur traduit
     en appel direct aux API Google (accès créé et collé par le propriétaire, jamais vu par Claude) ;
   - « sample » : Claude de l'abonnement, par POST /api/sample (appel ponctuel, sans aucun outil) ;
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
      {name: 'Gmail', tools: ['search_threads', 'get_thread', 'list_drafts', 'send_message', 'delete_draft', 'unlabel_thread']}]})
  };
  const sample = async (input, opts) => {
    opts = opts || {};
    if (!token()) throw {code: 'server_not_connected', message: 'Cet iPhone n’est pas relié au serveur JARVIS (Réglages).'};
    const r = await req('/api/sample', {input, tier: opts.modelTier || 'default', system: opts.system || ''});
    if (r.status !== 200) throw {code: r.status === 401 ? 'server_not_connected' : 'tool_error', message: (r.j && r.j.error) || 'Claude indisponible sur le serveur.'};
    const text = String(r.j.text || '');
    if (opts.onText) try { opts.onText({text, delta: text}); } catch (e) { /* rien */ }
    return {text, truncated: false};
  };
  sample.limits = async () => ({tools: false, images: false});
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
    /* réglages de la voix, partagés avec la page vocale (même stockage que l'app JARVIS) */
    setting: (k) => settings()[k],
    set(k, v) { const s = settings(); s[k] = v; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* rien */ } }
  };
})();
