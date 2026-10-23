// conductor. — lien avec la télécommande (tools/remote/relay.js)
//
// Dans l'enveloppe (conductor.html) : se connecte au relais du PC (ws://127.0.0.1:8765)
// s'il tourne, lui envoie l'état du lecteur à chaque changement, et exécute les
// commandes du téléphone (lecture / pause, titre, ★, volume de l'appli).
// Paroles du morceau en cours (js/karaoke.js : enregistrées, fichiers, LRCLIB) envoyées
// une fois par morceau, seulement si un téléphone est connecté.
// Relais absent : nouvel essai de temps en temps, sans rien afficher.
//
// Fenêtre « Télécommande » (icône téléphone du pied de page) : démarrer le relais
// (lien conductor-remote://, installé une fois par tools/remote/install-button.bat),
// QR code à scanner avec le téléphone, code, téléphones connectés, arrêter.

(function () {
  if (window.top !== window || typeof Playback === "undefined" || !("WebSocket" in window)) return;
  const PORT = 8765;
  const VOL_KEY = "conductor01.volume";

  let ws = null, wait = 3000, timer = 0, lastPin = "", lastRemotes = 0;
  let info = null;            // dernières infos du relais (code, clé, adresses, téléphones)

  function flash(text, ms) {
    let box = document.getElementById("kb-flash");
    if (!box) {
      box = document.createElement("div");
      box.id = "kb-flash";
      box.className = "kb-flash";
      box.setAttribute("role", "status");
      document.body.appendChild(box);
    }
    box.textContent = text;
    box.classList.add("is-on");
    clearTimeout(flash.t);
    flash.t = setTimeout(() => box.classList.remove("is-on"), ms || 3500);
  }

  // ---------- Volume de l'appli (0..20, comme js/volume.js) ----------

  function readVol() {
    try { const v = JSON.parse(localStorage.getItem(VOL_KEY) || "null"); if (v && Number.isFinite(v.level)) return v; } catch (e) {}
    return { level: 14, lastAudible: 14 };
  }
  function setVol(level) {
    level = Math.max(0, Math.min(20, Math.round(level)));
    const v = readVol();
    v.level = level;
    if (level > 0) v.lastAudible = level;
    try { localStorage.setItem(VOL_KEY, JSON.stringify(v)); } catch (e) {}   // les pages suivent (événement storage)
    Playback.audio.volume = Math.pow(level / 20, 2);
    if (level > 0) Playback.audio.muted = false;
    send();
  }

  // ---------- État envoyé au téléphone ----------

  function coverSrc(st) {
    const a = typeof Store !== "undefined" ? Store.get(st.albumId) : null;
    const cover = (a && a.cover) || st.cover || "";
    if (cover && !/^(blob|data):/.test(cover)) return cover;       // ../datastorage/covers/… ou http(s)
    const server = (a && a.serverCover) || st.serverCover;
    if (server && typeof Server !== "undefined" && Server.isConfigured()) return Server.coverUrl(server, 600);
    if (a && a.coverRemote && /^https?:/.test(a.coverRemote)) return a.coverRemote;
    return "";
  }

  function snapshot() {
    const st = Playback.state();
    if (!st || !st.tracks || !st.tracks[st.index]) return null;
    const t = st.tracks[st.index];
    const a = typeof Store !== "undefined" ? Store.get(st.albumId) : null;
    const audio = Playback.audio;
    return {
      albumId: st.albumId,
      album: (a && a.title) || st.title || "",
      year: (a && a.year) || "",
      artist: (a && a.artist) || st.artist || "",
      track: t.title || "",
      index: st.index,
      count: st.tracks.length,
      duration: (Playback.duration && Playback.duration()) || t.duration || 0,
      time: audio.currentTime || st.time || 0,
      playing: !audio.paused,
      starred: Playback.starred ? Playback.starred() : false,
      volume: readVol().level,
      muted: !!audio.muted,
      coverSrc: coverSrc(st)
    };
  }

  let sendTimer = 0;
  function send() {
    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "state", state: snapshot() }));
    }, 60);
  }

  // ---------- Paroles du morceau en cours ----------

  let lyKey = "", lySent = "";
  function lyricsInfo() {
    const st = Playback.state();
    const t = st && st.tracks && st.tracks[st.index];
    if (!t) return null;
    const a = typeof Store !== "undefined" ? Store.get(st.albumId) : null;
    // Mêmes infos que le karaoké du PC (js/playback.js) : même cache, même résultat
    return { albumId: st.albumId, artist: st.artist, album: (a && a.title) || st.title,
      title: t.title, duration: t.duration || (Playback.duration && Playback.duration()) || 0, src: t.src };
  }
  function sendLyrics(force) {
    if (!(ws && ws.readyState === 1) || !lastRemotes || typeof Karaoke === "undefined") return;
    const info = lyricsInfo();
    if (!info) return;
    const key = info.albumId + "|" + info.title;
    if (key !== lyKey || force) {
      lyKey = key;
      lySent = "";
      ws.send(JSON.stringify({ type: "lyrics", lyrics: { key, status: "loading" } }));
    }
    Karaoke.find(info).then(res => {
      if (key !== lyKey || !(ws && ws.readyState === 1)) return;
      const out = res && res.lines && res.lines.length
        ? { key, status: "synced", lines: res.lines.map(l => ({ t: Math.round(l.t * 100) / 100, text: l.text || "" })), source: res.source || "" }
        : res && res.plain ? { key, status: "plain", plain: res.plain, source: res.source || "" }
        : res && res.instrumental ? { key, status: "instrumental" }
        : { key, status: "none" };
      const json = JSON.stringify(out);
      if (json === lySent) return;
      lySent = json;
      ws.send(JSON.stringify({ type: "lyrics", lyrics: out }));
    }).catch(() => {
      if (key === lyKey && ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "lyrics", lyrics: { key, status: "offline" } }));
    });
  }

  // ---------- File d'attente (albums à suivre) ----------

  let queueSent = "";
  function sendQueue(force) {
    if (!(ws && ws.readyState === 1) || !lastRemotes) return;
    const items = Playback.queue().map(qid => {
      const a = typeof Store !== "undefined" ? Store.get(qid) : null;
      if (!a) return { id: qid, title: "(album retiré)", artist: "", year: "", duration: 0, coverSrc: "" };
      return { id: a.id, title: a.title, artist: a.artist, year: a.year || "",
        duration: a.duration || (a.tracks || []).reduce((s, t) => s + (t.duration || 0), 0) || 0,
        coverSrc: coverSrc({ albumId: a.id, cover: a.cover, serverCover: a.serverCover }) };
    });
    const json = JSON.stringify(items);
    if (json === queueSent && !force) return;
    queueSent = json;
    ws.send(JSON.stringify({ type: "queue", queue: items }));
  }

  // Commandes de la file : { i: position, id } (l'id vérifie qu'on parle du même album)
  function queueAt(v) {
    const q = Playback.queue();
    const i = v && Number.isInteger(v.i) ? v.i : -1;
    return i >= 0 && q[i] === (v && v.id) ? i : -1;
  }

  // ---------- Thoughts de l'album en cours (réflexions datées, comme sur la page album) ----------

  let thSent = "";
  function sendThoughts(force) {
    if (!(ws && ws.readyState === 1) || !lastRemotes) return;
    const st = Playback.state();
    const a = st && typeof Store !== "undefined" ? Store.get(st.albumId) : null;
    const out = a ? { albumId: a.id, album: a.title, list: (a.thoughts || []).slice().sort((x, y) => y.at.localeCompare(x.at)) } : null;
    const json = JSON.stringify(out);
    if (json === thSent && !force) return;
    thSent = json;
    ws.send(JSON.stringify({ type: "thoughts", thoughts: out }));
  }
  function addThought(v) {
    const st = Playback.state();
    const text = String((v && v.text) || "").trim().slice(0, 5000);
    const a = v && Store.get(v.albumId);
    if (!text || !a) return;
    const t = { id: "t" + Date.now().toString(36), at: new Date().toISOString(), text, from: "téléphone" };
    // Le morceau et la seconde, si cet album joue (comme sur la page album)
    if (st && st.albumId === a.id && st.tracks[st.index]) {
      t.moment = { index: st.index, title: st.tracks[st.index].title || "", time: Math.round(Playback.audio.currentTime || 0) };
    }
    Store.update(a.id, { thoughts: (a.thoughts || []).concat(t) });
    flash("Thought ajoutée depuis le téléphone : " + a.title, 3000);
  }
  function editThought(v) {
    const a = v && Store.get(v.albumId);
    const text = String((v && v.text) || "").trim().slice(0, 5000);
    if (!a || !text) return;
    const list = a.thoughts || [];
    if (!list.some(t => t.id === v.id && t.text !== text)) { sendThoughts(true); return; }
    Store.update(a.id, { thoughts: list.map(t => t.id === v.id ? Object.assign({}, t, { text, edited: new Date().toISOString() }) : t) });
    flash("Thought modifiée depuis le téléphone : " + a.title, 3000);
  }
  function deleteThought(v) {
    const a = v && Store.get(v.albumId);
    if (!a) return;
    const list = (a.thoughts || []).filter(t => t.id !== v.id);
    Store.update(a.id, { thoughts: list.length ? list : null });
  }

  // ---------- Catalogue : recherche dans la collection ----------
  // Un seul champ : titre, artiste, genre, styles, ressenti, famille, label, année, tags.
  // Tous les mots doivent être trouvés (« radiohead 1997 », « jazz modal »).

  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  function search(v) {
    const q = norm(v && v.q).trim();
    const words = q.split(/\s+/).filter(Boolean);
    let items = [];
    if (words.length && typeof Store !== "undefined") {
      const scored = [];
      Store.raw().forEach(a => {
        if (a.nextUp) return;
        const title = norm(a.title), artist = norm(a.artist);
        const extra = norm([a.genre, (a.styles || []).join(" "), (a.moods || []).join(" "), (a.tags || []).join(" "),
          typeof familyOf === "function" ? familyOf(a) : "", a.label, a.year].join(" "));
        const hay = title + " " + artist + " " + extra;
        if (!words.every(w => hay.includes(w))) return;
        // Pertinence : titre, puis artiste, puis le reste
        let score = 0;
        if (title === q || artist === q) score += 100;
        if (title.startsWith(q)) score += 40;
        if (artist.startsWith(q)) score += 30;
        words.forEach(w => { if (title.includes(w)) score += 10; else if (artist.includes(w)) score += 8; else score += 2; });
        scored.push({ a, score });
      });
      scored.sort((x, y) => y.score - x.score || norm(x.a.artist).localeCompare(norm(y.a.artist)) || (x.a.year || 0) - (y.a.year || 0));
      items = scored.slice(0, 40).map(({ a }) => ({
        id: a.id, title: a.title, artist: a.artist, year: a.year || "", genre: a.genre || "",
        coverSrc: coverSrc({ albumId: a.id, cover: a.cover, serverCover: a.serverCover })
      }));
    }
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "results", id: v && v.id, q: (v && v.q) || "", items }));
  }

  // ---------- Commandes du téléphone ----------

  function run(name, value) {
    const st = Playback.state();
    if (name === "toggle") { if (st) Playback.toggle(); }
    else if (name === "next") { if (st) Playback.next(); }
    else if (name === "prev") { if (st) Playback.prev(); }
    else if (name === "star") { if (st && Playback.star) Playback.star(); }
    else if (name === "volume") setVol(Number(value));
    else if (name === "volumeStep") setVol(readVol().level + Number(value || 0));
    else if (name === "mute") { Playback.audio.muted = !Playback.audio.muted; }
    else if (name === "seek") { if (st && Number.isFinite(Number(value))) Playback.seek(Number(value)); }
    else if (name === "thoughtAdd") addThought(value);
    else if (name === "search") { search(value); return; }
    else if (name === "playAlbum") {
      // Lancer un album du catalogue : remplace l'album en cours, la file est gardée
      if (value && Store.get(value.id)) Playback.playId(value.id, !!Playback.state());
    }
    else if (name === "queueAlbum") { if (value && Store.get(value.id)) Playback.addToQueue(value.id); }
    else if (name === "thoughtDelete") deleteThought(value);
    else if (name === "thoughtEdit") editThought(value);
    else if (name === "queuePlay") {
      // Lancer tout de suite un album de la file : retiré de sa place, le reste est gardé
      const i = queueAt(value);
      if (i >= 0) { Playback.removeFromQueue(value.id, i); Playback.playId(value.id, true); }
    }
    else if (name === "queueRemove") { const i = queueAt(value); if (i >= 0) Playback.removeFromQueue(value.id, i); }
    else if (name === "queueMove") {
      const i = queueAt(value);
      if (i >= 0 && Number.isInteger(value.to)) Playback.moveInQueue(i, value.to);
    }
    else if (name === "queueClear") Playback.clearQueue();
    send();
  }

  // ---------- Connexion au relais ----------

  function connect() {
    clearTimeout(timer);
    try { ws = new WebSocket("ws://127.0.0.1:" + PORT + "/ws?role=host"); }
    catch (e) { retry(); return; }
    ws.onopen = () => { wait = 3000; lyKey = ""; queueSent = ""; thSent = ""; send(); };
    ws.onmessage = e => {
      let m = null;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.type === "cmd") run(m.name, m.value);
      else if (m.type === "relay") {
        const n = (m.remotes || []).length;
        if (!lastPin) flash("Télécommande prête · icône téléphone du pied de page pour le QR code", 4000);
        else if (n > lastRemotes) flash("Télécommande connectée : " + m.remotes[n - 1], 3500);
        const more = n > lastRemotes;
        lastPin = m.pin;
        lastRemotes = n;
        if (more) { sendLyrics(true); sendQueue(true); sendThoughts(true); }   // nouveau téléphone : paroles, file, thoughts
        info = m;
        renderPanel();
      }
    };
    ws.onclose = () => { ws = null; info = null; lastPin = ""; lastRemotes = 0; renderPanel(); retry(); };
    ws.onerror = () => {};
  }
  function retry() {
    clearTimeout(timer);
    timer = setTimeout(connect, wait);
    wait = Math.min(wait * 1.6, 30000);
  }

  // ---------- Fenêtre « Télécommande » ----------

  let dlg = null, addrIndex = -1, startedAt = 0, startTimer = 0;   // -1 : onglet Tailscale par défaut
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const connected = () => !!(ws && ws.readyState === 1 && info);

  function openPanel() {
    if (!dlg) {
      dlg = el("dialog", "modal rm-dialog");
      dlg.setAttribute("aria-labelledby", "rm-title");
      dlg.innerHTML = '<div class="modal-head"><h2 class="modal-title" id="rm-title">Télécommande</h2>' +
        '<button type="button" class="icon-btn" id="rm-close" aria-label="Fermer">×</button></div>' +
        '<div class="modal-step" id="rm-body"></div>';
      document.body.appendChild(dlg);
      dlg.querySelector("#rm-close").addEventListener("click", () => dlg.close());
      dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
    }
    addrIndex = -1;   // à chaque ouverture : Tailscale (s'il est là)
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "info" }));
    else { clearTimeout(timer); wait = 3000; connect(); }
    renderPanel();
    if (!dlg.open) dlg.showModal();
  }

  function startRelay() {
    startedAt = Date.now();
    // Lien vers le programme du PC : Chrome demande une confirmation (cocher « toujours autoriser »)
    const a = document.createElement("a");
    a.href = "conductor-remote://start";
    document.body.appendChild(a);
    a.click();
    a.remove();
    renderPanel();
    // Le relais met une seconde ou deux à démarrer : on essaie de s'y relier plus souvent
    clearInterval(startTimer);
    startTimer = setInterval(() => {
      if (connected() || Date.now() - startedAt > 15000) { clearInterval(startTimer); renderPanel(); return; }
      if (!ws) { clearTimeout(timer); connect(); }
    }, 1000);
  }

  function renderPanel() {
    if (!dlg) return;
    const body = dlg.querySelector("#rm-body");
    body.replaceChildren();
    if (!connected()) {
      const waiting = Date.now() - startedAt < 15000;
      body.append(el("p", "rm-lead", waiting ? "Démarrage du relais…" : "Le relais de la télécommande ne tourne pas sur ce PC."));
      const go = el("button", "btn", "Démarrer la télécommande");
      go.type = "button";
      go.disabled = waiting;
      go.addEventListener("click", startRelay);
      body.append(go);
      const help = el("p", "hint rm-help");
      help.innerHTML = startedAt && !waiting
        ? "Rien ne s'est lancé ? Une installation est nécessaire <b>une fois</b> : double-clic sur <code>app\\tools\\remote\\install-button.bat</code> (Linux : <code>install-linux.sh</code>), puis réessayez. Node.js doit être installé (<code>winget install OpenJS.NodeJS.LTS</code>)."
        : "Chrome demande la première fois d'ouvrir « conductor-remote » : cochez <b>Toujours autoriser</b>. Ou lancez <code>start-remote.bat</code> à la main.";
      body.append(help);
      return;
    }

    const list = (info.addresses || []).filter(a => a.url);
    if (!list.length) {
      body.append(el("p", "rm-lead", "Ce PC n'est relié à aucun réseau (wifi, partage de connexion ou Tailscale)."));
    } else {
      if (addrIndex < 0) addrIndex = Math.max(0, list.findIndex(x => x.tailscale));
      addrIndex = Math.min(addrIndex, list.length - 1);
      const a = list[addrIndex];
      const url = a.url + "/#k=" + info.key;
      const wrap = el("div", "rm-qr");
      try { wrap.innerHTML = QR.svg(url, { size: 220 }); } catch (e) { wrap.textContent = url; }
      body.append(el("p", "rm-lead", "Scannez avec l'appareil photo du téléphone :"), wrap);
      if (list.length > 1) {
        const tabs = el("div", "rm-tabs");
        list.forEach((x, i) => {
          const b = el("button", "rm-tab" + (i === addrIndex ? " is-on" : ""), x.label);
          b.type = "button";
          b.title = x.url;
          b.addEventListener("click", () => { addrIndex = i; renderPanel(); });
          tabs.append(b);
        });
        body.append(tabs);
      }
      const line = el("p", "rm-url");
      line.append(el("code", null, a.url), document.createTextNode("  ·  code "), el("b", null, info.pin));
      body.append(line);
      body.append(el("p", "hint", a.tailscale
        ? "Tailscale : le téléphone peut être en 4G ou sur n'importe quel wifi (appli Tailscale activée, même compte)."
        : "Le téléphone doit être sur le même réseau que le PC. En 4G ou ailleurs : Tailscale (voir le manuel)."));
    }
    const phones = info.remotes || [];
    body.append(el("p", "rm-phones", phones.length ? "Connecté : " + phones.join(", ") : "Aucun téléphone connecté pour l'instant."));

    const actions = el("div", "rm-actions");
    const renew = el("button", "btn btn-ghost btn-small", "Nouveau code");
    renew.type = "button";
    renew.title = "Change le code et le QR code ; les téléphones déjà appairés devront le refaire";
    renew.addEventListener("click", () => {
      if (renew.dataset.armed) { ws.send(JSON.stringify({ type: "new-pairing" })); return; }
      renew.dataset.armed = "1";
      renew.textContent = "Oublier les téléphones ?";
      setTimeout(() => { if (renew.isConnected) { delete renew.dataset.armed; renew.textContent = "Nouveau code"; } }, 3000);
    });
    const stop = el("button", "btn btn-ghost btn-small", "Arrêter le relais");
    stop.type = "button";
    stop.addEventListener("click", () => { startedAt = 0; ws.send(JSON.stringify({ type: "quit" })); });
    actions.append(renew, stop);
    body.append(actions);
  }

  // Changements côté PC → téléphone, aussitôt
  document.addEventListener("playback:change", () => { send(); sendLyrics(); sendQueue(); sendThoughts(); });
  document.addEventListener("albums:changed", () => { sendQueue(); sendThoughts(); });
  document.addEventListener("albums:changed", send);
  window.addEventListener("storage", e => { if (e.key === VOL_KEY) send(); });
  ["play", "pause", "seeking", "loadedmetadata"].forEach(ev => Playback.audio.addEventListener(ev, send));
  // Position précise pour les paroles : envoyée chaque seconde pendant la lecture (message léger)
  setInterval(() => {
    if (!(ws && ws.readyState === 1) || !lastRemotes || Playback.audio.paused || !Playback.state()) return;
    ws.send(JSON.stringify({ type: "time", time: Playback.audio.currentTime || 0 }));
  }, 1000);
  setInterval(() => { if (ws && ws.readyState === 1 && !Playback.audio.paused) send(); }, 10000);   // recalage complet

  // Pages du cadre : icône du pied de page → { type: "cmd", name: "remotePanel" }
  window.addEventListener("message", e => {
    const d = e.data;
    if (d && d.conductor && d.type === "cmd" && d.name === "remotePanel") openPanel();
  });
  window.RemotePanel = { open: openPanel };

  connect();
})();
