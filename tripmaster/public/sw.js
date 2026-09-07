const CACHE_NAME = 'tabiji-shell-v1';
const API_CACHE  = 'tabiji-api-v1';

const SHELL_FILES = [
  '/',
  '/dashboard',
  '/manifest.json'
];

// ── INSTALL ─────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_FILES);
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE ────────────────────────────────────
self.addEventListener('activate', (event) => {
  const KEEP = new Set([CACHE_NAME, API_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter(k => !KEEP.has(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Trip API routes — network-first, cache on success, serve cache when offline.
  // This makes itinerary, logistics, packing, files, and trip metadata available offline.
  if (url.pathname.startsWith('/api/trips/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            caches.open(API_CACHE).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // All other API routes — network only, no caching (auth, push, etc.)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Shell / app files — network first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Background Sync ('sync' event / processQueue) intentionally removed — it opened
// IndexedDB at a hardcoded version 1 while the app's real DB is at version 4, which
// throws a VersionError on every invocation (per the IndexedDB spec, opening at a
// lower version than the existing database always fails), so it never actually ran.
// It also only knew how to replay one action shape (a raw PUT to /api/trips/:id).
// Queue replay now happens in-app via flushQueue() (src/lib/offline/db.ts), triggered
// on page load and on the browser's 'online' event — universal (works on iOS Safari,
// which doesn't support Background Sync at all) and correctly dispatches every
// queued action type instead of just one.

// ── PUSH ─────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Tabiji', body: event.data.text(), url: '/dashboard' };
  }

  const options = {
    body:    data.body    ?? '',
    icon:    data.icon    ?? '/icons/icon-192.png',
    badge:   data.badge   ?? '/icons/badge-72.png',
    tag:     data.tag     ?? 'tabiji-default',
    data:    { url: data.url ?? '/dashboard' },
    requireInteraction: data.requireInteraction ?? false,
    actions: data.actions ?? [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Tabiji', options)
  );
});

// ── NOTIFICATION CLICK ───────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url ?? '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
