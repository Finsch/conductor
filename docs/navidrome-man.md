# Navidrome sur le téléphone (Samsung A12) — mode d'emploi

Navidrome est un serveur musical. Il tourne sur le téléphone, dans l'appli Termux,
et sert vos fichiers MP3/FLAC à conductor. — sans copie sur le PC — en wifi, par
le point d'accès du téléphone, ou **par le câble USB, sans aucun réseau ni internet** (D).
Dans conductor., tout se passe dans la page **audio-files**.

Installation : une seule fois, 15 à 20 minutes (voir plus bas).

---

## Daily — écouter vos fichiers

### 1. A12 : lancer Navidrome

Termux :
```sh
~/navidrome.sh
```
Laissez Termux ouvert.

### 2. Trouver l'adresse du A12 — selon le réseau

**A. Même wifi (box, résidence)**
1. Termux → `ifconfig` → ligne `inet` (ex. `10.188.202.114`).
   Ignorez `127.0.0.1` et `192.0.0.4`.
2. Adresse à utiliser : `10.188.202.114:4533`

**B. Partage de connexion de l'iPhone** (PC et A12 connectés à l'iPhone)
1. A12 : Paramètres → Wi-Fi → ⚙️ du réseau → **IP address**.
2. Prenez l'adresse qui contient **`ff:fe`** (celle du milieu), ex. :
   `2a04:cec0:1014:6130:d0c0:a0ff:fe7c:e1e9`
   (ni celle en `fe80`, ni la 3ᵉ, temporaire).
   Si une adresse courte `172.20.10.x` apparaît, elle marche aussi : `172.20.10.x:4533`.
3. L'adresse change quand l'iPhone change de préfixe réseau : relevez-la à chaque session.

**C. Point d'accès du A12** (quand le wifi bloque, ou pas de wifi)
1. A12 : Paramètres → Connexions → **Point d'accès mobile** → activer.
2. PC : se connecter à ce point d'accès.
3. PC : Invite de commandes → `ipconfig` → **Passerelle par défaut** (souvent `192.168.43.1`).
4. Adresse à utiliser : `192.168.43.1:4533`
   La musique ne consomme pas de données ; internet sur le PC passe par les données du A12.

**D. Câble USB — 100 % hors ligne** (ni wifi, ni internet, ni données mobiles)
1. Branchez le A12 au PC avec un câble USB **de données** (pas un câble de charge seule).
2. A12 : Paramètres → Connexions → **Point d'accès mobile et modem** → activez **Modem USB**.
   (Grisé ? Le câble ne transporte pas de données, ou le PC ne voit pas encore le téléphone :
   rebranchez, et choisissez « Transfert de fichiers » si Android le demande.)
3. Pour être vraiment hors ligne : A12 → coupez les **Données mobiles** (le câble continue de marcher).
   Windows affichera « Pas d'accès Internet » sur cette connexion : c'est normal.
4. Trouvez l'adresse du A12 sur ce câble, au choix :
   - PC : Invite de commandes → `ipconfig` → la carte réseau nommée **« Remote NDIS… »**
     (ou « Ethernet 2/3… ») → **Passerelle par défaut**, ex. `192.168.42.129` ;
   - ou Termux → `ifconfig` → interface **`rndis0`** (ou `ncm0`, `usb0`) → ligne `inet`.
5. Adresse à utiliser : `192.168.42.129:4533` (avec la vôtre).
   Elle peut changer d'un branchement à l'autre : refaites l'étape 4 si le site ne la trouve plus.

**E. Câble USB sans carte SIM (ADB)** — quand « Modem USB » est grisé ou absent
(certains Samsung bloquent le partage de connexion sans SIM). Le câble transporte
Navidrome directement : ni SIM, ni wifi, ni données mobiles.

*Une seule fois :*
1. A12 : Paramètres → À propos du téléphone → Informations sur le logiciel →
   touchez **7 fois** « Numéro de version » : les **Options de développement** apparaissent.
2. Paramètres → Options de développement → activez **Débogage USB**.
3. PC : téléchargez les **SDK Platform-Tools** pour Windows (developer.android.com, gratuit)
   et décompressez le dossier dans `C:\platform-tools`.
4. Branchez le câble **de données**, puis Invite de commandes :
   ```
   C:\platform-tools\adb devices
   ```
   Sur le A12, acceptez « Autoriser le débogage USB » (cochez « Toujours autoriser »).
   La commande doit afficher une ligne terminée par `device`.
   (Rien ne s'affiche ? Installez le **Samsung USB Driver**, puis rebranchez.)

*À chaque branchement du câble :*
1. Invite de commandes :
   ```
   C:\platform-tools\adb forward tcp:4533 tcp:4533
   ```
2. Adresse à utiliser : `localhost:4533` (à ajouter une seule fois dans conductor.).
   Si elle ne répond plus (câble débranché, PC redémarré), relancez la commande.

> **Bon à savoir** : rien à changer dans Navidrome. Il écoute déjà sur toutes les connexions
> du téléphone (wifi et câble) ; seule l'adresse diffère.

### 3. PC : tester dans Chrome

```
http://10.188.202.114:4533                                  (A, C, D : adresse:4533)
http://[2a04:cec0:1014:6130:d0c0:a0ff:fe7c:e1e9]:4533       (B en IPv6 : avec crochets)
```
La page de connexion Navidrome s'affiche → passez à l'étape 4.

### 4. conductor. : se connecter

**audio-files**
- **Première fois** : Adresse (collez-la telle quelle — IPv6 sans crochets acceptée, port
  ajouté tout seul), utilisateur et mot de passe du compte Navidrome → **Se connecter**.
- **Ensuite, autre réseau** (câble USB, point d'accès…) : pas besoin de se reconnecter.
  Sous « Adresses du téléphone », tapez la nouvelle adresse → **Ajouter**. Elle est testée,
  puis gardée avec les autres.
- **Au quotidien** : conductor. essaie lui-même les adresses connues et prend celle qui
  répond — au démarrage, et si la musique s'arrête parce que le téléphone a changé de
  réseau (le morceau reprend au même endroit). Bouton **Détecter** pour forcer un essai.

### 5. Fin de session

Termux → `Ctrl` + `C`. Coupez le point d'accès (C) ou le Modem USB (D) si besoin. Avec E, débrancher le câble suffit.

### Si le test de l'étape 3 échoue

- **Sur le A12**, ouvrez `http://localhost:4533` :
  - rien ne s'affiche → Navidrome ne tourne pas : regardez Termux ;
  - ça s'affiche → c'est le réseau.
- **A (wifi)** : le wifi bloque les échanges entre appareils (fréquent en résidence) → passez en **C**.
- **B (iPhone, IPv6)** :
  1. PC → `ipconfig` → il doit y avoir une « Adresse IPv6 » qui commence comme celle du A12.
     Sinon : iPhone → Réglages → Partage de connexion → **Maximiser la compatibilité**,
     reconnectez le PC ; toujours rien → passez en **C**.
  2. L'IPv6 est là mais ça ne répond pas → forcez l'écoute IPv6 (une fois) :
     ```sh
     sed -i 's/^navidrome$/export ND_ADDRESS="::"\nnavidrome/' ~/navidrome.sh
     ~/navidrome.sh
     ```

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
« bail statique »). Impossible sur un partage de connexion ou le câble USB : relevez
alors la nouvelle adresse, puis audio-files → Adresses du téléphone → **Ajouter**
(inutile de se déconnecter). Les anciennes adresses peuvent rester : conductor. prend
celle qui répond. **Retirer** celles qui ne servent plus.

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
| Câble USB : « Modem USB » grisé | Câble de charge seule, ou téléphone pas encore reconnu : autre câble, rebranchez, « Transfert de fichiers ». |
| Câble USB : « Le téléphone ne répond pas à cette adresse » | Navidrome tourne-t-il ? Bonne adresse (passerelle de la carte « Remote NDIS ») ? Testez `http://adresse:4533` dans Chrome. |
| Le PC passe par le téléphone pour internet | Normal avec le Modem USB : coupez les données mobiles du A12 pour rester hors ligne. |
| « Utilisateur ou mot de passe incorrect » | Ce sont ceux créés à l'étape 8, pas ceux du téléphone. |
| « erreur du serveur : … » sur une page album | Message renvoyé par Navidrome ; « relier à vos fichiers » pour choisir l'album à la main. |
| Navidrome ne voit aucun album | Vérifiez `ND_MUSICFOLDER` avec `ls` (étape 4), puis relancez. |
| Un album est coupé en plusieurs morceaux | Tags différents entre pistes (voir « Bien taguer vos fichiers »). |
| Un album n'est pas relié automatiquement | Sur sa page : « relier à vos fichiers ». |
