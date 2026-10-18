// conductor. — lecture continue + mini-lecteur + file d'attente
//
// Site sur une seule page : conductor.html (l'« enveloppe ») ne se recharge
// jamais ; les pages du site s'affichent dans un cadre plein écran à
// l'intérieur. Ce fichier a donc deux modes :
// - dans conductor.html : le vrai moteur (son, file d'attente, écoutes,
//   mini-lecteur) ;
// - dans une page (cadre) : un relais qui offre la même API (Playback.*) et
//   transmet les commandes au moteur par messages (postMessage) ; le moteur
//   renvoie l'état du lecteur.
//
// Un seul moteur de lecture pour tout le site (Playback.audio) :
// - la page album le pilote (son lecteur devient une télécommande) ;
// - l'état est sauvegardé en continu (localStorage) et repris automatiquement
//   à l'ouverture de chaque page, au même morceau et à la même seconde.
//   Si Chrome bloque la reprise du son, elle se fait au premier clic ou à la
//   première touche ;
// - le mini-lecteur (en bas à droite) n'apparaît que hors de la page de l'album
//   en cours ;
// - file d'attente d'albums : à la fin d'un album, le suivant démarre ;
// - écoutes comptées ici (90 % des morceaux, chacun au moins à moitié), même
//   en changeant de page → Store.addPlay.

(function () {
  const FRAMED = window.top !== window;
  // Page ouverte seule : data.js la renvoie dans conductor.html, on ne fait rien
  if (!FRAMED && !window.CONDUCTOR_SHELL) return;
  if (FRAMED) { frameRelay(); return; }

  const STATE_KEY = "conductor01.playback";
  const QUEUE_KEY = "conductor01.queue";
  const RESUME_WITHIN = 12 * 3600 * 1000;    // au-delà de 12 h, on ne relance pas le son tout seul
  const TRACK_SHARE = 0.5, TRACK_MAX = 240, ALBUM_SHARE = 0.9;

  const ROOT = typeof APP_ROOT !== "undefined" ? APP_ROOT : "";
  // Page affichée dans le cadre (envoyée par la page elle-même)
  const frame = () => document.getElementById("page");
  let framePage = { path: "", albumId: null };

  const audio = new Audio();
  audio.preload = "auto";
  // Volume : réglé par les pages (js/volume.js) ; en attendant, le dernier choisi
  try {
    const v = JSON.parse(localStorage.getItem("conductor01.volume") || "null");
    if (v && Number.isFinite(v.level)) audio.volume = Math.pow(Math.max(0, Math.min(20, v.level)) / 20, 2);
  } catch (e) {}

  // ---------- État ----------
  // state = { albumId, title, artist, cover, serverCover, source,
  //           tracks: [{ title, duration, src }], index, time, playing,
  //           heard: { index: secondes }, done: [index…], savedAt }

  let state = null;
  let queue = [];
  let lastTime = null;   // comptage des écoutes
  let lastSave = 0;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }

  function write(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function save() {
    if (state) {
      state.time = audio.currentTime || state.time || 0;
      state.playing = !audio.paused;
      state.savedAt = Date.now();
    }
    write(STATE_KEY, state);
  }

  function saveQueue() {
    write(QUEUE_KEY, queue);
  }

  function emit() {
    document.dispatchEvent(new CustomEvent("playback:change"));
    broadcast();
  }

  // ---------- Échanges avec la page du cadre ----------

  function post(msg) {
    const f = frame();
    if (f && f.contentWindow) f.contentWindow.postMessage(Object.assign({ conductor: true }, msg), "*");
  }

  function snapshot() {
    return {
      state: state ? {
        albumId: state.albumId, title: state.title, artist: state.artist, source: state.source,
        index: state.index, tracks: state.tracks.map(t => ({ title: t.title, duration: t.duration }))
      } : null,
      queue: queue.slice(),
      time: { currentTime: audio.currentTime || 0, duration: duration(), paused: audio.paused, seeking: audio.seeking }
    };
  }

  function broadcast() {
    post(Object.assign({ type: "state" }, snapshot()));
    post({ type: "mini", visible: visible() });
  }

  function navigate(path) {
    const f = frame();
    if (f) f.src = path;
  }

  const COMMANDS = {
    playAlbum: (meta, tracks, index) => playAlbum(meta, tracks, index),
    toggle: () => toggle(),
    next: () => next(),
    prev: () => prev(),
    seek: sec => seek(sec),
    close: () => close(),
    addToQueue: id => addToQueue(id),
    removeFromQueue: id => removeFromQueue(id),
    moveInQueue: (a, b) => moveInQueue(a, b),
    clearQueue: () => clearQueue(),
    playId: id => playId(id),
    volume: (v, m) => { audio.volume = Math.max(0, Math.min(1, v)); audio.muted = !!m; }
  };

  window.addEventListener("message", e => {
    const f = frame();
    if (!f || e.source !== f.contentWindow || !e.data || !e.data.conductor) return;
    const d = e.data;
    if (d.type === "cmd" && COMMANDS[d.name]) COMMANDS[d.name].apply(null, d.args || []);
    else if (d.type === "page") {
      framePage = { path: d.path || "", albumId: d.albumId || null };
      if (d.path) history.replaceState(null, "", "#" + d.path);
      if (d.title) document.title = d.title;
      render();
      broadcast();
    }
  });

  // ---------- Lecture ----------

  function playable(i) {
    return state && state.tracks[i] && state.tracks[i].src;
  }

  function firstPlayable(from, step) {
    if (!state) return -1;
    for (let i = from; i >= 0 && i < state.tracks.length; i += step) if (playable(i)) return i;
    return -1;
  }

  // Lancer la lecture (avec reprise au premier geste si Chrome refuse)
  let waitingGesture = false;
  function start() {
    return audio.play().then(() => { waitingGesture = false; }).catch(() => {
      if (waitingGesture) return;
      waitingGesture = true;
      const go = () => {
        document.removeEventListener("pointerdown", go, true);
        document.removeEventListener("keydown", go, true);
        if (waitingGesture && state) audio.play().catch(() => {});
        waitingGesture = false;
      };
      document.addEventListener("pointerdown", go, true);
      document.addEventListener("keydown", go, true);
      emit();
    });
  }

  function loadTrack(i, at, autoplay) {
    if (!playable(i)) return;
    state.index = i;
    state.time = at || 0;
    audio.src = state.tracks[i].src;
    if (at) {
      const seek = () => { try { audio.currentTime = at; } catch (e) {} };
      audio.readyState >= 1 ? seek() : audio.addEventListener("loadedmetadata", seek, { once: true });
    }
    lastTime = null;
    if (autoplay) start();
    save();
    emit();
  }

  // meta : { albumId, title, artist, cover, serverCover, source }
  // tracks : [{ title, duration, src }]
  // fromQueue : album enchaîné depuis la file. Sinon (lancé à la main),
  // un nouvel album vide la file d'attente.
  function playAlbum(meta, tracks, index, fromQueue) {
    const same = state && state.albumId === meta.albumId;
    if (!fromQueue && !same && queue.length) { queue = []; saveQueue(); }
    state = Object.assign({}, meta, {
      tracks: tracks.map(t => ({ title: t.title, duration: t.duration || 0, src: t.src || "" })),
      index: 0,
      time: 0,
      heard: same ? state.heard : {},
      done: same ? state.done : []
    });
    // L'album lancé quitte la file s'il y était
    if (queue.includes(meta.albumId)) { queue = queue.filter(id => id !== meta.albumId); saveQueue(); }
    loadTrack(index || 0, 0, true);
  }

  function toggle() {
    if (!state) return;
    if (!audio.src) { loadTrack(state.index, state.time, true); return; }
    audio.paused ? start() : audio.pause();
  }

  function next() {
    const i = firstPlayable((state ? state.index : -1) + 1, 1);
    if (i > -1) loadTrack(i, 0, true);
    else playNextAlbum();
  }

  function prev() {
    if (!state) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    const i = firstPlayable(state.index - 1, -1);
    if (i > -1) loadTrack(i, 0, true);
  }

  function seek(sec) {
    if (!state || !isFinite(sec)) return;
    audio.currentTime = Math.max(0, sec);
  }

  function duration() {
    if (isFinite(audio.duration) && audio.duration > 0) return audio.duration;
    return (state && state.tracks[state.index] && state.tracks[state.index].duration) || 0;
  }

  function close() {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    state = null;
    queue = [];          // fermer le lecteur vide aussi la file
    saveQueue();
    save();
    emit();
  }

  audio.addEventListener("ended", () => {
    const i = firstPlayable(state ? state.index + 1 : 0, 1);
    if (i > -1) loadTrack(i, 0, true);
    else playNextAlbum();
  });

  // ---------- File d'attente ----------

  function albumTracks(a) {
    // 1. Vos fichiers (Navidrome)
    if (typeof Server !== "undefined" && Server.isConfigured()) {
      const match = Server.matchFor(a);
      if (match) {
        return Server.getAlbum(match).then(full => ({
          source: "fichiers",
          serverCover: full.coverArt || a.serverCover || "",
          tracks: full.tracks.map(t => ({ title: t.title, duration: t.duration, src: t.src }))
        })).catch(() => deezerTracks(a));
      }
    }
    return deezerTracks(a);
  }

  // 2. Extraits Deezer
  let jsonpId = 0;
  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const name = "conductorPb" + (++jsonpId);
      const s = document.createElement("script");
      const timer = setTimeout(() => { cleanup(); reject(new Error("délai")); }, 8000);
      function cleanup() { clearTimeout(timer); delete window[name]; s.remove(); }
      window[name] = data => { cleanup(); resolve(data); };
      s.onerror = () => { cleanup(); reject(new Error("réseau")); };
      s.src = url + (url.includes("?") ? "&" : "?") + "output=jsonp&callback=" + name;
      document.head.appendChild(s);
    });
  }

  function deezerTracks(a) {
    const direct = /^deezer-(\d+)$/.exec(a.id || "");
    const idP = direct ? Promise.resolve(direct[1])
      : jsonp("https://api.deezer.com/search/album?limit=5&q=" +
          encodeURIComponent('artist:"' + a.artist + '" album:"' + a.title + '"'))
          .then(d => (d.data && d.data[0] && d.data[0].id) || null);
    return idP.then(id => {
      if (!id) return null;
      return jsonp("https://api.deezer.com/album/" + id + "/tracks?limit=200").then(d => ({
        source: "extraits",
        tracks: (d.data || []).map(t => ({ title: t.title_short || t.title, duration: t.duration, src: t.preview }))
      }));
    }).catch(() => null);
  }

  function playNextAlbum() {
    if (!queue.length) {
      // fin de la file : on reste sur le dernier morceau, en pause
      audio.pause();
      save();
      emit();
      return;
    }
    const id = queue.shift();
    saveQueue();
    const a = Store.get(id);
    if (!a) { playNextAlbum(); return; }
    emit();
    albumTracks(a).then(res => {
      if (!res || !res.tracks.some(t => t.src)) { playNextAlbum(); return; }
      playAlbum({
        albumId: a.id, title: a.title, artist: a.artist, cover: a.cover || "",
        serverCover: res.serverCover || a.serverCover || "", source: res.source
      }, res.tracks, Math.max(0, res.tracks.findIndex(t => t.src)), true);
    });
  }

  function addToQueue(albumId) {
    if (!albumId || queue.includes(albumId) || (state && state.albumId === albumId)) return false;
    queue.push(albumId);
    saveQueue();
    emit();
    return true;
  }

  function removeFromQueue(albumId) {
    queue = queue.filter(id => id !== albumId);
    saveQueue();
    emit();
  }

  function moveInQueue(from, to) {
    if (from === to || from < 0 || from >= queue.length) return;
    const [id] = queue.splice(from, 1);
    queue.splice(Math.max(0, Math.min(queue.length, to)), 0, id);
    saveQueue();
    emit();
  }

  // Lance un album par son id (tracks chargés comme pour la file).
  // Lancement manuel : la file d'attente est remplacée.
  function playId(id) {
    if (!id) return;
    queue = [id];
    saveQueue();
    playNextAlbum();
  }

  function clearQueue() {
    queue = [];
    saveQueue();
    emit();
  }

  // ---------- Écoutes ----------

  function countListening() {
    if (!state || audio.paused || audio.seeking) { lastTime = null; return; }
    const t = audio.currentTime;
    if (lastTime != null) {
      const d = t - lastTime;
      if (d > 0 && d < 2) state.heard[state.index] = (state.heard[state.index] || 0) + d;
    }
    lastTime = t;
    const i = state.index;
    const dur = (state.tracks[i] && state.tracks[i].duration) || duration();
    const need = dur ? Math.min(TRACK_MAX, dur * TRACK_SHARE) : Infinity;
    if (!state.done.includes(i) && (state.heard[i] || 0) >= need) {
      state.done.push(i);
      const n = state.tracks.length;
      if (n && state.done.length >= Math.ceil(n * ALBUM_SHARE)) {
        Store.addPlay(state.albumId, { tracks: state.done.length, of: n, source: state.source || "" });
        state.heard = {};
        state.done = [];
      }
    }
  }

  audio.addEventListener("seeking", () => { lastTime = null; });
  audio.addEventListener("play", () => { lastTime = null; save(); emit(); });
  audio.addEventListener("pause", () => { save(); emit(); });
  function postTime(event) {
    post({ type: "time", event, time: { currentTime: audio.currentTime || 0, duration: duration(), paused: audio.paused, seeking: audio.seeking } });
  }

  audio.addEventListener("timeupdate", () => {
    countListening();
    if (Date.now() - lastSave > 1000) { lastSave = Date.now(); save(); }
    renderProgress();
    postTime("timeupdate");
  });
  audio.addEventListener("loadedmetadata", () => postTime("loadedmetadata"));
  window.addEventListener("pagehide", save);

  // ---------- Reprise à l'ouverture de la page ----------

  state = read(STATE_KEY, null);
  queue = read(QUEUE_KEY, []).filter(id => typeof id === "string");
  if (state && (!state.tracks || !state.tracks.length)) state = null;
  if (state) {
    state.heard = state.heard || {};
    state.done = state.done || [];
    const fresh = Date.now() - (state.savedAt || 0) < RESUME_WITHIN;
    if (playable(state.index)) {
      audio.src = state.tracks[state.index].src;
      const at = state.time || 0;
      audio.addEventListener("loadedmetadata", () => { try { audio.currentTime = at; } catch (e) {} }, { once: true });
      if (state.playing && fresh) start();
    }
  }

  // ---------- Mini-lecteur ----------

  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2.2v14H6zM19 5.5v13L9.5 12z" fill="currentColor"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.8 5H18v14h-2.2zM5 5.5v13l9.5-6.5z" fill="currentColor"/></svg>',
    album: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>',
    queue: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h12M4 11.5h12M4 16.5h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15.5 14.5v6l5-3z" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };

  let mp = null, panel = null;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function coverSrc(o, size) {
    const src = o.cover || (o.serverCover && typeof Server !== "undefined" && Server.isConfigured()
      ? Server.coverUrl(o.serverCover, size || 200) : "");
    return src ? localUrl(src) : "";
  }

  function albumUrl(id) {
    return "pages/album.html?id=" + encodeURIComponent(id);
  }

  // Liens du mini-lecteur : ouverts dans le cadre (la page ne se recharge pas)
  function frameLink(a, path) {
    a.href = "#" + path;
    a.onclick = e => { e.preventDefault(); navigate(path); };
  }

  function albumLength(a) {
    if (!a) return 0;
    if (a.duration) return a.duration;
    return (a.tracks || []).reduce((s, t) => s + (t.duration || 0), 0);
  }

  // "1 h 4 min", "41 min"
  function hm(sec) {
    sec = Math.round(sec || 0);
    if (sec < 3600) return formatLength(sec);   // "41 min 45 s"
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h ? h + " h " + m + " min" : m + " min";
  }

  function mmss(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  }

  function iconBtn(cls, label, icon) {
    const b = el("button", "mp-btn " + cls);
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.title = label;
    b.innerHTML = icon;
    return b;
  }

  function build() {
    mp = el("div", "mp");
    mp.hidden = true;
    mp.setAttribute("role", "region");
    mp.setAttribute("aria-label", "Lecture en cours");

    // Fond : la pochette floutée, en transparence
    const bg = el("div", "mp-bg");

    // Haut : pochette, ★ du morceau à côté (en bas), outils en haut à droite
    const cover = el("a", "mp-cover");
    const star = el("button", "mp-btn mp-star");
    star.type = "button";
    const tools = el("div", "mp-tools");
    const toAlbum = iconBtn("mp-goto", "Aller à la page de l'album", ICON.album);
    const qBtn = iconBtn("mp-queue", "File d'attente", ICON.queue);
    const badge = el("span", "mp-badge");
    qBtn.appendChild(badge);
    const closeBtn = iconBtn("mp-close", "Fermer le lecteur", ICON.close);
    tools.append(toAlbum, qBtn, closeBtn);
    const head = el("div", "mp-head");
    head.append(cover, star, tools);

    // Milieu : artiste + titre, ⏮ ⏭ puis ▶ (rond)
    const meta = el("div", "mp-meta");
    meta.append(el("p", "mp-sub"), el("p", "mp-title"));
    const controls = el("div", "mp-controls");
    const prevBtn = iconBtn("mp-prev", "Titre précédent", ICON.prev);
    const nextBtn = iconBtn("mp-next", "Titre suivant", ICON.next);
    const playBtn = iconBtn("mp-play", "Lecture", ICON.play);
    controls.append(prevBtn, nextBtn, playBtn);
    const mid = el("div", "mp-mid");
    mid.append(meta, controls);

    // Bas : progression et temps
    const bar = el("div", "mp-bar");
    bar.setAttribute("role", "slider");
    bar.setAttribute("aria-label", "Position dans le morceau");
    bar.tabIndex = 0;
    bar.appendChild(el("span", "mp-fill"));
    const times = el("div", "mp-times");
    times.append(el("span", "mp-cur", "0:00"), el("span", "mp-dur", "0:00"));

    mp.append(bg, head, mid, bar, times);

    playBtn.addEventListener("click", toggle);
    prevBtn.addEventListener("click", prev);
    nextBtn.addEventListener("click", next);
    toAlbum.addEventListener("click", () => { if (state) navigate(albumUrl(state.albumId)); });
    closeBtn.addEventListener("click", () => { panelOpen(false); close(); });
    qBtn.addEventListener("click", () => panelOpen(!(panel && !panel.hidden)));
    star.addEventListener("click", toggleTrackStar);
    bar.addEventListener("click", e => {
      const r = bar.getBoundingClientRect();
      seek(((e.clientX - r.left) / r.width) * duration());
    });
    bar.addEventListener("keydown", e => {
      if (e.key === "ArrowRight") { e.preventDefault(); seek(audio.currentTime + 5); }
      if (e.key === "ArrowLeft") { e.preventDefault(); seek(audio.currentTime - 5); }
    });

    document.body.appendChild(mp);
    buildPanel();
  }

  // Étoile du morceau en cours (même enregistrement que sur la page album)
  function currentTrackKey() {
    const t = state && state.tracks[state.index];
    return t ? trackKey(t.title) : "";
  }

  function toggleTrackStar() {
    if (!state) return;
    const a = Store.get(state.albumId);
    if (!a) return;
    const k = currentTrackKey();
    const favs = new Set(a.favorites || []);
    favs.has(k) ? favs.delete(k) : favs.add(k);
    Store.update(a.id, { favorites: [...favs] });
    render();
  }

  function visible() {
    return !!state;   // affiché partout, y compris sur la page de l'album en cours
  }

  function render() {
    if (!mp) return;
    const show = visible();
    mp.hidden = !show;
    document.body.classList.toggle("has-mini-player", show);
    if (!show) { panelOpen(false); return; }

    const t = state.tracks[state.index] || {};
    const a = Store.get(state.albumId);
    const cover = mp.querySelector(".mp-cover");
    frameLink(cover, albumUrl(state.albumId));
    cover.title = state.title + " — " + state.artist;
    const src = coverSrc(a ? Object.assign({}, a, { serverCover: a.serverCover || state.serverCover }) : state, 200);
    const img = cover.querySelector("img");
    if (src && (!img || img.getAttribute("src") !== src)) {
      const i = el("img");
      i.alt = "";
      i.src = src;
      i.onerror = () => i.remove();
      cover.replaceChildren(i);
    } else if (!src) cover.replaceChildren();
    const bg = mp.querySelector(".mp-bg");
    const bgUrl = src ? 'url("' + src.replace(/"/g, '\\"') + '")' : "none";
    if (bg.style.backgroundImage !== bgUrl) bg.style.backgroundImage = bgUrl;

    mp.querySelector(".mp-title").textContent = t.title || state.title;
    mp.querySelector(".mp-title").title = t.title || "";
    mp.querySelector(".mp-sub").textContent = state.artist;

    const playing = !audio.paused;
    const play = mp.querySelector(".mp-play");
    play.innerHTML = playing ? ICON.pause : ICON.play;
    play.setAttribute("aria-label", playing ? "Pause" : "Lecture");
    play.title = waitingGesture ? "Cliquer pour reprendre la lecture" : (playing ? "Pause" : "Lecture");
    mp.classList.toggle("is-waiting", waitingGesture && !playing);

    const starred = !!(a && (a.favorites || []).includes(currentTrackKey()));
    const star = mp.querySelector(".mp-star");
    star.innerHTML = trackIcon(starred);
    star.classList.toggle("is-on", starred);
    star.title = starred ? "Morceau préféré (cliquer pour retirer)" : "Marquer le morceau comme préféré";
    star.setAttribute("aria-label", star.title);
    star.hidden = !a;

    const badge = mp.querySelector(".mp-badge");
    badge.textContent = queue.length || "";
    badge.hidden = !queue.length;
    mp.querySelector(".mp-queue").title = queue.length
      ? "File d'attente : " + queue.length + " album" + (queue.length > 1 ? "s" : "") + " à venir" : "File d'attente";

    renderProgress();
    if (panel && !panel.hidden) renderPanel();
  }

  function renderProgress() {
    if (!mp || mp.hidden) return;
    const dur = duration();
    mp.querySelector(".mp-fill").style.width = (dur ? Math.min(100, audio.currentTime / dur * 100) : 0) + "%";
    mp.querySelector(".mp-bar").title = mmss(audio.currentTime) + " / " + mmss(dur);
    mp.querySelector(".mp-cur").textContent = mmss(audio.currentTime);
    mp.querySelector(".mp-dur").textContent = mmss(dur);
  }

  // ---------- Panneau « file d'attente » ----------

  function buildPanel() {
    panel = el("div", "mq");
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "File d'attente");
    panel.innerHTML =
      '<div class="mq-head"><span class="mq-title">File d\'attente</span>' +
      '<button type="button" class="mq-clear">Vider</button></div>' +
      '<p class="mq-sum"></p><div class="mq-list"></div>';
    panel.querySelector(".mq-clear").addEventListener("click", clearQueue);
    document.body.appendChild(panel);
    document.addEventListener("pointerdown", e => {
      if (!panel.hidden && !panel.contains(e.target) && !mp.querySelector(".mp-queue").contains(e.target)) panelOpen(false);
    });
  }

  function panelOpen(open) {
    if (!panel) return;
    panel.hidden = !open;
    if (mp) mp.querySelector(".mp-queue").classList.toggle("is-on", open);
    if (open) renderPanel();
  }

  function row(a, opts) {
    const r = el("div", "mq-item" + (opts.current ? " is-current" : ""));
    if (!opts.current) {
      r.draggable = true;
      r.dataset.index = opts.index;
      r.appendChild(el("span", "mq-grip", "⋮⋮"));
    } else {
      r.appendChild(el("span", "mq-grip mq-eq"));
    }
    const img = el("span", "mq-thumb");
    const src = coverSrc(a, 100);
    if (src) { const i = el("img"); i.src = src; i.alt = ""; i.onerror = () => i.remove(); img.appendChild(i); }
    const text = el("a", "mq-text");
    frameLink(text, albumUrl(a.id || a.albumId));
    text.append(el("span", "mq-name", a.title), el("span", "mq-art", a.artist));
    r.append(img, text, el("span", "mq-dur", opts.time));
    if (!opts.current) {
      const x = el("button", "mq-x", "×");
      x.type = "button";
      x.title = "Retirer de la file";
      x.setAttribute("aria-label", "Retirer " + a.title + " de la file");
      x.addEventListener("click", () => removeFromQueue(a.id));
      r.appendChild(x);
    }
    return r;
  }

  let dragFrom = -1;

  function renderPanel() {
    const list = panel.querySelector(".mq-list");
    const items = [];
    let remaining = 0, total = 0;

    if (state) {
      const curLen = state.tracks.reduce((s, t) => s + (t.duration || 0), 0);
      const done = state.tracks.slice(0, state.index).reduce((s, t) => s + (t.duration || 0), 0) + (audio.currentTime || 0);
      const left = Math.max(0, curLen - done);
      total += curLen;
      remaining += left;
      items.push(el("p", "mq-label", "En cours"));
      items.push(row(Store.get(state.albumId) || state, { current: true, time: "reste " + hm(left) }));
    }

    items.push(el("p", "mq-label", "Suite"));
    const albums = queue.map(id => Store.get(id)).filter(Boolean);
    if (!albums.length) {
      items.push(el("p", "mq-empty", "Ajoutez des albums avec « + file d'attente » sur leur page."));
    }
    albums.forEach((a, i) => {
      const len = albumLength(a);
      total += len;
      remaining += len;
      items.push(row(a, { index: i, time: len ? hm(len) : "" }));
    });

    list.replaceChildren(...items);
    panel.querySelector(".mq-sum").textContent = "Total " + hm(total) + " · restant " + hm(remaining);
    panel.querySelector(".mq-clear").hidden = !albums.length;

    // Glisser-déposer pour réordonner
    list.querySelectorAll(".mq-item[draggable]").forEach(r => {
      r.addEventListener("dragstart", e => {
        dragFrom = Number(r.dataset.index);
        r.classList.add("is-dragging");
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", String(dragFrom)); } catch (err) {}
      });
      r.addEventListener("dragend", () => r.classList.remove("is-dragging"));
      r.addEventListener("dragover", e => { e.preventDefault(); r.classList.add("is-over"); });
      r.addEventListener("dragleave", () => r.classList.remove("is-over"));
      r.addEventListener("drop", e => {
        e.preventDefault();
        r.classList.remove("is-over");
        moveInQueue(dragFrom, Number(r.dataset.index));
      });
    });
  }

  document.addEventListener("playback:change", render);
  document.addEventListener("albums:changed", () => { if (mp && !mp.hidden) render(); });
  window.addEventListener("storage", e => { if (e.key === "conductor01.albums" && mp && !mp.hidden) render(); });
  document.addEventListener("DOMContentLoaded", () => { build(); render(); });

  // Après un clic sur le mini-lecteur, le clavier revient à la page (raccourcis)
  document.addEventListener("click", () => {
    const f = frame();
    if (f) setTimeout(() => { try { f.contentWindow.focus(); } catch (e) {} }, 0);
  });

  window.Playback = {
    audio,
    playAlbum, toggle, next, prev, seek, duration, close,
    addToQueue, removeFromQueue, moveInQueue, clearQueue, playId,
    queue: () => queue.slice(),
    inQueue: id => queue.includes(id),
    state: () => state,
    isAlbum: id => !!state && state.albumId === id,
    index: () => (state ? state.index : -1)
  };

  // =====================================================================
  // Relais dans une page du cadre : même API, commandes envoyées au moteur
  // =====================================================================

  function frameRelay() {
    let mirror = { state: null, queue: [], time: { currentTime: 0, duration: 0, paused: true, seeking: false } };

    function cmd(name) {
      const args = Array.prototype.slice.call(arguments, 1);
      parent.postMessage({ conductor: true, type: "cmd", name, args }, "*");
    }

    // Faux élément audio : les pages lisent currentTime / paused et écoutent
    // timeupdate, play, pause, loadedmetadata comme avant.
    const audio = new EventTarget();
    let vol = 1, muted = false;
    Object.defineProperties(audio, {
      currentTime: { get: () => mirror.time.currentTime },
      duration: { get: () => mirror.time.duration || NaN },
      paused: { get: () => mirror.time.paused },
      seeking: { get: () => mirror.time.seeking },
      volume: { get: () => vol, set: v => { vol = v; cmd("volume", vol, muted); } },
      muted: { get: () => muted, set: m => { muted = !!m; cmd("volume", vol, muted); } }
    });

    window.addEventListener("message", e => {
      if (e.source !== parent || !e.data || !e.data.conductor) return;
      const d = e.data;
      if (d.type === "state") {
        const wasPaused = mirror.time.paused;
        mirror = { state: d.state, queue: d.queue || [], time: d.time };
        if (wasPaused !== d.time.paused) audio.dispatchEvent(new Event(d.time.paused ? "pause" : "play"));
        audio.dispatchEvent(new Event("timeupdate"));
        document.dispatchEvent(new CustomEvent("playback:change"));
      } else if (d.type === "time") {
        const wasPaused = mirror.time.paused;
        mirror.time = d.time;
        if (wasPaused !== d.time.paused) {
          audio.dispatchEvent(new Event(d.time.paused ? "pause" : "play"));
          document.dispatchEvent(new CustomEvent("playback:change"));
        }
        audio.dispatchEvent(new Event(d.event || "timeupdate"));
      } else if (d.type === "mini") {
        const apply = () => document.body && document.body.classList.toggle("has-mini-player", !!d.visible);
        document.body ? apply() : document.addEventListener("DOMContentLoaded", apply);
      }
    });

    // Signale la page affichée (adresse, titre, album) à l'enveloppe
    function announce() {
      const root = new URL(ROOT_OF_PAGE(), location.href).href;
      const path = location.href.split("#")[0].slice(root.length) || "index.html";
      const albumId = /\/pages\/album\.html$/.test(location.pathname)
        ? new URLSearchParams(location.search).get("id") : null;
      parent.postMessage({ conductor: true, type: "page", path, albumId, title: document.title }, "*");
    }
    function ROOT_OF_PAGE() {
      return (typeof APP_ROOT !== "undefined" && APP_ROOT) || "./";
    }
    announce();
    document.addEventListener("DOMContentLoaded", () => {
      announce();
      const t = document.querySelector("title");
      if (t) new MutationObserver(announce).observe(t, { childList: true, characterData: true, subtree: true });
    });
    // Adresse modifiée sans recharger (pagination, recherche…)
    ["pushState", "replaceState"].forEach(k => {
      const orig = history[k];
      history[k] = function () { const r = orig.apply(this, arguments); announce(); return r; };
    });

    if (window.Volume) Volume.attach(audio);

    const api = {
      audio,
      playAlbum: (meta, tracks, index) => cmd("playAlbum", meta, tracks, index),
      toggle: () => cmd("toggle"),
      next: () => cmd("next"),
      prev: () => cmd("prev"),
      seek: sec => cmd("seek", sec),
      duration: () => mirror.time.duration || 0,
      close: () => cmd("close"),
      addToQueue: id => { if (!mirror.queue.includes(id)) mirror.queue.push(id); cmd("addToQueue", id); },
      removeFromQueue: id => { mirror.queue = mirror.queue.filter(x => x !== id); cmd("removeFromQueue", id); },
      moveInQueue: (a, b) => cmd("moveInQueue", a, b),
      clearQueue: () => cmd("clearQueue"),
      playId: id => cmd("playId", id),
      queue: () => mirror.queue.slice(),
      inQueue: id => mirror.queue.includes(id),
      state: () => mirror.state,
      isAlbum: id => !!mirror.state && mirror.state.albumId === id,
      index: () => (mirror.state ? mirror.state.index : -1)
    };
    window.Playback = api;

    // Raccourcis clavier hors page album (Espace, ← →) : le mini-lecteur
    if (!window.Player) {
      window.Player = {
        toggle: api.toggle, next: api.next, prev: api.prev,
        active: () => !!mirror.state,
        hasAudio: () => !!mirror.state
      };
    }
  }
})();
