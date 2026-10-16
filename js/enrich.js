// conductor01. — infos détaillées d'un album (page album)
//
// Deezer      : liste des titres, durées, extraits de 30 s, label
// MusicBrainz : date de sortie exacte, mots-clés (genres et tags de la communauté)
// Discogs     : genre et styles (si un jeton est renseigné dans js/config.js)
//
// Les infos sont récupérées une fois puis enregistrées dans la collection.
// Seuls les extraits audio sont redemandés à chaque visite (leurs liens expirent).

const Enrich = (function () {

  function simplify(str) {
    return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function sameText(a, b) {
    const x = simplify(a), y = simplify(b);
    return x && y && (x === y || x.includes(y) || y.includes(x));
  }

  function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function fetchJson(url, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
    return fetch(url, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(url + " → " + r.status); return r.json(); })
      .finally(() => clearTimeout(timer));
  }

  // ---------- Deezer ----------

  function deezerIdOf(album) {
    if (album.deezerId) return Promise.resolve(album.deezerId);
    if (/^deezer-\d+$/.test(album.id)) return Promise.resolve(album.id.slice(7));

    // Album venu d'une autre source : on le cherche sur Deezer
    const q = 'artist:"' + album.artist + '" album:"' + album.title + '"';
    return Catalog.jsonp("https://api.deezer.com/search/album?limit=10&q=" + encodeURIComponent(q), 8000)
      .then(data => {
        const hit = (data.data || []).find(d =>
          simplify(cleanAlbumTitle(d.title)) === simplify(album.title) &&
          sameText(d.artist && d.artist.name, album.artist));
        return hit ? String(hit.id) : null;
      });
  }

  function deezerAlbum(id) {
    return Promise.all([
      Catalog.jsonp("https://api.deezer.com/album/" + id, 8000),
      Catalog.jsonp("https://api.deezer.com/album/" + id + "/tracks?limit=200", 8000)
    ]).then(([info, tracks]) => {
      if (info.error) throw new Error(info.error.message || "deezer");
      return {
        label: info.label || "",
        duration: info.duration || null,
        releaseDate: info.release_date || "",
        genre: (info.genres && info.genres.data && info.genres.data[0] && info.genres.data[0].name) || "",
        cover: info.cover_xl || "",
        tracks: (tracks.data || []).map(t => ({
          title: cleanAlbumTitle(t.title || t.title_short || ""),
          duration: t.duration || 0,
          preview: t.preview || ""
        }))
      };
    });
  }

  // ---------- MusicBrainz ----------

  function musicbrainz(album) {
    const esc = s => (s || "").replace(/["\\]/g, "");
    const query = 'releasegroup:"' + esc(album.title) + '" AND artist:"' + esc(album.artist) + '"';
    return fetchJson("https://musicbrainz.org/ws/2/release-group/?fmt=json&limit=10&query=" + encodeURIComponent(query))
      .then(data => {
        const matches = (data["release-groups"] || []).filter(rg => {
          const credit = (rg["artist-credit"] || []).map(c => c.name + (c.joinphrase || "")).join("");
          return simplify(rg.title) === simplify(album.title) && sameText(credit, album.artist);
        });
        if (!matches.length) return null;
        // L'entrée la plus ancienne = l'album original
        matches.sort((a, b) => (a["first-release-date"] || "9999").localeCompare(b["first-release-date"] || "9999"));
        const rg = matches[0];

        // MusicBrainz demande 1 requête par seconde maximum
        return wait(1100)
          .then(() => fetchJson("https://musicbrainz.org/ws/2/release-group/" + rg.id + "?fmt=json&inc=genres+tags"))
          .then(full => {
            const byCount = list => (list || [])
              .filter(x => x.count > 0)
              .sort((a, b) => b.count - a.count)
              .map(x => x.name.toLowerCase());
            const genres = byCount(full.genres);
            const tags = byCount(full.tags).filter(t => !genres.includes(t));
            return {
              mbid: rg.id,
              releaseDate: rg["first-release-date"] || "",
              genres: genres,
              keywords: genres.concat(tags).slice(0, 10)
            };
          })
          .catch(() => ({ mbid: rg.id, releaseDate: rg["first-release-date"] || "", genres: [], keywords: [] }));
      });
  }

  // ---------- Discogs ----------

  function discogs(album) {
    const token = (typeof CONFIG !== "undefined" && CONFIG.discogsToken) || "";
    if (!token) return Promise.resolve(null);
    const url = "https://api.discogs.com/database/search?type=master&per_page=5" +
      "&artist=" + encodeURIComponent(album.artist) +
      "&release_title=" + encodeURIComponent(album.title) +
      "&token=" + encodeURIComponent(token);
    return fetchJson(url).then(data => {
      const hit = (data.results || [])[0];
      if (!hit) return null;
      return {
        genre: (hit.genre && hit.genre[0]) || "",
        styles: hit.style || [],
        label: (hit.label && hit.label[0]) || ""
      };
    });
  }

  // ---------- Tout ensemble ----------

  function isEmpty(v) {
    return v == null || v === "" || (Array.isArray(v) && v.length === 0);
  }

  // Renvoie { patch, tracks }
  //   patch  : champs à enregistrer (seulement ceux encore vides, pour ne pas
  //            écraser vos modifications)
  //   tracks : titres avec extraits audio frais (ou null)
  async function run(album) {
    const patch = {};
    const fill = (field, value) => {
      if (isEmpty(album[field]) && !isEmpty(value)) patch[field] = value;
    };
    let liveTracks = null;

    // 1. Deezer
    try {
      const dzId = await deezerIdOf(album);
      if (dzId) {
        patch.deezerId = dzId;
        const dz = await deezerAlbum(dzId);
        liveTracks = dz.tracks.length ? dz.tracks : null;
        fill("tracks", dz.tracks.map(t => ({ title: t.title, duration: t.duration })));
        fill("label", dz.label);
        fill("duration", dz.duration || dz.tracks.reduce((s, t) => s + t.duration, 0));
        fill("trackCount", dz.tracks.length);
        fill("releaseDate", dz.releaseDate);
        fill("genre", dz.genre);
        fill("cover", dz.cover);
      }
    } catch (e) {
      console.warn("Deezer :", e);
    }

    // 2. MusicBrainz et Discogs : une seule fois par album
    if (!album.enrichedAt) {
      const [mb, dg] = await Promise.all([
        musicbrainz(album).catch(e => { console.warn("MusicBrainz :", e); return null; }),
        discogs(album).catch(e => { console.warn("Discogs :", e); return null; })
      ]);

      if (mb) {
        patch.mbid = mb.mbid;
        // Date originale : on garde la plus ancienne connue
        const current = patch.releaseDate || album.releaseDate || "";
        if (mb.releaseDate && (!current || mb.releaseDate.slice(0, 4) < current.slice(0, 4) ||
            (mb.releaseDate.slice(0, 4) === current.slice(0, 4) && mb.releaseDate.length > current.length))) {
          patch.releaseDate = mb.releaseDate;
        }
        fill("keywords", mb.keywords);
      }
      if (dg) {
        // Le genre Discogs (Rock, Jazz…) est plus parlant que celui de Deezer
        if (dg.genre) patch.genre = dg.genre;
        fill("styles", dg.styles);
        fill("label", dg.label);
      }
      // Sans Discogs, les styles viennent des genres MusicBrainz
      if (mb && isEmpty(album.styles) && isEmpty(patch.styles)) {
        fill("styles", mb.genres.slice(0, 5));
      }
      patch.enrichedAt = new Date().toISOString();
    }

    const date = patch.releaseDate || album.releaseDate;
    if (date) patch.year = Number(date.slice(0, 4));

    return { patch, tracks: liveTracks };
  }

  return { run };
})();
