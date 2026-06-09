const CACHE_NAME = 'lembrei-pwa-v7'

const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/favicon.png',
  '/icon-192-v2.png',
  '/icon-512-v2.png',
  '/icon-512-maskable-v2.png',
]

self.addEventListener('install', (event) => {
  self.skipWaiting()

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ),
    ),
  )

  self.clients.claim()
})

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const title = data.title || 'Lembrei'
  const options = {
    body: data.body || 'Nova notificação',
    icon: '/icon-512-maskable-v2.png',
    badge: '/icon-192-v2.png',
    data: { url: data.url || '/app' },
    requireInteraction: false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/app'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus()
        }
        if (clients.openWindow) return clients.openWindow(url)
      }),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) return

  // HTML: sempre rede, fallback offline para cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/index.html')),
      ),
    )
    return
  }

  // Estáticos (imagens, manifest): cache primeiro, atualiza em background
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
        }
        return response
      })
      return cached || fetchPromise
    }),
  )
})