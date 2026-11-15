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
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  speaker: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/>'
};
export const icon = (n: string, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
export const ago = (t: number) => { const d = Math.round((Date.now() - t) / 60000); return d < 1 ? "à l'instant" : d < 60 ? 'il y a ' + d + ' min' : d < 1440 ? 'il y a ' + Math.round(d / 60) + ' h' : new Date(t).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'}); };
