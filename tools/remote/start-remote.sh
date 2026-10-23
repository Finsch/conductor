#!/usr/bin/env bash
# conductor. — relais de la télécommande (téléphone → PC). Laissez le terminal ouvert.
if ! command -v node >/dev/null; then
  echo
  echo "  Node.js est introuvable. Installez-le (version 18 ou plus) :"
  echo "    Ubuntu / Debian : sudo apt install nodejs   ·   Fedora : sudo dnf install nodejs   ·   Arch : sudo pacman -S nodejs"
  echo
  read -r -p "  Entrée pour fermer " _
  exit 1
fi
exec node "$(dirname "$(readlink -f "$0")")/relay.js"
