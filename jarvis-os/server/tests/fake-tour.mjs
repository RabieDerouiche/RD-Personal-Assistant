#!/usr/bin/env node
/* Fausse fin de phrase pour les bancs (0.36.0) : même protocole que stt/tour_helper.py ({"id", "wav"} → {"id", "ok", "p"}).
   - WAV du banc serveur : « DIT:…|TOUR:0.2 » après l'en-tête donne p (0,95 sans « TOUR: ») ;
   - WAV envoyé par la page (faux micro du banc), selon la durée de la voix, comme tests/fake-stt.mjs : moins de 1,4 s (« quelle heure
     est-il ») ou 3,5 s et plus (« c'est tout ») : finie (p = 0,95) ; entre les deux (« raconte lentement ta journée ») : pas finie (p = 0,15). */
import fs from 'node:fs';
console.log(JSON.stringify({ready: true}));
const proba = (w) => {
  const raw = w.subarray(44), t = raw.toString('utf8').replace(/\0+/g, '').trim();
  if (t.startsWith('DIT:')) { const m = /\|TOUR:([\d.]+)/.exec(t); return m ? +m[1] : 0.95; }
  const n = Math.floor(raw.length / 2); let loud = 0;
  for (let i = 0; i < n; i++) if (Math.abs(raw.readInt16LE(i * 2)) > 1500) loud++;
  const sec = loud / 16000;
  return sec >= 1.4 && sec < 3.5 ? 0.15 : 0.95;
};
let buf = '';
process.stdin.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); try { const r = JSON.parse(line); console.log(JSON.stringify({id: r.id, ok: true, p: proba(fs.readFileSync(r.wav)), ms: 1})); } catch (e) { console.log(JSON.stringify({ok: false, error: String(e)})); } } });
