'use client';

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import ZoomInIcon  from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from 'pdfjs-dist';

// Every page of a PDF, stacked for scrolling, drawn with pdf.js. Replaces an <iframe>,
// which on iPhone shows only page 1 and on Android shows nothing.
// Zoom: pinch, double-tap, ctrl+wheel (trackpad pinch) or the +/− buttons.

const PAD = 8;              // page margin at fit-width, scales with zoom
const GAP = 8;              // space between pages, scales with zoom
const BOTTOM_SPACE = 64;    // clear of the page/zoom pill
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const MAX_PIXELS = 8_000_000;   // per canvas — keeps iOS Safari under its canvas memory limit

type Size = { w: number; h: number };
type Status = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; doc: PDFDocumentProxy; sizes: Size[] };

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

// A failure whose message is already fit to show
class LoadError extends Error {}

// iOS frees a canvas's memory only once it's sized to nothing.
function freeCanvas(c: ChildNode | null | undefined) {
  if (c instanceof HTMLCanvasElement) { c.width = 0; c.height = 0; }
}

interface Props {
  src:       string;   // same-origin or blob: URL
  openHref?: string;   // where "open the file" points if it can't be shown here
}

export default function PdfPages({ src, openHref }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  // ── Load the document and every page's size ──
  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;   // destroying it frees the document and its worker
    setStatus({ kind: 'loading' });

    (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const base  = `${location.origin}/pdfjs/${pdfjs.version}/`;
      pdfjs.GlobalWorkerOptions.workerSrc = `${base}pdf.worker.min.js`;

      const res = await fetch(src).catch(() => {
        throw new LoadError(navigator.onLine === false
          ? 'You’re offline and this file isn’t saved on this device.'
          : 'Couldn’t load this PDF.');
      });
      if (!res.ok) throw new LoadError(res.status === 404 ? 'This file is no longer in storage.' : 'Couldn’t load this PDF.');
      const data = new Uint8Array(await res.arrayBuffer());
      if (cancelled) return;

      task = pdfjs.getDocument({
        data,
        cMapUrl:             `${base}cmaps/`,
        standardFontDataUrl: `${base}standard_fonts/`,
        wasmUrl:             `${base}wasm/`,
        iccUrl:              `${base}iccs/`,
      });
      const doc = await task.promise;
      if (cancelled) return;

      const sizes: Size[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const vp = (await doc.getPage(n)).getViewport({ scale: 1 });
        sizes.push({ w: vp.width, h: vp.height });
      }
      if (cancelled) return;
      setStatus({ kind: 'ready', doc, sizes });
    })().catch((e: unknown) => {
      if (cancelled) return;
      setStatus({
        kind: 'error',
        message: e instanceof LoadError ? e.message
          : (e as { name?: string })?.name === 'PasswordException' ? 'This PDF is password-protected.'
          : 'Couldn’t read this PDF.',
      });
    });

    return () => { cancelled = true; task?.destroy(); };
  }, [src]);

  if (status.kind === 'ready') return <Pages doc={status.doc} sizes={status.sizes} />;

  return (
    <Box sx={{ flex: 1, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, px: 3, textAlign: 'center' }}>
      <Typography sx={{ color: status.kind === 'error' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.45)', fontFamily: '"Archivo", sans-serif', fontSize: '0.88rem' }}>
        {status.kind === 'error' ? status.message : 'Loading…'}
      </Typography>
      {status.kind === 'error' && openHref && (
        <Typography
          component="a" href={openHref} target="_blank" rel="noopener noreferrer"
          sx={{ color: '#60a5fa', fontFamily: '"Archivo", sans-serif', fontSize: '0.88rem' }}
        >
          Open file in new tab
        </Typography>
      )}
    </Box>
  );
}

// ── The scrolling, zoomable page stack ───────────────────────────────────────

function Pages({ doc, sizes }: { doc: PDFDocumentProxy; sizes: Size[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [box, setBox]   = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const zoomRef   = useRef(1);
  // Scroll position the next layout should land on, so the point under the fingers stays put
  const anchorRef = useRef<{ x: number; y: number } | null>(null);
  const [renderZoom, setRenderZoom] = useState(1);
  const [range, setRange] = useState({ first: 0, last: 0, current: 0 });

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setBox(b => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Layout: fit the widest page to the width at zoom 1, everything scales with zoom ──
  const maxW  = Math.max(...sizes.map(s => s.w));
  const fit   = box.w > 2 * PAD ? (box.w - 2 * PAD) / maxW : 0;
  const tops: number[] = [];
  let y = PAD * zoom;
  for (const s of sizes) { tops.push(y); y += s.h * fit * zoom + GAP * zoom; }
  const contentH = y - GAP * zoom + PAD * zoom + BOTTOM_SPACE;
  const contentW = box.w * zoom;

  const zoomTo = useCallback((next: number, from: { x: number; y: number }, to = from) => {
    const el = scrollRef.current;
    const z0 = zoomRef.current;
    const z1 = clampZoom(next);
    if (!el || z1 === z0) return;
    const sx = anchorRef.current?.x ?? el.scrollLeft;
    const sy = anchorRef.current?.y ?? el.scrollTop;
    anchorRef.current = { x: (sx + from.x) * z1 / z0 - to.x, y: (sy + from.y) * z1 / z0 - to.y };
    zoomRef.current = z1;
    setZoom(z1);
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const a  = anchorRef.current;
    if (!el || !a) return;
    el.scrollLeft = a.x;
    el.scrollTop  = a.y;
    anchorRef.current = null;
  }, [zoom]);

  // Pages redraw at the new sharpness once zooming pauses; until then they stretch
  useEffect(() => {
    const t = setTimeout(() => setRenderZoom(zoom), 200);
    return () => clearTimeout(t);
  }, [zoom]);

  // ── Which pages are near the screen (drawn) and which one you're on ──
  const updateRange = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !tops.length) return;
    const top = el.scrollTop, h = el.clientHeight;
    const pageAt = (yy: number) => {
      let i = 0;
      while (i + 1 < tops.length && tops[i + 1] <= yy) i++;
      return i;
    };
    const atEnd   = top + h >= el.scrollHeight - 2;
    const next = {
      first:   pageAt(top - h),
      last:    pageAt(top + 2 * h),
      current: atEnd ? tops.length - 1 : pageAt(top + h / 2),
    };
    setRange(r => (r.first === next.first && r.last === next.last && r.current === next.current ? r : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tops.join(',')]);

  useLayoutEffect(() => { updateRange(); }, [updateRange, box.h]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(updateRange); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, [updateRange]);

  // ── Pinch / double-tap (touch), ctrl+wheel (trackpad pinch), double-click ──
  // Native listeners: React's touch handlers are passive and can't stop the
  // browser zooming the whole page instead.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const local = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      return { x: x - r.left, y: y - r.top };
    };
    const mid  = (t: TouchList) => local((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    let startDist = 0, startZoom = 1, lastMid = { x: 0, y: 0 };
    let lastTap = { t: 0, x: 0, y: 0 }, tapStart: { t: number; x: number; y: number } | null = null;
    let lastTouchAt = 0;

    const onStart = (e: TouchEvent) => {
      lastTouchAt = Date.now();
      if (e.touches.length === 2) {
        startDist = dist(e.touches); startZoom = zoomRef.current; lastMid = mid(e.touches);
        tapStart = null;
      } else if (e.touches.length === 1) {
        tapStart = { t: Date.now(), x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    const onMove = (e: TouchEvent) => {
      if (tapStart && e.touches.length === 1 &&
          Math.hypot(e.touches[0].clientX - tapStart.x, e.touches[0].clientY - tapStart.y) > 10) tapStart = null;
      if (e.touches.length !== 2 || !startDist) return;
      e.preventDefault();
      const m = mid(e.touches);
      zoomTo(startZoom * dist(e.touches) / startDist, lastMid, m);
      lastMid = m;
    };
    const onEnd = (e: TouchEvent) => {
      lastTouchAt = Date.now();
      if (e.touches.length < 2) startDist = 0;
      if (!tapStart || e.touches.length) return;
      const tap = { t: Date.now(), x: tapStart.x, y: tapStart.y };
      const held = tap.t - tapStart.t;
      tapStart = null;
      if (held > 250) return;   // a press, not a tap
      if (tap.t - lastTap.t < 300 && Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) < 30) {
        const p = local(tap.x, tap.y);
        zoomTo(zoomRef.current > 1 ? 1 : 2.5, p);
        lastTap = { t: 0, x: 0, y: 0 };
      } else {
        lastTap = tap;
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomTo(zoomRef.current * Math.exp(-e.deltaY / 150), local(e.clientX, e.clientY));
    };
    const onDblClick = (e: MouseEvent) => {
      if (Date.now() - lastTouchAt < 800) return;   // already handled as a double-tap
      zoomTo(zoomRef.current > 1 ? 1 : 2.5, local(e.clientX, e.clientY));
    };
    const noGesture = (e: Event) => e.preventDefault();   // iOS Safari page-zoom gesture

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('dblclick', onDblClick);
    el.addEventListener('gesturestart', noGesture);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dblclick', onDblClick);
      el.removeEventListener('gesturestart', noGesture);
    };
  }, [zoomTo]);

  const zoomStep = (factor: number) => {
    const el = scrollRef.current;
    if (!el) return;
    zoomTo(zoomRef.current * factor, { x: el.clientWidth / 2, y: el.clientHeight / 2 });
  };

  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 3);

  return (
    <Box sx={{ position: 'relative', flex: 1, alignSelf: 'stretch', minWidth: 0, minHeight: 0, display: 'flex' }}>
      <Box
        ref={scrollRef}
        sx={{
          flex: 1, minWidth: 0, overflow: 'auto', touchAction: 'pan-x pan-y',
          scrollbarGutter: 'stable', WebkitOverflowScrolling: 'touch',
        }}
      >
        <Box sx={{ position: 'relative' }} style={{ width: contentW, height: contentH }}>
          {fit > 0 && sizes.map((s, i) => {
            const w = s.w * fit * zoom;
            const h = s.h * fit * zoom;
            return (
              <Page
                key={i}
                doc={doc}
                number={i + 1}
                left={(contentW - w) / 2}
                top={tops[i]}
                width={w}
                height={h}
                active={i >= range.first && i <= range.last}
                scale={fit * renderZoom * dpr}
              />
            );
          })}
        </Box>
      </Box>

      {/* ── Page count + zoom ── */}
      <Box sx={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        bottom: 'calc(12px + env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)',
        borderRadius: 999, px: 0.5,
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <IconButton
          aria-label="Zoom out" onClick={() => zoomStep(1 / 1.5)} disabled={zoom <= MIN_ZOOM}
          sx={{ width: 44, height: 44, color: 'white', '&.Mui-disabled': { color: 'rgba(255,255,255,0.25)' } }}
        >
          <ZoomOutIcon fontSize="small" />
        </IconButton>
        <Typography sx={{
          color: 'rgba(255,255,255,0.9)', fontFamily: '"Archivo", sans-serif',
          fontSize: '0.8rem', fontWeight: 600, minWidth: 56, textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {range.current + 1} / {sizes.length}
        </Typography>
        <IconButton
          aria-label="Zoom in" onClick={() => zoomStep(1.5)} disabled={zoom >= MAX_ZOOM}
          sx={{ width: 44, height: 44, color: 'white', '&.Mui-disabled': { color: 'rgba(255,255,255,0.25)' } }}
        >
          <ZoomInIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

// ── One page: drawn while near the screen, released when far ─────────────────

interface PageProps {
  doc:    PDFDocumentProxy;
  number: number;
  left:   number;
  top:    number;
  width:  number;
  height: number;
  active: boolean;
  scale:  number;   // PDF units → device pixels
}

function Page({ doc, number, left, top, width, height, active, scale }: PageProps) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    if (!active) {
      const old = el.firstChild;
      el.replaceChildren();
      freeCanvas(old);
      return;
    }

    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    let canvas: HTMLCanvasElement | null = null;

    doc.getPage(number).then(page => {
      if (cancelled) return;
      const unit = page.getViewport({ scale: 1 });
      const area = unit.width * unit.height * scale * scale;
      const s    = area > MAX_PIXELS ? scale * Math.sqrt(MAX_PIXELS / area) : scale;
      const viewport = page.getViewport({ scale: s });

      // Drawn off-screen, then swapped in, so a zoom never flashes a blank page
      canvas = document.createElement('canvas');
      canvas.width  = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.cssText = 'display:block;width:100%;height:100%';
      const render = page.render({ canvas, viewport });
      task = render;
      return render.promise.then(() => {
        if (cancelled) return;
        const old = el.firstChild;
        el.replaceChildren(canvas!);
        freeCanvas(old);
        canvas = null;
      });
    }).catch(() => {
      // Cancelled by a newer draw, or a page pdf.js can't draw — it stays blank
    }).finally(() => {
      if (cancelled) freeCanvas(canvas);
    });

    return () => { cancelled = true; task?.cancel(); };
  }, [doc, number, active, scale]);

  return (
    <Box
      ref={holder}
      role="img"
      aria-label={`Page ${number}`}
      sx={{ position: 'absolute', backgroundColor: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.35)' }}
      // Geometry changes every frame of a pinch — inline, not a new style class each time
      style={{ left, top, width, height }}
    />
  );
}
