// conductor. — lien avec la télécommande (tools/remote/relay.js)
//
// Dans l'enveloppe (conductor.html) : se connecte au relais du PC (ws://127.0.0.1:8765)
// s'il tourne, lui envoie l'état du lecteur à chaque changement, et exécute les
// commandes du téléphone (lecture / pause, titre, ★, volume de l'appli).
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
    send();
  }

  // ---------- Connexion au relais ----------

  function connect() {
    clearTimeout(timer);
    try { ws = new WebSocket("ws://127.0.0.1:" + PORT + "/ws?role=host"); }
    catch (e) { retry(); return; }
    ws.onopen = () => { wait = 3000; send(); };
    ws.onmessage = e => {
      let m = null;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.type === "cmd") run(m.name, m.value);
      else if (m.type === "relay") {
        const n = (m.remotes || []).length;
        if (!lastPin) flash("Télécommande prête · icône téléphone du pied de page pour le QR code", 4000);
        else if (n > lastRemotes) flash("Télécommande connectée : " + m.remotes[n - 1], 3500);
        lastPin = m.pin;
        lastRemotes = n;
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

  let dlg = null, addrIndex = 0, startedAt = 0, startTimer = 0;
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
  document.addEventListener("playback:change", send);
  document.addEventListener("albums:changed", send);
  window.addEventListener("storage", e => { if (e.key === VOL_KEY) send(); });
  ["play", "pause", "seeked", "volumechange"].forEach(ev => Playback.audio.addEventListener(ev, send));
  setInterval(() => { if (ws && ws.readyState === 1 && !Playback.audio.paused) send(); }, 10000);   // recalage de la position

  // Pages du cadre : icône du pied de page → { type: "cmd", name: "remotePanel" }
  window.addEventListener("message", e => {
    const d = e.data;
    if (d && d.conductor && d.type === "cmd" && d.name === "remotePanel") openPanel();
  });
  window.RemotePanel = { open: openPanel };

  connect();
})();
