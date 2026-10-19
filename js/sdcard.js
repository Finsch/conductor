// conductor. — fichiers audio sur le stockage local : carte SD, clé USB,
// disque externe, dossier du PC… (autant de dossiers que voulu)
//
// Un navigateur ne peut pas ouvrir un dossier à partir d'un chemin tapé
// (« E:\Musique ») : on choisit chaque dossier une fois dans la fenêtre de
// Windows, le navigateur s'en souvient, puis un clic « Autoriser » suffit à
// chaque session.
//
// - Analyse : tous les fichiers audio du dossier (sous-dossiers compris) ;
//   titre, artiste, album, année, n° de piste lus dans les tags (FLAC, MP3),
//   sinon déduits des noms de dossiers et de fichiers. Un dossier = un album
//   (les sous-dossiers « CD1 », « Disc 2 »… sont réunis).
// - L'index est gardé dans le navigateur (localStorage, conductor01.sd.index) :
//   toutes les pages s'en servent pour relier les albums de la collection.
// - Lecture : seule l'enveloppe (conductor.html) ouvre les fichiers ; les
//   morceaux ont pour adresse « sd:<dossier>/chemin/vers/fichier.flac ».
// - Les pages du cadre envoient leurs demandes (ajouter, analyser, retirer)
//   à l'enveloppe par message ; l'état est partagé par localStorage
//   (conductor01.sd.status).

const SD = (function () {
  const INDEX_KEY = "conductor01.sd.index";
  const STATUS_KEY = "conductor01.sd.status";
  const SHELL = window.top === window && !!window.CONDUCTOR_SHELL;
  const AUDIO = /\.(mp3|flac|m4a|aac|ogg|oga|opus|wav|webm)$/i;
  const DISC_DIR = /^(cd|dis[ck])\s*[-_ ]?(\d{1,2})$/i;
  const SKIP_DIR = /^(\.|\$|system volume information$|recycler$)/i;

  // ---------- Index (partagé par toutes les pages) ----------

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function writeJson(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { console.warn("Carte SD : index trop gros pour le navigateur", e); }
  }

  let cache = null;
  function index() {
    const raw = localStorage.getItem(INDEX_KEY) || "";
    if (!cache || cache.raw !== raw) {
      let data = null;
      try { data = JSON.parse(raw); } catch (e) {}
      // Ancien format (un seul dossier, sans « sources ») : à réanalyser
      if (!data || !Array.isArray(data.sources)) data = { sources: [], albums: [] };
      cache = { raw, data };
    }
    return cache.data;
  }

  function status() {
    return readJson(STATUS_KEY, { state: "none" });
  }

  // Au moins un dossier a été ajouté (même s'il faut le réautoriser)
  function isConfigured() {
    return index().sources.length > 0;
  }

  // Pochette à prendre dans les fichiers : absente, ou seulement en ligne
  // (le site d'origine, comme Discogs, a refusé la copie dans datastorage/covers)
  function needsCover(a) {
    return !!a && (!a.cover || (/^https?:/i.test(a.cover) && !!a.coverCacheFailed));
  }

  function sourceOf(dirOrPath) {
    const id = (dirOrPath || "").split("/")[0];
    return index().sources.find(s => s.id === id) || null;
  }

  // ---------- Correspondance collection ↔ carte SD ----------

  function simplify(str) {
    return (str || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function sameArtist(a, b) {
    const x = simplify(a), y = simplify(b);
    return !!(x && y && (x === y || x.includes(y) || y.includes(x)));
  }

  // album.sdDir = "none" : délié à la main ; = "dossier" : relié à ce dossier
  function matchFor(album) {
    if (!album || album.sdDir === "none") return null;
    const list = index().albums;
    if (!list.length) return null;
    if (album.sdDir) {
      const hit = list.find(s => s.dir === album.sdDir);
      if (hit) return hit;
    }
    const title = simplify(cleanAlbumTitle(album.title));
    return list.find(s => simplify(cleanAlbumTitle(s.title)) === title && sameArtist(s.artist, album.artist)) || null;
  }

  // Morceaux prêts pour le lecteur (adresse « sd:… »)
  function tracksOf(match) {
    return (match.tracks || []).map(t => ({
      title: t.title, duration: t.duration || 0, track: t.track || null, disc: t.disc || 1,
      src: "sd:" + t.path, format: (t.path.split(".").pop() || "").toUpperCase()
    }));
  }

  // ---------- Demandes des pages → enveloppe ----------

  function send(name, arg) {
    if (SHELL) return SHELL_API[name] ? SHELL_API[name](arg) : undefined;
    try { window.top.postMessage({ conductor: true, type: "cmd", name: "sd:" + name, args: [arg] }, "*"); } catch (e) {}
  }

  const SHELL_API = {};
  const api = {
    index, status, isConfigured, matchFor, tracksOf, sourceOf, needsCover,
    add: () => send("add"),                 // ajouter un dossier
    rescan: id => send("rescan", id),       // un dossier, ou tous (sans id)
    remove: id => send("remove", id),
    allow: () => send("allow"),
    supported: "showDirectoryPicker" in window
  };

  // Les pages préviennent quand l'index ou l'état change (autre page / enveloppe)
  window.addEventListener("storage", e => {
    if (e.key === INDEX_KEY || e.key === STATUS_KEY) document.dispatchEvent(new CustomEvent("sd:change"));
  });

  // Pages du cadre : demandes à l'enveloppe (qui seule ouvre les fichiers)
  if (!SHELL) {
    let rpcId = 0;
    const waiting = new Map();
    window.addEventListener("message", e => {
      const d = e.data;
      if (!d || !d.conductor || d.type !== "sd-rpc-result" || !waiting.has(d.id)) return;
      const w = waiting.get(d.id);
      waiting.delete(d.id);
      d.error ? w.reject(new Error(d.error)) : w.resolve(d.value);
    });
    api.call = (name, ...args) => new Promise((resolve, reject) => {
      const id = ++rpcId;
      waiting.set(id, { resolve, reject });
      try { window.top.postMessage({ conductor: true, type: "sd-rpc", id, name, args }, "*"); }
      catch (e) { waiting.delete(id); reject(e); }
      setTimeout(() => { if (waiting.has(id)) { waiting.delete(id); reject(new Error("délai")); } }, 20000);
    });
    return api;
  }

  // =====================================================================
  // Enveloppe uniquement : accès au dossier, analyse, ouverture des fichiers
  // =====================================================================

  const DB_NAME = "conductor01";
  const DB_STORE = "handles";
  const roots = new Map();  // id du dossier → dossier choisi
  const urls = new Map();   // chemin → adresse blob: du fichier

  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(DB_STORE);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction(DB_STORE, mode);
        const req = fn(tx.objectStore(DB_STORE));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
      };
    });
  }

  function setStatus(patch) {
    const s = Object.assign({}, status(), patch, { at: Date.now() });
    writeJson(STATUS_KEY, s);
    document.dispatchEvent(new CustomEvent("sd:change"));
    renderBar();
  }

  function saveIndex(data) {
    writeJson(INDEX_KEY, data);
    document.dispatchEvent(new CustomEvent("sd:change"));
  }

  async function rootOf(id) {
    if (roots.has(id)) return roots.get(id);
    let h = null;
    try { h = (await idb("readonly", s => s.get("local:" + id))) || null; } catch (e) {}
    if (h) roots.set(id, h);
    return h;
  }

  async function permission(id, ask) {
    const h = await rootOf(id);
    if (!h) return "none";
    let p = await h.queryPermission({ mode: "read" });
    if (p !== "granted" && ask) p = await h.requestPermission({ mode: "read" });
    return p;
  }

  // État d'autorisation de chaque dossier (affiché sur la page audio-files)
  async function refreshPerms() {
    const perms = {};
    for (const src of index().sources) {
      try { perms[src.id] = await permission(src.id, false); } catch (e) { perms[src.id] = "prompt"; }
    }
    setStatus({ perms });
    return perms;
  }

  // ---------- Bandeau de l'enveloppe ----------
  // Ajouter un dossier ou autoriser l'accès demande un clic dans l'enveloppe
  // quand la demande vient d'une page du cadre et que Chrome la refuse.

  let bar = null, barNeed = "";   // "" | "add" | "allow"
  let afterAllow = null;
  function renderBar() {
    if (!document.body) return;
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "sd-bar";
      bar.hidden = true;
      bar.innerHTML = '<span class="sd-bar-text"></span><button type="button" class="btn btn-small sd-bar-go"></button>' +
        '<button type="button" class="sd-bar-close" aria-label="Fermer">×</button>';
      bar.querySelector(".sd-bar-go").addEventListener("click", () => {
        const need = barNeed;
        barNeed = "";
        renderBar();
        if (need === "add") add();
        else if (need === "allow") allow();
      });
      bar.querySelector(".sd-bar-close").addEventListener("click", () => { barNeed = ""; afterAllow = null; renderBar(); });
      document.body.appendChild(bar);
    }
    bar.hidden = !barNeed;
    if (!barNeed) return;
    const names = index().sources.filter(s => (status().perms || {})[s.id] !== "granted").map(s => "« " + s.name + " »");
    bar.querySelector(".sd-bar-text").textContent = barNeed === "add"
      ? "Stockage local : choisissez le dossier qui contient vos fichiers audio."
      : "Stockage local : autorisez la lecture de " + (names.join(", ") || "vos dossiers") + ".";
    bar.querySelector(".sd-bar-go").textContent = barNeed === "add" ? "Choisir le dossier…" : "Autoriser";
  }

  // Identifiant unique d'un dossier
  const newId = () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // Un ajout à la fois (fenêtre de choix, puis analyse)
  let adding = Promise.resolve();
  function add() {
    adding = adding.then(addOne, addOne);
    return adding;
  }

  async function addOne() {
    if (!api.supported) { setStatus({ state: "error", error: "Votre navigateur ne permet pas d'ouvrir un dossier (utilisez Chrome ou Edge)." }); return; }
    let h;
    try {
      h = await window.showDirectoryPicker({ id: "conductor-local", mode: "read" });
    } catch (e) {
      if (e.name === "AbortError") return;
      // Demande venue du cadre, sans clic dans l'enveloppe : on affiche le bandeau
      if (e.name === "SecurityError" || e.name === "NotAllowedError") { barNeed = "add"; renderBar(); return; }
      setStatus({ state: "error", error: e.message || e.name });
      return;
    }
    // Dossier déjà ajouté : on le réanalyse simplement
    for (const src of index().sources) {
      const old = await rootOf(src.id);
      if (old && await old.isSameEntry(h).catch(() => false)) { roots.set(src.id, h); await scan(src.id, true); return; }
    }
    const id = newId();
    roots.set(id, h);
    await idb("readwrite", s => s.put(h, "local:" + id));
    const data = index();
    saveIndex({ sources: data.sources.concat({ id, name: h.name, scannedAt: "", files: 0 }), albums: data.albums });
    await scan(id, true);
  }

  async function allow() {
    let ok = true;
    for (const src of index().sources) {
      try { if ((await permission(src.id, true)) !== "granted") ok = false; }
      catch (e) { barNeed = "allow"; renderBar(); return; }
    }
    await refreshPerms();
    if (ok) {
      setStatus({ state: "ready", error: "" });
      const go = afterAllow;
      afterAllow = null;
      if (go) go();
    }
  }

  async function remove(id) {
    roots.delete(id);
    try { await idb("readwrite", s => s.delete("local:" + id)); } catch (e) {}
    const data = index();
    saveIndex({ sources: data.sources.filter(s => s.id !== id), albums: data.albums.filter(a => !a.dir.startsWith(id + "/") && a.dir !== id) });
    await refreshPerms();
  }

  // Accès aux dossiers pour la lecture : demande l'autorisation si besoin.
  // Sans clic récent, Chrome refuse : le bandeau « Autoriser » prend le relais,
  // puis la lecture reprend (retry).
  async function ensureAccess(ids, retry) {
    let missing = false;
    for (const id of ids) {
      let p;
      try { p = await permission(id, false); } catch (e) { p = "none"; }
      if (p === "granted") continue;
      if (p === "none") throw new Error("Dossier retiré du stockage local.");
      try { p = await permission(id, true); } catch (e) { p = "prompt"; }
      if (p !== "granted") missing = true;
    }
    if (!missing) return true;
    afterAllow = retry || null;
    barNeed = "allow";
    await refreshPerms();
    renderBar();
    return false;
  }

  // « d1abc/Radiohead/OK Computer/01 - Airbag.flac » : 1er élément = dossier
  async function fileAt(path) {
    const parts = path.split("/");
    let dir = await rootOf(parts.shift());
    if (!dir) throw new Error("Dossier retiré");
    const name = parts.pop();
    for (const p of parts) dir = await dir.getDirectoryHandle(p);
    return (await dir.getFileHandle(name)).getFile();
  }

  // Ouvre les fichiers « sd:… » d'une liste de morceaux (adresses gardées en mémoire)
  async function prepare(tracks, retry) {
    const paths = (tracks || []).map(t => t.src).filter(s => /^sd:/.test(s || "")).map(s => s.slice(3));
    if (!paths.length) return true;
    const ids = [...new Set(paths.map(p => p.split("/")[0]))];
    if (!(await ensureAccess(ids, retry))) return false;
    for (const p of paths) {
      if (urls.has(p)) continue;
      try { urls.set(p, URL.createObjectURL(await fileAt(p))); }
      catch (e) { console.warn("Carte SD : fichier introuvable", p, e); }
    }
    return true;
  }

  // Paroles d'un morceau du stockage local : .lrc à côté du fichier, sinon
  // paroles intégrées au fichier (FLAC : LYRICS, MP3 : USLT).
  // → { lrc: texte horodaté ou null, text: texte simple ou null }
  const HAS_TIMES = /^\s*\[\d{1,3}:\d{2}/m;
  async function lyricsFor(src) {
    const lrc = await lrcFor(src);
    if (lrc && HAS_TIMES.test(lrc)) return { lrc, text: null, source: "fichier .lrc" };
    if (!/^sd:/.test(src || "")) return { lrc: null, text: null };
    try {
      const tags = await readTags(await fileAt(src.slice(3)), true);
      const t = (tags.lyrics || "").trim();
      if (t) return HAS_TIMES.test(t) ? { lrc: t, text: null, source: "vos fichiers" } : { lrc: null, text: t, source: "vos fichiers" };
    } catch (e) {}
    return { lrc: null, text: null };
  }

  // Pochette d'un album du stockage local : image du dossier (cover.jpg,
  // folder.jpg, front.jpg…), sinon image intégrée au 1er morceau. Blob ou null.
  const COVER_NAMES = /^(cover|folder|front|album|albumart(small)?|thumb)\.(jpe?g|png|webp)$/i;
  async function coverFor(dirKey) {
    const album = index().albums.find(a => a.dir === dirKey);
    if (!album) return null;
    const parts = dirKey.split("/");
    try {
      let dir = await rootOf(parts.shift());
      for (const p of parts) dir = await dir.getDirectoryHandle(p);
      let best = null, any = null;
      for await (const [name, entry] of dir.entries()) {
        if (entry.kind !== "file") continue;
        if (COVER_NAMES.test(name)) { best = entry; if (/^(cover|folder|front)/i.test(name)) break; }
        else if (!any && /\.(jpe?g|png|webp)$/i.test(name)) any = entry;
      }
      const img = best || any;
      if (img) return await img.getFile();
    } catch (e) {}
    for (const t of album.tracks.slice(0, 3)) {
      try {
        const tags = await readTags(await fileAt(t.path), true);
        if (tags.picture && tags.picture.size) return tags.picture;
      } catch (e) {}
    }
    return null;
  }

  // Image réduite (600 px, JPEG) en data: — copiée ensuite dans
  // datastorage/covers par js/disk.js, comme les autres pochettes
  async function toDataUrl(blob, max) {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, (max || 600) / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.88);
  }

  // Album de la collection sans pochette : celle de ses fichiers locaux
  async function coverToAlbum(albumId, dirKey) {
    const a = Store.get(albumId);
    if (!needsCover(a)) return false;
    if (!(await ensureAccess([dirKey.split("/")[0]]))) return false;
    const blob = await coverFor(dirKey);
    if (!blob) return false;
    Store.update(albumId, {
      cover: await toDataUrl(blob, 600), coverFromFiles: true, coverCacheFailed: null,
      coverRemote: /^https?:/i.test(a.cover || "") ? a.cover : (a.coverRemote || "")
    });
    return true;
  }

  // Tous les albums reliés à un dossier autorisé, sans pochette locale :
  // pochette des fichiers (sans rien demander : dossiers déjà autorisés seulement)
  async function repairCovers() {
    const perms = status().perms || {};
    for (const a of Store.raw()) {
      if (!needsCover(a)) continue;
      const m = matchFor(a);
      if (!m || perms[m.dir.split("/")[0]] !== "granted") continue;
      try { await coverToAlbum(a.id, m.dir); } catch (e) {}
    }
  }

  // ---------- Demandes des pages du cadre (réponse par message) ----------
  const RPC = {
    lyrics: src => lyricsFor(src),
    // Paroles synchronisées gardées par le karaoké (datastorage/lyrics-synced/)
    savedSynced: (albumId, title) => typeof Disk !== "undefined" && Disk.readSynced
      ? Disk.readSynced(albumId, title).catch(() => null) : null,
    cover: async dirKey => {
      if ((await permission(dirKey.split("/")[0], false)) !== "granted") return null;
      return coverFor(dirKey);
    },
    coverToAlbum: (albumId, dirKey) => coverToAlbum(albumId, dirKey)
  };
  window.addEventListener("message", e => {
    const d = e.data;
    if (!d || !d.conductor || d.type !== "sd-rpc" || !RPC[d.name] || !e.source) return;
    Promise.resolve().then(() => RPC[d.name].apply(null, d.args || []))
      .then(value => e.source.postMessage({ conductor: true, type: "sd-rpc-result", id: d.id, value }, "*"))
      .catch(err => e.source.postMessage({ conductor: true, type: "sd-rpc-result", id: d.id, error: String(err && err.message || err) }, "*"));
  });

  // Fichier .lrc (paroles synchronisées) à côté d'un morceau : texte ou null
  async function lrcFor(src) {
    if (!/^sd:/.test(src || "")) return null;
    const base = src.slice(3).replace(/\.[^./]+$/, "");
    for (const ext of [".lrc", ".LRC"]) {
      try { return await (await fileAt(base + ext)).text(); } catch (e) {}
    }
    return null;
  }

  function urlFor(src) {
    return /^sd:/.test(src || "") ? (urls.get(src.slice(3)) || "") : src;
  }

  // ---------- Lecture des tags ----------

  async function bytes(file, start, len) {
    return new Uint8Array(await file.slice(start, start + len).arrayBuffer());
  }

  const u32be = (b, i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const syncsafe = (b, i) => (b[i] << 21) | (b[i + 1] << 14) | (b[i + 2] << 7) | b[i + 3];

  function put(out, key, value) {
    value = (value || "").replace(/\0+$/g, "").trim();
    if (!value) return;
    const k = key.toUpperCase();
    if (k === "TITLE" || k === "TIT2") out.title = value;
    else if (k === "ARTIST" || k === "TPE1") out.artist = value;
    else if (k === "ALBUMARTIST" || k === "ALBUM ARTIST" || k === "TPE2") out.albumArtist = value;
    else if (k === "ALBUM" || k === "TALB") out.album = value;
    else if (k === "DATE" || k === "YEAR" || k === "TDRC" || k === "TYER" || k === "ORIGINALDATE") { if (!out.year) out.year = Number((value.match(/\d{4}/) || [])[0]) || null; }
    else if (k === "TRACKNUMBER" || k === "TRCK") out.track = parseInt(value, 10) || null;
    else if (k === "DISCNUMBER" || k === "TPOS") out.disc = parseInt(value, 10) || null;
    else if (k === "GENRE" || k === "TCON") { const g = value.replace(/^\(\d+\)\s*/, ""); if (g && !/^\d+$/.test(g)) out.genre = g; }
  }

  // extra : lit aussi les paroles (LYRICS) et l'image intégrée (PICTURE)
  async function flacTags(file, extra) {
    const out = {};
    const magic = await bytes(file, 0, 4);
    if (String.fromCharCode(...magic) !== "fLaC") return out;
    let pos = 4;
    for (let n = 0; n < 64; n++) {
      const h = await bytes(file, pos, 4);
      if (h.length < 4) break;
      const last = h[0] & 0x80, type = h[0] & 0x7f, len = (h[1] << 16) | (h[2] << 8) | h[3];
      pos += 4;
      if (type === 0) {
        const b = await bytes(file, pos, 18);
        const rate = (b[10] << 12) | (b[11] << 4) | (b[12] >> 4);
        const total = (b[13] & 0x0f) * 4294967296 + u32be(b, 14);
        if (rate && total) out.duration = Math.round(total / rate);
      } else if (type === 4) {
        const b = await bytes(file, pos, Math.min(len, 1 << 20));
        const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
        const dec = new TextDecoder("utf-8");
        let p = 4 + dv.getUint32(0, true);
        const count = dv.getUint32(p, true);
        p += 4;
        for (let i = 0; i < count && p + 4 <= b.length; i++) {
          const l = dv.getUint32(p, true);
          p += 4;
          const s = dec.decode(b.subarray(p, p + l));
          p += l;
          const eq = s.indexOf("=");
          if (eq <= 0) continue;
          const k = s.slice(0, eq).toUpperCase();
          if (k === "LYRICS" || k === "UNSYNCEDLYRICS" || k === "UNSYNCED LYRICS") { if (extra && !out.lyrics) out.lyrics = s.slice(eq + 1); }
          else put(out, k, s.slice(eq + 1));
        }
      } else if (type === 6 && extra && !out.picture) {
        // Image : type, mime, description, dimensions, données
        const b = await bytes(file, pos, Math.min(len, 16 << 20));
        const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
        const picType = dv.getUint32(0);
        let q = 4;
        const mimeLen = dv.getUint32(q); q += 4;
        const mime = new TextDecoder().decode(b.subarray(q, q + mimeLen)); q += mimeLen;
        const descLen = dv.getUint32(q); q += 4 + descLen + 16;
        const dataLen = dv.getUint32(q); q += 4;
        if (picType === 3 || !out.picture) out.picture = new Blob([b.slice(q, q + dataLen)], { type: mime || "image/jpeg" });
      }
      pos += len;
      if (last) break;
    }
    return out;
  }

  function id3Text(d) {
    const enc = d[0], body = d.subarray(1);
    if (enc === 0) return Array.from(body, c => String.fromCharCode(c)).join("").split("\0")[0];
    if (enc === 3) return new TextDecoder("utf-8").decode(body).split("\0")[0];
    if (enc === 1) {
      const le = !(body[0] === 0xfe && body[1] === 0xff);
      return new TextDecoder(le ? "utf-16le" : "utf-16be").decode(body.subarray(2)).split("\0")[0];
    }
    if (enc === 2) return new TextDecoder("utf-16be").decode(body).split("\0")[0];
    return "";
  }

  // Durée d'un MP3 : en-tête Xing / Info / VBRI, sinon débit constant
  const BITRATES = {
    1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
  };
  async function mp3Duration(file, start) {
    const b = await bytes(file, start, 8192);
    for (let i = 0; i + 4 < b.length; i++) {
      if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) continue;
      const ver = (b[i + 1] >> 3) & 3;          // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
      const layer = (b[i + 1] >> 1) & 3;        // 1 = Layer III
      const bi = b[i + 2] >> 4, si = (b[i + 2] >> 2) & 3;
      if (ver === 1 || layer !== 1 || bi === 0 || bi === 15 || si === 3) continue;
      const mpeg1 = ver === 3;
      const rate = [44100, 48000, 32000][si] / (mpeg1 ? 1 : ver === 2 ? 2 : 4);
      const kbps = BITRATES[mpeg1 ? 1 : 2][bi];
      const spf = mpeg1 ? 1152 : 576;
      const mono = (b[i + 3] >> 6) === 3;
      const xing = i + 4 + (mpeg1 ? (mono ? 17 : 32) : (mono ? 9 : 17));
      const tag = String.fromCharCode(b[xing], b[xing + 1], b[xing + 2], b[xing + 3]);
      if ((tag === "Xing" || tag === "Info") && (b[xing + 7] & 1)) return Math.round(u32be(b, xing + 8) * spf / rate);
      const v = i + 36;
      if (String.fromCharCode(b[v], b[v + 1], b[v + 2], b[v + 3]) === "VBRI") return Math.round(u32be(b, v + 14) * spf / rate);
      return Math.round((file.size - start - i) * 8 / (kbps * 1000));
    }
    return 0;
  }

  // Texte ID3 précédé d'une description (USLT, APIC) : position après le 0 final
  function skipText(d, p, enc) {
    if (enc === 1 || enc === 2) { while (p + 1 < d.length && (d[p] || d[p + 1])) p += 2; return p + 2; }
    while (p < d.length && d[p]) p++;
    return p + 1;
  }
  function decodeId3(enc, body) {
    if (enc === 0) return Array.from(body, c => String.fromCharCode(c)).join("");
    if (enc === 3) return new TextDecoder("utf-8").decode(body);
    if (enc === 1) {
      const be = body[0] === 0xfe && body[1] === 0xff;
      const bom = (body[0] === 0xff && body[1] === 0xfe) || be;
      return new TextDecoder(be ? "utf-16be" : "utf-16le").decode(bom ? body.subarray(2) : body);
    }
    return new TextDecoder("utf-16be").decode(body);
  }

  // extra : lit aussi les paroles (USLT) et l'image intégrée (APIC)
  async function id3Tags(file, extra) {
    const out = {};
    const h = await bytes(file, 0, 10);
    let audioStart = 0;
    if (h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33 && h[3] >= 3) {
      const ver = h[3], size = syncsafe(h, 6);
      audioStart = 10 + size + (h[5] & 0x10 ? 10 : 0);
      const b = await bytes(file, 10, Math.min(size, extra ? 16 << 20 : 512 * 1024));
      let p = 0;
      if (h[5] & 0x40) p = ver === 4 ? syncsafe(b, 0) : u32be(b, 0) + 4;
      while (p + 10 <= b.length) {
        const id = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
        if (!/^[A-Z0-9]{4}$/.test(id)) break;
        const len = ver === 4 ? syncsafe(b, p + 4) : u32be(b, p + 4);
        const d = b.subarray(p + 10, p + 10 + len);
        if (id[0] === "T" && len > 1) put(out, id, id3Text(d));
        else if (extra && id === "USLT" && !out.lyrics && len > 5) {
          const start = skipText(d, 4, d[0]);
          out.lyrics = decodeId3(d[0], d.subarray(start)).replace(/\0+$/, "");
        } else if (extra && id === "APIC" && len > 4) {
          let q = 1;
          let mime = "";
          while (q < d.length && d[q]) mime += String.fromCharCode(d[q++]);
          q++;
          const picType = d[q++];
          q = skipText(d, q, d[0]);
          if (picType === 3 || !out.picture) out.picture = new Blob([d.slice(q)], { type: /^image\//.test(mime) ? mime : "image/jpeg" });
        }
        p += 10 + len;
      }
    }
    try { out.duration = await mp3Duration(file, audioStart); } catch (e) {}
    return out;
  }

  async function readTags(file, extra) {
    try {
      if (/\.flac$/i.test(file.name)) return await flacTags(file, extra);
      if (/\.mp3$/i.test(file.name)) return await id3Tags(file, extra);
    } catch (e) { /* fichier abîmé : noms de fichiers */ }
    return {};
  }

  // ---------- Noms de dossiers et de fichiers ----------

  // « 01 - Airbag.flac », « 1-01 Airbag.mp3 », « 01. Radiohead - Airbag.mp3 »
  function titleFromFile(name, artist) {
    let t = name.replace(/\.[^.]+$/, "");
    t = t.replace(/^\d{1,2}[-.]\d{1,3}\s*[-_.)]?\s*/, "").replace(/^\d{1,3}\s*[-_.)]\s*|^\d{1,3}\s+/, "");
    if (artist) {
      const i = t.toLowerCase().indexOf(artist.toLowerCase() + " - ");
      if (i === 0) t = t.slice(artist.length + 3);
    }
    return t.replace(/_/g, " ").trim() || name;
  }
  const trackFromFile = name => {
    const m = name.match(/^(?:(\d{1,2})[-.])?(\d{1,3})\b/);
    return m ? { disc: m[1] ? Number(m[1]) : null, track: Number(m[2]) } : {};
  };

  // « Radiohead - OK Computer (1997) », « 1997 - OK Computer », dossier parent = artiste
  function fromFolders(dirs) {
    let name = dirs[dirs.length - 1] || "";
    let year = null;
    const y = name.match(/[(\[]\s*((?:19|20)\d{2})\s*[)\]]/);
    if (y) { year = Number(y[1]); name = name.replace(y[0], "").trim(); }
    let artist = "", title = name;
    const parts = name.split(/\s+[-–]\s+/);
    if (parts.length >= 2) {
      if (/^(19|20)\d{2}$/.test(parts[0])) { year = year || Number(parts[0]); title = parts.slice(1).join(" - "); }
      else {
        artist = parts[0];
        title = parts.slice(1).join(" - ");
        if (/^(19|20)\d{2}$/.test(parts[1]) && parts.length > 2) { year = year || Number(parts[1]); title = parts.slice(2).join(" - "); }
      }
    }
    if (!artist && dirs.length > 1) artist = dirs[dirs.length - 2];
    return { title: title.trim(), artist: artist.trim(), year };
  }

  function majority(list) {
    const n = new Map();
    list.filter(Boolean).forEach(v => n.set(v, (n.get(v) || 0) + 1));
    let best = "", max = 0;
    n.forEach((c, v) => { if (c > max) { best = v; max = c; } });
    return best;
  }

  // ---------- Analyse du dossier ----------

  // Analyse un dossier (id) ; une analyse à la fois, les suivantes attendent leur tour
  let scanChain = Promise.resolve();
  function scan(id, fresh) {
    scanChain = scanChain.then(() => scanOne(id, fresh), () => scanOne(id, fresh));
    return scanChain;
  }

  async function scanOne(id, fresh) {
    const h = await rootOf(id);
    const src = index().sources.find(s => s.id === id);
    if (!h || !src) return;
    if (!(await ensureAccess([id], () => scan(id, fresh)))) return;
    // Fichiers déjà lus (même taille, même date) : tags repris sans relire
    const known = new Map();
    if (!fresh) index().albums.forEach(a => a.tracks.forEach(t => known.set(t.path, t)));
    const files = [];
    let seen = 0;
    const progress = (files, read) => setStatus({ state: "scanning", scanning: { id, name: src.name, files, read }, error: "" });
    progress(0, 0);
    try {
      async function walk(dir, path) {
        for await (const [name, entry] of dir.entries()) {
          if (entry.kind === "directory") {
            if (!SKIP_DIR.test(name)) await walk(entry, path.concat(name));
          } else if (AUDIO.test(name)) {
            files.push({ entry, dirs: path, name });
            if (files.length % 200 === 0) progress(files.length, 0);
          }
        }
      }
      await walk(h, []);

      const groups = new Map();
      for (const f of files) {
        const file = await f.entry.getFile();
        const path = [id].concat(f.dirs, f.name).join("/");
        const old = known.get(path);
        let tags;
        if (old && old.s === file.size && old.m === file.lastModified) tags = old.tags || {};
        else tags = await readTags(file);
        // Sous-dossier « CD1 », « Disc 2 » : réuni avec le dossier parent
        let dirs = f.dirs, disc = null;
        const last = dirs[dirs.length - 1] || "";
        const dm = last.match(DISC_DIR);
        if (dm && dirs.length > 1) { dirs = dirs.slice(0, -1); disc = Number(dm[2]); }
        const key = [id].concat(dirs).join("/");
        if (!groups.has(key)) groups.set(key, { dirs, items: [] });
        const fromName = trackFromFile(f.name);
        groups.get(key).items.push({
          path, s: file.size, m: file.lastModified, tags,
          track: tags.track || fromName.track || null,
          disc: tags.disc || disc || fromName.disc || 1,
          name: f.name
        });
        seen++;
        if (seen % 50 === 0) progress(files.length, seen);
      }

      const albums = [];
      groups.forEach(({ dirs, items }, key) => {
        const guess = fromFolders(dirs.length ? dirs : [h.name]);
        const tagAlbum = majority(items.map(i => i.tags.album));
        const artist = majority(items.map(i => i.tags.albumArtist)) || majority(items.map(i => i.tags.artist)) || guess.artist;
        items.sort((x, y) => (x.disc - y.disc) || ((x.track || 999) - (y.track || 999)) || x.name.localeCompare(y.name, "fr", { numeric: true }));
        albums.push({
          dir: key,
          title: tagAlbum || guess.title || h.name,
          artist: artist || "",
          year: majority(items.map(i => i.tags.year)) || guess.year || null,
          genre: majority(items.map(i => i.tags.genre)) || "",
          trackCount: items.length,
          duration: items.reduce((s, i) => s + (i.tags.duration || 0), 0),
          tracks: items.map(i => ({
            title: i.tags.title || titleFromFile(i.name, artist),
            duration: i.tags.duration || 0,
            track: i.track, disc: i.disc,
            path: i.path, s: i.s, m: i.m, tags: i.tags
          }))
        });
      });
      // Les albums des autres dossiers sont gardés
      const data = index();
      const all = data.albums.filter(a => a.dir !== id && !a.dir.startsWith(id + "/")).concat(albums);
      all.sort((a, b) => (a.artist + a.title).localeCompare(b.artist + b.title, "fr", { sensitivity: "base" }));
      const sources = data.sources.map(s => s.id === id ? Object.assign({}, s, { name: h.name, scannedAt: new Date().toISOString(), files: files.length }) : s);
      saveIndex({ sources, albums: all });
      setStatus({ state: "ready", scanning: null, error: "" });
      await refreshPerms();
      repairCovers();
    } catch (e) {
      console.warn("Stockage local :", e);
      setStatus({ state: "error", scanning: null, error: e.name === "NotFoundError"
        ? "« " + src.name + " » introuvable : la carte SD ou le disque est-il branché ?" : (e.message || e.name) });
    }
  }

  // ---------- Démarrage ----------

  Object.assign(SHELL_API, {
    add, allow, remove,
    rescan: id => id ? scan(id, false) : Promise.all(index().sources.map(src => scan(src.id, false)))
  });
  Object.assign(api, { prepare, urlFor, scan, lrcFor, lyricsFor, coverFor, coverToAlbum, repairCovers,
    call: (name, ...args) => Promise.resolve().then(() => RPC[name].apply(null, args)) });

  document.addEventListener("DOMContentLoaded", async () => {
    renderBar();
    // Version précédente (un seul dossier « carte SD ») : repris comme 1er dossier
    try {
      const old = await idb("readonly", s => s.get("sdcard"));
      if (old && !index().sources.length) {
        const id = newId();
        await idb("readwrite", s => s.put(old, "local:" + id));
        await idb("readwrite", s => s.delete("sdcard"));
        roots.set(id, old);
        saveIndex({ sources: [{ id, name: old.name, scannedAt: "", files: 0 }], albums: [] });
        const perms = await refreshPerms();
        if (perms[id] === "granted") scan(id, true);
        return;
      }
    } catch (e) {}
    const perms = await refreshPerms();
    const all = Object.values(perms);
    setStatus({ state: !all.length ? "none" : all.every(p => p === "granted") ? "ready" : "needs-permission", scanning: null });
    repairCovers();
  });

  return api;
})();
