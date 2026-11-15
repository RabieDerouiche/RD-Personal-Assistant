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
