#!/bin/bash
# JARVIS OS — jarvis-coffre : le coffre dont la clé n'est jamais sur le disque (décidé le 24/11/2026 ;
# docs/hermes-deroule.md, « Le coffre en mémoire »).
#
#   sudo bash /opt/rd/jarvis-os/coffre/install.sh
#
# Relançable sans risque : il remet à jour les copies root du code, la commande et le service. Il ne touche JAMAIS à
# un coffre existant (/var/lib/jarvis-coffre/coffre.json), ne redémarre jamais un coffre qui tourne (ce serait le
# reverrouiller : il le dit, et c'est le propriétaire qui choisit le moment), ne touche ni à JARVIS, ni à Hermes, ni
# à Caddy, et n'ouvre aucun port. Aucune saisie, aucun secret ici : la phrase se choisit ensuite, dans Termius, avec
# « sudo jarvis-coffre creer ».
set -euo pipefail

ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
U=jarvis-coffre                 # l'utilisateur du service : sans shell, sans dossier, sans sudo
G=jarvis-coffre-clients         # qui peut joindre service.sock (lire les secrets de portée « service ») : jarvis, et lui seul
LIB=/usr/local/lib/jarvis-coffre
CLI=/usr/local/sbin/jarvis-coffre
ETAT=/var/lib/jarvis-coffre
UNITE=/etc/systemd/system/jarvis-coffre.service
BANC=${COFFRE_BANC:-0}          # 1 = banc d'essai (conteneur sans systemd) : le service n'est ni chargé ni démarré
SYSTEMD=0; [ -d /run/systemd/system ] && [ "$BANC" != 1 ] && SYSTEMD=1

dire() { printf '\n== %s\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "À lancer en root : sudo bash $0"; exit 1; }

dire "Vérifications"
for f in coffre.mjs client.mjs jarvis-coffre jarvis-coffre.service; do [ -f "$ICI/$f" ] || { echo "Fichier manquant : $ICI/$f"; exit 1; }; done
NODE=/usr/bin/node
if [ ! -x "$NODE" ]; then
  [ "$SYSTEMD" = 0 ] && NODE=$(command -v node || true)
  [ -n "$NODE" ] && [ -x "$NODE" ] || { echo "Node introuvable dans /usr/bin/node (installé par setup.sh de JARVIS) : le service et la commande l'attendent là."; exit 1; }
  echo "Banc : /usr/bin/node absent, contrôle fait avec $NODE (le service et la commande posés attendent /usr/bin/node)."
fi
"$NODE" -v | grep -qE '^v(2[2-9]|[3-9][0-9])' || { echo "Node 22 ou plus récent attendu (ici : $("$NODE" -v))."; exit 1; }
"$NODE" --check "$ICI/coffre.mjs" && "$NODE" --check "$ICI/client.mjs" && bash -n "$ICI/jarvis-coffre" || { echo "Le code du dépôt ne passe pas le contrôle de syntaxe : rien n'a été posé."; exit 1; }
echo "Node $("$NODE" -v), code du dépôt lisible."

dire "Utilisateur $U et groupe $G"
getent group "$G" >/dev/null || groupadd --system "$G"
id "$U" >/dev/null 2>&1 || useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$U"
for g in sudo adm docker lxd wheel jarvis hermes; do
  if id -nG "$U" | tr ' ' '\n' | grep -qx "$g"; then echo "Refus : $U ne doit pas être dans le groupe $g."; exit 1; fi
done
if id jarvis >/dev/null 2>&1; then
  if id -nG jarvis | tr ' ' '\n' | grep -qx "$G"; then echo "jarvis est déjà dans $G."
  else usermod -aG "$G" jarvis; echo "jarvis ajouté à $G (pris en compte au prochain redémarrage de son service ; rien n'est redémarré ici)."; fi
else
  echo "Pas d'utilisateur jarvis ici : personne dans $G pour l'instant."
fi
# Hermes ne lit aucun secret lui-même : il passe par les outils du serveur de JARVIS.
for autre in $(getent group "$G" | cut -d: -f4 | tr ',' ' '); do
  [ "$autre" = jarvis ] || echo "Attention : $autre est dans $G et peut donc lire les secrets de portée « service ». Prévu : jarvis seulement (gpasswd -d $autre $G)."
done

dire "Code (copies root : le service et la commande n'exécutent jamais un fichier du dépôt)"
change=0
[ -f "$LIB/coffre.mjs" ] && cmp -s "$ICI/coffre.mjs" "$LIB/coffre.mjs" || change=1
install -d -o root -g root -m 0755 "$LIB"
install -o root -g root -m 0644 "$ICI/coffre.mjs" "$LIB/coffre.mjs"
install -o root -g root -m 0644 "$ICI/client.mjs" "$LIB/client.mjs"
install -o root -g root -m 0755 "$ICI/jarvis-coffre" "$CLI"
echo "$LIB/coffre.mjs, $LIB/client.mjs, $CLI"

dire "Dossier du coffre : $ETAT (à $U seul)"
# systemd le tient aussi (StateDirectory) ; créé ici pour que les droits soient bons dès maintenant
install -d -o "$U" -g "$G" -m 0700 "$ETAT"
if [ -e "$ETAT/coffre.json" ]; then
  echo "Un coffre existe déjà ($(stat -c '%U %a' "$ETAT/coffre.json")) : laissé tel quel."
  [ "$(stat -c '%U %a' "$ETAT/coffre.json")" = "$U 600" ] || echo "Attention : ses droits ne sont pas « $U 600 ». Je n'y touche pas : à regarder."
else
  echo "Aucun coffre encore."
fi

dire "Service"
install -d -o root -g root -m 0755 /etc/systemd/system
install -o root -g root -m 0644 "$ICI/jarvis-coffre.service" "$UNITE"
if [ "$SYSTEMD" = 1 ]; then
  systemctl daemon-reload
  if systemctl is-active --quiet jarvis-coffre.service; then
    systemctl enable jarvis-coffre.service >/dev/null 2>&1
    if [ "$change" = 1 ]; then
      echo "Le service tourne avec l'ancien code : je ne le redémarre pas (le coffre serait reverrouillé)."
      echo "Quand tu veux l'appliquer : sudo systemctl restart jarvis-coffre, puis sudo jarvis-coffre ouvrir"
    else
      echo "Le service tourne déjà, code inchangé : rien à faire."
    fi
  else
    systemctl enable --now jarvis-coffre.service
    sleep 1
    systemctl is-active --quiet jarvis-coffre.service && echo "Service démarré (coffre verrouillé tant que la phrase n'est pas saisie)." \
      || { echo "Le service n'a pas démarré : journalctl -u jarvis-coffre -n 30 --no-pager"; exit 1; }
  fi
  awk '/SwapTotal/{ if ($2 > 0) print "Échange du serveur : " int($2/1024) " Mo ; interdit à ce service (MemorySwapMax=0)." }' /proc/meminfo
else
  echo "Banc d'essai (pas de systemd, ou COFFRE_BANC=1) : unité posée, service ni chargé ni démarré."
fi

dire "Fini"
if [ -e "$ETAT/coffre.json" ]; then
  cat <<FIN
Le coffre existe déjà. Dans Termius, en SSH :
  sudo jarvis-coffre etat      (ouvert ou verrouillé, noms des secrets)
  sudo jarvis-coffre ouvrir    (après chaque redémarrage : colle la phrase gardée dans ton gestionnaire de mots de passe)
FIN
else
  cat <<FIN
Étape suivante, dans Termius, en SSH (une saisie, jamais dans une conversation) :
  sudo jarvis-coffre creer     (choisis la phrase : 20 caractères au moins, générée et gardée dans ton gestionnaire de mots de passe)
Ensuite : sudo jarvis-coffre mettre <nom> [--portee service|guichet], sudo jarvis-coffre etat.
Après chaque redémarrage du serveur : sudo jarvis-coffre ouvrir
FIN
fi
