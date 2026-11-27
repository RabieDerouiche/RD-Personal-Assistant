# CRA signé déposé par Hermes (0.97.0) : ce qu'il voit, ce qui reste à prouver

Note du chantier (27/11/2026). Détail du mécanisme : `docs/hermes-portail.md`, « Le CRA signé du client » ; `docs/jarvis-os.md`, entrée 0.97.0.

## Ce qu'il voit, et ce qu'il a à faire

| Moment | Ce qu'il voit | Ce qu'il fait |
|---|---|---|
| Le client répond avec le PDF | Notification « CRA signé reçu de ton client » (« Hermes vérifie le portail, puis te demande ton oui pour le déposer »). Travail › carte « CRA du mois » : étape « CRA du client reçu » faite ; une ligne « CRA signé reçu : Hermes vérifie le portail… » (ou « …une fois le CRA du mois validé ») | Rien |
| Hermes a trouvé où le déposer (dans le quart d'heure) | Notification « CRA signé prêt à déposer : ton oui ». « Pour moi » : la ligne de Travail dit « CRA signé reçu : Hermes le dépose sur le portail ? ». La carte : « À toi : … ? « nom du fichier », taille. Il a trouvé où le déposer (essai à blanc : rien n'est déposé) » | Toucher la carte |
| La feuille de la carte | Le fichier, sa taille, « Ouvrir le mail » ; deux boutons : « Oui, déposer » et « Je le fais moi-même » | « Oui, déposer », puis confirmer (« Hermes dépose « … » sur le portail ? » → « Oui, déposer ») |
| Après son oui | La carte : « Ton oui est noté : Hermes dépose le CRA signé sur le portail (dans le quart d'heure) » | Rien |
| Déposé | Notification « Première exécution d'Hermes : CRA signé de novembre déposé — vérifie sur le portail » (ensuite : « CRA signé de <mois> déposé »). Carte : 5 étapes sur 5, « CRA signé déposé sur le portail par Hermes le … » | La première fois : vérifier sur le portail |
| Hermes n'a pas trouvé, ou n'a pas pu | Notification « CRA signé de <mois> : à déposer à la main » ; la carte le dit avec la raison | Le déposer lui-même, puis « C'est rattaché » |
| Le dépôt a échoué | Notification « CRA signé de <mois> pas déposé : à faire à la main » ; étape « Rattaché » en rouge ; boutons « Réessayer avec Hermes » et « C'est rattaché » | L'un ou l'autre (vérifier le portail avant de réessayer) |
| « Je le fais moi-même » | L'ancien chemin : « à rattacher sur le portail », bouton « C'est rattaché » | Le déposer, puis « C'est rattaché » |

Pour novembre 2026 : après le déploiement, sans rien faire, il doit recevoir « CRA signé prêt à déposer : ton oui » dans le quart
d'heure (sauf s'il a déjà touché « C'est rattaché »).

## Ce qui n'a pas pu être testé, et les risques

- **Le vrai portail n'a jamais été vu pour ce dépôt** (certain). Tout ce que la skill dit de l'endroit du dépôt vient d'une phrase
  du propriétaire : « l'onglet du haut de la page du CRA ». Deviné : qu'il y a un champ de fichier ordinaire (et pas seulement une
  zone « glisser-déposer », une fenêtre, un type de document à choisir) ; que le dépôt se fait sur le même hôte (sinon le relais le
  refuse : « rien déposé ») ; que choisir le fichier ne suffit pas à l'envoyer (si c'est le cas, le dépôt réel marche quand même, et
  l'essai à blanc ne risque rien puisqu'aucun fichier n'est remis) ; que le portail accepte un PDF de cette taille ; qu'un document
  déjà déposé se voit sur la même page. L'essai à blanc réel de novembre est là pour lever ces points : c'est le relevé « d » et « e »
  de la demande. **Le premier vrai dépôt reste un essai** : il le vérifie sur le portail (notification « Première exécution »).
- **`upload_file` sur un formulaire « multipart »** : prouvé au banc avec le vrai navigateur d'Hermes et le faux portail (le fichier
  arrive entier, même empreinte) — certain au banc, probable sur le portail.
- **Le texte du compte rendu sans nom de portail** (probable) : adresses, hôtes, adresses mail et mots tirés de l'hôte sont retirés
  par root, puis de nouveau par JARVIS ; les lignes « Connexion » et « Page d'arrivée » d'Hermes ne sont jamais recopiées. Un nom de
  portail écrit en toutes lettres par le modèle, différent de l'hôte, passerait : contrôle « b » de la demande.
- **« Déjà déposé » et « introuvable » reposent sur la lecture d'Hermes** (probable) : au banc, ces deux réponses sont simulées
  (sans passage du navigateur) ; seuls l'essai à blanc et le dépôt réel passent par le navigateur.
- **Deux minuteries du portail en même temps** (probable, existait déjà) : `cra-signe-auto` ne part pas si un passage d'Hermes
  tourne ni pendant `cra-mois-auto`, mais `cra-auto`, `ndf-auto` et `notes-auto` ne regardent pas la sienne ; deux passages lancés
  dans la même minute se marcheraient dessus (même fichier de consigne). Pas corrigé ici (il faudrait un verrou commun à tous les
  passages) : à décider.
- **Un oui puis « C'est rattaché » dans la même minute** : root relit `jours.json` au début de son passage ; s'il a déjà commencé,
  le dépôt se fait quand même (deviné : rare ; le portail aurait alors deux documents).
- **Après un dépôt en échec, « Réessayer avec Hermes »** refait une tentative sans nouvel essai à blanc ; la skill regarde d'abord
  si un document est déjà là (« déjà déposé »), mais c'est le modèle qui le lit (probable).
- **Le coffre verrouillé** (après un redémarrage du serveur) : ni l'essai ni le oui ne sont comptés, tout repart quand il rouvre le
  coffre — écrit, pas passé au banc (probable).
- **JARVIS sur son téléphone** : l'app n'a été vue qu'au banc (émulation iPhone 15 Pro Max, données d'exemple), pas sur l'iPhone.
- **Le quota de Gmail** : un téléchargement par CRA signé, une relecture du fil ; un quota atteint repousse au quart d'heure
  (certain au banc pour l'échec réseau, probable pour le quota).
- **Novembre 2026** : l'essai à blanc ne part que si novembre est noté validé par Hermes chez root (lecture 2) et si
  `suivi.cra.rattache` est absent (lecture 3) — probable, à confirmer par la session.
- **Fusion** : `index.html` est changé dans le bloc 0.85.0 (carte et feuille de Travail) et en deux endroits du cœur (`pickAsk`,
  bouton de confirmation : `ask`, `yes`) ; aucun bloc 0.91 à 0.96 n'est touché. `server.mjs` : une ligne (`piece`).
  `travail.mjs` lit désormais les comptes rendus de root à chaque ouverture de Travail (`jours.lireRetours`) : les notes de frais
  en profitent aussi.
- **Banc de l'app** : la vérification « notification de la page : croix « Fermer » » échouait par course (une autre notification arrivait pendant le clic) ; corrigée dans le banc à la fusion (la notification touchée est marquée).

## 0.98.0 : contrôle du PDF et dépôt sans attendre — à savoir

- **Le lecteur ne connaît qu'un format** (certain) : celui du CRA reçu en novembre 2026 (« Mois : … », une ligne « Total » suivie des valeurs). Un autre modèle de document, ou un scan, rend « pas comparable » : rien d'automatique, son oui.
- **La signature n'est pas vérifiée** (certain) : le contrôle porte sur le mois et les jours, pas sur la présence d'une signature (une image dans le PDF).
- **Le dépôt automatique ne s'ouvre qu'après un premier dépôt réussi par Hermes** (`signePremier`). Pour l'arrêter : `sudo systemctl disable --now hermes-portail-cra-signe.timer` (plus aucun essai ni dépôt), ou retirer `signePremier` de `jours.json` (son oui redevient nécessaire). Pas de réglage dans l'app : à ajouter s'il le demande.
- **Qui peut déclencher un dépôt** (probable) : une réponse dans le fil du mail du CRA (ou sous le même objet) venant d'un destinataire connu, avec un PDF qui porte exactement le bon mois, le bon total et le bon détail. Une adresse usurpée qui enverrait un tel PDF ferait déposer ce document-là : gênant, réparable sur le portail, et il est prévenu à chaque dépôt.
- **Jours corrigés après coup** : si les jours validés changent, le contrôle est refait ; un oui déjà posé n'est pas retiré (root l'exécute au quart d'heure).

