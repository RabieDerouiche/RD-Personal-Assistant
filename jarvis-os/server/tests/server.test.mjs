/* Banc du serveur : node tests/server.test.mjs (aucun vrai Claude, aucun coût). */
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
import {startFakeGoogle} from './fake-google.mjs';
const FG = await startFakeGoogle();
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-'));
const PORT = 18000 + Math.floor(Math.random() * 1000), BASE = 'http://127.0.0.1:' + PORT;
const env = {...process.env, JARVIS_GOOGLE_FAKE: FG.url, PORT: String(PORT), JARVIS_DATA: DATA, CLAUDE_BIN: path.join(HERE, 'fake-claude.mjs'), ANTHROPIC_API_KEY: 'sk-ant-faux-pour-le-test', ANTHROPIC_BASE_URL: 'https://exemple.invalid', JARVIS_ORIGINS: 'https://rabiederouiche.github.io', JARVIS_REPO: os.tmpdir(), JARVIS_OS_DIR: path.join(HERE, '..', '..', '..', 'essais', 'jarvis-os-maquette'), JARVIS_TTS_HELPER: path.join(HERE, 'fake-tts.mjs'), JARVIS_VOICE_MODEL: path.join(HERE, 'fake-tts.mjs'), JARVIS_VOICE_SCRIPT: path.join(DATA, 'fausse-install.sh')};
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const code = execFileSync(process.execPath, [path.join(HERE, '..', 'server.mjs'), 'pair'], {env}).toString().match(/: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
const srv = spawn(process.execPath, [path.join(HERE, '..', 'server.mjs')], {env, stdio: ['ignore', 'pipe', 'pipe']});
srv.stderr.on('data', (d) => process.stderr.write(d));
await new Promise((r) => srv.stdout.once('data', r));
const call = async (p, o = {}) => { const r = await fetch(BASE + p, {...o, headers: {'content-type': 'application/json', ...(o.headers || {})}}); return {status: r.status, body: await r.json().catch(() => null), headers: r.headers}; };
const sse = async (body, tok) => { const r = await fetch(BASE + '/api/chat', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + tok}, body: JSON.stringify(body)}); const t = await r.text(); const evs = []; for (const b of t.split('\n\n')) { const m = /^event: (\w+)\ndata: (.*)$/s.exec(b.trim()); if (m) evs.push({ev: m[1], d: JSON.parse(m[2])}); } return evs; };
try {
  let r = await call('/api/health'); ok('santé', r.status === 200 && r.body.paired === false, JSON.stringify(r.body));
  r = await call('/api/state'); ok('sans appairage : refusé', r.status === 401);
  r = await call('/api/update', {method: 'POST'}); ok('mise à jour : refusée sans appairage', r.status === 401);
  r = await call('/api/pair', {method: 'POST', body: JSON.stringify({code: 'AAAA-BBBB'})}); ok('mauvais code : refusé', r.status === 401, r.body.error);
  r = await call('/api/pair', {method: 'POST', body: JSON.stringify({code: code.toLowerCase().replace('-', ' '), device: 'iPhone test'})}); const tok = r.body && r.body.token;
  ok('bon code (minuscules, espace) : jeton', r.status === 200 && tok && tok.length > 30);
  r = await call('/api/pair', {method: 'POST', body: JSON.stringify({code})}); ok('code à usage unique', r.status === 401);
  const A = {authorization: 'Bearer ' + tok};
  r = await call('/api/update', {method: 'POST', headers: A}); ok('mise à jour : échec propre hors dépôt git', r.status === 200 && r.body.ok === false && /impossible/.test(r.body.message), r.body.message);
  { const tr = await fetch(BASE + '/api/tts', {method: 'POST', headers: {...A, 'content-type': 'application/json'}, body: JSON.stringify({text: 'Bonjour, je suis JARVIS. Kairos surveille un prix.'})}); const body = await tr.text();
    ok('voix du serveur : audio et noms bien prononcés', tr.status === 200 && tr.headers.get('content-type') === 'audio/wav' && /Djarviss/.test(body) && /Kaïross/.test(body), body.slice(0, 70)); }
  { fs.writeFileSync(path.join(DATA, 'fausse-install.sh'), 'echo installation simulée; exit 0');
    const vi = await call('/api/voice/install', {method: 'POST', headers: A}); let st = vi.body.state;
    for (let i = 0; i < 30 && st === 'running'; i++) { await new Promise((z) => setTimeout(z, 100)); st = (await call('/api/voice/install', {headers: A})).body.state; }
    ok('installation de la voix lancée par le serveur', vi.status === 200 && st === 'done', st); }
  r = await call('/api/status', {headers: A}); ok('état de Claude Code', r.status === 200 && r.body.claude.loggedIn === true, JSON.stringify(r.body.claude));
  { const d = await call('/api/diag', {headers: A}); ok('diagnostic des connecteurs', d.status === 200 && /claude\.ai Gmail/.test(d.body.mcpList) && d.body.rules.length === 3, d.body.mcpList.split('\n')[0]); }
  { const td = await call('/api/test-data', {method: 'POST', headers: A}); ok('essai réel des données : outils utilisés rapportés', td.body.ok && td.body.used.length === 2 && /prochain événement/.test(td.body.answer), td.body.used.join(', ')); }
  ok('connecteurs relevés sans appel au modèle', r.body.connectors.gmail && r.body.connectors.sheets && r.body.connectors.calendar && r.body.connectors.read === 3, JSON.stringify(r.body.connectors).slice(0, 120));
  let evs = await sse({text: 'Bonjour JARVIS', model: 'rapide'}, tok);
  const done = evs.find((e) => e.ev === 'done');
  ok('discussion en flux : morceaux puis réponse', evs.filter((e) => e.ev === 'delta').length > 3 && done && /Tu as dit : Bonjour JARVIS\. Session : nouvelle, modèle : haiku/.test(done.d.reply), done && done.d.reply);
  ok('discussion : web et connecteurs en lecture seule, garde « chat »', done && /outils : WebSearch,WebFetch,mcp__claude_ai_Google_Calendar,mcp__claude_ai_Google_Sheets,mcp__claude_ai_Gmail, garde : chat/.test(done.d.reply) && !/Claude_Docs/.test(done.d.reply), done && done.d.reply);
  evs = await sse({text: 'Et ensuite ?'}, tok); const r2 = evs.find((e) => e.ev === 'done').d.reply; ok('même session reprise, modèle Sonnet par défaut', /Session : reprise, modèle : sonnet/.test(r2));
  evs = await sse({text: 'Encore une'}, tok); const r3 = evs.find((e) => e.ev === 'done'); const pid = (x) => (x.match(/processus : (\d+)/) || [])[1];
  ok('Claude reste ouvert entre deux phrases (même processus, 2e tour)', pid(r3.d.reply) === pid(r2) && /tour : 2/.test(r3.d.reply), r3.d.reply.slice(-40));
  ok('chronométrage de la réponse', r3.d.timing && r3.d.timing.warm === true && r3.d.timing.first >= 0 && r3.d.timing.total >= r3.d.timing.first, JSON.stringify(r3.d.timing));
  evs = await sse({text: 'Nouvelle conversation', newSession: true}, tok); ok('nouvelle session sur demande', /Session : nouvelle/.test(evs.find((e) => e.ev === 'done').d.reply));
  evs = await sse({text: 'Demande à Kairos de vérifier le prix'}, tok);
  const d2 = evs.find((e) => e.ev === 'done').d, deltas = evs.filter((e) => e.ev === 'delta').map((e) => e.d.text);
  ok('mission proposée par Claude', d2.missions.length === 1 && d2.missions[0].agent === 'kairos' && d2.missions[0].status === 'a_approuver', JSON.stringify(d2.missions[0]));
  ok('ligne MISSIONS jamais lue ni affichée', !/MISSIONS/.test(d2.reply) && deltas.every((t) => !/MIS/.test(t)), d2.reply);
  evs = await sse({text: 'La clé est-elle là ?'}, tok); ok('clé d\'API payante retirée, outils donnés directement', /clé payante : absente, base : absente, recherche d'outils : false/.test(evs.find((e) => e.ev === 'done').d.reply));
  evs = await sse({text: 'provoque une erreur'}, tok); const er = evs.find((e) => e.ev === 'error');
  ok('Claude non connecté : message clair', er && /claude auth login/.test(er.d.message), er && er.d.message);
  r = await call('/api/state', {headers: A}); ok('mémoire sur le serveur', r.body.msgs.length >= 9 && r.body.missions.length === 1, r.body.msgs.length + ' messages');
  const kid = d2.missions[0].id;
  r = await call('/api/missions/' + kid, {method: 'POST', headers: A, body: JSON.stringify({status: 'approuvee'})}); ok('mission pour un bot lancée', ['envoyee', 'approuvee', 'terminee'].includes(r.body.mission.status));
  const waitM = async (id) => { let x; for (let i = 0; i < 40; i++) { await new Promise((z) => setTimeout(z, 100)); x = (await call('/api/state', {headers: A})).body.missions.find((m) => m.id === id); if (x && ['terminee', 'echouee'].includes(x.status)) break; } return x; };
  let km = await waitM(kid);
  ok('bot pendant la pause Grok : ligne Canal sans sonnette', km.status === 'terminee' && /Ligne écrite dans le Canal pour Kairos ; pas de sonnette/.test(km.result) && /Outils : mcp__claude_ai_Google_Sheets\. Garde : bot/.test(km.result), km.result);
  r = await call('/api/config', {method: 'POST', headers: A, body: JSON.stringify({grokPauseUntil: ''})}); ok('fin de pause réglable', r.body.config.grokPauseUntil === '');
  evs = await sse({text: 'Demande à Kairos de vérifier le prix'}, tok); const k2 = evs.find((e) => e.ev === 'done').d.missions[0].id;
  await call('/api/missions/' + k2, {method: 'POST', headers: A, body: JSON.stringify({status: 'approuvee'})}); km = await waitM(k2);
  ok('bot hors pause : ligne Canal et sonnette', /sonnette envoyée/.test(km.result) && /Outils : mcp__claude_ai_Google_Sheets,mcp__claude_ai_Gmail\. Garde : bot/.test(km.result), km.result);
  const cm = {id: 'm-claude', agent: 'claude', text: 'résumer les nouveautés de .NET 10', status: 'a_approuver', at: Date.now()};
  await call('/api/memory', {method: 'DELETE', headers: A});
  await call('/api/import', {method: 'POST', headers: A, body: JSON.stringify({msgs: [{who: 'me', text: 'souvenir importé', at: 1}], missions: [cm]})});
  r = await call('/api/state', {headers: A}); ok('import de l\'historique du téléphone', r.body.msgs[0].text === 'souvenir importé' && r.body.missions[0].id === 'm-claude');
  r = await call('/api/missions/m-claude', {method: 'POST', headers: A, body: JSON.stringify({status: 'approuvee'})}); ok('mission Claude lancée', ['envoyee', 'approuvee'].includes(r.body.mission.status));
  let st; for (let i = 0; i < 40; i++) { await new Promise((x) => setTimeout(x, 100)); st = (await call('/api/state', {headers: A})).body.missions[0]; if (st.status === 'terminee') break; }
  ok('mission Claude terminée avec compte rendu', st.status === 'terminee' && /Compte rendu/.test(st.result), st.result);
  r = await call('/api/missions/m-claude', {method: 'DELETE', headers: A}); ok('suppression', r.status === 200);
  { let sn = (await call('/api/snap', {headers: A})).body.modules; const t0 = Date.now();
    while (Date.now() - t0 < 30000 && Object.values(sn).some((m) => !m.at)) { await new Promise((z) => setTimeout(z, 300)); sn = (await call('/api/snap', {headers: A})).body.modules; }
    ok('modules lus en arrière-plan', Object.keys(sn).length === 9 && Object.values(sn).every((m) => m.data && m.data.items), Object.keys(sn).filter((k) => sn[k].data).join(','));
    ok('chaque module lit sa source', sn.mails.data.items[0].module === 'mails' && sn.agenda.data.items[0].module === 'agenda' && sn.achats.data.items[0].module === 'Prix' && sn.atoi.data.items[0].module === 'À toi', [sn.mails, sn.agenda, sn.achats].map((m) => m.data.items[0].module).join(','));
    const before = sn.achats.at; await call('/api/snap/refresh', {method: 'POST', headers: A, body: JSON.stringify({modules: ['achats']})});
    for (let i = 0; i < 60; i++) { await new Promise((z) => setTimeout(z, 200)); sn = (await call('/api/snap', {headers: A})).body.modules; if (sn.achats.at > before) break; }
    ok('actualisation d\'un seul module', sn.achats.at > before && sn.mails.at < sn.achats.at, 'achats relu');
    const ev = await sse({text: 'Quoi de neuf ?'}, tok); ok('la conversation reçoit les données déjà lues', /contexte : oui/.test(ev.find((e) => e.ev === 'done').d.reply)); }
  /* ---------- accès Google direct ---------- */
  { const G = (p, b) => call(p, b ? {method: 'POST', headers: A, body: JSON.stringify(b)} : {headers: A});
    const T = (server, tool, input) => G('/api/tool', {server, tool, input});
    let g = await G('/api/google'); ok('Google : ni réglé ni relié au départ, adresse de retour donnée', g.status === 200 && !g.body.configured && !g.body.linked && /\/api\/google\/callback$/.test(g.body.redirect), g.body.redirect);
    r = await call('/api/google', {}); ok('Google : réglages refusés sans appairage', r.status === 401);
    r = await T('Google Sheets', 'get_values', {spreadsheetId: 'X', range: 'Canal!A1:H3'}); ok('outil avant liaison : refus clair', r.status === 409 && r.body.error.code === 'server_not_connected', JSON.stringify(r.body));
    r = await G('/api/google/config', {clientId: 'pas-un-id', clientSecret: 'x'}); ok('identifiant client invalide refusé', r.status === 400, r.body.error);
    r = await G('/api/google/config', {clientId: FG.client.id, clientSecret: FG.client.secret}); ok('identifiant et secret enregistrés', r.status === 200 && r.body.google.configured && !r.body.google.linked);
    ok('secret jamais renvoyé', !JSON.stringify(r.body).includes(FG.client.secret) && !JSON.stringify((await G('/api/google')).body).includes(FG.client.secret));
    r = await G('/api/google/link', {}); const L = new URL(r.body.url), state = L.searchParams.get('state');
    ok('lien Google : droits demandés, accès durable, état unique', L.origin + L.pathname === FG.url + '/auth' && L.searchParams.get('access_type') === 'offline' && L.searchParams.get('prompt') === 'consent' && /spreadsheets/.test(L.searchParams.get('scope')) && /gmail\.modify/.test(L.searchParams.get('scope')) && state.length === 48, L.searchParams.get('scope'));
    let cb = await fetch(BASE + '/api/google/callback?state=faux&code=CODE-OK'); ok('retour Google : état inconnu refusé', cb.status === 400 && /expiré/.test(await cb.text()));
    cb = await fetch(BASE + '/api/google/callback?state=' + state + '&code=CODE-OK'); const html = await cb.text();
    ok('retour Google : relié, compte affiché', cb.status === 200 && /Google est relié/.test(html) && /proprietaire@example\.org/.test(html), html.replace(/<[^>]+>/g, ' ').slice(0, 120));
    cb = await fetch(BASE + '/api/google/callback?state=' + state + '&code=CODE-OK'); ok('retour Google : état à usage unique', cb.status === 400);
    g = await G('/api/google'); ok('état : relié', g.body.linked && g.body.account === 'proprietaire@example.org');
    r = await T('Google Sheets', 'get_values', {spreadsheetId: 'PIL', range: "'À toi'!A3:D300"}); ok('Sheets get_values : plage avec accents et apostrophes', r.status === 200 && r.body.payload.values[1][0] === 'Relance syndic' && r.body.payload.range === "'À toi'!A3:D300", JSON.stringify(r.body).slice(0, 120));
    r = await T('Google Sheets', 'append_values', {spreadsheetId: 'PIL', range: 'Canal!A1', values: [['16/11/2026', 'Rabie', 'Iris', 'Info', 'Test', 'À faire', '', '']]}); let c = FG.calls.filter((x) => /:append$/.test(x.path)).pop();
    ok('Sheets append_values : ligne ajoutée, saisie comme dans Sheets', r.status === 200 && c.q.valueInputOption === 'USER_ENTERED' && c.q.insertDataOption === 'INSERT_ROWS' && c.body.values[0][4] === 'Test', JSON.stringify(c.q));
    r = await T('Google Sheets', 'update_values', {spreadsheetId: 'PIL', range: 'Échéances!F12', values: [['Fait']]}); c = FG.calls.filter((x) => x.method === 'PUT').pop(); ok('Sheets update_values', r.status === 200 && c.path.endsWith('Échéances!F12') && c.body.values[0][0] === 'Fait');
    r = await T('Google Calendar', 'list_events', {startTime: '2026-11-15T00:00:00', endTime: '2026-07-13T00:00:00', orderBy: 'startTime', pageSize: 250}); c = FG.calls.filter((x) => /\/events$/.test(x.path) && x.method === 'GET').pop();
    ok('Agenda list_events : heures de Paris (hiver +01:00, été +02:00), instances dépliées', r.body.payload.events[0].id === 'ev1' && c.q.timeMin === '2026-11-15T00:00:00+01:00' && c.q.timeMax === '2026-07-13T00:00:00+02:00' && c.q.singleEvents === 'true', c.q.timeMin + ' / ' + c.q.timeMax);
    r = await T('Google Calendar', 'create_event', {calendarId: 'pres@group.calendar.google.com', summary: 'Télétravail', allDay: true, startTime: '2026-11-18T00:00:00', endTime: '2026-11-19T00:00:00', availability: 'AVAILABILITY_FREE', useDefaultReminders: false});
    c = FG.calls.filter((x) => x.method === 'POST' && /\/events$/.test(x.path)).pop(); ok('Agenda create_event journée entière (présence)', r.status === 200 && c.body.start.date === '2026-11-18' && c.body.end.date === '2026-11-19' && c.body.transparency === 'transparent' && /pres@group/.test(c.path), JSON.stringify(c.body).slice(0, 140));
    r = await T('Google Calendar', 'create_event', {summary: 'Notaire', colorId: '11', startTime: '2026-11-22T14:30:00', endTime: '2026-11-22T15:30:00', overrideReminders: [{method: 'popup', minutes: 1440}], recurrenceData: ['RRULE:FREQ=YEARLY'], useDefaultReminders: false});
    c = FG.calls.filter((x) => x.method === 'POST' && /\/events$/.test(x.path)).pop(); ok('Agenda create_event à heure fixe, rouge, rappels, annuel', c.body.start.dateTime === '2026-11-22T14:30:00+01:00' && c.body.colorId === '11' && c.body.reminders.overrides[0].minutes === 1440 && c.body.recurrence[0] === 'RRULE:FREQ=YEARLY');
    r = await T('Google Calendar', 'create_event', {summary: 'X', startTime: '2026-11-22T14:30:00', endTime: '2026-11-22T15:30:00', overrideReminders: [{method: 'popup', minutes: -480}]}); ok('rappel négatif refusé comme le connecteur (la page réessaie sans)', r.status === 502 && r.body.error.code === 'tool_error');
    r = await T('Google Calendar', 'update_event', {eventId: 'ev1', startTime: '2026-11-21T09:00:00', notificationLevel: 'NONE'}); c = FG.calls.filter((x) => x.method === 'PATCH').pop();
    ok('Agenda update_event : durée gardée en déplaçant', r.status === 200 && c.body.start.dateTime === '2026-11-21T09:00:00+01:00' && Date.parse(c.body.end.dateTime) - Date.parse(c.body.start.dateTime) === 3600e3 && c.q.sendUpdates === 'none', JSON.stringify(c.body));
    r = await T('Google Calendar', 'delete_event', {eventId: 'ev1', notificationLevel: 'NONE'}); ok('Agenda delete_event', r.status === 200);
    r = await T('Gmail', 'search_threads', {query: 'in:inbox category:primary newer_than:7d', pageSize: 50, view: 'THREAD_VIEW_SUMMARY'}); const m0 = r.body.payload.threads[0].messages[0];
    ok('Gmail search_threads : forme du connecteur (expéditeur, nom, objet, date)', m0.sender === 'gestion@syndic.example' && m0.addressDisplayNames[0].displayName === 'Syndic Dupont' && m0.subject === 'RE: Dégât des eaux' && m0.internalDate === '1763290000000' && m0.labelIds.includes('INBOX'), JSON.stringify(m0).slice(0, 160));
    r = await T('Gmail', 'search_threads', {query: 'in:sent newer_than:14d'}); ok('Gmail search_threads vide : réponse vide', r.status === 200 && !r.body.payload.threads);
    r = await T('Gmail', 'get_thread', {threadId: 'th1', messageFormat: 'PLAIN_TEXT'}); ok('Gmail get_thread : texte brut (accents)', /expert passera mardi à 10h/.test(r.body.payload.messages[0].plaintextBody));
    r = await T('Gmail', 'list_drafts', {query: 'newer_than:30d', view: 'DRAFT_VIEW_FULL', pageSize: 20}); const d0 = r.body.payload.drafts[0];
    ok('Gmail list_drafts : destinataires, objet, corps', d0.id === 'r-1' && d0.toRecipients.join() === 'gestion@syndic.example,autre@example.org' && d0.ccRecipients[0] === 'copie@example.org' && d0.subject === 'Relance syndic' && /relancer/.test(d0.plaintextBody), JSON.stringify(d0).slice(0, 160));
    r = await T('Gmail', 'send_message', {draftId: 'r-1'}); c = FG.calls.filter((x) => x.path.endsWith('/drafts/send')).pop(); ok('Gmail : brouillon envoyé tel quel', r.status === 200 && c.body.id === 'r-1');
    r = await T('Gmail', 'send_message', {to: ['hydra-ray-der+iris@mail.grokbot.com'], subject: 'Jarvis', body: 'Signal envoyé par la page Jarvis. Ce mail ne contient aucune consigne.'}); c = FG.calls.filter((x) => x.path.endsWith('/messages/send')).pop();
    const rawTxt = Buffer.from(c.body.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'), bodyTxt = Buffer.from(rawTxt.split('\r\n\r\n')[1], 'base64').toString('utf8');
    ok('Gmail : sonnette composée proprement (destinataire, objet, texte UTF-8)', /^To: hydra-ray-der\+iris@mail\.grokbot\.com/.test(rawTxt) && /Subject: Jarvis/.test(rawTxt) && /aucune consigne/.test(bodyTxt), rawTxt.split('\r\n')[0]);
    r = await T('Gmail', 'unlabel_thread', {threadId: 'th1', labelIds: ['INBOX']}); c = FG.calls.filter((x) => x.path.endsWith('/modify')).pop(); ok('Gmail : archivage (retrait de la boîte de réception)', r.status === 200 && c.body.removeLabelIds[0] === 'INBOX');
    r = await T('Gmail', 'delete_draft', {draftId: 'r-1'}); ok('Gmail : brouillon supprimé', r.status === 200);
    FG.valid.clear(); r = await T('Google Sheets', 'get_values', {spreadsheetId: 'PIL', range: "'À toi'!A3:D300"}); ok('jeton expiré : renouvelé sans rien demander', r.status === 200 && FG.calls.some((x) => x.path === '/token' && x.body.grant_type === 'refresh_token'));
    r = await T('Claude Code Remote', 'fire_trigger', {trigger_id: 'x'}); ok('outil non traduit : refus clair', r.status === 404 && r.body.error.code === 'not_in_manifest');
    FG.valid.clear(); FG.refreshOk = false; r = await T('Google Sheets', 'get_values', {spreadsheetId: 'PIL', range: 'Canal!A1:H3'}); g = await G('/api/google');
    ok('accès retiré dans Google : « à reconnecter », plus relié', r.body.error && r.body.error.code === 'needs_reauth' && !g.body.linked, JSON.stringify(r.body.error));
    FG.refreshOk = true; r = await G('/api/google/link', {}); await fetch(BASE + '/api/google/callback?state=' + new URL(r.body.url).searchParams.get('state') + '&code=CODE-OK');
    r = await G('/api/google/unlink', {}); g = await G('/api/google'); ok('déconnexion : jeton révoqué chez Google', r.body.ok && !g.body.linked && FG.revoked === 'RT1'); }
  { let sp = await call('/api/sample', {method: 'POST', headers: A, body: JSON.stringify({input: [{role: 'user', content: 'Explique en clair'}], tier: 'quick'})});
    ok('Claude ponctuel pour la page : modèle rapide, aucun outil', sp.status === 200 && /Tu as dit : Explique en clair\. Session : nouvelle, modèle : haiku, outils : , garde : chat/.test(sp.body.text), sp.body.text && sp.body.text.slice(0, 120));
    sp = await call('/api/sample', {method: 'POST', body: JSON.stringify({input: 'x'})}); ok('Claude ponctuel refusé sans appairage', sp.status === 401);
    let os1 = await fetch(BASE + '/os/?x=1', {redirect: 'manual'}); ok('ancienne adresse /os/ renvoie à la racine', os1.status === 301 && os1.headers.get('location') === '/?x=1');
    os1 = await fetch(BASE + '/'); const ht = await os1.text(); ok('nouvelle app à la racine (choix des données au chargement, installable)', os1.status === 200 && /jarvis-serveur\.js/.test(ht) && /manifest\.webmanifest/.test(ht));
    os1 = await fetch(BASE + '/ancienne/'); ok('ancienne app à /ancienne/', os1.status === 200 && /assets\/index-/.test(await os1.text()));
    os1 = await fetch(BASE + '/sw.js'); ok('service worker de la nouvelle app à la racine', os1.status === 200 && /jarvis-os-app/.test(await os1.text()));
    { const pc = await fetch(BASE + '/confidentialite.html'); ok('règles de confidentialité publiques (déclarées à Google)', pc.status === 200 && /règles de confidentialité/.test(await pc.text())); }
    os1 = await fetch(BASE + '/os/jarvis-serveur.js'); ok('pont vers le serveur servi', os1.status === 200 && /api\/tool/.test(await os1.text())); }
  const pre = await fetch(BASE + '/api/chat', {method: 'OPTIONS', headers: {origin: 'https://rabiederouiche.github.io', 'access-control-request-method': 'POST'}});
  ok('CORS : app GitHub Pages acceptée', pre.headers.get('access-control-allow-origin') === 'https://rabiederouiche.github.io');
  const bad = await fetch(BASE + '/api/health', {headers: {origin: 'https://pirate.example'}}); ok('CORS : autre site refusé', !bad.headers.get('access-control-allow-origin'));
  const st0 = fs.statSync(path.join(DATA, 'state.json')); ok('fichier d\'état lisible par le seul service', (st0.mode & 0o077) === 0, (st0.mode & 0o777).toString(8));
  const raw = fs.readFileSync(path.join(DATA, 'state.json'), 'utf8'); ok('jeton jamais stocké en clair', !raw.includes(tok));
  r = await fetch(BASE + '/../server.mjs'); ok('fichiers du serveur non servis', r.status !== 200 || !(await r.text()).includes('PAID_ENV'));
} catch (e) { ok('exception', false, e.stack); }
srv.kill(); FG.close(); fs.rmSync(DATA, {recursive: true, force: true});
console.log(results.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + results.length + ' vérifications).');
process.exit(fails ? 1 : 0);
