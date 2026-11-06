# Télécommande — piloter conductor. depuis un téléphone

```
téléphone (Safari / Chrome)  ⇄  relais sur le PC (tools/remote, Node.js)  ⇄  conductor. (onglet du PC)
```

iPhone ou Android, sans appli à installer. Le téléphone qui pilote n'a pas besoin d'être celui qui
contient la musique. Version 1 : pochette, morceau, ⏯ ⏮ ⏭, ★, volume du PC,
gestes sur la pochette (← → titre, ↑ ↓ volume de l'appli). Synchronisé dans les deux sens.

---

## Une seule fois (PC)

1. **Node.js** : `winget install OpenJS.NodeJS.LTS` (Linux : `sudo apt install nodejs`, version 18+).
2. **Bouton** : double-clic sur `app/tools/remote/install-button.bat`, une fois. Le bouton
   **Démarrer la télécommande** de conductor. (icône téléphone du pied de page) lance alors le relais,
   sans fenêtre ; le script propose aussi de le lancer à chaque démarrage de Windows.
   Linux : `install-linux.sh`. Sans bouton : `start-remote.bat` (fenêtre à laisser ouverte).
3. Premier lancement : Windows demande d'autoriser Node.js sur le réseau → cochez **privés** et
   **publics** (le wifi de la résidence est souvent « public ») → **Autoriser**. Premier clic sur le
   bouton : Chrome demande d'ouvrir « conductor-remote » → **Toujours autoriser**.

## En 4G ou sur un autre wifi : Tailscale

Le téléphone en 4G n'est pas sur le réseau du PC, et les wifis de résidence isolent souvent les
appareils. **Tailscale** (gratuit, usage perso) crée un réseau privé entre vos appareils : connexion
directe et chiffrée, rien d'exposé sur internet, le téléphone garde son internet normal.

1. PC : `winget install tailscale.tailscale`, ouvrez Tailscale, connectez-vous.
2. Téléphone : appli **Tailscale**, **même compte**, activée (sur iPhone : un VPN à laisser actif).
3. Le relais affiche une adresse `http://100.…:8765` marquée « Tailscale ».

Sans internet, Tailscale ne marche pas : voir la section suivante.

## Sans internet du tout

Tout le système marche hors ligne : téléphone de musique en USB → conductor. → téléphone qui pilote.
Seul compte le lien entre le téléphone qui pilote et le PC.

| Élément | Sans internet |
|---|---|
| Téléphone de musique → PC (câble USB, Navidrome) | oui : le câble fait son propre réseau |
| conductor. sur le PC | oui (sauf ajout d'album par la recherche, paroles jamais chargées, extraits Deezer) |
| Relais + page de la télécommande | oui : tout est servi par le PC, rien n'est chargé depuis internet |
| Téléphone qui pilote → PC, **même wifi** | oui, tant que la box / le routeur est allumé (onglet **Wifi** du QR code) |
| Téléphone qui pilote → PC, **Tailscale** | **non** : Tailscale a besoin d'internet pour relier les appareils |
| Téléphone qui pilote → PC, **point d'accès du PC** | oui : voir ci-dessous |

### Point d'accès du PC (aucun wifi disponible)

Le PC crée son propre wifi, le téléphone qui pilote s'y connecte.

1. Branchez d'abord le téléphone de musique en USB (partage USB activé) : Windows a besoin d'une
   connexion à « partager », même sans internet.
2. **Paramètres → Réseau et Internet → Point d'accès mobile** → activez. Le nom et le mot de passe du
   wifi sont affichés là (modifiables).
   Si Windows refuse (« pas de connexion internet ») : double-clic sur
   `app/tools/remote/point-acces.bat`. Il allume le même point d'accès en partageant le câble USB.
   Pour l'éteindre : `point-acces.bat stop`, ou le même bouton des Paramètres.
3. iPhone : **Réglages → Wi-Fi** → le wifi du PC. iOS indique « Pas de connexion à internet » : c'est
   normal, restez connecté. Désactivez Tailscale s'il est allumé.
4. Sur le PC, `Alt + R` : l'onglet **Point d'accès du PC** est sélectionné (adresse `http://192.168.137.1:8765`,
   toujours la même). Scannez le QR code.

C'est une autre adresse que celle du wifi ou de Tailscale : l'iPhone la voit comme un autre site. Il faut
donc l'appairer une fois avec ce QR code, puis l'ajouter à l'écran d'accueil comme **2e icône**
(par exemple « conductor. hors ligne »). Comme l'adresse ne change jamais, cette icône resservira à chaque fois.

Le PC peut garder son wifi et faire point d'accès en même temps si sa carte le permet ; sinon, c'est l'un
ou l'autre.

**PC sous Linux** : `tools/remote/point-acces.sh` (NetworkManager) allume un wifi « conductor » (mot de
passe affiché, gardé pour les fois suivantes) ; adresse `http://10.42.0.1:8765`, onglet **Point d'accès du PC**.
`./point-acces.sh stop` l'éteint. La carte wifi quitte alors le wifi auquel elle était connectée.

## Téléphone Android

Tout marche comme sur iPhone, dans Chrome :

- **Appli** : menu **⋮** → **Ajouter à l'écran d'accueil**. Sans HTTPS, Chrome crée un raccourci qui peut
  ouvrir la page dans un onglet (avec la barre d'adresse) : c'est la même télécommande.
- **Bouton « retour »** : ferme la fenêtre ouverte (file, thoughts, collection) au lieu de quitter la page.
- **Écran allumé pendant les paroles** : même méthode que sur iPhone (vidéo silencieuse), en plein écran et
  invisible, car Chrome ne garde l'écran allumé que pour une vidéo visible. Pendant ce temps, Android peut
  afficher « conductor. » dans les notifications de lecture et mettre en pause une autre appli de musique.
- **Vibrations** : de légers retours au toucher (l'iPhone ne les a pas).
- **Point d'accès sans internet** : Réglages → Wi-Fi → le wifi du PC → « Rester connecté » si Android signale
  « Pas d'accès à internet ».

## Appairer (une fois par téléphone)

1. conductor. → icône **téléphone** du pied de page (→ **Démarrer la télécommande** si besoin) : un **QR code**.
   Plusieurs réseaux : choisissez l'onglet (Wifi, Tailscale…).
2. Téléphone : **appareil photo** sur le QR code → le lien → télécommande ouverte, déjà appairée.
   (Ou tapez l'adresse affichée, puis le code à 4 chiffres.)
3. En faire une appli : iPhone **Partager → Sur l'écran d'accueil** ; Android **⋮ → Ajouter à l'écran d'accueil**.
   L'icône s'ouvre en plein écran et retrouve le PC toute seule.

Le code et le QR code restent les mêmes ; **Nouveau code** les renouvelle et oublie les téléphones.
L'icône garde l'adresse du PC : si elle change (wifi de résidence), rescannez et refaites l'icône.
Avec Tailscale, l'adresse ne change pas.

## Piloter

| Geste / bouton | Effet |
|---|---|
| ⏯ ⏮ ⏭ | lecture / pause, titre précédent / suivant |
| ★ | morceau préféré |
| glisser ← → sur la pochette | titre suivant / précédent |
| glisser ↑ ↓ sur la pochette | volume de conductor., sur 20 |
| barre de lecture | glisser pour avancer / reculer (le temps visé s'affiche, la lecture y va au lâcher) ; un toucher y va directement |
| réglette **PC** | volume de Windows (Linux : pactl / amixer) |
| bulle (à côté du micro) | **thoughts** de l'album en cours : écrire une réflexion (morceau et seconde notés), relire, modifier, supprimer ; elles s'ajoutent à la page album et au journal du PC |
| grille → onglet **bacs** | tes bacs (A → Z ou récents) ; un bac : son intensité moyenne, un tri (les mêmes que sur le PC ; le glisser seulement dans « Ordre du bac »), ses albums (▶ / ≡+, × pour le retirer du bac, ⠿ à glisser pour réordonner) et une barre pour **ajouter un album de la collection** (titre ou artiste ; toucher le résultat, ou Entrée pour le premier). « retour » (Android) revient à la liste |
| grille (en haut) | **collection** : une barre de recherche (titre, artiste, genre, famille, label, styles, ressentis, tags ; « + » = et, « / » = ou, comme sur le PC), tous les tris du PC et les filtres intensité, décennies, genres (par famille, dépliables), avec le nombre d'albums sur chaque choix ; mêmes règles que la page collection du PC (fichier commun `js/collection-core.js`), sans pochettes ; ▶ lance l'album, ≡+ l'ajoute à la file. Tri et filtres retenus d'une fois sur l'autre |
| icône file (en haut, avec le nombre d'albums) | **file d'attente** : ▶ lancer un album tout de suite (le reste est gardé), × retirer, ⠿ glisser pour déplacer, « Vider la file » |
| micro (à côté de ★) | **paroles** à la place de la pochette : ligne chantée mise en avant, qui suit la musique ; toucher une ligne y amène la lecture ; l'écran du téléphone reste allumé tant que les paroles sont affichées |

Paroles : celles du karaoké du PC (enregistrées, fichiers `.lrc`, Navidrome, LRCLIB), synchronisées ou
simples. Le relais doit être relancé après la mise à jour qui les ajoute.

Sur le PC, `Alt + R` ouvre la fenêtre Télécommande (QR code).

## Au quotidien

PC : conductor. (relais lancé au démarrage, ou bouton **Démarrer la télécommande**). — Téléphone : l'icône
de l'écran d'accueil (Tailscale activé en 4G). Arrêter : icône téléphone → **Arrêter le relais**.

## Connexion : ce qui se passe tout seul

- **Changement de réseau** (wifi → 4G, sortie de veille) : une connexion qui ne répond plus est détectée
  en 7 s au plus (2,5 s au retour sur la page) et remplacée. Le point clignote, l'écran passe en retrait
  et affiche « reconnexion… ». Toucher l'état en haut relance un essai tout de suite.
- **Plusieurs adresses** : le téléphone retient toutes celles du PC (wifi, Tailscale, point d'accès). Si
  celle de son icône ne répond plus, il essaie les autres : icône « wifi » ouverte en 4G → bascule sur
  Tailscale, affiché « · via Tailscale » en haut. Seule limite : la page doit déjà être ouverte (si
  l'iPhone l'a fermée, elle se recharge depuis l'adresse de l'icône).
- **Commandes pendant une coupure** (⏯, ⏭, volume, ajout à la file…) : gardées 8 s et envoyées dès
  la reconnexion.
- **conductor. rechargé sur le PC** : le relais attend 5 s avant d'annoncer « conductor. fermé » ; les
  commandes faites entre-temps sont appliquées au retour.
- **Relais redémarré** : conductor. le retrouve en 10 s au plus (tout de suite en revenant sur sa fenêtre).

## En cas de problème

| Problème | Solution |
|---|---|
| La page ne s'ouvre pas | Relais lancé ? Bonne adresse ? Pare-feu : autorisez Node.js. Wifi de résidence : adresse Tailscale |
| Sans internet, la page ne s'ouvre pas | Tailscale ne marche pas hors ligne : même wifi, ou point d'accès du PC (onglet **Point d'accès du PC**) |
| Point d'accès : « pas de connexion internet » | `tools/remote/point-acces.bat` (téléphone de musique branché en USB avant). Linux : `point-acces.sh` |
| « conductor. fermé sur le PC » | Ouvrez conductor. (il se relie tout seul) |
| « Démarrer la télécommande » ne fait rien | `install-button.bat` une fois ; Node.js installé ; erreurs dans `tools/remote/relay-errors.log` |
| « Code incorrect » / « QR code périmé » | Code renouvelé : scannez le QR code actuel ; 5 erreurs → 30 s d'attente |
| Pas de réglette PC | Windows : relancez le relais. Linux : `pulseaudio-utils` ou `alsa-utils` |
| « Port 8765 déjà utilisé » | Le relais tourne déjà : une seule fenêtre |
| Retirer un téléphone | Sur le téléphone : icône en haut à droite. Tous : supprimez `tools/remote/.remote-tokens.json` |

## Sous le capot

- `tools/remote/relay.js` : serveur HTTP + WebSocket (port 8765, `CONDUCTOR_REMOTE_PORT` pour en changer),
  sans dépendance. conductor. s'y connecte en « hôte » depuis le PC seulement ; les téléphones avec un jeton
  (obtenu avec le code). Pochette servie par le relais (fichier local ou téléphone Navidrome).
- `js/remote-link.js` : côté conductor., envoie l'état du lecteur et exécute les commandes.

## La suite (prévue)

Le reste : écran verrouillé…
