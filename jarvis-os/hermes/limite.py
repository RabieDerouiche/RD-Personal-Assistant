#!/usr/bin/env python3
"""JARVIS OS — la limite du forfait Claude, et la relance automatique de ce qu'elle a coupé (26/11/2026 ; docs/hermes.md).

Le 26/11/2026 au matin, la limite de 5 heures du forfait Claude partagé a coupé en même temps Hermes, JARVIS et les
sessions. Sa demande : « Fais en sorte que la relance soit automatique ». Ce fichier sert aux deux kits (copie root :
/usr/local/lib/hermes-relance/limite.py pour Hermes, /usr/local/lib/hermes-portail/limite.py pour le Hermes portail) ;
jamais un fichier du dépôt n'est exécuté par root.

  limite.py texte <fichier> [--quand EPOCH]       une erreur est-elle la limite du forfait ? quand reprend-il ? (JSON)
  limite.py relancer [--a-blanc]                  la minuterie (hermes-relance.timer, toutes les 10 minutes) : routines d'Hermes
                                                  et tâches d'hermes-portail coupées par la limite, relancées UNE fois après sa levée
  limite.py passage|verdict|attente|planifier …   les aides d'hermes-portail (voir plus bas)

À chaque passage de la minuterie (0.92.0), même sans rien à relancer et sans lire l'usage en plus, un résumé assaini du cron
d'Hermes est écrit pour JARVIS (/var/lib/hermes-relance-etat/routines.json, root et groupe de JARVIS, 750 et 640) : voir
« le résumé des routines » plus bas. Son écriture ne peut ni faire échouer ni retarder la relance.

Règles (sa demande, et la sécurité d'abord) :
- rien ne repart tant que la limite tient : une fenêtre du forfait à 100 %, ou l'heure de reprise annoncée pas encore passée ;
- une seule relance par échec (état root 600), un plafond par jour ; une erreur qui n'est pas la limite n'est jamais relancée ;
- la passerelle d'Hermes n'est redémarrée que si systemd la dit « failed », jamais si elle a été arrêtée exprès ou par le garde ;
- sur un portail, créer = soumettre : une tâche n'est relancée que si le relais filtrant prouve que le passage coupé n'a joint
  aucun hôte du portail (rien saisi, rien créé). Sans cette preuve, rien ne repart et JARVIS le dit (« à relancer à la main »).
Les variables HERMES_RELANCE_… ne servent qu'au banc (essais/hermes/relance.test.sh) : l'unité n'en pose aucune.
"""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys
import time

try:
    from zoneinfo import ZoneInfo
except ImportError:  # Python trop ancien : UTC seulement
    ZoneInfo = None

# ---------------------------------------------------------------- reconnaître la limite et son heure de reprise
LIMITE = re.compile(
    r"hit your [^\n]{0,40}?limit|usage limit|rate[ _-]?limit|limit reached|\b429\b|too many requests|out of (?:extra )?usage"
    r"|resets?\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|limite d.utilisation", re.I)
MOIS = {m: i + 1 for i, m in enumerate(("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"))}
REPRISE = re.compile(
    r"resets?\s+(?:at\s+)?(?:(?P<mon>jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?P<day>\d{1,2})(?:st|nd|rd|th)?,?\s*(?:at\s+)?)?"
    r"(?P<h>\d{1,2})(?::(?P<mi>\d{2}))?\s*(?P<ap>am|pm)?(?:\s*\((?P<tz>[A-Za-z][A-Za-z0-9_+/-]{0,40})\))?", re.I)
EPOQUE = re.compile(r"limit reached\|(\d{10})\b", re.I)
ATTENDRE = re.compile(r"retry[- ]after[:\s]+(\d{1,6})\s*s", re.I)
SANS_HEURE = 1800          # pas d'heure dans le message : on réessaie 30 minutes après l'échec
LE_PLUS_LOIN = 8 * 86400   # une semaine et un jour : la limite de la semaine ; au-delà, l'heure lue est fausse


def est_limite(texte):
    return bool(LIMITE.search(str(texte or "")))


def _zone(nom):
    if not nom or ZoneInfo is None:
        return datetime.timezone.utc
    try:
        return ZoneInfo(nom)
    except Exception:
        return datetime.timezone.utc


def reprise(texte, quand):
    """L'heure (époque, secondes) où la limite annoncée dans *texte* se lève ; *quand* = l'heure de l'échec. None si rien de sûr."""
    t = str(texte or "")
    m = EPOQUE.search(t)
    if m:
        r = int(m.group(1))
        return r if quand - 60 <= r <= quand + LE_PLUS_LOIN else None
    m = ATTENDRE.search(t)
    if m:
        return int(quand + int(m.group(1)))
    for m in REPRISE.finditer(t):
        h, mi, ap = int(m.group("h")), int(m.group("mi") or 0), (m.group("ap") or "").lower()
        if ap:
            if not 1 <= h <= 12:
                continue
            h = h % 12 + (12 if ap == "pm" else 0)
        if h > 23 or mi > 59:
            continue
        z = _zone(m.group("tz"))
        base = datetime.datetime.fromtimestamp(quand, z)
        if m.group("mon"):
            try:
                c = base.replace(month=MOIS[m.group("mon")[:3].lower()], day=int(m.group("day")), hour=h, minute=mi, second=0, microsecond=0)
            except ValueError:
                continue
            if c.timestamp() < quand - 86400:
                try:
                    c = c.replace(year=c.year + 1)
                except ValueError:
                    continue
        else:
            c = base.replace(hour=h, minute=mi, second=0, microsecond=0)
            if c.timestamp() <= quand - 60:
                c = c + datetime.timedelta(days=1)
        r = int(c.timestamp())
        if quand - 60 <= r <= quand + LE_PLUS_LOIN:
            return r
    return None


def reprise_ou_defaut(texte, quand):
    return reprise(texte, quand) or int(quand + SANS_HEURE)


def heure_paris(ep):
    z = _zone("Europe/Paris")
    d = datetime.datetime.fromtimestamp(ep, z)
    return d.strftime("%d/%m à %H:%M")


def ecrire_json(chemin, obj, mode=0o600, groupe=None):
    """Écriture sûre : jamais à travers un lien, fichier temporaire puis remplacement."""
    tmp = chemin + ".tmp"
    try:
        os.unlink(tmp)
    except FileNotFoundError:
        pass
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)
    if groupe is not None:
        try:
            os.chown(tmp, 0, groupe)
        except OSError:
            pass
    os.chmod(tmp, mode)
    os.replace(tmp, chemin)


def lire_json(chemin, defaut=None):
    try:
        fd = os.open(chemin, os.O_RDONLY | os.O_NOFOLLOW)
    except OSError:
        return defaut
    try:
        st = os.fstat(fd)
        if (st.st_mode & 0o170000) != 0o100000 or st.st_size > 2_000_000:
            return defaut
        with os.fdopen(fd, encoding="utf-8") as f:
            fd = None
            return json.load(f)
    except (OSError, ValueError):
        return defaut
    finally:
        if fd is not None:
            os.close(fd)


def lire_texte(chemin, n=400_000):
    try:
        fd = os.open(chemin, os.O_RDONLY | os.O_NOFOLLOW)
    except OSError:
        return ""
    with os.fdopen(fd, "rb") as f:
        return f.read(n).decode("utf-8", "replace")


def cmd_texte(a):
    t = lire_texte(a.fichier)
    q = int(a.quand or time.time())
    lim = est_limite(t)
    print(json.dumps({"limite": lim, "reprise": reprise(t, q) if lim else None}))


# ---------------------------------------------------------------- hermes-portail : la preuve qu'un passage coupé n'a rien touché
def hotes_claude(chemin):
    """Les hôtes de Claude (domaines.defaut du kit) : tout autre hôte joint pendant un passage est un hôte du portail."""
    hs = set()
    for ligne in lire_texte(chemin).splitlines():
        ligne = ligne.split("#", 1)[0].strip().lower()
        if ligne:
            hs.add(ligne.lstrip("."))
    return hs


def touche(journal, claude):
    """True : un hôte autre que ceux de Claude a été joint ; False : aucun ; None : journal du relais illisible (pas de preuve)."""
    if journal is None:
        return None
    t = lire_texte(journal)
    if t.startswith("ERREUR"):
        return None
    for ligne in t.splitlines():
        mots = ligne.split()
        if "permis" in mots:
            i = mots.index("permis")
            if i + 1 < len(mots):
                h = mots[i + 1].strip().lower().rstrip(".")
                if h and not any(h == c or h.endswith("." + c) for c in claude):
                    return True
    return False


def cmd_passage(a):
    """Après chaque passage du Hermes portail : la limite l'a-t-elle coupé, et le portail a-t-il été joint ? (derniere.json, root 600)"""
    t = lire_texte(a.sortie)
    fin = int(a.fin)
    lim = est_limite(t)
    os.makedirs(os.path.dirname(a.vers), mode=0o700, exist_ok=True)
    d = {"at": fin, "debut": int(a.debut), "code": int(a.code), "limite": lim}
    if lim:
        d["reprise"] = reprise_ou_defaut(t, fin)
        d["touche"] = touche(a.journal, hotes_claude(a.claude))
    ecrire_json(a.vers, d)
    if lim:
        print("Limite du forfait Claude pendant ce passage : reprise vers le %s (heure de Paris) ; portail %s."
              % (heure_paris(d["reprise"]), {True: "joint avant la coupure", False: "jamais joint", None: "peut-être joint (relais illisible)"}[d["touche"]]))


def cmd_verdict(a):
    """avant : coupé par la limite avant d'avoir joint le portail ; apres : coupé après (ou sans preuve) ; non : pas la limite."""
    d = lire_json(a.fichier) or {}
    if not d.get("limite") or int(d.get("at") or 0) < int(a.debut):
        print("non")
    else:
        print("avant" if d.get("touche") is False else "apres")


def cmd_attente(a):
    """0 (et l'heure de Paris) tant que la limite annoncée tient : les minuteries d'hermes-portail ne tentent rien."""
    d = lire_json(os.path.join(a.dossier, "attente.json")) or {}
    r = int(d.get("reprise") or 0)
    if r > int(a.maintenant or time.time()):
        print(heure_paris(r))
        sys.exit(0)
    sys.exit(1)


UNITES = {"hermes-portail-cra.service", "hermes-portail-cra-mois.service", "hermes-portail-ndf.service", "hermes-portail-teletravail.service"}


def cmd_planifier(a):
    """Une tâche coupée avant tout contact avec le portail : UNE relance, après la reprise. 0 = prévue ; 3 = déjà relancée une fois."""
    if a.unite not in UNITES or not re.fullmatch(r"[a-z-]{2,20}", a.tache) or not re.fullmatch(r"[A-Za-z0-9 :._-]{1,120}", a.cle):
        print("Relance refusée : tâche ou unité inconnue.")
        sys.exit(2)
    os.makedirs(a.dossier, mode=0o700, exist_ok=True)
    reg = os.path.join(a.dossier, "relancees.txt")
    deja = set(l.strip() for l in lire_texte(reg).splitlines())
    ligne = a.tache + " " + a.cle
    if ligne in deja:
        sys.exit(3)
    d = lire_json(a.depuis) or {}
    r = int(d.get("reprise") or time.time() + SANS_HEURE)
    fd = os.open(reg, os.O_WRONLY | os.O_CREAT | os.O_APPEND | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "a", encoding="utf-8") as f:
        f.write(ligne + "\n")
    avant = int((lire_json(os.path.join(a.dossier, "attente.json")) or {}).get("reprise") or 0)
    ecrire_json(os.path.join(a.dossier, "attente.json"), {"reprise": max(r, avant) if avant > time.time() else r})
    slug = re.sub(r"[^a-z0-9-]", "-", a.tache)
    ecrire_json(os.path.join(a.dossier, "relance-%s.json" % slug), {"unite": a.unite, "tache": a.tache, "cle": a.cle, "reprise": r, "at": int(time.time())})
    print("Coupé par la limite du forfait Claude avant tout contact avec le portail : relancé automatiquement après le %s (heure de Paris)." % heure_paris(r))


# ---------------------------------------------------------------- la relance (hermes-relance.timer)
E = os.environ.get
JOBS = E("HERMES_RELANCE_JOBS", "/home/hermes/.hermes/cron/jobs.json")
ETAT = E("HERMES_RELANCE_ETAT", "/var/lib/hermes-relance")
AVIS = E("HERMES_RELANCE_AVIS", "/var/lib/hermes-relance-avis")
PORTAIL = E("HERMES_RELANCE_PORTAIL", "/var/lib/hermes-portail/limite")
GARDE_ARRET = E("HERMES_GARDE_ETAT", "/var/lib/hermes-garde/arret")
GARDE_COUPE = E("HERMES_RELANCE_GARDE_COUPE", "/etc/hermes/garde.coupe")   # garde coupé à sa demande (26/11 au 3/12/2026)


def coupe_active(jour):
    """Garde coupé à sa demande : le fichier existe et, s'il porte une date de fin (AAAA-MM-JJ), elle n'est pas passée
    (même règle que garde-forfait.sh et diagnostic.sh : une date passée vaut « pas de coupure »)."""
    try:
        with open(GARDE_COUPE, encoding="utf-8", errors="replace") as f:
            m = re.search(r"\d{4}-\d{2}-\d{2}", f.read(200))
    except OSError:
        return False
    return not m or jour <= m.group(0)
POLITIQUE = E("HERMES_GARDE_POLITIQUE", "/etc/hermes/config.yaml")
PLAFOND = int(E("HERMES_RELANCE_PLAFOND", "12") or 12)            # relances par jour, routines et tâches confondues
PASSERELLE_MAX = 2                                               # redémarrages de la passerelle par jour
SERVICE = "hermes-gateway.service"
SUIVI_MAX = 3 * 3600                                             # une relance sans passage au bout de 3 heures : il est prévenu
FAMILLES = ("opus", "sonnet", "haiku", "fable", "mythos")
HX = ["runuser", "-u", "hermes", "--", "env", "-i", "HOME=/home/hermes", "USER=hermes", "LOGNAME=hermes", "LANG=C.UTF-8",
      "PATH=/home/hermes/.local/bin:/usr/bin:/bin", "HERMES_HOME=/home/hermes/.hermes", "HERMES_MANAGED_DIR=/etc/hermes"]


def maintenant():
    v = E("HERMES_RELANCE_MAINTENANT")
    return int(v) if v and v.isdigit() else int(time.time())


def iso_ep(v):
    if not v:
        return None
    try:
        d = datetime.datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=datetime.timezone.utc)
    return int(d.timestamp())


def sctl(*args):
    cmd = [E("HERMES_RELANCE_SYSTEMCTL") or "systemctl", *args]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return p.returncode, (p.stdout or "").strip()
    except (OSError, subprocess.TimeoutExpired):
        return 1, ""


def lancer_routine(ident):
    banc = E("HERMES_RELANCE_LANCER")
    cmd = [banc, ident] if banc else HX + ["hermes", "cron", "run", ident]
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=120, cwd="/" if banc else "/home/hermes").returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def lire_usage():
    """(ouvert, détail) : ouvert True si aucune fenêtre du forfait (celle de 5 heures comprise) n'est à 100 % ; None si illisible."""
    banc = E("HERMES_RELANCE_USAGE_CMD")
    cmd = ["bash", "-c", banc] if banc else HX + [
        "CLAUDE_SUBSCRIPTION_DIRECTSDK_COMMAND=/home/hermes/.local/lib/claude-code/node_modules/.bin/claude", "DISABLE_AUTOUPDATER=1",
        "hermes", "usage", "--json"]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=90, cwd="/" if banc else "/home/hermes")
        d = json.loads(p.stdout)
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return None, "usage du forfait illisible"
    modele = "opus"
    m = re.search(r'^  default: "([a-z]*)"', lire_texte(POLITIQUE), re.M)
    if m:
        modele = m.group(1) or "opus"
    pleines, vues = [], 0
    for w in (d.get("windows") if isinstance(d, dict) else None) or []:
        if not isinstance(w, dict) or isinstance(w.get("used_percent"), bool) or not isinstance(w.get("used_percent"), (int, float)):
            continue
        nom = str(w.get("label") or "forfait").lower()
        if any(f in nom for f in FAMILLES) and modele not in nom:
            continue   # la semaine d'un autre modèle (Sonnet, pour la voix de JARVIS) n'arrête pas Hermes
        vues += 1
        if w["used_percent"] >= 100:
            pleines.append("%s à %d %% (remise %s)" % (nom, w["used_percent"], w.get("resets_at") or "?"))
    if not vues:
        return None, "usage du forfait sans fenêtre chiffrée"
    return (False, "limite toujours atteinte : " + "; ".join(pleines)) if pleines else (True, "forfait sous la limite")


def groupe_jarvis():
    try:
        import pwd
        return pwd.getpwnam(E("HERMES_RELANCE_JARVIS_U", "jarvis")).pw_gid
    except (KeyError, ImportError):
        return None


def aviser(cle, titre, texte, a_blanc, sortie):
    """Une notification pour JARVIS (dossier de root, lisible par son groupe) : il la pousse une fois sur ses appareils."""
    sortie.append("AVIS : " + titre + " — " + texte)
    if a_blanc:
        return
    g = groupe_jarvis()
    os.makedirs(AVIS, mode=0o750, exist_ok=True)
    try:
        os.chown(AVIS, 0, g if g is not None else 0)
        os.chmod(AVIS, 0o750)
    except OSError:
        pass
    slug = re.sub(r"[^a-z0-9-]", "-", cle.lower())[:60]
    ecrire_json(os.path.join(AVIS, "avis-%d-%s.json" % (maintenant(), slug)), {"cle": cle[:120], "titre": titre[:120], "texte": texte[:600], "at": maintenant()},
                mode=0o640, groupe=g)


def cmd_aviser(a):
    """Un avis pour JARVIS posé par une tâche d'hermes-portail (le CRA du mois, 26/11/2026) : poussé une fois sur ses appareils."""
    if not re.fullmatch(r"[A-Za-z0-9 :._-]{1,120}", a.cle):
        print("Avis refusé : clé illisible.")
        sys.exit(2)
    titre = re.sub(r"\s+", " ", a.titre).strip()[:120]
    texte = re.sub(r"\s+", " ", a.texte).strip()[:600]
    if not titre:
        sys.exit(2)
    dit = []
    aviser(a.cle, titre, texte, False, dit)
    print("\n".join(dit))


def menage_avis():
    lim = maintenant() - 14 * 86400
    try:
        noms = os.listdir(AVIS)
    except OSError:
        return
    for n in noms:
        if n.startswith("avis-") and n.endswith(".json"):
            p = os.path.join(AVIS, n)
            try:
                if os.lstat(p).st_mtime < lim:
                    os.unlink(p)
            except OSError:
                pass


def erreur_du_passage(j):
    """Le texte de l'erreur du dernier passage : last_error, ou l'empreinte durable last_failure si elle date de ce passage."""
    err = j.get("last_error") or ""
    lf = j.get("last_failure")
    if isinstance(lf, dict) and lf.get("at") and lf.get("at") == j.get("last_run_at"):
        err = (err + " " + str(lf.get("detail") or "")).strip()
    return str(err)[:2000]


def cmd_relancer(a):
    """La minuterie : voir le haut du fichier. Avec --a-blanc : dit ce qu'elle ferait, ne touche à rien (ni état, ni service, ni avis)."""
    blanc = a.a_blanc
    t = maintenant()
    jour = datetime.datetime.fromtimestamp(t, _zone("Europe/Paris")).strftime("%Y-%m-%d")
    os.makedirs(ETAT, mode=0o700, exist_ok=True)
    etat = lire_json(os.path.join(ETAT, "etat.json"), {}) or {}
    faites = etat.setdefault("faites", {})
    suivis = etat.setdefault("suivis", {})
    compte = etat.setdefault("jour", {})
    passerelle = etat.setdefault("passerelle", {})
    histo = etat.setdefault("historique", [])
    dire, attente = [], []
    # les jours passés ne comptent plus ; les échecs déjà traités sont oubliés au bout de 3 jours
    for k in [k for k in compte if k != jour]:
        compte.pop(k)
    for k in [k for k in passerelle if k != jour]:
        passerelle.pop(k)
    for k in [k for k, v in faites.items() if t - int(v or 0) > 3 * 86400]:
        faites.pop(k)

    data = lire_json(JOBS, {}) or {}
    jobs = [j for j in (data.get("jobs") or []) if isinstance(j, dict)] if isinstance(data, dict) else []
    par_nom = {str(j.get("name") or ""): j for j in jobs}

    # 1. ce que sont devenues les relances déjà faites (le passage relancé a-t-il abouti ?)
    for nom, s in list(suivis.items()):
        j = par_nom.get(nom)
        fin = iso_ep(j.get("last_run_at")) if j else None
        if j and fin and fin >= int(s.get("at") or 0) - 5:
            court = nom.replace("jarvis-", "", 1)
            if j.get("last_status") in ("ok", "delivery_failed"):
                dire.append("%s : le passage relancé a abouti." % court)
                histo.append({"nom": court, "at": int(s.get("at") or t), "resultat": "réussie"})
            else:
                faites[nom + "|" + str(j.get("last_run_at"))] = t   # cet échec-là n'est pas relancé une seconde fois
                aviser("routine-" + court, "Hermes : « %s » en échec après la relance" % court,
                       "Coupée par la limite du forfait Claude, relancée le %s, de nouveau en échec (%s). Relance-la à la main si elle est "
                       "toujours utile (session Serveur JARVIS : routines.sh --lancer %s)." % (heure_paris(int(s.get("at") or t)), erreur_du_passage(j)[:160] or "sans message", court), blanc, dire)
                histo.append({"nom": court, "at": int(s.get("at") or t), "resultat": "échec"})
            suivis.pop(nom)
        elif t - int(s.get("at") or t) > SUIVI_MAX:
            court = nom.replace("jarvis-", "", 1)
            aviser("routine-" + court, "Hermes : « %s » relancée sans passage" % court,
                   "Relancée le %s après la limite du forfait Claude, sans aucun passage depuis 3 heures. Regarde l'état d'Hermes "
                   "(diagnostic.sh) avant de la relancer à la main." % heure_paris(int(s.get("at") or t)), blanc, dire)
            suivis.pop(nom)

    # 2. les routines jarvis-… coupées par la limite (dernier passage de moins de 24 heures)
    candidats = []
    for j in jobs:
        nom = str(j.get("name") or "")
        if not nom.startswith("jarvis-") or j.get("enabled") is False or j.get("state") == "paused" or j.get("last_status") != "error":
            continue
        fin = iso_ep(j.get("last_run_at"))
        if not fin or t - fin > 86400:
            continue
        err, cle, court = erreur_du_passage(j), nom + "|" + str(j.get("last_run_at")), nom.replace("jarvis-", "", 1)
        if cle in faites or nom in suivis:
            continue
        if not est_limite(err):
            continue   # une erreur qui n'est pas la limite n'est jamais relancée
        if iso_ep(j.get("quota_hold_until")) or (isinstance(j.get("unreachable_retry"), dict) and j["unreachable_retry"].get("at")):
            faites[cle] = t
            dire.append("%s : Hermes la reprend lui-même (attente de fenêtre ou réessai prévu) : rien à faire." % court)
            continue
        rep = reprise_ou_defaut(err, fin)
        nxt = iso_ep(j.get("next_run_at"))
        if nxt and nxt >= rep and nxt - max(t, rep) < 3600:
            faites[cle] = t
            dire.append("%s : son prochain passage (%s) est dans moins d'une heure après la reprise : pas de relance en plus." % (court, heure_paris(nxt)))
            continue
        candidats.append({"genre": "routine", "nom": court, "id": str(j.get("id") or ""), "cle": cle, "reprise": rep})

    # 3. les tâches d'hermes-portail coupées avant tout contact avec le portail (posées par hermes-portail lui-même)
    try:
        noms = sorted(os.listdir(PORTAIL))
    except OSError:
        noms = []
    for n in noms:
        if not re.fullmatch(r"relance-[a-z0-9-]{1,40}\.json", n):
            continue
        p = os.path.join(PORTAIL, n)
        d = lire_json(p)
        if not isinstance(d, dict) or d.get("unite") not in UNITES:
            dire.append("%s : demande de relance illisible ou unité inconnue : ignorée." % n)
            continue
        candidats.append({"genre": "portail", "nom": str(d.get("tache"))[:20], "unite": d["unite"], "fichier": p,
                          "cle": "portail|%s|%s" % (d.get("tache"), d.get("cle")), "reprise": int(d.get("reprise") or t)})

    # 4. la passerelle d'Hermes plantée (systemd la dit « failed ») : redémarrée, jamais si le garde l'a arrêtée
    rc, sortie = sctl("is-failed", SERVICE)
    if sortie == "failed":
        if os.path.exists(GARDE_ARRET):
            dire.append("Passerelle d'Hermes en échec, mais arrêtée par le garde du forfait : c'est lui qui la relance.")
        elif coupe_active(jour):
            aviser("passerelle", "Hermes : passerelle plantée",
                   "systemd la dit « failed ». Pendant la coupure du garde du forfait, je ne la redémarre pas seul : "
                   "session Serveur JARVIS, diagnostic.sh, puis systemctl restart hermes-gateway.", blanc, dire) if etat.get("passerelle_dit") != jour else None
            if not blanc:
                etat["passerelle_dit"] = jour
        elif int(passerelle.get(jour, 0)) >= PASSERELLE_MAX:
            dire.append("Passerelle d'Hermes en échec : déjà redémarrée %d fois aujourd'hui, je n'insiste pas." % PASSERELLE_MAX)
        elif blanc:
            dire.append("À blanc : je redémarrerais la passerelle d'Hermes (systemd la dit « failed »).")
        else:
            passerelle[jour] = int(passerelle.get(jour, 0)) + 1
            if sctl("restart", SERVICE)[0] == 0:
                dire.append("Passerelle d'Hermes plantée : redémarrée.")
                histo.append({"nom": "passerelle", "at": t, "resultat": "redémarrée"})
            else:
                aviser("passerelle", "Hermes : passerelle plantée", "systemd la dit « failed » et le redémarrage a échoué. Diagnostic : "
                       "session Serveur JARVIS, diagnostic.sh.", blanc, dire)

    # 5. la limite est-elle levée ? (seulement s'il y a quelque chose à relancer : la lecture lance Hermes quelques secondes)
    ouvert, detail = (None, "")
    if candidats:
        ouvert, detail = lire_usage()
        dire.append("Forfait : " + detail + ".")
    for c in candidats:
        if t < c["reprise"] + 60 or ouvert is False or (ouvert is None and t < c["reprise"] + 300):
            attente.append({"nom": c["nom"], "reprise": c["reprise"]})
            dire.append("%s : en attente de la levée de la limite (reprise annoncée le %s)." % (c["nom"], heure_paris(c["reprise"])))
            continue
        if int(compte.get(jour, 0)) >= PLAFOND:
            attente.append({"nom": c["nom"], "reprise": c["reprise"]})
            if not etat.get("plafond_dit") == jour:
                aviser("plafond", "Relances après la limite : plafond du jour atteint",
                       "%d relances aujourd'hui : les suivantes attendent demain. « %s » attend." % (PLAFOND, c["nom"]), blanc, dire)
                if not blanc:
                    etat["plafond_dit"] = jour
            continue
        if c["genre"] == "routine":
            if sctl("is-active", SERVICE)[1] != "active":
                attente.append({"nom": c["nom"], "reprise": c["reprise"]})
                dire.append("%s : Hermes n'est pas en marche, la relance attend." % c["nom"])
                continue
            if blanc:
                dire.append("À blanc : je relancerais la routine « %s » (coupée par la limite)." % c["nom"])
                continue
            compte[jour] = int(compte.get(jour, 0)) + 1
            faites[c["cle"]] = t
            if lancer_routine(c["id"]):
                suivis["jarvis-" + c["nom"]] = {"at": t, "cle": c["cle"]}
                dire.append("%s : relancée (coupée par la limite du forfait)." % c["nom"])
            else:
                aviser("routine-" + c["nom"], "Hermes : « %s » pas relancée" % c["nom"],
                       "Coupée par la limite du forfait Claude ; Hermes a refusé la relance automatique. Relance-la à la main si elle est "
                       "toujours utile (session Serveur JARVIS : routines.sh --lancer %s)." % c["nom"], blanc, dire)
        else:
            if blanc:
                dire.append("À blanc : je relancerais %s (tâche « %s » d'hermes-portail, coupée avant tout contact avec le portail)." % (c["unite"], c["nom"]))
                continue
            compte[jour] = int(compte.get(jour, 0)) + 1
            faites[c["cle"]] = t
            try:
                os.unlink(c["fichier"])
            except OSError:
                pass
            if sctl("start", "--no-block", c["unite"])[0] == 0:
                dire.append("%s : %s relancée (coupée par la limite avant tout contact avec le portail)." % (c["nom"], c["unite"]))
                histo.append({"nom": c["nom"], "at": t, "resultat": "relancée"})
            else:
                aviser("portail-" + c["nom"], "Hermes portail : « %s » pas relancée" % c["nom"],
                       "Coupée par la limite du forfait Claude avant tout contact avec le portail ; systemd a refusé de la relancer. "
                       "À relancer à la main (session Serveur JARVIS).", blanc, dire)

    if not dire:
        dire.append("Rien à relancer.")
    print("\n".join(dire))
    if blanc:
        return
    etat["historique"] = histo[-20:]
    ecrire_json(os.path.join(ETAT, "etat.json"), etat)
    # le résumé pour JARVIS (ligne « Forfait Claude » de sa santé) : noms et heures seulement
    g = groupe_jarvis()
    os.makedirs(AVIS, mode=0o750, exist_ok=True)
    try:
        os.chown(AVIS, 0, g if g is not None else 0)
        os.chmod(AVIS, 0o750)
    except OSError:
        pass
    ecrire_json(os.path.join(AVIS, "etat.json"), {"at": t, "ouvert": ouvert, "attente": attente[:10], "relances": etat["historique"][-10:]}, mode=0o640, groupe=g)
    menage_avis()


# ---------------------------------------------------------------- le résumé des routines, pour JARVIS (0.92.0)
# Sa remarque du 26/11/2026 : dans l'app, « Hermes et ses routines » ne montrait qu'une ligne périmée de l'onglet Routines de
# Pilotage. Les vraies routines sont dans le cron d'Hermes (jobs.json, chez l'utilisateur hermes, illisible pour JARVIS) :
# root en écrit ici un résumé ASSAINI, que JARVIS lit (groupe en lecture seule) et que l'app affiche en direct.
# - liste fermée : seules les routines de routines.conf (copie root posée par install.sh et routines.sh), jamais une autre ;
# - chaque valeur passe par une liste blanche de formes : noms, mots connus, dates ISO refaites ici. Jamais le texte d'une
#   erreur (une catégorie courte à la place), jamais un chemin, un jeton, un nom de portail ni un contenu de mail ;
# - aucune lecture d'usage, aucun lancement d'Hermes : jobs.json, deux fichiers de root et systemctl is-active seulement.
RESUME = E("HERMES_RELANCE_RESUME", "/var/lib/hermes-relance-etat")
ROUTINES_CONF = E("HERMES_RELANCE_CONF", "/usr/local/lib/hermes-relance/routines.conf")   # copie root de routines.conf
ROUTINES_MODE = E("HERMES_RELANCE_MODES", "/etc/hermes/routines.mode")                    # écrit par routines.sh --reel / --double
GARDE_MINUTERIE = "hermes-garde.timer"
R_NOM = re.compile(r"[a-z0-9][a-z0-9-]{1,39}")
R_CRON = re.compile(r"[0-9*,/-]{1,20}(?: [0-9*,/-]{1,20}){4}")
R_LIBELLE = re.compile(r"Routine «\s*([A-Za-zÀ-ÖØ-öø-ÿ0-9 .'’-]{2,60}?)\s*»")
JOURS = ("dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche")
RESEAU = re.compile(r"connection|connect ?error|timeout|timed out|\bdns\b|unreachable|network|name resolution|\b50[234]\b", re.I)
CAUSES = ("limite du forfait", "réseau", "résultat non envoyé", "arrêtée à la main", "erreur")
PASSERELLE = {"active": "active", "inactive": "arrêtée", "deactivating": "arrêtée", "failed": "plantée", "activating": "démarre", "reloading": "démarre"}


def _suite(mots):
    return mots[0] if len(mots) == 1 else ", ".join(mots[:-1]) + " et " + mots[-1]


def moment_lisible(cron):
    """« 40 7 * * 1-5 » → « du lundi au vendredi à 7 h 40 » (heure de Paris) ; un horaire plus tordu est rendu tel quel (« cron … »)."""
    c = cron.split()
    brut = "cron " + cron
    if len(c) != 5 or c[2] != "*" or c[3] != "*" or not c[0].isdigit() or int(c[0]) > 59:
        return brut
    heures = c[1].split(",")
    if not all(x.isdigit() and int(x) <= 23 for x in heures) or len(heures) > 6:
        return brut
    mi = int(c[0])
    quand = "à " + _suite(["%d h%s" % (int(x), " %02d" % mi if mi else "") for x in heures])
    j = c[4]
    if j == "*":
        return "chaque jour " + quand
    m = re.fullmatch(r"([0-7])-([0-7])", j)
    if m and int(m.group(1)) < int(m.group(2)):
        return "du %s au %s %s" % (JOURS[int(m.group(1))], JOURS[int(m.group(2))], quand)
    if re.fullmatch(r"[0-7](?:,[0-7]){0,6}", j):
        return _suite(["le " + JOURS[int(x)] for x in j.split(",")]) + " " + quand
    return brut


def routines_connues():
    """La liste fermée (copie root de routines.conf) : nom → {libelle, horaire, mode}. None si la copie manque."""
    t = lire_texte(ROUTINES_CONF, 200_000)
    if not t:
        return None
    connues = {}
    for ligne in t.splitlines():
        if not ligne.strip() or ligne.lstrip().startswith("#"):
            continue
        c = [x.strip() for x in ligne.split("|", 5)]
        if len(c) < 6 or not R_NOM.fullmatch(c[0]) or not R_CRON.fullmatch(" ".join(c[2].split())) or len(connues) >= 40:
            continue
        m = R_LIBELLE.search(c[5])
        connues[c[0]] = {"libelle": m.group(1).strip() if m else c[0], "horaire": " ".join(c[2].split()),
                         "mode": "réel" if "« en réel »" in c[5] else "double"}
    # le mode noté sur le serveur (routines.sh --reel / --double) l'emporte, comme dans routines.sh ; la dernière ligne gagne
    for ligne in lire_texte(ROUTINES_MODE, 20_000).splitlines():
        mots = ligne.split()
        if len(mots) == 2 and mots[0] in connues and mots[1] in ("reel", "double"):
            connues[mots[0]]["mode"] = "réel" if mots[1] == "reel" else "double"
    return connues


def iso_sur(v):
    """Une date de jobs.json refaite ici (AAAA-MM-JJTHH:MM:SSZ, UTC) : jamais la valeur lue recopiée. None si elle n'en est pas une."""
    ep = iso_ep(v) if isinstance(v, str) and len(v) <= 40 else None
    if ep is None or not 1_577_836_800 <= ep <= 4_102_444_800:   # entre 2020 et 2100
        return None
    return datetime.datetime.fromtimestamp(ep, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def resultat_de(j):
    """(résultat, cause) du dernier passage : ok, erreur ou jamais ; pour une erreur, une catégorie courte, jamais son texte."""
    st = j.get("last_status")
    if not j.get("last_run_at") or st is None:
        return "jamais", None
    if st == "ok":
        return "ok", None
    if st == "delivery_failed":
        return "erreur", "résultat non envoyé"
    if st == "cancelled":
        return "erreur", "arrêtée à la main"
    err = erreur_du_passage(j)
    return "erreur", "limite du forfait" if est_limite(err) else "réseau" if RESEAU.search(err) else "erreur"


def etat_garde(jour):
    """Le garde du forfait : coupé (jusqu'à une date), a arrêté Hermes, actif, ou arrêté (sa minuterie ne tourne pas)."""
    try:
        with open(GARDE_COUPE, encoding="utf-8", errors="replace") as f:
            m = re.search(r"\d{4}-\d{2}-\d{2}", f.read(200))
        if not m or jour <= m.group(0):
            return {"etat": "coupé", "jusqua": m.group(0) if m else None}
    except OSError:
        pass
    if os.path.exists(GARDE_ARRET):
        return {"etat": "a arrêté Hermes", "jusqua": None}
    return {"etat": "actif" if sctl("is-active", GARDE_MINUTERIE)[1] == "active" else "arrêté", "jusqua": None}


def resume_routines():
    """Ce que JARVIS peut savoir du cron d'Hermes : voir plus haut. Rien n'est recopié tel quel de jobs.json."""
    t = maintenant()
    jour = datetime.datetime.fromtimestamp(t, _zone("Europe/Paris")).strftime("%Y-%m-%d")
    connues = routines_connues()
    data = lire_json(JOBS)
    jobs = [j for j in data["jobs"] if isinstance(j, dict)] if isinstance(data, dict) and isinstance(data.get("jobs"), list) else None
    par_nom, inconnues = {}, 0
    for j in jobs or []:
        nom = j.get("name")
        if not isinstance(nom, str) or not nom.startswith("jarvis-"):
            continue
        if connues is not None and nom[7:] in connues:
            par_nom[nom[7:]] = j
        else:
            inconnues += 1   # une routine jarvis-… hors de la liste : comptée, jamais décrite
    routines = []
    for nom, c in (connues or {}).items():
        j = par_nom.get(nom)
        r = {"nom": nom, "libelle": c["libelle"], "moment": moment_lisible(c["horaire"]), "mode": c["mode"], "posee": j is not None,
             "active": False, "dernier": None, "resultat": "jamais", "cause": None, "prochain": None}
        if j is not None:
            expr = j["schedule"].get("expr") if isinstance(j.get("schedule"), dict) else None
            if isinstance(expr, str) and R_CRON.fullmatch(" ".join(expr.split())):
                r["moment"] = moment_lisible(" ".join(expr.split()))   # l'horaire vraiment posé chez Hermes
            r["active"] = j.get("enabled", True) is not False and j.get("state") not in ("paused", "completed") and not j.get("paused_at")
            r["resultat"], r["cause"] = resultat_de(j)
            if r["cause"] is not None and r["cause"] not in CAUSES:
                r["cause"] = "erreur"
            r["dernier"] = iso_sur(j.get("last_run_at")) if r["resultat"] != "jamais" else None
            r["prochain"] = iso_sur(j.get("next_run_at")) if r["active"] else None
        routines.append(r)
    return {"v": 1, "at": t, "liste": connues is not None, "cron": jobs is not None,
            "passerelle": PASSERELLE.get(sctl("is-active", SERVICE)[1], "inconnue"), "garde": etat_garde(jour),
            "routines": routines, "inconnues": min(inconnues, 99)}


def ecrire_resume():
    """Le résumé dans le dossier de root lisible par le groupe de JARVIS (750, fichier 640), d'un coup, jamais à travers un lien."""
    g = groupe_jarvis()
    os.makedirs(RESUME, mode=0o750, exist_ok=True)
    if os.path.islink(RESUME):
        raise OSError("dossier du résumé : un lien")
    try:
        os.chown(RESUME, 0, g if g is not None else 0)
    except OSError:
        pass
    os.chmod(RESUME, 0o750)
    ecrire_json(os.path.join(RESUME, "routines.json"), resume_routines(), mode=0o640, groupe=g)


def cmd_minuterie(a):
    """La minuterie : la relance d'abord, puis le résumé pour JARVIS, quoi qu'il soit arrivé à la relance. Une erreur du résumé
    est avalée et dite dans le journal (son genre seulement) : elle ne change ni le résultat ni le code de sortie de la relance."""
    try:
        cmd_relancer(a)
    finally:
        if not a.a_blanc:
            try:
                ecrire_resume()
            except Exception as e:   # jamais la relance en échec pour un résumé
                print("Résumé des routines pour JARVIS : pas écrit (%s)." % type(e).__name__)


def main():
    p = argparse.ArgumentParser(description="La limite du forfait Claude (JARVIS OS)")
    s = p.add_subparsers(dest="cmd", required=True)
    x = s.add_parser("texte"); x.add_argument("fichier"); x.add_argument("--quand")
    x = s.add_parser("passage"); x.add_argument("--sortie", required=True); x.add_argument("--debut", required=True); x.add_argument("--fin", required=True)
    x.add_argument("--code", default="0"); x.add_argument("--journal"); x.add_argument("--claude", required=True); x.add_argument("--vers", required=True)
    x = s.add_parser("verdict"); x.add_argument("--fichier", required=True); x.add_argument("--debut", required=True)
    x = s.add_parser("attente"); x.add_argument("--dossier", required=True); x.add_argument("--maintenant")
    x = s.add_parser("planifier"); x.add_argument("--dossier", required=True); x.add_argument("--tache", required=True); x.add_argument("--cle", required=True)
    x.add_argument("--unite", required=True); x.add_argument("--depuis", required=True)
    x = s.add_parser("relancer"); x.add_argument("--a-blanc", action="store_true")
    x = s.add_parser("aviser"); x.add_argument("--cle", required=True); x.add_argument("--titre", required=True); x.add_argument("--texte", default="")
    a = p.parse_args()
    {"texte": cmd_texte, "passage": cmd_passage, "verdict": cmd_verdict, "attente": cmd_attente, "planifier": cmd_planifier, "relancer": cmd_minuterie, "aviser": cmd_aviser}[a.cmd](a)


if __name__ == "__main__":
    main()
