#!/usr/bin/env python3
"""pty_saisie.py <fichier de réponses> -- commande… (banc d'Hermes, données inventées)

Lance la commande dans un faux terminal et, chaque fois qu'elle attend (plus rien d'écrit depuis 1,2 s), lui
envoie la ligne suivante du fichier de réponses. Affiche tout ce qu'elle écrit. Rend le code de la commande."""
import os, pty, select, sys, time
reponses = open(sys.argv[1], encoding='utf-8').read().split('\n')
commande = sys.argv[sys.argv.index('--') + 1:]
pid, fd = pty.fork()
if pid == 0:
    os.execvp(commande[0], commande)
i, dernier, fin, code = 0, time.time(), time.time() + 180, None
while time.time() < fin:
    try:
        r, _, _ = select.select([fd], [], [], 0.2)
        if r:
            d = os.read(fd, 4096)
            if not d:
                break
            sys.stdout.write(d.decode('utf-8', 'replace')); sys.stdout.flush(); dernier = time.time()
            continue
    except OSError:
        break
    p, st = os.waitpid(pid, os.WNOHANG)
    if p:
        code = os.waitstatus_to_exitcode(st); break
    if time.time() - dernier > 1.2 and i < len(reponses):
        os.write(fd, (reponses[i] + '\n').encode()); i += 1; dernier = time.time()
if code is None:
    try:
        _, st = os.waitpid(pid, 0); code = os.waitstatus_to_exitcode(st)
    except ChildProcessError:
        code = 0
sys.exit(code if code >= 0 else 1)
