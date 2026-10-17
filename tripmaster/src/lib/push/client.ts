// This device's push subscription: creating it and keeping the server's copy in
// step. Browsers (iOS especially) can drop or replace a subscription without the
// app hearing about it, so the app re-sends it on every open — the server dedupes
// by endpoint. The worker side of this is 'pushsubscriptionchange' in public/sw.js.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

function vapidKey(): ArrayBuffer {
  const padding = '='.repeat((4 - (VAPID_PUBLIC_KEY.length % 4)) % 4);
  const raw     = window.atob((VAPID_PUBLIC_KEY + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0)).buffer as ArrayBuffer;
}

// A subscription made with a different key can't receive anything we send.
function matchesKey(sub: PushSubscription): boolean {
  const key = sub.options?.applicationServerKey;
  if (!key) return true;   // browser doesn't expose it — assume it's current
  const a = new Uint8Array(key);
  const b = new Uint8Array(vapidKey());
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// navigator.serviceWorker.ready never settles if registration failed — cap the wait.
export async function pushRegistration(timeoutMs = 10_000): Promise<ServiceWorkerRegistration | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));
}

async function save(sub: PushSubscription, oldEndpoint?: string): Promise<number> {
  const res = await fetch('/api/push/subscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ subscription: sub.toJSON(), oldEndpoint }),
  });
  if (res.status === 401) throw new Error('Signed out — sign in and try again');
  if (!res.ok) throw new Error('Couldn\'t reach the server — check your connection');
  const data = await res.json().catch(() => ({}));
  return typeof data.devices === 'number' ? data.devices : 0;
}

async function forget(endpoint: string): Promise<void> {
  await fetch('/api/push/subscribe', {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ endpoint }),
  }).catch(() => {});
}

/**
 * Makes sure the server has this device's current subscription, replacing one
 * made with an old key. `create` subscribes a device that has none; `fresh`
 * swaps the existing subscription for a brand-new one. Resolves to the number of
 * devices registered, or null when there's no subscription and `create` is off.
 */
export async function syncSubscription(
  reg: ServiceWorkerRegistration,
  { create = false, fresh = false } = {},
): Promise<number | null> {
  let sub = await reg.pushManager.getSubscription();
  let oldEndpoint: string | undefined;

  if (sub && (fresh || !matchesKey(sub))) {
    oldEndpoint = sub.endpoint;
    await sub.unsubscribe();
    sub = null;
  }

  if (!sub) {
    if (!create && !oldEndpoint) return null;
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey() });
    } catch (err) {
      // The old one is already unsubscribed — don't leave the server holding it.
      if (oldEndpoint) await forget(oldEndpoint);
      throw err;
    }
  }

  return save(sub, oldEndpoint);
}

export async function unsubscribeDevice(reg: ServiceWorkerRegistration): Promise<void> {
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await forget(endpoint);
}

/** App open: re-send this device's subscription (never creates one). */
export async function syncPushOnOpen(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted' || !navigator.onLine) return;
  const reg = await pushRegistration();
  if (!reg) return;
  // Signed out, offline, push service unreachable — the next open tries again.
  await syncSubscription(reg).catch(() => {});
}
