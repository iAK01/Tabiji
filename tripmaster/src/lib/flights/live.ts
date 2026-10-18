// When to look a flight up, and keeping the shared cache current. Server only.
//
// Each lookup costs from a small monthly allowance, so a flight is asked about
// only when something can have changed: once the day before (terminal, desks,
// an early delay), once before you leave for the airport, every 10–15 min from
// 75 min before departure (the gate — it usually shows in the last hour — and
// any change to it), and around landing until the baggage belt shows. Both the
// 5-minute cron and the app opening a trip run this; the cache row is claimed
// first, so they never both ask.

import FlightStatusModel from '@/lib/mongodb/models/FlightStatus';
import { hasFlightDataKey, lookupFlight, type Lookup } from './aerodatabox';
import { arrivalAt, departureAt, flightPhase, flightRef, landedMs, type FlightStatus } from './status';
import type { Leg } from '@/lib/push/journey';

const MIN  = 60_000;
const HOUR = 60 * MIN;

const MIN_GAP_MS = 8 * MIN;     // never sooner than this for one flight
const RATE_GAP_MS = 1100;       // the free plan takes one request a second
const UNITS_KEY  = '__units';
const LOW_UNITS  = 20;          // under this, only the gate and landing checks
const OUT_UNITS  = 4;

type Slot = 'day' | 'before' | 'gate' | 'arrival';

/** Whether a flight is due a lookup now, and which check it would be. */
export function dueCheck(leg: Leg, doc: any | null, nowMs: number, unitsLeft: number | null): Slot | null {
  if (unitsLeft !== null && unitsLeft < OUT_UNITS) return null;
  const fs: FlightStatus | null = doc?.status ?? null;
  const phase = fs ? flightPhase(fs) : 'scheduled';
  if (fs?.status === 'Canceled' || phase === 'diverted') return null;

  const since = doc?.attemptAt ? nowMs - new Date(doc.attemptAt).getTime() : Infinity;
  if (since < MIN_GAP_MS) return null;
  // A number the provider doesn't know (a typo, a charter) is tried far less often.
  // A minute's slack so a 5-minute cron doesn't stretch every 10 into 15.
  const every = (mins: number) => since >= ((doc?.notFound ? 30 : mins) - 1) * MIN;

  const dep = (fs && departureAt(fs)?.toMillis()) || leg.dep.toMillis();
  const arr = (fs && arrivalAt(fs)?.toMillis()) || leg.arr?.toMillis() || dep + 3 * HOUR;

  if (phase === 'landed') {
    const down = landedMs(fs) ?? arr;
    return !fs!.arr.belt && nowMs < down + 45 * MIN && every(10) ? 'arrival' : null;
  }
  if (nowMs >= arr - 40 * MIN && nowMs <= arr + 90 * MIN) return every(nowMs < arr - 10 * MIN ? 15 : 10) ? 'arrival' : null;
  if (phase === 'airborne') return null;
  if (nowMs >= dep - 75 * MIN && nowMs <= dep + 30 * MIN) return every(fs?.dep.gate ? 15 : 10) ? 'gate' : null;

  if (unitsLeft !== null && unitsLeft < LOW_UNITS) return null;
  const done = doc?.slots ?? {};
  if (nowMs >= dep - 4 * HOUR && nowMs < dep - 75 * MIN) return done.before ? null : 'before';
  if (nowMs >= dep - 26 * HOUR && nowMs < dep - 4 * HOUR) return done.day ? null : 'day';
  return null;
}

// A gate or belt that drops out of the feed (they often do once boarding ends)
// is still the one you want; a new one is remembered with when it showed.
function withHistory(prev: FlightStatus | null, next: NonNullable<Lookup['status']>, nowIso: string): FlightStatus {
  const gates = [...(prev?.gates ?? [])];
  let gateSince = prev?.gateSince ?? null;
  if (next.dep.gate && next.dep.gate !== gates[gates.length - 1]) {
    gates.push(next.dep.gate);
    gateSince = nowIso;
  }
  const belt      = next.arr.belt ?? prev?.arr.belt ?? null;
  const beltSince = belt && belt !== prev?.arr.belt ? nowIso : prev?.beltSince ?? null;
  return {
    ...next,
    dep: {
      ...next.dep,
      gate:     next.dep.gate ?? prev?.dep.gate ?? null,
      terminal: next.dep.terminal ?? prev?.dep.terminal ?? null,
      desk:     next.dep.desk ?? prev?.dep.desk ?? null,
    },
    arr: {
      ...next.arr,
      belt,
      gate:     next.arr.gate ?? prev?.arr.gate ?? null,
      terminal: next.arr.terminal ?? prev?.arr.terminal ?? null,
    },
    gates,
    gateSince,
    beltSince,
  };
}

async function check(ref: NonNullable<ReturnType<typeof flightRef>>, leg: Leg, slot: Slot, nowMs: number): Promise<boolean> {
  try {
    await FlightStatusModel.updateOne({ key: ref.key }, { $setOnInsert: { key: ref.key } }, { upsert: true });
  } catch { /* created by an overlapping run */ }
  const claimed = await FlightStatusModel.findOneAndUpdate(
    { key: ref.key, $or: [{ attemptAt: null }, { attemptAt: { $lt: new Date(nowMs - MIN_GAP_MS) } }] },
    { $set: { attemptAt: new Date(nowMs) } },
    { new: true },
  ).lean() as any;
  if (!claimed) return false;

  try {
    const { status, unitsLeft } = await lookupFlight(ref.number, ref.date, leg.depCode);
    const nowIso = new Date().toISOString();
    const set: Record<string, unknown> = { lastError: null, [`slots.${slot}`]: nowIso, notFound: !status };
    if (status) set.status = withHistory(claimed.status ?? null, status, nowIso);
    await FlightStatusModel.updateOne({ key: ref.key }, { $set: set });
    if (unitsLeft !== null) await FlightStatusModel.updateOne({ key: UNITS_KEY }, { $set: { unitsLeft } }, { upsert: true });
  } catch (err) {
    console.error(`[flights] ${ref.key} lookup failed:`, err);
    await FlightStatusModel.updateOne({ key: ref.key }, { $set: { lastError: String(err) } });
  }
  return true;
}

function byIndex(legs: Array<{ index: number; t: any }>, docs: any[]): Map<number, FlightStatus> {
  const found = new Map(docs.filter(d => d.status).map(d => [d.key, d.status as FlightStatus]));
  const out   = new Map<number, FlightStatus>();
  for (const { index, t } of legs) {
    const ref = flightRef(t);
    const fs  = ref ? found.get(ref.key) : undefined;
    if (fs) out.set(index, fs);
  }
  return out;
}

/** What's saved for a trip's flights, by transport index. No lookups. */
export async function loadFlights(transportation: any[]): Promise<Map<number, FlightStatus>> {
  const legs = transportation.map((t, index) => ({ index, t })).filter(l => flightRef(l.t));
  if (!legs.length) return new Map();
  const docs = await FlightStatusModel.find({ key: { $in: legs.map(l => flightRef(l.t)!.key) } }).lean();
  return byIndex(legs, docs);
}

/** Looks up whichever of these flights are due, then returns what's saved for all of them. */
export async function syncFlights(legs: Leg[], nowMs: number): Promise<Map<number, FlightStatus>> {
  const flights = legs.filter(l => l.type === 'flight' && flightRef(l.t));
  if (!flights.length) return new Map();
  const keys = [...new Set(flights.map(l => flightRef(l.t)!.key))];
  let docs = await FlightStatusModel.find({ key: { $in: [...keys, UNITS_KEY] } }).lean() as any[];

  if (hasFlightDataKey()) {
    const units = docs.find(d => d.key === UNITS_KEY)?.unitsLeft ?? null;
    const asked = new Set<string>();
    let looked  = false;
    for (const leg of flights) {
      const ref = flightRef(leg.t)!;
      if (asked.has(ref.key)) continue;
      asked.add(ref.key);
      const slot = dueCheck(leg, docs.find(d => d.key === ref.key) ?? null, nowMs, units);
      if (!slot) continue;
      if (looked) await new Promise(r => setTimeout(r, RATE_GAP_MS));
      looked = (await check(ref, leg, slot, nowMs)) || looked;
    }
    if (looked) docs = await FlightStatusModel.find({ key: { $in: keys } }).lean() as any[];
  }
  return byIndex(flights, docs);
}
