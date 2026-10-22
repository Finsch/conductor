#!/usr/bin/env bash
# Télécharge chaque album dans son propre dossier "Artiste - Album (Année)" (Linux / macOS).
# Équivalent de telecharger_albums.ps1 (Windows).
# Usage : ./telecharger_albums.sh [dossier]      (par défaut : ./Albums)

DESTINATION="${1:-./Albums}"

# --- Vérifications -----------------------------------------------------------
for cmd in yt-dlp ffmpeg; do
  if ! command -v "$cmd" >/dev/null; then
    echo "Erreur : '$cmd' n'est pas installé ou introuvable dans le PATH." >&2
    exit 1
  fi
done

# --- Liste des albums --------------------------------------------------------
# Une ligne par album : "Nom du dossier|adresse de la playlist"
# (pas de / dans le nom ; évitez aussi ? : * " < > | pour rester compatible Windows)
ALBUMS=(
  "The Mothers of Invention - Absolutely Free (1967)|https://youtube.com/playlist?list=PLHDLoOm3xu5je6sTMnZHAk2ish5FGU07J&si=1MFL40SQ4_MLGwrx"
  "The Mamas & the Papas - If You Can Believe Your Eyes and Ears (1966)|https://youtube.com/playlist?list=PL01007654EEE0C30C&si=P8ZVGdPbElQeCLTc"
)

# --- Téléchargement ----------------------------------------------------------
mkdir -p "$DESTINATION"
ECHECS=()
TOTAL=${#ALBUMS[@]}
N=0

for ALBUM in "${ALBUMS[@]}"; do
  N=$((N + 1))
  NOM="${ALBUM%%|*}"
  URL="${ALBUM#*|}"
  DOSSIER="$DESTINATION/$NOM"
  mkdir -p "$DOSSIER"

  echo
  echo "=== [$N/$TOTAL] $NOM ==="

  # --download-archive : si tu relances le script, les pistes déjà
  # téléchargées sont ignorées (reprise après coupure).
  if ! yt-dlp -x --audio-format mp3 --audio-quality 0 \
      --embed-metadata --embed-thumbnail \
      --parse-metadata '%(title)s:%(meta_title)s' \
      --parse-metadata '%(uploader)s:%(meta_artist)s' \
      --parse-metadata '%(playlist)s:%(meta_album)s' \
      --parse-metadata '%(playlist_index)s:%(meta_track)s' \
      --download-archive "$DOSSIER/.archive.txt" \
      -P "$DOSSIER" \
      -o '%(playlist_index)03d - %(title)s.%(ext)s' \
      "$URL"; then
    ECHECS+=("$NOM")
  fi
done

# --- Résumé ------------------------------------------------------------------
echo
echo "=============================="
echo "Terminé : $((TOTAL - ${#ECHECS[@]}))/$TOTAL albums sans erreur."
if [ ${#ECHECS[@]} -gt 0 ]; then
  echo "Albums avec erreurs (relance le script pour réessayer) :"
  for e in "${ECHECS[@]}"; do echo "  - $e"; done
fi
