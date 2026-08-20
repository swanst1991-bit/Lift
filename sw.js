/* Lift — service worker.
   Stale-while-revalidate: the app opens instantly from cache with no signal,
   and quietly picks up a new version the next time it has one.
   Bump CACHE when you deploy a change. */
const CACHE = "lift-v4";   // v4 — challenges, NordicTrack T 6.5 S limits
const ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icon-180.png", "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => hit);
      // Navigations fall back to the cached shell when offline.
      return hit || net.catch(() => caches.match("./index.html"));
    })
  );
});
