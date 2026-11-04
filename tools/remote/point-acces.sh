#!/usr/bin/env bash
# Point d'accès wifi du PC (Linux, NetworkManager), même sans internet : pour piloter conductor.
# depuis le téléphone quand il n'y a aucun wifi. Adresse de la télécommande : http://10.42.0.1:8765
#
#   ./point-acces.sh          allume (nom « conductor », mot de passe affiché)
#   ./point-acces.sh stop     éteint
#
# La carte wifi passe en point d'accès : le PC quitte le wifi auquel il était connecté.
set -e
if ! command -v nmcli >/dev/null; then
  echo "nmcli introuvable : ce script demande NetworkManager (Ubuntu, Fedora, Mint… l'ont par défaut)."
  exit 1
fi
if [ "${1:-}" = "stop" ]; then
  nmcli connection down conductor-hotspot >/dev/null 2>&1 && echo "Point d'accès éteint." || echo "Point d'accès déjà éteint."
  exit 0
fi
PASS_FILE="$(dirname "$0")/.hotspot-password"
if [ -f "$PASS_FILE" ]; then PASS="$(cat "$PASS_FILE")"
else PASS="$(tr -dc 'a-z0-9' < /dev/urandom | head -c 10)"; echo "$PASS" > "$PASS_FILE"; fi
nmcli device wifi hotspot con-name conductor-hotspot ssid conductor password "$PASS" >/dev/null
echo
echo "  Point d'accès allumé."
echo "  Wifi         : conductor"
echo "  Mot de passe : $PASS"
echo "  Télécommande : http://10.42.0.1:8765  (Alt + R dans conductor., onglet « Point d'accès du PC »)"
echo
echo "  Pour l'éteindre : ./point-acces.sh stop"
