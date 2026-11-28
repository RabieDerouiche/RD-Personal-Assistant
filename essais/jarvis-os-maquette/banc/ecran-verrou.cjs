/* Banc de l'écran de connexion (0.102.0, agencement de la 0.105.0) : node essais/jarvis-os-maquette/banc/ecran-verrou.cjs
   Sa demande du 28/11/2026 : « la pop-up de passkey s'affiche en bas, donc tout ce que tu écris en bas ne sert à rien ; le temps de se
   connecter, on ne voit rien ; il faut que les infos soient bien affichées, bien claires ».
   Son retour du 28/11 sur la 0.102.0, capture à l'appui : « trop en hauteur ; à la seconde où le passkey disparaît ça rend bizarre ; même avec
   le popup c'est trop vers le haut ; et c'est flouté en haut » : pendant Face ID le bloc se pose juste au-dessus de la feuille (bas des étapes
   à 56 %), le reste du temps il est au milieu de l'écran, il glisse de l'un à l'autre, et plus rien n'est écrit sous la barre d'état.
   Un faux serveur (verrou, données lentes, panne), une fausse passkey (acceptée, refusée, jamais rendue), trois tailles d'iPhone.
   Aucun vrai serveur, aucune vraie passkey. */
const http = require('http'), fs = require('fs'), path = require('path');
const {chromium} = require('playwright');
const ROOT = path.join(__dirname, '..');
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json'};
const res = []; let ko = 0;
const ok = (nom, cond, detail) => { if (!cond) ko++; res.push((cond ? 'OK    ' : 'ÉCHEC ') + nom + (cond || detail === undefined ? '' : ' :: ' + String(detail).slice(0, 600))); };
const E = {actif: true, ouvert: false, lentMs: 0, donneesMs: 0, panne: false, appels: []};
const srv = http.createServer((q, r) => {
  const p = q.url.split('?')[0];
  const json = (st, o, ms = 0) => setTimeout(() => { r.writeHead(st, {'content-type': 'application/json'}); r.end(JSON.stringify(o)); }, ms + E.lentMs);
  if (p.startsWith('/api/')) {
    E.appels.push(p);
    if (E.panne) { q.socket.destroy(); return; }
    if (!/^Bearer jeton-du-banc$/.test(q.headers.authorization || '')) return json(401, {error: 'Appareil non relié.'});
    if (p === '/api/verrou/retour' || p === '/api/verrou') return json(200, {actif: E.actif, ouvert: E.ouvert, delai: 60});
    if (p === '/api/verrou/defi') return json(200, {challenge: 'AAAA', rpId: 'localhost', allowCredentials: [{id: 'AQID'}], timeout: 60000});
    if (p === '/api/verrou/ouvrir') { E.ouvert = true; return json(200, {actif: true, ouvert: true}); }
    if (p === '/api/verrou/cache') { E.caches = (E.caches || 0) + 1; return json(200, {}); }   /* « l'app a quitté l'écran » : avec le délai « Tout de suite », le serveur reverrouille */
    if (p.startsWith('/api/verrou/')) return json(200, {});
    if (E.actif && !E.ouvert) return json(423, {verrou: true, error: 'Verrouillé.'});
    return json(200, {}, E.donneesMs);
  }
  let f = path.join(ROOT, decodeURIComponent(p)); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'}); r.end(d); });
});
srv.listen(0, async () => {
  const base = 'http://localhost:' + srv.address().port, b = await chromium.launch();
  /* une page neuve : `relie` (jeton dans le téléphone), `drapeau` (le verrou est connu actif), la passkey : 'oui' | 'refus' | 'jamais' */
  const neuf = async ({passkey = 'jamais', relie = true, drapeau = true, w = 430, h = 932} = {}) => {
    const ctx = await b.newContext({viewport: {width: w, height: h}, deviceScaleFactor: 1, isMobile: true, hasTouch: true});
    await ctx.addInitScript(({passkey, relie, drapeau}) => {
      try { if (!sessionStorage.getItem('banc.pose')) { sessionStorage.setItem('banc.pose', '1'); if (relie) localStorage.setItem('jarvis.settings', JSON.stringify({serverToken: 'jeton-du-banc'})); if (drapeau) localStorage.setItem('jarvis.verrou', '1'); } } catch (e) { /* rien */ }
      const buf = (n) => new Uint8Array(n).buffer; window.__passkey = 0;
      navigator.credentials.get = () => new Promise((oui, non) => { window.__passkey++; setTimeout(() => { if (passkey === 'refus') non(Object.assign(new Error('non'), {name: 'NotAllowedError'})); else if (passkey === 'oui') oui({rawId: buf(8), response: {clientDataJSON: buf(8), authenticatorData: buf(8), signature: buf(8)}}); }, passkey === 'jamais' ? 1e9 : 1200); });
      /* l'instant où l'écran paraît, et si la page avait fini de se charger */
      const o = new MutationObserver(() => { const e = document.getElementById('verrou-ecran'); if (e && !window.__vu) { const l = e.querySelector('.vx-etapes'); window.__vu = {etat: e.dataset.etat, page: document.readyState, bas: l ? Math.round(l.getBoundingClientRect().bottom / innerHeight * 1000) / 10 : null}; } });
      o.observe(document, {childList: true, subtree: true});
    }, {passkey, relie, drapeau});
    const p = await ctx.newPage(); p.on('pageerror', () => {}); return {ctx, p};
  };
  const etat = (p, e, ms = 12000) => p.waitForFunction((x) => { const el = document.getElementById('verrou-ecran'); return !!el && el.dataset.etat === x; }, e, {timeout: ms}).then(() => true, () => false);
  const lu = (p, id = 'verrou-ecran') => p.evaluate((id) => { const e = document.getElementById(id); if (!e) return null; const H = innerHeight, bas = (s) => { const x = e.querySelector(s); if (!x) return null; const r = x.getBoundingClientRect(); return r.width && getComputedStyle(x).opacity !== '0' ? Math.round(r.bottom / H * 1000) / 10 : null; };
    return {etat: e.dataset.etat, titre: e.querySelector('.vx-etat').textContent, etapes: [...e.querySelectorAll('.vx-etape')].map((li) => (li.dataset.e || '-') + ' ' + li.querySelector('b').textContent + ' ' + li.querySelector('span').textContent).join(' | '),
      basEtapes: bas('.vx-etapes'), basBouton: bas('button'), basForm: bas('form'), bouton: (e.querySelector('button') || {}).textContent, msg: (e.querySelector('[role=status]') || {}).textContent, globe: !!e.querySelector('.vx-orbe canvas'), passkey: window.__passkey, vu: window.__vu || null,
      texte: e.textContent, haut: Math.round(e.querySelector('.vx-orbe').getBoundingClientRect().top), marque: Math.round(e.querySelector('.vx-marque').getBoundingClientRect().top / H * 1000) / 10,
      milieu: (() => { const a = e.querySelector('.vx-orbe').getBoundingClientRect().top, l = e.querySelector('.vx-etapes') || e.querySelector('form'), b = (e.querySelector('button') && getComputedStyle(e.querySelector('button')).opacity !== '0' ? e.querySelector('button') : l).getBoundingClientRect().bottom; return Math.round((a + b) / 2 / H * 1000) / 10; })(),
      ecrits: [...e.querySelectorAll('.vx-marque,.vx-salut,.vx-date,.vx-etat,.vx-etape,button,input')].filter((n) => getComputedStyle(n).opacity !== '0').map((n) => Math.round(n.getBoundingClientRect().top)).sort((a, b) => a - b)[0]}; }, id);
  try {
    /* 1. lancement, verrou actif, serveur lent : l'écran d'abord, « connexion à ton serveur », avant la fin du chargement de la page */
    Object.assign(E, {actif: true, ouvert: false, lentMs: 2500, donneesMs: 0, panne: false, appels: []});
    let {ctx, p} = await neuf(); await p.goto(base + '/?serveur', {waitUntil: 'commit'}); await etat(p, 'lien', 6000); let x = await lu(p);
    ok('lancement, verrou actif : l’écran est posé tout de suite (avant la fin du chargement de la page), sur « Connexion à ton serveur… », Serveur en cours', x && x.vu && x.vu.etat === 'lien' && x.vu.page === 'loading' && x.titre === 'Connexion à ton serveur…' && /^cours Serveur connexion…/.test(x.etapes) && x.globe && x.passkey === 0, JSON.stringify(x && {vu: x.vu, titre: x.titre, etapes: x.etapes}));
    ok('rien de personnel sur l’écran (il se voit avant toute preuve) : la marque, le salut de l’heure, la date, les trois étapes', x && /^J\.A\.R\.V\.I\.S(Bonjour|Bon après-midi|Bonsoir)\.[a-zéû]+ \d{1,2} [a-zéû]+ · \d{2}:\d{2}Connexion à ton serveur…Serveurconnexion…IdentitéDonnéesDéverrouiller$/.test(x.texte), x && x.texte);
    /* 2. le serveur dit « verrouillé » : Face ID part seul, une fois ; tout tient dans la moitié haute */
    E.lentMs = 0; const sc = await etat(p, 'scan'); await p.waitForFunction(() => window.__passkey >= 1, null, {timeout: 9000}).catch(() => {}); await p.waitForTimeout(500); x = await lu(p);   /* la demande part 350 ms après l'écran ; machine chargée : on l'attend */
    ok('verrouillé : « Vérification de ton identité… », Serveur joint, Identité en cours (Face ID…), la passkey est demandée seule, une fois, le bouton est caché', sc && x.titre === 'Vérification de ton identité…' && x.etapes === 'fait Serveur joint | cours Identité Face ID… | - Données ' && x.passkey === 1 && x.basBouton === null, JSON.stringify(x));
    await ctx.close();
    for (const [w, h, nom] of [[430, 932, 'iPhone Pro Max'], [390, 844, 'iPhone'], [375, 667, 'petit iPhone'], [820, 1180, 'iPad']]) {
      ({ctx, p} = await neuf({w, h})); await p.goto(base + '/?serveur'); await etat(p, 'scan'); await p.waitForTimeout(1100); x = await lu(p);   /* le bloc finit de glisser */
      ok('pendant Face ID, le bloc est posé juste au-dessus de la feuille de la passkey (' + nom + ', ' + w + '×' + h + ') : le bas des étapes vers 56 % de la hauteur (ni collé en haut, ni sous la feuille), le globe dégagé de la barre d’état, rien d’écrit dans les 80 premiers points', x && x.basEtapes !== null && x.basEtapes >= 50 && x.basEtapes <= 58.5 && x.haut >= 34 && x.ecrits >= 80, JSON.stringify(x && [x.basEtapes, x.haut, x.ecrits]));
      await ctx.close();
    }
    /* 3. Face ID refusé : « verrouillé », le bouton juste sous les étapes, un toucher redemande */
    ({ctx, p} = await neuf({passkey: 'refus'})); await p.goto(base + '/?serveur'); const at = await etat(p, 'attente'); await p.waitForTimeout(400); x = await lu(p);
    ok('Face ID annulé : « JARVIS est verrouillé », Identité « à confirmer », le bouton « Déverrouiller » juste sous les étapes, sans message d’erreur', at && x.titre === 'JARVIS est verrouillé' && /attend Identité à confirmer/.test(x.etapes) && x.bouton === 'Déverrouiller' && x.basBouton !== null && x.basBouton <= 82 && x.basBouton > x.basEtapes && x.basBouton - x.basEtapes < 9 && !x.msg, JSON.stringify(x));
    await p.waitForTimeout(700); x = await lu(p);
    ok('la feuille de Face ID partie, le bloc revient au milieu de l’écran (globe, salut, étapes, bouton : leur milieu entre 40 et 52 % de la hauteur), la marque est en pied d’écran', x.milieu >= 40 && x.milieu <= 52 && x.marque >= 90, JSON.stringify([x.milieu, x.marque, x.haut, x.basBouton]));
    const n0 = x.passkey; await p.click('#verrou-ouvrir'); await etat(p, 'scan', 3000); await p.waitForTimeout(800); const y1 = await lu(p), n1 = y1.passkey; await etat(p, 'attente'); x = await lu(p);
    ok('un toucher sur « Déverrouiller » : le bloc remonte au-dessus de la feuille le temps de Face ID', y1.basEtapes >= 50 && y1.basEtapes <= 58.5, String(y1.basEtapes));
    ok('un toucher sur « Déverrouiller » redemande Face ID ; refusé à la main : le message le dit', n1 === n0 + 1 && x.etat === 'attente' && x.msg === 'Face ID annulé ou refusé.', JSON.stringify([n0, n1, x.msg]));
    await ctx.close();
    /* 4. preuve acceptée : la page se recharge, le MÊME écran revient tout de suite sur « Lecture de tes données… », et ne part qu'à la première donnée */
    Object.assign(E, {ouvert: false, donneesMs: 2200, appels: [], caches: 0});
    ({ctx, p} = await neuf({passkey: 'oui'})); await p.goto(base + '/?serveur'); await etat(p, 'scan');
    const ch = await p.waitForFunction(() => { const e = document.getElementById('verrou-ecran'); return !!e && e.dataset.etat === 'charge' && sessionStorage.getItem('jarvis.accueil') === null; }, null, {timeout: 15000}).then(() => true, () => false); x = await lu(p);
    ok('preuve acceptée : après le rechargement, l’écran est là avant l’app (posé pendant le chargement), sur « Lecture de tes données… », Serveur joint, Identité vérifiée, Données en cours ; Face ID n’est pas redemandé', ch && x.vu && x.vu.etat === 'charge' && x.vu.page === 'loading' && x.titre === 'Lecture de tes données…' && x.etapes === 'fait Serveur joint | fait Identité vérifiée | cours Données lecture…' && x.passkey === 0 && x.basBouton === null, JSON.stringify(x));
    await p.waitForTimeout(900); x = await lu(p);
    ok('à travers le rechargement, le bloc repart d’où il était pendant Face ID (bas des étapes vers 56 %) puis glisse au milieu de l’écran : pas de saut', x && x.vu && x.vu.bas >= 50 && x.vu.bas <= 58.5 && x.milieu >= 40 && x.milieu <= 52 && x.basEtapes > x.vu.bas + 6, JSON.stringify(x && [x.vu, x.milieu, x.basEtapes]));
    ok('le rechargement qui suit la preuve ne dit pas au serveur que l’app a quitté l’écran (avec le délai « Tout de suite », il reverrouillerait : Face ID en boucle)', !E.caches, String(E.caches || 0));
    const encore = !!(await lu(p));
    const parti = await p.waitForFunction(() => !document.getElementById('verrou-ecran'), null, {timeout: 9000}).then(() => true, () => false);
    ok('il reste tant qu’aucune donnée n’est lue, puis s’efface sur l’app (« Bienvenue. », fondu) ; l’app est dessous, entière', encore && parti && await p.evaluate(() => !!document.getElementById('tabs') && !document.getElementById('porte-ecran')), JSON.stringify([encore, parti]));
    await p.reload(); await p.waitForTimeout(1500);
    ok('un simple rechargement, session ouverte dans l’app : aucun écran d’accueil ne revient', !(await lu(p)) && !(await p.evaluate(() => window.__vu)));
    await ctx.close();
    /* 5. lancement, la session est encore ouverte côté serveur (revenu avant le délai) : connexion, lecture, app ; jamais Face ID */
    Object.assign(E, {ouvert: true, donneesMs: 900, lentMs: 300, appels: []});
    ({ctx, p} = await neuf()); await p.goto(base + '/?serveur', {waitUntil: 'commit'}); await etat(p, 'lien', 5000); const c5 = await etat(p, 'charge', 6000); x = await lu(p);
    const parti5 = await p.waitForFunction(() => !document.getElementById('verrou-ecran'), null, {timeout: 9000}).then(() => true, () => false);
    ok('lancement, session encore ouverte : « connexion », puis « Lecture de tes données… » (Identité : session ouverte), puis l’app ; Face ID n’est jamais demandé', c5 && x && /fait Identité session ouverte \| cours Données lecture…/.test(x.etapes) && parti5 && await p.evaluate(() => window.__passkey) === 0, JSON.stringify(x && x.etapes));
    await ctx.close();
    /* 6. le serveur ne répond pas : trois essais, puis c'est dit, avec « Réessayer » */
    Object.assign(E, {ouvert: false, lentMs: 0, panne: true, appels: []});
    ({ctx, p} = await neuf()); await p.goto(base + '/?serveur'); const inj = await etat(p, 'injoignable', 15000); await p.waitForTimeout(600); x = await lu(p);   /* le bouton arrive en fondu */
    const essais = E.appels.filter((a) => a === '/api/verrou/retour').length;
    ok('serveur injoignable : trois essais (le navigateur en refait parfois un de lui-même), puis « Le serveur ne répond pas », Serveur en échec, un bouton « Réessayer » juste sous les étapes, le bloc au milieu ; Face ID n’est pas demandé', inj && essais >= 3 && essais <= 6 && x.titre === 'Le serveur ne répond pas' && /^rate Serveur ne répond pas/.test(x.etapes) && x.bouton === 'Réessayer' && x.basBouton !== null && x.basBouton <= 82 && x.milieu >= 40 && x.milieu <= 52 && x.passkey === 0, JSON.stringify([essais, x]));
    E.panne = false; await p.click('#verrou-ouvrir'); const rep = await etat(p, 'scan', 9000);
    ok('« Réessayer » recharge la page : le serveur revenu, l’écran reprend (Face ID)', rep);
    await ctx.close();
    /* 7. verrou éteint : aucun écran ; verrou allumé depuis un autre appareil (pas encore connu ici) : l'écran vient à la première réponse */
    Object.assign(E, {actif: false, ouvert: false, appels: []});
    ({ctx, p} = await neuf({drapeau: false})); await p.goto(base + '/?serveur'); await p.waitForTimeout(1800);
    ok('verrou éteint : aucun écran d’accueil, l’app s’ouvre directement', !(await lu(p)) && await p.evaluate(() => !window.__vu && !!document.getElementById('tabs')));
    await ctx.close();
    Object.assign(E, {actif: true, ouvert: false});
    ({ctx, p} = await neuf({drapeau: false})); await p.goto(base + '/?serveur'); const tard = await etat(p, 'scan', 9000);
    ok('verrou actif mais pas encore connu de ce téléphone : l’écran vient dès la première réponse du serveur', tard);
    await ctx.close();
    /* 8. appareil pas relié : la porte, le même visage, au milieu ; le clavier ouvert (l'écran visible rétrécit), tout le formulaire reste visible */
    ({ctx, p} = await neuf({relie: false, drapeau: false, w: 390, h: 844})); await p.goto(base + '/?serveur'); await p.waitForSelector('#porte-ecran', {timeout: 8000}); await p.waitForTimeout(900); x = await lu(p, 'porte-ecran');
    ok('appareil pas relié : la porte a le même visage (marque, globe, salut), le bloc au milieu de l’écran', x && x.globe && x.titre === 'Cet appareil n’est pas relié à JARVIS' && x.bouton === 'Relier cet appareil' && x.basForm !== null && x.basForm <= 90 && x.haut >= 34 && !(await p.evaluate(() => document.getElementById('verrou-ecran'))), JSON.stringify(x && [x.titre, x.basForm, x.haut, x.globe]));
    await p.setViewportSize({width: 390, height: 508}); await p.waitForTimeout(900); x = await lu(p, 'porte-ecran');   /* 844 moins un clavier de 336 points */
    ok('clavier ouvert : le globe rapetisse, le champ du code et le bouton « Relier » restent au-dessus du clavier', x && x.basBouton !== null && x.basBouton <= 100 && x.haut >= 34, JSON.stringify(x && [x.basBouton, x.basForm, x.haut]));
    await ctx.close();
  } catch (e) { ok('exception', false, (e && e.stack) || e); }
  await b.close(); srv.close();
  console.log(res.join('\n')); console.log(ko ? 'ÉCHECS : ' + ko + ' (' + res.length + ' vérifications)' : 'Tout passe (' + res.length + ' vérifications).');
  process.exit(ko ? 1 : 0);
});
