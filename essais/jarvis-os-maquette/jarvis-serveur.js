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
    if (r.status === 200 && !/^\/api\/(verrou|health)/.test(p)) donnees = true;   /* 0.102.0 : une première donnée est arrivée (l'écran d'accueil peut partir) */
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
  let ecran = null, enPreuve = false, preuves = 0, autoFait = false, cacheLe = 0, delaiConnu = 60, donnees = false, voulu = '', attenteDonnees = false;
  const visible = () => document.visibilityState !== 'hidden';
  /* 0.102.0 (sa demande du 28/11/2026 : « la pop-up de passkey s'affiche en bas, donc tout ce que tu écris en bas ne sert à rien ; le temps de
     se connecter, on ne voit rien ; il faut que les infos soient bien affichées, bien claires, et que ça matche avec l'application ») :
     - tout tient dans la moitié HAUTE de l'écran (la feuille de Face ID couvre le bas) : la marque, le globe de particules de l'accueil, le
       salut, puis trois étapes qui disent où on en est : Serveur, Identité, Données ; le bouton de secours est juste dessous, jamais en bas ;
     - le même écran d'un bout à l'autre : posé dès le lancement (« connexion au serveur »), il passe à Face ID, puis reste pendant le
       rechargement jusqu'à la première donnée lue (« lecture de tes données »), et s'efface sur l'app prête. Avant : l'app vide, puis
       l'écran, puis du noir, puis l'app.
     États : lien (on joint le serveur), scan (Face ID en cours), attente (verrouillé : un toucher), charge (ouvert : on lit), pret, injoignable. */
  const AKEY = 'jarvis.accueil';   /* sessionStorage : « il vient de prouver » : le rechargement reprend l'écran à « lecture des données » */
  const TITRES = {lien: 'Connexion à ton serveur…', scan: 'Vérification de ton identité…', attente: 'JARVIS est verrouillé', charge: 'Lecture de tes données…', pret: 'Bienvenue.', injoignable: 'Le serveur ne répond pas'};
  const ETAPES = {lien: [['cours', 'connexion…'], ['', ''], ['', '']], scan: [['fait', 'joint'], ['cours', 'Face ID…'], ['', '']], attente: [['fait', 'joint'], ['attend', 'à confirmer'], ['', '']],
    charge: [['fait', 'joint'], ['fait', 'vérifiée'], ['cours', 'lecture…']], pret: [['fait', 'joint'], ['fait', 'vérifiée'], ['fait', 'à jour']], injoignable: [['rate', 'ne répond pas'], ['', ''], ['', '']]};
  const verrouille = () => !!ecran && (ecran.dataset.etat === 'scan' || ecran.dataset.etat === 'attente');   /* l'écran demande une preuve (les autres états ne bloquent rien) */
  const etatEcran = (e, ident) => {
    voulu = e; if (!ecran) return; ecran.dataset.etat = e; ecran.querySelector('.vx-etat').textContent = TITRES[e] || '';
    const L = ETAPES[e] || []; ecran.querySelectorAll('.vx-etape').forEach((li, i) => { const x = L[i] || ['', '']; li.dataset.e = x[0]; li.querySelector('span').textContent = (i === 1 && ident && x[0] === 'fait' ? ident : x[1]); });
    const btn = ecran.querySelector('#verrou-ouvrir'); if (btn) { btn.textContent = e === 'injoignable' ? 'Réessayer' : 'Déverrouiller'; btn.disabled = false; }
    ecran.setAttribute('aria-label', TITRES[e] || 'JARVIS');
  };
  /* l'écran s'efface sur l'app : « Bienvenue », puis un fondu */
  const partir = () => { if (!ecran) return; const x = ecran; etatEcran('pret', x.dataset.ident || ''); setTimeout(() => { x.classList.add('vx-part'); setTimeout(() => { if (ecran === x) cacherVerrou(); else x.remove(); }, 420); }, 260); };
  /* ouvert : on attend la première donnée lue (7 secondes au plus : l'app dira elle-même ce qui manque) */
  const attendreDonnees = (ident) => {
    if (!ecran) return; ecran.dataset.ident = ident || ecran.dataset.ident || ''; etatEcran('charge', ecran.dataset.ident);
    if (attenteDonnees) return; attenteDonnees = true; const t0 = Date.now();
    const tic = () => { if (!ecran || ecran.dataset.etat !== 'charge') { attenteDonnees = false; return; } if ((donnees && Date.now() - t0 > 350) || Date.now() - t0 > 7000) { attenteDonnees = false; partir(); return; } setTimeout(tic, 90); };
    tic();
  };
  async function ouvrirVerrou(auto) {
    if (!ecran || enPreuve) return;
    if (ecran.dataset.etat === 'injoignable') { location.reload(); return; }
    if (!verrouille()) return;
    const btn = ecran.querySelector('#verrou-ouvrir'), msg = ecran.querySelector('[role=status]');
    if (!verrou.possible()) { etatEcran('attente'); if (!auto) msg.textContent = 'Cet appareil ne sait pas présenter de passkey ici.'; return; }
    btn.disabled = true; msg.textContent = ''; etatEcran('scan');
    const t0 = Date.now(), r = await verrou.prouver();
    if (r && !r.error) { etatEcran('charge'); try { sessionStorage.setItem(AKEY, '1'); } catch (e) { /* stockage refusé : l'app se rechargera sans l'écran */ } location.reload(); return; }
    btn.disabled = false;
    if (auto && r && r.refus && Date.now() - t0 < 900 && !autoRedit && visible()) { autoRedit = true; setTimeout(() => ouvrirVerrou(true), 900); return; }   /* refus immédiat (page pas encore au premier plan) : un second essai */
    etatEcran('attente');
    if (!auto) msg.textContent = (r && r.error) || 'Le serveur ne répond pas.';
  }
  let autoRedit = false;
  const autoVerrou = () => { if (verrouille() && !autoFait && !enPreuve && visible()) { autoFait = true; setTimeout(() => ouvrirVerrou(true), 350); } };
  /* le style des deux écrans d'accueil (verrou, porte d'un appareil pas relié) */
  function styleAccueil() {
    if (!document.getElementById('verrou-style')) {
      const st = document.createElement('style'); st.id = 'verrou-style';
      st.textContent = '#verrou-ecran{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:0;padding:calc(env(safe-area-inset-top,0px) + 16px) 26px 0;background:radial-gradient(90% 46% at 50% 21%,rgba(34,211,238,.16),rgba(168,85,247,.08) 46%,rgba(4,6,12,0) 74%),linear-gradient(180deg,#071226 0%,#050915 52%,#03050b 100%);color:#e6edf7;font:500 16px/1.4 var(--sans,system-ui,-apple-system,sans-serif);text-align:center;overflow:hidden;opacity:1;transition:opacity .4s ease,transform .4s ease}'
        + '#verrou-ecran.vx-part{opacity:0;transform:scale(1.035);pointer-events:none}'
        + '#verrou-ecran .vx-marque{font:600 13px var(--logo,var(--display,system-ui,sans-serif));letter-spacing:.44em;text-indent:.44em;color:#9ecbff;opacity:.9}'
        + '#verrou-ecran .vx-centre{display:flex;flex-direction:column;align-items:center;gap:0;width:100%}'
        + '#verrou-ecran .vx-orbe{position:relative;width:min(38vw,17vh,158px);aspect-ratio:1;margin:calc(min(2.2vh,18px)) 0 calc(min(1.4vh,12px));display:grid;place-items:center}'
        + '#verrou-ecran .vx-orbe canvas{position:absolute;inset:-14%;width:128%;height:128%}'
        + '#verrou-ecran .vx-orbe::after{content:"";position:absolute;inset:-5%;border-radius:50%;border:2px solid transparent;border-top-color:#22d3ee;border-right-color:rgba(168,85,247,.85);opacity:0;transition:opacity .3s}'
        + '#verrou-ecran:is([data-etat=scan],[data-etat=lien],[data-etat=charge]) .vx-orbe::after{opacity:1;animation:vx-tour 1.15s linear infinite}'
        + '#verrou-ecran[data-etat=charge] .vx-orbe::after{animation-duration:.8s;border-top-color:#a855f7;border-right-color:rgba(34,211,238,.85)}'
        + '#verrou-ecran .vx-salut{margin:0;font:700 clamp(22px,3.1vh,28px)/1.15 var(--display,system-ui,sans-serif)}'
        + '#verrou-ecran .vx-date{margin:3px 0 0;color:#9fb0c8;font-size:14px}'
        + '#verrou-ecran .vx-etat{margin:calc(min(1.6vh,14px)) 0 0;min-height:1.4em;font:600 15px/1.4 var(--sans,system-ui,sans-serif);letter-spacing:.02em;background:linear-gradient(90deg,#22d3ee,#a855f7);-webkit-background-clip:text;background-clip:text;color:transparent}'
        + '#verrou-ecran[data-etat=injoignable] .vx-etat{background:none;color:#fca5a5}'
        + '#verrou-ecran .vx-etapes{list-style:none;margin:calc(min(1.2vh,10px)) 0 0;padding:9px 14px;width:min(100%,318px);box-sizing:border-box;display:flex;flex-direction:column;gap:7px;border-radius:16px;border:1px solid rgba(125,211,252,.16);background:rgba(10,18,36,.55);text-align:left}'
        + '#verrou-ecran .vx-etape{display:flex;align-items:center;gap:10px;font-size:14px;line-height:1.25;color:#7f8ea8}'
        + '#verrou-ecran .vx-etape i{flex:none;width:16px;height:16px;border-radius:50%;box-sizing:border-box;border:1.5px solid rgba(127,142,168,.55);position:relative}'
        + '#verrou-ecran .vx-etape b{font-weight:600;color:#c7d3e6;min-width:4.6em}'
        + '#verrou-ecran .vx-etape span{margin-left:auto;font-size:13px;color:#8fa0bb}'
        + '#verrou-ecran .vx-etape[data-e=fait] i{border:0;background:linear-gradient(135deg,#22d3ee,#a855f7);box-shadow:0 0 10px rgba(34,211,238,.45)}'
        + '#verrou-ecran .vx-etape[data-e=fait] i::after{content:"";position:absolute;left:5.2px;top:2.6px;width:4px;height:8px;border:solid #04121f;border-width:0 2px 2px 0;transform:rotate(42deg)}'
        + '#verrou-ecran .vx-etape[data-e=fait] b{color:#e6edf7}#verrou-ecran .vx-etape[data-e=fait] span{color:#7dd3fc}'
        + '#verrou-ecran .vx-etape[data-e=cours] i{border-color:rgba(34,211,238,.25);border-top-color:#22d3ee;border-right-color:#a855f7;animation:vx-tour .8s linear infinite}'
        + '#verrou-ecran .vx-etape[data-e=cours] b{color:#fff}#verrou-ecran .vx-etape[data-e=cours] span{color:#e6edf7}'
        + '#verrou-ecran .vx-etape[data-e=attend] i{border-color:#fbbf24;box-shadow:0 0 8px rgba(251,191,36,.35)}#verrou-ecran .vx-etape[data-e=attend] span{color:#fcd34d}'
        + '#verrou-ecran .vx-etape[data-e=rate] i{border-color:#f87171}#verrou-ecran .vx-etape[data-e=rate] b,#verrou-ecran .vx-etape[data-e=rate] span{color:#fca5a5}'
        + '#verrou-ecran .vx-bas{display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;margin-top:calc(min(1.6vh,14px))}'
        + '#verrou-ouvrir{appearance:none;-webkit-appearance:none;border:0;border-radius:999px;width:min(100%,318px);padding:13px 24px;font:600 16px var(--sans,system-ui,sans-serif);color:#fff;background:linear-gradient(90deg,#0ea5e9,#a855f7);box-shadow:0 6px 22px rgba(14,165,233,.28);cursor:pointer;transition:opacity .25s}'
        + '#verrou-ecran:is([data-etat=scan],[data-etat=lien],[data-etat=charge],[data-etat=pret]) #verrou-ouvrir{opacity:0;pointer-events:none}'
        + '#verrou-ecran [role=status]{margin:0;min-height:1.4em;font-size:14px;color:#fca5a5}'
        + '@keyframes vx-tour{to{transform:rotate(360deg)}}'
        + '@media (prefers-reduced-motion:reduce){#verrou-ecran .vx-orbe::after,#verrou-ecran .vx-etape[data-e=cours] i{animation:none}}';
      st.textContent = st.textContent.replace(/#verrou-ecran/g, ':is(#verrou-ecran,#porte-ecran)').replace(/#verrou-ouvrir/g, ':is(#verrou-ouvrir,#porte-relier)')
        + '#porte-ecran form{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%}'
        + '#porte-code{width:min(100%,320px);box-sizing:border-box;padding:14px 16px;border-radius:14px;border:1px solid rgba(125,211,252,.35);background:rgba(10,16,32,.85);color:#e6edf7;font:600 20px var(--sans,system-ui,sans-serif);letter-spacing:.14em;text-align:center;text-transform:uppercase}'
        + '#porte-code::placeholder{font-weight:500;font-size:15px;letter-spacing:.02em;text-transform:none;color:#7f8ea8}'
        + '#porte-ecran .vx-note{margin:0;max-width:26em;color:#9fb0c8;font-size:13px}#porte-ecran .vx-etat{margin-bottom:2px}';
      document.head.append(st);
    }
  }
  /* le globe de particules de l'accueil, en petit : une sphère de points qui tourne, du cyan au violet (les couleurs de la progression dans
     Travail) ; elle accélère pendant une vérification et s'ouvre quand l'app est prête. Sans mouvement si l'appareil le demande. */
  function globe(orbe, de) {
    const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); orbe.append(cv);
    const g = cv.getContext && cv.getContext('2d'); if (!g) return;
    const N = 420, P = [], TAU = Math.PI * 2, dpr = Math.min(2, window.devicePixelRatio || 1), reduit = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    for (let i = 0; i < N; i++) { const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), th = i * 2.399963; P.push([Math.cos(th) * r, y, Math.sin(th) * r]); }
    let W = 0, a = 0, v = 1, dernier = 0, ouvre = 0;
    const tour = (t) => {
      if (!cv.isConnected) return;
      const w = cv.clientWidth || 180; if (w !== W) { W = w; cv.width = cv.height = Math.round(w * dpr); }
      const e = de.dataset.etat, cible = e === 'scan' ? 2.6 : e === 'charge' || e === 'lien' ? 3.4 : e === 'pret' ? 1.2 : 0.8, dt = dernier ? Math.min(50, t - dernier) : 16; dernier = t;
      v += (cible - v) * 0.05; a += dt * 0.00042 * v; ouvre += ((e === 'pret' ? 1 : 0) - ouvre) * 0.08;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, W);
      const c = W / 2, R = W * 0.3 * (1 + 0.5 * ouvre), ax = 0.42, ca = Math.cos(a), sa = Math.sin(a), cx = Math.cos(ax), sx = Math.sin(ax);
      const h = g.createRadialGradient(c, c, R * 0.15, c, c, R * 1.5); h.addColorStop(0, 'rgba(34,211,238,' + (0.2 * (1 - ouvre)).toFixed(3) + ')'); h.addColorStop(0.55, 'rgba(168,85,247,' + (0.1 * (1 - ouvre)).toFixed(3) + ')'); h.addColorStop(1, 'rgba(37,99,235,0)');
      g.fillStyle = h; g.beginPath(); g.arc(c, c, R * 1.5, 0, TAU); g.fill();
      for (let i = 0; i < N; i++) {
        const p = P[i], x1 = p[0] * ca + p[2] * sa, z1 = -p[0] * sa + p[2] * ca, y1 = p[1] * cx - z1 * sx, z2 = p[1] * sx + z1 * cx;
        const onde = 1 + (0.02 + 0.03 * (v - 0.8)) * Math.sin(t * 0.0024 - p[1] * 5.5), k = 1 + z2 * 0.16, f = (z2 + 1) / 2, m = (x1 + 1) / 2;   /* m : du cyan (à gauche) au violet (à droite) */
        const al = (0.14 + 0.86 * f * f) * (0.7 + 0.3 * Math.sin(t * 0.0034 + i * 1.7)) * (1 - 0.85 * ouvre), sz = 0.7 + 1.5 * f;
        g.fillStyle = i % 17 === 0 && f > 0.5 ? 'rgba(255,255,255,' + al.toFixed(3) + ')' : 'rgba(' + Math.round(34 + 134 * m) + ',' + Math.round(211 - 126 * m) + ',' + Math.round(238 + 9 * m) + ',' + al.toFixed(3) + ')';
        g.fillRect(c + x1 * R * onde * k - sz / 2, c + y1 * R * onde * k - sz / 2, sz, sz);
      }
      if (!reduit) requestAnimationFrame(tour);
    };
    requestAnimationFrame(tour);
  }
  /* le corps commun des deux écrans d'accueil : la marque, le globe, le salut de l'heure, la date */
  function corpsAccueil(fond) {
    const el = (t, cls, txt) => { const x = document.createElement(t); if (cls) x.className = cls; if (txt) x.textContent = txt; return x; };
    const d = new Date(), hh = d.getHours(), salut = hh >= 5 && hh < 12 ? 'Bonjour.' : hh >= 12 && hh < 18 ? 'Bon après-midi.' : 'Bonsoir.';
    let quand = ''; try { quand = d.toLocaleDateString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long'}) + ' · ' + d.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}); } catch (e) { quand = ''; }
    const orbe = el('div', 'vx-orbe'), centre = el('div', 'vx-centre'); globe(orbe, fond);
    centre.append(orbe, el('h1', 'vx-salut', salut), el('p', 'vx-date', quand), el('p', 'vx-etat'));
    fond.append(el('div', 'vx-marque', 'J.A.R.V.I.S'), centre);
    return {el, centre};
  }
  /* dès que <body> existe (sans attendre la fin du chargement de la page : l'écran est là avant l'app) */
  const quandCorps = (fn) => { if (document.body) { fn(); return; } const o = new MutationObserver(() => { if (document.body) { o.disconnect(); fn(); } }); o.observe(document.documentElement, {childList: true}); };
  /* 0.82.0 (son constat du 24/11/2026 sur son iPad, jamais relié : « ça m'affiche la page d'accueil… il me dit bonjour… ») : un appareil pas
     relié ne voit plus l'app, vide mais entière. Il voit cet écran, le même que celui du verrou, qui demande le code d'appairage donné par le
     serveur (30 minutes, une fois). Relié, la page se recharge : le verrou par passkey prend alors le relais s'il est actif. */
  let porte = null;
  function montrerPorte() {
    if (typeof document === 'undefined') return;
    const poser = () => {
      if (porte || !document.body) return;
      styleAccueil(); cacherVerrou();
      const fond = document.createElement('div'); fond.id = 'porte-ecran'; fond.dataset.etat = 'attente'; fond.setAttribute('role', 'dialog'); fond.setAttribute('aria-modal', 'true'); fond.setAttribute('aria-label', 'Cet appareil n’est pas relié à JARVIS');
      const {el, centre} = corpsAccueil(fond); centre.querySelector('.vx-etat').textContent = 'Cet appareil n’est pas relié à JARVIS';
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
      const bas = el('div', 'vx-bas'); bas.append(form); fond.append(bas);
      document.body.append(fond); porte = fond;
    };
    quandCorps(poser);
  }
  /* pose l'écran (une fois), dans l'état demandé ; avant <body>, il sera posé dès qu'il existe, dans le dernier état demandé */
  function poserEcran(e) {
    voulu = e; if (ecran) { etatEcran(e); return; }
    quandCorps(() => {
      if (ecran || !document.body || porte || !voulu) return;
      /* rien de personnel sur cet écran : il se voit avant toute preuve */
      styleAccueil();
      const fond = document.createElement('div'); fond.id = 'verrou-ecran'; fond.setAttribute('role', 'dialog'); fond.setAttribute('aria-modal', 'true');
      const {el, centre} = corpsAccueil(fond), liste = el('ul', 'vx-etapes'); liste.setAttribute('aria-label', 'Où en est l’ouverture');
      for (const nom of ['Serveur', 'Identité', 'Données']) { const li = el('li', 'vx-etape'); li.append(el('i'), el('b', '', nom), el('span')); liste.append(li); }
      const msg = el('p'); msg.setAttribute('role', 'status');
      const btn = el('button', '', 'Déverrouiller'); btn.type = 'button'; btn.id = 'verrou-ouvrir';
      btn.addEventListener('click', () => ouvrirVerrou(false));
      const bas = el('div', 'vx-bas'); bas.append(btn, msg);
      centre.append(liste); fond.append(bas);
      document.body.append(fond); ecran = fond; etatEcran(voulu);
      if (verrouille()) autoVerrou(); else if (voulu === 'charge') attendreDonnees();
    });
  }
  function montrerVerrou() {
    drapeau(true);
    if (typeof document === 'undefined') return;
    if (verrouille()) return;   /* déjà posé, il attend déjà la preuve */
    if (!ecran && preuves > 0 && visible()) { mem(false); location.reload(); return; }   /* une page neuve : sa demande sans toucher est intacte */
    /* 0.77.0 (son retour du 24/11/2026 : « refais un bon écran d'accueil le temps de se connecter en Face ID ») ; 0.102.0 : voir plus haut */
    mem(false); poserEcran(!autoFait && visible() && verrou.possible() ? 'scan' : 'attente'); autoVerrou();
  }
  const cacherVerrou = () => { voulu = ''; if (ecran) { ecran.remove(); ecran = null; } };
  /* ce que dit le serveur fait foi : verrou éteint (retiré dans Termius) → l'écran part ; actif et fermé pour cet appareil → l'écran vient */
  const lire = (e) => { if (!e) return; drapeau(e.actif); if (typeof e.delai === 'number') delaiConnu = e.delai;
    if (!e.actif) cacherVerrou(); else if (!e.ouvert) montrerVerrou();
    else if (voulu === 'lien') { if (ecran) attendreDonnees('session ouverte'); else voulu = 'charge'; }   /* 0.102.0 : ouvert pour cet appareil : il reste à lire les données */
  };
  const verifierVerrou = () => verrou.etat().then(lire);
  if (!token()) montrerPorte();   /* 0.82.0 : jamais relié (ou délié) : rien de l'app ne se voit */
  if (token() && typeof document !== 'undefined') {   /* seulement dans une page (un banc charge ce fichier sans elle) */
    /* 0.78.0 (son retour du 24/11/2026 : « 5 min, c'est trop court ») : une seule règle, le délai d'absence. L'app relancée ne redemande Face ID
       que si elle est restée fermée plus longtemps que le délai : le serveur le sait (elle l'a prévenu en quittant l'écran) et le dit ici.
       Verrouillée, ses demandes reviennent en 423 et l'écran se pose aussitôt. */
    /* 0.102.0 : l'écran d'abord. Il vient de prouver (rechargement) : la suite du même écran, « lecture de tes données ». Lancement de l'app
       avec le verrou actif : « connexion à ton serveur », avant que rien de l'app ne se voie ; deux nouveaux essais si le serveur ne répond pas. */
    let vient = false; try { vient = sessionStorage.getItem(AKEY) === '1'; sessionStorage.removeItem(AKEY); } catch (e) { vient = false; }
    if (vient) poserEcran('charge'); else if (drapeau() && !mem()) poserEcran('lien');
    const retour = (essai) => req('/api/verrou/retour', {}).then((r) => { const e = r.j && typeof r.j.actif === 'boolean' ? r.j : null; if (e && e.actif && e.ouvert) mem(true); if (!e && voulu === 'lien' && !porte) throw new Error('sans réponse'); lire(e); })
      .catch(() => { if (voulu !== 'lien') return; if (essai < 2) setTimeout(() => retour(essai + 1), 1200); else etatEcran('injoignable'); });
    if (drapeau()) retour(0); else verifierVerrou();
    setInterval(() => { if (visible() && drapeau() && !ecran) verifierVerrou(); }, 30000);   /* signe de vie de l'app à l'écran ; à l'arrière-plan, plus rien ne part */
    document.addEventListener('visibilitychange', () => {
      if (!token() || !drapeau() || enPreuve) return;   /* la feuille de Face ID elle-même ne compte pas comme une absence */
      if (!visible()) {
        if (verrouille() || cacheLe) return;
        cacheLe = Date.now();
        try { fetch(BASE + '/api/verrou/cache', {method: 'POST', keepalive: true, headers: {'content-type': 'application/json', authorization: 'Bearer ' + token()}, body: '{}'}).catch(() => null); } catch (e) { /* rien */ }
        return;
      }
      if (verrouille()) { autoFait = false; autoRedit = false; autoVerrou(); return; }
      if (ecran) return;   /* 0.102.0 : l'écran lit les données ou attend le serveur : rien à redemander */
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
    sante0: () => fetch(BASE + '/api/health', {cache: 'no-store', headers: token() ? {authorization: 'Bearer ' + token()} : {}}).then((r) => (r.ok ? r.json() : null)).catch(() => null),   /* 0.102.0 : la version ne se donne plus qu'à un appareil relié */
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
    /* 0.92.0 : « Hermes et ses routines » en direct (le résumé du cron d'Hermes écrit par root, relu par le serveur) ; null = pas de réponse */
    hermesRoutines: () => req('/api/hermes/routines').then((r) => (r.status === 200 ? r.j : r.status === 404 ? {disponible: false, code: 'ancien', raison: 'le serveur de JARVIS n’est pas encore à jour (0.92.0)'} : null)).catch(() => null),
    /* 0.96.0 : administrer les routines d'Hermes. La feuille d'une routine (état, historique, erreur en détail), un ordre (lancer, pause,
       reprendre, horaire : des jours et des heures, jamais une expression) et « tout mettre en pause / tout reprendre ». Le serveur ne fait
       que poser l'ordre pour root ; un refus revient avec sa raison ({ok: false, error}). */
    hermesRoutine: (nom) => req('/api/hermes/routine?nom=' + encodeURIComponent(nom)).then((r) => (r.status === 200 ? r.j : {raison: r.status === 404 ? 'le serveur de JARVIS n’est pas encore à jour (0.96.0), ou ne connaît pas cette routine' : (r.j && r.j.error) || 'le serveur de JARVIS ne répond pas'})).catch(() => null),
    hermesOrdre: (corps) => req('/api/hermes/routine/ordre', corps).then((r) => (r.j && typeof r.j === 'object' && (r.j.ok || r.j.error) ? r.j : {ok: false, error: r.status === 404 ? 'Le serveur de JARVIS n’est pas encore à jour (0.96.0).' : 'Le serveur de JARVIS ne répond pas.'})).catch(() => ({ok: false, error: 'Serveur injoignable.'})),
    hermesTout: (action) => req('/api/hermes/routines/ordre', {action}).then((r) => (r.j && typeof r.j === 'object' && (r.j.ok || r.j.error) ? r.j : {ok: false, error: 'Le serveur de JARVIS ne répond pas.'})).catch(() => ({ok: false, error: 'Serveur injoignable.'})),
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
      relire: (mois) => req('/api/jours/relire', {mois}).then((r) => ({...r.j, ok: r.status === 200})).catch(() => ({ok: false, error: 'Serveur JARVIS injoignable.'})),
      /* 0.84.0 : le CRA de la semaine (son oui le vendredi ; Hermes saisit et soumet ensuite) */
      semaine: (lundi) => req('/api/jours/semaine' + (lundi ? '?lundi=' + encodeURIComponent(lundi) : '')).then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      semaineConfirmer: (lundi, empreinte) => req('/api/jours/semaine/confirmer', {lundi, empreinte}).then((r) => ({...r.j, ok: r.status === 200})).catch(() => ({ok: false, error: 'Serveur JARVIS injoignable.'})),
      semaineCorriger: (lundi, texte) => req('/api/jours/semaine/corriger', {lundi, texte}).then((r) => ({...r.j, ok: r.status === 200})).catch(() => ({ok: false, error: 'Serveur JARVIS injoignable.'})),
      /* 0.86.0 : les notes de frais d'Hermes (la première de chaque sorte validée par lui, puis créée par Hermes) */
      notes: () => req('/api/jours/notes').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      noteValider: (sorte, mois, empreinte) => req('/api/jours/note/valider', {sorte, mois, empreinte}).then((r) => ({...r.j, ok: r.status === 200})).catch(() => ({ok: false, error: 'Serveur JARVIS injoignable.'}))},
    /* 0.85.0 : l'espace « Travail » (une carte par routine : qui, étapes, dates, données prévues) ; « Renommer » garde le titre sur le serveur */
    travail: {
      lire: () => req('/api/travail').then((r) => (r.status === 200 ? r.j : null)).catch(() => null),
      renommer: (id, titre) => req('/api/travail/titre', {id, titre}).then((r) => ({...r.j, ok: r.status === 200})).catch(() => ({ok: false, error: 'Serveur JARVIS injoignable.'})),
      /* 0.94.0 : « C’est rattaché » (le CRA signé reçu, déposé sur le portail) */
      rattache: (mois) => req('/api/travail/rattache', {mois}).then((r) => ({...r.j, ok: r.status === 200})).catch(() => ({ok: false, error: 'Serveur JARVIS injoignable.'})),
      /* 0.97.0 : le CRA signé déposé par Hermes : son oui (gardé par le serveur sur l'empreinte du fichier et le mois), ou « Je le fais moi-même » */
      signeOui: (mois, empreinte) => req('/api/jours/signe/valider', {mois, empreinte}).then((r) => ({...r.j, ok: r.status === 200})).catch(() => ({ok: false, error: 'Serveur JARVIS injoignable.'})),
      signeMoi: (mois) => req('/api/jours/signe/moi', {mois}).then((r) => ({...r.j, ok: r.status === 200})).catch(() => ({ok: false, error: 'Serveur JARVIS injoignable.'}))},
    /* 0.91.0 : rangement des papiers par JARVIS. Le fichier part tel quel (son nom dans l'adresse, jamais un chemin) ; le serveur le garde,
       propose le dossier et le nom ; « valider » est son oui : la seule demande qui écrit dans Drive. etat() rend {absent: true} si le
       serveur est trop ancien (pas encore mis à jour), null s'il ne répond pas. */
    depot: {
      etat: () => req('/api/depot').then((r) => (r.status === 200 && r.j && Array.isArray(r.j.attente) ? r.j : r.status === 404 ? {absent: true} : null)).catch(() => null),
      envoyer: async (fichier, nom, source) => {
        let r;
        try { r = await fetch(BASE + '/api/depot?nom=' + encodeURIComponent(String(nom || (fichier && fichier.name) || '').slice(0, 200)) + (source === 'partage' ? '&source=partage' : ''), {method: 'POST', headers: {'content-type': 'application/octet-stream', authorization: 'Bearer ' + token()}, body: fichier}); }
        catch (e) { return {ok: false, error: 'Serveur JARVIS injoignable.'}; }
        let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
        if (r.status === 423 && j && j.verrou) montrerVerrou();
        if (r.status === 401 && j && j.error === 'Appareil non relié.') montrerPorte();
        return r.status === 200 && j.fichier ? {ok: true, fichier: j.fichier} : {ok: false, status: r.status, error: (j && j.error) || (r.status === 413 ? 'Fichier trop gros : 25 Mo au plus.' : r.status >= 500 ? 'Serveur JARVIS indisponible (' + r.status + ') : réessaie dans un moment.' : 'Dépôt refusé.')};
      },
      corriger: (id, dossier, nom) => req('/api/depot/corriger', {id, dossier, nom}).then((r) => ({...r.j, ok: r.status === 200})).catch(() => ({ok: false, error: 'Serveur JARVIS injoignable.'})),
      valider: (id, dossier, nom) => req('/api/depot/valider', {id, dossier, nom}).then((r) => ({...r.j, ok: r.status === 200})).catch(() => ({ok: false, error: 'Serveur JARVIS injoignable.'})),
      retirer: (id) => req('/api/depot/retirer', {id}).then((r) => ({...r.j, ok: r.status === 200})).catch(() => ({ok: false, error: 'Serveur JARVIS injoignable.'}))},
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
