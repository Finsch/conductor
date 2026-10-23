@echo off
rem conductor. - relais de la telecommande (telephone -> PC). Laissez la fenetre ouverte.
rem Raccourci : clic droit > Envoyer vers > Bureau (ou menu Demarrer : voir le guide).
title conductor. - telecommande
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js est introuvable. Installez-le une fois :
  echo     winget install OpenJS.NodeJS.LTS
  echo   puis fermez et relancez ce raccourci.
  echo.
  pause
  exit /b 1
)
node "%~dp0relay.js"
pause
