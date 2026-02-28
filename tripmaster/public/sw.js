const CACHE_NAME = 'tabiji-shell-v1';
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
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never cache API routes — always go to network, fall back to nothing
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Shell files — network first, fall back to cache
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

// ── BACKGROUND SYNC ─────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'tabiji-sync') {
    event.waitUntil(processQueue());
  }
});

async function processQueue() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('tabiji-offline', 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const tx = db.transaction('queue', 'readwrite');
  const store = tx.objectStore('queue');
  const getAllReq = store.getAll();

  const actions = await new Promise((resolve) => {
    getAllReq.onsuccess = () => resolve(getAllReq.result);
  });

  for (const action of actions) {
    try {
      await fetch(`/api/trips/${action.tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.payload),
      });
    } catch {
      return;
    }
  }

  store.clear();
}

// ── PUSH ─────────────────────────────────────────
// Receives push payloads from the server and shows a notification
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
    // Keep notification visible until user interacts
    requireInteraction: data.requireInteraction ?? false,
    actions: data.actions ?? [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Tabiji', options)
  );
});

// ── NOTIFICATION CLICK ───────────────────────────
// Tapping a notification opens the PWA at the right URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url ?? '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If the app is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});