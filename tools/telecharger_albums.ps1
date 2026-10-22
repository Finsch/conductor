# Télécharge chaque album dans son propre dossier "Artiste - Album (Année)".
# Usage : .\telecharger_albums.ps1 [-Destination "C:\chemin\vers\dossier"]
#         (par défaut : .\Albums)

# powershell -ExecutionPolicy Bypass -File .\telecharger_albums.ps1

param(
    [string]$Destination = ".\Albums"
)

# Affichage correct des accents dans la console
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"

# --- Vérifications -----------------------------------------------------------
foreach ($cmd in @("yt-dlp", "ffmpeg")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "Erreur : '$cmd' n'est pas installé ou introuvable dans le PATH." -ForegroundColor Red
        exit 1
    }
}

# --- Liste des albums --------------------------------------------------------
# (caractères interdits dans les noms de fichiers comme : ? / déjà remplacés)
$Albums = @(
    @{ Nom = "The Mothers of Invention - Absolutely Free (1967)"; Url = "https://youtube.com/playlist?list=PLHDLoOm3xu5je6sTMnZHAk2ish5FGU07J&si=1MFL40SQ4_MLGwrx" }
    @{ Nom = "The Mamas & the Papas - If You Can Believe Your Eyes and Ears (1966)"; Url = "https://youtube.com/playlist?list=PL01007654EEE0C30C&si=P8ZVGdPbElQeCLTc" }
)

# --- Téléchargement ----------------------------------------------------------
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$Echecs = @()
$Total  = $Albums.Count
$N      = 0

foreach ($Album in $Albums) {
    $N++
    $Dossier = Join-Path $Destination $Album.Nom
    New-Item -ItemType Directory -Force -Path $Dossier | Out-Null

    Write-Host ""
    Write-Host "=== [$N/$Total] $($Album.Nom) ===" -ForegroundColor Cyan

    # --download-archive : si tu relances le script, les pistes déjà
    # téléchargées sont ignorées (reprise après coupure).
    $Arguments = @(
        '-x', '--audio-format', 'mp3', '--audio-quality', '0',
        '--embed-metadata', '--embed-thumbnail',
        '--parse-metadata', '%(title)s:%(meta_title)s',
        '--parse-metadata', '%(uploader)s:%(meta_artist)s',
        '--parse-metadata', '%(playlist)s:%(meta_album)s',
        '--parse-metadata', '%(playlist_index)s:%(meta_track)s',
        '--download-archive', (Join-Path $Dossier '.archive.txt'),
        '-P', $Dossier,
        '-o', '%(playlist_index)03d - %(title)s.%(ext)s',
        $Album.Url
    )

    & yt-dlp @Arguments
    if ($LASTEXITCODE -ne 0) {
        $Echecs += $Album.Nom
    }
}

# --- Résumé ------------------------------------------------------------------
Write-Host ""
Write-Host "=============================="
Write-Host "Terminé : $($Total - $Echecs.Count)/$Total albums sans erreur." -ForegroundColor Green
if ($Echecs.Count -gt 0) {
    Write-Host "Albums avec erreurs (relance le script pour réessayer) :" -ForegroundColor Yellow
    $Echecs | ForEach-Object { Write-Host "  - $_" }
}
