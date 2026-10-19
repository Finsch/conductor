// conductor. — paroles synchronisées (karaoké, plein écran, touche K)
// et recherche LRCLIB partagée avec la page album (js/lyrics.js)
//
// Karaoké (enveloppe), dans l'ordre :
//   0. déjà trouvées ou calées à la main : datastorage/lyrics-synced/
//   1. stockage local : fichier .lrc à côté du morceau, sinon paroles intégrées
//   2. paroles synchronisées intégrées à vos fichiers (Navidrome)
//   3. LRCLIB (lrclib.net) : base ouverte, gratuite, sans compte
// Les paroles synchronisées trouvées (1 à 3) sont enregistrées en 0 : ensuite,
// plus besoin d'internet. Sans version synchronisée : paroles simples (fichiers,
// celles de la page album, LRCLIB), à caler à la main si on veut (bouton « caler »).
//
// LRCLIB : recherche tolérante — titre sans « (feat. …) », « - Remastered 2011 »,
// « (Live) »…, artiste principal seul, avec ou sans l'album, durée à ±3 s.

const Karaoke = (function () {
  const cache = new Map();

  // Clé d'un titre (même règle que js/lyrics.js)
  function key(title) {
    return (title || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  // ---------- Format LRC ----------

  // « [01:23.45]Hello » (plusieurs horodatages possibles par ligne, [offset:+250])
  function parseLrc(text) {
    if (!text) return null;
    let offset = 0;
    const lines = [];
    text.replace(/\r/g, "").split("\n").forEach(raw => {
      const off = raw.match(/^\s*\[offset:\s*([+-]?\d+)\s*\]/i);
      if (off) { offset = Number(off[1]) / 1000; return; }
      const stamps = [];
      let rest = raw;
      let m;
      while ((m = rest.match(/^\s*\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/))) {
        const frac = m[3] ? Number(m[3]) / Math.pow(10, m[3].length) : 0;
        stamps.push(Number(m[1]) * 60 + Number(m[2]) + frac);
        rest = rest.slice(m[0].length);
      }
      // Horodatages mot à mot (<00:12.34>) : retirés
      const words = rest.replace(/<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g, "").trim();
      stamps.forEach(t => lines.push({ t, text: words }));
    });
    if (!lines.length) return null;
    lines.forEach(l => { l.t = Math.max(0, l.t - offset); });
    lines.sort((a, b) => a.t - b.t);
    return lines;
  }

  const stamp = t => {
    const m = Math.floor(t / 60), s = t - m * 60;
    return "[" + String(m).padStart(2, "0") + ":" + s.toFixed(2).padStart(5, "0") + "]";
  };

  function toLrc(lines, meta) {
    const head = [];
    if (meta && meta.artist) head.push("[ar:" + meta.artist + "]");
    if (meta && meta.album) head.push("[al:" + meta.album + "]");
    if (meta && meta.title) head.push("[ti:" + meta.title + "]");
    if (meta && meta.by) head.push("[by:" + meta.by + "]");
    return head.concat(lines.map(l => stamp(l.t) + l.text)).join("\n") + "\n";
  }

  const stripTimes = lrc => (lrc || "").split("\n")
    .map(l => l.replace(/^(\s*\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\])+\s*/, "").replace(/<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g, ""))
    .filter(l => !/^\s*\[[a-z]+:.*\]\s*$/i.test(l)).join("\n").trim();

  // ---------- LRCLIB ----------

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

  // « Song (feat. X) - Remastered 2011 » → « Song »
  function cleanTitle(t) {
    return (t || "")
      .replace(/\s*[(\[](feat\.?|ft\.?|featuring|with|avec)\s[^)\]]*[)\]]/gi, "")
      .replace(/\s*[(\[][^)\]]*(remaster|live|version|edit|mono|stereo|bonus|demo|mix\b|session|take|instrumental)[^)\]]*[)\]]/gi, "")
      .replace(/\s+[-–—]\s+[^-–—]*(remaster|live|version|edit|mono|stereo|bonus|demo|session|take)[^-–—]*$/i, "")
      .replace(/\s+(feat\.?|ft\.?|featuring)\s.+$/i, "")
      .trim() || t;
  }

  // « Damso feat. Hamza », « Drake & 21 Savage », « A, B » → artiste principal
  function mainArtist(a) {
    return ((a || "").split(/\s+(?:feat\.?|ft\.?|featuring|with|x|et|and|&)\s+|\s*[,;/]\s*/i)[0] || a || "").trim();
  }

  // { lines, plain, instrumental } ou null
  async function lrclib(info) {
    const base = "https://lrclib.net/api/";
    const title = cleanTitle(info.title), artist = mainArtist(info.artist);
    const dur = info.duration ? Math.round(info.duration) : 0;
    const close = (h, tol) => !dur || !h.duration || Math.abs(h.duration - dur) <= tol;
    const hits = [];
    const add = list => (list || []).forEach(h => { if (h && !hits.some(x => x.id === h.id)) hits.push(h); });

    // 1. Correspondance exacte (titre et artiste tels quels, puis nettoyés)
    const gets = [[info.artist, info.title]];
    if (title !== info.title || artist !== info.artist) gets.push([artist, title]);
    for (const [ar, ti] of gets) {
      let url = base + "get?artist_name=" + encodeURIComponent(ar || "") + "&track_name=" + encodeURIComponent(ti || "");
      if (info.album) url += "&album_name=" + encodeURIComponent(info.album);
      if (dur) url += "&duration=" + dur;
      const h = await fetchJson(url).catch(() => null);
      if (h && (h.syncedLyrics || h.instrumental)) return pick([h], close);
      add([h]);
    }
    // 2. Recherches plus larges (artiste complet, puis artiste principal seul)
    const artists = [info.artist, artist].filter((v, i, l) => v && l.indexOf(v) === i);
    for (const ar of artists) {
      if (hits.some(h => h.syncedLyrics && close(h, 3))) break;
      add(await fetchJson(base + "search?track_name=" + encodeURIComponent(title) + "&artist_name=" + encodeURIComponent(ar)).catch(() => null));
    }
    if (!hits.some(h => h.syncedLyrics && close(h, 3))) {
      add(await fetchJson(base + "search?q=" + encodeURIComponent(title + " " + artist)).catch(() => null));
    }
    return pick(hits, close);
  }

  function pick(hits, close) {
    hits = hits.filter(Boolean);
    const synced = hits.find(h => h.syncedLyrics && close(h, 3)) || hits.find(h => h.syncedLyrics && close(h, 8));
    const plainHit = hits.find(h => h.plainLyrics && close(h, 8));
    if (synced) return { lines: parseLrc(synced.syncedLyrics), plain: synced.plainLyrics || null, lrc: synced.syncedLyrics, source: "LRCLIB" };
    if (hits.some(h => h.instrumental && close(h, 3)) && !plainHit) return { lines: null, plain: null, instrumental: true, source: "LRCLIB" };
    return plainHit ? { lines: null, plain: plainHit.plainLyrics, source: "LRCLIB" } : null;
  }

  // ---------- Karaoké (enveloppe) ----------

  // Identifiant Navidrome du morceau : paramètre id= de son adresse
  function songIdOf(src) {
    const m = /[?&]id=([^&]+)/.exec(src || "");
    return m && /\/rest\/stream/.test(src) ? decodeURIComponent(m[1]) : null;
  }

  const hasDisk = () => typeof Disk !== "undefined" && Disk.readSynced;

  function save(info, lrc, source) {
    if (hasDisk() && info.albumId && lrc) {
      Disk.writeSynced(info.albumId, info.title, toLrc(parseLrc(lrc) || [], { artist: info.artist, album: info.album, title: info.title, by: source }));
    }
  }

  // Texte simple trouvé par le karaoké : gardé aussi pour la page album
  // (datastorage/lyrics/<album>.js), sans écraser des paroles déjà présentes
  async function savePlain(info, text, source) {
    if (!text || !text.trim() || !info.albumId || typeof Disk === "undefined" || !Disk.readLyrics) return;
    try {
      const data = Object.assign({}, (await Disk.readLyrics(info.albumId)) || {});
      const k = key(info.title);
      if (data[k] && data[k].text) return;
      data[k] = { text: text.trim(), source: source || "karaoké" };
      Disk.writeLyrics(info.albumId, data);
    } catch (e) {}
  }

  async function lookup(info) {
    const res = await lookupSources(info);
    // Texte simple : celui trouvé, sinon les paroles synchronisées sans horodatage
    if (res && !res.fromSaved) {
      const text = res.plain || (res.lines ? res.lines.map(l => l.text).filter(Boolean).join("\n") : "");
      savePlain(info, text, res.plainSource || res.source);
    }
    return res;
  }

  async function lookupSources(info) {
    let plain = null, plainSource = "", plainSaved = false;
    const keepPlain = (text, src) => { if (!plain && text && text.trim()) { plain = text.trim(); plainSource = src; } };

    // 0. Déjà enregistrées (trouvées avant, ou calées à la main)
    if (hasDisk() && info.albumId) {
      const saved = parseLrc(await Disk.readSynced(info.albumId, info.title).catch(() => null));
      if (saved) return { lines: saved, plain: null, source: "enregistrées", fromSaved: true };
    }
    // 1. Stockage local : .lrc, sinon paroles intégrées au fichier
    if (typeof SD !== "undefined" && SD.lyricsFor && /^sd:/.test(info.src || "")) {
      const r = await SD.lyricsFor(info.src).catch(() => null);
      const lines = r && parseLrc(r.lrc);
      if (lines) { save(info, r.lrc, r.source); return { lines, plain: null, source: r.source }; }
      if (r) keepPlain(r.text, r.source);
    }
    // 2. Navidrome
    const songId = songIdOf(info.src);
    if (songId && typeof Server !== "undefined" && Server.isConfigured()) {
      const lines = Server.syncedLyrics ? await Server.syncedLyrics(songId).catch(() => null) : null;
      if (lines && lines.length) { save(info, toLrc(lines), "vos fichiers"); return { lines, plain: null, source: "vos fichiers" }; }
      if (!plain && Server.lyrics) keepPlain(await Server.lyrics(songId).catch(() => null), "vos fichiers");
    }
    // Paroles de la page album (les vôtres, ou trouvées avant)
    if (!plain && hasDisk() && info.albumId) {
      const data = await Disk.readLyrics(info.albumId).catch(() => null);
      const k = key(info.title);
      if (data && data[k] && data[k].text) { keepPlain(data[k].text, data[k].source || "page album"); plainSaved = true; }
    }
    // 3. LRCLIB
    const net = await lrclib(info).catch(() => null);
    if (net && net.lines) { save(info, net.lrc, "LRCLIB"); return Object.assign({}, net, { plain: plain || net.plain, plainSource: plain ? plainSource : "LRCLIB" }); }
    if (net && net.instrumental && !plain) return net;
    if (net && net.plain) keepPlain(net.plain, "LRCLIB");
    // Paroles simples déjà gardées pour la page album : rien à réenregistrer
    return { lines: null, plain, source: plainSource, fromSaved: plainSaved };
  }

  // info : { albumId, artist, album, title, duration, src }
  function cacheKey(info) {
    return [info.albumId, info.artist, info.album, info.title, Math.round(info.duration || 0)].join("|").toLowerCase();
  }

  function find(info) {
    const k = cacheKey(info);
    if (!cache.has(k)) {
      const p = lookup(info);
      cache.set(k, p);
      p.catch(() => cache.delete(k));
    }
    return cache.get(k);
  }

  // Paroles calées à la main : enregistrées et utilisées tout de suite
  function saveManual(info, lines) {
    const lrc = toLrc(lines, { artist: info.artist, album: info.album, title: info.title, by: "calage manuel" });
    cache.set(cacheKey(info), Promise.resolve({ lines, plain: null, source: "calées à la main" }));
    return hasDisk() ? Disk.writeSynced(info.albumId, info.title, lrc) : Promise.resolve(false);
  }

  // Ligne en cours à l'instant t (secondes) : index, ou -1 avant la 1re ligne
  function lineAt(lines, t) {
    let lo = 0, hi = lines.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].t <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }

  return { find, parseLrc, toLrc, stripTimes, lineAt, lrclib, cleanTitle, mainArtist, saveManual, key };
})();
