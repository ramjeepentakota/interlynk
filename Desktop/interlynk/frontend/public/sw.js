/* Interlynk PWA service worker — offline shell.
 *
 * Strategy:
 *   – Precache the app shell (HTML, JS, CSS, icons) so a cold reload while
 *     offline still gets to the login screen.
 *   – Network-first for API and WebSocket requests — we never want stale data.
 *   – Stale-while-revalidate for static assets at runtime.
 *
 * Skips dev-mode entirely because Vite's HMR breaks under a cached fetch handler.
 */

const CACHE_NAME = 'interlynk-shell-v1';
const SHELL = ['/', '/index.html', '/favicon.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((c) => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache the API or websocket endpoints — they're either live data or
  // protocol upgrades. Let them go to the network unmodified.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) return;

  // App-shell HTML: network-first so the user picks up new deploys, with a
  // cached fallback if they're offline.
  if (req.mode === 'navigate' || req.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || new Response('Offline', { status: 503 }))),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    }),
  );
});
