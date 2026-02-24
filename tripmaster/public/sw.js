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
  event.waitUntil(self.clients.claim());
});

// ── FETCH (network first) ──────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

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
  const db = await self.indexedDB.open('tabiji-offline');
  return new Promise((resolve) => {
    db.onsuccess = async () => {
      const database = db.result;
      const tx = database.transaction('queue', 'readwrite');
      const store = tx.objectStore('queue');
      const getAll = store.getAll();

      getAll.onsuccess = async () => {
        const actions = getAll.result;

        for (const action of actions) {
          try {
            await fetch(`/api/${action.type}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(action.payload),
            });
          } catch {
            return;
          }
        }

        store.clear();
        resolve();
      };
    };
  });
}