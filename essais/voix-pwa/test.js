/* Banc de la page d'essai de la voix : faux micro et fausse voix, plusieurs comportements possibles de l'iPhone.
   NODE_PATH=/opt/node-tools/node_modules node essais/voix-pwa/test.js */
const {chromium} = require('playwright');
const path = require('path');
const FILE = 'file://' + path.join(__dirname, 'index.html');

const MOCK = (scen) => `
(() => {
  const SC = ${JSON.stringify(scen)};
  window.__say = (SC.say || []).slice(); window.__spoken = []; window.__starts = 0;
  const Rec = function () {};
  Rec.prototype.start = function () {
    const r = this, n = ++window.__starts, auto = n > 1;
    if (SC.throwOnStart) throw Object.assign(new Error('refusé'), {name: 'NotAllowedError'});
    if (SC.hang) return;
    if (SC.deny || (SC.denyAuto && auto)) { setTimeout(() => { r.onerror && r.onerror({error: SC.deny || SC.denyAuto}); r.onend && r.onend(); }, 30); return; }
    setTimeout(() => r.onstart && r.onstart(), 40);
    setTimeout(() => {
      const p = window.__say.shift();
      if (!p) { r.onerror && r.onerror({error: 'no-speech'}); r.onend && r.onend(); return; }
      r.onresult && r.onresult({resultIndex: 0, results: [Object.assign([{transcript: p.slice(0, 6)}], {isFinal: false})]});
      setTimeout(() => { r.onresult && r.onresult({resultIndex: 0, results: [Object.assign([{transcript: p}], {isFinal: true})]}); if (!r.continuous) setTimeout(() => r.onend && r.onend(), 30); }, 120);
    }, 200);
  };
  Rec.prototype.stop = function () { setTimeout(() => this.onend && this.onend(), 20); };
  Rec.prototype.abort = function () {};
  window.webkitSpeechRecognition = SC.noRec ? undefined : Rec;
  try { Object.defineProperty(window, 'SpeechRecognition', {value: undefined, configurable: true}); } catch (e) {}
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  const synth = {speaking: false, cancel() {}, speak(u) { window.__spoken.push(u.text); if (!u.text.trim()) return; synth.speaking = true; setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => { synth.speaking = false; u.onend && u.onend(); }, 300); }, 30); }};
  Object.defineProperty(window, 'speechSynthesis', {value: synth, configurable: true});
})();`;

async function run(name, scen, act) {
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 390, height: 844}});
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(MOCK(scen));
  await page.goto(FILE);
  if (scen.continu) await page.click('#m-continu');
  await page.click('#go');
  await page.waitForTimeout(act || 6000);
  const r = await page.evaluate(() => ({tours: +document.getElementById('n-tours').textContent, relances: +document.getElementById('n-relances').textContent, err: +document.getElementById('n-err').textContent, etat: document.getElementById('state').textContent, verdict: document.getElementById('verdict').textContent, lu: window.__spoken.filter((t) => t.trim()).length, over: document.documentElement.scrollWidth > 390}));
  if (scen.shot) await page.screenshot({path: scen.shot});
  console.log('[' + name + '] ' + JSON.stringify(r) + (errors.length ? ' ERREURS ' + errors.join(' | ') : ''));
  await browser.close();
  return r;
}

(async () => {
  const phrases = ['Bonjour Jarvis', 'Quelle heure est-il', 'Lance une mission', 'Merci'];
  await run('1 boucle réussie, phrase par phrase', {say: phrases, shot: process.env.SHOT || null}, 7000);
  await run('2 boucle réussie, écoute continue', {say: phrases, continu: true}, 9000);
  await run('3 micro refusé', {deny: 'not-allowed'}, 1500);
  await run("4 écran d'accueil : relance refusée sans appui", {say: phrases, denyAuto: 'service-not-allowed'}, 3000);
  await run("5 l'iPhone ne répond jamais", {hang: true}, 5000);
  await run('6 démarrage refusé', {throwOnStart: true}, 1500);
  await run('7 pas de reconnaissance vocale', {noRec: true}, 800);
  await run('8 silence prolongé', {say: []}, 6000);
})().catch((e) => { console.error('ECHEC', e); process.exit(1); });
