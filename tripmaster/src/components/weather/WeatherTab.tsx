'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert,
  Chip, IconButton, Tooltip, LinearProgress, Collapse, Button,
} from '@mui/material';
import RefreshIcon          from '@mui/icons-material/Refresh';
import InfoOutlinedIcon     from '@mui/icons-material/InfoOutlined';
import ThermostatIcon       from '@mui/icons-material/Thermostat';
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
import CheckCircleIcon      from '@mui/icons-material/CheckCircle';
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import ExpandMoreIcon       from '@mui/icons-material/ExpandMore';
import ExpandLessIcon       from '@mui/icons-material/ExpandLess';

// ─── Design tokens ─────────────────────────────────────────────────────────────

const D = {
  green:   '#6B7C5C',
  terra:   '#C4714A',
  navy:    '#1D2642',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  homeCity:       string;
  destCity:       string;
  homeTempAvg:    number;
  destTempAvg:    number;
  tempDelta:      number;
  tempDeltaLabel: string;
  homeRainDays:   number;
  destRainDays:   number;
  rainDelta:      number;
  homeWindAvg:    number | null;
  destWindAvg:    number | null;
  summary:        string;
  insights:       { icon: string; text: string }[];
  homeDays:       DayWeather[];
}

interface WeatherResult {
  mode:                  'forecast' | 'historical' | 'current';
  days:                  DayWeather[];
  fetchedAt:             string;
  forecastAvailableFrom?: string;
  historicalYears?:      number[];
  currentWeather?:       DayWeather[];
  summary?:              string;
  packingNotes?:         string[];
  homeComparison?:       HomeComparison;
  climateNormals?: {
    destAvgTemp:        number;
    destAvgRainDays:    number;
    homeAvgTemp?:       number;
    homeAvgRainDays?:   number;
    source:             string;
    note:               string;
  };
}

interface Props {
  tripId:          string;
  destinationCity: string;
  startDate?:      string;
  endDate?:        string;
}

type DisplayMode = 'planning' | 'forecast' | 'now';

// ─── Weather helpers ───────────────────────────────────────────────────────────

function conditionIcon(condition: string, sx?: object) {
  const c = condition.toLowerCase();
  if (c.includes('thunder') || c.includes('storm'))
    return <ThunderstormIcon sx={sx} />;
  if (c.includes('snow') || c.includes('blizzard') || c.includes('ice') || c.includes('sleet') || c.includes('freez'))
    return <AcUnitIcon sx={sx} />;
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower'))
    return <UmbrellaIcon sx={sx} />;
  if (c.includes('overcast') || c.includes('cloud') || c.includes('fog') || c.includes('mist'))
    return <CloudIcon sx={sx} />;
  if (c.includes('patchy') || c.includes('partly'))
    return <GrainIcon sx={sx} />;
  return <WbSunnyIcon sx={sx} />;
}

function conditionColor(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('thunder') || c.includes('storm'))                                     return '#5c35a0';
  if (c.includes('snow') || c.includes('ice') || c.includes('freez'))                   return '#0369a1';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower'))              return '#0891b2';
  if (c.includes('patchy') || c.includes('partly') || c.includes('overcast') || c.includes('cloud')) return '#6b7280';
  return D.terra;
}

function tripCharacter(days: DayWeather[]): { label: string; sub: string } {
  const maxTemp   = Math.max(...days.map(d => d.tempMax));
  const rainyDays = days.filter(d => d.chanceOfRain > 40).length;

  const tempLabel =
    maxTemp >= 28 ? 'Hot'  :
    maxTemp >= 20 ? 'Warm' :
    maxTemp >= 12 ? 'Mild' : 'Cold';

  const rainLabel =
    rainyDays >= days.length * 0.6 ? 'Wet'   :
    rainyDays >= days.length * 0.3 ? 'Mixed' : 'Dry';

  const sub =
    maxTemp >= 28 && rainLabel === 'Dry' ? 'Pack light, stay hydrated'          :
    maxTemp < 12                         ? 'Layers essential'                   :
    rainLabel === 'Wet'                  ? 'Waterproofs a must'                 :
    rainLabel === 'Mixed'                ? 'Pack for both sun and rain'         : 'Comfortable conditions';

  return { label: `${tempLabel} & ${rainLabel}`, sub };
}

// ─── Source chip ───────────────────────────────────────────────────────────────

function SourceChip({ source }: { source: DayWeather['source'] }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    weatherapi: { label: 'live', bg: 'rgba(46,125,50,0.12)',   color: '#2e7d32' },
    forecast:   { label: 'fcst', bg: 'rgba(25,118,210,0.12)', color: '#1976d2' },
    historical: { label: 'avg',  bg: `${D.terra}1A`,          color: D.terra   },
    climate:    { label: 'mdl',  bg: 'rgba(156,39,176,0.12)', color: '#7c3aed' },
  };
  const s = map[source] ?? map.forecast;
  return (
    <Chip label={s.label} size="small" sx={{
      height: 16, fontSize: '0.8rem', fontWeight: 800,
      fontFamily: D.body, letterSpacing: '0.05em',
      backgroundColor: s.bg, color: s.color,
    }} />
  );
}

// ─── Day card ──────────────────────────────────────────────────────────────────

function DayCard({ day, compact = false }: { day: DayWeather; compact?: boolean }) {
  const iconColor = conditionColor(day.condition);
  const rainHigh  = day.chanceOfRain > 60;
  const rainMed   = day.chanceOfRain > 30;

  return (
    <Paper elevation={0} sx={{
      p: compact ? 1.25 : 1.75,
      border: `1.5px solid ${D.rule}`,
      borderRadius: '10px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 0.5,
      minWidth: compact ? 96 : 116,
      flex: '0 0 auto',
      backgroundColor: rainHigh ? 'rgba(8,145,178,0.04)' : D.paper,
    }}>
      {/* Date */}
      <Typography sx={{
        fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: D.terra, lineHeight: 1,
        fontFamily: D.body,
      }}>
        {day.label}
      </Typography>

      {/* Icon */}
      {conditionIcon(day.condition, { fontSize: '1.6rem', color: iconColor, my: 0.25 })}

      {/* Temperature — the number you read first */}
      <Typography sx={{
        fontFamily: D.display,
        fontSize: compact ? '1.4rem' : '1.65rem',
        lineHeight: 1, color: D.navy,
      }}>
        {day.tempAvg}°
      </Typography>

      {/* High / low */}
      <Typography sx={{ fontSize: '0.85rem', color: D.muted, lineHeight: 1, fontFamily: D.body }}>
        {day.tempMax}° / {day.tempMin}°
      </Typography>

      {/* Rain */}
      <Box sx={{ width: '100%', mt: 0.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3, px: 0.25 }}>
          <UmbrellaIcon sx={{ fontSize: '1rem', color: D.muted }} />
          <Typography sx={{
            fontSize: '1rem',
            color: rainHigh ? '#0891b2' : D.muted,
            fontWeight: rainHigh ? 800 : 400,
            fontFamily: D.body,
          }}>
            {day.chanceOfRain}%
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={day.chanceOfRain} sx={{
          height: 2, borderRadius: 2,
          backgroundColor: D.rule,
          '& .MuiLinearProgress-bar': {
            backgroundColor: rainHigh ? '#0891b2' : rainMed ? '#60a5d4' : `${D.rule}`,
            borderRadius: 2,
          },
        }} />
      </Box>

      {day.windKph !== null && (
        <Typography sx={{ fontSize: '1rem', color: D.muted, fontFamily: D.body }}>
          {day.windKph} km/h
        </Typography>
      )}

      <SourceChip source={day.source} />
    </Paper>
  );
}

// ─── Day grid — scroll on mobile, grid on desktop ─────────────────────────────

function DayGrid({ days, compact = false }: { days: DayWeather[]; compact?: boolean }) {
  return (
    <>
      {/* Mobile: horizontal scroll */}
      <Box sx={{
        display: { xs: 'flex', sm: 'none' },
        gap: 1, overflowX: 'auto', pb: 1,
        '&::-webkit-scrollbar': { height: 3 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: D.rule, borderRadius: 2 },
      }}>
        {days.map(d => <DayCard key={d.date} day={d} compact={compact} />)}
      </Box>

      {/* Desktop: grid */}
      <Box sx={{
        display: { xs: 'none', sm: 'grid' },
        gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))',
        gap: 1.25,
      }}>
        {days.map(d => <DayCard key={d.date} day={d} compact={compact} />)}
      </Box>
    </>
  );
}

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

// ─── Stat strip ────────────────────────────────────────────────────────────────

function StatStrip({ days }: { days: DayWeather[] }) {
  const maxTemp = Math.max(...days.map(d => d.tempMax));
  const avgRain = Math.round(days.reduce((a, d) => a + d.chanceOfRain, 0) / days.length);
  const avgWind = days[0]?.windKph;

  const stats = [
    { label: 'Avg high', value: `${maxTemp}°C`, Icon: DeviceThermostatIcon },
    { label: 'Rain',     value: `${avgRain}%`,  Icon: UmbrellaIcon         },
    ...(avgWind != null ? [{ label: 'Wind', value: `${avgWind} km/h`, Icon: AirIcon }] : []),
  ];

  return (
    <Box sx={{
      display: 'flex', borderRadius: '8px',
      border: `1.5px solid ${D.rule}`, overflow: 'hidden', mt: 2,
    }}>
      {stats.map(({ label, value, Icon }, i) => (
        <Box key={label} sx={{
          flex: 1, py: 1.25, textAlign: 'center',
          borderRight: i < stats.length - 1 ? `1px solid ${D.rule}` : 'none',
        }}>
          <Icon sx={{ fontSize: '0.95rem', color: D.muted, display: 'block', mx: 'auto', mb: 0.3 }} />
          <Typography sx={{ fontFamily: D.display, fontSize: '1rem', lineHeight: 1, color: D.navy }}>
            {value}
          </Typography>
          <Typography sx={{ fontSize: '0.68rem', color: D.muted, mt: 0.3, fontFamily: D.body }}>
            {label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ─── Packing notes ─────────────────────────────────────────────────────────────

function PackingNotes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {notes.map((note, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <LuggageIcon sx={{ fontSize: '1rem', color: D.green, mt: 0.2, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '1rem', color: D.muted, lineHeight: 1.45, fontFamily: D.body }}>
            {note}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ─── Home comparison ───────────────────────────────────────────────────────────

function HomeComparison({ c }: { c: HomeComparison }) {
  const deltaColor = c.tempDelta > 2 ? D.terra : c.tempDelta < -2 ? '#0369a1' : D.muted;
  const prefix     = c.tempDelta > 0 ? '+' : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography sx={{ fontSize: '1rem', color: D.muted, lineHeight: 1.5, fontFamily: D.body }}>
        {c.summary}
      </Typography>

      {/* Side by side */}
      <Paper elevation={0} sx={{ border: `1.5px solid ${D.rule}`, borderRadius: '10px', overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr' }}>
          {/* Home */}
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <HomeIcon sx={{ fontSize: '1rem', color: D.muted, mb: 0.5 }} />
            <Typography sx={{
              fontSize: '0.62rem', color: D.muted, display: 'block',
              fontFamily: D.body, textTransform: 'uppercase',
              letterSpacing: '0.07em', fontWeight: 700,
            }}>
              {c.homeCity}
            </Typography>
            <Typography sx={{ fontFamily: D.display, fontSize: '1.7rem', lineHeight: 1.2, color: D.navy }}>
              {c.homeTempAvg}°
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', color: D.muted, fontFamily: D.body }}>
              {c.homeRainDays} rainy day{c.homeRainDays !== 1 ? 's' : ''}
            </Typography>
          </Box>

          {/* Delta */}
          <Box sx={{
            px: 1.5, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            borderLeft: `1px solid ${D.rule}`, borderRight: `1px solid ${D.rule}`,
            backgroundColor: D.rule,
          }}>
            <Typography sx={{ fontFamily: D.display, fontSize: '0.9rem', color: deltaColor }}>
              {prefix}{c.tempDelta}°
            </Typography>
          </Box>

          {/* Destination */}
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <FlightLandIcon sx={{ fontSize: '1rem', color: D.muted, mb: 0.5 }} />
            <Typography sx={{
              fontSize: '0.62rem', color: D.muted, display: 'block',
              fontFamily: D.body, textTransform: 'uppercase',
              letterSpacing: '0.07em', fontWeight: 700,
            }}>
              {c.destCity}
            </Typography>
            <Typography sx={{ fontFamily: D.display, fontSize: '1.7rem', lineHeight: 1.2, color: deltaColor }}>
              {c.destTempAvg}°
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', color: D.muted, fontFamily: D.body }}>
              {c.destRainDays} rainy day{c.destRainDays !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Insights */}
      {c.insights.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {c.insights.map((ins, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <CheckCircleIcon sx={{ fontSize: '0.9rem', color: D.green, mt: 0.2, flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.85rem', color: D.muted, lineHeight: 1.4, fontFamily: D.body }}>
                {ins.text}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Home day cards */}
      {c.homeDays.length > 0 && (
        <Box>
          <SectionLabel>{c.homeCity} at the same time of year</SectionLabel>
          <DayGrid days={c.homeDays} compact />
        </Box>
      )}
    </Box>
  );
}

// ─── Data sources (replaces "Technical detail") ────────────────────────────────

function DataSources({ weather, destinationCity }: { weather: WeatherResult; destinationCity: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Box>
      <Button
        size="small"
        endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={() => setOpen(p => !p)}
        sx={{
          fontSize: '0.72rem', color: D.muted,
          fontWeight: 700, px: 0, fontFamily: D.body,
        }}
      >
        {open ? 'Hide' : 'Show'} data sources
      </Button>

      <Collapse in={open}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1.5 }}>

          {weather.climateNormals && (
            <Paper elevation={0} sx={{
              p: 1.75, border: `1.5px solid ${D.rule}`, borderRadius: '10px',
            }}>
              <SectionLabel>Climate model cross-check</SectionLabel>
              <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', color: D.muted, fontFamily: D.body }}>
                    {destinationCity} model avg temp
                  </Typography>
                  <Typography sx={{ fontFamily: D.display, fontSize: '1rem', color: D.navy }}>
                    {weather.climateNormals.destAvgTemp}°C
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', color: D.muted, fontFamily: D.body }}>
                    Model rain days
                  </Typography>
                  <Typography sx={{ fontFamily: D.display, fontSize: '1rem', color: D.navy }}>
                    {weather.climateNormals.destAvgRainDays} of {weather.days.length}
                  </Typography>
                </Box>
                {weather.climateNormals.homeAvgTemp !== undefined && (
                  <Box>
                    <Typography sx={{ fontSize: '0.68rem', color: D.muted, fontFamily: D.body }}>
                      {weather.homeComparison?.homeCity} model avg
                    </Typography>
                    <Typography sx={{ fontFamily: D.display, fontSize: '1rem', color: D.navy }}>
                      {weather.climateNormals.homeAvgTemp}°C
                    </Typography>
                  </Box>
                )}
              </Box>
              <Typography sx={{ fontSize: '0.88rem', color: D.muted, mt: 1, fontFamily: D.body }}>
                {weather.climateNormals.note}
              </Typography>
            </Paper>
          )}

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {[
              { label: 'live', bg: 'rgba(46,125,50,0.12)',   color: '#2e7d32', desc: 'WeatherAPI.com (3 days)'   },
              { label: 'fcst', bg: 'rgba(25,118,210,0.12)', color: '#1976d2', desc: 'Open-Meteo (16 days)'      },
              { label: 'avg',  bg: `${D.terra}1A`,          color: D.terra,   desc: '5-year ERA5 historical'    },
            ].map(({ label, bg, color, desc }) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Chip label={label} size="small" sx={{
                  height: 16, fontSize: '0.58rem', fontWeight: 800,
                  backgroundColor: bg, color, fontFamily: D.body,
                }} />
                <Typography sx={{ fontSize: '0.68rem', color: D.muted, fontFamily: D.body }}>{desc}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PLANNING VIEW ─────────────────────────────────────────────────────────────
// Hero: temperature character, packing notes. Home comparison prominent.
// Use when trip is >16 days out (historical data).
// ═══════════════════════════════════════════════════════════════════════════════

function PlanningView({
  weather, destinationCity, isHistorical,
}: {
  weather: WeatherResult; destinationCity: string; isHistorical: boolean;
}) {
  const { label: charLabel, sub: charSub } = tripCharacter(weather.days);
  const maxTemp = Math.max(...weather.days.map(d => d.tempMax));
  const minTemp = Math.min(...weather.days.map(d => d.tempMin));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* Historical notice */}
      {isHistorical && (
        <Alert
          severity="info"
          icon={<InfoOutlinedIcon fontSize="small" />}
          sx={{
            backgroundColor: `${D.green}0E`,
            border: `1px solid ${D.green}28`,
            borderRadius: '10px', py: 0.75,
            '& .MuiAlert-icon': { color: D.green },
          }}
        >
          <Typography sx={{
            fontSize: '0.78rem', fontWeight: 700,
            fontFamily: D.body, color: D.navy, mb: 0.1,
          }}>
            Historical averages
          </Typography>
          <Typography sx={{ fontSize: '0.83rem', color: D.muted, fontFamily: D.body }}>
            Based on {weather.historicalYears?.length ?? 5} years of recorded data
            {weather.forecastAvailableFrom
              ? ` · Live forecast from ${new Date(weather.forecastAvailableFrom)
                  .toLocaleDateString('en-IE', { day: 'numeric', month: 'long' })}`
              : ''}
          </Typography>
        </Alert>
      )}

      {/* Trip character hero */}
      <Paper elevation={0} sx={{
        p: { xs: 2.5, sm: 3 },
        border: `1.5px solid ${D.rule}`,
        borderRadius: '12px',
        background: `linear-gradient(135deg, ${D.green}0A 0%, transparent 55%)`,
      }}>
        <Box sx={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 2, mb: 0,
        }}>
          {/* Temperature range */}
          <Box>
            <Typography sx={{
              fontFamily: D.display,
              fontSize: { xs: '2.4rem', sm: '3rem' },
              lineHeight: 1, color: D.navy,
              letterSpacing: '-0.02em',
            }}>
              {minTemp}–{maxTemp}°C
            </Typography>
            <Typography sx={{
              fontSize: '0.75rem', color: D.muted,
              fontFamily: D.body, mt: 0.5,
            }}>
              {destinationCity} · {weather.days.length} day{weather.days.length !== 1 ? 's' : ''}
              {isHistorical ? ' · historical avg' : ''}
            </Typography>
          </Box>

          {/* Character badge */}
          <Box sx={{ textAlign: 'right', flexShrink: 0, mt: 0.25 }}>
            <Typography sx={{
              fontFamily: D.display,
              fontSize: { xs: '0.88rem', sm: '1rem' },
              color: D.terra, lineHeight: 1.2,
            }}>
              {charLabel}
            </Typography>
            <Typography sx={{
              fontSize: '0.7rem', color: D.muted,
              fontFamily: D.body, mt: 0.4,
            }}>
              {charSub}
            </Typography>
          </Box>
        </Box>

        {/* Summary */}
        {weather.summary && (
          <Typography sx={{
            fontSize: '1rem', color: D.muted,
            lineHeight: 1.5, fontFamily: D.body, mt: 1.25,
          }}>
            {weather.summary}
          </Typography>
        )}

        {/* Packing notes */}
        {weather.packingNotes && weather.packingNotes.length > 0 && (
          <Box sx={{
            pt: 1.5, mt: 1.5,
            borderTop: `1px dashed ${D.rule}`,
          }}>
            <PackingNotes notes={weather.packingNotes} />
          </Box>
        )}

        {/* Stat strip */}
        <StatStrip days={weather.days} />
      </Paper>

      {/* Day strip */}
      <Box>
        <SectionLabel>
          {isHistorical ? 'Typical daily conditions' : 'Day-by-day forecast'}
        </SectionLabel>
        <DayGrid days={weather.days} />
      </Box>

      {/* Home comparison — most valuable in planning mode */}
      {weather.homeComparison ? (
        <Box>
          <SectionLabel>Compared to home</SectionLabel>
          <HomeComparison c={weather.homeComparison} />
        </Box>
      ) : (
        <Alert
          severity="info"
          icon={<HomeIcon fontSize="small" />}
          sx={{ py: 0.75, borderRadius: '10px' }}
        >
          <Typography sx={{ fontSize: '0.92rem', fontFamily: D.body }}>
            Set your home location in your profile to compare with home.
          </Typography>
        </Alert>
      )}

      <DataSources weather={weather} destinationCity={destinationCity} />
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── FORECAST VIEW ─────────────────────────────────────────────────────────────
// Hero: best and worst day called out. Day grid is the main content.
// Use when trip is 1–16 days out (live forecast data available).
// ═══════════════════════════════════════════════════════════════════════════════

function ForecastView({
  weather, destinationCity,
}: {
  weather: WeatherResult; destinationCity: string;
}) {
  const days = weather.days;

  // Derive best day (warmest, least rain) and worst day (most rain, coldest)
  const bestDay = [...days].sort(
    (a, b) => (b.tempMax - b.chanceOfRain * 0.4) - (a.tempMax - a.chanceOfRain * 0.4)
  )[0];
  const worstDay = [...days].sort(
    (a, b) => (b.chanceOfRain + (20 - b.tempMax) * 0.5) - (a.chanceOfRain + (20 - a.tempMax) * 0.5)
  )[0];
  const hasDual = bestDay && worstDay && bestDay.date !== worstDay.date;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* Best / worst hero */}
      {hasDual && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          {([
            { day: bestDay,  label: 'Best day',  accentColor: D.green,   tempColor: D.navy     },
            { day: worstDay, label: 'Watch out', accentColor: '#0891b2', tempColor: '#0369a1'  },
          ] as const).map(({ day, label, accentColor, tempColor }) => (
            <Paper key={day.date} elevation={0} sx={{
              p: { xs: 1.75, sm: 2 },
              border: `1.5px solid ${accentColor}35`,
              borderTop: `3px solid ${accentColor}`,
              borderRadius: '0 0 12px 12px',
              display: 'flex', flexDirection: 'column', gap: 0.5,
            }}>
              <Typography sx={{
                fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: accentColor, fontFamily: D.body,
              }}>
                {label}
              </Typography>
              <Typography sx={{
                fontSize: '0.8rem', color: D.muted,
                fontFamily: D.body, fontWeight: 700,
              }}>
                {day.label}
              </Typography>
              {conditionIcon(day.condition, {
                fontSize: '1.6rem',
                color: conditionColor(day.condition),
                my: 0.5,
              })}
              <Typography sx={{
                fontFamily: D.display, fontSize: '2rem',
                lineHeight: 1, color: tempColor,
              }}>
                {day.tempMax}°
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: D.muted, fontFamily: D.body }}>
                {day.condition}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: D.muted, fontFamily: D.body }}>
                {day.chanceOfRain}% rain
              </Typography>
            </Paper>
          ))}
        </Box>
      )}

      {/* Summary */}
      {weather.summary && (
        <Typography sx={{
          fontSize: '1.2rem', color: D.muted,
          lineHeight: 1.5, fontFamily: D.body,
        }}>
          {weather.summary}
        </Typography>
      )}

      {/* Day grid — main content in forecast mode */}
      <Box>
        <SectionLabel>All {days.length} days</SectionLabel>
        <DayGrid days={days} />
      </Box>

      {/* Packing notes */}
      {weather.packingNotes && weather.packingNotes.length > 0 && (
        <Box>
          <SectionLabel>Pack for this trip</SectionLabel>
          <PackingNotes notes={weather.packingNotes} />
        </Box>
      )}

      {/* Home comparison — less prominent in forecast mode */}
      {weather.homeComparison && (
        <Box>
          <SectionLabel>Compared to home</SectionLabel>
          <HomeComparison c={weather.homeComparison} />
        </Box>
      )}

      <DataSources weather={weather} destinationCity={destinationCity} />
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── NOW VIEW ──────────────────────────────────────────────────────────────────
// Hero: current conditions right now. Large temperature number leads.
// Use when trip is active (today is within startDate–endDate).
// ═══════════════════════════════════════════════════════════════════════════════

function NowView({
  weather, destinationCity,
}: {
  weather: WeatherResult; destinationCity: string;
}) {
  const currentDays = weather.currentWeather ?? [];
  const today       = currentDays[0];

  if (!today) {
    return (
      <Alert severity="info" sx={{ borderRadius: '10px' }}>
        <Typography sx={{ fontSize: '0.95rem', fontFamily: D.body }}>
          Current conditions not available for {destinationCity}.
        </Typography>
      </Alert>
    );
  }

  const iconColor = conditionColor(today.condition);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* Right now hero */}
      <Paper elevation={0} sx={{
        p: { xs: 2.5, sm: 3 },
        border: `1.5px solid ${D.rule}`,
        borderRadius: '12px',
        background: `linear-gradient(135deg, ${iconColor}0A 0%, transparent 60%)`,
      }}>
        <Box sx={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 2,
        }}>
          {/* Temperature */}
          <Box>
            <Typography sx={{
              fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: D.terra,
              fontFamily: D.body, mb: 0.5,
            }}>
              Right now
            </Typography>
            <Typography sx={{
              fontFamily: D.display,
              fontSize: { xs: '3.8rem', sm: '4.8rem' },
              lineHeight: 1, color: D.navy,
              letterSpacing: '-0.02em',
            }}>
              {today.tempAvg}°C
            </Typography>
            <Typography sx={{
              fontSize: '0.98rem', color: D.muted,
              fontFamily: D.body, mt: 0.5,
            }}>
              {today.condition}
            </Typography>
            <Typography sx={{
              fontSize: '0.85rem', color: D.muted,
              fontFamily: D.body, mt: 0.25,
            }}>
              {destinationCity} · {today.label}
            </Typography>
          </Box>

          {/* Icon + range */}
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            {conditionIcon(today.condition, {
              fontSize: { xs: '3.5rem', sm: '4.5rem' },
              color: iconColor,
            })}
            <Typography sx={{
              fontSize: '0.75rem', color: D.muted,
              fontFamily: D.body, mt: 0.5,
            }}>
              {today.tempMax}° / {today.tempMin}°
            </Typography>
            {today.windKph !== null && (
              <Typography sx={{ fontSize: '0.78rem', color: D.muted, fontFamily: D.body }}>
                {today.windKph} km/h
              </Typography>
            )}
          </Box>
        </Box>

        {/* Rain bar */}
        {today.chanceOfRain > 0 && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: '0.7rem', color: D.muted, fontFamily: D.body }}>
                Rain chance today
              </Typography>
              <Typography sx={{
                fontSize: '0.95rem', fontWeight: 800,
                color: '#0891b2', fontFamily: D.body,
              }}>
                {today.chanceOfRain}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={today.chanceOfRain} sx={{
              height: 3, borderRadius: 2,
              backgroundColor: D.rule,
              '& .MuiLinearProgress-bar': { backgroundColor: '#0891b2', borderRadius: 2 },
            }} />
          </Box>
        )}
      </Paper>

      {/* Coming up — remaining current weather days */}
      {currentDays.length > 1 && (
        <Box>
          <SectionLabel>Coming up</SectionLabel>
          <DayGrid days={currentDays.slice(1)} />
        </Box>
      )}

      {/* Trip days */}
      {weather.days.length > 0 && (
        <Box>
          <SectionLabel>Trip days</SectionLabel>
          <DayGrid days={weather.days} />
        </Box>
      )}

      {/* Packing notes */}
      {weather.packingNotes && weather.packingNotes.length > 0 && (
        <Box>
          <SectionLabel>Pack for this trip</SectionLabel>
          <PackingNotes notes={weather.packingNotes} />
        </Box>
      )}

      <DataSources weather={weather} destinationCity={destinationCity} />
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MAIN ──────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default function WeatherTab({ tripId, destinationCity, startDate, endDate }: Props) {
  const [weather,     setWeather]     = useState<WeatherResult | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [cachedAge,   setCachedAge]   = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode | null>(null);

  // ── Derive trip timing ──────────────────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const start = startDate ? (() => {
    const d = new Date(startDate); d.setHours(0, 0, 0, 0); return d;
  })() : null;

  const end = endDate ? (() => {
    const d = new Date(endDate); d.setHours(0, 0, 0, 0); return d;
  })() : null;

  const daysUntil = start
    ? Math.ceil((start.getTime() - today.getTime()) / 86400000)
    : null;

  const smartDefault: DisplayMode =
    start && end && today >= start && today <= end ? 'now'      :
    daysUntil !== null && daysUntil <= 16          ? 'forecast' : 'planning';

  const activeMode = displayMode ?? smartDefault;

  // ── Load weather ────────────────────────────────────────────────────────────
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

  useEffect(() => { loadWeather(); }, [tripId]);

  // ── States ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  );

  if (error) return (
    <Alert severity="warning" sx={{ mt: 2, borderRadius: '10px' }}>
      {error === 'No destination city on trip'
        ? 'Add a destination city to your trip to see weather.'
        : `Could not load weather: ${error}`}
    </Alert>
  );

  if (!weather) return null;

  const hasCurrentData = (weather.currentWeather?.length ?? 0) > 0;

  const tabs: { key: DisplayMode; label: string }[] = [
    { key: 'planning', label: 'Planning'  },
    { key: 'forecast', label: 'Forecast'  },
    ...(hasCurrentData ? [{ key: 'now' as DisplayMode, label: 'Right now' }] : []),
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{
            fontFamily: D.display,
            fontSize: { xs: '1.8rem', sm: '2rem' },
            color: D.navy, lineHeight: 1,
          }}>
            Weather
          </Typography>
          {cachedAge && (
            <Typography sx={{
              fontSize: '0.85rem', color: D.muted,
              fontFamily: D.body, mt: 0.35,
            }}>
              Updated {cachedAge}
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

      {/* Mode switcher — smart default, user can override */}
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        {tabs.map(({ key, label }) => {
          const isActive = activeMode === key;
          return (
            <Chip
              key={key}
              label={label}
              size="small"
              onClick={() => setDisplayMode(key === smartDefault ? null : key)}
              sx={{
                height: 28,
                fontSize: '0.92rem', fontWeight: 800,
                fontFamily: D.body, letterSpacing: '0.02em',
                backgroundColor: isActive ? D.navy : 'transparent',
                color:           isActive ? '#fff' : D.muted,
                border:          `1.5px solid ${isActive ? D.navy : D.rule}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                '&:hover': {
                  backgroundColor: isActive ? D.navy : D.rule,
                },
              }}
            />
          );
        })}
      </Box>

      {/* Views */}
      {activeMode === 'planning' && (
        <PlanningView
          weather={weather}
          destinationCity={destinationCity}
          isHistorical={weather.mode === 'historical'}
        />
      )}
      {activeMode === 'forecast' && (
        <ForecastView
          weather={weather}
          destinationCity={destinationCity}
        />
      )}
      {activeMode === 'now' && hasCurrentData && (
        <NowView
          weather={weather}
          destinationCity={destinationCity}
        />
      )}

    </Box>
  );
}