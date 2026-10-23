// conductor. — page « bacs » : des sélections d'albums ordonnées (comme des playlists d'albums)
//   bacs.html         : tous les bacs (mosaïque des pochettes, nombre d'albums, durée)
//   bacs.html?id=…    : un bac — lire, ajouter à la file, renommer, supprimer, changer la
//                       pochette, ajouter des albums de la collection, réordonner (glisser),
//                       lancer un album ou l'ajouter à la file, retirer
// Données : Store.bacs() (js/data.js), écrites dans datastorage/collection.js

(function () {
  const $ = id => document.getElementById(id);
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const durationOf = a => a.duration || (a.tracks || []).reduce((s, t) => s + (t.duration || 0), 0) || 0;
  const albumHref = a => "album.html?id=" + encodeURIComponent(a.id);
  const plural = (n, w) => n + " " + w + (n > 1 ? "s" : "");

  function coverSrc(a, size) {
    const src = a.cover || (a.serverCover && typeof Server !== "undefined" && Server.isConfigured() ? Server.coverUrl(a.serverCover, size || 300) : "");
    return src ? localUrl(src) : "";
  }
  function coverImg(a, size) {
    const src = coverSrc(a, size);
    if (!src) { const s = el("span", "bc-nocover", "♪"); return s; }
    const img = el("img");
    img.src = src;
    img.alt = "";
    img.loading = "lazy";
    return img;
  }
  // Albums du bac encore dans la collection, dans l'ordre
  function albumsOf(bac) {
    const all = new Map(Store.raw().map(a => [a.id, a]));
    return (bac.albums || []).map(id => all.get(id)).filter(Boolean);
  }
  // Pochette du bac : image choisie, pochette d'un de ses albums, sinon mosaïque
  function mosaic(box, albums, bac) {
    const chosen = bac && bac.coverAlbum && albums.find(a => a.id === bac.coverAlbum);
    if (bac && (bac.cover || chosen)) {
      const src = bac.cover || coverSrc(chosen, 600);
      if (src) {
        const img = el("img");
        img.src = src;
        img.alt = "";
        box.replaceChildren(img);
        box.dataset.n = "1";
        return;
      }
    }
    const four = albums.slice(0, 4);
    box.replaceChildren(...(four.length ? four : [null]).map(a => a ? coverImg(a, 300) : el("span", "bc-nocover", "♪")));
    box.dataset.n = String(Math.max(1, four.length));
  }
  function meta(albums) {
    const sec = albums.reduce((s, a) => s + durationOf(a), 0);
    return plural(albums.length, "album") + (sec ? " · " + formatLength(sec) : "");
  }

  const id = new URLSearchParams(location.search).get("id");

  // =====================================================================
  // Tous les bacs
  // =====================================================================

  // Tri : A → Z (par défaut) ou récemment modifiés ; gardé dans le navigateur
  const SORT_KEY = "conductor01.bacs.sort";
  let sort = "az";
  try { sort = localStorage.getItem(SORT_KEY) === "recent" ? "recent" : "az"; } catch (e) {}
  $("bc-sort").querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => {
    sort = b.dataset.sort;
    try { localStorage.setItem(SORT_KEY, sort); } catch (e) {}
    renderIndex();
  }));

  function renderIndex() {
    const bacs = Store.bacs().slice().sort(sort === "recent"
      ? (a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")
      : (a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base", numeric: true }));
    $("bc-sort").querySelectorAll(".chip").forEach(b => {
      b.classList.toggle("is-active", b.dataset.sort === sort);
      b.setAttribute("aria-checked", String(b.dataset.sort === sort));
    });
    $("bc-sort").hidden = bacs.length < 2;
    $("bc-empty").hidden = bacs.length > 0;
    $("bc-facts").textContent = bacs.length ? plural(bacs.length, "bac")
      : "Des sélections d'albums, comme des playlists.";
    $("bc-grid").replaceChildren(...bacs.map(bac => {
      const albums = albumsOf(bac);
      const card = el("a", "bc-card");
      card.href = "bacs.html?id=" + encodeURIComponent(bac.id);
      const m = el("div", "bc-mosaic");
      mosaic(m, albums, bac);
      card.append(m, el("p", "bc-card-name", bac.name), el("p", "bc-card-meta", meta(albums)));
      return card;
    }));
  }

  function openCreate() {
    $("bc-create").hidden = false;
    $("bc-create-name").value = "";
    $("bc-create-name").focus();
  }
  $("bc-new").addEventListener("click", openCreate);
  $("bc-create-cancel").addEventListener("click", () => { $("bc-create").hidden = true; });
  $("bc-create").addEventListener("submit", e => {
    e.preventDefault();
    const bac = Store.createBac($("bc-create-name").value);
    location.href = "bacs.html?id=" + encodeURIComponent(bac.id);
  });
  $("bc-create-name").addEventListener("keydown", e => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); $("bc-create").hidden = true; }
  });

  // =====================================================================
  // Un bac
  // =====================================================================

  function renderOne() {
    const bac = Store.bac(id);
    if (!bac) { location.replace("bacs.html"); return; }
    const albums = albumsOf(bac);
    document.title = bac.name + " · bacs · conductor.";
    if (!$("bc-name").querySelector("input")) $("bc-name").textContent = bac.name;
    $("bc-meta").textContent = meta(albums);
    mosaic($("bc-mosaic"), albums, bac);
    $("bc-play").disabled = $("bc-queue").disabled = !albums.length;
    $("bc-one-empty").hidden = albums.length > 0;
    $("bc-list").replaceChildren(...albums.map((a, i) => row(a, i)));
  }

  // Lancer un album du bac (remplace l'album en cours, file gardée) ou l'ajouter à la file
  function flash(text) { if (window.Shortcuts && Shortcuts.flash) Shortcuts.flash(text); }
  function playOne(a) {
    if (typeof Playback === "undefined") return;
    if (Playback.state()) Playback.playId(a.id, true); else Playback.playId(a.id);
    flash("Lecture : " + a.title);
  }
  function queueOne(a) {
    if (typeof Playback === "undefined") return;
    Playback.addToQueue(a.id);
    flash("Ajouté à la file : " + a.title);
  }
  const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>';
  const ICON_QUEUE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h12M4 11.5h12M4 16.5h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17.5 14v6M14.5 17h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  function row(a, i) {
    const li = el("li", "bc-row");
    li.dataset.id = a.id;
    const grip = el("span", "bc-grip", "⠿");
    grip.title = "Glisser pour déplacer";
    grip.setAttribute("aria-hidden", "true");
    const link = el("a", "bc-row-link");
    link.href = albumHref(a);
    link.draggable = false;
    const cover = el("span", "bc-row-cover");
    cover.appendChild(coverImg(a, 100));
    const text = el("span", "bc-row-text");
    text.append(el("span", "bc-row-title", a.title), el("span", "bc-row-artist", a.artist + (a.year ? " · " + a.year : "")));
    link.append(el("span", "bc-row-num", String(i + 1)), cover, text);
    const play = el("button", "bc-row-act");
    play.type = "button";
    play.innerHTML = ICON_PLAY;
    play.title = "Lancer cet album";
    play.setAttribute("aria-label", "Lancer " + a.title);
    play.addEventListener("click", () => playOne(a));
    const queue = el("button", "bc-row-act");
    queue.type = "button";
    queue.innerHTML = ICON_QUEUE;
    queue.title = "Ajouter à la file d'attente";
    queue.setAttribute("aria-label", "Ajouter " + a.title + " à la file d'attente");
    queue.addEventListener("click", () => queueOne(a));
    const dur = el("span", "bc-row-dur", durationOf(a) ? formatLength(durationOf(a)) : "");
    const del = el("button", "bc-row-del", "×");
    del.type = "button";
    del.title = "Retirer du bac";
    del.setAttribute("aria-label", "Retirer du bac");
    del.addEventListener("click", () => {
      const bac = Store.bac(id);
      Store.updateBac(id, { albums: bac.albums.filter(x => x !== a.id) });
    });
    li.append(grip, link, play, queue, dur, del);
    dragRow(li);
    return li;
  }

  // Glisser-déposer comme dans next up : la ligne se prend n'importe où, un trait
  // indique où elle va tomber ; la liste n'est redessinée qu'une fois le geste fini.
  let drag = null, pending = null;
  function clearMarks() {
    document.querySelectorAll(".bc-row.is-drop-before, .bc-row.is-drop-after")
      .forEach(n => n.classList.remove("is-drop-before", "is-drop-after"));
  }
  function runPending() { const fn = pending; pending = null; if (fn) fn(); }
  function dragRow(li) {
    li.draggable = true;
    const after = e => { const r = li.getBoundingClientRect(); return e.clientY > r.top + r.height / 2; };
    li.addEventListener("dragstart", e => {
      drag = { id: li.dataset.id };
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", li.dataset.id); } catch (err) {}
      li.classList.add("is-dragging");
    });
    li.addEventListener("dragend", () => {
      drag = null;
      li.classList.remove("is-dragging");
      clearMarks();
      runPending();
    });
    li.addEventListener("dragover", e => {
      if (!drag || drag.id === li.dataset.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const cls = after(e) ? "is-drop-after" : "is-drop-before";
      if (!li.classList.contains(cls)) { clearMarks(); li.classList.add(cls); }
    });
    li.addEventListener("drop", e => {
      if (!drag || drag.id === li.dataset.id) return;
      e.preventDefault();
      const ids = [...li.parentNode.children].map(n => n.dataset.id);
      const moved = drag.id;
      ids.splice(ids.indexOf(moved), 1);
      ids.splice(ids.indexOf(li.dataset.id) + (after(e) ? 1 : 0), 0, moved);
      clearMarks();
      const bac = Store.bac(id);
      const rest = bac.albums.filter(x => !ids.includes(x));   // albums retirés de la collection : gardés à la fin
      pending = () => Store.updateBac(id, { albums: ids.concat(rest) });
      setTimeout(runPending, 150);
    });
  }

  // ---------- Pochette du bac ----------

  let coverPop = null;
  function closeCoverPop() { if (coverPop) { coverPop.remove(); coverPop = null; } }
  function squareImage(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(600, img.width, img.height), side = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        canvas.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        URL.revokeObjectURL(img.src);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }
  function useImage(blob) {
    squareImage(blob).then(data => { Store.updateBac(id, { cover: data, coverAlbum: null }); closeCoverPop(); })
      .catch(() => flash("Image illisible"));
  }
  function openCoverPop() {
    if (coverPop) { closeCoverPop(); return; }
    const bac = Store.bac(id);
    const albums = albumsOf(bac);
    coverPop = el("div", "bacs-pop bc-cover-pop");
    const opt = (label, on, fn) => {
      const b = el("button", "bacs-pop-item" + (on ? " is-on" : ""));
      b.type = "button";
      b.append(el("span", "bacs-pop-check", on ? "✓" : ""), el("span", null, label));
      b.addEventListener("click", fn);
      return b;
    };
    const auto = !bac.cover && !bac.coverAlbum;
    coverPop.append(el("p", "bacs-pop-title", "pochette du bac"),
      opt("Mosaïque des albums (automatique)", auto, () => { Store.updateBac(id, { cover: null, coverAlbum: null }); closeCoverPop(); }),
      opt("Image du PC…", !!bac.cover, () => $("bc-cover-file").click()));
    if (albums.length) {
      coverPop.append(el("p", "bacs-pop-title", "ou la pochette d'un album"));
      const grid = el("div", "bc-cover-grid");
      albums.slice(0, 24).forEach(a => {
        const b = el("button", "bc-cover-pick" + (bac.coverAlbum === a.id && !bac.cover ? " is-on" : ""));
        b.type = "button";
        b.title = a.title + " — " + a.artist;
        b.appendChild(coverImg(a, 100));
        b.addEventListener("click", () => { Store.updateBac(id, { coverAlbum: a.id, cover: null }); closeCoverPop(); });
        grid.appendChild(b);
      });
      coverPop.appendChild(grid);
    }
    coverPop.appendChild(el("p", "bacs-pop-link", "Astuce : Ctrl + V colle une image copiée."));
    document.body.appendChild(coverPop);
    const r = $("bc-cover-btn").getBoundingClientRect();
    coverPop.style.top = (r.bottom + window.scrollY + 6) + "px";
    coverPop.style.left = (r.left + window.scrollX) + "px";
  }
  $("bc-cover-btn").addEventListener("click", e => { e.stopPropagation(); openCoverPop(); });
  $("bc-cover-file").addEventListener("change", e => { if (e.target.files[0]) useImage(e.target.files[0]); e.target.value = ""; });
  document.addEventListener("click", e => { if (coverPop && !e.composedPath().includes(coverPop)) closeCoverPop(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && coverPop) { e.preventDefault(); e.stopPropagation(); closeCoverPop(); } }, true);
  // Coller une image (Ctrl + V) sur la page d'un bac : nouvelle pochette
  document.addEventListener("paste", e => {
    if (!id || /^(input|textarea)$/i.test((e.target && e.target.tagName) || "")) return;
    const item = [...(e.clipboardData ? e.clipboardData.items : [])].find(x => x.type.startsWith("image/"));
    if (item) { e.preventDefault(); useImage(item.getAsFile()); }
  });

  // Ajouter un album de la collection (titre ou artiste)
  const addInput = $("bc-add-input"), addList = $("bc-add-results");
  let found = [];
  function search() {
    const q = norm(addInput.value.trim());
    const bac = Store.bac(id);
    if (!q || !bac) { addList.hidden = true; found = []; return; }
    found = Store.raw().filter(a => !a.nextUp && !bac.albums.includes(a.id) && norm(a.title + " " + a.artist).includes(q)).slice(0, 8);
    addList.replaceChildren(...(found.length ? found.map((a, i) => {
      const li = el("li");
      const b = el("button", "bc-add-item" + (i === 0 ? " is-first" : ""));
      b.type = "button";
      const c = el("span", "bc-row-cover");
      c.appendChild(coverImg(a, 100));
      const t = el("span", "bc-row-text");
      t.append(el("span", "bc-row-title", a.title), el("span", "bc-row-artist", a.artist + (a.year ? " · " + a.year : "")));
      b.append(c, t, el("span", "bc-add-plus", "+"));
      b.addEventListener("click", () => add(a));
      li.appendChild(b);
      return li;
    }) : [el("li", "bc-add-none", "Aucun album de la collection ne correspond.")]));
    addList.hidden = false;
  }
  function add(a) {
    Store.toggleInBac(id, a.id, true);
    addInput.value = "";
    addList.hidden = true;
    addInput.focus();
  }
  addInput.addEventListener("input", search);
  addInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && found.length) { e.preventDefault(); add(found[0]); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); addInput.value = ""; addList.hidden = true; addInput.blur(); }
  });
  document.addEventListener("click", e => { if (!e.composedPath().some(n => n.classList && n.classList.contains("bc-add"))) addList.hidden = true; });

  // Lire / file d'attente
  $("bc-play").addEventListener("click", () => {
    const albums = albumsOf(Store.bac(id));
    if (!albums.length || typeof Playback === "undefined") return;
    Playback.playId(albums[0].id, false);
    albums.slice(1).forEach(a => Playback.addToQueue(a.id));
  });
  $("bc-queue").addEventListener("click", () => {
    const albums = albumsOf(Store.bac(id));
    if (typeof Playback === "undefined") return;
    albums.forEach(a => Playback.addToQueue(a.id));
    const b = $("bc-queue");
    b.textContent = "Ajouté ✓";
    setTimeout(() => { b.textContent = "Ajouter à la file"; }, 1800);
  });

  // Renommer (sur place)
  $("bc-rename").addEventListener("click", () => {
    const h = $("bc-name");
    if (h.querySelector("input")) return;
    const input = el("input", "field bc-rename-field");
    input.value = Store.bac(id).name;
    input.maxLength = 80;
    h.replaceChildren(input);
    input.focus();
    input.select();
    const done = save => {
      const v = input.value.trim();
      h.textContent = save && v ? Store.updateBac(id, { name: v }).name : Store.bac(id).name;
      renderOne();
    };
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); done(true); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); }
    });
    input.addEventListener("blur", () => { if (input.isConnected) done(true); });
  });

  // Supprimer : un premier clic arme, le second supprime
  $("bc-delete").addEventListener("click", () => {
    const b = $("bc-delete");
    if (b.dataset.armed) { Store.deleteBac(id); location.href = "bacs.html"; return; }
    b.dataset.armed = "1";
    b.textContent = "Supprimer ce bac ?";
    b.classList.add("is-danger");
    setTimeout(() => { delete b.dataset.armed; b.textContent = "Supprimer"; b.classList.remove("is-danger"); }, 3000);
  });

  // =====================================================================

  function render() {
    if (drag) return;
    closeCoverPop();
    if (id) renderOne(); else renderIndex();
  }
  $("bc-index").hidden = !!id;
  $("bc-one").hidden = !id;
  document.addEventListener("bacs:changed", render);
  document.addEventListener("albums:changed", render);
  render();
})();
