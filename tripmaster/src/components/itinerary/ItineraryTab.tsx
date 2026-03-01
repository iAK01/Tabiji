'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  Box, Typography, Paper, Button, TextField,
  IconButton, Chip, CircularProgress,
  Drawer, alpha, useTheme, useMediaQuery, Tooltip,
} from '@mui/material';
import AddIcon            from '@mui/icons-material/Add';
import DeleteIcon         from '@mui/icons-material/Delete';
import CloseIcon          from '@mui/icons-material/Close';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import LocalTaxiIcon      from '@mui/icons-material/LocalTaxi';
import WarningAmberIcon   from '@mui/icons-material/WarningAmber';
import LockIcon           from '@mui/icons-material/Lock';
import WorkIcon           from '@mui/icons-material/Work';
import RestaurantIcon     from '@mui/icons-material/Restaurant';
import ExploreIcon        from '@mui/icons-material/Explore';
import FlightIcon         from '@mui/icons-material/Flight';
import HotelIcon          from '@mui/icons-material/Hotel';
import DirectionsBusIcon  from '@mui/icons-material/DirectionsBus';
import EventIcon          from '@mui/icons-material/Event';
import FreeBreakfastIcon  from '@mui/icons-material/FreeBreakfast';
import RouteIcon          from '@mui/icons-material/Route';
import ExpandMoreIcon     from '@mui/icons-material/ExpandMore';
import DragIndicatorIcon  from '@mui/icons-material/DragIndicator';
import { saveTripCache, getTripCache, queueAction } from '@/lib/offline/db';
import AddressSearch      from '@/components/ui/AddressSearch';
import NavigateButton     from '@/components/ui/NavigateButton';
import type { ResolvedAddress } from '@/components/ui/AddressSearch';

// ─── Constants ────────────────────────────────────────────────────────────────
const DAY_START_HOUR     = 6;
const DAY_END_HOUR       = 24;
const PX_PER_MIN_MOBILE  = 1.0;
const PX_PER_MIN_DESKTOP = 1.2;
const TOTAL_MINS         = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const SNAP_MINS          = 15; // drag snaps to 15-min grid

// ─── Stop type config ─────────────────────────────────────────────────────────
const STOP_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  flight:      { label: '✈️ Flight',        color: '#C9521B', bg: '#FFF0EB', Icon: FlightIcon },
  hotel:       { label: '🏨 Accommodation', color: '#5c35a0', bg: '#F3EEFF', Icon: HotelIcon },
  meeting:     { label: '💼 Meeting',       color: '#1D2642', bg: '#E8EAF0', Icon: WorkIcon },
  meal:        { label: '🍽️ Meal',          color: '#b45309', bg: '#FFFBEB', Icon: RestaurantIcon },
  breakfast:   { label: '☕ Breakfast',     color: '#b45309', bg: '#FFFBEB', Icon: FreeBreakfastIcon },
  activity:    { label: '🎯 Activity',      color: '#55702C', bg: '#F0F5E8', Icon: ExploreIcon },
  sightseeing: { label: '📸 Sightseeing',  color: '#55702C', bg: '#F0F5E8', Icon: ExploreIcon },
  transport:   { label: '🚌 Transport',     color: '#0369a1', bg: '#E0F2FE', Icon: DirectionsBusIcon },
  work:        { label: '💻 Work block',   color: '#1D2642', bg: '#E8EAF0', Icon: WorkIcon },
  other:       { label: '📍 Other',        color: '#6b7280', bg: '#F3F4F6', Icon: EventIcon },
  gig:         { label: '🎤 Gig',          color: '#ff69b4', bg: '#ffe0f0', Icon: EventIcon },
};

const QUICK_ADD_TYPES = [
  'meeting', 'meal', 'breakfast', 'activity', 'sightseeing', 'transport', 'work', 'other', 'gig',
];

const DEFAULT_DURATIONS: Record<string, number> = {
  flight: 180, hotel: 0, meeting: 60, meal: 75, breakfast: 45,
  activity: 120, sightseeing: 90, transport: 45, work: 120, other: 60, gig: 120,
};

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Stop {
  _id?: string;
  name: string;
  type: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  scheduledStart?: string;
  scheduledEnd?: string;  // logistics stops carry this — used to derive duration
  time?: string;
  duration: number;
  notes?: string;
  completed?: boolean;
  source?: string;
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
  tripId:    string;
  startDate: string;
  endDate:   string;
  fabTrigger?: { action: string; seq: number } | null;
}

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

// Derive duration: prefer explicit field, then calculate from scheduledEnd, fallback 60
function stopDuration(stop: Stop): number {
  if (stop.duration && stop.duration > 0) return stop.duration;
  if (stop.scheduledEnd && stop.scheduledStart) {
    const parse = (s: string) => {
      const t = s.includes('T') ? s.split('T')[1]?.slice(0, 5) : s;
      if (!t) return null;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const start = parse(stop.scheduledStart);
    const end   = parse(stop.scheduledEnd);
    if (start !== null && end !== null && end > start) return end - start;
  }
  return 60;
}

function minutesToPx(minutes: number, pxPerMin: number): number {
  return (minutes - DAY_START_HOUR * 60) * pxPerMin;
}

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function freeSlots(stops: Stop[]): { start: number; end: number; mins: number }[] {
  const placed = stops
    .map(s => ({ start: stopStartMinutes(s), dur: stopDuration(s) }))
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
function HourRuler({ pxPerMin }: { pxPerMin: number }) {
  const hourH = 60 * pxPerMin;
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);
  return (
    <Box sx={{ position: 'relative', width: 44, flexShrink: 0, userSelect: 'none' }}>
      {hours.map(h => (
        <Box key={h} sx={{ position: 'absolute', top: (h - DAY_START_HOUR) * hourH - 9, right: 6 }}>
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ fontSize: '0.65rem', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}
          >
            {h === 24 ? '00:00' : `${String(h).padStart(2, '0')}:00`}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ─── Hour grid lines ──────────────────────────────────────────────────────────
function GridLines({ pxPerMin }: { pxPerMin: number }) {
  const hourH = 60 * pxPerMin;
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => i);
  return (
    <>
      {hours.map(i => (
        <Box key={i} sx={{
          position: 'absolute', top: i * hourH, left: 0, right: 0,
          borderTop: '1px solid', borderColor: 'divider', pointerEvents: 'none',
        }} />
      ))}
      {hours.map(i => (
        <Box key={`half-${i}`} sx={{
          position: 'absolute', top: i * hourH + hourH / 2, left: 0, right: 0,
          borderTop: '1px dashed', borderColor: alpha('#000', 0.04), pointerEvents: 'none',
        }} />
      ))}
    </>
  );
}

// ─── Single stop block ────────────────────────────────────────────────────────
function StopBlock({
  stop, onDelete, onClick, onResize, pxPerMin, isMobile,
}: {
  stop:       Stop;
  onDelete?:  () => void;
  onClick?:   () => void;
  onResize?:  (newStartMin: number, newDuration: number) => void;
  pxPerMin:   number;
  isMobile:   boolean;
}) {
  const startMin = stopStartMinutes(stop);
  if (startMin === null) return null;

  const isLocked    = stop.source === 'logistics';
  const duration    = stopDuration(stop);
  const dragId      = stop._id ?? `${stop.name}-${stop.scheduledStart ?? stop.time ?? 'notime'}`;
  const height      = Math.max(duration * pxPerMin, isMobile ? 36 : 28);
  const cfg         = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
  const hasLocation = !!(stop.address || stop.coordinates);
  const displayName = stop.name?.trim() || 'Unnamed stop';

  // ── Resize state (pointer-event driven, separate from dnd-kit) ──
  const [resize, setResize] = useState<{ edge: 'top' | 'bottom'; deltaY: number } | null>(null);

  // Live values while resizing
  const rawDeltaMin  = resize ? Math.round((resize.deltaY / pxPerMin) / SNAP_MINS) * SNAP_MINS : 0;
  const liveStartMin = resize?.edge === 'top'
    ? Math.max(DAY_START_HOUR * 60, Math.min(startMin + duration - SNAP_MINS, startMin + rawDeltaMin))
    : startMin;
  const liveDuration = resize?.edge === 'top'
    ? Math.max(SNAP_MINS, duration - (liveStartMin - startMin))
    : resize?.edge === 'bottom'
    ? Math.max(SNAP_MINS, duration + rawDeltaMin)
    : duration;

  const liveTop    = minutesToPx(liveStartMin, pxPerMin);
  const liveHeight = Math.max(liveDuration * pxPerMin, isMobile ? 36 : 28);
  const showDetail = isMobile ? liveHeight > 44 : liveHeight > 50;
  const isResizing = resize !== null;

  const handleResizePointerDown = (e: React.PointerEvent, edge: 'top' | 'bottom') => {
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    setResize({ edge, deltaY: 0 });

    const onMove = (me: PointerEvent) => {
      setResize({ edge, deltaY: me.clientY - startY });
    };
    const onUp = (ue: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      // Commit on release
      const finalDeltaMin = Math.round(((ue.clientY - startY) / pxPerMin) / SNAP_MINS) * SNAP_MINS;
      const finalStartMin = edge === 'top'
        ? Math.max(DAY_START_HOUR * 60, Math.min(startMin + duration - SNAP_MINS, startMin + finalDeltaMin))
        : startMin;
      const finalDuration = edge === 'top'
        ? Math.max(SNAP_MINS, duration - (finalStartMin - startMin))
        : Math.max(SNAP_MINS, duration + finalDeltaMin);
      setResize(null);
      if (finalStartMin !== startMin || finalDuration !== duration) {
        onResize?.(finalStartMin, finalDuration);
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  // ── DnD (move) ──
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:       dragId,
    disabled: isResizing, // disable dnd while resizing
  });

  const snappedPreviewMin = transform
    ? Math.max(
        DAY_START_HOUR * 60,
        Math.min(DAY_END_HOUR * 60 - duration,
          startMin + Math.round((transform.y / pxPerMin) / SNAP_MINS) * SNAP_MINS,
        ),
      )
    : startMin;

  const translateY = transform ? transform.y : 0;

  return (
    <Box
      ref={setNodeRef}
      onClick={isDragging || isResizing ? undefined : onClick}
      style={{
        transform:   isDragging ? `translateY(${translateY}px)` : undefined,
        willChange:  isDragging ? 'transform' : undefined,
        touchAction: 'none',
      }}
      sx={{
        position:        'absolute',
        left:            0,
        right:           isMobile ? 2 : 4,
        top:             liveTop,
        height:          liveHeight,
        zIndex:          isDragging || isResizing ? 100 : 2,
        backgroundColor: cfg.bg,
        borderLeft:      `3px solid ${cfg.color}`,
        borderRadius:    '0 6px 6px 0',
        px:              1,
        py:              isMobile ? 0.6 : 0.4,
        display:         'flex',
        alignItems:      'flex-start',
        gap:             0.5,
        boxShadow:       isDragging || isResizing
          ? `0 8px 24px rgba(0,0,0,0.22), 0 0 0 2px ${cfg.color}`
          : '0 1px 3px rgba(0,0,0,0.08)',
        opacity:         isDragging ? 0.92 : 1,
        cursor:          isDragging ? 'grabbing' : 'pointer',
        overflow:        'hidden',
        transition:      isDragging || isResizing ? 'none' : 'box-shadow 0.15s',
        '&:hover':       !isMobile && !isDragging && !isResizing
          ? { boxShadow: '0 2px 8px rgba(0,0,0,0.14)' }
          : {},
        minHeight:       isMobile ? 36 : 'unset',
      }}
    >
      {/* ── Top resize handle ── */}
      <Box
        onPointerDown={e => handleResizePointerDown(e, 'top')}
        sx={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 6,
          cursor: 'ns-resize',
          zIndex: 10,
          borderRadius: '0 6px 0 0',
          backgroundColor: isResizing && resize?.edge === 'top'
            ? alpha(cfg.color, 0.25)
            : 'transparent',
          '&:hover': { backgroundColor: alpha(cfg.color, 0.18) },
        }}
      />

      {/* ── Drag handle ── */}
      <Box
        {...listeners}
        {...attributes}
        onClick={e => e.stopPropagation()}
        sx={{
          display:     'flex',
          alignItems:  'center',
          flexShrink:  0,
          cursor:      isDragging ? 'grabbing' : 'grab',
          color:       alpha(cfg.color, 0.35),
          touchAction: 'none',
          px:          0.25,
          mr:          0.25,
          alignSelf:   'stretch',
          minWidth:    isMobile ? 22 : 16,
          '&:hover':   { color: cfg.color },
        }}
      >
        <DragIndicatorIcon sx={{ fontSize: isMobile ? 15 : 13 }} />
      </Box>

      {/* ── Content ── */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden', minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {stop.icon && (
            <Typography sx={{ fontSize: isMobile ? '0.85rem' : '0.8rem', lineHeight: 1, flexShrink: 0 }}>
              {stop.icon}
            </Typography>
          )}
          <Typography sx={{
            fontSize:     isMobile ? '0.8rem' : '0.75rem',
            fontWeight:   700,
            color:        cfg.color,
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
          }}>
            {displayName}
          </Typography>
          {isLocked && <LockIcon sx={{ fontSize: 10, color: cfg.color, opacity: 0.6, flexShrink: 0 }} />}
        </Box>

        {showDetail && (
          <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', lineHeight: 1.3, mt: 0.25 }}>
            {isDragging
              ? `→ ${formatTime(snappedPreviewMin)}`
              : isResizing
              ? `${formatTime(liveStartMin)} · ${liveDuration}min`
              : `${formatTime(startMin)} · ${duration}min${stop.notes ? ` · ${stop.notes}` : ''}`
            }
          </Typography>
        )}
      </Box>

      {/* ── Actions — hidden while dragging/resizing ── */}
      {!isDragging && !isResizing && (
        <Box sx={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {hasLocation && (
            <NavigateButton
              destination={{ name: displayName, address: stop.address, coordinates: stop.coordinates ?? null }}
              suggestedMode="walking"
              size="small"
              sx={{ p: isMobile ? 0.75 : 0.2, minWidth: isMobile ? 32 : 24, minHeight: isMobile ? 32 : 24 }}
            />
          )}
          {!isLocked && onDelete && (
            <IconButton
              size="small"
              onClick={e => { e.stopPropagation(); onDelete(); }}
              sx={{
                p: isMobile ? 0.75 : 0.2, flexShrink: 0,
                color: cfg.color, opacity: isMobile ? 0.55 : 0.5,
                '&:active': { opacity: 1, backgroundColor: alpha(cfg.color, 0.12) },
                '&:hover':  { opacity: 1 },
                ...(isMobile && { minWidth: 32, minHeight: 32, mr: -0.5 }),
              }}
            >
              <DeleteIcon sx={{ fontSize: isMobile ? 15 : 13 }} />
            </IconButton>
          )}
        </Box>
      )}

      {/* ── Bottom resize handle ── */}
      <Box
        onPointerDown={e => handleResizePointerDown(e, 'bottom')}
        sx={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 6,
          cursor: 'ns-resize',
          zIndex: 10,
          borderRadius: '0 0 6px 0',
          backgroundColor: isResizing && resize?.edge === 'bottom'
            ? alpha(cfg.color, 0.25)
            : 'transparent',
          '&:hover': { backgroundColor: alpha(cfg.color, 0.18) },
        }}
      />
    </Box>
  );
}

// ─── Free time gap label ──────────────────────────────────────────────────────
function FreeGap({
  slot, onQuickAdd, pxPerMin, isMobile,
}: {
  slot:       { start: number; end: number; mins: number };
  onQuickAdd: (time: string) => void;
  pxPerMin:   number;
  isMobile:   boolean;
}) {
  if (slot.mins < 30) return null;
  const top    = minutesToPx(slot.start, pxPerMin);
  const height = slot.mins * pxPerMin;
  const h      = Math.floor(slot.mins / 60);
  const m      = slot.mins % 60;
  const label  = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''} free` : `${m}m free`;

  return (
    <Box
      onClick={() => onQuickAdd(formatTime(slot.start))}
      sx={{
        position: 'absolute', left: 0, right: isMobile ? 2 : 4, top, height,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', zIndex: 1,
        borderRadius: 1,
        '&:hover .free-label': { opacity: 1 },
        '&:active':            { backgroundColor: alpha('#55702C', 0.06) },
        '&:hover':             { backgroundColor: alpha('#55702C', 0.04) },
      }}
    >
      <Typography
        className="free-label"
        variant="caption"
        sx={{
          opacity:         isMobile ? 0.45 : 0,
          transition:      'opacity 0.15s',
          color:           'text.disabled',
          fontSize:        '0.7rem',
          backgroundColor: 'background.paper',
          border:          '1px dashed',
          borderColor:     'divider',
          px: 1, py: 0.25, borderRadius: 4,
          pointerEvents:   'none',
        }}
      >
        + {label}
      </Typography>
    </Box>
  );
}

// ─── Travel connector ─────────────────────────────────────────────────────────
function TravelConnector({ stop, pxPerMin }: { stop: Stop; pxPerMin: number }) {
  const t = stop.travelToNext;
  if (!t) return null;
  const start = stopStartMinutes(stop);
  if (start === null) return null;
  const top = minutesToPx(start + (stop.duration ?? 60), pxPerMin);

  return (
    <Box sx={{
      position: 'absolute', left: 0, right: 4, top, zIndex: 3,
      height:   Math.max(t.duration * pxPerMin, 18),
      display:  'flex', alignItems: 'center',
      backgroundColor: t.isImpossible
        ? alpha('#ef4444', 0.08)
        : t.isTight
        ? alpha('#f59e0b', 0.08)
        : 'transparent',
      px: 1,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {t.isImpossible
          ? <WarningAmberIcon sx={{ fontSize: 12, color: 'error.main' }} />
          : t.mode === 'walk'
          ? <DirectionsWalkIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
          : <LocalTaxiIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
        }
        <Typography variant="caption" sx={{
          fontSize: '0.65rem',
          color: t.isImpossible ? 'error.main' : t.isTight ? 'warning.dark' : 'text.disabled',
        }}>
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
  open, onClose, onAdd, defaultTime, defaultType, isMobile,
}: {
  open:        boolean;
  onClose:     () => void;
  onAdd:       (stop: Partial<Stop>) => Promise<void>;
  defaultTime: string;
  defaultType: string;
  isMobile:    boolean;
}) {
  const [form, setForm] = useState({
    name:           '',
    type:           defaultType,
    scheduledStart: defaultTime,
    duration:       60,
    notes:          '',
    address:        '',
    coordinates:    undefined as { lat: number; lng: number } | undefined,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(f => ({
      ...f,
      type:           defaultType,
      scheduledStart: defaultTime,
      duration:       DEFAULT_DURATIONS[defaultType] ?? 60,
      address:        '',
      coordinates:    undefined,
    }));
  }, [defaultTime, defaultType, open]);

  const handleAddressChange = (result: ResolvedAddress | null) => {
    setForm(f => ({
      ...f,
      address:     result?.address     ?? '',
      coordinates: result?.coordinates ?? undefined,
      // Auto-populate name from place text if still empty
      name: f.name || result?.address?.split(',')[0] || f.name,
    }));
  };

  const submit = async () => {
    setSaving(true);
    await onAdd(form);
    setSaving(false);
    onClose();
  };

  const cfg = STOP_CONFIG[form.type] ?? STOP_CONFIG.other;

  const content = (
    <>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>Add to day</Typography>
        <IconButton
          onClick={onClose}
          sx={{ ...(isMobile && { p: 1, minWidth: 44, minHeight: 44 }) }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Type picker */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
        {QUICK_ADD_TYPES.map(t => {
          const c = STOP_CONFIG[t];
          return (
            <Chip
              key={t}
              label={c.label}
              size={isMobile ? 'medium' : 'small'}
              onClick={() => setForm(f => ({ ...f, type: t, duration: DEFAULT_DURATIONS[t] ?? 60 }))}
              sx={{
                borderColor:     c.color,
                backgroundColor: form.type === t ? c.bg : 'transparent',
                color:           c.color,
                fontWeight:      form.type === t ? 700 : 400,
                border:          '1px solid',
                ...(isMobile && {
                  height: 36,
                  '& .MuiChip-label': { px: 1.5 },
                }),
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
          autoFocus={!isMobile}
          placeholder={`e.g. ${cfg.label.split(' ').slice(1).join(' ')} with client`}
          InputProps={{ sx: isMobile ? { fontSize: '1rem' } : {} }}
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Start time"
            type="time"
            value={form.scheduledStart}
            onChange={e => setForm(f => ({ ...f, scheduledStart: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            InputProps={{ sx: isMobile ? { fontSize: '1rem' } : {} }}
          />
          <TextField
            label="Duration (min)"
            type="number"
            value={form.duration}
            onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))}
            fullWidth
            inputProps={{ min: 5, step: 5 }}
            InputProps={{ sx: isMobile ? { fontSize: '1rem' } : {} }}
          />
        </Box>

        {/* Location — Mapbox geocoded via AddressSearch component */}
        <AddressSearch
          label="Location (optional)"
          value={form.address}
          placeholder="Search for a place…"
          onChange={handleAddressChange}
          noValidation
        />

        <TextField
          label="Notes"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          fullWidth
          multiline
          rows={2}
          placeholder="Any details, links, confirmation numbers..."
          InputProps={{ sx: isMobile ? { fontSize: '1rem' } : {} }}
        />

        <Button
          variant="contained"
          onClick={submit}
          disabled={!form.name || saving}
          fullWidth
          sx={{
            mt: 1,
            ...(isMobile && { py: 1.75, fontSize: '1rem', borderRadius: 2 }),
          }}
        >
          {saving ? <CircularProgress size={20} /> : 'Add to itinerary'}
        </Button>
      </Box>
    </>
  );

  // Mobile: bottom sheet. Desktop: right drawer.
  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            borderTopLeftRadius:  16,
            borderTopRightRadius: 16,
            px: 2.5, pt: 1.5,
            pb: 'max(env(safe-area-inset-bottom, 16px), 32px)',
            maxHeight: '88vh',
            overflowY: 'auto',
          },
        }}
      >
        {/* Drag handle pill */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
          <Box sx={{ width: 40, height: 4, borderRadius: 2, backgroundColor: alpha('#000', 0.15) }} />
        </Box>
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: 380, p: 3 } }}
    >
      {content}
    </Drawer>
  );
}

// ─── Main ItineraryTab ────────────────────────────────────────────────────────
export default function ItineraryTab({ tripId, startDate, endDate, fabTrigger }: Props) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const pxPerMin  = isMobile ? PX_PER_MIN_MOBILE : PX_PER_MIN_DESKTOP;
  const timelineH = TOTAL_MINS * pxPerMin;

  const [days,          setDays]          = useState<Day[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [activeDayIdx,  setActiveDayIdx]  = useState(0);
  const [calculating,   setCalculating]   = useState(false);
  const [showAllChips,  setShowAllChips]  = useState(false);
  const [drawer, setDrawer] = useState<{ open: boolean; time: string; type: string }>({
    open: false, time: '09:00', type: 'activity',
  });

  // ── DnD sensors ──
  // Desktop: start dragging after 5px of movement
  // Mobile: 200ms long-press (delay) + 8px tolerance so scroll still works freely
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  useEffect(() => {
    async function loadItinerary() {
      try {
        const res  = await fetch(`/api/trips/${tripId}/itinerary`);
        const data = await res.json();
        setDays(data.days ?? []);
        const cached = await getTripCache(tripId);
        await saveTripCache(tripId, { ...(cached ?? {}), itinerary: data.days ?? [] });
      } catch {
        const cached = await getTripCache(tripId);
        if (cached?.itinerary) setDays(cached.itinerary);
      } finally {
        setLoading(false);
      }
    }
    loadItinerary();
  }, [tripId]);

  const activeDay = days[activeDayIdx];

  const openDrawer = (time: string, type = 'activity') =>
    setDrawer({ open: true, time, type });

  useEffect(() => {
  if (!fabTrigger) return;
  if (fabTrigger.action === 'stop') openDrawer('09:00', 'activity');
}, [fabTrigger]);


  // ── Add stop ──
  const addStop = async (stop: Partial<Stop>) => {
    const day = days[activeDayIdx];
    const updatedDays = [...days];
    updatedDays[activeDayIdx] = {
      ...day,
      stops: [
        ...day.stops,
        {
          ...stop,
          scheduledStart: `${day.date.split('T')[0]}T${stop.scheduledStart}:00`,
          duration: stop.duration ?? 60,
        } as Stop,
      ],
    };
    setDays(updatedDays);
    await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: updatedDays });

    if (!navigator.onLine) {
      await queueAction({ type: 'ADD_STOP', tripId, payload: { dayDate: day.date, stop } });
      return;
    }

    const res  = await fetch(`/api/trips/${tripId}/itinerary/stops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dayDate: day.date,
        stop: { ...stop, scheduledStart: `${day.date.split('T')[0]}T${stop.scheduledStart}:00` },
      }),
    });
    const data = await res.json();
    setDays(data.days);
  };

  // ── Delete stop ──
  const deleteStop = async (stopId: string) => {
    const updatedDays = days.map(day => ({
      ...day,
      stops: day.stops.filter(s => s._id !== stopId),
    }));
    setDays(updatedDays);
    await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: updatedDays });

    if (!navigator.onLine) {
      await queueAction({ type: 'DELETE_STOP', tripId, stopId });
      return;
    }

    const res  = await fetch(`/api/trips/${tripId}/itinerary/stops/${stopId}`, { method: 'DELETE' });
    const data = await res.json();
    setDays(data.days);
  };

  // ── Reschedule stop (drag result) ──
  const rescheduleStop = async (stopId: string, newStartMin: number) => {
    const day      = days[activeDayIdx];
    const dateStr  = day.date.split('T')[0];
    const newScheduledStart = `${dateStr}T${formatTime(newStartMin)}:00`;

    // Optimistic update
    const updatedDays = days.map(d => ({
      ...d,
      stops: d.stops.map(s =>
        s._id === stopId ? { ...s, scheduledStart: newScheduledStart } : s,
      ),
    }));
    setDays(updatedDays);
    await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: updatedDays });

    if (!navigator.onLine) {
      await queueAction({ type: 'RESCHEDULE_STOP', tripId, payload: { stopId, scheduledStart: newScheduledStart } });
      return;
    }

    const res  = await fetch(`/api/trips/${tripId}/itinerary/stops/${stopId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledStart: newScheduledStart }),
    });
    const data = await res.json();
    setDays(data.days);
  };

  // ── Resize stop (drag top/bottom edge) ──
  const resizeStop = async (stop: Stop, newStartMin: number, newDuration: number) => {
    const day    = days[activeDayIdx];
    const dateStr = day.date.split('T')[0];
    const newScheduledStart = `${dateStr}T${formatTime(newStartMin)}:00`;

    // Optimistic update
    const updatedDays = days.map(d => ({
      ...d,
      stops: d.stops.map(s => {
        const isTarget = stop._id ? s._id === stop._id
          : `${s.name}-${s.scheduledStart ?? s.time ?? 'notime'}` ===
            `${stop.name}-${stop.scheduledStart ?? stop.time ?? 'notime'}`;
        return isTarget ? { ...s, scheduledStart: newScheduledStart, duration: newDuration } : s;
      }),
    }));
    setDays(updatedDays);
    await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: updatedDays });

    if (!stop._id) return; // no API call if no _id

    if (!navigator.onLine) {
      await queueAction({ type: 'RESCHEDULE_STOP', tripId, payload: { stopId: stop._id, scheduledStart: newScheduledStart, duration: newDuration } });
      return;
    }

    const res  = await fetch(`/api/trips/${tripId}/itinerary/stops/${stop._id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ scheduledStart: newScheduledStart, duration: newDuration }),
    });
    const data = await res.json();
    setDays(data.days);
  };

  // ── DnD drag end ──
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    console.log('[DnD] handleDragEnd fired | active.id=', active.id, '| delta=', delta);
    const stopId = active.id as string;
    // Match by _id first, then by the name+time fallback key
    const stop = activeDay?.stops.find(s =>
      s._id === stopId ||
      `${s.name}-${s.scheduledStart ?? s.time ?? 'notime'}` === stopId
    );
    console.log('[DnD] matched stop=', stop?._id, stop?.name);
    if (!stop) { console.warn('[DnD] stop not found in activeDay'); return; }

    const startMin = stopStartMinutes(stop);
    console.log('[DnD] startMin=', startMin, '| pxPerMin=', pxPerMin);
    if (startMin === null) { console.warn('[DnD] startMin is null'); return; }

    const deltaMin = Math.round((delta.y / pxPerMin) / SNAP_MINS) * SNAP_MINS;
    console.log('[DnD] deltaMin=', deltaMin);
    if (deltaMin === 0) { console.log('[DnD] deltaMin=0, no move'); return; }

    const newStartMin = Math.max(
      DAY_START_HOUR * 60,
      Math.min(DAY_END_HOUR * 60 - (stop.duration ?? 60), startMin + deltaMin),
    );

    if (newStartMin !== startMin) {
      if (stop._id) {
        rescheduleStop(stop._id, newStartMin);
      } else {
        // No _id — optimistic UI only, no API call (logistics stops without _id)
        const dateStr = days[activeDayIdx].date.split('T')[0];
        const newScheduledStart = `${dateStr}T${formatTime(newStartMin)}:00`;
        const updatedDays = days.map(d => ({
          ...d,
          stops: d.stops.map(s =>
            (`${s.name}-${s.scheduledStart ?? s.time ?? 'notime'}` === stopId)
              ? { ...s, scheduledStart: newScheduledStart }
              : s
          ),
        }));
        setDays(updatedDays);
      }
    }
  };

  // ── Calculate travel ──
  const calculateTravel = async () => {
    setCalculating(true);

    if (!navigator.onLine) {
      await queueAction({ type: 'CALCULATE_TRAVEL', tripId });
      setCalculating(false);
      return;
    }

    const res  = await fetch(`/api/trips/${tripId}/itinerary/calculate-travel`, { method: 'POST' });
    const data = await res.json();
    setDays(data.days);
    await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: data.days });
    setCalculating(false);
  };

  // ── Loading / empty states ──
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  );
  if (!days.length) return (
    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
      No itinerary days found.
    </Typography>
  );

  const free      = activeDay ? totalFreeMinutes(activeDay.stops) : 0;
  const freeH     = Math.floor(free / 60);
  const freeM     = free % 60;
  const freeLabel = freeH > 0 ? `${freeH}h${freeM > 0 ? ` ${freeM}m` : ''} free` : `${freeM}m free`;

  const visibleChipCount = isMobile ? 4 : 5;
  const visibleChips     = showAllChips ? QUICK_ADD_TYPES : QUICK_ADD_TYPES.slice(0, visibleChipCount);

  return (
    <Box>
      {/* ── Top bar ── */}
      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        mb: 2.5, gap: 1,
      }}>
        <Typography variant="h6" fontWeight={700}>Day by Day</Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {isMobile ? (
            <Tooltip title="Calculate A-to-B travel times">
              <span>
                <IconButton
                  onClick={calculateTravel}
                  disabled={calculating}
                  size="medium"
                  sx={{
                    border: '1px solid', borderColor: 'divider',
                    borderRadius: 1.5, minWidth: 44, minHeight: 44, color: 'text.secondary',
                  }}
                >
                  {calculating ? <CircularProgress size={18} /> : <RouteIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Button
              variant="outlined" size="small"
              onClick={calculateTravel}
              disabled={calculating}
              startIcon={calculating ? <CircularProgress size={14} /> : <DirectionsWalkIcon />}
            >
              {calculating ? 'Calculating...' : 'Calculate A-to-B'}
            </Button>
          )}

          <Button
            variant="contained"
            size={isMobile ? 'medium' : 'small'}
            startIcon={<AddIcon />}
            onClick={() => openDrawer('09:00', 'activity')}
            sx={isMobile ? { minHeight: 44, px: 2 } : {}}
          >
            Add
          </Button>
        </Box>
      </Box>

      {/* ── Day selector ── */}
      <Box sx={{
        display: 'flex', gap: isMobile ? 0.75 : 1, mb: 2.5,
        overflowX: 'auto', pb: 0.5,
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { height: isMobile ? 0 : 4 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: 'divider', borderRadius: 2 },
      }}>
        {days.map((day, i) => {
          const d        = new Date(day.date);
          const dow      = d.toLocaleDateString('en-IE', { weekday: 'short' });
          const dom      = d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
          const hasStops = day.stops.length > 0;
          const active   = i === activeDayIdx;
          return (
            <Box
              key={day.date}
              onClick={() => setActiveDayIdx(i)}
              sx={{
                flexShrink: 0,
                px: 2, py: isMobile ? 1.5 : 1.25,
                borderRadius: 2, cursor: 'pointer',
                border: '2px solid', transition: 'all 0.15s',
                borderColor:     active ? 'primary.main' : 'divider',
                backgroundColor: active ? 'primary.main' : 'background.paper',
                color:           active ? 'white' : 'text.primary',
                minWidth:        isMobile ? 62 : 'unset',
                '&:hover':  { borderColor: 'primary.main' },
                '&:active': { opacity: 0.88 },
              }}
            >
              <Typography variant="caption" display="block"
                sx={{ opacity: 0.8, fontWeight: 600, textAlign: 'center', fontSize: isMobile ? '0.7rem' : undefined }}>
                {dow}
              </Typography>
              <Typography variant="body2" fontWeight={700} textAlign="center"
                sx={{ fontSize: isMobile ? '0.8rem' : undefined }}>
                {dom}
              </Typography>
              {hasStops && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
                  <Box sx={{
                    width: 6, height: 6, borderRadius: '50%',
                    backgroundColor: active ? 'rgba(255,255,255,0.7)' : 'primary.main',
                  }} />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* ── Day header ── */}
      {activeDay && (
        <Box sx={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          mb: 2, gap: 1,
        }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight={800} sx={{ lineHeight: 1.25 }}>
              Day {activeDay.dayNumber}
              <Typography
                component="span"
                variant={isMobile ? 'body1' : 'h5'}
                fontWeight={isMobile ? 500 : 800}
                color={isMobile ? 'text.secondary' : 'inherit'}
                sx={{ display: isMobile ? 'block' : 'inline', ml: isMobile ? 0 : 0.75 }}
              >
                {isMobile ? '' : '— '}
                {new Date(activeDay.date).toLocaleDateString('en-IE', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </Typography>
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
              <Chip size="small"
                label={`${activeDay.stops.filter(s => s.source !== 'logistics').length} planned`}
                sx={{ backgroundColor: alpha('#55702C', 0.1), color: '#55702C', fontWeight: 600 }}
              />
              <Chip size="small" label={freeLabel}
                sx={{ backgroundColor: alpha('#1D2642', 0.06), color: '#1D2642', fontWeight: 600 }}
              />
              {activeDay.stops.filter(s => s.source === 'logistics').length > 0 && (
                <Chip size="small"
                  icon={<LockIcon sx={{ fontSize: 11 }} />}
                  label={`${activeDay.stops.filter(s => s.source === 'logistics').length} from logistics`}
                  sx={{ backgroundColor: alpha('#C9521B', 0.08), color: '#C9521B', fontWeight: 600 }}
                />
              )}
            </Box>
          </Box>

          {!isMobile && (
            <Button variant="outlined" size="small" startIcon={<AddIcon />}
              onClick={() => openDrawer('09:00', 'meeting')} sx={{ flexShrink: 0 }}>
              Quick add
            </Button>
          )}
        </Box>
      )}

      {/* ── Quick add chip row ── */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {visibleChips.map(t => {
          const c = STOP_CONFIG[t];
          return (
            <Chip key={t} label={c.label}
              size={isMobile ? 'medium' : 'small'}
              onClick={() => openDrawer('09:00', t)}
              variant="outlined"
              sx={{
                borderColor: alpha(c.color, 0.4), color: c.color,
                '&:hover':  { backgroundColor: c.bg },
                '&:active': { backgroundColor: c.bg },
                ...(isMobile && { height: 36, '& .MuiChip-label': { px: 1.5, fontSize: '0.8rem' } }),
              }}
            />
          );
        })}
        {isMobile && (
          <Chip
            size="medium"
            label={showAllChips ? 'Less' : `+${QUICK_ADD_TYPES.length - visibleChipCount} more`}
            onClick={() => setShowAllChips(v => !v)}
            icon={<ExpandMoreIcon sx={{
              fontSize: 16,
              transform: showAllChips ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }} />}
            sx={{
              height: 36, backgroundColor: alpha('#000', 0.04), color: 'text.secondary',
              '& .MuiChip-label': { px: 1, fontSize: '0.8rem' },
            }}
          />
        )}
      </Box>

      {/* ── Timeline ── */}
      {activeDay && (
        <Paper sx={{
          backgroundColor: 'background.paper', overflow: 'hidden',
          borderRadius: 2, border: '1px solid', borderColor: 'divider',
        }}>
          {/* DndContext scoped to timeline only */}
          <DndContext
            sensors={sensors}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <Box sx={{ display: 'flex', position: 'relative', height: timelineH + 32 }}>

              {/* Hour ruler */}
              <Box sx={{
                flexShrink: 0, width: 44, position: 'relative',
                borderRight: '1px solid', borderColor: 'divider', pt: 2,
              }}>
                <HourRuler pxPerMin={pxPerMin} />
              </Box>

              {/* Timeline column */}
              <Box
                sx={{
                  flex: 1, position: 'relative', pt: 2, pb: 2,
                  cursor: isMobile ? 'default' : 'crosshair',
                  WebkitOverflowScrolling: 'touch',
                }}
                onClick={e => {
                  if (isMobile) return;
                  const rect    = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const relY    = e.clientY - rect.top - 16;
                  const mins    = Math.round(relY / pxPerMin / 15) * 15 + DAY_START_HOUR * 60;
                  const clamped = Math.max(DAY_START_HOUR * 60, Math.min(DAY_END_HOUR * 60 - 30, mins));
                  openDrawer(formatTime(clamped));
                }}
              >
                <GridLines pxPerMin={pxPerMin} />

                {freeSlots(activeDay.stops).map((slot, i) => (
                  <FreeGap key={i} slot={slot}
                    onQuickAdd={time => openDrawer(time)}
                    pxPerMin={pxPerMin}
                    isMobile={isMobile}
                  />
                ))}

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
                      onResize={(newStartMin, newDuration) => resizeStop(stop, newStartMin, newDuration)}
                      pxPerMin={pxPerMin}
                      isMobile={isMobile}
                    />
                    <TravelConnector stop={stop} pxPerMin={pxPerMin} />
                  </Box>
                ))}

                {activeDay.stops.length === 0 && (
                  <Box sx={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 1.5, pointerEvents: 'none',
                  }}>
                    <Typography variant="body2" color="text.disabled">
                      {isMobile ? 'Tap Add to start planning your day' : 'Click anywhere to add a stop'}
                    </Typography>
                    {isMobile && (
                      <Box sx={{ pointerEvents: 'auto' }}>
                        <Button variant="outlined" size="small" startIcon={<AddIcon />}
                          onClick={() => openDrawer('09:00', 'activity')} sx={{ borderRadius: 2 }}>
                          Add first stop
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          </DndContext>
        </Paper>
      )}

      {/* ── Add stop drawer ── */}
      <AddStopDrawer
        open={drawer.open}
        onClose={() => setDrawer(d => ({ ...d, open: false }))}
        onAdd={addStop}
        defaultTime={drawer.time}
        defaultType={drawer.type}
        isMobile={isMobile}
      />
    </Box>
  );
}