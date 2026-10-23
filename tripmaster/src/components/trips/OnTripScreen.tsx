'use client';

// The on-trip parts of the Overview tab. OnTripNow sits above the section
// summaries: the one thing happening now or next (rolling over to tomorrow's
// first stop once today is done), plus todos due today. OnTripGetAround sits
// below them: local ride and transit apps for wherever you've actually landed
// (nothing while you're still at home or on the way), and your own apps.

import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Chip, IconButton, Divider, alpha, Tooltip, Button,
} from '@mui/material';
import FlightIcon               from '@mui/icons-material/Flight';
import DirectionsBusIcon        from '@mui/icons-material/DirectionsBus';
import HotelIcon                from '@mui/icons-material/Hotel';
import EventIcon                from '@mui/icons-material/Event';
import WorkIcon                 from '@mui/icons-material/Work';
import RestaurantIcon           from '@mui/icons-material/Restaurant';
import ExploreIcon              from '@mui/icons-material/Explore';
import FreeBreakfastIcon        from '@mui/icons-material/FreeBreakfast';
import LocationOnIcon           from '@mui/icons-material/LocationOn';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import AssignmentIcon           from '@mui/icons-material/Assignment';
import BoltIcon                 from '@mui/icons-material/Bolt';
import CloseIcon                from '@mui/icons-material/Close';
import AttachFileIcon           from '@mui/icons-material/AttachFile';
import NavigateButton from '@/components/ui/NavigateButton';
import ArrivalTransportCard from '@/components/trips/ArrivalTransportCard';
import QuickLaunchCard from '@/components/trips/QuickLaunchCard';
import { sendOrQueue } from '@/lib/offline/writes';
import { readSaved, reportSaveFailure } from '@/lib/offline/saveErrors';
import { localYmd } from '@/lib/trips/onTrip';
import { buildLegs, placeAt } from '@/lib/push/journey';
import { placeTz } from '@/lib/push/timezones';
import { useFlights } from '@/lib/flights/useFlights';
import { stopNote, type Tone } from '@/lib/flights/status';
import { TONE } from '@/components/flights/FlightLive';

// ─── Design tokens ─────────────────────────────────────────────────────────────

const D = {
  green:   '#6B7C5C',
  terra:   '#C4714A',
  navy:    '#1D2642',
  paper:   '#FDFAF5',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  urgent:  '#ed6c02',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stop {
  _id?: string;
  name: string;
  type: string;
  reference?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  scheduledStart?: string;
  time?: string;
  duration: number;
  notes?: string;
  myNotes?: string;
  skipped?: boolean;
  logisticsRef?: { collection: string; index: number };
}

interface ItineraryDay {
  date: string;
  stops?: Stop[];
}

interface Todo {
  _id: string;
  name: string;
  body?: string;
  type: string;
  dueAt?: string;
}

type Place = { city?: string; country?: string; countryCode?: string; timezone?: string; iataCode?: string };

interface OnTripTrip {
  startDate: string;
  endDate: string;
  origin?: Place;
  destination: Place & { city: string };
  additionalDestinations?: Array<Place & { arrivalDate?: string; departureDate?: string }>;
}

type Pick = { stop: Stop; startM: number; when: 'now' | 'today' | 'tomorrow' };

// ─── Config ───────────────────────────────────────────────────────────────────

const STOP_CONFIG: Record<string, { color: string; Icon: any }> = {
  flight:      { color: D.terra,   Icon: FlightIcon },
  hotel:       { color: '#5c35a0', Icon: HotelIcon },
  meeting:     { color: D.navy,    Icon: WorkIcon },
  meal:        { color: '#b45309', Icon: RestaurantIcon },
  breakfast:   { color: '#b45309', Icon: FreeBreakfastIcon },
  activity:    { color: D.green,   Icon: ExploreIcon },
  sightseeing: { color: D.green,   Icon: ExploreIcon },
  transport:   { color: '#0369a1', Icon: DirectionsBusIcon },
  work:        { color: D.navy,    Icon: WorkIcon },
  other:       { color: '#6b7280', Icon: EventIcon },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const mins = ((totalMins % 1440) + 1440) % 1440;
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

function fmtSpan(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function stopKey(s: Stop): string {
  return s._id ?? `${s.name}@${s.scheduledStart ?? s.time ?? ''}`;
}

// ─── Now card ─────────────────────────────────────────────────────────────────

function NowCard({ pick, nowMins, linkedFiles, onOpenFile, onDismiss, live }: {
  pick: Pick; nowMins: number;
  linkedFiles: any[]; onOpenFile: (f: any) => void;
  onDismiss?: () => void;
  live?: { text: string; tone: Tone } | null;
}) {
  const { stop, startM, when } = pick;
  const cfg    = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
  const Icon   = cfg.Icon;
  const endM   = startM + (stop.duration || 0);
  const wait   = startM - nowMins;
  const urgent = when === 'today' && wait <= 30;
  const accent = urgent ? D.urgent : D.green;
  const hasLoc = !!(stop.address || stop.coordinates);

  const label =
    when === 'now'      ? `Right now · ${fmtSpan(endM - nowMins)} left` :
    when === 'tomorrow' ? `Tomorrow · ${fmtMins(startM)}` :
    urgent              ? `Starting in ${fmtSpan(wait)}` :
                          `Next up · ${fmtMins(startM)} · in ${fmtSpan(wait)}`;

  return (
    <Paper elevation={0} sx={{
      overflow: 'hidden',
      border: '1.5px solid',
      borderColor: alpha(accent, 0.45),
      borderRadius: '12px',
      backgroundColor: D.paper,
    }}>
      <Box sx={{ height: 4, background: urgent ? 'linear-gradient(90deg, #ed6c02, #fbbf24)' : 'linear-gradient(90deg, #6B7C5C, #9aad89)' }} />
      <Box sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', gap: 1.75 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: '10px', flexShrink: 0,
          backgroundColor: alpha(cfg.color, 0.12),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon sx={{ fontSize: 22, color: cfg.color }} />
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 20 }}>
            <Typography sx={{
              fontFamily: D.body, fontSize: '0.72rem', fontWeight: 700,
              letterSpacing: '0.10em', textTransform: 'uppercase', color: accent,
            }}>
              {label}
            </Typography>
            {onDismiss && (
              <Tooltip title="Done — show what's after">
                <IconButton
                  aria-label="Done — show what's after"
                  onClick={onDismiss}
                  sx={{ width: 44, height: 44, m: -1.5, color: D.muted, '&:hover': { color: D.navy } }}
                >
                  <CloseIcon sx={{ fontSize: '1.1rem' }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          <Typography sx={{
            fontFamily: D.display, fontSize: { xs: '1.25rem', sm: '1.4rem' },
            color: D.navy, lineHeight: 1.15, letterSpacing: '-0.02em', mt: 0.5,
          }}>
            {stop.name}
          </Typography>

          {live && (
            <Typography sx={{ fontFamily: D.body, fontSize: '0.95rem', fontWeight: 800, color: TONE[live.tone], mt: 0.5 }}>
              {live.text}
            </Typography>
          )}

          {endM > startM && (
            <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: D.muted, mt: 0.25 }}>
              {when === 'now' ? `Until ${fmtMins(endM)}` : `${fmtMins(startM)}–${fmtMins(endM)}`}
            </Typography>
          )}

          {stop.reference && (
            <Box sx={{
              display: 'inline-flex', alignItems: 'center',
              mt: 0.75, px: 1.25, py: 0.4, borderRadius: '6px',
              backgroundColor: 'rgba(3,105,161,0.10)',
              border: '1.5px solid rgba(3,105,161,0.3)',
            }}>
              <Typography sx={{ fontFamily: D.body, fontSize: '0.9rem', fontWeight: 800, color: '#0369a1', letterSpacing: '0.03em', lineHeight: 1.3 }}>
                {stop.reference}
              </Typography>
            </Box>
          )}

          {stop.address && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
              <LocationOnIcon sx={{ fontSize: 14, color: D.muted }} />
              <Typography sx={{ fontFamily: D.body, fontSize: '0.8rem', color: D.muted, lineHeight: 1.4 }}>
                {stop.address}
              </Typography>
            </Box>
          )}

          {stop.notes && (
            <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted, mt: 0.5, fontStyle: 'italic', lineHeight: 1.45 }}>
              {stop.notes}
            </Typography>
          )}

          {/* Your note — what you wanted to bring up, in front of you as it starts */}
          {stop.myNotes?.trim() && (
            <Typography sx={{
              fontFamily: D.body, fontSize: '0.88rem', color: D.navy, mt: 1, lineHeight: 1.5, whiteSpace: 'pre-wrap',
              pl: 1.25, borderLeft: `3px solid ${alpha(D.navy, 0.15)}`,
              display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 6, overflow: 'hidden',
            }}>
              {stop.myNotes.trim()}
            </Typography>
          )}

          {(hasLoc || linkedFiles.length > 0) && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              {hasLoc && (
                <NavigateButton
                  destination={{ name: stop.name, address: stop.address, coordinates: stop.coordinates ?? null }}
                  suggestedMode="walking" variant="button" label="Navigate"
                />
              )}
              {linkedFiles.map((f: any) => (
                <Button
                  key={f._id}
                  startIcon={<AttachFileIcon sx={{ fontSize: '0.9rem !important' }} />}
                  onClick={() => onOpenFile(f)}
                  sx={{
                    fontFamily: D.body, fontSize: '0.78rem', fontWeight: 700, textTransform: 'none',
                    minHeight: 44, px: 1.5,
                    backgroundColor: 'rgba(8,145,178,0.08)', color: '#0891b2',
                    border: '1px solid rgba(8,145,178,0.2)', borderRadius: '8px',
                    '&:hover': { backgroundColor: 'rgba(8,145,178,0.14)' },
                  }}
                >
                  {f.name.length > 24 ? `${f.name.slice(0, 24)}…` : f.name}
                </Button>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

// ─── Todo row ─────────────────────────────────────────────────────────────────

function TodoRow({ todo, now, onComplete }: { todo: Todo; now: Date; onComplete: (todo: Todo) => void }) {
  const isPacking = todo.type === 'packing_advisory';
  const color     = isPacking ? '#b45309' : D.navy;
  const isOverdue = !!todo.dueAt && new Date(todo.dueAt) < now;

  return (
    <Box sx={{ display: 'flex', gap: 1, py: 1, pr: { xs: 2, sm: 2.5 }, pl: 0.5, alignItems: 'flex-start' }}>
      <IconButton aria-label={`Mark “${todo.name}” done`} onClick={() => onComplete(todo)}
        sx={{ width: 44, height: 44, flexShrink: 0, color: D.muted }}>
        <CheckBoxOutlineBlankIcon sx={{ fontSize: 22 }} />
      </IconButton>

      <Box sx={{ width: 3, alignSelf: 'stretch', my: 0.75, borderRadius: 2, backgroundColor: isOverdue ? '#dc2626' : color, flexShrink: 0 }} />

      <Box sx={{ flexGrow: 1, minWidth: 0, py: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          {isPacking && <BoltIcon sx={{ fontSize: 14, color: '#b45309' }} />}
          <Typography sx={{ fontFamily: D.body, fontSize: '0.94rem', fontWeight: 800, color: D.navy, lineHeight: 1.35 }}>
            {todo.name}
          </Typography>
          {isOverdue && (
            <Chip label="Overdue" size="small" sx={{
              height: 18, fontSize: '0.65rem', fontWeight: 800, fontFamily: D.body, letterSpacing: '0.03em',
              backgroundColor: alpha('#dc2626', 0.10), color: '#dc2626',
            }} />
          )}
        </Box>

        {todo.body && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', mt: 0.2, color: D.muted, lineHeight: 1.45 }}>
            {todo.body.length > 120 ? `${todo.body.slice(0, 120)}…` : todo.body}
          </Typography>
        )}

        {todo.dueAt && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.74rem', fontWeight: 700, mt: 0.3, color: isOverdue ? '#dc2626' : D.muted }}>
            {isOverdue ? 'Was due' : 'Due'} {new Date(todo.dueAt).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ─── Now + due today ──────────────────────────────────────────────────────────

export function OnTripNow({ tripId, days, files, now, onFilesChange, onOpenFile }: {
  tripId: string;
  days:   ItineraryDay[];
  files:  any[];
  now:    Date;
  onFilesChange: (update: (files: any[]) => any[]) => void;
  onOpenFile:    (f: any) => void;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const flights = useFlights(tripId);

  const nowMins  = now.getHours() * 60 + now.getMinutes();
  const today    = localYmd(now);
  const tomorrow = localYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  const timedOn = (date: string) =>
    (days.find(d => String(d.date).slice(0, 10) === date)?.stops ?? [])
      .filter(s => !s.skipped)
      .map(stop => ({ stop, startM: stopStartMinutes(stop) }))
      .filter((x): x is { stop: Stop; startM: number } => x.startM !== null)
      .sort((a, b) => a.startM - b.startM);

  const todayTimed = timedOn(today);
  const inProgress = todayTimed.find(x => nowMins >= x.startM && nowMins < x.startM + (x.stop.duration || 0));
  const nextToday  = [
    ...(inProgress ? [inProgress] : []),
    ...todayTimed.filter(x => x !== inProgress && x.startM >= nowMins),
  ].find(x => !dismissed.has(stopKey(x.stop)));
  const firstTomorrow = timedOn(tomorrow)[0];

  const pick: Pick | null =
    nextToday     ? { ...nextToday, when: nextToday === inProgress ? 'now' : 'today' } :
    firstTomorrow ? { ...firstTomorrow, when: 'tomorrow' } :
    null;

  // Files attached to the stop itself or to the booking it mirrors.
  const ref = pick?.stop.logisticsRef;
  const linkedFiles = pick ? files.filter(f =>
    f.resourceType === 'file' && !!f.linkedTo?.entryId && (
      f.linkedTo.entryId === pick.stop._id ||
      (!!ref && f.linkedTo.collection === ref.collection && f.linkedTo.entryId === String(ref.index))
    )) : [];

  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const todos: Todo[] = files
    .filter(f => f.resourceType === 'todo' && !f.completed && f.dueAt && new Date(f.dueAt) <= endOfToday)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  const setCompleted = (id: string, completed: boolean) =>
    onFilesChange(fs => fs.map(f => (f._id === id ? { ...f, completed } : f)));

  // Leaves the list at once; comes back, with an error toast, if it doesn't save.
  const completeTodo = async (todo: Todo) => {
    setCompleted(todo._id, true);
    try {
      const res = await sendOrQueue(
        { type: 'COMPLETE_TODO', tripId, fileId: todo._id },
        () => fetch(`/api/trips/${tripId}/files/${todo._id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ completed: true }),
        }),
        {
          [`/api/trips/${tripId}/files`]: saved => saved?.files && {
            ...saved,
            files: saved.files.map((f: any) => (f._id === todo._id ? { ...f, completed: true } : f)),
          },
        },
      );
      if (!res) return;
      const data = await readSaved(res);
      if (!data.file) throw new Error('No file in response');
    } catch (err) {
      setCompleted(todo._id, false);
      reportSaveFailure(`“${todo.name}” as done`, err);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
      {pick ? (
        <NowCard
          pick={pick}
          nowMins={nowMins}
          linkedFiles={linkedFiles}
          onOpenFile={onOpenFile}
          onDismiss={pick.when === 'tomorrow' ? undefined : () => setDismissed(prev => new Set([...prev, stopKey(pick.stop)]))}
          live={ref?.collection === 'transport' && flights[ref.index]
            ? stopNote(flights[ref.index], (pick.stop as any).metadata?.phase)
            : null}
        />
      ) : (
        <Box sx={{ p: 2.5, border: `1.5px solid ${alpha(D.green, 0.4)}`, borderRadius: '12px', bgcolor: alpha(D.green, 0.04) }}>
          <Typography sx={{ fontFamily: D.display, fontSize: '0.9rem', color: D.green }}>Nothing more scheduled</Typography>
        </Box>
      )}

      {todos.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
            <AssignmentIcon sx={{ fontSize: 14, color: D.muted }} />
            <Typography sx={{
              fontFamily: D.body, fontSize: '0.72rem', fontWeight: 700,
              letterSpacing: '0.10em', textTransform: 'uppercase', color: D.muted,
            }}>
              Due today
            </Typography>
          </Box>
          <Paper elevation={0} sx={{ border: `1.5px solid ${D.rule}`, borderRadius: '12px', overflow: 'hidden', backgroundColor: D.paper }}>
            {todos.map((todo, i) => (
              <Box key={todo._id}>
                {i > 0 && <Divider sx={{ borderColor: D.rule }} />}
                <TodoRow todo={todo} now={now} onComplete={completeTodo} />
              </Box>
            ))}
          </Paper>
        </Box>
      )}
    </Box>
  );
}

// ─── Get around + my apps ─────────────────────────────────────────────────────

export function OnTripGetAround({ trip, transportation, now }: {
  trip: OnTripTrip;
  transportation: any[];
  now: Date;
}) {
  const [myAppIds, setMyAppIds] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/user/my-apps').then(r => r.json()).then(data => {
      if (Array.isArray(data.myApps)) setMyAppIds(data.myApps);
    }).catch(() => {});
  }, []);

  const home = useMemo(
    () => ({ countryCode: trip.origin?.countryCode ?? null, zone: placeTz(trip.origin) ?? undefined }),
    [trip.origin],
  );
  const legs  = useMemo(() => buildLegs(trip, transportation, home), [trip, transportation, home]);
  const place = placeAt(trip, legs, home, now.getTime());

  if (!place?.countryCode && myAppIds.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {place?.countryCode && <ArrivalTransportCard countryCode={place.countryCode} cityName={place.city} />}
      <QuickLaunchCard myAppIds={myAppIds} onlyTransport />
    </Box>
  );
}
