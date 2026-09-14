/**
 * Offline cache.
 *
 * Bump CACHE on every release — the version is part of the cache name, so a new
 * one is filled in the background and the old one is dropped on activate.
 *
 * Strategy: the vendored engine never changes for a given filename, so it is
 * served straight from cache. Everything else goes to the network first and
 * falls back to cache, which keeps a stale build from outliving a deploy while
 * still letting the game run at sea with no signal.
 */
const CACHE = "grandline-v2";

const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./vendor/three-0.160.1.module.min.js",
  "./src/main.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      // A missing file must not wedge the install; the fetch handler will
      // still cache it on first use.
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const immutable = url.pathname.includes("/vendor/");

  if (immutable) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
