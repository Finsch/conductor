// conductor01. — stockage de la collection
// Les albums sont enregistrés dans le navigateur (localStorage).
// Chaque album contient la liste de ses écoutes ("logs").
//
// Structure d'un album :
// {
//   id: "deezer-14879699",
//   source: "Deezer",
//   title: "In Rainbows",
//   artist: "Radiohead",
//   year: 2007,
//   genre: "Alternative",
//   trackCount: 10,
//   cover: "https://…/600x600bb.jpg",
//   logs: [ { date: "2026-10-15", rating: 4, review: "…", loggedAt: "2026-10-15T21:20:00.000Z" } ]
// }

// ---------- Nettoyage des titres ----------
// "Sgt. Pepper's Lonely Hearts Club Band (Remastered 2009)" → "Sgt. Pepper's Lonely Hearts Club Band"
// "Ramones (40th Anniversary Deluxe Edition; 2016 Remaster)" → "Ramones"
// "Abbey Road - Remastered 2019"                             → "Abbey Road"
// On ne retire une mention que si elle contient un de ces mots :
const EDITION_WORDS = /remaster|deluxe|edition|anniversary|anniversaire|expanded|bonus|reissue|collector|legacy|mono|stereo|explicit|hi-res|24-bit|rudy van gelder/;

function cleanAlbumTitle(raw) {
  let title = (raw || "").trim();
  const simple = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  let changed = true;
  while (changed) {
    changed = false;
    // (…) ou […] en fin de titre
    const paren = title.match(/^(.+?)\s*[(\[]([^()\[\]]*)[)\]]\s*$/);
    if (paren && EDITION_WORDS.test(simple(paren[2]))) {
      title = paren[1].trim();
      changed = true;
      continue;
    }
    // " - Remastered 2009" en fin de titre
    const dash = title.match(/^(.+?)\s+[-–—]\s+([^-–—]+)$/);
    if (dash && EDITION_WORDS.test(simple(dash[2]))) {
      title = dash[1].trim();
      changed = true;
    }
  }
  return title || (raw || "").trim();
}

// ---------- Chemins ----------
// Les pages album et audio-files sont dans app/pages/ : un niveau plus bas que l'accueil.
// APP_ROOT ramène à app/ depuis n'importe quelle page.
const APP_ROOT = /\/pages\/[^\/]*$/.test(location.pathname) ? "../" : "";

// Fichiers de datastorage : enregistrés relativement à app/ ("../datastorage/…"),
// ajustés ici selon la page qui les affiche.
function localUrl(path) {
  return path && path.startsWith("../datastorage/") ? APP_ROOT + path : path;
}

// ---------- Durées ----------
// 2505 → "41 min 45 s" ; 3840 → "1 h 4 min"
function formatLength(sec) {
  sec = Math.round(sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return h + " h" + (m ? " " + m + " min" : "");
  return m + " min" + (s ? " " + s + " s" : "");
}

// 4 → "4 titres" ; 1 → "1 titre"
function formatTracks(n) {
  return n + " titre" + (n > 1 ? "s" : "");
}

const Store = (function () {
  const KEY = "conductor01.albums";
  const SAVED_KEY = "conductor01.savedAt";

  // Au démarrage : si datastorage/collection.js est plus récent que la copie
  // du navigateur (ou si le navigateur est vide), c'est lui qui fait foi.
  (function adoptFile() {
    const file = window.CONDUCTOR_DATA;
    if (!file || !Array.isArray(file.albums)) return;
    let localSaved = "";
    try { localSaved = localStorage.getItem(SAVED_KEY) || ""; } catch (e) {}
    if (!localSaved || (file.savedAt || "") > localSaved) {
      try {
        localStorage.setItem(KEY, JSON.stringify(file.albums));
        localStorage.setItem(SAVED_KEY, file.savedAt || new Date().toISOString());
      } catch (e) {
        console.warn("Copie de datastorage dans le navigateur impossible :", e);
      }
    }
  })();

  function load() {
    let albums;
    try {
      albums = JSON.parse(localStorage.getItem(KEY)) || [];
    } catch (e) {
      return [];
    }
    // Nettoie aussi les titres des albums déjà enregistrés
    albums.forEach(a => {
      a.title = cleanAlbumTitle(a.title);
      // Le code est passé dans app/ : les pochettes locales sont un dossier plus haut
      if (a.cover && a.cover.startsWith("datastorage/")) a.cover = "../" + a.cover;
    });
    return albums;
  }

  function save(albums) {
    localStorage.setItem(KEY, JSON.stringify(albums));
    localStorage.setItem(SAVED_KEY, new Date().toISOString());
    document.dispatchEvent(new CustomEvent("albums:changed"));
    // Écriture dans datastorage (si le dossier est connecté)
    if (typeof Disk !== "undefined") Disk.changed();
  }

  function simplify(str) {
    return (str || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function sameAlbum(a, b) {
    return a.id === b.id ||
      (simplify(a.artist) === simplify(b.artist) && simplify(a.title) === simplify(b.title));
  }

  function lastLoggedAt(album) {
    const logs = album.logs || [];
    return logs.length ? logs[logs.length - 1].loggedAt : "";
  }

  return {
    // Données brutes, pour l'écriture sur le disque
    raw() {
      return load();
    },

    savedAt() {
      try { return localStorage.getItem(SAVED_KEY) || ""; } catch (e) { return ""; }
    },

    // Tous les albums, le dernier loggé en premier
    all() {
      return load().sort((a, b) => lastLoggedAt(b).localeCompare(lastLoggedAt(a)));
    },

    get(id) {
      return load().find(a => a.id === id) || null;
    },

    // Modifie les champs d'un album (titre, cover, intensité…)
    update(id, patch) {
      const albums = load();
      const album = albums.find(a => a.id === id);
      if (!album) return null;
      Object.assign(album, patch);
      save(albums);
      return album;
    },

    remove(id) {
      save(load().filter(a => a.id !== id));
    },

    // Même album = même identifiant, ou même artiste + même titre
    // (évite les doublons quand un album vient de Deezer puis de Discogs)
    has(album) {
      return load().some(a => sameAlbum(a, album));
    },

    // Ajoute un album sans écoute (import depuis vos fichiers)
    addAlbum(album) {
      const albums = load();
      const existing = albums.find(a => sameAlbum(a, album));
      if (existing) return existing;
      const entry = Object.assign({}, album, { logs: [], addedAt: new Date().toISOString() });
      albums.push(entry);
      save(albums);
      return entry;
    },

    // Ajoute une écoute ; crée l'album s'il n'est pas encore dans la collection
    logAlbum(album, log) {
      const albums = load();
      let entry = albums.find(a => sameAlbum(a, album));
      if (!entry) {
        entry = Object.assign({}, album, { logs: [], addedAt: new Date().toISOString() });
        albums.push(entry);
      }
      entry.logs.push(Object.assign({}, log, { loggedAt: new Date().toISOString() }));
      save(albums);
      return entry;
    }
  };
})();
