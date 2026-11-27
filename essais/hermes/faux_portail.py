#!/usr/bin/env python3
"""Faux portail de notes de frais pour le banc d'Hermes (essais/hermes/portail.test.sh).

Données inventées seulement. Une page de connexion (identifiant et mot de passe), une session par cookie,
un tableau de bord, un formulaire « nouvelle dépense » avec deux boutons : « Enregistrer sans envoyer » (le seul
permis en mode brouillon) et « Soumettre », qui ne doit jamais être touché. Tout ce que le portail reçoit est noté dans un journal JSON (une ligne par
requête utile) : le banc y lit si Hermes s'est connecté, ce qu'il a ouvert, et s'il a soumis quelque chose.

  python3 faux_portail.py --port 40090 --journal /tmp/x/portail.jsonl [--duree-session 3600] [--cert c.pem --cle k.pem]

Identifiants du banc : banc@exemple.test / un mot de passe passé par --mot-de-passe (inventé par le banc).
"""
import argparse, base64, hashlib, hmac, html, json, re, secrets, ssl, struct, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

A = argparse.ArgumentParser()
A.add_argument('--port', type=int, default=40090)
A.add_argument('--journal', required=True)
A.add_argument('--identifiant', default='banc@exemple.test')
A.add_argument('--mot-de-passe', required=True)
A.add_argument('--duree-session', type=int, default=3600)
A.add_argument('--pdf', default='')                      # une facture inventée, proposée au téléchargement une fois connecté
A.add_argument('--totp', default='')                     # clé (base32) du second facteur de la connexion « double »
A.add_argument('--identifiant2', default='banc2@exemple.test')
A.add_argument('--cert'); A.add_argument('--cle')
ARGS = A.parse_args()
SESSIONS = {}          # jeton -> heure de fin
DEPENSES = [('FRAIS-0001', 'Abonnement logiciel (inventé)', '20,00 €', 'Validée'),
            ('FRAIS-0002', 'Téléphone (inventé)', '15,99 €', 'En attente')]


ETAPES = {}            # jeton d'étape (mot de passe accepté, code attendu) -> heure de fin
FEUILLES = {}          # feuilles de temps du banc : date du lundi (MM/JJ/AAAA) -> quantités et état
ACTIVITES = {}         # 26/11/2026 : comptes rendus d'activité du mois (AAAA-MM) -> {date: [matin, après-midi]}, statut
SIGNES = {}            # 0.97.0 : CRA signés du client déposés (AAAA-MM) -> [(nom du fichier, taille, empreinte SHA-256)]


def activite_du_mois(m):
    # un mois du banc à moitié saisi (données inventées) : les jours ouvrés jusqu'au 20 sont en mission, sauf le 11 (férié)
    if m not in ACTIVITES:
        import calendar, datetime
        a, mo = int(m[:4]), int(m[5:7]); cases = {}
        for j in range(1, calendar.monthrange(a, mo)[1] + 1):
            d = datetime.date(a, mo, j)
            if d.weekday() < 5:
                cases[d.isoformat()] = (['Absence (Jours fériés)'] * 2 if j == 11 else ['Mission'] * 2) if j <= 20 else ['', '']
        ACTIVITES[m] = {'cases': cases, 'statut': 'Saisie en cours'}
    return ACTIVITES[m]


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
                '<p><a href="/depense/nouvelle" id="nouvelle">Nouvelle dépense</a> · <a href="/facture.pdf" id="telecharger" download>Télécharger la facture</a> · <a href="/deconnexion">Se déconnecter</a></p>'
                % (html.escape(ARGS.identifiant), lignes)))
        if chemin == '/facture.pdf':
            note(evenement='telechargement')
            corps = open(ARGS.pdf, 'rb').read() if ARGS.pdf else b''
            self.send_response(200); self.send_header('Content-Type', 'application/pdf'); self.send_header('Content-Length', str(len(corps)))
            self.send_header('Content-Disposition', 'attachment; filename="facture-du-banc.pdf"'); self.end_headers(); self.wfile.write(corps); return None
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
        if chemin == '/feuille':   # 25/11/2026 : une feuille de temps d'une semaine (CRA hebdomadaire), comme celle d'un vrai portail
            q = parse_qs(self.path.split('?', 1)[1]) if '?' in self.path else {}
            d = (q.get('date') or ['11/23/2026'])[0][:10]
            f = FEUILLES.setdefault(d, {'qty': [''] * 5, 'etat': ''})
            note(evenement='feuille', date=d, etat=f['etat'])
            cases = ''.join('<td><input name="QTY_DAY%d" id="QTY_DAY%d" value="%s"%s></td>' % (k + 1, k + 1, html.escape(f['qty'][k]), ' disabled' if f['etat'] == 'Submitted' else '') for k in range(5))
            return self.rendre(200, page('Timesheet (banc)',
                '<form method="post" action="/feuille/save" id="feuille"><label>Date <input name="date" id="DATE_DAY1" value="%s"></label> '
                '<a id="actualiser" href="/feuille?date=%s">Actualiser</a>'
                '<table id="grille"><tr><th>Code</th><th>Lun</th><th>Mar</th><th>Mer</th><th>Jeu</th><th>Ven</th></tr><tr><td>R002 - Regular Day</td>%s</tr></table>'
                '<button type="submit" id="save">Save</button> <button type="submit" formaction="/feuille/submit" id="submit">Submit</button></form>'
                '<table id="statut"><tr><th>Reported Time Status</th></tr><tr><td id="etat">%s</td></tr></table>' % (html.escape(d), html.escape(d), cases, html.escape(f['etat'] or ''))))
        if chemin == '/activite':   # 26/11/2026 : un compte rendu d'activité du mois, chaque clic s'enregistre, puis « Valider »
            q = parse_qs(self.path.split('?', 1)[1]) if '?' in self.path else {}
            m = (q.get('mois') or ['2026-11'])[0][:7]; A = activite_du_mois(m)
            note(evenement='activite', mois=m, statut=A['statut'])
            lignes = ''.join('<tr><td>%s</td><td class="matin">%s</td><td class="apres-midi">%s</td></tr>' % (d, html.escape(v[0]), html.escape(v[1])) for d, v in sorted(A['cases'].items()))
            onglets = '<nav id="onglets"><a id="onglet-saisie" href="/activite?mois=%s">Saisie</a> · <a id="onglet-signe" href="/activite/signe?mois=%s">CRA signé du client</a></nav>' % (html.escape(m), html.escape(m))
            return self.rendre(200, page('Compte rendu d’activité (banc)', onglets +
                '<p>Mois : %s · Statut : <b id="statut">%s</b> · Fin de mission : <span id="fin">30/11/2026</span></p>'
                '<table id="mois"><tr><th>Jour</th><th>Matin</th><th>Après-midi</th></tr>%s</table>'
                '<form method="post" action="/activite/case" id="case"><input name="mois" id="c_mois" value="%s"><input name="date" id="c_date">'
                '<select name="moitie" id="c_moitie"><option>journee</option><option>matin</option><option>apres-midi</option></select>'
                '<select name="activite" id="c_activite"><option>Mission</option><option>Congé payé</option><option>Absence (Jours fériés)</option></select>'
                '<button type="submit" id="c_ok">OK</button></form>'
                '<form method="post" action="/activite/valider"><input type="hidden" name="mois" value="%s"><button type="submit" id="valider">Valider ce compte rendu d’activité</button></form>'
                % (html.escape(m), html.escape(A['statut']), lignes, html.escape(m), html.escape(m))))
        if chemin == '/activite/signe':   # 0.97.0 : l'onglet du haut de la page du mois, où se dépose le CRA signé du client
            q = parse_qs(self.path.split('?', 1)[1]) if '?' in self.path else {}
            m = (q.get('mois') or ['2026-11'])[0][:7]
            docs = SIGNES.get(m, [])
            note(evenement='activite-signe', mois=m, deposes=len(docs))
            lignes = ''.join('<li class="document">%s (%d octets)</li>' % (html.escape(n), t) for n, t, _ in docs) or '<li id="aucun">Aucun document déposé</li>'
            return self.rendre(200, page('CRA signé du client (banc)',
                '<nav id="onglets"><a id="onglet-saisie" href="/activite?mois=%s">Saisie</a> · <b id="onglet-signe">CRA signé du client</b></nav>'
                '<p>Mois : <span id="mois-signe">%s</span></p><ul id="documents">%s</ul>'
                '<form method="post" action="/activite/signe/deposer?mois=%s" enctype="multipart/form-data" id="depot">'
                '<label>CRA signé (PDF) <input type="file" name="fichier" id="fichier_signe" accept="application/pdf"></label> '
                '<button type="submit" id="deposer">Déposer</button></form>'
                '<form method="post" action="/activite/valider"><input type="hidden" name="mois" value="%s"><button type="submit" id="valider">Valider ce compte rendu d’activité</button></form>'
                % (html.escape(m), html.escape(m), lignes, html.escape(m), html.escape(m))))
        if chemin == '/deconnexion':
            SESSIONS.pop(s, None)
            note(evenement='deconnexion')
            return self.vers('/connexion', [('Set-Cookie', 'session=; Path=/; Max-Age=0')])
        return self.rendre(404, page('Introuvable', ''))

    def do_POST(self):
        chemin = self.path.split('?')[0]
        if chemin == '/activite/signe/deposer':   # 0.97.0 : le dépôt du CRA signé (un formulaire « multipart » : le fichier entier, 2 Mo au plus ici)
            corps = self.rfile.read(min(int(self.headers.get('Content-Length') or 0), 2000000))
            if not self.session():
                return self.vers('/connexion')
            q = parse_qs(self.path.split('?', 1)[1]) if '?' in self.path else {}
            m = (q.get('mois') or [''])[0][:7]
            limite = re.search(r'boundary=("?)([^";]+)\1', self.headers.get('Content-Type') or '')
            nom, octets = '', b''
            for bloc in (corps.split(b'--' + limite.group(2).encode()) if limite else []):
                tete, _, reste = bloc.partition(b'\r\n\r\n')
                f = re.search(rb'name="fichier"; filename="([^"]*)"', tete)
                if f:
                    nom, octets = f.group(1).decode('utf-8', 'replace'), reste[:-2] if reste.endswith(b'\r\n') else reste
            if not octets:
                note(evenement='CRA-SIGNE-VIDE', mois=m); return self.vers('/activite/signe?mois=' + m)
            SIGNES.setdefault(m, []).append((nom, len(octets), hashlib.sha256(octets).hexdigest()))
            note(evenement='CRA-SIGNE-DEPOT', mois=m, nom=nom, taille=len(octets), empreinte=hashlib.sha256(octets).hexdigest(), pdf=octets[:5] == b'%PDF-')
            return self.vers('/activite/signe?mois=' + m)
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
        if chemin in ('/feuille/save', '/feuille/submit'):
            if not self.session():
                return self.vers('/connexion')
            d = champs.get('date', '')[:10]; f = FEUILLES.setdefault(d, {'qty': [''] * 5, 'etat': ''})
            if f['etat'] == 'Submitted':
                note(evenement='CRA-DEJA', date=d); return self.vers('/feuille?date=' + d)
            f['qty'] = [champs.get('QTY_DAY%d' % (k + 1), '') for k in range(5)]
            f['etat'] = 'Submitted' if chemin.endswith('submit') else 'Saved'
            note(evenement='CRA-SUBMIT' if chemin.endswith('submit') else 'CRA-SAVE', date=d, qty=f['qty'])
            return self.vers('/feuille?date=' + d)
        if chemin in ('/activite/case', '/activite/valider'):
            if not self.session():
                return self.vers('/connexion')
            m = champs.get('mois', '')[:7]; A = activite_du_mois(m)
            if A['statut'] != 'Saisie en cours':
                note(evenement='CRA-MOIS-DEJA', mois=m); return self.vers('/activite?mois=' + m)
            if chemin.endswith('valider'):
                A['statut'] = 'En attente'
                note(evenement='CRA-MOIS-VALIDER', mois=m, cases=A['cases']); return self.vers('/activite?mois=' + m)
            d, moitie, act = champs.get('date', '')[:10], champs.get('moitie', 'journee'), champs.get('activite', '')[:40]
            if d in A['cases']:
                for k in ([0, 1] if moitie == 'journee' else [0] if moitie == 'matin' else [1]): A['cases'][d][k] = act
            note(evenement='CRA-MOIS-CASE', mois=m, date=d, moitie=moitie, activite=act)
            return self.vers('/activite?mois=' + m)
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
