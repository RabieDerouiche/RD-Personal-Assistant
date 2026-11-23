# Hermes Agent sur le serveur de JARVIS OS (essai, depuis le 23/11/2026)

À lire avant de toucher à Hermes. Kit : `jarvis-os/hermes/` (son `README.md` décrit chaque fichier). Banc :
`essais/hermes/banc.sh`. Rien de personnel ici (ni identifiant Telegram, ni adresse du serveur, ni jeton) :
tout cela reste sur le serveur.

## Pourquoi, et ce qui a été décidé (QCM du 23/11/2026)

Sa demande : mettre en place Hermes sur le serveur, « de la bonne façon » (sécurité, fiabilité, optimisation),
puis le configurer sur son Telegram ensemble et le relier à JARVIS, étape par étape. Rappel fait d'abord :
le 22/11 il avait choisi « Garder Grok Bot » (`docs/systeme-grok-bot.md`, section « Le coût ») et aucun fait
nouveau n'était noté dans Pilotage ; c'est sa décision de faire l'essai quand même.

| Question | Son choix |
|---|---|
| Rôle | « Un peu les trois » : tester des routines dans Hermes, voir jusqu'où il va, puis soit remplacer Grok Bot, soit alléger son usage ; le relier à JARVIS ; Claude proposera plus tard un déroulé idéal |
| Serveur | Mesurer d'abord : vérifier sur le VPS-1 actuel si la mémoire pose un vrai problème ; VPS-2 seulement si c'est sûr que JARVIS serait bridé |
| Modèle | Son abonnement Claude, par le plugin (« déjà accepté ») ; par défaut **Claude Opus 5.5** (second QCM : le plus capable, pour juger honnêtement ; il use le forfait environ deux fois plus vite que Sonnet) ; `/model` dans le chat pour changer |
| Bot Telegram | **Un nouveau bot** (le jeton de l'ancien bot d'octobre est resté sur l'ancien serveur ; à supprimer chez @BotFather) |
| Pouvoirs | Aucun pour le moment ; à ouvrir progressivement après l'étude de faisabilité et du déroulé idéal |

## L'abonnement Claude dans Hermes : ce qui est permis (vérifié le 23/11/2026)

- (certain) Le plugin « Claude Subscription DirectSDK (Experimental) » est publié par Nous Research
  (catalogue officiel d'Hermes, v0.4.0, commit `72eb3b8`). Il lance le vrai Claude Code (`claude -p`), un
  processus par requête (environ 250 Mo chacun), sans aucun de ses outils (`--tools ''`), et se présente
  sous son vrai nom (`hermes-agent`). Sa doc dit : « review build, not a full-parity or
  production-readiness claim ».
- (certain) Aide d'Anthropic (« Use the Agent SDK with your Claude plan », mise à jour du 07/10/2026) :
  « Claude Agent SDK, claude -p, and third-party app usage still draw from your subscription limits. »
- (certain) Aide d'Anthropic (article 13189465, mis à jour le 22/11/2026) : la voie préférée pour un outil
  tiers est une clé d'API ; Anthropic « reserves the right to draw use of such third-party tools from usage
  credits rather than subscription limits » ; les outils « that misrepresent their identity to Anthropic's
  servers » sont interdits.
- Conséquences :
  - (Likely) le plugin est toléré aujourd'hui ;
  - (certain) il prend sur le même forfait Max que JARVIS et les sessions de développement ;
  - (Likely) Anthropic peut le basculer sur l'usage payant : le plugin a déjà le message « Third-party apps
    now draw from your extra usage ». Avec `extra_usage: stop`, Hermes s'arrête alors au lieu de facturer.
- **Jamais le fournisseur « anthropic » d'Hermes en OAuth** : (certain, code de la 0.23.3) il envoie
  l'agent utilisateur et l'invite de Claude Code, et renomme des outils pour ne pas être reconnu. C'est le cas
  interdit.
- **Plan B prêt** (certain, aide d'Anthropic) : Max inclut 100 $ de crédits d'API par mois depuis le
  07/10/2026, à réclamer sur claude.ai (Réglages, Facturation, crédits d'API, « Link organization ») après
  7 jours d'abonnement. Couvre l'API Messages avec une clé de l'organisation liée ;
  « API requests stop » quand ils sont épuisés (sans recharge automatique). C'est une enveloppe séparée de
  celle de JARVIS. Passer dessus = `model.provider: anthropic` + `ANTHROPIC_API_KEY` dans la politique et
  `~/.hermes/.env`, et `auth.adopt_external_logins: false` (déjà posé).

## Ce qui est installé et où (serveur)

| Quoi | Où |
|---|---|
| Utilisateur | `hermes` (système, sans shell, sans sudo, `/home/hermes` en 0700) |
| Hermes v0.23.3 | `/home/hermes/.hermes/hermes-agent` (commit `caafe53`), outils de son gestionnaire (Python 3.14, Node, ffmpeg) dans `/home/hermes/.hermes/tools` ; environ 3 Go en tout |
| Données d'Hermes | `/home/hermes/.hermes` : `config.yaml` (le sien), `.env` (0600 : jeton du bot), `memories/`, `sessions/`, `logs/` |
| Claude Code d'Hermes | `/home/hermes/.local/lib/claude-code` (2.1.330, séparé de celui de JARVIS) ; connexion dans `/home/hermes/.claude` |
| Politique (root) | `/etc/hermes/config.yaml` (copie de `politique.yaml`), `/etc/hermes/.env` (identifiant Telegram autorisé, interdictions) |
| Service | `hermes-gateway.service` (et `hermes-sortie.service` pour les règles réseau, `/etc/hermes/sortie.nft`) |

JARVIS, Panier, Caddy et ufw ne changent pas. Rien n'est ouvert vers Internet : Telegram est interrogé en
sortie (polling). Hermes ouvre seulement une petite API locale pour ses propres clients (127.0.0.1, port
aléatoire) : sans jeton, elle ne donne que sa version et son état ; sessions, mémoire, réglages et
discussion répondent 401 (vérifié au banc). `setup.sh` de JARVIS ne touche pas à Hermes.

## Garde-fous (et comment ils ont été vérifiés)

1. **Utilisateur à part, enfermé par systemd** : il ne voit ni `/home/jarvis` (état, jetons Google), ni
   `/root`, ni `/opt` ; il n'écrit que dans `/home/hermes`. Aucune capacité, pas de nouveaux privilèges,
   appels système filtrés. Score `systemd-analyze security` : 1,4 « OK » (un service sans durcissement est vers
   9,6). Aucun code d'Hermes ne tourne en root : son unité est écrite par `install.sh` (mêmes lignes que
   `hermes gateway install --system`, relevées au banc).
2. **Politique figée par root** (« portée gérée » d'Hermes) : Hermes ne peut la changer ni par
   `hermes config`, ni par le chat. Étape 1 : sur Telegram, 4 outils seulement (`memory`, `session_search`,
   `todo`, `clarify`) ; pas de terminal, fichiers, web, navigateur, code, vision, skills, sous-agents, tâches
   planifiées, connexions ni MCP ; 12 appels d'outils au plus par message ; approbations manuelles.
3. **Commandes du chat** : personne n'est administrateur ; il garde `/new`, `/stop`, `/model`, `/usage`,
   `/status`, `/retry`, `/undo`… et n'a ni `/update`, ni `/yolo`, ni `/tools`, ni `/restart`, ni `/approvals`.
4. **Telegram** : seul son identifiant (imposé par root) est servi ; un inconnu ne reçoit rien, pas même un
   code d'appairage ; le bot ne se met pas dans les groupes (`/setjoingroups` : Disable).
5. **Réseau** (`sortie.nft`, table à part, ufw intact) : depuis l'utilisateur `hermes`, sur la machine, seuls
   le DNS et les ports éphémères (le relais local du plugin) ; ni JARVIS (8787), ni Panier, ni
   l'administration de Caddy (2019), ni SSH, ni réseau privé, ni métadonnées du fournisseur ; HTTPS vers
   Internet et vers l'adresse publique du serveur (pour relier JARVIS plus tard).
6. **Forfait** : `extra_usage: stop` (jamais de dépassement payant), un seul Claude Code à la fois,
   relecture de fond coupée, conversation résumée au-delà de 60 000 tokens. À vérifier aussi dans son
   compte : l'usage supplémentaire payant coupé.
7. **Secrets** : le jeton du bot et la connexion Claude se saisissent dans Termius, jamais dans une
   conversation ; `telegram.sh` ne met jamais le jeton sur une ligne de commande.
8. **Mises à jour** : version figée (commit, empreinte de l'installeur, plugin épinglé, Claude Code à une
   version précise) ; pas de vérification automatique ; `/update` interdit dans le chat. Changer de version :
   relire les notes de version, modifier `install.sh`, passer le banc, fusionner, relancer `install.sh`.

Mémoire et processeur : `MemoryHigh=650M`, `MemoryMax=800M`, `OOMScoreAdjust=600` (Hermes est tué avant
JARVIS), `CPUWeight=20`.

## Mesures du banc (conteneur de session, 23/11/2026)

- Installation : 78 s, environ 3 Go sur le disque (dont ffmpeg 440 Mo, Node 230 Mo, Python 260 Mo, Claude
  Code 364 Mo).
- Mémoire : 325 à 360 Mo au repos selon les passes (passerelle connectée, 5 outils), plus environ 250 Mo par Claude Code
  pendant une réponse (doc du plugin). Pic attendu : environ 600 Mo.
- JARVIS se retient sous 900 Mo libres (préparation de Claude), 600 Mo (seconde mission) et 400 Mo (Siri) :
  `diagnostic.sh` calcule la marge sur le vrai serveur et donne le verdict VPS-1 ou VPS-2.

### Mesure du vrai serveur (23/11/2026, commandes en lecture seule, session « Serveur JARVIS »)

| Relevé | Valeur |
|---|---|
| Machine | 2 cœurs, 3,8 Go, échange de 2 Go (20 Mo utilisés), disque 29 Go libres sur 38 |
| Disponible à l'instant | 1,86 Go, JARVIS près de son pic (1,52 Go cache compris ; pic 1,54 Go depuis sa relance du matin) |
| Autres pics | session d'administration (`jarvis-rc`) 0,7 Go, Panier 0,2 Go, Caddy 0,08 Go |
| Plus gros processus | l'écoute (Python, environ 1 Go), les Claude Code (0,15 à 0,26 Go chacun) |
| Historique | aucun processus tué faute de mémoire en 6 jours ; pression mémoire quasi nulle (4 s cumulées) |
| Ports en écoute | JARVIS 8787, Panier 8790, Caddy 2019 et 80, DNS, SSH : tous couverts par `sortie.nft` |

Verdict (Likely) : **le VPS-1 suffit pour l'étape 1**.
- Avec Hermes, il reste environ 1,5 Go disponibles au repos et 1,25 Go pendant une de ses réponses.
- Seul le cumul des pics (session d'administration ouverte, mission de JARVIS et réponse d'Hermes en même
  temps) peut descendre sous 900 Mo. JARVIS ne prépare alors pas Sonnet d'avance : la première réponse
  vocale est un peu plus lente, rien ne casse (échange de 2 Go, Hermes tué avant JARVIS).
- Selon sa règle (« VPS-2 seulement si on est sûr que ce sera bridé »), on reste en VPS-1 et on mesure.
- Pour la mesure : depuis JARVIS 0.70.1, chaque retenue de JARVIS faute de mémoire est notée dans son
  journal, et `diagnostic.sh` les compte sur 7 jours.
- Plafond d'Hermes resserré pour le VPS-1 : `MemoryHigh=650M`, `MemoryMax=800M`.

### Le forfait partagé (sa demande : « Hermes et JARVIS doivent bien fonctionner »)

- (certain, code du plugin) La réserve du plugin (`extra_usage_reserve_percent`, arrêt avant X % de la
  fenêtre) n'agit que si l'usage supplémentaire payant est activé sur le compte. Il est coupé, et doit le
  rester : sinon JARVIS et les sessions de développement pourraient le consommer à leur tour.
- Aujourd'hui, rien n'empêche donc Hermes de consommer toute la fenêtre de 5 heures ou de la semaine :
  JARVIS s'arrêterait alors aussi jusqu'à la remise à zéro.
- (guessing, d'après les mesures publiées par le plugin) À l'étape 1 (discussion seule), un message d'Hermes
  sur Opus prend de l'ordre de 0,02 à 0,1 % de la fenêtre de 5 heures. Le risque viendra avec les routines
  (étape 4).
- **Avant l'étape 4**, construire un garde-fou :
  - une minuterie root lit l'usage du forfait (sans appel au modèle, comme `/usage` du plugin) ;
  - elle arrête Hermes au-delà d'un seuil choisi par le propriétaire, par exemple 70 %, et le relance
    après la remise à zéro.
- Surveiller en attendant : `/usage` dans le chat d'Hermes (même compte, donc même chiffre que JARVIS), et
  la page d'usage de claude.ai.

Défauts d'Hermes 0.23.3 trouvés au banc et contournés :

- **Fichier de réglages cassé** : quand la politique fige toutes les clés d'une section (`model`), une
  tentative de `hermes tools enable` réécrit `~/.hermes/config.yaml` de façon illisible, et Hermes ne
  démarre plus. Contournement : `model.base_url` reste chez l'utilisateur (`politique.yaml` le dit).
- **`hermes tools enable` affiche « Enabled »** alors que la politique l'emporte. `hermes tools list` dit
  la vérité (4 outils).
- **Adresses de secours de Telegram** : Hermes interroge dns.google et Cloudflare au démarrage. Coupé par
  `HERMES_TELEGRAM_DISABLE_FALLBACK_IPS=true`.

Banc (`sudo bash essais/hermes/banc.sh --neuf`, dans une session cloud seulement, jamais sur le serveur) :
installation par `install.sh`, droits, politique et refus, unités et score systemd, règles réseau chargées pour
de vrai (faux JARVIS sur 8787 injoignable), faux Telegram et faux modèle (inconnu ignoré, réponse au
propriétaire, outils annoncés, terminal refusé par `tool_call` et inexistant en appel direct, commandes
interdites), mémoire, API locale seulement sur 127.0.0.1 et fermée sans jeton.

Non vérifiable au banc : le vrai plugin avec son abonnement, le vrai Telegram, l'enfermement sous un vrai
systemd (vérifié par `systemd-analyze` seulement), `runuser` et `sudo-rs` d'Ubuntu 26.04, les règles réseau à
côté d'ufw, Claude Code sous le filtre d'appels système. `diagnostic.sh` contrôle tout cela sur le serveur.

## Étapes

| Étape | Qui, où | Commande |
|---|---|---|
| 0. Mesurer | Lui, session « Serveur JARVIS » (après « Mettre à jour le serveur » dans JARVIS, qui amène le kit dans `/opt/rd`) | `sudo bash /opt/rd/jarvis-os/hermes/diagnostic.sh` : verdict VPS-1 ou VPS-2 |
| 1. Installer | Lui, session « Serveur JARVIS » | `sudo bash /opt/rd/jarvis-os/hermes/install.sh` (Hermes ne démarre pas encore) |
| 1b. Relier Claude | Lui, Termius (saisie) | `sudo bash /opt/rd/jarvis-os/hermes/connexion-claude.sh` |
| 2. Telegram | Ensemble : lui dans Telegram (@BotFather, @userinfobot) et dans Termius | `sudo bash /opt/rd/jarvis-os/hermes/telegram.sh` |
| 3. Relier à JARVIS | Plus tard | Serveur MCP de JARVIS (7 outils : lecture et propositions qui attendent son accord), par l'adresse publique en HTTPS ; un jeton fixe à son nom, sans écraser celui d'un autre client (aujourd'hui JARVIS n'en garde qu'un : à rendre multiple avant) ; ajouter `mcp-jarvis` à `platform_toolsets.telegram` dans la politique |
| 4. Routines | Plus tard | Tâches planifiées d'Hermes (`cronjob`), comparées à Grok Bot sur une routine sans portail ; il faudra alors le « linger » de l'utilisateur `hermes` (`systemd-run --user`) |
| 5. Déroulé idéal | Claude, sur sa demande | Propositions de répartition Hermes, JARVIS, Grok Bot |

Tous les jours : `sudo systemctl status hermes-gateway`, `sudo journalctl -u hermes-gateway -n 50`,
`sudo bash /opt/rd/jarvis-os/hermes/diagnostic.sh`. Arrêter : `sudo systemctl stop hermes-gateway`. Tout
retirer : `sudo bash /opt/rd/jarvis-os/hermes/desinstaller.sh` (`--tout` efface aussi ses données).

## Dépannage (ce que le banc ne peut pas reproduire)

| Symptôme (journal : `sudo journalctl -u hermes-gateway -n 80`) | Cause probable | Correction (session « Serveur JARVIS ») |
|---|---|---|
| Claude Code échoue au lancement (« Operation not permitted », « Bad system call ») | Le filtre d'appels système bloque un appel de Claude Code | `sudo systemctl edit hermes-gateway`, ajouter `[Service]` puis `SystemCallFilter=` (vide), redémarrer ; noter l'appel en cause ici |
| Réponses coupées, « Killed », pic à 900 Mo | Limite mémoire du service | Seulement si `diagnostic.sh` montre de la marge : `MemoryMax=` plus haut dans le même `systemctl edit` |
| « plan limit », refus jusqu'à une heure donnée | Limite du forfait atteinte (`extra_usage: stop`) | Attendre la remise à zéro ; JARVIS et les sessions de développement sont à la même enveloppe |
| « Third-party apps now draw from your extra usage » | Anthropic a basculé les apps tierces sur l'usage payant | Ne rien autoriser ; passer au plan B (crédits d'API inclus dans Max), décision du propriétaire |
| Telegram : « Conflict: terminated by other getUpdates request » | Un autre programme utilise le même jeton | Nouveau jeton (@BotFather, /revoke), puis `telegram.sh` |
| Hermes ne démarre plus après une commande `hermes tools` ou `hermes config` | Fichier de réglages réécrit illisible (défaut de la 0.23.3) | Reprendre le dernier bon fichier de `/home/hermes/.hermes/backups/config/` (en tant que `hermes`), puis `sudo systemctl restart hermes-gateway` |

## État

- 23/11/2026 : kit écrit ; banc depuis zéro (`--neuf`) : 40 vérifications sur 40 (installation 109 s, Hermes au
  repos 325 à 360 Mo selon les passes) ; fusionné dans `main`. Choix : Opus 5.5 par défaut, nouveau bot Telegram.
- 23/11/2026 : étape 0 faite (mesure du vrai serveur ci-dessus) : VPS-1 suffisant pour l'étape 1 (Likely).
  JARVIS 0.70.1 note ses retenues faute de mémoire (`garde-memoire.mjs`), comptées par `diagnostic.sh`.
  Plafond d'Hermes resserré (650/800 Mo). Reste, de son côté : accepter la 0.70.1, étapes 1 et 1b ; l'étape 2
  se fait ensemble. À faire avant l'étape 4 : le garde-fou du forfait (section « Le forfait partagé »).
