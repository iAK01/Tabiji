import { CATEGORY_LABEL, CLIP_CATEGORIES } from '@/lib/clip/categories';
import { json, preflight, unauthorised, userForKey } from '@/lib/clip/auth';
import { clipTrips } from '@/lib/clip/process';

// GET /api/clip/trips — what the clipper's pop-up offers: your current and
// upcoming trips, and the categories. Also how it checks its key works.

export function OPTIONS() { return preflight(); }

export async function GET(req: Request) {
  const user = await userForKey(req);
  if (!user) return unauthorised();
  const trips = await clipTrips(user._id);
  return json({
    name: user.name ?? '',
    trips: trips.map(t => ({
      id:    String(t._id),
      name:  t.name,
      city:  t.destination?.city ?? '',
      start: t.startDate ? new Date(t.startDate).toISOString().slice(0, 10) : null,
    })),
    categories: CLIP_CATEGORIES.map(c => ({ id: c, label: CATEGORY_LABEL[c] })),
  });
}
