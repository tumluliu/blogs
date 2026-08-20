// q-write service worker. Deliberately separate from public/sw.js (q-sort)
// so a change here cannot regress that app. Never touches api.github.com.
//
// Two strategies, split by request type:
//  - The page shell itself (a navigation to /q-write/): network-first,
//    falling back to the cached copy when offline. This is what makes an
//    online reload always pick up a new build instead of the cache-first
//    approach this replaced, which could serve the shell it happened to
//    install with forever, since CACHE below never changes.
//  - Everything else same-origin — content-hashed build assets under
//    /_astro/, the manifest, the icons: cache-first with runtime caching.
//    Their filenames are content-hashed, so caching them indefinitely is
//    safe; a new build just means new filenames, i.e. fresh cache misses.
const CACHE = 'qwrite-v1';
const PAGE = '/q-write/';
const SHELL = [PAGE, '/q-write.webmanifest', '/icons/q-write-192.png', '/icons/q-write-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('qwrite-') && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.hostname === 'api.github.com') return;
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate' || url.pathname === PAGE) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match(PAGE))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
