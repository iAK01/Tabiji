'use client';

import React, { useEffect, useState } from 'react';
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
import TrainIcon                from '@mui/icons-material/Train';
import BadgeIcon                from '@mui/icons-material/Badge';
import HealthAndSafetyIcon      from '@mui/icons-material/HealthAndSafety';
import ConfirmationNumberIcon   from '@mui/icons-material/ConfirmationNumber';
import VisibilityIcon           from '@mui/icons-material/Visibility';
import RefreshIcon              from '@mui/icons-material/Refresh';
import NavigateButton           from '@/components/ui/NavigateButton';
import DocumentViewer, { type ViewableFile } from '@/components/files/DocumentViewer';
import PreTripAppsCard from '@/components/overview/PreTripAppsCard';
import { saveTripCache, getTripCache } from '@/lib/offline/db';

// ─── Design tokens ────────────────────────────────────────────────────────────

const D = {
  navy:    '#1D2642',
  terra:   '#C4714A',
  green:   '#6B7C5C',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

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
    destination:      { city: string; country: string; countryCode?: string };
    startDate:        string;
    endDate:          string;
    nights:           number;
    dismissedChecks?: string[];
    weather?: {
      mode?:         'forecast' | 'historical' | 'current';
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
  coverPhotoUrl?:    string;
  coverPhotoCredit?: string;
  onNavigate: (tab: number) => void;
  onRefreshPhoto?:  () => void;
  tabsSlot?:        React.ReactNode;
}

// ─── Section colours ──────────────────────────────────────────────────────────

const SECTION_COLOURS = {
  logistics:  { header: '#1D2642', tint: 'rgba(29,38,66,0.03)',  accent: '#4a5a8a' },
  itinerary:  { header: '#2d4a1e', tint: 'rgba(45,74,30,0.03)',  accent: '#55702C' },
  weather:    { header: '#7a4a10', tint: 'rgba(122,74,16,0.03)', accent: '#C9521B' },
  packing:    { header: '#3d3035', tint: 'rgba(61,48,53,0.03)',  accent: '#8b5e6a' },
  resources:  { header: '#1a3d3d', tint: 'rgba(26,61,61,0.03)', accent: '#0891b2' },
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

const toDialDigits = (phone: string) => phone.replace(/\D/g, '');

// ─── Shared atoms ─────────────────────────────────────────────────────────────

const SectionTag = ({ children, color = D.muted }: { children: React.ReactNode; color?: string }) => (
  <Typography sx={{
    fontFamily: D.body, fontSize: '0.6rem', fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    color, display: 'block',
  }}>
    {children}
  </Typography>
);


function statusDot(level: 'ok' | 'warn' | 'empty') {
  if (level === 'ok')   return <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main', flexShrink: 0 }} />;
  if (level === 'warn') return <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main', flexShrink: 0 }} />;
  return <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />;
}

// ─── Strip wrapper ────────────────────────────────────────────────────────────

function Strip({
  icon, label, tab, onNavigate, status, onDismiss, children, sectionKey,
}: {
  icon:       React.ReactNode;
  label:      string;
  tab:        number;
  onNavigate: (tab: number) => void;
  status?:    'ok' | 'warn' | 'empty';
  onDismiss?: () => void;
  children:   React.ReactNode;
  sectionKey: keyof typeof SECTION_COLOURS;
}) {
  const colours = SECTION_COLOURS[sectionKey];
  return (
    <Paper elevation={0} sx={{
      overflow: 'hidden',
      border: '1.5px solid',
      borderColor: status === 'warn' ? 'rgba(237,108,2,0.4)' : D.rule,
      borderRadius: '12px',
    }}>
      {/* Header */}
      <Box
        onClick={() => onNavigate(tab)}
        sx={{
          px: 2.5, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 1.5,
          backgroundColor: colours.header,
          cursor: 'pointer', userSelect: 'none',
          transition: 'filter 0.15s ease',
          '&:hover': { filter: 'brightness(1.12)' },
        }}
      >
        <Box sx={{ color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {icon}
        </Box>

        <Typography sx={{
          flexGrow: 1,
          fontFamily: D.display,
          fontSize: '1.2rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'white',
        }}>
          {label}
        </Typography>

        {status === 'ok' && (
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#4ade80', flexShrink: 0 }} />
        )}
        {status === 'warn' && (
          <WarningAmberIcon sx={{ fontSize: 16, color: '#fbbf24', flexShrink: 0 }} />
        )}
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
        <ChevronRightIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
      </Box>

      {/* Content */}
      <Box sx={{ px: 2.5, py: 2, backgroundColor: colours.tint }}>
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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.6 }}>
      <Box sx={{ color: 'text.disabled', display: 'flex', flexShrink: 0 }}>{icon}</Box>
      <Typography sx={{
        fontFamily: D.body, fontSize: '0.78rem', color: 'text.secondary',
        minWidth: { xs: 72, sm: 90 }, flexShrink: 0, fontWeight: 600,
      }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0, flexGrow: 1 }}>
        {statusDot(level)}
        <Typography sx={{
          fontFamily: D.body, fontSize: '0.82rem', fontWeight: 700,
          color: level === 'ok' ? 'success.main' : level === 'warn' ? 'warning.dark' : 'text.disabled',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value}
        </Typography>
      </Box>
      {level === 'empty' && onDismiss && (
        <Tooltip title="Not needed for this trip">
          <IconButton size="small" onClick={e => { e.stopPropagation(); onDismiss(); }}
            sx={{ p: 0.25, flexShrink: 0, color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
            <BlockIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TICKET_TYPES = new Set([
  'boarding_pass', 'train_ticket', 'hotel_confirmation', 'car_hire',
  'visa', 'insurance', 'passport', 'event_brief',
]);

const TICKET_ICONS: Record<string, React.ElementType> = {
  boarding_pass:      FlightIcon,
  train_ticket:       TrainIcon,
  hotel_confirmation: HotelIcon,
  car_hire:           DirectionsCarIcon,
  visa:               BadgeIcon,
  insurance:          HealthAndSafetyIcon,
  passport:           BadgeIcon,
  event_brief:        ConfirmationNumberIcon,
};

export default function TripOverview({ trip, coverPhotoUrl, coverPhotoCredit, onNavigate, onRefreshPhoto, tabsSlot }: Props) {
  const [logistics,    setLogistics]    = useState<any>(null);
  const [packing,      setPacking]      = useState<any>(null);
  const [itinerary,    setItinerary]    = useState<any>(null);
  const [resources,    setResources]    = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [dismissed,    setDismissed]    = useState<string[]>(trip.dismissedChecks ?? []);
  const [viewerFile,   setViewerFile]   = useState<ViewableFile | null>(null);

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
    async function load() {
      try {
        const [l, p, it, f] = await Promise.all([
          fetch(`/api/trips/${trip._id}/logistics`).then(r => r.json()),
          fetch(`/api/trips/${trip._id}/packing`).then(r => r.json()),
          fetch(`/api/trips/${trip._id}/itinerary`).then(r => r.json()),
          fetch(`/api/trips/${trip._id}/files`).then(r => r.json()),
        ]);
        const logistics  = l.logistics  ?? null;
        const packing    = p.packing    ?? p;
        const itinerary  = it;
        const resources  = f.files      ?? [];
        setLogistics(logistics);
        setPacking(packing);
        setItinerary(itinerary);
        setResources(resources);
        // Save for offline use
        const existing = await getTripCache(trip._id);
        await saveTripCache(trip._id, {
          ...(existing ?? {}),
          overviewData: { logistics, packing, itinerary, resources },
        });
      } catch {
        // Network unavailable — try cache
        const cached = await getTripCache(trip._id);
        if (cached?.overviewData) {
          setLogistics(cached.overviewData.logistics);
          setPacking(cached.overviewData.packing);
          setItinerary(cached.overviewData.itinerary);
          setResources(cached.overviewData.resources ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
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

  const nextStartMins  = nextStop ? stopStartMinutes(nextStop) : null;
  const minsUntilNext  = nextStartMins !== null
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
    flights.every((f: any) => ['confirmed', 'booked'].includes(f.status)) ? 'ok' : 'warn';

  const accomStatus: 'ok' | 'warn' | 'empty' =
    accommodation.length === 0 ? 'empty' :
    accommodation.every((a: any) => ['confirmed', 'booked'].includes(a.status)) ? 'ok' : 'warn';

  const venueStatus: 'ok' | 'warn' | 'empty' =
    venues.length === 0 ? 'empty' :
    venues.every((v: any) => ['confirmed', 'booked'].includes(v.status)) ? 'ok' : 'warn';

  const transportStatus: 'ok' | 'warn' | 'empty' =
    nonFlights.length === 0 ? 'empty' :
    nonFlights.every((t: any) => ['confirmed', 'booked'].includes(t.status)) ? 'ok' : 'warn';

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
  const docCount    = resources.filter(r => r.resourceType === 'file').length;
  const ticketFiles = resources.filter(r => r.resourceType === 'file' && TICKET_TYPES.has(r.type) && r.gcsUrl);
  const hasResources = contacts.length > 0 || keyLinks.length > 0 || docCount > 0 || notes.length > 0;

  // ── Countdown label ───────────────────────────────────────────────────────
  const currentDayNum   = isActive ? Math.floor((today.getTime() - departure.getTime()) / 86400000) + 1 : null;
  const tripTotalDays   = isActive ? Math.floor((tripEnd.getTime()  - departure.getTime()) / 86400000) + 1 : null;

  const countdownNumber = isPast ? null : isActive ? currentDayNum : daysUntil;
  const countdownLabel  = isPast   ? 'TRIP COMPLETE'
                        : isActive ? `DAY ${currentDayNum} OF ${tripTotalDays}`
                        : isToday  ? 'DEPARTING TODAY'
                        : 'DAYS TO GO';

  return (
    <>

      {/* ── Full-bleed photo hero ── */}
      <Box sx={{
        position: 'relative',
        height: { xs: 440, sm: 480, md: 540 },
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${D.navy} 0%, #2a3558 100%)`,
      }}>
        {coverPhotoUrl && (
          <Box sx={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${coverPhotoUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }} />
        )}

        {/* Gradient — clear in middle, dark at top and heavy at bottom */}
        <Box sx={{
          position: 'absolute', inset: 0,
          background: coverPhotoUrl
            ? 'linear-gradient(to bottom, rgba(10,16,44,0.55) 0%, rgba(10,16,44,0.05) 35%, rgba(10,16,44,0.75) 65%, rgba(10,16,44,0.98) 100%)'
            : 'none',
        }} />

        {/* Weather — top left */}
        {weatherDay && (
          <Box sx={{
            position: 'absolute', top: 16, left: { xs: 20, md: 28 },
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.2rem' }, lineHeight: 1 }}>
              {weatherDay.icon}
            </Typography>
            <Box>
              <Typography sx={{
                fontFamily: D.display, fontSize: { xs: '1.6rem', md: '2rem' },
                color: 'white', lineHeight: 1, letterSpacing: '-0.03em',
                textShadow: '0 2px 12px rgba(0,0,0,0.6)',
              }}>
                {Math.round(weatherDay.tempAvg)}°
              </Typography>
              <Typography sx={{
                fontFamily: D.body, fontSize: '0.6rem', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.55)',
                textShadow: '0 1px 4px rgba(0,0,0,0.6)',
              }}>
                {trip.weather?.mode === 'historical' ? 'Avg · ' : ''}{weatherDay.condition}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Refresh photo — top right */}
        {onRefreshPhoto && coverPhotoUrl && (
          <IconButton onClick={onRefreshPhoto} size="small" sx={{
            position: 'absolute', top: 14, right: 14,
            color: 'rgba(255,255,255,0.65)',
            bgcolor: 'rgba(0,0,0,0.28)',
            backdropFilter: 'blur(6px)',
            '&:hover': { color: 'white', bgcolor: 'rgba(0,0,0,0.5)' },
          }}>
            <RefreshIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}

        {/* Bottom content */}
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, px: { xs: 3, md: 5 }, pb: { xs: 3.5, md: 4.5 } }}>

          {/* Trip name */}
          <Typography sx={{
            fontFamily: D.display,
            fontSize: { xs: '1.15rem', md: '1.5rem' },
            color: 'white', lineHeight: 1.2,
            letterSpacing: '-0.01em',
            mb: 0.5,
            textShadow: '0 2px 12px rgba(0,0,0,0.65)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {trip.name}
          </Typography>

          {/* Route + type breadcrumb */}
          <Typography sx={{
            fontFamily: D.body, fontSize: '0.62rem', fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.45)',
            mb: { xs: 2, md: 2.5 },
            textShadow: '0 1px 4px rgba(0,0,0,0.6)',
          }}>
            {trip.origin?.city} → {trip.destination?.city}
            {trip.tripType && <> · <span style={{ textTransform: 'capitalize' }}>{trip.tripType}</span></>}
          </Typography>

          {/* Countdown + destination row */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 2.5, md: 4 } }}>
            <Box sx={{ flexShrink: 0 }}>
              {countdownNumber !== null ? (
                <>
                  <Typography sx={{
                    fontFamily: D.display,
                    fontSize: { xs: '6rem', md: '9rem' },
                    lineHeight: 1, letterSpacing: '-0.05em',
                    color: isPast ? 'rgba(255,255,255,0.3)' : isActive ? '#4ade80' : daysUntil <= 7 ? '#fbbf24' : 'white',
                    textShadow: '0 4px 32px rgba(0,0,0,0.6)',
                  }}>
                    {countdownNumber}
                  </Typography>
                  <Typography sx={{
                    fontFamily: D.body, fontSize: '0.62rem', fontWeight: 700,
                    letterSpacing: '0.18em', textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.45)', mt: 0.5,
                    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                  }}>
                    {countdownLabel}
                  </Typography>
                </>
              ) : (
                <Typography sx={{ fontFamily: D.display, fontSize: '2rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>Complete</Typography>
              )}
            </Box>

            <Box sx={{ width: '1px', height: { xs: 64, md: 88 }, bgcolor: 'rgba(255,255,255,0.2)', flexShrink: 0, mb: 1.5 }} />

            <Box sx={{ flex: 1, minWidth: 0, pb: 0.5 }}>
              <Typography sx={{
                fontFamily: D.display,
                fontSize: { xs: '2.8rem', md: '4.5rem' },
                color: 'white', lineHeight: 1, letterSpacing: '-0.03em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textShadow: '0 3px 20px rgba(0,0,0,0.65)',
              }}>
                {trip.destination?.city}
              </Typography>
              <Typography sx={{
                fontFamily: D.body, fontSize: { xs: '0.82rem', md: '0.95rem' },
                color: 'rgba(255,255,255,0.55)', mt: 0.75,
                textShadow: '0 1px 6px rgba(0,0,0,0.5)',
              }}>
                {trip.destination?.country}
                {' · '}
                {new Date(trip.startDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                {' → '}
                {new Date(trip.endDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                {trip.nights > 0 && ` · ${trip.nights}N`}
              </Typography>
            </Box>
          </Box>

          {items.length > 0 && !isPast && (
            <Box sx={{ mt: { xs: 2, md: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography sx={{ fontFamily: D.body, fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.04em', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                  Packing · {packedItems} of {items.length}
                </Typography>
                <Typography sx={{ fontFamily: D.display, fontSize: '0.65rem', color: packPct === 100 ? '#4ade80' : 'rgba(255,255,255,0.35)', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                  {packPct}%
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={packPct} sx={{
                height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)',
                '& .MuiLinearProgress-bar': { borderRadius: 2, backgroundColor: packPct === 100 ? '#4ade80' : 'rgba(255,255,255,0.5)' },
              }} />
            </Box>
          )}
        </Box>

        {coverPhotoCredit && (
          <Typography sx={{
            position: 'absolute', bottom: 10, right: 14,
            fontFamily: D.body, fontSize: '0.55rem',
            color: 'rgba(255,255,255,0.22)', letterSpacing: '0.04em',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}>
            {coverPhotoCredit}
          </Typography>
        )}
      </Box>

      {tabsSlot}

      {/* ── Cards sheet ── */}
      <Box sx={{
        bgcolor: D.bg,
        borderRadius: 0,
        mt: 0,
        position: 'relative', zIndex: 1,
        pt: { xs: 3, md: 4 },
      }}>
    <Box sx={{ maxWidth: '1200px', mx: 'auto', px: { xs: 2, sm: 3 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: { xs: 1.5, sm: 2 }, alignItems: 'start' }}>

      {/* ── What's Next (active trips only) ── */}
      {isActive && nextStop && (
        <Paper elevation={0} sx={{
          gridColumn: { md: '1 / -1' },
          overflow: 'hidden',
          border: '1.5px solid',
          borderColor: isUrgent ? 'rgba(237,108,2,0.5)' : 'rgba(107,124,92,0.4)',
          borderRadius: '12px',
          position: 'relative',
        }}>
          {/* Urgency colour bar */}
          <Box sx={{
            height: 4,
            background: isUrgent
              ? 'linear-gradient(90deg, #ed6c02, #fbbf24)'
              : 'linear-gradient(90deg, #6B7C5C, #9aad89)',
          }} />

          <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
            <Box sx={{ minWidth: 0 }}>
              <SectionTag color={isUrgent ? '#ed6c02' : D.green}>
                {isUrgent
                  ? `Starting in ${minsUntilNext} min`
                  : `Next up · ${nextStartMins !== null ? formatTime(nextStartMins) : ''}`}
              </SectionTag>
              <Typography sx={{
                fontFamily: D.display, fontSize: '1.4rem', color: D.navy,
                lineHeight: 1.1, letterSpacing: '-0.02em', mt: 0.5,
              }}>
                {nextStop.name}
              </Typography>
              {nextStop.reference && (
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center',
                  mt: 0.75, px: 1.25, py: 0.4,
                  borderRadius: '6px',
                  backgroundColor: 'rgba(3,105,161,0.10)',
                  border: '1.5px solid rgba(3,105,161,0.3)',
                }}>
                  <Typography sx={{
                    fontFamily: D.body, fontSize: '0.9rem', fontWeight: 800,
                    color: '#0369a1', letterSpacing: '0.03em', lineHeight: 1.3,
                  }}>
                    {nextStop.reference}
                  </Typography>
                </Box>
              )}
              {nextStop.address && (
                <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted, mt: 0.5 }}>
                  {nextStop.address}
                </Typography>
              )}
              {nextStop.notes && (
                <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: D.muted, mt: 0.4, fontStyle: 'italic' }}>
                  {nextStop.notes}
                </Typography>
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
          gridColumn: { md: '1 / -1' },
          p: 2.5, border: '1.5px solid rgba(107,124,92,0.4)', borderRadius: '12px',
          bgcolor: 'rgba(107,124,92,0.04)',
        }}>
          <Typography sx={{ fontFamily: D.display, fontSize: '0.9rem', color: D.green }}>
            Nothing more scheduled today
          </Typography>
          <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted, mt: 0.4 }}>
            Check the itinerary tab for tomorrow.
          </Typography>
        </Paper>
      )}

      {loading ? (
        <Box sx={{ gridColumn: { md: '1 / -1' }, display: 'flex', justifyContent: 'center', py: 4 }}>
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
                      + (flights.every((f: any) => ['confirmed','booked'].includes(f.status)) ? ' · Booked' : ` · ${flights.filter((f: any) => ['confirmed','booked'].includes(f.status)).length}/${flights.length} booked`)
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
                      + (accommodation.every((a: any) => ['confirmed','booked'].includes(a.status)) ? ' · Booked' : ' · Not confirmed')
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
                <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: 'text.disabled' }}>
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      {remaining.slice(0, 3).map((s: any, idx: number) => {
                        const mins = stopStartMinutes(s);
                        return (
                          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Typography sx={{
                              fontFamily: D.display, fontSize: '0.78rem', color: D.terra,
                              width: 36, flexShrink: 0, lineHeight: 1,
                            }}>
                              {mins !== null ? formatTime(mins) : '—'}
                            </Typography>
                            <Typography sx={{
                              fontFamily: D.body, fontSize: '0.84rem', fontWeight: 600,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: D.navy,
                            }}>
                              {s.name}
                            </Typography>
                          </Box>
                        );
                      })}
                      {remaining.length > 3 && (
                        <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: D.muted, mt: 0.25 }}>
                          +{remaining.length - 3} more today
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: D.muted }}>
                      Nothing more scheduled today
                    </Typography>
                  );
                })()
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography sx={{ fontFamily: D.display, fontSize: '1.6rem', color: D.navy, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {totalDays}
                  </Typography>
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted }}>
                    day{totalDays !== 1 ? 's' : ''} planned
                  </Typography>
                  <Typography sx={{ fontFamily: D.display, fontSize: '1.6rem', color: D.navy, letterSpacing: '-0.03em', lineHeight: 1, ml: 1 }}>
                    {totalStops}
                  </Typography>
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted }}>
                    stop{totalStops !== 1 ? 's' : ''}
                  </Typography>
                </Box>
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
              {weatherDay ? (() => {
                const isHistorical = trip.weather?.mode === 'historical';
                const days = trip.weather?.days ?? [];
                const avgHigh = isHistorical && days.length
                  ? Math.round(days.reduce((s, d) => s + d.tempMax, 0) / days.length)
                  : weatherDay.tempMax;
                const avgLow = isHistorical && days.length
                  ? Math.round(days.reduce((s, d) => s + d.tempMin, 0) / days.length)
                  : weatherDay.tempMin;
                const tripMonth = new Date(trip.startDate).toLocaleDateString('en-IE', { month: 'long' });

                return (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ flexShrink: 0, textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '2rem', lineHeight: 1 }}>{weatherDay.icon}</Typography>
                      <Typography sx={{ fontFamily: D.display, fontSize: '1.4rem', color: D.navy, lineHeight: 1, letterSpacing: '-0.03em', mt: 0.5 }}>
                        {avgHigh}°
                      </Typography>
                      <Typography sx={{ fontFamily: D.body, fontSize: '0.7rem', color: D.muted }}>
                        {avgLow}° low
                      </Typography>
                    </Box>

                    <Box sx={{ width: '1px', bgcolor: D.rule, alignSelf: 'stretch', mx: 0.5 }} />

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {isHistorical && (
                        <Typography sx={{ fontFamily: D.body, fontSize: '0.65rem', color: '#C9521B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.3 }}>
                          Historical avg · {tripMonth}
                        </Typography>
                      )}
                      <Typography sx={{ fontFamily: D.display, fontSize: '0.95rem', color: D.navy, lineHeight: 1.2 }}>
                        {isHistorical ? 'Typical conditions' : weatherDay.condition}
                      </Typography>
                      {trip.weather?.summary && (
                        <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: D.muted, mt: 0.5 }}>
                          {trip.weather.summary}
                        </Typography>
                      )}
                      {trip.weather?.packingNotes?.[0] && (
                        <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: D.green, fontWeight: 600, mt: 0.4 }}>
                          {isHistorical
                            ? trip.weather.packingNotes[0]
                                .replace('Rain expected on', 'Historically rains on')
                                .replace('One rainy day expected', 'Typically one rainy day')
                            : trip.weather.packingNotes[0]}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })() : trip.weather?.summary ? (
                <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: D.muted }}>{trip.weather.summary}</Typography>
              ) : (
                <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: 'text.disabled' }}>No forecast data yet</Typography>
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
                <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: 'text.disabled' }}>
                  No list generated yet — tap to create one
                </Typography>
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
                    <Typography sx={{ fontFamily: D.display, fontSize: '1.6rem', color: packPct === 100 ? 'success.main' : D.navy, letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {packPct}%
                    </Typography>
                    <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted }}>
                      packed · {packedItems} of {items.length} items
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={packPct} sx={{
                    height: 5, borderRadius: 3, backgroundColor: D.rule,
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
                        <Typography sx={{ fontFamily: D.display, fontSize: '0.85rem', color: D.navy, mr: 0.5 }}>{c.name}</Typography>
                        <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: D.muted, mr: 'auto', textTransform: 'capitalize' }}>
                          {c.type?.replace(/_/g, ' ')}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, flexWrap: 'wrap' }}>
                          {c.phone && (
                            <Button component="a" href={`tel:${c.phone}`} size="small" startIcon={<PhoneIcon sx={{ fontSize: '0.85rem !important' }} />}
                              variant="outlined" onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              sx={{ fontSize: '0.72rem', fontFamily: D.body, fontWeight: 700, py: 0.35, px: 0.9, minHeight: 28, borderColor: alpha(D.green, 0.4), color: D.green, '&:hover': { borderColor: D.green, backgroundColor: alpha(D.green, 0.06) } }}>
                              Call
                            </Button>
                          )}
                          {c.phone && (
                            <Button component="a" href={`sms:${c.phone}`} size="small" startIcon={<SmsIcon sx={{ fontSize: '0.85rem !important' }} />}
                              variant="outlined" onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              sx={{ fontSize: '0.72rem', fontFamily: D.body, fontWeight: 700, py: 0.35, px: 0.9, minHeight: 28, borderColor: alpha('#64748b', 0.4), color: '#64748b', '&:hover': { borderColor: '#64748b', backgroundColor: alpha('#64748b', 0.06) } }}>
                              SMS
                            </Button>
                          )}
                          {c.phone && (
                            <Button component="a" href={`https://wa.me/${toDialDigits(c.phone)}`}
                              target="_blank" rel="noopener noreferrer" size="small"
                              startIcon={<WhatsAppIcon sx={{ fontSize: '0.85rem !important' }} />}
                              variant="outlined" onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              sx={{ fontSize: '0.72rem', fontFamily: D.body, fontWeight: 700, py: 0.35, px: 0.9, minHeight: 28, borderColor: alpha('#25D366', 0.5), color: '#25D366', '&:hover': { borderColor: '#25D366', backgroundColor: alpha('#25D366', 0.06) } }}>
                              WA
                            </Button>
                          )}
                          {c.email && (
                            <Button component="a" href={`mailto:${c.email}`} size="small" startIcon={<EmailIcon sx={{ fontSize: '0.85rem !important' }} />}
                              variant="outlined" onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              sx={{ fontSize: '0.72rem', fontFamily: D.body, fontWeight: 700, py: 0.35, px: 0.9, minHeight: 28, borderColor: alpha('#0891b2', 0.4), color: '#0891b2', '&:hover': { borderColor: '#0891b2', backgroundColor: alpha('#0891b2', 0.06) } }}>
                              Email
                            </Button>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}

                {contacts.length > 0 && (keyLinks.length > 0 || docCount > 0 || notes.length > 0) && (
                  <Divider sx={{ borderColor: D.rule }} />
                )}

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
                        sx={{ fontSize: '0.72rem', fontFamily: D.body, fontWeight: 600, height: 24 }}
                      />
                    ))}
                  </Box>
                )}

                {/* ── Ticket / document quick-access cards ── */}
                {ticketFiles.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {ticketFiles.map((f: any) => {
                      const TicketIcon = TICKET_ICONS[f.type] ?? FlightIcon;
                      return (
                        <Box
                          key={f._id}
                          onClick={() => setViewerFile({ _id: f._id, name: f.name, mimeType: f.mimeType, gcsUrl: f.gcsUrl })}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1.25,
                            px: 1.5, py: 1,
                            borderRadius: '8px',
                            border: '1px solid rgba(8,145,178,0.2)',
                            backgroundColor: 'rgba(8,145,178,0.04)',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s',
                            '&:hover': { backgroundColor: 'rgba(8,145,178,0.09)' },
                          }}
                        >
                          <TicketIcon sx={{ fontSize: 16, color: '#0891b2', flexShrink: 0 }} />
                          <Typography sx={{
                            fontFamily: D.body, fontWeight: 700, fontSize: '0.82rem',
                            color: D.navy, flex: 1,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {f.name}
                          </Typography>
                          <VisibilityIcon sx={{ fontSize: 14, color: '#0891b2', flexShrink: 0 }} />
                        </Box>
                      );
                    })}
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  {docCount > ticketFiles.length && (
                    <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted }}>
                      {docCount - ticketFiles.length} other document{docCount - ticketFiles.length !== 1 ? 's' : ''}
                    </Typography>
                  )}
                  {notes.length > 0 && (
                    <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted }}>
                      {notes.length} note{notes.length !== 1 ? 's' : ''}
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
              <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: 'text.disabled' }}>
                No contacts, notes, links or documents yet
              </Typography>
            </Strip>
          )}

          {/* ── Before you go (pairs with Resources in the grid) ── */}
          {['idea', 'planning', 'confirmed'].includes(trip.status) && daysUntil > 0 && trip.destination.countryCode && (
            <PreTripAppsCard
              countryCode={trip.destination.countryCode}
              cityName={trip.destination.city}
            />
          )}

          {/* ── Dismissed row ── */}
          {dismissed.length > 0 && (
            <Box sx={{ gridColumn: { md: '1 / -1' }, display: 'flex', alignItems: 'center', gap: 1, px: 0.5 }}>
              <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: D.muted, flexGrow: 1 }}>
                {dismissed.length} section{dismissed.length !== 1 ? 's' : ''} hidden
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
                sx={{ fontFamily: D.body, fontSize: '0.72rem', color: D.muted, py: 0.25 }}
              >
                Restore all
              </Button>
            </Box>
          )}

        </>
      )}

    </Box>
      </Box>
      <DocumentViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </>
  );
}