'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Chip, CircularProgress,
  LinearProgress, Divider, Button, alpha, IconButton, Tooltip,
} from '@mui/material';
import CheckCircleIcon           from '@mui/icons-material/CheckCircle';
import WarningAmberIcon          from '@mui/icons-material/WarningAmber';
import RadioButtonUncheckedIcon  from '@mui/icons-material/RadioButtonUnchecked';
import BlockIcon                 from '@mui/icons-material/Block';
import UndoIcon                  from '@mui/icons-material/Undo';
import FlightIcon                from '@mui/icons-material/Flight';
import HotelIcon                 from '@mui/icons-material/Hotel';
import BackpackIcon              from '@mui/icons-material/Backpack';
import LocalParkingIcon          from '@mui/icons-material/LocalParking';
import DirectionsCarIcon         from '@mui/icons-material/DirectionsCar';
import AccessTimeIcon            from '@mui/icons-material/AccessTime';
import TheaterComedyIcon         from '@mui/icons-material/TheaterComedy';
import NavigateButton            from '@/components/ui/NavigateButton';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stopStartMinutes(stop: any): number | null {
  const timeStr = stop.scheduledStart
    ? stop.scheduledStart.includes('T')
      ? stop.scheduledStart.split('T')[1]?.slice(0, 5)
      : stop.scheduledStart
    : stop.time;
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  trip: {
    _id: string;
    name: string;
    tripType: string;
    status: string;
    purpose?: string;
    origin:      { city: string; country: string };
    destination: { city: string; country: string };
    startDate: string;
    endDate:   string;
    nights:    number;
  };
  onNavigate: (tab: number) => void;
}

type StatusLevel = 'ok' | 'warn' | 'empty' | 'info';

interface StatusCard {
  key:      string;           // unique key for dismiss persistence
  icon:     React.ReactNode;
  label:    string;
  value:    string;
  level:    StatusLevel;
  action?:  { label: string; tab: number };
  navDest?: { name?: string; address?: string; coordinates?: { lat: number; lng: number } | null };
}

const LEVEL_COLOR = {
  ok:    'success.main',
  warn:  'warning.dark',
  empty: 'text.disabled',
  info:  'primary.main',
} as const;

const LEVEL_BG = {
  ok:    'rgba(46,125,50,0.06)',
  warn:  'rgba(237,108,2,0.06)',
  empty: 'rgba(0,0,0,0.03)',
  info:  'rgba(29,38,66,0.05)',
} as const;

const LEVEL_BORDER = {
  ok:    'rgba(46,125,50,0.2)',
  warn:  'rgba(237,108,2,0.3)',
  empty: 'rgba(0,0,0,0.08)',
  info:  'rgba(29,38,66,0.15)',
} as const;

// ─── Component ────────────────────────────────────────────────────────────────
export default function TripOverview({ trip, onNavigate }: Props) {
  const [logistics,  setLogistics]  = useState<any>(null);
  const [packing,    setPacking]    = useState<any>(null);
  const [itinerary,  setItinerary]  = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [dismissed,  setDismissed]  = useState<Set<string>>(new Set());

  // Persist dismissed cards per trip in localStorage
  const dismissKey = `tabiji-not-required-${trip._id}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(dismissKey);
      if (stored) setDismissed(new Set(JSON.parse(stored)));
    } catch {}
  }, [dismissKey]);

  const toggleDismiss = useCallback((key: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try { localStorage.setItem(dismissKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, [dismissKey]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/trips/${trip._id}/logistics`).then(r => r.json()),
      fetch(`/api/trips/${trip._id}/packing`).then(r => r.json()),
      fetch(`/api/trips/${trip._id}/itinerary`).then(r => r.json()),
    ]).then(([l, p, it]) => {
      setLogistics(l.logistics);
      setPacking(p.packing ?? p);
      setItinerary(it);
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
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const upcoming = todayDay.stops
        .map((s: any) => ({ ...s, _startMins: stopStartMinutes(s) }))
        .filter((s: any) => s._startMins !== null && s._startMins >= nowMins)
        .sort((a: any, b: any) => a._startMins - b._startMins);
      nextStop = upcoming[0] ?? null;
    }
  }

  // ── Logistics analysis ────────────────────────────────────────────────────
  const flights        = logistics?.transportation?.filter((t: any) => t.type === 'flight') ?? [];
  const noFlights      = flights.length === 0;
  const accommodation  = logistics?.accommodation ?? [];
  const allBooked      = accommodation.length > 0 && accommodation.every((a: any) => a.status === 'confirmed');
  const someBooked     = accommodation.some((a: any) => a.status === 'confirmed');
  const noHotel        = accommodation.length === 0;
  const venues         = logistics?.venues ?? [];
  const noVenues       = venues.length === 0;
  const groundTransport = logistics?.transportation?.filter((t: any) =>
    t.type !== 'flight' && (
      t.notes?.toLowerCase().includes('park') ||
      ['parking', 'taxi', 'transfer', 'bus', 'train', 'car', 'rental'].includes(t.type)
    )
  ) ?? [];

  // ── Packing analysis ──────────────────────────────────────────────────────
  const items       = packing?.items ?? [];
  const totalItems  = items.length;
  const packedItems = items.filter((i: any) => i.packed).length;
  const packPct     = totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0;
  const noList      = totalItems === 0;

  // ── Build status cards ────────────────────────────────────────────────────
  const cards: StatusCard[] = [];

  // Flights
  if (noFlights) {
    cards.push({
      key: 'flights',
      icon: <FlightIcon sx={{ fontSize: 22 }} />,
      label: 'Flights',
      value: 'Not added',
      level: 'empty',
      action: { label: 'Add flight', tab: 1 },
    });
  } else {
    const outFlight = flights[0];
    const retFlight = flights.length > 1 ? flights[flights.length - 1] : null;
    const allConfirmed = flights.every((f: any) => f.status === 'confirmed');
    cards.push({
      key: 'flights',
      icon: <FlightIcon sx={{ fontSize: 22 }} />,
      label: `Flights (${flights.length})`,
      value: allConfirmed
        ? flights.map((f: any) => f.details?.flightNumber ?? f.flightNumber ?? '–').join(' · ') + ' · Confirmed'
        : `${flights.filter((f: any) => f.status === 'confirmed').length} of ${flights.length} confirmed`,
      level: allConfirmed ? 'ok' : 'warn',
      action: !allConfirmed ? { label: 'Update', tab: 1 } : undefined,
    });
  }

  // Accommodation
  if (noHotel) {
    cards.push({
      key: 'accommodation',
      icon: <HotelIcon sx={{ fontSize: 22 }} />,
      label: 'Accommodation',
      value: 'Not added',
      level: 'empty',
      action: { label: 'Add hotel', tab: 1 },
    });
  } else {
    const navAccom = accommodation.find((a: any) => a.status === 'confirmed') ?? accommodation[0];
    cards.push({
      key: 'accommodation',
      icon: <HotelIcon sx={{ fontSize: 22 }} />,
      label: `Accommodation (${accommodation.length})`,
      value: allBooked
        ? accommodation.map((a: any) => a.name).join(', ') + ' · Confirmed'
        : someBooked ? 'Partially confirmed' : 'Not confirmed',
      level: allBooked ? 'ok' : 'warn',
      action: !allBooked ? { label: 'Update', tab: 1 } : undefined,
      navDest: navAccom ? { name: navAccom.name, address: navAccom.address, coordinates: navAccom.coordinates ?? null } : undefined,
    });
  }

  // Venues / events
  if (noVenues) {
    cards.push({
      key: 'venues',
      icon: <TheaterComedyIcon sx={{ fontSize: 22 }} />,
      label: 'Venues / events',
      value: 'None added',
      level: 'empty',
      action: { label: 'Add venue', tab: 1 },
    });
  } else {
    const allVenuesBooked = venues.every((v: any) => v.status === 'confirmed' || v.status === 'booked');
    cards.push({
      key: 'venues',
      icon: <TheaterComedyIcon sx={{ fontSize: 22 }} />,
      label: `Venues / events (${venues.length})`,
      value: venues.map((v: any) => v.name).join(', '),
      level: allVenuesBooked ? 'ok' : 'info',
    });
  }

  // Airport transfer / parking
  if (groundTransport.length === 0) {
    cards.push({
      key: 'transfer',
      icon: <DirectionsCarIcon sx={{ fontSize: 22 }} />,
      label: 'Airport transfer / parking',
      value: 'Not arranged',
      level: 'empty',
      action: { label: 'Add', tab: 1 },
    });
  } else {
    cards.push({
      key: 'transfer',
      icon: <LocalParkingIcon sx={{ fontSize: 22 }} />,
      label: 'Airport transfer / parking',
      value: groundTransport.map((t: any) => t.type).join(', ') + ' · ' +
        (groundTransport[0]?.status === 'confirmed' ? 'Confirmed' : 'Not confirmed'),
      level: groundTransport[0]?.status === 'confirmed' ? 'ok' : 'warn',
    });
  }

  // Packing
  if (noList) {
    cards.push({
      key: 'packing',
      icon: <BackpackIcon sx={{ fontSize: 22 }} />,
      label: 'Packing list',
      value: 'Not generated yet',
      level: 'empty',
      action: { label: 'Generate list', tab: 3 },
    });
  } else {
    cards.push({
      key: 'packing',
      icon: <BackpackIcon sx={{ fontSize: 22 }} />,
      label: 'Packing',
      value: `${packedItems} of ${totalItems} items packed (${packPct}%)`,
      level: packPct === 100 ? 'ok' : daysUntil <= 3 ? 'warn' : 'info',
      action: packPct < 100 ? { label: 'View list', tab: 3 } : undefined,
    });
  }

  // Active cards (not dismissed, or dismissed but we still render them dimmed)
  const urgentItems = cards.filter(c => !dismissed.has(c.key) && c.level === 'warn').length;
  const emptyItems  = cards.filter(c => !dismissed.has(c.key) && c.level === 'empty').length;

  // ── next stop helpers ─────────────────────────────────────────────────────
  const nextStartMins = nextStop ? stopStartMinutes(nextStop) : null;
  const minsUntilNext = nextStartMins !== null
    ? nextStartMins - (new Date().getHours() * 60 + new Date().getMinutes())
    : null;
  const isUrgent = minsUntilNext !== null && minsUntilNext <= 30;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* ── What's Next ── */}
      {isActive && nextStop && (
        <Paper sx={{
          p: { xs: 2, sm: 2.5 },
          backgroundColor: isUrgent ? 'rgba(201,82,27,0.06)' : 'rgba(107,124,92,0.06)',
          border: '2px solid',
          borderColor: isUrgent ? 'warning.main' : 'primary.main',
          borderRadius: 2,
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" fontWeight={700} color={isUrgent ? 'warning.dark' : 'primary.main'}
                sx={{ textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.06em' }}>
                {isUrgent ? `⚡ Starting in ${minsUntilNext}min` : `Next up · ${nextStartMins !== null ? formatTime(nextStartMins) : ''}`}
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
        <Paper sx={{ p: { xs: 2, sm: 2.5 }, backgroundColor: 'rgba(107,124,92,0.06)', border: '1px solid', borderColor: 'primary.light', borderRadius: 2 }}>
          <Typography variant="body2" fontWeight={700} color="primary.main">✅ Nothing more scheduled for today</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Check the itinerary tab for tomorrow.</Typography>
        </Paper>
      )}

      {/* ── Countdown card ── */}
      <Paper sx={{
        p: { xs: 2.5, sm: 3 }, backgroundColor: 'background.paper',
        borderLeft: '4px solid',
        borderLeftColor: isToday ? 'success.main' : isPast ? 'text.disabled' : daysUntil <= 7 ? 'warning.main' : 'primary.main',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AccessTimeIcon color={isToday ? 'success' : isPast ? 'disabled' : 'primary'} />
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1, fontSize: { xs: '2rem', sm: '2.5rem' } }}>
              {isPast ? 'Trip complete' : isToday ? 'Departing today' : `${daysUntil} days to go`}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {new Date(trip.startDate).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' → '}
              {new Date(trip.endDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'long' })}
              {' · '}{trip.nights} nights
            </Typography>
          </Box>
        </Box>
        {!noList && !isPast && (
          <Box sx={{ mt: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Packing progress</Typography>
              <Typography variant="caption" fontWeight={700} color={packPct === 100 ? 'success.main' : 'text.secondary'}>{packPct}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate" value={packPct}
              sx={{
                height: 8, borderRadius: 4, backgroundColor: 'action.hover',
                '& .MuiLinearProgress-bar': { borderRadius: 4, backgroundColor: packPct === 100 ? 'success.main' : 'primary.main' },
              }}
            />
          </Box>
        )}
      </Paper>

      {/* ── Urgency alert ── */}
      {(urgentItems > 0 || emptyItems > 0) && !isPast && (
        <Paper sx={{
          p: { xs: 2, sm: 2.5 },
          backgroundColor: urgentItems > 0 ? 'rgba(237,108,2,0.08)' : 'rgba(29,38,66,0.06)',
          border: '1px solid',
          borderColor: urgentItems > 0 ? 'warning.main' : 'divider',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningAmberIcon sx={{ color: urgentItems > 0 ? 'warning.main' : 'text.secondary', fontSize: 20 }} />
            <Typography variant="body2" fontWeight={700}>
              {urgentItems > 0
                ? `${urgentItems} item${urgentItems > 1 ? 's' : ''} need${urgentItems === 1 ? 's' : ''} attention`
                : `${emptyItems} item${emptyItems > 1 ? 's' : ''} not yet added`}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* ── Trip Status cards ── */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <Box>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5, fontSize: { xs: '1.05rem', sm: '1.15rem' } }}>
            Trip Status
          </Typography>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
          }}>
            {cards.map((card) => {
              const isDismissed = dismissed.has(card.key);
              return (
                <Paper
                  key={card.key}
                  variant="outlined"
                  sx={{
                    p: 2,
                    position: 'relative',
                    backgroundColor: isDismissed ? 'rgba(0,0,0,0.02)' : LEVEL_BG[card.level],
                    borderColor: isDismissed ? 'divider' : LEVEL_BORDER[card.level],
                    opacity: isDismissed ? 0.6 : 1,
                    transition: 'opacity 0.2s, background-color 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.25,
                  }}
                >
                  {/* Card header: icon + label + dismiss toggle */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <Box sx={{ color: isDismissed ? 'text.disabled' : LEVEL_COLOR[card.level], mt: 0.25 }}>
                      {card.icon}
                    </Box>
                    <Typography variant="body2" fontWeight={700} sx={{ flexGrow: 1, fontSize: '0.9rem', lineHeight: 1.3 }}>
                      {card.label}
                    </Typography>
                    <Tooltip title={isDismissed ? 'Mark as required' : 'Not required for this trip'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleDismiss(card.key)}
                        sx={{
                          p: 0.5, mt: -0.5, mr: -0.5,
                          color: isDismissed ? 'primary.main' : 'text.disabled',
                          '&:hover': { color: isDismissed ? 'primary.dark' : 'text.secondary' },
                        }}
                      >
                        {isDismissed ? <UndoIcon sx={{ fontSize: 16 }} /> : <BlockIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* Status value */}
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.82rem',
                      color: isDismissed ? 'text.disabled' : LEVEL_COLOR[card.level],
                      textDecoration: isDismissed ? 'line-through' : 'none',
                      lineHeight: 1.4,
                      display: 'block',
                    }}
                  >
                    {isDismissed ? 'Not required for this trip' : card.value}
                  </Typography>

                  {/* Actions row */}
                  {!isDismissed && (card.action || card.navDest) && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 'auto' }}>
                      {card.navDest && (
                        <NavigateButton
                          destination={card.navDest}
                          suggestedMode="driving"
                          size="small"
                        />
                      )}
                      {card.action && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => onNavigate(card.action!.tab)}
                          sx={{ fontSize: '0.75rem', py: 0.5, px: 1.25 }}
                        >
                          {card.action.label}
                        </Button>
                      )}
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Box>
        </Box>
      )}

      {/* ── Trip details ── */}
      <Paper sx={{ p: { xs: 2.5, sm: 3 }, backgroundColor: 'background.paper' }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2.5, fontSize: { xs: '1.05rem', sm: '1.15rem' } }}>
          Trip Details
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: { xs: 2.5, sm: 3 } }}>
          {[
            { label: 'From',     value: trip.origin?.city,      sub: trip.origin?.country },
            { label: 'To',       value: trip.destination?.city, sub: trip.destination?.country, accent: true },
            { label: 'Departs',  value: new Date(trip.startDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'long' }), sub: String(new Date(trip.startDate).getFullYear()) },
            { label: 'Duration', value: `${trip.nights} nights`, sub: trip.tripType, capitalize: true },
          ].map(({ label, value, sub, accent, capitalize }) => (
            <Box key={label}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.8, color: 'text.secondary', textTransform: 'uppercase', mb: 0.4 }}>
                {label}
              </Typography>
              <Typography fontWeight={700} color={accent ? 'secondary.main' : 'text.primary'}
                sx={{ fontSize: { xs: '1rem', sm: '1.05rem' }, textTransform: capitalize ? 'capitalize' : 'none' }}>
                {value}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textTransform: capitalize ? 'capitalize' : 'none' }}>
                {sub}
              </Typography>
            </Box>
          ))}
        </Box>
        {trip.purpose && (
          <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.8, color: 'text.secondary', textTransform: 'uppercase', mb: 0.5 }}>
              Purpose
            </Typography>
            <Typography sx={{ fontSize: { xs: '1rem', sm: '0.95rem' } }}>{trip.purpose}</Typography>
          </Box>
        )}
      </Paper>

    </Box>
  );
}