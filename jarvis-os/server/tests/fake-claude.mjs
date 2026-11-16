#!/usr/bin/env node
/* Faux Claude Code pour le banc : imite `claude -p --output-format stream-json` et `claude auth status --json`. */
const args = process.argv.slice(2);
if (args[0] === 'auth') { console.log(JSON.stringify({loggedIn: true, authMethod: 'claude.ai'})); process.exit(0); }
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
let input = '';
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', async () => {
  const ri = args.indexOf('--resume'), resume = ri >= 0 ? args[ri + 1] : null;
  const sid = resume || 'sess-' + Math.random().toString(36).slice(2, 8);
  const model = args[args.indexOf('--model') + 1];
  const allow = args.includes('--allowedTools') ? args.slice(args.indexOf('--allowedTools') + 1, args.indexOf('--disallowedTools')).join(',') : '';
  if (/erreur/i.test(input)) { process.stderr.write('Invalid API key · Please run /login\n'); out({type: 'result', is_error: true, result: 'Invalid API key · Please run /login', session_id: sid}); process.exit(1); }
  let reply;
  const si = args.indexOf('--settings'); let guard = 'aucune';
  if (si >= 0) { try { guard = JSON.parse((await import('node:fs')).readFileSync(args[si + 1], 'utf8')).hooks.PreToolUse[0].hooks[0].command.split(' ').pop(); } catch { guard = 'illisible'; } }
  if (/onglet Canal/.test(input)) reply = 'Ligne écrite dans le Canal pour ' + (input.match(/pour le bot (\S+)/) || [])[1] + ' ; ' + (/N'envoie pas de sonnette/.test(input) ? 'pas de sonnette (pause).' : 'sonnette envoyée.') + ' Outils : ' + allow + '. Garde : ' + guard + '.';
  else if (/^Mission :/.test(input)) reply = 'Compte rendu : mission faite (' + input.slice(10, 60) + ').';
  else if (/rapport/i.test(input)) reply = "Claude va préparer ce rapport, la mission attend ton accord.\nMISSIONS: [{\"agent\":\"claude\",\"text\":\"préparer un rapport sur la veille .NET\"}]";
  else if (/kairos/i.test(input)) reply = 'Je prépare ça pour Kairos, la mission attend ton accord.\nMISSIONS: [{"agent":"kairos","text":"vérifier le prix du robot cuiseur"}]';
  else if (/clé/i.test(input)) reply = 'clé payante : ' + (process.env.ANTHROPIC_API_KEY ? 'présente' : 'absente') + ', base : ' + (process.env.ANTHROPIC_BASE_URL ? 'présente' : 'absente') + '.';
  else reply = 'Tu as dit : ' + input.trim() + '. Session : ' + (resume ? 'reprise' : 'nouvelle') + ', modèle : ' + model + ', outils : ' + allow + ', garde : ' + guard + '.';
  const conn = process.env.FAKE_NO_CONN ? [] : ['mcp__claude_ai_Gmail__search_threads', 'mcp__claude_ai_Gmail__get_thread', 'mcp__claude_ai_Gmail__send_message', 'mcp__claude_ai_Gmail__create_draft', 'mcp__claude_ai_Google_Calendar__list_events', 'mcp__claude_ai_Google_Calendar__create_event', 'mcp__claude_ai_Google_Sheets__get_values', 'mcp__claude_ai_Google_Sheets__append_values'];
  out({type: 'system', subtype: 'init', session_id: sid, model, tools: ['Bash', 'Read', 'WebSearch', 'WebFetch', ...conn], mcp_servers: conn.length ? [{name: 'claude.ai Gmail', status: 'connected'}, {name: 'claude.ai Google Calendar', status: 'connected'}, {name: 'claude.ai Google Sheets', status: 'connected'}] : []});
  for (let i = 0; i < reply.length; i += 7) { out({type: 'stream_event', session_id: sid, event: {type: 'content_block_delta', index: 0, delta: {type: 'text_delta', text: reply.slice(i, i + 7)}}}); await new Promise((r) => setTimeout(r, +(process.env.FAKE_DELAY || 5))); }
  out({type: 'assistant', session_id: sid, message: {content: [{type: 'text', text: reply}]}});
  out({type: 'result', subtype: 'success', is_error: false, result: reply, session_id: sid});
});
