'use client';

import { Box, Typography } from '@mui/material';
import { alpha }           from '@mui/material/styles';
import DirectionsWalkIcon  from '@mui/icons-material/DirectionsWalk';
import LocalTaxiIcon       from '@mui/icons-material/LocalTaxi';
import WarningAmberIcon    from '@mui/icons-material/WarningAmber';
import {
  DAY_START_HOUR, DAY_END_HOUR, D,
} from './Itinerary.config';
import type { Stop } from './Itinerary.config';
import { minutesToPx, stopStartMinutes, formatTime } from './Itinerary.helpers';

// ─── Hour ruler ────────────────────────────────────────────────────────────────
export function HourRuler({ pxPerMin }: { pxPerMin: number }) {
  const hourH = 60 * pxPerMin;
  const hours = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
    (_, i) => DAY_START_HOUR + i,
  );
  return (
    <Box sx={{ position: 'relative', width: 58, flexShrink: 0, userSelect: 'none' }}>
      {hours.map(h => (
        <Box key={h} sx={{
          position: 'absolute',
          top: (h - DAY_START_HOUR) * hourH - 10,
          right: 12,
        }}>
          <Typography sx={{
            fontSize:           h % 6 === 0 ? '0.8rem' : '0.68rem',
            fontVariantNumeric: 'tabular-nums',
            lineHeight:         1,
            color:              h % 6 === 0 ? alpha(D.navy, 0.8) : alpha(D.navy, 0.28),
            fontFamily:         D.display,
            fontWeight:         900,
          }}>
            {h === 24 ? '00:00' : `${String(h).padStart(2, '0')}:00`}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ─── Grid lines ────────────────────────────────────────────────────────────────
export function GridLines({ pxPerMin }: { pxPerMin: number }) {
  const hourH = 60 * pxPerMin;
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => i);
  return (
    <>
      {hours.map(i => (
        <Box key={i} sx={{
          position: 'absolute', top: i * hourH, left: 0, right: 0,
          borderTop: `1px solid ${D.rule}`, pointerEvents: 'none',
        }} />
      ))}
      {hours.map(i => (
        <Box key={`half-${i}`} sx={{
          position: 'absolute', top: i * hourH + hourH / 2, left: 0, right: 0,
          borderTop: `1px dashed ${alpha('#000', 0.04)}`, pointerEvents: 'none',
        }} />
      ))}
    </>
  );
}

// ─── Free time gap ─────────────────────────────────────────────────────────────
export function FreeGap({
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
        cursor: 'pointer', zIndex: 1, borderRadius: 1,
        '&:hover .free-label': { opacity: 1 },
        '&:active': { backgroundColor: alpha(D.green, 0.06) },
        '&:hover':  { backgroundColor: alpha(D.green, 0.04) },
      }}
    >
      <Typography
        className="free-label"
        sx={{
          opacity:         isMobile ? 0.45 : 0,
          transition:      'opacity 0.15s',
          color:           D.muted,
          fontSize:        '0.72rem',
          fontFamily:      D.body,
          fontWeight:      700,
          letterSpacing:   '0.04em',
          backgroundColor: D.paper,
          border:          `1px dashed ${D.rule}`,
          px: 1.25, py: 0.4, borderRadius: 4,
          pointerEvents:   'none',
        }}
      >
        + {label}
      </Typography>
    </Box>
  );
}

// ─── Travel connector ──────────────────────────────────────────────────────────
export function TravelConnector({ stop, pxPerMin }: { stop: Stop; pxPerMin: number }) {
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {t.isImpossible
          ? <WarningAmberIcon sx={{ fontSize: 12, color: 'error.main' }} />
          : t.mode === 'walk'
          ? <DirectionsWalkIcon sx={{ fontSize: 12, color: D.muted }} />
          : <LocalTaxiIcon sx={{ fontSize: 12, color: D.muted }} />
        }
        <Typography sx={{
          fontSize:   '0.65rem',
          fontFamily: D.body,
          fontWeight: t.isTight || t.isImpossible ? 700 : 400,
          color: t.isImpossible ? 'error.main' : t.isTight ? 'warning.dark' : D.muted,
        }}>
          {t.duration}min · {(t.distance / 1000).toFixed(1)}km
          {t.isTight && ' ⚠️'}
          {t.isImpossible && ' 🚨'}
        </Typography>
      </Box>
    </Box>
  );
}