// Deliberately network-only for customer content. Never cache app HTML or APIs.
const CACHE = 'wardrobe-public-v2-fitstalker';
// Ephemeral handoff only: no customer photos in Cache Storage or IndexedDB.
const incomingShares = new Map();
const PUBLIC = [
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
];
self.addEventListener('install', (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PUBLIC))),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith('wardrobe-') && name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
  if (event.data?.type === 'TAKE_SCREENSHOT' && event.ports[0]) {
    const token = event.data.token;
    const clientUrl = event.source?.url ? new URL(event.source.url) : null;
    const item = incomingShares.get(token);
    if (clientUrl?.origin !== self.location.origin || clientUrl.searchParams.get('share') !== token)
      return;
    incomingShares.delete(token);
    event.ports[0].postMessage(
      item && Date.now() - item.created < 120000 ? { file: item.file } : { error: true },
    );
  }
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    url.origin === self.location.origin &&
    url.pathname === '/share-target' &&
    event.request.method === 'POST'
  ) {
    event.respondWith(
      (async () => {
        try {
          const form = await event.request.formData();
          const files = form.getAll('screenshot');
          const file = files[0];
          if (
            files.length !== 1 ||
            !(file instanceof File) ||
            !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
            !file.size ||
            file.size > 4 * 1024 * 1024
          ) {
            return Response.redirect(new URL('/?share=unavailable', self.location.origin), 303);
          }
          for (const [key, value] of incomingShares)
            if (Date.now() - value.created >= 120000) incomingShares.delete(key);
          if (incomingShares.size >= 4) incomingShares.delete(incomingShares.keys().next().value);
          const token = crypto.randomUUID();
          incomingShares.set(token, { file, created: Date.now() });
          setTimeout(() => incomingShares.delete(token), 120000);
          return Response.redirect(new URL('/?share=' + token, self.location.origin), 303);
        } catch {
          return Response.redirect(new URL('/?share=unavailable', self.location.origin), 303);
        }
      })(),
    );
    return;
  }
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(
        async () => (await caches.match('/offline.html')) || Response.error(),
      ),
    );
    return;
  }
  if (PUBLIC.includes(url.pathname) && !url.search)
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
