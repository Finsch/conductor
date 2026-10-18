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

  $("connect-form").addEventListener("submit", e => {
    e.preventDefault();
    const btn = $("c-submit");
    btn.disabled = true;
    btn.textContent = "Connexion…";
    $("c-error").hidden = true;

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
      else if (!a.nextUp) noFiles.push(a);
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

  // ---------- Rendu ----------

  function render(online) {
    const configured = Server.isConfigured();
    $("connect-block").hidden = configured;
    $("status-block").hidden = !configured;
    if (!configured) {
      $("missing-block").hidden = true;
      $("nofiles-block").hidden = true;
      return;
    }
    setOnline(online !== false);
    renderSummary();
    renderLists();
  }

  render();

  // Vérifie que le serveur répond, et actualise l'index s'il a plus d'une heure
  if (Server.isConfigured()) {
    Server.ping()
      .then(() => {
        setOnline(true);
        const age = Date.now() - new Date(Server.cachedIndex().fetchedAt || 0).getTime();
        if (age > 3600 * 1000) return Server.refreshIndex().then(() => render(true));
      })
      .catch(() => setOnline(false));
  }
})();
