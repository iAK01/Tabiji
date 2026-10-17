/* Tabiji service worker — offline model
 *
 *   /_next/static/*   cache-first, one cache per build (?v= on the registration URL)
 *   pages (HTML)      network-first with a short timeout, saved by pathname so every
 *                     ?tab= / ?day= variant opens the same saved page; versioned with
 *                     the build because each page references that build's chunks
 *   GET /api data     network-first with a timeout; survives deploys
 *   RSC fetches       network only — when they fail, Next.js falls back to a full page
 *                     load, which the page cache answers
 *   fonts, photos, /public files — cache-first / stale-while-revalidate
 *
 * The app saves trips ahead of time with postMessage({ type: 'WARM' }) — see
 * src/lib/offline/warm.ts — so nothing depends on having opened a page while online.
 */

const BUILD = new URL(self.location.href).searchParams.get('v') || '0';
const DEV   = BUILD === 'dev';

const STATIC_PREFIX = 'tabiji-static-';
const PAGES_PREFIX  = 'tabiji-pages-';
const STATIC_CACHE  = STATIC_PREFIX + BUILD;
const PAGES_CACHE   = PAGES_PREFIX + BUILD;
const DATA_CACHE    = 'tabiji-api-v1';      // same name as the previous worker's, so its saved data carries over
const ASSET_CACHE   = 'tabiji-assets-v1';
const IMAGE_CACHE   = 'tabiji-images-v1';
const LEGACY_CACHES = new Set(['tabiji-shell-v1']);

const IMAGE_LIMIT      = 150;
const DEV_STATIC_LIMIT = 400;

const OFFLINE_URL = '/offline.html';
const PRECACHE = [
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/fonts/ArchivoBlack-Regular.ttf',
];

// Dev server compiles on demand and can take far longer than these — no timeouts there.
const PAGE_TIMEOUT_MS  = DEV ? 0 : 4000;
const DATA_TIMEOUT_MS  = DEV ? 0 : 5000;
const RSC_TIMEOUT_MS   = DEV ? 0 : 6000;
const PROBE_TIMEOUT_MS = 3000;

// For a minute after any write, data reads give the network much longer before falling
// back to a saved copy, so a slow refetch right after a save doesn't show pre-save data.
// Still bounded: on dead "connected" wifi the write itself fails, and reads mustn't hang.
const WRITE_GRACE_MS      = 60_000;
const DATA_AFTER_WRITE_MS = DEV ? 0 : 15_000;
let lastWriteAt = 0;

const DATA_ROUTES  = ['/api/trips', '/api/user/', '/api/packing/', '/api/auth/session'];
const DATA_EXCLUDE = [/\/calendar$/, /\/expenses\/export$/, /\/delete-preview$/];
const FONT_HOSTS   = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const PHOTO_HOSTS  = new Set(['images.unsplash.com', 'storage.googleapis.com']);

// ── INSTALL ─────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const assets = await caches.open(ASSET_CACHE);
    await assets.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })));
    // Best effort: a new build is usable offline straight away, before the app warms anything.
    await warmPage('/dashboard').catch(() => {});
  })());
  self.skipWaiting();
});

// ── ACTIVATE ────────────────────────────────────
// Keeps this build plus the most recent other one, so pages saved under the previous
// deploy still open offline until this build has re-saved them.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names  = await caches.keys();
    const others = [...new Set(names.map(buildOf).filter((b) => b && b !== BUILD))]
      .sort((a, b) => Number(b) - Number(a));
    const keep = new Set([BUILD, others[0]]);
    await Promise.all(names
      .filter((n) => LEGACY_CACHES.has(n) || (buildOf(n) && !keep.has(buildOf(n))))
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// ── FETCH ────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url        = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.method !== 'GET') {
    if (sameOrigin && url.pathname.startsWith('/api/')) {
      lastWriteAt = Date.now();
      if (url.pathname === '/api/auth/signout') event.waitUntil(clearUserCaches());
    }
    return;
  }
  if (request.headers.has('range')) return;

  if (sameOrigin) {
    const path = url.pathname;
    if (path.startsWith('/_next/static/')) return respond(event, DEV ? devStatic(event) : staticAsset(event));
    if (path.startsWith('/_next/image'))   return respond(event, photo(event));
    if (path.startsWith('/_next/') || path.startsWith('/__next') || path === '/sw.js') return;
    if (path.startsWith('/api/')) {
      if (isDataRoute(path)) respond(event, data(event));
      return;
    }
    if (request.mode === 'navigate')   return respond(event, page(event));
    if (isRsc(request, url))           return respond(event, rsc(request));
    return respond(event, staleWhileRevalidate(event, ASSET_CACHE));
  }

  if (FONT_HOSTS.has(url.hostname)) return respond(event, cacheFirst(event, ASSET_CACHE));
  if (PHOTO_HOSTS.has(url.hostname) && request.destination === 'image') return respond(event, photo(event));
  // Everything else cross-origin (Mapbox, weather, analytics…) goes straight to the network.
});

// Registers the response promise as a lifetime promise too, so handlers can hand later
// cache writes to event.waitUntil while the response is still pending.
function respond(event, promise) {
  event.respondWith(promise);
  event.waitUntil(promise.then(() => {}, () => {}));
}

// ── Strategies ───────────────────────────────────

function page(event) {
  const url = new URL(event.request.url);
  const key = url.origin + url.pathname;
  return networkFirst(event, {
    cacheName: PAGES_CACHE,
    key,
    timeoutMs: PAGE_TIMEOUT_MS,
    keep:   (res) => res.status === 200 && res.type === 'basic' && !res.redirected && isHtml(res),
    // Auth redirects come back as opaqueredirect (navigations use redirect: 'manual') — pass them on.
    usable: (res) => res.type === 'opaqueredirect' || (res.status < 500 && !res.redirected),
    lookup: () => matchPage(key),
    fallback: () => matchIn(ASSET_CACHE, OFFLINE_URL).then((hit) => hit || Response.error()),
  });
}

function data(event) {
  const key = event.request.url;
  return networkFirst(event, {
    cacheName: DATA_CACHE,
    key,
    timeoutMs: Date.now() - lastWriteAt < WRITE_GRACE_MS ? DATA_AFTER_WRITE_MS : DATA_TIMEOUT_MS,
    keep:   isJson200,
    // A 200 that isn't JSON is a wifi login page or similar, not our API.
    usable: (res) => res.status < 500 && !res.redirected && (res.status !== 200 || isJson200(res)),
    lookup: () => matchIn(DATA_CACHE, key),
    // Nothing saved: fail the fetch like a dropped connection, which every caller already handles.
    fallback: () => Response.error(),
  });
}

// Next.js client navigations. Not cached — a failed or stalled one makes Next.js fall back
// to a full page load, which page() answers from the saved copy.
function rsc(request) {
  if (isOffline()) return Promise.resolve(Response.error());
  const network = fetch(request).then(
    (res) => { reportNetwork(true); return res; },
    () => { reportNetwork(false); return Response.error(); },
  );
  if (!RSC_TIMEOUT_MS) return network;
  return Promise.race([
    network,
    new Promise((resolve) => setTimeout(() => { probeNetwork(); resolve(Response.error()); }, RSC_TIMEOUT_MS)),
  ]);
}

async function staticAsset(event) {
  const key = event.request.url;
  const hit = (await matchIn(STATIC_CACHE, key)) || (await matchAcross(STATIC_PREFIX, key));
  if (hit) return hit;
  const res = await fetch(event.request).catch(() => { reportNetwork(false); return null; });
  if (!res) return Response.error();
  if (res.status === 200 && res.type === 'basic') {
    const copy = res.clone();
    event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.put(key, copy)).catch(() => {}));
  }
  return res;
}

// Dev chunk names aren't content-hashed, so the network always wins; the cache only
// answers when offline (handy for testing offline locally).
function devStatic(event) {
  const key = event.request.url;
  return networkFirst(event, {
    cacheName: STATIC_CACHE,
    key,
    timeoutMs: 0,
    keep:   (res) => res.status === 200 && res.type === 'basic',
    usable: (res) => res.status < 500,
    lookup: () => matchIn(STATIC_CACHE, key),
    fallback: () => Response.error(),
    onSaved: () => trim(STATIC_CACHE, DEV_STATIC_LIMIT),
  });
}

async function cacheFirst(event, cacheName) {
  const key = event.request.url;
  const hit = await matchIn(cacheName, key);
  if (hit) return hit;
  const res = await fetch(event.request).catch(() => null);
  if (!res) return Response.error();
  if (res.ok || res.type === 'opaque') {
    const copy = res.clone();
    event.waitUntil(caches.open(cacheName).then((c) => c.put(key, copy)).catch(() => {}));
  }
  return res;
}

async function staleWhileRevalidate(event, cacheName) {
  const key   = event.request.url;
  const hit   = await matchIn(cacheName, key);
  const fresh = fetch(event.request).then((res) => {
    if (res.status === 200 && res.type === 'basic') {
      const copy = res.clone();
      event.waitUntil(caches.open(cacheName).then((c) => c.put(key, copy)).catch(() => {}));
    }
    return res;
  });
  if (hit) {
    event.waitUntil(fresh.catch(() => {}));
    return hit;
  }
  return fresh.catch(() => Response.error());
}

// Trip cover photos and uploaded images. A plain <img> fetch comes back opaque, which
// can't be checked and costs megabytes of quota per entry — re-request in CORS mode
// (both photo hosts allow it) and only save what comes back readable.
async function photo(event) {
  const req = event.request;
  const key = req.url;
  const hit = await matchIn(IMAGE_CACHE, key);
  if (hit) return hit;
  const sameOrigin = new URL(key).origin === self.location.origin;
  const res = await (sameOrigin
    ? fetch(req)
    : fetch(key, { mode: 'cors', credentials: 'omit' }).catch(() => fetch(req))
  ).catch(() => null);
  if (!res) return Response.error();
  if (res.status === 200 && res.type !== 'opaque') {
    const copy = res.clone();
    event.waitUntil(caches.open(IMAGE_CACHE)
      .then((c) => c.put(key, copy))
      .then(() => trim(IMAGE_CACHE, IMAGE_LIMIT))
      .catch(() => {}));
  }
  return res;
}

// Network-first. The network answer wins if it arrives within timeoutMs (or nothing is
// saved to fall back on); otherwise the saved copy is served while the late network
// response still lands in the cache for next time. `keep` decides what gets saved,
// `usable` whether a network answer beats the saved copy (a 503 doesn't).
function networkFirst(event, { cacheName, key, timeoutMs, keep, usable, lookup, fallback, onSaved }) {
  if (isOffline()) return lookup().then((hit) => hit || fallback());

  let saving = Promise.resolve();
  const network = fetch(event.request).then((res) => {
    reportNetwork(true);
    if (keep(res)) {
      const copy = res.clone();
      saving = caches.open(cacheName)
        .then((c) => c.put(key, copy))
        .then(() => onSaved && onSaved())
        .catch(() => {});
    }
    return res;
  });
  event.waitUntil(network.then(() => saving, () => reportNetwork(false)));
  return settle(network, lookup, timeoutMs, usable, fallback);
}

const TIMED_OUT = Symbol('timed out');

async function settle(network, lookup, timeoutMs, usable, fallback) {
  let timer;
  const timeout = timeoutMs > 0
    ? new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs, TIMED_OUT); })
    : new Promise(() => {});
  try {
    const first = await Promise.race([network, timeout]);
    if (first === TIMED_OUT) probeNetwork();
    if (first !== TIMED_OUT && usable(first)) return first;
    const hit = await lookup();
    if (hit) return hit;
    if (first !== TIMED_OUT) return first;
    return await network;                       // timed out with nothing saved — keep waiting
  } catch {
    return (await lookup()) || fallback();
  } finally {
    clearTimeout(timer);
  }
}

// ── Warming (messages from the app) ──────────────

self.addEventListener('message', (event) => {
  const msg   = event.data || {};
  const reply = (value) => event.ports[0] && event.ports[0].postMessage(value);
  if (msg.type === 'WARM') {
    event.waitUntil(warm(msg).then(reply, () => reply({ saved: 0, failed: -1, pagesFailed: -1 })));
  } else if (msg.type === 'CACHE_ASSETS') {
    // Chunks the page loaded before this worker controlled it.
    event.waitUntil(cacheStatic(msg.urls || []).catch(() => {}));
  }
});

async function warm({ pages = [], data = [] }) {
  const tasks = [
    ...pages.map((p) => () => warmPage(p)),
    ...data.map((u) => () => warmData(u)),
  ];
  if (isOffline()) return { saved: 0, failed: tasks.length, pagesFailed: pages.length };
  const results = await mapLimit(tasks, 4);
  const saved   = results.filter(Boolean).length;
  if (DEV) await trim(STATIC_CACHE, DEV_STATIC_LIMIT);
  return {
    saved,
    failed:      results.length - saved,
    pagesFailed: results.slice(0, pages.length).filter((ok) => !ok).length,
  };
}

// Saves a page's HTML plus every chunk/stylesheet it references. Already-saved pages
// (same build = same HTML) just get their assets re-checked, which only fetches gaps.
async function warmPage(path) {
  const url   = new URL(path, self.location.origin);
  const key   = url.origin + url.pathname;
  const cache = await caches.open(PAGES_CACHE);
  const saved = await cache.match(key);
  if (saved) return cacheStatic(assetUrlsIn(await saved.text()));

  const res = await fetch(key, { credentials: 'same-origin', headers: { Accept: 'text/html' } });
  if (!(res.status === 200 && !res.redirected && isHtml(res))) return false;   // e.g. signed out → /signin
  const html = await res.clone().text();
  const ok   = await cacheStatic(assetUrlsIn(html));
  await cache.put(key, res);
  return ok;
}

async function warmData(path) {
  const key = new URL(path, self.location.origin).href;
  const res = await fetch(key, { credentials: 'same-origin', cache: 'no-store' });
  if (!isJson200(res)) return false;
  await (await caches.open(DATA_CACHE)).put(key, res);
  return true;
}

async function cacheStatic(urls) {
  const prefix  = self.location.origin + '/_next/static/';
  const cache   = await caches.open(STATIC_CACHE);
  const results = await mapLimit([...new Set(urls)].map((u) => async () => {
    const key = new URL(u, self.location.origin).href;
    if (!key.startsWith(prefix)) return true;
    if (await cache.match(key)) return true;
    const res = await fetch(key);
    if (res.status !== 200) return false;
    // Fonts and images referenced from inside stylesheets never appear in the HTML.
    const nested = key.endsWith('.css') ? cssUrlsIn(await res.clone().text(), key) : [];
    await cache.put(key, res);
    return nested.length ? cacheStatic(nested) : true;
  }), 6);
  return results.every(Boolean);
}

// url(...) references in a stylesheet, resolved against it (they're usually ../media/…).
// Inline data: URIs go first — SVGs inside them have their own url(#id) references
// (Mapbox's logo does), which would otherwise resolve to bogus paths that 404.
function cssUrlsIn(css, base) {
  const out = [];
  const stripped = css.replace(/url\(\s*(?:"data:[^"]*"|'data:[^']*'|data:[^)]*)\s*\)/g, '');
  for (const m of stripped.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    if (m[2].startsWith('#') || m[2].startsWith('%23')) continue;
    try { out.push(new URL(m[2], base).href); } catch { /* unparseable — skip */ }
  }
  return out;
}

// /_next/static paths in a page's HTML: <script>/<link> tags plus the chunk lists in the
// inlined RSC payload, which appear as "static/chunks/…" without the /_next/ prefix.
function assetUrlsIn(text) {
  const out = new Set();
  for (const m of text.matchAll(/(?:\/_next\/)?static\/(?:chunks|css|media)\/[^"'\\\s<>()]+/g)) {
    out.add(m[0].startsWith('/_next/') ? m[0] : '/_next/' + m[0]);
  }
  return [...out];
}

// ── Connectivity reports (src/lib/offline/connectivity.ts) ──
// Pages use these to queue writes instead of attempting them on wifi that's connected but
// not getting through. "Down" goes out on every failure; "up" only when that changes.

let networkUp = true;
let probing   = null;

function reportNetwork(up) {
  if (up && networkUp) return;
  networkUp = up;
  self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((list) => list.forEach((client) => client.postMessage({ type: 'NETWORK', up })))
    .catch(() => {});
}

// A request outran its timeout: slow server, or no connection? A static file answers fast
// whenever the network works, so check that before telling pages they're offline.
function probeNetwork() {
  if (probing) return probing;
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  probing = fetch('/manifest.json', { method: 'HEAD', cache: 'no-store', signal: ctrl.signal })
    .then(() => reportNetwork(true), () => reportNetwork(false))
    .finally(() => { clearTimeout(timer); probing = null; });
  return probing;
}

// ── Helpers ──────────────────────────────────────

function isOffline() {
  return self.navigator && self.navigator.onLine === false;
}

function isRsc(request, url) {
  return request.headers.get('RSC') === '1' || url.searchParams.has('_rsc');
}

function isDataRoute(path) {
  return DATA_ROUTES.some((r) => path === r || path.startsWith(r.endsWith('/') ? r : r + '/'))
    && !DATA_EXCLUDE.some((re) => re.test(path));
}

function isHtml(res) {
  return (res.headers.get('content-type') || '').includes('text/html');
}

function isJson200(res) {
  return res.status === 200 && !res.redirected
    && (res.headers.get('content-type') || '').includes('application/json');
}

function buildOf(name) {
  if (name.startsWith(STATIC_PREFIX)) return name.slice(STATIC_PREFIX.length);
  if (name.startsWith(PAGES_PREFIX))  return name.slice(PAGES_PREFIX.length);
  return null;
}

async function matchIn(cacheName, key) {
  const cache = await caches.open(cacheName);
  return cache.match(key, { ignoreVary: true });
}

// Newest build first — used to fall back on the previous deploy's saved copies.
async function matchAcross(prefix, key) {
  const names = (await caches.keys())
    .filter((n) => n.startsWith(prefix))
    .sort((a, b) => Number(b.slice(prefix.length)) - Number(a.slice(prefix.length)));
  for (const name of names) {
    const hit = await matchIn(name, key);
    if (hit) return hit;
  }
  return undefined;
}

async function matchPage(key) {
  return (await matchIn(PAGES_CACHE, key)) || matchAcross(PAGES_PREFIX, key);
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys  = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

async function mapLimit(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      try { results[i] = await tasks[i](); } catch { results[i] = false; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// Signing out wipes saved personal data so the next person on this device can't read it offline.
async function clearUserCaches() {
  const names = await caches.keys();
  await Promise.all(names
    .filter((n) => n === DATA_CACHE || n === IMAGE_CACHE || n.startsWith(PAGES_PREFIX))
    .map((n) => caches.delete(n)));
}

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
// Payload: { title, body, url, tag?, requireInteraction?, actions?, badgeCount? }
// — built by src/lib/push/send.ts. Action buttons only show on Android/desktop.
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Tabiji', body: event.data.text(), url: '/dashboard' };
  }

  const actions = Array.isArray(data.actions) ? data.actions : [];
  const options = {
    body:    data.body    ?? '',
    icon:    data.icon    ?? '/icons/icon-192.png',
    badge:   data.badge   ?? '/icons/badge-72.png',
    tag:     data.tag     ?? 'tabiji-default',
    // A notification replacing an earlier one with the same tag still alerts.
    renotify: !!data.tag,
    data: {
      url:     data.url ?? '/dashboard',
      actions: Object.fromEntries(actions.map((a) => [a.action, { url: a.url, complete: a.complete }])),
    },
    requireInteraction: data.requireInteraction ?? false,
    actions: actions.map((a) => ({ action: a.action, title: a.title })),
  };

  const badge = typeof data.badgeCount === 'number' && self.navigator.setAppBadge
    ? self.navigator.setAppBadge(data.badgeCount).catch(() => {})
    : Promise.resolve();

  event.waitUntil(Promise.all([
    self.registration.showNotification(data.title ?? 'Tabiji', options),
    badge,
  ]));
});

// ── NOTIFICATION CLICK ───────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data   = event.notification.data || {};
  const action = event.action && data.actions ? data.actions[event.action] : null;

  event.waitUntil((async () => {
    // "Done" on a to-do: tick it off without opening anything. Offline or
    // failed → open the to-do instead, so it isn't silently lost.
    if (action && action.complete) {
      const done = await fetch(action.complete, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body:        JSON.stringify({ completed: true }),
      }).then((res) => res.ok, () => false);
      if (done) return;
    }

    const url = new URL((action && action.url) || data.url || '/dashboard', self.location.origin);

    // Maps directions, venue websites, airline check-in: open them in their own
    // app or browser instead of navigating the app's window away.
    if (url.origin !== self.location.origin) return clients.openWindow(url.href);

    // App already open: it switches to the right place itself (instant, and
    // works offline). A page that doesn't answer gets a plain navigation.
    // navigate() only works on windows this worker controls, so ask for those.
    for (const client of await clients.matchAll({ type: 'window' })) {
      try {
        await client.focus();
        if (await askToOpen(client, url.pathname + url.search)) return;
        await client.navigate(url.href);
        return;
      } catch { /* try the next window, or open a new one */ }
    }
    return clients.openWindow(url.href);
  })());
});

// Asks an open page to show `url` (src/lib/push/client.ts listenForNotificationOpens).
function askToOpen(client, url) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer   = setTimeout(() => resolve(false), 1000);
    channel.port1.onmessage = (e) => { clearTimeout(timer); resolve(!!(e.data && e.data.opened)); };
    client.postMessage({ type: 'OPEN_URL', url }, [channel.port2]);
  });
}

// ── SUBSCRIPTION CHANGE ──────────────────────────
// The push service replaced or expired this device's subscription. Re-subscribe
// with the same key and tell the server so reminders keep arriving without the
// app being opened first (opening it re-syncs too — src/lib/push/client.ts).
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const old = event.oldSubscription;
    const sub = event.newSubscription
      || (old && old.options && await self.registration.pushManager.subscribe(old.options));
    if (!sub) return;
    await fetch('/api/push/subscribe', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body:        JSON.stringify({ subscription: sub.toJSON(), oldEndpoint: old ? old.endpoint : undefined }),
    });
  })().catch(() => {}));
});
