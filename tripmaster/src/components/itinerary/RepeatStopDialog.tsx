'use client';

import { useMemo, useState } from 'react';
import { Box, Typography, Button, IconButton, Drawer, Dialog, ButtonBase } from '@mui/material';
import { alpha }  from '@mui/material/styles';
import CloseIcon  from '@mui/icons-material/Close';
import CheckIcon  from '@mui/icons-material/Check';
import { D }      from './Itinerary.config';
import type { Day, Stop } from './Itinerary.config';
import { timeRangeLabel } from './Itinerary.helpers';
import { daysBetween }    from '@/lib/itinerary/nights';
import { repeatStatus, type RepeatStatus } from '@/lib/itinerary/repeat';

interface Props {
  stop:     Stop;
  days:     Day[];
  /** The page the stop is shown on */
  pageDate: string;
  isMobile: boolean;
  onClose:  () => void;
  /** Resolves false when it couldn't be saved or queued — the picker stays open */
  onRepeat: (offsets: number[]) => Promise<boolean>;
}

const ymdOf = (v: string) => String(v).split('T')[0];
const part  = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${ymdOf(date)}T12:00:00`).toLocaleDateString('en-IE', opts);

// Pick the days a stop repeats on — same time, a copy of its own on each.
// Every day it isn't on yet starts picked.
export function RepeatStopDialog({ stop, days, pageDate, isMobile, onClose, onRepeat }: Props) {
  const tiles = useMemo(() => days
    .map(d => {
      const offset = daysBetween(pageDate, d.date);
      return { date: d.date, offset, status: (stop._id ? repeatStatus(days, stop._id, offset) : 'none') as RepeatStatus };
    })
    .filter(t => t.status !== 'none'), [days, pageDate, stop._id]);
  const free = tiles.filter(t => t.status === 'free').map(t => t.offset);

  const [picked, setPicked] = useState<Set<number>>(() => new Set(free));
  const [saving, setSaving] = useState(false);

  const allPicked = free.length > 0 && free.every(n => picked.has(n));
  const toggle    = (n: number) => setPicked(p => {
    const next = new Set(p);
    if (next.has(n)) next.delete(n); else next.add(n);
    return next;
  });

  const save = async () => {
    setSaving(true);
    const ok = await onRepeat([...picked].sort((a, b) => a - b));
    setSaving(false);
    if (ok) onClose();
  };

  const body = (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: { xs: 2.5, sm: 3 }, pt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontFamily: D.display, fontSize: '1.15rem', color: D.navy, flex: 1 }}>
            Repeat on other days
          </Typography>
          <IconButton onClick={onClose} sx={{ color: D.muted, width: 44, height: 44 }} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography sx={{ fontFamily: D.body, fontSize: '0.88rem', fontWeight: 700, color: D.navy, mb: 1.5 }}>
          {stop.name?.trim() || 'Unnamed stop'}
          <Box component="span" sx={{ color: D.muted, fontWeight: 600 }}> · {timeRangeLabel(stop)}</Box>
        </Typography>

        {free.length > 0 && (
          <Button
            size="small"
            onClick={() => setPicked(allPicked ? new Set() : new Set(free))}
            sx={{ fontFamily: D.body, fontWeight: 700, minHeight: 36, px: 1, ml: -1, mb: 1, color: D.green }}
          >
            {allPicked ? 'Clear' : 'Every day'}
          </Button>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 0.75, pb: 2 }}>
          {tiles.map(t => {
            const on       = t.status === 'free' && picked.has(t.offset);
            const disabled = t.status !== 'free';
            const note     = t.status === 'this' ? 'This day' : t.status === 'there' ? 'Already on' : null;
            return (
              <ButtonBase
                key={t.date}
                disabled={disabled}
                onClick={() => toggle(t.offset)}
                aria-pressed={on}
                sx={{
                  flexDirection: 'column', borderRadius: '10px', minHeight: 68, py: 0.75,
                  border: `1.5px solid ${on ? D.green : t.status === 'this' ? D.navy : alpha(D.navy, 0.12)}`,
                  backgroundColor: on ? alpha(D.green, 0.12) : t.status === 'this' ? D.navy : 'transparent',
                  color: t.status === 'this' ? '#fff' : t.status === 'there' ? D.muted : D.navy,
                  opacity: t.status === 'there' ? 0.7 : 1,
                }}
              >
                <Typography sx={{ fontFamily: D.body, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'inherit', opacity: 0.75 }}>
                  {part(t.date, { weekday: 'short' })}
                </Typography>
                <Typography sx={{ fontFamily: D.display, fontSize: '1.15rem', lineHeight: 1.1, color: 'inherit' }}>
                  {part(t.date, { day: 'numeric' })}
                </Typography>
                {note ? (
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.6rem', fontWeight: 700, color: 'inherit', display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    {t.status === 'there' && <CheckIcon sx={{ fontSize: 11 }} />}
                    {note}
                  </Typography>
                ) : (
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.6rem', fontWeight: 700, color: on ? D.green : D.muted }}>
                    {part(t.date, { month: 'short' })}
                  </Typography>
                )}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      <Box sx={{
        flexShrink: 0, display: 'flex', gap: 1,
        px: { xs: 2.5, sm: 3 }, pt: 1.5, pb: { xs: 'max(env(safe-area-inset-bottom, 12px), 16px)', sm: 2.5 },
        borderTop: `1px solid ${D.rule}`,
      }}>
        <Button
          variant="contained" disableElevation fullWidth
          disabled={!picked.size || saving}
          onClick={save}
          sx={{ fontFamily: D.body, fontWeight: 700, minHeight: 48, borderRadius: '10px', backgroundColor: D.navy, '&:hover': { backgroundColor: D.navy } }}
        >
          {free.length === 0
            ? 'Already on every day'
            : picked.size ? `Add to ${picked.size} day${picked.size === 1 ? '' : 's'}` : 'Pick the days'}
        </Button>
      </Box>
    </Box>
  );

  return isMobile ? (
    <Drawer
      anchor="bottom" open onClose={onClose}
      PaperProps={{ sx: {
        borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#ffffff',
      } }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.25, pb: 0.5, flexShrink: 0 }}>
        <Box sx={{ width: 36, height: 4, borderRadius: 2, backgroundColor: alpha('#000', 0.12) }} />
      </Box>
      {body}
    </Drawer>
  ) : (
    <Dialog
      open onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: '14px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', pt: 2 } }}
    >
      {body}
    </Dialog>
  );
}
