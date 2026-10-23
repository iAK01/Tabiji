'use client';

// The whole trip as it happened — every stop you went to, with your notes and
// what's linked to it from Resources — laid out to print (or save as PDF) and to
// email to yourself. Built from the same record as the itinerary's Recap view.
// Reads only saved trip data, so the offline copy works too.

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Box, Button, CircularProgress, GlobalStyles, Typography } from '@mui/material';
import ArrowBackIcon   from '@mui/icons-material/ArrowBack';
import PrintIcon       from '@mui/icons-material/Print';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { placeTz, ymd } from '@/lib/push/timezones';
import { D, STOP_CONFIG } from '@/components/itinerary/Itinerary.config';
import { timeRangeLabel } from '@/components/itinerary/Itinerary.helpers';
import { LinkedResources } from '@/components/itinerary/LinkedResources';
import {
  dayHeading, linkedFor, linkedIndex, recordDays, recordText, startedCheck, type RecordDay,
} from '@/components/itinerary/record';

const getJson = (url: string) => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);

function dateRange(start?: string, end?: string): string {
  if (!start) return '';
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${ymd(d)}T12:00:00`).toLocaleDateString('en-IE', opts);
  if (!end || ymd(end) === ymd(start)) return fmt(start, { day: 'numeric', month: 'short', year: 'numeric' });
  const sameMonth = ymd(start).slice(0, 7) === ymd(end).slice(0, 7);
  return `${fmt(start, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })}–${fmt(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function Recap() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ trip: any; days: any[]; files: any[]; transport: any[]; user: any } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([
      getJson(`/api/trips/${id}`),
      getJson(`/api/trips/${id}/itinerary`),
      getJson(`/api/trips/${id}/files`),
      getJson(`/api/trips/${id}/logistics`),
      getJson('/api/user/profile'),
    ]).then(([t, it, f, lg, p]) => {
      if (!t?.trip || !Array.isArray(it?.days)) { setFailed(true); return; }
      setData({
        trip: t.trip, days: it.days, files: f?.files ?? [],
        transport: lg?.logistics?.transportation ?? [], user: p?.user ?? null,
      });
    });
  }, [id]);

  const record: RecordDay[] = useMemo(() => {
    if (!data) return [];
    const { trip, user } = data;
    const started = startedCheck(trip, data.transport, {
      zone:        placeTz(user?.homeLocation) ?? placeTz(trip.origin),
      countryCode: user?.homeLocation?.countryCode ?? trip.origin?.countryCode ?? null,
    });
    const index = linkedIndex(data.files);
    return recordDays(data.days, started, s => linkedFor(index, s)).filter(d => d.went.length);
  }, [data]);

  if (failed) {
    return <Typography sx={{ p: 4, textAlign: 'center', color: D.muted, fontFamily: D.body }}>Couldn’t load this trip.</Typography>;
  }
  if (!data) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  const { trip, user } = data;
  const subtitle = [trip.destination?.city, dateRange(trip.startDate, trip.endDate)].filter(Boolean).join(' · ');
  const email = () => {
    const body = recordText(trip.name, subtitle, record).replace(/\n/g, '\r\n');
    location.href = `mailto:${user?.email ?? ''}?subject=${encodeURIComponent(`${trip.name} — recap`)}&body=${encodeURIComponent(body)}`;
  };
  const btnSx = { minHeight: 44, fontFamily: D.body, fontWeight: 700, textTransform: 'none', borderRadius: '10px' } as const;

  return (
    <Box sx={{ minHeight: '100dvh', backgroundColor: '#ffffff', px: 2, pt: 'max(env(safe-area-inset-top), 16px)', pb: 6 }}>
      <GlobalStyles styles={{
        '@media print': {
          '.no-print': { display: 'none !important' },
          body: { background: '#ffffff' },
          '.recap-entry': { breakInside: 'avoid' },
          '.recap-day': { breakAfter: 'auto' },
        },
      }} />
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        <Box className="no-print" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Button href={`/trips/${id}?tab=itinerary&view=recap`} startIcon={<ArrowBackIcon />} sx={{ ...btnSx, ml: -1, color: D.navy }}>
            Back to trip
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={!record.length}
            sx={{ ...btnSx, color: D.navy, borderColor: 'rgba(29,38,66,0.25)' }}>
            Print / PDF
          </Button>
          <Button variant="contained" startIcon={<MailOutlineIcon />} onClick={email} disabled={!record.length}
            sx={{ ...btnSx, backgroundColor: D.navy, boxShadow: 'none' }}>
            Email
          </Button>
        </Box>

        <Typography component="h1" sx={{ fontFamily: D.display, fontSize: { xs: '1.6rem', sm: '2rem' }, color: D.navy, lineHeight: 1.15 }}>
          {trip.name}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.95rem', color: D.muted, mt: 0.5 }}>{subtitle}</Typography>
        )}

        {!record.length && (
          <Typography sx={{ py: 6, color: D.muted, fontFamily: D.body }}>Nothing on this trip has happened yet.</Typography>
        )}

        {record.map(day => (
          <Box key={day.date} className="recap-day" component="section" sx={{ mt: 4 }}>
            <Typography component="h2" sx={{
              fontFamily: D.body, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: D.muted, pb: 0.75, mb: 1.5, borderBottom: `1px solid ${D.rule}`,
            }}>
              {dayHeading(day.date, day.dayNumber)}
            </Typography>
            {day.went.map(({ stop, linked }) => {
              const cfg   = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
              const place = stop.locationName || stop.address;
              const note  = stop.myNotes?.trim();
              return (
                <Box key={stop._id ?? `${stop.name}-${stop.scheduledStart}`} className="recap-entry"
                  sx={{ display: 'flex', gap: 2, py: 1.25, '& + &': { borderTop: `1px solid ${D.rule}` } }}>
                  <Typography sx={{
                    width: 96, flexShrink: 0, fontFamily: D.display, fontSize: '0.85rem', color: cfg.color,
                    fontVariantNumeric: 'tabular-nums', pt: 0.15,
                  }}>
                    {timeRangeLabel(stop)}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontFamily: D.body, fontSize: '1rem', fontWeight: 800, color: D.navy, lineHeight: 1.3 }}>
                      {stop.name?.trim() || 'Unnamed stop'}
                    </Typography>
                    {place && (
                      <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: D.muted }}>{place}</Typography>
                    )}
                    {note && (
                      <Typography sx={{ fontFamily: D.body, fontSize: '0.92rem', lineHeight: 1.55, color: D.navy, whiteSpace: 'pre-wrap', mt: 0.75 }}>
                        {note}
                      </Typography>
                    )}
                    {linked.some(l => l.resourceType !== 'file') && (
                      <Box sx={{ mt: 1 }}><LinkedResources items={linked} full /></Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function RecapPage() {
  return (
    <Suspense>
      <Recap />
    </Suspense>
  );
}
