'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box, Typography, Paper, CircularProgress, Alert, IconButton, Tooltip,
} from '@mui/material';
import RefreshIcon      from '@mui/icons-material/Refresh';
import HomeIcon         from '@mui/icons-material/Home';
import FlightLandIcon   from '@mui/icons-material/FlightLand';
import WaterDropIcon    from '@mui/icons-material/WaterDrop';
import AirIcon          from '@mui/icons-material/Air';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  currentHourIn, homeCompare, isWetDay, nowAndNext, shortDay, summaryLine, todayIn, typicalFrom,
  watchOuts, wearGuide,
  type DayWeather, type HomeCompare, type WatchItem, type WearRow, type WeatherResult,
} from '@/lib/weather-insights';
import { D, weatherIcon, warmth, type IconComponent } from './weatherUi';
import WeatherDaySheet from './WeatherDaySheet';
import WeatherNow from './WeatherNow';
import TripWeatherChart from './TripWeatherChart';

interface Props {
  tripId:          string;
  destinationCity: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

// Every card is built from fixed one-line rows — weekday, date, rain amount,
// rain chance — so a wider weekday ("Wed") or a longer rain reading never wraps
// and pushes the rest of that card out of line with its neighbours.
const cardDate = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-IE', { ...opts, timeZone: 'UTC' });

function DayCard({ day, isToday, showCity, typicalSlot, onOpen }: {
  day: DayWeather; isToday: boolean; showCity: boolean; typicalSlot: boolean; onOpen: () => void;
}) {
  const { Icon, color } = weatherIcon(day.code, day.condition);
  const typical = day.source === 'historical';
  const wet     = isWetDay(day);
  // Daytime rain: the models' median amount, and the chance of 1 mm or more.
  const dry = typical ? (day.chanceOfRain ?? 0) < 10 : day.precipMm < 0.1 && (day.chanceOfRain ?? 0) < 35;
  const rainAmount = dry ? 'Dry' : `${typical ? '~' : ''}${day.precipMm} mm`;
  const rainChance = dry || day.chanceOfRain == null ? null : `${day.chanceOfRain}% chance`;

  return (
    <Paper
      elevation={0}
      role="button"
      tabIndex={0}
      aria-label={`${day.label} — hour by hour`}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      sx={{
        p: 1.5,
        border: `1.5px solid ${isToday ? D.terra : D.rule}`,
        borderRadius: '10px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 0.4, textAlign: 'center',
        minWidth: { xs: 112, md: 0 }, flex: '0 0 auto',
        backgroundColor: D.paper, cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': { borderColor: D.terra, boxShadow: '0 2px 10px rgba(29,38,66,0.08)' },
        '&:focus-visible': { outline: `2px solid ${D.terra}`, outlineOffset: 2 },
      }}
    >
      <Box sx={{ maxWidth: '100%' }}>
        <Typography noWrap sx={{
          fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: D.terra, lineHeight: 1.25, fontFamily: D.body,
        }}>
          {isToday ? 'Today' : cardDate(day.date, { weekday: 'short' })}
        </Typography>
        <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 600, color: D.muted, lineHeight: 1.25, fontFamily: D.body }}>
          {cardDate(day.date, { day: 'numeric', month: 'short' })}
        </Typography>
      </Box>
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

      <Tooltip title={typical ? 'Typical rain 08:00–22:00 · chance of a wet day' : 'Rain 08:00–22:00 · chance of 1 mm or more'}>
        <Box sx={{ mt: 0.5, maxWidth: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4 }}>
            <WaterDropIcon sx={{ fontSize: '0.9rem', color: wet ? D.cool : D.muted, flexShrink: 0 }} />
            <Typography noWrap sx={{
              fontSize: '0.85rem', fontFamily: D.body, lineHeight: 1.3,
              color: wet ? D.cool : D.muted, fontWeight: wet ? 800 : 400,
            }}>
              {rainAmount}
            </Typography>
          </Box>
          {/* Second line always takes its space, so dry days stay level with wet ones */}
          <Typography noWrap sx={{
            fontSize: '0.78rem', fontFamily: D.body, lineHeight: 1.3,
            color: wet ? D.cool : D.muted, fontWeight: wet ? 700 : 400,
            visibility: rainChance ? 'visible' : 'hidden',
          }}>
            {rainChance ?? '–'}
          </Typography>
        </Box>
      </Tooltip>

      {day.windKph != null && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <AirIcon sx={{ fontSize: '0.9rem', color: D.muted, flexShrink: 0 }} />
          <Typography noWrap sx={{ fontSize: '0.85rem', color: D.muted, fontFamily: D.body }}>
            {day.windKph} km/h
          </Typography>
        </Box>
      )}

      {typicalSlot && (
        <Typography sx={{
          fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: D.terra, opacity: 0.75, fontFamily: D.body,
          visibility: typical ? 'visible' : 'hidden',
        }}>
          typical
        </Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', mt: 'auto', pt: 0.5, color: D.terra }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: D.body }}>
          Hourly
        </Typography>
        <ChevronRightIcon sx={{ fontSize: '1rem' }} />
      </Box>
    </Paper>
  );
}

// Scroll on phones and tablets; one row of equal columns on desktop (rows of 7
// for long trips) so a 9-day trip never leaves an orphan card.
function DayStrip({ days, today, onOpen }: { days: DayWeather[]; today: string; onOpen: (index: number) => void }) {
  const showCity    = new Set(days.map(d => d.city)).size > 1;
  const typicalSlot = days.some(d => d.source === 'historical');
  const cols  = days.length <= 10 ? days.length : 7;
  const cards = days.map((d, i) => (
    <DayCard
      key={d.date} day={d} isToday={d.date === today}
      showCity={showCity} typicalSlot={typicalSlot} onOpen={() => onOpen(i)}
    />
  ));
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
  const searchParams = useSearchParams();
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

  // The open day sheet lives in ?day= (1-based, the itinerary's numbering) so a
  // refresh or shared link lands on it. replaceState, like the itinerary's stop
  // sheet — Back steps through tabs, not sheets.
  const setDayParam = useCallback((dayNumber: number | null) => {
    const params = new URLSearchParams(window.location.search);
    if (dayNumber == null) params.delete('day');
    else params.set('day', String(dayNumber));
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, []);
  const openDay  = useCallback((index: number) => setDayParam(index + 1), [setDayParam]);
  const closeDay = useCallback(() => setDayParam(null), [setDayParam]);

  // "Open in itinerary" from the sheet — same native pushState the trip page
  // uses for tabs, so it works offline and Back returns here.
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
  const now      = onTrip ? nowAndNext(weather) : null;
  const nowHour  = onTrip ? currentHourIn(weather.timezone, today) : null;
  const nowKey   = nowHour != null ? `${today}-${nowHour}` : null;
  const typical  = typicalFrom(days);
  const summary  = summaryLine(days);
  const wear     = wearGuide(weather);
  const watch    = watchOuts(days);
  const compare  = homeCompare(weather);
  const places   = (weather.places ?? []).map(p => p.label).join(' → ');
  const years    = weather.historicalYears;
  const allTypical = days.every(d => d.source === 'historical');
  const dayParam   = Number(searchParams.get('day'));
  const sheetIndex = Number.isInteger(dayParam) && dayParam >= 1 && dayParam <= days.length ? dayParam - 1 : null;
  const placeFor   = (d: DayWeather) =>
    (weather.places ?? []).find(p => p.city === d.city)?.label ?? d.city;

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

      {/* On the trip: right now and the next few hours */}
      {now && <WeatherNow now={now} place={placeFor(days.find(d => d.date === today) ?? days[0])} />}

      {/* The whole trip as one timeline — tap through to any day */}
      <Box>
        <SectionLabel>Across the trip</SectionLabel>
        <TripWeatherChart days={days} nowKey={nowKey} onOpenDay={openDay} />
      </Box>

      {/* Day by day */}
      <Box>
        <SectionLabel>{allTypical ? 'Typical days' : 'Day by day'}</SectionLabel>
        <DayStrip days={days} today={onTrip ? today : ''} onOpen={openDay} />
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
          <WatchOut items={watch} onOpenDay={n => openDay(n - 1)} />
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
        Rain from up to 8 forecast models · records from ERA5 · via Open-Meteo
      </Typography>

      <WeatherDaySheet
        days={days}
        index={sheetIndex}
        timezone={weather.timezone}
        placeFor={placeFor}
        onNavigate={openDay}
        onClose={closeDay}
        onOpenItinerary={openItineraryDay}
      />
    </Box>
  );
}
