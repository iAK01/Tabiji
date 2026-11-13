'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, CircularProgress, ButtonBase, Button } from '@mui/material';
import { alpha }              from '@mui/material/styles';
import HelpOutlineIcon        from '@mui/icons-material/HelpOutline';
import MapIcon                from '@mui/icons-material/Map';
import FullscreenIcon         from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon     from '@mui/icons-material/FullscreenExit';
import type { Map as MapboxMap, Marker, Popup, GeoJSONSource, MapMouseEvent } from 'mapbox-gl';
import { airports as AIRPORT_DB } from '@/lib/data/airports';
import { useTabActive }       from '@/lib/hooks/useTabActive';
import { useTripRoutes }      from '@/lib/itinerary/useTripRoutes';
import { saveGapSorted }      from '@/lib/itinerary/gaps';
import { reportSaveFailure }  from '@/lib/offline/saveErrors';
import {
  legTravel, gapKey, isJourney, staysFrom, namedFrom, distanceKm, isPinned, pageStart, pointKey, SAME_PLACE_KM,
  type Leg, type LatLng, type Travel,
} from '@/lib/itinerary/dayPlan';
import {
  loadMapbox, pinElement, legLine, legCollection, addLegLayers, legsAt, fitPoints, MAP_STYLE, MAP_COLORS,
} from '@/components/maps/mapKit';
import { TravelIcon, travelText } from '@/components/itinerary/LegRow';
import { formatTime }         from '@/components/itinerary/Itinerary.helpers';
import type { Stop }          from '@/components/itinerary/Itinerary.config';

const D = {
  navy:    '#1D2642',
  green:   '#6B7C5C',
  terra:   '#C4714A',
  paper:   '#FDFAF5',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

/** Each day's places in its own colour on the whole-trip map */
const DAY_COLORS = ['#1D2642', '#C4714A', '#6B7C5C', '#5c35a0', '#0369a1', '#b45309', '#be185d', '#0f766e'];
const dayColor = (i: number) => DAY_COLORS[i % DAY_COLORS.length];

type Layer = 'all' | 'transport' | 'stays' | 'venues' | 'itinerary';
const LAYERS: { value: Layer; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'transport', label: 'Route' },
  { value: 'stays', label: 'Stays' }, { value: 'venues', label: 'Venues' },
  { value: 'itinerary', label: 'Itinerary' },
];

const SOURCE = 'trip-legs';
const TRIP_PARAMS = ['day', 'section', 'view', 'stop', 'leg', 'file', 'todo', 'expense', 'proof', 'sheet', 'i'];
const STATUS_IS_CONFIRMED = (s?: string) => s === 'confirmed' || s === 'booked';

interface Coordinates { lat: number; lng: number }
interface TripLocation { city: string; country: string; coordinates?: Coordinates }
interface Trip { _id: string; name: string; origin: TripLocation; destination: TripLocation; startDate: string; endDate: string }
interface Day { date: string; dayNumber: number; stops: Stop[] }
interface MapTabProps { tripId: string; trip: Trip }

interface Item { dayIdx: number; leg: Leg<Stop>; travel: Travel; gap: 'open' | 'sorted' | null; id: string }

const dayLabel = (date: string) =>
  new Date(`${String(date).slice(0, 10)}T12:00:00`).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });

/** The airport at a pin (the booking's own coordinates), for its code */
function airportAt(c: LatLng): string | null {
  let best: { iata: string; km: number } | null = null;
  for (const a of AIRPORT_DB) {
    if (Math.abs(a.lat - c.lat) > 0.1 || Math.abs(a.lng - c.lng) > 0.15) continue;
    const km = distanceKm(c, a);
    if (km <= 5 && (!best || km < best.km)) best = { iata: a.iata, km };
  }
  return best?.iata ?? null;
}

// The whole trip door to door: home to the airport, the flights between the
// airports booked, each transfer (asking how you're getting there when nothing's
// planned), and every day's places — a day opens on its own map in the itinerary.
// Built from the same day plans as the itinerary (lib/itinerary/dayPlan).
export default function MapTab({ tripId, trip }: MapTabProps) {
  const active     = useTabActive();
  const boxRef     = useRef<HTMLDivElement>(null);
  const mapRef     = useRef<MapboxMap | null>(null);
  const glRef      = useRef<typeof import('mapbox-gl').default | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupRef   = useRef<Popup | null>(null);
  const fittedRef  = useRef('');
  const clickRef   = useRef<(e: MapMouseEvent) => void>(() => {});

  const [loading,     setLoading]     = useState(true);
  const [days,        setDays]        = useState<Day[]>([]);
  const [dismissed,   setDismissed]   = useState<Set<string>>(new Set());
  const [logistics,   setLogistics]   = useState<any>(null);
  const [ready,       setReady]       = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [layer,       setLayer]       = useState<Layer>('all');
  const [dayIdx,      setDayIdx]      = useState(-1);   // -1 = the whole trip
  const [selected,    setSelected]    = useState<string | null>(null);
  const [expanded,    setExpanded]    = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/trips/${tripId}/itinerary`).then(r => r.json()).catch(() => null),
      fetch(`/api/trips/${tripId}/logistics`).then(r => r.json()).catch(() => null),
    ]).then(([it, l]) => {
      setDays(it?.days ?? []);
      setDismissed(new Set(it?.dismissedGaps ?? []));
      setLogistics(l?.logistics ?? null);
    }).finally(() => setLoading(false));
  }, [tripId]);

  const stays  = useMemo(() => staysFrom(logistics?.accommodation), [logistics]);
  const venues = useMemo(() => namedFrom(logistics?.venues), [logistics]);
  const { plans, routes } = useTripRoutes(tripId, days, stays, venues);

  const itemFor = (i: number, leg: Leg<Stop>): Item => {
    const travel = legTravel(leg, routes);
    const gap = travel.needsPlan ? (dismissed.has(gapKey(plans[i].date, leg)) ? 'sorted' : 'open') : null;
    return { dayIdx: i, leg, travel, gap, id: `${i}:${leg.id}` };
  };
  // Door to door across the trip, or every leg of the day picked
  const items = useMemo(
    () => (dayIdx === -1
      ? plans.flatMap((p, i) => p.legs.filter(isJourney).map(l => itemFor(i, l)))
      : (plans[dayIdx]?.legs ?? []).map(l => itemFor(dayIdx, l))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plans, routes, dismissed, dayIdx],
  );
  const openGaps = useMemo(
    () => plans.reduce((n, p, i) => n + p.legs.filter(l => itemFor(i, l).gap === 'open').length, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plans, routes, dismissed],
  );
  const daysWithPlaces = plans.map((p, i) => ({ i, n: p.groups.filter(g => g.places.length).length })).filter(d => d.n > 0);

  // Every itinerary place, once — with the days it's on
  const places = useMemo(() => {
    const byKey = new Map<string, { coordinates: LatLng; name: string; days: number[]; n: number[] }>();
    const list  = dayIdx === -1 ? plans.map((p, i) => ({ p, i })) : plans[dayIdx] ? [{ p: plans[dayIdx], i: dayIdx }] : [];
    for (const { p, i } of list) {
      for (const g of p.groups) {
        for (const pl of g.places) {
          const near = [...byKey.values()].find(v => distanceKm(v.coordinates, pl.coordinates) <= SAME_PLACE_KM);
          const v = near ?? { coordinates: pl.coordinates, name: pl.name, days: [], n: [] };
          if (!near) byKey.set(pointKey(pl.coordinates), v);
          if (!v.days.includes(i)) v.days.push(i);
          if (!v.n.includes(g.n)) v.n.push(g.n);
        }
      }
    }
    return [...byKey.values()];
  }, [plans, dayIdx]);

  // ── The map ──
  useEffect(() => {
    let cancelled = false;
    let made: MapboxMap | null = null;
    (async () => {
      const gl = await loadMapbox();
      if (cancelled) return;
      if (!gl || !boxRef.current) { setUnavailable(true); return; }
      glRef.current = gl;
      const centre = trip.destination?.coordinates;
      try {
        made = new gl.Map({
          container: boxRef.current, style: MAP_STYLE, attributionControl: false,
          center: centre ? [centre.lng, centre.lat] : [10, 50], zoom: centre ? 5 : 3,
        });
      } catch {
        setUnavailable(true);
        return;
      }
      made.addControl(new gl.AttributionControl({ compact: true }), 'bottom-right');
      made.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right');
      made.addControl(new gl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'top-right');
      made.on('error', e => console.error('[MapTab]', (e as any)?.error ?? e));
      made.on('click', e => clickRef.current(e));
      made.on('load', () => {
        if (cancelled || !made) return;
        addLegLayers(made, SOURCE);
        mapRef.current = made;
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      popupRef.current?.remove();
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      made?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one map for the tab's life
  }, []);

  useEffect(() => { if (active) mapRef.current?.resize(); }, [active]);
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.resize(), 320);
    return () => clearTimeout(t);
  }, [expanded]);

  // Into the itinerary: that day's map, a leg in view if one's given
  const openDay = (i: number, legId?: string) => {
    const day = days[i];
    if (!day) return;
    const params = new URLSearchParams(window.location.search);
    for (const k of TRIP_PARAMS) params.delete(k);
    params.set('tab', 'itinerary');
    params.set('day', String(day.dayNumber));
    params.set('view', 'map');
    if (legId) params.set('leg', legId);
    window.history.pushState(null, '', `?${params.toString()}`);
  };

  const setSorted = async (item: Item, sorted: boolean) => {
    const gap  = gapKey(plans[item.dayIdx].date, item.leg);
    const prev = dismissed;
    const next = new Set(prev);
    if (sorted) next.add(gap); else next.delete(gap);
    setDismissed(next);
    try {
      setDismissed(await saveGapSorted(tripId, gap, sorted, next));
    } catch (err) {
      setDismissed(prev);
      reportSaveFailure(sorted ? '“I’ve sorted this”' : 'asking about this journey again', err);
    }
  };

  // ── Popups, built as DOM: names come from imports and emails ──
  const showPopup = (at: LatLng, content: HTMLElement) => {
    const map = mapRef.current, gl = glRef.current;
    if (!map || !gl) return;
    popupRef.current?.remove();
    popupRef.current = new gl.Popup({ closeButton: false, offset: 16, maxWidth: '260px', className: 'tabiji-popup' })
      .setLngLat([at.lng, at.lat]).setDOMContent(content).addTo(map);
  };
  const popupBox = (title: string, lines: string[] = []) => {
    const box = document.createElement('div');
    box.style.cssText = 'font-family:"Archivo",system-ui,sans-serif;color:#1D2642;display:flex;flex-direction:column;gap:3px;';
    const h = document.createElement('div');
    h.style.cssText = 'font-weight:800;font-size:13px;line-height:1.3;';
    h.textContent = title;
    box.appendChild(h);
    for (const line of lines) {
      const d = document.createElement('div');
      d.style.cssText = 'font-size:11px;color:rgba(29,38,66,0.6);line-height:1.35;';
      d.textContent = line;
      box.appendChild(d);
    }
    return box;
  };
  const popupButton = (label: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'all:unset;cursor:pointer;min-height:34px;margin-top:4px;padding:0 10px;border-radius:8px;background:#1D2642;color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;';
    b.addEventListener('click', e => { e.stopPropagation(); popupRef.current?.remove(); onClick(); });
    return b;
  };

  clickRef.current = (e: MapMouseEvent) => {
    const map = mapRef.current;
    if (!map || (e.originalEvent?.target as HTMLElement | null)?.closest?.('.mapboxgl-marker')) return;
    const id   = legsAt(map, SOURCE, e.point)[0];
    const item = id ? items.find(it => it.id === id) : undefined;
    if (item) {
      setSelected(item.id);
      showPopup({ lat: e.lngLat.lat, lng: e.lngLat.lng }, popupBox(travelText(item.leg, item.travel), [`${item.leg.from.name} → ${item.leg.to.name}`, `Day ${days[item.dayIdx]?.dayNumber} · ${dayLabel(plans[item.dayIdx].date)}`]));
      return;
    }
    popupRef.current?.remove();
    setSelected(null);
  };

  const itemPoints = (it: Item) =>
    legLine(it.leg, it.travel, it.gap === 'open').coordinates.map(([lng, lat]) => ({ lat, lng }));

  const showRoute     = layer === 'all' || layer === 'transport';
  const showStays     = layer === 'all' || layer === 'stays';
  const showVenues    = layer === 'all' || layer === 'venues';
  const showItinerary = layer === 'all' || layer === 'itinerary';

  // ── Draw ──
  useEffect(() => {
    const map = mapRef.current, gl = glRef.current;
    if (!ready || !map || !gl || loading) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const points: LatLng[] = [];
    const add = (c: LatLng, el: HTMLElement) => {
      points.push(c);
      markersRef.current.push(new gl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(map));
    };

    if (showItinerary) {
      for (const pl of places) {
        const first = pl.days[0];
        const label = dayIdx === -1
          ? (pl.days.length > 2 ? `${days[first]?.dayNumber}+` : pl.days.map(i => days[i]?.dayNumber).join(','))
          : pl.n.join(',');
        const el = pinElement({ label, color: dayIdx === -1 ? dayColor(first) : D.navy, size: dayIdx === -1 ? 22 : 26, title: pl.name });
        el.addEventListener('click', ev => {
          ev.stopPropagation();
          const box = popupBox(pl.name, pl.days.map(i => `Day ${days[i]?.dayNumber} · ${dayLabel(plans[i].date)}`));
          for (const i of pl.days.slice(0, 4)) box.appendChild(popupButton(`Open day ${days[i]?.dayNumber}’s map`, () => openDay(i)));
          showPopup(pl.coordinates, box);
        });
        add(pl.coordinates, el);
      }
    }

    if (showStays) {
      for (const s of stays) {
        if (!isPinned(s.coordinates)) continue;
        const el = pinElement({ icon: 'hotel', color: MAP_COLORS.stay, title: s.name });
        el.addEventListener('click', ev => {
          ev.stopPropagation();
          showPopup(s.coordinates!, popupBox(s.name, [s.address ?? '', `${dayLabel(s.checkIn)} – ${dayLabel(s.checkOut)}`].filter(Boolean)));
        });
        add(s.coordinates, el);
      }
    }

    // Venues the itinerary already pins are shown as its places; the rest here
    if (showVenues) {
      for (const v of logistics?.venues ?? []) {
        if (!isPinned(v.coordinates)) continue;
        if (layer === 'all' && showItinerary && places.some(p => distanceKm(p.coordinates, v.coordinates) <= SAME_PLACE_KM)) continue;
        const el = pinElement({ color: D.navy, size: 16, outline: true, title: v.name });
        el.addEventListener('click', ev => {
          ev.stopPropagation();
          showPopup(v.coordinates, popupBox(v.name, [v.type ?? '', v.address ?? ''].filter(Boolean)));
        });
        add(v.coordinates, el);
      }
    }

    const drawn = showRoute ? items : [];
    if (showRoute) {
      const homes = new Map<string, LatLng>();
      for (const it of drawn) for (const p of [it.leg.from, it.leg.to]) if (p.kind === 'home') homes.set(p.key, p.coordinates);
      for (const c of homes.values()) add(c, pinElement({ icon: 'home', color: D.navy, title: 'Home' }));
    }
    (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(legCollection(drawn.map(it => {
      const line = legLine(it.leg, it.travel, it.gap === 'open');
      return { id: it.id, style: line.style, coordinates: line.coordinates, selected: it.id === selected };
    })));
    for (const it of drawn) points.push(...itemPoints(it));

    const fitKey = `${layer}|${dayIdx}|${points.length}`;
    if (fittedRef.current !== fitKey) {
      const first = fittedRef.current === '';
      fittedRef.current = fitKey;
      fitPoints(gl, map, points, 56, !first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redrawn from these
  }, [ready, loading, items, places, stays, logistics, layer, dayIdx, selected]);

  const selectItem = (it: Item) => {
    const next = selected === it.id ? null : it.id;
    setSelected(next);
    popupRef.current?.remove();
    const map = mapRef.current, gl = glRef.current;
    if (next && map && gl) fitPoints(gl, map, itemPoints(it), 64);
  };

  // Rows, with a heading per day
  const rows: Array<{ head: number } | { item: Item }> = [];
  for (const it of items) {
    const last = rows[rows.length - 1];
    if (!last || ('item' in last && last.item.dayIdx !== it.dayIdx)) rows.push({ head: it.dayIdx });
    rows.push({ item: it });
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden' }}>
        {/* Layers + expand */}
        <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 0.5, alignItems: 'center', backgroundColor: 'rgba(253,250,245,0.95)', backdropFilter: 'blur(4px)', borderRadius: 1.5, p: 0.5, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: 'calc(100% - 70px)', overflowX: 'auto' }}>
          {LAYERS.map(l => (
            <Box key={l.value} component="button" onClick={() => setLayer(l.value)} sx={{ background: layer === l.value ? D.navy : 'transparent', color: layer === l.value ? 'white' : D.muted, border: 'none', borderRadius: 1, px: { xs: 1, sm: 1.5 }, minHeight: 32, fontSize: '0.72rem', fontWeight: 800, fontFamily: D.body, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.02em', transition: 'background 0.15s, color 0.15s' }}>
              {l.label}
            </Box>
          ))}
          <Box component="button" onClick={() => setExpanded(e => !e)} aria-label={expanded ? 'Collapse map' : 'Expand map'} title={expanded ? 'Collapse map' : 'Expand map'} sx={{ background: 'transparent', border: 'none', borderRadius: 1, px: 0.75, minHeight: 32, display: 'flex', alignItems: 'center', cursor: 'pointer', color: D.muted, ml: 0.25, '&:hover': { color: D.navy } }}>
            {expanded ? <FullscreenExitIcon sx={{ fontSize: 16 }} /> : <FullscreenIcon sx={{ fontSize: 16 }} />}
          </Box>
        </Box>

        <Box ref={boxRef} sx={{ width: '100%', height: expanded ? { xs: '72vh', sm: '80vh' } : { xs: 340, sm: 440, md: 500 }, backgroundColor: '#f0ede8', transition: 'height 0.3s ease' }} />

        {(loading || (!ready && !unavailable)) && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,240,232,0.85)' }}>
            <CircularProgress size={32} sx={{ color: D.green }} />
          </Box>
        )}
        {unavailable && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,240,232,0.95)' }}>
            <Box sx={{ textAlign: 'center', px: 3 }}>
              <MapIcon sx={{ fontSize: 40, color: D.muted, mb: 1 }} />
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: D.muted }}>Map unavailable</Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Days */}
      {daysWithPlaces.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, pt: 1.5, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          {[{ i: -1 }, ...daysWithPlaces].map(({ i }) => {
            const on = dayIdx === i;
            return (
              <Box
                key={i}
                component="button"
                onClick={() => { setDayIdx(i); setSelected(null); popupRef.current?.remove(); }}
                sx={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.75,
                  background: on ? D.navy : 'transparent', color: on ? 'white' : D.navy,
                  border: `1.5px solid ${on ? D.navy : D.rule}`, borderRadius: 1, px: 1.25, minHeight: 36,
                  fontSize: '0.75rem', fontWeight: 800, fontFamily: D.body, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {i >= 0 && <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dayColor(i), border: on ? '1px solid #fff' : 'none' }} />}
                {i === -1 ? 'Whole trip' : `Day ${days[i]?.dayNumber}`}
              </Box>
            );
          })}
        </Box>
      )}

      {dayIdx >= 0 && plans[dayIdx] && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 1.5 }}>
          <Typography sx={{ flex: 1, minWidth: 0, fontFamily: D.body, fontWeight: 700, fontSize: '0.88rem', color: D.navy }}>
            Day {days[dayIdx]?.dayNumber} · {dayLabel(plans[dayIdx].date)}
          </Typography>
          <Button
            variant="outlined" startIcon={<MapIcon />} onClick={() => openDay(dayIdx)}
            sx={{ minHeight: 44, fontFamily: D.body, fontWeight: 800, color: D.navy, borderColor: alpha(D.navy, 0.25), flexShrink: 0 }}
          >
            Open in itinerary
          </Button>
        </Box>
      )}

      <Box sx={{ pt: 3, pb: 2 }}>
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontFamily: D.display, fontSize: { xs: '1.5rem', sm: '1.75rem' }, color: D.navy, lineHeight: 1, letterSpacing: '-0.03em', mb: 0.5 }}>
            {trip.origin?.city} → {trip.destination?.city}
          </Typography>
          {openGaps > 0 && (
            <Typography sx={{ fontSize: '0.85rem', color: D.terra, fontWeight: 600, fontFamily: D.body }}>
              {openGaps} {openGaps === 1 ? 'journey' : 'journeys'} with no way planned
            </Typography>
          )}
        </Box>

        {rows.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {rows.map((r, k) => ('head' in r ? (
              <Typography key={`h${r.head}-${k}`} sx={{ pt: k ? 1.5 : 0, fontFamily: D.body, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: D.muted }}>
                Day {days[r.head]?.dayNumber} · {dayLabel(plans[r.head].date)}
              </Typography>
            ) : r.item.leg.kind === 'flight' ? (
              <FlightCard key={r.item.id} item={r.item} booking={bookingFor(r.item.leg, logistics)} selected={selected === r.item.id} onSelect={() => selectItem(r.item)} />
            ) : (
              <JourneyCard
                key={r.item.id} item={r.item} selected={selected === r.item.id}
                onSelect={() => selectItem(r.item)}
                onPlan={() => openDay(r.item.dayIdx, r.item.leg.id)}
                onSorted={v => setSorted(r.item, v)}
              />
            )))}
          </Box>
        ) : !loading && (
          <Typography sx={{ fontSize: '0.9rem', color: D.muted, py: 2, fontFamily: D.body }}>
            {dayIdx === -1 ? 'No journeys yet.' : 'Nothing to get between on this day.'}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/** The booking a flight leg mirrors, for its airline, number, seat and reference */
function bookingFor(leg: Leg<Stop>, logistics: any): any | null {
  const ref = leg.ride?.logisticsRef;
  return ref?.collection === 'transport' ? logistics?.transportation?.[ref.index] ?? null : null;
}

function FlightCard({ item, booking, selected, onSelect }: { item: Item; booking: any | null; selected: boolean; onSelect: () => void }) {
  const { leg } = item;
  const confirmed = STATUS_IS_CONFIRMED(booking?.status);
  const from = airportAt(leg.from.coordinates) ?? leg.from.name;
  const to   = airportAt(leg.to.coordinates)   ?? leg.to.name;
  const dep  = leg.ride ? pageStart(leg.ride) : null;
  const d    = booking?.details ?? {};
  return (
    <ButtonBase
      onClick={onSelect}
      sx={{
        display: 'block', textAlign: 'left', width: '100%',
        borderLeft: `3px solid ${booking ? (confirmed ? D.green : D.terra) : D.navy}`,
        backgroundColor: selected ? 'rgba(29,38,66,0.06)' : D.paper,
        borderRadius: '0 8px 8px 0', px: 2.5, py: 2,
        outline: selected ? `2px solid ${D.navy}` : '2px solid transparent', outlineOffset: -2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 0.75 }}>
        <Typography sx={{ fontFamily: D.display, fontSize: { xs: '1.75rem', sm: '2rem' }, color: D.navy, lineHeight: 1, letterSpacing: '-0.03em' }}>
          {dep !== null ? formatTime(dep) : '—'}
        </Typography>
        <Typography sx={{ color: D.muted, fontSize: '1rem', fontWeight: 700, lineHeight: 1 }}>→</Typography>
        <Typography sx={{ fontFamily: D.display, fontSize: { xs: '1.75rem', sm: '2rem' }, color: D.navy, lineHeight: 1, letterSpacing: '-0.03em' }}>
          {leg.arriveBy !== null ? formatTime(leg.arriveBy) : '—'}
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <TravelIcon leg={leg} travel={item.travel} size={15} />
          {booking && (
            <Box sx={{ px: 1, py: 0.3, borderRadius: 0.75, backgroundColor: confirmed ? 'rgba(107,124,92,0.12)' : 'rgba(196,113,74,0.10)', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: confirmed ? D.green : D.terra }}>
              {confirmed ? 'Booked' : booking.status}
            </Box>
          )}
        </Box>
      </Box>
      <Typography sx={{ fontFamily: D.display, fontSize: { xs: '1.2rem', sm: '1.4rem' }, color: D.navy, lineHeight: 1.1, letterSpacing: '-0.02em', mb: 1 }}>
        {from} → {to}
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {d.airline && <Typography sx={{ fontSize: '0.8rem', color: D.muted }}>{d.airline}</Typography>}
        {d.flightNumber && <Typography sx={{ fontSize: '0.8rem', color: D.muted, fontWeight: 700 }}>{d.flightNumber}</Typography>}
        {d.seat && <Typography sx={{ fontSize: '0.8rem', color: D.muted }}>Seat {d.seat}</Typography>}
        {booking?.confirmationNumber && <Typography sx={{ fontSize: '0.78rem', color: D.muted, fontFamily: 'monospace', letterSpacing: '0.1em' }}>{booking.confirmationNumber}</Typography>}
        {item.travel.minutes !== null && <Typography sx={{ fontSize: '0.8rem', color: D.muted }}>{travelText(leg, item.travel)}</Typography>}
      </Box>
    </ButtonBase>
  );
}

function JourneyCard({ item, selected, onSelect, onPlan, onSorted }: {
  item: Item; selected: boolean; onSelect: () => void; onPlan: () => void; onSorted: (sorted: boolean) => void;
}) {
  const { leg, travel, gap } = item;
  const asking = gap === 'open';
  const when = leg.kind === 'ride' && leg.leaveAfter !== null
    ? `${formatTime(leg.leaveAfter)}${leg.arriveBy !== null ? `–${formatTime(leg.arriveBy)}` : ''}`
    : leg.arriveBy !== null ? `by ${formatTime(leg.arriveBy)}`
    : leg.leaveAfter !== null ? `from ${formatTime(leg.leaveAfter)}` : '';
  return (
    <Box sx={{
      borderLeft: `3px ${asking ? 'dashed' : 'solid'} ${asking ? D.terra : D.navy}`,
      backgroundColor: asking ? 'rgba(196,113,74,0.05)' : selected ? 'rgba(29,38,66,0.06)' : D.paper,
      borderRadius: '0 8px 8px 0',
      outline: selected ? `2px solid ${asking ? D.terra : D.navy}` : '2px solid transparent', outlineOffset: -2,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <ButtonBase onClick={onSelect} sx={{ display: 'flex', flex: 1, minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', gap: 1.5, px: 2.5, py: 1.75, minHeight: 56 }}>
        {asking ? <HelpOutlineIcon sx={{ fontSize: 20, color: D.terra, flexShrink: 0 }} /> : <TravelIcon leg={leg} travel={travel} size={20} />}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: D.display, fontSize: { xs: '1rem', sm: '1.1rem' }, color: D.navy, lineHeight: 1.25, letterSpacing: '-0.01em' }}>
            {leg.from.name} → {leg.to.name}
          </Typography>
          <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: asking ? D.terra : D.muted, mt: 0.25 }}>
            {[when, asking ? 'nothing planned' : travelText(leg, travel)].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      </ButtonBase>
      {gap === 'sorted' && (
        <ButtonBase
          onClick={() => onSorted(false)}
          title="Ask about this again"
          aria-label="Sorted. Ask about this again"
          sx={{ flexShrink: 0, minHeight: 44, px: 1, mr: 1, borderRadius: 4 }}
        >
          <Box component="span" sx={{ px: 1, py: 0.5, borderRadius: 4, fontFamily: D.body, fontSize: '0.66rem', fontWeight: 800, color: D.green, backgroundColor: alpha(D.green, 0.12) }}>
            Sorted
          </Box>
        </ButtonBase>
      )}
      </Box>
      {asking && (
        <Box sx={{ display: 'flex', gap: 1, px: 2.5, pb: 1.75, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={onPlan} sx={{ minHeight: 44, flex: 1, fontFamily: D.body, fontWeight: 800, backgroundColor: D.navy, boxShadow: 'none', '&:hover': { backgroundColor: D.navy, boxShadow: 'none' } }}>
            Plan it
          </Button>
          <Button variant="outlined" onClick={() => onSorted(true)} sx={{ minHeight: 44, flex: 1, fontFamily: D.body, fontWeight: 800, color: D.navy, borderColor: alpha(D.navy, 0.25) }}>
            I’ve sorted this
          </Button>
        </Box>
      )}
    </Box>
  );
}
