// conductor. — stockage sur le disque, dans conductor/datastorage
//
// (le code est dans conductor/app/, les données dans conductor/datastorage/)
//   datastorage/collection.js       votre collection (relue au démarrage, même sans internet)
//   datastorage/collection.prev.js  la version précédente (filet de sécurité)
//   datastorage/backups/…           une copie par jour (collection-AAAA-MM-JJ.js), les 7 dernières
//   datastorage/covers/…            les pochettes, copiées en local
//
// Lire : le site charge collection.js avec une simple balise <script>,
//        aucune autorisation n'est nécessaire.
// Écrire : le navigateur (Chrome ou Edge) doit avoir accès au dossier. On le
//          choisit une fois ; ensuite un clic « Autoriser » suffit à chaque session.

// Site sur une seule page : seule l'enveloppe (conductor.html) écrit sur le
// disque — Chrome interdit le choix d'un dossier depuis une page affichée dans
// un cadre. Les pages du cadre ont un relais (frameDisk, plus bas) : leurs
// modifications passent par le stockage du navigateur, que l'enveloppe écoute.
const Disk = window.top !== window ? frameDisk() : (function () {
  const supported = "showDirectoryPicker" in window;
  const DB_NAME = "conductor01";
  const DB_STORE = "handles";
  const COVERS_DIR = "covers";
  const COVERS_PATH = "../datastorage/covers/";

  let handle = null;         // dossier datastorage
  let state = supported ? "none" : "unsupported";   // none | needs-permission | ready | unsupported
  let dirty = false;         // modifications pas encore écrites sur le disque
  let busy = "";             // texte affiché pendant un travail en cours
  let writeError = "";       // dernière erreur d'écriture
  let coverNotice = "";      // bilan de la copie des pochettes
  let timer = null;
  let writing = null;
  let coversRunning = false;
  let coverStats = null;

  // Paroles en attente d'écriture (gardées aussi dans le navigateur, pour ne pas
  // perdre des paroles modifiées à la main si la page se ferme avant l'écriture)
  const PENDING_KEY = "conductor01.lyricsPending";
  let pendingLyrics = {};
  try { pendingLyrics = JSON.parse(localStorage.getItem(PENDING_KEY)) || {}; } catch (e) {}
  function savePending() {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(pendingLyrics)); } catch (e) {}
  }

  // ---------- IndexedDB : mémoriser le dossier choisi ----------

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
  const saveHandle = h => idb("readwrite", s => s.put(h, "datastorage"));
  const loadHandle = () => idb("readonly", s => s.get("datastorage"));

  // ---------- Écriture de la collection ----------

  function fileContent() {
    const data = { version: 1, savedAt: Store.savedAt(), albums: Store.raw(), notes: Store.notes(),
      listening: Store.listening() };
    return "// conductor. — votre collection. Fichier écrit par le site : ne pas modifier à la main.\n" +
      "window.CONDUCTOR_DATA = " + JSON.stringify(data, null, 1) + ";\n";
  }

  async function writeFile(dir, name, content) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(content);
    await w.close();
  }

  async function readText(name) {
    try {
      return await (await (await handle.getFileHandle(name)).getFile()).text();
    } catch (e) {
      return null;
    }
  }

  async function writeNow() {
    if (state !== "ready") return;
    if (writing) return writing;
    writing = (async () => {
      try {
        busy = "Enregistrement…";
        render();
        const previous = await readText("collection.js");
        if (previous) {
          await writeFile(handle, "collection.prev.js", previous);
          await dailyBackup(previous);
        }
        await writeFile(handle, "collection.js", fileContent());
        await flushLyrics();
        dirty = false;
        writeError = "";
      } catch (e) {
        console.warn("datastorage :", e);
        writeError = "Écriture impossible dans datastorage : " + (e.message || e.name);
        if (e.name === "NotAllowedError") state = "needs-permission";
      } finally {
        busy = "";
        writing = null;
        render();
      }
    })();
    return writing;
  }

  // ---------- Sauvegarde du jour : datastorage/backups/ ----------
  // À la première écriture de la journée, la collection telle qu'elle était
  // avant est copiée dans backups/collection-AAAA-MM-JJ.js. On garde les 7 dernières.

  const BACKUPS_DIR = "backups";
  const BACKUPS_KEEP = 7;

  function today() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  async function dailyBackup(content) {
    try {
      const dir = await handle.getDirectoryHandle(BACKUPS_DIR, { create: true });
      const name = "collection-" + today() + ".js";
      try { await dir.getFileHandle(name); return; } catch (e) { /* pas encore de copie aujourd'hui */ }
      await writeFile(dir, name, content);
      const names = [];
      for await (const [n] of dir.entries()) if (/^collection-\d{4}-\d\d-\d\d\.js$/.test(n)) names.push(n);
      names.sort().reverse().slice(BACKUPS_KEEP).forEach(n => dir.removeEntry(n).catch(() => {}));
    } catch (e) {
      console.warn("Sauvegarde du jour impossible :", e);
    }
  }

  // Appelé par Store à chaque modification
  function changed() {
    dirty = true;
    clearTimeout(timer);
    if (state === "ready") {
      timer = setTimeout(() => writeNow().then(cacheCovers), 400);
    }
    render();
  }

  // ---------- Paroles : datastorage/lyrics/<album>.js ----------

  function lyricsContent(albumId, data) {
    return "// conductor. — paroles. Fichier écrit par le site.\n" +
      "window.CONDUCTOR_LYRICS = window.CONDUCTOR_LYRICS || {};\n" +
      "window.CONDUCTOR_LYRICS[" + JSON.stringify(albumId) + "] = " + JSON.stringify(data, null, 1) + ";\n";
  }

  async function flushLyrics() {
    // relire : des paroles ont pu être ajoutées par une page du cadre
    try { pendingLyrics = JSON.parse(localStorage.getItem(PENDING_KEY)) || {}; } catch (e) {}
    const ids = Object.keys(pendingLyrics);
    if (!ids.length) return;
    const dir = await handle.getDirectoryHandle("lyrics", { create: true });
    for (const id of ids) {
      await writeFile(dir, safeName(id) + ".js", lyricsContent(id, pendingLyrics[id]));
      delete pendingLyrics[id];
      savePending();
    }
  }

  // Toutes les paroles connues d'un album (remplace le fichier de l'album)
  function writeLyrics(albumId, data) {
    pendingLyrics[albumId] = data;
    savePending();
    changed();
  }

  function lyricsPath(albumId) {
    return APP_ROOT + "../datastorage/lyrics/" + safeName(albumId) + ".js";
  }

  // Paroles pas encore écrites sur le disque (pour les afficher quand même)
  function pendingLyricsFor(albumId) {
    return pendingLyrics[albumId] || null;
  }

  // ---------- Pochettes en local ----------

  function safeName(id) {
    return String(id).replace(/[^a-z0-9_-]/gi, "_");
  }

  // Pochette à copier : adresse en ligne, image collée (data:), ou pochette de vos fichiers
  function coverSource(a) {
    if (a.cover && (/^https?:/i.test(a.cover) || a.cover.startsWith("data:"))) return a.cover;
    if (!a.cover && a.serverCover && typeof Server !== "undefined" && Server.isConfigured()) {
      return Server.coverUrl(a.serverCover, 600);
    }
    return "";
  }

  const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

  async function cacheCovers() {
    if (state !== "ready" || coversRunning) return;
    const todo = Store.raw().filter(a => {
      const src = coverSource(a);
      return src && a.coverCacheFailed !== src;
    });
    if (!todo.length) return cleanCovers();

    coversRunning = true;
    coverStats = { done: 0, failed: 0, total: todo.length };
    try {
      const dir = await handle.getDirectoryHandle(COVERS_DIR, { create: true });
      for (const a of todo) {
        busy = "Copie des pochettes… " + (coverStats.done + coverStats.failed + 1) + "/" + coverStats.total;
        render();
        const src = coverSource(a);
        try {
          const res = await fetch(src);
          if (!res.ok) throw new Error("HTTP " + res.status);
          const blob = await res.blob();
          if (!blob.type.startsWith("image/")) throw new Error("pas une image");
          const name = safeName(a.id) + "." + (EXT[blob.type] || "jpg");
          await writeFile(dir, name, blob);
          // ?v= : force le navigateur à recharger si la pochette change
          Store.update(a.id, {
            cover: COVERS_PATH + name + "?v=" + Date.now().toString(36),
            coverRemote: /^https?:/i.test(a.cover || "") ? a.cover : (a.coverRemote || ""),
            coverCacheFailed: null
          });
          coverStats.done++;
        } catch (e) {
          // Le plus souvent : le site d'origine interdit la copie de ses images (CORS).
          // La pochette reste affichée en ligne ; on ne réessaie pas à chaque fois.
          console.warn("Pochette non copiée (" + a.title + ") :", e.message || e);
          Store.update(a.id, { coverCacheFailed: src });
          coverStats.failed++;
        }
      }
    } finally {
      coversRunning = false;
      busy = "";
      coverNotice = coverStats.failed
        ? coverStats.done + " pochette(s) copiée(s), " + coverStats.failed + " non copiable(s) : elles restent affichées en ligne."
        : "";
      render();
    }
    await cleanCovers();
  }

  // Supprime les pochettes d'albums retirés de la collection
  async function cleanCovers() {
    if (state !== "ready") return;
    try {
      const dir = await handle.getDirectoryHandle(COVERS_DIR, { create: true });
      const used = new Set(Store.raw()
        .map(a => (a.cover || "").startsWith(COVERS_PATH) ? a.cover.slice(COVERS_PATH.length).split("?")[0] : null)
        .filter(Boolean));
      for await (const [name] of dir.entries()) {
        if (!used.has(name)) await dir.removeEntry(name);
      }
      // Paroles d'albums retirés de la collection
      const ids = new Set(Store.raw().map(a => safeName(a.id) + ".js"));
      const ldir = await handle.getDirectoryHandle("lyrics", { create: true });
      for await (const [name] of ldir.entries()) {
        if (!ids.has(name)) await ldir.removeEntry(name);
      }
    } catch (e) {
      console.warn("Nettoyage des pochettes :", e);
    }
  }

  // Réessayer les pochettes refusées (par exemple après un changement de source)
  function retryCovers() {
    Store.raw().forEach(a => { if (a.coverCacheFailed) Store.update(a.id, { coverCacheFailed: null }); });
    cacheCovers();
  }

  // ---------- Connexion au dossier ----------

  async function connected() {
    state = "ready";
    writeError = "";
    render();
    // Le fichier est plus ancien que le navigateur (ou absent) : on l'écrit
    if (dirty || !window.CONDUCTOR_DATA) await writeNow();
    await cacheCovers();
  }

  async function choose() {
    try {
      const h = await window.showDirectoryPicker({ id: "conductor-datastorage", mode: "readwrite" });
      if (h.name !== "datastorage") {
        writeError = "Choisissez le dossier « datastorage » qui se trouve dans le dossier conductor.";
        render();
        return;
      }
      handle = h;
      await saveHandle(h);
      await connected();
    } catch (e) {
      if (e.name !== "AbortError") { writeError = "Accès refusé : " + (e.message || e.name); render(); }
    }
  }

  async function allow() {
    try {
      const perm = await handle.requestPermission({ mode: "readwrite" });
      if (perm === "granted") await connected();
    } catch (e) {
      writeError = "Accès refusé : " + (e.message || e.name);
      render();
    }
  }

  async function init() {
    dirty = Store.savedAt() > ((window.CONDUCTOR_DATA && window.CONDUCTOR_DATA.savedAt) || "") ||
      Object.keys(pendingLyrics).length > 0;
    if (!supported) return render();
    try {
      handle = await loadHandle();
    } catch (e) {
      handle = null;
    }
    if (!handle) { state = "none"; return render(); }
    const perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm === "granted") await connected();
    else { state = "needs-permission"; render(); }
  }

  // ---------- Bandeau d'état (bas de page) ----------

  let bar = null;

  function button(text, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "text-btn inline";
    b.textContent = text;
    b.addEventListener("click", fn);
    return b;
  }

  function render() {
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "disk-bar";
      bar.setAttribute("role", "status");
      document.body.appendChild(bar);
    }
    const parts = [];
    let show = true;

    if (state === "unsupported") {
      parts.push("Enregistrement sur le disque indisponible dans ce navigateur : utilisez Chrome ou Edge.");
    } else if (state === "none") {
      parts.push("Vos données ne sont que dans le navigateur.", button("Choisir le dossier datastorage", choose));
    } else if (state === "needs-permission") {
      if (dirty) parts.push("Modifications pas encore enregistrées dans datastorage.", button("Autoriser l'accès", allow));
      else show = false;   // rien à écrire : inutile de déranger
    } else if (busy) {
      parts.push(busy);
    } else if (dirty) {
      parts.push("Enregistrement en attente…");
    } else {
      show = false;
    }
    if (writeError) {
      parts.push(writeError, button("fermer", () => { writeError = ""; render(); }));
      show = true;
    }
    if (coverNotice && !busy) {
      parts.push(coverNotice, button("réessayer", () => { coverNotice = ""; retryCovers(); }),
        button("fermer", () => { coverNotice = ""; render(); }));
      show = true;
    }

    bar.replaceChildren(...parts.map(p => typeof p === "string" ? Object.assign(document.createElement("span"), { textContent: p }) : p));
    bar.hidden = !show;
  }

  // Avant de quitter la page : écrire ce qui reste
  window.addEventListener("pagehide", () => { if (dirty && state === "ready") writeNow(); });

  // Paroles ajoutées par une page du cadre : à écrire
  window.addEventListener("storage", e => { if (e.key === PENDING_KEY) changed(); });

  return {
    init, changed, choose, allow, writeNow, cacheCovers, retryCovers,
    writeLyrics, lyricsPath, pendingLyricsFor, safeName,
    state: () => state
  };
})();

document.addEventListener("DOMContentLoaded", () => Disk.init());

// Relais pour une page affichée dans le cadre de conductor.html
function frameDisk() {
  const PENDING_KEY = "conductor01.lyricsPending";
  const readPending = () => { try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || {}; } catch (e) { return {}; } };
  const safeName = id => String(id).replace(/[^a-z0-9_-]/gi, "_");
  return {
    init() {},
    changed() {},                       // l'enveloppe voit la modification et l'écrit
    writeNow: () => Promise.resolve(),
    cacheCovers: () => Promise.resolve(),
    retryCovers() {},
    choose() {},
    allow() {},
    writeLyrics(albumId, data) {
      const p = readPending();
      p[albumId] = data;
      try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch (e) {}
    },
    lyricsPath: albumId => APP_ROOT + "../datastorage/lyrics/" + safeName(albumId) + ".js",
    pendingLyricsFor: albumId => readPending()[albumId] || null,
    safeName,
    state: () => "shell"
  };
}
