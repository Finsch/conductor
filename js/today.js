// conductor. — « Ce jour-là » : les anniversaires de sortie des albums de la collection
//
// Page journal : une bannière par album, empilées comme des notifications.
// « Aujourd'hui, OK Computer de Radiohead a 29 ans. »
// Rien aujourd'hui : le prochain anniversaire de la semaine (« Demain, … aura 25 ans »).
// Seules les dates de sortie complètes comptent (pas les « 1er janvier » de remplissage).
// × sur une bannière : masquée jusqu'au lendemain.

(function () {
  const box = document.getElementById("today-stack");
  if (!box || typeof Store === "undefined") return;
  const KEY = "conductor01.today.hidden";   // { date, ids: [...] }
  const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
    "septembre", "octobre", "novembre", "décembre"];
  const ROUND = new Set([10, 20, 25, 30, 40, 50, 60, 70, 75]);
  const MAX = 6;

  const md = d => String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function hiddenIds(today) {
    try {
      const h = JSON.parse(localStorage.getItem(KEY) || "null");
      return h && h.date === today && Array.isArray(h.ids) ? h.ids : [];
    } catch (e) { return []; }
  }
  function hide(today, id) {
    const ids = hiddenIds(today).concat(id);
    try { localStorage.setItem(KEY, JSON.stringify({ date: today, ids })); } catch (e) {}
  }

  function render() {
    const now = new Date();
    const today = now.toLocaleDateString("sv-SE");
    const gone = hiddenIds(today);

    const albums = Store.all().filter(a => /^\d{4}-\d\d-\d\d$/.test(a.releaseDate || "") && !a.releaseDate.endsWith("-01-01"));
    let hits = [], day = null, k = 0;
    for (; k < 7 && !hits.length; k++) {
      day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
      const key = md(day);
      hits = albums.filter(a => a.releaseDate.slice(5) === key && Number(a.releaseDate.slice(0, 4)) < day.getFullYear());
    }
    k -= 1;
    hits = hits.filter(a => !gone.includes(a.id));
    if (!hits.length) { box.hidden = true; box.replaceChildren(); return; }

    // Les anniversaires ronds d'abord, puis les plus anciens
    const age = a => day.getFullYear() - Number(a.releaseDate.slice(0, 4));
    hits.sort((x, y) => (ROUND.has(age(y)) - ROUND.has(age(x))) || age(y) - age(x));

    const when = k === 0 ? "Aujourd'hui" : k === 1 ? "Demain"
      : DAYS[day.getDay()].replace(/^./, c => c.toUpperCase()) + " " + day.getDate() + " " + MONTHS[day.getMonth()];
    const verb = k === 0 ? " a " : " aura ";

    box.replaceChildren(...hits.slice(0, MAX).map(a => {
      const card = el("div", "today-card");
      const link = el("a", "today-item");
      link.href = APP_ROOT + "pages/album.html?id=" + encodeURIComponent(a.id);
      link.title = "Sorti le " + Number(a.releaseDate.slice(8)) + " " + MONTHS[Number(a.releaseDate.slice(5, 7)) - 1] + " " + a.releaseDate.slice(0, 4);
      const c = el("span", "today-cover");
      if (a.cover) { const img = el("img"); img.src = localUrl(a.cover); img.alt = ""; img.onerror = () => img.remove(); c.appendChild(img); }
      const txt = el("span", "today-text");
      const de = /^[aeiouyhàâäéèêëîïôöûü]/i.test(a.artist) ? " d'" : " de ";
      const years = el("span", ROUND.has(age(a)) ? "today-round" : null, age(a) + " ans");
      if (ROUND.has(age(a))) years.title = "Anniversaire rond";
      txt.append(document.createTextNode(when + ", "), el("em", null, a.title),
        document.createTextNode(de + a.artist + verb), years, document.createTextNode("."));
      link.append(c, txt);
      const close = el("button", "icon-btn today-close", "×");
      close.type = "button";
      close.title = "Masquer jusqu'à demain";
      close.setAttribute("aria-label", "Masquer jusqu'à demain");
      close.addEventListener("click", () => { hide(today, a.id); render(); });
      card.append(el("span", "today-kicker", "ce jour-là"), link, close);
      return card;
    }));
    box.hidden = false;
  }

  render();
  document.addEventListener("albums:changed", render);
})();
