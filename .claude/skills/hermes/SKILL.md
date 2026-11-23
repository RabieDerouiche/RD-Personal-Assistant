---
name: hermes
description: Tenir Hermes Agent sur le serveur de JARVIS — lui ajouter ou changer une routine ou une skill, comparer une routine « en double » avec celle de Grok Bot, préparer une bascule, appliquer un changement sur le serveur. Utiliser pour « Hermes », « routine d'Hermes », « en double », « bascule », « compare Hermes et Iris/Argus… ».
---

# Hermes

Lis d'abord `docs/hermes-deroule.md` (qui fait quoi, droits, où en est chaque routine) et `docs/hermes.md` (installation, garde-fous). Pilotage fait foi pour l'état courant (onglets Routines, État, Journal, Canal).

## Changer une routine ou une skill d'Hermes

1. Tout se change dans le dépôt, jamais à la main sur le serveur : `jarvis-os/hermes/routines.conf` (une ligne par routine), `jarvis-os/hermes/skills/jarvis/<nom>/SKILL.md` (sa marche à suivre), `SOUL.md` (règles permanentes), `politique.yaml` (ses pouvoirs).
2. Un pouvoir nouveau (onglet à écrire, mail, agenda) est d'abord un outil du serveur MCP de JARVIS (`jarvis-os/server/server.mjs`, profil « exécutant »), avec son test ; puis son nom dans `politique-jarvis.yaml`. Jamais de terminal, de fichiers ni de jeton Google chez Hermes sans sa décision par QCM.
3. Banc : `sudo bash essais/hermes/banc.sh` (et `--neuf` si `install.sh` a changé). Puis fusion dans `main`.
4. Sur le serveur, par la session « Serveur JARVIS » (`send_message`, résultat par `list_events` ; jamais de secret) : `sudo -u jarvis git -C /opt/rd pull --ff-only`, `sudo bash /opt/rd/jarvis-os/hermes/install.sh`, `sudo bash /opt/rd/jarvis-os/hermes/routines.sh`, `sudo bash /opt/rd/jarvis-os/hermes/diagnostic.sh`. Un changement du serveur de JARVIS lui-même passe par « Mettre à jour » dans l'app.
5. Note l'état dans `docs/hermes-deroule.md`.

## Comparer une routine « en double »

1. Lis l'onglet Journal de Pilotage : les lignes `Bot = Hermes`, `Sujet = « En double : <routine> »`, et celles du bot de Grok Bot pour les mêmes dates ; lis aussi l'onglet État et, si la routine écrit ailleurs (Sorties, Relevés, Canal), ces onglets.
2. Pour chaque passage : ce que le bot a vu et pas Hermes, l'inverse, les erreurs de chacun (fait faux, ligne mal formée, retard), le respect des règles (une ligne qui se suffit, aucune donnée bancaire).
3. Verdict par routine : « au niveau », « meilleur », « en dessous » avec les exemples datés, et la correction de skill à faire. Jamais de verdict sur moins de 3 passages.
4. La bascule est sa décision (QCM). Elle se fait dans cet ordre : fiche du bot de Grok Bot mise à jour (la routine y est notée « reprise par Hermes »), ligne du Canal pour ce bot (mise en pause de sa routine, jamais sa suppression), `routines.conf` sans « en double », ligne dans l'onglet Routines. Retour arrière : l'inverse.

## Ce qu'il ne faut pas faire

- Écrire une donnée personnelle dans une skill, `routines.conf` ou `SOUL.md` : le dépôt ne garde que la logique.
- Demander ou faire transiter le jeton du bot, le jeton de JARVIS ou une connexion : ils se saisissent dans Termius.
- Retirer une routine de Grok Bot avant le verdict et son oui.
