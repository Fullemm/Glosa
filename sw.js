const VERSION = "e5d9671ccc32";
const CACHE = "nihongo-" + VERSION;
const FONTS = "nihongo-fonts";
const FILES = [
  "./",
  "./data/curriculum.js",
  "./data/foka-img.js",
  "./data/kanji.js",
  "./data/licenses.js",
  "./data/recog-t.js",
  "./data/s-k1.js",
  "./data/s-k2.js",
  "./data/s-k3.js",
  "./data/s-k4.js",
  "./data/s-k5.js",
  "./data/s-k6.js",
  "./data/s-k7.js",
  "./data/s-k8.js",
  "./data/s-k9.js",
  "./data/s-kana.js",
  "./data/s-zh.js",
  "./data/sentences.js",
  "./data/themes.js",
  "./data/zh.js",
  "./engine.js",
  "./icons/apple-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./index.html",
  "./lib/hanzi-writer.min.js",
  "./licenses/ARPHIC-PUBLIC-LICENSE.txt",
  "./licenses/AnimCJK-COPYING.txt",
  "./licenses/HanziWriter-MIT.txt",
  "./licenses/kanji-data-MIT.txt",
  "./manifest.webmanifest",
  "./recognize.js",
  "./sumi.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("nihongo-") && k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => {
  if (e.data === "skip") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === "navigate") {
        const page = await cache.match("./index.html");
        if (page) return page;
      }
      return fetch(req);
    })());
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith((async () => {
      const cache = await caches.open(FONTS);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        cache.put(req, res.clone());
        return res;
      } catch (err) {
        return new Response("", { status: 504 });
      }
    })());
  }
});
