// Service worker: offline app shell, cached static assets, and push notifications.
// API calls and the WebSocket are never cached.
const CACHE = 'bandmate-v1'
const SHELL = ['/', '/icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/ws') return
  // Pages: network first, fall back to the cached shell when offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/')))
    return
  }
  // Hashed build assets, fonts, audio: cache first.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/audio/') || url.pathname.startsWith('/content/')) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            if (res.ok && res.status === 200) caches.open(CACHE).then((c) => c.put(e.request, res.clone()))
            return res
          }),
      ),
    )
  }
})

self.addEventListener('push', (e) => {
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch {
    data = { title: e.data ? e.data.text() : 'Bandmate' }
  }
  e.waitUntil(self.registration.showNotification(data.title || 'Bandmate', { body: data.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: data.tag, data: { url: data.url || '/' } }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.navigate(url).then(() => c.focus())
      return self.clients.openWindow(url)
    }),
  )
})
