/**
 * ARGON — NIHONGO: Silnik Kaligrafii Sumi (SumiPad) i progresywny system Ghost Kanji.
 * Obsługuje:
 * - Dynamiczną grubość kreski zależną od prędkości: w(v) = w_min + (w_max - w_min) / (1 + alpha * v)
 * - Pointer Events + getCoalescedEvents() + nacisk rysika (pressure)
 * - Wygładzanie trajektorii (krzywe kwadratowe Béziera), zwężanie początku/końca, fakturę tuszu Sumi
 * - Cofanie (Undo), Ponawianie (Redo), Czyszczenie, Odtwarzanie ruchu użytkownika (Replay)
 * - 4 poziomy Ghost Kanji: 1. Obrysowywanie, 2. Podpowiedzi, 3. Pamięć, 4. Test
 * - Wektorową weryfikację kolejności, kierunku i przebiegu kresek na bazie AnimCJK (window.STROKES)
 */
(function (global) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function resamplePolyline(pts, n) {
    if (!pts || !pts.length) return [];
    if (pts.length === 1) {
      return Array.from({ length: n }, () => ({ x: pts[0].x, y: pts[0].y }));
    }
    let total = 0;
    const segs = [];
    for (let i = 1; i < pts.length; i++) {
      const d = dist(pts[i - 1], pts[i]);
      segs.push(d);
      total += d;
    }
    if (total < 1e-3) {
      return Array.from({ length: n }, () => ({ x: pts[0].x, y: pts[0].y }));
    }
    const step = total / (n - 1);
    const out = [{ x: pts[0].x, y: pts[0].y }];
    let acc = 0;
    let j = 0;
    for (let i = 1; i < n - 1; i++) {
      const target = i * step;
      while (j < segs.length && acc + segs[j] < target) {
        acc += segs[j];
        j++;
      }
      if (j >= segs.length) {
        out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
      } else {
        const t = segs[j] > 0 ? (target - acc) / segs[j] : 0;
        const p0 = pts[j];
        const p1 = pts[j + 1];
        out.push({
          x: p0.x + (p1.x - p0.x) * t,
          y: p0.y + (p1.y - p0.y) * t,
        });
      }
    }
    out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
    return out;
  }

  /**
   * Przelicza punkty mediany AnimCJK (1024x1024) na współrzędne pikseli płótna o boku `size`.
   */
  function medianToPx(median, size) {
    const pad = Math.round(size * 0.06);
    const scale = (size - 2 * pad) / 1024;
    return median.map((q) => ({
      x: +(pad + q[0] * scale).toFixed(1),
      y: +(size - pad - (q[1] + 124) * scale).toFixed(1),
    }));
  }

  /**
   * Weryfikuje pojedynczą narysowaną kreskę względem wzorcowej mediany.
   */
  function evaluateSingleStroke(userPts, modelMedianPx, size, isKana) {
    if (!userPts || userPts.length < 2 || !modelMedianPx || modelMedianPx.length < 2) {
      return { ok: false, score: 0, reason: "Za krótki ruch." };
    }
    let userLen = 0;
    for (let i = 1; i < userPts.length; i++) userLen += dist(userPts[i - 1], userPts[i]);
    let modelLen = 0;
    for (let i = 1; i < modelMedianPx.length; i++) modelLen += dist(modelMedianPx[i - 1], modelMedianPx[i]);

    if (userLen < Math.max(12, modelLen * 0.25)) {
      return { ok: false, score: 15, reason: "Kreska jest zbyt krótka." };
    }

    const N = 24;
    const u = resamplePolyline(userPts, N);
    const m = resamplePolyline(modelMedianPx, N);

    let sumFwd = 0;
    let sumRev = 0;
    for (let i = 0; i < N; i++) {
      sumFwd += dist(u[i], m[i]);
      sumRev += dist(u[i], m[N - 1 - i]);
    }
    const avgFwd = sumFwd / N / size;
    const avgRev = sumRev / N / size;
    const startErr = dist(u[0], m[0]) / size;
    const endErr = dist(u[N - 1], m[N - 1]) / size;

    // Wektor kierunkowy
    const ux = u[N - 1].x - u[0].x;
    const uy = u[N - 1].y - u[0].y;
    const mx = m[N - 1].x - m[0].x;
    const my = m[N - 1].y - m[0].y;
    const uMag = Math.hypot(ux, uy) || 1;
    const mMag = Math.hypot(mx, my) || 1;
    const cosDir = (ux * mx + uy * my) / (uMag * mMag);

    const reversed = avgRev < avgFwd * 0.72 && cosDir < -0.15;
    if (reversed) {
      return {
        ok: false,
        score: 25,
        reversed: true,
        reason: "Zły kierunek kreski — poprowadź pędzel od punktu startowego.",
      };
    }

    const tol = isKana ? 0.24 : 0.21;
    const startTol = isKana ? 0.27 : 0.24;
    const lenRatio = userLen / Math.max(20, modelLen);
    const lenPenalty = lenRatio < 0.45 || lenRatio > 2.3 ? 0.12 : 0;

    const rawErr = avgFwd * 0.55 + startErr * 0.25 + endErr * 0.2 + lenPenalty;
    const score = Math.round(Math.max(0, Math.min(100, (1 - rawErr / (tol * 1.45)) * 100)));
    const ok = avgFwd <= tol && startErr <= startTol && cosDir >= -0.25 && score >= 48;

    let reason = "Dobrze.";
    if (!ok) {
      if (startErr > startTol) {
        reason = "Zacznij bliżej początku tej kreski.";
      } else if (cosDir < -0.1) {
        reason = "Kierunek kreski odbiega od wzorca.";
      } else {
        reason = "Kształt lub położenie kreski odbiega od wzorca.";
      }
    }
    return { ok, score, reason };
  }

  /**
   * Klasa SumiPad — zarządza płótnem 2D, warstwą SVG Ghost Kanji i weryfikacją wektorową.
   */
  class SumiPad {
    constructor(container, opts) {
      this.el = container;
      this.opts = Object.assign(
        {
          char: "あ",
          strokeData: null, // { strokes: [...], medians: [...] }
          isKana: false,
          level: 1, // 1: Obrysowywanie, 2: Podpowiedzi, 3: Pamięć, 4: Test
          tool: "sumi", // "sumi" | "pen" | "ghost"
          alpha: 0.65,
          maxWidth: 18,
          minWidth: 3.5,
          grid: "cross", // "cross" | "nine" | "diag" | "none"
          stepByStep: true, // w poziomach 1-3 sprawdzaj kreskę po kresce; w poziomie 4 można też całościowo
          onStrokeResult: null,
          onComplete: null,
          onStateChange: null,
        },
        opts || {}
      );

      this.strokes = []; // Zapisane pociągnięcia użytkownika
      this.redoStack = [];
      this.currentStroke = null;
      this.activeStrokeIdx = 0;
      this.mistakesOnCurrent = 0;
      this.totalMistakes = 0;
      this.strokeScores = [];
      this.completed = false;
      this.replaying = false;
      this.animTimer = 0;

      this.initDOM();
      this.bindEvents();
      this.renderGuide();
      this.redrawCanvas();
    }

    initDOM() {
      this.el.innerHTML = "";
      this.el.classList.add("sumi-pad");
      this.el.dataset.grid = this.opts.grid || "cross";

      const rect = this.el.getBoundingClientRect();
      this.size = Math.max(220, Math.min(340, Math.round(rect.width || 300)));
      this.dpr = Math.min(3, global.devicePixelRatio || 1);

      // Warstwa SVG pod spodem (wzór Ghost Kanji, podpowiedzi, animacja wzorca)
      this.svg = document.createElementNS(SVG_NS, "svg");
      this.svg.setAttribute("class", "sumi-guide");
      this.svg.setAttribute("viewBox", `0 0 ${this.size} ${this.size}`);
      this.el.appendChild(this.svg);

      // Płótno 2D tuszu Sumi
      this.canvas = document.createElement("canvas");
      this.canvas.className = "sumi-canvas";
      this.canvas.width = Math.round(this.size * this.dpr);
      this.canvas.height = Math.round(this.size * this.dpr);
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.el.appendChild(this.canvas);

      this.ctx = this.canvas.getContext("2d");
      this.ctx.scale(this.dpr, this.dpr);
    }

    getInkColor() {
      return (
        getComputedStyle(document.documentElement)
          .getPropertyValue("--ink")
          .trim() || "#2B2B2B"
      );
    }

    getAccentColor() {
      return (
        getComputedStyle(document.documentElement)
          .getPropertyValue("--seal")
          .trim() || "#C83E2B"
      );
    }

    getIndigoColor() {
      return (
        getComputedStyle(document.documentElement)
          .getPropertyValue("--indigo")
          .trim() || "#264653"
      );
    }

    /**
     * Oblicza szerokość pędzla zgodnie z w(v) = w_min + (w_max - w_min) / (1 + alpha * v)
     */
    computeWidth(velocity, pressure, pointerType, distFromStart) {
      const scale = this.size / 300;
      const wMin = (this.opts.minWidth || 3.5) * scale;
      const wMax = (this.opts.maxWidth || 18) * scale;
      if (this.opts.tool === "pen") {
        return (wMin + wMax) * 0.44;
      }
      const alpha = this.opts.alpha !== undefined ? this.opts.alpha : 0.65;
      let w = wMin + (wMax - wMin) / (1 + alpha * velocity);

      // Uwzględnij nacisk rysika, jeśli urządzenie go podaje
      if (pointerType === "pen" && pressure > 0 && pressure !== 0.5) {
        w *= 0.65 + 0.65 * pressure;
      }

      // Zwężenie na samym początku kreski (wejście pędzla / uchikomi)
      const taperInPx = 16 * scale;
      if (distFromStart < taperInPx) {
        const t = Math.max(0.38, distFromStart / taperInPx);
        w *= t;
      }

      return Math.max(wMin * 0.75, Math.min(wMax * 1.15, w));
    }

    bindEvents() {
      const c = this.canvas;
      const toLocal = (e) => {
        const r = c.getBoundingClientRect();
        const scaleX = this.size / (r.width || this.size);
        const scaleY = this.size / (r.height || this.size);
        return {
          x: (e.clientX - r.left) * scaleX,
          y: (e.clientY - r.top) * scaleY,
          t: e.timeStamp || performance.now(),
          p: e.pressure || 0.5,
          pointerType: e.pointerType || "mouse",
        };
      };

      c.addEventListener("pointerdown", (e) => {
        if (this.replaying || (this.completed && this.opts.level !== 4)) return;
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        try {
          c.setPointerCapture(e.pointerId);
        } catch (err) {}

        const pt = toLocal(e);
        const w0 = this.computeWidth(0.2, pt.p, pt.pointerType, 0);
        this.currentStroke = {
          tool: this.opts.tool,
          color: this.getInkColor(),
          points: [
            {
              x: pt.x,
              y: pt.y,
              t: pt.t,
              p: pt.p,
              v: 0.2,
              w: w0,
              len: 0,
            },
          ],
        };
        this.redoStack = [];
        this.drawStamp(pt.x, pt.y, w0, this.currentStroke.color, this.opts.tool);
      });

      c.addEventListener("pointermove", (e) => {
        if (!this.currentStroke) return;
        e.preventDefault();
        const events =
          typeof e.getCoalescedEvents === "function"
            ? e.getCoalescedEvents() || [e]
            : [e];

        for (const ev of events) {
          const pt = toLocal(ev);
          const pts = this.currentStroke.points;
          const prev = pts[pts.length - 1];
          const dx = pt.x - prev.x;
          const dy = pt.y - prev.y;
          const d = Math.hypot(dx, dy);
          if (d < 0.75) continue;

          const dt = Math.max(1.0, pt.t - prev.t);
          const rawV = d / dt; // px / ms
          // Wygładzanie prędkości wykładniczą średnią kroczącą (eliminacja nagłych skoków szerokości)
          const smoothV = prev.v * 0.65 + rawV * 0.35;
          const totalLen = prev.len + d;
          const targetW = this.computeWidth(
            smoothV,
            pt.p,
            pt.pointerType,
            totalLen
          );
          const smoothW = prev.w * 0.58 + targetW * 0.42;

          const nextPt = {
            x: pt.x,
            y: pt.y,
            t: pt.t,
            p: pt.p,
            v: smoothV,
            w: smoothW,
            len: totalLen,
          };
          pts.push(nextPt);
          this.renderLatestSegment(pts, this.currentStroke.color, this.currentStroke.tool);
        }
      });

      const finishPointer = (e) => {
        if (!this.currentStroke) return;
        const stroke = this.currentStroke;
        this.currentStroke = null;

        // Zwężenie końcówki pędzla (harai / oderwanie palca)
        if (stroke.tool !== "pen" && stroke.points.length >= 3) {
          this.drawExitTaper(stroke.points, stroke.color, stroke.tool);
        }

        if (stroke.points.length < 2) {
          this.redrawCanvas();
          return;
        }

        this.handleCompletedStroke(stroke);
      };

      c.addEventListener("pointerup", finishPointer);
      c.addEventListener("pointercancel", finishPointer);
    }

    drawStamp(x, y, width, color, tool) {
      const ctx = this.ctx;
      const r = Math.max(0.8, width / 2);
      ctx.save();
      ctx.fillStyle = color;
      if (tool !== "pen") {
        // Subtelna faktura krawędzi tuszu Sumi
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.94;
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawSegmentBetween(p0, p1, p2, color, tool) {
      // Interpolacja po krzywej kwadratowej Béziera pomiędzy środkami odcinków
      const m0 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, w: (p0.w + p1.w) / 2 };
      const m1 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, w: (p1.w + p2.w) / 2 };
      const approxLen = dist(m0, p1) + dist(p1, m1);
      const steps = Math.max(2, Math.ceil(approxLen / 1.25));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const inv = 1 - t;
        const x = inv * inv * m0.x + 2 * inv * t * p1.x + t * t * m1.x;
        const y = inv * inv * m0.y + 2 * inv * t * p1.y + t * t * m1.y;
        const w = m0.w + (m1.w - m0.w) * t;
        this.drawStamp(x, y, w, color, tool);
      }
    }

    renderLatestSegment(pts, color, tool) {
      const n = pts.length;
      if (n === 2) {
        const p0 = pts[0];
        const p1 = pts[1];
        const m = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const steps = Math.max(2, Math.ceil(dist(p0, m) / 1.25));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          this.drawStamp(
            p0.x + (m.x - p0.x) * t,
            p0.y + (m.y - p0.y) * t,
            p0.w + (p1.w - p0.w) * t * 0.5,
            color,
            tool
          );
        }
        return;
      }
      if (n >= 3) {
        this.drawSegmentBetween(pts[n - 3], pts[n - 2], pts[n - 1], color, tool);
      }
    }

    drawExitTaper(pts, color, tool) {
      const n = pts.length;
      if (n < 2) return;
      const last = pts[n - 1];
      const prev = pts[Math.max(0, n - 3)];
      const dx = last.x - prev.x;
      const dy = last.y - prev.y;
      const d = Math.hypot(dx, dy);
      if (d < 1) return;
      const tailLen = Math.min(14, Math.max(4, last.v * 9));
      const ux = dx / d;
      const uy = dy / d;
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const x = last.x + ux * tailLen * t;
        const y = last.y + uy * tailLen * t;
        const w = last.w * (1 - t * 0.88);
        this.drawStamp(x, y, w, color, tool);
      }
    }

    drawWholeStroke(stroke) {
      const pts = stroke.points;
      if (!pts || !pts.length) return;
      const color = stroke.color || this.getInkColor();
      const tool = stroke.tool || this.opts.tool;
      this.drawStamp(pts[0].x, pts[0].y, pts[0].w, color, tool);
      if (pts.length === 2) {
        const p0 = pts[0];
        const p1 = pts[1];
        const steps = Math.max(2, Math.ceil(dist(p0, p1) / 1.25));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          this.drawStamp(
            p0.x + (p1.x - p0.x) * t,
            p0.y + (p1.y - p0.y) * t,
            p0.w + (p1.w - p0.w) * t,
            color,
            tool
          );
        }
        return;
      }
      for (let i = 2; i < pts.length; i++) {
        this.drawSegmentBetween(pts[i - 2], pts[i - 1], pts[i], color, tool);
      }
      if (tool !== "pen" && pts.length >= 3) {
        this.drawExitTaper(pts, color, tool);
      }
    }

    redrawCanvas() {
      if (!this.ctx) return;
      this.ctx.clearRect(0, 0, this.size, this.size);
      for (const s of this.strokes) {
        this.drawWholeStroke(s);
      }
    }

    handleCompletedStroke(stroke) {
      const data = this.opts.strokeData;
      const medians = data && data.medians;

      // Jeśli tryb swobodny lub Poziom 4 (Test, ocena po narysowaniu albo po ostatniej kresce)
      if (!medians || !medians.length || !this.opts.stepByStep) {
        this.strokes.push(stroke);
        if (global.ArgonEngine) global.ArgonEngine.FX.strokeEnd();
        if (this.opts.onStateChange) this.opts.onStateChange(this.getState());
        return;
      }

      const idx = this.activeStrokeIdx;
      if (idx >= medians.length) return;

      const modelMedPx = medianToPx(medians[idx], this.size);
      const res = evaluateSingleStroke(
        stroke.points,
        modelMedPx,
        this.size,
        this.opts.isKana
      );

      if (res.ok) {
        this.strokes.push(stroke);
        this.strokeScores.push(res.score);
        this.activeStrokeIdx++;
        this.mistakesOnCurrent = 0;
        if (global.ArgonEngine) global.ArgonEngine.FX.strokeEnd();

        const remaining = medians.length - this.activeStrokeIdx;
        this.renderGuide();

        if (this.opts.onStrokeResult) {
          this.opts.onStrokeResult({
            ok: true,
            strokeIndex: idx,
            totalStrokes: medians.length,
            remaining,
            score: res.score,
            totalMistakes: this.totalMistakes,
            message: remaining
              ? `Kreska ${idx + 1}/${medians.length} poprawna (${res.score}%). Pozostało: ${remaining}.`
              : `Wszystkie kreski (${medians.length}) ukończone!`,
          });
        }

        if (remaining === 0) {
          this.completed = true;
          const avgScore = Math.round(
            this.strokeScores.reduce((a, b) => a + b, 0) /
              Math.max(1, this.strokeScores.length)
          );
          if (global.ArgonEngine) global.ArgonEngine.FX.complete();
          if (this.opts.onComplete) {
            this.opts.onComplete({
              ok: this.totalMistakes <= 1 && avgScore >= 55,
              avgScore,
              totalMistakes: this.totalMistakes,
              totalStrokes: medians.length,
            });
          }
        }
      } else {
        this.mistakesOnCurrent++;
        this.totalMistakes++;
        if (global.ArgonEngine) global.ArgonEngine.FX.bad();
        this.redrawCanvas();

        if (this.mistakesOnCurrent >= 2) {
          this.flashStrokeHint(idx);
        }

        if (this.opts.onStrokeResult) {
          this.opts.onStrokeResult({
            ok: false,
            strokeIndex: idx,
            totalStrokes: medians.length,
            remaining: medians.length - idx,
            score: res.score,
            reversed: !!res.reversed,
            totalMistakes: this.totalMistakes,
            message: `Kreska ${idx + 1}: ${res.reason} (Błędy: ${this.totalMistakes})`,
          });
        }
      }

      if (this.opts.onStateChange) this.opts.onStateChange(this.getState());
    }

    /**
     * Ocenia cały znak w Poziomie 4 (Test) lub przy ręcznym wywołaniu „Sprawdź”.
     */
    evaluateWholeCharacter() {
      const data = this.opts.strokeData;
      const medians = data && data.medians;
      if (!medians || !medians.length) {
        return {
          supported: false,
          message: "Brak danych wektorowych dla tego znaku — porównaj swój zapis ze wzorcem.",
        };
      }
      if (!this.strokes.length) {
        return {
          supported: true,
          ok: false,
          avgScore: 0,
          message: "Najpierw napisz znak na płótnie.",
        };
      }

      const nModel = medians.length;
      const nUser = this.strokes.length;
      const countDiff = Math.abs(nUser - nModel);
      const pairs = Math.min(nModel, nUser);
      let sum = 0;
      let badDir = 0;

      for (let i = 0; i < pairs; i++) {
        const mPx = medianToPx(medians[i], this.size);
        const r = evaluateSingleStroke(
          this.strokes[i].points,
          mPx,
          this.size,
          this.opts.isKana
        );
        sum += r.score;
        if (r.reversed) badDir++;
      }

      const countPenalty = countDiff * 18;
      const avgScore = Math.max(
        0,
        Math.round(sum / Math.max(1, nModel) - countPenalty)
      );
      const ok = countDiff === 0 && badDir === 0 && avgScore >= 55;

      this.completed = true;
      this.renderGuide(true); // Pokaż wzorzec do porównania

      let msg = `Wynik: ${avgScore}% (${nUser}/${nModel} kresek). `;
      if (countDiff !== 0) {
        msg += `Znak ma ${nModel} kresek, a narysowano ${nUser}. `;
      } else if (badDir > 0) {
        msg += `Wykryto odwrotny kierunek w ${badDir} kresce. `;
      } else if (ok) {
        msg += "Kolejność, kierunek i proporcje poprawne!";
      } else {
        msg += "Kształt wymaga jeszcze dopracowania — porównaj z cieniem wzorca.";
      }

      return {
        supported: true,
        ok,
        avgScore,
        totalStrokes: nModel,
        drawnStrokes: nUser,
        message: msg,
      };
    }

    /**
     * Renderuje warstwę Ghost Kanji w SVG zależnie od poziomu (1..4) i narzędzia.
     */
    renderGuide(forceShowModel) {
      if (!this.svg) return;
      this.svg.innerHTML = "";
      const data = this.opts.strokeData;
      const level = this.opts.level || 1;
      const showGhost =
        forceShowModel ||
        this.opts.tool === "ghost" ||
        level === 1 ||
        level === 2;

      if (!data || !data.strokes || !data.medians) {
        if (showGhost && this.opts.char) {
          const txt = document.createElementNS(SVG_NS, "text");
          txt.setAttribute("x", String(this.size / 2));
          txt.setAttribute("y", String(this.size * 0.68));
          txt.setAttribute("text-anchor", "middle");
          txt.setAttribute("font-size", String(Math.round(this.size * 0.65)));
          txt.setAttribute("font-family", "var(--jp)");
          txt.setAttribute("fill", "var(--line)");
          txt.setAttribute("opacity", level === 1 ? "0.45" : "0.2");
          txt.textContent = this.opts.char;
          this.svg.appendChild(txt);
        }
        return;
      }

      const pad = Math.round(this.size * 0.06);
      const scale = (this.size - 2 * pad) / 1024;

      // Poziom 1 (Obrysowywanie) lub Ghost Writing lub forceShowModel: pełny cień obrysu SVG
      if (level === 1 || this.opts.tool === "ghost" || forceShowModel) {
        const g = document.createElementNS(SVG_NS, "g");
        g.setAttribute(
          "transform",
          `translate(${pad}, ${pad}) scale(${scale}, ${-scale}) translate(0, -900)`
        );
        data.strokes.forEach((d, idx) => {
          const p = document.createElementNS(SVG_NS, "path");
          p.setAttribute("d", d);
          const isCurrent =
            this.opts.stepByStep &&
            !forceShowModel &&
            idx === this.activeStrokeIdx;
          p.setAttribute(
            "fill",
            isCurrent ? this.getAccentColor() : "currentColor"
          );
          p.setAttribute(
            "opacity",
            forceShowModel ? "0.28" : isCurrent ? "0.28" : "0.14"
          );
          g.appendChild(p);
        });
        this.svg.appendChild(g);
      }

      // Poziom 2 (Podpowiedzi): delikatne linie punktowe + punkt startowy i numer aktualnej kreski
      if (level === 2 && !forceShowModel) {
        data.medians.forEach((med, idx) => {
          const pts = medianToPx(med, this.size);
          if (pts.length < 2) return;
          const isCurrent = idx === this.activeStrokeIdx;
          if (idx < this.activeStrokeIdx) return;

          if (isCurrent || idx <= this.activeStrokeIdx + 1) {
            const pl = document.createElementNS(SVG_NS, "polyline");
            pl.setAttribute(
              "points",
              pts.map((p) => `${p.x},${p.y}`).join(" ")
            );
            pl.setAttribute("fill", "none");
            pl.setAttribute(
              "stroke",
              isCurrent ? this.getAccentColor() : "currentColor"
            );
            pl.setAttribute("stroke-width", isCurrent ? "2.5" : "1.5");
            pl.setAttribute("stroke-dasharray", "4,6");
            pl.setAttribute("opacity", isCurrent ? "0.55" : "0.18");
            this.svg.appendChild(pl);
          }

          if (isCurrent) {
            const c = document.createElementNS(SVG_NS, "circle");
            c.setAttribute("cx", String(pts[0].x));
            c.setAttribute("cy", String(pts[0].y));
            c.setAttribute("r", "8");
            c.setAttribute("fill", this.getAccentColor());
            c.setAttribute("opacity", "0.85");
            this.svg.appendChild(c);

            const t = document.createElementNS(SVG_NS, "text");
            t.setAttribute("x", String(pts[0].x));
            t.setAttribute("y", String(pts[0].y + 3.5));
            t.setAttribute("text-anchor", "middle");
            t.setAttribute("font-size", "10");
            t.setAttribute("font-weight", "700");
            t.setAttribute("fill", "#fff");
            t.textContent = String(idx + 1);
            this.svg.appendChild(t);
          }
        });
      }

      // W Poziomie 1 też pokaż dyskretną kropkę startową aktualnej kreski
      if (
        level === 1 &&
        this.opts.stepByStep &&
        !forceShowModel &&
        data.medians[this.activeStrokeIdx]
      ) {
        const pts = medianToPx(data.medians[this.activeStrokeIdx], this.size);
        if (pts.length) {
          const c = document.createElementNS(SVG_NS, "circle");
          c.setAttribute("cx", String(pts[0].x));
          c.setAttribute("cy", String(pts[0].y));
          c.setAttribute("r", "5.5");
          c.setAttribute("fill", this.getAccentColor());
          c.setAttribute("opacity", "0.85");
          this.svg.appendChild(c);
        }
      }
    }

    /**
     * Wyświetla krótką animowaną podpowiedź pojedynczej kreski.
     */
    flashStrokeHint(idx) {
      const data = this.opts.strokeData;
      if (!data || !data.medians || !data.medians[idx]) return;
      const pts = medianToPx(data.medians[idx], this.size);
      if (pts.length < 2) return;

      const g = document.createElementNS(SVG_NS, "g");
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", String(pts[0].x));
      c.setAttribute("cy", String(pts[0].y));
      c.setAttribute("r", "6.5");
      c.setAttribute("fill", this.getAccentColor());
      g.appendChild(c);

      const pl = document.createElementNS(SVG_NS, "polyline");
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
      pl.setAttribute("points", pts.map((p) => `${p.x},${p.y}`).join(" "));
      pl.setAttribute("fill", "none");
      pl.setAttribute("stroke", this.getAccentColor());
      pl.setAttribute("stroke-width", "5");
      pl.setAttribute("stroke-linecap", "round");
      pl.setAttribute("stroke-linejoin", "round");
      pl.style.strokeDasharray = String(len + 2);
      pl.style.strokeDashoffset = String(len + 2);
      g.appendChild(pl);
      this.svg.appendChild(g);

      pl.getBoundingClientRect();
      pl.style.transition = "stroke-dashoffset 420ms ease-out";
      pl.style.strokeDashoffset = "0";
      setTimeout(() => {
        g.style.transition = "opacity 320ms";
        g.style.opacity = "0";
        setTimeout(() => g.remove(), 340);
      }, 650);
    }

    /**
     * Animuje pełną wzorcową kolejność kresek znaku.
     */
    async animateModel() {
      const data = this.opts.strokeData;
      if (!data || !data.medians || !data.medians.length) return;
      const token = ++this.animTimer;
      this.renderGuide(true);

      const animGroup = document.createElementNS(SVG_NS, "g");
      this.svg.appendChild(animGroup);

      for (let i = 0; i < data.medians.length; i++) {
        if (this.animTimer !== token) return;
        const pts = medianToPx(data.medians[i], this.size);
        let len = 0;
        for (let j = 1; j < pts.length; j++) len += dist(pts[j - 1], pts[j]);
        const pl = document.createElementNS(SVG_NS, "polyline");
        pl.setAttribute("points", pts.map((p) => `${p.x},${p.y}`).join(" "));
        pl.setAttribute("fill", "none");
        pl.setAttribute("stroke", this.getAccentColor());
        pl.setAttribute("stroke-width", String(Math.max(5, Math.round(this.size / 22))));
        pl.setAttribute("stroke-linecap", "round");
        pl.setAttribute("stroke-linejoin", "round");
        pl.style.strokeDasharray = String(len + 2);
        pl.style.strokeDashoffset = String(len + 2);
        animGroup.appendChild(pl);

        const dur = Math.max(260, Math.min(620, Math.round(len * 3.4)));
        await new Promise((r) => {
          pl.getBoundingClientRect();
          pl.style.transition = `stroke-dashoffset ${dur}ms ease-in-out`;
          pl.style.strokeDashoffset = "0";
          setTimeout(r, dur + 140);
        });
      }

      setTimeout(() => {
        if (this.animTimer === token) this.renderGuide();
      }, 600);
    }

    /**
     * Odtwarza narysowane przez użytkownika pociągnięcia punkt po punkcie.
     */
    async replayUserStrokes() {
      if (!this.strokes.length || this.replaying) return;
      this.replaying = true;
      const token = ++this.animTimer;
      this.ctx.clearRect(0, 0, this.size, this.size);

      for (const s of this.strokes) {
        if (this.animTimer !== token) break;
        const pts = s.points;
        if (!pts.length) continue;
        const partial = [pts[0]];
        this.drawStamp(pts[0].x, pts[0].y, pts[0].w, s.color, s.tool);
        for (let i = 1; i < pts.length; i++) {
          if (this.animTimer !== token) break;
          partial.push(pts[i]);
          this.renderLatestSegment(partial, s.color, s.tool);
          if (i % 2 === 0) {
            await new Promise((r) => requestAnimationFrame(r));
          }
        }
        if (s.tool !== "pen" && pts.length >= 3) {
          this.drawExitTaper(pts, s.color, s.tool);
        }
        await new Promise((r) => setTimeout(r, 110));
      }

      this.replaying = false;
      this.redrawCanvas();
    }

    undo() {
      if (!this.strokes.length || this.replaying) return false;
      const popped = this.strokes.pop();
      this.redoStack.push(popped);
      if (this.opts.stepByStep && this.activeStrokeIdx > 0) {
        this.activeStrokeIdx--;
        this.strokeScores.pop();
        this.completed = false;
      }
      this.renderGuide();
      this.redrawCanvas();
      if (this.opts.onStateChange) this.opts.onStateChange(this.getState());
      return true;
    }

    redo() {
      if (!this.redoStack.length || this.replaying) return false;
      const restored = this.redoStack.pop();
      this.strokes.push(restored);
      if (this.opts.stepByStep) {
        this.activeStrokeIdx++;
      }
      this.renderGuide();
      this.redrawCanvas();
      if (this.opts.onStateChange) this.opts.onStateChange(this.getState());
      return true;
    }

    clear() {
      this.animTimer++;
      this.replaying = false;
      this.strokes = [];
      this.redoStack = [];
      this.activeStrokeIdx = 0;
      this.mistakesOnCurrent = 0;
      this.totalMistakes = 0;
      this.strokeScores = [];
      this.completed = false;
      this.renderGuide();
      this.redrawCanvas();
      if (this.opts.onStateChange) this.opts.onStateChange(this.getState());
    }

    updateOptions(patch) {
      Object.assign(this.opts, patch);
      if (patch.grid !== undefined) {
        this.el.dataset.grid = patch.grid;
      }
      this.renderGuide();
    }

    getState() {
      const total =
        (this.opts.strokeData &&
          this.opts.strokeData.medians &&
          this.opts.strokeData.medians.length) ||
        0;
      return {
        canUndo: this.strokes.length > 0,
        canRedo: this.redoStack.length > 0,
        drawnCount: this.strokes.length,
        activeStrokeIdx: this.activeStrokeIdx,
        totalStrokes: total,
        completed: this.completed,
        totalMistakes: this.totalMistakes,
      };
    }
  }

  global.SumiEngine = {
    SumiPad,
    medianToPx,
    evaluateSingleStroke,
  };
})(window);
