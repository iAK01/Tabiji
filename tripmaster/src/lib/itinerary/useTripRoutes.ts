'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isOffline, subscribeConnectivity } from '@/lib/offline/connectivity';
import {
  buildTripPlans, routePairs,
  type DayPlan, type Home, type LegRoutes, type NamedPlace, type PlanStop, type Stay,
} from './dayPlan';

const NO_PLACES: NamedPlace[] = [];

export interface TripRoutes<S> {
  /** One per itinerary day, in order */
  plans:  DayPlan<S>[];
  /** Walk / drive per leg pair; null until the first answer (or offline with none saved) */
  routes: Record<string, LegRoutes> | null;
  home:   Home | null;
}

// Every day of the itinerary planned (lib/itinerary/dayPlan), with the walks and
// drives between its places from /routes. No button: when a stop is added or
// moved and a leg isn't covered yet, it asks again once the change has saved.
// Offline it uses the saved answer; legs it doesn't cover show without times.
export function useTripRoutes<S extends PlanStop>(
  tripId: string,
  days:   Array<{ date: string; stops: S[] }>,
  stays:  Stay[],
  /** The trip's venues, so places are called by their names */
  named:  NamedPlace[] = NO_PLACES,
): TripRoutes<S> {
  const [data, setData] = useState<{ routes: Record<string, LegRoutes>; home: Home | null } | null>(null);
  const askedFor = useRef('');
  const [online, setOnline] = useState(0);   // bumped on reconnecting

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/routes`);
      if (!res.ok) return;
      const body = await res.json();
      setData({ routes: body.routes ?? {}, home: body.home ?? null });
    } catch { /* offline with nothing saved — legs show without times */ }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  const home  = data?.home ?? null;
  const plans = useMemo(() => buildTripPlans(days, stays, home, named), [days, stays, home, named]);

  // Legs the answer doesn't cover — a stop just added or moved. Each set is asked
  // for once (a lookup Google can't answer isn't asked again and again).
  const missing = useMemo(() => {
    if (!data) return '';
    return routePairs(plans).map(p => p.key).filter(k => !(k in data.routes)).sort().join('|');
  }, [data, plans]);

  useEffect(() => {
    if (!missing || missing === askedFor.current) return;
    const t = setTimeout(() => {
      if (isOffline()) return;
      askedFor.current = missing;
      load();
    }, 1500);
    return () => clearTimeout(t);
  }, [missing, load, online]);

  // Back online: what couldn't be asked can be now
  useEffect(() => subscribeConnectivity(() => {
    if (isOffline()) return;
    askedFor.current = '';
    setOnline(n => n + 1);
  }), []);

  return { plans, routes: data?.routes ?? null, home };
}
