@echo off
rem Point d'acces mobile du PC, meme sans internet (telecommande hors ligne).
rem   point-acces.bat        allume
rem   point-acces.bat stop   eteint
if /i "%~1"=="stop" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0point-acces.ps1" -Stop
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0point-acces.ps1"
)
