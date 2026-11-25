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
| `hermes-portail` | La commande (`/usr/local/sbin/hermes-portail`) : `etat`, `connexion-claude`, `enregistrer`, `domaines`, `essai` (et `--code-mail`, `--telecharger`), `brouillon` (et `--sans-creer`), `facture`, `texte`, `notes`, `cle`, `fermer`, `oublier`. Un essai lance l'unité `hermes-portail-essai`. |
| `hermes-portail-essai.service` | Un passage, enfermé (mêmes lignes que `hermes-gateway.service`, mémoire sans échange ; depuis le 25/11/2026, filtre d'appels système et espaces de noms interdits). Une vraie unité, pas `systemd-run` : au premier essai sur le serveur, `systemd-run -p IPAddressDeny=link-local` a été refusé alors que la même ligne est valable dans une unité. Consigne dans `/home/hermes-portail/.consigne`, réponse dans `/var/lib/hermes-portail/essais/`. |
| `politique.yaml` | Sa politique (`/etc/hermes-portail/config.yaml`, root) : outils `browser`, `terminal`, `skills` seulement ; Sonnet ; profil de navigateur gardé ; navigateur envoyé vers le relais, lancé sans son bac à sable (dit en clair, voir « Durcissement »), remplissage automatique et heure réseau coupés. |
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

Prouvé (107 vérifications, 25/11/2026) : installation ; outils réduits et politique figée ; clé seulement en ramfs,
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

**Ce qu'il faut construire** (rien n'existe encore) :
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
