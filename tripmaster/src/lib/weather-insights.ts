// src/lib/weather-insights.ts
//
// Client-safe weather types plus the reads every surface shares: what to wear,
// the home comparison, watch-outs, the one-line summary and the headline temp.
// All pure functions over the stored WeatherResult, so changing a threshold or a
// phrase applies to cached data without a refetch. Fetching lives in weather.ts.

export const WEATHER_VERSION = 5;

export type DaySource = 'forecast' | 'historical';

/** Hour-by-hour columns, index = local hour 0–23 (a DST gap stays null). */
export interface DayHours {
  temp:  (number | null)[];
  feels: (number | null)[];
  code:  (number | null)[];
  rain:  (number | null)[];   // forecast: % of models with rain that hour · typical: % of past days
  mm:    (number | null)[];   // forecast only — the models' median
  cloud: (number | null)[];
  wind:  (number | null)[];
  gust:  (number | null)[];   // forecast only
  dir:   (number | null)[];   // forecast only — degrees the wind comes from
  rh:    (number | null)[];
  uv:    (number | null)[];   // typical: clear-sky estimate
  isDay: (number | null)[];   // 1 day · 0 night
}

export interface DayWeather {
  date:          string;         // YYYY-MM-DD, local to the place
  label:         string;         // "Sun, 18 Oct"
  city:          string;         // trip stop (or home city) this day belongs to
  condition:     string;
  icon:          string;         // emoji — Overview / TravelSheet
  code:          number | null;  // WMO code; historical days get a representative one
  tempMax:       number;
  tempMin:       number;
  feelsMax:      number | null;  // apparent temperature
  feelsMin:      number | null;
  feelsEvening:  number | null;  // apparent temperature, 20:00–22:00 local
  // Rain is read over waking hours (08:00–22:00) — drizzle at 4am needs no umbrella.
  chanceOfRain:  number | null;  // % chance of ≥1 mm: forecast = share of weather models, typical = share of past days
  precipMm:      number;         // waking hours: the models' median (typical: mean)
  windKph:       number | null;  // daily max sustained wind
  uvIndex:       number | null;  // historical: clear-sky estimate
  sunshineHours: number | null;
  daylightHours: number | null;
  source:        DaySource;
  // v3 — the day-detail sheet. Optional so older cached days still type.
  sunrise?:      string | null;  // 'HH:mm' local
  sunset?:       string | null;
  gustKph?:      number | null;
  windDir?:      number | null;  // dominant, degrees the wind comes from
  rainHours?:    number | null;
  humidity?:     number | null;  // mean relative humidity %
  hours?:        DayHours | null;
  // v4 — rain consensus
  nightMm?:      number | null;  // before 08:00 and after 22:00
  rainKind?:     'drizzle' | 'rain' | null;
  rainModels?:   number | null;  // forecast models that agreed on the read (1 = best match alone)
}

export interface CurrentWeather {
  time:      string;   // local wall clock, 'YYYY-MM-DDTHH:mm'
  temp:      number;
  feels:     number;
  condition: string;
  icon:      string;
  code:      number;
  windKph:   number | null;
}

export interface WeatherPlace {
  label: string;                          // what the forecast is for: the stay, the town or the airport
  city:  string;
  kind:  'stay' | 'city' | 'airport';
  lat:   number;
  lon:   number;
}

export interface WeatherResult {
  version:          number;
  key:              string;
  fetchedAt:        string;
  mode:             'forecast' | 'historical' | 'mixed';
  timezone:         string | null;
  places:           WeatherPlace[];
  days:             DayWeather[];
  historicalYears?: number;
  current?:         CurrentWeather;
  seaTemp?:         number | null;
  home?: {
    city:         string;
    days:         DayWeather[];   // same dates, same forecast/typical split as the trip
    seaTemp:      number | null;
    monthlyHighs: number[] | null; // Jan–Dec average daily high
  };
  homeUnset?: boolean;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const nums = (xs: (number | null | undefined)[]): number[] =>
  xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function range(xs: number[]): string {
  const lo = Math.round(Math.min(...xs));
  const hi = Math.round(Math.max(...xs));
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}

function hoursLabel(h: number): string {
  const whole = Math.floor(h);
  const mins  = Math.round((h - whole) * 60);
  return mins === 0 || mins === 60 ? `${Math.round(h)}h` : `${whole}h ${mins}m`;
}

/** "Sun 18" — weekday plus date, unambiguous on trips longer than a week. */
export function shortDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return `${d.toLocaleDateString('en-IE', { weekday: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}`;
}

const listDays = (days: { date: string }[]) => days.map(d => shortDay(d.date)).join(', ');

/** Today's date (YYYY-MM-DD) where the weather is. */
export function todayIn(timeZone?: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// v1 cached days have no feels-like fields — fall back on air temperature.
export const feelsDay = (d: DayWeather) => d.feelsMax ?? d.tempMax;
export const feelsEvening = (d: DayWeather) =>
  d.feelsEvening ?? Math.round(d.tempMin + (d.tempMax - d.tempMin) * 0.4);

const isTypical = (days: DayWeather[]) => days.length > 0 && days.every(d => d.source === 'historical');

// ─── Rain ─────────────────────────────────────────────────────────────────────
// A wet day is ≥1 mm in waking hours, called when at least half the evidence —
// weather models for a forecast, past years for a typical day — says so. Both
// kinds of day speak the same "chance", so counts and comparisons mix freely.

export interface RainFields {
  source?:       string;
  chanceOfRain?: number | null;
  precipMm?:     number | null;
  rainKind?:     'drizzle' | 'rain' | null;
}

export const isWetDay = (d: RainFields) => (d.chanceOfRain ?? 0) >= 50;

export const isHeavyRainDay = (d: RainFields) =>
  d.source !== 'historical' && (d.precipMm ?? 0) >= 10 && isWetDay(d);

// Heavy but not settled — most models wet, yet fewer than 60% agree.
export const isUnsureRain = (d: RainFields) => (d.chanceOfRain ?? 0) < 60;

/** Forecast days count as wet or not; typical days add their odds, so "about 5 of 9" isn't all-or-nothing. */
export function wetDayCount(days: RainFields[]): number {
  return Math.round(days.reduce((s, d) =>
    s + (d.source === 'historical' ? (d.chanceOfRain ?? 0) / 100 : isWetDay(d) ? 1 : 0), 0));
}

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
export const isSnowDay = (d: DayWeather) =>
  (d.code != null && SNOW_CODES.has(d.code)) || /snow|blizzard/i.test(d.condition);

// ─── Feels-like bands ─────────────────────────────────────────────────────────

interface Band { label: string; min: number; day: string; evening: string }

// Hottest first; ordered so a larger index is colder.
const BANDS: Band[] = [
  { label: 'Very hot', min: 32,        day: 'Loose, light clothes — linen, shorts, sandals', evening: 'Light clothes — still hot after dark' },
  { label: 'Hot',      min: 27,        day: 'Shorts, T-shirt, sandals',                      evening: 'T-shirt weather — no layer needed' },
  { label: 'Warm',     min: 22,        day: 'T-shirt; shorts or light trousers',             evening: 'T-shirt; a light shirt at most' },
  { label: 'Mild',     min: 17,        day: 'T-shirt plus a light layer',                    evening: 'Light jumper or overshirt' },
  { label: 'Cool',     min: 12,        day: 'Long sleeves and a light jacket',               evening: 'Jumper and a light jacket' },
  { label: 'Chilly',   min: 6,         day: 'Jumper and a proper jacket',                    evening: 'Warm jacket' },
  { label: 'Cold',     min: 0,         day: 'Warm coat, layers, hat',                        evening: 'Warm coat, hat and gloves' },
  { label: 'Freezing', min: -Infinity, day: 'Heavy coat, thermals, hat and gloves',          evening: 'Heavy coat, thermals, hat and gloves' },
];

export function feelsBand(t: number): Band {
  const r = Math.round(t);
  return BANDS.find(b => r >= b.min) ?? BANDS[BANDS.length - 1];
}

// ─── What to wear ─────────────────────────────────────────────────────────────

export interface WearRow {
  key:   'day' | 'evening' | 'rain' | 'sun' | 'wind' | 'snow' | 'sea' | 'out' | 'back';
  label: string;
  value: string;
  text:  string;
  pack?: string;   // the one item it adds — Overview's one-liner
}

// ─── Rain gear — one decision for What to wear and the packing list ──────────
// Scaled to how much of the trip is wet, not to the worst single day: one heavy
// day is an umbrella, not a waterproof jacket and shoes.

export type RainGear = 'none' | 'umbrella' | 'jacket' | 'jacket+shoes';

export interface RainOutlook {
  gear:  RainGear;
  wet:   number;   // wet days (typical days by their odds)
  heavy: number;   // 10 mm+ forecast days
  value: string;   // "1 of 9 days"
  text:  string;   // names the days when there are only a few
}

type RainDay = RainFields & { date: string };

export function rainOutlook(days: RainDay[]): RainOutlook {
  const n     = days.length;
  const wet   = wetDayCount(days);
  const heavy = days.filter(isHeavyRainDay);

  if (days.every(d => d.source === 'historical')) {
    const value   = wet === 0 ? 'Rare' : `~${wet} of ${n} days`;
    const drizzly = days.filter(d => (d.chanceOfRain ?? 0) >= 35).every(d => d.rainKind !== 'rain');
    if (wet === 0)              return { gear: 'none',     wet, heavy: 0, value, text: 'Usually dry — leave the umbrella' };
    if (drizzly && wet / n < 0.5) return { gear: 'none',   wet, heavy: 0, value, text: 'Drizzle now and then is typical — a light layer covers it' };
    if (wet / n >= 0.5)         return { gear: 'jacket',   wet, heavy: 0, value, text: 'Rain is common — waterproof jacket' };
    if (wet <= 2)               return { gear: 'umbrella', wet, heavy: 0, value, text: 'A shower or two is typical — a compact umbrella' };
    return { gear: 'umbrella', wet, heavy: 0, value, text: `Rain on about ${wet} of ${n} days — a compact umbrella` };
  }

  const fc      = days.filter(d => d.source !== 'historical');
  const wetDays = fc.filter(isWetDay);
  const rainy   = wetDays.filter(d => d.rainKind !== 'drizzle');
  const drizzly = wetDays.filter(d => d.rainKind === 'drizzle');
  const maybe   = fc.filter(d => !isWetDay(d) && (d.chanceOfRain ?? 0) >= 35);
  const value   = wet === 0 ? (maybe.length ? 'Mostly dry' : 'Dry') : `${wet} of ${n} days`;
  const heavyLabel = (d: RainDay) => `Heavy rain${isUnsureRain(d) ? ' possible' : ''} ${shortDay(d.date)}`;
  const out = (gear: RainGear, text: string): RainOutlook => ({ gear, wet, heavy: heavy.length, value, text });

  if (!wetDays.length) {
    if (!maybe.length) return out('none', 'Dry — leave the umbrella');
    const what = maybe.every(d => d.rainKind !== 'rain') ? 'drizzle' : 'a shower';
    return out('none', `Mostly dry — ${what} possible ${listDays(maybe)}`);
  }

  // Drizzle alone doesn't need an umbrella — unless it's most of the trip.
  if (!rainy.length) {
    return drizzly.length / n >= 0.5
      ? out('umbrella', 'Drizzle most days — a hooded layer or compact umbrella')
      : out('none', `Drizzle ${listDays(drizzly)} — light, a layer covers it`);
  }

  const frequent = rainy.length / n >= 0.5;
  if (frequent && heavy.length >= 2) return out('jacket+shoes', `Rain most days, heavy ${listDays(heavy)} — waterproof jacket and shoes`);
  if (frequent)                      return out('jacket', 'Rain most days — waterproof jacket');
  if (heavy.length >= 2)             return out('jacket', `Heavy rain ${listDays(heavy)} — waterproof jacket`);
  if (heavy.length === 1 && rainy.length === 1 && !drizzly.length)
    return out('umbrella', `${heavyLabel(heavy[0])} — one wet day, a compact umbrella covers it`);
  if (rainy.length <= 3) {
    const showers = rainy.filter(d => !isHeavyRainDay(d));
    const parts = [
      ...heavy.map(heavyLabel),
      ...(showers.length ? [`rain ${listDays(showers)}`] : []),
      ...(drizzly.length ? [`drizzle ${listDays(drizzly)}`] : []),
    ];
    const lead = parts.join(', ');
    return out('umbrella', `${lead.charAt(0).toUpperCase()}${lead.slice(1)} — a compact umbrella`);
  }
  return out('umbrella', `Rain on ${rainy.length} of ${n} days — a compact umbrella`);
}

const GEAR_PACK: Record<RainGear, string | undefined> = {
  'none':         undefined,
  'umbrella':     'Umbrella',
  'jacket':       'Waterproof jacket',
  'jacket+shoes': 'Waterproof jacket',
};

function rainRow(days: DayWeather[]): WearRow {
  const r = rainOutlook(days);
  return { key: 'rain', label: 'Rain', value: r.value, text: r.text, pack: GEAR_PACK[r.gear] };
}

function seaText(t: number): string {
  if (t >= 24) return 'Warm — easy swimming';
  if (t >= 21) return 'Good for swimming';
  if (t >= 18) return 'Refreshing — fine for a swim';
  if (t >= 15) return 'Cold — quick dips only';
  return 'Very cold — wetsuit territory';
}

export function wearGuide(w: WeatherResult): WearRow[] {
  const days = w.days ?? [];
  if (!days.length) return [];
  const rows: WearRow[] = [];
  const tilde = isTypical(days) ? '~' : '';

  // Days — what the median day feels like, flagging a real spread either way.
  const dayFeels = days.map(feelsDay);
  const dayMid   = median(dayFeels);
  let dayText    = feelsBand(dayMid).day;
  if (dayMid - Math.min(...dayFeels) >= 6)      dayText += ' — and a layer for cooler days';
  else if (Math.max(...dayFeels) - dayMid >= 6) dayText += ' — lighter still on the hottest days';
  rows.push({ key: 'day', label: 'Days', value: `feels ${range(dayFeels)}°`, text: dayText });

  // Evenings — what you'll feel going out to dinner, not the 5am low.
  const eve    = days.map(feelsEvening);
  const eveMid = median(eve);
  let eveText  = feelsBand(eveMid).evening;
  if (eveMid - Math.min(...eve) >= 6) eveText += ' — warmer layer for the coolest nights';
  rows.push({ key: 'evening', label: 'Evenings', value: `feels ${range(eve)}°`, text: eveText });

  rows.push(rainRow(days));

  const uv = nums(days.map(d => d.uvIndex));
  if (uv.length) {
    const max = Math.round(Math.max(...uv));
    const value = `UV ${tilde}${max}`;
    if (max >= 8)      rows.push({ key: 'sun', label: 'Sun', value, text: 'SPF 50, hat, sunglasses — find shade at midday', pack: 'Sun cream' });
    else if (max >= 6) rows.push({ key: 'sun', label: 'Sun', value, text: 'SPF 30+, hat, sunglasses', pack: 'Sun cream' });
    else if (max >= 3) rows.push({ key: 'sun', label: 'Sun', value, text: 'Sunglasses; sun cream for long days outside' });
  }

  const wind = nums(days.map(d => d.windKph));
  if (wind.length) {
    const mean  = avg(wind);
    const gales = days.filter(d => (d.windKph ?? 0) >= 50);
    if (mean >= 30 || wind.filter(v => v >= 35).length >= days.length / 2) {
      rows.push({ key: 'wind', label: 'Wind', value: `${Math.round(mean)} km/h`, text: 'Windy most days — a windproof layer', pack: 'Windproof layer' });
    } else if (gales.length) {
      rows.push({ key: 'wind', label: 'Wind', value: `${Math.max(...gales.map(d => d.windKph!))} km/h`, text: `Very windy ${listDays(gales)} — a windproof layer`, pack: 'Windproof layer' });
    }
  }

  const snow = days.filter(isSnowDay);
  if (snow.length) {
    rows.push({
      key: 'snow', label: 'Snow', value: `${snow.length} day${snow.length > 1 ? 's' : ''}`,
      text: 'Waterproof boots and warm layers', pack: 'Waterproof boots',
    });
  }

  if (w.seaTemp != null) {
    const t = Math.round(w.seaTemp);
    rows.push({ key: 'sea', label: 'Sea', value: `${t}°`, text: seaText(t), pack: t >= 18 ? 'Swimwear' : undefined });
  }

  // Travel days — dress for the end you're leaving, carry for the end you're going to.
  const home = w.home;
  if (home?.days.length) {
    const h0 = home.days[0];
    const d0 = days[0];
    if (h0 && Math.abs(d0.tempMax - h0.tempMax) >= 8) {
      rows.push({
        key: 'out', label: 'Travel out', value: `${h0.tempMax}° → ${d0.tempMax}°`,
        text: d0.tempMax > h0.tempMax
          ? `Leaving ${home.city} cool — wear layers you can peel off`
          : 'Arriving colder — keep a warm layer in your hand luggage',
      });
    }
    const hN = home.days[home.days.length - 1];
    const dN = days[days.length - 1];
    if (hN && Math.abs(dN.tempMax - hN.tempMax) >= 8) {
      rows.push({
        key: 'back', label: 'Travel home', value: `${dN.tempMax}° → ${hN.tempMax}°`,
        text: hN.tempMax < dN.tempMax
          ? `Back to ${hN.tempMax}° in ${home.city} — keep a jacket in your hand luggage`
          : 'Warmer at home — something light for the journey back',
      });
    }
  }

  return rows;
}

/** One line for Overview: the daytime outfit plus whatever extra the trip needs. */
export function wearHeadline(w: WeatherResult): string | null {
  const rows = wearGuide(w);
  const day  = rows.find(r => r.key === 'day');
  if (!day) return null;
  const packs = rows.map(r => r.pack).filter((p): p is string => !!p);
  const outfit = day.text.split(' — ')[0];
  return packs.length
    ? `${outfit} · ${packs.map((p, i) => (i === 0 ? p : p.toLowerCase())).join(', ')}`
    : outfit;
}

// ─── Compared to home ─────────────────────────────────────────────────────────

export interface CompareRow {
  key:      string;
  label:    string;
  home:     string;
  homeSub?: string;
  dest:     string;
  destSub?: string;
  tone:     'warm' | 'cool' | null;   // how the destination differs, for colour
}

export interface HomeCompare {
  homeCity: string;
  destCity: string;
  verdict:  string;
  rows:     CompareRow[];
  analog:   string | null;
}

function joinAnd(parts: string[]): string {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function homeCompare(w: WeatherResult): HomeCompare | null {
  const home = w.home;
  const days = w.days ?? [];
  if (!home?.days.length || !days.length) return null;

  const hd = home.days;
  const cities   = [...new Set(days.map(d => d.city))];
  const destCity = cities.length === 1 ? cities[0] : 'Trip';
  const typical  = isTypical(days);
  const t        = typical ? '~' : '';

  const destHigh = avg(days.map(d => d.tempMax));
  const homeHigh = avg(hd.map(d => d.tempMax));
  const dDay     = Math.round(destHigh - homeHigh);
  const dEve     = Math.round(avg(days.map(feelsEvening)) - avg(hd.map(feelsEvening)));

  const destWet = wetDayCount(days);
  const homeWet = wetDayCount(hd);

  const destSun = nums(days.map(d => d.sunshineHours));
  const homeSun = nums(hd.map(d => d.sunshineHours));
  const sunDiff = destSun.length && homeSun.length ? avg(destSun) - avg(homeSun) : 0;

  // Verdict
  const warmer = (n: number) => `${Math.abs(n)}° ${n > 0 ? 'warmer' : 'cooler'}`;
  let temp: string;
  if (Math.abs(dDay) < 2 && Math.abs(dEve) < 2) temp = `Similar temperatures to ${home.city}`;
  else if (Math.abs(dDay) < 2)                  temp = `Similar days to ${home.city}, evenings ${warmer(dEve)}`;
  else if (Math.abs(dEve - dDay) >= 3 && Math.abs(dEve) >= 2)
    temp = `${warmer(dDay)} than ${home.city} by day, ${warmer(dEve)} in the evening`;
  else temp = `${warmer(dDay)} than ${home.city}`;

  const extras: string[] = [];
  if (destWet - homeWet <= -2) extras.push('drier');
  if (destWet - homeWet >= 2)  extras.push('wetter');
  if (sunDiff >= 2)            extras.push('sunnier');
  if (sunDiff <= -2)           extras.push('greyer');
  const verdict = `${temp}${extras.length ? ` — ${joinAnd(extras)}` : ''}.`;

  // Rows
  const rows: CompareRow[] = [];
  const toneOf = (diff: number, threshold: number): CompareRow['tone'] =>
    diff >= threshold ? 'warm' : diff <= -threshold ? 'cool' : null;

  rows.push({
    key: 'days', label: 'Days',
    home: `${range(hd.map(d => d.tempMax))}°`, homeSub: `feels ${range(hd.map(feelsDay))}°`,
    dest: `${range(days.map(d => d.tempMax))}°`, destSub: `feels ${range(days.map(feelsDay))}°`,
    tone: toneOf(dDay, 2),
  });
  rows.push({
    key: 'evenings', label: 'Evenings',
    home: `feels ${range(hd.map(feelsEvening))}°`,
    dest: `feels ${range(days.map(feelsEvening))}°`,
    tone: toneOf(dEve, 2),
  });
  rows.push({
    key: 'rain', label: 'Rain',
    home: homeWet === 0 ? 'Dry' : `${t}${homeWet} of ${hd.length} days`,
    dest: destWet === 0 ? 'Dry' : `${t}${destWet} of ${days.length} days`,
    tone: destWet - homeWet <= -2 ? 'warm' : destWet - homeWet >= 2 ? 'cool' : null,
  });
  if (destSun.length && homeSun.length) {
    rows.push({
      key: 'sun', label: 'Sunshine',
      home: `${hoursLabel(avg(homeSun))} a day`,
      dest: `${hoursLabel(avg(destSun))} a day`,
      tone: toneOf(sunDiff, 2),
    });
  }
  const destUv = nums(days.map(d => d.uvIndex));
  const homeUv = nums(hd.map(d => d.uvIndex));
  if (destUv.length && homeUv.length) {
    const du = Math.round(Math.max(...destUv));
    const hu = Math.round(Math.max(...homeUv));
    rows.push({ key: 'uv', label: 'UV', home: `${t}${hu}`, dest: `${t}${du}`, tone: toneOf(du - hu, 2) });
  }
  if (w.seaTemp != null) {
    const ds = Math.round(w.seaTemp);
    const hs = home.seaTemp != null ? Math.round(home.seaTemp) : null;
    rows.push({ key: 'sea', label: 'Sea', home: hs != null ? `${hs}°` : '—', dest: `${ds}°`, tone: hs != null ? toneOf(ds - hs, 2) : null });
  }
  const destLight = nums(days.map(d => d.daylightHours));
  const homeLight = nums(hd.map(d => d.daylightHours));
  if (destLight.length && homeLight.length && Math.abs(avg(destLight) - avg(homeLight)) >= 0.5) {
    rows.push({
      key: 'daylight', label: 'Daylight',
      home: hoursLabel(avg(homeLight)), dest: hoursLabel(avg(destLight)),
      tone: toneOf(avg(destLight) - avg(homeLight), 1),
    });
  }
  const destWind = nums(days.map(d => d.windKph));
  const homeWind = nums(hd.map(d => d.windKph));
  if (destWind.length && homeWind.length && Math.abs(avg(destWind) - avg(homeWind)) >= 10) {
    const diff = avg(homeWind) - avg(destWind);
    rows.push({
      key: 'wind', label: 'Wind',
      home: `${Math.round(avg(homeWind))} km/h`, dest: `${Math.round(avg(destWind))} km/h`,
      tone: diff >= 10 ? 'warm' : 'cool',
    });
  }

  // Analog — which month at home has days like these.
  let analog: string | null = null;
  const mh = home.monthlyHighs;
  if (mh?.length === 12) {
    const max = Math.max(...mh);
    const min = Math.min(...mh);
    if (destHigh >= max + 2) {
      analog = `Warmer than ${home.city} ever gets — its warmest month averages ${Math.round(max)}°.`;
    } else if (destHigh <= min - 2) {
      analog = `Colder than ${home.city} ever gets — its coldest month averages ${Math.round(min)}°.`;
    } else {
      const m = mh.reduce((best, v, i) => (Math.abs(v - destHigh) < Math.abs(mh[best] - destHigh) ? i : best), 0);
      const tripMonth = +days[0].date.slice(5, 7) - 1;
      if (m !== tripMonth) analog = `Daytime highs like ${home.city} in ${MONTHS[m]}.`;
    }
  }

  return { homeCity: home.city, destCity, verdict, rows, analog };
}

// ─── Watch out ────────────────────────────────────────────────────────────────

export interface WatchItem {
  date:      string;
  dayNumber: number;   // matches the itinerary's ?day=
  text:      string;
}

/** Forecast days that genuinely stand out. Typical days never do — they're averages. */
export function watchOuts(days: DayWeather[]): WatchItem[] {
  const out: WatchItem[] = [];
  days.forEach((d, i) => {
    if (d.source === 'historical') return;
    const notes: string[] = [];
    if (d.code != null && d.code >= 95 && (d.chanceOfRain ?? 100) >= 30) notes.push('Thunderstorms');
    if (isHeavyRainDay(d))                   notes.push(`Heavy rain${isUnsureRain(d) ? ' possible' : ''}, ${Math.round(d.precipMm)} mm`);
    if ((d.windKph ?? 0) >= 50)              notes.push(`Very windy, ${d.windKph} km/h`);
    if (feelsDay(d) >= 35)                   notes.push(`Extreme heat, feels ${feelsDay(d)}°`);
    if (isSnowDay(d))                        notes.push('Snow');
    if (d.tempMin <= -5)                     notes.push(`Hard frost, ${d.tempMin}°`);
    if (notes.length) out.push({ date: d.date, dayNumber: i + 1, text: notes.join(' · ') });
  });
  return out;
}

// ─── Summary + headline ───────────────────────────────────────────────────────

export function summaryLine(days: DayWeather[]): string | null {
  if (!days?.length) return null;
  const band = feelsBand(median(days.map(feelsDay))).label;
  const wet  = wetDayCount(days) / days.length;
  const rain = wet === 0 ? 'dry' : wet <= 0.25 ? 'mostly dry' : wet < 0.6 ? 'some rain' : 'wet';
  const lead = isTypical(days) ? `Typically ${band.toLowerCase()}` : band;
  return `${lead} and ${rain} · highs ${range(days.map(d => d.tempMax))}°, lows ${range(days.map(d => d.tempMin))}°`;
}

/** First trip date that falls back to typical conditions, and when its forecast arrives. */
export function typicalFrom(days: DayWeather[]): { date: string; forecastFrom: string } | null {
  const first = days.find(d => d.source === 'historical');
  if (!first) return null;
  const t = new Date(`${first.date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 14);
  return { date: first.date, forecastFrom: t.toISOString().slice(0, 10) };
}

const NOW_FRESH_MS = 3 * 60 * 60 * 1000;

/** Current conditions, but only while they're recent enough to call "now". */
export function freshCurrent(w: WeatherResult | null | undefined): CurrentWeather | null {
  if (!w?.current || !w.fetchedAt) return null;
  return Date.now() - Date.parse(w.fetchedAt) < NOW_FRESH_MS ? w.current : null;
}

export interface WeatherHeadline {
  temp:      number;
  condition: string;
  icon:      string;
  kind:      'now' | 'day' | 'typical';
}

/** The single temperature a header shows: now if fresh, else today's (or day one's) high. */
export function weatherHeadline(w: WeatherResult | null | undefined): WeatherHeadline | null {
  if (!w) return null;
  const now = freshCurrent(w);
  if (now) return { temp: now.temp, condition: now.condition, icon: now.icon, kind: 'now' };
  const days = w.days ?? [];
  const d = days.find(x => x.date === todayIn(w.timezone)) ?? days[0];
  if (!d) return null;
  return {
    temp: d.tempMax, condition: d.condition, icon: d.icon,
    kind: d.source === 'historical' ? 'typical' : 'day',
  };
}

// ─── One day in detail — the day sheet ────────────────────────────────────────

export interface HourRow {
  hour:  number;
  temp:  number;
  feels: number | null;
  code:  number | null;
  rain:  number | null;
  mm:    number | null;
  cloud: number | null;
  wind:  number | null;
  gust:  number | null;
  dir:   number | null;
  rh:    number | null;
  uv:    number | null;
  isDay: boolean;
}

export function hourRows(day: DayWeather): HourRow[] {
  const h = day.hours;
  if (!h) return [];
  const rows: HourRow[] = [];
  for (let i = 0; i < 24; i++) {
    const temp = h.temp[i];
    if (temp == null) continue;
    rows.push({
      hour: i, temp,
      feels: h.feels[i], code: h.code[i], rain: h.rain[i], mm: h.mm[i],
      cloud: h.cloud[i], wind: h.wind[i], gust: h.gust[i], dir: h.dir[i],
      rh: h.rh[i], uv: h.uv[i], isDay: h.isDay[i] !== 0,
    });
  }
  return rows;
}

export const hourLabel = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;

const one1 = (x: number) => Math.round(x * 10) / 10;

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** Where the wind comes from — "a SW wind". */
export const compass = (deg: number | null | undefined) =>
  deg == null ? '' : COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];

export function uvLabel(uv: number): string {
  if (uv >= 11) return 'Extreme';
  if (uv >= 8)  return 'Very high';
  if (uv >= 6)  return 'High';
  if (uv >= 3)  return 'Moderate';
  return 'Low';
}

/** The hour, local to the place, if `date` is today there; otherwise null. */
export function currentHourIn(timeZone: string | null | undefined, date: string): number | null {
  if (todayIn(timeZone) !== date) return null;
  try {
    const h = new Intl.DateTimeFormat('en-GB', { timeZone: timeZone || undefined, hour: '2-digit', hourCycle: 'h23' })
      .format(new Date());
    return Number(h);
  } catch {
    return new Date().getHours();
  }
}

// Consecutive hours → "14:00–17:00"
function spans(hours: number[]): string[] {
  const out: string[] = [];
  let from = -1;
  let prev = -2;
  for (const h of [...hours, -99]) {
    if (h === prev + 1) { prev = h; continue; }
    if (from >= 0) out.push(`${hourLabel(from)}–${hourLabel(prev + 1)}`);
    from = h;
    prev = h;
  }
  return out;
}

function longestRun(hours: number[]): number[] {
  let best: number[] = [];
  let run: number[] = [];
  for (const h of hours) {
    run = run.length && h === run[run.length - 1] + 1 ? [...run, h] : [h];
    if (run.length > best.length) best = run;
  }
  return best;
}

export interface PlanItem {
  key:  'wear' | 'evening' | 'warmest' | 'rain' | 'dry' | 'sun' | 'wind';
  text: string;
}

/**
 * What the hours say about planning this day: what to wear, when it rains, the
 * driest stretch, sun-cream hours, gusts. From `fromHour` on — on today, hours
 * already gone don't change any decision.
 */
export function dayPlan(day: DayWeather, fromHour = 0): PlanItem[] {
  const items: PlanItem[] = [];
  const typical = day.source === 'historical';
  const rows = hourRows(day).filter(r => r.hour >= fromHour);

  items.push({ key: 'wear', text: feelsBand(feelsDay(day)).day });
  if (!rows.length) return items;

  // Warmest part of the day still to come
  const daytime = rows.filter(r => r.hour >= 8 && r.hour <= 20);
  if (daytime.length) {
    const peak = daytime.reduce((a, b) => ((b.feels ?? b.temp) > (a.feels ?? a.temp) ? b : a));
    items.push({ key: 'warmest', text: `Warmest around ${hourLabel(peak.hour)} — ${peak.temp}°, feels ${peak.feels ?? peak.temp}°` });
  }

  // Evening out
  const eve = rows.find(r => r.hour === 21) ?? rows.find(r => r.hour === 20);
  if (eve) {
    const f = eve.feels ?? eve.temp;
    items.push({ key: 'evening', text: `Evening feels ${f}° at ${hourLabel(eve.hour)} — ${feelsBand(f).evening.toLowerCase()}` });
  }

  // Rain — when, and how sure. An hour's chance is the share of weather models
  // (typical: past years) with rain in it, so "likely" means most of them agree.
  const LIKELY   = typical ? 40 : 50;
  const POSSIBLE = typical ? 25 : 30;
  const chanceAt = (r: HourRow) => r.rain ?? 0;
  const awake    = rows.filter(r => r.hour >= 8 && r.hour < 22);
  const likely   = awake.filter(r => chanceAt(r) >= LIKELY);
  const possible = awake.filter(r => chanceAt(r) >= POSSIBLE && chanceAt(r) < LIKELY);
  const overnight = rows.filter(r => (r.hour < 8 || r.hour >= 22) && chanceAt(r) >= LIKELY);
  // Drizzle vs rain by the models' median amount — typical hours have none, so the day's read decides.
  const drizzle = (hrs: HourRow[]) =>
    typical ? day.rainKind !== 'rain' : hrs.every(r => (r.mm ?? 0) < 0.5);
  const hoursOf = (hrs: HourRow[]) => spans(hrs.map(r => r.hour)).join(', ');

  let rainText: string;
  if (likely.length) {
    const mm = one1(likely.reduce((s, r) => s + (r.mm ?? 0), 0));
    rainText = `${drizzle(likely) ? 'Drizzle' : 'Rain'} ${typical ? 'most likely' : 'likely'} ${hoursOf(likely)}`
      + (!typical && mm >= 0.5 ? ` · about ${mm} mm` : '');
  } else if (possible.length) {
    rainText = `${drizzle(possible) ? 'Drizzle' : 'A shower'} possible ${hoursOf(possible)}`;
  } else {
    rainText = overnight.length ? 'Dry by day' : typical ? 'Usually dry all day' : 'Dry all day';
  }
  if (overnight.length) rainText += ` · ${drizzle(overnight) ? 'drizzle' : 'rain'} overnight ${hoursOf(overnight)}`;
  items.push({ key: 'rain', text: rainText });

  if (likely.length || possible.length) {
    const dry = longestRun(awake.filter(r => chanceAt(r) < POSSIBLE).map(r => r.hour));
    if (dry.length >= 2) items.push({ key: 'dry', text: `Driest ${hourLabel(dry[0])}–${hourLabel(dry[dry.length - 1] + 1)}` });
  }

  // Sun cream hours
  const uvHours = rows.filter(r => (r.uv ?? 0) >= 3);
  if (uvHours.length) {
    const top = uvHours.reduce((a, b) => ((b.uv ?? 0) > (a.uv ?? 0) ? b : a));
    items.push({
      key: 'sun',
      text: `Sun cream ${spans(uvHours.map(r => r.hour)).join(', ')} · UV peaks ${Math.round(top.uv!)} at ${hourLabel(top.hour)}`,
    });
  } else if (typical && (day.uvIndex ?? 0) >= 3) {
    items.push({ key: 'sun', text: `UV up to ${day.uvIndex} around midday on clear days — sun cream` });
  }

  // Wind
  const gusty = rows.reduce<HourRow | null>((a, b) => ((b.gust ?? b.wind ?? 0) > (a ? a.gust ?? a.wind ?? 0 : -1) ? b : a), null);
  const gust  = gusty ? gusty.gust ?? gusty.wind ?? 0 : 0;
  if (gusty && gust >= 40) {
    items.push({ key: 'wind', text: `Gusts to ${gust} km/h around ${hourLabel(gusty.hour)}` });
  } else if (gusty && (gusty.wind ?? 0) >= 30) {
    items.push({ key: 'wind', text: `Breezy — up to ${gusty.wind} km/h around ${hourLabel(gusty.hour)}` });
  }

  return items;
}

// ─── The whole trip as one timeline — the trip chart ─────────────────────────

export interface TimelinePoint extends HourRow {
  dayIndex: number;
  date:     string;
  source:   DaySource;
}

/** Every hour of the trip in order — the chart's x-axis. */
export function tripTimeline(days: DayWeather[]): TimelinePoint[] {
  return days.flatMap((d, dayIndex) =>
    hourRows(d).map(r => ({ ...r, dayIndex, date: d.date, source: d.source })));
}

export type TripMetric = 'temp' | 'rain' | 'uv' | 'wind';

export interface TripStat { label: string; value: string; sub?: string }

/** Three headline numbers for the metric the chart is showing. */
export function tripStats(days: DayWeather[], metric: TripMetric): TripStat[] {
  if (!days.length) return [];
  const t = isTypical(days) ? '~' : '';
  const by = <T,>(xs: T[], f: (x: T) => number, dir: 1 | -1) =>
    xs.reduce((a, b) => (dir * (f(b) - f(a)) > 0 ? b : a));

  if (metric === 'temp') {
    const hottest = by(days, feelsDay, 1);
    return [
      { label: 'Avg high', value: `${t}${Math.round(avg(days.map(d => d.tempMax)))}°`, sub: `${range(days.map(d => d.tempMax))}°` },
      { label: 'Avg low',  value: `${t}${Math.round(avg(days.map(d => d.tempMin)))}°`, sub: `${range(days.map(d => d.tempMin))}°` },
      { label: 'Feels up to',  value: `${feelsDay(hottest)}°`, sub: shortDay(hottest.date) },
    ];
  }
  if (metric === 'rain') {
    const wet     = wetDayCount(days);
    const wettest = by(days, d => (d.chanceOfRain ?? 0) * 100 + d.precipMm, 1);
    const total   = Math.round(days.reduce((s, d) => s + d.precipMm, 0) * 10) / 10;
    return [
      { label: 'Wet days', value: `${t}${wet} of ${days.length}`, sub: '1 mm+ by day' },
      { label: 'Rain', value: `${t}${total} mm`, sub: 'trip total by day' },
      (wettest.chanceOfRain ?? 0) >= 30
        ? { label: 'Wettest', value: shortDay(wettest.date), sub: `${wettest.chanceOfRain}% · ${wettest.precipMm} mm` }
        : { label: 'Wettest', value: 'None', sub: 'all under 30%' },
    ];
  }
  if (metric === 'uv') {
    const peaks = nums(days.map(d => d.uvIndex));
    const high  = peaks.filter(v => v >= 6).length;
    // Typical sun-cream window: median first and last UV 3+ hour across the days.
    const starts: number[] = [];
    const ends:   number[] = [];
    days.forEach(d => {
      const hrs = hourRows(d).filter(r => (r.uv ?? 0) >= 3).map(r => r.hour);
      if (hrs.length) { starts.push(hrs[0]); ends.push(hrs[hrs.length - 1] + 1); }
    });
    const peak = peaks.length ? Math.round(Math.max(...peaks)) : null;
    return [
      { label: 'Peak UV', value: peak != null ? `${peak}` : '—', sub: peak != null ? uvLabel(peak) : undefined },
      { label: 'High UV', value: `${high} of ${days.length}`, sub: 'days at 6+' },
      starts.length
        ? { label: 'Sun cream', value: `${hourLabel(Math.round(median(starts)))}–${hourLabel(Math.round(median(ends)))}`, sub: 'most days' }
        : { label: 'Sun cream', value: 'Rarely', sub: 'UV stays under 3' },
    ];
  }
  const winds   = nums(days.map(d => d.windKph));
  const gustDay = by(days, d => d.gustKph ?? d.windKph ?? 0, 1);
  const calm    = by(days, d => d.windKph ?? 999, -1);
  return [
    { label: 'Avg wind', value: winds.length ? `${Math.round(avg(winds))}` : '—', sub: 'km/h, daily max' },
    { label: 'Strongest', value: `${gustDay.gustKph ?? gustDay.windKph ?? '—'}`, sub: `km/h${gustDay.gustKph != null ? ' gust' : ''} · ${shortDay(gustDay.date)}` },
    { label: 'Calmest', value: shortDay(calm.date), sub: calm.windKph != null ? `${calm.windKph} km/h` : undefined },
  ];
}

// ─── Now and the next few hours — on the trip ─────────────────────────────────

/** Words for an hour's weather code — hours carry codes, not text. */
export function codeWords(code: number | null, isDay = true): string {
  const c = code ?? 2;
  if (c >= 95) return 'Thunderstorm';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'Snow';
  if (c >= 80 && c <= 82) return 'Showers';
  if (c >= 61 && c <= 67) return 'Rain';
  if (c >= 51 && c <= 57) return 'Drizzle';
  if (c === 45 || c === 48) return 'Fog';
  if (c === 3) return 'Cloudy';
  if (c === 2) return 'Partly cloudy';
  if (c === 1) return isDay ? 'Mostly sunny' : 'Mostly clear';
  return isDay ? 'Sunny' : 'Clear';
}

/** Wall-clock time where the weather is, "14:20". */
export function clockIn(timeZone: string | null | undefined): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone || undefined, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date());
  } catch {
    return new Date().toTimeString().slice(0, 5);
  }
}

export interface NowRead {
  clock:     string;
  temp:      number;
  feels:     number | null;
  condition: string;
  code:      number | null;
  isDay:     boolean;
  windKph:   number | null;
  dir:       number | null;
  uv:        number | null;
  rain:      number | null;
  next:      TimelinePoint[];
  notes:     { key: 'rain' | 'sun' | 'temp'; text: string }[];
}

/**
 * Right now plus the next `count` hours, if today is a trip day. Measured
 * conditions when they're fresh, else this hour's forecast. The notes say what
 * changes soon: rain arriving, sun-cream hours, a real warm-up or cool-down.
 */
export function nowAndNext(w: WeatherResult, count = 4): NowRead | null {
  const days  = w.days ?? [];
  const today = todayIn(w.timezone);
  const hour  = currentHourIn(w.timezone, today);
  if (hour == null) return null;
  const line = tripTimeline(days);
  const at   = line.findIndex(p => p.date === today && p.hour === hour);
  if (at < 0) return null;

  const cur   = line[at];
  const live  = freshCurrent(w);
  const next  = line.slice(at + 1, at + 1 + count);
  const ahead = [cur, ...next];
  const drizzly = (p: TimelinePoint) =>
    p.source === 'historical' ? days[p.dayIndex].rainKind !== 'rain' : (p.mm ?? 0) < 0.5;

  const notes: NowRead['notes'] = [];
  const likely   = ahead.find(p => (p.rain ?? 0) >= 50);
  const possible = ahead.find(p => (p.rain ?? 0) >= 30);
  if (likely) {
    notes.push({ key: 'rain', text: likely === cur
      ? `${drizzly(likely) ? 'Drizzle' : 'Rain'} now${(likely.mm ?? 0) >= 0.1 ? ` — ${likely.mm} mm this hour` : ''}`
      : `${drizzly(likely) ? 'Drizzle' : 'Rain'} likely from ${hourLabel(likely.hour)}` });
  } else if (possible) {
    notes.push({ key: 'rain', text: `${drizzly(possible) ? 'Drizzle' : 'A shower'} possible around ${hourLabel(possible.hour)}` });
  } else {
    notes.push({ key: 'rain', text: `Dry for the next ${next.length || count} hours` });
  }

  if ((cur.uv ?? 0) >= 3) {
    let end = at;
    while (end + 1 < line.length && line[end + 1].date === today && (line[end + 1].uv ?? 0) >= 3) end++;
    const peak = Math.round(Math.max(...line.slice(at, end + 1).map(p => p.uv ?? 0)));
    notes.push({ key: 'sun', text: `UV ${peak} — sun cream until ${hourLabel(line[end].hour + 1)}` });
  } else {
    const rising = next.find(p => (p.uv ?? 0) >= 3);
    if (rising) notes.push({ key: 'sun', text: `UV climbs past 3 from ${hourLabel(rising.hour)} — sun cream` });
  }

  const last = next[next.length - 1];
  if (last && Math.abs(last.temp - cur.temp) >= 3) {
    notes.push({ key: 'temp', text: `${last.temp > cur.temp ? 'Warming' : 'Cooling'} to ${last.temp}° by ${hourLabel(last.hour)}` });
  }

  return {
    clock:     clockIn(w.timezone),
    temp:      live?.temp ?? cur.temp,
    feels:     live?.feels ?? cur.feels,
    condition: live?.condition ?? codeWords(cur.code, cur.isDay),
    code:      live?.code ?? cur.code,
    isDay:     cur.isDay,
    windKph:   live?.windKph ?? cur.wind,
    dir:       cur.dir,
    uv:        cur.uv,
    rain:      cur.rain,
    next,
    notes,
  };
}
