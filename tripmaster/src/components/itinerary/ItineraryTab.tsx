'use client';

import { useState, useEffect, useRef } from 'react';
import {
  DndContext, DragEndEvent,
  PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  Box, Typography, Paper, Button,
  IconButton, Chip, CircularProgress, Tooltip,
} from '@mui/material';
import { alpha }              from '@mui/material/styles';
import { useTheme, useMediaQuery } from '@mui/material';
import AddIcon            from '@mui/icons-material/Add';
import RouteIcon          from '@mui/icons-material/Route';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import LockIcon           from '@mui/icons-material/Lock';
import ExpandMoreIcon     from '@mui/icons-material/ExpandMore';
import { saveTripCache, getTripCache, queueAction } from '@/lib/offline/db';
import {
  DAY_START_HOUR, DAY_END_HOUR,
  PX_PER_MIN_MOBILE, PX_PER_MIN_DESKTOP, TOTAL_MINS,
  SNAP_MINS, QUICK_ADD_TYPES, STOP_CONFIG, D,
} from './Itinerary.config';
import type { Day, Stop, KnownLocation } from './Itinerary.config';
import {
  stopStartMinutes, stopDuration, formatTime,
  freeSlots, totalFreeMinutes, freeLabelText, computeStopColumns,
} from './Itinerary.helpers';
import { HourRuler, GridLines, FreeGap, TravelConnector } from './Timelinechrome';
import { StopBlock }      from './Stopblock';
import { AddStopDrawer }  from './Addstopdrawer';

interface Props {
  tripId:      string;
  startDate:   string;
  endDate:     string;
  fabTrigger?: { action: string; seq: number } | null;
}

export default function ItineraryTab({ tripId, startDate, endDate, fabTrigger }: Props) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const pxPerMin  = isMobile ? PX_PER_MIN_MOBILE : PX_PER_MIN_DESKTOP;
  const timelineH = TOTAL_MINS * pxPerMin;

  // ── State ────────────────────────────────────────────────────────────────────
  const [days,           setDays]           = useState<Day[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [activeDayIdx,   setActiveDayIdx]   = useState(0);
  const [calculating,    setCalculating]    = useState(false);
  const [showAllChips,   setShowAllChips]   = useState(false);
  const [knownLocations, setKnownLocations] = useState<KnownLocation[]>([]);
  const [drawer, setDrawer] = useState<{
    open:      boolean;
    time:      string;
    type:      string;
    editStop?: Stop;
  }>({ open: false, time: '09:00', type: 'activity' });

  const nowLineRef = useRef<HTMLDivElement>(null);

  // ── Auto-select today when days load ─────────────────────────────────────────
  useEffect(() => {
    if (days.length === 0) return;
    const todayStr = new Date().toDateString();
    const idx = days.findIndex(d => new Date(d.date).toDateString() === todayStr);
    if (idx !== -1) setActiveDayIdx(idx);
  }, [days]);

  // ── Scroll to current time when viewing today ─────────────────────────────────
  useEffect(() => {
    if (!nowLineRef.current) return;
    const activeDay = days[activeDayIdx];
    if (!activeDay) return;
    const todayStr = new Date().toDateString();
    if (new Date(activeDay.date).toDateString() !== todayStr) return;
    setTimeout(() => {
      nowLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [activeDayIdx, days]);

  // ── DnD sensors ──────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  // ── Load itinerary ───────────────────────────────────────────────────────────
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

  // ── Load known locations from logistics ──────────────────────────────────────
  useEffect(() => {
    fetch(`/api/trips/${tripId}/logistics`)
      .then(r => r.json())
      .then(data => {
        const logistics = data.logistics ?? data;
        const locs: KnownLocation[] = [];
        (logistics.accommodation ?? []).forEach((a: any) => {
          if (a.name) locs.push({ label: a.name, address: a.address, coordinates: a.coordinates, type: 'hotel' });
        });
        (logistics.venues ?? []).forEach((v: any) => {
          if (v.name) locs.push({ label: v.name, address: v.address, coordinates: v.coordinates, type: 'venue' });
        });
        (logistics.transportation ?? []).forEach((t: any) => {
          if (t.departureLocation) locs.push({ label: t.departureLocation, type: 'airport' });
          if (t.arrivalLocation)   locs.push({ label: t.arrivalLocation,   type: 'airport' });
        });
        const seen = new Set<string>();
        setKnownLocations(locs.filter(l => {
          if (seen.has(l.label)) return false;
          seen.add(l.label); return true;
        }));
      })
      .catch(() => {});
  }, [tripId]);

  // ── FAB trigger ──────────────────────────────────────────────────────────────
  const openDrawer = (time: string, type = 'activity', editStop?: Stop) =>
    setDrawer({ open: true, time, type, editStop });

  useEffect(() => {
    if (!fabTrigger) return;
    if (fabTrigger.action === 'stop') openDrawer('09:00', 'activity');
  }, [fabTrigger]);

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  const addStop = async (stop: Partial<Stop>) => {
    const day         = days[activeDayIdx];
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
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        dayDate: day.date,
        stop: { ...stop, scheduledStart: `${day.date.split('T')[0]}T${stop.scheduledStart}:00` },
      }),
    });
    const data = await res.json();
    setDays(data.days);
  };

  const updateStop = async (stop: Partial<Stop>) => {
    if (!stop._id) return;
    const day     = days[activeDayIdx];
    const dateStr = day.date.split('T')[0];
    const newScheduledStart = `${dateStr}T${stop.scheduledStart}:00`;

    const updatedDays = days.map(d => ({
      ...d,
      stops: d.stops.map(s =>
        s._id === stop._id ? { ...s, ...stop, scheduledStart: newScheduledStart } : s,
      ),
    }));
    setDays(updatedDays);
    await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: updatedDays });

    if (!navigator.onLine) {
      await queueAction({ type: 'RESCHEDULE_STOP', tripId, payload: { stopId: stop._id, ...stop, scheduledStart: newScheduledStart } });
      return;
    }
    const res  = await fetch(`/api/trips/${tripId}/itinerary/stops/${stop._id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...stop, scheduledStart: newScheduledStart }),
    });
    const data = await res.json();
    setDays(data.days);
  };

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

  const rescheduleStop = async (stopId: string, newStartMin: number) => {
    const day               = days[activeDayIdx];
    const dateStr           = day.date.split('T')[0];
    const newScheduledStart = `${dateStr}T${formatTime(newStartMin)}:00`;

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
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ scheduledStart: newScheduledStart }),
    });
    const data = await res.json();
    setDays(data.days);
  };

  const resizeStop = async (stop: Stop, newStartMin: number, newDuration: number) => {
    const day               = days[activeDayIdx];
    const dateStr           = day.date.split('T')[0];
    const newScheduledStart = `${dateStr}T${formatTime(newStartMin)}:00`;

    const updatedDays = days.map(d => ({
      ...d,
      stops: d.stops.map(s => {
        const isTarget = stop._id
          ? s._id === stop._id
          : `${s.name}-${s.scheduledStart ?? s.time ?? 'notime'}` ===
            `${stop.name}-${stop.scheduledStart ?? stop.time ?? 'notime'}`;
        return isTarget ? { ...s, scheduledStart: newScheduledStart, duration: newDuration } : s;
      }),
    }));
    setDays(updatedDays);
    await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: updatedDays });

    if (!stop._id) return;

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    const stopId = active.id as string;
    const stop   = activeDay?.stops.find(s =>
      s._id === stopId ||
      `${s.name}-${s.scheduledStart ?? s.time ?? 'notime'}` === stopId,
    );
    if (!stop) return;

    const startMin = stopStartMinutes(stop);
    if (startMin === null) return;

    const deltaMin = Math.round((delta.y / pxPerMin) / SNAP_MINS) * SNAP_MINS;
    if (deltaMin === 0) return;

    const newStartMin = Math.max(
      DAY_START_HOUR * 60,
      Math.min(DAY_END_HOUR * 60 - (stop.duration ?? 60), startMin + deltaMin),
    );

    if (newStartMin !== startMin) {
      if (stop._id) {
        rescheduleStop(stop._id, newStartMin);
      } else {
        const dateStr           = days[activeDayIdx].date.split('T')[0];
        const newScheduledStart = `${dateStr}T${formatTime(newStartMin)}:00`;
        const updatedDays = days.map(d => ({
          ...d,
          stops: d.stops.map(s =>
            `${s.name}-${s.scheduledStart ?? s.time ?? 'notime'}` === stopId
              ? { ...s, scheduledStart: newScheduledStart }
              : s,
          ),
        }));
        setDays(updatedDays);
      }
    }
  };

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

  // ── Loading / empty ───────────────────────────────────────────────────────────
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  );
  if (!days.length) return (
    <Typography sx={{ py: 4, textAlign: 'center', color: D.muted, fontFamily: D.body }}>
      No itinerary days found.
    </Typography>
  );

  const activeDay        = days[activeDayIdx];
  const freeLabel        = activeDay ? freeLabelText(activeDay.stops) : '';
  const visibleChipCount = isMobile ? 4 : 5;
  const visibleChips     = showAllChips ? QUICK_ADD_TYPES : QUICK_ADD_TYPES.slice(0, visibleChipCount);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box>

      {/* ── Page header ── */}
      <Box sx={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', mb: 2.5, gap: 1,
      }}>
        <Typography sx={{
          fontFamily: D.display,
          fontSize:   { xs: '1.1rem', sm: '1.25rem' },
          color:      D.navy, lineHeight: 1,
        }}>
          Itinerary
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {isMobile ? (
            <Tooltip title="Calculate A-to-B travel times">
              <span>
                <IconButton
                  onClick={calculateTravel}
                  disabled={calculating}
                  size="medium"
                  sx={{
                    border: `1.5px solid ${D.rule}`,
                    borderRadius: 1.5, minWidth: 44, minHeight: 44,
                    color: D.muted,
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
              sx={{ fontFamily: D.body, fontWeight: 700 }}
            >
              {calculating ? 'Calculating…' : 'Calculate A-to-B'}
            </Button>
          )}
          <Button
            variant="contained"
            size={isMobile ? 'medium' : 'small'}
            startIcon={<AddIcon />}
            onClick={() => openDrawer('09:00', 'activity')}
            sx={{
              fontFamily: D.display,
              fontSize:   '0.78rem',
              letterSpacing: '0.04em',
              ...(isMobile && { minHeight: 44, px: 2 }),
            }}
          >
            Add
          </Button>
        </Box>
      </Box>

      {/* ── Day selector — full-width grid ── */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${days.length}, 1fr)`,
        mb: 3,
        borderRadius: '12px',
        overflow: 'hidden',
        border: `1px solid ${D.rule}`,
        backgroundColor: '#ffffff',
      }}>
        {days.map((day, i) => {
          const d        = new Date(day.date);
          const dow      = d.toLocaleDateString('en-IE', { weekday: 'short' });
          const dayNum   = d.toLocaleDateString('en-IE', { day: 'numeric' });
          const mon      = d.toLocaleDateString('en-IE', { month: 'short' });
          const hasStops = day.stops.length > 0;
          const active   = i === activeDayIdx;

          return (
            <Box
              key={day.date}
              onClick={() => setActiveDayIdx(i)}
              sx={{
                textAlign:       'center',
                py:              isMobile ? 1.25 : 1.5,
                px:              0.5,
                cursor:          'pointer',
                backgroundColor: active ? D.navy : 'transparent',
                borderRight:     i < days.length - 1 ? `1px solid ${D.rule}` : 'none',
                transition:      'background-color 0.15s',
                '&:hover':       !active ? { backgroundColor: alpha(D.navy, 0.04) } : {},
                '&:active':      { opacity: 0.85 },
              }}
            >
              {/* DOW */}
              <Typography sx={{
                fontSize:      '0.52rem',
                fontWeight:    800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontFamily:    D.body,
                color:         active ? 'rgba(255,255,255,0.55)' : D.muted,
                lineHeight:    1,
                mb:            0.5,
              }}>
                {dow}
              </Typography>

              {/* Day number */}
              <Typography sx={{
                fontFamily: D.display,
                fontSize:   isMobile ? '1.8rem' : '2.2rem',
                lineHeight: 1,
                color:      active ? '#ffffff' : D.navy,
              }}>
                {dayNum}
              </Typography>

              {/* Month */}
              <Typography sx={{
                fontSize:      '0.52rem',
                fontWeight:    700,
                letterSpacing: '0.08em',
                fontFamily:    D.body,
                color:         active ? 'rgba(255,255,255,0.55)' : D.muted,
                lineHeight:    1,
                mt:            0.5,
              }}>
                {mon}
              </Typography>

              {/* Stop dot */}
              <Box sx={{
                width: 4, height: 4, borderRadius: '50%', mx: 'auto', mt: 0.75,
                backgroundColor: hasStops
                  ? active ? 'rgba(255,255,255,0.5)' : D.terra
                  : 'transparent',
              }} />
            </Box>
          );
        })}
      </Box>

      {/* ── Day header ── */}
      {activeDay && (
        <Box sx={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', mb: 2, gap: 1,
        }}>
          <Box>
            {/* Day number large */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography sx={{
                fontFamily: D.display,
                fontSize:   { xs: '2rem', sm: '2.4rem' },
                lineHeight: 1, color: D.navy,
              }}>
                Day {activeDay.dayNumber}
              </Typography>
              <Typography sx={{
                fontFamily: D.body,
                fontSize:   { xs: '0.9rem', sm: '1rem' },
                fontWeight: 600,
                color:      D.muted,
                lineHeight: 1,
              }}>
                {new Date(activeDay.date).toLocaleDateString('en-IE', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </Typography>
            </Box>

            {/* Stat chips */}
            <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={`${activeDay.stops.filter(s => s.source !== 'logistics').length} planned`}
                sx={{
                  backgroundColor: alpha(D.green, 0.12),
                  color: D.green, fontWeight: 700,
                  fontFamily: D.body, fontSize: '0.7rem',
                }}
              />
              <Chip
                size="small"
                label={freeLabel}
                sx={{
                  backgroundColor: alpha(D.navy, 0.07),
                  color: D.navy, fontWeight: 700,
                  fontFamily: D.body, fontSize: '0.7rem',
                }}
              />
              {activeDay.stops.filter(s => s.source === 'logistics').length > 0 && (
                <Chip
                  size="small"
                  icon={<LockIcon sx={{ fontSize: '11px !important' }} />}
                  label={`${activeDay.stops.filter(s => s.source === 'logistics').length} from logistics`}
                  sx={{
                    backgroundColor: alpha(D.terra, 0.10),
                    color: D.terra, fontWeight: 700,
                    fontFamily: D.body, fontSize: '0.7rem',
                    '& .MuiChip-icon': { color: D.terra },
                  }}
                />
              )}
            </Box>
          </Box>

          {!isMobile && (
            <Button
              variant="outlined" size="small"
              startIcon={<AddIcon />}
              onClick={() => openDrawer('09:00', 'meeting')}
              sx={{ flexShrink: 0, fontFamily: D.body, fontWeight: 700, mt: 0.5 }}
            >
              Quick add
            </Button>
          )}
        </Box>
      )}

      {/* ── Quick add chip row ── */}
      <Box sx={{ display: 'flex', gap: 0.75, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {visibleChips.map(t => {
          const c = STOP_CONFIG[t];
          return (
            <Chip
              key={t}
              label={c.label}
              size={isMobile ? 'medium' : 'small'}
              onClick={() => openDrawer('09:00', t)}
              sx={{
                border:      `1.5px solid ${alpha(c.color, 0.35)}`,
                color:       c.color,
                fontFamily:  D.body,
                fontWeight:  700,
                backgroundColor: 'transparent',
                '&:hover':  { backgroundColor: c.bg },
                '&:active': { backgroundColor: c.bg },
                ...(isMobile && { height: 36, '& .MuiChip-label': { px: 1.5, fontSize: '0.78rem' } }),
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
              transform:  showAllChips ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }} />}
            sx={{
              height: 36,
              backgroundColor: alpha('#000', 0.04),
              color: D.muted, fontFamily: D.body,
              '& .MuiChip-label': { px: 1, fontSize: '0.78rem' },
            }}
          />
        )}
      </Box>

      {/* ── Timeline ── */}
      {activeDay && (
        <Paper sx={{
          backgroundColor: '#ffffff',
          overflow: 'hidden',
          borderRadius: '2px',
          border: `1px solid ${D.rule}`,
        }}>
          <DndContext
            sensors={sensors}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <Box sx={{ display: 'flex', position: 'relative', height: timelineH + 32 }}>

              {/* Hour ruler column */}
              <Box sx={{
                flexShrink: 0, width: 58, position: 'relative',
                borderRight: `1px solid ${D.rule}`, pt: 2,
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

                {/* Current time indicator — only shown when viewing today */}
                {(() => {
                  const todayStr = new Date().toDateString();
                  const isToday  = activeDay && new Date(activeDay.date).toDateString() === todayStr;
                  if (!isToday) return null;
                  const now     = new Date();
                  const nowMins = now.getHours() * 60 + now.getMinutes() - DAY_START_HOUR * 60;
                  if (nowMins < 0 || nowMins > TOTAL_MINS) return null;
                  const top = nowMins * pxPerMin + 16;
                  return (
                    <Box
                      ref={nowLineRef}
                      sx={{
                        position:  'absolute',
                        top,
                        left:      0,
                        right:     0,
                        height:    2,
                        backgroundColor: '#e53935',
                        zIndex:    10,
                        pointerEvents: 'none',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: -4,
                          top: -4,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: '#e53935',
                        },
                      }}
                    />
                  );
                })()}

                {freeSlots(activeDay.stops).map((slot, i) => (
                  <FreeGap
                    key={i}
                    slot={slot}
                    onQuickAdd={time => openDrawer(time)}
                    pxPerMin={pxPerMin}
                    isMobile={isMobile}
                  />
                ))}

                {(() => {
                  const cols = computeStopColumns(activeDay.stops);
                  return activeDay.stops.map((stop, i) => (
                    <Box key={stop._id ?? i}>
                      <StopBlock
                        stop={stop}
                        onDelete={stop._id ? () => deleteStop(stop._id!) : undefined}
                        onClick={() => {
                          if (stop.source !== 'logistics' && stop._id) {
                            const t = stopStartMinutes(stop);
                            openDrawer(t ? formatTime(t) : '09:00', stop.type, stop);
                          }
                        }}
                        onResize={(newStartMin, newDuration) => resizeStop(stop, newStartMin, newDuration)}
                        pxPerMin={pxPerMin}
                        isMobile={isMobile}
                        colIndex={cols[i].col}
                        totalCols={cols[i].totalCols}
                      />
                      <TravelConnector stop={stop} pxPerMin={pxPerMin} />
                    </Box>
                  ));
                })()}

                {/* Empty state */}
                {activeDay.stops.length === 0 && (
                  <Box sx={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 1.5, pointerEvents: 'none',
                  }}>
                    <Typography sx={{
                      fontFamily: D.body, fontSize: '0.88rem', color: D.muted,
                    }}>
                      {isMobile ? 'Tap Add to start planning your day' : 'Click anywhere to add a stop'}
                    </Typography>
                    {isMobile && (
                      <Box sx={{ pointerEvents: 'auto' }}>
                        <Button
                          variant="outlined" size="small"
                          startIcon={<AddIcon />}
                          onClick={() => openDrawer('09:00', 'activity')}
                          sx={{ borderRadius: 2, fontFamily: D.body, fontWeight: 700 }}
                        >
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

      {/* ── Add / edit drawer ── */}
      <AddStopDrawer
        open={drawer.open}
        onClose={() => setDrawer(d => ({ ...d, open: false, editStop: undefined }))}
        onAdd={addStop}
        onUpdate={updateStop}
        onDelete={drawer.editStop?._id ? () => deleteStop(drawer.editStop!._id!) : undefined}
        defaultTime={drawer.time}
        defaultType={drawer.type}
        editStop={drawer.editStop}
        isMobile={isMobile}
        knownLocations={knownLocations}
      />
    </Box>
  );
}