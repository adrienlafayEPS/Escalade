const CACHE_NAME = "escalade-core-v3";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Laisser les services externes en réseau (Maps etc.)
  if (url.origin !== self.location.origin) return;

  // AS dynamique: toujours essayer réseau d'abord
  if (url.pathname.endsWith("/as-calendar.json") || url.pathname.endsWith("as-calendar.json")) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then((r) => r || new Response("{}", { headers: { "Content-Type": "application/json" } })))
    );
    return;
  }

  // Médias/ressources locales: cache-first pour hors-ligne robuste
  const isStatic =
    url.pathname.includes("/images/") ||
    /\.(png|jpg|jpeg|svg|webp|pdf|css|js)$/i.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached && cached.ok) return cached;
        return fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // HTML/app shell: réseau d'abord, fallback cache
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
