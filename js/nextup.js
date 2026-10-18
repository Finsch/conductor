// conductor. — page « next up » : albums repérés, pas encore écoutés
//
// - Séparés de la collection (Store.nextUp) : ni compteurs, ni filtres de l'accueil.
// - Pas de page album : un clic ouvre une fiche (pochette, infos, priorité,
//   « Ajouter à la collection », « Retirer de next up »).
// - En haut, le top 5 (priorités 1 à 5, sur le téléphone ou pas), en grille.
// - Le reste en listes numérotées : sur le téléphone / pas sur le téléphone.
//   Sans bibliothèque connectée : une seule liste.
// - nextup.html?album=<id> ouvre directement la fiche de cet album.

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

  function topCard(album, rank) {
    if (!album) {
      const slot = el("div", "nu-slot");
      slot.append(el("span", "nu-rank", String(rank)), el("span", "nu-slot-text", "libre"));
      return slot;
    }
    const card = el("button", "album-card nu-card");
    card.type = "button";
    const cover = coverEl(album, "album-cover", 600);
    cover.appendChild(el("span", "nu-rank", String(rank)));
    if (onPhone(album)) cover.appendChild(el("span", "phone-badge", "sur le tél."));
    card.append(cover, el("p", "album-title", album.title), el("p", "album-artist", album.artist));
    card.addEventListener("click", () => openCard(album.id));
    return card;
  }

  // ---------- Listes numérotées ----------

  function row(album, n) {
    const li = el("li");
    const b = el("button", "nu-row");
    b.type = "button";
    const text = el("div", "row-text");
    text.append(el("p", "row-title", album.title), el("p", "row-artist", album.artist));
    const tracks = trackCountOf(album);
    const length = durationOf(album);
    b.append(
      el("span", "nu-num", String(n)),
      coverEl(album, "row-cover", 100),
      text,
      el("span", "row-cell nu-year", yearOf(album)),
      el("span", "row-cell nu-genre", album.genre || ""),
      el("span", "row-cell nu-tracks", tracks ? formatTracks(tracks) : ""),
      el("span", "row-cell nu-length", length ? formatLength(length) : ""),
      el("span", "row-cell nu-since", since(album.nextUpAt))
    );
    b.addEventListener("click", () => openCard(album.id));
    li.appendChild(b);
    return li;
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

    // Top 5
    const byRank = new Map(list.filter(a => a.priority).map(a => [a.priority, a]));
    $("nu-top-section").hidden = !list.length;
    $("nu-top").replaceChildren(...Array.from({ length: TOP }, (_, i) => topCard(byRank.get(i + 1), i + 1)));

    // Le reste (hors top 5)
    const rest = list.filter(a => !a.priority);
    const phone = linked ? rest.filter(onPhone) : [];
    const other = linked ? rest.filter(a => !onPhone(a)) : rest;

    $("nu-phone").hidden = !phone.length;
    $("nu-phone-count").textContent = phone.length || "";
    $("nu-phone-list").replaceChildren(...phone.map((a, i) => row(a, i + 1)));

    $("nu-other").hidden = !other.length;
    $("nu-other-count").textContent = other.length || "";
    $("nu-other-title").textContent = linked ? "pas sur le téléphone" : "à écouter";
    $("nu-other-hint").textContent = linked
      ? "Extraits de 30 secondes seulement, en attendant d'avoir les fichiers."
      : "Connectez votre bibliothèque (audio-files) pour voir lesquels sont sur le téléphone.";
    $("nu-other-list").replaceChildren(...other.map((a, i) => row(a, i + 1)));

    if (dialog.open && current) fillCard();
  }

  // ---------- Fiche (fenêtre) ----------

  const dialog = $("nu-dialog");
  let current = null;   // id de l'album affiché

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
    $("nu-d-since").textContent = [sinceLabel(album.nextUpAt), onPhone(album) ? "sur le téléphone" : ""]
      .filter(Boolean).join(" · ");

    // Priorité : 1 à 5 ; recliquer sur la sienne la retire
    const taken = new Map(Store.nextUp().filter(a => a.priority && a.id !== album.id).map(a => [a.priority, a]));
    $("nu-d-prio").replaceChildren(...Array.from({ length: TOP }, (_, i) => {
      const n = i + 1;
      const b = el("button", "chip" + (album.priority === n ? " is-active" : ""), String(n));
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(album.priority === n));
      const other = taken.get(n);
      b.title = album.priority === n ? "Retirer la priorité"
        : other ? "Remplace « " + other.title + " »" : "Priorité " + n;
      if (other) b.classList.add("is-taken");
      b.addEventListener("click", () => Store.setPriority(album.id, album.priority === n ? null : n));
      return b;
    }));
    $("nu-d-prio-hint").textContent = album.priority
      ? "N° " + album.priority + " du top 5. Recliquez pour retirer."
      : "Un rang déjà pris est retiré à l'autre album.";
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

  $("nu-d-add").addEventListener("click", () => {
    const album = Store.get(current);
    if (!album) return;
    Store.logAlbum(album, { date: new Date().toLocaleDateString("sv-SE"), rating: null, review: "" });
    const go = () => { location.href = "album.html?id=" + encodeURIComponent(album.id); };
    const write = typeof Disk !== "undefined" ? Promise.resolve(Disk.writeNow()) : Promise.resolve();
    Promise.race([write.catch(() => {}), new Promise(r => setTimeout(r, 3000))]).then(go);
  });

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
