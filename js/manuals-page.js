// conductor. — pages des manuels
//   manuals.html          : la liste des guides (js/manuals.js)
//   manual.html?g=<id>    : un guide, en étapes numérotées et cochables

(function () {
  const $ = id => document.getElementById(id);
  const DONE_KEY = "conductor01.manuals.done";   // { guide: [n° d'étape cochés] }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  const ICONS = {
    install: '<path d="M12 3v11M7.5 9.5L12 14l4.5-4.5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    daily: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/><path d="M10.5 8.5v5l4-2.5z" fill="currentColor"/>',
    karaoke: '<g transform="translate(15.8 6.4) rotate(40)"><circle r="4.6" fill="currentColor" stroke="none"/><path d="M-3 4.7A5.6 5.6 0 0 0 3 4.7L1.2 12.2a1.2 1.2 0 0 1-2.4 0z" fill="currentColor" stroke="none"/></g><path d="M7 16.6c-1.7.8-2.8 1.9-2 2.9.8 1 2.7.3 3.4 1.2.6.8-.1 1.8-.8 2.4"/>',
    tier: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>'
  };
  const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";

  function readDone() {
    try { return JSON.parse(localStorage.getItem(DONE_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeDone(d) {
    try { localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch (e) {}
  }

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

  const stepCount = g => g.parts.reduce((s, p) => s + p.steps.length, 0);

  // ---------- Liste des guides ----------

  if ($("mn-cards")) {
    const done = readDone();
    $("mn-cards").replaceChildren(...MANUALS.map(g => {
      const a = el("a", "mn-card");
      a.href = "manual.html?g=" + encodeURIComponent(g.id);
      const n = stepCount(g), d = (done[g.id] || []).length;
      a.append(el("span", "mn-card-icon", icon(g.icon)));
      const text = el("div", "mn-card-text");
      text.append(el("p", "mn-card-title", g.title), el("p", "mn-card-short", g.short),
        el("p", "mn-card-meta", g.time + " · " + n + " étapes" + (d ? " · " + d + " cochée" + (d > 1 ? "s" : "") : "")));
      a.append(text, el("span", "mn-card-go", "→"));
      return a;
    }));
    markBrand(document.querySelector("main"));
    return;
  }

  // ---------- Un guide ----------

  const id = new URLSearchParams(location.search).get("g");
  const guide = MANUALS.find(g => g.id === id);
  if (!guide) { $("mn-missing").hidden = false; return; }

  document.title = guide.title + " · conductor.";
  $("mn-guide").hidden = false;
  $("mn-icon").innerHTML = icon(guide.icon);
  $("mn-title").textContent = guide.title;
  $("mn-meta").textContent = guide.time + " · " + stepCount(guide) + " étapes";
  $("mn-intro").textContent = guide.intro;

  const done = readDone();
  const mine = new Set(done[guide.id] || []);

  function paintProgress() {
    const n = stepCount(guide);
    $("mn-progress-fill").style.width = (mine.size / n * 100) + "%";
    $("mn-progress-text").textContent = mine.size === n ? "Tout est fait ✓" : mine.size + " / " + n + " étapes faites";
    $("mn-reset").hidden = !mine.size;
  }

  function save() {
    done[guide.id] = [...mine].sort((a, b) => a - b);
    writeDone(done);
    paintProgress();
  }

  // Bloc de commande avec bouton « copier »
  function codeBlock(text) {
    const box = el("div", "mn-code");
    const pre = el("pre");
    pre.textContent = text;
    const btn = el("button", "mn-copy", "copier");
    btn.type = "button";
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = "copié ✓";
        setTimeout(() => { btn.textContent = "copier"; }, 1500);
      }).catch(() => {});
    });
    box.append(pre, btn);
    return box;
  }

  let n = 0;
  $("mn-parts").replaceChildren(...guide.parts.map(part => {
    const sec = el("section", "mn-part");
    sec.append(el("h2", "mn-part-title", part.title));
    const list = el("ol", "mn-steps");
    part.steps.forEach(step => {
      n++;
      const num = n;
      const li = el("li", "mn-step" + (mine.has(num) ? " is-done" : ""));
      li.id = "etape-" + num;
      const check = el("button", "mn-num");
      check.type = "button";
      check.title = "Marquer comme faite";
      check.setAttribute("aria-pressed", String(mine.has(num)));
      check.innerHTML = '<span class="mn-num-n">' + num + '</span><span class="mn-num-ok">✓</span>';
      check.addEventListener("click", () => {
        mine.has(num) ? mine.delete(num) : mine.add(num);
        li.classList.toggle("is-done", mine.has(num));
        check.setAttribute("aria-pressed", String(mine.has(num)));
        save();
      });
      const body = el("div", "mn-step-body");
      body.append(el("h3", "mn-step-title", step.title));
      if (step.body) body.append(el("div", "mn-step-text", step.body));
      if (step.code) body.append(codeBlock(step.code));
      if (step.choices) {
        // Variantes au choix : onglets
        const box = el("div", "mn-choices");
        const tabs = el("div", "mn-tabs");
        const panes = step.choices.map((c, i) => {
          const t = el("button", "mn-tab" + (i ? "" : " is-on"), c.label);
          t.type = "button";
          tabs.appendChild(t);
          const p = el("div", "mn-pane", c.body);
          p.hidden = i > 0;
          t.addEventListener("click", () => {
            tabs.querySelectorAll(".mn-tab").forEach(x => x.classList.toggle("is-on", x === t));
            box.querySelectorAll(".mn-pane").forEach(x => { x.hidden = x !== p; });
          });
          return p;
        });
        box.append(tabs, ...panes);
        body.appendChild(box);
      }
      if (step.tip) body.append(el("p", "mn-tip", step.tip));
      li.append(check, body);
      list.appendChild(li);
    });
    sec.appendChild(list);
    return sec;
  }));

  // Récapitulatif (guide des tiers)
  if (guide.summary) {
    const t = el("table", "mn-table mn-summary");
    t.innerHTML = "<tr><th>Tier</th><th>Nom</th><th>Place dans la collection</th></tr>" +
      guide.summary.map(r => "<tr><td><b>" + r[0] + "</b></td><td>" + r[1] + "</td><td>" + r[2] + "</td></tr>").join("");
    $("mn-parts").prepend(t);
  }

  if (guide.trouble && guide.trouble.length) {
    $("mn-trouble").hidden = false;
    $("mn-trouble-table").innerHTML = "<tr><th>Problème</th><th>Solution</th></tr>" +
      guide.trouble.map(r => "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td></tr>").join("");
  }

  $("mn-reset").addEventListener("click", () => {
    mine.clear();
    document.querySelectorAll(".mn-step").forEach(li => li.classList.remove("is-done"));
    document.querySelectorAll(".mn-num").forEach(b => b.setAttribute("aria-pressed", "false"));
    save();
  });

  // Les autres guides, en bas
  const others = MANUALS.filter(g => g.id !== guide.id);
  $("mn-others").append(el("p", "mn-part-title", "Autres guides"),
    ...others.map(g => {
      const a = el("a", "mn-other");
      a.href = "manual.html?g=" + encodeURIComponent(g.id);
      a.innerHTML = '<span class="mn-other-icon">' + icon(g.icon) + "</span>";
      a.appendChild(document.createTextNode(g.title));
      return a;
    }));

  paintProgress();
  markBrand(document.querySelector("main"));
})();
