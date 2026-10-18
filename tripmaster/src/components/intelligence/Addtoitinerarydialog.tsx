'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItemButton, ListItemText,
} from '@mui/material';
import CheckCircleIcon   from '@mui/icons-material/CheckCircle';
import CloudQueueIcon    from '@mui/icons-material/CloudQueue';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon    from '@mui/icons-material/AccessTime';
import type { ItineraryDay } from './Intelligence.types';
import { freeSlots, formatTime } from '@/components/itinerary/Itinerary.helpers';
import { sendOrQueue } from '@/lib/offline/writes';
import { assertSaved } from '@/lib/offline/saveErrors';

// Anything Discover can add — a pick or a guide listing.
export interface AddTarget {
  name:         string;
  type:         string;       // highlight type: museum, park, coffee, food…
  address?:     string;
  coordinates?: { lat: number; lng: number };
  notes?:       string;
}

interface Props {
  open:      boolean;
  onClose:   () => void;
  highlight: AddTarget | null;
  tripId:    string;
}

function stopType(h: AddTarget): string {
  if (h.type === 'coffee' || h.type === 'food') return 'meal';
  if (h.type === 'park')                         return 'activity';
  if (h.type === 'museum' || h.type === 'gallery' || h.type === 'landmark') return 'sightseeing';
  return 'activity';
}

function defaultDuration(h: AddTarget): number {
  if (h.type === 'coffee') return 45;
  if (h.type === 'park')   return 60;
  return 90;
}

export default function Addtoitinerarydialog({ open, onClose, highlight, tripId }: Props) {
  const [days,        setDays]        = useState<ItineraryDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<ItineraryDay | null>(null);
  const [time,        setTime]        = useState('10:00');
  const [saving,      setSaving]      = useState(false);
  const [done,        setDone]        = useState<'saved' | 'queued' | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setDone(null); setSelectedDay(null); setError(null); return; }
    fetch(`/api/trips/${tripId}/itinerary`)
      .then(r => r.json())
      .then(d => {
        const ds = d.days ?? [];
        setDays(ds);
        if (ds.length === 1) setSelectedDay(ds[0]);
      })
      .catch(() => {});
  }, [open, tripId]);

  // Same ADD_STOP action the Itinerary tab queues, so it replays after a flight.
  const confirm = async () => {
    const day = selectedDay ?? (days.length === 1 ? days[0] : null);
    if (!highlight || !day) return;
    setSaving(true);
    setError(null);
    const stop = {
      name:           highlight.name,
      type:           stopType(highlight),
      address:        highlight.address     ?? undefined,
      coordinates:    highlight.coordinates ?? undefined,
      duration:       defaultDuration(highlight),
      notes:          highlight.notes       ?? undefined,
      scheduledStart: time,
    };
    const dateStr = day.date.split('T')[0];
    try {
      const res = await sendOrQueue(
        { type: 'ADD_STOP', tripId, payload: { dayDate: day.date, stop } },
        () => fetch(`/api/trips/${tripId}/itinerary/stops`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ dayDate: day.date, stop: { ...stop, scheduledStart: `${dateStr}T${time}:00` } }),
        }),
        {
          [`/api/trips/${tripId}/itinerary`]: (saved: any) => saved?.days && {
            ...saved,
            days: saved.days.map((d: any) => d.date === day.date
              ? { ...d, stops: [...(d.stops ?? []), { ...stop, scheduledStart: `${dateStr}T${time}:00` }] }
              : d),
          },
        },
      );
      if (res) assertSaved(res);
      setDone(res ? 'saved' : 'queued');
    } catch {
      setError('Couldn’t add it — try again');
    } finally {
      setSaving(false);
    }
  };

  const formatDayLabel = (d: ItineraryDay) =>
    new Date(d.date).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', pb: 1 }}>
        Add to Itinerary
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        {highlight && (
          <Typography color="text.secondary" sx={{ fontSize: '0.95rem', mb: 2 }}>
            Adding <strong>{highlight.name}</strong>
          </Typography>
        )}

        {done ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
            {done === 'saved'
              ? <CheckCircleIcon color="success" sx={{ fontSize: '1.5rem' }} />
              : <CloudQueueIcon sx={{ fontSize: '1.5rem', color: 'text.secondary' }} />}
            <Box>
              <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>Added to itinerary</Typography>
              {done === 'queued' && (
                <Typography color="text.secondary" sx={{ fontSize: '0.88rem' }}>Syncs when you’re back online</Typography>
              )}
            </Box>
          </Box>
        ) : days.length === 0 ? (
          <Typography color="text.secondary" sx={{ fontSize: '0.95rem', py: 2 }}>
            No itinerary days found. Add dates to your trip first.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {days.length > 1 && (
              <Box>
                <Typography fontWeight={700}
                  sx={{ fontSize: '0.88rem', mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
                  Which day?
                </Typography>
                <List disablePadding>
                  {days.map(day => (
                    <ListItemButton
                      key={day.date}
                      selected={selectedDay?.date === day.date}
                      onClick={() => setSelectedDay(day)}
                      sx={{
                        borderRadius: 1, mb: 0.5,
                        border: '1px solid',
                        borderColor: selectedDay?.date === day.date ? '#55702C' : 'divider',
                        backgroundColor: selectedDay?.date === day.date ? 'rgba(85,112,44,0.06)' : 'transparent',
                      }}
                    >
                      <CalendarTodayIcon sx={{ fontSize: '1rem', mr: 1.5, color: '#55702C' }} />
                      <ListItemText
                        primary={`Day ${day.dayNumber} — ${formatDayLabel(day)}`}
                        secondary={`${day.stops.length} stop${day.stops.length !== 1 ? 's' : ''} planned`}
                        primaryTypographyProps={{ fontWeight: 700, fontSize: '0.95rem' }}
                        secondaryTypographyProps={{ fontSize: '0.85rem' }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            )}

            {(selectedDay || days.length === 1) && (() => {
              const day      = selectedDay ?? days[0];
              const slots    = freeSlots(day.stops).filter(s => s.mins >= defaultDuration(highlight!));
              return (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {slots.length > 0 && (
                    <Box>
                      <Typography fontWeight={700}
                        sx={{ fontSize: '0.88rem', mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
                        Free slots
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {slots.map((slot, i) => {
                          const slotTime  = formatTime(slot.start);
                          const freeH     = Math.floor(slot.mins / 60);
                          const freeM     = slot.mins % 60;
                          const freeLabel = freeH > 0 ? `${freeH}h${freeM > 0 ? ` ${freeM}m` : ''} free` : `${freeM}m free`;
                          const selected  = time === slotTime;
                          return (
                            <Chip
                              key={i}
                              icon={<AccessTimeIcon sx={{ fontSize: '0.9rem !important' }} />}
                              label={`${slotTime} · ${freeLabel}`}
                              onClick={() => setTime(slotTime)}
                              variant={selected ? 'filled' : 'outlined'}
                              size="small"
                              sx={{
                                fontWeight:      700,
                                fontSize:        '0.82rem',
                                borderColor:     selected ? '#55702C' : 'divider',
                                backgroundColor: selected ? 'rgba(85,112,44,0.12)' : 'transparent',
                                color:           selected ? '#55702C' : 'text.secondary',
                                cursor:          'pointer',
                              }}
                            />
                          );
                        })}
                      </Box>
                    </Box>
                  )}
                  <Box>
                    <Typography fontWeight={700}
                      sx={{ fontSize: '0.88rem', mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
                      {slots.length > 0 ? 'Or pick a time' : 'What time?'}
                    </Typography>
                    <input
                      type="time"
                      value={time}
                      onChange={e => setTime(e.target.value)}
                      style={{
                        fontSize: '1.1rem', fontWeight: 700,
                        border: '1px solid #ddd', borderRadius: 6,
                        padding: '10px 14px', width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  </Box>
                </Box>
              );
            })()}

            {error && (
              <Typography color="error" sx={{ fontSize: '0.9rem' }}>{error}</Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
          {done ? 'Close' : 'Cancel'}
        </Button>
        {!done && (selectedDay || days.length === 1) && (
          <Button
            variant="contained"
            disabled={saving || (!selectedDay && days.length > 1)}
            onClick={confirm}
            sx={{ fontWeight: 700, fontSize: '0.95rem', backgroundColor: '#1D2642', '&:hover': { backgroundColor: '#2a3660' } }}
          >
            {saving ? 'Adding…' : 'Add to day'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}