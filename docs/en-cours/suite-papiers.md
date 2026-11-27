# Suite du chantier 0.91.0 (rangement des papiers) : ce qu'il doit faire, bancs, ce qui n'est pas testé, risques

## 3. Ce que le propriétaire doit faire

1. **Reconnecter Google une fois** (après la mise à jour du serveur). Dans JARVIS : Espaces, Réglages, carte Google, bouton « Reconnecter » (le bouton existe ; l'onglet de Réglages où se trouve la carte n'est pas vérifié). Sur l'écran de Google : passer l'avertissement « Google n'a pas validé cette application » comme les autres fois (libellés devinés : « Paramètres avancés », puis « Accéder à … »), puis **tout cocher**, dont la nouvelle ligne de Drive (libellé deviné : « Consulter, modifier, créer et supprimer tous vos fichiers Google Drive »). Sans cela, rien d'autre ne casse : le dépôt garde les fichiers et la validation répond « Reconnecte Google une fois ».
2. **Déposer** : Espaces, Papiers, filtre « Déposer », champ « Le fichier » (PDF ou photo, plusieurs possibles). La carte du fichier montre le dossier proposé et le nom : changer l'un ou l'autre si besoin, puis « Oui, ranger ici ». « Retirer » demande un second appui.
3. **Menu Partager de l'iPhone (facultatif)** : le Raccourci décrit dans l'écran, sous « Depuis le menu Partager de l'iPhone » (dupliquer son Raccourci « Jarvis », qui garde la clé ; « Afficher dans la feuille de partage » ; une seule action « Obtenir le contenu de l'URL » en POST vers l'adresse affichée, même en-tête Authorization, corps « Formulaire » avec un champ « fichier » de type Fichier = l'entrée du raccourci ; « Afficher le résultat »). Noms de menus devinés (ils changent selon la version d'iOS). S'il n'a plus de Raccourci « Jarvis » : Réglages, carte « Siri et bouton Action », qui donne une clé neuve (l'ancienne cesse de marcher).
4. Si l'écran montre encore « Le fichier va dans « À trier » » : l'app ou le serveur n'est pas à jour (fermer JARVIS et le rouvrir ; le service worker ne prend la relève qu'app à l'arrière-plan).

## 4. Bancs, avant et après

Chaque banc lancé une fois après la fusion de la branche du coordinateur (27/11/2026) ; « avant » = sa référence.

| Banc | Avant | Après |
|---|---|---|
| `depot.test.mjs` (nouveau) | — | 42 OK |
| `depot-app.test.mjs` (nouveau, Chromium) | — | 6 OK |
| `server.test.mjs` | 404 | 413 OK (9 nouvelles) |
| `pilotage-local.test.mjs` | 51 | 51 OK |
| `verrou.test.mjs` | 43 | 44 OK (1 nouvelle : le dépôt derrière le verrou, 423) |
| `fiab-b3.test.mjs` (pont et service worker hors navigateur) | 24 | 24 OK |
| `banc.cjs` (maquette) | 391 OK, 3 échecs liés à la date | 403 OK (12 nouvelles), les 3 mêmes échecs liés à la date |
| `banc-serveur.mjs` (bout en bout) | 136 | 136 OK |

Les 3 échecs de `banc.cjs`, mot pour mot (liés à la date du jour, présents aussi sur main, pas corrigés) : « plusieurs jours : l'événement est listé avec sa période et apparaît sur chacun de ses trois jours dans le mois », « plusieurs jours : écrit dans l'agenda en journées entières, fin au lendemain du dernier jour (règle de Google), et relu sur ses trois jours », « agenda : le rendez-vous écrit aussi dans Échéances n'est listé qu'une fois dans le mois, avec le bot qui le suit ».

Lancés le 26/11 avant la fusion, pas relancés depuis (leur zone n'a pas changé) : `fiab-b1` 13, `fiab-a4` 30, `fiab-a2` 32, `fiab-a1` 35, `fiab-a5` 24, `fiab-c` 12, `limite` 14, tous OK ; `fiab-a6` : 2 échecs sur 2, identiques sur le code d'avant ce chantier (« rappels du matin : une lecture ratée à 8 h 01 (Google 503)… », puis « exception :: TypeError: Cannot read properties of undefined (reading 'body') ») : sans rapport avec ce chantier, à regarder à part.

Vérifications existantes retouchées (trois, dites ici) : `banc.cjs`, la page « Grok arrêté » de la 0.87.0 (`#demandes`) est ouverte avec `depot: false` (serveur pas encore à jour), pour que sa vérification de la carte « À trier » reste vraie ; `server.test.mjs`, « local : la copie de la nuit… rien ne part dans Drive » ne compte plus les envois du dépôt faits plus haut dans le même banc ; `fake-google.mjs` garde le corps d'une requête en octets (même texte qu'avant).

`audit.cjs` (check-up écran par écran) n'a pas été lancé.

## 5. Pas testé, et risques

| Point | Certitude | Détail |
|---|---|---|
| Le menu Partager de l'iPhone ne propose pas une app web installée (pas de Web Share Target dans Safari) | certain jusqu'à iOS 18, probable ensuite | WebKit ne l'a pas mis en œuvre à ma connaissance ; se vérifie en dix secondes : Photos, Partager, chercher « J.A.R.V.I.S ». S'il apparaissait un jour, le `share_target` du manifeste et le service worker sont déjà là. |
| Le Raccourci « Partager » sur un vrai iPhone | probable (corps « Formulaire ») ; deviné (noms des menus, corps « Fichier ») | Testé seulement par le banc : un POST multipart avec la clé du Raccourci, et un corps brut. Avec « Fichier », le nom du fichier n'est pas transmis (nom daté par défaut). Un fichier à la fois (le serveur prend le premier d'un formulaire). |
| Le partage sur Android (service worker) | probable | Testé hors navigateur (faux `self`) et, pour la suite, dans Chromium (fichier posé dans le cache puis envoyé par l'app) ; jamais sur un vrai Android. |
| Le vrai Google Drive | probable | Tout est testé contre le faux Google. L'envoi en deux temps suit la documentation de Drive (adresse de session sur `www.googleapis.com`) ; si Google rendait une adresse d'une autre origine, rien ne partirait et l'écran le dirait. |
| L'écran d'accord de Google avec la portée `drive` | probable | Portée « restreinte », comme `gmail.modify` et `drive.readonly` qu'il a déjà accordées dans ce projet non validé : même avertissement attendu, aucun réglage à changer dans Google Auth Platform (deviné : je n'ai pas vu sa console). Si Google refusait la portée, tout le reste continuerait de marcher (elle est facultative). |
| 25 Mo sur le réseau mobile, à travers Caddy | probable | Pas testé hors boucle locale ; une limite de corps dans Caddy se verrait à la lecture demandée plus haut ; un envoi de plus de 5 minutes serait coupé par le serveur Node. |
| La qualité des propositions sur ses vrais papiers | probable pour les genres listés, deviné pour le reste | Les règles s'appuient sur le nom du fichier et le texte du PDF ; un scan (PDF sans texte) ou une photo n'ont que leur nom : « À trier » par défaut. La personne n'est trouvée que si le nom de son dossier est dans le nom du fichier ou le texte. |
| Claude pour proposer | probable | Testé avec un faux Claude (réponse reprise, dossier hors liste écarté, pas de réponse). Le texte d'un PDF non reconnu (2 500 caractères au plus) part au Claude de son forfait, sans outil ; les papiers de banque, d'impôts et de salaire reconnus par les règles n'y partent pas, mais un document financier que les règles ne reconnaissent pas y partirait (Claude a consigne de répondre « privé »). |
| HEIC | probable | Reconnu à ses octets ; le champ fichier de Safari peut convertir une photo en JPEG (les deux sont acceptés). |
| La copie de nuit du serveur | à vérifier (lecture demandée) | Si elle prend tout le dossier de données, les papiers en attente y sont, 30 jours au plus. |

Points ouverts, hors de mon périmètre :
- L'ancien écran « Iris range » (`SCREEN.depot` d'origine) n'est plus atteignable ; son code reste dans `index.html` (rien n'est réécrit). D'autres ordres « Iris : mon Drive » (`LV_DRIVE_ORDER`, écran de vérification du courrier) demandent encore à Iris de ranger le Drive : pas un dépôt, donc laissés ; Grok arrêté, ils partent à Hermes par le Canal.
- La carte « À trier » de repli dit encore « le rangement par JARVIS viendra plus tard » : elle ne se voit plus qu'avec un serveur pas à jour.
- Caddy : `/partage` et `/api/raccourci/depot` supposent que Caddy envoie tout sauf `/courses…` à jarvis (lecture demandée).
- Fusion avec la branche du coordinateur faite le 27/11 (0.92.0, 0.93.0, 0.94.0) : trois conflits « ajouts au même endroit », résolus en gardant les deux côtés (`banc.cjs`, `donnees-fictives.js`, `jarvis-serveur.js`) ; aucun de ses blocs n'est touché. Mes points d'ancrage : `index.html` (bloc avant le commentaire « 0.86.0 »), `server.mjs` (import, santé, `DEPOT` avant `COMP`, deux routes avant `/api/raccourci`, une route avant `/api/travail`, une entrée dans `guardSettings`), `server.test.mjs` (bloc dans la section MCP, avant `google/unlink`).

