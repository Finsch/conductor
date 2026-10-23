@echo off
rem conductor. - a lancer UNE fois : le bouton " Demarrer la telecommande " de conductor.
rem lance alors le relais sans fenetre (lien conductor-remote://, pour votre compte Windows).
setlocal
set "VBS=%~dp0start-remote-hidden.vbs"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js est introuvable. Installez-le d'abord :
  echo     winget install OpenJS.NodeJS.LTS
  echo.
  pause
  exit /b 1
)

reg add "HKCU\Software\Classes\conductor-remote" /ve /d "URL:conductor remote" /f >nul
reg add "HKCU\Software\Classes\conductor-remote" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\conductor-remote\shell\open\command" /ve /d "wscript.exe \"%VBS%\"" /f >nul
if errorlevel 1 (
  echo   Echec de l'installation du bouton.
  pause
  exit /b 1
)
echo.
echo   OK : le bouton " Demarrer la telecommande " de conductor. marche maintenant.
echo   (Chrome demandera une fois d'ouvrir conductor-remote : cochez " Toujours autoriser ".)
echo.

set /p AUTO="  Lancer aussi la telecommande a chaque demarrage de Windows ? (o/n) "
if /i not "%AUTO%"=="o" goto fin
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\conductor-remote.vbs"
> "%STARTUP%" echo CreateObject("WScript.Shell").Run "wscript.exe ""%VBS%""", 0, False
echo   OK : lancee a chaque demarrage (sans fenetre). Pour annuler : supprimez
echo   "%STARTUP%"
:fin
echo.
pause
