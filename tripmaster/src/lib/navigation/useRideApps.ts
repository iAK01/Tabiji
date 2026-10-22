'use client';

import { useEffect, useState } from 'react';
import { MY_APPS_CATALOG, TRANSPORT_SERVICES, type TransportService } from '@/lib/data/ground-transport';

const RIDE_IDS = MY_APPS_CATALOG.find(g => g.category === 'ride')?.ids ?? [];

// Last answer, shown straight away on the next open while a fresh one loads.
let saved: string[] | null = null;

// The ride apps the Navigate dropdown offers: the ones picked in My Apps on the
// profile, or all of them when none are picked. No guessing at coverage from the
// country: Spain has Cabify, Gran Canaria doesn't. The app itself says when
// there are no cars.
export function useRideApps(): TransportService[] {
  const [mine, setMine] = useState<string[] | null>(saved);

  useEffect(() => {
    let live = true;
    fetch('/api/user/my-apps')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!Array.isArray(d?.myApps)) return;
        saved = d.myApps;
        if (live) setMine(d.myApps);
      })
      .catch(() => { /* offline with nothing saved: no rides, and none bookable anyway */ });
    return () => { live = false; };
  }, []);

  if (!mine) return [];
  const picked = RIDE_IDS.filter(id => mine.includes(id));
  return (picked.length ? picked : RIDE_IDS).map(id => TRANSPORT_SERVICES[id]).filter(Boolean);
}
