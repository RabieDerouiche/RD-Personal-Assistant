#!/usr/bin/env node
/* Banc du convertisseur de messages vocaux (audio.mjs, 0.64.0) : sons fabriqués ici (un « la » de 1 s), aucun outil extérieur.
   Formats : WAV 16 kHz mono (gardé tel quel), WAV entier 16/24 bits stéréo 44,1 kHz, WAV flottant 32 bits, WAV « extensible »,
   AIFF gros-boutiste (« Encoder le média » de l'iPhone), AIFF-C « sowt » et « fl32 » ; un fichier qui n'est pas du son est refusé ;
   le Python de l'écoute (PyAV) est essayé s'il est là (sinon : signalé, pas un échec). */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {fileURLToPath} from 'node:url'; import {spawnSync} from 'node:child_process';
import {createAudio} from '../audio.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-audio-'));
let fails = 0; const ok = (n, c, i) => { console.log((c ? 'OK    ' : 'ÉCHEC ') + n + (i ? ' :: ' + i : '')); if (!c) fails++; };
const FR = 44100, N = FR, la = (i, fr = FR) => Math.sin(2 * Math.PI * 440 * i / fr) * 0.5;
const chunk = (id, data, le = true) => { const h = Buffer.alloc(8); h.write(id, 0); if (le) h.writeUInt32LE(data.length, 4); else h.writeUInt32BE(data.length, 4); return Buffer.concat([h, data, data.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]); };
function wav({code = 1, bits = 16, voies = 2, fr = FR, ext = false}) {
  const t = bits / 8, n = Math.round(N * fr / FR), d = Buffer.alloc(n * voies * t);
  for (let i = 0; i < n; i++) for (let c = 0; c < voies; c++) { const v = la(i, fr), o = (i * voies + c) * t;
    if (code === 3) d.writeFloatLE(v, o); else if (bits === 16) d.writeInt16LE(Math.round(v * 32767), o); else if (bits === 24) d.writeIntLE(Math.round(v * 8388607), o, 3); }
  const f = Buffer.alloc(ext ? 40 : 16); f.writeUInt16LE(ext ? 0xfffe : code, 0); f.writeUInt16LE(voies, 2); f.writeUInt32LE(fr, 4); f.writeUInt32LE(fr * voies * t, 8); f.writeUInt16LE(voies * t, 12); f.writeUInt16LE(bits, 14);
  if (ext) { f.writeUInt16LE(22, 16); f.writeUInt16LE(bits, 18); f.writeUInt16LE(code, 24); }
  const corps = Buffer.concat([Buffer.from('WAVE'), chunk('fmt ', f), chunk('LIST', Buffer.from('INFOISFT\x04\0\0\0test')), chunk('data', d)]);
  return Buffer.concat([Buffer.from('RIFF'), Buffer.from(new Uint32Array([corps.length]).buffer), corps]);
}
function aiff({type = null, voies = 2}) {   /* type null : AIFF ; sinon AIFF-C avec ce type */
  const t = type === 'fl32' ? 4 : 2, d = Buffer.alloc(N * voies * t);
  for (let i = 0; i < N; i++) for (let c = 0; c < voies; c++) { const v = la(i), o = (i * voies + c) * t; if (type === 'fl32') d.writeFloatBE(v, o); else if (type === 'sowt') d.writeInt16LE(Math.round(v * 32767), o); else d.writeInt16BE(Math.round(v * 32767), o); }
  const comm = Buffer.alloc(type ? 24 : 18); comm.writeUInt16BE(voies, 0); comm.writeUInt32BE(N, 2); comm.writeUInt16BE(t * 8, 6); comm.writeUInt16BE(0x400e, 8); comm.writeUInt32BE(0xac440000, 10); comm.writeUInt32BE(0, 14); if (type) { comm.write(type, 18); comm.writeUInt16BE(0, 22); }
  const ssnd = Buffer.concat([Buffer.alloc(8), d]);
  const corps = Buffer.concat([Buffer.from(type ? 'AIFC' : 'AIFF'), ...(type ? [chunk('FVER', Buffer.from([0xa2, 0x80, 0x51, 0x40]), false)] : []), chunk('COMM', comm, false), chunk('SSND', ssnd, false)]);
  const h = Buffer.alloc(8); h.write('FORM', 0); h.writeUInt32BE(corps.length, 4); return Buffer.concat([h, corps]);
}
/* le résultat : 16 kHz mono 16 bits, 1 s, un « la » (≈ 880 passages par zéro), à peu près la même force */
const mesure = (w) => { const n = (w.length - 44) / 2; let zc = 0, max = 0, prev = 0; for (let i = 0; i < n; i++) { const v = w.readInt16LE(44 + i * 2); max = Math.max(max, Math.abs(v)); if (i && (prev < 0) !== (v < 0)) zc++; prev = v; } return {fr: w.readUInt32LE(24), voies: w.readUInt16LE(22), bits: w.readUInt16LE(34), n, zc, max}; };
const bon = (m) => m.fr === 16000 && m.voies === 1 && m.bits === 16 && Math.abs(m.n - 16000) <= 2 && Math.abs(m.zc - 880) <= 3 && m.max > 15000 && m.max < 17500;
const A = createAudio({py: '', helper: '', ffmpeg: '', tmp: TMP});
for (const [nom, buf] of [['WAV 16 bits stéréo 44,1 kHz', wav({})], ['WAV 24 bits stéréo', wav({bits: 24})], ['WAV flottant 32 bits mono 48 kHz', wav({code: 3, bits: 32, voies: 1, fr: 48000})], ['WAV « extensible » 16 bits', wav({ext: true})],
  ['AIFF gros-boutiste (« Encoder le média » de l’iPhone)', aiff({})], ['AIFF-C « sowt »', aiff({type: 'sowt'})], ['AIFF-C « fl32 » mono', aiff({type: 'fl32', voies: 1})]]) {
  const r = await A.versWav16k(buf), m = r && mesure(r.wav); ok('converti : ' + nom + ' → 16 kHz mono, 1 s, même son', !!r && bon(m), JSON.stringify(m));
}
{ const src = wav({voies: 1, fr: 16000}), r = await A.versWav16k(src); ok('WAV déjà en 16 kHz mono : gardé tel quel (mêmes échantillons)', !!r && r.format === 'wav' && r.wav.subarray(44).equals(src.subarray(src.length - 32000))); }
{ const long = wav({voies: 1, fr: 16000}), d = Buffer.alloc(16000 * 2 * 100), big = Buffer.concat([long.subarray(0, long.length - 32000), d]); big.writeUInt32LE(d.length, long.length - 32000 - 4);
  const r = await A.versWav16k(big); ok('100 s → coupé à 90 s', !!r && Math.abs(r.duree - 90) < 0.01, r && String(r.duree)); }
ok('un fichier qui n’est pas du son (ni PyAV ni ffmpeg) → refusé ; le serveur dit alors de passer par AIFF', (await A.versWav16k(Buffer.from('x'.repeat(200)))) === null && (await A.m4a()) === false);
/* le vrai convertisseur (stt/audio_helper.py), si un Python avec PyAV est là ; ffmpeg fabrique un m4a de 1 s (sinon : pas essayé) */
const py = process.env.JARVIS_AUDIO_PY_ESSAI || 'python3', helper = path.join(HERE, '..', 'stt', 'audio_helper.py');
if (spawnSync(py, [helper, '--essai']).status === 0 && spawnSync('ffmpeg', ['-version']).status === 0) {
  const m4a = path.join(TMP, 'essai.m4a'); spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1:sample_rate=44100', '-ac', '2', '-c:a', 'aac', m4a]);
  const B = createAudio({py, helper, ffmpeg: '', tmp: TMP}), r = await B.versWav16k(fs.readFileSync(m4a)), m = r && mesure(r.wav);
  ok('m4a de l’iPhone par PyAV (stt/audio_helper.py) → 16 kHz mono', !!r && r.format === 'pyav' && m.fr === 16000 && Math.abs(m.zc - 880) <= 8 && (await B.m4a()) === true, JSON.stringify(m));
} else console.log('(PyAV ou ffmpeg absent ici : le m4a par stt/audio_helper.py n’est pas essayé ; JARVIS_AUDIO_PY_ESSAI=<python avec PyAV> pour l’essayer)');
fs.rmSync(TMP, {recursive: true, force: true});
console.log(fails ? fails + ' échec(s)' : 'Tout passe.'); process.exit(fails ? 1 : 0);
