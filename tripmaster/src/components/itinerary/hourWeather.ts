// The weather for each hour of an itinerary page, for where you are that hour: the
// day's place, or home before you fly out / after you land (the trip's first and
// last days keep home's hours). Hours in the air, or somewhere no forecast is for,
// get nothing. Forecast days only — a typical day's hours are averages, not a forecast.

import type { Stop } from './Itinerary.config';
import { stopStartMinutes } from './Itinerary.helpers';
import type { DayWeather, WeatherResult } from '@/lib/weather-insights';
import { haversineKm } from '@/lib/geo/geocode';
import { AREA_KM } from '@/lib/geo/tripAreas';

export interface HourWeather {
  date:  string;          // the weather day it's from — the next date past midnight
  temp:  number;
  feels: number | null;
  code:  number | null;
  isDay: boolean;
  city:  string;          // where it's for
}

type LatLng = { lat: number; lng: number };

interface Leg {
  dep:  number;           // minutes on the page; -Infinity = set off before it
  arr:  number;           // Infinity = lands after it
  from: LatLng | null;
  to:   LatLng | null;
}

const near = (a: LatLng, lat?: number, lng?: number) =>
  typeof lat === 'number' && typeof lng === 'number' && haversineKm(a.lat, a.lng, lat, lng) <= AREA_KM;

// Booked journeys on the page that take you somewhere else: every flight, and any
// other whose two ends are further apart than a town.
function legsOf(stops: Stop[]): Leg[] {
  const ends = new Map<string, { dep?: Stop; arr?: Stop }>();
  for (const s of stops) {
    const phase = s.metadata?.phase;
    if (s.skipped || s.logisticsRef?.collection !== 'transport' || (phase !== 'departure' && phase !== 'arrival')) continue;
    const key = s.logisticsRef.id ?? String(s.logisticsRef.index);
    const e   = ends.get(key) ?? {};
    if (phase === 'departure') e.dep = s; else e.arr = s;
    ends.set(key, e);
  }
  const legs: Leg[] = [];
  for (const { dep, arr } of ends.values()) {
    const depMin = dep ? stopStartMinutes(dep) : -Infinity;
    const arrMin = arr ? stopStartMinutes(arr) : Infinity;
    if (depMin === null || arrMin === null) continue;
    const from = dep?.coordinates ?? null;
    const to   = arr?.coordinates ?? null;
    const flight = (dep ?? arr)?.metadata?.transportType === 'flight';
    if (!flight && !(from && to && !near(from, to.lat, to.lng))) continue;
    legs.push({ dep: depMin, arr: arrMin, from, to });
  }
  return legs.sort((a, b) => a.dep - b.dep);
}

// Where you are at a minute: travelling, a point, unknown (null), or — with no
// journeys on the page — the day's own place.
function whereAt(m: number, legs: Leg[]): 'travelling' | 'base' | LatLng | null {
  if (!legs.length) return 'base';
  if (legs.some(l => l.dep <= m && m < l.arr)) return 'travelling';
  const landed = legs.filter(l => l.arr <= m).pop();
  if (landed) return landed.to;
  return legs.find(l => l.dep > m)?.from ?? null;
}

function addDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Page hour (≥24 past midnight) → the weather that hour, for the page dated `date`. */
export function pageHourWeather(
  weather: WeatherResult, date: string, stops: Stop[], startHour: number, endHour: number,
): Map<number, HourWeather> {
  const out  = new Map<number, HourWeather>();
  const legs = legsOf(stops);
  const next = addDay(date);
  const home = weather.home;
  const homePoint = home && typeof home.lat === 'number' && typeof home.lon === 'number'
    ? { lat: home.lat, lng: home.lon } : null;

  const tripDay = (d: string) => weather.days.find(x => x.date === d);
  const placeOf = (day: DayWeather) => (weather.places ?? []).find(p => p.city === day.city);

  for (let h = startHour; h < endHour; h++) {
    const where = whereAt(h * 60 + 30, legs);   // the middle of the hour
    if (where === 'travelling' || where === null) continue;

    const d     = h < 24 ? date : next;
    const trip  = tripDay(d);
    const place = trip && placeOf(trip);
    const day: DayWeather | undefined =
        where === 'base'                                                ? trip
      : place && near(where, place.lat, place.lon)                      ? trip
      : homePoint && near(homePoint, where.lat, where.lng)              ? home!.days.find(x => x.date === d)
      : undefined;
    if (!day || day.source !== 'forecast' || !day.hours) continue;

    const i    = h % 24;
    const temp = day.hours.temp[i];
    if (temp == null) continue;
    out.set(h, {
      date: d, temp,
      feels: day.hours.feels[i] ?? null,
      code:  day.hours.code[i] ?? null,
      isDay: day.hours.isDay[i] !== 0,
      city:  day.city,
    });
  }
  return out;
}
