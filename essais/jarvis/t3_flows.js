/* Chaque geste de la page, et ce qu'il écrit vraiment par les connecteurs. */
const L = require('./lib');
const file = process.argv[2] || 'jarvis.html', only = process.argv[3] || '';
const T = '2026-11-14T22:00:00+01:00';
const short = (c) => c.tool + ' ' + JSON.stringify(c.input).replace(/1kIu7U1X28RCVO_SAF2l9IMt9QWiOWbGWcRX5bV1-7z0/, 'SHEET').replace(/e8c30d28[^"]+/, 'PRESENCE').slice(0, 330);
const results = [];
async function scen(name, opts, fn) {
  if (only && !name.startsWith(only)) return;
  const h = await L.open(Object.assign({file, time: T}, opts));
  let seen = 0;
  const step = async (label, run, wait) => {
    let note = '';
    try { note = (await run()) || ''; } catch (e) { note = 'EXCEPTION ' + e.message; }
    await L.tick(h, wait == null ? 6500 : wait);
    const w = await L.writes(h), fresh = w.slice(seen); seen = w.length;
    const t = await L.toasts(h);
    results.push({scen: name, step: label, note, writes: fresh.map(short), toasts: t.map((x) => x.slice(0, 260)), errors: h.errors.splice(0)});
    await h.page.evaluate(() => { document.querySelectorAll('.toast').forEach((x) => x.remove()); });
  };
  try { await fn(h, step); } catch (e) { results.push({scen: name, step: 'ARRET', note: String(e && e.message)}); }
  await h.browser.close();
}
const card = (h, title, btn) => h.page.evaluate(({title, btn}) => {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const cards = Array.from(document.querySelectorAll('#view article, #view .sor, #view .fam, #view .voy')).filter((a) => a.getClientRects().length && norm(a.innerText).includes(title));
  for (const c of cards) { const b = Array.from(c.querySelectorAll('button, a.btn')).find((x) => norm(x.innerText).startsWith(btn)); if (b) { b.click(); return 'ok'; } }
  return cards.length ? 'bouton absent : ' + btn : 'carte absente : ' + title;
}, {title, btn});
const sheetTxt = (h) => L.text(h, '#sheet').then((t) => (t || '').replace(/\n+/g, ' | ').slice(0, 400));
const fill = async (h, sel, val) => { await h.page.fill(sel, val); };

(async () => {
  await scen('A pause auto', {}, async (h, step) => {
    await step('en-tête après chargement', async () => (await L.text(h, '#status')).replace(/\n/g, ' · '), 0);
    await L.tab(h, 'demandes');
    await step('demande Oui/Non : Oui, vas-y', async () => card(h, 'CRA Allegis', 'Oui, vas-y'));
    await step('demande Choix puis Annuler', async () => { const r = await card(h, 'Robot cuiseur', 'Grande enseigne'); await L.tick(h, 800); const c = await L.click(h, 'Annuler', '#toasts, #sheet'); return r + ' / annuler ' + c; });
    await step('double appui sur la même réponse', async () => { const a = await card(h, 'Dates du voyage', 'Cherche toi-même'); await L.tick(h, 400); await h.page.evaluate(() => { const s = document.getElementById('sheet'); if (!s.hidden) Array.from(s.querySelectorAll('button')).find((b) => /Terminé|Fermer/.test(b.innerText)).click(); }); await L.tick(h, 300); return a; });
    await step('brouillon Gmail : relire, envoyer', async () => { const a = await card(h, 'Bonjour, Je me permets', 'Relire et envoyer'); await L.tick(h, 500); const s1 = await sheetTxt(h); const b = await L.click(h, 'Envoyer ce mail', '#sheet'); const s2 = await sheetTxt(h); const c = await L.click(h, 'Oui : envoyer ce mail', '#sheet'); return [a, b, c, 'FEUILLE: ' + s1.slice(0, 200), 'CONFIRME: ' + s2.slice(0, 260)].join(' / '); });
    await step('brouillon en texte (À / Objet / Texte) : envoyer', async () => { const a = await card(h, 'Attestation', 'Envoyer ce mail'); await L.tick(h, 500); const s = await sheetTxt(h); const c = await L.click(h, 'Oui : envoyer ce mail', '#sheet'); return [a, c, 'CONFIRME: ' + s.slice(0, 260)].join(' / '); });
    await step('brouillon sans destinataire : supprimer', async () => { const a = await card(h, 'Texte sans destinataire', 'Supprimer'); await L.tick(h, 500); const s = await sheetTxt(h); const c = await L.click(h, 'Oui : supprimer ce brouillon', '#sheet'); return [a, c, s.slice(0, 200)].join(' / '); });
    await step('oui groupés : copier', async () => card(h, 'Un seul message à Argus', 'Copier'), 600);
    await step('donner mon oui (une demande)', async () => { const a = await card(h, 'appliquer les 3 routines', 'Donner mon oui'); await L.tick(h, 900); return a + ' / ' + (await sheetTxt(h)).slice(0, 300); }, 300);
    await L.tab(h, 'accueil');
    await step('mail : Rien à faire', async () => h.page.evaluate(() => { const li = Array.from(document.querySelectorAll('.live-mail li')).find((x) => /Votre commande/.test(x.innerText)); if (!li) return 'absent'; li.querySelector('.btn.ghost').click(); return 'ok'; }));
    await step('mail : Pour Iris', async () => h.page.evaluate(() => { const li = Array.from(document.querySelectorAll('.live-mail li')).find((x) => /Réunion parents/.test(x.innerText)); if (!li) return 'absent'; li.querySelector('.btn').click(); return 'ok'; }));
    await step('réponse sur un dossier : lire, mettre à jour et prévenir Iris', async () => { const a = await card(h, 'Dégât des eaux', 'Lire et proposer la suite'); await L.tick(h, 1200); const s = await sheetTxt(h); const b = await L.click(h, 'Mettre à jour et prévenir Iris', '#sheet'); return [a, b, s].join(' / '); });
    await step('échéance : C\'est fait', async () => card(h, "Envoyer l'attestation à l'école", "C'est fait"));
    await step('Claude : barre de commande, ordre proposé, envoyé', async () => { await fill(h, '.intent-input', 'Prépare la relance du syndic'); await h.page.keyboard.press('Enter'); await L.tick(h, 1200); const t = (await L.text(h, '#chat')).replace(/\n+/g, ' | ').slice(0, 420); const b = await L.click(h, 'Envoyer à Iris', '#chat'); await L.tick(h, 300); await L.click(h, '', '#chat .chat-head'); return b + ' / ' + t; });
    await L.tab(h, 'agenda');
    await step('nouvelle tâche', async () => { const a = await L.click(h, 'Nouvelle tâche'); await L.tick(h, 500); await fill(h, '#sheet input[type=text]', 'Acheter des piles'); await h.page.evaluate(() => document.querySelector('#sheet form').requestSubmit()); return a; });
    await step('événement important avec heure', async () => { const a = await L.click(h, 'Nouvel événement important'); await L.tick(h, 500); await fill(h, '#sheet input[type=text]', 'Rendez-vous banque'); await fill(h, '#sheet input[type=time]', '10:30'); await h.page.evaluate(() => document.querySelector('#sheet form').requestSubmit()); return a; });
    await step('présence : un jour en télétravail', async () => { const a = await h.page.evaluate(() => { const d = Array.from(document.querySelectorAll('.mg-d')).find((x) => x.querySelector('.mg-n') && x.querySelector('.mg-n').textContent === '18'); if (!d) return 'jour absent'; d.click(); return 'ok'; }); await L.tick(h, 500); const b = await L.click(h, 'Télétravail', '#sheet'); return a + ' / ' + b; });
    await step('présence : retirer un jour noté', async () => { const a = await h.page.evaluate(() => { const d = Array.from(document.querySelectorAll('.mg-d')).find((x) => x.querySelector('.mg-n') && x.querySelector('.mg-n').textContent === '13'); if (!d) return 'jour absent'; d.click(); return 'ok'; }); await L.tick(h, 500); const b = await L.click(h, 'Retirer', '#sheet'); return a + ' / ' + b; });
    await L.tab(h, 'achats');
    await step('achat : changer le seuil', async () => { const a = await card(h, 'Jeu Gamma PS5 Standard', ''); await L.tick(h, 500); const b = await L.click(h, 'Changer mon seuil Achat'); await L.tick(h, 400); await fill(h, '#sheet input[type=number]', '65'); await h.page.evaluate(() => document.querySelector('#sheet form').requestSubmit()); return a + ' / ' + b; });
    await step('achat : mettre en pause', async () => { await L.click(h, 'Terminé', '#sheet'); const b = await L.click(h, 'Mettre en pause'); await L.tick(h, 400); const c = await L.click(h, "Jusqu'au Black Friday", '#sheet'); return b + ' / ' + c; });
    await L.tab(h, 'voyages');
    await step('voyage : choisir une option', async () => { const a = await card(h, 'Lisbonne', ''); await L.tick(h, 500); const b = await card(h, 'TAP 10h05', 'Choisir'); return a + ' / ' + b; });
    await L.tab(h, 'sorties');
    await step('sortie : faite', async () => { const a = await card(h, 'Ferme pédagogique', ''); await L.tick(h, 500); const b = await L.click(h, "C'est fait", '#sheet'); return a + ' / ' + b; });
    await step('sortie : demander des idées', async () => L.click(h, 'Pour ce week-end'));
    await L.tab(h, 'suivi');
    await step('tâche faite', async () => card(h, 'Appeler le plombier', "C'est fait"));
    await step('clore un dossier', async () => { const a = await card(h, 'Facture sans TVA', 'Plus'); await L.tick(h, 500); const b = await L.click(h, 'Clore le dossier', '#sheet'); await L.tick(h, 300); const c = await L.click(h, 'Oui : clore le dossier', '#sheet'); return [a, b, c].join(' / '); });
    await step('Pour Claude : répond ici, écrit la réponse', async () => { const a = await card(h, 'Question technique', 'Claude répond ici'); await L.tick(h, 900); const s = await sheetTxt(h); const b = await L.click(h, 'Écrire cette réponse', '#sheet'); return [a, b, s.slice(0, 220)].join(' / '); });
    await step('file d\'attente pendant la pause', async () => (await L.text(h)).split('\n').filter((x) => /File d'attente|ligne|Sonnette|relais|passage/.test(x)).slice(0, 14).join(' | '), 0);
    await step('Grok est reparti : confirmer, sonner', async () => { await L.tab(h, 'accueil'); const a = await L.click(h, 'Grok est reparti'); await L.tick(h, 500); const s = await sheetTxt(h); const b = await L.click(h, 'Oui, Grok répond', '#sheet'); return [a, b, s.slice(0, 330)].join(' / '); }, 7000);
    await step('après la reprise : en-tête et stockage', async () => { await L.tick(h, 500); return (await L.text(h, '#status')).replace(/\n/g, ' · ') + ' // ' + (await h.page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k).slice(0, 90)]))))); }, 0);
  });

  await scen('B bots actifs, sonnette propre à Kairos', {scen: {active: true, bells: true}}, async (h, step) => {
    await step('en-tête', async () => (await L.text(h, '#demo')) + ' // ' + (await L.text(h, '#status')).replace(/\n/g, ' · '), 0);
    await L.tab(h, 'achats');
    await step('ordre à Kairos : vérifier le prix', async () => card(h, 'Robot Alpha X7', 'Vérifier le prix maintenant'), 6500);
    await step('la sonnette part 10 s après', async () => (await L.text(h, '#demo')), 11000);
    await step('même ordre une 2e fois (moins de 90 s)', async () => card(h, 'Robot Alpha X7', 'Vérifier le prix maintenant'), 6500);
    await step('le bot répond : relecture à 30 s', async () => { await h.page.evaluate(() => { const g = window.__G['Canal']; const r = g[g.length - 1]; r[5] = 'Fait'; r[6] = 'Prix inchangé : 1 449 €.'; }); return 'réponse simulée'; }, 34000);
    await L.tab(h, 'demandes');
    await step('demande à Iris (relais par sa sonnette)', async () => card(h, 'Passeport', "C'est fait"), 17500);
    await L.tab(h, 'suivi');
    await step('file d\'attente : sonner Ulysse (relais)', async () => { const a = await card(h, 'Ulysse', 'Sonner Ulysse'); await L.tick(h, 500); const s = await sheetTxt(h); const b = await L.click(h, 'Oui, sonner Ulysse', '#sheet'); return [a, b, s.slice(0, 330)].join(' / '); }, 7000);
    await step('oui : lien Grok', async () => { await L.tab(h, 'demandes'); return h.page.evaluate(() => { const c = Array.from(document.querySelectorAll('#view article')).find((a) => /Un seul message à Argus/.test(a.innerText)); return c ? c.querySelector('.row-actions').innerText.replace(/\n/g, ' ') : 'absent'; }); }, 0);
  });

  await scen('C pause notée dans Faits (future)', {scen: {pauseUntil: '17/11/2026 12h00'}}, async (h, step) => {
    await step('bandeau', async () => (await L.text(h, '#status')).replace(/\n/g, ' · ') + ' // ' + ((await L.text(h)).match(/Grok Bot est en pause[\s\S]{0,220}/) || [''])[0].replace(/\n/g, ' | '), 0);
    await step('changer la date de reprise', async () => { const a = await L.click(h, 'Changer la date'); await L.tick(h, 500); await fill(h, '#sheet input[type=date]', '2026-11-18'); await h.page.evaluate(() => document.querySelector('#sheet form').requestSubmit()); return a; });
  });

  await scen('D pause finie : reprise sonnée seule', {scen: {pauseUntil: '17/11/2026 12h00', active: true}, time: '2026-11-17T12:30:00+01:00'}, async (h, step) => {
    await step('5 s après l\'ouverture', async () => (await L.text(h, '#status')).replace(/\n/g, ' · '), 7000);
  });
  await scen('D2 pause finie mais bots toujours muets', {scen: {pauseUntil: '17/11/2026 12h00'}, time: '2026-11-17T12:30:00+01:00'}, async (h, step) => {
    await step('5 s après l\'ouverture', async () => (await L.text(h, '#status')).replace(/\n/g, ' · ') + ' // ' + ((await L.text(h)).match(/Grok Bot est en pause[\s\S]{0,160}/) || ['pas de bandeau'])[0].replace(/\n/g, ' | '), 7000);
  });
  await scen('E hors liaison', {scen: {offline: true}}, async (h, step) => {
    await step('en-tête', async () => (await L.text(h, '#demo')) + ' // ' + (await L.text(h)).slice(0, 160).replace(/\n/g, ' | '), 0);
    await step('bandeau sans liaison et pied de page', async () => (await L.text(h, '.nolink-b') || 'BANDEAU ABSENT').replace(/\n+/g, ' | ').slice(0, 330) + ' // ' + (await L.text(h, '.ver-foot') || 'PIED ABSENT') + ' // débordement : ' + JSON.stringify((await L.overflow(h)).wide), 0);
  });
  await scen('V version visible en direct', {scen: {active: true}}, async (h, step) => {
    await step('pied de page, pas de bandeau', async () => (await L.text(h, '.ver-foot') || 'PIED ABSENT') + ' // bandeau : ' + ((await L.text(h, '.nolink-b')) ? 'PRÉSENT À TORT' : 'absent') + ' // ' + (await L.text(h, '#demo')), 0);
  });
  await scen('F écriture refusée', {scen: {fail: {update_values: 'needs_reauth'}}}, async (h, step) => {
    await L.tab(h, 'suivi');
    await step('tâche faite refusée', async () => card(h, 'Appeler le plombier', "C'est fait"));
  });
  await scen('G sans describeTool', {scen: {noDescribe: true}}, async (h, step) => {
    await step('mail : Rien à faire', async () => h.page.evaluate(() => { const li = Array.from(document.querySelectorAll('.live-mail li')).find((x) => /Votre commande/.test(x.innerText)); if (!li) return 'absent'; li.querySelector('.btn.ghost').click(); return 'ok'; }));
  });

  const DUE = new Date('2026-11-17T12:00:00+01:00').getTime();
  const ban = async (h) => (await L.text(h, '#status')).replace(/\n/g, ' · ') + ' // ' + ((await L.text(h)).match(/Grok Bot est en pause[\s\S]{0,330}/) || ['pas de bandeau'])[0].replace(/\n+/g, ' | ');
  await scen('H1 pause repérée seule, avant la remise à zéro', {time: '2026-11-17T11:00:00+01:00'}, async (h, step) => { await step('bandeau', () => ban(h), 7000); });
  await scen('H2 pause repérée seule, remise à zéro passée', {time: '2026-11-17T12:30:00+01:00'}, async (h, step) => {
    await step('à l\'ouverture', () => ban(h), 0);
    await step('5 s après', async () => '', 7000);
    await step('ensuite', async () => (await ban(h)) + ' // ' + (await h.page.evaluate(() => JSON.stringify([localStorage.getItem('jarvis.pause.rung'), !!localStorage.getItem('jarvis.pause.off')]))), 0);
    await L.tab(h, 'demandes');
    await step('un ordre sonne de nouveau normalement', async () => card(h, 'CRA Allegis', 'Oui, vas-y'), 17500);
  });
  await scen('H3 remise à zéro passée, annulée par Rabie', {time: '2026-11-17T12:30:00+01:00'}, async (h, step) => {
    await step('annuler dans les 5 s', async () => { await L.tick(h, 1000); return L.click(h, 'Annuler', '#toasts'); }, 7000);
    await step('ensuite', () => ban(h), 0);
  });
  await scen('H4 sonnés à la remise à zéro, toujours muets 3 h après', {time: '2026-11-17T15:40:00+01:00', storage: {'jarvis.pause.rung': DUE, 'jarvis.pause.off': DUE + 1800000}}, async (h, step) => { await step('bandeau', () => ban(h), 7000); });
  await scen('H5 sonnés à la remise à zéro, 1 h après', {time: '2026-11-17T13:30:00+01:00', storage: {'jarvis.pause.rung': DUE, 'jarvis.pause.off': DUE + 1800000}}, async (h, step) => { await step('bandeau', () => ban(h), 7000); });
  await scen('I sonnette propre et réponse du bot', {scen: {active: true, bells: true}}, async (h, step) => {
    await L.tab(h, 'achats');
    await step('ordre', async () => card(h, 'Robot Alpha X7', 'Vérifier le prix maintenant'), 12000);
    await step('réponse du bot, relecture', async () => { await h.page.evaluate(() => { const g = window.__G['Canal']; const r = g[g.length - 1]; r[5] = 'Fait'; r[6] = 'Prix inchangé : 1 449 €.'; }); await L.tick(h, 28500); return (await L.text(h, '#demo')) + ' // ' + (await L.toasts(h)).join(' ## '); }, 0);
  });
  await scen('J glisser une sortie', {}, async (h, step) => {
    await L.tab(h, 'sorties');
    await step('glisser à droite', async () => { const box = await h.page.evaluate(() => { const c = Array.from(document.querySelectorAll('.sor')).find((x) => /Marché de Noël/.test(x.innerText)); c.scrollIntoView({block: 'center'}); const r = c.getBoundingClientRect(); return {x: r.left + 40, y: r.top + r.height / 2}; }); await h.page.mouse.move(box.x, box.y); await h.page.mouse.down(); for (let i = 1; i <= 12; i++) { await h.page.mouse.move(box.x + i * 18, box.y); } await h.page.mouse.up(); return 'glissé'; });
  });
  await scen('K page d\'un bot et dépôt', {}, async (h, step) => {
    await L.tab(h, 'equipe');
    await step('dépôt de document', async () => { const t = (await L.text(h)).match(/Déposer un document[\s\S]{0,420}/); const a = await L.click(h, "Iris range ce que j'ai déposé"); return a + ' // ' + (t ? t[0].replace(/\n+/g, ' | ') : 'absent'); });
    await step('page de Kairos', async () => { await h.page.evaluate(() => { const b = Array.from(document.querySelectorAll('.mate')).find((x) => /Kairos/.test(x.innerText)); b.click(); }); await L.tick(h, 600); return (await L.text(h)).replace(/\n+/g, ' | ').slice(0, 520); }, 0);
    await step('commande rapide', async () => L.click(h, 'Vérifie mes prix maintenant'));
  });
  /* la voix : « Écouter » sur une réponse de Claude, selon ce que la vue permet */
  const ask = async (h) => { await L.tab(h, 'accueil'); await fill(h, '.intent-input', 'Que dois-je faire en premier ?'); await h.page.keyboard.press('Enter'); await L.tick(h, 1500); };
  const voice = async (h) => { const a = await L.click(h, 'Écouter', '#chat'); await L.tick(h, 150); const mid = await h.page.evaluate(() => (document.querySelector('#chat .vox-btn') || {}).innerText || 'bouton absent'); const said = (await L.toasts(h)).join(' + '); await L.tick(h, 6500); const end = await h.page.evaluate(() => (document.querySelector('#chat .vox-btn') || {}).innerText || 'bouton absent'); return a + ' // pendant : ' + mid.trim() + ' // après : ' + end.trim() + ' // message : ' + (said || 'aucun') + ' // ' + JSON.stringify(await h.page.evaluate(() => window.__voice)).slice(0, 330); };
  await scen('X1 voix de Claude disponible (ordinateur)', {scen: {active: true, tts: 'ok', synth: 'ok'}}, async (h, step) => { await ask(h); await step('écouter', () => voice(h), 0); });
  await scen('X2 voix du téléphone seulement', {scen: {active: true, synth: 'ok'}}, async (h, step) => { await ask(h); await step('écouter', () => voice(h), 0); });
  await scen('X3 voix de Claude refusée, repli sur le téléphone', {scen: {active: true, tts: 'refuse', synth: 'ok'}}, async (h, step) => { await ask(h); await step('écouter', () => voice(h), 0); });
  await scen('X4 la voix du téléphone ne démarre pas', {scen: {active: true, synth: 'muet'}}, async (h, step) => { await ask(h); await step('écouter', () => voice(h), 0); });
  await scen('X5 aucune voix dans la vue', {scen: {active: true, synth: 'absent'}}, async (h, step) => { await ask(h); await step('écouter', () => voice(h), 0); });
  /* le choix de la voix du téléphone : la meilleure d'abord, le choix est retenu */
  const voxState = (h) => h.page.evaluate(() => { const p = document.querySelector('#chat .vox-panel'); if (!p) return 'panneau absent'; return (p.querySelector('.vox-head') || {}).innerText.replace(/\s+/g, ' ').trim() + ' // ' + Array.from(p.querySelectorAll('.vox-row')).map((r) => r.innerText.replace(/\s+/g, ' ').trim()).join(' ; ') + ' // retenu : ' + localStorage.getItem('jarvis.voix') + ' // lu : ' + JSON.stringify(window.__voice.filter((x) => /^tel:fr/.test(x))).slice(0, 260); });
  await scen('Y1 choix de la voix, plusieurs voix françaises', {scen: {active: true, synth: 'ok'}}, async (h, step) => {
    await ask(h);
    await step('la meilleure voix par défaut', async () => { const a = await L.click(h, 'Voix :', '#chat'); return a + ' // ' + await voxState(h) + ' // débordement : ' + JSON.stringify(await h.page.evaluate(() => Array.from(document.querySelectorAll('#chat *')).filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length)); }, 0);
    await step('essayer et choisir une autre voix', async () => { const a = await h.page.evaluate(() => { const r = Array.from(document.querySelectorAll('#chat .vox-row')).find((x) => /Audrey/.test(x.innerText)); if (!r) return 'absente'; r.click(); return 'ok'; }); await L.tick(h, 1200); return a + ' // ' + await voxState(h); }, 0);
    await step('« Écouter » se sert de la voix choisie', async () => { await h.page.evaluate(() => { window.__voice.length = 0; }); const a = await L.click(h, 'Écouter', '#chat'); await L.tick(h, 800); return a + ' // ' + JSON.stringify(await h.page.evaluate(() => window.__voice)).slice(0, 200); }, 0);
  });
  await scen('Y2 choix de la voix, seulement la voix de base', {scen: {active: true, synth: 'ok', voices: 'base'}}, async (h, step) => { await ask(h); await step('panneau', async () => { const a = await L.click(h, 'Voix :', '#chat'); return a + ' // ' + await voxState(h); }, 0); });
  await scen('Y3 voix de Claude disponible : pas de choix à faire', {scen: {active: true, tts: 'ok', synth: 'ok'}}, async (h, step) => { await ask(h); await step('panneau', () => voxState(h), 0); });
  /* le mode conversation : hologramme, sous-titres, réponse lue toute seule, retour au fil */
  const stage = (h) => h.page.evaluate(() => { const c = document.getElementById('chat'), st = c.querySelector('.talk-stage'); if (!st) return 'scène absente // fil : ' + (c.querySelector('.chat-log') ? c.querySelectorAll('.chat-log .msg').length + ' messages' : 'absent'); const t = (q) => ((st.querySelector(q) || {}).innerText || '').replace(/\s+/g, ' ').trim(); return 'état : ' + t('.talk-state') + ' // question : ' + t('.talk-q') + ' // sous-titres : ' + t('.talk-sub').slice(0, 90) + ' // hologramme : ' + (st.querySelector('.talk-av canvas') ? Math.round(st.querySelector('.talk-av .chr').getBoundingClientRect().width) + ' px' : 'absent') + ' // bouton : ' + t('.talk-play') + ' // relances : ' + st.querySelectorAll('.talk-next button').length + ' // bascule : ' + ((c.querySelector('.talk-toggle') || {}).innerText || '').trim(); });
  const spoken = (h) => h.page.evaluate(() => JSON.stringify(window.__voice.filter((x) => !/cancel|stop/.test(x))).slice(0, 300));
  const sayIt = async (h, q) => { await fill(h, '#chat-in', q); await h.page.keyboard.press('Enter'); };
  await scen('Z1 conversation, voix du téléphone', {scen: {active: true, synth: 'ok'}}, async (h, step) => {
    await L.tab(h, 'accueil');
    await step('« Parler » ouvre la scène', async () => { const a = await L.click(h, 'Parler'); await L.tick(h, 600); return a + ' // ' + await stage(h) + ' // débordement : ' + (await h.page.evaluate(() => Array.from(document.querySelectorAll('#chat .talk-stage *')).filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length)); }, 0);
    await step('question : pendant la lecture', async () => { await sayIt(h, 'Que dois-je faire en premier ?'); await L.tick(h, 260); return await stage(h); }, 0);
    await step('réponse lue toute seule', async () => { await L.tick(h, 1500); return await stage(h) + ' // lu : ' + await spoken(h); }, 0);
    await step('après la lecture', async () => { await L.tick(h, 3000); return await stage(h); }, 0);
    await step('relance touchée : nouvelle question, nouvelle lecture', async () => { await h.page.evaluate(() => { window.__voice.length = 0; const b = document.querySelector('#chat .talk-next button'); if (b) b.click(); }); await L.tick(h, 2500); return await stage(h) + ' // lu : ' + await spoken(h); }, 0);
    await step('retour au fil', async () => { const a = await L.click(h, 'Fil', '#chat'); return a + ' // ' + await stage(h); }, 0);
  });
  await scen('Z2 conversation, voix de Claude (ordinateur)', {scen: {active: true, tts: 'ok', synth: 'ok'}}, async (h, step) => {
    await L.tab(h, 'accueil'); await L.click(h, 'Parler'); await L.tick(h, 600);
    await step('réponse lue par la voix de Claude', async () => { await sayIt(h, 'Prépare ma semaine'); await L.tick(h, 2500); return await stage(h) + ' // lu : ' + await h.page.evaluate(() => JSON.stringify(window.__voice).slice(0, 200)); }, 0);
  });
  await scen('Z3 conversation, la voix ne démarre pas', {scen: {active: true, synth: 'muet'}}, async (h, step) => {
    await L.tab(h, 'accueil'); await L.click(h, 'Parler'); await L.tick(h, 600);
    await step('la réponse reste lisible, « Réécouter » proposé', async () => { await sayIt(h, 'Qui est en retard ?'); await L.tick(h, 7500); return await stage(h) + ' // message : ' + (await L.toasts(h)).join(' + '); }, 0);
  });
  /* « En cours chez tes bots » : le compteur et la liste doivent dire la même chose */
  await scen('P en cours chez tes bots, plus de cinq', {scen: {active: true, pending: 7}}, async (h, step) => {
    const pend = () => h.page.evaluate(() => { const p = Array.from(document.querySelectorAll('#view .panel')).find((x) => /En cours chez tes bots/.test(x.innerText)); return p ? p.querySelector('.aside').innerText + ' // lignes affichées : ' + p.querySelectorAll('.pending li').length + ' // bouton : ' + ((p.querySelector('.pend-more') || {}).innerText || 'aucun') : 'bloc absent'; });
    await step('sept ordres en attente de plus', async () => pend(), 0);
    await step('voir les autres', async () => { const a = await L.click(h, 'Voir les'); return a + ' // ' + await pend(); }, 0);
  });
  /* l'événement rouge : déplacé ou retiré directement dans l'agenda ; l'annuel reste confié à Iris */
  const evCard = (h, title, btn) => h.page.evaluate(({title, btn}) => { const norm = (s) => s.replace(/\s+/g, ' ').trim(); const c = Array.from(document.querySelectorAll('#view article')).find((a) => a.getClientRects().length && /important/i.test((a.querySelector(".nature") || {}).innerText || "") && norm(a.innerText).includes(title)); if (!c) return 'carte absente : ' + title; const b = Array.from(c.querySelectorAll('button')).find((x) => norm(x.innerText).startsWith(btn)); if (!b) return 'bouton absent : ' + btn; b.click(); return 'ok'; }, {title, btn});
  const calState = (h) => h.page.evaluate(() => window.__CAL.primary.filter((e) => e.colorId === '11').map((e) => e.summary + ' ' + (e.start.dateTime || e.start.date) + ' > ' + (e.end.dateTime || e.end.date)).join(' ; ') + ' // Échéances : ' + window.__G['Échéances'].filter((r) => /notaire/.test(r[1])).map((r) => r[0] + ' ' + r[4]).join(' ; '));
  await scen('R événement rouge', {scen: {active: true}}, async (h, step) => {
    await L.tab(h, 'agenda');
    await step('déplacer un événement avec heure', async () => { const a = await evCard(h, 'Rendez-vous notaire', 'Plus'); await L.tick(h, 500); const b = await L.click(h, 'Déplacer', '#sheet'); await L.tick(h, 500); await fill(h, '#sheet input[type=date]', '2026-11-25'); await h.page.evaluate(() => document.querySelector('#sheet form').requestSubmit()); await L.tick(h, 8000); return [a, b].join(' / ') + ' // ' + await calState(h); }, 0);
    await step("déplacer un événement d'une journée", async () => { await L.tick(h, 30000); await L.tab(h, 'agenda'); const a = await evCard(h, 'Visite médicale', 'Plus'); await L.tick(h, 500); const b = await L.click(h, 'Déplacer', '#sheet'); await L.tick(h, 500); await fill(h, '#sheet input[type=date]', '2026-11-27'); await h.page.evaluate(() => document.querySelector('#sheet form').requestSubmit()); await L.tick(h, 8000); return [a, b].join(' / ') + ' // ' + await calState(h); }, 0);
    await step('retirer cet événement', async () => { await L.tick(h, 30000); await L.tab(h, 'agenda'); const a = await evCard(h, 'Rendez-vous notaire', 'Plus'); await L.tick(h, 500); const b = await L.click(h, 'Retirer de mon agenda', '#sheet'); await L.tick(h, 500); const s = await sheetTxt(h); const c = await L.click(h, 'Oui', '#sheet'); await L.tick(h, 8000); return [a, b, c].join(' / ') + ' // CONFIRME: ' + s.slice(0, 160) + ' // ' + await calState(h); }, 0);
    await step('événement annuel : reste confié à Iris', async () => { await L.tab(h, 'agenda'); const a = await evCard(h, 'Anniversaire', 'Plus'); await L.tick(h, 500); const b = await L.click(h, 'Déplacer', '#sheet'); await L.tick(h, 500); await fill(h, '#sheet input[type=date]', '2026-12-20'); await h.page.evaluate(() => document.querySelector('#sheet form').requestSubmit()); await L.tick(h, 8000); return [a, b].join(' / ') + ' // ' + await calState(h); }, 0);
  });
  /* la tâche Claude : chaque compte a la sienne ; la page essaie les identifiants connus et retient celui qui marche */
  const task = async (h) => { const a = await card(h, 'Question technique', 'Confier à la tâche Claude'); await L.tick(h, 500); const b = await L.click(h, 'Oui, lancer la tâche', '#sheet'); return a + ' / ' + b; };
  const fired = (h) => L.calls(h, (c) => c.tool === 'fire_trigger').then((c) => c.map((x) => x.input.trigger_id.slice(-6)).join(' > ') + ' // retenu : ' + '');
  await scen('T1 tâche Claude du second compte', {scen: {tasks: ['trig_01T263zKge8mnGiu4vs2DGwL']}}, async (h, step) => {
    await L.tab(h, 'suivi');
    await step('premier lancement : essaie les deux', async () => { const a = await task(h); await L.tick(h, 6500); return a + ' // ' + await fired(h) + await h.page.evaluate(() => localStorage.getItem('jarvis.tache')); }, 0);
    await step('second lancement : va droit à la bonne', async () => { const a = await task(h); await L.tick(h, 6500); return a + ' // ' + await fired(h) + await h.page.evaluate(() => localStorage.getItem('jarvis.tache')); }, 0);
  });
  await scen('T2 tâche Claude du premier compte', {scen: {tasks: ['trig_012M51J8A3NmbFgE36av8PR3']}}, async (h, step) => {
    await L.tab(h, 'suivi');
    await step('lancement', async () => { const a = await task(h); await L.tick(h, 6500); return a + ' // ' + await fired(h) + await h.page.evaluate(() => localStorage.getItem('jarvis.tache')); }, 0);
  });
  await scen('T3 aucune tâche sur ce compte', {scen: {tasks: []}}, async (h, step) => {
    await L.tab(h, 'suivi');
    await step('lancement refusé, dit clairement', async () => { const a = await task(h); await L.tick(h, 6500); return a + ' // ' + await fired(h) + await h.page.evaluate(() => localStorage.getItem('jarvis.tache')); }, 0);
  });
  for (const r of results) {
    console.log('\n[' + r.scen + '] ' + r.step + (r.note ? '\n   note: ' + String(r.note).slice(0, 900) : ''));
    (r.writes || []).forEach((w) => console.log('   ÉCRIT: ' + w));
    (r.toasts || []).forEach((t) => console.log('   toast: ' + t));
    (r.errors || []).forEach((e) => console.log('   ERREUR: ' + e));
  }
})().catch((e) => { console.error('ECHEC', e); process.exit(1); });
