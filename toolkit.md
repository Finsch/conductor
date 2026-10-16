# conductor. — toolkit

Ce dont dépend le site, ce qu'il coûte, et ce qui marche sans internet.
Le code est dans `conductor/app/`, les données dans `conductor/datastorage/`.
Aucun serveur en ligne, aucun abonnement, rien de payant.

---

## 1. Services en ligne (internet)

| Service | Rôle | Compte / clé | Quand |
|---|---|---|---|
| **Deezer API** | Recherche d'albums, titres, durées, label, pochettes, extraits 30 s | Aucun | Ajout d'un album · 1ʳᵉ visite d'une page album · extraits à chaque écoute |
| **MusicBrainz** | Date de sortie originale, mots-clés | Aucun | Ajout · 1ʳᵉ visite d'une page album |
| **Discogs** (facultatif) | Genre / styles, résultats de recherche en plus | Jeton dans `app/js/config.js` (non publié sur GitHub) | Mêmes moments, si le jeton est rempli |
| **LRCLIB** | Paroles | Aucun | Clic sur « paroles » (si pas déjà enregistrées) |
| Serveurs d'images (Deezer, Discogs, Apple) | Pochettes d'origine | Aucun | Une fois : elles sont ensuite copiées dans `datastorage/covers/` |
| Genius, Wikipédia | Simples liens (nouvel onglet) | — | Jamais interrogés par le site |

## 2. Outils locaux

| Outil | Où | Rôle |
|---|---|---|
| **Chrome ou Edge** | PC | Fait tourner le site ; seul navigateur capable d'écrire dans `datastorage` |
| **Termux** (via F-Droid) | Samsung A12 | Terminal Linux sur Android |
| **Navidrome** (+ ffmpeg, taglib) | A12, dans Termux | Sert vos MP3/FLAC en wifi (titres, pochettes, paroles, flux audio) |

Rien d'autre à installer sur le PC.

## 3. Où sont vos données

| Emplacement | Contenu |
|---|---|
| `datastorage/collection.js` | **La collection** (albums, écoutes, notes, intensité, titres, mots-clés…) |
| `datastorage/collection.prev.js` | Version précédente (sécurité) |
| `datastorage/covers/` | Pochettes en local |
| `datastorage/lyrics/` | Paroles enregistrées (un fichier par album) |
| Navigateur (localStorage) | Copie de travail de la collection · réglages Navidrome (jeton) · préférences d'affichage |
| Téléphone | Vos fichiers audio (seule copie) |

À sauvegarder : le dossier `datastorage` (et vos fichiers audio sur le téléphone).

## 4. Sans internet

| Fonctionne | Ne fonctionne pas |
|---|---|
| Accueil, recherche dans la collection, tri, filtres | Ajouter un nouvel album (recherche en ligne) |
| Pages album : infos, titres, durées, mots-clés, vos écoutes | Extraits Deezer |
| Pochettes copiées, paroles déjà affichées une fois | Paroles jamais ouvertes |
| Vos fichiers, **si** le A12 est sur le même réseau local | Infos d'un album jamais ouvert (complétées au 1ᵉʳ passage en ligne) |

## 5. Matériel et batterie

| Appareil | Rôle | Coût |
|---|---|---|
| **PC** | Affiche le site | Négligeable (un navigateur) |
| **Samsung A12** | Serveur de vos fichiers | **Le plus sollicité** : Navidrome tourne en continu, le « wake lock » empêche la veille. 1ʳᵉ analyse gourmande, streaming modéré. Branchez-le pour les longues écoutes. |
| **iPhone** (si partage de connexion) | Point d'accès réseau | Sa batterie |

## 6. Réseau

| Flux | Passe par | Coût |
|---|---|---|
| Vos fichiers (A12 → PC) | Réseau local (box, ou iPhone en partage) | **Aucun forfait consommé** · ~30-40 Mo par album FLAC, ~10 Mo en MP3 |
| Recherches, métadonnées, paroles | Internet | Quelques Ko |
| Pochettes | Internet, une seule fois | ~150-300 Ko chacune |
| Extraits Deezer | Internet | ~0,5 Mo par extrait |

En partage de connexion iPhone, tout ce qui va sur internet utilise ses **données mobiles**.

