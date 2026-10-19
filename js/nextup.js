// conductor. — page « next up » : albums repérés, pas encore écoutés
//
// - Séparés de la collection (Store.nextUp) : ni compteurs, ni filtres de l'accueil.
// - Pas de page album : un clic ouvre une fiche (pochette, infos, priorité,
//   « Ajouter à la collection », « Retirer de next up »).
// - En haut, le top 5 (priorités 1 à 5, sur le téléphone ou pas), en grille.
// - Le reste en listes numérotées : sur le téléphone / pas sur le téléphone.
//   Sans bibliothèque connectée : une seule liste.
// - nextup.html?album=<id> ouvre directement la fiche de cet album.
// - Au survol d'une pochette : bouton « ajouter à la collection ».
// - Glisser-déposer : le top 5 entre eux ; chaque liste entre ses éléments ;
//   un album « sur le téléphone » vers une place du top 5.

(function () {
  const $ = id => document.getElementById(id);
  const TOP = 5;

  // Les pages ouvertes d'ici reviennent ici (flèche retour)
  try { sessionStorage.setItem("conductor01.home", location.href.split("?")[0]); } catch (e) {}

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function plural(n, word) {
    return n + " " + word + (n > 1 ? "s" : "");
  }

  function yearOf(a) {
    if (a.releaseDate) return a.releaseDate.slice(0, 4);
    return a.year ? String(a.year) : "";
  }

  function trackCountOf(a) {
    return (a.tracks && a.tracks.length) || a.trackCount || null;
  }

  function durationOf(a) {
    if (a.duration) return a.duration;
    return (a.tracks || []).reduce((s, t) => s + (t.duration || 0), 0) || null;
  }

  // "aujourd'hui", "hier", "3 jours", "2 mois"…
  function since(iso) {
    if (!iso) return "";
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return "aujourd'hui";
    if (days === 1) return "hier";
    if (days < 60) return days + " jours";
    if (days < 730) return Math.floor(days / 30) + " mois";
    return Math.floor(days / 365) + " ans";
  }

  // Album qui dort : plus de 3 mois dans next up, jamais écouté
  const SLEEP_DAYS = 90;
  function sleeping(a) {
    if (!a.nextUpAt || (a.plays || []).length) return false;
    return Date.now() - new Date(a.nextUpAt).getTime() > SLEEP_DAYS * 86400000;
  }

  function sinceLabel(iso) {
    const s = since(iso);
    if (!s) return "";
    return s === "aujourd'hui" || s === "hier" ? "ajouté " + s : "ajouté depuis " + s;
  }

  function coverSrc(album, size) {
    const src = album.cover || (album.serverCover && Server.isConfigured() ? Server.coverUrl(album.serverCover, size) : "");
    return src ? localUrl(src) : "";
  }

  function coverEl(album, cls, size) {
    const cover = el("div", cls);
    const src = coverSrc(album, size);
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => img.remove();
      cover.appendChild(img);
    }
    return cover;
  }

  // ---------- Téléphone ----------

  let index = null;
  function onPhone(a) {
    return !!(index && Server.matchFor(a, index));
  }

  // ---------- Top 5 (grille) ----------

  // Top 5 : priorités choisies à leur rang, cases libres remplies par les plus récents
  function computeTop(list) {
    const byRank = new Map(list.filter(a => a.priority).map(a => [a.priority, a]));
    // Pas de priorité (ou en attente au-delà du 5e rang) : par récence
    const recent = list.filter(a => !a.priority || a.priority > TOP)
      .sort((a, b) => (b.nextUpAt || "").localeCompare(a.nextUpAt || ""));   // plus récents d'abord
    return Array.from({ length: TOP }, (_, i) => {
      const chosen = byRank.get(i + 1);
      if (chosen) return { album: chosen, auto: false };
      const next = recent.shift();
      return next ? { album: next, auto: true } : { album: null, auto: false };
    });
  }

  // Bouton « ajouter à la collection » (coin bas droit de la pochette, au survol)
  const COLLECT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="13" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M7 20.5h12.5a1 1 0 0 0 1-1V7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M9.5 6.5v6M6.5 9.5h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  function collectBtn(album) {
    const b = el("span", "cover-queue nu-collect");
    b.setAttribute("role", "button");
    b.tabIndex = 0;
    b.title = "Ajouter à la collection et ouvrir sa fiche";
    b.setAttribute("aria-label", "Ajouter « " + album.title + " » à la collection");
    b.innerHTML = COLLECT_ICON;
    const go = e => {
      e.preventDefault();
      e.stopPropagation();
      addAndOpen(album.id);
    };
    b.addEventListener("click", go);
    b.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") go(e); });
    return b;
  }

  function topCard(album, rank, auto) {
    if (!album) {
      const slot = el("div", "nu-slot");
      slot.append(el("span", "nu-rank", String(rank)), el("span", "nu-slot-text", "libre"));
      dropTop(slot, rank);
      return slot;
    }
    const card = el("button", "album-card nu-card");
    card.type = "button";
    const cover = coverEl(album, "album-cover", 600);
    const badge = el("span", "nu-rank" + (auto ? " is-auto" : ""), String(rank));
    badge.title = auto ? "Rang par récence (pas de priorité choisie)" : "Priorité " + rank;
    cover.appendChild(badge);
    if (onPhone(album)) cover.appendChild(el("span", "phone-badge", "sur le tél."));
    if (sleeping(album)) {
      const z = el("span", "sleep-badge", "endormi");
      z.title = "Dans next up depuis " + since(album.nextUpAt) + ", jamais écouté";
      cover.appendChild(z);
    }
    cover.appendChild(collectBtn(album));
    card.append(cover, el("p", "album-title", album.title), el("p", "album-artist", album.artist));
    card.addEventListener("click", () => openCard(album.id));
    dragSource(card, album.id, "top");
    dropTop(card, rank);
    return card;
  }

  // ---------- Listes numérotées ----------

  function row(album, n, listName) {
    const li = el("li");
    const b = el("button", "nu-row");
    b.type = "button";
    const text = el("div", "row-text");
    text.append(el("p", "row-title", album.title), el("p", "row-artist", album.artist));
    const tracks = trackCountOf(album);
    const length = durationOf(album);
    b.append(
      el("span", "nu-num", String(n)),
      (() => { const c = coverEl(album, "row-cover", 100); c.appendChild(collectBtn(album)); return c; })(),
      text,
      el("span", "row-cell nu-year", yearOf(album)),
      el("span", "row-cell nu-genre", album.genre || ""),
      el("span", "row-cell nu-tracks", tracks ? formatTracks(tracks) : ""),
      el("span", "row-cell nu-length", length ? formatLength(length) : ""),
      (() => {
        const c = el("span", "row-cell nu-since" + (sleeping(album) ? " is-sleeping" : ""), since(album.nextUpAt));
        if (sleeping(album)) c.title = "Endormi : dans next up depuis " + since(album.nextUpAt) + ", jamais écouté";
        return c;
      })()
    );
    b.addEventListener("click", () => openCard(album.id));
    li.appendChild(b);
    li.dataset.id = album.id;
    dragSource(li, album.id, listName);
    dropList(li, listName);
    return li;
  }

  // ---------- Glisser-déposer ----------
  // top 5 ↔ top 5 ; « sur le téléphone » ↔ elle-même et → top 5 ;
  // « pas sur le téléphone » ↔ elle-même.

  let drag = null;   // { id, from: "top" | "phone" | "other" }
  let pending = null;   // modification à appliquer une fois le glisser terminé

  // Appliquée après « dragend » : la liste redessinée ne coupe pas le glisser en cours
  function later(fn) {
    pending = fn;
    setTimeout(runPending, 150);   // au cas où « dragend » n'arrive pas
  }
  function runPending() {
    const fn = pending;
    pending = null;
    if (fn) fn();
  }

  function clearMarks() {
    document.querySelectorAll(".is-drop-before, .is-drop-after, .is-drop-target")
      .forEach(n => n.classList.remove("is-drop-before", "is-drop-after", "is-drop-target"));
  }

  function dragSource(node, id, from) {
    node.draggable = true;
    node.addEventListener("dragstart", e => {
      drag = { id, from };
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", id); } catch (err) {}
      node.classList.add("is-dragging");
    });
    node.addEventListener("dragend", () => {
      drag = null;
      node.classList.remove("is-dragging");
      clearMarks();
      runPending();
    });
  }

  // Place du top 5 : accepte le top 5 et la liste « sur le téléphone »
  function dropTop(node, rank) {
    const ok = () => drag && (drag.from === "top" || drag.from === "phone");
    node.addEventListener("dragover", e => {
      if (!ok()) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      clearMarks();
      node.classList.add("is-drop-target");
    });
    node.addEventListener("dragleave", () => node.classList.remove("is-drop-target"));
    node.addEventListener("drop", e => {
      if (!ok()) return;
      e.preventDefault();
      const d = drag;
      clearMarks();
      if (d.from === "top") {
        const ids = top.map(t => t.album && t.album.id);
        const from = ids.indexOf(d.id);
        if (from < 0 || from === rank - 1) return;
        ids.splice(from, 1);
        ids.splice(rank - 1, 0, d.id);
        later(() => Store.setTop(ids.filter(Boolean)));
      } else {
        later(() => Store.setPriority(d.id, rank));
      }
    });
  }

  // Ligne d'une liste : accepte seulement les lignes de la même liste
  function dropList(li, listName) {
    const after = e => {
      const r = li.getBoundingClientRect();
      return e.clientY > r.top + r.height / 2;
    };
    li.addEventListener("dragover", e => {
      if (!drag || drag.from !== listName || drag.id === li.dataset.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      clearMarks();
      li.classList.add(after(e) ? "is-drop-after" : "is-drop-before");
    });
    li.addEventListener("drop", e => {
      if (!drag || drag.from !== listName || drag.id === li.dataset.id) return;
      e.preventDefault();
      const ids = [...li.parentNode.children].map(n => n.dataset.id);
      const from = ids.indexOf(drag.id);
      ids.splice(from, 1);
      let to = ids.indexOf(li.dataset.id) + (after(e) ? 1 : 0);
      ids.splice(to, 0, drag.id);
      clearMarks();
      later(() => Store.setNextUpOrder(ids));
    });
  }

  // ---------- Rendu ----------

  function render() {
    const list = Store.nextUp();
    const linked = Server.isConfigured();
    index = linked ? Server.cachedIndex() : null;

    const phoneCount = list.filter(onPhone).length;
    $("nu-stats").replaceChildren();
    if (list.length) {
      $("nu-stats").appendChild(el("strong", null, plural(list.length, "album")));
      if (linked) $("nu-stats").append(", ", el("strong", null, phoneCount + " sur le téléphone"));
    }
    $("nu-empty").hidden = list.length > 0;

    // Albums qui dorment (les plus anciens d'abord)
    const asleep = list.filter(sleeping).sort((a, b) => (a.nextUpAt || "").localeCompare(b.nextUpAt || ""));
    $("nu-sleep").hidden = !asleep.length;
    $("nu-sleep-title").textContent = plural(asleep.length, "album") + (asleep.length > 1 ? " dorment" : " dort") +
      " dans next up : ajouté" + (asleep.length > 1 ? "s" : "") + " il y a plus de 3 mois, jamais écouté" + (asleep.length > 1 ? "s" : "") + ".";
    $("nu-sleep-list").replaceChildren(...asleep.map(a => {
      const li = el("li");
      const b = el("button", "text-btn nu-sleep-item");
      b.type = "button";
      b.append(el("span", "nu-sleep-name", a.title + " — " + a.artist), el("span", "nu-sleep-since", " · " + since(a.nextUpAt)));
      b.addEventListener("click", () => openCard(a.id));
      li.appendChild(b);
      return li;
    }));

    // Top 5
    top = computeTop(list);
    $("nu-top-section").hidden = !list.length;
    $("nu-top").replaceChildren(...top.map((t, i) => topCard(t.album, i + 1, t.auto)));

    // Le reste (hors top 5)
    const inTop = new Set(top.filter(t => t.album).map(t => t.album.id));
    const rest = list.filter(a => !inTop.has(a.id));
    const phone = linked ? rest.filter(onPhone) : [];
    const other = linked ? rest.filter(a => !onPhone(a)) : rest;

    $("nu-phone").hidden = !phone.length;
    $("nu-phone-count").textContent = phone.length || "";
    $("nu-phone-list").replaceChildren(...phone.map((a, i) => row(a, i + 1, "phone")));

    $("nu-other").hidden = !other.length;
    $("nu-other-count").textContent = other.length || "";
    $("nu-other-title").textContent = linked ? "pas sur le téléphone" : "à écouter";
    $("nu-other-hint").textContent = linked
      ? "Extraits de 30 secondes seulement, en attendant d'avoir les fichiers."
      : "Connectez votre bibliothèque (audio-files) pour voir lesquels sont sur le téléphone.";
    $("nu-other-list").replaceChildren(...other.map((a, i) => row(a, i + 1, "other")));

    if (dialog.open && current) fillCard();
  }

  // ---------- Fiche (fenêtre) ----------

  const dialog = $("nu-dialog");
  let current = null;   // id de l'album affiché
  let top = [];         // top 5 affiché ({ album, auto })

  function fillCard() {
    const album = Store.get(current);
    if (!album || !album.nextUp) { dialog.close(); return; }

    const cover = $("nu-d-cover");
    cover.replaceChildren();
    const src = coverSrc(album, 300);
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.onerror = () => img.remove();
      cover.appendChild(img);
    }
    $("nu-d-title").textContent = album.title;
    $("nu-d-artist").textContent = album.artist;
    const tracks = trackCountOf(album);
    const length = durationOf(album);
    $("nu-d-info").textContent = [
      yearOf(album),
      tracks ? formatTracks(tracks) : "",
      length ? formatLength(length) : "",
      album.genre
    ].filter(Boolean).join(" · ");
    $("nu-d-since").textContent = [sinceLabel(album.nextUpAt), sleeping(album) ? "jamais écouté (endormi)" : "", onPhone(album) ? "sur le téléphone" : ""]
      .filter(Boolean).join(" · ");

    // Priorité : 1 à 5 ; recliquer sur la sienne la retire
    const taken = new Map(Store.nextUp().filter(a => a.priority && a.id !== album.id).map(a => [a.priority, a]));
    const autoRank = top.findIndex(t => t.auto && t.album && t.album.id === album.id) + 1;
    $("nu-d-prio").replaceChildren(...Array.from({ length: TOP }, (_, i) => {
      const n = i + 1;
      const b = el("button", "chip" + (album.priority === n ? " is-active" : ""), String(n));
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(album.priority === n));
      const other = taken.get(n);
      b.title = album.priority === n ? "Retirer la priorité"
        : other ? "« " + other.title + " » et les suivants descendent d'un rang" : "Priorité " + n;
      if (other) b.classList.add("is-taken");
      if (!album.priority && autoRank === n) b.classList.add("is-auto");
      b.addEventListener("click", () => Store.setPriority(album.id, album.priority === n ? null : n));
      return b;
    }));
    $("nu-d-prio-hint").textContent = album.priority
      ? "N° " + album.priority + " du top 5. Recliquez pour retirer."
      : autoRank
        ? "N° " + autoRank + " du top 5 par récence. Choisissez un rang pour le fixer."
        : "Rang déjà pris : l'album qui l'occupe et les suivants descendent d'un rang.";
  }

  function openCard(id) {
    current = id;
    fillCard();
    if (!dialog.open) dialog.showModal();

    // Titres, durée… manquants : complétés en arrière-plan (album venu de Deezer)
    const album = Store.get(id);
    if (album && album.source === "Deezer" && album.sourceId && (!album.duration || !album.trackCount)) {
      Catalog.details(album).then(full => {
        const patch = {};
        ["duration", "trackCount", "releaseDate", "year", "genre", "label"].forEach(k => {
          if (full[k] && !album[k]) patch[k] = full[k];
        });
        if (Object.keys(patch).length) Store.update(id, patch);
      }).catch(() => {});
    }
  }

  $("nu-d-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });

  // Range l'album dans la collection (un ajout, pas une écoute) et ouvre sa page
  function addAndOpen(id) {
    if (!Store.get(id)) return;
    Store.toCollection(id);
    const go = () => { location.href = "album.html?id=" + encodeURIComponent(id); };
    const write = typeof Disk !== "undefined" ? Promise.resolve(Disk.writeNow()) : Promise.resolve();
    Promise.race([write.catch(() => {}), new Promise(r => setTimeout(r, 3000))]).then(go);
  }

  $("nu-d-add").addEventListener("click", () => { if (current) addAndOpen(current); });

  $("nu-d-remove").addEventListener("click", () => {
    const album = Store.get(current);
    if (!album) return;
    Store.remove(album.id);
    dialog.close();
  });

  document.addEventListener("albums:changed", render);
  document.addEventListener("server:index", render);
  render();

  // nextup.html?album=<id> : ouvre la fiche
  const wanted = new URLSearchParams(location.search).get("album");
  if (wanted && Store.get(wanted) && Store.get(wanted).nextUp) openCard(wanted);
  if (wanted) history.replaceState(null, "", location.pathname);
})();
