#!/bin/bash
# Banc de la sonde d'un espace client (install/portail_sonde.py) devant un faux site (tests/fake-portail.py).
# Données inventées, aucun réseau sortant. Lancer : bash jarvis-os/server/tests/portail-sonde.test.sh
set -uo pipefail
ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); SONDE=$ICI/../install/portail_sonde.py; PORT=40090
T=$(mktemp -d); trap 'kill $PID 2>/dev/null; rm -rf "$T"' EXIT
ok=0; ko=0
verif() { local nom=$1; shift; if "$@"; then ok=$((ok + 1)); echo "  ✓ $nom"; else ko=$((ko + 1)); echo "  ✗ $nom"; fi; }
python3 -I "$ICI/fake-portail.py" $PORT & PID=$!
for i in $(seq 1 30); do curl -s -o /dev/null "http://127.0.0.1:$PORT/login" && break; sleep 0.2; done
printf 'LPC_EMAIL=jean.exemple@exemple.fr\nLPC_MOT_DE_PASSE=bon-mot-de-passe\n' > "$T/bon.env"
printf 'LPC_EMAIL=jean.exemple@exemple.fr\nLPC_MOT_DE_PASSE=mauvais\n' > "$T/mauvais.env"
python3 -I "$SONDE" --secrets "$T/mauvais.env" --sortie "$T/m.txt" --base "http://127.0.0.1:$PORT" > "$T/m.out" 2>&1; rc=$?
verif "mauvais mot de passe : code 4, « REFUSÉE », le message du site est rapporté" bash -c "[ $rc = 4 ] && grep -q 'REFUSÉE' '$T/m.txt' && grep -q 'Identifiants invalides' '$T/m.txt'"
python3 -I "$SONDE" --secrets "$T/bon.env" --sortie "$T/b.txt" --base "http://127.0.0.1:$PORT" > "$T/b.out" 2>&1; rc=$?
verif "bons identifiants : connexion réussie, code 0" bash -c "[ $rc = 0 ] && grep -q 'Connexion : réussie' '$T/b.txt'"
verif "le formulaire de la date est décrit (action, champ, bornes, bouton)" bash -c "grep -q 'FORMULAIRE action=/account/subscription/diaper/<id>/next-delivery method=post' '$T/b.txt' && grep -q 'name=subscription\[nextDeliveryDate\] type=date .*value=2026-11-26 min=2026-11-25 max=2027-02-26' '$T/b.txt' && grep -q 'bouton « Enregistrer »' '$T/b.txt'"
verif "la page « Modifier » est suivie, jamais « Résilier »" bash -c "grep -q '=== PAGE .*/edit' '$T/b.txt' && ! grep -q '=== PAGE .*/cancel' '$T/b.txt'"
verif "les adresses appelées par les scripts sont relevées" bash -c "grep -q '/account/subscription/diaper/<id>/postpone' '$T/b.txt' && grep -q '/next-delivery-date' '$T/b.txt'"
verif "rien de personnel ni de secret dans le squelette (mot de passe, mail, adresse, téléphone, jetons, numéro d'abonnement)" bash -c "! grep -q 'bon-mot-de-passe\|jean.exemple\|Inventée\|06 12\|abcdefghijklmnop\|jeton-anti-rejeu\|299315' '$T/b.txt' '$T/b.out'"
verif "le jeton anti-rejeu d'un formulaire est signalé sans être montré" grep -q 'champ caché name=subscription\[_token\] (jeton anti-rejeu, non montré)' "$T/b.txt"
echo; echo "Sonde d'espace client : $ok vérifications réussies, $ko en échec."
[ $ko = 0 ]
