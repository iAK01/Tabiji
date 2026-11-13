// Walking and driving routes for an itinerary's legs, with the line to draw.
// Google (the same answers as Google Maps), kept in RouteCache so each pair of
// points is asked once. Driving is asked without live traffic: these are for
// planning, and the Navigate dropdown still gives the live time on the day.
// Server only.

import RouteCache from '@/lib/mongodb/models/RouteCache';
import { computeRoute, routeSeconds } from '@/lib/geo/googleRoutes';
import { distanceKm, type LatLng, type LegRoutes, type RouteInfo } from '@/lib/itinerary/dayPlan';

/** Further than this, nobody walks it */
const WALK_MAX_KM  = 8;
/** Nearer than this, nobody drives it */
const DRIVE_MIN_KM = 0.4;
/** New lookups per request — the rest are asked next time */
const MAX_LOOKUPS  = 80;
const PARALLEL     = 6;
const FIELDS       = 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline';

type Mode = 'walk' | 'drive';
type Answer = RouteInfo | null;   // null: Google has no route

async function ask(mode: Mode, from: LatLng, to: LatLng): Promise<Answer | undefined> {
  const route = await computeRoute(mode === 'walk' ? 'WALK' : 'DRIVE', from, to, FIELDS);
  if (route === undefined) return undefined;
  const secs = routeSeconds(route?.duration);
  if (!route || !Number.isFinite(secs)) return null;
  return {
    minutes: Math.max(1, Math.round(secs / 60)),
    metres:  Number(route.distanceMeters) || 0,
    line:    route.polyline?.encodedPolyline ?? null,
  };
}

/**
 * Routes for each pair, keyed by its pair key. A pair is left out when one of
 * its lookups couldn't be made (no key, Google down, too many new ones at once)
 * — the itinerary asks again later.
 */
export async function lookUpRoutes(
  pairs: Array<{ key: string; from: LatLng; to: LatLng }>,
): Promise<Record<string, LegRoutes>> {
  const wanted = pairs.map(p => {
    const km = distanceKm(p.from, p.to);
    const modes: Mode[] = [];
    if (km <= WALK_MAX_KM)  modes.push('walk');
    if (km >= DRIVE_MIN_KM) modes.push('drive');
    return { ...p, modes };
  });
  const ids = wanted.flatMap(p => p.modes.map(m => `${m}:${p.key}`));
  const known = new Map<string, Answer>();
  if (ids.length) {
    const saved = await RouteCache.find({ _id: { $in: ids } }).lean() as any[];
    for (const r of saved) {
      known.set(r._id, r.minutes === null ? null : { minutes: r.minutes, metres: r.metres ?? 0, line: r.line ?? null });
    }
  }

  const todo = ids.filter(id => !known.has(id)).slice(0, MAX_LOOKUPS);
  for (let i = 0; i < todo.length; i += PARALLEL) {
    await Promise.all(todo.slice(i, i + PARALLEL).map(async id => {
      const [mode, key] = [id.slice(0, id.indexOf(':')) as Mode, id.slice(id.indexOf(':') + 1)];
      const p = wanted.find(w => w.key === key)!;
      const answer = await ask(mode, p.from, p.to);
      if (answer === undefined) return;
      known.set(id, answer);
      await RouteCache.updateOne(
        { _id: id },
        { $set: { minutes: answer?.minutes ?? null, metres: answer?.metres ?? null, line: answer?.line ?? null, at: new Date() } },
        { upsert: true },
      ).catch(err => console.error('[routes] could not keep a route', err));
    }));
  }

  const out: Record<string, LegRoutes> = {};
  for (const p of wanted) {
    if (!p.modes.every(m => known.has(`${m}:${p.key}`))) continue;
    out[p.key] = {
      walk:  p.modes.includes('walk')  ? known.get(`walk:${p.key}`)  ?? null : null,
      drive: p.modes.includes('drive') ? known.get(`drive:${p.key}`) ?? null : null,
    };
  }
  return out;
}
