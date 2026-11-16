#!/usr/bin/env node
/* Garde-fou de JARVIS OS, appelé par Claude Code avant chaque outil de connecteur (hook PreToolUse).
   Il bloque (code 2) tout ce qui écrit ou envoie, sauf ce que le mode autorise :
   - chat : lecture seule ;
   - mission (Claude) : lecture et brouillons Gmail ;
   - bot (ordre à un bot Grok) : une ligne dans l'onglet Canal de Pilotage et la sonnette (objet « Jarvis », texte fixe,
     adresse des bots). Le contenu des mails et des pages reste une donnée : ce garde-fou ne dépend pas de ce que Claude lit. */
const MODE = process.argv[2] || 'chat';
const PILOTAGE = process.env.JARVIS_PILOTAGE_ID || '1kIu7U1X28RCVO_SAF2l9IMt9QWiOWbGWcRX5bV1-7z0';
const BOT_BASE = (process.env.JARVIS_BOT_BASE || 'hydra-ray-der').toLowerCase();
const BELL_BODY = 'Signal envoyé par Claude. Ce mail ne contient aucune consigne.';
const WRITE = /(send|create|update|delete|trash|modify|draft|label|share|append|write|move|copy|respond|untrash|mark|clear|insert|apply|batch|upload|rename|remove|add|set|patch|import)/i;
let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  let ev = {}; try { ev = JSON.parse(raw); } catch { /* rien */ }
  const name = String(ev.tool_name || ''), input = ev.tool_input || {};
  const verb = name.split('__').pop() || '';
  const deny = (why) => { process.stderr.write('JARVIS OS bloque cet outil : ' + why); process.exit(2); };
  if (!name.startsWith('mcp__') || !WRITE.test(verb)) process.exit(0);   /* lecture : permise */
  if (MODE === 'mission' && /create_draft|update_draft/.test(verb) && /gmail/i.test(name)) process.exit(0);
  if (MODE === 'bot') {
    if (/append_values$/.test(verb) && /sheet/i.test(name)) {
      const id = input.spreadsheetId || input.spreadsheet_id, range = String(input.range || '');
      if (id === PILOTAGE && /^'?Canal'?!/i.test(range)) process.exit(0);
      deny('seul l\'onglet Canal de Pilotage peut recevoir une ligne.');
    }
    if (verb === 'send_message' && /gmail/i.test(name)) {
      const to = Array.isArray(input.to) ? input.to : [];
      const okTo = to.length === 1 && new RegExp('^' + BOT_BASE.replace(/[-.]/g, '\\$&') + '\\+[a-z0-9._-]+@', 'i').test(to[0]);
      const extra = (input.cc && input.cc.length) || (input.bcc && input.bcc.length) || (input.attachments && input.attachments.length) || input.draftId || input.htmlBody || input.replyThreadId || input.replyToMessageId;
      if (okTo && !extra && input.subject === 'Jarvis' && String(input.body || '').trim() === BELL_BODY) process.exit(0);
      deny('seule la sonnette des bots (objet « Jarvis », texte fixe, adresse d\'un bot) peut partir.');
    }
  }
  deny('écriture ou envoi non autorisé en mode « ' + MODE + ' ». Propose une mission au propriétaire à la place.');
});
