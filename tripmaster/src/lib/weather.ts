// src/lib/weather.ts — server only.
//
// One consistent source per day: Open-Meteo's forecast wherever it reaches
// (≈14 days ahead, ≈85 days back), and beyond that a typical day pooled from up
// to 10 years of ERA5 records, ±3 days around each date. Home is fetched for the
// same dates with the same split, so every comparison is like for like.
//
// Where the forecast is *for* matters as much as the model: a bare name lookup
// for an island lands on its centroid ("Gran Canaria" → 1,682 m up in the
// mountains, fog and 15°). Points come from the booked stay first, then a
// populated-place lookup, then the arrival airport.
//
// Derived reads (what to wear, home comparison, summary) live in
// weather-insights.ts so they apply to cached results without a refetch.

import { createHash } from 'crypto';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import { airportByIata, airports } from '@/lib/data/airports';
import {
  WEATHER_VERSION,
  type CurrentWeather, type DayHours, type DayWeather, type WeatherPlace, type WeatherResult,
} from '@/lib/weather-insights';

// Open-Meteo hard-errors (rather than clamping) past its horizon. 14 leaves a
// margin: timezone=auto makes "today" destination-local, which can run a day
// ahead of the server.
const FORECAST_HORIZON_DAYS = 14;
const PAST_FORECAST_DAYS    = 85;   // the forecast API serves ~92 days back
const HISTORY_YEARS         = 10;
const POOL_DAYS             = 3;    // ±3 days around each date → up to 70 samples
const ERA5_LAG_DAYS         = 7;
const STAY_MAX_KM           = 150;

const HOUR_MS = 3_600_000;
const DAY_MS  = 86_400_000;

// ─── Dates (UTC, YYYY-MM-DD) ──────────────────────────────────────────────────

const parseYmd = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const toYmd    = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays  = (s: string, n: number) => toYmd(parseYmd(s) + n * DAY_MS);
const todayUtc = () => new Date().toISOString().slice(0, 10);

function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = parseYmd(from); t <= parseYmd(to); t += DAY_MS) out.push(toYmd(t));
  return out;
}

// Same month/day in another year; 29 Feb becomes the 28th in non-leap years.
function withYear(s: string, year: number): string {
  const md   = s.slice(5);
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return `${year}-${md === '02-29' && !leap ? '02-28' : md}`;
}

function formatLabel(s: string): string {
  return new Date(parseYmd(s)).toLocaleDateString('en-IE', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

const ymdOf = (v: unknown): string | undefined => {
  if (!v) return undefined;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v.toISOString().slice(0, 10);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined;
};

// ─── Numbers ──────────────────────────────────────────────────────────────────

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const mean  = (xs: unknown[]) => { const v = xs.filter(isNum); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const round = (x: number | null | undefined) => (isNum(x) ? Math.round(x) : null);
const one   = (x: number | null | undefined) => (isNum(x) ? Math.round(x * 10) / 10 : null);

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
}

// ─── Sun geometry — daylight everywhere, clear-sky UV for typical days ───────

function declination(date: string): number {
  const n = Math.round((parseYmd(date) - Date.UTC(+date.slice(0, 4), 0, 1)) / DAY_MS) + 1;
  return 23.44 * Math.sin((2 * Math.PI / 365) * (284 + n));
}

function daylightHours(lat: number, date: string): number {
  const rad  = Math.PI / 180;
  const phi  = lat * rad;
  const dec  = declination(date) * rad;
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosW <= -1) return 24;
  if (cosW >= 1)  return 0;
  return (2 * Math.acos(cosW) / rad) / 15;
}

// Noon clear-sky UV index from solar zenith angle (Madronich's approximation).
function clearSkyUv(lat: number, date: string): number {
  const cosZ = Math.cos(Math.abs(lat - declination(date)) * Math.PI / 180);
  return cosZ <= 0 ? 0 : Math.round(12.5 * cosZ ** 2.42);
}

// ─── WMO codes ────────────────────────────────────────────────────────────────

const WMO_MAP: Record<number, { condition: string; icon: string }> = {
  0:  { condition: 'Clear sky',           icon: '☀️' },
  1:  { condition: 'Mainly clear',        icon: '🌤️' },
  2:  { condition: 'Partly cloudy',       icon: '⛅' },
  3:  { condition: 'Overcast',            icon: '☁️' },
  45: { condition: 'Foggy',               icon: '🌫️' },
  48: { condition: 'Icy fog',             icon: '🌫️' },
  51: { condition: 'Light drizzle',       icon: '🌦️' },
  53: { condition: 'Drizzle',             icon: '🌧️' },
  55: { condition: 'Heavy drizzle',       icon: '🌧️' },
  56: { condition: 'Freezing drizzle',    icon: '🌧️' },
  57: { condition: 'Freezing drizzle',    icon: '🌧️' },
  61: { condition: 'Light rain',          icon: '🌧️' },
  63: { condition: 'Rain',                icon: '🌧️' },
  65: { condition: 'Heavy rain',          icon: '🌧️' },
  66: { condition: 'Freezing rain',       icon: '🌧️' },
  67: { condition: 'Freezing rain',       icon: '🌧️' },
  71: { condition: 'Light snow',          icon: '🌨️' },
  73: { condition: 'Snow',                icon: '❄️' },
  75: { condition: 'Heavy snow',          icon: '❄️' },
  77: { condition: 'Snow grains',         icon: '🌨️' },
  80: { condition: 'Rain showers',        icon: '🌦️' },
  81: { condition: 'Heavy showers',       icon: '🌧️' },
  82: { condition: 'Violent showers',     icon: '⛈️' },
  85: { condition: 'Snow showers',        icon: '🌨️' },
  86: { condition: 'Heavy snow showers',  icon: '❄️' },
  95: { condition: 'Thunderstorm',        icon: '⛈️' },
  96: { condition: 'Thunderstorm + hail', icon: '⛈️' },
  99: { condition: 'Thunderstorm + hail', icon: '⛈️' },
};

const wmo = (code: number | null | undefined) =>
  (isNum(code) && WMO_MAP[code]) || { condition: 'Unknown', icon: '🌡️' };

// Typical days have no single weather code — describe the odds instead.
function typicalCondition(chance: number, tMax: number, sunFrac: number | null): { condition: string; code: number } {
  if (tMax <= 2 && chance >= 30) return { condition: 'Snow possible',    code: 71 };
  if (chance >= 60)              return { condition: 'Often rainy',      code: 61 };
  if (chance >= 30)              return { condition: 'Showers possible', code: 80 };
  if (sunFrac == null)           return { condition: 'Typical day',      code: 2 };
  if (sunFrac >= 0.65)           return { condition: 'Mostly sunny',     code: 1 };
  if (sunFrac >= 0.4)            return { condition: 'Sunny spells',     code: 2 };
  return { condition: 'Mostly cloudy', code: 3 };
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

async function getJson(url: URL): Promise<any> {
  const res  = await fetch(url.toString(), { cache: 'no-store' });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) throw new Error(data?.reason ?? `Open-Meteo HTTP ${res.status}`);
  return data;
}

function omUrl(base: string, point: { lat: number; lon: number }, params: Record<string, string>): URL {
  const url = new URL(base);
  url.searchParams.set('latitude',  String(point.lat));
  url.searchParams.set('longitude', String(point.lon));
  url.searchParams.set('timezone',  'auto');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}

// Hourly arrays regrouped as date → variable → 24 local hours. Keyed by the
// timestamp's own hour, so a DST gap stays null rather than shifting the day.
type HourCols = Record<string, (number | null)[]>;

function groupHourly(hourly: any): Map<string, HourCols> {
  const out = new Map<string, HourCols>();
  if (!hourly?.time) return out;
  const keys = Object.keys(hourly).filter(k => k !== 'time');
  (hourly.time as string[]).forEach((t, i) => {
    const date = t.slice(0, 10);
    let cols = out.get(date);
    if (!cols) {
      cols = Object.fromEntries(keys.map(k => [k, Array<number | null>(24).fill(null)]));
      out.set(date, cols);
    }
    const h = +t.slice(11, 13);
    for (const k of keys) {
      const v = hourly[k]?.[i];
      cols[k][h] = isNum(v) ? v : null;
    }
  });
  return out;
}

// Mean apparent temperature 20:00–22:00 — what going out to dinner feels like.
const eveningOf = (feels: (number | null)[] | undefined) => mean(feels?.slice(20, 23) ?? []);

const hhmm = (iso: unknown) => (typeof iso === 'string' && iso.length >= 16 ? iso.slice(11, 16) : null);
const col  = (xs: (number | null)[] | undefined, f: (v: number) => number | null = v => v) =>
  Array.from({ length: 24 }, (_, h) => (isNum(xs?.[h]) ? f(xs![h] as number) : null));

// ─── Forecast ─────────────────────────────────────────────────────────────────

interface Point { lat: number; lon: number }

async function fetchForecastDays(point: Point, start: string, end: string, city: string) {
  const data = await getJson(omUrl('https://api.open-meteo.com/v1/forecast', point, {
    daily: [
      'weather_code', 'temperature_2m_max', 'temperature_2m_min',
      'apparent_temperature_max', 'apparent_temperature_min',
      'precipitation_sum', 'precipitation_probability_max', 'precipitation_hours',
      'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant',
      'uv_index_max', 'sunshine_duration', 'sunrise', 'sunset',
    ].join(','),
    hourly: [
      'temperature_2m', 'apparent_temperature', 'weather_code',
      'precipitation_probability', 'precipitation', 'cloud_cover',
      'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m',
      'relative_humidity_2m', 'uv_index', 'is_day',
    ].join(','),
    start_date: start,
    end_date:   end,
  }));
  const d      = data.daily;
  const hourly = groupHourly(data.hourly);

  const days: DayWeather[] = [];
  (d.time as string[]).forEach((date, i) => {
    const tMax = round(d.temperature_2m_max[i]);
    const tMin = round(d.temperature_2m_min[i]);
    if (tMax == null || tMin == null) return;    // gap → filled from averages
    const code = isNum(d.weather_code[i]) ? d.weather_code[i] : null;
    const sun  = d.sunshine_duration[i];
    const h    = hourly.get(date);
    days.push({
      date, label: formatLabel(date), city,
      ...wmo(code), code,
      tempMax: tMax, tempMin: tMin,
      feelsMax:      round(d.apparent_temperature_max[i]),
      feelsMin:      round(d.apparent_temperature_min[i]),
      feelsEvening:  round(eveningOf(h?.apparent_temperature)),
      chanceOfRain:  isNum(d.precipitation_probability_max[i]) ? d.precipitation_probability_max[i] : null,
      precipMm:      one(d.precipitation_sum[i]) ?? 0,
      windKph:       round(d.wind_speed_10m_max[i]),
      uvIndex:       one(d.uv_index_max[i]),
      sunshineHours: isNum(sun) ? one(sun / 3600) : null,
      daylightHours: one(daylightHours(point.lat, date)),
      source:        'forecast',
      sunrise:       hhmm(d.sunrise[i]),
      sunset:        hhmm(d.sunset[i]),
      gustKph:       round(d.wind_gusts_10m_max[i]),
      windDir:       round(d.wind_direction_10m_dominant[i]),
      rainHours:     round(d.precipitation_hours[i]),
      humidity:      round(mean(h?.relative_humidity_2m ?? [])),
      hours: h ? {
        temp:  col(h.temperature_2m, Math.round),
        feels: col(h.apparent_temperature, Math.round),
        code:  col(h.weather_code),
        rain:  col(h.precipitation_probability),
        mm:    col(h.precipitation, v => Math.round(v * 10) / 10),
        cloud: col(h.cloud_cover, Math.round),
        wind:  col(h.wind_speed_10m, Math.round),
        gust:  col(h.wind_gusts_10m, Math.round),
        dir:   col(h.wind_direction_10m, Math.round),
        rh:    col(h.relative_humidity_2m, Math.round),
        uv:    col(h.uv_index, v => Math.round(v * 10) / 10),
        isDay: col(h.is_day),
      } : null,
    });
  });
  return { days, timezone: (data.timezone as string) ?? null };
}

// ─── Typical days — pooled ERA5 records ───────────────────────────────────────

interface Sample {
  tMax: number | null; tMin: number | null;
  fMax: number | null; fMin: number | null; fEve: number | null;
  precip: number | null; wind: number | null; sun: number | null;
  sunrise: string | null; sunset: string | null;
  hours: HourCols | null;
}

async function fetchArchiveWindow(point: Point, start: string, len: number) {
  const data = await getJson(omUrl('https://archive-api.open-meteo.com/v1/archive', point, {
    daily: [
      'temperature_2m_max', 'temperature_2m_min',
      'apparent_temperature_max', 'apparent_temperature_min',
      'precipitation_sum', 'wind_speed_10m_max', 'sunshine_duration',
      'sunrise', 'sunset',
    ].join(','),
    hourly: [
      'temperature_2m', 'apparent_temperature', 'precipitation',
      'cloud_cover', 'wind_speed_10m', 'relative_humidity_2m',
    ].join(','),
    start_date: start,
    end_date:   addDays(start, len - 1),
  }));
  const d      = data.daily;
  const hourly = groupHourly(data.hourly);
  const samples: Sample[] = (d.time as string[]).map((date, i) => {
    const h = hourly.get(date) ?? null;
    return {
      tMax: d.temperature_2m_max[i], tMin: d.temperature_2m_min[i],
      fMax: d.apparent_temperature_max[i], fMin: d.apparent_temperature_min[i],
      fEve: eveningOf(h?.apparent_temperature),
      precip: d.precipitation_sum[i], wind: d.wind_speed_10m_max[i],
      sun: isNum(d.sunshine_duration[i]) ? d.sunshine_duration[i] / 3600 : null,
      sunrise: hhmm(d.sunrise?.[i]), sunset: hhmm(d.sunset?.[i]),
      hours: h,
    };
  });
  return { samples, timezone: (data.timezone as string) ?? null };
}

// Typical hours have no weather code — describe the odds and the cloud.
function typicalHourCode(rain: number | null, cloud: number | null): number {
  if ((rain ?? 0) >= 35) return 80;
  if (cloud == null)     return 2;
  if (cloud >= 75)       return 3;
  if (cloud >= 40)       return 2;
  return cloud >= 15 ? 1 : 0;
}

// One typical day hour by hour: means across the pool, rain as how often it rained that hour.
function typicalHours(pool: Sample[], sunrise: string | null, sunset: string | null): DayHours {
  const at = (key: string, h: number) => pool.map(s => s.hours?.[key]?.[h] ?? null);
  const hours: DayHours = {
    temp: [], feels: [], code: [], rain: [], mm: [], cloud: [], wind: [],
    gust: [], dir: [], rh: [], uv: [], isDay: [],
  };
  for (let h = 0; h < 24; h++) {
    const wet   = at('precipitation', h).filter(isNum);
    const rain  = wet.length ? Math.round(100 * wet.filter(v => v >= 0.1).length / wet.length) : null;
    const cloud = round(mean(at('cloud_cover', h)));
    const mid   = `${String(h).padStart(2, '0')}:30`;
    hours.temp.push(round(mean(at('temperature_2m', h))));
    hours.feels.push(round(mean(at('apparent_temperature', h))));
    hours.rain.push(rain);
    hours.cloud.push(cloud);
    hours.wind.push(round(mean(at('wind_speed_10m', h))));
    hours.rh.push(round(mean(at('relative_humidity_2m', h))));
    hours.code.push(typicalHourCode(rain, cloud));
    hours.isDay.push(sunrise && sunset ? (mid >= sunrise && mid < sunset ? 1 : 0) : (h >= 7 && h < 19 ? 1 : 0));
    hours.mm.push(null);
    hours.gust.push(null);
    hours.dir.push(null);
    hours.uv.push(null);
  }
  return hours;
}

async function fetchTypicalDays(point: Point, start: string, end: string, city: string) {
  const dates  = dateRange(start, end);
  const len    = dates.length + 2 * POOL_DAYS;
  const latest = addDays(todayUtc(), -ERA5_LAG_DAYS);
  const first  = +start.slice(0, 4);

  // Each year's window is shifted as a whole, so trips over New Year (or 29 Feb)
  // keep their day order instead of collapsing into an inverted range.
  const starts: string[] = [];
  for (let y = first - 1; starts.length < HISTORY_YEARS && y >= first - 40; y--) {
    const s = addDays(withYear(start, y), -POOL_DAYS);
    if (addDays(s, len - 1) <= latest) starts.push(s);
  }

  const windows = (await Promise.all(starts.map(s => fetchArchiveWindow(point, s, len).catch(() => null))))
    .filter((w): w is NonNullable<typeof w> => !!w && w.samples.length === len);
  if (!windows.length) throw new Error('Historical data unavailable');

  const days = dates.map((date, i): DayWeather => {
    const pool  = windows.flatMap(w => w.samples.slice(i, i + 2 * POOL_DAYS + 1));
    const tMax  = round(mean(pool.map(s => s.tMax))) ?? 0;
    const tMin  = round(mean(pool.map(s => s.tMin))) ?? 0;
    const rainy = pool.filter(s => isNum(s.precip)).length;
    const chance = rainy ? Math.round(100 * pool.filter(s => (s.precip ?? 0) >= 1).length / rainy) : 0;
    const light = daylightHours(point.lat, date);
    const sun   = mean(pool.map(s => s.sun));
    const typ   = typicalCondition(chance, tMax, sun != null && light > 0 ? sun / light : null);
    // Sunrise/sunset from the most recent year's same date — they barely move year to year.
    const recent = windows[0].samples[i + POOL_DAYS];
    const hours  = typicalHours(pool, recent?.sunrise ?? null, recent?.sunset ?? null);
    return {
      date, label: formatLabel(date), city,
      condition: typ.condition, icon: wmo(typ.code).icon, code: typ.code,
      tempMax: tMax, tempMin: tMin,
      feelsMax:      round(mean(pool.map(s => s.fMax))),
      feelsMin:      round(mean(pool.map(s => s.fMin))),
      feelsEvening:  round(mean(pool.map(s => s.fEve))),
      chanceOfRain:  chance,
      precipMm:      one(mean(pool.map(s => s.precip))) ?? 0,
      windKph:       round(mean(pool.map(s => s.wind))),
      uvIndex:       clearSkyUv(point.lat, date),
      sunshineHours: one(sun),
      daylightHours: one(light),
      source:        'historical',
      sunrise:       recent?.sunrise ?? null,
      sunset:        recent?.sunset ?? null,
      gustKph:       null,
      windDir:       null,
      rainHours:     round(mean(pool.map(s => s.hours?.precipitation?.filter(v => isNum(v) && v >= 0.1).length ?? null))),
      humidity:      round(mean(hours.rh)),
      hours,
    };
  });
  return { days, years: windows.length, timezone: windows[0].timezone };
}

// ─── A place's days: forecast where it reaches, typical elsewhere ─────────────

async function fetchSeries(point: Point, start: string, end: string, city: string) {
  const today  = todayUtc();
  const fcFrom = addDays(today, -PAST_FORECAST_DAYS);
  const fcTo   = addDays(today, FORECAST_HORIZON_DAYS);
  const dates  = dateRange(start, end);

  let forecast: DayWeather[] = [];
  let timezone: string | null = null;
  const fcDates = dates.filter(d => d >= fcFrom && d <= fcTo);
  if (fcDates.length) {
    try {
      const r  = await fetchForecastDays(point, fcDates[0], fcDates[fcDates.length - 1], city);
      forecast = r.days;
      timezone = r.timezone;
    } catch { /* averages below cover these dates */ }
  }

  const have    = new Set(forecast.map(d => d.date));
  const missing = dates.filter(d => !have.has(d));
  let typical: DayWeather[] = [];
  let years: number | undefined;
  if (missing.length) {
    const r = await fetchTypicalDays(point, missing[0], missing[missing.length - 1], city);
    typical  = r.days.filter(d => missing.includes(d.date));
    years    = r.years;
    timezone ??= r.timezone;
  }

  return {
    days: [...forecast, ...typical].sort((a, b) => a.date.localeCompare(b.date)),
    timezone, years,
  };
}

// ─── Current conditions ───────────────────────────────────────────────────────

async function fetchCurrent(point: Point): Promise<{ current: CurrentWeather; timezone: string | null } | null> {
  const data = await getJson(omUrl('https://api.open-meteo.com/v1/forecast', point, {
    current:       'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
    forecast_days: '1',
  }));
  const c = data.current;
  if (!c || !isNum(c.temperature_2m)) return null;
  return {
    current: {
      time:    c.time,
      temp:    Math.round(c.temperature_2m),
      feels:   Math.round(c.apparent_temperature ?? c.temperature_2m),
      ...wmo(c.weather_code),
      code:    c.weather_code ?? 0,
      windKph: round(c.wind_speed_10m),
    },
    timezone: data.timezone ?? null,
  };
}

// ─── Sea temperature ──────────────────────────────────────────────────────────
// Marine forecast for the next week; further out (or after the trip), the same
// dates last year. Inland points come back empty — the row simply hides.

async function fetchSeaTemp(point: Point, start: string, end: string): Promise<number | null> {
  const today = todayUtc();
  const soon  = addDays(today, 6);
  let from: string;
  let to: string;
  if (start <= soon && end >= today) {
    from = start > today ? start : today;
    to   = end < soon ? end : soon;
  } else {
    const len = Math.min(dateRange(start, end).length, 14);
    let y = +start.slice(0, 4) - 1;
    from = withYear(start, y);
    if (addDays(from, len - 1) >= today) from = withYear(start, --y);
    to = addDays(from, len - 1);
  }
  try {
    const data = await getJson(omUrl('https://marine-api.open-meteo.com/v1/marine', point, {
      hourly: 'sea_surface_temperature', start_date: from, end_date: to,
    }));
    return one(mean(data.hourly?.sea_surface_temperature ?? []));
  } catch { return null; }
}

// ─── Home's monthly highs (for "days like Ballina in July") ───────────────────
// Climate barely moves, so it's fetched once per home location and kept on the user.

async function homeMonthlyHighs(user: any, point: Point): Promise<number[] | null> {
  const cached = user?.homeClimate;
  if (cached?.monthlyHighs?.length === 12 &&
      Math.abs(cached.lat - point.lat) < 0.05 && Math.abs(cached.lon - point.lon) < 0.05) {
    return cached.monthlyHighs;
  }
  const last = new Date().getUTCFullYear() - 1;
  const data = await getJson(omUrl('https://archive-api.open-meteo.com/v1/archive', point, {
    daily: 'temperature_2m_max', start_date: `${last - 4}-01-01`, end_date: `${last}-12-31`,
  }));
  const buckets: number[][] = Array.from({ length: 12 }, () => []);
  (data.daily.time as string[]).forEach((t, i) => {
    const v = data.daily.temperature_2m_max[i];
    if (isNum(v)) buckets[+t.slice(5, 7) - 1].push(v);
  });
  if (buckets.some(b => !b.length)) return null;
  const monthlyHighs = buckets.map(b => Math.round(b.reduce((a, c) => a + c, 0) / b.length));
  if (user?._id) {
    await User.updateOne({ _id: user._id }, {
      homeClimate: { lat: point.lat, lon: point.lon, monthlyHighs, fetchedAt: new Date() },
    });
  }
  return monthlyHighs;
}

// ─── Inputs + where each day's weather is for ─────────────────────────────────

interface StopInput {
  city: string; countryCode?: string; iataCode?: string;
  lat?: number; lng?: number;
  from?: string; to?: string;   // additional destinations only
}
interface StayInput { name: string; lat: number; lng: number; checkIn?: string; checkOut?: string }
interface HomeInput { city: string; countryCode?: string; lat?: number; lng?: number }

export interface WeatherInputs {
  start: string;
  end:   string;
  stops: StopInput[];           // [0] is the main destination
  stays: StayInput[];
  home:  HomeInput | null;
}

function stopInput(p: any): StopInput {
  return {
    city:        p.city,
    countryCode: p.countryCode || undefined,
    iataCode:    p.iataCode || undefined,
    lat:         isNum(p.coordinates?.lat) ? p.coordinates.lat : undefined,
    lng:         isNum(p.coordinates?.lng) ? p.coordinates.lng : undefined,
    from:        ymdOf(p.arrivalDate),
    to:          ymdOf(p.departureDate),
  };
}

export function weatherInputs(trip: any, accommodation: any[], homeLocation: any): WeatherInputs {
  return {
    start: ymdOf(trip.startDate)!,
    end:   ymdOf(trip.endDate)!,
    stops: [trip.destination, ...(trip.additionalDestinations ?? [])]
      .filter((p: any) => p?.city)
      .map(stopInput),
    stays: (accommodation ?? [])
      .filter((a: any) => isNum(a?.coordinates?.lat) && isNum(a?.coordinates?.lng) && a.status !== 'cancelled')
      .map((a: any) => ({
        name: a.name || 'your stay',
        lat: a.coordinates.lat, lng: a.coordinates.lng,
        checkIn: ymdOf(a.checkIn), checkOut: ymdOf(a.checkOut),
      })),
    home: homeLocation?.city ? {
      city:        homeLocation.city,
      countryCode: homeLocation.countryCode || undefined,
      lat:         isNum(homeLocation.coordinates?.lat) ? homeLocation.coordinates.lat : undefined,
      lng:         isNum(homeLocation.coordinates?.lng) ? homeLocation.coordinates.lng : undefined,
    } : null,
  };
}

export const weatherKey = (inputs: WeatherInputs) =>
  createHash('sha1').update(JSON.stringify({ v: WEATHER_VERSION, ...inputs })).digest('hex').slice(0, 16);

interface GeoResult { name: string; latitude: number; longitude: number; feature_code?: string }

// GeoNames feature codes for areas rather than places (island, archipelago,
// admin division, region, peninsula, mountain, park, country).
const BROAD_FEATURE = /^(ISL|ARCH|ADM|RGN|AREA|PEN|MT|PRK|RES|PCL|CONT)/;

async function searchPlaces(name: string, countryCode?: string): Promise<GeoResult[]> {
  const query = async (cc?: string) => {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', name);
    url.searchParams.set('count', '10');
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');
    if (cc) url.searchParams.set('countryCode', cc);
    try { return ((await getJson(url)).results ?? []) as GeoResult[]; } catch { return []; }
  };
  const scoped = countryCode ? await query(countryCode) : [];
  return scoped.length ? scoped : query();
}

async function resolveStopPoint(
  stop: StopInput, stopDates: string[], stays: StayInput[], singleStop: boolean,
): Promise<WeatherPlace> {
  const ref = isNum(stop.lat) && isNum(stop.lng) ? { lat: stop.lat, lon: stop.lng } : null;

  // 1. The stay — the most exact point there is. Pick the one covering the most
  //    of this stop's nights; on single-stop trips an undated stay still counts.
  const scored = stays
    .filter(s => !ref || distanceKm(ref, { lat: s.lat, lon: s.lng }) <= STAY_MAX_KM)
    .map(s => ({
      s,
      nights: s.checkIn && s.checkOut
        ? stopDates.filter(d => d >= s.checkIn! && d < s.checkOut!).length
        : 0,
      undated: !s.checkIn || !s.checkOut,
    }))
    .sort((a, b) => b.nights - a.nights);
  const stay = scored.find(x => x.nights > 0) ?? (singleStop ? scored.find(x => x.undated) : undefined);
  if (stay) return { label: stay.s.name, city: stop.city, kind: 'stay', lat: stay.s.lat, lon: stay.s.lng };

  // 2. A populated place by that name.
  const results = await searchPlaces(stop.city, stop.countryCode);
  const top = results[0];
  if (top && (top.feature_code?.startsWith('PPL') || !BROAD_FEATURE.test(top.feature_code ?? ''))) {
    return { label: top.name, city: stop.city, kind: 'city', lat: top.latitude, lon: top.longitude };
  }
  if (!top && ref) return { label: stop.city, city: stop.city, kind: 'city', ...ref };

  // 3. The name is an island, region or mountain — its centroid can sit on a
  //    peak. An airport is a real, lived-in point on the same island.
  const airport = airportByIata(stop.iataCode);
  if (airport && (!top || distanceKm({ lat: top.latitude, lon: top.longitude }, { lat: airport.lat, lon: airport.lng }) <= STAY_MAX_KM)) {
    return { label: airport.name, city: stop.city, kind: 'airport', lat: airport.lat, lon: airport.lng };
  }
  const airp = results.find(r => r.feature_code === 'AIRP');
  if (airp) return { label: airp.name, city: stop.city, kind: 'airport', lat: airp.latitude, lon: airp.longitude };
  const centre = top ? { lat: top.latitude, lon: top.longitude } : ref;
  if (centre) {
    const near = airports
      .map(a => ({ a, km: distanceKm(centre, { lat: a.lat, lon: a.lng }) }))
      .sort((x, y) => x.km - y.km)[0];
    if (near && near.km <= STAY_MAX_KM) {
      return { label: near.a.name, city: stop.city, kind: 'airport', lat: near.a.lat, lon: near.a.lng };
    }
  }

  if (ref) return { label: stop.city, city: stop.city, kind: 'city', ...ref };
  if (top) return { label: top.name, city: stop.city, kind: 'city', lat: top.latitude, lon: top.longitude };
  throw new Error(`Could not locate "${stop.city}"`);
}

async function resolveHomePoint(home: HomeInput): Promise<Point | null> {
  if (isNum(home.lat) && isNum(home.lng)) return { lat: home.lat, lon: home.lng };
  const results = await searchPlaces(home.city, home.countryCode);
  const best = results.find(r => r.feature_code?.startsWith('PPL')) ?? results[0];
  return best ? { lat: best.latitude, lon: best.longitude } : null;
}

// ─── PUBLIC: fetch ────────────────────────────────────────────────────────────

export async function fetchTripWeather(inputs: WeatherInputs, user?: any): Promise<WeatherResult> {
  const { start, end, stops } = inputs;
  if (!stops.length) throw new Error('No destination city on trip');
  const dates = start && end ? dateRange(start, end) : [];
  if (!dates.length) throw new Error('Trip has no valid dates');

  // Day → stop: the additional destination whose dates cover it, else the main one.
  const stopOf = (d: string) => {
    for (let i = 1; i < stops.length; i++) {
      const s = stops[i];
      if (s.from && d >= s.from && (!s.to || d < s.to)) return i;
    }
    return 0;
  };
  const assign = dates.map(stopOf);
  const used   = [...new Set(assign)];

  const points = new Map<number, WeatherPlace>();
  await Promise.all(used.map(async i => {
    points.set(i, await resolveStopPoint(stops[i], dates.filter((_, k) => assign[k] === i), inputs.stays, used.length === 1));
  }));

  // Consecutive days at the same stop fetch together.
  const runs: { stop: number; from: string; to: string }[] = [];
  dates.forEach((d, k) => {
    const last = runs[runs.length - 1];
    if (last && last.stop === assign[k]) last.to = d;
    else runs.push({ stop: assign[k], from: d, to: d });
  });

  const counts = used.map(i => ({ i, n: assign.filter(a => a === i).length })).sort((a, b) => b.n - a.n);
  const main   = points.get(counts[0].i)!;
  const today  = todayUtc();
  const nowAt  = today >= start && today <= end ? points.get(assign[dates.indexOf(today)]) ?? main : main;

  const homePoint = inputs.home ? await resolveHomePoint(inputs.home).catch(() => null) : null;

  const [series, homeSeries, current, seaTemp, homeSea, monthlyHighs] = await Promise.all([
    Promise.all(runs.map(r => fetchSeries(points.get(r.stop)!, r.from, r.to, stops[r.stop].city))),
    homePoint ? fetchSeries(homePoint, start, end, inputs.home!.city).catch(() => null) : null,
    fetchCurrent(nowAt).catch(() => null),
    fetchSeaTemp(main, start, end),
    homePoint ? fetchSeaTemp(homePoint, start, end) : null,
    homePoint ? homeMonthlyHighs(user, homePoint).catch(() => null) : null,
  ]);

  const days = series.flatMap(s => s.days);
  const sources = new Set(days.map(d => d.source));
  const places = runs
    .map(r => points.get(r.stop)!)
    .filter((p, i, all) => all.indexOf(p) === i);

  return {
    version:   WEATHER_VERSION,
    key:       weatherKey(inputs),
    fetchedAt: new Date().toISOString(),
    mode:      sources.size > 1 ? 'mixed' : sources.has('historical') ? 'historical' : 'forecast',
    timezone:  current?.timezone ?? series[0]?.timezone ?? null,
    places,
    days,
    historicalYears: series.map(s => s.years).find(isNum),
    current:   current?.current,
    seaTemp,
    home: homeSeries?.days.length ? {
      city:         inputs.home!.city,
      // Home only feeds the comparison — its hourly detail would just bloat the trip doc.
      days:         homeSeries.days.map(({ hours: _hours, ...d }) => d),
      seaTemp:      homeSea,
      monthlyHighs,
    } : undefined,
    homeUnset: !inputs.home,
  };
}

// ─── PUBLIC: cached read for a trip ───────────────────────────────────────────

function isFresh(w: WeatherResult, inputs: WeatherInputs): boolean {
  const age = Date.now() - Date.parse(w.fetchedAt);
  if (!(age >= 0)) return false;
  if (age < HOUR_MS) return true;   // never hammer the API, even when something below failed

  const today = todayUtc();
  // A typical day the forecast window has since reached is stale whatever its age.
  const fcFrom = addDays(today, -PAST_FORECAST_DAYS);
  const fcTo   = addDays(today, FORECAST_HORIZON_DAYS);
  if (w.days.some(d => d.source === 'historical' && d.date >= fcFrom && d.date <= fcTo)) return false;

  const active = today >= addDays(inputs.start, -1) && today <= inputs.end;
  const ttl = active ? HOUR_MS
    : w.days.some(d => d.source === 'forecast') ? 6 * HOUR_MS
    : 7 * DAY_MS;
  return age < ttl;
}

/**
 * The trip's weather, from cache when it's still valid for the trip as it is
 * now — dates, stops, stays and home all feed the cache key, so editing any of
 * them refetches instead of serving the old trip's weather.
 */
export async function getTripWeather(
  trip: any, user: any, opts: { force?: boolean } = {},
): Promise<{ weather: WeatherResult; cached: boolean }> {
  const logistics = await TripLogistics.findOne({ tripId: trip._id }).select('accommodation').lean() as any;
  const inputs    = weatherInputs(trip, logistics?.accommodation ?? [], user?.homeLocation);
  const cached    = trip.weather as WeatherResult | undefined;

  if (!opts.force && cached?.version === WEATHER_VERSION && cached.key === weatherKey(inputs) && isFresh(cached, inputs)) {
    return { weather: cached, cached: true };
  }

  const weather = await fetchTripWeather(inputs, user);
  await Trip.findByIdAndUpdate(trip._id, { weather });
  return { weather, cached: false };
}
