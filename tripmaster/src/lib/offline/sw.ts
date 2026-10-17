// Service worker registration + messaging. The worker itself is public/sw.js.

export const BUILD_ID = process.env.NODE_ENV === 'production'
  ? (process.env.NEXT_PUBLIC_BUILD_ID ?? '0')
  : 'dev';

// Where the worker keeps saved GET /api responses — must match DATA_CACHE in public/sw.js.
export const DATA_CACHE = 'tabiji-api-v1';

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    // A page opened from the offline cache can be an older build than the worker that
    // served it — registering that older build would roll the worker (and its caches) back.
    const existing    = await navigator.serviceWorker.getRegistration();
    const activeBuild = existing?.active ? new URL(existing.active.scriptURL).searchParams.get('v') : null;
    const isStalePage = activeBuild !== null && Number(activeBuild) > Number(BUILD_ID);
    if (!isStalePage) {
      await navigator.serviceWorker.register(`/sw.js?v=${BUILD_ID}`, { updateViaCache: 'none' });
    }
  } catch {
    return;   // blocked (private browsing, etc.) — the app still works online
  }

  // Ask the browser not to evict offline data under storage pressure (Firefox prompts for
  // this, so only when not already granted).
  navigator.storage?.persisted?.()
    .then(granted => { if (!granted) return navigator.storage.persist(); })
    .catch(() => {});

  // Chunks this page loaded before the worker took control (always the case on the very
  // first visit) never went through it — hand them over so they're saved too.
  const worker = await activeWorker();
  const urls   = performance.getEntriesByType('resource')
    .map(e => e.name)
    .filter(u => u.startsWith(`${location.origin}/_next/static/`));
  worker?.postMessage({ type: 'CACHE_ASSETS', urls });
}

export async function postToWorker<T>(message: object): Promise<T | null> {
  const worker = await activeWorker();
  if (!worker) return null;
  return new Promise<T | null>(resolve => {
    const channel = new MessageChannel();
    const finish  = (value: T | null) => { clearTimeout(timer); channel.port1.close(); resolve(value); };
    const timer   = setTimeout(() => finish(null), 120_000);
    channel.port1.onmessage = e => finish(e.data as T);
    worker.postMessage(message, [channel.port2]);
  });
}

// The worker that understands our messages. Right after a deploy the previous worker is
// still active while this build's installs, so wait for the new one to take over.
async function activeWorker(): Promise<ServiceWorker | null> {
  if (!('serviceWorker' in navigator)) return null;
  // navigator.serviceWorker.ready never settles if registration failed — cap the wait.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 10_000); }),
  ]).finally(() => clearTimeout(timer));
  if (!reg) return null;
  const incoming = reg.installing ?? reg.waiting;
  if (incoming) await activation(incoming, 60_000);
  const worker = reg.active;
  // Pre-versioning worker (registered as plain /sw.js) — it never replies to messages.
  if (!worker || !new URL(worker.scriptURL).searchParams.has('v')) return null;
  return worker;
}

function activation(worker: ServiceWorker, timeoutMs: number): Promise<void> {
  return new Promise(resolve => {
    const done  = () => { clearTimeout(timer); worker.removeEventListener('statechange', check); resolve(); };
    const check = () => { if (worker.state === 'activated' || worker.state === 'redundant') done(); };
    const timer = setTimeout(done, timeoutMs);
    worker.addEventListener('statechange', check);
    check();
  });
}
