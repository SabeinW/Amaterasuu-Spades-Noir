// Service worker: shows push notifications and opens the app when one is
// tapped. It deliberately has no fetch handler and caches nothing, so the app
// always loads fresh from the network exactly as it did before.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let msg = {}
  try {
    msg = event.data ? event.data.json() : {}
  } catch {
    msg = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || 'Amaterasuu Noir Spades', {
      body: msg.body || '',
      icon: '/icon-192.png',
      badge: '/favicon-32.png',
      tag: msg.tag,
      renotify: !!msg.tag,
      data: { url: msg.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) {
        // The app picks this up and acts on it without reloading (src/lib/push.js).
        open.postMessage({ type: 'notification-open', url })
        return open.focus()
      }
      return self.clients.openWindow(url)
    })()
  )
})
