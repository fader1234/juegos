/* Chess engine for the novels chess game (chess.html).
   Plain JavaScript, no dependencies. Loaded as a normal script it defines `Chess`;
   loaded as a Web Worker it answers {id, moves, level} with {id, move} (UCI). */
(function (G) {
"use strict";
const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6, BLACK = 8;
// 0x88 board: sq = rank * 16 + file, rank 0 is White's first rank.
const sqName = s => "abcdefgh"[s & 7] + ((s >> 4) + 1);
const nameSq = n => (n.charCodeAt(1) - 49) * 16 + (n.charCodeAt(0) - 97);

/* ---------- Zobrist keys (two 32-bit halves) ---------- */
let seed = 0x9e3779b9;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
const ZL = [], ZH = [];
for (let p = 0; p < 16; p++) { ZL.push(new Uint32Array(128)); ZH.push(new Uint32Array(128)); for (let s = 0; s < 128; s++) { ZL[p][s] = rnd(); ZH[p][s] = rnd(); } }
const ZSL = rnd(), ZSH = rnd();
const ZCL = new Uint32Array(16), ZCH = new Uint32Array(16), ZEL = new Uint32Array(128), ZEH = new Uint32Array(128);
for (let i = 0; i < 16; i++) { ZCL[i] = rnd(); ZCH[i] = rnd(); }
for (let i = 0; i < 128; i++) { ZEL[i] = rnd(); ZEH[i] = rnd(); }

const CASTLE_MASK = new Uint8Array(128).fill(15);
CASTLE_MASK[0x00] = 13; CASTLE_MASK[0x07] = 14; CASTLE_MASK[0x04] = 12;
CASTLE_MASK[0x70] = 7;  CASTLE_MASK[0x77] = 11; CASTLE_MASK[0x74] = 3;

const KN = [33, 31, 18, 14, -33, -31, -18, -14], KG = [1, -1, 16, -16, 15, 17, -15, -17];
const DIAG = [15, 17, -15, -17], ORTH = [1, -1, 16, -16];

/* ---------- Position ---------- */
function rehash(pos) {
  let lo = 0, hi = 0;
  for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = pos.b[s]; if (p) { lo ^= ZL[p][s]; hi ^= ZH[p][s]; } }
  if (pos.side) { lo ^= ZSL; hi ^= ZSH; }
  lo ^= ZCL[pos.castle]; hi ^= ZCH[pos.castle];
  if (pos.ep >= 0) { lo ^= ZEL[pos.ep]; hi ^= ZEH[pos.ep]; }
  pos.lo = lo >>> 0; pos.hi = hi >>> 0;
}
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
function fromFen(fen) {
  const [board, side, castle, ep, half, full] = fen.split(/\s+/);
  const pos = { b: new Int8Array(128), side: side === "b" ? BLACK : 0, castle: 0, ep: -1, half: +half || 0, full: +full || 1, kings: [0, 0], undo: [], hist: [] };
  let r = 7, f = 0;
  for (const ch of board) {
    if (ch === "/") { r--; f = 0; continue; }
    if (/\d/.test(ch)) { f += +ch; continue; }
    const t = "pnbrqk".indexOf(ch.toLowerCase()) + 1, c = ch === ch.toLowerCase() ? BLACK : 0;
    pos.b[r * 16 + f] = t | c; if (t === K) pos.kings[c ? 1 : 0] = r * 16 + f; f++;
  }
  if (castle && castle !== "-") { if (castle.includes("K")) pos.castle |= 1; if (castle.includes("Q")) pos.castle |= 2; if (castle.includes("k")) pos.castle |= 4; if (castle.includes("q")) pos.castle |= 8; }
  if (ep && ep !== "-") pos.ep = nameSq(ep);
  rehash(pos);
  return pos;
}
function toFen(pos) {
  let s = "";
  for (let r = 7; r >= 0; r--) {
    let e = 0;
    for (let f = 0; f < 8; f++) {
      const p = pos.b[r * 16 + f];
      if (!p) { e++; continue; }
      if (e) { s += e; e = 0; }
      const ch = " pnbrqk"[p & 7]; s += p & BLACK ? ch : ch.toUpperCase();
    }
    if (e) s += e; if (r) s += "/";
  }
  const c = (pos.castle & 1 ? "K" : "") + (pos.castle & 2 ? "Q" : "") + (pos.castle & 4 ? "k" : "") + (pos.castle & 8 ? "q" : "");
  return `${s} ${pos.side ? "b" : "w"} ${c || "-"} ${pos.ep >= 0 ? sqName(pos.ep) : "-"} ${pos.half} ${pos.full}`;
}

/* ---------- Moves: from | to<<7 | promo<<14 | flags<<17 ---------- */
const F_CAP = 1, F_EP = 2, F_CASTLE = 4, F_DOUBLE = 8;
const mv = (from, to, promo, flags) => from | (to << 7) | (promo << 14) | (flags << 17);
const mFrom = m => m & 127, mTo = m => (m >> 7) & 127, mPromo = m => (m >> 14) & 7, mFlags = m => m >> 17;

function attacked(pos, sq, by) {
  const b = pos.b;
  // pawns
  if (by === 0) { if (!((sq - 15) & 0x88) && b[sq - 15] === P) return true; if (!((sq - 17) & 0x88) && b[sq - 17] === P) return true; }
  else { if (!((sq + 15) & 0x88) && b[sq + 15] === (P | BLACK)) return true; if (!((sq + 17) & 0x88) && b[sq + 17] === (P | BLACK)) return true; }
  for (let i = 0; i < 8; i++) { const t = sq + KN[i]; if (!(t & 0x88) && b[t] === (N | by)) return true; }
  for (let i = 0; i < 8; i++) { const t = sq + KG[i]; if (!(t & 0x88) && b[t] === (K | by)) return true; }
  for (let i = 0; i < 4; i++) {
    const d = DIAG[i]; let t = sq + d;
    while (!(t & 0x88)) { const p = b[t]; if (p) { if (p === (B | by) || p === (Q | by)) return true; break; } t += d; }
  }
  for (let i = 0; i < 4; i++) {
    const d = ORTH[i]; let t = sq + d;
    while (!(t & 0x88)) { const p = b[t]; if (p) { if (p === (R | by) || p === (Q | by)) return true; break; } t += d; }
  }
  return false;
}
const inCheck = (pos, side = pos.side) => attacked(pos, pos.kings[side ? 1 : 0], side ^ BLACK);

function gen(pos, capsOnly) {
  const b = pos.b, us = pos.side, them = us ^ BLACK, out = [];
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) { s += 7; continue; }
    const p = b[s]; if (!p || (p & BLACK) !== us) continue;
    const t = p & 7;
    if (t === P) {
      const fwd = us ? -16 : 16, startR = us ? 6 : 1, lastR = us ? 0 : 7;
      const one = s + fwd;
      if (!(one & 0x88) && !b[one]) {
        if ((one >> 4) === lastR) { for (const pr of [Q, N, R, B]) out.push(mv(s, one, pr, 0)); }
        else if (!capsOnly) {
          out.push(mv(s, one, 0, 0));
          if ((s >> 4) === startR && !b[one + fwd]) out.push(mv(s, one + fwd, 0, F_DOUBLE));
        }
      }
      for (const d of [fwd - 1, fwd + 1]) {
        const c = s + d; if (c & 0x88) continue;
        if (b[c] && (b[c] & BLACK) === them) {
          if ((c >> 4) === lastR) { for (const pr of [Q, N, R, B]) out.push(mv(s, c, pr, F_CAP)); }
          else out.push(mv(s, c, 0, F_CAP));
        } else if (c === pos.ep) out.push(mv(s, c, 0, F_CAP | F_EP));
      }
      continue;
    }
    if (t === N || t === K) {
      const D = t === N ? KN : KG;
      for (let i = 0; i < 8; i++) {
        const c = s + D[i]; if (c & 0x88) continue;
        const q = b[c];
        if (!q) { if (!capsOnly) out.push(mv(s, c, 0, 0)); }
        else if ((q & BLACK) === them) out.push(mv(s, c, 0, F_CAP));
      }
      if (t === K && !capsOnly) {
        if (us === 0 && s === 0x04) {
          if ((pos.castle & 1) && !b[5] && !b[6] && b[7] === R && !attacked(pos, 4, BLACK) && !attacked(pos, 5, BLACK) && !attacked(pos, 6, BLACK)) out.push(mv(4, 6, 0, F_CASTLE));
          if ((pos.castle & 2) && !b[3] && !b[2] && !b[1] && b[0] === R && !attacked(pos, 4, BLACK) && !attacked(pos, 3, BLACK) && !attacked(pos, 2, BLACK)) out.push(mv(4, 2, 0, F_CASTLE));
        } else if (us === BLACK && s === 0x74) {
          if ((pos.castle & 4) && !b[0x75] && !b[0x76] && b[0x77] === (R | BLACK) && !attacked(pos, 0x74, 0) && !attacked(pos, 0x75, 0) && !attacked(pos, 0x76, 0)) out.push(mv(0x74, 0x76, 0, F_CASTLE));
          if ((pos.castle & 8) && !b[0x73] && !b[0x72] && !b[0x71] && b[0x70] === (R | BLACK) && !attacked(pos, 0x74, 0) && !attacked(pos, 0x73, 0) && !attacked(pos, 0x72, 0)) out.push(mv(0x74, 0x72, 0, F_CASTLE));
        }
      }
      continue;
    }
    const D = t === B ? DIAG : t === R ? ORTH : KG, nd = t === Q ? 8 : 4;
    for (let i = 0; i < nd; i++) {
      const d = D[i]; let c = s + d;
      while (!(c & 0x88)) {
        const q = b[c];
        if (!q) { if (!capsOnly) out.push(mv(s, c, 0, 0)); }
        else { if ((q & BLACK) === them) out.push(mv(s, c, 0, F_CAP)); break; }
        c += d;
      }
    }
  }
  return out;
}

function make(pos, m) {
  const b = pos.b, from = mFrom(m), to = mTo(m), pr = mPromo(m), fl = mFlags(m), p = b[from], us = pos.side;
  let capSq = to;
  if (fl & F_EP) capSq = us ? to + 16 : to - 16;
  const cap = b[capSq];
  pos.undo.push([m, cap, pos.castle, pos.ep, pos.half, pos.lo, pos.hi]);
  pos.hist.push(pos.lo);
  let lo = pos.lo ^ ZCL[pos.castle], hi = pos.hi ^ ZCH[pos.castle];
  if (pos.ep >= 0) { lo ^= ZEL[pos.ep]; hi ^= ZEH[pos.ep]; }
  if (cap) { lo ^= ZL[cap][capSq]; hi ^= ZH[cap][capSq]; b[capSq] = 0; }
  lo ^= ZL[p][from]; hi ^= ZH[p][from]; b[from] = 0;
  const np = pr ? pr | us : p;
  b[to] = np; lo ^= ZL[np][to]; hi ^= ZH[np][to];
  if (fl & F_CASTLE) {
    let rf, rt;
    if (to === 6) { rf = 7; rt = 5; } else if (to === 2) { rf = 0; rt = 3; } else if (to === 0x76) { rf = 0x77; rt = 0x75; } else { rf = 0x70; rt = 0x73; }
    const rk = b[rf]; b[rf] = 0; b[rt] = rk;
    lo ^= ZL[rk][rf] ^ ZL[rk][rt]; hi ^= ZH[rk][rf] ^ ZH[rk][rt];
  }
  if ((p & 7) === K) pos.kings[us ? 1 : 0] = to;
  pos.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
  pos.ep = (fl & F_DOUBLE) ? (from + to) >> 1 : -1;
  pos.half = ((p & 7) === P || cap) ? 0 : pos.half + 1;
  if (us) pos.full++;
  pos.side = us ^ BLACK;
  lo ^= ZCL[pos.castle] ^ ZSL; hi ^= ZCH[pos.castle] ^ ZSH;
  if (pos.ep >= 0) { lo ^= ZEL[pos.ep]; hi ^= ZEH[pos.ep]; }
  pos.lo = lo >>> 0; pos.hi = hi >>> 0;
}
function unmake(pos) {
  const [m, cap, castle, ep, half, lo, hi] = pos.undo.pop();
  pos.hist.pop();
  const b = pos.b, from = mFrom(m), to = mTo(m), pr = mPromo(m), fl = mFlags(m);
  pos.side ^= BLACK; const us = pos.side;
  const p = pr ? P | us : b[to];
  b[from] = p; b[to] = 0;
  if (fl & F_EP) b[us ? to + 16 : to - 16] = cap; else b[to] = cap;
  if (fl & F_CASTLE) {
    let rf, rt;
    if (to === 6) { rf = 7; rt = 5; } else if (to === 2) { rf = 0; rt = 3; } else if (to === 0x76) { rf = 0x77; rt = 0x75; } else { rf = 0x70; rt = 0x73; }
    b[rf] = b[rt]; b[rt] = 0;
  }
  if ((p & 7) === K) pos.kings[us ? 1 : 0] = from;
  if (us) pos.full--;
  pos.castle = castle; pos.ep = ep; pos.half = half; pos.lo = lo; pos.hi = hi;
}
function legal(pos) {
  const out = [], us = pos.side;
  for (const m of gen(pos, false)) { make(pos, m); if (!inCheck(pos, us)) out.push(m); unmake(pos); }
  return out;
}

/* ---------- Notation ---------- */
const uci = m => sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? " pnbrqk"[mPromo(m)] : "");
function fromUci(pos, s) {
  const from = nameSq(s.slice(0, 2)), to = nameSq(s.slice(2, 4)), pr = s[4] ? " pnbrqk".indexOf(s[4]) : 0;
  return legal(pos).find(m => mFrom(m) === from && mTo(m) === to && mPromo(m) === pr) || 0;
}
const FIG = ["", "", "♘", "♗", "♖", "♕", "♔"];
function san(pos, m, letters) {
  const L = letters || FIG;
  const from = mFrom(m), to = mTo(m), p = pos.b[from] & 7, fl = mFlags(m);
  let s;
  if (fl & F_CASTLE) s = (to & 7) === 6 ? "O-O" : "O-O-O";
  else {
    s = "";
    if (p === P) { if (fl & F_CAP) s = "abcdefgh"[from & 7]; }
    else {
      s = L[p];
      const others = legal(pos).filter(o => o !== m && mTo(o) === to && (pos.b[mFrom(o)] & 7) === p);
      if (others.length) {
        const sameF = others.some(o => (mFrom(o) & 7) === (from & 7)), sameR = others.some(o => (mFrom(o) >> 4) === (from >> 4));
        if (!sameF) s += "abcdefgh"[from & 7]; else if (!sameR) s += (from >> 4) + 1; else s += sqName(from);
      }
    }
    if (fl & F_CAP) s += "x";
    s += sqName(to);
    if (mPromo(m)) s += "=" + L[mPromo(m)];
  }
  make(pos, m);
  if (inCheck(pos)) s += legal(pos).length ? "+" : "#";
  unmake(pos);
  return s;
}

/* ---------- Game status ---------- */
function insufficient(pos) {
  const minors = [];
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) { s += 7; continue; }
    const t = pos.b[s] & 7; if (!t || t === K) continue;
    if (t === P || t === R || t === Q) return false;
    minors.push([t, ((s >> 4) + s) & 1]);
  }
  if (minors.length <= 1) return true;
  return minors.every(x => x[0] === B && x[1] === minors[0][1]);
}
const reps = pos => { let n = 0; for (let i = pos.hist.length - 2; i >= 0 && i >= pos.hist.length - pos.half - 1; i -= 2) if (pos.hist[i] === pos.lo) n++; return n; };
function status(pos) {
  if (!legal(pos).length) return inCheck(pos) ? "mate" : "stalemate";
  if (pos.half >= 100) return "fifty";
  if (reps(pos) >= 2) return "repetition";
  if (insufficient(pos)) return "material";
  return "";
}

/* ---------- Evaluation (piece values + piece-square tables) ---------- */
const VAL = [0, 100, 320, 330, 500, 900, 0];
const PST = {
  1: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  2: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  3: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  4: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  5: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  6: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  7: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50]
};
function evaluate(pos) {
  const b = pos.b; let mg = 0, nonPawn = 0, queens = 0, bw = 0, bb = 0;
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) { s += 7; continue; }
    const p = b[s]; if (!p) continue;
    const t = p & 7; if (t === Q) queens++; if (t !== P && t !== K) nonPawn += VAL[t];
    if (t === B) { if (p & BLACK) bb++; else bw++; }
  }
  const endgame = queens === 0 || nonPawn <= 2 * 900 + 2 * 330;
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) { s += 7; continue; }
    const p = b[s]; if (!p) continue;
    const t = p & 7, black = p & BLACK, r = s >> 4, f = s & 7;
    const idx = black ? r * 8 + f : (7 - r) * 8 + f;
    const tbl = t === K ? (endgame ? PST[7] : PST[6]) : PST[t];
    const v = VAL[t] + tbl[idx];
    mg += black ? -v : v;
  }
  if (bw >= 2) mg += 30; if (bb >= 2) mg -= 30;
  return pos.side ? -mg : mg;
}

/* ---------- Search ---------- */
const MATE = 100000;
const TT = new Map(); // lo -> [hi, depth, score, flag, move]
let nodes = 0, stopAt = 0, aborted = false, killers = [];
const ABORT = {};
function order(pos, moves, ttMove, ply) {
  const b = pos.b, k = killers[ply] || [];
  const sc = moves.map(m => {
    if (m === ttMove) return 1e7;
    let s = 0;
    if (mFlags(m) & F_CAP) s = 1e6 + 10 * VAL[(b[mTo(m)] & 7) || P] - VAL[b[mFrom(m)] & 7];
    else if (m === k[0]) s = 9e5; else if (m === k[1]) s = 8e5;
    if (mPromo(m)) s += 5e5 + VAL[mPromo(m)];
    return s;
  });
  const idx = moves.map((_, i) => i).sort((a, c) => sc[c] - sc[a]);
  return idx.map(i => moves[i]);
}
function quiesce(pos, alpha, beta, ply) {
  if ((++nodes & 2047) === 0 && stopAt && Date.now() > stopAt) throw ABORT;
  const stand = evaluate(pos);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  const us = pos.side;
  for (const m of order(pos, gen(pos, true), 0, 63)) {
    if (!mPromo(m) && stand + VAL[(pos.b[mTo(m)] & 7) || P] + 200 < alpha) continue; // delta pruning
    make(pos, m);
    if (inCheck(pos, us)) { unmake(pos); continue; }
    const s = -quiesce(pos, -beta, -alpha, ply + 1);
    unmake(pos);
    if (s >= beta) return beta;
    if (s > alpha) alpha = s;
  }
  return alpha;
}
function search(pos, depth, alpha, beta, ply) {
  if ((++nodes & 2047) === 0 && stopAt && Date.now() > stopAt) throw ABORT;
  if (ply && (pos.half >= 100 || reps(pos) >= 1)) return 0;
  const check = inCheck(pos);
  if (check) depth++;
  if (depth <= 0) return quiesce(pos, alpha, beta, ply);
  const e = TT.get(pos.lo); let ttMove = 0;
  if (e && e[0] === pos.hi) {
    ttMove = e[4];
    if (ply && e[1] >= depth) {
      if (e[3] === 0) return e[2];
      if (e[3] === 1 && e[2] >= beta) return e[2];
      if (e[3] === 2 && e[2] <= alpha) return e[2];
    }
  }
  const us = pos.side, a0 = alpha;
  let best = -MATE - 1, bestM = 0, n = 0;
  for (const m of order(pos, gen(pos, false), ttMove, ply)) {
    make(pos, m);
    if (inCheck(pos, us)) { unmake(pos); continue; }
    n++;
    let s;
    if (n === 1) s = -search(pos, depth - 1, -beta, -alpha, ply + 1);
    else {
      s = -search(pos, depth - 1, -alpha - 1, -alpha, ply + 1);
      if (s > alpha && s < beta) s = -search(pos, depth - 1, -beta, -alpha, ply + 1);
    }
    unmake(pos);
    if (s > best) { best = s; bestM = m; }
    if (s > alpha) alpha = s;
    if (alpha >= beta) {
      if (!(mFlags(m) & F_CAP)) { const k = killers[ply] || (killers[ply] = [0, 0]); if (k[0] !== m) { k[1] = k[0]; k[0] = m; } }
      break;
    }
  }
  if (!n) return check ? -MATE + ply : 0;
  if (TT.size > 800000) TT.clear();
  TT.set(pos.lo, [pos.hi, depth, best, best >= beta ? 1 : best <= a0 ? 2 : 0, bestM]);
  return best;
}

/* Levels: depth, root noise in centipawns, chance of a random move, time limit (ms) */
const LEVELS = {
  1: { depth: 1, noise: 260, blunder: 0.3 },
  2: { depth: 2, noise: 70, blunder: 0.05 },
  3: { depth: 3, noise: 40 },
  4: { depth: 5, noise: 12, time: 1500 },
  5: { depth: 30, noise: 0, time: 3500 }
};
function bestMove(pos, level) {
  const L = LEVELS[level] || LEVELS[3];
  const moves = legal(pos);
  if (!moves.length) return 0;
  if (moves.length === 1) return moves[0];
  if (L.blunder && Math.random() < L.blunder) return moves[Math.floor(Math.random() * moves.length)];
  nodes = 0; killers = []; stopAt = L.time ? Date.now() + L.time : 0;
  let scores = moves.map(() => 0), done = moves.slice();
  const us = pos.side;
  try {
    for (let d = 1; d <= L.depth; d++) {
      const sc = [];
      let alpha = -MATE - 1;
      const ordered = d === 1 ? moves : done.slice();
      for (const m of ordered) {
        make(pos, m);
        // noisy levels need a true score for every move; strong levels can use a null window
        let s = -search(pos, d - 1, -MATE - 1, L.noise ? MATE + 1 : -alpha, 1);
        unmake(pos);
        sc.push([m, s]);
        if (s > alpha) alpha = s;
      }
      sc.sort((a, c) => c[1] - a[1]);
      done = sc.map(x => x[0]); scores = sc.map(x => x[1]);
      if (scores[0] > MATE - 100) break;
      if (stopAt && Date.now() > stopAt - (L.time * 0.45)) break; // next depth would not finish
    }
  } catch (e) { if (e !== ABORT) throw e; }
  stopAt = 0;
  if (!L.noise) return done[0];
  let bestI = 0, bestV = -Infinity;
  done.forEach((m, i) => {
    let v = scores[i];
    if (Math.abs(v) < MATE - 100) v += (Math.random() * 2 - 1) * L.noise;
    if (v > bestV) { bestV = v; bestI = i; }
  });
  void us;
  return done[bestI];
}

/* ---------- Public API ---------- */
function fromMoves(list) {
  const pos = fromFen(START);
  for (const u of list || []) { const m = fromUci(pos, u); if (!m) break; make(pos, m); }
  return pos;
}
const Chess = { START, fromFen, toFen, fromMoves, legal, make, unmake, inCheck, status, san, uci, fromUci, bestMove, sqName, nameSq,
  from: mFrom, to: mTo, promo: mPromo, isCapture: m => !!(mFlags(m) & F_CAP), isCastle: m => !!(mFlags(m) & F_CASTLE), isEp: m => !!(mFlags(m) & F_EP),
  piece: (pos, sq) => pos.b[sq], P, N, B, R, Q, K, BLACK, evaluate };
G.Chess = Chess;

if (typeof window === "undefined" && typeof self !== "undefined" && typeof importScripts === "function") {
  self.onmessage = e => {
    const { id, moves, level } = e.data;
    const pos = fromMoves(moves);
    const m = bestMove(pos, level);
    self.postMessage({ id, move: m ? uci(m) : null });
  };
}
})(typeof self !== "undefined" ? self : this);
