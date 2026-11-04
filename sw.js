// sw.js — makes SignBridge work offline after the first visit.
// Your own files: network first (so updates show up), cache as backup.
// MediaPipe engine + model: cache first (big files, never change).
const CACHE = "signbridge-v2";   // change this number when you want to force-refresh caches

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isCdn = url.hostname === "cdn.jsdelivr.net" || url.hostname === "storage.googleapis.com";
  const isOwn = url.origin === self.location.origin;
  if (!isCdn && !isOwn) return;

  const save = (res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };

  if (isCdn) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(save)));
  } else {
    e.respondWith(fetch(req).then(save).catch(() => caches.match(req)));
  }
});
