'use client';

import { useEffect, useState } from 'react';
import { haversineKm } from '@/lib/geo/geocode';
import { isOffline } from '@/lib/offline/connectivity';
import type { TravelTimes } from '@/lib/geo/travelTimes';
import type { NavigationDestination } from '@/lib/navigation/links';

type LatLng = { lat: number; lng: number };

/** Where times start when you're not near the place yet (the stop before, your hotel). */
export interface TravelOrigin { name: string; coordinates: LatLng }

/** Further than this from the place, "from where you are now" isn't useful — use the fallback. */
const NEAR_KM      = 100;
/** Closer than this, the fallback is the place itself. */
const SAME_PLACE_KM = 0.05;
const CLIENT_CACHE_MS = 3 * 60_000;   // transit departure times go stale fast
const answers = new Map<string, { times: TravelTimes; at: number }>();

async function currentPosition(): Promise<LatLng | null> {
  if (!('geolocation' in navigator)) return null;
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    if (p?.state === 'denied') return null;
  } catch { /* no Permissions API — just ask */ }
  return new Promise(resolve => navigator.geolocation.getCurrentPosition(
    pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => resolve(null),
    { enableHighAccuracy: false, timeout: 8_000, maximumAge: 5 * 60_000 },
  ));
}

const km = (a: LatLng, b: LatLng) => haversineKm(a.lat, a.lng, b.lat, b.lng);

export interface TravelTimesState {
  /** loading → done; none = no starting point, offline, or the lookup failed */
  status:    'loading' | 'done' | 'none';
  times:     TravelTimes | null;
  fromLabel: string | null;
}

// Walk / drive / transit minutes for the Navigate dropdown. Starts from where you
// are when you're near the place; otherwise from `from`; otherwise no times.
// Only runs while the dropdown is open — nothing is looked up for buttons nobody taps.

export function useTravelTimes(
  dest:    NavigationDestination,
  from:    TravelOrigin | null | undefined,
  enabled: boolean,
): TravelTimesState {
  const to     = dest.coordinates;
  const usable = enabled && !!to && Number.isFinite(to.lat) && Number.isFinite(to.lng);
  const [state, setState] = useState<TravelTimesState>({ status: usable ? 'loading' : 'none', times: null, fromLabel: null });

  useEffect(() => {
    if (!usable || !to) return;
    if (isOffline()) { setState({ status: 'none', times: null, fromLabel: null }); return; }
    let cancelled = false;
    const none = () => { if (!cancelled) setState({ status: 'none', times: null, fromLabel: null }); };

    (async () => {
      const here   = await currentPosition();
      const origin = here && km(here, to) <= NEAR_KM
        ? { coords: here, label: 'Times from where you are now' }
        : from && km(from.coordinates, to) > SAME_PLACE_KM
        ? { coords: from.coordinates, label: `Times from ${from.name}` }
        : null;
      if (!origin) return none();

      const url = `/api/travel-times?from=${origin.coords.lat.toFixed(4)},${origin.coords.lng.toFixed(4)}&to=${to.lat},${to.lng}`;
      let times = answers.get(url);
      if (!times || Date.now() - times.at > CLIENT_CACHE_MS) {
        const res = await fetch(url);
        if (!res.ok) return none();
        times = { times: await res.json(), at: Date.now() };
        answers.set(url, times);
      }
      if (!cancelled) setState({ status: 'done', times: times.times, fromLabel: origin.label });
    })().catch(none);   // no times — the dropdown works without them

    return () => { cancelled = true; };
  }, [usable, to?.lat, to?.lng, from?.name, from?.coordinates.lat, from?.coordinates.lng]);

  return state;
}

export function formatTravelMins(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
