// conductor. — couleur dominante des pochettes (pour le filtre « Couleurs » de la collection)
//
// Calculée une fois par pochette, dans l'enveloppe (conductor.html) : la pochette
// locale est lue dans datastorage (dossier autorisé), réduite à 32 × 32 points, et
// chaque point compte pour une couleur. Résultat gardé sur l'album :
//   album.coverColor   = "bleu"            (voir COVER_COLORS dans js/data.js)
//   album.coverColorOf = chemin de la pochette analysée (nouvelle pochette → nouveau calcul)

const CoverColors = (function () {
  if (window.top !== window) return { run() {} };

  // Teinte (degrés) → couleur
  function hueName(h) {
    if (h < 15 || h >= 345) return "rouge";
    if (h < 40) return "orange";
    if (h < 68) return "jaune";
    if (h < 165) return "vert";
    if (h < 195) return "turquoise";
    if (h < 255) return "bleu";
    if (h < 290) return "violet";
    return "rose";
  }

  function classify(data) {
    const score = {};
    const add = (k, v) => { score[k] = (score[k] || 0) + v; };
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2, d = max - min;
      const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      if (s < 0.2 || l < 0.1 || l > 0.93) {
        // Gris, noir, blanc : comptent moins qu'une vraie couleur
        add(l < 0.25 ? "noir" : l > 0.8 ? "blanc" : "gris", 0.3);
        continue;
      }
      let h = 0;
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
      let name = hueName(h);
      if ((name === "rouge" || name === "orange" || name === "jaune") && l < 0.4 && s < 0.8) name = "brun";
      add(name, d);   // d = intensité de la couleur (chroma)
    }
    let best = "", top = 0;
    Object.entries(score).forEach(([k, v]) => { if (v > top) { top = v; best = k; } });
    return best;
  }

  async function pixels(source) {
    const bmp = await createImageBitmap(source, { resizeWidth: 32, resizeHeight: 32, resizeQuality: "medium" });
    const canvas = new OffscreenCanvas(32, 32);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, 32, 32);
    bmp.close && bmp.close();
    return ctx.getImageData(0, 0, 32, 32).data;
  }

  // Pochette en ligne : seulement si le site autorise la lecture (CORS)
  function remoteImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  async function colorOf(a) {
    const local = /datastorage\/covers\//.test(a.cover || "");
    if (local) {
      const file = await Disk.coverFile(a.cover);
      if (file) return classify(await pixels(file));
    }
    const remote = /^https?:/.test(a.cover || "") ? a.cover : (a.coverRemote && /^https?:/.test(a.coverRemote) ? a.coverRemote : "");
    if (remote && navigator.onLine) return classify(await pixels(await remoteImage(remote)));
    return "";
  }

  const failed = new Set();   // pochettes illisibles cette session : pas de nouvel essai
  let running = false;
  async function run() {
    if (running || typeof Store === "undefined") return;
    running = true;
    try {
      const todo = Store.raw().filter(a => a.cover && a.coverColorOf !== a.cover && !failed.has(a.cover));
      const patches = {};
      let n = 0;
      for (const a of todo) {
        try {
          const c = await colorOf(a);
          if (c) { patches[a.id] = { coverColor: c, coverColorOf: a.cover }; n += 1; }
          else failed.add(a.cover);
        } catch (e) { failed.add(a.cover); /* illisible : nouvel essai à la prochaine session */ }
        // Écrit par paquets, sans bloquer la page
        if (n && n % 40 === 0) { Store.patchMany(patches); Object.keys(patches).forEach(k => delete patches[k]); }
        await new Promise(r => setTimeout(r, 0));
      }
      if (Object.keys(patches).length) Store.patchMany(patches);
    } finally {
      running = false;
    }
  }

  // Nouvel album, nouvelle pochette : calcul quelques secondes plus tard
  let timer = null;
  document.addEventListener("albums:changed", () => { clearTimeout(timer); timer = setTimeout(run, 3000); });
  document.addEventListener("DOMContentLoaded", () => setTimeout(run, 4000));

  return { run, classify };
})();
