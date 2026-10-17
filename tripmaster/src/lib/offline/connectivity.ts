// Whether there's a connection that actually works. navigator.onLine alone isn't enough: on
// plane/hotel wifi with no internet it stays true while every request fails or hangs. The
// service worker reports what it sees (public/sw.js → reportNetwork), writes that fail mark
// the network down here, and while down a lightweight probe checks for recovery.

type Listener = () => void;

const PROBE_EVERY_MS   = 20_000;
const PROBE_TIMEOUT_MS = 8_000;

let networkDown = false;
let started     = false;
let probeTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<Listener>();

export function isOffline(): boolean {
  start();
  return !navigator.onLine || networkDown;
}

export function markNetworkDown() {
  start();
  setNetworkDown(true);
}

export function subscribeConnectivity(listener: Listener): () => void {
  start();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  navigator.serviceWorker?.addEventListener('message', e => {
    if (e.data?.type === 'NETWORK') setNetworkDown(!e.data.up);
  });
  // A real reconnect clears any "connected but not working" state too.
  window.addEventListener('online',  () => { networkDown = false; stopProbe(); emit(); });
  window.addEventListener('offline', emit);
}

function setNetworkDown(down: boolean) {
  if (down === networkDown) return;
  networkDown = down;
  if (down) startProbe(); else stopProbe();
  emit();
}

function emit() {
  listeners.forEach(l => l());
}

// HEAD isn't intercepted by the service worker (it only handles GET), so this reaches the
// real network rather than a saved copy. Any answer at all means the server is reachable.
function startProbe() {
  if (probeTimer) return;
  probeTimer = setInterval(async () => {
    if (!navigator.onLine) return;
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    try {
      await fetch('/manifest.json', { method: 'HEAD', cache: 'no-store', signal: ctrl.signal });
      setNetworkDown(false);
    } catch {
      // still down
    } finally {
      clearTimeout(timer);
    }
  }, PROBE_EVERY_MS);
}

function stopProbe() {
  if (probeTimer) clearInterval(probeTimer);
  probeTimer = null;
}
