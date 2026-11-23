#!/bin/bash
# Banc : la liste des routines d'Hermes du dépôt (jarvis-os/hermes/routines.conf) est bien écrite et chaque skill
# citée existe dans le kit. Aucun réseau, rien d'installé. Lancer : bash essais/hermes/routines-conf.test.sh
set -uo pipefail
ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); KIT=$ICI/../../jarvis-os/hermes
n=0; ko=0
while IFS='|' read -r nom etat horaire skills consigne; do
  case "$nom" in ''|'#'*) continue ;; esac
  nom=$(echo $nom); etat=$(echo $etat); horaire=$(echo "$horaire" | sed 's/^ *//; s/ *$//'); skills=$(echo $skills | tr -d ' '); n=$((n + 1))
  if ! [[ "$nom" =~ ^[a-z0-9-]{2,40}$ ]] || ! [[ "$etat" =~ ^(actif|pause)$ ]] || [ "$(echo "$horaire" | wc -w)" != 5 ] \
     || ! [[ "$horaire" =~ ^[0-9*,/\ -]+$ ]] || [ "${#consigne}" -lt 10 ]; then echo "  ✗ ligne mal écrite : $nom"; ko=$((ko + 1)); continue; fi
  for s in ${skills//,/ }; do [ -f "$KIT/skills/jarvis/$s/SKILL.md" ] || { echo "  ✗ $nom : skill « $s » absente du kit"; ko=$((ko + 1)); }; done
  grep -q "^name: $nom\$" "$KIT/skills/jarvis/$nom/SKILL.md" 2>/dev/null || { echo "  ✗ $nom : pas de skill du même nom"; ko=$((ko + 1)); }
done < "$KIT/routines.conf"
echo "Routines du dépôt : $n lignes, $ko en erreur."
[ "$n" -ge 1 ] && [ "$ko" = 0 ]
