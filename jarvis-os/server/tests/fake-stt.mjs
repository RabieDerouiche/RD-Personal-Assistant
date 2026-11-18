#!/usr/bin/env node
/* Fausse écoute pour les bancs : même protocole que stt/whisper_helper.py.
   - WAV du banc serveur : le texte « entendu » est écrit en clair après l'en-tête (« DIT:… ») ;
   - WAV envoyé par la page (faux micro du banc) : selon la durée de la voix, une phrase courte (moins de 1,4 s : « quelle heure est-il »)
     ou longue (« raconte lentement ta journée ») ;
   - silence : la phrase inventée connue de Whisper (« Amara.org »), que le serveur doit écarter. */
import fs from 'node:fs';
console.log(JSON.stringify({ready: true}));
let buf = '';
const said = (w) => {
  const raw = w.subarray(44), t = raw.toString('utf8').replace(/\0+/g, '').trim();
  if (t.startsWith('DIT:')) return t.slice(4);
  const n = Math.floor(raw.length / 2); let loud = 0;
  for (let i = 0; i < n; i++) if (Math.abs(raw.readInt16LE(i * 2)) > 1500) loud++;
  const sec = loud / 16000;
  if (sec < 0.2) return 'Sous-titres réalisés par la communauté d\'Amara.org';
  return sec < 1.4 ? 'quelle heure est-il' : 'raconte lentement ta journée';
};
process.stdin.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); try { const r = JSON.parse(line); console.log(JSON.stringify({id: r.id, ok: true, text: said(fs.readFileSync(r.wav))})); } catch (e) { console.log(JSON.stringify({ok: false, error: String(e)})); } } });
