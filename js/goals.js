// conductor. — objectif de la semaine (journal) : 1 album découvert par semaine
//
// Découvert = écouté pour la première fois avec le lecteur. Semaine = lundi → dimanche.
// Calcul partagé : weeklyGoal() dans js/data.js.

(function () {
  const list = document.getElementById("gl-list");
  if (!list || typeof weeklyGoal !== "function") return;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function render() {
    const g = weeklyGoal();
    const item = el("div", "gl-item" + (g.done ? " is-done" : ""));
    item.appendChild(el("p", "gl-name", WEEKLY_GOAL + " album découvert par semaine"));

    const bar = el("div", "gl-bar");
    const fill = el("span");
    fill.style.width = Math.min(100, g.count / WEEKLY_GOAL * 100) + "%";
    bar.appendChild(fill);

    const status = el("p", "gl-status");
    status.append(el("b", null, g.count + " / " + WEEKLY_GOAL),
      document.createTextNode(" cette semaine · "),
      g.done ? el("span", "gl-ok", "atteint ✓")
        : document.createTextNode(g.daysLeft <= 1 ? "dernier jour" : "encore " + g.daysLeft + " jours"));

    const hist = el("div", "gl-hist");
    g.history.forEach(h => {
      const sq = el("span", "gl-sq" + (h.ok ? " is-ok" : h.before ? "" : " is-missed"));
      sq.title = "Semaine du " + h.start.toLocaleDateString("fr-FR") + " · " +
        (h.before ? "avant le suivi des écoutes" : h.count + " découvert" + (h.count > 1 ? "s" : "") + (h.ok ? "" : " · objectif manqué"));
      hist.appendChild(sq);
    });
    const cur = el("span", "gl-sq is-current" + (g.done ? " is-ok" : ""));
    cur.title = "Cette semaine";
    hist.appendChild(cur);
    if (g.streak > 1) hist.appendChild(el("span", "gl-streak", "série : " + g.streak + " semaines"));

    item.append(bar, status, hist);

    // Les deux dernières découvertes de la semaine
    if (g.albums.length) {
      const last = g.albums.slice(-2).reverse();
      const found = el("p", "gl-found");
      found.appendChild(document.createTextNode("découvertes : "));
      last.forEach((a, i) => {
        if (i) found.appendChild(document.createTextNode(", "));
        const link = el("a", null, a.title);
        link.href = "album.html?id=" + encodeURIComponent(a.id);
        link.title = a.title + " — " + a.artist;
        found.appendChild(link);
      });
      item.appendChild(found);
    }
    list.replaceChildren(item);
  }

  render();
  document.addEventListener("albums:changed", render);
})();
