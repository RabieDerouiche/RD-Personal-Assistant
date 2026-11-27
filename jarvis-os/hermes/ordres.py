#!/usr/bin/env python3
"""JARVIS OS — administrer les routines d'Hermes depuis JARVIS (0.96.0, sa demande du 27/11/2026 ; docs/hermes.md).

« Les routines, on doit être capable de les relancer depuis JARVIS […] arrêter une routine jusqu'à nouvel ordre, la relancer, avoir
l'historique, et si jamais il y a une erreur voir l'erreur en détail », puis : changer son horaire. JARVIS n'exécute jamais rien
lui-même : il pose un petit fichier d'ordre, root le lit ici. Copie root : /usr/local/lib/hermes-relance/ordres.py (à côté de
limite.py, dont il reprend les règles) ; jamais un fichier du dépôt n'est exécuté par root.

  ordres.py traiter                 hermes-ordres.path : un ordre vient d'être posé dans /var/lib/jarvis-reveil/ordres
  ordres.py suivre                  hermes-relance.timer (toutes les 10 minutes, après la relance) : l'historique des passages, les
                                    pauses tenues, les passages lancés à la main suivis, puis le résumé pour JARVIS récrit
  ordres.py passage <nom> <id>      un passage lancé à la main (unité à part : il peut durer), suivi jusqu'à sa fin
  ordres.py nettoyer                lit une erreur sur l'entrée, rend son texte nettoyé (banc et diagnostic)

UN ORDRE = un fichier « ordre-<16 hexadécimaux>.json » de moins de 512 octets : {id, routine, action, at} ; action dans
lancer, pause, reprendre, horaire. Pour « horaire », en plus : {jours, heures} (forme fermée, jamais une expression cron) ou
{origine: true}. Règles (la sécurité d'abord) :
- le contenu n'est jamais une consigne : quatre valeurs relues par une liste blanche, rien d'autre ; une clé en trop = refusé ;
- jamais à travers un lien, fichier ordinaire, petit ; routine dans la liste fermée (copie root de routines.conf) ; ordre de
  moins de 10 minutes ; un identifiant ne sert qu'une fois ; le fichier est retiré AVANT d'agir (jamais deux exécutions) ;
- lancer = un passage dans le mode actuel (hermes cron run, comme routines.sh --lancer) : au plus 1 par routine toutes les
  5 minutes et 12 par jour en tout ; refusé si Hermes est arrêté (passerelle, garde du forfait), si la limite du forfait est connue
  comme atteinte (avec l'heure de reprise), si un passage de cette routine est en cours, si elle est en pause ;
- pause = la routine ne passe plus jusqu'à nouvel ordre : hermes cron pause, et son nom dans un fichier de root
  (/var/lib/hermes-relance/routines.pause) que routines.sh respecte : la pause survit à install.sh, à routines.sh et à un redémarrage ;
- horaire = root construit lui-même l'expression (heure de Paris, comme routines.conf) et la garde dans
  /var/lib/hermes-relance/routines.horaire, que routines.sh respecte ; 6 changements par jour au plus ;
- le résultat de chaque ordre (fait, refusé et pourquoi, à quelle heure) est écrit pour JARVIS dans le dossier du résumé.
L'HISTORIQUE : les 30 derniers passages de chaque routine (début, fin, durée, mode, résultat, cause, comment il a été lancé), tenus en
comparant jobs.json au passage précédent, complétés par le registre d'exécutions d'Hermes (lu en tant qu'utilisateur hermes).
L'ERREUR EN DÉTAIL : le texte de l'erreur d'un passage, NETTOYÉ (voir nettoyer_erreur) ; JARVIS ne le montre que dans la feuille
de la routine, sur un appareil relié.
Les variables HERMES_ORDRES_… ne servent qu'au banc (essais/hermes/ordres.test.sh) : les unités n'en posent aucune.
"""
import contextlib
import datetime
import fcntl
import importlib.util
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import time

ICI = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("limite", os.path.join(ICI, "limite.py"))   # python3 -I : le dossier du script n'est pas cherché
L = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(L)
E = os.environ.get

ORDRES = E("HERMES_ORDRES_DOSSIER", "/var/lib/jarvis-reveil/ordres")      # à jarvis : JARVIS y pose ses ordres
REVEIL_DERNIER = E("HERMES_REVEIL_DERNIER", "/run/hermes-reveil.dernier")  # l'heure du dernier réveil lancé par JARVIS (reveil.sh)
EXEC_DB = E("HERMES_ORDRES_EXEC_DB", "/home/hermes/.hermes/cron/executions.db")
ACTIONS = ("lancer", "pause", "reprendre", "horaire")
CLES = {"lancer": {"id", "routine", "action", "at"}, "pause": {"id", "routine", "action", "at"}, "reprendre": {"id", "routine", "action", "at"},
        "horaire": {"id", "routine", "action", "at", "jours", "heures", "origine"}}
R_FICHIER = re.compile(r"ordre-([a-f0-9]{16})\.json")
R_ID = re.compile(r"[a-f0-9]{16}")
TAILLE_MAX = 512
VIEUX, FUTUR = 600, 120            # un ordre de plus de 10 minutes, ou daté de plus de 2 minutes dans le futur : refusé
ECART_LANCER = 300                 # au plus un lancement par routine toutes les 5 minutes
LANCERS_JOUR = int(E("HERMES_ORDRES_LANCERS", "12") or 12)     # lancements par jour, toutes routines confondues
HORAIRES_JOUR = int(E("HERMES_ORDRES_HORAIRES", "6") or 6)     # changements d'horaire par jour
HEURES_MAX = 4                     # passages par jour d'une routine
HISTO_MAX, ORDRES_MAX = 30, 40
SANS_SUITE = 3600                  # un passage lancé à la main dont rien ne revient au bout d'une heure : « sans suite »
ATTENTE = int(E("HERMES_ORDRES_ATTENTE", "2700") or 0)   # « passage » : attend la fin du passage 45 minutes au plus
RAISONS = {
    "illisible": "ordre illisible", "routine": "routine inconnue", "action": "action inconnue", "vieux": "ordre trop vieux (plus de 10 minutes)",
    "rejoue": "ordre déjà traité", "pas-posee": "la routine n'est pas posée chez Hermes", "passerelle": "Hermes est arrêté",
    "garde": "le garde du forfait a arrêté Hermes", "limite": "la limite du forfait Claude est atteinte", "en-cours": "un passage de cette routine est déjà en cours",
    "pause": "la routine est en pause : la reprendre d'abord", "trop-tot": "déjà lancée il y a moins de 5 minutes", "plafond": "plafond du jour atteint",
    "hermes": "Hermes a refusé", "jours": "jours inconnus", "heures": "heures illisibles (une à quatre, HH:MM)", "pas": "minutes hors du pas de 5",
    "trop": "plus de quatre passages par jour", "forme": "ces heures ne tiennent pas dans un seul horaire (même minute, ou même heure)",
    "libre": "expression cron refusée : jours et heures seulement"}


# ---------------------------------------------------------------- l'erreur en détail : le nettoyage
# Ce que JARVIS montrera dans la feuille de la routine. Hermes masque déjà ce qu'il écrit dans jobs.json (redact_sensitive_text) ;
# ceci est la seconde couche, écrite pour ne rien supposer de la première. Dans l'ordre :
#  1. 4 000 caractères lus au plus ; caractères de contrôle retirés ; lignes vides retirées ;
#  2. un corps de mail cité (ligne « > … », en-tête De/From/Objet/Subject/Date/À/To, « a écrit : », « wrote: », « Original Message ») :
#     seule la première ligne du texte est gardée ; un « Objet : … » ou « Subject: … » en milieu de ligne coupe la ligne là ;
#  3. une URL est réduite à son hôte (identifiants, port, chemin et paramètres retirés) ;
#  4. une adresse mail devient « [adresse mail] » ;
#  5. jetons et clés : « Bearer … », « <mot>token|key|secret|password|jeton|cookie|session|signature|authorization = ou : valeur »,
#     préfixes connus (sk-, ghp_, github_pat_, xox?-, AKIA, AIza, ya29., eyJ….….…, jeton de bot « 123456:… ») ;
#  6. un chemin sous /home, /etc, /root, /var, /opt, /tmp, /usr, /run, /srv (ou « ~/ ») est réduit à son nom de fichier ;
#  7. un passage entre guillemets de plus de 60 caractères devient « […] » (un texte cité : sujet, message) ;
#  8. IBAN, identifiant universel (UUID), longue chaîne hexadécimale (24 et plus) ou base64 (32 et plus avec un chiffre, 40 et plus
#     sinon), suite de 9 chiffres et plus (téléphone, carte, compte) : masqués ;
#  9. une ligne d'origine = une ligne rendue, de 160 caractères au plus ; 8 lignes au plus ; 600 caractères en tout.
# Ce qui peut encore passer : un secret court sans mot-clé ni préfixe (un mot de passe de 10 lettres en clair), un nom de personne,
# un nom d'hôte seul, un montant, un court texte cité. D'où : feuille de la routine seulement, jamais une notification.
ERR_LIGNES, ERR_LARGEUR, ERR_TOTAL = 8, 160, 600
_MAIL_CITE = re.compile(r"(?im)^\s*(?:>|(?:from|de|to|à|cc|cci|bcc|subject|objet|sujet|date|envoy[ée]|sent|reply-to|répondre à)\s*:|-{2,}\s*(?:original message|message d.origine|forwarded message|message transf)"
                        r"|(?:le|on)\s.{4,80}\s(?:a écrit|wrote)\s*:)")
_OBJET = re.compile(r"(?i)\b(?:objet|subject|sujet)\b[^:\n]{0,20}:.*")
_URL = re.compile(r"\b[a-z][a-z0-9+.-]{1,15}://[^\s<>\"'`«»]+|\bwww\.[^\s<>\"'`«»]+", re.I)
_MAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+")
_PORTEUR = re.compile(r"(?i)\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{4,}")
_CLE = re.compile(r"(?i)\b([a-z0-9_-]*(?:token|key|secret|passw(?:or)?d|passwd|pwd|jeton|cookie|session(?:[_-]?id)?|signature|authorization))\s*[=:]\s*(?:\"[^\"]*\"|'[^']*'|[^\s,;&)]+)")
_PREFIXE = re.compile(r"\bsk-[A-Za-z0-9_-]{4,}|\b(?:gh[posu]|github_pat)_[A-Za-z0-9_]{10,}|\bxox[abprs]-[A-Za-z0-9-]{8,}|\bAKIA[A-Z0-9]{12,}|\bAIza[A-Za-z0-9_-]{20,}"
                      r"|\bya29\.[A-Za-z0-9._-]{10,}|\beyJ[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{4,}){1,2}|\b\d{6,12}:[A-Za-z0-9_-]{25,}")
_CHEMIN = re.compile(r"(?<![\w.-])(?:~|/(?:home|etc|root|var|opt|tmp|usr|run|srv|mnt|media))(?:/[^\s:\"'`,;()\[\]<>«»]+)+")
_CITE = re.compile(r"«[^»\n]{61,}»|“[^”\n]{61,}”|\"[^\"\n]{61,}\"|'[^'\n]{61,}'")
_IBAN = re.compile(r"\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b")
_UUID = re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")
_HEXA = re.compile(r"\b[0-9a-fA-F]{24,}\b")
_BASE64 = re.compile(r"(?<![A-Za-z0-9+/_=-])[A-Za-z0-9+/_=-]{32,}(?![A-Za-z0-9+/_=-])")
_CHIFFRES = re.compile(r"(?<!\d)\d(?:[ .]?\d){8,}(?!\d)")


def _hote(m):
    u = m.group(0)
    u = u.split("://", 1)[1] if "://" in u else u
    u = re.split(r"[/?#]", u, maxsplit=1)[0].rsplit("@", 1)[-1]
    h = u.rsplit(":", 1)[0] if re.search(r":\d{1,5}$", u) else u
    return h.lower() if re.fullmatch(r"[A-Za-z0-9.-]{1,80}", h) else "[adresse web]"


def _base64(m):
    s = m.group(0)
    return "[masqué]" if re.search(r"[A-Za-z]", s) and (re.search(r"\d", s) or len(s) >= 40) else s


def nettoyer_erreur(texte):
    """Le texte d'une erreur, nettoyé pour la feuille de la routine (règles ci-dessus). None s'il ne reste rien."""
    t = re.sub(r"[\x00-\x09\x0b-\x1f\x7f\u2028\u2029]", " ", str(texte or "")[:4000]).replace("\r", "\n")
    lignes = [l.strip() for l in t.split("\n") if l.strip()]
    if not lignes:
        return None
    if _MAIL_CITE.search("\n".join(lignes)):
        lignes = lignes[:1]          # un corps de mail cité : la première ligne seulement
        if _MAIL_CITE.match(lignes[0]):
            lignes = ["[contenu d'un mail retiré]"]
    rendu, total = [], 0
    for l in lignes[:ERR_LIGNES]:
        l = _OBJET.sub("[suite retirée : contenu d'un mail]", l)
        l = _URL.sub(_hote, l)
        l = _MAIL.sub("[adresse mail]", l)
        l = _PORTEUR.sub(lambda m: m.group(1) + " [masqué]", l)
        l = _CLE.sub(lambda m: m.group(1) + "=[masqué]", l)
        l = _PREFIXE.sub("[clé masquée]", l)
        l = _CHEMIN.sub(lambda m: m.group(0).rstrip("/").rsplit("/", 1)[-1] or "[chemin]", l)
        l = _CITE.sub("« […] »", l)
        l = _IBAN.sub("[IBAN]", l)
        l = _UUID.sub("[masqué]", l)
        l = _HEXA.sub("[masqué]", l)
        l = _BASE64.sub(_base64, l)
        l = _CHIFFRES.sub("[numéro]", l)
        l = re.sub(r"\s+", " ", l).strip()
        if len(l) > ERR_LARGEUR:
            l = l[:ERR_LARGEUR - 1] + "…"
        if total + len(l) + (1 if rendu else 0) > ERR_TOTAL:
            l = l[:max(0, ERR_TOTAL - total - (1 if rendu else 0) - 1)] + "…"
            if len(l) > 1:
                rendu.append(l)
            break
        if l:
            rendu.append(l)
            total += len(l) + (1 if len(rendu) > 1 else 0)
    return "\n".join(rendu) or None


def cmd_nettoyer(a):
    print(nettoyer_erreur(sys.stdin.read()) or "")


# ---------------------------------------------------------------- l'horaire : de la forme fermée à l'expression
def horaire_de(jours, heures):
    """(cron, None) à partir de la forme fermée d'un ordre, ou (None, raison). Jamais une expression fournie par JARVIS :
    jours = « tous », « ouvres » (du lundi au vendredi) ou une liste de codes (lun … dim) ; heures = une à quatre « HH:MM », minutes
    par pas de 5. Deux heures identiques n'en font qu'une. Un cron n'a qu'une liste de minutes et une liste d'heures : les passages
    doivent donc partager la même minute (9 h 15 et 13 h 15) ou tenir dans un produit (9 h 00 et 9 h 15 ; 9 h et 14 h, à 00 et à 30)."""
    if jours == "tous":
        j = "*"
    elif jours == "ouvres":
        j = "1-5"
    elif isinstance(jours, list) and 1 <= len(jours) <= 7 and all(isinstance(x, str) and x in L.CODES_JOURS for x in jours):
        j = ",".join(str(n) for n in sorted({L.CODES_JOURS.index(x) for x in jours}, key=lambda n: (n - 1) % 7))
        if len(j.split(",")) == 7:
            j = "*"
    else:
        return None, "jours"
    if not isinstance(heures, list) or not 1 <= len(heures) <= 12 or not all(isinstance(x, str) and re.fullmatch(r"\d{2}:\d{2}", x) for x in heures):
        return None, "heures"
    moments = sorted({(int(x[:2]), int(x[3:])) for x in heures})
    if any(h > 23 or mi > 59 for h, mi in moments):
        return None, "heures"
    if any(mi % 5 for h, mi in moments):
        return None, "pas"
    if len(moments) > HEURES_MAX:
        return None, "trop"
    hs, ms = sorted({h for h, mi in moments}), sorted({mi for h, mi in moments})
    if len(hs) * len(ms) != len(moments):
        return None, "forme"
    return "%s %s * * %s" % (",".join(map(str, ms)), ",".join(map(str, hs)), j), None


# ---------------------------------------------------------------- fichiers de root
@contextlib.contextmanager
def verrou():
    """Un seul à la fois : « traiter », « suivre » et « passage » lisent et récrivent les mêmes fichiers."""
    os.makedirs(L.ETAT, mode=0o700, exist_ok=True)
    fd = os.open(os.path.join(L.ETAT, "ordres.verrou"), os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        os.close(fd)


def etat_lire():
    e = L.lire_json(os.path.join(L.ETAT, "ordres.json"), {})
    e = e if isinstance(e, dict) else {}
    for k, v in (("vus", {}), ("lancers", []), ("horaires", []), ("encours", {})):
        if not isinstance(e.get(k), type(v)):
            e[k] = v
    return e


def etat_ecrire(e, t):
    e["vus"] = {k: v for k, v in e["vus"].items() if t - int(v or 0) < 86400}
    e["lancers"] = [x for x in e["lancers"] if isinstance(x, list) and len(x) == 2 and t - int(x[1]) < 2 * 86400][-200:]
    e["horaires"] = [x for x in e["horaires"] if isinstance(x, int) and t - x < 2 * 86400][-100:]
    L.ecrire_json(os.path.join(L.ETAT, "ordres.json"), e)


def public_dossier():
    """Le dossier du résumé (root et groupe de JARVIS, 750) ; jamais un lien."""
    g = L.groupe_jarvis()
    os.makedirs(L.RESUME, mode=0o750, exist_ok=True)
    if os.path.islink(L.RESUME):
        raise OSError("dossier du résumé : un lien")
    try:
        os.chown(L.RESUME, 0, g if g is not None else 0)
    except OSError:
        pass
    os.chmod(L.RESUME, 0o750)
    return g


def public_lire(nom, defaut):
    d = L.lire_json(os.path.join(L.RESUME, nom))
    return d if isinstance(d, dict) and d.get("v") == 1 else defaut


def public_ecrire(nom, obj):
    g = public_dossier()
    L.ecrire_json(os.path.join(L.RESUME, nom), obj, mode=0o640, groupe=g)


def resultat_ordre(o, t, etat, raison=None, **plus):
    """Le résultat d'un ordre, pour JARVIS (ordres.json du dossier du résumé) : codes et dates seulement, jamais un texte libre."""
    d = public_lire("ordres.json", {"v": 1, "ordres": []})
    liste = [x for x in d.get("ordres") or [] if isinstance(x, dict) and x.get("id") != o["id"]]
    x = {"id": o["id"], "routine": o.get("routine"), "action": o.get("action"), "at": o.get("at"), "traite": t, "etat": etat, "raison": raison,
         "reprise": None, "fin": None, "resultat": None, "cause": None}
    x.update(plus)
    liste.append(x)
    public_ecrire("ordres.json", {"v": 1, "at": t, "ordres": liste[-ORDRES_MAX:]})
    quoi = "%s %s" % (o.get("action") or "?", o.get("routine") or "?")
    print("Ordre %s (%s) : %s%s." % (o["id"], quoi, etat, " — " + RAISONS.get(raison, raison) if raison else ""))


def ecrire_lignes(chemin, lignes):
    """Un fichier de root d'une ligne par routine (pauses, horaires) : 600, d'un coup, jamais à travers un lien."""
    tmp = chemin + ".tmp"
    with contextlib.suppress(FileNotFoundError):
        os.unlink(tmp)
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write("".join(l + "\n" for l in lignes))
    os.chmod(tmp, 0o600)
    os.replace(tmp, chemin)


def pauses_ecrire(p):
    ecrire_lignes(L.ROUTINES_PAUSE, ["%s %d" % (n, int(v)) for n, v in sorted(p.items())])


def horaires_ecrire(h):
    ecrire_lignes(L.ROUTINES_HORAIRE, ["%s|%s" % (n, v) for n, v in sorted(h.items())])


# ---------------------------------------------------------------- Hermes
def hermes(*args, delai=90):
    """Une commande « hermes cron … » en tant qu'utilisateur hermes : (réussie, sortie)."""
    banc, gere = E("HERMES_ORDRES_HERMES"), E("HERMES_ORDRES_GERE")   # banc : un faux « hermes », ou le vrai avec la politique du banc
    hx = [("HERMES_MANAGED_DIR=" + gere) if gere and x.startswith("HERMES_MANAGED_DIR=") else x for x in L.HX]
    cmd = [banc, *args] if banc else hx + ["hermes", *args]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=delai, cwd="/" if banc else "/home/hermes")
        return p.returncode == 0, (p.stdout or "") + (p.stderr or "")
    except (OSError, subprocess.TimeoutExpired):
        return False, ""


def jobs_connus(connues):
    """nom → sa routine dans jobs.json (liste fermée seulement), ou None si jobs.json est illisible."""
    data = L.lire_json(L.JOBS)
    if not isinstance(data, dict) or not isinstance(data.get("jobs"), list):
        return None
    par = {}
    for j in data["jobs"]:
        nom = j.get("name") if isinstance(j, dict) else None
        if isinstance(nom, str) and nom.startswith("jarvis-") and nom[7:] in connues and isinstance(j.get("id"), str) and re.fullmatch(r"[A-Za-z0-9_-]{4,64}", j["id"]):
            par[nom[7:]] = j
    return par


def active(j):
    return j.get("enabled", True) is not False and j.get("state") not in ("paused", "completed") and not j.get("paused_at")


def expr_de(j):
    e = j["schedule"].get("expr") if isinstance(j.get("schedule"), dict) else None
    return " ".join(e.split()) if isinstance(e, str) and L.R_CRON.fullmatch(" ".join(e.split())) else None


def limite_connue(jobs, t):
    """(atteinte, reprise) : la limite du forfait est-elle CONNUE comme atteinte ? Sans lire l'usage (aucune sonde) : un passage de
    moins de 24 heures coupé par la limite dont l'heure de reprise n'est pas passée, ou une relance en attente de sa levée."""
    reprises = []
    for j in jobs.values():
        fin = L.iso_ep(j.get("last_run_at"))
        if j.get("last_status") == "error" and fin and t - fin < 86400 and L.est_limite(L.erreur_du_passage(j)):
            r = L.reprise_ou_defaut(L.erreur_du_passage(j), fin)
            if r > t:
                reprises.append(r)
    e = L.lire_json(os.path.join(L.AVIS, "etat.json"), {})
    if isinstance(e, dict) and isinstance(e.get("at"), int) and t - e["at"] < 1800:
        for x in e.get("attente") or []:
            if isinstance(x, dict) and isinstance(x.get("reprise"), int) and x["reprise"] > t:
                reprises.append(x["reprise"])
        if e.get("ouvert") is False and not reprises:
            return True, None
    return (True, max(reprises)) if reprises else (False, None)


def iso_de(ep):
    return datetime.datetime.fromtimestamp(int(ep), datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def jour_de(ep):
    return datetime.datetime.fromtimestamp(int(ep), L._zone("Europe/Paris")).strftime("%Y-%m-%d")


# ---------------------------------------------------------------- traiter les ordres posés par JARVIS
def ouvrir_dossier():
    """Le dossier des ordres, ouvert sans suivre de lien : il appartient à jarvis, qui pourrait le remplacer par un lien vers un
    autre dossier ; tout ce qui suit (lister, lire, retirer) se fait par rapport à ce descripteur, jamais par un chemin. None s'il
    est absent, si ce n'est pas un vrai dossier ou s'il n'appartient ni à jarvis ni à root."""
    try:
        fd = os.open(ORDRES, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    except OSError:
        return None
    try:
        import pwd
        permis = {0, pwd.getpwnam(E("HERMES_RELANCE_JARVIS_U", "jarvis")).pw_uid}
    except (KeyError, ImportError):
        permis = {0}
    if os.fstat(fd).st_uid not in permis:
        os.close(fd)
        return None
    return fd


def lire_ordre(nom, dossier):
    """Le contenu d'un fichier d'ordre, ou None : jamais à travers un lien, fichier ordinaire à un seul nom, petit, JSON objet."""
    try:
        fd = os.open(nom, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=dossier)
    except OSError:
        return None
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1 or st.st_size > TAILLE_MAX:
            return None
        d = json.loads(os.read(fd, TAILLE_MAX + 1).decode("utf-8"))
        return d if isinstance(d, dict) else None
    except (OSError, ValueError):
        return None
    finally:
        os.close(fd)


def retirer(nom, dossier):
    """Retire une entrée du dossier des ordres sans jamais suivre un lien (un dossier posé là est retiré avec ce qu'il contient)."""
    try:
        if stat.S_ISDIR(os.stat(nom, dir_fd=dossier, follow_symlinks=False).st_mode):
            shutil.rmtree(nom, ignore_errors=True, dir_fd=dossier)
        else:
            os.unlink(nom, dir_fd=dossier)
    except OSError:
        pass


def valider(d, ident, t, connues, vus):
    """(ordre, None) ou (ordre partiel, raison) : la liste blanche d'un ordre. Rien de ce qui n'est pas relu ici ne sert ensuite."""
    o = {"id": ident, "routine": None, "action": None, "at": None}
    if d is None or d.get("id") != ident:
        return o, "illisible"
    action = d.get("action")
    if not isinstance(action, str) or action not in ACTIONS:
        return o, "action"
    o["action"] = action
    if any(k in d for k in ("cron", "expr", "expression", "schedule")):
        return o, "libre"
    if not set(d) <= CLES[action]:
        return o, "illisible"
    routine = d.get("routine")
    if not isinstance(routine, str) or not L.R_NOM.fullmatch(routine) or routine not in connues:
        return o, "routine"
    o["routine"] = routine
    at = d.get("at")
    if isinstance(at, bool) or not isinstance(at, int) or not 1_500_000_000 <= at <= 4_200_000_000:
        return o, "illisible"
    o["at"] = at
    if at < t - VIEUX or at > t + FUTUR:
        return o, "vieux"
    if ident in vus:
        return o, "rejoue"
    if action == "horaire":
        if d.get("origine") is True:
            if "jours" in d or "heures" in d:
                return o, "illisible"
            o["cron"] = None
        elif "origine" in d:
            return o, "illisible"
        else:
            o["cron"], raison = horaire_de(d.get("jours"), d.get("heures"))
            if raison:
                return o, raison
    return o, None


def lancer_passage(o):
    """Le passage lancé à la main part dans une unité à part (il peut durer plusieurs minutes, et les ordres suivants n'attendent
    pas) : « ordres.py passage ». Au banc (pas de systemd) : sur place. False si l'unité existe déjà (un passage déjà en cours)."""
    faux = E("HERMES_ORDRES_SYSTEMD_RUN")
    if E("HERMES_ORDRES_SUR_PLACE") or (not faux and not os.path.isdir("/run/systemd/system")):
        cmd_passage_de(o["routine"], o["id"])    # dit lui-même son résultat
        return True
    cmd = [faux or "systemd-run", "--quiet", "--collect", "--unit=hermes-ordre-" + o["routine"], "--description=Passage lancé depuis JARVIS : " + o["routine"],
           "--property=Nice=10", "--property=CPUWeight=20", "--property=RuntimeMaxSec=3600", "--",
           "/usr/bin/python3", "-I", os.path.join(ICI, "ordres.py"), "passage", o["routine"], o["id"]]
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=30).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def executer(o, t, etat, connues):
    """Un ordre validé : agit, et rend (état, raison, compléments) pour JARVIS."""
    nom, action = o["routine"], o["action"]
    jobs = jobs_connus(connues)
    j = (jobs or {}).get(nom)
    if j is None:
        return "refusé", "pas-posee", {}
    pauses, jour = L.pauses_jarvis(), jour_de(t)
    if action == "pause":
        if nom not in pauses:
            pauses[nom] = t
            pauses_ecrire(pauses)
        if active(j) and not hermes("cron", "pause", j["id"])[0]:
            pauses.pop(nom, None)
            pauses_ecrire(pauses)
            return "refusé", "hermes", {}
        return "fait", None, {}
    if action == "reprendre":
        if nom in pauses:
            pauses.pop(nom)
            pauses_ecrire(pauses)
        if not active(j) and not hermes("cron", "resume", j["id"])[0]:
            return "refusé", "hermes", {}
        return "fait", None, {}
    if action == "horaire":
        if sum(1 for x in etat["horaires"] if jour_de(x) == jour) >= HORAIRES_JOUR:
            return "refusé", "plafond", {}
        horaires, origine = L.horaires_jarvis(), connues[nom]["origine"]
        voulu = o["cron"] or origine
        avant = dict(horaires)
        if voulu == origine:
            horaires.pop(nom, None)
        else:
            horaires[nom] = voulu
        horaires_ecrire(horaires)
        if expr_de(j) != voulu and not hermes("cron", "edit", j["id"], "--schedule", voulu)[0]:
            horaires_ecrire(avant)
            return "refusé", "hermes", {}
        etat["horaires"].append(t)
        return "fait", None, {}
    # lancer : un passage tout de suite, dans le mode actuel
    if os.path.exists(L.GARDE_ARRET):
        return "refusé", "garde", {}
    if L.sctl("is-active", L.SERVICE)[1] != "active":
        return "refusé", "passerelle", {}
    if nom in pauses or not active(j):
        return "refusé", "pause", {}
    ec = etat["encours"].get(nom)
    if L.en_cours(j, t) or (isinstance(ec, dict) and t - int(ec.get("at") or 0) < SANS_SUITE):
        return "refusé", "en-cours", {}
    atteinte, reprise = limite_connue(jobs, t)
    if atteinte:
        return "refusé", "limite", {"reprise": iso_de(reprise) if reprise else None}
    derniers = [int(x[1]) for x in etat["lancers"] if x[0] == nom]
    if derniers and t - max(derniers) < ECART_LANCER:
        return "refusé", "trop-tot", {"reprise": iso_de(max(derniers) + ECART_LANCER)}
    if sum(1 for x in etat["lancers"] if jour_de(x[1]) == jour) >= LANCERS_JOUR:
        return "refusé", "plafond", {}
    etat["lancers"].append([nom, t])
    etat["encours"][nom] = {"id": o["id"], "at": t}
    return "en cours", None, {}


def cmd_traiter(a):
    """hermes-ordres.path : tout ce qui est dans le dossier des ordres est lu puis retiré (le dossier finit toujours vide)."""
    t = L.maintenant()
    dossier = ouvrir_dossier()
    if dossier is None:
        print("Dossier des ordres absent, ou pas un vrai dossier de jarvis (un lien ?) : rien n'est lu.")
        return
    try:
        a_lancer, connues = traiter_dossier(dossier, t)
    finally:
        os.close(dossier)
    for o in a_lancer:
        if not lancer_passage(o):
            with verrou():
                etat = etat_lire()
                etat["encours"].pop(o["routine"], None)
                etat_ecrire(etat, t)
                resultat_ordre(o, t, "refusé", "en-cours")   # l'unité hermes-ordre-<routine> existe déjà : un passage lancé à la main tourne
                resume(connues, t)


def traiter_dossier(dossier, t):
    connues = L.routines_connues() or {}
    a_lancer = []
    with verrou():
        etat = etat_lire()
        for nom in sorted(os.listdir(dossier))[:50]:
            m = R_FICHIER.fullmatch(nom)
            if not m:
                retirer(nom, dossier)
                print("Entrée inattendue dans le dossier des ordres : retirée.")
                continue
            ident = m.group(1)
            o, raison = valider(lire_ordre(nom, dossier), ident, t, connues, etat["vus"])
            retirer(nom, dossier)                # retiré AVANT d'agir : un ordre n'est jamais exécuté deux fois
            if raison == "rejoue":
                print("Ordre %s : déjà traité, ignoré." % ident)   # le premier résultat reste celui que JARVIS lit
                continue
            etat["vus"][ident] = t
            etat_ecrire(etat, t)
            if raison:
                resultat_ordre(o, t, "refusé", raison)
                continue
            try:
                e, raison, plus = executer(o, t, etat, connues)
            except Exception as x:               # jamais un ordre resté sans réponse
                e, raison, plus = "refusé", "hermes", {}
                print("Ordre %s : erreur (%s)." % (ident, type(x).__name__))
            etat_ecrire(etat, t)
            resultat_ordre(o, t, e, raison, **plus)
            if e == "en cours":
                a_lancer.append(o)
        for nom in sorted(os.listdir(dossier)):  # au-delà de 50 d'un coup : le reste est retiré sans être lu
            retirer(nom, dossier)
        resume(connues, t)
    return a_lancer, connues


# ---------------------------------------------------------------- un passage lancé à la main, suivi jusqu'à sa fin
LANCE = re.compile(r"next scheduler tick|Ran now|Running in background", re.I)


def cmd_passage_de(nom, ident):
    connues = L.routines_connues() or {}
    if nom not in connues or not R_ID.fullmatch(ident):
        print("Passage refusé : routine ou ordre inconnu.")
        return False
    t0 = L.maintenant()
    o = {"id": ident, "routine": nom, "action": "lancer", "at": None}
    j = (jobs_connus(connues) or {}).get(nom)
    with verrou():
        ec = etat_lire()["encours"].get(nom)
        o["at"] = None if not isinstance(ec, dict) else ec.get("at")
    if j is None or not isinstance(ec, dict) or ec.get("id") != ident:
        print("Passage refusé : aucun ordre en cours pour cette routine.")
        return False
    # (certain, code d'Hermes v0.23.3, tools/cronjob_tools.py) « hermes cron run » : avec la passerelle en marche et un résultat envoyé
    # par elle (Telegram), le passage est confié à son prochain tic (« It will run on the next scheduler tick ») ; sinon il se fait
    # ici même, jusqu'au bout (« Ran now »). Un passage déjà pris par la passerelle est dit sans être relancé : pas un lancement.
    reussi, sortie = hermes("cron", "run", j["id"], delai=3300)
    if not reussi or not LANCE.search(sortie):
        with verrou():
            etat = etat_lire()
            etat["encours"].pop(nom, None)
            etat_ecrire(etat, t0)
            resultat_ordre(o, L.maintenant(), "refusé", "hermes")
            resume(connues, L.maintenant())
        return False
    print("%s : passage lancé depuis JARVIS (mode %s)." % (nom, connues[nom]["mode"]))
    limite = time.time() + ATTENTE
    while True:
        with verrou():
            fini = suivre(connues, L.maintenant())
        if nom in fini or time.time() >= limite:
            return True
        time.sleep(int(E("HERMES_ORDRES_PAS", "10") or 10))


def cmd_passage(a):
    sys.exit(0 if cmd_passage_de(a.nom, a.ordre) is not False else 1)


# ---------------------------------------------------------------- l'historique
LECTEUR = r"""
import json, sqlite3, sys
try:
    c = sqlite3.connect("file:" + sys.argv[1] + "?mode=ro", uri=True, timeout=3)
    print(json.dumps(c.execute("SELECT job_id, status, claimed_at, started_at, finished_at, scheduled_instant, substr(error, 1, 2000) "
                               "FROM executions WHERE finished_at IS NOT NULL ORDER BY claimed_at DESC LIMIT 400").fetchall()))
except Exception:
    print("[]")
"""


def executions():
    """Le registre d'exécutions d'Hermes (certain, code v0.23.3 : cron/executions.db, table executions), lu EN TANT QU'UTILISATEUR
    hermes (root n'ouvre jamais lui-même une base qui ne lui appartient pas) : job_id → passages finis. Illisible : rien, l'historique
    se contente alors de jobs.json (une fin par passage de la minuterie, sans durée)."""
    banc = E("HERMES_ORDRES_EXEC_CMD")
    if banc == "":
        return {}
    cmd = ["bash", "-c", banc] if banc else L.HX + ["/usr/bin/python3", "-I", "-c", LECTEUR, EXEC_DB]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=30, cwd="/" if banc else "/home/hermes")
        lignes = json.loads(p.stdout[:400_000])
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return {}
    par = {}
    for x in lignes if isinstance(lignes, list) else []:
        if not isinstance(x, list) or len(x) != 7 or not isinstance(x[0], str) or x[1] not in ("completed", "failed", "cancelled", "unknown"):
            continue
        fin, debut = L.iso_ep(x[4]) if isinstance(x[4], str) else None, L.iso_ep(x[3] or x[2]) if isinstance(x[3] or x[2], str) else None
        if fin is None:
            continue
        par.setdefault(x[0], []).append({"fin": fin, "debut": debut if debut and debut <= fin else None, "statut": x[1], "programme": bool(x[5]),
                                         "erreur": x[6] if isinstance(x[6], str) else ""})
    return par


def cause_de(texte):
    return "limite du forfait" if L.est_limite(texte) else "réseau" if L.RESEAU.search(texte or "") else "erreur"


def proche(passages, fin):
    for p in passages:
        if abs(L.iso_ep(p["fin"]) - fin) <= 30:   # la fin d'après jobs.json et celle du registre d'Hermes : le même passage
            return p
    return None


def suivre(connues, t):
    """L'historique mis à jour (jobs.json comparé au passage précédent, registre d'exécutions d'Hermes), les passages lancés à la
    main soldés, les pauses tenues ; puis le résumé pour JARVIS récrit. Rend les noms des routines dont le passage lancé à la main
    vient de finir. À appeler sous le verrou."""
    jobs = jobs_connus(connues)
    etat = etat_lire()
    histo = public_lire("historique.json", {"v": 1, "routines": {}})
    routines = histo.get("routines") if isinstance(histo.get("routines"), dict) else {}
    finis = set()
    if jobs is not None:
        ex = executions()
        relances = L.lire_json(os.path.join(L.ETAT, "etat.json"), {}) or {}
        apres_limite = [(x.get("nom"), int(x.get("at") or 0)) for x in relances.get("historique") or [] if isinstance(x, dict)]
        apres_limite += [(k.replace("jarvis-", "", 1), int((v or {}).get("at") or 0)) for k, v in (relances.get("suivis") or {}).items() if isinstance(v, dict)]
        try:
            reveil = int(L.lire_texte(REVEIL_DERNIER, 40).strip() or 0)
        except ValueError:
            reveil = 0
        for nom, j in jobs.items():
            passages = [p for p in routines.get(nom) or [] if isinstance(p, dict) and isinstance(p.get("fin"), str) and L.iso_ep(p["fin"])]
            nouveaux = []
            plancher = min(L.iso_ep(p["fin"]) for p in passages) if len(passages) >= HISTO_MAX else 0   # plus ancien que l'historique gardé : pas repris

            def ajouter(fin, debut, resultat, cause, erreur, programme):
                p = {"fin": iso_de(fin), "debut": iso_de(debut) if debut else None, "duree": max(0, fin - debut) if debut else None, "mode": connues[nom]["mode"],
                     "resultat": resultat, "cause": cause if resultat == "erreur" else None, "lance": "programme" if programme is not False else "main", "ordre": None,
                     "erreur": nettoyer_erreur(erreur) if resultat == "erreur" else None}
                passages.append(p)
                nouveaux.append(p)
                return p

            for x in sorted(ex.get(j["id"]) or [], key=lambda x: x["fin"])[-HISTO_MAX:]:
                p = proche(passages, x["fin"])
                if p is None and x["fin"] <= plancher:
                    continue
                if p is None:
                    ok = x["statut"] == "completed"
                    ajouter(x["fin"], x["debut"], "ok" if ok else "erreur", "arrêtée à la main" if x["statut"] == "cancelled" else cause_de(x["erreur"]), x["erreur"], x["programme"])
                elif p.get("debut") is None and x["debut"]:
                    p["debut"], p["duree"] = iso_de(x["debut"]), max(0, L.iso_ep(p["fin"]) - x["debut"])
                    if p.get("lance") == "programme" and not x["programme"]:
                        p["lance"] = "main"
            # le dernier passage d'après jobs.json : c'est lui qui fait foi (le même que dans le résumé)
            resultat, cause = L.resultat_de(j)
            fin = L.iso_ep(j.get("last_run_at")) if resultat != "jamais" else None
            if fin and 1_577_836_800 <= fin <= 4_102_444_800:
                p = proche(passages, fin)
                if p is None:
                    ajouter(fin, None, resultat, cause, L.erreur_du_passage(j), None)
                elif p in nouveaux or (p.get("resultat"), p.get("cause")) != (resultat, cause):
                    p.update(resultat=resultat, cause=cause if resultat == "erreur" else None, erreur=nettoyer_erreur(L.erreur_du_passage(j)) if resultat == "erreur" else None)
            # comment chaque nouveau passage a été lancé : depuis JARVIS, après la limite, par un réveil, programmé, ou à la main
            ec, pris = etat["encours"].get(nom), False
            for p in sorted(nouveaux, key=lambda p: p["fin"]):
                fin, debut = L.iso_ep(p["fin"]), L.iso_ep(p["debut"]) if p["debut"] else None
                if isinstance(ec, dict) and not pris and fin >= int(ec.get("at") or 0) - 5 and (debut is None or debut >= int(ec.get("at") or 0) - 30):
                    p["lance"], p["ordre"], pris = "jarvis", ec.get("id"), True
                elif any(n == nom and at and fin >= at - 5 and fin - at <= L.SUIVI_MAX and (debut is None or debut >= at - 30) for n, at in apres_limite):
                    p["lance"] = "limite"
                elif nom == "reveil" and reveil and (abs(debut - reveil) <= 60 if debut else 0 <= fin - reveil <= 900):
                    p["lance"] = "reveil"
            # l'ordre du passage lancé à la main est soldé une fois le résultat tranché : (certain, code d'Hermes et banc) juste après un
            # passage réussi, last_status vaut « delivery_queued » le temps que la passerelle envoie le résultat (3 minutes d'attente au plus)
            p = next((p for p in passages if isinstance(ec, dict) and p.get("ordre") == ec.get("id")), None)
            if p is not None and not (j.get("last_status") == "delivery_queued" and t - L.iso_ep(p["fin"]) < 180):
                resultat_ordre({"id": ec.get("id"), "routine": nom, "action": "lancer", "at": ec.get("at")}, t, "terminé", None, fin=p["fin"], resultat=p["resultat"], cause=p["cause"])
                etat["encours"].pop(nom, None)
                finis.add(nom)
            routines[nom] = sorted(passages, key=lambda p: p["fin"])[-HISTO_MAX:]
        # une routine mise en pause depuis JARVIS qui ne l'est plus chez Hermes (recréée, relancée à la main) : la pause est remise
        for nom in L.pauses_jarvis():
            j = jobs.get(nom)
            if j is not None and active(j) and not L.en_cours(j, t):
                print("%s : en pause depuis JARVIS mais active chez Hermes : pause remise%s." % (nom, "" if hermes("cron", "pause", j["id"])[0] else " (refusée par Hermes)"))
    # un passage lancé à la main dont rien ne revient
    for nom, ec in list(etat["encours"].items()):
        if not isinstance(ec, dict) or t - int(ec.get("at") or 0) > SANS_SUITE:
            etat["encours"].pop(nom, None)
            if isinstance(ec, dict) and R_ID.fullmatch(str(ec.get("id") or "")):
                resultat_ordre({"id": ec["id"], "routine": nom, "action": "lancer", "at": ec.get("at")}, t, "sans suite")
            finis.add(nom)
    etat_ecrire(etat, t)
    public_ecrire("historique.json", {"v": 1, "at": t, "routines": {n: routines[n] for n in connues if n in routines}})
    resume(connues, t)
    return finis


def resume(connues, t):
    """Le résumé pour JARVIS récrit tout de suite (pause, horaire, passage en cours visibles sans attendre la minuterie)."""
    try:
        L.ecrire_resume()
    except Exception as e:
        print("Résumé des routines pour JARVIS : pas écrit (%s)." % type(e).__name__)


def cmd_suivre(a):
    """hermes-relance.timer, après la relance : rattrape aussi un ordre que la surveillance du dossier aurait manqué."""
    cmd_traiter(a)
    with verrou():
        suivre(L.routines_connues() or {}, L.maintenant())


def main():
    import argparse
    p = argparse.ArgumentParser(description="Les ordres de JARVIS pour les routines d'Hermes (JARVIS OS)")
    s = p.add_subparsers(dest="cmd", required=True)
    s.add_parser("traiter")
    s.add_parser("suivre")
    s.add_parser("nettoyer")
    x = s.add_parser("passage"); x.add_argument("nom"); x.add_argument("ordre")
    a = p.parse_args()
    {"traiter": cmd_traiter, "suivre": cmd_suivre, "passage": cmd_passage, "nettoyer": cmd_nettoyer}[a.cmd](a)


if __name__ == "__main__":
    main()
