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

  // Album « next up » : pas de page album, il s'ouvre dans la page next up
  if (album.nextUp) {
    location.replace("nextup.html?album=" + encodeURIComponent(album.id));
    return;
  }
  try {
    const back = $("back-link");
    if (back.href.includes("nextup.html")) back.textContent = "← retour à next up";
    else if (back.href.includes("artist.html")) back.textContent = "← retour à " + (new URL(back.href).searchParams.get("name") || "l'artiste");
    else if (back.href.includes("complete.html")) back.textContent = "← retour à « à compléter »";
    else if (back.href.includes("wrapped.html")) back.textContent = "← retour au wrapped";
  } catch (e) {}

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

  // ---------- Album favori (♥) ----------

  function renderFavorite() {
    const on = !!album.favorite;
    const b = $("a-fav");
    b.innerHTML = favIcon(on);
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", on ? "Retirer des favoris" : "Ajouter aux favoris");
    b.title = on ? "Album favori (cliquer pour retirer)" : "Ajouter aux favoris";
  }

  $("a-fav").addEventListener("click", () => {
    const on = !album.favorite;
    album = Store.update(album.id, { favorite: on || null, favoriteAt: on ? new Date().toISOString() : null }) || album;
    renderFavorite();
  });

  // ---------- Vous aimerez peut-être aussi ----------
  // 4 albums de la collection, par ordre d'importance des critères :
  // 1. intensité (proche), 2. ressenti (communs), 3. styles (communs), 4. genre / famille.
  // Au survol d'un album : ce qu'il a en commun avec celui-ci.

  const REC_WEIGHTS = { intensity: 8, moods: 4, styles: 2, genre: 1 };

  function overlap(a, b) {
    const A = new Set((a || []).map(x => String(x).toLowerCase()));
    const B = new Set((b || []).map(x => String(x).toLowerCase()));
    if (!A.size || !B.size) return { score: 0, common: [] };
    const common = [...A].filter(x => B.has(x));
    return { score: common.length / Math.min(A.size, B.size), common };
  }

  function similarity(a, b) {
    const why = [];
    let score = 0;
    if (a.aggressivity && b.aggressivity) {
      const s = 1 - Math.abs(a.aggressivity - b.aggressivity) / 9;
      score += REC_WEIGHTS.intensity * s * s;
      if (Math.abs(a.aggressivity - b.aggressivity) <= 1) why.push("intensité " + b.aggressivity + "/10");
    }
    const m = overlap(a.moods, b.moods);
    score += REC_WEIGHTS.moods * m.score;
    if (m.common.length) why.push("ressenti : " + m.common.slice(0, 3).join(", "));
    const st = overlap(a.styles, b.styles);
    score += REC_WEIGHTS.styles * st.score;
    if (st.common.length) why.push("styles : " + st.common.slice(0, 3).join(", "));
    if (a.genre && b.genre && a.genre.toLowerCase() === b.genre.toLowerCase()) {
      score += REC_WEIGHTS.genre;
      why.push("genre : " + b.genre);
    } else if (familyOf(a) && familyOf(a) === familyOf(b)) {
      score += REC_WEIGHTS.genre / 2;
      why.push("famille : " + familyOf(b));
    }
    // L'intensité classe, mais ne suffit pas : il faut au moins un point commun
    // de ressenti, de style, de genre ou de famille
    const content = m.common.length || st.common.length || /genre|famille/.test(why.join(" "));
    if (!content) return { score: 0, why };
    if (a.artist === b.artist) score *= 0.85;   // un peu de variété
    return { score, why };
  }

  // Varie à chaque chargement de la page : 4 albums tirés parmi les 12 plus
  // proches (les plus proches ont plus de chances), puis affichés du plus proche
  // au moins proche. Le tirage reste le même tant que la page est ouverte.
  const REC_POOL = 12, REC_COUNT = 4, REC_TITLE_MAX = 28;
  let recPicked = null;   // ids tirés ; null = à tirer

  function drawRecs(pool) {
    const left = pool.slice();
    const picked = [];
    while (picked.length < REC_COUNT && left.length) {
      const total = left.reduce((s, r) => s + r.score, 0);
      let x = Math.random() * total;
      let i = 0;
      while (i < left.length - 1 && (x -= left[i].score) > 0) i++;
      picked.push(left.splice(i, 1)[0]);
    }
    return picked.map(r => r.album.id);
  }

  function shorten(text, max) {
    return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
  }

  // « 3 traits + » à côté d'une recommandation (au survol) : ajoute à la file ;
  // rien en lecture : ▶ lance l'album
  const REC_ICONS = {
    add: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h11M3.5 11.5h11M3.5 16.5h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18 13v7M14.5 16.5h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
    done: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h11M3.5 11.5h11M3.5 16.5h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13.5 16.5l2.8 2.8 5.2-5.6" fill="none" stroke="#3ecf6e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function paintRecBtn(b) {
    const mode = Number(b.dataset.doneUntil || 0) > Date.now() ? "done" : !Playback.state() ? "play" : "add";
    if (b.dataset.mode === mode) return;
    b.dataset.mode = mode;
    b.innerHTML = REC_ICONS[mode];
    b.classList.toggle("is-done", mode === "done");
    b.title = mode === "done" ? "Ajouté à la file d'attente" : mode === "play" ? "Écouter l'album" : "Ajouter à la file d'attente";
    b.setAttribute("aria-label", b.title);
  }

  function recQueueBtn(rec) {
    const b = el("button", "rec-queue");
    b.type = "button";
    b.addEventListener("click", () => {
      if (!Playback.state()) { Playback.playId(rec.id); return; }
      Playback.addToQueue(rec.id);
      b.dataset.doneUntil = String(Date.now() + 2000);
      paintRecBtn(b);
      setTimeout(() => paintRecBtn(b), 2050);
    });
    paintRecBtn(b);
    return b;
  }
  document.addEventListener("playback:change", () => document.querySelectorAll(".rec-queue").forEach(paintRecBtn));

  // Actualiser : un nouveau tirage parmi les albums proches
  $("recs-refresh").addEventListener("click", () => {
    recPicked = null;
    renderRecs();
  });

  function renderRecs() {
    const ranked = Store.all()
      .filter(b => b.id !== album.id)
      .map(b => Object.assign({ album: b }, similarity(album, b)))
      .filter(r => r.score > 0)
      .sort((x, y) => y.score - x.score)
      // Un seul album par artiste, pour varier
      .filter((r, i, list) => list.findIndex(o => o.album.artist === r.album.artist) === i)
      .slice(0, REC_POOL);
    if (!recPicked || recPicked.some(id => !ranked.some(r => r.album.id === id))) recPicked = drawRecs(ranked);
    const recs = ranked.filter(r => recPicked.includes(r.album.id));
    $("recs").hidden = !recs.length;
    $("recs-list").replaceChildren(...recs.map(r => {
      const li = el("li");
      const a = el("a", "rec-link");
      a.href = "album.html?id=" + encodeURIComponent(r.album.id);
      a.append(el("span", "rec-title", shorten(r.album.title, REC_TITLE_MAX)), document.createTextNode(" - " + r.album.artist));
      a.title = r.album.title + " — " + r.album.artist + "\n" + r.why.join(" · ");
      li.append(a, recQueueBtn(r.album));
      return li;
    }));
  }

  function renderInfo() {
    renderRecs();
    document.title = album.title + " — " + album.artist + " · conductor.";
    $("a-title").textContent = album.title;
    renderFavorite();
    $("a-artist").textContent = album.artist;
    $("a-artist").href = artistUrl(album.artist);
    $("a-artist").title = "Tous les albums de " + album.artist;

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
    // Copier [[Artiste]] - [[Album]] : petit bouton en haut à gauche (au survol)
    if (typeof coverCopyButton === "function") {
      const wrap = cover.parentElement;
      wrap.querySelectorAll(":scope > .cover-copy").forEach(b => b.remove());
      wrap.appendChild(coverCopyButton(album));
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
      // Genre → recherche dans la collection (filtres remis à zéro)
      const dd = el("dd");
      const a = el("a", "sheet-link", album.genre);
      a.href = "../index.html?reset=1&q=" + encodeURIComponent(album.genre);
      a.title = "Chercher « " + album.genre + " » dans la collection";
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
    td.colSpan = 3;
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

  // ---------- Morceaux préférés (★) ----------
  // album.favorites : titres simplifiés ("Black Mambo" → "blackmambo"), pour
  // retrouver la piste qu'elle vienne de Deezer ou de vos fichiers.

  function favKey(title) {
    return trackKey(title);   // js/data.js (partagé avec le mini-lecteur)
  }

  function isFavorite(t) {
    return (album.favorites || []).includes(favKey(t.title));
  }

  function toggleFavorite(t) {
    const k = favKey(t.title);
    const favs = new Set(album.favorites || []);
    favs.has(k) ? favs.delete(k) : favs.add(k);
    album = Store.update(album.id, { favorites: [...favs] }) || album;
    renderTracks();
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

      const fav = isFavorite(t);
      if (fav) tr.classList.add("is-favorite");
      const tdFav = el("td", "track-fav");
      const star = el("button", "fav-btn" + (fav ? " is-on" : ""));
      star.innerHTML = trackIcon(fav);
      star.type = "button";
      star.setAttribute("aria-pressed", String(fav));
      star.setAttribute("aria-label", (fav ? "Retirer des préférés : " : "Marquer comme préféré : ") + t.title);
      star.title = fav ? "Morceau préféré (cliquer pour retirer)" : "Marquer comme préféré";
      star.addEventListener("click", () => toggleFavorite(t));
      tdFav.appendChild(star);

      const tdTime = el("td", "track-time", t.duration ? mmss(t.duration) : "");

      tr.append(tdPlay, tdTitle, tdFav, tdTime);
      return open ? [tr, lyricsRow(t)] : [tr];
    }));
    updatePlayerUI();
  }

  // ---------- Lecteur ----------
  // Télécommande du moteur commun (js/playback.js) : la musique continue quand
  // on change de page, et reprend ici au même endroit. `current` = morceau en
  // cours quand c'est cet album qui joue, sinon -1.

  const audio = Playback.audio;
  let current = -1;

  function own() {
    return Playback.isAlbum(album.id);
  }

  function playable(i) {
    return tracks[i] && tracks[i].preview;
  }

  function firstPlayable(from, step) {
    for (let i = from; i >= 0 && i < tracks.length; i += step) if (playable(i)) return i;
    return -1;
  }

  function meta() {
    return {
      albumId: album.id, title: album.title, artist: album.artist,
      cover: album.cover || "", serverCover: album.serverCover || "",
      source: local.sd ? "local" : local.active ? "fichiers" : "extraits"
    };
  }

  function playTrack(i) {
    if (!playable(i)) return;
    // Remplace l'album en cours : la file d'attente est gardée
    Playback.playAlbum(meta(), tracks.map(t => ({ title: t.title, duration: t.duration, src: t.preview })), i, true);
  }

  function toggle() {
    if (own()) { Playback.toggle(); return; }
    const i = firstPlayable(0, 1);
    if (i > -1) playTrack(i);
  }

  function next() {
    if (own()) Playback.next();
  }

  function prev() {
    if (own()) Playback.prev();
  }

  function updatePlayerUI() {
    current = own() ? Playback.index() : -1;
    const list = tracks.length ? tracks : (album.tracks || []);
    const shown = current > -1 ? current : 0;
    const playing = current > -1 && !audio.paused;

    $("p-track").textContent = list[shown] ? list[shown].title : "";
    // « (6/11) » devant le titre, pendant la lecture de cet album
    $("p-pos").textContent = current > -1 && list.length ? "(" + (current + 1) + "/" + list.length + ")" : "";
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
    renderQueueButton();
  }

  // Durée du morceau : celle du fichier audio, sinon celle des métadonnées
  function currentDuration() {
    if (current < 0) return 0;
    return Playback.duration() || (tracks[current] && tracks[current].duration) || 0;
  }

  function updateTime() {
    const dur = currentDuration();
    const t = current > -1 ? audio.currentTime : 0;
    $("p-time").textContent = mmss(t) + " / " + mmss(current > -1 ? dur : 0);
    $("p-fill").style.width = (dur && current > -1 ? (t / dur) * 100 : 0) + "%";
  }

  $("p-play").addEventListener("click", toggle);
  $("p-next").addEventListener("click", next);
  $("p-prev").addEventListener("click", prev);

  // Pour les raccourcis clavier (js/shortcuts.js) : Espace, ← →
  // Un autre album est en cours : les touches le pilotent (Espace ne lance pas cet album-ci)
  const other = () => !own() && !!Playback.state();
  window.Player = {
    toggle: () => (other() ? Playback.toggle() : toggle()),
    next: () => (other() ? Playback.next() : next()),
    prev: () => (other() ? Playback.prev() : prev()),
    active: () => own() || other(),
    hasAudio: () => other() || tracks.some(t => t.preview)
  };
  audio.addEventListener("timeupdate", () => { if (own()) updateTime(); });
  audio.addEventListener("loadedmetadata", () => { if (own()) updateTime(); });
  document.addEventListener("playback:change", updatePlayerUI);

  // Cliquer sur la barre pour avancer / reculer
  $("p-bar").addEventListener("click", e => {
    if (current < 0 || !currentDuration()) return;
    const r = e.currentTarget.getBoundingClientRect();
    Playback.seek(((e.clientX - r.left) / r.width) * currentDuration());
  });
  $("p-bar").addEventListener("keydown", e => {
    if (current < 0) return;
    if (e.key === "ArrowRight") Playback.seek(Math.min(currentDuration(), audio.currentTime + 5));
    if (e.key === "ArrowLeft") Playback.seek(Math.max(0, audio.currentTime - 5));
  });

  // + file d'attente : l'album passera après ceux déjà prévus (autant de fois
  // qu'on veut) ; « ✓ ajouté » s'affiche quelques secondes pour confirmer.
  let queueDoneUntil = 0;
  function renderQueueButton() {
    const b = $("queue-add");
    if (!b) return;
    const done = queueDoneUntil > Date.now();
    b.hidden = !Playback.state();
    b.textContent = done ? "✓ ajouté à la file d'attente" : "+ file d'attente";
    b.classList.toggle("is-done", done);
    b.title = "Écouter cet album après ceux déjà prévus";
  }

  $("queue-add").addEventListener("click", () => {
    Playback.addToQueue(album.id);
    queueDoneUntil = Date.now() + 2000;
    renderQueueButton();
    setTimeout(renderQueueButton, 2050);
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
      recPicked = null;   // l'intensité change les albums proches : nouveau tirage
      renderRecs();
      renderAggro();
    });
    $("aggro-scale").appendChild(b);
  }

  // ---------- Tier (S, A, B) ----------

  function renderTier() {
    const t = album.tier || "";
    // « Tier S · Masterpiece », comme « Intensité 9/10 · agressif »
    $("tier-value").textContent = t ? t + " · " + TIER_NAMES[t] : "non classé";
    [...$("tier-scale").children].forEach(b => {
      b.classList.toggle("is-active", b.dataset.tier === t);
      b.setAttribute("aria-checked", String(b.dataset.tier === t));
    });
  }

  TIERS.forEach(t => {
    const b = el("button", "tier-step tier-" + t, t);
    b.type = "button";
    b.dataset.tier = t;
    b.setAttribute("role", "radio");
    b.title = "Tier " + t + " · " + TIER_NAMES[t] + " (recliquer pour retirer)";
    b.addEventListener("click", () => {
      album = Store.update(album.id, { tier: album.tier === t ? null : t }) || album;
      renderTier();
    });
    $("tier-scale").appendChild(b);
  });

  // ---------- Écoutes ----------
  // Comptées par le moteur de lecture (js/playback.js), même hors de cette page :
  // un album est « écouté » quand 90 % de ses morceaux l'ont été, chacun au moins
  // à moitié (4 min max), en temps réellement joué → album.plays.

  const plural = (n, w) => n + " " + w + (n > 1 ? "s" : "");
  const ALBUM_SHARE = 0.9;

  document.addEventListener("albums:changed", () => {
    album = Store.get(album.id) || album;
    renderPlays();
    renderFavorite();   // ♥ et ★ changés par un raccourci (Maj + F, L)
    renderTracks();
  });

  function renderPlays() {
    const plays = album.plays || [];
    const last = plays.length ? plays[plays.length - 1] : null;
    const parts = [plays.length
      ? plural(plays.length, "écoute") + " · dernière le " + formatDate(last.at.slice(0, 10))
      : "Pas encore écouté ici"];
    $("a-plays").textContent = parts.join(" · ");
    $("a-plays").title = "Une écoute = " + Math.round(ALBUM_SHARE * 100) + " % de la durée réellement écoutée et " +
      Math.round(ALBUM_SHARE * 100) + " % des morceaux (chacun au moins à moitié), avec le lecteur. " +
      "Dernier album avant de fermer l'application : 60 %.";
  }

  function renderLogs() {
    const logs = (album.logs || []).slice().reverse();
    $("a-logs").replaceChildren(...logs.map(log => {
      const li = el("li", "log");
      const head = el("p", "log-head");
      // Un log = un ajout (avec note / commentaire), pas une écoute
      head.appendChild(el("span", null, log.date ? "Ajouté le " + formatDate(log.date) : "Ajouté"));
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

  // Image (fichier ou blob) recadrée en carré, réduite à 600 px (JPEG en data URL)
  function squareImage(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(600, img.width, img.height);
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        canvas.getContext("2d").drawImage(img,
          (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        URL.revokeObjectURL(img.src);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }

  // Dans la fenêtre « Modifier la fiche » : aperçu, enregistré avec « Enregistrer »
  function useImage(blob) {
    return squareImage(blob).then(url => {
      setCoverPreview(url);
      $("e-cover").value = "";
    });
  }

  // ---------- Coller une pochette (fenêtre « Modifier la fiche » seulement) ----------
  // Clic droit sur l'aperçu de la pochette → « Coller… », ou Ctrl + V dans la fenêtre :
  // l'image va dans l'aperçu, enregistrée avec « Enregistrer ».
  const coverStatus = text => { const st = $("e-cover-status"); st.hidden = !text; st.textContent = text || ""; };

  async function pasteCoverFromClipboard() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith("image/"));
        if (type) { await useImage(await item.getType(type)); coverStatus(""); return; }
      }
      coverStatus("Pas d'image dans le presse-papiers.");
    } catch (e) {
      coverStatus("Presse-papiers inaccessible : autorisez-le, ou utilisez Ctrl + V.");
    }
  }

  // Petit menu au clic droit sur l'aperçu (placé dans la fenêtre, pour passer au-dessus)
  let coverMenu = null;
  function closeCoverMenu() { if (coverMenu) { coverMenu.remove(); coverMenu = null; } }
  $("e-cover-preview").addEventListener("contextmenu", e => {
    e.preventDefault();
    closeCoverMenu();
    coverMenu = el("div", "ctx-menu");
    coverMenu.setAttribute("role", "menu");
    const item = el("button", "ctx-item", "Coller la pochette depuis le presse-papiers");
    item.type = "button";
    item.setAttribute("role", "menuitem");
    item.addEventListener("click", () => { closeCoverMenu(); pasteCoverFromClipboard(); });
    coverMenu.append(item, el("p", "ctx-hint", "ou Ctrl + V dans cette fenêtre"));
    dialog.appendChild(coverMenu);
    const w = coverMenu.offsetWidth, h = coverMenu.offsetHeight;
    coverMenu.style.left = Math.min(e.clientX, innerWidth - w - 8) + "px";
    coverMenu.style.top = Math.min(e.clientY, innerHeight - h - 8) + "px";
    item.focus();
  });
  dialog.addEventListener("pointerdown", e => { if (coverMenu && !coverMenu.contains(e.target)) closeCoverMenu(); });
  dialog.addEventListener("keydown", e => { if (e.key === "Escape" && coverMenu) { e.preventDefault(); e.stopPropagation(); closeCoverMenu(); } });
  dialog.addEventListener("close", closeCoverMenu);

  // Ctrl + V dans la fenêtre : une image collée devient l'aperçu (le texte se colle normalement)
  dialog.addEventListener("paste", e => {
    const file = [...(e.clipboardData ? e.clipboardData.files : [])].find(f => f.type.startsWith("image/"));
    if (!file) return;
    e.preventDefault();
    useImage(file).then(() => coverStatus(""));
  });

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
      // ordre alphabétique, « Autres » en dernier
      ...GENRE_FAMILIES.slice().sort((a, b) =>
        (a === "Autres") - (b === "Autres") || a.localeCompare(b, "fr", { sensitivity: "base" }))
        .map(f => new Option(f, f)));
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

  const local = { active: false, offline: false, error: "", formats: "", sd: false };

  // Stockage local (js/sdcard.js) : carte SD, clé USB, dossier du PC… prioritaire
  function loadSd() {
    if (typeof SD === "undefined") return false;
    const m = SD.matchFor(album);
    if (!m || !m.tracks.length) return false;
    const known = album.tracks || [];
    tracks = SD.tracksOf(m).map((t, i) => ({
      title: t.title,
      duration: t.duration || (known.length === m.tracks.length && known[i] ? known[i].duration || 0 : 0),
      preview: t.src, track: t.track, disc: t.disc
    }));
    local.active = true;
    local.sd = true;
    local.formats = [...new Set(SD.tracksOf(m).map(t => t.format).filter(Boolean))].join(", ");
    const patch = { sdDir: m.dir, tracks: tracks.map(t => ({ title: t.title, duration: t.duration, track: t.track, disc: t.disc })), trackCount: tracks.length };
    if (tracks.every(t => t.duration)) patch.duration = tracks.reduce((s, t) => s + t.duration, 0);
    album = Store.update(album.id, patch);
    // Pas de pochette locale : celle du dossier ou des fichiers (copiée dans datastorage/covers)
    if (SD.needsCover(album) && SD.call) {
      SD.call("coverToAlbum", album.id, m.dir).then(ok => {
        if (!ok) return;
        album = Store.get(album.id) || album;
        renderInfo();
      }).catch(() => {});
    }
    return true;
  }

  function localName() {
    const src = typeof SD !== "undefined" && album.sdDir ? SD.sourceOf(album.sdDir) : null;
    return src ? src.name : "dossier";
  }

  async function loadLocal() {
    if (loadSd()) {
      renderFiles();
      renderNote();
      renderInfo();
      renderTracks();
      return;
    }
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
      ? "Lecture intégrale depuis " + (local.sd ? "votre dossier « " + localName() + " »" : "vos fichiers") + (local.formats ? " (" + local.formats + ")" : "") + "."
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
    if (local.sd) {
      box.append(el("span", null, "stockage local « " + localName() + " » · " + formatTracks(tracks.length)),
        action("changer", openLink),
        action("délier", () => { Store.update(album.id, { sdDir: "none" }); location.reload(); }));
    } else if (!Server.isConfigured() && typeof SD !== "undefined" && SD.isConfigured()) {
      box.append(el("span", null, album.sdDir === "none" ? "délié" : "aucun fichier relié"),
        action("relier à vos fichiers", openLink));
    } else if (!Server.isConfigured()) {
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
  // Albums du stockage local correspondant à la recherche (titre, artiste, dossier)
  function localResults(q) {
    if (typeof SD === "undefined" || !SD.isConfigured()) return [];
    const words = q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/).filter(Boolean);
    const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return SD.index().albums.filter(a => {
      const hay = norm(a.title + " " + a.artist + " " + a.dir);
      return words.every(w => hay.includes(w));
    }).slice(0, 20).map(a => {
      const li = el("li", "result");
      const thumb = el("div", "result-thumb");
      SD.call("cover", a.dir).then(blob => {
        if (!blob) return;
        const img = el("img");
        img.src = URL.createObjectURL(blob);
        img.alt = "";
        thumb.appendChild(img);
      }).catch(() => {});
      const text = el("div", "result-text");
      const src = SD.sourceOf(a.dir);
      text.append(el("p", "result-title", a.title),
        el("p", "result-meta", ["dossier « " + (src ? src.name : "") + " »", a.artist, a.year, formatTracks(a.trackCount)].filter(Boolean).join(" · ")));
      li.append(thumb, text);
      li.addEventListener("click", () => {
        Store.update(album.id, { sdDir: a.dir });
        location.reload();
      });
      li.addEventListener("mouseenter", () => li.classList.add("is-active"));
      li.addEventListener("mouseleave", () => li.classList.remove("is-active"));
      return li;
    });
  }

  function searchServer() {
    const q = $("link-input").value.trim();
    const list = $("link-results");
    if (q.length < 2) { list.replaceChildren(); return; }
    const local = localResults(q);
    list.replaceChildren(...local);
    if (!Server.isConfigured()) {
      $("link-status").textContent = local.length ? "" : "Aucun album trouvé dans vos dossiers.";
      return;
    }
    $("link-status").textContent = "Recherche…";
    Server.search(q).then(found => {
      $("link-status").textContent = found.length || local.length ? "" : "Aucun album trouvé sur le téléphone ni dans vos dossiers.";
      list.replaceChildren(...local, ...found.map(s => {
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
    }).catch(() => { $("link-status").textContent = local.length ? "Téléphone injoignable." : "Serveur injoignable."; });
  }

  $("link-input").addEventListener("input", () => { clearTimeout(linkTimer); linkTimer = setTimeout(searchServer, 300); });
  $("link-close").addEventListener("click", () => linkDialog.close());
  linkDialog.addEventListener("click", e => { if (e.target === linkDialog) linkDialog.close(); });

  // ---------- Démarrage ----------

  renderInfo();
  renderTracks();
  renderAggro();
  renderTier();
  renderLogs();
  renderPlays();

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
