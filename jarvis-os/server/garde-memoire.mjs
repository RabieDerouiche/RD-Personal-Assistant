/* JARVIS OS 0.70.1 — la mémoire du serveur sous surveillance (23/11/2026, essai d'Hermes sur le même VPS, docs/hermes.md).
   JARVIS se retenait déjà quand la mémoire libre baissait (Sonnet préparé seulement au-dessus de 900 Mo, seconde mission
   au-dessus de 600 Mo, Siri dans la file commune sous 400 Mo), sans le dire nulle part. Chaque retenue est maintenant notée
   dans son journal, une fois par genre et par 10 minutes au plus : jarvis-os/hermes/diagnostic.sh les compte, pour savoir
   si Hermes le gêne. Rien ne change dans ce que fait JARVIS. */
import os from 'node:os';

export function createGardeMemoire({now = Date.now, libre = () => os.freemem(), ecrire = (t) => console.warn(t), intervalle = 600000} = {}) {
  const derniere = new Map();
  let retenues = 0;
  /* une retenue de genre `genre` (seuil en octets) ; vrai si elle a été écrite dans le journal */
  function noter(genre, seuil) {
    retenues++;
    const t = now();
    if (derniere.has(genre) && t - derniere.get(genre) < intervalle) return false;
    derniere.set(genre, t);
    ecrire('[jarvis] mémoire basse : ' + genre + ' (libre ' + Math.round(libre() / 1e6) + ' Mo, seuil ' + Math.round(seuil / 1e6) + ' Mo)');
    return true;
  }
  return {noter, retenues: () => retenues};
}
