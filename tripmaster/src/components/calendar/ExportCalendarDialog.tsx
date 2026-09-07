'use client';

import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, Checkbox, FormControlLabel, Divider,
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

export default function ExportCalendarDialog({ tripId, open, onClose }: {
  tripId: string; open: boolean; onClose: () => void;
}) {
  const [picked, setPicked] = useState<Record<Cat, boolean>>({
    itinerary: true, transport: true, accommodation: true, venues: true,
  });
  const [alarms, setAlarms] = useState(true);

  const chosen = CATEGORIES.filter(c => picked[c.key]).map(c => c.key);

  function download() {
    const qs = new URLSearchParams({ include: chosen.join(','), alarms: alarms ? '1' : '0' });
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
          disabled={chosen.length === 0}
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
