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

// ---------- Ressenti (ambiance) ----------
// Tags qui décrivent une ambiance plutôt qu'un genre : rangés dans "ressenti"
const MOOD_WORDS = /\b(mellow|chill|chillout|chill-out|laid[- ]?back|relax(ed|ing)?|calm|peaceful|soothing|serene|dreamy|ethereal|atmospheric|ambient mood|melanchol(y|ic)|sad|dark|moody|brooding|gloomy|haunting|somber|sombre|energetic|upbeat|uplifting|happy|joyful|euphoric|aggressive|angry|intense|romantic|sensual|sexy|nostalgic|groovy|groove|tropical|summer(y)?|sunny|warm|cold|introspective|emotional|bittersweet|hypnotic|trippy|playful|quirky|whimsical|epic|cinematic|lush|nocturnal|night|late night|party|danceable|catchy|meditative|spiritual|anxious|lonely|heartbreak|fun|feel good|feel-good|smooth|hazy|lazy|breezy|cozy|cosy|raw|gritty|menacing|tense|eerie|spooky|triumphant|anthemic|wistful|tender|sentimental|mysterious)\b/i;

function isMood(tag) {
  return MOOD_WORDS.test(tag || "");
}

// ---------- Familles de genres ----------
// Grandes familles pour rendre le filtre lisible. Le genre précis de l'album
// ne change pas ; la famille est déduite du genre (ou choisie à la main dans
// « Modifier la fiche », champ album.family).
// Ordre des règles important : "soul jazz" → Jazz, "trip-hop" → Electronic
// (et non Hip-hop), "post-punk" / "dance-punk" → Punk (et non Rock),
// "Folk, World, & Country" (Discogs) → Folk.

const GENRE_FAMILIES = ["Black music", "Jazz", "Rock", "Punk", "Pop", "Hip-hop",
                        "Electronic", "Folk", "World music", "Autres"];

const FAMILY_RULES = [
  ["Jazz", /jazz|swing|bebop|big band/],
  ["Electronic", /trip-?hop|electro|techno|house|ambient|downtempo|idm|dubstep|drum ?(&|and|n) ?bass|edm|trance|breakbeat|synthwave|chillwave|glitch|garage/],
  ["Hip-hop", /hip ?-?hop|rap|trap|drill|grime|boom bap/],
  ["Punk", /punk|hardcore|emo|oi!|riot grrrl/],
  ["Rock", /rock|metal|grunge|shoegaze|new wave|no wave|krautrock/],
  ["Black music", /blues|soul|funk|r&b|rnb|rhythm and blues|disco|gospel|motown|doo-?wop/],
  ["Folk", /folk|country|bluegrass|americana|singer-songwriter/],
  ["World music", /world|reggae|dub|dancehall|ska|afro|latin|bossa|samba|salsa|cumbia|tropicalia|zouk|kompa|highlife|rumba|flamenco|fado/],
  ["Pop", /pop|chanson|variété|cabaret/]
];

// Genre : seule la première lettre en majuscule ("Hip Hop" → "Hip hop",
// "Funk / Soul" → "Funk / soul")
function genreCase(genre) {
  const g = String(genre || "").trim().toLowerCase();
  return g ? g.charAt(0).toUpperCase() + g.slice(1) : "";
}

function autoFamily(genre) {
  const g = (genre || "").toLowerCase();
  if (!g) return "";
  const rule = FAMILY_RULES.find(([, re]) => re.test(g));
  return rule ? rule[0] : "Autres";
}

// Famille d'un album : choix manuel, sinon déduite du genre ("" si pas de genre)
function familyOf(album) {
  const manual = album && album.family;
  if (manual && GENRE_FAMILIES.includes(manual)) return manual;   // ancien nom de famille : ignoré
  return autoFamily(album && album.genre);
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
      // Styles toujours en minuscules ("Psychedelic Indie Pop" → "psychedelic indie pop")
      if (Array.isArray(a.styles)) a.styles = a.styles.map(st => String(st).toLowerCase());
      if (a.genre) a.genre = genreCase(a.genre);
      // Anciens "mots-clés" : les ambiances vont dans le ressenti, le reste dans les styles
      if (Array.isArray(a.keywords) && a.keywords.length) {
        const low = x => String(x).toLowerCase();
        const genre = low(a.genre || "");
        a.moods = [...new Set((a.moods || []).map(low).concat(a.keywords.filter(isMood).map(low)))];
        a.styles = [...new Set((a.styles || []).map(low).concat(a.keywords.filter(k => !isMood(k)).map(low)))]
          .filter(st => st !== genre);
        a.keywords = [];
      }
      if (Array.isArray(a.moods)) a.moods = a.moods.map(m => String(m).toLowerCase());
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

  // Next up : un album quitte le rang `rank` → ceux d'après remontent d'un rang
  function closeRank(albums, rank) {
    albums.forEach(a => { if (a.nextUp && a.priority > rank) a.priority -= 1; });
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
    // La collection (albums ajoutés) ; les albums « next up » sont à part
    all() {
      return load().filter(a => !a.nextUp)
        .sort((a, b) => lastLoggedAt(b).localeCompare(lastLoggedAt(a)));
    },

    // Next up : albums repérés, pas encore ajoutés (les plus récents d'abord)
    nextUp() {
      return load().filter(a => a.nextUp)
        .sort((a, b) => (b.nextUpAt || "").localeCompare(a.nextUpAt || ""));
    },

    // Priorité 1 à 5 dans next up (null = pas de priorité choisie).
    // Rang déjà pris : cet album et ceux d'après descendent d'un rang. Le 5e
    // passe 6e : hors du top 5 mais gardé en attente, il y revient si une place
    // se libère. Changer ou retirer un rang fait remonter les suivants.
    setPriority(id, rank) {
      const albums = load();
      const album = albums.find(a => a.id === id);
      if (!album) return null;
      if (album.priority) {
        const old = album.priority;
        delete album.priority;
        closeRank(albums, old);
      }
      if (rank) {
        albums.forEach(a => {
          if (a.nextUp && a.priority >= rank) a.priority += 1;
        });
        album.priority = rank;
      }
      save(albums);
      return album;
    },

    // "collection", "nextup" ou null
    statusOf(album) {
      const found = load().find(a => sameAlbum(a, album));
      return found ? (found.nextUp ? "nextup" : "collection") : null;
    },

    // Ajoute à Next up (sans écoute). Déjà présent : on ne touche à rien.
    addNextUp(album) {
      const albums = load();
      const existing = albums.find(a => sameAlbum(a, album));
      if (existing) return existing;
      const entry = Object.assign({}, album, { logs: [], nextUp: true, nextUpAt: new Date().toISOString() });
      if (entry.genre) entry.genre = genreCase(entry.genre);
      albums.push(entry);
      save(albums);
      return entry;
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
      if (Array.isArray(album.styles)) album.styles = album.styles.map(st => String(st).toLowerCase());
      if (album.genre) album.genre = genreCase(album.genre);
      save(albums);
      return album;
    },

    remove(id) {
      const albums = load();
      const gone = albums.find(a => a.id === id);
      if (gone && gone.nextUp && gone.priority) closeRank(albums, gone.priority);
      save(albums.filter(a => a.id !== id));
    },

    // Même album = même identifiant, ou même artiste + même titre
    // (évite les doublons quand un album vient de Deezer puis de Discogs)
    has(album) {
      return load().some(a => !a.nextUp && sameAlbum(a, album));
    },

    // Ajoute un album sans écoute (import depuis vos fichiers)
    addAlbum(album) {
      const albums = load();
      const existing = albums.find(a => sameAlbum(a, album));
      if (existing) return existing;
      const entry = Object.assign({}, album, { logs: [], addedAt: new Date().toISOString() });
      if (entry.genre) entry.genre = genreCase(entry.genre);
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
        if (entry.genre) entry.genre = genreCase(entry.genre);
        albums.push(entry);
      }
      // Première écoute d'un album « next up » : il entre dans la collection
      if (entry.nextUp) {
        if (entry.priority) closeRank(albums, entry.priority);
        delete entry.nextUp;
        delete entry.nextUpAt;
        delete entry.priority;
        entry.addedAt = new Date().toISOString();
      }
      entry.logs = entry.logs || [];
      entry.logs.push(Object.assign({}, log, { loggedAt: new Date().toISOString() }));
      save(albums);
      return entry;
    }
  };
})();
