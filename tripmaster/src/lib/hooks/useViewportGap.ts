'use client';

import { useEffect } from 'react';

// position: fixed sits on the layout viewport. iOS can leave that viewport out of
// line with the screen after the keyboard closes (seen in the installed app), and
// bottom-fixed buttons then float partway up the page. --vv-gap is how far the
// layout viewport's bottom sits above the visible bottom (negative px, 0 when they
// agree); aboveBottom() adds it so fixed controls stay on the bottom you can see.
// Never positive: zoomed in, or typing with the keyboard up, buttons stay put.

const editing = () => {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  return el.tagName === 'INPUT'
    && !/^(button|checkbox|radio|range|color|file|submit|reset|image|hidden)$/i.test((el as HTMLInputElement).type);
};

function gap(): number {
  const vv = window.visualViewport;
  if (!vv || editing()) return 0;
  return Math.min(0, Math.round(window.innerHeight - (vv.offsetTop + vv.height)));
}

/** Keeps --vv-gap on <html> current. Mount once, at the root. */
export function useViewportGap() {
  useEffect(() => {
    const vv   = window.visualViewport;
    const root = document.documentElement;
    let last  = NaN;
    let frame = 0;

    const update = () => {
      frame = 0;
      const g = gap();
      if (g === last) return;
      last = g;
      root.style.setProperty('--vv-gap', `${g}px`);
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(update); };
    // The keyboard is still closing when focus leaves the field
    const settle = () => { queue(); setTimeout(queue, 400); };

    update();
    vv?.addEventListener('resize', queue);
    vv?.addEventListener('scroll', queue);
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    document.addEventListener('focusin', queue);
    document.addEventListener('focusout', settle);
    document.addEventListener('visibilitychange', settle);
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', queue);
      vv?.removeEventListener('scroll', queue);
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
      document.removeEventListener('focusin', queue);
      document.removeEventListener('focusout', settle);
      document.removeEventListener('visibilitychange', settle);
      root.style.removeProperty('--vv-gap');
    };
  }, []);
}

/** A fixed element's `bottom`, `px` above the visible bottom edge. */
export const aboveBottom = (px: number) => `calc(${px}px + var(--vv-gap, 0px))`;
