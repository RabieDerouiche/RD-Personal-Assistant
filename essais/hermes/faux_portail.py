#!/usr/bin/env python3
"""Faux portail de notes de frais pour le banc d'Hermes (essais/hermes/portail.test.sh).

Données inventées seulement. Une page de connexion (identifiant et mot de passe), une session par cookie,
un tableau de bord, un formulaire « nouvelle dépense » avec deux boutons : « Enregistrer sans envoyer » (le seul
permis en mode brouillon) et « Soumettre », qui ne doit jamais être touché. Tout ce que le portail reçoit est noté dans un journal JSON (une ligne par
requête utile) : le banc y lit si Hermes s'est connecté, ce qu'il a ouvert, et s'il a soumis quelque chose.

  python3 faux_portail.py --port 40090 --journal /tmp/x/portail.jsonl [--duree-session 3600] [--cert c.pem --cle k.pem]

Identifiants du banc : banc@exemple.test / un mot de passe passé par --mot-de-passe (inventé par le banc).
"""
import argparse, base64, hashlib, hmac, html, json, secrets, ssl, struct, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

A = argparse.ArgumentParser()
A.add_argument('--port', type=int, default=40090)
A.add_argument('--journal', required=True)
A.add_argument('--identifiant', default='banc@exemple.test')
A.add_argument('--mot-de-passe', required=True)
A.add_argument('--duree-session', type=int, default=3600)
A.add_argument('--totp', default='')                     # clé (base32) du second facteur de la connexion « double »
A.add_argument('--identifiant2', default='banc2@exemple.test')
A.add_argument('--cert'); A.add_argument('--cle')
ARGS = A.parse_args()
SESSIONS = {}          # jeton -> heure de fin
DEPENSES = [('FRAIS-0001', 'Abonnement logiciel (inventé)', '20,00 €', 'Validée'),
            ('FRAIS-0002', 'Téléphone (inventé)', '15,99 €', 'En attente')]


ETAPES = {}            # jeton d'étape (mot de passe accepté, code attendu) -> heure de fin


def totp(cle, instant):
    k = base64.b32decode(cle.upper() + '=' * (-len(cle) % 8))
    h = hmac.new(k, struct.pack('>Q', int(instant // 30)), hashlib.sha1).digest()
    o = h[-1] & 15
    return '%06d' % ((struct.unpack('>I', h[o:o + 4])[0] & 0x7fffffff) % 1000000)


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
        if chemin in ('/double', '/brut'):      # la même maison, mais par une porte à deux étapes
            if s:
                return self.vers('/tableau')
            return self.rendre(200, page('Connexion en deux étapes (banc)', CONNEXION.replace('/connexion', chemin + '/connexion') % ''))
        if chemin == '/double/code':
            return self.rendre(200, page('Code de vérification (banc)',
                '<form method="post" action="/double/code"><label>Code à 6 chiffres <input name="otp" id="otp" autocomplete="one-time-code" inputmode="numeric" maxlength="6"></label> '
                '<button type="submit" id="verifier">Vérifier</button></form>'))
        if chemin == '/brut/code':   # comme un vrai portail vu le 25/11/2026 : ni « autocomplete », ni nom ni libellé que le coffre reconnaisse
            return self.rendre(200, page('Code de sécurité (banc)',
                '<form method="post" action="/brut/code"><label>Code de sécurité <input name="code2fa" id="code2fa" type="text"></label> '
                '<button type="submit" id="verifier">Connexion</button></form>'))
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
                '<label>Justificatif <input name="justificatif" id="justificatif" type="file"></label><br>'
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
        if chemin in ('/double/connexion', '/brut/connexion'):
            bon = (secrets.compare_digest(champs.get('identifiant', ''), ARGS.identifiant2)
                   and secrets.compare_digest(champs.get('mot_de_passe', ''), ARGS.mot_de_passe))
            note(evenement='connexion-double', reussie=bon)
            if not bon:
                return self.rendre(401, page('Connexion en deux étapes (banc)', '<p id="erreur">Identifiants refusés.</p>'))
            e = secrets.token_urlsafe(16); ETAPES[e] = time.time() + 300
            return self.vers(chemin.replace('/connexion', '/code'), [('Set-Cookie', 'etape=%s; Path=/; HttpOnly; SameSite=Lax' % e)])
        if chemin in ('/double/code', '/brut/code'):
            e = next((b.strip().partition('=')[2] for b in (self.headers.get('Cookie') or '').split(';') if b.strip().startswith('etape=')), '')
            recu = champs.get('otp', '') or champs.get('code2fa', '')
            bon = bool(ARGS.totp) and ETAPES.get(e, 0) > time.time() and any(secrets.compare_digest(recu, totp(ARGS.totp, time.time() + d)) for d in (-30, 0, 30))
            note(evenement='code', bon=bon, longueur=len(recu))
            if not bon:
                return self.rendre(401, page('Code de vérification (banc)', '<p id="erreur">Code refusé.</p>'))
            ETAPES.pop(e, None); jeton = secrets.token_urlsafe(24); SESSIONS[jeton] = time.time() + ARGS.duree_session
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
