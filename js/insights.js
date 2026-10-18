// conductor. — page « insights » : la collection en chiffres
//
// Tout est calculé à partir de la collection (Store.all) ; next up seulement
// pour son compteur. Graphiques sobres en HTML/CSS : barres neutres (gris clair),
// valeur écrite au bout de chaque barre, détail au survol, et un clic mène
// à la collection filtrée quand c'est possible.

(function () {
  const $ = id => document.getElementById(id);
  const HOME = "../index.html";

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function plural(n, word, pluralWord) {
    return n + " " + (n > 1 ? (pluralWord || word + "s") : word);
  }

  function yearOf(a) {
    if (a.releaseDate) return Number(a.releaseDate.slice(0, 4));
    return a.year || null;
  }

  function durationOf(a) {
    if (a.duration) return a.duration;
    return (a.tracks || []).reduce((s, t) => s + (t.duration || 0), 0) || null;
  }

  function addedAt(a) {
    return a.addedAt || (a.logs && a.logs[0] && a.logs[0].loggedAt) || "";
  }

  // "5 j 20 h 40 min"
  function formatTotal(sec) {
    sec = Math.round(sec || 0);
    if (sec < 3600) return formatLength(sec);
    const units = [["mois", 30 * 86400], ["j", 86400], ["h", 3600], ["min", 60]];
    const parts = [];
    let rest = sec;
    units.forEach(([label, size]) => {
      const n = Math.floor(rest / size);
      rest -= n * size;
      if (n) parts.push(n + " " + label);
    });
    return parts.join(" ");
  }

  function countBy(list, keysOf) {
    const m = new Map();
    list.forEach(a => keysOf(a).forEach(k => { if (k) m.set(k, (m.get(k) || 0) + 1); }));
    return m;
  }

  function albumLink(a) {
    return "album.html?id=" + encodeURIComponent(a.id);
  }

  // ---------- Graphiques ----------

  // Barres horizontales : [{ label, value, href, tip }]
  function hbars(box, rows, total) {
    const max = Math.max(1, ...rows.map(r => r.value));
    box.replaceChildren(...rows.map(r => {
      const row = el(r.href ? "a" : "div", "in-hbar");
      if (r.href) row.href = r.href;
      row.title = r.tip || (r.label + " : " + plural(r.value, "album") +
        (total ? " (" + Math.round(r.value / total * 100) + " %)" : ""));
      const track = el("span", "in-hbar-track");
      const fill = el("span", "in-hbar-fill");
      fill.style.width = (r.value / max * 100) + "%";
      track.appendChild(fill);
      row.append(el("span", "in-hbar-label", r.label), track, el("span", "in-hbar-value", String(r.value)));
      return row;
    }));
    if (!rows.length) box.replaceChildren(el("p", "hint", "Pas encore de données."));
  }

  // Colonnes verticales : [{ label, value, href, tip }]
  function cols(box, rows) {
    const max = Math.max(1, ...rows.map(r => r.value));
    box.style.setProperty("--n", rows.length);
    box.replaceChildren(...rows.map(r => {
      const col = el(r.href && r.value ? "a" : "div", "in-col" + (r.value ? "" : " is-zero"));
      if (r.href && r.value) col.href = r.href;
      col.title = r.tip || (r.label + " : " + plural(r.value, "album"));
      const bar = el("span", "in-col-bar");
      bar.style.height = (r.value / max * 100) + "%";
      const area = el("span", "in-col-area");
      area.append(el("span", "in-col-value", r.value ? String(r.value) : ""), bar);
      col.append(area, el("span", "in-col-label", r.label));
      return col;
    }));
  }

  // ---------- À redécouvrir ----------
  // Albums jamais écoutés avec le lecteur, ou pas depuis longtemps : 5 tirés au
  // hasard parmi les 30 plus « oubliés » (plus c'est ancien, plus il a de chances).
  // Référence : dernière écoute comptée, sinon date d'ajout.

  const DAY = 86400000;

  function lastPlayAt(a) {
    const p = a.plays || [];
    return p.length ? p[p.length - 1].at : "";
  }

  function ago(iso) {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
    if (days < 1) return "aujourd'hui";
    if (days < 60) return "il y a " + days + " j";
    if (days < 730) return "il y a " + Math.floor(days / 30) + " mois";
    return "il y a " + Math.floor(days / 365) + " ans";
  }

  function renderRediscover() {
    const now = Date.now();
    const scored = Store.all().map(a => {
      const last = lastPlayAt(a);
      const ref = last || addedAt(a);
      const days = ref ? (now - new Date(ref).getTime()) / DAY : 365;
      // jamais écouté : bonus, pour passer devant à ancienneté égale
      return { a, last, weight: Math.max(1, days) * (last ? 1 : 1.5) };
    }).sort((x, y) => y.weight - x.weight).slice(0, 30);

    const picked = [];
    const left = scored.slice();
    while (picked.length < 5 && left.length) {
      let x = Math.random() * left.reduce((s, r) => s + r.weight, 0);
      let i = 0;
      while (i < left.length - 1 && (x -= left[i].weight) > 0) i++;
      picked.push(left.splice(i, 1)[0]);
    }

    $("in-rediscover").replaceChildren(...(picked.length ? picked.map(({ a, last }) => {
      const li = el("li");
      const link = el("a", "rec-link");
      link.href = albumLink(a);
      link.append(el("span", "rec-title", a.title), document.createTextNode(" - " + a.artist));
      li.append(link, el("span", "in-list-value", last ? "écouté " + ago(last) : "jamais écouté ici"));
      return li;
    }) : [el("li", "hint", "Rien à redécouvrir pour l'instant.")]));
  }

  $("in-rediscover-more").addEventListener("click", renderRediscover);

  // ---------- Rendu ----------

  function render() {
    const all = Store.all();
    $("in-empty").hidden = all.length > 0;
    $("in-body").hidden = !all.length;
    if (!all.length) return;

    // Chiffres clés
    const artists = new Set(all.map(a => a.artist)).size;
    const total = all.reduce((s, a) => s + (durationOf(a) || 0), 0);
    const tiles = [
      [String(all.length), "albums"],
      [String(artists), "artistes"],
      [formatTotal(total), "d'écoute au total"],
      [String(Store.nextUp().length), "dans next up"]
    ];
    $("in-tiles").replaceChildren(...tiles.map(([v, l]) => {
      const t = el("div", "in-tile" + (v.length > 9 ? " is-long" : ""));
      t.append(el("p", "in-tile-value", v), el("p", "in-tile-label", l));
      return t;
    }));

    // Familles
    const fam = countBy(all, a => [familyOf(a)]);
    hbars($("in-families"), [...fam].sort((x, y) => y[1] - x[1]).map(([f, n]) => ({
      label: f, value: n, href: HOME + "?famille=" + encodeURIComponent(f)
    })), all.length);

    // Artistes (2 albums et plus)
    const art = countBy(all, a => [a.artist]);
    hbars($("in-artists"), [...art].filter(([, n]) => n > 1).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], "fr"))
      .slice(0, 10).map(([name, n]) => ({ label: name, value: n, href: HOME + "?reset=1&q=" + encodeURIComponent(name) })));

    // Décennies
    const dec = countBy(all, a => { const y = yearOf(a); return y ? [String(Math.floor(y / 10) * 10)] : []; });
    const decs = [...dec.keys()].map(Number);
    if (decs.length) {
      const rows = [];
      for (let d = Math.min(...decs); d <= Math.max(...decs); d += 10) {
        const n = dec.get(String(d)) || 0;
        rows.push({ label: (d < 1950 ? String(d) : String(d).slice(2)) + "s", value: n,
          // La collection regroupe tout ce qui précède 1950 sous « avant 1950 »
          href: HOME + "?decennie=" + (d < 1950 ? "avant" : d),
          tip: "Années " + d + " : " + plural(n, "album") + (d < 1950 ? " (filtre « avant 1950 »)" : "") });
      }
      cols($("in-decades"), rows);
    }

    // Intensité
    const inten = countBy(all, a => (a.aggressivity ? [String(a.aggressivity)] : []));
    cols($("in-intensity"), Array.from({ length: 10 }, (_, i) => {
      const n = inten.get(String(i + 1)) || 0;
      return { label: String(i + 1), value: n, href: HOME + "?intensite=" + (i + 1),
        tip: "Intensité " + (i + 1) + "/10 : " + plural(n, "album") };
    }));
    const rated = all.filter(a => a.aggressivity);
    const avg = rated.length ? rated.reduce((s, a) => s + a.aggressivity, 0) / rated.length : 0;
    $("in-intensity-note").textContent = rated.length
      ? "Moyenne " + avg.toFixed(1).replace(".", ",") + "/10 · " + rated.length + " albums notés sur " + all.length
      : "Aucune intensité notée.";

    // Ressentis et styles
    const top = (m, n) => [...m].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], "fr")).slice(0, n);
    hbars($("in-moods"), top(countBy(all, a => [...new Set((a.moods || []).map(m => m.toLowerCase()))]), 10)
      .map(([m, n]) => ({ label: m, value: n, href: HOME + "?reset=1&q=" + encodeURIComponent(m) })));
    hbars($("in-styles"), top(countBy(all, a => [...new Set((a.styles || []).map(s => s.toLowerCase()))]), 10)
      .map(([s, n]) => ({ label: s, value: n, href: HOME + "?reset=1&q=" + encodeURIComponent(s) })));

    // Ajouts par mois (12 derniers mois)
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return { key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), d };
    });
    const added = countBy(all, a => [addedAt(a).slice(0, 7)]);
    cols($("in-months"), months.map(({ key, d }) => {
      const n = added.get(key) || 0;
      const name = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      return { label: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""), value: n,
        tip: name + " : " + plural(n, "album ajouté", "albums ajoutés") };
    }));

    // Les plus écoutés
    const played = all.filter(a => (a.plays || []).length)
      .sort((x, y) => y.plays.length - x.plays.length || (y.plays[y.plays.length - 1].at || "").localeCompare(x.plays[x.plays.length - 1].at || ""))
      .slice(0, 5);
    $("in-plays").replaceChildren(...(played.length ? played.map(a => {
      const li = el("li");
      const link = el("a", "rec-link");
      link.href = albumLink(a);
      link.append(el("span", "rec-title", a.title), document.createTextNode(" - " + a.artist));
      li.append(link, el("span", "in-list-value", plural(a.plays.length, "écoute")));
      return li;
    }) : [el("li", "hint", "Pas encore d'écoute comptée : elles s'ajoutent en écoutant vos fichiers avec le lecteur.")]));

    // Records
    const withLen = all.filter(durationOf);
    const withYear = all.filter(yearOf);
    const records = [];
    const rec = (label, a, extra) => {
      if (!a) return;
      const dd = el("dd");
      const link = el("a", "rec-link");
      link.href = albumLink(a);
      link.append(el("span", "rec-title", a.title), document.createTextNode(" - " + a.artist));
      dd.append(link, el("span", "in-list-value", extra));
      records.push(el("dt", null, label), dd);
    };
    const by = (list, f, dir) => list.slice().sort((x, y) => dir * (f(x) - f(y)))[0];
    rec("le plus long", by(withLen, durationOf, -1), formatLength(durationOf(by(withLen, durationOf, -1) || {}) || 0));
    rec("le plus court", by(withLen, durationOf, 1), formatLength(durationOf(by(withLen, durationOf, 1) || {}) || 0));
    rec("le plus ancien", by(withYear, yearOf, 1), String(yearOf(by(withYear, yearOf, 1) || {}) || ""));
    rec("le plus récent", by(withYear, yearOf, -1), String(yearOf(by(withYear, yearOf, -1) || {}) || ""));
    const lastAdded = all.slice().sort((x, y) => addedAt(y).localeCompare(addedAt(x)))[0];
    rec("dernier ajout", lastAdded, addedAt(lastAdded)
      ? new Date(addedAt(lastAdded)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "");
    $("in-records").replaceChildren(...records);
  }

  document.addEventListener("albums:changed", render);
  render();
  renderRediscover();   // une fois par visite (le bouton « d'autres » en tire de nouveaux)
})();
