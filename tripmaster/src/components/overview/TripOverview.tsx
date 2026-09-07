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
import { totalFreeMinutes, freeLabelText } from '@/components/itinerary/Itinerary.helpers';
import { getLogisticsFacts } from '@/lib/logistics/facts';
import { getTransportLabel } from '@/components/logistics/logistics.helpers';

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

interface GroundTransportLeg {
  status:     'sorted' | 'gap' | 'no_data' | 'not_applicable';
  firstStop?: { name: string; address?: string };
  steps?:     { label: string; description: string; method?: string; searchTerms?: string | null; estimatedDuration?: string | null }[];
  isMultiCity?: boolean;
  sortedDetail?: string;
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
    groundTransport?: {
      preDeparture?:  GroundTransportLeg;
      arrivalLeg?:    GroundTransportLeg;
      returnLeg?:     GroundTransportLeg;
      homeCloseout?:  GroundTransportLeg;
    } | null;
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
  onRefreshPhoto?: () => void;
  tabsSlot?:       React.ReactNode;
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

const SectionTag = ({ children, color = D.muted, icon }: { children: React.ReactNode; color?: string; icon?: React.ReactNode }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
    {icon && <Box sx={{ color, display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</Box>}
    <Typography sx={{
      fontFamily: D.body, fontSize: '0.72rem', fontWeight: 700,
      letterSpacing: '0.10em', textTransform: 'uppercase',
      color,
    }}>
      {children}
    </Typography>
  </Box>
);

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
  // Single shared source of truth — the same function the dashboard's readiness
  // panel uses, so the two screens can never disagree about what's outstanding.
  const facts = getLogisticsFacts(logistics, trip, dismissed);
  const outstandingLabels: string[] = [
    ...(facts.transport.hasOutbound ? [] : ['Outbound travel']),
    ...(facts.transport.hasReturn   ? [] : ['Return travel']),
    ...facts.transport.unconfirmed.map((t: any) => getTransportLabel(t)),
    ...(facts.accommodation.nightsMissing > 0
      ? [`${facts.accommodation.nightsMissing} night${facts.accommodation.nightsMissing === 1 ? '' : 's'} accommodation`]
      : []),
    ...facts.accommodation.unconfirmed.map((a: any) => a.name || 'Accommodation'),
    ...facts.venues.unconfirmed.map((v: any) => v.name || 'Venue'),
    ...facts.groundGaps,
  ];
  const outstandingCount = outstandingLabels.length;

  // ── Itinerary ─────────────────────────────────────────────────────────────
  const totalStops = itinerary?.days?.reduce((acc: number, d: any) => acc + (d.stops?.length ?? 0), 0) ?? 0;
  const totalDays  = itinerary?.days?.filter((d: any) => d.stops?.length > 0).length ?? 0;

  // ── Packing ───────────────────────────────────────────────────────────────
  const items         = packing?.items ?? [];
  const packedItems   = items.filter((i: any) => i.packed).length;
  const packPct       = items.length > 0 ? Math.round((packedItems / items.length) * 100) : 0;
  const preTravelItems = items.filter((i: any) => !i.packed && i.preTravelAction);

  const avgStops     = totalDays > 0 ? totalStops / totalDays : 0;
  const scheduleDesc = avgStops >= 6 ? 'Packed schedule' : avgStops >= 4 ? 'Busy schedule' : avgStops >= 2 ? 'Balanced schedule' : 'Light schedule';

  // Top 3 days with the most unscheduled time — same gap logic as the timeline chip
  const freeDays: { dateLabel: string; freeLabel: string; mins: number }[] = (itinerary?.days ?? [])
    .filter((d: any) => d.date && (d.stops?.length ?? 0) > 0)
    .map((d: any) => ({
      dateLabel: new Date(d.date.split('T')[0] + 'T12:00:00').toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' }),
      freeLabel: freeLabelText(d.stops ?? []),
      mins:      totalFreeMinutes(d.stops ?? []) as number,
    }))
    .sort((a: { mins: number }, b: { mins: number }) => b.mins - a.mins)
    .slice(0, 3);

  const packingStatus: 'ok' | 'warn' | 'empty' =
    items.length === 0 ? 'empty' :
    packPct === 100 ? 'ok' :
    daysUntil <= 3 ? 'warn' : 'empty';

  // ── Weather ───────────────────────────────────────────────────────────────
  // currentWeather is always today's live conditions — prefer it over trip forecast/historical
  const currentWeatherDay = trip.weather?.currentWeather?.[0] ?? null;
  const weatherDay        = currentWeatherDay ?? trip.weather?.days?.[0] ?? null;
  const isLiveWeather     = !!currentWeatherDay;

  const isHistorical = trip.weather?.mode === 'historical';
  const weatherDays: WeatherDay[] = trip.weather?.days ?? [];
  const displayHigh = isHistorical && weatherDays.length
    ? Math.round(weatherDays.reduce((s, d) => s + d.tempMax, 0) / weatherDays.length)
    : weatherDay?.tempMax ?? 0;
  const displayLow = isHistorical && weatherDays.length
    ? Math.round(weatherDays.reduce((s, d) => s + d.tempMin, 0) / weatherDays.length)
    : weatherDay?.tempMin ?? 0;
  const tripMonth = new Date(trip.startDate).toLocaleDateString('en-IE', { month: 'long' });

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

        {/* Gradient — strong dark band at top (covers AppBar), clear middle, heavy at bottom */}
        <Box sx={{
          position: 'absolute', inset: 0,
          background: coverPhotoUrl
            ? 'linear-gradient(to bottom, rgba(10,16,44,0.82) 0%, rgba(10,16,44,0.45) 18%, rgba(10,16,44,0.05) 38%, rgba(10,16,44,0.78) 65%, rgba(10,16,44,0.98) 100%)'
            : 'none',
        }} />

        {/* Weather — below the AppBar toolbar (~60px down) */}
        {weatherDay && (
          <Box sx={{
            position: 'absolute', top: { xs: 62, md: 66 }, left: { xs: 20, md: 28 },
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.2rem' }, lineHeight: 1 }}>
              {weatherDay.icon}
            </Typography>
            <Box>
              <Typography sx={{
                fontFamily: D.display, fontSize: { xs: '1.6rem', md: '2rem' },
                color: 'white', lineHeight: 1, letterSpacing: '-0.03em',
                textShadow: '0 2px 12px rgba(0,0,0,0.7)',
              }}>
                {Math.round(weatherDay.tempAvg)}°
              </Typography>
              <Typography sx={{
                fontFamily: D.body, fontSize: '0.6rem', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.6)',
                textShadow: '0 1px 4px rgba(0,0,0,0.7)',
              }}>
                {isLiveWeather ? 'Now · ' : trip.weather?.mode === 'historical' ? 'Avg · ' : ''}{weatherDay.condition}
              </Typography>
            </Box>
          </Box>
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
                {trip.nights > 0 && ` · ${trip.nights} night${trip.nights === 1 ? '' : 's'}`}
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

        {/* Refresh photo */}
        {onRefreshPhoto && (
          <IconButton onClick={onRefreshPhoto} size="small" sx={{
            position: 'absolute', bottom: { xs: 52, md: 60 }, right: 14,
            color: 'rgba(255,255,255,0.55)',
            bgcolor: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(6px)',
            '&:hover': { color: 'white', bgcolor: 'rgba(0,0,0,0.45)' },
          }}>
            <RefreshIcon sx={{ fontSize: 15 }} />
          </IconButton>
        )}

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

      {/* ── Editorial overview ── */}
      <Box sx={{ bgcolor: D.bg, pt: { xs: 3, md: 4 }, pb: 10 }}>
        <Box sx={{ maxWidth: '1200px', mx: 'auto', px: { xs: 2.5, sm: 4 } }}>

          {/* What's Next */}
          {isActive && nextStop && (
            <Paper elevation={0} sx={{
              mb: 3, overflow: 'hidden',
              border: '1.5px solid',
              borderColor: isUrgent ? 'rgba(237,108,2,0.5)' : 'rgba(107,124,92,0.4)',
              borderRadius: '12px',
            }}>
              <Box sx={{ height: 4, background: isUrgent ? 'linear-gradient(90deg, #ed6c02, #fbbf24)' : 'linear-gradient(90deg, #6B7C5C, #9aad89)' }} />
              <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ minWidth: 0 }}>
                  <SectionTag color={isUrgent ? '#ed6c02' : D.green}>
                    {isUrgent ? `Starting in ${minsUntilNext} min` : `Next up · ${nextStartMins !== null ? formatTime(nextStartMins) : ''}`}
                  </SectionTag>
                  <Typography sx={{ fontFamily: D.display, fontSize: '1.4rem', color: D.navy, lineHeight: 1.1, letterSpacing: '-0.02em', mt: 0.5 }}>
                    {nextStop.name}
                  </Typography>
                  {nextStop.reference && (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', mt: 0.75, px: 1.25, py: 0.4, borderRadius: '6px', backgroundColor: 'rgba(3,105,161,0.10)', border: '1.5px solid rgba(3,105,161,0.3)' }}>
                      <Typography sx={{ fontFamily: D.body, fontSize: '0.9rem', fontWeight: 800, color: '#0369a1', letterSpacing: '0.03em', lineHeight: 1.3 }}>
                        {nextStop.reference}
                      </Typography>
                    </Box>
                  )}
                  {nextStop.address && (
                    <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted, mt: 0.5 }}>{nextStop.address}</Typography>
                  )}
                  {nextStop.notes && (
                    <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: D.muted, mt: 0.4, fontStyle: 'italic' }}>{nextStop.notes}</Typography>
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
            <Box sx={{ mb: 3, p: 2.5, border: '1.5px solid rgba(107,124,92,0.4)', borderRadius: '12px', bgcolor: 'rgba(107,124,92,0.04)' }}>
              <Typography sx={{ fontFamily: D.display, fontSize: '0.9rem', color: D.green }}>Nothing more scheduled today</Typography>
              <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted, mt: 0.4 }}>Check the itinerary tab for tomorrow.</Typography>
            </Box>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={26} />
            </Box>
          ) : (
            <Box sx={{
              display: { xs: 'block', md: 'grid' },
              gridTemplateColumns: { md: '1fr 1fr' },
            }}>

              {/* ── LOGISTICS ── */}
              {!dismissed.includes('logistics') && (
                <Box sx={{
                  borderBottom: `1px solid ${D.rule}`,
                  borderRight: { md: `1px solid ${D.rule}` },
                  pr: { md: 6 },
                }}>
                  <Box
                    onClick={() => onNavigate(1)}
                    sx={{ py: { xs: 2.5, md: 3.5 }, display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', transition: 'opacity 0.15s', '&:hover': { opacity: 0.7 } }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <SectionTag icon={<FlightIcon sx={{ fontSize: 14 }} />}>Logistics</SectionTag>
                      <Box sx={{ mt: 0.75 }}>
                        <Typography sx={{
                          fontFamily: D.display, fontSize: { xs: '3rem', md: '4rem' },
                          lineHeight: 1, letterSpacing: '-0.04em',
                          color: outstandingCount === 0 ? '#22c55e' : (daysUntil >= 0 && daysUntil <= 14) ? '#f59e0b' : D.navy,
                        }}>
                          {outstandingCount === 0 ? 'Sorted' : outstandingCount}
                        </Typography>
                        <Typography sx={{
                          fontFamily: D.body, fontSize: '0.62rem', fontWeight: 700,
                          letterSpacing: '0.14em', textTransform: 'uppercase',
                          color: D.muted, mt: 0.5,
                        }}>
                          {outstandingCount === 0 ? 'All confirmed' : `Thing${outstandingCount === 1 ? '' : 's'} to sort`}
                        </Typography>
                        {outstandingLabels.length > 0 && (
                          <Box sx={{ mt: 1.25, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                            {outstandingLabels.map((label, i) => (
                              <Typography key={i} sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted, lineHeight: 1.5 }}>
                                · {label}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Box>
                    <ChevronRightIcon sx={{ fontSize: 20, color: 'rgba(29,38,66,0.2)', flexShrink: 0 }} />
                  </Box>
                </Box>
              )}

              {/* ── ITINERARY ── right col on desktop */}
              {!dismissed.includes('itinerary') && (
                <Box sx={{ borderBottom: `1px solid ${D.rule}`, pl: { md: 6 } }}>
                  <Box
                    onClick={() => onNavigate(2)}
                    sx={{ py: { xs: 2.5, md: 3.5 }, display: 'flex', alignItems: 'flex-start', gap: 2, cursor: 'pointer', transition: 'opacity 0.15s', '&:hover': { opacity: 0.7 } }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <SectionTag icon={<MapIcon sx={{ fontSize: 14 }} />}>Itinerary</SectionTag>
                      {totalStops === 0 ? (
                        <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: 'text.disabled', mt: 0.75 }}>
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
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.75 }}>
                              {remaining.slice(0, 3).map((s: any, idx: number) => {
                                const mins = stopStartMinutes(s);
                                return (
                                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <Typography sx={{ fontFamily: D.display, fontSize: '0.78rem', color: D.terra, width: 36, flexShrink: 0, lineHeight: 1 }}>
                                      {mins !== null ? formatTime(mins) : '—'}
                                    </Typography>
                                    <Typography sx={{ fontFamily: D.body, fontSize: '0.84rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: D.navy }}>
                                      {s.name}
                                    </Typography>
                                  </Box>
                                );
                              })}
                              {remaining.length > 3 && (
                                <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: D.muted }}>
                                  +{remaining.length - 3} more today
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: D.muted, mt: 0.75 }}>
                              Nothing more scheduled today
                            </Typography>
                          );
                        })()
                      ) : (
                        <Box sx={{ mt: 0.75 }}>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                            <Typography sx={{ fontFamily: D.display, fontSize: { xs: '2.2rem', md: '3rem' }, color: D.navy, letterSpacing: '-0.03em', lineHeight: 1 }}>
                              {totalDays}
                            </Typography>
                            <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted }}>
                              day{totalDays !== 1 ? 's' : ''}
                            </Typography>
                            <Typography sx={{ fontFamily: D.display, fontSize: { xs: '2.2rem', md: '3rem' }, color: D.navy, letterSpacing: '-0.03em', lineHeight: 1, ml: 1 }}>
                              {totalStops}
                            </Typography>
                            <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted }}>
                              stop{totalStops !== 1 ? 's' : ''}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', fontWeight: 600, color: D.muted, mt: 0.5, letterSpacing: '0.01em' }}>
                            {scheduleDesc}
                          </Typography>
                          {freeDays.length > 0 && !isPast && (
                            <Box sx={{ mt: 1 }}>
                              {freeDays.map((fd, i) => (
                                <Box key={i} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.4 }}>
                                  <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.navy, fontWeight: 600, minWidth: 100, flexShrink: 0 }}>
                                    {fd.dateLabel}
                                  </Typography>
                                  <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted }}>
                                    {fd.freeLabel}
                                  </Typography>
                                </Box>
                              ))}
                              <Typography
                                component="div"
                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onNavigate(4); }}
                                sx={{ fontFamily: D.body, fontSize: '0.78rem', fontWeight: 700, color: D.terra, cursor: 'pointer', mt: 1 }}
                              >
                                Find something to do → Discover
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                    <ChevronRightIcon sx={{ fontSize: 20, color: 'rgba(29,38,66,0.2)', flexShrink: 0, mt: 2.5 }} />
                  </Box>
                </Box>
              )}

              {/* ── WEATHER ── full width on desktop */}
              {trip.weather && weatherDay && !dismissed.includes('weather') && (
                <Box sx={{
                  gridColumn: { md: '1 / -1' },
                  borderBottom: `1px solid ${D.rule}`,
                  borderTop: { md: `1px solid ${D.rule}` },
                }}>
                  <Box
                    onClick={() => onNavigate(5)}
                    sx={{ py: { xs: 2.5, md: 3.5 }, cursor: 'pointer', transition: 'opacity 0.15s', '&:hover': { opacity: 0.7 } }}
                  >
                    <SectionTag icon={<WbSunnyIcon sx={{ fontSize: 14 }} />}>Weather</SectionTag>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 2, md: 4 }, mt: 1 }}>
                      <Typography sx={{ fontSize: { xs: '2.2rem', md: '3.5rem' }, lineHeight: 1, flexShrink: 0 }}>
                        {weatherDay.icon}
                      </Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
                          <Typography sx={{
                            fontFamily: D.display, fontSize: { xs: '2.8rem', md: '4.5rem' },
                            lineHeight: 1, letterSpacing: '-0.04em', color: D.navy,
                          }}>
                            {Math.round(weatherDay.tempAvg)}°
                          </Typography>
                          <Box>
                            <Typography sx={{ fontFamily: D.display, fontSize: { xs: '0.9rem', md: '1.15rem' }, color: D.navy, lineHeight: 1.2 }}>
                              {isHistorical ? 'Typical conditions' : weatherDay.condition}
                            </Typography>
                            <Typography sx={{ fontFamily: D.body, fontSize: { xs: '0.72rem', md: '0.8rem' }, color: D.muted }}>
                              {displayLow}° low · {displayHigh}° high{isHistorical && ` · Historical avg · ${tripMonth}`}
                            </Typography>
                          </Box>
                        </Box>
                        {trip.weather?.summary && (
                          <Typography sx={{ fontFamily: D.body, fontSize: { xs: '0.8rem', md: '0.9rem' }, color: D.muted, mt: 1, lineHeight: 1.6 }}>
                            {trip.weather.summary}
                          </Typography>
                        )}
                        {trip.weather?.packingNotes?.[0] && (
                          <Typography sx={{ fontFamily: D.body, fontSize: { xs: '0.78rem', md: '0.88rem' }, color: D.green, fontWeight: 600, mt: 0.5 }}>
                            {isHistorical
                              ? trip.weather.packingNotes[0].replace('Rain expected on', 'Historically rains on').replace('One rainy day expected', 'Typically one rainy day')
                              : trip.weather.packingNotes[0]}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              )}

              {/* ── PACKING ── left col on desktop */}
              {!dismissed.includes('packing') && (
                <Box sx={{
                  borderBottom: `1px solid ${D.rule}`,
                  borderRight: { md: `1px solid ${D.rule}` },
                  pr: { md: 6 },
                }}>
                  <Box
                    onClick={() => onNavigate(3)}
                    sx={{ py: { xs: 2.5, md: 3.5 }, display: 'flex', alignItems: 'flex-start', gap: 2, cursor: 'pointer', transition: 'opacity 0.15s', '&:hover': { opacity: 0.7 } }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <SectionTag icon={<BackpackIcon sx={{ fontSize: 14 }} />}>Packing</SectionTag>
                      {items.length === 0 ? (
                        <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: 'text.disabled', mt: 0.75 }}>
                          No list generated yet — tap to create one
                        </Typography>
                      ) : (
                        <Box sx={{ mt: 0.75 }}>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
                            <Typography sx={{
                              fontFamily: D.display, fontSize: { xs: '3rem', md: '4rem' },
                              lineHeight: 1, letterSpacing: '-0.04em',
                              color: packPct === 100 ? '#22c55e' : packingStatus === 'warn' ? '#f59e0b' : D.navy,
                            }}>
                              {packPct}%
                            </Typography>
                            <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted }}>
                              {packedItems} of {items.length} items
                            </Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={packPct} sx={{
                            mt: 1.5, height: 3, borderRadius: 2,
                            backgroundColor: 'rgba(29,38,66,0.08)',
                            '& .MuiLinearProgress-bar': { borderRadius: 2, backgroundColor: packPct === 100 ? '#22c55e' : D.navy },
                          }} />
                          {preTravelItems.length > 0 && packPct < 100 && (() => {
                            const toCharge = preTravelItems.filter((i: any) => i.preTravelNote?.toLowerCase().includes('charge'));
                            const toAction = preTravelItems.filter((i: any) => !i.preTravelNote?.toLowerCase().includes('charge'));
                            return (
                              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {toCharge.length > 0 && (
                                  <Box>
                                    <Typography sx={{ fontFamily: D.body, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#b45309', mb: 0.4 }}>
                                      Charge before packing
                                    </Typography>
                                    <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: D.muted, lineHeight: 1.7 }}>
                                      {toCharge.map((i: any) => i.name).join('  ·  ')}
                                    </Typography>
                                  </Box>
                                )}
                                {toAction.length > 0 && (
                                  <Box>
                                    <Typography sx={{ fontFamily: D.body, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: D.muted, mb: 0.4 }}>
                                      Before you go
                                    </Typography>
                                    <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: D.muted, lineHeight: 1.7 }}>
                                      {toAction.map((i: any) => i.name).join('  ·  ')}
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                            );
                          })()}
                        </Box>
                      )}
                    </Box>
                    <ChevronRightIcon sx={{ fontSize: 20, color: 'rgba(29,38,66,0.2)', flexShrink: 0, mt: 2.5 }} />
                  </Box>
                </Box>
              )}

              {/* ── RESOURCES ── right col on desktop */}
              {hasResources && !dismissed.includes('resources') && (
                <Box sx={{ borderBottom: `1px solid ${D.rule}`, pl: { md: 6 } }}>
                  <Box
                    onClick={() => onNavigate(7)}
                    sx={{ py: { xs: 2, md: 3.5 }, display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', transition: 'opacity 0.15s', '&:hover': { opacity: 0.7 } }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <SectionTag icon={<FolderOpenIcon sx={{ fontSize: 14 }} />}>Resources</SectionTag>
                      <Typography sx={{ fontFamily: D.body, fontSize: { xs: '0.85rem', md: '1rem' }, color: D.muted, mt: 0.5 }}>
                        {[
                          docCount > 0 && `${docCount} doc${docCount !== 1 ? 's' : ''}`,
                          contacts.length > 0 && `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`,
                          keyLinks.length > 0 && `${keyLinks.length} link${keyLinks.length !== 1 ? 's' : ''}`,
                          notes.length > 0 && `${notes.length} note${notes.length !== 1 ? 's' : ''}`,
                        ].filter(Boolean).join('  ·  ')}
                      </Typography>
                    </Box>
                    <ChevronRightIcon sx={{ fontSize: 20, color: 'rgba(29,38,66,0.2)', flexShrink: 0 }} />
                  </Box>
                </Box>
              )}

              {/* ── BEFORE YOU GO APPS ── full width */}
              {['idea', 'planning', 'confirmed'].includes(trip.status) && daysUntil > 0 && trip.destination.countryCode && (
                <Box sx={{ gridColumn: { md: '1 / -1' } }}>
                  <PreTripAppsCard
                    countryCode={trip.destination.countryCode}
                    cityName={trip.destination.city}
                  />
                </Box>
              )}

              {/* Dismissed row */}
              {dismissed.length > 0 && (
                <Box sx={{ gridColumn: { md: '1 / -1' }, display: 'flex', alignItems: 'center', gap: 1, pt: 3 }}>
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

            </Box>
          )}
        </Box>
      </Box>
      <DocumentViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </>
  );
}