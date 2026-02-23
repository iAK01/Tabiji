// src/lib/weather.ts
// Handles all weather fetching logic.
// Three modes:
//   forecast   — trip starts within 16 days → real Open-Meteo forecast (+ WeatherAPI.com for first 3 days)
//   historical — trip starts beyond 16 days → averaged actuals from same dates in prior 3 years
//   current    — always fetchable, today + next 3 days for the destination city

export type WeatherSource = 'forecast' | 'historical' | 'weatherapi';

export interface DayWeather {
  date: string;           // ISO date string YYYY-MM-DD
  label: string;          // e.g. "Mon, 7 May"
  condition: string;      // e.g. "Partly cloudy"
  icon: string;           // emoji
  tempAvg: number;        // °C
  tempMax: number;
  tempMin: number;
  chanceOfRain: number;   // 0-100
  precipMm: number;
  windKph: number | null;
  humidity: number | null;
  uvIndex: number | null;
  source: WeatherSource;
}

export interface WeatherResult {
  mode: 'forecast' | 'historical' | 'current';
  days: DayWeather[];
  fetchedAt: string;      // ISO timestamp
  forecastAvailableFrom?: string; // ISO date — when real forecast kicks in
  historicalYears?: number[];     // which prior years were averaged
  currentWeather?: DayWeather[];  // always-present bonus section
  summary?: string;       // generated one-liner e.g. "Mostly sunny, mild, one rainy day"
  packingNotes?: string[]; // e.g. ["Bring an umbrella — rain likely on day 3"]
}

// ─── Open-Meteo WMO weather code → readable condition + emoji ───────────────
const WMO_MAP: Record<number, { condition: string; icon: string }> = {
  0:  { condition: 'Clear sky',       icon: '☀️' },
  1:  { condition: 'Mainly clear',    icon: '🌤️' },
  2:  { condition: 'Partly cloudy',   icon: '⛅' },
  3:  { condition: 'Overcast',        icon: '☁️' },
  45: { condition: 'Foggy',           icon: '🌫️' },
  48: { condition: 'Icy fog',         icon: '🌫️' },
  51: { condition: 'Light drizzle',   icon: '🌦️' },
  53: { condition: 'Drizzle',         icon: '🌧️' },
  55: { condition: 'Heavy drizzle',   icon: '🌧️' },
  61: { condition: 'Light rain',      icon: '🌧️' },
  63: { condition: 'Rain',            icon: '🌧️' },
  65: { condition: 'Heavy rain',      icon: '🌧️' },
  71: { condition: 'Light snow',      icon: '🌨️' },
  73: { condition: 'Snow',            icon: '❄️' },
  75: { condition: 'Heavy snow',      icon: '❄️' },
  77: { condition: 'Snow grains',     icon: '🌨️' },
  80: { condition: 'Rain showers',    icon: '🌦️' },
  81: { condition: 'Heavy showers',   icon: '🌧️' },
  82: { condition: 'Violent showers', icon: '⛈️' },
  85: { condition: 'Snow showers',    icon: '🌨️' },
  86: { condition: 'Heavy snow showers', icon: '❄️' },
  95: { condition: 'Thunderstorm',    icon: '⛈️' },
  96: { condition: 'Thunderstorm + hail', icon: '⛈️' },
  99: { condition: 'Thunderstorm + hail', icon: '⛈️' },
};

function wmoLookup(code: number): { condition: string; icon: string } {
  return WMO_MAP[code] ?? { condition: 'Unknown', icon: '🌡️' };
}

function formatLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IE', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

// ─── Geocode city name → lat/lon via Open-Meteo geocoding API ───────────────
async function geocode(city: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );
    const data = await res.json();
    if (!data.results?.length) return null;
    return { lat: data.results[0].latitude, lon: data.results[0].longitude };
  } catch {
    return null;
  }
}

// ─── Open-Meteo forecast (up to 16 days) ────────────────────────────────────
async function fetchForecast(lat: number, lon: number, startDate: string, endDate: string): Promise<DayWeather[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('daily', [
    'weathercode', 'temperature_2m_max', 'temperature_2m_min',
    'precipitation_sum', 'precipitation_probability_max',
    'windspeed_10m_max', 'uv_index_max',
  ].join(','));
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('timezone', 'auto');

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!data.daily) throw new Error('Open-Meteo forecast failed');

  return data.daily.time.map((date: string, i: number) => {
    const code = data.daily.weathercode[i];
    const { condition, icon } = wmoLookup(code);
    const tMax = Math.round(data.daily.temperature_2m_max[i]);
    const tMin = Math.round(data.daily.temperature_2m_min[i]);
    return {
      date,
      label: formatLabel(date),
      condition,
      icon,
      tempAvg: Math.round((tMax + tMin) / 2),
      tempMax: tMax,
      tempMin: tMin,
      chanceOfRain: data.daily.precipitation_probability_max[i] ?? 0,
      precipMm: Math.round((data.daily.precipitation_sum[i] ?? 0) * 10) / 10,
      windKph: data.daily.windspeed_10m_max[i] ? Math.round(data.daily.windspeed_10m_max[i]) : null,
      humidity: null,
      uvIndex: data.daily.uv_index_max[i] ?? null,
      source: 'forecast' as WeatherSource,
    };
  });
}

// ─── WeatherAPI.com forecast (first 3 days, more accurate) ──────────────────
async function fetchWeatherAPI(city: string, days: number): Promise<DayWeather[]> {
  const key = process.env.WEATHER_API_KEY;
  if (!key) return [];
  try {
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${encodeURIComponent(city)}&days=${days}&aqi=no&alerts=no`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) return [];

    return data.forecast.forecastday.map((day: any) => {
      const condition = day.day.condition.text;
      const tMax = Math.round(day.day.maxtemp_c);
      const tMin = Math.round(day.day.mintemp_c);
      return {
        date: day.date,
        label: formatLabel(day.date),
        condition,
        icon: iconFromConditionText(condition, Math.round(day.day.avgtemp_c)),
        tempAvg: Math.round(day.day.avgtemp_c),
        tempMax: tMax,
        tempMin: tMin,
        chanceOfRain: day.day.daily_chance_of_rain ?? 0,
        precipMm: Math.round((day.day.totalprecip_mm ?? 0) * 10) / 10,
        windKph: Math.round(day.day.maxwind_kph),
        humidity: day.day.avghumidity ?? null,
        uvIndex: day.day.uv ?? null,
        source: 'weatherapi' as WeatherSource,
      };
    });
  } catch {
    return [];
  }
}

function iconFromConditionText(condition: string, temp: number): string {
  const c = condition.toLowerCase();
  if (c.includes('thunder')) return '⛈️';
  if (c.includes('snow') || c.includes('sleet') || c.includes('blizzard')) return '❄️';
  if (c.includes('rain') || c.includes('drizzle')) return '🌧️';
  if (c.includes('shower')) return '🌦️';
  if (c.includes('fog') || c.includes('mist')) return '🌫️';
  if (c.includes('overcast')) return '☁️';
  if (c.includes('cloudy')) return '⛅';
  if (c.includes('sunny') || c.includes('clear')) return temp > 30 ? '🌞' : '☀️';
  return '🌤️';
}

// ─── Open-Meteo historical archive ──────────────────────────────────────────
async function fetchHistoricalYear(
  lat: number, lon: number, startDate: string, endDate: string, year: number
): Promise<DayWeather[] | null> {
  // Shift dates to target year
  const shiftDate = (d: string, y: number) => `${y}${d.slice(4)}`;
  const start = shiftDate(startDate, year);
  const end = shiftDate(endDate, year);

  try {
    const url = new URL('https://archive-api.open-meteo.com/v1/archive');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('daily', [
      'weathercode', 'temperature_2m_max', 'temperature_2m_min',
      'precipitation_sum',
    ].join(','));
    url.searchParams.set('start_date', start);
    url.searchParams.set('end_date', end);
    url.searchParams.set('timezone', 'auto');

    const res = await fetch(url.toString());
    const data = await res.json();
    if (!data.daily) return null;

    return data.daily.time.map((date: string, i: number) => {
      const code = data.daily.weathercode[i];
      const { condition, icon } = wmoLookup(code);
      const tMax = Math.round(data.daily.temperature_2m_max[i]);
      const tMin = Math.round(data.daily.temperature_2m_min[i]);
      return {
        date,
        label: formatLabel(date),
        condition,
        icon,
        tempAvg: Math.round((tMax + tMin) / 2),
        tempMax: tMax,
        tempMin: tMin,
        chanceOfRain: 0, // filled after averaging
        precipMm: Math.round((data.daily.precipitation_sum[i] ?? 0) * 10) / 10,
        windKph: null,
        humidity: null,
        uvIndex: null,
        source: 'historical' as WeatherSource,
      };
    });
  } catch {
    return null;
  }
}

// Average multiple years of historical data into one representative set
async function fetchHistoricalAverage(
  lat: number, lon: number, startDate: string, endDate: string
): Promise<{ days: DayWeather[]; years: number[] }> {
  const currentYear = new Date().getFullYear();
  const yearsToFetch = [currentYear - 1, currentYear - 2, currentYear - 3];

  const results = await Promise.all(
    yearsToFetch.map(y => fetchHistoricalYear(lat, lon, startDate, endDate, y))
  );

  const validResults = results.filter((r): r is DayWeather[] => r !== null && r.length > 0);
  const usedYears = yearsToFetch.filter((_, i) => results[i] !== null && results[i]!.length > 0);

  if (validResults.length === 0) throw new Error('Historical data unavailable');

  // Use the trip date labels (not the historical years' dates)
  const tripDates = generateDateRange(startDate, endDate);

  const averaged: DayWeather[] = tripDates.map((tripDate, i) => {
    const daySlices = validResults.map(yr => yr[i]).filter(Boolean);
    if (!daySlices.length) return null;

    const tMax = Math.round(daySlices.reduce((s, d) => s + d.tempMax, 0) / daySlices.length);
    const tMin = Math.round(daySlices.reduce((s, d) => s + d.tempMin, 0) / daySlices.length);
    const precip = daySlices.reduce((s, d) => s + d.precipMm, 0) / daySlices.length;
    // Rain chance derived from how many years had precipitation
    const rainyDays = daySlices.filter(d => d.precipMm > 1).length;
    const chanceOfRain = Math.round((rainyDays / daySlices.length) * 100);

    // Pick most common condition (modal)
    const conditionCounts: Record<string, number> = {};
    daySlices.forEach(d => { conditionCounts[d.condition] = (conditionCounts[d.condition] ?? 0) + 1; });
    const condition = Object.entries(conditionCounts).sort((a, b) => b[1] - a[1])[0][0];
    const { icon } = wmoLookup(
      Object.entries(WMO_MAP).find(([, v]) => v.condition === condition)?.[0] as unknown as number ?? 2
    );

    return {
      date: tripDate,
      label: formatLabel(tripDate),
      condition,
      icon,
      tempAvg: Math.round((tMax + tMin) / 2),
      tempMax: tMax,
      tempMin: tMin,
      chanceOfRain,
      precipMm: Math.round(precip * 10) / 10,
      windKph: null as number | null,
      humidity: null as number | null,
      uvIndex: null as number | null,
      source: 'historical' as WeatherSource,
    } as DayWeather;
  }).filter((d): d is DayWeather => d !== null);

  return { days: averaged, years: usedYears };
}

// ─── Generate ISO date range array ──────────────────────────────────────────
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ─── Generate summary + packing notes ───────────────────────────────────────
function generateSummary(days: DayWeather[], mode: 'forecast' | 'historical'): {
  summary: string;
  packingNotes: string[];
} {
  const avgTemp = Math.round(days.reduce((s, d) => s + d.tempAvg, 0) / days.length);
  const maxRain = Math.max(...days.map(d => d.chanceOfRain));
  const rainyDays = days.filter(d => d.chanceOfRain > 40 || d.precipMm > 2).length;
  const coldDays = days.filter(d => d.tempAvg < 10).length;
  const hotDays = days.filter(d => d.tempAvg > 25).length;
  const snowDays = days.filter(d => d.condition.toLowerCase().includes('snow')).length;

  const conditions: string[] = [];
  if (hotDays > days.length / 2) conditions.push('hot');
  else if (coldDays > days.length / 2) conditions.push('cold');
  else if (avgTemp >= 15) conditions.push('mild');
  else conditions.push('cool');

  if (rainyDays === 0 && maxRain < 20) conditions.unshift('sunny');
  else if (rainyDays > days.length / 2) conditions.unshift('rainy');
  else if (rainyDays > 0) conditions.unshift('mixed');

  const modeNote = mode === 'historical' ? ' (based on historical averages)' : '';
  const summary = `${conditions.join(', ')} weather expected — avg ${avgTemp}°C${modeNote}`;

  const packingNotes: string[] = [];
  if (rainyDays > 0) packingNotes.push(`Rain likely on ${rainyDays} day${rainyDays > 1 ? 's' : ''} — pack an umbrella or waterproof jacket`);
  if (coldDays > 0) packingNotes.push(`Temperatures drop below 10°C — warm layers recommended`);
  if (hotDays > 0) packingNotes.push(`Hot days expected above 25°C — sunscreen, hat, light clothing`);
  if (snowDays > 0) packingNotes.push(`Snow possible — waterproof footwear advisable`);
  const tempRange = Math.max(...days.map(d => d.tempMax)) - Math.min(...days.map(d => d.tempMin));
  if (tempRange > 12) packingNotes.push(`Temperature swings of ${tempRange}°C — pack layers for both warm and cool`);

  return { summary, packingNotes };
}

// ─── PUBLIC: fetch weather for a trip ───────────────────────────────────────
export async function fetchTripWeather(
  city: string,
  startDate: string,
  endDate: string
): Promise<WeatherResult> {
  const coords = await geocode(city);
  if (!coords) throw new Error(`Could not geocode "${city}"`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tripStart = new Date(startDate);
  const daysUntilTrip = Math.round((tripStart.getTime() - today.getTime()) / 86400000);

  let tripDays: DayWeather[] = [];
  let mode: 'forecast' | 'historical';
  let historicalYears: number[] | undefined;
  let forecastAvailableFrom: string | undefined;

  if (daysUntilTrip <= 16) {
    // ── REAL FORECAST ──
    mode = 'forecast';
    const openMeteoDays = await fetchForecast(coords.lat, coords.lon, startDate, endDate);

    // Overlay WeatherAPI.com for first 3 days if trip starts within 3 days
    if (daysUntilTrip <= 3 && process.env.WEATHER_API_KEY) {
      const waDays = await fetchWeatherAPI(city, Math.min(3 - daysUntilTrip + 1, openMeteoDays.length));
      const waMap = new Map(waDays.map(d => [d.date, d]));
      tripDays = openMeteoDays.map(d => waMap.get(d.date) ?? d);
    } else {
      tripDays = openMeteoDays;
    }
  } else {
    // ── HISTORICAL AVERAGES ──
    mode = 'historical';
    const result = await fetchHistoricalAverage(coords.lat, coords.lon, startDate, endDate);
    tripDays = result.days;
    historicalYears = result.years;
    // Forecast will be available 16 days before trip
    const forecastDate = new Date(tripStart);
    forecastDate.setDate(forecastDate.getDate() - 16);
    forecastAvailableFrom = forecastDate.toISOString().split('T')[0];
  }

  // ── CURRENT WEATHER (always, regardless of trip dates) ──
  const currentEnd = new Date(today);
  currentEnd.setDate(today.getDate() + 2); // today + next 2 days
  const currentStart = today.toISOString().split('T')[0];
  const currentEndStr = currentEnd.toISOString().split('T')[0];

  let currentWeather: DayWeather[] = [];
  try {
    if (process.env.WEATHER_API_KEY && daysUntilTrip > 3) {
      // Use WeatherAPI for current conditions — most accurate for right now
      currentWeather = await fetchWeatherAPI(city, 3);
    }
    if (currentWeather.length === 0) {
      currentWeather = await fetchForecast(coords.lat, coords.lon, currentStart, currentEndStr);
    }
  } catch {
    // Current weather is a bonus — silently skip if it fails
  }

  const { summary, packingNotes } = generateSummary(tripDays, mode);

  return {
    mode,
    days: tripDays,
    fetchedAt: new Date().toISOString(),
    forecastAvailableFrom,
    historicalYears,
    currentWeather: currentWeather.length > 0 ? currentWeather : undefined,
    summary,
    packingNotes,
  };
}