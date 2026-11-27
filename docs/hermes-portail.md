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
| `hermes-portail` | La commande (`/usr/local/sbin/hermes-portail`) : `etat`, `connexion-claude`, `enregistrer`, `domaines`, `essai` (et `--code-mail`, `--telecharger`), `brouillon` (et `--sans-creer`), `facture`, `texte`, `cra` (et `--a-blanc`), `cra-mois` (et `--a-blanc`), `teletravail` (et `drive`), `cra-auto`, `cra-mois-auto`, `notes`, `cle`, `fermer`, `oublier`. Un essai lance l'unité `hermes-portail-essai`. |
| `hermes-portail-cra.service`, `hermes-portail-cra.timer` | Le CRA de la semaine (26/11/2026) : toutes les 5 minutes, `hermes-portail cra-auto` ; rien sans `/etc/hermes-portail/cra.conf` (root : `adresse=` la feuille de temps, `jarvis_donnees=` le dossier de JARVIS ; jamais dans le dépôt). Compte rendu dans `/var/lib/hermes-portail-retours/` (root, lisible par le groupe de JARVIS, depuis le 26/11/2026). |
| `hermes-portail-cra-mois.service`, `hermes-portail-cra-mois.timer` | Le CRA du mois (26/11/2026, son QCM « CRA du mois seul ») : toutes les 15 minutes, `hermes-portail cra-mois-auto` ; rien sans `adresse_mois=` (l'adresse du compte rendu d'activité) dans `/etc/hermes-portail/cra.conf`, rien avant le 26. Voir « Le CRA du mois, seul ». |
| `hermes-portail-cra-signe.service`, `hermes-portail-cra-signe.timer` | Le CRA signé du client (0.97.0, son QCM « Hermes, après mon oui ») : toutes les 15 minutes, `hermes-portail cra-signe-auto` ; rien sans `adresse_mois=`, sans PDF gardé par JARVIS, ni avant que le CRA du mois soit validé par Hermes ; à blanc d'abord, le dépôt après son oui seulement. Voir « Le CRA signé du client ». |
| `hermes-portail-essai.service` | Un passage, enfermé (mêmes lignes que `hermes-gateway.service`, mémoire sans échange ; depuis le 25/11/2026, filtre d'appels système et espaces de noms interdits). Une vraie unité, pas `systemd-run` : au premier essai sur le serveur, `systemd-run -p IPAddressDeny=link-local` a été refusé alors que la même ligne est valable dans une unité. Consigne dans `/home/hermes-portail/.consigne`, réponse dans `/var/lib/hermes-portail/essais/`. |
| `politique.yaml` | Sa politique (`/etc/hermes-portail/config.yaml`, root) : outils `browser`, `terminal`, `skills` seulement ; Sonnet ; profil de navigateur gardé ; navigateur envoyé vers le relais, lancé sans son bac à sable (dit en clair, voir « Durcissement »), remplissage automatique et heure réseau coupés. |
| `teletravail.mjs` | La note de télétravail, ce que seul JARVIS sait lire (26/11/2026) : lancé par `hermes-portail teletravail` sous l'utilisateur `jarvis`, en lecture seule. `--jours AAAA-MM` : le bilan du mois par le module de JARVIS lui-même (`jours.mjs` : agendas reconnus, ses règles, ses corrections), refait sur une copie de `jours.json` effacée ensuite ; `--drive <id>` : UN PDF du Drive (outil `file_pdf` de `google.mjs`, 0.85.0). |
| `teletravail.py` | La note de télétravail, sans réseau (root) : montants lus par règles dans le texte des pièces, garde-fous, calcul du classeur, page de synthèse en HTML, champs de la dépense. Aucune valeur personnelle : tout vient de `/etc/hermes-portail/teletravail.conf`. |
| `hermes-portail-teletravail.service`, `hermes-portail-teletravail.timer` | La note de télétravail (26/11/2026) : chaque jour à 12 h 20, `hermes-portail teletravail-auto`, qui ne fait rien hors du dernier jour du mois avant midi (Paris), sans `teletravail.conf`, ni deux fois pour un mois ; à blanc ; compte rendu sans montant `teletravail-<AAAA-MM>.json` dans le dossier de root pour JARVIS (notification, carte « Note de télétravail » de l'espace Travail). |
| `facture.mjs` | Va chercher UNE facture PDF dans ses mails : lancé par `hermes-portail facture` sous l'utilisateur `jarvis`, avec l'accès Google et le code de JARVIS (`google.mjs`, `pdf.mjs`), en lecture seule ; l'état de JARVIS n'est jamais réécrit. Rend le PDF et son texte à root. |
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

Prouvé (145 vérifications, 26/11/2026, dont le CRA de la semaine, le CRA du mois et la note de télétravail avec sa minuterie) : installation ; outils réduits et politique figée ; clé seulement en ramfs,
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

**Second passage réel (25/11/2026, 17h39) : toujours rien d'enregistré.** Le dépôt de la facture d'essai a échoué
(« le téléchargement du fichier a échoué »), le formulaire s'est affiché avec tous ses champs désactivés, et Hermes
a annulé plutôt que de cliquer un bouton « Créer » dont il ne savait pas l'effet : bon réflexe. Cause probable
(Likely) : au moment du dépôt, le relais a refusé l'espace de stockage où le portail reçoit les fichiers (un hôte
à part, ni celui du portail ni ses sous-domaines) ; un second dépôt de bibliothèques a été refusé aussi. Rien au
valideur, aucun rapport, aucune dépense créée d'après ce qu'il a vu (trois lignes avant, trois au passage de
lecture suivant). 134 s, pic de 1,1 Go. Leçon : un portail s'appuie sur des hôtes annexes qu'on ne découvre qu'en
faisant le geste ; chaque geste nouveau (dépôt, aperçu, lecture de la facture) peut en révéler un.

**L'apprentissage marche sur le serveur** : 7 notes de départ posées, 4 ajoutées par Hermes lui-même en deux
passages, toutes passées au tri (dont une qui corrige une note de départ : sur le formulaire d'ajout, le bouton
s'appelle « Créer », pas la coche verte).

**Troisième passage réel (25/11/2026, 17h48) : la dépense d'essai est enregistrée.** Son choix par QCM (« Ouvrir et
refaire, avec marge ») : les deux hôtes annexes ouverts (le stockage des fichiers et un dépôt de bibliothèques), une
marge de trois hôtes de plus que la session du serveur n'a pas eu à utiliser. Hermes a joint la fausse facture,
le portail a lu le montant (TTC et HT pré-remplis), Hermes a saisi le vendeur, la TVA, la catégorie, le
commentaire, décoché « Refacturable », puis cliqué « Créer ». Une seule ligne de plus dans la liste (3 puis 4),
aucun rapport créé, aucune étiquette. Le dépôt du fichier ne crée pas la dépense : elle n'existe qu'après « Créer ».
150 s, pic de 1,1 Go. **Pas prouvé** : que l'état affiché, « En attente », ne veut pas dire « en attente de
validation » (Hermes le dit lui-même) ; à lui de le regarder en la supprimant. Pas fait non plus : rouvrir la
dépense pour relire ses champs.

Notes : 17 pour ce portail, dont 9 écrites par Hermes ; une corrige une note de départ (la catégorie n'était pas
pré-remplie cette fois). Défaut vu : le tri ne reconnaît un doublon que mot pour mot (une note redite autrement
est passée).

Garde-fou réel : seulement la skill et le modèle. Rien de technique n'empêche un clic sur le mauvais bouton (le
relais ne voit pas dans le HTTPS). Conséquence au pire : une dépense d'essai d'un euro envoyée au valideur, à
retirer à la main. Limite de tours portée à 40 par passage (un formulaire demande plus d'allers-retours).

## La vraie facture (25/11/2026, ses choix par QCM : « La vraie facture », « Remplir sans créer »)

**Ce que le relevé du compte a montré** (passage en lecture seule, à sa demande : « regarde toutes les notes de
frais créées par Chronos ») : une vingtaine de dépenses sur douze mois, toutes avec un justificatif PDF, de quatre
sortes (abonnement d'IA, box, télétravail, un achat de matériel). Le portail ne dit pas qui a créé une dépense ; les
plus récentes, au vendeur écrit « Société (Produit) » et au commentaire détaillé, sont celles de Chronos. **Aucune
liste de rapports n'existe dans ce compte**, et les états s'enchaînent : « En attente », « Conforme », « Remboursé ».
Conclusion (Likely) : sur ce portail, créer une dépense, c'est la soumettre ; la consigne de Chronos « ne crée pas
de rapport, n'envoie rien au valideur » ne protège de rien. D'où : jamais de création par Hermes sans son accord, et
le mode à blanc pour comparer. Écart vu au passage : le texte de la routine noté dans Pilotage est en retard sur ce
que Chronos saisit vraiment (nom du produit, jour de la date).

**Deux pièces de plus** :
- `sudo hermes-portail facture --requete "<recherche Gmail>" --nom "<expression du nom>" --vers <dossier de root>` :
  JARVIS a l'accès à Gmail, Hermes portail non. La commande lance `facture.mjs` sous l'utilisateur `jarvis` (lecture
  seule : une recherche, les fils trouvés, une pièce jointe), et garde le PDF et son texte dans le dossier de root.
  Rien du contenu n'est affiché. Le Hermes portail ne voit jamais les mails : seulement le PDF, le temps du passage.
- `brouillon … --sans-creer` (« MODE À BLANC ») : Hermes joint la facture, relève ce que le portail a pré-rempli,
  met chaque champ à la valeur de la consigne, puis annule et vérifie qu'aucune ligne n'a été ajoutée. Pour un
  montant ou une date, il dit seulement « égal » ou « différent » de la consigne.
**Essai réel (25/11/2026, 18h30, son oui dans la session du serveur) : réussi.** La facture du dernier abonnement a
été trouvée dans Gmail du premier coup (texte lisible), déposée, et le formulaire rempli puis annulé : aucune
ligne ajoutée (trois avant, trois après). Le portail avait pré-rempli juste le pays, la devise, les trois
montants et le moyen de paiement ; Hermes a corrigé le vendeur, la date (décalée d'un jour par le portail), la
catégorie, rempli le commentaire et posé l'étiquette (le formulaire d'ajout le permet, avant la création). La
comparaison avec la dépense que Chronos avait créée pour la même facture : **identique sur tous les champs**,
étiquette comprise. 2 min 41 s puis 1 min 58 s, pic de 1,2 Go. 28 notes sur ce portail. Reste de l'essai : le fichier
déposé demeure sans doute dans le stockage du portail, sans dépense. Vu sur la facture : pas de « date de
paiement » (une date d'émission et une d'échéance) ; l'émetteur et son pays de TVA ne sont pas ceux que la routine
de Chronos écrit (repris tels quels, pour comparer à l'identique : à lui de dire si c'est voulu).

Qui lit la facture pour écrire le fichier des champs : pour l'essai, la session du serveur, à partir de
`facture.txt` ; pour une routine, à construire (règles par sorte de facture, côté JARVIS).

## Tout Chronos : le périmètre et l'ordre (son rappel du 25/11/2026 au soir)

Ce qu'il a rappelé : trois notes de frais (l'abonnement d'IA ; la box, dont la facture se télécharge sur l'espace
client du fournisseur, qui envoie un code par mail à la connexion ; le télétravail, déclaré le 1er pour le mois
précédent avec les jours télétravaillés et des justificatifs) et deux CRA (l'hebdomadaire du client ; le mensuel
de la société de portage, dont l'intranet demande, après le mot de passe, le code d'une application
d'authentification : il a la clé de configuration). Sa consigne : s'organiser au mieux, peu d'allers-retours.

**Les deux seconds facteurs sont couverts, au banc :**
- **Code d'application (TOTP)** : le coffre d'Hermes le fait de lui-même. `hermes vault add` (donc
  `hermes-portail enregistrer`) demande une « Authenticator key », saisie sans affichage dans Termius ; l'identifiant
  porte alors `two_factor: automatic`, et `browser_vault` avec `action: enter_code` génère le code et le saisit sans
  que le modèle le voie. La clé est chiffrée dans le coffre d'Hermes, dont la clé ne vit qu'en mémoire. Jamais dans
  une conversation (règle de sécurité 4) : il la tape lui-même.
- **Code reçu par mail** : `essai` ou `brouillon` avec `--code-mail "<recherche Gmail>"`. Pendant le passage, root
  guette ce mail par l'accès Google de JARVIS (`facture.mjs --code-apres`, dix minutes au plus, seuls les mails
  arrivés après le début du passage) et pose le code dans le dépôt ; la skill dit à Hermes de le lire et de le
  saisir dans le même appel, sans l'afficher. Fichier effacé à la fin. Hermes ne va jamais sur une messagerie.

**Premier essai de connexion sur les trois autres portails (25/11/2026, 21h) : aucun des trois.** Trois causes
différentes, aucune écriture nulle part :
- *CRA hebdomadaire* : identifiants refusés par le portail (une tentative, pas de relance). À lui de les vérifier
  en se connectant lui-même, puis de les réenregistrer (retirer d'abord l'ancien avec `oublier`).
- *Intranet (CRA mensuel)* : mot de passe accepté, puis `enter_code` répond `no_code_field` alors que le champ est à
  l'écran. Cause lue dans le code d'Hermes (`agent/vault_login_classifier.py`) : sans `autocomplete=one-time-code`,
  le coffre ne reconnaît un champ de code qu'à un nom ou un libellé en anglais, mots entiers ; un nom collé et un
  libellé français ne passent pas. Contournement, reproduit au banc : poser l'attribut sur le champ avec `js()`,
  puis rappeler `enter_code` (dans la skill).
- *Espace client de la box* : le formulaire est dans un cadre (iframe) d'une autre origine ; `browser_vault` ne
  regarde que la page principale et refuse (`origin_mismatch`). Piste (dans la skill, pas prouvée) : ouvrir
  l'adresse complète du cadre en pleine page. Si elle échoue : enregistrer aussi l'identifiant sous l'origine de
  la page principale ne suffira pas (le coffre n'inspecte pas l'intérieur d'un cadre) ; il faudrait alors une saisie
  par un autre moyen, à concevoir.
Quatre hôtes annexes ouverts par la marge pour ce dernier portail ; aucun pour les deux autres.

**Second essai (25/11/2026, 21h30, lecture seule, sans question pour lui)** : *l'intranet est acquis* : avec
l'attribut posé, le code généré par le coffre est accepté ; Hermes lit le CRA du mois (statut, jours renseignés,
fin de mission) sans rien cliquer. *L'espace client de la box* : en pleine page, le formulaire s'affiche, le coffre
le remplit, le code par mail arrive et il est accepté (six cases d'un chiffre) ; mais la page des factures ne
reconnaît pas la session. Le fournisseur a enregistré le navigateur d'Hermes comme appareil de confiance.

**Troisième essai (25/11/2026, 21h45, lecture seule) : Hermes entre sur les quatre portails.** Le CRA
hebdomadaire : identifiants ressaisis par lui, connexion sans second facteur, feuille de la semaine lue (elle
s'affiche dans un cadre). L'espace client de la box : le cadre de connexion ouvert en pleine page, le coffre remplit,
le site renvoie vers une page de retour vide, puis la page des factures reconnaît la session ; aucun code demandé
cette fois (appareil déjà enregistré au passage d'avant) ; une vingtaine de factures listées, chacune avec un
téléchargement. Refus nouveaux du relais pendant ce passage, laissés fermés : deux services qui renvoient l'adresse
IP publique de la machine (origine inconnue : la page ou Hermes).

**Ordre retenu** (du plus sûr au plus lourd, chaque étape en lecture seule ou à blanc avant toute écriture) :
1. Abonnement d'IA : **fait le 25/11/2026**, à blanc, identique à la dépense de Chronos (voir « La vraie facture »).
2. Les trois autres portails : il enregistre lui-même leurs identifiants (une séance Termius), puis un passage de
   connexion en lecture seule sur chacun, avec une marge d'hôtes annexes ; on sait alors ce qui est faisable.
3. La box : **faite le 25/11/2026**, à blanc, identique à la dépense de Chronos (« Où on en est », étape 1).
4. Les jours du mois : la validation du 24 (agenda « Présence » et jours fériés, par les outils de JARVIS, son oui),
   dont dépendent le CRA mensuel et le télétravail. Ce n'est pas un portail : c'est pour le Hermes de Telegram.
5. CRA hebdomadaire puis CRA mensuel, à blanc (lecture de l'état, ce qui serait saisi), puis une vraie saisie sur
   son oui. Attention : sur l'intranet, chaque clic dans le CRA s'enregistre aussitôt.
6. Télétravail : le plus lourd (calcul, modèle de feuille, justificatifs dont une facture à prendre sur un autre
   espace client). Le travail déjà fait est sur l'ordinateur des bots (`/workspace/ndf/teletravail/`), illisible
   d'ici : demander à Chronos, par le Canal, de le copier dans Drive.
**Ses réponses (QCM du 25/11/2026 au soir)** : dans son compte, une dépense créée « part seule » (contrôlée puis
remboursée sans geste de sa part : créer, c'est soumettre) ; et pour le dernier clic, « comme Chronos
aujourd'hui » : Hermes créera seul les notes de frais et le préviendra après ; pour les CRA, son oui sur les jours
d'abord, puis saisie et validation. Donc aucun bouton de confirmation à construire, mais aucune création par
Hermes tant que la routine n'est pas basculée (sinon doublon soumis).

Règles de Chronos reprises telles quelles (il les a déjà tranchées) : ce que chaque routine crée ou soumet seule,
et quand elle attend son oui. Pendant le double, Hermes ne crée rien (à blanc) : sinon doublon.

## La note de frais de télétravail (ses fichiers et ses précisions du 25/11/2026 au soir)

Il a envoyé le classeur modèle de la société de portage, l'exemple d'octobre (accepté et remboursé) et l'avis de
taxe foncière de l'année. Rangés dans Drive, dossier « Note de frais télétravail » (ID dans `CLAUDE.md`) : aucun de
ces fichiers, aucun montant, aucune adresse dans le dépôt.

**Ce que l'exemple montre.** Le justificatif déposé sur le portail de notes de frais est UN PDF : une page de
synthèse (le tableau du classeur : un « 1 » sous chaque jour télétravaillé, les surfaces, les charges, le total),
puis les pièces, dans l'ordre : appel de charges de la copropriété, avis de taxe foncière, attestation
d'assurance habitation, facture d'électricité du mois. La page de synthèse de l'exemple n'est pas le classeur
imprimé : c'est un tableau recréé à l'identique. Le portail n'accepte de toute façon que PDF ou image.

**Le calcul** (formule du classeur, cellule du total ; refaite et vérifiée : elle retrouve le total d'octobre au
centime) :
`total = surface du bureau × jours télétravaillés × (loyer + charges de copropriété + autres taxes + taxe foncière/12
+ taxe d'habitation/12 + assurance/12 + électricité + eau) / surface du logement / jours ouvrés du mois`.
Jours ouvrés = tous les lundis à vendredis du mois, fériés compris (`NB.JOURS.OUVRES` sans liste de fériés) ; seuls
les jours télétravaillés du numérateur excluent fériés et congés (règle de Chronos).

**D'où vient chaque chiffre**

| Donnée | Source | Rythme |
|---|---|---|
| Jours télétravaillés | Agenda « Présence » et jours fériés, par JARVIS ; son oui | Chaque mois |
| Électricité | Facture du mois, sur l'espace client du fournisseur (le mail d'annonce n'a pas de PDF) | Chaque mois, un portail de plus |
| Charges de copropriété | Appel de charges trimestriel, en pièce jointe dans Gmail : total du lot de l'appartement, divisé par trois | Chaque trimestre |
| Assurance habitation | Mail de la nouvelle police et attestation, dans Gmail | Chaque année, à la date d'échéance |
| Taxe foncière | L'avis qu'il fournit (Drive) | Chaque année |
| Surfaces, date de début de mission, nom | Fixes : fichier de réglages sur le serveur, jamais dans le dépôt | — |

**L'avis de taxe foncière suivant** (sa consigne) : dès qu'un mail de l'administration fiscale annonce de nouveaux
documents avec un avis de taxes foncières, JARVIS lui crée une tâche « envoie-moi le nouvel avis » ; il l'envoie,
on le range dans le dossier Drive. À brancher sur la veille du matin d'Hermes (ou une règle du Radar) : pas avant
l'été prochain.

**Construit le 26/11/2026** (sa décision du jour, QCM : « Hermes le 30/11 ») : `sudo hermes-portail teletravail [--mois
AAAA-MM] [--electricite <facture.pdf>] [--sans-depense] [--diagnostic]`, À BLANC seulement (`--reel` est refusé : Chronos
crée la note le 1er ; on compare, puis bascule en décembre si elle est identique). Dans l'ordre :
- *les jours* : `teletravail.mjs --jours` sous l'utilisateur de JARVIS (module `jours.mjs` lui-même, ses corrections
  comprises ; rien n'est réécrit chez JARVIS) ; un jour ouvré sans lieu ni congé, ou un conflit, arrête tout ; une
  demi-journée de télétravail compte 0,5 (« 0,5 » dans la case) ; aucun jour de télétravail : aucune dépense ;
- *les pièces* : l'avis de taxe foncière du Drive (`teletravail.mjs --drive`, outil `file_pdf` ajouté à `google.mjs`,
  JARVIS 0.85.0) ; l'appel de charges et l'attestation d'assurance de Gmail (`facture.mjs`) ; la facture d'électricité
  du mois rapportée de l'espace client par un passage d'Hermes en lecture seule (`essai --telecharger`, consigne :
  « celle émise en <mois> <année> »), ou donnée par root (`--electricite`) ;
- *deux lectures de chaque pièce* : par `pdf.mjs` de JARVIS, puis par `pdftotext -layout` (paquet `poppler-utils`, lancé
  par l'utilisateur `nobody`) ; chaque règle prend la première qui lui répond. Vu sur les vraies pièces d'octobre : `pdf.mjs`
  colle les cellules d'un tableau (« TOTAL DU LOT » suivi des deux montants sans espace) et met la date de la facture
  d'électricité sur la ligne d'après ; `pdftotext` ne lit pas la somme de l'avis. Les règles en tiennent compte ;
- *montants, garde-fous, calcul* (`teletravail.py`, root, sans réseau) : total du lot de l'appartement (repère du lot
  dans les réglages) sur une période qui couvre le mois, divisé par trois ; montant de l'avis égal au réglage (sinon :
  nouvel avis, réglage à revoir) ; attestation valable tout le mois (sinon : renouvelée, montant annuel à revoir) ;
  facture d'électricité émise dans le mois, montant TTC lu ; charges et électricité à moins de 50 % du mois d'avant
  (historique à root, `/var/lib/hermes-portail/teletravail/historique.json`, amorcé par les réglages `precedent_*`).
  Toute pièce manquante ou règle non vérifiée arrête tout (code 2, la raison dite sans montant ; `--diagnostic` dit
  ce qui a été trouvé, oui ou non). Formule du classeur, arrondi au centime. **Contrôle sur les vraies pièces de
  l'exemple accepté d'octobre** (séparées de son PDF, lues des deux façons, hors du dépôt) : toutes les règles trouvent
  leur valeur, et la commande retrouve ses charges, son électricité et **son total au centime** ;
- *le justificatif* : la page de synthèse (tableau recréé : semaines, jours, « 1 » ou « 0,5 » sous chaque jour
  télétravaillé, surfaces, charges, total) rendue en PDF par le Chromium d'Hermes, sous son utilisateur, dans un dossier
  à lui vidé avant et après ; puis `pdfunite` (paquet `poppler-utils`, le plus léger ; ajouté à `install.sh`) dans
  l'ordre de l'exemple : synthèse, appel de charges, avis de taxe foncière, attestation, facture d'électricité ; 5 Mo
  au plus (limite du portail) ;
- *la dépense* : champs tirés d'un modèle à root (réglage `champs`, avec `{DATE}` au dernier jour du mois, `{MONTANT}`,
  `{MOIS}`, `{MOIS_NOM}`, `{ANNEE}`, `{JOURS}`), puis `brouillon --sans-creer` : remplie jusqu'au dernier écran,
  justificatif joint, puis annulée. Rien n'est créé. Fin : « Résultat télétravail : blanc | arret | echec | prete ».
**Le déclenchement (26/11/2026)** : `hermes-portail-teletravail.timer` lance chaque jour `teletravail-auto`, qui ne fait la
note que le dernier jour du mois après midi (heure de Paris ; le raccourci a noté le dernier jour à 11 h), une seule fois par
mois (`tentes.txt`, noté avant le passage), toujours à blanc. Son compte rendu pour JARVIS (`/var/lib/hermes-portail-retours/
teletravail-<AAAA-MM>.json`, root, groupe de JARVIS, 640) ne porte aucun montant : le résultat (`blanc`, `prete`, `arret`,
`echec`), le nombre de jours, les raisons d'un arrêt. JARVIS le notifie une fois (« Note de télétravail de novembre : prête à
blanc » ou « arrêtée », avec la raison : Chronos la fait alors le 1er) et le montre sur la carte de l'espace Travail.

Tout reste à root dans `/var/lib/hermes-portail/teletravail/<mois>/` (700). `teletravail drive <id> --vers <dossier>` rend
un PDF du Drive à root (pour lire un justificatif fixe ou l'exemple d'un mois, et en tirer les réglages).

**Les réglages** (`/etc/hermes-portail/teletravail.conf`, root 600, posés sur le serveur, jamais dans le dépôt ; une
ligne `clé=valeur`) : `nom`, `debut_mission` (JJ/MM/AAAA), `surface_logement`, `surface_bureau`, `taxe_fonciere_an`,
`taxe_habitation_an`, `autres_taxes_mois`, `assurance_an`, `eau_mois` (vide si sans), `taxe_fonciere_drive` (l'identifiant
du PDF de l'avis), `charges_requete` et `charges_nom` (recherche Gmail et nom du PDF de l'appel de charges), `charges_lot`
(le repère du lot de l'appartement dans l'appel, avant son « TOTAL DU LOT »), `assurance_requete` et `assurance_nom`,
`electricite_adresse` (la page des factures de l'espace client), `ndf_adresse` (le portail de notes de frais),
`champs` (le chemin du modèle des champs, à root), `precedent_charges` et `precedent_electricite` (le mois d'avant, pour
le premier garde-fou). Facultatifs, pour une pièce dont le texte sort autrement : `charges_periode_motif`,
`assurance_motif`, `taxe_motif`, `electricite_montant_motif`, `electricite_date_motif` (expressions régulières), et
`ecart_max` (0.5 par défaut).

**Banc** (données inventées) : faux JARVIS (agenda « Présence » et fériés de novembre inventés, demi-journée comprise,
deux mails avec PDF, un PDF du Drive), trois PDF inventés ; jours, pièces, calcul au centime, PDF de 5 pages dans
l'ordre, synthèse lisible (« 0,5 », total), état de JARVIS jamais réécrit, trois garde-fous (écart avec le mois d'avant,
avis différent, jour sans lieu), passage complet avec la facture rapportée par Hermes et la dépense remplie puis
annulée sur le faux portail.

**Pas prouvé avant le 30/11** : les pièces telles que Gmail et le Drive les rendent sur le serveur (celles du contrôle
venaient du PDF assemblé d'octobre : `--diagnostic` dit quelle règle échoue, et les `*_motif` des réglages permettent
d'ajuster sans toucher au code) ; la vraie facture d'électricité rapportée de l'espace client ; la dépense à blanc sur
le vrai portail (le modèle des champs se tire de la dépense de télétravail d'octobre, lue en lecture seule). D'où un
essai sur octobre dès l'installation : sa note acceptée est la référence.
**Reste** : le déclenchement le dernier jour (minuterie, après le raccourci de 11 h), le compte rendu dans JARVIS (sa
notification), la comparaison avec la note de Chronos du 1/12, puis la création réelle et la pause de sa routine.

**Ce qui était à construire** (25/11/2026) :
1. *Télécharger un fichier depuis un portail* (la facture d'électricité ; sert aussi à la facture de la box) :
   **sur le serveur depuis le 25/11/2026, prouvé sur la facture de la box.** `essai … --telecharger <dossier de root>` :
   la consigne annonce « Téléchargement permis », Hermes range UN fichier dans son dossier
   `/home/hermes-portail/telechargements` (skill, section « Télécharger un fichier » : `Browser.setDownloadBehavior`
   puis le clic ; à défaut, le PDF ouvert dans un onglet est repris par `fetch`), et root le relève à la fin : un
   seul vrai PDF de 10 Mo au plus, rendu à root sous le nom `telecharge.pdf`, dossier vidé. `hermes-portail texte
   <fichier.pdf>` en donne le texte (par `pdf.mjs` de JARVIS, sous son utilisateur, sans accès à Google).
2. *Aller chercher un fichier dans Drive* depuis le serveur, par l'accès Google de JARVIS (comme `facture.mjs` pour
   Gmail).
3. *Fabriquer le PDF* : la page de synthèse (HTML rendu en PDF par le Chromium déjà installé, sans rien installer),
   puis l'assemblage avec les pièces (un outil de fusion de PDF à installer sur le serveur).
4. *Lire les montants* dans les PDF (`pdf.mjs` de JARVIS) : total de la facture d'électricité, total du lot de
   l'appel de charges. Par règles, avec un garde-fou : écart inhabituel par rapport au mois d'avant = on s'arrête.
5. *La dépense* : vendeur, date au dernier jour du mois, catégorie propre au télétravail, sans TVA, commentaire
   « Frais de télétravail <mois> <année> – N jours », sans étiquette (relevé du compte) ; à blanc d'abord.
Chronos fait celle du mois écoulé le 1er : Hermes ne la crée pas, il la prépare à blanc pour comparer.
**Sa précision (25/11/2026, tard)** : avec Hermes, la note de télétravail sera générée et lui sera soumise pour
validation **le dernier jour du mois** (et non le 1er du mois suivant). Tous les jours du mois sont alors connus ;
la facture d'électricité et l'appel de charges du mois sont déjà arrivés.
**Précisée le 25/11/2026 au soir** : la note part **automatiquement** le dernier jour, une fois que son raccourci de
présence a noté le dernier jour (11 h) : pas de nouvelle validation des jours ce jour-là. Seuls l'arrêtent un jour
ouvré sans lieu ni congé noté, ou un conflit (JARVIS le prévient). Le CRA du 26, lui, n'a besoin que des congés.

**Ses réponses (QCM du 25/11/2026 au soir)** : l'espace client du fournisseur d'électricité se connecte par e-mail
et mot de passe (donc un identifiant de plus à enregistrer par lui, sans second facteur) ; le PDF suffit, comme en
octobre (pas de classeur à remplir ni à envoyer) ; et son accord mensuel sur ses jours se donnera dans JARVIS (une
notification avec le bilan tiré de l'agenda « Présence », un bouton pour confirmer, un champ pour corriger), pas
dans Telegram.

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

## La limite du forfait Claude (26/11/2026, sa demande : « Fais en sorte que la relance soit automatique »)

Le Hermes portail tourne sur le même forfait que JARVIS et Hermes : la limite de 5 heures peut couper un passage.
Sur le portail de notes de frais, créer = soumettre : **une tâche coupée n'est relancée que si l'on prouve qu'elle
n'a rien saisi**.

- **La preuve** : après chaque passage, `limite.py passage` (copie root, `$LIB/limite.py`) note dans
  `/var/lib/hermes-portail/limite/derniere.json` (root 600) si la limite a coupé le passage et si le portail a été
  joint. Le relais filtrant écrit `permis <hôte>` dans son journal pour chaque hôte qu'il laisse passer ; tout hôte
  qui n'est pas celui de Claude (`domaines.defaut`, copié dans `$LIB`) compte comme le portail. Relais illisible :
  pas de preuve, donc « portail joint ». Aucune adresse n'est gardée, seulement oui ou non.
- **Coupée avant tout contact** (le cas courant : la limite tombe au premier appel du modèle) : la tentative ne
  compte pas (la ligne de `tentees.txt` ou `tentes.txt` est retirée), `attente.json` garde l'heure de reprise
  (les minuteries `cra-auto`, `ndf-auto`, `notes-auto` et `teletravail-auto` ne tentent rien avant), et
  `relance-<tâche>.json` demande **une** relance à `hermes-relance` (Hermes principal, `docs/hermes.md`), qui
  démarre l'unité après la levée. Les minuteries de 5 minutes la reprennent aussi d'elles-mêmes : le verrou et
  le registre empêchent tout doublon. Aucun compte rendu d'échec n'est posé pour JARVIS.
- **Coupée une seconde fois pour la même clé** (même oui, même mois) : plus de relance (`relancees.txt`, root) ; la
  tentative compte, le compte rendu pour JARVIS dit « coupé deux fois… à relancer à la main » (JARVIS le notifie).
- **Coupée après avoir joint le portail, ou sans preuve** : jamais relancée ; la tentative compte, le compte rendu
  dit de vérifier le portail avant de relancer à la main.
- **Création d'une note** (`ndf_creer`) : coupée avant tout contact, une note « à valider » attend toujours son oui
  (même empreinte) et `ndf-auto` la reprend ; une note d'une sorte déjà validée une fois passe à `auto_limite`, que
  `ndf-auto` reprend sans nouveau oui (la règle de `ndf_poser`). Code de sortie 5 (« Résultat note : limite »).
- **Préparation** (`notes-auto` → `note`, `teletravail-auto` → `teletravail`) : facture rapportée ou dépense à blanc
  coupées avant tout contact avec le portail de notes de frais : la note du mois repart une fois (`notes-auto`).
- **CRA du mois** (`cra-mois-auto`, 26/11/2026) : coupé avant tout contact avec le portail, le mois n'est pas compté comme tenté
  et repart une fois après la levée (`hermes-portail-cra-mois.service`, connue de `hermes-relance`) ; après contact, ou coupé
  deux fois : compté, compte rendu et avis « à relancer à la main ». `cra-mois` lancé à la main n'a pas de relance.
- (Likely) Une coupure après le 1er du mois pour la note de télétravail (préparée le dernier jour) n'est pas
  rattrapée par `teletravail-auto` (il ne tourne que le dernier jour) : elle se fait alors à la main.
- Au banc : `HERMES_BANC_PASSAGE` (un passage coupé, sans lancer Hermes), `HERMES_BANC_PASSAGE_SI` (seulement si la
  consigne contient ce texte) et `HERMES_BANC_FILTRE_JOURNAL` (le journal du relais), lus seulement sans systemd.
- Locale fixée (`LC_ALL=C.UTF-8`) dans la commande : sans LANG, `R[ée]sultat` ne reconnaissait plus « Résultat » et
  un CRA soumis était compté « echec » (vu au banc le 26/11/2026 ; (Likely) sans effet jusque-là sur le serveur, dont
  les unités reçoivent la locale du système).

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

## Où on en est, et la suite (au 25/11/2026, fin de journée)

**Acquis, prouvé sur le serveur**
- Le compartiment (durci), le coffre et sa clé en mémoire, le relais et sa liste d'hôtes, les notes par portail.
- Portail de notes de frais : connexion, session gardée, dépôt d'un justificatif, formulaire rempli ; la facture de
  l'abonnement d'IA, à blanc, **identique à la dépense de Chronos**.
- Les trois autres portails : Hermes y entre (code d'application par le coffre pour l'intranet ; cadre ouvert en
  pleine page pour l'espace client de la box ; rien de particulier pour le CRA hebdomadaire). Lecture seule.

- La box (25/11/2026, 21h24 à 21h34) : facture du dernier mois rapportée de l'espace client, dépense à blanc,
  **identique à la dépense de Chronos** (détail à l'étape 1 ci-dessous).
- Le kit sur le serveur est à jour depuis le 25/11/2026 au soir (`a22ee66`) : contournement du champ de code et du
  cadre dans la skill, téléchargement d'un fichier, commande `texte`. Copies d'avant dans `/root/*.avant-box`.

**La suite, dans l'ordre** (une seule demande à la session du serveur par chantier ; rien n'est créé ni soumis
tant qu'une routine n'est pas basculée) :
1. *Chantier « box »* : mise à jour du kit ; télécharger la dernière facture de la box ; en lire le texte ; la
   dépense à blanc sur le portail de notes de frais ; comparer à celle de Chronos (catégorie, étiquette, pas de
   commentaire, montant entier : le portail le divise lui-même par deux). Dans la même demande : la page de
   connexion de l'espace client d'électricité, sans identifiant (nouvel hôte), pour lui dire quelle origine
   enregistrer dans Termius.
   **Demande envoyée le 25/11/2026 au soir** (une seule, banc passé avant) : copies d'avant du kit dans `/root`
   (`*.avant-box`) pour le retour arrière ; la facture la plus récente de la liste (octobre : celle de novembre
   n'est pas encore émise) rapportée par `essai --telecharger --code-mail`, avec une marge de 3 hôtes pour le
   téléchargement ; champs écrits par la session du serveur d'après le texte et les règles de la routine de
   Chronos (vendeur, catégorie, étiquette seule, aucun commentaire, montants entiers) ; `brouillon --sans-creer` ;
   comparaison en lecture seule avec la dépense de Chronos de la même date (champ par champ, étiquettes, part
   remboursée) ; découverte de la page de connexion du fournisseur d'électricité avec une marge de 5 hôtes ;
   ménage. Une seule question pour lui dans la session du serveur.
   **Résultat (son oui à 21h24, tout fait en dix minutes, aucun hôte de marge, rien de créé)** :
   - Kit : `172aa8a` → `a22ee66`, `install.sh` code 0, contrôles attendus, durcissement intact, JARVIS non touché.
   - Facture : rapportée en un passage, par téléchargement direct (le bouton de la liste est un lien), session
     encore ouverte, aucun code demandé ; vraie facture de la ligne fixe, texte lisible (date, HT, TVA, TTC
     trouvés). Hermes a dit la facture datée d'un jour plus tôt que ce qu'elle porte : **la date se lit dans le
     texte de la facture, jamais dans la réponse d'Hermes**.
   - À blanc : tout pré-rempli juste par le portail sauf la catégorie (« Repas », corrigée) ; étiquette posée
     dans le formulaire d'ajout, sans l'étiquette « refacturable » ajoutée seule ; annulé, aucune ligne ajoutée.
   - Comparaison avec la dépense de Chronos de la même date : **identique sur tous les champs**, une seule
     étiquette, état « Conforme », une seule dépense de ce vendeur pour le mois ; part remboursée = la moitié
     (politique affichée par le portail, pas de chiffre). Le texte de la routine de Chronos est juste pour celle-ci.
   - Électricité : la connexion est sur l'origine du site lui-même (lien « Espace client », puis une page de
     connexion du même hôte) ; e-mail et mot de passe sur un seul écran, pas de cadre, aucun code annoncé. Un
     hôte ouvert, aucun de marge. Il a enregistré son identifiant dans Termius le soir même (pas encore essayé).
   - Notes : 35 pour le portail de notes de frais, 29 pour l'espace client de la box, 1 pour l'électricité ;
     aucune ne contient un montant ou un numéro (vérifié).
   - Reste pour une routine sans personne : écrire le fichier des champs sans la session du serveur (pour la
     box, tout est fixe sauf la date et les trois montants, lus dans le texte : une règle sans IA suffit).
2. *Les jours du mois* (pas un portail : JARVIS et le Hermes de Telegram) : lire l'agenda « Présence » et les jours
   fériés par les outils de JARVIS, appliquer les règles de la routine « Validation mensuelle des jours » de
   Chronos (onglet « Textes des routines » de Pilotage), lui montrer le bilan dans JARVIS avec un bouton pour
   confirmer et un champ pour corriger (son choix), garder les jours validés sur le serveur. Code de JARVIS
   (`jarvis-os/server`, `jarvis-os/app`) : bancs de JARVIS à passer, journal à tenir.
   **Écrit le 25/11/2026 au soir : JARVIS 0.83.0** (`jarvis-os/server/jours.mjs`, détail dans `docs/jarvis-os.md`).
   Ses choix (QCM du 25/11/2026) : bilan le 24 à midi, relu le dernier jour (oui redemandé seulement si un jour a
   changé) ; pendant le double, il valide dans les deux (Grok et JARVIS) et JARVIS ne prépare aucun brouillon de
   mail ; premier essai sur novembre, dès la mise à jour. Le bilan est fait sans IA ; une correction s'écrit en une
   phrase. Ce n'est pas le Hermes de Telegram qui le fait : c'est JARVIS lui-même (moins cher, rien à apprendre).
   Mise en service : il accepte « Mettre à jour » dans JARVIS (aucune demande à la session du serveur). Les jours
   validés restent dans `jours.json` sur le serveur ; le CRA (étape 3) les lira par un outil à ajouter.
   À comparer en décembre : le bilan de JARVIS et celui de Chronos, jour par jour.
   **Sa précision le soir même (JARVIS 0.83.1)** : le CRA peut partir le 26 parce qu'il n'a besoin que des congés ;
   son oui du 24 porte donc sur ses congés, même si le lieu (télétravail ou sur site) des derniers jours n'est pas
   encore noté. La note de télétravail part seule le dernier jour, quand le raccourci a tout noté. Le dernier jour,
   JARVIS ne le prévient que si un congé a changé depuis son oui (le CRA est peut-être déjà parti) ou si un jour n'a
   ni lieu ni congé (la note l'attend) ; sinon, rien.
3. *CRA hebdomadaire puis CRA mensuel*, à blanc : dire ce qui serait saisi, jour par jour, d'après les jours
   validés, sans rien cliquer (sur l'intranet, chaque clic s'enregistre) ; puis une vraie saisie sur son oui, avec
   les règles de Chronos (types de journée, congés, fériés, soumission, fin de mission).
4. *Télétravail* : les briques 2 à 5 de la section « La note de frais de télétravail » (fichier de Drive, PDF de
   synthèse et assemblage, lecture des montants, dépense à blanc), générée le dernier jour du mois après le
   raccourci de présence, et partie seule (sa précision du 25/11/2026 au soir) ; à blanc tant que Chronos tourne.
5. *Déclenchement et bascule* : une minuterie par routine (ou l'arrivée du mail), le compte rendu à lui (JARVIS ou
   Telegram), puis la comparaison avec Chronos et sa décision, routine par routine.
   **Sa règle du 25/11/2026 au soir (pour Chronos)** : pas de double de deux semaines. Dès qu'une routine d'Hermes
   est **finalisée** (à blanc identique à Chronos, déclenchement automatique et compte rendu prêts, banc passé), la
   routine de Chronos s'arrête (mise en pause par une ligne du Canal, jamais supprimée : `docs/hermes-deroule.md`,
   « La méthode de bascule ») et Hermes passe en réel. **À la première exécution réelle de chaque routine d'Hermes
   qui remplace Chronos, il est notifié** (JARVIS) pour vérifier ce qui a été fait et corriger si besoin. Rien ne se
   crée en réel avant la mise en pause de la routine de Chronos (sinon doublon soumis).
   Routines de Chronos (Pilotage, « Textes des routines ») : note de l'abonnement d'IA (le 21), note de la box (le
   15), validation des jours (le 24), CRA mensuel (le 26), CRA hebdomadaire (le vendredi), note de télétravail (le
   1er, bientôt le dernier jour), « Facture reçue » (à l'arrivée d'une facture), et la note de l'abonnement Grok Bot
   (le 4) : **elle reste chez Chronos et s'arrête avec Grok** (QCM du 25/11/2026 au soir).
   **Ordre (même QCM) : le CRA hebdomadaire d'abord**, puis les notes de l'abonnement d'IA et de la box. Premier pas
   (25/11/2026, nuit, demande au serveur en lecture seule) : relever les quatre semaines de novembre sur le portail
   (état, code et quantité par jour) pour les comparer à ce que donnent son agenda et les règles de Chronos ;
   mesure du serveur ; connexion à l'espace client d'électricité. Règles de Chronos pour ce CRA (Pilotage) : le
   vendredi midi, son oui sur l'agenda de la semaine ; chaque journée travaillée (télétravail ou sur site) :
   « R002 Regular Day », quantité 1 ; rien pour congés, fériés, week-ends ; une demi-journée : demander ; garder les
   saisies justes, une divergence : prévenir et attendre ; Save, relecture, Submit, vérification ; jamais deux
   soumissions d'une même semaine. À construire : le mode « CRA » de la skill et de la commande (saisie, Save,
   Submit, à blanc d'abord), la semaine dans JARVIS (carte et oui, comme les jours du mois), le déclenchement par
   root depuis le oui donné dans JARVIS, le compte rendu et la notification de première exécution.
   **Le CRA de la semaine, construit le 26/11/2026 (sa décision : en réel dès le vendredi 27/11)** :
   - *JARVIS 0.84.0* : le vendredi à midi, la semaine (« 1 » chaque journée travaillée, rien pour un congé ou un
     férié ; demi-journée de congé ou conflit : bloqué, à la main) et la notification ; son oui dans la carte « CRA
     de la semaine » de « Pour moi », gardé dans `jours.json`. Détail : `docs/jarvis-os.md`, 0.84.0.
   - *Kit* : `hermes-portail cra <adresse> --semaine <lundi> --jours <dates> [--a-blanc]` écrit la consigne « MODE
     CRA » (la skill n'ouvre ce mode que sur cette ligne) ; garde-fous hors du modèle : un lundi, des jours de la
     semaine, jamais avant son vendredi, jamais une semaine déjà soumise par Hermes (`/var/lib/hermes-portail/cra/
     soumises.txt`, root). La skill (section « CRA de la semaine ») : ouvrir la semaine, s'arrêter si elle est déjà
     soumise, choisir la ligne du code (celle du projet de la dernière semaine approuvée), garder une saisie juste et
     s'arrêter sur un écart, « 1 » sur les jours dits, « Save », relecture, un seul « Submit », état relu ; la
     réponse finit par « Résultat : … », que la commande lit. `cra-auto` (minuterie root de 5 minutes) : la plus
     ancienne semaine confirmée dans JARVIS et pas encore tentée pour ce oui-là (une tentative par oui, notée avant
     le passage), puis le compte rendu dans `/var/lib/hermes-portail-retours/cra-<lundi>.json` (root, lisible par le
     groupe de JARVIS, depuis le 26/11/2026 ; voir plus bas « La faille ») : « soumise » (première exécution signalée), « déjà soumise », « rien saisi », « enregistrée, pas soumise ».
   - *Banc* : 117 vérifications (10 nouvelles : fausse feuille de temps avec Save et Submit, faux `jours.json`).
     Défaut trouvé par le banc avant le serveur : le compte rendu supposait un groupe du nom de l'utilisateur.
   - *Pas prouvé avant le vendredi 27/11* : le vrai modèle sur la vraie feuille de temps (choix de la ligne, cases
     de quantité, « Save », « Submit ») ; d'où un passage à blanc sur la vraie semaine en cours à l'installation, et
     sa vérification à lui après la première exécution réelle (sa règle).
   - *Mise en service (jeudi 26/11)* : JARVIS mis à jour par lui (« Mettre à jour »), puis une demande à la session du
     serveur : copies d'avant, `install.sh`, `cra.conf`, contrôle de la minuterie, passage à blanc ; retour arrière :
     minuterie arrêtée, `cra.conf` retiré, copies remises. Puis une ligne du Canal pour Chronos : sa routine du CRA
     hebdomadaire en pause (jamais supprimée). Filet si la pause n'est pas faite à temps : la routine de Chronos
     attend son oui avant de saisir et ne soumet jamais une semaine déjà soumise.
   **Résultat du relevé (25/11/2026, 23h20, lecture seule, aucune question)** : Hermes entre sans code, change de
   semaine par le champ « Date » du cadre (MM/JJ/AAAA) et son bouton d'actualisation (les liens s'appellent
   « Previous Period » / « Next Period ») ; l'état se lit dans « Reported Time Status », un par jour. Les trois
   semaines passées sont approuvées, et **ce que Chronos a saisi est exactement ce que donnent son agenda et les
   règles** (« R002 - Regular Day », 1,00 chaque jour travaillé, rien pour congés et fériés) ; la semaine en cours
   est vide (Chronos la fait le vendredi). Refusé par le relais : un outil de visite guidée, inutile. 2 min 29,
   pic de 1,2 Go. Électricité : connecté sans code ; factures à `/clients/mes-factures` (onze de l'année, une icône
   de téléchargement par ligne, « Tout télécharger ») ; 1 min 38, 1,2 Go. Mesure du serveur : 3,8 Go, 2,1 Go
   disponibles (2,6 Go juste après chaque passage), 0,65 Go d'échange utilisés, 22 Go de disque libres, aucun
   processus tué en 14 jours, aucune retenue de JARVIS en 7 jours, diagnostic « Confortable ».

**Mise en service, 26/11/2026 (nuit et matin)** :
- *Sur le serveur (son oui, 26/11/2026)* : dépôt à `05eb0fe`, JARVIS 0.83.0 → 0.84.0, `install.sh` code 0, minuterie
  active (inerte sans `cra.conf`), **`cra.conf` pas posé** (la faille ci-dessous). Passage à blanc sur la vraie
  semaine du 23/11 : connexion par le coffre, la bonne semaine, vide, cases de quantité trouvées ; **la grille vide
  porte trois lignes « R002 » identiques** (même projet, même activité ; la semaine approuvée n'en a qu'une) et
  Hermes n'a pas su choisir : « Résultat : rien saisi », rien tapé. 1 min 50, 1,2 Go.
- **La faille (vue par la session du serveur)** : `cra-auto` écrivait en root dans `~/.jarvis/portail-retours/`,
  dossier de l'utilisateur de JARVIS, en suivant les liens : un JARVIS compromis aurait pu faire écraser un fichier
  du système par root. **Corrigé le 26/11/2026** : le compte rendu va dans `/var/lib/hermes-portail-retours/` (root,
  groupe de JARVIS, 750, fichiers 640, écrit sans suivre de lien) ; root n'écrit plus rien chez JARVIS ;
  `jours.json` est lu sans suivre de lien et seulement s'il est un vrai fichier. JARVIS 0.84.1 lit ce dossier (il ne
  peut pas effacer : il garde les comptes rendus déjà lus). Banc : un `jours.json` en lien n'est pas suivi ; l'ancien
  dossier piégé en lien vers `/etc` ne reçoit rien.
- **Lignes identiques (règle ajoutée à la skill)** : plusieurs lignes du même code, même projet, même activité, toutes
  vides, se valent : la première, les autres restent vides (le portail retire une ligne vide à l'enregistrement,
  d'après la semaine approuvée qui n'en a qu'une : *Likely*, à vérifier au premier « Save ») ; après « Save », le
  total de la semaine doit égaler le nombre de jours « 1 ». À blanc, Hermes dit la ligne choisie.
- **Premier passage réel, vendredi 27/11/2026 (19 h 06, après son oui) : enregistrée, pas soumise.** Les « 1 » du lundi au
  vendredi sont enregistrés (« Save for Later », total 5,00, état « Saved »), mais « Submit » a été refusé : « Time Reporting
  Code is required on row 1 ». **Cause (lue sur la page par un passage en lecture seule de la session du serveur, le soir même)** :
  le code de temps d'une ligne est une liste déroulante ; sur la semaine vide, la ligne préremplie montre le code mais **aucune
  option n'est choisie** (valeur réelle vide ; la liste ne propose que le choix vide et le code) ; la semaine approuvée d'avant
  porte bien le code en valeur réelle. Après l'enregistrement il ne reste qu'une ligne (les lignes vides ont disparu, ou avaient
  été mal lues). **Corrigé dans la skill** (section « CRA de la semaine », étapes 3 à 6) : la valeur réelle du code se lit par
  `js()`, jamais dans le texte affiché ; en « MODE CRA », le code est choisi dans la liste s'il est vide, relu, puis « Save »,
  relecture (quantités et valeur réelle du code), « Submit » ; des quantités déjà enregistrées avec un code vide sont gardées.
  Pas prouvé au banc (le faux portail n'a pas cette liste) : la relance par « Relancer Hermes » dans JARVIS est l'essai réel.
  *Aussi* : `essai --consigne-fichier` n'ajoute pas l'adresse à la consigne (la consigne doit la porter) ; le compte rendu rendu à
  JARVIS ne porte plus de chemin de page et n'est plus coupé au milieu d'une phrase (`propre_texte`).
- **Chronos a mis en pause ses trois routines** le 26/11/2026 au matin (Canal, ligne 100 : validation du 24, CRA du
  26, CRA du vendredi), sur sa demande du 26/11 (« désactive toutes les routines Chronos qu'on a remplacées »).
  Dès lors, le CRA du mois de novembre est à Hermes, le 26.

**Le CRA du mois, construit le 26/11/2026 au matin (sa demande : « fais-le sur le vrai cas, on est en retard »)** :
- *Kit* : `hermes-portail cra-mois <adresse> --mois AAAA-MM --conges <dates[:matin|:apres-midi]> --feries <dates>
  [--a-blanc]` écrit la consigne « MODE CRA DU MOIS » : chaque jour ouvré (« mission », « congé », « férié », ou une
  demi-journée de chaque) et le total attendu. Garde-fous hors du modèle : un vrai mois, des jours ouvrés de ce mois,
  jamais validé avant le 24, jamais un mois déjà validé par Hermes (`/var/lib/hermes-portail/cra/mois-valides.txt`).
  La commande lit « Résultat : » (validé, déjà validé, complété pas validé, rien saisi, à blanc) et « Fin de
  mission : » (pour le mail de prolongation).
- *Skill (section « CRA du mois »)*, d'après la routine de Chronos : « Édition par activités » ; statut autre que la
  saisie en cours : rien ; « mission » = l'activité de la mission en cours, « congé » = « Congé payé », « férié » =
  « Absence » motif « Jours fériés », journée entière = matin et après-midi ; un jour déjà juste est gardé, un jour
  inscrit autrement arrête tout (rien corrigé en devinant) ; seuls les jours vides sont complétés (chaque clic
  s'enregistre) ; relecture du mois et des totaux ; « Valider ce compte rendu d'activité » une fois, confirmation une
  fois, statut relu (« en attente ») ; aucun justificatif ; la date de fin de mission relevée, jamais modifiée.
- *Banc* : 125 vérifications (6 nouvelles : refus d'un mois mal écrit, d'un samedi, d'un jour d'un autre mois, d'une
  demi-journée inconnue, avant le 24 ; consigne et totaux avec une demi-journée ; jours vides complétés, une seule
  validation, fin de mission lue, mois noté ; jamais deux fois ; à blanc avant le 24, un « validé » à blanc compte
  pour un échec). Fausse page : `/activite` de `essais/hermes/faux_portail.py`.
- *Pas fait* : le déclenchement automatique du 26 depuis son oui dans JARVIS (comme `cra-auto`) ; le dépôt du CRA du
  client (onglet du haut de la page de saisie) ; les mails par JARVIS (brouillon et bouton « Envoyer »). Pour
  novembre, les deux brouillons ont été préparés à la main dans Gmail le 26/11 au matin.

**Le 26/11/2026 au matin, sur le serveur (une demande, son oui)** : dépôt `5b78104`, JARVIS 0.84.0 → 0.84.1, kit à jour
(faille corrigée : le compte rendu n'est plus écrit chez JARVIS), **`cra.conf` posé** (le CRA de la semaine partira après
son oui du vendredi 27/11). Feuille de la semaine, de nouveau à blanc : « Résultat CRA : blanc », la première des trois
lignes identiques choisie, « 1 » du lundi au vendredi, rien tapé (1 min 41, 1,2 Go). **CRA du mois de novembre : à blanc
propre** (statut « Saisie en cours », chaque jour déjà inscrit comme la consigne : 15 de mission, 5 congés, 1 absence
fériée, rien à compléter ; fin de mission 30/11/2026), **puis validé en réel** : une validation, une confirmation, statut lu
« Validé par vous » (et non « en attente » : la skill accepte les deux depuis), 2 min 31, 1 Go. Hermes n'a pas pu lire
le motif de l'absence du 11 (non affiché). C'est la première exécution réelle d'Hermes à la place de Chronos : il la
vérifie sur l'intranet. Les mails de novembre (à son contact du client : 15 jours, congés passés et à venir ; à sa
chargée de mission : prolongation d'au moins 3 mois) sont partis de sa boîte le 26/11 au matin, après son oui (QCM),
envoyés par Claude, sans Grok Bot. Depuis : `cra-mois` pose aussi son compte rendu (`mois-<AAAA-MM>.json` : résultat,
fin de mission) dans le dossier de root pour l'espace « Travail » de JARVIS (en réel seulement) ; banc 145 (avec la note de télétravail).
**Sa règle du 26/11/2026** : les mails générés (demande du CRA, prolongation) ne passent jamais par Iris : JARVIS ou
Hermes les envoient directement (« on remplace Grok Bot, on n'ajoute pas de dépendance »). Les congés à venir s'écrivent
au futur (`mailCraPhrases` de JARVIS, 0.85.0).

**Le CRA du mois, seul (26/11/2026, son QCM « CRA du mois seul »)** : `hermes-portail cra-mois-auto`, lancé toutes les
15 minutes par `hermes-portail-cra-mois.timer` (posé et activé par `install.sh`). Il ne fait rien sans `adresse_mois=` dans
`/etc/hermes-portail/cra.conf` (root 600, l'adresse du compte rendu d'activité, à côté de `adresse=` du CRA de la semaine ; jamais
dans le dépôt). Ensuite, toutes ces conditions, sinon rien :
- le 26 du mois ou après (jamais avant : `cra-mois` refuse avant le 24) ; le mois d'avant aussi, jusqu'au 10, s'il l'a validé tard ;
- le mois validé dans JARVIS (`jours.json`, `mois[AAAA-MM]` : état « valide », validation v2 avec ses jours en demi-journées),
  lu par root sans suivre de lien (O_NOFOLLOW, fichier ordinaire, comme `cra-auto`) ;
- le mois pas encore validé par Hermes (`mois-valides.txt`) et ce oui pas encore tenté (`mois-tentes.txt`, `<mois>:<heure du oui>`) :
  un oui = une tentative ; pour réessayer, il valide de nouveau ses jours dans JARVIS.

Il passe alors à `cra-mois` ses congés (C : journée, matin ou après-midi) et ses fériés (F), tirés de ses jours validés ; un jour
en conflit (X) bloque tout. Après le passage : le compte rendu `mois-<AAAA-MM>.json` (espace « Travail », comme avant, plus
`premiere` et `auto`) et un avis poussé une fois sur ses appareils par JARVIS (le chemin des avis de `hermes-relance`,
`/var/lib/hermes-relance-avis`, sous-commande `aviser` de `limite.py`) : « Première exécution d'Hermes : CRA de <mois> validé »
(vérifie sur le portail), « CRA de <mois> validé », « déjà validé », ou « à relancer à la main ». Lancé à la main, il dit pourquoi il
ne fait rien (« rien à faire (novembre 2026 : déjà validé par Hermes.) ») ; par la minuterie, il se tait. Le dépôt du CRA du
client (le PDF reçu de son contact) reste à sa charge. Banc : section « CRA du mois : la minuterie » de `portail.test.sh`.

**Le CRA signé du client, déposé après son oui (27/11/2026, son QCM du 26/11 : « Hermes, après mon oui »)** :
`hermes-portail cra-signe-auto`, lancé toutes les 15 minutes par `hermes-portail-cra-signe.timer` (posé et activé par `install.sh`).
Il ne fait rien sans `adresse_mois=` dans `cra.conf`, ni tant que le CRA du mois n'est pas validé par Hermes (`mois-valides.txt`, ou
le compte rendu `mois-<AAAA-MM>.json` : `validee` ou `deja`), ni sans PDF gardé par JARVIS pour le mois (`jours.json`,
`mois[AAAA-MM].suivi.cra.signe` : `fichier`, `empreinte` ; le mois en cours et les deux d'avant), ni si JARVIS dit « rattaché » ou
« je le fais moi-même ». Un passage au plus par lancement, jamais en même temps que `cra-mois-auto` (son verrou) ni pendant un
autre passage d'Hermes :
- *la copie* : le PDF est lu sans suivre de lien (ni le dossier `cra-signe`, ni le fichier ; un fichier ordinaire, sans lien
  physique, 15 Mo au plus), « %PDF- » et empreinte SHA-256 revérifiés, puis recopié chez root
  (`/var/lib/hermes-portail/cra-signe/<mois>/signe.pdf`, 700/600). Refusé : compte rendu `echec`, une fois par empreinte ;
- *à blanc* (`cra-signe <adresse> --mois <AAAA-MM> --a-blanc`, « MODE DÉPÔT À BLANC ») : **aucun fichier n'est remis à Hermes** ; il
  ouvre la page du mois, trouve où se dépose le CRA signé, dit ce que la page montre et si un document y est déjà. Un essai par
  fichier (`tentes.txt`, `blanc <mois> <empreinte>`). Compte rendu `signe-<AAAA-MM>.json` (root 640, ni nom de portail, ni adresse,
  ni hôte : le texte est nettoyé) : `pret`, `deja` (rien à faire), `introuvable`, `echec` ;
- *le dépôt* (`cra-signe … --fichier <copie de root>`, « MODE DÉPÔT ») : seulement si `signe.oui` porte la même empreinte et le même
  mois, et si la copie de root a toujours cette empreinte ; le fichier est remis sous un nom fixe (`CRA-signe-<AAAA-MM>.pdf`, jamais
  le nom venu du mail), retiré après le passage. Une tentative par oui (`reel <mois> <empreinte> <heure du oui>`) ; un mois déposé
  (`deposes.txt`) ne repart jamais. Compte rendu `reel: true` : `depose` (`premiere` au premier dépôt fait par Hermes ; compté seulement si la ligne « Résultat » d'Hermes commence par « déposé » sans
  aucune négation : « non déposé », « n'a pas été déposé », « erreur »… valent `echec`), `deja`, `echec` avec une raison courte ;
- *la limite du forfait* : coupé avant tout contact avec le portail, l'essai (ou le oui) n'est pas compté et repart une fois
  (`hermes-portail-cra-signe.service`, connue de `limite.py`) ; après contact, ou deux fois : compté, « à faire à la main ».
  *Le coffre verrouillé* : rien n'est compté ni dit, nouvel essai au quart d'heure suivant.
*Depuis la 0.98.0* : le oui peut être posé par JARVIS lui-même (`oui.auto`) quand le PDF correspond à la saisie (contrôle sans IA, `signe-controle.mjs`) et qu'un premier dépôt a déjà réussi ; root ne fait aucune différence : même empreinte, même mois, une tentative par oui. La skill a une section « CRA signé du client ». À la main : `sudo hermes-portail cra-signe-auto` dit pourquoi il ne fait rien.
Banc : section « CRA signé du client » de `portail.test.sh`.

**Les routines de Chronos, une par une (26/11/2026, 8 h)** :

| Routine de Chronos | Qui la fait maintenant | Reste |
|---|---|---|
| Validation des jours (le 24) | En pause chez Chronos ; JARVIS (bilan, son oui) | Rien |
| CRA mensuel (le 26) | En pause chez Chronos ; Hermes, en réel (novembre validé le 26/11) ; **seul depuis le 26/11** (`cra-mois-auto`, le 26 ou après, sur son oui dans JARVIS) | `adresse_mois=` à poser dans `cra.conf` ; dépôt du CRA du client (le PDF de son contact) : à sa charge |
| Mails du mois (le 24 et le 26) | JARVIS prépare le brouillon, il l'envoie depuis JARVIS (0.85.0) | Modèles à poser sur le serveur (`travail.json`) |
| CRA hebdomadaire (vendredi) | En pause chez Chronos ; Hermes, en réel dès son oui du 27/11 | Sa vérification après la première exécution |
| Note de télétravail (fin de mois) | Hermes, en réel (Chronos arrêté le 26/11, ligne 101) : préparée le 30/11, posée « à valider » | Son « Valider et créer » dans JARVIS (première exécution), puis sa vérification |
| Note de la box (le 15) | Hermes, en réel (Chronos arrêté ; novembre fait par Chronos le 15/11) | Première vraie note le 15/12, posée « à valider » |
| Note de l'abonnement Claude (le 21 et « Facture reçue ») | Hermes, en réel (Chronos arrêté, « Facture reçue » aussi ; novembre fait par Chronos) | Première vraie note à la facture de décembre (vers le 21/12), « à valider » |
| Note Grok Bot (le 4) | Hermes (Chronos arrêté, ligne 102 ; novembre fait par Chronos le 4/11) | Une éventuelle dernière facture de xAI après le 3/12, « à valider » ; ensuite retirer `note-grok.conf` |

**Les notes de frais en réel (26/11/2026, soir ; ses décisions : « tout arrêter ce soir » chez Chronos, « valide avec moi la
première fois, c'est tout » ; Grok Bot s'arrête le 3/12)** : Chronos ne fait plus les notes Claude, box ni télétravail (ligne 101
du Canal, section H de sa fiche), ni « Facture reçue » ni la note Grok Bot (ligne 102) : plus rien chez lui au 3/12. Hermes les fait, par un circuit commun (`hermes-portail`, `ndf_*`) :
- *préparer* : `note box|claude|grok` (la facture : espace client de la box avec `--code-mail`, ou Gmail pour les abonnements
  Claude et Grok Bot, vendeurs réglés sur le serveur ; son texte ;
  montant et date par règles sans IA, `note.py` ; garde-fous : facture hors de la période attendue, montant à plus de 50 % du mois
  d'avant, même facture déjà servie ; contrôle de TVA réglé par sorte : `tva_controle` = aucune, presente ou taux:20, celui de
  la routine de Chronos pour Grok Bot) ; `teletravail` (inchangé, voir plus haut) ; dans les deux cas la dépense est d'abord
  remplie puis annulée (à blanc) ;
- *poser* : la note (champs, justificatif, empreinte) dans `/var/lib/hermes-portail/ndf/<sorte>-<mois>/` (root) et son compte
  rendu `ndf-<sorte>-<mois>.json` pour JARVIS ; la première de chaque sorte est « à valider » ;
- *valider* : JARVIS 0.86.0 la lui montre (« Pour moi », espace Travail) ; son oui est gardé dans `jours.json` sur l'empreinte ;
- *créer* : `ndf-auto` (minuterie de 5 minutes, `hermes-portail-ndf.timer`) lit son oui et fait créer la note par Hermes
  (« MODE NOTE » de la skill : doublon vérifié d'abord, un seul clic qui crée, liste relue) ; registre de root (`creees.txt`) :
  jamais deux fois ; compte rendu « créée » (première exécution : il vérifie), « déjà présente » ou « pas créée » ;
- *ensuite* : une sorte créée une fois après son oui part seule (posée « auto », créée aussitôt), et il est notifié.
Déclenchement : `notes-auto` chaque jour à 12 h 20 (`hermes-portail-teletravail.timer`) : télétravail le dernier jour, box à
partir du `jour` de ses réglages (15), Claude et Grok Bot dès que leur facture du mois est dans Gmail (sinon réessayée le lendemain ; Grok Bot s'arrête le 3/12 : une
éventuelle dernière facture passe par Hermes, validée par lui).
Comparatifs et rodage, rien de posé : `note <sorte> --mois <mois fait par Chronos> --comparer <JJ/MM/AAAA>` (à blanc, puis
Hermes ouvre la dépense de Chronos de ce jour-là en lecture seule et dit champ par champ « identique » ou « différent », sans
recopier de valeur) ; `teletravail --mois <mois> --jours-rodage <jours> [--comparer <JJ/MM/AAAA>]` (les jours d'une note
acceptée, quand l'agenda n'avait pas encore les lieux ; `--jours-rodage jarvis` : les jours de JARVIS notés jusqu'ici, ceux à
venir ignorés, pour un rodage en cours de mois). Réglages sur le serveur seulement (root 600) : `notes.conf`
(`ndf_adresse`), `note-box.conf`, `note-claude.conf` et `note-grok.conf` (`source`, `facture_adresse` ou `facture_requete`/`facture_nom`,
`code_mail`, `facture_fenetre`, `jour`, `date_depense` = facture, `jour:NN` ou `dernier`, `champs`, `precedent_montant`, et
`montant_motif`/`date_motif` si la lecture par défaut ne trouve pas, `ht_motif`/`tva_motif` et `tva_controle`) et leurs modèles de champs (`{DATE}`, `{DATE_FACTURE}`,
`{MONTANT}`, `{MONTANT_HT}`, `{TVA}`, `{MOIS_NOM}`, `{ANNEE}`). Banc : 18 vérifications de plus (note posée, oui sur une autre
empreinte refusé, création unique, box : période, montant inhabituel, comparatif, première validée, mois suivant seul, minuterie ;
Grok Bot : contrôle de TVA qui arrête une facture fausse, puis posée à valider ; rodage du télétravail sur les jours de JARVIS),
et `essais/hermes/note.test.sh` (10, la lecture des factures).

**Le mois, au complet (ses précisions et QCM du 26/11/2026, nuit)** : la validation du 24 et le CRA du 26 de Chronos
font aussi deux mails et un rattachement, pas encore chez Hermes ; ces deux routines de Chronos ne se mettent pas en
pause avant que tout ceci marche :
- *Le 24, après son oui sur les congés* : un mail à son contact du client (« CRA <Mois> <Année> », dans le fil de son
  dernier mail de ce titre ; paragraphes : bonjour, « J'ai <N> jours sur ce mois. J'étais en congés <dates>. »,
  demande du CRA du mois, merci, signature ; N sans arrondir les demi-journées ; congés omis s'il n'y en a pas). Puis
  guetter sa réponse, qui porte le CRA du client en PDF.
- *Le 26* : CRA mensuel saisi et validé sur l'intranet (statut « en attente ») ; date de fin de mission relevée. Fin
  dans le mois (ou avant) : un mail à sa chargée de mission (« Prolongation mission <client> », style amical, date
  exacte constatée, au moins 3 mois) ; fin le mois suivant : simple alerte.
- *Le CRA du client reçu* : le rattacher au CRA mensuel pour la validation définitive. **Son explication** : sur la
  page de saisie du CRA, un onglet en haut mène à une page qui montre le statut et des boutons pour déposer le CRA
  du client.
- **Les mails (son choix, QCM)** : JARVIS prépare le brouillon dans Gmail et montre un bouton « Envoyer » dans sa
  carte ; son appui l'envoie (c'est sa confirmation) ; sinon il l'envoie lui-même depuis Gmail.
- Les règles exactes (adresses, objets, corps) sont dans Pilotage (« Textes des routines », Chronos) : jamais ici.
- Vu le 25/11/2026 sur l'intranet : la mission finit le 30/11/2026. Chronos prépare le mail de prolongation le 26.

**Où voir tout ça (son choix, QCM du 26/11/2026)** : un espace **« Travail »** dans JARVIS (tuile d'Espaces), séparé
de « Pour moi » (qui ne garde que ce qui attend son oui) : CRA (la semaine, le mois avec ses mails et le CRA du
client), notes de frais (abonnement d'IA, box, télétravail), jours du mois ; pour chaque routine, qui la fait
(Chronos, Hermes à blanc, Hermes en réel), ses étapes et leur avancement, la dernière exécution (date, résultat),
la prochaine date et les données prévues d'un coup d'œil. **Maquette faite le 26/11/2026** (`essais/jarvis-travail/`,
données inventées, aucun nom réel) : filtres Tout, CRA, Notes de frais, Jours ; « Ce qui vient » en frise ; une carte
par routine (qui, étapes reliées et barre d'avancement, prochaine et dernière exécution, données prévues, « À toi »
en ambre) ; le détail dans une feuille du bas (déroulé daté, brouillon de mail avec « Envoyer » et « Modifier »,
dernières exécutions). En attente de son avis avant de l'appliquer à l'app.

**Dettes connues**
- Un passage dont le navigateur ne démarre pas rend quand même le code 0 : juger à la réponse.
- Deux notes dites autrement ne sont pas reconnues comme un doublon ; une note fausse reste jusqu'à son retrait.
- La lecture d'une facture pour écrire le fichier des champs est faite par la session du serveur : à remplacer par
  des règles par sorte de facture pour une routine sans personne.
- Sur la facture de l'abonnement d'IA, l'émetteur et son pays de TVA ne sont pas ceux que la routine de Chronos
  écrit : repris tels quels pour comparer ; à lui de dire si c'est voulu.
- Redémarrage du serveur jamais essayé : tout doit attendre `sudo jarvis-coffre ouvrir` ; la route IPv6 retirée
  revient ; les sessions de portail faites de cookies de session ne survivent pas à un passage.
- L'avis de taxe foncière suivant : tâche à lui créer quand le mail de l'administration fiscale arrive.
- Le texte de la routine d'abonnement d'IA noté dans Pilotage est en retard sur ce que Chronos saisit.
