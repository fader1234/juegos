(function () {
  const lista = document.getElementById("lista");
  const buscar = document.getElementById("buscar");
  const filtros = document.getElementById("filtros");
  const vacio = document.getElementById("vacio");
  const total = document.getElementById("total");

  let categoria = "Todos";
  const categorias = ["Todos", ...new Set(GAMES.map((g) => g.categoria))];

  total.textContent = GAMES.length === 1 ? "1 juego" : `${GAMES.length} juegos`;

  categorias.forEach((c) => {
    const b = document.createElement("button");
    b.textContent = c;
    b.className = "chip" + (c === categoria ? " activo" : "");
    b.addEventListener("click", () => {
      categoria = c;
      filtros.querySelectorAll(".chip").forEach((x) => x.classList.toggle("activo", x === b));
      pintar();
    });
    filtros.appendChild(b);
  });
  if (categorias.length <= 2) filtros.hidden = true;

  function normalizar(t) {
    return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function pintar() {
    const q = normalizar(buscar.value.trim());
    const visibles = GAMES.filter(
      (g) =>
        (categoria === "Todos" || g.categoria === categoria) &&
        normalizar(g.titulo + " " + g.descripcion).includes(q)
    );
    lista.innerHTML = "";
    visibles.forEach((g) => {
      const a = document.createElement("a");
      a.className = "card";
      a.href = `games/${g.id}/`;
      a.style.setProperty("--c", g.color || "#7c5cff");
      a.innerHTML = `
        <div class="card-emoji">${g.emoji}</div>
        <div class="card-body">
          <span class="card-cat">${g.categoria}</span>
          <h2>${g.titulo}</h2>
          <p>${g.descripcion}</p>
        </div>
        <span class="card-play">Jugar ▶</span>`;
      lista.appendChild(a);
    });
    vacio.hidden = visibles.length > 0;
  }

  buscar.addEventListener("input", pintar);
  pintar();
})();
