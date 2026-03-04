'use client';

import {
  Box, Typography, Paper, Chip, alpha,
} from '@mui/material';
import FlightIcon          from '@mui/icons-material/Flight';
import HotelIcon           from '@mui/icons-material/Hotel';
import EventIcon           from '@mui/icons-material/Event';
import WarningAmberIcon    from '@mui/icons-material/WarningAmber';
import ErrorIcon           from '@mui/icons-material/Error';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import { useRouter }       from 'next/navigation';

interface Readiness {
  transportCount:         number;
  transportConfirmed:     boolean;
  transportAnyConfirmed:  boolean;
  accommodationCount:     number;
  accommodationConfirmed: boolean;
  venueCount:             number;
}

interface Trip {
  _id:         string;
  name:        string;
  status:      string;
  nights:      number;
  tripType:    string;
  startDate:   string;
  endDate:     string;
  destination: { city: string; country: string };
  readiness?:  Readiness;
}

interface ActionItem {
  label:   string;
  detail?: string;
  urgency: 'critical' | 'warn' | 'info';
  icon:    React.ReactNode;
}

const URGENCY = {
  critical: { color: '#b91c1c', bg: alpha('#b91c1c', 0.07) },
  warn:     { color: '#b45309', bg: alpha('#b45309', 0.07) },
  info:     { color: '#0369a1', bg: alpha('#0369a1', 0.07) },
};

function buildActions(trip: Trip, daysUntil: number): ActionItem[] {
  const r = trip.readiness;
  const items: ActionItem[] = [];
  if (!r) return items;
  const needsAccom = trip.nights > 0;

  if (trip.status === 'planning') {
    if (daysUntil <= 7) {
      items.push({ label: 'Trip is still in planning', detail: 'Departure under a week away — confirm when ready', urgency: 'critical', icon: <AssignmentTurnedInIcon sx={{ fontSize: 15 }} /> });
    } else if (daysUntil <= 14) {
      items.push({ label: 'Trip still in planning', detail: '2 weeks out — review bookings and confirm', urgency: 'warn', icon: <AssignmentTurnedInIcon sx={{ fontSize: 15 }} /> });
    }
  }

  // Only flag booking gaps within 50 days of departure
  if (daysUntil <= 50) {
    if (r.transportCount === 0) {
      items.push({ label: 'No transport booked', detail: daysUntil <= 14 ? 'Prices may be rising — book soon' : undefined, urgency: daysUntil <= 7 ? 'critical' : daysUntil <= 14 ? 'warn' : 'info', icon: <FlightIcon sx={{ fontSize: 15 }} /> });
    } else if (!r.transportConfirmed) {
      items.push({ label: r.transportAnyConfirmed ? 'Some transport unconfirmed' : 'Transport not yet confirmed', urgency: daysUntil <= 7 ? 'critical' : 'warn', icon: <FlightIcon sx={{ fontSize: 15 }} /> });
    }

    if (needsAccom && r.accommodationCount === 0) {
      items.push({ label: 'No accommodation booked', detail: daysUntil <= 14 ? 'Availability may be limited' : undefined, urgency: daysUntil <= 7 ? 'critical' : daysUntil <= 21 ? 'warn' : 'info', icon: <HotelIcon sx={{ fontSize: 15 }} /> });
    } else if (needsAccom && r.accommodationCount > 0 && !r.accommodationConfirmed) {
      items.push({ label: 'Accommodation not yet confirmed', urgency: daysUntil <= 7 ? 'critical' : 'warn', icon: <HotelIcon sx={{ fontSize: 15 }} /> });
    }

    if (r.venueCount === 0) {
      items.push({ label: 'No venues added', detail: "Add the event or location you're heading to", urgency: 'info', icon: <EventIcon sx={{ fontSize: 15 }} /> });
    }
  }

  return items;
}

function TripReadinessCard({ trip, onOpen }: { trip: Trip; onOpen: () => void }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((new Date(trip.startDate).getTime() - today.getTime()) / 86400000);
  const actions = buildActions(trip, daysUntil);
  if (actions.length === 0) return null;
  const topUrgency = actions.some(a => a.urgency === 'critical') ? 'critical' : actions.some(a => a.urgency === 'warn') ? 'warn' : 'info';
  const cfg = URGENCY[topUrgency];

  return (
    <Paper elevation={0} onClick={onOpen} sx={{ p: { xs: 1.75, sm: 2 }, mb: 1.5, borderRadius: 2, border: '1.5px solid ' + alpha(cfg.color, 0.25), backgroundColor: cfg.bg, cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s', '&:hover': { boxShadow: 3, transform: 'translateY(-1px)' }, '&:active': { transform: 'scale(0.995)' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Typography fontWeight={800} sx={{ fontSize: '0.92rem', lineHeight: 1.2 }}>{trip.name}</Typography>
          <Chip label={trip.destination.city} size='small' sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, backgroundColor: alpha(cfg.color, 0.12), color: cfg.color, flexShrink: 0 }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          <Typography variant='caption' sx={{ color: cfg.color, fontWeight: 700, fontSize: '0.75rem' }}>
            {daysUntil === 1 ? 'Tomorrow' : daysUntil === 0 ? 'Today' : daysUntil + 'd'}
          </Typography>
          <KeyboardArrowRightIcon sx={{ fontSize: 16, color: cfg.color }} />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
        {actions.map((action, i) => {
          const acfg = URGENCY[action.urgency];
          return (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
              <Box sx={{ color: acfg.color, mt: '1px', flexShrink: 0 }}>{action.icon}</Box>
              <Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: acfg.color, lineHeight: 1.3 }}>{action.label}</Typography>
                {action.detail && <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.3 }}>{action.detail}</Typography>}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

interface TripReadinessPanelProps { trips: Trip[]; }

export default function TripReadinessPanel({ trips }: TripReadinessPanelProps) {
  const router = useRouter();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const candidates = trips.filter(t =>
    t.status !== 'cancelled' && t.status !== 'completed' && t.status !== 'active' &&
    t.startDate && new Date(t.startDate) >= today && t.readiness
  );

  const tripsWithActions = candidates.filter(trip => {
    const d = Math.ceil((new Date(trip.startDate).getTime() - today.getTime()) / 86400000);
    return buildActions(trip, d).length > 0;
  });

  if (tripsWithActions.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Typography variant='overline' fontWeight={800} sx={{ fontSize: '0.72rem', letterSpacing: '0.08em', color: 'text.secondary' }}>Needs attention</Typography>
        <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
        <Chip label={tripsWithActions.length} size='small' sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, backgroundColor: alpha('#b45309', 0.12), color: '#b45309' }} />
      </Box>
      {tripsWithActions.map(trip => (
        <TripReadinessCard key={trip._id} trip={trip} onOpen={() => router.push('/trips/' + trip._id)} />
      ))}
    </Box>
  );
}