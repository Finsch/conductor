// conductor. — collection : rappel d'archive (js/archive.js), toutes les 2 semaines
// Affiché une fois par ouverture de l'application, si la dernière archive date de
// 14 jours ou plus (ou s'il n'y en a jamais eu).

(function () {
  const box = document.getElementById("archive-notice");
  if (!box) return;
  const EVERY_DAYS = 14;
  let open = "", seen = "", last = "";
  try {
    open = sessionStorage.getItem("conductor01.appOpen") || "";
    seen = sessionStorage.getItem("conductor01.archiveNoticeSeen") || "";
    last = localStorage.getItem("conductor01.archive.last") || "";
  } catch (e) {}
  if (!open || open === seen) return;
  const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
  if (days != null && days < EVERY_DAYS) return;
  try { sessionStorage.setItem("conductor01.archiveNoticeSeen", open); } catch (e) {}

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  const text = el("span", "goal-text");
  text.append(el("span", "goal-kicker", "archive"),
    document.createTextNode("· " + (days == null ? "aucune archive de vos données pour l'instant" : "dernière il y a " + days + " jours")));
  const go = el("button", "goal-link text-btn", "archiver maintenant →");
  go.type = "button";
  go.addEventListener("click", () => {
    if (window.top !== window) parent.postMessage({ conductor: true, type: "cmd", name: "archive", args: [] }, "*");
    else if (window.Archive) Archive.run();
  });
  const close = el("button", "icon-btn", "×");
  close.type = "button";
  close.title = "Masquer";
  close.setAttribute("aria-label", "Masquer");
  close.addEventListener("click", () => { box.hidden = true; });
  box.append(text, go, close);
  box.hidden = false;
  // Archive faite (bouton ci-dessus, pied de page ou Maj + A) : le rappel disparaît
  window.addEventListener("storage", e => { if (e.key === "conductor01.archive.last" && e.newValue) box.hidden = true; });
})();
