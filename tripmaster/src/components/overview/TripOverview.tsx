'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Button, Chip, CircularProgress,
  LinearProgress, Divider, alpha, Tooltip, IconButton,
} from '@mui/material';
import ChevronRightIcon         from '@mui/icons-material/ChevronRight';
import FlightIcon               from '@mui/icons-material/Flight';
import HotelIcon                from '@mui/icons-material/Hotel';
import DirectionsCarIcon        from '@mui/icons-material/DirectionsCar';
import TheaterComedyIcon        from '@mui/icons-material/TheaterComedy';
import BackpackIcon             from '@mui/icons-material/Backpack';
import WbSunnyIcon              from '@mui/icons-material/WbSunny';
import FolderOpenIcon           from '@mui/icons-material/FolderOpen';
import MapIcon                  from '@mui/icons-material/Map';
import AccessTimeIcon           from '@mui/icons-material/AccessTime';
import PhoneIcon                from '@mui/icons-material/Phone';
import EmailIcon                from '@mui/icons-material/Email';
import LinkIcon                 from '@mui/icons-material/Link';
import PersonIcon               from '@mui/icons-material/Person';
import CheckCircleIcon          from '@mui/icons-material/CheckCircle';
import WarningAmberIcon         from '@mui/icons-material/WarningAmber';
import WhatsAppIcon             from '@mui/icons-material/WhatsApp';
import SmsIcon                  from '@mui/icons-material/Sms';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import BlockIcon                from '@mui/icons-material/Block';
import UndoIcon                 from '@mui/icons-material/Undo';
import NavigateButton           from '@/components/ui/NavigateButton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeatherDay {
  date:         string;
  label:        string;
  condition:    string;
  icon:         string;
  tempAvg:      number;
  tempMax:      number;
  tempMin:      number;
  chanceOfRain: number;
  precipMm:     number;
  windKph:      number;
}

interface Props {
  trip: {
    _id:              string;
    name:             string;
    tripType:         string;
    status:           string;
    purpose?:         string;
    origin:           { city: string; country: string };
    destination:      { city: string; country: string };
    startDate:        string;
    endDate:          string;
    nights:           number;
    dismissedChecks?: string[];
    weather?: {
      summary?:      string;
      packingNotes?: string[];
      days?:         WeatherDay[];
      currentWeather?: WeatherDay[];
      homeComparison?: {
        tempDeltaLabel?: string;
        insights?: { icon: string; text: string }[];
      };
    };
  };
  onNavigate: (tab: number) => void;
}

// ─── Section colour palette ───────────────────────────────────────────────────
// Each strip has its own dark header colour + a tinted content background

const SECTION_COLOURS = {
  logistics:  { header: '#1D2642', tint: 'rgba(29,38,66,0.04)',  accent: '#4a5a8a' },
  itinerary:  { header: '#2d4a1e', tint: 'rgba(45,74,30,0.04)',  accent: '#55702C' },
  weather:    { header: '#7a4a10', tint: 'rgba(122,74,16,0.04)', accent: '#C9521B' },
  packing:    { header: '#3d3035', tint: 'rgba(61,48,53,0.04)',  accent: '#8b5e6a' },
  resources:  { header: '#1a3d3d', tint: 'rgba(26,61,61,0.04)', accent: '#0891b2' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stopStartMinutes(stop: any): number | null {
  const timeStr = stop.scheduledStart
    ? stop.scheduledStart.includes('T') ? stop.scheduledStart.split('T')[1]?.slice(0, 5) : stop.scheduledStart
    : stop.time;
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

function statusDot(level: 'ok' | 'warn' | 'empty') {
  if (level === 'ok')   return <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main', flexShrink: 0 }} />;
  if (level === 'warn') return <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main', flexShrink: 0 }} />;
  return <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />;
}

const toDialDigits = (phone: string) => phone.replace(/\D/g, '');

// ─── Strip wrapper ────────────────────────────────────────────────────────────

function Strip({
  icon, label, tab, onNavigate, status, onDismiss, children,
  sectionKey,
}: {
  icon:        React.ReactNode;
  label:       string;
  tab:         number;
  onNavigate:  (tab: number) => void;
  status?:     'ok' | 'warn' | 'empty';
  onDismiss?:  () => void;
  children:    React.ReactNode;
  sectionKey:  keyof typeof SECTION_COLOURS;
}) {
  const colours = SECTION_COLOURS[sectionKey];

  return (
    <Paper
      elevation={0}
      sx={{
        overflow: 'hidden',
        border: '1px solid',
        borderColor: status === 'warn' ? 'rgba(237,108,2,0.4)' : 'divider',
        borderRadius: 2,
      }}
    >
      {/* ── Coloured header row ── */}
      <Box
        onClick={() => onNavigate(tab)}
        sx={{
          px: { xs: 2, sm: 2.5 },
          py: { xs: 1.25, sm: 1.5 },
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          backgroundColor: colours.header,
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'filter 0.15s ease',
          '&:hover': { filter: 'brightness(1.12)' },
        }}
      >
        {/* Icon */}
        <Box sx={{ color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {icon}
        </Box>

        {/* Label */}
        <Typography sx={{
          flexGrow: 1,
          fontSize: { xs: '0.85rem', sm: '0.9rem' },
          fontWeight: 800,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: 'white',
        }}>
          {label}
        </Typography>

        {/* Status badge */}
        {status === 'ok' && (
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: '0.85rem !important', color: '#4ade80 !important' }} />}
            label="Good"
            size="small"
            sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700, backgroundColor: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', '& .MuiChip-icon': { ml: '6px' } }}
          />
        )}
        {status === 'warn' && (
          <Chip
            icon={<WarningAmberIcon sx={{ fontSize: '0.85rem !important', color: '#fbbf24 !important' }} />}
            label="Action needed"
            size="small"
            sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700, backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', '& .MuiChip-icon': { ml: '6px' } }}
          />
        )}

        {/* Dismiss on empty */}
        {status === 'empty' && onDismiss && (
          <Tooltip title="Not needed for this trip">
            <IconButton
              size="small"
              onClick={e => { e.stopPropagation(); onDismiss(); }}
              sx={{ p: 0.5, color: 'rgba(255,255,255,0.35)', '&:hover': { color: '#f87171', backgroundColor: 'rgba(248,113,113,0.1)' } }}
            >
              <BlockIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        )}

        <ChevronRightIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
      </Box>

      {/* ── Content ── */}
      <Box sx={{ px: { xs: 2, sm: 2.5 }, py: { xs: 1.5, sm: 2 }, backgroundColor: colours.tint }}>
        {children}
      </Box>
    </Paper>
  );
}

// ─── Status row ───────────────────────────────────────────────────────────────

function StatusRow({ icon, label, value, level, onDismiss }: {
  icon:       React.ReactNode;
  label:      string;
  value:      string;
  level:      'ok' | 'warn' | 'empty';
  onDismiss?: () => void;
}) {
  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: { xs: 0.75, sm: 1 },
      py: { xs: 0.6, sm: 0.5 },
    }}>
      <Box sx={{ color: 'text.disabled', display: 'flex', flexShrink: 0 }}>{icon}</Box>
      <Typography sx={{
        fontSize: '0.8rem',
        color: 'text.secondary',
        minWidth: { xs: 72, sm: 90 },
        flexShrink: 0,
        fontWeight: 600,
      }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0, flexGrow: 1 }}>
        {statusDot(level)}
        <Typography sx={{
          fontSize: '0.82rem',
          fontWeight: 700,
          color: level === 'ok' ? 'success.main' : level === 'warn' ? 'warning.dark' : 'text.disabled',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {value}
        </Typography>
      </Box>
      {level === 'empty' && onDismiss && (
        <Tooltip title="Not needed for this trip">
          <IconButton
            size="small"
            onClick={e => { e.stopPropagation(); onDismiss(); }}
            sx={{ p: 0.25, flexShrink: 0, color: 'text.disabled', '&:hover': { color: 'error.main' } }}
          >
            <BlockIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TripOverview({ trip, onNavigate }: Props) {
  const [logistics,  setLogistics]  = useState<any>(null);
  const [packing,    setPacking]    = useState<any>(null);
  const [itinerary,  setItinerary]  = useState<any>(null);
  const [resources,  setResources]  = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [dismissed,  setDismissed]  = useState<string[]>(trip.dismissedChecks ?? []);

  const toggleDismiss = async (key: string) => {
    const next = dismissed.includes(key)
      ? dismissed.filter(k => k !== key)
      : [...dismissed, key];
    setDismissed(next);
    await fetch(`/api/trips/${trip._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissedChecks: next }),
    });
  };

  useEffect(() => {
    Promise.all([
      fetch(`/api/trips/${trip._id}/logistics`).then(r => r.json()),
      fetch(`/api/trips/${trip._id}/packing`).then(r => r.json()),
      fetch(`/api/trips/${trip._id}/itinerary`).then(r => r.json()),
      fetch(`/api/trips/${trip._id}/files`).then(r => r.json()),
    ]).then(([l, p, it, f]) => {
      setLogistics(l.logistics);
      setPacking(p.packing ?? p);
      setItinerary(it);
      setResources(f.files ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [trip._id]);

  // ── Date maths ────────────────────────────────────────────────────────────
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const departure = new Date(trip.startDate); departure.setHours(0, 0, 0, 0);
  const tripEnd   = new Date(trip.endDate);   tripEnd.setHours(23, 59, 59, 999);
  const daysUntil = Math.ceil((departure.getTime() - today.getTime()) / 86400000);
  const isPast    = today > tripEnd;
  const isToday   = daysUntil === 0;
  const isActive  = !isPast && today >= departure;

  // ── What's Next ───────────────────────────────────────────────────────────
  let nextStop: any = null;
  if (isActive && itinerary?.days) {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDay = itinerary.days.find(
      (d: any) => new Date(d.date).toISOString().split('T')[0] === todayStr,
    );
    if (todayDay?.stops?.length) {
      const nowMins  = new Date().getHours() * 60 + new Date().getMinutes();
      const upcoming = todayDay.stops
        .map((s: any) => ({ ...s, _startMins: stopStartMinutes(s) }))
        .filter((s: any) => s._startMins !== null && s._startMins >= nowMins)
        .sort((a: any, b: any) => a._startMins - b._startMins);
      nextStop = upcoming[0] ?? null;
    }
  }

  const nextStartMins = nextStop ? stopStartMinutes(nextStop) : null;
  const minsUntilNext = nextStartMins !== null
    ? nextStartMins - (new Date().getHours() * 60 + new Date().getMinutes())
    : null;
  const isUrgent = minsUntilNext !== null && minsUntilNext <= 30;

  // ── Logistics ─────────────────────────────────────────────────────────────
  const flights       = logistics?.transportation?.filter((t: any) => t.type === 'flight') ?? [];
  const nonFlights    = logistics?.transportation?.filter((t: any) => t.type !== 'flight') ?? [];
  const accommodation = logistics?.accommodation ?? [];
  const venues        = logistics?.venues ?? [];

  const flightsStatus: 'ok' | 'warn' | 'empty' =
    flights.length === 0 ? 'empty' :
    flights.every((f: any) => f.status === 'confirmed') ? 'ok' : 'warn';

  const accomStatus: 'ok' | 'warn' | 'empty' =
    accommodation.length === 0 ? 'empty' :
    accommodation.every((a: any) => a.status === 'confirmed') ? 'ok' : 'warn';

  const venueStatus: 'ok' | 'warn' | 'empty' =
    venues.length === 0 ? 'empty' :
    venues.every((v: any) => ['confirmed', 'booked'].includes(v.status)) ? 'ok' : 'warn';

  const transportStatus: 'ok' | 'warn' | 'empty' =
    nonFlights.length === 0 ? 'empty' :
    nonFlights.every((t: any) => t.status === 'confirmed') ? 'ok' : 'warn';

  const logisticsOverall: 'ok' | 'warn' | 'empty' = (() => {
    const active = [
      !dismissed.includes('flights') ? flightsStatus : null,
      !dismissed.includes('hotel')   ? accomStatus    : null,
      !dismissed.includes('venues')  ? venueStatus    : null,
    ].filter(Boolean) as ('ok' | 'warn' | 'empty')[];
    if (active.some(s => s === 'warn'))  return 'warn';
    if (active.every(s => s === 'ok'))   return 'ok';
    return 'empty';
  })();

  // ── Itinerary ─────────────────────────────────────────────────────────────
  const totalStops = itinerary?.days?.reduce((acc: number, d: any) => acc + (d.stops?.length ?? 0), 0) ?? 0;
  const totalDays  = itinerary?.days?.filter((d: any) => d.stops?.length > 0).length ?? 0;

  // ── Packing ───────────────────────────────────────────────────────────────
  const items       = packing?.items ?? [];
  const packedItems = items.filter((i: any) => i.packed).length;
  const packPct     = items.length > 0 ? Math.round((packedItems / items.length) * 100) : 0;

  const packingStatus: 'ok' | 'warn' | 'empty' =
    items.length === 0 ? 'empty' :
    packPct === 100 ? 'ok' :
    daysUntil <= 3 ? 'warn' : 'empty';

  // ── Weather ───────────────────────────────────────────────────────────────
  const weatherDay = trip.weather?.days?.[0] ?? trip.weather?.currentWeather?.[0] ?? null;

  // ── Resources ─────────────────────────────────────────────────────────────
  const contacts   = resources.filter(r => r.resourceType === 'contact');
  const notes      = resources.filter(r => r.resourceType === 'note');
  const keyLinks   = resources.filter(r => r.resourceType === 'link' &&
    ['event_website', 'booking_reference', 'venue', 'artist_lineup'].includes(r.type));
  const docCount   = resources.filter(r => r.resourceType === 'file').length;
  const hasResources = contacts.length > 0 || keyLinks.length > 0 || docCount > 0 || notes.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2 } }}>

      {/* ── What's Next (active trips only) ── */}
      {isActive && nextStop && (
        <Paper elevation={0} sx={{
          p: { xs: 2, sm: 2.5 },
          backgroundColor: isUrgent ? 'rgba(201,82,27,0.06)' : 'rgba(85,112,44,0.06)',
          border: '2px solid',
          borderColor: isUrgent ? 'warning.main' : '#55702C',
          borderRadius: 2,
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{
                fontWeight: 800, textTransform: 'uppercase', fontSize: '0.65rem',
                letterSpacing: '0.08em', color: isUrgent ? 'warning.dark' : '#55702C',
              }}>
                {isUrgent
                  ? `⚡ Starting in ${minsUntilNext} min`
                  : `Next up · ${nextStartMins !== null ? formatTime(nextStartMins) : ''}`}
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ mt: 0.25, lineHeight: 1.2 }}>
                {nextStop.name}
              </Typography>
              {nextStop.address && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{nextStop.address}</Typography>
              )}
              {nextStop.notes && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{nextStop.notes}</Typography>
              )}
            </Box>
            <NavigateButton
              destination={{ name: nextStop.name, address: nextStop.address, coordinates: nextStop.coordinates ?? null }}
              suggestedMode="walking" variant="button" label="Navigate"
              sx={{ flexShrink: 0 }}
            />
          </Box>
        </Paper>
      )}

      {isActive && !nextStop && (
        <Paper elevation={0} sx={{
          p: 2, backgroundColor: 'rgba(85,112,44,0.06)',
          border: '1px solid', borderColor: '#55702C', borderRadius: 2,
        }}>
          <Typography variant="body2" fontWeight={700} color="#55702C">✅ Nothing more scheduled for today</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>Check the itinerary tab for tomorrow.</Typography>
        </Paper>
      )}

      {/* ── Countdown hero ── */}
      <Paper elevation={0} sx={{
        px: { xs: 2, sm: 2.5 },
        py: { xs: 2, sm: 2.5 },
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: '4px solid',
        borderLeftColor: isToday ? 'success.main' : isPast ? 'text.disabled' : daysUntil <= 7 ? 'warning.main' : 'primary.main',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AccessTimeIcon color={isToday ? 'success' : isPast ? 'disabled' : 'primary'} sx={{ fontSize: 26, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={800} sx={{ lineHeight: 1, fontSize: { xs: '1.6rem', sm: '2rem' } }}>
              {isPast ? 'Trip complete' : isToday ? 'Departing today' : `${daysUntil} days to go`}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, fontSize: '0.82rem' }}>
              {new Date(trip.startDate).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
              {' → '}
              {new Date(trip.endDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'long' })}
              {trip.nights > 0 && ` · ${trip.nights} nights`}
            </Typography>
          </Box>
        </Box>

        {items.length > 0 && !isPast && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.75rem' }}>
                Packing · {packedItems} of {items.length} items
              </Typography>
              <Typography variant="caption" fontWeight={800}
                sx={{ fontSize: '0.75rem', color: packPct === 100 ? 'success.main' : 'text.secondary' }}>
                {packPct}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={packPct} sx={{
              height: 5, borderRadius: 3, backgroundColor: 'action.hover',
              '& .MuiLinearProgress-bar': { borderRadius: 3, backgroundColor: packPct === 100 ? 'success.main' : '#55702C' },
            }} />
          </Box>
        )}
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={26} />
        </Box>
      ) : (
        <>
          {/* ── LOGISTICS ── */}
          {!dismissed.includes('logistics') && (
            <Strip
              icon={<FlightIcon sx={{ fontSize: 20 }} />}
              label="Logistics"
              tab={1}
              onNavigate={onNavigate}
              status={logisticsOverall}
              sectionKey="logistics"
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {!dismissed.includes('flights') && (
                  <StatusRow
                    icon={<FlightIcon sx={{ fontSize: 14 }} />}
                    label="Flights"
                    level={flightsStatus}
                    onDismiss={flightsStatus === 'empty' ? () => toggleDismiss('flights') : undefined}
                    value={
                      flights.length === 0 ? 'Not added' :
                      flights.map((f: any) => f.details?.flightNumber || f.flightNumber || f.details?.airline || 'Flight').join(' · ')
                      + (flights.every((f: any) => f.status === 'confirmed') ? ' · Confirmed' : ` · ${flights.filter((f: any) => f.status === 'confirmed').length}/${flights.length} confirmed`)
                    }
                  />
                )}
                {!dismissed.includes('hotel') && (
                  <StatusRow
                    icon={<HotelIcon sx={{ fontSize: 14 }} />}
                    label="Hotel"
                    level={accomStatus}
                    onDismiss={accomStatus === 'empty' ? () => toggleDismiss('hotel') : undefined}
                    value={
                      accommodation.length === 0 ? 'Not added' :
                      accommodation.map((a: any) => a.name).join(', ')
                      + (accommodation.every((a: any) => a.status === 'confirmed') ? ' · Confirmed' : ' · Not confirmed')
                    }
                  />
                )}
                {!dismissed.includes('venues') && (
                  <StatusRow
                    icon={<TheaterComedyIcon sx={{ fontSize: 14 }} />}
                    label="Venues"
                    level={venueStatus}
                    onDismiss={venueStatus === 'empty' ? () => toggleDismiss('venues') : undefined}
                    value={
                      venues.length === 0 ? 'None added' :
                      venues.map((v: any) => v.name).join(', ')
                      + (venues.every((v: any) => ['confirmed','booked'].includes(v.status)) ? ' · Booked' : ' · Not booked')
                    }
                  />
                )}
                {nonFlights.length > 0 && (
                  <StatusRow
                    icon={<DirectionsCarIcon sx={{ fontSize: 14 }} />}
                    label="Transport"
                    level={transportStatus}
                    value={
                      nonFlights.map((t: any) => {
                        const l = t.details?.vehicle || t.details?.rentalCompany || t.type;
                        return l.charAt(0).toUpperCase() + l.slice(1);
                      }).join(' · ')
                      + (nonFlights.every((t: any) => t.status === 'confirmed') ? ' · Confirmed' : ' · Not confirmed')
                    }
                  />
                )}
              </Box>
            </Strip>
          )}

          {/* ── ITINERARY ── */}
          {!dismissed.includes('itinerary') && (
            <Strip
              icon={<MapIcon sx={{ fontSize: 20 }} />}
              label="Itinerary"
              tab={2}
              onNavigate={onNavigate}
              status={totalStops > 0 ? 'ok' : 'empty'}
              onDismiss={totalStops === 0 ? () => toggleDismiss('itinerary') : undefined}
              sectionKey="itinerary"
            >
              {totalStops === 0 ? (
                <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.82rem' }}>
                  No itinerary added yet
                </Typography>
              ) : isActive && itinerary?.days ? (
                (() => {
                  const todayStr   = new Date().toISOString().split('T')[0];
                  const todayDay   = itinerary.days.find((d: any) => new Date(d.date).toISOString().split('T')[0] === todayStr);
                  const todayStops = todayDay?.stops ?? [];
                  const nowMins    = new Date().getHours() * 60 + new Date().getMinutes();
                  const remaining  = todayStops.filter((s: any) => {
                    const m = stopStartMinutes(s);
                    return m === null || m >= nowMins;
                  });
                  return remaining.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {remaining.slice(0, 3).map((s: any, i: number) => {
                        const mins = stopStartMinutes(s);
                        return (
                          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', width: 34, flexShrink: 0, fontWeight: 700 }}>
                              {mins !== null ? formatTime(mins) : '—'}
                            </Typography>
                            <Typography sx={{ fontSize: '0.84rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.name}
                            </Typography>
                          </Box>
                        );
                      })}
                      {remaining.length > 3 && (
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem', mt: 0.25 }}>
                          +{remaining.length - 3} more today
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                      Nothing more scheduled today
                    </Typography>
                  );
                })()
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.84rem', fontWeight: 600 }}>
                  {totalDays} day{totalDays !== 1 ? 's' : ''} planned · {totalStops} stop{totalStops !== 1 ? 's' : ''}
                </Typography>
              )}
            </Strip>
          )}

          {/* ── WEATHER ── */}
          {trip.weather && !dismissed.includes('weather') && (
            <Strip
              icon={<WbSunnyIcon sx={{ fontSize: 20 }} />}
              label="Weather"
              tab={5}
              onNavigate={onNavigate}
              status="ok"
              sectionKey="weather"
            >
              {weatherDay ? (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '1.8rem', lineHeight: 1, flexShrink: 0 }}>{weatherDay.icon}</Typography>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700} sx={{ fontSize: '0.9rem' }}>
                      {weatherDay.condition} · {weatherDay.tempMax}°C high / {weatherDay.tempMin}°C low
                    </Typography>
                    {trip.weather?.summary && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem', display: 'block', mt: 0.3 }}>
                        {trip.weather.summary}
                      </Typography>
                    )}
                    {trip.weather?.packingNotes?.[0] && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem', display: 'block', mt: 0.2 }}>
                        💡 {trip.weather.packingNotes[0]}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ) : trip.weather?.summary ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>{trip.weather.summary}</Typography>
              ) : (
                <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.82rem' }}>No forecast data yet</Typography>
              )}
            </Strip>
          )}

          {/* ── PACKING ── */}
          {!dismissed.includes('packing') && (
            <Strip
              icon={<BackpackIcon sx={{ fontSize: 20 }} />}
              label="Packing"
              tab={3}
              onNavigate={onNavigate}
              status={packingStatus}
              onDismiss={items.length === 0 ? () => toggleDismiss('packing') : undefined}
              sectionKey="packing"
            >
              {items.length === 0 ? (
                <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.82rem' }}>
                  No list generated yet — tap to create one
                </Typography>
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                      {packedItems} of {items.length} items packed
                    </Typography>
                    <Typography fontWeight={800} sx={{
                      fontSize: '0.82rem',
                      color: packPct === 100 ? 'success.main' : daysUntil <= 3 ? 'warning.dark' : 'text.secondary',
                    }}>
                      {packPct}%
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={packPct} sx={{
                    height: 7, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.08)',
                    '& .MuiLinearProgress-bar': { borderRadius: 3, backgroundColor: packPct === 100 ? 'success.main' : '#8b5e6a' },
                  }} />
                </Box>
              )}
            </Strip>
          )}

          {/* ── RESOURCES ── */}
          {hasResources && !dismissed.includes('resources') && (
            <Strip
              icon={<FolderOpenIcon sx={{ fontSize: 20 }} />}
              label="Resources"
              tab={7}
              onNavigate={onNavigate}
              status={contacts.length > 0 ? 'ok' : 'empty'}
              sectionKey="resources"
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {contacts.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {contacts.map((c: any) => (
                      <Box key={c._id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <PersonIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
                        <Typography fontWeight={700} sx={{ fontSize: '0.85rem', mr: 0.5 }}>{c.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', mr: 'auto', textTransform: 'capitalize' }}>
                          {c.type?.replace(/_/g, ' ')}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, flexWrap: 'wrap' }}>
                          {c.phone && (
                            <Button component="a" href={`tel:${c.phone}`} size="small" startIcon={<PhoneIcon sx={{ fontSize: '0.85rem !important' }} />}
                              variant="outlined" onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              sx={{ fontSize: '0.72rem', fontWeight: 700, py: 0.35, px: 0.9, minHeight: 28, borderColor: alpha('#55702C', 0.4), color: '#55702C', '&:hover': { borderColor: '#55702C', backgroundColor: alpha('#55702C', 0.06) } }}>
                              Call
                            </Button>
                          )}
                          {c.phone && (
                            <Button component="a" href={`sms:${c.phone}`} size="small" startIcon={<SmsIcon sx={{ fontSize: '0.85rem !important' }} />}
                              variant="outlined" onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              sx={{ fontSize: '0.72rem', fontWeight: 700, py: 0.35, px: 0.9, minHeight: 28, borderColor: alpha('#64748b', 0.4), color: '#64748b', '&:hover': { borderColor: '#64748b', backgroundColor: alpha('#64748b', 0.06) } }}>
                              SMS
                            </Button>
                          )}
                          {c.phone && (
                            <Button component="a" href={`https://wa.me/${toDialDigits(c.phone)}`}
                              target="_blank" rel="noopener noreferrer" size="small"
                              startIcon={<WhatsAppIcon sx={{ fontSize: '0.85rem !important' }} />}
                              variant="outlined" onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              sx={{ fontSize: '0.72rem', fontWeight: 700, py: 0.35, px: 0.9, minHeight: 28, borderColor: alpha('#25D366', 0.5), color: '#25D366', '&:hover': { borderColor: '#25D366', backgroundColor: alpha('#25D366', 0.06) } }}>
                              WhatsApp
                            </Button>
                          )}
                          {c.email && (
                            <Button component="a" href={`mailto:${c.email}`} size="small" startIcon={<EmailIcon sx={{ fontSize: '0.85rem !important' }} />}
                              variant="outlined" onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              sx={{ fontSize: '0.72rem', fontWeight: 700, py: 0.35, px: 0.9, minHeight: 28, borderColor: alpha('#0891b2', 0.4), color: '#0891b2', '&:hover': { borderColor: '#0891b2', backgroundColor: alpha('#0891b2', 0.06) } }}>
                              Email
                            </Button>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}

                {contacts.length > 0 && (keyLinks.length > 0 || docCount > 0 || notes.length > 0) && <Divider />}

                {keyLinks.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {keyLinks.map((l: any) => (
                      <Chip
                        key={l._id}
                        icon={<LinkIcon sx={{ fontSize: '0.8rem !important' }} />}
                        label={l.name}
                        size="small"
                        component="a"
                        href={l.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        clickable
                        sx={{ fontSize: '0.72rem', fontWeight: 600, height: 24 }}
                      />
                    ))}
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  {docCount > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
                      📄 {docCount} document{docCount !== 1 ? 's' : ''}
                    </Typography>
                  )}
                  {notes.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
                      🗒️ {notes.length} note{notes.length !== 1 ? 's' : ''}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Strip>
          )}

          {!hasResources && !dismissed.includes('resources') && (
            <Strip
              icon={<FolderOpenIcon sx={{ fontSize: 20 }} />}
              label="Resources"
              tab={7}
              onNavigate={onNavigate}
              status="empty"
              onDismiss={() => toggleDismiss('resources')}
              sectionKey="resources"
            >
              <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.82rem' }}>
                No contacts, notes, links or documents yet
              </Typography>
            </Strip>
          )}

          {/* ── Dismissed row ── */}
          {dismissed.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5 }}>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem', flexGrow: 1 }}>
                {dismissed.length} section{dismissed.length !== 1 ? 's' : ''} hidden for this trip
              </Typography>
              <Button
                size="small"
                startIcon={<UndoIcon sx={{ fontSize: '0.8rem !important' }} />}
                onClick={() => {
                  setDismissed([]);
                  fetch(`/api/trips/${trip._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dismissedChecks: [] }),
                  });
                }}
                sx={{ fontSize: '0.72rem', color: 'text.disabled', py: 0.25 }}
              >
                Restore all
              </Button>
            </Box>
          )}

          {/* ── Trip details ── */}
          <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Typography sx={{
              fontSize: '0.7rem', fontWeight: 800, letterSpacing: 1.2,
              textTransform: 'uppercase', color: 'text.disabled', mb: 1.5,
            }}>
              Trip Details
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: { xs: 1.5, sm: 2 } }}>
              {[
                { label: 'From',    value: trip.origin?.city,      sub: trip.origin?.country },
                { label: 'To',      value: trip.destination?.city, sub: trip.destination?.country },
                { label: 'Departs', value: new Date(trip.startDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'long' }), sub: String(new Date(trip.startDate).getFullYear()) },
                { label: 'Type',    value: trip.tripType,           sub: trip.nights > 0 ? `${trip.nights} nights` : 'Day trip', capitalize: true },
              ].map(({ label, value, sub, capitalize }) => (
                <Box key={label}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: 0.8, color: 'text.disabled', textTransform: 'uppercase', mb: 0.25 }}>
                    {label}
                  </Typography>
                  <Typography fontWeight={800} sx={{ fontSize: '0.9rem', textTransform: capitalize ? 'capitalize' : 'none' }}>
                    {value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', textTransform: capitalize ? 'capitalize' : 'none' }}>
                    {sub}
                  </Typography>
                </Box>
              ))}
            </Box>
            {trip.purpose && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: 0.8, color: 'text.disabled', textTransform: 'uppercase', mb: 0.25 }}>
                  Purpose
                </Typography>
                <Typography sx={{ fontSize: '0.88rem' }}>{trip.purpose}</Typography>
              </Box>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}