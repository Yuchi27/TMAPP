const CACHE = "tmapp-v1";
const ASSETS = [
  "/index.html",
  "/pages/auth.html",
  "/pages/dashboard.html",
  "/pages/tasks.html",
  "/pages/calendar.html",
  "/styles/main.css",
  "/styles/auth.css",
  "/styles/dashboard.css",
  "/styles/tasks.css",
  "/styles/calendar.css",
  "/scripts/firebase.js",
  "/scripts/auth.js",
  "/scripts/dashboard.js",
  "/scripts/tasks.js",
  "/scripts/calendar.js",
  "/TMA/index.html",
  "/TMA/pages/dashboard.html",

];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});