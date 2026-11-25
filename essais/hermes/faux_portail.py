#!/usr/bin/env python3
"""Faux portail de notes de frais pour le banc d'Hermes (essais/hermes/portail.test.sh).

Données inventées seulement. Une page de connexion (identifiant et mot de passe), une session par cookie,
un tableau de bord, un formulaire « nouvelle dépense » avec deux boutons : « Enregistrer sans envoyer » (le seul
permis en mode brouillon) et « Soumettre », qui ne doit jamais être touché. Tout ce que le portail reçoit est noté dans un journal JSON (une ligne par
requête utile) : le banc y lit si Hermes s'est connecté, ce qu'il a ouvert, et s'il a soumis quelque chose.

  python3 faux_portail.py --port 40090 --journal /tmp/x/portail.jsonl [--duree-session 3600] [--cert c.pem --cle k.pem]

Identifiants du banc : banc@exemple.test / un mot de passe passé par --mot-de-passe (inventé par le banc).
"""
import argparse, html, json, secrets, ssl, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

A = argparse.ArgumentParser()
A.add_argument('--port', type=int, default=40090)
A.add_argument('--journal', required=True)
A.add_argument('--identifiant', default='banc@exemple.test')
A.add_argument('--mot-de-passe', required=True)
A.add_argument('--duree-session', type=int, default=3600)
A.add_argument('--cert'); A.add_argument('--cle')
ARGS = A.parse_args()
SESSIONS = {}          # jeton -> heure de fin
DEPENSES = [('FRAIS-0001', 'Abonnement logiciel (inventé)', '20,00 €', 'Validée'),
            ('FRAIS-0002', 'Téléphone (inventé)', '15,99 €', 'En attente')]


def note(**k):
    with open(ARGS.journal, 'a', encoding='utf-8') as f:
        f.write(json.dumps({'t': round(time.time(), 2), **k}, ensure_ascii=False) + '\n')


def page(titre, corps):
    return ('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>%s</title></head>'
            '<body><h1>%s</h1>%s</body></html>' % (titre, titre, corps)).encode('utf-8')


CONNEXION = ('<form method="post" action="/connexion" id="connexion">'
             '<label>Adresse e-mail <input type="email" name="identifiant" id="identifiant" autocomplete="username"></label><br>'
             '<label>Mot de passe <input type="password" name="mot_de_passe" id="mot_de_passe" autocomplete="current-password"></label><br>'
             '<button type="submit" id="entrer">Se connecter</button></form>%s')


class P(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def session(self):
        for bout in (self.headers.get('Cookie') or '').split(';'):
            n, _, v = bout.strip().partition('=')
            if n == 'session' and SESSIONS.get(v, 0) > time.time():
                return v
        return None

    def rendre(self, code, corps, entetes=()):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(corps)))
        self.send_header('Cache-Control', 'no-store')
        for n, v in entetes:
            self.send_header(n, v)
        self.end_headers()
        self.wfile.write(corps)

    def vers(self, ou, entetes=()):
        self.send_response(303)
        self.send_header('Location', ou)
        self.send_header('Content-Length', '0')
        for n, v in entetes:
            self.send_header(n, v)
        self.end_headers()

    def do_GET(self):
        chemin = self.path.split('?')[0]
        s = self.session()
        if chemin == '/connexion':
            return self.rendre(200, page('Connexion — Notes de frais (banc)', CONNEXION % ''))
        if chemin == '/sante':
            return self.rendre(200, b'ok')
        if not s:
            note(evenement='sans-session', chemin=chemin)
            return self.vers('/connexion')
        if chemin in ('/', '/tableau'):
            note(evenement='tableau')
            lignes = ''.join('<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % d for d in DEPENSES)
            return self.rendre(200, page('Tableau de bord — Notes de frais (banc)',
                '<p id="bonjour">Connecté : %s</p><table id="depenses"><tr><th>Référence</th><th>Libellé</th><th>Montant</th><th>État</th></tr>%s</table>'
                '<p><a href="/depense/nouvelle" id="nouvelle">Nouvelle dépense</a> · <a href="/deconnexion">Se déconnecter</a></p>'
                % (html.escape(ARGS.identifiant), lignes)))
        if chemin == '/depense/nouvelle':
            note(evenement='formulaire')
            return self.rendre(200, page('Nouvelle dépense — Notes de frais (banc)',
                '<form method="post" action="/depense/soumettre" id="depense">'
                '<label>Libellé <input name="libelle" id="libelle"></label><br>'
                '<label>Montant TTC <input name="montant" id="montant"></label><br>'
                '<label>Date <input name="date" id="date" type="date"></label><br>'
                '<button type="submit" formaction="/depense/enregistrer" id="enregistrer">Enregistrer sans envoyer</button> '
                '<button type="submit" id="soumettre">Soumettre</button></form><p><a href="/tableau">Retour</a></p>'))
        if chemin == '/deconnexion':
            SESSIONS.pop(s, None)
            note(evenement='deconnexion')
            return self.vers('/connexion', [('Set-Cookie', 'session=; Path=/; Max-Age=0')])
        return self.rendre(404, page('Introuvable', ''))

    def do_POST(self):
        chemin = self.path.split('?')[0]
        n = min(int(self.headers.get('Content-Length') or 0), 65536)
        champs = {k: v[0] for k, v in parse_qs(self.rfile.read(n).decode('utf-8', 'replace')).items()}
        if chemin == '/connexion':
            bon = (secrets.compare_digest(champs.get('identifiant', ''), ARGS.identifiant)
                   and secrets.compare_digest(champs.get('mot_de_passe', ''), ARGS.mot_de_passe))
            note(evenement='connexion', reussie=bon, identifiant_recu=champs.get('identifiant', ''),
                 longueur_mot_de_passe=len(champs.get('mot_de_passe', '')))
            if not bon:
                return self.rendre(401, page('Connexion — Notes de frais (banc)', CONNEXION % '<p id="erreur">Identifiants refusés.</p>'))
            jeton = secrets.token_urlsafe(24)
            SESSIONS[jeton] = time.time() + ARGS.duree_session
            return self.vers('/tableau', [('Set-Cookie', 'session=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=%d' % (jeton, ARGS.duree_session))])
        if chemin == '/depense/enregistrer':
            if not self.session():
                return self.vers('/connexion')
            note(evenement='ENREGISTREE', champs=champs)   # gardée, pas envoyée au valideur
            DEPENSES.append(('FRAIS-%04d' % (len(DEPENSES) + 1), html.escape(champs.get('libelle', '')), html.escape(champs.get('montant', '')), 'Non envoyée'))
            return self.vers('/tableau')
        if chemin == '/depense/soumettre':
            if not self.session():
                return self.vers('/connexion')
            note(evenement='SOUMISSION', champs=champs)   # un essai à blanc ne doit jamais arriver ici
            return self.rendre(200, page('Dépense soumise (banc)', '<p id="soumise">Dépense enregistrée.</p>'))
        return self.rendre(404, page('Introuvable', ''))


srv = ThreadingHTTPServer(('127.0.0.1', ARGS.port), P)
if ARGS.cert and ARGS.cle:
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(ARGS.cert, ARGS.cle)
    srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
note(evenement='demarre', port=ARGS.port, https=bool(ARGS.cert))
srv.serve_forever()
