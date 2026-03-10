'use client';
// TripDateTimePicker.tsx
// Suggested location: src/components/ui/TripDateTimePicker.tsx
//
// Calendar-based date + time picker that respects trip date boundaries.
// Replaces the browser-native datetime-local input throughout logistics forms.

import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Button, IconButton,
} from '@mui/material';
import ChevronLeftIcon  from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { toISO, toDateOnly, MONTH_NAMES, DAY_HEADERS, D } from '../logistics/logistics.helpers';

interface TripDateTimePickerProps {
  label:         string;
  value:         string;
  onChange:      (iso: string) => void;
  minDate?:      string;
  maxDate?:      string;
  initialMonth?: string;
}

export default function TripDateTimePicker({
  label, value, onChange, minDate, maxDate, initialMonth,
}: TripDateTimePickerProps) {
  const parseValue = (v: string) => {
    if (!v) return { date: '', time: '09:00' };
    const [d, t] = v.split('T');
    return { date: d ?? '', time: t ? t.slice(0, 5) : '09:00' };
  };

  const { date: initDate, time: initTime } = parseValue(value);
  const [open,    setOpen]    = useState(false);
  const [selDate, setSelDate] = useState(initDate);
  const [selTime, setSelTime] = useState(initTime);

  // Sync when value changes externally (e.g. on edit open)
  useEffect(() => {
    const { date, time } = parseValue(value);
    setSelDate(date);
    setSelTime(time);
  }, [value]);

  // Seed month from initialMonth or minDate, not today — strip time portion defensively
  const seedStr  = toDateOnly(initialMonth || minDate || toISO(new Date()));
  const seedDate = new Date(seedStr + 'T12:00:00');
  const [year,  setYear]  = useState(seedDate.getFullYear());
  const [month, setMonth] = useState(seedDate.getMonth());

  // Re-seed month when initialMonth changes (e.g. departure drives arrival month)
  useEffect(() => {
    const src = initialMonth || minDate;
    if (src) {
      const d = new Date(toDateOnly(src) + 'T12:00:00');
      setYear(d.getFullYear());
      setMonth(d.getMonth());
    }
  }, [initialMonth, minDate]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow    = new Date(year, month, 1).getDay(); // 0 = Sun
  const offset      = (firstDow + 6) % 7;               // convert to Mon-start
  const today       = toISO(new Date());

  const isDisabled = (iso: string) => {
    if (minDate && iso < minDate) return true;
    if (maxDate && iso > maxDate) return true;
    return false;
  };

  // Build grid cells: null = empty padding
  const cells: Array<string | null> = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const handleConfirm = () => {
    if (!selDate) return;
    onChange(`${selDate}T${selTime}`);
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setSelDate('');
    setSelTime('09:00');
    setOpen(false);
  };

  const formatDisplay = (v: string) => {
    if (!v) return null;
    const [d, t] = v.split('T');
    if (!d) return null;
    const dateStr = new Date(d + 'T12:00:00').toLocaleDateString('en-IE', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    return t ? `${dateStr} · ${t.slice(0, 5)}` : dateStr;
  };

  const displayed = formatDisplay(value);

  return (
    <Box>
      {/* ── Trigger ── */}
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          border: '1px solid',
          borderColor: open ? D.navy : 'rgba(0,0,0,0.23)',
          borderRadius: 1,
          px: 1.75,
          py: 1.625,
          cursor: 'pointer',
          position: 'relative',
          transition: 'border-color 0.15s',
          '&:hover': { borderColor: 'text.primary' },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            top: -10, left: 10,
            bgcolor: 'background.paper',
            px: 0.5,
            fontSize: '0.75rem',
            lineHeight: 1,
            color: open ? D.navy : 'text.secondary',
            fontFamily: D.body,
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: '1rem',
            userSelect: 'none',
            fontFamily: D.body,
            color: displayed ? 'text.primary' : 'text.disabled',
          }}
        >
          {displayed ?? 'Select date & time'}
        </Typography>
      </Box>

      {/* ── Calendar panel ── */}
      {open && (
        <Paper
          elevation={4}
          sx={{ mt: 0.5, p: 2, border: '1px solid', borderColor: D.navy, borderRadius: 2 }}
        >
          {/* Month navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <IconButton onClick={prevMonth} size="small" sx={{ border: '1px solid', borderColor: 'divider' }}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <Typography sx={{ fontFamily: D.display, fontSize: '0.9rem' }}>
              {MONTH_NAMES[month]} {year}
            </Typography>
            <IconButton onClick={nextMonth} size="small" sx={{ border: '1px solid', borderColor: 'divider' }}>
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Day-of-week headers */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
            {DAY_HEADERS.map((d: string) => (
              <Typography
                key={d} align="center" variant="caption" color="text.secondary"
                sx={{ fontFamily: D.body, fontWeight: 600, fontSize: '0.65rem' }}
              >
                {d}
              </Typography>
            ))}
          </Box>

          {/* Day cells */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.25 }}>
            {cells.map((iso, idx) => {
              if (!iso) return <Box key={idx} />;
              const disabled = isDisabled(iso);
              const selected = iso === selDate;
              const isToday  = iso === today;
              const dayNum   = new Date(iso + 'T12:00:00').getDate();
              return (
                <Box
                  key={iso}
                  onClick={() => { if (!disabled) setSelDate(iso); }}
                  sx={{
                    height: 44,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%',
                    cursor:  disabled ? 'default' : 'pointer',
                    bgcolor: selected ? D.navy    : 'transparent',
                    border:  isToday && !selected ? `2px solid ${D.navy}` : 'none',
                    color:   selected ? '#fff' : disabled ? 'text.disabled' : 'text.primary',
                    fontFamily: selected ? D.display : D.body,
                    fontSize: '0.875rem',
                    transition: 'background-color 0.1s',
                    '&:hover': disabled || selected ? {} : { bgcolor: 'action.hover' },
                  }}
                >
                  {dayNum}
                </Box>
              );
            })}
          </Box>

          {/* Time input — appears once a date is selected */}
          {selDate && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography
                variant="caption" color="text.secondary"
                sx={{
                  display: 'block', mb: 1,
                  textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em',
                  fontFamily: D.body, fontWeight: 600,
                }}
              >
                Time
              </Typography>
              <TextField
                type="time"
                value={selTime}
                onChange={e => setSelTime(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={{ width: 150 }}
              />
            </Box>
          )}

          {/* Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            <Button
              size="small" onClick={handleClear} color="inherit"
              sx={{ fontFamily: D.body }}
            >
              Clear
            </Button>
            <Button
              size="small" variant="contained" onClick={handleConfirm} disabled={!selDate}
              sx={{
                fontFamily: D.display, fontSize: '0.75rem',
                bgcolor: D.navy, boxShadow: 'none',
                '&:hover': { bgcolor: '#1a2235', boxShadow: 'none' },
              }}
            >
              Confirm
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
}