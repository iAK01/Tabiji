'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, ButtonBase, Chip, IconButton } from '@mui/material';
import { alpha }               from '@mui/material/styles';
import HotelIcon               from '@mui/icons-material/Hotel';
import HomeIcon                from '@mui/icons-material/Home';
import ZoomOutMapIcon          from '@mui/icons-material/ZoomOutMap';
import LightbulbOutlinedIcon   from '@mui/icons-material/LightbulbOutlined';
import LocationOffOutlinedIcon from '@mui/icons-material/LocationOffOutlined';
import MapIcon                 from '@mui/icons-material/Map';
import type { Map as MapboxMap, Marker, Popup, GeoJSONSource, MapMouseEvent } from 'mapbox-gl';
import { useTabActive }        from '@/lib/hooks/useTabActive';
import {
  legTravel, gapKey, distanceKm, isPinned, pageStart, SAME_PLACE_KM,
  type DayPlan, type Leg, type LegRoutes, type LatLng, type Place, type Group, type Travel,
} from '@/lib/itinerary/dayPlan';
import {
  loadMapbox, pinElement, legLine, legCollection, addLegLayers, legsAt, fitPoints, MAP_STYLE, MAP_COLORS,
} from '@/components/maps/mapKit';
import { D } from './Itinerary.config';
import type { Stop } from './Itinerary.config';
import { formatTime } from './Itinerary.helpers';
import { LegRow, travelText, type GapState } from './LegRow';

/** A place to add to the day, from the map or Discover */
export interface NewPlace { name: string; address?: string; coordinates: LatLng; type: string; notes?: string; duration?: number }

type Slot = { start: number; end: number; mins: number };
type Selection = { kind: 'leg'; id: string } | { kind: 'place'; key: string } | null;
interface Pin { place: Place; numbers: number[]; sameTime: boolean; groups: Group<Stop>[] }
interface Idea extends NewPlace { key: string }

const SOURCE = 'day-legs';
/** Ideas further than this from everywhere the day goes aren't for this day */
const IDEA_REACH_KM = 15;

interface Props {
  tripId:     string;
  plan:       DayPlan<Stop>;
  routes:     Record<string, LegRoutes> | null;
  /** gapKeys you've said are sorted */
  dismissed:  Set<string>;
  isMobile:   boolean;
  /** Now, in this page's minutes — only on the page now falls on */
  nowMins:    number | null;
  /** Bring a leg or a stop into view (seq changes each time it's asked) */
  focus:      { leg?: string; stop?: string; seq: number } | null;
  /** Free time on this page — where a place picked on the map would fit */
  slots:      Slot[];
  onOpenStop:     (stop: Stop) => void;
  onAddTransport: (leg: Leg<Stop>) => void;
  onSorted:       (leg: Leg<Stop>, sorted: boolean) => void;
  /** A place to add; start = the free slot it fits best (page minutes), null when the day's full */
  onAddPlace:     (place: NewPlace, start: number | null) => void;
}

const spreadLabel = (places: Place[]) => {
  let most = 0;
  for (const a of places) for (const b of places) most = Math.max(most, distanceKm(a.coordinates, b.coordinates));
  return most < 1 ? `${Math.round(most * 20) * 50} m apart` : `${most.toFixed(1)} km apart`;
};

const ideaType = (kind: string) =>
  ['coffee', 'food', 'drinks'].includes(kind) ? 'meal' : ['park', 'nature', 'activity', 'nightlife', 'shopping'].includes(kind) ? 'activity' : 'sightseeing';

// The day on a map: a numbered pin per place in the order you get there, the way
// between them, and the same order as a list underneath — where you start, each
// leg, each stop, where you sleep. Stops at the same time in different places
// are one number with no line between them: which one is decided on the day.
export function DayMap({
  tripId, plan, routes, dismissed, isMobile, nowMins, focus, slots,
  onOpenStop, onAddTransport, onSorted, onAddPlace,
}: Props) {
  const active     = useTabActive();
  const boxRef     = useRef<HTMLDivElement>(null);
  const mapRef     = useRef<MapboxMap | null>(null);
  const glRef      = useRef<typeof import('mapbox-gl').default | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupRef   = useRef<Popup | null>(null);
  const fittedRef  = useRef('');
  const clickRef   = useRef<(e: MapMouseEvent) => void>(() => {});
  const [ready,       setReady]       = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [selected,    setSelected]    = useState<Selection>(null);
  const [ideas,       setIdeas]       = useState<Idea[]>([]);
  const [showIdeas,   setShowIdeas]   = useState(false);

  const travels = useMemo(() => new Map(plan.legs.map(l => [l.id, legTravel(l, routes)])), [plan, routes]);
  const travelOf = (leg: Leg<Stop>): Travel => travels.get(leg.id) ?? legTravel(leg, routes);
  const gapOf = (leg: Leg<Stop>): GapState =>
    !travelOf(leg).needsPlan ? null : dismissed.has(gapKey(plan.date, leg)) ? 'sorted' : 'open';

  // Every place drawn: where you start and sleep, each group's places, where rides drop you
  const pins = useMemo(() => {
    const byKey = new Map<string, Pin>();
    const add = (p: Place) => {
      if (!byKey.has(p.key)) byKey.set(p.key, { place: p, numbers: [], sameTime: false, groups: [] });
      return byKey.get(p.key)!;
    };
    if (plan.startAt) add(plan.startAt);
    for (const g of plan.groups) {
      for (const p of g.places) {
        const pin = add(p);
        if (!pin.numbers.includes(g.n)) pin.numbers.push(g.n);
        pin.groups.push(g);
        if (g.places.length > 1) pin.sameTime = true;
      }
    }
    for (const l of plan.legs) { add(l.from); add(l.to); }
    return [...byKey.values()];
  }, [plan]);

  const pinFor = (stop: Stop) => (isPinned(stop.coordinates)
    ? pins.find(p => distanceKm(p.place.coordinates, stop.coordinates!) <= SAME_PLACE_KM) ?? null
    : null);

  // ── Discover's picks and what you've saved, near where the day goes ──
  useEffect(() => {
    let live = true;
    Promise.all([
      fetch(`/api/trips/${tripId}/culture`).then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/trips/${tripId}/saved`).then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([culture, saved]) => {
      if (!live) return;
      const picks = (culture?.culture?.briefing?.highlights ?? []).map((h: any) => ({
        key: `pick:${h.id ?? h.name}`, name: h.name, address: h.address, coordinates: h.coordinates,
        type: ideaType(h.type ?? h.category ?? ''), notes: h.tip || h.description || undefined,
      }));
      const mine = (saved?.places ?? []).filter((p: any) => p.kind === 'place').map((p: any) => ({
        key: `saved:${p.id}`, name: p.name, address: p.address || undefined, coordinates: p.coordinates,
        type: ideaType(p.category ?? ''), notes: p.tip || p.summary || undefined,
      }));
      const seen = new Set<string>();
      setIdeas([...mine, ...picks].filter((i: Idea) => {
        const k = i.name?.trim().toLowerCase();
        if (!k || !isPinned(i.coordinates) || seen.has(k)) return false;
        seen.add(k);
        return true;
      }));
    });
    return () => { live = false; };
  }, [tripId]);

  const nearbyIdeas = useMemo(() => {
    const where = pins.map(p => p.place.coordinates);
    return where.length ? ideas.filter(i => where.some(c => distanceKm(c, i.coordinates) <= IDEA_REACH_KM)) : [];
  }, [ideas, pins]);

  // The free slot a place fits best: the least out of the way between the places either side
  const bestSlot = (at: LatLng): Slot | null => {
    const usable = slots.filter(s => s.mins >= 30);
    if (!usable.length) return null;
    const located = plan.groups.filter(g => g.places.length);
    const before  = (m: number) => [...located].reverse().find(g => g.end <= m)?.places.at(-1) ?? plan.startAt;
    const after   = (m: number) => located.find(g => g.start >= m)?.places[0] ?? plan.endAt;
    const cost = (s: Slot) => {
      const b = before(s.start), a = after(s.end);
      return (b ? distanceKm(b.coordinates, at) : 0) + (a ? distanceKm(at, a.coordinates) : 0);
    };
    return usable.reduce((best, s) => (cost(s) < cost(best) - 0.05 || (Math.abs(cost(s) - cost(best)) <= 0.05 && s.mins > best.mins) ? s : best));
  };

  // ── The map ──
  useEffect(() => {
    let cancelled = false;
    let made: MapboxMap | null = null;
    (async () => {
      const gl = await loadMapbox();
      if (cancelled) return;
      if (!gl || !boxRef.current) { setUnavailable(true); return; }
      glRef.current = gl;
      const first = plan.groups.find(g => g.places.length)?.places[0]?.coordinates ?? plan.startAt?.coordinates;
      try {
        made = new gl.Map({
          container: boxRef.current, style: MAP_STYLE, attributionControl: false,
          center: first ? [first.lng, first.lat] : [0, 30], zoom: first ? 13 : 1,
        });
      } catch {
        setUnavailable(true);
        return;
      }
      made.addControl(new gl.AttributionControl({ compact: true }), 'bottom-left');
      if (!isMobile) made.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right');
      made.addControl(new gl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserHeading: true,
      }), 'top-right');
      made.on('error', e => console.error('[DayMap]', (e as any)?.error ?? e));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one map for the life of the view
  }, []);

  // Back on screen after another tab (the window may have changed size meanwhile)
  useEffect(() => { if (active) mapRef.current?.resize(); }, [active]);

  const showPopup = (at: LatLng, content: HTMLElement) => {
    const map = mapRef.current, gl = glRef.current;
    if (!map || !gl) return;
    popupRef.current?.remove();
    popupRef.current = new gl.Popup({ closeButton: false, offset: 18, maxWidth: '260px', className: 'tabiji-popup' })
      .setLngLat([at.lng, at.lat]).setDOMContent(content).addTo(map);
  };

  // Popup content, built as DOM: names come from imports and emails
  const popupBox = (title: string, sub?: string) => {
    const box = document.createElement('div');
    box.style.cssText = 'font-family:"Archivo",system-ui,sans-serif;color:#1D2642;display:flex;flex-direction:column;gap:4px;';
    const h = document.createElement('div');
    h.style.cssText = 'font-weight:800;font-size:13px;line-height:1.3;';
    h.textContent = title;
    box.appendChild(h);
    if (sub) {
      const s = document.createElement('div');
      s.style.cssText = 'font-size:11px;color:rgba(29,38,66,0.6);line-height:1.35;';
      s.textContent = sub;
      box.appendChild(s);
    }
    return box;
  };
  const popupButton = (label: string, onClick: () => void, strong = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = `all:unset;cursor:pointer;min-height:36px;display:flex;align-items:center;font-size:12px;font-weight:${strong ? 800 : 700};`
      + (strong ? 'margin-top:4px;padding:0 10px;border-radius:8px;background:#1D2642;color:#fff;justify-content:center;' : 'color:#1D2642;border-top:1px solid rgba(29,38,66,0.08);');
    b.addEventListener('click', e => { e.stopPropagation(); popupRef.current?.remove(); onClick(); });
    return b;
  };
  const slotText = (s: Slot | null) => (s ? `Add · free ${formatTime(s.start)}–${formatTime(s.end)}` : 'Add to this day');

  const placePopup = (pin: Pin) => {
    const kindLabel = pin.place.kind === 'home' ? 'Home'
      : pin.place.kind === 'stay' ? (pin.place === plan.endAt ? 'Where you sleep' : 'Where you’re staying')
      : undefined;
    const box = popupBox(pin.place.name, kindLabel);
    for (const g of pin.groups) {
      for (const s of g.stops) {
        if (pinFor(s) !== pin) continue;
        const start = pageStart(s);
        box.appendChild(popupButton(`${start !== null ? `${formatTime(start)}  ` : ''}${s.name}`, () => onOpenStop(s)));
      }
    }
    showPopup(pin.place.coordinates, box);
  };

  const addPopup = (place: NewPlace, sub?: string) => {
    const slot = bestSlot(place.coordinates);
    const box  = popupBox(place.name, sub);
    box.appendChild(popupButton(slotText(slot), () => onAddPlace(place, slot?.start ?? null), true));
    showPopup(place.coordinates, box);
  };

  // A tap on the map itself: a leg, else a place on the base map you might add
  clickRef.current = (e: MapMouseEvent) => {
    const map = mapRef.current;
    if (!map || (e.originalEvent?.target as HTMLElement | null)?.closest?.('.mapboxgl-marker')) return;
    const legId = legsAt(map, SOURCE, e.point)[0];
    if (legId) {
      const leg = plan.legs.find(l => l.id === legId);
      if (leg) {
        setSelected({ kind: 'leg', id: leg.id });
        showPopup({ lat: e.lngLat.lat, lng: e.lngLat.lng }, popupBox(travelText(leg, travelOf(leg)), `${leg.from.name} → ${leg.to.name}`));
      }
      return;
    }
    const poi = map.getLayer('poi-label') ? map.queryRenderedFeatures(e.point, { layers: ['poi-label'] })[0] : undefined;
    const name = poi?.properties?.name as string | undefined;
    const geom = poi?.geometry as { type: string; coordinates: [number, number] } | undefined;
    if (name && geom?.type === 'Point') {
      const cls = String(poi?.properties?.class ?? '');
      addPopup(
        { name, coordinates: { lng: geom.coordinates[0], lat: geom.coordinates[1] }, type: cls === 'food_and_drink' || cls === 'food_and_drink_stores' ? 'meal' : 'sightseeing' },
        poi?.properties?.category_en ?? undefined,
      );
      return;
    }
    popupRef.current?.remove();
    setSelected(null);
  };

  const legPoints = (leg: Leg<Stop>) =>
    legLine(leg, travelOf(leg), gapOf(leg) === 'open').coordinates.map(([lng, lat]) => ({ lat, lng }));

  const fitAll = (animate: boolean) => {
    const map = mapRef.current, gl = glRef.current;
    if (!map || !gl) return;
    const points = [...pins.map(p => p.place.coordinates), ...plan.legs.flatMap(legPoints)];
    fitPoints(gl, map, points, 48, animate);
  };

  // ── Draw: pins, ideas, legs ──
  useEffect(() => {
    const map = mapRef.current, gl = glRef.current;
    if (!ready || !map || !gl) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    for (const pin of pins) {
      const on = selected?.kind === 'place' && selected.key === pin.place.key;
      const el = pin.place.kind === 'stay' ? pinElement({ icon: 'hotel', color: MAP_COLORS.stay, selected: on, title: pin.place.name })
        : pin.place.kind === 'home'        ? pinElement({ icon: 'home', color: MAP_COLORS.navy, selected: on, title: pin.place.name })
        : pinElement({
            label: pin.numbers.join(','), color: pin.sameTime ? MAP_COLORS.terra : MAP_COLORS.navy,
            size: pin.numbers.length ? 28 : 14, selected: on, title: pin.place.name,
          });
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        setSelected({ kind: 'place', key: pin.place.key });
        placePopup(pin);
      });
      markersRef.current.push(new gl.Marker({ element: el }).setLngLat([pin.place.coordinates.lng, pin.place.coordinates.lat]).addTo(map));
    }

    if (showIdeas) {
      for (const idea of nearbyIdeas) {
        const el = pinElement({ color: MAP_COLORS.green, size: 16, outline: true, title: idea.name });
        el.addEventListener('click', ev => { ev.stopPropagation(); addPopup(idea, idea.notes); });
        markersRef.current.push(new gl.Marker({ element: el }).setLngLat([idea.coordinates.lng, idea.coordinates.lat]).addTo(map));
      }
    }

    (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(legCollection(plan.legs.map(l => {
      const line = legLine(l, travelOf(l), gapOf(l) === 'open');
      return { id: l.id, style: line.style, coordinates: line.coordinates, selected: selected?.kind === 'leg' && selected.id === l.id };
    })));

    // Each day opens showing all of it
    const fitKey = `${plan.date}|${pins.map(p => p.place.key).join(';')}`;
    if (fittedRef.current !== fitKey) {
      fittedRef.current = fitKey;
      fitAll(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redrawn from these; the helpers read them
  }, [ready, pins, plan, travels, selected, showIdeas, nearbyIdeas, dismissed]);

  // Picked in the list: bring it into view
  const focusLeg = (leg: Leg<Stop>) => {
    setSelected({ kind: 'leg', id: leg.id });
    popupRef.current?.remove();
    const map = mapRef.current, gl = glRef.current;
    if (map && gl) fitPoints(gl, map, legPoints(leg), 56);
  };
  const focusPlace = (pin: Pin) => {
    setSelected({ kind: 'place', key: pin.place.key });
    popupRef.current?.remove();
    const map = mapRef.current;
    if (map) map.easeTo({ center: [pin.place.coordinates.lng, pin.place.coordinates.lat], zoom: Math.max(map.getZoom(), 15), duration: 600 });
  };
  const openStop = (s: Stop) => {
    const pin = pinFor(s);
    if (pin) focusPlace(pin);
    onOpenStop(s);
  };

  // A new day: nothing picked on it yet
  useEffect(() => { setSelected(null); popupRef.current?.remove(); }, [plan.date]);

  // Asked from the timeline, the list, a stop's sheet or the trip map — acted on
  // once, when the map is up and the day it's on is showing
  const focusDone = useRef(0);
  useEffect(() => {
    if (!focus || !ready || focusDone.current === focus.seq) return;
    const leg  = focus.leg ? plan.legs.find(l => l.id === focus.leg) : undefined;
    const stop = focus.stop ? plan.groups.flatMap(g => g.stops).find(s => s._id === focus.stop) : undefined;
    const pin  = stop ? pinFor(stop) : null;
    if (!leg && !pin) return;
    focusDone.current = focus.seq;
    if (leg) focusLeg(leg);
    else if (pin) focusPlace(pin);
    const row = leg ? `leg:${leg.id}` : `place:${pin!.place.key}`;
    setTimeout(() => document.querySelector(`[data-dm="${CSS.escape(row)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per ask
  }, [focus?.seq, ready, plan]);

  // ── Now and next, on today's page ──
  const nowNext = useMemo(() => {
    if (nowMins === null) return null;
    const now  = plan.groups.find(g => g.start <= nowMins && nowMins < Math.max(g.end, g.start + 1)) ?? null;
    const next = plan.groups.find(g => g.start > nowMins) ?? null;
    if (!now && !next) return null;
    const into = next ? plan.legs.find(l => l.toStop && next.stops.includes(l.toStop)) ?? null : null;
    return { now, next, into, travel: into ? travelOf(into) : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, nowMins, travels]);

  const selectedPlaceKey = selected?.kind === 'place' ? selected.key : null;
  const isEmpty = !plan.groups.length && !plan.untimed.length;

  return (
    <Box>
      {/* ── The map — on a phone it stays in view while the list scrolls under it ── */}
      <Box sx={{
        position: isMobile ? 'sticky' : 'relative', top: isMobile ? 47 : undefined, zIndex: 2,   // under the trip's tab bar
        borderRadius: '12px', overflow: 'hidden', border: `1px solid ${D.rule}`, mb: 1.5,
        backgroundColor: '#f0ede8',
      }}>
        <Box ref={boxRef} sx={{ width: '100%', height: isMobile ? '40vh' : 440, minHeight: 240 }} />
        {unavailable && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, backgroundColor: 'rgba(245,240,232,0.95)' }}>
            <MapIcon sx={{ fontSize: 36, color: D.muted }} />
            <Typography sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.9rem', color: D.muted }}>
              The map needs a connection — the day’s route is below
            </Typography>
          </Box>
        )}
        {ready && (
          <Box sx={{ position: 'absolute', left: 8, top: 8, display: 'flex', gap: 0.75 }}>
            {nearbyIdeas.length > 0 && (
              <Chip
                icon={<LightbulbOutlinedIcon sx={{ fontSize: '16px !important' }} />}
                label={showIdeas ? `Hide ideas` : `Ideas · ${nearbyIdeas.length}`}
                onClick={() => { setShowIdeas(v => !v); popupRef.current?.remove(); }}
                sx={{
                  height: 36, fontFamily: D.body, fontWeight: 800, fontSize: '0.75rem',
                  backgroundColor: showIdeas ? D.green : 'rgba(253,250,245,0.95)', color: showIdeas ? '#fff' : D.navy,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  '& .MuiChip-icon': { color: showIdeas ? '#fff' : D.green },
                  '&:hover': { backgroundColor: showIdeas ? D.green : '#fff' },
                }}
              />
            )}
          </Box>
        )}
        {ready && pins.length > 0 && (
          <IconButton
            onClick={() => { popupRef.current?.remove(); setSelected(null); fitAll(true); }}
            aria-label="Show the whole day"
            title="Show the whole day"
            sx={{
              position: 'absolute', right: 8, bottom: 24, width: 44, height: 44,
              backgroundColor: 'rgba(253,250,245,0.95)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', color: D.navy,
              '&:hover': { backgroundColor: '#fff' },
            }}
          >
            <ZoomOutMapIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* ── Now / next ── */}
      {nowNext && (
        <Box sx={{ mb: 1.5, px: 1.5, py: 1, borderRadius: '10px', backgroundColor: alpha(D.navy, 0.05), border: `1px solid ${D.rule}` }}>
          {nowNext.now && (
            <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: D.navy, lineHeight: 1.4 }}>
              <Box component="span" sx={{ fontWeight: 800, color: D.green }}>Now · </Box>
              {nowNext.now.stops.map(s => s.name).join(' / ')}
              <Box component="span" sx={{ color: D.muted }}> until {formatTime(nowNext.now.end)}</Box>
            </Typography>
          )}
          {nowNext.next && (
            <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: D.navy, lineHeight: 1.4 }}>
              <Box component="span" sx={{ fontWeight: 800, color: D.terra }}>Next {formatTime(nowNext.next.start)} · </Box>
              {nowNext.next.stops.map(s => s.name).join(' / ')}
              {nowNext.travel?.leaveBy != null && nowNext.into?.kind === 'move' && (
                <Box component="span" sx={{ color: D.muted }}>
                  {' '}— leave {nowNext.into.from.name} by {formatTime(Math.max(0, nowNext.travel.leaveBy))} · {travelText(nowNext.into, nowNext.travel)}
                </Box>
              )}
            </Typography>
          )}
        </Box>
      )}

      {/* ── The day in order ── */}
      <Box sx={{ borderRadius: '2px', border: `1px solid ${D.rule}`, backgroundColor: '#fff', py: 0.5 }}>
        {isEmpty && (
          <Typography sx={{ py: 5, textAlign: 'center', color: D.muted, fontFamily: D.body, fontSize: '0.9rem' }}>
            Nothing planned this day. Tap a place on the map to add it.
          </Typography>
        )}
        {plan.steps.map((step, i) => {
          if (step.kind === 'anchor') {
            return (
              <AnchorRow
                key={`a-${step.at}`} place={step.place} at={step.at}
                selected={selectedPlaceKey === step.place.key}
                onClick={() => { const pin = pins.find(p => p.place === step.place); if (pin) focusPlace(pin); }}
              />
            );
          }
          if (step.kind === 'leg') {
            const leg = step.leg;
            return (
              <Box key={`l-${leg.id}-${i}`} data-dm={`leg:${leg.id}`}>
                <LegRow
                  leg={leg} travel={travelOf(leg)} gap={gapOf(leg)}
                  selected={selected?.kind === 'leg' && selected.id === leg.id}
                  onSelect={() => focusLeg(leg)}
                  onAddTransport={() => onAddTransport(leg)}
                  onSorted={sorted => onSorted(leg, sorted)}
                  inset={1}
                />
              </Box>
            );
          }
          const g = step.group;
          return (
            <GroupRow
              key={`g-${g.start}-${i}`} group={g}
              rowKey={g.places[0] ? `place:${g.places[0].key}` : undefined}
              selected={!!selectedPlaceKey && g.places.some(p => p.key === selectedPlaceKey)}
              onOpen={openStop}
            />
          );
        })}
      </Box>

      {plan.untimed.length > 0 && (
        <Box sx={{ mt: 1.5, borderRadius: '2px', border: `1px solid ${D.rule}`, backgroundColor: '#fff' }}>
          <Typography sx={{ px: 2, pt: 1.25, pb: 0.25, fontFamily: D.body, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: D.muted }}>
            No time · not on the route
          </Typography>
          {plan.untimed.map((s, i) => (
            <ButtonBase
              key={s._id ?? i} onClick={() => openStop(s)}
              sx={{ display: 'flex', width: '100%', justifyContent: 'flex-start', textAlign: 'left', minHeight: 44, px: 2, py: 0.75, gap: 1 }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontFamily: D.body, fontSize: '0.9rem', fontWeight: 700, color: D.navy }}>{s.name}</Typography>
                {(s.locationName || s.address) && (
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.76rem', color: D.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.locationName || s.address}
                  </Typography>
                )}
              </Box>
            </ButtonBase>
          ))}
        </Box>
      )}
    </Box>
  );
}

function AnchorRow({ place, at, selected, onClick }: { place: Place; at: 'start' | 'end'; selected: boolean; onClick: () => void }) {
  const home = place.kind === 'home';
  return (
    <ButtonBase
      data-dm={`place:${place.key}`}
      onClick={onClick}
      sx={{
        display: 'flex', width: '100%', justifyContent: 'flex-start', textAlign: 'left', gap: 1.25,
        minHeight: 48, px: 2, py: 0.75, backgroundColor: selected ? alpha(D.navy, 0.05) : 'transparent',
      }}
    >
      <Box sx={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: home ? D.navy : MAP_COLORS.stay, color: '#fff',
      }}>
        {home ? <HomeIcon sx={{ fontSize: 16 }} /> : <HotelIcon sx={{ fontSize: 16 }} />}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: D.body, fontSize: '0.92rem', fontWeight: 800, color: D.navy, lineHeight: 1.25 }}>{place.name}</Typography>
        <Typography sx={{ fontFamily: D.body, fontSize: '0.74rem', color: D.muted }}>
          {at === 'start' ? 'Where the day starts' : home ? 'Home' : 'Where you sleep'}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

function GroupRow({ group, rowKey, selected, onOpen }: {
  group: Group<Stop>; rowKey?: string; selected: boolean; onOpen: (s: Stop) => void;
}) {
  const sameTime = group.places.length > 1;
  const badge    = !group.n ? alpha(D.navy, 0.2) : sameTime ? D.terra : D.navy;
  return (
    <Box data-dm={rowKey} sx={{ display: 'flex', gap: 1.25, px: 2, py: 0.5, backgroundColor: selected ? alpha(D.navy, 0.05) : 'transparent' }}>
      <Box sx={{
        width: 28, height: 28, mt: 1, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: badge, color: '#fff', fontFamily: D.body, fontWeight: 800, fontSize: '0.78rem',
      }}>
        {group.n || <LocationOffOutlinedIcon sx={{ fontSize: 15, color: D.navy }} />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {sameTime && (
          <Typography sx={{ pt: 1, fontFamily: D.body, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: D.terra }}>
            {group.stops.length} at the same time · {spreadLabel(group.places)}
          </Typography>
        )}
        {group.stops.map((s, i) => {
          const start = pageStart(s);
          return (
            <ButtonBase
              key={s._id ?? i} onClick={() => onOpen(s)}
              sx={{ display: 'flex', width: '100%', alignItems: 'flex-start', justifyContent: 'flex-start', textAlign: 'left', gap: 1, minHeight: 44, py: 0.75 }}
            >
              <Typography sx={{ width: 42, flexShrink: 0, fontFamily: D.display, fontSize: '0.85rem', color: D.navy, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>
                {start !== null ? formatTime(start) : ''}
              </Typography>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{
                  fontFamily: D.body, fontSize: '0.92rem', fontWeight: 800, color: D.navy, lineHeight: 1.3,
                  display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
                }}>
                  {s.name}
                </Typography>
                <Typography sx={{
                  fontFamily: D.body, fontSize: '0.76rem', lineHeight: 1.35,
                  color: isPinned(s.coordinates) ? D.muted : D.terra,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {isPinned(s.coordinates) ? (s.locationName || s.address || '') : 'Not on the map — open it to add a place'}
                </Typography>
              </Box>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}
