'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import FlightIcon        from '@mui/icons-material/Flight';
import TrainIcon         from '@mui/icons-material/Train';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EventIcon         from '@mui/icons-material/Event';
import MapIcon           from '@mui/icons-material/Map';

const D = {
  navy:    '#1D2642',
  green:   '#6B7C5C',
  terra:   '#C4714A',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

interface Coordinates { lat: number; lng: number; }
interface TripLocation { city: string; country: string; coordinates?: Coordinates; }
interface Trip {
  _id: string; name: string;
  origin: TripLocation; destination: TripLocation;
  additionalDestinations?: (TripLocation & { arrivalDate?: string; departureDate?: string })[];
  startDate: string; endDate: string;
}
interface TransportEntry {
  type: string; status: string;
  departureLocation?: string; arrivalLocation?: string;
  departureTime?: string; arrivalTime?: string;
  confirmationNumber?: string; cost?: string;
  details?: { flightNumber?: string; airline?: string; airlineIata?: string; seat?: string; operator?: string; };
}
interface AccomEntry {
  name: string; type: string; status: string;
  address?: string; coordinates?: Coordinates; checkIn?: string; checkOut?: string;
}
interface VenueEntry {
  name: string; type: string; status: string;
  address?: string; coordinates?: Coordinates; date?: string; time?: string;
}
interface ItineraryStop { name: string; type: string; address?: string; coordinates?: Coordinates; }
interface ItineraryDay { date: string; dayNumber: number; stops: ItineraryStop[]; }
interface MapTabProps { tripId: string; trip: Trip; }

interface TransportLeg {
  kind: 'transport'; entry: TransportEntry;
  fromCoords: Coordinates; toCoords: Coordinates;
  fromLabel: string; toLabel: string;
}
interface GapLeg {
  kind: 'gap'; fromLabel: string; toLabel: string;
  fromCoords: Coordinates; toCoords: Coordinates; distanceKm: number;
}
type JourneyLeg = TransportLeg | GapLeg;

function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function estimateDriveTime(km: number): string {
  const speed = km > 30 ? 80 : 40;
  const mins  = Math.round(km / speed * 60 / 5) * 5;
  if (mins < 60) return `~${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? `~${h}h` : `~${h}h ${m}min`;
}

// bbox covering Europe + North Africa — hard constraint, no US false positives
const EUROPE_BBOX = '-25,30,50,75';

function isInEurope(c?: Coordinates): boolean {
  if (!c) return false;
  return c.lng >= -25 && c.lng <= 50 && c.lat >= 30 && c.lat <= 75;
}

async function geocode(query: string, token: string, proximity?: Coordinates): Promise<Coordinates | null> {
  if (!query?.trim()) return null;
  try {
    const prox = proximity ? `&proximity=${proximity.lng},${proximity.lat}` : '';
    // If proximity is in Europe, hard-constrain results to Europe bbox
    const bbox = isInEurope(proximity) ? `&bbox=${EUROPE_BBOX}` : '';
    const res  = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&access_token=${token}${prox}${bbox}`);
    const data = await res.json();
    const [lng, lat] = data?.features?.[0]?.center ?? [];
    return lng == null ? null : { lat, lng };
  } catch { return null; }
}

async function geocodeTransportLocation(loc: string, token: string, proximity?: Coordinates): Promise<Coordinates | null> {
  if (!loc?.trim()) return null;
  const parts = loc.split(' — '), code = parts[0].trim(), city = parts[1]?.trim() ?? '';
  if (/^[A-Z]{3}$/.test(code) && city) return await geocode(`${city} airport`, token, proximity);
  return await geocode(city || loc, token, proximity);
}

function iataCode(loc: string): string { return loc ? loc.split(' — ')[0].trim() : ''; }
function cityLabel(loc: string): string {
  if (!loc || !loc.includes(' — ')) return loc;
  const code = loc.split(' — ')[0].trim(), city = loc.split(' — ')[1].trim();
  return /^[A-Z]{3}$/.test(code) ? `${city} Airport` : city;
}

async function fetchDirections(from: Coordinates, to: Coordinates, token: string): Promise<number[][] | null> {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full&access_token=${token}`;
    const data = await fetch(url).then(r => r.json());
    return data.routes?.[0]?.geometry?.coordinates ?? null;
  } catch { return null; }
}

function flightArc(from: Coordinates, to: Coordinates, steps = 80): number[][] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return [
      from.lng + (to.lng - from.lng) * t,
      from.lat + (to.lat - from.lat) * t + Math.sin(Math.PI * t) * 1.5,
    ];
  });
}

async function buildJourneyLegs(
  transportation: TransportEntry[], accommodation: AccomEntry[], token: string, proximity?: Coordinates,
): Promise<JourneyLeg[]> {
  const sorted = [...transportation].sort((a, b) =>
    new Date(a.departureTime ?? 0).getTime() - new Date(b.departureTime ?? 0).getTime());
  if (!sorted.length) return [];

  const resolved = await Promise.all(sorted.map(async entry => ({
    entry,
    fromCoords: await geocodeTransportLocation(entry.departureLocation ?? '', token, proximity),
    toCoords:   await geocodeTransportLocation(entry.arrivalLocation   ?? '', token, proximity),
  })));

  const valid = resolved.filter(l => l.fromCoords && l.toCoords) as { entry: TransportEntry; fromCoords: Coordinates; toCoords: Coordinates; }[];
  if (!valid.length) return [];

  const hotelCoords = accommodation[0]?.coordinates ?? null;
  const hotelName   = accommodation[0]?.name ?? 'Hotel';
  const result: JourneyLeg[] = [];
  let currentCoords: Coordinates | null = null, currentLabel = '';

  for (let i = 0; i < valid.length; i++) {
    const { entry, fromCoords, toCoords } = valid[i];
    const isLast = i === valid.length - 1;

    if (currentCoords && haversineKm(currentCoords, fromCoords) > 2) {
      result.push({ kind: 'gap', fromLabel: currentLabel, toLabel: entry.departureLocation ?? '',
        fromCoords: currentCoords, toCoords: fromCoords, distanceKm: haversineKm(currentCoords, fromCoords) });
    }

    result.push({ kind: 'transport', entry, fromCoords, toCoords,
      fromLabel: entry.departureLocation ?? '', toLabel: entry.arrivalLocation ?? '' });

    if (!isLast && hotelCoords) {
      const d = haversineKm(toCoords, hotelCoords);
      if (d > 2) result.push({ kind: 'gap', fromLabel: entry.arrivalLocation ?? '', toLabel: hotelName,
        fromCoords: toCoords, toCoords: hotelCoords, distanceKm: d });
      currentCoords = hotelCoords; currentLabel = hotelName;
    } else {
      currentCoords = toCoords; currentLabel = entry.arrivalLocation ?? '';
    }
  }
  return result;
}

const STATUS_IS_CONFIRMED = (s: string) => s === 'confirmed' || s === 'booked';
function fmtTime(dt?: string) { return dt ? new Date(dt).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'; }
function fmtDate(dt?: string) { return dt ? new Date(dt).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' }) : ''; }

function TIcon({ type, size = 15 }: { type: string; size?: number }) {
  const sx = { fontSize: size, opacity: 0.55 };
  if (type === 'flight') return <FlightIcon sx={sx} />;
  if (type === 'train')  return <TrainIcon sx={sx} />;
  if (type === 'bus')    return <DirectionsBusIcon sx={sx} />;
  if (type === 'car' || type === 'car_hire') return <DirectionsCarIcon sx={sx} />;
  return <EventIcon sx={sx} />;
}

function TransportLegCard({ leg }: { leg: TransportLeg }) {
  const { entry } = leg;
  const confirmed = STATUS_IS_CONFIRMED(entry.status);
  return (
    <Box sx={{ borderLeft: `3px solid ${confirmed ? D.green : D.terra}`, backgroundColor: D.paper, borderRadius: '0 8px 8px 0', px: 2.5, py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 0.75 }}>
        <Typography sx={{ fontFamily: D.display, fontSize: { xs: '1.75rem', sm: '2rem' }, color: D.navy, lineHeight: 1, letterSpacing: '-0.03em' }}>
          {fmtTime(entry.departureTime)}
        </Typography>
        <Typography sx={{ color: D.muted, fontSize: '1rem', fontWeight: 700, lineHeight: 1 }}>→</Typography>
        <Typography sx={{ fontFamily: D.display, fontSize: { xs: '1.75rem', sm: '2rem' }, color: D.navy, lineHeight: 1, letterSpacing: '-0.03em' }}>
          {fmtTime(entry.arrivalTime)}
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <TIcon type={entry.type} />
          <Box sx={{ px: 1, py: 0.3, borderRadius: 0.75, backgroundColor: confirmed ? 'rgba(107,124,92,0.12)' : 'rgba(196,113,74,0.10)', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: confirmed ? D.green : D.terra }}>
            {confirmed ? 'Booked' : entry.status}
          </Box>
        </Box>
      </Box>
      <Typography sx={{ fontFamily: D.display, fontSize: { xs: '1.2rem', sm: '1.4rem' }, color: D.navy, lineHeight: 1, letterSpacing: '-0.02em', mb: 1 }}>
        {iataCode(leg.fromLabel)} → {iataCode(leg.toLabel)}
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {entry.details?.airline && <Typography sx={{ fontSize: '0.8rem', color: D.muted }}>{entry.details.airline}</Typography>}
        {entry.details?.flightNumber && <Typography sx={{ fontSize: '0.8rem', color: D.muted, fontWeight: 700 }}>{entry.details.flightNumber}</Typography>}
        {entry.details?.seat && <Typography sx={{ fontSize: '0.8rem', color: D.muted }}>Seat {entry.details.seat}</Typography>}
        {entry.confirmationNumber && <Typography sx={{ fontSize: '0.78rem', color: D.muted, fontFamily: 'monospace', letterSpacing: '0.1em' }}>{entry.confirmationNumber}</Typography>}
      </Box>
      <Typography sx={{ fontSize: '0.73rem', color: D.muted, mt: 0.5 }}>{fmtDate(entry.departureTime)}</Typography>
    </Box>
  );
}

function GapLegCard({ leg }: { leg: GapLeg }) {
  return (
    <Box sx={{ borderLeft: `3px dashed ${D.terra}`, backgroundColor: 'rgba(196,113,74,0.05)', borderRadius: '0 8px 8px 0', px: 2.5, py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 0.75 }}>
        <Typography sx={{ fontFamily: D.display, fontSize: { xs: '1.75rem', sm: '2rem' }, color: D.terra, lineHeight: 1, letterSpacing: '-0.03em' }}>?</Typography>
        <Box sx={{ ml: 'auto', flexShrink: 0 }}>
          <Box sx={{ px: 1, py: 0.3, borderRadius: 0.75, backgroundColor: 'rgba(196,113,74,0.12)', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: D.terra }}>
            Not booked
          </Box>
        </Box>
      </Box>
      <Typography sx={{ fontFamily: D.display, fontSize: { xs: '1rem', sm: '1.15rem' }, color: D.navy, lineHeight: 1.2, letterSpacing: '-0.02em', mb: 0.75 }}>
        {cityLabel(leg.fromLabel)} → {cityLabel(leg.toLabel)}
      </Typography>
      <Typography sx={{ fontSize: '0.82rem', color: D.muted, fontStyle: 'italic' }}>
        no transfer booked · {estimateDriveTime(leg.distanceKm)} · {Math.round(leg.distanceKm)} km
      </Typography>
    </Box>
  );
}

type Layer = 'all' | 'transport' | 'stays' | 'venues' | 'itinerary';
const LAYERS: { value: Layer; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'transport', label: 'Route' },
  { value: 'stays', label: 'Stays' }, { value: 'venues', label: 'Venues' },
  { value: 'itinerary', label: 'Itinerary' },
];

const STOP_COLOUR: Record<string, string> = {
  flight: '#C9521B', hotel: '#5c35a0', meeting: '#1D2642', meal: '#b45309', breakfast: '#b45309',
  activity: '#55702C', sightseeing: '#55702C', transport: '#0369a1', work: '#1D2642', other: '#6b7280',
};
const VENUE_EMOJI: Record<string, string> = {
  concert: '🎵', conference: '🏛️', restaurant: '🍽️', sports: '🏟️', attraction: '🏛️', business: '💼', other: '📍',
};

export default function MapTab({ tripId, trip }: MapTabProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const mapboxglRef  = useRef<any>(null);
  const markersRef   = useRef<any[]>([]);

  const [loading,     setLoading]     = useState(true);
  const [mapReady,    setMapReady]    = useState(false);
  const [logistics,   setLogistics]   = useState<any>(null);
  const [itinerary,   setItinerary]   = useState<ItineraryDay[]>([]);
  const [layer,       setLayer]       = useState<Layer>('all');
  const [journeyLegs, setJourneyLegs] = useState<JourneyLeg[]>([]);
  const [tokenError,  setTokenError]  = useState(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

  useEffect(() => {
    Promise.all([
      fetch(`/api/trips/${tripId}/logistics`).then(r => r.json()),
      fetch(`/api/trips/${tripId}/itinerary`).then(r => r.json()),
    ]).then(([l, it]) => { setLogistics(l.logistics); setItinerary(it.days ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tripId]);

  useEffect(() => {
    if (!logistics || !token) return;
    void (async () => {
      // Resolve a real proximity anchor — trip.destination.coordinates is often null
      let proximity: Coordinates | undefined = trip.destination?.coordinates ?? undefined;
      if (!proximity && trip.destination?.city) {
        proximity = await geocode(`${trip.destination.city}, ${trip.destination.country}`, token) ?? undefined;
      }
      if (!proximity && trip.origin?.city) {
        proximity = await geocode(`${trip.origin.city}, ${trip.origin.country}`, token) ?? undefined;
      }
      const legs = await buildJourneyLegs(logistics.transportation ?? [], logistics.accommodation ?? [], token, proximity);
      setJourneyLegs(legs);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logistics, token]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    if (!token) { setTokenError(true); setMapReady(true); return; }

    import('mapbox-gl').then(async ({ default: mapboxgl }) => {
      mapboxglRef.current  = mapboxgl;
      mapboxgl.accessToken = token;

      let originCoords = trip.origin?.coordinates;
      let destCoords   = trip.destination?.coordinates;
      if (!originCoords && trip.origin?.city) originCoords = await geocode(`${trip.origin.city}, ${trip.origin.country}`, token) ?? undefined;
      if (!destCoords && trip.destination?.city) destCoords = await geocode(`${trip.destination.city}, ${trip.destination.country}`, token) ?? undefined;

      const centre: [number, number] = originCoords && destCoords
        ? [(originCoords.lng + destCoords.lng) / 2, (originCoords.lat + destCoords.lat) / 2]
        : destCoords ? [destCoords.lng, destCoords.lat] : originCoords ? [originCoords.lng, originCoords.lat] : [10, 50];

      if (!mapContainer.current) return;
      const map = new mapboxgl.Map({ container: mapContainer.current, style: 'mapbox://styles/mapbox/light-v11', center: centre, zoom: 4, attributionControl: false });
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      map.on('load', () => { mapRef.current = map; setMapReady(true); });
      map.on('error', e => console.error('[MapTab]', e));
      const t = setTimeout(() => { if (!mapRef.current) { mapRef.current = map; setMapReady(true); } }, 10000);
      map.once('load', () => clearTimeout(t));
    }).catch(() => setMapReady(true));

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const clearMarkers = useCallback(() => { markersRef.current.forEach(m => m.remove()); markersRef.current = []; }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || loading) return;
    const map = mapRef.current, mapboxgl = mapboxglRef.current;
    if (!mapboxgl) return;
    void (async () => {

    clearMarkers();
    (map.getStyle()?.layers ?? []).forEach((l: any) => { if (l.id.startsWith('leg-')) try { map.removeLayer(l.id); } catch {} });
    Object.keys(map.getStyle()?.sources ?? {}).forEach(id => { if (id.startsWith('leg-src-')) try { map.removeSource(id); } catch {} });

    const bounds = new mapboxgl.LngLatBounds();
    const showTransport = layer === 'all' || layer === 'transport';
    const showStays     = layer === 'all' || layer === 'stays';
    const showVenues    = layer === 'all' || layer === 'venues';
    const showItinerary = layer === 'all' || layer === 'itinerary';

    if (showTransport) {
      // Seen coords for marker deduplication (key = rounded lng,lat)
      const seenMarkers = new Set<string>();
      const markerKey = (c: Coordinates) => `${c.lng.toFixed(2)},${c.lat.toFixed(2)}`;

      for (let i = 0; i < journeyLegs.length; i++) {
        const leg = journeyLegs[i];
        const isGap    = leg.kind === 'gap';
        const confirmed = !isGap && STATUS_IS_CONFIRMED(leg.entry.status);
        const color    = isGap ? D.terra : (confirmed ? D.green : D.terra);

        bounds.extend([leg.fromCoords.lng, leg.fromCoords.lat]);
        bounds.extend([leg.toCoords.lng,   leg.toCoords.lat]);

        // Geometry: flight arc for flights, road route for gaps, straight for others
        let coordinates: number[][];
        if (!isGap && leg.entry.type === 'flight') {
          coordinates = flightArc(leg.fromCoords, leg.toCoords);
        } else if (isGap) {
          const road = await fetchDirections(leg.fromCoords, leg.toCoords, token);
          coordinates = road ?? [[leg.fromCoords.lng, leg.fromCoords.lat], [leg.toCoords.lng, leg.toCoords.lat]];
        } else {
          coordinates = [[leg.fromCoords.lng, leg.fromCoords.lat], [leg.toCoords.lng, leg.toCoords.lat]];
        }

        try {
          map.addSource(`leg-src-${i}`, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } } });
          map.addLayer({ id: `leg-${i}`, type: 'line', source: `leg-src-${i}`,
            paint: { 'line-color': color, 'line-width': isGap ? 1.5 : 2.5, 'line-opacity': isGap ? 0.6 : 0.9, 'line-dasharray': isGap ? [3, 4] : [1] } });
        } catch {}

        // Transport endpoint markers — deduplicated
        if (!isGap) {
          for (const [c, label, isFirst] of [
            [leg.fromCoords, iataCode(leg.fromLabel), i === 0],
            [leg.toCoords,   iataCode(leg.toLabel),   false  ],
          ] as [Coordinates, string, boolean][]) {
            const key = markerKey(c);
            if (seenMarkers.has(key)) continue;
            seenMarkers.add(key);

            const pc = isFirst ? D.navy : D.terra;
            const el = document.createElement('div');
            el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${pc};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:default;position:relative;`;
            const lbl = document.createElement('div');
            lbl.style.cssText = `position:absolute;bottom:18px;left:50%;transform:translateX(-50%);background:${pc};color:white;font-family:"Archivo Black",sans-serif;font-size:11px;font-weight:900;letter-spacing:0.03em;padding:3px 8px;border-radius:10px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2);pointer-events:none;`;
            lbl.textContent = label;
            el.appendChild(lbl);
            markersRef.current.push(new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([c.lng, c.lat]).addTo(map));
          }
        }
      }
    }

    if (showStays) {
      (logistics?.accommodation ?? []).forEach((a: AccomEntry) => {
        if (!a.coordinates?.lat) return;
        const { lat, lng } = a.coordinates; bounds.extend([lng, lat]);
        const confirmed = STATUS_IS_CONFIRMED(a.status);
        const el = document.createElement('div');
        el.style.cssText = `width:32px;height:32px;border-radius:8px;background:${confirmed ? '#5c35a0' : 'white'};border:2px solid #5c35a0;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer;font-size:16px;`;
        el.textContent = '🏨';
        const popup = new mapboxgl.Popup({ offset: 20, closeButton: false })
          .setHTML(`<div style="font-family:system-ui;padding:4px 2px;"><div style="font-weight:800;font-size:13px;color:#1D2642;">${a.name}</div>${a.address ? `<div style="font-size:10px;color:#9ca3af;margin-top:3px;">${a.address}</div>` : ''}${a.checkIn ? `<div style="font-size:10px;color:#6b7280;margin-top:3px;">Check-in: ${new Date(a.checkIn).toLocaleDateString('en-IE',{day:'numeric',month:'short'})}</div>` : ''}</div>`);
        markersRef.current.push(new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).setPopup(popup).addTo(map));
      });
    }

    if (showVenues) {
      (logistics?.venues ?? []).forEach((v: VenueEntry) => {
        if (!v.coordinates?.lat) return;
        const { lat, lng } = v.coordinates; bounds.extend([lng, lat]);
        const confirmed = STATUS_IS_CONFIRMED(v.status);
        const emoji = VENUE_EMOJI[v.type] ?? '📍';
        const el = document.createElement('div');
        el.style.cssText = `width:32px;height:32px;border-radius:8px;background:${confirmed ? D.navy : 'white'};border:2px solid ${D.navy};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer;font-size:16px;`;
        el.textContent = emoji;
        const popup = new mapboxgl.Popup({ offset: 20, closeButton: false })
          .setHTML(`<div style="font-family:system-ui;padding:4px 2px;"><div style="font-weight:800;font-size:13px;color:#1D2642;">${v.name}</div><div style="font-size:11px;color:#6b7280;margin-top:2px;text-transform:capitalize;">${v.type}</div>${v.address ? `<div style="font-size:10px;color:#9ca3af;margin-top:2px;">${v.address}</div>` : ''}</div>`);
        markersRef.current.push(new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).setPopup(popup).addTo(map));
      });
    }

    if (showItinerary) {
      itinerary.flatMap(d => d.stops).forEach(stop => {
        if (!stop.coordinates?.lat) return;
        const { lat, lng } = stop.coordinates; bounds.extend([lng, lat]);
        const color = STOP_COLOUR[stop.type] ?? '#6b7280';
        const el = document.createElement('div');
        el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer;`;
        const popup = new mapboxgl.Popup({ offset: 14, closeButton: false })
          .setHTML(`<div style="font-family:system-ui;padding:4px 2px;"><div style="font-weight:700;font-size:12px;color:#1D2642;">${stop.name}</div><div style="font-size:10px;color:#6b7280;text-transform:capitalize;">${stop.type}</div></div>`);
        markersRef.current.push(new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).setPopup(popup).addTo(map));
      });
    }

    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: { top: 60, bottom: 60, left: 60, right: 60 }, maxZoom: 14, duration: 800 });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, loading, logistics, itinerary, layer, journeyLegs, clearMarkers]);

  const gapCount = journeyLegs.filter(l => l.kind === 'gap').length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 0.5, backgroundColor: 'rgba(253,250,245,0.95)', backdropFilter: 'blur(4px)', borderRadius: 1.5, p: 0.5, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
          {LAYERS.map(l => (
            <Box key={l.value} component="button" onClick={() => setLayer(l.value)} sx={{ background: layer === l.value ? D.navy : 'transparent', color: layer === l.value ? 'white' : D.muted, border: 'none', borderRadius: 1, px: { xs: 1, sm: 1.5 }, py: 0.6, fontSize: '0.72rem', fontWeight: 800, fontFamily: D.body, textTransform: 'none', cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.02em', transition: 'background 0.15s, color 0.15s' }}>
              {l.label}
            </Box>
          ))}
        </Box>

        <Box ref={mapContainer} sx={{ width: '100%', height: { xs: 300, sm: 400, md: 480 }, backgroundColor: '#f0ede8' }} />

        {(loading || !mapReady) && !tokenError && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,240,232,0.85)' }}>
            <CircularProgress size={32} sx={{ color: D.green }} />
          </Box>
        )}
        {tokenError && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,240,232,0.95)' }}>
            <Box sx={{ textAlign: 'center', px: 3 }}>
              <MapIcon sx={{ fontSize: 40, color: D.muted, mb: 1 }} />
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: D.muted }}>Map unavailable</Typography>
            </Box>
          </Box>
        )}
      </Box>

      <Box sx={{ pt: 3, pb: 2 }}>
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontFamily: D.display, fontSize: { xs: '1.5rem', sm: '1.75rem' }, color: D.navy, lineHeight: 1, letterSpacing: '-0.03em', mb: 0.5 }}>
            {trip.origin?.city} → {trip.destination?.city}
          </Typography>
          {gapCount > 0 && (
            <Typography sx={{ fontSize: '0.85rem', color: D.terra, fontWeight: 600 }}>
              {gapCount} transfer{gapCount !== 1 ? 's' : ''} not booked
            </Typography>
          )}
        </Box>

        {journeyLegs.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {journeyLegs.map((leg, i) =>
              leg.kind === 'transport' ? <TransportLegCard key={i} leg={leg} /> : <GapLegCard key={i} leg={leg} />
            )}
          </Box>
        ) : !loading && (
          <Typography sx={{ fontSize: '0.9rem', color: D.muted, py: 2 }}>No transport added yet.</Typography>
        )}
      </Box>

    </Box>
  );
}