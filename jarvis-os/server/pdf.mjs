/* JARVIS OS — le texte d'un PDF, sur le serveur, sans IA et sans dépendance (0.52.0, 21/11/2026).
   Son choix (QCM du 21/11/2026, « Oui, sur le serveur ») : les factures dont le montant n'est que dans le PDF joint (crèche, parking) sont
   lues ici ; rien ne sort du serveur et le PDF n'est pas gardé (seuls le montant et la date retrouvés le sont, dans le Radar).
   Couvre les PDF produits par un logiciel : flux compressés (FlateDecode), flux d'objets, polices simples (WinAnsi) et polices composées
   avec leur table ToUnicode. Pas les scans (images) ni les PDF chiffrés : le texte rendu est alors vide. */
import zlib from 'node:zlib';

const WIN = {0x80: '€', 0x82: '‚', 0x84: '„', 0x85: '…', 0x8c: 'Œ', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x99: '™', 0x9c: 'œ', 0x9f: 'Ÿ'};
const winAnsi = (bytes) => { let o = ''; for (const b of bytes) o += WIN[b] || String.fromCharCode(b); return o; };

/* les objets du fichier : {numéro: {dict, flux (Buffer décodé ou null)}} */
function objets(buf) {
  const s = buf.toString('latin1'), out = new Map();
  const re = /(\d+)\s+(\d+)\s+obj\b/g; let m;
  while ((m = re.exec(s))) {
    const debut = m.index + m[0].length, fin = s.indexOf('endobj', debut); if (fin < 0) break;
    const corps = s.slice(debut, fin), k = corps.search(/\bstream\r?\n/);
    if (k < 0) { out.set(+m[1], {dict: corps, flux: null}); re.lastIndex = fin; continue; }
    const dict = corps.slice(0, k), d0 = debut + k + corps.slice(k).match(/^stream\r?\n/)[0].length;
    const lg = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/), f = s.indexOf('endstream', d0);
    const brut = buf.subarray(d0, lg && d0 + +lg[1] <= (f < 0 ? s.length : f) ? d0 + +lg[1] : (f < 0 ? s.length : f));
    out.set(+m[1], {dict, flux: decode(dict, brut)});
    re.lastIndex = f < 0 ? fin : Math.max(f, fin);
  }
  /* flux d'objets (PDF 1.5+) : des objets rangés dans un flux compressé */
  for (const [, o] of [...out]) {
    if (!o.flux || !/\/Type\s*\/ObjStm/.test(o.dict)) continue;
    const n = +((o.dict.match(/\/N\s+(\d+)/) || [])[1] || 0), first = +((o.dict.match(/\/First\s+(\d+)/) || [])[1] || 0), t = o.flux.toString('latin1');
    const tete = t.slice(0, first).trim().split(/\s+/).map(Number), pos = [];
    for (let i = 0; i + 1 < tete.length && pos.length < n; i += 2) pos.push([tete[i], tete[i + 1]]);
    pos.forEach(([num, off], i) => { if (!out.has(num)) out.set(num, {dict: t.slice(first + off, i + 1 < pos.length ? first + pos[i + 1][1] : t.length), flux: null}); });
  }
  return out;
}
function decode(dict, brut) {
  const filtres = (dict.match(/\/Filter\s*(\[[^\]]*\]|\/\w+)/) || [])[1] || '';
  if (!filtres) return Buffer.from(brut);
  if (!/^\/?\[?\s*\/FlateDecode\s*\]?$/.test(filtres.trim())) return null;   /* images (DCT, CCITT…) : pas du texte */
  for (const f of [(b) => zlib.inflateSync(b), (b) => zlib.inflateSync(b, {finishFlush: zlib.constants.Z_SYNC_FLUSH}), (b) => zlib.inflateRawSync(b)]) { try { return f(brut); } catch { /* suivant */ } }
  return null;
}
const ref = (txt) => { const m = String(txt || '').match(/^\s*(\d+)\s+\d+\s+R/); return m ? +m[1] : null; };
/* le dictionnaire après une clé (« /Font << … >> » ou « /Font 12 0 R ») */
function sousDict(dict, cle, objs) {
  const i = dict.search(new RegExp('/' + cle + '\\b')); if (i < 0) return '';
  let j = i + cle.length + 1; while (/\s/.test(dict[j] || '')) j++;
  if (dict.startsWith('<<', j)) { let p = 0, k = j; for (; k < dict.length; k++) { if (dict.startsWith('<<', k)) { p++; k++; } else if (dict.startsWith('>>', k)) { p--; k++; if (!p) break; } } return dict.slice(j, k + 1); }
  const r = ref(dict.slice(j)); return r != null && objs.get(r) ? objs.get(r).dict : '';
}
/* les largeurs des polices standard (Helvetica, Helvetica gras, Times ; codes 32 à 126), quand le PDF ne les donne pas : sans elles,
   une lettre large (« M ») ferait croire à un blanc */
const AFM = {
  H: '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584',
  HB: '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584',
  T: '250 333 408 500 500 833 778 180 333 333 500 564 250 333 250 278 500 500 500 500 500 500 500 500 500 500 278 278 564 564 564 444 921 722 667 667 722 611 556 722 722 333 389 722 611 889 722 722 556 722 667 556 611 722 722 944 722 722 611 333 278 333 469 500 333 444 500 444 500 444 333 500 500 278 278 500 278 778 500 500 500 500 333 389 278 500 500 722 500 500 444 480 200 480 541'};
const BASE = 'AAAAAAACEEEEIIIIDNOOOOOxOUUUUYTsaaaaaaaceeeeiiiidnooooo/ouuuuyty';   /* À (0xC0) à ÿ : la lettre de base */
function standard(nom) {
  if (/Courier/i.test(nom)) return () => 600;
  const l = (/Times|Serif/i.test(nom) ? AFM.T : /Bold|Black|Heavy/i.test(nom) ? AFM.HB : AFM.H).split(' ').map(Number), w = (c) => (c >= 32 && c <= 126 ? l[c - 32] : 500);
  return (c) => (c >= 0xc0 && c <= 0xff ? w(BASE.charCodeAt(c - 0xc0)) : c === 0x80 || c === 0xab || c === 0xbb || c === 0x96 ? 556 : c === 0xa0 ? w(32) : c === 0x92 || c === 0x91 ? 222 : c === 0xb0 ? 400 : w(c));
}
/* un tableau après une clé, crochets imbriqués compris (« /W [ 3 [ 278 333 ] 16 18 556 ] »), ou l'objet qu'il désigne */
function tableau(dict, cle, objs) {
  const i = dict.search(new RegExp('/' + cle + '\\s*[\\[\\d]')); if (i < 0) return '';
  let j = i + cle.length + 1; while (/\s/.test(dict[j] || '')) j++;
  if (dict[j] !== '[') { const r = ref(dict.slice(j)); return r != null && objs.get(r) ? objs.get(r).dict.trim() : ''; }
  let p = 0, k = j; for (; k < dict.length; k++) { if (dict[k] === '[') p++; else if (dict[k] === ']') { p--; if (!p) break; } }
  return dict.slice(j, k + 1);
}
/* la largeur de chaque code (millièmes de la taille du texte) : /Widths d'une police simple, /W et /DW d'une police composée */
function largeurs(objs, o) {
  const nombre = (d, k, def) => { const m = d.match(new RegExp('/' + k + '\\s+([\\d.]+)(?!\\s+\\d+\\s+R)')); return m ? +m[1] : def; };
  if (/\/Subtype\s*\/Type0/.test(o.dict)) {
    const dt = tableau(o.dict, 'DescendantFonts', objs), dr = ref((dt.match(/(\d+\s+\d+\s+R)/) || [])[1]), d = dr != null && objs.get(dr) ? objs.get(dr).dict : '';
    const dw = nombre(d, 'DW', 1000), w = new Map(), tk = (tableau(d, 'W', objs).slice(1, -1).match(/\[[^\]]*\]|[\d.]+/g) || []);
    for (let i = 0; i < tk.length;) {
      const c = +tk[i];
      if (tk[i + 1] && tk[i + 1][0] === '[') { (tk[i + 1].slice(1, -1).match(/[\d.]+/g) || []).forEach((x, k) => w.set(c + k, +x)); i += 2; }
      else if (i + 2 < tk.length) { for (let k = c; k <= +tk[i + 1] && k - c < 65536; k++) w.set(k, +tk[i + 2]); i += 3; } else break;
    }
    return (code) => (w.has(code) ? w.get(code) : dw);
  }
  const first = nombre(o.dict, 'FirstChar', 0), l = (tableau(o.dict, 'Widths', objs).match(/[\d.]+/g) || []).map(Number), std = standard((o.dict.match(/\/BaseFont\s*\/([^\s/<>[\]]+)/) || [])[1] || '');
  return (code) => (code >= first && code - first < l.length && l[code - first] > 0 ? l[code - first] : std(code));
}
/* la table ToUnicode d'une police : code → texte ; et la longueur de ses codes (1 ou 2 octets) */
function cmap(txt) {
  const map = new Map(); let octets = 1;
  const u16 = (h) => { const b = Buffer.from(h.length % 4 ? h.padStart(Math.ceil(h.length / 4) * 4, '0') : h, 'hex'); let o = ''; for (let i = 0; i + 1 < b.length; i += 2) o += String.fromCharCode(b.readUInt16BE(i)); return o; };
  for (const bloc of txt.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const m of bloc[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) { if (m[1].length >= 4) octets = 2; map.set(parseInt(m[1], 16), u16(m[2])); }
  for (const bloc of txt.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) for (const m of bloc[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
    if (m[1].length >= 4) octets = 2;
    const lo = parseInt(m[1], 16), hi = Math.min(parseInt(m[2], 16), lo + 65535);
    if (m[3][0] === '[') { const l = [...m[3].matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => u16(x[1])); for (let c = lo; c <= hi && c - lo < l.length; c++) map.set(c, l[c - lo]); }
    else { const base = m[3].slice(1, -1); const d = u16(base); for (let c = lo; c <= hi; c++) map.set(c, d.slice(0, -1) + String.fromCharCode(d.charCodeAt(d.length - 1) + (c - lo))); }
  }
  return {map, octets};
}
function police(objs, num) {
  const o = objs.get(num); if (!o) return null;
  const tu = ref((o.dict.match(/\/ToUnicode\s+(\d+\s+\d+\s+R)/) || [])[1]), larg = largeurs(objs, o);
  if (tu != null && objs.get(tu) && objs.get(tu).flux) return {...cmap(objs.get(tu).flux.toString('latin1')), larg};
  if (/\/Subtype\s*\/Type0/.test(o.dict)) return {map: new Map(), octets: 2, larg};   /* police composée sans table : codes illisibles */
  return {map: null, octets: 1, larg};   /* police simple : WinAnsi */
}
function lireChaine(bytes, pol) {
  if (!pol || !pol.map) return winAnsi(bytes);
  let o = '';
  for (let i = 0; i < bytes.length; i += pol.octets) { const c = pol.octets === 2 ? (bytes[i] << 8) | (bytes[i + 1] || 0) : bytes[i]; o += pol.map.has(c) ? pol.map.get(c) : (pol.octets === 1 ? winAnsi([c]) : ''); }
  return o;
}
/* le texte d'un flux de page, avec des retours à la ligne quand le texte change de ligne */
function texteFlux(c, polices) {
  const s = c.toString('latin1'), out = []; let pile = [], pol = null, i = 0;
  const pousse = (t) => { if (t) out.push(t); };
  /* la matrice de ligne [a b c d e f], la taille du texte, l'avance depuis le début de la ligne (espace du texte) */
  let tlm = [1, 0, 0, 1, 0, 0], fs = 1, tl = 0, tc = 0, tw = 0, x = 0, avant = null;
  const ici = () => ({y: tlm[5], x: tlm[4] + x * tlm[0], fs: Math.abs(fs * (tlm[3] || tlm[0] || 1))});
  const place = (m) => {   /* nouvelle position : retour à la ligne, espace si un blanc la sépare du texte d'avant, rien sinon */
    const p = avant || ici(); avant = null;
    if (out.length) { if (Math.abs(m[5] - p.y) > Math.max(0.5, p.fs * 0.3)) pousse('\n'); else if (m[4] - p.x > p.fs * 0.2) pousse(' '); }
    tlm = m; x = 0;
  };
  const td = (tx, ty) => place([tlm[0], tlm[1], tlm[2], tlm[3], tlm[4] + tx * tlm[0] + ty * tlm[2], tlm[5] + tx * tlm[1] + ty * tlm[3]]);
  const montre = (bytes) => {
    pousse(lireChaine(bytes, pol));
    const larg = pol ? pol.larg : () => 500, n = pol ? pol.octets : 1;
    for (let k = 0; k < bytes.length; k += n) { const code = n === 2 ? (bytes[k] << 8) | (bytes[k + 1] || 0) : bytes[k]; x += (larg(code) / 1000) * fs + tc + (code === 32 && n === 1 ? tw : 0); }
  };
  const chaine = () => {   /* ( … ) avec échappements et parenthèses imbriquées */
    const b = []; let p = 1; i++;
    while (i < s.length && p) {
      const ch = s[i];
      if (ch === '\\') { const n = s[i + 1]; i += 2;
        if (/[0-7]/.test(n)) { let k = n; while (k.length < 3 && /[0-7]/.test(s[i])) k += s[i++]; b.push(parseInt(k, 8) & 255); }
        else if (n === '\r') { if (s[i] === '\n') i++; } else if (n === '\n') { /* suite de ligne */ } else b.push({n: 10, r: 13, t: 9, b: 8, f: 12}[n] || n.charCodeAt(0));
        continue; }
      if (ch === '(') p++; else if (ch === ')') { p--; if (!p) { i++; break; } }
      b.push(ch.charCodeAt(0) & 255); i++;
    }
    return {s: b};
  };
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '%') { while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++; continue; }
    if (ch === '(') { pile.push(chaine()); continue; }
    if (ch === '<' && s[i + 1] !== '<') { const j = s.indexOf('>', i); const h = s.slice(i + 1, j).replace(/\s/g, ''); pile.push({s: [...Buffer.from(h.length % 2 ? h + '0' : h, 'hex')]}); i = j + 1; continue; }
    if (ch === '<' || ch === '>') { i += 2; continue; }
    if (ch === '[') { pile.push('['); i++; continue; }
    if (ch === ']') { const k = pile.lastIndexOf('['); const a = k < 0 ? [] : pile.splice(k); a.shift(); pile.push({a}); i++; continue; }
    if (ch === '/') { const m = s.slice(i).match(/^\/[^\s/<>[\]()%{}]*/); pile.push({nom: m[0]}); i += m[0].length; continue; }
    const m = s.slice(i, i + 40).match(/^[+-]?(\d+\.?\d*|\.\d+)/);
    if (m) { pile.push(+m[0]); i += m[0].length; continue; }
    const op = s.slice(i).match(/^[A-Za-z'"*]+[0-9]?\*?/); if (!op) { i++; continue; }
    i += op[0].length; const o = op[0], a = pile; pile = [];
    if (o === 'ID') { const e = s.indexOf('EI', i); i = e < 0 ? s.length : e + 2; continue; }   /* image incluse : sautée */
    if (o === 'Tf') { const n = a.find((v) => v && v.nom); pol = n ? polices.get(n.nom.slice(1)) || null : null; const z = a.find((v) => typeof v === 'number'); if (z) fs = z; }
    else if (o === 'BT') { avant = out.length ? ici() : null; tlm = [1, 0, 0, 1, 0, 0]; x = 0; }
    else if (o === 'Tm' && a.length >= 6) place(a.slice(-6).map(Number));
    else if (o === 'Td' || o === 'TD') { if (o === 'TD') tl = -(+a[1] || 0); td(+a[0] || 0, +a[1] || 0); }
    else if (o === 'TL') tl = +a[0] || 0;
    else if (o === 'Tc') tc = +a[0] || 0;
    else if (o === 'Tw') tw = +a[0] || 0;
    else if (o === 'T*') td(0, -tl);
    else if (o === 'Tj' || o === "'" || o === '"') { if (o === '"') { tw = +a[0] || 0; tc = +a[1] || 0; } if (o !== 'Tj') td(0, -tl); const t = a.reverse().find((v) => v && v.s); if (t) montre(t.s); }
    else if (o === 'TJ') { const arr = (a.find((v) => v && v.a) || {a: []}).a; for (const v of arr) { if (v && v.s) montre(v.s); else if (typeof v === 'number') { x -= (v / 1000) * fs; if (v < -250) pousse(' '); } } }
  }
  return out.join('');
}
/* le texte de tout le PDF (pages dans l'ordre du fichier), « max » caractères au plus */
export function texteDePdf(buf, max = 100000) {
  try {
    if (!Buffer.isBuffer(buf) || buf.length < 20 || buf.subarray(0, 1024).toString('latin1').indexOf('%PDF') < 0) return '';
    if (/\/Encrypt\b/.test(buf.subarray(Math.max(0, buf.length - 4096)).toString('latin1'))) return '';
    const objs = objets(buf), global = new Map();
    /* toutes les polices nommées du fichier (repli quand une page hérite de ses ressources) */
    for (const [, o] of objs) { const f = sousDict(o.dict, 'Font', objs); for (const m of f.matchAll(/\/([^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g)) if (!global.has(m[1])) global.set(m[1], +m[2]); }
    const cache = new Map(), pol = (n) => { if (!cache.has(n)) cache.set(n, police(objs, n)); return cache.get(n); };
    const pages = [...objs].filter(([, o]) => /\/Type\s*\/Page\b(?!s)/.test(o.dict)).sort((p, q) => p[0] - q[0]);
    let txt = '';
    for (const [, p] of pages) {
      const f = sousDict(p.dict, 'Font', objs) || sousDict(sousDict(p.dict, 'Resources', objs), 'Font', objs), noms = new Map(global);
      for (const m of f.matchAll(/\/([^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g)) noms.set(m[1], +m[2]);
      const polices = new Map([...noms].map(([n, num]) => [n, pol(num)]));
      const c = p.dict.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/), refs = c ? [...c[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((x) => +x[1]) : [];
      for (const r of refs) { const o = objs.get(r); if (o && o.flux) txt += texteFlux(o.flux, polices) + '\n'; if (txt.length > max) break; }
      if (txt.length > max) break;
    }
    return txt.replace(/[ \t]+/g, ' ').replace(/ *\n[ \n]*/g, '\n').trim().slice(0, max);
  } catch { return ''; }
}
