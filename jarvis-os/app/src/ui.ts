/* Petits outils d'interface : création d'éléments et icônes. */
type Kid = Node | string | null | undefined | false | Kid[];
export function h(tag: string, attrs: Record<string, any> = {}, ...kids: Kid[]): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'text') e.textContent = String(v);
    else if (k === 'html') e.innerHTML = String(v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  const add = (k: Kid) => { if (k == null || k === false) return; if (Array.isArray(k)) k.forEach(add); else e.append(typeof k === 'string' ? document.createTextNode(k) : k); };
  kids.forEach(add);
  return e;
}

const P: Record<string, string> = {
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
  key: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><path d="M7 10.5h.01M11 10.5h.01M15 10.5h.01M8 14h8"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
  core: '<circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>',
  agents: '<circle cx="8" cy="9" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M3 19c.6-3 2.7-4.5 5-4.5s4.4 1.5 5 4.5M14 18.5c.4-2 1.6-3.2 3.2-3.2 1.7 0 3 1.2 3.4 3.2"/>',
  missions: '<path d="M5 5h14v14H5z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  memory: '<path d="M12 4c-4 0-7 1.5-7 3.5v9C5 18.5 8 20 12 20s7-1.5 7-3.5v-9C19 5.5 16 4 12 4z"/><path d="M5 7.5c0 2 3 3.5 7 3.5s7-1.5 7-3.5M5 12c0 2 3 3.5 7 3.5s7-1.5 7-3.5"/>',
  more: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
  wave: '<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  dots: '<circle cx="12" cy="5.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="18.5" r="1.3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  home: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/>',
  chat: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/>',
  flow: '<rect x="3" y="4" width="7" height="5" rx="1.5"/><rect x="14" y="15" width="7" height="5" rx="1.5"/><path d="M6.5 9v4.5a3 3 0 0 0 3 3H14"/>',
  gauge: '<path d="M4.5 16a8 8 0 1 1 15 0"/><path d="M12 13l3.5-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  crown: '<path d="M4 17l-1-9 5 4 4-6 4 6 5-4-1 9z"/><path d="M5 20h14"/>',
  mail: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M4 7l8 6 8-6"/>',
  hourglass: '<path d="M7 3.5h10M7 20.5h10M8 3.5c0 5 8 5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 5-8 8.5s8 3.5 8 8.5"/>',
  tag: '<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.4"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  book: '<path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  plane: '<path d="M2.5 12.5l19-8-6 16-3.5-6z"/><path d="M12 14.5l9.5-10"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  speaker: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/>'
};
export const icon = (n: string, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
export const ago = (t: number) => { const d = Math.round((Date.now() - t) / 60000); return d < 1 ? "à l'instant" : d < 60 ? 'il y a ' + d + ' min' : d < 1440 ? 'il y a ' + Math.round(d / 60) + ' h' : new Date(t).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'}); };
