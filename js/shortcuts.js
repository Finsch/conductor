// conductor. — raccourcis clavier + pied de page (toutes les pages)
//
//   N         ajouter un album
//   S         rechercher
//   Échap     quitter un champ ; sinon retour à la collection
//   Z         filtres réinitialisés (collection ; recherche et tri gardés)
//   H         retour à l'accueil, tout réinitialisé (recherche, filtres, tri)
//   F         filtre « Albums favoris » (collection)
//   Maj + ← → page précédente / suivante (collection, historique du journal)
//   Espace    lecture / pause            (page album)
//   ← →       titre précédent / suivant  (page album, pendant la lecture)
//   ↑ ↓       volume + / − 1 (sur 20)    (page album, pendant la lecture)
//   M         couper / rétablir le son   (page album)
//   0 / 1     volume à zéro / au maximum (page album)
//   ?         liste des raccourcis
//
// Règles :
// - rien ne se déclenche pendant une saisie (champ, zone de texte, liste) ;
//   Échap fait seulement quitter le champ ;
// - rien ne se déclenche quand une fenêtre (dialog) est ouverte : Échap la ferme
//   directement ;
// - Espace ne déclenche rien quand un bouton, un lien ou une case a le focus
//   (Espace sert alors à les activer) ;
// - ← → ne changent de titre que si un titre est en cours, et jamais quand la
//   barre de progression a le focus (← → y avancent / reculent dans le morceau) ;
// - Ctrl, Cmd et Alt sont laissés au navigateur (Alt+N reste accepté).

(function () {
  const ROOT = typeof APP_ROOT !== "undefined" ? APP_ROOT : "";
  const PAGE = /\/pages\/album\.html$/.test(location.pathname) ? "album"
    : /\/pages\/library\.html$/.test(location.pathname) ? "library"
    : /\/pages\/nextup\.html$/.test(location.pathname) ? "nextup"
    : /\/pages\/insights\.html$/.test(location.pathname) ? "insights"
    : /\/pages\//.test(location.pathname) ? "page" : "home";   // artiste, journal, à compléter…

  const SHORTCUTS = [
    ["N", "Ajouter un album"],
    ["S", "Rechercher"],
    ["R", "Surprise me : un album au hasard (collection)"],
    ["Échap", "Quitter un champ · retour à la collection"],
    ["Z", "Réinitialiser les filtres (collection)"],
    ["H", "Accueil, tout réinitialisé"],
    ["J", "Note du jour (page journal)"],
    ["F", "Filtre « Albums favoris » (collection)"],
    ["Maj + ← →", "Page précédente / suivante (collection, historique du journal)"],
    ["Espace", "Lecture / pause (page album)"],
    ["← →", "Titre précédent / suivant (pendant la lecture)"],
    ["↑ ↓", "Volume + / − (sur 20, pendant la lecture)"],
    ["T", "File d'attente : ouvrir / fermer (mini-lecteur)"],
    ["Q", "Fermer le mini-lecteur"],
    ["P", "Plein écran (pendant la lecture)"],
    ["M", "Couper / rétablir le son"],
    ["0", "Volume à zéro"],
    ["1", "Volume au maximum"],
    ["?", "Afficher ces raccourcis"]
  ];

  // ---------- Contexte ----------

  const TEXT_INPUTS = /^(text|search|email|url|tel|password|number|date|datetime-local|month|time|week)$/i;

  function isEditable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
    return el.tagName === "INPUT" && TEXT_INPUTS.test(el.type || "text");
  }

  // Éléments qu'Espace active (bouton, lien, case, curseur…)
  function isActivatable(el) {
    if (!el || el === document.body) return false;
    if (/^(BUTTON|A|SUMMARY|INPUT|LABEL)$/.test(el.tagName)) return true;
    return /^(button|link|checkbox|radio|slider|switch|tab|menuitem|option)$/.test(el.getAttribute("role") || "");
  }

  function dialogOpen() {
    return !!document.querySelector("dialog[open]");
  }

  // ---------- Actions ----------

  function addAlbum() {
    const btn = document.getElementById("add-album-btn");
    if ((PAGE === "home" || PAGE === "nextup") && btn) btn.click();   // next up : ajoute à next up
    else location.href = ROOT + "index.html#ajouter";
  }

  function focusSearch() {
    const input = document.getElementById("search-input");
    if (!input) return;
    input.focus();
    input.select();
  }

  // Échap : retour à la collection (lien « retour » de la page)
  function goBack() {
    if (PAGE === "home") return false;
    const back = document.getElementById("back-link");
    location.href = back ? back.href : ROOT + "index.html";
    return true;
  }

  // Z : filtres seulement (la recherche et le tri restent)
  function resetFilters() {
    if (PAGE === "home") document.dispatchEvent(new CustomEvent("conductor:filters-reset"));
  }

  // Maj + ← → : clique le bouton « page précédente / suivante » de la page
  function turnPage(dir) {
    const ids = dir < 0 ? ["page-prev", "jr-hist-prev"] : ["page-next", "jr-hist-next"];
    for (const id of ids) {
      const b = document.getElementById(id);
      if (b && !b.disabled && b.offsetParent !== null) { b.click(); return true; }
    }
    return false;
  }

  // H : accueil, tout remis à zéro
  function homeReset() {
    if (PAGE === "home") {
      document.dispatchEvent(new CustomEvent("conductor:reset"));
      window.scrollTo({ top: 0 });
    } else {
      location.href = ROOT + "index.html?accueil=1";   // filtres et tri remis à zéro
    }
  }

  // ---------- Clavier ----------

  document.addEventListener("keydown", e => {
    if (e.defaultPrevented || e.isComposing) return;
    const target = document.activeElement;

    // Échap dans un champ : on quitte le champ (sans effacer la recherche)
    if (e.key === "Escape") {
      // Fenêtre ouverte : Échap la ferme directement (même si un champ a le focus,
      // sans d'abord vider le champ de recherche comme le ferait le navigateur)
      const open = [...document.querySelectorAll("dialog[open]")].pop();
      if (open) {
        e.preventDefault();
        open.close();
        return;
      }
      if (isEditable(target)) {
        e.preventDefault();
        target.blur();
        return;
      }
      if (goBack()) e.preventDefault();
      return;
    }

    if (isEditable(target) || dialogOpen()) return;

    // Alt+N : ancien raccourci, toujours accepté
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyN") {
      e.preventDefault();
      addAlbum();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;


    if (e.key === "?") { e.preventDefault(); openHelp(); return; }

    // Volume (page album, s'il y a de quoi écouter)
    // 0 et 1 : touche physique, avec ou sans Maj (en AZERTY, Maj donne les chiffres)
    const player = window.Player;
    const volume = window.Volume;
    const canVolume = player && volume && player.hasAudio();
    if (canVolume && (e.code === "Digit0" || e.code === "Numpad0")) { e.preventDefault(); volume.zero(); return; }
    if (canVolume && (e.code === "Digit1" || e.code === "Numpad1")) { e.preventDefault(); volume.max(); return; }

    // Maj + ← → : page précédente / suivante (collection, historique du journal)
    if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      if (turnPage(e.key === "ArrowLeft" ? -1 : 1)) e.preventDefault();
      return;
    }

    if (e.shiftKey) return;

    if (e.code === "KeyN") { e.preventDefault(); addAlbum(); return; }
    // e.code = position physique : marche en AZERTY comme en QWERTY
    if (e.code === "KeyS") { e.preventDefault(); focusSearch(); return; }
    // Z : la lettre Z quelle que soit la disposition (AZERTY : pas à la place du Z QWERTY)
    if (e.key.toLowerCase() === "z") { e.preventDefault(); resetFilters(); return; }
    if (e.key.toLowerCase() === "h") { e.preventDefault(); homeReset(); return; }
    if (e.key.toLowerCase() === "j") { const t = document.getElementById("today-note"); if (t) { e.preventDefault(); t.click(); } return; }
    if (e.key.toLowerCase() === "f" && PAGE === "home") { e.preventDefault(); document.dispatchEvent(new CustomEvent("conductor:toggle-fav")); return; }
    // T / Q : mini-lecteur (file d'attente, fermer)
    const pb = window.Playback;
    if (pb && pb.togglePanel && pb.state()) {
      if (e.key.toLowerCase() === "t") { e.preventDefault(); pb.togglePanel(); return; }
      if (e.key.toLowerCase() === "q") { e.preventDefault(); pb.closeMini(); return; }
      if (e.key.toLowerCase() === "p") { e.preventDefault(); pb.fullscreen(); return; }
    }
    if (e.code === "KeyR" && window.Surprise) { e.preventDefault(); window.Surprise.show(); return; }

    // Lecteur (page album)
    if (!player) return;

    // M : la lettre M quelle que soit la disposition (en AZERTY elle n'est pas à la place du M QWERTY)
    if (canVolume && e.key.toLowerCase() === "m") { e.preventDefault(); volume.toggleMute(); return; }

    if (e.code === "Space") {
      if (isActivatable(target) || e.repeat) return;
      if (!player.hasAudio()) return;
      e.preventDefault();
      player.toggle();
      return;
    }

    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      if (!player.active()) return;              // rien en cours : on laisse défiler la page
      if (target && target.id === "p-bar") return;   // la barre gère ← → (avance dans le morceau)
      if (target && target.getAttribute && target.getAttribute("role") === "slider") return;
      e.preventDefault();
      e.key === "ArrowRight" ? player.next() : player.prev();
      return;
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      if (!canVolume || !player.active()) return;   // rien en cours : ↑ ↓ font défiler la page
      if (target && (target.type === "range" || (target.getAttribute && target.getAttribute("role") === "slider"))) return;
      e.preventDefault();
      e.key === "ArrowUp" ? volume.up() : volume.down();
    }
  });

  // ---------- Fenêtre « Raccourcis clavier » ----------

  let help = null;

  function kbd(text) {
    const k = document.createElement("kbd");
    k.className = "kbd";
    k.textContent = text;
    return k;
  }

  function openHelp() {
    if (!help) {
      help = document.createElement("dialog");
      help.className = "modal modal-small";
      help.setAttribute("aria-labelledby", "shortcuts-title");
      help.innerHTML =
        '<div class="modal-head"><h2 class="modal-title" id="shortcuts-title">Raccourcis clavier</h2>' +
        '<button type="button" class="icon-btn" aria-label="Fermer">×</button></div>' +
        '<div class="modal-step"><dl class="shortcut-list"></dl>' +
        '<p class="hint">Inactifs pendant une saisie dans un champ.</p></div>';
      const list = help.querySelector(".shortcut-list");
      SHORTCUTS.forEach(([key, label]) => {
        const dt = document.createElement("dt");
        key.split(" + ").forEach((part, i) => {
          if (i) dt.appendChild(document.createTextNode(" + "));
          dt.appendChild(kbd(part));
        });
        const dd = document.createElement("dd");
        dd.textContent = label;
        list.append(dt, dd);
      });
      help.querySelector(".icon-btn").addEventListener("click", () => help.close());
      help.addEventListener("click", e => { if (e.target === help) help.close(); });
      document.body.appendChild(help);
    }
    help.showModal();
  }

  // ---------- Pied de page ----------

  function durationOf(a) {
    if (a.duration) return a.duration;
    return (a.tracks || []).reduce((s, t) => s + (t.duration || 0), 0);
  }

  // "3 d 4 h 12 min" (1 mo = 30 jours), en anglais comme le reste du pied de page
  function formatTotal(sec) {
    sec = Math.round(sec || 0);
    if (sec < 3600) return formatLength(sec);
    const units = [["mo", 30 * 86400], ["d", 86400], ["h", 3600], ["min", 60]];
    const parts = [];
    let rest = sec;
    units.forEach(([label, size]) => {
      const n = Math.floor(rest / size);
      rest -= n * size;
      if (n) parts.push(n + " " + label);
    });
    return parts.join(" ");
  }

  // Icônes au trait (currentColor)
  const ICON = {
    disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
    vinyl: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5" opacity=".45"/><circle cx="12" cy="12" r="1.6"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 13.8c2 .7 3.5 2.6 3.5 5.2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.3 10h.01M12.6 10h.01M15.9 10h.01M18 10h.01M6 13.5h.01M18 13.5h.01M8.5 14h7"/>'
  };
  const GITHUB = '<path fill="currentColor" stroke="none" d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49l-.01-1.7c-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9l-.01 2.81c0 .27.18.6.69.49A10.1 10.1 0 0 0 22 12.23C22 6.58 17.52 2 12 2z"/>';

  function svg(body) {
    return '<svg class="footer-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  let statsEl = null;

  function renderStats() {
    if (!statsEl || typeof Store === "undefined") return;
    const all = Store.all();
    const artists = new Set(all.map(a => a.artist)).size;
    const total = all.reduce((s, a) => s + durationOf(a), 0);
    const items = [
      [ICON.disc, all.length + " album" + (all.length > 1 ? "s" : "")],
      [ICON.people, artists + " artist" + (artists > 1 ? "s" : "")]
    ];
    if (total) items.push([ICON.clock, formatTotal(total)]);
    statsEl.innerHTML = "";
    items.forEach(([icon, text], i) => {
      if (i) {
        const dot = document.createElement("span");
        dot.className = "footer-dot";
        dot.textContent = "·";
        statsEl.appendChild(dot);
      }
      const item = document.createElement("span");
      item.className = "footer-stat";
      item.innerHTML = svg(icon);
      item.appendChild(document.createTextNode(text));
      statsEl.appendChild(item);
    });
  }

  function buildFooter() {
    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML =
      '<div class="footer-main"><div class="footer-inner">' +
        '<div class="footer-top">' +
          '<div class="footer-brand">' +
            '<span class="footer-logo">' + svg(ICON.vinyl) + '</span>' +
            '<div><p class="footer-name">conductor.</p>' +
            '<p class="footer-note">A personal, local-first music library and audio player.</p></div>' +
          '</div>' +
          '<a class="footer-square" href="https://github.com/Finsch/conductor" target="_blank" rel="noopener" ' +
            'title="Code source sur GitHub" aria-label="GitHub">' + svg(GITHUB) + '</a>' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<p class="footer-stats"></p>' +
          '<div class="footer-tools">' +
            '<button type="button" class="footer-help" title="Raccourcis clavier (?)" ' +
              'aria-label="Raccourcis clavier">' + svg(ICON.keyboard) + '</button>' +
          '</div>' +
        '</div>' +
      '</div></div>';
    footer.querySelector(".footer-help").addEventListener("click", openHelp);
    statsEl = footer.querySelector(".footer-stats");
    // Volume fixe, à gauche du bouton clavier (js/volume.js)
    if (window.Volume) {
      const tools = footer.querySelector(".footer-tools");
      const slot = document.createElement("div");
      tools.prepend(slot);
      Volume.mountFooter(slot);
      slot.replaceWith(...slot.childNodes);
    }
    document.body.appendChild(footer);
    renderStats();
  }

  document.addEventListener("albums:changed", renderStats);
  document.addEventListener("DOMContentLoaded", buildFooter);

  window.Shortcuts = { openHelp };
})();
