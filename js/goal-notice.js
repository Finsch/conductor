// conductor. — collection : rappel de l'objectif de la semaine (1 album découvert)
// Affiché une fois par ouverture de l'application (pas à chaque retour sur la collection).

(function () {
  const box = document.getElementById("goal-notice");
  if (!box || typeof weeklyGoal !== "function") return;
  let open = "", seen = "";
  try {
    open = sessionStorage.getItem("conductor01.appOpen") || "";
    seen = sessionStorage.getItem("conductor01.goalNoticeSeen") || "";
  } catch (e) {}
  if (!open || open === seen) return;
  try { sessionStorage.setItem("conductor01.goalNoticeSeen", open); } catch (e) {}
  const g = weeklyGoal();
  if (g.done) return;   // objectif atteint : pas de rappel

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }


  const text = el("span", "goal-text");
  text.append(el("span", "goal-kicker", "objectif"),
    document.createTextNode("· découvrir 1 album par semaine · " + (g.daysLeft <= 1 ? "dernier jour" : "encore " + g.daysLeft + " jours")));
  const link = el("a", "goal-link", "piocher dans next up →");
  link.href = "pages/nextup.html";
  const close = el("button", "icon-btn", "×");
  close.type = "button";
  close.title = "Masquer";
  close.setAttribute("aria-label", "Masquer");
  close.addEventListener("click", () => { box.hidden = true; });
  box.append(text, link, close);
  box.hidden = false;
})();
