# conductor.

Site personnel pour cataloguer les albums que j'écoute. Fortement inspiré de Bandcamp et Musicboard.
HTML, CSS et JavaScript, sans serveur ni installation : on ouvre `index.html` dans Chrome ou Edge.

## Organisation

```
conductor/
├── app/            ← ce dépôt (le code)
│   ├── index.html      accueil : collection, tri, filtres
│   ├── README.md
│   ├── pages/
│   │   ├── album.html      page album : lecteur, titres, paroles, fiche
│   │   └── library.html    audio-files : connexion à Navidrome
│   ├── css/            style.css
│   ├── js/             scripts (config.js : réglages personnels, non publié)
│   ├── assets/         favicon
│   └── docs/
│       ├── navidrome-man.md    mode d'emploi du serveur sur le téléphone
│       └── toolkit.md          dépendances, matériel, coûts
└── datastorage/    ← vos données, hors du dépôt
    ├── collection.js   la collection
    ├── covers/         pochettes
    └── lyrics/         paroles
```

Le code lit et écrit les données dans `../datastorage/` : les deux dossiers doivent rester côte à côte.

## Démarrer

1. Ouvrir `app/index.html` dans Chrome ou Edge.
2. En bas à gauche : « Choisir le dossier datastorage » → `conductor/datastorage`.
3. Facultatif : copier `js/config.example.js` en `js/config.js` et y mettre un jeton Discogs.

Voir `docs/toolkit.md` pour les services utilisés et `docs/navidrome-man.md` pour l'écoute de vos fichiers.
