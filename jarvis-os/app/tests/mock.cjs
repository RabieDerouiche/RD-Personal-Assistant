/* Faux micro et fausse voix, comme sur l'iPhone (partagé par les bancs). */
module.exports =  (sc) => `(() => {
  const SC = ${JSON.stringify(sc)};
  window.__say = []; window.__spoken = []; window.__starts = 0; window.__active = 0; window.__maxActive = 0; let stuck = false;
  const endR = (r) => { if (!r._ended) { r._ended = true; window.__active--; } r.onend && r.onend(); };
  const Rec = function () {};
  Rec.prototype.start = function () {
    const r = this, n = ++window.__starts; r._ended = false; window.__active++; window.__maxActive = Math.max(window.__maxActive, window.__active); if (SC.iosStuck) stuck = true;
    if (SC.hang) return;
    if (SC.deny) { setTimeout(() => { r.onerror && r.onerror({error: SC.deny}); endR(r); }, 30); return; }
    if (SC.captureOnce && n === 2) { setTimeout(() => { r.onerror && r.onerror({error: 'audio-capture'}); endR(r); }, 30); return; }
    setTimeout(() => r.onstart && r.onstart(), 30);
    let k = 0;
    const tick = () => { const p = window.__say.shift(); if (!p) { if (++k > 12) { r.onerror && r.onerror({error: 'no-speech'}); endR(r); return; } r._t = setTimeout(tick, 250); return; }
      r.onresult && r.onresult({resultIndex: 0, results: [Object.assign([{transcript: p.slice(0, 8)}], {isFinal: false})]});
      setTimeout(() => { r.onresult && r.onresult({resultIndex: 0, results: [Object.assign([{transcript: p}], {isFinal: true})]}); setTimeout(() => endR(r), 30); }, 120); };
    r._t = setTimeout(tick, 120);
  };
  Rec.prototype.stop = function () { clearTimeout(this._t); setTimeout(() => endR(this), 10); };
  Rec.prototype.abort = function () { clearTimeout(this._t); const r = this; setTimeout(() => endR(r), 5); };
  window.webkitSpeechRecognition = SC.noRec ? undefined : Rec;
  try { Object.defineProperty(window, 'SpeechRecognition', {value: undefined, configurable: true, writable: true}); } catch (e) {}
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  const synth = {speaking: false, getVoices() { return [{lang: 'fr-FR', name: 'Thomas', voiceURI: 'thomas'}]; }, addEventListener() {}, cancel() { synth.speaking = false; stuck = false; }, speak(u) { if (!u.text.trim()) return; if (stuck) return; window.__spoken.push(u.text); synth.speaking = true; setTimeout(() => { synth.speaking = false; u.onend && u.onend(); }, 250); }};
  Object.defineProperty(window, 'speechSynthesis', {value: synth, configurable: true});
  /* lecteur audio (voix du serveur) : retient le texte joué, puis « fin » après 200 ms */
  const MP = HTMLMediaElement.prototype;
  MP.play = function () { const el = this, tok = el.dataset.token, t = el.dataset.text; if (t && tok && tok[0] === 'p') { window.__spoken.push(t); window.__audio = (window.__audio || 0) + 1; } setTimeout(() => { if (el.dataset.token === tok) el.dispatchEvent(new Event('ended')); }, 200); return Promise.resolve(); };
  MP.pause = function () {};
})();`;
