# conductor. sous Linux

Le site marche pareil sous Linux : c'est une page ouverte dans le navigateur. Seuls les outils
autour changent (scripts `.sh` au lieu de `.bat` / `.ps1`, `ip route` au lieu d'`ipconfig`…).
Testé pour Ubuntu / Debian, Fedora, Arch (commandes `apt`, `dnf`, `pacman`).

---

## 1. Installer

1. **Navigateur** : **Google Chrome**, **Chromium** ou **Edge** (Firefox ne sait pas écrire dans `datastorage`).
   - Chromium en **snap** (Ubuntu) ou **Flatpak** : gardez `conductor/` dans votre dossier personnel.
     Sur un disque externe (`/media/…`) avec le snap : `sudo snap connect chromium:removable-media`.
2. **Raccourcis** (une seule fois) :
   ```sh
   bash ~/conductor/app/tools/install-linux.sh
   ```
   Rend les scripts exécutables et ajoute **conductor.** et **conductor USB** au menu des applications
   (et **conductor USB** sur le bureau). Le premier navigateur trouvé est utilisé.
3. Ouvrez **conductor.** (menu des applications, ou `app/index.html` dans Chrome), puis en bas à gauche :
   **Choisir le dossier datastorage** → `conductor/datastorage`.

Touches multimédia et commandes de lecture du bureau (GNOME, KDE…) : comme sous Windows, par MPRIS.

## 2. Téléphone par câble USB

NetworkManager connecte tout seul le **Modem USB** du téléphone (connexion filaire « Wired connection 2 »,
interface `usb0` ou `enx…`).

- **Raccourci** : **conductor USB** (menu ou bureau) = `tools/conductor-usb.sh`. Il trouve l'adresse du
  téléphone, la copie (si `wl-copy`, `xclip` ou `xsel` est installé), prévient si Navidrome ne répond pas,
  et ouvre conductor. avec. Navigateur imposé : `BROWSER_CMD=chromium tools/conductor-usb.sh`.
- **À la main** : la passerelle de l'interface USB est l'adresse du téléphone.
  ```sh
  ip -4 route | grep -E 'dev (usb|enx|rndis)'
  # default via 192.168.36.250 dev enx2a84fea48ee3 …   → adresse : 192.168.36.250:4533
  ```
- **Option E (ADB)**, sans Modem USB :
  ```sh
  sudo apt install adb              # Fedora : sudo dnf install android-tools · Arch : sudo pacman -S android-tools
  adb devices                       # acceptez « Autoriser le débogage USB » sur le téléphone
  adb forward tcp:4533 tcp:4533     # puis adresse : localhost:4533
  ```
  `no permissions` : Debian / Ubuntu → `sudo apt install android-sdk-platform-tools-common`, débranchez, rebranchez.
  Le raccourci **conductor USB** fait aussi les `adb forward` (4533 et 8022).

## 3. Au quotidien

Comme `daily-tel-usb.md` : câble, **Modem USB**, widget **conductor** sur le téléphone, **conductor USB**
sur le PC. Pour arrêter : fermez conductor., widget **conductor-stop**, débranchez.

**Télécommande** : `tools/remote/start-remote.sh` (Node.js), puis `Alt + R` pour le QR code ;
le volume du PC passe par `pactl` (ou `amixer`). Détails dans `telecommande.md`.

## 4. Envoyer de la musique vers le téléphone

Le téléphone fait tourner `sshd` (widget **conductor**, ou `sshd` dans Termux ; voir `navidrome-man.md`).
Pas besoin de WinSCP :

- **Gestionnaire de fichiers** (Fichiers / Nautilus : *Autres emplacements* → *Connexion à un serveur* ;
  Dolphin : barre d'adresse) :
  ```
  sftp://u0_a123@192.168.36.250:8022/storage/emulated/0/Music
  ```
  (utilisateur de `whoami`, mot de passe de `passwd`), puis glissez vos dossiers d'albums.
- **FileZilla** : hôte `sftp://192.168.36.250`, port `8022`.
- **Terminal** :
  ```sh
  scp -P 8022 -r "Albums/Artiste - Album (1971)" u0_a123@192.168.36.250:/storage/emulated/0/Music/
  ```

## 5. De YouTube à conductor.

Même parcours que `youtube-a-conductor.md`, avec ces équivalents :

| Windows | Linux |
|---|---|
| `winget install yt-dlp.yt-dlp` | `pipx install yt-dlp` (les paquets des distributions sont souvent trop vieux) · mise à jour : `pipx upgrade yt-dlp` |
| `winget install Gyan.FFmpeg` | `sudo apt install ffmpeg` (dnf / pacman) |
| `tools/telecharger_albums.ps1` | `tools/telecharger_albums.sh [dossier]` — albums dans le tableau `ALBUMS`, une ligne `"Nom|adresse"` |
| TagScanner | **Kid3** (`sudo apt install kid3-qt`, ou Flatpak) — ou MusicBrainz Picard ; TagScanner marche aussi sous Wine |
| WinSCP | gestionnaire de fichiers en `sftp://`, FileZilla ou `scp` (partie 4) |

Dans Kid3 : sélectionnez toutes les pistes, remplissez Artist, Album Artist, Album, Date (année) ;
numéros depuis le nom de fichier : bouton **From Filename** (Depuis le nom de fichier), format `%{track} - %{title}` ;
**Enregistrer**.

## En cas de problème

| Problème | Solution |
|---|---|
| `Permission non accordée` en lançant un `.sh` | `bash tools/install-linux.sh` (ou `chmod +x tools/*.sh`) |
| `bad interpreter: /bin/bash^M` | Fichier passé par Windows en fins de ligne CRLF : `sed -i 's/\r$//' tools/*.sh` |
| Le raccourci du bureau ne se lance pas (GNOME) | Clic droit → **Autoriser le lancement** |
| conductor. n'ouvre pas `datastorage` sur un disque externe | Chromium snap : `sudo snap connect chromium:removable-media`, ou déplacez `conductor/` dans votre dossier personnel |
| Aucun téléphone sur le câble | Modem USB activé ? `ip -4 route` montre-t-il une ligne `usb…` / `enx…` ? Câble de données ? |
