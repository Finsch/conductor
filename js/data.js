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
//   logs: [ { date: "2026-10-15", loggedAt: "2026-10-15T21:20:00.000Z" } ]   (ajouts)
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

// ---------- Site sur une seule page ----------
// Toutes les pages s'affichent dans conductor.html (l'« enveloppe »), qui ne se
// recharge jamais : la musique continue d'une page à l'autre. Une page ouverte
// seule (favori, ancien lien) est renvoyée dans l'enveloppe, à la même adresse.
const IN_SHELL = window.top !== window;
if (!IN_SHELL && !window.CONDUCTOR_SHELL) {
  const root = new URL(APP_ROOT || "./", location.href).href;
  const rel = location.href.split("#")[0].slice(root.length) || "index.html";
  location.replace(root + "conductor.html#" + rel + (location.hash || ""));
}

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

// Clé d'un morceau pour les étoiles : titre simplifié ("Black Mambo" → "blackmambo"),
// pour retrouver la piste qu'elle vienne de Deezer ou de vos fichiers.
function trackKey(title) {
  return cleanAlbumTitle(title || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ---------- Icônes favoris ----------
// Album favori : cœur arrondi. Morceau préféré : étoile aux angles arrondis.
// on = plein, sinon contour. Taille et couleur viennent du CSS (currentColor).

function favIcon(on) {
  return '<svg class="fav-icon' + (on ? ' is-on' : '') + '" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 20.2c-.3 0-.55-.1-.77-.28C7.4 16.6 3.6 13.3 3.6 9.3c0-2.7 2.1-4.8 4.7-4.8 1.5 0 2.85.7 3.7 1.85.85-1.15 2.2-1.85 3.7-1.85 2.6 0 4.7 2.1 4.7 4.8 0 4-3.8 7.3-7.63 10.62-.22.18-.47.28-.77.28z" ' +
    'fill="' + (on ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
}

function trackIcon(on) {
  return '<svg class="track-icon' + (on ? ' is-on' : '') + '" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 3.8 L14.59 9.24 L20.56 10.02 L16.18 14.16 L17.29 20.08 L12 17.2 L6.71 20.08 L7.82 14.16 L3.44 10.02 L9.41 9.24Z" ' +
    'fill="' + (on ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
}

// ---------- Tier (S, A, B) ----------
// album.tier : "S" | "A" | "B" (null = pas classé). Choisi sur la page album,
// filtré dans la collection.
const TIERS = ["S", "A", "B"];
const TIER_NAMES = { S: "Masterpiece", A: "Excellent work", B: "Very good job" };

// ---------- Page artiste ----------
function artistUrl(name) {
  return APP_ROOT + "pages/artist.html?name=" + encodeURIComponent(name || "");
}

// ---------- Nettoyage des styles et genres ----------
// Les sources en ligne (surtout les tags MusicBrainz) mêlent de vrais styles,
// des étiquettes de classement ("offizielle charts", "1–4 wochen") et des
// orthographes différentes d'un même style ("hip hop" / "hip-hop").

// Étiquettes qui ne sont pas des styles
const STYLE_JUNK = /wochen|charts|\b(19|20)\d\d\b|^(drake|drugs|english|french|concept album|eclectic|classical influences|piano|seen live|favorites?|albums? i own|my music|vinyl)$/;

// Orthographes ramenées à une seule (après passage en minuscules)
const STYLE_ALIASES = {
  "neo soul": "neo-soul",
  "jazz funk": "jazz-funk",
  "pop-rock": "pop rock",
  "p.funk": "p-funk",
  "prog rock": "progressive rock",
  "avantgarde": "avant-garde",
  "alt-pop": "alternative pop",
  "minimalist music": "minimalism",
  "conscious": "conscious hip-hop",
  "rap/hip hop": "hip-hop",
  "rap/hip-hop": "hip-hop",
  "hiphop": "hip-hop",
  "r'n'b": "r&b",
  "rnb": "r&b"
};

function cleanStyle(style) {
  let s = String(style || "").trim().toLowerCase().replace(/\s+/g, " ");
  s = s.replace(/hip hop/g, "hip-hop");          // "conscious hip hop" → "conscious hip-hop"
  return STYLE_ALIASES[s] || s;
}

// Styles nettoyés : sans doublon, sans étiquette parasite.
// Le genre fait toujours partie des styles (en premier).
function cleanStyles(list, genre) {
  const g = cleanStyle(genre);
  return [...new Set([g].concat((list || []).map(cleanStyle)))].filter(s => s && !STYLE_JUNK.test(s));
}

// Genre : orthographe unifiée, seule la première lettre en majuscule
// ("Hip Hop", "Rap/Hip Hop" → "Hip-hop" ; "Funk / Soul" → "Funk / soul")
function genreCase(genre) {
  const g = cleanStyle(genre);
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
  // Notes du journal : { "AAAA-MM-JJ": { text, updatedAt } }, écrites avec la
  // collection dans datastorage/collection.js
  const NOTES_KEY = "conductor01.notes";

  function loadNotes() {
    try { return JSON.parse(localStorage.getItem(NOTES_KEY)) || {}; } catch (e) { return {}; }
  }

  (function adoptFile() {
    const file = window.CONDUCTOR_DATA;
    if (!file || !Array.isArray(file.albums)) return;
    let localSaved = "";
    try { localSaved = localStorage.getItem(SAVED_KEY) || ""; } catch (e) {}
    if (!localSaved || (file.savedAt || "") > localSaved) {
      try {
        localStorage.setItem(KEY, JSON.stringify(file.albums));
        if (file.notes && typeof file.notes === "object") localStorage.setItem(NOTES_KEY, JSON.stringify(file.notes));
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
      // Styles en minuscules, nettoyés (étiquettes parasites, doublons d'orthographe), genre inclus
      if (Array.isArray(a.styles) || a.genre) a.styles = cleanStyles(a.styles, a.genre);
      // Notes et avis : fonction retirée, on efface ce qui aurait été saisi
      delete a.rating; delete a.review; delete a.reviewAt;
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

  // Données modifiées ailleurs (le cadre ↔ l'enveloppe) : chacun se met à jour.
  // Une page du cadre a modifié les données : l'enveloppe les écrit dans datastorage.
  window.addEventListener("storage", e => {
    if (e.key === NOTES_KEY) {
      document.dispatchEvent(new CustomEvent("notes:changed"));
      if (typeof Disk !== "undefined") Disk.changed();
      return;
    }
    if (e.key !== KEY) return;
    document.dispatchEvent(new CustomEvent("albums:changed"));
    if (typeof Disk !== "undefined") Disk.changed();
  });

  function simplify(str) {
    return (str || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  // Next up : un album quitte le rang `rank` → ceux d'après remontent d'un rang
  function closeRank(albums, rank) {
    albums.forEach(a => { if (a.nextUp && a.priority > rank) a.priority -= 1; });
  }

  function leaveNextUp(albums, entry) {
    if (entry.priority) closeRank(albums, entry.priority);
    delete entry.nextUp;
    delete entry.nextUpAt;
    delete entry.priority;
    delete entry.nextUpOrder;
    entry.addedAt = new Date().toISOString();
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

    // ---------- Notes du journal ----------
    notes() {
      return loadNotes();
    },

    note(day) {
      return loadNotes()[day] || null;
    },

    // Texte vide : la note est supprimée
    setNote(day, text) {
      const notes = loadNotes();
      text = (text || "").replace(/\s+$/, "");
      if (text.trim()) notes[day] = { text, updatedAt: new Date().toISOString() };
      else delete notes[day];
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
      localStorage.setItem(SAVED_KEY, new Date().toISOString());
      document.dispatchEvent(new CustomEvent("notes:changed"));
      if (typeof Disk !== "undefined") Disk.changed();
    },

    savedAt() {
      try { return localStorage.getItem(SAVED_KEY) || ""; } catch (e) { return ""; }
    },

    // Tous les albums, le dernier loggé en premier
    // La collection (albums écoutés) ; les albums « next up » sont à part
    all() {
      return load().filter(a => !a.nextUp)
        .sort((a, b) => lastLoggedAt(b).localeCompare(lastLoggedAt(a)));
    },

    // Next up : albums repérés, pas encore écoutés. Ordre choisi à la main
    // (glisser-déposer, album.nextUpOrder) ; les nouveaux, pas encore placés,
    // en tête, du plus récent au plus ancien.
    nextUp() {
      const recent = (a, b) => (b.nextUpAt || "").localeCompare(a.nextUpAt || "");
      return load().filter(a => a.nextUp).sort((a, b) => {
        const x = a.nextUpOrder, y = b.nextUpOrder;
        if (x == null && y == null) return recent(a, b);
        if (x == null) return -1;
        if (y == null) return 1;
        return x - y || recent(a, b);
      });
    },

    // Ordre d'une liste next up après un glisser-déposer : ids dans le nouvel ordre
    setNextUpOrder(ids) {
      const albums = load();
      ids.forEach((id, i) => {
        const a = albums.find(x => x.id === id);
        if (a && a.nextUp) a.nextUpOrder = i;
      });
      save(albums);
    },

    // Top 5 réordonné (glisser-déposer) : ces albums prennent les rangs 1, 2, 3…
    // Les albums en attente au-delà du 5e rang gardent leur place derrière.
    setTop(ids) {
      const albums = load();
      const waiting = albums.filter(a => a.nextUp && a.priority && !ids.includes(a.id))
        .sort((a, b) => a.priority - b.priority);
      ids.forEach((id, i) => {
        const a = albums.find(x => x.id === id);
        if (a && a.nextUp) a.priority = i + 1;
      });
      // (seulement si un rang est déjà pris : ils passent derrière)
      let next = ids.length + 1;
      waiting.forEach(a => { if (a.priority < next) a.priority = next; next = a.priority + 1; });
      save(albums);
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
      if (album.genre) album.genre = genreCase(album.genre);
      if (Array.isArray(album.styles) || album.genre) album.styles = cleanStyles(album.styles, album.genre);
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
      // Album « next up » enregistré depuis la fenêtre d'ajout : il entre dans la collection
      if (entry.nextUp) leaveNextUp(albums, entry);
      entry.logs = entry.logs || [];
      entry.logs.push(Object.assign({}, log, { loggedAt: new Date().toISOString() }));
      save(albums);
      return entry;
    },

    // Next up → collection (un ajout, pas une écoute)
    toCollection(id) {
      const albums = load();
      const entry = albums.find(a => a.id === id);
      if (!entry) return null;
      if (entry.nextUp) leaveNextUp(albums, entry);
      save(albums);
      return entry;
    },

    // Écoute d'album comptée par le lecteur (90 % des morceaux écoutés).
    // album.plays : [{ at, tracks, of, source }] — à exploiter plus tard (stats…)
    addPlay(id, play) {
      const albums = load();
      const entry = albums.find(a => a.id === id);
      if (!entry) return null;
      entry.plays = (entry.plays || []).concat([Object.assign({ at: new Date().toISOString() }, play)]);
      save(albums);
      return entry;
    }
  };
})();
