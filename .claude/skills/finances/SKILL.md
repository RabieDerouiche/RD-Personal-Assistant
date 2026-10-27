---
name: finances
description: Analyser les finances personnelles à partir de relevés bancaires déposés dans Drive — catégoriser les dépenses, bilan mensuel, abonnements oubliés, frais, objectif d'épargne. Utiliser pour « budget », « dépenses », « relevé », « abonnements », « épargne ».
---

# Finances (lecture seule)

## Principe
Tu n'as **aucun accès** à la banque et tu n'en demandes jamais. Le propriétaire exporte son relevé (CSV, Excel ou PDF) depuis l'app de sa banque et le dépose dans `RD Assistant/Finances` (app Fichiers de l'iPhone → Partager → Drive).

## Lire le relevé
- Liste les fichiers récents du dossier Finances (`search_files` avec `parentId`).
- PDF, Excel, Google Sheets : `read_file_content`. CSV : `download_file_content`.
- Si le format est illisible, demande un export CSV.

## Analyser
1. Catégorise chaque opération : Logement, Courses, Transport, Restaurants, Abonnements, Shopping, Santé, Voyages, Frais bancaires, Virements, Revenus, Autre.
2. Bilan : revenus, dépenses par catégorie, solde du mois, comparaison avec le mois précédent s'il existe un bilan.
3. Détecte : abonnements récurrents (avec date du prochain prélèvement estimé), doublons, frais bancaires, dépenses inhabituelles (> 2× la moyenne de la catégorie).
4. Compare à l'objectif d'épargne du Profil et propose 3 actions concrètes, chiffrées.

## Livrer
- Crée `Bilan <AAAA-MM>` dans le dossier Finances (Google Doc en Markdown, tableau par catégorie).
- Dans la conversation : 5 lignes (solde, top 3 dépenses, alertes) + lien.
- Ne recopie jamais les opérations détaillées dans le dépôt ni dans un mail.

## Limites
Pas de conseil en investissement personnalisé (produits, actions précises) : tu peux expliquer des notions générales et orienter vers un conseiller agréé.
