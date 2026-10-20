'use client';

// The whole trip in one chart — every hour, one metric at a time (one axis per
// chart, never two). Each day's icon and headline number ride along the top
// (tap one to open that day); drag a finger or move the mouse along the plot and
// the readout follows. Plain SVG: no chart library, works offline, matches the
// app's own type and colour.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Box, Typography, Button, ButtonBase, Paper, alpha } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ThermostatIcon   from '@mui/icons-material/Thermostat';
import WaterDropIcon    from '@mui/icons-material/WaterDrop';
import WbSunnyIcon      from '@mui/icons-material/WbSunny';
import AirIcon          from '@mui/icons-material/Air';
import {
  codeWords, compass, hourLabel, shortDay, tripStats, tripTimeline,
  type DayWeather, type TimelinePoint, type TripMetric,
} from '@/lib/weather-insights';
import { D, weatherIcon, type IconComponent } from './weatherUi';

const METRICS: { key: TripMetric; label: string; short: string; Icon: IconComponent }[] = [
  { key: 'temp', label: 'Temperature', short: 'Temp', Icon: ThermostatIcon },
  { key: 'rain', label: 'Rain',        short: 'Rain', Icon: WaterDropIcon },
  { key: 'uv',   label: 'UV',          short: 'UV',   Icon: WbSunnyIcon },
  { key: 'wind', label: 'Wind',        short: 'Wind', Icon: AirIcon },
];

const RAIN_TOP = '#38BDF8';
const UV_FILL  = '#F59E0B';
const UV_LINE  = '#D97706';
const FONT     = 'Archivo, Inter, sans-serif';
const MARGIN   = { top: 18, right: 8, bottom: 24, left: 30 };
const STRIP_H  = 46;   // the day-icon row above the plot

// Temperature ramp for the line itself: cold blue → teal → sage → amber → terra → brick.
const TEMP_RAMP: [number, string][] = [
  [0, '#0369a1'], [10, '#0891b2'], [16, '#5E9C7E'], [21, '#E0A030'], [26, '#C4714A'], [32, '#A8432A'],
];

function rampColor(t: number): string {
  const r = TEMP_RAMP;
  if (t <= r[0][0]) return r[0][1];
  if (t >= r[r.length - 1][0]) return r[r.length - 1][1];
  const i = r.findIndex(([v]) => v > t);
  const [t0, c0] = r[i - 1];
  const [t1, c1] = r[i];
  const k = (t - t0) / (t1 - t0);
  const ch = (c: string, o: number) => parseInt(c.slice(o, o + 2), 16);
  const mix = (o: number) => Math.round(ch(c0, o) + (ch(c1, o) - ch(c0, o)) * k);
  return `rgb(${mix(1)},${mix(3)},${mix(5)})`;
}

// ─── Geometry ──────────────────────────────────────────────────────────────────

// Monotone cubic (Fritsch–Carlson): smooth, but never overshoots a real peak.
function smooth(pts: [number, number][]): string {
  const n = pts.length;
  if (!n) return '';
  if (n < 3) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = dx[i] / 3;
    d += `C${(x0 + h).toFixed(1)},${(y0 + t[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - t[i + 1] * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

// Runs of non-null values — a gap in the data breaks the line instead of bridging it.
function runs(values: (number | null)[]): [number, number][][] {
  const out: [number, number][][] = [];
  let cur: [number, number][] = [];
  values.forEach((v, i) => {
    if (v == null) { if (cur.length) out.push(cur); cur = []; }
    else cur.push([i, v]);
  });
  if (cur.length) out.push(cur);
  return out;
}

function niceStep(span: number, maxTicks: number): number {
  const raw = span / maxTicks;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  return ([1, 2, 2.5, 5, 10].find(k => k * pow >= raw) ?? 10) * pow;
}

function domainFor(metric: TripMetric, values: number[]): { lo: number; hi: number; ticks: number[] } {
  if (metric === 'rain') return { lo: 0, hi: 100, ticks: [0, 50, 100] };
  const max = values.length ? Math.max(...values) : 0;
  if (metric === 'uv') {
    const hi = Math.max(8, Math.ceil(max));
    return { lo: 0, hi, ticks: [0, 3, 6, 9, 12].filter(t => t <= hi) };
  }
  if (metric === 'wind') {
    const step = niceStep(Math.max(max, 10), 3);
    const hi   = Math.ceil(Math.max(max, 10) / step) * step;
    return { lo: 0, hi, ticks: Array.from({ length: hi / step + 1 }, (_, i) => i * step) };
  }
  const min  = values.length ? Math.min(...values) : 0;
  const step = niceStep(Math.max(max - min, 4), 3);
  const lo   = Math.floor((min - 1) / step) * step;
  const hi   = Math.ceil((max + 1) / step) * step;
  return { lo, hi, ticks: Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step) };
}

// Measured on attach (callback ref), again after first layout, then on resize.
// A zero reading is ignored, so a transient collapse never blanks a drawn chart.
function useWidth() {
  const [width, setWidth] = useState(0);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    ro.current?.disconnect();
    ro.current = null;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setWidth(w);
    };
    measure();
    requestAnimationFrame(measure);
    if (typeof ResizeObserver !== 'undefined') {
      ro.current = new ResizeObserver(measure);
      ro.current.observe(el);
    }
  }, []);
  return [ref, width] as const;
}

const FALLBACK_WIDTH = 360;   // drawn at this and scaled to fit until the real width is known

// What each metric plots, and the one number per day that rides on the icon strip.
const VALUE: Record<TripMetric, {
  a: (p: TimelinePoint) => number | null;
  b?: (p: TimelinePoint) => number | null;
  day: (d: DayWeather) => string;
  big: (p: TimelinePoint) => string;
  tick: (v: number) => string;
  legend: [string, string?];
}> = {
  temp: { a: p => p.temp, b: p => p.feels, day: d => `${d.tempMax}°`, big: p => `${p.temp}°`, tick: v => `${v}°`, legend: ['Temperature', 'Feels like'] },
  rain: { a: p => p.rain, day: d => `${d.chanceOfRain ?? 0}%`, big: p => `${p.rain ?? 0}%`, tick: v => `${v}%`, legend: ['Chance of rain — how many forecast models show it (typical days: past years)'] },
  uv:   { a: p => p.uv, day: d => (d.uvIndex != null ? `${Math.round(d.uvIndex)}` : '–'), big: p => (p.uv != null ? `${Math.round(p.uv)}` : '–'), tick: v => `${v}`, legend: ['UV index (typical days: a clear day)'] },
  wind: { a: p => p.wind, b: p => p.gust, day: d => `${d.windKph ?? '–'}`, big: p => `${p.wind ?? '–'}`, tick: v => `${v}`, legend: ['Wind km/h', 'Gusts'] },
};

// ─── Chart ─────────────────────────────────────────────────────────────────────

export default function TripWeatherChart({
  days, nowKey, onOpenDay,
}: {
  days:      DayWeather[];
  nowKey:    string | null;      // `${date}-${hour}` while on the trip
  onOpenDay: (index: number) => void;
}) {
  const uid = `wx${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [metric, setMetric] = useState<TripMetric>('temp');
  const [boxRef, measured]  = useWidth();
  const width               = measured || FALLBACK_WIDTH;
  const svgRef              = useRef<SVGSVGElement>(null);

  const pts      = useMemo(() => tripTimeline(days), [days]);
  const nowIdx   = nowKey ? pts.findIndex(p => `${p.date}-${p.hour}` === nowKey) : -1;
  const startIdx = nowIdx >= 0 ? nowIdx : Math.max(0, pts.findIndex(p => p.hour === 14));
  const [sel, setSel] = useState(startIdx);
  useEffect(() => { setSel(startIdx); }, [startIdx, pts.length]);

  const stats  = useMemo(() => tripStats(days, metric), [days, metric]);
  const val    = VALUE[metric];
  const height = width < 600 ? 200 : 240;
  const N      = pts.length;
  const plotW  = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH  = height - MARGIN.top - MARGIN.bottom;
  const step   = N ? plotW / N : 0;
  const x      = (i: number) => MARGIN.left + (i + 0.5) * step;

  // Everything that doesn't move with the selection.
  const layer = useMemo(() => {
    if (!N || !plotW) return null;
    const all  = pts.flatMap(p => [val.a(p), val.b?.(p) ?? null]).filter((v): v is number => v != null);
    const dom  = domainFor(metric, all);
    const y    = (v: number) => MARGIN.top + plotH - ((v - dom.lo) / (dom.hi - dom.lo)) * plotH;
    const base = y(dom.lo);

    const lineOf = (get: (p: TimelinePoint) => number | null) =>
      runs(pts.map(get)).map(r => smooth(r.map(([i, v]) => [x(i), y(v)]))).join('');
    const areaOf = (get: (p: TimelinePoint) => number | null) =>
      runs(pts.map(get)).map(r => {
        const top = smooth(r.map(([i, v]) => [x(i), y(v)]));
        return `${top}L${x(r[r.length - 1][0]).toFixed(1)},${base.toFixed(1)}L${x(r[0][0]).toFixed(1)},${base.toFixed(1)}Z`;
      }).join('');

    // Rain as rounded 3-hour bars (6-hour on long trips) — each the highest chance in its slot.
    const binH = step * 3 >= 3.5 ? 3 : 6;
    const bins = new Map<string, { i0: number; i1: number; v: number }>();
    pts.forEach((p, i) => {
      const k = `${p.dayIndex}-${Math.floor(p.hour / binH)}`;
      const b = bins.get(k);
      const v = p.rain ?? 0;
      if (!b) bins.set(k, { i0: i, i1: i, v });
      else { b.i1 = i; b.v = Math.max(b.v, v); }
    });

    const nights: [number, number][] = [];
    pts.forEach((p, i) => {
      if (p.isDay) return;
      const last = nights[nights.length - 1];
      if (last && last[1] === i - 1) last[1] = i; else nights.push([i, i]);
    });

    const dayWidth = step * 24;
    const every    = dayWidth >= 20 ? 1 : Math.ceil(20 / Math.max(dayWidth, 1));
    const dayMarks = days.map((d, k) => {
      const idx = pts.map((p, i) => (p.dayIndex === k ? i : -1)).filter(i => i >= 0);
      if (!idx.length) return null;
      const x0 = x(idx[0]) - step / 2;
      const x1 = x(idx[idx.length - 1]) + step / 2;
      return { k, x0, x1, mid: (x0 + x1) / 2, text: dayWidth >= 46 ? shortDay(d.date) : String(+d.date.slice(8)), show: k % every === 0 };
    }).filter((m): m is NonNullable<typeof m> => !!m);

    // Temperature gradient stops across the plotted range.
    const stops = metric === 'temp'
      ? [dom.hi, ...TEMP_RAMP.map(([t]) => t).filter(t => t < dom.hi && t > dom.lo), dom.lo]
          .map(t => ({ offset: (dom.hi - t) / (dom.hi - dom.lo), color: rampColor(t) }))
      : [];

    return {
      dom, y, base, stops, dayWidth,
      a: lineOf(val.a), aArea: areaOf(val.a), b: val.b ? lineOf(val.b) : null,
      bars: [...bins.values()], nights, dayMarks,
      typicalAt: pts.findIndex(p => p.source === 'historical'),
    };
  }, [pts, days, metric, val, N, plotW, plotH, step]);

  const pick = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect?.width || !step) return;
    const px = (clientX - rect.left) * (width / rect.width);   // screen → drawing units
    setSel(Math.max(0, Math.min(N - 1, Math.floor((px - MARGIN.left) / step))));
  };

  const p = pts[Math.min(sel, N - 1)];
  if (!N || !p) return null;
  const day = days[p.dayIndex];
  const { Icon: PIcon, color: pColor } = weatherIcon(p.code, '', p.isDay);
  const accent = metric === 'temp' ? rampColor(p.temp) : metric === 'rain' ? D.cool : metric === 'uv' ? UV_LINE : D.navy;
  const secondary = [
    metric !== 'temp' ? `${p.temp}°` : p.feels != null ? `feels ${p.feels}°` : null,
    metric !== 'rain' ? `${p.rain ?? 0}% rain` : (p.mm ?? 0) >= 0.1 ? `${p.mm} mm` : null,
    metric !== 'uv' && p.uv != null && p.isDay ? `UV ${Math.round(p.uv)}` : null,
    metric !== 'wind' && p.wind != null ? `${p.wind} km/h` : metric === 'wind' && p.dir != null ? compass(p.dir) : null,
  ].filter(Boolean).join(' · ');

  return (
    <Paper elevation={0} sx={{
      p: { xs: 1.5, sm: 2.25 }, borderRadius: '16px', border: `1.5px solid ${D.rule}`,
      backgroundColor: D.paper, display: 'flex', flexDirection: 'column', gap: 1.75,
    }}>
      {/* Metric */}
      <Box role="tablist" aria-label="Chart" sx={{
        display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 0.5, p: 0.5,
        borderRadius: '12px', backgroundColor: alpha(D.navy, 0.06),
      }}>
        {METRICS.map(m => {
          const active = m.key === metric;
          return (
            <ButtonBase
              key={m.key} role="tab" aria-selected={active} onClick={() => setMetric(m.key)}
              sx={{
                height: 40, borderRadius: '9px', gap: 0.6, fontFamily: D.body, fontWeight: 800, fontSize: '0.88rem',
                color: active ? '#fff' : D.navy, backgroundColor: active ? D.navy : 'transparent',
                boxShadow: active ? '0 2px 8px rgba(29,38,66,0.25)' : 'none',
                transition: 'background-color .2s, color .2s, box-shadow .2s',
              }}
            >
              <m.Icon sx={{ fontSize: '1.05rem' }} />
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{m.label}</Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{m.short}</Box>
            </ButtonBase>
          );
        })}
      </Box>

      {/* The trip in three numbers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {stats.map((s, i) => (
          <Box key={s.label} sx={{ px: { xs: 1, sm: 1.5 }, borderLeft: i ? `1px solid ${D.rule}` : 'none', minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: D.muted, fontFamily: D.body }}>
              {s.label}
            </Typography>
            <Typography noWrap sx={{ fontFamily: D.display, fontSize: { xs: '1.35rem', sm: '1.6rem' }, color: D.navy, lineHeight: 1.15, mt: 0.25 }}>
              {s.value}
            </Typography>
            {s.sub && (
              <Typography noWrap sx={{ fontSize: '0.75rem', color: D.muted, fontFamily: D.body }}>{s.sub}</Typography>
            )}
          </Box>
        ))}
      </Box>

      {/* Readout — above the plot so a finger never covers it */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.25, pl: 1.25, pr: 0.5, py: 0.75,
        borderRadius: '12px', backgroundColor: alpha(accent, 0.08), border: `1px solid ${alpha(accent, 0.18)}`,
        transition: 'background-color .2s, border-color .2s',
      }}>
        <PIcon sx={{ fontSize: '1.9rem', color: pColor, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: '0.8rem', color: D.muted, fontFamily: D.body, fontWeight: 600 }}>
            {sel === nowIdx ? 'Now' : `${shortDay(p.date)} · ${hourLabel(p.hour)}`} · {codeWords(p.code, p.isDay)}
            {p.source === 'historical' ? ' · typical' : ''}
          </Typography>
          <Typography noWrap sx={{ fontSize: '0.88rem', color: D.navy, fontFamily: D.body, fontVariantNumeric: 'tabular-nums' }}>
            {secondary || ' '}
          </Typography>
        </Box>
        <Typography sx={{ fontFamily: D.display, fontSize: '1.7rem', lineHeight: 1, color: accent, fontVariantNumeric: 'tabular-nums' }}>
          {val.big(p)}
        </Typography>
        <Button
          onClick={() => onOpenDay(p.dayIndex)} endIcon={<ChevronRightIcon />}
          sx={{ minHeight: 44, minWidth: 0, px: 1, fontFamily: D.body, fontWeight: 800, color: D.terra, whiteSpace: 'nowrap' }}
        >
          {shortDay(day.date)}
        </Button>
      </Box>

      {/* Plot */}
      <Box ref={boxRef} sx={{ width: '100%', position: 'relative' }}>
        {layer && layer.dayWidth >= 24 && (
          // Each day's icon + headline number — tap to open the day.
          <Box sx={{ position: 'relative', height: STRIP_H }}>
            {layer.dayMarks.map(m => {
              const d = days[m.k];
              const { Icon, color } = weatherIcon(d.code, d.condition);
              const active = m.k === p.dayIndex;
              return (
                <ButtonBase
                  key={m.k}
                  aria-label={`${shortDay(d.date)}: ${d.condition}, ${val.day(d)}`}
                  onClick={() => onOpenDay(m.k)}
                  sx={{
                    position: 'absolute', left: `${(m.x0 / width) * 100}%`, width: `${((m.x1 - m.x0) / width) * 100}%`,
                    top: 0, height: STRIP_H,
                    flexDirection: 'column', gap: 0.25, borderRadius: '8px',
                    backgroundColor: active ? alpha(D.terra, 0.1) : 'transparent',
                    transition: 'background-color .2s',
                  }}
                >
                  <Icon sx={{ fontSize: '1.15rem', color }} />
                  <Typography sx={{
                    fontSize: '0.72rem', fontWeight: 800, fontFamily: D.body, lineHeight: 1,
                    color: active ? D.terra : D.navy, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {val.day(d)}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        )}

        {layer && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            role="slider"
            tabIndex={0}
            aria-label={`Trip ${METRICS.find(m => m.key === metric)!.label.toLowerCase()}, hour by hour`}
            aria-valuemin={0} aria-valuemax={N - 1} aria-valuenow={sel}
            aria-valuetext={`${shortDay(p.date)} ${hourLabel(p.hour)}: ${val.big(p)}${secondary ? `, ${secondary}` : ''}`}
            style={{ display: 'block', width: '100%', height: 'auto', touchAction: 'pan-y', cursor: 'crosshair', outline: 'none', userSelect: 'none' }}
            onPointerDown={e => { svgRef.current?.setPointerCapture(e.pointerId); pick(e.clientX); }}
            onPointerMove={e => { if (e.pointerType === 'mouse' || e.buttons) pick(e.clientX); }}
            onKeyDown={e => {
              const by = e.shiftKey ? 24 : 1;
              if (e.key === 'ArrowRight') { e.preventDefault(); setSel(s => Math.min(N - 1, s + by)); }
              if (e.key === 'ArrowLeft')  { e.preventDefault(); setSel(s => Math.max(0, s - by)); }
              if (e.key === 'Enter')      { e.preventDefault(); onOpenDay(p.dayIndex); }
            }}
          >
            <style>{`
              @keyframes ${uid}-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
              @keyframes ${uid}-fade { from { opacity: 0; } to { opacity: 1; } }
              .${uid}-draw { stroke-dasharray: 1; animation: ${uid}-draw 1s cubic-bezier(.3,.7,.2,1) both; }
              .${uid}-fade { animation: ${uid}-fade .7s ease-out both; }
              @media (prefers-reduced-motion: reduce) {
                .${uid}-draw, .${uid}-fade { animation: none; stroke-dasharray: none; }
              }
            `}</style>
            <defs>
              <linearGradient id={`${uid}-temp`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={layer.y(layer.dom.hi)} y2={layer.y(layer.dom.lo)}>
                {layer.stops.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} />)}
              </linearGradient>
              <linearGradient id={`${uid}-tempFill`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <mask id={`${uid}-fadeMask`}>
                <rect x="0" y={MARGIN.top} width={width} height={plotH} fill={`url(#${uid}-tempFill)`} />
              </mask>
              <linearGradient id={`${uid}-rain`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={RAIN_TOP} />
                <stop offset="1" stopColor={D.cool} />
              </linearGradient>
              <linearGradient id={`${uid}-uv`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={UV_FILL} stopOpacity="0.5" />
                <stop offset="1" stopColor={UV_FILL} stopOpacity="0.04" />
              </linearGradient>
              <pattern id={`${uid}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke={alpha(D.navy, 0.07)} strokeWidth="2" />
              </pattern>
            </defs>

            {/* Nights */}
            {layer.nights.map(([a, b]) => (
              <rect key={a} x={x(a) - step / 2} y={MARGIN.top} width={(b - a + 1) * step} height={plotH} fill={alpha(D.navy, 0.04)} />
            ))}
            {/* Selected day */}
            {(() => {
              const m = layer.dayMarks.find(d => d.k === p.dayIndex);
              return m ? <rect x={m.x0} y={MARGIN.top} width={m.x1 - m.x0} height={plotH} fill={alpha(D.terra, 0.07)} rx={4} /> : null;
            })()}
            {/* Typical days */}
            {layer.typicalAt >= 0 && (
              <>
                <rect
                  x={x(layer.typicalAt) - step / 2} y={MARGIN.top}
                  width={MARGIN.left + plotW - (x(layer.typicalAt) - step / 2)} height={plotH}
                  fill={`url(#${uid}-hatch)`}
                />
                <text x={x(layer.typicalAt) - step / 2 + 4} y={MARGIN.top - 6} fontSize={10} fill={D.muted} fontFamily={FONT}>
                  typical
                </text>
              </>
            )}

            {/* Grid + ticks */}
            {layer.dom.ticks.map(t => (
              <g key={t}>
                <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={layer.y(t)} y2={layer.y(t)} stroke={D.rule} strokeWidth={1} strokeDasharray={t === layer.dom.lo ? undefined : '2 4'} />
                <text x={MARGIN.left - 6} y={layer.y(t) + 4} textAnchor="end" fontSize={10.5} fill={D.muted} fontFamily={FONT}>
                  {val.tick(t)}
                </text>
              </g>
            ))}
            {layer.dayMarks.filter(m => m.show).map(m => (
              <text
                key={m.k} x={m.mid} y={height - 7} textAnchor="middle" fontSize={10.5}
                fontWeight={m.k === p.dayIndex ? 800 : 500}
                fill={m.k === p.dayIndex ? D.terra : D.muted} fontFamily={FONT}
              >
                {m.text}
              </text>
            ))}
            {metric === 'rain' && (
              <text x={MARGIN.left + plotW - 2} y={layer.y(50) - 4} textAnchor="end" fontSize={10} fill={D.muted} fontFamily={FONT}>likely</text>
            )}
            {metric === 'uv' && [3, 6].filter(v => v <= layer.dom.hi).map(v => (
              <text key={v} x={MARGIN.left + plotW - 2} y={layer.y(v) - 4} textAnchor="end" fontSize={10} fill={D.muted} fontFamily={FONT}>
                {v === 3 ? 'sun cream' : 'high'}
              </text>
            ))}

            {/* Series — keyed by metric so each switch redraws with the entrance */}
            <g key={metric}>
              {metric === 'temp' && (
                <>
                  <path d={layer.aArea} fill={`url(#${uid}-temp)`} opacity={0.22} mask={`url(#${uid}-fadeMask)`} className={`${uid}-fade`} />
                  {layer.b && <path d={layer.b} fill="none" stroke={alpha(D.navy, 0.35)} strokeWidth={1.5} strokeDasharray="4 3" className={`${uid}-fade`} />}
                  <path d={layer.a} fill="none" stroke={`url(#${uid}-temp)`} strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className={`${uid}-draw`} />
                </>
              )}
              {metric === 'rain' && (
                <g className={`${uid}-fade`}>
                  {layer.bars.filter(b => b.v > 0).map(b => {
                    const x0 = x(b.i0) - step / 2 + 0.75;
                    const w  = Math.max(1, (b.i1 - b.i0 + 1) * step - 1.5);
                    const top = layer.y(b.v);
                    return <rect key={b.i0} x={x0} y={top} width={w} height={layer.base - top} rx={Math.min(2.5, w / 2)} fill={`url(#${uid}-rain)`} opacity={b.v >= 50 ? 1 : 0.55} />;
                  })}
                </g>
              )}
              {metric === 'uv' && (
                <>
                  <path d={layer.aArea} fill={`url(#${uid}-uv)`} className={`${uid}-fade`} />
                  <path d={layer.a} fill="none" stroke={UV_LINE} strokeWidth={2.25} strokeLinejoin="round" pathLength={1} className={`${uid}-draw`} />
                </>
              )}
              {metric === 'wind' && (
                <>
                  <path d={layer.aArea} fill={alpha(D.navy, 0.06)} className={`${uid}-fade`} />
                  {layer.b && <path d={layer.b} fill="none" stroke={alpha(D.navy, 0.35)} strokeWidth={1.5} strokeDasharray="4 3" className={`${uid}-fade`} />}
                  <path d={layer.a} fill="none" stroke={D.navy} strokeWidth={2.25} strokeLinejoin="round" pathLength={1} className={`${uid}-draw`} />
                </>
              )}
            </g>

            {/* The past, dimmed */}
            {nowIdx > 0 && (
              <rect x={MARGIN.left} y={MARGIN.top} width={x(nowIdx) - step / 2 - MARGIN.left} height={plotH} fill={D.paper} opacity={0.55} />
            )}
            {nowIdx >= 0 && (
              <g>
                <line x1={x(nowIdx)} x2={x(nowIdx)} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke={D.terra} strokeWidth={1.5} />
                <rect x={x(nowIdx) - 16} y={MARGIN.top - 16} width={32} height={15} rx={7.5} fill={D.terra} />
                <text x={x(nowIdx)} y={MARGIN.top - 5} textAnchor="middle" fontSize={10} fontWeight={800} fill="#fff" fontFamily={FONT}>Now</text>
              </g>
            )}

            {/* Crosshair */}
            <line x1={x(sel)} x2={x(sel)} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke={alpha(D.navy, 0.5)} strokeWidth={1} />
            {(() => {
              const v = val.a(p);
              if (v == null) return null;
              const cy = metric === 'rain'
                ? layer.y(layer.bars.find(b => sel >= b.i0 && sel <= b.i1)?.v ?? v)
                : layer.y(v);
              return (
                <g>
                  <circle cx={x(sel)} cy={cy} r={11} fill={accent} opacity={0.16} />
                  <circle cx={x(sel)} cy={cy} r={5.5} fill="#fff" stroke={accent} strokeWidth={2.5} />
                </g>
              );
            })()}
          </svg>
        )}
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {val.legend.filter((l): l is string => !!l).map((l, i) => (
          <Box key={l} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <svg width="22" height="10" aria-hidden>
              {i === 0
                ? metric === 'temp'
                  ? <line x1="0" x2="22" y1="5" y2="5" stroke={D.terra} strokeWidth={2.75} strokeLinecap="round" />
                  : metric === 'rain'
                    ? <rect x="3" y="1" width="6" height="9" rx="2" fill={D.cool} />
                    : <line x1="0" x2="22" y1="5" y2="5" stroke={metric === 'uv' ? UV_LINE : D.navy} strokeWidth={2.25} />
                : <line x1="0" x2="22" y1="5" y2="5" stroke={alpha(D.navy, 0.45)} strokeWidth={1.5} strokeDasharray="4 3" />}
            </svg>
            <Typography sx={{ fontSize: '0.78rem', color: D.muted, fontFamily: D.body }}>{l}</Typography>
          </Box>
        ))}
        <Typography sx={{ fontSize: '0.78rem', color: D.muted, fontFamily: D.body }}>Shaded: night</Typography>
      </Box>
    </Paper>
  );
}
