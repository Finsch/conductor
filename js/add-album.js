// conductor01. — fenêtre "Ajouter un album"
// Étape 1 : on tape → recherche dans le catalogue → on choisit un album.
// Étape 2 : on logge l'écoute (date, note, commentaire) → enregistré dans la collection.

(function () {
  const dialog = document.getElementById("add-dialog");
  const openBtn = document.getElementById("add-album-btn");
  const closeBtn = document.getElementById("add-close");

  const stepSearch = document.getElementById("step-search");
  const input = document.getElementById("catalog-input");
  const status = document.getElementById("catalog-status");
  const results = document.getElementById("catalog-results");

  const stepLog = document.getElementById("step-log");
  const selCover = document.getElementById("sel-cover");
  const selTitle = document.getElementById("sel-title");
  const selArtist = document.getElementById("sel-artist");
  const selInfo = document.getElementById("sel-info");
  const dateInput = document.getElementById("log-date");
  const starsBox = document.getElementById("log-rating");
  const reviewInput = document.getElementById("log-review");
  const errorBox = document.getElementById("log-error");
  const backBtn = document.getElementById("log-back");

  let found = [];        // résultats de la dernière recherche
  let active = -1;       // résultat surligné au clavier
  let selected = null;   // album choisi
  let rating = 0;        // 0 = pas de note
  let debounce = null;
  let requestId = 0;     // pour ignorer les réponses arrivées en retard

  // Page Next up : la fenêtre ajoute à Next up (pas de date d'écoute ni de note)
  const NEXTUP_MODE = dialog.dataset.mode === "nextup";
  const nextUpBtn = document.getElementById("log-nextup");
  if (NEXTUP_MODE) {
    stepLog.querySelectorAll(".form-row").forEach(r => { r.hidden = true; });
    dateInput.required = false;
  }

  // ---------- Ouverture / fermeture ----------

  function open() {
    showSearch();
    input.value = "";
    results.replaceChildren();
    found = [];
    setStatus("Commencez à taper le nom d'un album.");
    dialog.showModal();
    input.focus();
  }

  function close() {
    dialog.close();
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  // Clic en dehors de la fenêtre → fermeture
  dialog.addEventListener("click", e => { if (e.target === dialog) close(); });

  // ---------- Étape 1 : recherche ----------

  function setStatus(text) {
    status.textContent = text;
    status.hidden = !text;
  }

  input.addEventListener("input", () => {
    clearTimeout(debounce);
    const term = input.value.trim();
    if (term.length < 2) {
      requestId++;
      results.replaceChildren();
      found = [];
      setStatus("Commencez à taper le nom d'un album.");
      return;
    }
    setStatus("Recherche…");
    debounce = setTimeout(() => search(term), 300);
  });

  function search(term) {
    const id = ++requestId;
    Catalog.searchAlbums(term)
      .then(albums => {
        if (id !== requestId) return;
        found = albums;
        renderResults();
        setStatus(albums.length ? "" : "Aucun album trouvé.");
      })
      .catch(() => {
        if (id !== requestId) return;
        found = [];
        renderResults();
        setStatus("Impossible de joindre le catalogue. Vérifiez votre connexion internet.");
      });
  }

  function renderResults() {
    active = -1;
    results.replaceChildren(...found.map((album, i) => {
      const li = document.createElement("li");
      li.className = "result";
      li.setAttribute("role", "option");

      const thumb = document.createElement("div");
      thumb.className = "result-thumb";
      if (album.thumb) {
        const img = document.createElement("img");
        img.src = album.thumb;
        img.alt = "";
        img.onerror = () => img.remove();
        thumb.appendChild(img);
      }

      const text = document.createElement("div");
      text.className = "result-text";
      const t = document.createElement("p");
      t.className = "result-title";
      t.textContent = album.title;
      const m = document.createElement("p");
      m.className = "result-meta";
      m.textContent = [
        album.artist,
        album.year,
        album.type !== "Album" ? album.type : "",
        album.source === "Discogs" ? "Discogs" : ""
      ].filter(Boolean).join(" · ");
      text.append(t, m);

      li.append(thumb, text);

      const status = Store.statusOf(album);
      if (status) {
        const tag = document.createElement("span");
        tag.className = "result-tag";
        tag.textContent = status === "nextup" ? "Dans next up" : "Dans la collection";
        li.appendChild(tag);
      }

      li.addEventListener("click", () => select(i));
      li.addEventListener("mousemove", () => highlight(i));
      return li;
    }));
  }

  function highlight(i) {
    active = i;
    [...results.children].forEach((li, j) => li.classList.toggle("is-active", j === i));
    const li = results.children[i];
    if (li) li.scrollIntoView({ block: "nearest" });
  }

  // Flèches haut/bas + Entrée pour choisir au clavier
  input.addEventListener("keydown", e => {
    if (!found.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); highlight(Math.min(active + 1, found.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); highlight(Math.max(active - 1, 0)); }
    if (e.key === "Enter")     { e.preventDefault(); select(active >= 0 ? active : 0); }
  });

  // ---------- Étape 2 : log ----------

  function showSearch() {
    stepLog.hidden = true;
    stepSearch.hidden = false;
  }

  function select(i) {
    selected = found[i];
    if (!selected) return;

    selCover.replaceChildren();
    if (selected.cover) {
      const img = document.createElement("img");
      img.src = selected.cover;
      img.alt = "";
      img.onerror = () => img.remove();
      selCover.appendChild(img);
    }
    selTitle.textContent = selected.title;
    selArtist.textContent = selected.artist;
    renderInfo();

    // Année, genre… complétés en arrière-plan
    const pending = selected;
    Catalog.details(selected).then(full => {
      if (selected !== pending) return;
      selected = full;
      renderInfo();
      applyStatus();
    });

    dateInput.value = new Date().toLocaleDateString("sv-SE"); // aujourd'hui, au format AAAA-MM-JJ
    dateInput.max = dateInput.value;
    reviewInput.value = "";
    setRating(0);
    errorBox.hidden = true;

    stepSearch.hidden = true;
    stepLog.hidden = false;
    applyStatus();
    (NEXTUP_MODE || existing ? submitBtn : dateInput).focus();
  }

  // ---------- Album déjà enregistré : pas de doublon ----------

  const submitBtn = stepLog.querySelector("button[type=submit]");
  const submitLabel = submitBtn.textContent;
  const notice = document.createElement("p");
  notice.className = "dup-notice";
  notice.hidden = true;
  stepLog.querySelector(".selected").after(notice);
  let existing = null;   // album déjà dans la collection (ou next up) : on l'ouvre au lieu de l'ajouter

  function applyStatus() {
    const same = selected && Store.same(selected);
    // Bloquant : déjà dans la collection, ou déjà dans next up depuis la page next up
    existing = same && (!same.nextUp || NEXTUP_MODE) ? same : null;
    const inNextUp = same && same.nextUp && !NEXTUP_MODE;   // il passera dans la collection

    stepLog.querySelectorAll(".form-row").forEach(r => { r.hidden = NEXTUP_MODE || !!existing; });
    dateInput.required = !NEXTUP_MODE && !existing;
    if (nextUpBtn) nextUpBtn.hidden = !!existing || !!inNextUp;

    notice.hidden = !existing && !inNextUp;
    notice.replaceChildren();
    if (existing) {
      const where = existing.nextUp ? "dans next up" : "dans votre collection";
      const named = existing.title !== selected.title || existing.artist !== selected.artist
        ? " sous le nom « " + existing.title + " » de " + existing.artist : "";
      const added = !existing.nextUp && (existing.addedAt || (existing.logs && existing.logs[0] && (existing.logs[0].date || existing.logs[0].loggedAt)) || "");
      notice.textContent = "Déjà " + where + named +
        (added ? " (ajouté le " + new Date(added.slice(0, 10) + "T12:00").toLocaleDateString("fr-FR") + ")" : "") +
        " : il ne sera pas ajouté une deuxième fois.";
      submitBtn.textContent = existing.nextUp ? "Voir dans next up" : "Ouvrir la fiche";
    } else {
      if (inNextUp) notice.textContent = "Cet album est dans next up : l'enregistrer le fait passer dans la collection.";
      submitBtn.textContent = submitLabel;
    }
  }

  function openExisting() {
    const a = existing;
    close();
    location.href = APP_ROOT + (a.nextUp
      ? "pages/nextup.html?album=" + encodeURIComponent(a.id)
      : "pages/album.html?id=" + encodeURIComponent(a.id));
  }

  function renderInfo() {
    selInfo.textContent = [
      selected.year,
      selected.genre,
      selected.trackCount ? selected.trackCount + " titres" : ""
    ].filter(Boolean).join(" · ");
  }

  backBtn.addEventListener("click", () => {
    showSearch();
    input.focus();
  });

  // Étoiles : cliquer sur l'étoile déjà choisie retire la note
  for (let n = 1; n <= 5; n++) {
    const star = document.createElement("button");
    star.type = "button";
    star.className = "star";
    star.textContent = "★";
    star.setAttribute("role", "radio");
    star.setAttribute("aria-label", n + " sur 5");
    star.addEventListener("click", () => setRating(rating === n ? 0 : n));
    starsBox.appendChild(star);
  }

  function setRating(n) {
    rating = n;
    [...starsBox.children].forEach((star, i) => {
      star.classList.toggle("is-on", i < n);
      star.setAttribute("aria-checked", String(i + 1 === n));
    });
  }

  // Enregistrer : ajout (collection) ; page Next up ou bouton « Next up » : à écouter
  function save(toNextUp) {
    if (!selected) return;
    if (existing) { openExisting(); return; }
    const album = Object.assign({}, selected);
    delete album.thumb;
    try {
      const entry = toNextUp
        ? Store.addNextUp(album)
        : Store.logAlbum(album, {
            date: dateInput.value,
            rating: rating || null,
            review: reviewInput.value.trim()
          });
      close();
      // Page next up : la liste se met à jour toute seule
      if (toNextUp && NEXTUP_MODE) return;
      // Ouvre la page de l'album (ou next up), après l'écriture dans datastorage (3 s max)
      const go = () => {
        location.href = APP_ROOT + (toNextUp && entry.nextUp
          ? "pages/nextup.html?album=" + encodeURIComponent(entry.id)
          : "pages/album.html?id=" + encodeURIComponent(entry.id));
      };
      const write = typeof Disk !== "undefined" ? Promise.resolve(Disk.writeNow()) : Promise.resolve();
      Promise.race([write.catch(() => {}), new Promise(r => setTimeout(r, 3000))]).then(go);
    } catch (err) {
      errorBox.textContent = "L'enregistrement a échoué : le navigateur bloque peut-être le stockage local.";
      errorBox.hidden = false;
    }
  }

  stepLog.addEventListener("submit", e => {
    e.preventDefault();
    save(NEXTUP_MODE);
  });
  if (nextUpBtn) nextUpBtn.addEventListener("click", () => save(true));
})();
