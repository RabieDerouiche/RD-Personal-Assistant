/* Le catalogue des agents. Aucune connexion n'est active en phase 2 : chaque agent dit comment il sera relié. */
export type AgentId = 'claude' | 'jarvis' | 'iris' | 'chronos' | 'kairos' | 'ulysse' | 'athena' | 'argus';
export type Provider = 'claude' | 'grok';

export interface Agent {
  id: AgentId;
  name: string;
  provider: Provider;
  role: string;
  skills: string[];
  link: string;      /* comment l'agent sera joint */
  keywords: RegExp;  /* ce qui l'appelle en mode AUTO */
}

export const AGENTS: Agent[] = [
  {id: 'claude', name: 'Claude', provider: 'claude', role: 'Analyse, développement, rapports',
    skills: ['Analyse complexe', 'Développement (Claude Code)', 'Rapports et documents'],
    link: 'Réponse en direct : Claude Code sur ton serveur (phase 3). Missions longues : déclencheur d\'API d\'une tâche Claude Code.',
    keywords: /\b(claude|analys|d[ée]velopp|code|programme|rapport|document|r[ée]dige|[ée]cris|corrige|explique)/i},
  {id: 'jarvis', name: 'Jarvis (Grok)', provider: 'grok', role: 'Chef d\'orchestre des bots Grok',
    skills: ['Répartit le travail entre les bots', 'Appel vocal Grok'],
    link: 'Webhook de routine Grok Bot (phase 4).', keywords: /\b(grok|les bots|l'[ée]quipe)\b/i},
  {id: 'iris', name: 'Iris', provider: 'grok', role: 'Courrier, agenda, dossiers, papiers',
    skills: ['Courrier', 'Agenda', 'Dossiers et relances', 'Papiers'],
    link: 'Webhook de routine Grok Bot (phase 4).', keywords: /\b(iris|mail|courrier|factur|dossier|papier|relance|agenda|rendez-vous)/i},
  {id: 'chronos', name: 'Chronos', provider: 'grok', role: 'Notes de frais et CRA',
    skills: ['Notes de frais', 'Comptes rendus d\'activité'],
    link: 'Webhook de routine Grok Bot (phase 4).', keywords: /\b(chronos|cra|note[s]? de frais|feuille de temps|timesheet)/i},
  {id: 'kairos', name: 'Kairos', provider: 'grok', role: 'Prix suivis et alertes d\'achat',
    skills: ['Suivi des prix', 'Alertes d\'achat'],
    link: 'Webhook de routine Grok Bot (phase 4).', keywords: /\b(kairos|prix|achat|ach[eè]te|promo|bon plan|black friday)/i},
  {id: 'ulysse', name: 'Ulysse', provider: 'grok', role: 'Sorties et voyages',
    skills: ['Sorties en famille', 'Réservations', 'Projets de voyage'],
    link: 'Webhook de routine Grok Bot (phase 4).', keywords: /\b(ulysse|sortie|voyage|vacances|week-end|weekend|r[ée]serv)/i},
  {id: 'athena', name: 'Athéna', provider: 'grok', role: 'Veille IA et .NET',
    skills: ['Veille du lundi'],
    link: 'Webhook de routine Grok Bot (phase 4).', keywords: /\b(ath[ée]na|veille|\.net|actualit)/i},
  {id: 'argus', name: 'Argus', provider: 'grok', role: 'Supervision des bots',
    skills: ['Socle commun', 'Supervision'],
    link: 'Webhook de routine Grok Bot (phase 4).', keywords: /\b(argus|supervis|surveill)/i}
];

export const agent = (id: AgentId): Agent => AGENTS.find((a) => a.id === id) as Agent;
