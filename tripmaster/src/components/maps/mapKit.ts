'use client';

// What the day map and the trip map draw with: Mapbox loaded on demand, pins
// built as DOM (text set with textContent — names come from imports and emails),
// and legs as one GeoJSON source with a layer per line style.

import type { Map as MapboxMap } from 'mapbox-gl';
import { decodePolyline } from '@/lib/geo/polyline';
import type { LatLng, Leg, Travel } from '@/lib/itinerary/dayPlan';

export const MAP_STYLE = 'mapbox://styles/mapbox/light-v11';

export const MAP_COLORS = {
  navy:   '#1D2642',
  terra:  '#C4714A',
  green:  '#6B7C5C',
  stay:   '#5c35a0',
  ride:   '#0369a1',
  flight: '#C9521B',
  muted:  '#9aa0ac',
};

/** Material icon paths (24×24), for pins drawn outside React */
export const ICON_PATH = {
  hotel: 'M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z',
  home:  'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
};

/** mapbox-gl, with the token set; null when it can't load (offline, no token) */
export async function loadMapbox(): Promise<typeof import('mapbox-gl').default | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const { default: mapboxgl } = await import('mapbox-gl');
    mapboxgl.accessToken = token;
    return mapboxgl;
  } catch {
    return null;
  }
}

/** A round pin: a number, or an icon */
export function pinElement(opts: {
  label?:    string;
  icon?:     keyof typeof ICON_PATH;
  color:     string;
  size?:     number;
  selected?: boolean;
  outline?:  boolean;   // white fill, coloured ring — an idea, not a plan
  title?:    string;
}): HTMLDivElement {
  const { label, icon, color, size = 28, selected = false, outline = false, title } = opts;
  const el = document.createElement('div');
  const s  = selected ? Math.round(size * 1.25) : size;
  el.style.cssText = [
    `width:${s}px`, `height:${s}px`, 'border-radius:50%',
    `background:${outline ? '#fff' : color}`, `color:${outline ? color : '#fff'}`,
    `border:${outline ? `2px solid ${color}` : '2.5px solid #fff'}`,
    `box-shadow:${selected ? `0 0 0 3px ${color}55, ` : ''}0 2px 6px rgba(0,0,0,0.3)`,
    'display:flex', 'align-items:center', 'justify-content:center', 'cursor:pointer',
    `font:800 ${label && label.length > 3 ? 10 : 12}px "Archivo", system-ui, sans-serif`,
    'line-height:1', 'white-space:nowrap', 'box-sizing:border-box', 'transition:width .15s,height .15s',
  ].join(';');
  if (title) el.title = title;
  if (icon) {
    const svg  = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(Math.round(s * 0.55)));
    svg.setAttribute('height', String(Math.round(s * 0.55)));
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', ICON_PATH[icon]);
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    el.appendChild(svg);
  } else if (label) {
    el.textContent = label;
  }
  return el;
}

/** A gentle curve between two points, for a flight */
export function arc(from: LatLng, to: LatLng, steps = 64): [number, number][] {
  const dx = to.lng - from.lng, dy = to.lat - from.lat;
  const bend = 0.2;
  const cx = (from.lng + to.lng) / 2 - dy * bend;
  const cy = (from.lat + to.lat) / 2 + dx * bend;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, u = 1 - t;
    return [u * u * from.lng + 2 * u * t * cx + t * t * to.lng, u * u * from.lat + 2 * u * t * cy + t * t * to.lat];
  });
}

export type LineStyle = 'walk' | 'drive' | 'ride' | 'flight' | 'gap' | 'unknown';

/** How a leg is drawn, and along what */
export function legLine(leg: Leg<unknown>, travel: Travel, gap: boolean): { style: LineStyle; coordinates: [number, number][] } {
  const straight: [number, number][] = [[leg.from.coordinates.lng, leg.from.coordinates.lat], [leg.to.coordinates.lng, leg.to.coordinates.lat]];
  if (leg.kind === 'flight') return { style: 'flight', coordinates: arc(leg.from.coordinates, leg.to.coordinates) };
  if (leg.kind === 'ride')   return { style: 'ride', coordinates: straight };
  const path = travel.line ? decodePolyline(travel.line) : null;
  const coordinates = path && path.length > 1 ? path : straight;
  if (gap) return { style: 'gap', coordinates };
  return { style: travel.mode === 'walk' ? 'walk' : travel.mode === 'drive' ? 'drive' : 'unknown', coordinates };
}

export interface LegFeature { id: string; style: LineStyle; coordinates: [number, number][]; selected: boolean; faint?: boolean }

export function legCollection(features: LegFeature[]) {
  return {
    type: 'FeatureCollection' as const,
    features: features.map(f => ({
      type: 'Feature' as const,
      properties: { id: f.id, style: f.style, selected: f.selected, faint: !!f.faint },
      geometry: { type: 'LineString' as const, coordinates: f.coordinates },
    })),
  };
}

const LINE_STYLES: Array<{ style: LineStyle; color: string; dash?: number[] }> = [
  { style: 'drive',   color: MAP_COLORS.navy },
  { style: 'walk',    color: MAP_COLORS.navy,   dash: [0.1, 1.8] },
  { style: 'ride',    color: MAP_COLORS.ride,   dash: [2, 1.5] },
  { style: 'flight',  color: MAP_COLORS.flight, dash: [2, 2] },
  { style: 'gap',     color: MAP_COLORS.terra,  dash: [1.2, 1.2] },
  { style: 'unknown', color: MAP_COLORS.muted,  dash: [1, 2] },
];

/** The legs source and its layers (once per map); then setData on the source to redraw */
export function addLegLayers(map: MapboxMap, id: string) {
  if (map.getSource(id)) return;
  map.addSource(id, { type: 'geojson', data: legCollection([]) });
  const width = ['case', ['get', 'selected'], 6, ['get', 'faint'], 2, 3.5] as any;
  map.addLayer({
    id: `${id}-casing`, type: 'line', source: id,
    filter: ['!=', ['get', 'style'], 'walk'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': ['+', width, 3] as any, 'line-opacity': ['case', ['get', 'faint'], 0.4, 0.9] as any },
  });
  for (const l of LINE_STYLES) {
    map.addLayer({
      id: `${id}-${l.style}`, type: 'line', source: id,
      filter: ['==', ['get', 'style'], l.style],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color':   l.color,
        'line-width':   width,
        'line-opacity': ['case', ['get', 'faint'], 0.45, 0.95] as any,
        ...(l.dash && { 'line-dasharray': l.dash }),
      },
    });
  }
}

/** The leg ids drawn under a tap, topmost first */
export function legsAt(map: MapboxMap, id: string, point: { x: number; y: number }): string[] {
  const layers = LINE_STYLES.map(l => `${id}-${l.style}`).filter(l => map.getLayer(l));
  const box: [[number, number], [number, number]] = [[point.x - 8, point.y - 8], [point.x + 8, point.y + 8]];
  return map.queryRenderedFeatures(box, { layers }).map(f => String(f.properties?.id ?? '')).filter(Boolean);
}

/** Fit the map to these points; one point is centred at street level */
export function fitPoints(mapboxgl: typeof import('mapbox-gl').default, map: MapboxMap, points: LatLng[], padding: number | { top: number; bottom: number; left: number; right: number } = 48, animate = true) {
  if (!points.length) return;
  if (points.length === 1) {
    map.easeTo({ center: [points[0].lng, points[0].lat], zoom: 15, duration: animate ? 600 : 0 });
    return;
  }
  const b = new mapboxgl.LngLatBounds();
  for (const p of points) b.extend([p.lng, p.lat]);
  map.fitBounds(b, { padding, maxZoom: 16, duration: animate ? 600 : 0 });
}
