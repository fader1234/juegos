/*
 * Ajedrez de las novelas: juegas contra los personajes de Litmir.
 * Motor: chess-engine.js (del sitio Litmir), en un Web Worker para no congelar la pantalla.
 */
(function () {
  "use strict";

  const t = (k, v) => I18N.t(k, v);
  const pick = (o) => I18N.pick(o);
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const C = window.Chess;

  const PREFS = "ajedrez-prefs";
  const PROGRESS = "ajedrez-progress";
  const THEMES = {
    venecia: ["#f2e6d0", "#a65f4e"],
    pergamino: ["#f4e8cf", "#b48a5c"],
    salvaje: ["#dde8ef", "#6c8ca2"],
  };
  const VALUE = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9 };
  const START_COUNT = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 };

  const S = {
    screen: "select",
    rival: null,
    theme: "venecia",
    colorPref: "w",
    me: "w",
    pos: null,
    hist: [],
    sans: [],
    lastMove: null,
    sel: null,
    targets: [],
    over: null,
    thinking: false,
    sound: true,
    beaten: [],
    reqId: 0,
    gameId: 0,
    animating: false,
    askStart: 0,
    drag: null,
    resignArm: false,
    modal: null,
  };

  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || "{}");
    if (THEMES[p.theme]) S.theme = p.theme;
    if (["w", "b", "r"].includes(p.colorPref)) S.colorPref = p.colorPref;
    if (typeof p.sound === "boolean") S.sound = p.sound;
    const g = JSON.parse(localStorage.getItem(PROGRESS) || "[]");
    if (Array.isArray(g)) S.beaten = g;
  } catch (e) {}

  function save() {
    try {
      localStorage.setItem(PREFS, JSON.stringify({ theme: S.theme, colorPref: S.colorPref, sound: S.sound }));
      localStorage.setItem(PROGRESS, JSON.stringify(S.beaten));
    } catch (e) {}
  }

  /* ───────────── Motor ───────────── */
  let worker = null;
  try {
    worker = new Worker("chess-engine.js");
    worker.onmessage = (e) => deliver(e.data);
    worker.onerror = () => { worker = null; };
  } catch (e) { worker = null; }

  function askEngine() {
    const id = ++S.reqId;
    S.thinking = true;
    S.askStart = Date.now();
    renderBars();
    const level = S.rival.level;
    if (worker) {
      worker.postMessage({ id, moves: S.hist.slice(), level });
    } else {
      setTimeout(() => {
        const p = C.fromMoves(S.hist);
        const m = C.bestMove(p, level);
        deliver({ id, move: m ? C.uci(m) : null });
      }, 30);
    }
  }

  function deliver(data) {
    // Pausa mínima para que la respuesta se sienta natural
    const delay = Math.max(0, 600 - (Date.now() - S.askStart));
    setTimeout(() => {
      if (data.id !== S.reqId || S.over || S.screen !== "game") return;
      S.thinking = false;
      const m = data.move && C.fromUci(S.pos, data.move);
      if (m) playMove(m);
      else renderBars();
    }, delay);
  }

  /* ───────────── Utilidades del tablero ───────────── */
  const colorOf = (p) => (p & C.BLACK ? "b" : "w");
  const sideToMove = () => (S.pos.side ? "b" : "w");
  const engineColor = () => (S.me === "w" ? "b" : "w");
  const myTurn = () => S.screen === "game" && !S.over && !S.thinking && !S.animating && sideToMove() === S.me;

  function disp(sq) {
    const f = sq & 7, r = sq >> 4;
    return S.me === "w" ? { c: f, r: 7 - r } : { c: 7 - f, r };
  }
  function sqAt(c, r) {
    const f = S.me === "w" ? c : 7 - c;
    const rank = S.me === "w" ? 7 - r : r;
    return rank * 16 + f;
  }
  function sqFromEvent(e) {
    const rect = $("board").getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * 8);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * 8);
    if (c < 0 || c > 7 || r < 0 || r > 7) return -1;
    return sqAt(c, r);
  }

  /* ───────────── Dibujo del tablero ───────────── */
  let squareEls = new Map();
  let pieceEls = new Map();

  function buildSquares() {
    const box = $("squares");
    box.innerHTML = "";
    squareEls = new Map();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = sqAt(c, r);
        const dark = ((sq >> 4) + (sq & 7)) % 2 === 0;
        const d = document.createElement("div");
        d.className = "sq " + (dark ? "dark" : "light");
        if (r === 7) d.insertAdjacentHTML("beforeend", `<span class="coord f">${"abcdefgh"[sq & 7]}</span>`);
        if (c === 0) d.insertAdjacentHTML("beforeend", `<span class="coord r">${(sq >> 4) + 1}</span>`);
        box.appendChild(d);
        squareEls.set(sq, d);
      }
    }
  }

  function place(el, sq) {
    const d = disp(sq);
    el.style.transform = `translate(${d.c * 100}%, ${d.r * 100}%)`;
  }

  function drawPieces() {
    const layer = $("pieces");
    layer.innerHTML = "";
    pieceEls = new Map();
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = S.pos.b[sq];
      if (!p) continue;
      const el = document.createElement("div");
      el.className = "pc";
      el.innerHTML = Pieces.svg(p & 7, colorOf(p));
      place(el, sq);
      layer.appendChild(el);
      pieceEls.set(sq, el);
    }
  }

  function kingSquare(color) {
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = S.pos.b[sq];
      if (p && (p & 7) === C.K && colorOf(p) === color) return sq;
    }
    return -1;
  }

  function paint() {
    const checkSq = S.pos && C.inCheck(S.pos) ? kingSquare(sideToMove()) : -1;
    const tset = new Map(S.targets.map((m) => [C.to(m), m]));
    squareEls.forEach((el, sq) => {
      el.classList.toggle("last", !!S.lastMove && (S.lastMove.from === sq || S.lastMove.to === sq));
      el.classList.toggle("sel", S.sel === sq);
      el.classList.toggle("check", sq === checkSq);
      el.querySelectorAll(".dot,.ring").forEach((x) => x.remove());
      if (tset.has(sq)) {
        const m = tset.get(sq);
        el.insertAdjacentHTML("beforeend", C.isCapture(m) ? '<span class="ring"></span>' : '<span class="dot"></span>');
      }
    });
  }

  /* ───────────── Barras de jugadores ───────────── */
  function capturedHtml(color) {
    // piezas de "color" que ya no están en el tablero
    const cnt = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = S.pos.b[sq];
      if (p && colorOf(p) === color && (p & 7) !== C.K) cnt[p & 7]++;
    }
    let h = "";
    for (const ty of [1, 2, 3, 4, 5]) {
      const miss = Math.max(0, START_COUNT[ty] - cnt[ty]);
      for (let i = 0; i < miss; i++) h += Pieces.svg(ty, color);
    }
    return { h, mat: Object.entries(cnt).reduce((a, [k, v]) => a + VALUE[k] * v, 0) };
  }

  function renderBars() {
    if (!S.pos) return;
    const eng = engineColor();
    const mine = capturedHtml(eng);  // lo que yo capturé
    const theirs = capturedHtml(S.me); // lo que capturó el rival
    const diff = theirs.mat - mine.mat; // mi material - material rival
    $("myCaptured").innerHTML = mine.h + (diff > 0 ? `<span class="adv">+${diff}</span>` : "");
    $("oppCaptured").innerHTML = theirs.h + (diff < 0 ? `<span class="adv">+${-diff}</span>` : "");

    const inCheck = C.inCheck(S.pos);
    const oppSt = $("oppStatus"), mySt = $("myStatus");
    oppSt.className = "status";
    mySt.className = "status";
    oppSt.textContent = "";
    mySt.textContent = "";
    if (!S.over) {
      if (S.thinking) { oppSt.textContent = t("thinking").replace(/…$/, ""); oppSt.classList.add("thinking", "active"); }
      else if (sideToMove() === S.me) { mySt.textContent = inCheck ? t("check") : t("yourTurn"); mySt.classList.add("active"); }
    }
    $("oppBar").classList.toggle("turn", !S.over && sideToMove() === eng);
    document.querySelector(".player-bar.me").classList.toggle("turn", !S.over && sideToMove() === S.me);
    $("btnUndo").disabled = !!S.over || S.hist.length === 0 || (S.me === "b" && S.hist.length <= 1);
    $("btnResign").disabled = !!S.over;
  }

  function renderMoves() {
    const box = $("moves");
    let h = "";
    for (let i = 0; i < S.sans.length; i += 2) {
      const cur = i >= S.sans.length - 2 ? " cur" : "";
      h += `<span class="${cur}"><b>${i / 2 + 1}.</b>${S.sans[i]}${S.sans[i + 1] ? " " + S.sans[i + 1] : ""}</span>`;
    }
    box.innerHTML = h;
    box.scrollLeft = box.scrollWidth;
  }

  let bubbleTimer = null;
  function say(key) {
    if (!S.rival) return;
    const b = $("bubble");
    b.textContent = "“" + pick(S.rival.lines[key]) + "”";
    b.hidden = false;
    b.style.animation = "none";
    void b.offsetWidth;
    b.style.animation = "";
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => (b.hidden = true), 4200);
  }

  /* ───────────── Sonido ───────────── */
  let ac = null;
  function sound(kind) {
    if (!S.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const now = ac.currentTime;
      // golpe de madera: ruido corto filtrado
      const len = Math.floor(ac.sampleRate * 0.06);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const f = ac.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = kind === "cap" ? 900 : 1500;
      f.Q.value = 2.5;
      const g = ac.createGain();
      g.gain.value = kind === "cap" ? 1.3 : 0.9;
      src.connect(f).connect(g).connect(ac.destination);
      src.start(now);
      if (kind === "check" || kind === "end") {
        const o = ac.createOscillator(), og = ac.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(kind === "end" ? 392 : 784, now + 0.05);
        og.gain.setValueAtTime(0.0001, now + 0.05);
        og.gain.exponentialRampToValueAtTime(0.12, now + 0.07);
        og.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "end" ? 0.9 : 0.35));
        o.connect(og).connect(ac.destination);
        o.start(now + 0.05);
        o.stop(now + 1);
      }
    } catch (e) {}
  }

  /* ───────────── Jugadas ───────────── */
  async function playMove(m) {
    S.animating = true;
    const san = C.san(S.pos, m);
    const from = C.from(m), to = C.to(m);
    const mover = sideToMove();
    const el = pieceEls.get(from);

    let capSq = -1;
    if (C.isEp(m)) capSq = (from & 0x70) | (to & 7);
    else if (C.isCapture(m)) capSq = to;
    if (capSq >= 0) {
      const ce = pieceEls.get(capSq);
      if (ce && ce !== el) { ce.classList.add("gone"); setTimeout(() => ce.remove(), 220); }
      pieceEls.delete(capSq);
    }
    if (el) {
      el.classList.remove("drag");
      place(el, to);
      pieceEls.delete(from);
      pieceEls.set(to, el);
    }
    if (C.isCastle(m)) {
      const rank = from & 0x70, king = (to & 7) === 6;
      const rf = rank | (king ? 7 : 0), rt = rank | (king ? 5 : 3);
      const re = pieceEls.get(rf);
      if (re) { place(re, rt); pieceEls.delete(rf); pieceEls.set(rt, re); }
    }

    C.make(S.pos, m);
    S.hist.push(C.uci(m));
    S.sans.push(san);
    if (C.promo(m) && el) el.innerHTML = Pieces.svg(C.promo(m), mover);
    S.lastMove = { from, to };
    S.sel = null;
    S.targets = [];
    sound(capSq >= 0 ? "cap" : "move");
    paint();
    renderBars();
    renderMoves();

    const myGame = S.gameId;
    await wait(240);
    if (myGame !== S.gameId) return;
    S.animating = false;
    if (S.screen !== "game") return;
    drawPieces();
    paint();

    const st = C.status(S.pos);
    if (st) return finish(st);

    if (C.inCheck(S.pos)) {
      sound("check");
      say(mover === S.me ? "checked" : "check");
    }
    if (sideToMove() !== S.me && !S.thinking) askEngine();
    else renderBars();
  }

  function select(sq) {
    S.sel = sq;
    S.targets = C.legal(S.pos).filter((m) => C.from(m) === sq);
    paint();
  }

  function tryMove(from, to) {
    const cands = S.targets.filter((m) => C.from(m) === from && C.to(m) === to);
    if (!cands.length) return false;
    if (cands.length > 1) { showPromo(cands); return true; }
    playMove(cands[0]);
    return true;
  }

  function showPromo(cands) {
    const box = $("promo");
    const col = S.me;
    box.innerHTML = `<div class="pbox"><p>${t("promote")}</p><div>${[5, 4, 3, 2]
      .map((ty) => `<button data-ty="${ty}" aria-label="${t("p" + ty)}">${Pieces.svg(ty, col)}</button>`)
      .join("")}</div></div>`;
    box.hidden = false;
    const shownAt = Date.now();
    box.onclick = (e) => {
      const b = e.target.closest("button");
      // el mismo toque que abrió el diálogo no debe cerrarlo
      if (!b && Date.now() - shownAt < 400) return;
      box.hidden = true;
      if (!b) { drawPieces(); S.sel = null; S.targets = []; paint(); return; }
      const m = cands.find((x) => C.promo(x) === +b.dataset.ty);
      if (m) playMove(m);
    };
  }

  /* Ratón y pantalla táctil: tocar o arrastrar */
  const board = $("board");
  board.addEventListener("pointerdown", (e) => {
    if (!myTurn() || !$("promo").hidden) return;
    const sq = sqFromEvent(e);
    if (sq < 0) return;
    if (S.sel !== null && S.sel !== sq && S.targets.some((m) => C.to(m) === sq)) {
      tryMove(S.sel, sq);
      return;
    }
    const p = S.pos.b[sq];
    if (p && colorOf(p) === S.me) {
      const was = S.sel === sq;
      select(sq);
      const el = pieceEls.get(sq);
      S.drag = { sq, el, x: e.clientX, y: e.clientY, moved: false, was };
      try { board.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    } else {
      S.sel = null;
      S.targets = [];
      paint();
    }
  });

  let hoverEl = null;
  board.addEventListener("pointermove", (e) => {
    const d = S.drag;
    if (!d || !d.el) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
    d.moved = true;
    d.el.classList.add("drag");
    const rect = board.getBoundingClientRect();
    const size = rect.width / 8;
    d.el.style.transform = `translate(${e.clientX - rect.left - size / 2}px, ${e.clientY - rect.top - size / 2}px)`;
    const sq = sqFromEvent(e);
    const el = squareEls.get(sq);
    if (hoverEl !== el) {
      if (hoverEl) hoverEl.classList.remove("hover");
      hoverEl = el && S.targets.some((m) => C.to(m) === sq) ? el : null;
      if (hoverEl) hoverEl.classList.add("hover");
    }
  });

  function endDrag(e, cancel) {
    const d = S.drag;
    if (!d) return;
    S.drag = null;
    if (hoverEl) { hoverEl.classList.remove("hover"); hoverEl = null; }
    if (d.moved) {
      const sq = cancel ? -1 : sqFromEvent(e);
      if (sq >= 0 && sq !== d.sq && tryMove(d.sq, sq)) return;
      d.el.classList.remove("drag");
      place(d.el, d.sq);
    } else if (d.was) {
      // tocar de nuevo la pieza elegida la suelta
      S.sel = null;
      S.targets = [];
      paint();
    }
  }
  board.addEventListener("pointerup", (e) => endDrag(e, false));
  board.addEventListener("pointercancel", (e) => endDrag(e, true));

  /* ───────────── Fin de partida ───────────── */
  async function finish(reason) {
    let result;
    if (reason === "mate") result = sideToMove() === S.me ? "lose" : "win";
    else if (reason === "resign") result = "lose";
    else result = "draw";
    S.over = { result, reason };
    S.thinking = false;
    S.reqId++;
    renderBars();
    paint();
    if (result === "win" && !S.beaten.includes(S.rival.id)) { S.beaten.push(S.rival.id); save(); }
    if (reason !== "resign") say(result === "win" ? "lose" : result === "lose" ? "win" : "draw");
    sound("end");
    await wait(reason === "resign" ? 300 : 1300);
    if (!S.over) return;
    S.modal = "end";
    renderModal();
  }

  function renderModal() {
    const box = $("modalBox");
    if (S.modal !== "end" || !S.over) { $("modal").hidden = true; return; }
    const r = S.rival;
    const { result, reason } = S.over;
    const idx = RIVALS.indexOf(r);
    const next = RIVALS[idx + 1];
    const title = t(result === "win" ? "youWin" : result === "lose" ? "youLose" : "draw");
    const line = pick(r.lines[result === "win" ? "lose" : result === "lose" ? "win" : "draw"]);
    const champ = result === "win" && r.boss && RIVALS.every((x) => S.beaten.includes(x.id));
    box.innerHTML = `
      <img class="mpic" src="img/${r.id}.jpg" alt="">
      <h2>${title}</h2>
      <p class="reason">${t("r_" + reason)}</p>
      ${reason === "resign" ? "" : `<blockquote>“${line}”<cite>— ${pick(r.name)}</cite></blockquote>`}
      ${champ ? `<p class="champ">${t("champion")}</p>` : ""}
      <div class="actions">
        ${result === "win" && next ? `<button class="btn primary" data-act="next">${t("nextRival")}: ${pick(next.name)} ▶</button>` : ""}
        <button class="btn ${result === "win" && next ? "" : "primary"}" data-act="rematch">↻ ${t("rematch")}</button>
        <button class="btn" data-act="choose">👥 ${t("chooseRival")}</button>
      </div>`;
    $("modal").hidden = false;
  }

  $("modalBox").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const act = b.dataset.act;
    S.modal = null;
    $("modal").hidden = true;
    if (act === "next") startGame(RIVALS[RIVALS.indexOf(S.rival) + 1]);
    else if (act === "rematch") startGame(S.rival);
    else if (act === "choose") showSelect();
  });

  /* ───────────── Controles ───────────── */
  function undo() {
    if (S.over || !S.hist.length) return;
    S.reqId++;
    S.gameId++;
    S.animating = false;
    S.thinking = false;
    let n = sideToMove() === S.me ? 2 : 1;
    n = Math.min(n, S.hist.length);
    for (let i = 0; i < n; i++) { C.unmake(S.pos); S.hist.pop(); S.sans.pop(); }
    const u = S.hist[S.hist.length - 1];
    S.lastMove = u ? { from: C.nameSq(u.slice(0, 2)), to: C.nameSq(u.slice(2, 4)) } : null;
    S.sel = null;
    S.targets = [];
    drawPieces();
    paint();
    renderBars();
    renderMoves();
    if (sideToMove() !== S.me) askEngine();
  }
  $("btnUndo").addEventListener("click", undo);

  let resignTimer = null;
  $("btnResign").addEventListener("click", () => {
    if (S.over) return;
    const btn = $("btnResign");
    if (!S.resignArm) {
      S.resignArm = true;
      btn.classList.add("warn");
      $("resignLbl").textContent = t("sure");
      clearTimeout(resignTimer);
      resignTimer = setTimeout(disarmResign, 3000);
      return;
    }
    disarmResign();
    finish("resign");
  });
  function disarmResign() {
    S.resignArm = false;
    $("btnResign").classList.remove("warn");
    $("resignLbl").textContent = t("resign");
  }

  $("btnSound").addEventListener("click", () => {
    S.sound = !S.sound;
    save();
    renderSoundBtn();
    if (S.sound) sound("move");
  });
  function renderSoundBtn() { $("btnSound").textContent = S.sound ? "🔊" : "🔇"; }

  $("btnRivals").addEventListener("click", showSelect);

  /* ───────────── Pantallas ───────────── */
  function setAmbient(id) {
    $("ambient").style.backgroundImage = `url("img/${id}-scene.jpg")`;
  }

  function applyTheme() {
    $("boardWrap").dataset.theme = S.theme;
    renderThemePickers();
  }

  function themeButtons(mini) {
    return Object.keys(THEMES).map((k) => {
      const [l, d] = THEMES[k];
      let cells = "";
      for (let i = 0; i < 16; i++) cells += `<i style="background:${((i >> 2) + i) % 2 ? d : l}"></i>`;
      return `<button class="${S.theme === k ? "on" : ""}" data-theme="${k}" title="${t("th_" + k)}" aria-label="${t("th_" + k)}">
        <span class="swatch">${cells}</span><span>${t("th_" + k)}</span></button>`;
    }).join("");
  }
  function renderThemePickers() {
    $("themeSeg").innerHTML = themeButtons(false);
    $("themeSeg2").innerHTML = themeButtons(true);
  }
  function onThemeClick(e) {
    const b = e.target.closest("button[data-theme]");
    if (!b) return;
    S.theme = b.dataset.theme;
    save();
    applyTheme();
  }
  $("themeSeg").addEventListener("click", onThemeClick);
  $("themeSeg2").addEventListener("click", onThemeClick);

  function renderColorSeg() {
    $("colorSeg").innerHTML = [["w", "♔ " + t("white")], ["b", "♚ " + t("black")], ["r", "🎲 " + t("random")]]
      .map(([k, l]) => `<button class="${S.colorPref === k ? "on" : ""}" data-c="${k}">${l}</button>`).join("");
  }
  $("colorSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    S.colorPref = b.dataset.c;
    save();
    renderColorSeg();
  });

  function renderSelect() {
    $("rivalList").innerHTML = RIVALS.map((r, i) => {
      const won = S.beaten.includes(r.id);
      return `<button class="rival ${r.boss ? "boss" : ""}" data-id="${r.id}" style="--c:${r.color}">
        <img src="img/${r.id}-portrait.jpg" alt="${pick(r.name)}" loading="lazy">
        <div class="rbody">
          <span class="rnum">${i + 1} · ${t("lvl" + r.stars)}</span>
          <h3>${pick(r.name)}</h3>
          <span class="rtag">${pick(r.tag)}</span>
          <p class="rdesc">${pick(r.desc)}</p>
          <div class="rfoot">
            <span class="stars">${"★".repeat(r.stars)}<i>${"★".repeat(4 - r.stars)}</i></span>
            ${won ? `<span class="badge won">✓ ${t("beaten")}</span>` : ""}
            ${r.boss ? `<span class="badge boss">${t("finalBoss")}</span>` : ""}
            <span class="rplay">${t("play")} ▶</span>
          </div>
        </div>
      </button>`;
    }).join("");
    renderColorSeg();
    renderThemePickers();
  }

  $("rivalList").addEventListener("click", (e) => {
    const b = e.target.closest(".rival");
    if (b) startGame(RIVALS.find((r) => r.id === b.dataset.id));
  });
  ["pointerover", "focusin"].forEach((ev) =>
    $("rivalList").addEventListener(ev, (e) => {
      const b = e.target.closest(".rival");
      if (b) setAmbient(b.dataset.id);
    })
  );

  function showSelect() {
    S.reqId++;
    S.gameId++;
    S.animating = false;
    S.thinking = false;
    S.screen = "select";
    S.modal = null;
    $("modal").hidden = true;
    $("screenGame").hidden = true;
    $("screenSelect").hidden = false;
    $("btnRivals").hidden = true;
    $("bubble").hidden = true;
    const next = RIVALS.find((r) => !S.beaten.includes(r.id)) || RIVALS[RIVALS.length - 1];
    setAmbient(next.id);
    renderSelect();
    window.scrollTo(0, 0);
  }

  function startGame(rival) {
    S.reqId++;
    S.gameId++;
    S.animating = false;
    S.rival = rival;
    S.me = S.colorPref === "r" ? (Math.random() < 0.5 ? "w" : "b") : S.colorPref;
    S.pos = C.fromFen(C.START);
    S.hist = [];
    S.sans = [];
    S.lastMove = null;
    S.sel = null;
    S.targets = [];
    S.over = null;
    S.thinking = false;
    S.modal = null;
    S.screen = "game";
    disarmResign();
    $("modal").hidden = true;
    $("promo").hidden = true;
    $("screenSelect").hidden = true;
    $("screenGame").hidden = false;
    $("btnRivals").hidden = false;
    setAmbient(rival.id);
    $("oppAvatar").src = `img/${rival.id}.jpg`;
    $("oppAvatar").alt = pick(rival.name);
    renderRivalHeader();
    applyTheme();
    buildSquares();
    drawPieces();
    paint();
    renderBars();
    renderMoves();
    window.scrollTo(0, 0);
    setTimeout(() => say("greet"), 350);
    if (S.me === "b") {
      const id = S.gameId;
      setTimeout(() => { if (id === S.gameId && !S.thinking && !S.hist.length) askEngine(); }, 1100);
    }
  }

  function renderRivalHeader() {
    if (!S.rival) return;
    $("oppName").textContent = pick(S.rival.name);
    $("oppLevel").textContent = "★".repeat(S.rival.stars) + " " + t("lvl" + S.rival.stars);
  }

  /* ───────────── Inicio ───────────── */
  I18N.mount($("lang"));
  I18N.onChange(() => {
    renderSelect();
    renderRivalHeader();
    renderBars();
    if (S.resignArm) $("resignLbl").textContent = t("sure");
    if (S.modal) renderModal();
  });
  I18N.apply();
  renderSoundBtn();
  applyTheme();
  showSelect();

  // Para pruebas automáticas
  window.__ajedrez = { S, playMove, startGame, C };
})();
