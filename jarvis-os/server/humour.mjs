/* JARVIS OS — sa personnalité à l'oral (21/11/2026). Ses choix (QCM) : « sarcastique assumé » ; « la voix seulement » (orbe, mains libres,
   Siri : l'écrit reste sobre) ; « des variantes drôles » pour les réponses instantanées sans IA.
   Deux choses ici : PERSO_ORAL, la consigne donnée à Claude quand sa réponse sera lue à voix haute (même texte, mot pour mot, que VOIX_PERSO
   dans la page : le banc vérifie qu'ils sont identiques) ; pique(), une phrase écrite d'avance, ajoutée APRÈS l'information d'une réponse
   instantanée, jamais à sa place, et jamais quand la réponse touche à un sujet sérieux. */

export const PERSO_ORAL = "À L'ORAL : cette réponse sera lue à voix haute. Personnalité de JARVIS (son choix du 21/11/2026 : « sarcastique assumé ») : un majordome brillant, pince-sans-rire et franchement sarcastique, toujours bienveillant. Chaque réponse porte une pique : tu le taquines, lui, ses habitudes, la situation ou toi-même, jamais pour le rabaisser. L'information d'abord, exacte et complète ; la pique ensuite, en une phrase au plus, jamais à la place d'une réponse ni d'une action à faire. Aucun humour, ton sobre et chaleureux, quand il s'agit de santé, d'argent difficile (dette, découvert, impayé, crédit), d'un deuil, de sécurité, d'un papier ou d'une échéance urgente, ou de sa famille (sa femme, ses enfants). Jamais de moquerie sur une autre personne, jamais vulgaire. Parle comme à l'oral : phrases courtes, sans liste, sans markdown, sans emoji, sans lien ; dis « c'est sûr », « sûrement » ou « je suppose » au lieu des marques (certain), (Likely), (guessing).";

/* une réponse qui touche à un sujet sérieux ne reçoit aucune pique */
const SERIEUX = /(m[ée]decin|docteur|h[ôo]pital|clinique|urgences?\b|sant[ée]|dentiste|kin[ée]|p[ée]diatre|vaccin|analyses?\b|ordonnance|pharmacie|obs[èe]ques|enterrement|d[ée]c[èe]s|deuil|fun[ée]railles|d[ée]couvert|impay[ée]|dettes?\b|cr[ée]dit|huissier|relance|banque|imp[ôo]ts?\b|amende|tribunal|avocat|police|plainte|urgent|cr[èe]che|[ée]cole|nounou|b[ée]b[ée]|enfants?\b|fille|fils|femme|[ée]pouse)/i;

const P = {
  heure: {
    nuit: ['Les gens raisonnables dorment. Je dis ça, je ne dis rien.', 'À cette heure-ci, même tes bots font semblant de dormir.', 'Excellente heure pour remettre en question tes choix de vie.'],
    matin: ['Le café d’abord, les grandes décisions ensuite.', 'Debout avant tout le monde : impressionnant. Ou inquiétant.', 'Je te laisse émerger, je ne suis pas un monstre.'],
    jour: ['Ravi de servir d’horloge parlante haut de gamme.', 'Ton téléphone affiche l’heure en haut, mais je comprends, c’est loin.', 'Le temps file. J’espère que toi aussi.'],
    soir: ['Il serait peut-être temps de lâcher ce téléphone, non ?', 'L’heure idéale pour remettre à demain ce qui pouvait attendre.', 'La journée est presque finie. Tu peux arrêter de faire semblant d’être productif.']
  },
  date: ['Au cas où ton calendrier serait en grève.', 'Une information précieuse, offerte par la maison.', 'Note-la quelque part. Ou redemande-moi, c’est mon métier après tout.'],
  meteo: {
    pluie: ['Un parapluie, c’est un accessoire de mode très sous-estimé.', 'Parfait pour rester au sec et me poser d’autres questions.', 'Le ciel a décidé de te tester.'],
    froid: ['Couvre-toi : je n’ai pas de bras pour te tendre une écharpe.', 'Un temps à trouver d’excellentes raisons de rester au chaud.'],
    soleil: ['Profite, on est en France, ça ne va pas durer.', 'Même moi, j’aurais presque envie de sortir.'],
    autre: ['Je décline toute responsabilité si le ciel change d’avis.', 'La météo, c’est comme moi : fiable, mais avec du caractère.', 'Prévision garantie à quatre-vingts pour cent. Les vingt autres, c’est la France.']
  },
  agenda: {
    vide: ['Une journée sans rendez-vous : savoure, c’est rare.', 'Agenda vide. Je peux te trouver des occupations, si tu t’ennuies.', 'Rien de prévu : le luxe absolu, ou un oubli. À toi de voir.'],
    plein: ['Bon courage. Je reste là, à te regarder courir.', 'Organisé comme un majordome : je suis presque fier de toi.', 'Respire entre deux. Ce n’est pas dans ton agenda, mais c’est permis.']
  },
  pourmoi: {
    vide: ['Même tes bots sont au chômage technique.', 'Savoure ce moment, il est historique.'],
    plein: ['Elles ne vont pas se faire toutes seules. Moi non plus, d’ailleurs.', 'Courage : une à la fois, et on ne parle plus des autres.']
  },
  bot: ['Je transmets ton impatience, avec tact.', 'Les bots aussi ont leurs humeurs.', 'Je surveille. Discrètement. Comme toujours.']
};
const dernier = {};
/* la pique d'une réponse instantanée (genre : heure, date, meteo, agenda, pourmoi, bot ; hm : heure de Paris « HH:MM ») ;
   0.73.0 : question = la phrase qu'il a dite : un sujet sérieux dans la question (« pour l'enterrement… », « aux urgences avec mon fils »)
   supprime aussi la pique, même si la réponse (l'heure, la météo) n'en dit rien */
export function pique(genre, reponse, hm, alea = Math.random, question = '') {
  const r = String(reponse || '');
  if (!r || SERIEUX.test(r + ' ' + String(question || '')) || process.env.JARVIS_HUMOUR === '0') return reponse;
  const h = parseInt(String(hm || '12:00').slice(0, 2), 10), s = r.toLowerCase();
  let l = null;
  if (genre === 'heure') l = h < 6 ? P.heure.nuit : h < 10 ? P.heure.matin : h < 20 ? P.heure.jour : P.heure.soir;
  else if (genre === 'date') l = P.date;
  else if (genre === 'meteo') l = /pluie|averse|pluvieu|orage|bruine|neige/.test(s) ? P.meteo.pluie : /(^|\D)(-?\d|1[0-2]?) degr/.test(s) && !/(1[3-9]|[2-4]\d) degr/.test(s) ? P.meteo.froid : /soleil|ensoleill|d[ée]gag/.test(s) ? P.meteo.soleil : P.meteo.autre;
  else if (genre === 'agenda') l = /^rien dans ton agenda/i.test(r) ? P.agenda.vide : P.agenda.plein;
  else if (genre === 'pourmoi') l = /^rien ne t'attend/i.test(r) ? P.pourmoi.vide : P.pourmoi.plein;
  else if (genre === 'bot') l = P.bot;
  if (!l || !l.length) return reponse;
  let i = Math.floor(alea() * l.length) % l.length;
  if (l.length > 1 && dernier[genre] === l[i]) i = (i + 1) % l.length;   /* pas deux fois la même de suite */
  dernier[genre] = l[i];
  return r.replace(/\s+$/, '') + ' ' + l[i];
}
