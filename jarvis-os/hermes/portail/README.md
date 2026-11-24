# Hermes « portail » (essai des portails)

Un second Hermes, à part (utilisateur `hermes-portail`), qui se connecte à un portail avec l'identifiant de son
coffre, en lecture seule. La clé du coffre ne vit qu'en mémoire vive ; sa copie durable est dans `jarvis-coffre`.
Tout est expliqué dans `docs/hermes-portail.md` (décisions, barrières, fichiers, mise en service, ce que le banc
prouve). Banc : `sudo bash essais/hermes/portail.test.sh`.

Ordre : `../../coffre/install.sh` → `install.sh` → `sudo jarvis-coffre creer` → `sudo hermes-portail connexion-claude`
→ `sudo hermes-portail enregistrer` → `sudo hermes-portail domaines ajouter <hôte>` → `sudo hermes-portail essai <adresse>`.
