#!/usr/bin/env bash
# conductor. — installation Linux (une seule fois)
#   - rend les scripts de tools/ exécutables ;
#   - ajoute « conductor. » et « conductor USB » au menu des applications
#     (~/.local/share/applications), et sur le bureau si le dossier existe.
# Usage : bash tools/install-linux.sh

set -e
TOOLS="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
APP="$(cd "$TOOLS/.." && pwd)"
chmod +x "$TOOLS"/*.sh

ICON="$APP/assets/gray-favicon.png"
[ -f "$ICON" ] || ICON="audio-x-generic"

BROWSER=""
for b in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge microsoft-edge-stable brave-browser; do
  if command -v "$b" >/dev/null; then BROWSER="$b"; break; fi
done
[ -n "$BROWSER" ] || { echo "Attention : Chrome / Chromium / Edge introuvable (conductor. a besoin de l'un d'eux)."; BROWSER="xdg-open"; }

APPS="$HOME/.local/share/applications"
mkdir -p "$APPS"
PAGE_URL="file://$(printf %s "$APP/index.html" | sed 's/ /%20/g')"

cat > "$APPS/conductor.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=conductor.
Comment=Collection d'albums et lecteur
Exec=$BROWSER "${PAGE_URL//%/%%}"
Icon=$ICON
Terminal=false
Categories=AudioVideo;Audio;
DESK

cat > "$APPS/conductor-usb.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=conductor USB
Comment=Trouve le téléphone sur le câble USB et ouvre conductor.
Exec="$TOOLS/conductor-usb.sh"
Icon=$ICON
Terminal=true
Categories=AudioVideo;Audio;
DESK

chmod +x "$APPS/conductor.desktop" "$APPS/conductor-usb.desktop"
command -v update-desktop-database >/dev/null && update-desktop-database "$APPS" >/dev/null 2>&1 || true

DESKTOP="$(command -v xdg-user-dir >/dev/null && xdg-user-dir DESKTOP || echo "$HOME/Desktop")"
if [ -d "$DESKTOP" ]; then
  cp "$APPS/conductor-usb.desktop" "$DESKTOP/"
  chmod +x "$DESKTOP/conductor-usb.desktop"
  command -v gio >/dev/null && gio set "$DESKTOP/conductor-usb.desktop" metadata::trusted true 2>/dev/null || true
fi

echo "OK : « conductor. » et « conductor USB » sont dans le menu des applications (navigateur : $BROWSER)."
if [ -d "$DESKTOP" ]; then echo "     « conductor USB » est aussi sur le bureau ($DESKTOP)."; fi
