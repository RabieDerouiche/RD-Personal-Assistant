/* Radar, dépenses courantes (0.80.0) : la vraie app dans Chromium sur un vrai serveur. Les cas tout prêts remplissent le formulaire, chaque
   façon de compter montre ses options, et ce qu'il reste à dépenser suit (montants inventés ; l'attendu est recalculé ici pour la date du jour).
   Lancer : node jarvis-os/server/tests/radar-courantes.test.mjs */
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {createRequire} from 'node:module'; import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), SRV = path.join(HERE, '..', 'server.mjs'), APP = path.join(HERE, '..', '..', '..', 'essais', 'jarvis-os-maquette');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-courantes-')), PORT = 23000 + Math.floor(Math.random() * 900), BASE = 'http://127.0.0.1:' + PORT;
const out = []; let rates = 0; const ok = (n, c, i) => { if (!c) rates++; out.push((c ? 'OK    ' : 'ÉCHEC ') + n + (!c && i ? ' :: ' + i : '')); };
const env = {...process.env, PORT: String(PORT), JARVIS_DATA: DATA, JARVIS_OS_DIR: APP, JARVIS_REPO: os.tmpdir(), JARVIS_MAJ: '0', JARVIS_HUMOUR: '0', JARVIS_COFFRE_PRISE: path.join(DATA, 'absent.sock'),
  JARVIS_NOTIFY_TICK_MS: '3600000', JARVIS_SANTE_TICK_MS: '3600000', JARVIS_PUSH_ALLOW_HTTP: '1', CLAUDE_BIN: path.join(HERE, 'fake-claude.mjs'), ANTHROPIC_API_KEY: 'sk-ant-faux-pour-le-test', ANTHROPIC_BASE_URL: 'https://exemple.invalid'};
const c = async (u, o = {}) => { const x = await fetch(BASE + u, {...o, headers: {'content-type': 'application/json', ...(o.headers || {})}}); return {status: x.status, body: await x.json().catch(() => null)}; };
const eur = (n) => Number(n).toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace(/[   ]/g, ' ') + ' €', plat = (t) => String(t || '').replace(/[  ]/g, ' ');
/* l'attendu, d'aujourd'hui à la fin du mois */
const auj = new Date(), jour = auj.getDate(), dernier = new Date(auj.getFullYear(), auj.getMonth() + 1, 0).getDate();
const quarts = [[1, 7], [8, 14], [15, 21], [22, dernier]].filter(([, f]) => f >= jour).length;
let jeudis = 0; for (let d = jour; d <= dernier; d++) if (new Date(auj.getFullYear(), auj.getMonth(), d).getDay() === 4) jeudis++;

let srv = null, nav = null;
try {
  const code = execFileSync(process.execPath, [SRV, 'pair'], {env}).toString().match(/: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
  srv = spawn(process.execPath, [SRV], {env, stdio: ['ignore', 'pipe', 'pipe']}); await new Promise((z) => srv.stdout.once('data', z));
  const jeton = (await c('/api/pair', {method: 'POST', body: JSON.stringify({code, device: 'iPhone du banc'})})).body.token, A = {authorization: 'Bearer ' + jeton};
  const require = createRequire(process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'x') : import.meta.url); const {chromium, devices} = require('playwright');
  nav = await chromium.launch(); const ctx = await nav.newContext({...devices['iPhone 15 Pro Max'], locale: 'fr-FR'}); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript((j) => { try { if (!localStorage.getItem('jarvis.settings')) localStorage.setItem('jarvis.settings', JSON.stringify({serverToken: j})); localStorage.setItem('jarvis.radar.reste', JSON.stringify({jusqua: 'mois'})); } catch (e) { /* rien */ } }, jeton);
  await p.goto(BASE + '/?serveur#argent'); await p.waitForSelector('.rad-courantes', {timeout: 30000});
  const panneau = p.locator('.rad-courantes'), form = p.locator('.rad-cr-form'), gros = async () => plat(await p.locator('.rad-big').textContent());
  const visible = (sel) => form.locator(sel).isVisible(), presse = async () => (await form.locator('.rad-cr-modes button[aria-pressed=true]').textContent());
  const ajouter = async () => { await panneau.getByRole('button', {name: 'Ajouter une dépense courante'}).tap(); await form.waitFor({timeout: 10000}); };
  const valider = async () => { await form.locator('button[type=submit]').tap(); await form.waitFor({state: 'hidden', timeout: 10000}); await p.waitForTimeout(700); };
  const ligne = (nom) => panneau.locator('.rad-cr', {hasText: nom});
  /* 0.81.0 : toucher une ligne ouvre sa fiche (suivi du réel) ; « Modifier » mène au formulaire */
  const fiche = p.locator('.rad-cr-fiche'), fermer = async () => { await p.locator('.sheet-close').tap(); await p.waitForTimeout(500); };
  const ouvrir = async (nom) => { await ligne(nom).tap(); await fiche.waitFor({timeout: 10000}); };
  const modifier = async (nom) => { await ouvrir(nom); await fiche.locator('.rad-cr-modif').tap(); await form.waitFor({timeout: 10000}); };
  const seg = async (nom) => { await p.locator('.rad-seg button', {hasText: nom}).tap(); await p.waitForTimeout(700); };
  ok('Radar : un panneau « Dépenses courantes (0) » qui dit à quoi il sert, et un bouton pour en ajouter', /Dépenses courantes \(0\)/.test(await panneau.textContent()) && /courses, essence, femme de ménage, coiffeur/.test(await panneau.textContent()));

  await ajouter();
  const cas = await form.locator('.rad-cr-cas .mchip').allTextContents();
  ok('formulaire : les cas tout prêts (courses, boucherie, femme de ménage, essence, coiffeur, parking, restaurants, repas livrés…), « Courses » choisi : nom rempli, « Budget du mois », montant « par mois », ni jour de semaine ni jour du mois',
    cas.join() === 'Courses,Boucherie,Femme de ménage,Essence,Coiffeur,Parking,Restaurants,Repas livrés,Marché,Pharmacie,Autre' && await form.locator('input[type=text]').first().inputValue() === 'Courses' && await presse() === 'Budget du mois'
    && /Budget par mois/.test(await form.textContent()) && !(await visible('select')) && !(await visible('input[type=number]')), cas.join());
  await form.locator('.rad-cr-cas .mchip', {hasText: 'Femme de ménage'}).tap();
  const menage = [await form.locator('input[type=text]').first().inputValue(), await presse(), await visible('select'), await form.locator('select').inputValue(), await visible('input[type=number]'), /Montant par passage/.test(await form.textContent())];
  await form.locator('.rad-cr-cas .mchip', {hasText: 'Boucherie'}).tap();
  const boucherie = [await form.locator('input[type=text]').first().inputValue(), await presse(), await visible('select'), await visible('input[type=number]'), /sans jour, elle compte tant que tu ne l’as pas cochée/.test(await form.textContent())];
  ok('un cas débloque ses options : « Femme de ménage » = chaque semaine, le jeudi proposé, montant par passage ; « Boucherie » = une fois par mois, jour du mois facultatif',
    menage.join() === 'Femme de ménage,Chaque semaine,true,4,false,true' && boucherie.join() === 'Boucherie,Une fois par mois,false,true,true', JSON.stringify([menage, boucherie]));

  /* un budget de 400 € par mois, un quart par semaine */
  await form.locator('.rad-cr-cas .mchip', {hasText: 'Courses'}).tap(); await form.locator('input[inputmode=decimal]').fill('400'); await valider();
  const attendu = 100 * quarts, t1 = plat(await ligne('Courses').textContent());
  ok('« Courses », 400 € par mois : il reste ' + quarts + ' quart(s) du mois, soit ' + eur(attendu) + ' ; le grand chiffre du reste à payer le compte et le dit',
    t1.includes('400,00 € par mois, un quart par semaine') && t1.includes(quarts + (quarts > 1 ? ' semaines' : ' semaine') + ' à compter') && t1.includes('≈ ' + eur(attendu)) && await gros() === eur(attendu)
    && plat(await p.locator('.rad-dont').textContent()).includes('dont environ ' + eur(attendu) + ' de dépenses courantes'), t1 + ' | ' + await gros());
  const s1 = (await c('/api/radar', {headers: A})).body.courantes;
  ok('enregistré sur le serveur (et nulle part ailleurs)', s1.length === 1 && s1[0].service === 'Courses' && s1[0].mode === 'enveloppe' && s1[0].montant === 400 && s1[0].type === 'courses', JSON.stringify(s1));

  /* une fois par mois, sans jour : elle compte jusqu'à « fait ce mois-ci » */
  await ajouter(); await form.locator('.rad-cr-cas .mchip', {hasText: 'Boucherie'}).tap(); await form.locator('input[inputmode=decimal]').fill('120'); await valider();
  const g2 = await gros(), t2 = plat(await ligne('Boucherie').textContent());
  await modifier('Boucherie'); await form.locator('input[type=checkbox]').check(); await valider();
  const g3 = await gros(), t3 = plat(await ligne('Boucherie').textContent());
  ok('« Boucherie », 120 € une fois par mois : elle compte (« à faire ») ; cochée « Fait ce mois-ci », elle ne compte plus jusqu\'au mois prochain',
    g2 === eur(attendu + 120) && /une fois par mois · à faire/.test(t2) && g3 === eur(attendu) && /fait ce mois-ci/.test(t3) && t3.includes('≈ ' + eur(0)), [g2, t2, g3, t3].join(' | '));

  /* 0.81.0 : suivi du réel sur le budget des courses */
  await ouvrir('Courses');
  const vide = plat(await fiche.textContent());
  await fiche.locator('.rad-cr-noter input[inputmode=decimal]').fill('350'); await fiche.locator('.rad-cr-noter button[type=submit]').tap(); await p.waitForTimeout(800);
  const note1 = plat(await fiche.locator('.rad-cr-etat').textContent()), rythme = plat(await fiche.locator('.rad-cr-rythme').textContent()), srv1 = (await c('/api/radar', {headers: A})).body.courantes.find((x) => x.service === 'Courses').reels;
  await fermer();
  const plafond = Math.min(attendu, 50), t5 = plat(await ligne('Courses').textContent());
  ok('fiche d\'un budget : rien de noté au départ ; 350 € notés sur 400 € : « 350,00 € notés sur 400,00 € (88 %) », l\'écart au rythme est dit, la note est sur le serveur ; ce qui reste à dépenser ne dépasse plus les 50 € non dépensés',
    /rien de noté\. Budget du mois : 400,00 €/.test(vide) && note1.includes('350,00 € notés sur 400,00 € (88 %)') && /rythme du budget à ce jour/.test(rythme) && srv1.length === 1 && srv1[0].m === 350
    && t5.includes('350,00 € notés ce mois-ci') && t5.includes('≈ ' + eur(plafond)) && await gros() === eur(plafond), [note1, rythme, t5, await gros()].join(' | '));
  /* le mois complet, le reste à vivre, six mois */
  await seg('Le mois');
  const m1 = plat(await p.locator('.rad-mois').textContent());
  await p.getByRole('button', {name: 'Donner le montant de ma paie'}).tap(); await p.waitForTimeout(500);
  await p.locator('.rad-form input[inputmode=decimal]').fill('3000'); await p.locator('.rad-form button[type=submit]').tap(); await p.waitForTimeout(900);
  const m2 = plat(await p.locator('.rad-vivre').textContent()), evo = await p.locator('.rad-evo').count(), dernier6 = plat(await p.locator('.rad-evo').last().textContent()), premier6 = plat(await p.locator('.rad-evo').first().textContent());
  ok('« Le mois » : 520 € en tout (400 de courses + 120 de boucherie, estimés), ce qui est noté, les postes « Alimentation » ; sans montant de paie, il le propose',
    m1.includes(eur(520)) && m1.includes('environ ' + eur(520) + ' de dépenses courantes (estimé)') && m1.includes('Tu as noté ' + eur(350)) && /Alimentation/.test(m1) && /Donne le montant de ta paie/.test(m1), m1.slice(0, 400));
  ok('paie de 3 000 € saisie : « Reste à vivre ce mois-ci » 2 480 € (17 % de la paie partent en dépenses prévues) ; six mois affichés, le dernier avec ses dépenses courantes, les plus anciens sans',
    m2.includes(eur(2480)) && m2.includes('17 % de ta paie') && evo === 6 && dernier6.includes(eur(520)) && /dépenses courantes pas encore saisies/.test(premier6) && (await c('/api/radar', {headers: A})).body.revenus.montant === 3000, [m2, evo, dernier6].join(' | '));
  if (process.env.COURANTES_CAPTURE) { await p.evaluate(() => { const e = document.querySelector('.rad-vivre'); if (e) e.scrollIntoView({block: 'start'}); }); await p.waitForTimeout(3500); await p.screenshot({path: process.env.COURANTES_CAPTURE + '-mois.png'}); }
  await seg('Fixes');
  await ouvrir('Courses'); await fiche.locator('.rad-cr-notes button').tap(); await p.waitForTimeout(800);
  const sansNote = plat(await fiche.locator('.rad-cr-etat').textContent()); await fermer();
  ok('la note retirée : le budget revient à ce que le calendrier laisse prévoir', /rien de noté/.test(sansNote) && await gros() === eur(attendu) && !(await c('/api/radar', {headers: A})).body.courantes.find((x) => x.service === 'Courses').reels, sansNote + ' | ' + await gros());

  /* chaque semaine, un jour donné */
  await ajouter(); await form.locator('.rad-cr-cas .mchip', {hasText: 'Femme de ménage'}).tap(); await form.locator('input[inputmode=decimal]').fill('50'); await valider();
  const t4 = plat(await ligne('Femme de ménage').textContent());
  ok('« Femme de ménage », 50 € chaque jeudi : ' + jeudis + ' passage(s) d\'ici la fin du mois, soit ' + eur(50 * jeudis), t4.includes('chaque jeudi, 50,00 € par passage') && t4.includes('≈ ' + eur(50 * jeudis)) && await gros() === eur(attendu + 50 * jeudis), t4 + ' | ' + await gros());
  ok('le panneau donne le total du mois (400 + 120 + 50 × 52 / 12) et dit que c\'est estimé', plat(await panneau.locator('.rad-cr-tot').textContent()).includes(eur(400 + 120 + Math.round(5000 * 52 / 12) / 100)) && /Dépenses courantes \(3\)/.test(await panneau.textContent()), plat(await panneau.locator('.rad-cr-tot').textContent()));

  /* modifier la façon de compter, puis retirer */
  await modifier('Courses');
  const sansCas = await form.locator('.rad-cr-cas').count();
  await form.locator('.rad-cr-modes button', {hasText: 'Une fois par mois'}).tap(); await form.locator('input[type=number]').fill('40');
  await form.locator('button[type=submit]').tap(); await p.waitForTimeout(600); const encore = await form.isVisible();
  await form.locator('input[type=number]').fill(String(Math.min(28, jour))); await valider();
  ok('modifier : plus de cas tout prêts, la façon de compter se change ; un jour du mois impossible (40) est refusé, un vrai jour est accepté',
    sansCas === 0 && encore === true && (await c('/api/radar', {headers: A})).body.courantes.find((x) => x.service === 'Courses').mode === 'mois', [sansCas, encore].join());
  await modifier('Femme de ménage'); await form.getByRole('button', {name: 'Retirer cette dépense'}).tap(); await p.waitForTimeout(800);
  ok('« Retirer cette dépense » : elle sort de la liste et du serveur', await ligne('Femme de ménage').count() === 0 && (await c('/api/radar', {headers: A})).body.courantes.length === 2);
  ok('aucune erreur de script dans la page', errs.length === 0, errs.join(' | '));
  if (process.env.COURANTES_CAPTURE) { await panneau.scrollIntoViewIfNeeded(); await p.screenshot({path: process.env.COURANTES_CAPTURE + '-panneau.png'}); await ajouter(); await p.waitForTimeout(500); await p.screenshot({path: process.env.COURANTES_CAPTURE + '-formulaire.png'}); }
} catch (e) { ok('le banc est allé au bout', false, (e && e.stack) || String(e)); }
finally { if (nav) await nav.close().catch(() => {}); if (srv) srv.kill('SIGKILL'); fs.rmSync(DATA, {recursive: true, force: true}); }
console.log(out.join('\n'));
console.log('\nRadar, dépenses courantes : ' + out.filter((x) => x.startsWith('OK')).length + ' vérifications réussies, ' + rates + ' en échec.');
process.exit(rates ? 1 : 0);
