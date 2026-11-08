// conductor01. — page d'accueil : collection, vue grille/liste, tri et filtres

(function () {
  const grid = document.getElementById("album-grid");
  const stats = document.getElementById("stats");
  const empty = document.getElementById("empty");
  const searchInput = document.getElementById("search-input");
  const sortList = document.getElementById("sort-list");
  const genreList = document.getElementById("genre-list");
  const decadeList = document.getElementById("decade-list");
  const resetBtn = document.getElementById("filters-reset");
  const filtersPanel = document.getElementById("filters");
  const filtersToggle = document.getElementById("filters-toggle");

  // ---------- Préférences mémorisées : vue, tri et filtres ----------
  // Les filtres restent après un aller-retour sur une page album, un
  // rechargement ou une nouvelle visite. « Réinitialiser » / Z les vident.

  const PREFS_KEY = "conductor01.prefs";

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; }
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        view: state.view,
        sort: state.sort,
        filters: {
          genres: [...state.genres],
          openFamilies: [...state.openFamilies],
          decades: [...state.decades],
          colors: [...state.colors],
          colorsOpen: state.colorsOpen,
          filesOnly: state.filesOnly,
          neverOnly: state.neverOnly,
          intensities: [...state.intensities],
          tiers: [...state.tiers],
          letter: state.letter
        }
      }));
    } catch (e) {}
  }

  const prefs = loadPrefs();
  const saved = prefs.filters || {};
  const list = v => (Array.isArray(v) ? v : []);
  const state = {
    view: prefs.view === "list" ? "list" : "grid",
    sort: prefs.sort || "added-desc",
    genres: new Set(list(saved.genres)),              // clés "famille|genre" (voir genreKey)
    openFamilies: new Set(list(saved.openFamilies)),  // familles dépliées dans le filtre
    decades: new Set(list(saved.decades)),
    colors: new Set(list(saved.colors).slice(0, 1)),   // couleur de pochette choisie (une seule)
    colorsOpen: !!saved.colorsOpen,               // section « Couleurs » dépliée
    filesOnly: !!saved.filesOnly,
    neverOnly: !!saved.neverOnly,   // « Jamais écouté » : aucune écoute enregistrée
    favOnly: false,   // « Albums favoris » : jamais repris d'une visite à l'autre (touche F)
    intensities: new Set(list(saved.intensities)),
    tiers: new Set(list(saved.tiers).filter(t => TIERS.includes(t)).slice(0, 1)),   // un seul tier à la fois
    letter: typeof saved.letter === "string" ? saved.letter : "",
    page: 1
  };

  const PER_PAGE = 20;

  // ---------- Outils ----------

  function plural(n, word) {
    return n + " " + word + (n > 1 ? "s" : "");
  }

  // Ignore accents et majuscules : "bjork" trouve "Björk" (fichier commun)
  const normalize = s => CollectionCore.normalize(s);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Tris et filtres intensité / décennies / genres : fichier commun avec la télécommande (js/collection-core.js)
  const Core = CollectionCore;
  const { addedAt, yearOf, decadeOf, durationOf, genreKey } = Core;

  function lastLog(a) {
    return (a.logs && a.logs.length) ? a.logs[a.logs.length - 1] : null;
  }

  const SORTS = Core.SORTS;
  if (!SORTS.some(s => s.id === state.sort)) state.sort = "added-desc";

  // ---------- Filtres ----------

  // Recherche : « mot1+mot2 » = les deux présents ; « mot1/mot2 » = l'un ou l'autre (fichier commun)
  const matchesSearch = (a, q) => CollectionCore.matchesSearch(a, q);

  // Index des albums du téléphone (Navidrome), relu à chaque rendu
  let serverIndex = null;
  const onPhone = a => !!(serverIndex && Server.matchFor(a, serverIndex));

  // Première lettre (sans accent) ; chiffres et symboles → "#"
  function letterOf(str) {
    const c = (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? c : "#";
  }

  // Champ concerné par l'alphabet : titre ou artiste selon le tri choisi
  function letterField() {
    return state.sort === "title" ? "title" : state.sort === "artist" ? "artist" : null;
  }

  function matchesFilters(a, skip) {
    if (skip !== "letter" && state.letter && letterField() && letterOf(a[letterField()]) !== state.letter) return false;
    if (skip !== "files" && state.filesOnly && !onPhone(a)) return false;
    if (skip !== "fav" && state.favOnly && !a.favorite) return false;
    if (skip !== "never" && state.neverOnly && Core.playCount(a) > 0) return false;
    if (skip !== "tier" && state.tiers.size && !state.tiers.has(a.tier)) return false;
    if (!Core.matches(a, state, skip)) return false;   // intensité, genres, décennies
    if (skip !== "color" && state.colors.size && !state.colors.has(a.coverColor)) return false;
    return true;
  }

  function familyCheck(name, count, keys, onChange) {
    const box = el("input");
    box.type = "checkbox";
    const picked = keys.filter(k => state.genres.has(k)).length;
    box.checked = picked > 0 && picked === keys.length;
    box.indeterminate = picked > 0 && picked < keys.length;
    box.addEventListener("change", () => {
      keys.forEach(k => box.checked ? state.genres.add(k) : state.genres.delete(k));
      onChange();
    });
    return box;
  }

  // Couleurs de pochette : section repliable ; pastilles cliquables (une à la fois)
  function renderColors(base) {
    const group = document.getElementById("color-group");
    const head = document.getElementById("color-head");
    const body = document.getElementById("color-list");
    const known = base.filter(a => a.coverColor).length;
    head.setAttribute("aria-expanded", String(state.colorsOpen));
    group.classList.toggle("is-open", state.colorsOpen);
    document.getElementById("color-picked").textContent = state.colors.size ? String(state.colors.size) : "";
    body.hidden = !state.colorsOpen;
    if (!state.colorsOpen) return;
    if (!known) {
      body.replaceChildren(el("p", "hint color-hint", "Les couleurs se calculent à partir des pochettes locales : autorisez le dossier datastorage (bandeau en bas à gauche)."));
      return;
    }
    body.replaceChildren(...COVER_COLORS.map(([name, hex]) => {
      const n = base.filter(a => matchesFilters(a, "color") && a.coverColor === name).length;
      const on = state.colors.has(name);
      const b = el("button", "color-chip" + (on ? " is-active" : ""));
      b.type = "button";
      b.style.setProperty("--swatch", hex);
      b.title = name + " · " + n + " album" + (n > 1 ? "s" : "");
      b.setAttribute("aria-label", b.title);
      b.setAttribute("aria-pressed", String(on));
      b.disabled = !n && !on;
      b.append(el("span", "color-dot"), el("span", "color-n", String(n)));
      b.addEventListener("click", () => {
        // Une seule couleur à la fois ; recliquer la retire
        state.colors.clear();
        if (!on) state.colors.add(name);
        refresh();
      });
      return b;
    }));
  }

  function renderFilters(all, q) {
    // Tri
    sortList.replaceChildren(...SORTS.map(s => {
      const b = el("button", "sort-option" + (s.id === state.sort ? " is-active" : ""), s.label);
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(s.id === state.sort));
      if (s.id === "random") b.title = "Un nouvel ordre à chaque clic";
      b.addEventListener("click", () => {
        if (state.sort !== s.id) state.letter = "";   // l'alphabet change de sens avec le tri
        if (s.id === "random") { Core.reshuffle(); state.page = 1; }   // chaque clic : un nouvel ordre
        state.sort = s.id;
        savePrefs();
        refresh();
      });
      return b;
    }));

    // Les compteurs tiennent compte de la recherche et de l'autre filtre
    const base = all.filter(a => matchesSearch(a, q));

    // Compteurs (genres, décennies, intensité) : fichier commun
    const fc = Core.facets(all, base, matchesFilters);

    // Genres présents dans la collection, rangés par famille (dépliables)
    const genreCount = fc.genres;   // "famille|genre" → nombre
    genreList.replaceChildren(...(fc.families.length ? fc.families.map(({ name: fam, keys, total }) => {
      const open = state.openFamilies.has(fam);
      const group = el("div", "family" + (open ? " is-open" : ""));

      const head = el("div", "check family-head" + (total ? "" : " is-empty"));
      const toggle = el("button", "family-toggle");
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", String(open));
      toggle.title = open ? "Replier" : "Voir les genres";
      toggle.append(el("span", "check-name", fam), el("span", "family-chevron", "›"));
      toggle.addEventListener("click", () => {
        open ? state.openFamilies.delete(fam) : state.openFamilies.add(fam);
        renderFilters(all, q);
      });
      const box = familyCheck(fam, total, keys, refresh);
      box.setAttribute("aria-label", "Famille " + fam);
      head.append(box, toggle, el("span", "count", String(total)));
      group.appendChild(head);

      if (open) {
        const list = el("div", "family-genres");
        keys.forEach(k => {
          const g = k.slice(k.indexOf("|") + 1);
          const label = el("label", "check" + (genreCount.get(k) ? "" : " is-empty"));
          const b = el("input");
          b.type = "checkbox";
          b.checked = state.genres.has(k);
          b.addEventListener("change", () => {
            b.checked ? state.genres.add(k) : state.genres.delete(k);
            refresh();
          });
          label.append(b, el("span", "check-name", g), el("span", "count", String(genreCount.get(k))));
          list.appendChild(label);
        });
        group.appendChild(list);
      }
      return group;
    }) : [el("p", "filter-empty", "Les genres apparaissent une fois les albums complétés.")]));

    // Décennies, à partir des années 1950
    decadeList.replaceChildren(...fc.decadeList.map(d => {
      const n = fc.decades.get(d) || 0;
      const b = el("button", "chip" + (state.decades.has(d) ? " is-active" : ""), Core.decadeLabel(d));
      b.type = "button";
      b.title = n + " album" + (n > 1 ? "s" : "");
      b.disabled = !n && !state.decades.has(d);
      b.setAttribute("aria-pressed", String(state.decades.has(d)));
      b.addEventListener("click", () => {
        state.decades.has(d) ? state.decades.delete(d) : state.decades.add(d);
        refresh();
      });
      return b;
    }));

    // Fichiers sur le téléphone
    const filesGroup = document.getElementById("files-group");
    filesGroup.hidden = !Server.isConfigured();
    if (Server.isConfigured()) {
      document.getElementById("files-only").checked = state.filesOnly;
      document.getElementById("files-count").textContent =
        String(base.filter(a => matchesFilters(a, "files") && onPhone(a)).length);
    }

    // Favoris
    document.getElementById("fav-filter-icon").innerHTML = favIcon(true);
    document.getElementById("fav-only").checked = state.favOnly;
    document.getElementById("fav-count").textContent =
      String(base.filter(a => matchesFilters(a, "fav") && a.favorite).length);

    // Jamais écouté
    document.getElementById("never-only").checked = state.neverOnly;
    document.getElementById("never-count").textContent =
      String(base.filter(a => matchesFilters(a, "never") && !Core.playCount(a)).length);

    // Tier S / A / B (un seul à la fois ; recliquer le retire)
    const tierCount = new Map();
    base.filter(a => matchesFilters(a, "tier")).forEach(a => {
      if (a.tier) tierCount.set(a.tier, (tierCount.get(a.tier) || 0) + 1);
    });
    document.getElementById("tier-list").replaceChildren(...TIERS.map(t => {
      const c = tierCount.get(t) || 0;
      const on = state.tiers.has(t);
      const b = el("button", "tier-chip tier-" + t + (on ? " is-active" : ""));
      b.type = "button";
      b.append(el("span", "tier-letter", t), el("span", "count", String(c)));
      b.title = "Tier " + t + " · " + TIER_NAMES[t] + " · " + c + " album" + (c > 1 ? "s" : "");
      b.disabled = !c && !on;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(on));
      b.addEventListener("click", () => {
        state.tiers.clear();
        if (!on) state.tiers.add(t);
        refresh();
      });
      return b;
    }));

    // Alphabet (tri Titre ou Artiste A → Z)
    const field = letterField();
    document.getElementById("letter-group").hidden = !field;
    if (field) {
      document.getElementById("letter-title").textContent = field === "title" ? "Titre commençant par" : "Artiste commençant par";
      const present = new Set(base.filter(a => matchesFilters(a, "letter")).map(a => letterOf(a[field])));
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");
      document.getElementById("letter-list").replaceChildren(...letters.map(L => {
        const b = el("button", "letter" + (state.letter === L ? " is-active" : ""), L);
        b.type = "button";
        b.disabled = !present.has(L) && state.letter !== L;
        b.setAttribute("aria-pressed", String(state.letter === L));
        b.addEventListener("click", () => { state.letter = state.letter === L ? "" : L; refresh(); });
        return b;
      }));
    }

    // Intensité 1 à 10 (plusieurs choix possibles)
    const intCount = fc.intensities;
    document.getElementById("intensity-list").replaceChildren(...Core.INTENSITIES.map(n => {
      const c = intCount.get(n) || 0;
      const b = el("button", "chip intensity" + (state.intensities.has(n) ? " is-active" : ""), String(n));
      b.type = "button";
      b.title = c + " album" + (c > 1 ? "s" : "");
      b.disabled = !c && !state.intensities.has(n);
      b.setAttribute("aria-pressed", String(state.intensities.has(n)));
      b.addEventListener("click", () => {
        state.intensities.has(n) ? state.intensities.delete(n) : state.intensities.add(n);
        refresh();
      });
      return b;
    }));

    renderColors(base);
    resetBtn.hidden = !state.genres.size && !state.decades.size && !state.colors.size && !state.filesOnly && !state.favOnly && !state.neverOnly &&
      !state.intensities.size && !state.tiers.size && !state.letter;
  }

  document.getElementById("fav-only").addEventListener("change", e => {
    state.favOnly = e.target.checked;
    refresh();
  });
  document.getElementById("never-only").addEventListener("change", e => {
    state.neverOnly = e.target.checked;
    refresh();
  });
  document.getElementById("files-only").addEventListener("change", e => {
    state.filesOnly = e.target.checked;
    refresh();
  });
  document.addEventListener("server:index", render);

  resetBtn.addEventListener("click", () => {
    state.genres.clear();
    state.decades.clear();
    state.colors.clear();
    state.filesOnly = false;
    state.favOnly = false;
    state.neverOnly = false;
    state.intensities.clear();
    state.tiers.clear();
    state.letter = "";
    state.openFamilies.clear();   // familles de genres repliées
    refresh();
  });

  // Mobile : la colonne filtres s'ouvre avec le bouton "Filtres"
  filtersToggle.addEventListener("click", () => {
    const open = filtersPanel.classList.toggle("is-open");
    filtersToggle.setAttribute("aria-expanded", String(open));
  });

  document.getElementById("color-head").addEventListener("click", () => {
    state.colorsOpen = !state.colorsOpen;
    savePrefs();
    render();
  });

  // ---------- Vue grille / liste ----------

  const viewBtns = document.querySelectorAll(".view-btn");
  viewBtns.forEach(b => b.addEventListener("click", () => {
    state.view = b.dataset.view;
    savePrefs();
    render();
  }));

  function coverEl(album, cls) {
    const cover = el("div", cls);
    // Album favori : étoile dans le coin de la pochette
    if (album.favorite) {
      const star = el("span", "cover-fav");
      star.innerHTML = favIcon(true);
      star.title = "Album favori";
      cover.appendChild(star);
    }
    cover.appendChild(coverActions(album));
    if (cls === "album-cover") cover.appendChild(coverCopyButton(album));   // vue grille seulement
    // Pas de pochette en ligne : celle de vos fichiers
    const src = album.cover || (album.serverCover && Server.isConfigured() ? Server.coverUrl(album.serverCover, 600) : "");
    if (src) {
      const img = el("img");
      img.src = localUrl(src);
      img.alt = album.title + " — " + album.artist;
      img.loading = "lazy";
      img.onerror = () => img.remove(); // image introuvable → carré gris
      cover.appendChild(img);
    }
    return cover;
  }

  // Boutons ▶ / « 3 traits + » sur les pochettes : js/cover-actions.js (coverActions)

  function albumLink(album, cls) {
    const a = el("a", cls);
    a.href = "pages/album.html?id=" + encodeURIComponent(album.id);
    return a;
  }

  // Nom de l'artiste : mène à sa page (dans la carte, qui est déjà un lien vers l'album)
  function artistEl(album, cls) {
    const p = el("p", cls);
    const span = el("span", "artist-link", album.artist);
    span.setAttribute("role", "link");
    span.title = "Tous les albums de " + album.artist;
    span.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      location.href = artistUrl(album.artist);
    });
    p.appendChild(span);
    return p;
  }

  function createCard(album) {
    const card = albumLink(album, "album-card");
    card.append(
      coverEl(album, "album-cover"),
      el("p", "album-title", album.title),
      artistEl(album, "album-artist")
    );
    return card;
  }

  function trackCountOf(a) {
    return (a.tracks && a.tracks.length) || a.trackCount || null;
  }

  function createRow(album) {
    const row = albumLink(album, "album-row");
    const text = el("div", "row-text");
    text.append(el("p", "row-title", album.title), artistEl(album, "row-artist"));

    const length = durationOf(album);

    row.append(
      coverEl(album, "row-cover"),
      text,
      el("span", "row-cell row-year", yearOf(album) ? String(yearOf(album)) : ""),
      genreCell(album),
      el("span", "row-cell row-length", length ? formatLength(length) : ""),
      el("span", "row-cell row-num row-aggro", album.aggressivity ? album.aggressivity + "/10" : "")
    );
    extraColumns().forEach(c => row.append(el("span", "row-cell row-num " + c.cls, c.value(album))));
    return row;
  }

  // Écoutes : toujours ; dernière écoute : en plus avec le tri « Écouté récemment »
  const PLAYS_COL = { cls: "row-plays", label: "Écoutes", value: a => { const n = Core.playCount(a); return n ? n + (n > 1 ? " écoutes" : " écoute") : "pas d'écoute"; } };
  const LAST_COL = { cls: "row-last", label: "Dernière écoute", short: "Dern. écoute", value: a => { const l = Core.lastPlay(a); return l ? Core.whenLabel(l) : "jamais"; } };
  function extraColumns() {
    return state.sort === "listened-desc" ? [PLAYS_COL, LAST_COL] : [PLAYS_COL];
  }

  // Genre (vue liste) : recherche dans la collection, filtres remis à zéro
  function genreCell(album) {
    const c = el("span", "row-cell row-genre");
    if (!album.genre) return c;
    const g = el("span", "artist-link", album.genre);
    g.setAttribute("role", "link");
    g.title = "Chercher « " + album.genre + " » dans la collection";
    g.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      searchInput.value = album.genre;
      resetBtn.click();          // filtres à zéro (et nouveau rendu)
      refresh();
      window.scrollTo({ top: 0 });
    });
    c.appendChild(g);
    return c;
  }

  function listHeader() {
    const head = el("div", "album-row list-head");
    head.setAttribute("aria-hidden", "true");
    head.append(
      el("span", "row-cover-space"),
      el("span", "row-text", "Album"),
      el("span", "row-cell row-year", "Année"),
      el("span", "row-cell row-genre", "Genre"),
      el("span", "row-cell row-length", "Durée"),
      el("span", "row-cell row-num row-aggro", "Intensité")
    );
    extraColumns().forEach(c => {
      const h = el("span", "row-cell row-num " + c.cls);
      // Petit écran : « Dern. écoute »
      if (c.short) h.append(el("span", "label-long", c.label), el("span", "label-short", c.short));
      else h.textContent = c.label;
      head.append(h);
    });
    return head;
  }

  // ---------- Pagination ----------

  // Boutons numérotés : la première et la dernière page toujours, celles autour de la page en cours,
  // « … » pour les trous. 1 2 3 4 5 … 12 · 1 … 5 6 7 … 12 · 1 … 8 9 10 11 12 (tout, jusqu'à 7 pages).
  const pager = document.getElementById("pager");
  let pageCount = 1;

  function goToPage(n) {
    n = Math.min(Math.max(1, n), pageCount);
    if (n === state.page) return;
    state.page = n;
    render();
    window.scrollTo({ top: 0 });
  }

  function pageList(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4) return [1, 2, 3, 4, 5, "…", total];
    if (cur >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "…", cur - 1, cur, cur + 1, "…", total];
  }

  function renderPager(cur, total) {
    pageCount = total;
    pager.hidden = total < 2;
    if (total < 2) { pager.replaceChildren(); return; }
    pager.replaceChildren(...pageList(cur, total).map(p => {
      if (p === "…") { const s = el("span", "pager-gap", "…"); s.setAttribute("aria-hidden", "true"); return s; }
      const b = el("button", "pager-num" + (p === cur ? " is-current" : ""), String(p));
      b.type = "button";
      b.setAttribute("aria-label", "Page " + p);
      if (p === cur) b.setAttribute("aria-current", "page");
      b.addEventListener("click", () => goToPage(p));
      return b;
    }));
  }

  // Maj + ← / → (shortcuts.js) : page précédente / suivante
  document.addEventListener("conductor:turn-page", e => {
    if (pager.hidden) return;
    const n = state.page + (e.detail && e.detail.dir < 0 ? -1 : 1);
    if (n >= 1 && n <= pageCount) { goToPage(n); e.detail.done = true; }
  });

  // La page est gardée dans l'adresse (?page=2) : le bouton Retour
  // du navigateur depuis une page album ramène à la bonne page
  function rememberPage() {
    const url = new URL(location.href);
    if (state.page > 1) url.searchParams.set("page", state.page);
    else url.searchParams.delete("page");
    const q = searchInput.value.trim();
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    history.replaceState(null, "", url);
    // Pour la flèche "retour à la collection" des pages album
    try { sessionStorage.setItem("conductor01.home", url.href); } catch (e) {}
  }

  // Tri, filtre ou recherche modifiés → retour à la page 1
  function refresh() {
    state.page = 1;
    render();
  }

  // ---------- Rendu ----------

  // Durée cumulée lisible : "22 h 10 min", "3 j 4 h 12 min", "1 mois 2 j 5 h 3 min"
  // (1 mois = 30 jours ; sous une heure, on garde les secondes)
  function formatTotal(sec) {
    sec = Math.round(sec || 0);
    if (sec < 3600) return formatLength(sec);
    const units = [["mois", 30 * 86400], ["j", 86400], ["h", 3600], ["min", 60]];
    const parts = [];
    let rest = sec;
    units.forEach(([label, size]) => {
      const n = Math.floor(rest / size);
      rest -= n * size;
      if (n) parts.push(n + " " + label);
    });
    return parts.join(" ");
  }

  // Durée cumulée (albums dont la durée est connue)
  function totalLength(list) {
    return list.reduce((s, a) => s + (durationOf(a) || 0), 0);
  }

  function renderStats(all, shownList) {
    const artistCount = new Set(all.map(a => a.artist)).size;
    const total = totalLength(all);
    stats.innerHTML =
      "<strong>" + plural(all.length, "album") + "</strong>, " +
      "<strong>" + plural(artistCount, "artiste") + "</strong>" +
      (total ? ", <strong>" + formatTotal(total) + "</strong>" : "");
    if (shownList.length !== all.length) {
      const sub = totalLength(shownList);
      stats.appendChild(el("span", "stats-shown",
        " · " + shownList.length + " affiché" + (shownList.length > 1 ? "s" : "") + (sub ? ", " + formatTotal(sub) : "")));
    }
  }

  // ---------- Copier la liste ----------
  // Une ligne par album : "Titre (année) - Artiste", dans l'ordre du tri choisi,
  // tous les résultats (pas seulement la page affichée), copiés dans le presse-papiers.

  const exportBtn = document.getElementById("export-btn");
  let lastResults = [];
  let copiedTimer = null;

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => copyFallback(text));
    }
    return Promise.resolve(copyFallback(text));
  }

  // Ancienne méthode, si le presse-papiers moderne est refusé
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

  exportBtn.addEventListener("click", () => {
    const lines = lastResults.map(a => {
      const y = yearOf(a);
      return a.title + (y ? " (" + y + ")" : "") + " - " + a.artist;
    });
    const n = lines.length;
    copyText(lines.join("\n")).then(() => {
      exportBtn.classList.add("is-done");
      exportBtn.title = n + " album" + (n > 1 ? "s" : "") + " copié" + (n > 1 ? "s" : "") + " dans le presse-papiers";
    }).catch(() => {
      exportBtn.title = "Copie impossible : le navigateur l'a refusée";
    }).finally(() => {
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => {
        exportBtn.classList.remove("is-done");
        exportBtn.title = "Copier la liste (album (année) - artiste)";
      }, 1800);
    });
  });

  // ---------- Surprise me ----------
  // Un album au hasard parmi les résultats affichés (recherche + filtres, toutes
  // pages confondues). Évite de reproposer les derniers tirés.

  const surprise = document.getElementById("surprise-dialog");
  const recentPicks = [];

  function pickRandom() {
    const pool = lastResults.length ? lastResults : Store.all();
    if (!pool.length) return null;
    const fresh = pool.filter(a => !recentPicks.includes(a.id));
    const from = fresh.length ? fresh : pool;
    const album = from[Math.floor(Math.random() * from.length)];
    recentPicks.push(album.id);
    if (recentPicks.length > Math.min(10, Math.floor(pool.length / 2))) recentPicks.shift();
    return album;
  }

  function showSurprise() {
    const album = pickRandom();
    if (!album) return;
    const href = "pages/album.html?id=" + encodeURIComponent(album.id);
    document.getElementById("sp-link").href = href;
    document.getElementById("sp-open").href = href;
    document.getElementById("sp-cover").replaceChildren(...coverEl(album, "x").childNodes);
    document.getElementById("sp-title").textContent = album.title;
    document.getElementById("sp-artist").textContent = album.artist;
    const tracks = trackCountOf(album);
    const length = durationOf(album);
    document.getElementById("sp-info").textContent = [
      yearOf(album), tracks ? formatTracks(tracks) : "", length ? formatLength(length) : "", album.genre
    ].filter(Boolean).join(" · ");
    const plays = (album.plays || []).length;
    document.getElementById("sp-extra").textContent = [
      album.aggressivity ? "intensité " + album.aggressivity + "/10" : "",
      plays ? plural(plays, "écoute") : "",
      onPhone(album) ? "sur le téléphone" : ""
    ].filter(Boolean).join(" · ");
    const all = Store.all().length;
    document.getElementById("sp-scope").textContent = lastResults.length && lastResults.length < all
      ? "Tiré parmi les " + lastResults.length + " albums affichés (recherche / filtres)."
      : "Tiré parmi toute la collection (" + all + " albums).";
    if (!surprise.open) surprise.showModal();
    document.getElementById("sp-again").focus();
  }

  document.getElementById("surprise-btn").addEventListener("click", showSurprise);
  document.getElementById("sp-again").addEventListener("click", showSurprise);
  document.getElementById("sp-close").addEventListener("click", () => surprise.close());
  surprise.addEventListener("click", e => { if (e.target === surprise) surprise.close(); });
  window.Surprise = { show: showSurprise };

  function render() {
    const all = Store.all();
    serverIndex = Server.isConfigured() ? Server.cachedIndex() : null;
    const q = normalize(searchInput.value.trim());
    const sort = SORTS.find(s => s.id === state.sort);

    savePrefs();   // vue, tri et filtres mémorisés

    const albums = all
      .filter(a => matchesSearch(a, q) && matchesFilters(a))
      .sort(sort.fn);

    // Pagination : 20 albums par page
    const pages = Math.max(1, Math.ceil(albums.length / PER_PAGE));
    state.page = Math.min(Math.max(1, state.page), pages);
    const shown = albums.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);

    renderStats(all, albums);
    renderFilters(all, q);

    // Export .txt : seulement après une recherche ou un filtre
    lastResults = albums;
    exportBtn.hidden = !(q || state.genres.size || state.decades.size || state.colors.size || state.filesOnly || state.favOnly || state.neverOnly ||
      state.intensities.size || state.letter) || !albums.length;

    viewBtns.forEach(b => {
      b.classList.toggle("is-active", b.dataset.view === state.view);
      b.setAttribute("aria-pressed", String(b.dataset.view === state.view));
    });
    grid.className = state.view === "list" ? "album-list" + (extraColumns().length > 1 ? " has-extra" : "") : "album-grid";
    grid.replaceChildren(...(state.view === "list"
      ? (shown.length ? [listHeader()] : []).concat(shown.map(createRow))
      : shown.map(createCard)));

    renderPager(state.page, pages);
    rememberPage();

    empty.textContent = all.length
      ? "Aucun album ne correspond à cette recherche."
      : "Votre collection est vide. Cliquez sur « Ajouter un album » pour logger votre premier album.";
    empty.hidden = albums.length > 0;
  }

  searchInput.addEventListener("input", refresh);
  document.addEventListener("albums:changed", render);

  // index.html?q=punk : recherche venue d'une page album (mot-clé, artiste…)
  const params = new URLSearchParams(location.search);
  if (params.get("q")) searchInput.value = params.get("q");
  if (params.get("page")) state.page = Number(params.get("page")) || 1;
  // Filtres mémorisés : on oublie les genres qui n'existent plus (genre renommé…)
  {
    const existing = new Set(Store.all().map(genreKey).filter(Boolean));
    [...state.genres].forEach(k => { if (!existing.has(k)) state.genres.delete(k); });
  }

  // Liens venus d'une page album ou d'insights : ce filtre seul, à la place
  // des filtres mémorisés.
  //   ?famille=Rock   ?genre=Post-punk   ?decennie=1970   ?intensite=6
  //   ?q=…&reset=1   (recherche, filtres remis à zéro)
  const fam = params.get("famille");
  const genre = params.get("genre");
  const decade = params.get("decennie");
  const intensity = Number(params.get("intensite")) || 0;
  // ?accueil=1 (touche H depuis une autre page) : tout à zéro, tri compris
  if (params.get("accueil")) state.sort = "added-desc";
  if (fam || genre || decade || intensity || params.get("reset") || params.get("accueil")) {
    state.genres.clear();
    state.decades.clear();
    state.colors.clear();
    state.filesOnly = false;
    state.favOnly = false;
    state.neverOnly = false;
    state.intensities.clear();
    state.tiers.clear();
    state.letter = "";
    state.openFamilies.clear();   // familles de genres repliées
    if (fam || genre) {
      Store.all().forEach(a => {
        if (!a.genre) return;
        if (fam ? familyOf(a) === fam : a.genre === genre) {
          state.genres.add(genreKey(a));
          state.openFamilies.add(familyOf(a));
        }
      });
    }
    if (decade) state.decades.add(decade);
    if (intensity >= 1 && intensity <= 10) state.intensities.add(intensity);
    const url = new URL(location.href);
    ["famille", "genre", "decennie", "intensite", "reset", "accueil"].forEach(k => url.searchParams.delete(k));
    history.replaceState(null, "", url);
  }

  render();

  // Z (js/shortcuts.js) : filtres seulement (recherche et tri gardés)
  document.addEventListener("conductor:filters-reset", () => resetBtn.click());

  // F (js/shortcuts.js) : « Albums favoris » coché / décoché
  document.addEventListener("conductor:toggle-fav", () => {
    state.favOnly = !state.favOnly;
    refresh();
  });

  // H (js/shortcuts.js) : accueil remis à zéro (recherche, filtres, tri, page)
  document.addEventListener("conductor:reset", () => {
    searchInput.value = "";
    state.sort = "added-desc";   // tri par défaut : ajouts récents
    state.genres.clear();
    state.decades.clear();
    state.colors.clear();
    state.filesOnly = false;
    state.favOnly = false;
    state.neverOnly = false;
    state.intensities.clear();
    state.tiers.clear();
    state.letter = "";
    state.openFamilies.clear();   // familles de genres repliées
    refresh();
  });

  // index.html#ajouter : ouvre directement la fenêtre d'ajout
  if (location.hash === "#ajouter") {
    history.replaceState(null, "", location.pathname + location.search);
    document.getElementById("add-album-btn").click();
  }
})();
