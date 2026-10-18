'use client';

import { useEffect, useRef, useState } from 'react';

// Keeps the screen awake while `wanted` — packing with your hands full, say. The browser
// drops the lock whenever the page is hidden (app switched, phone locked), so it's asked
// for again each time the page is visible. Needs HTTPS; iOS Low Power Mode can refuse it.
export function useWakeLock(wanted: boolean, onRefused: (err: unknown) => void) {
  const [supported, setSupported] = useState(false);
  const [active,    setActive]    = useState(false);
  const sentinel  = useRef<WakeLockSentinel | null>(null);
  const refusedCb = useRef(onRefused);
  refusedCb.current = onRefused;

  useEffect(() => { setSupported(typeof navigator !== 'undefined' && 'wakeLock' in navigator); }, []);

  useEffect(() => {
    if (!supported || !wanted) return;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || sentinel.current || document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) { lock.release().catch(() => {}); return; }
        sentinel.current = lock;
        setActive(true);
        lock.addEventListener('release', () => {
          if (sentinel.current === lock) sentinel.current = null;
          setActive(false);
        });
      } catch (err) {
        if (!cancelled) refusedCb.current(err);
      }
    };

    acquire();
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      sentinel.current?.release().catch(() => {});
      sentinel.current = null;
      setActive(false);
    };
  }, [supported, wanted]);

  return { supported, active };
}
