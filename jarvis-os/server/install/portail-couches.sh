#!/bin/bash
# JARVIS OS — scénario des couches : mettre au coffre les identifiants de l'espace client et sonder la page de
# l'abonnement (docs/hermes-deroule.md, « Scénario des couches » et « Le coffre »).
#
#   sudo bash /opt/rd/jarvis-os/server/install/portail-couches.sh            (saisie, puis sonde)
#   sudo bash /opt/rd/jarvis-os/server/install/portail-couches.sh --sonde    (sonde seule, identifiants déjà au coffre)
#   sudo bash /opt/rd/jarvis-os/server/install/portail-couches.sh --essai    (sans saisie ni vrai secret : vérifie que le coffre marche ici)
#   sudo bash /opt/rd/jarvis-os/server/install/portail-couches.sh --retirer  (efface le coffre et la sonde)
#
# À lancer dans Termius : l'adresse mail et le mot de passe se saisissent ici, jamais dans une conversation.
#
# LE COFFRE (sa demande du 24/11/2026 : « c'est pas en clair j'espère »)
# - Rien n'est écrit en clair sur le disque. La saisie est chiffrée aussitôt par systemd (`systemd-creds encrypt`,
#   AES-256-GCM) dans /etc/jarvis-portail/couches.cred (root, 0600). La clé est celle de la machine
#   (/var/lib/systemd/credential.secret, root seul), plus sa puce TPM s'il y en a une : le fichier copié ailleurs,
#   ou retrouvé dans une sauvegarde de /etc, est illisible.
# - Il n'est déchiffré que par systemd, en mémoire (jamais sur le disque, jamais dans l'échange), pour UN programme :
#   une copie root de la sonde (/usr/local/lib/jarvis-portail/, jamais un fichier du dépôt, qui appartient à
#   jarvis), lancée sous l'utilisateur jarvis-portail (sans shell, sans droit), enfermée, le temps de son passage.
# - Ni le serveur de JARVIS (utilisateur jarvis), ni son Claude, ni Hermes, ni Claude Code, ni la session du
#   serveur ne lisent ce coffre : ils ne peuvent que demander un geste d'une liste fermée.
# - Limite, dite telle quelle : root sur ce serveur peut le déchiffrer, et une copie de TOUT le disque emporte
#   la clé avec le coffre (pas de puce TPM sur un VPS, en général). D'où : un mot de passe propre à ce site.
#
# La sonde ne modifie rien chez le marchand : elle se connecte, lit les pages de l'abonnement et n'en garde que le
# squelette (formulaires, champs, boutons), sans donnée personnelle ni secret, dans
# /var/lib/jarvis-portail/couches-sonde.txt, que la session « Serveur JARVIS » peut montrer à Claude.
set -uo pipefail
[ "$(id -u)" = 0 ] || { echo "À lancer en root : sudo bash $0"; exit 1; }
ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
U=jarvis-portail; COFFRE=/etc/jarvis-portail; CRED=$COFFRE/couches.cred; LIB=/usr/local/lib/jarvis-portail
ETAT=/var/lib/jarvis-portail; SORTIE=$ETAT/couches-sonde.txt
SYSTEMD=0; [ -d /run/systemd/system ] && SYSTEMD=1          # 0 : banc d'essai (conteneur sans systemd)
command -v systemd-creds >/dev/null || { echo "systemd-creds introuvable : ce serveur ne sait pas tenir le coffre. Rien n'a été fait."; exit 1; }

if [ "${1:-}" = "--retirer" ]; then
  rm -rf "$COFFRE" "$ETAT" "$LIB" /home/jarvis/.jarvis/portails; echo "Coffre, sonde et copies effacés."; exit 0
fi
id "$U" >/dev/null 2>&1 || useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$U"
install -d -o root -g root -m 0700 "$COFFRE"
install -d -o root -g root -m 0755 "$LIB"
install -d -o "$U" -g "$U" -m 0750 "$ETAT"
install -o root -g root -m 0644 "$ICI/portail_sonde.py" "$LIB/portail_sonde.py"   # la copie root : seule exécutée avec le coffre ouvert
rm -rf /home/jarvis/.jarvis/portails                                               # l'ancien emplacement en clair (jamais servi)

# Un programme lancé avec un coffre ouvert : par systemd (enfermé, secret en mémoire seulement). Au banc, sans
# systemd : le secret passe par un tube, jamais par le disque ni par une ligne de commande.
avec_coffre() {   # avec_coffre <fichier .cred> <nom> <commande…> ; la commande lit le secret sur $SECRET
  local cred=$1 nom=$2; shift 2
  if [ "$SYSTEMD" = 1 ]; then
    systemd-run --quiet --wait --collect --pipe -p User="$U" -p Group="$U" \
      -p "LoadCredentialEncrypted=$nom:$cred" -p NoNewPrivileges=yes -p PrivateTmp=yes -p PrivateDevices=yes \
      -p ProtectSystem=strict -p ProtectHome=yes -p ReadWritePaths="$ETAT" -p ProtectKernelTunables=yes \
      -p ProtectKernelModules=yes -p ProtectControlGroups=yes -p RestrictSUIDSGID=yes -p LockPersonality=yes \
      -p MemoryMax=300M -p RuntimeMaxSec=180 -p Environment=LANG=C.UTF-8 \
      /bin/sh -c 'SECRET="$CREDENTIALS_DIRECTORY/'"$nom"'" exec "$@"' sh "$@"
  else
    systemd-creds decrypt --name="$nom" "$cred" - 2>/dev/null | (cd / && runuser -u "$U" -- env -i PATH=/usr/bin:/bin LANG=C.UTF-8 SECRET=- "$@")   # « - » : le secret arrive sur l'entrée
  fi
}

if [ "${1:-}" = "--essai" ]; then   # vérifie le coffre de bout en bout avec un faux secret, sans rien demander
  T=$COFFRE/essai.cred
  printf 'LPC_EMAIL=essai@exemple.fr\nLPC_MOT_DE_PASSE=faux-secret-du-banc\n' | systemd-creds encrypt --name=essai - "$T" 2>/dev/null || { echo "✗ systemd-creds n'a pas pu chiffrer."; exit 1; }
  chmod 0600 "$T"
  grep -q 'faux-secret-du-banc' "$T" && { echo "✗ le coffre contient le secret en clair."; rm -f "$T"; exit 1; }
  echo "✓ chiffré : $(stat -c '%U %a, %s octets' "$T"), le secret n'y est pas lisible"
  lu=$(avec_coffre "$T" essai /bin/sh -c 'if [ "$SECRET" = - ]; then grep -c "faux-secret-du-banc"; else grep -c "faux-secret-du-banc" "$SECRET"; fi; id -un' 2>&1 | tr '\n' ' ')
  rm -f "$T"
  [ "$lu" = "1 $U " ] && echo "✓ déchiffré en mémoire pour le seul programme lancé, sous l'utilisateur $U" || { echo "✗ le programme n'a pas reçu le secret (réponse : $lu)"; exit 1; }
  runuser -u jarvis -- test -r "$COFFRE" 2>/dev/null && { echo "✗ l'utilisateur jarvis peut lire le dossier du coffre."; exit 1; }
  echo "✓ l'utilisateur jarvis (le serveur de JARVIS et son Claude) ne peut pas ouvrir le dossier du coffre"
  echo "Clé de la machine : $(stat -c '%U %a' /var/lib/systemd/credential.secret 2>/dev/null || echo absente) ; puce TPM : $(systemd-creds has-tpm2 >/dev/null 2>&1 && echo oui || echo non)"
  echo "Coffre vérifié."; exit 0
fi

if [ "${1:-}" != "--sonde" ]; then
  [ -t 0 ] || { echo "À lancer dans un vrai terminal (Termius) : il demande une saisie."; exit 1; }
  read -r -p "Adresse mail de ton espace client Les Petits Culottés : " mail
  [[ "$mail" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { echo "Ce n'est pas une adresse mail. Rien n'a été changé."; exit 1; }
  read -r -s -p "Mot de passe (rien ne s'affiche) : " passe; echo
  [ "${#passe}" -ge 4 ] || { echo "Mot de passe vide. Rien n'a été changé."; exit 1; }
  # chiffré à la volée : le clair ne touche jamais le disque
  printf 'LPC_EMAIL=%s\nLPC_MOT_DE_PASSE=%s\n' "$mail" "$passe" | systemd-creds encrypt --name=couches - "$CRED" 2>/dev/null
  rc=$?; unset passe mail
  [ $rc = 0 ] && [ -s "$CRED" ] || { rm -f "$CRED"; echo "Le chiffrement a échoué : rien n'a été gardé."; exit 1; }
  chown root:root "$CRED"; chmod 0600 "$CRED"
  echo "Identifiants au coffre (chiffrés, root seul)."
fi
[ -s "$CRED" ] || { echo "Coffre vide : relance sans --sonde."; exit 1; }
avec_coffre "$CRED" couches /usr/bin/python3 -I "$LIB/portail_sonde.py" --secrets-env SECRET --sortie "$SORTIE" ${JARVIS_SONDE_BASE:+--base "$JARVIS_SONDE_BASE"}
rc=$?
[ -f "$SORTIE" ] && chmod 0640 "$SORTIE"
case $rc in
  0) echo "Fait. Dis à Claude : « sonde faite ». (Squelette : $SORTIE, sans donnée personnelle ni secret.)" ;;
  4) rm -f "$CRED"; echo "Le site a refusé la connexion : coffre vidé. Vérifie l'adresse et le mot de passe, puis relance." ;;
  *) echo "La sonde n'a pas abouti (code $rc). Dis-le à Claude : le détail est dans $SORTIE." ;;
esac
exit $rc
