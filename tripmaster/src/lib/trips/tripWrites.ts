// Every change to a trip's data, wherever on the page it's made. The trip page keeps
// the tabs you've opened loaded and only reloads one when something it shows may
// have changed since — this is how it knows.
//
// Sent changes are seen at fetch itself, so no save path can be missed; changes
// queued offline are reported by sendOrQueue (lib/offline/writes.ts), and their
// later replay is a fetch like any other.

const EVENT = 'tabiji:trip-write';

// Lookups that go out as POST but change nothing
const NOT_WRITES = new Set(['geocode', 'analyze-document']);

interface Detail { tripId: string; startedAt: number }

export function noteTripWrite(tripId: string | undefined, startedAt = Date.now()) {
  if (!tripId || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<Detail>(EVENT, { detail: { tripId, startedAt } }));
}

// `startedAt`: when the change was sent, so the listener can tell which screen made it.
export function onTripWrite(tripId: string, listener: (startedAt: number) => void): () => void {
  watchFetch();
  const handle = (e: Event) => {
    const { detail } = e as CustomEvent<Detail>;
    if (detail.tripId === tripId) listener(detail.startedAt);
  };
  window.addEventListener(EVENT, handle);
  return () => window.removeEventListener(EVENT, handle);
}

let watching = false;

function watchFetch() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  const send = window.fetch;
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const startedAt = Date.now();
    const sent      = send.call(window, input, init);
    const tripId    = writtenTrip(input, init);
    if (tripId) sent.then(res => { if (res.ok) noteTripWrite(tripId, startedAt); }, () => {});
    return sent;
  }) as typeof fetch;
}

function writtenTrip(input: RequestInfo | URL, init?: RequestInit): string | null {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method === 'GET' || method === 'HEAD') return null;
  let path: string;
  try {
    path = new URL(input instanceof Request ? input.url : String(input), window.location.origin).pathname;
  } catch {
    return null;
  }
  const m = /^\/api\/trips\/([^/]+)(?:\/([^/]+))?/.exec(path);
  if (!m || NOT_WRITES.has(m[2] ?? '')) return null;
  return m[1];
}
