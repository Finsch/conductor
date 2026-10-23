' conductor. - lance le relais de la telecommande sans fenetre (journal : relay.log)
' Utilise par le bouton " Demarrer la telecommande " de conductor. (lien conductor-remote://)
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "cmd /c node """ & dir & "\relay.js"" --log 2>> """ & dir & "\relay-errors.log""", 0, False
