# Banc de la sonde d'espace client (portail_sonde.py) : faux site, données inventées. Connexion par formulaire et jeton, page d'abonnement avec un formulaire de date.
import http.server, urllib.parse
LOGIN = '<html><form action="/login" method="post" id="login_form"><input type="email" name="_email"><input type="password" name="_password"><input type="hidden" name="SubmitLogin" value="1"><input type="hidden" name="back" value="identity"><input type="hidden" name="_csrf_token" value="jeton-anti-rejeu-0123456789abcdefghij"><input type="hidden" name="_target_path" value=""></form>%s</html>'
ABO = '''<html><a href="/account/logout">Déconnexion</a><h2>Abonnement n°1 (#299315)</h2><p>Jean Exemple, 12 rue Inventée, jean.exemple@exemple.fr, 06 12 34 56 78</p>
<a href="/account/subscription/diaper/299315/edit">Modifier</a><a href="/account/subscription/diaper/299315/cancel">Résilier</a>
<form action="/account/subscription/diaper/299315/next-delivery" method="post" id="form_date"><label for="d">Prochaine expédition</label>
<input type="date" name="subscription[nextDeliveryDate]" id="d" value="2026-11-26" min="2026-11-25" max="2027-02-26"><input type="hidden" name="subscription[_token]" value="abcdefghijklmnopqrstuvwxyz0123456789">
<select name="subscription[size]"><option value="4" selected>Taille 4</option><option value="5">Taille 5</option></select><button type="submit" name="save" data-action="postpone">Enregistrer</button></form>
<script src="/build/abo.js"></script><script>var u="/account/subscription/diaper/299315/postpone";</script></html>'''
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def envoyer(self, code, corps, extra=()):
        b = corps.encode(); self.send_response(code); self.send_header("content-type", "text/html; charset=utf-8"); self.send_header("content-length", str(len(b)))
        for k, v in extra: self.send_header(k, v)
        self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        ok = "session=ok" in (self.headers.get("cookie") or "")
        if self.path == "/login": return self.envoyer(200, LOGIN % "")
        if self.path == "/build/abo.js": return self.envoyer(200, 'fetch("/api/subscription/"+id+"/next-delivery-date");x="/img/logo.png";')
        if not ok: return self.envoyer(302, "", (("location", "/login"),))
        if self.path.startswith("/account/subscription"): return self.envoyer(200, ABO)
        self.envoyer(200, '<html><a href="/account/logout">logout</a></html>')
    def do_POST(self):
        c = dict(urllib.parse.parse_qsl(self.rfile.read(int(self.headers.get("content-length") or 0)).decode()))
        if self.path == "/login" and c.get("_password") == "bon-mot-de-passe" and c.get("_csrf_token", "").startswith("jeton"):
            return self.envoyer(302, "", (("location", "/account/identity"), ("set-cookie", "session=ok; path=/")))
        self.envoyer(200, LOGIN % '<div class="alert alert-danger">Identifiants invalides.</div>')
http.server.ThreadingHTTPServer(("127.0.0.1", int(__import__("sys").argv[1]) if len(__import__("sys").argv) > 1 else 40090), H).serve_forever()
