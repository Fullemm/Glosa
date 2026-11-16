/**
 * Rozpoznawanie odręcznie napisanego znaku (offline, bez modelu).
 * Narysowane kreski są porównywane z wzorcami kresek wszystkich znaków (window.RECOG_T),
 * a wynik to lista najbardziej podobnych znaków z poziomem pewności.
 * Oczekiwana odpowiedź nie bierze udziału w rozpoznawaniu.
 */
(function (global) {
  "use strict";

  const N = 12; // punktów na kreskę
  const GAP = 0.34; // kara za kreskę bez pary
  const SMALL_SIZE = 0.42; // znak mniejszy niż połowa pola to mała kana
  const SMALL = "ぁぃぅぇぉっゃゅょァィゥェォッャュョ";
  const BIG = "あいうえおつやゆよアイウエオツヤユヨ";
  // Znaki, których kształt jest praktycznie taki sam; przy ocenie nie liczą się jako błąd pisma.
  const LOOKALIKE = [
    "へヘ", "べベ", "ぺペ", "りリ", "かカ", "がガ", "きキ", "せセ", "もモ", "やヤ",
    "ロ口", "エ工", "カ力", "ニ二", "ハ八", "タ夕", "ー一", "ト卜", "オ才", "チ千",
  ];
  const LOOK = {};
  LOOKALIKE.forEach((g) => [...g].forEach((c) => (LOOK[c] = g)));
  const isLookalike = (a, b) => a === b || (LOOK[a] && LOOK[a] === LOOK[b]);
  const sizePair = (a, b) => a !== b && (smallOf[a] === b || smallOf[b] === a);
  const smallOf = {};
  [...SMALL].forEach((c, i) => (smallOf[BIG[i]] = c));

  let TPL = null;
  function templates() {
    if (TPL) return TPL;
    const src = global.RECOG_T || {};
    TPL = [];
    for (const ch in src) {
      const [size, data] = src[ch].split("|");
      const strokes = data.split(",").map((s) => {
        const pts = [];
        for (let i = 0; i < s.length; i += 4) {
          pts.push([+s.slice(i, i + 2) / 99 - 0.5, +s.slice(i + 2, i + 4) / 99 - 0.5]);
        }
        return pts.length === N ? pts : resample(pts, N);
      });
      TPL.push({ ch, size: +size / 100, strokes, small: SMALL.includes(ch), hasSmall: !!smallOf[ch] });
    }
    return TPL;
  }

  function resample(pts, n) {
    if (pts.length === 1) return Array.from({ length: n }, () => pts[0].slice());
    const seg = [];
    let tot = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      seg.push(d);
      tot += d;
    }
    if (tot < 1e-9) return Array.from({ length: n }, () => pts[0].slice());
    const out = [];
    const step = tot / (n - 1);
    let acc = 0;
    let j = 0;
    for (let i = 0; i < n; i++) {
      const t = i * step;
      while (j < seg.length - 1 && acc + seg[j] < t) acc += seg[j++];
      const r = seg[j] ? Math.min(1, (t - acc) / seg[j]) : 0;
      const a = pts[j];
      const b = pts[j + 1];
      out.push([a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]);
    }
    return out;
  }

  /** strokes: [[ [x,y], ... ], ...] w pikselach pola; padSize: bok pola w pikselach */
  function normalize(strokes, padSize) {
    const all = strokes.flat();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    all.forEach(([x, y]) => {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    });
    const w = Math.max(x1 - x0, y1 - y0, 1);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return {
      size: padSize ? w / padSize : 1,
      strokes: strokes.map((s) => resample(s.map(([x, y]) => [(x - cx) / w, (y - cy) / w]), N)),
    };
  }

  function dist(a, b) {
    let s = 0;
    for (let i = 0; i < N; i++) s += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]);
    return s / N;
  }
  function strokeCost(u, t) {
    let r = 0;
    for (let i = 0; i < N; i++) r += Math.hypot(u[i][0] - t[N - 1 - i][0], u[i][1] - t[N - 1 - i][1]);
    return Math.min(dist(u, t), r / N + 0.06);
  }

  function matchCost(U, Tm) {
    const n = U.length;
    const m = Tm.length;
    const C = [];
    for (let i = 0; i < n; i++) {
      C.push([]);
      for (let j = 0; j < m; j++) C[i].push(strokeCost(U[i], Tm[j]));
    }
    // kolejność kresek zachowana, z dopuszczeniem brakujących i nadmiarowych kresek
    const D = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) D[i][0] = i * GAP;
    for (let j = 1; j <= m; j++) D[0][j] = j * GAP;
    for (let i = 1; i <= n; i++)
      for (let j = 1; j <= m; j++)
        D[i][j] = Math.min(D[i - 1][j - 1] + C[i - 1][j - 1], D[i - 1][j] + GAP, D[i][j - 1] + GAP);
    let best = D[n][m] / Math.max(n, m);
    // kolejność dowolna (zła kolejność kresek nie zmienia, jaki znak napisano)
    if (n === m && n > 1) {
      const used = new Set();
      const pairs = [];
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) pairs.push([C[i][j], i, j]);
      pairs.sort((a, b) => a[0] - b[0]);
      const ui = new Set();
      let s = 0;
      for (const [c, i, j] of pairs) {
        if (ui.has(i) || used.has(j)) continue;
        ui.add(i);
        used.add(j);
        s += c;
      }
      best = Math.min(best, s / n + 0.05);
    }
    return best;
  }

  /**
   * Zwraca [{ch, score}] posortowane od najlepszego (do `top` pozycji) oraz `confidence` 0..1.
   * opts.allow: opcjonalny filtr (ch => bool), np. tylko kana albo bez chińskich znaków.
   */
  function recognize(strokes, padSize, opts) {
    opts = opts || {};
    const top = opts.top || 6;
    if (!strokes || !strokes.length) return { candidates: [], confidence: 0 };
    const U = normalize(strokes, padSize);
    const n = U.strokes.length;
    const res = [];
    for (const t of templates()) {
      if (opts.allow && !opts.allow(t.ch)) continue;
      const m = t.strokes.length;
      if (Math.abs(m - n) > (m > 8 ? 3 : 2)) continue;
      if (t.small) continue; // małe kany rozstrzyga rozmiar, niżej
      res.push({ ch: t.ch, score: matchCost(U.strokes, t.strokes) });
    }
    res.sort((a, b) => a.score - b.score);
    // mała kana (ゃ, っ, ァ…) ma ten sam kształt co duża: decyduje wielkość znaku w polu
    if (padSize && U.size < SMALL_SIZE) res.forEach((r) => { if (smallOf[r.ch]) r.ch = smallOf[r.ch]; });
    // pewność: jak bardzo najlepszy wynik odstaje od pierwszego innego (nie bliźniaczego) znaku
    let confidence = 0;
    if (res.length) {
      const b = res[0];
      const second = res.find((r) => !isLookalike(r.ch, b.ch));
      const gap = second ? second.score - b.score : 0.3;
      const abs = Math.max(0, 1 - b.score / 0.2);
      confidence = Math.max(0, Math.min(1, (gap / 0.06) * 0.6 + abs * 0.4));
    }
    return { candidates: res.slice(0, top), confidence };
  }

  /* ---------- Pole do pisania: zapis kresek i miniatury ---------- */
  class HandPad {
    constructor(el, opts) {
      this.el = el;
      this.opts = opts || {};
      this.strokes = [];
      this.cur = null;
      el.innerHTML = "";
      el.classList.add("hand-pad");
      const size = Math.round(Math.min(340, el.clientWidth || 300));
      this.size = size;
      this.dpr = Math.min(3, global.devicePixelRatio || 1);
      const c = document.createElement("canvas");
      c.width = size * this.dpr;
      c.height = size * this.dpr;
      c.style.width = size + "px";
      c.style.height = size + "px";
      el.appendChild(c);
      this.canvas = c;
      this.ctx = c.getContext("2d");
      this.ctx.scale(this.dpr, this.dpr);
      const at = (e) => {
        const r = c.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
      };
      c.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        c.setPointerCapture(e.pointerId);
        this.cur = [at(e)];
        this.draw();
      });
      c.addEventListener("pointermove", (e) => {
        if (!this.cur) return;
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        evs.forEach((ev) => this.cur.push(at(ev)));
        this.draw();
      });
      const end = () => {
        if (!this.cur) return;
        this.strokes.push(this.cur);
        this.cur = null;
        this.draw();
        if (this.opts.onChange) this.opts.onChange(this);
      };
      c.addEventListener("pointerup", end);
      c.addEventListener("pointercancel", end);
      this.draw();
    }
    ink() {
      return getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#2B2B2B";
    }
    drawStrokes(ctx, strokes, scale, width) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = this.ink();
      ctx.fillStyle = this.ink();
      ctx.lineWidth = width;
      strokes.forEach((s) => {
        if (s.length === 1) {
          ctx.beginPath();
          ctx.arc(s[0][0] * scale, s[0][1] * scale, width / 2, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        ctx.beginPath();
        ctx.moveTo(s[0][0] * scale, s[0][1] * scale);
        for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0] * scale, s[i][1] * scale);
        ctx.stroke();
      });
    }
    draw() {
      const g = this.ctx;
      g.clearRect(0, 0, this.size, this.size);
      this.drawStrokes(g, this.cur ? [...this.strokes, this.cur] : this.strokes, 1, Math.max(6, this.size / 30));
    }
    undo() {
      this.strokes.pop();
      this.draw();
      if (this.opts.onChange) this.opts.onChange(this);
    }
    clear() {
      this.strokes = [];
      this.draw();
      if (this.opts.onChange) this.opts.onChange(this);
    }
    isEmpty() {
      return !this.strokes.length;
    }
    /** miniatura PNG odręcznego znaku (zawsze cały znak, wyśrodkowany w kwadracie pola) */
    thumbnail(px) {
      px = px || 72;
      const c = document.createElement("canvas");
      c.width = px * 2;
      c.height = px * 2;
      const g = c.getContext("2d");
      const k = (px * 2) / this.size;
      this.drawStrokes(g, this.strokes, k, Math.max(5, (px * 2) / 18));
      return c.toDataURL("image/png");
    }
    snapshot() {
      return this.strokes.map((s) => s.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]));
    }
  }

  global.HandRecog = { recognize, normalize, HandPad, isLookalike, sizePair, templates };
})(typeof window !== "undefined" ? window : globalThis);
