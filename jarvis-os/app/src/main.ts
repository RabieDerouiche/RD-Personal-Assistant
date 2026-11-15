/* JARVIS OS, phase 2. Accueil et session vocale : d'après les captures du propriétaire (orbe de verre, voile de soie).
   Le reste : le thème et les personnages de la page Jarvis (sphères irisées, silhouettes en hologramme, Claude couronné),
   à sa demande du 15/11/2026. Ce qui n'est pas relié le dit toujours. */
import './style.css';
import {h, icon, ago} from './ui';
import {AGENTS, agent, type AgentId} from './agents';
import {store, type Mission, type MissionStatus, type Priority, type RouteMode} from './store';
import {think, resetBrain} from './brain';
import {Voice, canListen, canSpeak, frenchVoices, type VoiceState} from './voice';
import {createOrb, type OrbState} from './orb';
import {charOf, setModeSource, talkAll, refreshModes, type Mode} from './chars';

const PHASE = 2;
const VERSION = '0.4.0';
type View = 'home' | 'command' | 'agents' | 'agent' | 'missions' | 'more' | 'memory' | 'automations' | 'intelligence' | 'settings';
let view: View = 'home';
let live = '', note = '', clearArm = 0, orbState: OrbState = 'idle', agentFilter = 'tous', agentQuery = '', agentSel: AgentId = 'claude', missionCol = 'a_approuver', draftNext = '';

const SALLE = {copie: 'https://claude.ai/artifact/NMAqUak7A5JYsLsc12VyaZ', service: 'https://claude.ai/artifact/QwLf64Ggstzu4p3uznZrr8'};
const app = document.getElementById('app')!;
const orb = createOrb();
const STATE_TXT: Record<OrbState, string> = {idle: 'Système en veille', listening: "Je t'écoute…", thinking: 'Je réfléchis…', executing: 'Mission préparée', speaking: 'Je réponds…', error: 'Micro indisponible'};
const setOrb = (s: OrbState) => { orbState = s; orb.set(s); document.querySelectorAll('[data-orbtxt]').forEach((n) => { n.textContent = STATE_TXT[s]; }); };
const hello = () => { const hr = new Date().getHours(); const n = store.settings.name.trim(); return (hr >= 18 || hr < 5 ? 'Bonsoir' : 'Bonjour') + (n ? ' ' + n : ''); };
const pending = () => store.missions.filter((m) => m.status === 'a_approuver').length;

/* l'humeur d'un agent, comme dans la page Jarvis : ambre s'il attend ta réponse, animé s'il travaille */
const modeOf = (id: AgentId): Mode => store.missions.some((m) => m.agent === id && m.status === 'envoyee') ? 'travail' : store.missions.some((m) => m.agent === id && m.status === 'a_approuver') ? 'demande' : 'veille';
setModeSource(modeOf);
const MODE_TXT: Record<Mode, string> = {veille: 'Non relié', travail: 'Au travail', demande: 'Attend ton accord'};
const sph = (id: AgentId, size: number, slot = '') => charOf(id, size, slot);

const ST: Record<MissionStatus, string> = {brouillon: 'Brouillon', a_approuver: 'À approuver', approuvee: 'Approuvée', refusee: 'Refusée', envoyee: 'En cours', terminee: 'Terminée', echouee: 'Échouée'};
const PRIO: Record<Priority, string> = {haute: 'Haute', normale: 'Normale', basse: 'Basse'};
const nextPrio = (p?: Priority): Priority => p === 'haute' ? 'basse' : p === 'basse' ? 'normale' : 'haute';
const short = (id: AgentId) => agent(id).name.replace(' (Grok)', '');

/* ---------- la voix ---------- */
const voice = new Voice({
  mode: () => store.settings.listenMode, voiceURI: () => store.settings.voiceURI, rate: () => store.settings.rate,
  onState: (s, why) => {
    const map: Record<VoiceState, OrbState> = {off: 'idle', listening: 'listening', waiting: 'thinking', speaking: 'speaking', error: 'error'};
    setOrb(map[s]);
    if (s === 'error' && why) { note = 'Micro : ' + why + '. Écris ta demande.'; store.stats.errors++; store.save(); }
    if (s === 'listening') note = '';
    paint();
  },
  onPartial: (t) => { live = t; document.querySelectorAll('[data-live]').forEach((n) => { n.textContent = t; }); },
  onUtterance: (t) => { store.stats.voiceTurns++; handle(t, true); }
});

function handle(text: string, byVoice: boolean) {
  const t0 = performance.now();
  store.add({who: 'me', text, at: Date.now()}); store.stats.turns++;
  setOrb('thinking');
  const out = think(text, store.settings.route);
  if (out.missions && out.missions.length) { store.missions.push(...out.missions.map((m) => ({...m, priority: 'normale' as Priority}))); setOrb('executing'); }
  store.add({who: 'jarvis', text: out.reply, at: Date.now(), agent: out.agent});
  store.stats.replyMs.push(Math.round(performance.now() - t0)); store.save();
  if (out.agent) talkAll(out.agent, Math.min(8, 1 + out.reply.length / 16));
  refreshModes();
  live = ''; paint();
  const go = () => { if (out.nav) { voice.stop(); show(out.nav as View); } if (out.end) { voice.stop(); resetBrain(); paint(); } };
  if ((byVoice || voice.active) && canSpeak() && !out.end) voice.speak(out.reply, go);
  else if (canSpeak() && out.end) voice.speak(out.reply, () => { voice.stop(); go(); });
  else { setTimeout(() => { if (orbState === 'thinking' || orbState === 'executing') setOrb('idle'); }, 900); go(); }
}
const micTap = () => {
  if (!canListen()) { note = 'Pas de reconnaissance vocale ici : écris ta demande.'; paint(); return; }
  if (voice.state === 'speaking') { voice.interrupt(); return; }
  if (voice.active) { voice.stop(); return; }
  note = ''; voice.start();
};
const askBox = (id: string, ph: string, cls: string) => {
  const input = h('input', {class: 'ask-in', id, type: 'text', placeholder: ph, enterkeyhint: 'send', autocomplete: 'off', 'aria-label': 'Ta demande'}) as HTMLInputElement;
  const send = () => { const v = input.value.trim(); if (!v) return; input.value = ''; input.parentElement?.classList.remove('has-text'); handle(v, false); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !(e as KeyboardEvent).isComposing) { e.preventDefault(); send(); } });
  input.addEventListener('input', () => input.parentElement?.classList.toggle('has-text', !!input.value.trim()));
  if (draftNext) { input.value = draftNext; draftNext = ''; setTimeout(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 60); }
  return h('div', {class: 'ask ' + cls + (input.value.trim() ? ' has-text' : '')}, input,
    h('button', {type: 'button', class: 'ask-ic', 'aria-label': 'Parler à JARVIS', html: icon('wave', 20), onclick: micTap}),
    h('button', {type: 'button', class: 'ask-send', 'aria-label': 'Envoyer', html: icon('send', 17), onclick: send}));
};
const dock = () => h('div', {class: 'dock', 'aria-label': 'Ton équipe'}, AGENTS.map((a) => { const m = modeOf(a.id);
  return h('button', {type: 'button', class: 'dock-b', 'data-mode': m, onclick: () => { agentSel = a.id; show('agent'); }}, sph(a.id, 54, 'dock'), h('b', {text: short(a.id)}), h('span', {text: m === 'demande' ? 'Attend' : m === 'travail' ? 'Travaille' : 'Non relié'})); }));

/* ---------- accueil : l'orbe et « Comment puis-je vous aider ? » ---------- */
function home(): HTMLElement {
  const last = store.msgs.slice(-2), recent = last.length === 2 && Date.now() - last[1].at < 15 * 60000;
  const n = pending();
  return h('section', {class: 'home'},
    h('div', {class: 'stage'}, orb.el),
    h('p', {class: 'hi', text: hello()}),
    h('h1', {class: 'help', text: 'Comment puis-je vous aider ?'}),
    note ? h('p', {class: 'note', text: note}) : null,
    n ? h('button', {type: 'button', class: 'nudge', onclick: () => show('missions')}, n + ' mission' + (n > 1 ? 's attendent' : ' attend') + ' ton accord ›') : null,
    dock(),
    recent ? h('button', {type: 'button', class: 'last glass', onclick: () => show('command')}, h('small', {text: 'Toi : ' + last[0].text}), h('span', {text: last[1].text})) : null,
    h('div', {class: 'home-glow'}), askBox('in', 'Demandez quelque chose…', 'home-ask'));
}

/* ---------- session vocale : orbe, voile de soie, micro ---------- */
function voiceView(): HTMLElement {
  const lastJ = store.msgs.slice().reverse().find((m) => m.who === 'jarvis');
  const routes: RouteMode[] = ['auto', 'claude', 'grok'];
  const speaking = voice.state === 'speaking';
  return h('section', {class: 'voice'},
    h('div', {class: 'v-top'}, h('span', {class: 'v-dot'}), h('span', {'data-orbtxt': '', text: STATE_TXT[orbState]}),
      h('button', {type: 'button', class: 'v-route', 'aria-label': 'Agent', onclick: () => { const i = routes.indexOf(store.settings.route); store.settings.route = routes[(i + 1) % 3]; store.save(); paint(); }}, store.settings.route.toUpperCase())),
    h('div', {class: 'stage tall'}, orb.el),
    h('div', {class: 'captions'},
      h('p', {class: 'cap-me', 'data-live': '', text: live}),
      lastJ ? h('div', {class: 'cap-j'}, lastJ.agent ? sph(lastJ.agent, 34, 'voice') : null, h('p', {text: lastJ.text})) : h('p', {class: 'cap-hint', text: 'Parle normalement, je réponds à voix haute. « C\'est tout » pour finir.'})),
    note ? h('p', {class: 'note', text: note}) : null,
    h('div', {class: 'v-bar'},
      h('button', {type: 'button', class: 'v-side', 'aria-label': 'Passer au clavier', html: icon('key', 22), onclick: () => { voice.stop(); show('command'); }}),
      h('button', {type: 'button', class: 'mic' + (voice.state === 'listening' ? ' is-on' : '') + (speaking ? ' is-say' : ''), 'aria-label': speaking ? 'Couper la parole' : 'Arrêter la session', html: icon(speaking ? 'speaker' : 'mic', 30), onclick: micTap}),
      h('button', {type: 'button', class: 'v-side', 'aria-label': 'Terminer la session', html: icon('x', 22), onclick: () => { voice.stop(); paint(); }})));
}

/* ---------- en-tête des écrans, comme la page Jarvis ---------- */
const head = (kicker: string, title: string, aside?: HTMLElement | null) => h('header', {class: 'p-head'}, h('div', {}, h('p', {class: 'view-title', text: kicker}), h('h2', {text: title})), aside || null);

/* ---------- centre de commandes ---------- */
function command(): HTMLElement {
  const msgs = store.msgs.slice(-80);
  return h('section', {class: 'page cmd'},
    head('Centre de commandes', 'Parle à ton équipe', h('button', {type: 'button', class: 'ic-btn', 'aria-label': 'Session vocale', html: icon('wave', 20), onclick: () => { show('home'); micTap(); }})),
    h('p', {class: 'lead', text: '0 agent relié · ' + AGENTS.length + ' prêts à recevoir des missions (phase 3 et 4).'}),
    h('div', {class: 'chat', id: 'log'}, msgs.length ? msgs.map((m, i) => m.who === 'me' ? h('div', {class: 'b-me'}, h('p', {text: m.text}), h('time', {text: ago(m.at)})) :
      h('div', {class: 'b-ai glass'}, h('div', {class: 'b-head'}, sph(m.agent || 'jarvis', 30, 'chat' + i), h('b', {text: 'JARVIS' + (m.agent ? ' → ' + short(m.agent) : '')}), h('time', {text: ago(m.at)})), h('p', {text: m.text}),
        /Mission(s)? (commune )?cré|missions créées/.test(m.text) ? h('div', {class: 'b-chips'}, h('span', {class: 'pill is-demande', text: 'Attend ton accord'}), h('button', {type: 'button', class: 'link', onclick: () => show('missions')}, 'Voir les missions ›')) : null))
      : h('div', {class: 'chat-empty glass'}, h('p', {text: 'Tout ce que tu dis à JARVIS, à la voix ou au clavier, est écrit ici.'}), h('p', {class: 'muted', text: 'Essaie : « Demande à Kairos de vérifier le prix du robot ».'}))),
    note ? h('p', {class: 'note', text: note}) : null,
    askBox('cin', 'Tapez une commande…', 'cmd-ask'));
}

/* ---------- l'équipe : cartes d'activité de la page Jarvis ---------- */
function stats(id: AgentId) {
  const ms = store.missions.filter((m) => m.agent === id);
  const today = ms.filter((m) => new Date(m.at).toDateString() === new Date().toDateString()).length;
  const ended = ms.filter((m) => ['terminee', 'echouee'].includes(m.status));
  const lastM = ms.slice().sort((a, b) => b.at - a.at)[0];
  return {ms, today, lastM, ok: ended.length ? Math.round(100 * ended.filter((m) => m.status === 'terminee').length / ended.length) + ' %' : '—', last: lastM ? ago(lastM.at) : '—'};
}
function agents(): HTMLElement {
  const q = agentQuery.toLowerCase();
  const F: [string, string][] = [['tous', 'Tous'], ['demande', 'Attendent'], ['claude', 'Claude'], ['grok', 'Grok']];
  const list = AGENTS.filter((a) => (agentFilter === 'tous' || a.provider === agentFilter || (agentFilter === 'demande' && modeOf(a.id) === 'demande')) && (!q || (a.name + ' ' + a.role + ' ' + a.skills.join(' ')).toLowerCase().includes(q)));
  const search = h('input', {class: 'search-in', type: 'search', placeholder: 'Chercher un agent', value: agentQuery, 'aria-label': 'Chercher un agent'}) as HTMLInputElement;
  search.addEventListener('input', () => { agentQuery = search.value; const pos = search.selectionStart; render(); const s = document.querySelector('.search-in') as HTMLInputElement; if (s) { s.focus(); s.setSelectionRange(pos, pos); } });
  return h('section', {class: 'page'},
    head('L\'équipe', 'Tes agents', h('span', {class: 'pill', text: '0 relié'})),
    h('div', {class: 'team-hero glass'}, sph('claude', 120, 'hero'), h('div', {}, h('b', {text: 'Claude, chef d\'équipe'}), h('span', {class: 'muted', text: 'Il commande les six bots Grok, avec Jarvis (Grok) comme relais vocal.'}))),
    h('label', {class: 'search glass'}, h('span', {html: icon('search', 18)}), search),
    h('div', {class: 'chips'}, F.map(([k, l]) => h('button', {type: 'button', 'aria-pressed': String(agentFilter === k), onclick: () => { agentFilter = k; render(); }}, l))),
    list.length ? h('div', {class: 'units'}, list.map((a) => { const s = stats(a.id), m = modeOf(a.id);
      return h('article', {class: 'unit glass', 'data-mode': m},
        h('button', {type: 'button', class: 'unit-hit', onclick: () => { agentSel = a.id; show('agent'); }}, sph(a.id, 56, 'list'), h('span', {class: 'unit-id'}, h('b', {text: a.name}), h('span', {text: a.role})), h('span', {class: 'pill is-' + m, text: MODE_TXT[m]})),
        h('p', {class: 'unit-log'}, h('time', {text: s.lastM ? ago(s.lastM.at) : '—'}), h('span', {text: s.lastM ? ST[s.lastM.status] + ' · ' + s.lastM.text : 'Aucune mission pour l\'instant.'})),
        h('div', {class: 'unit-foot'}, h('span', {text: s.ms.length + ' mission' + (s.ms.length > 1 ? 's' : '') + ' · ' + (a.provider === 'claude' ? 'phase 3' : 'phase 4')}), h('i', {class: 'meter', 'data-mode': m}, h('i', {})))); }))
      : h('p', {class: 'empty', text: agentFilter === 'demande' ? 'Aucun agent n\'attend ton accord.' : 'Aucun agent ne correspond.'}));
}
function agentPage(): HTMLElement {
  const a = agent(agentSel), s = stats(a.id), m = modeOf(a.id);
  const acts = s.ms.slice().sort((x, y) => y.at - x.at).slice(0, 8);
  return h('section', {class: 'page'},
    h('button', {type: 'button', class: 'back', onclick: () => show('agents')}, h('span', {html: icon('back', 16)}), 'L\'équipe'),
    h('div', {class: 'a-hero'}, sph(a.id, 150, 'detail'), h('h2', {class: 'hello', text: a.name}), h('p', {class: 'muted', text: a.role}), h('span', {class: 'pill is-' + m, text: MODE_TXT[m]})),
    h('div', {class: 'brief'}, h('div', {class: 'kpi glass'}, h('span', {class: 'kpi-l', text: 'Missions'}), h('b', {text: String(s.ms.length)}), h('span', {class: 'kpi-s', text: s.today + " aujourd'hui"})), h('div', {class: 'kpi glass'}, h('span', {class: 'kpi-l', text: 'Réussite'}), h('b', {text: s.ok})), h('div', {class: 'kpi glass'}, h('span', {class: 'kpi-l', text: 'Dernière'}), h('b', {class: 'kpi-txt', text: s.last}))),
    h('div', {class: 'card glass'}, h('p', {class: 'kpi-l', text: 'Ce qu\'il sait faire'}), h('ul', {class: 'skills'}, a.skills.map((k) => h('li', {text: k}))), h('p', {class: 'muted small', text: a.link})),
    h('button', {type: 'button', class: 'btn main', onclick: () => { draftNext = 'Demande à ' + short(a.id) + ' de '; show('command'); }}, 'Lui confier une mission'),
    h('div', {class: 'panel-h'}, h('h3', {text: 'Activité récente'}), h('button', {type: 'button', class: 'link', onclick: () => show('missions')}, 'Voir tout')),
    acts.length ? h('div', {class: 'feed glass'}, acts.map((x) => h('p', {class: 'unit-log'}, h('time', {text: ago(x.at)}), h('span', {text: ST[x.status] + ' · ' + x.text})))) : h('p', {class: 'empty', text: 'Aucune mission pour ' + a.name + ' pour l\'instant.'}));
}

/* ---------- missions ---------- */
const COLS: [string, string, MissionStatus[]][] = [['a_approuver', 'À approuver', ['a_approuver', 'brouillon']], ['approuvee', 'Approuvées', ['approuvee']], ['envoyee', 'En cours', ['envoyee']], ['terminee', 'Terminées', ['terminee', 'echouee', 'refusee']]];
function missions(): HTMLElement {
  const act = (m: Mission, s: MissionStatus) => { m.status = s; if (s === 'terminee' || s === 'refusee') m.done = Date.now(); store.save(); refreshModes(); render(); };
  const col = COLS.find((c) => c[0] === missionCol) || COLS[0];
  const list = store.missions.filter((m) => col[2].includes(m.status)).sort((a, b) => (a.priority === 'haute' ? -1 : 0) - (b.priority === 'haute' ? -1 : 0) || b.at - a.at);
  return h('section', {class: 'page'},
    head('Missions', 'Ce que ton équipe va faire'),
    h('p', {class: 'lead', text: "JARVIS les prépare, tu les approuves. L'envoi réel arrive en phase 3 (Claude) et 4 (Grok) : rien ne part pour l'instant."}),
    h('div', {class: 'brief k4'}, COLS.map(([k, l, ss]) => { const n = store.missions.filter((m) => ss.includes(m.status)).length; return h('button', {type: 'button', class: 'kpi glass' + (k === 'a_approuver' && n ? ' is-amber' : '') + (missionCol === k ? ' is-on' : ''), 'aria-pressed': String(missionCol === k), onclick: () => { missionCol = k; render(); }}, h('span', {class: 'kpi-l', text: l}), h('b', {text: String(n)})); })),
    list.length ? list.map((m) => h('article', {class: 'unit glass m-card', 'data-mode': m.status === 'a_approuver' ? 'demande' : 'veille'},
      h('div', {class: 'unit-hit'}, sph(m.agent, 40, 'm-' + m.id), h('span', {class: 'unit-id'}, h('b', {text: short(m.agent)}), h('span', {text: ago(m.at) + (m.group ? ' · mission commune' : '')})),
        h('button', {type: 'button', class: 'pill prio p-' + (m.priority || 'normale'), 'aria-label': 'Priorité', onclick: () => { m.priority = nextPrio(m.priority); store.save(); render(); }}, PRIO[m.priority || 'normale'])),
      h('p', {class: 'm-text', text: m.text}),
      m.status === 'approuvee' ? h('p', {class: 'muted small', text: 'Envoi réel en phase ' + (agent(m.agent).provider === 'claude' ? '3' : '4') + '.'}) : null,
      h('div', {class: 'acts'},
        m.status === 'a_approuver' ? [h('button', {type: 'button', class: 'btn main', onclick: () => act(m, 'approuvee')}, 'Approuver'), h('button', {type: 'button', class: 'btn', onclick: () => act(m, 'refusee')}, 'Refuser')] : null,
        m.status === 'refusee' ? h('button', {type: 'button', class: 'btn', onclick: () => act(m, 'a_approuver')}, 'Reprendre') : null,
        h('button', {type: 'button', class: 'btn ghost', onclick: () => { store.missions = store.missions.filter((x) => x !== m); store.save(); refreshModes(); render(); }}, 'Supprimer'))))
      : h('p', {class: 'empty', text: col[0] === 'a_approuver' ? 'Rien à approuver. Dis par exemple : « Demande à Kairos de vérifier le prix du robot ».' : 'Aucune mission ici.'}));
}

/* ---------- plus : salle de contrôle Jarvis et modules ---------- */
function more(): HTMLElement {
  const tile = (v: View, ic: string, t: string, s: string) => h('button', {type: 'button', class: 'tile glass', onclick: () => show(v)}, h('span', {class: 'tile-ic', html: icon(ic, 20)}), h('b', {text: t}), h('small', {text: s}));
  const mods = ['Demandes et oui', 'Agenda et présence', 'Achats et prix', 'Voyages', 'Sorties', 'Suivi du coût', 'Brouillons Gmail', 'Tri des mails'];
  return h('section', {class: 'page'},
    head('Plus', 'Salle de contrôle et réglages'),
    h('article', {class: 'salle glass'},
      h('div', {class: 'salle-h'}, sph('jarvis', 64, 'salle'), h('div', {}, h('b', {text: 'Salle de contrôle Jarvis'}), h('small', {text: 'Tes vraies données, en direct, dans l\'app Claude'}))),
      h('div', {class: 'mods'}, mods.map((m) => h('span', {class: 'pill', text: m}))),
      h('a', {class: 'btn main', href: SALLE[store.settings.salle], target: '_blank', rel: 'noopener'}, h('span', {html: icon('ext', 16)}), ' Ouvrir la salle de contrôle'),
      h('small', {class: 'muted small', text: 'Ces modules arriveront ici, dans JARVIS OS, avec le serveur de la phase 3. D\'ici là, la page Jarvis reste ton tableau de bord.'})),
    h('div', {class: 'tiles'}, tile('automations', 'flow', 'Workflows', 'Le circuit des missions'), tile('intelligence', 'gauge', 'Intelligence', 'Activité et services'), tile('memory', 'memory', 'Mémoire', 'Tout ce qui a été dit'), tile('settings', 'gear', 'Réglages', 'Voix, prénom, écoute')),
    h('p', {class: 'small', text: 'JARVIS OS ' + VERSION + ' · phase ' + PHASE + ' (prototype) · ' + (matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone ? "ouvert depuis l'écran d'accueil" : 'ouvert dans le navigateur')}),
    h('p', {class: 'small', text: 'Silhouettes des agents : game-icons.net (Lorc, Delapouite et contributeurs), licence CC BY 3.0.'}));
}
const back = () => h('button', {type: 'button', class: 'back', onclick: () => show('more')}, h('span', {html: icon('back', 16)}), 'Plus');

function memory(): HTMLElement {
  const q = h('input', {class: 'search-in', type: 'search', placeholder: 'Chercher dans la mémoire', 'aria-label': 'Chercher'}) as HTMLInputElement;
  const out = h('div', {class: 'feed glass'});
  const draw = () => { const s = q.value.trim().toLowerCase(); const ms = store.msgs.filter((m) => !s || m.text.toLowerCase().includes(s)).slice(-60).reverse();
    out.replaceChildren(...(ms.length ? ms.map((m) => h('p', {class: 'unit-log'}, h('time', {text: ago(m.at)}), h('span', {class: m.who === 'me' ? 'me' : '', text: (m.who === 'me' ? 'Toi : ' : 'JARVIS : ') + m.text}))) : [h('p', {class: 'empty', text: s ? 'Rien ne correspond.' : 'La mémoire est vide.'})])); };
  q.addEventListener('input', draw); draw();
  const used = new Set(store.missions.map((m) => m.agent));
  return h('section', {class: 'page'}, back(), head('Mémoire', 'Tout ce qui a été dit'),
    h('div', {class: 'brief'}, h('div', {class: 'kpi glass'}, h('span', {class: 'kpi-l', text: 'Souvenirs'}), h('b', {text: String(store.msgs.length)})), h('div', {class: 'kpi glass'}, h('span', {class: 'kpi-l', text: 'Missions'}), h('b', {text: String(store.missions.length)})), h('div', {class: 'kpi glass'}, h('span', {class: 'kpi-l', text: 'Agents'}), h('b', {text: String(used.size)}))),
    used.size ? h('div', {class: 'dock'}, [...used].map((id) => h('div', {class: 'dock-b'}, sph(id, 44, 'mem'), h('b', {text: short(id)}), h('span', {text: store.missions.filter((m) => m.agent === id).length + ' missions'})))) : null,
    h('p', {class: 'small', text: 'Gardée sur cet iPhone. En phase 3, la mémoire passera sur ton serveur et sera partagée avec les agents.'}),
    h('label', {class: 'search glass'}, h('span', {html: icon('search', 18)}), q), out,
    h('button', {type: 'button', class: 'btn danger', onclick: (e: Event) => { if (!clearArm) { clearArm = window.setTimeout(() => { clearArm = 0; render(); }, 5000); (e.target as HTMLElement).textContent = 'Confirmer : tout effacer'; return; } clearTimeout(clearArm); clearArm = 0; store.clearAll(); resetBrain(); refreshModes(); render(); }}, 'Effacer la mémoire et les missions'));
}

/* ---------- workflows : le circuit, avec les sphères de l'équipe ---------- */
function automations(): HTMLElement {
  const step = (el: HTMLElement, t: string, s: string) => h('div', {class: 'wf-node glass'}, el, h('div', {}, h('b', {text: t}), h('small', {text: s})));
  const autos: [string, string, string][] = [['Lancer une routine d\'un bot', 'Webhook Grok Bot', 'phase 4'], ['Lancer une tâche Claude Code', "Déclencheur d'API", 'phase 3'], ['Prévenir quand ton accord est nécessaire', 'Notification', 'phase 3'], ['Historique des exécutions', 'Résultats et coûts', 'phase 3']];
  return h('section', {class: 'page'}, back(), head('Workflows', 'Le circuit d\'une mission'),
    h('div', {class: 'wf'},
      step(h('span', {class: 'tile-ic', html: icon('wave', 20)}), 'Ta voix ou ton texte', 'sur l\'iPhone'), h('i', {class: 'wf-line'}),
      step(sph('jarvis', 44, 'wf'), 'JARVIS', 'comprend, choisit l\'agent, prépare la mission'), h('i', {class: 'wf-line'}),
      step(h('span', {class: 'tile-ic amber', html: icon('missions', 20)}), 'Ton accord', 'Missions : approuver ou refuser'), h('i', {class: 'wf-line off'}),
      h('div', {class: 'wf-split'}, step(sph('claude', 44, 'wf'), 'Claude Code', 'phase 3'), step(sph('iris', 44, 'wf'), 'Bots Grok', 'phase 4'))),
    h('p', {class: 'small', text: "Rien n'est encore relié : chaque mission s'arrête à ton accord."}),
    h('div', {class: 'panel-h'}, h('h3', {text: 'Automatisations prévues'})),
    h('div', {class: 'stack'}, autos.map(([t, s, p]) => h('div', {class: 'g-row glass'}, h('span', {class: 'tile-ic', html: icon('flow', 18)}), h('div', {}, h('b', {text: t}), h('small', {text: s + ' · ' + p})), h('span', {class: 'switch', role: 'switch', 'aria-checked': 'false', 'aria-disabled': 'true', title: 'Pas encore relié'})))));
}
function gauge(v: number, label: string, txt: string, c: string) {
  const r = 30, L = 2 * Math.PI * r, off = L * (1 - Math.max(0, Math.min(1, v)));
  return h('div', {class: 'gauge glass', html: `<svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true"><circle cx="40" cy="40" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="6"/><circle cx="40" cy="40" r="${r}" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${L.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 40 40)"/><text x="40" y="45" text-anchor="middle" fill="#eef1fb" font-size="15" font-weight="700">${txt}</text></svg><small>${label}</small>`});
}
function intelligence(): HTMLElement {
  const s = store.stats, avg = s.replyMs.length ? Math.round(s.replyMs.reduce((a, b) => a + b, 0) / s.replyMs.length) : 0;
  const voiceOk = s.voiceTurns + s.errors ? s.voiceTurns / (s.voiceTurns + s.errors) : 0;
  const approved = store.missions.length ? store.missions.filter((m) => ['approuvee', 'envoyee', 'terminee'].includes(m.status)).length / store.missions.length : 0;
  const llm: [string, string, boolean][] = [['Claude (en direct)', 'phase 3 · Claude Code sur ton serveur', false], ['Claude Code (missions)', "phase 3 · déclencheur d'API", false], ['Grok Bot', 'phase 4 · webhooks', false], ['Reconnaissance vocale', canListen() ? 'disponible sur cet appareil' : 'absente ici', canListen()], ['Voix de JARVIS', canSpeak() ? 'disponible' : 'absente ici', canSpeak()]];
  return h('section', {class: 'page'}, back(), head('Intelligence', 'Activité et services'),
    h('div', {class: 'gauges'}, gauge(Math.min(1, s.turns / 50), 'Échanges', String(s.turns), '#67e8f9'), gauge(voiceOk, 'Micro réussi', Math.round(voiceOk * 100) + '%', '#a5b4fc'), gauge(approved, 'Missions approuvées', Math.round(approved * 100) + '%', '#e9a8fb'), gauge(Math.min(1, avg / 1000), 'Réponse locale', avg + 'ms', '#fcd6a4')),
    h('div', {class: 'panel-h'}, h('h3', {text: 'État des modèles et services'})),
    h('div', {class: 'feed glass'}, llm.map(([n, d, ok]) => h('div', {class: 'llm-row'}, h('span', {class: 'st-dot ' + (ok ? 'ok' : 'off')}), h('div', {}, h('b', {text: n}), h('small', {text: d})), h('span', {class: 'pill ' + (ok ? 'is-ok' : 'is-demande'), text: ok ? 'Prêt' : 'Non relié'})))),
    h('p', {class: 'small', text: "La consommation de tes abonnements Claude et Grok s'affichera ici quand ils seront reliés."}));
}
function settings(): HTMLElement {
  const st = store.settings, vs = frenchVoices();
  const name = h('input', {class: 'field', type: 'text', value: st.name, placeholder: 'Ton prénom (gardé sur cet iPhone)', autocomplete: 'given-name', 'aria-label': 'Prénom'}) as HTMLInputElement;
  name.addEventListener('change', () => { st.name = name.value.trim().slice(0, 30); store.save(); });
  const sel = h('select', {class: 'field', 'aria-label': 'Voix', onchange: (e: Event) => { st.voiceURI = (e.target as HTMLSelectElement).value; store.save(); }},
    h('option', {value: '', text: "Voix des réglages de l'iPhone (recommandé)"}), vs.map((v) => h('option', {value: v.voiceURI || v.name, text: v.name + ' · ' + v.lang}))) as HTMLSelectElement;
  sel.value = st.voiceURI;
  const seg = (k: 'listenMode' | 'route' | 'salle', opts: [string, string][]) => h('div', {class: 'seg'}, opts.map(([v, l]) => h('button', {type: 'button', 'aria-pressed': String((st as any)[k] === v), onclick: () => { (st as any)[k] = v; store.save(); render(); }}, l)));
  return h('section', {class: 'page'}, back(), head('Réglages', 'Ta façon de travailler'),
    h('label', {class: 'lbl', text: 'Prénom pour l\'accueil'}), name,
    h('label', {class: 'lbl', text: 'Voix de JARVIS'}), sel,
    h('p', {class: 'small', text: "Voix plus naturelle : Réglages de l'iPhone, Accessibilité, Read & Speak (Contenu énoncé), Voix, Français, puis une voix « améliorée » ou « premium »."}),
    h('label', {class: 'lbl', text: 'Vitesse'}), h('input', {type: 'range', min: '0.8', max: '1.3', step: '0.05', value: String(st.rate), 'aria-label': 'Vitesse de la voix', oninput: (e: Event) => { st.rate = +(e.target as HTMLInputElement).value; store.save(); }}),
    h('button', {type: 'button', class: 'btn', onclick: () => voice.speak('Bonsoir, je suis JARVIS. Voici ma voix.')}, 'Essayer la voix'),
    h('label', {class: 'lbl', text: 'Écoute'}), seg('listenMode', [['phrase', 'Phrase par phrase'], ['continu', 'Écoute continue']]),
    h('label', {class: 'lbl', text: 'Agent par défaut'}), seg('route', [['auto', 'AUTO'], ['claude', 'CLAUDE'], ['grok', 'GROK']]),
    h('label', {class: 'lbl', text: 'Salle de contrôle à ouvrir'}), seg('salle', [['copie', 'Copie v17.15'], ['service', 'En service v16']]),
    h('label', {class: 'check'}, h('input', {type: 'checkbox', checked: st.approveAll ? true : null, onchange: (e: Event) => { st.approveAll = (e.target as HTMLInputElement).checked; store.save(); }}), ' Demander mon accord avant chaque mission'));
}

/* ---------- la navigation ---------- */
const TABS: [View, string, string][] = [['home', 'Accueil', 'home'], ['command', 'Commandes', 'chat'], ['agents', 'Équipe', 'agents'], ['missions', 'Missions', 'missions'], ['more', 'Plus', 'more']];
const PARENT: Partial<Record<View, View>> = {agent: 'agents', memory: 'more', automations: 'more', intelligence: 'more', settings: 'more'};
function nav(): HTMLElement {
  const cur = PARENT[view] || view, n = pending();
  return h('nav', {class: 'tabs', id: 'tabs', 'aria-label': 'Modules'}, TABS.map(([v, l, ic]) => h('button', {type: 'button', 'aria-current': cur === v ? 'page' : null, onclick: () => show(v)}, h('span', {class: 'ti', html: icon(ic, 21)}), h('span', {text: l}), v === 'missions' && n ? h('b', {class: 'badge', text: String(n)}) : null)));
}
const toEnd = () => { if (view === 'command') window.scrollTo(0, document.documentElement.scrollHeight); };
function show(v: View) { view = v; render(); window.scrollTo(0, 0); toEnd(); }
function paint() {
  if (view !== 'home' && view !== 'command') { const n = document.getElementById('tabs'); if (n) n.replaceWith(nav()); return; }
  const old = document.querySelector('.ask-in') as HTMLInputElement | null; const draft = old ? old.value : '', focus = !!old && document.activeElement === old;
  render();
  const n = document.querySelector('.ask-in') as HTMLInputElement | null; if (n && draft) { n.value = draft; n.parentElement?.classList.add('has-text'); if (focus) n.focus(); }
  toEnd();
}
function render() {
  const inVoice = view === 'home' && voice.active;
  document.body.className = 'v-' + view + (inVoice ? ' in-voice' : '');
  orb.wave(inVoice);
  const views: Record<View, () => HTMLElement> = {home: inVoice ? voiceView : home, command, agents, agent: agentPage, missions, more, memory, automations, intelligence, settings};
  app.replaceChildren(...[h('main', {class: 'main'}, views[view]()), inVoice ? null : nav()].filter((x): x is HTMLElement => !!x));
}

render();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
try { (window as any).speechSynthesis?.addEventListener?.('voiceschanged', () => { if (view === 'settings') render(); }); } catch { /* rien */ }
(window as any).__jarvis = {store, voice, think};
