// conductor. — bilan de l'année (« wrapped »)
//
// Tout vient des écoutes comptées par le lecteur (album.plays), du temps d'écoute
// par jour (Store.listening). Rien n'est envoyé nulle part.
// Une écoute = un album écouté (90 % des morceaux, ou 30 min) : « albums écoutés »
// compte des albums différents, pas des lancements.

(function () {
  const $ = id => document.getElementById(id);
  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
    "septembre", "octobre", "novembre", "décembre"];
  const MONTHS_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const MONTHS_SHORT = ["jan", "fév", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
  const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const SEASONS = [
    ["hiver", [0, 1, 11], "janvier, février et décembre"],
    ["printemps", [2, 3, 4], "mars à mai"],
    ["été", [5, 6, 7], "juin à août"],
    ["automne", [8, 9, 10], "septembre à novembre"]
  ];
  const FAMILY_SHADES = ["#ecf0f0", "#b5b5b5", "#e5c07b", "#8a8a8a", "#6b6b6b", "#565656", "#454545", "#3a3a3a"];

  // Ressentis (en anglais dans les fiches) → mot pour la phrase de l'année
  const MOOD_FR = {
    melancholic: "mélancolique", melancholy: "mélancolique", sad: "triste", dark: "sombre", moody: "sombre",
    nocturnal: "nocturne", night: "nocturne", "late night": "nocturne", dreamy: "rêveuse", ethereal: "éthérée",
    atmospheric: "atmosphérique", mellow: "douce", chill: "tranquille", calm: "calme", peaceful: "paisible",
    energetic: "énergique", upbeat: "enjouée", uplifting: "lumineuse", happy: "joyeuse", joyful: "joyeuse",
    euphoric: "euphorique", aggressive: "rageuse", angry: "rageuse", intense: "intense", romantic: "romantique",
    sensual: "sensuelle", nostalgic: "nostalgique", groovy: "groovy", introspective: "introspective",
    emotional: "émotive", bittersweet: "douce-amère", hypnotic: "hypnotique", playful: "joueuse",
    epic: "épique", cinematic: "cinématographique", lush: "luxuriante", anxious: "anxieuse", lonely: "solitaire",
    raw: "brute", gritty: "rugueuse", menacing: "menaçante", tense: "tendue", wistful: "rêveuse",
    tender: "tendre", sentimental: "sentimentale", mysterious: "mystérieuse", cathartic: "cathartique",
    vibrant: "vibrante", radiant: "radieuse", hazy: "brumeuse", warm: "chaleureuse", cold: "froide",
    spiritual: "spirituelle", meditative: "méditative", triumphant: "triomphante", anthemic: "fédératrice",
    smooth: "suave", eerie: "étrange", haunting: "obsédante", brooding: "sombre", somber: "sombre",
    sombre: "sombre", gloomy: "sombre", dystopian: "dystopique", alienated: "désabusée", paranoid: "paranoïaque",
    disorienting: "déroutante", confrontational: "frontale", rebellious: "rebelle", sarcastic: "sarcastique",
    defiant: "rebelle"
  };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const plural = (n, w, pw) => n + " " + (n > 1 ? (pw || w + "s") : w);
  const pct = (n, total) => total ? Math.round(n / total * 100) : 0;
  const dayKey = d => d.toLocaleDateString("sv-SE");
  const durationOf = a => a.duration || (a.tracks || []).reduce((s, t) => s + (t.duration || 0), 0) || 0;
  const addedAt = a => a.addedAt || (a.logs && a.logs[0] && a.logs[0].loggedAt) || "";
  const yearOf = a => (a.releaseDate ? Number(a.releaseDate.slice(0, 4)) : a.year) || null;
  const albumHref = a => "album.html?id=" + encodeURIComponent(a.id);
  const longDate = d => DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];

  function hours(sec) {
    const h = sec / 3600;
    if (h >= 10) return Math.round(h) + " h";
    if (h >= 1) return (Math.round(h * 10) / 10).toString().replace(".", ",") + " h";
    return Math.round(sec / 60) + " min";
  }
  function hoursMin(sec) {
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h ? h + " h" + (m ? " " + String(m).padStart(2, "0") : "") : m + " min";
  }

  function countMap(list, keyOf, weightOf) {
    const m = new Map();
    list.forEach(x => {
      const keys = [].concat(keyOf(x)).filter(Boolean);
      keys.forEach(k => m.set(k, (m.get(k) || 0) + (weightOf ? weightOf(x) : 1)));
    });
    return [...m].sort((a, b) => b[1] - a[1]);
  }

  // ---------- Données ----------

  const ALL = Store.raw();
  const LISTEN = Store.listening();

  // Toutes les écoutes : { a, d (début), sec }
  const PLAYS = [];
  ALL.forEach(a => (a.plays || []).forEach(p => {
    const d = new Date(p.startedAt || p.at);
    if (isNaN(d)) return;
    PLAYS.push({ a, d, end: new Date(p.at), sec: p.seconds || durationOf(a) });
  }));

  const REAL = { plays: PLAYS, listen: LISTEN, added: addedAt, demo: false };

  // ---------- Démo : une année inventée à partir de la collection ----------
  // Rien n'est enregistré : les écoutes n'existent que dans cette page.
  function makeDemo(year) {
    let seed = year * 7919 % 2147483647 || 1;
    const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    const pick = list => list[Math.floor(rnd() * list.length)];
    const albums = ALL.filter(a => !a.nextUp && a.cover);
    if (albums.length < 12) return null;
    // Mélange stable, puis des « albums du moment » qui tournent au fil des mois
    const deck = albums.slice().sort(() => rnd() - 0.5);
    const added = new Map();
    deck.forEach((a, i) => {
      const d = i % 5 < 2
        ? new Date(year, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28), 20)
        : new Date(year - 1 - Math.floor(rnd() * 3), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28), 20);
      added.set(a.id, d.toISOString());
    });
    const plays = [], listen = {};
    const play = (a, day, hour) => {
      const d = new Date(day);
      d.setHours(hour, Math.floor(rnd() * 60), 0, 0);
      const sec = durationOf(a) || 2400;
      plays.push({ a, d, end: new Date(d.getTime() + sec * 1000), sec });
      const k = dayKey(d);
      listen[k] = (listen[k] || 0) + sec;
    };
    const hourOf = () => (rnd() < 0.38 ? 22 + Math.floor(rnd() * 2) : 7 + Math.floor(rnd() * 15));
    for (let day = new Date(year, 0, 1); day.getFullYear() === year; day.setDate(day.getDate() + 1)) {
      const m = day.getMonth();
      if (rnd() < (m === 7 ? 0.3 : 0.16)) continue;              // jours sans musique (un peu plus en août)
      const hot = deck.slice((m * 3) % (deck.length - 10), (m * 3) % (deck.length - 10) + 10);
      const n = 1 + Math.floor(rnd() * (day.getDay() === 0 || day.getDay() === 6 ? 5 : 3));
      for (let i = 0; i < n; i++) {
        const a = rnd() < 0.72 ? hot[Math.floor(Math.pow(rnd(), 1.7) * hot.length)] : pick(deck);
        play(a, day, hourOf());
      }
      listen[dayKey(day)] += Math.floor(rnd() * 1500);           // morceaux isolés, extraits…
    }
    // Un album « adopté » dès son ajout, et un fidèle toute l'année
    const fresh = deck.filter(a => added.get(a.id).startsWith(String(year))).slice(0, 3);
    fresh.forEach((a, k) => {
      const t0 = new Date(added.get(a.id));
      for (let i = 0; i < 6 - k * 2; i++) play(a, new Date(t0.getTime() + (i + 1) * 86400000 * 0.9), 21);
    });
    const loyal = deck[7];
    for (let m = 1; m < 9; m++) play(loyal, new Date(year, m, 3 + m * 2), 23);
    // Les moins écoutés : rien pour eux
    const rest = deck.slice(-3).map(a => a.id);
    const kept = plays.filter(p => !rest.includes(p.a.id));
    return { plays: kept, listen, added: a => added.get(a.id) || addedAt(a), demo: true };
  }

  function yearsWithData() {
    const ys = new Set(PLAYS.map(p => p.d.getFullYear()));
    Object.keys(LISTEN).forEach(k => ys.add(Number(k.slice(0, 4))));
    return [...ys].filter(y => y > 2000).sort();
  }

  // Classement d'albums à partir d'une liste d'écoutes
  function rankAlbums(plays) {
    const m = new Map();
    plays.forEach(p => {
      const r = m.get(p.a.id) || { a: p.a, n: 0, sec: 0, first: p.d };
      r.n += 1; r.sec += p.sec; if (p.d < r.first) r.first = p.d;
      m.set(p.a.id, r);
    });
    return [...m.values()].sort((x, y) => y.n - x.n || y.sec - x.sec || x.first - y.first);
  }

  function stats(year, src) {
    src = src || REAL;
    const plays = src.plays.filter(p => p.d.getFullYear() === year);
    const days = Object.keys(src.listen).filter(k => k.startsWith(year + "-")).map(k => [k, src.listen[k]]);
    const listened = days.reduce((s, [, v]) => s + v, 0) || plays.reduce((s, p) => s + p.sec, 0);
    const albums = rankAlbums(plays);

    // Par mois : temps d'écoute (journal) ou, à défaut, durée des albums écoutés
    const months = MONTHS.map((_, i) => {
      const mp = plays.filter(p => p.d.getMonth() === i);
      const key = year + "-" + String(i + 1).padStart(2, "0");
      const sec = days.filter(([k]) => k.startsWith(key)).reduce((s, [, v]) => s + v, 0) || mp.reduce((s, p) => s + p.sec, 0);
      return { i, plays: mp, sec, albums: new Set(mp.map(p => p.a.id)).size };
    });

    const collection = ALL.filter(a => !a.nextUp);
    const discovered = collection.filter(a => (src.added(a) || "").startsWith(String(year)));
    return { year, plays, days, listened, albums, months, collection, discovered, added: src.added, demo: src.demo };
  }

  // ---------- Rendu ----------

  function cover(a, cls) {
    const box = el("a", cls || "wr-cover");
    box.href = albumHref(a);
    box.title = a.title + " — " + a.artist;
    if (a.cover) {
      const img = el("img");
      img.src = localUrl(a.cover);
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => img.remove();
      box.appendChild(img);
    }
    return box;
  }

  function albumCard(r, rank, meta) {
    const card = el("div", "wr-card");
    card.appendChild(cover(r.a));
    const t = el("p", "wr-card-title");
    if (rank) t.appendChild(el("span", "wr-rank", rank + ". "));
    const link = el("a", null, r.a.title);
    link.href = albumHref(r.a);
    t.appendChild(link);
    const m = el("p", "wr-card-meta");
    const art = el("a", null, r.a.artist);
    art.href = artistUrl(r.a.artist);
    m.appendChild(art);
    card.append(t, m, el("p", "wr-card-meta", meta || plural(r.n, "écoute")));
    return card;
  }

  function section(title, cls) {
    const s = el("section", "wr-sec" + (cls ? " " + cls : ""));
    s.appendChild(el("h2", "wr-h", title));
    return s;
  }

  // Familles : barre de répartition + légende
  // Liens vers la collection (filtre ou recherche) : la collection propose alors « retour au wrapped »
  let shownYear = 0;
  const homeLink = query => "../index.html?" + query + "&wrapped=" + shownYear;
  function genreLinks(list) {
    const p = el("p", "wr-genres");
    list.forEach((g, i) => {
      if (i) p.appendChild(document.createTextNode(" · "));
      const a = el("a", null, g);
      a.href = homeLink("q=" + encodeURIComponent(g));
      a.title = "Rechercher « " + g + " » dans la collection";
      p.appendChild(a);
    });
    return p;
  }

  function familyBlock(plays) {
    const fam = countMap(plays, p => familyOf(p.a) || "Autres");
    const total = plays.length;
    const box = el("div", "wr-fams");
    const bar = el("div", "wr-fam");
    const leg = el("div", "wr-leg");
    fam.slice(0, 8).forEach(([f, n], i) => {
      const seg = el("a");
      seg.href = homeLink("famille=" + encodeURIComponent(f));
      seg.style.width = pct(n, total) + "%";
      seg.style.background = FAMILY_SHADES[i];
      seg.title = f + " : " + pct(n, total) + " %";
      bar.appendChild(seg);
      const row = el("a");
      row.href = homeLink("famille=" + encodeURIComponent(f));
      row.title = "Filtrer la collection : " + f;
      const dot = el("i");
      dot.style.background = FAMILY_SHADES[i];
      row.append(dot, document.createTextNode(f), el("span", null, pct(n, total) + " %"));
      leg.appendChild(row);
    });
    box.append(bar, leg);
    return box;
  }

  function topGenres(plays, n) {
    return countMap(plays, p => (p.a.genre || "").toLowerCase()).slice(0, n).map(([g]) => g);
  }

  function avgIntensity(plays) {
    const v = plays.map(p => Number(p.a.aggressivity)).filter(x => x > 0);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  }
  const fmtIntensity = x => (Math.round(x * 10) / 10).toString().replace(".", ",");

  // « (+12 h) » par rapport à l'année d'avant (rien si elle n'a pas d'écoute)
  function versus(S) {
    if (S.demo) return "";
    const prev = stats(S.year - 1).listened;
    if (!prev) return "";
    const diff = Math.round((S.listened - prev) / 3600);
    return " (" + (diff > 0 ? "+" : diff < 0 ? "−" : "±") + Math.abs(diff) + " h)";
  }

  function render(year, src) {
    shownYear = year;
    const S = stats(year, src);
    const root = $("wr-body");
    root.replaceChildren();
    document.title = "wrapped " + year + " · conductor.";
    if (S.demo) {
      root.appendChild(el("p", "wr-demo", "Démo : écoutes inventées à partir de votre collection, pour voir à quoi ressemble un bilan complet. Rien n'est enregistré."));
    }

    if (!S.plays.length) {
      root.appendChild(el("p", "empty", "Pas encore d'écoute comptée en " + year + " : le bilan se remplit à mesure que vous écoutez des albums avec le lecteur."));
      return;
    }

    // --- En-tête ---
    const hero = el("section", "wr-hero");
    const intro = el("div");
    intro.append(el("p", "wr-kicker", "votre année en musique"), el("h1", "wr-year", String(year)));
    const artists = new Set(S.plays.map(p => p.a.artist));
    intro.appendChild(el("p", "wr-sub", hours(S.listened) + " d'écoute, " + plural(S.albums.length, "album") +
      " écouté" + (S.albums.length > 1 ? "s" : "") +
      (S.discovered.length ? ", " + plural(S.discovered.length, "découverte") : "") + "."));
    intro.lastChild.append(document.createElement("br"), document.createTextNode("Voici ce qui a compté."));
    const mosaic = el("div", "wr-mosaic");
    S.albums.slice(0, 12).forEach(r => mosaic.appendChild(cover(r.a, "wr-cover")));
    hero.append(intro, mosaic);
    root.appendChild(hero);

    // --- Chiffres clés ---
    const nums = el("div", "wr-nums");
    [
      [hours(S.listened), "d'écoute · " + (S.listened >= 86400 ? plural(Math.floor(S.listened / 86400), "jour plein", "jours pleins") : "moins d'un jour plein") + versus(S)],
      [String(S.albums.length), "albums écoutés"],
      [String(S.discovered.length), "nouveaux albums ajoutés à la collection"],
      [String(artists.size), "artistes écoutés"]
    ].forEach(([v, l]) => {
      const d = el("div", "wr-num");
      d.append(el("b", null, v), el("span", null, l));
      nums.appendChild(d);
    });
    root.appendChild(nums);

    // --- Album de l'année ---
    const best = S.albums[0];
    const s1 = section("l'album de l'année");
    const top1 = el("div", "wr-top1");
    top1.appendChild(cover(best.a, "wr-top1-cover"));
    const info = el("div");
    info.appendChild(el("span", "wr-badge", "n° 1 · écouté " + plural(best.n, "fois", "fois")));
    const t = el("a", "wr-top1-title", best.a.title);
    t.href = albumHref(best.a);
    const by = el("p", "wr-top1-artist");
    const ba = el("a", null, best.a.artist);
    ba.href = artistUrl(best.a.artist);
    by.append(ba, document.createTextNode(yearOf(best.a) ? " · " + yearOf(best.a) : ""));
    const bestMonths = countMap(S.plays.filter(p => p.a.id === best.a.id), p => p.d.getMonth());
    const facts = el("div", "wr-facts");
    [
      [String(best.n), plural(best.n, "écoute").replace(/^\d+ /, "")],
      [hours(best.sec), "passées dessus"],
      [MONTHS[bestMonths[0][0]], "son mois"],
      [best.first.getDate() + " " + MONTHS_SHORT[best.first.getMonth()], "première écoute de l'année"]
    ].forEach(([v, l]) => { const d = el("div"); d.append(el("b", null, v), document.createTextNode(l)); facts.appendChild(d); });
    info.append(t, by, facts);
    top1.appendChild(info);
    s1.appendChild(top1);
    root.appendChild(s1);

    // --- Top 10 ---
    const s2 = section("le top 10");
    const grid = el("div", "wr-grid");
    S.albums.slice(0, 10).forEach((r, i) => grid.appendChild(albumCard(r, i + 1)));
    s2.appendChild(grid);
    root.appendChild(s2);

    // --- Artistes, familles, genres ---
    const s3 = el("section", "wr-sec wr-two");
    const left = el("div");
    left.appendChild(el("h2", "wr-h", "artistes de l'année"));
    countMap(S.plays, p => p.a.artist, p => p.sec).slice(0, 8).forEach(([name, sec], i) => {
      const row = el("a", "wr-art");
      row.href = artistUrl(name);
      row.append(el("span", "r", String(i + 1)), el("span", "n", name), el("span", "v", hours(sec)));
      left.appendChild(row);
    });
    const right = el("div");
    right.append(el("h2", "wr-h", "familles"), familyBlock(S.plays),
      el("h2", "wr-h wr-h-gap", "genres en tête"), genreLinks(topGenres(S.plays, 6)));
    s3.append(left, right);
    root.appendChild(s3);

    // --- Mois après mois ---
    const s4 = section("mois après mois · heures d'écoute");
    s4.appendChild(el("p", "wr-hint", "Survolez un mois pour le détail, cliquez pour son bilan."));
    const chart = el("div", "wr-months");
    const max = Math.max(1, ...S.months.map(m => m.sec));
    const peak = S.months.reduce((b, m) => (m.sec > b.sec ? m : b), S.months[0]);
    const tip = el("div", "wr-tip");
    tip.hidden = true;
    const detail = el("div", "wr-month");
    detail.hidden = true;
    let open = null;
    S.months.forEach(m => {
      const col = el("button", "wr-m" + (m === peak && m.sec ? " is-peak" : ""));
      col.type = "button";
      col.disabled = !m.plays.length && !m.sec;
      const bar = el("div", "wr-m-bar");
      bar.style.height = Math.max(m.sec ? 2 : 0, m.sec / max * 100) + "%";
      col.append(bar, el("span", null, MONTHS_SHORT[m.i]));
      col.addEventListener("mouseenter", () => {
        if (col.disabled) return;
        tip.replaceChildren(el("b", null, MONTHS[m.i]), el("span", null, hours(m.sec) + " d'écoute"),
          el("span", null, plural(m.albums, "album") + " écouté" + (m.albums > 1 ? "s" : "")));
        tip.hidden = false;
        const r = col.getBoundingClientRect(), c = chart.getBoundingClientRect();
        tip.style.left = (r.left - c.left + r.width / 2) + "px";
        tip.style.bottom = (c.bottom - r.top - (100 - parseFloat(bar.style.height)) / 100 * r.height + 26) + "px";
      });
      col.addEventListener("mouseleave", () => { tip.hidden = true; });
      col.addEventListener("click", () => {
        if (open === m) { open = null; detail.hidden = true; col.classList.remove("is-open"); return; }
        chart.querySelectorAll(".is-open").forEach(x => x.classList.remove("is-open"));
        col.classList.add("is-open");
        open = m;
        renderMonth(detail, year, m);
        detail.hidden = false;
      });
      chart.appendChild(col);
    });
    const chartBox = el("div", "wr-chart");
    chartBox.append(chart, tip);
    s4.append(chartBox, detail);

    // Saisons : top 3
    const seasons = el("div", "wr-seasons");
    SEASONS.forEach(([name, months, span]) => {
      const box = el("div", "wr-season");
      box.appendChild(el("h3", null, name));
      box.lastChild.title = span;
      const ranked = rankAlbums(S.plays.filter(p => months.includes(p.d.getMonth()))).slice(0, 3);
      if (!ranked.length) box.appendChild(el("p", "wr-hint", "pas d'écoute"));
      ranked.forEach((r, i) => {
        const row = el("a", "wr-srow");
        row.href = albumHref(r.a);
        const c = el("span", "wr-srow-cover");
        if (r.a.cover) { const img = el("img"); img.src = localUrl(r.a.cover); img.alt = ""; img.onerror = () => img.remove(); c.appendChild(img); }
        const txt = el("span", "wr-srow-text");
        txt.append(el("b", null, (i + 1) + ". " + r.a.title), el("small", null, r.a.artist + " · " + plural(r.n, "écoute")));
        row.append(c, txt);
        box.appendChild(row);
      });
      seasons.appendChild(box);
    });
    s4.append(el("h2", "wr-h wr-h-gap", "top 3 de chaque saison"), seasons);
    root.appendChild(s4);

    // --- Records ---
    const s5 = section("records");
    const recs = el("div", "wr-recs");
    const rec = (label, value, sub, href) => {
      const d = el(href ? "a" : "div", "wr-rec");
      if (href) d.href = href;
      d.append(el("span", null, label), el("b", null, value), el("small", null, sub));
      recs.appendChild(d);
    };

    // Jour le plus chargé
    const byDay = S.days.length ? S.days.slice() : countMap(S.plays, p => dayKey(p.d), p => p.sec);
    const busiest = byDay.sort((x, y) => y[1] - x[1])[0];
    if (busiest) {
      const d = new Date(busiest[0] + "T12:00");
      const n = new Set(S.plays.filter(p => dayKey(p.d) === busiest[0]).map(p => p.a.id)).size;
      rec("le jour le plus chargé", hoursMin(busiest[1]), longDate(d) + (n ? " · " + plural(n, "album") : ""));
    }

    // Plus longue série de jours d'écoute
    const active = new Set(S.days.filter(([, v]) => v > 0).map(([k]) => k).concat(S.plays.map(p => dayKey(p.d))));
    let bestRun = 0, bestEnd = null, run = 0, prev = null;
    [...active].sort().forEach(k => {
      const d = new Date(k + "T12:00");
      run = prev && Math.round((d - prev) / 86400000) === 1 ? run + 1 : 1;
      if (run > bestRun) { bestRun = run; bestEnd = d; }
      prev = d;
    });
    if (bestRun) {
      const start = new Date(bestEnd.getTime() - (bestRun - 1) * 86400000);
      rec("la plus longue série", plural(bestRun, "jour"), bestRun > 1
        ? "d'écoute d'affilée, du " + start.getDate() + " " + MONTHS[start.getMonth()] + " au " + bestEnd.getDate() + " " + MONTHS[bestEnd.getMonth()]
        : "d'écoute");
    }

    // Heure préférée (tranches de 2 h, d'après le début de l'écoute)
    const slots = countMap(S.plays, p => Math.floor(p.d.getHours() / 2));
    if (slots.length) {
      const [slot, n] = slots[0];
      const wd = countMap(S.plays, p => p.d.getDay())[0];
      rec("votre heure préférée", (slot * 2) + " h – " + (slot * 2 + 2 === 24 ? "minuit" : (slot * 2 + 2) + " h"),
        pct(n, S.plays.length) + " % de vos écoutes · le " + DAYS[wd[0]] + " en tête");
    }

    // Décennie la plus écoutée
    const dec = countMap(S.plays, p => { const y = yearOf(p.a); return y ? Math.floor(y / 10) * 10 : null; });
    if (dec.length) {
      const [d, n] = dec[0];
      const label = x => "années " + (x < 2000 ? String(x).slice(2) : String(x));
      const second = dec[1] ? " · puis les " + label(dec[1][0]) : "";
      rec("la décennie la plus écoutée", "les " + label(d),
        pct(n, S.plays.length) + " % de vos écoutes" + second);
    }

    // Le plus vite adopté : ajouté cette année, le plus écouté dans ses 7 premiers jours
    const quick = S.discovered.map(a => {
      const t0 = new Date(S.added(a));
      const n = S.plays.filter(p => p.a.id === a.id && p.d >= t0 && p.d - t0 < 7 * 86400000).length;
      return { a, n };
    }).sort((x, y) => y.n - x.n)[0];
    if (quick && quick.n >= 2) rec("le plus vite adopté", quick.a.title, quick.a.artist + " · " + quick.n + " écoutes sa 1ʳᵉ semaine", albumHref(quick.a));

    // Le plus fidèle : écouté le plus de mois d'affilée
    let loyal = null;
    S.albums.forEach(r => {
      const ms = [...new Set(S.plays.filter(p => p.a.id === r.a.id).map(p => p.d.getMonth()))].sort((a, b) => a - b);
      let len = 0, from = 0, bLen = 0, bFrom = 0;
      ms.forEach((m, i) => {
        if (i && m === ms[i - 1] + 1) len += 1; else { len = 1; from = m; }
        if (len > bLen) { bLen = len; bFrom = from; }
      });
      if (!loyal || bLen > loyal.len || (bLen === loyal.len && r.n > loyal.r.n)) loyal = { r, len: bLen, from: bFrom };
    });
    if (loyal && loyal.len >= 2) {
      rec("le plus fidèle", loyal.r.a.title, loyal.r.a.artist + " · écouté " + loyal.len + " mois d'affilée (" +
        MONTHS_EN[loyal.from] + " → " + MONTHS_EN[loyal.from + loyal.len - 1] + ")", albumHref(loyal.r.a));
    }

    s5.appendChild(recs);
    root.appendChild(s5);

    // --- Les moins écoutés ---
    const present = S.collection.filter(a => { const d = S.added(a); return !d || Number(d.slice(0, 4)) <= year; });
    const counts = new Map(S.albums.map(r => [r.a.id, r]));
    const least = present.map(a => ({ a, n: counts.has(a.id) ? counts.get(a.id).n : 0 }))
      .sort((x, y) => x.n - y.n || (S.added(x.a) || "").localeCompare(S.added(y.a) || "")).slice(0, 3);
    if (least.length) {
      const s6 = section("les moins écoutés de la collection");
      s6.appendChild(el("p", "wr-hint", "Dans la collection, et presque pas écoutés en " + year + " : à redécouvrir."));
      const g = el("div", "wr-grid wr-grid-3");
      least.forEach(r => g.appendChild(albumCard(r, 0, r.n ? plural(r.n, "écoute") : "aucune écoute")));
      s6.appendChild(g);
      root.appendChild(s6);
    }

    // --- L'année en une phrase ---
    const s7 = section("votre année en une phrase");
    s7.appendChild(sentence(S));
    root.appendChild(s7);
  }

  // Bilan d'un mois (clic sur sa barre)
  function renderMonth(box, year, m) {
    box.replaceChildren();
    const head = el("div", "wr-month-head");
    head.append(el("h3", null, MONTHS[m.i] + " " + year),
      el("span", null, hours(m.sec) + " d'écoute · " + plural(m.albums, "album") + " · " + plural(m.plays.length, "écoute")));
    box.appendChild(head);
    if (!m.plays.length) { box.appendChild(el("p", "wr-hint", "Pas d'album écouté en entier ce mois-ci.")); return; }
    const cols = el("div", "wr-month-cols");
    const topBox = el("div");
    topBox.appendChild(el("h4", "wr-h", "top 5"));
    const g = el("div", "wr-grid wr-grid-5");
    rankAlbums(m.plays).slice(0, 5).forEach((r, i) => g.appendChild(albumCard(r, i + 1)));
    topBox.appendChild(g);
    const side = el("div");
    const inten = avgIntensity(m.plays);
    side.append(el("h4", "wr-h", "familles"), familyBlock(m.plays),
      el("h4", "wr-h wr-h-gap", "genres en tête"), genreLinks(topGenres(m.plays, 5)),
      el("h4", "wr-h wr-h-gap", "intensité moyenne"));
    if (inten != null) {
      const meter = el("div", "wr-meter");
      const fill = el("span");
      fill.style.width = (inten * 10) + "%";
      meter.appendChild(fill);
      side.append(el("p", "wr-inten", fmtIntensity(inten) + " / 10"), meter);
    } else side.appendChild(el("p", "wr-hint", "pas d'intensité renseignée"));
    cols.append(topBox, side);
    box.appendChild(cols);
  }

  // « Une année plutôt nocturne et mélancolique, intensité moyenne 6,1 : … »
  function sentence(S) {
    const p = el("p", "wr-mood");
    const em = text => { const e = el("em", null, text); p.appendChild(e); };
    const txt = text => p.appendChild(document.createTextNode(text));
    const moods = countMap(S.plays, x => (x.a.moods || []).map(m => MOOD_FR[m.toLowerCase()] || null))
      .map(([m]) => m).filter((m, i, l) => l.indexOf(m) === i).slice(0, 2);
    txt("Une année");
    if (moods.length) { txt(" plutôt "); em(moods[0]); if (moods[1]) { txt(" et "); em(moods[1]); } }
    const inten = avgIntensity(S.plays);
    if (inten != null) { txt(", intensité moyenne "); em(fmtIntensity(inten)); }
    const parts = SEASONS.map(([name, months]) => {
      const g = topGenres(S.plays.filter(x => months.includes(x.d.getMonth())), 1)[0];
      return g ? [g, name] : null;
    }).filter(Boolean);
    if (parts.length) {
      txt(" : ");
      parts.forEach(([g, name], i) => {
        txt((i ? (i === parts.length - 1 ? " et " : ", ") : "") + g + (name === "printemps" ? " au printemps" : " en " + name));
      });
    }
    txt(".");
    return p;
  }

  // ---------- Bientôt : l'année en cours, avant sa sortie ----------

  const DRUMS = '<svg class="wr-drums" viewBox="0 0 600 400" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    // charleston
    '<path d="M70 176v190M70 366l-26 22M70 366l26 22M70 366v22"/><ellipse cx="70" cy="172" rx="50" ry="7"/><ellipse cx="70" cy="183" rx="50" ry="7"/>' +
    // cymbale crash
    '<path d="M536 110l26 256M562 366l-24 22M562 366l24 22"/><ellipse cx="536" cy="104" rx="60" ry="10" transform="rotate(-8 536 104)"/><path d="M536 96v-6"/>' +
    // caisse claire
    '<ellipse cx="150" cy="246" rx="52" ry="12"/><path d="M98 246v28a52 12 0 0 0 104 0v-28"/><path d="M110 254v24M130 257v24M150 258v24M170 257v24M190 254v24"/>' +
    '<path d="M150 288v44M150 332l-28 56M150 332l28 56"/>' +
    // grosse caisse
    '<circle cx="300" cy="272" r="96"/><circle cx="300" cy="272" r="80"/><circle cx="300" cy="272" r="22"/>' +
    '<path d="M232 340l-22 46M368 340l22 46M300 368v20"/>' +
    // toms
    '<path d="M300 176v-18"/>' +
    '<ellipse cx="252" cy="150" rx="40" ry="10"/><path d="M212 150v34a40 10 0 0 0 80 0v-34"/>' +
    '<ellipse cx="348" cy="150" rx="40" ry="10"/><path d="M308 150v34a40 10 0 0 0 80 0v-34"/>' +
    // tom basse
    '<ellipse cx="462" cy="232" rx="56" ry="14"/><path d="M406 232v84a56 14 0 0 0 112 0v-84"/><path d="M420 328l-8 60M504 328l8 60"/>' +
    '</svg>';

  function renderSoon(year) {
    document.title = "wrapped " + year + " · conductor.";
    const box = el("section", "wr-soon");
    box.innerHTML = DRUMS;
    box.append(el("p", "wr-soon-kicker", "wrapped " + year), el("h1", "wr-soon-title", "any day now"),
      el("p", "wr-soon-sub", "Encore un peu de patience."));
    $("wr-body").replaceChildren(box);
  }

  // ---------- Onglets : années réelles, démo, à venir ----------

  const params = new URLSearchParams(location.search);
  const preview = params.has("apercu");
  const now = new Date();
  const thisYear = now.getFullYear();
  const real = yearsWithData();
  const tabsList = real.filter(y => preview || wrappedReady(y, now)).map(y => ({ year: y, kind: "real" }));
  // Pas d'écoute l'an dernier : une démo, pour voir à quoi ressemble un bilan
  const demoYear = thisYear - 1;
  if (!real.includes(demoYear)) {
    const demo = makeDemo(demoYear);
    if (demo) tabsList.push({ year: demoYear, kind: "demo", src: demo });
  }
  if (!tabsList.some(t => t.year === thisYear)) tabsList.push({ year: thisYear, kind: "soon" });
  tabsList.sort((a, b) => a.year - b.year);

  const tabs = $("wr-years");
  const wanted = Number(params.get("annee"));
  let current = tabsList.find(t => t.year === wanted) || tabsList[tabsList.length - 1];

  function show(t) {
    current = t;
    // Pages ouvertes depuis le bilan (album, artiste…) : « retour au wrapped » et Échap y ramènent
    try {
      const here = location.href.split("?")[0] + "?annee=" + t.year;
      sessionStorage.setItem("conductor01.home", here);
      sessionStorage.setItem("conductor01.wrapped", here);
      history.replaceState(null, "", "?annee=" + t.year + (preview ? "&apercu" : ""));
    } catch (e) { /* stockage bloqué */ }
    paintTabs();
    if (t.kind === "soon") renderSoon(t.year);
    else render(t.year, t.src);
    if (t.kind === "real") {
      try { localStorage.setItem("conductor01.wrapped.seen", String(t.year)); } catch (e) { /* stockage bloqué */ }
    }
  }

  function paintTabs() {
    tabs.replaceChildren(...tabsList.map(t => {
      const b = el("button", "wr-tab" + (t === current ? " is-on" : ""), t.year + (t.kind === "demo" ? " · démo" : ""));
      b.type = "button";
      b.addEventListener("click", () => { show(t); window.scrollTo(0, 0); });
      return b;
    }));
  }
  show(current);
})();
