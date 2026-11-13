import connectDB from '@/lib/mongodb/connection';
import Clip from '@/lib/mongodb/models/Clip';
import SavedPlace from '@/lib/mongodb/models/SavedPlace';
import Trip from '@/lib/mongodb/models/Trip';
import { locatePlace, localityWords, sameName } from '@/lib/geo/geocode';
import { isCategory, type ClipCategory } from './categories';
import { fetchPage } from './page';
import { readClip, type ClipItem, type ClipTrip } from './read';

// One clip, after the clipper has sent it: read the page → work out the places
// and tips → pin each place → save it to Discover, merging with what's saved.

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
const pinned = (c: any) => Number.isFinite(c?.lat) && Number.isFinite(c?.lng);

/** Trips a clip could be for: not cancelled, not over. */
export async function clipTrips(userId: any) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return Trip.find({
    userId, deleted: false, status: { $ne: 'cancelled' },
    $or: [{ endDate: { $gte: since } }, { endDate: null }],
  }, 'name destination additionalDestinations startDate endDate').sort({ startDate: 1 }).limit(12).lean() as Promise<any[]>;
}

const placesOf = (trip: any) => [trip.destination, ...(trip.additionalDestinations ?? [])].filter((p: any) => p?.city);

async function cityCentre(city: string, country: string): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token || !city) return null;
  try {
    const q = [city, country].filter(Boolean).join(', ');
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?types=place,locality&limit=1&access_token=${token}`);
    const f = (await res.json())?.features?.[0];
    const [lng, lat] = f?.center ?? [];
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/** Pins a place only on an exact named match near where it is (lib/geo/geocode). */
async function pin(item: ClipItem, trip: any | null): Promise<{ address: string; lat: number; lng: number } | null> {
  const stop = trip
    ? placesOf(trip).find((p: any) => norm(p.city) === norm(item.city)) ?? trip.destination
    : null;
  const centre = pinned(stop?.coordinates) ? stop.coordinates : await cityCentre(item.city || stop?.city, item.country || stop?.country);
  if (!centre) return null;
  const locality = [item.city || stop?.city, item.country || stop?.country].filter(Boolean).join(', ');
  return locatePlace({ name: item.name, query: item.searchQuery, address: item.address }, { center: centre, locality, maxKm: 40 });
}

export async function processClip(
  clipId: string,
  screenshot: { mediaType: 'image/jpeg' | 'image/png'; data: string } | null,
): Promise<void> {
  await connectDB();
  const clip = await Clip.findById(clipId);
  if (!clip || clip.status !== 'processing') return;

  try {
    const trips = await clipTrips(clip.userId);
    const refs  = trips.map((t, i) => ({ ref: `T${i + 1}`, trip: t }));
    const ctxTrips: ClipTrip[] = refs.map(({ ref, trip }) => ({
      ref,
      name:   trip.name,
      places: placesOf(trip).map((p: any) => [p.city, p.country].filter(Boolean).join(', ')).join(' · ') || 'unknown',
      dates:  [trip.startDate, trip.endDate].map((d: any) => (d ? new Date(d).toISOString().slice(0, 10) : '?')).join(' to '),
    }));
    const chosenTrip = clip.tripChoice ? trips.find(t => String(t._id) === String(clip.tripChoice)) ?? null : null;
    const chosenCat: ClipCategory | null = isCategory(clip.categoryChoice) ? clip.categoryChoice : null;

    const page = clip.url ? await fetchPage(clip.url) : null;
    const read = await readClip({
      page, url: clip.url ?? '', title: clip.title ?? '', selection: clip.selection ?? '', note: clip.note ?? '',
      screenshot,
      trips: ctxTrips,
      tripChoice: chosenTrip ? refs.find(r => r.trip === chosenTrip)?.ref ?? null : null,
      categoryChoice: chosenCat,
    });

    const source = {
      url: page?.url ?? clip.url, title: clip.title || page?.title || '', site: page?.site ?? (clip.url ? new URL(clip.url).hostname.replace(/^www\./, '') : ''),
      clipId: clip._id, at: new Date(),
    };
    const savedIds: any[] = [];

    for (const item of read.items) {
      const trip = chosenTrip ?? (item.trip ? refs.find(r => r.ref === item.trip)?.trip ?? null : null);
      const category: ClipCategory = item.kind === 'tip' ? 'tip' : chosenCat && chosenCat !== 'tip' ? chosenCat : item.category === 'tip' ? 'activity' : item.category;
      const city    = item.city || trip?.destination?.city || '';
      const country = item.country || trip?.destination?.country || '';

      // Already saved for this trip or city? Add this page as another source.
      const scope = trip ? { tripId: trip._id } : { tripId: null, city: new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
      const words = localityWords([city, country].join(', '));
      const existing = (await SavedPlace.find({ userId: clip.userId, kind: item.kind, ...scope }).lean() as any[])
        .find(s => norm(s.name) === norm(item.name) || sameName(item.name, s.name, words) || sameName(s.name, item.name, words));

      if (existing) {
        const fill: Record<string, unknown> = {};
        if (!existing.summary && item.why) fill.summary = item.why;
        if (!existing.tip && item.tip) fill.tip = item.tip;
        if (!existing.website && item.website) fill.website = item.website;
        if (item.kind === 'place' && !pinned(existing.coordinates)) {
          const hit = await pin(item, trip);
          if (hit) { fill.coordinates = { lat: hit.lat, lng: hit.lng }; fill.address = hit.address; }
        }
        await SavedPlace.updateOne({ _id: existing._id }, { $set: fill, $push: { sources: source } });
        savedIds.push(existing._id);
        continue;
      }

      const hit = item.kind === 'place' ? await pin(item, trip) : null;
      const doc = await SavedPlace.create({
        userId: clip.userId,
        tripId: trip?._id ?? null,
        city, country,
        kind: item.kind,
        category,
        name: item.name,
        summary: item.why,
        tip: item.tip || undefined,
        address: hit?.address ?? (item.address || undefined),
        coordinates: hit ? { lat: hit.lat, lng: hit.lng } : undefined,
        website: item.website || undefined,
        sources: [source],
      });
      savedIds.push(doc._id);
    }

    clip.savedIds = savedIds;
    clip.summary  = read.summary || (savedIds.length ? '' : 'Nothing to save on that page.');
    clip.status   = 'done';
    await clip.save();
  } catch (err: any) {
    console.error(`[clip] ${clipId} failed`, err);
    clip.status = 'failed';
    clip.error  = String(err?.message ?? err).slice(0, 300);
    await clip.save().catch(() => {});
  }
}
