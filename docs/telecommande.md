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

Sans internet (point d'accès du PC, partage de l'iPhone, même wifi) : l'adresse locale suffit.

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
| réglette **PC** | volume de Windows (Linux : pactl / amixer) |
| bulle (à côté du micro) | **thoughts** de l'album en cours : écrire une réflexion (morceau et seconde notés), relire, modifier, supprimer ; elles s'ajoutent à la page album et au journal du PC |
| loupe (en haut) | **catalogue** : une seule barre de recherche (titre, artiste, genre, style, ressenti, label, année… tous les mots doivent correspondre) ; ▶ lance l'album (la file est gardée), ≡+ l'ajoute à la file |
| icône file (en haut, avec le nombre d'albums) | **file d'attente** : ▶ lancer un album tout de suite (le reste est gardé), × retirer, ⠿ glisser pour déplacer, « Vider la file » |
| micro (à côté de ★) | **paroles** à la place de la pochette : ligne chantée mise en avant, qui suit la musique ; toucher une ligne y amène la lecture |

Paroles : celles du karaoké du PC (enregistrées, fichiers `.lrc`, Navidrome, LRCLIB), synchronisées ou
simples. Le relais doit être relancé après la mise à jour qui les ajoute.

Sur le PC, `Alt + R` ouvre la fenêtre Télécommande (QR code).

## Au quotidien

PC : conductor. (relais lancé au démarrage, ou bouton **Démarrer la télécommande**). — Téléphone : l'icône
de l'écran d'accueil (Tailscale activé en 4G). Arrêter : icône téléphone → **Arrêter le relais**.

## En cas de problème

| Problème | Solution |
|---|---|
| La page ne s'ouvre pas | Relais lancé ? Bonne adresse ? Pare-feu : autorisez Node.js. Wifi de résidence : adresse Tailscale |
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

Connexion plus robuste,
puis le reste : écran verrouillé…
