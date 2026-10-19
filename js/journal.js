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
    if (album) return '<a class="jr-wiki" href="' + (album.nextUp ? "nextup.html?album=" : "album.html?id=") + encodeURIComponent(album.id) + '">' + text + "</a>";
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
      .replace(/(^|\s)#([\p{L}\p{N}_\/-]+)/gu, '$1<span class="jr-tag">#$2</span>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[i]);
  }

  function markdown(src) {
    const lines = src.replace(/\r/g, "").split("\n");
    const out = [];
    let list = null;    // "ul" | "ol"
    let para = [];
    const flushPara = () => { if (para.length) { out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } };
    const closeList = () => { if (list) { out.push("</" + list + ">"); list = null; } };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let m;
      if (/^```/.test(line)) {
        flushPara(); closeList();
        const code = [];
        while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i]);
        out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>");
      } else if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
        flushPara(); closeList();
        out.push("<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">");
      } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
        flushPara(); closeList();
        out.push("<hr>");
      } else if ((m = /^>\s?(.*)$/.exec(line))) {
        flushPara(); closeList();
        const quote = [m[1]];
        while (i + 1 < lines.length && /^>/.test(lines[i + 1])) quote.push(lines[++i].replace(/^>\s?/, ""));
        out.push("<blockquote>" + quote.map(inline).join("<br>") + "</blockquote>");
      } else if ((m = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line))) {
        flushPara();
        if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; }
        const done = m[1] !== " ";
        out.push('<li class="jr-task' + (done ? " is-done" : "") + '"><input type="checkbox"' + (done ? " checked" : "") + "> " + inline(m[2]) + "</li>");
      } else if ((m = /^\s*[-*+]\s+(.*)$/.exec(line))) {
        flushPara();
        if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; }
        out.push("<li>" + inline(m[1]) + "</li>");
      } else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
        flushPara();
        if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; }
        out.push("<li>" + inline(m[1]) + "</li>");
      } else if (!line.trim()) {
        flushPara(); closeList();
      } else {
        closeList();
        para.push(line);
      }
    }
    flushPara(); closeList();
    return out.join("\n");
  }

  // ---------- Fenêtre « note » ----------

  const noteDialog = $("jr-note");
  const area = $("jr-note-area");
  const preview = $("jr-note-preview");
  let noteDay = null;
  let noteSaved = "";

  function setNoteMode(view) {
    if (view) preview.innerHTML = markdown(area.value) || '<p class="hint">Note vide.</p>';
    preview.hidden = !view;
    area.hidden = view;
    $("jr-note-view").classList.toggle("is-active", view);
    $("jr-note-edit").classList.toggle("is-active", !view);
    $("jr-note-view").setAttribute("aria-selected", String(view));
    $("jr-note-edit").setAttribute("aria-selected", String(!view));
    if (!view) setTimeout(() => area.focus(), 0);
  }

  function openNote(k) {
    noteDay = k;
    const note = Store.note(k);
    noteSaved = note ? note.text : "";
    area.value = noteSaved;
    $("jr-note-title").textContent = longDate(parseDay(k));
    $("jr-note-delete").hidden = !note;
    if (!noteDialog.open) noteDialog.showModal();
    setNoteMode(!!note);   // note existante : lecture ; nouvelle : écriture
  }

  function keepNote() {
    if (noteDay && area.value !== noteSaved) Store.setNote(noteDay, area.value);
    noteSaved = area.value;
  }

  // Fermer (×, Échap, clic à côté) garde ce qui a été écrit
  noteDialog.addEventListener("close", keepNote);
  $("jr-note-edit").addEventListener("click", () => setNoteMode(false));
  $("jr-note-view").addEventListener("click", () => setNoteMode(true));
  $("jr-note-save").addEventListener("click", () => noteDialog.close());
  $("jr-note-close").addEventListener("click", () => noteDialog.close());
  $("jr-note-delete").addEventListener("click", () => {
    area.value = "";
    noteDialog.close();
  });
  noteDialog.addEventListener("click", e => { if (e.target === noteDialog) noteDialog.close(); });
  noteDialog.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); noteDialog.close(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") { e.preventDefault(); setNoteMode(!area.hidden); }
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
  render();
})();
