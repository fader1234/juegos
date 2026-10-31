/*
 * Bloques de Litmir — juego de bloques que caen, en 5 niveles con personajes de Litmir.
 * Cada línea completada descubre un poco más la imagen del personaje del nivel.
 */
(function () {
  "use strict";

  const t = (k, v) => I18N.t(k, v);
  const pick = (o) => I18N.pick(o);
  const $ = (id) => document.getElementById(id);
  const STORE = "bloques-litmir";

  const COLS = 10, ROWS = 20, HIDDEN = 2, H = ROWS + HIDDEN;
  const LOCK_MS = 500, MAX_RESETS = 15, DAS = 160, ARR = 45, SOFT_MS = 35;

  /* ───────────── Piezas ───────────── */
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  };
  const COLORS = { I: "#45c8e0", O: "#f2c94c", T: "#b57be0", S: "#5cc98a", Z: "#ec6a6a", J: "#5b8def", L: "#f0954a" };
  const TYPES = Object.keys(SHAPES);
  const rotCW = (m) => m[0].map((_, i) => m.map((r) => r[i]).reverse());
  const ROT = {};
  for (const k of TYPES) {
    const r = [SHAPES[k]];
    for (let i = 0; i < 3; i++) r.push(rotCW(r[i]));
    ROT[k] = r;
  }
  // Desplazamientos al girar contra paredes (sistema de rotación estándar; y hacia arriba)
  const KICK = {
    "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  };
  const KICK_I = {
    "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  };

  /* ───────────── Estado ───────────── */
  const S = {
    state: "menu", // menu | intro | play | pause | clearing | levelup | over | victory
    grid: [],
    cur: null,
    queue: [],
    bag: [],
    hold: null,
    canHold: true,
    score: 0,
    best: 0,
    maxLevel: 0,
    startLevel: 0,
    lvl: 0,
    lines: 0,
    endless: false,
    endlessLines: 0,
    acc: 0,
    lockT: 0,
    resets: 0,
    soft: false,
    flash: null,
    sound: true,
    newBest: false,
  };

  try {
    const d = JSON.parse(localStorage.getItem(STORE) || "{}");
    S.best = +d.best || 0;
    S.maxLevel = Math.min(4, Math.max(0, +d.maxLevel || 0));
    if (typeof d.sound === "boolean") S.sound = d.sound;
  } catch (e) {}
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ best: S.best, maxLevel: S.maxLevel, sound: S.sound })); } catch (e) {}
  }

  /* ───────────── Reglas ───────────── */
  const emptyGrid = () => Array.from({ length: H }, () => Array(COLS).fill(null));

  function fillBag() {
    const b = TYPES.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  }
  function nextType() {
    while (S.queue.length < 4) { if (!S.bag.length) S.bag = fillBag(); S.queue.push(S.bag.pop()); }
    return S.queue.shift();
  }

  function cells(p) {
    const m = ROT[p.type][p.r], out = [];
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) if (m[r][c]) out.push([p.x + c, p.y + r]);
    return out;
  }
  function valid(p) {
    for (const [x, y] of cells(p)) {
      if (x < 0 || x >= COLS || y >= H || y < 0) return false;
      if (S.grid[y][x]) return false;
    }
    return true;
  }

  function spawn(type) {
    type = type || nextType();
    const size = SHAPES[type].length;
    const p = { type, r: 0, x: Math.floor((COLS - size) / 2), y: type === "I" ? 0 : 1 };
    S.cur = p;
    S.acc = 0;
    S.lockT = 0;
    S.resets = 0;
    if (!valid(p)) { S.cur = null; gameOver(); return false; }
    drawSide();
    return true;
  }

  function speed() {
    if (S.endless) return Math.max(90, LEVELS[4].speed * Math.pow(0.88, Math.floor(S.endlessLines / 10)));
    return LEVELS[S.lvl].speed;
  }

  function onGround() {
    return S.cur && !valid({ ...S.cur, y: S.cur.y + 1 });
  }

  function touched() {
    // mover o girar sobre el suelo da un poco más de tiempo (limitado)
    if (onGround() && S.resets < MAX_RESETS) { S.lockT = 0; S.resets++; }
  }

  function move(dx) {
    if (S.state !== "play" || !S.cur) return false;
    const p = { ...S.cur, x: S.cur.x + dx };
    if (!valid(p)) return false;
    S.cur = p;
    touched();
    sfx("move");
    return true;
  }

  function rotate(dir) {
    if (S.state !== "play" || !S.cur || S.cur.type === "O") return;
    const from = S.cur.r, to = (from + (dir > 0 ? 1 : 3)) % 4;
    const table = (S.cur.type === "I" ? KICK_I : KICK)[from + ">" + to];
    for (const [kx, ky] of table) {
      const p = { ...S.cur, r: to, x: S.cur.x + kx, y: S.cur.y - ky };
      if (valid(p)) { S.cur = p; touched(); sfx("rotate"); return; }
    }
  }

  function softStep() {
    if (S.state !== "play" || !S.cur) return false;
    const p = { ...S.cur, y: S.cur.y + 1 };
    if (!valid(p)) return false;
    S.cur = p;
    return true;
  }

  function ghostY() {
    let p = { ...S.cur };
    while (valid({ ...p, y: p.y + 1 })) p.y++;
    return p.y;
  }

  function hardDrop() {
    if (S.state !== "play" || !S.cur) return;
    const gy = ghostY();
    S.score += 2 * (gy - S.cur.y);
    S.cur.y = gy;
    sfx("drop");
    lock();
  }

  function doHold() {
    if (S.state !== "play" || !S.cur || !S.canHold) return;
    const t0 = S.cur.type;
    S.canHold = false;
    if (S.hold) { const h = S.hold; S.hold = t0; spawn(h); }
    else { S.hold = t0; spawn(); }
    sfx("rotate");
    drawSide();
  }

  function lock() {
    const p = S.cur;
    let above = true;
    for (const [x, y] of cells(p)) {
      S.grid[y][x] = p.type;
      if (y >= HIDDEN) above = false;
    }
    S.cur = null;
    S.canHold = true;
    if (above) return gameOver();
    const full = [];
    for (let y = 0; y < H; y++) if (S.grid[y].every(Boolean)) full.push(y);
    if (!full.length) { sfx("lock"); spawn(); updateHud(); return; }
    S.state = "clearing";
    S.flash = { rows: full, t: 0 };
    sfx(full.length >= 4 ? "tetra" : "clear");
  }

  function finishClear() {
    const rows = S.flash.rows;
    S.flash = null;
    for (const y of rows) { S.grid.splice(y, 1); S.grid.unshift(Array(COLS).fill(null)); }
    const n = rows.length;
    const mult = S.endless ? 6 : S.lvl + 1;
    S.score += [0, 100, 300, 500, 800][n] * mult;
    if (S.endless) {
      S.endlessLines += n;
      S.state = "play";
      spawn();
    } else {
      S.lines = Math.min(LEVELS[S.lvl].goal, S.lines + n);
      if (S.lines >= LEVELS[S.lvl].goal) { levelComplete(); }
      else { S.state = "play"; spawn(); }
    }
    checkBest();
    updateHud();
  }

  function checkBest() {
    if (S.score > S.best) { S.best = S.score; S.newBest = true; save(); }
  }

  /* ───────────── Flujo de niveles ───────────── */
  function newGame(from) {
    S.grid = emptyGrid();
    S.queue = [];
    S.bag = [];
    S.hold = null;
    S.canHold = true;
    S.score = 0;
    S.endless = false;
    S.endlessLines = 0;
    S.newBest = false;
    startLevel(from);
  }

  function startLevel(i) {
    S.lvl = i;
    S.lines = 0;
    S.cur = null;
    S.grid = emptyGrid();
    if (i > S.maxLevel) { S.maxLevel = i; save(); }
    applyLevelLook();
    S.state = "intro";
    sfx("level");
    showOverlay();
  }

  function applyLevelLook() {
    const L = LEVELS[S.lvl];
    document.documentElement.style.setProperty("--lc", L.color);
    $("reveal").style.backgroundImage = `url("img/${L.id}-bg.jpg")`;
    $("ambient").style.backgroundImage = `url("img/${L.id}-bg.jpg")`;
    $("lvlAvatar").src = `img/${L.id}.jpg`;
    $("veil").classList.remove("lift");
    updateHud();
  }

  function levelComplete() {
    S.state = "levelup";
    S.cur = null;
    sfx("level");
    $("veil").classList.add("lift");
    // el tablero se vacía para ver la imagen completa
    S.fade = { t: 0 };
    setTimeout(() => {
      if (S.state !== "levelup") return;
      S.grid = emptyGrid();
      S.fade = null;
      if (S.lvl === LEVELS.length - 1) { S.state = "victory"; sfx("win"); }
      showOverlay();
    }, 700);
  }

  function gameOver() {
    S.state = "over";
    S.cur = null;
    checkBest();
    sfx("over");
    setTimeout(showOverlay, 450);
    updateHud();
  }

  function begin() {
    S.state = "play";
    hideOverlay();
    spawn();
    updateHud();
  }

  function pause() {
    if (S.state === "play") { S.state = "pause"; showOverlay(); }
    else if (S.state === "pause") { S.state = "play"; hideOverlay(); }
  }

  /* ───────────── Ventanas sobre el tablero ───────────── */
  function avatarRow(active) {
    return `<div class="row">${LEVELS.map((L, i) =>
      `<img src="img/${L.id}.jpg" alt="${pick(L.name)}" class="${i <= active ? "on" : ""}">`).join("")}</div>`;
  }

  function showOverlay() {
    const o = $("overlay");
    const L = LEVELS[S.lvl];
    o.className = "overlay";
    let h = "";
    if (S.state === "menu") {
      const fine = matchMedia("(pointer: fine)").matches;
      h = `<h2>${t("title")}</h2>
        <p class="small">${t("sub")}</p>
        ${avatarRow(S.maxLevel)}
        <span class="small">${t("startFrom")}</span>
        <div class="lvl-pick">${LEVELS.map((_, i) =>
          `<button data-from="${i}" class="${i === S.startLevel ? "on" : ""}" ${i > S.maxLevel ? `disabled title="${t("locked")}"` : ""}>${i + 1}</button>`).join("")}</div>
        <button class="btn primary" data-act="start">▶ ${t("start")}</button>
        <p class="small">${t("help")}</p>
        ${fine ? `<p class="small">${t("keys")}</p>` : ""}`;
    } else if (S.state === "intro") {
      h = `<img class="big-av" src="img/${L.id}.jpg" alt="">
        <span class="tag">${t("level", { n: S.lvl + 1 })}</span>
        <h2>${pick(L.name)}</h2>
        <span class="novel">${pick(L.novel)}</span>
        <blockquote>“${pick(L.intro)}”</blockquote>
        <button class="btn primary" data-act="go">${t("go")}</button>`;
    } else if (S.state === "levelup") {
      o.classList.add("clear");
      h = `<span class="tag">${t("levelDone", { n: S.lvl + 1 })}</span>
        <h2>${pick(L.name)}</h2>
        <blockquote>“${pick(L.done)}”</blockquote>
        <button class="btn primary" data-act="nextlvl">${t("level", { n: S.lvl + 2 })} ▶</button>`;
    } else if (S.state === "victory") {
      o.classList.add("clear");
      h = `<span class="tag">🏆 ${t("victory")}</span>
        <h2>${pick(L.name)}</h2>
        <blockquote>“${pick(L.done)}”</blockquote>
        <div class="big-score">${S.score.toLocaleString()}</div>
        ${S.newBest ? `<span class="newbest">${t("newBest")}</span>` : ""}
        <button class="btn primary" data-act="endless">∞ ${t("endless")}</button>
        <button class="btn" data-act="again">↻ ${t("playAgain")}</button>`;
    } else if (S.state === "pause") {
      h = `<h2>${t("pause")}</h2>
        <button class="btn primary" data-act="resume">▶ ${t("resume")}</button>
        <button class="btn" data-act="restart">↻ ${t("restart")}</button>
        <button class="btn" data-act="menu">☰ ${t("menu")}</button>`;
    } else if (S.state === "over") {
      h = `<img class="big-av" src="img/${L.id}.jpg" alt="">
        <span class="tag">${t("gameOver")}</span>
        <blockquote>“${pick(L.lose)}”</blockquote>
        <div class="big-score">${S.score.toLocaleString()}</div>
        ${S.newBest ? `<span class="newbest">${t("newBest")}</span>` : ""}
        <button class="btn primary" data-act="retry">↻ ${t("level", { n: S.lvl + 1 })}</button>
        <button class="btn" data-act="menu">☰ ${t("menu")}</button>`;
    }
    if (o.classList.contains("clear")) h = `<div class="card">${h}</div>`;
    o.innerHTML = h;
    o.hidden = false;
  }

  function hideOverlay() { $("overlay").hidden = true; }

  $("overlay").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (S.state === "intro" && !b) return begin(); // tocar en cualquier parte también empieza
    if (!b) return;
    if (b.dataset.from !== undefined) { S.startLevel = +b.dataset.from; return showOverlay(); }
    const act = b.dataset.act;
    unlockAudio();
    if (act === "start") newGame(S.startLevel);
    else if (act === "go") begin();
    else if (act === "nextlvl") startLevel(S.lvl + 1);
    else if (act === "resume") pause();
    else if (act === "restart" || act === "retry") { S.newBest = false; S.score = 0; S.hold = null; S.queue = []; S.bag = []; startLevel(S.lvl); }
    else if (act === "menu") toMenu();
    else if (act === "again") newGame(0);
    else if (act === "endless") {
      S.endless = true;
      S.grid = emptyGrid();
      $("veil").classList.add("lift");
      S.state = "play";
      hideOverlay();
      spawn();
      updateHud();
    }
  });

  function toMenu() {
    S.state = "menu";
    S.cur = null;
    S.grid = emptyGrid();
    S.startLevel = Math.min(S.startLevel, S.maxLevel);
    S.lvl = S.startLevel;
    applyLevelLook();
    showOverlay();
  }

  /* ───────────── HUD ───────────── */
  function updateHud() {
    const L = LEVELS[S.lvl];
    $("lvlNum").textContent = S.endless ? t("endlessLvl") : t("level", { n: S.lvl + 1 });
    $("lvlName").textContent = pick(L.name);
    const goal = L.goal;
    const done = S.endless ? S.endlessLines : S.lines;
    $("lvlLines").textContent = S.endless ? String(done) : `${done}/${goal}`;
    $("lvlBar").style.width = S.endless ? "100%" : `${(done / goal) * 100}%`;
    $("score").textContent = S.score.toLocaleString();
    $("best").textContent = S.best.toLocaleString();
    // la imagen se descubre con cada línea
    if (!$("veil").classList.contains("lift")) $("veil").style.opacity = String(0.86 - 0.62 * (done / goal));
    $("btnPause").textContent = S.state === "pause" ? "▶" : "⏸";
  }

  /* ───────────── Dibujo ───────────── */
  const cv = $("board"), ctx = cv.getContext("2d");
  let cell = 20, dpr = 1;

  function resize() {
    dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = $("well").clientWidth, h = $("well").clientHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cell = cv.width / COLS;
    for (const id of ["next", "hold"]) {
      const c = $(id);
      const lw = 70, lh = id === "next" ? 160 : 52;
      c.width = lw * dpr; c.height = lh * dpr;
      c.style.width = lw + "px"; c.style.height = lh + "px";
    }
    drawSide();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return `rgb(${r},${g},${b})`;
  }

  function block(c, x, y, s, color, alpha) {
    const pad = s * 0.06, r = s * 0.18;
    c.globalAlpha = alpha;
    const gx = x + pad, gy = y + pad, gs = s - pad * 2;
    const grad = c.createLinearGradient(gx, gy, gx, gy + gs);
    grad.addColorStop(0, shade(color, 45));
    grad.addColorStop(1, shade(color, -35));
    c.fillStyle = grad;
    c.beginPath();
    c.roundRect ? c.roundRect(gx, gy, gs, gs, r) : c.rect(gx, gy, gs, gs);
    c.fill();
    c.strokeStyle = "rgba(0,0,0,.35)";
    c.lineWidth = Math.max(1, s * 0.04);
    c.stroke();
    // brillo
    c.fillStyle = "rgba(255,255,255,.28)";
    c.beginPath();
    c.roundRect ? c.roundRect(gx + gs * 0.12, gy + gs * 0.1, gs * 0.76, gs * 0.22, r * 0.6) : c.rect(gx + gs * 0.12, gy + gs * 0.1, gs * 0.76, gs * 0.22);
    c.fill();
    c.globalAlpha = 1;
  }

  function draw(dt) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    // cuadrícula suave
    ctx.strokeStyle = "rgba(255,255,255,.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) { ctx.moveTo(x * cell, 0); ctx.lineTo(x * cell, cv.height); }
    for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * cell); ctx.lineTo(cv.width, y * cell); }
    ctx.stroke();

    const fadeA = S.fade ? Math.max(0, 1 - (S.fade.t += dt) / 650) : 1;
    for (let y = HIDDEN; y < H; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = S.grid[y][x];
        if (v) block(ctx, x * cell, (y - HIDDEN) * cell, cell, COLORS[v], 0.93 * fadeA);
      }
    }
    if (S.flash) {
      const a = 0.35 + 0.5 * Math.abs(Math.sin(S.flash.t / 40));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      for (const y of S.flash.rows) ctx.fillRect(0, (y - HIDDEN) * cell, cv.width, cell);
    }
    if (S.cur && (S.state === "play" || S.state === "pause")) {
      // pieza fantasma
      const gy = ghostY();
      ctx.strokeStyle = COLORS[S.cur.type];
      ctx.lineWidth = Math.max(1.5, cell * 0.07);
      ctx.globalAlpha = 0.55;
      for (const [x, y] of cells({ ...S.cur, y: gy })) {
        if (y < HIDDEN) continue;
        ctx.fillStyle = "rgba(255,255,255,.07)";
        ctx.fillRect(x * cell + cell * 0.1, (y - HIDDEN) * cell + cell * 0.1, cell * 0.8, cell * 0.8);
        ctx.strokeRect(x * cell + cell * 0.1, (y - HIDDEN) * cell + cell * 0.1, cell * 0.8, cell * 0.8);
      }
      ctx.globalAlpha = 1;
      for (const [x, y] of cells(S.cur)) if (y >= HIDDEN) block(ctx, x * cell, (y - HIDDEN) * cell, cell, COLORS[S.cur.type], 1);
    }
  }

  function drawMini(c, type, cx, cy, s) {
    const m = SHAPES[type];
    let minR = 9, maxR = -1, minC = 9, maxC = -1;
    m.forEach((row, r) => row.forEach((v, k) => { if (v) { minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, k); maxC = Math.max(maxC, k); } }));
    const w = (maxC - minC + 1) * s, h = (maxR - minR + 1) * s;
    m.forEach((row, r) => row.forEach((v, k) => {
      if (v) block(c, cx - w / 2 + (k - minC) * s, cy - h / 2 + (r - minR) * s, s, COLORS[type], 1);
    }));
  }

  function drawSide() {
    const n = $("next"), nc = n.getContext("2d");
    nc.clearRect(0, 0, n.width, n.height);
    const s = 14 * dpr;
    S.queue.slice(0, 3).forEach((ty, i) => drawMini(nc, ty, n.width / 2, (26 + i * 52) * dpr, i === 0 ? s : s * 0.8));
    const hc = $("hold"), hx = hc.getContext("2d");
    hx.clearRect(0, 0, hc.width, hc.height);
    if (S.hold) {
      hx.globalAlpha = 1;
      drawMini(hx, S.hold, hc.width / 2, hc.height / 2, 13 * dpr);
      if (!S.canHold) { hx.fillStyle = "rgba(13,11,20,.55)"; hx.fillRect(0, 0, hc.width, hc.height); }
    }
  }

  /* ───────────── Bucle principal ───────────── */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(100, now - last);
    last = now;
    if (S.state === "play" && S.cur) {
      S.acc += dt;
      const g = S.soft ? Math.min(SOFT_MS, speed()) : speed();
      while (S.acc >= g) {
        S.acc -= g;
        if (softStep()) { if (S.soft) S.score += 1; S.lockT = 0; }
        else break;
      }
      if (onGround()) {
        S.lockT += dt;
        if (S.lockT >= LOCK_MS) lock();
      }
      updateScoreOnly();
    } else if (S.state === "clearing" && S.flash) {
      S.flash.t += dt;
      if (S.flash.t > 260) finishClear();
    }
    held.forEach((h, k) => {
      if (now >= h.next) { act(k, true); h.next = now + (k === "down" ? SOFT_MS : ARR); }
    });
    draw(dt);
    requestAnimationFrame(frame);
  }
  let shownScore = -1;
  function updateScoreOnly() {
    if (shownScore !== S.score) { shownScore = S.score; $("score").textContent = S.score.toLocaleString(); }
  }

  /* ───────────── Controles ───────────── */
  const held = new Map(); // tecla mantenida → próxima repetición

  function act(k, repeat) {
    if (k === "left") move(-1);
    else if (k === "right") move(1);
    else if (k === "down") { S.soft = true; }
    else if (!repeat) {
      if (k === "rotate") rotate(1);
      else if (k === "ccw") rotate(-1);
      else if (k === "drop") hardDrop();
      else if (k === "hold") doHold();
    }
  }
  function press(k) {
    if (S.state !== "play") return;
    if (held.has(k)) return;
    act(k, false);
    if (k === "left" || k === "right") held.set(k, { next: performance.now() + DAS });
    if (k === "down") held.set(k, { next: performance.now() + 1e9 });
  }
  function release(k) {
    held.delete(k);
    if (k === "down") S.soft = false;
  }

  const KEYMAP = {
    ArrowLeft: "left", ArrowRight: "right", ArrowDown: "down", ArrowUp: "rotate", KeyX: "rotate",
    KeyZ: "ccw", Space: "drop", KeyC: "hold", ShiftLeft: "hold", ShiftRight: "hold",
  };
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("select")) return;
    if (e.code === "KeyP" || e.code === "Escape") { pause(); return; }
    if (e.code === "Enter" && !$("overlay").hidden) {
      const b = $("overlay").querySelector(".btn.primary");
      if (b) { b.click(); e.preventDefault(); }
      return;
    }
    const k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    if (e.repeat) return;
    unlockAudio();
    press(k);
  });
  document.addEventListener("keyup", (e) => { const k = KEYMAP[e.code]; if (k) release(k); });

  // Botones táctiles
  $("pad").querySelectorAll("button").forEach((b) => {
    const k = b.dataset.k;
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      unlockAudio();
      b.classList.add("on");
      try { b.setPointerCapture(e.pointerId); } catch (err) {}
      press(k);
    });
    const up = () => { b.classList.remove("on"); release(k); };
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("lostpointercapture", up);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
  });
  $("holdBox").addEventListener("click", () => { unlockAudio(); doHold(); });

  // Gestos sobre el tablero
  let g = null;
  const well = $("well");
  well.addEventListener("pointerdown", (e) => {
    if (S.state !== "play" || !$("overlay").hidden) return;
    unlockAudio();
    const cw = well.clientWidth / COLS;
    g = { x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, t0: performance.now(), cw, moved: false, soft: 0 };
    try { well.setPointerCapture(e.pointerId); } catch (err) {}
  });
  well.addEventListener("pointermove", (e) => {
    if (!g) return;
    const dx = e.clientX - g.lx, dy = e.clientY - g.ly;
    const step = g.cw * 0.85;
    if (Math.abs(dx) >= step) {
      const n = Math.trunc(dx / step);
      for (let i = 0; i < Math.abs(n); i++) move(Math.sign(n));
      g.lx += n * step;
      g.moved = true;
    }
    if (dy >= g.cw) {
      const n = Math.floor(dy / g.cw);
      // arrastrar despacio hacia abajo baja la pieza casilla a casilla
      const v = (e.clientY - g.y0) / (performance.now() - g.t0);
      if (v < 0.9) for (let i = 0; i < n; i++) { if (softStep()) { S.score += 1; g.soft++; } }
      g.ly += n * g.cw;
      g.moved = true;
    }
  });
  well.addEventListener("pointerup", (e) => {
    if (!g) return;
    const dt = performance.now() - g.t0;
    const ty = e.clientY - g.y0, tx = e.clientX - g.x0;
    const vy = ty / dt;
    if (!g.moved && Math.hypot(tx, ty) < 12 && dt < 350) rotate(1);
    else if (ty > g.cw * 2 && vy > 0.9 && Math.abs(ty) > Math.abs(tx)) hardDrop();
    g = null;
  });
  well.addEventListener("pointercancel", () => { g = null; });

  $("btnPause").addEventListener("click", () => { pause(); updateHud(); });
  $("btnSound").addEventListener("click", () => { S.sound = !S.sound; save(); renderSound(); unlockAudio(); sfx("rotate"); });
  function renderSound() { $("btnSound").textContent = S.sound ? "🔊" : "🔇"; }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && S.state === "play") { pause(); updateHud(); }
  });
  window.addEventListener("resize", resize);

  /* ───────────── Sonido ───────────── */
  let ac = null;
  function unlockAudio() {
    if (!S.sound) return;
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch (e) {}
  }
  function tone(f, dur, type, vol, when) {
    const o = ac.createOscillator(), gn = ac.createGain();
    const t0 = ac.currentTime + (when || 0);
    o.type = type || "square";
    o.frequency.setValueAtTime(f, t0);
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(vol || 0.06, t0 + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn).connect(ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  function sfx(kind) {
    if (!S.sound || !ac) return;
    try {
      if (kind === "move") tone(220, 0.04, "square", 0.025);
      else if (kind === "rotate") tone(440, 0.05, "triangle", 0.05);
      else if (kind === "lock") tone(110, 0.08, "sine", 0.12);
      else if (kind === "drop") tone(90, 0.12, "sine", 0.16);
      else if (kind === "clear") [523, 659, 784].forEach((f, i) => tone(f, 0.12, "triangle", 0.07, i * 0.06));
      else if (kind === "tetra") [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, "triangle", 0.08, i * 0.07));
      else if (kind === "level") [392, 523, 659, 784].forEach((f, i) => tone(f, 0.22, "sine", 0.08, i * 0.09));
      else if (kind === "win") [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, "triangle", 0.08, i * 0.11));
      else if (kind === "over") [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, "sawtooth", 0.04, i * 0.13));
    } catch (e) {}
  }

  /* ───────────── Inicio ───────────── */
  I18N.mount($("lang"));
  I18N.onChange(() => { updateHud(); if (!$("overlay").hidden) showOverlay(); });
  I18N.apply();
  renderSound();
  S.grid = emptyGrid();
  S.startLevel = S.maxLevel;
  S.lvl = S.startLevel;
  resize();
  applyLevelLook();
  showOverlay();
  requestAnimationFrame(frame);

  // Para pruebas automáticas
  window.__bloques = { S, move, rotate, hardDrop, doHold, cells, valid };
})();
