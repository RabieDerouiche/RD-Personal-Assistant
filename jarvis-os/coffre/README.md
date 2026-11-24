# jarvis-coffre — le coffre dont la clé n'est jamais sur le disque

Décidé le 24/11/2026 (`docs/hermes-deroule.md`, « Le coffre en mémoire »). Un service à part garde les secrets du
serveur (accès Google de JARVIS, mots de passe de sites) chiffrés sur le disque ; la clé qui les ouvre n'existe
qu'en mémoire, après que le propriétaire a donné sa phrase : depuis l'app JARVIS (scellée dans la page pour le coffre
seul) ou, en secours, dans un terminal SSH. Ensuite les agents du serveur sont autonomes, jusqu'au prochain redémarrage.

## Ce que ça protège, et ce que ça ne protège pas

| Contre | Protégé ? |
|---|---|
| Une copie du disque, une sauvegarde, un instantané du VPS | Oui : sans la phrase, rien ne s'ouvre (scrypt N=2^17 puis AES-256-GCM). Ni échange sur disque, ni image mémoire (`MemorySwapMax=0`, `LimitCORE=0`). |
| Les autres utilisateurs du serveur (`hermes`, un programme enfermé) | Oui : ils ne joignent aucune des deux prises. |
| L'utilisateur `jarvis` (le serveur de JARVIS et son Claude) | En partie : il lit les secrets de portée « service » (c'est leur rôle) ; jamais ceux de portée « guichet », ni la phrase. |
| Un fichier trafiqué (chiffré modifié, déplacé sous un autre nom ou une autre portée) | Oui : refusé au déchiffrement, le reste du coffre reste lisible. |
| **Root sur le serveur allumé, coffre ouvert** | **Non** : il peut lire la mémoire. Limite connue, acceptée. |
| Le serveur de JARVIS qui relaie l'ouverture depuis l'app (ses journaux, sa mémoire, Caddy) | Oui s'il ne fait que passer le paquet : scellé pour le coffre seul, rejeu refusé. **Non s'il est activement compromis** : c'est lui qui sert la page et transmet la clé publique (autre page, autre clé : il lit la phrase). |
| L'utilisateur `jarvis` qui devine la phrase par `service.sock` | Freiné comme root (2 s, 5 essais en 10 minutes puis 10 minutes de blocage). Il peut en revanche **bloquer** l'ouverture (essais ratés, sceaux invalides) : arrêter `jarvis`, `systemctl restart jarvis-coffre`, puis `sudo jarvis-coffre ouvrir`. |
| Un serveur compromis au moment où la phrase est saisie | Non. |
| Une phrase faible ou perdue | Non : 20 caractères au moins, générée ; perdue, le coffre est perdu (il n'existe aucune autre clé). |

## Après chaque redémarrage du serveur

Le coffre démarre toujours verrouillé (JARVIS n'a plus Google, Hermes attend). Deux chemins, même frein (une
mauvaise phrase : 2 secondes d'attente ; 5 en 10 minutes, les deux chemins confondus : 10 minutes de blocage) :

- **Depuis l'app JARVIS** (décision du 24/11/2026 ; la page reste à écrire) : son gestionnaire de mots de passe
  remplit la phrase (Face ID), la page la scelle, le serveur de JARVIS passe le paquet sans pouvoir l'ouvrir.
- **Secours, dans Termius, en SSH** : `sudo jarvis-coffre ouvrir`, puis colle la phrase (rien ne s'affiche).

La phrase ne passe jamais en clair par JARVIS, par Hermes ni par une conversation. Un redémarrage du seul service
(panne, `systemctl restart`) reverrouille aussi : c'est voulu.

### L'ouverture scellée (pour écrire la page et le relais)

Tout en base64url sans « = ». La paire de clés du coffre (ECDH P-256) ne vit qu'en mémoire, neuve à chaque démarrage.

1. `{"commande":"cle-ouverture"}` (publique, permise sur les deux prises) → `{ok, cle, defi, expire}` : `cle` = clé
   publique du coffre (point brut non compressé, 65 octets), `defi` = 32 octets au hasard, à usage unique, valable
   2 minutes (`expire`, en ms) ; 8 défis en attente au plus, le plus ancien tombe.
2. Dans la page : `scellerPhrase(phrase, cle, defi)` de `sceller.mjs` → `{epk, iv, ct}`. `epk` = clé publique P-256
   éphémère (brute, 65 octets) ; secret = ECDH ; clé = HKDF-SHA256(secret, sel = les octets du défi, info =
   `jarvis-coffre ouverture v1`, 32 octets) ; `ct` = AES-256-GCM (`iv` de 12 octets, étiquette de 16 octets à la fin,
   AAD = `jarvis-coffre ouverture v1`) du JSON UTF-8 `{"phrase":"…","defi":"…"}` (`sceller.mjs` ajoute des espaces
   jusqu'à un multiple de 256 octets : la longueur de la phrase ne se lit pas ; 4 Kio au plus).
3. `{"commande":"ouvrir-scelle","epk":…,"iv":…,"ct":…}` sur `service.sock` → `{ok:true}` (ou `{ok:true, deja:true}`
   si le coffre était ouvert). Le service essaie la clé de chaque défi en attente, exige le même défi dans le clair,
   le consomme, puis suit le chemin d'`ouvrir`. **Tout refus rend la même réponse** (`code: "ouverture"`) : sceau
   faux, rejeu, défi expiré, mauvaise phrase, blocage ; la page ne peut donc pas dire lequel (le journal du service,
   lui, le dit). Un sceau invalide coûte le plus ancien défi en attente ; après 10 en une minute, plus aucun paquet
   n'est étudié pendant une minute (Termius reste ouvert). Une clé et un défi neufs à chaque essai.

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
| `coffre.mjs` | Le service (Node 22, aucune dépendance). Copié dans `/usr/local/lib/jarvis-coffre/` (root). Deux prises unix dans `/run/jarvis-coffre/` : `admin.sock` (0600, root seul) et `service.sock` (0660, groupe `jarvis-coffre-clients` : `etat`, `lire`, `ecrire`, `fermer`, `cle-ouverture`, `ouvrir-scelle`). Une demande JSON par ligne (`{"commande":"lire","nom":"jarvis-google"}`), une réponse par ligne (`{ok:true,…}` ou `{ok:false, erreur, code}`), 64 Kio au plus. |
| `sceller.mjs` | Le module de la page (WebCrypto seulement, Safari et Node 22) : `scellerPhrase(phrase, cle, defi)`. À servir tel quel par l'app ; le service ne s'en sert pas. |
| `client.mjs` | Le client de `admin.sock` : reçoit phrase et valeur sur son entrée, jamais en argument. |
| `jarvis-coffre` | La commande (`/usr/local/sbin/jarvis-coffre`). Saisies sans affichage, terminal exigé, chemins fixes. |
| `jarvis-coffre.service` | L'unité systemd : utilisateur `jarvis-coffre`, enfermée, sans réseau, avant `jarvis.service`. |
| `install.sh` | `sudo bash /opt/rd/jarvis-os/coffre/install.sh` : relançable, ne touche jamais un coffre existant, ne redémarre jamais un coffre qui tourne. |
| `tests/coffre.test.mjs` | Banc du service : `node jarvis-os/coffre/tests/coffre.test.mjs`. |
| `tests/cli.test.sh` | Banc de la commande, dans un faux terminal : `sudo bash jarvis-os/coffre/tests/cli.test.sh`. |

Sur le serveur : `/var/lib/jarvis-coffre/coffre.json` (0600, à `jarvis-coffre`) : `{v, kdf:{algo, N, r, p, sel},
cle:{iv, ct, tag}, secrets:{<nom>:{portee, iv, ct, tag, maj}}}`. Il peut être sauvegardé tel quel : il ne vaut rien
sans la phrase. Les noms des secrets, leur portée et leur date y sont lisibles ; leur valeur et sa longueur, non.

Pas encore fait : brancher le serveur de JARVIS sur `service.sock` (accès Google hors de `state.json` ; relais de
`cle-ouverture` et `ouvrir-scelle`), la page d'ouverture dans l'app, la notification « coffre à ouvrir » après un
redémarrage, les gestes « guichet ». Arrêt d'urgence : `jarvis-os/server/install/urgence.sh`.
