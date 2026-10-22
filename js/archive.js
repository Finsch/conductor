// conductor. — archive complète en un clic (pied de page, Maj + A)
//
// Tout datastorage (collection, sauvegardes, pochettes, paroles, journal), le code de l'app
// (sans .git ni fichiers audio) et les réglages gardés dans le navigateur (adresses du
// téléphone, préférences), dans un seul .zip daté,
// enregistré où l'on veut (clé USB, disque externe, dossier synchronisé…).
// Zip « stocké » (sans compression : les pochettes le sont déjà) → rapide, sans bibliothèque.
// Tourne dans l'enveloppe (conductor.html), seule à accéder au dossier datastorage.
//
// Le dossier app est autorisé une fois (choisi à la première archive, gardé dans le
// navigateur ; ensuite un clic « Autoriser » par session, au moment d'archiver).
//
// Restaurer : dézipper, les dossiers « app » et « datastorage » forment conductor/.

const ARCHIVE_LAST_KEY = "conductor01.archive.last";   // date ISO de la dernière archive
const ARCHIVE_EVERY_DAYS = 14;                          // rappel au-delà (js/archive-notice.js)

const Archive = (function () {
  if (window.top !== window) return { run() {} };

  // ---------- Zip (méthode « stored ») ----------

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function dosTime(ms) {
    const d = new Date(ms || Date.now());
    const year = Math.max(1980, d.getFullYear());
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }

  // entries : [{ path, bytes (Uint8Array), mtime }] → Blob
  function buildZip(entries) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    entries.forEach(e => {
      const name = enc.encode(e.path);
      const crc = crc32(e.bytes);
      const { time, date } = dosTime(e.mtime);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);          // version
      local.setUint16(6, 0x0800, true);      // noms en UTF-8
      local.setUint16(8, 0, true);           // stocké
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, e.bytes.length, true);
      local.setUint32(22, e.bytes.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      parts.push(local.buffer, name, e.bytes);

      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true);
      c.setUint16(4, 20, true);
      c.setUint16(6, 20, true);
      c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true);
      c.setUint16(12, time, true);
      c.setUint16(14, date, true);
      c.setUint32(16, crc, true);
      c.setUint32(20, e.bytes.length, true);
      c.setUint32(24, e.bytes.length, true);
      c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(c.buffer, name);
      offset += 30 + name.length + e.bytes.length;
    });
    const centralSize = central.reduce((s, p) => s + p.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [end.buffer]), { type: "application/zip" });
  }

  // ---------- Contenu ----------

  const SKIP = /^(\.DS_Store|Thumbs\.db|desktop\.ini)$/i;
  // Code de l'app : ni l'historique git, ni la musique téléchargée (tools/Albums…)
  const SKIP_APP_DIR = /^(\.git|node_modules|Albums)$/i;
  const SKIP_APP_FILE = /\.(mp3|flac|m4a|ogg|opus|wav|aac|webm|zip|part)$/i;
  async function walk(dir, prefix, out, isApp) {
    for await (const [name, h] of dir.entries()) {
      if (SKIP.test(name)) continue;
      if (isApp && (h.kind === "directory" ? SKIP_APP_DIR.test(name) : SKIP_APP_FILE.test(name))) continue;
      if (h.kind === "directory") await walk(h, prefix + name + "/", out, isApp);
      else {
        const f = await h.getFile();
        out.push({ path: prefix + name, bytes: new Uint8Array(await f.arrayBuffer()), mtime: f.lastModified });
      }
    }
  }

  const IN_COLLECTION = new Set(["conductor01.albums", "conductor01.notes", "conductor01.listening", "conductor01.savedAt"]);
  // ---------- Dossier app : choisi une fois, gardé dans le navigateur ----------

  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open("conductor01-archive", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("handles");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction("handles", mode);
          const req = fn(tx.objectStore("handles"));
          tx.oncomplete = () => resolve(req && req.result);
          tx.onerror = () => reject(tx.error);
        } catch (e) {
          reject(e);
        }
      };
    });
  }

  async function isAppFolder(h) {
    try { await h.getFileHandle("conductor.html"); return true; } catch (e) { return false; }
  }

  // → dossier app autorisé, null si refusé / annulé
  async function appFolder() {
    let h = await idb("readonly", s => s.get("app")).catch(() => null);
    if (h) {
      let perm = await h.queryPermission({ mode: "read" }).catch(() => "denied");
      if (perm === "prompt") perm = await h.requestPermission({ mode: "read" }).catch(() => "denied");
      if (perm === "granted" && await isAppFolder(h)) return h;
    }
    if (!window.showDirectoryPicker) return null;
    flash("Archive : choisissez le dossier app de conductor. (celui qui contient conductor.html), une seule fois.", 8000);
    try {
      h = await window.showDirectoryPicker({ id: "conductor-app", mode: "read" });
    } catch (e) {
      return null;
    }
    if (!(await isAppFolder(h))) {
      flash("Ce dossier n'est pas celui de l'app (pas de conductor.html) : archive sans le code.", 6000);
      return null;
    }
    await idb("readwrite", s => s.put(h, "app")).catch(() => {});
    return h;
  }

  function browserSettings() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!/^conductor01\./.test(k)) continue;
      if (IN_COLLECTION.has(k)) continue;   // déjà dans datastorage/collection.js
      const v = localStorage.getItem(k);
      try { data[k] = JSON.parse(v); } catch (e) { data[k] = v; }
    }
    return data;
  }

  function readme(stamp, count) {
    return [
      "conductor. — archive du " + stamp,
      "",
      "app/                           le code de conductor. (sans .git ni musique)",
      "datastorage/                   toutes vos données : collection.js (albums, écoutes, notes, intensité,",
      "                               tiers), collection.csv, backups/, covers/, lyrics/, lyrics-synced/,",
      "                               journal-entries/",
      "reglages-navigateur.json       réglages gardés par le navigateur (adresses du téléphone, utilisateur",
      "                               Navidrome, préférences d'affichage, file d'attente…)",
      "",
      "RESTAURER",
      "1. Dézippez l'archive.",
      "2. Mettez les dossiers app et datastorage côte à côte dans un dossier conductor",
      "   (ou remplacez conductor/datastorage par celui de l'archive pour ne restaurer que les données).",
      "3. Ouvrez conductor. (app/index.html dans Chrome ou Edge), puis autorisez le dossier datastorage.",
      "   Collection, notes, paroles, pochettes et journal sont de retour.",
      "4. Réglages du navigateur : refaites la connexion au téléphone (audio-files) ;",
      "   les valeurs sont dans reglages-navigateur.json si besoin.",
      "",
      count + " fichiers."
    ].join("\r\n");
  }

  // ---------- Message ----------

  let flashTimer = 0;
  function flash(text, ms) {
    let box = document.getElementById("kb-flash");
    if (!box) {
      box = document.createElement("div");
      box.id = "kb-flash";
      box.className = "kb-flash";
      box.setAttribute("role", "status");
      document.body.appendChild(box);
    }
    box.textContent = text;
    box.classList.add("is-on");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => box.classList.remove("is-on"), ms || 3500);
  }

  const pad = n => String(n).padStart(2, "0");
  const mb = bytes => (bytes / 1048576).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " Mo";

  // ---------- Archiver ----------

  let running = false;
  async function run() {
    if (running) return;
    if (typeof Disk === "undefined" || !Disk.dir || Disk.state() !== "ready" || !Disk.dir()) {
      flash("Archive : autorisez d'abord le dossier datastorage (bandeau en bas à gauche).", 5000);
      return;
    }
    const d = new Date();
    const day = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    const suggestedName = "conductor-archive-" + day + ".zip";

    // Dossier app d'abord, puis l'emplacement de l'archive (tant que le clic compte
    // comme geste de l'utilisateur ; sinon : téléchargement classique)
    const app = await appFolder();
    // Choisir un dossier ou autoriser prend du temps : le geste de l'utilisateur a pu
    // expirer, et la fenêtre « Enregistrer sous » serait refusée → un second clic
    if (window.showSaveFilePicker && navigator.userActivation && !navigator.userActivation.isActive) {
      flash((app ? "Dossier app autorisé" : "Sans le code de l'app") + " · appuyez de nouveau sur archive (ou Maj + A) pour enregistrer.", 8000);
      return;
    }
    let target = null;
    if (window.showSaveFilePicker) {
      try {
        target = await window.showSaveFilePicker({
          id: "conductor-archive", startIn: "documents", suggestedName,
          types: [{ description: "Archive conductor.", accept: { "application/zip": [".zip"] } }]
        });
      } catch (e) {
        if (e.name === "AbortError") return;   // annulé
        target = null;                          // sinon : téléchargement classique
      }
    }

    running = true;
    flash("Archive en cours…", 120000);
    try {
      await Disk.writeNow();   // dernières modifications d'abord
      const entries = [];
      if (app) await walk(app, "app/", entries, true);
      await walk(Disk.dir(), "datastorage/", entries);
      const enc = new TextEncoder();
      const stamp = day + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
      entries.push({ path: "reglages-navigateur.json", bytes: enc.encode(JSON.stringify(browserSettings(), null, 1)), mtime: d.getTime() });
      entries.push({ path: "LISEZ-MOI.txt", bytes: enc.encode(readme(stamp, entries.length + 1)), mtime: d.getTime() });
      const blob = buildZip(entries);

      if (target) {
        const w = await target.createWritable();
        await w.write(blob);
        await w.close();
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      }
      try { localStorage.setItem(ARCHIVE_LAST_KEY, d.toISOString()); } catch (e) {}
      document.dispatchEvent(new CustomEvent("archive:done"));
      flash("Archive enregistrée · " + entries.length + " fichiers · " + mb(blob.size) + (app ? "" : " · sans le code de l'app"), 5000);
    } catch (e) {
      console.warn("archive :", e);
      flash("Archive impossible : " + (e.message || e.name), 6000);
    } finally {
      running = false;
    }
  }

  return { run, buildZip, crc32 };
})();
