#!/usr/bin/env bash
# conductor. — ouvrir conductor. avec l'adresse du téléphone sur le câble USB (Linux)
#
# Équivalent de conductor-usb.bat (Windows) :
# 1. Cherche l'interface du partage de connexion USB (Modem USB / USB tethering :
#    pilote rndis_host, cdc_ncm ou cdc_ether) et prend sa passerelle = l'adresse du
#    téléphone (elle change à chaque branchement).
# 2. Sinon, si adb est installé et le téléphone branché en débogage USB : redirige
#    les ports 4533 (Navidrome) et 8022 (SFTP) → adresse « localhost ».
# 3. Copie l'adresse (si wl-copy, xclip ou xsel est installé), puis ouvre
#    conductor.html?usb=<adresse> dans Chrome / Chromium / Edge.
#
# Navigateur : laissez vide pour le premier trouvé, ou mettez une commande
# (ex. BROWSER_CMD="chromium").
BROWSER_CMD="${BROWSER_CMD:-}"

APP="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
PAGE="$APP/conductor.html"

usb_gateway() {
  local dev drv gw
  for dev in /sys/class/net/*; do
    [ -e "$dev/device/driver" ] || continue
    drv="$(basename "$(readlink -f "$dev/device/driver")")"
    case "$drv" in rndis_host|cdc_ncm|cdc_ether|rndis_wlan) ;; *) continue ;; esac
    dev="$(basename "$dev")"
    gw="$(ip -4 route show default dev "$dev" 2>/dev/null | awk '/via/ {print $3; exit}')"
    # Pas de route par défaut (réseau marqué « local seulement ») : l'adresse .1 / passerelle du DHCP
    [ -z "$gw" ] && command -v nmcli >/dev/null && \
      gw="$(nmcli -g IP4.GATEWAY device show "$dev" 2>/dev/null | head -n1)"
    if [ -n "$gw" ]; then echo "$gw"; return 0; fi
  done
  return 1
}

echo
echo "  conductor. - telephone par cable USB"
echo

addr=""; mode=""
for i in $(seq 1 20); do
  if addr="$(usb_gateway)"; then mode="Modem USB"; break; fi
  addr=""
  if command -v adb >/dev/null && [ "$(adb get-state 2>/dev/null)" = "device" ]; then
    adb forward tcp:4533 tcp:4533 >/dev/null
    adb forward tcp:8022 tcp:8022 >/dev/null
    addr="localhost"; mode="ADB"; break
  fi
  if [ "$i" = 1 ]; then
    echo "  Telephone pas encore trouve sur le cable."
    echo "  Branchez le cable et activez Modem USB (USB tethering) sur le telephone..."
  fi
  sleep 1
done

if [ -z "$addr" ]; then
  echo
  echo "  Aucun telephone sur le cable apres 20 s."
  echo "  - Modem USB active (bouton bleu) ?"
  echo "  - Cable de donnees ?"
  echo "  - Option ADB : debogage USB active et adb installe (paquet android-tools / adb) ?"
  echo
  read -r -p "  Entree pour fermer " _
  exit 1
fi

copied=""
if   command -v wl-copy >/dev/null && [ -n "$WAYLAND_DISPLAY" ]; then printf %s "$addr" | wl-copy && copied=1
elif command -v xclip   >/dev/null; then printf %s "$addr" | xclip -selection clipboard && copied=1
elif command -v xsel    >/dev/null; then printf %s "$addr" | xsel --clipboard --input && copied=1
fi

echo "  Telephone trouve ($mode) : $addr"
echo "  - Navidrome : $addr:4533"
echo "  - SFTP      : hote $addr, port 8022${copied:+ (adresse copiee, Ctrl+V)}"

if command -v curl >/dev/null && ! curl -s -o /dev/null -m 3 "http://$addr:4533/ping"; then
  echo
  echo "  Navidrome ne repond pas encore : lancez ~/navidrome.sh dans Termux (ou le widget conductor)."
fi

# Adresse file:// (espaces encodés) + ?usb=adresse:4533
url="file://$(printf %s "$PAGE" | sed 's/ /%20/g')?usb=$(printf %s "$addr:4533" | sed 's/:/%3A/g')"

if [ -z "$BROWSER_CMD" ]; then
  for b in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge microsoft-edge-stable brave-browser; do
    if command -v "$b" >/dev/null; then BROWSER_CMD="$b"; break; fi
  done
fi
if [ -n "$BROWSER_CMD" ]; then
  nohup $BROWSER_CMD "$url" >/dev/null 2>&1 &
else
  echo "  Chrome / Chromium / Edge introuvable : ouvrez $url"
fi

echo
sleep 4
