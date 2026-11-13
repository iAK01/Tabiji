'use client';

import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha }           from '@mui/material/styles';
import WarningAmberIcon    from '@mui/icons-material/WarningAmber';
import {
  DAY_START_HOUR, DAY_END_HOUR, D,
} from './Itinerary.config';
import type { Stop } from './Itinerary.config';
import { minutesToPx, stopStartMinutes, formatTime } from './Itinerary.helpers';
import type { HourWeather } from './hourWeather';
import { TravelIcon, travelText } from './LegRow';
import type { Leg, Travel } from '@/lib/itinerary/dayPlan';
import { weatherIcon, warmth } from '@/components/weather/weatherUi';

// ─── Hour ruler ────────────────────────────────────────────────────────────────
export function HourRuler({ pxPerMin, startHour = DAY_START_HOUR, endHour = DAY_END_HOUR, nextDayLabel, weather, onWeatherTap, compact }: {
  pxPerMin: number; startHour?: number; endHour?: number;
  /** Under the midnight mark when the night runs on past it: "Fri" */
  nextDayLabel?: string;
  /** Page hour → that hour's weather, drawn between its mark and the next */
  weather?: Map<number, HourWeather> | null;
  onWeatherTap?: (w: HourWeather) => void;
  /** Phone: weather sits right under its hour mark, "feels" only when it differs */
  compact?: boolean;
}) {
  const hourH = 60 * pxPerMin;
  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i,
  );
  return (
    <Box sx={{ position: 'relative', width: 58, flexShrink: 0, userSelect: 'none' }}>
      {hours.map(h => (
        <Box key={h} sx={{
          position: 'absolute',
          top: (h - startHour) * hourH - 10,
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
            {`${String(h % 24).padStart(2, '0')}:00`}
          </Typography>
          {h === 24 && h < endHour && nextDayLabel && (
            <Typography sx={{
              fontFamily: D.body, fontSize: '0.56rem', fontWeight: 800, lineHeight: 1, mt: 0.4,
              letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'right',
              color: alpha(D.navy, 0.55),
            }}>
              {nextDayLabel}
            </Typography>
          )}
        </Box>
      ))}
      {weather && [...weather].map(([h, w]) => (
        <HourWeatherGlyph
          key={`wx-${h}`} w={w} hour={h} compact={compact}
          top={compact
            // Clear of the hour mark, and of the day name under midnight
            ? (h - startHour) * hourH + 4 + (h === 24 && nextDayLabel ? 10 : 0)
            : (h - startHour) * hourH + hourH / 2 - GLYPH_H / 2}
          onTap={onWeatherTap}
        />
      ))}
    </Box>
  );
}

const GLYPH_H = 44;

// Phone: "feels" earns its line only when it's this far from the air temperature
const FEELS_DIFF_SHOWN = 3;

function HourWeatherGlyph({ w, hour, top, onTap, compact }: {
  w: HourWeather; hour: number; top: number; onTap?: (w: HourWeather) => void; compact?: boolean;
}) {
  const { Icon, color } = weatherIcon(w.code, '', w.isDay);
  const time = `${String(hour % 24).padStart(2, '0')}:00`;
  const showFeels = w.feels != null && (!compact || Math.abs(w.feels - w.temp) >= FEELS_DIFF_SHOWN);
  return (
    <ButtonBase
      onClick={() => onTap?.(w)}
      aria-label={`${time} ${w.city}: ${w.temp}°${w.feels != null ? `, feels like ${w.feels}°` : ''}. Open weather`}
      sx={{
        position: 'absolute', top, right: 6, width: 50, height: GLYPH_H,
        borderRadius: '8px', pr: 0.75,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        justifyContent: compact ? 'flex-start' : 'center', pt: compact ? 0.5 : 0,
        '&:hover': { backgroundColor: alpha(D.navy, 0.04) },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <Icon sx={{ fontSize: 13, color }} />
        <Typography sx={{
          fontFamily: D.body, fontSize: '0.7rem', fontWeight: 800, lineHeight: 1,
          fontVariantNumeric: 'tabular-nums', color: warmth(w.temp),
        }}>
          {w.temp}°
        </Typography>
      </Box>
      {showFeels && (
        <Typography sx={{
          fontFamily: D.body, fontSize: '0.56rem', fontWeight: 600, lineHeight: 1, mt: 0.4,
          fontVariantNumeric: 'tabular-nums', color: alpha(D.navy, 0.45), whiteSpace: 'nowrap',
        }}>
          feels {w.feels}°
        </Typography>
      )}
    </ButtonBase>
  );
}

// ─── Grid lines ────────────────────────────────────────────────────────────────
export function GridLines({ pxPerMin, startHour = DAY_START_HOUR, endHour = DAY_END_HOUR }: { pxPerMin: number; startHour?: number; endHour?: number }) {
  const hourH = 60 * pxPerMin;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => i);
  return (
    <>
      {hours.map(i => (
        <Box key={i} sx={{
          position: 'absolute', top: i * hourH, left: 0, right: 0,
          // Midnight inside the page: the night runs on into the next date
          borderTop: startHour + i === 24 ? `1.5px solid ${alpha(D.navy, 0.22)}` : `1px solid ${D.rule}`,
          pointerEvents: 'none',
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
  slot, onQuickAdd, onDiscover, pxPerMin, isMobile, startHour = DAY_START_HOUR,
}: {
  slot:        { start: number; end: number; mins: number };
  onQuickAdd:  (time: string) => void;
  onDiscover?: () => void;
  pxPerMin:    number;
  isMobile:    boolean;
  startHour?:  number;
}) {
  if (slot.mins < 30) return null;

  const top    = minutesToPx(slot.start, pxPerMin, startHour);
  const height = slot.mins * pxPerMin;
  const h      = Math.floor(slot.mins / 60);
  const m      = slot.mins % 60;
  const label  = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''} free` : `${m}m free`;
  const isLarge = slot.mins >= 120;

  return (
    <Box
      onClick={() => onQuickAdd(formatTime(slot.start))}
      sx={{
        position: 'absolute', left: 0, right: isMobile ? 2 : 4, top, height,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 0.75,
        cursor: 'pointer', zIndex: 1, borderRadius: 1,
        '&:hover .free-label': { opacity: 1 },
        '&:hover .discover-hint': { opacity: 1 },
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

      {isLarge && onDiscover && (
        <Typography
          className="discover-hint"
          component="span"
          onClick={e => { e.stopPropagation(); onDiscover(); }}
          sx={{
            opacity:         0,
            transition:      'opacity 0.15s',
            color:           D.terra,
            fontSize:        '0.68rem',
            fontFamily:      D.body,
            fontWeight:      700,
            letterSpacing:   '0.04em',
            backgroundColor: 'rgba(196,113,74,0.08)',
            border:          `1px dashed rgba(196,113,74,0.35)`,
            px: 1.25, py: 0.35, borderRadius: 4,
            cursor:          'pointer',
          }}
        >
          See ideas →
        </Typography>
      )}
    </Box>
  );
}

// ─── Travel connector ──────────────────────────────────────────────────────────
// The way on from a stop, drawn in the time after it: how and how long, a warning
// when it doesn't fit, and a question when there's no way planned. Tap → the map.
export function TravelConnector({ stop, legs, pxPerMin, startHour = DAY_START_HOUR, onSelect }: {
  stop:      Stop;
  legs:      Array<{ leg: Leg<Stop>; travel: Travel; asking: boolean }>;
  pxPerMin:  number;
  startHour?: number;
  onSelect:  (leg: Leg<Stop>) => void;
}) {
  const start = stopStartMinutes(stop);
  if (start === null || !legs.length) return null;
  const { leg, travel, asking } = legs.find(l => l.asking) ?? legs[0];
  const top     = minutesToPx(start + (stop.duration ?? 60), pxPerMin, startHour);
  const mins    = legs.reduce((sum, l) => sum + (l.leg.kind === 'move' ? l.travel.minutes ?? 0 : 0), 0);
  const late    = travel.late !== null;
  const text    = asking
    ? `How are you getting to ${leg.to.name}?`
    : legs.map(l => (l.leg.anchor === 'end' ? `${travelText(l.leg, l.travel)} to ${l.leg.to.name}` : travelText(l.leg, l.travel))).join(' · then ');

  return (
    <ButtonBase
      onClick={e => { e.stopPropagation(); onSelect(leg); }}
      aria-label={`${text}. Show on the map`}
      sx={{
        position: 'absolute', left: 0, right: 4, top, zIndex: 3,
        height: Math.max(mins * pxPerMin, 20),
        display: 'flex', alignItems: 'center', justifyContent: 'flex-start', px: 1,
        backgroundColor: asking ? alpha(D.terra, 0.08) : late ? alpha('#ef4444', 0.08) : travel.tight ? alpha('#f59e0b', 0.08) : 'transparent',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
        {late ? <WarningAmberIcon sx={{ fontSize: 12, color: 'error.main' }} /> : <TravelIcon leg={leg} travel={travel} size={12} color={asking ? D.terra : undefined} />}
        <Typography sx={{
          fontSize: '0.65rem', fontFamily: D.body, lineHeight: 1.2,
          fontWeight: asking || late || travel.tight ? 700 : 400,
          color: asking ? D.terra : late ? 'error.main' : travel.tight ? 'warning.dark' : D.muted,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {text}{late ? ` · ${travel.late} min short` : travel.tight ? ' · tight' : ''}
        </Typography>
      </Box>
    </ButtonBase>
  );
}
