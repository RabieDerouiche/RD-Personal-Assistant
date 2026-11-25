# Le Hermes « portail » : se connecter à un portail sans clé sur le disque (essai, depuis le 24/11/2026)

À lire avant de toucher à `jarvis-os/hermes/portail/`. Le contexte (pourquoi remplacer Grok Bot, les 25 routines,
les autres remplaçants étudiés) est dans `docs/hermes-deroule.md` ; l'installation du Hermes de Telegram dans
`docs/hermes.md` ; le coffre en mémoire dans `jarvis-os/coffre/README.md`. Rien de personnel ici : ni le nom du
portail, ni son adresse, ni un identifiant.

## Pourquoi, et ce qu'il a décidé (QCM du 24/11/2026)

Le verrou du remplacement complet de Grok Bot est Chronos : trois portails avec connexion. Sa demande : « essai
portail sur notre Hermes actuel ». Ses réponses :

| Question | Son choix |
|---|---|
| Premier portail | Celui des notes de frais (le moins risqué des trois). Il s'y connecte par **mot de passe seul**, sans code. |
| Qui tape le mot de passe | Hermes, depuis son coffre, **comme chez Grok Bot** (sa correction : chez Grok, l'identifiant reste dans le coffre et ne se retape pas ; seul un code de double authentification se redonne). L'écran du bot (reprise de main à distance) devient un secours, pour un CAPTCHA ou une validation dans une app. |
| Où vit la clé du coffre d'Hermes | **En mémoire seulement** (il n'est « pas serein » avec une clé sur le disque). Écartés : le fichier sur le disque (défaut d'Hermes), 1Password avec un jeton de service (le jeton est sur le disque, abonnement en plus), rien d'enregistré (saisie par lui à chaque reconnexion, par Tailscale ou un tunnel). |
| Tailscale | Pas nécessaire pour un portail à mot de passe. À savoir s'il revient : sur iPhone, un seul VPN actif à la fois, Tailscale couperait le sien. |

## Ce que c'est

Un **second Hermes**, sous un autre utilisateur du serveur (`hermes-portail`), sans aucun lien avec le Hermes de
Telegram ni avec JARVIS : ni mails, ni agenda, ni Pilotage, ni Telegram, ni routine. Il a trois choses : son
navigateur (Chromium sans fenêtre, celui d'Hermes), son coffre d'identifiants, et une skill (`portail`) qui lui dit
de se connecter et de lire, sans rien soumettre. Il ne consomme rien au repos : un passage se lance à la demande
(`sudo hermes-portail essai <adresse>`).

Pourquoi un utilisateur à part : (certain, code de la 0.23.3) le navigateur d'Hermes (`browser_exec`) exécute du
Python écrit par le modèle, sans passer par les approbations du terminal, et n'existe que si l'outil `terminal`
est permis. Ce Python tourne sous l'utilisateur qui possède le coffre : une page piégée pourrait lui faire lire la
clé et l'identifiant. Trois barrières, aucune ne dépend du modèle :

1. **Rien d'autre à voler** : cet utilisateur ne voit ni `/home/hermes` (jeton de JARVIS, Telegram), ni
   `/home/jarvis`, ni le coffre de JARVIS.
2. **Une seule sortie réseau** : `sortie.nft` ne lui laisse joindre que le relais filtrant local (`filtre.py`) et
   les ports éphémères de la machine (ses propres pièces). Ni DNS, ni Internet en direct, ni JARVIS, ni Caddy, ni
   SSH. Le relais ne laisse passer, en HTTPS seulement, que les hôtes de `/etc/hermes-portail/domaines` (root) :
   ceux de Claude et ceux du portail. Un secret lu ne peut partir nulle part ailleurs.
3. **Le mot de passe ne passe jamais par le modèle** : `browser_vault` le remplit dans la page, seulement sur le
   site exact enregistré (vérifié au banc : absent de tout ce que le modèle reçoit).

## Son dossier n'est pas `~/.hermes`

(certain, code et banc) Tout appel d'Hermes s'assure d'abord qu'une passerelle tourne. Si son dossier est le
`~/.hermes` de l'utilisateur, il cherche une unité systemd nommée `hermes-gateway.service`, et la trouve : c'est celle
du Hermes principal. Au banc (sans systemd), cela suffisait à faire échouer chaque essai dès que les deux Hermes
étaient installés (« Gateway inaccessible »). Avec un autre dossier (`/home/hermes-portail/hermes`), le nom de
l'unité cherchée porte une empreinte du chemin, n'existe nulle part, et Hermes lance sa propre passerelle, le temps
du passage. Ne remets pas ce dossier à `~/.hermes`.

Même cause, autre effet (certain, banc) : cette passerelle passagère, tuée par un signal à la fin du passage, se note
« en marche » et fait attendre le passage suivant jusqu'à l'échéance. La commande l'arrête donc proprement
(`hermes gateway stop`) après chaque passage, avant la fin de l'unité.

## La clé en mémoire

- Le coffre d'Hermes est `/home/hermes-portail/hermes/vault/vault.json.enc` (chiffré, sur le disque) et `vault.key`. (certain, code et
  banc) Hermes relit la clé à chaque usage, suit un lien symbolique, et refuse d'ouvrir **sans jamais écraser** si
  la clé manque.
- `vault.key` est donc un **lien** vers `/run/hermes-portail-cle/vault.key`, un dossier `ramfs` : en mémoire vive,
  jamais envoyé dans l'échange (un `tmpfs` pourrait l'être). La clé naît là, créée par la commande, pas par Hermes.
- Sa seule copie durable est dans **jarvis-coffre** (secret `hermes-portail-cle`, portée « service »), chiffrée par
  la phrase du propriétaire. La commande la lit par la prise du coffre et l'écrit droit dans la mémoire vive : jamais
  en argument, jamais dans une variable, jamais sur le disque.
- **Après un redémarrage du serveur** : la mémoire vive est vide et jarvis-coffre démarre verrouillé. Aucune
  connexion n'est possible tant qu'il n'a pas rouvert le coffre (carte « Coffre » de JARVIS, ou
  `sudo jarvis-coffre ouvrir` dans Termius). Ensuite `essai` remet la clé seul.
- Pendant un passage : mémoire sans échange (`MemorySwapMax=0`), pas d'image mémoire (`LimitCORE=0`).
- Limites, dites à lui : root sur le serveur allumé, coffre ouvert, lit la mémoire ; l'utilisateur `jarvis` peut
  lire la clé dans jarvis-coffre (portée « service ») mais pas le coffre chiffré d'Hermes, qu'il ne voit pas ; la
  **session** du portail (cookies du navigateur, `/home/hermes-portail/hermes/navigateur`) est sur le disque tant qu'elle vit.

## La session du portail

(certain, banc) Chromium n'écrit un cookie sur le disque qu'une trentaine de secondes après l'avoir reçu, et Hermes
arrête son navigateur à la fin du passage. La skill fait donc finir chaque passage par une attente de 32 secondes.
Si le modèle l'oublie, rien ne casse : la session est perdue et il se reconnecte par le coffre au passage suivant.
Pour un portail à code de double authentification, il faudra une version qui ne dépend pas du modèle (navigateur
tenu par la commande) : pas encore faite.

## Fichiers (`jarvis-os/hermes/portail/`)

| Fichier | Rôle |
|---|---|
| `install.sh` | Root, relançable. Utilisateur `hermes-portail`, Hermes à la version figée du Hermes principal (lue dans `../install.sh`) avec son navigateur, plugin de l'abonnement Claude et Claude Code à lui, politique, skill, copies root de la commande et du relais, lien de la clé, règles réseau et relais. Ne démarre aucun agent. |
| `hermes-portail` | La commande (`/usr/local/sbin/hermes-portail`) : `etat`, `connexion-claude`, `enregistrer`, `domaines`, `essai`, `brouillon`, `notes`, `cle`, `fermer`, `oublier`. Un essai lance l'unité `hermes-portail-essai`. |
| `hermes-portail-essai.service` | Un passage, enfermé (mêmes lignes que `hermes-gateway.service`, mémoire sans échange ; depuis le 25/11/2026, filtre d'appels système et espaces de noms interdits). Une vraie unité, pas `systemd-run` : au premier essai sur le serveur, `systemd-run -p IPAddressDeny=link-local` a été refusé alors que la même ligne est valable dans une unité. Consigne dans `/home/hermes-portail/.consigne`, réponse dans `/var/lib/hermes-portail/essais/`. |
| `politique.yaml` | Sa politique (`/etc/hermes-portail/config.yaml`, root) : outils `browser`, `terminal`, `skills` seulement ; Sonnet ; profil de navigateur gardé ; navigateur envoyé vers le relais, lancé sans son bac à sable (dit en clair, voir « Durcissement »), remplissage automatique et heure réseau coupés. |
| `navigateur-regles.json` | Règles d'administrateur du navigateur (`/etc/opt/chrome_for_testing/policies/managed/hermes-portail.json`, root) : pas de gestionnaire de mots de passe, pas de vérification de fuite, pas de compte Google, pas de mesures. |
| `skills/portail/portail/SKILL.md` | Sa marche à suivre : se connecter par le coffre, lecture seule, ne jamais taper un mot de passe, ne rien soumettre, s'arrêter si un code est demandé, attente finale, réponse sans donnée personnelle. |
| `filtre.py`, `hermes-portail-filtre.service` | Le relais filtrant (Python du système, sans dépendance, utilisateur passager) : CONNECT vers le port 443 des hôtes de la liste, refus notés. |
| `sortie.nft`, `hermes-portail-sortie.service` | Ce que l'utilisateur peut joindre : le relais et les ports éphémères locaux, rien d'autre. |
| `domaines.defaut` | Liste de départ : les hôtes de Claude. Ceux du portail s'ajoutent sur le serveur (`domaines ajouter`), jamais dans le dépôt. |

Banc : `sudo bash essais/hermes/portail.test.sh` (`--neuf` pour réinstaller ; session cloud seulement, jamais sur
le serveur). Faux portail `essais/hermes/faux_portail.py`, faux terminal `essais/hermes/pty_saisie.py`, faux modèle
`essais/hermes/faux_services.py` (une « SUITE » d'appels d'outils).

## Mettre en service (ordre)

| Étape | Qui, où |
|---|---|
| 1. Dépôt à jour, puis `sudo bash /opt/rd/jarvis-os/coffre/install.sh` et `sudo bash /opt/rd/jarvis-os/hermes/portail/install.sh` | Session « Serveur JARVIS », confiée par Claude |
| 2. `sudo jarvis-coffre creer` : la phrase (générée et gardée dans NordPass, 20 caractères au moins) | Lui, Termius (saisie) |
| 3. `sudo hermes-portail connexion-claude` | Lui, Termius (saisie) |
| 4. `sudo hermes-portail enregistrer` : nom du portail, adresse du site, adresse de connexion, mot de passe ; rien pour la clé d'authentification | Lui, Termius (saisie) |
| 5. `sudo hermes-portail domaines ajouter <hôte>`, puis `sudo hermes-portail essai https://<adresse>` | Lui dans Termius, ou la session du serveur s'il lui donne l'adresse |
| 6. Lire le résultat ; `sudo hermes-portail etat` montre les hôtes refusés par le relais (à ajouter si le portail en a besoin) | Session du serveur, puis Claude |

## Ce que le banc prouve, et ce qu'il ne prouve pas

Prouvé (81 vérifications, 25/11/2026) : installation ; outils réduits et politique figée ; clé seulement en ramfs,
nulle part en clair sur le disque, gardée par jarvis-coffre ; enregistrement dans un faux terminal sans que le mot de
passe s'affiche ; connexion au faux portail par le coffre, tableau lu, formulaire ouvert, rien de soumis ; mot de
passe et clé jamais envoyés au modèle ; session gardée au second passage ; coffre verrouillé : refus propre ;
redémarrage simulé puis reprise après la phrase ; pas de DNS, pas d'Internet direct, pas de JARVIS ; relais (hôte ou
port hors liste, requête en clair : refusés ; hôte de la liste : permis) ; le navigateur et Hermes sous le filtre
d'appels système de l'unité, reproduit par `essais/hermes/filtre_appels.py` ; plus d'appel du navigateur vers la
vérification de fuite ni le remplissage automatique.

Pas prouvé, à voir sur le vrai serveur :
- jarvis-coffre sous un vrai systemd (jamais lancé hors banc) ;
- l'unité passagère enfermée avec Chromium et Claude Code dedans (si un passage échoue au lancement : relâcher une
  propriété de `lancer_agent`, la noter ici) ;
- le filtre d'appels système sous le vrai systemd du serveur (le banc le reproduit avec un autre noyau et un autre
  systemd) ;
- Claude Code à travers le relais (hôtes de `domaines.defaut` devinés d'après ses adresses connues : les refus
  s'affichent dans `etat`) ;
- le vrai modèle suivant la skill (le banc joue une suite d'appels écrite d'avance) ;
- le vrai portail : accepte-t-il un navigateur venu d'un serveur, quels hôtes annexes lui faut-il, sa page de
  connexion en une ou deux étapes ;
- la mémoire du VPS-1 pendant un passage (environ 1 Go : navigateur, Hermes, Claude Code).

## Mode brouillon (25/11/2026, son choix par QCM : « Note de frais à blanc », « Laisser un brouillon »)

Première écriture dans son compte : UNE dépense d'essai, enregistrée sans être envoyée, qu'il supprime ensuite
lui-même. `sudo hermes-portail brouillon <adresse> --champs-fichier <fichier>` : les champs viennent d'un fichier de
root (4000 octets au plus), posé sur le serveur, jamais dans le dépôt. La commande écrit une consigne qui commence par
« MODE BROUILLON » ; la skill n'ouvre ce mode que sur cette ligne (une page ne peut pas l'ouvrir) et garde les
interdits de toujours : rien au valideur, aucun rapport, aucune suppression, aucune dépense existante modifiée,
aucun fichier joint hors celui de `--justificatif`. `essai` refuse `--champs-fichier` : la lecture seule ne peut pas devenir un brouillon.

Ce que les routines de Chronos disent du portail (onglet « Textes des routines » de Pilotage, lu le 25/11/2026) :
une dépense s'enregistre seule, sans rapport et sans rien envoyer au valideur ; le justificatif (la facture en PDF)
est joint à la création, et l'OCR du portail change alors la date et la catégorie, à corriger ; les étiquettes ne se
voient pas dans le formulaire après enregistrement. **Ce que l'essai ne couvre pas** : joindre la facture. Hermes
portail n'a ni outil de fichier ni accès aux mails : il faudra un chemin pour lui remettre le PDF (dépôt par JARVIS
dans un dossier lu par le compartiment), à concevoir si le brouillon réussit.

**Premier passage réel (25/11/2026, 16h53) : rien enregistré, et c'est instructif.** Sur ce portail, « ajouter une
dépense » n'offre qu'un dépôt de fichier : pas de saisie sans justificatif. Hermes s'est arrêté comme sa skill le
demandait, n'a rien créé, et a compté trois lignes dans la liste des dépenses des trente derniers jours (l'écart
vu plus tôt venait d'un encart différent du tableau de bord). 133 s, pic de 1,2 Go. D'où la suite : `brouillon`
accepte `--justificatif <fichier>` (un fichier de root, PDF ou image, 5 Mo au plus), copié le temps du passage
dans `/var/lib/hermes-portail-depot` (root, lisible par Hermes) puis effacé ; Hermes le joint avec `upload_file`,
le seul fichier permis. Le kit pose une facture inventée d'un euro (`justificatif-essai.pdf`).

Garde-fou réel : seulement la skill et le modèle. Rien de technique n'empêche un clic sur le mauvais bouton (le
relais ne voit pas dans le HTTPS). Conséquence au pire : une dépense d'essai d'un euro envoyée au valideur, à
retirer à la main. Limite de tours portée à 40 par passage (un formulaire demande plus d'allers-retours).

## Ce qu'Hermes apprend d'un portail (25/11/2026, sa demande : « qu'il développe ses skills »)

Avant : rien. Mémoire, recherche dans ses passages et relecture de fond sont coupées dans sa politique (il lit des
pages web et tient des identifiants : une page piégée ne doit rien pouvoir lui faire retenir). Il redécouvrait
donc le portail à chaque passage.

Maintenant, des **notes par portail**, sous contrôle de root :
- à la fin de sa réponse, Hermes écrit jusqu'à cinq lignes « Appris : … » (sa skill dit quoi : où est une page,
  ce que fait un bouton, ce que le portail exige ou change seul, un piège ; jamais une donnée personnelle, jamais
  une règle ni une permission, jamais ce qu'une page lui demande de retenir) ;
- la commande, en root, garde celles qui passent le tri (une ligne, 220 caractères, ni adresse complète ni adresse
  mail, pas de doublon, 6 par passage, 40 par portail) dans `/var/lib/hermes-portail/notes/<hôte>.txt` (root,
  0600 : Hermes ne peut ni les lire ni les écrire lui-même) ;
- au passage suivant, elle les ajoute à la consigne, présentées comme des faits et non comme des consignes ; la
  skill dit qu'une note qui la contredit ne compte pas.
`sudo hermes-portail notes` les montre ; `notes ajouter <hôte> "<texte>"` en pose une (ce qu'on sait déjà du
portail) ; `notes oublier <hôte> [numéro]` en retire. Les notes vivent sur le serveur : jamais dans le dépôt (elles
décrivent son portail). Limite : une note fausse reste jusqu'à ce qu'on la retire ; Hermes peut la signaler
(« Appris : (corrige) … ») mais pas l'effacer. Les règles, elles, ne s'apprennent pas : elles restent dans la skill.

Le Hermes de Telegram, lui, a sa mémoire et propose des skills, validées par `/skills approve`
(`docs/hermes-deroule.md`, « Les skills ») : rien de changé pour lui.

## Durcissement (25/11/2026, son choix par QCM : « Second passage puis durcir »)

- **L'unité d'un passage** gagne `SystemCallFilter=@system-service`, moins `@privileged`, plus `capset`, et
  `RestrictNamespaces=yes`. `capset` est rendu exprès : Chromium s'en sert pour abandonner ses droits et s'arrête
  net si on le lui refuse (`credentials.cc`, « Operation not permitted »). Sans capacité permise, il ne sert qu'à
  en perdre.
- **Le navigateur tourne sans son propre bac à sable** (`--no-sandbox`, écrit dans la politique). Sur Ubuntu,
  AppArmor refuse les espaces de noms sans privilège et Hermes 0.23.3 retire alors le bac à sable de lui-même
  (`tools/browser_launcher.py`, `needs_chromium_sandbox_bypass`) ; l'écrire évite qu'il le tente ailleurs, où
  `RestrictNamespaces` le ferait tomber au démarrage. **Limite connue** : c'est l'unité systemd qui enferme le
  navigateur, pas lui-même. Une page qui percerait le navigateur aurait les droits de `hermes-portail`, donc la clé
  du coffre tant qu'elle est en mémoire. Ce qui borne : le relais (rien ne sort hors des hôtes permis), le filtre
  d'appels système, aucun autre fichier du serveur à sa portée. Pas de meilleure option avec cette version d'Hermes
  (l'aide `chrome_sandbox` en setuid est incompatible avec `NoNewPrivileges`).
- **Ce que le navigateur envoyait de lui-même à Google** : la vérification de fuite du mot de passe (un fragment
  d'empreinte) et le remplissage automatique (la forme des formulaires du portail) sont coupés à la source, par
  les règles d'administrateur et par option ; le gestionnaire de mots de passe de Chrome est coupé aussi (rien ne
  peut finir dans son fichier). Quatre appels restent, sans donnée du portail, toujours refusés par le relais :
  liste des comptes Google, dictionnaire, mise à jour, mode IA (aucune règle ni option de Chrome 156 ne les a
  coupés au banc).
- **Le banc reproduit le filtre sans systemd** : `essais/hermes/filtre_appels.py` lit les lignes de l'unité et pose
  le même filtre avec libseccomp autour de chaque passage. C'est lui qui a trouvé `capset` et le bac à sable avant
  le serveur. Il ne remplace pas l'essai réel : noyau et version de systemd différents.
- **Un passage peut rendre le code 0 sans navigateur** : si Chromium ne démarre pas, Hermes le dit dans sa réponse
  mais sort en 0. Juger un passage à sa réponse (ligne « Connexion »), pas à son code. À corriger.

## État

- 24/11/2026 (nuit) : kit écrit. Banc 56 sur 56, avec le Hermes principal installé sur la même machine (comme sur le
  serveur). Trois défauts trouvés par le banc et corrigés avant le serveur : le plugin de l'abonnement suivait le
  catalogue (imposé par `--ref`, `docs/hermes.md`) ; avec `~/.hermes`, le Hermes portail cherchait la passerelle du
  Hermes principal (dossier à lui) ; la passerelle passagère tuée en fin de passage bloquait le suivant (arrêt propre).
  Rien sur le serveur encore.
- 25/11/2026, sur le serveur (session « Serveur JARVIS », après son accord par QCM là-bas) : **jarvis-coffre installé**,
  service démarré et verrouillé (code 0 : première fois sous un vrai systemd). Installation du Hermes portail lancée :
  bloquée vingt minutes parce que **l'IPv6 sortant du serveur ne répond pas** (route présente, aucun paquet ne
  revient) ; chaque connexion attendait environ deux minutes avant l'IPv4. Son choix (QCM de la session du serveur) :
  préférer l'IPv4 (`precedence ::ffff:0:0/96 100` dans `/etc/gai.conf`, copie de l'ancien fichier dans `/root`).
  Corrigé dans le kit pour ne pas en dépendre : le relais essaie l'IPv4 d'abord, puis chaque adresse (6 s chacune) ;
  l'installeur refait une installation coupée en route (bon commit mais commande absente). Banc 56 sur 56.
- 25/11/2026, 08h12 (heure de Paris) : **Hermes portail installé sur le serveur** (code 0, 3,7 Go). L'installeur embarque
  son propre Python, qui ignore `/etc/gai.conf` : il a fallu en plus retirer la route IPv6 par défaut (son accord dans
  la session du serveur ; ligne gardée dans `/root/route-ipv6-default.bak-20261125` ; **elle revient au redémarrage**,
  correctif durable à lui proposer : OVH, ou IPv6 coupé dans la configuration réseau). Contrôles : jarvis,
  hermes-gateway, jarvis-coffre, hermes-portail-filtre et hermes-portail-sortie actifs ; table nft en place (elle a
  déjà rejeté des paquets de cet utilisateur) ; Hermes de Telegram inchangé ; mémoire « Confortable » (2,6 Go
  disponibles). Défaut vu : `hermes-portail etat` rendait le code 2 sans aucun essai (corrigé, banc).
  Reste, de son côté, dans Termius : `sudo jarvis-coffre creer`, `sudo hermes-portail connexion-claude`,
  `sudo hermes-portail enregistrer`, puis l'hôte du portail et le premier essai.
- 25/11/2026, 09h12 : ses saisies faites dans Termius (coffre créé, identifiant du portail enregistré : « Stored »).
  **Premier essai réel : échec avant le départ** (« Failed to parse IP address prefix 'link-local' », 0 s) : c'est
  `systemd-run` qui refusait un réglage. Corrigé : unité `hermes-portail-essai.service`, contrôlée au banc par
  `systemd-analyze verify`. Vu aussi : sa commande « domaines ajouter » a affiché l'aide (Likely : espaces insécables
  d'une commande recopiée sur l'iPhone ; la commande les accepte maintenant) ; `etat` dit si Claude est relié.
  Banc 59 sur 59.
- 25/11/2026, 09h56 : **deuxième essai réel** (unité `hermes-portail-essai`, son accord dans la session du serveur) :
  l'unité passe (code 0, 42 s, pic de 916 Mo), **Claude répond à travers le relais** et suit la skill (réponse en cinq
  lignes, pas de terminal), le coffre est ouvert, l'identifiant listé. **Mais Chromium ne démarre pas** : douze
  bibliothèques du système absentes (libatk, libgbm, libcups, libpango…). L'installeur d'Hermes, lancé sans droits, ne
  les pose pas ; au banc elles étaient déjà dans le conteneur. Corrigé : `install.sh` les installe (noms avec ou sans
  « t64 ») et s'arrête si `ldd` en trouve encore une absente. Refus du relais vu : `models.dev` (Hermes y cherche la
  liste des modèles ; sans effet, laissé refusé).
- 25/11/2026, 10h11 : **troisième essai réel** (bibliothèques posées par `install.sh` : 42 paquets, 75 Mo, aucun nom
  introuvable). **Le navigateur démarre, le portail s'affiche depuis le serveur** (ni blocage, ni CAPTCHA),
  l'identifiant est saisi, le coffre remplit le mot de passe, le bouton de connexion est cliqué. Échec ensuite :
  « network error », parce que le relais refusait le service qui vérifie le mot de passe (un service d'identité
  d'Amazon, hors du domaine du portail). Pic de mémoire : 1,2 Go ; 91 s. Refus sans conséquence, laissés refusés :
  services de Google du navigateur (compte, remplissage, mises à jour), et ce qu'Hermes cherche de lui-même (mises à
  jour, liste des modèles). Suite demandée à la session du serveur : ajouter cet hôte et le domaine du portail avec
  ses sous-domaines, puis réessayer. Les hôtes d'un portail ne s'écrivent pas ici : ils sont dans
  `/etc/hermes-portail/domaines` sur le serveur.
- 25/11/2026, 13h32 : **quatrième essai réel : connecté.** Après son accord dans la session du serveur (elle avait
  d'abord refusé d'élargir la liste des hôtes sur la seule demande d'une autre session : bon réflexe, à garder), les
  deux hôtes ajoutés, Hermes s'est connecté au portail avec l'identifiant du coffre, sans code demandé, est arrivé
  sur le tableau de bord, l'a décrit sans donnée personnelle, n'a rien créé ni soumis, et a fait l'attente qui
  enregistre la session (89 s, pic de 1,2 Go, 2,6 Go disponibles ensuite). Refus du relais pendant ce passage, tous
  sans effet sur la connexion et laissés refusés : services de Google du navigateur (dont la vérification de fuite
  de mot de passe, qui envoie un fragment d'empreinte : à couper aussi dans le navigateur), mises à jour et listes
  de modèles cherchées par Hermes, le service de rapports d'erreurs du portail, une bibliothèque servie par un CDN
  (à surveiller sur d'autres pages).
- 25/11/2026, 14h27 : **second passage : la session est gardée.** Hermes arrive sur le tableau de bord sans se
  reconnecter (68 s, pic de 1 Go). Écart non expliqué : la liste des dépenses récentes, remplie au passage
  précédent, est décrite vide cette fois (une bibliothèque du portail servie par un CDN est refusée par le relais :
  hypothèse écartée ensuite, voir plus bas).
- 25/11/2026, 14h52 : **durcissement appliqué sur le serveur, passage de contrôle bon** (son oui dans la session du
  serveur ; pas de retour arrière). Unité notée 1,8 par `systemd-analyze security` ; AppArmor y restreint bien les
  espaces de noms (le navigateur y tournait donc déjà sans son bac à sable) ; systemd 259. Session encore ouverte,
  67 s, pic de 1,1 Go. La demande d'heure réseau a disparu des refus du relais. Pas encore vu sur le serveur :
  l'arrêt de la vérification de fuite et du remplissage (aucun mot de passe saisi à ce passage ; vu au banc
  seulement). La session du serveur doute que les règles du navigateur soient lues (les appels vers la liste des
  comptes et la mise à jour continuent) : au banc, `chrome://policy` les montre lues par ce même navigateur, et ces
  appels-là sont ceux qu'aucune règle ne coupe ; à confirmer sur le serveur au prochain passage avec connexion.
  Copies d'avant gardées dans `/root/` (`hermes-portail-essai.service.avant`, `hermes-portail-config.yaml.avant`).
- Liste des dépenses récentes : remplie (3) au passage de 13h32, décrite vide aux deux suivants. La bibliothèque
  refusée par le relais l'était déjà au premier : ce n'est pas elle. Les pages d'arrivée diffèrent (tableau de bord
  nommé au premier, racine ensuite). Non expliqué ; à regarder avec la note à blanc.

## Ce qui reste (au 25/11/2026)

Pour ce portail :
1. **Combien de temps la session tient** : elle tient d'un passage au suivant (une heure d'écart). Reste un contrôle
   par jour pendant une à deux semaines (minuterie à écrire, sur sa demande).
2. **Note de frais** : le portail exige un justificatif ; brouillon avec la facture d'essai jointe à lancer (son
   oui dans la session du serveur), puis il supprime la dépense d'essai. Ensuite : le chemin de la vraie facture
   (du mail au dépôt d'Hermes, par JARVIS), une skill par note de frais de Chronos, comparaison avec Chronos.
3. **Redémarrage du serveur** : vérifier pour de vrai que tout attend le coffre, puis repart après
   `sudo jarvis-coffre ouvrir` (la carte « Coffre » de l'app n'est pas encore branchée : `jarvis` n'est dans le groupe
   du coffre qu'à son prochain redémarrage).
4. **Durcir** : fait et vérifié sur le serveur. Restent : un passage dont le navigateur ne démarre pas doit rendre un
   code d'erreur ; confirmer sur le serveur que les règles du navigateur sont lues ; l'écart sur la liste des dépenses.
Ensuite :
5. Les deux autres portails (CRA mensuel, CRA hebdomadaire) : même marche, `enregistrer`, `domaines`, `essai`. Leur
   connexion (code, session courte) n'est pas connue.
6. Brancher sur le reste : un guichet de JARVIS pour demander un passage (sans donner le navigateur au Hermes de
   Telegram), la facture arrivée par mail, son oui par bouton avant toute soumission.
7. Serveur : l'IPv6 sortant (la route retirée revient au redémarrage).
