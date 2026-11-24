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
| Connexion Claude (QCM après le rappel de la zone grise : plugin officiel d'Hermes mais pas approuvé par Anthropic, qui préfère une clé d'API) | **Garder le plugin** ; la clé d'API des crédits inclus dans Max reste le plan B |
| Pouvoirs | Aucun au départ. **Depuis sa demande du 23/11/2026 au soir** (« droits équivalents à Grok Bot », routines pour alléger Grok Bot, relier à JARVIS) : Pilotage, Gmail et l'agenda **par les outils du serveur MCP de JARVIS** (profil « exécutant »), des routines posées depuis le dépôt, des skills ; toujours ni web, ni terminal, ni fichiers, ni jeton Google. Tout le déroulé : `docs/hermes-deroule.md` |
| Garde du forfait | Seuil de **85 %** (QCM) ; **sur la semaine seulement** (sa demande du 23/11/2026, une fois Telegram en place : il remplit lui-même la fenêtre de 5 heures en testant JARVIS OS) |

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
| Garde du forfait | `hermes-garde.timer` et `hermes-garde.service`, script `/usr/local/sbin/hermes-garde-forfait` (copie root), seuil et fenêtres comptées dans `/etc/hermes/garde.conf`, état dans `/var/lib/hermes-garde/` |

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
   `hermes config`, ni par le chat. Sur Telegram, 5 outils (`memory`, `session_search`, `todo`, `clarify`,
   `skills`) et, une fois relié, ceux de JARVIS (liste fermée dans `politique-jarvis.yaml`) ; les routines ont
   les mêmes sans `clarify`. Pas de terminal, fichiers, web, navigateur, code, vision, sous-agents ni
   connexions ; Hermes ne peut pas créer de routine lui-même (outil `cronjob` coupé : elles viennent de
   `routines.conf`) ; 30 appels d'outils au plus par message ou par routine ; approbations manuelles, refus
   d'office dans une routine. Une skill qu'il propose attend « /skills approve ».
   - `agent.disabled_toolsets` vaut aussi pour les routines ; `skills.external_dirs` et `skills.disabled` ne
     sont lus par la 0.23.3 que dans `~/.hermes/config.yaml` (posés par `install.sh`), pas dans la politique.
   - **Liaison à JARVIS** : adresse et jeton dans `/etc/hermes/jarvis.env` (root, 0600), lus par systemd et
     passés au service ; jamais dans le dépôt ni dans la politique. JARVIS borne ce que le jeton permet
     (profil, plafonds par jour, journal des écritures) et le suspend d'un bouton.
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

Mémoire et processeur : `MemoryHigh=850M`, `MemoryMax=1000M` depuis les routines (banc du 23/11/2026 au
soir : 360 Mo au repos, 500 Mo au plus pendant une routine, plus 250 Mo pour son Claude Code ; 650 et 800
avant), `OOMScoreAdjust=600` (Hermes est tué avant JARVIS), `CPUWeight=20`.

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
- Sans autre garde-fou, Hermes pourrait donc consommer toute la fenêtre de 5 heures ou de la semaine, et JARVIS
  s'arrêterait aussi jusqu'à la remise à zéro.
- (guessing, d'après les mesures publiées par le plugin) À l'étape 1 (discussion seule), un message d'Hermes
  sur Opus prend de l'ordre de 0,02 à 0,1 % de la fenêtre de 5 heures. Le risque viendra avec les routines
  (étape 4).
- **Garde du forfait** (installé par `install.sh`, seuil de **85 %** sur la **semaine seulement**, ses choix du
  23/11/2026) :
  `hermes-garde.timer` lance toutes les 10 minutes `garde-forfait.sh`, dont root garde une copie
  (`/usr/local/sbin/hermes-garde-forfait`) : la minuterie n'exécute jamais un fichier du dépôt, qui
  appartient à `jarvis`.
  - Il lit l'usage par `hermes usage --json` (la lecture de `/usage`, sans appel au modèle), seulement quand
    Hermes tourne ou qu'il l'a lui-même arrêté : une lecture lance Hermes et la sonde de Claude Code (environ
    0,2 Go pendant 2 s au banc sans connexion, 0,45 Go attendus avec ; Likely). Sa lecture passe après JARVIS
    (`Nice=10`, `CPUWeight=20`, `MemoryMax=600M`).
  - Au-delà du seuil sur la semaine ou la semaine Opus (le modèle d'Hermes), il arrête Hermes et le prévient
    sur Telegram. Une fenêtre propre à un autre modèle (la semaine Sonnet de la voix de JARVIS) ne l'arrête
    pas ; une limite au nom inconnu compte, par prudence.
  - **La fenêtre de 5 heures (« Current session ») ne compte pas** (sa demande du 23/11/2026 : il la remplit
    lui-même en testant JARVIS OS, et elle avait atteint 85 % le jour où Telegram a été branché). Conséquence
    acceptée : si elle arrive à 100 %, Hermes, JARVIS et les sessions de développement s'arrêtent ensemble
    jusqu'à sa remise à zéro (5 heures au plus), sans rien payer (usage supplémentaire coupé). Aujourd'hui
    Hermes n'y puise que quand il lui écrit ; à revoir avant les routines (étape 4) : `GARDE_CINQ_HEURES=1`
    dans `install.sh` la remet.
  - Il le relance sous le seuil moins 10 points (75 %), après la remise à zéro, et le prévient. Il ne relance
    jamais un Hermes arrêté à la main ; usage illisible : aucune décision.
  - Réglages : `SEUIL_FORFAIT` et `GARDE_CINQ_HEURES` dans `install.sh` (écrits dans `/etc/hermes/garde.conf`).
    `install.sh` relancé pendant une pause du garde ne redémarre pas Hermes lui-même : il relance le garde, qui
    décide avec ses règles du moment. Banc : `bash essais/hermes/garde.test.sh` (20 vérifications).
- Regarder soi-même : `/usage` dans le chat d'Hermes (même compte, donc même chiffre que JARVIS), la page
  d'usage de claude.ai, ou `diagnostic.sh` (état du garde, dernier contrôle).

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
| 3. Relier à JARVIS | Lui : JARVIS 0.71.0 puis, dans Réglages, « Assistants reliés (MCP) », un jeton fixe « Hermes », profil « Exécutant » ; dans Termius (saisie) | `sudo bash /opt/rd/jarvis-os/hermes/relier-jarvis.sh` : vérifie le jeton depuis l'utilisateur `hermes`, par l'adresse publique en HTTPS, pose `/etc/hermes/jarvis.env` et relance `install.sh` |
| 4. Routines | Session « Serveur JARVIS » (sans saisie) | `sudo bash /opt/rd/jarvis-os/hermes/routines.sh` : pose les routines de `routines.conf` (elles tournent dans le service d'Hermes, sans « linger » : vérifié au banc) ; `--liste` pour les voir |
| 5. Déroulé | Fait le 23/11/2026 | `docs/hermes-deroule.md` : qui fait quoi, droits, routines en double, bascule, skills |

Tous les jours : `sudo systemctl status hermes-gateway`, `sudo journalctl -u hermes-gateway -n 50`,
`sudo bash /opt/rd/jarvis-os/hermes/diagnostic.sh`. Arrêter : `sudo systemctl stop hermes-gateway`. Tout
retirer : `sudo bash /opt/rd/jarvis-os/hermes/desinstaller.sh` (`--tout` efface aussi ses données).

## Dépannage (ce que le banc ne peut pas reproduire)

| Symptôme (journal : `sudo journalctl -u hermes-gateway -n 80`) | Cause probable | Correction (session « Serveur JARVIS ») |
|---|---|---|
| Claude Code échoue au lancement (« Operation not permitted », « Bad system call ») | Le filtre d'appels système bloque un appel de Claude Code | `sudo systemctl edit hermes-gateway`, ajouter `[Service]` puis `SystemCallFilter=` (vide), redémarrer ; noter l'appel en cause ici |
| Réponses coupées, « Killed », pic à 900 Mo | Limite mémoire du service | Seulement si `diagnostic.sh` montre de la marge : `MemoryMax=` plus haut dans le même `systemctl edit` |
| « plan limit », refus jusqu'à une heure donnée | Limite du forfait atteinte (`extra_usage: stop`) ; le plus souvent la fenêtre de 5 heures, que le garde ne surveille plus | Attendre la remise à zéro ; JARVIS et les sessions de développement sont à la même enveloppe |
| « Third-party apps now draw from your extra usage » | Anthropic a basculé les apps tierces sur l'usage payant | Ne rien autoriser ; passer au plan B (crédits d'API inclus dans Max), décision du propriétaire |
| Telegram : « Conflict: terminated by other getUpdates request » | Un autre programme utilise le même jeton | Nouveau jeton (@BotFather, /revoke), puis `telegram.sh` |
| Après un changement de politique ou de consigne, Hermes répond encore « je n'ai pas accès à JARVIS » | La conversation Telegram a commencé avant : elle garde l'ancienne consigne et l'ancienne liste d'outils (vu le 23/11/2026 : liaison posée à 20:38 UTC, 16 outils, et réponse « pas encore accès ») | Dans Telegram : `/new`, puis reposer la question |
| Hermes ne démarre plus après une commande `hermes tools` ou `hermes config` | Fichier de réglages réécrit illisible (défaut de la 0.23.3) | Reprendre le dernier bon fichier de `/home/hermes/.hermes/backups/config/` (en tant que `hermes`), puis `sudo systemctl restart hermes-gateway` |

## État

- 23/11/2026 : kit écrit ; banc depuis zéro (`--neuf`) : 40 vérifications sur 40 (installation 109 s, Hermes au
  repos 325 à 360 Mo selon les passes) ; fusionné dans `main`. Choix : Opus 5.5 par défaut, nouveau bot Telegram.
- 23/11/2026 : étape 0 faite (mesure du vrai serveur ci-dessus) : VPS-1 suffisant pour l'étape 1 (Likely).
  JARVIS 0.70.1 note ses retenues faute de mémoire (`garde-memoire.mjs`), comptées par `diagnostic.sh`.
  Plafond d'Hermes resserré (650/800 Mo). Reste, de son côté : accepter la 0.70.1, étapes 1 et 1b ; l'étape 2
  se fait ensemble.
- 23/11/2026 : garde du forfait à 85 % (son choix), installé par `install.sh` ; bancs : garde 16 sur 16, Hermes
  complet depuis zéro 44 sur 44. Étude pour lui : Google Doc « Hermes sur le serveur de JARVIS : étude de
  faisabilité (23-11-2026) », dossier `Grok Bot/` (`16GS3h9eLFBtLNzXToOXNm8_Rq-TFKSxGY5bfT1AnFhE`).
- 23/11/2026 : `install.sh` passé sur le vrai serveur (code 0 : Hermes installé, non démarré ; règles réseau et
  garde actifs). Garde corrigé ensuite : plus aucune lecture d'usage tant qu'Hermes est arrêté (relancer
  `install.sh` pour l'appliquer).
- 23/11/2026, par la session « Serveur JARVIS » (tâche confiée par `send_message`, résultat lu par `list_events`, sans
  recopie par lui) : dépôt à jour (`012837f`), `install.sh` code 0, garde corrigé en place, diagnostic « Confortable »
  (2,75 Go disponibles, 2,15 Go avec Hermes en train de répondre, aucune retenue de JARVIS, échange 0,9 Go). Reste : `connexion-claude.sh` et `telegram.sh` (Termius).
- 23/11/2026 : Telegram configuré par lui (`telegram.sh`). La fenêtre de 5 heures était à 85 % (lue à 14h18 UTC,
  remplie par ses essais de JARVIS OS) : sa demande, garde sur la semaine seulement. Fait : `garde-forfait.sh`
  ignore « Current session » (`HERMES_GARDE_CINQ_HEURES=0` dans `garde.conf`, 1 pour la remettre), messages
  « semaine » ou « semaine Opus » ; `install.sh` relancé pendant une pause laisse le garde décider. Bancs : garde
  20 sur 20, Hermes 45 sur 45 ; essai sur les vrais chiffres (semaine 10 %) : Hermes relancé, message de reprise.
- 23/11/2026, appliqué par la session « Serveur JARVIS » (tâche par `send_message`, sans recopie par lui) : dépôt
  `0bc2d17`, `install.sh` code 0. Hermes, mis en pause par l'ancien garde pour la fenêtre de 5 heures, relancé par
  le nouveau (« Forfait à 11 % (semaine) : Hermes relancé ») ; Telegram reconnecté à 14h42 UTC ; `garde.conf` à
  85 % et `HERMES_GARDE_CINQ_HEURES=0` ; jarvis, hermes-gateway, hermes-sortie et la minuterie actifs ;
  diagnostic « Confortable » (2,75 Go disponibles, aucune retenue de JARVIS, 1 identifiant, 4 outils, score 1,4).
  **Étape 2 faite.** Prochaine : étape 3 (relier à JARVIS), sur sa demande. Ensuite, le diagnostic et
  `install.sh` affichent le dernier message du garde avec son heure (et non la ligne de fin de systemd).
- 23/11/2026 au soir, sa demande (« mets en place le workflow idéal », droits équivalents à Grok Bot, routines,
  liaison à JARVIS, skills) : `docs/hermes-deroule.md`. Kit : politique des étapes 3 et 4 (`@MCP@`,
  `politique-jarvis.yaml`), `relier-jarvis.sh`, `routines.conf` et `routines.sh`, skills `pilotage`,
  `supervision`, `semaine-a-venir`, consigne refaite, diagnostic (liaison, skills, routines), plafond mémoire
  850/1000 Mo. JARVIS 0.71.0 : jetons fixes nommés et profil « exécutant ». Banc d'Hermes : 72 sur 72 avec un
  faux JARVIS (liaison par un faux terminal, jeton en en-tête, outil hors liste invisible, routine posée,
  recréée, retirée et lancée, skill chargée, 500 Mo au plus). Non vérifiable au banc : le vrai JARVIS derrière
  Caddy depuis l'utilisateur `hermes`, le vrai Claude dans une routine, « /skills approve » dans Telegram.
- 23/11/2026, 19h30 : sur le serveur (session « Serveur JARVIS »), dépôt `3c4d4a8`, JARVIS 0.71.0, `install.sh`
  code 0 avec la politique des étapes 3 et 4 (pas encore relié). Ses choix par QCM et la suite : `docs/hermes-deroule.md`.
- 23/11/2026, 21h38 (heure de Paris) : **étape 3 faite**, par lui (`relier-jarvis.sh` dans Termius) : `jarvis.env` root 0600, 16 outils de JARVIS annoncés par Hermes, aucune erreur (contrôle en lecture seule par la session « Serveur JARVIS »). Son premier essai a répondu « pas encore accès » : conversation commencée avant la liaison (`/new` ; ajouté au message de `relier-jarvis.sh` et au dépannage).
- 23/11/2026, 22h54 : **étape 4 faite** par la session « Serveur JARVIS » : `routines.sh` code 0, routines `supervision` (prochain passage le mercredi 25/11 à 8h50) et `semaine-a-venir` (dimanche 29/11 à 18h10) actives, en double. Reste : son essai dans une conversation neuve (`/new`), puis faire connaître Hermes à la Charte et à Argus ; ensuite la Veille du matin et l'essai du web (`docs/hermes-deroule.md`).
- 23/11/2026, 23h00 : essai réussi dans une conversation neuve ; Hermes connu de la Charte, d'Argus (ligne 98 du Canal) et de l'onglet Routines ; routine `veille-du-matin` ajoutée (en double, lun-ven 7h40) ; banc 73 sur 73. Détail : `docs/hermes-deroule.md`.
- 24/11/2026 : Supervision retirée d'Hermes à sa demande ; scénario des couches à l'étude (`docs/hermes-deroule.md`).
- 24/11/2026 : essai du web prêt (JARVIS 0.72.0, second jeton « Veilleur », routine `digest-ia` seule à avoir l'outil web) ; banc 84 sur 84. Le groupe d'outils « safe » contient le web : le couper coupe le web. Détail : `docs/hermes-deroule.md`.
