'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert,
  Chip, Divider, IconButton, Tooltip, LinearProgress, Button,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import LuggageIcon from '@mui/icons-material/Luggage';

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
  source: 'forecast' | 'historical' | 'weatherapi';
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
}

interface Props {
  tripId: string;
  destinationCity: string;
}

// ─── Single day weather card ─────────────────────────────────────────────────
function DayCard({ day, compact = false }: { day: DayWeather; compact?: boolean }) {
  const rainColor =
    day.chanceOfRain > 60 ? '#1565c0' :
    day.chanceOfRain > 30 ? '#1976d2' :
    '#90caf9';

  return (
    <Paper
      sx={{
        p: compact ? 1.5 : 2,
        minWidth: compact ? 100 : 130,
        maxWidth: compact ? 110 : 140,
        textAlign: 'center',
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Date label */}
      <Typography variant="caption" color="text.secondary" display="block" fontWeight={600}>
        {day.label}
      </Typography>

      {/* Emoji icon */}
      <Typography sx={{ fontSize: compact ? '1.6rem' : '2rem', my: 0.5 }}>
        {day.icon}
      </Typography>

      {/* Condition */}
      <Typography
        variant="caption"
        display="block"
        color="text.secondary"
        sx={{ minHeight: compact ? 'auto' : 32, lineHeight: 1.2, mb: 0.5 }}
      >
        {day.condition}
      </Typography>

      {/* Temperature */}
      <Typography variant={compact ? 'body2' : 'body1'} fontWeight={700}>
        {day.tempAvg}°C
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        ↑{day.tempMax}° ↓{day.tempMin}°
      </Typography>

      {/* Rain bar */}
      {!compact && (
        <Box sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
            <Typography variant="caption" color="text.secondary">☔</Typography>
            <Typography variant="caption" color="text.secondary">{day.chanceOfRain}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={day.chanceOfRain}
            sx={{
              height: 4,
              borderRadius: 2,
              backgroundColor: '#e3f2fd',
              '& .MuiLinearProgress-bar': { backgroundColor: rainColor, borderRadius: 2 },
            }}
          />
        </Box>
      )}

      {/* Wind if available */}
      {!compact && day.windKph !== null && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          💨 {day.windKph} km/h
        </Typography>
      )}

      {/* Source badge */}
      <Chip
        label={day.source === 'historical' ? 'avg' : day.source === 'weatherapi' ? 'live' : 'fcst'}
        size="small"
        sx={{
          mt: 0.75,
          height: 16,
          fontSize: '0.6rem',
          backgroundColor:
            day.source === 'historical' ? 'rgba(156,39,176,0.1)' :
            day.source === 'weatherapi' ? 'rgba(46,125,50,0.1)' :
            'rgba(25,118,210,0.1)',
          color:
            day.source === 'historical' ? 'purple' :
            day.source === 'weatherapi' ? 'success.dark' :
            'primary.main',
        }}
      />
    </Paper>
  );
}

// ─── Main WeatherTab ─────────────────────────────────────────────────────────
export default function WeatherTab({ tripId, destinationCity }: Props) {
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAge, setCachedAge] = useState<string | null>(null);

  const loadWeather = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/trips/${tripId}/weather`,
        forceRefresh ? { method: 'POST' } : {}
      );
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setWeather(data.weather);
      if (data.weather.fetchedAt) {
        const age = Date.now() - new Date(data.weather.fetchedAt).getTime();
        const mins = Math.round(age / 60000);
        const hrs = Math.round(age / 3600000);
        setCachedAge(hrs >= 1 ? `${hrs}h ago` : mins <= 1 ? 'just now' : `${mins}m ago`);
      }
    } catch {
      setError('Failed to load weather');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadWeather(); }, [tripId]);

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

  const isHistorical = weather.mode === 'historical';
  const forecastFromDate = weather.forecastAvailableFrom
    ? new Date(weather.forecastAvailableFrom).toLocaleDateString('en-IE', { day: 'numeric', month: 'long' })
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WbSunnyIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Weather for {destinationCity}
            </Typography>
          </Box>
          {cachedAge && (
            <Typography variant="caption" color="text.secondary">
              Updated {cachedAge}
            </Typography>
          )}
        </Box>
        <Tooltip title="Refresh weather data">
          <span>
            <IconButton onClick={() => loadWeather(true)} disabled={refreshing} size="small">
              <RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* ── Historical mode banner ── */}
      {isHistorical && (
        <Alert
          severity="info"
          icon={<InfoOutlinedIcon />}
          sx={{ backgroundColor: 'rgba(85,112,44,0.08)', border: '1px solid rgba(85,112,44,0.2)' }}
        >
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            Showing historical averages for this time of year
          </Typography>
          <Typography variant="body2">
            Your trip is more than 16 days away so a real forecast isn't available yet.
            This is based on actual recorded weather for the same dates in{' '}
            {weather.historicalYears?.join(', ')}.
            {forecastFromDate && ` A live forecast will be available from ${forecastFromDate}.`}
          </Typography>
        </Alert>
      )}

      {/* ── Trip weather summary ── */}
      {weather.summary && (
        <Paper sx={{ p: 2, backgroundColor: 'background.paper', borderLeft: '4px solid', borderLeftColor: 'primary.main' }}>
          <Typography variant="body2" fontWeight={600}>Trip outlook</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {weather.summary}
          </Typography>
        </Paper>
      )}

      {/* ── Daily forecast cards ── */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }} fontWeight={600}>
          {isHistorical ? 'Typical daily conditions' : 'Day-by-day forecast'} — {weather.days.length} days
        </Typography>
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            overflowX: 'auto',
            pb: 1,
            // Custom scrollbar
            '&::-webkit-scrollbar': { height: 4 },
            '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'divider', borderRadius: 2 },
          }}
        >
          {weather.days.map(day => (
            <DayCard key={day.date} day={day} />
          ))}
        </Box>
      </Box>

      {/* ── Packing notes ── */}
      {weather.packingNotes && weather.packingNotes.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <LuggageIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
              Packing impact
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {weather.packingNotes.map((note, i) => (
              <Paper
                key={i}
                sx={{
                  p: 1.5,
                  backgroundColor: 'background.paper',
                  borderLeft: '3px solid',
                  borderLeftColor: 'warning.main',
                  display: 'flex', alignItems: 'flex-start', gap: 1,
                }}
              >
                <Typography variant="body2" sx={{ mt: 0.1 }}>💡</Typography>
                <Typography variant="body2">{note}</Typography>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {/* ── Current weather (bonus section) ── */}
      {weather.currentWeather && weather.currentWeather.length > 0 && (
        <>
          <Divider />
          <Box>
            <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1.5 }}>
              Right now in {destinationCity}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
              {weather.currentWeather.map(day => (
                <DayCard key={day.date} day={day} compact />
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Current conditions regardless of your trip dates — useful for checking what's happening there now.
            </Typography>
          </Box>
        </>
      )}

      {/* ── Source legend ── */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip label="live" size="small" sx={{ height: 16, fontSize: '0.6rem', backgroundColor: 'rgba(46,125,50,0.1)', color: 'success.dark' }} />
          <Typography variant="caption" color="text.secondary">WeatherAPI.com (high accuracy, 3 days)</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip label="fcst" size="small" sx={{ height: 16, fontSize: '0.6rem', backgroundColor: 'rgba(25,118,210,0.1)', color: 'primary.main' }} />
          <Typography variant="caption" color="text.secondary">Open-Meteo forecast (up to 16 days)</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip label="avg" size="small" sx={{ height: 16, fontSize: '0.6rem', backgroundColor: 'rgba(156,39,176,0.1)', color: 'purple' }} />
          <Typography variant="caption" color="text.secondary">Historical average (prior years)</Typography>
        </Box>
      </Box>

    </Box>
  );
}