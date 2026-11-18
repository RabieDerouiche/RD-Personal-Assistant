#!/usr/bin/env node
/* Faux Claude Code pour le banc : imite `claude -p --output-format stream-json` (une demande sur l'entrée standard),
   l'entrée en flux (`--input-format stream-json`, une conversation qui reste ouverte), `claude auth status` et `claude mcp list`. */
import fs from 'node:fs';
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
let turn = 0;
function answer(raw) {
  turn++;
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
  /* 0.23.0 : comparatif des variantes d'un produit suivi (JSON) */
  if (/^Comparatif à préparer pour « /.test(input)) {
    const arr = JSON.parse(input.split('données) :\n')[1].split('\n')[0]);
    return {text: JSON.stringify({resume: 'Deux robots proches : le second lave mieux.', difference_cle: 'La serpillière vibrante du Sonic.', criteres: [{nom: 'Aspiration', unite: 'Pa', plus_haut_mieux: true}, {nom: 'Bruit', unite: 'dB', plus_haut_mieux: false}],
      variantes: arr.map((p, i) => ({nom: p.nom, pour_qui: 'Pour un appartement ' + (i ? 'avec carrelage' : 'avec tapis'), utilite: 'Aspire et lave chaque jour', points_forts: ['Puissant', 'Station autonome'], limites: ['Bruyant'], valeurs: {Aspiration: 20000 + i * 2000, Bruit: 64 - i}, qualite: 7 + i, rapport_qualite_prix: 8 - i, verdict: 'Bon choix ' + (i + 1), image: ''})),
      conseil: 'Prends le premier au prix du jour.', certitude: 'likely', sources: ['https://exemple.fr/test']})};
  }
  if (/lentement/i.test(input)) return {text: 'Réponse lente. ' + 'bla '.repeat(1500)};   /* 0.22.0 : pour couper JARVIS pendant qu'il répond */
  if (/erreur/i.test(input)) return {error: 'Invalid API key · Please run /login'};
  if (/outils refusés/.test(input)) return {text: 'refusés : ' + (args.includes('--disallowedTools') ? args.slice(args.indexOf('--disallowedTools') + 1).filter((x) => !x.startsWith('--')).join(',') : '')};
  if (/^Tour de JARVIS/.test(input)) {   /* tour de Claude (0.15.0) : prévient pour le mail du syndic, une seule fois */
    const before = raw.split('[Question]\n')[0], deja = /Alertes déjà données : .*Syndic à confirmer/.test(before);
    return {text: 'Voici : ' + JSON.stringify(/Courrier des 24 heures.*Dégât des eaux/.test(before) && !deja ? {notifier: true, titre: 'Syndic à confirmer', texte: "Le syndic attend ta confirmation pour l'expert de mardi."} : {notifier: false, titre: '', texte: ''})};
  }
  const demain = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  if (/rappelle-moi/i.test(input)) return {text: 'C\'est noté pour demain à 9 h.\nRELANCE: {"quand":"' + demain + 'T09:00","quoi":"Appeler le notaire"}'};
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
  if (/^Mission :/.test(input)) return {text: 'Compte rendu : mission faite (' + input.slice(10, 60) + ').'};
  if (/rapport/i.test(input)) return {text: 'Claude va préparer ce rapport, la mission attend ton accord.\nMISSIONS: [{"agent":"claude","text":"préparer un rapport sur la veille .NET"}]'};
  /* discussion de la page sur le serveur : propositions en fin de réponse (⟦outil …⟧), seulement si la consigne décrit les outils */
  const lastQ = input.split('Lui : ').pop(), sys = opt('--append-system-prompt') || '';
  if (/relance demain pour Iris/.test(lastQ)) return {text: /programmer_relance/.test(sys) ? 'Je te propose une relance : elle attend ton bouton.\n⟦outil programmer_relance {"quand":"' + demain + 'T09:00","quoi":"Voir si Iris a répondu au syndic","ligne":2}⟧' : 'Pas d’outil de relance.'};
  if (/ordre de test pour Kairos/.test(lastQ)) return {text: /outil preparer_ordre/.test(sys) ? 'Je te propose cet ordre pour Kairos : il attend ton bouton.\n⟦outil preparer_ordre {"bot":"Kairos","message":"Relève le prix du robot cuiseur."}⟧' : 'Pas d’outils décrits.'};
  if (/confie à la tâche/.test(lastQ)) return {text: 'Je te propose de lancer la tâche Claude.\n```\n⟦outil confier_tache_claude {"demande":"Vérifie les routines d’Iris."}⟧\n```'};
  if (/kairos/i.test(input)) return {text: 'Je prépare ça pour Kairos, la mission attend ton accord.\nMISSIONS: [{"agent":"kairos","text":"vérifier le prix du robot cuiseur"}]'};
  if (/clé/i.test(input)) return {text: 'clé payante : ' + (process.env.ANTHROPIC_API_KEY ? 'présente' : 'absente') + ', base : ' + (process.env.ANTHROPIC_BASE_URL ? 'présente' : 'absente') + ', recherche d\'outils : ' + (process.env.ENABLE_TOOL_SEARCH || 'défaut') + '.'};
  return {text: 'Tu as dit : ' + input.trim() + '. Session : ' + (resume || turn > 1 ? 'reprise' : 'nouvelle') + ', modèle : ' + model + ', outils : ' + allow + ', garde : ' + guard + ', processus : ' + process.pid + ', tour : ' + turn + ', contexte : ' + (ctx ? 'oui' : 'non') + '.'};
}
async function emit(a) {
  if (a.error) { process.stderr.write(a.error + '\n'); out({type: 'result', is_error: true, result: a.error, session_id: sid}); return false; }
  if (a.tools) out({type: 'assistant', session_id: sid, message: {content: a.tools.map((name) => ({type: 'tool_use', name, input: {}}))}});
  for (let i = 0; i < a.text.length; i += 7) { out({type: 'stream_event', session_id: sid, event: {type: 'content_block_delta', index: 0, delta: {type: 'text_delta', text: a.text.slice(i, i + 7)}}}); await new Promise((r) => setTimeout(r, +(process.env.FAKE_DELAY || 5))); }
  out({type: 'assistant', session_id: sid, message: {content: [{type: 'text', text: a.text}]}});
  out({type: 'result', subtype: 'success', is_error: false, result: a.text, session_id: sid, usage: {input_tokens: 120, output_tokens: Math.ceil(a.text.length / 4), cache_read_input_tokens: 900, cache_creation_input_tokens: 60}});
  return true;
}
if (opt('--input-format') === 'stream-json') {
  /* conversation ouverte : une demande par ligne, une réponse (« result ») par demande */
  init(); let buf = '', chain = Promise.resolve();
  process.stdin.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); let m; try { m = JSON.parse(line); } catch { continue; } const text = (m.message?.content || []).map((c) => c.text || '').join(''); chain = chain.then(() => emit(answer(text))); } });
  process.stdin.on('end', () => chain.then(() => process.exit(0)));
} else {
  let input = '';
  process.stdin.on('data', (d) => { input += d; });
  process.stdin.on('end', async () => { init(); const ok = await emit(answer(input)); process.exit(ok ? 0 : 1); });
}
