# De YouTube à conductor. — le parcours complet

```
YouTube → yt-dlp (script) → TagScanner (tags) → WinSCP (envoi) → Navidrome (téléphone) → câble USB → conductor.
```

Chaque maillon a son guide (`navidrome-man.md`, et les manuels intégrés au site) ; celui-ci les met bout à bout.
En pratique, Navidrome et le câble USB sont lancés juste avant l'envoi : WinSCP passe par le même câble.

---

## Une seule fois (PC)

1. **yt-dlp et ffmpeg** — dans PowerShell, puis fermez et rouvrez la fenêtre :
   ```
   winget install yt-dlp.yt-dlp
   winget install Gyan.FFmpeg
   ```
   Vérifiez : `yt-dlp --version`, `ffmpeg -version`. Mise à jour de yt-dlp : `yt-dlp -U`.
2. **TagScanner** — gratuit, sur `xdlab.ru`. Corrige les tags de plusieurs fichiers d'un coup.
3. **WinSCP, Navidrome, raccourcis** — voir `navidrome-man.md` (envoi WinSCP, raccourci
   `tools/conductor-usb.bat`, widget Termux).

## Pour chaque lot d'albums

1. **YouTube** — la playlist de l'album, idéalement d'une chaîne « *Artiste* - Topic » ou de YouTube Music
   (pistes officielles, dans l'ordre). Copiez son adresse (`…playlist?list=…`).
2. **Script** — `app/tools/telecharger_albums.ps1` dans le Bloc-notes, une ligne par album dans `$Albums` :
   ```powershell
   @{ Nom = "Artiste - Album (1971)"; Url = "https://youtube.com/playlist?list=…" }
   ```
   `Nom` = le dossier créé, sans `? / \ : * " < > |`. Gardez l'encodage UTF-8 (avec BOM).
3. **yt-dlp** — télécharger :
   ```
   cd D:\GOLF\conductor\app\tools
   powershell -ExecutionPolicy Bypass -File .\telecharger_albums.ps1 -Destination "D:\Musique\Albums"
   ```
   MP3 meilleure qualité, pochette et tags intégrés, fichiers `001 - Titre.mp3`.
   Relancer reprend où ça s'est arrêté (`.archive.txt`).
4. **TagScanner** — les tags de YouTube sont approximatifs (artiste = chaîne, album = nom de la playlist,
   pas d'année). Ouvrez le dossier, onglet **Tag Editor**, sélectionnez **toutes** les pistes :
   - **Artist**, **Album Artist** (sans « feat. »), **Album**, **Year** (et **Genre**) pour toutes à la fois ;
   - **Track #** : déjà rempli ; sinon **Tag Processor** → *Filename → Tag*, modèle `%track% - %title%` ;
   - titres : retirez « (Official Audio) », « - Remastered »… ;
   - **Cover** : remplacez la miniature YouTube par une vraie pochette carrée si besoin ;
   - **Save**.

   Navidrome ne regroupe un album que si toutes ses pistes ont le même Album, Album Artist et année.
5. **Téléphone** — widget **conductor** (ou `~/navidrome.sh`) : Navidrome + serveur d'envoi.
6. **Réseau USB** — câble, **Modem USB**, double-clic sur **conductor-usb** : adresse trouvée, copiée,
   conductor. ouvert avec.
7. **WinSCP** — SFTP, adresse collée, port 8022 ; glissez les dossiers d'albums dans le dossier musique
   du téléphone.
8. **conductor.** — **audio-files** → **Actualiser** → « sur le téléphone, pas encore dans la collection » :
   ajoutez les albums (collection ou next up).

## En cas de problème

| Problème | Solution |
|---|---|
| « 'yt-dlp' n'est pas installé ou introuvable » | Installez-le, puis fermez et rouvrez PowerShell (idem ffmpeg) |
| « l'exécution de scripts est désactivée » | `powershell -ExecutionPolicy Bypass -File .\telecharger_albums.ps1` |
| yt-dlp : « Sign in » ou « HTTP Error 403 » | `yt-dlp -U`, puis relancez |
| Accents bizarres | Script enregistré en **UTF-8 avec BOM** (Bloc-notes → Enregistrer sous → Encodage) |
| Album coupé en plusieurs dans Navidrome | Une piste a un tag différent : corrigez-la dans TagScanner et renvoyez-la |
