// conductor01. — connexion au serveur Navidrome (API Subsonic)
//
// Navidrome tourne sur le téléphone (dans Termux) et sert vos fichiers MP3/FLAC
// en wifi. Le site lui demande la liste des albums, les titres de chaque album
// (d'après vos métadonnées), les pochettes et le flux audio complet.
//
// Le mot de passe n'est jamais enregistré : seul un jeton (md5 du mot de passe
// + un "sel" aléatoire) est gardé dans le navigateur, comme le prévoit l'API.

const Server = (function () {
  const CONF_KEY = "conductor01.server";
  const INDEX_KEY = "conductor01.server.index";
  const API_VERSION = "1.16.1";
  const CLIENT = "conductor01";

  // ---------- MD5 (nécessaire pour le jeton Subsonic) ----------

  function md5(str) {
    function rh(n) { let s = ""; for (let j = 0; j <= 3; j++) s += ((n >> (j * 8 + 4)) & 0x0f).toString(16) + ((n >> (j * 8)) & 0x0f).toString(16); return s; }
    function ad(x, y) { const l = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xffff); }
    function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
    function cm(q, a, b, x, s, t) { return ad(rl(ad(ad(a, q), ad(x, t)), s), b); }
    function ff(a, b, c, d, x, s, t) { return cm((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cm((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cm(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cm(c ^ (b | ~d), a, b, x, s, t); }

    const bytes = new TextEncoder().encode(str);
    const nblk = ((bytes.length + 8) >> 6) + 1;
    const x = new Array(nblk * 16).fill(0);
    for (let i = 0; i < bytes.length; i++) x[i >> 2] |= bytes[i] << ((i % 4) * 8);
    x[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8);
    x[nblk * 16 - 2] = bytes.length * 8;

    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (let i = 0; i < x.length; i += 16) {
      const oa = a, ob = b, oc = c, od = d;
      a = ff(a, b, c, d, x[i], 7, -680876936); d = ff(d, a, b, c, x[i + 1], 12, -389564586); c = ff(c, d, a, b, x[i + 2], 17, 606105819); b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = ff(a, b, c, d, x[i + 4], 7, -176418897); d = ff(d, a, b, c, x[i + 5], 12, 1200080426); c = ff(c, d, a, b, x[i + 6], 17, -1473231341); b = ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = ff(a, b, c, d, x[i + 8], 7, 1770035416); d = ff(d, a, b, c, x[i + 9], 12, -1958414417); c = ff(c, d, a, b, x[i + 10], 17, -42063); b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = ff(a, b, c, d, x[i + 12], 7, 1804603682); d = ff(d, a, b, c, x[i + 13], 12, -40341101); c = ff(c, d, a, b, x[i + 14], 17, -1502002290); b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
      a = gg(a, b, c, d, x[i + 1], 5, -165796510); d = gg(d, a, b, c, x[i + 6], 9, -1069501632); c = gg(c, d, a, b, x[i + 11], 14, 643717713); b = gg(b, c, d, a, x[i], 20, -373897302);
      a = gg(a, b, c, d, x[i + 5], 5, -701558691); d = gg(d, a, b, c, x[i + 10], 9, 38016083); c = gg(c, d, a, b, x[i + 15], 14, -660478335); b = gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = gg(a, b, c, d, x[i + 9], 5, 568446438); d = gg(d, a, b, c, x[i + 14], 9, -1019803690); c = gg(c, d, a, b, x[i + 3], 14, -187363961); b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = gg(a, b, c, d, x[i + 13], 5, -1444681467); d = gg(d, a, b, c, x[i + 2], 9, -51403784); c = gg(c, d, a, b, x[i + 7], 14, 1735328473); b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
      a = hh(a, b, c, d, x[i + 5], 4, -378558); d = hh(d, a, b, c, x[i + 8], 11, -2022574463); c = hh(c, d, a, b, x[i + 11], 16, 1839030562); b = hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = hh(a, b, c, d, x[i + 1], 4, -1530992060); d = hh(d, a, b, c, x[i + 4], 11, 1272893353); c = hh(c, d, a, b, x[i + 7], 16, -155497632); b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
      a = hh(a, b, c, d, x[i + 13], 4, 681279174); d = hh(d, a, b, c, x[i], 11, -358537222); c = hh(c, d, a, b, x[i + 3], 16, -722521979); b = hh(b, c, d, a, x[i + 6], 23, 76029189);
      a = hh(a, b, c, d, x[i + 9], 4, -640364487); d = hh(d, a, b, c, x[i + 12], 11, -421815835); c = hh(c, d, a, b, x[i + 15], 16, 530742520); b = hh(b, c, d, a, x[i + 2], 23, -995338651);
      a = ii(a, b, c, d, x[i], 6, -198630844); d = ii(d, a, b, c, x[i + 7], 10, 1126891415); c = ii(c, d, a, b, x[i + 14], 15, -1416354905); b = ii(b, c, d, a, x[i + 5], 21, -57434055);
      a = ii(a, b, c, d, x[i + 12], 6, 1700485571); d = ii(d, a, b, c, x[i + 3], 10, -1894986606); c = ii(c, d, a, b, x[i + 10], 15, -1051523); b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
      a = ii(a, b, c, d, x[i + 8], 6, 1873313359); d = ii(d, a, b, c, x[i + 15], 10, -30611744); c = ii(c, d, a, b, x[i + 6], 15, -1560198380); b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
      a = ii(a, b, c, d, x[i + 4], 6, -145523070); d = ii(d, a, b, c, x[i + 11], 10, -1120210379); c = ii(c, d, a, b, x[i + 2], 15, 718787259); b = ii(b, c, d, a, x[i + 9], 21, -343485551);
      a = ad(a, oa); b = ad(b, ob); c = ad(c, oc); d = ad(d, od);
    }
    return rh(a) + rh(b) + rh(c) + rh(d);
  }

  // ---------- Réglages ----------

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function config() {
    return readJson(CONF_KEY, null);
  }

  // "192.168.1.23:4533"   → "http://192.168.1.23:4533"
  // "2a04:cec0:…:e1e9"     → "http://[2a04:cec0:…:e1e9]:4533"  (IPv6 : crochets ajoutés)
  // "[2a04:…:e1e9]:4533"   → "http://[2a04:…:e1e9]:4533"
  function normalizeUrl(url) {
    url = (url || "").trim().replace(/\/+$/, "");
    const scheme = (url.match(/^https?:\/\//i) || ["http://"])[0];
    let host = url.replace(/^https?:\/\//i, "");
    // Adresse IPv6 sans crochets (au moins deux ":") : on l'entoure et on ajoute le port
    if (!host.startsWith("[") && (host.match(/:/g) || []).length >= 2) host = "[" + host + "]:4533";
    // Pas de port indiqué : 4533 par défaut
    if (!/\]:\d+$|^[^\[\]:]+:\d+$/.test(host)) host += ":4533";
    return host ? scheme + host : "";
  }

  function authParams(conf) {
    return "u=" + encodeURIComponent(conf.user) + "&t=" + conf.token + "&s=" + conf.salt +
      "&v=" + API_VERSION + "&c=" + CLIENT;
  }

  function url(method, params, conf) {
    conf = conf || config();
    if (!conf) return "";
    const extra = Object.entries(params || {})
      .map(([k, v]) => "&" + k + "=" + encodeURIComponent(v)).join("");
    return conf.url + "/rest/" + method + "?" + authParams(conf) + extra;
  }

  function api(method, params, conf, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
    return fetch(url(method, Object.assign({ f: "json" }, params), conf), { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(data => {
        const res = data["subsonic-response"];
        if (!res) throw new Error("Réponse inattendue");
        if (res.status !== "ok") {
          const err = new Error((res.error && res.error.message) || "Erreur serveur");
          err.code = res.error && res.error.code;
          throw err;
        }
        return res;
      })
      .finally(() => clearTimeout(timer));
  }

  // ---------- Connexion ----------

  function connect(serverUrl, user, password) {
    const salt = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const conf = { url: normalizeUrl(serverUrl), user: user.trim(), salt: salt, token: md5(password + salt) };
    return api("ping", {}, conf, 6000).then(() => {
      writeJson(CONF_KEY, conf);
      return conf;
    });
  }

  function disconnect() {
    try {
      localStorage.removeItem(CONF_KEY);
      localStorage.removeItem(INDEX_KEY);
    } catch (e) {}
  }

  function ping() {
    return api("ping", {}, null, 5000).then(() => true);
  }

  // ---------- Index des albums du serveur ----------

  function toAlbum(a) {
    return {
      id: a.id,
      title: a.name || a.album || "",
      artist: a.artist || "",
      year: a.year || null,
      genre: a.genre || "",
      trackCount: a.songCount || null,
      duration: a.duration || null,
      coverArt: a.coverArt || a.id
    };
  }

  // Récupère tous les albums (par paquets de 500) et les garde en mémoire
  async function refreshIndex() {
    const all = [];
    for (let offset = 0; ; offset += 500) {
      const res = await api("getAlbumList2", { type: "alphabeticalByName", size: 500, offset: offset }, null, 20000);
      const page = (res.albumList2 && res.albumList2.album) || [];
      all.push(...page.map(toAlbum));
      if (page.length < 500) break;
    }
    const index = { fetchedAt: new Date().toISOString(), albums: all };
    writeJson(INDEX_KEY, index);
    document.dispatchEvent(new CustomEvent("server:index"));
    return index;
  }

  // Index en mémoire, avec les albums coupés en plusieurs morceaux réunis
  let mergedCache = null;
  function cachedIndex() {
    const raw = readJson(INDEX_KEY, { fetchedAt: "", albums: [] });
    if (!mergedCache || mergedCache.fetchedAt !== raw.fetchedAt || mergedCache.count !== raw.albums.length) {
      mergedCache = { fetchedAt: raw.fetchedAt, count: raw.albums.length, albums: mergeParts(raw.albums) };
    }
    return { fetchedAt: raw.fetchedAt, albums: mergedCache.albums };
  }

  // ---------- Albums coupés en plusieurs morceaux ----------
  // Navidrome sépare un album dès qu'une piste a des métadonnées différentes
  // (artiste de l'album, date, "feat."…). On réunit les morceaux qui ont le même
  // titre (sans "Deluxe", "Remaster"…) et le même artiste principal.

  // "Damso feat. Hamza" → "damso" ; "Travis Scott, Drake" → "travisscott"
  function mainArtist(s) {
    return simplify((s || "").split(/\s+(?:feat\.?|ft\.?|featuring|with)\s+|\s*[,;/]\s*|\s+&\s+|\s+x\s+/i)[0]);
  }

  const VARIOUS = /^(variousartists|various|artistesdivers|va|compilation)$/;

  // Même artiste principal, ou l'un apparaît dans le crédit complet de l'autre
  // ("Drake & Travis Scott" ↔ "Travis Scott"), ou l'un des deux est "Various Artists"
  function compatibleArtists(a, b) {
    const x = mainArtist(a), y = mainArtist(b);
    if (!x || !y) return true;
    if (x === y || x.includes(y) || y.includes(x)) return true;
    if (VARIOUS.test(x) || VARIOUS.test(y)) return true;
    return simplify(a).includes(y) || simplify(b).includes(x);
  }

  function mergeParts(list) {
    const byTitle = new Map();
    const groups = [];
    (list || []).forEach(a => {
      const key = simplify(cleanAlbumTitle(a.title));
      const bucket = byTitle.get(key) || [];
      let g = bucket.find(g => compatibleArtists(g.parts[0].artist, a.artist));
      if (!g) {
        g = { parts: [] };
        bucket.push(g);
        byTitle.set(key, bucket);
        groups.push(g);
      }
      g.parts.push(a);
    });
    return groups.map(({ parts }) => {
      if (parts.length === 1) return Object.assign({ ids: [parts[0].id], partSizes: [parts[0].trackCount] }, parts[0]);
      const main = parts.slice().sort((x, y) => (y.trackCount || 0) - (x.trackCount || 0))[0];
      const artist = parts.map(p => p.artist).sort((x, y) => x.length - y.length)[0];
      const years = parts.map(p => p.year).filter(Boolean);
      return {
        id: main.id,
        ids: parts.map(p => p.id),
        partSizes: parts.map(p => p.trackCount || 0),
        title: main.title,
        artist: artist,
        year: years.length ? Math.min(...years) : null,
        genre: main.genre,
        trackCount: parts.reduce((s, p) => s + (p.trackCount || 0), 0),
        duration: parts.reduce((s, p) => s + (p.duration || 0), 0),
        coverArt: main.coverArt
      };
    });
  }

  // ---------- Correspondance collection ↔ fichiers ----------

  function simplify(str) {
    return (str || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function sameArtist(a, b) {
    const x = simplify(a), y = simplify(b);
    return x && y && (x === y || x.includes(y) || y.includes(x));
  }

  // Album du serveur correspondant à un album de la collection (ou null)
  //   album.serverId = "none" : vous avez délié l'album à la main
  //   album.serverId = "…"    : relié à la main ou déjà trouvé
  //   sinon                   : même titre (sans "Deluxe", "Remaster"…) + même artiste
  function matchFor(album, index) {
    if (!album || album.serverId === "none") return null;
    const list = (index || cachedIndex()).albums;
    if (album.serverId) return list.find(s => (s.ids || [s.id]).includes(album.serverId)) || { id: album.serverId, ids: [album.serverId] };
    const title = simplify(cleanAlbumTitle(album.title));
    return list.find(s => simplify(cleanAlbumTitle(s.title)) === title && sameArtist(s.artist, album.artist)) || null;
  }

  // ---------- Contenu d'un album ----------

  // Contenu d'un album (tous ses morceaux s'il a été coupé par Navidrome)
  async function getAlbum(match) {
    const ids = typeof match === "string" ? [match] : (match.ids || [match.id]);
    const parts = await Promise.all(ids.map(id => api("getAlbum", { id: id }, null, 20000).then(res => res.album || {})));

    // Si deux morceaux ont les mêmes numéros (disque, piste), on les met l'un après l'autre
    const seen = new Set();
    let clash = false;
    parts.forEach(p => (p.song || []).forEach(s => {
      const k = (s.discNumber || 1) + "-" + (s.track || 0);
      if (seen.has(k)) clash = true;
      seen.add(k);
    }));
    const songs = [];
    parts.forEach((p, i) => (p.song || []).forEach(s => songs.push(clash ? Object.assign({}, s, { discNumber: i + 1 }) : s)));
    songs.sort((x, y) => ((x.discNumber || 1) - (y.discNumber || 1)) || ((x.track || 0) - (y.track || 0)));

    const main = parts.slice().sort((x, y) => (y.song || []).length - (x.song || []).length)[0] || {};
    {
      const a = main;
      return Object.assign(toAlbum(a), {
        tracks: songs.map(s => ({
          title: s.title || "",
          duration: s.duration || 0,
          track: s.track || null,
          disc: s.discNumber || 1,
          src: streamUrl(s.id),
          songId: s.id,
          format: (s.suffix || "").toUpperCase()
        }))
      });
    }
  }

  // Paroles intégrées à vos fichiers (extension OpenSubsonic de Navidrome)
  function lyrics(songId) {
    return api("getLyricsBySongId", { id: songId }).then(res => {
      const list = (res.lyricsList && res.lyricsList.structuredLyrics) || [];
      // On préfère la version non synchronisée si les deux existent
      const best = list.find(l => !l.synced) || list[0];
      const text = best ? (best.line || []).map(l => l.value || "").join("\n").trim() : "";
      return text || null;
    });
  }

  function search(query) {
    return api("search3", { query: query, albumCount: 20, artistCount: 0, songCount: 0 })
      .then(res => mergeParts(((res.searchResult3 && res.searchResult3.album) || []).map(toAlbum)));
  }

  // format=raw : le fichier tel quel, sans conversion (le téléphone n'a pas à travailler)
  function streamUrl(songId) {
    return url("stream", { id: songId, format: "raw" });
  }

  function coverUrl(coverId, size) {
    return coverId ? url("getCoverArt", { id: coverId, size: size || 600 }) : "";
  }

  return {
    config, connect, disconnect, ping,
    refreshIndex, cachedIndex, matchFor,
    getAlbum, search, coverUrl, lyrics,
    isConfigured: () => !!config(),
    _md5: md5
  };
})();
