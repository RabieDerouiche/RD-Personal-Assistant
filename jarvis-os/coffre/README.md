# jarvis-coffre — le coffre dont la clé n'est jamais sur le disque

Décidé le 24/11/2026 (`docs/hermes-deroule.md`, « Le coffre en mémoire »). Un service à part garde les secrets du
serveur (accès Google de JARVIS, mots de passe de sites) chiffrés sur le disque ; la clé qui les ouvre n'existe
qu'en mémoire, après que le propriétaire a collé sa phrase dans un terminal SSH. Ensuite les agents du serveur sont
autonomes, jusqu'au prochain redémarrage.

## Ce que ça protège, et ce que ça ne protège pas

| Contre | Protégé ? |
|---|---|
| Une copie du disque, une sauvegarde, un instantané du VPS | Oui : sans la phrase, rien ne s'ouvre (scrypt N=2^17 puis AES-256-GCM). Ni échange sur disque, ni image mémoire (`MemorySwapMax=0`, `LimitCORE=0`). |
| Les autres utilisateurs du serveur (`hermes`, un programme enfermé) | Oui : ils ne joignent aucune des deux prises. |
| L'utilisateur `jarvis` (le serveur de JARVIS et son Claude) | En partie : il lit les secrets de portée « service » (c'est leur rôle) ; jamais ceux de portée « guichet », ni la phrase. |
| Un fichier trafiqué (chiffré modifié, déplacé sous un autre nom ou une autre portée) | Oui : refusé au déchiffrement, le reste du coffre reste lisible. |
| **Root sur le serveur allumé, coffre ouvert** | **Non** : il peut lire la mémoire. Limite connue, acceptée. |
| Un serveur compromis au moment où la phrase est saisie | Non. |
| Une phrase faible ou perdue | Non : 20 caractères au moins, générée ; perdue, le coffre est perdu (il n'existe aucune autre clé). |

## Après chaque redémarrage du serveur

Le coffre démarre toujours verrouillé (JARVIS n'a plus Google, Hermes attend). Dans Termius, en SSH :

    sudo jarvis-coffre ouvrir

Colle la phrase gardée dans le gestionnaire de mots de passe (rien ne s'affiche). Une mauvaise phrase : 2 secondes
d'attente ; 5 de suite en 10 minutes : 10 minutes de blocage. La phrase ne passe jamais par JARVIS, par Hermes ni par
une conversation. Un redémarrage du seul service (panne, `systemctl restart`) reverrouille aussi : c'est voulu.

## Commandes (`sudo jarvis-coffre …`, root seul)

| Commande | Effet |
|---|---|
| `etat` | Ouvert ou verrouillé, noms des secrets, portée, date ; jamais une valeur. |
| `creer` | Une seule fois : la phrase, saisie deux fois. Le coffre reste ouvert ensuite. |
| `ouvrir` / `fermer` | Met la clé en mémoire / l'efface (tout attend alors la prochaine ouverture). |
| `mettre <nom> [--portee service\|guichet]` | Valeur saisie deux fois, sans affichage. Portée par défaut : `guichet`. `--depuis-entree` : valeur lue sur l'entrée (script), jamais en argument. |
| `retirer <nom>` | Efface un secret (possible coffre verrouillé). |
| `changer-phrase` | Nouvelle phrase **et** nouvelle clé : tout est rechiffré, l'ancienne phrase n'ouvre plus rien. |

Portées : `service` = rendu au serveur de JARVIS par sa prise (`lire`) ; il peut aussi y écrire ses propres secrets,
nommés `jarvis-…` (`ecrire`). `guichet` = rendu par aucune prise ; seul le service lui-même le prête à un « geste »
d'une liste fermée (`avecSecret`, aucun geste n'existe encore). Noms : minuscules, chiffres, tirets (2 à 41).

## Fichiers

| Fichier | Rôle |
|---|---|
| `coffre.mjs` | Le service (Node 22, aucune dépendance). Copié dans `/usr/local/lib/jarvis-coffre/` (root). Deux prises unix dans `/run/jarvis-coffre/` : `admin.sock` (0600, root seul) et `service.sock` (0660, groupe `jarvis-coffre-clients`). Une demande JSON par ligne (`{"commande":"lire","nom":"jarvis-google"}`), une réponse par ligne (`{ok:true,…}` ou `{ok:false, erreur, code}`), 64 Kio au plus. |
| `client.mjs` | Le client de `admin.sock` : reçoit phrase et valeur sur son entrée, jamais en argument. |
| `jarvis-coffre` | La commande (`/usr/local/sbin/jarvis-coffre`). Saisies sans affichage, terminal exigé, chemins fixes. |
| `jarvis-coffre.service` | L'unité systemd : utilisateur `jarvis-coffre`, enfermée, sans réseau, avant `jarvis.service`. |
| `install.sh` | `sudo bash /opt/rd/jarvis-os/coffre/install.sh` : relançable, ne touche jamais un coffre existant, ne redémarre jamais un coffre qui tourne. |
| `tests/coffre.test.mjs` | Banc du service : `node jarvis-os/coffre/tests/coffre.test.mjs`. |
| `tests/cli.test.sh` | Banc de la commande, dans un faux terminal : `sudo bash jarvis-os/coffre/tests/cli.test.sh`. |

Sur le serveur : `/var/lib/jarvis-coffre/coffre.json` (0600, à `jarvis-coffre`) : `{v, kdf:{algo, N, r, p, sel},
cle:{iv, ct, tag}, secrets:{<nom>:{portee, iv, ct, tag, maj}}}`. Il peut être sauvegardé tel quel : il ne vaut rien
sans la phrase. Les noms des secrets, leur portée et leur date y sont lisibles ; leur valeur et sa longueur, non.

Pas encore fait : brancher le serveur de JARVIS sur `service.sock` (accès Google hors de `state.json`), la
notification « coffre à ouvrir » après un redémarrage, les gestes « guichet ».
