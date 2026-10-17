import { BUILD_ID, postToWorker } from './sw';
import { autoCacheTripFiles } from './fileCache';
import { isOffline } from './connectivity';

// Saves what the app needs to open offline ahead of time, so nothing depends on having
// visited a page or tab while online. TRIP_DATA must list every GET the trip page's tabs
// make on load — add to it when a tab gains a new data source.
const APP_PAGES = ['/dashboard', '/trips/new', '/profile', '/packing/catalogue'];
const APP_DATA  = [
  '/api/auth/session',
  '/api/trips',
  '/api/user/profile',
  '/api/user/my-apps',
  '/api/user/navigation-preferences',
  '/api/packing/catalogue',
];
const TRIP_DATA = [
  '', '/itinerary', '/logistics', '/files', '/packing', '/expenses',
  '/transport', '/weather', '/intelligence', '/culture',
];

const DAY_MS       = 86_400_000;
const REWARM_MS    = 15 * 60_000;
const MAX_TRIPS    = 15;
const FILES_WITHIN = 30 * DAY_MS;   // attached documents are downloaded for trips starting this soon

interface WarmableTrip { _id: string; status?: string; startDate?: string; endDate?: string }
interface Scope        { key: string; pages: string[]; data: string[] }
interface WarmResult   { saved: number; failed: number; pagesFailed: number }

const inFlight = new Set<string>();

// One trip — its page and every tab's data. Called whenever a trip is opened.
export async function warmTrip(tripId: string) {
  await warmScopes([appScope(), tripScope(tripId)]);
}

// Every current and upcoming trip, plus attached documents for the ones coming up soon.
export async function warmTrips(trips: WarmableTrip[]) {
  const now  = Date.now();
  const keep = trips
    .filter(t => !isPendingTrip(t) && t.status !== 'cancelled' &&
      (!t.endDate || new Date(t.endDate).getTime() >= now - 14 * DAY_MS))
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
    .slice(0, MAX_TRIPS);

  const warmed = await warmScopes([appScope(), ...keep.map(t => tripScope(t._id))]);

  const soon = keep.filter(t =>
    warmed.has(`trip:${t._id}`) && (!t.startDate || new Date(t.startDate).getTime() - now < FILES_WITHIN));
  for (const t of soon) {
    try {
      const res  = await fetch(`/api/trips/${t._id}/files`);
      const data = await res.json();
      await autoCacheTripFiles(t._id, data.files ?? []);
    } catch { /* next round */ }
  }
}

// After a write lands (directly or replayed from the queue), re-save that trip's data so
// the offline copy matches the server — including server-side knock-ons, like logistics
// mirrored into the itinerary — and replaces any optimistic placeholders. Debounced so a
// burst of edits costs one refresh.
const REFRESH_DEBOUNCE_MS = 2000;
const pendingRefresh = new Map<string, ReturnType<typeof setTimeout>>();

export function refreshSavedData(tripId?: string) {
  const key = tripId ?? 'list';
  clearTimeout(pendingRefresh.get(key));
  pendingRefresh.set(key, setTimeout(() => {
    pendingRefresh.delete(key);
    if (isOffline()) return;
    const data = tripId ? [...tripScope(tripId).data, '/api/trips'] : ['/api/trips'];
    postToWorker({ type: 'WARM', pages: [], data }).catch(() => {});
  }, REFRESH_DEBOUNCE_MS));
}

function appScope(): Scope {
  return { key: 'app', pages: APP_PAGES, data: APP_DATA };
}

function tripScope(tripId: string): Scope {
  return {
    key:   `trip:${tripId}`,
    pages: [`/trips/${tripId}`],
    data:  TRIP_DATA.map(suffix => `/api/trips/${tripId}${suffix}`),
  };
}

// Warms each scope not saved within REWARM_MS under this build; returns the keys it saved.
async function warmScopes(scopes: Scope[]): Promise<Set<string>> {
  const warmed = new Set<string>();
  if (isOffline()) return warmed;
  for (const scope of scopes) {
    if (inFlight.has(scope.key) || isFresh(scope.key)) continue;
    inFlight.add(scope.key);
    try {
      const result = await postToWorker<WarmResult>({ type: 'WARM', pages: scope.pages, data: scope.data });
      if (result && result.pagesFailed === 0 && result.saved > 0) {
        markWarmed(scope.key);
        warmed.add(scope.key);
      }
    } finally {
      inFlight.delete(scope.key);
    }
  }
  return warmed;
}

// Created offline, not on the server yet — nothing to save.
function isPendingTrip(t: WarmableTrip) {
  return t._id.startsWith('pending-');
}

function storageKey(key: string) { return `tabiji-offline:${key}`; }

function isFresh(key: string): boolean {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return false;
    const { build, at } = JSON.parse(raw);
    return build === BUILD_ID && Date.now() - at < REWARM_MS;
  } catch {
    return false;
  }
}

function markWarmed(key: string) {
  try { localStorage.setItem(storageKey(key), JSON.stringify({ build: BUILD_ID, at: Date.now() })); }
  catch { /* storage blocked — just re-warms next time */ }
}
