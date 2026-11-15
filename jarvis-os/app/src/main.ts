/* JARVIS OS, phase 2 : la PWA vocale, au style des captures du propriétaire (15/11/2026) :
   orbe de verre, voile de soie, cartes violettes, centre de commandes vert. Ce qui n'est pas relié le dit toujours. */
import './style.css';
import {h, icon, ago} from './ui';
import {AGENTS, agent, type AgentId} from './agents';
import {store, type Mission, type MissionStatus, type Priority, type RouteMode} from './store';
import {think, resetBrain} from './brain';
import {Voice, canListen, canSpeak, frenchVoices, type VoiceState} from './voice';
import {createOrb, type OrbState} from './orb';

const PHASE = 2;
const VERSION = '0.3.0';
type View = 'home' | 'command' | 'agents' | 'agent' | 'missions' | 'more' | 'memory' | 'automations' | 'intelligence' | 'settings';
let view: View = 'home';
let live = '', note = '', clearArm = 0, orbState: OrbState = 'idle', agentFilter = 'tous', agentQuery = '', agentSel: AgentId = 'claude', missionCol = 'a_approuver', draftNext = '', wfTab = 'circuit';

const SALLE = {copie: 'https://claude.ai/artifact/NMAqUak7A5JYsLsc12VyaZ', service: 'https://claude.ai/artifact/QwLf64Ggstzu4p3uznZrr8'};
const app = document.getElementById('app')!;
const orb = createOrb();
const STATE_TXT: Record<OrbState, string> = {idle: 'Système en veille', listening: "Je t'écoute…", thinking: 'Je réfléchis…', executing: 'Mission préparée', speaking: 'Je réponds…', error: 'Micro indisponible'};
const setOrb = (s: OrbState) => { orbState = s; orb.set(s); document.querySelectorAll('[data-orbtxt]').forEach((n) => { n.textContent = STATE_TXT[s]; }); };
const hello = () => { const hr = new Date().getHours(); const n = store.settings.name.trim(); return (hr >= 18 || hr < 5 ? 'Bonsoir' : 'Bonjour') + (n ? ' ' + n : ''); };
const pending = () => store.missions.filter((m) => m.status === 'a_approuver').length;

const ST: Record<MissionStatus, string> = {brouillon: 'Brouillon', a_approuver: 'À approuver', approuvee: 'Approuvée', refusee: 'Refusée', envoyee: 'En cours', terminee: 'Terminée', echouee: 'Échouée'};
const PRIO: Record<Priority, string> = {haute: 'Haute', normale: 'Normale', basse: 'Basse'};
const nextPrio = (p?: Priority): Priority => p === 'haute' ? 'basse' : p === 'basse' ? 'normale' : 'haute';
const EMB: Record<AgentId, string> = {claude: 'crown', jarvis: 'wave', iris: 'mail', chronos: 'hourglass', kairos: 'tag', ulysse: 'compass', athena: 'book', argus: 'eye'};
const av = (id: AgentId, cls = '') => h('span', {class: 'av av-' + id + (cls ? ' ' + cls : ''), html: icon(EMB[id], cls === 'sm' ? 15 : 22), 'aria-hidden': 'true'});

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

/* ---------- accueil : l'orbe et « Comment puis-je vous aider ? » ---------- */
function home(): HTMLElement {
  const last = store.msgs.slice(-2), recent = last.length === 2 && Date.now() - last[1].at < 15 * 60000;
  const n = pending();
  return h('section', {class: 'home'},
    h('div', {class: 'stage'}, orb.el),
    h('p', {class: 'hi', text: hello()}),
    h('h1', {class: 'help', text: 'Comment puis-je vous aider ?'}),
    note ? h('p', {class: 'note', text: note}) : null,
    recent ? h('button', {type: 'button', class: 'last', onclick: () => show('command')}, h('small', {text: 'Toi : ' + last[0].text}), h('span', {text: last[1].text})) : null,
    n ? h('button', {type: 'button', class: 'nudge', onclick: () => show('missions')}, n + ' mission' + (n > 1 ? 's attendent' : ' attend') + ' ton accord ›') : null,
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
      lastJ ? h('p', {class: 'cap-j', text: lastJ.text}) : h('p', {class: 'cap-j dim', text: 'Parle normalement, je réponds à voix haute. « C\'est tout » pour finir.'})),
    note ? h('p', {class: 'note', text: note}) : null,
    h('div', {class: 'v-bar'},
      h('button', {type: 'button', class: 'v-side', 'aria-label': 'Passer au clavier', html: icon('key', 22), onclick: () => { voice.stop(); show('command'); }}),
      h('button', {type: 'button', class: 'mic' + (voice.state === 'listening' ? ' is-on' : '') + (speaking ? ' is-say' : ''), 'aria-label': speaking ? 'Couper la parole' : 'Arrêter la session', html: icon(speaking ? 'speaker' : 'mic', 30), onclick: micTap}),
      h('button', {type: 'button', class: 'v-side', 'aria-label': 'Terminer la session', html: icon('x', 22), onclick: () => { voice.stop(); paint(); }})));
}

/* ---------- centre de commandes (vert) ---------- */
function command(): HTMLElement {
  const msgs = store.msgs.slice(-80);
  return h('section', {class: 'cmd green'},
    h('header', {class: 'cmd-h'}, h('div', {}, h('h2', {text: 'Centre de commandes'}), h('small', {text: '0 agent relié · ' + AGENTS.length + ' prêts à recevoir des missions'})),
      h('button', {type: 'button', class: 'ic-btn', 'aria-label': 'Session vocale', html: icon('wave', 20), onclick: () => { show('home'); micTap(); }})),
    h('div', {class: 'chat', id: 'log'}, msgs.length ? msgs.map((m) => m.who === 'me' ? h('div', {class: 'b-me'}, h('p', {text: m.text}), h('time', {text: ago(m.at)})) :
      h('div', {class: 'b-ai'}, h('div', {class: 'b-head'}, av(m.agent || 'jarvis', 'sm'), h('b', {text: 'JARVIS' + (m.agent ? ' → ' + agent(m.agent).name : '')}), h('time', {text: ago(m.at)})), h('p', {text: m.text}),
        /Mission(s)? (commune )?cré/.test(m.text) || /missions créées/.test(m.text) ? h('div', {class: 'b-chips'}, h('span', {class: 'b-chip', text: 'Mission préparée'}), h('button', {type: 'button', class: 'b-chip link', onclick: () => show('missions')}, 'Voir les missions ›')) : null))
      : h('div', {class: 'chat-empty'}, h('p', {text: 'Tout ce que tu dis à JARVIS, à la voix ou au clavier, est écrit ici.'}), h('p', {class: 'dim', text: 'Essaie : « Demande à Kairos de vérifier le prix du robot ».'}))),
    note ? h('p', {class: 'note', text: note}) : null,
    askBox('cin', 'Tapez une commande…', 'cmd-ask'));
}

/* ---------- agents : la liste (cartes violettes) puis la fiche ---------- */
function stats(id: AgentId) {
  const ms = store.missions.filter((m) => m.agent === id);
  const today = ms.filter((m) => new Date(m.at).toDateString() === new Date().toDateString()).length;
  const ended = ms.filter((m) => ['terminee', 'echouee'].includes(m.status));
  return {ms, today, ok: ended.length ? Math.round(100 * ended.filter((m) => m.status === 'terminee').length / ended.length) + ' %' : '—', last: ms.length ? ago(Math.max(...ms.map((m) => m.at))) : '—', share: store.missions.length ? Math.round(100 * ms.length / store.missions.length) : 0};
}
function agents(): HTMLElement {
  const q = agentQuery.toLowerCase();
  const F: [string, string][] = [['tous', 'Tous'], ['actifs', 'Actifs'], ['veille', 'En veille'], ['off', 'Non reliés'], ['occupes', 'Occupés']];
  const list = AGENTS.filter((a) => (agentFilter === 'tous' || agentFilter === 'off') && (!q || (a.name + ' ' + a.role + ' ' + a.skills.join(' ')).toLowerCase().includes(q)));
  const search = h('input', {class: 'search-in', type: 'search', placeholder: 'Chercher un agent', value: agentQuery, 'aria-label': 'Chercher un agent'}) as HTMLInputElement;
  search.addEventListener('input', () => { agentQuery = search.value; const pos = search.selectionStart; render(); const s = document.querySelector('.search-in') as HTMLInputElement; if (s) { s.focus(); s.setSelectionRange(pos, pos); } });
  return h('section', {class: 'page agents'},
    h('span', {class: 'mini-orb'}),
    h('p', {class: 'intro', text: 'Voici tes agents, chacun avec ses capacités et ses pouvoirs.'}),
    h('div', {class: 'count'}, h('span', {text: 'Agents'}), h('b', {text: String(AGENTS.length)}), h('em', {text: '0 relié'})),
    h('label', {class: 'search'}, h('span', {html: icon('search', 18)}), search),
    h('div', {class: 'chips'}, F.map(([k, l]) => h('button', {type: 'button', 'aria-pressed': String(agentFilter === k), onclick: () => { agentFilter = k; render(); }}, l))),
    list.length ? h('div', {class: 'a-list'}, list.map((a) => { const s = stats(a.id);
      return h('button', {type: 'button', class: 'a-card', onclick: () => { agentSel = a.id; show('agent'); }},
        av(a.id), h('span', {class: 'a-txt'}, h('small', {text: s.ms.length + ' mission' + (s.ms.length > 1 ? 's' : '') + ' · ' + a.role}), h('b', {text: a.name})), h('span', {class: 'toggle', title: 'Non relié'})); }))
      : h('p', {class: 'empty', text: agentFilter === 'tous' || agentFilter === 'off' ? 'Aucun agent ne correspond.' : 'Aucun agent relié pour l\'instant : Claude arrive en phase 3, les bots Grok en phase 4.'}));
}
function agentPage(): HTMLElement {
  const a = agent(agentSel), s = stats(a.id);
  const acts = s.ms.slice().sort((x, y) => y.at - x.at).slice(0, 6);
  return h('section', {class: 'page agent-page'},
    h('header', {class: 'bar'}, h('button', {type: 'button', class: 'ic-btn', 'aria-label': 'Retour', html: icon('back', 20), onclick: () => show('agents')}), h('h2', {text: 'Agents'}), h('span', {class: 'ic-btn ghost', html: icon('dots', 20)})),
    h('article', {class: 'd-card'},
      h('div', {class: 'd-head'}, av(a.id), h('div', {}, h('b', {text: a.name}), h('small', {text: a.role})), h('span', {class: 'st-off', text: 'Non relié'})),
      h('div', {class: 'd-stats'}, h('div', {}, h('small', {text: "Aujourd'hui"}), h('b', {text: String(s.today)})), h('div', {}, h('small', {text: 'Réussite'}), h('b', {text: s.ok})), h('div', {}, h('small', {text: 'Dernière'}), h('b', {text: s.last}))),
      h('div', {class: 'usage'}, h('div', {}, h('small', {text: 'Part des missions'}), h('small', {text: s.share + ' %'})), h('i', {}, h('span', {style: 'width:' + s.share + '%'}))),
      h('ul', {class: 'skills'}, a.skills.map((k) => h('li', {text: k}))),
      h('p', {class: 'dim', text: a.link}),
      h('button', {type: 'button', class: 'btn main', onclick: () => { draftNext = 'Demande à ' + a.name.replace(' (Grok)', '') + ' de '; show('command'); }}, 'Lui confier une mission')),
    h('div', {class: 'sec-h'}, h('h3', {text: 'Activité récente'}), h('button', {type: 'button', class: 'link', onclick: () => show('missions')}, 'Voir tout')),
    acts.length ? acts.map((m) => h('div', {class: 'act notch'}, h('span', {class: 'act-ic', html: icon('missions', 18)}), h('div', {}, h('b', {text: ST[m.status] + ' · ' + m.text.slice(0, 54)}), h('small', {text: ago(m.at)})))) : h('p', {class: 'empty', text: 'Aucune mission pour ' + a.name + ' pour l\'instant.'}));
}

/* ---------- missions ---------- */
const COLS: [string, string, MissionStatus[]][] = [['a_approuver', 'À approuver', ['a_approuver', 'brouillon']], ['approuvee', 'Approuvées', ['approuvee']], ['envoyee', 'En cours', ['envoyee']], ['terminee', 'Terminées', ['terminee', 'echouee', 'refusee']]];
function missions(): HTMLElement {
  const act = (m: Mission, s: MissionStatus) => { m.status = s; if (s === 'terminee' || s === 'refusee') m.done = Date.now(); store.save(); render(); };
  const col = COLS.find((c) => c[0] === missionCol) || COLS[0];
  const list = store.missions.filter((m) => col[2].includes(m.status)).sort((a, b) => (a.priority === 'haute' ? -1 : 0) - (b.priority === 'haute' ? -1 : 0) || b.at - a.at);
  return h('section', {class: 'page'},
    h('h2', {class: 'title', text: 'Missions'}),
    h('p', {class: 'dim', text: "JARVIS les prépare, tu les approuves. L'envoi réel arrive en phase 3 (Claude) et 4 (Grok) : rien ne part pour l'instant."}),
    h('div', {class: 'k-tabs'}, COLS.map(([k, l, ss]) => h('button', {type: 'button', 'aria-pressed': String(missionCol === k), onclick: () => { missionCol = k; render(); }}, h('b', {text: String(store.missions.filter((m) => ss.includes(m.status)).length)}), h('span', {text: l})))),
    list.length ? list.map((m) => h('article', {class: 'm-card notch st-' + m.status},
      h('div', {class: 'm-top'}, av(m.agent, 'sm'), h('b', {text: agent(m.agent).name}),
        h('button', {type: 'button', class: 'prio p-' + (m.priority || 'normale'), 'aria-label': 'Priorité', onclick: () => { m.priority = nextPrio(m.priority); store.save(); render(); }}, PRIO[m.priority || 'normale']), h('time', {text: ago(m.at)})),
      h('p', {class: 'm-text', text: m.text}),
      m.group ? h('small', {class: 'dim', text: 'Mission commune'}) : null,
      m.status === 'approuvee' ? h('small', {class: 'dim', text: 'Envoi réel en phase ' + (agent(m.agent).provider === 'claude' ? '3' : '4') + '.'}) : null,
      h('div', {class: 'acts'},
        m.status === 'a_approuver' ? [h('button', {type: 'button', class: 'btn main', onclick: () => act(m, 'approuvee')}, 'Approuver'), h('button', {type: 'button', class: 'btn', onclick: () => act(m, 'refusee')}, 'Refuser')] : null,
        m.status === 'refusee' ? h('button', {type: 'button', class: 'btn', onclick: () => act(m, 'a_approuver')}, 'Reprendre') : null,
        h('button', {type: 'button', class: 'btn ghost', onclick: () => { store.missions = store.missions.filter((x) => x !== m); store.save(); render(); }}, 'Supprimer'))))
      : h('p', {class: 'empty', text: col[0] === 'a_approuver' ? 'Rien à approuver. Dis par exemple : « Demande à Kairos de vérifier le prix du robot ».' : 'Aucune mission ici.'}));
}

/* ---------- plus : salle de contrôle Jarvis et modules ---------- */
function more(): HTMLElement {
  const tile = (v: View, ic: string, t: string, s: string) => h('button', {type: 'button', class: 'tile notch', onclick: () => show(v)}, h('span', {class: 'tile-ic', html: icon(ic, 20)}), h('b', {text: t}), h('small', {text: s}), h('span', {class: 'more-l', text: 'Ouvrir ›'}));
  const mods = ['Demandes et oui', 'Agenda et présence', 'Achats et prix', 'Voyages', 'Sorties', 'Suivi du coût', 'Brouillons Gmail', 'Tri des mails'];
  return h('section', {class: 'page'},
    h('h2', {class: 'title', text: 'Plus'}),
    h('article', {class: 'salle'},
      h('div', {class: 'salle-h'}, h('span', {class: 'tile-ic', html: icon('core', 22)}), h('div', {}, h('b', {text: 'Salle de contrôle Jarvis'}), h('small', {text: 'Tes vraies données, en direct, dans l\'app Claude'}))),
      h('div', {class: 'mods'}, mods.map((m) => h('span', {text: m}))),
      h('a', {class: 'btn main', href: SALLE[store.settings.salle], target: '_blank', rel: 'noopener'}, h('span', {html: icon('ext', 16)}), ' Ouvrir la salle de contrôle'),
      h('small', {class: 'dim', text: 'Ces modules arriveront ici, dans JARVIS OS, quand le serveur sera relié (phase 3). D\'ici là, la page Jarvis reste ton tableau de bord.'})),
    h('div', {class: 'tiles'}, tile('automations', 'flow', 'Workflows', 'Le circuit des missions'), tile('intelligence', 'gauge', 'Intelligence', 'Activité et services'), tile('memory', 'memory', 'Mémoire', 'Tout ce qui a été dit'), tile('settings', 'gear', 'Réglages', 'Voix, prénom, écoute')),
    h('p', {class: 'small', text: 'JARVIS OS ' + VERSION + ' · phase ' + PHASE + ' (prototype) · ' + (matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone ? "ouvert depuis l'écran d'accueil" : 'ouvert dans le navigateur')}));
}
const back = () => h('button', {type: 'button', class: 'back', onclick: () => show('more')}, h('span', {html: icon('back', 16)}), 'Plus');

function constellation(): HTMLElement {
  const W = Math.min(window.innerWidth - 32, 420), H = 220, cv = h('canvas', {class: 'graph', width: String(W * 2), height: String(H * 2), style: `width:${W}px;height:${H}px`, 'aria-label': 'Graphe de la mémoire'}) as HTMLCanvasElement;
  const g = cv.getContext('2d'); if (!g) return cv;
  g.scale(2, 2);
  const used = AGENTS.filter((a) => store.missions.some((m) => m.agent === a.id));
  const hubs = (used.length ? used : AGENTS.slice(0, 4)).map((a, i, arr) => ({a, x: W / 2 + Math.cos(i / arr.length * Math.PI * 2) * W * 0.3, y: H / 2 + Math.sin(i / arr.length * Math.PI * 2) * H * 0.32}));
  hubs.forEach((hb) => { g.strokeStyle = 'rgba(139, 120, 255, .45)'; g.beginPath(); g.moveTo(W / 2, H / 2); g.lineTo(hb.x, hb.y); g.stroke(); });
  hubs.forEach((hb) => {
    const ms = store.missions.filter((m) => m.agent === hb.a.id).slice(-10);
    ms.forEach((m, j) => { const an = j / Math.max(1, ms.length) * Math.PI * 2 + hb.x, x = hb.x + Math.cos(an) * 34, y = hb.y + Math.sin(an) * 28; g.strokeStyle = 'rgba(96, 165, 250, .35)'; g.beginPath(); g.moveTo(hb.x, hb.y); g.lineTo(x, y); g.stroke(); g.fillStyle = m.status === 'a_approuver' ? '#fbbf24' : '#93c5fd'; g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = '#a78bfa'; g.beginPath(); g.arc(hb.x, hb.y, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#dcd6ff'; g.font = '600 11px -apple-system, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(hb.a.name.replace(' (Grok)', ''), hb.x, hb.y + 20);
  });
  const rg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 26); rg.addColorStop(0, '#e0e7ff'); rg.addColorStop(0.4, '#6d5dfc'); rg.addColorStop(1, 'rgba(109,93,252,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(W / 2, H / 2, 26, 0, Math.PI * 2); g.fill();
  return cv;
}
function memory(): HTMLElement {
  const q = h('input', {class: 'search-in', type: 'search', placeholder: 'Chercher dans la mémoire', 'aria-label': 'Chercher'}) as HTMLInputElement;
  const out = h('div', {class: 'stack'});
  const draw = () => { const s = q.value.trim().toLowerCase(); const ms = store.msgs.filter((m) => !s || m.text.toLowerCase().includes(s)).slice(-60).reverse();
    out.replaceChildren(...(ms.length ? ms.map((m) => h('div', {class: 'mem ' + m.who}, h('time', {text: (m.who === 'me' ? 'Toi' : 'JARVIS') + ' · ' + ago(m.at)}), h('p', {text: m.text}))) : [h('p', {class: 'empty', text: s ? 'Rien ne correspond.' : 'La mémoire est vide.'})])); };
  q.addEventListener('input', draw); draw();
  return h('section', {class: 'page'}, back(), h('h2', {class: 'title', text: 'Mémoire'}),
    h('div', {class: 'trio'}, h('div', {}, h('b', {text: String(store.msgs.length)}), h('small', {text: 'souvenirs'})), h('div', {}, h('b', {text: String(store.missions.length)}), h('small', {text: 'missions'})), h('div', {}, h('b', {text: String(new Set(store.missions.map((m) => m.agent)).size)}), h('small', {text: 'agents sollicités'}))),
    h('div', {class: 'panel'}, constellation()),
    h('p', {class: 'small', text: 'Gardée sur cet iPhone. En phase 3, la mémoire passera sur ton serveur et sera partagée avec les agents.'}),
    h('label', {class: 'search'}, h('span', {html: icon('search', 18)}), q), out,
    h('button', {type: 'button', class: 'btn danger', onclick: (e: Event) => { if (!clearArm) { clearArm = window.setTimeout(() => { clearArm = 0; render(); }, 5000); (e.target as HTMLElement).textContent = 'Confirmer : tout effacer'; return; } clearTimeout(clearArm); clearArm = 0; store.clearAll(); resetBrain(); render(); }}, 'Effacer la mémoire et les missions'));
}

/* ---------- workflows (vert) ---------- */
function automations(): HTMLElement {
  const node = (x: number, y: number, ic: string, t: string, s: string) => `<g transform="translate(${x} ${y})"><rect width="128" height="46" rx="12" fill="rgba(34,197,94,.13)" stroke="rgba(74,222,128,.45)"/><rect x="8" y="9" width="28" height="28" rx="8" fill="rgba(74,222,128,.18)"/><g transform="translate(12 13) scale(.83)" stroke="#86efac" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon(ic, 24).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g><text x="44" y="21" fill="#ecfdf5" font-size="11.5" font-weight="700">${t}</text><text x="44" y="35" fill="#86efac" font-size="9.5" opacity=".8">${s}</text></g>`;
  const link = (d: string) => `<path d="${d}" fill="none" stroke="#4ade80" stroke-width="1.6" stroke-dasharray="5 5" opacity=".75"/>`;
  const svg = `<svg viewBox="0 0 340 300" width="100%" role="img" aria-label="Circuit des missions prévu">${link('M170 56 V92')}${link('M150 138 C 150 160, 84 160, 84 182')}${link('M190 138 C 190 160, 256 160, 256 182')}${link('M84 228 C 84 248, 150 244, 150 254')}${link('M256 228 C 256 248, 190 244, 190 254')}
    ${node(106, 10, 'wave', 'Ta voix', 'iPhone')}${node(106, 92, 'core', 'JARVIS', 'routage, accord')}${node(20, 182, 'crown', 'Claude Code', 'phase 3')}${node(192, 182, 'bolt', 'Bots Grok', 'phase 4')}${node(106, 254, 'missions', 'Résultats', 'missions, alertes')}</svg>`;
  const autos: [string, string, string][] = [['Lancer une routine d\'un bot', 'Webhook Grok Bot', 'phase 4'], ['Lancer une tâche Claude Code', "Déclencheur d'API", 'phase 3'], ['Prévenir quand ton accord est nécessaire', 'Notification', 'phase 3'], ['Historique des exécutions', 'Résultats et coûts', 'phase 3']];
  return h('section', {class: 'page green'}, back(), h('h2', {class: 'title', text: 'Workflows'}),
    h('div', {class: 'chips'}, [['circuit', 'Circuit'], ['auto', 'Automatisations']].map(([k, l]) => h('button', {type: 'button', 'aria-pressed': String(wfTab === k), onclick: () => { wfTab = k; render(); }}, l))),
    wfTab === 'circuit' ? [h('div', {class: 'panel g-panel', html: svg}), h('p', {class: 'small', text: "Le circuit prévu. Rien n'est encore relié : chaque mission s'arrête à ton accord."})]
      : h('div', {class: 'stack'}, autos.map(([t, s, p]) => h('div', {class: 'g-row'}, h('span', {class: 'tile-ic', html: icon('flow', 18)}), h('div', {}, h('b', {text: t}), h('small', {text: s + ' · ' + p})), h('span', {class: 'switch', role: 'switch', 'aria-checked': 'false', 'aria-disabled': 'true', title: 'Pas encore relié'})))));
}
function gauge(v: number, label: string, txt: string, c: string) {
  const r = 30, L = 2 * Math.PI * r, off = L * (1 - Math.max(0, Math.min(1, v)));
  return h('div', {class: 'gauge', html: `<svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true"><circle cx="40" cy="40" r="${r}" fill="none" stroke="rgba(148,163,184,.16)" stroke-width="6"/><circle cx="40" cy="40" r="${r}" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${L.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 40 40)"/><text x="40" y="45" text-anchor="middle" fill="#eef0ff" font-size="15" font-weight="700">${txt}</text></svg><small>${label}</small>`});
}
function intelligence(): HTMLElement {
  const s = store.stats, avg = s.replyMs.length ? Math.round(s.replyMs.reduce((a, b) => a + b, 0) / s.replyMs.length) : 0;
  const voiceOk = s.voiceTurns + s.errors ? s.voiceTurns / (s.voiceTurns + s.errors) : 0;
  const approved = store.missions.length ? store.missions.filter((m) => ['approuvee', 'envoyee', 'terminee'].includes(m.status)).length / store.missions.length : 0;
  const llm: [string, string, boolean][] = [['Claude (en direct)', 'phase 3 · Claude Code sur ton serveur', false], ['Claude Code (missions)', "phase 3 · déclencheur d'API", false], ['Grok Bot', 'phase 4 · webhooks', false], ['Reconnaissance vocale', canListen() ? 'disponible sur cet appareil' : 'absente ici', canListen()], ['Voix de JARVIS', canSpeak() ? 'disponible' : 'absente ici', canSpeak()]];
  return h('section', {class: 'page'}, back(), h('h2', {class: 'title', text: 'Intelligence'}),
    h('div', {class: 'gauges'}, gauge(Math.min(1, s.turns / 50), 'Échanges', String(s.turns), '#60a5fa'), gauge(voiceOk, 'Micro réussi', Math.round(voiceOk * 100) + '%', '#8b5cf6'), gauge(approved, 'Missions approuvées', Math.round(approved * 100) + '%', '#c084fc'), gauge(Math.min(1, avg / 1000), 'Réponse locale', avg + 'ms', '#38bdf8')),
    h('h3', {class: 'cap', text: 'État des modèles et services'}),
    h('div', {class: 'llm'}, llm.map(([n, d, ok]) => h('div', {class: 'llm-row'}, h('span', {class: 'dot ' + (ok ? 'ok' : 'off')}), h('div', {}, h('b', {text: n}), h('small', {text: d})), h('span', {class: 'pill ' + (ok ? 'ok' : 'off'), text: ok ? 'Prêt' : 'Non relié'})))),
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
  return h('section', {class: 'page'}, back(), h('h2', {class: 'title', text: 'Réglages'}),
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
const TABS: [View, string, string][] = [['home', 'Accueil', 'home'], ['command', 'Commandes', 'chat'], ['agents', 'Agents', 'agents'], ['missions', 'Missions', 'missions'], ['more', 'Plus', 'more']];
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
  const n = document.querySelector('.ask-in') as HTMLInputElement | null; if (n && draft) { n.value = draft; if (focus) n.focus(); }
  toEnd();
}
function render() {
  const inVoice = view === 'home' && voice.active;
  document.body.className = 'v-' + view + (inVoice ? ' in-voice' : '') + (['command', 'automations'].includes(view) ? ' theme-green' : '');
  orb.wave(inVoice);
  const views: Record<View, () => HTMLElement> = {home: inVoice ? voiceView : home, command, agents, agent: agentPage, missions, more, memory, automations, intelligence, settings};
  app.replaceChildren(...[h('main', {class: 'main'}, views[view]()), inVoice ? null : nav()].filter((x): x is HTMLElement => !!x));
}

render();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
try { (window as any).speechSynthesis?.addEventListener?.('voiceschanged', () => { if (view === 'settings') render(); }); } catch { /* rien */ }
(window as any).__jarvis = {store, voice, think};
