'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Chip, CircularProgress,
  LinearProgress, Divider, Button,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import FlightIcon from '@mui/icons-material/Flight';
import HotelIcon from '@mui/icons-material/Hotel';
import BackpackIcon from '@mui/icons-material/Backpack';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

interface Props {
  trip: {
    _id: string;
    name: string;
    tripType: string;
    status: string;
    purpose?: string;
    origin: { city: string; country: string };
    destination: { city: string; country: string };
    startDate: string;
    endDate: string;
    nights: number;
  };
  onNavigate: (tab: number) => void;
}

type StatusLevel = 'ok' | 'warn' | 'empty' | 'info';

interface StatusRow {
  icon: React.ReactNode;
  label: string;
  value: string;
  level: StatusLevel;
  action?: { label: string; tab: number };
}

const STATUS_ICON = {
  ok:    <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />,
  warn:  <WarningAmberIcon sx={{ fontSize: 18, color: 'warning.main' }} />,
  empty: <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />,
  info:  <CheckCircleIcon sx={{ fontSize: 18, color: 'primary.main' }} />,
};

export default function TripOverview({ trip, onNavigate }: Props) {
  const [logistics, setLogistics] = useState<any>(null);
  const [packing, setPacking]     = useState<any>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/trips/${trip._id}/logistics`).then(r => r.json()),
      fetch(`/api/trips/${trip._id}/packing`).then(r => r.json()),
    ]).then(([l, p]) => {
      setLogistics(l.logistics);
      setPacking(p.packing ?? p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [trip._id]);

  const today     = new Date();
  today.setHours(0, 0, 0, 0);
  const departure = new Date(trip.startDate);
  departure.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((departure.getTime() - today.getTime()) / 86400000);
  const isPast    = daysUntil < 0;
  const isToday   = daysUntil === 0;

  // ── Logistics analysis ────────────────────────────────────────────────────
  const flights     = logistics?.transportation?.filter((t: any) => t.type === 'flight') ?? [];
  const outbound    = flights.filter((f: any) => f.departureAirport !== trip.destination?.city?.slice(0, 3));
  const inbound     = flights.filter((f: any) => f.arrivalAirport   !== trip.destination?.city?.slice(0, 3));
  const allFlightsBooked   = flights.length > 0 && flights.every((f: any) => f.status === 'confirmed');
  const someFlightsBooked  = flights.some((f: any) => f.status === 'confirmed');
  const noFlights          = flights.length === 0;

  const accommodation     = logistics?.accommodation ?? [];
  const allHotelsBooked   = accommodation.length > 0 && accommodation.every((a: any) => a.status === 'confirmed');
  const someHotelsBooked  = accommodation.some((a: any) => a.status === 'confirmed');
  const noHotel           = accommodation.length === 0;

  // Airport parking / transfers — look for ground transport entries
  const groundTransport = logistics?.transportation?.filter((t: any) =>
    t.type !== 'flight' && (
      t.notes?.toLowerCase().includes('park') ||
      t.type === 'parking' ||
      t.type === 'taxi' ||
      t.type === 'transfer' ||
      t.type === 'bus' ||
      t.type === 'train'
    )
  ) ?? [];

  // ── Packing analysis ──────────────────────────────────────────────────────
  const items       = packing?.items ?? [];
  const totalItems  = items.length;
  const packedItems = items.filter((i: any) => i.packed).length;
  const packPct     = totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0;
  const noList      = totalItems === 0;

  // ── Build status rows ─────────────────────────────────────────────────────
  const rows: StatusRow[] = [];

  // Outbound flight
  if (noFlights) {
    rows.push({
      icon: <FlightIcon sx={{ fontSize: 18 }} />,
      label: 'Outbound flight',
      value: 'Not added',
      level: 'empty',
      action: { label: 'Add flight', tab: 1 },
    });
  } else {
    const outFlight = outbound[0] ?? flights[0];
    rows.push({
      icon: <FlightIcon sx={{ fontSize: 18 }} />,
      label: 'Outbound flight',
      value: outFlight
        ? `${outFlight.flightNumber} · ${outFlight.departureAirport} → ${outFlight.arrivalAirport} · ${outFlight.status === 'confirmed' ? 'Confirmed' : 'Not booked'}`
        : 'Not added',
      level: outFlight?.status === 'confirmed' ? 'ok' : 'warn',
      action: outFlight?.status !== 'confirmed' ? { label: 'Update', tab: 1 } : undefined,
    });
  }

  // Return flight
  if (flights.length > 1) {
    const retFlight = inbound[0] ?? flights[flights.length - 1];
    rows.push({
      icon: <FlightIcon sx={{ fontSize: 18, transform: 'scaleX(-1)' }} />,
      label: 'Return flight',
      value: `${retFlight.flightNumber} · ${retFlight.departureAirport} → ${retFlight.arrivalAirport} · ${retFlight.status === 'confirmed' ? 'Confirmed' : 'Not booked'}`,
      level: retFlight?.status === 'confirmed' ? 'ok' : 'warn',
      action: retFlight?.status !== 'confirmed' ? { label: 'Update', tab: 1 } : undefined,
    });
  }

  // Accommodation
  if (noHotel) {
    rows.push({
      icon: <HotelIcon sx={{ fontSize: 18 }} />,
      label: 'Accommodation',
      value: 'Not added',
      level: 'empty',
      action: { label: 'Add hotel', tab: 1 },
    });
  } else {
    rows.push({
      icon: <HotelIcon sx={{ fontSize: 18 }} />,
      label: `Accommodation (${accommodation.length})`,
      value: allHotelsBooked
        ? accommodation.map((a: any) => a.name).join(', ') + ' · Confirmed'
        : someHotelsBooked
        ? 'Partially confirmed'
        : 'Not confirmed',
      level: allHotelsBooked ? 'ok' : 'warn',
      action: !allHotelsBooked ? { label: 'Update', tab: 1 } : undefined,
    });
  }

  // Airport transfers / parking
  if (groundTransport.length === 0) {
    rows.push({
      icon: <DirectionsCarIcon sx={{ fontSize: 18 }} />,
      label: 'Airport transfer / parking',
      value: 'Not arranged',
      level: 'empty',
      action: { label: 'Add', tab: 1 },
    });
  } else {
    rows.push({
      icon: <LocalParkingIcon sx={{ fontSize: 18 }} />,
      label: 'Airport transfer / parking',
      value: groundTransport.map((t: any) => t.type).join(', ') + ' · ' + (groundTransport[0]?.status === 'confirmed' ? 'Confirmed' : 'Not confirmed'),
      level: groundTransport[0]?.status === 'confirmed' ? 'ok' : 'warn',
    });
  }

  // Packing
  if (noList) {
    rows.push({
      icon: <BackpackIcon sx={{ fontSize: 18 }} />,
      label: 'Packing list',
      value: 'Not generated yet',
      level: 'empty',
      action: { label: 'Generate list', tab: 3 },
    });
  } else {
    rows.push({
      icon: <BackpackIcon sx={{ fontSize: 18 }} />,
      label: 'Packing',
      value: `${packedItems} of ${totalItems} items packed (${packPct}%)`,
      level: packPct === 100 ? 'ok' : daysUntil <= 3 ? 'warn' : 'info',
      action: packPct < 100 ? { label: 'View list', tab: 3 } : undefined,
    });
  }

  // ── Urgency banner config ──────────────────────────────────────────────────
  const urgentItems = rows.filter(r => r.level === 'warn').length;
  const emptyItems  = rows.filter(r => r.level === 'empty').length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* ── Countdown card ── */}
      <Paper sx={{
        p: { xs: 2.5, sm: 3 },
        backgroundColor: 'background.paper',
        borderLeft: '4px solid',
        borderLeftColor: isToday ? 'success.main' : isPast ? 'text.disabled' : daysUntil <= 7 ? 'warning.main' : 'primary.main',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AccessTimeIcon color={isToday ? 'success' : isPast ? 'disabled' : 'primary'} />
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1, fontSize: { xs: '2rem', sm: '2.5rem' } }}>
              {isPast
                ? 'Trip complete'
                : isToday
                ? 'Departing today'
                : `${daysUntil} days to go`}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {new Date(trip.startDate).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' → '}
              {new Date(trip.endDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'long' })}
              {' · '}
              {trip.nights} nights
            </Typography>
          </Box>
        </Box>

        {/* Packing progress bar — visible at a glance */}
        {!noList && !isPast && (
          <Box sx={{ mt: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Packing progress
              </Typography>
              <Typography variant="caption" fontWeight={700} color={packPct === 100 ? 'success.main' : 'text.secondary'}>
                {packPct}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={packPct}
              sx={{
                height: 8, borderRadius: 4,
                backgroundColor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  backgroundColor: packPct === 100 ? 'success.main' : 'primary.main',
                },
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

      {/* ── Status checklist ── */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <Paper sx={{ backgroundColor: 'background.paper', overflow: 'hidden' }}>
          <Box sx={{ px: { xs: 2.5, sm: 3 }, pt: 2.5, pb: 1 }}>
            <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '1.05rem', sm: '1.15rem' } }}>
              Trip Status
            </Typography>
          </Box>
          {rows.map((row, i) => (
            <Box key={i}>
              {i > 0 && <Divider />}
              <Box sx={{
                px: { xs: 2.5, sm: 3 }, py: { xs: 1.75, sm: 1.75 },
                display: 'flex', alignItems: 'center', gap: 2,
              }}>
                {/* Status icon */}
                <Box sx={{ flexShrink: 0, color: 'text.secondary' }}>
                  {STATUS_ICON[row.level]}
                </Box>
                {/* Type icon */}
                <Box sx={{ flexShrink: 0, color: 'text.disabled' }}>
                  {row.icon}
                </Box>
                {/* Label + value */}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ fontSize: { xs: '0.9rem', sm: '0.875rem' } }}>
                    {row.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    color={
                      row.level === 'ok'   ? 'success.main' :
                      row.level === 'warn' ? 'warning.dark' :
                      row.level === 'empty'? 'text.disabled' :
                      'primary.main'
                    }
                    sx={{ fontSize: { xs: '0.82rem', sm: '0.78rem' } }}
                  >
                    {row.value}
                  </Typography>
                </Box>
                {/* Action button */}
                {row.action && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onNavigate(row.action!.tab)}
                    sx={{ flexShrink: 0, fontSize: { xs: '0.75rem', sm: '0.72rem' }, py: 0.5, px: 1.25 }}
                  >
                    {row.action.label}
                  </Button>
                )}
              </Box>
            </Box>
          ))}
        </Paper>
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