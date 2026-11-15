/* Faux micro et fausse voix, comme sur l'iPhone (partagé par les bancs). */
module.exports =  (sc) => `(() => {
  const SC = ${JSON.stringify(sc)};
  window.__say = []; window.__spoken = []; window.__starts = 0;
  const Rec = function () {};
  Rec.prototype.start = function () {
    const r = this, n = ++window.__starts;
    if (SC.hang) return;
    if (SC.deny) { setTimeout(() => { r.onerror && r.onerror({error: SC.deny}); r.onend && r.onend(); }, 30); return; }
    if (SC.captureOnce && n === 2) { setTimeout(() => { r.onerror && r.onerror({error: 'audio-capture'}); r.onend && r.onend(); }, 30); return; }
    setTimeout(() => r.onstart && r.onstart(), 30);
    let k = 0;
    const tick = () => { const p = window.__say.shift(); if (!p) { if (++k > 12) { r.onerror && r.onerror({error: 'no-speech'}); r.onend && r.onend(); return; } r._t = setTimeout(tick, 250); return; }
      r.onresult && r.onresult({resultIndex: 0, results: [Object.assign([{transcript: p.slice(0, 8)}], {isFinal: false})]});
      setTimeout(() => { r.onresult && r.onresult({resultIndex: 0, results: [Object.assign([{transcript: p}], {isFinal: true})]}); setTimeout(() => r.onend && r.onend(), 30); }, 120); };
    r._t = setTimeout(tick, 120);
  };
  Rec.prototype.stop = function () { clearTimeout(this._t); setTimeout(() => this.onend && this.onend(), 10); };
  Rec.prototype.abort = function () { clearTimeout(this._t); };
  window.webkitSpeechRecognition = SC.noRec ? undefined : Rec;
  try { Object.defineProperty(window, 'SpeechRecognition', {value: undefined, configurable: true, writable: true}); } catch (e) {}
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  const synth = {speaking: false, getVoices() { return [{lang: 'fr-FR', name: 'Thomas', voiceURI: 'thomas'}]; }, addEventListener() {}, cancel() { synth.speaking = false; }, speak(u) { if (!u.text.trim()) return; window.__spoken.push(u.text); synth.speaking = true; setTimeout(() => { synth.speaking = false; u.onend && u.onend(); }, 250); }};
  Object.defineProperty(window, 'speechSynthesis', {value: synth, configurable: true});
})();`;
