'use client';

// One day in full — tapped from a day card or a watch-out. Plan-your-day reads
// first (when it rains, the dry stretch, sun-cream hours), then the day's
// numbers, then every hour. Bottom sheet on phones, dialog on desktop — same as
// the itinerary's stop sheet.

import { useEffect, useState } from 'react';
import {
  Box, Typography, IconButton, Drawer, Dialog, Button, alpha, useMediaQuery, useTheme,
} from '@mui/material';
import CloseIcon        from '@mui/icons-material/Close';
import ChevronLeftIcon  from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckroomIcon    from '@mui/icons-material/Checkroom';
import ThermostatIcon   from '@mui/icons-material/Thermostat';
import NightsStayIcon   from '@mui/icons-material/NightsStay';
import UmbrellaIcon     from '@mui/icons-material/Umbrella';
import LightModeIcon    from '@mui/icons-material/LightMode';
import WbSunnyIcon      from '@mui/icons-material/WbSunny';
import AirIcon          from '@mui/icons-material/Air';
import {
  compass, currentHourIn, dayPlan, hourLabel, hourRows, uvLabel,
  type DayWeather, type HourRow, type PlanItem,
} from '@/lib/weather-insights';
import { D, weatherIcon, warmth, type IconComponent } from './weatherUi';

const PLAN_ICON: Record<PlanItem['key'], IconComponent> = {
  wear:    CheckroomIcon,
  warmest: ThermostatIcon,
  evening: NightsStayIcon,
  rain:    UmbrellaIcon,
  dry:     LightModeIcon,
  sun:     WbSunnyIcon,
  wind:    AirIcon,
};

const longDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-IE', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });

const label = {
  fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.08em',
  textTransform: 'uppercase' as const, color: D.muted, fontFamily: D.body,
};

// ─── Pieces ────────────────────────────────────────────────────────────────────

function Fact({ name, value, sub }: { name: string; value: string; sub?: string }) {
  return (
    <Box sx={{ p: 1.5, border: `1.5px solid ${D.rule}`, borderRadius: '10px', backgroundColor: D.paper, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.8rem', color: D.muted, fontFamily: D.body }}>{name}</Typography>
      <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: D.navy, fontFamily: D.body, lineHeight: 1.3 }}>
        {value}
      </Typography>
      {sub && <Typography sx={{ fontSize: '0.8rem', color: D.muted, fontFamily: D.body }}>{sub}</Typography>}
    </Box>
  );
}

const HOUR_GRID = { xs: '50px 30px 66px 1fr 76px', sm: '60px 34px 84px 1fr 104px' };

function HourLine({ r, typical, isNow }: { r: HourRow; typical: boolean; isNow: boolean }) {
  const { Icon, color } = weatherIcon(r.code, '', r.isDay);
  const chance = r.rain ?? 0;
  const rainText = typical
    ? `${chance}%`
    : `${chance}%${(r.mm ?? 0) >= 0.1 ? ` · ${r.mm} mm` : ''}`;

  return (
    <Box sx={{
      display: 'grid', gridTemplateColumns: HOUR_GRID, columnGap: 1, alignItems: 'center',
      px: { xs: 1.25, sm: 1.75 }, py: 0.9,
      borderTop: `1px solid ${D.rule}`,
      backgroundColor: isNow ? alpha(D.terra, 0.07) : 'transparent',
      boxShadow: isNow ? `inset 3px 0 0 ${D.terra}` : 'none',
      fontVariantNumeric: 'tabular-nums',
    }}>
      <Typography sx={{ fontSize: '0.92rem', fontWeight: isNow ? 800 : 600, color: isNow ? D.terra : D.navy, fontFamily: D.body }}>
        {isNow ? 'Now' : hourLabel(r.hour)}
      </Typography>
      <Icon sx={{ fontSize: '1.3rem', color }} />
      <Box>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: warmth(r.temp), fontFamily: D.body, lineHeight: 1.2 }}>
          {r.temp}°
        </Typography>
        {r.feels != null && (
          <Typography sx={{ fontSize: '0.78rem', color: D.muted, fontFamily: D.body, lineHeight: 1.2 }}>
            feels {r.feels}°
          </Typography>
        )}
      </Box>
      {/* Rain — the meter's track is a lighter step of the same hue */}
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: '0.85rem', color: chance >= 50 ? D.navy : D.muted, fontWeight: chance >= 50 ? 700 : 400, fontFamily: D.body }}>
          {r.rain == null ? '—' : rainText}
        </Typography>
        <Box sx={{ height: 4, borderRadius: 2, backgroundColor: alpha(D.cool, 0.14), mt: 0.4, overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${Math.min(100, chance)}%`, borderRadius: 2, backgroundColor: D.cool }} />
        </Box>
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        <Typography sx={{ fontSize: '0.85rem', color: D.navy, fontFamily: D.body, lineHeight: 1.2 }}>
          {r.wind ?? '—'}{r.dir != null ? ` ${compass(r.dir)}` : ''}
        </Typography>
        {r.gust != null && r.gust - (r.wind ?? 0) >= 10 && (
          <Typography sx={{ fontSize: '0.75rem', color: D.muted, fontFamily: D.body, lineHeight: 1.2 }}>
            gust {r.gust}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ─── Body ──────────────────────────────────────────────────────────────────────

function DayBody({
  day, timezone, place, canPrev, canNext, onPrev, onNext, onClose, onOpenItinerary,
}: {
  day: DayWeather; timezone: string | null; place: string;
  canPrev: boolean; canNext: boolean;
  onPrev: () => void; onNext: () => void; onClose: () => void; onOpenItinerary: () => void;
}) {
  const [showEarlier, setShowEarlier] = useState(false);
  const typical = day.source === 'historical';
  const nowHour = currentHourIn(timezone, day.date);
  const isToday = nowHour != null;
  const plan    = dayPlan(day, nowHour ?? 0);
  const rows    = hourRows(day);
  const visible = isToday && !showEarlier ? rows.filter(r => r.hour >= nowHour!) : rows;
  const hidden  = rows.length - visible.length;
  const { Icon, color } = weatherIcon(day.code, day.condition);

  const facts: { name: string; value: string; sub?: string }[] = [];
  facts.push(typical
    ? { name: 'Rain', value: `${day.chanceOfRain ?? 0}%`, sub: 'chance of a wet day' }
    : {
        name: 'Rain', value: `${day.precipMm} mm`,
        sub: [day.chanceOfRain != null ? `${day.chanceOfRain}% chance` : null,
              day.rainHours ? `${day.rainHours} h of rain` : null].filter(Boolean).join(' · ') || undefined,
      });
  if (day.windKph != null) {
    facts.push({
      name: 'Wind',
      value: `${day.windKph} km/h${day.windDir != null ? ` ${compass(day.windDir)}` : ''}`,
      sub: day.gustKph != null ? `gusts ${day.gustKph} km/h` : typical ? 'typical max' : undefined,
    });
  }
  if (day.uvIndex != null) {
    facts.push({
      name: 'UV index', value: `${Math.round(day.uvIndex)}`,
      sub: `${uvLabel(day.uvIndex)}${typical ? ' on a clear day' : ''}`,
    });
  }
  if (day.sunshineHours != null) {
    facts.push({
      name: 'Sunshine', value: `${day.sunshineHours} h`,
      sub: day.daylightHours != null ? `of ${day.daylightHours} h daylight` : undefined,
    });
  }
  if (day.humidity != null) facts.push({ name: 'Humidity', value: `${day.humidity}%`, sub: 'average' });
  if (day.sunrise && day.sunset) facts.push({ name: 'Sunrise and sunset', value: `${day.sunrise} – ${day.sunset}` });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      {/* Header — day navigation stays put while the hours scroll */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 1, flexShrink: 0,
        borderBottom: `1px solid ${D.rule}`,
      }}>
        <IconButton aria-label="Previous day" disabled={!canPrev} onClick={onPrev} sx={{ width: 44, height: 44 }}>
          <ChevronLeftIcon />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <Typography noWrap sx={{ fontFamily: D.display, fontSize: '1.15rem', color: D.navy, lineHeight: 1.2 }}>
            {isToday ? 'Today' : longDate(day.date)}
          </Typography>
          <Typography noWrap sx={{ fontSize: '0.82rem', color: D.muted, fontFamily: D.body }}>
            {[isToday ? longDate(day.date) : null, place, typical ? 'typical day' : null].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        <IconButton aria-label="Next day" disabled={!canNext} onClick={onNext} sx={{ width: 44, height: 44 }}>
          <ChevronRightIcon />
        </IconButton>
        <IconButton aria-label="Close" onClick={onClose} sx={{ width: 44, height: 44, color: D.muted }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        px: { xs: 2, sm: 3 }, pt: 2, pb: 'calc(env(safe-area-inset-bottom) + 24px)',
        display: 'flex', flexDirection: 'column', gap: 2.5,
      }}>
        {/* Hero */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Icon sx={{ fontSize: '3rem', color }} />
          <Box>
            <Typography sx={{ fontFamily: D.display, fontSize: '2.4rem', lineHeight: 1, color: warmth(day.tempMax) }}>
              {day.tempMax}°
              <Box component="span" sx={{ fontFamily: D.body, fontSize: '1.1rem', color: D.muted, fontWeight: 600, ml: 1 }}>
                low {day.tempMin}°
              </Box>
            </Typography>
            <Typography sx={{ fontSize: '1rem', color: D.navy, fontFamily: D.body, mt: 0.5 }}>{day.condition}</Typography>
            {day.feelsMin != null && day.feelsMax != null && (
              <Typography sx={{ fontSize: '0.9rem', color: D.muted, fontFamily: D.body }}>
                feels {day.feelsMin}–{day.feelsMax}°
              </Typography>
            )}
          </Box>
        </Box>

        {/* Plan your day */}
        <Box>
          <Typography sx={{ ...label, mb: 1 }}>{isToday ? 'Rest of today' : 'Plan your day'}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {plan.map(p => {
              const PIcon = PLAN_ICON[p.key];
              return (
                <Box key={p.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                  <PIcon sx={{ fontSize: '1.15rem', color: D.green, mt: 0.2, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '1rem', color: D.navy, lineHeight: 1.45, fontFamily: D.body }}>
                    {p.text}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* The day's numbers */}
        {facts.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, gap: 1 }}>
            {facts.map(f => <Fact key={f.name} {...f} />)}
          </Box>
        )}

        {/* Hour by hour */}
        {rows.length > 0 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={label}>{typical ? 'Typical hours' : 'Hour by hour'}</Typography>
              {hidden > 0 && (
                <Button size="small" onClick={() => setShowEarlier(true)} sx={{ fontFamily: D.body, fontWeight: 700, color: D.terra, minHeight: 32 }}>
                  Show earlier
                </Button>
              )}
            </Box>
            <Box sx={{ border: `1.5px solid ${D.rule}`, borderRadius: '10px', overflow: 'hidden', backgroundColor: D.paper }}>
              <Box sx={{
                display: 'grid', gridTemplateColumns: HOUR_GRID, columnGap: 1,
                px: { xs: 1.25, sm: 1.75 }, py: 0.75,
              }}>
                {['Time', '', 'Temp', typical ? 'Rain, how often' : 'Rain', 'Wind km/h'].map((h, i) => (
                  <Typography key={i} sx={{ ...label, fontSize: '0.7rem', textAlign: i === 4 ? 'right' : 'left' }}>{h}</Typography>
                ))}
              </Box>
              {visible.map(r => <HourLine key={r.hour} r={r} typical={typical} isNow={r.hour === nowHour} />)}
            </Box>
          </Box>
        )}

        <Button
          variant="outlined"
          endIcon={<ChevronRightIcon />}
          onClick={onOpenItinerary}
          sx={{
            alignSelf: 'flex-start', fontFamily: D.body, fontWeight: 700, minHeight: 44,
            borderRadius: '10px', color: D.navy, borderColor: D.rule,
          }}
        >
          Open this day in the itinerary
        </Button>
      </Box>
    </Box>
  );
}

// ─── Sheet ─────────────────────────────────────────────────────────────────────

export default function WeatherDaySheet({
  days, index, timezone, placeFor, onNavigate, onClose, onOpenItinerary,
}: {
  days:            DayWeather[];
  index:           number | null;
  timezone:        string | null;
  placeFor:        (day: DayWeather) => string;
  onNavigate:      (index: number) => void;
  onClose:         () => void;
  onOpenItinerary: (dayNumber: number) => void;
}) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const day      = index != null ? days[index] : undefined;
  const open     = !!day;

  // ← / → step through days on desktop
  useEffect(() => {
    if (!open || index == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft'  && index > 0)               onNavigate(index - 1);
      if (e.key === 'ArrowRight' && index < days.length - 1) onNavigate(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, days.length, onNavigate]);

  const body = day && index != null && (
    <DayBody
      key={day.date}
      day={day}
      timezone={timezone}
      place={placeFor(day)}
      canPrev={index > 0}
      canNext={index < days.length - 1}
      onPrev={() => onNavigate(index - 1)}
      onNext={() => onNavigate(index + 1)}
      onClose={onClose}
      onOpenItinerary={() => onOpenItinerary(index + 1)}
    />
  );

  return isMobile ? (
    <Drawer
      anchor="bottom" open={open} onClose={onClose}
      PaperProps={{ sx: {
        borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '92vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: D.bg,
      } }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.25, pb: 0.25, flexShrink: 0 }}>
        <Box sx={{ width: 36, height: 4, borderRadius: 2, backgroundColor: alpha('#000', 0.12) }} />
      </Box>
      {body}
    </Drawer>
  ) : (
    <Dialog
      open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: {
        borderRadius: '14px', height: '88vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', backgroundColor: D.bg,
      } }}
    >
      {body}
    </Dialog>
  );
}
