'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, IconButton, Chip, CircularProgress,
  Tooltip, Drawer, Divider, alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import LocalTaxiIcon from '@mui/icons-material/LocalTaxi';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LockIcon from '@mui/icons-material/Lock';
import WorkIcon from '@mui/icons-material/Work';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import ExploreIcon from '@mui/icons-material/Explore';
import FlightIcon from '@mui/icons-material/Flight';
import HotelIcon from '@mui/icons-material/Hotel';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import EventIcon from '@mui/icons-material/Event';
import FreeBreakfastIcon from '@mui/icons-material/FreeBreakfast';

// ─── Constants ────────────────────────────────────────────────────────────────
const DAY_START_HOUR = 7;     // 7am
const DAY_END_HOUR   = 24;    // midnight
const PX_PER_MIN     = 1.2;   // pixels per minute — controls timeline density
const TOTAL_MINS     = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const TIMELINE_H     = TOTAL_MINS * PX_PER_MIN;
const HOUR_H         = 60 * PX_PER_MIN;

// ─── Colour & icon map per stop type ─────────────────────────────────────────
const STOP_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  flight:      { label: '✈️ Flight',       color: '#C9521B', bg: '#FFF0EB', Icon: FlightIcon },
  hotel:       { label: '🏨 Accommodation', color: '#5c35a0', bg: '#F3EEFF', Icon: HotelIcon },
  meeting:     { label: '💼 Meeting',       color: '#1D2642', bg: '#E8EAF0', Icon: WorkIcon },
  meal:        { label: '🍽️ Meal',          color: '#b45309', bg: '#FFFBEB', Icon: RestaurantIcon },
  breakfast:   { label: '☕ Breakfast',     color: '#b45309', bg: '#FFFBEB', Icon: FreeBreakfastIcon },
  activity:    { label: '🎯 Activity',      color: '#55702C', bg: '#F0F5E8', Icon: ExploreIcon },
  sightseeing: { label: '📸 Sightseeing',  color: '#55702C', bg: '#F0F5E8', Icon: ExploreIcon },
  transport:   { label: '🚌 Transport',     color: '#0369a1', bg: '#E0F2FE', Icon: DirectionsBusIcon },
  work:        { label: '💻 Work block',   color: '#1D2642', bg: '#E8EAF0', Icon: WorkIcon },
  other:       { label: '📍 Other',        color: '#6b7280', bg: '#F3F4F6', Icon: EventIcon },
};

const QUICK_ADD_TYPES = [
  'meeting', 'meal', 'breakfast', 'activity', 'sightseeing', 'transport', 'work', 'other'
];

const DEFAULT_DURATIONS: Record<string, number> = {
  flight: 180, hotel: 0, meeting: 60, meal: 75, breakfast: 45,
  activity: 120, sightseeing: 90, transport: 45, work: 120, other: 60,
};

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Stop {
  _id?: string;
  name: string;
  type: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  scheduledStart?: string;
  time?: string;          // HH:MM — used by logistics-synced stops
  duration: number;
  notes?: string;
  completed?: boolean;
  source?: string;        // 'logistics' = locked
  icon?: string;
  travelToNext?: {
    duration: number;
    mode: string;
    isTight: boolean;
    isImpossible: boolean;
    distance: number;
  };
}

interface Day {
  date: string;
  dayNumber: number;
  stops: Stop[];
}

interface Props {
  tripId: string;
  startDate: string;
  endDate: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stopStartMinutes(stop: Stop): number | null {
  // scheduledStart is ISO datetime, time is HH:MM
  const timeStr = stop.scheduledStart
    ? stop.scheduledStart.includes('T')
      ? stop.scheduledStart.split('T')[1]?.slice(0, 5)
      : stop.scheduledStart
    : stop.time;
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToPx(minutes: number): number {
  return (minutes - DAY_START_HOUR * 60) * PX_PER_MIN;
}

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function freeSlots(stops: Stop[]): { start: number; end: number; mins: number }[] {
  const placed = stops
    .map(s => ({ start: stopStartMinutes(s), dur: s.duration ?? 60 }))
    .filter(s => s.start !== null)
    .map(s => ({ start: s.start!, end: s.start! + s.dur }))
    .sort((a, b) => a.start - b.start);

  const slots: { start: number; end: number; mins: number }[] = [];
  let cursor = DAY_START_HOUR * 60;

  for (const block of placed) {
    if (block.start > cursor + 15) {
      slots.push({ start: cursor, end: block.start, mins: block.start - cursor });
    }
    cursor = Math.max(cursor, block.end);
  }
  if (cursor < DAY_END_HOUR * 60 - 15) {
    slots.push({ start: cursor, end: DAY_END_HOUR * 60, mins: DAY_END_HOUR * 60 - cursor });
  }
  return slots;
}

function totalFreeMinutes(stops: Stop[]): number {
  return freeSlots(stops).reduce((s, f) => s + f.mins, 0);
}

// ─── Hour ruler ───────────────────────────────────────────────────────────────
function HourRuler() {
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);
  return (
    <Box sx={{ position: 'relative', width: 52, flexShrink: 0, userSelect: 'none' }}>
      {hours.map(h => (
        <Box key={h} sx={{ position: 'absolute', top: (h - DAY_START_HOUR) * HOUR_H - 9, right: 8 }}>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem', fontVariantNumeric: 'tabular-nums' }}>
            {h === 24 ? '00:00' : `${String(h).padStart(2, '0')}:00`}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ─── Hour grid lines ──────────────────────────────────────────────────────────
function GridLines() {
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => i);
  return (
    <>
      {hours.map(i => (
        <Box key={i} sx={{
          position: 'absolute', top: i * HOUR_H, left: 0, right: 0,
          borderTop: '1px solid', borderColor: 'divider', pointerEvents: 'none',
        }} />
      ))}
      {/* Half-hour dashes */}
      {hours.map(i => (
        <Box key={`half-${i}`} sx={{
          position: 'absolute', top: i * HOUR_H + HOUR_H / 2, left: 0, right: 0,
          borderTop: '1px dashed', borderColor: alpha('#000', 0.04), pointerEvents: 'none',
        }} />
      ))}
    </>
  );
}

// ─── Single stop block ────────────────────────────────────────────────────────
function StopBlock({
  stop, onDelete, onClick,
}: {
  stop: Stop;
  onDelete?: () => void;
  onClick?: () => void;
}) {
  const startMin = stopStartMinutes(stop);
  if (startMin === null) return null;

  const top    = minutesToPx(startMin);
  const height = Math.max((stop.duration ?? 60) * PX_PER_MIN, 28);
  const cfg    = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
  const isLocked = stop.source === 'logistics';
  const tall   = height > 50;

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'absolute', left: 0, right: 4, top,
        height, zIndex: 2,
        backgroundColor: cfg.bg,
        borderLeft: `3px solid ${cfg.color}`,
        borderRadius: '0 6px 6px 0',
        px: 1, py: 0.4,
        display: 'flex', alignItems: 'flex-start', gap: 0.5,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        cursor: isLocked ? 'default' : 'pointer',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: isLocked ? undefined : '0 2px 8px rgba(0,0,0,0.14)' },
      }}
    >
      <Box sx={{ flexGrow: 1, overflow: 'hidden', minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {stop.icon && <Typography sx={{ fontSize: '0.8rem', lineHeight: 1, flexShrink: 0 }}>{stop.icon}</Typography>}
          <Typography
            sx={{
              fontSize: '0.75rem', fontWeight: 700, color: cfg.color,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {stop.name}
          </Typography>
          {isLocked && <LockIcon sx={{ fontSize: 10, color: cfg.color, opacity: 0.6, flexShrink: 0 }} />}
        </Box>
        {tall && (
          <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', lineHeight: 1.2, mt: 0.2 }}>
            {formatTime(startMin)} · {stop.duration}min
            {stop.notes && ` · ${stop.notes}`}
          </Typography>
        )}
      </Box>
      {!isLocked && onDelete && (
        <IconButton
          size="small"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          sx={{ p: 0.2, flexShrink: 0, color: cfg.color, opacity: 0.5, '&:hover': { opacity: 1 } }}
        >
          <DeleteIcon sx={{ fontSize: 13 }} />
        </IconButton>
      )}
    </Box>
  );
}

// ─── Free time gap label ──────────────────────────────────────────────────────
function FreeGap({ slot, onQuickAdd }: { slot: { start: number; end: number; mins: number }; onQuickAdd: (time: string) => void }) {
  if (slot.mins < 30) return null;
  const top    = minutesToPx(slot.start);
  const height = slot.mins * PX_PER_MIN;
  const h      = Math.floor(slot.mins / 60);
  const m      = slot.mins % 60;
  const label  = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''} free` : `${m}m free`;

  return (
    <Box
      onClick={() => onQuickAdd(formatTime(slot.start))}
      sx={{
        position: 'absolute', left: 0, right: 4, top, height,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', zIndex: 1,
        '&:hover .free-label': { opacity: 1 },
        '&:hover': { backgroundColor: alpha('#55702C', 0.04) },
        borderRadius: 1,
      }}
    >
      <Typography
        className="free-label"
        variant="caption"
        sx={{
          opacity: 0, transition: 'opacity 0.15s',
          color: 'text.disabled', fontSize: '0.7rem',
          backgroundColor: 'background.paper',
          border: '1px dashed', borderColor: 'divider',
          px: 1, py: 0.25, borderRadius: 4,
        }}
      >
        + {label}
      </Typography>
    </Box>
  );
}

// ─── Travel connector ─────────────────────────────────────────────────────────
function TravelConnector({ stop }: { stop: Stop }) {
  const t = stop.travelToNext;
  if (!t) return null;
  const start = stopStartMinutes(stop);
  if (start === null) return null;
  const top = minutesToPx(start + (stop.duration ?? 60));

  return (
    <Box sx={{
      position: 'absolute', left: 0, right: 4, top, zIndex: 3,
      height: Math.max(t.duration * PX_PER_MIN, 18),
      display: 'flex', alignItems: 'center',
      backgroundColor: t.isImpossible ? alpha('#ef4444', 0.08) : t.isTight ? alpha('#f59e0b', 0.08) : 'transparent',
      px: 1,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {t.isImpossible
          ? <WarningAmberIcon sx={{ fontSize: 12, color: 'error.main' }} />
          : t.mode === 'walk'
          ? <DirectionsWalkIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
          : <LocalTaxiIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
        }
        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: t.isImpossible ? 'error.main' : t.isTight ? 'warning.dark' : 'text.disabled' }}>
          {t.duration}min · {(t.distance / 1000).toFixed(1)}km
          {t.isTight && ' ⚠️'}
          {t.isImpossible && ' 🚨'}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Add stop drawer ──────────────────────────────────────────────────────────
function AddStopDrawer({
  open, onClose, onAdd, defaultTime, defaultType,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (stop: Partial<Stop>) => Promise<void>;
  defaultTime: string;
  defaultType: string;
}) {
  const [form, setForm] = useState({
    name: '', type: defaultType, scheduledStart: defaultTime, duration: 60, notes: '', address: '',
    coordinates: undefined as { lat: number; lng: number } | undefined,
  });
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [locationQuery, setLocationQuery] = useState('');

  useEffect(() => {
    setForm(f => ({
      ...f, type: defaultType, scheduledStart: defaultTime,
      duration: DEFAULT_DURATIONS[defaultType] ?? 60,
    }));
    setLocationQuery('');
    setSuggestions([]);
  }, [defaultTime, defaultType, open]);

  const searchLocation = async (q: string) => {
    setLocationQuery(q);
    if (q.length < 3) { setSuggestions([]); return; }
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}&types=poi,address,place&limit=5`
    );
    const data = await res.json();
    setSuggestions(data.features ?? []);
  };

  const selectLocation = (f: any) => {
    setForm(p => ({ ...p, name: p.name || f.text, address: f.place_name, coordinates: { lng: f.center[0], lat: f.center[1] } }));
    setLocationQuery(f.place_name);
    setSuggestions([]);
  };

  const submit = async () => {
    setSaving(true);
    await onAdd(form);
    setSaving(false);
    onClose();
  };

  const cfg = STOP_CONFIG[form.type] ?? STOP_CONFIG.other;

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: 380, p: 3 } }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>Add to day</Typography>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      {/* Type picker */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        {QUICK_ADD_TYPES.map(t => {
          const c = STOP_CONFIG[t];
          return (
            <Chip
              key={t}
              label={c.label}
              size="small"
              onClick={() => setForm(f => ({ ...f, type: t, duration: DEFAULT_DURATIONS[t] ?? 60 }))}
              sx={{
                borderColor: c.color,
                backgroundColor: form.type === t ? c.bg : 'transparent',
                color: c.color,
                fontWeight: form.type === t ? 700 : 400,
                border: '1px solid',
              }}
            />
          );
        })}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Name"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          fullWidth
          autoFocus
          placeholder={`e.g. ${cfg.label.split(' ').slice(1).join(' ')} with client`}
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Start time"
            type="time"
            value={form.scheduledStart}
            onChange={e => setForm(f => ({ ...f, scheduledStart: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Duration (min)"
            type="number"
            value={form.duration}
            onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))}
            fullWidth
            inputProps={{ min: 5, step: 5 }}
          />
        </Box>

        {/* Location search */}
        <Box sx={{ position: 'relative' }}>
          <TextField
            label="Location (optional)"
            value={locationQuery}
            onChange={e => searchLocation(e.target.value)}
            fullWidth
            placeholder="Search for a place..."
          />
          {suggestions.length > 0 && (
            <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, maxHeight: 180, overflow: 'auto', boxShadow: 4 }}>
              {suggestions.map((f, i) => (
                <Box key={i} onClick={() => selectLocation(f)}
                  sx={{ px: 2, py: 1.5, cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' }, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" fontWeight={600}>{f.text}</Typography>
                  <Typography variant="caption" color="text.secondary">{f.place_name}</Typography>
                </Box>
              ))}
            </Paper>
          )}
        </Box>

        <TextField
          label="Notes"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          fullWidth
          multiline
          rows={2}
          placeholder="Any details, links, confirmation numbers..."
        />

        <Button
          variant="contained"
          onClick={submit}
          disabled={!form.name || saving}
          sx={{ mt: 1 }}
          fullWidth
        >
          {saving ? <CircularProgress size={20} /> : 'Add to itinerary'}
        </Button>
      </Box>
    </Drawer>
  );
}

// ─── Main ItineraryTab ────────────────────────────────────────────────────────
export default function ItineraryTab({ tripId, startDate, endDate }: Props) {
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [calculating, setCalculating] = useState(false);
  const [drawer, setDrawer] = useState<{ open: boolean; time: string; type: string }>({
    open: false, time: '09:00', type: 'activity',
  });

  useEffect(() => {
    fetch(`/api/trips/${tripId}/itinerary`)
      .then(r => r.json())
      .then(d => { setDays(d.days ?? []); setLoading(false); });
  }, [tripId]);

  const activeDay = days[activeDayIdx];

  const openDrawer = (time: string, type = 'activity') => setDrawer({ open: true, time, type });

  const addStop = async (stop: Partial<Stop>) => {
    const day = days[activeDayIdx];
    const res = await fetch(`/api/trips/${tripId}/itinerary/stops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dayDate: day.date,
        stop: {
          ...stop,
          scheduledStart: `${day.date.split('T')[0]}T${stop.scheduledStart}:00`,
        },
      }),
    });
    const data = await res.json();
    setDays(data.days);
  };

  const deleteStop = async (stopId: string) => {
    const res = await fetch(`/api/trips/${tripId}/itinerary/stops/${stopId}`, { method: 'DELETE' });
    const data = await res.json();
    setDays(data.days);
  };

  const calculateTravel = async () => {
    setCalculating(true);
    const res = await fetch(`/api/trips/${tripId}/itinerary/calculate-travel`, { method: 'POST' });
    const data = await res.json();
    setDays(data.days);
    setCalculating(false);
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (!days.length) return <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No itinerary days found.</Typography>;

  const free = activeDay ? totalFreeMinutes(activeDay.stops) : 0;
  const freeH = Math.floor(free / 60);
  const freeM = free % 60;
  const freeLabel = freeH > 0 ? `${freeH}h${freeM > 0 ? ` ${freeM}m` : ''} free` : `${freeM}m free`;

  return (
    <Box>
      {/* ── Top bar ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight={700}>Day by Day</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined" size="small"
            onClick={calculateTravel}
            disabled={calculating}
            startIcon={calculating ? <CircularProgress size={14} /> : <DirectionsWalkIcon />}
          >
            {calculating ? 'Calculating...' : 'Calculate A-to-B'}
          </Button>
          <Button
            variant="contained" size="small"
            startIcon={<AddIcon />}
            onClick={() => openDrawer('09:00', 'activity')}
          >
            Add
          </Button>
        </Box>
      </Box>

      {/* ── Day selector ── */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, overflowX: 'auto', pb: 0.5,
        '&::-webkit-scrollbar': { height: 4 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: 'divider', borderRadius: 2 },
      }}>
        {days.map((day, i) => {
          const d   = new Date(day.date);
          const dow = d.toLocaleDateString('en-IE', { weekday: 'short' });
          const dom = d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
          const hasStops = day.stops.length > 0;
          const active = i === activeDayIdx;
          return (
            <Box
              key={day.date}
              onClick={() => setActiveDayIdx(i)}
              sx={{
                flexShrink: 0, px: 2, py: 1.25, borderRadius: 2, cursor: 'pointer',
                border: '2px solid', transition: 'all 0.15s',
                borderColor: active ? 'primary.main' : 'divider',
                backgroundColor: active ? 'primary.main' : 'background.paper',
                color: active ? 'white' : 'text.primary',
                '&:hover': { borderColor: 'primary.main' },
              }}
            >
              <Typography variant="caption" display="block" sx={{ opacity: 0.8, fontWeight: 600, textAlign: 'center' }}>
                {dow}
              </Typography>
              <Typography variant="body2" fontWeight={700} textAlign="center">{dom}</Typography>
              {hasStops && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: active ? 'rgba(255,255,255,0.7)' : 'primary.main' }} />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* ── Day header ── */}
      {activeDay && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={800}>
              Day {activeDay.dayNumber} —{' '}
              {new Date(activeDay.date).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Chip
                size="small"
                label={`${activeDay.stops.filter(s => s.source !== 'logistics').length} planned`}
                sx={{ backgroundColor: alpha('#55702C', 0.1), color: '#55702C', fontWeight: 600 }}
              />
              <Chip
                size="small"
                label={freeLabel}
                sx={{ backgroundColor: alpha('#1D2642', 0.06), color: '#1D2642', fontWeight: 600 }}
              />
              {activeDay.stops.filter(s => s.source === 'logistics').length > 0 && (
                <Chip
                  size="small"
                  icon={<LockIcon sx={{ fontSize: 11 }} />}
                  label={`${activeDay.stops.filter(s => s.source === 'logistics').length} from logistics`}
                  sx={{ backgroundColor: alpha('#C9521B', 0.08), color: '#C9521B', fontWeight: 600 }}
                />
              )}
            </Box>
          </Box>
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => openDrawer('09:00', 'meeting')}>
            Quick add
          </Button>
        </Box>
      )}

      {/* ── Quick add type row ── */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
        {QUICK_ADD_TYPES.slice(0, 5).map(t => {
          const c = STOP_CONFIG[t];
          return (
            <Chip
              key={t}
              label={c.label}
              size="small"
              onClick={() => openDrawer('09:00', t)}
              variant="outlined"
              sx={{ borderColor: alpha(c.color, 0.4), color: c.color, '&:hover': { backgroundColor: c.bg } }}
            />
          );
        })}
      </Box>

      {/* ── Timeline ── */}
      {activeDay && (
        <Paper sx={{ backgroundColor: 'background.paper', overflow: 'hidden', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', position: 'relative', height: TIMELINE_H + 32 }}>

            {/* Hour ruler */}
            <Box sx={{ flexShrink: 0, width: 52, position: 'relative', borderRight: '1px solid', borderColor: 'divider', pt: 2 }}>
              <HourRuler />
            </Box>

            {/* Main timeline column */}
            <Box
              sx={{ flex: 1, position: 'relative', pt: 2, pb: 2, cursor: 'crosshair' }}
              onClick={e => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const relY = e.clientY - rect.top - 16; // account for pt:2 (16px)
                const mins = Math.round(relY / PX_PER_MIN / 15) * 15 + DAY_START_HOUR * 60;
                const clamped = Math.max(DAY_START_HOUR * 60, Math.min(DAY_END_HOUR * 60 - 30, mins));
                openDrawer(formatTime(clamped));
              }}
            >
              <GridLines />

              {/* Free time gaps */}
              {freeSlots(activeDay.stops).map((slot, i) => (
                <FreeGap
                  key={i}
                  slot={slot}
                  onQuickAdd={time => openDrawer(time)}
                />
              ))}

              {/* Stop blocks */}
              {activeDay.stops.map((stop, i) => (
                <Box key={stop._id ?? i}>
                  <StopBlock
                    stop={stop}
                    onDelete={stop._id ? () => deleteStop(stop._id!) : undefined}
                    onClick={() => {
                      if (stop.source !== 'logistics') {
                        const t = stopStartMinutes(stop);
                        openDrawer(t ? formatTime(t) : '09:00', stop.type);
                      }
                    }}
                  />
                  <TravelConnector stop={stop} />
                </Box>
              ))}

              {/* "Click to add" hint when day is empty */}
              {activeDay.stops.length === 0 && (
                <Box sx={{
                  position: 'absolute', inset: 0, display: 'flex',
                  flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <Typography variant="body2" color="text.disabled">Click anywhere to add</Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Paper>
      )}

      {/* ── Add stop drawer ── */}
      <AddStopDrawer
        open={drawer.open}
        onClose={() => setDrawer(d => ({ ...d, open: false }))}
        onAdd={addStop}
        defaultTime={drawer.time}
        defaultType={drawer.type}
      />
    </Box>
  );
}