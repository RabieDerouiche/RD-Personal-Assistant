# Chantier F — 0.94.0 : les réponses aux mails du mois, suivies

Note de passage pour la session qui fusionne (26/11/2026). Rien ici n'est une donnée personnelle : tous les exemples sont inventés.
Non touchés, comme demandé : `VERSION` de `server.mjs`, `CLAUDE.md`, `docs/jarvis-os.md`, `docs/journal-jarvis.md`,
`docs/jarvis-os-reprise.md`, `docs/demandes-serveur-en-attente.md`, `jarvis-os/hermes/`.

## 1. Entrée de journal pour `docs/jarvis-os.md`

- **0.94.0 (26/11/2026) : les réponses aux mails du mois, suivies** (son constat du 26/11/2026 : « mes deux contacts ont répondu à nos mails et je ne vois aucun impact, aucune trace ; il faut que ce soit rapide, efficace et fluide »). *La cause* : l'espace Travail réduisait chaque fil Gmail à son **dernier** message : une réponse dans le fil du mail du CRA donnait au mail envoyé l'heure de la réponse, et « reçu après l'envoi » n'était donc jamais vrai ; la réponse au mail de prolongation, venue d'une autre adresse dans un nouveau fil (« Re :objet »), n'était cherchée nulle part ; rien n'était relu hors de l'ouverture de l'écran. *Lecture message par message* (`reponses.mjs`, fonctions pures) : le mail envoyé est **son** message (étiquette SENT ou son adresse, jamais un brouillon), avec sa vraie date ; une réponse est un message d'un autre, plus récent que l'envoi, dans le même fil, ou dans un autre fil dont l'objet nettoyé (« Re: », « RE : », « Re : », « TR: », « Fwd: » répétés, casse, accents, espaces) est le même, quel que soit l'expéditeur ; l'ancienne voie reste, corrigée (un mail d'un destinataire du modèle, avec un PDF, arrivé après l'envoi, sous n'importe quel objet) ; une image de signature n'est pas un PDF ; un mail du même objet du mois d'avant n'est pas pris pour l'envoi. *Détection active, sans IA* (`jours.mjs`, dans son tic) : toutes les 5 minutes, et seulement tant qu'un mail du mois attend (préparé ou attendu, puis 45 jours au plus après l'envoi ; le mail du CRA s'arrête au CRA reçu en PDF ; le mois en cours et les deux d'avant, car la réponse arrive souvent au début du mois suivant), une recherche Gmail par mail (identifiants et version des fils seulement), plus celle des PDF des destinataires tant que le CRA manque : 4 recherches par passage au plus ; un fil n'est relu en entier que si Gmail dit qu'il a changé ; un quota atteint met le suivi en pause 15 minutes, écrit une fois au journal du serveur. Chaque réponse vue est gardée dans `jours.json` (mois du mail, `suivi.cra` et `suivi.prolongation` : qui, quand, message, fil, PDF ou non, de quoi retrouver le PDF sans le télécharger (message, pièce jointe, nom du fichier, taille), extrait de 160 caractères, lue ou non dans Gmail ; `historique`), **notifiée une fois** (« CRA signé reçu de ton client », « Réponse à ton mail du CRA, sans le CRA », « Réponse à ton mail de prolongation » : l'expéditeur affiché et l'extrait, lien `#travail` ; enregistrée avant l'envoi de la notification : un redémarrage ne renotifie jamais) et notée d'une ligne dans le Journal de Pilotage (Bot « JARVIS », Type « ETAT », sans nom, adresse ni extrait ; `journalJarvis` de `server.mjs`). Un mail envoyé à la main (sans brouillon de JARVIS) est suivi pareil ; un mail parti de JARVIS (« Envoyer ce mail ») fait relire aussitôt. *La carte « CRA du mois » de Travail* (`travail.mjs` ne cherche plus rien dans Gmail : il lit ce suivi tel quel, donc sans cache à vider ; trois recherches de dix fils à chaque ouverture en moins) : étapes à jour ; pour chaque mail « envoyé le … » puis « Réponse de <nom> le … », PDF signalé, extrait, et dans la feuille « Ouvrir le mail » (le fil dans Gmail, http(s) seulement) ; « CRA signé reçu : à rattacher sur le portail » en « À toi », avec **« C’est rattaché »** dans la feuille (`POST /api/travail/rattache` : l'étape « Rattaché » n'avait aucun moyen de passer à faite, le compte rendu du portail ne le disant pas) ; une réponse sans PDF est dite « réponse reçue, sans le CRA » et l'étape reste en cours ; l'alerte « Fin de mission le … » dit « Réponse à ton mail de prolongation reçue le … : à lire » (puis « lue dans Gmail »), sans conclure à sa place : la date de fin fait foi au prochain compte rendu du portail ; jusqu'au 24, la carte reste sur le mois d'avant tant que son mail est parti et que son CRA n'est pas rattaché. *« Pour moi »* : la ligne de Travail dit ce qui attend (« CRA signé reçu : à rattacher · Réponse à ton mail de prolongation : à lire ») et apparaît dès que quelque chose attend (bloc « 0.94.0 » en fin de script de l'app). *Passe sur les mails et les routines* : le surveillant du courrier lit lui aussi le fil message par message (un brouillon ou un tiers en dernier ne cache plus le mail de l'expéditeur surveillé ; sa propre réponse après veut toujours dire « déjà répondu ») ; une recherche « déjà envoyé ? » en échec n'est plus prise pour « pas envoyé » (un brouillon en double était préparé) : l'erreur est écrite, nouvel essai 5 minutes plus tard ; `google.mjs` réessaie une fois une **lecture** refusée pour quota (429), jamais une écriture ; la recherche « déjà envoyé ? » ne lit plus que des identifiants. Bancs : `travail.test.mjs` 31, `jours.test.mjs` 106, `courrier.test.mjs` 10, `server.test.mjs` 391, maquette (carte, feuille, « C’est rattaché », ligne de « Pour moi »).

## 2. Après le déploiement

**Rien d'autre que la mise à jour habituelle** (fusion dans `main`, « Nouvelle version disponible » dans l'app, ou `git pull` + redémarrage du
service) : aucun fichier de configuration, aucune variable, aucun droit Google nouveau (lecture de Gmail déjà accordée ; rien n'est
écrit dans Gmail). `travail.json` et `jours.json` gardent leur forme ; `jours.json` gagne des champs (`suivi`, `objet` et `envoye` sur
`mailCra` et `mailProlong`), lus sans migration.

**Le rattrapage des deux réponses du 26/11, garanti par construction** :
- le suivi ne dépend d'aucun état d'avant : au premier tic après le redémarrage (dans la minute ; `dernierSuivi` vaut 0 en mémoire, donc
  pas d'attente de 5 minutes), le mois en cours est suivi si `mailCra` existe **ou** si on est le 24 ou après (mail du CRA), et si
  `mailProlong` existe **ou** si le compte rendu du mois lit une fin de mission dans le mois (mail de prolongation) ; les deux conditions
  sont vraies sur son serveur depuis le 26/11 ;
- l'objet cherché est refait depuis le modèle de `travail.json` quand `mailCra.objet` n'existe pas (mails préparés avant la 0.94.0) ;
- toute réponse plus récente que l'envoi et pas encore dans `suivi.*.reponses` est notée puis notifiée, quel que soit son âge : les deux
  réponses déjà arrivées le sont donc au premier passage, une fois chacune ; déployé en décembre, le mois de novembre est encore suivi
  (45 jours après l'envoi) ;
- vérifié au banc (`jours.test.mjs`, « rattrapage : mails envoyés à la main … et réponses déjà là : détectées et notifiées une fois dès
  le premier passage », et « redémarrage … sans rien renotifier »).
Seule condition extérieure : que la recherche Gmail `subject:"<objet>"` rende bien les deux fils (voir § 6).

**Contrôles en lecture seule sur le serveur** (aucun nom, aucune adresse : des comptes et des dates), à joindre à une seule demande :

```
node -e '
const j = JSON.parse(require("fs").readFileSync(process.env.HOME + "/.jarvis/jours.json", "utf8"));
const ym = new Date().toISOString().slice(0, 7), x = j.mois[ym] || {}, s = x.suivi || {};
const d = (t) => (t ? new Date(t).toISOString().slice(0, 16) : "-");
for (const k of ["cra", "prolongation"]) { const v = s[k] || {}, r = v.reponses || [];
  console.log(k, "| envoi", d(v.envoi && v.envoi.at), "| réponses", r.length, "| avec PDF", r.filter((y) => y.pdf).length,
    "| non lues", r.filter((y) => !y.lu).length, "| notifiées", r.filter((y) => y.notifie).length, "| dernière", d(r.length && r[r.length - 1].at),
    "| lu", d(v.lu), "| clos", v.clos || "-", "| rattaché", d(v.rattache), "| erreur", v.erreur ? "oui" : "non"); }
console.log("historique :", (x.historique || []).filter((h) => /CRA signé|réponse au mail|envoyé le/.test(h.quoi)).length, "lignes de suivi");'
journalctl -u jarvis --since "-30 min" --no-pager | grep -c "suivi des réponses"
```

Attendu pour novembre 2026, quelques minutes après le redémarrage : `cra` : un envoi daté du jour de l'envoi (pas de l'heure de la
réponse), 1 réponse au moins, 1 avec PDF, `clos pdf` ; `prolongation` : un envoi, 1 réponse au moins, 0 avec PDF, `clos -` ; `notifiées`
égal à `réponses` ; `erreur non` ; la seconde commande rend 0 (aucune erreur de suivi au journal). Dans l'app : deux notifications
reçues, et la carte « CRA du mois ». Le Journal de Pilotage (`jarvis_pilotage_lire`, onglet Journal) porte deux lignes de Bot « JARVIS ».

**Retour arrière** : revenir au commit d'avant et redémarrer. Les champs ajoutés à `jours.json` sont ignorés par l'ancien code (rien à
nettoyer) ; seul effet : la carte de Travail retombe sur l'ancienne recherche (étape « CRA du client reçu » de nouveau fausse pour une
réponse dans le même fil). Les lignes déjà écrites dans le Journal de Pilotage restent (inoffensives). Couper le suivi sans revenir en
arrière n'a pas de réglage dédié : il s'arrête de lui-même (CRA reçu en PDF, ou 45 jours).

## 3. Ce qu'il verra

- **Deux notifications** peu après la mise à jour (le rattrapage) : « CRA signé reçu de ton client » (le nom affiché, l'extrait, « À
  rattacher sur le portail. ») et « Réponse à ton mail de prolongation » (le nom affiché, l'extrait). Elles ouvrent Travail. Ensuite, une
  notification par nouvelle réponse, dans les 5 minutes.
- **Espaces › Travail, carte « CRA du mois »** : étapes « Mail au client » et « CRA du client reçu » faites, « Rattaché » en cours ; en
  ambre « À toi : CRA signé reçu : à rattacher sur le portail (onglet du haut de la page du CRA). » ; l'alerte « Fin de mission le … .
  Réponse à ton mail de prolongation reçue le … : à lire. » (« (lue dans Gmail) » une fois lue) ; sous les étapes, chaque mail :
  « Mail « … » · envoyé le 26/11 à … », puis « Réponse de <nom> le 26/11 à … », la pastille « PDF », l'extrait.
- **En touchant la carte** (feuille du bas) : les mêmes mails avec **« Ouvrir le mail »** (le fil dans Gmail), et **« C’est rattaché »**
  en premier bouton : il le touche après avoir déposé le CRA signé sur le portail ; l'étape passe à faite et plus rien n'attend.
- **« Pour moi »** : une ligne ambre « CRA signé reçu : à rattacher · Réponse à ton mail de prolongation : à lire », qui ouvre Travail.
  Elle disparaît quand c'est rattaché et que la réponse est lue dans Gmail (au plus une minute après).
- **Début du mois suivant** : la carte reste sur le mois d'avant tant que le CRA signé n'est pas rattaché (jusqu'au 24).

## 4. Bancs, avant / après

| Banc | Avant | Après |
|---|---|---|
| `jarvis-os/server/tests/travail.test.mjs` | 14 | **31** (tout passe) |
| `jarvis-os/server/tests/jours.test.mjs` | 85 | **106** (tout passe) |
| `jarvis-os/server/tests/courrier.test.mjs` | 9 | **10** (tout passe) |
| `jarvis-os/server/tests/server.test.mjs` | 385 | **391** (tout passe) |
| `jarvis-os/server/tests/fiab-a4.test.mjs` (Google : `api` touchée) | 30 | **30** (tout passe) |
| `essais/jarvis-os-maquette/banc/banc.cjs` | 348 OK, 2 échecs (ma mesure dans cette copie, avant tout changement ; référence annoncée : 349 OK, 1 échec) | **354 OK, 3 échecs** : les 2 d'avant, et 1 de chronométrage, relancé seul : passe 3 fois sur 3 |

Les échecs de la maquette, mot pour mot :
- `ÉCHEC agenda : le rendez-vous écrit aussi dans Échéances n'est listé qu'une fois dans le mois, avec le bot qui le suit` : l'échec connu, lié à la date.
- `ÉCHEC 0.70 : recherche : une tâche touchée ouvre Pour moi (sur « Tout ») sur cette tâche, à l’écran (avant : Équipe › Demandes, sans la tâche) :: {"hash":"#demandes","f":"tout","dans":false}` : **déjà en échec avant mes changements** dans cette copie (même sortie) ; pas dans la référence annoncée : à regarder par la session qui fusionne (peut-être lié au jour ou à l'heure, comme le premier ; non cherché).
- `ÉCHEC waouh : elle se referme dans l’orbe` : une classe d'animation relue 60 ms après un clic, pendant que d'autres bancs tournaient ; les mêmes gestes relancés seuls donnent « vrai » 3 fois sur 3 ; sans rapport avec Travail ni « Pour moi ».
Les 7 vérifications ajoutées (« 0.94 : … ») passent toutes ; 348 + 7 − 1 = 354.

`banc-serveur.mjs` : pas lancé (consigne) ; il ne vérifie aucun affichage changé ici (aucune mention de Travail dans ce banc) : rien à
adapter. Le faux Google (`tests/fake-google.mjs`) gagne deux réglages de banc : `F.recherche(q)` (une recherche Gmail posée par le banc)
et `F.quota` (n réponses 429 de suite aux lectures de Gmail).

## 5. La passe sur les mails et les routines

**Corrigé (avec son test)**

| Défaut | Correction | Test |
|---|---|---|
| Travail : un fil réduit à son dernier message (mail envoyé daté de la réponse ; « reçu » jamais vrai dans le même fil) | lecture par message (`reponses.mjs`), état tenu par `jours.mjs` | `travail.test.mjs` : « réponse dans le même fil avec PDF… », « son propre message et son brouillon… », « le mail du CRA : « envoyé le » à la vraie date… » |
| Réponse au mail de prolongation jamais suivie (autre adresse, autre fil, « Re :objet ») | même suivi, par l'objet nettoyé | `travail.test.mjs` : « réponse dans un autre fil… », « prolongation : la réponse d’un autre fil est dite dans l’alerte… » |
| État calculé seulement à l'ouverture de l'écran, aucune notification | tic de 5 minutes, notification unique, Journal | `jours.test.mjs` : « détection active… » (3), « une réponse déjà notée n’est jamais renotifiée… », « redémarrage… » |
| Étape « Rattaché » sans aucun moyen de passer à faite | « C’est rattaché » (`POST /api/travail/rattache`) | `travail.test.mjs`, `jours.test.mjs`, `server.test.mjs`, maquette |
| Réponse arrivée après la fin du mois : plus aucune trace dans Travail (la carte passait au mois suivant) | mois d'avant suivi 45 jours ; carte gardée jusqu'au 24 | `jours.test.mjs` : « le mois suivant… » ; `travail.test.mjs` : « le 2 du mois suivant… » (3) |
| Objet du mail de prolongation cherché sans remplir le modèle (`{FIN}` cherché tel quel si le modèle en porte) | l'objet réel est gardé à la préparation (`mailProlong.objet`), sinon refait avec la fin lue | `jours.test.mjs` : « suivi : les deux brouillons préparés gardent leur objet… » |
| Erreur avalée : la recherche « déjà envoyé ? » en échec (quota) valait « pas envoyé » → brouillon préparé à tort, notification « Mail du CRA prêt » | l'erreur est écrite au journal du serveur, rien n'est préparé, nouvel essai 5 minutes après (et non chaque minute) | `jours.test.mjs` : « recherche « déjà envoyé ? » en échec (quota)… » |
| Quota de Gmail non géré : Travail lançait 3 recherches de 10 fils (jusqu'à 33 appels d'un coup) à chaque ouverture ; un 429 faisait échouer la lecture telle quelle | Travail : 0 appel ; suivi : identifiants seuls, fil relu seulement s'il a changé, 4 recherches par passage, pause de 15 minutes sur quota ; `google.mjs` : une lecture refusée (429) réessayée une fois | `jours.test.mjs` : « suivi : 4 recherches Gmail au plus… », « un fil que Gmail dit inchangé n’est pas relu », « quota de Gmail atteint… » ; `server.test.mjs` : « Google : un quota atteint (429)… » |
| Surveillant du courrier : seul le dernier message du fil comptait (un brouillon posé dans le fil, ou un tiers en copie, cachait le mail de l'expéditeur surveillé : jamais mis dans la file) | fil lu message par message ; brouillon ignoré ; sa réponse après = « déjà répondu » (comportement gardé) | `courrier.test.mjs` : « fil lu message par message… » |

**À décider (non fait), avec mon avis**

1. **Le surveillant du courrier après l'arrêt de Grok** (`BOTS_SURVEILLES = ['iris', 'kairos']`) : il reste utile et juste tant que
   l'onglet Expéditeurs garde « Iris » ou « Kairos » dans sa colonne Bot (c'est une donnée : « le bot dont c'était le travail », qui dit à
   Hermes quelle skill appliquer). Le piège : le jour où quelqu'un y écrit « Hermes », la ligne n'est plus surveillée, sans aucun
   message. Avis : accepter aussi « Hermes » (rangé comme le courrier prioritaire), une ligne de code ; à faire avec le ménage de
   l'onglet, pas avant. Les factures (Bot « Chronos ») restent hors du surveillant, à dessein.
2. **Le mail du portail « compte rendu d'activité à faire valider par votre client »** : il arrive après la validation d'Hermes et
   pourrait confirmer l'étape « CRA validé » (aujourd'hui tenue par le seul compte rendu de root). Avis : oui, comme simple confirmation
   affichée (« confirmé par le portail le … »), sur le même suivi (une recherche de plus par passage, par expéditeur et objet) ; il faut
   son adresse d'expéditeur et son objet exacts dans `travail.json` (jamais dans le dépôt). Petit chantier, sans risque.
3. **Les réponses d'Hermes dans le Canal ne sont pas notifiées** (`notify.mjs` ne connaît que les bots de Grok, `BOT_IDS`) : une ligne
   « Reprise » confiée à Hermes par l'app, à laquelle il répond, ou une demande d'Hermes pour lui (De = Hermes, Pour = Rabie) ne
   déclenche rien, sauf si Hermes appelle lui-même `jarvis_notifier`. Avec Grok arrêté, la surveillance du Canal ne notifie donc plus
   jamais. Avis : ajouter les noms des exécutants reliés à cette liste ; le risque est une double notification quand la skill d'Hermes
   notifie déjà : à trancher avec ses skills sous les yeux (`jarvis-os/hermes/`, hors de mon périmètre).
4. **Le dépôt du CRA signé par Hermes** (sa décision par QCM, chantier suivant) : tout ce qu'il faut est gardé (§ 7). « C’est rattaché »
   deviendra alors le oui qui lance Hermes, puis le compte rendu de root (`rattache` dans `mois-<AAAA-MM>.json`, déjà lu par Travail).
5. **`gmail_chercher`** (outil d'Hermes) montre, pour chaque fil, l'objet du premier message avec l'expéditeur, la date et l'extrait du
   **dernier** : si le dernier message est sa propre réponse ou un brouillon, Hermes lit « de lui ». Ce n'est pas faux (le nombre de
   messages est dit, et `gmail_lire` rend tout), mais c'est le même piège. Avis : rendre le dernier message **reçu** (ni SENT ni DRAFT) ;
   non fait car cela change ce que les skills d'Hermes lisent.
6. **Le brief « Avec Gmail… » et « Vérifié par Claude »** (`server.mjs`, lignes ~875 et ~996) prennent aussi le dernier message de chaque
   fil de la boîte de réception : sa propre réponse peut y être présentée comme le mail arrivé. Gêne faible ; même correction que le 5.
7. **Une réponse sans PDF au mail du CRA** : dite par une mention, pas par une étape de plus (la carte garde 5 étapes). Si une sixième
   étape « Réponse reçue » lui parle mieux, c'est un changement d'affichage simple.
8. **« À lire » repose sur l'étiquette « non lu » de Gmail** : la réponse au mail de prolongation n'attend plus dès qu'il l'a ouverte dans
   Gmail (sur n'importe quel appareil). Avis : c'est le plus fluide (aucun bouton) ; s'il préfère un « Vu » explicite dans JARVIS, c'est
   un petit ajout.
9. **Longs échanges** : 8 réponses gardées et notifiées par mail au plus (le CRA en PDF toujours) ; au-delà, silence. À ajuster s'il le faut.

## 6. Ce qui n'a pas pu être testé, risques, certitude

- **La vraie boîte** : rien n'a été lu ni écrit dans son Gmail depuis ce chantier (bancs sur de faux fils). Le comportement de la
  recherche `subject:"<objet>" newer_than:50d` sur ses deux fils réels (dont « Re :objet » sans espace après les deux-points) est
  **probable** : Gmail découpe l'objet en mots et la suite de mots correspond ; le contrôle exact de l'objet nettoyé est fait ensuite
  côté serveur (**certain**, testé). Si un fil n'était pas rendu, le § 2 le montrerait (`réponses 0`).
- **`historyId` par fil dans la liste de Gmail** : **probable** (documenté par l'API) ; s'il manquait, chaque fil serait simplement relu
  à chaque passage (2 à 4 lectures de plus toutes les 5 minutes, sans autre effet) : le code le prévoit.
- **« Lue dans Gmail » mis à jour** : repose sur le fait qu'un changement d'étiquette change la version du fil (**probable**).
- **L'identifiant de pièce jointe** (`pdfs[].piece`) : Gmail peut en donner un différent à chaque lecture (**probable**) ; il est
  rafraîchi tant que le fil est suivi, mais le mail du CRA n'est plus suivi une fois le PDF reçu : voir § 7 pour s'en passer.
- **Le quota de Gmail du 26/11** : la cause exacte n'a pas été relue dans les journaux du serveur ; je l'attribue aux rafales de
  l'espace Travail (**probable**), supprimées ici ; le Radar et le surveillant du courrier (25 fils en métadonnées toutes les 5 minutes)
  restent des consommateurs, non modifiés.
- **La ligne du Journal de Pilotage** : testée avec le faux Google (classeur) ; en mode « Pilotage hébergé par JARVIS », l'écriture passe
  par le même appel (`append_values`, détourné vers `pilotage-local.mjs`) : **probable**, non testé de bout en bout dans ce mode ; un
  échec est écrit au journal du serveur et n'empêche ni la note ni la notification.
- **Notification sans appareil abonné** : la réponse est quand même marquée notifiée (au plus une fois, jamais deux) : choix assumé.
- **Sur l'iPhone** : « Ouvrir le mail » ouvre `https://mail.google.com/mail/#all/<fil>` (comme le Radar le fait déjà) ; l'ouverture
  dans l'app Gmail plutôt que dans Safari dépend du téléphone (**deviné**).
- **Fusion avec les autres chantiers** : `index.html` (rendu de la carte dans le bloc 0.85.0, bloc 0.94.0 en fin de script, juste avant
  `boot()`), `server.mjs` (câblage de JOURS, TRAVAIL, COURRIER, `journalJarvis`, une ligne dans `/api/tool`), `google.mjs` (fonction `api`
  seulement). La ligne de Travail dans « Pour moi » est posée au même endroit que celle de la 0.87.0 : à revoir si le regroupement des
  cartes de « Pour moi » change cet endroit.
- **Le service worker** : `sw.js` non touché ; la nouvelle app arrive par la mise à jour habituelle.

## 7. Ce que `jours.json` garde (pour le dépôt du CRA signé par Hermes)

Dans `mois["AAAA-MM"]` (le mois **du mail**, pas celui de la réponse) :

```
"mailCra":     {draftId?, empreinte, objet, at, envoye?, envoyeLe?}      // objet : celui du mail préparé ; envoye : vu parti dans Gmail
"mailProlong": {draftId?, fin, objet, at, envoye?, envoyeLe?}
"suivi": {
  "cra": {
    "objet": "CRA Novembre 2026",
    "envoi": {"id": "<message envoyé>", "fil": "<fil>", "at": 1795700000000},
    "reponses": [{
      "id": "<message de la réponse>", "fil": "<son fil>", "at": 1795720000000,
      "de": "contact@exemple.invalid", "nom": "Contact Client",
      "pdf": true, "pieces": 2,
      "pdfs": [{"message": "<message>", "piece": "<identifiant de pièce jointe Gmail>", "nom": "CRA signé.pdf", "taille": 48213, "type": "application/pdf"}],
      "extrait": "…160 caractères au plus…", "lu": false,
      "voie": "fil" | "objet" | "destinataire",       // même fil ; autre fil du même objet ; PDF d'un destinataire du modèle
      "vu": 1795720100000, "notifie": 1795720100000
    }],
    "lu": 1795720100000, "erreur": "", "clos": "pdf" | "45j" | absent, "rattache": 1795800000000 | absent
  },
  "prolongation": { …même forme, sans "rattache"… }
}
```

Pour déposer le CRA signé : prendre la première réponse de `suivi.cra.reponses` dont `pdf` est vrai, et son `pdfs[0]`. **Rien n'est
téléchargé aujourd'hui.** Le moment venu : relire le message (`get_thread` sur `fil`, garder le message `pdfs[0].message`), y retrouver
la pièce jointe par son **nom et sa taille** (l'identifiant `piece` gardé peut être périmé), puis `get_attachment` de `google.mjs`
(déjà là, utilisé par le Radar) avec l'identifiant frais. Plusieurs PDF dans la réponse : les 4 premiers sont gardés, à lui montrer
avant son oui. Ces champs sont sur son serveur seulement ; aucun outil MCP ne les rend.
