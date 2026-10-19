// conductor. — boutons de lecture sur les pochettes (collection, page artiste)
// Utilisé par js/app.js et js/artist.js : coverActions(album) renvoie la boîte
// de boutons à placer dans la pochette (.album-cover).

const coverActions = (function () {
  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  // ---------- Boutons de lecture sur la pochette (au survol) ----------
  // - Rien en lecture : ▶ lance l'album.
  // - Un album en lecture :
  //     · ▶ (à gauche) : écouter cet album à la place de celui en cours, la file
  //       d'attente est gardée ; sur l'album en cours : pause / lecture ;
  //     · « 3 traits + » : ajoute l'album à la file (autant de fois qu'on veut) ;
  //       la coche verte s'affiche quelques secondes pour confirmer.

  const QUEUE_ICONS = {
    add: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h11M3.5 11.5h11M3.5 16.5h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18 13v7M14.5 16.5h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
    done: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h11M3.5 11.5h11M3.5 16.5h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path class="q-check" d="M13.5 16.5l2.8 2.8 5.2-5.6" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  const PLAY_ICONS = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" fill="currentColor"/></svg>'
  };
  const DONE_FOR = 2000;   // ms : durée de la coche après un ajout

  const hasPlayer = () => !!window.Playback;
  const idle = () => hasPlayer() && !Playback.state();
  const isCurrent = id => hasPlayer() && Playback.isAlbum && Playback.isAlbum(id);
  const isPlaying = () => hasPlayer() && Playback.audio && !Playback.audio.paused;

  function paintActions(box) {
    const id = box.dataset.id;
    const q = box.querySelector(".cover-queue");
    const p = box.querySelector(".cover-play");
    const done = Number(q.dataset.doneUntil || 0) > Date.now();
    const qMode = done ? "done" : idle() ? "play" : "add";
    if (q.dataset.mode !== qMode) {
      q.dataset.mode = qMode;
      q.innerHTML = QUEUE_ICONS[qMode];
      q.classList.toggle("is-on", done);
      const label = done ? "Ajouté à la file d'attente" : qMode === "play" ? "Écouter l'album" : "Ajouter à la file d'attente";
      q.title = label;
      q.setAttribute("aria-label", label);
    }
    // ▶ / ⏸ : seulement quand un album est chargé dans le lecteur
    const current = isCurrent(id);
    p.hidden = idle();
    const pMode = current && isPlaying() ? "pause" : "play";
    if (p.dataset.mode !== pMode || p.dataset.current !== String(current)) {
      p.dataset.mode = pMode;
      p.dataset.current = String(current);
      p.innerHTML = PLAY_ICONS[pMode];
      const label = current ? (pMode === "pause" ? "Pause" : "Reprendre la lecture")
        : "Écouter cet album maintenant (la file d'attente est gardée)";
      p.title = label;
      p.setAttribute("aria-label", label);
    }
    box.classList.toggle("is-current", current);
  }

  function coverActions(album) {
    const box = el("div", "cover-actions");
    box.dataset.id = album.id;
    const p = el("button", "cover-play");
    p.type = "button";
    const q = el("button", "cover-queue");
    q.type = "button";
    box.append(p, q);
    const stop = e => { e.preventDefault(); e.stopPropagation(); };

    p.addEventListener("click", e => {
      stop(e);
      if (!hasPlayer()) return;
      if (isCurrent(album.id)) Playback.toggle();
      else Playback.playId(album.id, true);   // remplace l'album en cours, file gardée
    });
    q.addEventListener("click", e => {
      stop(e);
      if (!hasPlayer()) return;
      if (idle()) { Playback.playId(album.id); return; }
      Playback.addToQueue(album.id);
      q.dataset.doneUntil = String(Date.now() + DONE_FOR);
      paintActions(box);
      setTimeout(() => paintActions(box), DONE_FOR + 50);
    });
    paintActions(box);
    return box;
  }

  function repaintActions() {
    document.querySelectorAll(".cover-actions").forEach(paintActions);
  }
  document.addEventListener("playback:change", repaintActions);
  if (window.Playback && Playback.audio) {
    Playback.audio.addEventListener("play", repaintActions);
    Playback.audio.addEventListener("pause", repaintActions);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      if (window.Playback && Playback.audio) {
        Playback.audio.addEventListener("play", repaintActions);
        Playback.audio.addEventListener("pause", repaintActions);
      }
      repaintActions();
    });
  }

  return coverActions;
})();
