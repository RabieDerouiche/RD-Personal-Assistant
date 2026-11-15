# Banc d'essai de la page Jarvis

Faux connecteurs (Pilotage, Agenda, Gmail, Claude en direct) et scénarios Playwright. Données fictives seulement.

La page n'est pas dans le dépôt : récupère-la avec l'outil `Artifact` (action `read`), puis passe le chemin du fichier.

```
NODE_PATH=/opt/node-tools/node_modules node essais/jarvis/t1_smoke.js <page.html>   # chaque onglet s'ouvre, aucune erreur
NODE_PATH=/opt/node-tools/node_modules node essais/jarvis/t3_flows.js <page.html>   # toutes les écritures, pause de Grok, sonnettes
NODE_PATH=/opt/node-tools/node_modules node essais/jarvis/t4_checks.js <page.html>  # textes, journal, verdicts, réponse d'un bot
```

- `mock.js` : le faux `window.claude` ; scénarios par `window.__SCEN` (`active`, `bells`, `pauseUntil`, `offline`, `fail`, `noDescribe`, `noSample`, `noNegative`, `tasks` : les tâches Claude que le compte possède, `pending` : nombre d'ordres en attente à ajouter, `tts` et `synth` : fausses voix de Claude et du téléphone, `voices: 'base'` : le téléphone n'a que la voix de base, `ear` (`'ok'`, `'refuse'`) : micro du téléphone, `dict` : dictée de Claude ; les phrases « dites » se poussent dans `window.__say`). `COV=<dossier>` devant la commande enregistre le code qui a tourné.
- `lib.js` : ouverture de la page (iPhone 390 px, horloge simulée), clics, lecture des écritures faites par la page.
- Les essais lisent ce que la page écrit ; rien ne part vers les vrais comptes.
