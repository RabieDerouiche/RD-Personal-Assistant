---
name: bons-plans
description: Trouver et vérifier des bons plans (vols, produits, services, restaurants), détecter les fausses promos et arnaques, et mettre en place une surveillance de prix. Utiliser pour « trouve-moi », « moins cher », « promo », « bon plan », « surveille le prix ».
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
1. Recommande d'abord l'alerte native (Google Flights, Idealo, Keepa) : elle arrive dans Gmail et le brief la remonte.
2. Si le propriétaire veut que tu surveilles toi-même et que l'outil de tâches planifiées est disponible (`create_trigger`) : propose une vérification quotidienne ou hebdomadaire (heure Europe/Paris, `create_new_session_on_fire: true`, connecteur Gmail uniquement), qui envoie un mail **au propriétaire seulement** si le prix passe sous le seuil. Crée-la après confirmation et donne son nom pour pouvoir l'arrêter.
3. Préviens que les prix lus sur le web par recherche sont moins fiables que les alertes natives.

Jamais d'achat, de saisie de paiement ou de création de compte : tu donnes le lien, le propriétaire achète.
