'use client';

import { useSession, signOut } from 'next-auth/react';
import {
  Box, Typography, Button, Card, CardContent, Chip,
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

const STATUS_COLOURS: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'success'> = {
  idea: 'default', planning: 'warning', confirmed: 'primary',
  active: 'success', completed: 'default', cancelled: 'error',
};

const TRIP_TYPE_LABEL: Record<string, string> = {
  leisure: 'Leisure', work: 'Work', mixed: 'Mixed',
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

  // Fall back to first untimed stop of the day
  const untimed = todayDay.stops.find(s => stopStartMinutes(s) === null);
  if (untimed) return { stop: untimed, startM: null, inProgress: false };

  return null;
}

// ─── Map buttons ──────────────────────────────────────────────────────────────

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
        { label: 'Apple Maps',  href: links.apple,  color: '#1D2642' },
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
            fontSize: '0.72rem', fontWeight: 700, py: 0.4, px: 1, minHeight: 28,
            backgroundColor: alpha(color, 0.09), color,
            border: `1px solid ${alpha(color, 0.2)}`,
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
  trip,
  rightNow,
  rightNowLoading,
  onOpen,
}: {
  trip: Trip;
  rightNow: RightNow | null;
  rightNowLoading: boolean;
  onOpen: () => void;
}) {
  const dayNum    = dayOfTrip(trip.startDate);
  const totalDays = trip.nights + 1;
  const pct       = Math.round(((dayNum - 1) / Math.max(totalDays - 1, 1)) * 100);
  const isPast    = new Date(trip.endDate) < new Date(new Date().setHours(0,0,0,0));

  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const cfg     = rightNow ? (STOP_CONFIG[rightNow.stop.type] ?? STOP_CONFIG.other) : null;
  const StopIcon = cfg?.Icon ?? null;
  const endM     = rightNow?.startM !== null && rightNow?.startM !== undefined
    ? rightNow.startM + rightNow.stop.duration
    : null;
  const remaining = rightNow?.inProgress && endM !== null ? endM - nowMins : null;

  return (
    <Paper
      elevation={0}
      onClick={onOpen}
      sx={{
        mb: 3, borderRadius: 3, overflow: 'hidden', cursor: 'pointer',
        border: '2px solid #55702C',
        transition: 'box-shadow 0.15s, transform 0.15s',
        '&:hover': { boxShadow: 6, transform: 'translateY(-1px)' },
        '&:active': { transform: 'scale(0.995)' },
      }}
    >
      {/* Cover photo / gradient header */}
      <Box sx={{
        height: { xs: 110, sm: 140 },
        background: trip.coverPhotoUrl
          ? `linear-gradient(to bottom, ${alpha('#000', 0.1)}, ${alpha('#000', 0.65)}), url(${trip.coverPhotoUrl}) center/cover no-repeat`
          : `linear-gradient(135deg, #1D2642 0%, #55702C 100%)`,
        display: 'flex', alignItems: 'flex-end',
        p: { xs: 2, sm: 2.5 },
      }}>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Chip
              label={isPast ? '✈ Recently on trip' : new Date(trip.startDate) <= new Date() ? '✈ On trip' : '✈ Departing soon'}
              size="small"
              sx={{ height: 22, fontSize: '0.72rem', fontWeight: 800,
                backgroundColor: '#55702C', color: 'white' }}
            />
            {new Date(trip.startDate) <= new Date() && !isPast && (
              <Chip
                label={`Day ${dayNum} of ${totalDays}`}
                size="small"
                sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700,
                  backgroundColor: alpha('#fff', 0.2), color: 'white',
                  border: `1px solid ${alpha('#fff', 0.3)}` }}
              />
            )}
          </Box>
          <Typography variant="h6" fontWeight={900}
            sx={{ color: 'white', fontSize: { xs: '1.1rem', sm: '1.3rem' }, lineHeight: 1.2 }}>
            {trip.name}
          </Typography>
          <Typography variant="body2" sx={{ color: alpha('#fff', 0.8), fontWeight: 600 }}>
            {trip.destination.city}, {trip.destination.country}
          </Typography>
        </Box>
        <KeyboardArrowRightIcon sx={{ color: 'white', fontSize: 28, flexShrink: 0 }} />
      </Box>

      {/* Progress bar */}
      <Box sx={{ height: 4, backgroundColor: alpha('#55702C', 0.15) }}>
        <Box sx={{ height: '100%', width: `${pct}%`, backgroundColor: '#55702C', transition: 'width 0.3s ease' }} />
      </Box>

      {/* Next action card */}
      <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 1.75, pb: 2 }}>

        {/* Label row */}
        <Typography variant="overline" sx={{
          fontSize: '0.68rem', fontWeight: 800, letterSpacing: 1.2,
          color: 'text.disabled', display: 'block', mb: 1,
        }}>
          {isPast ? '✅ Trip complete' : rightNow?.inProgress ? '🔴 Right now' : '⏭ Up next'}
        </Typography>

        {/* Past trip wrap-up */}
        {isPast && (
          <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ fontSize: '0.88rem' }}>
            Anything to log or wrap up? Check your notes, expenses, or packing list.
          </Typography>
        )}

        {/* Loading state */}
        {!isPast && rightNowLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
            <CircularProgress size={18} sx={{ color: '#55702C' }} />
            <Typography variant="body2" color="text.secondary" fontWeight={600}>Loading schedule…</Typography>
          </Box>
        )}

        {/* No stop found */}
        {!isPast && !rightNowLoading && !rightNow && (
          <Typography variant="body2" color="text.disabled" fontWeight={600} sx={{ py: 0.5 }}>
            Nothing else scheduled today
          </Typography>
        )}

        {/* Stop card */}
        {!isPast && !rightNowLoading && rightNow && cfg && StopIcon && (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            {/* Icon pill */}
            <Box sx={{
              width: 40, height: 40, borderRadius: 2, flexShrink: 0,
              backgroundColor: alpha(cfg.color, 0.12),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <StopIcon sx={{ fontSize: 20, color: cfg.color }} />
            </Box>

            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              {/* Stop name + time chip */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body1" fontWeight={800} sx={{ fontSize: '0.95rem', lineHeight: 1.3 }}>
                  {rightNow.stop.name}
                </Typography>
                {rightNow.inProgress
                  ? <Chip label="In progress" size="small" sx={{ height: 20, fontSize: '0.67rem', fontWeight: 700, backgroundColor: alpha(cfg.color, 0.12), color: cfg.color }} />
                  : rightNow.startM !== null
                    ? <Chip label={`at ${fmtMins(rightNow.startM)}`} size="small" sx={{ height: 20, fontSize: '0.67rem', fontWeight: 700, backgroundColor: alpha(cfg.color, 0.1), color: cfg.color }} />
                    : null
                }
              </Box>

              {/* Remaining / until time */}
              {remaining !== null && (
                <Typography variant="body2" sx={{ color: cfg.color, fontWeight: 700, fontSize: '0.82rem', mt: 0.2 }}>
                  {remaining < 60
                    ? `${remaining} min${remaining !== 1 ? 's' : ''} remaining`
                    : `${Math.floor(remaining / 60)}h ${remaining % 60}m remaining`}
                </Typography>
              )}
              {!rightNow.inProgress && rightNow.startM !== null && endM !== null && (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', mt: 0.2 }}>
                  Until {fmtMins(endM)}
                </Typography>
              )}

              {/* Address */}
              {rightNow.stop.address && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <LocationOnIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.76rem' }}>
                    {rightNow.stop.address}
                  </Typography>
                </Box>
              )}

              {/* Navigation buttons — stop propagation so tapping a map button doesn't open the trip */}
              {(rightNow.stop.address || rightNow.stop.coordinates) && !isPast && (
                <MapButtons
                  name={rightNow.stop.name}
                  address={rightNow.stop.address}
                  coordinates={rightNow.stop.coordinates}
                  stopPropagation
                />
              )}
            </Box>
          </Box>
        )}

        {/* Open trip link */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: rightNow ? 1.5 : 0 }}>
          <Typography variant="caption" sx={{ color: '#55702C', fontWeight: 800, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
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

  // Load trip list
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

  // Once we have trips, load today's itinerary for the active trip
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

  // Offline sync queue
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
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', pb: 10 }}>

      {/* ── AppBar ── */}
      <AppBar position="static" sx={{ backgroundColor: 'text.primary' }} elevation={0}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          <Box component="img" src="/Logo.jpeg" alt="Logo"
            sx={{ mr: 1, width: { xs: 64, sm: 144 }, height: { xs: 64, sm: 144 }, objectFit: 'contain' }} />
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ mr: 1.5, opacity: 0.8, display: { xs: 'none', sm: 'block' } }}>
              {session?.user?.name}
            </Typography>
            <IconButton color="inherit" size="small" onClick={() => router.push('/profile')} sx={{ mr: 0.5 }}>
              <Avatar src={session?.user?.image ?? undefined}
                sx={{ width: 30, height: 30, fontSize: '0.8rem', backgroundColor: 'primary.main' }}>
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

        {/* ── Hero header ── */}
        <Box sx={{ pt: { xs: 3, sm: 4 }, pb: { xs: 2, sm: 3 } }}>
          <Typography variant="h4" fontWeight={800} color="text.primary"
            sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
            {activeTrip
              ? new Date(activeTrip.endDate) < new Date(new Date().setHours(0,0,0,0))
                ? `You've recently been in ${activeTrip.destination.city}`
                : new Date(activeTrip.startDate) <= new Date()
                  ? `You're in ${activeTrip.destination.city}`
                  : `Leaving for ${activeTrip.destination.city} tomorrow`
              : 'My Trips'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
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
        
        {!loading && <TripReadinessPanel trips={trips} />}   {/* ← ADD */}


        {/* ── Action buttons ── */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Button variant="contained" startIcon={<AddIcon />} size="large"
            onClick={() => router.push('/trips/new')}
            fullWidth sx={{ fontWeight: 700, py: { xs: 1.5, sm: 1 } }}>
            Plan a Trip
          </Button>
          <Button variant="outlined" startIcon={<BackpackIcon />}
            onClick={() => router.push('/packing/catalogue')}
            fullWidth sx={{ py: { xs: 1.25, sm: 1 } }}>
            Packing Catalogue
          </Button>
          <Button variant="outlined" startIcon={<PersonIcon />}
            onClick={() => router.push('/profile')}
            fullWidth sx={{ py: { xs: 1.25, sm: 1 } }}>
            Profile
          </Button>
        </Box>

        {/* ── Tabs ── */}
        {!loading && (
          <Box sx={{
            borderBottom: 1, borderColor: 'divider', mb: 3,
            '& .MuiTabs-root': { minHeight: 40 },
            '& .MuiTab-root': {
              minHeight: 40,
              fontSize: { xs: '0.72rem', sm: '0.8rem' },
              fontWeight: 700,
              textTransform: 'none',
              letterSpacing: 0,
              px: { xs: 1.5, sm: 2 },
            },
          }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable"
              scrollButtons="auto" allowScrollButtonsMobile>
              <Tab value="upcoming" label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  Upcoming
                  {counts.upcoming > 0 && (
                    <Chip label={counts.upcoming} size="small" color="primary"
                      sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }} />
                  )}
                </Box>
              } />
              <Tab value="planning" label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  Planning
                  {counts.planning > 0 && (
                    <Chip label={counts.planning} size="small" color="warning"
                      sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }} />
                  )}
                </Box>
              } />
              <Tab value="confirmed" label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  Confirmed
                  {counts.confirmed > 0 && (
                    <Chip label={counts.confirmed} size="small" color="success"
                      sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }} />
                  )}
                </Box>
              } />
              <Tab value="past" label="Past" />
              <Tab value="cancelled" label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  Cancelled
                  {counts.cancelled > 0 && (
                    <Chip label={counts.cancelled} size="small" color="error"
                      sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }} />
                  )}
                </Box>
              } />
            </Tabs>
          </Box>
        )}

        {/* ── View toggle ── */}
        {!loading && visibleTrips.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <ToggleButtonGroup value={view} exclusive onChange={(_, v) => v && setView(v)} size="small"
              sx={{ '& .MuiToggleButton-root': { px: 2, py: 0.75, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', gap: 0.5 } }}>
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
          <Box sx={{ textAlign: 'center', py: { xs: 8, sm: 12 },
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5 }}>
            <FlightTakeoffIcon sx={{ fontSize: 64, color: 'primary.main', opacity: 0.3 }} />
            <Typography variant="h5" fontWeight={700}>No upcoming trips</Typography>
            <Typography variant="body2" color="text.secondary" maxWidth={320}>
              Plan your next adventure — flights, hotels, day-by-day itinerary, and a smart packing list.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} size="large"
              onClick={() => router.push('/trips/new')}>
              Plan a trip
            </Button>
          </Box>
        )}

        {!loading && visibleTrips.length === 0 && tab !== 'upcoming' && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body1" color="text.secondary">No {tab} trips</Typography>
          </Box>
        )}

        {/* ── Calendar view ── */}
        {!loading && visibleTrips.length > 0 && view === 'calendar' && <TripCalendar />}

        {/* ── Card grid view ── */}
        {!loading && visibleTrips.length > 0 && view === 'list' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(groupedTrips).map(([month, monthTrips]) => (
              <Box key={month}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Typography variant="overline" fontWeight={800} color="text.secondary"
                    sx={{ fontSize: { xs: '0.9rem', sm: '1.8rem' }, letterSpacing: '0.3em', whiteSpace: 'nowrap' }}>
                    {month}
                  </Typography>
                  <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
                </Box>

                <Box sx={{
                  display: 'grid', gap: 2,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                }}>
                  {monthTrips.map(trip => {
                    const daysUntil = trip.startDate
                      ? Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / 86400000)
                      : null;

                    return (
                      <Card key={trip._id} onClick={() => router.push(`/trips/${trip._id}`)}
                        sx={{
                          cursor: 'pointer', backgroundColor: 'background.paper',
                          borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider',
                          ...(trip.status === 'active' && { borderColor: '#55702C', borderWidth: 2 }),
                          transition: 'transform 0.15s, box-shadow 0.15s',
                          '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                          '&:active': { transform: 'scale(0.99)' },
                          opacity: trip.status === 'cancelled' ? 0.6 : 1,
                        }}>
                        <Box sx={{
                          height: { xs: 160, sm: 140 },
                          backgroundImage: trip.coverPhotoThumb ? `url(${trip.coverPhotoThumb})` : undefined,
                          backgroundSize: 'cover', backgroundPosition: 'center',
                          backgroundColor: trip.coverPhotoThumb ? undefined : 'action.hover',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative',
                        }}>
                          {!trip.coverPhotoThumb && (
                            <FlightTakeoffIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                          )}
                          <Box sx={{ position: 'absolute', top: 10, right: 10 }}>
                            <Chip label={trip.status} color={STATUS_COLOURS[trip.status]}
                              size="small" sx={{ fontWeight: 700, fontSize: '0.7rem' }} />
                          </Box>
                          {daysUntil !== null && daysUntil > 0 && trip.status !== 'cancelled' && (
                            <Box sx={{ position: 'absolute', bottom: 10, left: 10,
                              backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 2, px: 1.25, py: 0.4 }}>
                              <Typography sx={{ color: 'white', fontSize: { xs: '1.4rem', sm: '2rem' },
                                lineHeight: 1, fontWeight: 800, letterSpacing: '-0.02em' }}>
                                {daysUntil === 1 ? 'Tomorrow' : daysUntil}
                              </Typography>
                              {daysUntil > 1 && (
                                <Typography sx={{ color: 'white', fontSize: '0.65rem', fontWeight: 600, opacity: 0.85 }}>
                                  days away
                                </Typography>
                              )}
                            </Box>
                          )}
                          {daysUntil === 0 && trip.status !== 'cancelled' && (
                            <Box sx={{ position: 'absolute', bottom: 10, left: 10,
                              backgroundColor: 'success.main', borderRadius: 2, px: 1.25, py: 0.4 }}>
                              <Typography sx={{ color: 'white', fontSize: '0.72rem', fontWeight: 700 }}>Today</Typography>
                            </Box>
                          )}
                        </Box>

                        <CardContent sx={{ p: { xs: 2, sm: 2 }, '&:last-child': { pb: 2 } }}>
                          <Typography variant="h6" fontWeight={800}
                            sx={{ fontSize: { xs: '1.6rem', sm: '1.8rem' }, mb: 0.2 }}>
                            {trip.name}
                          </Typography>
                          <Typography variant="body2" color="secondary.main" fontWeight={600}>
                            {trip.destination?.city}, {trip.destination?.country}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5 }}>
                            <Box>
                              <Typography variant="subtitle2" sx={{
                                display: 'block', fontWeight: 600,
                                fontSize: { xs: '1rem', sm: '1.3rem' }, letterSpacing: 0.3, color: 'text.primary',
                              }}>
                                {trip.startDate
                                  ? new Date(trip.startDate).toLocaleDateString('en-IE', {
                                      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                                    })
                                  : '—'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {trip.nights} nights · {TRIP_TYPE_LABEL[trip.tripType] ?? trip.tripType}
                              </Typography>
                            </Box>
                            <Typography variant="caption" color="primary.main" fontWeight={700}
                              sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              View →
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>
        )}

      </Container>
    </Box>
  );
}