// Service worker kill switch.
// The previous site registered /sw.js (scope /) with network-first caching. The new site has no
// service worker, so when a returning browser checks for an update it gets this file, which
// clears every cache, unregisters itself and reloads open pages so they come from the network.
// Safe to keep indefinitely: a browser without the old worker never registers this one.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {}

      await self.registration.unregister();

      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.all(
        clients.map((client) => ('navigate' in client ? client.navigate(client.url).catch(() => {}) : undefined))
      );
    })()
  );
});

// No fetch handler on purpose: requests go straight to the network while this worker exists.
