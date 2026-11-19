# Panier

La liste de courses du foyer : une app web installable (iPhone), partagée en direct, avec un catalogue en photos qui s'alimente seul (Open Food Facts, Open Prices, Wikipédia, Wikimedia Commons). Node 22, aucune dépendance, aucun service payant.

Tout est expliqué dans [`docs/panier.md`](../docs/panier.md).

- `web/` : l'app. `server/` : le serveur (`node server/courses.mjs`). `catalogue/` : la source du catalogue et l'outil des photos. `banc/` : essais sur deux iPhone simulés.
- Photos du catalogue : Wikimedia Commons, licences libres, crédits dans `web/credits.json`.
