'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Chip, CircularProgress,
  IconButton, Divider, alpha, Tooltip, Button,
} from '@mui/material';
import FlightIcon          from '@mui/icons-material/Flight';
import TrainIcon           from '@mui/icons-material/Train';
import DirectionsBusIcon   from '@mui/icons-material/DirectionsBus';
import DirectionsBoatIcon  from '@mui/icons-material/DirectionsBoat';
import DirectionsCarIcon   from '@mui/icons-material/DirectionsCar';
import LocalTaxiIcon       from '@mui/icons-material/LocalTaxi';
import AirportShuttleIcon  from '@mui/icons-material/AirportShuttle';
import PedalBikeIcon       from '@mui/icons-material/PedalBike';
import HotelIcon           from '@mui/icons-material/Hotel';
import EventIcon           from '@mui/icons-material/Event';
import WorkIcon            from '@mui/icons-material/Work';
import RestaurantIcon      from '@mui/icons-material/Restaurant';
import ExploreIcon         from '@mui/icons-material/Explore';
import FreeBreakfastIcon   from '@mui/icons-material/FreeBreakfast';
import NotesIcon           from '@mui/icons-material/Notes';
import LightbulbIcon       from '@mui/icons-material/Lightbulb';
import AlarmIcon           from '@mui/icons-material/Alarm';
import StarIcon            from '@mui/icons-material/Star';
import LocationOnIcon      from '@mui/icons-material/LocationOn';
import AccessTimeIcon      from '@mui/icons-material/AccessTime';
import CheckCircleIcon     from '@mui/icons-material/CheckCircle';
import NavigationIcon      from '@mui/icons-material/Navigation';
import WbSunnyIcon         from '@mui/icons-material/WbSunny';
import NightsStayIcon      from '@mui/icons-material/NightsStay';
import RefreshIcon         from '@mui/icons-material/Refresh';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trip {
  _id: string;
  name: string;
  destination: { city: string; country: string; countryCode?: string };
  origin?: { city: string; country: string };
  startDate: string;
  endDate: string;
  nights?: number;
  tripType: string;
  purpose?: string;
  coverPhotoUrl?: string;
  coverPhotoThumb?: string;
}

interface Stop {
  _id?: string;
  name: string;
  type: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  scheduledStart?: string;
  time?: string;
  duration: number;
  notes?: string;
  completed?: boolean;
  source?: string;
}

interface ItineraryDay {
  date: string;
  dayNumber: number;
  stops: Stop[];
}

interface Transport {
  type: string;
  status: string;
  departureLocation: string;
  arrivalLocation: string;
  departureTime: string;
  arrivalTime: string;
  confirmationNumber?: string;
  details: {
    airline?: string;
    flightNumber?: string;
    operator?: string;
    rentalCompany?: string;
    pickupLocation?: string;
  };
}

interface Accommodation {
  type: string;
  status: string;
  name: string;
  address?: string;
  checkIn: string;
  checkOut: string;
  confirmationNumber?: string;
  notes?: string;
}

interface Note {
  _id: string;
  resourceType: 'note';
  name?: string;
  body?: string;
  type: string;
  createdAt: string;
  linkedTo?: { label?: string };
}

interface OnTripScreenProps {
  tripId: string;
  trip: Trip;
}

// ─── Config maps ──────────────────────────────────────────────────────────────

const STOP_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  flight:      { label: 'Flight',        color: '#C9521B', Icon: FlightIcon },
  hotel:       { label: 'Accommodation', color: '#5c35a0', Icon: HotelIcon },
  meeting:     { label: 'Meeting',       color: '#1D2642', Icon: WorkIcon },
  meal:        { label: 'Meal',          color: '#b45309', Icon: RestaurantIcon },
  breakfast:   { label: 'Breakfast',     color: '#b45309', Icon: FreeBreakfastIcon },
  activity:    { label: 'Activity',      color: '#55702C', Icon: ExploreIcon },
  sightseeing: { label: 'Sightseeing',   color: '#55702C', Icon: ExploreIcon },
  transport:   { label: 'Transport',     color: '#0369a1', Icon: DirectionsBusIcon },
  work:        { label: 'Work block',    color: '#1D2642', Icon: WorkIcon },
  other:       { label: 'Other',         color: '#6b7280', Icon: EventIcon },
};

const TRANSPORT_ICON: Record<string, any> = {
  flight:           FlightIcon,
  train:            TrainIcon,
  bus:              DirectionsBusIcon,
  ferry:            DirectionsBoatIcon,
  car:              DirectionsCarIcon,
  car_hire:         DirectionsCarIcon,
  taxi:             LocalTaxiIcon,
  private_transfer: AirportShuttleIcon,
  bicycle:          PedalBikeIcon,
};

const TRANSPORT_LABEL: Record<string, string> = {
  flight: 'Flight', train: 'Train', bus: 'Bus', ferry: 'Ferry',
  car: 'Car', car_hire: 'Car hire', taxi: 'Taxi',
  private_transfer: 'Transfer', bicycle: 'Bicycle',
};

const NOTE_ICON: Record<string, any> = {
  general: NotesIcon, observation: LightbulbIcon,
  reminder: AlarmIcon, recommendation: StarIcon,
};

const NOTE_COLOR: Record<string, string> = {
  general: '#55702C', observation: '#0891b2',
  reminder: '#C9521B', recommendation: '#7c3aed',
};

const STATUS_COLOR: Record<string, string> = {
  not_booked: '#6b7280', pending: '#b45309',
  booked: '#0369a1', confirmed: '#55702C', cancelled: '#dc2626',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function stopStartMinutes(stop: Stop): number | null {
  const timeStr = stop.scheduledStart
    ? stop.scheduledStart.includes('T')
      ? stop.scheduledStart.split('T')[1]?.slice(0, 5)
      : stop.scheduledStart
    : stop.time;
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function fmtTime(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtDateTime(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IE', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function dayOfTrip(startDate: string): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
}

function tripNights(startDate: string, endDate: string): number {
  const s = new Date(startDate);
  const e = new Date(endDate);
  return Math.round((e.getTime() - s.getTime()) / 86400000);
}

// Map deep links
function mapsLinks(name: string, address?: string, coords?: { lat: number; lng: number }) {
  const q = coords ? `${coords.lat},${coords.lng}` : encodeURIComponent(address || name);
  const label = encodeURIComponent(name);
  return {
    apple:  coords
      ? `https://maps.apple.com/?ll=${coords.lat},${coords.lng}&q=${label}`
      : `https://maps.apple.com/?q=${encodeURIComponent(address || name)}`,
    google: coords
      ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || name)}`,
    waze:   coords
      ? `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(address || name)}&navigate=yes`,
  };
}

function hasLocation(stop: Stop): boolean {
  return !!(stop.address || stop.coordinates);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="overline" sx={{
      fontSize: '0.7rem', fontWeight: 800, letterSpacing: 1.2,
      color: 'text.disabled', display: 'block', mb: 1,
    }}>
      {children}
    </Typography>
  );
}

function MapButtons({ name, address, coordinates }: { name: string; address?: string; coordinates?: { lat: number; lng: number } }) {
  const links = mapsLinks(name, address, coordinates);
  return (
    <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
      <Button component="a" href={links.apple} target="_blank" rel="noopener noreferrer" size="small"
        startIcon={<NavigationIcon sx={{ fontSize: '0.85rem !important' }} />}
        sx={{ fontSize: '0.72rem', fontWeight: 700, py: 0.4, px: 1, minHeight: 28,
          backgroundColor: alpha('#1D2642', 0.07), color: '#1D2642',
          '&:hover': { backgroundColor: alpha('#1D2642', 0.13) } }}>
        Apple Maps
      </Button>
      <Button component="a" href={links.google} target="_blank" rel="noopener noreferrer" size="small"
        startIcon={<NavigationIcon sx={{ fontSize: '0.85rem !important' }} />}
        sx={{ fontSize: '0.72rem', fontWeight: 700, py: 0.4, px: 1, minHeight: 28,
          backgroundColor: alpha('#0369a1', 0.07), color: '#0369a1',
          '&:hover': { backgroundColor: alpha('#0369a1', 0.13) } }}>
        Google Maps
      </Button>
      <Button component="a" href={links.waze} target="_blank" rel="noopener noreferrer" size="small"
        startIcon={<NavigationIcon sx={{ fontSize: '0.85rem !important' }} />}
        sx={{ fontSize: '0.72rem', fontWeight: 700, py: 0.4, px: 1, minHeight: 28,
          backgroundColor: alpha('#00bcd4', 0.07), color: '#00838f',
          '&:hover': { backgroundColor: alpha('#00bcd4', 0.13) } }}>
        Waze
      </Button>
    </Box>
  );
}

// ─── Card: current / next stop ─────────────────────────────────────────────

function RightNowCard({ stop, startMins }: { stop: Stop; startMins: number | null }) {
  const cfg   = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
  const Icon  = cfg.Icon;
  const now   = nowMinutes();
  const endM  = startMins !== null ? startMins + stop.duration : null;
  const inProg = startMins !== null && endM !== null && now >= startMins && now < endM;
  const remaining = endM !== null && inProg ? endM - now : null;

  return (
    <Paper elevation={0} sx={{ border: `2px solid ${cfg.color}`, borderRadius: 2.5, overflow: 'hidden' }}>
      {/* colour bar */}
      <Box sx={{ height: 4, backgroundColor: cfg.color }} />
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, backgroundColor: alpha(cfg.color, 0.12),
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon sx={{ fontSize: 22, color: cfg.color }} />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body1" fontWeight={800} sx={{ fontSize: '1rem', lineHeight: 1.3 }}>
                {stop.name}
              </Typography>
              {inProg && (
                <Chip label="In progress" size="small"
                  sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, backgroundColor: alpha(cfg.color, 0.12), color: cfg.color }} />
              )}
              {!inProg && startMins !== null && (
                <Chip label={`at ${fmtTime(startMins)}`} size="small"
                  sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, backgroundColor: alpha(cfg.color, 0.1), color: cfg.color }} />
              )}
            </Box>

            {remaining !== null && (
              <Typography variant="body2" sx={{ color: cfg.color, fontWeight: 700, mt: 0.25, fontSize: '0.85rem' }}>
                {remaining < 60
                  ? `${remaining} min${remaining !== 1 ? 's' : ''} remaining`
                  : `${Math.floor(remaining / 60)}h ${remaining % 60}m remaining`}
              </Typography>
            )}

            {stop.address && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                <LocationOnIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
                  {stop.address}
                </Typography>
              </Box>
            )}

            {stop.notes && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem', mt: 0.5, display: 'block' }}>
                {stop.notes}
              </Typography>
            )}

            {hasLocation(stop) && (
              <MapButtons name={stop.name} address={stop.address} coordinates={stop.coordinates} />
            )}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

// ─── Card: itinerary stop (compact) ──────────────────────────────────────────

function StopRow({ stop, past }: { stop: Stop; past: boolean }) {
  const cfg   = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
  const Icon  = cfg.Icon;
  const startM = stopStartMinutes(stop);

  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 1.25, px: { xs: 2, sm: 2.5 }, opacity: past ? 0.45 : 1 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.25 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: 1.5, backgroundColor: alpha(cfg.color, 0.12),
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {stop.completed
            ? <CheckCircleIcon sx={{ fontSize: 18, color: cfg.color }} />
            : <Icon sx={{ fontSize: 17, color: cfg.color }} />}
        </Box>
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, justifyContent: 'space-between' }}>
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.88rem', lineHeight: 1.3 }}>
            {stop.name}
          </Typography>
          {startM !== null && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem', flexShrink: 0 }}>
              {fmtTime(startM)}
            </Typography>
          )}
        </Box>
        {stop.address && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            {stop.address}
          </Typography>
        )}
        {stop.duration > 0 && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem', display: 'block' }}>
            {stop.duration < 60 ? `${stop.duration} min` : `${Math.floor(stop.duration / 60)}h${stop.duration % 60 ? ` ${stop.duration % 60}m` : ''}`}
          </Typography>
        )}
        {hasLocation(stop) && (
          <MapButtons name={stop.name} address={stop.address} coordinates={stop.coordinates} />
        )}
      </Box>
    </Box>
  );
}

// ─── Card: upcoming transport ─────────────────────────────────────────────────

function TransportCard({ t }: { t: Transport }) {
  const TIcon  = TRANSPORT_ICON[t.type] ?? FlightIcon;
  const label  = TRANSPORT_LABEL[t.type] ?? 'Transport';
  const color  = t.type === 'flight' ? '#C9521B' : t.type === 'train' ? '#0369a1' : '#55702C';
  const subline = t.type === 'flight'
    ? [t.details.airline, t.details.flightNumber].filter(Boolean).join(' ')
    : t.details.operator ?? '';

  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 1.5, px: { xs: 2, sm: 2.5 } }}>
      <Box sx={{ width: 36, height: 36, borderRadius: 1.5, backgroundColor: alpha(color, 0.1),
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
        <TIcon sx={{ fontSize: 18, color }} />
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.88rem' }}>
            {t.departureLocation && t.arrivalLocation
              ? `${t.departureLocation} → ${t.arrivalLocation}`
              : t.departureLocation || label}
          </Typography>
          <Chip
            label={t.status.replace('_', ' ')} size="small"
            sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700,
              backgroundColor: alpha(STATUS_COLOR[t.status] ?? '#6b7280', 0.1),
              color: STATUS_COLOR[t.status] ?? '#6b7280' }}
          />
        </Box>
        {subline && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            {subline}
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25, flexWrap: 'wrap' }}>
          {t.departureTime && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>
              ✈ {fmtDateTime(t.departureTime)}
            </Typography>
          )}
          {t.arrivalTime && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>
              → {fmtDateTime(t.arrivalTime)}
            </Typography>
          )}
        </Box>
        {t.confirmationNumber && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', fontWeight: 600, mt: 0.25, display: 'block' }}>
            Ref: {t.confirmationNumber}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ─── Card: accommodation ──────────────────────────────────────────────────────

function AccomCard({ a }: { a: Accommodation }) {
  const today = todayIso();
  const checkInDate  = a.checkIn?.split('T')[0];
  const checkOutDate = a.checkOut?.split('T')[0];
  const isCurrent = checkInDate && checkOutDate && today >= checkInDate && today <= checkOutDate;

  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 1.5, px: { xs: 2, sm: 2.5 } }}>
      <Box sx={{ width: 36, height: 36, borderRadius: 1.5, backgroundColor: alpha('#5c35a0', 0.1),
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
        <HotelIcon sx={{ fontSize: 18, color: '#5c35a0' }} />
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.88rem' }}>
            {a.name}
          </Typography>
          {isCurrent && (
            <Chip label="Staying here" size="small"
              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700,
                backgroundColor: alpha('#55702C', 0.1), color: '#55702C' }} />
          )}
          <Chip label={a.status.replace('_', ' ')} size="small"
            sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700,
              backgroundColor: alpha(STATUS_COLOR[a.status] ?? '#6b7280', 0.1),
              color: STATUS_COLOR[a.status] ?? '#6b7280' }} />
        </Box>
        {a.address && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
            <LocationOnIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              {a.address}
            </Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25, flexWrap: 'wrap' }}>
          {a.checkIn && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>
              Check-in {fmtDate(a.checkIn)}
            </Typography>
          )}
          {a.checkOut && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>
              · Check-out {fmtDate(a.checkOut)}
            </Typography>
          )}
        </Box>
        {a.confirmationNumber && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', fontWeight: 600, mt: 0.25, display: 'block' }}>
            Ref: {a.confirmationNumber}
          </Typography>
        )}
        {a.address && (
          <MapButtons name={a.name} address={a.address} />
        )}
      </Box>
    </Box>
  );
}

// ─── Card: note ───────────────────────────────────────────────────────────────

function NoteRow({ note }: { note: Note }) {
  const Icon  = NOTE_ICON[note.type] ?? NotesIcon;
  const color = NOTE_COLOR[note.type] ?? '#55702C';

  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 1.25, px: { xs: 2, sm: 2.5 } }}>
      <Box sx={{ width: 30, height: 30, borderRadius: 1.5, backgroundColor: alpha(color, 0.1),
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
        <Icon sx={{ fontSize: 16, color }} />
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {note.name && (
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem', lineHeight: 1.3 }}>
            {note.name}
          </Typography>
        )}
        {note.body && (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', lineHeight: 1.5, mt: note.name ? 0.25 : 0 }}>
            {note.body.length > 160 ? `${note.body.slice(0, 160)}…` : note.body}
          </Typography>
        )}
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
          {new Date(note.createdAt).toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {note.linkedTo?.label ? ` · ${note.linkedTo.label}` : ''}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OnTripScreen({ tripId, trip }: OnTripScreenProps) {
  const [itinerary,   setItinerary]   = useState<ItineraryDay[]>([]);
  const [logistics,   setLogistics]   = useState<{ transportation: Transport[]; accommodation: Accommodation[] } | null>(null);
  const [notes,       setNotes]       = useState<Note[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [now,         setNow]         = useState(new Date());

  // Tick every minute so "right now" stays accurate
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const [itin, log, files] = await Promise.all([
        fetch(`/api/trips/${tripId}/itinerary`).then(r => r.json()),
        fetch(`/api/trips/${tripId}/logistics`).then(r => r.json()),
        fetch(`/api/trips/${tripId}/files`).then(r => r.json()),
      ]);
      setItinerary(itin.days ?? []);
      setLogistics(log.logistics ?? null);
      setNotes((files.files ?? []).filter((f: any) => f.resourceType === 'note'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const today        = todayIso();
  const dayNum       = dayOfTrip(trip.startDate);
  const totalNights  = trip.nights ?? tripNights(trip.startDate, trip.endDate);
  const totalDays    = totalNights + 1;

  const todayDay  = itinerary.find(d => d.date.split('T')[0] === today);
  const todayStops = todayDay?.stops ?? [];

  const nowMins = now.getHours() * 60 + now.getMinutes();

  // RIGHT NOW: find in-progress or the next upcoming stop today
  const timedStops = todayStops
    .map(s => ({ stop: s, startM: stopStartMinutes(s) }))
    .filter(x => x.startM !== null)
    .sort((a, b) => a.startM! - b.startM!);

  const inProgress = timedStops.find(x => {
    const endM = x.startM! + x.stop.duration;
    return nowMins >= x.startM! && nowMins < endM;
  });
  const nextUp = !inProgress
    ? timedStops.find(x => x.startM! > nowMins)
    : null;

  const rightNow = inProgress ?? nextUp ?? null;

  // TODAY stops: all, with past flag
  const todayStopsWithPast = timedStops.map(x => ({
    ...x,
    past: (x.startM! + x.stop.duration) < nowMins && !x.stop.completed,
  }));
  // Also include untimed stops
  const untimedStops = todayStops.filter(s => stopStartMinutes(s) === null);

  // Upcoming transport — within next 24 hours or remaining on trip
  const upcomingTransport = (logistics?.transportation ?? [])
    .filter(t => {
      if (!t.departureTime) return false;
      const dep = new Date(t.departureTime);
      return dep >= now;
    })
    .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime())
    .slice(0, 3);

  // Current or next accommodation
  const relevantAccom = (logistics?.accommodation ?? [])
    .filter(a => {
      if (!a.checkOut) return false;
      const co = new Date(a.checkOut);
      co.setHours(23, 59, 59);
      return co >= now;
    })
    .sort((a, b) => {
      const aIn = a.checkIn ? new Date(a.checkIn).getTime() : 0;
      const bIn = b.checkIn ? new Date(b.checkIn).getTime() : 0;
      return aIn - bIn;
    })
    .slice(0, 2);

  // Recent notes — last 5
  const recentNotes = [...notes]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={32} sx={{ color: '#55702C' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* ── Hero banner ──────────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{
        borderRadius: 3, overflow: 'hidden', position: 'relative', minHeight: 140,
        background: trip.coverPhotoUrl
          ? `linear-gradient(to bottom, ${alpha('#000', 0.15)} 0%, ${alpha('#000', 0.55)} 100%), url(${trip.coverPhotoUrl}) center/cover no-repeat`
          : `linear-gradient(135deg, #1D2642 0%, #55702C 100%)`,
      }}>
        <Box sx={{ p: { xs: 2.5, sm: 3 }, position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h5" fontWeight={900} sx={{ color: 'white', fontSize: { xs: '1.3rem', sm: '1.6rem' }, lineHeight: 1.2 }}>
                {trip.destination.city}
              </Typography>
              <Typography variant="body2" sx={{ color: alpha('#fff', 0.8), fontWeight: 600, mt: 0.25 }}>
                {trip.destination.country}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" sx={{ color: 'white', fontWeight: 800, fontSize: '1rem' }}>
                Day {dayNum} of {totalDays}
              </Typography>
              <Typography variant="caption" sx={{ color: alpha('#fff', 0.75), display: 'block' }}>
                {totalNights} night{totalNights !== 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
            <Chip
              label={trip.tripType.charAt(0).toUpperCase() + trip.tripType.slice(1)}
              size="small"
              sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700,
                backgroundColor: alpha('#fff', 0.2), color: 'white',
                border: `1px solid ${alpha('#fff', 0.3)}` }}
            />
            <Chip
              label={`${fmtDate(trip.startDate)} – ${fmtDate(trip.endDate)}`}
              size="small"
              sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600,
                backgroundColor: alpha('#fff', 0.15), color: 'white',
                border: `1px solid ${alpha('#fff', 0.25)}` }}
            />
          </Box>
        </Box>
        {/* refresh button */}
        <Tooltip title="Refresh">
          <IconButton
            onClick={() => load(true)} disabled={refreshing} size="small"
            sx={{ position: 'absolute', top: 12, right: 12, color: 'white',
              backgroundColor: alpha('#fff', 0.15), '&:hover': { backgroundColor: alpha('#fff', 0.25) } }}
          >
            {refreshing
              ? <CircularProgress size={16} sx={{ color: 'white' }} />
              : <RefreshIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Paper>

      {/* ── RIGHT NOW ────────────────────────────────────────────────────────── */}
      {rightNow && (
        <Box>
          <SectionLabel>
            {inProgress ? '🔴 Right now' : '⏭ Up next'}
          </SectionLabel>
          <RightNowCard stop={rightNow.stop} startMins={rightNow.startM} />
        </Box>
      )}

      {/* ── TODAY ────────────────────────────────────────────────────────────── */}
      {(todayStopsWithPast.length > 0 || untimedStops.length > 0) && (
        <Box>
          <SectionLabel>
            📅 Today — {new Date(today).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </SectionLabel>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            {todayStopsWithPast.map(({ stop, startM, past }, i) => (
              <Box key={stop._id ?? i}>
                {i > 0 && <Divider />}
                <StopRow stop={stop} past={past} />
              </Box>
            ))}
            {untimedStops.length > 0 && todayStopsWithPast.length > 0 && <Divider />}
            {untimedStops.map((stop, i) => (
              <Box key={stop._id ?? `u${i}`}>
                {i > 0 && <Divider />}
                <StopRow stop={stop} past={false} />
              </Box>
            ))}
          </Paper>
        </Box>
      )}

      {todayStops.length === 0 && (
        <Box>
          <SectionLabel>📅 Today</SectionLabel>
          <Paper elevation={0} sx={{ p: 3, textAlign: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="body2" color="text.disabled" fontWeight={600}>
              Nothing scheduled for today
            </Typography>
          </Paper>
        </Box>
      )}

      {/* ── UPCOMING TRANSPORT ───────────────────────────────────────────────── */}
      {upcomingTransport.length > 0 && (
        <Box>
          <SectionLabel>🚀 Upcoming transport</SectionLabel>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            {upcomingTransport.map((t, i) => (
              <Box key={i}>
                {i > 0 && <Divider />}
                <TransportCard t={t} />
              </Box>
            ))}
          </Paper>
        </Box>
      )}

      {/* ── ACCOMMODATION ────────────────────────────────────────────────────── */}
      {relevantAccom.length > 0 && (
        <Box>
          <SectionLabel>🏨 Accommodation</SectionLabel>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            {relevantAccom.map((a, i) => (
              <Box key={i}>
                {i > 0 && <Divider />}
                <AccomCard a={a} />
              </Box>
            ))}
          </Paper>
        </Box>
      )}

      {/* ── NOTES ────────────────────────────────────────────────────────────── */}
      {recentNotes.length > 0 && (
        <Box>
          <SectionLabel>📝 Recent notes</SectionLabel>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            {recentNotes.map((note, i) => (
              <Box key={note._id}>
                {i > 0 && <Divider />}
                <NoteRow note={note} />
              </Box>
            ))}
          </Paper>
        </Box>
      )}

    </Box>
  );
}