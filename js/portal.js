/* Portada del portal de juegos */
(function () {
  I18N.add({
    es: {
      pageTitle: "Sala de juegos · Robert Fader",
      brand: "Sala de juegos",
      eyebrow: "Juegos de las novelas",
      lead: "Juega con los personajes de las novelas de Robert Fader. Gratis, en el navegador, sin instalar nada.",
      all: "Todos", novels: "📚 Mundo literario →",
      pickOfDay: "✦ Juego del día · {date}", play: "Jugar →", playCover: "▶ Jugar",
      vsCpu: "Contra la computadora", isNew: "Nuevo", difficulty: "Dificultad",
      readNovels: "Lee las novelas en Mundo literario →", rights: "Todos los derechos reservados.",
      theme: "Cambiar tema claro u oscuro",
    },
    en: {
      pageTitle: "Game Room · Robert Fader",
      brand: "Game Room",
      eyebrow: "Games from the novels",
      lead: "Play with the characters from Robert Fader's novels. Free, in your browser, nothing to install.",
      all: "All", novels: "📚 Literary World →",
      pickOfDay: "✦ Game of the day · {date}", play: "Play →", playCover: "▶ Play",
      vsCpu: "Vs computer", isNew: "New", difficulty: "Difficulty",
      readNovels: "Read the novels on Literary World →", rights: "All rights reserved.",
      theme: "Switch light or dark theme",
    },
    it: {
      pageTitle: "Sala giochi · Robert Fader",
      brand: "Sala giochi",
      eyebrow: "Giochi dei romanzi",
      lead: "Gioca con i personaggi dei romanzi di Robert Fader. Gratis, nel browser, senza installare nulla.",
      all: "Tutti", novels: "📚 Mondo letterario →",
      pickOfDay: "✦ Gioco del giorno · {date}", play: "Gioca →", playCover: "▶ Gioca",
      vsCpu: "Contro il computer", isNew: "Nuovo", difficulty: "Difficoltà",
      readNovels: "Leggi i romanzi su Mondo letterario →", rights: "Tutti i diritti riservati.",
      theme: "Cambia tema chiaro o scuro",
    },
    ru: {
      pageTitle: "Игровая · Роберт Фадер",
      brand: "Игровая",
      eyebrow: "Игры по романам",
      lead: "Играйте с героями романов Роберта Фадера. Бесплатно, прямо в браузере, без установки.",
      all: "Все", novels: "📚 Литературный мир →",
      pickOfDay: "✦ Игра дня · {date}", play: "Играть →", playCover: "▶ Играть",
      vsCpu: "Против компьютера", isNew: "Новинка", difficulty: "Сложность",
      readNovels: "Читайте романы в «Литературном мире» →", rights: "Все права защищены.",
      theme: "Светлая или тёмная тема",
    },
  });

  const $ = (id) => document.getElementById(id);
  const t = (k, v) => I18N.t(k, v);
  const pick = (o) => I18N.pick(o);
  const LIT = "https://luisfader.github.io/litmir/";
  let cat = "todos";

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }

  /* Idiomas, como en Mundo literario: códigos en la cabecera */
  function renderLangs() {
    $("langs").innerHTML = I18N.LANGS.map((l) =>
      `<button data-l="${l.code}" class="${I18N.lang === l.code ? "on" : ""}" title="${l.label}" aria-label="${l.label}">${l.code.toUpperCase()}</button>`).join("");
  }
  $("langs").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) I18N.set(b.dataset.l);
  });

  /* Tema claro / oscuro */
  function isDark() {
    const th = document.documentElement.dataset.theme;
    if (th) return th === "dark";
    return matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function renderTheme() { $("themeBtn").textContent = isDark() ? "☀" : "☾"; }
  $("themeBtn").addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("portal-theme", next); } catch (e) {}
    renderTheme();
  });

  /* Categorías */
  function renderPills() {
    const cats = ["todos", ...new Set(GAMES.map((g) => g.categoria))];
    $("pills").innerHTML =
      cats.map((c) => `<button class="pill ${c === cat ? "on" : ""}" data-c="${c}">${esc(c === "todos" ? t("all") : pick(CATEGORIAS[c]))}</button>`).join("") +
      `<a class="pill" href="${LIT}">${esc(t("novels"))}</a>`;
  }
  $("pills").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-c]");
    if (!b) return;
    cat = b.dataset.c;
    renderPills();
    renderGrid();
  });

  /* Juego del día: cambia cada día, igual que la recomendación del día de las novelas */
  function renderPick() {
    const now = new Date();
    const day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
    const g = GAMES[day % GAMES.length];
    let date = "";
    try { date = new Intl.DateTimeFormat(I18N.lang, { day: "numeric", month: "long" }).format(now); } catch (e) {}
    $("pick").innerHTML = `
      <a href="games/${g.id}/"><img src="${esc(g.portada || g.imagen)}" alt="${esc(pick(g.titulo))}"></a>
      <div>
        <p class="eb">${esc(t("pickOfDay", { date }))}</p>
        <h2>${esc(pick(g.titulo))}</h2>
        <p class="d">${esc(pick(g.descripcion))}</p>
        <a class="go" href="games/${g.id}/">${esc(t("play"))}</a>
      </div>`;
  }

  function renderGrid() {
    const list = GAMES.filter((g) => cat === "todos" || g.categoria === cat);
    $("grid").innerHTML = list.map((g) => {
      const d = g.dificultad || 1;
      return `<a class="game" href="games/${g.id}/">
        <div class="cover">
          <img src="${esc(g.portada || g.imagen)}" alt="" loading="lazy">
          <span class="play">${esc(t("playCover"))}</span>
        </div>
        <h3>${esc(pick(g.titulo))}</h3>
        <span class="meta">${esc(pick(CATEGORIAS[g.categoria]))}${g.meta ? " · " + esc(pick(g.meta)) : ""}</span>
        <p class="desc">${esc(pick(g.descripcion))}</p>
        <div class="tags">
          ${g.rival ? `<span class="tag cpu">${esc(t("vsCpu"))}</span>` : ""}
          ${g.nuevo ? `<span class="tag new">${esc(t("isNew"))}</span>` : ""}
        </div>
        <div class="diff" title="${esc(t("difficulty"))}"><span>${esc(t("difficulty"))}</span>
          <span class="s">${"★".repeat(d)}<i>${"★".repeat(5 - d)}</i></span></div>
      </a>`;
    }).join("");
  }

  function renderAll() {
    renderLangs();
    renderPills();
    renderPick();
    renderGrid();
    $("litLink").href = LIT;
  }

  I18N.onChange(renderAll);
  I18N.apply();
  renderTheme();
  renderAll();
})();
