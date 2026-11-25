#!/usr/bin/env python3
"""hermes-portail-filtre — la seule porte de sortie de l'utilisateur hermes-portail (docs/hermes-portail.md).

Un relais HTTPS (méthode CONNECT) qui ne laisse passer que les hôtes de /etc/hermes-portail/domaines : le
portail, et ce qu'il faut à Claude. Tout le reste est refusé et noté. L'utilisateur hermes-portail ne joint
rien d'autre sur le réseau (sortie.nft) : même si une page piégée faisait écrire du code au modèle, ce code ne
pourrait rien envoyer ailleurs. Aucune dépendance (Python du système). Copie root : /usr/local/lib/hermes-portail/.

  filtre.py --port 8891 --domaines /etc/hermes-portail/domaines [--ports 443]

Fichier des domaines : un hôte par ligne (« exemple.com » : cet hôte exact ; « .exemple.com » : lui et ses
sous-domaines) ; « # » commente. Relu à chaque demande : pas besoin de relancer le service après un changement.
"""
import argparse, asyncio, ipaddress, re, socket, sys, time

A = argparse.ArgumentParser()
A.add_argument('--port', type=int, default=8891)
A.add_argument('--domaines', default='/etc/hermes-portail/domaines')
A.add_argument('--ports', default='443')            # ports de destination permis (le banc en ajoute un)
A.add_argument('--prives', action='store_true')     # banc seulement : laisse joindre 127.0.0.1
ARGS = A.parse_args()
PORTS = {int(p) for p in ARGS.ports.split(',') if p.strip()}
HOTE = re.compile(r'^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$')


def dire(*mots):
    print(time.strftime('%Y-%m-%d %H:%M:%S'), *mots, flush=True)


def permis(hote):
    try:
        lignes = open(ARGS.domaines, encoding='utf-8').read().split('\n')
    except OSError:
        return False
    for l in lignes:
        l = l.split('#')[0].strip().lower()
        if not l:
            continue
        if l.startswith('.') and (hote == l[1:] or hote.endswith(l)):
            return True
        if hote == l:
            return True
    return False


def adresse_sure(ip):
    a = ipaddress.ip_address(ip)
    return ARGS.prives or not (a.is_private or a.is_loopback or a.is_link_local or a.is_multicast or a.is_reserved or a.is_unspecified)


async def tuyau(src, dst):
    try:
        while True:
            d = await src.read(65536)
            if not d:
                break
            dst.write(d)
            await dst.drain()
    except (OSError, asyncio.IncompleteReadError):
        pass
    finally:
        try:
            dst.close()
        except OSError:
            pass


async def client(r, w):
    async def refuser(code, raison, hote='?'):
        dire('refusé', hote, '(' + raison + ')')
        w.write(('HTTP/1.1 %d Refuse\r\nContent-Length: 0\r\nConnection: close\r\n\r\n' % code).encode())
        try:
            await w.drain()
        except OSError:
            pass
        w.close()
    try:
        tete = await asyncio.wait_for(r.readuntil(b'\r\n\r\n'), 15)
    except (asyncio.TimeoutError, asyncio.IncompleteReadError, asyncio.LimitOverrunError, OSError):
        w.close()
        return
    ligne = tete.split(b'\r\n', 1)[0].decode('latin-1').split(' ')
    if len(ligne) < 2 or ligne[0].upper() != 'CONNECT':
        return await refuser(405, 'seul CONNECT (HTTPS) est permis', ligne[1][:80] if len(ligne) > 1 else '?')
    hote, _, port = ligne[1].rpartition(':')
    hote = hote.strip('[]').lower().rstrip('.')
    if not HOTE.match(hote) or not port.isdigit():
        return await refuser(400, 'hôte ou port mal formé', hote[:80])
    if int(port) not in PORTS:
        return await refuser(403, 'port %s non permis' % port, hote)
    if not permis(hote):
        return await refuser(403, 'hôte absent de la liste', hote)
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(hote, int(port), type=socket.SOCK_STREAM)
    except OSError:
        return await refuser(502, 'nom introuvable', hote)
    cibles = [i[4][0] for i in infos if adresse_sure(i[4][0])]
    if not cibles:
        return await refuser(403, 'adresse privée ou locale', hote)
    # IPv4 d'abord, puis chaque adresse à son tour, 6 s chacune : sur le serveur, l'IPv6 sortant ne répond pas
    # (constaté le 25/11/2026) et une seule tentative en IPv6 aurait fait attendre chaque connexion.
    cibles = sorted(dict.fromkeys(cibles), key=lambda a: ':' in a)[:4]
    r2 = w2 = None
    for cible in cibles:
        try:
            r2, w2 = await asyncio.wait_for(asyncio.open_connection(cible, int(port)), 6)
            break
        except (OSError, asyncio.TimeoutError):
            continue
    if w2 is None:
        return await refuser(502, 'injoignable', hote)
    dire('permis', hote)
    w.write(b'HTTP/1.1 200 Connection established\r\n\r\n')
    await w.drain()
    await asyncio.gather(tuyau(r, w2), tuyau(r2, w))


async def principal():
    srv = await asyncio.start_server(client, '127.0.0.1', ARGS.port, limit=16384)
    dire('filtre prêt sur 127.0.0.1:%d, ports %s, liste %s' % (ARGS.port, sorted(PORTS), ARGS.domaines))
    async with srv:
        await srv.serve_forever()

try:
    asyncio.run(principal())
except KeyboardInterrupt:
    sys.exit(0)
