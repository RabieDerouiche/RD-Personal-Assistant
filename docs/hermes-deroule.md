# Hermes, Grok Bot, Claude et JARVIS : le déroulé (depuis le 23/11/2026)

Sa demande du 23/11/2026 : mettre en place le déroulé idéal avec Hermes, lui donner des droits équivalents à
ceux de Grok Bot, commencer des routines pour alléger Grok Bot, relier Hermes à JARVIS, voir quelles skills
lui donner (et à Claude), le tout pilotable depuis JARVIS. Objectif à terme : remplacer Grok Bot, **seulement
si Hermes fait tout ce que Grok Bot fait, sans compromis sur la qualité ni sur les routines**.

Installation et garde-fous d'Hermes : `docs/hermes.md`. Système Grok Bot : `docs/systeme-grok-bot.md`.
Version pour lui : Google Doc « Hermes, Grok Bot, Claude et JARVIS : le déroulé (23-11-2026) », dossier `Grok Bot/`
(`1leDb53BzPGQtd_Y3Ud84qkSi5YKyxTJEu3pQWNPbogI`).
Rien de personnel ici.

## Ses décisions (QCM du 23/11/2026 au soir)

| Question | Son choix |
|---|---|
| Routines à mettre en double d'abord | Supervision (Argus) et Semaine à venir (Iris), puis la Veille du matin d'Iris. **Corrigé par lui le 24/11/2026** : la Supervision « ne sert à rien sur Hermes » (elle surveille les bots de Grok Bot : la refaire n'allège rien et n'apprend rien) : retirée. Veille du matin : oui. Il veut « du lourd » : un vrai scénario automatisable de A à Z (voir « Scénario des couches ») |
| Routines qui demandent le web | **Essai du web chez Hermes**, sur le Digest d'Athéna seulement, en double, avec un jeton à part qui ne voit pas ses mails |
| Chronos (portails) | **Reste chez Grok Bot** : pas de remplacement complet pour l'instant |
| Durée du double | **2 semaines** avant la comparaison et sa décision de bascule |

## Qui fait quoi

| Pièce | Rôle | Ce qu'elle ne fait pas |
|---|---|---|
| **JARVIS OS** (son app, son serveur) | Tour de contrôle : tout s'y voit et s'y décide. Seule porte vers Google pour Hermes (serveur MCP, profil « exécutant »). Notifications, rappels d'échéances, brief sans IA, Radar. | Ne remplace pas un bot : il borne, il montre, il notifie. |
| **Hermes** (Telegram, serveur) | Exécutant des routines à heure fixe sur Pilotage, Gmail et l'agenda ; discussion ; apprend (mémoire, skills). Sur l'abonnement Claude, Sonnet pour les routines. | Ni web, ni terminal, ni fichiers, ni navigateur, ni jeton Google. Aucun portail. |
| **Grok Bot** (7 bots) | Ce qu'il fait de mieux : les portails de Chronos, le traitement d'un mail à son arrivée (alias des bots), l'app iPhone et la voix. Reste la référence de chaque routine tant qu'elle n'est pas basculée. | — |
| **Claude** (sessions de développement) | Le code (JARVIS, kit d'Hermes), les fiches, la Charte, les skills, la comparaison des routines « en double », sur demande. | Aucune routine, aucune veille de sa propre initiative. |

## Les droits d'Hermes (équivalents à ceux de Grok Bot, bornés par JARVIS)

Hermes n'a aucun accès direct : chaque geste passe par un outil du serveur MCP de JARVIS, ouvert au seul jeton
« Hermes » (profil « exécutant », créé par le propriétaire dans Réglages, suspendu ou retiré d'un bouton).
L'onglet Autonomie de Pilotage fait foi ; ce tableau en est l'application.

| Geste | Hermes | Outil de JARVIS |
|---|---|---|
| Lire Pilotage (tous les onglets des bots) | Seul | `pilotage_lire` |
| Lire ses mails, son agenda principal, Échéances, Présence, jours fériés | Seul | `gmail_chercher`, `gmail_lire`, `jarvis_agenda`, `agenda_lire` |
| Écrire ses lignes : Journal, Canal (sous son nom), Sorties, Relevés, sa ligne d'État | Seul | `pilotage_ajouter`, `pilotage_etat`, `canal_repondre` |
| Préparer un brouillon de mail | Seul, puis il l'informe | `gmail_brouillon` (jamais d'envoi) |
| Le notifier sur l'iPhone | Seul, 12 par jour au plus | `jarvis_notifier` |
| Demander un travail à Claude ou un ordre à un bot | Proposition : il l'approuve dans JARVIS | `jarvis_proposer_mission`, `jarvis_proposer_ordre` |
| Envoyer un mail, créer un événement, modifier un dossier ou une échéance tenus par un bot | Pas d'outil aujourd'hui | à ouvrir routine par routine |
| Payer, acheter, réserver, supprimer, partager, Drive, « Papiers privés », Radar | Jamais | aucun outil |

Pourquoi par JARVIS plutôt qu'avec le skill Google d'Hermes (son propre jeton Google et un terminal) :
- (certain, code de la 0.23.3) ce skill demande toujours les droits complets (envoi de mail, Drive entier avec
  partage et corbeille) et exige l'outil terminal ; « confirmer d'abord » n'y est qu'une consigne au modèle ;
- un mail piégé lu par un agent qui a un terminal et Internet peut faire sortir des données ; sans terminal ni
  web, il ne peut qu'appeler les outils que JARVIS lui laisse ;
- JARVIS note chaque écriture (« Derniers gestes des exécutants »), plafonne par jour, et coupe d'un bouton ;
- une seule connexion Google à tenir (celle de JARVIS, déjà publiée).
Ouvrir un accès direct plus tard reste possible : c'est sa décision, par QCM.

## Les routines de Grok Bot : où elles vont

24 routines dans l'onglet Routines le 23/11/2026 (hors passages lancés par la plateforme).

| Routines | Destination | Quand, à quelle condition |
|---|---|---|
| Argus : Supervision (lun, mer, ven) | Reste chez Grok Bot | Essayée en double le 23/11/2026, retirée le 24/11 à sa demande : surveiller les bots de Grok Bot n'a de sens que chez Grok Bot (et JARVIS repère déjà seul une pause de Grok). |
| Iris : Semaine à venir (dim) | **Hermes, en double** | Phase 1, maintenant. |
| Iris : Veille du matin (lun-ven) | **Hermes, en double** (7h40) | Depuis le 24/11/2026. En double il n'écrit rien dans Dossiers ni Échéances : il note au Journal ce qu'il aurait écrit. Pour la bascule : outils de JARVIS à ajouter, bornés à ces colonnes. |
| Athéna : Digest IA et .NET | **Hermes, en double, avec le web** (lundi 9h10) | Depuis le 24/11/2026 (son choix : essai du web sur cette seule routine). Elle a l'outil web et le serveur « jarvis-web » (jeton « Veilleur ») ; jamais les mails. Posée dès qu'il a créé le second jeton. |
| Ulysse : Sorties du week-end ; Kairos : Liste du mois, Prix suivis | Après l'essai du web | Phase 3, son choix (QCM). Le web d'Hermes marche sans clé (services gratuits, limités) ; il exige un jeton à part, sans Gmail, pour qu'une page piégée ne puisse rien lire de privé. Les sites marchands et de crédit bloquent souvent la lecture automatique : Prix suivis en dernier. |
| Iris : Courrier prioritaire ; Kairos : Signal prix ; Chronos : Facture reçue | Restent chez Grok Bot | Phase 4 seulement s'il le demande : il faut que JARVIS repère le mail à son arrivée et réveille Hermes (écarté le 17/11 tant que les alias de Grok Bot existent). |
| Chronos : notes de frais, validation des jours, CRA (8 routines) | **Restent chez Grok Bot** | Trois portails avec connexion, codes et sessions qui expirent ; un navigateur ne tient pas sur le VPS-1 à côté de JARVIS (Likely). C'est le verrou du remplacement complet. |
| Argus : Bilan du lundi | Reste chez Grok Bot | Il lit la consommation de Grok dans l'app de Grok. |
| Sonnettes (6) | Restent tant que le bot garde une routine | Hermes n'a pas besoin de sonnette par mail : ses lignes du Canal sont lues à chaque passage ; un réveil local par JARVIS viendra s'il le faut. |

## La méthode de bascule (pas de compromis sur la qualité)

1. **En double** : Hermes fait la routine en même temps que le bot de Grok Bot, sans rien déranger : il n'écrit
   que sa ligne du Journal (« En double : <routine> ») et sa ligne d'État, et envoie son résultat sur Telegram
   (« En double · <routine> »). Le bot de Grok Bot reste la référence.
2. **Comparaison** par Claude, à sa demande (skill `hermes`) : au moins 3 passages, exemples datés, verdict
   « au niveau », « meilleur » ou « en dessous », et la correction de skill à faire.
3. **Bascule** : sa décision, par QCM. Fiche du bot mise à jour, ligne du Canal pour ce bot (routine mise en
   pause, jamais supprimée), `routines.conf` sans « en double », onglet Routines.
4. **Retour arrière** : l'inverse, en une vague.

Tant qu'une routine est en double, Grok Bot n'est pas allégé : c'est le prix de la comparaison. L'allègement
commence à la première bascule.

## Les skills

- **Hermes, du dépôt** (`jarvis-os/hermes/skills/`, copiées dans `/etc/hermes/skills`, en lecture seule pour
  lui) : `pilotage` (les outils de JARVIS, les règles de chaque passage, le mode « en double » : c'est sa
  Charte), `supervision`, `semaine-a-venir`. Une skill par routine ; la routine la charge seule.
- **Hermes, apprises** : il propose une skill quand une tâche lui a demandé plusieurs essais ou qu'il est
  corrigé ; rien n'est écrit sans « /skills approve » du propriétaire dans Telegram (`/skills pending` les
  montre). `diagnostic.sh` les compte. Une skill apprise qui vaut pour tous passe dans le dépôt.
- **Hermes, livrées avec lui** (44 : code, GitHub, ordinateur…) : coupées. Elles supposent un terminal et
  alourdissaient chaque message.
- **Claude** (`.claude/skills/`) : `hermes` (changer une routine ou une skill, comparer une routine en double,
  préparer une bascule, appliquer sur le serveur). Les sept autres ne changent pas.
- **JARVIS** (`jarvis-os/server/skills/`) : les skills relues de ses missions ; rien à ajouter pour Hermes.

## Le forfait

- Routines sur **Sonnet** (`cron.model` de la politique), discussion sur Opus (`/model` pour changer).
- Phase 1 : 4 passages par semaine. (guessing) Un passage lit une dizaine d'onglets : de l'ordre de 1 % de la
  fenêtre de 5 heures chacun, à mesurer sur les premiers passages (`/usage`).
- Le garde arrête Hermes à 85 % de la semaine (`docs/hermes.md`). La fenêtre de 5 heures n'est pas gardée (sa
  demande) : une routine qui tombe sur une fenêtre pleine échoue et le dit sur Telegram ; elle n'est pas
  rejouée. Une routine manquée parce qu'Hermes était arrêté est rejouée une fois à son retour.
- (Likely) Faire tourner des routines par un outil tiers sur l'abonnement reste dans la zone grise décrite dans
  `docs/hermes.md` ; le plan B (crédits d'API inclus dans Max) est prêt.

## Piloter depuis JARVIS

- Réglages, « Assistants reliés (MCP) » : le jeton « Hermes » (profil « Exécutant »), « Suspendre »,
  « Reprendre », « Retirer », et ses derniers gestes (date, outil, ce qu'il a écrit).
- Équipe : Hermes y apparaît dès sa première ligne dans l'onglet État (comme tout bot).
- Une demande pour Hermes : une ligne du Canal `Pour = Hermes` ; il la traite à son prochain passage et répond
  dans la colonne Réponse. Ses questions arrivent dans « À toi » (`Pour = Rabie`).
- À venir, sur sa demande : voir et lancer les routines d'Hermes depuis JARVIS ; un réveil local d'Hermes par
  JARVIS (sans mail) quand une ligne lui est adressée.

## Mettre en service (ordre)

| Étape | Qui, où |
|---|---|
| 1. JARVIS 0.71.0 : « Nouvelle version disponible », « Mettre à jour » | Lui, dans JARVIS |
| 2. Kit d'Hermes : `git pull`, `install.sh` (skills, politique ; Hermes redémarre, toujours sans JARVIS) | Session « Serveur JARVIS », confiée par Claude |
| 3. Jeton : Réglages, « Assistants reliés (MCP) », nom « Hermes », profil « Exécutant » ; copier le jeton | Lui, dans JARVIS |
| 4. `sudo bash /opt/rd/jarvis-os/hermes/relier-jarvis.sh` : coller le jeton | Lui, dans Termius (saisie) |
| 5. `routines.sh`, puis `diagnostic.sh` | Session « Serveur JARVIS », confiée par Claude |
| 6. Faire connaître Hermes aux bots : nom dans la Charte, ligne du Canal pour Argus (il ne doit pas prendre les lignes d'Hermes pour une anomalie), lignes dans l'onglet Routines | Claude, dans la même vague |

## État

- 23/11/2026 : déroulé écrit ; JARVIS 0.71.0 (jetons fixes nommés, profil « exécutant », outils Pilotage, Gmail,
  agenda, brouillon, notification) ; kit d'Hermes (politique des étapes 3 et 4, `relier-jarvis.sh`,
  `routines.sh`, trois skills, consigne) ; banc d'Hermes 72 sur 72 avec un faux JARVIS. Rien n'est encore en
  service : voir « Mettre en service ».
- 23/11/2026 : vérifié aussi le vrai `mcp.mjs` devant le client MCP d'Hermes (jeton exécutant : ses outils ; jeton
  lecture : non ; mauvais jeton : 401) et les en-têtes réels de Pilotage (ligne 3 pour « À toi » et Prix, ligne 1
  ailleurs ; colonne Bot dans Sorties et Relevés). Bancs de JARVIS : serveur 331, Radar 131, page 226, bout en
  bout 124.
- 23/11/2026, 19h30 (heure de Paris), par la session « Serveur JARVIS » : dépôt `3c4d4a8`, JARVIS relancé en
  **0.71.0** (actif, répond en HTTPS), `install.sh` d'Hermes code 0 (3 skills du dépôt, 44 coupées, Telegram
  reconnecté, 5 outils sur Telegram et 4 pour les routines, plafonds mémoire 850/1000 Mo). Pas encore relié :
  il lui reste à créer le jeton « Hermes » dans Réglages et à lancer `relier-jarvis.sh` dans Termius ; ensuite
  `routines.sh` par la session du serveur, puis la vague « faire connaître Hermes » (Charte, Argus, onglet
  Routines). Mémoire : verdict « Suffisant » (1,7 Go disponibles : JARVIS venait de recharger son écoute,
  1 Go) ; à remesurer après les premiers passages.
- À faire ensuite, selon ses réponses : (1) Veille du matin en double (outils de JARVIS pour écrire dans Dossiers
  et Échéances, skill, ligne de `routines.conf`) ; (2) essai du web sur le Digest (profil de jeton sans Gmail,
  second serveur MCP dans la politique d'Hermes, outil `web` pour cette seule routine, skill) ; (3) comparaison
  des routines en double à partir du 07/12/2026, à sa demande.
- 23/11/2026, 22h54 (heure de Paris) : **en service**. Liaison posée par lui à 21h38 (16 outils, aucune erreur) ; routines `supervision` et `semaine-a-venir` posées, en double (premiers passages : mercredi 25/11 à 8h50, dimanche 29/11 à 18h10). Fin du double et comparaison : à partir du 07/12/2026. Son premier essai sur Telegram a répondu « pas encore accès » : conversation commencée avant la liaison, `/new` à faire. Pas encore fait : la vague « faire connaître Hermes » (Charte, Argus, onglet Routines), après son essai réussi ; les outils qui touchent le vrai Google (lecture de Pilotage, Gmail, agendas) seront éprouvés par cet essai.
- 23/11/2026, 23h00 : son essai dans une conversation neuve réussit (agenda, « À toi », échéances, météo, lus par
  JARVIS ; il n'a pas écrit le taux d'une offre de crédit). Fait ensuite, la vague « faire connaître Hermes » :
  paragraphe « Hermes » dans la Charte (après les noms des bots), ligne 98 du Canal pour Argus (demande
  technique, sans sonnette : skill « registre » à jour, ne pas prendre ses lignes pour une anomalie ; traitée à
  sa Supervision du mercredi 25/11 à 8h44, avant le premier passage d'Hermes), trois lignes « Hermes » dans
  l'onglet Routines (État « En double »). **Veille du matin en double** : skill `veille-du-matin` (d'après la
  section C de la fiche d'Iris, sans l'astuce ni le trafic, qu'il n'a pas), ligne de `routines.conf` (lundi à
  vendredi, 7h40). Banc d'Hermes : 73 sur 73. Reste : l'essai du web sur le Digest d'Athéna (second jeton sans
  Gmail, à créer par lui) ; les outils d'écriture dans Dossiers et Échéances, pour la bascule de la Veille.
- 23/11/2026, 23h08 : appliqué par la session « Serveur JARVIS » (dépôt `45901b3`, `install.sh` code 0, 4 skills, 16 outils réannoncés, Telegram reconnecté) ; `routines.sh` : `veille-du-matin` posée, premier passage le mardi 24/11 à 7h40 ; trois routines actives, toutes en double. À regarder au premier passage : la lecture du vrai Pilotage et de Gmail par `pilotage_lire` et `gmail_chercher`, encore jamais faite sur les vraies données (l'essai du soir n'a exercé que `jarvis_maintenant`).
- 24/11/2026 (nuit), sa correction : Supervision retirée d'Hermes (ligne de `routines.conf`, skill, ligne de
  l'onglet Routines ; ligne 98 du Canal pour Argus réécrite avant qu'il ne la lise). Restent en double : Veille
  du matin et Semaine à venir (il ne savait pas ce que fait la seconde : question posée par QCM). Essai du web :
  demandé (« Web ») ; côté JARVIS, profil « veilleur » en cours (0.72.0). Nouveau cap : un scénario de A à Z.

## Scénario des couches (sa demande du 24/11/2026)

Ce qu'il veut : quand l'alerte de son abonnement de couches arrive (« il reste 7 ou 5 jours »), recevoir une
question : garder la date, l'avancer, ou la reporter d'une ou deux semaines ; puis que ce soit fait.

Ce que montrent ses mails (lus le 24/11/2026, certain) : le marchand envoie « Renouvellement de votre
abonnement » quelques jours avant de préparer la commande (« Dans N jours… expédiée le JJ/MM/AAAA »), avec un
lien « Mon compte » pour décaler, avancer, mettre en pause ou résilier ; six mails de ce type en trois mois.
Son espace client est un formulaire de connexion classique (adresse, mot de passe, jeton anti-rejeu), sans
captcha visible sur la page de connexion : (Likely) un script sans navigateur peut s'y connecter et changer la
date ; la page de l'abonnement n'a pas été vue (elle demande la connexion).

Découpage proposé :
1. **Repérer** le mail : une règle, sans IA (expéditeur et objet), et lire N et la date dans le texte.
2. **Demander** : une question à 4 choix, sur Telegram par Hermes ou par une notification de JARVIS.
3. **Agir** : seul point difficile. Soit un outil de JARVIS qui se connecte à l'espace client (mot de passe
   saisi par lui dans Termius, gardé sur le serveur, jamais vu par Hermes ni par Claude), soit un mail au service
   client, soit un lien direct qu'il touche lui-même.
4. **Confirmer** : la nouvelle date relue sur le site, écrite dans le Journal, et dite sur Telegram.
Décisions demandées par QCM : la façon d'agir, où arrive la question, agir tout de suite ou après un second oui.

Ses réponses (QCM du 24/11/2026) :

| Question | Son choix |
|---|---|
| Qui change la date chez le marchand | « JARVIS ou Hermes, mais n'est-ce pas mieux si c'est Hermes ? » Réponse donnée : Hermes décide et déclenche, JARVIS tient le mot de passe et fait le geste. Hermes sur le site lui-même demanderait un navigateur (qui ne tient pas sur le VPS-1) et lui ferait voir le mot de passe |
| Où arrive la question | **Notification de JARVIS** (carte à boutons dans l'app) |
| Après son choix | **Tout de suite** : son choix vaut accord pour ce changement précis (ligne ajoutée à l'onglet Autonomie, ligne 21) |
| Semaine à venir en double | **Retirée** (il ne lit pas ce message) |

Chaîne retenue :
1. **Hermes** repère le mail (routine du matin), calcule un conseil (dates des dernières livraisons, quantité,
   rythme) et crée dans JARVIS une **décision** : la question, 4 choix, chacun lié à un geste d'un catalogue fermé.
2. **JARVIS** notifie ; il touche un bouton ; JARVIS fait le geste aussitôt sur l'espace client, relit la date,
   confirme par une notification et note le résultat (Journal, « Derniers gestes »).
3. **Hermes** lit le résultat à son passage suivant et retient son habitude (mémoire).
À construire, dans l'ordre : la sonde (faite : `jarvis-os/server/install/portail-couches.sh`, lancée par lui dans
Termius) ; le geste d'après le squelette qu'elle rapporte ; les décisions à boutons de JARVIS (outil
`jarvis_demander` pour les exécutants) ; la routine et la skill d'Hermes.
- 24/11/2026 (nuit) : Semaine à venir retirée d'Hermes à sa demande ; il lui reste la Veille du matin en double.
  Onglet Routines : une seule ligne « Hermes » ; ligne 98 du Canal réécrite. Onglet Autonomie, ligne 21 : décaler,
  avancer ou garder la livraison des couches après son choix dans JARVIS. Sonde de l'espace client écrite et
  essayée sur un faux site (`bash jarvis-os/server/tests/portail-sonde.test.sh`, 7 vérifications) : elle ne lit
  que le squelette des pages, sans donnée personnelle ni secret. Banc d'Hermes : 73 sur 73.
- 24/11/2026 (nuit) : **essai du web prêt**. JARVIS 0.72.0 (profil « veilleur », signature). Kit : `web` n'est plus dans
  `agent.disabled_toolsets` (ni le groupe « safe », qui le contenait : vu au banc), mais dans aucune liste de
  `platform_toolsets` ; `politique-jarvis-web.yaml` (serveur « jarvis-web », 5 outils) ajouté par `install.sh` quand
  le second jeton est posé (`relier-jarvis.sh --web`, qui refuse un jeton « Exécutant ») ; `routines.conf` a une
  colonne « outils » (liste exacte d'une routine, écrite dans `enabled_toolsets` par `routines.sh`, qui refuse le
  web avec le serveur « jarvis ») ; skill `digest-ia` d'après la fiche d'Athéna. Les six rubriques « actuelles »
  d'Athéna ne sont écrites nulle part que je puisse lire (son texte de routine n'est pas dans « Textes des
  routines ») : la skill part de l'onglet Sources et de rubriques déduites. Banc d'Hermes : 84 sur 84 (au banc,
  Telegram n'a ni le web ni « jarvis-web » ; la routine du web lit Sources par le jeton « Veilleur », n'a pas
  l'outil des mails, a `web_search` et `web_extract`). **Non vérifié** : la recherche web sans clé elle-même
  (services gratuits d'Exa, Parallel, Firecrawl, Keenable, d'après la doc d'Hermes) : premier vrai passage.

## Autres workflows étudiés pour Hermes (sa question du 24/11/2026)

Sa question : sur quoi Hermes serait plus efficace, et quoi ajouter à ce que fait déjà JARVIS. Réponse donnée :
Hermes n'est aujourd'hui « plus efficace » sur rien par ses moyens (même serveur, même Claude, même forfait que
JARVIS, et moins d'outils que ses missions) ; son intérêt est la mémoire d'un passage à l'autre, le jugement
sur des mails à heure fixe sans la réserve Grok, et les boucles « repérer, demander, agir, confirmer, retenir ».

| Sujet | Déjà géré par | Verdict |
|---|---|---|
| Dossiers qui dorment (tiers muet depuis N jours : carte Relancer / Attendre / Clore, brouillon de relance) | Iris, au cas par cas, sans règle de délai ; dépend de la réserve Grok (une relance manquée pendant la pause du 13 au 17/11) | Le plus utile ; à greffer sur la Veille du matin, sans passage en plus ; demande un outil borné pour écrire dans Dossiers et une ligne dans la Charte |
| Abonnements et renouvellements | Le Radar de JARVIS (mails lus chaque matin par règles) ; Hermes n'a pas le droit de lire le Radar | Doublon : si des boutons Garder / Résilier sont voulus, ils vont dans le Radar, sans Hermes |
| Mail à l'arrivée sans Grok | Iris (Courrier prioritaire), Kairos (Signal prix), Chronos (Facture reçue) | Seul Courrier prioritaire est transférable (Signal prix exige le web, Facture reçue un portail) ; plus de filtres Gmail à la main, mais le plus gros chantier |
| Retours et garanties d'achats | Personne (Likely ; Charte non relue) | Nouveau, gain incertain ; sans le web, délai légal de 14 jours par défaut |

**Sa décision (QCM du 24/11/2026) : « Rien avant la comparaison ».** On termine le scénario des couches, la Veille
du matin reste en double, et rien d'autre n'est ajouté à Hermes avant la comparaison (à partir du 07/12/2026, à
sa demande). Ne repropose pas ces sujets d'ici là.

## Le coffre (sa question du 24/11/2026 : « c'est pas en clair j'espère »)

La première version de `portail-couches.sh` gardait l'adresse et le mot de passe en clair dans le dossier de JARVIS
(0600). Deux défauts : en clair, et lisible par le Claude des missions de JARVIS (même utilisateur, hors de la
liste des fichiers que son garde-fou lui interdit). Refait avant toute saisie :

- **Chiffré dès la saisie** par systemd (`systemd-creds encrypt`, AES-256-GCM) dans `/etc/jarvis-portail/couches.cred`
  (root, 0600, dossier 0700). Le clair ne touche jamais le disque. La clé est celle de la machine
  (`/var/lib/systemd/credential.secret`, root 0400), plus la puce TPM s'il y en a une.
- **Ouvert en mémoire pour un seul programme** : une copie root de la sonde (`/usr/local/lib/jarvis-portail/`, jamais un
  fichier du dépôt), lancée par `systemd-run` sous l'utilisateur `jarvis-portail` (sans shell), enfermée
  (`LoadCredentialEncrypted`, `ProtectSystem=strict`, `ProtectHome`, 3 minutes au plus).
- **Personne d'autre** : ni le serveur de JARVIS, ni son Claude, ni Hermes, ni Claude Code, ni la session du serveur
  ne lisent le coffre. Le geste « changer la date » sera un guichet de la même forme : JARVIS demande un geste
  d'une liste fermée, un programme root-enfermé l'exécute avec le coffre ouvert.
- **Limites** (dites à lui) : root sur le serveur peut déchiffrer ; une copie de tout le disque emporte la clé avec
  le coffre (pas de TPM sur le VPS, à confirmer par `--essai`) ; au moment de la connexion le mot de passe est en
  clair en mémoire, forcément. Un coffre externe (Bitwarden, 1Password) déplacerait le problème : il faut un jeton
  sur le serveur pour l'ouvrir ; son seul gain est de pouvoir le révoquer à distance. Conseil : un mot de passe
  propre à ce site.
- `--essai` vérifie le coffre sur une machine sans saisie ni vrai secret (pour la session « Serveur JARVIS ») ;
  `--retirer` efface tout. Banc : `sudo bash jarvis-os/server/tests/portail-coffre.test.sh` (10 vérifications).
  Non vérifiable au banc : le lancement par `systemd-run` (pas de systemd dans le conteneur) : c'est `--essai`
  sur le serveur qui le prouve.

## Le coffre en mémoire (ses réponses du 24/11/2026 : « sécuriser au maximum », il a NordPass)

Ses positions, par QCM :
- NordPass à chaque usage (Face ID) : bien pour les couches, **refusé comme règle** : une tâche où Hermes doit être
  autonome à 100 % serait bloquée.
- Coffre chiffré avec la clé de la machine (`systemd-creds`) : **refusé** : « quiconque a accès au disque peut tout
  faire ».
- Retenu : **un coffre dont la clé n'est jamais sur le disque, seulement en mémoire, pour tout** (mots de passe de
  sites et accès Google de JARVIS). Il le déverrouille une fois après chaque redémarrage du serveur ; ensuite tout
  est autonome. Il accepte le prix : après un redémarrage, JARVIS n'a plus Google et Hermes attend, jusqu'au
  déverrouillage.

Faits vérifiés le 24/11/2026 :
- (Likely, aide de NordPass) NordPass a une ligne de commande (`np signin` par le navigateur, `np unlock` avec le mot
  de passe maître, verrouillage après 15 minutes) ; aucun jeton de service ni accès limité à un élément trouvé :
  la mettre sur le serveur exposerait tout son coffre NordPass. **NordPass reste sur son iPhone** : il y garde la
  phrase du coffre du serveur. Un élément NordPass accepte plusieurs adresses (certain).
- (certain) Le VPS n'a pas de puce TPM ; l'accès Google de JARVIS est aujourd'hui en clair dans `state.json` (0600).

Montage à construire (`jarvis-coffre`) :
1. Un service à part (utilisateur dédié, code à root, enfermé, sans échange ni image mémoire). Sur le disque :
   la clé du coffre enveloppée par une clé dérivée de sa phrase (scrypt), et chaque secret chiffré (AES-256-GCM).
   En mémoire, après déverrouillage seulement : la clé.
2. **Déverrouillage après un redémarrage** : JARVIS le prévient par une notification (sa clé de notification reste
   lisible au démarrage) ; il lance `sudo jarvis-coffre ouvrir` dans Termius et colle la phrase gardée dans
   NordPass. La phrase ne passe ni par JARVIS, ni par Hermes, ni par une conversation. `fermer` reverrouille tout.
3. Deux portées de secret : « service » (l'accès Google : rendu au serveur de JARVIS, qui le garde en mémoire et ne
   l'écrit plus dans `state.json`) et « guichet » (mots de passe de sites : jamais rendus ; seuls des gestes d'une
   liste fermée, à root, s'en servent, comme « décaler la livraison des couches »).
4. Après la bascule de l'accès Google : lui faire refaire « Reconnecter » (et changer le secret du client Google),
   pour que l'ancien jeton, resté une semaine en clair sur le disque, ne vaille plus rien.
5. Redémarrages : vérifier que les mises à jour automatiques ne redémarrent pas le serveur seules.
Limite qui reste, dite à lui : quelqu'un qui prend la main en root sur le serveur allumé peut lire la mémoire.

En attendant : `portail-couches.sh` ne garde **plus rien** par défaut (identifiants passés par un tube au programme
enfermé, ni disque, ni échange, ni image mémoire) ; `--garder` (coffre de systemd) reste pour mémoire. Banc :
`sudo bash jarvis-os/server/tests/portail-coffre.test.sh` (13 vérifications).
- 24/11/2026 : **`jarvis-coffre` écrit** (`jarvis-os/coffre/` : service `coffre.mjs`, commande `jarvis-coffre`, unité, `install.sh`,
  `README.md`). Sur le disque : la clé enveloppée par scrypt (N=2^17) et chaque secret en AES-256-GCM lié à son
  nom et à sa portée ; en mémoire après `ouvrir` seulement. Deux prises : `admin.sock` (root : créer, ouvrir,
  fermer, mettre, retirer, changer la phrase) et `service.sock` (groupe `jarvis-coffre-clients`, où `install.sh`
  met `jarvis` : état, lire un secret « service », écrire un secret `jarvis-…`, fermer). Un secret « guichet »
  n'est rendu par aucune commande. Bancs relancés par Claude : 75 et 30, tout passe ; `install.sh` passé au banc
  (sans systemd). **Non vérifié** : l'unité sous un vrai systemd (seulement `systemd-analyze`). Pas encore
  branché : l'accès Google de JARVIS (prochaine étape : `google.mjs` lit et écrit ses jetons dans le coffre,
  JARVIS notifie « coffre verrouillé », puis « Reconnecter ») ; le geste des couches par le guichet.

## La passkey, le verrou de l'app et l'arrêt d'urgence (ses réponses du 24/11/2026, QCM)

Son idée : lier le coffre à son iPhone par une passkey (Face ID), sans qu'un iPhone volé donne tout.

| Question | Son choix |
|---|---|
| Clés du coffre | **iPhone (passkey, Face ID) pour tous les jours + phrase de secours** gardée dans NordPass (iPhone perdu, adresse du serveur changée : une passkey est liée à une adresse) |
| Durée d'ouverture | **Jusqu'au redémarrage**, à condition que **Claude garde la main** : sur sa demande, tout invalider et tout déconnecter, JARVIS devient « une coquille vide » |
| App JARVIS | **Face ID à chaque ouverture** (même passkey) : un iPhone volé déjà déverrouillé n'ouvre plus JARVIS |

Ce qui est possible et ce qui ne l'est pas (dit à lui) :
- La passkey ne sert de clé que si elle rend un secret (extension « prf » de WebAuthn) : (Likely) oui sur iOS 18.4 et
  plus avec une passkey gardée par Mots de passe d'Apple ; incertain avec un autre gestionnaire (NordPass) et dans
  une app de l'écran d'accueil. **À prouver sur son iPhone** : page `https://<serveur>/maquettes/passkey/`
  (`essais/passkey-essai/`, tout dans la page, rien d'envoyé ni de gardé ; essayée au banc avec une clé simulée).
  Repli si « prf » manque : la phrase remplie par le gestionnaire de mots de passe (Face ID) dans un champ de JARVIS.
- « Au lieu de la mémoire, sur l'iPhone » : non. Un secret utilisable sans lui vit forcément dans la mémoire du
  serveur ; l'iPhone ne peut pas répondre en arrière-plan. L'iPhone est la clé, pas le coffre.
- iPhone volé : la passkey exige Face ID ; avec « Protection en cas de vol de l'appareil » (Réglages, Face ID et code),
  plus de repli sur le code de l'iPhone (certain, aide d'Apple ; réglage « Toujours » pour que ce soit vrai aussi chez lui).

À construire, dans l'ordre :
1. Deux emplacements de clé dans `jarvis-coffre` : la phrase (fait) et la passkey. Le secret de la passkey est scellé
   dans la page pour le coffre seul (JARVIS ne fait que passer le paquet) ; l'ajout d'une passkey exige le coffre
   ouvert et un code affiché dans Termius.
2. **Arrêt d'urgence** `jarvis-urgence` (root ; lançable par la session « Serveur JARVIS » sur demande à Claude, par un
   bouton de JARVIS, ou dans Termius) : niveau 1 « verrouiller » (coffre fermé, JARVIS relancé pour vider sa
   mémoire, Hermes arrêté) ; niveau 2 « coquille vide » (en plus : tous les appareils et toutes les sessions de l'app
   retirés, tous les jetons MCP révoqués, Claude Code déconnecté pour JARVIS et pour Hermes). Limite dite : Claude
   n'agit que si la session du serveur répond et qu'il valide la commande depuis un appareil de confiance ;
   sinon Termius ou la console de l'hébergeur. À faire par lui en plus, côté Google : retirer l'accès de JARVIS dans
   son compte.
3. Verrou de l'app : une session par ouverture, ouverte par la passkey.
4. Puis seulement : l'accès Google de JARVIS dans le coffre, « Reconnecter », le geste des couches.
- 24/11/2026, son essai sur l'iPhone (passkey gardée dans **NordPass**, page ouverte dans un navigateur) : passkey
  créée, Face ID réussi, **aucune clé rendue** (pas de « prf » avec NordPass). Son choix (QCM) : **tout dans
  NordPass**. Donc : la passkey de NordPass ouvre l'app JARVIS à chaque fois (simple preuve d'identité, vérifiée par
  le serveur) ; le coffre s'ouvre, après un redémarrage, par la **phrase que NordPass remplit dans JARVIS** (Face
  ID), scellée dans la page pour le coffre seul ; Termius reste le secours. La page d'essai gagne un point 4
  (remplissage d'un mot de passe, à essayer aussi depuis l'écran d'accueil).

Fait dans le dépôt le 24/11/2026 (pas encore sur le serveur : le coffre n'y est pas installé) :
- **Ouverture scellée** (`jarvis-os/coffre/coffre.mjs`, `sceller.mjs` pour la page) : `cle-ouverture` rend une clé
  publique (neuve à chaque lancement du service) et un défi à usage unique de 2 minutes ; la page scelle la phrase
  avec (ECDH P-256, HKDF, AES-256-GCM, clair complété à 256 octets) ; `ouvrir-scelle`, sur la prise de service
  seulement, passe par la même ouverture et le même frein que Termius. Toute erreur rend la même réponse.
  **Limite, à lui dire telle quelle** : la page et la clé arrivent par le serveur de JARVIS ; s'il est activement
  compromis (autre page, autre clé), il lit la phrase. Le sceau protège du relais passif (journaux, mémoire, Caddy).
  L'utilisateur `jarvis` peut aussi faire échouer une ouverture (frein partagé) : Termius reste alors le secours.
- **Arrêt d'urgence** `jarvis-os/server/install/urgence.sh` (`installer` en pose la copie root
  `/usr/local/sbin/jarvis-urgence`) : `etat` (lecture seule), `verrouiller` (coffre fermé, JARVIS relancé, Hermes
  arrêté sans que la garde du forfait le relance), `coquille [--oui]` (en plus : Hermes retiré du démarrage ;
  `node server.mjs urgence --vider` retire appareils, abonnements aux notifications, clé du Raccourci, code
  d'appairage, clients et jetons MCP, **le jeton Google gardé par le serveur** (l'identifiant et le secret du client
  restent, pour « Reconnecter ») et **les invitations**, puis relit l'état sur le disque et le recompte, 0 attendu ;
  Claude Code déconnecté pour `jarvis` et `hermes` ; `/etc/hermes/jarvis.env` effacé ; JARVIS relancé, vide).
  Reste à sa main, dit par le script : retirer l'accès de JARVIS dans son compte Google (une copie du jeton prise
  avant resterait valable), révoquer le jeton Telegram chez @BotFather, changer la phrase du coffre si elle a pu être
  vue, la clé de la voix Google (synthèse vocale seulement) si le disque a pu être lu.
  Non essayé hors banc : vrai systemd, `runuser`, sortie réelle de `claude auth logout`.
- **Carte « Coffre » de JARVIS (0.74.0)** : état, ouverture par la phrase que NordPass remplit (scellée dans la page,
  le serveur ne fait que passer le paquet), « Verrouiller » ; absente tant que le coffre n'est pas installé. Routes
  `/api/coffre…` réservées à un appareil relié. Banc : `node jarvis-os/server/tests/coffre-app.test.mjs` (20).
  Non essayé : Safari, l'app de l'écran d'accueil, NordPass (son essai du point 4).
- **Verrou de l'app par passkey (0.75.0, son choix du 24/11/2026 au QCM)** : carte « Verrou de l'app » de Réglages ;
  l'activation est l'essai (passkey créée puis prouvée dans l'app, sinon rien ne change) ; verrou actif, chaque
  appareil relié prouve la passkey (Face ID) à chaque lancement de l'app et après 5 minutes sans usage ; l'ouverture
  est gardée par le serveur, en mémoire. Secours sans passkey : `node server.mjs verrou --retirer`, service arrêté.
  Hors du verrou : Raccourci Siri, invitations, assistants MCP. Banc : `node jarvis-os/server/tests/verrou.test.mjs`
  (41). **Activé par lui le 24/11/2026 sur son iPhone : la passkey NordPass marche dans l'app de l'écran d'accueil.**
  0.76.0, son retour : Face ID part tout seul (bouton en secours), reverrouillage au retour après une absence (1 min par
  défaut, réglable ; avant : 5 min sans demande). 0.77.0 : écran d'accueil pendant Face ID. 0.78.0, son retour (« 5 min, c'est
  trop court ») : délais jusqu'à 4 h, et **le délai d'absence devient la seule règle** (l'app relancée dans le délai ne
  redemande rien), ce qui remplace « Face ID à chaque ouverture ». La feuille « Use Passkey » est
  celle d'iOS : une app web ne peut pas l'enlever (à vérifier par lui : « Exiger Face ID » d'iOS sur l'icône). La page d'essai `/maquettes/passkey/` est retirée (0.79.0) : elle ne servait plus
  (son essai du 24/11 à midi, dans Chrome : toujours aucune clé « prf » ; le point 4 n'a pas été fait).
- Reste à construire : le bouton d'arrêt d'urgence, la notification « coffre verrouillé » après un redémarrage,
  l'accès Google dans le coffre ; et, pour les couches, la question à boutons (ne dépend pas de lui) puis le geste
  (après sa sonde).

## Remplacement complet : le setup étudié (sa demande du 24/11/2026 au soir)

Sa demande : « le setup parfait » pour qu'Hermes remplace Grok Bot en entier, toutes routines comprises, pour moins
cher que l'abonnement Grok Bot, avec son propre VPS, une mémoire, les skills et outils nécessaires ; le modèle peut
rester Claude Max. **Étude seulement : rien n'est commandé, installé ni changé.** Version pour lui : Google Doc
« Hermes à la place de Grok Bot : le setup complet (24-11-2026) », dossier `Grok Bot/`
(`1hUzesa57kJAM2hulrO0QBBHEPxerMTGzy1CvwRZDka0`). Deux de ses décisions du 23 et du 24/11 seraient renversées
(« Chronos reste chez Grok Bot », « rien avant la comparaison ») : elles ne changent que sur son accord, par QCM.

Faits vérifiés le 24/11/2026 (pages officielles, relus par deux recherches) :
- (certain) Hermes **0.23.4** (24/11, 1 122 commits depuis la 0.23.3, pas de section « breaking »). Le kit reste figé en 0.23.3.
- (certain) **Écran du bot** (« Bot Screen », `user-guide/features/bot-screen`) : par profil, un bureau Xvnc et Xfce
  avec un Chromium au profil permanent, vu par noVNC (page web d'Hermes, en HTTPS ou par tunnel) ; « Take over » pour
  la connexion, le 2FA ou un CAPTCHA, puis « Hand back » : le bot garde la session. Exige Computer Use ; 1,1 à 1,5 Go
  par écran, « 8 Go confortable ». Les profils sous le même utilisateur Linux partagent tout (doc) : un utilisateur
  par profil. C'est la pièce qui manquait pour les portails de Chronos, sans mot de passe gardé sur le serveur.
- (certain) **Webhooks** : `POST :8644/webhooks/<route>`, secret obligatoire (HMAC), par route `prompt`, `script`
  (peut taire l'événement), `skills`, `toolsets`, `deliver`, `cron_job`. Rien de natif pour Gmail ou l'agenda Google.
- (certain) **Planificateur** : modèle, outils et skills par tâche ; `--no-agent --script` (sans IA) ; script de
  pré-contrôle dont la dernière ligne `{"wakeAgent": false}` évite l'appel au modèle ; un rattrapage après un arrêt.
- (certain) **Mémoire** : un seul fournisseur externe actif ; Holographic est local (SQLite et FTS5), sans service
  ni clé ; Honcho, Mem0, Hindsight demandent une base, une clé ou un embedder.
- (certain) **Secours de modèle** (`fallback_providers`) : sur 429, 5xx, 401/403, 404 ; une tâche épinglée sur un
  modèle n'en change jamais ; **un refus pour limite de forfait du plugin Claude ne déclenche pas le secours**.
- (certain) **Crédits d'API inclus dans Max** : 100 $ par mois, clé d'une organisation Console liée, sans report ;
  épuisés, les requêtes s'arrêtent, rien n'est facturé ; à réclamer après 7 jours d'abonnement. Voie « préférée »
  d'Anthropic pour un outil tiers. Prix : Sonnet 5.5 2 $ / 10 $ (cache lu 0,10 $), Haiku 5.5 0,10 $ / 0,50 $.
- (certain) **OVH VPS-2** (gamme « VPS 2027 » : 4 cœurs, 8 Go, 75 Go, sauvegarde quotidienne) : 8,65 € TTC par mois
  sur 12 mois, 10,19 € sans engagement. Hetzner : commandes fermées (« currently unavailable »).
- (certain) Toujours pas d'app iPhone officielle d'Hermes ; fils (« topics ») dans une discussion privée Telegram.

Montage proposé (détail dans le Google Doc) :
- **Serveur à part** (VPS-2), relié à JARVIS par un réseau privé ; Hermes toujours sans jeton Google.
- **Trois profils par droits, pas sept bots** : Secrétaire (Iris, Argus, Canal : mails et Pilotage, ni web ni
  navigateur), Veilleur (Athéna, Ulysse, Kairos, Plutus : web, jamais les mails), Portails (Chronos : navigateur
  limité aux portails, écran du bot). Un utilisateur Linux et des règles réseau par profil ; les noms des bots restent
  comme rôles (signature dans Pilotage, fils Telegram).
- **Capteurs sans IA dans JARVIS** : arrivée d'un mail (relevé de Gmail, onglet Expéditeurs) et ligne du Canal, qui
  réveillent Hermes par webhook (plus d'alias, plus de filtres Gmail à la main, plus de sonnettes par mail) ;
  supervision par scripts ; sentinelle extérieure par routine.
- **Modèle** : routines sur les crédits d'API (Sonnet ; Haiku pour le tri à l'arrivée), discussion sur le forfait par
  le plugin. (guessing) 25 à 45 $ de crédits par mois, à mesurer.
- **Mémoire** : Pilotage pour les faits, mémoire intégrée par profil, Holographic pour le long terme.
- 25 routines de Grok Bot deviennent 16 routines d'Hermes (4 par webhook) et 3 capteurs ; supprimées : Semaine à
  venir (non lue), la note de frais de l'abonnement Grok, les six sonnettes ; Supervision en scripts.
- **Coût** : 8,65 à 10,19 € par mois en plus de l'existant. Seul risque sur le budget : un portail qui refuse un
  navigateur venu d'un serveur (guessing) ; parade gratuite, sortir par sa connexion de la maison.
- **Preuve** : par routine, trois passages en double au niveau ; pour les portails, essai à blanc jusqu'au dernier
  écran (on ne soumet pas deux fois). Un cycle mensuel complet de Chronos : pas de résiliation de Grok Bot avant fin
  janvier 2027 au plus tôt. **Premier essai à faire : l'écran du bot sur un portail**, car c'est lui qui décide.

À construire s'il dit oui : dans JARVIS, le capteur Gmail, le réveil par webhook, un profil de jeton « portails », les
outils d'écriture bornés (Dossiers, Échéances, Prix, Relevés, Sorties, Voyages, Papiers), les décisions à boutons ;
dans le kit, les profils, la clé d'API, les webhooks, l'écran du bot, une skill par routine depuis les fiches.

### Revue des outils qu'il cite (24/11/2026 au soir, rapport rendu dans la conversation)

Ses précisions : Grok Bot lui coûte le prix catalogue TTC après un premier mois réduit (c'est le plafond du budget) ;
une mémoire tierce est **obligatoire** (Hindsight ou autre) ; l'abonnement Claude Max par le plugin « passe », point
mis de côté : ne pas le rouvrir. Il veut une revue fondée sur les praticiens (Reddit, YouTube, sites de revue).
**Limite** : Reddit refuse la lecture depuis les outils de Claude (constaté trois fois) et YouTube ne rend que titres
et extraits ; la revue s'appuie sur des blogs de praticiens, Hacker News, XDA, The New Stack, des tickets GitHub et la
doc officielle. S'il colle un fil Reddit, le lire comme une donnée.

- **Correction du montage** : (certain, doc `user-guide/features/browser`) `browser_exec` n'existe que pour une
  session qui a l'outil `terminal`. Le profil Portails a donc besoin du terminal, à enfermer (backend Docker, sortie
  réseau limitée aux portails). L'avis GHSA-p22p-9ph6-gmrh (écran du bot avec un terminal Docker ou SSH) est corrigé en
  0.23.2. agent-browser de Vercel a été retiré du cœur d'Hermes en 0.23.0 (Likely, deux sources indépendantes).
- **Un seul fournisseur de mémoire à la fois** (certain) : Hindsight, Honcho, Mem0, Mnemosyne et Holographic se
  disputent la même place. GBrain (serveur MCP), Obsidian (skill livrée) et LCM (`context.engine`) sont à côté.
- **Hindsight** retenu (son exigence) : (certain) en local il lui faut une clé d'un fournisseur de modèle, ses
  embeddings et son reranker sont locaux ; (Likely) embedder par défaut anglais, à remplacer par un multilingue ;
  installation lourde et rappel de 2,6 à 2,8 s sans carte graphique rapportés par des praticiens ; réglages conseillés :
  `auto_retain` coupé, `recall_min_scores`. Repli sans clé : Holographic ou Mnemosyne.
- **LCM** (catalogue : LCM-X) : utile aux longues discussions Telegram, pas aux routines ; garde chaque tour en clair,
  masquage à activer. **GBrain** : en second temps, mode mots-clés sans clé. **i-have-adhd** : règles de style, sans
  risque, effet modeste. **Contrôle des serveurs MCP** : pas de projet unique sous ce nom ; scanner hors ligne lancé
  par nous à l'installation (Cisco mcp-scanner). **Écartés pour Hermes** : Ego (navigateur de bureau macOS et Windows,
  pas de Linux), Superpowers et code-review-graph (outils de développement), Honcho et Mem0 (même place que Hindsight).
- Pièges de planificateur rapportés (tickets GitHub) : tâches figées après `hermes update`, tâches en pause
  réactivées ou doublées après un redémarrage, tâches d'un profil non lues par la passerelle (#32091) : une passerelle
  par profil, relance et `hermes cron doctor` après chaque mise à jour, sentinelle extérieure.

### Verdict demandé et autres remplaçants (24/11/2026, tard ; rendu dans la conversation)

Sa demande : un verdict net (faisable ou non, budget, ce qui rapproche du résultat, si cela vaut le coup) et, si ce
n'est pas Hermes, qui d'autre, « Nod » compris. Réponse donnée :
- **Faisable** : oui pour tout sauf Chronos (Likely) ; Chronos non prouvé tant qu'un portail n'a pas été essayé avec
  l'écran du bot (guessing). **Aucun agent du marché ne traite bien trois portails avec 2FA** : tous demandent une
  reconnexion par lui.
- **Budget** : 10 à 13 € par mois (serveur, plus quelques euros pour la mémoire) contre le prix de Grok Bot.
- **Ce qui compte, dans l'ordre** : l'essai d'un portail ; le capteur de mails de JARVIS ; les outils d'écriture bornés
  de JARVIS ; une skill par routine et la comparaison en double ; la sentinelle. Le reste de sa liste d'outils pèse peu.
- **Nod** (n8n Labs, sorti le 10/11/2026, Apache 2.0, version 0.9.6 le 24/11) : pas maintenant. (certain, sa doc)
  aperçu de recherche, une version par jour ; serveur Linux possible (Docker, 8 Go) ; Claude par clé d'API seulement ;
  Gmail relevé toutes les 15 minutes, pas de webhook entrant ; Google passe par Composio et un service de n8n, qui
  peuvent lire le contenu ; reprise de main du navigateur seulement dans son client web, pas depuis Telegram ; coffre
  avec codes TOTP et codes reçus par mail ; en routine, une action que son contrôle ne sait pas juger n'est pas faite
  et il ne demande pas. Aucun retour d'usage long. À revoir dans deux ou trois mois.
- **Autres** (Likely, pages officielles lues par une recherche) : tâches planifiées de Claude (comprises dans Max,
  intervalle d'une heure au moins, déclencheur par API, pas de déclencheur mail, pas de portail depuis un iPhone) :
  le meilleur second pour les routines à heure fixe ; ChatGPT Plus : déclencheur Gmail natif et navigateur en ligne avec
  reprise de main depuis le téléphone, mais 5 tâches actives ; OpenClaw : déclencheur Gmail natif, passif de sécurité ;
  Gemini : pas de déclencheur, agent exclu de l'Europe ; n8n classique : bonne colle, pas un assistant ; Poke, Manus,
  Lindy : crédits trop justes ; Perplexity, Zapier Agents : hors budget.

### Essai des portails (24/11/2026, nuit)

Sa demande : « essai portail sur notre Hermes actuel ». Ses choix (QCM) : le portail des notes de frais d'abord
(mot de passe seul) ; l'identifiant gardé dans le coffre d'Hermes, comme chez Grok Bot (sa correction : chez Grok
l'identifiant ne se retape pas) ; la clé de ce coffre en mémoire seulement. Tout est dans `docs/hermes-portail.md` :
un second Hermes à part (`hermes-portail`), relais filtrant, clé en ramfs gardée par jarvis-coffre. Banc 55 sur 55.
Reste : l'installer sur le serveur, ses trois saisies dans Termius, puis le premier essai réel.
