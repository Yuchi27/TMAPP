importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// ── Firebase config ──
firebase.initializeApp({
  apiKey: "AIzaSyBBq8Wf-GEdUXm-fYjpvqLktGxkylPQTmI",
  authDomain: "tmapp-6f402.firebaseapp.com",
  projectId: "tmapp-6f402",
  storageBucket: "tmapp-6f402.firebasestorage.app",
  messagingSenderId: "729540723639",
  appId: "1:729540723639:web:09c5981457ffacb1401e32"
});

const messaging = firebase.messaging();

// ── Background push notifications ──
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || "TMAPP", {
    body: body || "You have a new notification.",
    icon: icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: payload.data || {}
  });
});

// ── Notification click ──
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.openWindow(e.notification.data?.url || "/pages/dashboard.html")
  );
});

// ── Cache ──
const CACHE = "taskora-v1"; // bumpa ni nga number (v5, v6...) kada dako nga deploy/structural change
const ASSETS = [
  "/index.html",
  "/pages/auth.html",
  "/pages/dashboard.html",
  "/pages/tasks.html",
  "/pages/calendar.html",
  "/pages/schedule.html",
  "/pages/settings.html",
  "/pages/analytics.html",
  "/styles/main.css",
  "/styles/auth.css",
  "/styles/dashboard.css",
  "/styles/tasks.css",
  "/styles/calendar.css",
  "/styles/schedule.css",
  "/styles/settings.css",
  "/styles/analytics.css",
  "/styles/darkmode.css",
  "/styles/responsive.css",
  "/scripts/firebase.js",
  "/scripts/auth.js",
  "/scripts/dashboard.js",
  "/scripts/tasks.js",
  "/scripts/calendar.js",
  "/scripts/schedule.js",
  "/scripts/settings.js",
  "/scripts/analytics.js",
  "/scripts/nav.js",
  "/scripts/loader.js",
  "/scripts/theme.js",
  "/scripts/pwa.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // CRITICAL: dili gyud hilabtan ang cross-origin requests (Firestore listen
  // channel, Firebase Auth, Firebase Messaging, Google Fonts/CDN, etc).
  // Kung i-proxy/cache nato ni, ma-disrupt ang real-time Firestore connection
  // — mao na nga dili dayon makit-an ang bag-ong task/update kung walay
  // manual refresh.
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});