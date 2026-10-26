/* ==========================================================================
   ADVENTURER CODEX — 5E SHEET SERVICE WORKER (OFFLINE PWA ENGINE)
   ========================================================================== */

const CACHE_NAME = "adventurer-codex-5e-v95";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg"
];

// Install: Pre-cache core application shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("PWA pre-cache warning:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up legacy caches from earlier versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy: Stale-While-Revalidate for app assets, Network-First for external CDN
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests or Firestore / Auth websockets
  if (req.method !== "GET" || url.protocol.startsWith("chrome-extension") || url.hostname.includes("firestore.googleapis.com")) {
    return;
  }

  // Same-origin core files: Network-first (bypassing stale HTTP disk cache) with cache fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req, { cache: "no-cache" })
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match(req).then((cachedRes) => {
            if (cachedRes) return cachedRes;
            if (req.mode === "navigate") {
              return caches.match("./index.html");
            }
          });
        })
    );
    return;
  }

  // Third-party assets (Fonts, CDN scripts): Cache-first with network fallback
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      if (cachedRes) return cachedRes;
      return fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch((err) => {
          // Gracefully suppress offline errors for CDNs
          return new Response("", { status: 408, statusText: "Offline" });
        });
    })
  );
});
