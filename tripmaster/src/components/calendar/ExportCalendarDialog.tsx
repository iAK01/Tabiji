'use client';

import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, Checkbox, FormControlLabel, Divider,
  ButtonBase, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FileDownloadIcon  from '@mui/icons-material/FileDownload';

const D = {
  green:   '#6B7C5C',
  navy:    '#2C3E50',
  paper:   '#FDFAF5',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
} as const;

type Cat = 'itinerary' | 'transport' | 'accommodation' | 'venues';

const CATEGORIES: { key: Cat; label: string; hint: string }[] = [
  { key: 'itinerary',     label: 'Itinerary',            hint: 'Scheduled stops, sessions, activities' },
  { key: 'transport',     label: 'Flights & transport',  hint: 'Flights, trains, transfers' },
  { key: 'accommodation', label: 'Accommodation',        hint: 'Hotel stays (all-day)' },
  { key: 'venues',        label: 'Venues',               hint: 'Concerts, conferences, restaurants' },
];

// YYYY-MM-DD as a local date (not UTC midnight, which can land on the day before)
const localDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export default function ExportCalendarDialog({ tripId, open, onClose, days, activeDay }: {
  tripId: string; open: boolean; onClose: () => void;
  days: string[];        // the itinerary's dates, YYYY-MM-DD
  activeDay?: string;    // the day being viewed — the first pick when choosing days
}) {
  const [picked, setPicked] = useState<Record<Cat, boolean>>({
    itinerary: true, transport: true, accommodation: true, venues: true,
  });
  const [alarms, setAlarms] = useState(true);
  const [scope,  setScope]  = useState<'all' | 'some'>('all');
  const [onDays, setOnDays] = useState<Set<string>>(new Set());

  const chosen    = CATEGORIES.filter(c => picked[c.key]).map(c => c.key);
  const dayList   = days.filter(d => onDays.has(d));
  const canExport = chosen.length > 0 && (scope === 'all' || dayList.length > 0);

  function chooseScope(next: 'all' | 'some' | null) {
    if (!next) return;
    if (next === 'some' && onDays.size === 0 && activeDay && days.includes(activeDay)) {
      setOnDays(new Set([activeDay]));
    }
    setScope(next);
  }

  function toggleDay(d: string) {
    setOnDays(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  }

  function download() {
    const qs = new URLSearchParams({ include: chosen.join(','), alarms: alarms ? '1' : '0' });
    if (scope === 'some') qs.set('days', dayList.join(','));
    const a = document.createElement('a');
    a.href = `/api/trips/${tripId}/calendar?${qs.toString()}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { backgroundColor: D.paper, borderRadius: 2.5 } }}>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <CalendarMonthIcon sx={{ color: D.green, fontSize: 22 }} />
          <Typography sx={{ fontFamily: D.display, fontSize: '1.15rem', color: D.navy, letterSpacing: '-0.02em' }}>
            Export to calendar
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3 }}>
        <Typography sx={{ fontFamily: D.body, fontSize: '0.8rem', color: 'text.secondary', mb: 1.5 }}>
          Downloads an <strong>.ics</strong> file — open it in Fantastical, Apple Calendar or Google Calendar.
          Re-download any time after you change the trip.
        </Typography>

        <Typography sx={{
          fontFamily: D.body, fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'text.secondary', mb: 0.75,
        }}>
          Days
        </Typography>
        <ToggleButtonGroup
          exclusive fullWidth size="small"
          value={scope}
          onChange={(_, v) => chooseScope(v)}
          sx={{ mb: scope === 'some' ? 1.25 : 0.5,
            '& .MuiToggleButton-root': {
              minHeight: 44, fontFamily: D.body, fontWeight: 700, fontSize: '0.8rem',
              textTransform: 'none', color: D.navy,
              '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: D.navy, color: '#ffffff' },
            } }}
        >
          <ToggleButton value="all">Whole trip</ToggleButton>
          <ToggleButton value="some">Choose days</ToggleButton>
        </ToggleButtonGroup>

        {scope === 'some' && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 0.75, mb: 0.5 }}>
            {days.map(d => {
              const on   = onDays.has(d);
              const date = localDate(d);
              return (
                <ButtonBase
                  key={d}
                  onClick={() => toggleDay(d)}
                  aria-pressed={on}
                  aria-label={date.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  sx={{
                    minHeight: 52, borderRadius: 1.5, flexDirection: 'column', gap: 0.25,
                    border: `1px solid ${on ? D.navy : 'rgba(44,62,80,0.2)'}`,
                    backgroundColor: on ? D.navy : '#ffffff',
                    color: on ? '#ffffff' : D.navy,
                    transition: 'background-color 0.15s',
                  }}
                >
                  <Typography component="span" sx={{
                    fontFamily: D.body, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em',
                    textTransform: 'uppercase', lineHeight: 1, opacity: on ? 0.7 : 0.6,
                  }}>
                    {date.toLocaleDateString('en-IE', { weekday: 'short' })}
                  </Typography>
                  <Typography component="span" sx={{ fontFamily: D.display, fontSize: '0.85rem', lineHeight: 1.1 }}>
                    {date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        )}

        <Divider sx={{ my: 1.5 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {CATEGORIES.map(c => (
            <FormControlLabel
              key={c.key}
              control={
                <Checkbox
                  checked={picked[c.key]}
                  onChange={e => setPicked(p => ({ ...p, [c.key]: e.target.checked }))}
                  sx={{ color: D.green, '&.Mui-checked': { color: D.green } }}
                />
              }
              label={
                <Box>
                  <Typography sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.85rem', color: D.navy }}>
                    {c.label}
                  </Typography>
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: 'text.disabled' }}>
                    {c.hint}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', mx: 0, py: 0.5, '& .MuiCheckbox-root': { pt: 0.25 } }}
            />
          ))}
        </Box>

        <Divider sx={{ my: 1.5 }} />

        <FormControlLabel
          control={
            <Checkbox
              checked={alarms}
              onChange={e => setAlarms(e.target.checked)}
              sx={{ color: D.green, '&.Mui-checked': { color: D.green } }}
            />
          }
          label={
            <Typography sx={{ fontFamily: D.body, fontSize: '0.85rem', color: D.navy }}>
              Add reminders <Typography component="span" sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>(3h before flights, 30–60 min before events)</Typography>
            </Typography>
          }
          sx={{ mx: 0 }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ fontFamily: D.body, fontWeight: 600 }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={download}
          disabled={!canExport}
          startIcon={<FileDownloadIcon />}
          sx={{ fontFamily: D.body, fontWeight: 700, backgroundColor: D.green,
            '&:hover': { backgroundColor: '#5a6b4e' }, '&.Mui-disabled': { backgroundColor: 'rgba(107,124,92,0.3)' } }}
        >
          Download .ics
        </Button>
      </DialogActions>
    </Dialog>
  );
}
