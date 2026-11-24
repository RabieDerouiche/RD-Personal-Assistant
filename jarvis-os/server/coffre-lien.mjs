/* coffre-lien.mjs — le serveur de JARVIS parle au coffre en mémoire (jarvis-os/coffre/coffre.mjs) par sa prise de service.
 *
 * 0.74.0 (24/11/2026, son choix « Tout dans NordPass ») : après un redémarrage, il ouvre le coffre depuis l'app. La page scelle la phrase
 * pour le coffre seul (sceller.mjs) ; ce module ne fait que passer le paquet {epk, iv, ct} : JARVIS ne voit jamais la phrase, ne garde
 * rien, ne journalise rien de ce qui passe ici. Une ligne JSON par demande, une ligne en réponse.
 * Coffre pas installé, prise absente ou muette : `etat()` rend {installe: false}, sans erreur ni journal (c'est le cas tant qu'il ne
 * l'a pas installé) ; le reste de JARVIS n'en dépend pas. */
import net from 'node:net';

const B64U = /^[A-Za-z0-9_-]+$/;
export function createCoffreLien({prise, delai = 8000, delaiOuvrir = 30000}) {
  const appel = (demande, attente = delai) => new Promise((resolve) => {
    let recu = Buffer.alloc(0), fini = false, c = null;
    const rendre = (r) => { if (fini) return; fini = true; try { c.destroy(); } catch { /* déjà fermée */ } resolve(r); };
    try { c = net.createConnection(prise); } catch { return resolve(null); }
    c.setTimeout(attente, () => rendre(null));
    c.on('error', () => rendre(null));
    c.on('connect', () => c.write(JSON.stringify(demande) + '\n'));
    c.on('data', (b) => {
      recu = Buffer.concat([recu, b]);
      const i = recu.indexOf(10);
      if (i < 0) { if (recu.length > 262144) rendre(null); return; }
      let r = null; try { r = JSON.parse(recu.subarray(0, i).toString('utf8')); } catch { r = null; }
      rendre(r && typeof r === 'object' && !Array.isArray(r) ? r : null);
    });
    c.on('close', () => rendre(null));
  });
  /* ce que l'app a le droit de savoir : jamais le nom ni la valeur d'un secret, seulement leur nombre */
  const etat = async () => {
    const r = await appel({commande: 'etat'});
    if (!r || r.ok !== true) return {installe: false};
    return {installe: true, existe: !!r.existe, ouvert: !!r.ouvert, depuis: r.ouvert && typeof r.depuis === 'string' ? r.depuis : null,
      secrets: Array.isArray(r.secrets) ? r.secrets.length : 0, bloque: Number.isFinite(r.bloque) && r.bloque > 0 ? Math.ceil(r.bloque) : 0};
  };
  return {
    etat,
    /* la clé publique du coffre et un défi à usage unique (2 minutes) : rien de secret */
    async cle() {
      const r = await appel({commande: 'cle-ouverture'});
      return r && r.ok === true && typeof r.cle === 'string' && typeof r.defi === 'string' ? {cle: r.cle, defi: r.defi, expire: r.expire || 0} : null;
    },
    /* le paquet scellé par la page : forme et taille vérifiées ici, le reste par le coffre (qui rend la même réponse à tout refus) */
    async ouvrir(b) {
      const ok = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max && B64U.test(s);
      if (!b || !ok(b.epk, 100) || !ok(b.iv, 24) || !ok(b.ct, 6000)) return {ok: false, forme: true};
      const r = await appel({commande: 'ouvrir-scelle', epk: b.epk, iv: b.iv, ct: b.ct}, delaiOuvrir);
      if (!r) return {ok: false, absent: true};
      return {ok: r.ok === true};
    },
    async fermer() { const r = await appel({commande: 'fermer'}); return !!(r && r.ok === true); },
  };
}
