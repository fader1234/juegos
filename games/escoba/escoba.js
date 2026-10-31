/*
 * Escoba de 15 — tú contra la computadora.
 * p = jugador (tú), c = computadora
 */
(function () {
  "use strict";

  const t = (k, v) => I18N.t(k, v);
  const $ = (id) => document.getElementById(id);
  const SUITS = ["d", "c", "s", "b"];
  const other = (w) => (w === "p" ? "c" : "p");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const sum = (a) => a.reduce((x, c) => x + c.v, 0);
  const PREFS = "escoba-prefs";

  /* ───────────── Estado ───────────── */
  const S = {
    score: { p: 0, c: 0 },
    target: 15,
    diff: "normal",
    dealer: "c",
    round: 0,
    deck: [],
    table: [],
    hand: { p: [], c: [] },
    cap: { p: [], c: [] },
    esc: { p: 0, c: 0 },
    last: null,
    turn: null,
    busy: true,
    playing: false,
    sel: { hand: null, table: new Set() },
    anim: null,
    info: null,
    flash: false,
    modals: [],
    seen: new Set(),
  };

  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || "{}");
    if (["easy", "normal", "hard"].includes(p.diff)) S.diff = p.diff;
    if ([15, 21, 30].includes(p.target)) S.target = p.target;
  } catch (e) {}

  function savePrefs() {
    try { localStorage.setItem(PREFS, JSON.stringify({ diff: S.diff, target: S.target })); } catch (e) {}
  }

  /* ───────────── Reglas ───────────── */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function newDeck() {
    const d = [];
    for (const s of SUITS) for (let v = 1; v <= 10; v++) d.push({ s, v, id: s + v });
    return shuffle(d);
  }

  // Todas las combinaciones de la mesa que suman 15 con una carta de valor v
  function combos(table, v) {
    const need = 15 - v, res = [], n = table.length;
    for (let m = 1; m < 1 << n; m++) {
      let s = 0;
      const idx = [];
      for (let i = 0; i < n && s <= need; i++) if (m & (1 << i)) { s += table[i].v; idx.push(i); }
      if (s === need) res.push(idx);
    }
    return res;
  }

  function legalMoves(who) {
    const moves = [];
    S.hand[who].forEach((card, hi) => {
      combos(S.table, card.v).forEach((ti) => moves.push({ hi, ti }));
      moves.push({ hi, ti: [] });
    });
    return moves;
  }

  function cardName(c) {
    const r = c.v === 1 || c.v >= 8 ? t("rank" + c.v) : String(c.v);
    return t("cardName", { rank: r, suit: t("suit_" + c.s) });
  }

  /* ───────────── Inteligencia de la computadora ───────────── */
  // Valor aproximado de cada carta (en décimas de punto): una escoba vale 10
  const ESCOBA = 10;
  const worth = (c) => 0.6 + (c.s === "d" ? 1.8 : 0) + (c.v === 7 ? 3.5 : 0) + (c.id === "d7" ? 10 : 0);
  const worthOfValue = (v) => 0.6 + 0.45 + (v === 7 ? 3.5 + 2.5 : 0);

  // Lo mejor que se puede levantar de una mesa jugando una carta de valor v
  function bestGain(table, v) {
    let best = 0;
    for (const ti of combos(table, v)) {
      let g = worthOfValue(v);
      for (const i of ti) g += worth(table[i]);
      if (ti.length === table.length) g += ESCOBA;
      if (g > best) best = g;
    }
    return best;
  }

  // Ganancia esperada del rival en su próximo turno con la mesa "rest"
  function oppExpectedGain(who, rest, k, counting) {
    if (!k) return 0;
    const u = counting ? unseenFor(who) : null;
    const gains = [];
    for (let v = 1; v <= 10; v++) {
      const g = bestGain(rest, v);
      if (g <= 0) continue;
      const p = counting ? probHas(u.cnt[v], u.total, k) : 0.3;
      gains.push([g, p]);
    }
    gains.sort((a, b) => b[0] - a[0]);
    let q = 1, exp = 0;
    for (const [g, p] of gains) { exp += q * p * g; q *= 1 - p; }
    return exp;
  }

  // Cartas que "who" no puede ver: mazo + mano del rival
  function unseenFor(who) {
    const known = new Set([...S.hand[who], ...S.table, ...S.cap.p, ...S.cap.c].map((c) => c.id));
    const cnt = Array(11).fill(0);
    let total = 0;
    for (const s of SUITS) for (let v = 1; v <= 10; v++) if (!known.has(s + v)) { cnt[v]++; total++; }
    return { cnt, total };
  }

  // Probabilidad de que el rival tenga al menos una carta de un valor
  function probHas(m, N, k) {
    if (m <= 0 || k <= 0 || N <= 0) return 0;
    let p = 1;
    for (let i = 0; i < k; i++) {
      p *= (N - m - i) / (N - i);
      if (p <= 0) return 1;
    }
    return 1 - p;
  }

  function evaluate(who, mv, counting) {
    const card = S.hand[who][mv.hi];
    const taken = mv.ti.map((i) => S.table[i]);
    const rest = S.table.filter((_, i) => !mv.ti.includes(i));
    const opp = other(who);
    const finalMove = !S.deck.length && S.hand[who].length === 1 && S.hand[opp].length === 0;
    let sc = 0;

    if (taken.length) {
      sc += worth(card) + taken.reduce((a, c) => a + worth(c), 0);
      if (!rest.length) sc += ESCOBA; // ¡escoba!
    } else {
      rest.push(card);
    }

    if (finalMove) {
      // Lo que queda en la mesa se lo lleva el último que levantó
      const owner = taken.length ? who : S.last || S.dealer;
      const w = rest.reduce((a, c) => a + worth(c), 0);
      return sc + (owner === who ? w : -w);
    }

    // Restamos lo que el rival podría llevarse en su turno
    const k = S.hand[opp].length || (S.deck.length ? 3 : 0);
    return sc - oppExpectedGain(who, rest, k, counting);
  }

  function bestMove(who, counting, noise) {
    let best = null, bestSc = -Infinity;
    for (const mv of legalMoves(who)) {
      const sc = evaluate(who, mv, counting) + (noise ? (Math.random() - 0.5) * noise : 0);
      if (sc > bestSc) { bestSc = sc; best = mv; }
    }
    return best;
  }

  function cpuChoose() {
    if (S.diff === "easy") {
      const moves = legalMoves("c");
      const caps = moves.filter((m) => m.ti.length);
      if (caps.length && Math.random() < 0.75) return caps[Math.floor(Math.random() * caps.length)];
      if (Math.random() < 0.5) return bestMove("c", false, 8);
      return moves[Math.floor(Math.random() * moves.length)];
    }
    if (S.diff === "normal") return bestMove("c", false, 2.5);
    return bestMove("c", true, 0);
  }

  /* ───────────── Desarrollo del juego ───────────── */
  function newMatch() {
    S.score = { p: 0, c: 0 };
    S.round = 0;
    S.dealer = Math.random() < 0.5 ? "p" : "c";
    S.playing = true;
    S.modals = [];
    savePrefs();
    newRound();
  }

  function dealHands() {
    S.hand.p = S.deck.splice(0, 3);
    S.hand.c = S.deck.splice(0, 3);
  }

  let gameId = 0; // invalida las animaciones pendientes si se empieza otra partida

  async function newRound() {
    const id = ++gameId;
    S.round++;
    S.deck = newDeck();
    S.cap = { p: [], c: [] };
    S.esc = { p: 0, c: 0 };
    S.last = null;
    S.sel = { hand: null, table: new Set() };
    S.anim = null;
    S.seen = new Set();
    S.hand = { p: [], c: [] };
    S.table = [];
    S.turn = other(S.dealer);
    S.busy = true;
    dealHands();
    S.table = S.deck.splice(0, 4);
    const dealer = S.dealer;
    S.info = () => t("roundStart", { n: S.round, who: t(dealer === "p" ? "you" : "cpu") });
    render();
    await wait(900);
    if (id !== gameId) return;

    const ts = sum(S.table);
    if (ts === 15 || ts === 30) {
      S.anim = { taken: S.table.map((c) => c.id) };
      render();
      await wait(900);
      if (id !== gameId) return;
      S.cap[dealer].push(...S.table);
      S.table = [];
      S.esc[dealer] += ts / 15;
      S.last = dealer;
      S.anim = null;
      S.info = () => t("dealerEscoba", { n: ts, who: t(dealer === "p" ? "forYou" : "forCpu") });
      render();
      await banner(dealer);
      if (id !== gameId) return;
    }
    startTurn(id);
  }

  async function startTurn(id) {
    if (id !== gameId) return;
    if (S.turn === "c") {
      S.busy = true;
      S.info = () => t("cpuThinking");
      render();
      await wait(700 + Math.random() * 600);
      if (id !== gameId) return;
      await doMove("c", cpuChoose(), id);
    } else {
      S.busy = false;
      render();
    }
  }

  async function doMove(who, mv, id) {
    S.busy = true;
    const card = S.hand[who][mv.hi];
    const taken = mv.ti.map((i) => S.table[i]);
    S.anim = { who, card, taken: taken.map((c) => c.id) };
    S.sel = { hand: null, table: new Set() };
    render();
    await wait(who === "c" ? 1150 : 650);
    if (id !== gameId) return;

    S.hand[who].splice(mv.hi, 1);
    let escoba = false;
    if (taken.length) {
      S.table = S.table.filter((c) => !taken.includes(c));
      S.cap[who].push(card, ...taken);
      S.last = who;
      const n = taken.length + 1;
      S.info = who === "c" ? () => t("cpuCaptured", { card: cardName(card), n }) : () => t("youCaptured", { n });
      if (!S.table.length) { S.esc[who]++; escoba = true; }
    } else {
      S.table.push(card);
      S.info = who === "c" ? () => t("cpuDiscarded", { card: cardName(card) }) : () => t("youDiscarded", { card: cardName(card) });
    }
    S.anim = null;
    render();
    if (escoba) await banner(who);
    if (id !== gameId) return;
    await afterMove(id);
  }

  async function afterMove(id) {
    S.turn = other(S.turn);
    if (!S.hand.p.length && !S.hand.c.length) {
      if (S.deck.length) {
        await wait(450);
        if (id !== gameId) return;
        dealHands();
        const prev = S.info;
        S.info = () => (prev ? prev() + " " : "") + t("dealing");
        render();
        await wait(700);
      } else {
        return endRound(id);
      }
    }
    startTurn(id);
  }

  async function endRound(id) {
    S.busy = true;
    if (S.table.length) {
      const w = S.last || S.dealer;
      S.anim = { taken: S.table.map((c) => c.id) };
      S.info = () => t("lastCards", { who: t(w === "p" ? "forYou" : "forCpu") });
      render();
      await wait(1500);
      if (id !== gameId) return;
      S.cap[w].push(...S.table);
      S.table = [];
      S.anim = null;
      render();
      await wait(400);
      if (id !== gameId) return;
    }
    const r = scoreRound();
    S.score.p += r.tot.p;
    S.score.c += r.tot.c;
    const over = (S.score.p >= S.target || S.score.c >= S.target) && S.score.p !== S.score.c;
    if (over) S.playing = false;
    S.modals = [{ type: "round", r, over }];
    render();
  }

  function scoreRound() {
    const rows = [];
    const cnt = (w, f) => S.cap[w].filter(f).length;
    const add = (key, p, c, pp, cp) => rows.push({ key, p, c, pp, cp });

    add("rowEscobas", S.esc.p, S.esc.c, S.esc.p, S.esc.c);

    const sb = S.cap.p.some((c) => c.id === "d7") ? "p" : "c";
    add("rowSettebello", sb === "p" ? "✓" : "–", sb === "c" ? "✓" : "–", sb === "p" ? 1 : 0, sb === "c" ? 1 : 0);

    const np = S.cap.p.length, nc = S.cap.c.length;
    add("rowCards", np, nc, np > nc ? 1 : 0, nc > np ? 1 : 0);

    const dp = cnt("p", (c) => c.s === "d"), dc = cnt("c", (c) => c.s === "d");
    add("rowDenari", dp, dc, dp === 10 ? 2 : dp > dc ? 1 : 0, dc === 10 ? 2 : dc > dp ? 1 : 0);

    const sp = cnt("p", (c) => c.v === 7), scv = cnt("c", (c) => c.v === 7);
    add("rowSevens", sp, scv, sp === 4 ? 2 : sp > scv ? 1 : 0, scv === 4 ? 2 : scv > sp ? 1 : 0);

    const tot = { p: rows.reduce((a, r) => a + r.pp, 0), c: rows.reduce((a, r) => a + r.cp, 0) };
    return { rows, tot };
  }

  async function banner(who) {
    const b = $("banner");
    b.innerHTML = `<div class="b-in"><span>🧹</span><strong>${t("escobaBanner")}</strong><small>${t(who === "p" ? "you" : "cpu")}</small></div>`;
    b.hidden = false;
    try { if (who === "p" && navigator.vibrate) navigator.vibrate([60, 40, 120]); } catch (e) {}
    await wait(1500);
    b.hidden = true;
  }

  /* ───────────── Dibujo ───────────── */
  function cardBtn(c, cls) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "card-x " + (cls || "");
    b.innerHTML = CardArt.svg(c);
    b.setAttribute("aria-label", cardName(c));
    b.title = cardName(c);
    return b;
  }

  function backEl() {
    const d = document.createElement("div");
    d.className = "card-x";
    d.innerHTML = CardArt.back();
    return d;
  }

  function pile(el, w) {
    const n = S.cap[w].length;
    el.innerHTML = `<div class="mini ${n ? "" : "empty"}">${CardArt.back()}<b>${n || ""}</b></div>
      <div class="esc">${S.esc[w] ? "🧹×" + S.esc[w] : ""}</div>`;
    el.title = `${t("rowCards")}: ${n} · ${t("rowEscobas")}: ${S.esc[w]}`;
  }

  function candidates() {
    const set = new Set();
    if (S.sel.hand === null) return set;
    const card = S.hand.p[S.sel.hand];
    if (!card) return set;
    combos(S.table, card.v).forEach((c) => c.forEach((i) => set.add(i)));
    return set;
  }

  function myTurn() {
    return S.playing && !S.busy && S.turn === "p" && !S.modals.length;
  }

  function render() {
    I18N.apply();
    const A = S.anim;

    // Marcador
    $("ptsP").textContent = S.score.p;
    $("ptsC").textContent = S.score.c;
    $("targetLbl").textContent = t("toPts", { n: S.target });
    $("deckLbl").textContent = t("deckLeft", { n: S.deck.length });
    $("sbP").classList.toggle("turn", S.playing && S.turn === "p");
    $("sbC").classList.toggle("turn", S.playing && S.turn === "c");

    pile($("pileP"), "p");
    pile($("pileC"), "c");

    // Mano del rival (boca abajo)
    const opp = $("oppHand");
    opp.innerHTML = "";
    const nOpp = S.hand.c.length - (A && A.who === "c" ? 1 : 0);
    for (let i = 0; i < nOpp; i++) opp.appendChild(backEl());

    // Mesa
    const tableEl = $("table");
    tableEl.innerHTML = "";
    const cand = candidates();
    const mine = myTurn();
    S.table.forEach((c, i) => {
      let cls = "";
      if (!S.seen.has(c.id)) cls += " enter";
      if (A && A.taken && A.taken.includes(c.id)) cls += " taken";
      if (S.sel.table.has(i)) cls += " sel";
      else if (cand.has(i)) cls += " cand";
      const b = cardBtn(c, cls);
      b.dataset.i = i;
      b.disabled = !mine;
      tableEl.appendChild(b);
    });
    if (A && A.card) {
      const b = cardBtn(A.card, "incoming");
      b.disabled = true;
      tableEl.appendChild(b);
    }
    S.seen = new Set(S.table.map((c) => c.id));
    if (A && A.card) S.seen.add(A.card.id);

    // Mi mano
    const hand = $("myHand");
    hand.innerHTML = "";
    S.hand.p.forEach((c, i) => {
      if (A && A.who === "p" && A.card === c) return;
      let cls = "";
      if (S.sel.hand === i) cls = "sel";
      else if (S.sel.hand !== null) cls = "dim";
      const b = cardBtn(c, cls);
      b.dataset.i = i;
      b.disabled = !mine;
      hand.appendChild(b);
    });

    // Mensajes
    $("info").textContent = S.info ? S.info() : "";
    let prompt = "";
    if (mine) prompt = S.flash ? t("pickFirst") : S.sel.hand === null ? t("pickHand") : t("pickTable");
    $("prompt").textContent = prompt;

    // Controles
    const sumEl = $("sum");
    let s = null;
    if (mine && S.sel.hand !== null) {
      s = S.hand.p[S.sel.hand].v + [...S.sel.table].reduce((a, i) => a + S.table[i].v, 0);
      sumEl.textContent = t("sum", { n: s });
    } else sumEl.textContent = "";
    sumEl.className = "sum" + (s === 15 ? " ok" : s > 15 ? " over" : "");
    $("btnHint").disabled = !mine;
    $("btnDiscard").disabled = !(mine && S.sel.hand !== null && S.sel.table.size === 0);
    $("btnCapture").disabled = !(mine && S.sel.hand !== null && S.sel.table.size > 0 && s === 15);

    renderModal();
  }

  /* ───────────── Ventanas ───────────── */
  function chip(label, attr, val, active) {
    return `<button class="chip ${active ? "activo" : ""}" data-${attr}="${val}">${label}</button>`;
  }

  let lastModalHtml = "";
  function renderModal() {
    const m = S.modals[S.modals.length - 1];
    const box = $("modalBox");
    $("modal").hidden = !m;
    if (!m) { box.innerHTML = ""; lastModalHtml = ""; return; }
    let h = "";

    if (m.type === "start") {
      const fan = ["c7", "d7", "s1"].map((id) => `<div class="card-x">${CardArt.svg({ s: id[0], v: +id.slice(1) })}</div>`).join("");
      h = `<div class="fan">${fan}</div>
        <h2>${t("title")}</h2>
        <p class="sub">${t("startSub")}</p>
        <div class="opt"><span>${t("difficulty")}</span><div class="chips">
          ${["easy", "normal", "hard"].map((d) => chip(t(d), "diff", d, S.diff === d)).join("")}
        </div></div>
        <div class="opt"><span>${t("target")}</span><div class="chips">
          ${[15, 21, 30].map((n) => chip(`${n} ${t("points")}`, "target", n, S.target === n)).join("")}
        </div></div>
        <div class="actions">
          <button class="btn primary" data-act="start">${t("start")}</button>
          <button class="btn ghost" data-act="rules">📖 ${t("rules")}</button>
          ${m.cancel ? `<button class="btn ghost" data-act="close">${t("cancel")}</button>` : ""}
        </div>`;
    } else if (m.type === "rules") {
      h = `<h2>📖 ${t("rules")}</h2><div class="rules">${t("rulesHtml")}</div>
        <div class="actions"><button class="btn primary" data-act="close">${t("close")}</button></div>`;
    } else if (m.type === "round") {
      const { r, over } = m;
      const cell = (v, pts) => `${v}${pts ? `<span class="pts">+${pts}</span>` : ""}`;
      let title = t("roundOver", { n: S.round });
      let icon = "";
      if (over) {
        const youWon = S.score.p > S.score.c;
        title = t(youWon ? "youWinMatch" : "cpuWinsMatch");
        icon = `<div class="winner">${youWon ? "🏆" : "🤖"}</div>`;
      }
      h = `${icon}<h2>${title}</h2>
        <table class="score-table">
          <thead><tr><th></th><th>${t("you")}</th><th>${t("cpu")}</th></tr></thead>
          <tbody>
            ${r.rows.map((x) => `<tr><td>${t(x.key)}</td><td>${cell(x.p, x.pp)}</td><td>${cell(x.c, x.cp)}</td></tr>`).join("")}
            <tr class="tot"><td>${t("rowRound")}</td><td>+${r.tot.p}</td><td>+${r.tot.c}</td></tr>
            <tr class="tot grand"><td>${t("rowTotal")}</td><td>${S.score.p}</td><td>${S.score.c}</td></tr>
          </tbody>
        </table>
        <p class="sub" style="margin-top:.6rem">${t("toPts", { n: S.target })}</p>
        <div class="actions"><button class="btn primary" data-act="${over ? "again" : "next"}">${t(over ? "playAgain" : "nextRound")}</button></div>`;
    }
    if (lastModalHtml !== h) {
      box.innerHTML = h;
      lastModalHtml = h;
      const btn = box.querySelector(".btn.primary");
      if (btn) btn.focus({ preventScroll: true });
    }
  }

  $("modalBox").addEventListener("click", (e) => {
    const el = e.target.closest("button");
    if (!el) return;
    if (el.dataset.diff) { S.diff = el.dataset.diff; savePrefs(); return render(); }
    if (el.dataset.target) { S.target = +el.dataset.target; savePrefs(); return render(); }
    const act = el.dataset.act;
    if (act === "start") { gameId++; newMatch(); }
    else if (act === "rules") { S.modals.push({ type: "rules" }); render(); }
    else if (act === "close") { S.modals.pop(); render(); }
    else if (act === "next") { S.modals = []; S.dealer = other(S.dealer); newRound(); }
    else if (act === "again") { S.modals = [{ type: "start" }]; render(); }
  });

  $("modal").addEventListener("click", (e) => {
    if (e.target.id !== "modal") return;
    const m = S.modals[S.modals.length - 1];
    if (m && (m.type === "rules" || (m.type === "start" && m.cancel))) { S.modals.pop(); render(); }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const m = S.modals[S.modals.length - 1];
    if (m && (m.type === "rules" || (m.type === "start" && m.cancel))) { S.modals.pop(); render(); }
  });

  /* ───────────── Acciones del jugador ───────────── */
  $("myHand").addEventListener("click", (e) => {
    const b = e.target.closest(".card-x");
    if (!b || !myTurn()) return;
    const i = +b.dataset.i;
    S.flash = false;
    if (S.sel.hand === i) {
      S.sel = { hand: null, table: new Set() };
    } else {
      S.sel = { hand: i, table: new Set() };
      // Si solo hay una forma de levantar, la marcamos ya
      const cs = combos(S.table, S.hand.p[i].v);
      if (cs.length === 1) S.sel.table = new Set(cs[0]);
    }
    render();
  });

  $("table").addEventListener("click", (e) => {
    const b = e.target.closest(".card-x");
    if (!b || !myTurn() || b.dataset.i === undefined) return;
    if (S.sel.hand === null) { S.flash = true; render(); return; }
    const i = +b.dataset.i;
    if (S.sel.table.has(i)) S.sel.table.delete(i);
    else S.sel.table.add(i);
    render();
  });

  $("btnCapture").addEventListener("click", () => {
    if (!myTurn() || S.sel.hand === null) return;
    const ti = [...S.sel.table];
    if (!ti.length || S.hand.p[S.sel.hand].v + ti.reduce((a, i) => a + S.table[i].v, 0) !== 15) return;
    doMove("p", { hi: S.sel.hand, ti }, gameId);
  });

  $("btnDiscard").addEventListener("click", () => {
    if (!myTurn() || S.sel.hand === null || S.sel.table.size) return;
    doMove("p", { hi: S.sel.hand, ti: [] }, gameId);
  });

  $("btnHint").addEventListener("click", () => {
    if (!myTurn()) return;
    const mv = bestMove("p", true, 0);
    S.flash = false;
    S.sel = { hand: mv.hi, table: new Set(mv.ti) };
    render();
  });

  $("btnRules").addEventListener("click", () => {
    if (S.modals.some((m) => m.type === "rules")) return;
    S.modals.push({ type: "rules" });
    render();
  });

  $("btnNew").addEventListener("click", () => {
    if (S.modals.some((m) => m.type === "start")) return;
    S.modals.push({ type: "start", cancel: S.playing });
    render();
  });

  /* ───────────── Inicio ───────────── */
  I18N.mount($("lang"));
  I18N.onChange(render);
  S.modals = [{ type: "start" }];
  render();

  // Para pruebas automáticas
  window.__escoba = { S, combos, legalMoves, evaluate, bestMove, scoreRound };
})();
