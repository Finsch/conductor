# conductor. — ouvrir conductor. avec l'adresse du téléphone sur le câble USB
#
# 1. Cherche la carte « Remote NDIS » (Modem USB activé sur le téléphone) et prend
#    sa passerelle par défaut = l'adresse du téléphone (elle change à chaque branchement).
# 2. Sinon, si ADB est installé (C:\platform-tools) et le téléphone branché en débogage USB :
#    redirige les ports 4533 (Navidrome) et 8022 (WinSCP) → adresse « localhost ».
# 3. Copie l'adresse (pour WinSCP), puis ouvre conductor.html?usb=<adresse> dans le navigateur.
#
# Navigateur : laissez vide pour Chrome (sinon Edge), ou mettez "chrome" / "msedge".
$Browser = ""
$Adb = "C:\platform-tools\adb.exe"

$ErrorActionPreference = "SilentlyContinue"
$App = Split-Path -Parent $PSScriptRoot
$Page = Join-Path $App "conductor.html"

function Get-UsbGateway {
  $c = Get-NetIPConfiguration | Where-Object {
    $_.InterfaceDescription -like "Remote NDIS*" -and $_.IPv4DefaultGateway
  } | Select-Object -First 1
  if ($c) { return $c.IPv4DefaultGateway[0].NextHop }
  return $null
}

Write-Host ""
Write-Host "  conductor. - telephone par cable USB" -ForegroundColor White
Write-Host ""

$addr = $null
$mode = ""
for ($i = 0; $i -lt 20 -and -not $addr; $i++) {
  $addr = Get-UsbGateway
  if ($addr) { $mode = "Modem USB"; break }
  if (Test-Path $Adb) {
    $state = (& $Adb get-state 2>$null) | Out-String
    if ($state.Trim() -eq "device") {
      & $Adb forward tcp:4533 tcp:4533 | Out-Null
      & $Adb forward tcp:8022 tcp:8022 | Out-Null
      $addr = "localhost"; $mode = "ADB"; break
    }
  }
  if ($i -eq 0) {
    Write-Host "  Telephone pas encore trouve sur le cable." -ForegroundColor Yellow
    Write-Host "  Branchez le cable et activez Modem USB (USB tethering) sur le telephone..."
  }
  Start-Sleep -Seconds 1
}

if (-not $addr) {
  Write-Host ""
  Write-Host "  Aucun telephone sur le cable apres 20 s." -ForegroundColor Red
  Write-Host "  - Modem USB active (bouton bleu) ?"
  Write-Host "  - Cable de donnees (le telephone apparait dans l'Explorateur avant d'activer Modem USB) ?"
  Write-Host "  - Option ADB : debogage USB active et adb dans C:\platform-tools ?"
  Write-Host ""
  Read-Host "  Entree pour fermer"
  exit 1
}

Set-Clipboard -Value $addr
Write-Host "  Telephone trouve ($mode) : $addr" -ForegroundColor Green
Write-Host "  - Navidrome : ${addr}:4533"
Write-Host "  - WinSCP    : hote $addr, port 8022 (adresse copiee, Ctrl+V)"

# Navidrome repond-il ?
try {
  Invoke-WebRequest -Uri "http://${addr}:4533/ping" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop | Out-Null
} catch {
  if (-not $_.Exception.Response) {
    Write-Host ""
    Write-Host "  Navidrome ne repond pas encore : lancez ~/navidrome.sh dans Termux." -ForegroundColor Yellow
  }
}

# Navigateur
$candidates = @()
if ($Browser -ne "msedge") {
  $candidates += "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
                 "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
                 "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
}
if ($Browser -ne "chrome") {
  $candidates += "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
                 "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
}
$exe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

$url = "file:///" + ($Page -replace "\\", "/" -replace " ", "%20") + "?usb=" + [uri]::EscapeDataString("${addr}:4533")
if ($exe) { Start-Process -FilePath $exe -ArgumentList $url }
else { Write-Host "  Chrome / Edge introuvable : ouvrez $url" -ForegroundColor Yellow }

Write-Host ""
Start-Sleep -Seconds 4
