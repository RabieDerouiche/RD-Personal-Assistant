/* JARVIS OS — sauvegarde de Pilotage sur le serveur (0.14.0) : une copie des onglets chaque nuit vers 3 h (heure de Paris),
   gardée 30 jours dans le dossier de données du serveur (droits 600), et ce qui a changé d'une copie à l'autre.
   Lecture seule de Pilotage : rien n'est jamais réécrit dans le classeur depuis une copie (retour arrière à la main, valeurs « avant » sous les yeux). */
import fs from 'node:fs';
import path from 'node:path';
import {paris} from './notify.mjs';

export const ONGLETS = [['Canal', 'A1:H3000'], ['Dossiers', 'A1:J500'], ['Échéances', 'A1:H1000'], ['Faits', 'A1:D300'], ['Papiers', 'A1:G300'], ['Prix', 'A1:M300'],
  ['Relevés', 'A1:G3000'], ['Routines', 'A1:G300'], ['Sorties', 'A1:L500'], ['Tâches', 'A1:E500'], ['Voyages', 'A1:K200'], ['Options voyage', 'A1:L300'],
  ['État', 'A1:E30'], ['Expéditeurs', 'A1:F100'], ['Autonomie', 'A1:C100'], ['Journal', 'A1:E5000'], ['Déploiement', 'A1:Z300'], ['Textes des routines', 'A1:Z300'], ['Sources', 'A1:Z200']];
const KEEP = 30;

export function createSauvegarde({S, save, read, linked, dir, now = () => Date.now(), heure = '03:00'}) {
  fs.mkdirSync(dir, {recursive: true, mode: 0o700});
  S.sauvegarde = Object.assign({last: '', at: 0, error: ''}, S.sauvegarde || {});
  const files = () => fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const load = (f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } };

  async function run() {
    const t = paris(new Date(now())), copy = {at: now(), onglets: {}}, manque = [];
    for (const [nom, plage] of ONGLETS) {
      try { copy.onglets[nom] = await read("'" + nom + "'!" + plage); } catch (e) { manque.push(nom); }
    }
    if (!Object.keys(copy.onglets).length) { S.sauvegarde.error = 'Pilotage illisible : aucune copie.'; save(); return {ok: false, error: S.sauvegarde.error}; }
    const f = path.join(dir, t.ymd + '.json'), tmp = f + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(copy), {mode: 0o600}); fs.renameSync(tmp, f);
    files().slice(0, -KEEP).forEach((x) => fs.rmSync(path.join(dir, x), {force: true}));
    Object.assign(S.sauvegarde, {last: t.ymd, at: now(), error: manque.length ? 'Onglets illisibles : ' + manque.join(', ') + '.' : ''}); save();
    return {ok: true, date: t.ymd, onglets: Object.keys(copy.onglets).length, manque};
  }
  /* chaque minute : une copie par jour, après l'heure prévue, si Google est relié */
  async function tick() {
    const t = paris(new Date(now()));
    if (!linked() || S.sauvegarde.last === t.ymd || t.hm < heure) return null;
    return run();
  }
  /* ce qui a changé entre deux copies (par défaut : les deux dernières), onglet par onglet, ligne par ligne */
  function diff(a, b) {
    const fs2 = files(); if (!a || !b) { if (fs2.length < 2) return {dates: fs2.map((x) => x.slice(0, 10)), onglets: []}; a = fs2[fs2.length - 2]; b = fs2[fs2.length - 1]; }
    const A = load(a), B = load(b); if (!A || !B) return {dates: [], onglets: []};
    const out = [];
    for (const [nom] of ONGLETS) {
      const ra = A.onglets[nom] || [], rb = B.onglets[nom] || [], hd = rb[0] || ra[0] || [], ex = [];
      let ajoutees = 0, modifiees = 0, retirees = 0;
      for (let i = 1; i < Math.max(ra.length, rb.length); i++) {
        const x = ra[i], y = rb[i];
        if (!x && y) { ajoutees++; if (ex.length < 5) ex.push({ligne: i + 1, genre: 'ajoutée', apres: y.filter(Boolean).join(' · ').slice(0, 160)}); continue; }
        if (x && !y) { retirees++; if (ex.length < 5) ex.push({ligne: i + 1, genre: 'retirée', avant: x.filter(Boolean).join(' · ').slice(0, 160)}); continue; }
        const cols = []; for (let k = 0; k < Math.max(x.length, y.length); k++) if (String(x[k] ?? '') !== String(y[k] ?? '')) cols.push(k);
        if (cols.length) { modifiees++; if (ex.length < 5) ex.push({ligne: i + 1, genre: 'modifiée', champs: cols.slice(0, 3).map((k) => ({col: String(hd[k] || 'colonne ' + (k + 1)), avant: String(x[k] ?? '').slice(0, 120), apres: String(y[k] ?? '').slice(0, 120)}))}); }
      }
      if (ajoutees || modifiees || retirees) out.push({nom, ajoutees, modifiees, retirees, exemples: ex});
    }
    return {dates: [a.slice(0, 10), b.slice(0, 10)], onglets: out};
  }
  const status = () => ({last: S.sauvegarde.last, at: S.sauvegarde.at, error: S.sauvegarde.error, copies: files().map((x) => x.slice(0, 10)), heure});
  return {run, tick, diff, status};
}
