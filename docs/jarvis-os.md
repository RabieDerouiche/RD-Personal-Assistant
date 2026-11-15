# JARVIS OS (projet du 15/11/2026)

Le propriétaire veut un « Personal Agentic OS » piloté depuis son iPhone : parler à la voix à un chef d'équipe, déléguer à Claude et à Grok Bot, suivre les missions, approuver. Brief complet : collé par lui dans la conversation du 15/11/2026 (rédigé avec ChatGPT). Contraintes : **aucun frais d'API IA** (abonnements Claude et Grok seulement), rien de contraire aux conditions des fournisseurs, iPhone d'abord, Mac jamais nécessaire au fonctionnement, hébergement gratuit de préférence (payant raisonnable possible, pas seulement Blitz).

**Phase 1 (audit de faisabilité) : faite le 15/11/2026.** Rapport dans Drive, dossier `RD Assistant/Jarvis (sources de la page)`, Google Doc « JARVIS OS — Phase 1 : audit de faisabilité » (`1PPkgM_N759aTAwX5hYu4vY408KNqY_mR7uFhJPznRkI`). À relire avant toute suite.

Conclusions à retenir :
- Aucun des deux fournisseurs ne laisse une application tierce utiliser l'abonnement pour une conversation en temps réel. Les mécanismes officiels sans frais : Claude dans une page claude.ai (`sample`) ; déclencheur d'API d'une tâche Claude Code (`POST /v1/claude_code/routines/{id}/fire`, jeton par tâche créé dans l'interface web, payé par l'abonnement, pas d'API pour lire le résultat) ; appel vocal en direct avec un bot Grok Bot (bouton Action, Siri) ; webhook de routine Grok Bot (POST, `Authorization: Bearer`).
- `claude -p` (programme Claude Code non modifié, abonnement du propriétaire) sur un serveur personnel : probablement admis par la page juridique, pas écrit noir sur blanc.
- Le micro est refusé aux pages dans l'app Claude sur iPhone (essai du 15/11). Safari : `webkitSpeechRecognition` existe, écoute continue et mode écran d'accueil à tester.
- L'app OpenClaw sur Blitz n'est plus en ligne (constaté le 15/11/2026). Blitz gratuit : les webhooks ne réveillent pas une app endormie. Options d'hébergement évaluées : Cloudflare Workers + Pages + D1 (gratuit, toujours éveillé, pas de `claude -p`), Oracle Always Free (2 cœurs, 12 Go depuis le 15/06/2026), Blitz Pro (7 € par mois TTC), petit VPS.
- Architecture recommandée pour la v1 (0 € de plus) : bot Grok « Jarvis » pour la voix ; missions Grok vers Claude par le déclencheur d'API, Claude vers Grok par webhook ; page Jarvis pour l'écran ; Pilotage (onglet Missions à créer) pour la mémoire. PWA à soi en option, plus tard.

Décisions du propriétaire (QCM du 15/11/2026) :
- **Chef vocal : un nouveau bot Grok « Jarvis »**, chef d'orchestre (Iris garde courrier et dossiers).
- **Hébergement de la future PWA : Cloudflare s'il suffit, sinon un VPS.**
- Architecture v1 : pas encore choisie ; options réexpliquées en détail (v1 sans frais, PWA tout de suite, ou les deux avec une page d'essai de la voix dans Safari).

- 15/11/2026, sa question : « la conversation en continu est-elle possible sur la PWA au premier plan ? Si oui, on tient notre gagnant » (une app à lui, Siri et Raccourcis plus tard). Réponse : à prouver sur son iPhone ; et il faudra un cerveau (`claude -p` sur un serveur, Oracle gratuit ou VPS). Il a choisi un essai publié sur **Cloudflare** : page `essais/voix-pwa/` (écoute, répète, réécoute ; aucune donnée), testée au banc (8 comportements de l'iPhone simulés). Le déploiement Cloudflare (Worker relié au dépôt) a échoué sur « Connection blocked » ; il a choisi **GitHub Pages** à la place (branche `main`, racine ; `.nojekyll` ajouté). Adresse de l'essai : `https://rabiederouiche.github.io/RD-Personal-Assistant/essais/voix-pwa/`.

Suite : son rapport d'essai (Safari, puis écran d'accueil). Si réussi des deux côtés : PWA JARVIS avec cerveau `claude -p` ; sinon, appel vocal Grok avec le bot Jarvis (essai après la remise à zéro du mardi 17/11 à 12h).
