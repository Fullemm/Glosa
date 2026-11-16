/**
 * Język aplikacji (pl / en). Dla angielskiego:
 *  - przed curriculum.js podmienia dane kursu (znaczenia kanji, zwroty, zdania, tematy),
 *  - po curriculum.js (I18N.post) tłumaczy obiekty kursu,
 *  - tłumaczy interfejs na żywo (MutationObserver) według słownika.
 */
(function (g) {
  "use strict";
  let lang = null;
  try {
    lang = JSON.parse(localStorage.getItem("nihongo:lang") || "null");
  } catch (e) {}
  if (lang !== "pl" && lang !== "en") lang = /^pl\b/i.test(navigator.language || "pl") ? "pl" : "en";
  g.GLOSA_LANG = lang;
  const I = (g.I18N = {
    lang,
    setLang(l) {
      try {
        localStorage.setItem("nihongo:lang", JSON.stringify(l));
      } catch (e) {}
      location.reload();
    },
    tr: (s) => s,
    post() {},
  });
  if (lang !== "en" || !g.GLOSA_EN) return;
  document.documentElement.lang = "en";
  const D = g.GLOSA_EN;
  const C = D.c, K = D.k;
  const UI = {};
  for (const k in C) if (/\s/.test(k) || /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(k)) UI[k] = C[k];
  Object.assign(UI, D.ui);
  const SKIP = new Set(["k", "q", "m", "say", "ro", "py", "on", "kun", "w", "wr", "wp", "other", "kind", "home", "id"]);

  /* ---------- dane kursu ---------- */
  const seen = new WeakSet();
  function walk(o, depth) {
    if (!o || typeof o !== "object" || seen.has(o) || depth > 9) return;
    seen.add(o);
    if (Array.isArray(o)) {
      // [zapis japoński, romaji, znaczenie…]: romaji zostaje bez zmian
      const skip1 = typeof o[0] === "string" && /[\u3040-\u9fff]/.test(o[0]);
      for (let i = 0; i < o.length; i++) {
        if (skip1 && i === 1) continue;
        const v = o[i];
        if (typeof v === "string") {
          const t = C[v] || C[v.trim()];
          if (t) o[i] = t;
        } else walk(v, depth + 1);
      }
      return;
    }
    for (const k in o) {
      if (SKIP.has(k) || (k === "a" && o.kind === "kana")) continue;
      const v = o[k];
      if (typeof v === "string") {
        const t = C[v] || C[v.trim()];
        if (t) o[k] = t;
      } else if (v && typeof v === "object") walk(v, depth + 1);
    }
  }
  // KDATA: znak|znaczenie|on|kun|słowo|czytanie|znaczenie słowa|kreski
  if (g.KDATA)
    for (const gr in g.KDATA)
      g.KDATA[gr] = g.KDATA[gr]
        .split("\n")
        .map((l) => {
          if (!l || l[0] === "#") return l;
          const f = l.split("|");
          const e = K[f[0]];
          if (e) {
            if (e[0]) f[1] = e[0];
            if (e[1]) f[6] = e[1];
          } else {
            if (C[f[1]]) f[1] = C[f[1]];
            if (C[f[6]]) f[6] = C[f[6]];
          }
          return f.join("|");
        })
        .join("\n");
  if (g.ZH && typeof g.ZH.HANZI === "string")
    g.ZH.HANZI = g.ZH.HANZI.split("\n")
      .map((l) => {
        if (!l) return l;
        if (l[0] === "#") return "#" + (C[l.slice(1)] || l.slice(1));
        const f = l.split("|");
        [1, 5, 6].forEach((i) => f[i] !== undefined && C[f[i]] && (f[i] = C[f[i]]));
        return f.join("|");
      })
      .join("\n");
  ["KS1", "ZH", "JA_THEMES", "JA_SENTENCES"].forEach((n) => walk(g[n], 0));

  I.post = function () {
    const Cu = g.GlosaCurriculum;
    if (!Cu) return;
    ["GRAMMAR", "PHRASES", "KCAT", "KCOMP", "KSENT", "KELEM", "KWORDS", "TMK", "CONF", "TONES", "SETNAME", "AMB", "DECKS", "ZHD", "JAITEMS", "ZHITEMS"].forEach((n) => walk(Cu[n], 0));
    [...(Cu.JAITEMS || []), ...(Cu.ZHITEMS || [])].forEach((x) => {
      if (x.kind === "kana") x.extra = "romaji: <b>" + x.a + "</b>";
      else if (x.kind === "hanzi") x.extra = `pinyin: <b>${x.py}</b> · <span class="jp">${x.w}</span> (${x.wp}) = ${x.wm}`;
      if (x.kind === "kanji" && K[x.q]) {
        if (K[x.q][0] && /[ąćęłńóśźż]|\b(i|w|z|na|do)\b/.test(x.a)) x.a = K[x.q][0];
      }
      if (x.hint && /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(x.hint)) delete x.hint;
    });
  };

  /* ---------- interfejs ---------- */
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const PAT = Object.keys(UI)
    .filter((k) => k.includes("{X}") || k.includes("{n}"))
    .sort((a, b) => b.length - a.length)
    .map((k) => {
      const order = [];
      const re = new RegExp(
        "^" +
          esc(k).replace(/\\\{X\\\}|\\\{n\\\}/g, (m) => {
            order.push(m.includes("X") ? "X" : "n");
            return m.includes("X") ? "(.+?)" : "(\\d+(?:[.,]\\d+)?)";
          }) +
          "$"
      );
      return { re, k, order };
    });
  const FR = Object.keys(D.frag || {}).sort((a, b) => b.length - a.length);
  const PL = /[A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
  const cache = new Map();
  function tr(s, depth) {
    if (!s || !PL.test(s)) return s;
    const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const t = m[2];
    if (!t) return s;
    let r = cache.get(t);
    if (r === undefined) {
      r = core(t, depth || 0);
      cache.set(t, r);
    }
    return m[1] + r + m[3];
  }
  function core(t, depth) {
    if (UI[t]) return UI[t];
    const nums = [];
    const tn = t.replace(/\d+/g, (d) => (nums.push(d), "{n}"));
    if (UI[tn] && nums.length) {
      let i = 0;
      return UI[tn].replace(/\{n\}/g, () => nums[i++]);
    }
    if (depth < 3) {
      const lk = t.match(/^(.*) \(zablokowane\)$/);
      if (lk) return tr(lk[1], depth + 1) + " (locked)";
      for (const p of PAT) {
        const mm = t.match(p.re);
        if (!mm) continue;
        const vals = mm.slice(1);
        let iX = 0, iN = 0;
        const xs = [], ns = [];
        p.order.forEach((o, i) => (o === "X" ? xs.push(tr(vals[i], depth + 1)) : ns.push(vals[i])));
        return UI[p.k].replace(/\{X\}|\{n\}/g, (q) => (q === "{X}" ? xs[iX++] : ns[iN++]));
      }
    }
    let out = t;
    for (const f of FR) if (out.includes(f)) out = out.split(f).join(D.frag[f]);
    return out;
  }
  I.tr = (s) => tr(s, 0);
  const ATTRS = ["aria-label", "title", "placeholder", "alt"];
  function fixNode(n) {
    if (n.nodeType === 3) {
      const p = n.parentNode;
      if (p && /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)) return;
      const v = n.nodeValue;
      const t = tr(v, 0);
      if (t !== v) n.nodeValue = t;
      return;
    }
    if (n.nodeType !== 1) return;
    for (const a of ATTRS) {
      const v = n.getAttribute(a);
      if (v) {
        const t = tr(v, 0);
        if (t !== v) n.setAttribute(a, t);
      }
    }
    if (/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.nodeName)) return;
    for (let c = n.firstChild; c; c = c.nextSibling) fixNode(c);
  }
  function start() {
    fixNode(document.body);
    if (document.title) document.title = tr(document.title, 0);
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === "characterData") fixNode(m.target);
        else if (m.type === "attributes") fixNode(m.target);
        else m.addedNodes.forEach(fixNode);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})(window);
