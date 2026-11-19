"""Panier — planches contact et photos finales du catalogue de base (Pillow).
python3 planches.py [début fin]   : planches contact des candidates (dossier de travail PANIER_PHOTOS), 10 articles par planche.
python3 planches.py finales       : recadre en carré les photos choisies (hd/<id>.jpg), 400 px WebP dans courses/web/img/, écrit web/credits.json.
python3 planches.py revue         : planches des photos finales, pour un dernier coup d'œil.
Cadre d'une photo (choix-photos.json, « c3@haut ») : haut, bas, gauche, droite, ou zoom (« c3@zoom », « c3@haut+zoom »)."""
import json, os, sys, tempfile
from PIL import Image, ImageDraw, ImageFont, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.get('PANIER_PHOTOS') or os.path.join(tempfile.gettempdir(), 'panier-photos')
WEB = os.path.join(HERE, '..', 'web')
def police(t):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'):
        if os.path.exists(p): return ImageFont.truetype(p, t)
    return ImageFont.load_default()
def carre(im, cote, cadre=''):
    im = ImageOps.exif_transpose(im).convert('RGB'); w, h = im.size; c = min(w, h)
    if 'zoom' in cadre: c = int(c * 0.72)
    x, y = (w - c) // 2, (h - c) // 2
    if 'haut' in cadre: y = 0
    if 'bas' in cadre: y = h - c
    if 'gauche' in cadre: x = 0
    if 'droite' in cadre: x = w - c
    return im.crop((x, y, x + c, y + c)).resize((cote, cote), Image.LANCZOS)
def ids():
    out = []
    for l in open(os.path.join(HERE, 'catalogue.txt'), encoding='utf8'):
        l = l.strip()
        if l and not l.startswith('#') and l.count('|') >= 3: out.append(l.split('|')[0].strip().lstrip('*'))
    return out
def slug(s):
    import unicodedata, re
    s = unicodedata.normalize('NFD', s); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn').replace('œ', 'oe').replace('Œ', 'oe').lower()
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', s))
mode = sys.argv[1] if len(sys.argv) > 1 else ''
if mode == 'finales':
    cr = json.load(open(os.path.join(WORK, 'credits-travail.json'), encoding='utf8')); os.makedirs(os.path.join(WEB, 'img'), exist_ok=True)
    pub = {}; tot = 0
    if os.path.exists(os.path.join(WEB, 'credits.json')): pub = json.load(open(os.path.join(WEB, 'credits.json'), encoding='utf8'))
    for k, c in cr.items():
        src = os.path.join(WORK, 'hd', k + '.jpg')
        if not os.path.exists(src): continue
        out = os.path.join(WEB, 'img', k + '.webp'); carre(Image.open(src), 400, c.get('cadre', '')).save(out, 'WEBP', quality=78, method=6); tot += os.path.getsize(out)
        pub[k] = {'titre': c['titre'], 'auteur': c['auteur'], 'licence': c['licence'], 'page': c['page']}
    json.dump(pub, open(os.path.join(WEB, 'credits.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    print(len(cr), 'photos,', round(tot / 1024), 'Ko au total,', round(tot / 1024 / max(1, len(cr)), 1), 'Ko en moyenne')
elif mode == 'revue':
    noms = ids(); T = 150; cols = 8; f = police(13); os.makedirs(os.path.join(WORK, 'revue'), exist_ok=True)
    for p in range(0, len(noms), cols * 6):
        lot = noms[p:p + cols * 6]; sheet = Image.new('RGB', (cols * T, ((len(lot) + cols - 1) // cols) * (T + 20)), 'white'); d = ImageDraw.Draw(sheet)
        for i, n in enumerate(lot):
            x, y = (i % cols) * T, (i // cols) * (T + 20); src = os.path.join(WEB, 'img', slug(n) + '.webp')
            if os.path.exists(src): sheet.paste(Image.open(src).convert('RGB').resize((T - 4, T - 4)), (x + 2, y + 2))
            else: d.rectangle((x + 2, y + 2, x + T - 2, y + T - 2), fill='#f3c9c9')
            d.text((x + 4, y + T), n[:20], fill='black', font=f)
        sheet.save(os.path.join(WORK, 'revue', 'revue-%02d.jpg' % (p // (cols * 6))), quality=82)
    print('revue :', os.path.join(WORK, 'revue'))
else:
    cand = json.load(open(os.path.join(WORK, 'candidates.json'), encoding='utf8')); noms = [n for n in ids() if slug(n) in cand]
    if os.environ.get('PANIER_IDS'): noms = [n for n in noms if slug(n) in os.environ['PANIER_IDS'].split(',')]
    a, b = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (0, len(noms)); T = 124; L = 150; f = police(14); f2 = police(18)
    os.makedirs(os.path.join(WORK, 'planches'), exist_ok=True)
    for p in range(a, min(b, len(noms)), 10):
        lot = noms[p:p + 10]; sheet = Image.new('RGB', (L + 10 * T, len(lot) * T), 'white'); d = ImageDraw.Draw(sheet)
        for r, n in enumerate(lot):
            k = slug(n); d.text((4, r * T + 8), n[:17], fill='black', font=f); d.text((4, r * T + 30), '#%d' % (p + r), fill='#888', font=f)
            for c in range(len(cand[k])):
                src = os.path.join(WORK, 'v', '%s-%d.jpg' % (k, c))
                if not os.path.exists(src): continue
                try: sheet.paste(carre(Image.open(src), T - 4), (L + c * T + 2, r * T + 2))
                except Exception: continue
                d.rectangle((L + c * T + 2, r * T + 2, L + c * T + 26, r * T + 24), fill='black'); d.text((L + c * T + 6, r * T + 3), str(c), fill='#ffe14d' if cand[k][c].get('q') else 'white', font=f2)
        out = os.path.join(WORK, 'planches', 'planche-%03d.jpg' % (p // 10)); sheet.save(out, quality=80); print(out)
