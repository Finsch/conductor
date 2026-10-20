// conductor. — page artiste : pages/artist.html?name=<artiste>
//
// Tous les albums de l'artiste dans la collection, sa durée totale,
// ses morceaux préférés (★), son intensité moyenne, ses genres.

(function () {
  const $ = id => document.getElementById(id);
  const name = (new URLSearchParams(location.search).get("name") || "").trim();
  const norm = s => (s || "").trim().toLowerCase();

  // Arrivé depuis le bilan (wrapped) : la flèche retour (et Échap) y ramènent
  try {
    const from = sessionStorage.getItem("conductor01.home") || "";
    if (from.includes("wrapped.html")) sessionStorage.setItem("conductor01.artist-back", JSON.stringify({ name, url: from }));
    const saved = JSON.parse(sessionStorage.getItem("conductor01.artist-back") || "null");
    if (saved && saved.name === name) {
      document.addEventListener("DOMContentLoaded", () => {
        const back = $("back-link");
        if (back) { back.href = saved.url; back.textContent = "← retour au wrapped"; }
      });
      const back = $("back-link");
      if (back) { back.href = saved.url; back.textContent = "← retour au wrapped"; }
    }
  } catch (e) {}

  // Les albums ouverts d'ici reviennent ici (flèche retour)
  try { sessionStorage.setItem("conductor01.home", location.href.split("#")[0]); } catch (e) {}

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  const plural = (n, w) => n + " " + w + (n > 1 ? "s" : "");

  function yearOf(a) {
    if (a.releaseDate) return Number(a.releaseDate.slice(0, 4));
    return a.year || null;
  }

  function durationOf(a) {
    if (a.duration) return a.duration;
    return (a.tracks || []).reduce((s, t) => s + (t.duration || 0), 0) || 0;
  }

  function coverEl(album, cls, size) {
    const box = el("div", cls);
    const src = album.cover || (album.serverCover && Server.isConfigured() ? Server.coverUrl(album.serverCover, size) : "");
    if (src) {
      const img = el("img");
      img.src = localUrl(src);
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => img.remove();
      box.appendChild(img);
    }
    return box;
  }

  const albumHref = a => "album.html?id=" + encodeURIComponent(a.id);

  function avg(list) {
    return list.length ? list.reduce((s, x) => s + x, 0) / list.length : null;
  }

  function render() {
    const albums = Store.all().filter(a => norm(a.artist) === norm(name))
      .sort((a, b) => (yearOf(a) || 9999) - (yearOf(b) || 9999));
    const nextUp = Store.nextUp().filter(a => norm(a.artist) === norm(name));

    if (!albums.length && !nextUp.length) {
      $("ar-empty").hidden = false;
      $("ar-body").hidden = true;
      document.title = "artiste · conductor.";
      return;
    }
    $("ar-empty").hidden = true;
    $("ar-body").hidden = false;
    const display = (albums[0] || nextUp[0]).artist;
    document.title = display + " · conductor.";
    $("ar-name").textContent = display;

    // En-tête : albums, durée
    const total = albums.reduce((s, a) => s + durationOf(a), 0);
    $("ar-facts").replaceChildren(...[
      plural(albums.length, "album"),
      total ? formatLength(total) : ""
    ].filter(Boolean).map(t => el("span", null, t)));

    // Fiche : intensité moyenne, genres, années
    const rows = [];
    const add = (dt, dd) => { if (dd) rows.push(el("dt", null, dt), dd instanceof Node ? dd : el("dd", null, dd)); };
    const aggro = albums.map(a => a.aggressivity).filter(Boolean);
    if (aggro.length) add("intensité moyenne", avg(aggro).toFixed(1).replace(".", ",") + " / 10");
    const genres = [...new Set(albums.map(a => a.genre).filter(Boolean))];
    if (genres.length) {
      const dd = el("dd");
      genres.forEach((g, i) => {
        if (i) dd.append(", ");
        const a = el("a", "sheet-link", g);
        a.href = "../index.html?reset=1&q=" + encodeURIComponent(g);
        dd.appendChild(a);
      });
      add("genres", dd);
    }
    const years = albums.map(yearOf).filter(Boolean);
    if (years.length) {
      const lo = Math.min(...years), hi = Math.max(...years);
      add("années", lo === hi ? String(lo) : lo + " – " + hi);
    }
    $("ar-sheet").replaceChildren(...rows);

    // Albums (par date de sortie)
    shown = albums;
    copyBtn.hidden = !albums.length;
    $("ar-albums").replaceChildren(...albums.map(a => {
      const card = el("a", "album-card");
      card.href = albumHref(a);
      const cover = coverEl(a, "album-cover", 600);
      if (a.favorite) {
        const fav = el("span", "cover-fav");
        fav.innerHTML = favIcon(true);
        fav.title = "Album favori";
        cover.appendChild(fav);
      }
      // ▶ / « 3 traits + » au survol, comme dans la collection
      if (typeof coverActions === "function") cover.appendChild(coverActions(a));
      if (typeof coverCopyButton === "function") cover.appendChild(coverCopyButton(a));
      const meta = el("p", "album-artist", yearOf(a) ? String(yearOf(a)) : "");
      card.append(cover, el("p", "album-title", a.title), meta);
      return card;
    }));

    // Morceaux préférés (★) : titre — album
    const favTracks = [];
    albums.forEach(a => {
      const keys = new Set(a.favorites || []);
      if (!keys.size) return;
      const titles = (a.tracks || []).filter(t => keys.has(trackKey(t.title))).map(t => t.title);
      // Morceaux marqués sans liste de titres enregistrée : clé seule
      const shown = titles.length ? titles : [...keys];
      shown.forEach(t => favTracks.push({ title: t, album: a }));
    });
    $("ar-tracks-block").hidden = !favTracks.length;
    $("ar-tracks").replaceChildren(...favTracks.map(f => {
      const li = el("li");
      const star = el("span", "ar-star");
      star.innerHTML = trackIcon(true);
      const link = el("a", "text-link", f.album.title);
      link.href = albumHref(f.album);
      li.append(star, el("span", "ar-track", f.title), el("span", "ar-sep", " — "), link);
      return li;
    }));

    // Albums repérés (next up)
    $("ar-nextup-block").hidden = !nextUp.length;
    $("ar-nextup").replaceChildren(...nextUp.map(a => {
      const li = el("li");
      const link = el("a", "text-link", a.title);
      link.href = "nextup.html?album=" + encodeURIComponent(a.id);
      li.append(link, el("span", "ar-sep", yearOf(a) ? " · " + yearOf(a) : ""));
      return li;
    }));
  }

  // ---------- Copier la liste : « album (année) - artiste », une par ligne ----------

  let shown = [];
  let copiedTimer = null;

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => copyFallback(text));
    }
    return Promise.resolve(copyFallback(text));
  }

  function copyFallback(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    if (!ok) throw new Error("copie refusée");
  }

  const copyBtn = $("ar-copy");
  copyBtn.addEventListener("click", () => {
    const lines = shown.map(a => a.title + (yearOf(a) ? " (" + yearOf(a) + ")" : "") + " - " + a.artist);
    const n = lines.length;
    copyText(lines.join("\n")).then(() => {
      copyBtn.classList.add("is-done");
      copyBtn.title = plural(n, "album") + " copié" + (n > 1 ? "s" : "") + " dans le presse-papiers";
    }).catch(() => {
      copyBtn.title = "Copie impossible : le navigateur l'a refusée";
    }).finally(() => {
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => {
        copyBtn.classList.remove("is-done");
        copyBtn.title = "Copier la liste (album (année) - artiste)";
      }, 1800);
    });
  });

  document.addEventListener("albums:changed", render);
  render();
})();
