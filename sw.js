// Daily Briefings PWA Service Worker
// Cache strategy:
//  - HTML / Markdown: Network-first (always latest briefings, fall back to cache offline)
//  - Icons / manifest / static images: Cache-first
const CACHE_VERSION = 'daily-briefings-v3';
const BASE = '/daily-briefings/';
const PRECACHE = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'apple-touch-icon.png',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
  BASE + 'financial/',
  BASE + 'international/',
  BASE + 'medical/',
  BASE + 'health/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(PRECACHE).catch(() => {})
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Only handle our own origin + raw briefing fetches
  const isOurApp = url.origin === self.location.origin;
  const isBriefingRaw = url.hostname === 'raw.githubusercontent.com' &&
                       url.pathname.includes('/daily-briefings/');
  if (!isOurApp && !isBriefingRaw) return;

  // Network-first for HTML and markdown (always latest)
  if (req.destination === 'document' ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.md') ||
      isBriefingRaw) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for icons / manifest / static
  event.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
    )
  );
});
