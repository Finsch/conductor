@echo off
rem conductor. - double-clic : trouve le telephone sur le cable USB et ouvre conductor.
rem (voir conductor-usb.ps1). Raccourci sur le bureau : clic droit > Envoyer vers > Bureau.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0conductor-usb.ps1"
