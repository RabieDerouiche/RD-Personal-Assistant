/* JARVIS OS 0.26.0 (20/11/2026) : la liste des bots Grok, à un seul endroit (elle était recopiée dans server.mjs, notify.mjs et voix.mjs).
   Plutus (« génération de l'argent », rôle à préciser) a été ajouté par le propriétaire le 20/11/2026.
   Pour un nouveau bot : une ligne ici suffit côté serveur (notifications de ses réponses, ordres, « où en est … »). */
export const BOTS = [['iris', 'Iris'], ['chronos', 'Chronos'], ['kairos', 'Kairos'], ['ulysse', 'Ulysse'], ['athena', 'Athéna'], ['argus', 'Argus'], ['plutus', 'Plutus']];
export const BOT_IDS = BOTS.map((b) => b[0]);            /* en minuscules, sans accent : comme le serveur compare les noms du Canal */
export const BOT_NOMS = Object.fromEntries(BOTS);        /* id → nom affiché */
export const BOT_LISTE = BOTS.map((b) => b[1]);          /* noms affichés */
