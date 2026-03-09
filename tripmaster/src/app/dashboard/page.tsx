'use client';

import { useSession, signOut } from 'next-auth/react';
import {
  Box, Typography, Button, Chip,
  Container, AppBar, Toolbar, IconButton, Avatar, Skeleton,
  ToggleButtonGroup, ToggleButton, Tabs, Tab, Paper, alpha, CircularProgress,
} from '@mui/material';
import AddIcon                from '@mui/icons-material/Add';
import FlightTakeoffIcon      from '@mui/icons-material/FlightTakeoff';
import LogoutIcon             from '@mui/icons-material/Logout';
import PersonIcon             from '@mui/icons-material/Person';
import BackpackIcon           from '@mui/icons-material/Backpack';
import ViewListIcon           from '@mui/icons-material/ViewList';
import CalendarMonthIcon      from '@mui/icons-material/CalendarMonth';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import NavigationIcon         from '@mui/icons-material/Navigation';
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
import { useRouter }          from 'next/navigation';
import { useEffect, useState } from 'react';
import TripCalendar from '@/components/calendar/TripCalendar';
import { saveTripList, getTripList, getQueue, clearQueue } from '@/lib/offline/db';
import TripReadinessPanel from '@/components/dashboard/TripReadinessPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trip {
  _id: string;
  name: string;
  destination: { city: string; country: string };
  startDate: string;
  endDate: string;
  nights: number;
  tripType: string;
  status: string;
  coverPhotoThumb?: string;
  coverPhotoUrl?: string;
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

interface RightNow {
  stop: Stop;
  startM: number | null;
  inProgress: boolean;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const D = {
  green:   '#6B7C5C',
  terra:   '#C4714A',
  navy:    '#2C3E50',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
} as const;

// ─── Config ───────────────────────────────────────────────────────────────────

const STOP_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  flight:      { label: 'Flight',        color: '#C9521B', Icon: FlightIcon },
  train:       { label: 'Train',         color: '#0369a1', Icon: TrainIcon },
  bus:         { label: 'Bus',           color: '#0369a1', Icon: DirectionsBusIcon },
  ferry:       { label: 'Ferry',         color: '#0369a1', Icon: DirectionsBoatIcon },
  car:         { label: 'Car',           color: '#55702C', Icon: DirectionsCarIcon },
  car_hire:    { label: 'Car hire',      color: '#55702C', Icon: DirectionsCarIcon },
  taxi:        { label: 'Taxi',          color: '#55702C', Icon: LocalTaxiIcon },
  private_transfer: { label: 'Transfer', color: '#55702C', Icon: AirportShuttleIcon },
  bicycle:     { label: 'Bicycle',       color: '#55702C', Icon: PedalBikeIcon },
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

const TRIP_TYPE_LABEL: Record<string, string> = {
  leisure: 'Leisure', work: 'Work', mixed: 'Mixed',
};

// Status dot colours for the custom chip
const STATUS_DOT: Record<string, string> = {
  confirmed: '#6B7C5C',
  active:    '#6B7C5C',
  planning:  '#C4714A',
  idea:      '#9ca3af',
  completed: '#9ca3af',
  cancelled: '#ef4444',
};

type TabValue = 'upcoming' | 'planning' | 'confirmed' | 'past' | 'cancelled';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterTrips(trips: Trip[], tab: TabValue): Trip[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  switch (tab) {
    case 'upcoming':
      return trips.filter(t =>
        t.status !== 'cancelled' && t.status !== 'completed' &&
        (t.status === 'active' || !t.endDate || new Date(t.endDate) >= now)
      );
    case 'planning':
      return trips.filter(t =>
        (t.status === 'idea' || t.status === 'planning') &&
        (!t.endDate || new Date(t.endDate) >= now)
      );
    case 'confirmed':
      return trips.filter(t => t.status === 'confirmed' || t.status === 'active');
    case 'past':
      return trips.filter(t =>
        t.status !== 'cancelled' &&
        (t.status === 'completed' || (!!t.endDate && new Date(t.endDate) < now))
      );
    case 'cancelled':
      return trips.filter(t => t.status === 'cancelled');
    default:
      return trips;
  }
}

function dayOfTrip(startDate: string): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
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

function deriveRightNow(days: ItineraryDay[]): RightNow | null {
  const today = new Date().toISOString().split('T')[0];
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const todayDay = days.find(d => d.date.split('T')[0] === today);
  if (!todayDay) return null;
  const timed = todayDay.stops
    .map(s => ({ stop: s, startM: stopStartMinutes(s) }))
    .filter(x => x.startM !== null)
    .sort((a, b) => a.startM! - b.startM!);
  const inProg = timed.find(x => {
    const endM = x.startM! + x.stop.duration;
    return nowMins >= x.startM! && nowMins < endM;
  });
  if (inProg) return { stop: inProg.stop, startM: inProg.startM, inProgress: true };
  const nextUp = timed.find(x => x.startM! > nowMins);
  if (nextUp) return { stop: nextUp.stop, startM: nextUp.startM, inProgress: false };
  const untimed = todayDay.stops.find(s => stopStartMinutes(s) === null);
  if (untimed) return { stop: untimed, startM: null, inProgress: false };
  return null;
}

// ─── MapButtons ───────────────────────────────────────────────────────────────

function MapButtons({ name, address, coordinates, stopPropagation }: {
  name: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  stopPropagation?: boolean;
}) {
  const links = mapsLinks(name, address, coordinates);
  return (
    <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
      {[
        { label: 'Apple Maps',  href: links.apple,  color: D.navy },
        { label: 'Google Maps', href: links.google, color: '#0369a1' },
        { label: 'Waze',        href: links.waze,   color: '#00838f' },
      ].map(({ label, href, color }) => (
        <Button
          key={label}
          component="a"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          onClick={stopPropagation ? (e: React.MouseEvent) => e.stopPropagation() : undefined}
          startIcon={<NavigationIcon sx={{ fontSize: '0.85rem !important' }} />}
          sx={{
            fontFamily: D.body,
            fontSize: '0.72rem', fontWeight: 700, py: 0.4, px: 1, minHeight: 28,
            backgroundColor: alpha(color, 0.09), color,
            border: `1px solid ${alpha(color, 0.2)}`, borderRadius: 1.5,
            '&:hover': { backgroundColor: alpha(color, 0.18) },
          }}
        >
          {label}
        </Button>
      ))}
    </Box>
  );
}

// ─── Active trip banner ───────────────────────────────────────────────────────

function ActiveTripBanner({
  trip, rightNow, rightNowLoading, onOpen,
}: {
  trip: Trip;
  rightNow: RightNow | null;
  rightNowLoading: boolean;
  onOpen: () => void;
}) {
  const dayNum    = dayOfTrip(trip.startDate);
  const totalDays = trip.nights + 1;
  const pct       = Math.round(((dayNum - 1) / Math.max(totalDays - 1, 1)) * 100);
  const isPast    = new Date(trip.endDate) < new Date(new Date().setHours(0, 0, 0, 0));
  const nowMins   = new Date().getHours() * 60 + new Date().getMinutes();
  const cfg       = rightNow ? (STOP_CONFIG[rightNow.stop.type] ?? STOP_CONFIG.other) : null;
  const StopIcon  = cfg?.Icon ?? null;
  const endM      = rightNow?.startM !== null && rightNow?.startM !== undefined
    ? rightNow.startM + rightNow.stop.duration : null;
  const remaining = rightNow?.inProgress && endM !== null ? endM - nowMins : null;

  return (
    <Paper elevation={0} onClick={onOpen} sx={{
      mb: 4, borderRadius: 2.5, overflow: 'hidden', cursor: 'pointer',
      border: `2px solid ${D.green}`,
      transition: 'box-shadow 0.2s, transform 0.2s',
      '&:hover': { boxShadow: `0 12px 40px ${alpha(D.navy, 0.14)}`, transform: 'translateY(-2px)' },
      '&:active': { transform: 'scale(0.998)' },
    }}>
      {/* Cover photo */}
      <Box sx={{
        height: { xs: 170, sm: 220 },
        background: trip.coverPhotoUrl
          ? `linear-gradient(to bottom, ${alpha('#000', 0.05)}, ${alpha('#000', 0.7)}), url(${trip.coverPhotoUrl}) center/cover no-repeat`
          : `linear-gradient(135deg, ${D.navy} 0%, ${D.green} 100%)`,
        display: 'flex', alignItems: 'flex-end',
        p: { xs: 2.5, sm: 3 }, position: 'relative',
      }}>
        {/* Status label */}
        <Box sx={{ position: 'absolute', top: 16, right: 16,
          backgroundColor: D.green, borderRadius: 10, px: 1.5, py: 0.5 }}>
          <Typography sx={{ fontFamily: D.body, color: 'white', fontSize: '0.65rem',
            fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            {isPast ? 'Recently on trip' : new Date(trip.startDate) <= new Date() ? 'On trip' : 'Departing soon'}
          </Typography>
        </Box>

        {/* Day counter (top-left on active trips) */}
        {new Date(trip.startDate) <= new Date() && !isPast && (
          <Box sx={{ position: 'absolute', top: 14, left: 20 }}>
            <Typography sx={{
              fontFamily: D.display, color: 'white', lineHeight: 1,
              fontSize: { xs: '2.8rem', sm: '3.8rem' }, letterSpacing: '-0.04em',
            }}>
              {dayNum}
            </Typography>
            <Typography sx={{ fontFamily: D.body, color: alpha('#fff', 0.65),
              fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>
              of {totalDays} days
            </Typography>
          </Box>
        )}

        {/* Trip name + destination */}
        <Box sx={{ flexGrow: 1 }}>
          <Typography sx={{
            fontFamily: D.display, color: 'white', lineHeight: 1.05,
            fontSize: { xs: '1.7rem', sm: '2.4rem' }, letterSpacing: '-0.03em', mb: 0.5,
          }}>
            {trip.name}
          </Typography>
          <Typography sx={{ fontFamily: D.body, color: alpha('#fff', 0.72), fontWeight: 600,
            fontSize: '0.72rem', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            {trip.destination.city}, {trip.destination.country}
          </Typography>
        </Box>
        <KeyboardArrowRightIcon sx={{ color: 'white', fontSize: 28, flexShrink: 0, ml: 1 }} />
      </Box>

      {/* Progress bar */}
      <Box sx={{ height: 3, backgroundColor: alpha(D.green, 0.12) }}>
        <Box sx={{ height: '100%', width: `${pct}%`, backgroundColor: D.green, transition: 'width 0.4s ease' }} />
      </Box>

      {/* Next action panel */}
      <Box sx={{ px: { xs: 2.5, sm: 3 }, pt: 2.25, pb: 2.75 }}>
        <Typography sx={{ fontFamily: D.body, fontSize: '0.62rem', fontWeight: 800,
          letterSpacing: '0.22em', color: 'text.disabled', textTransform: 'uppercase',
          display: 'block', mb: 1.5 }}>
          {isPast ? 'Trip complete' : rightNow?.inProgress ? 'Right now' : 'Up next'}
        </Typography>

        {isPast && (
          <Typography sx={{ fontFamily: D.body, fontWeight: 600, color: 'text.secondary', fontSize: '0.88rem' }}>
            Anything to log or wrap up? Check your notes, expenses, or packing list.
          </Typography>
        )}
        {!isPast && rightNowLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
            <CircularProgress size={16} sx={{ color: D.green }} />
            <Typography sx={{ fontFamily: D.body, fontSize: '0.85rem', fontWeight: 600, color: 'text.secondary' }}>
              Loading schedule…
            </Typography>
          </Box>
        )}
        {!isPast && !rightNowLoading && !rightNow && (
          <Typography sx={{ fontFamily: D.body, fontWeight: 600, color: 'text.disabled', py: 0.5, fontSize: '0.88rem' }}>
            Nothing else scheduled today
          </Typography>
        )}
        {!isPast && !rightNowLoading && rightNow && cfg && StopIcon && (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2, flexShrink: 0,
              backgroundColor: alpha(cfg.color, 0.12),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <StopIcon sx={{ fontSize: 20, color: cfg.color }} />
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontFamily: D.display, fontSize: '1.05rem', lineHeight: 1.3, letterSpacing: '-0.02em' }}>
                  {rightNow.stop.name}
                </Typography>
                {rightNow.inProgress
                  ? <Chip label="In progress" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, fontFamily: D.body, backgroundColor: alpha(cfg.color, 0.12), color: cfg.color }} />
                  : rightNow.startM !== null
                    ? <Chip label={`at ${fmtMins(rightNow.startM)}`} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, fontFamily: D.body, backgroundColor: alpha(cfg.color, 0.1), color: cfg.color }} />
                    : null}
              </Box>
              {remaining !== null && (
                <Typography sx={{ fontFamily: D.body, color: cfg.color, fontWeight: 700, fontSize: '0.82rem', mt: 0.25 }}>
                  {remaining < 60 ? `${remaining} min${remaining !== 1 ? 's' : ''} remaining` : `${Math.floor(remaining / 60)}h ${remaining % 60}m remaining`}
                </Typography>
              )}
              {!rightNow.inProgress && rightNow.startM !== null && endM !== null && (
                <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: 'text.secondary', mt: 0.25 }}>
                  Until {fmtMins(endM)}
                </Typography>
              )}
              {rightNow.stop.address && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <LocationOnIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.76rem', color: 'text.secondary' }}>
                    {rightNow.stop.address}
                  </Typography>
                </Box>
              )}
              {(rightNow.stop.address || rightNow.stop.coordinates) && !isPast && (
                <MapButtons name={rightNow.stop.name} address={rightNow.stop.address}
                  coordinates={rightNow.stop.coordinates} stopPropagation />
              )}
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: rightNow ? 2 : 0.5 }}>
          <Typography sx={{ fontFamily: D.body, color: D.green, fontWeight: 800, fontSize: '0.72rem',
            display: 'flex', alignItems: 'center', gap: 0.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Open trip <KeyboardArrowRightIcon sx={{ fontSize: 15 }} />
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [trips,           setTrips]           = useState<Trip[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [view,            setView]            = useState<'list' | 'calendar'>('list');
  const [tab,             setTab]             = useState<TabValue>('upcoming');
  const [rightNow,        setRightNow]        = useState<RightNow | null>(null);
  const [rightNowLoading, setRightNowLoading] = useState(false);

  useEffect(() => {
    async function loadTrips() {
      try {
        const res  = await fetch('/api/trips');
        const data = await res.json();
        await saveTripList(data.trips ?? []);
        setTrips(data.trips ?? []);
      } catch {
        const offlineTrips = await getTripList();
        setTrips(offlineTrips ?? []);
      } finally {
        setLoading(false);
      }
    }
    loadTrips();
  }, []);

  useEffect(() => {
    const activeTrip = trips.find(t => t.status === 'active') ?? null;
    if (!activeTrip) return;
    async function loadRightNow() {
      setRightNowLoading(true);
      try {
        const res  = await fetch(`/api/trips/${activeTrip!._id}/itinerary`);
        const data = await res.json();
        setRightNow(deriveRightNow(data.days ?? []));
      } catch {
        setRightNow(null);
      } finally {
        setRightNowLoading(false);
      }
    }
    loadRightNow();
  }, [trips]);

  useEffect(() => {
    async function syncQueue() {
      if (!navigator.onLine) return;
      const queued = await getQueue();
      for (const item of queued) {
        if (item.type === 'CREATE_TRIP') {
          await fetch('/api/trips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.body),
          });
        }
      }
      if (queued.length > 0) await clearQueue();
    }
    window.addEventListener('online', syncQueue);
    syncQueue();
    return () => window.removeEventListener('online', syncQueue);
  }, []);

  const activeTrip   = trips.find(t => t.status === 'active') ?? null;
  const visibleTrips = filterTrips(trips, tab);

  const groupedTrips = visibleTrips.reduce<Record<string, Trip[]>>((acc, trip) => {
    const key = trip.startDate
      ? new Date(trip.startDate).toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })
      : 'Undated';
    if (!acc[key]) acc[key] = [];
    acc[key].push(trip);
    return acc;
  }, {});

  const counts = {
    upcoming:  filterTrips(trips, 'upcoming').length,
    planning:  filterTrips(trips, 'planning').length,
    confirmed: filterTrips(trips, 'confirmed').length,
    past:      filterTrips(trips, 'past').length,
    cancelled: filterTrips(trips, 'cancelled').length,
  };

  const firstName = session?.user?.name?.split(' ')[0] ?? '';

  return (
    <>
      {/* ── Font injection ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@300;400;500;600;700&display=swap');
      `}</style>

      <Box sx={{ minHeight: '100vh', backgroundColor: D.bg, pb: 12 }}>

        {/* ── AppBar ── */}
        <AppBar position="static" elevation={0} sx={{
          backgroundColor: D.navy,
          borderBottom: `3px solid ${D.terra}`,
        }}>
          <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
            <Box component="img" src="/Logo.jpeg" alt="Logo"
              sx={{ mr: 1, width: { xs: 64, sm: 144 }, height: { xs: 64, sm: 144 }, objectFit: 'contain' }} />
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ mr: 1.5, opacity: 0.65, display: { xs: 'none', sm: 'block' },
                fontFamily: D.body, fontSize: '0.85rem', fontWeight: 500, color: 'white' }}>
                {session?.user?.name}
              </Typography>
              <IconButton size="small" onClick={() => router.push('/profile')} sx={{ p: 0.5 }}>
                <Avatar src={session?.user?.image ?? undefined}
                  sx={{ width: 32, height: 32, fontSize: '0.8rem', backgroundColor: D.green }}>
                  {firstName[0]}
                </Avatar>
              </IconButton>
              <IconButton color="inherit" size="small" onClick={() => signOut({ callbackUrl: '/signin' })}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>

          {/* ── Hero ── */}
          <Box sx={{ pt: { xs: 4, sm: 6 }, pb: { xs: 3, sm: 4 } }}>
            <Typography sx={{
              fontFamily: D.display,
              fontSize: { xs: '3rem', sm: '5rem', md: '6.5rem' },
              lineHeight: 0.9,
              letterSpacing: '-0.04em',
              color: D.navy,
            }}>
              {activeTrip
                ? new Date(activeTrip.endDate) < new Date(new Date().setHours(0, 0, 0, 0))
                  ? `You've been in ${activeTrip.destination.city}`
                  : new Date(activeTrip.startDate) <= new Date()
                    ? `You're in ${activeTrip.destination.city}`
                    : `Leaving for ${activeTrip.destination.city} tomorrow`
                : 'My Trips'}
            </Typography>
            {/* Terracotta accent rule */}
            <Box sx={{ width: { xs: 44, sm: 60 }, height: 4, backgroundColor: D.terra, mt: 2.5, mb: 2, borderRadius: 1 }} />
            <Typography sx={{ fontFamily: D.body, fontSize: '0.8rem', color: 'text.secondary',
              letterSpacing: '0.08em', fontWeight: 500 }}>
              {loading ? '…' : `${counts.upcoming} upcoming · ${trips.length} total`}
            </Typography>
          </Box>

          {/* ── Active trip banner ── */}
          {!loading && activeTrip && (
            <ActiveTripBanner
              trip={activeTrip}
              rightNow={rightNow}
              rightNowLoading={rightNowLoading}
              onOpen={() => router.push(`/trips/${activeTrip._id}`)}
            />
          )}

          {!loading && <TripReadinessPanel trips={trips} />}

          {/* ── Action buttons ── */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 4, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Button variant="contained" startIcon={<AddIcon />} size="large"
              onClick={() => router.push('/trips/new')}
              sx={{
                fontFamily: D.display,
                fontSize: { xs: '1rem', sm: '0.95rem' },
                letterSpacing: '-0.01em',
                py: { xs: 1.75, sm: 1.5 },
                px: 3,
                backgroundColor: D.navy,
                color: 'white',
                borderRadius: 1.5,
                boxShadow: 'none',
                flexBasis: { sm: '44%' },
                flexShrink: 0,
                '&:hover': { backgroundColor: alpha(D.navy, 0.88), boxShadow: `0 6px 24px ${alpha(D.navy, 0.28)}` },
              }}>
              Plan a Trip
            </Button>
            <Button variant="outlined" startIcon={<BackpackIcon />}
              onClick={() => router.push('/packing/catalogue')}
              sx={{
                fontFamily: D.body, fontWeight: 600, py: { xs: 1.5, sm: 1.25 }, px: 2.5,
                borderColor: alpha(D.navy, 0.18), color: D.navy, borderRadius: 1.5, flex: 1,
                '&:hover': { borderColor: alpha(D.navy, 0.45), backgroundColor: alpha(D.navy, 0.04) },
              }}>
              Packing Catalogue
            </Button>
            <Button variant="outlined" startIcon={<PersonIcon />}
              onClick={() => router.push('/profile')}
              sx={{
                fontFamily: D.body, fontWeight: 600, py: { xs: 1.5, sm: 1.25 }, px: 2.5,
                borderColor: alpha(D.navy, 0.18), color: D.navy, borderRadius: 1.5, flex: 1,
                '&:hover': { borderColor: alpha(D.navy, 0.45), backgroundColor: alpha(D.navy, 0.04) },
              }}>
              Profile
            </Button>
          </Box>

          {/* ── Tabs ── */}
          {!loading && (
            <Box sx={{
              borderBottom: `2px solid ${alpha(D.navy, 0.1)}`,
              mb: 4,
              '& .MuiTabs-indicator': { backgroundColor: D.terra, height: 3 },
              '& .MuiTabs-root': { minHeight: 44 },
              '& .MuiTab-root': {
                fontFamily: D.body,
                minHeight: 44,
                fontSize: { xs: '0.75rem', sm: '0.82rem' },
                fontWeight: 700,
                textTransform: 'none',
                letterSpacing: '0.01em',
                color: alpha(D.navy, 0.45),
                px: { xs: 1.5, sm: 2.5 },
                '&.Mui-selected': { color: D.navy },
              },
            }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable"
                scrollButtons="auto" allowScrollButtonsMobile>
                <Tab value="upcoming" label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    Upcoming
                    {counts.upcoming > 0 && (
                      <Box sx={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: D.terra,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5 }}>
                        <Typography sx={{ fontFamily: D.body, color: 'white', fontSize: '0.62rem', fontWeight: 800 }}>
                          {counts.upcoming}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                } />
                <Tab value="planning" label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    Planning
                    {counts.planning > 0 && (
                      <Box sx={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: alpha(D.terra, 0.18),
                        display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5 }}>
                        <Typography sx={{ fontFamily: D.body, color: D.terra, fontSize: '0.62rem', fontWeight: 800 }}>
                          {counts.planning}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                } />
                <Tab value="confirmed" label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    Confirmed
                    {counts.confirmed > 0 && (
                      <Box sx={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: alpha(D.green, 0.18),
                        display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5 }}>
                        <Typography sx={{ fontFamily: D.body, color: D.green, fontSize: '0.62rem', fontWeight: 800 }}>
                          {counts.confirmed}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                } />
                <Tab value="past" label="Past" />
                <Tab value="cancelled" label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    Cancelled
                    {counts.cancelled > 0 && (
                      <Box sx={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: alpha('#ef4444', 0.12),
                        display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5 }}>
                        <Typography sx={{ fontFamily: D.body, color: '#ef4444', fontSize: '0.62rem', fontWeight: 800 }}>
                          {counts.cancelled}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                } />
              </Tabs>
            </Box>
          )}

          {/* ── View toggle ── */}
          {!loading && visibleTrips.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
              <ToggleButtonGroup value={view} exclusive onChange={(_, v) => v && setView(v)} size="small"
                sx={{
                  border: `1.5px solid ${alpha(D.navy, 0.14)}`,
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  '& .MuiToggleButton-root': {
                    border: 'none',
                    px: 2, py: 0.75,
                    fontFamily: D.body,
                    fontSize: '0.72rem', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    gap: 0.75,
                    color: alpha(D.navy, 0.45),
                    '&.Mui-selected': { backgroundColor: D.navy, color: 'white' },
                    '&.Mui-selected:hover': { backgroundColor: alpha(D.navy, 0.9) },
                  },
                }}>
                <ToggleButton value="list"><ViewListIcon sx={{ fontSize: '1rem' }} /> Cards</ToggleButton>
                <ToggleButton value="calendar"><CalendarMonthIcon sx={{ fontSize: '1rem' }} /> Calendar</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}

          {/* ── Skeleton ── */}
          {loading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[1, 2].map(i => <Skeleton key={i} variant="rounded" height={200} sx={{ borderRadius: 2 }} />)}
            </Box>
          )}

          {/* ── Empty states ── */}
          {!loading && visibleTrips.length === 0 && tab === 'upcoming' && (
            <Box sx={{ py: { xs: 8, sm: 12 }, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <Typography sx={{
                fontFamily: D.display,
                fontSize: { xs: '3.5rem', sm: '5rem' },
                letterSpacing: '-0.04em', lineHeight: 0.9,
                color: alpha(D.navy, 0.1),
                textAlign: 'center',
              }}>
                No Trips Yet
              </Typography>
              <Typography variant="body2" color="text.secondary" maxWidth={320} sx={{ fontFamily: D.body, textAlign: 'center' }}>
                Plan your next adventure — flights, hotels, day-by-day itinerary, and a smart packing list.
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} size="large"
                onClick={() => router.push('/trips/new')}
                sx={{ fontFamily: D.display, letterSpacing: '-0.01em', backgroundColor: D.navy,
                  borderRadius: 1.5, px: 3, boxShadow: 'none',
                  '&:hover': { backgroundColor: alpha(D.navy, 0.88), boxShadow: 'none' } }}>
                Plan a trip
              </Button>
            </Box>
          )}

          {!loading && visibleTrips.length === 0 && tab !== 'upcoming' && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography sx={{ fontFamily: D.body, color: 'text.secondary' }}>No {tab} trips</Typography>
            </Box>
          )}

          {/* ── Calendar view ── */}
          {!loading && visibleTrips.length > 0 && view === 'calendar' && <TripCalendar />}

          {/* ── Card list view ── */}
          {!loading && visibleTrips.length > 0 && view === 'list' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(groupedTrips).map(([month, monthTrips]) => (
                <Box key={month}>

                  {/* ── Editorial month header ── */}
                  <Box sx={{ mb: { xs: 2.5, sm: 3 }, position: 'relative' }}>
                    {/* Ghost display text — the "art" layer */}
                    <Typography sx={{
                      fontFamily: D.display,
                      fontSize: { xs: '3.5rem', sm: '6rem', md: '7.5rem' },
                      letterSpacing: '-0.04em',
                      lineHeight: 0.85,
                      color: alpha(D.navy, 0.07),
                      userSelect: 'none',
                      pointerEvents: 'none',
                      mb: { xs: -2, sm: -3 },
                    }}>
                      {month.toUpperCase()}
                    </Typography>
                    {/* Labelled rule — the readable layer */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography sx={{
                        fontFamily: D.body,
                        fontSize: '0.68rem', fontWeight: 800,
                        letterSpacing: '0.28em', textTransform: 'uppercase',
                        color: alpha(D.navy, 0.4),
                        whiteSpace: 'nowrap', pr: 1.5,
                      }}>
                        {month}
                      </Typography>
                      <Box sx={{ flex: 1, height: '1px', backgroundColor: alpha(D.navy, 0.1) }} />
                    </Box>
                  </Box>

                  {/* ── Trip cards ── */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {monthTrips.map(trip => {
                      const daysUntil = trip.startDate
                        ? Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / 86400000)
                        : null;

                      return (
                        <Box
                          key={trip._id}
                          onClick={() => router.push(`/trips/${trip._id}`)}
                          sx={{
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            backgroundColor: D.paper,
                            borderRadius: 2,
                            overflow: 'hidden',
                            border: `1.5px solid ${alpha(D.navy, 0.08)}`,
                            ...(trip.status === 'active' && { border: `2px solid ${D.green}` }),
                            transition: 'transform 0.15s, box-shadow 0.15s',
                            '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 10px 32px ${alpha(D.navy, 0.1)}` },
                            '&:active': { transform: 'scale(0.998)' },
                            opacity: trip.status === 'cancelled' ? 0.55 : 1,
                          }}
                        >
                          {/* Photo panel */}
                          <Box sx={{
                            width: { xs: '100%', sm: '36%' },
                            height: { xs: 190, sm: 'auto' },
                            minHeight: { sm: 190 },
                            flexShrink: 0,
                            backgroundImage: trip.coverPhotoThumb ? `url(${trip.coverPhotoThumb})` : undefined,
                            backgroundSize: 'cover', backgroundPosition: 'center',
                            backgroundColor: trip.coverPhotoThumb ? undefined : alpha(D.navy, 0.06),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative',
                          }}>
                            {!trip.coverPhotoThumb && (
                              <FlightTakeoffIcon sx={{ fontSize: 36, color: alpha(D.navy, 0.18) }} />
                            )}
                            {/* Status pill */}
                            <Box sx={{
                              position: 'absolute', top: 12, right: 12,
                              display: 'flex', alignItems: 'center', gap: 0.6,
                              backgroundColor: alpha(D.navy, 0.62),
                              backdropFilter: 'blur(6px)',
                              borderRadius: 10, px: 1.25, py: 0.45,
                            }}>
                              <Box sx={{
                                width: 6, height: 6, borderRadius: '50%',
                                backgroundColor: STATUS_DOT[trip.status] ?? alpha('#fff', 0.5),
                              }} />
                              <Typography sx={{ fontFamily: D.body, color: 'white', fontSize: '0.63rem',
                                fontWeight: 800, textTransform: 'capitalize', letterSpacing: '0.05em' }}>
                                {trip.status}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Content panel */}
                          <Box sx={{
                            flex: 1,
                            p: { xs: 2.5, sm: 3 },
                            display: 'flex', flexDirection: 'column',
                            justifyContent: 'space-between',
                            minHeight: { sm: 190 },
                          }}>
                            {/* Top: name + city */}
                            <Box>
                              <Typography sx={{
                                fontFamily: D.display,
                                fontSize: { xs: '1.8rem', sm: '2.1rem', md: '2.4rem' },
                                letterSpacing: '-0.03em', lineHeight: 1.0,
                                color: D.navy, mb: 0.75,
                              }}>
                                {trip.name}
                              </Typography>
                              <Typography sx={{
                                fontFamily: D.body, fontSize: '0.68rem', fontWeight: 700,
                                letterSpacing: '0.2em', textTransform: 'uppercase', color: D.terra,
                              }}>
                                {trip.destination?.city}, {trip.destination?.country}
                              </Typography>
                            </Box>

                            {/* Bottom: days counter + date/meta */}
                            <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mt: 2.5 }}>

                              {/* Days counter — the typographic art element */}
                              <Box sx={{ lineHeight: 1 }}>
                                {daysUntil !== null && daysUntil > 1 && trip.status !== 'cancelled' ? (
                                  <>
                                    <Typography sx={{
                                      fontFamily: D.display,
                                      fontSize: { xs: '3.5rem', sm: '4.5rem' },
                                      lineHeight: 1, letterSpacing: '-0.05em',
                                      color: D.terra,
                                    }}>
                                      {daysUntil}
                                    </Typography>
                                    <Typography sx={{ fontFamily: D.body, fontSize: '0.58rem', fontWeight: 800,
                                      letterSpacing: '0.2em', textTransform: 'uppercase', color: alpha(D.terra, 0.55) }}>
                                      days away
                                    </Typography>
                                  </>
                                ) : daysUntil === 1 ? (
                                  <Typography sx={{ fontFamily: D.display, color: D.terra,
                                    fontSize: { xs: '2rem', sm: '2.5rem' }, letterSpacing: '-0.03em', lineHeight: 1 }}>
                                    Tomorrow
                                  </Typography>
                                ) : daysUntil === 0 ? (
                                  <Box sx={{ backgroundColor: D.green, borderRadius: 1.5, px: 1.5, py: 0.6, display: 'inline-flex' }}>
                                    <Typography sx={{ fontFamily: D.display, color: 'white',
                                      fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
                                      Today
                                    </Typography>
                                  </Box>
                                ) : (
                                  <Box />
                                )}
                              </Box>

                              {/* Date + meta + view link */}
                              <Box sx={{ textAlign: 'right' }}>
                                <Typography sx={{ fontFamily: D.body, fontWeight: 700,
                                  fontSize: { xs: '0.88rem', sm: '0.95rem' }, color: D.navy, letterSpacing: '-0.01em' }}>
                                  {trip.startDate
                                    ? new Date(trip.startDate).toLocaleDateString('en-IE', {
                                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                                      })
                                    : '—'}
                                </Typography>
                                <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: 'text.secondary', mt: 0.3 }}>
                                  {trip.nights} nights · {TRIP_TYPE_LABEL[trip.tripType] ?? trip.tripType}
                                </Typography>
                                <Typography sx={{ fontFamily: D.body, fontSize: '0.7rem', color: D.green,
                                  fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', mt: 1 }}>
                                  View →
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
          )}

        </Container>
      </Box>
    </>
  );
}