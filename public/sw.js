self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first; this SW is minimal to enable PWA install and standalone mode
  event.respondWith(fetch(event.request).catch(() => new Response('Offline', { status: 503 })));
});
