// conductor. — paroles (page album)
//
// Sources, dans l'ordre :
//   1. vos paroles (modifiées à la main sur le site)
//   2. les paroles de vos fichiers : stockage local (.lrc à côté du morceau ou
//      paroles intégrées au fichier) ou Navidrome
//   3. les paroles synchronisées gardées par le karaoké (sans les horodatages)
//   4. LRCLIB (lrclib.net), base de paroles ouverte, gratuite, sans compte ;
//      recherche tolérante (js/karaoke.js : sans « feat. », « Remastered »…)
//
// Les paroles trouvées sont enregistrées dans datastorage/lyrics/, pour être
// disponibles ensuite sans internet.
// Les en-têtes entre crochets ([Verse 1: David Gilmour], [Chorus]…) sont mis en forme.

const Lyrics = (function () {

  function key(title) {
    return (title || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  // "[01:23.45] Hello" → "Hello" (paroles synchronisées → texte simple)
  function stripTimestamps(lrc) {
    return (lrc || "").split("\n")
      .map(l => l.replace(/^(\s*\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\])+\s*/, ""))
      .join("\n");
  }

  function fetchJson(url, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
    return fetch(url, { signal: ctrl.signal })
      .then(r => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .finally(() => clearTimeout(timer));
  }

  // ---------- LRCLIB ----------

  function fromLrclib(hit) {
    if (!hit) return null;
    if (hit.instrumental) return { text: "[Instrumental]", source: "LRCLIB" };
    const text = (hit.plainLyrics || stripTimestamps(hit.syncedLyrics) || "").trim();
    return text ? { text, source: "LRCLIB" } : null;
  }

  async function lrclib(album, track) {
    // Recherche tolérante partagée avec le karaoké
    if (typeof Karaoke !== "undefined") {
      const r = await Karaoke.lrclib({ artist: album.artist, album: album.title, title: track.title, duration: track.duration });
      if (!r) return null;
      if (r.instrumental) return { text: "[Instrumental]", source: "LRCLIB" };
      const text = (r.plain || Karaoke.stripTimes(r.lrc) || "").trim();
      return text ? { text, source: "LRCLIB" } : null;
    }
    const base = "https://lrclib.net/api/";
    const q = "artist_name=" + encodeURIComponent(album.artist) +
      "&track_name=" + encodeURIComponent(track.title);

    // 1. Correspondance exacte (titre, artiste, album, durée à ±2 s)
    let url = base + "get?" + q + "&album_name=" + encodeURIComponent(album.title);
    if (track.duration) url += "&duration=" + Math.round(track.duration);
    const exact = fromLrclib(await fetchJson(url));
    if (exact) return exact;

    // 2. Recherche plus large (titre + artiste), on garde un résultat de durée proche
    const found = (await fetchJson(base + "search?" + q)) || [];
    const close = found.filter(h => !track.duration || !h.duration || Math.abs(h.duration - track.duration) <= 5);
    for (const hit of close.concat(found)) {
      const res = fromLrclib(hit);
      if (res) return res;
    }
    return null;
  }

  // ---------- Vos fichiers (Navidrome) ----------

  async function fromFiles(track) {
    // Stockage local : demandé à l'enveloppe, qui ouvre les fichiers
    const src = track.preview || track.src || "";
    if (/^sd:/.test(src) && typeof SD !== "undefined" && SD.call) {
      try {
        const r = await SD.call("lyrics", src);
        const text = r && (r.text || (r.lrc && stripTimestamps(r.lrc).replace(/^\s*\[[a-z]+:.*\]\s*$/gim, "").trim()));
        return text ? { text, source: r.source === "fichier .lrc" ? "fichier .lrc" : "vos fichiers" } : null;
      } catch (e) {
        return null;
      }
    }
    if (!track.songId || typeof Server === "undefined" || !Server.isConfigured()) return null;
    try {
      const lines = await Server.lyrics(track.songId);
      return lines ? { text: lines, source: "vos fichiers" } : null;
    } catch (e) {
      return null;
    }
  }

  // Paroles synchronisées déjà enregistrées par le karaoké
  // (datastorage/lyrics-synced/) : leur texte, sans les horodatages.
  // Lues par l'enveloppe (seule à accéder au disque) : marche hors ligne.
  async function fromSaved(album, track) {
    if (typeof SD === "undefined" || !SD.call) return null;
    try {
      const lrc = await SD.call("savedSynced", album.id, track.title);
      const text = lrc && stripTimestamps(lrc).replace(/^\s*\[[a-z]+:.*\]\s*$/gim, "").trim();
      return text ? { text, source: "karaoké (enregistrées)" } : null;
    } catch (e) {
      return null;
    }
  }

  async function find(album, track) {
    return (await fromFiles(track)) || (await fromSaved(album, track)) || (await lrclib(album, track));
  }

  // ---------- Affichage ----------

  // Texte → éléments : les lignes "[…]" deviennent des intertitres discrets
  function render(text) {
    const box = document.createElement("div");
    box.className = "lyrics-text";
    let para = null;
    (text || "").replace(/\r/g, "").split("\n").forEach(line => {
      const t = line.trim();
      const section = t.match(/^\[(.+)\]$/);
      if (section) {
        const h = document.createElement("p");
        h.className = "lyrics-section";
        h.textContent = section[1];
        box.appendChild(h);
        para = null;
      } else if (!t) {
        para = null;
      } else {
        if (!para) {
          para = document.createElement("p");
          para.className = "lyrics-para";
          box.appendChild(para);
        } else {
          para.appendChild(document.createElement("br"));
        }
        para.appendChild(document.createTextNode(t));
      }
    });
    return box;
  }

  return { key, find, render };
})();
