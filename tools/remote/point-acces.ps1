# Point d'accès mobile du PC, même sans internet (pour la télécommande hors ligne).
#
# Le bouton « Point d'accès mobile » des Paramètres Windows refuse souvent de s'allumer quand le PC
# n'a pas internet. Ce script passe par la même fonction de Windows, mais en partageant n'importe
# quelle connexion active : le câble USB du téléphone (Ethernet 3), un wifi sans internet…
#
# Usage : double-clic sur point-acces.bat (ou : powershell -ExecutionPolicy Bypass -File point-acces.ps1 [-Stop])
# Le nom et le mot de passe du wifi sont ceux des Paramètres > Réseau et Internet > Point d'accès mobile.

param([switch]$Stop)
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
function Await($op, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}

$null = [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime]
$null = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime]
$resultType = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult]

# La connexion à partager : celle qui a internet, sinon n'importe quelle connexion active
$conn = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
if (-not $conn) {
  $conn = [Windows.Networking.Connectivity.NetworkInformation]::GetConnectionProfiles() |
    Where-Object { [int]$_.GetNetworkConnectivityLevel() -ge 1 } | Select-Object -First 1
}
if (-not $conn) {
  Write-Host ""
  Write-Host "Aucune connexion active a partager." -ForegroundColor Yellow
  Write-Host "Branchez le telephone en USB avec le partage de connexion USB active (ou connectez un wifi), puis relancez."
  Write-Host ""
  Read-Host "Entree pour fermer"
  exit 1
}

$tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($conn)

if ($Stop) {
  $r = Await ($tm.StopTetheringAsync()) $resultType
  Write-Host "Point d'acces arrete ($($r.Status))."
  Start-Sleep -Seconds 2
  exit 0
}

$cfg = $tm.GetCurrentAccessPointConfiguration()
if ($tm.TetheringOperationalState -ne "On") {
  Write-Host "Allumage du point d'acces (partage de : $($conn.ProfileName))..."
  $r = Await ($tm.StartTetheringAsync()) $resultType
  if ($r.Status -ne "Success") {
    Write-Host ""
    Write-Host "Echec : $($r.Status) $($r.AdditionalErrorMessage)" -ForegroundColor Yellow
    Write-Host "Wifi du PC desactive ? Mode avion ? Essayez aussi Parametres > Reseau et Internet > Point d'acces mobile."
    Write-Host ""
    Read-Host "Entree pour fermer"
    exit 1
  }
}

Write-Host ""
Write-Host "Point d'acces allume." -ForegroundColor Green
Write-Host "  Wifi         : $($cfg.Ssid)"
Write-Host "  Mot de passe : $($cfg.Passphrase)"
Write-Host "  Telecommande : http://192.168.137.1:8765  (Alt + R dans conductor., onglet 'Point d'acces du PC')"
Write-Host ""
Write-Host "Pour l'arreter : point-acces.bat stop (ou Parametres > Point d'acces mobile)."
Write-Host ""
Read-Host "Entree pour fermer (le point d'acces reste allume)"
