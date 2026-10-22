// conductor. — téléphone relié par câble USB : adresse donnée par tools/conductor-usb.bat
//
// Le raccourci du bureau trouve l'adresse du téléphone sur le câble (carte « Remote NDIS »,
// ou ADB → localhost) et ouvre conductor.html?usb=<adresse>. Ici, dans l'enveloppe :
//   - déjà connecté à Navidrome : l'adresse est testée, ajoutée et utilisée ; les anciennes
//     adresses du câble (une nouvelle à chaque branchement) sont retirées ;
//   - pas encore connecté : l'adresse est préremplie dans le formulaire de connexion.

(function () {
  if (window.top !== window || typeof Server === "undefined") return;
  const raw = new URLSearchParams(location.search).get("usb");
  if (!raw) return;
  // L'adresse ne reste pas dans la barre (un rechargement ne la rejouerait pas)
  try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}

  const USB_KEY = "conductor01.server.usb";        // adresses données par le câble
  const RECENT_KEY = "conductor01.server.recent";  // suggestions du formulaire (js/library.js)
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  const shown = raw.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const recent = read(RECENT_KEY, { urls: [], user: "" });
  recent.urls = [shown].concat((recent.urls || []).filter(u => u !== shown)).slice(0, 6);
  write(RECENT_KEY, recent);

  let timer = 0;
  function flash(text, ms) {
    let box = document.getElementById("kb-flash");
    if (!box) {
      box = document.createElement("div");
      box.id = "kb-flash";
      box.className = "kb-flash";
      box.setAttribute("role", "status");
      document.body.appendChild(box);
    }
    box.textContent = text;
    box.classList.add("is-on");
    clearTimeout(timer);
    timer = setTimeout(() => box.classList.remove("is-on"), ms || 4000);
  }

  function run() {
    if (!Server.isConfigured()) {
      flash("Câble USB : " + shown + " · connectez-vous à Navidrome", 5000);
      const f = document.getElementById("page");
      if (f && !/library\.html/.test(f.getAttribute("src") || "")) f.src = "pages/library.html";
      return;
    }
    flash("Câble USB : test de " + shown + "…", 8000);
    Server.addAddress(raw).then(u => {
      read(USB_KEY, []).filter(old => old !== u).forEach(old => Server.removeAddress(old));
      write(USB_KEY, [u]);
      flash("Téléphone relié par câble · " + shown);
    }).catch(() => {
      flash("Le téléphone ne répond pas sur " + shown + " : Navidrome est-il lancé dans Termux ?", 7000);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
