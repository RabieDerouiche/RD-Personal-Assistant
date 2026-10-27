---
name: voyage
description: Planifier un voyage de A à Z — vols, hébergement, transports, itinéraire jour par jour, budget, documents — et le livrer en Google Doc. Utiliser pour toute demande de voyage, week-end, vol, hôtel ou itinéraire.
---

# Voyage de A à Z

## 1. Cadrer (3 questions max)
Lis le Profil d'abord. Ne demande que ce qui manque : dates (et flexibilité ±3 jours), nombre de voyageurs, budget total, objectif (détente, visite, famille, travail).

## 2. Vols
- Recherche web sur au moins 3 sources (Google Flights, Skyscanner/Kayak, site de la compagnie). Teste ±3 jours si les dates sont flexibles, et les aéroports alternatifs.
- Présente 3 options : **la moins chère**, **le meilleur rapport qualité/prix**, **la plus confortable**. Pour chacune : horaires, escales, bagages inclus, prix total A/R pour tous les voyageurs, lien.
- Préviens : les prix trouvés sur le web sont indicatifs et changent vite ; le prix réel est celui affiché au paiement.

## 3. Hébergement
3 options (quartier, note, annulation gratuite oui/non, prix total du séjour taxes comprises, lien). Respecte les préférences du Profil.

## 4. Sur place
- Transport aéroport ↔ hébergement (option la moins chère et la plus rapide, avec prix).
- Itinéraire jour par jour : matin / après-midi / soir, temps de trajet réalistes, 1 alternative en cas de pluie.
- Réservations à anticiper (musées, restaurants, excursions) avec liens.

## 5. Formalités
Passeport, visa, ETA/ETIAS, santé, assurance. Cite uniquement des sources officielles (site du gouvernement, ambassade) et date l'information.

## 6. Budget
Tableau : vols, hébergement, transports, nourriture (estimation/jour), activités, imprévus (10 %). Total vs budget du Profil.

## 7. Livraison
- Crée un Google Doc `AAAA-MM <Destination>` dans le dossier Voyages (`create_file`, `contentMimeType: text/markdown`, `parentId` du dossier Voyages) avec tout le plan et les liens.
- Dans la conversation : résumé en 10 lignes + lien du Doc + « Ce que tu dois réserver toi-même, dans cet ordre ».

## 8. Après réservation (sur demande)
- Cherche les confirmations dans Gmail (`search_threads` : compagnie, « réservation », « booking », « confirmation »).
- Propose les événements d'agenda (vols avec heure locale et numéro de vol, check-in hôtel). **Crée-les seulement après confirmation.**
- Mets à jour le Doc du voyage avec les numéros de réservation (jamais dans le dépôt).

## Surveillance de prix
Si le propriétaire veut attendre un meilleur prix : recommande une alerte Google Flights (la plus fiable), et propose en plus une tâche planifiée (skill `bons-plans`).
