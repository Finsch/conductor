// À propos : sommaire à gauche (suivi de la lecture) et agrandissement des captures
(function () {
  "use strict";

  const article = document.getElementById("about");
  const toc = document.getElementById("ab-toc");
  if (!article || !toc) return;

  // « conductor. » dans le texte : petit style de marque (comme du code)
  function markBrand(root) {
    const skip = "H1,CODE,PRE,KBD,SCRIPT,STYLE,TEXTAREA,.ab-brand";
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => /conductor\./.test(n.nodeValue) && !n.parentElement.closest(skip)
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const frag = document.createDocumentFragment();
      n.nodeValue.split(/(conductor\.)/).forEach(part => {
        if (!part) return;
        if (part === "conductor.") {
          const b = document.createElement("span");
          b.className = "ab-brand";
          b.textContent = part;
          frag.appendChild(b);
        } else frag.appendChild(document.createTextNode(part));
      });
      n.replaceWith(frag);
    });
  }
  markBrand(article);

  // ---------- Sommaire construit depuis les titres ----------
  const heads = [...article.querySelectorAll("section > h2, section > h3[id]")];
  const links = new Map();
  let group = null;
  heads.forEach(h => {
    const id = h.id || h.parentElement.id;
    const a = document.createElement("a");
    a.href = "#" + id;
    a.textContent = h.textContent;
    a.addEventListener("click", e => {
      e.preventDefault();
      document.getElementById(id).scrollIntoView({ behavior: "smooth", block: "start" });
      try { history.replaceState(null, "", "#" + id); } catch (err) { /* file:// */ }
    });
    const li = document.createElement("li");
    li.appendChild(a);
    if (h.tagName === "H2") {
      toc.appendChild(li);
      group = document.createElement("ol");
      li.appendChild(group);
    } else {
      li.className = "ab-toc-sub";
      group.appendChild(li);
    }
    links.set(id, a);
  });
  toc.querySelectorAll("ol:empty").forEach(ol => ol.remove());

  // ---------- Suivi : la partie lue est surlignée ----------
  const targets = [...links.keys()].map(id => document.getElementById(id));
  function spy() {
    const line = 140;
    let cur = targets[0];
    for (const t of targets) {
      if (t.getBoundingClientRect().top - line <= 0) cur = t; else break;
    }
    // en bas de page : la dernière partie
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = targets[targets.length - 1];
    links.forEach(a => a.classList.remove("is-on"));
    const a = links.get(cur.id);
    a.classList.add("is-on");
    const parent = a.closest("li:not(.ab-toc-sub)");
    toc.querySelectorAll("li.is-open").forEach(li => li !== parent && li.classList.remove("is-open"));
    if (parent) parent.classList.add("is-open");
  }
  let raf = 0;
  window.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; spy(); }); }, { passive: true });
  window.addEventListener("resize", spy);

  // lien direct vers une partie (about.html#donnees)
  const start = location.hash.slice(1);
  if (start && document.getElementById(start)) document.getElementById(start).scrollIntoView();
  spy();

  // ---------- Captures : clic pour agrandir ----------
  const zoom = document.getElementById("ab-zoom");
  const zimg = zoom.querySelector("img");
  article.querySelectorAll(".ab-shot img").forEach(img => {
    img.title = "Agrandir";
    img.addEventListener("click", () => {
      zimg.src = img.src;
      zimg.alt = img.alt;
      zoom.hidden = false;
    });
  });
  const close = () => { zoom.hidden = true; zimg.removeAttribute("src"); };
  zoom.addEventListener("click", close);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !zoom.hidden) { e.stopImmediatePropagation(); e.preventDefault(); close(); }
  }, true);
})();
