'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert,
  Chip, Divider, IconButton, Tooltip, LinearProgress,
} from '@mui/material';
import RefreshIcon      from '@mui/icons-material/Refresh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WbSunnyIcon      from '@mui/icons-material/WbSunny';
import LuggageIcon      from '@mui/icons-material/Luggage';
import HomeIcon         from '@mui/icons-material/Home';
import FlightLandIcon   from '@mui/icons-material/FlightLand';
import ThermostatIcon   from '@mui/icons-material/Thermostat';
import WaterDropIcon    from '@mui/icons-material/WaterDrop';
import AirIcon          from '@mui/icons-material/Air';

interface DayWeather {
  date: string;
  label: string;
  condition: string;
  icon: string;
  tempAvg: number;
  tempMax: number;
  tempMin: number;
  chanceOfRain: number;
  precipMm: number;
  windKph: number | null;
  humidity: number | null;
  uvIndex: number | null;
  source: 'forecast' | 'historical' | 'weatherapi' | 'climate';
}

interface HomeComparison {
  homeCity: string;
  destCity: string;
  homeTempAvg: number;
  destTempAvg: number;
  tempDelta: number;
  tempDeltaLabel: string;
  homeRainDays: number;
  destRainDays: number;
  rainDelta: number;
  homeWindAvg: number | null;
  destWindAvg: number | null;
  summary: string;
  insights: { icon: string; text: string }[];
  homeDays: DayWeather[];
}

interface WeatherResult {
  mode: 'forecast' | 'historical' | 'current';
  days: DayWeather[];
  fetchedAt: string;
  forecastAvailableFrom?: string;
  historicalYears?: number[];
  currentWeather?: DayWeather[];
  summary?: string;
  packingNotes?: string[];
  homeComparison?: HomeComparison;
  climateNormals?: {
    destAvgTemp: number;
    destAvgRainDays: number;
    homeAvgTemp?: number;
    homeAvgRainDays?: number;
    source: string;
    note: string;
  };
}

interface Props {
  tripId: string;
  destinationCity: string;
}

// ─── Day card ────────────────────────────────────────────────────────────────
function DayCard({ day, compact = false }: { day: DayWeather; compact?: boolean }) {
  const rainColor =
    day.chanceOfRain > 60 ? '#1565c0' :
    day.chanceOfRain > 30 ? '#1976d2' : '#90caf9';

  return (
    <Paper
      elevation={0}
      sx={{
        p: compact ? 1.25 : 1.75,
        minWidth: compact ? 88 : 118,
        maxWidth: compact ? 96 : 128,
        textAlign: 'center',
        border: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block" fontWeight={600}
        sx={{ fontSize: '0.65rem', lineHeight: 1.2, mb: 0.25 }}>
        {day.label}
      </Typography>

      <Typography sx={{ fontSize: compact ? '1.4rem' : '1.8rem', lineHeight: 1.1, my: 0.5 }}>
        {day.icon}
      </Typography>

      <Typography variant="caption" display="block" color="text.secondary"
        sx={{ fontSize: '0.6rem', minHeight: compact ? 'auto' : 28, lineHeight: 1.2, mb: 0.5 }}>
        {day.condition}
      </Typography>

      <Typography variant="body2" fontWeight={700} sx={{ fontSize: compact ? '0.8rem' : '0.9rem' }}>
        {day.tempAvg}°C
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.6rem' }}>
        ↑{day.tempMax}° ↓{day.tempMin}°
      </Typography>

      {!compact && (
        <Box sx={{ mt: 0.75 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>☔</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>{day.chanceOfRain}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={day.chanceOfRain}
            sx={{
              height: 3, borderRadius: 2,
              backgroundColor: '#e3f2fd',
              '& .MuiLinearProgress-bar': { backgroundColor: rainColor, borderRadius: 2 },
            }}
          />
        </Box>
      )}

      {!compact && day.windKph !== null && (
        <Typography variant="caption" color="text.secondary" display="block"
          sx={{ mt: 0.5, fontSize: '0.6rem' }}>
          💨 {day.windKph} km/h
        </Typography>
      )}

      <Chip
        label={
          day.source === 'historical' ? 'avg' :
          day.source === 'weatherapi' ? 'live' : 'fcst'
        }
        size="small"
        sx={{
          mt: 0.75, height: 14, fontSize: '0.55rem',
          backgroundColor:
            day.source === 'historical' ? 'rgba(156,39,176,0.1)' :
            day.source === 'weatherapi' ? 'rgba(46,125,50,0.1)'  : 'rgba(25,118,210,0.1)',
          color:
            day.source === 'historical' ? 'purple' :
            day.source === 'weatherapi' ? 'success.dark' : 'primary.main',
        }}
      />
    </Paper>
  );
}

// ─── Horizontal scroll row ────────────────────────────────────────────────────
function DayCardRow({ days, compact = false }: { days: DayWeather[]; compact?: boolean }) {
  return (
    <Box
      sx={{
        display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5,
        '&::-webkit-scrollbar': { height: 3 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: 'divider', borderRadius: 2 },
      }}
    >
      {days.map(day => <DayCard key={day.date} day={day} compact={compact} />)}
    </Box>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({
  icon, label, home, dest, delta, unit = '',
}: {
  icon: React.ReactNode;
  label: string;
  home: string | number;
  dest: string | number;
  delta?: number;
  unit?: string;
}) {
  const deltaColor =
    delta === undefined ? 'text.secondary' :
    delta > 0  ? '#c9521b' :
    delta < 0  ? '#1976d2' :
    'text.secondary';

  return (
    <Paper elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', flex: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600}
          sx={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>Home</Typography>
          <Typography variant="body2" fontWeight={600}>{home}{unit}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>There</Typography>
          <Typography variant="body2" fontWeight={700} sx={{ color: deltaColor }}>{dest}{unit}</Typography>
        </Box>
      </Box>
    </Paper>
  );
}

// ─── Home comparison card ─────────────────────────────────────────────────────
function HomeComparisonCard({ c }: { c: HomeComparison }) {
  const tempColor = c.tempDelta > 2 ? '#c9521b' : c.tempDelta < -2 ? '#1976d2' : 'text.primary';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* Summary */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          background: 'linear-gradient(135deg, rgba(85,112,44,0.06) 0%, rgba(201,82,27,0.06) 100%)',
          border: '1px solid', borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <HomeIcon sx={{ fontSize: '1.2rem', color: 'text.secondary', mb: 0.25 }} />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem' }}>
              {c.homeCity}
            </Typography>
            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1 }}>
              {c.homeTempAvg}°C
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
              {c.homeRainDays} rainy day{c.homeRainDays !== 1 ? 's' : ''}
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center', pt: 1 }}>
            <Typography variant="body2" sx={{ color: tempColor, fontWeight: 700, fontSize: '0.75rem' }}>
              {c.tempDelta > 0 ? '+' : ''}{c.tempDelta}°C
            </Typography>
            <Typography sx={{ fontSize: '1.2rem' }}>✈️</Typography>
          </Box>

          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <FlightLandIcon sx={{ fontSize: '1.2rem', color: 'text.secondary', mb: 0.25 }} />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem' }}>
              {c.destCity}
            </Typography>
            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1, color: tempColor }}>
              {c.destTempAvg}°C
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
              {c.destRainDays} rainy day{c.destRainDays !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 1.25 }} />

        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
          {c.summary}
        </Typography>
      </Paper>

      {/* Stat pills */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <StatPill
          icon={<ThermostatIcon sx={{ fontSize: '0.9rem' }} />}
          label="Avg temp"
          home={`${c.homeTempAvg}°`}
          dest={`${c.destTempAvg}°`}
          delta={c.tempDelta}
        />
        <StatPill
          icon={<WaterDropIcon sx={{ fontSize: '0.9rem' }} />}
          label="Rain days"
          home={c.homeRainDays}
          dest={c.destRainDays}
          delta={c.rainDelta}
        />
        {c.homeWindAvg !== null && c.destWindAvg !== null && (
          <StatPill
            icon={<AirIcon sx={{ fontSize: '0.9rem' }} />}
            label="Wind"
            home={c.homeWindAvg}
            dest={c.destWindAvg}
            delta={c.destWindAvg - c.homeWindAvg}
            unit=" km/h"
          />
        )}
      </Box>

      {/* Insights — each has its own icon from the data layer */}
      {c.insights.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {c.insights.map((insight, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Typography sx={{ fontSize: '0.85rem', mt: 0.05, flexShrink: 0 }}>
                {insight.icon}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                {insight.text}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Home day cards */}
      {c.homeDays.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600}
            sx={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', mb: 0.75 }}>
            {c.homeCity} at the same time of year
          </Typography>
          <DayCardRow days={c.homeDays} compact />
        </Box>
      )}
    </Box>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" color="text.secondary" fontWeight={700}
      sx={{
        fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em',
        display: 'block', mb: 1.25,
      }}>
      {children}
    </Typography>
  );
}

// ─── Main WeatherTab ──────────────────────────────────────────────────────────
export default function WeatherTab({ tripId, destinationCity }: Props) {
  const [weather,    setWeather]    = useState<WeatherResult | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [cachedAge,  setCachedAge]  = useState<string | null>(null);

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
  let active = true;

  const run = async () => {
    await loadWeather();
  };

  run();

  return () => {
    active = false;
  };
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WbSunnyIcon color="primary" sx={{ fontSize: '1.2rem' }} />
            <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              Weather — {destinationCity}
            </Typography>
          </Box>
          {cachedAge && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              Updated {cachedAge}
            </Typography>
          )}
        </Box>
        <Tooltip title="Refresh weather data">
          <span>
            <IconButton onClick={() => loadWeather(true)} disabled={refreshing} size="small">
              <RefreshIcon
                sx={{
                  fontSize: '1.1rem',
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%':   { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }}
              />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* ── Historical banner ── */}
      {isHistorical && (
        <Alert
          severity="info"
          icon={<InfoOutlinedIcon fontSize="small" />}
          sx={{ backgroundColor: 'rgba(85,112,44,0.06)', border: '1px solid rgba(85,112,44,0.2)', py: 1 }}
        >
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25, fontSize: '0.8rem' }}>
            Showing historical averages for this time of year
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
            Your trip is more than 16 days away. Based on {weather.historicalYears?.length ?? 5} years of
            actual recorded data.{forecastFromDate && ` Live forecast available from ${forecastFromDate}.`}
          </Typography>
        </Alert>
      )}

      {/* ── Trip outlook ── */}
      {weather.summary && (
        <Box>
          <SectionHeading>Trip outlook</SectionHeading>
          <Paper elevation={0} sx={{
            p: 1.75, borderLeft: '3px solid', borderLeftColor: 'primary.main',
            border: '1px solid', borderColor: 'divider',
          }}>
            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{weather.summary}</Typography>
          </Paper>
        </Box>
      )}

      {/* ── Home comparison ── */}
      {weather.homeComparison ? (
        <Box>
          <SectionHeading>Home vs destination</SectionHeading>
          <HomeComparisonCard c={weather.homeComparison} />
        </Box>
      ) : (
        <Alert severity="info" sx={{ py: 0.75 }}>
          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
            Set your home location in your profile to see a home vs destination comparison.
          </Typography>
        </Alert>
      )}

      {/* ── Climate model cross-check ── */}
      {weather.climateNormals && (
        <Box>
          <SectionHeading>Climate model cross-check</SectionHeading>
          <Paper elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  {destinationCity} model avg temp
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {weather.climateNormals.destAvgTemp}°C
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  {destinationCity} model rain days
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {weather.climateNormals.destAvgRainDays} of {weather.days.length}
                </Typography>
              </Box>
              {weather.climateNormals.homeAvgTemp !== undefined && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    {weather.homeComparison?.homeCity} model avg temp
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {weather.climateNormals.homeAvgTemp}°C
                  </Typography>
                </Box>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary"
              sx={{ mt: 0.75, display: 'block', fontSize: '0.6rem' }}>
              {weather.climateNormals.note}
            </Typography>
          </Paper>
        </Box>
      )}

      {/* ── Day-by-day ── */}
      <Box>
        <SectionHeading>
          {isHistorical ? 'Typical daily conditions' : 'Day-by-day forecast'} — {weather.days.length} days
        </SectionHeading>
        <DayCardRow days={weather.days} />
      </Box>

      {/* ── Packing impact ── */}
      {weather.packingNotes && weather.packingNotes.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
            <LuggageIcon color="primary" sx={{ fontSize: '1rem' }} />
            <SectionHeading>Packing impact</SectionHeading>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {weather.packingNotes.map((note, i) => (
              <Paper key={i} elevation={0} sx={{
                p: 1.25,
                borderLeft: '3px solid', borderLeftColor: 'warning.main',
                border: '1px solid', borderColor: 'divider',
                display: 'flex', alignItems: 'flex-start', gap: 1,
              }}>
                <Typography sx={{ fontSize: '0.85rem', mt: 0.05, flexShrink: 0 }}>💡</Typography>
                <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>{note}</Typography>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {/* ── Right now ── */}
      {weather.currentWeather && weather.currentWeather.length > 0 && (
        <>
          <Divider />
          <Box>
            <SectionHeading>Right now in {destinationCity}</SectionHeading>
            <DayCardRow days={weather.currentWeather} compact />
            <Typography variant="caption" color="text.secondary"
              sx={{ mt: 0.75, display: 'block', fontSize: '0.68rem' }}>
              Current conditions regardless of trip dates.
            </Typography>
          </Box>
        </>
      )}

      {/* ── Source legend ── */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {[
          { label: 'live', bg: 'rgba(46,125,50,0.1)',   color: 'success.dark', desc: 'WeatherAPI.com (3 days)' },
          { label: 'fcst', bg: 'rgba(25,118,210,0.1)', color: 'primary.main', desc: 'Open-Meteo (16 days)' },
          { label: 'avg',  bg: 'rgba(156,39,176,0.1)', color: 'purple',       desc: '5-year ERA5 historical' },
        ].map(({ label, bg, color, desc }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip label={label} size="small"
              sx={{ height: 14, fontSize: '0.55rem', backgroundColor: bg, color }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>{desc}</Typography>
          </Box>
        ))}
      </Box>

    </Box>
  );
}