(function () {
  I18N.add({
    es: {
      pageTitle: "Portal de Juegos",
      heroTitle: "🎮 Portal de Juegos",
      heroSub: "Elige un juego y empieza a jugar. ¡Se añaden nuevos poco a poco!",
      search: "Buscar juego…",
      all: "Todos",
      empty: "No se encontró ningún juego.",
      play: "Jugar ▶",
      footer: "Hecho con cariño",
      count: ({ n }) => (n === 1 ? "1 juego" : `${n} juegos`),
    },
    en: {
      pageTitle: "Games Portal",
      heroTitle: "🎮 Games Portal",
      heroSub: "Pick a game and start playing. New ones are added little by little!",
      search: "Search games…",
      all: "All",
      empty: "No games found.",
      play: "Play ▶",
      footer: "Made with love",
      count: ({ n }) => (n === 1 ? "1 game" : `${n} games`),
    },
    it: {
      pageTitle: "Portale dei Giochi",
      heroTitle: "🎮 Portale dei Giochi",
      heroSub: "Scegli un gioco e inizia a giocare. Se ne aggiungono di nuovi poco a poco!",
      search: "Cerca un gioco…",
      all: "Tutti",
      empty: "Nessun gioco trovato.",
      play: "Gioca ▶",
      footer: "Fatto con amore",
      count: ({ n }) => (n === 1 ? "1 gioco" : `${n} giochi`),
    },
    ru: {
      pageTitle: "Портал игр",
      heroTitle: "🎮 Портал игр",
      heroSub: "Выберите игру и начинайте играть. Новые игры добавляются постепенно!",
      search: "Найти игру…",
      all: "Все",
      empty: "Игры не найдены.",
      play: "Играть ▶",
      footer: "Сделано с любовью",
      count: ({ n }) => {
        const d = n % 10, h = n % 100;
        const w = d === 1 && h !== 11 ? "игра" : d >= 2 && d <= 4 && (h < 12 || h > 14) ? "игры" : "игр";
        return `${n} ${w}`;
      },
    },
  });

  const lista = document.getElementById("lista");
  const buscar = document.getElementById("buscar");
  const filtros = document.getElementById("filtros");
  const vacio = document.getElementById("vacio");
  const total = document.getElementById("total");

  let categoria = "todos";
  const cats = ["todos", ...new Set(GAMES.map((g) => g.categoria))];

  function normalizar(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }

  function pintarFiltros() {
    filtros.innerHTML = "";
    if (cats.length <= 2) return;
    cats.forEach((c) => {
      const b = document.createElement("button");
      b.textContent = c === "todos" ? I18N.t("all") : I18N.pick(CATEGORIAS[c]) || c;
      b.className = "chip" + (c === categoria ? " activo" : "");
      b.addEventListener("click", () => {
        categoria = c;
        pintarFiltros();
        pintar();
      });
      filtros.appendChild(b);
    });
  }

  function pintar() {
    total.textContent = I18N.t("count", { n: GAMES.length });
    const q = normalizar(buscar.value.trim());
    const visibles = GAMES.filter((g) => {
      if (categoria !== "todos" && g.categoria !== categoria) return false;
      // Busca en todos los idiomas, así se encuentra el juego aunque se escriba en otro
      const texto = [...Object.values(g.titulo), ...Object.values(g.descripcion)].join(" ");
      return normalizar(texto).includes(q);
    });
    lista.innerHTML = "";
    visibles.forEach((g) => {
      const a = document.createElement("a");
      a.className = "card";
      a.href = `games/${g.id}/`;
      a.style.setProperty("--c", g.color || "#7c5cff");
      const arte = g.imagen
        ? `<img src="${esc(g.imagen)}" alt="" loading="lazy">`
        : esc(g.emoji);
      a.innerHTML = `
        <div class="card-emoji">${arte}</div>
        <div class="card-body">
          <span class="card-cat">${esc(I18N.pick(CATEGORIAS[g.categoria]) || "")}</span>
          <h2>${esc(I18N.pick(g.titulo))}</h2>
          <p>${esc(I18N.pick(g.descripcion))}</p>
        </div>
        <span class="card-play">${esc(I18N.t("play"))}</span>`;
      lista.appendChild(a);
    });
    vacio.hidden = visibles.length > 0;
  }

  I18N.mount(document.getElementById("lang"));
  I18N.onChange(() => {
    pintarFiltros();
    pintar();
  });
  buscar.addEventListener("input", pintar);
  I18N.apply();
  pintarFiltros();
  pintar();
})();
