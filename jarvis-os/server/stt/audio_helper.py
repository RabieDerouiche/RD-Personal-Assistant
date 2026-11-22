"""JARVIS OS 0.64.0 : un message vocal reçu (m4a de l'iPhone, ou autre) → WAV 16 kHz mono 16 bits, pour l'écoute et pour la page.
Lancé une fois par message par server.mjs, avec le Python de l'écoute : PyAV y est déjà (dépendance de faster-whisper) et porte son propre FFmpeg.
Appelé directement (av.open sans option), pas par faster_whisper.decode_audio : sa 1.2 passe à PyAV une option que PyAV 19 n'a plus.
Usage : python audio_helper.py entrée sortie.wav [secondes max] ; code 0 si la sortie est écrite. « --essai » : PyAV est-il là ? (code 0)"""
import sys, wave
import av

if sys.argv[1:2] == ["--essai"]:
    sys.exit(0)
src, dst = sys.argv[1], sys.argv[2]
limite = int(16000 * float(sys.argv[3] if len(sys.argv) > 3 else 90))
pcm, n = bytearray(), 0
with av.open(src) as c:
    flux = next(s for s in c.streams if s.type == "audio")
    rs = av.AudioResampler(format="s16", layout="mono", rate=16000)

    def ajoute(trames):
        global n
        if trames is None:
            return
        for t in (trames if isinstance(trames, list) else [trames]):
            b = t.to_ndarray().tobytes()
            pcm.extend(b)
            n += len(b) // 2

    for trame in c.decode(flux):
        ajoute(rs.resample(trame))
        if n >= limite:
            break
    ajoute(rs.resample(None))
if n == 0:
    sys.exit(2)
with wave.open(dst, "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(16000)
    w.writeframes(bytes(pcm[: limite * 2]))
