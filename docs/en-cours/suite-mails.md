# Suite du chantier 0.94.0 (réponses aux mails du mois) : à décider, risques, et ce que `jours.json` garde pour le dépôt du CRA signé par Hermes

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

