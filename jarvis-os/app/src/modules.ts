/* Les modules de la page Jarvis dans l'app : lus par le serveur en arrière-plan, affichés tout de suite,
   actualisables un par un. Les mails se relisent toutes les 3 minutes tant que l'app est ouverte. */
import {h, icon, ago} from './ui';
import type {Mod} from './server';

export const MODS: {id: string; name: string; icon: string; empty: string}[] = [
  {id: 'mails', name: 'Mails', icon: 'mail', empty: 'Aucun mail important ces 48 heures.'},
  {id: 'agenda', name: 'Agenda', icon: 'calendar', empty: 'Rien dans les 7 prochains jours.'},
  {id: 'atoi', name: 'À toi', icon: 'bolt', empty: 'Rien n\'attend ta réponse.'},
  {id: 'echeances', name: 'Échéances', icon: 'hourglass', empty: 'Aucune échéance proche.'},
  {id: 'canal', name: 'Canal', icon: 'chat', empty: 'Aucune demande en cours.'},
  {id: 'achats', name: 'Achats', icon: 'tag', empty: 'Aucun prix suivi.'},
  {id: 'sorties', name: 'Sorties', icon: 'compass', empty: 'Aucune sortie proposée.'},
  {id: 'voyages', name: 'Voyages', icon: 'plane', empty: 'Aucun projet de voyage.'},
  {id: 'bots', name: 'Bots', icon: 'agents', empty: 'Pas d\'état des bots.'}
];
const S = (v: any) => (v == null ? '' : String(v)).trim();
export function when(v: any): string {
  const t = S(v); if (!t) return '';
  const d = new Date(t.length === 10 ? t + 'T12:00' : t);
  if (isNaN(+d)) return t;
  const day = d.toLocaleDateString('fr-FR', {weekday: 'short', day: 'numeric', month: 'short'});
  return t.length > 10 && !/T00:00/.test(t) ? day + ' ' + d.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}) : day;
}
interface Row { title: string; sub?: string; sub2?: string; side?: string; badge?: string; hot?: boolean }
export function rows(id: string, data: any): Row[] {
  const it: any[] = Array.isArray(data?.items) ? data.items : [];
  switch (id) {
    case 'mails': return it.map((x) => ({title: S(x.subject) || '(sans objet)', sub: S(x.from), sub2: S(x.snippet), side: when(x.date), badge: x.unread ? 'non lu' : '', hot: !!x.important}));
    case 'agenda': return it.map((x) => ({title: S(x.title), sub: S(x.calendar), side: when(x.start)}));
    case 'atoi': return it.map((x) => ({title: S(x.message), sub: [S(x.bot), S(x.kind)].filter(Boolean).join(' · '), sub2: S(x.phrase) ? 'Phrase : « ' + S(x.phrase) + ' »' : '', side: when(x.date), hot: true}));
    case 'echeances': return it.map((x) => ({title: S(x.what), sub: [S(x.nature), S(x.who)].filter(Boolean).join(' · '), side: when(x.date), badge: S(x.status)}));
    case 'canal': return it.map((x) => ({title: S(x.message), sub: S(x.de) + ' → ' + S(x.pour) + (S(x.type) ? ' · ' + S(x.type) : ''), sub2: S(x.reponse), side: S(x.date), badge: S(x.statut), hot: /attend ton oui/i.test(S(x.statut))}));
    case 'achats': return it.map((x) => ({title: S(x.objet), sub: [S(x.dernierPrix) && 'Dernier prix ' + S(x.dernierPrix), S(x.seuil) && 'seuil ' + S(x.seuil)].filter(Boolean).join(' · '), sub2: [S(x.ou), S(x.releve) && 'relevé ' + S(x.releve)].filter(Boolean).join(' · '), badge: S(x.statut)}));
    case 'sorties': return it.map((x) => ({title: S(x.sortie), sub: [S(x.ou), S(x.trajet)].filter(Boolean).join(' · '), side: when(x.debut), badge: S(x.prix)}));
    case 'voyages': return it.map((x) => ({title: S(x.projet), sub: S(x.options), side: S(x.dates), badge: S(x.statut)}));
    case 'bots': return it.map((x) => ({title: S(x.bot), sub: S(x.etat), side: S(x.dernier)})).concat((Array.isArray(data?.journal) ? data.journal : []).map((x: any) => ({title: S(x.texte), sub: 'Journal · ' + S(x.bot), side: S(x.date)})));
    default: return [];
  }
}
const age = (m?: Mod) => m?.running ? 'Lecture en cours…' : m?.at ? 'Lu ' + ago(m.at) : 'Pas encore lu';
export function dashboard(snap: Record<string, Mod>, open: (id: string) => void): HTMLElement {
  return h('div', {class: 'dash'}, MODS.map((m) => { const s = snap[m.id], r = s?.data ? rows(m.id, s.data) : [], hot = r.filter((x) => x.hot).length;
    return h('button', {type: 'button', class: 'dash-tile glass' + (hot ? ' hot' : ''), onclick: () => open(m.id)},
      h('span', {class: 'dash-h'}, h('span', {class: 'dash-ic', html: icon(m.icon, 17)}), h('b', {text: m.name}), h('em', {text: s?.data ? String(r.length) : s?.running ? '…' : '–'})),
      h('small', {text: r[0] ? r[0].title : s?.running ? 'lecture en cours' : s?.error ? 'à relire' : m.empty})); }));
}
export function modulePage(id: string, s: Mod | undefined, onBack: () => void, onRefresh: () => void): HTMLElement {
  const m = MODS.find((x) => x.id === id) || MODS[0], r = s?.data ? rows(id, s.data) : [];
  return h('section', {class: 'page'},
    h('button', {type: 'button', class: 'back', onclick: onBack}, h('span', {html: icon('back', 16)}), 'Retour'),
    h('header', {class: 'p-head'}, h('div', {}, h('p', {class: 'view-title', text: 'Tes données'}), h('h2', {text: m.name})),
      h('button', {type: 'button', class: 'ic-btn' + (s?.running ? ' spin' : ''), 'aria-label': 'Actualiser ' + m.name, html: icon('refresh', 20), onclick: onRefresh})),
    h('p', {class: 'small', text: age(s) + (id === 'mails' ? ' · relu toutes les 3 min tant que l\'app est ouverte' : ' · relu toutes les 15 min, ou avec le bouton')}),
    s?.error ? h('p', {class: 'note', text: 'Dernière lecture ratée : ' + s.error}) : null,
    r.length ? h('div', {class: 'stack'}, r.map((x) => h('article', {class: 'row glass' + (x.hot ? ' hot' : '')},
      h('div', {class: 'row-h'}, h('b', {text: x.title}), x.side ? h('time', {text: x.side}) : null),
      x.sub ? h('p', {class: 'row-s', text: x.sub}) : null, x.sub2 ? h('p', {class: 'row-s2', text: x.sub2}) : null,
      x.badge ? h('span', {class: 'pill' + (x.hot ? ' is-demande' : ''), text: x.badge}) : null)))
      : h('p', {class: 'empty', text: s?.data ? m.empty : s?.running ? 'Lecture en cours…' : 'Touche Actualiser pour lire ce module.'}));
}
