/* Banc de l'écran de connexion (0.102.0) : node essais/jarvis-os-maquette/banc/ecran-verrou.cjs
   Sa demande du 28/11/2026 : « la pop-up de passkey s'affiche en bas, donc tout ce que tu écris en bas ne sert à rien ; le temps de se
   connecter, on ne voit rien ; il faut que les infos soient bien affichées, bien claires ».
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
      const o = new MutationObserver(() => { const e = document.getElementById('verrou-ecran'); if (e && !window.__vu) { window.__vu = {etat: e.dataset.etat, page: document.readyState}; } });
      o.observe(document, {childList: true, subtree: true});
    }, {passkey, relie, drapeau});
    const p = await ctx.newPage(); p.on('pageerror', () => {}); return {ctx, p};
  };
  const etat = (p, e, ms = 12000) => p.waitForFunction((x) => { const el = document.getElementById('verrou-ecran'); return !!el && el.dataset.etat === x; }, e, {timeout: ms}).then(() => true, () => false);
  const lu = (p, id = 'verrou-ecran') => p.evaluate((id) => { const e = document.getElementById(id); if (!e) return null; const H = innerHeight, bas = (s) => { const x = e.querySelector(s); if (!x) return null; const r = x.getBoundingClientRect(); return r.width && getComputedStyle(x).opacity !== '0' ? Math.round(r.bottom / H * 1000) / 10 : null; };
    return {etat: e.dataset.etat, titre: e.querySelector('.vx-etat').textContent, etapes: [...e.querySelectorAll('.vx-etape')].map((li) => (li.dataset.e || '-') + ' ' + li.querySelector('b').textContent + ' ' + li.querySelector('span').textContent).join(' | '),
      basEtapes: bas('.vx-etapes'), basBouton: bas('button'), basForm: bas('form'), bouton: (e.querySelector('button') || {}).textContent, msg: (e.querySelector('[role=status]') || {}).textContent, globe: !!e.querySelector('.vx-orbe canvas'), passkey: window.__passkey, vu: window.__vu || null,
      texte: e.textContent, haut: Math.round(e.querySelector('.vx-marque').getBoundingClientRect().top)}; }, id);
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
      ({ctx, p} = await neuf({w, h})); await p.goto(base + '/?serveur'); await etat(p, 'scan'); await p.waitForTimeout(300); x = await lu(p);
      ok('pendant Face ID, tout ce qui se lit tient dans la moitié haute de l’écran (' + nom + ', ' + w + '×' + h + ') : la feuille de la passkey couvre le bas', x && x.basEtapes !== null && x.basEtapes <= 52 && x.haut >= 10, JSON.stringify(x && [x.basEtapes, x.haut]));
      await ctx.close();
    }
    /* 3. Face ID refusé : « verrouillé », le bouton juste sous les étapes, un toucher redemande */
    ({ctx, p} = await neuf({passkey: 'refus'})); await p.goto(base + '/?serveur'); const at = await etat(p, 'attente'); await p.waitForTimeout(400); x = await lu(p);
    ok('Face ID annulé : « JARVIS est verrouillé », Identité « à confirmer », le bouton « Déverrouiller » juste sous les étapes (jamais en bas de l’écran), sans message d’erreur', at && x.titre === 'JARVIS est verrouillé' && /attend Identité à confirmer/.test(x.etapes) && x.bouton === 'Déverrouiller' && x.basBouton !== null && x.basBouton <= 62 && x.basBouton > x.basEtapes && !x.msg, JSON.stringify(x));
    const n0 = x.passkey; await p.click('#verrou-ouvrir'); await etat(p, 'scan', 3000); const n1 = (await lu(p)).passkey; await etat(p, 'attente'); x = await lu(p);
    ok('un toucher sur « Déverrouiller » redemande Face ID ; refusé à la main : le message le dit', n1 === n0 + 1 && x.etat === 'attente' && x.msg === 'Face ID annulé ou refusé.', JSON.stringify([n0, n1, x.msg]));
    await ctx.close();
    /* 4. preuve acceptée : la page se recharge, le MÊME écran revient tout de suite sur « Lecture de tes données… », et ne part qu'à la première donnée */
    Object.assign(E, {ouvert: false, donneesMs: 2200, appels: []});
    ({ctx, p} = await neuf({passkey: 'oui'})); await p.goto(base + '/?serveur'); await etat(p, 'scan');
    const ch = await p.waitForFunction(() => { const e = document.getElementById('verrou-ecran'); return !!e && e.dataset.etat === 'charge' && sessionStorage.getItem('jarvis.accueil') === null; }, null, {timeout: 15000}).then(() => true, () => false); x = await lu(p);
    ok('preuve acceptée : après le rechargement, l’écran est là avant l’app (posé pendant le chargement), sur « Lecture de tes données… », Serveur joint, Identité vérifiée, Données en cours ; Face ID n’est pas redemandé', ch && x.vu && x.vu.etat === 'charge' && x.vu.page === 'loading' && x.titre === 'Lecture de tes données…' && x.etapes === 'fait Serveur joint | fait Identité vérifiée | cours Données lecture…' && x.passkey === 0 && x.basBouton === null, JSON.stringify(x));
    await p.waitForTimeout(900); const encore = !!(await lu(p));
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
    ok('serveur injoignable : trois essais (le navigateur en refait parfois un de lui-même), puis « Le serveur ne répond pas », Serveur en échec, un bouton « Réessayer » dans la moitié haute ; Face ID n’est pas demandé', inj && essais >= 3 && essais <= 6 && x.titre === 'Le serveur ne répond pas' && /^rate Serveur ne répond pas/.test(x.etapes) && x.bouton === 'Réessayer' && x.basBouton !== null && x.basBouton <= 62 && x.passkey === 0, JSON.stringify([essais, x]));
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
    /* 8. appareil pas relié : la porte, le même visage, le formulaire dans la partie haute (le clavier couvre le bas) */
    ({ctx, p} = await neuf({relie: false, drapeau: false})); await p.goto(base + '/?serveur'); await p.waitForSelector('#porte-ecran', {timeout: 8000}); await p.waitForTimeout(300); x = await lu(p, 'porte-ecran');
    ok('appareil pas relié : la porte a le même visage (marque, globe, salut), et son champ de code tient dans la partie haute de l’écran', x && x.globe && x.titre === 'Cet appareil n’est pas relié à JARVIS' && x.bouton === 'Relier cet appareil' && x.basForm !== null && x.basForm <= 66 && !(await p.evaluate(() => document.getElementById('verrou-ecran'))), JSON.stringify(x && [x.titre, x.basForm, x.globe]));
    await ctx.close();
  } catch (e) { ok('exception', false, (e && e.stack) || e); }
  await b.close(); srv.close();
  console.log(res.join('\n')); console.log(ko ? 'ÉCHECS : ' + ko + ' (' + res.length + ' vérifications)' : 'Tout passe (' + res.length + ' vérifications).');
  process.exit(ko ? 1 : 0);
});
