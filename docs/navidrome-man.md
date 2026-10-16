# Navidrome sur le téléphone (Samsung A12) — mode d'emploi

Navidrome est un serveur musical. Il tourne sur le téléphone, dans l'appli Termux,
et sert vos fichiers MP3/FLAC en wifi à conductor. — sans copie sur le PC.
Dans conductor., tout se passe dans la page **audio-files**.

Installation : une seule fois, 15 à 20 minutes (voir plus bas).

---

## Daily — écouter vos fichiers

### 1. Lancer le serveur (A12)

Termux → `~/navidrome.sh` → laissez Termux ouvert.

### 2. Choisir le réseau

**A. Même wifi** (box, résidence) — PC et A12 connectés au même réseau
1. Adresse du A12 : Termux → `ifconfig` → ligne `inet` de `wlan0`
   (ex. `10.188.202.114`). Ignorez `127.0.0.1` et `192.0.0.4`.
2. Test sur le PC : `http://10.188.202.114:4533` dans Chrome → la page Navidrome s'affiche.
3. Si rien ne s'affiche : ouvrez `http://localhost:4533` **sur le A12**.
   - Ça marche sur le A12, pas sur le PC → le wifi bloque les échanges entre appareils
     (fréquent en résidence) → passez au cas B.
   - Rien non plus sur le A12 → Navidrome ne tourne pas : regardez Termux.

**B. Point d'accès du A12** — quand le wifi bloque ou qu'il n'y a pas de wifi
1. A12 : Paramètres → Connexions → **Point d'accès mobile** → activer.
2. PC : se connecter à ce point d'accès.
3. PC : Invite de commandes → `ipconfig` → **Passerelle par défaut** = adresse du A12
   (souvent `192.168.43.1`).
4. Test : `http://192.168.43.1:4533` dans Chrome.

La musique ne consomme pas de données ; la navigation internet du PC passe en revanche
par les données mobiles du A12.

**C. Partage de connexion de l'iPhone** — PC et A12 connectés à l'iPhone
1. Adresse du A12 : Paramètres → Wi-Fi → ⚙️ → **Adresse IP**
   (`172.20.10.x`, ou seulement des adresses IPv6 : voir étape 7 plus bas).
2. Test : `http://172.20.10.x:4533` dans Chrome.
3. Ne s'affiche pas : iPhone → Réglages → Partage de connexion → « Maximiser la compatibilité ».

### 3. Connecter conductor.

conductor. → **audio-files**
- **Même adresse que la dernière fois** : rien à faire, ou **Actualiser**.
- **Adresse différente** : **Déconnecter** → adresse (`xxx:4533`), utilisateur,
  mot de passe Navidrome → **Se connecter**.

### 4. Fin de session

Termux → `Ctrl` + `C` (ou « Exit » dans la notification). Coupez le point d'accès si vous l'aviez activé.

---

# Installation (une seule fois)

## 1. Installer Termux

1. Installez **F-Droid** depuis https://f-droid.org.
2. Dans F-Droid, installez **Termux**.
   ⚠️ Pas la version du Play Store : elle n'est plus à jour.
3. Ouvrez Termux : c'est là qu'on tape les commandes (puis Entrée).

## 2. Préparer Termux

```sh
pkg update && pkg upgrade
termux-setup-storage
```

La 2ᵉ commande ouvre une fenêtre Android : acceptez (accès à vos fichiers).

## 3. Installer Navidrome

```sh
pkg install navidrome
```

ffmpeg et taglib (lecture des métadonnées) sont installés avec.

## 4. Trouver le dossier de votre musique

```sh
ls ~/storage/shared/Music
```

Vos albums s'affichent ? Le dossier est `~/storage/shared/Music`.
- Ailleurs dans le téléphone : explorez avec `ls ~/storage/shared`.
- Sur la **carte SD** : `ls /storage` → la carte apparaît sous un nom comme `1A2B-3C4D`,
  le dossier sera `/storage/1A2B-3C4D/Music`.

## 5. Créer le script de démarrage

(Adaptez la ligne `ND_MUSICFOLDER` si besoin.)

```sh
cat > ~/navidrome.sh <<'EOF'
termux-wake-lock
export ND_MUSICFOLDER="$HOME/storage/shared/Music"
export ND_DATAFOLDER="$HOME/navidrome-data"
export ND_PORT=4533
mkdir -p "$ND_DATAFOLDER"
navidrome
EOF
chmod +x ~/navidrome.sh
```

`termux-wake-lock` empêche Android d'endormir Termux pendant que le serveur tourne.

## 6. Lancer / arrêter Navidrome

- Lancer : `~/navidrome.sh` (laissez Termux ouvert ; vous pouvez revenir à l'accueil,
  une notification Termux reste affichée).
- Arrêter : `Ctrl` + `C` dans Termux (bouton CTRL au-dessus du clavier), ou « Exit » dans la notification.

La première fois, Navidrome analyse toute votre musique : plusieurs minutes sur le A12.

## 7. Trouver l'adresse du téléphone

Paramètres Android → Connexions → Wi-Fi → ⚙️ à côté du réseau → **Adresse IP**.

**Cas 1 — une adresse courte (IPv4)**, ex. `192.168.1.23` ou `172.20.10.3`
→ adresse du serveur : `192.168.1.23:4533`

**Cas 2 — uniquement des adresses longues (IPv6)**, ex. `2a04:cec0:…`
C'est le cas sur votre réseau actuel (réseau « IPv6 seulement »).
- Prenez l'adresse qui contient **`ff:fe`** (elle ne change pas sur ce réseau).
  N'utilisez ni celle qui commence par `fe80`, ni l'autre adresse `2a04:…` (temporaire).
- Dans le navigateur, l'adresse IPv6 se met **entre crochets** :
  `http://[2a04:cec0:1011:6130:d0c0:a0ff:fe7c:e1e9]:4533`
- Dans conductor., vous pouvez la coller telle quelle : crochets et port sont ajoutés tout seuls.
- `ifconfig` dans Termux affiche `v4-wlan0 … 192.0.0.4` : ce n'est **pas** une adresse utilisable
  (passerelle interne d'Android).

## 8. Créer votre compte Navidrome

Sur le PC (même réseau), ouvrez l'adresse du serveur dans le navigateur
(ex. `http://192.168.1.23:4533`). Navidrome demande de créer le premier compte :
choisissez un utilisateur et un mot de passe.

## 9. Connecter conductor.

conductor. → **audio-files** → adresse, utilisateur, mot de passe → **Se connecter**.
Le mot de passe n'est pas enregistré : le site garde seulement un jeton dérivé.

---

## Au quotidien

**Empêcher Android de couper Termux** : Paramètres → Applications → Termux → Batterie → **Non restreinte**.

**Adresse qui change** : réservez une adresse fixe au A12 dans la box (réglages DHCP,
« bail statique »). Impossible sur un partage de connexion : relevez alors l'adresse
à chaque session, puis audio-files → Déconnecter → reconnectez-vous.

**Partage de connexion de l'iPhone** : ça marche, le PC et le A12 se voient.
- La musique (A12 → PC) ne consomme pas votre forfait ; les recherches en ligne et les pochettes, si.
- PC ou A12 ne voit pas le partage : iPhone → Réglages → Partage de connexion → « Maximiser la compatibilité ».
- L'iPhone coupe le partage quand plus rien n'y est connecté : réactivez-le si besoin.

**Nouvelle musique sur le téléphone** : Navidrome la détecte seul en quelques minutes,
puis conductor. → audio-files → **Actualiser**.

**Batterie** : branchez le A12 pendant les longues écoutes.

**Sécurité** : Navidrome n'est joignable que sur votre réseau local. Pas de redirection de port sur la box.

---

## Bien taguer vos fichiers

Navidrome regroupe les pistes d'un album seulement si **toutes** ont :
- le même **Album** (même orthographe, mêmes espaces) ;
- le même **Album Artist** (ex. `Damso`, sans « feat. ») ;
- la même **année / date**.

Une seule piste différente suffit à couper l'album en deux (ex. « UTOPIA 18 + 1 »).
conductor. réunit ces morceaux automatiquement (« réuni (18 + 1) » dans audio-files),
mais corriger les tags (avec une appli d'édition de tags sur Android) rend tout propre partout.

Ce que conductor. utilise aussi dans vos fichiers :
- **numéros de piste et de disque** : ordre et numérotation (`2-01` pour un 2ᵉ disque) ;
- **pochette intégrée** : bouton « Pochette de vos fichiers » dans « Modifier la fiche » ;
- **paroles intégrées** (tag USLT / LYRICS) : affichées en priorité sous « paroles ».

---

## En cas de problème

| Symptôme | Piste |
|---|---|
| `pkg install navidrome` : paquet introuvable | Refaites `pkg update` ; vérifiez que Termux vient de F-Droid. |
| « serveur injoignable » | Navidrome tourne-t-il dans Termux ? PC et A12 sur le même réseau ? Adresse changée ? Lien « réessayer » sur la page album. |
| La page Navidrome ne s'ouvre pas en IPv6 | `ipconfig` sur le PC doit montrer une « Adresse IPv6 » commençant comme celle du A12. Sinon, ajoutez `export ND_ADDRESS="::"` dans `~/navidrome.sh` (avant `navidrome`) et relancez. |
| « Utilisateur ou mot de passe incorrect » | Ce sont ceux créés à l'étape 8, pas ceux du téléphone. |
| « erreur du serveur : … » sur une page album | Message renvoyé par Navidrome ; « relier à vos fichiers » pour choisir l'album à la main. |
| Navidrome ne voit aucun album | Vérifiez `ND_MUSICFOLDER` avec `ls` (étape 4), puis relancez. |
| Un album est coupé en plusieurs morceaux | Tags différents entre pistes (voir « Bien taguer vos fichiers »). |
| Un album n'est pas relié automatiquement | Sur sa page : « relier à vos fichiers ». |
