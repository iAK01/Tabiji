'use client';

import { useId } from 'react';
import { D } from './Intelligence.shared';

// Front view of each plug type, looking at the pins. Drawn at 1 unit = 1 mm,
// so plugs keep their real sizes relative to each other (a Europlug is small,
// a UK plug is big). Pin sizes and spacings follow the published standards.

type Shape =
  | { k: 'circle'; cx: number; cy: number; r: number }
  | { k: 'rect'; cx: number; cy: number; w: number; h: number; rx?: number; rot?: number }
  | { k: 'path'; d: string };

interface PlugSpec {
  body:   Shape;
  pins:   Shape[];
  holes?: Shape[];   // receptacle for the socket's own earth pin (Type E)
  clips?: Shape[];   // side earth contacts (Type F)
  dy?:    number;    // vertical nudge to centre the body in the frame
}

const blade = (cx: number, cy: number, rot = 0): Shape => ({ k: 'rect', cx, cy, w: 1.63, h: 6.35, rx: 0.4, rot });
const pin   = (cx: number, cy: number, d: number): Shape => ({ k: 'circle', cx, cy, r: d / 2 });

const PLUGS: Record<string, PlugSpec> = {
  // NEMA 1-15: two flat blades, 12.7 mm centres
  A: {
    body: { k: 'rect', cx: 0, cy: 0, w: 30, h: 22, rx: 6 },
    pins: [blade(-6.35, 0), blade(6.35, 0)],
  },
  // NEMA 5-15: blades plus round earth pin below
  B: {
    body: { k: 'rect', cx: 0, cy: 0, w: 32, h: 30, rx: 7 },
    pins: [blade(-6.35, -5), blade(6.35, -5), pin(0, 6.5, 4.76)],
  },
  // CEE 7/16 Europlug: two 4 mm pins, 19 mm centres, flat body
  C: {
    body: { k: 'rect', cx: 0, cy: 0, w: 35, h: 13.6, rx: 6.8 },
    pins: [pin(-9.5, 0, 4), pin(9.5, 0, 4)],
  },
  // BS 546 5 A: large earth pin above, 19.1 mm L/N centres, earth 22.2 mm above
  D: {
    body: { k: 'circle', cx: 0, cy: -3.6, r: 19.5 },
    pins: [pin(-9.55, 8, 5.1), pin(9.55, 8, 5.1), pin(0, -14.2, 7.1)],
    dy: 3.6,
  },
  // CEE 7/5: two 4.8 mm pins, hole for the socket's earth pin 10 mm above
  E: {
    body:  { k: 'circle', cx: 0, cy: 0, r: 18.5 },
    pins:  [pin(-9.5, 0, 4.8), pin(9.5, 0, 4.8)],
    holes: [pin(0, -10, 5.4)],
  },
  // CEE 7/4 Schuko: two 4.8 mm pins, earth clips top and bottom
  F: {
    body:  { k: 'circle', cx: 0, cy: 0, r: 18.5 },
    pins:  [pin(-9.5, 0, 4.8), pin(9.5, 0, 4.8)],
    clips: [
      { k: 'rect', cx: 0, cy: -18.2, w: 7, h: 3, rx: 0.8 },
      { k: 'rect', cx: 0, cy: 18.2,  w: 7, h: 3, rx: 0.8 },
    ],
  },
  // BS 1363: 6.35 x 4 mm L/N 22.2 mm apart, 4 x 8 mm earth 22.2 mm above
  G: {
    body: { k: 'rect', cx: 0, cy: -1, w: 42, h: 46, rx: 6 },
    pins: [
      { k: 'rect', cx: -11.1, cy: 10, w: 6.35, h: 4, rx: 0.5 },
      { k: 'rect', cx: 11.1,  cy: 10, w: 6.35, h: 4, rx: 0.5 },
      { k: 'rect', cx: 0, cy: -12.2, w: 4, h: 8, rx: 0.5 },
    ],
    dy: 1,
  },
  // SI 32: three 4.5 mm round pins, L/N 19 mm apart, earth below
  H: {
    body: { k: 'rect', cx: 0, cy: 0, w: 32, h: 28, rx: 10 },
    pins: [pin(-9.5, -4, 4.5), pin(9.5, -4, 4.5), pin(0, 7, 4.5)],
  },
  // AS/NZS 3112: 6.35 x 1.63 mm blades at 30° (inverted V), earth 10.31 mm below centre
  I: {
    body: { k: 'rect', cx: 0, cy: 1, w: 32, h: 32, rx: 8 },
    pins: [blade(-7.92, -1, 30), blade(7.92, -1, -30), blade(0, 10.31)],
    dy: -1,
  },
  // SN 441011: two 4 mm pins 19 mm apart, earth 5 mm below, hexagonal body
  J: {
    body: { k: 'path', d: 'M -16 1 L -9.5 -8 L 9.5 -8 L 16 1 L 9.5 10 L -9.5 10 Z' },
    pins: [pin(-9.5, 0, 4), pin(9.5, 0, 4), pin(0, 5, 4)],
    dy: -1,
  },
  // DS 107-2-D1: two 4.8 mm pins 19 mm apart, D-shaped earth 13 mm below
  K: {
    body: { k: 'circle', cx: 0, cy: 2, r: 18.5 },
    pins: [
      pin(-9.5, -4, 4.8), pin(9.5, -4, 4.8),
      { k: 'path', d: 'M -3.16 7 A 3.25 3.25 0 1 0 3.16 7 Z' },
    ],
    dy: -2,
  },
  // CEI 23-50 10 A: three 4 mm pins in a row, 19 mm L/N centres
  L: {
    body: { k: 'rect', cx: 0, cy: 0, w: 33, h: 13, rx: 6.5 },
    pins: [pin(-9.5, 0, 4), pin(0, 0, 4), pin(9.5, 0, 4)],
  },
  // BS 546 15 A: 7.1 mm L/N 25.4 mm apart, 8.7 mm earth 28.6 mm above
  M: {
    body: { k: 'circle', cx: 0, cy: -4.7, r: 23 },
    pins: [pin(-12.7, 10, 7.1), pin(12.7, 10, 7.1), pin(0, -18.6, 8.7)],
    dy: 4.7,
  },
  // NBR 14136 10 A: three 4 mm pins, 19 mm L/N centres, earth offset 3 mm
  N: {
    body: { k: 'circle', cx: 0, cy: 1.5, r: 14 },
    pins: [pin(-9.5, 0, 4), pin(9.5, 0, 4), pin(0, 3, 4)],
    dy: -1.5,
  },
  // TIS 166-2549: three 4.8 mm pins, L/N 19 mm apart, earth 11.89 mm from the L/N line
  O: {
    body: { k: 'circle', cx: 0, cy: 2, r: 18 },
    pins: [pin(-9.5, -4, 4.8), pin(9.5, -4, 4.8), pin(0, 7.89, 4.8)],
    dy: -2,
  },
};

function renderShape(s: Shape, props: React.SVGProps<SVGElement>, key?: number) {
  if (s.k === 'circle') {
    return <circle key={key} cx={s.cx} cy={s.cy} r={s.r} {...(props as React.SVGProps<SVGCircleElement>)} />;
  }
  if (s.k === 'rect') {
    return (
      <rect
        key={key}
        x={s.cx - s.w / 2} y={s.cy - s.h / 2} width={s.w} height={s.h} rx={s.rx ?? 0}
        transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined}
        {...(props as React.SVGProps<SVGRectElement>)}
      />
    );
  }
  return <path key={key} d={s.d} {...(props as React.SVGProps<SVGPathElement>)} />;
}

export default function PlugFace({ type, size = 72, title }: { type: string; size?: number; title?: string }) {
  const uid  = `plug${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const spec = PLUGS[type];

  return (
    <svg width={size} height={size} viewBox="-28 -28 56 56" role="img" aria-label={title ?? `Type ${type} plug`}>
      <defs>
        <linearGradient id={`${uid}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EAE3D6" />
        </linearGradient>
        <linearGradient id={`${uid}p`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B4566" />
          <stop offset="1" stopColor={D.navy} />
        </linearGradient>
      </defs>

      {spec ? (
        <g transform={spec.dy ? `translate(0 ${spec.dy})` : undefined}>
          <g transform="translate(0 1.4)">
            {renderShape(spec.body, { fill: 'rgba(29,38,66,0.10)' })}
          </g>
          {renderShape(spec.body, { fill: `url(#${uid}b)`, stroke: 'rgba(29,38,66,0.28)', strokeWidth: 0.9, strokeLinejoin: 'round' })}
          {spec.clips?.map((s, i) => renderShape(s, { fill: '#8C93A8', stroke: D.navy, strokeOpacity: 0.35, strokeWidth: 0.5 }, i))}
          {spec.holes?.map((s, i) => renderShape(s, { fill: 'rgba(29,38,66,0.32)', stroke: D.navy, strokeOpacity: 0.8, strokeWidth: 1 }, i))}
          {spec.pins.map((s, i) => renderShape(s, { fill: `url(#${uid}p)` }, i))}
        </g>
      ) : (
        <>
          <circle cx={0} cy={0} r={18} fill={`url(#${uid}b)`} stroke="rgba(29,38,66,0.28)" strokeWidth={0.9} />
          <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={800} fill={D.navy}>{type}</text>
        </>
      )}
    </svg>
  );
}
