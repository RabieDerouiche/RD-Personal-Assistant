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
  /* 0.73.0 : un réseau coupé ou un serveur injoignable donne un message en français (avant : « Load failed » de Safari, affiché tel quel) */
  const req = async (p, body, method) => {
    let r;
    try { r = await fetch(BASE + p, {method: method || (body ? 'POST' : 'GET'), headers: {'content-type': 'application/json', authorization: 'Bearer ' + token()}, body: body ? JSON.stringify(body) : undefined}); }
    catch (e) { throw new Error('Serveur JARVIS injoignable'); }
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
    if (r.status === 423 && j && j.verrou) montrerVerrou();   /* 0.75.0 : le serveur est verrouillé pour cet appareil */
    if (r.status === 401 && j && j.error === 'Appareil non relié.') montrerPorte();   /* 0.82.0 : jeton absent, retiré ou périmé : la porte, pas l'app vide */
    return {status: r.status, j};
  };
  const fail = (code, server, message) => { throw {code, server, message: message || code}; };

  async function callTool(server, tool, input) {
    if (!token()) fail('server_not_connected', server, 'Cet iPhone n’est pas relié au serveur JARVIS (Réglages).');
    let r;
    try { r = await req('/api/tool', {server, tool, input: input || {}}); } catch (e) { fail('tool_error', server, 'Serveur JARVIS injoignable.'); }
    if (r.status === 401) fail('server_not_connected', server, 'Cet iPhone n’est plus relié au serveur JARVIS (Réglages).');
    /* 0.73.0 : l'erreur du serveur peut être une simple phrase ; et une réponse qui n'est pas 200 (Caddy en 502 pendant un redémarrage, corps vide)
       n'est jamais un succès : avant, l'écriture ou l'envoi étaient annoncés « faits » alors que rien n'était parti */
    const er = r.j && r.j.error;
    if (er) fail((typeof er === 'object' && er.code) || 'tool_error', server, (typeof er === 'object' ? er.message : String(er)) || 'Erreur du serveur JARVIS.');
    if (r.status !== 200) fail('upstream_error', server, 'Serveur JARVIS indisponible (' + r.status + ') : rien n’est fait, réessaie dans un moment.');
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
    + "Deux sortes d'actions. (1) Faites aussitôt, sans lui redemander : ajouter_tache, terminer_tache, reporter_tache, retenir, programmer_relance, montrer. Dis-le simplement, au présent (« C'est noté : appeler le plombier jeudi. »). "
    + "(2) À valider de vive voix : preparer_ordre, ajouter_echeance, supprimer_tache, confier_tache_claude, programmer_routine, mettre_a_jour_dossier. Dis exactement ce qui partira (le texte de l'ordre, la date, la routine), puis termine par une question courte (« Je l'envoie ? », « Je la programme ? ») : son « oui » l'exécute aussitôt, son « non » l'annule, sans repasser par toi. "
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
  /* 0.73.0 : seulement le message de Claude Code lui-même (court, qui parle de « Claude subscription ») ; une vraie réponse qui cite
     « payment is past due » (un mail de relance en anglais) ou donne le lien de facturation passe telle quelle */
  const estAbo = (t) => { t = String(t || ''); return t.length < 600 && /Claude subscription/i.test(t) && ABO.test(t); };
  async function flux(input, opts, tools) {
    let r;
    try { r = await fetch(BASE + '/api/sample', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + token()}, signal: opts.signal,
      body: JSON.stringify({input, tier: opts.modelTier || 'default', system: sysDe(opts, tools), stream: true, conv: !!opts.conversation})}); }
    catch (e) { if (opts.signal && opts.signal.aborted) throw {code: 'cancelled', message: 'Arrêté.'}; throw {code: 'tool_error', message: 'Serveur JARVIS injoignable.'}; }
    if (r.status !== 200 || !r.body || !r.body.getReader) {
      let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
      if (r.status === 200 && j.text != null) { if (estAbo(j.text)) throw {code: 'tool_error', message: ABO_FR}; return {text: String(j.text)}; }
      if (j && j.error && estAbo(j.error)) throw {code: 'tool_error', message: ABO_FR};
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
          if (m[1] === 'delta') { brut += d.d || ''; if (estAbo(brut)) continue; if (opts.onText) try { opts.onText({text: enCours(brut), delta: d.d || ''}); } catch (e) { /* rien */ } }
          else if (m[1] === 'done') { fin = String(d.text != null ? d.text : brut); modele = String(d.modele || ''); secours = !!d.secours; }   /* 0.33.0 : le modèle qui a répondu */
          else if (m[1] === 'error') err = String(d.message || 'Claude indisponible sur le serveur.');
        }
      }
    } catch (e) {
      const deja = enCours(brut);
      if (opts.signal && opts.signal.aborted) throw {code: 'cancelled', message: 'Arrêté.', text: deja || undefined};
      throw {code: 'tool_error', message: 'Réponse interrompue.', text: deja || undefined};
    }
    if ((err && estAbo(err)) || estAbo(brut) || (fin != null && estAbo(fin))) throw {code: 'tool_error', message: ABO_FR};
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
  const INJ = 'Serveur JARVIS injoignable : vérifie le réseau, puis réessaie.', INDISPO = 'Serveur JARVIS indisponible pour l’instant (il redémarre peut-être) : réessaie dans un moment.';
  const repOk = (r) => (r.status >= 500 && !(r.j && r.j.error) ? {ok: false, error: INDISPO} : r.j);
  /* 0.75.0 (ses choix du 24/11/2026 : « Face ID à chaque ouverture », « Tout dans NordPass ») : le verrou de l'app par passkey.
     Le serveur garde l'ouverture, liée à cet appareil : rien de plus n'est confié à l'app. Ici : la preuve (WebAuthn, Face ID), l'écran
     « JARVIS est verrouillé », et le verrouillage demandé à chaque lancement de l'app (pas à un simple rechargement : « jarvis.ouverture »
     vit le temps de l'app, dans sessionStorage). « jarvis.verrou » (localStorage) retient seulement que le verrou est actif, pour poser
     l'écran avant toute demande. Le serveur reverrouille seul après 5 minutes sans demande (l'app à l'arrière-plan). */
  const VKEY = 'jarvis.verrou', SKEY = 'jarvis.ouverture';
  const mem = (v) => { try { if (v === undefined) return sessionStorage.getItem(SKEY) === '1'; if (v) sessionStorage.setItem(SKEY, '1'); else sessionStorage.removeItem(SKEY); } catch (e) { /* stockage refusé */ } return false; };
  const drapeau = (v) => { try { if (v === undefined) return localStorage.getItem(VKEY) === '1'; if (v) localStorage.setItem(VKEY, '1'); else localStorage.removeItem(VKEY); } catch (e) { /* stockage refusé */ } return false; };
  const enB = (b) => { const o = new Uint8Array(b); let t = ''; for (let i = 0; i < o.length; i++) t += String.fromCharCode(o[i]); return btoa(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const deB = (t) => { const b = atob(String(t).replace(/-/g, '+').replace(/_/g, '/')), o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; };
  const refusPasskey = (e) => (e && e.name === 'NotAllowedError' ? 'Face ID annulé ou refusé.' : e && e.name === 'InvalidStateError' ? 'Cette passkey existe déjà sur cet appareil.' : 'La passkey n’a pas répondu sur cet appareil.');
  const verrou = {
    possible: () => !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create && navigator.credentials.get),
    etat: () => req('/api/verrou').then((r) => (r.j && typeof r.j.actif === 'boolean' ? r.j : null)).catch(() => null),
    /* prouver une passkey : Face ID, puis le serveur vérifie la signature et ouvre cet appareil */
    async prouver() {
      let o; try { o = await req('/api/verrou/defi'); } catch (e) { return {error: INJ}; }
      if (o.status !== 200 || !o.j.challenge) return {error: (o.j && o.j.error) || INDISPO};
      let c; enPreuve = true; preuves++;
      try { c = await navigator.credentials.get({publicKey: {challenge: deB(o.j.challenge), rpId: o.j.rpId, allowCredentials: o.j.allowCredentials.map((x) => ({type: 'public-key', id: deB(x.id)})), userVerification: 'required', timeout: o.j.timeout}}); }
      catch (e) { return {error: refusPasskey(e), refus: true}; }
      finally { enPreuve = false; }
      if (!c || !c.response) return {error: 'La passkey n’a pas répondu sur cet appareil.'};
      let r; try { r = await req('/api/verrou/ouvrir', {id: enB(c.rawId), clientData: enB(c.response.clientDataJSON), authData: enB(c.response.authenticatorData), signature: enB(c.response.signature)}); } catch (e) { return {error: INJ}; }
      if (r.status !== 200) return {error: (r.j && r.j.error) || 'Preuve refusée.'};
      mem(true); return r.j;
    },
    /* créer une passkey (elle ne compte qu'après sa première preuve) */
    async creer(nom) {
      let o; try { o = await req('/api/verrou/creer'); } catch (e) { return {error: INJ}; }
      if (o.status !== 200 || !o.j.challenge) return {error: (o.j && o.j.error) || INDISPO};
      let c;
      try { c = await navigator.credentials.create({publicKey: {...o.j, challenge: deB(o.j.challenge), user: {...o.j.user, id: deB(o.j.user.id)}, excludeCredentials: (o.j.excludeCredentials || []).map((x) => ({type: 'public-key', id: deB(x.id)}))}}); }
      catch (e) { return {error: refusPasskey(e)}; }
      if (!c || !c.response || !c.response.attestationObject) return {error: 'La passkey n’a pas été créée.'};
      let r; try { r = await req('/api/verrou/creer', {clientData: enB(c.response.clientDataJSON), attestation: enB(c.response.attestationObject), nom: nom || ''}); } catch (e) { return {error: INJ}; }
      return r.status === 200 ? r.j : {error: (r.j && r.j.error) || 'Passkey refusée.'};
    },
    activer: () => req('/api/verrou/activer', {}).then((r) => { if (r.status === 200) { drapeau(true); return r.j; } return {error: (r.j && r.j.error) || 'Refusé.'}; }).catch(() => ({error: INJ})),
    desactiver: () => req('/api/verrou/desactiver', {}).then((r) => { if (r.status === 200) { drapeau(false); return r.j; } return {error: (r.j && r.j.error) || 'Refusé.'}; }).catch(() => ({error: INJ})),
    delai: (n) => req('/api/verrou/delai', {delai: n}).then((r) => { if (r.status === 200) { delaiConnu = r.j.delai; return r.j; } return {error: (r.j && r.j.error) || 'Refusé.'}; }).catch(() => ({error: INJ})),
    retirer: (id) => req('/api/verrou/retirer', {id}).then((r) => (r.status === 200 ? r.j : {error: (r.j && r.j.error) || 'Refusé.'})).catch(() => ({error: INJ})),
    verrouiller: () => req('/api/verrou/verrouiller', {}).then(() => { mem(false); preuves = 0; autoFait = true; montrerVerrou(); return true; }).catch(() => false)   /* verrouillé à la main : Face ID ne repart pas tout seul */
  };
  /* 0.76.0 (son retour du 24/11/2026) : Face ID part tout seul dès que l'écran de verrou paraît (Safari peut l'interdire sans un toucher :
     le bouton reste alors le secours, sans message), et l'app se reverrouille quand il revient après plus que le délai réglé (1 minute
     par défaut). Le serveur tient le même compte : la page le prévient quand elle passe à l'arrière-plan. Safari accorde une demande de
     passkey sans toucher par chargement de page : si celle de cette page a déjà servi, la page se recharge avant de poser l'écran. */
  let ecran = null, enPreuve = false, preuves = 0, autoFait = false, cacheLe = 0, delaiConnu = 60;
  const visible = () => document.visibilityState !== 'hidden';
  const etatEcran = (e) => { if (!ecran) return; ecran.dataset.etat = e; ecran.querySelector('.vx-etat').textContent = e === 'scan' ? 'Vérification de ton identité…' : 'JARVIS est verrouillé'; };
  async function ouvrirVerrou(auto) {
    if (!ecran || enPreuve) return;
    const btn = ecran.querySelector('#verrou-ouvrir'), msg = ecran.querySelector('[role=status]');
    if (!verrou.possible()) { etatEcran('attente'); if (!auto) msg.textContent = 'Cet appareil ne sait pas présenter de passkey ici.'; return; }
    btn.disabled = true; msg.textContent = ''; etatEcran('scan');
    const t0 = Date.now(), r = await verrou.prouver();
    if (r && !r.error) { ecran.querySelector('.vx-etat').textContent = 'Bienvenue.'; location.reload(); return; }
    btn.disabled = false;
    if (auto && r && r.refus && Date.now() - t0 < 900 && !autoRedit && visible()) { autoRedit = true; setTimeout(() => ouvrirVerrou(true), 900); return; }   /* refus immédiat (page pas encore au premier plan) : un second essai */
    etatEcran('attente');
    if (!auto) msg.textContent = (r && r.error) || 'Le serveur ne répond pas.';
  }
  let autoRedit = false;
  const autoVerrou = () => { if (ecran && !autoFait && !enPreuve && visible()) { autoFait = true; setTimeout(() => ouvrirVerrou(true), 350); } };
  /* le style des deux écrans d'accueil (verrou, porte d'un appareil pas relié) */
  function styleAccueil() {
    if (!document.getElementById('verrou-style')) {
      const st = document.createElement('style'); st.id = 'verrou-style';
      st.textContent = '#verrou-ecran{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:calc(env(safe-area-inset-top,0px) + 30px) 28px calc(env(safe-area-inset-bottom,0px) + 34px);background:radial-gradient(120% 80% at 50% 36%,#0c1d3a 0%,#070b16 48%,#04060c 100%);color:#e6edf7;font:500 16px/1.5 var(--sans,system-ui,-apple-system,sans-serif);text-align:center;overflow:hidden}'
        + '#verrou-ecran .vx-marque{font:600 15px var(--logo,var(--display,system-ui,sans-serif));letter-spacing:.44em;text-indent:.44em;color:#9ecbff}'
        + '#verrou-ecran .vx-centre{display:flex;flex-direction:column;align-items:center;gap:20px}'
        + '#verrou-ecran .vx-orbe{position:relative;width:min(54vw,230px);aspect-ratio:1;display:grid;place-items:center}'
        + '#verrou-ecran .vx-orbe::before{content:"";position:absolute;inset:-10%;border-radius:50%;background:radial-gradient(circle,rgba(56,189,248,.30),rgba(56,189,248,0) 64%)}'
        + '#verrou-ecran .vx-orbe img{position:relative;width:100%;height:100%;border-radius:50%;object-fit:cover;-webkit-mask-image:radial-gradient(circle,#000 54%,transparent 70%);mask-image:radial-gradient(circle,#000 54%,transparent 70%);animation:vx-souffle 4.6s ease-in-out infinite}'
        + '#verrou-ecran .vx-orbe::after{content:"";position:absolute;inset:6%;border-radius:50%;border:2px solid transparent;border-top-color:#38bdf8;border-right-color:rgba(168,85,247,.75);opacity:0;transition:opacity .3s}'
        + '#verrou-ecran[data-etat=scan] .vx-orbe::after{opacity:1;animation:vx-tour 1.15s linear infinite}'
        + '#verrou-ecran .vx-salut{margin:0;font:700 31px/1.15 var(--display,system-ui,sans-serif)}'
        + '#verrou-ecran .vx-date{margin:0;color:#9fb0c8;font-size:15px}'
        + '#verrou-ecran .vx-etat{margin:6px 0 0;min-height:1.5em;color:#7dd3fc;font-size:14px;letter-spacing:.03em}'
        + '#verrou-ecran .vx-bas{display:flex;flex-direction:column;align-items:center;gap:10px;min-height:104px;width:100%}'
        + '#verrou-ouvrir{appearance:none;-webkit-appearance:none;border:0;border-radius:999px;width:min(100%,320px);padding:15px 26px;font:600 16px var(--sans,system-ui,sans-serif);color:#fff;background:linear-gradient(90deg,#0ea5e9,#a855f7);cursor:pointer;transition:opacity .25s}'
        + '#verrou-ecran[data-etat=scan] #verrou-ouvrir{opacity:0;pointer-events:none}'
        + '#verrou-ecran [role=status]{margin:0;min-height:1.5em;font-size:14px;color:#fca5a5}'
        + '@keyframes vx-souffle{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}@keyframes vx-tour{to{transform:rotate(360deg)}}'
        + '@media (prefers-reduced-motion:reduce){#verrou-ecran .vx-orbe img,#verrou-ecran[data-etat=scan] .vx-orbe::after{animation:none}}';
      st.textContent = st.textContent.replace(/#verrou-ecran/g, ':is(#verrou-ecran,#porte-ecran)').replace(/#verrou-ouvrir/g, ':is(#verrou-ouvrir,#porte-relier)')
        + '#porte-ecran form{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%}'
        + '#porte-code{width:min(100%,320px);box-sizing:border-box;padding:14px 16px;border-radius:14px;border:1px solid rgba(125,211,252,.35);background:rgba(10,16,32,.85);color:#e6edf7;font:600 20px var(--sans,system-ui,sans-serif);letter-spacing:.14em;text-align:center;text-transform:uppercase}'
        + '#porte-code::placeholder{font-weight:500;font-size:15px;letter-spacing:.02em;text-transform:none;color:#7f8ea8}'
        + '#porte-ecran .vx-note{margin:0;max-width:26em;color:#9fb0c8;font-size:13px}#porte-ecran .vx-bas{min-height:190px}';
      document.head.append(st);
    }
  }
  /* 0.82.0 (son constat du 24/11/2026 sur son iPad, jamais relié : « ça m'affiche la page d'accueil… il me dit bonjour… ») : un appareil pas
     relié ne voit plus l'app, vide mais entière. Il voit cet écran, le même que celui du verrou, qui demande le code d'appairage donné par le
     serveur (30 minutes, une fois). Relié, la page se recharge : le verrou par passkey prend alors le relais s'il est actif. */
  let porte = null;
  function montrerPorte() {
    if (typeof document === 'undefined') return;
    const poser = () => {
      if (porte || !document.body) return;
      styleAccueil(); cacherVerrou();
      const el = (t, cls, txt) => { const x = document.createElement(t); if (cls) x.className = cls; if (txt) x.textContent = txt; return x; };
      const fond = el('div'); fond.id = 'porte-ecran'; fond.dataset.etat = 'attente'; fond.setAttribute('role', 'dialog'); fond.setAttribute('aria-modal', 'true'); fond.setAttribute('aria-label', 'Cet appareil n’est pas relié à JARVIS');
      const d = new Date(), hh = d.getHours(), salut = hh >= 5 && hh < 12 ? 'Bonjour.' : hh >= 12 && hh < 18 ? 'Bon après-midi.' : 'Bonsoir.';
      let quand = ''; try { quand = d.toLocaleDateString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long'}) + ' · ' + d.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}); } catch (e) { quand = ''; }
      const orbe = el('div', 'vx-orbe'), img = el('img'); img.alt = ''; img.src = BASE + '/icon-512.png'; img.addEventListener('error', () => { img.style.visibility = 'hidden'; }); orbe.append(img);
      const code = el('input'); code.id = 'porte-code'; code.type = 'text'; code.maxLength = 12; code.placeholder = 'Code à 8 caractères'; code.setAttribute('autocomplete', 'off'); code.setAttribute('autocapitalize', 'characters'); code.setAttribute('autocorrect', 'off'); code.spellcheck = false; code.setAttribute('aria-label', 'Code donné par ton serveur');
      const btn = el('button', '', 'Relier cet appareil'); btn.type = 'submit'; btn.id = 'porte-relier';
      const msg = el('p'); msg.setAttribute('role', 'status');
      const form = el('form'); form.setAttribute('autocomplete', 'off');
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (!code.value.trim()) { msg.textContent = 'Tape le code donné par ton serveur.'; code.focus(); return; }
        btn.disabled = true; msg.textContent = '';
        const r = await window.JarvisServeur.pair(code.value);
        if (r && r.ok) { location.reload(); return; }
        btn.disabled = false; msg.textContent = (r && r.error) || 'Code refusé.';
      });
      form.append(code, btn, msg, el('p', 'vx-note', 'Le code se demande à ton serveur : il sert une fois, pendant 30 minutes.'));
      const centre = el('div', 'vx-centre'); centre.append(orbe, el('h1', 'vx-salut', salut), el('p', 'vx-date', quand), el('p', 'vx-etat', 'Cet appareil n’est pas relié à JARVIS'));
      const bas = el('div', 'vx-bas'); bas.append(form);
      fond.append(el('div', 'vx-marque', 'J.A.R.V.I.S'), centre, bas);
      document.body.append(fond); porte = fond;
    };
    if (document.body) poser(); else document.addEventListener('DOMContentLoaded', poser);
  }
  function montrerVerrou() {
    drapeau(true);
    if (typeof document === 'undefined') return;
    if (!ecran && preuves > 0 && visible()) { mem(false); location.reload(); return; }   /* une page neuve : sa demande sans toucher est intacte */
    const poser = () => {
      if (ecran || !document.body) return;
      /* 0.77.0 (son retour du 24/11/2026 : « refais un bon écran d'accueil le temps de se connecter en Face ID ») : l'orbe de JARVIS qui
         respire, un anneau qui tourne pendant la vérification, le salut de l'heure et la date ; le bouton n'apparaît que si Face ID n'a
         pas ouvert tout seul. Rien de personnel sur cet écran : il se voit avant toute preuve. */
      styleAccueil();
      const el = (t, cls, txt) => { const x = document.createElement(t); if (cls) x.className = cls; if (txt) x.textContent = txt; return x; };
      const fond = el('div'); fond.id = 'verrou-ecran'; fond.setAttribute('role', 'dialog'); fond.setAttribute('aria-modal', 'true'); fond.setAttribute('aria-label', 'JARVIS est verrouillé');
      const d = new Date(), h = d.getHours(), salut = h >= 5 && h < 12 ? 'Bonjour.' : h >= 12 && h < 18 ? 'Bon après-midi.' : 'Bonsoir.';
      let quand = ''; try { quand = d.toLocaleDateString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long'}) + ' · ' + d.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}); } catch (e) { quand = ''; }
      const orbe = el('div', 'vx-orbe'), img = el('img'); img.alt = ''; img.src = BASE + '/icon-512.png'; img.addEventListener('error', () => { img.style.visibility = 'hidden'; }); orbe.append(img);
      const msg = el('p'); msg.setAttribute('role', 'status');
      const btn = el('button', '', 'Déverrouiller'); btn.type = 'button'; btn.id = 'verrou-ouvrir';
      btn.addEventListener('click', () => ouvrirVerrou(false));
      const centre = el('div', 'vx-centre'); centre.append(orbe, el('h1', 'vx-salut', salut), el('p', 'vx-date', quand), el('p', 'vx-etat'));
      const bas = el('div', 'vx-bas'); bas.append(btn, msg);
      fond.append(el('div', 'vx-marque', 'J.A.R.V.I.S'), centre, bas);
      document.body.append(fond); ecran = fond; mem(false);
      etatEcran(!autoFait && visible() && verrou.possible() ? 'scan' : 'attente');
      autoVerrou();
    };
    if (document.body) poser(); else document.addEventListener('DOMContentLoaded', poser);
  }
  const cacherVerrou = () => { if (ecran) { ecran.remove(); ecran = null; } };
  /* ce que dit le serveur fait foi : verrou éteint (retiré dans Termius) → l'écran part ; actif et fermé pour cet appareil → l'écran vient */
  const lire = (e) => { if (!e) return; drapeau(e.actif); if (typeof e.delai === 'number') delaiConnu = e.delai; if (!e.actif) cacherVerrou(); else if (!e.ouvert) montrerVerrou(); };
  const verifierVerrou = () => verrou.etat().then(lire);
  if (!token()) montrerPorte();   /* 0.82.0 : jamais relié (ou délié) : rien de l'app ne se voit */
  if (token() && typeof document !== 'undefined') {   /* seulement dans une page (un banc charge ce fichier sans elle) */
    /* 0.78.0 (son retour du 24/11/2026 : « 5 min, c'est trop court ») : une seule règle, le délai d'absence. L'app relancée ne redemande Face ID
       que si elle est restée fermée plus longtemps que le délai : le serveur le sait (elle l'a prévenu en quittant l'écran) et le dit ici.
       Verrouillée, ses demandes reviennent en 423 et l'écran se pose aussitôt. */
    if (drapeau()) req('/api/verrou/retour', {}).then((r) => { const e = r.j && typeof r.j.actif === 'boolean' ? r.j : null; if (e && e.actif && e.ouvert) mem(true); lire(e); }).catch(() => null);
    else verifierVerrou();
    setInterval(() => { if (visible() && drapeau() && !ecran) verifierVerrou(); }, 30000);   /* signe de vie de l'app à l'écran ; à l'arrière-plan, plus rien ne part */
    document.addEventListener('visibilitychange', () => {
      if (!token() || !drapeau() || enPreuve) return;   /* la feuille de Face ID elle-même ne compte pas comme une absence */
      if (!visible()) {
        if (ecran || cacheLe) return;
        cacheLe = Date.now();
        try { fetch(BASE + '/api/verrou/cache', {method: 'POST', keepalive: true, headers: {'content-type': 'application/json', authorization: 'Bearer ' + token()}, body: '{}'}).catch(() => null); } catch (e) { /* rien */ }
        return;
      }
      if (ecran) { autoFait = false; autoRedit = false; autoVerrou(); return; }
      const absent = cacheLe ? Date.now() - cacheLe : 0; cacheLe = 0;
      if (absent >= delaiConnu * 1000 && absent > 0) { montrerVerrou(); req('/api/verrou/verrouiller', {}).catch(() => null); return; }
      req('/api/verrou/retour', {}).then((r) => lire(r.j && typeof r.j.actif === 'boolean' ? r.j : null)).catch(() => null);
    });
  }
  window.JarvisServeur = {
    base: BASE,
    linked: () => !!token(),
    async pair(code) {
      let r;   /* 0.73.0 : hors réseau, « Relier » le dit (avant : rien ne s'affichait) */
      /* 0.73.0 : le genre d'appareil dans son nom (« JARVIS OS · iPhone »), pour les reconnaître dans la liste des appareils reliés */
      const nav = typeof navigator !== 'undefined' ? navigator : {}, ua = String(nav.userAgent || '');
      const genre = /iPad/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'PC' : '';
      try { r = await fetch(BASE + '/api/pair', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({code: String(code || '').trim(), device: 'JARVIS OS' + (genre ? ' · ' + genre : '')})}); }
      catch (e) { return {ok: false, error: INJ}; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.token) return {ok: false, error: j.error || (r.status >= 500 ? INDISPO : 'Code refusé.')};
      const s = settings(); s.serverUrl = BASE; s.serverToken = j.token;
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { return {ok: false, error: 'Stockage du téléphone indisponible.'}; }
      return {ok: true};
    },
    /* 0.73.0 : la clé est d'abord retirée du serveur (4 s au plus, hors réseau tant pis), puis effacée du téléphone */
    async unpair() {
      if (token()) await Promise.race([req('/api/appareils/delier', {}).catch(() => null), new Promise((r) => setTimeout(r, 4000))]);
      const s = settings(); s.serverToken = ''; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* rien */ }
    },
    /* 0.73.0 : les appareils reliés (carte « Serveur JARVIS » de Réglages) et le retrait d'un autre appareil ; null : serveur trop ancien ou injoignable */
    appareils: {
      liste: () => req('/api/appareils').then((r) => (r.status === 200 && r.j && Array.isArray(r.j.appareils) ? r.j.appareils : null)).catch(() => null),
      retirer: (id) => req('/api/appareils/retirer', {id}).then((r) => (r.status === 200 ? r.j : {ok: false, error: (r.j && r.j.error) || (r.status >= 500 ? INDISPO : 'Retrait refusé.'), appareils: r.j && r.j.appareils})).catch(() => ({ok: false, error: INJ}))
    },
    google: () => req('/api/google').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    /* 0.73.0 : serveur injoignable ou en train de redémarrer : un message, jamais un appui sans effet */
    googleConfig: (clientId, clientSecret) => req('/api/google/config', {clientId, clientSecret}).then(repOk).catch(() => ({ok: false, error: INJ})),
    googleLink: () => req('/api/google/link', {}).then(repOk).catch(() => ({ok: false, error: INJ})),
    googleUnlink: () => req('/api/google/unlink', {}).then(repOk).catch(() => ({ok: false, error: INJ})),
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
    verrou,   /* 0.75.0 : le verrou de l'app par passkey */
    /* 0.74.0 : le coffre en mémoire du serveur (jarvis-coffre). La phrase est scellée ICI, pour le coffre seul (sceller.mjs : la clé et un
       défi à usage unique viennent du coffre) ; le serveur de JARVIS ne reçoit que le paquet chiffré. Rien n'est gardé dans l'app. */
    coffre: {
      etat: () => req('/api/coffre').then((r) => (r.status === 200 && r.j && typeof r.j.installe === 'boolean' ? r.j : null)).catch(() => null),
      ouvrir: async (phrase) => {
        try {
          const k = await req('/api/coffre/cle');
          if (k.status !== 200 || !k.j.cle) return {error: (k.j && k.j.error) || 'Le coffre ne répond pas.'};
          const {scellerPhrase} = await import('./sceller.mjs');
          const r = await req('/api/coffre/ouvrir', await scellerPhrase(phrase, k.j.cle, k.j.defi));
          return r.j && typeof r.j.installe === 'boolean' ? r.j : {error: (r.j && r.j.error) || 'Ouverture refusée.'};
        } catch (e) { return {error: 'Ouverture impossible depuis cet appareil : ouvre le coffre dans Termius (sudo jarvis-coffre ouvrir).'}; }
      },
      fermer: () => req('/api/coffre/fermer', {}).then((r) => (r.j && typeof r.j.installe === 'boolean' ? r.j : null)).catch(() => null)
    },
    /* 0.39.0 : le serveur MCP (assistants reliés : app Claude, Grok Bot) et l'accord sur une proposition venue d'eux */
    mcp: {
      etat: () => req('/api/mcp').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      decider: (id, oui) => req('/api/mcp/decider', {id, oui}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      retirer: (id) => req('/api/mcp/retirer', {id}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      /* 0.71.0 : un jeton fixe par assistant, avec son profil (« lecture » ou « executant ») ; un refus (400) revient avec sa raison.
         0.72.0 : profil « veilleur », et `signe` (facultatif), le nom d'un jeton exécutant sous lequel il écrit dans Pilotage */
      jeton: (nom, profil, signe) => req('/api/mcp/jeton', {nom, profil: profil || 'lecture', ...(signe ? {signe} : {})}).then((r) => (r.status === 200 || (r.status === 400 && r.j && r.j.error) ? r.j : null)).catch(() => null),
      suspendre: (id, oui) => req('/api/mcp/suspendre', {id, oui}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null)
    },
    missionStatut: (id, status) => req('/api/missions/' + encodeURIComponent(id), {status}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    /* 0.38.0 : les skills relues des missions */
    skills: () => req('/api/skills').then((r) => (r.status === 200 ? r.j.skills : null)).catch(() => null),
    /* 0.37.0 : la mémoire durable (ce qu'il a demandé de retenir, et l'état de son Profil) */
    /* Radar (21/11/2026) : dépenses fixes, paie, reste à payer, dépenses trouvées dans les mails ; les montants restent sur le serveur */
    radar: () => req('/api/radar').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    radarSet: (cle, valeur) => req('/api/radar/set', {cle, valeur}).then((r) => { if (r.status !== 200) throw new Error((r.j && r.j.error) || (r.status >= 500 ? 'Serveur JARVIS indisponible' : 'Refusé')); return r.j; }),
    radarProposition: (id, oui, modif) => req('/api/radar/proposition', {id, oui, modif: modif || null}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    /* 0.68.0 : « Tout relire » ({tout: false} : les derniers jours) ; un refus (Google pas relié) remonte avec son message, au lieu de remplacer les données de la page */
    radarLire: (tout) => req('/api/radar/lire', {tout: tout !== false}).then((r) => { if (r.status !== 200 && r.status !== 202) throw new Error((r.j && r.j.error) || (r.status >= 500 ? 'Serveur JARVIS indisponible' : 'Relecture refusée')); return r.j; }),
    /* 0.69.0 : les dernières notifications (ce qu'elles annoncent) et « vue » : l'app ramenée au premier plan par l'une d'elles l'ouvre */
    notifs: () => req('/api/notifs').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    notifsVues: (ids) => req('/api/notifs/vue', {ids}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
    radarPlan: (id, action) => req('/api/radar/plan', {id, action}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),   /* 0.68.0 : un paiement en plusieurs fois « plus à payer » ou remis */
    radarReproposer: (cle) => req('/api/radar/reproposer', {cle}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),   /* 0.68.0 : ce qu'il a écarté revient dans « À valider » */
    /* 0.62.0 : ses invitations (un proche qui lui envoie des tâches) */
    invites: {liste: () => req('/api/invites').then((r) => (r.status === 200 ? r.j.invites : null)).catch(() => null), creer: (nom) => req('/api/invites', {nom}).then((r) => r.j).catch(() => null),
      retirer: (id) => req('/api/invites/' + id, null, 'DELETE').then((r) => r.status === 200).catch(() => false),
      /* 0.64.0 : son message vocal, les rappels toutes les 5 minutes, « C'est fait » / « Dans 5 min » */
      etat: () => req('/api/invites').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      reglages: (o) => req('/api/invites/reglages', o).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      recues: () => req('/api/invites/recues').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      agir: (id, action, minutes) => req('/api/invites/recues/' + id, {action, ...(minutes ? {minutes} : {})}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      audio: (id) => fetch(BASE + '/api/invites/audio/' + encodeURIComponent(id), {headers: {authorization: 'Bearer ' + token()}}).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? URL.createObjectURL(b) : null)).catch(() => null)},
    radarAlerte: (id, action) => req('/api/radar/alerte', {id, action}).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),   /* 0.56.0 : Retirer / Garder une dépense qui finit */
    /* 0.83.0 : les jours du mois (bilan tiré de l'agenda « Présence » et des fériés) : son oui, sa correction en une phrase */
    jours: {
      lire: (mois) => req('/api/jours' + (mois ? '?mois=' + encodeURIComponent(mois) : '')).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      confirmer: (mois, empreinte) => req('/api/jours/confirmer', {mois, empreinte}).then((r) => ({...r.j, ok: r.status === 200})).catch(() => ({ok: false, error: 'Serveur JARVIS injoignable.'})),
      corriger: (mois, texte) => req('/api/jours/corriger', {mois, texte}).then((r) => ({...r.j, ok: r.status === 200})).catch(() => ({ok: false, error: 'Serveur JARVIS injoignable.'})),
      effacer: (mois) => req('/api/jours/effacer', {mois}).then((r) => ({...r.j, ok: r.status === 200})).catch(() => ({ok: false, error: 'Serveur JARVIS injoignable.'})),
      relire: (mois) => req('/api/jours/relire', {mois}).then((r) => ({...r.j, ok: r.status === 200})).catch(() => ({ok: false, error: 'Serveur JARVIS injoignable.'}))},
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
