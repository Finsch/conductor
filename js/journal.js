// conductor. — journal d'écoute : pages/journal.html?mois=AAAA-MM
//
// - Calendrier du mois : la pochette de l'album écouté chaque jour (+N s'il y
//   en a eu plusieurs), le jour actuel mis en évidence. Chaque jour a sa note
//   (bouton au survol ; une fois écrite, le bouton reste visible).
// - Colonne de droite : « il y a un an », les 12 derniers mois, les chiffres
//   du mois affiché, l'historique des écoutes (10 par page).
// - Notes : markdown, mise en forme façon Obsidian (titres, gras, italique,
//   ==surligné==, listes, tâches, citations, code, liens, [[album ou artiste]],
//   #tags). Enregistrées avec la collection (Store.setNote → datastorage).
// - Recherche dans toutes les notes.

(function () {
  const $ = id => document.getElementById(id);
  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
                  "août", "septembre", "octobre", "novembre", "décembre"];
  const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.",
                        "août", "sept.", "oct.", "nov.", "déc."];
  const DAYS_LONG = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const PAGE_SIZE = 10;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  const pad = n => String(n).padStart(2, "0");
  const dayKey = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parseDay = k => new Date(k + "T12:00:00");
  const plural = (n, w) => n + " " + w + (n > 1 ? "s" : "");
  const hhmm = d => pad(d.getHours()) + ":" + pad(d.getMinutes());
  const longDate = d => DAYS_LONG[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();

  function durationOf(a) {
    if (a.duration) return a.duration;
    return (a.tracks || []).reduce((s, t) => s + (t.duration || 0), 0) || 0;
  }

  function coverImg(a, size) {
    const src = a.cover || (a.serverCover && Server.isConfigured() ? Server.coverUrl(a.serverCover, size || 300) : "");
    if (!src) return null;
    const img = el("img");
    img.src = localUrl(src);
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => img.remove();
    return img;
  }

  const albumHref = a => "album.html?id=" + encodeURIComponent(a.id);
  const searchHref = q => "../index.html?reset=1&q=" + encodeURIComponent(q);

  // ---------- Écoutes ----------
  // Début : enregistré par le lecteur (startedAt) ; pour les anciennes écoutes,
  // estimé (fin − durée de l'album).

  function allPlays() {
    const out = [];
    Store.raw().forEach(a => (a.plays || []).forEach(p => {
      const end = new Date(p.at);
      if (isNaN(end)) return;
      const start = p.startedAt ? new Date(p.startedAt) : new Date(end.getTime() - (durationOf(a) || 0) * 1000);
      out.push({ album: a, start, estimated: !p.startedAt });
    }));
    return out.sort((x, y) => y.start - x.start);
  }

  function byDayOf(plays) {
    const m = new Map();
    plays.filter(p => p.start.getFullYear() === year && p.start.getMonth() === month).forEach(p => {
      const k = dayKey(p.start);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(p);
    });
    return m;
  }

  // ---------- Mois affiché ----------

  const today = new Date();
  let year = today.getFullYear(), month = today.getMonth();
  const wanted = /^(\d{4})-(\d{2})$/.exec(new URLSearchParams(location.search).get("mois") || "");
  if (wanted) { year = Number(wanted[1]); month = Number(wanted[2]) - 1; }

  function setMonth(y, m) {
    const d = new Date(y, m, 1);
    year = d.getFullYear();
    month = d.getMonth();
    const url = new URL(location.href);
    if (year === today.getFullYear() && month === today.getMonth()) url.searchParams.delete("mois");
    else url.searchParams.set("mois", year + "-" + pad(month + 1));
    history.replaceState(null, "", url);
    render();
  }

  $("jr-prev").addEventListener("click", () => setMonth(year, month - 1));
  $("jr-next").addEventListener("click", () => setMonth(year, month + 1));
  $("jr-today").addEventListener("click", () => setMonth(today.getFullYear(), today.getMonth()));

  // ---------- Rendu ----------

  let histPage = 0;
  let highlightDay = null;   // jour mis en avant dans l'historique

  function render() {
    const plays = allPlays();
    const inMonth = plays.filter(p => p.start.getFullYear() === year && p.start.getMonth() === month);
    $("jr-month").textContent = MONTHS[month] + " " + year;
    const isNow = year === today.getFullYear() && month === today.getMonth();
    $("jr-today").disabled = isNow;

    renderCalendar(byDayOf(plays));
    cy = year; cm = month;   // le graphe suit le mois du calendrier
    renderTime();
    iy = year; im = month;   // l'intensité aussi (elle a ses propres boutons)
    renderIntensity();
    renderAgo(plays);
    renderHeat(plays);
    renderStats(inMonth, plays, isNow);
    renderHistory(plays);
  }

  // ---------- Calendrier ----------

  const NOTE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4.5l5 5L9 20H4v-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12.5 6.5l5 5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  const NOTE_ICON_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" fill="currentColor"/><path d="M9 11h7M9 14.5h7M9 18h4" fill="none" stroke="#1b1b1b" stroke-width="1.6" stroke-linecap="round"/></svg>';

  function renderCalendar(byDay) {
    const cal = $("jr-cal");
    cal.replaceChildren();
    ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].forEach(d => cal.appendChild(el("div", "jr-dow", d)));
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) cal.appendChild(el("div", "jr-day is-out"));
    const days = new Date(year, month + 1, 0).getDate();
    const todayKey = dayKey(today);
    const notes = Store.notes();

    for (let d = 1; d <= days; d++) {
      const date = new Date(year, month, d);
      const k = dayKey(date);
      const list = byDay.get(k) || [];
      const cell = el("div", "jr-day" + (k === todayKey ? " is-today" : "") + (date > today ? " is-future" : "") +
        (list.length ? " has-plays" : ""));
      cell.appendChild(el("span", "jr-num", String(d)));
      if (k === todayKey) cell.setAttribute("aria-current", "date");

      if (list.length) {
        const last = list[0];
        const img = coverImg(last.album, 300);
        if (img) cell.appendChild(img);
        else cell.appendChild(el("span", "jr-day-title", last.album.title));
        if (list.length > 1) cell.appendChild(el("span", "jr-more", "+" + (list.length - 1)));
        cell.title = list.map(p => hhmm(p.start) + "  " + p.album.title + " — " + p.album.artist).join("\n");
        cell.tabIndex = 0;
        cell.setAttribute("role", "button");
        const show = () => showDayInHistory(k);
        cell.addEventListener("click", show);
        cell.addEventListener("keydown", e => { if (e.key === "Enter") show(); });
        cell.appendChild(copyDayBtn(k, list));
      }

      // Note du jour
      const has = !!notes[k];
      const nb = el("button", "jr-note-btn" + (has ? " has-note" : ""));
      nb.type = "button";
      nb.innerHTML = has ? NOTE_ICON_ON : NOTE_ICON;
      nb.title = has ? "Lire la note du " + d + " " + MONTHS[month] : "Écrire une note pour le " + d + " " + MONTHS[month];
      nb.setAttribute("aria-label", nb.title);
      nb.addEventListener("click", e => { e.stopPropagation(); openNote(k); });
      cell.appendChild(nb);
      cal.appendChild(cell);
    }
  }

  // ---------- Copier les écoutes d'un jour (coin haut droit, au survol) ----------
  // « 1. [[Glass Animals]] - [[ZABA]] », une ligne par écoute, dans l'ordre du jour
  // (liens façon Obsidian, à coller dans vos notes)

  const COPY_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="6.5" y="6.5" width="10" height="10" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13.5 4.5v-.7a1.8 1.8 0 0 0-1.8-1.8H5.3a1.8 1.8 0 0 0-1.8 1.8v6.4a1.8 1.8 0 0 0 1.8 1.8h.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const DONE_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => copyFallback(text));
    }
    return Promise.resolve(copyFallback(text));
  }

  function copyFallback(text) {
    const area = el("textarea");
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

  function yearOf(a) {
    if (a.releaseDate) return a.releaseDate.slice(0, 4);
    return a.year ? String(a.year) : "";
  }

  function copyDayBtn(k, list) {
    const b = el("button", "jr-copy-btn");
    b.type = "button";
    b.innerHTML = COPY_ICON;
    b.title = "Copier les écoutes du jour";
    b.setAttribute("aria-label", "Copier les écoutes du " + longDate(parseDay(k)));
    b.addEventListener("click", e => {
      e.stopPropagation();
      const lines = list.slice().sort((x, y) => x.start - y.start).map((p, i) =>
        (i + 1) + ". [[" + p.album.artist + "]] - [[" + p.album.title + "]]");
      copyText(lines.join("\n")).then(() => {
        b.innerHTML = DONE_ICON;
        b.classList.add("is-done");
        b.title = plural(lines.length, "écoute") + " copiée" + (lines.length > 1 ? "s" : "");
      }).catch(() => { b.title = "Copie impossible : le navigateur l'a refusée"; })
        .finally(() => setTimeout(() => {
          b.innerHTML = COPY_ICON;
          b.classList.remove("is-done");
          b.title = "Copier les écoutes du jour";
        }, 1800));
    });
    return b;
  }

  // Clic sur un jour : l'historique va à la page de ce jour et le met en avant
  function showDayInHistory(k) {
    const plays = allPlays();
    const i = plays.findIndex(p => dayKey(p.start) === k);
    if (i < 0) return;
    histPage = Math.floor(i / PAGE_SIZE);
    highlightDay = k;
    renderHistory(plays);
    const row = document.querySelector('#jr-list [data-day="' + k + '"]');
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ---------- Temps d'écoute par jour (graphe) ----------
  // Secondes réellement écoutées chaque jour (Store.listening), enregistrées par
  // le lecteur après chaque écoute d'album, à la pause ou en changeant d'album.

  function hm(sec) {
    const m = Math.round(sec / 60);
    if (m < 60) return m + " min";
    return Math.floor(m / 60) + " h" + (m % 60 ? " " + pad(m % 60) : "");
  }

  // Courbe lissée sans dépassement (interpolation monotone de Fritsch-Carlson)
  function smoothPath(pts) {
    const n = pts.length;
    if (n < 2) return "";
    const dx = [], m = [], t = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
      if (h > 9) { const k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += " C" + (pts[i][0] + h).toFixed(1) + "," + (pts[i][1] + h * t[i]).toFixed(1) + " " +
        (pts[i + 1][0] - h).toFixed(1) + "," + (pts[i + 1][1] - h * t[i + 1]).toFixed(1) + " " +
        pts[i + 1][0].toFixed(1) + "," + pts[i + 1][1].toFixed(1);
    }
    return d;
  }

  // Temps d'écoute du mois choisi : courbe + aire, point sur aujourd'hui.
  // Mois en cours : la courbe s'arrête à aujourd'hui.

  // Mois du graphe : suit le calendrier, et a ses propres boutons ‹ aujourd'hui ›
  let cy = year, cm = month;
  function setChartMonth(y, m) {
    const d = new Date(y, m, 1);
    cy = d.getFullYear();
    cm = d.getMonth();
    renderTime();
  }
  $("jr-time-prev").addEventListener("click", () => setChartMonth(cy, cm - 1));
  $("jr-time-next").addEventListener("click", () => setChartMonth(cy, cm + 1));
  $("jr-time-today").addEventListener("click", () => setChartMonth(today.getFullYear(), today.getMonth()));

  function renderTime() {
    const listening = Store.listening();
    const isNow = cy === today.getFullYear() && cm === today.getMonth();
    $("jr-time-today").disabled = isNow;
    const SPAN = new Date(cy, cm + 1, 0).getDate();   // jours du mois (axe)
    const shownDays = isNow ? today.getDate() : SPAN;       // jours tracés
    const days = [];
    for (let d = 1; d <= shownDays; d++) {
      const date = new Date(cy, cm, d);
      days.push({ date, v: listening[dayKey(date)] || 0 });
    }

    // En-tête : total du mois choisi (et temps d'aujourd'hui pour le mois en cours)
    const monthTotal = days.reduce((s, d) => s + d.v, 0);
    const todaySec = listening[dayKey(today)] || 0;
    $("jr-time-title").textContent = "temps d'écoute · " + MONTHS[cm] + " " + cy;
    const sum = [el("span", null, "total : "), el("b", null, hm(monthTotal))];
    if (isNow) sum.push(el("span", null, " · aujourd'hui : "), el("b", null, hm(todaySec)));
    $("jr-time-sum").replaceChildren(...sum);

    const chart = $("jr-chart");
    const W = Math.max(300, chart.clientWidth || 700), H = 170;
    const PAD_T = 22, PAD_B = 24, PAD_L = 6, PAD_R = 6;
    const max = Math.max(0, ...days.map(d => d.v));
    const STEPS = [1800, 3600, 7200, 10800, 14400, 21600, 28800, 43200, 86400];
    const top = STEPS.find(s => s >= max) || Math.ceil(max / 3600) * 3600;
    const x = i => PAD_L + i * (W - PAD_L - PAD_R) / (SPAN - 1);
    const y = v => PAD_T + (1 - v / top) * (H - PAD_T - PAD_B);
    const base = y(0);
    const last = days.length - 1;
    const pts = days.map((d, i) => [x(i), y(d.v)]);
    const line = smoothPath(pts);

    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    const mk = (tag, attrs, text) => {
      const n = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
      if (text != null) n.textContent = text;
      svg.appendChild(n);
      return n;
    };

    // Dégradé de l'aire (couleur du texte, très transparente)
    const defs = mk("defs", {});
    const grad = document.createElementNS(NS, "linearGradient");
    grad.id = "jr-area-grad";
    grad.setAttribute("x1", "0"); grad.setAttribute("y1", "0"); grad.setAttribute("x2", "0"); grad.setAttribute("y2", "1");
    [["0%", "0.16"], ["100%", "0"]].forEach(([o, a]) => {
      const st = document.createElementNS(NS, "stop");
      st.setAttribute("offset", o);
      st.setAttribute("stop-color", "#ecf0f0");
      st.setAttribute("stop-opacity", a);
      grad.appendChild(st);
    });
    defs.appendChild(grad);

    // Lignes de repère pointillées + leur valeur
    [0.5, 1].forEach(f => {
      mk("line", { x1: PAD_L, x2: W - PAD_R, y1: y(top * f), y2: y(top * f), class: "jr-gridline" });
      mk("text", { x: W - PAD_R, y: y(top * f) - 4, class: "jr-gridtext", "text-anchor": "end" }, hm(top * f));
    });
    mk("line", { x1: PAD_L, x2: W - PAD_R, y1: base, y2: base, class: "jr-baseline" });

    // Graduations : 1, 5, 10, 15, 20, 25 et le dernier jour du mois
    for (let i = 0; i < SPAN; i++) {
      const d = i + 1;
      if (!(d === 1 || d === SPAN || (d % 5 === 0 && SPAN - d >= 3))) continue;
      mk("line", { x1: x(i), x2: x(i), y1: base, y2: base + 4, class: "jr-baseline" });
      mk("text", { x: x(i), y: H - 6, class: "jr-axistext", "text-anchor": i === 0 ? "start" : i === SPAN - 1 ? "end" : "middle" },
        d + (d === 1 ? " " + MONTHS_SHORT[cm] : ""));
    }

    if (max > 0) {
      if (days.length > 1) {
        mk("path", { d: line + " L" + x(last) + "," + base + " L" + x(0) + "," + base + " Z", fill: "url(#jr-area-grad)" });
        mk("path", { d: line, class: "jr-line" });
      }
      // Étiquette sur le jour le plus écouté (sauf si c'est aujourd'hui)
      const iMax = days.findIndex(d => d.v === max);
      if (!(isNow && iMax === last)) mk("text", { x: x(iMax), y: y(max) - 8, class: "jr-valtext", "text-anchor": "middle" }, hm(max));
    }

    // Aujourd'hui (mois en cours) : un point et sa valeur
    if (isNow) {
      mk("circle", { cx: x(last), cy: y(days[last].v), r: 5, class: "jr-today-dot" });
      if (days[last].v) mk("text", { x: x(last) + (last > SPAN - 4 ? -8 : 8), y: y(days[last].v) - 9, class: "jr-valtext",
        "text-anchor": last > SPAN - 4 ? "end" : "start" }, hm(days[last].v));
    }

    // Valeurs des repères par-dessus la courbe
    svg.querySelectorAll(".jr-gridtext").forEach(t => svg.appendChild(t));

    // Survol : ligne verticale, point et infobulle sur le jour le plus proche
    const cross = mk("line", { y1: PAD_T - 6, y2: base, class: "jr-cross", visibility: "hidden" });
    const hoverDot = mk("circle", { r: 4, class: "jr-hover-dot", visibility: "hidden" });
    const hit = mk("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" });

    const tipEl = el("div", "jr-tip");
    tipEl.hidden = true;
    const show = e => {
      const r = svg.getBoundingClientRect();
      const px = (e.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(last, Math.round((px - PAD_L) / ((W - PAD_L - PAD_R) / (SPAN - 1)))));
      const d = days[i];
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i));
      hoverDot.setAttribute("cx", x(i)); hoverDot.setAttribute("cy", y(d.v));
      cross.setAttribute("visibility", "visible");
      hoverDot.setAttribute("visibility", "visible");
      tipEl.textContent = DAYS_LONG[d.date.getDay()] + " " + d.date.getDate() + " " + MONTHS[d.date.getMonth()] + " · " + (d.v ? hm(d.v) : "rien écouté");
      tipEl.hidden = false;
      const left = x(i) * (r.width / W);
      tipEl.style.left = Math.min(Math.max(left, 90), r.width - 90) + "px";
    };
    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerleave", () => {
      cross.setAttribute("visibility", "hidden");
      hoverDot.setAttribute("visibility", "hidden");
      tipEl.hidden = true;
    });

    chart.replaceChildren(svg, tipEl);
    chart.setAttribute("aria-label", "Temps d'écoute par jour, " + MONTHS[cm] + " " + cy + " : " + hm(monthTotal) + " au total.");
  }

  // ---------- Intensité moyenne par jour (barres) ----------
  // Moyenne de l'intensité (1 à 10) des albums écoutés ce jour-là ; elle se met à
  // jour après chaque écoute comptée. Ses propres boutons ‹ aujourd'hui ›.

  const fmt1 = v => (Math.round(v * 10) / 10).toString().replace(".", ",");
  let iy = year, im = month;
  function setIntenMonth(y, m) {
    const d = new Date(y, m, 1);
    iy = d.getFullYear();
    im = d.getMonth();
    renderIntensity();
  }
  $("jr-inten-prev").addEventListener("click", () => setIntenMonth(iy, im - 1));
  $("jr-inten-next").addEventListener("click", () => setIntenMonth(iy, im + 1));
  $("jr-inten-today").addEventListener("click", () => setIntenMonth(today.getFullYear(), today.getMonth()));

  function renderIntensity() {
    const isNow = iy === today.getFullYear() && im === today.getMonth();
    $("jr-inten-today").disabled = isNow;
    const SPAN = new Date(iy, im + 1, 0).getDate();
    const byDay = new Map();
    const played = new Set();   // jours avec au moins une écoute (même sans intensité)
    allPlays().forEach(p => {
      if (p.start.getFullYear() !== iy || p.start.getMonth() !== im) return;
      played.add(p.start.getDate());
      const v = Number(p.album.aggressivity);
      if (!(v > 0)) return;
      const k = p.start.getDate();
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(v);
    });
    const days = [];
    for (let d = 1; d <= SPAN; d++) {
      const list = byDay.get(d) || [];
      days.push({ date: new Date(iy, im, d), n: list.length, v: list.length ? list.reduce((s, x) => s + x, 0) / list.length : null });
    }
    const all = [].concat(...[...byDay.values()]);
    const monthAvg = all.length ? all.reduce((s, x) => s + x, 0) / all.length : null;
    const todayD = isNow ? days[today.getDate() - 1] : null;

    $("jr-inten-title").textContent = "intensité · " + MONTHS[im] + " " + iy;
    const sum = monthAvg == null ? [el("span", null, "pas d'album écouté avec une intensité ce mois-ci")]
      : [el("span", null, "moyenne du mois : "), el("b", null, fmt1(monthAvg) + " / 10")];
    if (todayD && todayD.v != null) sum.push(el("span", null, " · aujourd'hui : "), el("b", null, fmt1(todayD.v)),
      el("span", null, " (" + todayD.n + " album" + (todayD.n > 1 ? "s" : "") + ")"));
    $("jr-inten-sum").replaceChildren(...sum);

    const chart = $("jr-inten-chart");
    const W = Math.max(300, chart.clientWidth || 700), H = 150;
    const PAD_T = 18, PAD_B = 24, PAD_L = 6, PAD_R = 6;
    const slot = (W - PAD_L - PAD_R) / SPAN;
    const bw = Math.max(3, Math.min(16, slot * 0.62));
    const cx = i => PAD_L + slot * (i + 0.5);
    const y = v => PAD_T + (1 - v / 10) * (H - PAD_T - PAD_B);   // échelle fixe 0 → 10
    const base = y(0);

    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    const mk = (tag, attrs, text) => {
      const n = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
      if (text != null) n.textContent = text;
      svg.appendChild(n);
      return n;
    };

    [[10, "10 · intense"], [5, "5"]].forEach(([v, label]) => {
      mk("line", { x1: PAD_L, x2: W - PAD_R, y1: y(v), y2: y(v), class: "jr-gridline" });
      mk("text", { x: W - PAD_R, y: y(v) - 4, class: "jr-gridtext", "text-anchor": "end" }, label);
    });
    mk("line", { x1: PAD_L, x2: W - PAD_R, y1: base, y2: base, class: "jr-baseline" });
    for (let i = 0; i < SPAN; i++) {
      const d = i + 1;
      if (!(d === 1 || d === SPAN || (d % 5 === 0 && SPAN - d >= 3))) continue;
      mk("text", { x: cx(i), y: H - 6, class: "jr-axistext", "text-anchor": i === 0 ? "start" : i === SPAN - 1 ? "end" : "middle" },
        d + (d === 1 ? " " + MONTHS_SHORT[im] : ""));
    }

    // Une barre par jour écouté ; aujourd'hui en clair, avec sa valeur
    const bars = days.map((d, i) => {
      if (d.v == null) return null;
      const isToday = todayD && d === todayD;
      return mk("rect", { x: cx(i) - bw / 2, y: y(d.v), width: bw, height: Math.max(1, base - y(d.v)), rx: 1.5,
        class: "jr-ibar" + (isToday ? " is-today" : "") });
    });
    if (todayD && todayD.v != null) {
      const i = today.getDate() - 1;
      mk("text", { x: cx(i), y: y(todayD.v) - 6, class: "jr-valtext", "text-anchor": "middle" }, fmt1(todayD.v));
    }
    // Moyenne du mois : ligne pointillée, par-dessus les barres
    if (monthAvg != null) mk("line", { x1: PAD_L, x2: W - PAD_R, y1: y(monthAvg), y2: y(monthAvg), class: "jr-avgline" });
    svg.querySelectorAll(".jr-gridtext").forEach(t => svg.appendChild(t));

    // Survol : le jour sous la souris
    const hit = mk("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" });
    const tipEl = el("div", "jr-tip");
    tipEl.hidden = true;
    let lit = null;
    hit.addEventListener("pointermove", e => {
      const r = svg.getBoundingClientRect();
      const px = (e.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(SPAN - 1, Math.floor((px - PAD_L) / slot)));
      const d = days[i];
      if (lit) lit.classList.remove("is-hover");
      lit = bars[i];
      if (lit) lit.classList.add("is-hover");
      const future = isNow && i > today.getDate() - 1;
      tipEl.textContent = DAYS_LONG[d.date.getDay()] + " " + d.date.getDate() + " " + MONTHS[d.date.getMonth()] + " · " +
        (d.v != null ? "intensité " + fmt1(d.v) + " (" + d.n + " album" + (d.n > 1 ? "s" : "") + ")"
          : future ? "à venir" : played.has(d.date.getDate()) ? "albums sans intensité renseignée" : "pas d'écoute");
      tipEl.hidden = false;
      const left = cx(i) * (r.width / W);
      tipEl.style.left = Math.min(Math.max(left, 110), r.width - 110) + "px";
    });
    hit.addEventListener("pointerleave", () => {
      if (lit) lit.classList.remove("is-hover");
      lit = null;
      tipEl.hidden = true;
    });
    chart.replaceChildren(svg, tipEl);
    chart.setAttribute("aria-label", "Intensité moyenne par jour, " + MONTHS[im] + " " + iy +
      (monthAvg != null ? " : " + fmt1(monthAvg) + " en moyenne." : "."));
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { renderTime(); renderIntensity(); }, 150); });

  // ---------- Il y a un an ----------

  function renderAgo(plays) {
    const target = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const k = dayKey(target);
    const list = plays.filter(p => dayKey(p.start) === k);
    $("jr-ago-card").hidden = !list.length;
    if (!list.length) return;
    $("jr-ago").replaceChildren(...list.slice(0, 3).map(p => {
      const a = el("a", "jr-ago");
      a.href = albumHref(p.album);
      const c = el("div", "jr-ago-cover");
      const img = coverImg(p.album, 200);
      if (img) c.appendChild(img);
      const text = el("div");
      text.append(el("p", "row-title", p.album.title), el("p", "row-artist", p.album.artist),
        el("p", "hint", target.getDate() + " " + MONTHS[target.getMonth()] + " " + target.getFullYear() + " · " + hhmm(p.start)));
      a.append(c, text);
      return a;
    }));
  }

  // ---------- 12 derniers mois ----------

  function renderHeat(plays) {
    const count = new Map();
    plays.forEach(p => { const k = dayKey(p.start); count.set(k, (count.get(k) || 0) + 1); });
    const box = $("jr-heat");
    box.replaceChildren();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - 7 * 52 - ((end.getDay() + 6) % 7));
    let total = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = dayKey(d);
      const n = count.get(k) || 0;
      total += n;
      const cell = el("i", "jr-heat-" + Math.min(n, 3) + (k === dayKey(today) ? " is-today" : ""));
      cell.title = d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() + " : " + (n ? plural(n, "écoute") : "aucune écoute");
      box.appendChild(cell);
    }
    let streak = 0;
    const d = new Date(end);
    if (!count.get(dayKey(d))) d.setDate(d.getDate() - 1);
    while (count.get(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
    $("jr-heat-note").textContent = plural(total, "écoute") + (streak > 1 ? " · série en cours : " + streak + " jours" : "");
  }

  // ---------- Chiffres du mois ----------

  function renderStats(inMonth, plays, isNow) {
    $("jr-month-title").textContent = isNow ? "ce mois-ci" : MONTHS[month] + " " + year;
    const albums = new Set(inMonth.map(p => p.album.id));
    const total = inMonth.reduce((s, p) => s + durationOf(p.album), 0);
    $("jr-summary").textContent = inMonth.length
      ? [plural(inMonth.length, "écoute"), plural(albums.size, "album"), total ? formatLength(total) : ""].filter(Boolean).join(" · ")
      : "Aucune écoute.";

    const rows = [];
    // small : taille du texte courant (comme la fiche d'un album)
    const add = (label, value, small) => {
      const dd = el("dd", small ? "is-small" : null);
      [].concat(value).forEach((v, i) => { if (i && typeof v !== "string") dd.append(", "); dd.append(v); });
      rows.push(el("dt", null, label), dd);
    };
    const link = (text, href, title) => {
      const a = el("a", "jr-link", text);
      a.href = href;
      if (title) a.title = title;
      return a;
    };
    const tally = (list, key) => {
      const m = new Map();
      list.forEach(p => [].concat(key(p)).forEach(k => { if (k) m.set(k, (m.get(k) || 0) + 1); }));
      return [...m].sort((a, b) => b[1] - a[1]);
    };

    if (inMonth.length) {
      const [topId, topN] = tally(inMonth, p => p.album.id)[0];
      const album = inMonth.find(p => p.album.id === topId).album;
      const albumLink = link(album.title, albumHref(album), album.title + " — " + album.artist);
      add("le plus écouté", topN > 1 ? [albumLink, " ×" + topN] : albumLink);

      const [artist] = tally(inMonth, p => p.album.artist)[0];
      add("artiste", link(artist, artistUrl(artist), "Tous les albums de " + artist));

      const [topDay, dayN] = tally(inMonth, p => dayKey(p.start))[0];
      if (dayN > 1) {
        const d = parseDay(topDay);
        const a = link(DAYS_LONG[d.getDay()] + " " + d.getDate() + " (" + dayN + ")", "#", "Voir les écoutes de ce jour");
        a.addEventListener("click", e => { e.preventDefault(); showDayInHistory(topDay); });
        add("jour le plus chargé", a, true);
      }

      const genres = tally(inMonth, p => p.album.genre).slice(0, 3);
      if (genres.length) add("genres dominants", genres.map(([g, n]) => link(g.toLowerCase(), searchHref(g), plural(n, "écoute") + " · chercher dans la collection")), true);

      const firstSeen = new Map();
      plays.slice().reverse().forEach(p => { if (!firstSeen.has(p.album.id)) firstSeen.set(p.album.id, p.start); });
      const fresh = [...firstSeen.values()].filter(d => d.getFullYear() === year && d.getMonth() === month).length;
      add("albums écoutés pour la 1ʳᵉ fois", String(fresh), true);
    }
    $("jr-stats").replaceChildren(...rows);
  }

  // ---------- Historique des écoutes (10 par page) ----------

  function renderHistory(plays) {
    const pages = Math.max(1, Math.ceil(plays.length / PAGE_SIZE));
    histPage = Math.max(0, Math.min(histPage, pages - 1));
    const shown = plays.slice(histPage * PAGE_SIZE, (histPage + 1) * PAGE_SIZE);
    $("jr-empty").hidden = plays.length > 0;
    $("jr-empty").textContent = "Pas encore d'écoute. Elles s'ajoutent toutes seules quand vous écoutez un album avec le lecteur.";
    const todayKey = dayKey(today);
    const yesterdayKey = dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
    $("jr-list").replaceChildren(...shown.map(p => {
      const k = dayKey(p.start);
      const row = el("a", "jr-row" + (k === highlightDay ? " is-highlight" : ""));
      row.href = albumHref(p.album);
      row.dataset.day = k;
      const cover = el("span", "row-cover");
      const img = coverImg(p.album, 100);
      if (img) cover.appendChild(img);
      const text = el("span", "row-text");
      text.append(el("span", "row-title", p.album.title), el("span", "row-artist", p.album.artist));
      const when = el("span", "jr-when");
      const day = k === todayKey ? "aujourd'hui" : k === yesterdayKey ? "hier" : p.start.getDate() + " " + MONTHS_SHORT[p.start.getMonth()] +
        (p.start.getFullYear() !== today.getFullYear() ? " " + p.start.getFullYear() : "");
      when.append(el("span", "jr-when-day", day), el("span", "jr-when-time", (p.estimated ? "≈ " : "") + hhmm(p.start)));
      when.title = longDate(p.start) + (p.estimated ? " · heure de début estimée" : " · début de l'écoute");
      row.append(cover, text, when);
      return row;
    }));
    $("jr-pager").hidden = plays.length <= PAGE_SIZE;
    $("jr-hist-prev").disabled = histPage === 0;
    $("jr-hist-next").disabled = histPage >= pages - 1;
    $("jr-hist-page").textContent = (histPage + 1) + " / " + pages;
  }

  $("jr-hist-prev").addEventListener("click", () => { histPage--; highlightDay = null; renderHistory(allPlays()); });
  $("jr-hist-next").addEventListener("click", () => { histPage++; highlightDay = null; renderHistory(allPlays()); });

  // ---------- Markdown façon Obsidian ----------

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // [[Titre]] ou [[Titre|texte]] : album (par titre) ou artiste de la collection
  function wikiLink(target, label) {
    const t = target.trim().toLowerCase();
    const all = Store.raw();
    const album = all.find(a => (a.title || "").toLowerCase() === t);
    const text = esc(label || target);
    if (album) return '<span class="jr-wiki-wrap"><a class="jr-wiki" href="' + (album.nextUp ? "nextup.html?album=" : "album.html?id=") +
      encodeURIComponent(album.id) + '">' + text + '</a><button type="button" class="jr-wiki-play" data-album="' + esc(album.id) + '"></button></span>';
    const artist = all.find(a => (a.artist || "").toLowerCase() === t);
    if (artist) return '<a class="jr-wiki" href="' + esc(artistUrl(artist.artist)) + '">' + text + "</a>";
    return '<span class="jr-wiki is-missing" title="Introuvable dans la collection">' + text + "</span>";
  }

  function inline(s) {
    const keep = [];
    const hold = html => { keep.push(html); return "\u0000" + (keep.length - 1) + "\u0000"; };
    s = s.replace(/`([^`]+)`/g, (_, c) => hold("<code>" + esc(c) + "</code>"));
    s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, l) => hold(wikiLink(t, l)));
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, u) =>
      hold('<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(t) + "</a>"));
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s)]+)/g, (_, pre, u) =>
      pre + hold('<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u) + "</a>"));
    s = esc(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/(^|[\s(])_([^_\s][^_]*)_/g, "$1<em>$2</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/==([^=]+)==/g, "<mark>$1</mark>")
      .replace(/&lt;u&gt;([\s\S]+?)&lt;\/u&gt;/g, "<u>$1</u>")
      .replace(/(^|\s)#([\p{L}\p{N}_\/-]+)/gu, '$1<span class="jr-tag">#$2</span>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[i]);
  }

  // Listes imbriquées : 2 espaces (ou une tabulation) de retrait = un niveau
  function markdown(src) {
    const lines = src.replace(/\r/g, "").split("\n");
    const out = [];
    const stack = [];   // listes ouvertes : { type: "ul" | "ol", level }
    let para = [];
    const flushPara = () => { if (para.length) { out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } };
    const closeLists = (level = -1) => {
      while (stack.length && stack[stack.length - 1].level > level) out.push("</li></" + stack.pop().type + ">");
    };
    const levelOf = ws => Math.floor(ws.replace(/\t/g, "  ").length / 2);
    function listItem(ws, type, html, cls) {
      flushPara();
      const level = levelOf(ws);
      closeLists(level);
      const top = stack[stack.length - 1];
      if (top && top.level === level && top.type !== type) { out.push("</li></" + stack.pop().type + ">"); }
      const cur = stack[stack.length - 1];
      if (!cur || cur.level < level) {
        out.push("<" + type + ">");
        stack.push({ type, level });
      } else {
        out.push("</li>");
      }
      out.push("<li" + (cls ? ' class="' + cls + '"' : "") + ">" + html);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let m;
      if (/^```/.test(line)) {
        flushPara(); closeLists();
        const code = [];
        while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i]);
        out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>");
      } else if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
        flushPara(); closeLists();
        out.push("<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">");
      } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
        flushPara(); closeLists();
        out.push("<hr>");
      } else if ((m = /^>\s?(.*)$/.exec(line))) {
        flushPara(); closeLists();
        const quote = [m[1]];
        while (i + 1 < lines.length && /^>/.test(lines[i + 1])) quote.push(lines[++i].replace(/^>\s?/, ""));
        out.push("<blockquote>" + quote.map(inline).join("<br>") + "</blockquote>");
      } else if ((m = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line))) {
        const done = m[2] !== " ";
        listItem(m[1], "ul", '<input type="checkbox"' + (done ? " checked" : "") + "> " + inline(m[3]), "jr-task" + (done ? " is-done" : ""));
      } else if ((m = /^(\s*)[-*+]\s+(.*)$/.exec(line))) {
        listItem(m[1], "ul", inline(m[2]));
      } else if ((m = /^(\s*)\d+[.)]\s+(.*)$/.exec(line))) {
        listItem(m[1], "ol", inline(m[2]));
      } else if (!line.trim()) {
        flushPara(); closeLists();
      } else {
        closeLists();
        para.push(line);
      }
    }
    flushPara(); closeLists();
    return out.join("\n");
  }

  // ---------- Fenêtre « note » ----------

  const PEN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4.5l5 5L9 20H4v-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12.5 6.5l5 5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  const BOOK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5c-3.5-.5-6.5 0-8.5 1.5zM12 6.5v13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  const CLIP_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="4.5" width="13" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 4.5V3.8c0-.7.5-1.3 1.2-1.3h3.6c.7 0 1.2.6 1.2 1.3v.7M9 4.5h6v2H9z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';

  const noteDialog = $("jr-note");
  const area = $("jr-note-area");
  const preview = $("jr-note-preview");
  let noteDay = null;
  let noteSaved = "";

  // Album lié dans une note : au survol, ▶ (rien en lecture) ou « 3 traits + »
  // (ajout à la file d'attente ; coche verte quelques secondes)
  const WIKI_ICONS = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
    add: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h11M3.5 11.5h11M3.5 16.5h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18 13v7M14.5 16.5h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    done: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h11M3.5 11.5h11M3.5 16.5h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13.5 16.5l2.8 2.8 5.2-5.6" fill="none" stroke="#3ecf6e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  const playerIdle = () => !window.Playback || !Playback.state();

  function paintWikiBtn(b) {
    const mode = Number(b.dataset.doneUntil || 0) > Date.now() ? "done" : playerIdle() ? "play" : "add";
    if (b.dataset.mode === mode) return;
    b.dataset.mode = mode;
    b.innerHTML = WIKI_ICONS[mode];
    b.classList.toggle("is-done", mode === "done");
    b.title = mode === "done" ? "Ajouté à la file d'attente" : mode === "play" ? "Écouter l'album" : "Ajouter à la file d'attente";
    b.setAttribute("aria-label", b.title);
  }

  function paintWikiBtns() {
    preview.querySelectorAll(".jr-wiki-play").forEach(paintWikiBtn);
  }

  preview.addEventListener("click", e => {
    const b = e.target.closest(".jr-wiki-play");
    if (!b || !window.Playback) return;
    e.preventDefault();
    e.stopPropagation();
    const id = b.dataset.album;
    if (playerIdle()) { Playback.playId(id); return; }
    Playback.addToQueue(id);
    b.dataset.doneUntil = String(Date.now() + 2000);
    paintWikiBtn(b);
    setTimeout(() => paintWikiBtn(b), 2050);
  }, true);
  document.addEventListener("playback:change", paintWikiBtns);

  function setNoteMode(view) {
    if (view) preview.innerHTML = markdown(area.value) || '<p class="hint">Note vide.</p>';
    if (view) paintWikiBtns();
    preview.hidden = !view;
    area.hidden = view;
    // Un seul bouton : livre (passer en lecture) / stylo (passer en écriture)
    const t = $("jr-note-toggle");
    t.innerHTML = view ? PEN_ICON : BOOK_ICON;
    t.title = (view ? "Écrire" : "Aperçu") + " (Ctrl+E)";
    t.setAttribute("aria-label", t.title);
    if (!view) setTimeout(() => area.focus(), 0);
  }

  function openNote(k) {
    noteDay = k;
    const note = Store.note(k);
    noteSaved = note ? note.text : "";
    area.value = noteSaved;
    $("jr-note-title").textContent = longDate(parseDay(k));
    $("jr-note-delete").hidden = !note;
    resetDelete();
    if (!noteDialog.open) noteDialog.showModal();
    setNoteMode(!!note);   // note existante : lecture ; nouvelle : écriture
  }

  function keepNote() {
    clearTimeout(autosaveTimer);
    if (noteDay && area.value !== noteSaved) Store.setNote(noteDay, area.value);
    noteSaved = area.value;
    $("jr-note-delete").hidden = !area.value.trim();
  }

  // Bouton « note du jour » de l'en-tête : ouvre la note d'aujourd'hui (la crée si besoin)
  function openTodayNote() {
    if (year !== today.getFullYear() || month !== today.getMonth()) setMonth(today.getFullYear(), today.getMonth());
    openNote(dayKey(today));
  }
  const todayBtn = $("today-note");
  if (todayBtn) todayBtn.addEventListener("click", e => { e.preventDefault(); openTodayNote(); });
  if (new URLSearchParams(location.search).get("note") === "today") {
    const url = new URL(location.href);
    url.searchParams.delete("note");
    history.replaceState(null, "", url);
    setTimeout(openTodayNote, 0);
  }

  // Enregistrement automatique : 0,8 s après la dernière frappe
  let autosaveTimer = null;
  area.addEventListener("input", () => {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(keepNote, 800);
  });

  // Fermer (×, Échap, clic à côté) garde ce qui a été écrit
  noteDialog.addEventListener("close", keepNote);
  $("jr-note-toggle").addEventListener("click", () => setNoteMode(!area.hidden));

  // Copier le texte de la note (markdown)
  $("jr-note-copy").addEventListener("click", () => {
    const b = $("jr-note-copy");
    copyText(area.value).then(() => {
      b.innerHTML = DONE_ICON;
      b.classList.add("is-done");
      b.title = "Note copiée";
    }).catch(() => { b.title = "Copie impossible : le navigateur l'a refusée"; })
      .finally(() => setTimeout(() => {
        b.innerHTML = CLIP_ICON;
        b.classList.remove("is-done");
        b.title = "Copier la note";
      }, 1800));
  });
  $("jr-note-close").addEventListener("click", () => noteDialog.close());

  // Supprimer : un premier clic arme le bouton (rouge), le second supprime
  let deleteArmed = null;
  function resetDelete() {
    clearTimeout(deleteArmed);
    deleteArmed = null;
    const b = $("jr-note-delete");
    b.classList.remove("is-armed");
    b.title = "Supprimer la note";
    b.setAttribute("aria-label", b.title);
  }
  $("jr-note-delete").addEventListener("click", () => {
    const b = $("jr-note-delete");
    if (!deleteArmed) {
      b.classList.add("is-armed");
      b.title = "Cliquer encore pour supprimer la note";
      b.setAttribute("aria-label", b.title);
      deleteArmed = setTimeout(resetDelete, 3000);
      return;
    }
    resetDelete();
    area.value = "";
    noteDialog.close();
  });
  noteDialog.addEventListener("click", e => { if (e.target === noteDialog) noteDialog.close(); });
  noteDialog.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); noteDialog.close(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") { e.preventDefault(); setNoteMode(!area.hidden); }
    // I : passer en écriture (depuis l'aperçu)
    if (area.hidden && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "i") { e.preventDefault(); setNoteMode(false); }
  });

  // ---------- Raccourcis de l'éditeur ----------
  //   Alt+1…6     titre de niveau 1 à 6 (même niveau : retiré)
  //   Ctrl+B / I / U   gras / italique / souligné (sur la sélection ; recommencer retire)
  //   Tab / Maj+Tab    retrait d'une ligne de liste (ou des lignes sélectionnées)

  // Lignes touchées par la sélection : [début, fin] dans le texte
  function selectedLines() {
    const v = area.value;
    const start = v.lastIndexOf("\n", area.selectionStart - 1) + 1;
    let end = v.indexOf("\n", area.selectionEnd - (area.selectionEnd > area.selectionStart && v[area.selectionEnd - 1] === "\n" ? 1 : 0));
    if (end < 0) end = v.length;
    return [start, end];
  }

  // Remplace un morceau du texte en gardant l'annulation (Ctrl+Z) du navigateur
  function replaceRange(start, end, text, selStart, selEnd) {
    area.focus();
    area.setSelectionRange(start, end);
    if (!document.execCommand("insertText", false, text)) area.setRangeText(text, start, end, "end");
    if (selStart != null) area.setSelectionRange(selStart, selEnd);
  }

  function setHeading(level) {
    const [start, end] = selectedLines();
    const line = area.value.slice(start, end);
    const m = /^(#{1,6})\s+/.exec(line);
    const body = m ? line.slice(m[0].length) : line;
    const next = m && m[1].length === level ? body : "#".repeat(level) + " " + body;
    replaceRange(start, end, next, start + next.length, start + next.length);
  }

  function wrap(open, close) {
    const s = area.selectionStart, e = area.selectionEnd, v = area.value;
    const sel = v.slice(s, e);
    // Déjà entouré : on retire
    if (v.slice(s - open.length, s) === open && v.slice(e, e + close.length) === close) {
      replaceRange(s - open.length, e + close.length, sel, s - open.length, e - open.length);
    } else if (sel.startsWith(open) && sel.endsWith(close) && sel.length >= open.length + close.length) {
      const inner = sel.slice(open.length, sel.length - close.length);
      replaceRange(s, e, inner, s, s + inner.length);
    } else {
      replaceRange(s, e, open + sel + close, s + open.length, s + open.length + sel.length);
    }
  }

  function indent(out) {
    const [start, end] = selectedLines();
    const lines = area.value.slice(start, end).split("\n");
    const next = lines.map(l => out ? l.replace(/^( {1,2}|\t)/, "") : "  " + l).join("\n");
    const multi = lines.length > 1 || area.selectionEnd > area.selectionStart;
    const caret = area.selectionStart + (next.length - (end - start)) * (lines.length > 1 ? 0 : 1);
    replaceRange(start, end, next, multi ? start : Math.max(start, caret), multi ? start + next.length : Math.max(start, caret));
  }

  area.addEventListener("keydown", e => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[1-6]$/.test(e.code)) {
      e.preventDefault();
      setHeading(Number(e.code.slice(5)));
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      const k = e.key.toLowerCase();
      if (k === "b") { e.preventDefault(); wrap("**", "**"); return; }
      if (k === "i") { e.preventDefault(); wrap("*", "*"); return; }
      if (k === "u") { e.preventDefault(); wrap("<u>", "</u>"); return; }
    }
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      indent(e.shiftKey);
    }
  });

  // Listes : Entrée sur « - truc » continue la liste ; sur une puce vide, la termine
  area.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey) return;
    const before = area.value.slice(0, area.selectionStart);
    const line = before.slice(before.lastIndexOf("\n") + 1);
    const m = /^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)[.)] )(.*)$/.exec(line);
    if (!m) return;
    e.preventDefault();
    if (!m[4].trim()) {
      area.setRangeText("", area.selectionStart - line.length, area.selectionStart, "end");
      return;
    }
    const bullet = m[3] ? (Number(m[3]) + 1) + m[2].slice(m[3].length) : m[2].replace(/\[[xX]\]/, "[ ]");
    area.setRangeText("\n" + m[1] + bullet, area.selectionStart, area.selectionEnd, "end");
  });

  // Aperçu : cocher une tâche la coche dans le texte
  preview.addEventListener("click", e => {
    const li = e.target.closest(".jr-task");
    if (!li || e.target.tagName === "A") return;
    e.preventDefault();
    const index = [...preview.querySelectorAll(".jr-task")].indexOf(li);
    let n = -1;
    area.value = area.value.replace(/^(\s*[-*+]\s+\[)([ xX])(\])/gm, (all, a, x, b) => (++n === index ? a + (x === " " ? "x" : " ") + b : all));
    setNoteMode(true);
  });

  // ---------- Recherche dans les notes ----------

  const findDialog = $("jr-find");
  const findInput = $("jr-find-input");

  function normalize(s) {
    return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function snippet(text, q) {
    const flat = text.replace(/\s+/g, " ");
    const i = normalize(flat).indexOf(q);
    const from = Math.max(0, i - 50);
    const part = flat.slice(from, from + 160);
    const j = normalize(part).indexOf(q);
    const frag = document.createDocumentFragment();
    if (from) frag.append("…");
    if (j < 0) frag.append(part);
    else frag.append(part.slice(0, j), el("mark", null, part.slice(j, j + q.length)), part.slice(j + q.length));
    if (from + 160 < flat.length) frag.append("…");
    return frag;
  }

  function runFind() {
    const raw = findInput.value.trim();
    const q = normalize(raw);
    const notes = Object.entries(Store.notes()).sort((a, b) => b[0].localeCompare(a[0]));
    const found = q ? notes.filter(([, n]) => normalize(n.text).includes(q)) : notes;
    $("jr-find-status").textContent = !notes.length
      ? "Aucune note pour l'instant. Survolez un jour du calendrier pour en écrire une."
      : q ? (found.length ? plural(found.length, "note") + " trouvée" + (found.length > 1 ? "s" : "") : "Aucune note ne contient « " + raw + " ».")
        : plural(notes.length, "note") + ", de la plus récente à la plus ancienne.";
    $("jr-find-list").replaceChildren(...found.slice(0, 50).map(([k, n]) => {
      const li = el("li");
      const b = el("button", "jr-find-item");
      b.type = "button";
      const p = el("span", "jr-find-snippet");
      const flat = n.text.replace(/\s+/g, " ");
      p.appendChild(q ? snippet(n.text, q) : document.createTextNode(flat.slice(0, 140) + (flat.length > 140 ? "…" : "")));
      b.append(el("span", "jr-find-date", longDate(parseDay(k))), p);
      b.addEventListener("click", () => {
        findDialog.close();
        const d = parseDay(k);
        if (d.getFullYear() !== year || d.getMonth() !== month) setMonth(d.getFullYear(), d.getMonth());
        openNote(k);
      });
      li.appendChild(b);
      return li;
    }));
  }

  let findTimer = null;
  findInput.addEventListener("input", () => { clearTimeout(findTimer); findTimer = setTimeout(runFind, 120); });
  $("jr-search-btn").addEventListener("click", () => {
    findDialog.showModal();
    findInput.select();
    runFind();
  });
  $("jr-find-close").addEventListener("click", () => findDialog.close());
  findDialog.addEventListener("click", e => { if (e.target === findDialog) findDialog.close(); });

  // ---------- Démarrage ----------

  document.addEventListener("albums:changed", render);
  document.addEventListener("notes:changed", () => renderCalendar(byDayOf(allPlays())));
  document.addEventListener("listening:changed", renderTime);
  render();
})();
