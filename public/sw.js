// q-sort service worker. Cache-first for the page shell, never cache
// writes to api.github.com.
const CACHE = 'qsort-v1';
const SHELL = [
  '/q-sort/',
  '/manifest.webmanifest',
  '/icons/q-sort-192.png',
  '/icons/q-sort-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept GitHub API.
  if (url.hostname === 'api.github.com') return;

  // Only handle our own origin.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((res) => {
          // Optionally update the cache for shell entries on success.
          if (res.ok && SHELL.includes(url.pathname)) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, clone));
          }
          return res;
        }).catch(() => cached || Response.error())
      );
    }),
  );
});
