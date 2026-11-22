/* JARVIS OS — un message vocal reçu, mis au format de l'écoute du serveur (0.64.0, 22/11/2026).
   Son choix (QCM du 22/11/2026, « Sa propre voix ») : sa femme s'enregistre avec un raccourci de son iPhone ; le serveur garde sa voix (il
   l'écoute dans JARVIS) et la transcrit pour le texte de la tâche. L'écoute du serveur lit du WAV 16 kHz mono :
   1. ici, sans dépendance : WAV (entiers 8/16/24/32 bits ou flottants) et AIFF/AIFF-C (« NONE », « twos », « sowt », « fl32 », « fl64 ») ;
   2. le m4a de l'iPhone (« Enregistrer de l'audio ») : par stt/audio_helper.py, avec le Python de l'écoute, où PyAV (dépendance de
      faster-whisper) porte son propre FFmpeg ; essayé le 22/11/2026 avec PyAV 19 (m4a AAC 44,1 kHz stéréo → 16 kHz mono, 0,3 s) ;
   3. sinon ffmpeg, s'il est installé sur le serveur. Rien de tout ça : refusé, et Siri lui dit d'ajouter « Encoder le média » (AIFF).
   90 secondes au plus. */
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAX_S = 90;
/* le nombre flottant de 80 bits (fréquence d'un AIFF) */
function ext80(b, o) {
  const e = b.readUInt16BE(o) & 0x7fff, hi = b.readUInt32BE(o + 2), lo = b.readUInt32BE(o + 6);
  if (!e && !hi && !lo) return 0;
  return (hi * 2 ** 32 + lo) * 2 ** (e - 16383 - 63);
}
/* des échantillons entrelacés → un canal (moyenne), en flottants de -1 à 1 */
function lire(b, o, n, voies, lireUn, taille) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < voies; c++) s += lireUn(b, o + (i * voies + c) * taille); out[i] = s / voies; }
  return out;
}
const LECT = {
  pcmLE: (bits) => (bits === 8 ? (b, o) => (b[o] - 128) / 128 : bits === 16 ? (b, o) => b.readInt16LE(o) / 32768 : bits === 24 ? (b, o) => b.readIntLE(o, 3) / 8388608 : (b, o) => b.readInt32LE(o) / 2147483648),
  pcmBE: (bits) => (bits === 8 ? (b, o) => b.readInt8(o) / 128 : bits === 16 ? (b, o) => b.readInt16BE(o) / 32768 : bits === 24 ? (b, o) => b.readIntBE(o, 3) / 8388608 : (b, o) => b.readInt32BE(o) / 2147483648),
};
function depuisWav(b) {
  let o = 12, fmt = null, data = null;
  while (o + 8 <= b.length) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4); if (id === 'fmt ') fmt = o + 8; if (id === 'data') { data = [o + 8, Math.min(sz, b.length - o - 8)]; break; } o += 8 + sz + (sz & 1); }
  if (fmt === null || !data) return null;
  let code = b.readUInt16LE(fmt); const voies = b.readUInt16LE(fmt + 2), freq = b.readUInt32LE(fmt + 4), bits = b.readUInt16LE(fmt + 14);
  if (code === 0xfffe && b.length >= fmt + 26) code = b.readUInt16LE(fmt + 24);   /* WAVE_FORMAT_EXTENSIBLE : le vrai format */
  if (!voies || !freq || ![8, 16, 24, 32, 64].includes(bits)) return null;
  const taille = bits / 8, n = Math.floor(data[1] / (taille * voies));
  if (code === 1 && bits === 16 && voies === 1 && freq === 16000) return {pcm16: b.subarray(data[0], data[0] + n * 2), freq};   /* déjà au bon format : gardé tel quel */
  const lu = code === 3 ? (bits === 32 ? (x, k) => x.readFloatLE(k) : (x, k) => x.readDoubleLE(k)) : code === 1 && bits <= 32 ? LECT.pcmLE(bits) : null;
  return lu ? {s: lire(b, data[0], n, voies, lu, taille), freq} : null;
}
function depuisAiff(b) {
  const aifc = b.toString('ascii', 8, 12) === 'AIFC'; let o = 12, comm = null, ssnd = null;
  while (o + 8 <= b.length) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32BE(o + 4); if (id === 'COMM') comm = o + 8; if (id === 'SSND') ssnd = [o + 8, Math.min(sz, b.length - o - 8)]; o += 8 + sz + (sz & 1); }
  if (comm === null || !ssnd) return null;
  const voies = b.readUInt16BE(comm), bits = b.readUInt16BE(comm + 6), freq = ext80(b, comm + 8), type = aifc ? b.toString('ascii', comm + 18, comm + 22) : 'NONE';
  const debut = ssnd[0] + 8 + b.readUInt32BE(ssnd[0]);
  if (!voies || !freq) return null;
  let taille, lu;
  if (type === 'NONE' || type === 'twos') { taille = Math.ceil(bits / 8); lu = taille <= 4 ? LECT.pcmBE(taille * 8) : null; }
  else if (type === 'sowt') { taille = Math.ceil(bits / 8); lu = taille <= 4 ? LECT.pcmLE(taille * 8) : null; }
  else if (type === 'fl32' || type === 'FL32') { taille = 4; lu = (x, k) => x.readFloatBE(k); }
  else if (type === 'fl64' || type === 'FL64') { taille = 8; lu = (x, k) => x.readDoubleBE(k); }
  if (!lu) return null;
  const n = Math.floor((ssnd[0] + ssnd[1] - debut) / (taille * voies));
  return {s: lire(b, debut, Math.max(0, n), voies, lu, taille), freq};
}
const entete = (n) => { const out = Buffer.alloc(44); out.write('RIFF', 0); out.writeUInt32LE(36 + n * 2, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(16000, 24); out.writeUInt32LE(32000, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(n * 2, 40); return out; };
/* 16 kHz mono, 16 bits : rééchantillonné par interpolation linéaire (la voix n'a pas besoin de plus) */
function versWav(s, freq) {
  if (s && s.pcm16) { const n = Math.min(Math.floor(s.pcm16.length / 2), 16000 * MAX_S); return {wav: Buffer.concat([entete(n), s.pcm16.subarray(0, n * 2)]), duree: n / 16000}; }
  const n = Math.min(Math.floor(s.length * 16000 / freq), 16000 * MAX_S), out = Buffer.concat([entete(n), Buffer.alloc(n * 2)]), r = freq / 16000;
  for (let i = 0; i < n; i++) { const x = i * r, k = Math.floor(x), f = x - k, v = (s[k] || 0) * (1 - f) + (s[k + 1] || 0) * f; out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2); }
  return {wav: out, duree: n / 16000};
}
/* un programme qui convertit (le helper Python, ou ffmpeg) : entrée par un fichier (un m4a se lit en sautant dans le fichier), sortie WAV */
function convertit(cmd, args, entree, sortie) {
  return new Promise((ok) => {
    let p; try { p = spawn(cmd, args, {stdio: ['ignore', 'ignore', 'pipe']}); } catch { ok(null); return; }
    const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* rien */ } }, 30000);
    p.stderr.on('data', () => {}); p.on('error', () => { clearTimeout(t); ok(null); });
    p.on('close', (c) => { clearTimeout(t); let w = null; try { if (c === 0) w = fs.readFileSync(sortie); } catch { w = null; } try { fs.rmSync(entree, {force: true}); fs.rmSync(sortie, {force: true}); } catch { /* rien */ } ok(w && w.length > 44 ? w : null); });
  });
}
const essaie = (cmd, args) => new Promise((ok) => { let p; try { p = spawn(cmd, args, {stdio: 'ignore'}); } catch { ok(false); return; } const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* rien */ } ok(false); }, 15000); p.on('error', () => { clearTimeout(t); ok(false); }); p.on('close', (c) => { clearTimeout(t); ok(c === 0); }); });
/* py : le Python de l'écoute ; helper : stt/audio_helper.py ; ffmpeg : '' pour ne pas s'en servir ; tmp : dossier de travail */
export function createAudio({py = '', helper = '', ffmpeg = 'ffmpeg', tmp}) {
  let capa = null;
  const pyOk = () => !!(py && helper && fs.existsSync(py) && fs.existsSync(helper));
  /* le serveur lit-il le m4a de l'iPhone ? (vérifié une fois toutes les 10 minutes : l'écoute peut être installée entre-temps) */
  const m4a = () => { if (!capa || Date.now() - capa.at > 600000) capa = {at: Date.now(), ok: (async () => (pyOk() && await essaie(py, [helper, '--essai'])) || (!!ffmpeg && await essaie(ffmpeg, ['-version'])))()}; return capa.ok; };
  /* le message reçu → {wav (16 kHz mono), duree, format} ; null si illisible */
  async function versWav16k(buf) {
    try {
      if (!Buffer.isBuffer(buf) || buf.length < 64) return null;
      const tete = buf.toString('ascii', 0, 4), genre = buf.toString('ascii', 8, 12);
      const r = tete === 'RIFF' && genre === 'WAVE' ? depuisWav(buf) : tete === 'FORM' && (genre === 'AIFF' || genre === 'AIFC') ? depuisAiff(buf) : null;
      if (r && (r.pcm16 || r.s.length)) return {...versWav(r.pcm16 ? r : r.s, r.freq), format: tete === 'RIFF' ? 'wav' : 'aiff'};
      if (r) return null;
      fs.mkdirSync(tmp, {recursive: true});
      const base = path.join(tmp, 'vocal-' + crypto.randomBytes(6).toString('hex')), entree = base + '.in', sortie = base + '.wav';
      for (const [cmd, args, nom] of [pyOk() ? [py, [helper, entree, sortie, String(MAX_S)], 'pyav'] : null, ffmpeg ? [ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', entree, '-t', String(MAX_S), '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', sortie], 'ffmpeg'] : null].filter(Boolean)) {
        fs.writeFileSync(entree, buf, {mode: 0o600});
        const w = await convertit(cmd, args, entree, sortie), x = w && depuisWav(w);
        if (x && (x.pcm16 || x.s.length)) return {...versWav(x.pcm16 ? x : x.s, x.freq), format: nom};
      }
      return null;
    } catch { return null; }
  }
  return {versWav16k, m4a};
}
