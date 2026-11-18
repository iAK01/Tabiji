'use client';

import { useEffect, useState } from 'react';

const SLOP = 10;  // px a finger can drift and still count as a tap

/**
 * While `on`: false until a tap anywhere on the screen, then true for `ms` after
 * the latest tap. Always true while off. A tap is a press and release that didn't
 * become a scroll — the browser cancels the pointer when it takes over to scroll.
 */
export function useShownOnTap(on: boolean, ms = 5000): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!on) return;
    const downs = new Map<number, { x: number; y: number }>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const down = (e: PointerEvent) => { downs.set(e.pointerId, { x: e.clientX, y: e.clientY }); };
    const cancel = (e: PointerEvent) => { downs.delete(e.pointerId); };
    const up = (e: PointerEvent) => {
      const at = downs.get(e.pointerId);
      downs.delete(e.pointerId);
      if (!at || Math.hypot(e.clientX - at.x, e.clientY - at.y) > SLOP) return;
      setShown(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShown(false), ms);
    };

    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      clearTimeout(timer);
      setShown(false);
    };
  }, [on, ms]);

  return !on || shown;
}
