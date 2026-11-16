/**
 * ARGON — NIHONGO: Warstwa edukacyjna, FSRS, trwałość danych (IndexedDB + localStorage),
 * Romaji->Kana IME, Confusion Matrix, Graf Zależności, Pitch Accent, Audio & Haptyka.
 */
(function (global) {
  "use strict";

  const PREFIX = "nihongo:";
  const IDB_NAME = "nihongo_db";
  const IDB_VER = 2;
  const IDB_STORE = "kv";

  /* ==========================================================================
   * 1. TRWAŁOŚĆ DANYCH (localStorage + IndexedDB Mirror + Wersjonowanie)
   * ========================================================================== */
  let idbPromise = null;
  function openIDB() {
    if (idbPromise) return idbPromise;
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    idbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, IDB_VER);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
    return idbPromise;
  }

  function idbPut(key, rawJson) {
    openIDB().then((db) => {
      if (!db) return;
      try {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(rawJson, key);
      } catch (e) {}
    });
  }

  async function syncFromIDBIfEmpty() {
    const db = await openIDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, "readonly");
        const st = tx.objectStore(IDB_STORE);
        const req = st.getAllKeys();
        req.onsuccess = () => {
          const keys = req.result || [];
          if (!keys.length) {
            resolve(false);
            return;
          }
          let restored = 0;
          let pending = keys.length;
          keys.forEach((k) => {
            const g = st.get(k);
            g.onsuccess = () => {
              try {
                if (
                  typeof k === "string" &&
                  localStorage.getItem(PREFIX + k) === null &&
                  typeof g.result === "string"
                ) {
                  localStorage.setItem(PREFIX + k, g.result);
                  restored++;
                }
              } catch (e) {}
              if (--pending === 0) resolve(restored > 0);
            };
            g.onerror = () => {
              if (--pending === 0) resolve(restored > 0);
            };
          });
        };
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  function mirrorAllToIDB() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) {
          idbPut(k.slice(PREFIX.length), localStorage.getItem(k));
        }
      }
    } catch (e) {}
  }

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(PREFIX + k);
        return v ? JSON.parse(v) : d;
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        const raw = JSON.stringify(v);
        localStorage.setItem(PREFIX + k, raw);
        idbPut(k, raw);
      } catch (e) {}
    },
  };

  /* ==========================================================================
   * 2. PREFERENCJE UŻYTKOWNIKA, MIKRODŹWIĘKI (Web Audio) I HAPTYKA
   * ========================================================================== */
  const DEFAULT_PREFS = {
    theme: "auto", // "auto" | "light" | "dark"
    bgPattern: "seigaiha", // "seigaiha" | "asanoha" | "shippo" | "sakura" | "none"
    fontScale: 100, // 100 | 110 | 120
    sound: true,
    haptics: true,
    reducedMotion: false,
    brushTool: "sumi", // "sumi" | "pen" | "ghost"
    brushAlpha: 0.65, // czułość prędkości pędzla (0.25 .. 1.4)
    brushMax: 18, // maksymalna grubość (10 .. 28)
    brushMin: 3.5, // minimalna grubość (2 .. 8)
    gridMode: "cross", // "cross" | "nine" | "diag" | "none"
    romajiIME: true, // konwersja romaji -> kana na żywo
  };

  let prefs = Object.assign({}, DEFAULT_PREFS, store.get("prefs", {}));

  function savePrefs(patch) {
    if (patch) Object.assign(prefs, patch);
    store.set("prefs", prefs);
    applyPrefsToDOM();
    return prefs;
  }

  function applyPrefsToDOM() {
    const root = document.documentElement;
    if (prefs.theme === "light" || prefs.theme === "dark") {
      root.setAttribute("data-theme", prefs.theme);
    } else {
      root.removeAttribute("data-theme");
    }
    root.setAttribute("data-pattern", prefs.bgPattern || "seigaiha");
    root.style.fontSize = (prefs.fontScale || 100) + "%";
    document.body.classList.toggle("reduce-motion", !!prefs.reducedMotion);
  }

  let audioCtx = null;
  function getAudioCtx() {
    if (!prefs.sound) return null;
    const Ctx = global.AudioContext || global.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) {
      try {
        audioCtx = new Ctx();
      } catch (e) {
        return null;
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  const FX = {
    tap() {
      const ctx = getAudioCtx();
      if (!ctx) return;
      try {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, t);
        osc.frequency.exponentialRampToValueAtTime(280, t + 0.035);
        gain.gain.setValueAtTime(0.035, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.04);
      } catch (e) {}
    },
    ok() {
      if (prefs.haptics && navigator.vibrate) {
        try {
          navigator.vibrate(18);
        } catch (e) {}
      }
      const ctx = getAudioCtx();
      if (!ctx) return;
      try {
        const t = ctx.currentTime;
        [523.25, 659.25].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, t + i * 0.06);
          gain.gain.setValueAtTime(0.05, t + i * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.16);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t + i * 0.06);
          osc.stop(t + i * 0.06 + 0.17);
        });
      } catch (e) {}
    },
    bad() {
      if (prefs.haptics && navigator.vibrate) {
        try {
          navigator.vibrate([28, 45, 35]);
        } catch (e) {}
      }
      const ctx = getAudioCtx();
      if (!ctx) return;
      try {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(240, t);
        osc.frequency.linearRampToValueAtTime(185, t + 0.14);
        gain.gain.setValueAtTime(0.045, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.16);
      } catch (e) {}
    },
    strokeEnd() {
      if (prefs.haptics && navigator.vibrate) {
        try {
          navigator.vibrate(10);
        } catch (e) {}
      }
      const ctx = getAudioCtx();
      if (!ctx) return;
      try {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(340, t);
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.045);
        gain.gain.setValueAtTime(0.022, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.055);
      } catch (e) {}
    },
    complete() {
      if (prefs.haptics && navigator.vibrate) {
        try {
          navigator.vibrate([15, 35, 25]);
        } catch (e) {}
      }
      const ctx = getAudioCtx();
      if (!ctx) return;
      try {
        const t = ctx.currentTime;
        [440, 554.37, 659.25].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, t + i * 0.065);
          gain.gain.setValueAtTime(0.05, t + i * 0.065);
          gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.065 + 0.24);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t + i * 0.065);
          osc.stop(t + i * 0.065 + 0.25);
        });
      } catch (e) {}
    },
  };

  /* ==========================================================================
   * 3. SILNIK ZAPAMIĘTYWANIA — FSRS (Free Spaced Repetition Scheduler)
   * ========================================================================== */
  // Standardowe wagi FSRS-4.5 / FSRS-5 (niemodyfikowane arbitralnie)
  const FSRS_W = [
    0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
    0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655,
    0.6621,
  ];
  const FSRS_SKILLS = ["recog", "read", "meaning", "write", "audio"];
  const SKILL_LABELS = {
    recog: "Rozpoznawanie",
    read: "Odczytywanie",
    meaning: "Znaczenie",
    write: "Pisanie",
    audio: "Ze słuchu",
  };
  const DAY_MS = 86400000;

  let fsrsData = store.get("fsrs", {});
  let historyData = store.get("history", { days: {}, recent: [] });

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function fsrsRetrievability(elapsedDays, stability) {
    if (!stability || stability <= 0) return 0;
    if (elapsedDays <= 0) return 1;
    return Math.pow(1 + (19 / 81) * (elapsedDays / stability), -0.5);
  }

  function fsrsInitDifficulty(grade) {
    return clamp(FSRS_W[4] - Math.exp(FSRS_W[5] * (grade - 1)) + 1, 1, 10);
  }

  function fsrsNextDifficulty(d, grade) {
    const delta = -FSRS_W[6] * (grade - 3);
    const damped = d + (delta * (10 - d)) / 9;
    const d0Easy = fsrsInitDifficulty(4);
    return clamp(FSRS_W[7] * d0Easy + (1 - FSRS_W[7]) * damped, 1, 10);
  }

  function fsrsNextRecallStability(d, s, r, grade) {
    const hardPenalty = grade === 2 ? FSRS_W[15] : 1;
    const easyBonus = grade === 4 ? FSRS_W[16] : 1;
    return (
      s *
      (1 +
        Math.exp(FSRS_W[8]) *
          (11 - d) *
          Math.pow(s, -FSRS_W[9]) *
          (Math.exp((1 - r) * FSRS_W[10]) - 1) *
          hardPenalty *
          easyBonus)
    );
  }

  function fsrsNextForgetStability(d, s, r) {
    return Math.min(
      s,
      FSRS_W[11] *
        Math.pow(d, -FSRS_W[12]) *
        (Math.pow(s + 1, FSRS_W[13]) - 1) *
        Math.exp((1 - r) * FSRS_W[14])
    );
  }

  function fsrsNextShortTermStability(s, grade) {
    return s * Math.exp(FSRS_W[17] * (grade - 3 + FSRS_W[18]));
  }

  function computeNextCard(prev, grade, nowMs) {
    const now = nowMs || Date.now();
    const g = clamp(Math.round(grade), 1, 4);
    if (!prev || !prev.reps) {
      const s = FSRS_W[g - 1];
      const d = fsrsInitDifficulty(g);
      const ivlDays = g === 1 ? 10 / 1440 : g === 2 ? 0.5 : s;
      return {
        s: +s.toFixed(4),
        d: +d.toFixed(4),
        due: Math.round(now + ivlDays * DAY_MS),
        reps: 1,
        lapses: g === 1 ? 1 : 0,
        last: now,
        state: g === 1 ? "learning" : "review",
      };
    }
    const elapsed = Math.max(0, (now - (prev.last || now)) / DAY_MS);
    const r = fsrsRetrievability(elapsed, prev.s);
    const d = fsrsNextDifficulty(prev.d || 5, g);
    let s;
    let lapses = prev.lapses || 0;
    let state = "review";
    if (g === 1) {
      s = Math.max(0.15, fsrsNextForgetStability(d, prev.s, r));
      lapses++;
      state = "relearning";
    } else if (elapsed < 1) {
      s = Math.max(0.25, fsrsNextShortTermStability(prev.s, g));
    } else {
      s = Math.max(0.25, fsrsNextRecallStability(d, prev.s, r, g));
    }
    const ivlDays =
      g === 1
        ? 10 / 1440
        : g === 2
        ? Math.max(0.35, s * 0.8)
        : Math.max(0.5, s);
    return {
      s: +s.toFixed(4),
      d: +d.toFixed(4),
      due: Math.round(now + ivlDays * DAY_MS),
      reps: (prev.reps || 0) + 1,
      lapses,
      last: now,
      state,
    };
  }

  function migrateLegacyToFSRS(scores, wsc, due) {
    let changed = false;
    const S_MAP = [0, 0.4, 1.2, 3.5, 9.0, 21.0];
    const allKeys = new Set([
      ...Object.keys(scores || {}),
      ...Object.keys(wsc || {}),
      ...Object.keys(due || {}),
    ]);
    const now = Date.now();
    allKeys.forEach((k) => {
      if (!fsrsData[k]) fsrsData[k] = {};
      const rLv = (scores && scores[k]) || 0;
      const wLv = (wsc && wsc[k]) || 0;
      const dTs = due && due[k] !== undefined ? due[k] : now;
      if (rLv > 0 && !fsrsData[k].recog) {
        const s = S_MAP[clamp(rLv, 1, 5)];
        fsrsData[k].recog = {
          s,
          d: clamp(6.5 - rLv * 0.6, 2, 8),
          due: dTs || now,
          reps: rLv,
          lapses: 0,
          last: now - Math.min(s, 1) * DAY_MS,
          state: rLv >= 2 ? "review" : "learning",
        };
        fsrsData[k].meaning = Object.assign({}, fsrsData[k].recog);
        changed = true;
      }
      if (wLv > 0 && !fsrsData[k].write) {
        const s = S_MAP[clamp(wLv, 1, 5)];
        fsrsData[k].write = {
          s,
          d: clamp(6.8 - wLv * 0.6, 2, 8),
          due: dTs || now,
          reps: wLv,
          lapses: 0,
          last: now - Math.min(s, 1) * DAY_MS,
          state: wLv >= 2 ? "review" : "learning",
        };
        changed = true;
      }
    });
    if (changed) store.set("fsrs", fsrsData);
  }

  function recordDailyActivity(ok, isWrite) {
    const d = new Date();
    const key =
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");
    if (!historyData.days) historyData.days = {};
    if (!historyData.days[key]) {
      historyData.days[key] = { reviews: 0, ok: 0, written: 0 };
    }
    historyData.days[key].reviews++;
    if (ok) historyData.days[key].ok++;
    if (isWrite) historyData.days[key].written++;
    store.set("history", historyData);
  }

  function pushRecentItem(k) {
    if (!k) return;
    if (!Array.isArray(historyData.recent)) historyData.recent = [];
    historyData.recent = [
      k,
      ...historyData.recent.filter((x) => x !== k),
    ].slice(0, 14);
    store.set("history", historyData);
  }

  function recordFSRSReview(k, skill, grade, legacySyncFn) {
    const sk = FSRS_SKILLS.includes(skill) ? skill : "recog";
    if (!fsrsData[k]) fsrsData[k] = {};
    const prev = fsrsData[k][sk];
    const next = computeNextCard(prev, grade, Date.now());
    fsrsData[k][sk] = next;
    store.set("fsrs", fsrsData);
    recordDailyActivity(grade >= 2, sk === "write");
    pushRecentItem(k);
    if (typeof legacySyncFn === "function") {
      legacySyncFn(k, sk, grade, next);
    }
    return next;
  }

  function getSkillCard(k, skill) {
    return (fsrsData[k] && fsrsData[k][skill]) || null;
  }

  function getItemRetrievability(k) {
    const entry = fsrsData[k];
    if (!entry) return null;
    const now = Date.now();
    const cards = Object.values(entry).filter((c) => c && c.s > 0);
    if (!cards.length) return null;
    const sum = cards.reduce(
      (acc, c) => acc + fsrsRetrievability((now - (c.last || now)) / DAY_MS, c.s),
      0
    );
    return sum / cards.length;
  }

  function getItemStability(k) {
    const entry = fsrsData[k];
    if (!entry) return 0;
    const cards = Object.values(entry).filter((c) => c && c.s > 0);
    if (!cards.length) return 0;
    return cards.reduce((acc, c) => acc + c.s, 0) / cards.length;
  }

  function formatInterval(msDiff) {
    const mins = Math.max(1, Math.round(msDiff / 60000));
    if (mins < 60) return mins + " min";
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + " h";
    const days = Math.round(hrs / 24);
    return days + " d";
  }

  function previewFSRSIntervals(k, skill) {
    const sk = FSRS_SKILLS.includes(skill) ? skill : "recog";
    const prev = getSkillCard(k, sk);
    const now = Date.now();
    const out = {};
    [1, 2, 3, 4].forEach((g) => {
      const next = computeNextCard(prev, g, now);
      out[g] = formatInterval(next.due - now);
    });
    return out;
  }

  /* ==========================================================================
   * 4. KONWERSJA ROMAJI -> KANA NA ŻYWO (IME) I NORMALIZACJA
   * ========================================================================== */
  const ROMA_MAP = {
    a: "あ", i: "い", u: "う", e: "え", o: "お",
    ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ",
    sa: "さ", shi: "し", si: "し", su: "す", se: "せ", so: "そ",
    ta: "た", chi: "ち", ti: "ち", tsu: "つ", tu: "つ", te: "て", to: "と",
    na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
    ha: "は", hi: "ひ", fu: "ふ", hu: "ふ", he: "へ", ho: "ほ",
    ma: "ま", mi: "み", mu: "む", me: "め", mo: "も",
    ya: "や", yu: "ゆ", yo: "よ",
    ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ",
    wa: "わ", wo: "を",
    ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
    za: "ざ", ji: "じ", zi: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
    da: "だ", di: "ぢ", du: "づ", dzu: "づ", de: "で", do: "ど",
    ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",
    pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ",
    kya: "きゃ", kyu: "きゅ", kyo: "きょ",
    sha: "しゃ", shu: "しゅ", sho: "しょ",
    sya: "しゃ", syu: "しゅ", syo: "しょ",
    cha: "ちゃ", chu: "ちゅ", cho: "ちょ",
    tya: "ちゃ", tyu: "ちゅ", tyo: "ちょ",
    cya: "ちゃ", cyu: "ちゅ", cyo: "ちょ",
    nya: "にゃ", nyu: "にゅ", nyo: "にょ",
    hya: "ひゃ", hyu: "ひゅ", hyo: "ひょ",
    mya: "みゃ", myu: "みゅ", myo: "みょ",
    rya: "りゃ", ryu: "りゅ", ryo: "りょ",
    gya: "ぎゃ", gyu: "ぎゅ", gyo: "ぎょ",
    ja: "じゃ", ju: "じゅ", jo: "じょ",
    jya: "じゃ", jyu: "じゅ", jyo: "じょ",
    zya: "じゃ", zyu: "じゅ", zyo: "じょ",
    dya: "ぢゃ", dyu: "ぢゅ", dyo: "ぢょ",
    bya: "びゃ", byu: "びゅ", byo: "びょ",
    pya: "ぴゃ", pyu: "ぴゅ", pyo: "ぴょ",
    fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ",
    va: "ゔぁ", vi: "ゔぃ", vu: "ゔ", ve: "ゔぇ", vo: "ゔぉ",
    kye: "きぇ", gye: "ぎぇ", nye: "にぇ", hye: "ひぇ", mye: "みぇ", rye: "りぇ", bye: "びぇ", pye: "ぴぇ",
    she: "しぇ", je: "じぇ", che: "ちぇ", ye: "いぇ",
    tsa: "つぁ", tsi: "つぃ", tse: "つぇ", tso: "つぉ",
    thi: "てぃ", dhi: "でぃ", twu: "とぅ", dwu: "どぅ",
    wi: "うぃ", we: "うぇ", who: "うぉ", uxo: "うぉ",
    xa: "ぁ", xi: "ぃ", xu: "ぅ", xe: "ぇ", xo: "ぉ",
    la: "ぁ", li: "ぃ", lu: "ぅ", le: "ぇ", lo: "ぉ",
    xtu: "っ", xtsu: "っ", ltu: "っ", ltsu: "っ",
    xya: "ゃ", xyu: "ゅ", xyo: "ょ",
    lya: "ゃ", lyu: "ゅ", lyo: "ょ",
    nn: "ん", "n'": "ん",
  };

  function hiraToKata(str) {
    return (str || "").replace(/[ぁ-ゖ]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) + 0x60)
    );
  }

  function kataToHira(str) {
    return (str || "").replace(/[ァ-ヶ]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x60)
    );
  }

  /**
   * Konwertuje romaji na hiraganę lub katakanę.
   * Gdy live=true, pozostawia niedokończony prefiks spółgłoskowy na końcu (np. "k", "sh", "n").
   */
  function romajiToKana(raw, script, live) {
    if (!raw) return "";
    const isKata = script === "katakana" || script === "kata";
    let s = String(raw)
      .replace(/ā/gi, isKata ? "aー" : "aa")
      .replace(/ī/gi, isKata ? "iー" : "ii")
      .replace(/ū/gi, isKata ? "uー" : "uu")
      .replace(/ē/gi, isKata ? "eー" : "ei")
      .replace(/ō/gi, isKata ? "oー" : "ou");

    let out = "";
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      const low = ch.toLowerCase();

      if (ch === "-") {
        out += "ー";
        i++;
        continue;
      }

      if (!/[a-z']/i.test(ch)) {
        out += ch;
        i++;
        continue;
      }

      const rem = s.slice(i).toLowerCase();

      // "tch" -> っち
      if (rem.startsWith("tch") && rem.length >= 4 && "aiueo".includes(rem[3])) {
        const syl = ROMA_MAP["ch" + rem[3]];
        if (syl) {
          out += (isKata ? "ッ" : "っ") + (isKata ? hiraToKata(syl) : syl);
          i += 4;
          continue;
        }
      }

      // "n'" -> wymuszone ん przed samogłoską (np. tan'i -> たんい)
      if (rem.startsWith("n'")) {
        out += isKata ? "ン" : "ん";
        i += 2;
        continue;
      }

      // "nn" -> przed samogłoską lub 'y' (np. konnichi, onna) pierwsze 'n' to ん, a drugie tworzy sylabę (ni, na)
      if (rem.startsWith("nn")) {
        out += isKata ? "ン" : "ん";
        if (rem.length >= 3 && "aiueoy".includes(rem[2])) {
          i += 1;
        } else {
          i += 2;
        }
        continue;
      }

      // Podwójna spółgłoska (sokuon), np. kk, tt, pp, ss
      if (
        rem.length >= 2 &&
        rem[0] === rem[1] &&
        /[bcdfghjklmnpqrstvwxyz]/.test(rem[0]) &&
        rem[0] !== "n"
      ) {
        out += isKata ? "ッ" : "っ";
        i++;
        continue;
      }

      // Sprawdź dopasowania 4-, 3-, 2-, 1-znakowe
      let matched = false;
      for (const len of [4, 3, 2, 1]) {
        if (rem.length >= len) {
          const sub = rem.slice(0, len);
          if (ROMA_MAP[sub]) {
            const h = ROMA_MAP[sub];
            out += isKata ? hiraToKata(h) : h;
            i += len;
            matched = true;
            break;
          }
        }
      }
      if (matched) continue;

      // Obsługa pojedynczego 'n' przed spółgłoską (poza y i apostrofem) lub na końcu
      if (low === "n") {
        if (rem.length === 1) {
          if (live) {
            out += ch;
          } else {
            out += isKata ? "ン" : "ん";
          }
          i++;
          continue;
        }
        const next = rem[1];
        if (!"aiueoy'".includes(next) && /[a-z]/.test(next)) {
          out += isKata ? "ン" : "ん";
          i++;
          continue;
        }
      }

      // W trybie live zachowaj niedokończony prefiks na końcu
      out += ch;
      i++;
    }

    return out;
  }

  /* ==========================================================================
   * 5. CONFUSION MATRIX — SYSTEM MYLONYCH ZNAKÓW I ERROR NOTEBOOK
   * ========================================================================== */
  const CONFUSABLE_PAIRS = [
    // Katakana
    ["katakana:シ", "katakana:ツ", "W シ krótkie kreski leżą poziomo, a długa wznosi się z dołu do góry. W ツ krótkie stoją pionowo, a długa schodzi z góry na dół."],
    ["katakana:ソ", "katakana:ン", "W ソ krótka kreska stoi pionowo i długa schodzi w dół. W ン krótka leży poziomo, a długa idzie z dołu w górę."],
    ["katakana:ク", "katakana:ケ", "ク ma zamknięty skośny grzbiet, a w ケ pozioma kreska przebija lewy łuk i wystaje w prawo."],
    ["katakana:ク", "katakana:タ", "タ wygląda jak ク, ale ma dodatkową krótką kreseczkę w środku."],
    ["katakana:フ", "katakana:ワ", "フ to sam daszek z łukiem, a ワ ma dodatkową pionową kreskę po lewej stronie."],
    ["katakana:ワ", "katakana:ウ", "ウ ma na samej górze krótką pionową kreseczkę ponad daszkiem ワ."],
    ["katakana:ス", "katakana:ヌ", "W ヌ druga kreska przecina długi łuk na krzyż, a w ス tylko odchodzi od niego w dół."],
    ["katakana:チ", "katakana:テ", "W チ górna kreska opada w lewo, a pionowa przebija środkową. W テ są dwie poziome kreski i łuk zaczyna się pod drugą."],
    ["katakana:コ", "katakana:ユ", "W ユ dolna kreska wystaje szeroko w prawo poza pionową ściankę."],
    ["katakana:ノ", "katakana:メ", "メ to skośna kreska ノ przekreślona krótką kreską."],
    // Hiragana
    ["hiragana:ぬ", "hiragana:め", "Oba mają podobny lewy krzyż, ale ぬ kończy się małą pętelką, a め prostym otwartym łukiem."],
    ["hiragana:ね", "hiragana:れ", "Oba mają pionową kreskę i zygzak po lewej, ale ね kończy się pętelką, a れ wywija ogonek na zewnątrz."],
    ["hiragana:れ", "hiragana:わ", "W れ prawy łuk wywija się na zewnątrz w prawo, a w わ zawija łagodnie do środka."],
    ["hiragana:は", "hiragana:ほ", "ほ ma dwie poziome kreski po prawej stronie (górna stanowi „daszek”), a は tylko jedną."],
    ["hiragana:る", "hiragana:ろ", "る zawija na końcu małą pętelkę (jak w słowie „rulon”), a ろ kończy się prostym łukiem."],
    ["hiragana:あ", "hiragana:お", "あ ma oddzielną górną kreskę i długi łuk od góry, a お jest pisane jednym ciągiem z kropką po prawej."],
    ["hiragana:き", "hiragana:さ", "き ma dwie skośne kreski poziome, a さ tylko jedną."],
    ["hiragana:さ", "hiragana:ち", "Wyglądają jak lustrzane odbicia: さ otwiera brzuch w lewo, a ち w prawo (jak cyfra 5)."],
    ["hiragana:い", "hiragana:り", "W い lewa kreska jest dłuższa z haczykiem, a w り prawa kreska opada znacznie niżej."],
    ["hiragana:こ", "hiragana:に", "に ma po lewej stronie pionową kreskę przed dwoma poziomymi łukami こ."],
    ["hiragana:じ", "hiragana:ぢ", "Oba czyta się „ji”, ale じ (podstawowe) pochodzi od し, a ぢ (rzadkie) od ち."],
    ["hiragana:ず", "hiragana:づ", "Oba czyta się „zu”, ale ず (podstawowe) pochodzi od す, a づ (rzadkie) od つ."],
    // Kanji
    ["kanji:待", "kanji:持", "待 (czekać, ま.つ) ma po lewej 彳 (krok/droga — czekasz na drodze). 持 (trzymać, も.つ) ma po lewej 扌 (ręka — trzymasz w dłoni)."],
    ["kanji:人", "kanji:入", "W 人 (człowiek) lewa kreska zaczyna się wyżej, a prawa podpiera ją niżej. W 入 (wchodzić) prawa kreska góruje i nakrywa lewą."],
    ["kanji:人", "kanji:八", "W 人 obie kreski stykają się ze sobą, a w 八 (osiem) są rozdzielone przerwą u góry."],
    ["kanji:大", "kanji:太", "太 (gruby) to 大 (duży) z dodatkową kropką na dole pośrodku."],
    ["kanji:大", "kanji:犬", "犬 (pies) to 大 (duży) z kropką u góry po prawej stronie."],
    ["kanji:木", "kanji:本", "本 (książka, korzeń) to drzewo 木 z dodatkową poziomą kreską zaznaczającą korzeń u dołu."],
    ["kanji:土", "kanji:士", "W 土 (ziemia) dolna kreska jest dłuższa niż górna. W 士 (samuraj) górna kreska jest dłuższa niż dolna."],
    ["kanji:日", "kanji:目", "日 (słońce/dzień) ma jedną kreskę w środku (2 okienka), a 目 (oko) ma dwie kreski w środku (3 okienka)."],
    ["kanji:牛", "kanji:午", "W 牛 (krowa) pionowa kreska przebija górną poziomą („róg wystaje”), a w 午 (południe) nie przebija."],
    ["kanji:右", "kanji:石", "右 (prawo) ma na dole usta 口, a jego górna skośna kreska przebija poziomą. W 石 (kamień) skośna zaczyna się pod poziomą."],
    ["kanji:白", "kanji:百", "百 (sto) ma na samej górze dodatkową poziomą kreskę 一 ponad znakiem 白 (biały)."],
    ["kanji:見", "kanji:貝", "見 (widzieć) ma na dole wygięte „nogi” 儿, a 貝 (muszla) dwie krótkie nóżki 八."],
    ["kanji:休", "kanji:体", "休 (odpoczywać) ma po prawej samo drzewo 木, a 体 (ciało) ma po prawej 本 (z kreską u dołu)."],
  ];

  const PAIR_INDEX = {};
  const ITEM_PARTNERS = {};
  CONFUSABLE_PAIRS.forEach(([a, b, diff]) => {
    const id = a < b ? a + "|" + b : b + "|" + a;
    PAIR_INDEX[id] = { id, a, b, diff };
    (ITEM_PARTNERS[a] = ITEM_PARTNERS[a] || []).push({ other: b, diff, id });
    (ITEM_PARTNERS[b] = ITEM_PARTNERS[b] || []).push({ other: a, diff, id });
  });

  let errorData = store.get("errors", {
    pairs: {},
    items: {},
    log: [],
  });

  function makePairId(k1, k2) {
    return k1 < k2 ? k1 + "|" + k2 : k2 + "|" + k1;
  }

  function recordConfusionError(expectedItem, givenItemOrVal, skill, allItems) {
    if (!expectedItem || !expectedItem.k) return null;
    const k = expectedItem.k;
    const now = Date.now();
    if (!errorData.items) errorData.items = {};
    if (!errorData.pairs) errorData.pairs = {};
    if (!errorData.log) errorData.log = [];

    const ie = errorData.items[k] || { count: 0, last: 0, wrongVals: [] };
    ie.count++;
    ie.last = now;

    let otherItem = null;
    let rawVal = "";

    if (givenItemOrVal && typeof givenItemOrVal === "object" && givenItemOrVal.k) {
      otherItem = givenItemOrVal;
      rawVal = givenItemOrVal.q || givenItemOrVal.a || "";
    } else if (typeof givenItemOrVal === "string" && givenItemOrVal.trim()) {
      rawVal = givenItemOrVal.trim();
      const norm = rawVal.toLowerCase();
      const hira = kataToHira(norm);
      if (Array.isArray(allItems)) {
        otherItem =
          allItems.find(
            (y) =>
              y.k !== k &&
              y.kind === expectedItem.kind &&
              (y.q === rawVal ||
                (y.a && y.a.toLowerCase() === norm) ||
                (y.wr && y.wr === hira) ||
                (y.w && y.w === rawVal))
          ) || null;
      }
    }

    if (rawVal && !ie.wrongVals.includes(rawVal)) {
      ie.wrongVals = [rawVal, ...ie.wrongVals].slice(0, 5);
    }
    errorData.items[k] = ie;

    // Jeśli nie wykryto konkretnego innego znaku z odpowiedzi, ale znak należy do znanej pary mylonej i ma >=2 błędy
    if (!otherItem && ITEM_PARTNERS[k] && ie.count >= 2 && Array.isArray(allItems)) {
      const pInfo = ITEM_PARTNERS[k][0];
      otherItem = allItems.find((y) => y.k === pInfo.other) || null;
    }

    let pairEntry = null;
    if (otherItem && otherItem.k && otherItem.k !== k) {
      const pid = makePairId(k, otherItem.k);
      const known = PAIR_INDEX[pid];
      const existing = errorData.pairs[pid] || {
        id: pid,
        a: k < otherItem.k ? k : otherItem.k,
        b: k < otherItem.k ? otherItem.k : k,
        count: 0,
        last: 0,
        resolved: false,
        diff: known
          ? known.diff
          : `Zwróć uwagę na różnicę kształtu i czytania pomiędzy ${expectedItem.q} (${expectedItem.a}) a ${otherItem.q} (${otherItem.a}).`,
      };
      existing.count++;
      existing.last = now;
      existing.resolved = false;
      errorData.pairs[pid] = existing;
      pairEntry = existing;
    }

    errorData.log = [
      {
        t: now,
        k,
        otherKey: otherItem ? otherItem.k : null,
        wrongVal: rawVal,
        skill: skill || "recog",
      },
      ...errorData.log,
    ].slice(0, 60);

    store.set("errors", errorData);
    return pairEntry;
  }

  function markPairResolved(pairId) {
    if (errorData.pairs && errorData.pairs[pairId]) {
      errorData.pairs[pairId].resolved = true;
      store.set("errors", errorData);
    }
  }

  function getActiveConfusionPairs() {
    const recorded = Object.values(errorData.pairs || {}).sort(
      (x, y) => (y.resolved === x.resolved ? y.count - x.count : x.resolved ? 1 : -1)
    );
    return recorded;
  }

  function getBuiltInConfusionPairs() {
    return CONFUSABLE_PAIRS.map(([a, b, diff]) => {
      const id = makePairId(a, b);
      const rec = errorData.pairs && errorData.pairs[id];
      return {
        id,
        a,
        b,
        diff,
        count: rec ? rec.count : 0,
        resolved: rec ? !!rec.resolved : false,
      };
    });
  }

  /* ==========================================================================
   * 6. GRAF ZALEŻNOŚCI (Element graficzny -> Kanji -> Słowo -> Zdanie)
   * ========================================================================== */
  const RADICALS = [
    { id: "rad:人", glyph: "亻/人", name: "Człowiek", desc: "Osoba, działanie ludzkie (po lewej stronie jako 亻)", kanji: ["人", "休", "体", "何", "作", "住", "使", "働", "待"] },
    { id: "rad:水", glyph: "氵/水", name: "Woda", desc: "Płyny, rzeki, pogoda (po lewej jako trzy krople 氵)", kanji: ["水", "池", "泳", "海", "洗", "波", "注", "消", "深"] },
    { id: "rad:木", glyph: "木", name: "Drzewo", desc: "Drzewa, lasy, drewno, konstrukcje roślinne", kanji: ["木", "本", "林", "森", "休", "校", "村", "楽", "橋"] },
    { id: "rad:日", glyph: "日", name: "Słońce / Dzień", desc: "Czas, światło, pora dnia, pogoda", kanji: ["日", "早", "明", "時", "晴", "曜", "春", "昨", "暖"] },
    { id: "rad:口", glyph: "口", name: "Usta / Otwór", desc: "Mówienie, jedzenie, wejścia, kształt kwadratu", kanji: ["口", "右", "名", "同", "味", "吸", "呼", "問", "唱"] },
    { id: "rad:手", glyph: "扌/手", name: "Ręka / Dłoń", desc: "Czynności wykonywane ręką (po lewej jako 扌)", kanji: ["手", "持", "投", "拾", "指", "打", "押", "払", "描"] },
    { id: "rad:言", glyph: "言", name: "Słowo / Mowa", desc: "Język, rozmowa, nauka, czytanie", kanji: ["言", "話", "語", "読", "記", "計", "説", "試", "謝"] },
    { id: "rad:女", glyph: "女", name: "Kobieta", desc: "Rodzina, relacje, piękno", kanji: ["女", "好", "妹", "姉", "始", "安", "妻", "娘", "婚"] },
    { id: "rad:子", glyph: "子", name: "Dziecko", desc: "Dzieci, nauka, wzrost", kanji: ["子", "字", "学", "好", "季", "孫", "育"] },
    { id: "rad:心", glyph: "忄/心", name: "Serce / Umysł", desc: "Uczucia, myśli, stany ducha", kanji: ["心", "思", "急", "悪", "意", "感", "悲", "情", "忘"] },
    { id: "rad:火", glyph: "火/灬", name: "Ogień", desc: "Ciepło, światło, gotowanie (u dołu jako 4 kropki 灬)", kanji: ["火", "灯", "点", "焼", "熱", "照", "然", "煙"] },
    { id: "rad:土", glyph: "土", name: "Ziemia", desc: "Miejsce, budowle, teren", kanji: ["土", "地", "場", "坂", "城", "堂", "塩", "境"] },
    { id: "rad:糸", glyph: "糸", name: "Nić / Splot", desc: "Tkaniny, linie, powiązania, kolory", kanji: ["糸", "紙", "絵", "細", "組", "終", "線", "緑", "続"] },
    { id: "rad:門", glyph: "門", name: "Brama", desc: "Drzwi, przestrzeń pomiędzy, słuchanie", kanji: ["門", "間", "開", "閉", "聞", "関"] },
    { id: "rad:車", glyph: "車", name: "Wóz / Pojazd", desc: "Transport, obrót, lekkość", kanji: ["車", "転", "軽", "輪", "輸"] },
    { id: "rad:雨", glyph: "雨", name: "Deszcz / Chmura", desc: "Zjawiska atmosferyczne i elektryczność", kanji: ["雨", "雲", "雪", "電", "霜", "霧"] },
  ];

  const KANJI_TO_RAD = {};
  RADICALS.forEach((r) => {
    r.kanji.forEach((ch) => {
      if (!KANJI_TO_RAD[ch]) KANJI_TO_RAD[ch] = [];
      KANJI_TO_RAD[ch].push(r);
    });
  });

  /* ==========================================================================
   * 7. ZWERYFIKOWANE DANE PITCH ACCENT (Standard tokijski — NHK / Shin Meikai)
   * ========================================================================== */
  // Format: słowo_lub_klucz: { reading: "はし", moras: ["は","し"], drop: 1, particle: "が", note: "..." }
  // drop: 0 = Heiban (平板), 1 = Atamadaka (頭高), 2..N-1 = Nakadaka (中高), N = Odaka (尾高)
  const PITCH_DATA = {
    "箸": { moras: ["は", "し"], drop: 1, particle: "で", pair: "橋 (はし [2] — most) · 端 (はし [0] — brzeg)", note: "Atamadaka [1]: wysoki początek, spadek na drugiej morze." },
    "橋": { moras: ["は", "し"], drop: 2, particle: "を", pair: "箸 (はし [1] — pałeczki) · 端 (はし [0] — brzeg)", note: "Odaka [2]: rośnie na „し”, spada dopiero na partykule." },
    "端": { moras: ["は", "し"], drop: 0, particle: "に", pair: "箸 (はし [1] — pałeczki) · 橋 (はし [2] — most)", note: "Heiban [0]: rośnie na drugiej morze i pozostaje wysoki na partykule." },
    "雨": { moras: ["あ", "め"], drop: 1, particle: "が", pair: "飴 (あめ [0] — cukierek)", note: "Atamadaka [1]: „a” wysokie, „me” niskie." },
    "飴": { moras: ["あ", "め"], drop: 0, particle: "を", pair: "雨 (あめ [1] — deszcz)", note: "Heiban [0]: „a” niskie, „me” i partykuła wysokie." },
    "神": { moras: ["か", "み"], drop: 1, particle: "が", pair: "紙 (かみ [2] — papier) · 髪 (かみ [2] — włosy)", note: "Atamadaka [1]: spadek po pierwszej morze." },
    "紙": { moras: ["か", "み"], drop: 2, particle: "を", pair: "神 (かみ [1] — bóstwo)", note: "Odaka [2]: spadek dopiero na partykule po słowie." },
    "花": { moras: ["は", "な"], drop: 2, particle: "が", pair: "鼻 (はな [0] — nos)", note: "Odaka [2]: na samym słowie jak鼻, ale na partykule が ton opada." },
    "山": { moras: ["や", "ま"], drop: 2, particle: "が", note: "Odaka [2]: spadek na partykule po „ma”." },
    "川": { moras: ["か", "わ"], drop: 2, particle: "が", note: "Odaka [2]: spadek na partykule po „wa”." },
    "水": { moras: ["み", "ず"], drop: 0, particle: "を", note: "Heiban [0]: płaski wzorzec bez spadku." },
    "火": { moras: ["ひ"], drop: 1, particle: "が", note: "Atamadaka [1]: wysoka sylaba, niska partykuła." },
    "木": { moras: ["き"], drop: 1, particle: "が", note: "Atamadaka [1]: wysoka sylaba, niska partykuła." },
    "人": { moras: ["ひ", "と"], drop: 0, particle: "が", note: "Heiban [0]: płaski akcent." },
    "日本": { moras: ["に", "ほ", "ん"], drop: 2, particle: "へ", note: "Nakadaka [2]: szczyt na „ho”, spadek na „n”." },
    "先生": { moras: ["せ", "ん", "せ", "い"], drop: 3, particle: "は", note: "Nakadaka [3]: spadek przed końcowym „i”." },
    "学生": { moras: ["が", "く", "せ", "い"], drop: 0, particle: "は", note: "Heiban [0]: równy wysoki ton od drugiej mory." },
    "学校": { moras: ["が", "っ", "こ", "う"], drop: 0, particle: "へ", note: "Heiban [0]: płaski wzorzec." },
    "犬": { moras: ["い", "ぬ"], drop: 2, particle: "が", note: "Odaka [2]: spadek na partykule po „nu”." },
    "車": { moras: ["く", "る", "ま"], drop: 0, particle: "で", note: "Heiban [0]: płaski wzorzec." },
    "電車": { moras: ["で", "ん", "しゃ"], drop: 0, particle: "で", note: "Heiban [0] (spotykane też [1])." },
    "本": { moras: ["ほ", "ん"], drop: 1, particle: "を", note: "Atamadaka [1]: wysoka pierwsza mora." },
    "天気": { moras: ["て", "ん", "き"], drop: 1, particle: "が", note: "Atamadaka [1]: spadek po pierwszej morze." },
    "元気": { moras: ["げ", "ん", "き"], drop: 1, particle: "だ", note: "Atamadaka [1]: spadek po „ge”." },
    "名前": { moras: ["な", "ま", "え"], drop: 0, particle: "は", note: "Heiban [0]: płaski wzorzec." },
    "音楽": { moras: ["お", "ん", "が", "く"], drop: 1, particle: "を", note: "Atamadaka [1]: wysoka pierwsza mora." },
    "手紙": { moras: ["て", "が", "み"], drop: 0, particle: "を", note: "Heiban [0]: płaski wzorzec." },
    "言葉": { moras: ["こ", "と", "ば"], drop: 3, particle: "を", note: "Odaka [3]: spadek na partykule po „ba”." },
    "大きい": { moras: ["お", "お", "き", "い"], drop: 3, particle: "", note: "Nakadaka [3]: spadek po „ki”." },
    "小さい": { moras: ["ち", "い", "さ", "い"], drop: 3, particle: "", note: "Nakadaka [3]: spadek po „sa”." },
    "赤い": { moras: ["あ", "か", "い"], drop: 0, particle: "", note: "Heiban [0]: płaski przymiotnik." },
    "青い": { moras: ["あ", "お", "い"], drop: 2, particle: "", note: "Nakadaka [2]: spadek po „o”." },
    "白い": { moras: ["し", "ろ", "い"], drop: 2, particle: "", note: "Nakadaka [2]: spadek po „ro”." },
    "ありがとうございます": { moras: ["あ", "り", "が", "と", "う"], drop: 2, particle: "", note: "Nakadaka [2]: szczyt na „ri”, spadek na „ga”." },
    "おはようございます": { moras: ["お", "は", "よ", "う"], drop: 0, particle: "", note: "Heiban [0]: wznosi się na „ha” i pozostaje wysokie." },
    "こんにちは": { moras: ["こ", "ん", "に", "ち", "は"], drop: 0, particle: "", note: "Heiban [0]: płaski wzorzec powitania." },
    "こんばんは": { moras: ["こ", "ん", "ば", "ん", "は"], drop: 0, particle: "", note: "Heiban [0]: płaski wzorzec." },
    "すみません": { moras: ["す", "み", "ま", "せ", "ん"], drop: 4, particle: "", note: "Nakadaka [4]: spadek na końcowym „n”." },
  };

  function getPitchInfo(wordKey) {
    return PITCH_DATA[wordKey] || null;
  }

  function renderPitchSVG(wordKey) {
    const info = getPitchInfo(wordKey);
    if (!info) return "";
    const moras = info.moras;
    const n = moras.length;
    const hasPart = !!info.particle;
    const total = n + (hasPart ? 1 : 0);
    const stepX = 36;
    const padX = 22;
    const w = padX * 2 + (total - 1) * stepX;
    const h = 68;
    const yHigh = 16;
    const yLow = 38;

    const heights = [];
    for (let i = 0; i < total; i++) {
      if (info.drop === 0) {
        heights.push(i === 0 ? 0 : 1);
      } else if (info.drop === 1) {
        heights.push(i === 0 ? 1 : 0);
      } else {
        heights.push(i === 0 ? 0 : i < info.drop ? 1 : 0);
      }
    }

    const pts = heights.map((hi, i) => [
      padX + i * stepX,
      hi ? yHigh : yLow,
    ]);
    const poly = pts.map((p) => p.join(",")).join(" ");
    const typeName =
      info.drop === 0
        ? "Heiban [0]"
        : info.drop === 1
        ? "Atamadaka [1]"
        : info.drop === n
        ? `Odaka [${info.drop}]`
        : `Nakadaka [${info.drop}]`;

    let circles = "";
    let labels = "";
    pts.forEach(([x, y], i) => {
      const isPart = i === n;
      circles += isPart
        ? `<circle cx="${x}" cy="${y}" r="4.5" fill="var(--surface)" stroke="var(--muted)" stroke-width="2" stroke-dasharray="2,1"/>`
        : `<circle cx="${x}" cy="${y}" r="5" fill="${
            i + 1 === info.drop ? "var(--seal)" : "var(--indigo)"
          }"/>`;
      const txt = isPart ? info.particle : moras[i];
      labels += `<text x="${x}" y="60" text-anchor="middle" font-size="13" fill="${
        isPart ? "var(--muted)" : "var(--ink)"
      }" font-family="var(--jp)">${txt}</text>`;
    });

    return `<div class="pitch-card">
      <div class="pitch-head">
        <span class="pitch-tag">${typeName}</span>
        <span class="small">Standard tokijski (NHK)</span>
      </div>
      <svg class="pitch-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Wykres akcentu wysokościowego dla ${wordKey}">
        <polyline points="${poly}" fill="none" stroke="var(--indigo)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${circles}
        ${labels}
      </svg>
      <p class="small">${info.note}${
      info.pair ? ` <br><b>Kontrast:</b> ${info.pair}` : ""
    }</p>
    </div>`;
  }

  /* ==========================================================================
   * 8. SHADOWING (Nagrywanie własnej wymowy i porównanie z wzorcem)
   * ========================================================================== */
  const Shadowing = {
    rec: null,
    stream: null,
    chunks: [],
    lastUrl: null,
    active: false,

    supported() {
      return !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia &&
        typeof global.MediaRecorder !== "undefined"
      );
    },

    async toggle(onStateChange) {
      if (this.active && this.rec) {
        try {
          this.rec.stop();
        } catch (e) {}
        return;
      }
      if (!this.supported()) {
        if (onStateChange)
          onStateChange({
            error: "Nagrywanie mikrofonu nie jest obsługiwane w tej przeglądarce.",
          });
        return;
      }
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.chunks = [];
        this.rec = new MediaRecorder(this.stream);
        this.active = true;
        if (onStateChange) onStateChange({ recording: true });
        this.rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) this.chunks.push(e.data);
        };
        this.rec.onstop = () => {
          this.active = false;
          if (this.stream) {
            this.stream.getTracks().forEach((t) => t.stop());
            this.stream = null;
          }
          if (this.lastUrl) URL.revokeObjectURL(this.lastUrl);
          const blob = new Blob(this.chunks, { type: "audio/webm" });
          this.lastUrl = URL.createObjectURL(blob);
          if (onStateChange)
            onStateChange({ recording: false, url: this.lastUrl });
        };
        this.rec.start();
      } catch (e) {
        this.active = false;
        if (onStateChange)
          onStateChange({
            error: "Brak dostępu do mikrofonu lub uprawnienie zostało odrzucone.",
          });
      }
    },

    playRecorded() {
      if (!this.lastUrl) return false;
      try {
        const a = new Audio(this.lastUrl);
        a.play();
        return true;
      } catch (e) {
        return false;
      }
    },
  };

  /* ==========================================================================
   * 9. MASKOTKA APLIKACJI — FOKA HANKO (Oryginalna + warianty tematyczne)
   * ========================================================================== */
  function foka(mood, size) {
    const sz = size || 110;
    const h = Math.round(sz * 0.85);
    const eyes =
      mood === "happy"
        ? `<path d="M72 87q8-10 16 0M112 87q8-10 16 0" fill="none" stroke="#1b1c2b" stroke-width="3.5" stroke-linecap="round"/>`
        : mood === "alert"
        ? `<circle cx="80" cy="84" r="8.2" fill="#1b1c2b"/><circle cx="120" cy="84" r="8.2" fill="#1b1c2b"/><circle cx="82.8" cy="81.2" r="2.8" fill="#fff"/><circle cx="122.8" cy="81.2" r="2.8" fill="#fff"/><path d="M68 72l18 4M132 72l-18 4" stroke="#cf3a24" stroke-width="3.2" stroke-linecap="round"/>`
        : `<circle cx="80" cy="85" r="7.5" fill="#1b1c2b"/><circle cx="120" cy="85" r="7.5" fill="#1b1c2b"/><circle cx="82.6" cy="82.2" r="2.4" fill="#fff"/><circle cx="122.6" cy="82.2" r="2.4" fill="#fff"/>`;

    // Dodatkowe rekwizyty zależne od wydania foki:
    // "brush" -> Foka kaligraf z pędzlem Sumi i kropelką tuszu
    // "sensei" -> Foka uczony w okrągłych okularach
    // "alert" -> Foka z czerwoną chorągiewką / alarmem powtórek
    let prop = "";
    if (mood === "brush") {
      prop = `<g transform="rotate(-24 38 122)">
        <rect x="28" y="72" width="8" height="62" rx="4" fill="#8c5a2b" stroke="#1b1c2b" stroke-width="2.8"/>
        <rect x="27" y="122" width="10" height="8" rx="2" fill="#cf3a24" stroke="#1b1c2b" stroke-width="2.2"/>
        <path d="M27 130c0 14 5 24 5 24s5-10 5-24z" fill="#1b1c2b"/>
      </g>
      <circle cx="62" cy="94" r="3" fill="#1b1c2b" opacity=".75"/>`;
    } else if (mood === "sensei") {
      prop = `<g fill="none" stroke="#a8791a" stroke-width="3">
        <circle cx="80" cy="85" r="13"/>
        <circle cx="120" cy="85" r="13"/>
        <path d="M93 85h14"/>
      </g>`;
    } else if (mood === "alert") {
      prop = `<g>
        <circle cx="32" cy="52" r="16" fill="#cf3a24" stroke="#1b1c2b" stroke-width="2.8"/>
        <text x="32" y="58" text-anchor="middle" fill="#fff" font-size="18" font-weight="800" font-family="sans-serif">!</text>
      </g>`;
    }

    return `<svg class="foka" viewBox="0 0 200 170" width="${sz}" height="${h}" aria-hidden="true"><g stroke="#1b1c2b" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
  <path d="M150 128c14-10 30-12 40-6-4 6-6 12-4 20-12 2-26-2-36-14z" fill="#dce3ea"/><ellipse cx="100" cy="130" rx="66" ry="32" fill="#f6f8fa"/>
  <path d="M52 134c-14 2-24 10-28 20 12 4 26 0 36-8z" fill="#dce3ea"/><path d="M148 134c14 2 24 10 28 20-12 4-26 0-36-8z" fill="#dce3ea"/>
  <circle cx="100" cy="78" r="50" fill="#f6f8fa"/>
  <path d="M150 60q16 2 22 16l-9 3q-4-9-14-10zM150 62q8 10 6 24l-9-1q1-10-5-17z" fill="#cf3a24"/>
  <path d="M53 59Q100 33 147 59L149 69Q100 45 51 69Z" fill="#cf3a24"/><circle cx="150" cy="63" r="6" fill="#cf3a24"/></g>
  <circle cx="100" cy="51" r="3.4" fill="#fff"/><circle cx="68" cy="100" r="7" fill="#f2a093" opacity=".75"/><circle cx="132" cy="100" r="7" fill="#f2a093" opacity=".75"/>
  ${eyes}<path d="M93 93h14q-1 8-7 8t-7-8z" fill="#1b1c2b"/>
  <path d="M100 101v4M100 105q-6 8-13 2M100 105q6 8 13 2M76 104l-20-4M76 109l-20 4M124 104l20-4M124 109l20 4" fill="none" stroke="#1b1c2b" stroke-width="2.4" stroke-linecap="round"/>
  ${prop}</svg>`;
  }

  /* ==========================================================================
   * 10. LABORATORIUM KANJI (Z OBRAZKÓW 1–4):
   *     - Drzewo hierarchii kresek (Stroke Hierarchy in Kanji 休)
   *     - Anatomia komponentów i słów (Components in Kanji 意 -> 意味 / 意識)
   *     - Budowanie kanji z części (Build kanji from parts: 氵 sanzui + gra Kuźnia)
   *     - Kolorowane rodziny radykałów (3 Radicals with examples: 言, 扌, 食)
   * ========================================================================== */

  /**
   * Renderuje znak Kanji z wektorów window.STROKES[ch], kolorując poszczególne kreski
   * według tablicy lub funkcji mapującej indeks kreski na kolor.
   */
  function renderColoredKanjiSVG(ch, size, strokeColorMap, defaultColor) {
    const sz = size || 88;
    const defCol = defaultColor || "var(--ink)";
    const st = global.STROKES && global.STROKES[ch];
    if (!st || !st.strokes || !st.strokes.length) {
      const fallbackCol =
        typeof strokeColorMap === "string"
          ? strokeColorMap
          : Array.isArray(strokeColorMap) && strokeColorMap[0]
          ? strokeColorMap[0]
          : defCol;
      return `<span class="jp" style="font-size:${Math.round(sz * 0.82)}px;line-height:1;color:${fallbackCol};display:inline-block">${ch}</span>`;
    }
    const paths = st.strokes
      .map((d, idx) => {
        let col = defCol;
        if (typeof strokeColorMap === "function") {
          col = strokeColorMap(idx, st.strokes.length) || defCol;
        } else if (Array.isArray(strokeColorMap)) {
          col = strokeColorMap[idx] || defCol;
        } else if (typeof strokeColorMap === "string") {
          col = strokeColorMap;
        }
        return `<path d="${d}" fill="${col}"/>`;
      })
      .join("");
    return `<svg viewBox="0 0 1024 1024" width="${sz}" height="${sz}" class="colored-kanji-svg" aria-label="${ch}">${paths}</svg>`;
  }

  /**
   * Renderuje pojedynczą kreskę (lub podzbiór kresek) na tle delikatnego obrysu całego znaku.
   */
  function renderSingleStrokeSVG(ch, strokeIndices, size, color, showGhost) {
    const sz = size || 64;
    const st = global.STROKES && global.STROKES[ch];
    const indices = Array.isArray(strokeIndices) ? strokeIndices : [strokeIndices];
    if (!st || !st.strokes || !st.strokes.length) {
      return `<span class="jp" style="font-size:${Math.round(sz * 0.75)}px;color:${color || "var(--seal)"}">${ch}</span>`;
    }
    const ghost =
      showGhost !== false
        ? st.strokes
            .map((d) => `<path d="${d}" fill="var(--line)" opacity="0.45"/>`)
            .join("")
        : "";
    const active = indices
      .map((i) => {
        const d = st.strokes[i];
        if (!d) return "";
        const col = Array.isArray(color) ? color[i] || "#E05A47" : color || "#E05A47";
        return `<path d="${d}" fill="${col}"/>`;
      })
      .join("");
    return `<svg viewBox="0 0 1024 1024" width="${sz}" height="${sz}" class="single-stroke-svg">${ghost}${active}</svg>`;
  }

  // Baza szczegółowego rozbicia kresek i komponentów (Obrazek 1 i Obrazek 2)
  const KANJI_ANATOMY_DB = {
    休: {
      meaning: "odpoczywać (rest)",
      story: "Człowiek (亻) opierający się o drzewo (木), żeby odpocząć w cieniu.",
      strokeColors: ["#E86F68", "#E0B43B", "#3B3832", "#3B3832", "#3B3832", "#3B3832"],
      components: [
        {
          glyph: "亻",
          name: "człowiek (person)",
          role: "radykał",
          color: "#E86F68",
          strokes: [0, 1],
          strokeDetails: [
            { idx: 0, label: "Kreska 1 (ノ)", desc: "ukośna w lewo", color: "#E86F68" },
            { idx: 1, label: "Kreska 2 (丨)", desc: "pionowa w dół", color: "#E0B43B" },
          ],
        },
        {
          glyph: "木",
          name: "drzewo (tree)",
          role: "komponent",
          color: "#4B6B43",
          strokes: [2, 3, 4, 5],
          strokeDetails: [
            { idx: 2, label: "Kreska 3 (一)", desc: "pozioma gałąź", color: "#4B6B43" },
            { idx: 3, label: "Kreska 4 (丨)", desc: "pień drzewa", color: "#4B6B43" },
            { idx: 4, label: "Kreska 5 (ノ)", desc: "lewy korzeń", color: "#4B6B43" },
            { idx: 5, label: "Kreska 6 (丶)", desc: "prawy korzeń", color: "#4B6B43" },
          ],
        },
      ],
      words: [
        { w: "休み", r: "やすみ (yasumi)", m: "odpoczynek, przerwa, wakacje", say: "休み" },
        { w: "休日", r: "きゅうじつ (kyūjitsu)", m: "dzień wolny, święto", say: "休日" },
        { w: "休む", r: "やすむ (yasumu)", m: "odpoczywać", say: "休む" },
      ],
    },
    意: {
      meaning: "myśl, uczucie, znaczenie (idea; feeling; meaning)",
      story: "Dźwięk (音 = stać 立 + słońce 日) płynący prosto z serca (心) to myśl i intencja.",
      strokeColors: [
        "#3B82F6", "#3B82F6", "#3B82F6", "#3B82F6", "#3B82F6", // 立 (5 kresek)
        "#EC6B67", "#EC6B67", "#EC6B67", "#EC6B67",           // 日 (4 kreski)
        "#EAB308", "#EAB308", "#EAB308", "#EAB308",           // 心 (4 kreski)
      ],
      components: [
        {
          glyph: "立",
          name: "stać (stand)",
          role: "komponent",
          color: "#3B82F6",
          strokes: [0, 1, 2, 3, 4],
          strokeDetails: [
            { idx: 0, label: "Kreska 1", desc: "górna kropla", color: "#3B82F6" },
            { idx: 1, label: "Kreska 2", desc: "górna belka", color: "#3B82F6" },
          ],
        },
        {
          glyph: "日",
          name: "dzień, słońce (day)",
          role: "komponent",
          color: "#EC6B67",
          strokes: [5, 6, 7, 8],
          strokeDetails: [
            { idx: 5, label: "Kreska 6", desc: "lewa ścianka", color: "#EC6B67" },
            { idx: 6, label: "Kreska 7", desc: "ramka słońca", color: "#EC6B67" },
          ],
        },
        {
          glyph: "心",
          name: "serce, umysł (heart)",
          role: "radykał",
          color: "#EAB308",
          strokes: [9, 10, 11, 12],
          strokeDetails: [
            { idx: 9, label: "Kreska 10", desc: "lewa kropla serca", color: "#EAB308" },
            { idx: 10, label: "Kreska 11", desc: "łuk podstawy serca", color: "#EAB308" },
          ],
        },
      ],
      words: [
        { w: "意味", r: "いみ (imi)", m: "znaczenie, sens (meaning)", say: "意味" },
        { w: "意識", r: "いしき (ishiki)", m: "świadomość (awareness; consciousness)", say: "意識" },
        { w: "意見", r: "いけん (iken)", m: "opinia, zdanie", say: "意見" },
      ],
    },
    海: {
      meaning: "morze, ocean (sea, ocean)",
      story: "Woda (氵), która jest obecna zawsze i wszędzie (毎 — każdy) tworzy ocean.",
      strokeColors: [
        "#0284C7", "#0284C7", "#0284C7", // 氵 (3 kreski)
        "#D97706", "#D97706", "#3B3832", "#3B3832", "#3B3832", "#3B3832",
      ],
      components: [
        {
          glyph: "氵",
          name: "woda (sanzui)",
          role: "radykał",
          color: "#0284C7",
          strokes: [0, 1, 2],
          strokeDetails: [
            { idx: 0, label: "Kreska 1", desc: "górna kropla wody", color: "#0284C7" },
            { idx: 1, label: "Kreska 2", desc: "środkowa kropla", color: "#0284C7" },
            { idx: 2, label: "Kreska 3", desc: "dolny rozbryzg w górę", color: "#0284C7" },
          ],
        },
        {
          glyph: "毎",
          name: "każdy (every)",
          role: "komponent",
          color: "#D97706",
          strokes: [3, 4, 5, 6, 7, 8],
          strokeDetails: [
            { idx: 3, label: "Kreska 4", desc: "górny ukośnik", color: "#D97706" },
            { idx: 4, label: "Kreska 5", desc: "poziome ramię", color: "#D97706" },
          ],
        },
      ],
      words: [
        { w: "海", r: "うみ (umi)", m: "morze, ocean", say: "海" },
        { w: "海外", r: "かいがい (kaigai)", m: "zagranica (za morzem)", say: "海外" },
        { w: "北海道", r: "ほっかいどう (Hokkaidō)", m: "wyspa Hokkaido (Północna Morska Droga)", say: "北海道" },
      ],
    },
    語: {
      meaning: "język, opowiadać (talk / language)",
      story: "Słowa (言) wypowiadane przez pięć (五) ust (口) tworzą język narodu.",
      strokeColors: [
        "#2563EB", "#2563EB", "#2563EB", "#2563EB", "#2563EB", "#2563EB", "#2563EB", // 言 (7 kresek)
        "#D97706", "#D97706", "#D97706", "#D97706",                                   // 五 (4 kreski)
        "#E05A47", "#E05A47", "#E05A47",                                               // 口 (3 kreski)
      ],
      components: [
        {
          glyph: "言",
          name: "słowo, mowa (word)",
          role: "radykał",
          color: "#2563EB",
          strokes: [0, 1, 2, 3, 4, 5, 6],
          strokeDetails: [
            { idx: 0, label: "Kreska 1", desc: "górna kropla mowy", color: "#2563EB" },
            { idx: 1, label: "Kreska 2", desc: "długa fala głosu", color: "#2563EB" },
          ],
        },
        {
          glyph: "五",
          name: "pięć (five)",
          role: "komponent",
          color: "#D97706",
          strokes: [7, 8, 9, 10],
          strokeDetails: [],
        },
        {
          glyph: "口",
          name: "usta (mouth)",
          role: "komponent",
          color: "#E05A47",
          strokes: [11, 12, 13],
          strokeDetails: [],
        },
      ],
      words: [
        { w: "日本語", r: "にほんご (nihongo)", m: "język japoński", say: "日本語" },
        { w: "語る", r: "かたる (kataru)", m: "opowiadać", say: "語る" },
        { w: "物語", r: "ものがたり (monogatari)", m: "opowieść, historia", say: "物語" },
      ],
    },
    指: {
      meaning: "palec, wskazywać (finger / point)",
      story: "Część ręki (扌), która wskazuje smakowity (旨 = łyżka 匕 + słońce/słodkie 日) kąsek.",
      strokeColors: [
        "#DC2626", "#DC2626", "#DC2626", // 扌 (3 kreski)
        "#2563EB", "#2563EB",             // 匕 (2 kreski)
        "#D97706", "#D97706", "#D97706", "#D97706", // 日 (4 kreski)
      ],
      components: [
        {
          glyph: "扌",
          name: "ręka (hand)",
          role: "radykał",
          color: "#DC2626",
          strokes: [0, 1, 2],
          strokeDetails: [
            { idx: 0, label: "Kreska 1", desc: "pozioma belka dłoni", color: "#DC2626" },
            { idx: 1, label: "Kreska 2", desc: "pionowy trzon z haczykiem", color: "#DC2626" },
            { idx: 2, label: "Kreska 3", desc: "ukośne podbicie w górę", color: "#DC2626" },
          ],
        },
        {
          glyph: "匕",
          name: "łyżka (spoon)",
          role: "komponent",
          color: "#2563EB",
          strokes: [3, 4],
          strokeDetails: [],
        },
        {
          glyph: "日",
          name: "słońce / dzień (sun)",
          role: "komponent",
          color: "#D97706",
          strokes: [5, 6, 7, 8],
          strokeDetails: [],
        },
      ],
      words: [
        { w: "指", r: "ゆび (yubi)", m: "palec", say: "指" },
        { w: "指輪", r: "ゆびわ (yubiwa)", m: "pierścionek", say: "指輪" },
        { w: "目指す", r: "めざす (mezasu)", m: "dążyć do celu", say: "目指す" },
      ],
    },
    飲: {
      meaning: "pić (drink)",
      story: "Przy jedzeniu i posiłku (飠/食) otwierasz szeroko usta (欠 — ziewać/brakować), żeby pić.",
      strokeColors: [
        "#4D8B31", "#4D8B31", "#4D8B31", "#4D8B31", "#4D8B31", "#4D8B31", "#4D8B31", "#4D8B31", // 飠 (8 kresek)
        "#0284C7", "#0284C7", "#0284C7", "#0284C7", // 欠 (4 kreski)
      ],
      components: [
        {
          glyph: "飠",
          name: "jedzenie, pokarm (eat)",
          role: "radykał",
          color: "#4D8B31",
          strokes: [0, 1, 2, 3, 4, 5, 6, 7],
          strokeDetails: [
            { idx: 0, label: "Kreska 1", desc: "lewy daszek", color: "#4D8B31" },
            { idx: 1, label: "Kreska 2", desc: "prawy daszek", color: "#4D8B31" },
          ],
        },
        {
          glyph: "欠",
          name: "otwarte usta (yawn / lack)",
          role: "komponent",
          color: "#0284C7",
          strokes: [8, 9, 10, 11],
          strokeDetails: [],
        },
      ],
      words: [
        { w: "飲む", r: "のむ (nomu)", m: "pić", say: "飲む" },
        { w: "飲み物", r: "のみもの (nomimono)", m: "napój", say: "飲み物" },
        { w: "飲食店", r: "いんしょくてん (inshokuten)", m: "restauracja, lokal gastronomiczny", say: "飲食店" },
      ],
    },
    明: {
      meaning: "jasny, światło (bright)",
      story: "Słońce (日) i księżyc (月) świecące razem dają pełną jasność.",
      strokeColors: [
        "#E05A47", "#E05A47", "#E05A47", "#E05A47", // 日 (4 kreski)
        "#EAB308", "#EAB308", "#EAB308", "#EAB308", // 月 (4 kreski)
      ],
      components: [
        {
          glyph: "日",
          name: "słońce (sun)",
          role: "radykał",
          color: "#E05A47",
          strokes: [0, 1, 2, 3],
          strokeDetails: [
            { idx: 0, label: "Kreska 1", desc: "lewy pion słońca", color: "#E05A47" },
            { idx: 1, label: "Kreska 2", desc: "ramka słońca", color: "#E05A47" },
          ],
        },
        {
          glyph: "月",
          name: "księżyc (moon)",
          role: "komponent",
          color: "#EAB308",
          strokes: [4, 5, 6, 7],
          strokeDetails: [
            { idx: 4, label: "Kreska 5", desc: "lewy sierp księżyca", color: "#EAB308" },
            { idx: 5, label: "Kreska 6", desc: "prawy łuk księżyca", color: "#EAB308" },
          ],
        },
      ],
      words: [
        { w: "明るい", r: "あかるい (akarui)", m: "jasny, pogodny", say: "明るい" },
        { w: "明日", r: "あした (ashita)", m: "jutro", say: "明日" },
        { w: "説明", r: "せつめい (setsumei)", m: "wyjaśnienie", say: "説明" },
      ],
    },
    好: {
      meaning: "lubić, dobry (like, fond)",
      story: "Kobieta (女) tuląca dziecko (子) — obraz czułości i upodobania.",
      strokeColors: [
        "#EC6B67", "#EC6B67", "#EC6B67", // 女 (3 kreski)
        "#3B82F6", "#3B82F6", "#3B82F6", // 子 (3 kreski)
      ],
      components: [
        {
          glyph: "女",
          name: "kobieta (woman)",
          role: "radykał",
          color: "#EC6B67",
          strokes: [0, 1, 2],
          strokeDetails: [
            { idx: 0, label: "Kreska 1", desc: "sylwetka klęcząca", color: "#EC6B67" },
            { idx: 1, label: "Kreska 2", desc: "prawy łuk", color: "#EC6B67" },
            { idx: 2, label: "Kreska 3", desc: "poziome ramiona", color: "#EC6B67" },
          ],
        },
        {
          glyph: "子",
          name: "dziecko (child)",
          role: "komponent",
          color: "#3B82F6",
          strokes: [3, 4, 5],
          strokeDetails: [
            { idx: 3, label: "Kreska 4", desc: "główka dziecka", color: "#3B82F6" },
            { idx: 4, label: "Kreska 5", desc: "tułów z haczykiem", color: "#3B82F6" },
            { idx: 5, label: "Kreska 6", desc: "rozpostarte rączki", color: "#3B82F6" },
          ],
        },
      ],
      words: [
        { w: "好き", r: "すき (suki)", m: "lubić, ulubiony", say: "好き" },
        { w: "大好き", r: "だいすき (daisuki)", m: "bardzo lubić, kochać", say: "大好き" },
        { w: "好む", r: "このむ (konomu)", m: "preferować, woleć", say: "好む" },
      ],
    },
  };

  /**
   * Automatycznie buduje strukturę anatomii (Obrazek 1 i 2) dla dowolnego kanji spoza ręcznej bazy,
   * wykorzystując KANJI_TO_RAD, KMAP oraz wektory window.STROKES.
   */
  function getOrBuildAnatomy(ch, kmap) {
    if (KANJI_ANATOMY_DB[ch]) return KANJI_ANATOMY_DB[ch];
    const kItem = (kmap && kmap[ch]) || { q: ch, a: "znak kanji", w: ch, wr: "", wm: "" };
    const rads = KANJI_TO_RAD[ch] || [];
    const st = global.STROKES && global.STROKES[ch];
    const totalStrokes = st && st.strokes ? st.strokes.length : 4;
    const radStrokeCounts = {
      "亻": 2, "人": 2, "氵": 3, "水": 4, "扌": 3, "手": 4, "口": 3, "日": 4,
      "月": 4, "木": 4, "火": 4, "灬": 4, "土": 3, "女": 3, "子": 3, "宀": 3,
      "心": 4, "忄": 3, "言": 7, "糸": 6, "金": 8, "門": 8, "辶": 3, "艹": 3,
      "竹": 6, "目": 5, "田": 5, "力": 2, "貝": 7, "車": 7, "雨": 8, "食": 8,
    };
    const palette = ["#E05A47", "#2563EB", "#D97706", "#4D8B31"];
    const strokeColors = [];
    const components = [];

    if (rads.length > 0) {
      let cursor = 0;
      rads.forEach((rGlyph, idx) => {
        const rInfo = RADICALS.find((x) => x.r === rGlyph) || { r: rGlyph, name: "komponent" };
        const count = Math.min(radStrokeCounts[rGlyph] || 3, Math.max(1, totalStrokes - cursor));
        const indices = [];
        for (let s = 0; s < count && cursor < totalStrokes; s++, cursor++) {
          indices.push(cursor);
          strokeColors[cursor] = palette[idx % palette.length];
        }
        components.push({
          glyph: rGlyph,
          name: rInfo.name,
          role: idx === 0 ? "radykał" : "komponent",
          color: palette[idx % palette.length],
          strokes: indices.length ? indices : [0],
          strokeDetails: indices.slice(0, 3).map((sIdx) => ({
            idx: sIdx,
            label: "Kreska " + (sIdx + 1),
            desc: "ruch pędzla #" + (sIdx + 1),
            color: palette[idx % palette.length],
          })),
        });
      });
      if (cursor < totalStrokes) {
        const rem = [];
        for (; cursor < totalStrokes; cursor++) {
          rem.push(cursor);
          strokeColors[cursor] = "#4B6B43";
        }
        components.push({
          glyph: ch,
          name: "rdzeń znaku",
          role: "komponent",
          color: "#4B6B43",
          strokes: rem,
          strokeDetails: rem.slice(0, 2).map((sIdx) => ({
            idx: sIdx,
            label: "Kreska " + (sIdx + 1),
            desc: "ruch pędzla #" + (sIdx + 1),
            color: "#4B6B43",
          })),
        });
      }
    } else {
      const half = Math.max(1, Math.floor(totalStrokes / 2));
      const c1 = [], c2 = [];
      for (let i = 0; i < totalStrokes; i++) {
        if (i < half) {
          c1.push(i);
          strokeColors[i] = "#E05A47";
        } else {
          c2.push(i);
          strokeColors[i] = "#2563EB";
        }
      }
      components.push({
        glyph: ch,
        name: "część początkowa (kreski 1–" + half + ")",
        role: "komponent",
        color: "#E05A47",
        strokes: c1,
        strokeDetails: c1.slice(0, 2).map((sIdx) => ({
          idx: sIdx,
          label: "Kreska " + (sIdx + 1),
          desc: "początek znaku",
          color: "#E05A47",
        })),
      });
      if (c2.length) {
        components.push({
          glyph: ch,
          name: "część końcowa (kreski " + (half + 1) + "–" + totalStrokes + ")",
          role: "komponent",
          color: "#2563EB",
          strokes: c2,
          strokeDetails: c2.slice(0, 2).map((sIdx) => ({
            idx: sIdx,
            label: "Kreska " + (sIdx + 1),
            desc: "dopełnienie znaku",
            color: "#2563EB",
          })),
        });
      }
    }

    const words = [];
    if (kItem.w) {
      words.push({
        w: kItem.w,
        r: kItem.wr || "",
        m: kItem.wm || kItem.a,
        say: kItem.w,
      });
    }
    return {
      meaning: kItem.a || "znak kanji",
      story: kItem.hint || `Znak ${ch} (${kItem.a}) składa się z ${totalStrokes} kresek.`,
      strokeColors,
      components,
      words,
    };
  }

  // Obrazek 3: "Build kanji from parts" — zestawy równań Radykał + Część -> Kanji
  const BUILD_PARTS_SETS = [
    {
      id: "water",
      radical: "氵",
      radName: "(sanzui) Radykał wody",
      radColor: "#0284C7",
      desc: "Występuje po lewej stronie znaków związanych z wodą, cieczą, pływaniem i przepływem (3 kreski).",
      items: [
        { rad: "氵", part: "毎", partName: "każdy", kanji: "海", r: "umi / カイ", m: "morze, ocean", desc: "woda obecna wszędzie — wielki ocean", scene: "wave", radStrokes: [0, 1, 2] },
        { rad: "氵", part: "也", partName: "być / rozciągać się", kanji: "池", r: "ike / チ", m: "staw, sadzawka", desc: "spokojny staw w ogrodzie", scene: "pond", radStrokes: [0, 1, 2] },
        { rad: "氵", part: "㐬", partName: "nurt / wstęga", kanji: "流", r: "nagareru / リュウ", m: "płynąć, prąd", desc: "kręta górska rzeka w ruchu", scene: "river", radStrokes: [0, 1, 2] },
        { rad: "氵", part: "胡", partName: "stary / daleki", kanji: "湖", r: "mizuumi / コ", m: "jezioro", desc: "rozległe jezioro wśród gór", scene: "lake", radStrokes: [0, 1, 2] },
        { rad: "氵", part: "永", partName: "wieczny / długi", kanji: "泳", r: "oyogu / エイ", m: "pływać", desc: "płynięcie długim torem w wodzie", scene: "swim", radStrokes: [0, 1, 2] },
        { rad: "氵", part: "先", partName: "najpierw / przód", kanji: "洗", r: "arau / セン", m: "myć, płukać", desc: "mycie rąk pod bieżącą wodą", scene: "wash", radStrokes: [0, 1, 2] },
        { rad: "氵", part: "易", partName: "zmiana / słońce", kanji: "湯", r: "yu / トウ", m: "gorąca woda, onsen", desc: "parujące gorące źródło", scene: "onsen", radStrokes: [0, 1, 2] },
        { rad: "氵", part: "酉", partName: "dzban fermentacji", kanji: "酒", r: "sake / シュ", m: "alkohol, sake", desc: "karafka i czarka japońskiego sake", scene: "sake", radStrokes: [0, 1, 2] },
      ],
    },
    {
      id: "person",
      radical: "亻",
      radName: "(ninben) Radykał człowieka",
      radColor: "#E05A47",
      desc: "Boczna forma znaku 人 (człowiek). Tworzy znaki opisujące ludzkie czynności, postawy i relacje (2 kreski).",
      items: [
        { rad: "亻", part: "木", partName: "drzewo", kanji: "休", r: "yasumu / キュウ", m: "odpoczywać", desc: "człowiek oparty o drzewo", scene: "tree", radStrokes: [0, 1] },
        { rad: "亻", part: "本", partName: "korzeń / podstawa", kanji: "体", r: "karada / タイ", m: "ciało", desc: "fizyczna podstawa człowieka", scene: "body", radStrokes: [0, 1] },
        { rad: "亻", part: "乍", partName: "chwila / rzemiosło", kanji: "作", r: "tsukuru / サク", m: "tworzyć, robić", desc: "człowiek wytwarzający przedmiot", scene: "craft", radStrokes: [0, 1] },
        { rad: "亻", part: "主", partName: "gospodarz / lampa", kanji: "住", r: "sumu / ジュウ", m: "mieszkać", desc: "człowiek osiedlający się na stałe", scene: "house", radStrokes: [0, 1] },
        { rad: "亻", part: "寺", partName: "świątynia", kanji: "侍", r: "samurai / ジ", m: "samuraj, służyć", desc: "wojownik czuwający przy panu", scene: "sword", radStrokes: [0, 1] },
      ],
    },
    {
      id: "word",
      radical: "言",
      radName: "(gonben) Radykał słowa i mowy",
      radColor: "#2563EB",
      desc: "Występuje w znakach związanych z mówieniem, językiem, pytaniem i nauką (7 kresek).",
      items: [
        { rad: "言", part: "吾", partName: "ja / pięć ust", kanji: "語", r: "kataru / ゴ", m: "język, opowiadać", desc: "wspólny język rozmowy", scene: "talk", radStrokes: [0, 1, 2, 3, 4, 5, 6] },
        { rad: "言", part: "舌", partName: "język w ustach", kanji: "話", r: "hanashi / ワ", m: "rozmowa, mówić", desc: "żywa rozmowa dwóch osób", scene: "talk", radStrokes: [0, 1, 2, 3, 4, 5, 6] },
        { rad: "言", part: "十", partName: "dziesięć / liczyć", kanji: "計", r: "hakaru / ケイ", m: "planować, mierzyć", desc: "dokładne wyliczenie i plan", scene: "plan", radStrokes: [0, 1, 2, 3, 4, 5, 6] },
        { rad: "言", part: "売", partName: "sprzedawać / obieg", kanji: "読", r: "yomu / ドク", m: "czytać", desc: "odczytywanie słów z książki", scene: "book", radStrokes: [0, 1, 2, 3, 4, 5, 6] },
      ],
    },
    {
      id: "hand",
      radical: "扌",
      radName: "(tehen) Radykał ręki",
      radColor: "#DC2626",
      desc: "Boczna forma znaku 手 (ręka). Tworzy znaki czynności wykonywanych dłonią (3 kreski).",
      items: [
        { rad: "扌", part: "旨", partName: "wskazówka / smak", kanji: "指", r: "yubi / シ", m: "palec, wskazywać", desc: "palec wskazujący kierunek", scene: "hand", radStrokes: [0, 1, 2] },
        { rad: "扌", part: "寺", partName: "świątynia / miara", kanji: "持", r: "motsu / ジ", m: "trzymać, posiadać", desc: "dłoń pewnie trzymająca przedmiot", scene: "hand", radStrokes: [0, 1, 2] },
        { rad: "扌", part: "亢", partName: "wysoki / opór", kanji: "抗", r: "aragau / コウ", m: "przeciwstawiać się", desc: "uniesiona ręka stawiająca opór", scene: "hand", radStrokes: [0, 1, 2] },
      ],
    },
  ];

  // Obrazek 4: "3 Radicals with examples" — kolorowane rodziny radykałów
  const RADICAL_FAMILIES = [
    {
      radical: "言",
      title: "Radykał „słowo” (言)",
      color: "#2563EB",
      radStrokesCount: 7,
      examples: [
        { kanji: "語", en: "Rozmawiać / język", reading: "かた(る) / ご", w: "日本語" },
        { kanji: "話", en: "Mowa / rozmowa", reading: "はなし / わ", w: "話す" },
        { kanji: "計", en: "Plan / mierzyć", reading: "けい / はか(る)", w: "時計" },
      ],
    },
    {
      radical: "扌",
      title: "Radykał „ręka” (扌)",
      color: "#DC2626",
      radStrokesCount: 3,
      examples: [
        { kanji: "指", en: "Palec / wskazywać", reading: "ゆび / さ(す)", w: "指輪" },
        { kanji: "持", en: "Trzymać / mieć", reading: "も(つ) / じ", w: "持つ" },
        { kanji: "抗", en: "Przeciwstawiać się", reading: "あらが(う) / こう", w: "対抗" },
      ],
    },
    {
      radical: "食",
      title: "Radykał „jedzenie” (食 / 飠)",
      color: "#4D8B31",
      radStrokesCount: 8,
      examples: [
        { kanji: "飲", en: "Pić", reading: "の(む) / いん", w: "飲む", radCount: 8 },
        { kanji: "食", en: "Jedzenie / jeść", reading: "しょく / た(べる)", w: "食べる", radCount: 9 },
        { kanji: "飯", en: "Posiłek / gotowany ryż", reading: "めし / まんま / はん", w: "ご飯", radCount: 8 },
      ],
    },
    {
      radical: "氵",
      title: "Radykał „woda” (氵)",
      color: "#0284C7",
      radStrokesCount: 3,
      examples: [
        { kanji: "海", en: "Morze / ocean", reading: "うみ / かい", w: "海" },
        { kanji: "泳", en: "Pływać", reading: "およ(ぐ) / えい", w: "泳ぐ" },
        { kanji: "洗", en: "Myć / płukać", reading: "あら(う) / せん", w: "洗う" },
      ],
    },
  ];

  /**
   * Ilustracje wektorowe SVG do kart „Zbuduj Kanji z części” (Obrazek 3)
   */
  function renderSceneIcon(scene) {
    const map = {
      wave: `<svg viewBox="0 0 80 52" width="76" height="48"><rect width="80" height="52" rx="8" fill="#dbeafe"/><path d="M0 36c12-12 24-12 36 0s24 12 44-4v20H0z" fill="#0284C7"/><path d="M10 26c10-14 26-14 34-2 6-6 18-6 26 4" fill="none" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="16" r="2.5" fill="#fff"/><circle cx="48" cy="14" r="2" fill="#fff"/></svg>`,
      pond: `<svg viewBox="0 0 80 52" width="76" height="48"><rect width="80" height="52" rx="8" fill="#dcfce7"/><ellipse cx="40" cy="32" rx="30" ry="13" fill="#38bdf8"/><circle cx="18" cy="20" r="9" fill="#4ade80"/><circle cx="62" cy="20" r="10" fill="#22c55e"/><ellipse cx="32" cy="33" rx="6" ry="3" fill="#86efac"/></svg>`,
      river: `<svg viewBox="0 0 80 52" width="76" height="48"><rect width="80" height="52" rx="8" fill="#d1fae5"/><path d="M0 24L22 8l18 16L60 6l20 18v28H0z" fill="#4ade80" opacity=".45"/><path d="M36 14C24 24 54 32 22 52h26C68 32 44 24 48 14z" fill="#0284C7"/></svg>`,
      lake: `<svg viewBox="0 0 80 52" width="76" height="48"><rect width="80" height="52" rx="8" fill="#e0f2fe"/><polygon points="8,32 28,10 48,32" fill="#64748b"/><polygon points="36,32 56,12 74,32" fill="#475569"/><rect x="0" y="31" width="80" height="21" rx="4" fill="#0284C7"/><path d="M16 40h24M36 46h28" stroke="#bae6fd" stroke-width="2" stroke-linecap="round"/></svg>`,
      swim: `<svg viewBox="0 0 80 52" width="76" height="48"><rect width="80" height="52" rx="8" fill="#bae6fd"/><path d="M0 32q10-5 20 0t20 0 20 0 20 0v20H0z" fill="#0284C7"/><circle cx="48" cy="23" r="6" fill="#fed7aa"/><path d="M43 21a6 5 0 0 1 11 0z" fill="#1e293b"/><path d="M22 28q12-10 24-2" fill="none" stroke="#fed7aa" stroke-width="4" stroke-linecap="round"/></svg>`,
      wash: `<svg viewBox="0 0 80 52" width="76" height="48"><rect width="80" height="52" rx="8" fill="#f0f9ff"/><path d="M52 10h18v6H56v6h-6v-8a4 4 0 0 1 2-4z" fill="#64748b"/><path d="M51 24v18M55 24v18" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="3 2"/><ellipse cx="38" cy="36" rx="14" ry="8" fill="#fdba74"/><circle cx="44" cy="31" r="4" fill="#fff" opacity=".85"/><circle cx="34" cy="33" r="3.5" fill="#fff" opacity=".85"/></svg>`,
      onsen: `<svg viewBox="0 0 80 52" width="76" height="48"><rect width="80" height="52" rx="8" fill="#fef3c7"/><ellipse cx="40" cy="38" rx="28" ry="10" fill="#38bdf8"/><ellipse cx="40" cy="38" rx="30" ry="10" fill="none" stroke="#78716c" stroke-width="4" stroke-dasharray="8 3"/><path d="M28 26q-3-6 2-12M40 25q-3-6 2-12M52 26q-3-6 2-12" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/></svg>`,
      sake: `<svg viewBox="0 0 80 52" width="76" height="48"><rect width="80" height="52" rx="8" fill="#fef2f2"/><path d="M44 12h10l-2 8c6 5 8 12 6 22H38c-2-10 0-17 6-22z" fill="#f8fafc" stroke="#475569" stroke-width="2"/><path d="M39 28h20" stroke="#2563EB" stroke-width="3"/><rect x="20" y="30" width="12" height="12" rx="3" fill="#f8fafc" stroke="#475569" stroke-width="2"/></svg>`,
    };
    return (
      map[scene] ||
      `<svg viewBox="0 0 80 52" width="76" height="48"><rect width="80" height="52" rx="8" fill="#e2e8f0"/><circle cx="40" cy="26" r="14" fill="#cf3a24" opacity=".8"/></svg>`
    );
  }

  /* ==========================================================================
   * EKSPORT DO PRZESTRZENI GLOBALNEJ (window.ArgonEngine)
   * ========================================================================== */
  global.ArgonEngine = {
    store,
    syncFromIDBIfEmpty,
    mirrorAllToIDB,
    prefs,
    savePrefs,
    applyPrefsToDOM,
    FX,
    MASCOT: {
      foka,
    },
    FSRS: {
      SKILLS: FSRS_SKILLS,
      SKILL_LABELS,
      get data() {
        return fsrsData;
      },
      reload() {
        fsrsData = store.get("fsrs", {});
        historyData = store.get("history", { days: {}, recent: [] });
        errorData = store.get("errors", { pairs: {}, items: {}, log: [] });
        prefs = Object.assign({}, DEFAULT_PREFS, store.get("prefs", {}));
        applyPrefsToDOM();
      },
      migrateLegacyToFSRS,
      recordReview: recordFSRSReview,
      getSkillCard,
      getItemRetrievability,
      getItemStability,
      previewIntervals: previewFSRSIntervals,
      get history() {
        return historyData;
      },
      pushRecentItem,
    },
    IME: {
      romajiToKana,
      hiraToKata,
      kataToHira,
    },
    CONFUSION: {
      PAIRS: CONFUSABLE_PAIRS,
      PAIR_INDEX,
      ITEM_PARTNERS,
      get data() {
        return errorData;
      },
      recordError: recordConfusionError,
      markPairResolved,
      getActivePairs: getActiveConfusionPairs,
      getBuiltInPairs: getBuiltInConfusionPairs,
    },
    GRAPH: {
      RADICALS,
      KANJI_TO_RAD,
    },
    KANJI_LAB: {
      ANATOMY_DB: KANJI_ANATOMY_DB,
      getOrBuildAnatomy,
      renderColoredKanjiSVG,
      renderSingleStrokeSVG,
      BUILD_PARTS_SETS,
      RADICAL_FAMILIES,
      renderSceneIcon,
    },
    PITCH: {
      DATA: PITCH_DATA,
      getInfo: getPitchInfo,
      renderSVG: renderPitchSVG,
    },
    Shadowing,
  };
})(window);
