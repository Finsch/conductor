// conductor01. — page album

(function () {
  const id = new URLSearchParams(location.search).get("id");
  let album = id ? Store.get(id) : null;
  let tracks = [];          // titres affichés (avec extraits si disponibles)

  const $ = sel => document.getElementById(sel);

  // Flèche retour : ramène à la collection telle qu'on l'a laissée
  // (même page, mêmes filtres, même recherche)
  try {
    const home = sessionStorage.getItem("conductor01.home");
    if (home && home.startsWith(new URL(APP_ROOT || "./", location.href).href)) $("back-link").href = home;
  } catch (e) {}

  if (!album) {
    $("not-found").hidden = false;
    return;
  }
  $("album-page").hidden = false;

  // ---------- Formats ----------

  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
                  "août", "septembre", "octobre", "novembre", "décembre"];

  // "1967-05-26" → "26 mai 1967" ; "1967" → "1967"
  function formatDate(str) {
    if (!str) return "";
    const [y, m, d] = str.split("-");
    if (d) return Number(d) + (d === "01" ? "er" : "") + " " + MONTHS[Number(m) - 1] + " " + y;
    if (m) return MONTHS[Number(m) - 1] + " " + y;
    return y;
  }

  // 224 → "03:44"
  function mmss(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0");
  }

  // 2732 → "45 min 32 s" ; 3900 → "1 h 05 min"
  const longDuration = formatLength;

  function searchLink(q) {
    return "../index.html?q=" + encodeURIComponent(q);
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- Infos ----------

  function renderInfo() {
    document.title = album.title + " — " + album.artist + " · conductor.";
    $("a-title").textContent = album.title;
    $("a-artist").textContent = album.artist;
    $("a-artist").href = searchLink(album.artist);

    const facts = [];
    const date = album.releaseDate || (album.year ? String(album.year) : "");
    if (date) facts.push((date.length === 10 ? "sorti le " : "sorti en ") + formatDate(date));
    const list = tracks.length ? tracks : (album.tracks || []);
    if (list.length) {
      const total = list.reduce((sum, t) => sum + (t.duration || 0), 0);
      facts.push(formatTracks(list.length) + (total ? ", " + longDuration(total) : ""));
    } else if (album.trackCount) {
      facts.push(album.trackCount + " titres");
    }
    $("a-facts").replaceChildren(...facts.map(f => el("span", null, f)));

    // Pochette
    const cover = $("a-cover");
    cover.replaceChildren();
    const coverSrc = album.cover || (album.serverCover ? Server.coverUrl(album.serverCover, 600) : "");
    if (coverSrc) {
      const img = el("img");
      img.src = localUrl(coverSrc);
      img.alt = album.title + " — " + album.artist;
      img.onerror = () => img.remove();
      cover.appendChild(img);
    }

    // Fiche : genre et styles cliquables (= chercher dans la collection)
    const links = list => {
      const dd = el("dd");
      list.forEach((v, i) => {
        if (i) dd.appendChild(document.createTextNode(", "));
        const a = el("a", "sheet-link", v);
        a.href = searchLink(v);
        dd.appendChild(a);
      });
      return dd;
    };
    const rows = [];
    const family = familyOf(album);
    if (family) {
      const dd = el("dd");
      const a = el("a", "sheet-link", family);
      a.href = "../index.html?famille=" + encodeURIComponent(family);
      a.title = "Voir la famille " + family + " dans la collection";
      dd.appendChild(a);
      rows.push(el("dt", null, "famille"), dd);
    }
    if (album.genre) {
      // Genre → filtre « Genres » de la collection (et non la recherche)
      const dd = el("dd");
      const a = el("a", "sheet-link", album.genre);
      a.href = "../index.html?genre=" + encodeURIComponent(album.genre);
      a.title = "Filtrer la collection sur " + album.genre;
      dd.appendChild(a);
      rows.push(el("dt", null, "genre"), dd);
    }
    if ((album.styles || []).length) rows.push(el("dt", null, "styles"), links(album.styles));
    if (album.label) rows.push(el("dt", null, "label"), el("dd", null, album.label));
    $("a-sheet").replaceChildren(...rows);

    // Ressenti : étiquettes sous la liste des titres (cliquer = chercher dans la collection)
    const moods = album.moods || [];
    $("moods-block").hidden = !moods.length;
    $("a-moods").replaceChildren(...moods.map(m => {
      const a = el("a", "tag", m);
      a.href = searchLink(m);
      return a;
    }));

    // Tags personnalisés : les vôtres, juste en dessous
    const tags = album.tags || [];
    $("tags-block").hidden = !tags.length;
    $("a-tags").replaceChildren(...tags.map(t => {
      const a = el("a", "tag", t);
      a.href = searchLink(t);
      return a;
    }));

    // Liens externes (nouvel onglet)
    const q = encodeURIComponent(album.artist + " " + album.title);
    $("a-genius").href = "https://genius.com/search?q=" + q;
    $("a-wiki").href = "https://fr.wikipedia.org/w/index.php?search=" +
      encodeURIComponent(album.title + " " + album.artist + " album");

  }

  // ---------- Titres ----------

  // Numéro d'après vos métadonnées ; "2-01" pour un album en plusieurs disques
  function trackNumber(t, i, list) {
    if (!t.track) return String(i + 1);
    const multiDisc = list.some(x => (x.disc || 1) > 1);
    return multiDisc ? t.disc + "-" + String(t.track).padStart(2, "0") : String(t.track);
  }

  // ---------- Paroles ----------

  let lyricsData = {};                  // titre (simplifié) → { text, source, edited }
  const lyricsOpen = new Set();         // paroles dépliées
  const lyricsLoading = new Set();
  const lyricsEditing = new Set();
  const lyricsMissing = new Map();      // titre → message (introuvables, hors ligne…)

  // Paroles déjà enregistrées dans datastorage/lyrics/<album>.js
  (function loadLyricsFile() {
    const done = () => {
      const saved = (window.CONDUCTOR_LYRICS && window.CONDUCTOR_LYRICS[album.id]) || {};
      lyricsData = Object.assign({}, saved, Disk.pendingLyricsFor(album.id) || {});
      renderTracks();
    };
    const s = document.createElement("script");
    s.src = Disk.lyricsPath(album.id);
    s.onload = done;
    s.onerror = done;
    document.head.appendChild(s);
  })();

  function saveLyrics() {
    Disk.writeLyrics(album.id, lyricsData);
  }

  function toggleLyrics(t) {
    const k = Lyrics.key(t.title);
    if (lyricsOpen.has(k)) {
      lyricsOpen.delete(k);
      lyricsEditing.delete(k);
    } else {
      lyricsOpen.add(k);
      if (!lyricsData[k] && !lyricsMissing.has(k)) fetchLyrics(t, k);
    }
    renderTracks();
  }

  function fetchLyrics(t, k) {
    lyricsLoading.add(k);
    Lyrics.find(album, t)
      .then(res => {
        if (res) {
          lyricsData[k] = res;
          saveLyrics();          // gardées pour la prochaine fois, même sans internet
        } else {
          lyricsMissing.set(k, "Paroles introuvables.");
        }
      })
      .catch(() => lyricsMissing.set(k, "Paroles indisponibles : pas de connexion internet."))
      .finally(() => { lyricsLoading.delete(k); renderTracks(); });
  }

  function lyricsRow(t) {
    const k = Lyrics.key(t.title);
    const tr = el("tr", "lyrics-row");
    const td = el("td", "lyrics-cell");
    td.colSpan = 2;
    const box = el("div", "lyrics");

    const link = (text, fn) => {
      const b = el("button", "text-btn inline", text);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    };

    if (lyricsEditing.has(k)) {
      const area = el("textarea", "field lyrics-edit");
      area.rows = 14;
      area.value = lyricsData[k] ? lyricsData[k].text : "";
      area.placeholder = "Collez les paroles ici. Les lignes entre crochets, comme [Chorus] ou [Verse 1: David Gilmour], deviennent des intertitres.";
      const actions = el("div", "lyrics-actions");
      const save = el("button", "btn btn-small", "Enregistrer");
      save.type = "button";
      save.addEventListener("click", () => {
        const text = area.value.trim();
        if (text) {
          lyricsData[k] = { text, source: "vous", edited: true };
          lyricsMissing.delete(k);
        } else {
          delete lyricsData[k];
          lyricsMissing.set(k, "Pas de paroles.");
        }
        saveLyrics();
        lyricsEditing.delete(k);
        renderTracks();
      });
      const cancel = el("button", "btn btn-ghost btn-small", "Annuler");
      cancel.type = "button";
      cancel.addEventListener("click", () => { lyricsEditing.delete(k); renderTracks(); });
      actions.append(save, cancel);
      box.append(area, actions);
      setTimeout(() => area.focus(), 0);
    } else if (lyricsLoading.has(k)) {
      box.append(el("p", "hint", "Recherche des paroles…"));
    } else if (lyricsData[k]) {
      const meta = el("p", "lyrics-meta");
      meta.append(el("span", null, "source : " + lyricsData[k].source),
        link("modifier", () => { lyricsEditing.add(k); renderTracks(); }));
      box.append(Lyrics.render(lyricsData[k].text), meta);
    } else {
      const meta = el("p", "lyrics-meta");
      meta.append(el("span", null, lyricsMissing.get(k) || ""),
        link("ajouter", () => { lyricsEditing.add(k); renderTracks(); }),
        link("chercher à nouveau", () => { lyricsMissing.delete(k); fetchLyrics(t, k); renderTracks(); }));
      box.append(meta);
    }

    td.appendChild(box);
    tr.append(el("td"), td);
    return tr;
  }

  function renderTracks() {
    const list = tracks.length ? tracks : (album.tracks || []);
    const table = $("tracklist");
    table.replaceChildren(...list.flatMap((t, i) => {
      const tr = el("tr", "track");
      tr.dataset.index = i;

      const tdPlay = el("td", "track-play");
      const btn = el("button", "track-btn");
      btn.type = "button";
      btn.setAttribute("aria-label", "Écouter " + t.title);
      btn.innerHTML =
        '<svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>' +
        '<svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
      btn.disabled = !t.preview;
      btn.addEventListener("click", () => (current === i ? toggle() : playTrack(i)));
      tdPlay.appendChild(btn);

      const tdTitle = el("td", "track-title");
      tdTitle.append(el("span", "track-num", trackNumber(t, i, list) + "."), el("span", "track-name", t.title));
      // Paroles : lien visible au survol (ou quand elles sont dépliées), comme sur Bandcamp
      const open = lyricsOpen.has(Lyrics.key(t.title));
      const lyrics = el("a", "track-lyrics" + (open ? " is-open" : ""), "paroles");
      lyrics.href = "#";
      lyrics.setAttribute("aria-expanded", String(open));
      lyrics.addEventListener("click", e => { e.preventDefault(); toggleLyrics(t); });
      tdTitle.appendChild(lyrics);

      const tdTime = el("td", "track-time", t.duration ? mmss(t.duration) : "");

      tr.append(tdPlay, tdTitle, tdTime);
      return open ? [tr, lyricsRow(t)] : [tr];
    }));
    updatePlayerUI();
  }

  // ---------- Lecteur ----------

  const audio = new Audio();
  audio.preload = "none";
  if (window.Volume) Volume.attach(audio);   // volume global du lecteur (js/volume.js)
  let current = -1;

  function playable(i) {
    return tracks[i] && tracks[i].preview;
  }

  function firstPlayable(from, step) {
    for (let i = from; i >= 0 && i < tracks.length; i += step) if (playable(i)) return i;
    return -1;
  }

  function playTrack(i) {
    if (!playable(i)) return;
    current = i;
    audio.src = tracks[i].preview;
    audio.play().catch(() => {});
    updatePlayerUI();
  }

  function toggle() {
    if (current < 0) {
      const i = firstPlayable(0, 1);
      if (i > -1) playTrack(i);
      return;
    }
    audio.paused ? audio.play().catch(() => {}) : audio.pause();
  }

  function next() {
    const i = firstPlayable(current + 1, 1);
    if (i > -1) playTrack(i);
  }

  function prev() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    const i = firstPlayable(current - 1, -1);
    if (i > -1) playTrack(i);
  }

  function updatePlayerUI() {
    const list = tracks.length ? tracks : (album.tracks || []);
    const shown = current > -1 ? current : 0;
    const playing = current > -1 && !audio.paused;

    $("p-track").textContent = list[shown] ? list[shown].title : "";
    $("player").classList.toggle("is-playing", playing);
    $("p-play").setAttribute("aria-label", playing ? "Pause" : "Lecture");

    const hasAudio = tracks.some(t => t.preview);
    $("p-play").disabled = !hasAudio;
    $("p-prev").disabled = !hasAudio;
    $("p-next").disabled = !hasAudio;

    $("tracklist").querySelectorAll("tr.track").forEach(tr => {
      const i = Number(tr.dataset.index);
      tr.classList.toggle("is-current", i === current);
      tr.classList.toggle("is-playing", i === current && playing);
    });
    updateTime();
  }

  // Durée du morceau : celle du fichier audio, sinon celle des métadonnées
  function currentDuration() {
    if (isFinite(audio.duration) && audio.duration > 0) return audio.duration;
    return (tracks[current] && tracks[current].duration) || 0;
  }

  function updateTime() {
    const dur = currentDuration();
    $("p-time").textContent = mmss(current > -1 ? audio.currentTime : 0) + " / " + mmss(current > -1 ? dur : 0);
    $("p-fill").style.width = (dur && current > -1 ? (audio.currentTime / dur) * 100 : 0) + "%";
  }

  $("p-play").addEventListener("click", toggle);
  $("p-next").addEventListener("click", next);
  $("p-prev").addEventListener("click", prev);

  // Pour les raccourcis clavier (js/shortcuts.js) : Espace, ← →
  window.Player = {
    toggle,
    next,
    prev,
    active: () => current > -1,
    hasAudio: () => tracks.some(t => t.preview)
  };
  audio.addEventListener("timeupdate", updateTime);
  audio.addEventListener("loadedmetadata", updateTime);
  audio.addEventListener("play", updatePlayerUI);
  audio.addEventListener("pause", updatePlayerUI);
  audio.addEventListener("ended", () => {
    const i = firstPlayable(current + 1, 1);
    i > -1 ? playTrack(i) : updatePlayerUI();
  });

  // Cliquer sur la barre pour avancer / reculer
  $("p-bar").addEventListener("click", e => {
    if (current < 0 || !currentDuration()) return;
    const r = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * currentDuration();
  });
  $("p-bar").addEventListener("keydown", e => {
    if (current < 0) return;
    if (e.key === "ArrowRight") audio.currentTime = Math.min(currentDuration(), audio.currentTime + 5);
    if (e.key === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 5);
  });

  // ---------- Votre écoute ----------

  const AGGRO_WORDS = ["", "très calme", "calme", "calme", "posé", "modéré",
                       "modéré", "énergique", "énergique", "agressif", "très agressif"];

  function renderAggro() {
    const value = album.aggressivity || 0;
    $("aggro-value").textContent = value ? value + "/10 · " + AGGRO_WORDS[value] : "non noté";
    [...$("aggro-scale").children].forEach((b, i) => {
      b.classList.toggle("is-on", i + 1 <= value);
      b.classList.toggle("is-value", i + 1 === value);
      b.setAttribute("aria-checked", String(i + 1 === value));
    });
  }

  for (let n = 1; n <= 10; n++) {
    const b = el("button", "aggro-step", String(n));
    b.type = "button";
    b.setAttribute("role", "radio");
    b.addEventListener("click", () => {
      // Recliquer sur la valeur choisie la retire
      album = Store.update(album.id, { aggressivity: album.aggressivity === n ? null : n });
      renderAggro();
    });
    $("aggro-scale").appendChild(b);
  }

  function renderLogs() {
    const logs = (album.logs || []).slice().reverse();
    $("a-logs").replaceChildren(...logs.map(log => {
      const li = el("li", "log");
      const head = el("p", "log-head");
      head.appendChild(el("span", null, log.date ? "Écouté le " + formatDate(log.date) : "Écouté"));
      if (log.rating) head.appendChild(el("span", "log-stars", "★".repeat(log.rating) + "☆".repeat(5 - log.rating)));
      li.appendChild(head);
      if (log.review) li.appendChild(el("p", "log-review", log.review));
      return li;
    }));
  }

  // ---------- Modifier / supprimer ----------

  const dialog = $("edit-dialog");
  let editCover = "";

  function setCoverPreview(src) {
    editCover = src;
    const box = $("e-cover-preview");
    box.replaceChildren();
    if (src) {
      const img = el("img");
      img.src = localUrl(src);
      img.alt = "";
      img.onerror = () => img.remove();
      box.appendChild(img);
    }
  }

  $("edit-btn").addEventListener("click", () => {
    $("e-title").value = album.title || "";
    $("e-artist").value = album.artist || "";
    $("e-date").value = album.releaseDate || (album.year ? String(album.year) : "");
    $("e-cover").value = album.cover && !album.cover.startsWith("data:") ? album.cover : "";
    setCoverPreview(album.cover || "");
    $("e-genre").value = album.genre || "";
    fillFamilySelect();
    $("e-family").value = GENRE_FAMILIES.includes(album.family) ? album.family : "";
    $("e-styles").value = (album.styles || []).join(", ");
    $("e-label").value = album.label || "";
    $("e-moods").value = (album.moods || []).join(", ");
    $("e-tags").value = (album.tags || []).join(", ");
    $("e-cover-server").hidden = !serverCoverId();
    $("e-cover-status").hidden = true;
    dialog.showModal();
  });

  $("e-cover").addEventListener("input", e => setCoverPreview(e.target.value.trim()));

  // Image (fichier ou blob) recadrée en carré, réduite à 600 px, enregistrée avec l'album
  function useImage(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(600, img.width, img.height);
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        canvas.getContext("2d").drawImage(img,
          (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        setCoverPreview(canvas.toDataURL("image/jpeg", 0.85));
        $("e-cover").value = "";
        URL.revokeObjectURL(img.src);
        resolve();
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }

  $("e-cover-file").addEventListener("change", e => {
    if (e.target.files[0]) useImage(e.target.files[0]);
  });

  // Pochette intégrée à vos fichiers (servie par Navidrome) : copiée dans la fiche,
  // pour qu'elle reste affichée même téléphone éteint
  function serverCoverId() {
    if (!Server.isConfigured()) return null;
    if (album.serverCover) return album.serverCover;
    const m = Server.matchFor(album);
    return m ? (m.coverArt || m.id) : null;
  }

  $("e-cover-server").addEventListener("click", () => {
    const status = $("e-cover-status");
    status.hidden = false;
    status.textContent = "Récupération de la pochette…";
    fetch(Server.coverUrl(serverCoverId(), 600))
      .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(useImage)
      .then(() => { status.hidden = true; })
      .catch(() => { status.textContent = "Impossible de récupérer la pochette : le serveur est-il allumé ?"; });
  });

  const closeEdit = () => dialog.close();
  $("edit-close").addEventListener("click", closeEdit);
  $("edit-cancel").addEventListener("click", closeEdit);
  dialog.addEventListener("click", e => { if (e.target === dialog) closeEdit(); });

  // Famille : « Automatique » (déduite du genre tapé) ou choix manuel
  function fillFamilySelect() {
    const sel = $("e-family");
    const auto = autoFamily($("e-genre").value);
    const keep = sel.value;
    sel.replaceChildren(new Option("Automatique" + (auto ? " (" + auto + ")" : ""), ""),
      ...GENRE_FAMILIES.map(f => new Option(f, f)));
    sel.value = keep;
  }
  $("e-genre").addEventListener("input", fillFamilySelect);

  const splitList = s => s.split(",").map(x => x.trim()).filter(Boolean);

  $("edit-form").addEventListener("submit", e => {
    e.preventDefault();
    const date = $("e-date").value.trim();
    try {
      album = Store.update(album.id, {
        title: $("e-title").value.trim(),
        artist: $("e-artist").value.trim(),
        releaseDate: date,
        year: date ? Number(date.slice(0, 4)) : null,
        cover: editCover,
        genre: $("e-genre").value.trim(),
        family: $("e-family").value,
        styles: splitList($("e-styles").value),
        label: $("e-label").value.trim(),
        keywords: [],
        moods: splitList($("e-moods").value).map(k => k.toLowerCase()),
        tags: [...new Set(splitList($("e-tags").value))]
      });
    } catch (err) {
      alert("Enregistrement impossible : l'image est peut-être trop lourde pour le stockage du navigateur.");
      return;
    }
    closeEdit();
    renderInfo();
    renderTracks();
  });

  $("delete-btn").addEventListener("click", () => {
    $("entry-actions").hidden = true;
    $("delete-confirm").hidden = false;
  });
  $("delete-no").addEventListener("click", () => {
    $("entry-actions").hidden = false;
    $("delete-confirm").hidden = true;
  });
  $("delete-yes").addEventListener("click", () => {
    Store.remove(album.id);
    location.href = "../index.html";
  });

  // ---------- Vos fichiers (Navidrome) ----------

  const local = { active: false, offline: false, error: "", formats: "" };

  async function loadLocal() {
    if (!Server.isConfigured()) return;
    try {
      // Index vide (première visite) : on le récupère une fois
      if (!album.serverId && !Server.cachedIndex().albums.length) await Server.refreshIndex();
      let match = Server.matchFor(album);
      if (!match) return;

      let full;
      try {
        full = await Server.getAlbum(match);
      } catch (e) {
        // Album introuvable (code 70) : l'index est périmé, Navidrome a renuméroté
        // ses albums après une nouvelle analyse. On actualise et on recherche.
        if (e.code !== 70) throw e;
        await Server.refreshIndex();
        if (album.serverLinked !== "manual") album = Store.update(album.id, { serverId: null });
        match = Server.matchFor(album);
        if (!match) return;
        full = await Server.getAlbum(match);
      }
      if (!full.tracks.length) return;

      tracks = full.tracks.map(t => ({
        title: t.title, duration: t.duration, preview: t.src, track: t.track, disc: t.disc, songId: t.songId
      }));
      local.active = true;
      local.formats = [...new Set(full.tracks.map(t => t.format).filter(Boolean))].join(", ");

      // Vos fichiers font foi : liste des titres, nombre de pistes, durée
      album = Store.update(album.id, {
        serverId: match.id,
        serverLinked: album.serverLinked || "auto",
        serverCover: full.coverArt,
        tracks: tracks.map(t => ({ title: t.title, duration: t.duration, track: t.track, disc: t.disc })),
        trackCount: tracks.length,
        duration: tracks.reduce((s, t) => s + (t.duration || 0), 0)
      });
    } catch (e) {
      console.warn("Navidrome :", e);
      // Réseau coupé / délai dépassé → injoignable ; sinon, erreur renvoyée par le serveur
      if (e.name === "TypeError" || e.name === "AbortError") local.offline = true;
      else local.error = e.message || "erreur inconnue";
    } finally {
      renderFiles();
      renderNote();
      renderInfo();
      renderTracks();
    }
  }

  function renderNote() {
    $("p-note").textContent = local.active
      ? "Lecture intégrale depuis vos fichiers" + (local.formats ? " (" + local.formats + ")" : "") + "."
      : tracks.some(t => t.preview)
        ? "Extraits de 30 secondes, fournis par Deezer" + (local.offline ? " (serveur de fichiers injoignable)" : "") + "."
        : "";
  }

  function action(text, fn) {
    const b = el("button", "text-btn inline", text);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  function renderFiles() {
    const box = $("a-files");
    box.replaceChildren(el("span", "files-label", "fichiers"));
    if (!Server.isConfigured()) {
      const a = el("a", "text-link", "connecter votre bibliothèque");
      a.href = "library.html";
      box.append(a);
    } else if (local.active) {
      box.append(el("span", null, "reliés · " + formatTracks(tracks.length)),
        action("changer", openLink), action("délier", unlink));
    } else if (local.offline) {
      box.append(el("span", null, "serveur injoignable"), action("réessayer", () => location.reload()));
    } else if (local.error) {
      box.append(el("span", null, "erreur du serveur : " + local.error), action("relier à vos fichiers", openLink));
    } else {
      box.append(el("span", null, album.serverId === "none" ? "délié" : "aucun fichier relié"),
        action("relier à vos fichiers", openLink));
    }
  }

  function unlink() {
    Store.update(album.id, { serverId: "none", serverLinked: "manual", serverCover: null, tracks: [], trackCount: null, duration: null });
    location.reload();
  }

  // Fenêtre "Relier à vos fichiers" : recherche dans la bibliothèque du téléphone
  const linkDialog = $("link-dialog");
  let linkTimer = null;

  function openLink() {
    $("link-input").value = album.title;
    linkDialog.showModal();
    $("link-input").select();
    searchServer();
  }

  // Recherche dans la bibliothèque du téléphone (fenêtre "Relier à vos fichiers")
  function searchServer() {
    const q = $("link-input").value.trim();
    const list = $("link-results");
    if (q.length < 2) { list.replaceChildren(); return; }
    $("link-status").textContent = "Recherche…";
    Server.search(q).then(found => {
      $("link-status").textContent = found.length ? "" : "Aucun album trouvé sur le téléphone.";
      list.replaceChildren(...found.map(s => {
        const li = el("li", "result");
        const thumb = el("div", "result-thumb");
        const img = el("img");
        img.src = Server.coverUrl(s.coverArt, 100);
        img.alt = "";
        img.onerror = () => img.remove();
        thumb.appendChild(img);
        const text = el("div", "result-text");
        text.append(el("p", "result-title", s.title),
          el("p", "result-meta", [s.artist, s.year, s.trackCount ? formatTracks(s.trackCount) : ""].filter(Boolean).join(" · ")));
        li.append(thumb, text);
        li.addEventListener("click", () => {
          Store.update(album.id, { serverId: s.id, serverLinked: "manual", serverCover: s.coverArt });
          location.reload();
        });
        li.addEventListener("mouseenter", () => li.classList.add("is-active"));
        li.addEventListener("mouseleave", () => li.classList.remove("is-active"));
        return li;
      }));
    }).catch(() => { $("link-status").textContent = "Serveur injoignable."; });
  }

  $("link-input").addEventListener("input", () => { clearTimeout(linkTimer); linkTimer = setTimeout(searchServer, 300); });
  $("link-close").addEventListener("click", () => linkDialog.close());
  linkDialog.addEventListener("click", e => { if (e.target === linkDialog) linkDialog.close(); });

  // ---------- Démarrage ----------

  renderInfo();
  renderTracks();
  renderAggro();
  renderLogs();

  const needsInfo = !album.enrichedAt || !(album.tracks || []).length;
  $("tracks-status").textContent = needsInfo ? "Récupération des informations…" : "";
  renderFiles();

  // 1. Vos fichiers (Navidrome sur le téléphone), 2. infos en ligne (Deezer, MusicBrainz…)
  loadLocal()
    .then(() => Enrich.run(album))
    .then(({ patch, tracks: live }) => {
      if (Object.keys(patch).length) album = Store.update(album.id, patch);
      if (live && !local.active) tracks = live;
      $("tracks-status").textContent = (album.tracks || []).length || tracks.length
        ? "" : "Liste des titres introuvable pour cet album.";
      renderNote();
      renderInfo();
      renderTracks();
    }).catch(err => {
      console.warn(err);
      // Hors ligne : si les infos sont déjà enregistrées, pas besoin d'alerter
      $("tracks-status").textContent = (album.tracks || []).length || tracks.length
        ? "" : "Impossible de récupérer les informations. Vérifiez votre connexion internet.";
    });
})();
