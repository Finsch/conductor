// conductor. — collection : recherche, tris et filtres (intensité, décennies, genres)
//
// Fichier commun : utilisé par la page collection du PC (js/app.js) et par la collection de la
// télécommande (tools/remote/public, servi par le relais à l'adresse /collection-core.js).
// Une seule version des règles : le PC et le téléphone trient et filtrent toujours pareil.
//
// Les albums sont ceux de Store (PC) ou leur version légère envoyée au téléphone (même noms de
// champs ; la famille de genre y est déjà calculée dans familyName, le nombre d'écoutes dans playCount).

(function (root) {
  // Date d'ajout à la collection (anciens albums : date du premier log)
  function addedAt(a) {
    return a.addedAt || (a.logs && a.logs[0] && a.logs[0].loggedAt) || "";
  }

  function yearOf(a) {
    if (a.releaseDate) return Number(String(a.releaseDate).slice(0, 4));
    return a.year || null;
  }

  // 1977 → "1970" ; avant 1950 → "avant"
  function decadeOf(a) {
    const y = yearOf(a);
    if (!y) return null;
    return y < 1950 ? "avant" : String(Math.floor(y / 10) * 10);
  }

  function durationOf(a) {
    if (a.duration) return a.duration;
    const sum = (a.tracks || []).reduce((s, t) => s + (t.duration || 0), 0);
    return sum || null;
  }

  // Écoutes comptées par le lecteur
  function playCount(a) { return a.plays ? a.plays.length : a.playCount || 0; }
  function lastPlay(a) {
    if (!a.plays) return a.lastPlay || "";
    return a.plays.length ? a.plays[a.plays.length - 1].at || "" : "";
  }

  // Famille de genre : calculée par data.js sur le PC, déjà fournie au téléphone
  function familyName(a) {
    return typeof familyOf === "function" ? familyOf(a) : a.familyName || "";
  }

  // Un genre peut apparaître sous deux familles (famille choisie à la main) :
  // le filtre travaille donc sur le couple famille + genre.
  function genreKey(a) {
    return a.genre ? familyName(a) + "|" + a.genre : "";
  }

  // ---------- Recherche ----------

  // Ignore accents et majuscules : "bjork" trouve "Björk"
  function normalize(str) {
    return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  // « mot1+mot2 » = les deux présents ; « mot1/mot2 » = l'un ou l'autre.
  // Les deux se combinent : « jazz+fusion/ambient » = (jazz ET fusion) OU ambient.
  // Chaque mot peut être dans un champ différent (titre, artiste, genre, styles…).
  function parseQuery(q) {
    return q.split("/")
      .map(group => group.split("+").map(w => w.trim()).filter(Boolean))
      .filter(group => group.length);
  }

  // q : déjà passée par normalize()
  function matchesSearch(a, q) {
    if (!q) return true;
    const groups = parseQuery(q);
    if (!groups.length) return true;
    const fields = [a.title, a.artist, a.genre, familyName(a), a.label]
      .concat(a.styles || [], a.keywords || [], a.moods || [], a.tags || [])
      .map(normalize);
    const has = w => fields.some(v => v.includes(w));
    return groups.some(group => group.every(has));
  }

  // ---------- Tris ----------

  const byText = field => (a, b) => (a[field] || "").localeCompare(b[field] || "", "fr", { sensitivity: "base" });

  // Les albums sans valeur (pas d'intensité, pas d'année) vont toujours à la fin
  function byNumber(get, dir) {
    return (a, b) => {
      const x = get(a), y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return dir * (x - y);
    };
  }

  const SORTS = [
    { id: "added-desc",   label: "Ajouts récents",          fn: (a, b) => addedAt(b).localeCompare(addedAt(a)) },
    { id: "added-asc",    label: "Ajouts anciens",          fn: (a, b) => addedAt(a).localeCompare(addedAt(b)) },
    { id: "title",        label: "Titre A → Z",             fn: byText("title") },
    { id: "artist",       label: "Artiste A → Z",           fn: (a, b) => byText("artist")(a, b) || byNumber(yearOf, 1)(a, b) },
    { id: "aggro-desc",   label: "Intensité, forte → douce",  fn: byNumber(a => a.aggressivity || null, -1) },
    { id: "aggro-asc",    label: "Intensité, douce → forte",  fn: byNumber(a => a.aggressivity || null, 1) },
    { id: "year-desc",    label: "Sortie récente",          fn: byNumber(yearOf, -1) },
    { id: "year-asc",     label: "Sortie ancienne",         fn: byNumber(yearOf, 1) },
    { id: "length-desc",  label: "Durée, longue → courte",  fn: byNumber(durationOf, -1) },
    { id: "length-asc",   label: "Durée, courte → longue",  fn: byNumber(durationOf, 1) },
    // À égalité : la plus récente d'abord / l'ajout le plus ancien d'abord
    { id: "plays-desc",   label: "Le plus écouté",          fn: (a, b) => playCount(b) - playCount(a) || lastPlay(b).localeCompare(lastPlay(a)) },
    { id: "plays-asc",    label: "Le moins écouté",         fn: (a, b) => playCount(a) - playCount(b) || addedAt(a).localeCompare(addedAt(b)) }
  ];
  const sortById = id => (SORTS.find(s => s.id === id) || SORTS[0]).fn;

  // ---------- Filtres : intensité, décennies, genres ----------

  const DECADES = ["1950", "1960", "1970", "1980", "1990", "2000", "2010", "2020"];
  const INTENSITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // f = { intensities: Set<number>, decades: Set<string>, genres: Set<"famille|genre"> }
  // skip : le filtre à ignorer (pour compter les albums de ses propres choix)
  function matches(a, f, skip) {
    if (skip !== "intensity" && f.intensities.size && !f.intensities.has(a.aggressivity || 0)) return false;
    if (skip !== "genre" && f.genres.size && !f.genres.has(genreKey(a))) return false;
    if (skip !== "decade" && f.decades.size && !f.decades.has(decadeOf(a))) return false;
    return true;
  }

  // Compteurs des choix : chacun tient compte des autres filtres (match(a, skip)), pas du sien.
  // all : toute la collection (pour la liste des genres) ; base : après la recherche.
  function facets(all, base, match) {
    const genres = new Map();   // "famille|genre" → nombre (0 si filtré ailleurs)
    all.forEach(a => { const k = genreKey(a); if (k) genres.set(k, 0); });
    base.forEach(a => {
      if (!match(a, "genre")) return;
      const k = genreKey(a);
      if (k) genres.set(k, genres.get(k) + 1);
    });
    // Rangés par famille, ordre alphabétique ; « Autres » toujours en dernier
    const byFamily = new Map();
    [...genres.keys()].forEach(k => {
      const fam = k.slice(0, k.indexOf("|"));
      if (!byFamily.has(fam)) byFamily.set(fam, []);
      byFamily.get(fam).push(k);
    });
    const fr = (x, y) => x.localeCompare(y, "fr", { sensitivity: "base" });
    const families = [...byFamily.keys()].sort((x, y) => (x === "Autres") - (y === "Autres") || fr(x, y))
      .map(name => {
        const keys = byFamily.get(name).sort(fr);
        return { name, keys, total: keys.reduce((s, k) => s + genres.get(k), 0) };
      });

    const decades = new Map();
    base.forEach(a => {
      if (!match(a, "decade")) return;
      const d = decadeOf(a);
      if (d) decades.set(d, (decades.get(d) || 0) + 1);
    });
    const decadeList = (all.some(a => decadeOf(a) === "avant") ? ["avant"] : []).concat(DECADES);

    const intensities = new Map();
    base.forEach(a => {
      if (match(a, "intensity") && a.aggressivity) intensities.set(a.aggressivity, (intensities.get(a.aggressivity) || 0) + 1);
    });

    return { genres, families, decades, decadeList, intensities };
  }

  const decadeLabel = d => d === "avant" ? "avant 1950" : d.slice(2) + "s";

  root.CollectionCore = {
    addedAt, yearOf, decadeOf, durationOf, playCount, lastPlay, familyName, genreKey, normalize, matchesSearch,
    SORTS, sortById, DECADES, INTENSITIES, matches, facets, decadeLabel
  };
})(typeof window !== "undefined" ? window : globalThis);
