#!/bin/bash
# JARVIS OS — scénario des couches : poser les identifiants de l'espace client et sonder la page de l'abonnement
# (docs/hermes-deroule.md, « Scénario des couches »).
#
#   sudo bash /opt/rd/jarvis-os/server/install/portail-couches.sh            (saisie, puis sonde)
#   sudo bash /opt/rd/jarvis-os/server/install/portail-couches.sh --sonde    (sonde seule, identifiants déjà posés)
#   sudo bash /opt/rd/jarvis-os/server/install/portail-couches.sh --retirer  (efface identifiants et sonde)
#
# À lancer dans Termius : l'adresse mail et le mot de passe de l'espace client se saisissent ici, jamais dans une
# conversation. Ils sont gardés dans /home/jarvis/.jarvis/portails/couches.env (jarvis, 0600) : seul le serveur de
# JARVIS les lit, pour changer la date de la prochaine livraison après le choix du propriétaire. Ni Hermes, ni
# Claude, ni la session du serveur ne les voient. La sonde ne modifie rien chez le marchand : elle se connecte,
# lit les pages de l'abonnement et n'en garde que le squelette (formulaires, champs, boutons), sans donnée
# personnelle ni secret, dans couches-sonde.txt, que la session « Serveur JARVIS » peut montrer à Claude.
set -uo pipefail
[ "$(id -u)" = 0 ] || { echo "À lancer en root : sudo bash $0"; exit 1; }
ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
U=${JARVIS_UTILISATEUR:-jarvis}; D=${JARVIS_PORTAILS:-/home/$U/.jarvis/portails}; SECRETS=$D/couches.env; SORTIE=$D/couches-sonde.txt
id "$U" >/dev/null 2>&1 || { echo "Utilisateur $U introuvable."; exit 1; }
if [ "${1:-}" = "--retirer" ]; then rm -f "$SECRETS" "$SORTIE"; echo "Identifiants et sonde effacés."; exit 0; fi
install -d -o "$U" -g "$U" -m 0700 "$D"
if [ "${1:-}" != "--sonde" ]; then
  [ -t 0 ] || { echo "À lancer dans un vrai terminal (Termius) : il demande une saisie."; exit 1; }
  read -r -p "Adresse mail de ton espace client Les Petits Culottés : " mail
  [[ "$mail" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { echo "Ce n'est pas une adresse mail. Rien n'a été changé."; exit 1; }
  read -r -s -p "Mot de passe (rien ne s'affiche) : " passe; echo
  [ "${#passe}" -ge 4 ] || { echo "Mot de passe vide. Rien n'a été changé."; exit 1; }
  ( umask 077; printf 'LPC_EMAIL=%s\nLPC_MOT_DE_PASSE=%s\n' "$mail" "$passe" > "$SECRETS" )
  chown "$U:$U" "$SECRETS"; chmod 0600 "$SECRETS"; unset passe mail
fi
[ -s "$SECRETS" ] || { echo "Identifiants absents : relance sans --sonde."; exit 1; }
runuser -u "$U" -- env -i HOME="/home/$U" PATH=/usr/bin:/bin LANG=C.UTF-8 ${JARVIS_SONDE_BASE:+JARVIS_SONDE_BASE=$JARVIS_SONDE_BASE} \
  python3 -I "$ICI/portail_sonde.py" --secrets "$SECRETS" --sortie "$SORTIE" ${JARVIS_SONDE_BASE:+--base "$JARVIS_SONDE_BASE"}
rc=$?
[ -f "$SORTIE" ] && chown "$U:$U" "$SORTIE" && chmod 0640 "$SORTIE"
case $rc in
  0) echo "Fait. Dis à Claude : « sonde faite ». (Squelette : $SORTIE, sans donnée personnelle ni secret.)" ;;
  4) rm -f "$SECRETS"; echo "Le site a refusé la connexion : identifiants effacés. Vérifie l'adresse et le mot de passe, puis relance." ;;
  *) echo "La sonde n'a pas abouti (code $rc). Dis-le à Claude : le détail est dans $SORTIE." ;;
esac
exit $rc
