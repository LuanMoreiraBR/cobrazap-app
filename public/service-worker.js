const CACHE_NAME = 'lembrei-pwa-v4'

const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  self.skipWaiting()

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      )
    }),
  )

  self.clients.claim()
})

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const title = data.title || 'Lembrei'
  const options = {
    body: data.body || 'Nova notificação',
    icon: '/icon-512-maskable.png',
    badge: '/icon-192.png',
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

  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseClone = response.clone()

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone)
        })

        return response
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse

          if (request.mode === 'navigate') {
            return caches.match('/')
          }

          return new Response('Offline', {
            status: 503,
            statusText: 'Offline',
          })
        })
      }),
  )
})