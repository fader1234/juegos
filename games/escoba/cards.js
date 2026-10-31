/*
 * Cartas napolitanas dibujadas en SVG.
 * Palos: d = denari (oros), c = coppe (copas), s = spade (espadas), b = bastoni (bastos)
 * Valores: 1-7, 8 = fante (sota), 9 = cavallo (caballo), 10 = re (rey)
 */
(function (root) {
  const C = {
    gold: "#e3b23c", goldD: "#8a5a00",
    red: "#c0392b", redD: "#6e1a12",
    blue: "#2f6fd6", blueD: "#173a78", steel: "#d5dde9",
    green: "#3f8f3a", greenD: "#1e4d1b",
    brown: "#8a5a2b", paper: "#fbf6e9", ink: "#3b2f2f",
  };
  const SUIT_COLOR = { d: "#a87100", c: "#b3261e", s: "#1f4fa8", b: "#2e6b2a" };
  const SUIT_TINT = { d: "#f7e7b4", c: "#f6d3cc", s: "#d4e0f5", b: "#d6ead2" };

  const g = (x, y, s, rot, inner) =>
    `<g transform="translate(${x} ${y}) rotate(${rot || 0}) scale(${s})">${inner}</g>`;

  const SYMBOL = {
    d: `<circle r="10" fill="${C.gold}" stroke="${C.goldD}" stroke-width="1.2"/>
        <circle r="8.4" fill="none" stroke="${C.goldD}" stroke-width=".8" stroke-dasharray="1.6 1.3"/>
        <circle r="6.2" fill="none" stroke="${C.red}" stroke-width="1.4"/>
        <circle r="3.2" fill="${C.red}"/><circle r="1.2" fill="${C.gold}"/>`,
    c: `<path d="M-8.5 -11 H8.5 Q9 -1 0 2.5 Q-9 -1 -8.5 -11Z" fill="${C.red}" stroke="${C.redD}" stroke-width="1"/>
        <path d="M-6 -7 Q-5 -2 -1 0" fill="none" stroke="#e8786b" stroke-width="1.2" stroke-linecap="round"/>
        <ellipse cy="-11" rx="8.5" ry="2.2" fill="${C.gold}" stroke="${C.goldD}" stroke-width=".8"/>
        <rect x="-1.6" y="2" width="3.2" height="7" fill="${C.gold}" stroke="${C.goldD}" stroke-width=".6"/>
        <circle cy="5" r="2.1" fill="${C.gold}" stroke="${C.goldD}" stroke-width=".6"/>
        <path d="M-7 12.5 Q0 6.5 7 12.5Z" fill="${C.red}" stroke="${C.redD}" stroke-width="1"/>`,
    s: `<path d="M0 -15 L2.5 -11 V5.5 H-2.5 V-11Z" fill="${C.steel}" stroke="${C.blueD}" stroke-width=".9"/>
        <line x1="0" y1="-11" x2="0" y2="4.5" stroke="${C.blue}" stroke-width="1"/>
        <rect x="-8" y="5.2" width="16" height="2.8" rx="1.4" fill="${C.gold}" stroke="${C.goldD}" stroke-width=".6"/>
        <rect x="-1.6" y="8" width="3.2" height="4.6" fill="${C.blue}" stroke="${C.blueD}" stroke-width=".5"/>
        <circle cy="13.8" r="2" fill="${C.gold}" stroke="${C.goldD}" stroke-width=".6"/>`,
    b: `<path d="M-1.8 14 L-3.8 -9.5 Q0 -16 3.8 -9.5 L1.8 14Z" fill="${C.green}" stroke="${C.greenD}" stroke-width="1"/>
        <path d="M-1.6 -10 Q0 -13 1.6 -10" fill="none" stroke="#7fc46f" stroke-width="1" stroke-linecap="round"/>
        <circle cx="-3.4" cy="-4" r="1.5" fill="${C.red}"/><circle cx="3.2" cy="1" r="1.4" fill="${C.red}"/>
        <circle cx="-2.7" cy="6" r="1.3" fill="${C.red}"/>
        <rect x="-2.4" y="10" width="4.8" height="1.8" fill="${C.gold}"/>`,
  };

  // Posiciones de los símbolos según el número (área de 100 x 160)
  const LAYOUT = {
    2: [[50, 46], [50, 114]],
    3: [[50, 40], [50, 80], [50, 120]],
    4: [[31, 46], [69, 46], [31, 114], [69, 114]],
    5: [[31, 42], [69, 42], [50, 80], [31, 118], [69, 118]],
    6: [[31, 40], [69, 40], [31, 80], [69, 80], [31, 120], [69, 120]],
    7: [[31, 38], [69, 38], [50, 61], [31, 86], [69, 86], [31, 122], [69, 122]],
  };

  const FIGURE = { 8: "💂", 9: "🏇", 10: "🤴" };

  const cache = {};

  function frame(col, inner, value) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 160">
      <rect x="1" y="1" width="98" height="158" rx="8" fill="${C.paper}" stroke="${C.ink}" stroke-width="1.5"/>
      <rect x="5" y="5" width="90" height="150" rx="5" fill="none" stroke="${col}" stroke-width="1" opacity=".45"/>
      ${inner}
      <text x="12.5" y="21" font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="15" fill="${col}" text-anchor="middle">${value}</text>
      <text x="87.5" y="149" font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="15" fill="${col}" text-anchor="middle" transform="rotate(180 87.5 144)">${value}</text>
    </svg>`;
  }

  function svg(card) {
    const key = card.s + card.v;
    if (cache[key]) return cache[key];
    const col = SUIT_COLOR[card.s];
    const sym = SYMBOL[card.s];
    let inner = "";
    if (card.v === 1) {
      inner = `<circle cx="50" cy="80" r="33" fill="${SUIT_TINT[card.s]}" opacity=".7"/>` + g(50, 80, 2.6, 0, sym);
    } else if (card.v <= 7) {
      const s = card.v === 7 ? 1.15 : card.v >= 4 ? 1.3 : 1.45;
      inner = LAYOUT[card.v].map(([x, y]) => g(x, y, s, 0, sym)).join("");
    } else {
      inner = `<rect x="16" y="27" width="68" height="106" rx="6" fill="${SUIT_TINT[card.s]}" stroke="${col}" stroke-width="1.2"/>
        <text x="50" y="86" font-size="42" text-anchor="middle">${FIGURE[card.v]}</text>
        ${g(50, 116, 0.95, 0, sym)}
        ${g(50, 41, 0.6, 0, sym)}`;
    }
    return (cache[key] = frame(col, inner, card.v));
  }

  let backCache = null;
  function back() {
    if (backCache) return backCache;
    let pattern = "";
    for (let y = 18; y <= 142; y += 12)
      for (let x = 18 + ((y / 12) % 2) * 6; x <= 82; x += 12)
        pattern += `<path d="M${x} ${y - 4}L${x + 4} ${y}L${x} ${y + 4}L${x - 4} ${y}Z" fill="#9b2d3b"/>`;
    backCache = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 160">
      <rect x="1" y="1" width="98" height="158" rx="8" fill="#6d1a26" stroke="#2c0a10" stroke-width="1.5"/>
      <rect x="7" y="7" width="86" height="146" rx="5" fill="none" stroke="${C.gold}" stroke-width="1.6"/>
      ${pattern}
      <circle cx="50" cy="80" r="15" fill="#6d1a26" stroke="${C.gold}" stroke-width="1.6"/>
      <text x="50" y="86" font-family="Georgia,serif" font-weight="700" font-size="16" fill="${C.gold}" text-anchor="middle">15</text>
    </svg>`;
    return backCache;
  }

  const api = { svg, back, SUIT_COLOR };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CardArt = api;
})(typeof window !== "undefined" ? window : globalThis);
