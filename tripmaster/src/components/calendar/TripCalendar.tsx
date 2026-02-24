'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, IconButton, Paper, Chip,
  CircularProgress, useMediaQuery, useTheme, Tooltip,
} from '@mui/material';
import ChevronLeftIcon  from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WorkIcon         from '@mui/icons-material/Work';
import BeachAccessIcon  from '@mui/icons-material/BeachAccess';
import FlightIcon       from '@mui/icons-material/Flight';
import { useRouter }    from 'next/navigation';

interface Trip {
  _id: string;
  name: string;
  destination: { city: string; country: string };
  startDate: string;
  endDate: string;
  tripType: 'work' | 'leisure' | 'mixed';
  status: string;
}

const TRIP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  work:    { bg: '#1a3a5c', text: '#ffffff', border: '#2a5a8c' },
  leisure: { bg: '#55702c', text: '#ffffff', border: '#6e9039' },
  mixed:   { bg: '#c9521b', text: '#ffffff', border: '#e06422' },
};

const TRIP_ICONS: Record<string, React.ReactNode> = {
  work:    <WorkIcon sx={{ fontSize: '0.65rem' }} />,
  leisure: <BeachAccessIcon sx={{ fontSize: '0.65rem' }} />,
  mixed:   <FlightIcon sx={{ fontSize: '0.65rem' }} />,
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

// Get Monday-anchored grid for a given month
// Returns array of weeks, each week is 7 ISO date strings (may include prev/next month)
function buildMonthGrid(year: number, month: number): string[][] {
  const firstDay  = new Date(year, month, 1);
  const lastDay   = new Date(year, month + 1, 0);

  // Find the Monday on or before the first day
  const dow       = (firstDay.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const start     = new Date(firstDay);
  start.setDate(start.getDate() - dow);

  const weeks: string[][] = [];
  const cursor = new Date(start);

  while (cursor <= lastDay || weeks.length === 0) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(isoDate(new Date(cursor)));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    if (cursor > lastDay && weeks.length >= 4) break;
  }

  return weeks;
}

interface TripSpan {
  trip: Trip;
  // For each week row, which day indices (0-6) this trip occupies
}

function getTripDaySet(trips: Trip[]): Map<string, Trip[]> {
  const map = new Map<string, Trip[]>();
  for (const trip of trips) {
    const start  = new Date(trip.startDate);
    const end    = new Date(trip.endDate);
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = isoDate(cursor);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(trip);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return map;
}

// For a given week row, get ordered trip spans (for rendering bars)
function getWeekSpans(week: string[], tripDayMap: Map<string, Trip[]>, trips: Trip[]) {
  // Returns array of { tripId, startCol, endCol, trip, isStart, isEnd }
  const spans: { tripId: string; startCol: number; endCol: number; trip: Trip; isStart: boolean; isEnd: boolean }[] = [];

  for (const trip of trips) {
    const tripStart = trip.startDate.split('T')[0];
    const tripEnd   = trip.endDate.split('T')[0];

    let startCol = -1;
    let endCol   = -1;

    for (let i = 0; i < 7; i++) {
      const d = week[i];
      if (d >= tripStart && d <= tripEnd) {
        if (startCol === -1) startCol = i;
        endCol = i;
      }
    }

    if (startCol !== -1) {
      spans.push({
        tripId:   trip._id,
        startCol,
        endCol,
        trip,
        isStart:  week[startCol] === tripStart,
        isEnd:    week[endCol]   === tripEnd,
      });
    }
  }

  return spans;
}

interface MonthViewProps {
  year: number;
  month: number;
  trips: Trip[];
  tripDayMap: Map<string, Trip[]>;
  onTripClick: (id: string) => void;
  today: string;
}

function MonthView({ year, month, trips, tripDayMap, onTripClick, today }: MonthViewProps) {
  const weeks      = buildMonthGrid(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-IE', { month: 'long', year: 'numeric' });
  const currentMonth = month;

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="subtitle1" fontWeight={700}
        sx={{ mb: 1.5, fontSize: { xs: '0.9rem', sm: '1rem' }, color: 'text.primary' }}>
        {monthLabel}
      </Typography>

      {/* Day headers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
        {DAY_LABELS.map(d => (
          <Typography key={d} variant="caption" color="text.secondary" fontWeight={600}
            sx={{ textAlign: 'center', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {d}
          </Typography>
        ))}
      </Box>

      {/* Weeks */}
      {weeks.map((week, wi) => {
        const spans = getWeekSpans(week, tripDayMap, trips);

        return (
          <Box key={wi} sx={{ position: 'relative', mb: 0.25 }}>
            {/* Day number row */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
              {week.map((dateStr, di) => {
                const inMonth    = new Date(dateStr).getMonth() === currentMonth;
                const isToday    = dateStr === today;
                const tripsHere  = tripDayMap.get(dateStr) ?? [];
                const inTrip     = tripsHere.length > 0;

                return (
                  <Box
                    key={dateStr}
                    onClick={() => inTrip && onTripClick(tripsHere[0]._id)}
                    sx={{
                      height: { xs: 28, sm: 26 },
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      zIndex: 2,
                      cursor: inTrip ? 'pointer' : 'default',
                    }}
                  >
                    <Box
                      sx={{
                        width: { xs: 24, sm: 22 },
                        height: { xs: 24, sm: 22 },
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isToday ? 'text.primary' : 'transparent',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: { xs: '0.72rem', sm: '0.68rem' },
                          fontWeight: isToday ? 800 : inTrip ? 600 : 400,
                          color: isToday
                            ? 'background.default'
                            : inMonth
                              ? inTrip ? 'text.primary' : 'text.primary'
                              : 'text.disabled',
                          lineHeight: 1,
                        }}
                      >
                        {new Date(dateStr).getDate()}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {/* Trip bars — positioned below day numbers */}
            {spans.map((span, si) => {
              const color = TRIP_COLORS[span.trip.tripType] ?? TRIP_COLORS.mixed;
              const leftPct  = (span.startCol / 7) * 100;
              const widthPct = ((span.endCol - span.startCol + 1) / 7) * 100;

              return (
                <Tooltip
                  key={`${span.tripId}-${wi}`}
                  title={`${span.trip.name} · ${span.trip.destination.city}`}
                  placement="top"
                  arrow
                >
                  <Box
                    onClick={() => onTripClick(span.trip._id)}
                    sx={{
                      position: 'absolute',
                      top: { xs: 28, sm: 26 },
                      left:  `calc(${leftPct}% + ${span.isStart ? 3 : 0}px)`,
                      width: `calc(${widthPct}% - ${span.isStart ? 3 : 0}px - ${span.isEnd ? 3 : 0}px)`,
                      height: { xs: 14, sm: 13 },
                      backgroundColor: color.bg,
                      borderRadius: `${span.isStart ? 4 : 0}px ${span.isEnd ? 4 : 0}px ${span.isEnd ? 4 : 0}px ${span.isStart ? 4 : 0}px`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      px: 0.5,
                      zIndex: 3 + si,
                      overflow: 'hidden',
                      '&:hover': { filter: 'brightness(1.15)' },
                      transition: 'filter 0.15s',
                    }}
                  >
                    {/* Show name only on start of span */}
                    {span.isStart && span.endCol - span.startCol >= 1 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, overflow: 'hidden' }}>
                        <Box sx={{ color: color.text, display: 'flex', flexShrink: 0 }}>
                          {TRIP_ICONS[span.trip.tripType]}
                        </Box>
                        <Typography
                          sx={{
                            fontSize: '0.55rem',
                            fontWeight: 700,
                            color: color.text,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1,
                          }}
                        >
                          {span.trip.name}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Tooltip>
              );
            })}

            {/* Spacer for the bar height */}
            {spans.length > 0 && (
              <Box sx={{ height: { xs: 14, sm: 13 }, mb: 0.5 }} />
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Main TripCalendar ────────────────────────────────────────────────────────
export default function TripCalendar() {
  const router  = useRouter();
  const theme   = useTheme();
  const mobile  = useMediaQuery(theme.breakpoints.down('sm'));

  const [trips,   setTrips]   = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const today = isoDate(new Date());
  const [anchorYear,  setAnchorYear]  = useState(() => new Date().getFullYear());
  const [anchorMonth, setAnchorMonth] = useState(() => new Date().getMonth());

  useEffect(() => {
    fetch('/api/trips')
      .then(r => r.json())
      .then(d => { setTrips(d.trips ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const tripDayMap = useMemo(() => getTripDaySet(trips), [trips]);

  const prev = () => {
    if (anchorMonth === 0) { setAnchorYear(y => y - 1); setAnchorMonth(11); }
    else setAnchorMonth(m => m - 1);
  };

  const next = () => {
    if (anchorMonth === 11) { setAnchorYear(y => y + 1); setAnchorMonth(0); }
    else setAnchorMonth(m => m + 1);
  };

  // Show 1 month on mobile, 2 on tablet, 3 on desktop
  const monthCount = mobile ? 1 : useMediaQuery(theme.breakpoints.down('md')) ? 2 : 3;

  const months = useMemo(() => {
    const result: { year: number; month: number }[] = [];
    for (let i = 0; i < monthCount; i++) {
      let m = anchorMonth + i;
      let y = anchorYear;
      if (m > 11) { m -= 12; y += 1; }
      result.push({ year: y, month: m });
    }
    return result;
  }, [anchorYear, anchorMonth, monthCount]);

  // Legend
  const legend = [
    { type: 'work',    label: 'Work',    icon: TRIP_ICONS.work },
    { type: 'leisure', label: 'Leisure', icon: TRIP_ICONS.leisure },
    { type: 'mixed',   label: 'Mixed',   icon: TRIP_ICONS.mixed },
  ];

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
      <CircularProgress size={28} />
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Header row ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton onClick={prev} size="small">
            <ChevronLeftIcon />
          </IconButton>
          <IconButton onClick={next} size="small">
            <ChevronRightIcon />
          </IconButton>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: '0.75rem', cursor: 'pointer' }}
            onClick={() => {
              setAnchorYear(new Date().getFullYear());
              setAnchorMonth(new Date().getMonth());
            }}
          >
            Today
          </Typography>
        </Box>

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {legend.map(({ type, label, icon }) => {
            const color = TRIP_COLORS[type];
            return (
              <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{
                  width: 10, height: 10, borderRadius: 1,
                  backgroundColor: color.bg, flexShrink: 0,
                }} />
                <Typography variant="caption" color="text.secondary"
                  sx={{ fontSize: '0.65rem' }}>
                  {label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* ── Month columns ── */}
      <Box sx={{ display: 'flex', gap: { xs: 0, sm: 4 }, flexDirection: { xs: 'column', sm: 'row' } }}>
        {months.map(({ year, month }, i) => (
          <MonthView
            key={`${year}-${month}`}
            year={year}
            month={month}
            trips={trips}
            tripDayMap={tripDayMap}
            onTripClick={id => router.push(`/trips/${id}`)}
            today={today}
          />
        ))}
      </Box>

      {/* ── Trip list below calendar ── */}
      {trips.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}
            sx={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', mb: 1 }}>
            All trips
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {[...trips]
              .sort((a, b) => a.startDate.localeCompare(b.startDate))
              .map(trip => {
                const color    = TRIP_COLORS[trip.tripType] ?? TRIP_COLORS.mixed;
                const start    = new Date(trip.startDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
                const end      = new Date(trip.endDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
                const daysLeft = Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / 86400000);

                return (
                  <Box
                    key={trip._id}
                    onClick={() => router.push(`/trips/${trip._id}`)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      p: 1.25, borderRadius: 1.5, cursor: 'pointer',
                      border: '1px solid', borderColor: 'divider',
                      backgroundColor: 'background.paper',
                      '&:hover': { backgroundColor: 'action.hover' },
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <Box sx={{
                      width: 4, alignSelf: 'stretch', borderRadius: 4,
                      backgroundColor: color.bg, flexShrink: 0,
                    }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ color: color.bg }}>{TRIP_ICONS[trip.tripType]}</Box>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap sx={{ fontSize: '0.85rem' }}>
                        {trip.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {trip.destination.city} · {start} – {end}
                      </Typography>
                    </Box>
                    {daysLeft > 0 && (
                      <Typography variant="caption" color="text.secondary"
                        sx={{ fontSize: '0.68rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {daysLeft}d
                      </Typography>
                    )}
                    {daysLeft === 0 && (
                      <Chip label="Today" size="small" color="success"
                        sx={{ height: 18, fontSize: '0.6rem' }} />
                    )}
                    {daysLeft < 0 && (
                      <Chip label="Past" size="small"
                        sx={{ height: 18, fontSize: '0.6rem' }} />
                    )}
                  </Box>
                );
              })}
          </Box>
        </Box>
      )}

    </Box>
  );
}