#!/usr/bin/env node
/* Fausse voix pour le banc : même protocole que tts/piper_helper.py ; écrit un vrai petit WAV dont les échantillons sont le texte reçu. */
import fs from 'node:fs';
const wav = (text) => { const data = Buffer.from('RIFF-faux:' + text, 'utf8'), h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(8000, 24); h.writeUInt32LE(8000, 28); h.writeUInt16LE(1, 32); h.writeUInt16LE(8, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40); return Buffer.concat([h, data]); };
console.log(JSON.stringify({ready: true}));
let buf = '';
process.stdin.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); try { const r = JSON.parse(line); fs.writeFileSync(r.out, wav(r.text)); console.log(JSON.stringify({id: r.id, ok: true})); } catch { /* rien */ } } });
