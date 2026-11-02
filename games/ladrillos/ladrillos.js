/*
 * Ladrillos de Litmir — rompe los ladrillos para descubrir a los personajes.
 * Pensado para ser fácil: pelota lenta, paleta ancha, 5 vidas y corazones de vida extra.
 */
(function () {
  "use strict";

  const t = (k, v) => I18N.t(k, v);
  const pick = (o) => I18N.pick(o);
  const $ = (id) => document.getElementById(id);
  const STORE = "ladrillos-litmir";

  const W = 360, H = 600;
  const PIC = { x: 10, y: 46, w: 340, h: 280 };
  const COLS = 8;
  const PADDLE_Y = 548, PADDLE_H = 14, BALL_R = 7.5;
  const START_LIVES = 5, MAX_LIVES = 9, HEART_CHANCE = 0.09;

  const S = {
    state: "menu", // menu | intro | play | pause | levelup | over | victory
    lvl: 0, startLevel: 0, maxLevel: 0,
    score: 0, best: 0, newBest: false,
    lives: START_LIVES,
    bricks: [], ball: null, stuck: true,
    px: W / 2, pw: 100, keys: { l: false, r: false },
    parts: [], hearts: [],
    sound: true,
  };

  try {
    const d = JSON.parse(localStorage.getItem(STORE) || "{}");
    S.best = +d.best || 0;
    S.maxLevel = Math.min(LEVELS.length - 1, Math.max(0, +d.maxLevel || 0));
    if (typeof d.sound === "boolean") S.sound = d.sound;
  } catch (e) {}
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ best: S.best, maxLevel: S.maxLevel, sound: S.sound })); } catch (e) {}
  }

  // Imágenes de los personajes
  const IMGS = {};
  LEVELS.forEach((L) => { const im = new Image(); im.src = `img/${L.id}.jpg`; IMGS[L.id] = im; });

  /* ───────────── Niveles ───────────── */
  function buildBricks() {
    const L = LEVELS[S.lvl];
    const bw = PIC.w / COLS, bh = PIC.h / L.rows;
    S.bricks = [];
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < COLS; c++) {
        S.bricks.push({ x: PIC.x + c * bw, y: PIC.y + r * bh, w: bw, h: bh, r, alive: true });
      }
    }
  }

  function resetBall() {
    S.stuck = true;
    S.ball = { x: S.px, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0 };
  }

  function launch() {
    if (S.state !== "play" || !S.stuck) return;
    const sp = LEVELS[S.lvl].speed;
    const a = (Math.random() - 0.5) * 0.7;
    S.ball.vx = sp * Math.sin(a);
    S.ball.vy = -sp * Math.cos(a);
    S.stuck = false;
    sfx("paddle");
  }

  function newGame(from) {
    S.score = 0;
    S.newBest = false;
    S.lives = START_LIVES;
    startLevel(from);
  }

  function startLevel(i) {
    S.lvl = i;
    if (i > S.maxLevel) { S.maxLevel = i; save(); }
    S.pw = LEVELS[i].paddle;
    S.parts = [];
    S.hearts = [];
    buildBricks();
    resetBall();
    applyLook();
    S.state = "intro";
    sfx("level");
    showOverlay();
    hud();
  }

  function applyLook() {
    const L = LEVELS[S.lvl];
    document.documentElement.style.setProperty("--lc", L.color);
    $("ambient").style.backgroundImage = `url("img/${L.id}.jpg")`;
    $("avatar").src = `img/${L.id}-av.jpg`;
  }

  function begin() {
    S.state = "play";
    hideOverlay();
    hud();
  }

  function levelClear() {
    S.state = "levelup";
    S.score += S.lives * 50;
    checkBest();
    hud();
    sfx(S.lvl === LEVELS.length - 1 ? "win" : "level");
    if (S.lvl === LEVELS.length - 1) S.state = "victory";
    setTimeout(showOverlay, 500);
  }

  function loseLife() {
    S.lives--;
    sfx("lose");
    hud();
    if (S.lives <= 0) {
      S.state = "over";
      checkBest();
      setTimeout(showOverlay, 400);
    } else {
      resetBall();
    }
  }

  function checkBest() {
    if (S.score > S.best) { S.best = S.score; S.newBest = true; save(); }
  }

  function pause() {
    if (S.state === "play") { S.state = "pause"; showOverlay(); }
    else if (S.state === "pause") { S.state = "play"; hideOverlay(); }
    hud();
  }

  /* ───────────── Física ───────────── */
  function step(dt) {
    // paleta con teclado
    const kv = (S.keys.r ? 1 : 0) - (S.keys.l ? 1 : 0);
    if (kv) S.px += kv * 480 * dt;
    S.px = Math.max(S.pw / 2, Math.min(W - S.pw / 2, S.px));

    const b = S.ball;
    if (S.stuck) { b.x = S.px; b.y = PADDLE_Y - BALL_R - 1; }
    else {
      const dist = Math.hypot(b.vx, b.vy) * dt;
      const n = Math.max(1, Math.ceil(dist / 3));
      for (let i = 0; i < n && S.state === "play"; i++) sub(dt / n);
    }

    // corazones que caen
    for (const h of S.hearts) {
      h.y += 110 * dt;
      if (h.y > PADDLE_Y - 8 && h.y < PADDLE_Y + PADDLE_H && Math.abs(h.x - S.px) < S.pw / 2 + 8) {
        h.got = true;
        if (S.lives < MAX_LIVES) S.lives++;
        S.score += 25;
        sfx("heart");
        burst(h.x, h.y, "#ff6b8b", 10);
        hud();
      }
    }
    S.hearts = S.hearts.filter((h) => !h.got && h.y < H + 20);

    // partículas
    for (const p of S.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.life -= dt; }
    S.parts = S.parts.filter((p) => p.life > 0);
  }

  function sub(dt) {
    const b = S.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); sfx("wall"); }
    if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); sfx("wall"); }
    if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); sfx("wall"); }

    // paleta: el ángulo depende de dónde toca la pelota
    if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y - BALL_R <= PADDLE_Y + PADDLE_H &&
        b.x >= S.px - S.pw / 2 - BALL_R && b.x <= S.px + S.pw / 2 + BALL_R) {
      const sp = Math.hypot(b.vx, b.vy);
      const rel = Math.max(-1, Math.min(1, (b.x - S.px) / (S.pw / 2)));
      const a = rel * 1.0;
      b.vx = sp * Math.sin(a);
      b.vy = -sp * Math.cos(a);
      b.y = PADDLE_Y - BALL_R - 0.5;
      sfx("paddle");
    }

    // ladrillos
    for (const k of S.bricks) {
      if (!k.alive) continue;
      const cx = Math.max(k.x, Math.min(b.x, k.x + k.w));
      const cy = Math.max(k.y, Math.min(b.y, k.y + k.h));
      const dx = b.x - cx, dy = b.y - cy;
      if (dx * dx + dy * dy > BALL_R * BALL_R) continue;
      k.alive = false;
      if (Math.abs(dx) > Math.abs(dy)) b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
      else b.vy = dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy);
      S.score += 10;
      sfx("brick", k.r);
      burst(k.x + k.w / 2, k.y + k.h / 2, LEVELS[S.lvl].color, 8);
      if (Math.random() < HEART_CHANCE) S.hearts.push({ x: k.x + k.w / 2, y: k.y + k.h / 2 });
      hud();
      if (!S.bricks.some((x) => x.alive)) levelClear();
      break;
    }

    if (b.y > H + BALL_R * 2) loseLife();
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 140;
      S.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.5 + Math.random() * 0.4, color, size: 2 + Math.random() * 3 });
    }
  }

  /* ───────────── Dibujo ───────────── */
  const cv = $("cv"), ctx = cv.getContext("2d");
  let k = 1;
  function resize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = $("stage").clientWidth;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(w * dpr * (H / W));
    k = cv.width / W;
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, v + amt));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }

  function draw() {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const L = LEVELS[S.lvl];
    // fondo
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#171325");
    g.addColorStop(1, "#0b0912");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // imagen del personaje (se ve donde ya no hay ladrillos)
    const im = IMGS[L.id];
    if (im.complete && im.naturalWidth) ctx.drawImage(im, PIC.x, PIC.y, PIC.w, PIC.h);
    ctx.strokeStyle = shade(L.color, 20);
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2;
    ctx.strokeRect(PIC.x - 1, PIC.y - 1, PIC.w + 2, PIC.h + 2);
    ctx.globalAlpha = 1;

    // ladrillos
    for (const b of S.bricks) {
      if (!b.alive) continue;
      const gr = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      gr.addColorStop(0, shade(L.color, 40 - b.r * 14));
      gr.addColorStop(1, shade(L.color, -10 - b.r * 14));
      ctx.fillStyle = gr;
      rr(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.22)";
      rr(b.x + 4, b.y + 4, b.w - 8, Math.min(6, b.h * 0.18), 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.35)";
      ctx.lineWidth = 1;
      rr(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3, 5);
      ctx.stroke();
    }

    // corazones
    ctx.font = "18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const h of S.hearts) ctx.fillText("❤️", h.x, h.y);

    // partículas
    for (const p of S.parts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // paleta
    const px = S.px - S.pw / 2;
    const pg = ctx.createLinearGradient(0, PADDLE_Y, 0, PADDLE_Y + PADDLE_H);
    pg.addColorStop(0, "#fff3c4");
    pg.addColorStop(0.5, "#e3b23c");
    pg.addColorStop(1, "#9c7210");
    ctx.shadowColor = L.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = pg;
    rr(px, PADDLE_Y, S.pw, PADDLE_H, PADDLE_H / 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // pelota
    const b = S.ball;
    if (b && (S.state === "play" || S.state === "pause" || S.state === "intro")) {
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 12;
      const bg = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, BALL_R);
      bg.addColorStop(0, "#ffffff");
      bg.addColorStop(1, "#d8d2ff");
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // aviso para lanzar
    if (S.state === "play" && S.stuck) {
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.font = "600 14px system-ui, sans-serif";
      ctx.fillText(t("launch"), W / 2, PADDLE_Y - 46);
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (S.state === "play") step(dt);
    else if (S.parts.length) { for (const p of S.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.life -= dt; } S.parts = S.parts.filter((p) => p.life > 0); }
    draw();
    requestAnimationFrame(frame);
  }

  /* ───────────── Marcador ───────────── */
  function hud() {
    const L = LEVELS[S.lvl];
    $("lvlNum").textContent = t("level", { n: S.lvl + 1 });
    $("lvlName").textContent = pick(L.name);
    $("lives").textContent = "❤️".repeat(Math.max(0, S.lives));
    $("score").textContent = S.score.toLocaleString();
    $("btnPause").textContent = S.state === "pause" ? "▶" : "⏸";
  }

  /* ───────────── Ventanas ───────────── */
  function showOverlay() {
    const o = $("overlay");
    const L = LEVELS[S.lvl];
    o.className = "overlay";
    let h = "";
    if (S.state === "menu") {
      const fine = matchMedia("(pointer: fine)").matches;
      h = `<h2>${t("title")}</h2>
        <p class="small">${t("sub")}</p>
        <div class="row">${LEVELS.map((x, i) => `<img src="img/${x.id}-av.jpg" alt="${pick(x.name)}" class="${i <= S.maxLevel ? "on" : ""}">`).join("")}</div>
        <p class="small">${t("startFrom")}</p>
        <div class="pick">${LEVELS.map((_, i) => `<button data-from="${i}" class="${i === S.startLevel ? "on" : ""}" ${i > S.maxLevel ? `disabled title="${t("locked")}"` : ""}>${i + 1}</button>`).join("")}</div>
        <button class="btn primary" data-act="start">▶ ${t("start")}</button>
        <p class="small">${t("help")}</p>
        ${fine ? `<p class="small">${t("keys")}</p>` : ""}
        ${S.best ? `<p class="small">${t("best")}: <b>${S.best.toLocaleString()}</b></p>` : ""}`;
    } else if (S.state === "intro") {
      h = `<img class="big-av" src="img/${L.id}-av.jpg" alt="">
        <span class="tag">${t("level", { n: S.lvl + 1 })}</span>
        <h2>${pick(L.name)}</h2>
        <span class="novel">${pick(L.novel)}</span>
        <blockquote>“${pick(L.intro)}”</blockquote>
        <button class="btn primary" data-act="go">${t("go")}</button>`;
    } else if (S.state === "levelup") {
      o.classList.add("clear");
      h = `<div class="card"><span class="tag">${t("levelDone", { n: S.lvl + 1 })}</span>
        <h2>${pick(L.name)}</h2>
        <blockquote>“${pick(L.done)}”</blockquote>
        <button class="btn primary" data-act="next">${t("next")} ▶</button></div>`;
    } else if (S.state === "victory") {
      o.classList.add("clear");
      h = `<div class="card"><span class="tag">🏆 ${t("victory")}</span>
        <blockquote>“${pick(L.done)}”</blockquote>
        <div class="big-score">${S.score.toLocaleString()}</div>
        ${S.newBest ? `<span class="newbest">${t("newBest")}</span>` : ""}
        <button class="btn primary" data-act="again">↻ ${t("playAgain")}</button>
        <button class="btn" data-act="menu">☰ ${t("menu")}</button></div>`;
    } else if (S.state === "pause") {
      h = `<h2>${t("pause")}</h2>
        <button class="btn primary" data-act="resume">▶ ${t("resume")}</button>
        <button class="btn" data-act="restart">↻ ${t("restart")}</button>
        <button class="btn" data-act="menu">☰ ${t("menu")}</button>`;
    } else if (S.state === "over") {
      h = `<img class="big-av" src="img/${L.id}-av.jpg" alt="">
        <span class="tag">${t("gameOver")}</span>
        <div class="big-score">${S.score.toLocaleString()}</div>
        ${S.newBest ? `<span class="newbest">${t("newBest")}</span>` : ""}
        <button class="btn primary" data-act="retry">↻ ${t("retry")}</button>
        <button class="btn" data-act="menu">☰ ${t("menu")}</button>`;
    }
    o.innerHTML = h;
    o.hidden = false;
  }
  function hideOverlay() { $("overlay").hidden = true; }

  $("overlay").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (S.state === "intro" && !b) { unlockAudio(); return begin(); }
    if (!b) return;
    unlockAudio();
    if (b.dataset.from !== undefined) { S.startLevel = +b.dataset.from; S.lvl = S.startLevel; applyLook(); hud(); buildBricks(); return showOverlay(); }
    const act = b.dataset.act;
    if (act === "start") newGame(S.startLevel);
    else if (act === "go") begin();
    else if (act === "next") startLevel(S.lvl + 1);
    else if (act === "resume") pause();
    else if (act === "restart") { S.lives = START_LIVES; startLevel(S.lvl); }
    else if (act === "retry") { S.lives = START_LIVES; S.newBest = false; startLevel(S.lvl); }
    else if (act === "again") newGame(0);
    else if (act === "menu") toMenu();
  });

  function toMenu() {
    S.state = "menu";
    S.startLevel = Math.min(S.startLevel, S.maxLevel);
    S.lvl = S.startLevel;
    S.pw = LEVELS[S.lvl].paddle;
    buildBricks();
    resetBall();
    applyLook();
    hud();
    showOverlay();
  }

  /* ───────────── Controles ───────────── */
  const stage = $("stage");
  function pointerX(e) {
    const r = stage.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
  }
  stage.addEventListener("pointermove", (e) => {
    if (S.state !== "play") return;
    S.px = pointerX(e);
  });
  stage.addEventListener("pointerdown", (e) => {
    if (S.state !== "play" || !$("overlay").hidden) return;
    unlockAudio();
    S.px = pointerX(e);
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    if (S.stuck) launch();
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("select")) return;
    if (e.code === "ArrowLeft") { S.keys.l = true; e.preventDefault(); }
    else if (e.code === "ArrowRight") { S.keys.r = true; e.preventDefault(); }
    else if (e.code === "Space") { e.preventDefault(); unlockAudio(); if (S.state === "play") launch(); }
    else if (e.code === "KeyP" || e.code === "Escape") pause();
    else if (e.code === "Enter" && !$("overlay").hidden) {
      const b = $("overlay").querySelector(".btn.primary");
      if (b) { e.preventDefault(); b.click(); }
    }
  });
  document.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft") S.keys.l = false;
    if (e.code === "ArrowRight") S.keys.r = false;
  });

  $("btnPause").addEventListener("click", pause);
  $("btnSound").addEventListener("click", () => { S.sound = !S.sound; save(); renderSound(); unlockAudio(); sfx("paddle"); });
  function renderSound() { $("btnSound").textContent = S.sound ? "🔊" : "🔇"; }
  document.addEventListener("visibilitychange", () => { if (document.hidden && S.state === "play") pause(); });
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
    o.type = type || "sine";
    o.frequency.setValueAtTime(f, t0);
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(vol || 0.06, t0 + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn).connect(ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  function sfx(kind, row) {
    if (!S.sound || !ac) return;
    try {
      if (kind === "paddle") tone(330, 0.07, "triangle", 0.07);
      else if (kind === "wall") tone(220, 0.04, "triangle", 0.03);
      else if (kind === "brick") tone(880 - (row || 0) * 70, 0.08, "square", 0.035);
      else if (kind === "heart") [660, 880].forEach((f, i) => tone(f, 0.12, "sine", 0.07, i * 0.08));
      else if (kind === "lose") [300, 200].forEach((f, i) => tone(f, 0.2, "sawtooth", 0.04, i * 0.12));
      else if (kind === "level") [392, 523, 659, 784].forEach((f, i) => tone(f, 0.22, "sine", 0.08, i * 0.09));
      else if (kind === "win") [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, "triangle", 0.08, i * 0.11));
    } catch (e) {}
  }

  /* ───────────── Inicio ───────────── */
  I18N.mount($("lang"));
  I18N.onChange(() => { hud(); if (!$("overlay").hidden) showOverlay(); });
  I18N.apply();
  renderSound();
  S.startLevel = S.maxLevel;
  S.lvl = S.startLevel;
  S.pw = LEVELS[S.lvl].paddle;
  buildBricks();
  resetBall();
  applyLook();
  resize();
  hud();
  showOverlay();
  requestAnimationFrame(frame);

  window.__ladrillos = { S, launch };
})();
