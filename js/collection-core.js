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
    // Date de la dernière écoute comptée par le lecteur ; jamais écoutés : à la fin (ajouts récents d'abord)
    { id: "listened-desc", label: "Écouté récemment",       fn: (a, b) => (!lastPlay(a)) - (!lastPlay(b)) || lastPlay(b).localeCompare(lastPlay(a)) || addedAt(b).localeCompare(addedAt(a)) },
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

  // ---------- Info affichée selon le tri ----------
  // « aujourd'hui », « hier », « il y a 4 j », sinon la date (« 27 oct. », l'année si ce n'est pas celle-ci)
  function whenLabel(iso) {
    const d = new Date(iso), today = new Date();
    const days = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / 86400000);
    if (days <= 0) return "aujourd'hui";
    if (days === 1) return "hier";
    if (days < 7) return "il y a " + days + " j";
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
  }
  // Intensité « 8/10 », dernière écoute, nombre d'écoutes : selon le tri choisi ("" sinon)
  function sortInfo(a, sortId) {
    if (/^aggro/.test(sortId)) return a.aggressivity ? a.aggressivity + "/10" : "";
    if (sortId === "listened-desc") { const l = lastPlay(a); return l ? whenLabel(l) : "jamais écouté"; }
    if (/^plays/.test(sortId)) { const n = playCount(a); return n + " écoute" + (n > 1 ? "s" : ""); }
    return "";
  }

  // ---------- Tri du contenu d'un bac ----------
  // « Ordre du bac » = l'ordre choisi à la main (glisser) ; les autres tris ne font que l'afficher autrement.
  // Ajouts récents / anciens : date d'entrée dans le bac (bac.added) ; sans date (albums mis avant que
  // conductor. la note) : comptés comme les plus anciens, dans l'ordre du bac.
  const bacAddedAt = (bac, a) => (bac && bac.added && bac.added[a.id]) || "";
  const BAC_SORTS = [
    { id: "manual",         label: "Ordre du bac",   fn: null },
    { id: "bac-added-desc", label: "Ajouts récents", fn: bac => (a, b) => bacAddedAt(bac, b).localeCompare(bacAddedAt(bac, a)) },
    { id: "bac-added-asc",  label: "Ajouts anciens", fn: bac => (a, b) => bacAddedAt(bac, a).localeCompare(bacAddedAt(bac, b)) }
  ].concat(["artist", "aggro-asc", "aggro-desc", "length-desc", "length-asc", "listened-desc", "plays-desc", "plays-asc"]
    .map(id => { const s = SORTS.find(x => x.id === id); return { id, label: s.label, fn: () => s.fn }; }));
  // albums : dans l'ordre du bac ; renvoie une copie triée (tri stable : l'ordre du bac départage)
  function sortBac(albums, bac, id) {
    const s = BAC_SORTS.find(x => x.id === id);
    return s && s.fn ? albums.slice().sort(s.fn(bac)) : albums.slice();
  }

  // Intensité moyenne d'une sélection (bac…) : albums notés seulement ; null si aucun.
  // Affichée « intensité 6,4 ».
  function avgIntensity(albums) {
    const v = albums.map(a => Number(a.aggressivity) || 0).filter(n => n > 0);
    return v.length ? Math.round(v.reduce((s, n) => s + n, 0) / v.length * 10) / 10 : null;
  }
  const intensityLabel = albums => {
    const m = avgIntensity(albums);
    return m == null ? "" : "intensité " + String(m).replace(".", ",");
  };

  // ---------- Liste des bacs ----------
  // Durée d'un bac : « 1j 2h 5min », « 3h 18min », « 45min »
  function formatTotal(sec) {
    const m = Math.round((sec || 0) / 60);
    const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60;
    return d ? d + "j " + h + "h " + min + "min" : h ? h + "h " + min + "min" : min + "min";
  }
  // Tri des bacs : "az" (nom), "intensity" (moyenne, douce → forte ; sans album noté : à la fin),
  // "recent" (modifiés récemment). albumsOf(bac) : ses albums (fiches Store ou fiches légères).
  function sortBacList(bacs, sort, albumsOf) {
    const byName = (a, b) => (a.name || "").localeCompare(b.name || "", "fr", { sensitivity: "base", numeric: true });
    if (sort === "recent") return bacs.slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    if (sort === "intensity") {
      const avg = new Map(bacs.map(b => [b.id, avgIntensity(albumsOf(b))]));
      return bacs.slice().sort((a, b) => {
        const x = avg.get(a.id), y = avg.get(b.id);
        if (x == null || y == null) return (x == null) - (y == null) || byName(a, b);
        return x - y || byName(a, b);
      });
    }
    return bacs.slice().sort(byName);
  }

  const decadeLabel = d => d === "avant" ? "avant 1950" : d.slice(2) + "s";

  root.CollectionCore = {
    addedAt, yearOf, decadeOf, durationOf, playCount, lastPlay, familyName, genreKey, normalize, matchesSearch,
    SORTS, sortById, DECADES, INTENSITIES, matches, facets, decadeLabel, avgIntensity, intensityLabel, BAC_SORTS, sortBac, whenLabel, sortInfo, formatTotal, sortBacList
  };
})(typeof window !== "undefined" ? window : globalThis);
