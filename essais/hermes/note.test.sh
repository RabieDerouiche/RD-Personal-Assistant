#!/bin/bash
# Banc de note.py (Hermes « portail », 26/11/2026) : la lecture d'une facture d'abonnement ou de la box par règles, sans IA ;
# garde-fous (période, montant inhabituel, même facture, contrôle de TVA) ; champs depuis le modèle. Factures inventées, sans réseau.
#   bash essais/hermes/note.test.sh
cd "$(dirname "$0")/../../jarvis-os/hermes/portail" || exit 1
T=$(mktemp -d); ok=0; ko=0
verif() { local nom=$1; shift; if "$@" > /dev/null 2>&1; then ok=$((ok + 1)); echo "  ✓ $nom"; else ko=$((ko + 1)); echo "  ✗ $nom"; fi; }
prep() {   # prep <sorte> <mois> [de a] : note.py sur $T (facture.layout.txt), sortie dans $T/o.txt
  local x=(); [ -n "${3:-}" ] && x=(--de "$3" --a "$4")
  python3 -I note.py preparer --conf $T/c.conf --dossier $T --mois "$2" --historique $T/h.json --sorte "$1" --diagnostic "${x[@]}" > $T/o.txt 2>&1
}
echo "" > $T/facture.txt
printf 'Date : {DATE}\nVendeur : Vendeur invente\nMontant TTC : {MONTANT}\nHT : {MONTANT_HT}\nCommentaire : {MOIS_NOM} {ANNEE}\n' > $T/modele.txt
# 1. une facture française (box) : total TTC, HT, TVA à 20 % (le taux n'est pas pris pour un montant)
printf 'FACTURE (inventee)\nDate de facture : 05/11/2026\nTotal HT 32,50 EUR\nTVA 20 %% 6,50 EUR\nTotal TTC 39,00 EUR\n' > $T/facture.layout.txt
printf 'champs=%s\nht_motif=Total HT\ntva_motif=TVA\nprecedent_montant=38,00\n' $T/modele.txt > $T/c.conf
prep box 2026-11; rc=$?
verif "facture française : montant TTC, date, HT et TVA lus (le taux « 20 % » n'est pas un montant) ; champs remplis" bash -c "[ $rc = 0 ] && grep -q '^Montant TTC : 39,00$' $T/champs.txt && grep -q '^Date : 05/11/2026$' $T/champs.txt && grep -q '^HT : 32,50$' $T/champs.txt && grep -q '^Commentaire : novembre 2026$' $T/champs.txt && grep -q '\"tva\": 6.5' $T/resultat.json"
verif "le diagnostic ne montre aucune valeur" bash -c "! grep -qE '39|32,50|6,50' $T/o.txt"
# 2. période : la box prend la facture du mois d'avant ou du mois ; hors période → arrêt
prep box 2026-12 2026-11-01 2026-12-31; rc1=$?; prep box 2027-01 2026-12-01 2027-01-31; rc2=$?
verif "période : facture du mois d'avant acceptée pour la box de décembre ; refusée pour janvier" bash -c "[ $rc1 = 0 ] && [ $rc2 = 2 ] && grep -q 'pas émise dans la période attendue' $T/o.txt"
# 3. montant inhabituel (historique de root) ; même facture pour un autre mois
printf '{"box": {"2026-10": 20.0}}' > $T/h.json; prep box 2026-11; rc=$?
verif "montant à plus de 50 % du mois d'avant → arrêt" bash -c "[ $rc = 2 ] && grep -q 'montant inhabituel' $T/o.txt"
printf '{"box": {"2026-10": 39.0}, "box_dates": {"2026-10": "2026-11-05"}}' > $T/h.json; prep box 2026-11; rc=$?
verif "la même facture (même date) déjà servie pour un autre mois → arrêt" bash -c "[ $rc = 2 ] && grep -q 'déjà servi' $T/o.txt"
rm -f $T/h.json
# 4. un reçu anglais (abonnement) : « Date paid November 21, 2026 », « Amount paid €90.00 »
printf 'Receipt (invented)\nDate paid           November 21, 2026\nSubtotal   €90.00\nAmount paid   €90.00\n' > $T/facture.layout.txt
printf 'champs=%s\n' $T/modele.txt > $T/c.conf
prep claude 2026-11; rc=$?
verif "reçu anglais : montant et date lus" bash -c "[ $rc = 0 ] && grep -q '^Montant TTC : 90,00$' $T/champs.txt && grep -q '^Date : 21/11/2026$' $T/champs.txt"
# 5. le contrôle de TVA (Grok Bot) : taux, aucune, présente
printf 'Invoice (invented)\nDate of issue November 4, 2026\nSubtotal 25.00\nVAT (20%%) 5.00\nTotal 30.00\n' > $T/facture.layout.txt
tva() { printf 'champs=%s\nht_motif=Subtotal\ntva_motif=VAT\ntva_controle=%s\n' $T/modele.txt "$1" > $T/c.conf; prep grok 2026-11; }
tva taux:20; r1=$?; tva presente; r2=$?; tva aucune; r3=$?; tva taux:10; r4=$?
verif "contrôle de TVA : 20 % du HT juste ; « présente » juste ; « aucune » et « 10 % » arrêtent" bash -c "[ $r1 = 0 ] && [ $r2 = 0 ] && [ $r3 = 2 ] && [ $r4 = 2 ] && grep -q 'ne fait pas 10 %' $T/o.txt"
printf 'Invoice (invented)\nDate of issue November 4, 2026\nTotal 30.00\n' > $T/facture.layout.txt; tva presente; rc=$?
verif "contrôle de TVA « présente » sans TVA sur la facture → arrêt" bash -c "[ $rc = 2 ] && grep -q 'TVA attendue mais introuvable' $T/o.txt"
# 6. la date de la dépense : facture, jour fixe, dernier jour ; un modèle avec une case inconnue est refusé
printf 'FACTURE\nDate de facture : 05/11/2026\nTotal TTC 39,00 EUR\n' > $T/facture.layout.txt
printf 'champs=%s\ndate_depense=jour:15\n' $T/modele.txt > $T/c.conf; prep box 2026-11; rc1=$?; d1=$(grep '^Date' $T/champs.txt)
printf 'champs=%s\ndate_depense=dernier\n' $T/modele.txt > $T/c.conf; prep box 2026-11; rc2=$?; d2=$(grep '^Date' $T/champs.txt)
verif "date de la dépense : « jour:15 » → 15/11, « dernier » → 30/11" bash -c "[ $rc1 = 0 ] && [ '$d1' = 'Date : 15/11/2026' ] && [ $rc2 = 0 ] && [ '$d2' = 'Date : 30/11/2026' ]"
printf 'Montant : {MONTANT}\nAutre : {INCONNU}\n' > $T/modele2.txt; printf 'champs=%s\n' $T/modele2.txt > $T/c.conf; prep box 2026-11; rc=$?
verif "un modèle avec une case inconnue est refusé (code 1)" bash -c "[ $rc = 1 ] && grep -q 'case inconnue' $T/o.txt"
rm -rf $T
echo "Banc de note.py : $ok vérifications passées, $ko en échec."
[ $ko = 0 ]
