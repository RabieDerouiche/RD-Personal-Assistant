"""JARVIS OS — sonde d'un espace client (scénario des couches, docs/hermes-deroule.md).

Se connecte à l'espace client du marchand avec les identifiants du propriétaire (fichier 0600, jamais affichés),
ouvre les pages de l'abonnement et n'en écrit que le SQUELETTE : formulaires, champs, boutons, liens, adresses
appelées par les scripts de la page. Sert à écrire ensuite le geste « changer la date de la prochaine livraison »
sans navigateur. Ne modifie rien chez le marchand : des lectures seulement (GET), après la connexion.

Rien de personnel ne sort : valeurs des champs masquées (sauf dates et petits nombres), adresses mail, téléphones,
longs numéros et jetons masqués ; ni cookie, ni mot de passe, ni jeton anti-rejeu dans la sortie.

  python3 -I portail_sonde.py --secrets <fichier.env> --sortie <fichier.txt> [--base https://…] [--pages a,b]
"""
import argparse
import html.parser
import http.cookiejar
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://mon-compte.lespetitsculottes.com"
PAGES = ["/account/subscription", "/account/subscription/diaper"]
AGENT = "Mozilla/5.0 (X11; Linux x86_64) JARVIS-OS/sonde (abonnement du titulaire du compte)"
MAX_PAGES, MAX_SCRIPTS, MAX_OCTETS = 8, 14, 3_000_000
DATE = re.compile(r"^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}([ T]\d{1,2}:\d{2}(:\d{2})?)?$")


def masquer(texte):
    """Texte montrable : ni adresse mail, ni téléphone, ni long numéro, ni jeton."""
    t = re.sub(r"\s+", " ", str(texte or "")).strip()
    t = re.sub(r"[\w.+-]+@[\w-]+\.[\w.-]+", "<mail>", t)
    t = re.sub(r"(?<!\d)(?:\+33|0)\d(?:[ .]?\d{2}){4}(?!\d)", "<tél>", t)
    t = re.sub(r"\b[A-Za-z0-9_-]{24,}\b", "<jeton>", t)
    t = re.sub(r"(?<![\d/.-])\d{5,}(?![\d/.-])", "<n>", t)
    return t[:90]


def valeur(v):
    """La valeur d'un champ : gardée si c'est une date, un petit nombre ou un mot court sans chiffre ; masquée sinon."""
    v = str(v or "").strip()
    if not v:
        return ""
    if DATE.match(v) or re.fullmatch(r"-?\d{1,4}", v) or re.fullmatch(r"[A-Za-zÀ-ÿ_-]{1,20}", v):
        return v
    return "<masqué, %d car.>" % len(v)


def chemin(u):
    """Une adresse sans ce qui identifie : numéros longs remplacés, paramètres réduits à leurs noms."""
    p = urllib.parse.urlsplit(u)
    q = "&".join(sorted({k for k, _ in urllib.parse.parse_qsl(p.query, keep_blank_values=True)}))
    c = re.sub(r"\d{3,}", "<id>", p.path)
    return (p.netloc + c if p.netloc else c) + ("?" + q if q else "")


class Squelette(html.parser.HTMLParser):
    """Ce qui sert à refaire un geste : formulaires et leurs champs, boutons, liens, titres, scripts."""
    TEXTE = {"h1", "h2", "h3", "h4", "label", "button", "a", "option", "th", "legend"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lignes, self.liens, self.scripts, self.inline = [], [], [], []
        self.pile, self.tampon, self.dans_script, self.cache = [], [], False, {}

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        donnees = " ".join("%s=%s" % (k, valeur(v)) for k, v in a.items() if k.startswith("data-"))
        if tag == "form":
            self.lignes.append("FORMULAIRE action=%s method=%s id=%s %s" % (chemin(a.get("action", "")), a.get("method", "get"), a.get("id", ""), donnees))
        elif tag in ("input", "select", "textarea"):
            cache = a.get("type") == "hidden"
            if cache and re.search(r"csrf|token", a.get("name", ""), re.I):
                self.lignes.append("  champ caché name=%s (jeton anti-rejeu, non montré)" % a.get("name", ""))
            else:
                self.lignes.append("  %s name=%s type=%s id=%s value=%s%s%s %s" % (
                    tag, a.get("name", ""), a.get("type", ""), a.get("id", ""), valeur(a.get("value", "")),
                    " min=%s max=%s" % (valeur(a.get("min")), valeur(a.get("max"))) if a.get("min") or a.get("max") else "",
                    " checked" if "checked" in a else "", donnees))
        elif tag == "script":
            self.dans_script = True
            if a.get("src"):
                self.scripts.append(a["src"])
        if tag in self.TEXTE:
            self.pile.append((tag, a, donnees))
            self.tampon.append([])
        if tag == "a" and a.get("href"):
            self.liens.append(a["href"])

    def handle_endtag(self, tag):
        if tag == "script":
            self.dans_script = False
        if tag == "form":
            self.lignes.append("FIN DU FORMULAIRE")
        if self.pile and self.pile[-1][0] == tag:
            _, a, donnees = self.pile.pop()
            texte = masquer(" ".join(self.tampon.pop()))
            if tag == "a":
                if texte or donnees:
                    self.lignes.append("  lien « %s » href=%s %s" % (texte, chemin(a.get("href", "")), donnees))
            elif tag == "option":
                self.lignes.append("    option value=%s « %s »%s" % (valeur(a.get("value", "")), texte, " selected" if "selected" in a else ""))
            elif tag == "button":
                self.lignes.append("  bouton « %s » name=%s type=%s value=%s id=%s %s" % (texte, a.get("name", ""), a.get("type", ""), valeur(a.get("value", "")), a.get("id", ""), donnees))
            elif texte:
                self.lignes.append("%s « %s »%s" % (tag.upper(), texte, " for=" + a["for"] if a.get("for") else ""))

    def handle_data(self, data):
        if self.dans_script:
            self.inline.append(data)
        elif self.tampon:
            self.tampon[-1].append(data)


def adresses_des_scripts(texte):
    """Les chemins appelés par un script qui parlent d'abonnement, de livraison ou de date."""
    trouve = set()
    for m in re.finditer(r"""["'`]((?:https?://[\w.-]+)?/[\w\-./{}$:]{3,120})["'`]""", texte):
        c = m.group(1)
        if re.search(r"subscri|abonn|deliver|livrais|shipping|date|postpone|report|decal|avanc|pause|next", c, re.I) and not re.search(r"\.(js|css|png|svg|jpg|woff2?)$", c):
            trouve.add(re.sub(r"\d{3,}", "<id>", c))
    return sorted(trouve)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--secrets", required=True)
    ap.add_argument("--sortie", required=True)
    ap.add_argument("--base", default=BASE)
    ap.add_argument("--pages", default=",".join(PAGES))
    o = ap.parse_args()
    secrets = dict(l.strip().split("=", 1) for l in open(o.secrets, encoding="utf-8") if "=" in l and not l.startswith("#"))
    mail, passe = secrets.get("LPC_EMAIL", ""), secrets.get("LPC_MOT_DE_PASSE", "")
    if not mail or not passe:
        print("Identifiants absents du fichier."); return 2
    base = o.base.rstrip("/")
    jarre = http.cookiejar.CookieJar()
    ouvreur = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jarre))
    ouvreur.addheaders = [("User-Agent", AGENT), ("Accept-Language", "fr-FR,fr;q=0.9")]

    def lire(adresse, donnees=None):
        try:
            with ouvreur.open(adresse, data=donnees, timeout=30) as r:
                return r.status, r.geturl(), r.read(MAX_OCTETS).decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, adresse, ""
        except (urllib.error.URLError, OSError) as e:
            return 0, adresse, str(e)[:80]

    sortie = ["Sonde de l'espace client (squelette seulement ; aucune donnée personnelle, aucun secret)", "base : " + urllib.parse.urlsplit(base).netloc, ""]
    code, _, page = lire(base + "/login")
    sq = Squelette(); sq.feed(page)
    champs = dict(re.findall(r'<input[^>]*type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"', page))
    champs.update({k: v for v, k in re.findall(r'<input[^>]*type="hidden"[^>]*value="([^"]*)"[^>]*name="([^"]+)"', page)})
    if code != 200 or "_csrf_token" not in champs:
        sortie.append("Page de connexion : code %s, jeton anti-rejeu %s. Arrêt." % (code, "absent" if "_csrf_token" not in champs else "présent"))
        open(o.sortie, "w", encoding="utf-8").write("\n".join(sortie) + "\n"); print(sortie[-1]); return 3
    corps = {"_email": mail, "_password": passe, "_csrf_token": champs["_csrf_token"], "SubmitLogin": champs.get("SubmitLogin", "1"),
             "back": champs.get("back", ""), "_target_path": champs.get("_target_path", "")}
    code, arrivee, page = lire(base + "/login", urllib.parse.urlencode(corps).encode())
    connecte = code == 200 and "/login" not in urllib.parse.urlsplit(arrivee).path and "logout" in page
    sortie.append("Connexion : %s (code %s, arrivée sur %s)" % ("réussie" if connecte else "REFUSÉE", code, chemin(arrivee)))
    if not connecte:
        indice = masquer(" ".join(re.findall(r'class="[^"]*(?:alert|error)[^"]*"[^>]*>([^<]{3,120})', page))[:160])
        sortie.append("Message du site : " + (indice or "aucun"))
        open(o.sortie, "w", encoding="utf-8").write("\n".join(sortie) + "\n"); print(sortie[-2]); return 4

    a_voir, vues, scripts = [base + p for p in o.pages.split(",") if p], [], []
    while a_voir and len(vues) < MAX_PAGES:
        adresse = a_voir.pop(0)
        if chemin(adresse) in vues:
            continue
        code, arrivee, page = lire(adresse)
        vues.append(chemin(adresse))
        sq = Squelette(); sq.feed(page)
        sortie += ["", "=== PAGE %s (code %s, arrivée %s, %d octets)" % (chemin(adresse), code, chemin(arrivee), len(page))] + sq.lignes
        dans = adresses_des_scripts("\n".join(sq.inline))
        if dans:
            sortie += ["  adresses citées dans les scripts de la page :"] + ["    " + x for x in dans]
        for s in sq.scripts:
            u = urllib.parse.urljoin(arrivee, s)
            if urllib.parse.urlsplit(u).netloc.endswith(urllib.parse.urlsplit(base).netloc.split(".", 1)[-1]) and u not in scripts:
                scripts.append(u)
        for l in sq.liens:      # les pages voisines de l'abonnement, sur le même site seulement
            u = urllib.parse.urljoin(arrivee, l)
            if u.startswith(base) and re.search(r"subscri|abonn", u, re.I) and not re.search(r"logout|delete|cancel|resili|unsubscribe|pause", u, re.I) and chemin(u) not in vues and u not in a_voir:
                a_voir.append(u)
    sortie += ["", "=== SCRIPTS du site (adresses qui parlent d'abonnement, de livraison ou de date)"]
    for u in scripts[:MAX_SCRIPTS]:
        code, _, texte = lire(u)
        dans = adresses_des_scripts(texte)
        if dans:
            sortie += ["  " + chemin(u) + " :"] + ["    " + x for x in dans[:40]]
    open(o.sortie, "w", encoding="utf-8").write("\n".join(sortie) + "\n")
    print("Connexion réussie ; %d page(s) lue(s), squelette écrit (%d lignes)." % (len(vues), len(sortie)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
