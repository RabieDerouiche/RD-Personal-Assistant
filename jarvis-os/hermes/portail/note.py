#!/usr/bin/env python3
# Hermes « portail » — une note de frais à facture (la box le 15, l'abonnement Claude dès sa facture) : montant et date lus par règles
# dans le texte de la facture, garde-fous, champs de la dépense remplis depuis un modèle. Sans réseau, sans IA, lancé par root
# (`hermes-portail note`). 26/11/2026, sa décision : Chronos s'arrête, Hermes fait les notes ; la première de chaque sorte est validée
# par lui dans JARVIS. Les valeurs fixes (vendeur, catégorie, étiquette, motifs de lecture) sont dans /etc/hermes-portail/note-<sorte>.conf
# et le modèle des champs : jamais dans le dépôt.
#
#   python3 note.py preparer --conf <note-x.conf> --dossier <dossier> --mois AAAA-MM --historique <historique.json> [--diagnostic]
#
# Le dossier contient facture.txt (pdf.mjs de JARVIS) et facture.layout.txt (pdftotext -layout). Il y écrit champs.txt et resultat.json.
# Sortie : code 0 note prête ; 2 arrêt par un garde-fou (raisons dites, sans valeur) ; 1 erreur de réglage ou de fichier.
import argparse, calendar, datetime, json, os, re, sys
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

MOIS_NOMS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
MOIS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
MOIS_EN3 = [m[:3] for m in MOIS_EN]
MOIS_FR3 = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc']
OBLIGATOIRES = ['champs']
# un montant : 1 234,56 / 1234.56 / 1,234.56 / 48,2 ; avec ou sans symbole
MONTANT = r'(?:€|\$|EUR|USD)?\s*([0-9]{1,3}(?:[   .,][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)\s*(?:€|\$|EUR|USD)?'
# lignes du total, par défaut (une facture française ou anglaise) ; le réglage montant_motif les remplace
TOTAL_DEFAUT = [r'total\s*(?:ttc|à payer|a payer|du|dû|due|paid|payé)', r'montant\s*(?:ttc|total|à payer|a payer|prélevé|preleve)', r'amount\s*(?:paid|due)', r'net\s*à\s*payer', r'^\s*total\b(?!\s*(?:ht|hors|excl|before))']
DATE_DEFAUT = [r'date\s*(?:de\s*(?:la\s*)?facture|d.émission|of\s*issue|paid|de\s*paiement)', r'(?:invoice|receipt)\s*date', r'factur[ée]e?\s*le', r'émise?\s*le', r'^\s*date\b']


def lire_conf(chemin):
    c = {}
    for ligne in open(chemin, encoding='utf-8'):
        ligne = ligne.rstrip('\n')
        if not ligne.strip() or ligne.lstrip().startswith('#') or '=' not in ligne:
            continue
        k, v = ligne.split('=', 1)
        c[k.strip()] = v.strip()
    manque = [k for k in OBLIGATOIRES if not c.get(k)]
    if manque:
        raise ValueError('réglages manquants : ' + ', '.join(manque))
    return c


def nombre(s):
    s = s.replace(' ', ' ').replace(' ', ' ').strip()
    if re.fullmatch(r'[0-9]{1,3}(?:[ .,][0-9]{3})+(?:[.,][0-9]{1,2})?', s):   # milliers séparés
        dec = ''
        m = re.search(r'[.,]([0-9]{1,2})$', s)
        if m and (len(s) - m.start()) <= 3:
            dec = m.group(1); s = s[:m.start()]
        s = re.sub(r'[ .,]', '', s) + ('.' + dec if dec else '')
    else:
        s = s.replace(' ', '').replace(',', '.')
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def fr(d):
    return f'{d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP):.2f}'.replace('.', ',')


def montant_sur(texte, motifs):
    """Le montant de la première ligne qui porte un des motifs (sur la ligne, ou au début de la suivante)."""
    lignes = texte.splitlines()
    for motif in motifs:
        rx = re.compile(motif, re.I)
        for i, l in enumerate(lignes):
            m = rx.search(l)
            if not m:
                continue
            if m.groups():   # un motif du réglage avec son groupe : la valeur, telle quelle
                v = nombre(m.group(1))
                if v is not None:
                    return v
                continue
            reste = l[m.end():] + ' ' + (lignes[i + 1] if i + 1 < len(lignes) else '')
            for mm in re.finditer(MONTANT, reste):
                if reste[mm.end(1):mm.end(1) + 2].strip().startswith('%'):
                    continue   # un taux (« TVA 20 % »), pas un montant
                v = nombre(mm.group(1))
                if v is not None and v > 0 and not re.fullmatch(r'(19|20)[0-9]{2}', mm.group(1).strip()):
                    return v
    return None


def une_date(texte, motifs):
    """La date de la première ligne qui porte un des motifs : JJ/MM/AAAA, AAAA-MM-JJ, « 21 novembre 2026 », « November 21, 2026 »."""
    def lire(s):
        m = re.search(r'\b([0-3]?[0-9])[/.-]([01]?[0-9])[/.-]((?:19|20)[0-9]{2})\b', s)
        if m:
            return datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        m = re.search(r'\b((?:19|20)[0-9]{2})-([01][0-9])-([0-3][0-9])\b', s)
        if m:
            return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        m = re.search(r'\b([0-3]?[0-9])(?:er)?\s+([a-zéû]+)\.?\s+((?:19|20)[0-9]{2})\b', s, re.I)
        if m:
            n = m.group(2).lower()
            for L in (MOIS_NOMS, MOIS_EN, MOIS_FR3, MOIS_EN3):
                for k, nom in enumerate(L):
                    if n == nom or (len(n) >= 3 and nom.startswith(n)):
                        return datetime.date(int(m.group(3)), k + 1, int(m.group(1)))
        m = re.search(r'\b([A-Za-z]+)\.?\s+([0-3]?[0-9]),?\s+((?:19|20)[0-9]{2})\b', s)
        if m:
            n = m.group(1).lower()
            for L in (MOIS_EN, MOIS_EN3):
                for k, nom in enumerate(L):
                    if n == nom or (len(n) >= 3 and nom.startswith(n)):
                        return datetime.date(int(m.group(3)), k + 1, int(m.group(2)))
        return None
    lignes = texte.splitlines()
    for motif in motifs:
        rx = re.compile(motif, re.I)
        for i, l in enumerate(lignes):
            m = rx.search(l)
            if not m:
                continue
            if m.groups():
                try:
                    d = lire(m.group(1))
                except ValueError:
                    d = None
                if d:
                    return d
                continue
            for s in (l[m.end():], lignes[i + 1] if i + 1 < len(lignes) else ''):
                try:
                    d = lire(s)
                except ValueError:
                    d = None
                if d:
                    return d
    return None


def preparer(conf_chemin, dossier, ym, historique, sorte, diagnostic=False, fenetre=None):
    c = lire_conf(conf_chemin)
    a, mo = int(ym[:4]), int(ym[5:7])
    premier, dernier = datetime.date(a, mo, 1), datetime.date(a, mo, calendar.monthrange(a, mo)[1])
    vu, arrets = {}, []
    t1 = open(os.path.join(dossier, 'facture.txt'), encoding='utf-8', errors='replace').read() if os.path.exists(os.path.join(dossier, 'facture.txt')) else ''
    t2 = open(os.path.join(dossier, 'facture.layout.txt'), encoding='utf-8', errors='replace').read() if os.path.exists(os.path.join(dossier, 'facture.layout.txt')) else ''
    if not (t1.strip() or t2.strip()):
        raise ValueError('facture sans texte lisible')
    m_motifs = [c['montant_motif']] if c.get('montant_motif') else TOTAL_DEFAUT
    d_motifs = [c['date_motif']] if c.get('date_motif') else DATE_DEFAUT
    montant = montant_sur(t2, m_motifs) or montant_sur(t1, m_motifs)
    date = une_date(t2, d_motifs) or une_date(t1, d_motifs)
    vu['montant'] = 'oui' if montant else 'non'
    vu['date'] = 'oui' if date else 'non'
    ht = tva = None
    if c.get('ht_motif'):
        ht = montant_sur(t2, [c['ht_motif']]) or montant_sur(t1, [c['ht_motif']]); vu['ht'] = 'oui' if ht else 'non'
    if c.get('tva_motif'):
        tva = montant_sur(t2, [c['tva_motif']]) or montant_sur(t1, [c['tva_motif']]); vu['tva'] = 'oui' if tva else 'non'
    # le contrôle de TVA (celui de la routine de Chronos pour l'abonnement Grok Bot ; réglé sur le serveur) :
    # « aucune » : la facture ne doit pas porter de TVA ; « presente » : elle doit en porter ; « taux:20 » : TVA = 20 % du HT, au centime
    tc = c.get('tva_controle', '').strip()
    if tc:
        if tc == 'aucune' and tva and tva > 0:
            arrets.append('contrôle de TVA : la facture porte une TVA alors qu’aucune n’est attendue')
        elif tc == 'presente' and not (tva and tva > 0):
            arrets.append('contrôle de TVA : TVA attendue mais introuvable sur la facture')
        elif re.fullmatch(r'taux:[0-9]{1,2}(?:[.,][0-9])?', tc):
            taux = nombre(tc[5:])
            if not (ht and tva) or abs(ht * taux / 100 - tva) > Decimal('0.02'):
                arrets.append('contrôle de TVA : la TVA ne fait pas ' + tc[5:] + ' % du montant hors taxes')
        vu['tva_controle'] = 'non' if any(a.startswith('contrôle de TVA') for a in arrets) else 'oui'
    if not montant:
        arrets.append('montant de la facture introuvable (règle « montant_motif » à revoir)')
    if not date:
        arrets.append('date de la facture introuvable (règle « date_motif » à revoir)')
    # la facture du bon mois : émise dans le mois (une facture d'un autre mois n'est jamais reprise)
    de, a_ = fenetre or (premier, dernier)
    if date and not (de <= date <= a_):
        arrets.append('la facture lue n’est pas émise dans la période attendue (elle date de ' + MOIS_NOMS[date.month - 1] + ' ' + str(date.year) + ')')
    vu['mois'] = 'oui' if date and de <= date <= a_ else 'non'
    # la même facture jamais reprise pour deux mois (historique des dates de facture, par sorte)
    try:
        Hd = json.load(open(historique, encoding='utf-8')).get(sorte + '_dates', {})
        if date and any(v == date.isoformat() and k != ym for k, v in Hd.items()):
            arrets.append('cette facture a déjà servi pour une autre note (même date de facture)')
    except (OSError, ValueError):
        pass
    # un montant inhabituel : plus de 50 % d'écart avec le mois d'avant (historique de root, sinon le réglage precedent_montant)
    prec = None
    try:
        H = json.load(open(historique, encoding='utf-8')).get(sorte, {})
        avant = sorted(k for k in H if k < ym)
        if avant:
            prec = Decimal(str(H[avant[-1]]))
    except (OSError, ValueError, InvalidOperation):
        pass
    if prec is None and c.get('precedent_montant'):
        prec = nombre(c['precedent_montant'])
    ecart = 'inconnu'
    if montant and prec and prec > 0:
        r = abs(montant - prec) / prec
        ecart = 'normal' if r <= Decimal('0.5') else 'inhabituel'
        if ecart == 'inhabituel':
            arrets.append('montant inhabituel : plus de 50 % d’écart avec le mois d’avant')
    vu['ecart'] = ecart
    if diagnostic:
        print('Diagnostic (trouvé ou non, aucune valeur) : ' + ' ; '.join(k + ' ' + v for k, v in vu.items()))
    if arrets:
        return None, vu, arrets
    gabarit = open(c['champs'], encoding='utf-8').read()
    if len(gabarit.encode()) > 3000:
        raise ValueError('le modèle des champs dépasse 3000 octets')
    # la date de la dépense : celle de la facture (par défaut), un jour fixe du mois de la note (« jour:15 ») ou son dernier jour (« dernier »)
    dd = c.get('date_depense', 'facture').strip()
    if dd == 'dernier':
        date_dep = dernier
    elif re.fullmatch(r'jour:[0-9]{1,2}', dd):
        date_dep = datetime.date(a, mo, min(int(dd[5:]), dernier.day))
    else:
        date_dep = date
    champs = (gabarit.replace('{DATE}', date_dep.strftime('%d/%m/%Y')).replace('{DATE_FACTURE}', date.strftime('%d/%m/%Y'))
              .replace('{DERNIER_JOUR}', dernier.strftime('%d/%m/%Y')).replace('{MONTANT}', fr(montant))
              .replace('{MONTANT_HT}', fr(ht) if ht else '').replace('{TVA}', fr(tva) if tva else '')
              .replace('{MOIS_NOM}', MOIS_NOMS[mo - 1]).replace('{MOIS}', f'{mo:02d}').replace('{ANNEE}', str(a)))
    if re.search(r'\{[A-Z_]+\}', champs):
        raise ValueError('le modèle des champs garde une case inconnue : ' + re.search(r'\{[A-Z_]+\}', champs).group(0))
    resultat = {'sorte': sorte, 'mois': ym, 'montant': float(montant), 'date': date.isoformat(), 'ht': float(ht) if ht else None, 'tva': float(tva) if tva else None}
    for nom, contenu in (('champs.txt', champs), ('resultat.json', json.dumps(resultat))):
        f = os.path.join(dossier, nom)
        fd = os.open(f, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
        os.write(fd, contenu.encode('utf-8'))
        os.close(fd)
    return resultat, vu, []


def main():
    p = argparse.ArgumentParser()
    p.add_argument('action', choices=['preparer'])
    p.add_argument('--conf', required=True); p.add_argument('--dossier', required=True); p.add_argument('--mois', required=True)
    p.add_argument('--historique', required=True); p.add_argument('--sorte', required=True); p.add_argument('--diagnostic', action='store_true')
    p.add_argument('--de'); p.add_argument('--a')   # la période où la facture doit être émise (par défaut : le mois)
    o = p.parse_args()
    fenetre = None
    if o.de and o.a:
        try:
            fenetre = (datetime.date.fromisoformat(o.de), datetime.date.fromisoformat(o.a))
        except ValueError:
            print('Période invalide.'); sys.exit(1)
    if not re.fullmatch(r'[0-9]{4}-(0[1-9]|1[0-2])', o.mois) or not re.fullmatch(r'[a-z]{2,20}', o.sorte):
        print('Mois ou sorte invalide.'); sys.exit(1)
    try:
        r, vu, arrets = preparer(o.conf, o.dossier, o.mois, o.historique, o.sorte, o.diagnostic, fenetre)
    except (OSError, ValueError, KeyError) as e:
        print('Erreur : ' + str(e)); sys.exit(1)
    if arrets:
        print('Arrêt (garde-fou) :')
        for a in arrets:
            print('  - ' + a)
        sys.exit(2)
    print('Facture lue : montant et date trouvés, émise dans le mois ; écart avec le mois d’avant : ' + vu.get('ecart', 'inconnu') + '.')
    print('Note prête : champs de la dépense remplis depuis le modèle.')


if __name__ == '__main__':
    main()
