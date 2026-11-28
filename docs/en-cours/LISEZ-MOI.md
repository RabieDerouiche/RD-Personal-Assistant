# Travail en cours : à reprendre, pas à refaire

Sa remarque du 26/11/2026 : « tu recommences à chaque session, fais les choses séquentiellement ». **Un chantier à la fois ; chaque chantier fini est fusionné et poussé avant le suivant.** Branche : `claude/grok-hermes-jarvis-reprise-i864jv`.

**Un seul « État » ici.** À chaque étape finie, il est **remplacé** (pas empilé : ce fichier se relit à chaque reprise) ; l'ancien part en tête de `docs/en-cours/archives.md` s'il dit comment quelque chose s'est passé. Les états du 26/11 au 28/11 à 15 h y sont.

## Méthode pour ne rien reperdre (sa demande du 27/11/2026)

- Chaque étape finie est commitée et poussée ; cette note est mise à jour dans le même commit.
- Un agent coupé par la limite n'est pas relancé pour finir un reste : la session principale finit à partir du travail sauvegardé (fusion, bancs, notes). Un agent neuf reçoit une consigne courte qui pointe ici.
- Bancs et rangement de la documentation : par script ou en arrière-plan, sans consommer le forfait.
- Pas de travail lourd dans l'heure qui précède ses routines (Veille 7 h 40, CRA de la semaine le vendredi à midi).
- À décider et risques du chantier F : `suite-mails.md` (dont la structure de `jours.json` pour le dépôt du CRA signé par Hermes).

## État au 28/11/2026, 17 h

**Sur le serveur** : JARVIS 0.104.0 (`6864a92`), déployée et vérifiée le 28/11 à 15 h 35 (compte rendu : `docs/jarvis-os.md`, « Déploiement du 28/11/2026 (0.104.0) »). Réglages fermés de Claude Code **allumés** (`jarvis.service.d/sources.conf`), plafond d'une mission à 5 $, connecteurs inchangés. À savoir : la fermeture n'empêche pas Claude Code de relire un `CLAUDE.md` posé dans un dossier de travail (seul le garde-fou de la 0.102.0 l'empêche d'en écrire un).

**Dans main, pas encore sur le serveur** :
- 0.105.0 : l'écran de connexion réagencé après sa capture du 28/11 (bloc au-dessus de la feuille pendant Face ID, au milieu sinon, marque en pied d'écran, fond vivant). App seulement : il la prend par « Mettre à jour ». **Attend son avis sur l'iPhone** (`docs/journal-jarvis.md`, dernière entrée : la valeur à régler s'il le trouve encore trop haut ou trop bas).

**Aucune demande au serveur en attente.** `/root/essai-14.out` attend son oui dans « Serveur JARVIS 2 ».

**Ce qu'il a tranché le 28/11** (QCM) : l'atome ; l'ambre gardé pour ce qui attend son oui ; le banc du portail d'abord ; puis, sur les nouveautés de Claude : alléger `CLAUDE.md` et les docs, fermer le mode sans écran, plafonner les missions, sortie typée, « vérifie qu'il n'y a pas d'impact négatif sur l'existant ».
- **Sortie typée (`--json-schema`) : pas posée.** Mesuré le 28/11 sur Claude Code 2.1.332 : 3 tours au lieu d'un et un coût multiplié par 4 pour une petite lecture. À ne reprendre que si une lecture JSON échoue vraiment souvent.
- **Allègement fait** : `CLAUDE.md` 35 → 24 Ko (le détail, mot pour mot, dans `docs/instructions-detail.md`) ; `docs/jarvis-os.md` 320 → 98 Ko (versions 0.10.0 à 0.87.0 dans `docs/jarvis-os-historique.md`) ; ce fichier 31 → 4 Ko.

**À surveiller** :
- lundi 30/11 à 9 h 10 : premier Digest IA et .NET sans la mémoire d'Hermes (outil `digest_deja_dit`) ;
- les trois routines du web affichent « jamais passée » depuis le déploiement de la 0.102.0 (recréées) : regarder leur feuille dans JARVIS ;
- décembre : premier dépôt du CRA signé par Hermes avec la skill réécrite (avec son oui) ;
- si la conversation de JARVIS refuse d'ouvrir un lien qu'elle vient de trouver : `garde-refus.log` (la transcription lue par le garde-fou s'écrit avec un léger retard).

**Pas commencé** : faire vérifier par le serveur, avant chaque lancement de Claude Code, qu'aucun `CLAUDE.md` ou `.claude/` étranger n'est apparu dans un dossier de travail (piste née du déploiement de la 0.104.0) ; les trois points non prouvés de la relecture de sécurité (liste blanche du relais du portail, ports locaux hauts, « retenir » à la voix), la relecture de Panier ; le comptage page par page des appuis ; son avis sur l'iPad (`/maquettes/ipad/`) ; bancs : un passage d'Hermes coûte encore 17 à 20 s, trois contrôles de l'app instables sous charge (`docs/jarvis-os-reprise.md`, « Les bancs »).
