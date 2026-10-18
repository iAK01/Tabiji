// AeroDataBox (via RapidAPI) flight status lookups. Server only — the key never
// leaves it. Free plan: 400 units a month, 2 per lookup, so lib/flights/live.ts
// asks only when something can have changed.

import type { FlightEnd, FlightStatus, ProviderStatus } from './status';

const HOST       = 'aerodatabox.p.rapidapi.com';
const TIMEOUT_MS = 8000;

export interface Lookup {
  status:    Omit<FlightStatus, 'gates' | 'gateSince' | 'beltSince'> | null;  // null: no such flight that day
  unitsLeft: number | null;
}

export function hasFlightDataKey(): boolean {
  return !!process.env.AERODATABOX_KEY;
}

// "2026-10-19 05:05Z" → ISO
function iso(t: any): string | null {
  const raw = t?.utc;
  if (typeof raw !== 'string') return null;
  const d = new Date(raw.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function end(m: any): FlightEnd {
  return {
    iata:      m?.airport?.iata ?? null,
    zone:      m?.airport?.timeZone ?? null,
    terminal:  m?.terminal ?? null,
    gate:      m?.gate ?? null,
    desk:      m?.checkInDesk ?? null,
    belt:      m?.baggageBelt ?? null,
    scheduled: iso(m?.scheduledTime),
    revised:   iso(m?.revisedTime),
    runway:    iso(m?.runwayTime),
    predicted: iso(m?.predictedTime),
    live:      Array.isArray(m?.quality) && m.quality.includes('Live'),
  };
}

/** One flight on one local departure date. `fromIata` picks the right one when the number flies twice that day. */
export async function lookupFlight(number: string, date: string, fromIata: string | null): Promise<Lookup> {
  const key = process.env.AERODATABOX_KEY;
  if (!key) throw new Error('AERODATABOX_KEY is not set');

  const url = `https://${HOST}/flights/number/${encodeURIComponent(number)}/${date}`
    + '?withAircraftImage=false&withLocation=false&dateLocalRole=Departure';
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': HOST }, signal: ctrl.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }

  const left      = Number(res.headers.get('x-ratelimit-api-units-remaining'));
  const unitsLeft = Number.isFinite(left) && res.headers.has('x-ratelimit-api-units-remaining') ? left : null;
  if (res.status === 204 || res.status === 404) return { status: null, unitsLeft };
  if (!res.ok) throw new Error(`AeroDataBox ${res.status}`);

  const list: any[] = await res.json().catch(() => []);
  const match = (Array.isArray(list) ? list : []).sort((a, b) =>
    Number(b?.departure?.airport?.iata === fromIata) - Number(a?.departure?.airport?.iata === fromIata) ||
    Number(b?.codeshareStatus === 'IsOperator') - Number(a?.codeshareStatus === 'IsOperator'))[0];
  if (!match) return { status: null, unitsLeft };

  return {
    unitsLeft,
    status: {
      number:    match.number ?? number,
      date,
      status:    (match.status ?? 'Unknown') as ProviderStatus,
      dep:       end(match.departure),
      arr:       end(match.arrival),
      checkedAt: new Date().toISOString(),
    },
  };
}
