# Suite du chantier 0.96.0 (administrer les routines d'Hermes) : ce qu'il verra, bancs, ce qui n'est pas testé, risques

## 3. Ce qu'il verra, écran par écran

1. **Espaces › Hermes et ses routines** (ou Équipe) : la liste des six routines, comme avant, mais chaque ligne se touche. Une pastille
   à côté du nom quand elle n'est pas simplement active : « En pause », « En erreur », « En cours », « Ordre en route »,
   « Lancement demandé ». Un horaire changé est dit « (horaire modifié) ». Sur la carte d'Hermes : **« Tout mettre en pause »** et
   **« Tout reprendre »** (un appui, puis « Confirmer : 5 routines » ; un message dit combien d'ordres sont partis et lesquels ont été
   refusés).
2. **Toucher une routine : sa feuille** (elle monte du bas).
   - En tête : « Routine d'Hermes », son nom, puis son état en clair avec une pastille de couleur : « Active », « En pause depuis
     aujourd'hui à 10:02, depuis JARVIS — jusqu'à nouvel ordre », « En erreur au dernier passage : limite du forfait », « Un passage est
     en cours », « Pas posée chez Hermes ».
   - Un cadre : **Quand** (« Du lundi au vendredi à 7 h 40 », avec « horaire modifié ; à l'origine : … » s'il l'a changé), **Mode**
     (en réel, ou en double), **Dernier** passage et son résultat, **Prochain** passage. Pour le réveil : « Se lance aussi sur un
     événement : un courrier qui arrive, une ligne du Canal. »
   - **Les gestes** : « Lancer maintenant » → le bouton devient « Confirmer : lancer maintenant » + « Annuler » → « Demandé à 14 h 02 —
     en attente du serveur… » → « Demandé à 14 h 02 — en cours… » → « Lancée à 14 h 02, terminée à 14 h 06 : réussie. » (ou « en erreur
     (réseau). »). À la fin, une **notification** arrive aussi (« Hermes : « Veille du matin » terminée »), qui rouvre la feuille.
     « Mettre en pause » → « Confirmer la pause, jusqu'à nouvel ordre » → « En pause depuis 14 h 02, jusqu'à nouvel ordre. » ; le
     bouton devient « Reprendre » (un seul appui). Quand un geste n'est pas possible, le bouton est grisé et une ligne dit pourquoi
     (« « Lancer maintenant » : la routine est en pause : reprends-la d'abord. », « … déjà lancée il y a moins de 5 minutes : possible à
     14 h 07. », « … Hermes est arrêté. »). Un refus du serveur est écrit en ambre (« Refusé à 14 h 02 : la limite du forfait Claude est
     atteinte : reprise vers 17 h 40, elle repartira seule. »).
   - **L'erreur en détail** (seulement si le dernier passage a échoué) : la cause, ce qu'il peut faire, puis le texte de l'erreur
     nettoyé, dans un cadre.
   - **Ce qu'elle a fait** : le compte rendu du dernier passage réel (celui que la routine donne à JARVIS à la fin), daté.
   - **Changer l'horaire** (replié) : « Tous les jours · Du lundi au vendredi · Jours choisis » (puis sept jours à cocher), une à
     quatre heures (heure et minutes par pas de 5, « + Ajouter un passage », « Retirer »), un **aperçu** (« Aperçu : chaque jour à
     7 h 40 et 7 h 55. »), « Demander ce changement » → « Confirmer : … » → « Horaire changé — pris en compte à 14 h 02 : … » et le
     prochain passage recalculé ; « Revenir à l'horaire d'origine » quand il est modifié. Si les heures ne tiennent pas dans un seul
     horaire (7 h 40 et 13 h 15), l'aperçu le dit et propose la règle (même minute, ou même heure).
   - **Historique** : « 28 passages · 93 % réussis · durée moyenne 3 min 40 », puis les passages du plus récent au plus ancien (date,
     résultat, durée, comment il a été lancé) ; toucher un passage montre son compte rendu ou son erreur.
3. **Équipe › Routines** : les cartes d'Hermes s'ouvrent de la même façon.
4. **Ce qu'il ne peut pas faire ici** (décisions à part) : passer une routine de « double » à « réel », changer sa consigne.

## 4. Bancs, avant et après

| Banc | Avant | Après |
|---|---|---|
| `bash essais/hermes/ordres.test.sh` (nouveau) | — | 117 OK |
| `bash essais/hermes/relance.test.sh` | 80 | 88 OK |
| `sudo bash essais/hermes/banc.sh --neuf` | 88 | 103 OK, 1 échec : « mémoire pendant une routine sous 550 Mo » (554 Mo) |
| `bash essais/hermes/routines-conf.test.sh` | 6 | 6 |
| `bash essais/hermes/garde.test.sh` | 25 | 25 OK |
| `node jarvis-os/server/tests/server.test.mjs` | 413 | 427 OK |
| `node jarvis-os/server/tests/hermes-admin.test.mjs` (nouveau) | — | 46 OK |
| `node jarvis-os/server/tests/verrou.test.mjs` | 44 | 45 OK |
| `node jarvis-os/server/tests/depot.test.mjs`, `limite.test.mjs` (voisins, inchangés) | 42, 14 | 42, 14 |
| Banc de l'app, `banc.cjs` | 403 OK, 3 échecs (date du jour) | 429 OK, 4 échecs (les 3 de la date du jour, et « notification de la page : croix « Fermer », fermée tout de suite ») |

`banc-serveur.mjs` n'a pas été lancé (consigne).

Les échecs, mot pour mot :
- Banc d'Hermes : « ✗ mémoire pendant une routine sous 550 Mo » (« mémoire d'Hermes pendant une routine : 554 Mo au plus »). Sans rapport
  avec ce chantier : le **même banc sur le kit d'avant** (commit `35f7d12`, lancé le même jour dans le même conteneur) échoue de la même
  façon, à 553 Mo (87 réussies, 1 en échec). La mesure est prise à la seconde pendant le lancement que le banc fait lui-même (392 à
  397 Mo au repos, plus la commande `hermes cron run`) ; deux des quatre passages du jour l'ont passée. Le bloc 0.96.0 du banc est placé
  après cette mesure. À voir à part : le seuil (la doc du 23/11 notait 360 Mo au repos et 500 au plus), ou ce qui a fait monter le repos.
- Banc de l'app : « plusieurs jours : l'événement est listé avec sa période et apparaît sur chacun de ses trois jours dans le mois »,
  « plusieurs jours : écrit dans l'agenda en journées entières, fin au lendemain du dernier jour (règle de Google), et relu sur ses trois
  jours », « agenda : le rendez-vous écrit aussi dans Échéances n'est listé qu'une fois dans le mois, avec le bot qui le suit » (les trois
  de la date du jour, connus), et « notification de la page : croix « Fermer », fermée tout de suite :: toast vu : true ». Ce dernier
  n'échouait pas dans la référence : rejoué seul deux fois de suite, il passe (page `?theme=holo#equipe`, où le bloc 0.96.0 ne fait
  rien : Grok n'y est pas arrêté). (probable) Une course de ce banc sous charge, pas un défaut du chantier.
- Premier passage du banc d'Hermes du jour : un vrai défaut trouvé et corrigé (`delivery_queued`, voir plus haut) ; un défaut du banc
  lui-même corrigé (une fonction du banc appelée dans un sous-shell).

## 5. Ce qui n'a pas pu être testé, et les risques

- **La pause dans le vrai Hermes** — (certain, banc sur Hermes v0.23.3 installé par `install.sh`) `hermes cron pause`, `resume` et
  `edit --schedule` font ce qui est attendu dans `jobs.json`, et la pause comme l'horaire survivent à `routines.sh` (routine inchangée
  et recréée). (probable) La passerelle en marche relit `jobs.json` à chaque tic : une pause posée par la commande est donc vue en une
  minute au plus ; le banc ne fait pas tourner l'horloge d'Hermes jusqu'à l'heure d'une routine en pause pour prouver qu'elle ne part pas.
  (deviné) Un passage **déjà en cours** au moment de la pause va à son terme.
- **`hermes cron run` sur le serveur** — (certain, code) deux chemins : confié à la passerelle (file d'attente, une minute au plus) ou
  fait sur place. (probable) Sur le serveur, résultat par Telegram et passerelle en marche : le premier. L'unité à part couvre les deux,
  mais seul le journal du premier « Lancer maintenant » réel le dira. (deviné) Si la passerelle met plus de 45 minutes à finir, l'ordre
  reste « en cours » puis passe à « sans suite » au bout d'une heure, alors que le passage peut réussir plus tard (il sera dans
  l'historique, « programmé » ou « à la main sur le serveur »).
- **Un point trouvé en lisant le code d'Hermes, hors de ce chantier** — (certain, code) quand `hermes cron run` fait le passage sur place
  au lieu de le confier à la passerelle, il dure le temps du passage. Or `hermes-reveil.service` a 60 secondes (`TimeoutStartSec`) et la
  relance après la limite 120 secondes pour cette commande. (probable) Sur le serveur le passage est confié à la passerelle, et ces délais
  n'ont jamais gêné (les six routines sont passées en réel le 26/11) ; à vérifier dans le journal du premier « Lancer maintenant » : s'il
  dit « Ran now », ces deux délais sont à allonger. Les ordres de JARVIS, eux, partent dans une unité à part d'une heure.
- **systemd** — non testable au banc (conteneur sans systemd) : `hermes-ordres.path` (`DirectoryNotEmpty`, limite de 30 départs par
  minute), `systemd-run` (vérifié par une fausse commande : nom d'unité, programme lancé), `NoNewPrivileges` avec `runuser`,
  `hermes-relance.service` (`ProtectSystem=full`) qui lance le suivi : il n'écrit que sous `/var/lib` et chez `hermes` (probable).
  D'où l'essai réel de la section 2.
- **Le dossier temporaire à côté** (`/var/lib/jarvis-reveil/ordres.tmp`, créé par JARVIS) : (probable) sa création ne déclenche pas
  `hermes-reveil.path` (qui surveille le seul fichier `sonnette`) ; l'essai réel le vérifie.
- **Qui peut poser un ordre** — tout ce qui tourne sous l'utilisateur `jarvis` peut écrire dans le dossier (comme pour la sonnette du
  réveil) : le serveur, mais aussi une mission de Claude lancée par JARVIS. Les routes sont réservées à un appareil relié et aucun outil
  MCP n'y mène, mais ce n'est pas une barrière du système. Portée d'un ordre forgé : lancer, mettre en pause, reprendre ou décaler une
  routine de la liste fermée, sous les plafonds. `hermes` ne peut ni lire ni écrire ce dossier.
- **Le nettoyage de l'erreur : ce qu'il peut laisser passer** — (certain) un secret court sans mot-clé ni préfixe (un mot de passe de dix
  lettres écrit en clair), un nom de personne, un nom d'hôte seul (celui d'un service appelé), un montant, un court texte cité (moins de
  60 caractères entre guillemets), un numéro de moins de 9 chiffres. Ce qui le borne : Hermes masque déjà ce qu'il écrit ; le détail
  n'est servi que par la feuille, sur un appareil relié et déverrouillé ; les routines d'Hermes ne connaissent ni le portail ni ses
  identifiants (hermes-portail est à part) ; le filtre « rien de bancaire » de JARVIS remplace le texte entier par « détail masqué ».
  (deviné) La forme réelle des erreurs du plugin de l'abonnement n'a pas été vue : le banc emploie des textes inventés.
- **Fuseau et changement d'heure** — (certain) l'expression est en heure de Paris (`timezone: "Europe/Paris"` de la politique) ; le banc
  vérifie que le prochain passage calculé par Hermes tombe à l'heure demandée, heure de Paris. (probable) Au passage à l'heure d'été ou
  d'hiver, c'est la bibliothèque de cron d'Hermes qui décide : un passage entre 2 h et 3 h peut sauter ou doubler ce jour-là (éviter
  cette heure). (certain) L'app affiche les heures dans le fuseau du téléphone : hors de France, « Prochain » et l'aperçu (heure de
  Paris) ne se liront pas dans le même fuseau.
- **Un horaire à plusieurs heures de minutes différentes** (7 h 40 et 13 h 15) est refusé : Hermes n'a qu'une expression par routine.
  Le lever demanderait deux routines pour une seule ligne : décision à part.
- **L'historique** — (probable) la fin d'un passage dans `jobs.json` et dans le registre d'Hermes diffèrent de moins de 30 secondes
  (sinon le passage apparaîtrait deux fois). (certain) Les passages d'avant la mise à jour n'ont de durée que s'ils sont encore dans le
  registre d'Hermes. (deviné) Un `routines.sh` qui recrée une routine change son identifiant chez Hermes : ses anciens passages restent
  dans l'historique de root, mais ne sont plus complétés par le registre.
- **Non fait** : « Voir sa ligne dans le Journal » (le Journal de Pilotage est tenu par bot, pas par routine : il aurait fallu deviner
  la ligne) ; un bouton « Arrêter le passage en cours » (Hermes a `cron cancel` : décision à part) ; le journal `README.md` du kit.
- **Version** : la constante `VERSION` et le cache du service worker ne sont pas montés : à faire à la fusion, sinon l'iPhone garde
  l'ancienne app.

