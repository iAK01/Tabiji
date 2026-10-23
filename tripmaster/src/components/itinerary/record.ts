// The record: what actually happened on a trip, built from the plan. Every stop
// that has started counts as went unless it was marked "Didn't go" (the same flag
// as "Not going") — you only fix the exceptions. Shared by the itinerary's Recap
// view and the printable / emailable page at /trips/[id]/recap.

import { DateTime } from 'luxon';
import { buildLegs, stopClock, whereAt } from '@/lib/push/journey';
import { tripZones, ymd } from '@/lib/push/timezones';
import { clockMinutes } from '@/lib/itinerary/nights';
import { dayPages, timeRangeLabel } from './Itinerary.helpers';
import type { Day, Stop } from './Itinerary.config';

// A Resources item (file, note, contact, to-do, link) linked to a stop
export interface LinkedItem {
  _id:          string;
  resourceType: string;
  name:         string;
  mimeType?:    string;
  gcsUrl?:      string;
  body?:        string;
  phone?:       string;
  email?:       string;
  notes?:       string;
  linkUrl?:     string;
  completed?:   boolean;
}

// Resources by what they're linked to: an itinerary stop's _id, or a booking's
// "collection:index" for the stops that mirror it
export function linkedIndex(files: any[]): Map<string, LinkedItem[]> {
  const map = new Map<string, LinkedItem[]>();
  for (const f of files) {
    const entryId = f?.linkedTo?.entryId;
    if (!entryId || (f.resourceType === 'file' && !f.gcsUrl)) continue;
    const item: LinkedItem = {
      _id: f._id, resourceType: f.resourceType ?? 'file', name: f.name,
      mimeType: f.mimeType, gcsUrl: f.gcsUrl, body: f.body, phone: f.phone, email: f.email,
      notes: f.notes, linkUrl: f.linkUrl, completed: f.completed,
    };
    for (const key of [entryId, f.linkedTo.collection ? `${f.linkedTo.collection}:${entryId}` : null]) {
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
  }
  return map;
}

export function linkedFor(index: Map<string, LinkedItem[]>, stop: Stop): LinkedItem[] {
  if (stop._id && index.get(stop._id)?.length) return index.get(stop._id)!;
  const ref = stop.logisticsRef;
  return ref ? index.get(`${ref.collection}:${String(ref.index)}`) ?? [] : [];
}

/**
 * Whether a stop has started, read in the zone you'll be in at the time (the
 * reminders' rule, lib/push/journey.ts) — so a meeting abroad isn't "started"
 * by your phone's clock at home. A stop with no time starts with its day.
 */
type Home = { zone?: string | null; countryCode?: string | null };

function journeyOf(trip: any, transportation: any[], home: Home) {
  const zoneFor  = tripZones(trip ?? {});
  const homeZone = home.zone ?? zoneFor();
  const legs     = buildLegs(trip ?? {}, transportation, { countryCode: home.countryCode ?? null, zone: homeZone });
  return { zoneFor, homeZone, legs };
}

export function startedCheck(
  trip: any,
  transportation: any[],
  home: Home,
): (dayDate: string, stop: Stop, nowMs?: number) => boolean {
  const { zoneFor, homeZone, legs } = journeyOf(trip, transportation, home);
  const clock = stopClock(trip ?? {}, legs, homeZone);
  return (dayDate, stop, nowMs = Date.now()) => {
    const at = clock(dayDate, stop);
    if (at) return at.toMillis() <= nowMs;
    const today = DateTime.fromMillis(nowMs, { zone: zoneFor(dayDate) }).toISODate();
    return !!today && ymd(dayDate) <= today;
  };
}

/**
 * Today's date and the time now on the itinerary's clock: in the zone you're in
 * (home before setting off, the trip's once there) — the zone the stops around
 * now are written in. The now line and "Now" read this, never the phone's zone.
 */
export function hereNow(trip: any, transportation: any[], home: Home): (nowMs?: number) => { ymd: string; mins: number } {
  const { homeZone, legs } = journeyOf(trip, transportation, home);
  const zoneAt = whereAt(trip ?? {}, legs, homeZone);
  return (nowMs = Date.now()) => {
    const dt = DateTime.fromMillis(nowMs, { zone: zoneAt(nowMs) });
    return { ymd: dt.toISODate()!, mins: dt.hour * 60 + dt.minute };
  };
}

// What the record keeps: what you went to, and travel. Booking prep (airport and
// hotel check-in, breakfast), check-outs, arrivals and all-day markers only when
// you wrote something on them.
export function recordable(stop: Stop): boolean {
  if (stop.myNotes?.trim()) return true;
  if (clockMinutes(stop) === null) return false;
  if (stop.source !== 'logistics') return true;
  const phase = stop.metadata?.phase;
  return phase === 'departure' || phase === 'venue';
}

export interface RecordEntry { stop: Stop; linked: LinkedItem[] }
export interface RecordDay   { date: string; dayNumber: number; went: RecordEntry[]; didntGo: Stop[] }

/**
 * Each day as it happened, on the same pages as the itinerary (a night's
 * after-midnight stops stay with that night). Only stops that have started.
 */
export function recordDays(
  days: Day[],
  started: (dayDate: string, stop: Stop) => boolean,
  linked: (stop: Stop) => LinkedItem[],
): RecordDay[] {
  return dayPages(days).map((page, i) => {
    const day     = days[i];
    const stored  = (s: Stop) => (s.afterMidnight && days[i + 1] ? days[i + 1].date : day.date);
    const begun   = page.stops
      .filter(s => started(stored(s), s))
      .sort((a, b) => (a.scheduledStart ?? '').localeCompare(b.scheduledStart ?? ''));
    return {
      date:      ymd(day.date),
      dayNumber: day.dayNumber ?? i + 1,
      went:      begun.filter(s => !s.skipped && recordable(s)).map(stop => ({ stop, linked: linked(stop) })),
      didntGo:   begun.filter(s => s.skipped),
    };
  });
}

/** Went stops on a day that overlap another went stop — "did you go to both?" */
export function clashesIn(went: RecordEntry[]): Map<Stop, Stop[]> {
  // Your own and imported stops — a booking or venue running alongside isn't a clash
  const spans = went
    .map(({ stop }) => {
      const start = stop.scheduledStart ? Date.parse(stop.scheduledStart.slice(0, 16)) : NaN;
      return { stop, start, end: start + (stop.duration || 0) * 60_000 };
    })
    .filter(x => x.stop.source !== 'logistics' && !Number.isNaN(x.start) && x.end > x.start);
  const out = new Map<Stop, Stop[]>();
  for (const a of spans) {
    const others = spans.filter(b => b !== a && a.start < b.end && b.start < a.end).map(b => b.stop);
    if (others.length) out.set(a.stop, others);
  }
  return out;
}

export const dayHeading = (date: string, dayNumber: number) =>
  `${new Date(`${date}T12:00:00`).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' })} · Day ${dayNumber}`;

const place = (s: Stop) => s.locationName || s.address || '';

/** The whole record as plain text — for email. */
export function recordText(title: string, subtitle: string, days: RecordDay[]): string {
  const out: string[] = [title, subtitle, ''];
  for (const d of days.filter(x => x.went.length)) {
    out.push(dayHeading(d.date, d.dayNumber).toUpperCase(), '');
    for (const { stop, linked } of d.went) {
      out.push(`${timeRangeLabel(stop)}  ${stop.name?.trim() || 'Unnamed stop'}`);
      if (place(stop)) out.push(place(stop));
      if (stop.myNotes?.trim()) out.push(...stop.myNotes.trim().split('\n').map(l => `  ${l}`));
      for (const l of linked) {
        if (l.resourceType === 'contact') out.push(`  Contact: ${[l.name, l.phone, l.email].filter(Boolean).join(' · ')}`);
        else if (l.resourceType === 'todo') out.push(`  ${l.completed ? 'Done' : 'To do'}: ${l.name}`);
        else if (l.resourceType === 'note') out.push(`  Note: ${l.name}${l.body ? ` — ${l.body.trim()}` : ''}`);
      }
      out.push('');
    }
  }
  return out.join('\n').trim();
}
