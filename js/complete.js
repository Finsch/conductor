// conductor. — page « à compléter »
//
// Les albums de la collection auxquels il manque quelque chose : pochette
// (ou pochette seulement en ligne), genre, date de sortie, liste des titres,
// intensité, ressenti.
// Un clic sur l'album ouvre sa page pour compléter. Le × d'une étiquette
// l'ignore pour cet album — album.ignoreMissing garde ces choix.

(function () {
  const $ = id => document.getElementById(id);
  const PAGE = 50;
  const FILTER_KEY = "conductor01.complete.filter";

  try { sessionStorage.setItem("conductor01.home", location.href.split("?")[0]); } catch (e) {}

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- Ce qui peut manquer ----------

  // Critères partagés avec la page insights (js/data.js : ALBUM_CHECKS)
  const CHECKS = ALBUM_CHECKS;

  function gaps(a) {
    const skip = new Set(a.ignoreMissing || []);
    return CHECKS.map(c => ({ check: c, value: skip.has(c.id) ? false : c.missing(a) })).filter(g => g.value);
  }

  // ---------- Rendu ----------

  let filter = "all";
  try { filter = sessionStorage.getItem(FILTER_KEY) || "all"; } catch (e) {}
  let shown = PAGE;

  function coverEl(a) {
    const box = el("div", "row-cover");
    const src = a.cover || (a.serverCover && Server.isConfigured() ? Server.coverUrl(a.serverCover, 100) : "");
    if (src) {
      const img = el("img");
      img.src = localUrl(src);
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => img.remove();
      box.appendChild(img);
    }
    return box;
  }

  function ignore(a, id) {
    Store.update(a.id, { ignoreMissing: [...new Set((a.ignoreMissing || []).concat(id))] });
  }

  function row(a, list) {
    const li = el("li", "co-row");
    const link = el("a", "co-album");
    link.href = "album.html?id=" + encodeURIComponent(a.id);
    const text = el("div", "row-text");
    text.append(el("p", "row-title", a.title), el("p", "row-artist", a.artist));
    link.append(coverEl(a), text);

    const tags = el("div", "co-gaps");
    list.forEach(g => {
      const t = el("span", "co-gap" + (filter === g.check.id ? " is-match" : ""));
      t.append(g.check.label + (typeof g.value === "string" ? " " + g.value : ""));
      const x = el("button", "co-ignore", "×");
      x.type = "button";
      x.title = "Ignorer pour cet album";
      x.setAttribute("aria-label", "Ignorer « " + g.check.label + " » pour cet album");
      x.addEventListener("click", () => ignore(a, g.check.id));
      t.appendChild(x);
      tags.appendChild(t);
    });
    li.append(link, tags);
    return li;
  }

  function render() {
    const albums = Store.all();
    const withGaps = albums.map(a => ({ a, list: gaps(a) })).filter(x => x.list.length);

    // Filtres : un par critère, avec le nombre d'albums concernés
    const counts = Object.fromEntries(CHECKS.map(c => [c.id, withGaps.filter(x => x.list.some(g => g.check.id === c.id)).length]));
    if (filter !== "all" && !counts[filter]) filter = "all";
    const chip = (id, label, n) => {
      const b = el("button", "chip" + (filter === id ? " is-active" : ""), label + " " + n);
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(filter === id));
      b.disabled = !n;
      b.addEventListener("click", () => {
        filter = id;
        shown = PAGE;
        try { sessionStorage.setItem(FILTER_KEY, id); } catch (e) {}
        render();
      });
      return b;
    };
    $("co-filters").replaceChildren(chip("all", "tout", withGaps.length),
      ...CHECKS.map(c => chip(c.id, c.label, counts[c.id])));

    const list = withGaps
      .filter(x => filter === "all" || x.list.some(g => g.check.id === filter))
      .sort((x, y) => y.list.length - x.list.length ||
        (y.a.addedAt || "").localeCompare(x.a.addedAt || ""));

    $("co-facts").textContent = withGaps.length + " fiche" + (withGaps.length > 1 ? "s" : "") + " sur " + albums.length + " à compléter";
    $("co-empty").hidden = list.length > 0;
    $("co-list").replaceChildren(...list.slice(0, shown).map(x => row(x.a, x.list)));
    $("co-pager").hidden = list.length <= shown;
  }

  $("co-more").addEventListener("click", () => { shown += PAGE; render(); });
  document.addEventListener("albums:changed", render);
  render();
})();
