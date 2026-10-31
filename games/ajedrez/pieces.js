/*
 * Piezas de ajedrez dibujadas en SVG (diseño propio, formas clásicas y claras).
 * tipo: 1 peón, 2 caballo, 3 alfil, 4 torre, 5 dama, 6 rey
 */
(function (root) {
  const STYLE = {
    w: { fill: "#fbf6ea", stroke: "#2a2018", detail: "#2a2018", shade: "#e3d8c2" },
    b: { fill: "#2b2622", stroke: "#0c0a08", detail: "#e8dcc6", shade: "#46403a" },
  };

  const BASE = (c) =>
    `<path d="M22 92 Q22 84 30 83 H70 Q78 84 78 92 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3" stroke-linejoin="round"/>`;

  const SHAPES = {
    // Peón
    1: (c) => `
      <path d="M36 83 Q36 72 42 66 Q38 63 40 58 H60 Q62 63 58 66 Q64 72 64 83 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M38 58 Q50 54 62 58" fill="none" stroke="${c.stroke}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="50" cy="42" r="13" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3"/>
      ${BASE(c)}`,

    // Caballo (mirando a la izquierda)
    2: (c) => `
      <path d="M32 83 C33 72 38 64 44 57 C37 57 27 57 21 53 C15 49 15 42 19 38 L33 24 L36 11 L45 16 L49 19
               C64 21 75 33 77 51 C78 65 73 76 70 83 Z"
            fill="${c.fill}" stroke="${c.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M52 23 C64 27 71 39 72 55" fill="none" stroke="${c.detail}" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
      <path d="M44 57 C48 53 50 49 50 45" fill="none" stroke="${c.detail}" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
      <circle cx="36" cy="33" r="3" fill="${c.detail}"/>
      <circle cx="21.5" cy="45.5" r="1.8" fill="${c.detail}"/>
      ${BASE(c)}`,

    // Alfil
    3: (c) => `
      <path d="M40 83 L42 70 H58 L60 83 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M50 18 C66 30 68 52 59 64 H41 C32 52 34 30 50 18 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M56 33 L46 46" stroke="${c.detail}" stroke-width="3.2" stroke-linecap="round"/>
      <rect x="37" y="63" width="26" height="8" rx="3" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3"/>
      <circle cx="50" cy="13" r="5.5" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3"/>
      ${BASE(c)}`,

    // Torre
    4: (c) => `
      <path d="M30 83 L34 70 H66 L70 83 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="35" y="38" width="30" height="33" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3"/>
      <path d="M28 38 V18 H38 V26 H45 V18 H55 V26 H62 V18 H72 V38 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M35 46 H65 M35 64 H65" stroke="${c.detail}" stroke-width="2.2" opacity=".75"/>
      ${BASE(c)}`,

    // Dama
    5: (c) => `
      <path d="M31 83 L33 72 H67 L69 83 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M33 72 L22 36 L36 54 L37 28 L45 52 L50 24 L55 52 L63 28 L64 54 L78 36 L67 72 Z"
            fill="${c.fill}" stroke="${c.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M34 65 Q50 59 66 65" fill="none" stroke="${c.detail}" stroke-width="2.4" opacity=".8"/>
      <circle cx="22" cy="32" r="5" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3"/>
      <circle cx="37" cy="24" r="5" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3"/>
      <circle cx="50" cy="19" r="5" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3"/>
      <circle cx="63" cy="24" r="5" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3"/>
      <circle cx="78" cy="32" r="5" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3"/>
      ${BASE(c)}`,

    // Rey
    6: (c) => `
      <path d="M31 83 L33 72 H67 L69 83 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M33 72 C24 60 26 42 39 41 C45 41 48 45 50 50 C52 45 55 41 61 41 C74 42 76 60 67 72 Z"
            fill="${c.fill}" stroke="${c.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M50 50 V70 M34 64 Q50 58 66 64" fill="none" stroke="${c.detail}" stroke-width="2.4" opacity=".8"/>
      <path d="M46 40 V30 H40 V23 H46 V15 H54 V23 H60 V30 H54 V40 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="3" stroke-linejoin="round"/>
      ${BASE(c)}`,
  };

  const cache = {};
  function svg(type, color) {
    const k = type + color;
    if (!cache[k]) {
      cache[k] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true">${SHAPES[type](STYLE[color])}</svg>`;
    }
    return cache[k];
  }

  const api = { svg };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Pieces = api;
})(typeof window !== "undefined" ? window : globalThis);
