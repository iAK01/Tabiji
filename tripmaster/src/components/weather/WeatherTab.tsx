'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert,
  Chip, Divider, IconButton, Tooltip, LinearProgress,
  Collapse, Button,
} from '@mui/material';
import RefreshIcon          from '@mui/icons-material/Refresh';
import InfoOutlinedIcon     from '@mui/icons-material/InfoOutlined';
import ThermostatIcon       from '@mui/icons-material/Thermostat';
import WaterDropIcon        from '@mui/icons-material/WaterDrop';
import AirIcon              from '@mui/icons-material/Air';
import UmbrellaIcon         from '@mui/icons-material/Umbrella';
import WbSunnyIcon          from '@mui/icons-material/WbSunny';
import CloudIcon            from '@mui/icons-material/Cloud';
import ThunderstormIcon     from '@mui/icons-material/Thunderstorm';
import AcUnitIcon           from '@mui/icons-material/AcUnit';
import GrainIcon            from '@mui/icons-material/Grain';
import LuggageIcon          from '@mui/icons-material/Luggage';
import HomeIcon             from '@mui/icons-material/Home';
import FlightLandIcon       from '@mui/icons-material/FlightLand';
import ExpandMoreIcon       from '@mui/icons-material/ExpandMore';
import ExpandLessIcon       from '@mui/icons-material/ExpandLess';
import CheckCircleIcon      from '@mui/icons-material/CheckCircle';
import WarningAmberIcon     from '@mui/icons-material/WarningAmber';
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import BeachAccessIcon      from '@mui/icons-material/BeachAccess';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayWeather {
  date:         string;
  label:        string;
  condition:    string;
  icon:         string;
  tempAvg:      number;
  tempMax:      number;
  tempMin:      number;
  chanceOfRain: number;
  precipMm:     number;
  windKph:      number | null;
  humidity:     number | null;
  uvIndex:      number | null;
  source:       'forecast' | 'historical' | 'weatherapi' | 'climate';
}

interface HomeComparison {
  homeCity:      string;
  destCity:      string;
  homeTempAvg:   number;
  destTempAvg:   number;
  tempDelta:     number;
  tempDeltaLabel: string;
  homeRainDays:  number;
  destRainDays:  number;
  rainDelta:     number;
  homeWindAvg:   number | null;
  destWindAvg:   number | null;
  summary:       string;
  insights:      { icon: string; text: string }[];
  homeDays:      DayWeather[];
}

interface WeatherResult {
  mode:                'forecast' | 'historical' | 'current';
  days:                DayWeather[];
  fetchedAt:           string;
  forecastAvailableFrom?: string;
  historicalYears?:    number[];
  currentWeather?:     DayWeather[];
  summary?:            string;
  packingNotes?:       string[];
  homeComparison?:     HomeComparison;
  climateNormals?: {
    destAvgTemp:    number;
    destAvgRainDays: number;
    homeAvgTemp?:   number;
    homeAvgRainDays?: number;
    source:         string;
    note:           string;
  };
}

interface Props {
  tripId:          string;
  destinationCity: string;
}

// ─── Weather condition → MUI icon ─────────────────────────────────────────────

function WeatherIcon({ condition, sx }: { condition: string; sx?: object }) {
  const c = condition.toLowerCase();
  if (c.includes('thunder') || c.includes('storm'))
    return <ThunderstormIcon sx={sx} />;
  if (c.includes('snow') || c.includes('blizzard') || c.includes('ice') || c.includes('sleet') || c.includes('freez'))
    return <AcUnitIcon sx={sx} />;
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower') || c.includes('precip'))
    return <UmbrellaIcon sx={sx} />;
  if (c.includes('overcast') || c.includes('cloud') || c.includes('fog') || c.includes('mist') || c.includes('haze'))
    return <CloudIcon sx={sx} />;
  if (c.includes('clear') || c.includes('sunny') || c.includes('fair'))
    return <WbSunnyIcon sx={sx} />;
  // patchy rain, partly cloudy etc
  if (c.includes('patchy') || c.includes('partly'))
    return <GrainIcon sx={sx} />;
  return <WbSunnyIcon sx={sx} />;
}

function weatherIconColor(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('thunder') || c.includes('storm')) return '#5c35a0';
  if (c.includes('snow') || c.includes('ice') || c.includes('freez')) return '#0369a1';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return '#0891b2';
  if (c.includes('patchy') || c.includes('partly') || c.includes('overcast') || c.includes('cloud')) return '#6b7280';
  return '#C9521B';
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption" fontWeight={800}
      sx={{
        fontSize: '0.72rem', textTransform: 'uppercase',
        letterSpacing: '0.07em', color: 'text.secondary',
        display: 'block', mb: 1.25,
      }}
    >
      {children}
    </Typography>
  );
}

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayCard({ day }: { day: DayWeather }) {
  const iconColor  = weatherIconColor(day.condition);
  const rainHigh   = day.chanceOfRain > 60;
  const rainMed    = day.chanceOfRain > 30;
  const rainBgColor = rainHigh ? 'rgba(8,145,178,0.08)' : rainMed ? 'rgba(8,145,178,0.04)' : 'transparent';

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2 },
        minWidth: { xs: 110, sm: 130 },
        maxWidth: { xs: 120, sm: 140 },
        textAlign: 'center',
        border: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
        backgroundColor: rainBgColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
      }}
    >
      <Typography
        variant="caption" fontWeight={700}
        sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1 }}
      >
        {day.label}
      </Typography>

      <WeatherIcon
        condition={day.condition}
        sx={{ fontSize: { xs: '2.2rem', sm: '2.5rem' }, color: iconColor, my: 0.5 }}
      />

      <Typography
        variant="caption"
        sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.3, minHeight: 30 }}
      >
        {day.condition}
      </Typography>

      {/* Temp */}
      <Typography fontWeight={800} sx={{ fontSize: { xs: '1.1rem', sm: '1.2rem' }, lineHeight: 1 }}>
        {day.tempAvg}°C
      </Typography>
      <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
        {day.tempMax}° / {day.tempMin}°
      </Typography>

      {/* Rain bar */}
      <Box sx={{ width: '100%', mt: 0.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
          <UmbrellaIcon sx={{ fontSize: '0.7rem', color: 'text.disabled' }} />
          <Typography variant="caption" sx={{ fontSize: '0.68rem', color: rainHigh ? '#0891b2' : 'text.disabled', fontWeight: rainHigh ? 700 : 400 }}>
            {day.chanceOfRain}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={day.chanceOfRain}
          sx={{
            height: 3, borderRadius: 2,
            backgroundColor: 'action.hover',
            '& .MuiLinearProgress-bar': {
              backgroundColor: rainHigh ? '#0891b2' : rainMed ? '#0891b2' : '#90caf9',
              borderRadius: 2,
            },
          }}
        />
      </Box>

      {day.windKph !== null && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mt: 0.25 }}>
          <AirIcon sx={{ fontSize: '0.75rem', color: 'text.disabled' }} />
          <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
            {day.windKph} km/h
          </Typography>
        </Box>
      )}

      <Chip
        label={
          day.source === 'historical' ? 'avg' :
          day.source === 'weatherapi' ? 'live' : 'forecast'
        }
        size="small"
        sx={{
          mt: 0.25, height: 16, fontSize: '0.6rem', fontWeight: 700,
          backgroundColor:
            day.source === 'historical' ? 'rgba(156,39,176,0.1)' :
            day.source === 'weatherapi' ? 'rgba(46,125,50,0.1)'  : 'rgba(25,118,210,0.1)',
          color:
            day.source === 'historical' ? '#7c3aed' :
            day.source === 'weatherapi' ? 'success.dark' : 'primary.main',
        }}
      />
    </Paper>
  );
}

function DayCardRow({ days }: { days: DayWeather[] }) {
  return (
    <Box sx={{
      display: 'flex', gap: 1, overflowX: 'auto', pb: 1,
      '&::-webkit-scrollbar': { height: 3 },
      '&::-webkit-scrollbar-thumb': { backgroundColor: 'divider', borderRadius: 2 },
    }}>
      {days.map(day => <DayCard key={day.date} day={day} />)}
    </Box>
  );
}

// ─── Hero card ────────────────────────────────────────────────────────────────

function HeroCard({
  days, summary, packingNotes, destinationCity, isHistorical,
}: {
  days:            DayWeather[];
  summary?:        string;
  packingNotes?:   string[];
  destinationCity: string;
  isHistorical:    boolean;
}) {
  if (!days.length) return null;

  // Aggregate across all trip days
  const maxTemp   = Math.max(...days.map(d => d.tempMax));
  const minTemp   = Math.min(...days.map(d => d.tempMin));
  const avgRain   = Math.round(days.reduce((a, d) => a + d.chanceOfRain, 0) / days.length);
  const rainyDays = days.filter(d => d.chanceOfRain > 40).length;
  const avgWind   = days[0]?.windKph ?? null;

  // Dominant condition — pick most representative day (median temp)
  const sorted    = [...days].sort((a, b) => a.tempAvg - b.tempAvg);
  const dominant  = sorted[Math.floor(sorted.length / 2)];
  const iconColor = weatherIconColor(dominant.condition);

  const tempLevel: 'cold' | 'mild' | 'warm' | 'hot' =
    maxTemp >= 28 ? 'hot' : maxTemp >= 20 ? 'warm' : maxTemp >= 12 ? 'mild' : 'cold';

  const tempChip = {
    cold: { label: 'Cold',  color: '#0369a1', bg: 'rgba(3,105,161,0.1)'  },
    mild: { label: 'Mild',  color: '#55702C', bg: 'rgba(85,112,44,0.1)'  },
    warm: { label: 'Warm',  color: '#C9521B', bg: 'rgba(201,82,27,0.1)'  },
    hot:  { label: 'Hot',   color: '#b45309', bg: 'rgba(180,83,9,0.1)'   },
  }[tempLevel];

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, sm: 3 },
        border: '1px solid', borderColor: 'divider',
        background: `linear-gradient(135deg, rgba(${iconColor === '#0891b2' ? '8,145,178' : iconColor === '#C9521B' ? '201,82,27' : '85,112,44'},0.06) 0%, transparent 60%)`,
      }}
    >
      {/* Top row: big icon + temperature range */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2.5, mb: 2 }}>
        <Box sx={{
          width: { xs: 64, sm: 72 }, height: { xs: 64, sm: 72 },
          borderRadius: '50%', flexShrink: 0,
          backgroundColor: `${iconColor}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <WeatherIcon condition={dominant.condition} sx={{ fontSize: { xs: '2.2rem', sm: '2.5rem' }, color: iconColor }} />
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography fontWeight={900} sx={{ fontSize: { xs: '2rem', sm: '2.5rem' }, lineHeight: 1, color: iconColor }}>
            {minTemp}–{maxTemp}°C
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, fontSize: { xs: '0.88rem', sm: '0.9rem' } }}>
            {destinationCity} · {days.length} day{days.length !== 1 ? 's' : ''}
            {isHistorical ? ' · historical avg' : ''}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
            <Chip
              icon={<DeviceThermostatIcon sx={{ fontSize: '0.85rem !important' }} />}
              label={tempChip.label}
              size="small"
              sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700, backgroundColor: tempChip.bg, color: tempChip.color }}
            />
            {rainyDays > 0 && (
              <Chip
                icon={<UmbrellaIcon sx={{ fontSize: '0.85rem !important' }} />}
                label={`${rainyDays} rainy day${rainyDays !== 1 ? 's' : ''}`}
                size="small"
                sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700, backgroundColor: 'rgba(8,145,178,0.1)', color: '#0891b2' }}
              />
            )}
            {avgWind !== null && avgWind > 30 && (
              <Chip
                icon={<AirIcon sx={{ fontSize: '0.85rem !important' }} />}
                label={`${avgWind} km/h`}
                size="small"
                sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700, backgroundColor: 'rgba(107,114,128,0.1)', color: 'text.secondary' }}
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* Summary sentence */}
      {summary && (
        <Typography variant="body2" sx={{ fontSize: '0.88rem', color: 'text.secondary', lineHeight: 1.5, mb: rainyDays > 0 ? 1.75 : 0 }}>
          {summary}
        </Typography>
      )}

      {/* Packing notes — promoted into the hero */}
      {packingNotes && packingNotes.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: summary ? 1.25 : 0 }}>
          {packingNotes.map((note, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <LuggageIcon sx={{ fontSize: '0.9rem', color: '#55702C', mt: 0.2, flexShrink: 0 }} />
              <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary', lineHeight: 1.4 }}>
                {note}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Quick stat row */}
      <Box sx={{
        display: 'flex', gap: 0, mt: 2,
        border: '1px solid', borderColor: 'divider', borderRadius: 1.5,
        overflow: 'hidden',
      }}>
        {[
          { Icon: ThermostatIcon, label: 'Avg high', value: `${maxTemp}°C` },
          { Icon: UmbrellaIcon,   label: 'Rain chance', value: `${avgRain}%` },
          ...(avgWind !== null ? [{ Icon: AirIcon, label: 'Wind', value: `${avgWind} km/h` }] : []),
        ].map(({ Icon, label, value }, i, arr) => (
          <Box
            key={label}
            sx={{
              flex: 1, py: 1.25, px: 1,
              textAlign: 'center',
              borderRight: i < arr.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
            }}
          >
            <Icon sx={{ fontSize: '1rem', color: 'text.disabled', mb: 0.25 }} />
            <Typography variant="body2" fontWeight={800} sx={{ fontSize: '0.9rem', lineHeight: 1 }}>
              {value}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

// ─── Home comparison ──────────────────────────────────────────────────────────

function HomeComparisonSection({ c }: { c: HomeComparison }) {
  const tempColor  = c.tempDelta > 2 ? '#C9521B' : c.tempDelta < -2 ? '#0369a1' : 'text.primary';
  const tempPrefix = c.tempDelta > 0 ? '+' : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* Summary sentence first */}
      <Typography variant="body2" sx={{ fontSize: '0.88rem', color: 'text.secondary', lineHeight: 1.5 }}>
        {c.summary}
      </Typography>

      {/* Home vs destination side by side */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr' }}>

          {/* Home */}
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <HomeIcon sx={{ fontSize: '1.1rem', color: 'text.disabled', mb: 0.5 }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', display: 'block' }}>
              {c.homeCity}
            </Typography>
            <Typography fontWeight={800} sx={{ fontSize: '1.5rem', lineHeight: 1.2 }}>
              {c.homeTempAvg}°C
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
              {c.homeRainDays} rainy day{c.homeRainDays !== 1 ? 's' : ''}
            </Typography>
          </Box>

          {/* Delta */}
          <Box sx={{
            px: 1.5, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            borderLeft: '1px solid', borderRight: '1px solid', borderColor: 'divider',
            backgroundColor: 'action.hover',
          }}>
            <FlightLandIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} />
            <Typography fontWeight={800} sx={{ fontSize: '0.85rem', color: tempColor, mt: 0.25 }}>
              {tempPrefix}{c.tempDelta}°
            </Typography>
          </Box>

          {/* Destination */}
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <FlightLandIcon sx={{ fontSize: '1.1rem', color: 'text.disabled', mb: 0.5 }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', display: 'block' }}>
              {c.destCity}
            </Typography>
            <Typography fontWeight={800} sx={{ fontSize: '1.5rem', lineHeight: 1.2, color: tempColor }}>
              {c.destTempAvg}°C
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
              {c.destRainDays} rainy day{c.destRainDays !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Insights — MUI icons mapped from insight type */}
      {c.insights.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {c.insights.map((insight, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <CheckCircleIcon sx={{ fontSize: '0.9rem', color: '#55702C', mt: 0.2, flexShrink: 0 }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
                {insight.text}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Stat pills — stacked on mobile */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
        {[
          { Icon: ThermostatIcon, label: 'Avg temp',  home: `${c.homeTempAvg}°C`, dest: `${c.destTempAvg}°C`, delta: c.tempDelta },
          { Icon: UmbrellaIcon,   label: 'Rain days', home: `${c.homeRainDays}`,  dest: `${c.destRainDays}`,  delta: c.rainDelta },
          ...(c.homeWindAvg !== null && c.destWindAvg !== null
            ? [{ Icon: AirIcon, label: 'Wind km/h', home: `${c.homeWindAvg}`, dest: `${c.destWindAvg}`, delta: c.destWindAvg - c.homeWindAvg }]
            : []),
        ].map(({ Icon, label, home, dest, delta }) => (
          <Paper key={label} elevation={0} sx={{
            flex: 1, p: 1.5, border: '1px solid', borderColor: 'divider',
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}>
            <Icon sx={{ fontSize: '1.1rem', color: 'text.disabled', flexShrink: 0 }} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {label}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 0.25 }}>
                <Typography variant="body2" sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{home}</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>→</Typography>
                <Typography variant="body2" fontWeight={800} sx={{
                  fontSize: '0.88rem',
                  color: delta > 0 ? '#C9521B' : delta < 0 ? '#0369a1' : 'text.primary',
                }}>
                  {dest}
                </Typography>
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Home day cards */}
      {c.homeDays.length > 0 && (
        <Box>
          <SectionHeading>{c.homeCity} at the same time of year</SectionHeading>
          <DayCardRow days={c.homeDays} />
        </Box>
      )}
    </Box>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function WeatherTab({ tripId, destinationCity }: Props) {
  const [weather,    setWeather]    = useState<WeatherResult | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [cachedAge,  setCachedAge]  = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const loadWeather = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else              setLoading(true);
    setError(null);

    try {
      const res  = await fetch(
        `/api/trips/${tripId}/weather`,
        forceRefresh ? { method: 'POST' } : {}
      );
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setWeather(data.weather);

      if (data.weather.fetchedAt) {
        const age  = Date.now() - new Date(data.weather.fetchedAt).getTime();
        const mins = Math.round(age / 60000);
        const hrs  = Math.round(age / 3600000);
        setCachedAge(hrs >= 1 ? `${hrs}h ago` : mins <= 1 ? 'just now' : `${mins}m ago`);
      }
    } catch {
      setError('Failed to load weather');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadWeather();
  }, [tripId]);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  );

  if (error) return (
    <Alert severity="warning" sx={{ mt: 2 }}>
      {error === 'No destination city on trip'
        ? 'Add a destination city to your trip to see weather.'
        : `Could not load weather: ${error}`}
    </Alert>
  );

  if (!weather) return null;

  const isHistorical     = weather.mode === 'historical';
  const forecastFromDate = weather.forecastAvailableFrom
    ? new Date(weather.forecastAvailableFrom).toLocaleDateString('en-IE', { day: 'numeric', month: 'long' })
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ fontSize: { xs: '1.05rem', sm: '1.15rem' } }}>
            Weather
          </Typography>
          {cachedAge && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>
              Updated {cachedAge}
            </Typography>
          )}
        </Box>
        <Tooltip title="Refresh weather data">
          <span>
            <IconButton onClick={() => loadWeather(true)} disabled={refreshing} size="small">
              <RefreshIcon sx={{
                fontSize: '1.1rem',
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
              }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* ── Historical banner ── */}
      {isHistorical && (
        <Alert
          severity="info"
          icon={<InfoOutlinedIcon fontSize="small" />}
          sx={{ backgroundColor: 'rgba(85,112,44,0.06)', border: '1px solid rgba(85,112,44,0.2)', py: 0.75 }}
        >
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem', mb: 0.2 }}>
            Showing historical averages
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
            Trip is more than 16 days away — based on {weather.historicalYears?.length ?? 5} years of recorded data.
            {forecastFromDate && ` Live forecast available from ${forecastFromDate}.`}
          </Typography>
        </Alert>
      )}

      {/* ── HERO — the whole trip at a glance ── */}
      <HeroCard
        days={weather.days}
        summary={weather.summary}
        packingNotes={weather.packingNotes}
        destinationCity={destinationCity}
        isHistorical={isHistorical}
      />

      {/* ── Day-by-day ── */}
      <Box>
        <SectionHeading>
          {isHistorical ? 'Typical daily conditions' : 'Day-by-day forecast'}
        </SectionHeading>
        <DayCardRow days={weather.days} />
      </Box>

      {/* ── Home comparison ── */}
      {weather.homeComparison ? (
        <Box>
          <SectionHeading>Compared to home</SectionHeading>
          <HomeComparisonSection c={weather.homeComparison} />
        </Box>
      ) : (
        <Alert severity="info" icon={<HomeIcon fontSize="small" />} sx={{ py: 0.75 }}>
          <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
            Set your home location in your profile to see a home vs destination comparison.
          </Typography>
        </Alert>
      )}

      {/* ── Detail section — collapsed by default on mobile ── */}
      <Box>
        <Button
          size="small"
          endIcon={showDetail ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setShowDetail(p => !p)}
          sx={{ fontSize: '0.78rem', color: 'text.secondary', fontWeight: 700, px: 0 }}
        >
          {showDetail ? 'Hide' : 'Show'} technical detail
        </Button>

        <Collapse in={showDetail}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 2 }}>

            {/* Right now */}
            {weather.currentWeather && weather.currentWeather.length > 0 && (
              <Box>
                <SectionHeading>Right now in {destinationCity}</SectionHeading>
                <DayCardRow days={weather.currentWeather} />
                <Typography variant="caption" color="text.disabled" sx={{ mt: 0.75, display: 'block', fontSize: '0.7rem' }}>
                  Current conditions regardless of trip dates.
                </Typography>
              </Box>
            )}

            {/* Climate model */}
            {weather.climateNormals && (
              <Box>
                <SectionHeading>Climate model cross-check</SectionHeading>
                <Paper elevation={0} sx={{ p: 1.75, border: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {destinationCity} model avg temp
                      </Typography>
                      <Typography variant="body2" fontWeight={800}>{weather.climateNormals.destAvgTemp}°C</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {destinationCity} model rain days
                      </Typography>
                      <Typography variant="body2" fontWeight={800}>
                        {weather.climateNormals.destAvgRainDays} of {weather.days.length}
                      </Typography>
                    </Box>
                    {weather.climateNormals.homeAvgTemp !== undefined && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          {weather.homeComparison?.homeCity} model avg temp
                        </Typography>
                        <Typography variant="body2" fontWeight={800}>{weather.climateNormals.homeAvgTemp}°C</Typography>
                      </Box>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block', fontSize: '0.65rem' }}>
                    {weather.climateNormals.note}
                  </Typography>
                </Paper>
              </Box>
            )}

            {/* Source legend */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {[
                { label: 'live', bg: 'rgba(46,125,50,0.1)',   color: 'success.dark', desc: 'WeatherAPI.com (3 days)' },
                { label: 'fcst', bg: 'rgba(25,118,210,0.1)', color: 'primary.main', desc: 'Open-Meteo (16 days)' },
                { label: 'avg',  bg: 'rgba(156,39,176,0.1)', color: '#7c3aed',       desc: '5-year ERA5 historical' },
              ].map(({ label, bg, color, desc }) => (
                <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Chip label={label} size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, backgroundColor: bg, color }} />
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>{desc}</Typography>
                </Box>
              ))}
            </Box>

          </Box>
        </Collapse>
      </Box>

    </Box>
  );
}