'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Chip, CircularProgress,
  ToggleButton, ToggleButtonGroup, Divider, alpha,
} from '@mui/material';
import FlightIcon        from '@mui/icons-material/Flight';
import TrainIcon         from '@mui/icons-material/Train';
import HotelIcon         from '@mui/icons-material/Hotel';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ExploreIcon       from '@mui/icons-material/Explore';
import WorkIcon          from '@mui/icons-material/Work';
import RestaurantIcon    from '@mui/icons-material/Restaurant';
import EventIcon         from '@mui/icons-material/Event';
import CheckCircleIcon   from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import MapIcon           from '@mui/icons-material/Map';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Coordinates { lat: number; lng: number; }

interface TripLocation {
  city: string;
  country: string;
  countryCode?: string;
  coordinates?: Coordinates;
}

interface Trip {
  _id: string;
  name: string;
  origin: TripLocation;
  destination: TripLocation;
  additionalDestinations?: (TripLocation & { arrivalDate?: string; departureDate?: string })[];
  startDate: string;
  endDate: string;
}

interface TransportEntry {
  type: string;
  status: string;
  departureLocation?: string;
  arrivalLocation?: string;
  departureTime?: string;
  arrivalTime?: string;
  details?: {
    flightNumber?: string;
    airline?: string;
    operator?: string;
  };
}

interface AccomEntry {
  name: string;
  type: string;
  status: string;
  address?: string;
  checkIn?: string;
  checkOut?: string;
}

interface ItineraryStop {
  _id?: string;
  name: string;
  type: string;
  address?: string;
  coordinates?: Coordinates;
  scheduledStart?: string;
  notes?: string;
}

interface ItineraryDay {
  date: string;
  dayNumber: number;
  stops: ItineraryStop[];
}

interface MapTabProps {
  tripId: string;
  trip: Trip;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

const TRANSPORT_COLOUR: Record<string, string> = {
  flight:           '#C9521B',
  train:            '#0369a1',
  bus:              '#7c3aed',
  ferry:            '#0891b2',
  car:              '#55702C',
  car_hire:         '#55702C',
  taxi:             '#b45309',
  private_transfer: '#b45309',
  bicycle:          '#55702C',
};

const STOP_COLOUR: Record<string, string> = {
  flight:      '#C9521B',
  hotel:       '#5c35a0',
  meeting:     '#1D2642',
  meal:        '#b45309',
  breakfast:   '#b45309',
  activity:    '#55702C',
  sightseeing: '#55702C',
  transport:   '#0369a1',
  work:        '#1D2642',
  other:       '#6b7280',
};

const STATUS_IS_CONFIRMED = (s: string) =>
  s === 'confirmed' || s === 'booked';

// ─── Geocode via Mapbox (free tier) ──────────────────────────────────────────

async function geocode(query: string, token: string): Promise<Coordinates | null> {
  if (!query?.trim()) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();
    const [lng, lat] = data?.features?.[0]?.center ?? [];
    if (lng == null || lat == null) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

// ─── Transport icon helper ────────────────────────────────────────────────────

function TransportIcon({ type, size = 16 }: { type: string; size?: number }) {
  const props = { sx: { fontSize: size } };
  switch (type) {
    case 'flight':           return <FlightIcon {...props} />;
    case 'train':            return <TrainIcon {...props} />;
    case 'bus':              return <DirectionsBusIcon {...props} />;
    case 'car':
    case 'car_hire':         return <DirectionsCarIcon {...props} />;
    default:                 return <EventIcon {...props} />;
  }
}

function StopIcon({ type, size = 14 }: { type: string; size?: number }) {
  const props = { sx: { fontSize: size } };
  switch (type) {
    case 'hotel':            return <HotelIcon {...props} />;
    case 'meeting':
    case 'work':             return <WorkIcon {...props} />;
    case 'meal':
    case 'breakfast':        return <RestaurantIcon {...props} />;
    case 'activity':
    case 'sightseeing':      return <ExploreIcon {...props} />;
    default:                 return <EventIcon {...props} />;
  }
}

// ─── Legend item ──────────────────────────────────────────────────────────────

function LegendItem({
  color, label, confirmed, icon,
}: {
  color: string; label: string; confirmed?: boolean; icon?: React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{
        width: 10, height: 10, borderRadius: '50%',
        backgroundColor: confirmed === false ? 'transparent' : color,
        border: confirmed === false ? `2px dashed ${color}` : 'none',
        flexShrink: 0,
      }} />
      {icon && <Box sx={{ color, display: 'flex', alignItems: 'center' }}>{icon}</Box>}
      <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
        {label}
      </Typography>
      {confirmed !== undefined && (
        confirmed
          ? <CheckCircleIcon sx={{ fontSize: 12, color: 'success.main', ml: 'auto' }} />
          : <RadioButtonUncheckedIcon sx={{ fontSize: 12, color: 'text.disabled', ml: 'auto' }} />
      )}
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MapTab({ tripId, trip }: MapTabProps) {
  const mapContainer    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<any>(null);
  const markersRef      = useRef<any[]>([]);
  const resolvedOrigin  = useRef<Coordinates | null>(null);
  const resolvedDest    = useRef<Coordinates | null>(null);

  const [loading,    setLoading]    = useState(true);
  const [mapReady,   setMapReady]   = useState(false);
  const [logistics,  setLogistics]  = useState<any>(null);
  const [itinerary,  setItinerary]  = useState<ItineraryDay[]>([]);
  const [layer,      setLayer]      = useState<'all' | 'transport' | 'stays' | 'itinerary'>('all');

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
  const [tokenError, setTokenError] = useState(false);

  // ── Fetch data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`/api/trips/${tripId}/logistics`).then(r => r.json()),
      fetch(`/api/trips/${tripId}/itinerary`).then(r => r.json()),
    ]).then(([l, it]) => {
      setLogistics(l.logistics);
      setItinerary(it.days ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [tripId]);

  // ── Init Mapbox ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Surface missing token as a visible error rather than silent bail
    if (!token) {
      console.error('[MapTab] NEXT_PUBLIC_MAPBOX_TOKEN is not set');
      setTokenError(true);
      setMapReady(true); // clear spinner so the error is visible
      return;
    }

    import('mapbox-gl').then(async ({ default: mapboxgl }) => {
      mapboxgl.accessToken = token;

      // Coords may not be on the Trip object from page.tsx — geocode city names as fallback
      let originCoords = trip.origin?.coordinates;
      let destCoords   = trip.destination?.coordinates;

      if (!originCoords && trip.origin?.city) {
        originCoords = await geocode(`${trip.origin.city}, ${trip.origin.country}`, token) ?? undefined;
      }
      if (!destCoords && trip.destination?.city) {
        destCoords = await geocode(`${trip.destination.city}, ${trip.destination.country}`, token) ?? undefined;
      }

      // Store for use by drawLayers
      resolvedOrigin.current = originCoords ?? null;
      resolvedDest.current   = destCoords   ?? null;

      const centre: [number, number] = (() => {
        if (originCoords && destCoords) {
          return [
            (originCoords.lng + destCoords.lng) / 2,
            (originCoords.lat + destCoords.lat) / 2,
          ];
        }
        if (destCoords)   return [destCoords.lng,   destCoords.lat];
        if (originCoords) return [originCoords.lng, originCoords.lat];
        return [10, 50]; // fallback: central Europe
      })();

      if (!mapContainer.current) return; // guard: tab may have changed during async geocode

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: centre,
        zoom: originCoords && destCoords ? 4 : 6,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', () => {
        mapRef.current = map;
        setMapReady(true);
      });

      map.on('error', (e) => {
        console.error('[MapTab] Mapbox error:', e);
      });

      // Fallback: clear spinner after 10s regardless
      const timeout = setTimeout(() => {
        if (!mapRef.current) {
          mapRef.current = map;
          setMapReady(true);
        }
      }, 10000);
      map.once('load', () => clearTimeout(timeout));
    }).catch(err => {
      console.error('[MapTab] Failed to load mapbox-gl:', err);
      setMapReady(true); // clear spinner, show whatever we have
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Draw / update layers whenever map is ready or data changes ───────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || loading) return;
    drawLayers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, loading, logistics, itinerary, layer]);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
  }, []);

  const drawLayers = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    import('mapbox-gl').then(async ({ default: mapboxgl }) => {
      clearMarkers();

      // ── Remove old GeoJSON sources/layers ──
      ['route-line', 'route-line-border'].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource('route')) map.removeSource('route');

      const bounds = new mapboxgl.LngLatBounds();
      const showTransport = layer === 'all' || layer === 'transport';
      const showStays     = layer === 'all' || layer === 'stays';
      const showItinerary = layer === 'all' || layer === 'itinerary';

      // ── Collect city nodes for route ──────────────────────────────────────────
      type RouteNode = { coords: Coordinates; city: string; label: string; isOrigin?: boolean; isDest?: boolean; confirmed?: boolean };
      const nodes: RouteNode[] = [];

      if (trip.origin?.coordinates || resolvedOrigin.current) {
        const coords = trip.origin?.coordinates ?? resolvedOrigin.current!;
        nodes.push({
          coords,
          city: trip.origin.city,
          label: `${trip.origin.city}, ${trip.origin.country}`,
          isOrigin: true,
        });
      }

      // Sort additionalDestinations by arrivalDate if present
      const extra = (trip.additionalDestinations ?? []).slice().sort((a, b) =>
        (a.arrivalDate ?? '') < (b.arrivalDate ?? '') ? -1 : 1
      );
      for (const d of extra) {
        if (d.coordinates) {
          nodes.push({ coords: d.coordinates, city: d.city, label: `${d.city}, ${d.country}` });
        } else {
          const c = await geocode(`${d.city}, ${d.country}`, token);
          if (c) nodes.push({ coords: c, city: d.city, label: `${d.city}, ${d.country}` });
        }
      }

      if (trip.destination?.coordinates || resolvedDest.current) {
        const coords = trip.destination?.coordinates ?? resolvedDest.current!;
        nodes.push({
          coords,
          city: trip.destination.city,
          label: `${trip.destination.city}, ${trip.destination.country}`,
          isDest: true,
        });
      } else {
        const c = await geocode(`${trip.destination?.city}, ${trip.destination?.country}`, token);
        if (c) nodes.push({
          coords: c,
          city: trip.destination?.city ?? '',
          label: `${trip.destination?.city}, ${trip.destination?.country}`,
          isDest: true,
        });
      }

      // ── Transport booking status for each leg ─────────────────────────────────
      const transport: TransportEntry[] = logistics?.transportation ?? [];
      const mainTransportConfirmed = transport.length > 0 && transport.some(t => STATUS_IS_CONFIRMED(t.status));

      // ── Draw route lines between nodes ────────────────────────────────────────
      if (showTransport && nodes.length >= 2) {
        const coordinates = nodes.map(n => [n.coords.lng, n.coords.lat]);

        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates },
          },
        });

        // Add the main line first, then the glow behind it
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': mainTransportConfirmed ? '#55702C' : '#C9521B',
            'line-width': mainTransportConfirmed ? 2.5 : 2,
            'line-opacity': 0.9,
            'line-dasharray': mainTransportConfirmed ? [1] : [4, 3],
          },
        });

        map.addLayer({
          id: 'route-line-border',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': mainTransportConfirmed ? '#55702C' : '#C9521B',
            'line-width': 6,
            'line-opacity': 0.15,
            'line-blur': 3,
          },
        }, 'route-line');

        nodes.forEach(n => bounds.extend([n.coords.lng, n.coords.lat]));
      }

      // ── City markers (origin / destination / stops) ───────────────────────────
      if (showTransport) {
        nodes.forEach((node, i) => {
          const isOrigin = i === 0;
          const isDest   = i === nodes.length - 1;
          const color    = isOrigin ? '#1D2642' : isDest ? '#C9521B' : '#55702C';

          const el = document.createElement('div');
          el.style.cssText = `
            width: 14px; height: 14px;
            border-radius: 50%;
            background: ${color};
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
            cursor: default;
          `;

          // Label bubble
          const label = document.createElement('div');
          label.style.cssText = `
            position: absolute;
            bottom: 18px;
            left: 50%;
            transform: translateX(-50%);
            background: ${color};
            color: white;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 10px;
            white-space: nowrap;
            letter-spacing: 0.3px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            pointer-events: none;
          `;
          label.textContent = node.city;
          el.style.position = 'relative';
          el.appendChild(label);

          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([node.coords.lng, node.coords.lat])
            .addTo(map);
          markersRef.current.push(marker);
        });
      }

      // ── Accommodation markers ─────────────────────────────────────────────────
      if (showStays && logistics?.accommodation?.length > 0) {
        for (const accom of logistics.accommodation as AccomEntry[]) {
          let coords: Coordinates | null = null;

          // Try geocoding the address
          if (accom.address) {
            coords = await geocode(accom.address, token);
          }
          if (!coords && accom.name) {
            const destCity = trip.destination?.city ?? '';
            coords = await geocode(`${accom.name} ${destCity}`, token);
          }

          if (!coords) continue;

          bounds.extend([coords.lng, coords.lat]);
          const confirmed = STATUS_IS_CONFIRMED(accom.status);

          const el = document.createElement('div');
          el.style.cssText = `
            width: 28px; height: 28px;
            border-radius: 8px;
            background: ${confirmed ? '#5c35a0' : 'white'};
            border: 2px solid ${confirmed ? '#5c35a0' : '#5c35a0'};
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            cursor: pointer;
            font-size: 14px;
          `;
          el.textContent = '🏨';

          const popup = new mapboxgl.Popup({ offset: 20, closeButton: false, className: 'tabiji-popup' })
            .setHTML(`
              <div style="font-family: system-ui; padding: 4px 2px;">
                <div style="font-weight:700; font-size:13px; color:#1D2642;">${accom.name}</div>
                <div style="font-size:11px; color:#6b7280; margin-top:2px;">${accom.type ?? 'Accommodation'}</div>
                <div style="margin-top:6px; display:inline-block; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700;
                  background:${confirmed ? '#dcfce7' : '#fef3c7'}; color:${confirmed ? '#166534' : '#92400e'};">
                  ${accom.status?.replace('_', ' ') ?? 'Unknown'}
                </div>
                ${accom.checkIn ? `<div style="font-size:10px;color:#6b7280;margin-top:4px;">Check-in: ${new Date(accom.checkIn).toLocaleDateString('en-IE',{day:'numeric',month:'short'})}</div>` : ''}
              </div>
            `);

          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([coords.lng, coords.lat])
            .setPopup(popup)
            .addTo(map);
          markersRef.current.push(marker);
        }
      }

      // ── Itinerary stop markers ────────────────────────────────────────────────
      if (showItinerary) {
        const allStops = itinerary.flatMap(d => d.stops);
        for (const stop of allStops) {
          if (!stop.coordinates?.lat) continue;
          const { lat, lng } = stop.coordinates;
          bounds.extend([lng, lat]);

          const color = STOP_COLOUR[stop.type] ?? STOP_COLOUR.other;

          const el = document.createElement('div');
          el.style.cssText = `
            width: 10px; height: 10px;
            border-radius: 50%;
            background: ${color};
            border: 2px solid white;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
            cursor: pointer;
          `;

          const popup = new mapboxgl.Popup({ offset: 14, closeButton: false, className: 'tabiji-popup' })
            .setHTML(`
              <div style="font-family: system-ui; padding: 4px 2px;">
                <div style="font-weight:700; font-size:12px; color:#1D2642;">${stop.name}</div>
                <div style="font-size:10px; color:#6b7280; text-transform:capitalize; margin-top:1px;">${stop.type}</div>
                ${stop.address ? `<div style="font-size:10px;color:#9ca3af;margin-top:3px;">${stop.address}</div>` : ''}
              </div>
            `);

          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(map);
          markersRef.current.push(marker);
        }
      }

      // ── Fit map to all markers ────────────────────────────────────────────────
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: { top: 60, bottom: 60, left: 60, right: 60 },
          maxZoom: 14,
          duration: 800,
        });
      }
    });
  }, [mapReady, loading, logistics, itinerary, layer, trip, token, clearMarkers]);

  // ── Derived stats for the info strip ─────────────────────────────────────────
  const transport       = logistics?.transportation ?? [];
  const accommodation   = logistics?.accommodation  ?? [];
  const stopsWithCoords = itinerary.flatMap(d => d.stops).filter(s => s.coordinates?.lat);
  const confirmedLegs   = transport.filter((t: TransportEntry) => STATUS_IS_CONFIRMED(t.status));
  const confirmedStays  = accommodation.filter((a: AccomEntry) => STATUS_IS_CONFIRMED(a.status));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Map container ── */}
      <Paper sx={{ overflow: 'hidden', borderRadius: 2, position: 'relative' }}>
        {/* Layer filter */}
        <Box sx={{
          position: 'absolute', top: 12, left: 12, zIndex: 10,
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderRadius: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          backdropFilter: 'blur(4px)',
        }}>
          <ToggleButtonGroup
            value={layer}
            exclusive
            onChange={(_, v) => { if (v) setLayer(v); }}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                px: { xs: 1.25, sm: 1.75 },
                py: 0.75,
                fontSize: { xs: '0.68rem', sm: '0.72rem' },
                fontWeight: 700,
                textTransform: 'none',
                border: 'none',
                color: 'text.secondary',
                '&.Mui-selected': { backgroundColor: alpha('#55702C', 0.12), color: '#55702C' },
              },
            }}
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="transport">Route</ToggleButton>
            <ToggleButton value="stays">Stays</ToggleButton>
            <ToggleButton value="itinerary">Itinerary</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Map */}
        <Box
          ref={mapContainer}
          sx={{
            width: '100%',
            height: { xs: 320, sm: 420, md: 500 },
            backgroundColor: '#f0ede8',
          }}
        />

        {/* Loading overlay */}
        {(loading || !mapReady) && !tokenError && (
          <Box sx={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: alpha('#f0ede8', 0.85),
          }}>
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress size={32} sx={{ color: '#55702C' }} />
              <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary', fontSize: '0.72rem' }}>
                Loading map…
              </Typography>
            </Box>
          </Box>
        )}

        {/* Token error overlay */}
        {tokenError && (
          <Box sx={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: alpha('#f0ede8', 0.95),
          }}>
            <Box sx={{ textAlign: 'center', px: 3 }}>
              <MapIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" fontWeight={700} color="text.secondary">
                Map unavailable
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                NEXT_PUBLIC_MAPBOX_TOKEN is not set in .env.local
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>

      {/* ── Booking status strip ── */}
      <Paper sx={{ p: { xs: 2, sm: 2.5 }, backgroundColor: 'background.paper' }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2, fontSize: '0.8rem', letterSpacing: 0.5, textTransform: 'uppercase', color: 'text.secondary' }}>
          Journey Overview
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 2, sm: 3 } }}>

          {/* Route */}
          <Box sx={{ minWidth: 120 }}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0.6, color: 'text.disabled', textTransform: 'uppercase', mb: 0.75 }}>
              Route
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#1D2642', flexShrink: 0 }} />
              <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.88rem' }}>
                {trip.origin?.city}
              </Typography>
            </Box>
            {(trip.additionalDestinations ?? []).map((d, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, pl: 0.25 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#55702C', flexShrink: 0 }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                  {d.city}
                </Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#C9521B', flexShrink: 0 }} />
              <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.88rem', color: 'secondary.main' }}>
                {trip.destination?.city}
              </Typography>
            </Box>
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Transport */}
          <Box sx={{ minWidth: 140 }}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0.6, color: 'text.disabled', textTransform: 'uppercase', mb: 0.75 }}>
              Transport ({transport.length})
            </Typography>
            {transport.length === 0 ? (
              <Typography variant="caption" color="text.disabled">None added</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {transport.map((t: TransportEntry, i: number) => {
                  const confirmed = STATUS_IS_CONFIRMED(t.status);
                  const color = TRANSPORT_COLOUR[t.type] ?? '#6b7280';
                  return (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ color, display: 'flex' }}>
                        <TransportIcon type={t.type} size={14} />
                      </Box>
                      <Typography variant="caption" sx={{ fontSize: '0.78rem', flexGrow: 1 }}>
                        {t.departureLocation && t.arrivalLocation
                          ? `${t.departureLocation} → ${t.arrivalLocation}`
                          : t.type.replace('_', ' ')}
                      </Typography>
                      {confirmed
                        ? <CheckCircleIcon sx={{ fontSize: 13, color: 'success.main' }} />
                        : <RadioButtonUncheckedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>

          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />

          {/* Accommodation */}
          <Box sx={{ minWidth: 140 }}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0.6, color: 'text.disabled', textTransform: 'uppercase', mb: 0.75 }}>
              Stays ({accommodation.length})
            </Typography>
            {accommodation.length === 0 ? (
              <Typography variant="caption" color="text.disabled">None added</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {accommodation.map((a: AccomEntry, i: number) => {
                  const confirmed = STATUS_IS_CONFIRMED(a.status);
                  return (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <HotelIcon sx={{ fontSize: 13, color: confirmed ? '#5c35a0' : 'text.disabled' }} />
                      <Typography variant="caption" sx={{ fontSize: '0.78rem', flexGrow: 1 }}>
                        {a.name || a.type}
                      </Typography>
                      {confirmed
                        ? <CheckCircleIcon sx={{ fontSize: 13, color: 'success.main' }} />
                        : <RadioButtonUncheckedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>

          {stopsWithCoords.length > 0 && (
            <>
              <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
              <Box sx={{ minWidth: 100 }}>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0.6, color: 'text.disabled', textTransform: 'uppercase', mb: 0.75 }}>
                  On map
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ExploreIcon sx={{ fontSize: 13, color: '#55702C' }} />
                  <Typography variant="caption" sx={{ fontSize: '0.78rem' }}>
                    {stopsWithCoords.length} itinerary stop{stopsWithCoords.length !== 1 ? 's' : ''}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem', mt: 0.25, display: 'block' }}>
                  Tap markers to see details
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </Paper>

      {/* ── Legend ── */}
      <Paper sx={{ p: { xs: 1.75, sm: 2 }, backgroundColor: 'background.paper' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1.5, sm: 2 }, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 24, height: 2.5, backgroundColor: '#55702C', borderRadius: 1, flexShrink: 0 }} />
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Confirmed route</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{
              width: 24, height: 2.5, borderRadius: 1, flexShrink: 0,
              backgroundImage: 'repeating-linear-gradient(to right, #C9521B 0, #C9521B 6px, transparent 6px, transparent 10px)',
            }} />
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Unconfirmed route</Typography>
          </Box>
          <Box sx={{ width: 1, height: 16, backgroundColor: 'divider', display: { xs: 'none', sm: 'block' } }} />
          <LegendItem color="#1D2642" label="Origin" />
          <LegendItem color="#C9521B" label="Destination" />
          <LegendItem color="#5c35a0" label="Accommodation" />
          <LegendItem color="#55702C" label="Itinerary stops" />
        </Box>
      </Paper>

    </Box>
  );
}