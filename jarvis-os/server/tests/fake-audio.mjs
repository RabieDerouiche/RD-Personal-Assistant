#!/usr/bin/env node
/* Faux convertisseur pour les bancs (0.64.0), même protocole que stt/audio_helper.py : « --essai » → code 0 ;
   « entrée sortie.wav [secondes] » : un faux m4a (« FAUXM4A » puis le texte, ou un en-tête « ftyp » comme l'iPhone, 0.67.0) devient un WAV
   16 kHz mono d'une seconde ; tout autre fichier : code 2 (illisible), comme PyAV devant un fichier qui n'est pas du son. */
import fs from 'node:fs';
const [a, b] = process.argv.slice(2);
if (a === '--essai') process.exit(0);
const x = fs.readFileSync(a);
if (x.toString('latin1', 0, 7) !== 'FAUXM4A' && x.toString('latin1', 4, 8) !== 'ftyp') process.exit(2);
const dit = Buffer.from('DIT:' + x.toString('utf8', 8).replace(/\0/g, '').trim()), n = Math.max(16000, Math.ceil(dit.length / 2)), w = Buffer.alloc(44 + n * 2);
w.write('RIFF', 0); w.writeUInt32LE(36 + n * 2, 4); w.write('WAVEfmt ', 8); w.writeUInt32LE(16, 16); w.writeUInt16LE(1, 20); w.writeUInt16LE(1, 22);
w.writeUInt32LE(16000, 24); w.writeUInt32LE(32000, 28); w.writeUInt16LE(2, 32); w.writeUInt16LE(16, 34); w.write('data', 36); w.writeUInt32LE(n * 2, 40); dit.copy(w, 44);
fs.writeFileSync(b, w);
