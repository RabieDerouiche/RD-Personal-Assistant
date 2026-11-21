#!/usr/bin/env node
/* Faux Claude Code pour le banc : imite `claude -p --output-format stream-json` (une demande sur l'entrée standard),
   l'entrée en flux (`--input-format stream-json`, une conversation qui reste ouverte), `claude auth status` et `claude mcp list`. */
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
if (args[0] === 'mcp') { console.log('Checking MCP server health…\n\nclaude.ai Claude Docs: https://api.example/v1/pages/mcp - ✓ Connected\nclaude.ai Google Calendar: https://calendarmcp.example/mcp/v1 - ✓ Connected\nclaude.ai Google Sheets: https://sheetsmcp.example/mcp/v1 - ✓ Connected\nclaude.ai Gmail: https://gmailmcp.example/mcp/v1 - ✓ Connected'); process.exit(0); }
if (args[0] === 'auth') { console.log(JSON.stringify({loggedIn: true, authMethod: 'claude.ai'})); process.exit(0); }
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const resume = opt('--resume'), sid = resume || 'sess-' + Math.random().toString(36).slice(2, 8), model = opt('--model');
const allow = args.includes('--allowedTools') ? args.slice(args.indexOf('--allowedTools') + 1, args.indexOf('--disallowedTools')).join(',') : '';
let guard = 'aucune';
if (opt('--settings')) { try { guard = JSON.parse(fs.readFileSync(opt('--settings'), 'utf8')).hooks.PreToolUse[0].hooks[0].command.split(' ').pop(); } catch { guard = 'illisible'; } }
const conn = process.env.FAKE_NO_CONN ? [] : ['mcp__claude_ai_Gmail__search_threads', 'mcp__claude_ai_Gmail__send_message', 'mcp__claude_ai_Google_Calendar__list_events', 'mcp__claude_ai_Google_Sheets__get_values', 'mcp__claude_ai_Google_Sheets__append_values'];
const init = () => out({type: 'system', subtype: 'init', session_id: sid, model, tools: ['Bash', 'Read', 'WebSearch', 'WebFetch'], mcp_servers: conn.length ? [{name: 'claude.ai Gmail', status: 'pending'}] : []});
let turn = 0, FIRST = null;
function answer(raw) {
  turn++; if (FIRST === null) FIRST = raw;
  const ctx = raw.includes('[Question]\n'), input = raw.split('[Question]\n').pop();
  if (/Renvoie UNIQUEMENT ce JSON/.test(input)) {
    const mod = /Gmail/.test(input) ? 'mails' : /Google Agenda/.test(input) ? 'agenda' : ((input.match(/onglets? « ([^»]+) »/) || [])[1] || 'autre');
    return {text: 'Voici : ' + JSON.stringify({items: [{module: mod, from: 'Banque', subject: 'Facture de novembre', title: 'Réunion', date: '2026-11-17', message: 'Exemple ' + mod, bot: 'Iris', objet: 'Robot cuiseur', sortie: 'Zoo', projet: 'Tunisie', statut: 'À faire'}]}) + ' Fin.', tools: ['mcp__claude_ai_Google_Sheets__get_values']};
  }
  /* revérification (0.19.0) : du nouveau seulement si la quittance de loyer ou le mail du syndic est dans ce que le serveur a trouvé */
  if (/^Demande de \S+ au propriétaire \(onglet À toi/.test(input)) {
    const sys = opt('--append-system-prompt') || '', papiers = /ses papiers \(dossier Papiers/.test(input);
    const hit = papiers ? /"nom":"Quittance 2019\.pdf"/.test(input) : /Dégât des eaux/.test(input);
    if (papiers && /"nom":"Bail 2024\.pdf"/.test(input)) return {text: JSON.stringify({nouveau: true, constat: 'La date de début du bail est sur Bail 2024.pdf.', source: 'Bail 2024.pdf', lien: 'https://drive.example/e1', pour_bot: 'La date de début du bail est en page 1 de Bail 2024.pdf (Papiers > Logement).', certitude: 'certain'})};
    return {text: (/Réponds UNIQUEMENT par ce JSON/.test(sys) ? '' : 'SANS CONSIGNE ') + JSON.stringify(hit ? {nouveau: true, constat: papiers ? 'La quittance de mai est dans Papiers, Logement.' : "Le syndic a répondu : l'expert passe mardi.", source: papiers ? 'Quittance 2019.pdf' : 'Syndic Dupont : RE: Dégât des eaux', lien: papiers ? 'https://drive.example/d3' : 'https://mail.google.com/mail/#all/th1', pour_bot: papiers ? 'La quittance de mai est dans Papiers > Logement > Locations (Quittance 2019.pdf).' : "Le syndic a répondu le 16/11 : l'expert passe mardi.", certitude: 'certain'} : {nouveau: false, constat: 'Rien de nouveau sur ce sujet. Outils : ' + allow, source: '', lien: '', pour_bot: '', certitude: 'certain'})};
  }
  /* 0.23.2 : choix des photos « en les regardant » : ici, le fichier qui contient la marque BON (les bannières promo contiennent PROMO) */
  if (/^Photos candidates des variantes/.test(input)) {
    const arr = JSON.parse(input.slice(input.indexOf('['), input.lastIndexOf(']') + 1));
    return {text: JSON.stringify({choix: arr.map((x) => ({variante: x.variante, fichier: x.fichiers.find((f) => { try { return fs.readFileSync(f).includes('BON'); } catch { return false; } }) || null}))})};
  }
  /* 0.29.0 : seconde passe de la recherche d'idées (même conversation) : une nouvelle, et un doublon écrit autrement (« la », sans la référence) */
  if (/^Il en manque \d+ dans le budget/.test(input)) {
    const it = (nom, prix) => ({nom, marque: 'Kidoria', prix, prix_detail: '', prix_vu: 'page', vendeur: 'Autre Enseigne', lien: '', date_prix: '2026-11-20', age: 'dès 3 ans', pourquoi: 'Trouvée en cherchant encore.', points_forts: ['Bois'], limites: [], qualite: 7, rapport_qualite_prix: 7, images: []});
    return {text: JSON.stringify({propositions: [it('Cabane Comète', 40), it('Kidoria la Maison Étoile', 45)], presque: [], pistes: [], certitude: 'likely', sources: []}) + (resume ? '' : ' SANS REPRISE')};
  }
  /* 0.24.0 : idée de produit : n propositions dans le budget, plus une hors budget (le serveur l'écarte) et un doublon */
  if (/^Idée de produit à trouver : « /.test(input)) {
    const n = +(input.match(/Nombre de propositions attendues : (\d+)/) || [])[1] || 3, max = +(input.match(/au plus ([\d.]+) €/) || [])[1] || 100, vb = process.env.JARVIS_STEAM_URL || '';
    if (/introuvable/.test(input)) return {text: JSON.stringify({comprehension: 'Rien', conseils: '', propositions: [{nom: 'Trop cher', prix: max * 3}], certitude: 'likely', sources: []})};
    /* 0.29.0 : le marché en offre peu : 2 dans le budget, 1 à 10 % au-dessus (le serveur la met dans « presque »), 1 sans le critère, des pistes ;
       une phrase avec des accolades après le JSON (lue quand même) ; la seconde passe (--resume) en apporte une de plus et un doublon */
    if (/lumineuse/.test(input)) {
      const it = (nom, prix, extra) => Object.assign({nom, marque: 'Kidoria', prix, prix_detail: 'livraison offerte', prix_vu: 'recherche', vendeur: 'Grande Enseigne', lien: vb + '/rien', date_prix: '2026-11-20', age: 'dès 3 ans', pourquoi: 'Éclairage dans chaque pièce.', points_forts: ['Lumières'], limites: ['Piles'], qualite: 8, rapport_qualite_prix: 7, images: []}, extra || {});
      return {text: JSON.stringify({comprehension: 'Une maison lumineuse pour 3 ans.', conseils: 'Les lumières à piles suffisent.', propositions: [it('Maison Étoile (réf. 1234)', max - 10), it('Villa Lune', max - 20), it('Palais Soleil', Math.round(max * 1.1))],
        presque: [it('Maison sans lumière Nuage', max - 5, {ecart: 'sans LED'})], pistes: [{texte: 'Monte le maximum à ' + Math.round(max * 1.1) + ' €', max: Math.round(max * 1.1)}], certitude: 'likely', sources: ['https://exemple.fr/guide']}) + '\nVoilà {fin de la réponse}.'};
    }
    const P = Array.from({length: n}, (_, i) => ({nom: 'Maison de poupée ' + (i + 1), marque: i % 2 ? 'Djeco' : 'Hape', prix: Math.round((max - 1 - i) * 100) / 100, prix_detail: 'livraison offerte', vendeur: 'Vendeur ' + (i + 1),
      lien: i === 0 ? vb + '/idee-a' : i === 1 ? vb + '/produit-b' : vb + '/rien', date_prix: '2026-11-19', age: 'dès 3 ans', pourquoi: 'En bois, sans petites pièces, adaptée à 3 ans.', points_forts: ['Solide', 'Meubles inclus'], limites: ['Montage 20 min'], qualite: 8 - i * 0.2, rapport_qualite_prix: 7.5,
      images: i === 0 ? [vb + '/promo-a.png'] : []}));
    return {text: JSON.stringify({comprehension: 'Une maison de poupée pour une fille de 3 ans, dans ton budget.', conseils: 'Pour 3 ans : bois massif, grandes pièces, pas d’aimants.', propositions: [P[0], {nom: 'Château géant', prix: max * 2}, P[0], ...P.slice(1)], certitude: 'likely', sources: ['https://exemple.fr/guide']})};
  }
  /* 0.23.0 : comparatif des variantes d'un produit suivi (JSON) */
  if (/^Comparatif à préparer pour « /.test(input)) {
    const arr = JSON.parse(input.split('données) :\n')[1].split('\n')[0]);
    return {text: JSON.stringify({resume: 'Deux robots proches : le second lave mieux.', difference_cle: 'La serpillière vibrante du Sonic.', criteres: [{nom: 'Aspiration', unite: 'Pa', plus_haut_mieux: true}, {nom: 'Prix du jour', unite: '€', plus_haut_mieux: false}, {nom: 'Bruit', unite: 'dB', plus_haut_mieux: false}],
      variantes: arr.map((p, i) => ({nom: p.nom, pour_qui: 'Pour un appartement ' + (i ? 'avec carrelage' : 'avec tapis'), utilite: 'Aspire et lave chaque jour', points_forts: ['Puissant', 'Station autonome'], limites: ['Bruyant'], valeurs: {Aspiration: 20000 + i * 2000, Bruit: 64 - i}, qualite: 7 + i, rapport_qualite_prix: 8 - i, verdict: 'Bon choix ' + (i + 1), image: ''})),
      conseil: 'Prends le premier au prix du jour.', certitude: 'likely', sources: ['https://exemple.fr/test']})};
  }
  if (/en liste/i.test(input.split('Lui : ').pop())) return {text: '**Samedi** : parc.\n- Matin : marché\n- Soir : *cinéma*'};   /* 0.35.0 : mise en forme */
  if (/fin lente/i.test(input)) return {text: 'Réponse vite dite.', tail: 2500};
  if (/lentement/i.test(input.split('Lui : ').pop())) return {text: 'Réponse lente. ' + 'bla '.repeat(1500)};   /* 0.22.0 : pour couper JARVIS pendant qu'il répond */
  if (/erreur/i.test(input)) return {error: 'Invalid API key · Please run /login'};
  if (/outils refusés/.test(input)) return {text: 'refusés : ' + (args.includes('--disallowedTools') ? args.slice(args.indexOf('--disallowedTools') + 1).filter((x) => !x.startsWith('--')).join(',') : '')};
  if (/^Tour de JARVIS/.test(input)) {   /* tour de Claude (0.15.0) : prévient pour le mail du syndic, une seule fois */
    const before = raw.split('[Question]\n')[0], deja = /Alertes déjà données : .*Syndic à confirmer/.test(before);
    return {text: 'Voici : ' + JSON.stringify(/Courrier des 24 heures.*Dégât des eaux/.test(before) && !deja ? {notifier: true, titre: 'Syndic à confirmer', texte: "Le syndic attend ta confirmation pour l'expert de mardi."} : {notifier: false, titre: '', texte: ''})};
  }
  const demain = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  if (/rappelle-moi/i.test(input)) return {text: 'C\'est noté pour demain à 9 h.\nRELANCE: {"quand":"' + demain + 'T09:00","quoi":"Appeler le notaire"}'};
  if (/^Mission : planifie/.test(input)) return {toolUses: [{name: 'TodoWrite', input: {todos: [{content: 'Chercher les offres', status: 'in_progress'}, {content: 'Comparer les prix', status: 'pending'}, {content: 'Écrire le compte rendu', status: 'pending'}]}}, {name: 'WebSearch', input: {query: 'assurance habitation T3 comparatif'}}], pause: 2500, text: 'Compte rendu planifié : trois offres comparées.'};
  if (/^Mission : Reprends cette mission/.test(input)) return {text: 'Version 2 : ' + (input.match(/Sa consigne : ([^\n]+)/) || [])[1]};
  if (/^Mission : vérifie la réponse du syndic/.test(input)) return {text: 'Compte rendu : demande faite.\nRELANCE: {"quand":"' + demain + 'T10:30","quoi":"Voir si le syndic a répondu"}'};
  if (/^Mission : lente/.test(input)) return {text: /Reprise après un redémarrage/.test(input) ? 'Compte rendu repris.' : 'Compte rendu lent. ' + 'x'.repeat(2400)};
  if (/montre le contexte/.test(input)) return {text: raw.split('[Question]\n')[0]};   /* banc des Raccourcis : renvoie les données reçues */
  /* tâche « Ordres Jarvis » faite par le serveur : répond aux lignes données, laisse « à valider » ce qui touche une fiche */
  if (/Lignes du Canal de Pilotage adressées à Claude/.test(input)) {
    const arr = JSON.parse(input.slice(input.indexOf('['), input.indexOf(']\n') + 1));
    const lignes = arr.map((x) => /fiche/i.test(x.message) ? {ligne: x.ligne, reponse: 'Je propose de changer la fiche, à valider en conversation.', statut: 'À faire'} : {ligne: x.ligne, reponse: 'Réponse de Claude à : ' + x.message, statut: 'Fait'});
    return {text: JSON.stringify({lignes, verifie: /Onglet « Déploiement »/.test(input) ? [{ligne: 2, valeur: 'Conforme'}] : []}) + (/outils/.test(allow) ? '' : '')};
  }
  if (/Test d'accès aux données/.test(input)) return {tools: ['mcp__claude_ai_Google_Calendar__list_events', 'mcp__claude_ai_Gmail__search_threads'], text: 'Ton prochain événement est « Réunion ». Le dernier mail a pour objet « Facture ». Outils : ' + allow + '.'};
  if (/onglet Canal/.test(input)) return {text: 'Ligne écrite dans le Canal pour ' + (input.match(/pour le bot (\S+)/) || [])[1] + ' ; ' + (/N'envoie pas de sonnette/.test(input) ? 'pas de sonnette (pause).' : 'sonnette envoyée.') + ' Outils : ' + allow + '. Garde : ' + guard + '.'};
  /* 0.38.0 : les skills posées dans le dossier de travail de la mission, et l'outil Skill permis */
  if (/^Mission :.*liste tes skills/.test(input)) { let sk = []; try { sk = fs.readdirSync(path.join(process.cwd(), '.claude', 'skills')).sort(); } catch { sk = []; } return {text: 'Skills : ' + (sk.join(', ') || 'aucune') + ' ; outil Skill : ' + (/(^|,)Skill(,|$)/.test(allow) ? 'oui' : 'non') + '.'}; }
  if (/^Mission :/.test(input)) return {text: 'Compte rendu : mission faite (' + input.slice(10, 60) + ').'};
  if (/rapport/i.test(input)) return {text: 'Claude va préparer ce rapport, la mission attend ton accord.\nMISSIONS: [{"agent":"claude","text":"préparer un rapport sur la veille .NET"}]'};
  /* discussion de la page sur le serveur : propositions en fin de réponse (⟦outil …⟧), seulement si la consigne décrit les outils */
  const lastQ = input.split('Lui : ').pop(), sys = (opt('--append-system-prompt') || '') + '\n' + (opt('--system-prompt') || '') + '\n' + FIRST;
  /* 0.37.0 : la mémoire durable — ce qu'il reçoit dans sa consigne, et la proposition de retenir (si l'outil est décrit) */
  /* 0.42.0 : le rangement de la mémoire : deux propositions utiles (dont une qui remplace), et une bancaire que le serveur doit écarter */
  if (/Propose ce qu'il faut retenir/.test(input)) return {text: JSON.stringify({propositions: [{texte: 'Préfère les trains de nuit pour les longs trajets', remplace: ''}, {texte: 'Aime les randonnées le samedi', remplace: /Aime les randonnées le dimanche/.test(raw) ? 'Aime les randonnées le dimanche' : ''}, {texte: 'Mon IBAN est FR76 3000 6000 0112 3456 7890 189', remplace: ''}]})};
  /* 0.41.0 : Claude propose une routine (si l'outil est décrit) */
  if (/programme chaque lundi/i.test(lastQ)) return {text: /outil programmer_routine|- programmer_routine :/.test(sys) ? 'Je te propose cette routine.\n⟦outil programmer_routine {"phrase":"chaque lundi à 8 h, résume la semaine qui vient"}⟧' : 'Pas d’outil de routine.'};
  if (/que retiens-tu/i.test(lastQ)) return {text: 'Je retiens : ' + (/- Préfère les vols directs/.test(sys) ? 'vols directs' : 'rien') + ' ; Profil : ' + (/Végétarien le lundi/.test(sys) ? 'lu' : 'non lu') + ' ; finances : ' + (/plafond de dépenses/.test(sys) ? 'présentes' : 'absentes') + '.'};
  if (/retiens que/i.test(lastQ)) return {text: /outil retenir|- retenir :/.test(sys) ? 'Je te propose de le retenir.\n⟦outil retenir {"fait":"Préfère le train pour aller à Lyon"}⟧' : 'Pas d’outil pour retenir.'};
  if (/relance demain pour Iris/.test(lastQ)) return {text: /programmer_relance/.test(sys) ? 'Je te propose une relance : elle attend ton bouton.\n⟦outil programmer_relance {"quand":"' + demain + 'T09:00","quoi":"Voir si Iris a répondu au syndic","ligne":2}⟧' : 'Pas d’outil de relance.'};
  /* 0.34.0 : réponses illustrées — montre la première demande des données reçues (son titre exact), si l'outil est décrit */
  if (/montre-moi/i.test(lastQ)) { const t = (/"demandes_a_rabie":\[\{"bot":"[^"]*","titre":"([^"]+)"/.exec(sys) || [])[1]; return {text: /outil montrer|- montrer :/.test(sys) && t ? 'Voici la demande qui t’attend.\n⟦outil montrer {"titre":' + JSON.stringify(t) + ',"type":"demande"}⟧\n⟦outil montrer {"titre":"Élément qui n’existe pas"}⟧' : 'Pas d’outil montrer (' + (t || 'aucune demande') + ').'}; }
  if (/ordre de test pour Kairos/.test(lastQ)) return {text: /outil preparer_ordre/.test(sys) ? 'Je te propose cet ordre pour Kairos : il attend ton bouton.\n⟦outil preparer_ordre {"bot":"Kairos","message":"Relève le prix du robot cuiseur."}⟧' : 'Pas d’outils décrits.'};
  if (/confie à la tâche/.test(lastQ)) return {text: 'Je te propose de lancer la tâche Claude.\n```\n⟦outil confier_tache_claude {"demande":"Vérifie les routines d’Iris."}⟧\n```'};
  if (/kairos/i.test(input)) return {text: 'Je prépare ça pour Kairos, la mission attend ton accord.\nMISSIONS: [{"agent":"kairos","text":"vérifier le prix du robot cuiseur"}]'};
  if (/clé/i.test(input)) return {text: 'clé payante : ' + (process.env.ANTHROPIC_API_KEY ? 'présente' : 'absente') + ', base : ' + (process.env.ANTHROPIC_BASE_URL ? 'présente' : 'absente') + ', recherche d\'outils : ' + (process.env.ENABLE_TOOL_SEARCH || 'défaut') + '.'};
  return {text: 'Tu as dit : ' + input.trim() + '. Session : ' + (resume || turn > 1 ? 'reprise' : 'nouvelle') + ', modèle : ' + model + ', outils : ' + allow + ', garde : ' + guard + ', processus : ' + process.pid + ', tour : ' + turn + ', contexte : ' + (ctx ? 'oui' : 'non') + ', secours : ' + (opt('--fallback-model') || 'aucun') + ', intégrés : ' + (args.includes('--tools') ? '[' + opt('--tools') + ']' : 'défaut') + ', consigne : ' + (opt('--system-prompt') ? 'remplacée' : 'ajoutée') + (raw.includes('[Entre-temps, JARVIS a répondu seul') ? ', entre-temps : oui' : '') + '.'};
}
async function emit(a) {
  if (a.error) { process.stderr.write(a.error + '\n'); out({type: 'result', is_error: true, result: a.error, session_id: sid}); return false; }
  if (a.tools) out({type: 'assistant', session_id: sid, message: {content: a.tools.map((name) => ({type: 'tool_use', name, input: {}}))}});
  if (a.toolUses) for (const t of a.toolUses) { out({type: 'assistant', session_id: sid, message: {content: [{type: 'tool_use', name: t.name, input: t.input}]}}); await new Promise((r) => setTimeout(r, 200)); }
  if (a.pause) await new Promise((r) => setTimeout(r, a.pause));
  for (let i = 0; i < a.text.length; i += 7) { out({type: 'stream_event', session_id: sid, event: {type: 'content_block_delta', index: 0, delta: {type: 'text_delta', text: a.text.slice(i, i + 7)}}}); await new Promise((r) => setTimeout(r, +(process.env.FAKE_DELAY || 5))); }
  out({type: 'assistant', session_id: sid, message: {content: [{type: 'text', text: a.text}]}});
  out({type: 'stream_event', session_id: sid, event: {type: 'message_delta', delta: {stop_reason: 'end_turn'}}}); out({type: 'stream_event', session_id: sid, event: {type: 'message_stop'}});
  if (a.tail) await new Promise((r) => setTimeout(r, a.tail));   /* 0.30.0 : le vrai Claude Code met 0,3 à 3 s à finir son tour après le dernier mot */
  out({type: 'result', subtype: 'success', is_error: false, result: a.text, session_id: sid, usage: {input_tokens: 120, output_tokens: Math.ceil(a.text.length / 4), cache_read_input_tokens: 900, cache_creation_input_tokens: 60}});
  return true;
}
if (opt('--input-format') === 'stream-json') {
  /* conversation ouverte : une demande par ligne, une réponse (« result ») par demande */
  init(); let buf = '', chain = Promise.resolve();
  process.stdin.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); let m; try { m = JSON.parse(line); } catch { continue; } const text = (m.message?.content || []).map((c) => c.text || '').join('\n'); chain = chain.then(() => emit(answer(text))); } });
  process.stdin.on('end', () => chain.then(() => process.exit(0)));
} else {
  let input = '';
  process.stdin.on('data', (d) => { input += d; });
  process.stdin.on('end', async () => { init(); const ok = await emit(answer(input)); process.exit(ok ? 0 : 1); });
}
