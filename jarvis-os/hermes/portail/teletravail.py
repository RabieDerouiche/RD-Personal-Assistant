#!/usr/bin/env python3
# Hermes « portail » — la note de télétravail : montants lus par règles, garde-fous, calcul, page de synthèse, champs de la dépense
# (docs/hermes-portail.md, « La note de frais de télétravail »). Lancé par « hermes-portail teletravail » (root), sans réseau.
#
#   python3 -I teletravail.py preparer --conf <teletravail.conf> --dossier <dossier de root> --mois AAAA-MM --historique <fichier> [--diagnostic]
#
# Le dossier contient ce que la commande a déjà rassemblé : jours.json (le bilan de JARVIS) et le texte de chaque pièce
# (charges.txt, taxe.txt, assurance.txt, electricite.txt). Il y écrit synthese.html, champs.txt et resultat.json.
# Codes : 0 prêt ; 2 arrêté par un garde-fou (la raison est dite, sans montant) ; 1 réglage ou fichier manquant.
#
# Aucune valeur personnelle ici : surfaces, nom, date de début de mission, montants fixes, recherches et repères sont dans le
# fichier de réglages du serveur (/etc/hermes-portail/teletravail.conf, root 600), jamais dans le dépôt.
import calendar, datetime, html, json, os, re, sys
from decimal import Decimal, ROUND_HALF_UP

MOIS_NOMS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
DATE = r'(\d{2})/(\d{2})/(\d{4})'
DEFAUTS = {   # les expressions de lecture des pièces ; le fichier de réglages peut les remplacer
    'charges_periode_motif': r'P[ée]riode\s+du\s+' + DATE + r'\s+au\s+' + DATE,
    'assurance_motif': r'valable\s+du\s+' + DATE + r'\s+au\s+' + DATE,
    'taxe_motif': r'Somme\s+[àa]\s+payer\s*:?\s*([0-9][0-9\s.,]*[0-9])\s*(?:€|EUR)',
    'electricite_montant_motif': r'Montant\s+Total\s+TTC\s*:?\s*([0-9][0-9\s.,]*[0-9])\s*(?:€|EUR)',
    'electricite_date_motif': r'Facture\b[\s\S]{0,60}?\bdu\s+' + DATE + r'(?!\s*au\b)',   # « Facture … N° … » puis « du JJ/MM/AAAA » sur la ligne suivante
    'ecart_max': '0.5',
}
OBLIGATOIRES = ['nom', 'debut_mission', 'surface_logement', 'surface_bureau', 'taxe_fonciere_an', 'assurance_an', 'charges_lot', 'champs']


class Arret(Exception):
    pass


def lire_conf(chemin):
    c = dict(DEFAUTS)
    with open(chemin, encoding='utf-8') as f:
        for ligne in f:
            ligne = ligne.rstrip('\n')
            if not ligne.strip() or ligne.lstrip().startswith('#') or '=' not in ligne:
                continue
            k, v = ligne.split('=', 1)
            c[k.strip()] = v.strip()
    manque = [k for k in OBLIGATOIRES if not c.get(k)]
    if manque:
        raise ValueError('réglages manquants dans ' + chemin + ' : ' + ', '.join(manque))
    return c


def nombre(s):
    """« 1 372,00 », « 453.97 », « 58,70 » → Decimal ; vide → 0."""
    s = re.sub(r'[\s  ]', '', str(s or ''))
    if not s:
        return Decimal('0')
    if ',' in s and '.' in s:
        s = s.replace('.', '').replace(',', '.') if s.rfind(',') > s.rfind('.') else s.replace(',', '')
    else:
        s = s.replace(',', '.')
    if not re.fullmatch(r'\d+(\.\d+)?', s):
        raise ValueError('nombre illisible')
    return Decimal(s)


def deux(d):
    return d.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def fr(d):
    return f'{deux(d):.2f}'.replace('.', ',')


def jours_dit(q):
    q = Decimal(str(q))
    return str(int(q)) if q == q.to_integral() else f'{q}'.replace('.', ',')


def une_date(m, i=0):
    return datetime.date(int(m.group(i + 3)), int(m.group(i + 2)), int(m.group(i + 1)))


def texte(dossier, nom):
    """Le texte d'une pièce, lu de deux façons, l'une après l'autre : par pdf.mjs de JARVIS (<nom>.txt), puis par pdftotext -layout
    (<nom sans .txt>.layout.txt). Vu sur les vraies pièces d'octobre : le premier colle les cellules d'un tableau (« TOTAL DU LOT453.97… »),
    le second éloigne parfois un montant de son libellé ; chaque règle prend la première lecture qui lui répond."""
    out = []
    for n in (nom, nom[:-4] + '.layout.txt'):
        try:
            out.append(open(os.path.join(dossier, n), encoding='utf-8', errors='replace').read())
        except OSError:
            pass
    return '\n\f\n'.join(out)


def espaces_souples(s):
    return r'\s*'.join(re.escape(x) for x in s.split())   # « 0021 Appartement » ou « 0021Appartement » (cellules collées)


def preparer(conf_chemin, dossier, ym, historique, diagnostic=False):
    c = lire_conf(conf_chemin)
    a, mo = int(ym[:4]), int(ym[5:7])
    premier, dernier = datetime.date(a, mo, 1), datetime.date(a, mo, calendar.monthrange(a, mo)[1])
    vu = {}   # le diagnostic : ce qui a été trouvé (oui / non), jamais une valeur
    arrets = []

    # 1. les jours (JARVIS) : complets, et au moins un jour de télétravail
    try:
        J = json.load(open(os.path.join(dossier, 'jours.json'), encoding='utf-8'))
    except (OSError, ValueError):
        raise ValueError('jours.json absent ou illisible')
    if J.get('mois') != ym:
        raise ValueError('jours.json ne porte pas sur ' + ym)
    if J.get('aResoudre'):
        arrets.append('un conflit dans les jours (' + ', '.join(J['aResoudre'][:6]) + ') : à résoudre dans JARVIS')
    if J.get('aConfirmer'):
        arrets.append('jours ouvrés sans lieu ni congé noté (' + ', '.join(J['aConfirmer'][:6]) + ')')
    tt = {d['date']: Decimal(str(d['q'])) for d in J.get('tt', [])}
    jours_tt = sum(tt.values(), Decimal('0'))
    ouvres = sum(1 for k in range(1, dernier.day + 1) if datetime.date(a, mo, k).weekday() < 5)   # tous les lundis à vendredis, fériés compris
    vu['jours'] = 'oui' if not J.get('aResoudre') and not J.get('aConfirmer') else 'incomplets'
    if jours_tt <= 0 and not arrets:
        arrets.append('aucun jour de télétravail ce mois-ci : aucune dépense (pas de note à zéro)')

    # 2. l'appel de charges : le total du lot de l'appartement, sur une période qui couvre le mois, divisé par trois
    t = texte(dossier, 'charges.txt')
    m = re.search(c['charges_periode_motif'], t, re.I)
    vu['charges_periode'] = 'oui' if m else 'non'
    if not m:
        arrets.append('appel de charges : période illisible')
    elif not (une_date(m) <= premier and une_date(m, 3) >= dernier):
        arrets.append("appel de charges : sa période ne couvre pas le mois (le suivant n'est pas encore arrivé ?)")
    charges = None
    p = re.search(espaces_souples(c['charges_lot']), t, re.I)
    vu['charges_lot'] = 'oui' if p else 'non'
    if p:
        # le premier montant à deux décimales après « TOTAL DU LOT » (le total ; le second, collé ou non, est la part locative)
        q = re.compile(r'TOTAL\s*DU\s*LOT\s*([0-9]{1,7}[.,][0-9]{2})', re.I).search(t, p.end())
        vu['charges_total'] = 'oui' if q else 'non'
        if q:
            charges = deux(nombre(q.group(1)) / 3)
    if charges is None:
        arrets.append("appel de charges : total du lot de l'appartement introuvable")

    # 3. l'avis de taxe foncière : son montant doit être celui des réglages (sinon, nouvel avis : réglage à revoir)
    t = texte(dossier, 'taxe.txt')
    m = re.search(c['taxe_motif'], t, re.I)
    vu['taxe_montant'] = 'oui' if m else 'non'
    tf = nombre(c['taxe_fonciere_an'])
    if not m:
        arrets.append('avis de taxe foncière : montant illisible')
    elif nombre(m.group(1)) != tf:
        arrets.append("avis de taxe foncière : son montant n'est pas celui des réglages (nouvel avis ?)")

    # 4. l'attestation d'assurance : valable pendant tout le mois (sinon renouvelée : montant annuel à revoir)
    t = texte(dossier, 'assurance.txt')
    m = re.search(c['assurance_motif'], t, re.I)
    vu['assurance_validite'] = 'oui' if m else 'non'
    if not m:
        arrets.append("attestation d'assurance : période de validité illisible")
    elif not (une_date(m) <= premier and une_date(m, 3) >= dernier):
        arrets.append("attestation d'assurance : pas valable tout le mois (renouvelée ? vérifier le montant annuel)")

    # 5. la facture d'électricité : émise dans le mois, montant TTC lu
    t = texte(dossier, 'electricite.txt')
    elec = None
    ms = list(re.finditer(c['electricite_montant_motif'], t, re.I))
    vu['electricite_montant'] = 'oui' if ms else 'non'
    if ms:
        try:
            elec = deux(nombre(ms[0].group(1)))   # la première lecture : le montant à côté de son libellé
        except ValueError:
            elec = None
    if elec is None:
        arrets.append("facture d'électricité : montant TTC illisible")
    m = re.search(c['electricite_date_motif'], t, re.I)
    vu['electricite_date'] = 'oui' if m else 'non'
    if not m:
        arrets.append("facture d'électricité : date d'émission illisible")
    elif not (premier <= une_date(m) <= dernier):
        arrets.append("facture d'électricité : pas émise dans le mois (celle du mois n'est pas encore là ?)")

    # 6. le garde-fou du mois d'avant : un écart inhabituel arrête tout
    try:
        H = json.load(open(historique, encoding='utf-8'))
    except (OSError, ValueError):
        H = {}
    avant = sorted(k for k in H if re.fullmatch(r'\d{4}-\d{2}', k) and k < ym)
    prec = H[avant[-1]] if avant else {}
    ecart = Decimal(c.get('ecart_max') or '0.5')
    for cle, val in (('charges', charges), ('electricite', elec)):
        ref = prec.get(cle) if prec.get(cle) is not None else (c.get('precedent_' + cle) or None)
        if val is None or ref in (None, ''):
            vu['ecart_' + cle] = 'sans référence'
            continue
        ref = nombre(ref)
        if ref > 0 and abs(val - ref) / ref > ecart:
            arrets.append(cle + " : écart de plus de " + str(int(ecart * 100)) + " % avec le mois d'avant : à vérifier à la main")
            vu['ecart_' + cle] = 'trop grand'
        else:
            vu['ecart_' + cle] = 'normal'

    if diagnostic:
        print('Diagnostic (trouvé ou non, aucune valeur) : ' + ' ; '.join(k + ' ' + v for k, v in vu.items()))
    if arrets:
        raise Arret(arrets)

    # 7. le calcul (formule du classeur) : dénominateur = tous les lundis à vendredis du mois ; numérateur = jours télétravaillés
    sl, sb = nombre(c['surface_logement']), nombre(c['surface_bureau'])
    th, autres, eau = nombre(c.get('taxe_habitation_an')), nombre(c.get('autres_taxes_mois')), nombre(c.get('eau_mois'))
    assur = nombre(c['assurance_an'])
    mensuel = charges + autres + tf / 12 + th / 12 + assur / 12 + elec + eau
    total = deux(sb * jours_tt * mensuel / sl / ouvres)
    if total <= 0:
        raise Arret(['montant calculé nul : aucune dépense'])

    # 8. la page de synthèse (tableau recréé à l'identique de celui du classeur), puis les champs de la dépense
    jours_mois = [datetime.date(a, mo, k) for k in range(1, dernier.day + 1)]
    semaines = []
    for d in jours_mois:
        s = d.isocalendar()[1]
        if semaines and semaines[-1][0] == s:
            semaines[-1][1] += 1
        else:
            semaines.append([s, 1])
    e = html.escape
    cel = lambda d: ('<td class="w">' if d.weekday() >= 5 else '<td>') + (e(jours_dit(tt[d.isoformat()])) if d.isoformat() in tt else '') + '</td>'
    ligne = lambda lib, val, unite: f'<tr><th>{e(lib)}</th><td class="v">{e(val)}</td><td>{e(unite)}</td><td class="j">Justificatif à produire</td></tr>'
    page = f'''<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Télétravail {mo:02d}/{a}</title><style>
@page {{ size: A4 landscape; margin: 12mm; }}
body {{ font: 10pt Arial, Helvetica, sans-serif; color: #111; }}
h1 {{ font-size: 15pt; margin: 0 0 6px; }} .id {{ margin: 0 0 10px; }} .id b {{ margin-right: 16px; }}
table {{ border-collapse: collapse; }} .jours {{ width: 100%; table-layout: fixed; font-size: 7pt; }}
.jours td, .jours th {{ border: 1px solid #555; padding: 2px 1px; text-align: center; }} .jours .w {{ background: #ddd; }}
.jours th.l {{ width: 52px; text-align: left; }} .jours .tot {{ width: 44px; font-weight: bold; }}
h2 {{ font-size: 11pt; margin: 12px 0 4px; }} .frais th {{ text-align: left; font-weight: normal; padding: 2px 10px 2px 0; width: 230px; }}
.frais td {{ padding: 2px 8px; }} .frais .v {{ text-align: right; font-weight: bold; min-width: 70px; }} .frais .j {{ color: #555; font-style: italic; }}
.total {{ margin-top: 12px; font-size: 13pt; font-weight: bold; }}
</style></head><body>
<h1>TELETRAVAIL / Home OFFICE Barème {a}</h1>
<p class="id"><b>Prénom &amp; Nom : {e(c['nom'])}</b><b>Mois : {mo:02d}</b><b>Année : {a}</b><b>Date de démarrage de la mission : {e(c['debut_mission'])}</b></p>
<table class="jours">
<tr><th class="l">Week / Sem.</th>{''.join(f'<th colspan="{n}">{s}</th>' for s, n in semaines)}<th class="tot">TOTAL</th></tr>
<tr><th class="l">JOURS</th>{''.join(('<th class="w">' if d.weekday() >= 5 else '<th>') + d.strftime('%d/%m') + '</th>' for d in jours_mois)}<th class="tot">{len(jours_mois)} jours</th></tr>
<tr><th class="l"></th>{''.join(cel(d) for d in jours_mois)}<td class="tot">{e(jours_dit(jours_tt))}</td></tr>
</table>
<h2>Logement</h2><table class="frais">
<tr><th>Surface du Logement</th><td class="v">{e(c['surface_logement'])}</td><td>m²</td></tr>
<tr><th>Surface de l'espace de télétravail</th><td class="v">{e(c['surface_bureau'])}</td><td>m²</td></tr></table>
<h2>Si propriétaire</h2><table class="frais">
{ligne('Charges de copro', fr(charges), '€/mois')}
{ligne('Autres taxes communales', fr(autres), '€/mois')}
{ligne('Taxe foncière', fr(tf), '€/an')}</table>
<h2>Commun locataire et propriétaire</h2><table class="frais">
{ligne("Taxe d'habitation", fr(th), '€/an')}
{ligne('Assurance habitation', fr(assur), '€/an')}
{ligne('Electricité', fr(elec), '€/mois')}
{ligne('Eau', fr(eau) if eau else '', '€/mois')}</table>
<p class="total">Total mensuel : {fr(total)} €</p>
</body></html>
'''
    gabarit = open(c['champs'], encoding='utf-8').read()
    if len(gabarit.encode()) > 3000:
        raise ValueError('le modèle des champs dépasse 3000 octets')
    champs = (gabarit.replace('{DATE}', dernier.strftime('%d/%m/%Y')).replace('{MONTANT}', fr(total)).replace('{MOIS_NOM}', MOIS_NOMS[mo - 1])
              .replace('{MOIS}', f'{mo:02d}').replace('{ANNEE}', str(a)).replace('{JOURS}', jours_dit(jours_tt)))
    resultat = {'mois': ym, 'jours_tt': float(jours_tt), 'ouvres': ouvres, 'charges': float(charges), 'electricite': float(elec), 'total': float(total)}
    for nom, contenu in (('synthese.html', page), ('champs.txt', champs), ('resultat.json', json.dumps(resultat))):
        f = os.path.join(dossier, nom)
        fd = os.open(f, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
        os.write(fd, contenu.encode('utf-8'))
        os.close(fd)
    return resultat, vu


def main():
    if len(sys.argv) < 2 or sys.argv[1] != 'preparer':
        sys.exit('Usage : teletravail.py preparer --conf … --dossier … --mois AAAA-MM --historique … [--diagnostic]')
    a = sys.argv[2:]
    o = {a[i][2:]: a[i + 1] for i in range(0, len(a) - 1) if a[i].startswith('--') and a[i] != '--diagnostic'}
    if not all(k in o for k in ('conf', 'dossier', 'mois', 'historique')) or not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', o['mois']):
        sys.exit('Usage : teletravail.py preparer --conf … --dossier … --mois AAAA-MM --historique … [--diagnostic]')
    try:
        r, _ = preparer(o['conf'], o['dossier'], o['mois'], o['historique'], '--diagnostic' in a)
    except Arret as x:
        print('Arrêt (garde-fou) :')
        for raison in x.args[0]:
            print('  - ' + raison)
        sys.exit(2)
    except (OSError, ValueError) as x:
        print('Réglage ou fichier : ' + str(x))
        sys.exit(1)
    print('Jours de télétravail : %s sur %d jours ouvrés.' % (jours_dit(r['jours_tt']), r['ouvres']))
    print('Note prête : synthèse, champs de la dépense (montant au dernier jour du mois).')


if __name__ == '__main__':
    main()
