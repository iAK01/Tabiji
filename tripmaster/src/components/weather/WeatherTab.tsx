'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert, IconButton, Tooltip,
} from '@mui/material';
import RefreshIcon      from '@mui/icons-material/Refresh';
import HomeIcon         from '@mui/icons-material/Home';
import FlightLandIcon   from '@mui/icons-material/FlightLand';
import WbSunnyIcon      from '@mui/icons-material/WbSunny';
import FilterDramaIcon  from '@mui/icons-material/FilterDrama';
import CloudIcon        from '@mui/icons-material/Cloud';
import FoggyIcon        from '@mui/icons-material/Foggy';
import UmbrellaIcon     from '@mui/icons-material/Umbrella';
import ThunderstormIcon from '@mui/icons-material/Thunderstorm';
import AcUnitIcon       from '@mui/icons-material/AcUnit';
import WaterDropIcon    from '@mui/icons-material/WaterDrop';
import AirIcon          from '@mui/icons-material/Air';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  freshCurrent, homeCompare, isWetDay, shortDay, summaryLine, todayIn, typicalFrom,
  watchOuts, wearGuide,
  type DayWeather, type HomeCompare, type WatchItem, type WearRow, type WeatherResult,
} from '@/lib/weather-insights';

// ─── Design tokens ─────────────────────────────────────────────────────────────

const D = {
  green:   '#6B7C5C',
  terra:   '#C4714A',
  navy:    '#1D2642',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  cool:    '#0891b2',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

interface Props {
  tripId:          string;
  destinationCity: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

type IconComponent = typeof WbSunnyIcon;

// By WMO code. Text matching only for v1 cached days, which carry no code.
function weatherIcon(code: number | null | undefined, condition: string): { Icon: IconComponent; color: string } {
  let c = code;
  if (c == null) {
    const t = condition.toLowerCase();
    c = t.includes('thunder') ? 95
      : /snow|sleet|blizzard/.test(t) ? 71
      : /rain|drizzle|shower/.test(t) ? 61
      : /fog|mist/.test(t) ? 45
      : t.includes('overcast') ? 3
      : /cloud|partly/.test(t) ? 2
      : 0;
  }
  if (c >= 95)                                         return { Icon: ThunderstormIcon, color: '#5c35a0' };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86)    return { Icon: AcUnitIcon,       color: '#0369a1' };
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82))    return { Icon: UmbrellaIcon,     color: D.cool };
  if (c === 45 || c === 48)                            return { Icon: FoggyIcon,        color: '#6b7280' };
  if (c === 3)                                         return { Icon: CloudIcon,        color: '#6b7280' };
  if (c === 2)                                         return { Icon: FilterDramaIcon,  color: '#8b7d6b' };
  return { Icon: WbSunnyIcon, color: D.terra };
}

// Colour of a daytime high, so hot vs cold reads before the number does.
function warmth(t: number): string {
  if (t >= 30) return '#A8432A';
  if (t >= 22) return D.terra;
  if (t >= 14) return D.navy;
  if (t >= 6)  return D.cool;
  return '#0369a1';
}

function ageLabel(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins <= 1)  return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 48 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

const longDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', timeZone: 'UTC' });

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{
      fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: D.muted, fontFamily: D.body,
      display: 'block', mb: 1.25,
    }}>
      {children}
    </Typography>
  );
}

// ─── Day card ──────────────────────────────────────────────────────────────────

function DayCard({ day, isToday, showCity }: { day: DayWeather; isToday: boolean; showCity: boolean }) {
  const { Icon, color } = weatherIcon(day.code, day.condition);
  const typical = day.source === 'historical';
  const wet     = isWetDay(day);
  const rain = typical
    ? `${day.chanceOfRain ?? 0}%`
    : day.precipMm >= 0.1
      ? `${day.precipMm} mm${day.chanceOfRain != null ? ` · ${day.chanceOfRain}%` : ''}`
      : 'Dry';

  return (
    <Paper elevation={0} sx={{
      p: 1.5,
      border: `1.5px solid ${isToday ? D.terra : D.rule}`,
      borderRadius: '10px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 0.4, textAlign: 'center',
      minWidth: { xs: 112, md: 0 }, flex: '0 0 auto',
      backgroundColor: D.paper,
    }}>
      <Typography sx={{
        fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: D.terra, lineHeight: 1.1, fontFamily: D.body,
      }}>
        {isToday ? 'Today' : day.label}
      </Typography>
      {showCity && (
        <Typography noWrap sx={{ fontSize: '0.75rem', color: D.muted, maxWidth: '100%', fontFamily: D.body }}>
          {day.city}
        </Typography>
      )}

      <Tooltip title={day.condition}>
        <Icon sx={{ fontSize: '1.6rem', color, my: 0.25 }} />
      </Tooltip>

      {/* The high leads — it's the temperature you'll actually be out in */}
      <Typography sx={{ fontFamily: D.display, fontSize: '1.65rem', lineHeight: 1, color: warmth(day.tempMax) }}>
        {day.tempMax}°
      </Typography>
      <Typography sx={{ fontSize: '0.85rem', color: D.muted, lineHeight: 1.2, fontFamily: D.body }}>
        low {day.tempMin}°
      </Typography>
      {day.feelsMax != null && (
        <Typography sx={{ fontSize: '0.85rem', color: D.navy, fontWeight: 600, lineHeight: 1.2, fontFamily: D.body }}>
          feels {day.feelsMax}°
        </Typography>
      )}

      <Tooltip title={typical ? 'Chance of a wet day' : 'Expected rain · chance'}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.5 }}>
          <WaterDropIcon sx={{ fontSize: '0.9rem', color: wet ? D.cool : D.muted }} />
          <Typography sx={{
            fontSize: '0.85rem', fontFamily: D.body,
            color: wet ? D.cool : D.muted, fontWeight: wet ? 800 : 400,
          }}>
            {rain}
          </Typography>
        </Box>
      </Tooltip>

      {day.windKph != null && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <AirIcon sx={{ fontSize: '0.9rem', color: D.muted }} />
          <Typography sx={{ fontSize: '0.85rem', color: D.muted, fontFamily: D.body }}>
            {day.windKph} km/h
          </Typography>
        </Box>
      )}

      {typical && (
        <Typography sx={{
          fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: D.terra, opacity: 0.75, fontFamily: D.body,
        }}>
          typical
        </Typography>
      )}
    </Paper>
  );
}

// Scroll on phones and tablets; one row of equal columns on desktop (rows of 7
// for long trips) so a 9-day trip never leaves an orphan card.
function DayStrip({ days, today }: { days: DayWeather[]; today: string }) {
  const showCity = new Set(days.map(d => d.city)).size > 1;
  const cols  = days.length <= 10 ? days.length : 7;
  const cards = days.map(d => <DayCard key={d.date} day={d} isToday={d.date === today} showCity={showCity} />);
  return (
    <>
      <Box sx={{
        display: { xs: 'flex', md: 'none' },
        gap: 1, overflowX: 'auto', pb: 1,
        '&::-webkit-scrollbar': { height: 3 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: D.rule, borderRadius: 2 },
      }}>
        {cards}
      </Box>
      <Box sx={{
        display: { xs: 'none', md: 'grid' },
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: 1.25,
      }}>
        {cards}
      </Box>
    </>
  );
}

// ─── What to wear ──────────────────────────────────────────────────────────────

function WearGuide({ rows }: { rows: WearRow[] }) {
  return (
    <Paper elevation={0} sx={{ border: `1.5px solid ${D.rule}`, borderRadius: '10px', overflow: 'hidden' }}>
      {rows.map((r, i) => (
        <Box key={r.key} sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '96px 1fr', sm: '128px 150px 1fr' },
          columnGap: 2, alignItems: 'baseline',
          px: { xs: 1.75, sm: 2.25 }, py: 1.4,
          borderTop: i ? `1px solid ${D.rule}` : 'none',
        }}>
          <Typography sx={{
            fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: D.muted, fontFamily: D.body,
          }}>
            {r.label}
          </Typography>
          <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontFamily: D.display, fontSize: '1rem', color: D.navy }}>
            {r.value}
          </Typography>
          <Box>
            <Typography sx={{ display: { xs: 'block', sm: 'none' }, fontFamily: D.display, fontSize: '0.95rem', color: D.navy, mb: 0.25 }}>
              {r.value}
            </Typography>
            <Typography sx={{ fontSize: '1rem', color: D.navy, lineHeight: 1.45, fontFamily: D.body }}>
              {r.text}
            </Typography>
          </Box>
        </Box>
      ))}
    </Paper>
  );
}

// ─── Watch out ─────────────────────────────────────────────────────────────────

function WatchOut({ items, onOpenDay }: { items: WatchItem[]; onOpenDay: (n: number) => void }) {
  return (
    <Paper elevation={0} sx={{ border: `1.5px solid ${D.terra}40`, borderRadius: '10px', overflow: 'hidden' }}>
      {items.map((w, i) => (
        <Box
          key={w.date}
          role="button"
          onClick={() => onOpenDay(w.dayNumber)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: { xs: 1.75, sm: 2.25 }, py: 1.25, cursor: 'pointer',
            borderTop: i ? `1px solid ${D.rule}` : 'none',
            '&:hover': { backgroundColor: `${D.terra}0D` },
          }}
        >
          <WarningAmberIcon sx={{ fontSize: '1.1rem', color: D.terra, flexShrink: 0 }} />
          <Typography sx={{ fontWeight: 800, color: D.navy, fontFamily: D.body, minWidth: 64 }}>
            {shortDay(w.date)}
          </Typography>
          <Typography sx={{ flex: 1, color: D.navy, fontFamily: D.body }}>{w.text}</Typography>
          <ChevronRightIcon sx={{ color: D.muted, fontSize: '1.2rem' }} />
        </Box>
      ))}
    </Paper>
  );
}

// ─── Compared to home ──────────────────────────────────────────────────────────

const COMPARE_GRID = { xs: '78px 1fr 1fr', sm: '128px 1fr 1fr' };

function CompareHeader({ Icon, text, sub }: { Icon: IconComponent; text: string; sub?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0 }}>
      <Icon sx={{ fontSize: '1rem', color: D.muted, flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{
          fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: D.navy, fontFamily: D.body,
        }}>
          {text}
        </Typography>
        {sub && <Typography sx={{ fontSize: '0.75rem', color: D.muted, fontFamily: D.body }}>{sub}</Typography>}
      </Box>
    </Box>
  );
}

function HomeCompareView({ c }: { c: HomeCompare }) {
  const toneColor = (t: HomeCompare['rows'][number]['tone']) =>
    t === 'warm' ? D.terra : t === 'cool' ? D.cool : D.navy;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography sx={{ fontSize: '1.1rem', color: D.navy, lineHeight: 1.5, fontFamily: D.body, fontWeight: 600 }}>
        {c.verdict}
      </Typography>

      <Paper elevation={0} sx={{ border: `1.5px solid ${D.rule}`, borderRadius: '10px', overflow: 'hidden' }}>
        <Box sx={{
          display: 'grid', gridTemplateColumns: COMPARE_GRID, columnGap: 1.5, alignItems: 'center',
          px: { xs: 1.75, sm: 2.25 }, py: 1.1, backgroundColor: `${D.navy}08`,
        }}>
          <span />
          <CompareHeader Icon={HomeIcon} text={c.homeCity} sub="same dates" />
          <CompareHeader Icon={FlightLandIcon} text={c.destCity} />
        </Box>
        {c.rows.map(r => (
          <Box key={r.key} sx={{
            display: 'grid', gridTemplateColumns: COMPARE_GRID, columnGap: 1.5, alignItems: 'baseline',
            px: { xs: 1.75, sm: 2.25 }, py: 1.2, borderTop: `1px solid ${D.rule}`,
          }}>
            <Typography sx={{
              fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: D.muted, fontFamily: D.body,
            }}>
              {r.label}
            </Typography>
            <Box>
              <Typography sx={{ fontSize: '1rem', color: D.navy, fontFamily: D.body }}>{r.home}</Typography>
              {r.homeSub && <Typography sx={{ fontSize: '0.85rem', color: D.muted, fontFamily: D.body }}>{r.homeSub}</Typography>}
            </Box>
            <Box>
              <Typography sx={{ fontSize: '1rem', color: toneColor(r.tone), fontWeight: 800, fontFamily: D.body }}>{r.dest}</Typography>
              {r.destSub && <Typography sx={{ fontSize: '0.85rem', color: D.muted, fontFamily: D.body }}>{r.destSub}</Typography>}
            </Box>
          </Box>
        ))}
      </Paper>

      {c.analog && (
        <Typography sx={{ fontSize: '1rem', color: D.muted, lineHeight: 1.5, fontFamily: D.body }}>
          {c.analog}
        </Typography>
      )}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MAIN ──────────────────────────────────────────────────────────────────────
// One view. The day strip leads; what to wear, watch-outs and the home comparison
// follow. Typical (historical) days are marked per card, so there's no separate
// planning/forecast mode to pick.
// ═══════════════════════════════════════════════════════════════════════════════

export default function WeatherTab({ tripId, destinationCity }: Props) {
  const [weather,    setWeather]    = useState<WeatherResult | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const loadWeather = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else              setLoading(true);
    setError(null);

    try {
      const res  = await fetch(`/api/trips/${tripId}/weather`, forceRefresh ? { method: 'POST' } : {});
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setWeather(data.weather);
    } catch {
      setError('Failed to load weather');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadWeather(); }, [tripId]);

  // Watch-out rows open that day in the Itinerary — same native pushState the
  // trip page uses for tabs, so it works offline and Back returns here.
  const openItineraryDay = (dayNumber: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', 'itinerary');
    params.set('day', String(dayNumber));
    window.history.pushState(null, '', `?${params.toString()}`);
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  );

  if (error) return (
    <Alert severity="warning" sx={{ mt: 2, borderRadius: '10px' }}>
      {error === 'No destination city on trip'
        ? 'Add a destination city to your trip to see weather.'
        : `Could not load weather for ${destinationCity}: ${error}`}
    </Alert>
  );

  const days = weather?.days ?? [];
  if (!weather || !days.length) return null;

  const today    = todayIn(weather.timezone);
  const onTrip   = today >= days[0].date && today <= days[days.length - 1].date;
  const now      = onTrip ? freshCurrent(weather) : null;
  const typical  = typicalFrom(days);
  const summary  = summaryLine(days);
  const wear     = wearGuide(weather);
  const watch    = watchOuts(days);
  const compare  = homeCompare(weather);
  const places   = (weather.places ?? []).map(p => p.label).join(' → ');
  const years    = weather.historicalYears;
  const allTypical = days.every(d => d.source === 'historical');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{
            fontFamily: D.display, fontSize: { xs: '1.8rem', sm: '2rem' },
            color: D.navy, lineHeight: 1,
          }}>
            Weather
          </Typography>
          <Typography noWrap sx={{ fontSize: '0.85rem', color: D.muted, fontFamily: D.body, mt: 0.35 }}>
            Updated {ageLabel(weather.fetchedAt)}{places ? ` · ${places}` : ''}
          </Typography>
          {now && (
            <Typography sx={{ fontSize: '1rem', color: D.navy, fontFamily: D.body, fontWeight: 700, mt: 0.75 }}>
              Now {now.temp}° · feels {now.feels}° · {now.condition}
            </Typography>
          )}
        </Box>
        <Tooltip title="Refresh weather data">
          <span>
            <IconButton onClick={() => loadWeather(true)} disabled={refreshing} size="small">
              <RefreshIcon sx={{
                fontSize: '1.1rem', color: D.muted,
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%':   { transform: 'rotate(0deg)'   },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Day by day — main content */}
      <Box>
        <SectionLabel>{allTypical ? 'Typical days' : 'Day by day'}</SectionLabel>
        <DayStrip days={days} today={onTrip ? today : ''} />
        {typical && (
          <Typography sx={{ fontSize: '0.85rem', color: D.muted, fontFamily: D.body, mt: 1 }}>
            {allTypical ? 'Typical conditions' : `From ${shortDay(typical.date)}: typical conditions`}
            {years ? ` from ${years} years of records` : ''}
            {` · forecast from ${longDate(typical.forecastFrom)}`}
          </Typography>
        )}
        {summary && (
          <Typography sx={{ fontSize: '1.1rem', color: D.navy, lineHeight: 1.5, fontFamily: D.body, mt: 1.5 }}>
            {summary}
          </Typography>
        )}
      </Box>

      {wear.length > 0 && (
        <Box>
          <SectionLabel>What to wear</SectionLabel>
          <WearGuide rows={wear} />
        </Box>
      )}

      {watch.length > 0 && (
        <Box>
          <SectionLabel>Watch out</SectionLabel>
          <WatchOut items={watch} onOpenDay={openItineraryDay} />
        </Box>
      )}

      {compare ? (
        <Box>
          <SectionLabel>Compared to home</SectionLabel>
          <HomeCompareView c={compare} />
        </Box>
      ) : weather.homeUnset && (
        <Alert severity="info" icon={<HomeIcon fontSize="small" />} sx={{ py: 0.75, borderRadius: '10px' }}>
          <Typography sx={{ fontSize: '0.92rem', fontFamily: D.body }}>
            Set your home location in your profile to compare with home.
          </Typography>
        </Alert>
      )}

      <Typography sx={{ fontSize: '0.75rem', color: D.muted, fontFamily: D.body }}>
        Forecast and records: Open-Meteo
      </Typography>
    </Box>
  );
}
