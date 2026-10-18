'use client';

// A trip's live flight status for any screen that shows a flight. One shared
// copy per trip: every screen using it gets the same answer and one request.
// Polls while a flight is in its live window (the day before departure until
// after landing); offline, the saved copy of the GET answers.

import { useEffect, useState } from 'react';
import type { FlightStatus } from './status';

export type Flights = Record<number, FlightStatus>;

const FRESH_MS = 90_000;
const POLL_MS  = 2 * 60_000;
const HOUR     = 3_600_000;

interface Entry { flights: Flights; at: number; loading: Promise<void> | null; subs: Set<(f: Flights) => void> }

const entries = new Map<string, Entry>();

function entryFor(tripId: string): Entry {
  let e = entries.get(tripId);
  if (!e) entries.set(tripId, e = { flights: {}, at: 0, loading: null, subs: new Set() });
  return e;
}

function load(tripId: string): Promise<void> {
  const e = entryFor(tripId);
  if (e.loading) return e.loading;
  if (Date.now() - e.at < FRESH_MS) return Promise.resolve();
  e.loading = (async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/flights`);
      if (!res.ok) return;
      const data = await res.json();
      e.flights = data.flights ?? {};
      e.at      = Date.now();
      e.subs.forEach(s => s(e.flights));
    } catch { /* offline with nothing saved — screens show the booking alone */ }
    finally { e.loading = null; }
  })();
  return e.loading;
}

function anyLive(flights: Flights, now = Date.now()): boolean {
  return Object.values(flights).some(fs => {
    const dep = Date.parse(fs.dep.scheduled ?? '');
    const arr = Date.parse(fs.arr.revised ?? fs.arr.scheduled ?? '') || dep + 6 * HOUR;
    return now >= dep - 26 * HOUR && now <= arr + 2 * HOUR;
  });
}

export function useFlights(tripId: string | null | undefined): Flights {
  const [flights, setFlights] = useState<Flights>(() => (tripId ? entries.get(tripId)?.flights : null) ?? {});

  useEffect(() => {
    if (!tripId) { setFlights({}); return; }
    const e = entryFor(tripId);
    setFlights(e.flights);
    e.subs.add(setFlights);
    load(tripId);
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible' && anyLive(e.flights)) load(tripId);
    }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(tripId); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      e.subs.delete(setFlights);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [tripId]);

  return flights;
}
