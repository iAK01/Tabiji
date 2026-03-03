// src/lib/weather.ts
//
// Three-mode weather strategy:
//   forecast   — trip within 16 days → Open-Meteo forecast + WeatherAPI overlay
//   historical — trip beyond 16 days → 5-year ERA5 archive average
//   current    — always → today + 2 days for destination
//
// Home comparison:
//   Parallel historical fetch for user's home city using the same trip dates.
//   Generates human-readable deltas — temp, rain, wind, day/night feel.
//
// Climate normals (no API key required):
//   Open-Meteo Climate API — climate-api.open-meteo.com — free, no key.
//   EC_Earth3P_HR model (high-res CMIP6). Cross-checks ERA5 historical averaging.

export type WeatherSource = 'forecast' | 'historical' | 'weatherapi' | 'climate';

export interface DayWeather {
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
  source: WeatherSource;
}

export interface HomeComparison {
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

export interface WeatherResult {
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
    source: 'EC_Earth3P_HR';
    note: string;
  };
}

// ─── WMO code map ───────────────────────────────────────────────────────────
const WMO_MAP: Record<number, { condition: string; icon: string }> = {
  0:  { condition: 'Clear sky',            icon: '☀️' },
  1:  { condition: 'Mainly clear',         icon: '🌤️' },
  2:  { condition: 'Partly cloudy',        icon: '⛅' },
  3:  { condition: 'Overcast',             icon: '☁️' },
  45: { condition: 'Foggy',               icon: '🌫️' },
  48: { condition: 'Icy fog',             icon: '🌫️' },
  51: { condition: 'Light drizzle',       icon: '🌦️' },
  53: { condition: 'Drizzle',             icon: '🌧️' },
  55: { condition: 'Heavy drizzle',       icon: '🌧️' },
  61: { condition: 'Light rain',          icon: '🌧️' },
  63: { condition: 'Rain',               icon: '🌧️' },
  65: { condition: 'Heavy rain',          icon: '🌧️' },
  71: { condition: 'Light snow',          icon: '🌨️' },
  73: { condition: 'Snow',               icon: '❄️' },
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

function wmoLookup(code: number) {
  return WMO_MAP[code] ?? { condition: 'Unknown', icon: '🌡️' };
}

function formatLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IE', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end     = new Date(endDate);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ─── Geocode ────────────────────────────────────────────────────────────────
async function geocode(city: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res  = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );
    const data = await res.json();
    if (!data.results?.length) return null;
    return { lat: data.results[0].latitude, lon: data.results[0].longitude };
  } catch { return null; }
}

// ─── Open-Meteo forecast (up to 16 days) ───────────────────────────────────
async function fetchForecast(
  lat: number, lon: number, startDate: string, endDate: string
): Promise<DayWeather[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude',  String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('daily', [
    'weathercode', 'temperature_2m_max', 'temperature_2m_min',
    'precipitation_sum', 'precipitation_probability_max',
    'windspeed_10m_max', 'uv_index_max',
  ].join(','));
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date',   endDate);
  url.searchParams.set('timezone', 'auto');

  const res  = await fetch(url.toString());
  const data = await res.json();
  if (!data.daily) throw new Error('Open-Meteo forecast failed');

  return data.daily.time.map((date: string, i: number) => {
    const { condition, icon } = wmoLookup(data.daily.weathercode[i]);
    const tMax = Math.round(data.daily.temperature_2m_max[i]);
    const tMin = Math.round(data.daily.temperature_2m_min[i]);
    return {
      date, label: formatLabel(date), condition, icon,
      tempAvg: Math.round((tMax + tMin) / 2), tempMax: tMax, tempMin: tMin,
      chanceOfRain: data.daily.precipitation_probability_max[i] ?? 0,
      precipMm:     Math.round((data.daily.precipitation_sum[i] ?? 0) * 10) / 10,
      windKph:      data.daily.windspeed_10m_max[i] ? Math.round(data.daily.windspeed_10m_max[i]) : null,
      humidity: null,
      uvIndex:  data.daily.uv_index_max[i] ?? null,
      source:   'forecast' as WeatherSource,
    };
  });
}

// ─── WeatherAPI.com overlay (first 3 days, highest accuracy) ───────────────
// FIX: accepts lat/lon and uses coordinates in the q parameter instead of
// a city name string. This prevents WeatherAPI resolving "Ballina" to
// Ballina, NSW, Australia instead of Ballina, Co. Mayo, Ireland.
async function fetchWeatherAPI(
  lat: number, lon: number, days: number
): Promise<DayWeather[]> {
  const key = process.env.WEATHER_API_KEY;
  if (!key) return [];
  try {
    const q   = `${lat},${lon}`;
    const res  = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${encodeURIComponent(q)}&days=${days}&aqi=no&alerts=no`
    );
    const data = await res.json();
    if (data.error) return [];
    return data.forecast.forecastday.map((day: any) => {
      const condition = day.day.condition.text;
      const tMax = Math.round(day.day.maxtemp_c);
      const tMin = Math.round(day.day.mintemp_c);
      return {
        date: day.date, label: formatLabel(day.date),
        condition, icon: iconFromText(condition, Math.round(day.day.avgtemp_c)),
        tempAvg: Math.round(day.day.avgtemp_c), tempMax: tMax, tempMin: tMin,
        chanceOfRain: day.day.daily_chance_of_rain ?? 0,
        precipMm:     Math.round((day.day.totalprecip_mm ?? 0) * 10) / 10,
        windKph:      Math.round(day.day.maxwind_kph),
        humidity:     day.day.avghumidity ?? null,
        uvIndex:      day.day.uv ?? null,
        source:       'weatherapi' as WeatherSource,
      };
    });
  } catch { return []; }
}

function iconFromText(condition: string, temp: number): string {
  const c = condition.toLowerCase();
  if (c.includes('thunder'))                        return '⛈️';
  if (c.includes('snow') || c.includes('blizzard')) return '❄️';
  if (c.includes('sleet'))                          return '🌨️';
  if (c.includes('rain') || c.includes('drizzle'))  return '🌧️';
  if (c.includes('shower'))                         return '🌦️';
  if (c.includes('fog') || c.includes('mist'))      return '🌫️';
  if (c.includes('overcast'))                       return '☁️';
  if (c.includes('cloudy'))                         return '⛅';
  if (c.includes('sunny') || c.includes('clear'))   return temp > 30 ? '🌞' : '☀️';
  return '🌤️';
}

// ─── ERA5 archive — single year ─────────────────────────────────────────────
async function fetchHistoricalYear(
  lat: number, lon: number, startDate: string, endDate: string, year: number
): Promise<DayWeather[] | null> {
  const shift = (d: string, y: number) => `${y}${d.slice(4)}`;
  try {
    const url = new URL('https://archive-api.open-meteo.com/v1/archive');
    url.searchParams.set('latitude',  String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('daily', [
      'weathercode', 'temperature_2m_max', 'temperature_2m_min',
      'precipitation_sum', 'windspeed_10m_max',
    ].join(','));
    url.searchParams.set('start_date', shift(startDate, year));
    url.searchParams.set('end_date',   shift(endDate,   year));
    url.searchParams.set('timezone', 'auto');

    const res  = await fetch(url.toString());
    const data = await res.json();
    if (!data.daily) return null;

    return data.daily.time.map((date: string, i: number) => {
      const { condition, icon } = wmoLookup(data.daily.weathercode[i]);
      const tMax = Math.round(data.daily.temperature_2m_max[i]);
      const tMin = Math.round(data.daily.temperature_2m_min[i]);
      return {
        date, label: formatLabel(date), condition, icon,
        tempAvg: Math.round((tMax + tMin) / 2), tempMax: tMax, tempMin: tMin,
        chanceOfRain: 0, // filled after averaging
        precipMm:  Math.round((data.daily.precipitation_sum[i] ?? 0) * 10) / 10,
        windKph:   data.daily.windspeed_10m_max[i] ? Math.round(data.daily.windspeed_10m_max[i]) : null,
        humidity:  null, uvIndex: null,
        source:    'historical' as WeatherSource,
      };
    });
  } catch { return null; }
}

// 5-year ERA5 average
async function fetchHistoricalAverage(
  lat: number, lon: number, startDate: string, endDate: string
): Promise<{ days: DayWeather[]; years: number[] }> {
  const current = new Date().getFullYear();
  const yearsToFetch = [
    current - 1, current - 2, current - 3, current - 4, current - 5,
  ];

  const results = await Promise.all(
    yearsToFetch.map(y => fetchHistoricalYear(lat, lon, startDate, endDate, y))
  );

  const valid     = results.filter((r): r is DayWeather[] => r !== null && r.length > 0);
  const usedYears = yearsToFetch.filter((_, i) => results[i] !== null && results[i]!.length > 0);
  if (valid.length === 0) throw new Error('Historical data unavailable');

  const tripDates = generateDateRange(startDate, endDate);

  const averaged = tripDates.map((tripDate, i) => {
    const slices = valid.map(yr => yr[i]).filter(Boolean);
    if (!slices.length) return null;

    const tMax = Math.round(slices.reduce((s, d) => s + d.tempMax, 0) / slices.length);
    const tMin = Math.round(slices.reduce((s, d) => s + d.tempMin, 0) / slices.length);
    const precip = slices.reduce((s, d) => s + d.precipMm, 0) / slices.length;
    const chanceOfRain = Math.round((slices.filter(d => d.precipMm > 1).length / slices.length) * 100);

    const windSlices = slices.filter(d => d.windKph !== null);
    const windKph = windSlices.length
      ? Math.round(windSlices.reduce((s, d) => s + d.windKph!, 0) / windSlices.length)
      : null;

    const counts: Record<string, number> = {};
    slices.forEach(d => { counts[d.condition] = (counts[d.condition] ?? 0) + 1; });
    const condition = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const wmoEntry  = Object.entries(WMO_MAP).find(([, v]) => v.condition === condition);
    const icon      = wmoEntry ? WMO_MAP[Number(wmoEntry[0])].icon : '🌡️';

    return {
      date: tripDate, label: formatLabel(tripDate), condition, icon,
      tempAvg: Math.round((tMax + tMin) / 2), tempMax: tMax, tempMin: tMin,
      chanceOfRain, precipMm: Math.round(precip * 10) / 10,
      windKph, humidity: null, uvIndex: null,
      source: 'historical' as WeatherSource,
    } as DayWeather;
  }).filter((d): d is DayWeather => d !== null);

  return { days: averaged, years: usedYears };
}

// ─── Open-Meteo Climate API — free, no key required ─────────────────────────
export async function fetchClimateNormals(
  lat: number, lon: number, startDate: string, endDate: string
): Promise<{ avgTemp: number; avgRainDays: number } | null> {
  try {
    const refYear  = 2010;
    const refStart = `${refYear}${startDate.slice(4)}`;
    const refEnd   = `${refYear}${endDate.slice(4)}`;

    const url = new URL('https://climate-api.open-meteo.com/v1/climate');
    url.searchParams.set('latitude',   String(lat));
    url.searchParams.set('longitude',  String(lon));
    url.searchParams.set('start_date', refStart);
    url.searchParams.set('end_date',   refEnd);
    url.searchParams.set('models', 'EC_Earth3P_HR');
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum');

    const res  = await fetch(url.toString());
    const data = await res.json();
    if (!data.daily?.time?.length) return null;

    const temps = data.daily.temperature_2m_max.map((tMax: number, i: number) =>
      Math.round((tMax + data.daily.temperature_2m_min[i]) / 2)
    );
    const avgTemp  = Math.round(temps.reduce((s: number, t: number) => s + t, 0) / temps.length);
    const rainDays = data.daily.precipitation_sum.filter((p: number) => p > 1).length;

    return { avgTemp, avgRainDays: rainDays };
  } catch { return null; }
}

// ─── Count genuinely rainy days ──────────────────────────────────────────────
function countRainyDays(days: DayWeather[]): number {
  return days.filter(d => {
    if (d.source === 'historical') return d.precipMm > 2;
    return d.chanceOfRain > 40;
  }).length;
}

// ─── Summary + packing notes ────────────────────────────────────────────────
function generateSummary(days: DayWeather[], mode: 'forecast' | 'historical'): {
  summary: string; packingNotes: string[];
} {
  const tripLength  = days.length;
  const avgTempAvg  = Math.round(days.reduce((s, d) => s + d.tempAvg, 0) / tripLength);
  const peakHigh    = Math.max(...days.map(d => d.tempMax));
  const nightLow    = Math.min(...days.map(d => d.tempMin));
  const rainyDays   = countRainyDays(days);

  let tempLabel: string;
  if (peakHigh > 28)         tempLabel = 'warm to hot';
  else if (peakHigh > 22)    tempLabel = 'mild to warm';
  else if (avgTempAvg >= 15) tempLabel = 'mild';
  else if (avgTempAvg >= 10) tempLabel = 'cool';
  else                       tempLabel = 'cold';

  let rainLabel: string;
  const rainFraction = rainyDays / tripLength;
  if (rainyDays === 0)         rainLabel = 'dry';
  else if (rainFraction > 0.6) rainLabel = 'frequently rainy';
  else if (rainFraction > 0.3) rainLabel = 'mixed';
  else                         rainLabel = 'mostly dry';

  const modeNote = mode === 'historical' ? ' (historical average)' : '';
  const summary  = `${rainLabel}, ${tempLabel} — avg ${avgTempAvg}°C, highs to ${peakHigh}°C${modeNote}`;

  const packingNotes: string[] = [];

  if (rainyDays >= 2) {
    packingNotes.push(
      `Rain expected on ${rainyDays} of ${tripLength} days — a compact umbrella or waterproof jacket is worth it`
    );
  } else if (rainyDays === 1) {
    packingNotes.push(`One rainy day expected — worth having a light waterproof`);
  }

  const coldNights = days.filter(d => d.tempMin < 8).length;
  if (coldNights >= 2) {
    packingNotes.push(
      `Overnight lows drop to ${nightLow}°C — bring a layer for evenings even if the days are warm`
    );
  }

  const hotDays = days.filter(d => d.tempMax > 28).length;
  if (hotDays >= 2) {
    packingNotes.push(
      `${hotDays} days reaching above 28°C — sunscreen and light, breathable clothing essential`
    );
  }

  const snowDays = days.filter(d =>
    d.condition.toLowerCase().includes('snow') ||
    d.condition.toLowerCase().includes('blizzard')
  ).length;
  if (snowDays > 0) {
    packingNotes.push(`Snow possible on ${snowDays} day${snowDays > 1 ? 's' : ''} — waterproof footwear advisable`);
  }

  const windDays = days.filter(d => d.windKph !== null && d.windKph > 25).length;
  if (windDays >= Math.ceil(tripLength * 0.6)) {
    const avgWind = Math.round(
      days.filter(d => d.windKph !== null).reduce((s, d) => s + d.windKph!, 0) /
      days.filter(d => d.windKph !== null).length
    );
    packingNotes.push(
      `Consistently windy (avg ${avgWind} km/h) — a windproof outer layer will make a difference`
    );
  }

  return { summary, packingNotes };
}

// ─── Home comparison ────────────────────────────────────────────────────────
async function buildHomeComparison(
  homeCity:   string,
  homeCoords: { lat: number; lon: number },
  destCity:   string,
  destDays:   DayWeather[],
  startDate:  string,
  endDate:    string,
): Promise<HomeComparison | null> {
  try {
    const { days: homeDays } = await fetchHistoricalAverage(
      homeCoords.lat, homeCoords.lon, startDate, endDate
    );
    if (!homeDays.length) return null;

    const destTempAvg  = Math.round(destDays.reduce((s, d) => s + d.tempAvg, 0) / destDays.length);
    const homeTempAvg  = Math.round(homeDays.reduce((s, d) => s + d.tempAvg, 0) / homeDays.length);
    const tempDelta    = destTempAvg - homeTempAvg;

    const destRainDays = countRainyDays(destDays);
    const homeRainDays = countRainyDays(homeDays);
    const rainDelta    = destRainDays - homeRainDays;

    const hw = homeDays.filter(d => d.windKph !== null).map(d => d.windKph!);
    const dw = destDays.filter(d => d.windKph !== null).map(d => d.windKph!);
    const homeWindAvg = hw.length ? Math.round(hw.reduce((s, v) => s + v, 0) / hw.length) : null;
    const destWindAvg = dw.length ? Math.round(dw.reduce((s, v) => s + v, 0) / dw.length) : null;

    const absDelta = Math.abs(tempDelta);
    const tempDir  = tempDelta > 0 ? 'warmer' : 'cooler';
    const tempDeltaLabel = absDelta < 2
      ? 'about the same temperature'
      : `${absDelta}°C ${tempDir}`;

    const tripMonth = new Date(startDate).toLocaleDateString('en-IE', { month: 'long' });
    const rainDesc  = rainDelta > 1 ? 'wetter'
      : rainDelta < -1 ? 'drier'
      : 'with similar rainfall';
    const summary = absDelta < 2
      ? `${destCity} in ${tripMonth} has similar temperatures to ${homeCity}, ${rainDesc}`
      : `${destCity} in ${tripMonth} is typically ${tempDeltaLabel} than ${homeCity}, ${rainDesc}`;

    const insights: { icon: string; text: string }[] = [];

    if (absDelta >= 8) {
      insights.push({
        icon: '🌡️',
        text: `${absDelta}°C ${tempDir} than home — you'll feel the difference as soon as you land`,
      });
    } else if (absDelta >= 4) {
      insights.push({
        icon: '🌡️',
        text: `${absDelta}°C ${tempDir} than ${homeCity} — noticeable but not extreme`,
      });
    } else if (absDelta >= 2) {
      insights.push({
        icon: '🌡️',
        text: `Slightly ${tempDir} than home — similar but you'll notice it`,
      });
    }

    const destMaxTemp = Math.max(...destDays.map(d => d.tempMax));
    const homeMaxTemp = Math.max(...homeDays.map(d => d.tempMax));
    const dayDelta    = destMaxTemp - homeMaxTemp;
    if (dayDelta >= 6) {
      insights.push({
        icon: '☀️',
        text: `Daytime highs reach ${destMaxTemp}°C — ${dayDelta}°C hotter than home at its warmest`,
      });
    } else if (homeMaxTemp - destMaxTemp >= 6) {
      insights.push({
        icon: '☁️',
        text: `Daytime highs only reach ${destMaxTemp}°C — ${homeMaxTemp - destMaxTemp}°C cooler than at home`,
      });
    }

    const destMinTemp = Math.min(...destDays.map(d => d.tempMin));
    const homeMinTemp = Math.min(...homeDays.map(d => d.tempMin));
    const nightDelta  = destMinTemp - homeMinTemp;
    if (nightDelta >= 5) {
      insights.push({
        icon: '🌙',
        text: `Evenings stay warmer than you're used to at home — lighter layers will do`,
      });
    } else if (homeMinTemp - destMinTemp >= 5) {
      insights.push({
        icon: '🌙',
        text: `Nights drop lower than home — pack something warm for evenings out`,
      });
    }

    if (rainDelta <= -2) {
      insights.push({
        icon: '🌂',
        text: `Fewer rainy days than ${homeCity} — you can go lighter on waterproofs`,
      });
    } else if (rainDelta >= 2) {
      insights.push({
        icon: '🌂',
        text: `More rain than home — an umbrella is more important here than you might think`,
      });
    }

    if (homeWindAvg !== null && destWindAvg !== null) {
      if (homeWindAvg - destWindAvg >= 15) {
        insights.push({
          icon: '💨',
          text: `Much calmer wind than ${homeCity} — it'll feel warmer than the temperature alone suggests`,
        });
      } else if (destWindAvg - homeWindAvg >= 15) {
        insights.push({
          icon: '💨',
          text: `Windier than home — it may feel cooler than the temperature implies`,
        });
      }
    }

    if (insights.length === 0) {
      insights.push({
        icon: '✅',
        text: `Conditions are broadly similar to ${homeCity} — no major climate adjustment needed`,
      });
    }

    return {
      homeCity, destCity,
      homeTempAvg, destTempAvg, tempDelta, tempDeltaLabel,
      homeRainDays, destRainDays, rainDelta,
      homeWindAvg, destWindAvg,
      summary, insights,
      homeDays,
    };
  } catch { return null; }
}

// ─── PUBLIC: fetch trip weather ──────────────────────────────────────────────
export async function fetchTripWeather(
  city:        string,
  startDate:   string,
  endDate:     string,
  homeCity?:   string,
  homeCoords?: { lat: number; lon: number } | null,
): Promise<WeatherResult> {
  const coords = await geocode(city);
  if (!coords) throw new Error(`Could not geocode "${city}"`);

  const today     = new Date();
  today.setHours(0, 0, 0, 0);
  const tripStart = new Date(startDate);
  const daysUntil = Math.round((tripStart.getTime() - today.getTime()) / 86400000);

  let tripDays:         DayWeather[] = [];
  let mode:             'forecast' | 'historical';
  let historicalYears:  number[] | undefined;
  let forecastAvailableFrom: string | undefined;

  if (daysUntil <= 16) {
    mode = 'forecast';
    const openMeteoDays = await fetchForecast(coords.lat, coords.lon, startDate, endDate);

    // FIX: only overlay WeatherAPI for future or current-day trips (daysUntil >= 0).
    // When daysUntil < 0 the trip is already in the past — WeatherAPI forecast
    // for a past start date returns current/future data which is completely wrong.
    if (daysUntil >= 0 && daysUntil <= 3 && process.env.WEATHER_API_KEY) {
      const waDays = await fetchWeatherAPI(
        coords.lat, coords.lon,
        Math.min(3 - daysUntil + 1, openMeteoDays.length)
      );
      const waMap  = new Map(waDays.map(d => [d.date, d]));
      tripDays = openMeteoDays.map(d => waMap.get(d.date) ?? d);
    } else {
      tripDays = openMeteoDays;
    }
  } else {
    mode = 'historical';
    const result = await fetchHistoricalAverage(coords.lat, coords.lon, startDate, endDate);
    tripDays        = result.days;
    historicalYears = result.years;
    const fd = new Date(tripStart);
    fd.setDate(fd.getDate() - 16);
    forecastAvailableFrom = fd.toISOString().split('T')[0];
  }

  // Current weather — always, regardless of trip dates.
  // FIX: always try WeatherAPI for current weather — the old daysUntil > 3
  // guard meant active and imminent trips never got live chips here.
  const currentEnd = new Date(today);
  currentEnd.setDate(today.getDate() + 2);
  let currentWeather: DayWeather[] = [];
  try {
    if (process.env.WEATHER_API_KEY) {
      currentWeather = await fetchWeatherAPI(coords.lat, coords.lon, 3);
    }
    if (!currentWeather.length) {
      currentWeather = await fetchForecast(
        coords.lat, coords.lon,
        today.toISOString().split('T')[0],
        currentEnd.toISOString().split('T')[0],
      );
    }
  } catch { /* bonus section — silently skip */ }

  // Home comparison
  let homeComparison: HomeComparison | undefined;
  if (homeCity && homeCoords) {
    const c = await buildHomeComparison(homeCity, homeCoords, city, tripDays, startDate, endDate);
    if (c) homeComparison = c;
  }

  // Climate normals — Open-Meteo Climate API, free, no key required
  let climateNormals: WeatherResult['climateNormals'];
  try {
    const [destN, homeN] = await Promise.all([
      fetchClimateNormals(coords.lat, coords.lon, startDate, endDate),
      homeCoords ? fetchClimateNormals(homeCoords.lat, homeCoords.lon, startDate, endDate) : Promise.resolve(null),
    ]);
    if (destN) {
      climateNormals = {
        destAvgTemp:     destN.avgTemp,
        destAvgRainDays: destN.avgRainDays,
        homeAvgTemp:     homeN?.avgTemp,
        homeAvgRainDays: homeN?.avgRainDays,
        source:          'EC_Earth3P_HR',
        note:            'EC_Earth3P_HR climate model (CMIP6) — representative of current climate',
      };
    }
  } catch { /* supplementary — silently degrade */ }

  const { summary, packingNotes } = generateSummary(tripDays, mode);

  return {
    mode, days: tripDays,
    fetchedAt: new Date().toISOString(),
    forecastAvailableFrom, historicalYears,
    currentWeather: currentWeather.length ? currentWeather : undefined,
    summary, packingNotes,
    homeComparison,
    climateNormals,
  };
}