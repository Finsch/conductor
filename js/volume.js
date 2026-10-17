// conductor. — volume du lecteur (0 à 20)
//
// - Volume de l'APPLI : il s'applique au lecteur du site, à tous les morceaux
//   (aperçus Deezer comme fichiers du serveur). Il ne touche ni le volume de
//   Windows / de la sortie audio, ni un réglage propre à un morceau.
// - Mémorisé (localStorage) : le dernier volume choisi est repris à la
//   prochaine visite. La coupure du son (M), elle, ne survit pas au rechargement.
// - Couper le son garde le niveau : M le rétablit tel quel.
//   Après « 0 », M remet le dernier niveau audible.
// - Deux affichages :
//     · réglette verticale à droite de l'écran, le temps d'un réglage au clavier ;
//     · réglage fixe dans le pied de page (icône, barre, niveau).

(function () {
  const KEY = "conductor01.volume";
  const MAX = 20;
  const HIDE_AFTER = 1400;   // ms sans réglage avant de masquer la réglette

  let level = 14;            // 0..20
  let lastAudible = 14;      // pour rétablir après « 0 »
  let muted = false;
  const players = [];
  const boxes = [];          // réglette + réglage du pied de page

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && Number.isFinite(saved.level)) {
      level = clamp(saved.level);
      lastAudible = clamp(saved.lastAudible || level) || 14;
    }
  } catch (e) { /* stockage indisponible : valeurs par défaut */ }

  function clamp(n) {
    return Math.max(0, Math.min(MAX, Math.round(n)));
  }

  function store() {
    try { localStorage.setItem(KEY, JSON.stringify({ level, lastAudible })); } catch (e) {}
  }

  // Courbe au carré : l'oreille perçoit le volume de façon logarithmique,
  // chaque cran sonne ainsi comme un pas régulier.
  function gain() {
    return Math.pow(level / MAX, 2);
  }

  function apply() {
    players.forEach(a => {
      a.volume = gain();
      a.muted = muted;
    });
    render();
  }

  // ---------- Actions ----------
  // osd : afficher la réglette (raccourcis clavier) ; pas pour le réglage du pied de page

  function set(n, osd = true) {
    level = clamp(n);
    if (level > 0) lastAudible = level;
    muted = false;              // régler le volume rétablit le son
    store();
    apply();
    if (osd) show();
  }

  function up(osd = true) { set(level + 1, osd); }
  function down(osd = true) { set(level - 1, osd); }
  function zero() { set(0); }
  function max() { set(MAX); }

  function toggleMute(osd = true) {
    if (level === 0) {
      // « 0 » puis M : on remet le dernier niveau audible
      set(lastAudible || 14, osd);
      return;
    }
    muted = !muted;
    apply();
    if (osd) show();
  }

  function attach(audio) {
    players.push(audio);
    audio.volume = gain();
    audio.muted = muted;
  }

  // ---------- Icônes ----------

  const ICONS = {
    on: '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none"/>',
    low: '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6" fill="none"/>',
    off: '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none"/>'
  };

  function iconName() {
    if (muted || level === 0) return "off";
    return level <= MAX / 2 ? "low" : "on";
  }

  function icon(name) {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  // ---------- Barre (verticale ou horizontale), glisser + clavier ----------

  function makeBar(vertical, osd) {
    const bar = document.createElement("div");
    bar.className = "vol-bar" + (vertical ? " vol-bar-v" : "");
    bar.tabIndex = 0;
    bar.setAttribute("role", "slider");
    bar.setAttribute("aria-label", "Volume");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", String(MAX));
    if (vertical) bar.setAttribute("aria-orientation", "vertical");
    bar.innerHTML = '<span class="vol-fill"></span>';

    function fromPointer(e) {
      const r = bar.getBoundingClientRect();
      const ratio = vertical ? (r.bottom - e.clientY) / r.height : (e.clientX - r.left) / r.width;
      set(Math.max(0, Math.min(1, ratio)) * MAX, osd);
    }
    bar.addEventListener("pointerdown", e => {
      e.preventDefault();
      bar.setPointerCapture(e.pointerId);
      bar.classList.add("is-dragging");
      fromPointer(e);
    });
    bar.addEventListener("pointermove", e => { if (bar.hasPointerCapture(e.pointerId)) fromPointer(e); });
    bar.addEventListener("pointerup", () => bar.classList.remove("is-dragging"));
    bar.addEventListener("keydown", e => {
      const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (step) { e.preventDefault(); set(level + step, osd); }
      else if (e.key === "Home") { e.preventDefault(); set(0, osd); }
      else if (e.key === "End") { e.preventDefault(); set(MAX, osd); }
    });
    bar.addEventListener("wheel", e => { e.preventDefault(); set(level + (e.deltaY < 0 ? 1 : -1), osd); }, { passive: false });
    return bar;
  }

  // ---------- Réglette verticale (à droite, temporaire) ----------

  let osdEl = null, hideTimer = null, hovering = false;

  function buildOsd() {
    osdEl = document.createElement("div");
    osdEl.className = "volume-osd";
    osdEl.hidden = true;
    osdEl.innerHTML = '<span class="vol-value"></span>';
    osdEl.appendChild(makeBar(true, true));
    const mute = document.createElement("button");
    mute.type = "button";
    mute.className = "vol-icon";
    mute.addEventListener("click", () => toggleMute(true));
    osdEl.appendChild(mute);
    boxes.push(osdEl);
    osdEl.addEventListener("pointerenter", () => { hovering = true; show(); });
    osdEl.addEventListener("pointerleave", () => { hovering = false; show(); });
    document.body.appendChild(osdEl);
  }

  function show() {
    if (!osdEl) buildOsd();
    render();
    osdEl.hidden = false;
    osdEl.classList.remove("is-leaving");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function hide() {
      if (hovering) return show();
      osdEl.classList.add("is-leaving");
      hideTimer = setTimeout(() => { osdEl.hidden = true; }, 200);
    }, HIDE_AFTER);
  }

  // ---------- Réglage fixe (pied de page) ----------

  function mountFooter(slot) {
    const box = document.createElement("div");
    box.className = "footer-volume";
    const mute = document.createElement("button");
    mute.type = "button";
    mute.className = "vol-icon";
    mute.addEventListener("click", () => toggleMute(false));
    const value = document.createElement("span");
    value.className = "vol-value";
    box.append(mute, makeBar(false, false), value);
    slot.appendChild(box);
    boxes.push(box);
    render();
  }

  // ---------- Affichage ----------

  function render() {
    const name = iconName();
    boxes.forEach(box => {
      box.classList.toggle("is-muted", muted);
      box.querySelector(".vol-value").textContent = level;
      const fill = box.querySelector(".vol-fill");
      const bar = box.querySelector(".vol-bar");
      const pct = (level / MAX) * 100 + "%";
      bar.classList.contains("vol-bar-v") ? (fill.style.height = pct) : (fill.style.width = pct);
      bar.setAttribute("aria-valuenow", String(level));
      bar.setAttribute("aria-valuetext", muted ? "muet" : level + " sur " + MAX);
      const btn = box.querySelector(".vol-icon");
      if (btn.dataset.icon !== name) { btn.innerHTML = icon(name); btn.dataset.icon = name; }
      const label = muted ? "Rétablir le son" : "Couper le son";
      btn.setAttribute("aria-label", label);
      btn.title = label + " (M)";
    });
  }

  window.Volume = {
    attach, set, up, down, zero, max, toggleMute, show, mountFooter,
    level: () => level,
    muted: () => muted
  };
})();
