// Offline support: caches the whole app (the "Umrah offline pack") so the
// ritual tracker keeps working with no connection. Bump CACHE when shipping new assets.
const CACHE = 'guided-umrah-v4';
const MANIFEST = './asset-manifest.json';

async function loadManifest() {
  const res = await fetch(MANIFEST, { cache: 'no-cache' }).catch(() => null);
  if (res?.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(MANIFEST, res.clone());
    return res.json();
  }
  const cached = await caches.match(MANIFEST);
  if (cached) return cached.json();
  throw new Error('offline pack list unavailable');
}

async function cacheAll() {
  const manifest = await loadManifest();
  const cache = await caches.open(CACHE);
  for (const group of manifest.groups) {
    if (group.optional) await Promise.all(group.files.map((f) => cache.add(f).catch(() => {})));
    else await cache.addAll(group.files);
  }
  return manifest;
}

async function status(manifest) {
  const cache = await caches.open(CACHE);
  return Promise.all(
    manifest.groups.map(async (g) => {
      const files = await Promise.all(g.files.map(async (file) => ({ file, cached: Boolean(await cache.match(file)) })));
      return { id: g.id, label: g.label, optional: Boolean(g.optional), cached: files.every((f) => f.cached), files };
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAll().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE && key.startsWith('guided-umrah-')) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// The offline page asks for STATUS or CACHE_ALL over a MessageChannel.
self.addEventListener('message', (event) => {
  const port = event.ports[0];
  if (!port) return;
  const work = (async () => {
    const manifest = event.data?.type === 'CACHE_ALL' ? await cacheAll() : await loadManifest();
    port.postMessage({ ok: true, cache: CACHE, groups: await status(manifest) });
  })().catch((err) => port.postMessage({ ok: false, error: String(err?.message ?? err) }));
  event.waitUntil(work);
});

// Cache first (the app must open instantly with no signal), refreshing in the background.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res.status === 200 && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const res = await network;
      if (res) return res;
      if (req.mode === 'navigate') return (await cache.match('./index.html')) ?? Response.error();
      return Response.error();
    })(),
  );
});
