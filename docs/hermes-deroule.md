# Hermes, Grok Bot, Claude et JARVIS : le déroulé (depuis le 23/11/2026)

Sa demande du 23/11/2026 : mettre en place le déroulé idéal avec Hermes, lui donner des droits équivalents à
ceux de Grok Bot, commencer des routines pour alléger Grok Bot, relier Hermes à JARVIS, voir quelles skills
lui donner (et à Claude), le tout pilotable depuis JARVIS. Objectif à terme : remplacer Grok Bot, **seulement
si Hermes fait tout ce que Grok Bot fait, sans compromis sur la qualité ni sur les routines**.

Installation et garde-fous d'Hermes : `docs/hermes.md`. Système Grok Bot : `docs/systeme-grok-bot.md`.
Rien de personnel ici.

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
| Argus : Supervision (lun, mer, ven) | **Hermes, en double** | Phase 1, maintenant. Hermes voit en plus un Grok Bot en pause, qu'Argus ne peut pas signaler. |
| Iris : Semaine à venir (dim) | **Hermes, en double** | Phase 1, maintenant. |
| Iris : Veille du matin (lun-ven) | Hermes, en double puis bascule | Phase 2. Demande d'écrire dans Dossiers et Échéances : outils à ajouter à JARVIS, bornés à ces colonnes. |
| Athéna : Digest IA et .NET ; Ulysse : Sorties du week-end ; Kairos : Liste du mois, Prix suivis | Hermes avec le web, ou routines de JARVIS | Phase 3, son choix (QCM). Le web d'Hermes marche sans clé (services gratuits, limités) ; il exige un jeton à part, sans Gmail, pour qu'une page piégée ne puisse rien lire de privé. Les sites marchands et de crédit bloquent souvent la lecture automatique : Prix suivis en dernier. |
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
