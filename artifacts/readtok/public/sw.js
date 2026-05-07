self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
      await self.registration.unregister();

      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clients) {
        if ("navigate" in client) {
          client.navigate(client.url);
        }
      }
    })(),
  );
});
