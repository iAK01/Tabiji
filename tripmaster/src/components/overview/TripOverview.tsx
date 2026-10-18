'use client';

import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, CircularProgress,
  LinearProgress, IconButton,
} from '@mui/material';
import ChevronRightIcon         from '@mui/icons-material/ChevronRight';
import FlightIcon               from '@mui/icons-material/Flight';
import BackpackIcon             from '@mui/icons-material/Backpack';
import WbSunnyIcon              from '@mui/icons-material/WbSunny';
import FolderOpenIcon           from '@mui/icons-material/FolderOpen';
import MapIcon                  from '@mui/icons-material/Map';
import UndoIcon                 from '@mui/icons-material/Undo';
import RefreshIcon              from '@mui/icons-material/Refresh';
import DocumentViewer, { type ViewableFile } from '@/components/files/DocumentViewer';
import PreTripAppsCard from '@/components/overview/PreTripAppsCard';
import { saveTripCache, getTripCache } from '@/lib/offline/db';
import { sendOrQueue, savedTripPatch } from '@/lib/offline/writes';
import { assertSaved, reportSaveFailure } from '@/lib/offline/saveErrors';
import { totalFreeMinutes, freeLabelText } from '@/components/itinerary/Itinerary.helpers';
import { getLogisticsFacts } from '@/lib/logistics/facts';
import { getTransportLabel } from '@/components/logistics/logistics.helpers';
import { displayStatus, localYmd } from '@/lib/trips/onTrip';
import { OnTripNow, OnTripGetAround } from '@/components/trips/OnTripScreen';
import { summaryLine, wearHeadline, weatherHeadline, type WeatherResult } from '@/lib/weather-insights';
import { packingCounts } from '@/lib/packing/counts';

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
    origin:           { city: string; country: string; countryCode?: string; timezone?: string; iataCode?: string };
    destination:      { city: string; country: string; countryCode?: string; timezone?: string; iataCode?: string };
    additionalDestinations?: Array<{ city: string; country?: string; countryCode?: string; timezone?: string; arrivalDate?: string; departureDate?: string }>;
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
    weather?: WeatherResult;
  };
  coverPhotoUrl?:    string;
  coverPhotoCredit?: string;
  onNavigate: (tab: number) => void;
  onRefreshPhoto?: () => void;
  tabsSlot?:       React.ReactNode;
}

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

export default function TripOverview({ trip, coverPhotoUrl, coverPhotoCredit, onNavigate, onRefreshPhoto, tabsSlot }: Props) {
  const [logistics,    setLogistics]    = useState<any>(null);
  const [packing,      setPacking]      = useState<any>(null);
  const [itinerary,    setItinerary]    = useState<any>(null);
  const [resources,    setResources]    = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [dismissed,    setDismissed]    = useState<string[]>(trip.dismissedChecks ?? []);
  const [viewerFile,   setViewerFile]   = useState<ViewableFile | null>(null);

  // Shows the change at once; puts the hidden sections back if it doesn't save.
  const saveDismissed = async (checks: string[]) => {
    const before = dismissed;
    setDismissed(checks);
    try {
      const res = await sendOrQueue(
        { type: 'UPDATE_TRIP', tripId: trip._id, payload: { dismissedChecks: checks } },
        () => fetch(`/api/trips/${trip._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dismissedChecks: checks }),
        }),
        savedTripPatch(trip._id, { dismissedChecks: checks }),
      );
      if (res) assertSaved(res);
    } catch (err) {
      setDismissed(before);
      reportSaveFailure('the restored sections', err);
    }
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
  // Whole days between local midnights, rounded so a clock change can't add or drop one.
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const departure = new Date(trip.startDate); departure.setHours(0, 0, 0, 0);
  const lastDay   = new Date(trip.endDate);   lastDay.setHours(0, 0, 0, 0);
  const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
  const daysUntil = daysBetween(today, departure);
  const isPast    = today > lastDay;
  const isToday   = daysUntil === 0;
  const isActive  = !isPast && today >= departure;

  // On-trip, the Now card counts down to the minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isActive) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [isActive]);

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
  const packCounts    = packingCounts(items);
  const packedItems   = packCounts.packed;
  const packPct       = packCounts.progress;
  const preTravelItems = items.filter((i: any) => !i.packed && !i.skipped && i.preTravelAction);

  const avgStops     = totalDays > 0 ? totalStops / totalDays : 0;
  const scheduleDesc = avgStops >= 6 ? 'Packed schedule' : avgStops >= 4 ? 'Busy schedule' : avgStops >= 2 ? 'Balanced schedule' : 'Light schedule';

  // Top 3 days with the most unscheduled time — same gap logic as the timeline chip
  const freeDays: { dateLabel: string; freeLabel: string; mins: number }[] = (itinerary?.days ?? [])
    .filter((d: any) => d.date && (d.stops?.length ?? 0) > 0)
    .map((d: any) => ({
      dateLabel: new Date(d.date.split('T')[0] + 'T12:00:00').toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' }),
      freeLabel: freeLabelText((d.stops ?? []).filter((s: any) => !s.skipped)),
      mins:      totalFreeMinutes((d.stops ?? []).filter((s: any) => !s.skipped)) as number,
    }))
    .sort((a: { mins: number }, b: { mins: number }) => b.mins - a.mins)
    .slice(0, 3);

  const packingStatus: 'ok' | 'warn' | 'empty' =
    items.length === 0 ? 'empty' :
    packPct === 100 ? 'ok' :
    daysUntil <= 3 ? 'warn' : 'empty';

  // ── Weather ───────────────────────────────────────────────────────────────
  // Same reads as the Weather tab: now if fresh, else today's (or day one's) high.
  const weather       = trip.weather?.days?.length ? trip.weather : null;
  const weatherDay    = weatherHeadline(weather);
  const isHistorical  = weather?.mode === 'historical';
  const weatherDays   = weather?.days ?? [];
  const weatherSpan   = (xs: number[]) => {
    const lo = Math.min(...xs), hi = Math.max(...xs);
    return lo === hi ? `${lo}` : `${lo}–${hi}`;
  };
  const weatherSummary = summaryLine(weatherDays);
  const weatherWear    = weather ? wearHeadline(weather) : null;
  const tripMonth = new Date(trip.startDate).toLocaleDateString('en-IE', { month: 'long' });

  // ── Resources ─────────────────────────────────────────────────────────────
  const contacts   = resources.filter(r => r.resourceType === 'contact');
  const notes      = resources.filter(r => r.resourceType === 'note');
  const keyLinks   = resources.filter(r => r.resourceType === 'link' &&
    ['event_website', 'booking_reference', 'venue', 'artist_lineup'].includes(r.type));
  const docCount    = resources.filter(r => r.resourceType === 'file').length;
  const hasResources = contacts.length > 0 || keyLinks.length > 0 || docCount > 0 || notes.length > 0;

  // ── Countdown label ───────────────────────────────────────────────────────
  const currentDayNum   = isActive ? daysBetween(departure, today) + 1 : null;
  const tripTotalDays   = isActive ? daysBetween(departure, lastDay) + 1 : null;

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
                {weatherDay.temp}°
              </Typography>
              <Typography sx={{
                fontFamily: D.body, fontSize: '0.6rem', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.6)',
                textShadow: '0 1px 4px rgba(0,0,0,0.7)',
              }}>
                {weatherDay.kind === 'now' ? 'Now · ' : weatherDay.kind === 'typical' ? 'Typical · ' : ''}{weatherDay.condition}
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
                  Packing · {packedItems} of {packCounts.total}
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

          {isActive && !loading && (
            <OnTripNow
              tripId={trip._id}
              days={itinerary?.days ?? []}
              files={resources}
              now={now}
              onFilesChange={setResources}
              onOpenFile={f => setViewerFile({ _id: f._id, name: f.name, mimeType: f.mimeType, gcsUrl: f.gcsUrl })}
            />
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
                          const todayStr   = localYmd();
                          const todayDay   = itinerary.days.find((d: any) => String(d.date).slice(0, 10) === todayStr);
                          const todayStops = (todayDay?.stops ?? []).filter((s: any) => !s.skipped);
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
              {weather && weatherDay && !dismissed.includes('weather') && (
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
                            {weatherDay.temp}°
                          </Typography>
                          <Box>
                            <Typography sx={{ fontFamily: D.display, fontSize: { xs: '0.9rem', md: '1.15rem' }, color: D.navy, lineHeight: 1.2 }}>
                              {weatherDay.kind === 'now' ? `Now · ${weatherDay.condition}` : isHistorical ? 'Typical conditions' : weatherDay.condition}
                            </Typography>
                            <Typography sx={{ fontFamily: D.body, fontSize: { xs: '0.72rem', md: '0.8rem' }, color: D.muted }}>
                              Highs {weatherSpan(weatherDays.map(d => d.tempMax))}° · lows {weatherSpan(weatherDays.map(d => d.tempMin))}°{isHistorical && ` · typical for ${tripMonth}`}
                            </Typography>
                          </Box>
                        </Box>
                        {weatherSummary && (
                          <Typography sx={{ fontFamily: D.body, fontSize: { xs: '0.8rem', md: '0.9rem' }, color: D.muted, mt: 1, lineHeight: 1.6 }}>
                            {weatherSummary}
                          </Typography>
                        )}
                        {weatherWear && (
                          <Typography sx={{ fontFamily: D.body, fontSize: { xs: '0.78rem', md: '0.88rem' }, color: D.green, fontWeight: 600, mt: 0.5 }}>
                            {weatherWear}
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
                              {packedItems} of {packCounts.total} items
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
              {['idea', 'planning', 'confirmed'].includes(displayStatus(trip) ?? '') && daysUntil > 0 && trip.destination.countryCode && (
                <Box sx={{ gridColumn: { md: '1 / -1' } }}>
                  <PreTripAppsCard
                    countryCode={trip.destination.countryCode}
                    cityName={trip.destination.city}
                  />
                </Box>
              )}

              {/* ── ON-TRIP GET AROUND + MY APPS ── full width */}
              {isActive && (
                <Box sx={{ gridColumn: { md: '1 / -1' }, pt: { xs: 3, md: 4 } }}>
                  <OnTripGetAround trip={trip} transportation={logistics?.transportation ?? []} now={now} />
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
                    onClick={() => saveDismissed([])}
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