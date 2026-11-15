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
  if (/^Mission :/.test(input)) reply = 'Compte rendu : mission faite (' + input.slice(10, 60) + ').';
  else if (/rapport/i.test(input)) reply = "Claude va préparer ce rapport, la mission attend ton accord.\nMISSIONS: [{\"agent\":\"claude\",\"text\":\"préparer un rapport sur la veille .NET\"}]";
  else if (/kairos/i.test(input)) reply = 'Je prépare ça pour Kairos, la mission attend ton accord.\nMISSIONS: [{"agent":"kairos","text":"vérifier le prix du robot cuiseur"}]';
  else if (/clé/i.test(input)) reply = 'clé payante : ' + (process.env.ANTHROPIC_API_KEY ? 'présente' : 'absente') + ', base : ' + (process.env.ANTHROPIC_BASE_URL ? 'présente' : 'absente') + '.';
  else reply = 'Tu as dit : ' + input.trim() + '. Session : ' + (resume ? 'reprise' : 'nouvelle') + ', modèle : ' + model + ', outils : ' + allow + '.';
  out({type: 'system', subtype: 'init', session_id: sid, model});
  for (let i = 0; i < reply.length; i += 7) { out({type: 'stream_event', session_id: sid, event: {type: 'content_block_delta', index: 0, delta: {type: 'text_delta', text: reply.slice(i, i + 7)}}}); await new Promise((r) => setTimeout(r, +(process.env.FAKE_DELAY || 5))); }
  out({type: 'assistant', session_id: sid, message: {content: [{type: 'text', text: reply}]}});
  out({type: 'result', subtype: 'success', is_error: false, result: reply, session_id: sid});
});
