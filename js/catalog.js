// conductor01. — recherche d'albums
// Source principale : Deezer (gratuit, sans compte, très complet).
// Source complémentaire : Discogs, si un jeton est renseigné dans js/config.js.
// Date originale : MusicBrainz (base ouverte), interrogé quand on choisit un album,
// pour avoir l'année de première sortie et non celle d'une réédition.
// Deezer passe par JSONP (balise <script>) pour fonctionner aussi en ouvrant
// index.html directement depuis le disque (file://).

const Catalog = (function () {
  let counter = 0;

  function jsonp(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const name = "__conductorCb" + (++counter);
      const script = document.createElement("script");
      const timer = setTimeout(() => finish(new Error("timeout")), timeoutMs);

      function finish(err, data) {
        clearTimeout(timer);
        delete window[name];
        script.remove();
        err ? reject(err) : resolve(data);
      }

      window[name] = data => finish(null, data);
      script.onerror = () => finish(new Error("network"));
      script.src = url + (url.includes("?") ? "&" : "?") + "output=jsonp&callback=" + name;
      document.head.appendChild(script);
    });
  }

  // Ignore accents, majuscules et ponctuation pour comparer deux albums
  function key(artist, title) {
    return (artist + "|" + title)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9|]/g, "");
  }

  // ---------- Deezer ----------

  const DEEZER_TYPES = { album: "Album", ep: "EP", single: "Single", compile: "Compilation" };

  function fromDeezer(item) {
    return {
      id: "deezer-" + item.id,
      source: "Deezer",
      sourceId: item.id,
      title: cleanAlbumTitle(item.title),
      edited: cleanAlbumTitle(item.title) !== (item.title || "").trim(),
      type: DEEZER_TYPES[item.record_type] || "Album",
      artist: (item.artist && item.artist.name) || "",
      year: null,       // pas fourni par la recherche, complété par details()
      genre: "",
      trackCount: item.nb_tracks || null,
      cover: item.cover_xl || item.cover_big || "",
      thumb: item.cover_medium || item.cover_small || ""
    };
  }

  function searchDeezer(term) {
    const url = "https://api.deezer.com/search/album?limit=15&q=" + encodeURIComponent(term);
    return jsonp(url, 8000).then(data => {
      if (data.error) throw new Error(data.error.message || "deezer");
      return (data.data || []).map(fromDeezer);
    });
  }

  function deezerDetails(album) {
    return jsonp("https://api.deezer.com/album/" + album.sourceId, 8000).then(d => {
      if (d.error) return album;
      return Object.assign({}, album, {
        year: d.release_date ? Number(d.release_date.slice(0, 4)) : album.year,
        releaseDate: d.release_date || "",
        genre: (d.genres && d.genres.data && d.genres.data[0] && d.genres.data[0].name) || album.genre,
        trackCount: d.nb_tracks || album.trackCount,
        duration: d.duration || null,
        label: d.label || ""
      });
    });
  }

  // ---------- Discogs ----------

  // "Geese (3)" → "Geese" (Discogs numérote les homonymes)
  function cleanDiscogsName(name) {
    return name.replace(/\s\(\d+\)$/, "").replace(/\*$/, "");
  }

  function fromDiscogs(item) {
    const raw = item.title || "";
    const cut = raw.indexOf(" - ");
    const artist = cut > -1 ? raw.slice(0, cut) : "";
    const title = cut > -1 ? raw.slice(cut + 3) : raw;
    return {
      id: "discogs-" + item.type + "-" + item.id,
      source: "Discogs",
      sourceId: item.id,
      title: cleanAlbumTitle(title),
      edited: false,
      type: "Album",
      artist: cleanDiscogsName(artist),
      year: item.year ? Number(item.year) : null,
      genre: (item.style && item.style[0]) || (item.genre && item.genre[0]) || "",
      trackCount: null,
      cover: item.cover_image && !item.cover_image.includes("spacer.gif") ? item.cover_image : "",
      thumb: item.thumb || ""
    };
  }

  function searchDiscogs(term) {
    const token = (typeof CONFIG !== "undefined" && CONFIG.discogsToken) || "";
    if (!token) return Promise.resolve([]);
    // type=master : une seule entrée par album, pas une par pressage
    const url = "https://api.discogs.com/database/search?type=master&per_page=15" +
      "&q=" + encodeURIComponent(term) + "&token=" + encodeURIComponent(token);
    return fetch(url)
      .then(r => { if (!r.ok) throw new Error("discogs " + r.status); return r.json(); })
      .then(data => (data.results || []).map(fromDiscogs));
  }

  // ---------- MusicBrainz : date de première sortie ----------

  function simplify(str) {
    return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function originalRelease(album) {
    const clean = s => s.replace(/["\\]/g, "");
    const query = 'releasegroup:"' + clean(album.title) + '" AND artist:"' + clean(album.artist) + '"';
    const url = "https://musicbrainz.org/ws/2/release-group/?fmt=json&limit=10&query=" + encodeURIComponent(query);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);

    return fetch(url, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error("musicbrainz " + r.status); return r.json(); })
      .then(data => {
        const title = simplify(album.title);
        const artist = simplify(album.artist);
        const dates = (data["release-groups"] || [])
          .filter(rg => {
            const credit = simplify((rg["artist-credit"] || []).map(c => c.name + (c.joinphrase || "")).join(""));
            return simplify(rg.title) === title && (credit.includes(artist) || artist.includes(credit));
          })
          .map(rg => rg["first-release-date"])
          .filter(Boolean)
          .sort();
        return dates[0] || null; // la plus ancienne : "1967-05-26"
      })
      .finally(() => clearTimeout(timer));
  }

  // ---------- API publique ----------

  return {
    key,
    jsonp,

    // Cherche sur Deezer et Discogs en parallèle, fusionne sans doublons
    searchAlbums(term) {
      return Promise.allSettled([searchDeezer(term), searchDiscogs(term)]).then(([dz, dg]) => {
        if (dz.status === "rejected" && dg.status === "rejected") throw dz.reason;
        if (dz.status === "rejected") console.warn("Deezer :", dz.reason);
        if (dg.status === "rejected") console.warn("Discogs :", dg.reason);

        // Une seule entrée par album : si l'original et une réédition
        // remontent tous les deux, on garde l'original
        const byKey = new Map();
        const merged = [];
        [dz, dg].forEach(res => {
          (res.value || []).forEach(album => {
            const k = key(album.artist, album.title);
            const i = byKey.get(k);
            if (i === undefined) {
              byKey.set(k, merged.length);
              merged.push(album);
            } else if (merged[i].edited && !album.edited) {
              merged[i] = album;
            }
          });
        });
        return merged;
      });
    },

    // Infos complémentaires une fois l'album choisi :
    // genre, nombre de titres (Deezer) puis date originale (MusicBrainz)
    details(album) {
      const base = album.source === "Deezer"
        ? deezerDetails(album).catch(() => album)
        : Promise.resolve(album);

      return base.then(full =>
        originalRelease(full)
          .then(date => date
            ? Object.assign({}, full, { year: Number(date.slice(0, 4)), releaseDate: date })
            : full)
          .catch(err => { console.warn("MusicBrainz :", err); return full; })
      );
    }
  };
})();
