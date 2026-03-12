'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Chip, CircularProgress,
  IconButton, Divider, alpha, Tooltip, Button,
} from '@mui/material';
import FlightIcon               from '@mui/icons-material/Flight';
import TrainIcon                from '@mui/icons-material/Train';
import DirectionsBusIcon        from '@mui/icons-material/DirectionsBus';
import DirectionsBoatIcon       from '@mui/icons-material/DirectionsBoat';
import DirectionsCarIcon        from '@mui/icons-material/DirectionsCar';
import LocalTaxiIcon            from '@mui/icons-material/LocalTaxi';
import AirportShuttleIcon       from '@mui/icons-material/AirportShuttle';
import PedalBikeIcon            from '@mui/icons-material/PedalBike';
import HotelIcon                from '@mui/icons-material/Hotel';
import EventIcon                from '@mui/icons-material/Event';
import WorkIcon                 from '@mui/icons-material/Work';
import RestaurantIcon           from '@mui/icons-material/Restaurant';
import ExploreIcon              from '@mui/icons-material/Explore';
import FreeBreakfastIcon        from '@mui/icons-material/FreeBreakfast';
import LocationOnIcon           from '@mui/icons-material/LocationOn';
import CheckCircleIcon          from '@mui/icons-material/CheckCircle';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import NavigationIcon           from '@mui/icons-material/Navigation';
import RefreshIcon              from '@mui/icons-material/Refresh';
import AssignmentIcon           from '@mui/icons-material/Assignment';
import BoltIcon                 from '@mui/icons-material/Bolt';
import LoginIcon                from '@mui/icons-material/Login';
import LogoutIcon               from '@mui/icons-material/Logout';

// ─── Design tokens ─────────────────────────────────────────────────────────────

const D = {
  green:   '#6B7C5C',
  terra:   '#C4714A',
  navy:    '#1D2642',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trip {
  _id: string;
  name: string;
  destination: { city: string; country: string; countryCode?: string };
  origin?: { city: string; country: string };
  startDate: string;
  endDate: string;
  nights?: number;
  tripType: string;
  purpose?: string;
  coverPhotoUrl?: string;
  coverPhotoThumb?: string;
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

interface Transport {
  type: string;
  status: string;
  departureLocation: string;
  arrivalLocation: string;
  departureTime: string;
  arrivalTime: string;
  confirmationNumber?: string;
  details: {
    airline?: string;
    flightNumber?: string;
    operator?: string;
    rentalCompany?: string;
    pickupLocation?: string;
  };
}

interface Accommodation {
  type: string;
  status: string;
  name: string;
  address?: string;
  checkIn: string;
  checkOut: string;
  confirmationNumber?: string;
  notes?: string;
}

interface Todo {
  _id: string;
  name: string;
  body?: string;
  type: string;
  dueAt?: string;
  completed: boolean;
  source?: 'manual' | 'packing_advisory';
}

// Unified timeline item
type TimelineItem =
  | { kind: 'stop';      sortMins: number; stop: Stop }
  | { kind: 'transport'; sortMins: number; transport: Transport; event: 'departure' | 'arrival' }
  | { kind: 'accom';     sortMins: number; accom: Accommodation; event: 'checkin' | 'checkout' };

interface OnTripScreenProps {
  tripId: string;
  trip:   Trip;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STOP_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  flight:      { label: 'Flight',        color: D.terra,  Icon: FlightIcon },
  hotel:       { label: 'Accommodation', color: '#5c35a0', Icon: HotelIcon },
  meeting:     { label: 'Meeting',       color: D.navy,   Icon: WorkIcon },
  meal:        { label: 'Meal',          color: '#b45309', Icon: RestaurantIcon },
  breakfast:   { label: 'Breakfast',     color: '#b45309', Icon: FreeBreakfastIcon },
  activity:    { label: 'Activity',      color: D.green,  Icon: ExploreIcon },
  sightseeing: { label: 'Sightseeing',   color: D.green,  Icon: ExploreIcon },
  transport:   { label: 'Transport',     color: '#0369a1', Icon: DirectionsBusIcon },
  work:        { label: 'Work block',    color: D.navy,   Icon: WorkIcon },
  other:       { label: 'Other',         color: '#6b7280', Icon: EventIcon },
};

const TRANSPORT_ICON: Record<string, any> = {
  flight:           FlightIcon,
  train:            TrainIcon,
  bus:              DirectionsBusIcon,
  ferry:            DirectionsBoatIcon,
  car:              DirectionsCarIcon,
  car_hire:         DirectionsCarIcon,
  taxi:             LocalTaxiIcon,
  private_transfer: AirportShuttleIcon,
  bicycle:          PedalBikeIcon,
};

const TRANSPORT_LABEL: Record<string, string> = {
  flight: 'Flight', train: 'Train', bus: 'Bus', ferry: 'Ferry',
  car: 'Car', car_hire: 'Car hire', taxi: 'Taxi',
  private_transfer: 'Transfer', bicycle: 'Bicycle',
};

const STATUS_COLOR: Record<string, string> = {
  not_booked: '#6b7280',
  pending: '#b45309',
  booked: '#0369a1',
  confirmed: D.green,
  cancelled: '#dc2626',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function isoToMins(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
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

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
}

function dayOfTrip(startDate: string): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
}

function tripNights(startDate: string, endDate: string): number {
  const s = new Date(startDate);
  const e = new Date(endDate);
  return Math.round((e.getTime() - s.getTime()) / 86400000);
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

// ─── Map buttons ──────────────────────────────────────────────────────────────

function MapButtons({ name, address, coordinates }: {
  name: string; address?: string; coordinates?: { lat: number; lng: number };
}) {
  const links = mapsLinks(name, address, coordinates);
  return (
    <Box sx={{ display: 'flex', gap: 0.75, mt: 1.1, flexWrap: 'wrap' }}>
      {[
        { label: 'Apple Maps', href: links.apple,  color: D.navy },
        { label: 'Google Maps', href: links.google, color: '#0369a1' },
        { label: 'Waze', href: links.waze, color: '#00838f' },
      ].map(({ label, href, color }) => (
        <Button
          key={label}
          component="a"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          startIcon={<NavigationIcon sx={{ fontSize: '0.85rem !important' }} />}
          sx={{
            minHeight: 28,
            py: 0.4,
            px: 1,
            borderRadius: '999px',
            textTransform: 'none',
            fontSize: '0.72rem',
            fontWeight: 800,
            letterSpacing: '0.02em',
            fontFamily: D.body,
            backgroundColor: alpha(color, 0.08),
            color,
            border: `1px solid ${alpha(color, 0.12)}`,
            '&:hover': { backgroundColor: alpha(color, 0.15) },
          }}
        >
          {label}
        </Button>
      ))}
    </Box>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{
      fontSize: '1.2rem',
      fontWeight: 800,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: D.muted,
      fontFamily: D.body,
      display: 'block',
      mb: 1.25,
    }}>
      {children}
    </Typography>
  );
}

// ─── Right Now card ───────────────────────────────────────────────────────────

function RightNowCard({ stop, startMins, nowMins }: {
  stop: Stop; startMins: number | null; nowMins: number;
}) {
  const cfg    = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
  const Icon   = cfg.Icon;
  const endM   = startMins !== null ? startMins + stop.duration : null;
  const inProg = startMins !== null && endM !== null && nowMins >= startMins && nowMins < endM;
  const remaining = endM !== null && inProg ? endM - nowMins : null;
  const hasLoc = !!(stop.address || stop.coordinates);

  return (
    <Paper elevation={0} sx={{
      p: { xs: 2.25, sm: 2.75 },
      border: `1.5px solid ${D.rule}`,
      borderTop: `3px solid ${cfg.color}`,
      borderRadius: '12px',
      background: `linear-gradient(135deg, ${alpha(cfg.color, 0.08)} 0%, transparent 58%)`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{
          width: 46,
          height: 46,
          borderRadius: '10px',
          backgroundColor: alpha(cfg.color, 0.12),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon sx={{ fontSize: 22, color: cfg.color }} />
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{
              fontFamily: D.display,
              fontSize: { xs: '1.15rem', sm: '1.3rem' },
              lineHeight: 1.15,
              color: D.navy,
            }}>
              {stop.name}
            </Typography>

            {inProg
              ? (
                <Chip
                  label="In progress"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    fontFamily: D.body,
                    letterSpacing: '0.03em',
                    backgroundColor: alpha(cfg.color, 0.12),
                    color: cfg.color,
                  }}
                />
              )
              : startMins !== null
                ? (
                  <Chip
                    label={`at ${fmtMins(startMins)}`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      fontFamily: D.body,
                      letterSpacing: '0.03em',
                      backgroundColor: alpha(cfg.color, 0.10),
                      color: cfg.color,
                    }}
                  />
                )
                : null}
          </Box>

          {remaining !== null && (
            <Typography sx={{
              color: cfg.color,
              fontWeight: 800,
              mt: 0.35,
              fontSize: '0.92rem',
              fontFamily: D.body,
            }}>
              {remaining < 60
                ? `${remaining} min${remaining !== 1 ? 's' : ''} remaining`
                : `${Math.floor(remaining / 60)}h ${remaining % 60}m remaining`}
            </Typography>
          )}

          {!inProg && startMins !== null && endM !== null && (
            <Typography sx={{
              fontSize: '0.82rem',
              mt: 0.25,
              color: D.muted,
              fontFamily: D.body,
            }}>
              Until {fmtMins(endM)}
            </Typography>
          )}

          {stop.address && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.7 }}>
              <LocationOnIcon sx={{ fontSize: 14, color: D.muted }} />
              <Typography sx={{
                fontSize: '0.82rem',
                color: D.muted,
                lineHeight: 1.4,
                fontFamily: D.body,
              }}>
                {stop.address}
              </Typography>
            </Box>
          )}

          {stop.notes && (
            <Typography sx={{
              fontSize: '0.82rem',
              mt: 0.65,
              color: D.muted,
              lineHeight: 1.45,
              fontFamily: D.body,
            }}>
              {stop.notes}
            </Typography>
          )}

          {hasLoc && (
            <MapButtons name={stop.name} address={stop.address} coordinates={stop.coordinates} />
          )}
        </Box>
      </Box>
    </Paper>
  );
}

// ─── Timeline row ─────────────────────────────────────────────────────────────

function TimelineRow({ item, past }: { item: TimelineItem; past: boolean }) {
  if (item.kind === 'stop') {
    const { stop } = item;
    const cfg  = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
    const Icon = cfg.Icon;
    const hasLoc = !!(stop.address || stop.coordinates);

    return (
      <Box sx={{
        display: 'flex',
        gap: 1.5,
        py: 1.6,
        px: { xs: 2, sm: 2.5 },
        opacity: past ? 0.45 : 1,
        backgroundColor: stop.completed ? alpha(D.green, 0.03) : 'transparent',
      }}>
        <Box sx={{
          width: 36,
          height: 36,
          borderRadius: '10px',
          flexShrink: 0,
          mt: 0.15,
          backgroundColor: alpha(cfg.color, 0.10),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {stop.completed
            ? <CheckCircleIcon sx={{ fontSize: 18, color: cfg.color }} />
            : <Icon sx={{ fontSize: 17, color: cfg.color }} />
          }
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{
              fontSize: '0.94rem',
              fontWeight: 800,
              color: D.navy,
              lineHeight: 1.35,
              fontFamily: D.body,
            }}>
              {stop.name}
            </Typography>

            {item.sortMins >= 0 && (
              <Typography sx={{
                fontSize: '0.74rem',
                flexShrink: 0,
                color: D.muted,
                fontFamily: D.body,
              }}>
                {fmtMins(item.sortMins)}
              </Typography>
            )}
          </Box>

          {stop.address && (
            <Typography sx={{
              fontSize: '0.78rem',
              color: D.muted,
              mt: 0.15,
              lineHeight: 1.4,
              fontFamily: D.body,
            }}>
              {stop.address}
            </Typography>
          )}

          {hasLoc && <MapButtons name={stop.name} address={stop.address} coordinates={stop.coordinates} />}
        </Box>
      </Box>
    );
  }

  if (item.kind === 'transport') {
    const { transport: t, event } = item;
    const TIcon  = TRANSPORT_ICON[t.type] ?? FlightIcon;
    const color  = t.type === 'flight' ? D.terra : t.type === 'train' ? '#0369a1' : D.green;
    const isArr  = event === 'arrival';
    const label  = isArr ? `Arrive ${t.arrivalLocation}` : `${TRANSPORT_LABEL[t.type] ?? 'Depart'} — ${t.departureLocation} → ${t.arrivalLocation}`;
    const time   = isArr ? t.arrivalTime : t.departureTime;
    const subline = t.type === 'flight'
      ? [t.details.airline, t.details.flightNumber].filter(Boolean).join(' ')
      : t.details.operator ?? '';

    return (
      <Box sx={{
        display: 'flex',
        gap: 1.5,
        py: 1.6,
        px: { xs: 2, sm: 2.5 },
        opacity: past ? 0.45 : 1,
      }}>
        <Box sx={{
          width: 36,
          height: 36,
          borderRadius: '10px',
          flexShrink: 0,
          mt: 0.15,
          backgroundColor: alpha(color, 0.10),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <TIcon sx={{ fontSize: 17, color }} />
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{
              fontSize: '0.94rem',
              fontWeight: 800,
              color: D.navy,
              lineHeight: 1.35,
              fontFamily: D.body,
            }}>
              {label}
            </Typography>

            {time && (
              <Typography sx={{
                fontSize: '0.74rem',
                flexShrink: 0,
                color: D.muted,
                fontFamily: D.body,
              }}>
                {fmtTime(time)}
              </Typography>
            )}
          </Box>

          {subline && (
            <Typography sx={{
              fontSize: '0.78rem',
              color: D.muted,
              mt: 0.15,
              lineHeight: 1.4,
              fontFamily: D.body,
            }}>
              {subline}
            </Typography>
          )}

          {t.confirmationNumber && (
            <Typography sx={{
              fontSize: '0.74rem',
              fontWeight: 800,
              color,
              display: 'block',
              mt: 0.35,
              fontFamily: D.body,
            }}>
              Ref: {t.confirmationNumber}
            </Typography>
          )}

          <Chip
            label={t.status.replace('_', ' ')}
            size="small"
            sx={{
              mt: 0.55,
              height: 18,
              fontSize: '0.65rem',
              fontWeight: 800,
              fontFamily: D.body,
              letterSpacing: '0.03em',
              backgroundColor: alpha(STATUS_COLOR[t.status] ?? '#6b7280', 0.10),
              color: STATUS_COLOR[t.status] ?? '#6b7280',
            }}
          />
        </Box>
      </Box>
    );
  }

  const { accom: a, event } = item;
  const isCheckIn = event === 'checkin';
  const EventIcon2 = isCheckIn ? LoginIcon : LogoutIcon;
  const color = '#5c35a0';

  return (
    <Box sx={{
      display: 'flex',
      gap: 1.5,
      py: 1.6,
      px: { xs: 2, sm: 2.5 },
      opacity: past ? 0.45 : 1,
    }}>
      <Box sx={{
        width: 36,
        height: 36,
        borderRadius: '10px',
        flexShrink: 0,
        mt: 0.15,
        backgroundColor: alpha(color, 0.10),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <EventIcon2 sx={{ fontSize: 17, color }} />
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={{
            fontSize: '0.94rem',
            fontWeight: 800,
            color: D.navy,
            lineHeight: 1.35,
            fontFamily: D.body,
          }}>
            {isCheckIn ? `Check in — ${a.name}` : `Check out — ${a.name}`}
          </Typography>
        </Box>

        {a.address && (
          <Typography sx={{
            fontSize: '0.78rem',
            color: D.muted,
            mt: 0.15,
            lineHeight: 1.4,
            fontFamily: D.body,
          }}>
            {a.address}
          </Typography>
        )}

        {a.confirmationNumber && (
          <Typography sx={{
            fontSize: '0.74rem',
            fontWeight: 800,
            color,
            display: 'block',
            mt: 0.35,
            fontFamily: D.body,
          }}>
            Ref: {a.confirmationNumber}
          </Typography>
        )}

        {a.address && <MapButtons name={a.name} address={a.address} />}
      </Box>
    </Box>
  );
}

// ─── Todo row ─────────────────────────────────────────────────────────────────

function TodoRow({ todo, onComplete }: { todo: Todo; onComplete: (id: string) => void }) {
  const [completing, setCompleting] = useState(false);
  const isPacking = todo.type === 'packing_advisory';
  const color = isPacking ? '#b45309' : D.navy;
  const isOverdue = todo.dueAt && new Date(todo.dueAt) < new Date();

  const handle = async () => {
    setCompleting(true);
    await onComplete(todo._id);
    setCompleting(false);
  };

  return (
    <Box sx={{
      display: 'flex',
      gap: 1.5,
      py: 1.6,
      px: { xs: 2, sm: 2.5 },
      alignItems: 'flex-start',
    }}>
      <IconButton
        size="small"
        onClick={handle}
        disabled={completing}
        sx={{
          p: 0.5,
          flexShrink: 0,
          mt: 0.15,
          color: D.muted,
        }}
      >
        {completing
          ? <CircularProgress size={20} sx={{ color: D.green }} />
          : <CheckBoxOutlineBlankIcon sx={{ fontSize: 22 }} />
        }
      </IconButton>

      <Box sx={{
        width: 3,
        alignSelf: 'stretch',
        borderRadius: 2,
        backgroundColor: isOverdue ? '#dc2626' : color,
        flexShrink: 0,
      }} />

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          {isPacking && <BoltIcon sx={{ fontSize: 14, color: '#b45309' }} />}

          <Typography sx={{
            fontSize: '0.94rem',
            fontWeight: 800,
            color: D.navy,
            lineHeight: 1.35,
            fontFamily: D.body,
          }}>
            {todo.name}
          </Typography>

          {isOverdue && (
            <Chip
              label="Overdue"
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                fontWeight: 800,
                fontFamily: D.body,
                letterSpacing: '0.03em',
                backgroundColor: alpha('#dc2626', 0.10),
                color: '#dc2626',
              }}
            />
          )}
        </Box>

        {todo.body && (
          <Typography sx={{
            fontSize: '0.78rem',
            display: 'block',
            mt: 0.2,
            color: D.muted,
            lineHeight: 1.45,
            fontFamily: D.body,
          }}>
            {todo.body.length > 120 ? `${todo.body.slice(0, 120)}…` : todo.body}
          </Typography>
        )}

        {todo.dueAt && (
          <Typography sx={{
            fontSize: '0.74rem',
            fontWeight: 700,
            color: isOverdue ? '#dc2626' : D.muted,
            display: 'block',
            mt: 0.3,
            fontFamily: D.body,
          }}>
            {isOverdue ? 'Was due' : 'Due'} {new Date(todo.dueAt).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OnTripScreen({ tripId, trip }: OnTripScreenProps) {
  const [itinerary,  setItinerary]  = useState<ItineraryDay[]>([]);
  const [logistics,  setLogistics]  = useState<{ transportation: Transport[]; accommodation: Accommodation[] } | null>(null);
  const [todos,      setTodos]      = useState<Todo[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now,        setNow]        = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const [itin, log, files] = await Promise.all([
        fetch(`/api/trips/${tripId}/itinerary`).then(r => r.json()),
        fetch(`/api/trips/${tripId}/logistics`).then(r => r.json()),
        fetch(`/api/trips/${tripId}/files`).then(r => r.json()),
      ]);
      setItinerary(itin.days ?? []);
      setLogistics(log.logistics ?? null);

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      setTodos(
        ((files.files ?? []) as any[])
          .filter(f =>
            f.resourceType === 'todo' &&
            !f.completed &&
            f.dueAt &&
            new Date(f.dueAt) <= todayEnd
          )
          .sort((a: any, b: any) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  const completeTodo = async (id: string) => {
    setTodos(prev => prev.filter(t => t._id !== id));
    try {
      await fetch(`/api/trips/${tripId}/files/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ completed: true }),
      });
    } catch {
      load(true);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const today   = todayIso();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const dayNum  = dayOfTrip(trip.startDate);
  const totalNights = trip.nights ?? tripNights(trip.startDate, trip.endDate);
  const totalDays   = totalNights + 1;

  const todayDay   = itinerary.find(d => d.date.split('T')[0] === today);
  const todayStops = todayDay?.stops ?? [];

  const timedStops = todayStops
    .map(s => ({ stop: s, startM: stopStartMinutes(s) }))
    .filter(x => x.startM !== null)
    .sort((a, b) => a.startM! - b.startM!);

  const inProgress = timedStops.find(x => {
    const endM = x.startM! + x.stop.duration;
    return nowMins >= x.startM! && nowMins < endM;
  });
  const nextUp = !inProgress ? timedStops.find(x => x.startM! > nowMins) : null;
  const rightNow = inProgress ?? nextUp ?? null;

  const timelineItems: TimelineItem[] = [];

  for (const stop of todayStops) {
    const startM = stopStartMinutes(stop) ?? -1;
    timelineItems.push({ kind: 'stop', sortMins: startM, stop });
  }

  for (const t of logistics?.transportation ?? []) {
    if (t.departureTime) {
      const depDate = t.departureTime.split('T')[0];
      if (depDate === today) {
        timelineItems.push({ kind: 'transport', sortMins: isoToMins(t.departureTime), transport: t, event: 'departure' });
      }
    }
    if (t.arrivalTime) {
      const arrDate = t.arrivalTime.split('T')[0];
      if (arrDate === today) {
        timelineItems.push({ kind: 'transport', sortMins: isoToMins(t.arrivalTime), transport: t, event: 'arrival' });
      }
    }
  }

  for (const a of logistics?.accommodation ?? []) {
    if (a.checkIn?.split('T')[0] === today) {
      const mins = a.checkIn.includes('T') ? isoToMins(a.checkIn) : 14 * 60;
      timelineItems.push({ kind: 'accom', sortMins: mins, accom: a, event: 'checkin' });
    }
    if (a.checkOut?.split('T')[0] === today) {
      const mins = a.checkOut.includes('T') ? isoToMins(a.checkOut) : 11 * 60;
      timelineItems.push({ kind: 'accom', sortMins: mins, accom: a, event: 'checkout' });
    }
  }

  const seenTransportKeys = new Set<string>();
  const dedupedTimeline = timelineItems
    .sort((a, b) => {
      const aM = a.sortMins < 0 ? 99999 : a.sortMins;
      const bM = b.sortMins < 0 ? 99999 : b.sortMins;
      return aM - bM;
    })
    .filter(item => {
      if (item.kind === 'stop' && item.stop.source === 'logistics') return false;
      if (item.kind === 'transport') {
        const key = `${item.transport.type}-${item.transport.departureLocation}-${item.transport.arrivalLocation}-${item.event}`;
        if (seenTransportKeys.has(key)) return false;
        seenTransportKeys.add(key);
      }
      return true;
    });

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={32} sx={{ color: D.green }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mb: 3 }}>
      {/* ── Header row ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{
            fontFamily: D.display,
            fontSize: { xs: '1.8rem', sm: '2rem' },
            color: D.navy,
            lineHeight: 1,
          }}>
            Day {dayNum}
          </Typography>

          <Typography sx={{
            fontSize: '0.85rem',
            color: D.muted,
            fontFamily: D.body,
            mt: 0.4,
          }}>
            {new Date(today).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })} · {dayNum} of {totalDays}
          </Typography>
        </Box>

        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={() => load(true)} disabled={refreshing} size="small">
              {refreshing
                ? <CircularProgress size={18} sx={{ color: D.green }} />
                : (
                  <RefreshIcon sx={{
                    fontSize: '1.1rem',
                    color: D.muted,
                    animation: refreshing ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': {
                      '0%':   { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }} />
                )
              }
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* ── 1. RIGHT NOW / UP NEXT ── */}
      {rightNow && (
        <Box>
          <SectionLabel>
            {inProgress ? 'Right now' : 'Up next'}
          </SectionLabel>
          <RightNowCard stop={rightNow.stop} startMins={rightNow.startM} nowMins={nowMins} />
        </Box>
      )}

      {/* ── 2. TODAY TIMELINE ── */}
      <Box>
        <SectionLabel>Today</SectionLabel>

        {dedupedTimeline.length > 0 ? (
          <Paper elevation={0} sx={{
            border: `1.5px solid ${D.rule}`,
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: D.paper,
          }}>
            {dedupedTimeline.map((item, i) => {
              const past = item.sortMins >= 0 && item.sortMins < nowMins;
              return (
                <Box key={i}>
                  {i > 0 && <Divider sx={{ borderColor: D.rule }} />}
                  <TimelineRow item={item} past={past} />
                </Box>
              );
            })}
          </Paper>
        ) : (
          <Paper elevation={0} sx={{
            p: 3,
            textAlign: 'center',
            border: `1.5px solid ${D.rule}`,
            borderRadius: '12px',
            backgroundColor: D.paper,
          }}>
            <Typography sx={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: D.muted,
              fontFamily: D.body,
            }}>
              Nothing scheduled for today
            </Typography>
          </Paper>
        )}
      </Box>

      {/* ── 3. ACTION NEEDED (todos due today / overdue) ── */}
      {todos.length > 0 && (
        <Box>
          <SectionLabel>
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
              <AssignmentIcon sx={{ fontSize: 14, color: D.muted }} />
              {'Action needed'}
            </Box>
          </SectionLabel>

          <Paper elevation={0} sx={{
            border: `1.5px solid ${D.rule}`,
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: D.paper,
          }}>
            {todos.map((todo, i) => (
              <Box key={todo._id}>
                {i > 0 && <Divider sx={{ borderColor: D.rule }} />}
                <TodoRow todo={todo} onComplete={completeTodo} />
              </Box>
            ))}
          </Paper>
        </Box>
      )}
    </Box>
  );
}