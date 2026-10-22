// conductor01. — page Bibliothèque (connexion à Navidrome, albums reliés ou non)

(function () {
  const $ = id => document.getElementById(id);
  const PAGE = 50;
  let shownMissing = PAGE;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function normalize(str) {
    return (str || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  try {
    const home = sessionStorage.getItem("conductor01.home");
    if (home && home.startsWith(new URL(APP_ROOT || "./", location.href).href)) {
      $("back-link").href = home;
      if (home.includes("nextup.html")) $("back-link").textContent = "← retour à next up";
    }
  } catch (e) {}

  // ---------- Connexion ----------

  // Dernières adresses entrées (et utilisateur) : proposées dans le formulaire de connexion,
  // même après « Déconnecter ». La plus récente est préremplie, les autres dans la liste du champ.
  const RECENT_KEY = "conductor01.server.recent";
  function readRecent() {
    try { const r = JSON.parse(localStorage.getItem(RECENT_KEY)); return r && Array.isArray(r.urls) ? r : { urls: [], user: "" }; }
    catch (e) { return { urls: [], user: "" }; }
  }
  function rememberAddress(url, user) {
    const v = (url || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!v) return;
    const r = readRecent();
    r.urls = [v].concat(r.urls.filter(u => u !== v)).slice(0, 6);
    if (user) r.user = user;
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(r)); } catch (e) {}
  }
  function fillConnect() {
    const r = readRecent();
    const list = $("c-url-recent");
    if (list) list.replaceChildren(...r.urls.map(u => { const o = document.createElement("option"); o.value = u; return o; }));
    if (!$("c-url").value && r.urls[0]) $("c-url").value = r.urls[0];
    if (!$("c-user").value && r.user) $("c-user").value = r.user;
  }

  $("connect-form").addEventListener("submit", e => {
    e.preventDefault();
    const btn = $("c-submit");
    btn.disabled = true;
    btn.textContent = "Connexion…";
    $("c-error").hidden = true;

    rememberAddress($("c-url").value, $("c-user").value.trim());
    Server.connect($("c-url").value, $("c-user").value, $("c-pass").value)
      .then(() => Server.refreshIndex())
      .then(() => { $("c-pass").value = ""; render(true); })
      .catch(err => {
        $("c-error").textContent = err.code === 40
          ? "Utilisateur ou mot de passe incorrect."
          : "Serveur injoignable. Vérifiez l'adresse, que le téléphone est sur le même wifi et que Navidrome tourne dans Termux.";
        $("c-error").hidden = false;
      })
      .finally(() => { btn.disabled = false; btn.textContent = "Se connecter"; });
  });

  $("s-logout").addEventListener("click", () => {
    const conf = Server.config();
    if (conf) rememberAddress(conf.url, conf.user);
    Server.disconnect();
    render();
  });

  $("s-refresh").addEventListener("click", () => {
    const btn = $("s-refresh");
    btn.disabled = true;
    btn.textContent = "Actualisation…";
    Server.refreshIndex()
      .then(() => render(true))
      .catch(() => setOnline(false))
      .finally(() => { btn.disabled = false; btn.textContent = "Actualiser"; });
  });

  // ---------- Adresses du téléphone (wifi, point d'accès, câble USB…) ----------

  const addrState = {};   // adresse → "ok" | "off" | "test"

  function renderAddresses() {
    const conf = Server.config();
    const list = $("nd-addr-list");
    if (!conf) { list.replaceChildren(); return; }
    list.replaceChildren(...Server.addresses().map(u => {
      const li = el("li", "nd-addr" + (u === conf.url ? " is-active" : ""));
      const st = addrState[u];
      li.append(el("span", "dot " + (st === "ok" ? "is-on" : st === "off" ? "is-off" : "")),
        el("span", "nd-addr-url", u.replace(/^https?:\/\//, "")),
        el("span", "nd-addr-state", u === conf.url ? "en cours" : st === "off" ? "ne répond pas" : st === "test" ? "test…" : ""));
      const actions = el("span", "nd-addr-actions");
      if (u !== conf.url) {
        const use = el("button", "text-btn inline", "utiliser");
        use.type = "button";
        use.addEventListener("click", async () => {
          addrState[u] = "test";
          renderAddresses();
          const ok = await Server.test(u);
          addrState[u] = ok ? "ok" : "off";
          if (ok) { Server.useAddress(u); render(true); } else renderAddresses();
        });
        actions.appendChild(use);
      }
      if (Server.addresses().length > 1) {
        const del = el("button", "text-btn inline", "retirer");
        del.type = "button";
        del.addEventListener("click", () => { Server.removeAddress(u); render(); });
        actions.appendChild(del);
      }
      li.appendChild(actions);
      return li;
    }));
  }

  $("nd-addr-form").addEventListener("submit", async e => {
    e.preventDefault();
    const input = $("nd-addr-input");
    if (!input.value.trim()) return;
    rememberAddress(input.value);
    const btn = $("nd-addr-btn");
    btn.disabled = true;
    btn.textContent = "Test…";
    $("nd-addr-error").hidden = true;
    try {
      const u = await Server.addAddress(input.value);
      addrState[u] = "ok";
      input.value = "";
      render(true);
      if (!Server.cachedIndex().albums.length) Server.refreshIndex().then(() => render(true)).catch(() => {});
    } catch (err) {
      $("nd-addr-error").textContent = err.message + " Vérifiez l'adresse, le câble ou le réseau, et que Navidrome tourne dans Termux.";
      $("nd-addr-error").hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Ajouter";
    }
  });

  $("nd-addr-detect").addEventListener("click", async () => {
    const btn = $("nd-addr-detect");
    btn.disabled = true;
    btn.textContent = "Détection…";
    Server.addresses().forEach(u => { addrState[u] = "test"; });
    renderAddresses();
    await Promise.all(Server.addresses().map(u => Server.test(u).then(ok => { addrState[u] = ok ? "ok" : "off"; renderAddresses(); })));
    const found = await Server.autoSelect();
    btn.disabled = false;
    btn.textContent = "Détecter";
    render(!!found);
  });

  document.addEventListener("server:address", () => renderAddresses());
  window.addEventListener("storage", e => { if (e.key === "conductor01.server") renderAddresses(); });

  function setOnline(ok) {
    const conf = Server.config();
    $("s-dot").className = "dot " + (ok ? "is-on" : "is-off");
    $("s-text").textContent = (ok ? "Connecté à " : "Injoignable : ") + conf.url + " (" + conf.user + ")";
  }

  // ---------- Listes ----------

  function coverThumb(src) {
    const box = el("div", "row-cover");
    if (src) {
      const img = el("img");
      img.src = src;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => img.remove();
      box.appendChild(img);
    }
    return box;
  }

  function meta(a) {
    return [
      a.artist, a.year,
      a.trackCount ? formatTracks(a.trackCount) : "",
      a.duration ? formatLength(a.duration) : "",
      // Album coupé en plusieurs morceaux par Navidrome, réuni ici
      (a.partSizes || []).length > 1 ? "réuni (" + a.partSizes.join(" + ") + ")" : ""
    ].filter(Boolean).join(" · ");
  }

  function missingRow(s) {
    const row = el("div", "lib-row");
    const text = el("div", "row-text");
    text.append(el("p", "row-title", cleanAlbumTitle(s.title)), el("p", "row-artist", meta(s)));

    const entryOf = () => ({
        id: "local-" + s.id,
        source: "Fichiers",
        title: cleanAlbumTitle(s.title),
        artist: s.artist,
        year: s.year,
        genre: s.genre,
        trackCount: s.trackCount,
        duration: s.duration,
        cover: "",
        serverId: s.id,
        serverCover: s.coverArt
      });
    const actions = el("div", "lib-actions");
    const add = (label, fn) => {
      const btn = el("button", "btn btn-ghost btn-small", label);
      btn.type = "button";
      btn.addEventListener("click", () => {
        const album = fn(entryOf());
        const link = el("a", "text-link", album.nextUp ? "Voir dans next up" : "Voir la page");
        link.href = album.nextUp ? "nextup.html?album=" + encodeURIComponent(album.id)
                                 : "album.html?id=" + encodeURIComponent(album.id);
        actions.replaceChildren(link);
        renderSummary();
      });
      actions.appendChild(btn);
    };
    add("Next up", a => Store.addNextUp(a));
    add("Ajouter à la collection", a => Store.addAlbum(a));

    row.append(coverThumb(Server.coverUrl(s.coverArt, 100)), text, actions);
    return row;
  }

  function noFilesRow(a) {
    const row = el("a", "lib-row");
    row.href = "album.html?id=" + encodeURIComponent(a.id);
    const text = el("div", "row-text");
    text.append(el("p", "row-title", a.title), el("p", "row-artist", [a.artist, a.year].filter(Boolean).join(" · ")));
    row.append(coverThumb(localUrl(a.cover)), text);
    return row;
  }

  function compute() {
    const index = Server.cachedIndex();
    // Collection + next up : un album repéré dans next up n'est pas « manquant »
    const albums = Store.raw();
    const linkedIds = new Set();
    const noFiles = [];
    albums.forEach(a => {
      const m = Server.matchFor(a, index);
      if (m) (m.ids || [m.id]).forEach(id => linkedIds.add(id));
      else if (!a.nextUp && !SD.matchFor(a)) noFiles.push(a);
    });
    const missing = index.albums.filter(s => !(s.ids || [s.id]).some(id => linkedIds.has(id)));
    return { index, linked: index.albums.length - missing.length, missing, noFiles };
  }

  function renderSummary() {
    const { index, linked } = compute();
    const when = index.fetchedAt ? new Date(index.fetchedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "";
    $("s-summary").textContent =
      index.albums.length + " album" + (index.albums.length > 1 ? "s" : "") + " sur le téléphone · " +
      linked + " relié" + (linked > 1 ? "s" : "") + " à la collection" + (when ? " · index du " + when : "");
  }

  function renderLists() {
    const { missing, noFiles } = compute();
    const q = normalize($("missing-filter").value.trim());
    const filtered = q ? missing.filter(s => normalize(s.title + " " + s.artist).includes(q)) : missing;

    $("missing-block").hidden = !missing.length;
    $("missing-title").textContent = "sur le téléphone, pas encore dans la collection (" + missing.length + ")";
    $("missing-list").replaceChildren(...filtered.slice(0, shownMissing).map(missingRow));
    $("missing-more").hidden = filtered.length <= shownMissing;

    $("nofiles-block").hidden = !noFiles.length;
    $("nofiles-title").textContent = "dans la collection, sans fichiers (" + noFiles.length + ")";
    $("nofiles-list").replaceChildren(...noFiles.map(noFilesRow));
  }

  $("missing-filter").addEventListener("input", () => { shownMissing = PAGE; renderLists(); });
  $("missing-more").addEventListener("click", () => { shownMissing += PAGE; renderLists(); });

  // ---------- Stockage local (carte SD, clé USB, dossier du PC…) ----------
  // Les dossiers sont choisis et lus par l'enveloppe (js/sdcard.js) ; cette page
  // envoie les demandes et affiche l'état, partagé par le stockage du navigateur.

  let shownSd = PAGE;

  function sdButton(label, fn, primary) {
    const b = el("button", "btn btn-small" + (primary ? "" : " btn-ghost"), label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  function sdEntry(s) {
    return {
      id: "sd-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      source: "Stockage local",
      title: cleanAlbumTitle(s.title),
      artist: s.artist,
      year: s.year,
      genre: s.genre,
      trackCount: s.trackCount,
      duration: s.duration || null,
      cover: "",
      sdDir: s.dir,
      tracks: s.tracks.map(t => ({ title: t.title, duration: t.duration, track: t.track, disc: t.disc }))
    };
  }

  function sdRow(s) {
    const row = el("div", "lib-row");
    const text = el("div", "row-text");
    text.append(el("p", "row-title", cleanAlbumTitle(s.title)), el("p", "row-artist", meta(s)));
    const actions = el("div", "lib-actions");
    const add = (label, fn) => {
      const btn = el("button", "btn btn-ghost btn-small", label);
      btn.type = "button";
      btn.addEventListener("click", () => {
        const album = fn(sdEntry(s));
        // Pochette du dossier ou des fichiers (copiée dans datastorage/covers)
        if (SD.needsCover(album)) SD.call("coverToAlbum", album.id, s.dir).catch(() => {});
        const link = el("a", "text-link", album.nextUp ? "Voir dans next up" : "Voir la page");
        link.href = album.nextUp ? "nextup.html?album=" + encodeURIComponent(album.id)
                                 : "album.html?id=" + encodeURIComponent(album.id);
        actions.replaceChildren(link);
      });
      actions.appendChild(btn);
    };
    add("Next up", a => Store.addNextUp(a));
    add("Ajouter à la collection", a => Store.addAlbum(a));
    // « Musique › Radiohead/OK Computer »
    const src = SD.sourceOf(s.dir);
    const rel = s.dir.split("/").slice(1).join("/");
    const path = el("p", "row-artist sd-path", (src ? src.name : "") + (rel ? " › " + rel : ""));
    text.appendChild(path);
    const thumb = coverThumb("");
    SD.call("cover", s.dir).then(blob => {
      if (!blob) return;
      const img = el("img");
      img.src = URL.createObjectURL(blob);
      img.alt = "";
      img.loading = "lazy";
      thumb.appendChild(img);
    }).catch(() => {});
    row.append(thumb, text, actions);
    return row;
  }

  function sdCompute() {
    const idx = SD.index();
    const linked = new Set();
    Store.raw().forEach(a => { const m = SD.matchFor(a); if (m) linked.add(m.dir); });
    return { idx, linked, missing: idx.albums.filter(s => !linked.has(s.dir)) };
  }

  const plural = (n, word) => n + " " + word + (n > 1 ? "s" : "");
  const inSource = (a, id) => a.dir === id || a.dir.startsWith(id + "/");

  // Une ligne par dossier : nom, bilan, boutons
  function sourceRow(src, st, linked) {
    const idx = SD.index();
    const albums = idx.albums.filter(a => inSource(a, src.id));
    const perm = (st.perms || {})[src.id];
    const scanning = st.state === "scanning" && st.scanning && st.scanning.id === src.id;
    const row = el("div", "sd-source");
    const line = el("p", "server-line");
    const dot = el("span", "dot " + (perm === "granted" ? "is-on" : "is-off"));
    const name = el("span", "sd-name", "« " + src.name + " »");
    line.append(dot, name);
    const when = src.scannedAt ? new Date(src.scannedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "";
    const n = albums.filter(a => linked.has(a.dir)).length;
    const info = el("p", "hint sd-info", scanning
      ? "Analyse… " + (st.scanning.read ? st.scanning.read + " / " + st.scanning.files + " fichiers lus" : (st.scanning.files || 0) + " fichiers trouvés")
      : perm !== "granted" && perm
        ? "Accès à autoriser" + (when ? " · " + plural(albums.length, "album") : "")
        : when
          ? plural(albums.length, "album") + " · " + plural(src.files || 0, "fichier") + " · " + plural(n, "relié") + " à la collection · analysé le " + when
          : "pas encore analysé");
    const actions = el("div", "server-actions");
    if (perm && perm !== "granted") actions.append(sdButton("Autoriser", () => SD.allow(), true));
    if (!scanning) actions.append(sdButton("Analyser", () => SD.rescan(src.id)), sdButton("Retirer", () => SD.remove(src.id)));
    const head = el("div", "server-status");
    head.append(line, actions);
    row.append(head, info);
    return row;
  }

  function renderSd() {
    const st = SD.status();
    const idx = SD.index();
    const { linked, missing } = sdCompute();
    $("sd-error").hidden = !st.error;
    $("sd-error").textContent = st.error || "";

    const list = $("sd-sources");
    if (!SD.supported) {
      list.replaceChildren(el("p", "hint", "Votre navigateur ne peut pas ouvrir un dossier : utilisez Chrome ou Edge."));
      $("sd-add").hidden = true;
    } else {
      list.replaceChildren(...idx.sources.map(src => sourceRow(src, st, linked)));
      $("sd-empty").hidden = idx.sources.length > 0;
      $("sd-add").hidden = false;
    }

    const q = normalize($("sd-missing-filter").value.trim());
    const filtered = q ? missing.filter(s => normalize(s.title + " " + s.artist + " " + s.dir).includes(q)) : missing;
    $("sd-missing-block").hidden = !missing.length || st.state === "scanning";
    $("sd-missing-title").textContent = "dans vos dossiers, pas encore dans la collection (" + missing.length + ")";
    $("sd-missing-list").replaceChildren(...filtered.slice(0, shownSd).map(sdRow));
    $("sd-missing-more").hidden = filtered.length <= shownSd;
  }

  $("sd-add").addEventListener("click", () => SD.add());
  $("sd-missing-filter").addEventListener("input", () => { shownSd = PAGE; renderSd(); });
  $("sd-missing-more").addEventListener("click", () => { shownSd += PAGE; renderSd(); });
  document.addEventListener("sd:change", () => {
    renderSd();
    if (Server.isConfigured()) renderLists();
  });

  // ---------- Rendu ----------

  function render(online) {
    renderSd();
    const configured = Server.isConfigured();
    $("connect-block").hidden = configured;
    if (!configured) fillConnect();
    $("status-block").hidden = !configured;
    if (!configured) {
      $("missing-block").hidden = true;
      $("nofiles-block").hidden = true;
      return;
    }
    setOnline(online !== false);
    renderAddresses();
    renderSummary();
    renderLists();
  }

  render();

  // Vérifie que le serveur répond (sinon : une autre adresse connue qui répond),
  // et actualise l'index s'il a plus d'une heure
  if (Server.isConfigured()) {
    Server.autoSelect().then(u => { if (!u) throw new Error("injoignable"); render(true); })
      .then(() => Server.ping())
      .then(() => {
        setOnline(true);
        const age = Date.now() - new Date(Server.cachedIndex().fetchedAt || 0).getTime();
        if (age > 3600 * 1000) return Server.refreshIndex().then(() => render(true));
      })
      .catch(() => setOnline(false));
  }
})();
