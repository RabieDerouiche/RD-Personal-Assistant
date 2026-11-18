/* Tout est gardé sur l'iPhone (localStorage) en phase 2. La phase 3 déplacera missions et mémoire sur le serveur. */
import type {AgentId} from './agents';

export type Who = 'me' | 'jarvis';
export interface Msg { who: Who; text: string; at: number; agent?: AgentId }
export type MissionStatus = 'brouillon' | 'a_approuver' | 'approuvee' | 'refusee' | 'envoyee' | 'terminee' | 'echouee';
export type Priority = 'haute' | 'normale' | 'basse';
export interface Mission { id: string; agent: AgentId; text: string; status: MissionStatus; at: number; result?: string; group?: string; priority?: Priority; done?: number; source?: string }
export type RouteMode = 'auto' | 'claude' | 'grok';
export interface Settings { voiceURI: string; rate: number; listenMode: 'phrase' | 'continu'; route: RouteMode; approveAll: boolean; name: string; salle: 'copie' | 'service'; serverUrl: string; serverToken: string; model: 'rapide' | 'equilibre' | 'profond'; voiceEngine: 'serveur' | 'iphone'; ecoute?: 'whisper' | 'iphone' }
export interface Stats { turns: number; voiceTurns: number; autoRestarts: number; autoRestartFails: number; errors: number; replyMs: number[]; firstMs?: number[] }

const K = {msgs: 'jarvis.msgs', missions: 'jarvis.missions', settings: 'jarvis.settings', stats: 'jarvis.stats'};
const read = <T>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? {...d as object, ...JSON.parse(v)} as T : d; } catch { return d; } };
const readArr = <T>(k: string): T[] => { try { const v = localStorage.getItem(k); const a = v ? JSON.parse(v) : []; return Array.isArray(a) ? a : []; } catch { return []; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage plein ou interdit : on continue en mémoire */ } };

export const store = {
  msgs: readArr<Msg>(K.msgs),
  missions: readArr<Mission>(K.missions),
  settings: read<Settings>(K.settings, {voiceURI: '', rate: 1, listenMode: 'phrase', route: 'auto', approveAll: true, name: '', salle: 'copie', serverUrl: '', serverToken: '', model: 'equilibre', voiceEngine: 'serveur'}),
  stats: read<Stats>(K.stats, {turns: 0, voiceTurns: 0, autoRestarts: 0, autoRestartFails: 0, errors: 0, replyMs: []}),
  save() {
    write(K.msgs, this.msgs.slice(-400));
    write(K.missions, this.missions.slice(-300));
    write(K.settings, this.settings);
    this.stats.replyMs = this.stats.replyMs.slice(-100);
    write(K.stats, this.stats);
  },
  add(m: Msg) { this.msgs.push(m); this.save(); },
  clearAll() { this.msgs = []; this.missions = []; this.stats = {turns: 0, voiceTurns: 0, autoRestarts: 0, autoRestartFails: 0, errors: 0, replyMs: []}; this.save(); }
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
