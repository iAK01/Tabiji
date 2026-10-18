import { after } from 'next/server';
import Trip            from '@/lib/mongodb/models/Trip';
import TripLogistics   from '@/lib/mongodb/models/TripLogistics';
import WikivoyageGuide from '@/lib/mongodb/models/WikivoyageGuide';
import { haversineKm } from '@/lib/geo/geocode';
import { buildGuide, resolveArticle } from './wikivoyage';
import type { Guide, LatLng, TripGuide } from './types';

const STALE_MS   = 7 * 86_400_000;   // articles are re-fetched weekly
const RETRY_MS   = 7 * 86_400_000;   // destinations with no article are looked up again weekly
const STAY_MAX_KM = 50;

function destinationOf(trip: any): { city: string; country: string; coords?: LatLng } | null {
  const d = trip.destination;
  if (!d?.city) return null;
  const coords = typeof d.coordinates?.lat === 'number' ? { lat: d.coordinates.lat, lng: d.coordinates.lng } : undefined;
  return { city: d.city, country: d.country ?? '', coords };
}

// The guide for a trip's destination: the trip remembers which article it resolved to,
// and the parsed article is shared across trips. Throws if Wikivoyage can't be reached
// and nothing is saved yet.
export async function guideForTrip(trip: any): Promise<Guide | null> {
  const dest = destinationOf(trip);
  if (!dest) return null;
  const key = [dest.city, dest.country, dest.coords ? `${dest.coords.lat.toFixed(2)},${dest.coords.lng.toFixed(2)}` : ''].join('|');

  let title: string | null;
  const ref = trip.guide;
  if (ref?.key === key && (ref.title || Date.now() - new Date(ref.resolvedAt).getTime() < RETRY_MS)) {
    title = ref.title;
  } else {
    title = await resolveArticle(dest.city, dest.country, dest.coords);
    await Trip.updateOne({ _id: trip._id }, { guide: { key, title, resolvedAt: new Date() } });
  }
  if (!title) return null;

  const saved = await WikivoyageGuide.findOne({ title }).lean<{ guide: Guide; fetchedAt: Date }>();
  if (saved) {
    if (Date.now() - new Date(saved.fetchedAt).getTime() > STALE_MS) {
      after(() => refreshGuide(title!).catch(err => console.error('Guide refresh failed:', err)));
    }
    return saved.guide;
  }
  return refreshGuide(title);
}

async function refreshGuide(title: string): Promise<Guide | null> {
  const guide = await buildGuide(title);
  if (guide) await WikivoyageGuide.updateOne({ title }, { guide, fetchedAt: new Date() }, { upsert: true });
  return guide;
}

// Where the traveller is staying in this destination — distances in Discover are from here.
export async function stayForTrip(tripId: string, near?: LatLng): Promise<TripGuide['stay']> {
  const logistics = await TripLogistics.findOne({ tripId }).lean<{ accommodation?: any[] }>();
  const stays = (logistics?.accommodation ?? [])
    .filter(a => typeof a?.coordinates?.lat === 'number' && typeof a?.coordinates?.lng === 'number')
    .map(a => ({
      name:        String(a.name ?? 'Your stay'),
      coordinates: { lat: a.coordinates.lat, lng: a.coordinates.lng },
      km:          near ? haversineKm(near.lat, near.lng, a.coordinates.lat, a.coordinates.lng) : 0,
    }))
    .filter(s => s.km <= STAY_MAX_KM)
    .sort((a, b) => a.km - b.km);
  return stays[0] ? { name: stays[0].name, coordinates: stays[0].coordinates } : null;
}
