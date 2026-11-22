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
  /* 0.60.0 (sa demande : « pas besoin d'appui de bouton, il demande la validation oralement si besoin ») : en conversation à la voix,
     les petites choses sont faites aussitôt, le reste se valide de vive voix ; jamais de bouton */
  const toolsSysVoix = (tools) => "Outils. EN CONVERSATION À LA VOIX, Rabie ne touche aucun bouton : tout se fait à la voix. Pour agir, termine ta réponse par une ligne par action, exactement de cette forme, avec un JSON valide sur une seule ligne :\n"
    + '⟦outil ajouter_tache {"titre":"…"}⟧\n'
    + "Deux sortes d'actions. (1) Faites aussitôt, sans lui redemander : ajouter_tache, retenir, programmer_relance, montrer. Dis-le simplement, au présent (« C'est noté : appeler le plombier jeudi. »). "
    + "(2) À valider de vive voix : preparer_ordre, ajouter_echeance, confier_tache_claude, programmer_routine, mettre_a_jour_dossier. Dis exactement ce qui partira (le texte de l'ordre, la date, la routine), puis termine par une question courte (« Je l'envoie ? », « Je la programme ? ») : son « oui » l'exécute aussitôt, son « non » l'annule, sans repasser par toi. "
    + "Ne parle jamais de bouton ni d'appui. S'il manque une information indispensable (la date, le bot, l'objet exact), demande-la d'abord, une seule question à la fois, sans outil. Plusieurs choses demandées d'un coup : une ligne d'outil chacune. N'utilise un outil que si c'est utile.\nOutils disponibles :\n"
    + tools.map((t) => { const sc = t.inputSchema || t.input_schema || {}, req = sc.required || [], pr = sc.properties || {};
      return '- ' + t.name + ' : ' + String(t.description || '') + (Object.keys(pr).length ? ' Champs : ' + Object.keys(pr).map((k) => k + (req.includes(k) ? '' : ' (facultatif)') + (pr[k].description ? ' = ' + pr[k].description : '')).join(' ; ') + '.' : ''); }).join('\n');
  const sansOutils = (t) => t.replace(OUTIL, '').replace(/```\s*```/g, '').replace(/\n{3,}/g, '\n\n').trim();
  /* pendant le flux : les propositions complètes sont retirées, et une proposition encore en cours d'écriture (« ⟦… ») ne s'affiche pas */
  const enCours = (t) => { const s = t.replace(OUTIL, ''), i = s.indexOf('⟦'); return (i >= 0 ? s.slice(0, i) : s).replace(/```\s*$/, '').replace(/\n{3,}/g, '\n\n').trim(); };
  const sysDe = (opts, tools) => (opts.system || BASE_SYS) + (tools.length ? '\n\n' + (opts.voix ? toolsSysVoix(tools) : toolsSys(tools)) : '');
  const outilsDe = (opts) => (Array.isArray(opts.tools) ? opts.tools.filter((t) => t && t.name && typeof t.execute === 'function') : []);
  /* 0.30.0 (Claude instantané) : la réponse arrive mot par mot (SSE) ; conversation = la discussion, dont le serveur garde le Claude ouvert ;
     « Arrêter » (opts.signal) coupe la réponse et Claude avec elle */
  /* 0.57.0 : l'abonnement refusé (message anglais de Claude Code, arrivé comme une réponse) devient une erreur claire, en français */
  const ABO = /can.?t use your Claude subscription|payment is past due|claude\.ai\/settings\/billing/i, ABO_FR = 'Claude ne peut plus utiliser ton abonnement sur le serveur : Anthropic signale un paiement en retard ou un abonnement à renouveler. Vérifie sur claude.ai (Réglages, Facturation) ; si tout est payé, reconnecte Claude sur le serveur (claude auth login, depuis la session Serveur JARVIS).';
  async function flux(input, opts, tools) {
    let r;
    try { r = await fetch(BASE + '/api/sample', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + token()}, signal: opts.signal,
      body: JSON.stringify({input, tier: opts.modelTier || 'default', system: sysDe(opts, tools), stream: true, conv: !!opts.conversation})}); }
    catch (e) { if (opts.signal && opts.signal.aborted) throw {code: 'cancelled', message: 'Arrêté.'}; throw {code: 'tool_error', message: 'Serveur JARVIS injoignable.'}; }
    if (r.status !== 200 || !r.body || !r.body.getReader) {
      let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
      if (r.status === 200 && j.text != null) { if (ABO.test(String(j.text))) throw {code: 'tool_error', message: ABO_FR}; return {text: String(j.text)}; }
      if (j && j.error && ABO.test(String(j.error))) throw {code: 'tool_error', message: ABO_FR};
      throw {code: r.status === 401 ? 'server_not_connected' : 'tool_error', message: (j && j.error) || 'Claude indisponible sur le serveur.'};
    }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', brut = '', fin = null, err = null, modele = '', secours = false;
    try {
      for (;;) {
        const {value, done} = await rd.read(); if (done) break;
        buf += dec.decode(value, {stream: true}); let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const bloc = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
          const m = /^event: (\w+)\ndata: (.*)$/s.exec(bloc); if (!m) continue;
          let d = {}; try { d = JSON.parse(m[2]); } catch (e) { continue; }
          if (m[1] === 'delta') { brut += d.d || ''; if (ABO.test(brut)) continue; if (opts.onText) try { opts.onText({text: enCours(brut), delta: d.d || ''}); } catch (e) { /* rien */ } }
          else if (m[1] === 'done') { fin = String(d.text != null ? d.text : brut); modele = String(d.modele || ''); secours = !!d.secours; }   /* 0.33.0 : le modèle qui a répondu */
          else if (m[1] === 'error') err = String(d.message || 'Claude indisponible sur le serveur.');
        }
      }
    } catch (e) {
      const deja = enCours(brut);
      if (opts.signal && opts.signal.aborted) throw {code: 'cancelled', message: 'Arrêté.', text: deja || undefined};
      throw {code: 'tool_error', message: 'Réponse interrompue.', text: deja || undefined};
    }
    if ((err && ABO.test(err)) || ABO.test(brut) || (fin != null && ABO.test(fin))) throw {code: 'tool_error', message: ABO_FR};
    if (err) throw {code: 'tool_error', message: err, text: enCours(brut) || undefined};
    if (fin == null) throw {code: 'tool_error', message: 'Réponse interrompue.', text: enCours(brut) || undefined};
    return {text: fin, modele, secours};
  }
  const sample = async (input, opts) => {
    opts = opts || {};
    if (!token()) throw {code: 'server_not_connected', message: 'Cet iPhone n’est pas relié au serveur JARVIS (Réglages).'};
    const tools = outilsDe(opts);
    const rep = await flux(input, opts, tools); let text = rep.text;
    if (tools.length) {
      const calls = [...text.matchAll(OUTIL)]; text = sansOutils(text);
      for (const m of calls) {
        const t = tools.find((x) => x.name === m[1]); if (!t) continue;
        let inp; try { inp = JSON.parse(m[2]); } catch (e) { continue; }
        try { await t.execute(inp); } catch (e) { /* proposition incomplète : ignorée */ }
      }
    }
    if (opts.onText) try { opts.onText({text, delta: text}); } catch (e) { /* rien */ }
    return {text, truncated: false, modele: rep.modele || '', secours: !!rep.secours};
  };
  sample.limits = async () => ({tools: true, images: false});
  sample.json = async () => ({});
  /* 0.30.0 : la discussion s'ouvre : le serveur lance Claude et lui donne déjà les données (mêmes consigne et outils que la question) */
  sample.prepare = (input, opts) => { opts = opts || {}; if (!token()) return Promise.resolve(null); return req('/api/sample/prepare', {input, tier: opts.modelTier || 'default', system: sysDe(opts, outilsDe(opts))}).then((r) => r.j).catch(() => null); };
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
    /* 0.27.0 : mise à jour proposée au lancement (comme Panier) — une version plus récente dans le dépôt ? ; l'empreinte du serveur (sans jeton) */
    maj: (force) => req('/api/maj' + (force ? '?force=1' : '')).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    sante0: () => fetch(BASE + '/api/health', {cache: 'no-store'}).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    voiceInstall: () => req('/api/voice/install', {}).then((r) => r.j).catch(() => null),
    /* 0.22.0 : l'écoute Whisper du serveur (bouton de Réglages) et son état */
    ecouteInstall: () => req('/api/ecoute/install', {}).then((r) => r.j).catch(() => null),
    /* 0.23.0 : comparatif des produits suivis (Claude sur le serveur), et ses photos (servies à l'iPhone relié seulement) */
    comparatifs: () => req('/api/comparatifs').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    comparatif: (b) => req('/api/comparatif', b).then((r) => r.j).catch(() => null),
    image: (id) => fetch(BASE + '/api/image/' + encodeURIComponent(id), {headers: {authorization: 'Bearer ' + token()}}).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? URL.createObjectURL(b) : null)).catch(() => null),
    /* 0.24.0 : chercher un produit à partir d'une idée (Claude sur le serveur, avec le web) */
    idees: () => req('/api/idees').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    idee: (b) => req('/api/idees', b).then((r) => r.j).catch(() => null),
    ideeEfface: (id) => req('/api/idees/efface', {id}).then((r) => r.status === 200).catch(() => false),
    ecouteEtat: () => req('/api/ecoute/install').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    /* Raccourcis de l'iPhone (0.13.0) : clé à part pour « Dis Siri, Jarvis » et le bouton Action */
    raccourci: {
      etat: () => req('/api/raccourci/etat').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      cle: () => req('/api/raccourci/cle', {}).then((r) => r.j).catch(() => null),
      retirer: () => req('/api/raccourci/retirer', {}).then((r) => r.j).catch(() => null),
      essai: (texte) => fetch(BASE + '/api/raccourci', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + token()}, body: JSON.stringify({texte})}).then((r) => r.text()).catch(() => 'Serveur injoignable.'),
      /* 0.43.0 : une action sans IA, comme l'appellera une automatisation de l'iPhone */
      action: (action) => fetch(BASE + '/api/raccourci', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + token()}, body: JSON.stringify({action})}).then((r) => r.text()).catch(() => 'Serveur injoignable.')
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
    mission: (texte, parent) => req('/api/mission', parent ? {texte, parent} : {texte}).then((r) => { try { if (r.j && r.j.ok && window.JarvisActivite) setTimeout(window.JarvisActivite, 300); } catch (e) { /* rien */ } return r.j; }).catch(() => ({ok: false, error: 'Serveur injoignable.'})),   /* 0.33.0 : visible tout de suite dans l'activité */
    /* cartes mises de côté (0.20.0) : liste, ajout (avec ou sans date de retour), retrait */
    cote: {
      liste: () => req('/api/cote').then((r) => (r.status === 200 ? r.j.cartes : null)).catch(() => null),
      ajouter: (o) => req('/api/cote', o).then((r) => r.j).catch(() => ({ok: false, error: 'Serveur injoignable.'})),
      retirer: (id) => req('/api/cote/retirer', {id}).then((r) => r.j).catch(() => null)
    },
    /* revérifier (0.19.0) : papiers ou mails, sur une demande d'un bot ; résultat par notification */
    verifier: (ou, demande) => req('/api/verifier', {ou, demande}).then((r) => r.j).catch(() => ({ok: false, error: 'Serveur injoignable.'})),
    /* relances (0.18.0) et consommation de Claude (0.18.0) */
    relances: () => req('/api/relances').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    relance: (o) => req('/api/relance', o).then((r) => r.j).catch(() => ({ok: false, error: 'Serveur injoignable.'})),
    relanceAnnuler: (id) => req('/api/relance/annuler', {id}).then((r) => r.j).catch(() => null),
    conso: () => req('/api/conso').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    missions: () => req('/api/missions').then((r) => (r.status === 200 ? r.j.missions : null)).catch(() => null),
    /* 0.33.0 : ce que fait Claude à l'instant (missions, Siri, tour, discussion), avec l'outil utilisé et le plan d'une mission */
    activite: () => req('/api/activite').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    /* 0.41.0 : les routines planifiées et le brief du matin */
    routines: {
      liste: () => req('/api/routines').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      lire: (phrase) => req('/api/routines/lire', {phrase}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      ajouter: (o) => req('/api/routines', o).then((r) => r.j).catch(() => ({ok: false, error: 'Serveur injoignable.'})),
      modifier: (id, o) => req('/api/routines/' + encodeURIComponent(id), o).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      supprimer: (id) => req('/api/routines/' + encodeURIComponent(id), null, 'DELETE').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      maintenant: (id) => req('/api/routines/' + encodeURIComponent(id) + '/maintenant', {}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null)
    },
    brief: {
      lire: () => req('/api/brief').then((r) => (r.status === 200 ? r.j.brief : null)).catch(() => null),
      maintenant: () => req('/api/brief/maintenant', {}).then((r) => (r.status === 200 ? r.j.brief : null)).catch(() => null)
    },
    /* 0.40.0 : la voix Google Chirp 3 HD (plafonnée sous la part gratuite) */
    voixGoogle: {
      etat: () => req('/api/voix/google').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      voix: () => req('/api/voix/google/voix').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      choisir: (o) => req('/api/voix/google', o).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      cle: (cle) => req('/api/voix/google/cle', {cle}).then((r) => r.j).catch(() => ({error: 'Serveur injoignable.'})),
      retirer: () => req('/api/voix/google/cle', {retirer: true}).then((r) => r.j).catch(() => null),
      essai: async (nom) => { try { const r = await fetch(BASE + '/api/voix/google/essai', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + token()}, body: JSON.stringify({nom})}); if (r.ok) return URL.createObjectURL(await r.blob()); const j = await r.json().catch(() => ({})); return {error: j.error || 'Pas de son de Google.'}; } catch (e) { return {error: 'Serveur injoignable.'}; } },
      verifier: () => req('/api/voix/google/verifier', {}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),   /* 0.47.0 : une vraie phrase demandée à Google (comptée) */
      relancer: () => req('/api/voix/google/relancer', {}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null)   /* 0.48.0 : après une alerte de budget de Google Cloud, lui seul relance Google */
    },
    /* 0.39.0 : le serveur MCP (assistants reliés : app Claude, Grok Bot) et l'accord sur une proposition venue d'eux */
    mcp: {
      etat: () => req('/api/mcp').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      decider: (id, oui) => req('/api/mcp/decider', {id, oui}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      retirer: (id) => req('/api/mcp/retirer', {id}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      jeton: (nom) => req('/api/mcp/jeton', {nom}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null)
    },
    missionStatut: (id, status) => req('/api/missions/' + encodeURIComponent(id), {status}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    /* 0.38.0 : les skills relues des missions */
    skills: () => req('/api/skills').then((r) => (r.status === 200 ? r.j.skills : null)).catch(() => null),
    /* 0.37.0 : la mémoire durable (ce qu'il a demandé de retenir, et l'état de son Profil) */
    /* Radar (21/11/2026) : dépenses fixes, paie, reste à payer, dépenses trouvées dans les mails ; les montants restent sur le serveur */
    radar: () => req('/api/radar').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    radarSet: (cle, valeur) => req('/api/radar/set', {cle, valeur}).then((r) => { if (r.status !== 200) throw new Error((r.j && r.j.error) || 'Refusé'); return r.j; }),
    radarProposition: (id, oui, modif) => req('/api/radar/proposition', {id, oui, modif: modif || null}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    radarLire: () => req('/api/radar/lire', {}).then((r) => r.j || null).catch(() => null),
    /* 0.57.0 : ses invitations (un proche qui lui envoie des tâches) */
    invites: {liste: () => req('/api/invites').then((r) => (r.status === 200 ? r.j.invites : null)).catch(() => null), creer: (nom) => req('/api/invites', {nom}).then((r) => r.j).catch(() => null),
      retirer: (id) => req('/api/invites/' + id, null, 'DELETE').then((r) => r.status === 200).catch(() => false)},
    radarAlerte: (id, action) => req('/api/radar/alerte', {id, action}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),   /* 0.56.0 : Retirer / Garder une dépense qui finit */
    memoire: {
      liste: () => req('/api/memoire').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      ajouter: (texte, source) => req('/api/memoire', {texte, source}).then((r) => r.j).catch(() => ({ok: false, error: 'Serveur injoignable.'})),
      effacer: (id) => req('/api/memoire/efface', {id}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      profil: () => req('/api/memoire/profil', {}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      /* 0.42.0 : la mémoire qui se range seule */
      ranger: () => req('/api/memoire/ranger', {}).then((r) => r.j).catch(() => null),
      proposition: (id, oui) => req('/api/memoire/proposition', {id, oui}).then((r) => r.j).catch(() => null)
    },
    /* 0.36.0 : réponse instantanée du serveur, sans IA (heure, date, météo, agenda, ce qui t'attend, un bot), ou null : Claude répond */
    rapide: (text, pos) => req('/api/rapide', Object.assign({text}, pos && isFinite(pos.lat) && isFinite(pos.lon) ? {lat: pos.lat, lon: pos.lon} : {})).then((r) => (r.status === 200 && r.j && r.j.reply ? r.j : null)).catch(() => null),
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
