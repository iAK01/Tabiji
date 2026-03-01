'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Chip, CircularProgress,
  IconButton, Divider, alpha, Tooltip, Button,
} from '@mui/material';
import FlightIcon             from '@mui/icons-material/Flight';
import TrainIcon              from '@mui/icons-material/Train';
import DirectionsBusIcon      from '@mui/icons-material/DirectionsBus';
import DirectionsBoatIcon     from '@mui/icons-material/DirectionsBoat';
import DirectionsCarIcon      from '@mui/icons-material/DirectionsCar';
import LocalTaxiIcon          from '@mui/icons-material/LocalTaxi';
import AirportShuttleIcon     from '@mui/icons-material/AirportShuttle';
import PedalBikeIcon          from '@mui/icons-material/PedalBike';
import HotelIcon              from '@mui/icons-material/Hotel';
import EventIcon              from '@mui/icons-material/Event';
import WorkIcon               from '@mui/icons-material/Work';
import RestaurantIcon         from '@mui/icons-material/Restaurant';
import ExploreIcon            from '@mui/icons-material/Explore';
import FreeBreakfastIcon      from '@mui/icons-material/FreeBreakfast';
import LocationOnIcon         from '@mui/icons-material/LocationOn';
import CheckCircleIcon        from '@mui/icons-material/CheckCircle';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import NavigationIcon         from '@mui/icons-material/Navigation';
import RefreshIcon            from '@mui/icons-material/Refresh';
import AssignmentIcon         from '@mui/icons-material/Assignment';
import BoltIcon               from '@mui/icons-material/Bolt';
import LoginIcon              from '@mui/icons-material/Login';
import LogoutIcon             from '@mui/icons-material/Logout';

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

interface Todo {
  _id: string;
  name: string;
  body?: string;
  type: string;
  dueAt?: string;
  completed: boolean;
  source?: 'manual' | 'packing_advisory';
}

// Unified timeline item
type TimelineItem =
  | { kind: 'stop';      sortMins: number; stop: Stop }
  | { kind: 'transport'; sortMins: number; transport: Transport; event: 'departure' | 'arrival' }
  | { kind: 'accom';     sortMins: number; accom: Accommodation; event: 'checkin' | 'checkout' };

interface OnTripScreenProps {
  tripId: string;
  trip:   Trip;
}

// ─── Config ───────────────────────────────────────────────────────────────────

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

const STATUS_COLOR: Record<string, string> = {
  not_booked: '#6b7280', pending: '#b45309',
  booked: '#0369a1', confirmed: '#55702C', cancelled: '#dc2626',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function isoToMins(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
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

function fmtMins(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
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

function mapsLinks(name: string, address?: string, coords?: { lat: number; lng: number }) {
  return {
    apple: coords
      ? `https://maps.apple.com/?ll=${coords.lat},${coords.lng}&q=${encodeURIComponent(name)}`
      : `https://maps.apple.com/?q=${encodeURIComponent(address || name)}`,
    google: coords
      ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || name)}`,
    waze: coords
      ? `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(address || name)}&navigate=yes`,
  };
}

// ─── Map buttons ──────────────────────────────────────────────────────────────

function MapButtons({ name, address, coordinates }: {
  name: string; address?: string; coordinates?: { lat: number; lng: number };
}) {
  const links = mapsLinks(name, address, coordinates);
  return (
    <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
      {[
        { label: 'Apple Maps', href: links.apple,  color: '#1D2642' },
        { label: 'Google Maps', href: links.google, color: '#0369a1' },
        { label: 'Waze',       href: links.waze,   color: '#00838f' },
      ].map(({ label, href, color }) => (
        <Button
          key={label}
          component="a"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          startIcon={<NavigationIcon sx={{ fontSize: '0.85rem !important' }} />}
          sx={{
            fontSize: '0.72rem', fontWeight: 700, py: 0.4, px: 1, minHeight: 28,
            backgroundColor: alpha(color, 0.08), color,
            '&:hover': { backgroundColor: alpha(color, 0.15) },
          }}
        >
          {label}
        </Button>
      ))}
    </Box>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

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

// ─── Right Now card ───────────────────────────────────────────────────────────

function RightNowCard({ stop, startMins, nowMins }: {
  stop: Stop; startMins: number | null; nowMins: number;
}) {
  const cfg    = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
  const Icon   = cfg.Icon;
  const endM   = startMins !== null ? startMins + stop.duration : null;
  const inProg = startMins !== null && endM !== null && nowMins >= startMins && nowMins < endM;
  const remaining = endM !== null && inProg ? endM - nowMins : null;
  const hasLoc = !!(stop.address || stop.coordinates);

  return (
    <Paper elevation={0} sx={{
      border: `2px solid ${cfg.color}`, borderRadius: 2.5, overflow: 'hidden',
    }}>
      <Box sx={{ height: 4, backgroundColor: cfg.color }} />
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            backgroundColor: alpha(cfg.color, 0.12),
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon sx={{ fontSize: 22, color: cfg.color }} />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body1" fontWeight={800} sx={{ fontSize: '1rem', lineHeight: 1.3 }}>
                {stop.name}
              </Typography>
              {inProg
                ? <Chip label="In progress" size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, backgroundColor: alpha(cfg.color, 0.12), color: cfg.color }} />
                : startMins !== null
                  ? <Chip label={`at ${fmtMins(startMins)}`} size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, backgroundColor: alpha(cfg.color, 0.1), color: cfg.color }} />
                  : null
              }
            </Box>

            {remaining !== null && (
              <Typography variant="body2" sx={{ color: cfg.color, fontWeight: 700, mt: 0.25, fontSize: '0.85rem' }}>
                {remaining < 60
                  ? `${remaining} min${remaining !== 1 ? 's' : ''} remaining`
                  : `${Math.floor(remaining / 60)}h ${remaining % 60}m remaining`}
              </Typography>
            )}

            {!inProg && startMins !== null && endM !== null && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mt: 0.25 }}>
                Until {fmtMins(endM)}
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

            {hasLoc && (
              <MapButtons name={stop.name} address={stop.address} coordinates={stop.coordinates} />
            )}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

// ─── Timeline row ─────────────────────────────────────────────────────────────

function TimelineRow({ item, past }: { item: TimelineItem; past: boolean }) {

  if (item.kind === 'stop') {
    const { stop } = item;
    const cfg  = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
    const Icon = cfg.Icon;
    const hasLoc = !!(stop.address || stop.coordinates);

    return (
      <Box sx={{ display: 'flex', gap: 1.5, py: 1.5, px: { xs: 2, sm: 2.5 }, opacity: past ? 0.4 : 1 }}>
        <Box sx={{
          width: 34, height: 34, borderRadius: 1.5, flexShrink: 0, mt: 0.25,
          backgroundColor: alpha(cfg.color, 0.1),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {stop.completed
            ? <CheckCircleIcon sx={{ fontSize: 18, color: cfg.color }} />
            : <Icon sx={{ fontSize: 17, color: cfg.color }} />
          }
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.88rem' }}>
              {stop.name}
            </Typography>
            {item.sortMins >= 0 && (
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem', flexShrink: 0 }}>
                {fmtMins(item.sortMins)}
              </Typography>
            )}
          </Box>
          {stop.address && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              {stop.address}
            </Typography>
          )}
          {hasLoc && <MapButtons name={stop.name} address={stop.address} coordinates={stop.coordinates} />}
        </Box>
      </Box>
    );
  }

  if (item.kind === 'transport') {
    const { transport: t, event } = item;
    const TIcon  = TRANSPORT_ICON[t.type] ?? FlightIcon;
    const color  = t.type === 'flight' ? '#C9521B' : t.type === 'train' ? '#0369a1' : '#55702C';
    const isArr  = event === 'arrival';
    const label  = isArr ? `Arrive ${t.arrivalLocation}` : `${TRANSPORT_LABEL[t.type] ?? 'Depart'} — ${t.departureLocation} → ${t.arrivalLocation}`;
    const time   = isArr ? t.arrivalTime : t.departureTime;
    const subline = t.type === 'flight'
      ? [t.details.airline, t.details.flightNumber].filter(Boolean).join(' ')
      : t.details.operator ?? '';

    return (
      <Box sx={{ display: 'flex', gap: 1.5, py: 1.5, px: { xs: 2, sm: 2.5 }, opacity: past ? 0.4 : 1 }}>
        <Box sx={{
          width: 34, height: 34, borderRadius: 1.5, flexShrink: 0, mt: 0.25,
          backgroundColor: alpha(color, 0.1),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isArr ? <TIcon sx={{ fontSize: 17, color }} /> : <TIcon sx={{ fontSize: 17, color }} />}
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.88rem' }}>
              {label}
            </Typography>
            {time && (
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem', flexShrink: 0 }}>
                {fmtTime(time)}
              </Typography>
            )}
          </Box>
          {subline && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              {subline}
            </Typography>
          )}
          {t.confirmationNumber && (
            <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 700, color, display: 'block', mt: 0.25 }}>
              Ref: {t.confirmationNumber}
            </Typography>
          )}
          <Chip
            label={t.status.replace('_', ' ')} size="small"
            sx={{ mt: 0.5, height: 18, fontSize: '0.65rem', fontWeight: 700,
              backgroundColor: alpha(STATUS_COLOR[t.status] ?? '#6b7280', 0.1),
              color: STATUS_COLOR[t.status] ?? '#6b7280' }}
          />
        </Box>
      </Box>
    );
  }

  // accom
  const { accom: a, event } = item;
  const isCheckIn = event === 'checkin';
  const EventIcon2 = isCheckIn ? LoginIcon : LogoutIcon;

  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 1.5, px: { xs: 2, sm: 2.5 }, opacity: past ? 0.4 : 1 }}>
      <Box sx={{
        width: 34, height: 34, borderRadius: 1.5, flexShrink: 0, mt: 0.25,
        backgroundColor: alpha('#5c35a0', 0.1),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <EventIcon2 sx={{ fontSize: 17, color: '#5c35a0' }} />
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.88rem' }}>
            {isCheckIn ? `Check in — ${a.name}` : `Check out — ${a.name}`}
          </Typography>
        </Box>
        {a.address && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            {a.address}
          </Typography>
        )}
        {a.confirmationNumber && (
          <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#5c35a0', display: 'block', mt: 0.25 }}>
            Ref: {a.confirmationNumber}
          </Typography>
        )}
        {a.address && <MapButtons name={a.name} address={a.address} />}
      </Box>
    </Box>
  );
}

// ─── Todo row ─────────────────────────────────────────────────────────────────

function TodoRow({ todo, onComplete }: { todo: Todo; onComplete: (id: string) => void }) {
  const [completing, setCompleting] = useState(false);
  const isPacking = todo.type === 'packing_advisory';
  const color = isPacking ? '#b45309' : '#1D2642';
  const isOverdue = todo.dueAt && new Date(todo.dueAt) < new Date();

  const handle = async () => {
    setCompleting(true);
    await onComplete(todo._id);
    setCompleting(false);
  };

  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 1.5, px: { xs: 2, sm: 2.5 }, alignItems: 'flex-start' }}>
      <IconButton
        size="small"
        onClick={handle}
        disabled={completing}
        sx={{ p: 0.5, flexShrink: 0, mt: 0.25, color: 'text.disabled' }}
      >
        {completing
          ? <CircularProgress size={20} />
          : <CheckBoxOutlineBlankIcon sx={{ fontSize: 22 }} />
        }
      </IconButton>

      <Box sx={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: isOverdue ? '#dc2626' : color, flexShrink: 0 }} />

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          {isPacking && <BoltIcon sx={{ fontSize: 14, color: '#b45309' }} />}
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.88rem' }}>
            {todo.name}
          </Typography>
          {isOverdue && (
            <Chip label="Overdue" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, backgroundColor: alpha('#dc2626', 0.1), color: '#dc2626' }} />
          )}
        </Box>
        {todo.body && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', display: 'block', mt: 0.25 }}>
            {todo.body.length > 120 ? `${todo.body.slice(0, 120)}…` : todo.body}
          </Typography>
        )}
        {todo.dueAt && (
          <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 600, color: isOverdue ? '#dc2626' : 'text.disabled', display: 'block', mt: 0.25 }}>
            {isOverdue ? 'Was due' : 'Due'} {new Date(todo.dueAt).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OnTripScreen({ tripId, trip }: OnTripScreenProps) {
  const [itinerary,  setItinerary]  = useState<ItineraryDay[]>([]);
  const [logistics,  setLogistics]  = useState<{ transportation: Transport[]; accommodation: Accommodation[] } | null>(null);
  const [todos,      setTodos]      = useState<Todo[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now,        setNow]        = useState(new Date());

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

      // Filter to incomplete todos due today or overdue
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      setTodos(
        ((files.files ?? []) as any[])
          .filter(f =>
            f.resourceType === 'todo' &&
            !f.completed &&
            f.dueAt &&
            new Date(f.dueAt) <= todayEnd
          )
          .sort((a: any, b: any) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  const completeTodo = async (id: string) => {
    // Optimistic
    setTodos(prev => prev.filter(t => t._id !== id));
    try {
      await fetch(`/api/trips/${tripId}/files/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ completed: true }),
      });
    } catch {
      // Silently fail — they'll see it again on next load
      load(true);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const today   = todayIso();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const dayNum  = dayOfTrip(trip.startDate);
  const totalNights = trip.nights ?? tripNights(trip.startDate, trip.endDate);
  const totalDays   = totalNights + 1;

  const todayDay   = itinerary.find(d => d.date.split('T')[0] === today);
  const todayStops = todayDay?.stops ?? [];

  // RIGHT NOW — in-progress or next upcoming timed stop
  const timedStops = todayStops
    .map(s => ({ stop: s, startM: stopStartMinutes(s) }))
    .filter(x => x.startM !== null)
    .sort((a, b) => a.startM! - b.startM!);

  const inProgress = timedStops.find(x => {
    const endM = x.startM! + x.stop.duration;
    return nowMins >= x.startM! && nowMins < endM;
  });
  const nextUp = !inProgress ? timedStops.find(x => x.startM! > nowMins) : null;
  const rightNow = inProgress ?? nextUp ?? null;

  // TODAY TIMELINE — merge itinerary stops, transport events, accom events for today
  const timelineItems: TimelineItem[] = [];

  // Itinerary stops
  for (const stop of todayStops) {
    const startM = stopStartMinutes(stop) ?? -1;
    timelineItems.push({ kind: 'stop', sortMins: startM, stop });
  }

  // Transport departing or arriving today
  for (const t of logistics?.transportation ?? []) {
    if (t.departureTime) {
      const depDate = t.departureTime.split('T')[0];
      if (depDate === today) {
        timelineItems.push({ kind: 'transport', sortMins: isoToMins(t.departureTime), transport: t, event: 'departure' });
      }
    }
    if (t.arrivalTime) {
      const arrDate = t.arrivalTime.split('T')[0];
      if (arrDate === today) {
        timelineItems.push({ kind: 'transport', sortMins: isoToMins(t.arrivalTime), transport: t, event: 'arrival' });
      }
    }
  }

  // Accommodation check-in / check-out today
  for (const a of logistics?.accommodation ?? []) {
    if (a.checkIn?.split('T')[0] === today) {
      // Use mid-afternoon as a placeholder sort position for check-ins without explicit time
      const mins = a.checkIn.includes('T') ? isoToMins(a.checkIn) : 14 * 60;
      timelineItems.push({ kind: 'accom', sortMins: mins, accom: a, event: 'checkin' });
    }
    if (a.checkOut?.split('T')[0] === today) {
      const mins = a.checkOut.includes('T') ? isoToMins(a.checkOut) : 11 * 60;
      timelineItems.push({ kind: 'accom', sortMins: mins, accom: a, event: 'checkout' });
    }
  }

  // Sort and deduplicate (itinerary stops sourced from logistics already appear via transport events)
  const seenTransportKeys = new Set<string>();
  const dedupedTimeline = timelineItems
    .sort((a, b) => {
      const aM = a.sortMins < 0 ? 99999 : a.sortMins;
      const bM = b.sortMins < 0 ? 99999 : b.sortMins;
      return aM - bM;
    })
    .filter(item => {
      // Remove itinerary stops that are just logistics mirrors (source === 'logistics')
      if (item.kind === 'stop' && item.stop.source === 'logistics') return false;
      // Remove duplicate transport events (same type+route)
      if (item.kind === 'transport') {
        const key = `${item.transport.type}-${item.transport.departureLocation}-${item.transport.arrivalLocation}-${item.event}`;
        if (seenTransportKeys.has(key)) return false;
        seenTransportKeys.add(key);
      }
      return true;
    });

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={32} sx={{ color: '#55702C' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mb: 3 }}>

      {/* ── Header row ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" fontWeight={900} sx={{ fontSize: { xs: '1.05rem', sm: '1.15rem' }, lineHeight: 1.2 }}>
            Day {dayNum} of {totalDays}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            {new Date(today).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={() => load(true)} disabled={refreshing} size="small">
            {refreshing
              ? <CircularProgress size={18} />
              : <RefreshIcon fontSize="small" />
            }
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── 1. RIGHT NOW / UP NEXT ── */}
      {rightNow && (
        <Box>
          <SectionLabel>
            {inProgress ? '🔴 Right now' : '⏭ Up next'}
          </SectionLabel>
          <RightNowCard stop={rightNow.stop} startMins={rightNow.startM} nowMins={nowMins} />
        </Box>
      )}

      {/* ── 2. TODAY TIMELINE ── */}
      <Box>
        <SectionLabel>📅 Today</SectionLabel>
        {dedupedTimeline.length > 0 ? (
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            {dedupedTimeline.map((item, i) => {
              const past = item.sortMins >= 0 && item.sortMins < nowMins;
              return (
                <Box key={i}>
                  {i > 0 && <Divider />}
                  <TimelineRow item={item} past={past} />
                </Box>
              );
            })}
          </Paper>
        ) : (
          <Paper elevation={0} sx={{ p: 3, textAlign: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="body2" color="text.disabled" fontWeight={600}>
              Nothing scheduled for today
            </Typography>
          </Paper>
        )}
      </Box>

      {/* ── 3. ACTION NEEDED (todos due today / overdue) ── */}
      {todos.length > 0 && (
        <Box>
          <SectionLabel>
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AssignmentIcon sx={{ fontSize: 12 }} />
              {' Action needed'}
            </Box>
          </SectionLabel>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            {todos.map((todo, i) => (
              <Box key={todo._id}>
                {i > 0 && <Divider />}
                <TodoRow todo={todo} onComplete={completeTodo} />
              </Box>
            ))}
          </Paper>
        </Box>
      )}

    </Box>
  );
}