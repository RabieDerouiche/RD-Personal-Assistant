/* JARVIS OS, phase 2 : la PWA vocale, style choisi le 15/11/2026 (sphère d'anneaux bleu-violet, cartes de verre violettes).
   Le cerveau en ligne arrive en phase 3 : ce qui n'est pas encore relié le dit toujours. */
import './style.css';
import {h, icon, ago} from './ui';
import {AGENTS, agent, type Agent, type AgentId} from './agents';
import {store, type Mission, type MissionStatus, type Priority, type RouteMode} from './store';
import {think, resetBrain} from './brain';
import {Voice, canListen, canSpeak, frenchVoices, type VoiceState} from './voice';
import {createHologram, type HoloState} from './hologram';

const PHASE = 2;
const VERSION = '0.2.1';
type View = 'center' | 'agents' | 'missions' | 'memory' | 'more' | 'automations' | 'intelligence' | 'settings';
let view: View = 'center';
let kb = false, live = '', note = '', clearArm = 0, holoState: HoloState = 'idle', agentFilter = 'tous', agentQuery = '', missionCol = 'a_approuver', agentOpen = '', draftNext = '';

const app = document.getElementById('app')!;
const holo = createHologram(Math.min(300, Math.max(220, window.innerWidth - 110)));
const setHolo = (s: HoloState) => { holoState = s; holo.set(s); const p = document.getElementById('pill'); if (p) { p.textContent = PILL[s]; p.dataset.s = s; } };
const PILL: Record<HoloState, string> = {idle: 'Système en veille', listening: "À l'écoute", thinking: 'Analyse en cours', executing: 'Mission créée', speaking: 'Réponse vocale', error: 'Micro indisponible'};
const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const hello = () => { const hr = new Date().getHours(); return hr >= 18 || hr < 5 ? 'Bonsoir.' : 'Bonjour.'; };

const ST: Record<MissionStatus, string> = {brouillon: 'Brouillon', a_approuver: 'À approuver', approuvee: 'Approuvée', refusee: 'Refusée', envoyee: 'En cours', terminee: 'Terminée', echouee: 'Échouée'};
const PRIO: Record<Priority, string> = {haute: 'Haute', normale: 'Normale', basse: 'Basse'};
const nextPrio = (p?: Priority): Priority => p === 'haute' ? 'basse' : p === 'basse' ? 'normale' : 'haute';

/* ---------- la voix ---------- */
const voice = new Voice({
  mode: () => store.settings.listenMode, voiceURI: () => store.settings.voiceURI, rate: () => store.settings.rate,
  onState: (s, why) => {
    const map: Record<VoiceState, HoloState> = {off: 'idle', listening: 'listening', waiting: 'thinking', speaking: 'speaking', error: 'error'};
    setHolo(map[s]);
    if (s === 'error' && why) { note = 'Micro : ' + why + '. Écris ta demande avec le clavier.'; store.stats.errors++; store.save(); kb = true; }
    if (s === 'listening') note = '';
    paint();
  },
  onPartial: (t) => { live = t; const n = document.getElementById('live'); if (n) n.textContent = t; },
  onUtterance: (t) => { store.stats.voiceTurns++; handle(t, true); }
});

function handle(text: string, byVoice: boolean) {
  const t0 = performance.now();
  store.add({who: 'me', text, at: Date.now()}); store.stats.turns++;
  setHolo('thinking');
  const out = think(text, store.settings.route);
  if (out.missions && out.missions.length) { store.missions.push(...out.missions.map((m) => ({...m, priority: 'normale' as Priority}))); setHolo('executing'); }
  store.add({who: 'jarvis', text: out.reply, at: Date.now(), agent: out.agent});
  store.stats.replyMs.push(Math.round(performance.now() - t0)); store.save();
  live = ''; paint();
  const go = () => { if (out.nav) { voice.stop(); show(out.nav as View); } if (out.end) { voice.stop(); resetBrain(); paint(); } };
  if ((byVoice || voice.active) && canSpeak() && !out.end) voice.speak(out.reply, go);
  else if (canSpeak() && out.end) voice.speak(out.reply, () => { voice.stop(); go(); });
  else { setTimeout(() => setHolo('idle'), 900); go(); }
}
const micTap = () => {
  if (!canListen()) { kb = true; note = 'Pas de micro ici : écris ta demande.'; paint(); return; }
  if (voice.state === 'speaking') { voice.interrupt(); return; }
  if (voice.active) { voice.stop(); return; }
  note = ''; voice.start();
};

/* ---------- 01 · centre de commandes ---------- */
function center(): HTMLElement {
  const d = new Date(), on = voice.active, speaking = voice.state === 'speaking';
  const session = store.msgs.slice(-6);
  const input = h('input', {class: 'ask-in', id: 'in', type: 'text', placeholder: 'Demandez quelque chose…', enterkeyhint: 'send', autocomplete: 'off', 'aria-label': 'Votre demande'}) as HTMLInputElement;
  if (draftNext) { input.value = draftNext; draftNext = ''; setTimeout(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); input.scrollIntoView({block: 'center'}); }, 50); }
  const send = () => { const v = input.value.trim(); if (!v) return; input.value = ''; handle(v, false); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !(e as KeyboardEvent).isComposing) { e.preventDefault(); send(); } });
  const quick = ['Quelles sont les missions en attente ?', 'Fais le point', "Demande à Claude d'analyser mes documents", 'Demande à Kairos de vérifier mes prix'];
  return h('section', {class: 'center' + (on ? ' in-session' : '')},
    h('p', {class: 'kicker', text: DAYS[d.getDay()] + ' · Command Center'}),
    h('h1', {class: 'hello', text: hello()}),
    h('p', {class: 'sub', text: 'Je suis à votre écoute.'}),
    h('div', {class: 'orb-panel'}, holo.el),
    h('span', {class: 'pill-state', id: 'pill', 'data-s': holoState, text: PILL[holoState]}),
    h('p', {class: 'live', id: 'live', 'aria-live': 'polite', text: live || (on ? '' : 'Touchez le microphone pour démarrer une session.')}),
    note ? h('p', {class: 'note', text: note}) : null,
    h('button', {type: 'button', class: 'mic' + (voice.state === 'listening' ? ' is-on' : '') + (speaking ? ' is-say' : ''), 'aria-label': speaking ? 'Couper la parole' : on ? 'Arrêter la session' : 'Démarrer une session vocale', html: icon(on ? (speaking ? 'speaker' : 'stop') : 'mic', 30), onclick: micTap}),
    h('div', {class: 'seg route', role: 'group', 'aria-label': 'Agent'}, (['auto', 'claude', 'grok'] as RouteMode[]).map((r) => h('button', {type: 'button', 'aria-pressed': String(store.settings.route === r), onclick: () => { store.settings.route = r; store.save(); paint(); }}, r.toUpperCase()))),
    session.length ? h('div', {class: 'thread', id: 'log'}, session.map((m) => h('div', {class: 'msg ' + m.who}, m.who === 'jarvis' ? h('span', {class: 'who', text: 'JARVIS' + (m.agent ? ' → ' + agent(m.agent).name : '')}) : null, h('p', {text: m.text})))) : null,
    h('div', {class: 'chips'}, quick.map((q) => h('button', {type: 'button', class: 'chip-q', onclick: () => handle(q, voice.active)}, q))),
    h('div', {class: 'ask' + (kb ? ' open' : '')}, input, h('button', {type: 'button', class: 'ask-btn', 'aria-label': 'Envoyer', html: icon('send', 18), onclick: send})));
}

/* ---------- 02 · agents ---------- */
const AV: Record<AgentId, string> = {claude: '✳', jarvis: 'J', iris: 'I', chronos: 'C', kairos: 'K', ulysse: 'U', athena: 'A', argus: 'Ar'};
function agentStats(a: Agent) {
  const ms = store.missions.filter((m) => m.agent === a.id);
  const today = ms.filter((m) => new Date(m.at).toDateString() === new Date().toDateString()).length;
  const ended = ms.filter((m) => ['terminee', 'echouee'].includes(m.status));
  const ok = ended.length ? Math.round(100 * ended.filter((m) => m.status === 'terminee').length / ended.length) + ' %' : '—';
  const last = ms.length ? ago(Math.max(...ms.map((m) => m.at))) : '—';
  return {ms, today, ok, last};
}
function agents(): HTMLElement {
  const total = Math.max(1, store.missions.length);
  const q = agentQuery.toLowerCase();
  const list = AGENTS.filter((a) => (agentFilter === 'tous' || a.provider === agentFilter) && (!q || (a.name + ' ' + a.role + ' ' + a.skills.join(' ')).toLowerCase().includes(q)));
  const search = h('input', {class: 'search', type: 'search', placeholder: 'Chercher un agent', value: agentQuery, 'aria-label': 'Chercher un agent'}) as HTMLInputElement;
  search.addEventListener('input', () => { agentQuery = search.value; const pos = search.selectionStart; render(); const s = document.querySelector('.search') as HTMLInputElement; if (s) { s.focus(); s.setSelectionRange(pos, pos); } });
  const recent = store.missions.slice().sort((a, b) => b.at - a.at).slice(0, 5);
  return h('section', {class: 'page'},
    h('h2', {text: 'Agents'}),
    h('p', {class: 'lead', text: AGENTS.length + ' agents · aucun relié pour l\'instant (Claude en phase 3, bots Grok en phase 4).'}),
    search,
    h('div', {class: 'filters'}, [['tous', 'Tous'], ['claude', 'Claude'], ['grok', 'Grok']].map(([k, l]) => h('button', {type: 'button', 'aria-pressed': String(agentFilter === k), onclick: () => { agentFilter = k; render(); }}, l))),
    h('div', {class: 'ag-grid'}, list.map((a) => { const s = agentStats(a), open = agentOpen === a.id;
      return h('article', {class: 'agent-card ' + a.provider + (open ? ' open' : ''), tabindex: '0', role: 'button', 'aria-expanded': String(open), onclick: (e: Event) => { if ((e.target as HTMLElement).closest('.btn')) return; agentOpen = open ? '' : a.id; render(); }, onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); agentOpen = open ? '' : a.id; render(); } }},
        h('div', {class: 'ag-top'}, h('span', {class: 'avatar ' + a.provider, text: AV[a.id]}), h('span', {class: 'state-tag', text: 'Non relié'})),
        h('div', {class: 'ag-id'}, h('b', {text: a.name}), h('span', {text: a.role})),
        h('div', {class: 'ag-stats'}, h('div', {}, h('small', {text: 'Missions'}), h('b', {text: String(s.ms.length)})), h('div', {}, h('small', {text: 'Réussite'}), h('b', {text: s.ok})), open ? h('div', {}, h('small', {text: "Aujourd'hui"}), h('b', {text: String(s.today)})) : null),
        h('div', {class: 'usage'}, h('small', {text: 'Dernière : ' + s.last}), h('i', {}, h('span', {style: 'width:' + Math.round(100 * s.ms.length / total) + '%'}))),
        open ? [h('ul', {class: 'skills'}, a.skills.map((k) => h('li', {text: k}))), h('p', {class: 'ag-link', text: a.link}),
          h('button', {type: 'button', class: 'btn main', onclick: () => { draftNext = 'Demande à ' + a.name.replace(' (Grok)', '') + ' de '; show('center'); }}, 'Lui confier une mission')] : null); })),
    h('h3', {text: 'Activité récente'}),
    recent.length ? h('div', {class: 'activity'}, recent.map((m) => h('div', {class: 'act-row'}, h('span', {class: 'avatar sm ' + agent(m.agent).provider, text: AV[m.agent]}), h('div', {}, h('b', {text: agent(m.agent).name + ' · ' + ST[m.status]}), h('small', {text: ago(m.at) + ' · ' + m.text.slice(0, 60)}))))) : h('p', {class: 'empty', text: 'Aucune activité pour l\'instant.'}));
}

/* ---------- 03 · missions ---------- */
const COLS: [string, string, MissionStatus[]][] = [['a_approuver', 'À approuver', ['a_approuver', 'brouillon']], ['approuvee', 'Approuvées', ['approuvee']], ['envoyee', 'En cours', ['envoyee']], ['terminee', 'Terminées', ['terminee', 'echouee', 'refusee']]];
function missions(): HTMLElement {
  const act = (m: Mission, s: MissionStatus) => { m.status = s; if (s === 'terminee' || s === 'refusee') m.done = Date.now(); store.save(); render(); };
  const col = COLS.find((c) => c[0] === missionCol) || COLS[0];
  const list = store.missions.filter((m) => col[2].includes(m.status)).sort((a, b) => (a.priority === 'haute' ? -1 : 0) - (b.priority === 'haute' ? -1 : 0) || b.at - a.at);
  return h('section', {class: 'page'},
    h('h2', {text: 'Missions'}),
    h('p', {class: 'lead', text: "JARVIS prépare les missions et attend ton accord. L'envoi réel arrive en phase 3 (Claude) et 4 (Grok) : rien ne part pour l'instant."}),
    h('div', {class: 'kanban-tabs'}, COLS.map(([k, l, ss]) => { const n = store.missions.filter((m) => ss.includes(m.status)).length; return h('button', {type: 'button', 'aria-pressed': String(missionCol === k), onclick: () => { missionCol = k; render(); }}, h('span', {text: l}), h('b', {text: String(n)})); })),
    list.length ? list.map((m) => h('article', {class: 'mcard st-' + m.status},
      h('div', {class: 'mc-top'}, h('span', {class: 'avatar sm ' + agent(m.agent).provider, text: AV[m.agent]}), h('b', {text: agent(m.agent).name}),
        h('button', {type: 'button', class: 'prio p-' + (m.priority || 'normale'), title: 'Changer la priorité', onclick: () => { m.priority = nextPrio(m.priority); store.save(); render(); }}, PRIO[m.priority || 'normale']), h('time', {text: ago(m.at)})),
      h('p', {class: 'mc-text', text: m.text}),
      m.group ? h('small', {class: 'muted', text: 'Mission commune'}) : null,
      m.status === 'approuvee' ? h('small', {class: 'muted', text: 'Envoi réel en phase ' + (agent(m.agent).provider === 'claude' ? '3' : '4') + '.'}) : null,
      h('div', {class: 'acts'},
        m.status === 'a_approuver' ? [h('button', {type: 'button', class: 'btn main', onclick: () => act(m, 'approuvee')}, 'Approuver'), h('button', {type: 'button', class: 'btn', onclick: () => act(m, 'refusee')}, 'Refuser')] : null,
        m.status === 'refusee' ? h('button', {type: 'button', class: 'btn', onclick: () => act(m, 'a_approuver')}, 'Reprendre') : null,
        h('button', {type: 'button', class: 'btn ghost', onclick: () => { store.missions = store.missions.filter((x) => x !== m); store.save(); render(); }}, 'Supprimer')))) : h('p', {class: 'empty', text: col[0] === 'a_approuver' ? 'Rien à approuver. Dis par exemple : « Demande à Kairos de vérifier le prix du robot ».' : 'Aucune mission ici.'}));
}

/* ---------- 04 · mémoire : constellation et recherche ---------- */
function constellation(): HTMLElement {
  const W = Math.min(window.innerWidth - 32, 420), H = 230, cv = h('canvas', {class: 'graph', width: String(W * 2), height: String(H * 2), style: `width:${W}px;height:${H}px`, 'aria-label': 'Graphe de la mémoire'}) as HTMLCanvasElement;
  const g = cv.getContext('2d'); if (!g) return cv;
  g.scale(2, 2);
  const used = AGENTS.filter((a) => store.missions.some((m) => m.agent === a.id));
  const hubs = (used.length ? used : AGENTS.slice(0, 4)).map((a, i, arr) => ({a, x: W / 2 + Math.cos(i / arr.length * Math.PI * 2) * W * 0.3, y: H / 2 + Math.sin(i / arr.length * Math.PI * 2) * H * 0.32}));
  const core = {x: W / 2, y: H / 2};
  g.lineWidth = 1;
  hubs.forEach((hb) => { g.strokeStyle = 'rgba(125, 140, 255, .45)'; g.beginPath(); g.moveTo(core.x, core.y); g.lineTo(hb.x, hb.y); g.stroke(); });
  hubs.forEach((hb) => {
    const ms = store.missions.filter((m) => m.agent === hb.a.id).slice(-10);
    ms.forEach((m, j) => { const an = j / Math.max(1, ms.length) * Math.PI * 2 + hb.x, x = hb.x + Math.cos(an) * 34, y = hb.y + Math.sin(an) * 30; g.strokeStyle = 'rgba(56, 189, 248, .35)'; g.beginPath(); g.moveTo(hb.x, hb.y); g.lineTo(x, y); g.stroke(); g.fillStyle = m.status === 'a_approuver' ? '#fbbf24' : '#7dd3fc'; g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = hb.a.provider === 'claude' ? '#f0abfc' : '#67e8f9'; g.beginPath(); g.arc(hb.x, hb.y, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c7d2fe'; g.font = '600 11px -apple-system, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(hb.a.name.replace(' (Grok)', ''), hb.x, hb.y + 20);
  });
  const rg = g.createRadialGradient(core.x, core.y, 0, core.x, core.y, 26); rg.addColorStop(0, '#e0f2fe'); rg.addColorStop(0.4, '#6366f1'); rg.addColorStop(1, 'rgba(99,102,241,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(core.x, core.y, 26, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e0e7ff'; g.font = '700 10px -apple-system, system-ui, sans-serif'; g.fillText('JARVIS', core.x, core.y + 3);
  return cv;
}
function memory(): HTMLElement {
  const q = h('input', {class: 'search', type: 'search', placeholder: 'Chercher dans la mémoire', 'aria-label': 'Chercher'}) as HTMLInputElement;
  const out = h('div', {class: 'stack'});
  const draw = () => { const s = q.value.trim().toLowerCase(); const ms = store.msgs.filter((m) => !s || m.text.toLowerCase().includes(s)).slice(-60).reverse();
    out.replaceChildren(...(ms.length ? ms.map((m) => h('div', {class: 'mem ' + m.who}, h('time', {text: (m.who === 'me' ? 'Toi' : 'JARVIS') + ' · ' + ago(m.at)}), h('p', {text: m.text}))) : [h('p', {class: 'empty', text: s ? 'Rien ne correspond.' : 'La mémoire est vide.'})])); };
  q.addEventListener('input', draw); draw();
  return h('section', {class: 'page'}, h('h2', {text: 'Mémoire'}),
    h('div', {class: 'mem-stats'}, h('div', {}, h('b', {text: String(store.msgs.length)}), h('small', {text: 'souvenirs'})), h('div', {}, h('b', {text: String(store.missions.length)}), h('small', {text: 'missions'})), h('div', {}, h('b', {text: String(new Set(store.missions.map((m) => m.agent)).size)}), h('small', {text: 'agents sollicités'}))),
    h('div', {class: 'panel'}, constellation()),
    h('p', {class: 'small', text: "Gardée sur cet iPhone. En phase 3, la mémoire passera sur ton serveur et sera partagée avec les agents."}),
    q, out,
    h('button', {type: 'button', class: 'btn danger', onclick: (e: Event) => { if (!clearArm) { clearArm = window.setTimeout(() => { clearArm = 0; render(); }, 5000); (e.target as HTMLElement).textContent = 'Confirmer : tout effacer'; return; } clearTimeout(clearArm); clearArm = 0; store.clearAll(); resetBrain(); render(); }}, 'Effacer la mémoire et les missions'));
}

/* ---------- plus ---------- */
function more(): HTMLElement {
  const item = (v: View, n: string, t: string, s: string) => h('button', {type: 'button', class: 'more-card', onclick: () => show(v)}, h('span', {class: 'num', text: n}), h('b', {text: t}), h('span', {class: 'muted', text: s}));
  return h('section', {class: 'page'}, h('h2', {text: 'Plus'}),
    item('automations', '05', 'Automatisations', 'Routines des bots, tâches de Claude, déclencheurs'),
    item('intelligence', '06', 'Intelligence', 'Activité, modèles, temps de réponse'),
    item('settings', '07', 'Réglages', 'Voix, écoute, agent par défaut, approbation'),
    h('p', {class: 'small', text: 'JARVIS OS ' + VERSION + ' · phase ' + PHASE + ' (prototype) · ' + ((matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone ? "ouvert depuis l'écran d'accueil" : 'ouvert dans le navigateur')}));
}
function automations(): HTMLElement {
  const node = (x: number, y: number, w: number, t: string, c: string, sub: string) => `<g><rect x="${x}" y="${y}" width="${w}" height="40" rx="10" fill="${c}" fill-opacity=".18" stroke="${c}" stroke-opacity=".7"/><text x="${x + w / 2}" y="${y + 17}" text-anchor="middle" fill="#e0e7ff" font-size="11" font-weight="700">${t}</text><text x="${x + w / 2}" y="${y + 31}" text-anchor="middle" fill="#94a3b8" font-size="9">${sub}</text></g>`;
  const link = (x1: number, y1: number, x2: number, y2: number, c: string) => `<path d="M${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}" fill="none" stroke="${c}" stroke-width="1.6" stroke-dasharray="4 4" opacity=".8"/>`;
  const svg = `<svg viewBox="0 0 340 300" width="100%" role="img" aria-label="Schéma des automatisations prévues">
    ${link(170, 50, 170, 90, '#22d3ee')}${link(170, 130, 80, 180, '#f0abfc')}${link(170, 130, 260, 180, '#67e8f9')}${link(80, 220, 170, 250, '#a78bfa')}${link(260, 220, 170, 250, '#a78bfa')}
    ${node(120, 10, 100, 'Ta voix', '#22d3ee', 'iPhone')}${node(110, 90, 120, 'JARVIS', '#818cf8', 'routage, accord')}
    ${node(20, 180, 120, 'Claude Code', '#f0abfc', 'phase 3 · déclencheur')}${node(200, 180, 120, 'Bots Grok', '#67e8f9', 'phase 4 · webhook')}
    ${node(110, 250, 120, 'Résultats', '#a78bfa', 'missions, alertes')}</svg>`;
  return h('section', {class: 'page'}, back(), h('h2', {text: 'Automatisations'}),
    h('p', {class: 'lead', text: "Le circuit prévu. Rien n'est encore relié : les routines et les tâches planifiées s'afficheront ici, avec leurs déclencheurs et leurs dernières exécutions."}),
    h('div', {class: 'panel', html: svg}),
    h('div', {class: 'card'}, h('b', {text: 'À venir'}), h('ul', {class: 'skills'}, ["Lancer une routine d'un bot (webhook Grok Bot) — phase 4", "Lancer une tâche Claude Code (déclencheur d'API) — phase 3", 'Historique des exécutions et des résultats', 'Notification quand ton accord est nécessaire'].map((s) => h('li', {text: s})))));
}
function gauge(v: number, label: string, txt: string, c: string) {
  const r = 30, L = 2 * Math.PI * r, off = L * (1 - Math.max(0, Math.min(1, v)));
  return h('div', {class: 'gauge', html: `<svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true"><circle cx="40" cy="40" r="${r}" fill="none" stroke="rgba(148,163,184,.18)" stroke-width="6"/><circle cx="40" cy="40" r="${r}" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${L.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 40 40)"/><text x="40" y="45" text-anchor="middle" fill="#e0e7ff" font-size="15" font-weight="700">${txt}</text></svg><small>${label}</small>`});
}
function intelligence(): HTMLElement {
  const s = store.stats, avg = s.replyMs.length ? Math.round(s.replyMs.reduce((a, b) => a + b, 0) / s.replyMs.length) : 0;
  const voiceOk = s.voiceTurns + s.errors ? s.voiceTurns / (s.voiceTurns + s.errors) : 0;
  const approved = store.missions.length ? store.missions.filter((m) => ['approuvee', 'envoyee', 'terminee'].includes(m.status)).length / store.missions.length : 0;
  const llm: [string, string, boolean][] = [['Claude (en direct)', 'phase 3 · serveur Claude Code', false], ['Claude Code (missions)', 'phase 3 · déclencheur d\'API', false], ['Grok Bot', 'phase 4 · webhooks', false], ['Reconnaissance vocale', canListen() ? 'disponible sur cet appareil' : 'absente ici', canListen()], ['Voix de JARVIS', canSpeak() ? 'disponible' : 'absente ici', canSpeak()]];
  return h('section', {class: 'page'}, back(), h('h2', {text: 'Intelligence'}),
    h('div', {class: 'gauges'}, gauge(Math.min(1, s.turns / 50), 'Échanges', String(s.turns), '#22d3ee'), gauge(voiceOk, 'Micro réussi', Math.round(voiceOk * 100) + '%', '#818cf8'), gauge(approved, 'Missions approuvées', Math.round(approved * 100) + '%', '#c084fc'), gauge(Math.min(1, avg / 1000), 'Réponse locale', avg + 'ms', '#67e8f9')),
    h('h3', {text: 'État des modèles et services'}),
    h('div', {class: 'llm'}, llm.map(([n, d, ok]) => h('div', {class: 'llm-row'}, h('span', {class: 'dot ' + (ok ? 'ok' : 'off')}), h('div', {}, h('b', {text: n}), h('small', {text: d})), h('span', {class: 'pill ' + (ok ? 'ok' : 'off'), text: ok ? 'Prêt' : 'Non relié'})))),
    h('p', {class: 'small', text: 'La consommation de tes abonnements Claude et Grok s\'affichera ici quand ils seront reliés.'}));
}
function settings(): HTMLElement {
  const st = store.settings, vs = frenchVoices();
  const sel = h('select', {class: 'search', 'aria-label': 'Voix', onchange: (e: Event) => { st.voiceURI = (e.target as HTMLSelectElement).value; store.save(); }},
    h('option', {value: '', text: "Voix des réglages de l'iPhone (recommandé)"}), vs.map((v) => h('option', {value: v.voiceURI || v.name, text: v.name + ' · ' + v.lang}))) as HTMLSelectElement;
  sel.value = st.voiceURI;
  const seg = (k: 'listenMode' | 'route', opts: [string, string][]) => h('div', {class: 'seg'}, opts.map(([v, l]) => h('button', {type: 'button', 'aria-pressed': String((st as any)[k] === v), onclick: () => { (st as any)[k] = v; store.save(); render(); }}, l)));
  return h('section', {class: 'page'}, back(), h('h2', {text: 'Réglages'}),
    h('label', {class: 'lbl', text: 'Voix de JARVIS'}), sel,
    h('p', {class: 'small', text: "Voix plus naturelle : Réglages de l'iPhone, Accessibilité, Read & Speak (Contenu énoncé), Voix, Français, puis une voix « améliorée » ou « premium »."}),
    h('label', {class: 'lbl', text: 'Vitesse'}), h('input', {type: 'range', min: '0.8', max: '1.3', step: '0.05', value: String(st.rate), 'aria-label': 'Vitesse de la voix', oninput: (e: Event) => { st.rate = +(e.target as HTMLInputElement).value; store.save(); }}),
    h('button', {type: 'button', class: 'btn', onclick: () => voice.speak('Bonsoir, je suis JARVIS. Voici ma voix.')}, 'Essayer la voix'),
    h('label', {class: 'lbl', text: 'Écoute'}), seg('listenMode', [['phrase', 'Phrase par phrase'], ['continu', 'Écoute continue']]),
    h('label', {class: 'lbl', text: 'Agent par défaut'}), seg('route', [['auto', 'AUTO'], ['claude', 'CLAUDE'], ['grok', 'GROK']]),
    h('label', {class: 'check'}, h('input', {type: 'checkbox', checked: st.approveAll ? true : null, onchange: (e: Event) => { st.approveAll = (e.target as HTMLInputElement).checked; store.save(); }}), ' Demander mon accord avant chaque mission'));
}
const back = () => h('button', {type: 'button', class: 'back', onclick: () => show('more')}, '‹ Plus');

/* ---------- la navigation ---------- */
const TABS: [View, string, string][] = [['center', 'Centre', 'core'], ['agents', 'Agents', 'agents'], ['missions', 'Missions', 'missions'], ['memory', 'Mémoire', 'memory'], ['more', 'Plus', 'more']];
function nav(): HTMLElement {
  const cur = ['automations', 'intelligence', 'settings'].includes(view) ? 'more' : view;
  const pend = store.missions.filter((m) => m.status === 'a_approuver').length;
  return h('nav', {class: 'tabs', id: 'tabs', 'aria-label': 'Modules'}, TABS.map(([v, l, ic]) => h('button', {type: 'button', 'aria-current': cur === v ? 'page' : null, onclick: () => show(v)}, h('span', {class: 'ti', html: icon(ic, 21)}), h('span', {text: l}), v === 'missions' && pend ? h('b', {class: 'badge', text: String(pend)}) : null)));
}
function show(v: View) { view = v; render(); window.scrollTo(0, 0); }
function paint() {
  if (view !== 'center') { const n = document.getElementById('tabs'); if (n) n.replaceWith(nav()); return; }
  const old = document.getElementById('in') as HTMLInputElement | null; const draft = old ? old.value : '', focus = !!old && document.activeElement === old;
  render();
  const n = document.getElementById('in') as HTMLInputElement | null; if (n) { n.value = draft; if (focus) n.focus(); }
  const lg = document.getElementById('log'); if (lg) { lg.scrollTop = lg.scrollHeight; if (voice.active) lg.scrollIntoView({block: 'nearest'}); }
}
function render() {
  const views: Record<View, () => HTMLElement> = {center, agents, missions, memory, more, automations, intelligence, settings};
  const top = h('header', {class: 'top'}, h('span', {class: 'logo', html: icon('core', 22)}), h('div', {class: 'brand'}, h('b', {text: 'J.A.R.V.I.S.'}), h('small', {text: 'Personal Agentic OS'})), h('span', {class: 'chip', title: 'Phase 2 : prototype', text: 'Prototype'}));
  app.replaceChildren(top, h('main', {class: 'main view-' + view}, views[view]()), nav());
}

render();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
try { (window as any).speechSynthesis?.addEventListener?.('voiceschanged', () => { if (view === 'settings') render(); }); } catch { /* rien */ }
(window as any).__jarvis = {store, voice, think};
