/* Le cerveau de la phase 2 : il comprend les demandes simples sur l'iPhone, sans IA. Il prépare les missions
   et dit franchement ce qui n'est pas encore relié. En phase 3, les phrases qu'il ne comprend pas iront à Claude. */
import {AGENTS, agent, type AgentId} from './agents';
import {store, uid, type Mission, type RouteMode} from './store';

export interface BrainOut { reply: string; missions?: Mission[]; end?: boolean; nav?: string; agent?: AgentId }
let pending: {agent: AgentId; text: string} | null = null;

const clean = (t: string) => t.trim().replace(/[’]/g, "'").replace(/^(ok |bon |alors |dis |hey )?(jarvis)[,. ]+/i, '').replace(/[.!?…]+$/, '').trim();
const low = (t: string) => t.toLowerCase();
const NAMED: [RegExp, AgentId][] = [[/\bclaude\b/i, 'claude'], [/\bgrok\b/i, 'jarvis'], [/\biris\b/i, 'iris'], [/\bchronos\b/i, 'chronos'], [/\bkairos\b/i, 'kairos'], [/\bulysse\b/i, 'ulysse'], [/\bath[ée]na\b/i, 'athena'], [/\bargus\b/i, 'argus']];
const named = (t: string): AgentId[] => NAMED.filter(([re]) => re.test(t)).map(([, id]) => id);

/* qui doit s'en charger : le nom cité, sinon le mode forcé, sinon les mots de la demande */
export function route(text: string, mode: RouteMode): AgentId {
  const n = named(text);
  if (n.length) return n[0];
  if (mode === 'claude') return 'claude';
  const hit = AGENTS.filter((a) => a.id !== 'claude' && a.id !== 'jarvis').find((a) => a.keywords.test(text));
  if (mode === 'grok') return hit ? hit.id : 'jarvis';
  if (agent('claude').keywords.test(text)) return 'claude';
  return hit ? hit.id : 'claude';
}

const mission = (a: AgentId, text: string, group?: string): Mission => ({id: uid(), agent: a, text: text.trim(), status: store.settings.approveAll ? 'a_approuver' : 'approuvee', at: Date.now(), group});
const join = (xs: string[]) => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' et ' + xs[xs.length - 1];
const waitTxt = (n = 1) => store.settings.approveAll ? (n > 1 ? 'Elles attendent' : 'Elle attend') + ' ton accord dans Missions.' : (n > 1 ? 'Je les enverrai' : "Je l'enverrai") + ' dès que je serai relié, en phase 3.';

export function think(raw: string, mode: RouteMode): BrainOut {
  const t = clean(raw), l = low(t);
  if (!t) return {reply: "Je n'ai rien entendu."};

  /* une réponse à ma question « j'en fais une mission ? » */
  if (pending) {
    const p = pending; pending = null;
    if (/^(oui|ouais|vas-y|d'accord|ok|fais-le|envoie)\b/i.test(l)) { const m = mission(p.agent, p.text); return {reply: 'Mission créée pour ' + agent(p.agent).name + '. ' + waitTxt(), missions: [m], agent: p.agent}; }
    if (/^(non|laisse|annule|pas besoin)\b/i.test(l)) return {reply: "D'accord, je laisse tomber."};
  }

  if (/^(merci,? )?(c'est tout|au revoir|stop|termin[ée]e?|bonne nuit|on arr[eê]te)( merci)?$/i.test(l)) return {reply: 'À plus tard.', end: true};

  const nav = l.match(/^(ouvre|montre(-| )?moi|affiche|va (sur|dans|à))\s+(l'|la |le |les |mes |mon |ma )?(missions?|agents?|m[ée]moire|historique|r[ée]glages|automatisations?|statistiques|intelligence)/);
  if (nav) { const w = nav[nav.length - 1]; const v = /mission/.test(w) ? 'missions' : /agent/.test(w) ? 'agents' : /m[ée]moire|historique/.test(w) ? 'memory' : /r[ée]glage/.test(w) ? 'settings' : /auto/.test(w) ? 'automations' : 'intelligence'; return {reply: "J'ouvre " + (v === 'memory' ? 'la mémoire' : v === 'settings' ? 'les réglages' : 'les ' + w) + '.', nav: v}; }

  if (/(t[aâ]ches|missions?|demandes?) (en attente|en cours|à approuver)|qu'est-ce qui (attend|reste)|o[uù] en (sont|est) (mes )?(missions?|t[aâ]ches)/.test(l)) {
    const open = store.missions.filter((m) => ['brouillon', 'a_approuver', 'approuvee', 'envoyee'].includes(m.status));
    if (!open.length) return {reply: 'Aucune mission en attente.'};
    return {reply: open.length + ' mission' + (open.length > 1 ? 's' : '') + ' en attente. ' + open.slice(0, 3).map((m) => agent(m.agent).name + ' : ' + m.text.slice(0, 80)).join('. ') + '.'};
  }

  if (/(r[ée]sum|fais(-moi)? le point|point du jour|ma journ[ée]e|mon agenda|[ée]v[ée]nements (importants|du jour))/.test(l) && !/\b(demande|dis) (à|a)\b/.test(l)) {
    const open = store.missions.filter((m) => m.status === 'a_approuver').length;
    return {reply: "Je ne suis pas encore relié à ton agenda ni à Pilotage : je te lirai ta journée en phase 3." + (open ? ' En attendant, ' + open + ' mission' + (open > 1 ? 's attendent' : ' attend') + ' ton accord.' : '')};
  }

  /* « fais travailler Claude et Grok ensemble sur ce projet » */
  const team = t.match(/^fais travailler (.+?) ensemble (sur|pour) (.+)$/i);
  if (team) {
    const ids = Array.from(new Set(named(team[1])));
    if (ids.length >= 2) { const g = uid(); const ms = ids.map((a) => mission(a, (a === ids[0] ? 'Pilote le travail en commun : ' : 'Travail en commun : ') + team[3], g)); return {reply: 'Mission commune créée pour ' + join(ids.map((a) => agent(a).name)) + '. ' + waitTxt(ms.length), missions: ms, agent: ids[0]}; }
  }

  /* « demande à Claude de préparer un rapport et à Grok de vérifier les données » */
  if (/^(demande|dis|confie|transmets|envoie)(-lui)? (à|a|au) /i.test(t)) {
    const parts = t.replace(/^(demande|dis|confie|transmets|envoie) /i, '').split(/,? (?:et|puis) (?=(?:à|a|au) [A-ZÉa-zé]+ (?:de|d'|qu))/i);
    const ms: Mission[] = []; const g = parts.length > 1 ? uid() : undefined;
    for (const p of parts) {
      const m = p.match(/^(?:à|a|au) ([A-Za-zÀ-ÿ]+)(?: (?:de |d'|qu'il |qu'elle ))?(.*)$/i);
      if (!m) continue;
      const who = named(m[1])[0] || route(m[2], store.settings.route);
      ms.push(mission(who, m[2] || p, g));
    }
    if (ms.length) return {reply: (ms.length > 1 ? ms.length + ' missions créées : ' : 'Mission créée : ') + join(ms.map((m) => agent(m.agent).name)) + '. ' + waitTxt(ms.length), missions: ms, agent: ms[0].agent};
  }

  /* le reste : en phase 3, Claude répondra. D'ici là, je propose d'en faire une mission. */
  const who = route(t, mode);
  pending = {agent: who, text: t};
  return {reply: 'Je ne suis pas encore relié à Claude pour te répondre moi-même : ça arrive en phase 3. Veux-tu que j\'en fasse une mission pour ' + agent(who).name + ' ?', agent: who};
}

export const resetBrain = () => { pending = null; };
