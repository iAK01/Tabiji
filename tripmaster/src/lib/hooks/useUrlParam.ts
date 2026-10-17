'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// A tab's sub-view (Logistics → Accommodation, Weather → Now…) kept in the URL
// so a refresh or shared link lands in the same place. Uses replaceState, not
// pushState: the back button steps through top-level tabs, not every sub-tab tap.
// Native history calls (synced into useSearchParams by Next) rather than the
// router, which would re-request this dynamic page — same reasoning as the trip
// page's tab switching. The fallback value is left out of the URL.
export function useUrlParam<T extends string, F extends T | null>(
  key: string,
  allowed: readonly T[],
  fallback: F,
): [T | F, (next: T | F) => void] {
  const searchParams = useSearchParams();

  const read = useCallback((): T | F => {
    const v = searchParams.get(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  }, [searchParams, key, allowed, fallback]);

  const [value, setValue] = useState<T | F>(read);

  // URL → state (back/forward, or another component changing the URL)
  useEffect(() => {
    const target = read();
    setValue(prev => (prev === target ? prev : target));
  }, [read]);

  const set = useCallback((next: T | F) => {
    setValue(next);
    const params = new URLSearchParams(window.location.search);
    if (next === fallback || next === null) params.delete(key);
    else params.set(key, next);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [key, fallback]);

  return [value, set];
}
