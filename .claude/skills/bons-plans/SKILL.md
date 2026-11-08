---
name: bons-plans
description: Trouver et vérifier des bons plans (vols, produits, services, restaurants), détecter les fausses promos et arnaques, et préparer la surveillance de prix confiée à Unicorn (Grok Bot). Utiliser pour « trouve-moi », « moins cher », « promo », « bon plan », « surveille le prix ».
---

# Bons plans

## Chercher
1. Lis le Profil (catégories suivies, seuils).
2. Recherche web sur au moins 3 sources : comparateurs (Idealo, Google Shopping, LeDenicheur), communautés (Dealabs), site officiel du vendeur. Pour les vols, voir le skill `voyage`.
3. Pour chaque offre retenue : prix total livré, vendeur, délai, conditions de retour, lien.

## Vérifier (obligatoire avant de recommander)
- **Vraie promo ?** Compare au prix habituel (historique de prix : Keepa pour Amazon, Idealo, LeDenicheur). Une « remise » sur un prix barré gonflé n'est pas un bon plan.
- **Vendeur fiable ?** Marketplace tierce, avis récents, mentions légales, ancienneté du site. Signale tout site inconnu sans avis.
- **Signaux d'arnaque** : prix < 50 % du marché, paiement par virement/crypto uniquement, urgence artificielle, domaine qui imite une marque.

Résultat : top 3 classé, avec pour chacun « ✅ fiable / ⚠️ à vérifier / ❌ éviter » et une phrase de justification.

## Surveiller un prix
La surveillance est faite par **Unicorn (Grok Bot)**, jamais par une tâche planifiée de Claude.
1. Donne le prix de référence TTC livré, le vendeur fiable et le seuil d'alerte proposé.
2. Rédige le prompt prêt à coller dans Unicorn (produit, vendeurs autorisés, seuil, fréquence).
3. Pour les vols, recommande en plus l'alerte native Google Flights.

Jamais d'achat, de saisie de paiement ou de création de compte : tu donnes le lien, le propriétaire achète.
